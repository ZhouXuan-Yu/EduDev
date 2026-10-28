import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const {extractMaterialQuestions}=await import('../../src/main/assets/material-question-extract.ts');
const fixture=text=>[{resourceId:'resource_'+randomUUID(),version:createHash('sha256').update(text).digest('hex'),title:'自有结构反例',offset:0,chunk:{id:'chunk_'+randomUUID(),chunkIndex:0,contentMd:text,containsPersonalData:false,pageNumber:1}}];
const body='1. 科学探索与生活。\n(1) 下列粒子中带负电的是哪一种？\nA.电子 B.质子\n(2) 选涂正确结果。\n2. 阅读以下情境。\n(1) 选涂“A成立”或“B不成立”。';
const source='物理部分\n特别提示：\n1. 选择题中每题只能选择一个选项。\n2. 除选择和填空均需写出过程。\n一、基础与生活（20分）\n'+body;
const questions=extractMaterialQuestions(fixture(source),'local-text-v1');
assert.deepEqual(questions.map(q=>q.archive.number),['1','2'],'Exam instructions are not questions; cues may occur in subquestions');
assert(questions.every(q=>!q.archive.sourceRisks.includes('ambiguous_number')),'Ordered complete subquestions are one parent question');
assert(questions[0].fields.stem.includes('(2) 选涂正确结果。'));
for(const text of [body.replace('(2)','(3)'),body.replace('(2)','(1)'),body.replace('(1)','(2)')]){
 assert(extractMaterialQuestions(fixture(text),'local-text-v1')[0].archive.sourceRisks.includes('ambiguous_number'));
}
assert(extractMaterialQuestions(fixture(body+'\n1. 求重新编号的结果？'),'local-text-v1').every(q=>q.archive.sourceRisks.includes('ambiguous_number')));
const {normalizeMaterialStem}=await import('../../src/main/assets/material-question-extract.ts');
assert.equal(normalizeMaterialStem('地球是（选涂“A 行星”）。'),normalizeMaterialStem('地球是______（选涂“A行星”）。'));
for(const [a,b] of [['1.5','15'],['x-(y+1)','x-y+1'],['一定成立','不一定成立'],['A电子 B质子','A质子 B电子'],['x_1','x1'],['变量a___b','变量ab']])assert.notEqual(normalizeMaterialStem(a),normalizeMaterialStem(b));
console.log(JSON.stringify({passed:14,scope:'Synthetic exam instructions, complete numbered blocks, ordered subquestions and presentation-only blank compatibility; mathematical/option/negation changes remain distinct'}));
