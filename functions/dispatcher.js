'use strict';

const { randomUUID } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const { buildNotification, notificationKey, deliveryDecision, sendWithResend } = require('./email');
const { sendPushForRequest } = require('./push');

const EMAIL_DELIVERIES = 'consultation_email_deliveries';

async function sendEmailChannel({ db, requestId, data, eventTime, enabled, recipient, from, secret }) {
  if (!enabled) return { status: 'disabled' };
  if (!secret) return { status: 'failed', reason: 'missing_resend_key' };

  const ref = db.collection(EMAIL_DELIVERIES).doc(requestId);
  const token = randomUUID();
  const now = Date.now();
  let proposedPayload;
  try {
    proposedPayload = buildNotification({ requestId, data, recipient, from, eventTime });
  } catch (error) {
    await ref.set({
      status: 'manual_review', reason: 'invalid_email_configuration',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { status: 'failed', reason: error.message };
  }

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

  if (claim.decision === 'skip') return { status: 'duplicate' };
  if (claim.decision === 'expired') return { status: 'manual_review' };
  if (claim.decision === 'busy') return { status: 'busy' };

  try {
    const providerId = await sendWithResend(claim.payload, claim.key, secret);
    await ref.update({
      status: 'accepted', providerId, leaseUntilMs: 0,
      acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    return { status: 'accepted', providerId };
  } catch (error) {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.data()?.token !== token) return;
      transaction.update(ref, {
        status: 'manual_review', reason: error.retryable ? 'provider_retry_needed' : 'provider_configuration_error',
        leaseUntilMs: 0, updatedAt: FieldValue.serverTimestamp()
      });
    });
    return { status: 'failed', reason: error.message };
  }
}

async function dispatchNewSubmissionNotification(options) {
  const { requestId } = options;
  const [emailResult, pushResult] = await Promise.allSettled([
    sendEmailChannel(options),
    sendPushForRequest(options)
  ]);

  const summary = {
    email: emailResult.status === 'fulfilled' ? emailResult.value : { status: 'failed' },
    push: pushResult.status === 'fulfilled' ? pushResult.value : { status: 'failed' }
  };

  if (emailResult.status === 'rejected') logger.error('Consultation email channel failed', { requestId });
  if (pushResult.status === 'rejected') logger.error('Consultation push channel failed', { requestId });
  logger.info('Consultation notification dispatch finished', {
    requestId,
    emailStatus: summary.email.status,
    pushStatus: summary.push.status
  });
  return summary;
}

module.exports = { sendEmailChannel, dispatchNewSubmissionNotification };
