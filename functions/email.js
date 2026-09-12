'use strict';

const { createHash } = require('node:crypto');
const ADMIN_URL = 'https://aminellkadaoui.github.io/consultation/admin.html';
// Resend retains idempotency keys for 24h. Stop uncertain retries before that expires.
const SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function validRequest(data) {
  return !!data && [1, 2].includes(data.schemaVersion) && data.status === 'new'
    && typeof data.fullName === 'string' && data.fullName.trim().length > 0
    && data.fullName.length <= 120 && typeof data.problem === 'string'
    && data.problem.trim().length > 0 && data.problem.length <= 2000;
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254
    && /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(value);
}

function notificationKey(requestId) {
  return 'consultation-request/' + createHash('sha256').update(requestId).digest('hex');
}

function buildNotification({ requestId, data, recipient, from, eventTime }) {
  if (!validRequest(data)) throw new Error('Invalid consultation request');
  if (!validEmail(recipient) || !validEmail(from)) throw new Error('Email configuration is incomplete');
  if (typeof requestId !== 'string' || !requestId) throw new Error('Missing request ID');
  const date = data.submittedAt && typeof data.submittedAt.toDate === 'function'
    ? data.submittedAt.toDate() : new Date(eventTime);
  if (Number.isNaN(date.getTime())) throw new Error('Missing submission date');
  const submitted = new Intl.DateTimeFormat('ar-MA', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Casablanca'
  }).format(date);
  const name = data.fullName.trim();
  const problem = data.problem.trim().slice(0, 400) + (data.problem.trim().length > 400 ? '…' : '');
  const url = `${ADMIN_URL}#request=${encodeURIComponent(requestId)}`;
  return {
    from, to: [recipient], subject: 'طلب استشارة جديد',
    text: `طلب استشارة جديد\n\nالاسم: ${name}\nالتاريخ: ${submitted}\nالمشكلة الأساسية: ${problem}\n\nعرض الطلب:\n${url}`,
    html: `<div lang="ar" dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172235"><h2>طلب استشارة جديد</h2><p><strong>الاسم:</strong> ${escapeHtml(name)}</p><p><strong>التاريخ:</strong> ${escapeHtml(submitted)}</p><p><strong>المشكلة الأساسية:</strong><br>${escapeHtml(problem).replace(/\r?\n/g, '<br>')}</p><p><a href="${escapeHtml(url)}">عرض الطلب</a></p></div>`
  };
}

function deliveryDecision(existing, now) {
  if (['accepted', 'manual_review'].includes(existing?.status)) return 'skip';
  if (existing && now - existing.firstAttemptMs >= SAFE_RETRY_WINDOW_MS) return 'expired';
  if (existing && existing.leaseUntilMs > now) return 'busy';
  return 'send';
}

async function sendWithResend(payload, key, secret, fetcher = fetch) {
  let response;
  try {
    response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000)
    });
  } catch {
    const error = new Error('Email provider connection failed');
    error.retryable = true;
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.id !== 'string' || !body.id) {
    // Never persist provider messages: they can contain recipient addresses or submitted data.
    const error = new Error(`Email provider returned HTTP ${response.status}`);
    error.retryable = response.status >= 500 || response.status === 429 || response.status === 408
      || (response.status === 409 && body.name === 'concurrent_idempotent_requests')
      || response.ok;
    throw error;
  }
  return body.id;
}

module.exports = { escapeHtml, validRequest, validEmail, buildNotification, notificationKey,
  deliveryDecision, sendWithResend, SAFE_RETRY_WINDOW_MS };
