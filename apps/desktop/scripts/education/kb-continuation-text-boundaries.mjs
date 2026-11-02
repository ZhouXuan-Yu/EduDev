import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fixture} from './kb-cross-page-boundaries.mjs';
import {MaterialAiRepository} from '../../src/main/assets/material-ai-repository.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';
import {continuationPrefix,validPageContinuation} from '../../src/shared/material-ai-continuation.ts';
import {continuationTextLines,continuationTextSignature,deriveContinuationTextProof,validContinuationTextProof,continuationTextAgrees} from '../../src/shared/material-ai-continuation-text.ts';
import {completeMaterialAi} from '../../src/main/assets/material-ai-provider.ts';

const lines=[
 {text:'(2)当x²+x₁=-2m/s，变量x y与数列1 2保持不变，下列处理方式可行的是',box:[.05,.2,.3,.3]},
 {text:'。（不定项）',box:[.295,.2,.6,.3]},
 {text:'A.保持原条件且不额外改变任何因素，再比较观察结果',box:[.1,.5,.8,.6]},
 {text:'B.只改变题中明确允许改变的那个因素并详细说明依据',box:[.1,.7,.8,.8]},
],text=lines.map(l=>l.text).join('\n'),model=lines.map((l,i)=>l.text+(i===0?'______':'')).join('\n').replace('。（不定项）','。(不定项)'),width=1000,height=500;
const image=()=>new Uint8Array(width*height*4).fill(255),ink=(pixels,x0=290,x1=390,y0=147,y1=151)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}return pixels;},bitmap=ink(image()),proof=deriveContinuationTextProof(text,lines,bitmap,width,height);
let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};

await check('Only actual isolated baseline ink proves the OCR-missed printed blank',()=>{assert(proof);assert.equal(proof.gaps.length,1);assert.equal(proof.gaps[0].afterLine,0);assert(validContinuationTextProof(proof,text));assert(continuationTextAgrees(text,proof,'完整父题前文\n'+model,text));assert(continuationTextAgrees(text,proof,model,text.replace('下列处理','下列\n处理').replaceAll('（','(').replaceAll('）',')')));assert(continuationTextAgrees(text,proof,model,model));});
await check('Digits, units, sign, exponents, subscripts, variable/number boundaries, negation and choices remain exact',()=>{
 for(const [from,to] of [['-2','2'],['-2','−2'],['-2','-3'],['m/s','m/h'],['x²','x2'],['x₁','x1'],['x y','xy'],['1 2','12'],['不变','改变'],['A.','C.'],['比较观察结果','比较结果']]){
  assert(!continuationTextAgrees(text,proof,model.replace(from,to),text),from+' model');
  assert(!continuationTextAgrees(text,proof,model,text.replace(from,to)),from+' independent OCR');
 }
 assert.notEqual(continuationTextSignature('2 m/s'),continuationTextSignature('2m/s'));
 assert.notEqual(continuationTextSignature('甲 乙'),continuationTextSignature('甲乙'));
});
await check('Missing prefix, tail, choice or printed blank and extra neighbouring text are not forgiven',()=>{
 for(const bad of [model.replace('______',''),model.replace('______','_'),model.replace('______','__'),model.replace('______','_'.repeat(65)),model.replace('______','')+'______',model.slice(4),model.slice(0,-5),model+'\n3.下一题',model+'\n'+model,model.replace(lines[2].text,'')])assert(!continuationTextAgrees(text,proof,bad,text));
 assert(!continuationTextAgrees(text,proof,model,text+'\n邻题内容'));
});
await check('A blank cannot be inferred from model spelling, a mathematical minus, noisy rule or a different OCR seam',()=>{
 const empty=deriveContinuationTextProof(text,lines,image(),width,height);assert.equal(empty.gaps.length,0);assert(!continuationTextAgrees(text,empty,model,text));
 for(const pixels of [ink(image(),290,390,120,124),ink(ink(image()),300,360,130,140),ink(ink(image()),290,390,138,141)])assert.equal(deriveContinuationTextProof(text,lines,pixels,width,height).gaps.length,0);
 const variable=structuredClone(lines);variable[0].text='(2)变量x';assert.equal(deriveContinuationTextProof(variable.map(l=>l.text).join('\n'),variable,bitmap,width,height).gaps.length,0);
 const foreign=structuredClone(lines);foreign[1].box=[.01,.6,.6,.7];assert.equal(deriveContinuationTextProof(text,foreign,bitmap,width,height).gaps.length,0);
});
await check('Versioned proof rejects malformed trees, accessors, oversized data and invalid geometry without invoking getters',()=>{
 for(const change of [p=>p.schemaVersion='wrong',p=>p.extra=true,p=>p.lines[0].text+='伪造',p=>p.lines[0].box[2]=NaN,p=>p.gaps[0].afterLine=3,p=>p.gaps.push({...p.gaps[0]}),p=>p.gaps[0].box=[1,0,0,1],p=>p.lines=new Array(4)]){const p=structuredClone(proof);change(p);assert(!validContinuationTextProof(p,text));}
 const getter=Object.defineProperty({...proof},'lines',{enumerable:true,get(){throw Error('getter must not run');}});assert(!validContinuationTextProof(getter,text));
 assert.equal(deriveContinuationTextProof(text,lines,bitmap,2402,height),undefined);assert.equal(deriveContinuationTextProof(text,lines,bitmap.subarray(1),width,height),undefined);
 const controller=new AbortController();controller.abort();assert.throws(()=>deriveContinuationTextProof(text,lines,bitmap,width,height,controller.signal),/abort/i);
});

