import { normalizePageContent } from './page-content.js?v=faq-order-1';
const $ = selector => document.querySelector(selector);
const node = (tag, cls, text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function renderPageContent(config,t=s=>s) {
  const p=normalizePageContent(config.pageContent),v=p.visibility;
  const targets={navigation:'.navbar',hero:'#home .top',video:'#home .dash',cta:'.hero-cta',process:'#process',scope:'#scope',apply:'#apply',faq:'#faq',footer:'body>footer'};
  for(const [key,selector] of Object.entries(targets))if($(selector))$(selector).hidden=!v[key];
  $('#home').hidden=!v.hero&&!v.video&&!v.cta;
  $('#testimonials').hidden=!v.testimonials||!$('#waRow').children.length;
  for(const [key,target,section] of [['navProcess','#process','process'],['navScope','#scope','scope'],['navFaq','#faq','faq']]) {
    const link=$('.nav-links a[href="'+target+'"]');link.textContent=t(p[key]);link.hidden=!v[section];
  }
  for(const link of document.querySelectorAll('.navbar>.btn,.hero-cta .btn')) {link.hidden=!v.cta;link.href=v.apply?'#apply':'Form/';link.querySelector('span').textContent=t(p.ctaLabel);}
  for(const [key,id] of [['processTitle','#processTitle'],['reviewsTitle','#reviewsTitle'],['faqTitle','#faqTitle'],['footerLabel','#footerBrand']])$(id).textContent=t(p[key]);
  const grid=$('#process .proc-grid');grid.replaceChildren();
  p.processSteps.forEach((step,i)=>{const card=node('article','proc-card');card.append(node('span','proc-num pnum',String(i+1)),node('h3','',t(step.title)),node('p','',t(step.body)));grid.append(card);});
  for(const key of ['included','excluded']) {$('#scope .'+key+' h3').textContent=t(p[key+'Title']);const list=$('#scope .'+key+' ul');list.replaceChildren(...p[key+'Items'].map(item=>node('li','',t(item))));}
  let heading=$('#applyHeading');
  if(!heading&&$('#apply .form-host')) {heading=node('h2','apply-heading');heading.id='applyHeading';$('#apply').prepend(heading);}
  if(heading){heading.textContent=t(p.applyTitle);heading.hidden=!p.applyTitle;}
  const open=new Set([...document.querySelectorAll('.faq-item.open .faq-q')].map(q=>q.textContent));
  const faq=$('#faq .faq');faq.replaceChildren();
  p.faqs.forEach((entry,i)=>{
    const item=node('div','faq-item'),q=node('button','faq-q',t(entry.question)),wrap=node('div','faq-wrap'),inner=node('div','faq-inner'),answer=node('div','faq-a',t(entry.answer));
    q.type='button';wrap.id='faq-answer-'+i;q.setAttribute('aria-controls',wrap.id);const expanded=open.has(t(entry.question));q.setAttribute('aria-expanded',String(expanded));wrap.inert=!expanded;item.classList.toggle('open',expanded);
    q.append(node('span','chev'));q.lastChild.setAttribute('aria-hidden','true');inner.append(answer);wrap.append(inner);item.append(q,wrap);faq.append(item);
  });
}
