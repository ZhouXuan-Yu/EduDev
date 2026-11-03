/** Pure assertion regression; no DB, Electron, business API or persisted fixtures. */
import assert from 'node:assert/strict';
import {jsonEqual} from './paper-export-intent-evidence.mjs';
jsonEqual(undefined,undefined,'Both optional layout bindings absent');
for(const value of [null,{},[],false,0,'']){
  assert.throws(()=>jsonEqual(undefined,value),assert.AssertionError);
  assert.throws(()=>jsonEqual(value,undefined),assert.AssertionError);
}
const entry={entryId:'pure-assertion',sectionId:'original',position:0,instance:{content:{question:'full'},review:{eventId:'review'}},source:{version:'exact'},points:100};
jsonEqual([entry],structuredClone([entry]));
for(const mutate of [e=>e.sectionId='other',e=>e.position++,e=>e.instance.content.question='lost',e=>e.instance.review.eventId='lost',e=>e.source.version='changed',e=>e.points=5]){
  const changed=structuredClone(entry);mutate(changed);assert.throws(()=>jsonEqual([entry],[changed]),assert.AssertionError);
}
jsonEqual({optional:undefined,retained:[entry]},{retained:[entry]},'Existing JSON normalization retained');
assert.throws(()=>jsonEqual([entry],[entry,entry]),assert.AssertionError);
console.log(JSON.stringify({success:true,scope:'pure assertion regression only',undefinedDistinctFromNull:true,persistentMutationsRejected:6,electronLaunches:0,modelCalls:0}));
