import { adminActions, subscribeAdmin } from './admin-store.js';
import {
  normalizeProgressStages,
  updateTrackedRequest,
  PROGRESS_LABELS
} from './progress-data.js?v=progress-3';

const $ = (id) => document.getElementById(id);
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
    select.addEventListener('change', () => {
      wrapper.dataset.dirty = 'true';
      if (select.value !== 'current') return;
      wrapper.querySelectorAll('[data-progress-stage]').forEach((other) => {
        if (other !== select && other.value === 'current') other.value = 'pending';
      });
    });
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
    const selects = [...wrapper.querySelectorAll('[data-progress-stage]')];
    const stages = selects.map((select) => ({
      key: select.dataset.progressStage,
      status: select.value
    }));
    error.hidden = true;
    error.textContent = '';
    state.textContent = '';
    save.disabled = true;
    selects.forEach(select => { select.disabled = true; });
    save.setAttribute('aria-busy', 'true');
    save.textContent = 'جاري الحفظ…';
    try {
      const saved = await updateTrackedRequest(item.id, { stages });
      wrapper.dataset.dirty = 'false';
      adminActions().updateProgress(item.id, saved);
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
      selects.forEach(select => { select.disabled = false; });
      save.removeAttribute('aria-busy');
      save.textContent = 'حفظ مراحل المتابعة';
    }
  });

  wrapper.append(link, save, state, error);

  const notesField = $('detail-notes')?.closest('.field');
  if (notesField) management.insertBefore(wrapper, notesField);
  else management.append(wrapper);
}

subscribeAdmin((state, reason) => {
  if (['close', 'logout'].includes(reason) || !state.selectedId) {
    document.getElementById('progress-admin-controls')?.remove(); return;
  }
  if (reason !== 'detail' && document.getElementById('progress-admin-controls')) return;
  const item = state.requests.find(item => item.id === state.selectedId);
  if (item) renderProgressControls(item);
});
