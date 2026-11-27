import '../office-agent/register-source.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const {createPiMemoryScope} = await import('../../src/main/xiaozhi-agent/memory-scope.ts');
const {createPiMemoryTools} = await import('../../src/main/xiaozhi-agent/memory-tools.ts');

test('the native read accepts only personal references included in this request', async () => {
  const sessionId = 'aisession_11111111-1111-4111-8111-111111111111';
  const pin = n => ({layer:'personal',source:'personal',id:n.repeat(64),version:1,
    sourceVersion:'c'.repeat(64),fingerprint:n.repeat(64)});
  const pins = [pin('a'),pin('b'),pin('d')];
  const texts = ['光学实验的作图', '诗歌朗读的节奏', '光学实验的旧学期要求'];
  const store = {getAiConversationSession:async()=>({session:{}}),
    xiaozhiState:{memoryScope:async()=>({enabled:true,version:2,selections:pins})}};
  const host = createPiMemoryScope(store,{personal:async (_,ref) => {
    const i=pins.findIndex(pin=>pin.id===ref.id);
    return {text:texts[i],fingerprint:ref.fingerprint,label:'教师确认的记忆',scope:'teacher',
      term:i===2?'previous-term':'unknown',occurredAt:null};
  }});
  const {fingerprint}=await host.authority(sessionId);
  assert.deepEqual(await host.readSelected(sessionId,fingerprint,undefined,[]),[]);
  const plan=await host.personalReferences(sessionId,fingerprint,'request-id','准备光学实验',24000);
  assert.deepEqual(plan.items.map(row=>row.id),[pins[0].id]);
  assert.ok(!plan.projection.includes('光学'));
  const read=await host.readSelected(sessionId,fingerprint,undefined,plan.items.map(row=>row.id));
  assert.deepEqual(read.map(row=>row.text),[texts[0]]);
  assert.deepEqual((await host.personalReferences(sessionId,fingerprint,'request-id','准备光学实验',0)).items,[]);
  const selected=await host.personalReferences(sessionId,fingerprint,'request-id','请核对我已选的个人记忆。',24000);
  assert.deepEqual(selected.items.map(row=>row.id),[pins[0].id,pins[1].id]);
  const ranked=await host.personalReferences(sessionId,fingerprint,'request-id','朗读诗歌与光学',24000);
  assert.deepEqual(ranked.items.map(row=>row.id),[pins[1].id,pins[0].id]);
  const ordered=await host.readSelected(sessionId,fingerprint,undefined,ranked.items.map(row=>row.id));
  assert.deepEqual(ordered.map(row=>row.personal.sourceId),ranked.items.map(row=>row.id));
  const excluded=await host.personalReferences(sessionId,fingerprint,'request-id','本次不要参考个人记忆，准备光学实验。',24000);
  assert.deepEqual(excluded.items,[]);
  await assert.rejects(host.personalReferences(sessionId,'old','request-id','准备光学实验',24000),/memory_scope_changed/);
});

test('a tool result prepared before a teacher correction is withheld at delivery', async () => {
  const barrier=Promise.withResolvers();
  let projected=['original'], delivered=0;
  const runtime={readSelected:async()=>{await barrier.promise;return [{reference:'记忆1',source:'教师记忆',version:1,text:'旧任务的内容'}];}};
  const [tool]=createPiMemoryTools(runtime,'snapshot',()=>{delivered++;},()=>projected);
  const pending=tool.execute('call',{},new AbortController().signal);
  projected=[];
  barrier.resolve();
  await assert.rejects(pending,/memory_scope_changed/);
  assert.equal(delivered,0);
});
