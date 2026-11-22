import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const report = {success:false, paidCalls:0, checks:[], errors:[]};
const check = name => {report.checks.push(name);console.log('PASS '+name);};
const hash = value => createHash('sha256').update(value).digest('hex');
let fixture;

try {
  fixture=await startWorkbenchFixture({background:true,onPageError:error=>report.errors.push(error.message)});
  const {page,application,root,output,ids,main,requests}=fixture;
  report.root=root;report.main=main;report.mainSha256=hash(fs.readFileSync(main));
  await assertIsolatedPiMain(application,main,path.join(root,'profile'));
  const exported=path.join(root,'exports');fs.mkdirSync(exported);
  const artifacts=await page.evaluate(async ({sessionId,destinationRoot})=>{
    const records=[];
    for(const number of [1,2,3])records.push(await window.omniEdu.exportDocumentArtifact({sessionId,title:`验收成果 ${number}`,
      type:'markdown',fileName:`验收成果-${number}.md`,contentMd:`# 合成备课样本 ${number}\n仅用于首页验收。`,destinationRoot}));
    return records;
  },{sessionId:ids.remaining.sessionId,destinationRoot:exported});
  assert(artifacts.every(row=>row?.status==='exported'));
  const readSql=sql=>{
    const db=new DatabaseSync(path.join(root,'data','app.db'),{readOnly:true});
    try{return db.prepare(sql).all();}finally{db.close();}
  };
  const tasks=()=>readSql("SELECT key,value_json FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:xitask_*' AND key = 'xiaozhi.task.v1:' || json_extract(value_json,'$.view.id') ORDER BY key");
  const taskFingerprint=hash(JSON.stringify(tasks()));
  const startsBefore=requests.length;
  const runsBefore=readSql('SELECT id FROM ai_agent_runs ORDER BY id');
  const composer=page.getByTestId('office-prompt-input');
  const currentId=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
  const originalSession=await currentId();
  await page.getByTestId('pi-new-session').click();
  await page.waitForFunction(previous=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')!==previous,originalSession);
  await page.getByTestId('workbench-home').waitFor();
  const emptySession=await currentId();

  const status=await page.evaluate(()=>window.omniEdu.getXiaozhiWorkbenchSummary({schemaVersion:1,kind:'home'}));
  assert(status.ok&&status.value.kind==='home'&&!status.value.partial,JSON.stringify(status));
  const {task,pending}=status.value;
  assert(task&&pending&&task.sessionTitle!==pending.sessionTitle);
  assert(!JSON.stringify(status.value).includes(exported));
  assert(!JSON.stringify(status.value).includes('合成备课样本'));
  assert.deepEqual(status.value.artifacts.map(row=>row.id),[artifacts[2].id,artifacts[1].id]);
  assert(tasks().some(row=>JSON.parse(row.value_json).view.id===task.taskId));
  const approval=page.getByTestId('pi-home-approval'), work=page.getByTestId('pi-home-task');
  const results=page.getByTestId('pi-home-artifact');
  await approval.waitFor();
  assert.equal(await work.getAttribute('data-task-id'),task.taskId);
  assert.deepEqual(await results.evaluateAll(rows=>rows.map(row=>row.dataset.artifactId)),[artifacts[2].id,artifacts[1].id]);
  assert(await approval.evaluate(button=>Boolean(button.compareDocumentPosition(document.querySelector('[data-testid="pi-home-task"]'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  check('实际审批和任务来自 SQLite，首页优先呈现待办，最近成果只显示两份当前记录');

  for(const size of [{width:1366,height:768},{width:1920,height:1080}]) {
    await application.evaluate(({BrowserWindow},next)=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setContentSize(next.width,next.height);},size);
    await page.setViewportSize(size);
    for(const control of [composer,approval,work,results.first(),page.getByTestId('pi-new-session'),page.getByTestId('home-task-handout')]) {
      await control.scrollIntoViewIfNeeded();
      assert(await control.evaluate(element=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0
        && element.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));}));
    }
    await composer.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,`home-${size.width}x${size.height}.png`),animations:'disabled'});
  }
  check('两种原生窗口尺寸均可使用原输入框、待办、续做、成果和常用任务');

  await composer.fill('主页应保留这段未发送的教案草稿。');
  await page.getByTestId('home-task-mock-exams').click();
  assert.equal(await composer.inputValue(),'主页应保留这段未发送的教案草稿。');
  await results.first().click();
  const detail=page.getByTestId('artifacts-detail');
  await detail.getByRole('heading',{name:artifacts[2].title,exact:true}).waitFor();
  assert.match(await detail.innerText(),/合成备课样本 3/);
  await page.getByTestId('desktop-back').click();
  await page.getByTestId('workbench-home').waitFor();
  assert.equal(await currentId(),emptySession);
  assert.equal(await composer.inputValue(),'主页应保留这段未发送的教案草稿。');
  check('近期成果直达确切的已保存版本，桌面返回保持原会话及草稿');

  await approval.click();
  const inbox=page.getByTestId('pi-approval-inbox');await inbox.waitFor();
  await inbox.getByTestId('pi-approval-inbox-row').filter({hasText:pending.sessionTitle}).first().waitFor();
  await page.getByRole('button',{name:'关闭恢复与待办',exact:true}).click();
  await work.click();
  await page.waitForFunction(target=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===target,task.sessionId);
  assert.equal(requests.length,startsBefore);
  assert.deepEqual(readSql('SELECT id FROM ai_agent_runs ORDER BY id'),runsBefore);
  assert.equal(hash(JSON.stringify(tasks())),taskFingerprint);
  check('首页入口进入原收件箱和原任务会话，导航期间没有运行模型或变更任务');

  assert.deepEqual(report.errors,[]);report.success=true;
} catch(error) {
  report.error=String(error.stack);console.error(report.error);process.exitCode=1;
  if(fixture)await fixture.page.screenshot({path:path.join(fixture.output,'failure.png')}).catch(()=>{});
} finally {
  await fixture?.close();
  if(fixture)fs.writeFileSync(path.join(fixture.output,'home-activity-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
