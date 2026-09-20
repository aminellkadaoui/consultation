import { SECTION_LABELS, normalizePageContent, validatePageContent } from './page-content.js?v=content-1';

export function mountContentEditor(host, source, onChange) {
  host.oninvalid = null;
  const content = normalizePageContent(source);
  host.replaceChildren();
  if(!host.dataset.validationBound){host.dataset.validationBound='true';host.addEventListener('invalid',event=>{let parent=event.target.parentElement;while(parent&&parent!==host){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}},true);}
  const controls = {};
  const el = (tag, cls, text) => { const n=document.createElement(tag); n.className=cls||''; if(text)n.textContent=text; return n; };
  function field(parent,key,label,value,multiline=false) {
    const wrap=el('div','field'), title=el('label','',label), input=el(multiline?'textarea':'input');
    input.id='page-'+key; title.htmlFor=input.id; input.value=value; input.maxLength=multiline?20000:240;
    if(multiline)input.rows=5; else input.type='text';
    input.addEventListener('input',onChange); wrap.append(title,input);parent.append(wrap); controls[key]=input; return input;
  }
  function group(title, open=false) {
    const details=el('details','content-section-editor');details.open=open;
    const summary=el('summary','',title),body=el('div','content-section-body');details.append(summary,body);host.append(details);return body;
  }
  const visibility=group('إظهار أقسام الصفحة وإخفاؤها',true);
  const grid=el('div','section-visibility');visibility.append(grid);
  for(const [key,label] of Object.entries(SECTION_LABELS)) {
    const row=el('label','visibility-option'),check=el('input');check.type='checkbox';check.checked=content.visibility[key];check.dataset.section=key;
    check.addEventListener('change',onChange);row.append(check,el('span','',label));grid.append(row);
  }
  const nav=group('الشريط العلوي وزر البدء');
  for(const [key,label] of [['ctaLabel','نص زر البدء'],['navProcess','رابط المراحل'],['navScope','رابط ما تشمله'],['navFaq','رابط الأسئلة'],['headlineAccent','الجزء الأزرق من العنوان']])field(nav,key,label,content[key]);
  const titles=group('عناوين الأقسام وأسفل الصفحة');
  for(const [key,label] of [['reviewsTitle','عنوان الآراء'],['processTitle','عنوان المراحل'],['faqTitle','عنوان الأسئلة'],['applyTitle','عنوان فوق الفورم — اختياري'],['footerLabel','الاسم أسفل الصفحة']])field(titles,key,label,content[key]);
  const scope=group('ما تشمله الاستشارة وما لا تشمله');
  for(const [key,label] of [['includedTitle','عنوان ما تشمله'],['excludedTitle','عنوان ما لا تشمله']])field(scope,key,label,content[key]);
  field(scope,'includedItems','ما تشمله — كل نقطة في سطر',content.includedItems.join('\n'),true);
  field(scope,'excludedItems','ما لا تشمله — كل نقطة في سطر',content.excludedItems.join('\n'),true);
  const lists={};
  function editableList(key,title,keys,labels,max) {
    const section=group(title),list=el('div','content-item-list'),add=el('button','button secondary','إضافة');add.type='button';
    section.append(list,add);lists[key]=list;
    function row(item={}) {
      if(list.children.length>=max)return;
      const card=el('div','content-edit-item'),fields=el('div');
      keys.forEach((k,i)=>{
        const uid=key+'-'+crypto.randomUUID()+'-'+k;
        const input=field(fields,uid,labels[i],item[k]||'',i===1);input.dataset.itemKey=k;input.maxLength=i===1?3000:240;input.required=true;
      });
      const actions=el('div','content-item-actions');
      for(const [text,action] of [['أعلى',()=>card.previousElementSibling?.before(card)],['أسفل',()=>card.nextElementSibling?.after(card)],['إزالة',()=>card.remove()]]) {
        const btn=el('button','button ghost',text);btn.type='button';btn.addEventListener('click',()=>{action();update();onChange();});actions.append(btn);
      }
      card.append(fields,actions);list.append(card);update();return card;
    }
    function update(){add.disabled=list.children.length>=max;[...list.children].forEach((c,i)=>{const buttons=c.querySelectorAll('.content-item-actions button');buttons[0].disabled=i===0;buttons[1].disabled=i===list.children.length-1;});}
    content[key].forEach(row);add.addEventListener('click',()=>{const card=row();onChange();card?.querySelector('input')?.focus();});
  }
  editableList('processSteps','بطاقات المراحل',['title','body'],['العنوان','الوصف'],8);
  editableList('faqs','الأسئلة والأجوبة',['question','answer'],['السؤال','الجواب'],20);
  return { read() {
    const next={...content,visibility:{}};
    grid.querySelectorAll('input').forEach(input=>{next.visibility[input.dataset.section]=input.checked;});
    for(const key of Object.keys(content))if(controls[key])next[key]=controls[key].value.trim();
    for(const key of ['includedItems','excludedItems'])next[key]=controls[key].value.split('\n').map(s=>s.trim()).filter(Boolean);
    for(const [key,list] of Object.entries(lists))next[key]=[...list.children].map(card=>Object.fromEntries([...card.querySelectorAll('[data-item-key]')].map(input=>[input.dataset.itemKey,input.value.trim()])));
    return validatePageContent(next);
  }};
}
