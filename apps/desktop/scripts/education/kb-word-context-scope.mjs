import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {preambleFixture} from './word-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {indexWordQuestions,wordQuestionPlanCompatible}=await import('../../src/main/assets/word-question-source.ts');
const {administrativeLine,explicitGlobalParameters}=await import('../../src/main/assets/word-preamble.ts');
const {WORD_PREAMBLE_QUESTION_POLICY,WORD_PREAMBLE_LEGACY_QUESTION_POLICY}=await import('../../src/shared/material-word.ts');
const payload=await parseWord(await preambleFixture()),checks=[];
function check(name,run){run();checks.push(name);console.log('PASS '+name);}
const fixture=()=>structuredClone(payload.document);
const withPolicy=(doc,policy)=>({...structuredClone(doc),questionPolicy:policy});
const setText=(doc,index,text)=>{doc.blocks[index].inlines=[{kind:'text',text}];};

check('Academic title variants become metadata under v5 while v4 source semantics and raw slots remain stable',()=>{
 for(const title of ['某区2023学年第二学期学习能力诊断卷','2022学年度高三期终学业质量调研测试','某县2024学年度第一学期期末','2023年普通高中学业水平合格性考试']){
  const doc=fixture();setText(doc,0,title);
  const old=withPolicy(doc,WORD_PREAMBLE_LEGACY_QUESTION_POLICY),before=indexWordQuestions(old),after=indexWordQuestions(doc);
  const oldSource=JSON.stringify(before.read(4));
  assert(before.read(4).issues.includes('shared_context'),title);
  assert(!after.read(4).issues.includes('shared_context'),title);
  assert(after.read(4).context.includes(title));assert(!after.read(4).canonical.question.includes(title));
  assert.equal(after.total,before.total);assert(wordQuestionPlanCompatible(old,doc));
  assert.equal(JSON.stringify(indexWordQuestions(old).read(4)),oldSource);
 }
});
check('Parenthesized real calendar dates and timing clauses are metadata only with a trusted exam header',()=>{
 for(const line of ['（2024年6月）','（2024.2.29）','（满分100分，完卷时间60分钟）2024.4']){
  assert(administrativeLine(line,true,true),line);
  assert(!administrativeLine(line,true),line);
 }
 for(const line of ['（2023.2.29）','（2024.13）','（2024.6g）'])assert(!administrativeLine(line,true,true),line);
 assert(!administrativeLine('（2024.6）',false,true));
});
check('Year-shaped physical conditions, uncertain answer notices and mixed instructions stay in source',()=>{
 for(const line of ['2023学年实验中小球质量为2kg','2024年一物体速度为10m/s，求运动时间','2022年考试，已知质量为2kg','答案非官方版本，不保证正确','本卷g取10m/s²','考试时间60分钟。速度为10m/s。']){
  assert(!administrativeLine(line,true,true),line);
 }
 const doc=fixture();setText(doc,0,'2023学年实验中小球质量为2kg\n答案非官方版本，不保证正确');
 const source=indexWordQuestions(doc).read(4);assert(source.issues.includes('shared_context'));
 assert(source.canonical.question.includes('2kg'));assert(source.canonical.question.includes('不保证正确'));
});
check('Administrative section ranges accept clause separators without absorbing physical assumptions',()=>{
 assert(administrativeLine('一、选择题（共80分。第1-25小题，每小题2分：第26-35小题，每小题3分。每小题只有一个正确选项）',true,true));
 assert(!administrativeLine('一、选择题（第1-5小题，g取10m/s²）',true,true));
});
check('Explicit full-paper gravity retains original text in both questions with a known source scope',()=>{
 const doc=fixture();setText(doc,5,'2．本卷g取10m/s²。');
 const old=withPolicy(doc,WORD_PREAMBLE_LEGACY_QUESTION_POLICY),before=indexWordQuestions(old),after=indexWordQuestions(doc);
 assert(wordQuestionPlanCompatible(old,doc));
 for(const number of [4,5]){
  assert(before.read(number).issues.includes('shared_context'));
  const source=after.read(number);assert(!source.issues.includes('shared_context'));
  assert(source.canonical.question.includes('本卷g取10m/s²'));assert(!source.context.includes('g取'));
  assert(source.parts.question.some(span=>span.blockId===doc.blocks[5].id));
 }
});
check('Local, conditional, partial, missing-unit and warning-bearing parameter claims retain uncertainty',()=>{
 for(const line of ['2．第3题g取10m/s²','2．本卷仅第3题g取10m/s²','2．本卷g取10','2．本卷g取10m/s²，除第3题','2．若本卷g取10m/s²']){
  const doc=fixture();setText(doc,5,line);assert(indexWordQuestions(doc).read(4).issues.includes('shared_context'),line);
 }
 const doc=fixture();setText(doc,5,'2．本卷g取10m/s²');doc.blocks[5].warnings=['tracked_changes'];
 assert(indexWordQuestions(doc).read(4).issues.includes('shared_context'));
 assert(!explicitGlobalParameters([]));
});
check('A changed physical body still refuses the preserved original source plan',()=>{
 const doc=fixture(),old=withPolicy(doc,WORD_PREAMBLE_LEGACY_QUESTION_POLICY);
 setText(doc,8,'1．如图，质量不同的小球受力如何？');
 assert(!wordQuestionPlanCompatible(old,doc));
 assert.equal(doc.questionPolicy,WORD_PREAMBLE_QUESTION_POLICY);
});
check('A first real question after either plain or warned section headings cannot become a global preamble slot',()=>{
 for(const warnings of [[],['tracked_changes']]){
  const doc=fixture();doc.blocks[7].warnings=warnings;setText(doc,8,'1．本卷g取10m/s²');
  assert(!indexWordQuestions(doc).nonQuestion(4));
 }
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Versioned source-scope rules and counterexamples. Source geometry and model quality require the real corpus path.'}));
