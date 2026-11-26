import '../office-agent/register-source.mjs';
import {SessionManager} from '@earendil-works/pi-coding-agent';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const {protectedMemoryReadback}=await import('../../src/main/xiaozhi-agent/memory-use/protected-readback.ts');

const pin=(id,layer)=>({reference:'记忆'+id,layer,source:'教师记录',version:1,
  text:'合成资料 '+id,provenance:layer==='personal'?'teacher_confirmed':'event_refs',sourceDocuments:[],refs:[],
  ...(layer==='personal'?{personal:{sourceId:id,sourceVersion:'1',scope:'teacher',term:'unknown',occurredAt:null}}:{})});
const [old,active,current,extra]=[pin('A','personal'),pin('B','personal'),pin('C','L2'),pin('D','history')];
function native(){
  const m=SessionManager.inMemory(process.cwd());
  m.appendCustomEntry('xiaozhi.memory.taint.v1',{authority:'test'});
  return m;
}
function toolResult(m,memories,options={}){
  m.appendMessage({role:'toolResult',toolName:'read_education_memory',toolCallId:'call',isError:false,
    content:[{type:'text',text:JSON.stringify({memories})}],details:{success:true},timestamp:1000,...options});
}
test('exposing references or talking about a tool is not a body read',async()=>{
  const m=native();m.appendMessage({role:'user',content:JSON.stringify({memories:[old]}),timestamp:999});
  toolResult(m,[old],{isError:true});
  toolResult(m,[old],{toolName:'other_tool'});
  let reads=0;
  const out=await protectedMemoryReadback(m,{readSelected:async()=>{reads++;return [old];}},'epoch',['A']);
  assert.deepEqual(out,[]);assert.equal(reads,0);
});
test('protected context intersects native receipt, current selection and current authority',async()=>{
  const m=native();toolResult(m,[old,active,current]);
  let requested;
  const runtime={readSelected:async(_authority,_signal,ids)=>{requested=ids;return [old,active,current,extra];}};
  assert.deepEqual(await protectedMemoryReadback(m,runtime,'epoch',['B']),[active,current]);
  assert.deepEqual(requested,['B']);
  assert.deepEqual(await protectedMemoryReadback(m,runtime,'epoch',[]),[current]);
});
test('a new source body cannot inherit an old receipt and a changed authority denies delivery',async()=>{
  const m=native();toolResult(m,[current]);
  assert.deepEqual(await protectedMemoryReadback(m,{readSelected:async()=>[{...current,text:'另一版'}]},'epoch',[]),[]);
  await assert.rejects(protectedMemoryReadback(m,{readSelected:async()=>{throw Error('memory_scope_changed');}},'stale',[]),/memory_scope_changed/);
});


test('the native task host appends a receipt to a genuine memory read',async()=>{
  const {withPlanBasisReference}=await import('../../src/main/xiaozhi-agent/plan-native.ts');
  const manager=native();
  const result=withPlanBasisReference({content:[{type:'text',text:JSON.stringify({memories:[current]})}],
    details:{success:true}},'call','read_education_memory');
  toolResult(manager,[],result);
  assert.deepEqual(await protectedMemoryReadback(manager,{readSelected:async()=>[current]},'epoch',[]),[current]);
});
