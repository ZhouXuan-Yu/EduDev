import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../acceptance/evidence.mjs';
import {mistakeFactsJourney} from './mistake-facts-journey.mjs';

/** Inspect the accepted final questions in an owned cold clone, without a model replay. */
export async function photoLearningCycleVisual(ctx){
 const {desktop,data,profile,output,report,launch,until,check}=ctx;
 const requested=process.argv.find(a=>a.startsWith('--restore-root='))?.slice(15);
 assert(requested);const prior=fs.realpathSync(requested);
 assert(prior.startsWith(fs.realpathSync(path.join(desktop,'test-results'))+path.sep));
 const accepted=JSON.parse(fs.readFileSync(path.join(prior,'report.json')));
 assert(accepted.success&&accepted.scenario==='DT-05-photo-cycle');assert.equal(accepted.build.sha256,report.build.sha256);
 fs.cpSync(path.join(prior,'data'),data,{recursive:true});fs.cpSync(path.join(prior,'electron-profile'),profile,{recursive:true});
 const facts=()=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return Object.fromEntries(['question_bank_items','ai_confirmation_items','exercise_sets','question_bank_usage','students','learning_records'].map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()]));}finally{db.close();}};
 const messages=()=>{let count=0;function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.jsonl'))for(const line of fs.readFileSync(f,'utf8').split('\n').filter(Boolean))if(JSON.parse(line).type==='message')count++;}}walk(path.join(data,'xiaozhi-pi'));return count;};
 const baseline=facts(),before=messages(),cycle=accepted.result.cycle;
 await launch();const page=ctx.page(),app=ctx.app();await page.getByTestId('ai-conversation-session-'+cycle.session).click();
 await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===cycle.session);ctx.setSession(cycle.session);
 await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const review=baseline.ai_confirmation_items.find(r=>r.id===cycle.questionReviewId),final=JSON.parse(review.result_json).draft;
 const card=page.locator(`[data-testid="pi-question-review"][data-review-id="${review.id}"]`);
 await card.locator('button').first().click();await card.getByTestId('question-review-item').last().waitFor();assert.equal(await card.getByTestId('question-review-item').count(),5);
 for(let i=0;i<5;i++)for(const field of['stem','answer','analysis']){const control=card.getByTestId('question-review-item').nth(i).getByTestId('question-review-'+field);assert.equal(await control.inputValue(),final.items[i][field]);assert(await control.isDisabled());await control.scrollIntoViewIfNeeded();}
 assert(final.items[4].analysis.includes('3.5²=12.25'));assert(final.items[0].answer.includes('17'));
 check('Cold current review exposes all five teacher-final fields, including the corrected fifth explanation, as read-only saved facts');
 for(const theme of['light','dark'])for(const[width,height]of[[1366,768],[1920,1080]])for(const index of[0,4]){
  await page.emulateMedia({colorScheme:theme});await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});
  const item=card.getByTestId('question-review-item').nth(index),anchor=item.getByTestId('question-review-analysis');await anchor.scrollIntoViewIfNeeded();
  await until(async()=>{const b=await anchor.boundingBox();return b&&b.y>=0&&b.y+b.height<=height;});await page.evaluate(()=>document.activeElement?.blur());
  const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert(geometry.scrollWidth<=width);
  const png=`five-question-final-${index+1}-${theme}-${width}x${height}.png`;await page.screenshot({path:path.join(output,png),animations:'disabled'});report.visuals.push({png,theme,width,height,geometry,index});
 }
 assert.deepEqual(facts(),baseline);assert.equal(messages(),before);check('Both viewport sizes and themes reach first and last final questions with unchanged SQLite and no model replay');
 report.result={restoredFrom:prior,questions:5,modelMessagesBefore:before,modelMessagesAfter:messages(),modelRequests:0};
 report.boundaries=['Readonly cold clone of the accepted owned actual photo learning cycle; all five final question fields inspected and first/fifth captured','Static viewport geometry only; no daily/manual/native motion or full Codex parity claim'];
}

