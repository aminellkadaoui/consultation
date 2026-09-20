import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../data.js', import.meta.url), 'utf8');
async function setup(initial) {
  const docs = new Map(Object.entries(initial)); const auth = { currentUser:{uid:'test-admin'} };
  const remove = Symbol('delete');
  const dbSDK = {
    doc: (_db,collection,id)=>`${collection}/${id}`,
    serverTimestamp: ()=> 'SERVER_TIME', deleteField: ()=>remove,
    runTransaction: async (_db,callback)=>{
      const writes=[];
      const result=await callback({get:async ref=>({exists:()=>docs.has(ref),data:()=>structuredClone(docs.get(ref))}),
        update:(ref,value)=>writes.push(()=>{
          assert.ok(docs.has(ref)); const item=docs.get(ref);
          for(const [key,val] of Object.entries(value)) if(val===remove)delete item[key];else item[key]=val;
        }), delete:ref=>writes.push(()=>docs.delete(ref))});
      writes.forEach(write=>write()); return result;
    }
  };
  // Inject a test double only into a separately evaluated copy, never into the deployed module.
  globalThis.__dataTestRuntime={auth,dbSDK,db:{}};
  const code=source.replace("'./request-workflow.js'",JSON.stringify(new URL('../request-workflow.js',import.meta.url).href))
    .replace("'./page-content.js?v=content-1'",JSON.stringify(new URL('../page-content.js',import.meta.url).href))
    .replace('let runtime = null;', 'let runtime = globalThis.__dataTestRuntime;');
  const api=await import('data:text/javascript;base64,'+Buffer.from(code+'\n// '+Math.random()).toString('base64'));
  delete globalThis.__dataTestRuntime;
  return {api,docs,auth};
}
test('trash/restore preserve notes, answers, token and previous status; delete removes linked progress',async()=>{
 const token='abc_12345678901234567890123456789012';const path='consultation_requests/r';
 const original={status:'scheduled',privateNotes:'لا تفقد الملاحظة',problem:'مشكلة',trackingToken:token,stages:[{key:'meeting',status:'current'}]};
 const {api,docs}=await setup({[path]:structuredClone(original),['consultation_progress/'+token]:{currentStage:'meeting'}});
 await assert.rejects(api.deleteRequest('r'));
 await api.moveRequestToTrash('r'); await api.moveRequestToTrash('r');
 assert.equal(docs.get(path).trashPreviousStatus,'scheduled');
 assert.equal(docs.get(path).privateNotes,original.privateNotes);
 await assert.rejects(api.updateRequest('r',{status:'accepted'}));
 await api.updateRequest('r',{status:'trash',privateNotes:'ملاحظة في المهملات'});
 await api.restoreRequest('r'); assert.equal(docs.get(path).status,'scheduled');
 assert.equal('trashPreviousStatus' in docs.get(path),false);
 assert.equal(docs.get(path).trackingToken,token);
 assert.deepEqual(docs.get(path).stages,original.stages);
 await api.moveRequestToTrash('r'); await api.deleteRequest('r');
 assert.equal(docs.has(path),false);assert.equal(docs.has('consultation_progress/'+token),false);
});
test('legacy trash restores to new, invalid ids and logged-out writes are rejected',async()=>{
 const {api,docs,auth}=await setup({'consultation_requests/legacy':{status:'trash'}});
 await api.restoreRequest('legacy'); assert.equal(docs.get('consultation_requests/legacy').status,'new');
 await assert.rejects(api.moveRequestToTrash('a/b'));
 auth.currentUser=null;
 for(const method of ['moveRequestToTrash','restoreRequest','deleteRequest'])await assert.rejects(api[method]('legacy'),/سجّل الدخول/);
});
