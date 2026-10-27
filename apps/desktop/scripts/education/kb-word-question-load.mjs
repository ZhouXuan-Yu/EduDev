import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
const {indexWordQuestions}=await import('../../src/main/assets/word-question-source.ts');
assert.equal(typeof globalThis.gc,'function','Run this retained-memory probe with node --expose-gc');
const p=(i,text)=>({id:'wb_'+i.toString(16).padStart(32,'0'),anchor:{part:'word/document.xml',path:'/document/body/p['+i+']'},kind:'paragraph',inlines:[{kind:'text',text}]}),document={schemaVersion:'xiaozhi.word-source.v1',parser:'word-ooxml.v1',assets:[],warnings:[],blocks:[...Array.from({length:2000},(_,i)=>p(i+1,'题前共用材料第'+i+'行。')),...Array.from({length:4000},(_,i)=>p(i+2001,`第${i+1}题 计算${i}+1。`))]};
globalThis.gc();const before=process.memoryUsage().heapUsed,start=performance.now(),index=indexWordQuestions(document),durationMs=performance.now()-start;globalThis.gc();const retainedBytes=process.memoryUsage().heapUsed-before;
assert.equal(index.total,4000);console.log(JSON.stringify({total:index.total,preambleBlocks:2000,retainedBytes,durationMs,scope:'Retained JS native source index for synthetic single Word structure; no OCR/AI/full import or 40GB claim'}));
assert(retainedBytes<80*1024*1024,'Native source index must not duplicate all 2,000 shared blocks into each of 4,000 question records');
const tail=index.summaries(3995,5);assert.equal(tail.length,5);assert.equal(tail[4].ordinal,4000);assert(tail.every(q=>!q.available&&q.issues.includes('too_many_spans')));console.log('PASS Large shared preamble retains bounded index memory and shows every oversized tail question explicitly');
