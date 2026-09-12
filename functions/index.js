'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineBoolean, defineString, defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { validRequest } = require('./email');
const { dispatchNewSubmissionNotification } = require('./dispatcher');
const { sendTestPush } = require('./push');

initializeApp();
const emailEnabled = defineBoolean('CONSULTATION_EMAIL_ENABLED', { default: false });
const recipient = defineString('CONSULTATION_NOTIFY_EMAIL', { default: '' });
const from = defineString('CONSULTATION_EMAIL_FROM', { default: '' });
const region = defineString('CONSULTATION_FUNCTION_REGION');
const resendKey = defineSecret('RESEND_API_KEY');

exports.notifyConsultationRequest = onDocumentCreated({
  document: 'consultation_requests/{requestId}',
  database: 'default',
  region,
  secrets: [resendKey],
  retry: false,
  timeoutSeconds: 60,
  memory: '256MiB',
  minInstances: 0,
  maxInstances: 2,
  concurrency: 1
}, async event => {
  const data = event.data?.data();
  if (!validRequest(data)) {
    logger.warn('Ignored unsupported consultation request', { eventId: event.id });
    return;
  }

  const requestId = event.params.requestId;
  const enabled = emailEnabled.value();
  const db = getFirestore('default');

  // Notifications are deliberately secondary. Any channel failure is recorded/logged
  // by the dispatcher and never changes the already-successful client submission.
  await dispatchNewSubmissionNotification({
    db,
    requestId,
    data,
    eventTime: event.time,
    enabled,
    recipient: enabled ? recipient.value().trim() : '',
    from: enabled ? from.value().trim() : '',
    secret: enabled ? resendKey.value() : ''
  });
});

exports.sendConsultationPushTest = onDocumentCreated({
  document: 'consultation_notification_tests/{testId}',
  database: 'default',
  region,
  retry: false,
  timeoutSeconds: 30,
  memory: '256MiB',
  minInstances: 0,
  maxInstances: 1,
  concurrency: 1
}, async event => {
  const data = event.data?.data() || {};
  const testId = event.params.testId;
  const db = getFirestore('default');
  const result = await sendTestPush({ db, testId, data });
  logger.info('Consultation push test finished', { testId, status: result.status });
  // Test requests contain an FCM token, so remove them after processing.
  await event.data?.ref.delete().catch(() => {});
});
