import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRequests, previousStatus, guardStatusChange } from '../request-workflow.js';
import { normalizeRequest, presentRequest, csvCell } from '../request-presenter.js';
const items = [
  { id:'first', fullName:'اسم مكرر', status:'new', editingType:['YouTube','Short Form'] },
  { id:'second', fullName:'اسم مكرر', status:'accepted', privateNotes:'خاصة' },
  { id:'trash', fullName:'اسم مكرر', status:'trash', trashPreviousStatus:'scheduled' }
];
test('normal lists and CSV source exclude trash; explicit trash filter includes it',()=>{
  assert.deepEqual(filterRequests(items).map(x=>x.id),['first','second']);
  assert.deepEqual(filterRequests(items,'trash').map(x=>x.id),['trash']);
  assert.deepEqual(filterRequests(items,'all','youtube').map(x=>x.id),['first']);
  assert.deepEqual(filterRequests(items,'accepted','اسم').map(x=>x.id),['second']);
});
test('restore keeps status, legacy trash falls back to new',()=>{
  assert.equal(previousStatus(items[2]),'scheduled');
  assert.equal(previousStatus({status:'trash'}),'new');
  assert.equal(previousStatus({trashPreviousStatus:'trash'}),'new');
});
test('notes in trash remain editable; status dropdown cannot bypass trash actions',()=>{
  assert.doesNotThrow(()=>guardStatusChange(items[2],{status:'trash',privateNotes:'ملاحظة'}));
  assert.throws(()=>guardStatusChange(items[2],{status:'new'}));
  assert.throws(()=>guardStatusChange(items[0],{status:'trash'}));
  assert.doesNotThrow(()=>guardStatusChange(items[0],{status:'accepted'}));
});
test('legacy and multi-select records keep readable summaries and CSV escaping',()=>{
  for(const editingType of ['Short Form',['Short Form','YouTube']]) {
    const item=normalizeRequest({fullName:'اختبار',experience:'سنة',clientCount:'4 إلى 10',editingType,problem:'التعديلات',goal:'رفع أسعاري',approach:'تحسين العرض',obstacle:'الوقت',sessionOutcome:'أولويتي',status:'new'});
    assert.ok(JSON.stringify(presentRequest(item)).includes('Short Form'));
  }
  assert.ok(csvCell('=1+1').includes("'="));
});
