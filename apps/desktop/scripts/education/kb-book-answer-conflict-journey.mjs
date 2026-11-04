import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {productEntry} from '../product-navigation.mjs';
import {enterPaper,choose} from '../acceptance/paper-basket-ui-driver.mjs';
import {createInstanceBasket,waitInstanceUi} from '../acceptance/paper-instance-ui-driver.mjs';
import {questionVersion,createQuestionContextRuntime} from '../../src/main/education/question-context-provider.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';

/** Extends the real recursive-import journey. All business changes go through the teacher UI. */
export async function runBookAnswerConflictJourney({page,report,output,sql,questionId,answer,analysis,openMatch,coldRestart}){
 const read=()=>page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId);
 const receipts=()=>JSON.stringify(sql('SELECT batch_id,ordinal,status,first_json,final_json,error FROM material_ai_units ORDER BY batch_id,ordinal'));
 const original=await read(),frozen=receipts();assert.equal(original.answer,'90℃');assert(original.archive.issues.includes('answer_conflict'));assert(!archiveEligible(original));
 await openMatch();const match=page.getByTestId('material-book-match-row');await match.and(page.locator('[data-state="held"]')).waitFor();assert((await match.innerText()).includes('保留两份'));
 await match.getByTestId('material-book-source-open').click();const raw=match.getByTestId('material-ai-page-text');await raw.waitFor();assert((await raw.innerText()).includes(answer));await match.getByTestId('materials-original-open').click();await match.locator('img').first().evaluate(img=>img.decode());
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await raw.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'conflict-source-'+width+'.png')});}
 report.checks.push('Recursive PDF pair import automatically quarantines differing AI/book answers and displays both candidates plus authenticated answer original at both sizes');
 const sourceInput=q=>({schemaVersion:'xiaozhi.education.question-context.v1',questionId,version:questionVersion(q)});
 const inspect=async q=>{const result=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),sourceInput(q));assert(result.ok,JSON.stringify(result));return result.value.question;};
 const runtime=createQuestionContextRuntime({getQuestionNotebookEntry:read,listStudents:()=>page.evaluate(()=>window.omniEdu.listStudents('')),sanitizeProblemText:text=>page.evaluate(text=>window.omniEdu.sanitizeProblemText(text),text),readArchivedQuestionContext:inspect,readQuestionDocumentContext:async()=>{const q=await read();return(await inspect(q)).document.context.projection;}},()=>true);
 // Teacher source inspection intentionally allows pending questions; Pi's ordinary provider enforces eligibility.
 await inspect(original);await assert.rejects(runtime.readApplied(sourceInput(original),new AbortController().signal),/document_context_unavailable/);
 const owner=await page.evaluate(()=>window.omniEdu.createAiConversationSession({title:'答案冲突隔离验收'}));await enterPaper(page);
 await page.getByTestId('paper-basket-owner-search').fill(owner.session.id);await choose(page,page.getByTestId('paper-basket-owner'),owner.session.id);await page.getByTestId('paper-basket-new').and(page.locator(':enabled')).click();
 if(await page.getByTestId('paper-basket-new-choice').isVisible())await page.getByTestId('paper-basket-keep-new').click();
 const basketId=await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');await waitInstanceUi(page,owner.session.id,basketId,{stage:'select'});
 const unavailable=await page.evaluate(input=>window.omniEdu.readPaperBasketCandidateV2(input),{schemaVersion:'xiaozhi.paper-basket.v2',sessionId:owner.session.id,basketId,questionId});
 assert(unavailable.ok,JSON.stringify(unavailable));assert.equal(unavailable.value.eligibility.available,false);report.blockedEligibility=unavailable.value.eligibility;
 report.checks.push('Real paper workspace candidate read and production Pi provider refuse the canonical conflict while teacher source inspection remains available');
 async function card(){await productEntry(page,'teaching').click();await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();await page.getByTestId('question-notebook-search').fill(original.stem);const c=page.getByTestId('question-notebook-card-'+questionId);await c.waitFor();return c;}
 let item=await card();assert((await item.innerText()).includes('答案存在冲突'));
 await item.getByTestId('question-archive-edit-'+questionId).click();await item.getByTestId('question-archive-source-checked').check();await item.getByTestId('question-archive-save').click();await item.getByTestId('question-archive-form').waitFor({state:'hidden'});assert(!archiveEligible(await read()));
 await item.getByTestId('question-archive-edit-'+questionId).click();await item.getByTestId('question-archive-answer').fill(answer);await item.getByTestId('question-archive-analysis').fill(analysis);await item.getByTestId('question-archive-source-checked').check();await item.getByTestId('question-archive-save').click();await item.getByTestId('question-archive-form').waitFor({state:'hidden'});
 const fixed=await read();assert(archiveEligible(fixed));assert.equal(fixed.archive.answerOrigin,'teacher');assert.equal(fixed.answer,answer);await runtime.readApplied(sourceInput(fixed),new AbortController().signal);assert.equal(receipts(),frozen);
 report.checks.push('Existing teacher editor keeps checkbox-only save quarantined and releases an actual checked answer/analysis correction without changing paid receipts');
 await enterPaper(page);const basket=await createInstanceBasket({page,report},owner.session.id,fixed,'答案补正后入卷');assert.equal(basket.entries[0].question.answer,answer);report.basketId=basket.id;
 const canonical=JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId]));
 page=await coldRestart();item=await card();const cold=await read();assert(archiveEligible(cold));assert.equal(JSON.stringify(sql('SELECT * FROM question_bank_items WHERE id=?',[questionId])),canonical);assert.equal(receipts(),frozen);assert((await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),sourceInput(cold))).ok);
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await item.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'conflict-corrected-'+width+'.png')});}
 assert.deepEqual(report.rendererErrors,[]);assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');report.checks.push('Corrected question is selected and added through the actual paper UI; cold startup preserves teacher answer, eligibility and original receipts with zero further model calls');
 fs.writeFileSync(path.join(output,'conflict-summary.json'),JSON.stringify({questionId,answerBefore:original.answer,answerAfter:cold.answer,blockedEligibility:report.blockedEligibility,checks:report.checks},null,2));
}
