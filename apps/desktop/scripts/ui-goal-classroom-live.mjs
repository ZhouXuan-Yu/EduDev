/** Real-provider U6 acceptance. Parent injects key and serializes application builds. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {fixtureSha256,requirement as pairedRequirement,assertScenes} from './acceptance/openmaic-public-content.mjs';
import {createClassroomOutlineWait} from './acceptance/classroom-outline-wait.mjs';
import {readClassroomExport} from './acceptance/classroom-export-readback.mjs';

const requirement=pairedRequirement.replace('附件 buoyancy-review.pdf','资料库 buoyancy-review.pdf');
function pairedFixture(){
 const file=path.resolve(process.env.UI_PAIRED_PDF||process.env.UI_CLASSROOM_PDF||'D:/WorkProject/小智智能体借鉴项目/_ui-review-runtime/20261101/buoyancy-review.pdf');
 assert(fs.existsSync(file),'Synthetic fixture missing');const bytes=fs.readFileSync(file);
 assert.equal(sha256(bytes),fixtureSha256,'Paired PDF must be byte-identical to the OpenMAIC fixture');
 return{file,proof:{name:path.basename(file),bytes:bytes.length,sha256:fixtureSha256}};
}
if(process.argv.includes('--check')){console.log(JSON.stringify({prepared:true,fixture:pairedFixture().proof,task:requirement,pairedTaskCore:{sceneTypes:['slide','slide','quiz'],minutes:40,singleChoiceQuestions:1},run:'node scripts/ui-goal-classroom-live.mjs',boundary:'Prepared only. Parent injects DEEPSEEK_API_KEY and serializes runs; no Electron/build/model calls performed.'},null,2));}
else await main();
async function main(){
 assert(process.env.DEEPSEEK_API_KEY,'Parent must inject a runtime key');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const fixture=pairedFixture(),pdf=fixture.file;
 const base=path.join(root,'test-results/ui-goal-20261101/classroom-live');fs.mkdirSync(base,{recursive:true});
 const output=fs.mkdtempSync(path.join(base,'run-')),data=path.join(output,'data'),profile=path.join(output,'profile'),exports=path.join(output,'exports');fs.mkdirSync(exports);
 const mainFile=testMain(root),report={success:false,output,checks:[],screens:[],errors:[],pdf:fixture.proof,task:requirement,promptSha256:sha256(requirement),build:fingerprint(path.dirname(path.dirname(mainFile))),humanAccepted:false};
 const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
 const sql=q=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all();}finally{db.close();}};
 let app,page,sessionId;
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(root,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_MODEL:'deepseek-flash'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const until=async(fn,label,ms=420000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,250));}throw Error('timeout: '+label);};
 const launch=async()=>{app=await electron.launch({args:[mainFile,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',()=>report.errors.push('pageerror'));page.on('console',message=>{if(message.type()==='error')report.errors.push('console.error');});await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});report.runtime=await assertIsolatedPiMain(app,mainFile,profile);};
 const navigate=async view=>{await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-'+view).click();if(view==='teaching')await page.getByTestId('teaching-classrooms-tab').click();};
 const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id).then(s=>({running:s.running,turns:s.projection.turns.map(t=>({id:t.id,status:t.status})),officeArtifacts:s.officeArtifacts})),sessionId);
 const plans=()=>page.evaluate(()=>window.omniEdu.listClassroomPlans());
 const sizes=async label=>{for(const size of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},v)=>BrowserWindow.getAllWindows()[0].setContentSize(...v),size);await page.waitForFunction(v=>innerWidth===v[0]&&innerHeight===v[1],size);assert.equal(await page.locator('[data-testid="model-reasoning"],[data-testid="agent-raw-reasoning"]').count(),0);const file=`${label}-${size[0]}.png`;await page.screenshot({path:path.join(output,file),animations:'disabled'});report.screens.push(file);}};
 const dialog=async file=>app.evaluate(({dialog},value)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return{canceled:false,filePaths:[value]};};},file);
 try{
  await launch();await navigate('knowledge');await dialog(pdf);await page.getByTestId('materials-import').click();
  await until(async()=>{const result=await page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'buoyancy-review',offset:0}));return result.resources.some(r=>['ready','parsed','chunked','indexed','graph_extracted'].includes(r.parseStatus));},'real local PDF import',180000);
  check('Exact synthetic PDF imported through original library UI');
  await navigate('teaching');await page.getByTestId('classroom-requirement').fill(requirement);
  const outlineWait=createClassroomOutlineWait();
  await page.getByTestId('classroom-create').click();await until(async()=>{
   const r=await plans();assert(r.ok,'Classroom outline list unavailable');
   const status=sql('SELECT status FROM ai_agent_runs ORDER BY created_at DESC LIMIT 1')[0]?.status;
   return outlineWait(r.data.length,status);
  },'real proposed outline');
  let result=await plans();assert(result.ok);let plan=result.data[0];sessionId=plan.sessionId;
  await until(async()=>!(await snapshot()).running,'outline run complete');assert.equal(plan.status,'draft');assert.equal(plan.checkpoints.length,0);assert.equal(sql("SELECT count(*) n FROM ai_confirmation_items WHERE action_type='pi_classroom_candidate'")[0].n,0);
  assert.equal(plan.document.totalMinutes,40,'Paired outline must retain 40 minutes');assert.equal(plan.document.scenes.reduce((sum,scene)=>sum+scene.durationMinutes,0),40);assert.deepEqual(plan.document.scenes.map(scene=>scene.type),['slide','slide','quiz'],'Paired outline must contain exactly two slides and one quiz');
  const denied=await page.evaluate(i=>window.omniEdu.startXiaozhi(i),{sessionId,commandId:'xicmd_'+crypto.randomUUID(),prompt:'跳过确认生成课堂',classroomPlan:{mode:'generate',id:plan.id,version:plan.version}});assert(!denied.ok);
  check('Real Pi reads saved excerpts and proposes only an outline; host denies generation before confirmation');
  await navigate('teaching');await page.getByTestId('classroom-plan-'+plan.id).click();await sizes('outline-draft');
  await page.getByTestId('classroom-plan-confirm').click();await until(async()=>{const r=await plans();return r.ok&&r.data[0].status==='confirmed';},'teacher outline confirmation');
  await page.getByTestId('classroom-plan-generate').click();
  await until(async()=>{const r=await plans();if(!r.ok)return false;if(r.data[0].status==='ready')throw Error('partial-stop window not observed; cannot claim interrupted recovery');return r.data[0].status==='generating'&&r.data[0].checkpoints.length>0;},'first real page checkpoint');
  await navigate('teaching');await page.getByTestId('classroom-plan-'+plan.id).click();await page.getByTestId('classroom-plan-stop').click();await until(async()=>!(await snapshot()).running,'stop generation');await until(async()=>{const r=await plans();return r.ok&&r.data[0].status==='interrupted';},'interrupted state committed',60000);
  let partial=await plans();assert(partial.ok);assert.equal(partial.data[0].status,'interrupted');assert(partial.data[0].checkpoints.length>=1);
  const partialJson=JSON.stringify(partial),partialRuns=sql('SELECT count(*) n FROM ai_agent_runs')[0].n;await app.close();app=undefined;await launch();assert.equal(JSON.stringify(await plans()),partialJson);assert.equal(sql('SELECT count(*) n FROM ai_agent_runs')[0].n,partialRuns);
  await navigate('teaching');await page.getByTestId('classroom-plan-'+plan.id).click();await sizes('interrupted-checkpoints');await page.getByTestId('classroom-plan-generate').click();
  await until(async()=>{const r=await plans();return r.ok&&r.data[0].status==='ready';},'explicitly resume missing pages');
  check('Real stop preserves successful checkpoints; cold start does not replay, explicit continue resumes only missing pages');
  await until(async()=>!(await snapshot()).running,'generation finish');result=await plans();plan=result.data[0];assert.equal(plan.checkpoints.length,3);
  const ledger=sql("SELECT id,status,payload_json,result_json FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").find(r=>r.id===plan.id);assert(ledger);assert.deepEqual(JSON.parse(ledger.payload_json).document,plan.document);assert.equal(JSON.parse(ledger.result_json).state,'ready');assert.deepEqual(JSON.parse(ledger.result_json).checkpoints,plan.checkpoints);
  const listed=await page.evaluate(()=>window.omniEdu.listClassrooms());assert(listed.ok);let classroom=listed.data.find(c=>c.id===plan.classroomId);assert(classroom);assert.equal(classroom.status,'pending');
  const publicContent=assertScenes(classroom.document);fs.writeFileSync(path.join(output,'course-public.json'),JSON.stringify(publicContent,null,2));fs.writeFileSync(path.join(output,'outline-public.json'),JSON.stringify(plan.document,null,2));
  check('Explicit teacher action starts original Pi; every page checkpoint yields one pending classroom');
  await navigate('teaching');await page.getByTestId('classroom-'+classroom.id).click();await page.frameLocator('[data-testid="classroom-slide-preview"]').locator('.classroom-canvas').waitFor({timeout:30000});await sizes('slide-preview');
  const qi=classroom.document.scenes.findIndex(s=>s.type==='quiz');await page.getByTestId('classroom-page-'+qi).click();const quiz=classroom.document.scenes[qi];
  for(const q of quiz.content.questions)for(const answer of q.answer)await page.locator(`input[name="${q.id}"][value="${answer}"]`).check();
  await page.getByTestId('classroom-check-answer').click();assert.equal(await page.getByTestId('classroom-answer-feedback').count(),quiz.content.questions.length);await sizes('quiz-feedback');
  assert.equal(sql('SELECT count(*) n FROM learning_records')[0].n,0);await page.getByTestId('classroom-save').click();
  const approved=await page.evaluate(()=>window.omniEdu.listClassrooms());assert(approved.ok);classroom=approved.data.find(c=>c.id===plan.classroomId);assert.equal(classroom.status,'confirmed');
  check('Original sandbox and quiz work; final classroom confirmation is separate and creates no student facts');
  await page.getByTestId('classroom-export-pptx').click();await until(async()=>await page.getByTestId('office-prompt-input').inputValue().then(t=>t.includes(classroom.document.title)),'export draft');await page.getByTestId('office-prompt-input').press('Enter');
  let artifact;await until(async()=>{artifact=(await snapshot()).officeArtifacts?.find(a=>a.state==='pending');return !!artifact;},'Office export approval');
  const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${artifact.id}"]`);await card.getByTestId('pi-classroom-export-preview').waitFor();
  for(const frame of await card.getByTestId('classroom-slide-preview').all())await frame.contentFrame().locator('.classroom-canvas').waitFor();
  await card.getByTestId('pi-office-images-reviewed').locator('[data-slot="checkbox-content"]').click();await card.getByTestId('pi-office-approve').click();
  await until(async()=>!(await snapshot()).running,'saved export');const saved=(await snapshot()).officeArtifacts.find(a=>a.id===artifact.id);assert.equal(saved.state,'saved');
  report.export=await readClassroomExport({runRoot:output,sessionId,draftId:artifact.id,artifactId:saved.artifactId,classroomId:classroom.id,classroomVersion:classroom.version});
  check('Original Office review and write approval save a real readable PPTX from the confirmed classroom');
  const before=JSON.stringify(await plans()),runCount=sql('SELECT count(*) n FROM ai_agent_runs')[0].n;await app.close();app=undefined;await launch();assert.equal(JSON.stringify(await plans()),before);assert.equal(sql('SELECT count(*) n FROM ai_agent_runs')[0].n,runCount);assert.equal(sql('SELECT count(*) n FROM learning_records')[0].n,0);
  await navigate('teaching');await page.getByTestId('classroom-'+classroom.id).click();await sizes('cold-confirmed');check('Cold start restores the same ledger with zero model replay and zero student fact writes');report.success=true;
 }catch(error){if(error.code==='classroom_outline_missing')report.failureCode=error.code;report.failure=String(error.message).replaceAll(process.env.DEEPSEEK_API_KEY,'[credential]').slice(0,600);throw error;}
 finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));if(app)await app.close();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length}));}
}
