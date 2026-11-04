import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {PRINTED_CHOICE_COUNT,printedChoiceRequirements,printedChoiceIssues} from '../../src/shared/material-ai-printed-choice.ts';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';
import {completeMaterialAi} from '../../src/main/assets/material-ai-provider.ts';

export async function runPrintedChoiceChecks({check,cropReviewFixture,MaterialAiRepository}){
 const header='一、选择题（第1～8题每题只有一个正确选项；第9～10题每题至少两个正确选项）';
 const choices='A.甲 B.乙 C.丙 D.丁';
 const q=(number,answer)=>({number:String(number),answer,projection:{choices:{state:'provided',text:choices}}});
 const response=text=>({pageText:text});
 const prompt=text=>({policy:'page-fragments.v3',printedChoicePolicy:PRINTED_CHOICE_COUNT,blockTexts:[{blockId:'block-1',text}]});
 const issues=(number,answer,text=header)=>printedChoiceIssues(response(text),response(text),q(number,answer),prompt(text));
 await check('Printed single-choice range rejects two selections while the minimum-two range permits three',()=>{
  assert.deepEqual(issues(1,'D'),[]);assert.deepEqual(issues(8,'CD'),['answer_conflict']);assert.deepEqual(issues(9,'C'),['answer_conflict']);assert.deepEqual(issues(9,'BD'),[]);assert.deepEqual(issues(10,'BCD'),[]);assert.deepEqual(issues(11,'自由填空'),[]);
 });
 await check('Exactly-two remains distinct from at-least-two and printed range endpoints are inclusive',()=>{
  const text='第9至10题每小题恰好有两个正确选项';assert.deepEqual(issues(9,'BC',text),[]);assert.deepEqual(issues(10,'BCD',text),['answer_conflict']);assert.deepEqual(issues(8,'A',text),[]);
 });
 await check('Invalid or duplicate letters cannot satisfy a printed multi-choice count',()=>{
  for(const answer of ['BB','BE','AA,C','BDH'])assert.deepEqual(issues(9,answer),['answer_conflict'],answer);
  assert.deepEqual(issues(9,'B、D'),[]);assert.deepEqual(issues(9,'D B'),[]);
 });
 await check('Unparseable answers and absent or ambiguous original choices stay held',()=>{
  for(const answer of ['','不确定','答案BD','B或D','BD（猜测）'])assert.deepEqual(issues(9,answer),['ai_review'],answer);
  for(const text of ['甲乙丙丁','A.甲 B.乙 A.丙 B.丁','A.甲 C.乙 D.丁']){const question=q(9,'BD');question.projection.choices.text=text;assert.deepEqual(printedChoiceIssues(response(header),response(header),question,prompt(header)),['ai_review']);}
 });
 await check('OCR and both source drafts must independently retain the same printed requirements',()=>{
  for(const [local,first,last] of [['',header,header],[header,'',header],[header,header,header.replace('至少两个','只有一个')]])assert.deepEqual(printedChoiceIssues(response(first),response(last),q(9,'BD'),prompt(local)),['ai_mismatch']);
 });
 await check('Overlapping contradictory instructions cannot be picked selectively',()=>{
  const text=header+'；第9～10题每题只有一个正确选项';assert.deepEqual(issues(9,'BD',text),['ai_mismatch']);
 });
 await check('Question-internal quoted instructions are not treated as page-level rules',()=>{
  assert.deepEqual(printedChoiceRequirements('测试卷\n1.某材料写道：第1～8题每题只有一个正确选项。'),[]);
  for(const prefix of ['1）','（1）','第1题：','１．'])assert.deepEqual(printedChoiceRequirements('测试卷\n'+prefix+'某材料写道：第1～8题每题只有一个正确选项。'),[]);
  assert.deepEqual(printedChoiceRequirements('第8～1题每题只有一个正确选项'),[]);
  assert.deepEqual(printedChoiceRequirements('第1～9999题每题只有一个正确选项'),[]);
  assert.deepEqual(printedChoiceRequirements('第1～8题每题只有一个正确选项').map(r=>[r.from,r.to,r.min,r.max]),[[1,8,1,1]]);
 });
 await check('Legacy absence is preserved and the rule never rewrites source text, answers or roles',()=>{
  const a=response(header),b=response(header),question=q(9,'C'),p=prompt(header),before=JSON.stringify([a,b,question,p]);printedChoiceIssues(a,b,question,p);assert.equal(JSON.stringify([a,b,question,p]),before);delete p.printedChoicePolicy;assert.deepEqual(printedChoiceIssues(a,b,question,p),[]);
 });
 const keys=['OMNI_EDU_AI_PRINTED_CHOICE_COUNT','OMNI_EDU_AI_BLIND_ANSWERS','OMNI_EDU_AI_CROP_BODY_TEXT','OMNI_EDU_AI_OWNED_CROP_MARGINS'];
 async function enabled(fn){const old=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='1');try{await fn();}finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}}
 await check('Printed count policy is strictly frozen with full-body, owned and blind source contracts',()=>enabled(async()=>{
  const f=await cropReviewFixture();try{await f.repo.create(f.input);await f.repo.drain();const p=f.inputs[0].pagePrompt;assert.equal(p.printedChoicePolicy,PRINTED_CHOICE_COUNT);assert(validAiPagePrompt(p));let invoked=false;
   for(const bad of [{...p,printedChoicePolicy:'future'},{...p,printedChoicePolicy:undefined},{...p,cropTextPolicy:undefined},{...p,answerReviewPolicy:undefined},{...p,get printedChoicePolicy(){invoked=true;return PRINTED_CHOICE_COUNT;}}])assert(!validAiPagePrompt(bad));assert(!invoked);
   const previous=f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all();assert(archiveEligible(await f.question()));await new MaterialAiRepository(f.host).validate(await f.question());assert.deepEqual(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all(),previous);
  }finally{await f.dispose();}
 }));
 await check('Stopping new printed rules preserves existing frozen jobs and cold readback',()=>enabled(async()=>{
  const f=await cropReviewFixture();try{await f.repo.create(f.input);process.env.OMNI_EDU_AI_PRINTED_CHOICE_COUNT='0';await f.repo.drain();assert.equal(f.inputs[0].pagePrompt.printedChoicePolicy,PRINTED_CHOICE_COUNT);await new MaterialAiRepository(f.host).validate(await f.question());const next=await cropReviewFixture();try{await next.repo.create(next.input);await next.repo.drain();assert.equal(next.inputs[0].pagePrompt.printedChoicePolicy,undefined);assert(archiveEligible(await next.question()));}finally{await next.dispose();}}finally{await f.dispose();}
 }));
 await check('Only new standard and quality folder jobs enable printed count checks by default',()=>enabled(async()=>{
  delete process.env.OMNI_EDU_AI_PRINTED_CHOICE_COUNT;
  for(const mode of ['standard','quality','legacy']){const f=await cropReviewFixture();try{const folderId='batch_'+randomUUID(),task={key:createHash('sha256').update('printed-'+mode).digest('hex'),folderId,revision:1};f.db.exec('CREATE TABLE material_folder_ai(batch_id TEXT PRIMARY KEY,status TEXT,revision INTEGER,settings_revision INTEGER,max_calls INTEGER,processing_mode TEXT);CREATE TABLE material_import_entries(batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT)');f.db.prepare("INSERT INTO material_folder_ai VALUES(?,'running',1,1,12,?)").run(folderId,mode);f.db.prepare("INSERT INTO material_import_entries VALUES(?,'file','saved',?)").run(folderId,f.id);await f.repo.create(f.input,task);const p=JSON.parse(f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json).pagePrompt;assert.equal(p.printedChoicePolicy,mode==='legacy'?undefined:PRINTED_CHOICE_COUNT);}finally{await f.dispose();}}
 }));
 await check('Production provider instructs independent solution using printed source counts without adding a round',()=>enabled(async()=>{
  const f=await cropReviewFixture(),fetch=globalThis.fetch;try{await f.repo.create(f.input);await f.repo.drain();let request;globalThis.fetch=async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(f.inputs[1].previous)}}]}));};await completeMaterialAi(f.inputs[1],new AbortController().signal);assert(request.messages[0].content.includes(PRINTED_CHOICE_COUNT));assert(request.messages[0].content.includes('允许两个或更多'));assert.equal(JSON.parse(request.messages[1].content[0].text).pageContext.printedChoicePolicy,PRINTED_CHOICE_COUNT);assert.equal(f.state.calls,2);}finally{globalThis.fetch=fetch;await f.dispose();}
 }));
}
