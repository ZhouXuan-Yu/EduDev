import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../acceptance/evidence.mjs';

/** Clone accepted, teacher-created prior facts; never migrate or mutate the original profile. */
export async function practiceCompatibilityJourney(ctx){
 const {desktop,data,profile,report,launch,navigate,until,check}=ctx;
 const requested=process.argv.find(arg=>arg.startsWith('--restore-root='))?.slice(15);
 assert(requested,'Compatibility requires an accepted owned journey');
 const prior=fs.realpathSync(requested),owned=fs.realpathSync(path.join(desktop,'test-results'))+path.sep;
 assert(prior.startsWith(owned));
 const file=path.join(prior,'report.json'),accepted=JSON.parse(fs.readFileSync(file));
 assert(accepted.success&&['DT-05-review','DT-05-result'].includes(accepted.scenario));
 fs.cpSync(path.join(prior,'data'),data,{recursive:true});
 fs.cpSync(path.join(prior,'electron-profile'),profile,{recursive:true});
 report.provenance={restoredFrom:prior,reportSha256:sha256(fs.readFileSync(file)),priorBuild:accepted.build};
 report.boundaries=['Current build opens an owned clone of accepted prior teacher-created question facts, review history and traditional bank without model replay','Compatibility readback only; original accepted profile, daily profile and full DT-05/Golden acceptance remain unchanged'];
 const facts=()=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return Object.fromEntries(['question_bank_items','ai_confirmation_items','exercise_sets','question_bank_usage','students','learning_records'].map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()]));}finally{db.close();}};
 const messages=()=>{let count=0;function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.jsonl'))for(const l of fs.readFileSync(f,'utf8').split('\n').filter(Boolean))if(JSON.parse(l).type==='message')count++;}}walk(path.join(data,'xiaozhi-pi'));return count;};
 const baseline=facts(),before=messages();await launch();const page=ctx.page(),session=accepted.result.session;
 await page.getByTestId('ai-conversation-session-'+session).click();
 await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===session);
 ctx.setSession(session);await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const snapshot=await ctx.snapshot();assert(!snapshot.running);
 if(accepted.scenario==='DT-05-result'){
  assert.deepEqual(facts(),baseline);assert.equal(messages(),before);check('Current Pi restores the accepted result conversation with no model replay');
  await navigate('students');await page.getByTestId('student-row-'+accepted.result.studentId).click();await page.getByTestId('nav-mistakes').click();await page.getByTestId('exercise-set-card-'+accepted.result.exerciseId).getByTestId('exercise-training-open').click();await page.getByTestId('student-training-workspace').waitFor();await page.getByTestId('training-practice-saved-score').getByText('6 / 10',{exact:false}).waitFor();assert.deepEqual(facts(),baseline);assert.equal(messages(),before);check('Traditional confirmed exercise opens the same student learning plan and actual answer/score after cold clone, without replay');
  report.result={learningRecords:baseline.learning_records.length,modelMessagesBefore:before,modelMessagesAfter:messages()};return;
 }
 assert.equal(snapshot.questionReviews.length,3);
 check('Current unique Pi workspace restores prior teacher question reviews without synthetic practice or provider replay');
 const confirmed=baseline.ai_confirmation_items.find(r=>r.action_type==='pi_question_candidate'&&r.status==='confirmed');
 const card=page.locator(`[data-testid=pi-question-review][data-review-id="${confirmed.id}"]`);
 await card.locator('button').first().click();await card.getByTestId('question-review-answer').first().waitFor();
 assert.equal(await card.getByTestId('question-review-answer').first().inputValue(),JSON.parse(confirmed.result_json).draft.items[0].answer);
 check('Old teacher-final confirmed answer remains readable through the current review UI');
 await navigate('teaching');await page.getByTestId('nav-question_notebook').click();
 for(const q of baseline.question_bank_items){await page.getByTestId('question-notebook-card-'+q.id).waitFor();}
 assert.deepEqual(facts(),baseline);assert.equal(messages(),before);
 check('Current traditional bank retains all old question facts; clone readback adds no exercises, usage, confirmation or model messages');
 report.result={questions:baseline.question_bank_items.length,exercises:baseline.exercise_sets.length,usage:baseline.question_bank_usage.length,modelMessagesBefore:before,modelMessagesAfter:messages()};
}
