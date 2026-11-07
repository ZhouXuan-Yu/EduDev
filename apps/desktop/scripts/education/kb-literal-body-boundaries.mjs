import assert from 'node:assert/strict';
import {partitionLiteralBody} from '../../src/shared/material-ai-host-partition.ts';
import {HOST_BODY_READING,HOST_BODY_RESPONSE,literalReadingPrompt,deriveLiteralPageResponse} from '../../src/shared/material-ai-literal.ts';
import {parseAiPageResponse,validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {sourceCropKinds} from '../../src/shared/material-ai-owned-crops.ts';
import {completeMaterialAi} from '../../src/main/assets/material-ai-provider.ts';
import {hostWire} from './kb-host-partition-boundaries.mjs';
const wire=response=>{const value=hostWire(response);value.schemaVersion=HOST_BODY_RESPONSE;for(const q of value.questions)for(const c of q.crops)delete c.publication;return value;};
function inputFor(input){const pagePrompt=literalReadingPrompt(input.pagePrompt,true,HOST_BODY_READING),cropReview=structuredClone(input.cropReview);cropReview.schemaVersion='xiaozhi.material-ai-crop-review.v3';for(const q of cropReview.questions){const kinds=sourceCropKinds(pagePrompt.blocks,q.crops.map(c=>c.blockIds));q.crops.forEach((c,i)=>{c.kind=kinds[i];});}return{...input,pagePrompt,cropReview};}
export async function runLiteralBodyChecks({check,sourceContentFixtures,MaterialAiRepository}){
 const run=fn=>sourceContentFixtures.enabled(async()=>{const f=await sourceContentFixtures.fixture();try{await f.run();await fn(f);}finally{await f.dispose();}});
 await check('Host body keeps unknown badges and inline conditions without inventing missing question content',()=>{
  for(const text of ['1. 学科融合 统计 「2025某省中考」完整条件和选项。','1. 核心素养 科学思维 [2026月考]求温度。','1.（质量2kg）求速度。','1.「2026某省中考热量为五千焦耳」求比热容。','1.2kg物体移动。']){
   const r=partitionLiteralBody(text,'body','1',true);assert(!r.metadataIssue);assert.equal(r.parts.map(p=>p.text).join(''),text);assert(!r.parts.some(p=>p.role==='publication'));assert(r.parts.some(p=>p.role==='body'));
  }
  const r=partitionLiteralBody('1.「2025某省中考，★☆☆」求速度。','body','1',true);assert.deepEqual(r.parts.map(p=>p.role),['marker','publication','body']);
 });
 await check('Host body still flags wrong parents and empty bodies and preserves complete standalone figure text',()=>{
  for(const text of ['2.另一题正文','1.',''])assert(partitionLiteralBody(text,'body','1',true).metadataIssue);
  for(const text of ['','甲 −2V 图1']){const r=partitionLiteralBody(text,'figure','1',false);assert(!r.metadataIssue);assert.equal(r.parts.map(p=>p.text).join(''),text);assert(r.parts.every(p=>p.role==='figure'));}
 });
 await check('New v4 wire derives unknown prefix as complete literal body without losing any original characters',()=>run(f=>{
  const input=inputFor(f.inputs[1]),value=wire(parseAiPageResponse(f.raw[1]));assert(validAiPagePrompt(input.pagePrompt));
  const crop=value.questions[1].crops[0],prefix='专题实践 ';crop.text=prefix+crop.text;value.pageText=prefix+value.pageText;
  const result=parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(value),input.previous,input.cropReview,true,HOST_BODY_READING));
  assert(result.questions[1].stem.startsWith(prefix));assert.deepEqual(result.questions[1].issues,[]);assert.equal(result.readings[1].crops[0].text,crop.text);
 }));
 await check('V4 rejects old publication hints and forged source roles while retaining actual text and image uncertainty',()=>run(f=>{
  const input=inputFor(f.inputs[1]),value=wire(parseAiPageResponse(f.raw[1]));
  for(const change of [v=>v.questions[0].crops[0].publication=true,v=>v.questions[0].crops[0].index=7,v=>v.questions[0].answer={text:'not printed in owned source',origin:'source'}]){const v=structuredClone(value);change(v);assert.throws(()=>deriveLiteralPageResponse(JSON.stringify(v),input.previous,input.cropReview,true,HOST_BODY_READING),/invalid_response/);}
  value.questions[1].crops[0].issues=['uncertain_ocr'];const held=parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(value),input.previous,input.cropReview,true,HOST_BODY_READING));assert(held.questions[1].issues.includes('uncertain_ocr'));assert.deepEqual(held.questions[0].issues,[]);
 }));
 await check('Actual v4 provider/executor archives a complete sibling and holds a genuinely uncertain reading after cold validation',()=>sourceContentFixtures.enabled(async()=>{
  const keys=['OMNI_EDU_AI_LITERAL_READING','OMNI_EDU_AI_HOST_PARTITIONS','OMNI_EDU_AI_HOST_BODY'],previous=keys.map(k=>process.env[k]),fetch=globalThis.fetch;keys.forEach(k=>process.env[k]='1');
  const f=await sourceContentFixtures.fixture(),original=f.repo.runtime.complete;
  try{
   f.repo.runtime.complete=async(input,signal)=>{const response=JSON.parse(await original(input,signal));if(!input.previous)return JSON.stringify(response);const value=wire(response);if(input.verification)value.questions[1].crops[0].issues=['uncertain_ocr'];
    globalThis.fetch=async(_url,options)=>{const request=JSON.parse(options.body),payload=JSON.parse(request.messages[1].content[0].text);assert(request.messages[0].content.includes(HOST_BODY_RESPONSE));assert(request.messages[0].content.includes('不输出publication'));assert(payload.cropReview.questions.every(q=>q.crops.every(c=>!Object.hasOwn(c,'publication'))));if(input.verification)assert(payload.firstDraft.questions.every(q=>typeof q.answer==='object'&&!Object.hasOwn(q,'answerOrigin')));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));};return completeMaterialAi(input,signal);
   };
   await f.run();const rows=f.db.prepare('SELECT q.*,m.number FROM question_bank_items q JOIN material_ai_members m ON q.id=m.question_id ORDER BY m.number').all();assert.equal(rows.length,2);assert.equal(JSON.parse(rows[0].archive_json).state,'ai_final');assert(JSON.parse(rows[0].document_json).source.parserVersion.includes(HOST_BODY_READING));assert.equal(JSON.parse(rows[1].archive_json).state,'ai_needs_review');assert.equal(rows[1].document_json,'');assert.equal(f.state.calls,3);await new MaterialAiRepository(f.host).validate(await f.question());assert.equal(f.state.calls,3);
  }finally{globalThis.fetch=fetch;keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});await f.dispose();}
 }));
}
