import test from 'node:test';
import assert from 'node:assert/strict';
import {PAGE_DEFAULTS, DEFAULT_HEADLINE, resolvePageSettings, validatePageContent} from '../page-content.js';
test('old published copy migrates; intentional admin edits and hidden sections persist',()=>{
 const legacy={headline:'تعمل كإديتور، لكنك محتار على ماذا تركز الآن؟',videoUrl:'https://example.com/video.mp4'};
 assert.equal(resolvePageSettings(legacy).headline,DEFAULT_HEADLINE);
 assert.equal(resolvePageSettings(legacy).videoUrl,legacy.videoUrl);
 assert.equal(resolvePageSettings({headline:'عنوان مخصص'}).headline,'عنوان مخصص');
 assert.equal(resolvePageSettings({...legacy,pageContent:{visibility:{faq:false}}}).headline,legacy.headline);
 assert.equal(resolvePageSettings({pageContent:{visibility:{faq:false}}}).pageContent.visibility.faq,false);
 assert.equal(PAGE_DEFAULTS.visibility.faq,true);
});
test('validates editable collections and preserves actual text, order and visibility',()=>{
 const p=structuredClone(PAGE_DEFAULTS);p.visibility.process=false;p.faqs.reverse();p.includedItems.push('<test>');
 assert.deepEqual(validatePageContent(p),p);
 assert.throws(()=>validatePageContent({...p,visibility:{hero:'false'}}));
 assert.throws(()=>validatePageContent({...p,faqs:[{question:'',answer:'جواب'}]}));
 assert.throws(()=>validatePageContent({...p,processSteps:Array(9).fill({title:'عنوان',body:'نص'})}));
 assert.throws(()=>validatePageContent({...p,ctaLabel:''}));
});
