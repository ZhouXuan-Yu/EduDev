import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fixture} from './kb-book-match-boundaries.mjs';
import {MaterialBookAnswerRepository} from '../../src/main/assets/material-book-answer-repository.ts';
import {pageFragmentsDocument} from '../../src/main/assets/material-ai-page-fragments.ts';
import {editedPageCropDocument} from '../../src/main/assets/material-ai-page-crops.ts';
import {validQuestionDocument,isCompleteQuestionDocument} from '../../src/shared/question-document.ts';
import {questionFactConflicts} from '../../src/shared/question-facts.ts';
import {questionPresentation} from '../../src/shared/native-question.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';
import {questionVersion,readQuestionContextSource} from '../../src/main/education/question-context-provider.ts';
import {MaterialQuestionArchive} from '../../src/main/assets/material-question-archive.ts';
import {questionAnswerAttribution} from '../../src/shared/question-answer-attribution.ts';
import {compileRichPaperOffice} from '../../src/main/education/paper-rich-export.ts';
const sha=v=>createHash('sha256').update(v).digest('hex');
async function prepared(options={}){
 const f=fixture(options),proof=f.proofs.get(f.batch),q=await f.read(),parent=proof.final.questions[0];
 const image=page=>({assetId:'asset_'+randomUUID(),sha256:sha('controlled-page-'+page),mime:'image/png',width:100,height:100,page,box:[.1,.1,.9,.9],resourceId:f.pair.questionId,version:f.pair.questionVersion,engine:'pdf-page-v1'});
 const fragments=[4,5].map((page,i)=>({blockId:i?'next:block-1':'block-1',blockIds:[i?'next:block-1':'block-1'],image:image(page),quality:{schemaVersion:'xiaozhi.material-ai-crop-quality.v1',engine:'controlled-ocr',text:parent.stem,clearEdges:[true,true,true,true]}}));
 const doc=pageFragmentsDocument({...parent,answerOrigin:q.archive.answerOrigin,analysisOrigin:q.archive.analysisOrigin},{number:'1',image:fragments[0].image,quality:fragments[0].quality,fragments},f.batch,'deepseek-flash');
 q.archive.ai.policy='page-crop-complete.v1';
 f.db.prepare('UPDATE question_bank_items SET document_json=?,archive_json=? WHERE id=?').run(JSON.stringify(doc),JSON.stringify(q.archive),q.id);
 // Page furniture interrupts the transcript quote. The same full structured stem remains bound to the saved draft.
 for(const response of [proof.first,proof.final])response.pageText=response.pageText.replace('燃料热值','燃料\n第4页共5页\n热值');
 proof.firstSha=sha(JSON.stringify(proof.first));proof.finalSha=sha(JSON.stringify(proof.final));q.archive.ai.firstSha=proof.firstSha;q.archive.ai.finalSha=proof.finalSha;
 f.db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify(q.archive),q.id);f.db.prepare('UPDATE material_ai_page_units SET final_sha=? WHERE batch_id=?').run(proof.finalSha,f.batch);
 const original=f.host.writer;f.host.writer=(fn,before)=>original(()=>fn(new MaterialBookAnswerRepository(f.host)),before);
 await f.init();return f;
}
let checks=0;const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const use=async(options,fn)=>{const f=await prepared(options);try{await fn(f);}finally{f.db.close();}};
await check('Complete two-page image question writes both roles atomically with independent answer-source provenance and preserved primary images/context',()=>use({},async f=>{
 const before=await f.read(),view=await f.match(),q=await f.read();assert.equal(view.rows[0].state,'applied');assert.equal(q.document.schemaVersion,'xiaozhi.question-document.v3');assert(validQuestionDocument(q.document));assert(isCompleteQuestionDocument(q.document));assert(archiveEligible(q));assert.deepEqual(questionFactConflicts(q),[]);
 for(const role of ['answer','analysis']){const evidence=q.document[role];assert.equal(evidence.origin,'book_extracted');assert.deepEqual(evidence.anchors,[]);assert.equal(evidence.book.source.resourceId,f.pair.answerId);assert.equal(evidence.book.source.version,f.pair.answerVersion);assert.equal(evidence.book.source.page,3);assert.equal(evidence.book.batchId,f.answerBatch);assert.equal(evidence.book.candidateId,q.archive.book.roles[role].candidateId);assert.equal(evidence.text,q[role]);}
 assert.deepEqual(q.document.blocks,before.document.blocks);assert.deepEqual(q.document.context,before.document.context);assert.deepEqual(q.document.source,before.document.source);assert.deepEqual(q.document.blocks.filter(b=>b.kind==='image').map(b=>b.anchors[0].page),[4,5]);
 assert.deepEqual(await f.repo.validatedSourceDocument(q),before.document);await new MaterialBookAnswerRepository(f.host).validate(q);assert.equal(questionPresentation(q).authority,'ai');assert.match(questionAnswerAttribution(q,'answer').label,/答案册原文/);
 const store={getQuestionNotebookEntry:async()=>q,readArchivedQuestionContext:x=>f.repo.validate(x),readQuestionDocumentContext:async()=>q.document.context.projection};await readQuestionContextSource(store,{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)});
 const paper={id:'xipaper_'+randomUUID(),title:'独立答案册来源测试',digest:sha('paper'),blueprint:{grade:q.grade,subject:q.subject,durationMinutes:45,sections:[{id:'s',label:'解答题'}]},totalPoints:10,selection:{items:[{sectionId:'s',number:1,points:10,question:q,source:{version:questionVersion(q)}}]}};
 const student=compileRichPaperOffice(paper,'student'),teacher=compileRichPaperOffice(paper,'teacher');assert.equal(student.sections.flatMap(s=>s.figures||[]).length,2);assert.equal(teacher.sections.flatMap(s=>s.figures||[]).length,2);assert(JSON.stringify(teacher).includes('独立答案册原文'));assert(JSON.stringify(teacher).includes(q.analysis));assert(!JSON.stringify(student).includes(q.analysis));assert(!JSON.stringify(student).includes('答案册原文'));
 const saved=questionVersion(q);await f.match();assert.equal(questionVersion(await f.read()),saved);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1').get().n,1);
}));
await check('Missing answer is filled, answer-only books preserve separately generated analysis, conflicting answers remain candidates',async()=>{
 await use({currentAnswer:''},async f=>{assert.equal((await f.match()).rows[0].state,'applied');const q=await f.read();assert.equal(q.answer,'D');assert.equal(q.document.answer.origin,'book_extracted');});
 await use({answerText:'第十三、十四章 素养基础测试卷\n1. D'},async f=>{await f.match();const q=await f.read();assert.equal(q.document.answer.origin,'book_extracted');assert.equal(q.document.analysis.origin,'ai_generated');assert.equal(q.archive.analysisOrigin,'ai_generated');await f.repo.validate(q);});
 await use({currentAnswer:'B'},async f=>{const before=questionVersion(await f.read()),view=await f.match();assert.equal(view.rows[0].reason,'existing_answer_conflict');assert.equal(view.rows[0].answer,'D');assert.equal(questionVersion(await f.read()),before);});
});
await check('Teacher/source roles and unverified original questions remain protected',async()=>{for(const origin of ['teacher','source'])await use({origin},async f=>{const before=await f.read();await f.match();const q=await f.read();assert.equal(q.answer,before.answer);assert.equal(q.document.answer.origin,origin);assert(!q.archive.book?.roles.answer);});await use({questionIssues:['uncertain_ocr']},async f=>{const before=questionVersion(await f.read());assert.equal((await f.match()).rows[0].reason,'question_unchecked');assert.equal(questionVersion(await f.read()),before);});});
await check('New schema is strict; old v1/v2 cannot silently acquire external-book roles, getters and forged primary anchors are rejected',()=>use({},async f=>{
 await f.match();const q=await f.read();for(const mutate of [d=>d.schemaVersion='xiaozhi.question-document.v2',d=>d.schemaVersion='xiaozhi.question-document.v1',d=>d.answer.anchors.push({page:4,box:[0,0,1,1]}),d=>d.answer.book.source.version='bad',d=>d.answer.book.extra=true,d=>d.answer.book.ordinal=101,d=>d.answer.book.quoteSha='bad',d=>d.answer.book.source.page=100001]){const d=structuredClone(q.document);mutate(d);assert(!validQuestionDocument(d));}
 const d=structuredClone(q.document);Object.defineProperty(d.answer.book,'quoteSha',{enumerable:true,get(){throw Error('Getter must not execute');}});assert(!validQuestionDocument(d));assert(questionFactConflicts({...q,archive:undefined}).includes('answer'));
}));
await check('Either source receipt, exact quote proof, role document or journal corruption revokes eligibility without rewriting originals',async()=>{for(const mode of ['question','answer','quote','document','journal'])await use({},async f=>{
 await f.match();const q=await f.read();if(mode==='question')f.proofs.get(f.batch).firstSha='f'.repeat(64);if(mode==='answer')f.proofs.get(f.answerBatch).imageSha='f'.repeat(64);if(mode==='quote')q.document.answer.book.quoteSha='f'.repeat(64);if(mode==='document')q.document.analysis.text='Changed outside canonical role';if(mode==='journal')f.db.prepare("UPDATE material_book_answer_journal_v1 SET after_json='{}'").run();await assert.rejects(f.repo.validate(q));
});});
await check('Teacher editing one role detaches only that book proof; source-bound document edit keeps the other role and can remove both safely',()=>use({},async f=>{
 await f.match();let editor;editor=new MaterialQuestionArchive({...f.host,materials:()=>({}),revisePage:async(q,fields)=>editedPageCropDocument(q.document,fields),withWriter:async fn=>{f.db.exec('BEGIN IMMEDIATE');try{const v=await fn(editor);f.db.exec('COMMIT');return v;}catch(e){f.db.exec('ROLLBACK');throw e;}}});editor.validate=q=>f.repo.validate(q);
 const fields=q=>Object.fromEntries(['stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty'].map(k=>[k,q[k]]));let q=await f.read();await assert.rejects(editor.edit({questionId:q.id,version:questionVersion(q),sourceChecked:true,fields:{...fields(q),stem:'Changed stem'}}),/book_answer_question_changed/);
 await editor.edit({questionId:q.id,version:questionVersion(q),sourceChecked:true,fields:{...fields(q),answer:'Teacher answer'}});q=await f.read();assert.equal(q.document.schemaVersion,'xiaozhi.question-document.v3');assert.equal(q.document.answer.origin,'teacher');assert.equal(q.document.analysis.origin,'book_extracted');assert(!q.archive.book.roles.answer);await f.repo.validate(q);
 await editor.edit({questionId:q.id,version:questionVersion(q),sourceChecked:true,fields:{...fields(q),analysis:'Teacher analysis'}});q=await f.read();assert.equal(q.document.schemaVersion,'xiaozhi.question-document.v2');assert.equal(q.document.analysis.origin,'teacher');assert.deepEqual(q.archive.book.roles,{});assert(validQuestionDocument(q.document));await f.repo.validate(q);
}));
await check('Document, canonical facts and journal roll back together, cancellation and new-write kill switch preserve history',async()=>{
 await use({},async f=>{const before=questionVersion(await f.read());f.state.failAfterWrite=true;await assert.rejects(f.match(),/disk_full/);assert.equal(questionVersion(await f.read()),before);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_book_answer_journal_v1').get().n,0);});
 await use({},async f=>{const old=process.env.OMNI_EDU_BOOK_DOCUMENT_WRITEBACK;try{process.env.OMNI_EDU_BOOK_DOCUMENT_WRITEBACK='0';const before=questionVersion(await f.read());assert.equal((await f.match()).rows[0].reason,'unsupported');assert.equal(questionVersion(await f.read()),before);delete process.env.OMNI_EDU_BOOK_DOCUMENT_WRITEBACK;assert.equal((await f.match()).rows[0].state,'applied');await f.repo.validate(await f.read());}finally{old===undefined?delete process.env.OMNI_EDU_BOOK_DOCUMENT_WRITEBACK:process.env.OMNI_EDU_BOOK_DOCUMENT_WRITEBACK=old;}});
 await use({},async f=>{const controller=new AbortController();controller.abort();const before=questionVersion(await f.read());await assert.rejects(f.repo.match(f.input,controller.signal));assert.equal(questionVersion(await f.read()),before);});
});
console.log(JSON.stringify({success:true,checks,scope:'Real SQLite book writer/journal and actual document/source/Pi readback functions with controlled page/image receipts. Legacy matching suite also runs. Not natural OCR, provider answer correctness or whole-book/40GB.'}));
