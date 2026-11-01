/** Parent-only cold follow-up of an existing failed QA run. Never starts a model. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {readClassroomExport} from './acceptance/classroom-export-readback.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=fs.realpathSync(path.join(desktop,'test-results/ui-goal-20261101/classroom-live'));
const runRoot=fs.realpathSync(path.resolve(process.argv.find(arg=>arg.startsWith('--run='))?.slice(6)||path.join(base,'run-lMlOPD')));
assert.equal(path.dirname(runRoot),base,'Only an existing owned classroom run is allowed');
const originalFile=path.join(runRoot,'report.json'),originalBytes=fs.readFileSync(originalFile),original=JSON.parse(originalBytes);
assert.equal(original.success,false,'Follow-up must preserve the recorded original failure');
assert.equal(original.checks.length,5);assert.match(original.failure,/ENOENT/);
const data=path.join(runRoot,'data'),profile=path.join(runRoot,'profile');
assert(fs.statSync(profile).isDirectory());
const sql=(q,values=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...values);}finally{db.close();}};
const ledger=()=>{
 const rows=sql("SELECT id,session_id,status,payload_json,result_json FROM ai_confirmation_items WHERE action_type IN ('pi_classroom_plan','pi_classroom_candidate') ORDER BY id");
 return{digest:sha256(JSON.stringify(rows)),runs:sql('SELECT count(*) n FROM ai_agent_runs')[0].n,records:sql('SELECT count(*) n FROM learning_records')[0].n};
};
const plans=sql("SELECT id,session_id,status,json_extract(result_json,'$.state') state,json_extract(result_json,'$.classroomId') classroom_id,json_array_length(json_extract(result_json,'$.checkpoints')) checkpoints FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'");
assert.equal(plans.length,1);const plan=plans[0];assert.equal(plan.status,'confirmed');assert.equal(plan.state,'ready');assert.equal(plan.checkpoints,3);
const classroom=sql("SELECT id,status,payload_json,result_json FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type='pi_classroom_candidate'",[plan.classroom_id,plan.session_id])[0];
assert(classroom);assert.equal(classroom.status,'confirmed');
const version=sha256(JSON.stringify({id:classroom.id,status:classroom.status,payload:classroom.payload_json,result:classroom.result_json}));
const drafts=sql("SELECT id,artifact_id FROM xiaozhi_pi_office_drafts WHERE conversation_id=? AND state='saved'",[plan.session_id]);assert.equal(drafts.length,1);
const readExport=()=>readClassroomExport({runRoot,sessionId:plan.session_id,draftId:drafts[0].id,artifactId:drafts[0].artifact_id,classroomId:classroom.id,classroomVersion:version});
const proof=await readExport(),before=ledger(),mainFile=testMain(desktop),build=fingerprint(path.dirname(path.dirname(mainFile)));
assert.equal(before.records,0);assert.equal(build.sha256,original.build.sha256,'Follow-up must use the same actual build');
if(process.argv.includes('--check'))console.log(JSON.stringify({prepared:true,originalFailurePreserved:true,receiptVerified:proof,sameBuild:true,noElectronStarted:true}));
else{
 const output=fs.mkdtempSync(path.join(runRoot,'readback-followup-'));
 const report={success:false,kind:'same-owned-run cold/readback follow-up; original QA remains failed',originalReportSha256:sha256(originalBytes),buildSha256:build.sha256,checks:[],screens:[],errors:[],export:proof};
 const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
 let app;
 try{
  check('Original saved receipt, classroom version, workspace authority, actual PPTX hash and ZIP CRC agree');
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1'};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.DEEPSEEK_API_KEY;
  app=await electron.launch({args:[mainFile,`--user-data-dir=${profile}`],env,timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',()=>report.errors.push('pageerror'));page.on('console',event=>{if(event.type()==='error')report.errors.push('console.error');});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await assertIsolatedPiMain(app,mainFile,profile);
  const restored=await page.evaluate(()=>window.omniEdu.listClassroomPlans());assert(restored.ok);const same=restored.data.find(item=>item.id===plan.id);
  assert(same);assert.equal(same.status,'ready');assert.equal(same.classroomId,classroom.id);assert.equal(same.checkpoints.length,3);
  const classrooms=await page.evaluate(()=>window.omniEdu.listClassrooms());assert(classrooms.ok);const confirmed=classrooms.data.find(item=>item.id===classroom.id);assert(confirmed);assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.version,version);
  const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id).then(value=>({running:value.running,officeArtifacts:value.officeArtifacts})),plan.session_id);assert.equal(snapshot.running,false);assert(snapshot.officeArtifacts.some(item=>item.id===drafts[0].id&&item.state==='saved'&&item.artifactId===drafts[0].artifact_id));
  await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-teaching').click();await page.getByTestId('teaching-classrooms-tab').click();await page.getByTestId('classroom-'+classroom.id).click();
  await page.frameLocator('[data-testid="classroom-slide-preview"]').locator('.classroom-canvas').waitFor({timeout:30000});
  for(const size of [[1366,768],[1920,1080]]){
   await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].setContentSize(...value),size);await page.waitForFunction(value=>innerWidth===value[0]&&innerHeight===value[1],size);
   const file=`cold-confirmed-${size[0]}.png`;await page.screenshot({path:path.join(output,file),animations:'disabled'});report.screens.push(file);
  }
  check('Same profile cold start restores the same ready plan, confirmed classroom and saved export');
  assert.deepEqual(ledger(),before);assert.deepEqual(await readExport(),proof);assert.equal(sha256(fs.readFileSync(originalFile)),sha256(originalBytes));assert.deepEqual(report.errors,[]);
  check('Cold navigation creates zero model runs and zero student records; saved bytes and original failure report remain unchanged');
  report.success=true;
 }catch(error){report.failure=error instanceof assert.AssertionError?'followup_assertion_failed':String(error.code||'followup_failed');throw error;}
 finally{if(app)await app.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,output,checks:report.checks.length}));}
}
