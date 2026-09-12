'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deviceIdForToken, buildPushData, invalidTokenError, ADMIN_URL } = require('../push');

test('builds a privacy-limited push payload with an encoded admin deep link', () => {
  const payload = buildPushData('a/b?#&', {
    fullName: 'أحمد',
    whatsapp: '+212612345678',
    problem: 'PRIVATE_PROBLEM'
  });
  assert.equal(payload.title, '🔵 طلب استشارة جديد');
  assert.equal(payload.body, 'أحمد أرسل طلب استشارة جديد');
  assert.ok(payload.url.startsWith(ADMIN_URL));
  assert.ok(payload.url.includes('#request=a%2Fb%3F%23%26'));
  assert.equal(JSON.stringify(payload).includes('+212612345678'), false);
  assert.equal(JSON.stringify(payload).includes('PRIVATE_PROBLEM'), false);
});

test('device IDs are deterministic hashes and never expose the FCM token', () => {
  const token = 'secret-registration-token';
  const id = deviceIdForToken(token);
  assert.equal(id, deviceIdForToken(token));
  assert.notEqual(id, deviceIdForToken(token + '-other'));
  assert.equal(id.includes(token), false);
  assert.match(id, /^[a-f0-9]{64}$/);
});

test('recognizes only FCM errors that require disabling a device token', () => {
  assert.equal(invalidTokenError('messaging/registration-token-not-registered'), true);
  assert.equal(invalidTokenError('messaging/invalid-registration-token'), true);
  assert.equal(invalidTokenError('messaging/internal-error'), false);
});
