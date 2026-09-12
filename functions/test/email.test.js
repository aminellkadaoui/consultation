'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, validRequest, validEmail, buildNotification, notificationKey,
  deliveryDecision, sendWithResend, SAFE_RETRY_WINDOW_MS } = require('../email');

const data = { schemaVersion: 1, status: 'new', fullName: 'محمد', problem: 'أريد تحديد الأولوية',
  submittedAt: { toDate: () => new Date('2026-09-11T11:00:00Z') }, privateNotes: 'PRIVATE_NOTES', whatsapp: 'PRIVATE_PHONE' };
const params = { requestId: 'request-1', data, recipient: 'owner@example.com', from: 'notice@example.com' };

test('accepts the two intake schema versions; rejects malformed or unrelated documents', () => {
  assert.equal(validRequest(data), true);
  assert.equal(validRequest({ ...data, schemaVersion: 2 }), true);
  for (const change of [{ schemaVersion: 3 }, { status: 'completed' }, { fullName: '' }, { problem: {} }, { problem: 'x'.repeat(2001) }]) {
    assert.equal(validRequest({ ...data, ...change }), false);
  }
});

test('escapes all HTML characters and never embeds client markup as HTML', () => {
  assert.equal(escapeHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
  const payload = buildNotification({ ...params, data: { ...data, fullName: '<img src=x onerror=alert(1)>', problem: 'A&B\n<script>x</script>' } });
  assert.equal(payload.html.includes('<img'), false);
  assert.equal(payload.html.includes('<script>'), false);
  assert.ok(payload.html.includes('&lt;script&gt;'));
  assert.ok(payload.html.includes('A&amp;B<br>'));
});

test('contains a short private notification and a request deep link, without the whole intake', () => {
  const payload = buildNotification({ ...params, requestId: 'a/b?#&' });
  assert.equal(payload.subject, 'طلب استشارة جديد');
  assert.deepEqual(payload.to, ['owner@example.com']);
  assert.ok(payload.text.includes('#request=a%2Fb%3F%23%26'));
  assert.equal(JSON.stringify(payload).includes('PRIVATE_'), false);
  const long = buildNotification({ ...params, data: { ...data, problem: 'x'.repeat(700) } });
  assert.ok(long.text.includes('x'.repeat(400) + '…'));
  assert.equal(long.text.includes('x'.repeat(401)), false);
});

test('rejects incomplete or injected sender/recipient addresses', () => {
  for (const value of ['', 'name', 'a@b.com\r\nBcc:other@b.com', 'a@b.com,c@d.com']) {
    assert.equal(validEmail(value), false);
    assert.throws(() => buildNotification({ ...params, recipient: value }));
  }
});

test('uses a deterministic bounded idempotency key even for a long request ID', () => {
  assert.equal(notificationKey('abc'), notificationKey('abc'));
  assert.notEqual(notificationKey('abc'), notificationKey('def'));
  assert.ok(notificationKey('x'.repeat(1500)).length < 256);
});

test('suppresses completed delivery and concurrent delivery, and stops retries before 24h', () => {
  const now = 100000000;
  assert.equal(deliveryDecision(null, now), 'send');
  assert.equal(deliveryDecision({ status: 'accepted' }, now), 'skip');
  assert.equal(deliveryDecision({ status: 'manual_review' }, now), 'skip');
  assert.equal(deliveryDecision({ firstAttemptMs: now - 1000, leaseUntilMs: now + 1000 }, now), 'busy');
  assert.equal(deliveryDecision({ firstAttemptMs: now - 1000, leaseUntilMs: now - 1 }, now), 'send');
  assert.equal(deliveryDecision({ firstAttemptMs: now - SAFE_RETRY_WINDOW_MS, leaseUntilMs: 0 }, now), 'expired');
});

test('sends stable payload and idempotency key to the provider; records acceptance only with an ID', async () => {
  const payload = buildNotification(params);
  const id = await sendWithResend(payload, 'stable-key', 'test-only-secret', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers['Idempotency-Key'], 'stable-key');
    assert.deepEqual(JSON.parse(options.body), payload);
    return { ok: true, status: 200, json: async () => ({ id: 'email-123' }) };
  });
  assert.equal(id, 'email-123');
  await assert.rejects(sendWithResend(payload, 'k', 's', async () => ({ ok: true, status: 200, json: async () => ({}) })), { retryable: true });
});

test('retries network/rate-limit/concurrent failures without exposing response text; rejects permanent failures', async () => {
  const payload = buildNotification(params);
  for (const [status, name, retryable] of [
    [500, 'internal_server_error', true], [429, 'rate_limit_exceeded', true],
    [409, 'concurrent_idempotent_requests', true], [409, 'invalid_idempotent_request', false],
    [401, 'missing_api_key', false], [422, 'validation_error', false]
  ]) {
    await assert.rejects(sendWithResend(payload, 'k', 's', async () => ({
      ok: false, status, json: async () => ({ name, message: 'PRIVATE_RESPONSE' })
    })), error => error.retryable === retryable && !error.message.includes('PRIVATE_RESPONSE'));
  }
  await assert.rejects(sendWithResend(payload, 'k', 's', async () => { throw new Error('PRIVATE_TOKEN'); }),
    error => error.retryable === true && !error.message.includes('PRIVATE_TOKEN'));
});
