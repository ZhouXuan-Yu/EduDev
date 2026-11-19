import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {equivalentFigureSpacing,FIGURE_LABEL_SPACING} from '../../src/shared/material-ai-figure-spacing.ts';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {MaterialChoiceRechecks} from '../../src/main/assets/material-ai-choice-rechecks.ts';
import {readAiPageReceipt} from '../../src/main/assets/material-ai-page-evidence.ts';
import {validateAiPageSource} from '../../src/main/assets/material-ai-page-source.ts';
import {readPageCrops,pageCropAgrees} from '../../src/main/assets/material-ai-page-crops.ts';
import {restoredResponseQuestions} from '../../src/main/assets/material-ai-page-content.ts';
import {isCompleteQuestionDocument,validQuestionDocument} from '../../src/shared/question-document.ts';

const suffix='\nR₁\nh甲\nL2';
const left='图中标注 R₁、h甲、L2，间距 1.5 m。'+suffix;
const right='图中标注R₁、h甲、L2，间距 1.5 m。'+suffix;
assert(equivalentFigureSpacing(left,right,suffix.slice(1)));
assert(equivalentFigureSpacing(left.replaceAll('\n','\r\n'),right,suffix.slice(1)));
for(const changed of [
  right.replace('1.5 m','1．5 m'),
  right.replace('1.5 m','1.5 mm'),
  right.replace('R₁、','R₂、'),
  right.replace('R₁、','R₁R₁、'),
  right.replace('R₁、','R ₁、'),
  right.replace('L2，','L3，'),
  right.replace('间距','高度'),
  right.replace('标注R','标注\nR'),
  right.replace(suffix,'\nR₁\nL2\nh甲'),
  right.replace(suffix,'\nR₁\nh甲\nL₂'),
  right+ '。'
])assert(!equivalentFigureSpacing(left,changed,suffix.slice(1)),changed);
assert(!equivalentFigureSpacing(left,right,''));
assert(!equivalentFigureSpacing(left,right,'R₁'));
assert(!equivalentFigureSpacing(left.replace(' R₁',' R₁x'),right.replace('R₁、','R₁x、'),suffix.slice(1)));
console.log('PASS unrelated figure, shared literal suffix, exact annotation, descriptions, mathematics and embedded token guards');

