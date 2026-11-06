import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installChatPublicProbe} from './chat-live-public-probe.mjs';

// Browser API unit doubles only. Never installed into Electron or a model stream.
function fixture() {
  const state = {visible:false, layout:true, live:true, status:'running'};
  const timeline = {getClientRects:() => state.layout ? [{}] : [], checkVisibility:() => state.visible};
  const live = {querySelector:() => timeline};
  const turn = {
    contains:() => false,
    getAttribute:name => name === 'data-turn-id' ? 'run-one' : state.status,
    querySelector:selector => selector === '[data-mode="live-prose"]' && state.live ? live : null,
  };
  let receive, mutate;
  const window = {omniEdu:{onXiaozhiEvent:callback => {receive=callback; return () => {};}}};
  const context = {window, Date, Map, Set, queueMicrotask,
    document:{body:{}, querySelectorAll:() => [turn]},
    MutationObserver:class {constructor(callback) {mutate=callback;} observe() {} disconnect() {}},
  };
  vm.runInNewContext(`(${installChatPublicProbe.toString()})()`, context);
  const send = async (kind, extra={}) => {
    receive({sessionId:'session-one', runId:'run-one', sequence:1, kind, ...extra});
    await Promise.resolve();
  };
  return {state, window, send, mutate:() => mutate()};
}

test('Real public tool event and visible running timeline are both required', async () => {
  const f=fixture(); f.state.visible=true; f.mutate();
  assert.equal(f.window.__uiChatExecutions.length,0,'DOM alone cannot fabricate activity');
  await f.send('tool_start',{callId:'actual-call',tool:'read_attachment'});
  assert.equal(f.window.__uiChatExecutions.length,1);
  const proof=f.window.__uiChatExecutions[0];
  assert.equal(proof.runId,'run-one'); assert.equal(proof.sessionId,'session-one');
  assert.equal(proof.callId,'actual-call'); assert.equal(proof.timelineVisible,true);
  f.mutate(); assert.equal(f.window.__uiChatExecutions.length,1,'One immutable first observation per run');
});

test('Hidden or unlaid-out nodes and other runs cannot prove execution visibility', async () => {
  const f=fixture(); await f.send('tool_start');
  assert.equal(f.window.__uiChatExecutions.length,0);
  f.state.visible=true; f.state.layout=false; f.mutate();
  assert.equal(f.window.__uiChatExecutions.length,0);
  const other=fixture(); other.state.visible=true; await other.send('tool_start',{runId:'run-other'});
  assert.equal(other.window.__uiChatExecutions.length,0);
});

test('A DOM commit observed before final survives a later polling window', async () => {
  const f=fixture(); await f.send('tool_start');
  f.state.visible=true; f.mutate();
  await f.send('assistant_phase',{phase:'final_answer',sequence:2});
  f.state.live=false; f.state.status='completed'; f.mutate();
  assert.equal(f.window.__uiChatExecutions.length,1);
  assert.equal(f.window.__uiChatExecutions[0].beforeFinal,true);
  assert.equal(f.window.__uiChatExecutions[0].beforeTerminal,true);
});

test('First visibility after final or terminal never redeems missing live evidence', async () => {
  for (const terminal of ['final_answer','completed','failed','interrupted']) {
    const f=fixture(); await f.send('tool_start');
    await f.send(terminal==='final_answer'?'assistant_phase':'status',
      terminal==='final_answer'?{phase:terminal}:{status:terminal});
    f.state.visible=true; f.mutate();
    assert.equal(f.window.__uiChatExecutions.length,0);
  }
});

test('Private reasoning and nonpublic text cannot create public execution proof', async () => {
  const f=fixture(); f.state.visible=true;
  await f.send('model_reasoning',{delta:'private'});
  await f.send('text_delta',{delta:'unmarked'});
  assert.equal(f.window.__uiChatExecutions.length,0);
  await f.send('assistant_phase',{phase:'commentary'});
  await f.send('text_delta',{delta:'Public instruction summary'});
  assert.equal(f.window.__uiChatExecutions.length,1);
  assert.equal(f.window.__uiChatExecutions[0].publicCommentary,true);
  assert.equal('delta' in f.window.__uiChatExecutions[0],false,'No model prose copied to observer metadata');
});
