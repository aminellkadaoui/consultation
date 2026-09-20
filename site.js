import { resolvePageSettings } from './page-content.js?v=faq-order-1';
import { renderPageContent } from './page-renderer.js?v=faq-order-1';
import { makeHeroMedia } from './video-preview.js?v=flow-1';
import { translate } from './translations.js?v=content-1';
import { loadSettings } from './data.js?v=content-2';
import { mountConsultationForm } from './Form/component.js?v=shared-form-1';
import { safeUrl, mediaSource } from './public-utils.js';
const $=id=>document.getElementById(id);
const base=window.CONSULTATION_CONFIG||{};
let settings=resolvePageSettings(base);
let formController = null;
let language='ar';
try {const stored=localStorage.getItem('consultationLanguage');if(stored==='darija')language=stored;}catch{}
const t=text=>translate(text,language);
const staticText=[];
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(walker.nextNode()) {
  const item=walker.currentNode;
  if(!item.parentElement.closest('script,style,#apply,#headline,#subheadline,#stepLabel,#nextStep,#formError,#waRow,.sentence-value')&&/[\u0600-\u06ff]/.test(item.textContent))staticText.push([item,item.textContent]);
}
const staticAttributes=[];
for(const el of document.querySelectorAll('[placeholder],[aria-label]')) {
  if(el.closest('#langSeg,#waRow,#apply'))continue;
  for(const attr of ['placeholder','aria-label'])if(el.hasAttribute(attr))staticAttributes.push([el,attr,el.getAttribute(attr)]);
}
function renderHeading(config) {
  const headline=t(config.headline||base.headline),emphasis=t(config.pageContent?.headlineAccent||'ما الخطوة التالية؟');
  const parts=emphasis?headline.split(emphasis):[headline];
  $('headline').replaceChildren();
  if(parts.length===2)$('headline').append(document.createTextNode(parts[0]),node('span','s',emphasis),document.createTextNode(parts[1]));
  else $('headline').textContent=headline;
  $('subheadline').textContent=t(config.subheadline||base.subheadline);
  document.title=t('استشارة للإديتورز')+' | '+(config.brand||base.brand);
  document.querySelector('meta[name="description"]').content=t(config.subheadline||base.subheadline);
}
function applyLanguage(nextLanguage,persist=false) {
  language=nextLanguage==='darija'?'darija':'ar';
  document.documentElement.lang=language==='darija'?'ar-MA':'ar';
  document.documentElement.dir='rtl';
  document.querySelectorAll('#langSeg button').forEach(button=>{const selected=button.dataset.lang===language;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  for(const [textNode,source] of staticText)if(textNode.isConnected)textNode.textContent=t(source);
  for(const [el,attr,source] of staticAttributes)if(el.isConnected)el.setAttribute(attr,t(source));
  renderHeading(settings);
  renderPageContent(settings,t);
  formController?.setLanguage(language);
  document.querySelectorAll('#videoContent>a,.wa>a').forEach(el=>el.textContent=t('شاهد الفيديو ↗'));
  if(persist)try{localStorage.setItem('consultationLanguage',language);}catch{}
}
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
  renderPageContent(config,t);
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
$('faq').addEventListener('click',event=>{const q=event.target.closest('.faq-q');if(!q)return;const open=q.parentElement.classList.toggle('open');q.setAttribute('aria-expanded',String(open));document.getElementById(q.getAttribute('aria-controls')).inert=!open;});
document.querySelectorAll('#langSeg button').forEach(button=>button.addEventListener('click',()=>applyLanguage(button.dataset.lang,true)));
$('year').textContent=new Date().getFullYear();renderSettings(settings);applyLanguage(language);
mountConsultationForm($('apply'), { language }).then(controller => { formController = controller; controller.setLanguage(language); renderPageContent(settings,t); }).catch(console.error);
loadSettings().then(remote=>{if(remote){settings=resolvePageSettings({...base,...remote});renderSettings(settings);}}).catch(err=>console.warn('Using published default consultation content:',err.code||'unavailable'));
