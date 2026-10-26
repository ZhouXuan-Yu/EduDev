// Launch the reviewed current build against its isolated real-provider acceptance data.
// No requests are sent automatically. This visible window is left for the teacher to try.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import {createStyleAuditor} from './ui-style-evidence.mjs';
import {captureStyleMatrix} from './ui-style-matrix.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert(report.success, 'Only a completed acceptance report can seed the trial');
const output = path.resolve(process.argv[3] || report.output);
fs.mkdirSync(output, { recursive: true });
const dataRoot = path.join(report.temp, 'data');
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||path.join(desktop,'out'));
const env = {
  ...process.env,
  OMNI_EDU_DATA_ROOT: dataRoot,
  OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
  NODE_ENV: 'development',
};
for (const key of Object.keys(env)) if (key.startsWith('OMNI_EDU_E2E_')) delete env[key];
for (const key of [
  'ELECTRON_RUN_AS_NODE',
  'NODE_OPTIONS',
  'ELECTRON_RENDERER_URL',
  'XIAOZHI_REASONING_RESUME',
])
  delete env[key];
const config = fs.readFileSync(
  process.env.XIAOZHI_AUDIT_ENV || path.join(desktop, '.env.local'),
  'utf8',
);
for (const name of ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'])
  if (!env[name])
    env[name] = config
      .match(new RegExp('^' + name + '\\s*=\\s*(.*?)\\s*$', 'm'))?.[1]
      ?.replace(/^['"]|['"]$/g, '');
assert(env.DEEPSEEK_API_KEY);
const db = new DatabaseSync(path.join(dataRoot, 'app.db'), { readOnly: true });
const row = db
  .prepare(
    "SELECT session_id,metadata_json FROM ai_conversation_messages WHERE json_extract(metadata_json,'$.agentRunId')=? AND role='assistant'",
  )
  .get(report.natural.id);
db.close();
assert(row);
const app = await electron.launch({
  args: [
    path.join(buildRoot, 'main/index.js'),
    '--force-device-scale-factor=1',
    '--user-data-dir=' + path.join(report.temp, 'profile'),
  ],
  cwd: desktop,
  env,
  timeout: 60000,
});
const page = await app.firstWindow(),
  errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.getByTestId('office-prompt-input').waitFor({ timeout: 60000 });
await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&!input.disabled&&document.querySelector('.office-composer-container')?.dataset.sessionId!=='loading';},undefined,{timeout:60000});
async function selectSession(id){
  if((await page.locator('.office-composer-container').getAttribute('data-session-id'))===id)return;
  if(!await page.getByTestId('edu-history-panel').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
  await page.getByTestId('ai-conversation-session-'+id).click();
  await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.dataset.sessionId===id,id);
}
if (
  (await page.locator('.office-composer-container').getAttribute('data-session-id')) !==
  row.session_id
)
  await selectSession(row.session_id);
await page.waitForFunction(
  (id) => document.querySelector('.office-composer-container')?.dataset.sessionId === id,
  row.session_id,
);
await page.getByTestId('agent-trace-toggle').first().waitFor();
const cold = await page.evaluate((id) => window.omniEdu.getXiaozhiSnapshot(id), row.session_id);
const turn = cold.projection.turns.find((turn) => turn.id === report.natural.id),
  saved = JSON.parse(row.metadata_json);
assert.deepEqual(turn.presentation, saved.chatPresentation);
assert.equal(
  turn.items.find((item) => item.phase === 'final_answer').text,
  saved.publicItems.find((item) => item.phase === 'final_answer').text,
);
const screenshots = [];
// Capture the completed public tool process with raw reasoning still closed.
// This reuses acceptance data and sends no model request.
const readDb = new DatabaseSync(path.join(dataRoot, 'app.db'), { readOnly: true });
const toolRow = readDb.prepare(
  "SELECT session_id FROM ai_conversation_messages WHERE json_extract(metadata_json,'$.agentRunId')=? AND role='assistant'",
).get(report.tools.id);
readDb.close();
assert(toolRow);
await selectSession(toolRow.session_id);
await page.waitForFunction(
  id => document.querySelector('.office-composer-container')?.dataset.sessionId === id,
  toolRow.session_id,
);
for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w.isMaximized()) w.unmaximize();
    w.setContentSize(size.width, size.height);
  }, size);
  await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, size);
  const toggle = page.getByTestId('agent-trace-toggle').first();
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  assert.equal(await page.getByTestId('model-reasoning').count(), 0);
  const kinds = await page.getByTestId('agent-tool-glyph').evaluateAll(nodes => nodes.map(n => n.dataset.toolKind));
  assert(kinds.includes('directory') && kinds.includes('file-read') && kinds.includes('question'));
  await toggle.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(350);
  const image = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());
  const filename = `public-tool-process-${size.width}.png`;
  fs.writeFileSync(path.join(output, filename), Buffer.from(image.split(',')[1], 'base64'));
  screenshots.push(filename);
}
await selectSession(row.session_id);
await page.waitForFunction(
  id => document.querySelector('.office-composer-container')?.dataset.sessionId === id,
  row.session_id,
);
for (const size of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
]) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w.isMaximized()) w.unmaximize();
    w.setContentSize(size.width, size.height);
    w.setTitle('小智 · 桌面对齐 · 公开过程版（1c54）');
    w.show();
    w.focus();
  }, size);
  await page.waitForFunction(
    (size) => innerWidth === size.width && innerHeight === size.height,
    size,
  );
  const toggle = page.getByTestId('agent-trace-toggle').first();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await page.waitForTimeout(250);
  await page.getByTestId('office-conversation').press('Control+Home');
  await toggle.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(350);
  assert.equal(await page.getByTestId('office-turn-duration').count(), 0);
  assert.equal(await page.getByTestId('reply-no-source').count(), 0);
  assert.equal(await page.getByTestId('agent-trace-toggle').count(), 1);
  const image = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL(),
  );
  const filename = `final-natural-${size.width}.png`;
  fs.writeFileSync(path.join(output, filename), Buffer.from(image.split(',')[1], 'base64'));
  screenshots.push(filename);
}
await page.emulateMedia({ reducedMotion: 'reduce' });
const reducedMotion = await page.evaluate(() => ({
  matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
  theme: document.querySelector('[data-testid="office-conversation"]').dataset.theme,
}));
await page.emulateMedia({ reducedMotion: 'no-preference' });
const auditor=await createStyleAuditor(page,path.join(desktop,'src/renderer')),matrices=[];
for(const size of [{width:1920,height:1080},{width:1366,height:768}])matrices.push(await captureStyleMatrix({app,page,auditor,rendererRoot:path.join(desktop,'src/renderer'),output,theme:'light',size}));
const toggle=page.getByTestId('agent-trace-toggle').first();
if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
const actions=await page.getByTestId('reply-actions').locator('button').evaluateAll(buttons=>buttons.map(button=>({text:button.textContent.trim(),width:button.clientWidth,scrollWidth:button.scrollWidth,rect:button.getBoundingClientRect().toJSON()})));
assert(actions.every(action=>!action.text&&action.scrollWidth<=action.width),'Native icon actions must contain only icons without overflowing labels');
assert(actions.every((action,i)=>!i||actions[i-1].rect.right<=action.rect.left),'Reply actions must not overlap');
const runtime = await app.evaluate(({ BrowserWindow }) => ({
  cwd: process.cwd(),
  pid: process.pid,
  title: BrowserWindow.getAllWindows()[0].getTitle(),
  dataRoot: process.env.OMNI_EDU_DATA_ROOT,
}));
const mainSha256 = createHash('sha256')
  .update(fs.readFileSync(path.join(buildRoot, 'main/index.js')))
  .digest('hex');
fs.writeFileSync(
  path.join(output, 'trial.json'),
  JSON.stringify(
    {
      success: true,
      runtime,
      url: page.url(),
      sessionId: row.session_id,
      screenshots,
      reducedMotion,
      errors,
      mainSha256,
      matrices,
      actions,
      coldPresentationReadback: true,
    },
    null,
    2,
  ),
);
console.log('Reviewed current-worktree trial is visible; no automatic provider request.');
await new Promise((resolve) => app.on('close', resolve));
