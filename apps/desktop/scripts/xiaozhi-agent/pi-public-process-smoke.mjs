import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
const { applyXiaozhiEvent } = await import('../../src/shared/xiaozhi-projection.ts');
const { groupOfficeProcess, formatProcessDuration, processNeedsAttention } = await import('../../src/renderer/components/office/office-process.ts');
const checks = [];
function check(name, test) { test(); checks.push(name); }
let turn = { id: 'run_actual', status: 'running', items: [{ id: 'user', kind: 'message', role: 'user', text: '整理教学资料' }] };
const event = payload => ({ sessionId: 'session', runId: turn.id, sequence: 1, ...payload });
function apply(payload) { turn = applyXiaozhiEvent(turn, event(payload)); }
check('Public explanation/call/next explanation/final remain ordered and independently identified', () => {
  apply({ kind: 'assistant_start', segment: 1 }); apply({ kind: 'text_delta', delta: '先查资料。' }); apply({ kind: 'assistant_end', segment: 1, final: false });
  apply({ kind: 'tool_start', callId: 'a', tool: 'search_teacher_knowledge' }); apply({ kind: 'tool_start', callId: 'b', tool: 'office_read_text' });
  apply({ kind: 'tool_end', callId: 'b', tool: 'office_read_text', success: true, durationMs: 26.5, sources: [{ title: '教研资料' }] });
  apply({ kind: 'tool_end', callId: 'a', tool: 'search_teacher_knowledge', success: false, durationMs: 1900 });
  apply({ kind: 'assistant_start', segment: 2 }); apply({ kind: 'text_delta', delta: '检索未完成，先给资料摘要。' }); apply({ kind: 'assistant_end', segment: 2, final: true });
  assert.deepEqual(turn.items.map(item => item.id), ['user','run_actual:segment:1','a','b','run_actual:segment:2']);
  assert.equal(turn.items[1].text, '先查资料。'); assert.equal(turn.items.at(-1).phase, 'final_answer');
});
check('Parallel completion order does not reorder calls; failed call stays attention and source belongs to its own call', () => {
  const parts = groupOfficeProcess(turn.items); assert.equal(parts[2].kind, 'tools');
  assert.deepEqual(parts[2].items.map(item => item.id), ['a','b']); assert(processNeedsAttention(parts[2].items[0]));
  assert.equal(parts[2].items[1].sources[0].title, '教研资料'); assert.equal(parts[2].items[1].durationMs, 26.5);
});
check('Grouping does not cross empty public message/control/compaction barriers or mutate original sequence', () => {
  const items = [{id:'1',kind:'tool'}, {id:'barrier',kind:'message',role:'assistant',text:''}, {id:'2',kind:'tool'}, {id:'p',kind:'plan'}, {id:'3',kind:'tool'}, {id:'c',kind:'compaction'}, {id:'4',kind:'tool'}];
  const original = structuredClone(items), parts = groupOfficeProcess(items); assert.equal(parts.length, 7); assert.deepEqual(items, original);
});
check('Late duplicate start/end without measured time preserves actual measured duration; unknown does not fabricate zero', () => {
  apply({kind:'tool_start',callId:'b',tool:'office_read_text'}); apply({kind:'tool_end',callId:'b',tool:'office_read_text',success:true});
  assert.equal(turn.items.find(item=>item.id==='b').durationMs,26.5);
  apply({kind:'tool_start',callId:'old',tool:'read'}); apply({kind:'tool_end',callId:'old',tool:'read',success:true,durationMs:NaN});
  assert.equal(turn.items.find(item=>item.id==='old').durationMs,undefined);
});
check('Only finite nonnegative main usage creates elapsed time; old history remains compatible', () => {
  apply({kind:'usage',usage:{activeMs:2200,waitingMs:3100}}); assert.equal(turn.elapsedMs,5300);
  for(const usage of [{activeMs:NaN,waitingMs:0},{activeMs:-1,waitingMs:2},{activeMs:Number.MAX_VALUE,waitingMs:Number.MAX_VALUE}]) apply({kind:'usage',usage});
  assert.equal(turn.elapsedMs,5300); assert.equal(formatProcessDuration(turn.elapsedMs),'5 秒');
  assert.equal(formatProcessDuration(3661000),'1 小时 1 分钟 1 秒');
  assert.equal(applyXiaozhiEvent({id:'old',status:'completed',items:[]},event({kind:'status',status:'completed'})).elapsedMs,undefined);
});
console.log(JSON.stringify({success:true,checks:checks.length,names:checks},null,2));
