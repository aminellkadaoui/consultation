import { makeHeroMedia } from './video-preview.js?v=flow-1';
import { translate } from './translations.js?v=sentence-2';
import { loadSettings, submitRequest, REQUEST_LIMITS } from './data.js?v=sentence-2';
import { normalizeWhatsapp, validWhatsapp, normalizeInstagram, validInstagram, safeUrl, mediaSource } from './public-utils.js';
const $=id=>document.getElementById(id);
const base=window.CONSULTATION_CONFIG||{};
let settings={...base};
let currentStep=0,busy=false;
let language='ar',activeError='';
try {const stored=localStorage.getItem('consultationLanguage');if(stored==='darija')language=stored;}catch{}
const t=text=>translate(text,language);
const staticText=[];
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(walker.nextNode()) {
  const item=walker.currentNode;
  if(!item.parentElement.closest('script,style,#headline,#subheadline,#stepLabel,#nextStep,#formError,#waRow,.sentence-value')&&/[\u0600-\u06ff]/.test(item.textContent))staticText.push([item,item.textContent]);
}
const staticAttributes=[];
for(const el of document.querySelectorAll('[placeholder],[aria-label]')) {
  if(el.closest('#langSeg,#waRow'))continue;
  for(const attr of ['placeholder','aria-label'])if(el.hasAttribute(attr))staticAttributes.push([el,attr,el.getAttribute(attr)]);
}
function renderHeading(config) {
  const headline=t(config.headline||base.headline),emphasis=t('على ماذا تركز الآن؟');
  const parts=headline.split(emphasis);
  $('headline').replaceChildren();
  if(parts.length===2)$('headline').append(document.createTextNode(parts[0]),node('span','s',emphasis),document.createTextNode(parts[1]));
  else $('headline').textContent=headline;
  $('subheadline').textContent=t(config.subheadline||base.subheadline);
  document.title=t('استشارة للإديتورز')+' | '+(config.brand||base.brand);
  document.querySelector('meta[name="description"]').content=t(config.subheadline||base.subheadline);
}
function renderNextButton(){
  if(busy){$('nextStep').textContent=t('جارٍ إرسال طلبك…');return;}
  $('nextStep').replaceChildren(document.createTextNode(t(currentStep===4?'أرسل طلب الاستشارة':'التالي')+' '));
  const arrow=node('span','','←');arrow.setAttribute('aria-hidden','true');$('nextStep').append(arrow);
}
function applyLanguage(nextLanguage,persist=false) {
  language=nextLanguage==='darija'?'darija':'ar';
  document.documentElement.lang=language==='darija'?'ar-MA':'ar';
  document.documentElement.dir='rtl';
  document.querySelectorAll('#langSeg button').forEach(button=>{const selected=button.dataset.lang===language;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  for(const [textNode,source] of staticText)if(textNode.isConnected)textNode.textContent=t(source);
  for(const [el,attr,source] of staticAttributes)if(el.isConnected)el.setAttribute(attr,t(source));
  renderHeading(settings);
  $('stepLabel').textContent=t(stepNames[currentStep]);renderNextButton();
  if(activeError)$('formError').textContent=t(activeError);
  document.querySelectorAll('#videoContent>a,.wa>a').forEach(el=>el.textContent=t('شاهد الفيديو ↗'));
  updateSentencePreviews();
  if(persist)try{localStorage.setItem('consultationLanguage',language);}catch{}
}
const stepNames=['معلوماتك','وضعك الحالي','مشكلتك الأساسية','هدفك والعائق','ماذا تريد من الجلسة؟'];
const form=$('intakeForm');
const fieldsets=[...form.querySelectorAll('fieldset')];
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function makeMedia(url,title,poster='') {
  const source=mediaSource(url);if(!source)return null;
  if(source.type==='link') {const a=node('a','button primary',t('شاهد الفيديو ↗'));a.href=source.src;a.target='_blank';a.rel='noopener noreferrer';return a;}
  const el=document.createElement(source.type);
  el.src=source.src;
  if(source.type==='iframe'){el.title=title;el.loading='lazy';el.allow='fullscreen; picture-in-picture; encrypted-media';el.allowFullscreen=true;el.referrerPolicy='strict-origin-when-cross-origin';}
  else {el.controls=true;el.playsInline=true;el.preload='metadata';if(safeUrl(poster,true))el.poster=safeUrl(poster,true);}
  return el;
}
function renderSettings(config){
  renderHeading(config);
  const values={'[data-duration]':config.durationMinutes,'[data-price]':config.price,'[data-currency]':config.currency,'[data-hours]':config.actionDocHours};
  for(const [selector,value] of Object.entries(values)){if(value!==undefined)document.querySelectorAll(selector).forEach(el=>el.textContent=value);}
  if(config.videoUrl){const media=makeHeroMedia(config.videoUrl,'التعريف باستشارة الإديتورز',config.videoPoster,makeMedia);if(media){$('videoContent').replaceChildren(media);$('videoContent').classList.add('has-media');}}
  renderReviews(Array.isArray(config.testimonials)?config.testimonials:[]);
}
let cleanupCarousel=()=>{};
function renderReviews(reviews){
  cleanupCarousel();const valid=reviews.filter(r=>r&&r.name&&(r.quote||safeUrl(r.videoUrl)||safeUrl(r.imageUrl)));
  $('testimonials').hidden=!valid.length;
  const row=$('waRow'),dots=$('waDots');row.replaceChildren();dots.replaceChildren();
  valid.forEach((review,i)=>{
    const card=node('article','wa'+(i===0?' active':''));card.setAttribute('aria-label','رأي '+review.name);
    let media=makeMedia(review.videoUrl,'رأي '+review.name);
    if(!media&&safeUrl(review.imageUrl)){media=node('img');media.src=safeUrl(review.imageUrl);media.alt=review.quote||'رأي '+review.name;media.loading='lazy';}
    if(media){card.append(media);if(media.tagName==='IMG')card.append(node('div','media-caption',review.name+(review.role?' · '+review.role:'')));}
    else {const quote=node('blockquote');quote.tabIndex=0;quote.setAttribute('aria-label','نص الرأي، قابل للتمرير');quote.append(node('p','',review.quote));const footer=node('footer');footer.append(node('strong','',review.name),document.createTextNode(review.role||''));quote.append(footer);card.append(quote);}
    row.append(card);const dot=node('button');dot.type='button';dot.setAttribute('aria-label','عرض الرأي '+(i+1));dot.append(node('i'));dot.addEventListener('click',()=>moveTo(i));dots.append(dot);
  });
  const cards=[...row.children],dotEls=[...dots.children];let active=0,raf=0;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
  function moveTo(index){const card=cards[Math.max(0,Math.min(cards.length-1,index))];if(!card)return;const r=row.getBoundingClientRect(),c=card.getBoundingClientRect();row.scrollBy({left:(c.left+c.width/2)-(r.left+r.width/2),behavior:motion});}
  function updateActive(){const rc=row.getBoundingClientRect(),center=rc.left+rc.width/2;let best=0,dist=Infinity;cards.forEach((c,i)=>{const r=c.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-center);if(d<dist){dist=d;best=i;}});active=best;cards.forEach((c,i)=>{c.classList.toggle('active',i===active);if(i!==active)c.querySelector('video')?.pause();});dotEls.forEach((d,i)=>{d.classList.toggle('on',i===active);d.setAttribute('aria-current',i===active?'true':'false');});const prev=document.querySelector('.wa-arrow.prev'),next=document.querySelector('.wa-arrow.next');prev.disabled=active===0;next.disabled=active>=cards.length-1;prev.hidden=next.hidden=cards.length<2;dots.hidden=cards.length<2;}
  function onScroll(){cancelAnimationFrame(raf);raf=requestAnimationFrame(updateActive);}
  function onKey(e){if(e.target!==row)return;if(e.key==='ArrowLeft'){e.preventDefault();moveTo(active+1);}if(e.key==='ArrowRight'){e.preventDefault();moveTo(active-1);}}
  document.querySelector('.wa-arrow.prev').onclick=()=>moveTo(active-1);document.querySelector('.wa-arrow.next').onclick=()=>moveTo(active+1);
  row.addEventListener('scroll',onScroll);row.addEventListener('keydown',onKey);window.addEventListener('resize',updateActive);
  cleanupCarousel=()=>{row.removeEventListener('scroll',onScroll);row.removeEventListener('keydown',onKey);window.removeEventListener('resize',updateActive);cancelAnimationFrame(raf);};
  if(cards.length)requestAnimationFrame(()=>{moveTo(0);updateActive();});
}
// Original reference accordion behavior, with keyboard/assistive-technology state.
document.querySelectorAll('.faq-q').forEach(q=>q.addEventListener('click',()=>{const open=q.parentElement.classList.toggle('open');q.setAttribute('aria-expanded',String(open));document.getElementById(q.getAttribute('aria-controls')).inert=!open;}));
function error(message,field){activeError=message;$('formError').textContent=t(message);$('formError').hidden=false;if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','formError');field.focus();}}
function showStep(index,focus=true){currentStep=index;fieldsets.forEach((f,i)=>f.hidden=i!==index);$('stepLabel').textContent=t(stepNames[index]);$('stepCounter').innerHTML=String(index+1).padStart(2,'0')+' <span>/ 05</span>';$('previousStep').hidden=index===0;renderNextButton();document.querySelectorAll('.progress-bars i').forEach((el,i)=>el.classList.toggle('active',i<=index));$('formError').hidden=true;activeError='';if(focus){const first=fieldsets[index].querySelector('input:not(:disabled),textarea');first.focus({preventScroll:true});$('formArea').scrollIntoView({block:'start',behavior:'auto'});}}
const choiceKeys=['experience','clientCount','editingType','problem','goal','obstacle'];
function selectedValue(key){
  const group=form.querySelector(`[data-field="${key}"]`);
  if(!group)return $(key)?.value.trim()||'';
  const values=[...group.querySelectorAll('.choice-input:checked')].map(input=>input.value==='__other__'?$(key+'Other').value.trim():input.value).filter(Boolean);
  return group.dataset.multiple==='true'?values:(values[0]||'');
}
function updateSentencePreviews(){
  document.querySelectorAll('[data-answer-preview]').forEach(preview=>{
    const key=preview.dataset.answerPreview,group=form.querySelector(`[data-field="${key}"]`);
    const display=group?[...group.querySelectorAll('.choice-input:checked')].map(input=>input.value==='__other__'?$(key+'Other').value.trim():t(input.value)).filter(Boolean).join(' و'):($(key)?.value.trim()||'');
    const answer=key==='sessionOutcome'?display.replace(/^(?:أعرف|اعرف|نعرف)\s+/,''):display;
    preview.textContent=answer||'['+t(preview.dataset.empty)+']';
  });
}
function validateStep(index,report=true){
  const step=fieldsets[index];
  function reject(message,field){if(report)error(message,field);return false;}
  for(const group of step.querySelectorAll('.choice-field')){
    const checked=[...group.querySelectorAll('.choice-input:checked')];
    if(!checked.length){if(report)group.setAttribute('aria-invalid','true');return reject('اختر إجابة للمتابعة.',group.querySelector('input'));}
    if(checked.some(input=>input.value==='__other__')&&!$(group.dataset.field+'Other').value.trim())return reject('اكتب إجابتك في «أخرى».',$(group.dataset.field+'Other'));
  }
  for(const input of step.querySelectorAll('input:not(.choice-input):enabled,textarea:enabled')){
    const value=input.value.trim();
    if(input.required&&!value)return reject('أكمل هذا الحقل حتى أفهم حالتك.',input);
    if(input.id==='whatsapp'&&!validWhatsapp(value))return reject('اكتب رقم واتساب صحيحًا مع رمز الدولة، مثل +212612345678.',input);
    if(input.id==='instagram'&&!validInstagram(value))return reject('اكتب اسم مستخدم Instagram صحيحًا أو رابط حسابك.',input);
    if(!input.checkValidity())return reject('راجع الإجابة في هذا الحقل وطولها.',input);
  }
  return true;
}
function collectRequest(){
  const result={};
  for(const key of ['fullName','whatsapp','instagram','lastSituation','approach','sessionOutcome'])result[key]=$(key).value.trim();
  for(const key of choiceKeys)result[key]=selectedValue(key);
  result.whatsapp=normalizeWhatsapp(result.whatsapp);result.instagram='@'+normalizeInstagram(result.instagram);
  return result;
}
form.addEventListener('change',event=>{
  if(!event.target.matches('.choice-input'))return;
  const group=event.target.closest('.choice-field');
  const otherSelected=[...group.querySelectorAll('.choice-input:checked')].some(input=>input.value==='__other__');
  group.querySelector('.other-answer').hidden=!otherSelected;
  $(group.dataset.field+'Other').disabled=!otherSelected;
  group.removeAttribute('aria-invalid');
  $('formError').hidden=true;activeError='';
  updateSentencePreviews();
  if(event.target.value==='__other__'&&event.target.checked)$(group.dataset.field+'Other').focus({preventScroll:true});
});
form.addEventListener('input',updateSentencePreviews);
for(const [key,max] of Object.entries(REQUEST_LIMITS)){if($(key))$(key).maxLength=max;}
form.addEventListener('input',e=>{if(e.target.matches('input,textarea')){e.target.removeAttribute('aria-invalid');e.target.removeAttribute('aria-describedby');$('formError').hidden=true;activeError='';}});
$('previousStep').addEventListener('click',()=>{if(!busy)showStep(currentStep-1);});
form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!validateStep(currentStep))return;if(currentStep<4){showStep(currentStep+1);return;}
  for(let i=0;i<fieldsets.length;i++){if(!validateStep(i,false)){showStep(i,false);validateStep(i);return;}}
  const data=collectRequest();
  busy=true;$('nextStep').disabled=true;$('previousStep').disabled=true;form.setAttribute('aria-busy','true');renderNextButton();
  try{const receipt=await submitRequest(data);$('formArea').hidden=true;$('requestReference').textContent=receipt.id;$('formSuccess').hidden=false;$('formSuccess').focus();form.reset();}
  catch(err){console.error('Consultation request failed:',err.code||err.message);error(err.code==='consultation/offline'?'أنت غير متصل بالإنترنت. إجاباتك ما زالت هنا؛ اتصل ثم حاول مجددًا.':'تعذّر إرسال الطلب الآن. لم يتم تأكيد استلامه، وإجاباتك ما زالت هنا. حاول مجددًا بعد قليل.');}
  finally{busy=false;$('nextStep').disabled=false;$('previousStep').disabled=false;form.removeAttribute('aria-busy');renderNextButton();}
});
document.querySelectorAll('#langSeg button').forEach(button=>button.addEventListener('click',()=>applyLanguage(button.dataset.lang,true)));
$('year').textContent=new Date().getFullYear();renderSettings(settings);showStep(0,false);applyLanguage(language);
loadSettings().then(remote=>{if(remote){settings={...base,...remote};renderSettings(settings);}}).catch(err=>console.warn('Using published default consultation content:',err.code||'unavailable'));
