const $ = (id) => document.getElementById(id);

const quickFilters = [
  ['all', 'الكل'],
  ['new', 'جديد'],
  ['reviewing', 'قيد المراجعة'],
  ['accepted', 'مقبول'],
  ['scheduled', 'موعد محدد'],
  ['completed', 'مكتمل'],
  ['archived', 'مؤرشف']
];

const statusShortcuts = quickFilters.slice(1);
let messageType = 'accept';
let messageLang = 'ar';
let mounted = false;

function firstName() {
  const name = $('detail-name')?.textContent?.trim() || 'أخي';
  return name.split(/\s+/)[0] || 'أخي';
}

function visibleRequestText() {
  const name = $('detail-name')?.textContent?.trim() || 'طلب استشارة';
  const date = $('detail-date')?.textContent?.trim() || '';
  const answers = $('detail-answers')?.innerText?.trim() || '';
  const notes = $('detail-notes')?.value?.trim() || '';
  return [name, date, answers, notes ? `\nملاحظات الإدارة:\n${notes}` : ''].filter(Boolean).join('\n\n');
}

function currentWhatsappHref() {
  const link = $('detail-whatsapp');
  if (!link || link.hidden) return '';
  return link.getAttribute('href') || '';
}

function baseWhatsappUrl() {
  const href = currentWhatsappHref();
  if (!href) return '';
  try {
    const url = new URL(href);
    url.search = '';
    return url.toString();
  } catch {
    return href.split('?')[0];
  }
}

function messageTemplate() {
  const name = firstName();
  const templates = {
    accept: {
      ar: `السلام عليكم ${name}، راجعت طلبك للاستشارة، والاستشارة مناسبة لحالتك. الخطوة التالية هي اختيار الموعد وإكمال الحجز.` ,
      dar: `السلام عليكم ${name}، راجعت طلبك ديال الاستشارة، والاستشارة مناسبة لحالتك. الخطوة الجاية هي تختار الموعد وتكمل الحجز.`
    },
    follow: {
      ar: `السلام عليكم ${name}، راجعت طلبك للاستشارة. عندي نقطة أحتاج توضيحها معك قبل تأكيد الخطوة التالية.` ,
      dar: `السلام عليكم ${name}، راجعت طلبك ديال الاستشارة. عندي نقطة بغيت نوضحها معاك قبل ما نأكد الخطوة الجاية.`
    }
  };
  return templates[messageType][messageLang];
}

function syncMessageSegments() {
  document.querySelectorAll('[data-ux-message-type]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.uxMessageType === messageType);
  });
  document.querySelectorAll('[data-ux-message-lang]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.uxMessageLang === messageLang);
  });
  const textarea = $('ux-message-text');
  if (textarea) textarea.value = messageTemplate();
}

function openMessageDialog() {
  const dialog = $('ux-message-dialog');
  if (!dialog) return;
  syncMessageSegments();
  if (!dialog.open) dialog.showModal();
  $('ux-message-text')?.focus();
}

function closeMessageDialog() {
  const dialog = $('ux-message-dialog');
  if (dialog?.open) dialog.close();
}

async function copyText(text, success = 'تم النسخ.') {
  try {
    await navigator.clipboard.writeText(text);
    showLocalToast(success);
  } catch {
    showLocalToast('تعذر النسخ تلقائيًا.');
  }
}

function showLocalToast(message) {
  const existing = $('ux-local-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'ux-local-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)',
    zIndex: '9999', background: '#111827', color: '#fff', padding: '10px 16px',
    borderRadius: '999px', fontSize: '13px', boxShadow: '0 12px 30px rgba(15,23,42,.2)'
  });
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2600);
}

function downloadBrief() {
  const text = visibleRequestText();
  if (!text) return;
  const name = ($('detail-name')?.textContent || 'consultation-request')
    .trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'consultation-request';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function analysisPrompt() {
  const request = visibleRequestText();
  return `حلل طلب الاستشارة التالي اعتمادًا على المعلومات المكتوبة فقط.\n\nأريد منك:\n1. تحديد المشكلة الأساسية كما يصفها صاحب الطلب.\n2. فصل الأعراض عن السبب المحتمل.\n3. تحديد أهم نقطة تحتاج توضيحًا أثناء الجلسة.\n4. اقتراح الأولوية التي تستحق النقاش أولًا، بدون افتراض معلومات غير موجودة.\n5. أعطني أسئلة تشخيصية قصيرة ومباشرة للجلسة.\n\nبيانات الطلب:\n\n${request}`;
}

function mountQuickFilters() {
  const select = $('status-filter');
  const filterBar = document.querySelector('#requests-view .filter-bar');
  if (!select || !filterBar || $('request-quick-filters')) return;
  const wrap = document.createElement('div');
  wrap.id = 'request-quick-filters';
  wrap.className = 'request-quick-filters';
  wrap.setAttribute('aria-label', 'تصفية سريعة حسب حالة الطلب');
  quickFilters.forEach(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'request-quick-filter';
    button.dataset.status = value;
    button.textContent = label;
    button.addEventListener('click', () => {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncQuickFilters();
    });
    wrap.append(button);
  });
  filterBar.insertAdjacentElement('afterend', wrap);
  select.addEventListener('change', syncQuickFilters);
  syncQuickFilters();
}

function syncQuickFilters() {
  const value = $('status-filter')?.value || 'all';
  document.querySelectorAll('.request-quick-filter').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.status === value);
    button.setAttribute('aria-pressed', String(button.dataset.status === value));
  });
}

