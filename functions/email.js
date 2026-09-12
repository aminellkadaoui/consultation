'use strict';

const { createHash } = require('node:crypto');
const ADMIN_URL = 'https://aminellkadaoui.github.io/consultation/admin/';
// Resend retains idempotency keys for 24h. Stop uncertain retries before that expires.
const SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function validRequest(data) {
  return !!data && [1, 2, 3].includes(data.schemaVersion) && data.status === 'new'
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

function short(value, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > max ? text.slice(0, max) + '…' : text;
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
  const name = short(data.fullName, 120);
  const whatsapp = short(data.whatsapp, 32);
  const instagram = short(data.instagram, 80);
  const problem = short(data.problem, 300);
  const goal = short(data.goal, 300);
  const url = `${ADMIN_URL}#request=${encodeURIComponent(requestId)}`;
  const lines = [
    'وصل طلب استشارة جديد.', '',
    `الاسم: ${name}`,
    whatsapp ? `واتساب: ${whatsapp}` : '',
    instagram ? `Instagram: ${instagram}` : '',
    `المشكلة: ${problem}`,
    goal ? `الهدف: ${goal}` : '',
    `رقم الطلب: ${requestId}`,
    `تاريخ الإرسال: ${submitted}`,
    '', 'فتح الطلب في لوحة الإدارة:', url
  ].filter((line, index, list) => line !== '' || (index > 0 && list[index - 1] !== ''));

  const row = (label, value) => value
    ? `<p><strong>${label}:</strong> ${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>` : '';

  return {
    from,
    to: [recipient],
    subject: `🔵 طلب استشارة جديد — ${name}`,
    text: lines.join('\n'),
    html: `<div lang="ar" dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172235"><h2>🔵 طلب استشارة جديد</h2><p>وصل طلب استشارة جديد.</p>${row('الاسم', name)}${row('واتساب', whatsapp)}${row('Instagram', instagram)}${row('المشكلة', problem)}${row('الهدف', goal)}${row('رقم الطلب', requestId)}${row('تاريخ الإرسال', submitted)}<p><a href="${escapeHtml(url)}">فتح الطلب في لوحة الإدارة</a></p></div>`
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
