import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {preambleFixture} from './word-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {indexWordQuestions,wordQuestionPlanCompatible,verifyWordQuestionSource}=await import('../../src/main/assets/word-question-source.ts');
const {WORD_BOOKLET_QUESTION_POLICY,WORD_PREAMBLE_QUESTION_POLICY}=await import('../../src/shared/material-word.ts');
const {partitionWordPreamble,administrativeLine,preambleWindow}=await import('../../src/main/assets/word-preamble.ts');
const {wordParagraphMap,wordQuestionText,wordQuestionBlocks}=await import('../../src/shared/material-word-question.ts');
const {nativeMetadata}=await import('../../src/main/assets/material-ai-native-context.ts');
const payload=await parseWord(await preambleFixture()),checks=[];
function check(name,run){run();checks.push(name);console.log('PASS '+name);}
const legacy=()=>{const d=structuredClone(payload.document);d.questionPolicy=WORD_BOOKLET_QUESTION_POLICY;return d;};
const current=()=>structuredClone(payload.document);
check('Real OOXML reserves old source slots while excluding instructions from actual questions and AI inputs',()=>{
 const d=current(),before=indexWordQuestions(legacy()),after=indexWordQuestions(d);assert.equal(d.questionPolicy,WORD_PREAMBLE_QUESTION_POLICY);
 assert.equal(before.total,5);assert.equal(after.total,5);assert.equal(after.questionTotal,2);assert(wordQuestionPlanCompatible(legacy(),d));
 for(const ordinal of [1,2,3]){assert(after.nonQuestion(ordinal));assert.throws(()=>after.read(ordinal),/non_question_content/);}
 assert.deepEqual(after.summaries(0).map(q=>q.ordinal),[4,5]);assert.deepEqual(after.read(4).issues,[]);
 assert(!after.read(4).canonical.question.includes('试卷满分'));assert(after.read(4).context.includes('2018.12'));
 assert.equal(nativeMetadata(after.read(4))['资料上下文'],after.read(4).context);assert(verifyWordQuestionSource(after.read(4),d));
});
check('Mixed preamble lines preserve exact UTF16 physics ranges and unknown answer reliability statements',()=>{
 const d=current(),b=d.blocks[0],text='高三物理试卷\n已知😀小球质量为2kg，g=10m/s²。\n答案非官方版本，不保证正确。\n';b.inlines=[{kind:'text',text}];
 const partition=partitionWordPreamble([{block:b,span:{blockId:b.id,from:0,to:text.length}}],true);
 assert.equal(partition.context,'高三物理试卷');assert.equal(partition.common[0].span.from,'高三物理试卷\n'.length);assert.equal(partition.common[0].span.to,text.length);
 const q=indexWordQuestions(d).read(4);assert(q.issues.includes('shared_context'));assert(q.canonical.question.includes('😀小球质量为2kg'));assert(q.canonical.question.includes('不保证正确'));assert(!q.canonical.question.includes('高三物理试卷'));
});
check('A numbered global physics condition stays shared and blocks automatic qualification',()=>{
 const d=current();d.blocks[5].inlines=[{kind:'text',text:'2．已知全卷小球的质量均为2kg。\n'}];const ix=indexWordQuestions(d);assert.equal(ix.total,5);assert(ix.nonQuestion(2));
 for(const n of [4,5]){const q=ix.read(n);assert(q.issues.includes('shared_context'));assert(q.canonical.question.includes('全卷小球的质量均为2kg'));}
});
check('A later attention or first-section heading cannot consume earlier real questions',()=>{
 const d=current(),b=structuredClone(d.blocks[3]);b.id='wb_'+'f'.repeat(32);b.inlines=[{kind:'text',text:'一、选择题\n'}];d.blocks.push(b);
 d.blocks[7].inlines=[{kind:'text',text:'一．（40分）选择题．\n'}];const ix=indexWordQuestions(d);assert(!ix.nonQuestion(4));assert(!ix.nonQuestion(5));assert(preambleWindow(d.blocks).sectionAt<0);
 d.blocks[3].inlines=[{kind:'text',text:'资料说明\n'}];d.blocks.splice(10,0,b);assert(preambleWindow(d.blocks).attentionAt<0);
});
check('Warnings, common images and tables remain atomic source evidence',()=>{
 for(const mutate of [d=>{d.blocks[0].warnings=['field_or_symbol'];},d=>{d.blocks[0].inlines.push(structuredClone(d.blocks[9].inlines.find(i=>i.kind==='image')));}]){
  const d=current();mutate(d);const q=indexWordQuestions(d).read(4);assert(q.issues.includes('shared_context'));assert(wordQuestionBlocks(q,'question').some(b=>b.id===d.blocks[0].id));
 }
 const b={kind:'table',id:'wb_'+'e'.repeat(32),anchor:{part:'word/document.xml',path:'/document[0]/body[0]/tbl[0]'},rows:[]};
 assert.equal(partitionWordPreamble([{block:b,span:{blockId:b.id}}],true).common[0].block,b);
});
check('Administrative grammar refuses physical clauses, invalid dates and unsigned numerical context',()=>{
 for(const line of ['2018.13','2025.2.29','2018.12g','作答必须写在答题纸上，小球质量2kg。','选择题（已知g=10m/s²）','考试时间60分钟。速度为10m/s。'])assert(!administrativeLine(line,true),line);
 assert(!administrativeLine('2018.12',false));assert(administrativeLine('2024.2.29',true));assert(administrativeLine('试卷满分100分，考试时间60分钟．',true));
});
check('Real duplicate numbers stay ambiguous and changed actual source plans refuse upgrades',()=>{
 const d=current();d.blocks.at(-1).inlines=[{kind:'text',text:'1．另一个真实问题？\n'}];const ix=indexWordQuestions(d);assert(ix.read(4).issues.includes('ambiguous_number'));assert(ix.read(5).issues.includes('ambiguous_number'));
 const changed=current();changed.blocks.at(-1).inlines=[{kind:'text',text:'3．另一个真实问题？\n'}];assert(!wordQuestionPlanCompatible(legacy(),changed));
});
check('A trailing floating picture before the next figure-referencing question holds both source occurrences',()=>{
 const d=current();d.blocks.at(-1).inlines=[{kind:'text',text:'2．如图，比较两个小球所受重力？\n'}];
 const before=indexWordQuestions(legacy()).read(4),ix=indexWordQuestions(d);assert(!before.issues.includes('image_scope_uncertain'));
 assert(ix.read(4).issues.includes('image_scope_uncertain'));assert(ix.read(5).issues.includes('image_scope_uncertain'));
 assert.equal(ix.read(4).assets.length,1);assert.equal(ix.read(5).assets.length,0);assert(wordQuestionPlanCompatible({...d,questionPolicy:WORD_BOOKLET_QUESTION_POLICY},d));
 const anchored=current();anchored.blocks.at(-1).inlines=[{kind:'text',text:'2．如图，比较两个小球所受重力？'},structuredClone(anchored.blocks[9].inlines.find(i=>i.kind==='image'))];assert(!indexWordQuestions(anchored).read(5).issues.includes('image_scope_uncertain'));
});
check('Historical v3 source identity and physical content remain stable after v4 indexing',()=>{
 const d=legacy(),before=JSON.stringify(indexWordQuestions(d).read(4));indexWordQuestions(current()).read(4);assert.equal(JSON.stringify(indexWordQuestions(d).read(4)),before);assert(verifyWordQuestionSource(JSON.parse(before),d));assert(wordQuestionText(wordQuestionBlocks(JSON.parse(before),'question')).includes('小球'));
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Exact source and preamble policy regression. No model-quality claim.'}));
