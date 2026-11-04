import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {productEntry} from '../product-navigation.mjs';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
const sha=v=>createHash('sha256').update(v).digest('hex');
export function sectionReceiptFingerprint(sql){return sha(JSON.stringify(sql('SELECT batch_id,ordinal,first_json,final_json,image_sha FROM material_ai_units ORDER BY batch_id,ordinal')));}
export async function checkSectionInheritance({page,report,output,sql,stem,resourceId,cold=false}){
 const end=Date.now()+120000;let q;
 while(Date.now()<end){const rows=sql('SELECT q.* FROM question_bank_items q WHERE stem=? AND id IN (SELECT m.question_id FROM material_ai_members m JOIN material_ai_batches b ON b.id=m.batch_id WHERE b.resource_id=?)',[stem,resourceId]);assert(rows.length<=1,'Owned AI question must be unique');q=rows[0];if(q&&JSON.parse(q.archive_json).state==='book_enriched')break;await new Promise(r=>setTimeout(r,250));}
 assert(q&&JSON.parse(q.archive_json).state==='book_enriched','Titleless page must finish automatic known-answer matching');
 assert.equal(q.answer,'0℃');assert.equal(q.analysis,'标准大气压下水的凝固点为0℃。');
 const row=sql("SELECT * FROM material_book_answer_journal_v1 WHERE question_id=? AND after_json<>'' ORDER BY rowid DESC LIMIT 1",[q.id])[0],e=JSON.parse(row.evidence_json);
 assert.equal(e.questionSection.schemaVersion,'xiaozhi.book-section-context.v1');assert.equal(e.questionSection.pages.length,1);assert.equal(e.questionSection.pages[0].source.page,1);assert.equal(e.section,'基础测试卷');
 const saved=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),q.id);assert.equal(saved.document.schemaVersion,'xiaozhi.question-document.v3');assert.equal(saved.document.answer.origin,'book_extracted');
 const began=performance.now(),source=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(saved)});const sourceReadMs=performance.now()-began;assert(source.ok,JSON.stringify(source));assert(JSON.stringify(source).includes(q.analysis));
 await productEntry(page,'teaching').click();await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();await page.getByTestId('question-notebook-search').fill(stem);
 const card=page.getByTestId('question-notebook-card-'+q.id);await card.waitFor();await card.getByRole('button',{name:'查看答案与解析',exact:true}).click();const answerFold=card.getByTestId('question-notebook-answer-fold-'+q.id);await answerFold.getByText('标注来源：答案册原文 · 答案.pdf 第1页',{exact:true}).first().waitFor();assert((await answerFold.innerText()).includes(q.answer));assert((await answerFold.innerText()).includes(q.analysis));
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await card.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,(cold?'cold-':'')+'inherited-section-'+width+'.png')});}
 report.sectionInheritance={questionId:q.id,version:questionVersion(saved),context:e.questionSection,section:e.section,coldReadback:cold,receiptFingerprint:sectionReceiptFingerprint(sql),sourceReadMs:{...report.sectionInheritance?.sourceReadMs,[cold?'appCold':'appWarm']:sourceReadMs}};
 report.checks.push(cold?'Cold notebook/Pi read authenticates inherited chapter and known answer with unchanged paid receipts':'Persisted folder processing automatically fills the titleless second-page question using a source-bound preceding chapter; notebook and Pi read the known answer');
 return JSON.stringify(q);
}
