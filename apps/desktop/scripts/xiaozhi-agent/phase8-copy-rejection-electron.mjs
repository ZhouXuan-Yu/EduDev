import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const report = {success:false, checks:[], paidRequests:0};
let fixture;
try {
  fixture = await startWorkbenchFixture({background:true});
  report.root = fixture.root;
  const {page, application} = fixture;
  const workspace = path.join(fixture.root, 'copy-workspace');
  fs.mkdirSync(workspace);
  const bytes = Buffer.from('合成课堂资料');
  const source = path.join(workspace, 'facts.txt'), target = path.join(workspace, 'copy.txt');
  fs.writeFileSync(source, bytes);
  const composer = page.locator('.office-composer-container');
  const former = await composer.getAttribute('data-session-id');
  await page.getByTestId('pi-new-session').click();
  await page.waitForFunction(id => {
    const current = document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    return current && current !== id;
  }, former);
  const sessionId = await composer.getAttribute('data-session-id');
  assert(sessionId);
  await application.evaluate(({dialog}, folder) => {
    globalThis.phase8OriginalPicker = dialog.showOpenDialog;
    dialog.showOpenDialog = async () => ({canceled:false,filePaths:[folder]});
  }, workspace);
  try {
    await page.getByTestId('pi-permission-picker').click();
    await page.getByRole('menuitem', {name:'选择教学工作目录',exact:true}).click();
    await page.waitForFunction(async id => Boolean((await window.omniEdu.getXiaozhiSnapshot(id)).workspace), sessionId);
  } finally {
    await application.evaluate(({dialog}) => {
      dialog.showOpenDialog = globalThis.phase8OriginalPicker;
      delete globalThis.phase8OriginalPicker;
    });
  }
  const copy = {name:'office_copy_file',input:{source:'facts.txt',target:'copy.txt'}};
  fixture.scenario([copy,
    {name:'update_task_plan', input:{schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:0,requirementsVersion:1,reason:'合成复制测试',steps:[
      {id:'copy',text:'复制合成文件',dependsOn:[],reported:'pending',kind:'saved_text',target:'copy.txt'},
      {id:'review',text:'教师核对复制',dependsOn:['copy'],reported:'pending',kind:'human'},
    ]}},
    {...copy,input:{...copy.input,taskStepId:'copy'}},
  ]);
  await page.getByTestId('office-prompt-input').fill('复制 facts.txt 为 copy.txt，请先等我确认。');
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const pending = page.locator('[data-testid="pi-permission-approval"][data-state="pending"]');
  await pending.waitFor({timeout:20000});
  const id = await pending.getAttribute('data-approval-id');
  assert(id && !fs.existsSync(target));
  await pending.getByTestId('pi-permission-reject').click();
  const snapshot = () => fixture.page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
  await page.waitForFunction(async id => {
    const state = await window.omniEdu.getXiaozhiSnapshot(id);
    return !state.running && state.projection.turns.at(-1)?.status === 'completed';
  }, sessionId, {timeout:20000});
  const run = (await snapshot()).projection.turns.at(-1);
  const answer = run.items.filter(item => item.role === 'assistant').map(item => item.text || '').join('\n');
  assert.match(answer,/已拒绝复制，本次未写入副本/u);
  assert(!answer.includes('未生成可确认保存的成果'));
  assert(!fs.existsSync(target));
  assert(fs.readFileSync(source).equals(bytes));
  const db = new DatabaseSync(path.join(fixture.root,'data','app.db'),{readOnly:true});
  try {
    const [record] = db.prepare('SELECT payload_json FROM ai_confirmation_items WHERE id=? AND run_id=?').all(id,run.id);
    assert.equal(JSON.parse(record.payload_json).state,'rejected');
    assert.equal(db.prepare('SELECT count(*) AS n FROM ai_confirmation_items WHERE run_id=?').get(run.id).n,1);
  } finally {db.close();}
  report.checks.push('One actual refusal after an earlier blocked attempt produces exact final copy status, keeps source bytes, and writes no target.');
  await fixture.close();
  fixture = undefined;
  fixture = await startWorkbenchFixture({background:true, root:report.root});
  const restored = (await snapshot()).projection.turns.find(turn => turn.id === run.id);
  assert(restored.items.some(item => item.text?.includes('已拒绝复制，本次未写入副本')));
  assert(!fs.existsSync(target));
  assert.equal(fixture.requests.length,0);
  report.checks.push('Cold readback retains that original final outcome and still shows no write.');
  report.success = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  if (fixture) {
    await fixture.close();
    fs.writeFileSync(path.join(fixture.root, 'evidence', 'copy-rejection-report.json'), JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify(report));
}
