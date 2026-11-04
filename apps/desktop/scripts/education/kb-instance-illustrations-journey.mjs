import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {enterPaper,choose} from '../acceptance/paper-basket-ui-driver.mjs';
import {createInstanceBasket,readInstanceBasket,instanceStage} from '../acceptance/paper-instance-ui-driver.mjs';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
import {compileInstancePaperOffice} from '../../src/main/education/paper-instance-export.ts';
import {generateOfficeDocument} from '../../src/main/xiaozhi-agent/office-generator.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
/** Extend one owned recursive-import fixture; all mutations start at actual teacher UI. */
export async function runInstanceIllustrationsJourney({page,report,output,questionId,sql,coldRestart}){
 const source=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId),version=questionVersion(source);
 assert(!source.document.context.presentation,'Default imported source must work without prior global correction');
 assert(source.document.context.illustrations.complete);assert.equal(source.document.context.illustrations.blockIds.length,1);
 const canonical=JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId]));
 const bookFacts=JSON.stringify(sql('SELECT * FROM material_book_answer_journal_v1'));
 const gallery=await page.evaluate(input=>window.omniEdu.getOriginalQuestionGallery(input),{schemaVersion:'xiaozhi.education.original-review.v2',questionId,version});assert(gallery.ok);
 const owner=await page.evaluate(()=>window.omniEdu.createAiConversationSession({title:'本卷独立题图验收'}));await enterPaper(page);
 const basket=await createInstanceBasket({page,report},owner.session.id,source,'本卷改题保留烧杯插图');
 await instanceStage({page},owner.session.id,basket.id,'organize');
 let card=page.getByTestId('paper-basket-entry').filter({has:page.getByTestId('paper-instance-editor')});
 await card.getByTestId('paper-instance-open').click();await card.getByTestId('paper-instance-edit-question').click();
 const role=card.getByTestId('paper-instance-role-question'),stem='本卷调整：根据烧杯示意图，说明标准大气压下纯水的沸点。';
 assert.equal(await role.getByTestId('paper-instance-source-image').count(),1);
 await role.getByTestId('paper-instance-text').first().fill(stem);
 await role.getByRole('button',{name:'移除第 2 块',exact:true}).click();await card.getByTestId('paper-instance-save').click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="paper-instance-content"] [role="alert"]')?.textContent.includes('原图'));
 let saved=await readInstanceBasket(page,owner.session.id,basket.id);assert.equal(saved.entries[0].deliveryBlock,'image_dependency');assert(await card.getByTestId('paper-instance-confirm').isDisabled());
 report.checks.push('Actual default imported v3 question seeds only its independent diagram; removing a required figure saves a recoverable draft and blocks delivery');
 await role.getByTestId('paper-instance-add-figure').click();await card.getByTestId('paper-instance-save').click();
 let image=card.getByTestId('paper-instance-figure-image');await image.waitFor();await image.evaluate(img=>img.decode());
 await card.getByTestId('paper-instance-confirm').and(page.locator(':enabled')).waitFor();
 // Reorder with the actual editor, then confirm only this exact saved revision.
 await role.getByRole('button',{name:'上移第 2 块',exact:true}).click();await card.getByTestId('paper-instance-save').click();
 image=card.getByTestId('paper-instance-figure-image');await image.waitFor();await image.evaluate(img=>img.decode());
 await card.getByTestId('paper-instance-confirm').and(page.locator(':enabled')).waitFor();await card.getByTestId('paper-instance-confirm').click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="paper-instance-review-state"]')?.textContent.includes('当前修订已核对'));
 saved=await readInstanceBasket(page,owner.session.id,basket.id);assert(saved.entries[0].reviewCurrent);assert.equal(saved.entries[0].instance.content.question.blocks[0].type,'sourceImage');
 await instanceStage({page},owner.session.id,basket.id,'preview');
 let preview=page.getByTestId('paper-basket-preview-entry');image=preview.getByTestId('paper-instance-figure-image');await image.waitFor();await image.evaluate(img=>img.decode());
 assert.equal(await preview.getByTestId('paper-basket-answer').count(),0);assert.equal(await preview.locator('img').count(),1);
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await preview.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'instance-illustration-'+width+'.png')});}
 await page.getByTestId('paper-basket-confirm-all').and(page.locator(':enabled')).waitFor();await page.getByTestId('paper-basket-confirm-all').click();await page.getByTestId('paper-export-entry').waitFor();
 const row=sql("SELECT id FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' AND session_id=? ORDER BY created_at DESC LIMIT 1",[owner.session.id])[0];assert(row);
 const confirmed=await page.evaluate(input=>window.omniEdu.reviewPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:owner.session.id,id:row.id});assert(confirmed.ok,JSON.stringify(confirmed));assert.equal(confirmed.value.state,'confirmed');assert(confirmed.value.exportCurrent);
 report.checks.push('Actual editor re-adds/reorders the immutable diagram, confirms the saved revision, previews both desktop sizes with no student answers, and confirms a real paper snapshot');
 const imageMap=new Map(gallery.value.map(i=>[i.assetId,Buffer.from(i.dataUrl.split(',')[1],'base64')]));
 const files=[];
 for(const audience of ['student','teacher']){
  const draft=compileInstancePaperOffice(confirmed.value,audience),figures=draft.sections.flatMap(s=>s.figures||[]);assert.equal(figures.filter(f=>f.role==='question').length,1);
  const bytes=await generateOfficeDocument('docx',draft,{dataRoot:output,images:imageMap});const file=path.join(output,'instance-'+audience+'.docx');fs.writeFileSync(file,bytes);
  const inspect=JSON.parse(execFileSync('python',['-c',"import sys,zipfile,hashlib,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({'xml':z.read('word/document.xml').decode(),'media':[hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/media/') and not n.endswith('/')]},ensure_ascii=False))",file],{encoding:'utf8',windowsHide:true}));
  assert(inspect.xml.includes(stem));assert.equal(inspect.xml.includes(source.analysis),audience==='teacher');assert.equal(inspect.xml.includes(source.answer),audience==='teacher');
  const figure=figures.find(f=>f.role==='question');assert(inspect.media.includes(figure.sha256));assert(!figures.some(f=>f.blockId==='source_question_0'));
  files.push({audience,name:path.basename(file),sha256:sha(bytes),diagramSha256:figure.sha256,bytes:bytes.length});
 }
 assert.equal(JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId])),canonical);assert.equal(JSON.stringify(sql('SELECT * FROM material_book_answer_journal_v1')),bookFacts);
 report.checks.push('Actual DOCX generator reads the UI-confirmed instance and archived diagram bytes for student/teacher files; parent question, source version and answer-book journal remain byte-identical');
 page=await coldRestart();await enterPaper(page);await page.getByTestId('paper-basket-owner-search').fill(owner.session.id);await choose(page,page.getByTestId('paper-basket-owner'),owner.session.id);
 await page.getByTestId('paper-basket-stage-preview').click();preview=page.getByTestId('paper-basket-preview-entry');await preview.getByTestId('paper-instance-figure-image').waitFor();await preview.getByTestId('paper-instance-figure-image').evaluate(img=>img.decode());await page.getByTestId('paper-export-entry').waitFor();
 const cold=await readInstanceBasket(page,owner.session.id,basket.id);assert.deepEqual(cold.entries[0].instance,saved.entries[0].instance);assert.equal(questionVersion(cold.entries[0].question),version);assert.equal(JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId])),canonical);assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');
 report.checks.push('Cold production UI restores the same reviewed instance, ordered diagram and confirmed-paper export entry without provider replay or canonical edits');
 report.instanceIllustrations={questionId,version,basketId:basket.id,paperId:row.id,formalPaperConfirmed:true,officeFilesGenerated:true,files,officePipeline:'Actual generator over production UI-confirmed snapshot; Composer export approval and PDF/Office/WPS visual opening are not run'};
}