const data=path.resolve(process.argv[2]??'');
assert(process.argv[2], 'Pass the isolated natural-data directory');
const batch='aibatch_905bfe20-82d3-42c8-8cad-3c393f2e227e';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'figure-spacing-'));
const original=new DatabaseSync(process.argv[3]??path.join(data,'app.db'),{readOnly:true});
await backup(original,path.join(tmp,'copy.db'));
original.close();
const db=new DatabaseSync(path.join(tmp,'copy.db'));
const host={root:()=>data,all:async(sql,args=[])=>db.prepare(sql).all(...args),run:async(sql,args=[])=>db.prepare(sql).run(...args)};
host.proof=async(id,ordinal)=>{
 const proof=await readAiPageReceipt(host,id,ordinal);
 await validateAiPageSource(host,proof.unit.pageSource);
 return proof;
};
try{
 const proof=await host.proof(batch,1), {pagePrompt:prompt,pageSource:source}=proof.unit;
 const unit=db.prepare('SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch);
 const crops=await readPageCrops(host,batch,1,source,proof.first,unit.first_json,proof.imageSha,AbortSignal.timeout(8000),undefined,prompt);
 const old={...prompt,sourceLayoutPolicy:'source-layout-text.v1',choiceAnswerPolicy:'printed-choice-answer.v1'};
 const enabled={...old,sourceFigureSpacingPolicy:FIGURE_LABEL_SPACING};
 assert(validAiPagePrompt(enabled));
 for(const invalid of [{...enabled,sourceFigureSpacingPolicy:'future'},{...enabled,sourceLayoutPolicy:undefined},{...enabled,sourceReadingPolicy:undefined},{...enabled,literalReadingPolicy:undefined}])assert(!validAiPagePrompt(invalid));
 const comparison=proof.review||proof.first,final=proof.final;
 const stem=restoredResponseQuestions(final,source,prompt,crops).find(x=>x.number==='2').fields.stem;
 assert(!pageCropAgrees(comparison,final,'2',crops,stem,prompt));
 assert(!pageCropAgrees(comparison,final,'2',crops,stem,old));
 assert(pageCropAgrees(comparison,final,'2',crops,stem,enabled));
 assert(!pageCropAgrees(comparison,final,'2',crops,stem,{...enabled,literalReadingPolicy:undefined}));
 const figureIndex=final.readings.find(x=>x.number==='2').crops.findIndex(x=>x.parts?.every(p=>p.role==='figure')&&x.text);
 assert(figureIndex>=0);
 for(const change of [
  d=>{d.readings.find(x=>x.number==='2').crops[figureIndex].ocrSha256='1'.repeat(64);},
  d=>{d.readings.find(x=>x.number==='2').crops[figureIndex].assessment='uncertain';},
  d=>{d.readings.find(x=>x.number==='2').crops[figureIndex].parts[0].role='body';},
  d=>{d.questions.find(x=>x.number==='2').projection.figures.text+='。';},
  d=>{d.questions.find(x=>x.number==='2').projection.figures.text=d.questions.find(x=>x.number==='2').projection.figures.text.replace('甲较高','甲较低');},
  d=>{d.questions.find(x=>x.number==='2').projection.figures.text=d.questions.find(x=>x.number==='2').projection.figures.text.replaceAll('h甲','h乙');},
  d=>{d.fragments.find(x=>x.number==='2').complete=false;}
 ]){
  const d=structuredClone(final);change(d);
  assert(!pageCropAgrees(comparison,d,'2',crops,stem,enabled),change.toString());
 }
 console.log('PASS real independent illustrated receipt proves the spacing-only case and rejects changed labels, geometry roles and provenance');
 const qBefore=db.prepare('SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? AND m.ordinal=1 AND m.number=?').get(batch,'2');
 const action=new MaterialChoiceRechecks(host);
 db.exec('BEGIN IMMEDIATE');
 const t=performance.now();
 const applied=await action.apply(batch,'layout');
 const elapsedMs=performance.now()-t;
 assert(applied>=1);
 const qAfter=db.prepare('SELECT * FROM question_bank_items WHERE id=?').get(qBefore.id);
 const row=db.prepare('SELECT * FROM material_ai_choice_rechecks WHERE question_id=?').get(qBefore.id);
 assert.equal(row.policy,FIGURE_LABEL_SPACING);
 const {document_json:oldDocument,archive_json:oldArchive,...before}=qBefore;
 const {document_json:newDocument,archive_json:newArchive,...after}=qAfter;
 assert.deepEqual(after,before);
 assert.equal(oldDocument,'');
 const archive=JSON.parse(newArchive),document=JSON.parse(newDocument);
 assert.equal(archive.sourceChecked,false);
 assert(archive.issues.includes('incomplete_question'),'The unknown subsequent page still prevents final status');
 assert(isCompleteQuestionDocument(document)&&validQuestionDocument(document));
 assert.equal(document.context.projection.figures.text,final.questions.find(q=>q.number==='2').projection.figures.text);
 assert.equal(document.context.sourceContent.crops.length,2);
 assert.deepEqual(db.prepare('SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch),unit);
 assert.equal((await action.promptFor({id:qBefore.id,archive},proof,crops,'unknown')).sourceFigureSpacingPolicy,FIGURE_LABEL_SPACING);
 assert.equal(await action.apply(batch,'layout'),0);
 db.prepare('UPDATE material_ai_choice_rechecks SET proof_sha=? WHERE question_id=?').run('1'.repeat(64),qBefore.id);
 await assert.rejects(action.promptFor({id:qBefore.id,archive},proof,crops,'unknown'),/source_changed/);
 db.exec('ROLLBACK');
 assert.equal(db.prepare('SELECT document_json FROM question_bank_items WHERE id=?').get(qBefore.id).document_json,'');
 console.log(JSON.stringify({success:true,appliedInCopy:applied,localActionMs:Math.round(elapsedMs),keptIssues:archive.issues,paidCalls:0}));
}finally{
 db.close();
 const resolved=fs.realpathSync(tmp);
 assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
 assert(path.basename(resolved).startsWith('figure-spacing-'));
 fs.rmSync(resolved,{recursive:true,force:true});
}
