import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PAGE_DEFAULTS} from '../page-content.js';
const source=await readFile(new URL('../data.js',import.meta.url),'utf8');
async function fixture(existing, rejectSections=true){
 const writes=[];
 globalThis.__settingsTestRuntime={auth:{currentUser:{uid:'test'}},db:{},dbSDK:{
 doc:()=> 'settings/public', serverTimestamp:()=> 'SERVER_TIME',
 getDocFromServer:async()=>({exists:()=>!!existing,data:()=>existing}),
 setDoc:async(_ref,value)=>{writes.push(value);if(rejectSections&&value.pageContent)throw Object.assign(new Error('Denied'),{code:'permission-denied'});}
 }};
 const code=source.replace("'./request-workflow.js'",JSON.stringify(new URL('../request-workflow.js',import.meta.url).href))
 .replace("'./page-content.js?v=content-1'",JSON.stringify(new URL('../page-content.js',import.meta.url).href))
 .replace('let runtime = null;','let runtime = globalThis.__settingsTestRuntime;');
 const api=await import('data:text/javascript;base64,'+Buffer.from(code+'\n//'+Math.random()).toString('base64'));
 delete globalThis.__settingsTestRuntime;return {api,writes};
}
test('legacy base content saves remain available during rules rollout',async()=>{
 const {api,writes}=await fixture(null);await api.saveSettings({headline:'عنوان جديد'});
 assert.equal(writes.length,2);assert.equal(writes[1].headline,'عنوان جديد');assert.equal('pageContent' in writes[1],false);
});
test('section edits never silently disappear on rejected writes',async()=>{
 const {api,writes}=await fixture(null);const pageContent=structuredClone(PAGE_DEFAULTS);pageContent.visibility.video=false;
 await assert.rejects(api.saveSettings({pageContent}),/لم تُحفظ/);assert.equal(writes.length,1);
});
test('existing section data cannot be dropped by fallback; new rules save it directly',async()=>{
 const pageContent=structuredClone(PAGE_DEFAULTS);
 const failed=await fixture({pageContent});await assert.rejects(failed.api.saveSettings({headline:'مخصص'}));assert.equal(failed.writes.length,1);
 const allowed=await fixture({pageContent},false);await allowed.api.saveSettings({headline:'مخصص'});assert.equal(allowed.writes.length,1);assert.deepEqual(allowed.writes[0].pageContent,pageContent);
});
