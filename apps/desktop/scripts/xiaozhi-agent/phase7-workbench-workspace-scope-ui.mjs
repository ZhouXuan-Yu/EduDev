import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const size=process.argv[2]||'1366x768';
assert(['1366x768','1920x1080'].includes(size));
const [width,height]=size.split('x').map(Number);
let fixture=await startWorkbenchFixture({background:true});
const {root,output,ids,main}=fixture;
let page=fixture.page;
const alternate=path.join(root,'second-teaching-workspace');
fs.mkdirSync(alternate);
const report={success:false,root,viewport:{width,height},checks:[],pageErrors:[],paidCalls:0,
  mainSha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex')};
async function attachPage() {
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  await fixture.application.evaluate(({BrowserWindow},viewport)=>
    BrowserWindow.getAllWindows()[0].setContentSize(viewport.width,viewport.height),{width,height});
  await page.setViewportSize({width,height});
}
const testId=id=>page.getByTestId(id);
const current=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
function read(q,...args) {
  const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
  try{return db.prepare(q).all(...args);}finally{db.close();}
}
function state(id){return {
  workspace: read('SELECT * FROM xiaozhi_pi_workspaces WHERE conversation_id=?',id),
  binding: read('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',id),
  approvals: read("SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type='xiaozhi_permission_v2' ORDER BY id",id),
  grants: read('SELECT * FROM xiaozhi_permission_grants_v1 WHERE session_id=? ORDER BY grant_id',id),
  runs: read('SELECT id,status FROM ai_agent_runs WHERE session_id=? ORDER BY id',id)
};}
async function wait(fn,message) {
  const end=Date.now()+35000;
  while(Date.now()<end){const value=await fn();if(value)return value;await delay(120);}
  throw Error(message);
}
async function choose() {
  await testId('pi-permission-picker').click();
  await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();
}
async function selectSession(id) {
  const workbench=testId('pi-workbench-open');
  if(await workbench.getAttribute('aria-expanded')==='true')await workbench.click();
  await testId('pi-workbench').waitFor({state:'hidden'});
  if(await current()!==id){
    const toggle=testId('pi-sidebar-toggle');
    if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
    await testId('edu-history-panel').getByTestId('ai-conversation-session-'+id).click();
  }
  await wait(async()=>await current()===id && await testId('office-prompt-input').isEnabled(),'Session did not hydrate');
}
async function checkColdApproval(session,approval,expectedRoot,otherRoot) {
  await selectSession(session);
  await testId('pi-workbench-open').click();
  await testId('pi-workbench-approvals').click();
  await testId('pi-approval-session-filter').selectOption('current');
  const rows=testId('pi-approval-inbox-row');
  await rows.filter({hasText:expectedRoot}).getByTestId('pi-approval-inbox-detail').click();
  assert.equal(await rows.count(),1);
  const card=testId('pi-approval-inbox-selected').locator('[data-approval-id="'+approval+'"]');
  await card.waitFor();
  const detail=await card.innerText();
  assert(detail.includes(expectedRoot));
  assert(!detail.includes(otherRoot));
  await page.screenshot({path:path.join(output,'cold-approval-'+session+'.png')});
}
try {
  await attachPage();
  const a=ids.permission.sessionId;
  await selectSession(a);
  const before=state(a);
  assert.equal(before.binding.length,1);
  assert.equal(before.workspace.length,1);
  const old=before.approvals.find(item=>item.status==='pending');
  assert(old);
  await fixture.application.evaluate(({dialog},target)=>{
    globalThis.scopePickerCalls=0;
    dialog.showOpenDialog=async()=>{
      globalThis.scopePickerCalls++;
      return {canceled:false,filePaths:[target]};
    };
  },alternate);
  await choose();
  await page.getByRole('alert').filter({hasText:'本会话的资料范围已经固定'}).waitFor();
  assert.equal(await fixture.application.evaluate(()=>globalThis.scopePickerCalls),0);
  assert.deepEqual(state(a),before);
  report.checks.push('Bound A workspace cannot change; chooser was not called; original approval and authority are identical');
  await testId('pi-new-session').click();
  const b=await wait(async()=>{const id=await current();return id && id!==a && id;},'New session not selected');
  await wait(()=>testId('office-prompt-input').isEnabled(),'New composer unavailable');
  await choose();
  await wait(()=>state(b).workspace.length===1,'New session did not adopt B workspace');
  assert.equal(await fixture.application.evaluate(()=>globalThis.scopePickerCalls),1);
  assert.equal(state(b).workspace[0].path,alternate);
  fixture.scenario([{name:'exec_command',input:{cmd:"Write-Output 'SYNTHETIC_PERMISSION_ONLY'"}}]);
  await testId('office-prompt-input').fill('合成核对：用当前工作目录申请同样的受控脚本。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const pending=await wait(()=>state(b).approvals.find(row=>row.status==='pending'),'B did not obtain its own approval request');
  const request=JSON.parse(pending.payload_json);
  const aRequest=JSON.parse(old.payload_json);
  assert.notEqual(request.id,aRequest.id);
  assert.equal(request.request.owner.sessionId,b);
  assert.notEqual(request.request.owner.taskId,aRequest.request.owner.taskId);
  assert(request.request.scopes.some(scope=>scope.kind==='filesystem'&&scope.root===alternate));
  assert.deepEqual(state(a),before);
  report.checks.push('New B can select B workspace and creates a separate pending approval with B scope; A state did not change');
  await page.getByRole('button',{name:'停止本轮',exact:true}).click();
  await wait(()=>state(b).runs.length===1&&state(b).runs[0].status!=='running','B Run did not finish');
  const expectedB=state(b);
  const originalRoot=before.workspace[0].path;
  const originalFile=path.join(originalRoot,'source.txt');
  const originalHash=createHash('sha256').update(fs.readFileSync(originalFile)).digest('hex');
  assert.deepEqual(fs.readdirSync(alternate),[]);
  await fixture.close();
  fixture=undefined;
  fixture=await startWorkbenchFixture({root,background:true});
  page=fixture.page;
  await attachPage();
  await checkColdApproval(a,old.id,originalRoot,alternate);
  await checkColdApproval(b,pending.id,alternate,originalRoot);
  assert.deepEqual(state(a),before);
  assert.deepEqual(state(b),expectedB);
  assert.equal(createHash('sha256').update(fs.readFileSync(originalFile)).digest('hex'),originalHash);
  assert.deepEqual(fs.readdirSync(alternate),[]);
  assert.equal(fixture.requests.length,0);
  assert.deepEqual(report.pageErrors,[]);
  report.checks.push('Cold restart preserves both exact pending requests, separate directories and original authority without model replay');
  report.success=true;
}catch(error){report.error=String(error.stack||error);await page.screenshot({path:path.join(output,'scope-probe-failure.png')}).catch(()=>{});}
finally{if(fixture)await fixture.close();fs.writeFileSync(path.join(output,'workspace-scope-probe.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.success)process.exitCode=1;}
