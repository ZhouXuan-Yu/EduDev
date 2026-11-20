import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bookletWordFixture} from './word-question-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {indexWordQuestions,verifyWordQuestionSource}=await import('../../src/main/assets/word-question-source.ts');
const {WORD_BOOKLET_QUESTION_POLICY,WORD_PREAMBLE_EXPANDED_QUESTION_POLICY,WORD_PREAMBLE_QUESTION_POLICY,validWordDocument}=await import('../../src/shared/material-word.ts');
const {wordQuestionBlocks,wordQuestionText,validWordQuestionSource}=await import('../../src/shared/material-word-question.ts');
const {nativeMetadata}=await import('../../src/main/assets/material-ai-native-context.ts');
const {nativeChoiceAnswerConflict}=await import('../../src/main/assets/word-booklet.ts');
const payload=await parseWord(await bookletWordFixture()),checks=[];
// Freeze legacy v3 semantics independently of the current parser policy.
payload.document.questionPolicy=WORD_BOOKLET_QUESTION_POLICY;
const clone=()=>structuredClone(payload.document);
const table=doc=>doc.blocks.find(b=>b.kind==='table');
const source=(doc,n=2)=>indexWordQuestions(doc).read(n);
function check(name,run){run();checks.push(name);console.log('PASS '+name);}
check('Real OOXML exam metadata stays in context and exact answer cells bind to the matching unique printed question',()=>{
 const doc=clone(),index=indexWordQuestions(doc);assert.equal(index.total,2);assert.equal(doc.questionPolicy,WORD_BOOKLET_QUESTION_POLICY);
 for(const [n,answer]of [[1,'D'],[2,'B']]){
  const q=index.read(n);assert.deepEqual(q.issues,[]);assert.equal(q.canonical.answer,answer);
  assert(!q.canonical.question.includes('答题纸'));assert(!q.canonical.question.includes('质量调研考试'));
  assert(q.context.includes('答题纸'));assert.equal(nativeMetadata(q)['资料上下文'],q.context);
  assert(verifyWordQuestionSource(q,doc));assert(validWordQuestionSource(q));
  assert.equal(wordQuestionText(wordQuestionBlocks(q,'answer')),answer);
  assert.equal(q.parts.answer[0].blockId,table(doc).rows[1].cells[n].blocks[0].id);
  assert(!wordQuestionText(wordQuestionBlocks(q,'question')).includes('题号'));
 }
});
check('Stored v2 and v1 retain their original conservative grouping while unknown document policies are refused',()=>{
 const doc=clone();delete doc.questionPolicy;
 const v2=source(doc);assert.equal(v2.indexPolicy,'word-question-scoped.v2');assert(v2.issues.includes('shared_context'));assert(v2.issues.includes('separate_answers'));assert.equal(v2.canonical.answer,'');
 const digest=v2.documentSha;assert.notEqual(source(clone()).documentSha,digest);assert(verifyWordQuestionSource(v2,doc));
 doc.parser='word-ooxml.v1';delete doc.unscopedWarnings;delete doc.imagePolicy;delete doc.drawingPolicy;assert(validWordDocument(doc));assert.equal(source(doc).indexPolicy,undefined);
 const bad=clone();bad.questionPolicy='future';assert(!validWordDocument(bad));assert.throws(()=>indexWordQuestions(bad),/source_changed/);
});
check('Physical conditions, unknown prose and non-text preamble evidence remain attached and held',()=>{
 for(const text of ['本卷g=10m/s²。','已知所有小球质量都是2kg。','阅读材料后回答问题。','速度分别为10、20、30。','试卷包括两部分，所有小球均带负电。']){
  const doc=clone();doc.blocks[0].inlines=[{kind:'text',text}];const q=source(doc);assert(q.issues.includes('shared_context'),text);assert(q.canonical.question.includes(text),text);
 }
 const warned=clone();warned.blocks[0].warnings=['field_or_symbol'];assert(source(warned).issues.includes('shared_context'));
});
check('Answer role provenance cannot be forged or expanded to include neighbouring answers',()=>{
 const doc=clone(),q=source(doc),changed=structuredClone(q);changed.canonical.answer='D';assert(!validWordQuestionSource(changed));
 const wrong=structuredClone(q);wrong.parts.answer=[structuredClone(source(doc,1).parts.answer[0])];assert(!verifyWordQuestionSource(wrong,doc));
 assert.equal(q.blocks.filter(b=>b.id===table(doc).rows[1].cells[1].blocks[0].id).length,0);
});
check('Administrative section changes stay in the next question context instead of the preceding question body',()=>{
 const doc=clone(),heading=structuredClone(doc.blocks[4]);heading.id='wb_'+'e'.repeat(32);heading.inlines[0].text='二、填空题（共20分。每个空格2分）';doc.blocks.splice(6,0,heading);
 const first=source(doc,1),next=source(doc,2);assert(!first.canonical.question.includes('填空题'));assert(!next.canonical.question.includes('填空题'));assert(next.context.includes('填空题'));assert(!first.context.includes('每个空格2分'));
});
check('Duplicate question numbers and repeated answer tables remain ambiguous even when answer text agrees',()=>{
 const doc=clone();doc.blocks[6].inlines[0].text=doc.blocks[6].inlines[0].text.replace('2．','1．');
 assert(source(doc,1).issues.includes('ambiguous_number'));assert.equal(source(doc,1).canonical.answer,'');
 const repeated=clone(),copy=structuredClone(table(repeated));
 function reidentify(block){block.id='wb_'+createHash('sha256').update(block.id+'copy').digest('hex').slice(0,32);if(block.kind==='table')for(const r of block.rows)for(const c of r.cells)for(const child of c.blocks)reidentify(child);}
 reidentify(copy);repeated.blocks.push(copy);assert(validWordDocument(repeated));assert(source(repeated).issues.includes('separate_answers'));assert.equal(source(repeated).canonical.answer,'');
 const duplicate=clone();table(duplicate).rows[0].cells[2].blocks[0].inlines[0].text='1';assert.equal(source(duplicate,1).canonical.answer,'');
 const twoSections=clone(),heading=structuredClone(twoSections.blocks[7]);heading.id='wb_'+'d'.repeat(32);twoSections.blocks.push(heading);assert.equal(source(twoSections).canonical.answer,'');assert(source(twoSections).issues.includes('separate_answers'));
});
check('Merged cells, mismatched column counts and malformed table labels do not acquire answer authority',()=>{
 for(const mutate of [doc=>{table(doc).rows[1].cells[1].colSpan=2;},doc=>{table(doc).rows[1].cells.pop();},doc=>{table(doc).rows[1].cells[0].blocks[0].inlines[0].text='其他';}]){
  const doc=clone();mutate(doc);assert.equal(source(doc).canonical.answer,'');assert(source(doc).issues.includes('separate_answers'));
 }
});
check('A non-choice or uncertain answer remains local to its column while another clear column can proceed',()=>{
 const doc=clone();table(doc).rows[1].cells[1].blocks[0].inlines[0].text='D或A';assert.equal(source(doc,1).canonical.answer,'');assert(source(doc,1).issues.includes('separate_answers'));assert.equal(source(doc,2).canonical.answer,'B');
 const bad=clone();table(bad).rows[1].cells[2].blocks[0].warnings=['unsupported_image'];assert.equal(source(bad,2).canonical.answer,'');
});
check('An ordinary question table is not treated as an answer section without an explicit source heading',()=>{
 const doc=clone();doc.blocks[7].inlines[0].text='请阅读下表回答问题。';assert.equal(source(doc).canonical.answer,'');
 assert(wordQuestionBlocks(source(doc),'question').some(b=>b.kind==='table'));
});
check('Both model passes must agree with a source-bound choice answer while old frozen policies retain their prior contract',()=>{
 const q=source(clone());assert(!nativeChoiceAnswerConflict(q,['B','Ｂ']));assert(nativeChoiceAnswerConflict(q,['C','C']));assert(nativeChoiceAnswerConflict(q,['C','B']));assert(nativeChoiceAnswerConflict(q,['B','']));
 const old=clone();delete old.questionPolicy;assert(!nativeChoiceAnswerConflict(source(old),['C','C']));
});
function printedFixture(text='1.Ｄ2．B'){
 const doc=clone();
 doc.questionPolicy=WORD_PREAMBLE_QUESTION_POLICY;
 const answerAt=doc.blocks.findIndex(block=>block.kind==='table');
 const paragraph=(value,n)=>({kind:'paragraph',id:'wb_'+String(n).repeat(32),
  anchor:{part:'word/document.xml',path:'/document[0]/body[0]/p['+(80+n)+']'},inlines:[{kind:'text',text:value}]});
 doc.blocks.splice(answerAt,1,paragraph('一.单项选择题',1),paragraph(text,2));
 return {doc,answerAt,paragraph};
}
check('Printed answers in one paragraph bind exact literal letter ranges without changing v5 or the question identity',()=>{
 const {doc,answerAt}=printedFixture(),older={...doc,questionPolicy:WORD_PREAMBLE_EXPANDED_QUESTION_POLICY};
 const current=indexWordQuestions(doc),old=indexWordQuestions(older);
 assert.equal(current.total,old.total);
 for(const [n,answer,from]of [[1,'Ｄ',2],[2,'B',5]]){
  const q=current.read(n),span=q.parts.answer[0];
  assert.equal(current.bodyIdentity(n),old.bodyIdentity(n));
  assert.equal(old.read(n).canonical.answer,'');
  assert(verifyWordQuestionSource(old.read(n),older));
  assert(verifyWordQuestionSource(q,doc));
  assert.deepEqual(span,{blockId:doc.blocks[answerAt+1].id,from,to:from+1});
  assert.equal(q.canonical.answer,answer);
  assert.equal(wordQuestionText(wordQuestionBlocks(q,'answer')),answer);
  assert(!q.issues.includes('separate_answers'));
  assert(nativeChoiceAnswerConflict(q,['H','H']));
 }
});
check('Mismatched sections, absent options and content outside a complete printed strip cannot pair',()=>{
 for(const scenario of [
  f=>{f.doc.blocks[f.answerAt].inlines[0].text='二、单项选择题';},
  f=>{f.doc.blocks[f.answerAt].inlines[0].text='一、填空题';},
  f=>{f.doc.blocks[f.answerAt+1].inlines[0].text='1.D2.B 另请参看题解';},
  f=>{f.doc.blocks[f.answerAt+1].warnings=['field_or_symbol'];f.doc.warnings.push('field_or_symbol');},
  f=>{f.doc.blocks[f.answerAt+1].inlines[0].text='1.AB2.B';},
  f=>{f.doc.blocks[f.answerAt+1].inlines[0].text='1.H2.B';},
  f=>{f.doc.blocks[5].inlines=f.doc.blocks[5].inlines.slice(0,1);f.doc.blocks[5].inlines[0].text='1. 未提供选项';},
  f=>{f.doc.blocks[5].inlines=[{kind:'text',text:'1. 未提供选项\nA. B. C. D.'}];},
 ]){const f=printedFixture();scenario(f);assert.equal(source(f.doc,1).canonical.answer,'');}
});
check('Competing questions, duplicate strips and table-paragraph answers stay ambiguous',()=>{
 const duplicate=printedFixture('1.D1.D2.B');
 assert.equal(source(duplicate.doc,1).canonical.answer,'');
 assert.equal(source(duplicate.doc,2).canonical.answer,'B');
 const repeated=printedFixture();
 repeated.doc.blocks[6].inlines[0].text=repeated.doc.blocks[6].inlines[0].text.replace('2．','1．');
 assert.equal(source(repeated.doc,1).canonical.answer,'');
 assert(source(repeated.doc,1).issues.includes('ambiguous_number'));
 const mixed=printedFixture();
 mixed.doc.blocks.push(table(clone()));
 assert.equal(source(mixed.doc,1).canonical.answer,'');
 const tableFirst=printedFixture('1.A2.B');
 tableFirst.doc.blocks.splice(tableFirst.answerAt+1,0,table(clone()));
 assert.equal(source(tableFirst.doc,1).canonical.answer,'');
 const annotated=printedFixture();
 annotated.doc.blocks.push(annotated.paragraph('1.C 解析见后',3));
 assert.equal(source(annotated.doc,1).canonical.answer,'');
 assert.equal(source(annotated.doc,2).canonical.answer,'B');
 const sections=printedFixture();
 sections.doc.blocks.push(sections.paragraph('参考答案',3));
 assert(source(sections.doc,1).issues.includes('separate_answers'));
});
check('An unclassified numbered section cannot inherit the preceding choice heading',()=>{
 const fixture=printedFixture();
 fixture.doc.blocks.splice(6,0,fixture.paragraph('二、开放题',4));
 assert.equal(source(fixture.doc,1).canonical.answer,'Ｄ');
 assert.equal(source(fixture.doc,2).canonical.answer,'');
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Real OOXML and production source indexing/role validation. Natural provider and teacher flow require separate evidence.'}));
