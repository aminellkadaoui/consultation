'use strict';

const { createHash } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const DEVICES = 'consultation_notification_devices';
const DELIVERIES = 'consultation_push_deliveries';
const TEST_LIMITS = 'consultation_notification_test_limits';
const ADMIN_URL = 'https://aminellkadaoui.github.io/consultation/admin/';
const MAX_DEVICE_TOKEN = 4096;
const MAX_USER_AGENT = 500;
const TEST_COOLDOWN_MS = 10_000;

function deviceIdForToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function requestUrl(requestId) {
  return `${ADMIN_URL}#request=${encodeURIComponent(requestId)}`;
}

function buildPushData(requestId, data) {
  const name = cleanText(data?.fullName, 120) || 'عميل';
  return {
    title: '🔵 طلب استشارة جديد',
    body: `${name} أرسل طلب استشارة جديد`,
    requestId: String(requestId),
    url: requestUrl(requestId),
    kind: 'consultation_request'
  };
}

function invalidTokenError(code) {
  return code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token';
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function disableInvalidDevices(db, devices) {
  if (!devices.length) return;
  const batch = db.batch();
  for (const device of devices) {
    batch.set(device.ref, {
      enabled: false,
      disabledReason: 'invalid_fcm_token',
      disabledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await batch.commit();
}

async function sendPushForRequest({ db, requestId, data, messaging = getMessaging() }) {
  const deliveryRef = db.collection(DELIVERIES).doc(requestId);
  const claimed = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(deliveryRef);
    if (snapshot.exists) return false;
    transaction.create(deliveryRef, {
      status: 'processing',
      requestId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return true;
  });
  if (!claimed) return { status: 'duplicate', sent: 0, failed: 0 };

  let devices;
  try {
    const snapshot = await db.collection(DEVICES).where('enabled', '==', true).get();
    devices = snapshot.docs
      .map(doc => ({ ref: doc.ref, id: doc.id, ...doc.data() }))
      .filter(item => typeof item.token === 'string' && item.token.length > 20 && item.token.length <= MAX_DEVICE_TOKEN);
  } catch (error) {
    await deliveryRef.set({
      status: 'failed', reason: 'device_lookup_failed', updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { status: 'failed', sent: 0, failed: 0, error };
  }

  if (!devices.length) {
    await deliveryRef.set({ status: 'no_devices', sent: 0, failed: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { status: 'no_devices', sent: 0, failed: 0 };
  }

  const payload = buildPushData(requestId, data);
  let sent = 0;
  let failed = 0;
  const invalid = [];

  try {
    for (const deviceChunk of chunk(devices, 500)) {
      const response = await messaging.sendEachForMulticast({
        tokens: deviceChunk.map(item => item.token),
        data: payload,
        webpush: { headers: { Urgency: 'high' } }
      });
      sent += response.successCount;
      failed += response.failureCount;
      response.responses.forEach((result, index) => {
        if (!result.success && invalidTokenError(result.error?.code)) invalid.push(deviceChunk[index]);
      });
    }
    await disableInvalidDevices(db, invalid);
    const status = failed ? (sent ? 'partial' : 'failed') : 'sent';
    await deliveryRef.set({
      status, sent, failed, invalidTokensDisabled: invalid.length,
      completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { status, sent, failed };
  } catch (error) {
    await deliveryRef.set({
      status: 'failed', sent, failed: Math.max(failed, devices.length - sent),
      reason: 'fcm_send_failed', updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { status: 'failed', sent, failed: devices.length - sent, error };
  }
}

async function sendTestPush({ db, testId, data, messaging = getMessaging() }) {
  const uid = cleanText(data?.uid, 128);
  const token = cleanText(data?.token, MAX_DEVICE_TOKEN);
  if (!uid || token.length < 20) return { status: 'invalid' };

  const limitRef = db.collection(TEST_LIMITS).doc(uid);
  const now = Date.now();
  const allowed = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(limitRef);
    const lastMs = Number(snapshot.data()?.lastSentMs || 0);
    if (lastMs && now - lastMs < TEST_COOLDOWN_MS) return false;
    transaction.set(limitRef, { lastSentMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!allowed) return { status: 'rate_limited' };

  try {
    await messaging.send({
      token,
      data: {
        title: '🔔 إشعار تجريبي',
        body: 'إشعارات طلبات الاستشارة تعمل على هذا الجهاز',
        requestId: `test-${testId}`,
        url: ADMIN_URL,
        kind: 'consultation_test'
      },
      webpush: { headers: { Urgency: 'high' } }
    });
    return { status: 'sent' };
  } catch (error) {
    if (invalidTokenError(error?.code)) {
      const ref = db.collection(DEVICES).doc(deviceIdForToken(token));
      await ref.set({
        enabled: false, disabledReason: 'invalid_fcm_token',
        disabledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return { status: 'failed', error };
  }
}

module.exports = {
  DEVICES, DELIVERIES, ADMIN_URL, MAX_DEVICE_TOKEN, MAX_USER_AGENT,
  deviceIdForToken, buildPushData, invalidTokenError, sendPushForRequest, sendTestPush
};
