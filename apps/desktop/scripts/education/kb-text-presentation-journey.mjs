import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {productEntry} from '../product-navigation.mjs';
import {enterPaper} from '../acceptance/paper-basket-ui-driver.mjs';
import {createInstanceBasket} from '../acceptance/paper-instance-ui-driver.mjs';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
import {compileRichPaperOffice} from '../../src/main/education/paper-rich-export.ts';
import {compileInstancePaperOffice} from '../../src/main/education/paper-instance-export.ts';

/** Extends the owned real recursive-import fixture. No direct question/ledger mutation. */
export async function runTextPresentationJourney({page,report,output,questionId,sql,coldRestart}){
 const original=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId);
 const originalVersion=questionVersion(original),originalBlocks=JSON.stringify(original.document.blocks.filter(b=>b.kind==='image'));
 const stem='根据烧杯示意图回答：在标准大气压下，纯水的沸点是多少摄氏度？',answer='100摄氏度',analysis='由沸点定义可知，标准大气压下纯水的沸点是100摄氏度。';
 const rowsBefore=sql('SELECT * FROM question_bank_items WHERE id=?',[questionId]);
 async function openCard(query){await productEntry(page,'teaching').click();await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();await page.getByTestId('question-notebook-search').fill(query);const card=page.getByTestId('question-notebook-card-'+questionId);await card.waitFor();return card;}
 let card=await openCard(original.stem);
 await card.getByTestId('question-archive-edit-'+questionId).click();await card.getByTestId('question-archive-stem').fill(stem);await card.getByTestId('question-archive-save').click();await card.getByRole('alert').filter({hasText:'题面已改变'}).waitFor();assert.deepEqual(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId]),rowsBefore);
 report.checks.push('Real teacher edit refuses changed question with unchanged answer-book roles and preserves the complete original row');
 await card.getByTestId('question-archive-answer').fill(answer);await card.getByTestId('question-archive-analysis').fill(analysis);await card.getByTestId('question-archive-source-checked').uncheck();await card.getByTestId('question-archive-save').click();await card.getByTestId('question-archive-form').waitFor({state:'hidden'});
 let saved=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId);assert.equal(saved.document.context.presentation.mode,'needs_review');assert(saved.archive.issues.includes('incomplete_question'));
 await card.getByTestId('question-archive-edit-'+questionId).click();await card.getByTestId('question-archive-source-checked').check();await card.getByTestId('question-archive-save').click();await card.getByTestId('question-archive-form').waitFor({state:'hidden'});
 saved=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId);assert.equal(saved.document.context.presentation.mode,'teacher_text');assert.deepEqual(saved.archive.issues,[]);assert.equal(saved.stem,stem);assert.equal(saved.document.context.projection.statement.text,stem);assert.equal(JSON.stringify(saved.document.blocks.filter(b=>b.kind==='image')),originalBlocks);assert.equal(saved.document.answer.origin,'teacher');assert.equal(saved.document.analysis.origin,'teacher');
 const currentVersion=questionVersion(saved),source=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId,version:currentVersion});assert(source.ok,JSON.stringify(source));assert(JSON.stringify(source).includes(stem));
 const old=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId,version:originalVersion});assert(!old.ok);
 const gallery=await page.evaluate(input=>window.omniEdu.getOriginalQuestionGallery(input),{schemaVersion:'xiaozhi.education.original-review.v2',questionId,version:currentVersion});assert(gallery.ok);assert(gallery.value.length>=2);assert.equal(gallery.value.filter(i=>i.kind==='diagram').length,1);
 report.checks.push('Unchecked correction stays pending; checking the same saved text publishes current canonical text, preserves every original crop, detaches changed book roles and rejects old source version');
 const owner=await page.evaluate(()=>window.omniEdu.createAiConversationSession({title:'KB更正题面验收'}));await enterPaper(page);
 const basket=await createInstanceBasket({page,report},owner.session.id,saved,'更正题面与独立插图');
 const candidate=page.getByTestId('paper-basket-candidate').and(page.locator('[data-question-id="'+questionId+'"]'));
 const body=candidate.locator(':scope > .edu-paper-question-content');assert.equal(await body.getByTestId('paper-basket-question-stem').innerText(),stem);assert.equal(await body.getByTestId('paper-basket-question-image').count(),1);await body.getByTestId('paper-basket-question-image').evaluate(img=>img.decode());
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await body.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'edited-paper-'+width+'.png')});}
 // Compile both real source and instance pathways from the exact UI-pinned snapshot.
 // The local compiler fixture has no formal paper confirmation and is not an Office/WPS acceptance claim.
 const instance=structuredClone(basket.entries[0].instance);instance.review={action:'confirm',instanceRevision:instance.instanceRevision,contentDigest:instance.contentDigest,sourceBinding:instance.sourceBinding};
 const paper={id:'xipaper_00000000-0000-4000-8000-000000000001',digest:currentVersion,title:'更正题面编译验证',totalPoints:100,blueprint:basket.blueprint,selection:{items:[{question:saved,instance,source:{questionId,version:currentVersion},sectionId:basket.blueprint.sections[0].id,number:1,points:100}]}};
 for(const [name,compile]of [['source',compileRichPaperOffice],['instance',compileInstancePaperOffice]])for(const audience of ['student','teacher']){const draft=compile(paper,audience),json=JSON.stringify(draft);assert(json.includes(stem));assert(!json.includes(original.stem));assert.equal(draft.sections.flatMap(s=>s.figures||[]).filter(f=>f.role==='question').length,1);assert(audience==='teacher'?json.includes(answer):!json.includes(answer));fs.writeFileSync(path.join(output,'edited-'+name+'-'+audience+'.json'),JSON.stringify(draft,null,2));}
 report.checks.push('Production paper UI finds and pins the corrected question, displays only its independent diagram at both sizes; both Office compiler paths use current text and isolate student answers');
 const canonical=JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId]));page=await coldRestart();card=await openCard(stem);await card.getByTestId('question-original-open').click();await card.locator('[data-question-image-kind="diagram"]').waitFor();
 const cold=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId);assert.equal(questionVersion(cold),currentVersion);assert.equal(JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId])),canonical);assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');
 const coldSource=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId,version:currentVersion});assert(coldSource.ok,JSON.stringify(coldSource));report.checks.push('Cold production notebook/gallery/context readback preserves the corrected version and every canonical row without model replay');
 report.textPresentation={questionId,originalVersion,currentVersion,sourceBlockIds:saved.document.context.sourceBlockIds,presentation:saved.document.context.presentation,basketId:basket.id,formalPaperConfirmed:false,officeFilesGenerated:false};
}