const envKeys=['OMNI_EDU_AI_CONTINUATION_TEXT','OMNI_EDU_AI_CROSS_PAGE','OMNI_EDU_AI_OWNED_CROP_MARGINS','OMNI_EDU_AI_CORRECTION_REVIEW'],saved=envKeys.map(k=>process.env[k]);
for(const key of envKeys.slice(1))process.env[key]='1';
async function prepared({version=2,modelText=model,localText=text}={}){
 process.env.OMNI_EDU_AI_CONTINUATION_TEXT=version===2?'1':'0';
 const f=await fixture({prefixText:text,modelPrefix:modelText}),original=f.repo.runtime.blocks,complete=f.repo.runtime.complete,inspect=f.repo.runtime.inspectCrop;
 f.repo.runtime.blocks=async source=>{const r=await original(source);if(source.page===2){const plan=continuationPrefix('1. 前题',[{blockId:'block-1',text:'1. 前题'}],text+'\n2. 下一道题的完整题干。',r.blocks,r.blockTexts);assert(plan);const [a,b,c,d]=plan.box;r.lines=lines.map((line,i)=>{const [x,y,right,bottom]=line.box,quad=[[a+x*(c-a),b+y*(d-b)],[a+right*(c-a),b+y*(d-b)],[a+right*(c-a),b+bottom*(d-b)],[a+x*(c-a),b+bottom*(d-b)]];return{id:'line-'+(i+1),kind:'text',needsReview:true,text:line.text,score:.99,normalizedQuad:quad,quad:quad.map(([x,y])=>[x*r.blocks.width,y*r.blocks.height])};});}return r;};
 // The model, primary PNG and local OCR are controlled here. Actual nativeImage PNG proof is a separate natural-source check.
 f.host.inspectContinuationText=async(extra,sourceLines,_bytes,signal)=>deriveContinuationTextProof(extra.text,sourceLines?continuationTextLines(extra,sourceLines):extra.textProof.lines,bitmap,width,height,signal);
 f.repo.runtime.inspectCrop=async(...args)=>{const q=await inspect(...args);return q.text===text?{...q,text:localText}:q;};
 f.repo.runtime.complete=async input=>{const raw=JSON.parse(await complete(input));for(const q of raw.questions)q.projection.choices={state:'provided',text:q.stem};return JSON.stringify(raw);};
 const writer=f.host.writer;f.host.writer=(action,before)=>writer(()=>action(new MaterialAiRepository(f.host)),before);
 return f;
}
try{
 await check('New v2 original SQLite executor retains full stem and both images, uses isolated writer/cold instances to validate the same proof without configured transport or more calls',async()=>{const f=await prepared();try{await f.create();const unit=JSON.parse(f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json);assert.equal(unit.pagePrompt.continuation.schemaVersion,'page-continuation.v2');assert(validPageContinuation(unit.pagePrompt.continuation));await f.finish();const q=await f.question();assert(archiveEligible(q),JSON.stringify(q.archive));assert(q.stem.includes('______'));assert.equal(f.state.calls,3);const cold=new MaterialAiRepository(f.host);await cold.validate(q);assert.equal(f.state.calls,3);assert.deepEqual(q.document.blocks.filter(b=>b.kind==='image').map(b=>b.anchors[0].page),[1,2]);}finally{await f.dispose();}});
 await check('Old v1 retains its original strict failure even when the new creation flag later changes',async()=>{const f=await prepared({version:1});try{await f.create();process.env.OMNI_EDU_AI_CONTINUATION_TEXT='1';await f.finish();assert(!archiveEligible(await f.question()));const unit=JSON.parse(f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json);assert.equal(unit.pagePrompt.continuation.schemaVersion,'page-continuation.v1');assert.equal(unit.pagePrompt.continuation.textProof,undefined);assert.equal(f.state.calls,3);}finally{await f.dispose();}});
 await check('Full independent-prefix OCR disagreement or model condition changes remain held through all three drafts',async()=>{for(const changes of [{localText:text.replace('-2','-3')},{modelText:model.replace('不变','改变')}]){const f=await prepared(changes);try{await f.create();await f.finish();assert(!archiveEligible(await f.question()));assert.equal(f.state.calls,3);}finally{await f.dispose();}}});
 await check('Changed rule proof, missing verifier and changed pixels revoke archived eligibility without cloud replay',async()=>{for(const mode of ['rule','missing_verifier','pixel']){const f=await prepared();try{await f.create();await f.finish();const q=await f.question();assert(archiveEligible(q));if(mode==='rule'){const row=f.db.prepare('SELECT input_json FROM material_ai_units').get(),u=JSON.parse(row.input_json);u.pagePrompt.continuation.textProof.gaps[0].box[0]+=.01;f.db.prepare('UPDATE material_ai_units SET input_json=?').run(JSON.stringify(u));}else if(mode==='missing_verifier')delete f.host.inspectContinuationText;else f.host.inspectContinuationText=async(extra,_lines,_bytes,signal)=>deriveContinuationTextProof(extra.text,extra.textProof.lines,image(),width,height,signal);await assert.rejects(f.repo.validate(q),/source_changed/);assert.equal(f.state.calls,3);}finally{await f.dispose();}}});
 await check('V2 provider uses frozen policy and necessary prefix only; OCR coordinates and pixel proof stay local',async()=>{const f=await prepared(),ordinary=globalThis.fetch;try{await f.create();await f.finish();let sent;globalThis.fetch=async(_url,o)=>{sent=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json}}]}),{status:200});};await completeMaterialAi(f.inputs[0],new AbortController().signal);const wire=JSON.parse(sent.messages[1].content[0].text).pageContext.continuation;assert.equal(wire.policy,'page-continuation.v2');assert(!Object.hasOwn(wire,'textProof'));assert(!Object.hasOwn(wire,'lines'));assert.match(sent.messages[0].content,/独立从完整两页推导/);}finally{globalThis.fetch=ordinary;await f.dispose();}});
 const times=[];for(let i=0;i<10;i++){const start=performance.now();deriveContinuationTextProof(text,lines,bitmap,width,height);times.push(performance.now()-start);}console.log(JSON.stringify({success:true,passed,maxControlledPixelProofMs:Math.max(...times),scope:'Pure pixel/text boundaries plus original durable executor with controlled model/PNG/OCR. Preceding 109 legacy + 11 cross-page checks run too. Not natural answer correctness or 40GB/P95.'}));
}finally{envKeys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
