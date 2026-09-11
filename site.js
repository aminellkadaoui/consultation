import { loadSettings, submitRequest, REQUEST_LIMITS } from './data.js';
import { normalizeWhatsapp, validWhatsapp, normalizeInstagram, validInstagram, safeUrl, mediaSource } from './public-utils.js';
const $=id=>document.getElementById(id);
const base=window.CONSULTATION_CONFIG||{};
let settings={...base};
let currentStep=0,busy=false;
const stepNames=['معلوماتك','وضعك الحالي','مشكلتك الأساسية','هدفك','ماذا تريد من الجلسة؟'];
const form=$('intakeForm');
const fieldsets=[...form.querySelectorAll('fieldset')];
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function makeMedia(url,title,poster='') {
  const source=mediaSource(url);if(!source)return null;
  if(source.type==='link') {const a=node('a','button primary','شاهد الفيديو ↗');a.href=source.src;a.target='_blank';a.rel='noopener noreferrer';return a;}
  const el=document.createElement(source.type);
  el.src=source.src;
  if(source.type==='iframe'){el.title=title;el.loading='lazy';el.allow='fullscreen; picture-in-picture; encrypted-media';el.allowFullscreen=true;el.referrerPolicy='strict-origin-when-cross-origin';}
  else {el.controls=true;el.playsInline=true;el.preload='metadata';if(safeUrl(poster,true))el.poster=safeUrl(poster,true);}
  return el;
}
function renderSettings(config){
  const headline=config.headline||base.headline;
  const parts=headline.split('على ماذا تركز الآن؟');
  $('headline').replaceChildren();
  if(parts.length===2){$('headline').append(document.createTextNode(parts[0]),node('span','s', 'على ماذا تركز الآن؟'),document.createTextNode(parts[1]));}
  else $('headline').textContent=headline;
  $('subheadline').textContent=config.subheadline||base.subheadline;
  
  document.title='استشارة للإديتورز | '+(config.brand||base.brand);
  const values={'[data-duration]':config.durationMinutes,'[data-price]':config.price,'[data-currency]':config.currency,'[data-hours]':config.actionDocHours};
  for(const [selector,value] of Object.entries(values)){if(value!==undefined)document.querySelectorAll(selector).forEach(el=>el.textContent=value);}
  if(config.videoUrl){const media=makeMedia(config.videoUrl,'التعريف باستشارة الإديتورز',config.videoPoster);if(media){$('videoContent').replaceChildren(media);$('videoContent').classList.add('has-media');}}
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
function error(message,field){$('formError').textContent=message;$('formError').hidden=false;if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','formError');field.focus();}}
function showStep(index,focus=true){currentStep=index;fieldsets.forEach((f,i)=>f.hidden=i!==index);$('stepLabel').textContent=stepNames[index];$('stepCounter').innerHTML=String(index+1).padStart(2,'0')+' <span>/ 05</span>';$('previousStep').hidden=index===0;$('nextStep').innerHTML=(index===4?'أرسل طلب الاستشارة':'التالي')+' <span aria-hidden="true">←</span>';document.querySelectorAll('.progress-bars i').forEach((el,i)=>el.classList.toggle('active',i<=index));$('formError').hidden=true;if(focus){const first=fieldsets[index].querySelector('input,textarea');first.focus({preventScroll:true});if(window.innerWidth<600)$('formArea').scrollIntoView({block:'start',behavior:'smooth'});}}
function validateStep(index){for(const input of fieldsets[index].querySelectorAll('input,textarea')){const value=input.value.trim();if(!value){error('أكمل هذا الحقل حتى أفهم حالتك.',input);return false;}if(input.id==='whatsapp'&&!validWhatsapp(value)){error('اكتب رقم واتساب صحيحًا مع رمز الدولة، مثل +212612345678.',input);return false;}if(input.id==='instagram'&&!validInstagram(value)){error('اكتب اسم مستخدم Instagram صحيحًا أو رابط حسابك.',input);return false;}if(!input.checkValidity()){error(input.id==='clientCount'?'اكتب عدد العملاء كرقم صحيح يبدأ من صفر.':'راجع الإجابة في هذا الحقل وطولها.',input);return false;}}return true;}
for(const [key,max] of Object.entries(REQUEST_LIMITS)){if($(key))$(key).maxLength=max;}
form.addEventListener('input',e=>{if(e.target.matches('input,textarea')){e.target.removeAttribute('aria-invalid');e.target.removeAttribute('aria-describedby');$('formError').hidden=true;}});
$('previousStep').addEventListener('click',()=>{if(!busy)showStep(currentStep-1);});
form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!validateStep(currentStep))return;if(currentStep<4){showStep(currentStep+1);return;}
  for(let i=0;i<fieldsets.length;i++){if(i!==currentStep){const fields=[...fieldsets[i].querySelectorAll('input,textarea')];if(fields.some(x=>!x.value.trim()||!x.checkValidity())){showStep(i);validateStep(i);return;}}}
  const data=Object.fromEntries(new FormData(form).entries());data.whatsapp=normalizeWhatsapp(data.whatsapp);data.instagram='@'+normalizeInstagram(data.instagram);
  busy=true;$('nextStep').disabled=true;$('previousStep').disabled=true;form.setAttribute('aria-busy','true');$('nextStep').textContent='جارٍ إرسال طلبك…';
  try{const receipt=await submitRequest(data);$('formArea').hidden=true;$('requestReference').textContent=receipt.id;$('formSuccess').hidden=false;$('formSuccess').focus();form.reset();}
  catch(err){console.error('Consultation request failed:',err.code||err.message);error(err.code==='consultation/offline'?'أنت غير متصل بالإنترنت. إجاباتك ما زالت هنا؛ اتصل ثم حاول مجددًا.':'تعذّر إرسال الطلب الآن. لم يتم تأكيد استلامه، وإجاباتك ما زالت هنا. حاول مجددًا بعد قليل.');}
  finally{busy=false;$('nextStep').disabled=false;$('previousStep').disabled=false;form.removeAttribute('aria-busy');$('nextStep').innerHTML='أرسل طلب الاستشارة <span aria-hidden="true">←</span>';}
});
$('year').textContent=new Date().getFullYear();renderSettings(settings);showStep(0,false);
loadSettings().then(remote=>{if(remote){settings={...base,...remote};renderSettings(settings);}}).catch(err=>console.warn('Using published default consultation content:',err.code||'unavailable'));
