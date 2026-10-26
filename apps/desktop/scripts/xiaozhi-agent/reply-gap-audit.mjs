// Read-only renderer/event audit. Synthetic event fixtures are not provider or teacher acceptance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.resolve(desktop,'../../docs/audit/chat-ui-2026-10-24');
fs.mkdirSync(output,{recursive:true});
const server=await createServer({root:desktop,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
try{
  const {applyXiaozhiEvent}=await server.ssrLoadModule('/src/shared/xiaozhi-projection.ts');
  const {agentTraceTimeline}=await server.ssrLoadModule('/src/renderer/components/office/agent-trace-timeline.ts');
  const {OfficeAgentTurn}=await server.ssrLoadModule('/src/renderer/components/office/OfficeAgentTurn.tsx');
  let turn={id:'audit-run',status:'running',items:[]};let sequence=0;
  const states=[];
  const event=e=>turn=applyXiaozhiEvent(turn,{sessionId:'audit-session',runId:turn.id,traceOrder:(sequence+1)*10,sequence:++sequence,...e});
  const inspect=name=>{
    const html=renderToStaticMarkup(React.createElement(OfficeAgentTurn,{turn,sessionId:'audit-session'}));
    const doc=new JSDOM(html).window.document;
    const state={name,projectedOrder:agentTraceTimeline(turn).filter(e=>e.kind==='reasoning'||e.item.kind==='tool').map(e=>e.id),status:turn.status,phases:turn.items.filter(i=>i.role==='assistant').map(i=>i.phase),
      expanded:[...doc.querySelectorAll('[data-testid="agent-trace-toggle"]')].map(e=>e.getAttribute('aria-expanded')),
      body:[...doc.querySelectorAll('[data-testid="agent-reply-body"]')].map(e=>e.textContent),
      process:[...doc.querySelectorAll('[data-testid="reply-process-summary"]')].map(e=>e.textContent),
      order:[...doc.querySelectorAll('[data-testid="model-reasoning"], [data-testid="office-tool-step"]')].map(e=>e.dataset.reasoningId||e.dataset.itemId)};
    states.push(state);console.log(JSON.stringify(state));return state;
  };
  const block=n=>({id:`reasoning:${n}:0`,source:'provider',text:`第${n}段事件夹具`,status:'completed',traceOrder:n===1?15:75,startedAt:Date.now()-1000,durationMs:1000});
  event({kind:'assistant_start',segment:1});event({kind:'model_reasoning',block:block(1)});event({kind:'text_delta',delta:'先核对资料。'});
  const before=inspect('工具前说明稳定留在过程');
  event({kind:'tool_start',callId:'t1',tool:'office_list_attachments'});
  const after=inspect('工具开始后说明位置保持');
  event({kind:'tool_end',callId:'t1',success:true});event({kind:'assistant_start',segment:2});event({kind:'model_reasoning',block:block(2)});event({kind:'assistant_phase',segment:2,phase:'final_answer',since:Date.now()});event({kind:'text_delta',delta:'最终正文正在输出。'});
  const body=inspect('正文流式时整轮过程已收起');
  event({kind:'assistant_end',segment:2,final:true});const modelEnd=inspect('正文已结束且无需等待宿主终态');
  event({kind:'status',status:'completed',finishedAt:Date.now()});const terminal=inspect('宿主终态维持收起');
  assert.equal(before.body.length,0);assert(before.process.some(t=>t.includes('先核对资料')));
  assert(after.process.some(t=>t.includes('先核对资料')));
  assert(body.expanded.every(v=>v==='false'));assert.equal(body.expanded.length,1);
  assert(modelEnd.expanded.every(v=>v==='false'));
  assert(terminal.expanded.every(v=>v==='false'));
  assert.deepEqual(body.projectedOrder,['reasoning:1:0','t1','reasoning:2:0']);
  const report={suite:'reply-gap-audit',success:true,type:'Current renderer SSR and synthetic SDK event fixtures; no provider request or Electron-flow acceptance',resolvedGaps:['public action text stays in process','aggregate folds before final body without waiting for host terminal','reasoning and tools follow capture order'],states};
  fs.writeFileSync(path.join(output,'event-phase-after.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:true,resolvedGaps:report.resolvedGaps.length,output}));
}finally{await server.close();}
