import { listRequests } from './data.js?v=sentence-2';
import { normalizeRequest, plainValue } from './request-presenter.js';
import {
  normalizeProgressStages,
  updateTrackedRequest,
  PROGRESS_LABELS
} from './progress-data.js?v=progress-1';

const $ = (id) => document.getElementById(id);
let selectedRequest = null;
let resolving = 0;

function visibleRequests(items) {
  const query = ($('request-search')?.value || '').trim().toLocaleLowerCase();
  const status = $('status-filter')?.value || 'all';
  return items.filter((item) =>
    (status === 'all' || item.status === status)
    && (!query || [
      item.fullName, item.instagram, item.whatsapp, item.problem,
      item.goal, plainValue(item.editingType), item.lastSituation
    ].join(' ').toLocaleLowerCase().includes(query))
  );
}

async function resolveFromRow(button) {
  const version = ++resolving;
  const row = button.closest('tr');
  const rows = [...($('requests-body')?.querySelectorAll('tr') || [])];
  const index = rows.indexOf(row);
  if (index < 0) return null;
  try {
    const requests = (await listRequests()).map(normalizeRequest);
    if (version !== resolving) return null;
    const item = visibleRequests(requests)[index] || null;
    if (item) selectedRequest = item;
    return item;
  } catch {
    return null;
  }
}

async function resolveFromDialog() {
  const hash = location.hash.match(/^#request=(.+)$/);
  let hashId = '';
  if (hash) {
    try { hashId = decodeURIComponent(hash[1]); } catch {}
  }
  try {
    const requests = (await listRequests()).map(normalizeRequest);
    if (hashId) {
      const byId = requests.find((item) => item.id === hashId);
      if (byId) return byId;
    }
    const name = $('detail-name')?.textContent.trim();
    const contacts = [...($('detail-contact')?.querySelectorAll('.contact-chip') || [])]
      .map((node) => node.textContent.trim())
      .filter(Boolean);
    return requests.find((item) => {
      if (name && item.fullName !== name) return false;
      return !contacts.length || contacts.some((contact) =>
        contact === item.whatsapp || contact === item.instagram
      );
    }) || null;
  } catch {
    return null;
  }
}

function progressUrl(token) {
  return new URL(`Form/?token=${encodeURIComponent(token)}`, new URL('./', location.href)).href;
}

function renderProgressControls(item) {
  const management = document.querySelector('#detail-form .management-section');
  if (!management || !item) return;
  document.getElementById('progress-admin-controls')?.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'progress-admin-controls';
  wrapper.className = 'detail-section';

  const heading = document.createElement('div');
  heading.className = 'section-label';
  const badge = document.createElement('span');
  badge.textContent = '↗';
  const headingCopy = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = 'مراحل متابعة العميل';
  const description = document.createElement('p');
  description.className = 'muted';
  description.textContent = 'حدّث ما اكتمل وما هي المرحلة الحالية. التغيير يظهر في رابط العميل.';
  headingCopy.append(title, description);
  heading.append(badge, headingCopy);
  wrapper.append(heading);

  const stages = normalizeProgressStages(item.stages);
  for (const stage of stages) {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    const id = `progress-stage-${stage.key}`;
    label.htmlFor = id;
    label.textContent = PROGRESS_LABELS[stage.key] || stage.key;
    const select = document.createElement('select');
    select.id = id;
    select.dataset.progressStage = stage.key;
    for (const [value, text] of [
      ['completed', 'completed · مكتملة'],
      ['current', 'current · الحالية'],
      ['pending', 'pending · قادمة']
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = stage.status === value;
      select.append(option);
    }
    field.append(label, select);
    wrapper.append(field);
  }

  const link = document.createElement('a');
  link.id = 'progress-client-link';
  link.className = 'button ghost small';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'فتح رابط متابعة العميل';
  if (item.trackingToken) link.href = progressUrl(item.trackingToken);
  else link.hidden = true;

  const save = document.createElement('button');
  save.id = 'save-progress-stages';
  save.type = 'button';
  save.className = 'button secondary';
  save.textContent = 'حفظ مراحل المتابعة';

  const state = document.createElement('span');
  state.id = 'progress-save-state';
  state.className = 'save-state';
  state.setAttribute('role', 'status');

  const error = document.createElement('p');
  error.id = 'progress-save-error';
  error.className = 'notice error';
  error.hidden = true;
  error.setAttribute('role', 'alert');

  save.addEventListener('click', async () => {
    const stages = [...wrapper.querySelectorAll('[data-progress-stage]')].map((select) => ({
      key: select.dataset.progressStage,
      status: select.value
    }));
    error.hidden = true;
    error.textContent = '';
    state.textContent = '';
    save.disabled = true;
    save.setAttribute('aria-busy', 'true');
    save.textContent = 'جاري الحفظ…';
    try {
      const saved = await updateTrackedRequest(item.id, { stages });
      item.stages = saved.stages || stages;
      item.currentStage = saved.currentStage;
      item.trackingToken = saved.trackingToken || item.trackingToken;
      if (item.trackingToken) {
        link.href = progressUrl(item.trackingToken);
        link.hidden = false;
      }
      state.textContent = 'تم حفظ المراحل وتحديث رابط العميل.';
    } catch (err) {
      error.textContent = err?.message || 'تعذّر حفظ مراحل المتابعة.';
      error.hidden = false;
    } finally {
      save.disabled = false;
      save.removeAttribute('aria-busy');
      save.textContent = 'حفظ مراحل المتابعة';
    }
  });

  wrapper.append(link, save, state, error);

  const notesField = $('detail-notes')?.closest('.field');
  if (notesField) management.insertBefore(wrapper, notesField);
  else management.append(wrapper);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.('.row-open');
  if (!button) return;
  resolveFromRow(button).then((item) => {
    if (item && $('request-dialog')?.open) renderProgressControls(item);
  });
}, true);

const dialog = $('request-dialog');
if (dialog) {
  const observer = new MutationObserver(async () => {
    if (!dialog.open) return;
    const item = selectedRequest || await resolveFromDialog();
    if (item) {
      selectedRequest = item;
      renderProgressControls(item);
    }
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  dialog.addEventListener('close', () => {
    selectedRequest = null;
    document.getElementById('progress-admin-controls')?.remove();
  });
}
