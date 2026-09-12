import {
  loadProgress,
  normalizeProgressStages,
  submitTrackedRequest
} from '../progress-data.js?v=progress-1';
import {
  normalizeWhatsapp,
  validWhatsapp,
  normalizeInstagram,
  validInstagram
} from '../public-utils.js';

const $ = (id) => document.getElementById(id);
const stepNames = ['معلوماتك', 'وضعك الحالي', 'مشكلتك الأساسية', 'هدفك والعائق', 'ماذا تريد من الجلسة؟'];
const tracking = $('trackingView');
const formView = $('formView');
let currentStep = 0;
let busy = false;

function renderTracking(stages) {
  const normalized = normalizeProgressStages(stages);
  const items = [...tracking.querySelectorAll('.client-stage')];
  items.forEach((item, index) => {
    const status = normalized[index]?.status || 'pending';
    item.classList.remove('completed', 'current', 'pending');
    item.classList.add(status);
    const dot = item.querySelector('.stage-dot');
    if (dot) dot.textContent = status === 'completed' ? '✓' : '○';
  });
  document.body.classList.add('submitted');
  document.documentElement.classList.remove('has-tracking-token');
  tracking.hidden = false;
}

function renderTrackingError(message) {
  document.body.classList.add('submitted');
  document.documentElement.classList.remove('has-tracking-token');
  tracking.hidden = false;
  const title = tracking.querySelector('.tracking-head h2');
  const copy = tracking.querySelector('.tracking-head p');
  if (title) title.textContent = 'تعذّر تحميل المتابعة';
  if (copy) copy.textContent = message;
  const list = tracking.querySelector('.client-stages');
  if (list) list.hidden = true;
}

async function showExistingProgress(token) {
  try {
    const progress = await loadProgress(token);
    renderTracking(progress.stages);
  } catch (error) {
    console.error('Progress load failed:', error.code || error.message);
    renderTrackingError('راجع رابط المتابعة وتأكد أنه كامل وصحيح.');
  }
}

function textError(message, field) {
  const error = $('formError');
  error.textContent = message;
  error.hidden = false;
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', 'formError');
    field.focus();
  }
}