/** Read an existing successful fixture after a main integration; never replay import/model work. */
export async function readbackInstanceIllustrations({page,report,output,sql,proof}){
 assert(proof.formalPaperConfirmed&&proof.officeFilesGenerated);
 const owner=sql('SELECT session_id FROM ai_confirmation_items WHERE id=?',[proof.paperId])[0].session_id;
 const before=JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[proof.questionId]));
 const facts=JSON.stringify(sql('SELECT * FROM material_book_answer_journal_v1'));
 const saved=await readInstanceBasket(page,owner,proof.basketId);
 assert(saved.entries[0].reviewCurrent);assert.equal(saved.entries[0].contentVersion,proof.version);
 const source=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:proof.questionId,version:proof.version});assert(source.ok,JSON.stringify(source));
 await enterPaper(page);await page.getByTestId('paper-basket-owner-search').fill(owner);await choose(page,page.getByTestId('paper-basket-owner'),owner);await page.getByTestId('paper-basket-stage-preview').click();
 const preview=page.getByTestId('paper-basket-preview-entry');await preview.getByTestId('paper-instance-figure-image').waitFor();await preview.getByTestId('paper-instance-figure-image').evaluate(img=>img.decode());await page.getByTestId('paper-export-entry').waitFor();
 assert.equal(await preview.locator('img').count(),1);assert.equal(await preview.getByTestId('paper-basket-answer').count(),0);
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await preview.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'integrated-instance-'+width+'.png')});}
 const confirmed=await page.evaluate(input=>window.omniEdu.reviewPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:owner,id:proof.paperId});assert(confirmed.ok&&confirmed.value.exportCurrent);assert.deepEqual(confirmed.value.selection.items[0].instance,saved.entries[0].instance);
 const gallery=await page.evaluate(input=>window.omniEdu.getOriginalQuestionGallery(input),{schemaVersion:'xiaozhi.education.original-review.v2',questionId:proof.questionId,version:proof.version});assert(gallery.ok);
 const images=new Map(gallery.value.map(i=>[i.assetId,Buffer.from(i.dataUrl.split(',')[1],'base64')]));
 const files=[];
 for(const audience of ['student','teacher']){
  const draft=compileInstancePaperOffice(confirmed.value,audience),bytes=await generateOfficeDocument('docx',draft,{dataRoot:output,images});
  const name='integrated-instance-'+audience+'.docx';fs.writeFileSync(path.join(output,name),bytes);
  const inspected=JSON.parse(execFileSync('python',['-c',"import sys,zipfile,json,hashlib;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({'xml':z.read('word/document.xml').decode(),'media':[hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/media/') and not n.endswith('/')]},ensure_ascii=False))",path.join(output,name)],{encoding:'utf8',windowsHide:true}));
  const q=saved.entries[0].question,figure=draft.sections.flatMap(s=>s.figures||[]).find(f=>f.role==='question');assert(inspected.media.includes(figure.sha256));assert.equal(inspected.xml.includes(q.answer),audience==='teacher');assert.equal(inspected.xml.includes(q.analysis),audience==='teacher');assert(inspected.xml.includes(saved.entries[0].instance.content.question.blocks.find(b=>b.type==='text').text));files.push({name,audience,bytes:bytes.length,sha256:sha(bytes),diagramSha256:figure.sha256});
 }
 assert.equal(JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[proof.questionId])),before);assert.equal(JSON.stringify(sql('SELECT * FROM material_book_answer_journal_v1')),facts);
 report.instanceIllustrations={...proof,integratedFiles:files,integratedReadback:true};
 report.checks.push('Merged main production cold UI/source/Pi readback and actual student/teacher DOCX preserve the same reviewed diagram, answers and canonical facts at both sizes with zero model replay');
}
