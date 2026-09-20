import { updateRequest, moveRequestToTrash, restoreRequest, deleteRequest } from './data.js?v=content-1';
import { adminSnapshot, adminActions, subscribeAdmin } from './admin-store.js';

const $ = (id) => document.getElementById(id);

const quickFilters = [
  ['all', 'الكل'],
  ['new', 'جديد'],
  ['reviewing', 'قيد المراجعة'],
  ['accepted', 'مقبول'],
  ['scheduled', 'موعد محدد'],
  ['completed', 'مكتمل'],
  ['archived', 'مؤرشف'],
  ['trash', 'المهملات']
];

const statusShortcuts = quickFilters.filter(([value]) => !['all', 'trash'].includes(value));
let messageType = 'accept';
let messageLang = 'ar';
let mounted = false;
let requestCache = [];

let syncTimer = 0;
let requestOperationBusy = false;

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
      ar: `السلام عليكم ${name}، راجعت طلبك للاستشارة، والاستشارة مناسبة لحالتك. الخطوة التالية هي اختيار الموعد وإكمال الحجز.`,
      dar: `السلام عليكم ${name}، راجعت طلبك ديال الاستشارة، والاستشارة مناسبة لحالتك. الخطوة الجاية هي تختار الموعد وتكمل الحجز.`
    },
    follow: {
      ar: `السلام عليكم ${name}، راجعت طلبك للاستشارة. عندي نقطة أحتاج توضيحها معك قبل تأكيد الخطوة التالية.`,
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
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)',
    zIndex: '9999', background: '#111827', color: '#fff', padding: '10px 16px',
    borderRadius: '16px', fontSize: '13px', maxWidth: 'calc(100vw - 40px)', width: 'max-content', boxShadow: '0 12px 30px rgba(15,23,42,.2)'
  });
  const openDialogs = [...document.querySelectorAll('dialog[open]')];
  (openDialogs.at(-1) || document.body).append(toast);
  setTimeout(() => toast.remove(), 2600);
}

function requestError(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  if (/permission-denied|insufficient/i.test(text)) return 'Firebase رفض العملية. يلزم نشر قواعد Firestore الجديدة أولًا.';
  if (/network|unavailable|fetch/i.test(text)) return 'تعذّر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى.';
  if (error?.message && /[\u0600-\u06ff]/.test(error.message)) return error.message;
  return 'تعذّر تنفيذ العملية. حاول مرة أخرى.';
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

function ensureTrashOptions() {
  for (const id of ['status-filter', 'detail-status']) {
    const select = $(id);
    if (!select || select.querySelector('option[value="trash"]')) continue;
    const option = document.createElement('option');
    option.value = 'trash';
    option.textContent = 'المهملات';
    if (id === 'detail-status') option.disabled = true;
    select.append(option);
  }
}

function mountTrashNavigation() {
  $('trash-nav')?.addEventListener('click', () => {
    document.querySelector('[data-view="requests"]').click();
    $('status-filter').value='trash';
    $('status-filter').dispatchEvent(new Event('change',{bubbles:true}));
  });
  document.querySelector('[data-view="requests"]')?.addEventListener('click',()=>{
    $('status-filter').value='all';$('status-filter').dispatchEvent(new Event('change',{bubbles:true}));
  });
}
function mountQuickFilters() {
  ensureTrashOptions();
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
    button.className = `request-quick-filter${value === 'trash' ? ' is-trash-filter' : ''}`;
    button.dataset.status = value;
    button.textContent = label;
    button.addEventListener('click', () => {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncQuickFilters();
      scheduleRowsSync(true);
    });
    wrap.append(button);
  });
  filterBar.insertAdjacentElement('afterend', wrap);
  select.addEventListener('change', () => {
    syncQuickFilters();
    scheduleRowsSync();
  });
  $('request-search')?.addEventListener('input', () => scheduleRowsSync());
  syncQuickFilters();
}

function syncQuickFilters() {
  const value = $('status-filter')?.value || 'all';
  const trash = value === 'trash';
  if($('trash-count')) $('trash-count').textContent=requestCache.filter(item=>item.status==='trash').length;
  if(!$('requests-view').hidden){
    $('trash-nav')?.classList.toggle('active',trash);
    $('trash-nav')?.setAttribute('aria-current',trash?'page':'false');
    document.querySelector('[data-view="requests"]').classList.toggle('active',!trash);
    $('requests-title').textContent=trash?'سلة المهملات':'طلبات الاستشارة';
    $('view-label').textContent=trash?'سلة المهملات':'طلبات الاستشارة';
  }
  document.querySelectorAll('.request-quick-filter').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.status === value);
    button.setAttribute('aria-pressed', String(button.dataset.status === value));
    const entry = quickFilters.find(([status]) => status === button.dataset.status);
    const count = requestCache.filter(item => entry[0] === 'all' ? item.status !== 'trash' : item.status === entry[0]).length;
    button.textContent = `${entry[1]} (${count})`;
  });
}

