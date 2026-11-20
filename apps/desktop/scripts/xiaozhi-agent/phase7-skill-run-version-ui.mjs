import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const size=process.argv[2]||'1366x768';
assert(['1366x768','1920x1080'].includes(size));
const [width,height]=size.split('x').map(Number);
const main=testMain(process.cwd());
const buildRoot=path.dirname(path.dirname(main));
const buildBefore=fingerprint(buildRoot);
const report={success:false,viewport:{width,height},buildRoot,buildSha256:buildBefore.sha256,
  buildFiles:buildBefore.files.length,mainSha256:sha256(fs.readFileSync(main)),checks:[],pageErrors:[],paidCalls:0};
const fixtureOptions={background:true,onPageError:error=>report.pageErrors.push(error.message)};
const skillName='phase7-review-flow',currentVersion='3.0.0',previousVersion='2.0.0';
const heldPrompt='用所选合成流程核对教学步骤，保留可核验的来源。';
const nextPrompt='用回滚后的合成流程再核对一次教学步骤。';
let fixture,root,output,page,skillId,hold;

function check(name){
  report.checks.push({name,pass:true});
  console.log('PASS '+name);
}

async function until(test,message){
  const deadline=Date.now()+45000;
  while(Date.now()<deadline){
    const result=await test();
    if(result)return result;
    await delay(80);
  }
  throw Error(message);
}

function records(){
  const database=new DatabaseSync(path.join(root,'data','app.db'),{readOnly:true});
  try{
    const skill=database.prepare('SELECT payload_json FROM xiaozhi_skill_governance_v1 WHERE id=?').get(skillId);
    return {
      skill:JSON.parse(skill.payload_json),
      versions:database.prepare('SELECT id,payload_json,payload_hash FROM xiaozhi_skill_versions_v1 WHERE id LIKE ? ORDER BY id').all(skillId+'@%'),
      runs:database.prepare('SELECT id,status,session_id FROM ai_agent_runs').all(),
      snapshots:database.prepare('SELECT id,payload_json,payload_hash FROM xiaozhi_skill_run_snapshots_v1').all(),
    };
  }finally{database.close();}
}

function versionFiles(rows){
  return rows.map(row=>{
    const {package:{directory}}=JSON.parse(row.payload_json);
    return {id:row.id,sha256:sha256(fs.readFileSync(path.join(root,'data','xiaozhi-pi','skills',directory,'SKILL.md')))};
  });
}

function versionBinding(runId){
  const row=records().snapshots.find(item=>item.id===runId);
  if(!row)return;
  const selected=JSON.parse(row.payload_json).selected.find(item=>item.skillId===skillId);
  return selected&&{row,selected};
}

const testId=id=>page.getByTestId(id);
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const versionRow=version=>page.locator(`[data-testid="pi-skill-version"][data-version="${version}"]`);
const activate=version=>versionRow(version).getByTestId('pi-skill-version-activate');

async function launch(){
  fixture=await startWorkbenchFixture({...fixtureOptions,...(root?{root}:{})});
  ({root,output,page}=fixture);
  await assertIsolatedPiMain(fixture.application,main,path.join(root,'profile'));
  await fixture.application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
  await page.setViewportSize({width,height});
  assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight})),{width,height});
}

async function openSkills(){
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await testId('pi-settings-tab-capabilities').click();
  await testId('pi-capability-manage-skills').click();
  const picker=testId('pi-skill-governance-select');
  await picker.selectOption(skillId);
  const history=testId('pi-skill-version-history');
  await history.waitFor();
  return history;
}

async function chooseSkill(){
  await testId('pi-skill-picker').click();
  await page.locator(`[role="menuitemradio"][data-key="${skillName}"]`).press('Enter');
  await testId('pi-skill-badge').waitFor();
}

async function send(prompt){
  await testId('office-prompt-input').fill(prompt);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
}

async function newRun(prior,sessionId){
  return until(()=>records().runs.find(run=>!prior.has(run.id)&&run.session_id===sessionId),'The expected Run was not created');
}

async function completed(run){
  const result=await until(()=>records().runs.find(item=>item.id===run.id&&!['queued','running'].includes(item.status)),'The expected Run did not reach a terminal state');
  assert.equal(result.status,'succeeded');
}

