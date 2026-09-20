import {
  loadProgress,
  normalizeProgressStages
} from '../progress-data.js?v=progress-3';
import {
  normalizeWhatsapp,
  validWhatsapp,
  normalizeInstagram,
  validInstagram
} from '../public-utils.js';

import { submitRequest, REQUEST_LIMITS } from '../data.js?v=content-2';
import { translate } from '../translations.js?v=sentence-2';
import { setupPhoneCountryPicker } from './phone-country.js?v=shared-form-1';

export async function mountConsultationForm(host, { language = 'ar', token = null, onSubmitted = () => {} } = {}) {
  if (!host) throw new Error('Consultation form host was not found.');
  host.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(new URL('./component.html?v=shared-form-1', import.meta.url));
    if (!response.ok) throw new Error('Unable to load consultation form: ' + response.status);
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    host.replaceChildren(template.content.cloneNode(true));
  } catch (error) {
    host.innerHTML = '<p class="form-error" role="alert">تعذّر تحميل الفورم الآن. حدّث الصفحة وحاول مرة أخرى.</p>';
    throw error;
  } finally {
    host.removeAttribute('aria-busy');
  }
  setupPhoneCountryPicker(host);
  const $ = id => host.querySelector('#' + id);
  const t = text => translate(text, language);
  const staticText = [];
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (!text.parentElement.closest('#stepLabel,#nextStep,#formError,.sentence-value') && /[\u0600-\u06ff]/.test(text.textContent)) staticText.push([text, text.textContent]);
  }
  const attributes = [...host.querySelectorAll('[placeholder],[aria-label]')].flatMap(el => ['placeholder','aria-label'].filter(attr => el.hasAttribute(attr)).map(attr => [el, attr, el.getAttribute(attr)]));
  let activeError = '';
  const stepNames = ['معلوماتك', 'وضعك الحالي', 'مشكلتك الأساسية', 'هدفك والعائق', 'ماذا تريد من الجلسة؟'];
  const requestLimits = REQUEST_LIMITS;
  const tracking = $('trackingView');
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
      if (dot) dot.textContent = status === 'completed' ? '✓' : status === 'current' ? '●' : '○';
    });
    host.classList.add('is-submitted');
    onSubmitted();
    document.documentElement.classList.remove('has-tracking-token');
    tracking.hidden = false;
    tracking.focus({ preventScroll: true });
  }

  function renderTrackingError(message) {
    host.classList.add('is-submitted');
    onSubmitted();
    document.documentElement.classList.remove('has-tracking-token');
    tracking.hidden = false;
    tracking.focus({ preventScroll: true });
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
    activeError = message;
    error.textContent = t(message);
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
    const bars = [...host.querySelectorAll('.progress-bars i')];

    for (const [key, max] of Object.entries(requestLimits)) {
      const input = $(key);
      if (input) input.maxLength = max;
    }

    function selectedValue(key) {
      const group = form.querySelector(`[data-field="${key}"]`);
      if (!group) return $(key)?.value.trim() || '';
      const values = [...group.querySelectorAll('.choice-input:checked')]
        .map((input) => input.value === '__other__' ? $(key + 'Other').value.trim() : input.value)
        .filter(Boolean);
      return group.dataset.multiple === 'true' ? values : (values[0] || '');
    }

    function updateSentencePreviews() {
      host.querySelectorAll('[data-answer-preview]').forEach((preview) => {
        const key = preview.dataset.answerPreview;
        const group = form.querySelector(`[data-field="${key}"]`);
        const display = group
          ? [...group.querySelectorAll('.choice-input:checked')]
              .map((input) => input.value === '__other__' ? $(key + 'Other').value.trim() : t(input.value))
              .filter(Boolean)
              .join(' و')
          : ($(key)?.value.trim() || '');
        const answer = key === 'sessionOutcome'
          ? display.replace(/^(?:أعرف|اعرف|نعرف)\s+/, '')
          : display;
        preview.textContent = answer || '[' + t(preview.dataset.empty || '') + ']';
      });
    }

    function renderNextButton() {
      if (busy) {
        next.textContent = t('جارٍ إرسال طلبك…');
        return;
      }
      next.replaceChildren(document.createTextNode(t(currentStep === fieldsets.length - 1 ? 'أرسل الفورم' : 'التالي') + ' '));
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '←';
      next.append(arrow);
    }

    function showStep(index, focus = true) {
      currentStep = index;
      fieldsets.forEach((field, i) => { field.hidden = i !== index; });
      if (stepLabel) stepLabel.textContent = t(stepNames[index] || '');
      if (stepCounter) {
        stepCounter.innerHTML = String(index + 1).padStart(2, '0')
          + ' <span>/ ' + String(fieldsets.length).padStart(2, '0') + '</span>';
      }
      bars.forEach((bar, i) => bar.classList.toggle('active', i <= index));
      previous.hidden = index === 0;
      renderNextButton();
      error.hidden = true;
      error.textContent = '';
      activeError = '';
      if (focus) {
        const first = fieldsets[index].querySelector('input:not(:disabled):not([type=hidden]),textarea:not(:disabled)');
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
        if (input.id === 'whatsappLocal' && !validWhatsapp($('whatsapp').value)) {
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
      activeError = '';
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
        activeError = '';
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
        await submitRequest(collectRequest());
        form.reset();
        renderTracking();
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
    return function setLanguage(nextLanguage) {
      language = nextLanguage === 'darija' ? 'darija' : 'ar';
      for (const [text, source] of staticText) if (text.isConnected) text.textContent = t(source);
      for (const [el, attr, source] of attributes) el.setAttribute(attr, t(source));
      stepLabel.textContent = t(stepNames[currentStep]);
      renderNextButton();
      if (activeError) error.textContent = t(activeError);
      updateSentencePreviews();
    };
  }

  const setLanguage = setupForm();
  setLanguage(language);
  if (token) await showExistingProgress(token);
  else if (location.hash === '#' + host.id) {
    requestAnimationFrame(() => host.scrollIntoView({ block: 'start' }));
  }
  return { setLanguage };
}
