import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const {sourceComparisonQuestion,BLIND_ANSWER_REVIEW}=await import('../../src/shared/material-ai-answer-review.ts');
const {sourceCropQuestionAgrees}=await import('../../src/shared/material-ai-page-regions.ts');
const q={number:'1',stem:'如图求物体移动距离。',answer:'15 cm',analysis:'依据题意列式求得15 cm。',subject:'物理',grade:'八年级',knowledgePoint:'运动',questionType:'计算题',difficulty:'medium',answerOrigin:'ai_generated',analysisOrigin:'ai_generated',requiresImage:true,issues:[],projection:Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'||k==='figures'?'provided':'not_applicable',text:k==='statement'?'如图求物体移动距离。':k==='figures'?'原图1':''}]))};
const prompt={policy:'page-fragments.v3',answerReviewPolicy:BLIND_ANSWER_REVIEW},items=Array.from({length:32},(_,i)=>({...q,number:String(i+1)}));
const before=(a,b)=>sourceCropQuestionAgrees(a,b),after=(a,b)=>sourceCropQuestionAgrees(sourceComparisonQuestion(a,b,prompt),b);
function bench(fn){let hits=0;const samples=[];for(let i=0;i<1200;i++){const start=performance.now();for(const a of items)hits+=Number(fn(a,a));if(i>=200)samples.push((performance.now()-start)/items.length);}samples.sort((a,b)=>a-b);assert.equal(hits,1200*items.length);return{batches:1000,questionsPerBatch:items.length,perQuestionP50Ms:samples[500],perQuestionP95Ms:samples[950]};}
const changed={...q,analysis:'按运动关系计算，所得距离是15 cm。'};assert(!before(q,changed));assert(after(q,changed));
console.log(JSON.stringify({scope:'Synthetic 32-question warm source-field comparison only; no file I/O, OCR, source authentication, provider, IPC, retrieval or 40GiB performance claim.',before:bench(before),after:bench(after),rewordedExplanation:{before:before(q,changed),after:after(q,changed)}}));
