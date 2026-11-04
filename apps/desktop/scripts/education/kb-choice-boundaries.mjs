import assert from 'node:assert/strict';
import {CHOICE_CONCORDANCE,choiceLayoutSignature,choiceAnswerComparison} from '../../src/shared/material-ai-choice.ts';
import {blindAnswerIssues,sourceComparisonQuestion} from '../../src/shared/material-ai-answer-review.ts';
import {validAiPagePrompt,pageTranscriptionAgrees} from '../../src/shared/material-ai-page.ts';
import {sourceCropQuestionAgrees} from '../../src/shared/material-ai-page-regions.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';

const body='观察图1，按原题选项填写。\n(1)实验中使用______（选涂“A电磁波”或“B超声波”）；\n(2)火星属于______（选涂“A恒星”、“B行星”或“C卫星”）；\n(3)运动过程______（选涂“A处于”或“B不处于”）平衡状态。';
const spaced=body.replace(/“([A-D])/gu,'“$1 '),answer='（1）A；（2）B；（3）B',annotated='(1) A（电磁波）；(2) B（行星）；(3) B（不处于）';
const prompt={policy:'page-fragments.v3',choiceReviewPolicy:CHOICE_CONCORDANCE,answerReviewPolicy:'blind-answer-review.v1'};
const question=(stem=body,value=answer)=>({number:'1',stem,answer:value,analysis:'按原题选项填写。',answerOrigin:'ai_generated',analysisOrigin:'ai_generated',requiresImage:true,issues:[],subject:'物理',grade:'九年级',knowledgePoint:'综合',questionType:'填空题',difficulty:'medium',projection:Object.fromEntries(['statement','choices','subquestions','formulas','tables','figures'].map(k=>[k,{state:['statement','choices','subquestions','figures'].includes(k)?'provided':'not_applicable',text:k==='figures'?'图1':k==='statement'||k==='choices'?stem:k==='subquestions'?stem.slice(stem.indexOf('\n')+1):''}]))});