function setupForm() {
  const form = $('intakeForm');
  if (!form) throw new Error('Consultation form was not found.');
  const fieldsets = [...form.querySelectorAll('fieldset[data-step]')];
  const next = $('nextStep');
  const previous = $('previousStep');
  const stepLabel = $('stepLabel');
  const stepCounter = $('stepCounter');
  const error = $('formError');
  const bars = [...document.querySelectorAll('.progress-bars i')];

  function selectedValue(key) {
    const group = form.querySelector(`[data-field="${key}"]`);
    if (!group) return $(key)?.value.trim() || '';
    const values = [...group.querySelectorAll('.choice-input:checked')]
      .map((input) => input.value === '__other__' ? $(key + 'Other').value.trim() : input.value)
      .filter(Boolean);
    return group.dataset.multiple === 'true' ? values : (values[0] || '');
  }

  function updateSentencePreviews() {
    document.querySelectorAll('[data-answer-preview]').forEach((preview) => {
      const key = preview.dataset.answerPreview;
      const group = form.querySelector(`[data-field="${key}"]`);
      const display = group
        ? [...group.querySelectorAll('.choice-input:checked')]
            .map((input) => input.value === '__other__' ? $(key + 'Other').value.trim() : input.value)
            .filter(Boolean)
            .join(' و')
        : ($(key)?.value.trim() || '');
      const answer = key === 'sessionOutcome'
        ? display.replace(/^(?:أعرف|اعرف|نعرف)\s+/, '')
        : display;
      preview.textContent = answer || '[' + (preview.dataset.empty || '') + ']';
    });
  }

  function renderNextButton() {
    if (busy) {
      next.textContent = 'جارٍ إرسال طلبك…';
      return;
    }
    next.replaceChildren(document.createTextNode(currentStep === fieldsets.length - 1 ? 'إرسال الفورم ' : 'التالي '));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '←';
    next.append(arrow);
  }

  function showStep(index, focus = true) {
    currentStep = index;
    fieldsets.forEach((field, i) => { field.hidden = i !== index; });
    if (stepLabel) stepLabel.textContent = stepNames[index] || '';
    if (stepCounter) {
      stepCounter.innerHTML = String(index + 1).padStart(2, '0')
        + ' <span>/ ' + String(fieldsets.length).padStart(2, '0') + '</span>';
    }
    bars.forEach((bar, i) => bar.classList.toggle('active', i <= index));
    previous.hidden = index === 0;
    renderNextButton();
    error.hidden = true;
    error.textContent = '';
    if (focus) {
      const first = fieldsets[index].querySelector('input:not(:disabled),textarea:not(:disabled)');
      first?.focus({ preventScroll: true });
      $('formArea')?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    updateSentencePreviews();
  }

  function validateStep(index, report = true) {
    const step = fieldsets[index];
    function reject(message, field) {
      if (report) textError(message, field);
      return false;
    }
    for (const group of step.querySelectorAll('.choice-field')) {
      const checked = [...group.querySelectorAll('.choice-input:checked')];
      if (!checked.length) {
        if (report) group.setAttribute('aria-invalid', 'true');
        return reject('اختر إجابة للمتابعة.', group.querySelector('input'));
      }
      if (checked.some((input) => input.value === '__other__')) {
        const other = $(group.dataset.field + 'Other');
        if (!other.value.trim()) return reject('اكتب إجابتك في «أخرى».', other);
      }
    }
    for (const input of step.querySelectorAll('input:not(.choice-input):enabled,textarea:enabled')) {
      const value = input.value.trim();
      if (input.required && !value) return reject('أكمل هذا الحقل حتى أفهم حالتك.', input);
      if (input.id === 'whatsapp' && !validWhatsapp(value)) {
        return reject('اكتب رقم واتساب صحيحًا مع رمز الدولة، مثل +212612345678.', input);
      }
      if (input.id === 'instagram' && !validInstagram(value)) {
        return reject('اكتب اسم مستخدم Instagram صحيحًا أو رابط حسابك.', input);
      }
      if (!input.checkValidity()) return reject('راجع الإجابة في هذا الحقل وطولها.', input);
    }
    return true;
  }

  function collectRequest() {
    const result = {};
    for (const key of ['fullName', 'whatsapp', 'instagram', 'lastSituation', 'approach', 'sessionOutcome']) {
      result[key] = $(key).value.trim();
    }
    for (const key of ['experience', 'clientCount', 'editingType', 'problem', 'goal', 'obstacle']) {
      result[key] = selectedValue(key);
    }
    result.whatsapp = normalizeWhatsapp(result.whatsapp);
    result.instagram = '@' + normalizeInstagram(result.instagram);
    return result;
  }

  form.addEventListener('change', (event) => {
    if (!event.target.matches('.choice-input')) return;
    const group = event.target.closest('.choice-field');
    const otherSelected = [...group.querySelectorAll('.choice-input:checked')]
      .some((input) => input.value === '__other__');
    const otherBox = group.querySelector('.other-answer');
    const otherInput = $(group.dataset.field + 'Other');
    if (otherBox) otherBox.hidden = !otherSelected;
    if (otherInput) otherInput.disabled = !otherSelected;
    group.removeAttribute('aria-invalid');
    error.hidden = true;
    updateSentencePreviews();
    if (event.target.value === '__other__' && event.target.checked) {
      otherInput?.focus({ preventScroll: true });
    }
  });

  form.addEventListener('input', (event) => {
    updateSentencePreviews();
    if (event.target.matches('input,textarea')) {
      event.target.removeAttribute('aria-invalid');
      event.target.removeAttribute('aria-describedby');
      error.hidden = true;
    }
  });

  previous.addEventListener('click', () => {
    if (!busy && currentStep > 0) showStep(currentStep - 1);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !validateStep(currentStep)) return;

    if (currentStep < fieldsets.length - 1) {
      showStep(currentStep + 1);
      return;
    }

    for (let i = 0; i < fieldsets.length; i += 1) {
      if (!validateStep(i, false)) {
        showStep(i, false);
        validateStep(i);
        return;
      }
    }

    busy = true;
    next.disabled = true;
    previous.disabled = true;
    form.setAttribute('aria-busy', 'true');
    renderNextButton();

    try {
      const receipt = await submitTrackedRequest(collectRequest());
      history.replaceState(null, '', `${location.pathname}?token=${encodeURIComponent(receipt.token)}`);
      form.reset();
      renderTracking(receipt.stages);
      tracking.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Consultation request failed:', err.code || err.message);
      textError(
        err.code === 'consultation/offline'
          ? 'أنت غير متصل بالإنترنت. إجاباتك ما زالت هنا؛ اتصل ثم حاول مجددًا.'
          : 'تعذّر إرسال الطلب الآن. لم يتم تأكيد استلامه، وإجاباتك ما زالت هنا. حاول مجددًا بعد قليل.'
      );
    } finally {
      busy = false;
      next.disabled = false;
      previous.disabled = false;
      form.removeAttribute('aria-busy');
      renderNextButton();
    }
  });

  showStep(0, false);
}

async function mountCurrentForm() {
  const response = await fetch('../index.html', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load current form: ${response.status}`);
  const source = await response.text();
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const apply = parsed.querySelector('#apply');
  if (!apply) throw new Error('Current consultation form was not found.');
  formView.replaceChildren(apply.cloneNode(true));
  setupForm();
}

const token = new URLSearchParams(location.search).get('token');
if (token) {
  showExistingProgress(token);
} else {
  mountCurrentForm().catch((error) => {
    console.error(error);
    formView.innerHTML = '<p class="form-error" role="alert">تعذّر تحميل الفورم الآن. حدّث الصفحة وحاول مرة أخرى.</p>';
  });
}
