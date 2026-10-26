import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
const {validExplanationDraft,completeQuestionExplanation}=await import('../../src/main/education/question-explanation.ts');
const {contextHistory,latestOriginalVersion,appendExplanationRevision,appendContextRevision}=await import('../../src/main/education/question-context-revision.ts');
const {questionExplanationCoverage}=await import('../../src/shared/question-explanation-coverage.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const desktop=path.resolve('..','desktop'),report=JSON.parse(fs.readFileSync(path.join(desktop,'test-results/education-journey-5Z2TqU/report.json'))),db=new DatabaseSync(path.join(desktop,'test-results/education-journey-5Z2TqU/data/app.db'),{readOnly:true});
const raw=db.prepare('SELECT * FROM question_bank_items WHERE id=?').get(report.result.questionId),row=db.prepare("SELECT * FROM ai_confirmation_items WHERE action_type='pi_original_question_multi_candidate' AND json_extract(result_json,'$.saved.questionId')=?").get(raw.id);db.close();
const q={id:raw.id,subject:raw.subject,grade:raw.grade,knowledgePoint:raw.knowledge_point,questionType:raw.question_type,difficulty:raw.difficulty,stem:raw.stem,answer:raw.answer,analysis:raw.analysis,sourceTitle:raw.source_title,sourceKind:raw.source_kind,tags:JSON.parse(raw.tags),createdAt:raw.created_at,updatedAt:raw.updated_at,document:JSON.parse(raw.document_json)};
const generator={provider:'deepseek',model:'boundary',runId:'airun_'+randomUUID()},requestId='xiquestion_'+randomUUID(),answer='(1)①R=U/I。②须核对接线与可调范围。\n(2)①B。②尚需完整条件核对。③刻度未明确，不默认读数。',analysis='(1)①分别测电压和电流。②根据额定电压及最大阻值判断。\n(2)①结合两组电压电流变化。②根据灯泡与变阻器串联关系，不能估算补值。③先核对电流表分度与偏转方向。';
const draft={title:'原题解析',reason:'补缺',subject:q.subject,grade:q.grade,knowledgePoint:q.knowledgePoint,items:[{questionType:'short_answer',stem:q.stem,answer,analysis,options:null,difficulty:q.difficulty}]};
const checks=[],check=(name,f)=>{f();checks.push(name);console.log('PASS '+name);};
check('Nested original subquestions accept grouped or repeated parent labels, detect missing/duplicate children',()=>{
 const required=q.document.context.projection.subquestions.text;assert.deepEqual(questionExplanationCoverage(required,answer,analysis).answerMissing,[]);
 assert.deepEqual(questionExplanationCoverage(required,answer.replace('②尚需完整条件核对。',''),analysis).answerMissing,['2.2']);
 assert(questionExplanationCoverage(required,answer+'\n(2)①重复。',analysis).answerMissing.includes('2.1'));
 assert.deepEqual(questionExplanationCoverage(required,answer.replace('①R=U/I。②','①R=U/I。\n(1)②'),analysis).answerMissing,[]);
});
check('Explanation locks original metadata, source, stem/type and existing evidence',()=>{
 assert(validExplanationDraft(draft,[q]));for(const field of ['subject','grade','knowledgePoint'])assert(!validExplanationDraft({...draft,[field]:'changed'},[q]));
 for(const patch of [{stem:'changed'},{questionType:'written'},{options:{A:'x'}},{difficulty:'easy'}])assert(!validExplanationDraft({...draft,items:[{...draft.items[0],...patch}]},[q]));
 const prior={...q,answer:'已有答案',document:{...q.document,answer:{origin:'teacher',text:'已有答案',anchors:[]}}};
 assert(!validExplanationDraft(draft,[prior]));
});
check('Same original version chain preserves images, records AI/teacher provenance and rejects tampering',()=>{
 const effect=JSON.parse(row.result_json),next=appendExplanationRevision(row,effect,q,answer,analysis,generator,{answer:'ai_generated',analysis:'teacher'},requestId);
 assert.equal(next.revision.after.id,q.id);assert.deepEqual(next.revision.after.document.blocks,q.document.blocks);assert.equal(next.revision.after.document.answer.origin,'ai_generated');assert.equal(next.revision.after.document.analysis.origin,'teacher');assert.equal(latestOriginalVersion(row,next.effect),questionVersion(next.revision.after));
 const tampered=structuredClone(next.effect);tampered.contextRevisions.at(-1).after.stem='changed';assert.throws(()=>contextHistory(row,tampered));
 const corrected=appendContextRevision(row,next.effect,next.revision.after,q.document.context.projection,'xicontext_'+randomUUID());assert.equal(contextHistory(row,corrected.effect).length,contextHistory(row,effect).length+2);
});
const batch=process.argv.includes('--batch-metadata');if(batch)check('v8 batch keeps each source metadata independently; v7 remains strict, item swaps and locked-answer edits are rejected',()=>{
 const second={...structuredClone(q),id:'question_'+randomUUID(),knowledgePoint:'另一原题的独立知识点',stem:'另一原题题面',difficulty:'medium'};
 const grouped={...draft,items:[draft.items[0],{...draft.items[0],stem:second.stem,difficulty:second.difficulty}]};
 assert(validExplanationDraft(grouped,[q,second]));assert(!validExplanationDraft(grouped,[q,second],true));assert(validExplanationDraft(draft,[q],true));
 assert(!validExplanationDraft({...grouped,knowledgePoint:second.knowledgePoint},[q,second]));assert(!validExplanationDraft({...grouped,items:[grouped.items[1],grouped.items[0]]},[q,second]));
 const locked={...second,answer:'已有独立答案',document:{...second.document,answer:{origin:'teacher',text:'已有独立答案',anchors:[]}}};assert(!validExplanationDraft(grouped,[q,locked]));
 assert(validExplanationDraft({...grouped,items:[grouped.items[0],{...grouped.items[1],answer:locked.answer}]},[q,locked]));
});
fs.writeFileSync(path.join(desktop,'test-results/goal',batch?'kb-explanation-batch-20261013':'kb-explanation-20261013','boundaries.json'),JSON.stringify({success:true,checks},null,2));
