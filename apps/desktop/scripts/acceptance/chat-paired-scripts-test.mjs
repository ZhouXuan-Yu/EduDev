/** Offline preparation checks only: no Electron, browser launch or model call. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {pairedScenario} from './chat-paired-scenarios.mjs';
import {installChatPublicProbe} from './chat-live-public-probe.mjs';
import {readOnlyRunBlocker,stopOwnedChatRun} from './chat-live-blocker.mjs';

let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log('PASS ' + name); };
const expected = {
  default:'请读取附件里的合成资料，为八年级浮力实验课写一份40分钟教学活动建议，正文约300字。需要准确引用附件内容，先说明将如何使用资料，再调用适用工具；不要联网，不写入本地文件。',
  misconception:'有学生说：物体受到浮力就一定会上浮。请结合附件的3N和2N数据，诊断这个说法，用约200字解释，并给一道变式及答案。',
  practice:'请依据附件设计3道八年级浮力形成性检查题，分别检查浮力计算、浮沉判断和实验变量；每题附答案、简短解释和引用依据，不补造附件没有的数据。',
};
for (const [name,prompt] of Object.entries(expected)) await check(name + ': both existing runners resolve the exact paired input without runtime use', () => {
  const env={...process.env};
  for(const key of ['DEEPSEEK_API_KEY','UI_PAIRED_PROMPT','UI_PAIRED_PDF','UI_PAIRED_SCENARIO','UI_CHAT_PDF','UI_CHAT_FOCUS'])delete env[key];
  const results=['ui-goal-chat-live.mjs','ui-goal-deeptutor-live.mjs'].map(script=>{
    const result=spawnSync(process.execPath,['scripts/'+script,'--check','--scenario='+name],{env,encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  });
  for(const result of results){
    assert.equal(result.preparedOnly,true);assert.equal(result.scenario,name);
    assert.equal(result.prompt,prompt);assert.equal(result.model,'deepseek-flash');
    assert.equal(result.promptSha256,createHash('sha256').update(prompt).digest('hex'));
  }
  assert.equal(results[0].source,results[1].source);
  assert.equal(results[0].zeroToolSecondRound,name==='default');
});
await check('default and environment override preserve exact prompt bytes and validate scenario',()=>{
  assert.equal(pairedScenario([],{}).prompt,expected.default);
  assert.equal(pairedScenario([],{}).explanation,'为什么受到浮力不一定会上浮？');
  assert.equal(pairedScenario([], {UI_PAIRED_SCENARIO:'practice'}).prompt,expected.practice);
  assert.equal(pairedScenario(['--scenario=misconception'],{UI_PAIRED_PROMPT:' 自定义\n输入 '}).prompt,' 自定义\n输入 ');
  assert.throws(()=>pairedScenario(['--scenario=unknown'],{}));
  assert.throws(()=>pairedScenario(['--scenario=default','--scenario=practice'],{}));
  assert.throws(()=>pairedScenario([],{UI_PAIRED_PROMPT:' '}));
});
await check('shared environment prompt and PDF override resolve identically in both dry-run CLIs',()=>{
  const env={...process.env,UI_PAIRED_PROMPT:' 保留空白的同题\n输入 ',UI_PAIRED_PDF:'D:/synthetic-only/nonexistent-paired-fixture.pdf'};
  delete env.DEEPSEEK_API_KEY;
  const results=['ui-goal-chat-live.mjs','ui-goal-deeptutor-live.mjs'].map(script=>{
    const result=spawnSync(process.execPath,['scripts/'+script,'--check','--scenario=practice'],{env,encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  });
  assert.equal(results[0].prompt,env.UI_PAIRED_PROMPT);assert.equal(results[1].prompt,env.UI_PAIRED_PROMPT);
  assert.equal(results[0].promptSha256,results[1].promptSha256);assert.equal(results[0].source,results[1].source);
});

async function withProbe(run){
  const dom=new JSDOM('<!doctype html><body><textarea data-testid="office-prompt-input"></textarea><section class="office-turn" data-turn-id="run"><div data-testid="office-tool-step"><h3 data-slot="disclosure-heading"><button data-testid="agent-tool-trigger" data-slot="chat-tool-trigger" aria-expanded="true"><span>读取资料</span></button></h3><div data-testid="office-tool-evidence"><a href="https://example.invalid/source">公开来源</a></div></div></section></body>',{pretendToBeVisual:true});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.MutationObserver=dom.window.MutationObserver;
  let listener;
  dom.window.omniEdu={onXiaozhiEvent(callback){listener=callback;return()=>{};}};
  installChatPublicProbe();
  let sequence=0;
  const emit=event=>listener({sessionId:'session',runId:'run',sequence:++sequence,...event});
  try{await run({emit,turn:document.querySelector('section'),tick:()=>new Promise(resolve=>setTimeout(resolve,0))});}
  finally{window.__uiChatObserver.disconnect();dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.MutationObserver;}
}
for(const focus of ['summary','detail-link','composer'])await check('public handoff probe records '+focus+' focus and explicit-before-terminal DOM collapse',()=>withProbe(async({emit,turn,tick})=>{
  const selected=document.querySelector(focus==='summary'?'button[data-testid="agent-tool-trigger"]':focus==='detail-link'?'a':'textarea');selected.focus();
  assert.equal(document.activeElement,selected,'fixture must focus the actual official-shape control');
  emit({kind:'assistant_start',segment:1});emit({kind:'assistant_phase',segment:1,phase:'commentary',since:100});
  emit({kind:'model_reasoning',block:{text:'PRIVATE_SENTINEL_DO_NOT_SAVE'}});
  emit({kind:'text_delta',delta:'PUBLIC_TEXT_NOT_STORED'});
  emit({kind:'tool_start',callId:'read',tool:'office_read_attachment',args:{secret:'ARGS_NOT_STORED'}});
  emit({kind:'assistant_phase',segment:2,phase:'final_answer',since:200});
  turn.innerHTML='<button data-testid="agent-trace-toggle" aria-expanded="false">处理过程</button>';
  if(focus!=='composer')turn.querySelector('button').focus();
  await tick();
  assert.equal(window.__uiChatHandoffs.length,1);
  const handoff=window.__uiChatHandoffs[0];
  assert.equal(handoff.focusBefore,focus);assert.equal(handoff.focusAfter,focus==='composer'?'composer':'process-trigger');
  assert.equal(handoff.beforeTerminal,true);assert.equal(handoff.explicitSequence,6);
  emit({kind:'status',status:'completed'});await tick();assert.equal(window.__uiChatHandoffs[0].beforeTerminal,true);
  const serialized=JSON.stringify({events:window.__uiChatEvents,handoffs:window.__uiChatHandoffs});
  assert(!/PRIVATE_SENTINEL|PUBLIC_TEXT_NOT_STORED|ARGS_NOT_STORED/.test(serialized));
  assert.equal(window.__uiChatEvents.find(event=>event.kind==='text_delta').publicCommentary,true);
}));
await check('terminal-first collapse cannot masquerade as an explicit streaming handoff',()=>withProbe(async({emit,turn,tick})=>{
  emit({kind:'assistant_phase',segment:1,phase:'final_answer',since:200});
  emit({kind:'status',status:'completed'});
  turn.innerHTML='<button data-testid="agent-trace-toggle" aria-expanded="false">处理过程</button>';
  await tick();assert.equal(window.__uiChatHandoffs[0].beforeTerminal,false);
}));
await check('legacy completion creates no explicit evidence and untagged prose is never public commentary',()=>withProbe(async({emit,turn,tick})=>{
  emit({kind:'assistant_start',segment:1});emit({kind:'text_delta',delta:'正文'});
  emit({kind:'assistant_end',segment:1,final:true});emit({kind:'status',status:'completed'});
  turn.innerHTML='<button data-testid="agent-trace-toggle" aria-expanded="false">处理过程</button>';
  await tick();assert.deepEqual(window.__uiChatHandoffs,[]);
  assert.equal(window.__uiChatEvents.find(event=>event.kind==='text_delta').publicCommentary,false);
}));
await check('read-only task fails on the real public question without fabricating a cause or copying private fields',()=>{
  const blocker=readOnlyRunBlocker({status:'waiting_input',questions:[{id:'q',callId:'ask',state:'pending',
    text:'附件未能提取可读文字，请选择如何继续。',options:['重新上传','提供文字','停止'],private:'DO_NOT_SAVE'}],
    tools:[{id:'read',name:'office_read_attachment',status:'failed',summary:{text:'无法读取附件正文',raw:'DO_NOT_SAVE'}}],private:'DO_NOT_SAVE'});
  assert.equal(blocker.kind,'waiting_input');assert.equal(blocker.questions[0].options.length,3);
  assert.equal(blocker.questions[0].text,'附件未能提取可读文字，请选择如何继续。');
  assert(!JSON.stringify(blocker).includes('DO_NOT_SAVE'));
  assert.equal(readOnlyRunBlocker({status:'running',questions:[{state:'pending',text:'真实提问'}]}).kind,'waiting_input');
  assert.equal(readOnlyRunBlocker({status:'running',tools:[{status:'waiting_approval'}]}).kind,'waiting_approval');
  const approval=readOnlyRunBlocker({status:'waiting_approval',approvals:[{id:'a',callId:'write',state:'pending',source:'PRIVATE_PATH',target:'PRIVATE_PATH'}]});
  assert(!JSON.stringify(approval).includes('PRIVATE_PATH'));
  assert.equal(readOnlyRunBlocker({status:'completed',questions:[{state:'answered'}],approvals:[{state:'executed'}]}),undefined);
});
await check('stop cleanup targets only the owned active run and never answers, approves or resumes',async()=>{
  let calls=0,reads=0;
  globalThis.window={omniEdu:{getXiaozhiSnapshot:async()=>{reads++;return {projection:{threadId:'s',turns:[{id:'owned',status:'waiting_input'}]}};},
    stopXiaozhi:async id=>{assert.equal(id,'s');calls++;return {ok:true};}}};
  try{assert.deepEqual(await stopOwnedChatRun({sessionId:'s',runId:'owned'}),{requested:true,ok:true});assert.equal(calls,1);assert.equal(reads,1);}
  finally{delete globalThis.window;}
});
await check('stop guard refuses other active runs, wrong sessions, missing owned runs and already terminal runs',async()=>{
  const cases=[
    [{threadId:'other',turns:[{id:'owned',status:'waiting_input'}]},'session_mismatch'],
    [{threadId:'s',turns:[{id:'different',status:'running'}]},'owned_run_missing'],
    [{threadId:'s',turns:[{id:'owned',status:'waiting_input'},{id:'different',status:'running'}]},'different_active_run'],
    [{threadId:'s',turns:[{id:'owned',status:'completed'}]},'already_terminal'],
  ];
  let calls=0;
  try{for(const [projection,reason] of cases){globalThis.window={omniEdu:{getXiaozhiSnapshot:async()=>({projection}),stopXiaozhi:async()=>{calls++;return {ok:true};}}};
    const result=await stopOwnedChatRun({sessionId:'s',runId:'owned'});assert.equal(result.requested,false);assert.equal(result.reason,reason);}
    assert.equal(calls,0);
  }finally{delete globalThis.window;}
});
await check('safe event metadata retains control and approval identity while excluding question bodies and paths',()=>withProbe(async({emit})=>{
  emit({kind:'control',control:{id:'q',kind:'question',state:'pending',text:'QUESTION_NOT_EVENT_LOGGED',options:['OPTIONS_NOT_EVENT_LOGGED']}});
  emit({kind:'approval',approval:{id:'a',callId:'write',state:'pending',source:'PATH_NOT_EVENT_LOGGED',target:'PATH_NOT_EVENT_LOGGED'}});
  assert.equal(window.__uiChatEvents[0].controlId,'q');assert.equal(window.__uiChatEvents[1].approvalId,'a');
  assert(!JSON.stringify(window.__uiChatEvents).includes('NOT_EVENT_LOGGED'));
}));
console.log(JSON.stringify({suite:'chat-paired-scripts',passed,modelCalls:0}));
