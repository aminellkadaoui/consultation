// One public content model shared by the landing page and its admin editor.
export const DEFAULT_HEADLINE = 'تريد تطوير عملك كممنتج، لكنك لا تعرف ما الخطوة التالية؟';
export const DEFAULT_SUBHEADLINE = 'في 60 دقيقة نحدد فيها أولويتك وخطوتك التالية، مع خطة عمل واضحة بعد الجلسة.';
export const SECTION_LABELS = {
  navigation: 'الشريط العلوي', hero: 'العنوان الرئيسي', video: 'الفيديو', cta: 'زر البدء',
  testimonials: 'الآراء', process: 'المراحل', scope: 'ما تشمل عليه الاستشارة', apply: 'الفورم', faq: 'الأسئلة الشائعة', footer: 'أسفل الصفحة'
};
export const PAGE_DEFAULTS = {
  visibility: Object.fromEntries(Object.keys(SECTION_LABELS).map(key => [key, true])),
  ctaLabel: 'ابدأ الان', headlineAccent: 'ما الخطوة التالية؟',
  navProcess: 'المراحل', navScope: 'ماتشمله', navFaq: 'الاسئلة',
  processTitle: 'كيف تعمل الاستشارة؟', reviewsTitle: 'الآراء', faqTitle: 'الأسئلة الشائعة',
  applyTitle: '', footerLabel: 'aminellkadaoui',
  processSteps: [
    {title:'أرسل الفورم', body:'اشرح حالتك والمشكلة التي تريد التركيز عليها حتى أراجعها قبل الجلسة.'},
    {title:'الحجز والدفع', body:'بعد التأكد أن الاستشارة مناسبة لحالتك، تختار الموعد وتكمل الدفع.'},
    {title:'الاجتماع', body:'جلسة فردية لمدة 60 دقيقة نفهم فيها المشكلة، ونحدد الأولوية والخطوات المناسبة.'},
    {title:'خطة العمل', body:'خلال 24 ساعة من الاجتماع، تصلك خطة عمل مكتوبة توضح ما الذي تبدأ به وما الخطوات التالية.'}
  ],
  includedTitle:'ما الذي تشمله الاستشارة؟', excludedTitle:'ما الذي لا تشمله الاستشارة؟',
  includedItems:['جلسة فردية لمدة 60 دقيقة.', 'التركيز على مشكلة أو قرار واحد أساسي.', 'تحديد الأولوية والخطوة التالية.', 'توصيات تناسب وضعك وظروفك.', 'خطة عمل مكتوبة خلال 24 ساعة.'],
  excludedItems:['بناء نظام كامل لك من الصفر.', 'معالجة عدة مواضيع غير مرتبطة في جلسة واحدة.', 'تنفيذ العمل بدلًا عنك.', 'إدارة مشاريعك أو عملائك نيابةً عنك.', 'ضمان دخل أو عملاء أو نتائج محددة.'],
  faqs:[
    {question:'هل الاستشارة مناسبة للمبتدئين؟', answer:'الاستشارة موجهة للإديتورز الذين لديهم أساس في المونتاج وسبق لهم العمل مع عملاء أو بدأوا يأخذون المونتاج كعمل فعلي.'},
    {question:'ماذا أحصل عليه بعد الجلسة؟', answer:'خلال 24 ساعة تصلك خطة عمل مكتوبة توضح ما الذي تبدأ به، وما الخطوات التالية، وترتيب تنفيذها.'},
    {question:'هل تضمن لي الحصول على عملاء أو زيادة دخلي؟', answer:'لا. الاستشارة تساعدك على فهم وضعك واتخاذ القرار وتحديد الخطوات المناسبة، لكن النتيجة تعتمد على التنفيذ وظروف عملك والسوق.'},
    {question:'كيف أحجز؟', answer:'ترسل الفورم أولًا، أراجع حالتك، وإذا كانت مناسبة ننتقل إلى الدفع واختيار الموعد.'},
    {question:'هل لازم أعرف المشكلة قبل ما أحجز؟', answer:'لا. اشرح لي وضعك ونحدد المشكلة، ونعمل على الحل معًا.'},
    {question:'هل نقدر نعمل على أكثر من موضوع؟', answer:'نعم. لكن من الافضل نختار أولوية رئيسية حتى تكون الخطوات واضحة، ونراجع ما يرتبط بها عند الحاجة.'}
  ]
};
export function normalizePageContent(value = {}) {
  const p = structuredClone(PAGE_DEFAULTS);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return p;
  for (const key of Object.keys(p)) if (Object.hasOwn(value, key)) p[key] = value[key];
  p.visibility = {...PAGE_DEFAULTS.visibility, ...value.visibility};
  return p;
}
export function validatePageContent(value) {
  const p = normalizePageContent(value);
  const fail = () => { throw new Error('راجع محتوى الأقسام: النصوص والقوائم تتجاوز الحد المسموح أو غير مكتملة.'); };
  const text = (s, max, min=0) => typeof s === 'string' && s.length >= min && s.length <= max;
  if (Object.keys(p.visibility).some(k => !Object.hasOwn(SECTION_LABELS,k) || typeof p.visibility[k] !== 'boolean')) fail();
  for (const [key, defaultValue] of Object.entries(PAGE_DEFAULTS)) if (typeof defaultValue === 'string' && !text(p[key],240)) fail();
  if (!text(p.ctaLabel,80,1)) fail();
  for (const key of ['includedItems','excludedItems']) if (!Array.isArray(p[key]) || p[key].length>20 || p[key].some(s=>!text(s,1000,1))) fail();
  for (const [key, fields, max] of [['processSteps',['title','body'],8],['faqs',['question','answer'],20]]) {
    if (!Array.isArray(p[key]) || p[key].length>max || p[key].some(row=>!row || fields.some(f=>!text(row[f],f==='body'||f==='answer'?3000:240,1)))) fail();
    p[key] = p[key].map(row=>Object.fromEntries(fields.map(f=>[f,row[f].trim()])));
  }
  return p;
}
// Migrate only the old shipped copy, once. Custom admin copy remains authoritative.
export function resolvePageSettings(settings) {
  const result = {...settings};
  if (!settings.pageContent) {
    if (!settings.headline || settings.headline === 'تعمل كإديتور، لكنك محتار على ماذا تركز الآن؟') result.headline = DEFAULT_HEADLINE;
    if (!settings.subheadline || settings.subheadline === 'نراجع المشكلة التي تواجهك، ونحدد ما يحتاج تركيزك الآن، وما تفعله أولًا.') result.subheadline = DEFAULT_SUBHEADLINE;
  }
  result.pageContent = normalizePageContent(settings.pageContent);
  return result;
}
