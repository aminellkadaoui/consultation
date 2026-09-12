import { normalizeDigits, normalizeWhatsapp } from '../public-utils.js';

const COUNTRIES = Object.freeze([
  { code: '+212', flag: '🇲🇦', name: 'المغرب', placeholder: '6XX XXX XXX' },
  { code: '+966', flag: '🇸🇦', name: 'السعودية', placeholder: '5X XXX XXXX' },
  { code: '+971', flag: '🇦🇪', name: 'الإمارات', placeholder: '5X XXX XXXX' },
  { code: '+20', flag: '🇪🇬', name: 'مصر', placeholder: '1X XXXX XXXX' },
  { code: '+965', flag: '🇰🇼', name: 'الكويت', placeholder: 'XXXX XXXX' },
  { code: '+974', flag: '🇶🇦', name: 'قطر', placeholder: 'XXXX XXXX' },
  { code: '+213', flag: '🇩🇿', name: 'الجزائر', placeholder: '5XX XX XX XX' },
  { code: '+216', flag: '🇹🇳', name: 'تونس', placeholder: 'XX XXX XXX' },
  { code: '+973', flag: '🇧🇭', name: 'البحرين', placeholder: 'XXXX XXXX' },
  { code: '+968', flag: '🇴🇲', name: 'عُمان', placeholder: 'XXXX XXXX' },
  { code: '+962', flag: '🇯🇴', name: 'الأردن', placeholder: '7X XXX XXXX' }
]);

function localDigits(value) {
  return normalizeDigits(value).replace(/\D/g, '');
}

function fullNumber(code, value) {
  const text = String(value || '').trim();
  if (text.startsWith('+')) return normalizeWhatsapp(text);
  const codeDigits = code.replace('+', '');
  let digits = localDigits(text);
  if (digits.startsWith(codeDigits)) digits = digits.slice(codeDigits.length);
  digits = digits.replace(/^0+/, '');
  return normalizeWhatsapp(code + digits);
}

function setupPhoneCountryPicker() {
  const original = document.getElementById('whatsapp');
  if (!original || original.dataset.countryPickerReady === 'true') return false;
  original.dataset.countryPickerReady = 'true';

  const label = document.querySelector('label[for="whatsapp"]');
  if (label) label.htmlFor = 'whatsappLocal';
  const hint = original.parentElement?.querySelector('.field-hint');
  if (hint) hint.textContent = 'اختر رمز الدولة ثم اكتب رقم الواتساب.';

  const initial = COUNTRIES[0];
  original.type = 'hidden';
  original.dataset.countryCode = initial.code;
  original.value = '';

  const wrap = document.createElement('div');
  wrap.className = 'phone-combo';
  wrap.dir = 'ltr';

  const picker = document.createElement('div');
  picker.className = 'phone-country-picker';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'phone-country-toggle';
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'اختر رمز الدولة');

  const selected = document.createElement('span');
  selected.className = 'phone-country-selected';
  const arrow = document.createElement('span');
  arrow.className = 'phone-country-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '⌄';
  toggle.append(selected, arrow);

  const menu = document.createElement('div');
  menu.className = 'phone-country-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  const local = document.createElement('input');
  local.id = 'whatsappLocal';
  local.name = 'whatsappLocal';
  local.type = 'tel';
  local.inputMode = 'tel';
  local.autocomplete = 'tel-national';
  local.required = true;
  local.maxLength = 24;
  local.dir = 'ltr';
  local.className = 'phone-local-input';

  function renderSelected(country) {
    selected.replaceChildren();
    const flag = document.createElement('span');
    flag.className = 'phone-country-flag';
    flag.textContent = country.flag;
    const code = document.createElement('span');
    code.className = 'phone-country-code';
    code.textContent = country.code;
    selected.append(flag, code);
    local.placeholder = country.placeholder;
  }

  function syncHidden() {
    original.value = fullNumber(original.dataset.countryCode || initial.code, local.value);
    original.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  for (const country of COUNTRIES) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'phone-country-option';
    option.setAttribute('role', 'option');
    option.dataset.code = country.code;

    const left = document.createElement('span');
    left.className = 'phone-country-option-left';
    const flag = document.createElement('span');
    flag.textContent = country.flag;
    const code = document.createElement('span');
    code.textContent = country.code;
    left.append(flag, code);

    const name = document.createElement('span');
    name.className = 'phone-country-name';
    name.textContent = country.name;
    option.append(left, name);

    option.addEventListener('click', () => {
      original.dataset.countryCode = country.code;
      renderSelected(country);
      syncHidden();
      closeMenu();
      local.focus();
    });
    menu.append(option);
  }

  toggle.addEventListener('click', () => {
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });

  local.addEventListener('input', syncHidden);
  local.addEventListener('blur', syncHidden);

  document.addEventListener('click', (event) => {
    if (!picker.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  picker.append(toggle, menu);
  wrap.append(picker, local);
  original.insertAdjacentElement('afterend', wrap);
  renderSelected(initial);
  syncHidden();
  return true;
}

const observer = new MutationObserver(() => {
  if (setupPhoneCountryPicker()) observer.disconnect();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setupPhoneCountryPicker();
