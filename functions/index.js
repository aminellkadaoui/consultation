'use strict';

const { randomUUID } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineBoolean, defineString, defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { validRequest, buildNotification, notificationKey, deliveryDecision, sendWithResend } = require('./email');

initializeApp();
const enabled = defineBoolean('CONSULTATION_EMAIL_ENABLED', { default: false });
const recipient = defineString('CONSULTATION_NOTIFY_EMAIL', { default: '' });
const from = defineString('CONSULTATION_EMAIL_FROM', { default: '' });
const region = defineString('CONSULTATION_FUNCTION_REGION');
const resendKey = defineSecret('RESEND_API_KEY');

exports.notifyConsultationRequest = onDocumentCreated({
  document: 'consultation_requests/{requestId}',
  database: 'default',
  region,
  secrets: [resendKey],
  retry: true,
  timeoutSeconds: 60,
  memory: '256MiB',
  minInstances: 0,
  maxInstances: 2,
  concurrency: 1
}, async event => {
  if (!enabled.value()) return;
  const data = event.data?.data();
  if (!validRequest(data)) {
    logger.warn('Ignored unsupported consultation request', { eventId: event.id });
    return;
  }
  const requestId = event.params.requestId;
  const db = getFirestore('default');
  // This collection is private: clients must never be granted writes to it.
  const ref = db.collection('consultation_email_deliveries').doc(requestId);
  const token = randomUUID();
  const now = Date.now();
  const secret = resendKey.value();
  if (!secret) throw new Error('RESEND_API_KEY is not configured');
  const proposedPayload = buildNotification({
    requestId, data, recipient: recipient.value().trim(), from: from.value().trim(), eventTime: event.time
  });
  const claim = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? snapshot.data() : null;
    const decision = deliveryDecision(existing, now);
    if (decision === 'expired') {
      transaction.update(ref, {
        status: 'manual_review', reason: 'idempotency_window_expired', leaseUntilMs: 0,
        updatedAt: FieldValue.serverTimestamp()
      });
      return { decision };
    }
    if (decision !== 'send') return { decision };
    // Persist the exact first payload so settings changes cannot invalidate an idempotent retry.
    const payload = existing?.payload || proposedPayload;
    const key = existing?.idempotencyKey || notificationKey(requestId);
    transaction.set(ref, {
      status: 'processing', payload, idempotencyKey: key, token,
      firstAttemptMs: existing?.firstAttemptMs ?? now,
      leaseUntilMs: now + 90_000, attempts: (existing?.attempts || 0) + 1,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { decision, payload, key };
  });
  if (claim.decision === 'skip') return;
  if (claim.decision === 'expired') {
    logger.error('Consultation email requires manual review; automatic retry stopped', { requestId });
    return;
  }
  if (claim.decision === 'busy') throw new Error('Email delivery is already in progress');

  let providerId;
  try {
    providerId = await sendWithResend(claim.payload, claim.key, secret);
  } catch (error) {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.data()?.token !== token) return;
      transaction.update(ref, {
        status: error.retryable ? 'pending' : 'manual_review',
        reason: error.message, leaseUntilMs: 0, updatedAt: FieldValue.serverTimestamp()
      });
    });
    if (error.retryable) throw error;
    logger.error('Consultation email requires configuration review', { requestId });
    return;
  }
  // A provider acceptance is not a guarantee of inbox delivery; check the provider log for bounces.
  await ref.update({
    status: 'accepted', providerId, leaseUntilMs: 0,
    acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  });
  logger.info('Consultation email accepted by provider', { requestId, providerId });
});
