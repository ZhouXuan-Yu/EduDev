import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try{
 const {createModelReasoningTrace}=await server.ssrLoadModule('/src/main/xiaozhi-agent/model-reasoning.ts');
 const {readModelReasoning,MAX_REASONING_TEXT}=await server.ssrLoadModule('/src/shared/model-reasoning.ts');
 const {applyXiaozhiEvent}=await server.ssrLoadModule('/src/shared/xiaozhi-projection.ts');
 const {OfficeAgentTrace}=await server.ssrLoadModule('/src/renderer/components/office/OfficeAgentTrace.tsx');
 const {AgentProcess}=await server.ssrLoadModule('/src/renderer/components/office/AgentProcess.tsx');
 const {splitAgentTrace}=await server.ssrLoadModule('/src/renderer/components/office/agent-trace.ts');
 const base={id:'r',status:'running',items:[]};
 const block={id:'reasoning:1:0',source:'provider',text:'先核对条件，再使用等式性质。',startedAt:Date.now(),durationMs:100,status:'streaming'};
 await check('provider reasoning never becomes a body or export item',()=>{
  let t=applyXiaozhiEvent(base,{kind:'assistant_start',segment:1,sequence:1});
  t=applyXiaozhiEvent(t,{kind:'model_reasoning',block,sequence:2});t=applyXiaozhiEvent(t,{kind:'text_delta',delta:'答案：x=3',sequence:3});
  t=applyXiaozhiEvent(t,{kind:'assistant_phase',segment:1,phase:'final_answer',since:Date.now(),sequence:4});
  assert.equal(t.modelReasoning[0].text,block.text);assert.equal(t.items.length,1);assert.equal(splitAgentTrace(t).body[0].text,'答案：x=3');
 });
 await check('validated snapshots replace instead of duplicate streamed text',()=>{
  let t=applyXiaozhiEvent(base,{kind:'model_reasoning',block});t=applyXiaozhiEvent(t,{kind:'model_reasoning',block:{...block,text:block.text+'已核对。',status:'completed',durationMs:300}});
  assert.equal(t.modelReasoning.length,1);assert.equal(t.modelReasoning[0].durationMs,300);
 });
 await check('old and untrusted reasoning metadata is rejected',()=>{
  assert.deepEqual(readModelReasoning(undefined),[]);assert.deepEqual(readModelReasoning({version:2,blocks:[block]}),[]);
  for(const invalid of [{source:'template'},{id:'bad'},{durationMs:-1},{startedAt:NaN},{text:42}])assert.deepEqual(readModelReasoning({version:1,blocks:[{...block,...invalid}]}),[]);
 });
 await check('adapter redacts complete cumulative text and credentials before emitting',async()=>{
  const events=[];const trace=createModelReasoningTrace({secret:'sk-secret1234567890',sanitize:async s=>s.replaceAll('学生张三','学生A'),emit:b=>events.push(b)});
  trace.delta(1,0,'学生张');trace.delta(1,0,'三，凭证sk-secret1234567890。');trace.close();await trace.finish('completed');
  assert.equal(events.at(-1).status,'completed');assert.equal(events.at(-1).text,'学生A，凭证[已隐去凭证]。');
 });
 await check('sanitization failure hides raw content and preserves failure state',async()=>{
  const events=[];const trace=createModelReasoningTrace({secret:'secret',sanitize:async()=>{throw Error('PRIVATE');},emit:b=>events.push(b)});
  trace.delta(1,0,'PRIVATE');await trace.finish('completed');assert.equal(events.at(-1).status,'failed');assert(!events.at(-1).text.includes('PRIVATE'));
 });
 await check('backpressure coalesces updates and flushes terminal state before returning',async()=>{
  const events=[];let release;const wait=new Promise(r=>release=r);let calls=0;
  const trace=createModelReasoningTrace({secret:'key',sanitize:async s=>{if(++calls===1)await wait;return s;},emit:b=>events.push(b)});
  trace.delta(1,0,'甲');trace.delta(1,0,'乙');trace.close();release();await trace.finish('completed');
  assert.equal(events.at(-1).text,'甲乙');assert.equal(events.at(-1).status,'completed');assert(calls<=2);
 });
 await check('multiple native reasoning blocks remain distinct across actual tools',async()=>{
  const events=[];const trace=createModelReasoningTrace({secret:'key',sanitize:async s=>s,emit:b=>events.push(b)});
  trace.delta(1,0,'读取前');trace.close();await trace.finish('completed');trace.delta(2,0,'实读后');await trace.finish('completed');
  assert.equal(new Set(events.map(b=>b.id)).size,2);assert.equal(events.at(-1).id,'reasoning:2:0');
 });
 await check('continuous deltas cannot starve visible streaming behind sanitization',async()=>{
  const events=[],releases=[];const trace=createModelReasoningTrace({secret:'key',sanitize:s=>new Promise(resolve=>releases.push(()=>resolve(s))),emit:b=>events.push(b)});
  trace.delta(1,0,'甲');trace.delta(1,0,'乙');releases.shift()();await new Promise(r=>setTimeout(r,0));
  assert(events.some(b=>b.status==='streaming'&&b.text==='甲'));trace.close();
  while(releases.length){releases.shift()();await new Promise(r=>setTimeout(r,0));}
  await trace.finish('completed');assert.equal(events.at(-1).text,'甲乙');
 });
 await check('stopped reasoning is preserved as incomplete',async()=>{
  const events=[];const trace=createModelReasoningTrace({secret:'key',sanitize:async s=>s,emit:b=>events.push(b)});
  trace.delta(1,0,'已收到部分');trace.close('interrupted');trace.close();await trace.finish('interrupted');assert.equal(events.at(-1).status,'interrupted');assert.equal(events.at(-1).text,'已收到部分');
 });
 await check('total reasoning text and block count are bounded',async()=>{
  const events=[];const trace=createModelReasoningTrace({secret:'key',sanitize:async s=>s,emit:b=>events.push(b)});
  trace.delta(1,0,'甲'.repeat(MAX_REASONING_TEXT+200));await trace.finish('completed');assert.equal(events.at(-1).text.length,MAX_REASONING_TEXT);assert(events.at(-1).truncated);
  assert.equal(readModelReasoning({version:1,blocks:Array.from({length:40},(_,i)=>({...block,id:`reasoning:${i}:0`}))}).length,32);
 });
 await check('cold metadata retains duration, source and partial state exactly',()=>{
  const saved={version:1,blocks:[{...block,status:'interrupted'}]};assert.deepEqual(readModelReasoning(JSON.parse(JSON.stringify(saved))),saved.blocks);
 });
 await check('only actual reasoning activates the original streaming component',()=>{
  const render=t=>renderToStaticMarkup(React.createElement(OfficeAgentTrace,{turn:t,children:null}));
  assert(!render(base).includes('chain-of-thought--streaming'));const html=render({...base,modelReasoning:[block]});
  assert.match(html,/data-testid="agent-trace"/);assert(!html.includes('data-testid="agent-raw-reasoning"'));assert(html.includes('data-testid="model-reasoning"'));assert.match(html,/data-mode="live-prose"/);assert(!html.includes('data-testid="agent-trace-toggle"'));
  assert(!render({...base,status:'completed',modelReasoning:[{...block,status:'completed'}]}).includes('chain-of-thought--streaming'));
 });
 await check('missing reasoning is honest and separate from execution states',()=>{
  const html=renderToStaticMarkup(React.createElement(OfficeAgentTrace,{turn:{...base,status:'failed'},children:React.createElement('p',null,'等待模型回复')}));
  assert.equal(html,'');
 });
 await check('blank reasoning does not create empty disclosure rows',()=>{
  const html=renderToStaticMarkup(React.createElement(OfficeAgentTrace,{turn:{...base,modelReasoning:['',' \t\r\n'].map((text,i)=>({...block,id:`reasoning:${i}:0`,text}))}}));assert.equal(html,'');
 });
 await check('multiple real blocks share one expanded official trace',()=>{
  const html=renderToStaticMarkup(React.createElement(OfficeAgentTrace,{turn:{...base,modelReasoning:[block,{...block,id:'reasoning:2:0',text:'Second unfinished'}]}}));assert.equal((html.match(/data-testid="agent-trace-toggle"/g)||[]).length,0);assert(new JSDOM(html).window.document.body.textContent.includes('Second unfinished'));assert.equal(new JSDOM(html).window.document.querySelectorAll('[data-testid="model-reasoning"]').length,2);
 });
 await check('accepted compact public process uses real evidence only',()=>{
  const html=renderToStaticMarkup(React.createElement(AgentProcess,{sessionId:'s',turn:{...base,modelReasoning:[block],items:[{id:'t',kind:'tool',label:'实读附件',status:'completed',resultSummary:{version:1,scope:'read',text:'真实工具回执'}}]}}));
  assert(!html.includes('420px'));assert(html.includes('aria-expanded="false"'));assert(html.includes('agent-tool-glyph'));assert(html.includes('data-testid="agent-trace"'));assert(!html.includes('data-testid="execution-trace"'));assert(!html.includes('Generated design'));assert(!html.includes('reasoning-preview'));
 });
 const {OfficeAgentTurn}=await server.ssrLoadModule('/src/renderer/components/office/OfficeAgentTurn.tsx');
 const {agentTraceTimeline}=await server.ssrLoadModule('/src/renderer/components/office/agent-trace-timeline.ts');
 await check('production turn passes streaming reasoning to its actual process component',()=>{
  const html=renderToStaticMarkup(React.createElement(OfficeAgentTurn,{sessionId:'s',turn:{...base,modelReasoning:[block]}}));
  assert(html.includes('data-testid="model-reasoning"'));
  assert(new JSDOM(html).window.document.body.textContent.includes(block.text));
  assert(!html.includes('data-testid="reply-waiting"'));
 });
 await check('reasoning and actual tools retain captured order and old history stays readable',()=>{
  const tool={id:'tool',kind:'tool',toolName:'office_list_files',traceOrder:20,status:'completed'};
  const entries=agentTraceTimeline({...base,items:[tool],modelReasoning:[{...block,traceOrder:10},{...block,id:'reasoning:2:0',traceOrder:30}]});
  assert.deepEqual(entries.map(e=>e.id),[block.id,'tool','reasoning:2:0']);
  assert.equal(agentTraceTimeline({...base,modelReasoning:[block]}).length,1);
 });
 await check('stopped provider text remains readable with an incomplete marker',()=>{
  const html=renderToStaticMarkup(React.createElement(AgentProcess,{sessionId:'s',turn:{...base,status:'interrupted',modelReasoning:[{...block,status:'interrupted'}]}}));
  assert(new JSDOM(html).window.document.body.textContent.includes(block.text));
  assert(html.includes('此段思考未完成'));
 });
 console.log(JSON.stringify({suite:'model-reasoning-boundaries',passed}));
}finally{await server.close();}
