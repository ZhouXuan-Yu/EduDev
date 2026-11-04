import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** Reuses a successful owned import. No grant, model transport or raw-state repair. */
export async function runSectionStatusJourney({page,report,output,sql,folderBatch,known,openResource,coldRestart}){
 const receipts=()=>sha(sql('SELECT u.*,b.calls,b.config_json FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id ORDER BY u.batch_id,u.ordinal'));
 const canonical=()=>sha(sql('SELECT id,stem,answer,analysis,archive_json,document_json,updated_at FROM question_bank_items ORDER BY id'));
 const original=receipts(),facts=canonical(),raw=sql("SELECT u.* FROM material_folder_ai_units u WHERE u.batch_id=? AND u.state='review' AND u.error='page_content_incomplete'",[folderBatch]);
 assert.equal(raw.length,1,'Owned fixture has exactly one title-only raw review');
 const batchId=raw[0].ai_batch_id,rounds=[];
 for(const cold of [false,true]){
  if(cold)page=await coldRestart();
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
  await openMaterialDisclosure(page.getByTestId('materials-batches'));
  const card=page.getByTestId('folder-ai-'+folderBatch);await openMaterialDisclosure(card);
  await card.getByTestId('folder-ai-section-resolved').waitFor();
  const view=await page.evaluate(batchId=>window.omniEdu.getMaterialFolderAi({schemaVersion:'xiaozhi.material-folder-ai.v1',batchId}),folderBatch);
  assert.equal(view.status,'complete');assert.equal(view.review,0);assert.equal(view.failed,0);assert.equal(view.waiting,0);assert.equal(view.complete,view.units);assert.equal(view.sectionResolved,1);assert.equal(view.issues.length,0);assert.equal(view.calls,10);
  assert((await card.getByTestId('folder-ai-counts').innerText()).includes('0 待处理'));
  for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await card.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,(cold?'cold-':'')+'section-status-folder-'+width+'.png')});}
  await openResource(known);await openMaterialDisclosure(page.getByTestId('material-ai-panel'));
  const batch=page.locator('[data-testid="material-ai-batch"][data-batch-id="'+batchId+'"]');
  await batch.getByTestId('material-ai-page-open').click();const source=batch.getByTestId('material-book-answer-section-source');await source.waitFor();
  const summary=await batch.getByTestId('material-ai-summary').innerText();assert(summary.includes('完成1，待整理0'),summary);assert(!(await batch.innerText()).includes('部分结果需处理'));
  assert((await source.innerText()).includes('第 1 页'));assert((await batch.getByTestId('material-ai-page-status').innerText()).includes('AI答案转录'));
  const answerView=await page.evaluate(batchId=>window.omniEdu.getMaterialAiPage({schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal:1}),batchId);
  assert.equal(answerView.status,'complete');assert.equal(answerView.transcriptionStatus,'complete');assert.equal(answerView.bookAnswers.sectionSource.page,1);assert(answerView.bookAnswers.entries.every(e=>!e.issues.includes('missing_section')));
  for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await source.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,(cold?'cold-':'')+'section-status-page-'+width+'.png')});}
  assert.equal(receipts(),original);assert.equal(canonical(),facts);assert.deepEqual(sql("SELECT u.* FROM material_folder_ai_units u WHERE u.batch_id=? AND u.state='review' AND u.error='page_content_incomplete'",[folderBatch]),raw);
  rounds.push({cold,view,page:{status:answerView.status,transcriptionStatus:answerView.transcriptionStatus,sectionSource:answerView.bookAnswers.sectionSource}});
  report.checks.push(cold?'Cold directory and authenticated answer page retain resolved title state with identical raw receipts/facts and zero model replay':'Existing successful directory resolves title-only warning in production UI and typed page reads at both sizes, preserving raw reviews and canonical facts');
 }
 report.sectionStatus={rounds,rawReviewUnits:raw,receiptFingerprint:original,canonicalFingerprint:facts};
}