try{
  await launch();
  skillId=fixture.ids.skills.skills.find(skill=>skill.scope==='personal'&&skill.name===skillName).id;
  const previous=records().versions;
  const previousFiles=versionFiles(previous);
  const history=await openSkills();
  await testId('pi-skill-create').click();
  const form=testId('pi-skill-publication-form');
  await form.getByTestId('pi-skill-create-name').fill(skillName);
  await form.getByTestId('pi-skill-create-description').fill('可复用教学核对流程');
  await form.getByTestId('pi-skill-create-version').fill(currentVersion);
  await form.getByTestId('pi-skill-create-document').fill('# 合成流程第三版\n核对教研目标，保留来源，检查输出。');
  await form.getByTestId('pi-skill-publish').click();
  await form.waitFor({state:'detached'});
  await history.getByText('当前版本 '+currentVersion,{exact:true}).waitFor();
  const published=records().versions;
  const fileHashes=versionFiles(published);
  assert.equal(published.length,previous.length+1);
  assert.deepEqual(published.filter(row=>row.id!==skillId+'@'+currentVersion),previous);
  assert.deepEqual(fileHashes.filter(row=>row.id!==skillId+'@'+currentVersion),previousFiles);
  const v3=versionRow(currentVersion);
  await v3.getByRole('button',{name:'版本详情'}).press('Enter');
  await v3.getByText('内容指纹',{exact:false}).waitFor();
  assert.match(await v3.innerText(),/来源/);
  assert((await v3.locator('code').allTextContents()).some(hash=>/^[0-9a-f]{64}$/.test(hash)));
  check('Publish a new version through the form, inspect provenance, and preserve earlier stored files');

  await testId('nav-ai').click();
  const initialSession=await session();
  await testId('pi-new-session').click();
  const sessionId=await until(async()=>{
    const id=await session();
    return id?.startsWith('aisession_')&&id!==initialSession?id:false;
  },'The new conversation did not activate');
  await chooseSkill();
  const startRequests=fixture.requests.length;
  const firstPrior=new Set(records().runs.map(run=>run.id));
  hold=fixture.holdNextReply(heldPrompt);
  await send(heldPrompt);
  const arrived=await Promise.race([hold.arrived.then(()=>true),delay(45000,false,{ref:false})]);
  assert(arrived,'The loopback provider did not receive and hold the selected Skill request');
  const first=await newRun(firstPrior,sessionId);
  assert.equal(first.status,'running');
  const firstBinding=await until(()=>versionBinding(first.id),'The active Run did not persist Skill selection');
  assert.equal(firstBinding.selected.version,currentVersion);
  await openSkills();
  await activate(previousVersion).waitFor();
  assert(await activate(previousVersion).isDisabled());
  assert.equal(records().skill.activeVersion,currentVersion);
  assert.deepEqual(versionBinding(first.id).row,firstBinding.row);
  assert.deepEqual(versionFiles(records().versions),fileHashes);
  await page.screenshot({path:path.join(output,'skill-active-rollback-disabled.png')});
  check('A real active Run pins the selected Skill version and disables rollback');

  hold.release();
  await completed(first);
  await until(async()=>!await activate(previousVersion).isDisabled(),'The rollback control did not unlock after settlement');
  await activate(previousVersion).press('Enter');
  await history.getByText('当前版本 '+previousVersion,{exact:true}).waitFor();
  assert.equal(records().skill.activeVersion,previousVersion);
  assert.deepEqual(versionBinding(first.id).row,firstBinding.row);
  await testId('nav-ai').click();
  assert.equal(await session(),sessionId);
  await chooseSkill();
  const secondPrior=new Set(records().runs.map(run=>run.id));
  await send(nextPrompt);
  const second=await newRun(secondPrior,sessionId);
  await completed(second);
  const secondBinding=await until(()=>versionBinding(second.id),'The next Run did not persist Skill selection');
  assert.equal(secondBinding.selected.version,previousVersion);
  assert.deepEqual(versionBinding(first.id).row,firstBinding.row);
  assert.deepEqual(records().versions,published);
  assert.deepEqual(versionFiles(records().versions),fileHashes);
  report.runs=[{id:first.id,version:firstBinding.selected.version},{id:second.id,version:secondBinding.selected.version}];
  report.loopbackRequests=fixture.requests.length-startRequests;
  assert.equal(report.loopbackRequests,2);
  check('Rollback updates the next Run and leaves the completed Run bound to its original version');

  await fixture.close();
  fixture=undefined;
  await launch();
  const cold=await openSkills();
  await cold.getByText('当前版本 '+previousVersion,{exact:true}).waitFor();
  assert.equal(records().skill.activeVersion,previousVersion);
  assert.deepEqual(versionBinding(first.id).row,firstBinding.row);
  assert.deepEqual(versionBinding(second.id).row,secondBinding.row);
  assert.deepEqual(versionFiles(records().versions),fileHashes);
  assert.equal(fixture.requests.length,0);
  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(fixture.log,[]);
  await page.screenshot({path:path.join(output,'skill-cold-history.png')});
  check('Cold UI, SQLite and all saved Skill bytes agree without replaying a model request');
  assert.equal(fingerprint(buildRoot).sha256,buildBefore.sha256);
  report.success=true;
}catch(error){
  report.error=String(error.stack||error);
  process.exitCode=1;
  if(output)await page?.screenshot({path:path.join(output,'skill-fixture-failure.png')}).catch(()=>{});
}finally{
  hold?.release();
  if(fixture)await fixture.close().catch(error=>{report.closeError=String(error);process.exitCode=1;});
  if(output)fs.writeFileSync(path.join(output,'skill-run-version-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,passed:report.checks.length,root,error:report.error}));
}
