import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
try{
 const {OfficeAgentTurn}=await server.ssrLoadModule('/src/renderer/components/office/OfficeAgentTurn.tsx');
 const {agentToolKind}=await server.ssrLoadModule('/src/renderer/components/office/agent-tool-kind.ts');
 const {applyXiaozhiEvent}=await server.ssrLoadModule('/src/shared/xiaozhi-projection.ts');
 const turn={id:'r',status:'running',items:[{id:'public',kind:'message',role:'assistant',phase:'commentary',text:'先核对题目条件。',traceOrder:0}],modelReasoning:[{id:'reasoning:1:0',source:'provider',text:'PROVIDER-ONLY-RAW',status:'streaming',startedAt:Date.now(),durationMs:100,traceOrder:1}]};
 const render=turn=>new JSDOM(renderToStaticMarkup(React.createElement(OfficeAgentTurn,{turn,sessionId:'s'}))).window.document;
 check('live process uses the same assistant body/content anatomy as an answer',()=>{
  const doc=render(turn),reasoning=doc.querySelector('[data-testid="reply-process-summary"]');
  assert(reasoning.matches('[data-slot="chat-message-assistant"]'));
  assert(reasoning.querySelector('[data-slot="chat-message-body"] [data-slot="chat-message-content"] [data-slot="markdown"]'));
  assert.equal(doc.querySelector('[data-testid="agent-trace"]').dataset.mode,'live-prose');
  assert.equal(doc.querySelectorAll('[data-testid="agent-trace-toggle"], [data-slot="chain-of-thought-step"]').length,0);
  assert(!doc.body.textContent.includes('PROVIDER-ONLY-RAW'));assert.equal(doc.querySelectorAll('[data-testid="model-reasoning"]').length,0);assert(!doc.body.textContent.includes('模型推理'));assert(!doc.body.textContent.includes('思考中'));
 });
 check('process width no longer carries the fixed demo width',()=>{
  const root=render(turn).querySelector('[data-testid="agent-trace-streaming"]');
  assert.equal(root.style.width,'');assert(!root.className.includes('420px'));
 });
 check('explicit answer phase replaces prose process with one closed disclosure before body',()=>{
  let t=applyXiaozhiEvent(turn,{kind:'assistant_start',segment:1});
  t=applyXiaozhiEvent(t,{kind:'assistant_phase',segment:1,phase:'final_answer',since:Date.now()});
  t=applyXiaozhiEvent(t,{kind:'text_delta',delta:'结果正文'});
  const doc=render(t);assert.equal(doc.querySelector('[data-testid="agent-trace-toggle"]').getAttribute('aria-expanded'),'false');
  assert(doc.querySelector('[data-testid="agent-trace-toggle"]').textContent.startsWith('处理过程'));
  assert.equal(doc.querySelectorAll('[data-testid="model-reasoning"]').length,0);
  assert.equal(doc.querySelector('[data-testid="agent-reply-body"]').textContent,'结果正文');
 });
 check('real tool identity survives projection and translated labels do not change glyphs',()=>{
  const t=applyXiaozhiEvent({id:'r',status:'running',items:[]},{kind:'tool_start',tool:'office_read_attachment',callId:'read1',sequence:1});
  assert.equal(t.items[0].toolName,'office_read_attachment');assert.equal(agentToolKind({...t.items[0],label:'custom translation'}),'file-read');
 });
 check('file list/read/write and web search/read have distinct operation glyphs',()=>{
  const ids=['office_list_attachments','office_read_attachment','office_edit_text','office_web_search','office_web_fetch','ask_teacher','education_compute'];
  const t={...turn,modelReasoning:[],items:ids.map((toolName,i)=>({id:String(i),kind:'tool',toolName,label:toolName,status:'inProgress',traceOrder:i}))};
  const glyphs=[...render(t).querySelectorAll('[data-testid="agent-tool-glyph"]')].map(e=>e.dataset.toolKind);
  assert.deepEqual(glyphs,['directory','file-read','file-write','web-search','web-read','question','execution']);
  assert.equal(new Set(glyphs).size,7);
 });
 check('old or unknown tool metadata stays generic rather than guessing from Chinese',()=>{
  assert.equal(agentToolKind({kind:'tool',id:'old',label:'读取文件'}),'tool');
  assert.equal(agentToolKind({kind:'tool',id:'unknown',toolName:'constructor'}),'tool');
  assert.equal(agentToolKind({kind:'tool',id:'not-registered',toolName:'bash',label:'执行命令'}),'tool');
 });
 check('failure status does not erase the actual tool glyph',()=>{
  const doc=render({...turn,modelReasoning:[],items:[{id:'failed',kind:'tool',toolName:'office_read_text',label:'读取资料',status:'failed'}]});
  assert.equal(doc.querySelector('[data-testid="agent-tool-glyph"]').dataset.toolKind,'file-read');
  assert(doc.body.textContent.includes('未完成'));
 });
 console.log(JSON.stringify({suite:'desktop-process-boundaries',passed}));
}finally{await server.close();}
