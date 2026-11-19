import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
const {bookAnswerPage}=await import('../../src/main/assets/material-book-answer-content.ts');
const {MATERIAL_AI_BOOK_PAGE_RESPONSE, MATERIAL_BOOK_PAGE_POLICY, MATERIAL_BOOK_PAGE_TABLE_POLICY,
 parseAiPageResponse, pageResponseMatchesPolicy}=await import('../../src/shared/material-ai-page.ts');

const foundation='期中综合测试卷', extension='第六章 能力训练卷';
const table=(section, numbers, answers, label='答案速查')=>[section,label,numbers,answers].join('\n').trimEnd();
const clear=table(foundation,'1 2 3','C BD A');
const scoped=(pageText,answerIssues=[])=>parseAiPageResponse(JSON.stringify({schemaVersion:MATERIAL_AI_BOOK_PAGE_RESPONSE,
 outcome:answerIssues.length?'needs_review':'no_questions',questions:[],pageText,pageIssues:[],answerIssues}));
const derive=(first,final=first)=>bookAnswerPage(scoped(first),scoped(final),undefined,MATERIAL_BOOK_PAGE_TABLE_POLICY);
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const allClear=page=>page.entries.every(e=>e.agrees&&e.issues.join(',')==='missing_analysis');

check('Recognizes adjacent columns and retains exact source offsets and literal cells',()=>{
 const page=derive(clear);
 assert.deepEqual(page.entries.map(e=>[e.number,e.answer]),[['1','C'],['2','BD'],['3','A']]);
 assert(allClear(page));
 for(const e of page.entries){
  assert.equal(e.analysis,'');
  assert.equal(clear.slice(e.start,e.end),e.quote);
  assert(e.quote.startsWith(e.number)&&e.quote.endsWith(e.answer));
 }
});
check('Recognizes tabs, fullwidth cells and different recognized headings without losing source characters',()=>{
 const right=table(extension,'１１\t１２　１３','Ｅ\tＦＨ　Ｇ','### 选择题答案：');
 const left=table(extension,'11 12 13','E FH G','选择题答案');
 const page=derive(left,right);
 assert.deepEqual(page.entries.map(e=>[e.number,e.answer]),[['11','E'],['12','FH'],['13','G']]);
 assert(allClear(page));
 assert.equal(page.entries[1].quote,right.slice(page.entries[1].start,page.entries[1].end));
 assert(page.entries[1].quote.startsWith('１２')&&page.entries[1].quote.endsWith('ＦＨ'));
});
check('Different exams retain distinct same-number entries',()=>{
 const page=derive(clear+'\n'+table(extension,'1 2 3','B C D'));
 assert.deepEqual(page.entries.filter(e=>e.number==='1').map(e=>[e.section,e.answer]),[[foundation,'C'],[extension,'B']]);
 assert(allClear(page));
});
check('Rejects missing/empty/shifted cells and invalid number/letter sequences',()=>{
 for(const [numbers,answers] of [['1 2 3','D B'],['1 2 3','D B C A'],['1 2 3','D ? C'],['1 1 2','D B C'],
   ['1 3 4','D B C'],['01 02 03','D B C'],['2 1 3','D B C'],['1 2 3','AB B AA'],['1 2 3','D B Z'],['1 □ 3','D B C'],['1 2 3','']]){
  const page=derive(table(foundation,numbers,answers));
  assert.equal(page.unresolvedTables,1,JSON.stringify([numbers,answers]));
  assert.equal(page.entries.length,0);
 }
});
check('An invalid table stays isolated from a distinct valid exam and its numbered explanation',()=>{
 const page=derive(clear+'\n'+table(extension,'1 2 3','D B')+'\n1. D 原文解析。');
 assert.equal(page.unresolvedTables,1);
 assert.equal(page.entries.length,4);
 assert.deepEqual(page.entries.filter(e=>e.section===extension).map(e=>[e.number,e.answer,e.analysis]),[['1','D','原文解析。']]);
});
check('Needs an explicit current exam heading; an unsupported boundary invalidates previous scope',()=>{
 for(const text of [table('教辅答案','1 2','A B'),table(foundation+'\n第二套','1 2','A B')]){
  const response=scoped(text);
  const page=bookAnswerPage(response,response,foundation,MATERIAL_BOOK_PAGE_TABLE_POLICY);
  assert.equal(page.entries.length,0);
  assert.equal(page.unresolvedTables,1);
 }
});
check('A missing or changed second-pass cell never becomes a confirmed answer',()=>{
 const disagreement=derive(clear,clear.replace('C BD A','C B A'));
 assert(disagreement.entries[1].issues.includes('transcription_disagreement'));
 assert(allClear({...disagreement,entries:[disagreement.entries[0],disagreement.entries[2]]}));
 const omitted=derive(clear,clear.replace('C BD A','C B'));
 assert.equal(omitted.entries.length,0);
 assert.equal(omitted.unresolvedTables,1);
 assert.deepEqual(omitted.firstOnly.map(e=>e.number),['1','2','3']);
});
check('A scoped uncertainty in either pass follows the exact exam and number',()=>{
 const issue={section:foundation,number:'2',issues:['uncertain_ocr']};
 const page=bookAnswerPage(scoped(clear,[issue]),scoped(clear),undefined,MATERIAL_BOOK_PAGE_TABLE_POLICY);
 assert.deepEqual(page.entries[1].issues,['missing_analysis','uncertain_ocr']);
 assert.equal(page.pageUncertain,false);
});
check('A detailed answer with the same value takes precedence, and an internal disagreement is held',()=>{
 for(const [letter,issues] of [['C',[]],['D',['answer_conflict']]]){
  const page=derive(clear+'\n1. '+letter+' 原文详解。');
  assert.equal(page.entries.length,3);
  const one=page.entries.find(e=>e.number==='1');
  assert.equal(one.analysis,'原文详解。');
  assert.deepEqual(one.issues,issues);
 }
});
check('A repeated table in one exam cannot supply a unique answer',()=>{
 const page=derive(clear+'\n选择题答案\n1 2\nC BD');
 assert.equal(page.entries.length,5);
 assert(page.entries.filter(e=>e.number!=='3').every(e=>!e.agrees&&e.issues.includes('duplicate_number')));
});
check('A plain answer heading permits conventional detailed entries and preserves the previous explanation',()=>{
 const page=derive(foundation+'\n4. A 已确认的原文。\n参考答案\n5. B 第二条原文。');
 assert.equal(page.entries.length,2);
 assert.equal(page.entries[0].analysis,'已确认的原文。');
 assert.equal(page.unresolvedTables,undefined);
 const withTable=derive(foundation+'\n4. A 已确认的原文。\n答案速查\n5 6\nB C');
 assert.equal(withTable.entries[0].analysis,'已确认的原文。');
});
check('Excess input or too many distinct compact cells does not publish a partial projection',()=>{
 const group=(start,end)=>'答案速查\n'+Array.from({length:end-start+1},(_,i)=>i+start).join(' ')+'\n'+Array(end-start+1).fill('A').join(' ');
 const page=derive([foundation,group(1,100),group(101,200),group(201,202)].join('\n'));
 assert.equal(page.status,'too_large');
 assert.equal(page.entries.length,0);
});
check('Same response schema keeps original v2 parser for legacy receipts',()=>{
 const response=scoped(clear);
 assert.equal(bookAnswerPage(response,response,undefined,MATERIAL_BOOK_PAGE_POLICY).entries.length,0);
 assert.equal(bookAnswerPage(response,response).entries.length,0);
 assert(pageResponseMatchesPolicy(response,MATERIAL_BOOK_PAGE_TABLE_POLICY,true));
 assert(!pageResponseMatchesPolicy(response,MATERIAL_BOOK_PAGE_TABLE_POLICY,false));
});
if(process.argv[2]){
 const db=new DatabaseSync(process.argv[2],{readOnly:true});
 try{
  const row=db.prepare("SELECT first_json,final_json FROM material_ai_units WHERE final_json<>'' AND json_extract(input_json,'$.bookRole.kind')='answers'").all()
    .find(r=>r.first_json.includes('答案速查')&&r.final_json.includes('答案速查'));
  assert(row,'The provided saved natural dataset needs two independent saved answer-page reads');
  const first=parseAiPageResponse(row.first_json),final=parseAiPageResponse(row.final_json);
  const before=JSON.stringify([first,final]),legacy=bookAnswerPage(first,final,undefined,MATERIAL_BOOK_PAGE_POLICY);
  const samples=[],legacySamples=[];
  const roles=entries=>entries.map(e=>[e.section,e.number,e.answer,e.analysis]);
  let value;
  for(let n=0;n<100;n++){
   let start=performance.now();
   bookAnswerPage(first,final,undefined,MATERIAL_BOOK_PAGE_POLICY);
   legacySamples.push(performance.now()-start);
   start=performance.now();
   value=bookAnswerPage(first,final,undefined,MATERIAL_BOOK_PAGE_TABLE_POLICY);
   samples.push(performance.now()-start);
  }
  assert.equal(value.unresolvedTables,1);
  assert.deepEqual(roles(value.entries),roles(legacy.entries));
  assert.equal(new Set(value.entries.map(e=>e.sectionKey+'\0'+e.number)).size,value.entries.length);
  for(const e of value.entries)assert.equal(final.pageText.slice(e.start,e.end).trim(),e.quote);
  assert.equal(JSON.stringify([first,final]),before);
  checks++;
  console.log(JSON.stringify({naturalSavedPage:1,legacyEntries:legacy.entries.length,newEntries:value.entries.length,unresolvedTables:1,
   receiptDigest:createHash('sha256').update(before).digest('hex'),
   legacyP95Ms:Number(legacySamples.sort((a,b)=>a-b)[94].toFixed(3)),
   parseP95Ms:Number(samples.sort((a,b)=>a-b)[94].toFixed(3)),noProviderRequests:true}));
 }finally{db.close();}
}
console.log(JSON.stringify({success:true,checks}));
