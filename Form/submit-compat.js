import { submitRequest } from '../data.js?v=sentence-2';
import { normalizeWhatsapp, normalizeInstagram } from '../public-utils.js';

const $ = (id) => document.getElementById(id);
let submitting = false;

function selectedValue(form, key) {
  const group = form.querySelector(`[data-field="${key}"]`);
  if (!group) return $(key)?.value.trim() || '';
  const values = [...group.querySelectorAll('.choice-input:checked')]
    .map((input) => input.value === '__other__' ? $(key + 'Other')?.value.trim() : input.value)
    .filter(Boolean);
  return group.dataset.multiple === 'true' ? values : (values[0] || '');
}

function collectRequest(form) {
  const result = {};
  for (const key of ['fullName', 'whatsapp', 'instagram', 'lastSituation', 'approach', 'sessionOutcome']) {
    result[key] = $(key)?.value.trim() || '';
  }
  for (const key of ['experience', 'clientCount', 'editingType', 'problem', 'goal', 'obstacle']) {
    result[key] = selectedValue(form, key);
  }
  result.whatsapp = normalizeWhatsapp(result.whatsapp);
  result.instagram = '@' + normalizeInstagram(result.instagram);
  return result;
}

function showError(message) {
  const error = $('formError');
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
  error.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function showSubmittedState(form) {
  form.reset();
  document.documentElement.classList.remove('has-tracking-token');
  document.body.classList.add('submitted');
  const tracking = $('trackingView');
  if (tracking) {
    tracking.hidden = false;
    tracking.querySelectorAll('.client-stage').forEach((stage, index) => {
      stage.classList.remove('completed', 'current', 'pending');
      stage.classList.add(index === 0 ? 'completed' : 'pending');
      const dot = stage.querySelector('.stage-dot');
      if (dot) dot.textContent = index === 0 ? '✓' : '○';
    });
    tracking.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'intakeForm') return;

  const steps = [...form.querySelectorAll('fieldset[data-step]')];
  const lastStep = steps.at(-1);
  if (!lastStep || lastStep.hidden) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (submitting) return;

  const next = $('nextStep');
  const previous = $('previousStep');
  submitting = true;
  if (next) {
    next.disabled = true;
    next.textContent = 'جارٍ إرسال طلبك…';
  }
  if (previous) previous.disabled = true;
  form.setAttribute('aria-busy', 'true');
  const error = $('formError');
  if (error) error.hidden = true;

  try {
    await submitRequest(collectRequest(form));
    showSubmittedState(form);
  } catch (err) {
    console.error('Consultation request failed:', err.code || err.message);
    showError(
      err.code === 'consultation/offline'
        ? 'أنت غير متصل بالإنترنت. إجاباتك ما زالت هنا؛ اتصل ثم حاول مجددًا.'
        : 'تعذّر إرسال الطلب الآن. إجاباتك ما زالت هنا؛ حاول مجددًا بعد قليل.'
    );
  } finally {
    submitting = false;
    form.removeAttribute('aria-busy');
    if (next && !document.body.classList.contains('submitted')) {
      next.disabled = false;
      next.replaceChildren(document.createTextNode('إرسال الفورم '));
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '←';
      next.append(arrow);
    }
    if (previous) previous.disabled = false;
  }
}, true);
