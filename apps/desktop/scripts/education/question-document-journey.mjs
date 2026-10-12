import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
/** Native migration/readback contract only: original parser/review UI are intentionally not simulated. */
export async function questionDocumentJourney(ctx){
 const {data,output,report,launch,navigate,until,check,restart}=ctx,page=()=>ctx.page();
 report.boundaries=['Teacher creates text question via current UI; actual Electron native SQLite new/old migration, versioned IPC and cold readback','Structured metadata is an explicitly synthetic owned storage fixture, not extracted/teacher-confirmed original, asset authorization, full R1-B or solver acceptance'];
 const filename=path.resolve(data,'app.db');assert(filename.startsWith(path.resolve(output)+path.sep));
 const read=()=>{const db=new DatabaseSync(filename,{readOnly:true});try{return db.prepare('SELECT * FROM question_bank_items ORDER BY created_at').all();}finally{db.close();}};
 const change=fn=>{const db=new DatabaseSync(filename);try{fn(db);}finally{db.close();}};
 const facts=r=>({id:r.id,subject:r.subject,grade:r.grade,knowledgePoint:r.knowledge_point,questionType:r.question_type,difficulty:r.difficulty,stem:r.stem,answer:r.answer,analysis:r.analysis,sourceTitle:r.source_title,sourceKind:r.source_kind,tags:JSON.parse(r.tags),createdAt:r.created_at,updatedAt:r.updated_at,...(r.document_json?{document:JSON.parse(r.document_json)}:{})});
 const source=r=>({schemaVersion:'xiaozhi.education.question-context.v1',questionId:r.id,version:createHash('sha256').update(JSON.stringify(facts(r))).digest('hex')});
 const typed=async s=>{const result=await page().evaluate(value=>window.omniEdu.getQuestionContextSource(value),s);if(!result.ok)throw new Error(result.error);return result.value;};
 await launch();await navigate('teaching');await page().getByTestId('nav-question_notebook').click();
 const marker='B1旧题-'+randomUUID();await page().getByTestId('question-notebook-new-stem').fill(marker);await page().getByTestId('question-notebook-new-answer').fill('教师填写文本，未认定标准答案');await page().getByTestId('question-notebook-create-question').click();await until(async()=>await page().getByTestId('question-notebook-new-stem').inputValue()==='');
 const before=read();assert.equal(before.length,1);assert.equal(before[0].document_json,'');const oldSource=source(before[0]);assert.deepEqual((await typed(oldSource)).question,facts(before[0]));
 await page().screenshot({path:path.join(output,'question-document-legacy-ui.png'),animations:'disabled'});report.visuals.push({png:'question-document-legacy-ui.png',label:'existing text question; no new structured editor'});
 check('Native new database default keeps actual teacher-created text facts and legacy SHA through typed IPC');
 await restart(false,false);fs.copyFileSync(filename,path.join(output,'before-old-schema.db'));change(db=>db.exec('ALTER TABLE question_bank_items DROP COLUMN document_json'));
 assert(!('document_json' in read()[0]));await launch();assert.deepEqual(read(),before);assert.deepEqual((await typed(oldSource)).question,facts(before[0]));
 check('Actual old schema copy migrates additively at native startup without changing teacher facts or legacy source version');
 await restart(false,false);
 const anchors=[{page:1,box:[0.1,0.1,0.9,0.8]}],document={schemaVersion:'xiaozhi.question-document.v1',source:{resourceId:'resource_'+randomUUID(),resourceVersion:'a'.repeat(64),parserVersion:'synthetic-storage.v1',ocrVersion:''},blocks:[{id:'formula',kind:'latex',text:'U=IR',anchors},{id:'figure',kind:'image',assetId:'asset_'+randomUUID(),sha256:'b'.repeat(64),mime:'image/png',width:800,height:600,anchors}],answer:{origin:'missing',text:'',anchors:[]},analysis:{origin:'missing',text:'',anchors:[]}};
 change(db=>db.prepare('UPDATE question_bank_items SET document_json=? WHERE id=?').run(JSON.stringify(document),before[0].id));await launch();
 const withDocument=read()[0],structuredSource=source(withDocument);await assert.rejects(typed(oldSource),/source_changed/);assert.deepEqual((await typed(structuredSource)).question,facts(withDocument));
 check('Synthetic formula/figure/origin metadata is included in actual native versioned readback; legacy CAS is rejected');
 await restart();assert.deepEqual((await typed(structuredSource)).question,facts(withDocument));assert.deepEqual(read()[0],withDocument);
 check('Cold native restart preserves structured metadata exactly without replay or extra question writes');
 document.blocks[1].sha256='c'.repeat(64);change(db=>db.prepare('UPDATE question_bank_items SET document_json=? WHERE id=?').run(JSON.stringify(document),before[0].id));await assert.rejects(typed(structuredSource),/source_changed/);
 const changed=source(read()[0]);assert.equal((await typed(changed)).question.document.blocks[1].sha256,'c'.repeat(64));
 check('Figure-only change invalidates an already read source through actual typed IPC');
 change(db=>db.prepare('UPDATE question_bank_items SET document_json=? WHERE id=?').run('{',before[0].id));await assert.rejects(typed(changed),/unavailable/);
 change(db=>db.prepare('UPDATE question_bank_items SET document_json=? WHERE id=?').run(JSON.stringify(document),before[0].id));await restart();assert.equal((await typed(changed)).question.document.blocks[1].sha256,'c'.repeat(64));
 check('Corrupt stored metadata refuses reads; restored owned fixture survives native cold read without downgrade');
 report.result={modelRequests:0,questionCount:read().length,legacySource:oldSource,structuredSource,changedSource:changed,fixture:'synthetic metadata only',facts:read()};fs.writeFileSync(path.join(output,'readback.json'),JSON.stringify(report.result,null,2));
}
