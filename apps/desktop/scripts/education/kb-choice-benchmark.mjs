import '../office-agent/register-source.mjs';
import {performance} from 'node:perf_hooks';
const {blindAnswerIssues,sourceComparisonQuestion}=await import('../../src/shared/material-ai-answer-review.ts');
const {pageTranscriptionAgrees}=await import('../../src/shared/material-ai-page.ts');
const stem='观察图1，按原题填写。\n(1)使用______（选涂“A电磁波”或“B超声波”）；\n(2)火星属于______（选涂“A恒星”、“B行星”或“C卫星”）；\n(3)运动过程______（选涂“A处于”或“B不处于”）平衡状态。';
const q=(number,spaced)=>({number:String(number),stem:spaced?stem.replace(/“([A-D])/gu,'“$1 '):stem,answer:spaced?'(1)A（电磁波）；(2)B（行星）；(3)B（不处于）':'(1)A；(2)B；(3)B',analysis:'选择对应选项。',answerOrigin:'ai_generated',analysisOrigin:'ai_generated',projection:Object.fromEntries(['statement','choices','subquestions','formulas','tables','figures'].map(k=>[k,{state:'provided',text:stem}]))});
const old={policy:'page-fragments.v3',answerReviewPolicy:'blind-answer-review.v1'},next={...old,choiceReviewPolicy:'choice-concordance.v1'},left=Array.from({length:16},(_,i)=>q(i+1,false)),right=Array.from({length:16},(_,i)=>q(i+1,true)),page=questions=>({schemaVersion:'xiaozhi.material-ai-page-fragments.v1',outcome:'questions',pageIssues:[],pageText:questions.map(q=>q.number+'. '+q.stem).join('\n')}),a=page(left),b=page(right);
let checksum=0;
function group(prompt){for(let i=0;i<16;i++){checksum+=blindAnswerIssues(left[i],right[i],prompt).length;checksum+=sourceComparisonQuestion(left[i],right[i],prompt).stem.length;checksum+=Number(pageTranscriptionAgrees(a,b,prompt));}}
function measure(prompt){for(let i=0;i<32;i++)group(prompt);const samples=[];for(let i=0;i<500;i++){const start=performance.now();group(prompt);samples.push((performance.now()-start)/16);}samples.sort((a,b)=>a-b);return{medianMsPerQuestion:samples[249],p95MsPerQuestion:samples[474],maxMsPerQuestion:samples.at(-1)};}
console.log(JSON.stringify({baseline:measure(old),choice:measure(next),questionsPerGroup:16,groups:500,checksum,scope:'Warm source/answer representation comparison plus repeated page transcript check; no source authentication, OCR, model, IPC, SQLite, retrieval, cold start or 40GiB workload. Batched time divided by 16 is not individual user latency.'}));
