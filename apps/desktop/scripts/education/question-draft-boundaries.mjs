import fs from 'node:fs';
import {testMain} from '../acceptance/build-root.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {normalizeQuestionDraft} from '../../src/main/education/question-host.ts';
import {QUESTION_DRAFT_SCHEMA,QUESTION_DRAFT_TYPES,validQuestionDraftInput,validQuestionDraftResult} from '../../src/shared/question-draft.ts';

export async function questionDraftBoundaries(check,output){
 const signal=()=>new AbortController().signal;
 const normalize=(questionType,payload)=>normalizeQuestionDraft({questionType,raw:typeof payload==='string'?payload:JSON.stringify(payload)},signal());
 const item={question:'直角边3和4的斜边长度？',correct_answer:'5',explanation:'由勾股定理可得平方和25，正平方根为5。'};
 const python=process.env.OMNI_EDU_PYTHON||'C:\\Python314\\python.exe';
 await check('Question pinned Git blobs, Apache license and bundled assets match exactly; AST executes only original three format helpers',async()=>{
  const source=path.resolve('src/main/education/vendor/deeptutor-question'),manifest=JSON.parse(fs.readFileSync(path.join(source,'source-manifest.json')));
  assert.equal(manifest.revision,'f07029cfcf2c8dfccdb671cdfc343db8334f5741');assert.equal(manifest.license,'Apache-2.0');
  for(const file of manifest.files){const bytes=fs.readFileSync(path.join(source,file.destination));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert(bytes.equals(fs.readFileSync(path.resolve('out/main/vendor/deeptutor-question',file.destination))));}
  assert(fs.readFileSync('src/main/education/question-worker.py').equals(fs.readFileSync('out/main/question-worker.py')));
  const script=`import ast, inspect, pathlib, runpy, sys, textwrap\nm=runpy.run_path('src/main/education/question-worker.py'); cls,kind=m['load_helpers'](); source=ast.parse(pathlib.Path('src/main/education/vendor/deeptutor-question/pipeline.py').read_bytes()); original=next(n for n in source.body if isinstance(n,ast.ClassDef) and n.name=='QuestionPipeline')\nassert set(k for k in vars(cls) if k.startswith('_') and not k.startswith('__'))==m['METHODS']\nfor name in m['METHODS']:\n original_fn=next(n for n in original.body if isinstance(n,ast.FunctionDef) and n.name==name); actual=ast.parse(textwrap.dedent(inspect.getsource(getattr(cls,name)))).body[0]; assert ast.dump(original_fn)==ast.dump(actual),name\nassert not any(k.startswith(('deeptutor','openai','pydantic')) for k in sys.modules)\nprint('ORIGINAL_QUESTION_AST_OK')`;
  const p=spawnSync(python,['-I','-S','-B','-X','utf8','-c',script],{encoding:'utf8',windowsHide:true});assert.equal(p.status,0,p.stderr);assert(p.stdout.includes('ORIGINAL_QUESTION_AST_OK'));
 });
 await check('Actual original choice normalization maps case/trimmed options and full text answer; returns necessary draft fields only',async()=>{
  const value=await normalize('choice',{...item,options:{' a ':' 3 ',' b ':' 4 ',' c ':' 5 ',' d ':' 7 '},correct_answer:' 5 '});
  assert.equal(value.valid,true);assert.deepEqual(value.issues,[]);assert.equal(value.question.answer,'C');assert.deepEqual(value.question.options,{A:'3',B:'4',C:'5',D:'7'});
  assert.deepEqual(Object.keys(value).sort(),['issues','question','valid']);assert(!JSON.stringify(value).includes('teacherConfirmed'));assert(!JSON.stringify(value).includes('requestId'));
 });
 await check('Original JSON fence/trailing-prose parser reads first object without extending later braces; malformed input has honest missing issues',async()=>{
  for(const raw of ['```json\n'+JSON.stringify(item)+'\n```','前言 '+JSON.stringify(item)+' 后记 { 不要合并 }'])assert.equal((await normalize('short_answer',raw)).valid,true);
  const bad=await normalize('short_answer','不是JSON {坏数据}');assert.equal(bad.valid,false);assert.deepEqual(bad.issues,['missing_question','missing_correct_answer','missing_explanation']);assert.equal(bad.question.answer,'');assert(!JSON.stringify(bad).includes('N/A'));
 });
 await check('All upstream canonical types retain original answer semantics; concept Chinese variants and blank token validate',async()=>{
  for(const [answer,expected]of [['正确','true'],['错','false'],['YES','true'],['0','false']]){const value=await normalize('concept',{...item,correct_answer:answer});assert.equal(value.question.answer,expected);assert(value.valid);}
  assert.equal((await normalize('concept',{...item,correct_answer:'不一定'})).valid,false);
  assert.equal((await normalize('fill_in_blank',item)).issues[0],'fill_in_blank_question_must_contain_blank_token');
  assert((await normalize('fill_in_blank',{...item,question:'斜边长是____。'})).valid);
  for(const type of ['short_answer','written','coding']){assert((await normalize(type,item)).valid);assert((await normalize(type,{...item,correct_answer:'A'})).issues.includes('non_choice_correct_answer_looks_like_option_key'));}
  assert.equal(QUESTION_DRAFT_TYPES.length,6);
 });
 await check('Incomplete choices, absent answer/analysis and format validity never imply mathematically correct or teacher-confirmed content',async()=>{
  const value=await normalize('choice',{question:'二加二等于？',correct_answer:'E',explanation:'',options:{A:'3',B:'4'}});assert(!value.valid);assert.deepEqual(value.issues,['missing_explanation','choice_options_must_be_a_to_d','choice_correct_answer_must_be_option_key']);
  const wrongMath=await normalize('short_answer',{...item,correct_answer:'999'});assert(wrongMath.valid);assert.equal(wrongMath.question.answer,'999');assert(!('correct' in wrongMath));
 });
 await check('Question protocol rejects accessors, unknown authority fields/type, duplicate JSON/normalized option keys and data coercion',async()=>{
  let accessed=false;const getter={questionType:'short_answer'};Object.defineProperty(getter,'raw',{get(){accessed=true;return JSON.stringify(item);},enumerable:true});assert(!validQuestionDraftInput(getter));assert(!accessed);
  for(const raw of [{questionType:'short_answer',raw:JSON.stringify(item),studentId:'forged'},{questionType:'unknown',raw:'{}'},{questionType:'choice',raw:''}])await assert.rejects(normalizeQuestionDraft(raw,signal()),/invalid_input/);
  for(const payload of [{...item,studentId:'secret'},{...item,question_type:'concept'},{...item,correct_answer:5},{...item,explanation:null},{...item,options:{A:'3',a:'4'}},{...item,options:{E:'secret'}},{...item,options:['a']},{...item,options:{A:5}},'{"question":"a","question":"b"}', '{"question":NaN}'])await assert.rejects(normalize('choice',payload),/invalid_input/);
  await assert.rejects(normalize('short_answer',{...item,options:{A:'secret'}}),/invalid_input/);
 });
 await check('Oversized/control-bearing draft fields fail without truncating answers; response schema rejects forged validity and output authorities',async()=>{
  for(const payload of [{...item,question:'x'.repeat(12001)},{...item,correct_answer:'x'.repeat(8001)},{...item,explanation:'x'.repeat(12001)},{...item,question:'private\x00'}])await assert.rejects(normalize('short_answer',payload),/invalid_input/);
  const result=await normalize('short_answer',item);assert(validQuestionDraftResult(result,'short_answer'));assert(!validQuestionDraftResult({...result,teacherConfirmed:true},'short_answer'));assert(!validQuestionDraftResult({...result,issues:['missing_question'],valid:true},'short_answer'));assert(!validQuestionDraftResult(result,'concept'));
  assert(!validQuestionDraftResult({...result,schemaVersion:'question-draft.v2'},'short_answer'));assert(!validQuestionDraftResult({...result,ok:false},'short_answer'));assert(!validQuestionDraftResult({...result,requestId:''},'short_answer'));
  await assert.rejects(normalizeQuestionDraft({questionType:'short_answer',raw:'x'.repeat(65537)},signal()),/invalid_input/);
 });
 await check('Actual question worker cancellation and missing Python fail safely without model/database fallback',async()=>{
  const abort=new AbortController(),pending=normalizeQuestionDraft({questionType:'short_answer',raw:JSON.stringify(item)},abort.signal);abort.abort();await assert.rejects(pending,/cancelled/);
  const old=process.env.OMNI_EDU_PYTHON;process.env.OMNI_EDU_PYTHON=path.join(output,'missing-question-python.exe');try{await assert.rejects(normalize('short_answer',item),/unavailable/);}finally{old===undefined?delete process.env.OMNI_EDU_PYTHON:process.env.OMNI_EDU_PYTHON=old;}
 });
 await check('Owned bundled-worker process rejects corrupted pinned source and protocol authority fields; real packaged assets produce valid answer',async()=>{
  const bundled=path.dirname(testMain(path.resolve('.'))),owned=path.join(output,'question-worker-copy');fs.mkdirSync(owned);fs.copyFileSync(path.join(bundled,'question-worker.py'),path.join(owned,'question-worker.py'));fs.mkdirSync(path.join(owned,'vendor'));fs.cpSync(path.join(bundled,'vendor/deeptutor-question'),path.join(owned,'vendor/deeptutor-question'),{recursive:true});
  const request={schemaVersion:QUESTION_DRAFT_SCHEMA,requestId:'owned-request',operation:'normalize',questionType:'short_answer',raw:JSON.stringify(item)};
  const run=input=>{const p=spawnSync(python,['-I','-S','-B','-X','utf8',path.join(owned,'question-worker.py')],{input:JSON.stringify(input),encoding:'utf8',windowsHide:true});assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');return JSON.parse(p.stdout);};
  const value=run(request);assert(value.ok&&value.valid);assert.equal(value.question.answer,'5');assert.equal(value.requestId,'owned-request');
  assert.equal(run({...request,path:'../../private'}).error,'invalid_input');assert.equal(run({...request,questionType:'unknown'}).error,'invalid_input');
  fs.appendFileSync(path.join(owned,'vendor/deeptutor-question/pipeline.py'),'\n# corrupted owned source');assert.equal(run(request).error,'unavailable');
 });
}