function enhanceRows() {
  document.querySelectorAll('#requests-body tr').forEach((row) => {
    if (row.dataset.uxEnhanced === 'true') return;
    row.dataset.uxEnhanced = 'true';
    row.classList.add('ux-clickable');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    const open = () => row.querySelector('.row-open')?.click();
    row.addEventListener('click', (event) => {
      if (event.target.closest('a,button,input,select,textarea,label')) return;
      open();
    });
    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('a,button,input,select,textarea,label')) return;
      event.preventDefault();
      open();
    });
  });
}

function mountStatusShortcuts() {
  const select = $('detail-status');
  const form = $('detail-form');
  if (!select || !form || $('ux-status-shortcuts')) return;
  const wrap = document.createElement('div');
  wrap.id = 'ux-status-shortcuts';
  wrap.className = 'ux-status-shortcuts';
  const label = document.createElement('div');
  label.className = 'ux-status-shortcuts-label';
  label.textContent = 'تحديث سريع للحالة';
  wrap.append(label);
  statusShortcuts.forEach(([value, text]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ux-status-chip';
    button.dataset.status = value;
    button.textContent = text;
    button.addEventListener('click', () => {
      if (select.value === value) return;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncStatusShortcuts();
      form.requestSubmit();
    });
    wrap.append(button);
  });
  const management = form.querySelector('.management-section');
  management?.insertAdjacentElement('afterbegin', wrap);
  select.addEventListener('change', syncStatusShortcuts);
  syncStatusShortcuts();
}

function syncStatusShortcuts() {
  const value = $('detail-status')?.value;
  document.querySelectorAll('.ux-status-chip').forEach((button) => {
    button.classList.toggle('is-current', button.dataset.status === value);
  });
}

function mountDetailTools() {
  const actions = document.querySelector('#request-dialog .detail-actions');
  if (!actions || $('ux-detail-tools')) return;
  const wrap = document.createElement('div');
  wrap.id = 'ux-detail-tools';
  wrap.className = 'ux-detail-tools';

  const message = document.createElement('button');
  message.type = 'button';
  message.className = 'button secondary';
  message.textContent = 'رسالة جاهزة';
  message.addEventListener('click', openMessageDialog);

  const prompt = document.createElement('button');
  prompt.type = 'button';
  prompt.className = 'button secondary';
  prompt.textContent = 'نسخ برومت التحليل';
  prompt.addEventListener('click', () => copyText(analysisPrompt(), 'تم نسخ برومت التحليل.'));

  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'button secondary';
  download.textContent = 'تنزيل الملخص';
  download.addEventListener('click', downloadBrief);

  wrap.append(message, prompt, download);
  actions.insertAdjacentElement('afterend', wrap);
}

function mountMessageDialog() {
  if ($('ux-message-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'ux-message-dialog';
  dialog.innerHTML = `
    <div class="ux-message-card">
      <div class="ux-message-head">
        <div><h2>رسالة للعميل</h2><p>قالب سريع مستوحى من لوحة الأرشيف. عدله قبل الإرسال.</p></div>
        <button type="button" class="ux-message-close" id="ux-message-close" aria-label="إغلاق">×</button>
      </div>
      <div class="ux-message-options">
        <div class="ux-segment" aria-label="نوع الرسالة">
          <button type="button" data-ux-message-type="accept">قبول</button>
          <button type="button" data-ux-message-type="follow">متابعة</button>
        </div>
        <div class="ux-segment" aria-label="لغة الرسالة">
          <button type="button" data-ux-message-lang="ar">عربي</button>
          <button type="button" data-ux-message-lang="dar">دارجة</button>
        </div>
      </div>
      <textarea id="ux-message-text" dir="auto"></textarea>
      <div class="ux-message-actions">
        <button type="button" class="button primary" id="ux-message-whatsapp">فتح في واتساب</button>
        <button type="button" class="button secondary" id="ux-message-copy">نسخ الرسالة</button>
      </div>
      <p class="ux-message-hint">راجع النص قبل الإرسال. لا يتم إرسال أي شيء تلقائيًا.</p>
    </div>`;
  document.body.append(dialog);

  dialog.querySelectorAll('[data-ux-message-type]').forEach((button) => {
    button.addEventListener('click', () => { messageType = button.dataset.uxMessageType; syncMessageSegments(); });
  });
  dialog.querySelectorAll('[data-ux-message-lang]').forEach((button) => {
    button.addEventListener('click', () => { messageLang = button.dataset.uxMessageLang; syncMessageSegments(); });
  });
  $('ux-message-close').addEventListener('click', closeMessageDialog);
  $('ux-message-copy').addEventListener('click', () => copyText($('ux-message-text').value, 'تم نسخ الرسالة.'));
  $('ux-message-whatsapp').addEventListener('click', () => {
    const base = baseWhatsappUrl();
    if (!base) {
      showLocalToast('رقم واتساب غير متاح لهذا الطلب.');
      return;
    }
    const url = `${base}?text=${encodeURIComponent($('ux-message-text').value)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeMessageDialog();
  });
}

function mount() {
  if (mounted) return;
  mounted = true;
  mountQuickFilters();
  mountStatusShortcuts();
  mountDetailTools();
  mountMessageDialog();
  enhanceRows();

  const body = $('requests-body');
  if (body) new MutationObserver(enhanceRows).observe(body, { childList: true });

  const requestDialog = $('request-dialog');
  if (requestDialog) {
    requestDialog.addEventListener('toggle', () => {
      if (requestDialog.open) {
        syncStatusShortcuts();
        syncMessageSegments();
      }
    });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
