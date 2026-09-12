import { login, logout, onAuth, getCurrentUser, listRequests, updateRequest, loadSettings, saveSettings } from './data.js?v=sentence-2';
import { mediaSource, normalizeInstagram, normalizeWhatsapp } from './public-utils.js';
import { statusLabels, requestFieldList, normalizeRequest, presentRequest, plainValue, csvCell, briefFor } from './request-presenter.js';

const $ = (id) => document.getElementById(id);
const formFields = requestFieldList;
const settingsKeys = ['brand', 'headline', 'subheadline', 'videoUrl', 'videoPoster', 'testimonials', 'price', 'currency', 'durationMinutes', 'actionDocHours', 'bookingUrl', 'contactWhatsapp'];
let requests = [];
let settings = {};
let currentUser = null;
let selectedId = null;
let requestsLoaded = false;
let detailDirty = false;
let contentDirty = false;
let contentLoaded = false;
let detailRevision = 0;
let contentRevision = 0;
let loadingVersion = 0;
let toastTimer;
let lastDetailTrigger;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  node.append(use);
  return node;
}
function showMessage(id, message) {
  $(id).textContent = message || '';
  $(id).hidden = !message;
}
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function explainError(error, context = 'general') {
  const code = String(error?.code || '').replace(/^auth\//, '');
  if (/permission-denied|permission_denied|insufficient/i.test(code + ' ' + error?.message)) {
    return 'الحساب مسجّل، لكن ليست لديه صلاحية الوصول. افتح «الإعداد والمساعدة» وانسخ معرّف حسابك لإضافته إلى قواعد Firebase حسب دليل الإعداد.';
  }
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'تعذّر تسجيل الدخول. راجع البريد الإلكتروني وكلمة المرور.';
  if (/too-many-requests/.test(code)) return 'حدثت محاولات كثيرة. انتظر قليلًا ثم حاول من جديد.';
  if (/network|unavailable|fetch/i.test(code + ' ' + error?.message)) return 'تعذّر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى.';
  if (/operation-not-allowed/.test(code)) return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase. راجع دليل الإعداد.';
  if (/invalid-api-key|configuration|not-configured|config-missing|app\/no-app|project-not-found/.test(code + ' ' + error?.message)) return 'ربط Firebase لم يكتمل بعد. اتبع دليل الإعداد ثم أعد تحميل الصفحة.';
  if (error?.message && /[\u0600-\u06ff]/.test(error.message)) return error.message;
  if (context === 'login') return 'تعذّر تسجيل الدخول الآن. راجع إعدادات Firebase وحاول مرة أخرى.';
  if (context === 'save') return 'لم تُحفظ التغييرات. تحقق من الاتصال وصلاحية حسابك ثم حاول مجددًا.';
  return 'تعذّر تحميل البيانات الآن. تحقق من الاتصال وإعدادات الوصول ثم حدّث الصفحة.';
}
function pending(button, active, text) {
  if (active) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = text;
  } else {
    button.textContent = button.dataset.originalText || text;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}
function validHttps(value) {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function supportedVideo(value) {
  if (!value) return true;
  if (!validHttps(value)) return false;
  const media = mediaSource(value);
  return media?.type === 'iframe' || media?.type === 'video';
}
function formatDate(value, detailed = false) {
  let date;
  if (value?.toDate) date = value.toDate();
  else if (value?.seconds) date = new Date(value.seconds * 1000);
  else date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return new Intl.DateTimeFormat('ar-MA', { day: 'numeric', month: 'short', year: 'numeric', ...(detailed ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date);
}
function filteredRequests() {
  const query = $('request-search').value.trim().toLocaleLowerCase();
  const status = $('status-filter').value;
  return requests.filter((item) => (status === 'all' || item.status === status) && (!query || [item.fullName, item.instagram, item.whatsapp, item.problem, item.goal, plainValue(item.editingType), item.lastSituation].join(' ').toLocaleLowerCase().includes(query)));
}
function renderRequests() {
  if (!requestsLoaded) return;
  $('stat-total').textContent = requests.length;
  $('stat-new').textContent = requests.filter((item) => item.status === 'new').length;
  $('stat-scheduled').textContent = requests.filter((item) => item.status === 'scheduled').length;
  $('stat-completed').textContent = requests.filter((item) => item.status === 'completed').length;
  $('nav-count').textContent = requests.filter((item) => item.status === 'new').length;
  const visible = filteredRequests();
  $('request-count').textContent = `${visible.length} طلب ظاهر من أصل ${requests.length}`;
  $('requests-body').replaceChildren();
  $('requests-table-wrap').hidden = !visible.length;
  $('requests-empty').hidden = !!visible.length;
  $('export-csv').disabled = !visible.length;
  $('empty-title').textContent = requests.length ? 'لا توجد طلبات بهذه المواصفات.' : 'أول طلب، بداية جديدة.';
  $('empty-description').textContent = requests.length ? 'جرّب البحث بكلمات أخرى أو اختر كل الحالات.' : 'عندما يرسل أحدهم الفورم، ستجد طلبه هنا لتراجعه قبل الحجز.';
  $('empty-link').hidden = !!requests.length;
  for (const item of visible) {
    const row = element('tr');
    const person = element('td');
    person.append(element('span', 'person-name', item.fullName || 'بدون اسم'));
    const instagram = element('td', 'instagram-cell');
    instagram.append(instagramLink(item.instagram));
    const problem = element('td'); problem.append(element('span', 'problem-preview', item.problem || 'لم يحدد المشكلة'));
    const date = element('td', 'date-cell', formatDate(item.submittedAt || item.createdAt));
    const status = element('td'); status.append(element('span', `status-badge status-${item.status}`, statusLabels[item.status]));
    const action = element('td'); const button = element('button', 'row-open');
    button.type = 'button'; button.setAttribute('aria-label', `فتح طلب ${item.fullName || 'الاستشارة'}`); button.append(icon('arrow'));
    button.addEventListener('click', () => openDetail(item.id, button)); action.append(button);
    row.append(person, instagram, problem, date, status, action); $('requests-body').append(row);
  }
}
async function refreshRequests() {
  if (!currentUser) return;
  const uid = currentUser.uid;
  const version = ++loadingVersion;
  showMessage('requests-error', '');
  $('requests-loading').hidden = false;
  $('requests-empty').hidden = true;
  $('requests-table-wrap').hidden = true;
  $('refresh-requests').disabled = true;
  $('export-csv').disabled = true;
  try {
    const result = await listRequests();
    if (version !== loadingVersion || currentUser?.uid !== uid) return;
    requests = (Array.isArray(result) ? result : []).map(normalizeRequest);
    requestsLoaded = true;
    renderRequests();
    openRequestFromHash();
  } catch (error) {
    if (version !== loadingVersion || currentUser?.uid !== uid) return;
    showMessage('requests-error', explainError(error));
    $('request-count').textContent = requestsLoaded ? 'تعذّر تحديث الطلبات؛ المعروض آخر نسخة تم تحميلها.' : 'تعذّر تحميل الطلبات.';
    if (requestsLoaded) { renderRequests(); $('request-count').textContent = 'تعذّر التحديث؛ المعروض آخر نسخة تم تحميلها.'; }
  } finally {
    if (version === loadingVersion && currentUser?.uid === uid) {
      $('requests-loading').hidden = true;
      $('refresh-requests').disabled = false;
    }
  }
}
function instagramLink(value) {
  const username = normalizeInstagram(value);
  if (/^[A-Za-z0-9._]{1,30}$/.test(username)) {
    const link = element('a', 'instagram-link', `@${username}`);
    link.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.dir = 'ltr';
    return link;
  }
  return element('span', 'muted', value || 'غير متاح');
}
function renderRequestSummary(item) {
  const presentation = presentRequest(item);
  const parts = presentation.sections.map(({title, text, details}) => {
    const section = element('section', 'detail-section');
    section.append(element('h3', '', title), element('p', 'summary-text', text));
    for (const detail of details) {
      const block = element('div', 'summary-situation');
      block.append(element('h4', '', detail.label), element('p', '', detail.text));
      section.append(block);
    }
    return section;
  });
  const raw = element('details', 'raw-answers');
  raw.append(element('summary', '', 'عرض الإجابات الأصلية'));
  const list = element('dl', 'answer-list');
  for (const answer of presentation.raw) {
    const entry = element('div', 'answer-item');
    entry.append(element('dt', '', answer.label), element('dd', '', answer.value)); list.append(entry);
  }
  raw.append(list); parts.push(raw); return parts;
}
function openRequestFromHash() {
  if (!currentUser || !requestsLoaded || $('request-dialog').open) return;
  const match = location.hash.match(/^#request=(.+)$/);
  if (!match) return;
  let id;
  try { id = decodeURIComponent(match[1]); } catch { return; }
  if (requests.some(request => request.id === id)) openDetail(id, null);
}
function openDetail(id, trigger) {
  const item = requests.find((request) => request.id === id);
  if (!item) return;
  selectedId = id; detailDirty = false; lastDetailTrigger = trigger;
  $('detail-name').textContent = item.fullName || 'طلب استشارة';
  $('detail-date').textContent = `أُرسل في ${formatDate(item.submittedAt || item.createdAt, true)}`;
  $('detail-contact').replaceChildren();
  const phone = normalizeWhatsapp(item.whatsapp).replace(/[^0-9]/g, '').replace(/^00/, '');
  const hasPhone = /^[1-9][0-9]{7,14}$/.test(phone);
  if (item.whatsapp) {
    const phoneNode = element(hasPhone ? 'a' : 'span', 'contact-chip', item.whatsapp); phoneNode.dir = 'ltr';
    if (hasPhone) {phoneNode.href = `https://wa.me/${phone}`; phoneNode.target = '_blank'; phoneNode.rel = 'noopener noreferrer';}
    $('detail-contact').append(phoneNode);
  }
  if (item.instagram) {const chip = element('span', 'contact-chip'); chip.append(instagramLink(item.instagram)); $('detail-contact').append(chip);}
  const statusChip = element('span', `status-badge status-${item.status}`, statusLabels[item.status]);
  statusChip.id = 'detail-status-badge'; $('detail-contact').append(statusChip);
  $('detail-whatsapp').hidden = !hasPhone;
  if (hasPhone) {
    const message = `السلام عليكم ${item.fullName.split(' ')[0]}، توصلت بطلبك للاستشارة. قريت الحالة ديالك وبغيت نهضر معك على الخطوة الجاية.`;
    $('detail-whatsapp').href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  } else { $('detail-whatsapp').removeAttribute('href'); }
  $('detail-answers').replaceChildren(...renderRequestSummary(item));
  $('detail-status').value = item.status;
  $('detail-notes').value = item.privateNotes;
  $('detail-save-state').textContent = '';
  showMessage('detail-error', '');
  $('request-dialog').showModal();
  document.body.style.overflow = 'hidden';
  $('request-dialog').scrollTop = 0;
  $('close-detail').focus();
}
function closeDetail(force = false) {
  if (!force && detailDirty && !window.confirm('هناك ملاحظات لم تُحفظ. هل تريد إغلاق الطلب دون حفظها؟')) return;
  $('request-dialog').close(); document.body.style.overflow = ''; selectedId = null; detailDirty = false;
  if (lastDetailTrigger?.isConnected) lastDetailTrigger.focus();
}
async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text); toast(successMessage);
  } catch {
    toast('تعذّر النسخ تلقائيًا. يمكنك تحديد النص ونسخه يدويًا.');
  }
}
function exportCSV() {
  const items = filteredRequests();
  if (!items.length) return;
  const columns = [...formFields, ['submittedAt', 'تاريخ الطلب'], ['status', 'الحالة'], ['privateNotes', 'ملاحظات الإدارة']];
  const rows = [columns.map(([, label]) => csvCell(label)).join(','), ...items.map((item) => columns.map(([key]) => csvCell(key === 'status' ? statusLabels[item.status] : key === 'submittedAt' ? item.submittedAt || item.createdAt || '' : item[key])).join(','))];
  const blob = new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const link = element('a');
  link.href = url; link.download = `consultation-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`تم تصدير ${items.length} طلب.`);
}
function setContentDirty() {
  contentRevision += 1; contentDirty = true; $('content-save-state').textContent = 'لديك تغييرات لم تُنشر بعد.';
}
function updateTestimonialLabels() {
  const cards = [...$('testimonials-editor').children];
  cards.forEach((card, index) => { card.querySelector('h3').textContent = `الرأي ${index + 1}`; });
  $('no-testimonials').hidden = cards.length > 0;
  $('add-testimonial').disabled = cards.length >= 12;
}
function testimonialField(labelText, key, value, type = 'text') {
  const wrapper = element('div', 'field'); const label = element('label', '', labelText);
  const field = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  const id = `review-${crypto.randomUUID()}-${key}`;
  field.id = id; label.htmlFor = id; field.dataset.field = key; field.value = value || '';
  if (type === 'textarea') { field.rows = 3; field.maxLength = 3000; }
  else { field.type = type; field.maxLength = type === 'url' ? 2048 : key === 'name' ? 120 : 200; }
  if (type === 'url') { field.dir = 'ltr'; field.placeholder = 'https://…'; }
  if (key === 'name') field.required = true;
  wrapper.append(label, field); return wrapper;
}
function addTestimonial(item = {}, focus = false) {
  if ($('testimonials-editor').children.length >= 12) return;
  const card = element('section', 'testimonial-edit');
  const heading = element('div', 'testimonial-top'); const remove = element('button', 'icon-button');
  remove.type = 'button'; remove.setAttribute('aria-label', 'حذف هذا الرأي'); remove.append(icon('trash'));
  remove.addEventListener('click', () => { card.remove(); updateTestimonialLabels(); setContentDirty(); $('add-testimonial').focus(); });
  heading.append(element('h3'), remove);
  const fields = element('div', 'testimonial-fields');
  fields.append(testimonialField('الاسم', 'name', item.name), testimonialField('الصفة أو المجال — اختياري', 'role', item.role));
  card.append(heading, fields, testimonialField('نص الرأي — اختياري عند إضافة فيديو أو صورة', 'quote', item.quote, 'textarea'), testimonialField('رابط فيديو الرأي — اختياري', 'videoUrl', item.videoUrl, 'url'), testimonialField('رابط صورة الرأي — اختياري', 'imageUrl', item.imageUrl, 'url'));
  $('testimonials-editor').append(card); updateTestimonialLabels();
  if (focus) { card.querySelector('input').focus(); setContentDirty(); }
}
function populateContent(value) {
  settings = {};
  for (const key of settingsKeys) if (value[key] !== undefined) settings[key] = value[key];
  $('content-brand').value = value.brand || 'أمين القداوي';
  $('content-headline').value = value.headline || 'تعمل كإديتور، لكنك محتار على ماذا تركز الآن؟';
  $('content-subheadline').value = value.subheadline || 'نراجع المشكلة التي تواجهك، ونحدد ما يحتاج تركيزك الآن، وما تفعله أولًا.';
  $('content-video').value = value.videoUrl || '';
  $('content-poster').value = value.videoPoster || '';
  $('content-price').value = value.price ?? 300;
  $('content-duration').value = value.durationMinutes ?? 60;
  $('content-delivery').value = value.actionDocHours ?? 24;
  $('content-booking').value = value.bookingUrl || '';
  $('testimonials-editor').replaceChildren();
  for (const item of value.testimonials || []) addTestimonial(item);
  updateTestimonialLabels(); updateVideoPreview();
  contentDirty = false; $('content-save-state').textContent = 'لا توجد تغييرات غير محفوظة.';
  document.querySelectorAll('[data-brand]').forEach((node) => { node.textContent = value.brand || 'أمين القداوي'; });
}
async function fetchContent() {
  const uid = currentUser?.uid;
  $('save-content').disabled = true;
  showMessage('content-error', '');
  try {
    const saved = await loadSettings();
    if (currentUser?.uid !== uid || !uid) return;
    populateContent({ ...(window.CONSULTATION_CONFIG || {}), ...(saved || {}) });
    contentLoaded = true;
    $('save-content').disabled = false;
  } catch (error) {
    if (currentUser?.uid !== uid || !uid) return;
    showMessage('content-error', explainError(error));
    $('content-save-state').textContent = 'تعذّر تحميل المحتوى. أعد تحميل الصفحة قبل تعديله.';
  }
}
function updateVideoPreview() {
  const url = $('content-video').value.trim();
  $('video-link-preview').hidden = !url || !validHttps(url);
  if (!$('video-link-preview').hidden) $('video-preview-anchor').href = url;
  else $('video-preview-anchor').removeAttribute('href');
}
function collectContent() {
  const reviews = [...$('testimonials-editor').children].map((card) => {
    const item = {};
    for (const field of card.querySelectorAll('[data-field]')) item[field.dataset.field] = field.value.trim();
    return item;
  });
  const next = { ...settings, brand: $('content-brand').value.trim(), headline: $('content-headline').value.trim(), subheadline: $('content-subheadline').value.trim(), videoUrl: $('content-video').value.trim(), videoPoster: $('content-poster').value.trim(), price: Number($('content-price').value), currency: settings.currency || 'درهم', durationMinutes: Number($('content-duration').value), actionDocHours: Number($('content-delivery').value), bookingUrl: $('content-booking').value.trim(), testimonials: reviews };
  if (!next.brand || !next.headline || !next.subheadline) throw new Error('أكمل الاسم والعنوان الرئيسي والنص الذي تحته.');
  for (const [key, label] of [['videoUrl', 'الفيديو'], ['videoPoster', 'صورة الغلاف'], ['bookingUrl', 'الحجز']]) if (!validHttps(next[key])) throw new Error(`استخدم رابط HTTPS صحيحًا في خانة ${label}.`);
  if (!supportedVideo(next.videoUrl)) throw new Error('رابط الفيديو يجب أن يكون من YouTube أو Vimeo أو ملف MP4 أو WebM أو OGG مباشر.');
  for (const [index, review] of reviews.entries()) {
    if (!review.name || (!review.quote && !review.videoUrl && !review.imageUrl)) throw new Error(`الرأي ${index + 1}: أضف الاسم، ونصًا أو فيديو أو صورة للرأي.`);
    if (!validHttps(review.imageUrl) || !supportedVideo(review.videoUrl)) throw new Error(`الرأي ${index + 1}: راجع روابط الصورة والفيديو. استخدم HTTPS ورابط فيديو من YouTube أو Vimeo أو ملف MP4 أو WebM أو OGG.`);
  }
  return next;
}
function switchView(name) {
  const labels = { requests: 'طلبات الاستشارة', content: 'محتوى الصفحة', setup: 'الإعداد والمساعدة' };
  if (!labels[name]) return;
  for (const view of document.querySelectorAll('.view')) view.hidden = view.id !== `${name}-view`;
  for (const button of document.querySelectorAll('[data-view]')) {
    const active = button.dataset.view === name; button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  $('view-label').textContent = labels[name];
  window.scrollTo({ top: 0, behavior: 'instant' });
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage('login-error', '');
  const button = $('login-submit'); pending(button, true, 'جاري تسجيل الدخول…');
  try { await login($('login-email').value.trim(), $('login-password').value); $('login-password').value = ''; }
  catch (error) { showMessage('login-error', explainError(error, 'login')); }
  finally { pending(button, false, 'تسجيل الدخول'); }
});
async function signOut() {
  if ((contentDirty || detailDirty) && !window.confirm('لديك تغييرات لم تُحفظ. هل تريد تسجيل الخروج دون حفظها؟')) return;
  $('logout').disabled = true; $('logout-mobile').disabled = true;
  try { await logout(); }
  catch (error) { toast('تعذّر تسجيل الخروج. حاول مرة أخرى.'); }
  finally { $('logout').disabled = false; $('logout-mobile').disabled = false; }
}
$('logout').addEventListener('click', signOut);
$('logout-mobile').addEventListener('click', signOut);
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => switchView(button.dataset.view));
$('refresh-requests').addEventListener('click', refreshRequests);
$('request-search').addEventListener('input', renderRequests);
$('status-filter').addEventListener('change', renderRequests);
$('export-csv').addEventListener('click', exportCSV);
$('close-detail').addEventListener('click', () => closeDetail());
$('request-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeDetail(); });
$('request-dialog').addEventListener('click', (event) => { if (event.target === $('request-dialog')) { const rect = $('request-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetail(); } });
$('detail-form').addEventListener('input', () => { detailRevision += 1; detailDirty = true; $('detail-save-state').textContent = 'تغييرات غير محفوظة'; });
$('detail-form').addEventListener('change', () => { detailRevision += 1; detailDirty = true; $('detail-save-state').textContent = 'تغييرات غير محفوظة'; });
$('detail-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedId || !currentUser) return;
  const id = selectedId; const uid = currentUser.uid; const savingRevision = detailRevision;
  const changes = { status: $('detail-status').value, privateNotes: $('detail-notes').value.trim() };
  if (!statusLabels[changes.status]) return;
  showMessage('detail-error', ''); pending($('save-detail'), true, 'جاري الحفظ…');
  try {
    await updateRequest(id, changes);
    if (currentUser?.uid !== uid) return;
    const item = requests.find((entry) => entry.id === id); if (item) Object.assign(item, changes);
    if (selectedId === id) { detailDirty = detailRevision !== savingRevision; $('detail-save-state').textContent = detailDirty ? 'حُفظت النسخة السابقة. لديك تغييرات جديدة لم تُحفظ.' : 'تم حفظ المتابعة.'; }
    if (selectedId === id && $('detail-status-badge')) { $('detail-status-badge').textContent = statusLabels[changes.status]; $('detail-status-badge').className = `status-badge status-${changes.status}`; }
    renderRequests(); toast('تم حفظ حالة الطلب وملاحظاتك.');
  } catch (error) { if (selectedId === id) showMessage('detail-error', explainError(error, 'save')); }
  finally { pending($('save-detail'), false, 'حفظ المتابعة'); }
});
$('copy-brief').addEventListener('click', () => { const item = requests.find((request) => request.id === selectedId); if (item) copyText(briefFor(item), 'تم نسخ ملخص الحالة.'); });
$('copy-uid').addEventListener('click', () => { if (currentUser?.uid) copyText(currentUser.uid, 'تم نسخ معرّف الحساب.'); });
$('content-form').addEventListener('input', setContentDirty);
$('content-video').addEventListener('input', updateVideoPreview);
$('add-testimonial').addEventListener('click', () => addTestimonial({}, true));
$('content-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || !contentLoaded) return;
  showMessage('content-error', '');
  let next;
  try { next = collectContent(); }
  catch (error) { showMessage('content-error', error.message); $('content-error').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  const uid = currentUser.uid; const savingRevision = contentRevision; pending($('save-content'), true, 'جاري الحفظ والنشر…');
  try {
    const saved = await saveSettings(next);
    if (currentUser?.uid !== uid) return;
    settings = saved || next; contentDirty = contentRevision !== savingRevision;
    $('content-save-state').textContent = contentDirty ? 'نُشرت النسخة السابقة. لديك تغييرات جديدة لم تُنشر.' : 'تم حفظ المحتوى ونشره بنجاح.';
    toast('تم تحديث محتوى صفحة الاستشارة.');
  } catch (error) { showMessage('content-error', explainError(error, 'save')); $('content-save-state').textContent = 'لم تُنشر تغييراتك. حاول مجددًا.'; }
  finally { pending($('save-content'), false, 'حفظ ونشر التغييرات'); }
});
window.addEventListener('hashchange', openRequestFromHash);
window.addEventListener('beforeunload', (event) => { if (contentDirty || detailDirty) { event.preventDefault(); event.returnValue = ''; } });

async function handleAuth(user) {
  if (user?.uid && currentUser?.uid === user.uid) return;
  currentUser = user || null;
  $('login-screen').hidden = !!user;
  $('app-shell').hidden = !user;
  if (user) {
    $('account-email').textContent = user.email || '';
    $('admin-uid').value = user.uid;
    showMessage('login-error', '');
    await Promise.allSettled([refreshRequests(), fetchContent()]);
  } else {
    ++loadingVersion; requests = []; settings = {}; selectedId = null; requestsLoaded = false; contentLoaded = false; detailDirty = false; contentDirty = false;
    closeDetail(true);
    $('requests-body').replaceChildren(); $('detail-answers').replaceChildren(); $('detail-contact').replaceChildren(); $('detail-notes').value = '';
    $('account-email').textContent = ''; $('admin-uid').value = '';
    $('content-form').reset(); $('testimonials-editor').replaceChildren(); $('detail-name').textContent = ''; $('detail-date').textContent = '';
    $('request-search').value = ''; $('status-filter').value = 'all';
    for (const id of ['stat-total', 'stat-new', 'stat-scheduled', 'stat-completed', 'nav-count']) $(id).textContent = '—';
    switchView('requests');
  }
}
try {
  await onAuth(handleAuth);
  const existing = getCurrentUser();
  if (existing && !currentUser) await handleAuth(existing);
} catch (error) {
  showMessage('login-error', explainError(error, 'login'));
}