function addRowTrashActions(row, item) {
  const cell = row.lastElementChild;
  if (!cell) return;
  cell.classList.add('ux-row-actions');
  cell.querySelectorAll('[data-ux-trash-action]').forEach(node => node.remove());

  const make = (action, label, className = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.uxTrashAction = action;
    button.className = `ux-row-action ${className}`.trim();
    button.textContent = label;
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      await runRequestAction(action, item.id, item.fullName || 'هذا الطلب');
    });
    return button;
  };

  if (item.status === 'trash') {
    cell.append(make('restore', 'استرجاع', 'is-restore'), make('delete', 'حذف نهائي', 'is-danger'));
  } else {
    cell.append(make('trash', 'حذف', 'is-danger-soft'));
  }
}

function enhanceRows() {
  document.querySelectorAll('#requests-body tr').forEach((row) => {
    if (row.dataset.uxEnhanced === 'true') return;
    row.dataset.uxEnhanced = 'true';
    row.classList.add('ux-clickable');
    row.tabIndex = 0;
    row.setAttribute('aria-label', `طلب ${row.querySelector('.person-name')?.textContent || ''}`);
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

function syncRowsWithData() {
  requestCache = adminSnapshot().requests;
  ensureTrashOptions();
  for (const row of document.querySelectorAll('#requests-body tr')) {
    const item = requestCache.find(item => item.id === row.dataset.requestId);
    if (item) addRowTrashActions(row, item);
  }
  enhanceRows();
  syncQuickFilters();
  syncTrashControls();
  syncStatusShortcuts();
  syncBulkSelection();
}

function scheduleRowsSync(force = false) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncRowsWithData(force), 60);
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
      scheduleRowsSync(true);
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
  if ($('ux-status-shortcuts')) $('ux-status-shortcuts').hidden = value === 'trash';
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

function currentDialogRequestId() {
  const dialog = $('request-dialog');
  if (dialog?.dataset.requestId) return dialog.dataset.requestId;
  const match = location.hash.match(/^#request=(.+)$/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}

function currentDialogStatus() {
  return $('request-dialog')?.dataset.requestStatus || $('detail-status')?.value || '';
}

function mountTrashControls() {
  const form = $('detail-form');
  if (!form || $('ux-trash-controls')) return;
  const wrap = document.createElement('section');
  wrap.id = 'ux-trash-controls';
  wrap.className = 'ux-trash-controls';
  wrap.innerHTML = `
    <div class="ux-trash-copy"><b>إدارة الطلب</b><span id="ux-trash-help">يمكن نقل الطلب إلى المهملات واسترجاعه لاحقًا.</span></div>
    <div class="ux-trash-buttons">
      <button type="button" class="button ux-trash-button" id="ux-move-trash">نقل إلى المهملات</button>
      <button type="button" class="button ux-restore-button" id="ux-restore-trash" hidden>استرجاع الطلب</button>
      <button type="button" class="button ux-delete-button" id="ux-delete-forever" hidden>حذف نهائي</button>
    </div>`;
  form.insertAdjacentElement('afterend', wrap);
  $('ux-move-trash').addEventListener('click', () => runRequestAction('trash', currentDialogRequestId(), $('detail-name')?.textContent || 'هذا الطلب', true));
  $('ux-restore-trash').addEventListener('click', () => runRequestAction('restore', currentDialogRequestId(), $('detail-name')?.textContent || 'هذا الطلب', true));
  $('ux-delete-forever').addEventListener('click', () => runRequestAction('delete', currentDialogRequestId(), $('detail-name')?.textContent || 'هذا الطلب', true));
  syncTrashControls();
}

function syncTrashControls() {
  const status = currentDialogStatus();
  const trashed = status === 'trash';
  if ($('ux-move-trash')) $('ux-move-trash').hidden = trashed;
  if ($('ux-restore-trash')) $('ux-restore-trash').hidden = !trashed;
  if ($('ux-delete-forever')) $('ux-delete-forever').hidden = !trashed;
  if ($('ux-trash-help')) $('ux-trash-help').textContent = trashed
    ? 'الطلب في المهملات. يمكنك استرجاعه أو حذفه نهائيًا.'
    : 'يمكن نقل الطلب إلى المهملات واسترجاعه لاحقًا.';
}

function confirmAction(message, permanent = false) {
  if (document.getElementById('ux-confirm-dialog')) return Promise.resolve(false);
  return new Promise(resolve => {
    const dialog = document.createElement('dialog'); dialog.id = 'ux-confirm-dialog';
    dialog.setAttribute('aria-labelledby', 'ux-confirm-title'); dialog.setAttribute('aria-describedby', 'ux-confirm-message');
    const title = document.createElement('h2'); title.id = 'ux-confirm-title';
    title.textContent = permanent ? 'تأكيد الحذف النهائي' : 'تأكيد الإجراء';
    const copy = document.createElement('p'); copy.id = 'ux-confirm-message'; copy.textContent = message;
    const actions = document.createElement('div'); actions.className = 'ux-confirm-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'button secondary'; cancel.textContent = 'إلغاء';
    const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = permanent ? 'button ux-delete-button' : 'button primary';
    confirm.textContent = permanent ? 'نعم، احذف نهائيًا' : 'تأكيد';
    const finish = result => { dialog.close(); dialog.remove(); resolve(result); };
    cancel.addEventListener('click', () => finish(false)); confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    actions.append(cancel, confirm); dialog.append(title, copy, actions); document.body.append(dialog);
    dialog.showModal(); cancel.focus();
  });
}

async function runRequestAction(action, id, name, fromDialog = false) {
  if (!id || requestOperationBusy) {
    if (!id) showLocalToast('تعذّر تحديد الطلب. حدّث الصفحة وحاول مرة أخرى.');
    return;
  }
  const confirms = {
    trash: `نقل طلب ${name} إلى سلة المهملات؟ يمكنك استرجاعه لاحقًا.`,
    restore: `استرجاع طلب ${name} من المهملات؟`,
    delete: `حذف طلب ${name} نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`
  };
  if (fromDialog && adminActions().isDetailDirty?.()) {
    showLocalToast('احفظ الملاحظات ومراحل المتابعة أولًا، ثم أعد العملية.'); return;
  }
  if (!(await confirmAction(confirms[action], action === 'delete'))) return;

  requestOperationBusy = true;
  document.querySelectorAll('#ux-trash-controls button, [data-ux-trash-action]').forEach(button => button.disabled = true);
  try {
    if (action === 'trash') await moveRequestToTrash(id);
    else if (action === 'restore') await restoreRequest(id);
    else if (action === 'delete') await deleteRequest(id);
    else return;

    const messages = {
      trash: 'تم نقل الطلب إلى المهملات.',
      restore: 'تم استرجاع الطلب.',
      delete: 'تم حذف الطلب نهائيًا.'
    };
    showLocalToast(messages[action]);
    if (fromDialog && $('request-dialog')?.open) adminActions().close();
    await adminActions().refresh();
  } catch (error) {
    showLocalToast(requestError(error));
  } finally {
    requestOperationBusy = false;
    document.querySelectorAll('#ux-trash-controls button, [data-ux-trash-action]').forEach(button => button.disabled = false);
  }
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

const selectedRequests = new Set();
let bulkBusy = false;
function mountBulkActions() {
  const head = document.querySelector('#requests-table-wrap thead tr');
  if (!head || $('ux-select-all')) return;
  const cell = document.createElement('th'); cell.className = 'ux-select-cell';
  const all = document.createElement('input'); all.type = 'checkbox'; all.id = 'ux-select-all';
  all.setAttribute('aria-label', 'تحديد كل الطلبات الظاهرة');
  all.addEventListener('change', () => {
    for (const row of document.querySelectorAll('#requests-body tr')) {
      if (all.checked) selectedRequests.add(row.dataset.requestId);
      else selectedRequests.delete(row.dataset.requestId);
    }
    syncBulkSelection();
  });
  cell.append(all); head.prepend(cell);
  const bar = document.createElement('div'); bar.id = 'ux-bulk-bar'; bar.className = 'ux-bulk-bar'; bar.hidden = true;
  bar.setAttribute('aria-label', 'إجراءات الطلبات المحددة');
  bar.innerHTML = `<strong id="ux-bulk-count" role="status"></strong>
    <button type="button" class="button secondary" data-bulk="accepted">قبول المحدد</button>
    <button type="button" class="button secondary" data-bulk="archived">أرشفة المحدد</button>
    <button type="button" class="button ux-trash-button" data-bulk="trash">نقل للمهملات</button>
    <button type="button" class="button ux-restore-button" data-bulk="restore">استرجاع المحدد</button>
    <button type="button" class="button ghost" data-bulk="clear">إلغاء التحديد</button>`;
  $('requests-table-wrap').insertAdjacentElement('beforebegin', bar);
  bar.addEventListener('click', event => {
    const button = event.target.closest('[data-bulk]');
    if (button) runBulkAction(button.dataset.bulk);
  });
}
function syncBulkSelection() {
  const rows = [...document.querySelectorAll('#requests-body tr')];
  const visibleIds = new Set(rows.map(row => row.dataset.requestId));
  for (const id of selectedRequests) if (!visibleIds.has(id)) selectedRequests.delete(id);
  for (const row of rows) {
    let check = row.querySelector('.ux-select-request');
    if (!check) {
      const cell = document.createElement('td'); cell.className = 'ux-select-cell';
      check = document.createElement('input'); check.type = 'checkbox'; check.className = 'ux-select-request';
      check.setAttribute('aria-label', `تحديد ${row.querySelector('.person-name')?.textContent || 'الطلب'}`);
      check.addEventListener('change', () => {
        if (check.checked) selectedRequests.add(row.dataset.requestId); else selectedRequests.delete(row.dataset.requestId);
        syncBulkSelection();
      });
      cell.append(check); row.prepend(cell);
    }
    check.checked = selectedRequests.has(row.dataset.requestId); check.disabled = bulkBusy;
    row.classList.toggle('ux-selected', check.checked);
  }
  const all = $('ux-select-all');
  if (all) { all.checked = rows.length > 0 && selectedRequests.size === rows.length; all.indeterminate = selectedRequests.size > 0 && selectedRequests.size < rows.length; all.disabled = !rows.length || bulkBusy; }
  const bar = $('ux-bulk-bar');
  if (!bar) return;
  bar.hidden = !selectedRequests.size;
  $('ux-bulk-count').textContent = `${selectedRequests.size} طلب محدد`;
  const isTrash = $('status-filter').value === 'trash';
  bar.querySelectorAll('[data-bulk]').forEach(button => {
    button.disabled = bulkBusy;
    button.hidden = button.dataset.bulk === 'restore' ? !isTrash : isTrash && ['accepted','archived','trash'].includes(button.dataset.bulk);
  });
}
async function runBulkAction(action) {
  if (bulkBusy || requestOperationBusy) return;
  if (action === 'clear') { selectedRequests.clear(); syncBulkSelection(); return; }
  const ids = [...selectedRequests]; if (!ids.length) return;
  const label = { accepted: 'قبول', archived: 'أرشفة', trash: 'نقل إلى المهملات', restore: 'استرجاع' }[action];
  if (!label || !(await confirmAction(`${label}: ${ids.length} طلب محدد؟`))) return;
  bulkBusy = true; requestOperationBusy = true; syncBulkSelection();
  let succeeded = 0;
  try {
    for (const id of ids) {
      if (action === 'trash') await moveRequestToTrash(id);
      else if (action === 'restore') await restoreRequest(id);
      else await updateRequest(id, { status: action });
      succeeded++; selectedRequests.delete(id);
    }
    showLocalToast(`تمت العملية على ${succeeded} طلب.`);
  } catch (error) {
    showLocalToast(`اكتمل ${succeeded} من ${ids.length}. ${requestError(error)}`);
  } finally {
    bulkBusy = false; requestOperationBusy = false;
    await adminActions().refresh(); syncBulkSelection();
  }
}

function mount() {
  if (mounted) return;
  mounted = true;
  ensureTrashOptions();
  mountTrashNavigation();
  mountQuickFilters();
  mountStatusShortcuts();
  mountDetailTools();
  mountTrashControls();
  mountMessageDialog();
  mountBulkActions();
  subscribeAdmin((state, reason) => {
    if (reason === 'logout') { selectedRequests.clear(); closeMessageDialog(); $('ux-message-text').value = ''; }
    syncRowsWithData();
  });
  enhanceRows();
  scheduleRowsSync(true);

  const body = $('requests-body');
  if (body) new MutationObserver(() => {
    enhanceRows();
    scheduleRowsSync();
  }).observe(body, { childList: true });


}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
