import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const output=process.argv[2]||'test-results/goal/ma-delivery-20261014';fs.mkdirSync(output,{recursive:true});const entry=path.resolve(output,'classroom-contract.mjs');
await build({stdin:{contents:"export {createClassroomState} from './src/main/education/classroom-state';export {compileClassroomOffice,assertClassroomOffice} from './src/main/education/classroom-office';export {validOfficeDraft} from './src/shared/xiaozhi-office-draft';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:entry});
const {createClassroomState,compileClassroomOffice,assertClassroomOffice,validOfficeDraft}=await import(pathToFileURL(entry));
const source='test-results/education-journey-9U0u4m',proof=JSON.parse(fs.readFileSync(path.join(source,'report.json')));assert(proof.success);
const dbFile=path.join(output,'contract-owned.db');if(fs.existsSync(dbFile))throw Error('Owned evidence already exists');fs.copyFileSync(path.join(source,'data/app.db'),dbFile);
const db=new DatabaseSync(dbFile),sql={all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>db.prepare(q).run(...p)};
sql.transaction=async action=>{db.exec('BEGIN IMMEDIATE');try{const value=await action(sql);db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
const state=createClassroomState(sql),item=proof.classroom.saved,checks=[];const check=name=>checks.push({name,pass:true});
try{
 assert.deepEqual(await state.readConfirmed(item.sessionId,item.id,item.version),item);
 assert.deepEqual(await state.readConfirmedByTitle(item.sessionId,item.document.title,item.revision),item);
 await assert.rejects(()=>state.readConfirmedByTitle('other',item.document.title,item.revision),/permission_denied/);
 await assert.rejects(()=>state.readConfirmedByTitle(item.sessionId,item.document.title,item.revision-1),/conflict/);
 await assert.rejects(()=>state.readConfirmedByTitle(item.sessionId,item.document.title+' absent',item.revision),/conflict/);
 await assert.rejects(()=>state.readConfirmed('other',item.id,item.version),/permission_denied/);
 await assert.rejects(()=>state.readConfirmed(item.sessionId,item.id,'0'.repeat(64)),/conflict/);
 const old=proof.classroom.initial;await assert.rejects(()=>state.readConfirmed(old.sessionId,old.id,old.version),/conflict/);
 check('Same actual confirmed classroom: session isolation, exact version and superseded head fence');
 const teacher=compileClassroomOffice(item,true),student=compileClassroomOffice(item,false);assert(validOfficeDraft(teacher)&&validOfficeDraft(student));assert.deepEqual(teacher.classroomSource.document,item.document);assert(!student.sections.flatMap(s=>s.paragraphs).some(s=>s.startsWith('参考答案')||s.startsWith('解析')));assertClassroomOffice(item,teacher);
 const changed=structuredClone(teacher);changed.classroomSource.document.scenes[0].title+='changed';assert.throws(()=>assertClassroomOffice(item,changed),/conflict/);check('Deterministic exact source snapshot, student section answer exclusion and rejection of rewritten source');
 for(const purpose of ['handout','teacher_notes']){
  const draft=compileClassroomOffice(item,purpose==='teacher_notes',purpose);assert(validOfficeDraft(draft));assertClassroomOffice(item,draft);assert.equal(draft.sections.length,item.document.scenes.length+1);assert.deepEqual(draft.classroomSource.document,item.document);
  assert.equal(draft.sections.flatMap(s=>s.paragraphs).some(s=>s.startsWith('参考答案')),purpose==='teacher_notes');
  const changed=structuredClone(draft);changed.sections[1].paragraphs.push('unreviewed generated narration');assert.throws(()=>assertClassroomOffice(item,changed),/conflict/);
  const legacy=structuredClone(draft);legacy.schemaVersion=teacher.schemaVersion;assert(!validOfficeDraft(legacy));
  const wrongAudience=structuredClone(draft);wrongAudience.classroomSource.includeAnswers=purpose!=='teacher_notes';assert(!validOfficeDraft(wrongAudience));
 }
 assert.throws(()=>compileClassroomOffice(item,true,'handout'),/invalid_input/);assert.throws(()=>compileClassroomOffice(item,false,'teacher_notes'),/invalid_input/);
 check('Word/PDF versioned contract preserves source, fixes audience answer policy, and rejects rewritten notes or legacy schema drift');
 let installed=0;await state.withConfirmedSource(item.sessionId,item.id,item.version,()=>{installed++;});assert.equal(installed,1);
 await state.decide({id:item.id,version:item.version,decision:'confirm',document:{...item.document,title:item.document.title+' · 新修订'}});
 await assert.rejects(()=>state.withConfirmedSource(item.sessionId,item.id,item.version,()=>{installed++;}),/conflict/);assert.equal(installed,1);check('New teacher revision prevents stale final installation inside the same SQLite CAS');
}finally{db.close();}
fs.writeFileSync(path.join(output,'contract-example.json'),JSON.stringify({success:true,checks,boundary:'Owned accepted real classroom copy, contract/CAS only; native file rendering tested separately'},null,2));console.log(JSON.stringify({success:true,checks:checks.length}));