/** Compose the original journeys and production approvals, with no direct fact writes. */
export async function photoLearningCycleJourney(ctx){
 const {data,output,report,navigate,until,check,restart,studentNative}=ctx;
 const page=()=>ctx.page(),app=()=>ctx.app();
 const photo=path.join(output,'勾股定理学生错题.png');
 // Owned printed-photo fixture, created locally with Windows' existing drawing runtime.
 const drawing=spawnSync('powershell.exe',['-NoProfile','-Command',`
Add-Type -AssemblyName System.Drawing
$taskImage=[Drawing.Bitmap]::new(1500,520)
$taskCanvas=[Drawing.Graphics]::FromImage($taskImage)
$taskCanvas.Clear([Drawing.Color]::White)
$taskCanvas.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$taskFont=[Drawing.Font]::new('Microsoft YaHei',34)
$taskLines=@('勾股定理 学生错题','直角三角形两直角边为3厘米和4厘米，求斜边。','学生实际作答：3 + 4 = 7厘米。','教师记录：把两直角边直接相加。')
for($taskIndex=0;$taskIndex -lt $taskLines.Count;$taskIndex++){$taskCanvas.DrawString($taskLines[$taskIndex],$taskFont,[Drawing.Brushes]::Black,35,35+110*$taskIndex)}
$taskImage.Save($env:OMNI_EDU_OWNED_PHOTO,[Drawing.Imaging.ImageFormat]::Png)
$taskFont.Dispose();$taskCanvas.Dispose();$taskImage.Dispose()
`],{env:{...process.env,OMNI_EDU_OWNED_PHOTO:photo},encoding:'utf8'});
 assert.equal(drawing.status,0,drawing.stderr);assert(fs.existsSync(photo));
 await mistakeFactsJourney({...ctx,photoFixture:photo,photoTextMatches:['勾股','3','4','7']});
 const base=report.result,studentId=base.studentId,parent=base.question,photoReceipt=base.photoFacts;
 const all=(sql,params=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...params);}finally{db.close();}};
 const facts=()=>({questions:all('SELECT * FROM question_bank_items ORDER BY created_at,id'),records:all('SELECT * FROM learning_records ORDER BY created_at,id'),
  questionsReviewed:all("SELECT * FROM ai_confirmation_items WHERE action_type='pi_question_candidate' ORDER BY created_at,id"),
  practicesReviewed:all("SELECT * FROM ai_confirmation_items WHERE action_type='pi_practice_candidate' ORDER BY created_at,id"),
  plans:all("SELECT * FROM ai_confirmation_items WHERE action_type='pi_student_learning_change' ORDER BY created_at,id"),
  exercises:all('SELECT * FROM exercise_sets ORDER BY created_at,id'),usage:all('SELECT * FROM question_bank_usage ORDER BY id')});
 const unchangedRoot=()=>assert.deepEqual(facts().questions.find(q=>q.id===parent.id),parent);
 const card=(kind,id)=>page().locator(`[data-testid="pi-${kind}-review"][data-review-id="${id}"]`);
 const values=(session,tool)=>studentNative(session).entries.filter(e=>e.message?.role==='toolResult'&&e.message.toolName===tool).flatMap(e=>e.message.content.filter(p=>p.type==='text').flatMap(p=>{try{return[JSON.parse(p.text)];}catch{return[];}}));
 const start=async()=>{const input=page().getByTestId('office-prompt-input');await until(async()=>!await input.isDisabled());await input.press('Enter');assert.equal(await input.inputValue(),'');};
 const reviewGate=async(label,value)=>{
  const file=path.join(output,`${label}.json`),digest=sha256(Buffer.from(JSON.stringify(value)));fs.writeFileSync(file,JSON.stringify({digest,value},null,2));
  if(process.argv.includes('--teacher-review-gates')){console.log(`REVIEW ${file}`);await until(()=>{try{return JSON.parse(fs.readFileSync(file+'.reviewed','utf8')).digest===digest;}catch{return false;}},300000);}
  return digest;
 };
 const capture=async(label,anchor)=>{for(const theme of['light','dark'])for(const[width,height]of[[1366,768],[1920,1080]]){
  await page().emulateMedia({colorScheme:theme});await app().evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
  await page().waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});await anchor.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await until(async()=>{const box=await anchor.boundingBox();return box&&box.y>=0&&box.y+box.height<=height;});await page().evaluate(()=>document.activeElement?.blur());
  const geometry=await page().evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert(geometry.scrollWidth<=width);
  const png=`${label}-${theme}-${width}x${height}.png`;await page().screenshot({path:path.join(output,png),animations:'disabled'});report.visuals.push({png,theme,width,height,geometry});
 }};
 await navigate('students');await page().getByTestId('student-row-'+studentId).click();await page().getByTestId('nav-mistakes').click();await page().getByTestId('mistake-facts-ask').click();
 await until(async()=>await page().getByTestId('office-prompt-input').inputValue().then(v=>v.includes('完整14天')));const prompt=await page().getByTestId('office-prompt-input').inputValue();
 const session=await ctx.selectSession();assert.equal((await ctx.snapshot()).studentContext.id,studentId);await start();
 await until(()=>facts().questionsReviewed.length===1,240000);const qr=facts().questionsReviewed[0],qview=JSON.parse(qr.payload_json),qcard=card('question',qr.id);
 assert.equal(qview.draft.items.length,5);assert(qview.draft.items.every(q=>q.questionType==='short_answer'));assert.equal(qview.sources.length,1);assert.equal(qview.sources[0].id,parent.id);
 assert.equal(facts().questions.length,1);assert.equal(facts().records.length,2);await qcard.getByTestId('question-review-item').last().waitFor();
 report.questionContentReview=await reviewGate('five-question-content',qview.draft);
 check('Real DeepSeek reads the actual photo root and proposes five distinct editable candidates without saving future questions or scores');
 const teacherItem=qcard.getByTestId('question-review-item').first();await teacherItem.getByTestId('question-review-stem').fill('直角三角形两条直角边分别为8厘米和15厘米，求斜边，并说明为什么不能把两直角边直接相加。');
 await teacherItem.getByTestId('question-review-answer').fill('17厘米；斜边的平方等于两直角边的平方和，长度不能直接相加。');await teacherItem.getByTestId('question-review-analysis').fill('8²+15²=64+225=289，斜边取正平方根17厘米；8+15=23不是斜边。');
 const finalQuestions=qview.draft.items.map(q=>({...q}));
 // Read the final UI values, rather than substitute a low-level saved fixture.
 finalQuestions[0]={...qview.draft.items[0],stem:await teacherItem.getByTestId('question-review-stem').inputValue(),answer:await teacherItem.getByTestId('question-review-answer').inputValue(),analysis:await teacherItem.getByTestId('question-review-analysis').inputValue()};
 await teacherItem.getByTestId('question-review-answer').fill('');await qcard.getByTestId('question-review-confirm').click();await qcard.getByRole('alert').waitFor();assert.equal(facts().questions.length,1);
 await teacherItem.getByTestId('question-review-answer').fill(finalQuestions[0].answer);await capture('five-question-review',qcard.getByTestId('question-review-confirm'));
 await qcard.getByTestId('question-review-confirm').click();await until(()=>facts().questionsReviewed[0].status==='confirmed');assert.equal(facts().questions.length,6);unchangedRoot();
 const savedQuestions=JSON.parse(facts().questionsReviewed[0].result_json).saved;assert.equal(savedQuestions.length,5);
 check('Teacher edits one of five questions and invalid answer writes nothing; actual approval atomically saves five sourced child questions');
 await until(()=>facts().practicesReviewed.length===1,240000);const pr=facts().practicesReviewed[0],pview=JSON.parse(pr.payload_json),pcard=card('practice',pr.id);
 assert.equal(pview.questions.length,5);assert.equal(pview.draft.items.length,5);assert(pview.questions.every(q=>savedQuestions.some(s=>s.questionId===q.question.id)&&q.parents.some(p=>p.questionId===parent.id)));
 const changed=pview.questions.find(q=>q.question.stem===finalQuestions[0].stem);assert(changed);assert.equal(changed.question.answer,finalQuestions[0].answer);assert.equal(facts().exercises.length,0);assert.equal(facts().usage.length,0);
 await pcard.getByTestId('practice-review-title').fill('照片错因专项 · 五题练习');await pcard.getByTestId('practice-review-item').first().getByTestId('practice-review-observation').fill('先辨认直角边和斜边，再列平方和等式；核对开方与单位。');
 await capture('five-practice-review',pcard.getByTestId('practice-review-confirm'));await pcard.getByTestId('practice-review-confirm').click();await until(()=>facts().practicesReviewed[0].status==='confirmed');
 const exercise=facts().exercises[0];assert.equal(JSON.parse(exercise.items_json).length,5);assert.equal(facts().usage.length,5);assert.equal(facts().records.length,2);unchangedRoot();
 check('Same Pi rereads teacher final five questions and confirms a five-question exercise with the original photo parent, without synthetic results');
 await until(()=>facts().plans.length===1,240000);let lr=facts().plans[0],lview=JSON.parse(lr.payload_json),lcard=card('learning',lr.id);
 assert.equal(lview.draft.kind,'strategy');assert.equal(lview.draft.plan.days.length,14);assert(lview.draft.plan.topics.some(t=>t.name==='勾股定理'));
 report.initialPlanContentReview=await reviewGate('initial-personalized-plan',lview.draft);await lcard.getByTestId('training-count-1').fill('5');await lcard.getByTestId('training-title').fill('照片错因专项 · 两周训练');
 await capture('photo-training-plan',lcard.getByTestId('learning-review-confirm'));await lcard.getByTestId('learning-review-confirm').click();await until(()=>facts().plans[0].status==='confirmed');
 await until(async()=>!(await ctx.snapshot()).running,240000);assert.equal((await ctx.snapshot()).projection.turns.at(-1).status,'completed');assert.equal(facts().records.length,2);
 const initialPlan=JSON.parse(facts().plans[0].result_json);check('Real source evidence drives a complete editable fourteen-day plan; confirmation records strategy rather than completed practice');
 const openPlan=async()=>{await navigate('students');await page().getByTestId('student-row-'+studentId).click();await page().getByTestId('nav-mastery').click();await page().getByTestId('student-training-version').waitFor();};
 await openPlan();await page().getByTestId('student-training-record').click();await page().getByTestId('training-practice-select').selectOption(exercise.id);await page().getByTestId('training-practice-question').last().waitFor();
 await page().getByTestId('training-result-save').click();await page().getByTestId('student-training-notice').getByText(/逐题选择实际表现/).waitFor();assert.equal(facts().records.length,2);
 const items=JSON.parse(exercise.items_json);for(let i=0;i<5;i++){await page().getByTestId('training-practice-answer-'+i).fill(i===0?'把两条直角边直接相加，尚未改正。':items[i].answer);await page().getByTestId('training-practice-outcome-'+i).selectOption(i===0?'incorrect':'correct');await page().getByTestId('training-practice-feedback-'+i).fill(i===0?'本次仍将直角边长度相加，需要继续纠正平方和关系。':'教师核对：能使用平方和关系并核对正平方根与单位。');}
 await page().getByTestId('training-practice-score-toggle').check();await page().getByTestId('training-practice-score-earned').fill('8');await page().getByTestId('training-practice-score-max').fill('10');
 await capture('five-practice-actual-results',page().getByTestId('training-result-save'));await page().getByTestId('training-result-save').click();await page().getByTestId('training-practice-saved-score').getByText('8 / 10',{exact:false}).waitFor();
 assert.equal(facts().records.length,3);const actual=facts().records.find(r=>{try{return JSON.parse(r.content).practice?.exerciseId===exercise.id;}catch{return false;}}),result=JSON.parse(actual.content);
 assert.equal(result.practice.answers.length,5);assert.deepEqual(result.practice.score,{earned:8,max:10});assert.equal(result.result,'partial');assert.equal(result.planId,lr.id);unchangedRoot();
 check('Traditional training UI records five explicit actual answers/outcomes and teacher score once; missing outcomes write nothing');
 const old=await page().locator('.office-composer-container').getAttribute('data-session-id');await page().getByTestId('student-training-continue').click();await until(async()=>{const id=await page().locator('.office-composer-container').getAttribute('data-session-id');return id&&id!==old;});
 const nextSession=await ctx.selectSession();const pending=await ctx.proposeLearning('请实际读取最新学习分析，依据已保存五题练习逐题实际作答、表现、反馈和分数调整完整14天计划，提出策略等待教师核对。保留照片错因及历史的证据区分，不自动改题或补造成绩。');lr=pending.row;lcard=pending.card;lview=JSON.parse(lr.payload_json);
 const latest=values(nextSession,'education_analyse_learning').findLast(v=>v.success&&v.sourceEvidence.some(e=>e.practice));assert(latest);assert.equal(latest.coverage.explicit,2);assert.equal(latest.coverage.unknown,1);
 const evaluated=latest.sourceEvidence.find(e=>e.practice);assert.equal(evaluated.practice.answers.length,5);assert.deepEqual(evaluated.practice.score,{earned:8,max:10});assert(evaluated.practice.answers[0].feedback.includes('平方和'));
 assert(!JSON.stringify(latest).includes(studentId));assert(!JSON.stringify(latest).includes(exercise.id));assert(!JSON.stringify(latest).includes('13800138000'));
 report.revisedPlanContentReview=await reviewGate('revised-personalized-plan',lview.draft);await lcard.getByTestId('training-title').fill('五题实际反馈后 · 两周修订');await lcard.getByTestId('learning-review-confirm').click();await ctx.finishLearning();
 const revised=JSON.parse(facts().plans.find(r=>r.id===lr.id).result_json);assert(revised.version>initialPlan.version);assert.equal(facts().records.length,3);unchangedRoot();
 check('Real DeepSeek receives persisted photo/history and five actual answers through original DeepTutor analysis, then teacher confirms revised strategy without grade inference');
 const durable=facts(),beforeMessages=studentNative(nextSession).entries.filter(e=>e.message).length;await restart();await openPlan();await page().getByTestId('training-practice-saved-score').getByText('8 / 10',{exact:false}).waitFor();assert.deepEqual(facts(),durable);
 assert.equal(studentNative(nextSession).entries.filter(e=>e.message).length,beforeMessages);await page().getByTestId('training-practice-saved').getByTestId('practice-source-open').click();await page().getByTestId('practice-source-dialog').getByText(/父题来源/).first().waitFor();await page().getByTestId('practice-source-close').click();
 check('Cold restart preserves all five final children, practice lineage, fourteen-day plan versions and actual results without replay');
 report.result={...base,cycle:{session,nextSession,studentId,parentId:parent.id,photoSourceSha256:photoReceipt.sourceSha256,questionReviewId:qr.id,practiceReviewId:pr.id,exerciseId:exercise.id,initialPlanVersion:initialPlan.version,revisedPlanVersion:revised.version,actualRecordId:actual.id,prompt,latest,readback:durable}};
 report.boundaries=['Actual math photo/local OCR → teacher fact/source root → sole Pi/real DeepSeek five variants → teacher final questions/practice → personalized fourteen days → explicit five-answer result → reassessment/revised plan → cold restore','Owned printed photo and explicit synthetic learner responses; no claim of handwritten accuracy, human teacher acceptance, all DeepTutor modes, daily window, installation/noVPN, or complete Goal'];
 fs.writeFileSync(path.join(output,'readback.json'),JSON.stringify(report.result,null,2));
}