export async function runChoiceChecks({check,cropReviewFixture,correctionFixture,MaterialAiRepository}){
 await check('Choice layout only removes label-adjacent space in complete quoted fill choices',()=>{
  assert.equal(choiceLayoutSignature(body,prompt),choiceLayoutSignature(spaced,prompt));assert.notEqual(choiceLayoutSignature(body),choiceLayoutSignature(spaced));
  for(const [a,b]of [['1 2','12'],['m s','ms'],['x²','x2'],['x₁','x1'],['−2','2'],['不处于','处于'],['A B','AB'],['（选涂“A m s”或“B 2”）','（选涂“A ms”或“B 2”）']])assert.notEqual(choiceLayoutSignature(a,prompt),choiceLayoutSignature(b,prompt));
  for(const unsupported of ['（选涂“A 是”或“A 否”）','（选涂“AA 是”或“B 否”）','（选涂“A 是”或“Z 否”）','（选涂“A 是”也许“B 否”）','（选涂“A 是”或“B 否”)'])assert.equal(choiceLayoutSignature(unsupported,prompt),choiceLayoutSignature(unsupported));
 });
 await check('Same numbered source choices prove letter and exact source-label annotations equivalent',()=>{
  const a=question(),b=question(spaced,annotated);assert.equal(choiceAnswerComparison(a,b,prompt),'same');assert.deepEqual(blindAnswerIssues(a,b,prompt),[]);assert.deepEqual(blindAnswerIssues(a,b,{...prompt,choiceReviewPolicy:undefined}),['answer_conflict']);
  assert.equal(choiceAnswerComparison(a,{...b,answer:'(1)A；(2)B；(3)A（处于）'},prompt),'conflict');
 });
 await check('Multiple answer slots bind to ordered inline groups, never a set of letters',()=>{
  const stem='(1)状态______（选填“A是”或“B不是”），方向______（选填“A左”或“B右”）。';
  assert.equal(choiceAnswerComparison(question(stem,'(1)A；B'),question(stem,'（1）A（是），B（右）'),prompt),'same');
  assert.equal(choiceAnswerComparison(question(stem,'(1)A；B'),question(stem,'(1)B；A'),prompt),'conflict');
  for(const value of ['(1)AB','(1)A','(1)A；B；A','(1)A和B'])assert.equal(choiceAnswerComparison(question(stem,'(1)A；B'),question(stem,value),prompt),undefined);
 });
 await check('Numeric or unit annotations are literal option text, never confused with the next subquestion',()=>{
  const stem='(1)结果______（选填“A 2”或“B 3”）；\n(2)单位______（选填“A m s”或“B ms”）。';
  assert.equal(choiceAnswerComparison(question(stem,'(1)A；(2)A'),question(stem,'（1）A（2）；（2）A（m s）'),prompt),'same');
  assert.equal(choiceAnswerComparison(question(stem,'(1)A；(2)A'),question(stem,'(1)A（2）；(2)A（ms）'),prompt),'conflict');
  for(const token of ['x²','x₂','−2']){const source='结果______（选填“A '+token+'”或“B 2”）。';assert.equal(choiceAnswerComparison(question(source,'A'),question(source,'A（'+token+'）'),prompt),'same');}
 });
 await check('Printed label contradicted by another exact option or an unavailable label remains held even if repeated',()=>{
  for(const value of ['(1)A（超声波）；(2)B；(3)B','(1)C；(2)B；(3)B'])assert.deepEqual(blindAnswerIssues(question(body,value),question(spaced,value),prompt),['answer_conflict']);
  assert.equal(choiceAnswerComparison(question(),question(body,'(1)A（用于通信的波）；(2)B；(3)B'),prompt),undefined);
 });
 await check('Missing, duplicate, reordered or extra subquestions and mixed free answers cannot use choice equivalence',()=>{
  for(const value of ['(2)A；(1)B；(3)B','(1)A；(1)B；(3)B','(1)A；(2)B','(1)A；(2)B；(3)B；(4)A','答案：(1)A；(2)B；(3)B'])assert.equal(choiceAnswerComparison(question(),question(body,value),prompt),undefined);
  for(const stem of [body.replace('(2)','(1)'),body.replace('(2)','(3)'),body+'\n(4)计算结果______。',body.replace('实验中使用','质量______，实验中使用')])assert.equal(choiceAnswerComparison(question(stem),question(stem,annotated),prompt),undefined);
 });
 await check('Free numeric answers and changed source conditions, units, signs and powers preserve strict comparison',()=>{
  assert.deepEqual(blindAnswerIssues(question('求2+3。','5'),question('求2+3。','6'),prompt),['answer_conflict']);
  for(const stem of [body.replace('不处于','处于'),body+'质量为2kg。',body.replace('电磁波','电磁波²'),body.replace('电磁波','电磁波₁')])assert.equal(choiceAnswerComparison(question(),question(stem,annotated),prompt),undefined);
  assert.equal(choiceAnswerComparison({...question(),answerOrigin:'source'},{...question(spaced,annotated),answerOrigin:'source'},prompt),undefined);
  assert.deepEqual(blindAnswerIssues({...question(),answerOrigin:'source'},{...question(spaced,annotated),answerOrigin:'source'},prompt),['answer_conflict']);
 });
 await check('Source comparison projects only proven choice layout and generated roles without changing source, diagrams or paid responses',()=>{
  const a=question(),b=question(spaced,annotated),before=JSON.stringify([a,b]);assert(sourceCropQuestionAgrees(sourceComparisonQuestion(a,b,prompt),b));assert.equal(JSON.stringify([a,b]),before);
  for(const key of ['figures','formulas','tables']){const changed=structuredClone(b);changed.projection[key]={state:'provided',text:'不同内容2m²'};assert(!sourceCropQuestionAgrees(sourceComparisonQuestion(a,changed,prompt),changed));}
 });
 await check('Page transcript layout uses the frozen policy while real body changes and page doubts remain held',()=>{
  const a={schemaVersion:'xiaozhi.material-ai-page-fragments.v1',outcome:'questions',pageText:body,pageIssues:[]},b={...a,pageText:spaced};assert(pageTranscriptionAgrees(a,b,prompt));assert(!pageTranscriptionAgrees(a,b));assert(!pageTranscriptionAgrees(a,{...b,pageIssues:['uncertain_ocr']},prompt));assert(!pageTranscriptionAgrees(a,{...b,pageText:spaced.replace('不处于','处于')},prompt));
 });
 const keys=['OMNI_EDU_AI_CHOICE_CONCORDANCE','OMNI_EDU_AI_CROP_BODY_TEXT','OMNI_EDU_AI_BLIND_ANSWERS','OMNI_EDU_AI_OWNED_CROP_MARGINS'];
 async function enabled(fn){const prior=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='1');try{await fn();}finally{keys.forEach((k,i)=>{if(prior[i]===undefined)delete process.env[k];else process.env[k]=prior[i];});}}
 async function fixture(quality=false,change=()=>{}){
  const f=await(quality?correctionFixture():cropReviewFixture()),complete=f.repo.runtime.complete,inspect=f.repo.runtime.inspectCrop;let inspected=0;
  f.repo.runtime.inspectCrop=async(...args)=>{const q=await inspect(...args);return{...q,...(++inspected===1?{text:body}:{})};};
  f.repo.runtime.complete=async i=>{const r=JSON.parse(await complete(i)),q=r.questions[0],final=quality?!!i.verification:!!i.previous,stem=final?spaced:body;Object.assign(q,question(stem,final?annotated:answer));if(!i.previous){q.stem='1.'+stem;q.projection.statement.text=q.stem;q.projection.choices.text=q.stem;}if(quality&&!i.previous)q.projection.figures.text='首稿误读图形';r.pageText=r.pageText.replace('如图所示物体移动，计算七加八的结果。',stem);change(r,i,final);return JSON.stringify(r);};
  try{f.batch=quality?await f.create():await f.repo.create(f.input);await f.repo.drain();if(quality)await f.repo.drain();return f;}catch(e){await f.dispose();throw e;}
 }
 await check('New strict choice policy requires frozen blind, owned source and whole-body OCR contracts',()=>enabled(async()=>{
  const f=await fixture();try{const p=f.inputs[0].pagePrompt;assert.equal(p.choiceReviewPolicy,CHOICE_CONCORDANCE);assert(validAiPagePrompt(p));let called=false;
   for(const bad of [{...p,choiceReviewPolicy:'future'},{...p,choiceReviewPolicy:undefined},{...p,answerReviewPolicy:undefined},{...p,cropTextPolicy:undefined},{...p,cropGeometryPolicy:undefined},{...p,extra:true},{...p,get choiceReviewPolicy(){called=true;return CHOICE_CONCORDANCE;}}])assert(!validAiPagePrompt(bad));assert(!called);
  }finally{await f.dispose();}
 }));
 await check('Durable standard and quality tasks retain source figures, final annotated answer and eligibility through cold validation',()=>enabled(async()=>{
  for(const quality of [false,true]){const f=await fixture(quality);try{const q=await f.question();assert(archiveEligible(q),JSON.stringify(q.archive));assert(q.document.blocks.some(b=>b.kind==='image'));assert.equal(q.answer,annotated);const before=f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all();await new MaterialAiRepository(f.host).validate(q);assert.deepEqual(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all(),before);assert.equal(f.state.calls,quality?3:2);}finally{await f.dispose();}}
 }));
 await check('Actual differing choice remains quarantined with its source document and original receipts',()=>enabled(async()=>{
  const f=await fixture(false,(r,_i,final)=>{if(final)r.questions[0].answer='(1)B；(2)B；(3)B';});try{const q=await f.question();assert(!archiveEligible(q));assert(q.archive.issues.includes('answer_conflict'));assert(q.document.blocks.some(b=>b.kind==='image'));await new MaterialAiRepository(f.host).validate(q);await assert.rejects(()=>f.repo.validate({...q,archive:{...q.archive,state:'ai_final',issues:[]}}),/source_changed/);}finally{await f.dispose();}
 }));
 await check('Stopping new choice policy cannot retarget saved inputs or silently change historical comparison',()=>enabled(async()=>{
  const f=await cropReviewFixture();try{const id=await f.repo.create(f.input),input=f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json;process.env.OMNI_EDU_AI_CHOICE_CONCORDANCE='0';await f.repo.drain();assert.equal(f.inputs[1].pagePrompt.choiceReviewPolicy,CHOICE_CONCORDANCE);assert.equal(f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json,input);await new MaterialAiRepository(f.host).validate(await f.question());const next=await fixture();try{assert.equal(next.inputs[0].pagePrompt.choiceReviewPolicy,undefined);assert(!archiveEligible(await next.question()));}finally{await next.dispose();}assert(id);}finally{await f.dispose();}
 }));
}
