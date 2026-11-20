import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const size=process.argv[2]||'1366x768';
assert(['1366x768','1920x1080'].includes(size));
const [width,height]=size.split('x').map(Number);
const report={success:false,viewport:{width,height},checks:[],pageErrors:[],paidCalls:0,
  scope:'Real hidden Electron, keyboard rejection and original typed permission handler delayed 1800ms and awaited to completion. Closing a view never cancels the sent decision. Owned synthetic SQLite, local loopback SSE only.'};
let fixture;
const until=async(predicate,ms=15000)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Approval decision keyboard condition timed out');};
try{
  fixture=await startWorkbenchFixture({background:true});
  const {application,page,root,main}=fixture;
  report.root=root;report.main=main;report.mainSha256=createHash('sha256').update(fs.readFileSync(main)).digest('hex');
  report.seedLoopbackCalls=fixture.requests.length;
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  await application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
  await page.setViewportSize({width,height});
  await application.evaluate(({ipcMain},output)=>{
    const handlers=ipcMain._invokeHandlers;
    const files=process.getBuiltinModule('fs'),paths=process.getBuiltinModule('path'),crypto=process.getBuiltinModule('crypto');
    globalThis.phase7DecisionKeyboard={calls:[]};
    for(const channel of ['xiaozhi:permission-decide','xiaozhi:decide']){
      const original=handlers.get(channel);if(!original)throw Error('Original decision handler missing: '+channel);
      handlers.set(channel,async(event,input)=>{
        const call={channel,input:structuredClone(input),enteredAt:Date.now(),completed:false};
        globalThis.phase7DecisionKeyboard.calls.push(call);
        const count=globalThis.phase7DecisionKeyboard.calls.filter(value=>value.input.approvalId===input.approvalId).length;
        const key=crypto.createHash('sha256').update(String(input.approvalId)).digest('hex');
        const stem=paths.join(output,`decision-keyboard-${key}-${count}`);
        files.writeFileSync(stem+'-started.json',JSON.stringify({channel,input,enteredAt:call.enteredAt}));
        await new Promise(resolve=>setTimeout(resolve,1800));
        try{const result=await original(event,input);call.result=result;return result;}
        finally{
          call.completed=true;call.completedAt=Date.now();
          files.writeFileSync(stem+'-completed.tmp',JSON.stringify(call));
          files.renameSync(stem+'-completed.tmp',stem+'-completed.json');
        }
      });
    }
  },fixture.output);
  const testId=id=>page.getByTestId(id),panel=page.getByRole('dialog',{name:'恢复与待办',exact:true});
  const facts=()=>{const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});try{return{
    approvals:db.prepare('SELECT id,session_id,payload_json FROM ai_confirmation_items ORDER BY id').all(),
    runs:db.prepare('SELECT id,status FROM ai_agent_runs ORDER BY id').all(),
    grants:db.prepare('SELECT * FROM xiaozhi_permission_grants_v1 ORDER BY grant_id').all()
  };}finally{db.close();}};
  const approval=id=>JSON.parse(facts().approvals.find(row=>row.id===id).payload_json);
  const receipts=(id,suffix)=>{
    const key=createHash('sha256').update(String(id)).digest('hex');
    return fs.readdirSync(fixture.output).filter(name=>name.startsWith(`decision-keyboard-${key}-`)&&name.endsWith(suffix));
  };
  const currentSession=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
  const focused=locator=>locator.evaluate(element=>element===document.activeElement);
  async function tabTo(target){for(let step=0;step<100;step++){if(await focused(target))return;await page.keyboard.press('Tab');}throw Error('Keyboard target not reached');}
  async function inbox(){await testId('pi-workbench-open').focus();await page.keyboard.press('Enter');await panel.waitFor();await tabTo(testId('pi-workbench-approvals'));await page.keyboard.press('Space');await testId('pi-approval-inbox').waitFor();}
  async function selectModern(sessionTitle){const row=testId('pi-approval-inbox-row').filter({hasText:sessionTitle});const control=row.getByTestId('pi-approval-inbox-detail');await control.waitFor();await tabTo(control);await page.keyboard.press('Space');const selected=testId('pi-approval-inbox-selected');await selected.waitFor();return selected;}
  async function beginRejection(card,id,legacy=false){
    const before=facts(),modelCalls=fixture.requests.length,reject=card.getByTestId(legacy?'pi-copy-reject':'pi-permission-reject');
    await tabTo(reject);await page.keyboard.press('Space');
    await card.getByRole('status').filter({hasText:legacy?'正在提交':'正在保存决定'}).waitFor();
    assert(await reject.isDisabled());
    assert(await card.locator('[data-slot="chat-tool-trigger"]').evaluate(element=>element===document.activeElement));
    await until(()=>receipts(id,'-started.json').length>0);
    return{before,modelCalls};
  }
  async function settled(id,before){
    await until(()=>receipts(id,'-completed.json').length>0);
    const calls=receipts(id,'-completed.json').map(name=>JSON.parse(fs.readFileSync(path.join(fixture.output,name),'utf8')));
    assert.equal(receipts(id,'-started.json').length,1);
    assert.equal(calls.length,1);assert.equal(calls[0].result.ok,true);assert.equal(approval(id).state,'rejected');
    assert.deepEqual(facts().runs,before.before.runs);assert.deepEqual(facts().grants,before.before.grants);
    assert.equal(fixture.requests.length,before.modelCalls);return calls[0];
  }
  async function freshPending(label){
    if(await panel.isVisible())await page.keyboard.press('Escape');
    await panel.waitFor({state:'hidden'});
    const prior=await currentSession();await testId('pi-new-session').click();
    await until(async()=>Boolean(await currentSession())&&await currentSession()!==prior);
    const sessionId=await currentSession();
    fixture.scenario([{name:'exec_command',input:{cmd:`Write-Output '${label}'`}}]);
    await testId('office-prompt-input').fill(label);await testId('office-prompt-input').press('Enter');
    let item;
    await until(async()=>{
      item=facts().approvals.filter(row=>row.session_id===sessionId).map(row=>JSON.parse(row.payload_json)).find(row=>row.schemaVersion===2&&row.state==='pending');
      return item&&!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId)).running;
    },60000);
    return{sessionId,id:item.id,title:label};
  }

  const modernId=fixture.ids.permission.approvals[0].id;
  await inbox();const selected=await selectModern('审批样本');
  const first=await beginRejection(selected,modernId);
  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden',timeout:1500});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='pi-workbench-open');
  await inbox();const legacyRow=testId('pi-approval-inbox-row').filter({hasText:'legacy-pending.txt'});
  await tabTo(legacyRow.getByTestId('pi-approval-inbox-detail'));await page.keyboard.press('Space');
  await testId('pi-approval-inbox-selected').getByTestId('pi-copy-approval').waitFor();
  report.firstDecision=await settled(modernId,first);
  assert.equal(await testId('pi-approval-inbox-selected').getByTestId('pi-copy-approval').getAttribute('data-approval-id'),fixture.ids.legacy.pendingApprovalId);
  assert.equal(await testId('pi-approval-inbox-selected').getByTestId('pi-permission-approval').count(),0);
  report.checks.push('Inbox Escape during a sent rejection closes and restores trigger focus; original decision completes once without replacing the newly selected legacy request');
  console.log('PASS '+report.checks.at(-1));

  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
  await inbox();await testId('pi-approval-filter').selectOption('rejected');
  const firstHistory=await selectModern('审批样本');
  assert.equal(await firstHistory.getByRole('status').filter({hasText:'正在保存决定'}).count(),0);
  assert.equal(await firstHistory.getByTestId('pi-permission-approval').getAttribute('data-state'),'rejected');

  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
  const inlinePending=await freshPending('SYNTHETIC_INLINE_DECISION_FOCUS');
  const inline=page.locator(`[data-testid="pi-permission-approval"][data-approval-id="${inlinePending.id}"]`);
  await inline.waitFor();const second=await beginRejection(inline,inlinePending.id);
  await page.keyboard.press('Tab');
  assert(await inline.evaluate(element=>element.contains(document.activeElement)));
  report.inlineDecision=await settled(inlinePending.id,second);
  await until(()=>inline.getAttribute('data-state').then(state=>state==='rejected'));
  assert(await inline.evaluate(element=>element.contains(document.activeElement)));
  report.checks.push('Inline keyboard rejection keeps focus in its original card during busy and after completion, with one real decision and no model replay');
  console.log('PASS '+report.checks.at(-1));

  const finalPending=await freshPending('SYNTHETIC_INBOX_DECISION_RESULT');
  await inbox();const finalSelected=await selectModern(finalPending.title);
  const third=await beginRejection(finalSelected,finalPending.id);
  report.resultDecision=await settled(finalPending.id,third);
  await until(()=>testId('pi-approval-inbox-selected').count().then(count=>count===0));
  assert(await testId('pi-approval-inbox').locator('h2').evaluate(element=>element===document.activeElement));
  await page.keyboard.press('Tab');assert(await panel.evaluate(element=>element.contains(document.activeElement)));
  report.resultTabFocus=await page.evaluate(()=>({tag:document.activeElement?.tagName,testId:document.activeElement?.getAttribute('data-testid')}));
  assert.equal(report.resultTabFocus.testId,'pi-approval-filter');
  // Keep result Tab reachability separate from Escape while saving. Native
  // select/overlay Escape behavior has its own retained diagnostic evidence.
  await page.keyboard.press('Shift+Tab');assert(await focused(testId('pi-workbench-approvals')));
  await page.keyboard.press('Shift+Tab');assert(await focused(testId('pi-workbench-tasks')));
  const close=panel.getByRole('button',{name:'关闭恢复与待办',exact:true});
  await page.keyboard.press('Shift+Tab');assert(await focused(close));
  await page.keyboard.press('Enter');await panel.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='pi-workbench-open');
  report.checks.push('Successful inbox result retains heading and filter Tab focus; keyboard traversal reaches the close button and Enter restores the original trigger');
  console.log('PASS '+report.checks.at(-1));

  const source=path.join(fixture.ids.workspace,'source.txt'),target=path.join(fixture.ids.workspace,'legacy-pending.txt');
  const sourceHash=createHash('sha256').update(fs.readFileSync(source)).digest('hex');assert.equal(fs.existsSync(target),false);
  await inbox();const legacyControl=testId('pi-approval-inbox-row').filter({hasText:'legacy-pending.txt'}).getByTestId('pi-approval-inbox-detail');
  await tabTo(legacyControl);await page.keyboard.press('Space');
  const legacySelected=testId('pi-approval-inbox-selected');await legacySelected.getByTestId('pi-copy-approval').waitFor();
  const legacyId=fixture.ids.legacy.pendingApprovalId,fourth=await beginRejection(legacySelected,legacyId,true);
  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden',timeout:1500});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='pi-workbench-open');
  await inbox();await testId('pi-approval-filter').selectOption('rejected');
  const historical=await selectModern('审批样本');await historical.getByTestId('pi-permission-approval').waitFor();
  report.legacyDecision=await settled(legacyId,fourth);
  assert.equal(await historical.getByTestId('pi-permission-approval').getAttribute('data-approval-id'),modernId);
  assert.equal(await historical.getByTestId('pi-copy-approval').count(),0);
  assert.equal(createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sourceHash);assert.equal(fs.existsSync(target),false);
  report.legacySourceSha256=sourceHash;
  report.checks.push('Legacy rejection closes with Escape and completes once without overwriting a newer modern selection; source bytes stay intact and the target is absent');
  console.log('PASS '+report.checks.at(-1));
  assert.deepEqual(report.pageErrors,[]);report.totalLoopbackCalls=fixture.requests.length;report.decisionAddedModelCalls=0;
  await page.screenshot({path:path.join(fixture.output,`decision-keyboard-${size}.png`)});
  report.success=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;await fixture?.page.screenshot({path:path.join(fixture.output,'decision-keyboard-failure.png')}).catch(()=>{});}
finally{
  if(fixture){
    await until(()=>fs.readdirSync(fixture.output).filter(name=>name.startsWith('decision-keyboard-')&&name.endsWith('-started.json'))
      .every(name=>fs.existsSync(path.join(fixture.output,name.replace('-started.json','-completed.json')))))
      .catch(error=>{report.handlerWaitError=String(error);});
    await fixture.close().catch(error=>{report.closeError=String(error);report.success=false;process.exitCode=1;});
    fs.writeFileSync(path.join(fixture.output,'decision-keyboard-report.json'),JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify(report));
}
