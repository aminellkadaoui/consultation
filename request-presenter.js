// All returned content is plain text. The admin renders it with textContent.
export const statusLabels = Object.freeze({new:'جديد',reviewing:'قيد المراجعة',accepted:'مقبول',scheduled:'موعد محدد',completed:'مكتمل',archived:'مؤرشف'});
export const requestFieldList = Object.freeze([
  ['fullName','الاسم الكامل'],['whatsapp','رقم الواتساب'],['instagram','حساب Instagram'],
  ['experience','المدة في المونتاج'],['clientCount','عدد العملاء'],['editingType','نوع المونتاج'],
  ['problem','المشكلة الأساسية'],['lastSituation','آخر موقف ذكره'],['impact','أثر المشكلة — إجابة سابقة'],
  ['goal','الهدف الحالي'],['approach','كيف يفكر في الوصول إلى هدفه'],['obstacle','العائق أمامه'],['sessionOutcome','ما الذي يريد حسمه في الجلسة']
]);
const valueText = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
export function plainValue(value) {return Array.isArray(value) ? value.map(valueText).filter(Boolean).join('، ') : valueText(value);}
export function normalizeRequest(item = {}) {
  const answers = item.answers && typeof item.answers === 'object' && !Array.isArray(item.answers) ? item.answers : {};
  const normalized = {...item};
  for(const [key] of requestFieldList) {
    const value = item[key] ?? answers[key];
    normalized[key] = key === 'editingType' && Array.isArray(value) ? value.map(valueText).filter(Boolean) : valueText(value);
  }
  normalized.id = valueText(item.id);
  normalized.status = Object.hasOwn(statusLabels,item.status) ? item.status : 'new';
  normalized.privateNotes = valueText(item.privateNotes);
  normalized.submittedAt = item.submittedAt || item.createdAt || null;
  return normalized;
}
const quoted = value => `«${plainValue(value)}»`;
const experiencePhrases = {
  'أقل من 6 أشهر':'يعمل كإديتور منذ أقل من 6 أشهر.',
  '6 أشهر إلى سنة':'تتراوح خبرته في المونتاج بين 6 أشهر وسنة.',
  'سنة إلى سنتين':'تتراوح خبرته في المونتاج بين سنة وسنتين.',
  'سنتين إلى 4 سنوات':'تتراوح خبرته في المونتاج بين سنتين و4 سنوات.',
  'أكثر من 4 سنوات':'يعمل كإديتور منذ أكثر من 4 سنوات.'
};
const clientPhrases = {
  '1 إلى 3':'تعامل مع عميل واحد إلى 3 عملاء.', '4 إلى 10':'تعامل مع 4 إلى 10 عملاء.',
  '11 إلى 20':'تعامل مع 11 إلى 20 عميلًا.', 'أكثر من 20':'تعامل مع أكثر من 20 عميلًا.'
};
const problemPhrases = {
  'لا أعرف على ماذا أركز':'لا يعرف على ماذا يركز الآن.', 'التعديلات الكثيرة':'يواجه تعديلات كثيرة في مشاريعه.',
  'أفقد العملاء':'يفقد العملاء.', 'أسعاري منخفضة':'يرى أن أسعاره منخفضة.',
  'صعوبة الحصول على عملاء':'يواجه صعوبة في الحصول على عملاء.', 'المشاريع تأخذ وقتًا طويلًا':'تأخذ مشاريعه وقتًا طويلًا.',
  'التعامل مع العملاء':'يواجه مشكلة في التعامل مع العملاء.', 'تنظيم عملي':'يواجه مشكلة في تنظيم عمله.'
};
const goalPhrases = {
  'رفع أسعاري':'يريد رفع أسعاره.', 'الحصول على عملاء أفضل':'يريد الحصول على عملاء أفضل.',
  'دخل أكثر استقرارًا':'يريد دخلًا أكثر استقرارًا.', 'تنظيم عملي وتقليل الضغط':'يريد تنظيم عمله وتقليل الضغط.',
  'الحفاظ على العملاء':'يريد الحفاظ على عملائه.', 'تقديم خدمة أقوى':'يريد تقديم خدمة أقوى.',
  'تطوير نفسي كإديتور':'يريد تطوير نفسه كإديتور.', 'بناء فريق':'يريد بناء فريق.'
};
const obstaclePhrases = {
  'لا أعرف من أين أبدأ':'العائق الذي ذكره أنه لا يعرف من أين يبدأ.', 'نقص العملاء':'العائق الذي ذكره هو نقص العملاء.',
  'المهارة':'يرى أن المهارة هي العائق أمامه.', 'التسعير':'يرى أن التسعير هو العائق أمامه.',
  'إدارة الوقت':'يرى أن إدارة الوقت هي العائق أمامه.', 'التعامل مع العملاء':'يرى أن التعامل مع العملاء هو العائق أمامه.',
  'لا يوجد عندي نظام واضح':'يرى أن غياب نظام واضح لعمله هو العائق أمامه.',
  'لا أعرف ما العائق بالضبط':'لم يحدد بعد ما العائق بالضبط.'
};
function lookup(map,key,fallback) {return key ? Object.hasOwn(map,key) ? map[key] : fallback(key) : '';}
function clientSentence(value) {
  if(Object.hasOwn(clientPhrases,value)) return clientPhrases[value];
  if(/^\d+$/.test(value)) {
    const count=Number(value);
    if(count===0)return 'لم يتعامل مع عملاء بعد.';
    if(count===1)return 'تعامل مع عميل واحد.';
    if(count===2)return 'تعامل مع عميلين.';
    return `تعامل مع ${value} ${count<=10?'عملاء':'عميلًا'}.`;
  }
  return value ? `ذكر عن عدد عملائه: ${quoted(value)}.` : '';
}
export function presentRequest(source) {
  const item=normalizeRequest(source);
  const types=Array.isArray(item.editingType)?item.editingType:[item.editingType].filter(Boolean);
  const typesText=types.join(' و');
  const current=[
    lookup(experiencePhrases,item.experience,v=>`وصف مدة عمله في المونتاج بقوله: ${quoted(v)}.`),
    clientSentence(item.clientCount),
    typesText ? `أغلب عمله في ${quoted(typesText)}.` : ''
  ].filter(Boolean).join(' ');
  const problem=lookup(problemPhrases,item.problem,v=>`وصف مشكلته بقوله: ${quoted(v)}.`);
  const goal=[
    lookup(goalPhrases,item.goal,v=>`ذكر أن هدفه هو: ${quoted(v)}.`),
    item.approach?`وعن طريقة الوصول إليه، قال: ${quoted(item.approach)}.`:'',
    lookup(obstaclePhrases,item.obstacle,v=>`وصف العائق أمامه بقوله: ${quoted(v)}.`)
  ].filter(Boolean).join(' ');
  const outcome=item.sessionOutcome?`سيعتبر الجلسة مفيدة إذا حسم ما ذكره هنا: ${quoted(item.sessionOutcome)}.`:'';
  return {item, sections:[
    {title:'01 / وضعه الحالي', text:current||'لم يذكر معلومات عن وضعه الحالي.', details:[]},
    {title:'02 / مشكلته الأساسية', text:problem||'لم يحدد المشكلة.', details:[
      ...(item.lastSituation?[{label:'آخر موقف ذكره',text:item.lastSituation}]:[]),
      ...(item.impact?[{label:'أثر المشكلة',text:item.impact}]:[])
    ]},
    {title:'03 / هدفه والعائق', text:goal||'لم يذكر هدفه أو العائق أمامه.', details:[]},
    {title:'04 / ماذا يريد من الجلسة؟', text:outcome||'لم يذكر ما يريد حسمه من الجلسة.', details:[]}
  ], raw:requestFieldList.filter(([key])=>plainValue(item[key])).map(([key,label])=>({key,label,value:plainValue(item[key])}))};
}
export function csvCell(value) {
  let text=plainValue(value);
  if(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text=`'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
export function briefFor(source) {
  const result=presentRequest(source);
  return ['طلب استشارة',`الاسم: ${result.item.fullName}`,`واتساب: ${result.item.whatsapp}`,`Instagram: ${result.item.instagram}`, ...result.sections.map(section=>[section.title,section.text,...section.details.map(detail=>`${detail.label}: ${detail.text}`)].join('\n'))].join('\n\n');
}
