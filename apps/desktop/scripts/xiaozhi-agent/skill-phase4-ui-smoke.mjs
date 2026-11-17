import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';

fs.mkdirSync('test-results/xiaozhi-agent', {recursive: true});
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/skill-phase4-ui-'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase4-ui-'));
const dataRoot = path.join(root, 'data');
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, `const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(path.join(root, 'profile'))});net.fetch=async()=>{throw Error('model network forbidden in UI fixture');};import(${JSON.stringify(pathToFileURL(path.resolve('out/main/index.js')).href)});`);
let application, page;
const checks = [];
const report = {success: false, root, output, checks, paidCalls: 0, error: undefined,
  boundary: 'Actual built Electron main/preload/original Skill settings. User actions drive publication, rollback, Team reviews and cold init. No model call or native chooser used.'};
function check(name) {checks.push({name, pass: true}); console.log('PASS ' + name);}
function readback() {
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'), {readOnly: true});
  try {
    const records = table => db.prepare(`SELECT payload_json FROM ${table}`).all().map(row => JSON.parse(row.payload_json));
    return {skills: records('xiaozhi_skill_governance_v1'), versions: records('xiaozhi_skill_versions_v1'),
      reviews: records('xiaozhi_skill_reviews_v1'), memberships: records('xiaozhi_skill_memberships_v1'),
      runs: db.prepare('SELECT count(*) AS n FROM ai_agent_runs').get().n};
  } finally {db.close();}
}
async function until(test) {
  const deadline = Date.now() + 20000;
  while (!test()) {if (Date.now() >= deadline) throw Error('fixture_readback_timeout'); await page.waitForTimeout(30);}
}
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve('../..'), OMNI_EDU_XIAOZHI_PI: '1',
    DEEPSEEK_API_KEY: 'synthetic-ui-no-model', DEEPSEEK_MODEL: 'deepseek-flash'};
  delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({args: [bootstrap], env, timeout: 60000}); page = await application.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout: 40000});
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
  await page.getByRole('button', {name: '设置', exact: true}).click();
  const advanced = page.getByTestId('pi-settings-advanced-toggle');
  if (await advanced.getAttribute('aria-expanded') === 'false') await advanced.click();
  await page.getByTestId('pi-settings-tab-skills').click();
  await page.getByTestId('pi-skill-governance-select').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="pi-skill-create"]')?.disabled);
}
async function create(version, document, name = 'ui-workflow') {
  await page.getByTestId('pi-skill-create').click();
  const form = page.getByTestId('pi-skill-publication-form'); await form.waitFor();
  await form.getByTestId('pi-skill-create-name').fill(name);
  await form.getByTestId('pi-skill-create-description').fill('可复用教学核对流程');
  await form.getByTestId('pi-skill-create-version').fill(version);
  await form.getByTestId('pi-skill-create-document').fill(document);
  await form.getByTestId('pi-skill-publish').click();
  await form.waitFor({state: 'detached'});
  await page.waitForFunction(() => !document.querySelector('[data-testid="pi-skill-create"]')?.disabled);
}
try {
  await launch();
  assert((await page.getByTestId('pi-skill-governance-select').innerText()).includes('官方'));
  check('Existing Skill settings expose main-owned Personal Team Official governance alongside original controls');
  await create('1.0.0', '# UI流程第一版\n核对要求，列出通用步骤，按真实结果检查。');
  await until(() => readback().skills.some(skill => skill.name === 'ui-workflow' && skill.activeVersion === '1.0.0'));
  let skill = readback().skills.find(skill => skill.name === 'ui-workflow');
  assert.equal(skill.scope, 'personal'); assert.match(skill.ownerId, /^user_/);
  const first = readback().versions.find(version => version.skillId === skill.id && version.version === '1.0.0');
  const firstBytes = fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', 'skills', first.package.directory, 'SKILL.md'));
  assert((await page.getByTestId('pi-skill-version-history').innerText()).includes('个人'));
  check('Visible create form validates and publishes Personal version with actual SQLite and immutable file readback');
  await create('2.0.0', '# UI流程第二版\n核对目标与来源，完成后检查输出事实。');
  await until(() => readback().skills.find(item => item.id === skill.id)?.activeVersion === '2.0.0');
  const second = readback().versions.find(version => version.skillId === skill.id && version.version === '2.0.0');
  assert.notEqual(first.package.directory, second.package.directory);
  assert.deepEqual(fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', 'skills', first.package.directory, 'SKILL.md')), firstBytes);
  const oldVersion = page.locator('[data-testid="pi-skill-version"][data-version="1.0.0"]');
  await oldVersion.getByTestId('pi-skill-version-activate').click();
  await until(() => readback().skills.find(item => item.id === skill.id)?.activeVersion === '1.0.0');
  const newVersion = page.locator('[data-testid="pi-skill-version"][data-version="2.0.0"]');
  await newVersion.getByTestId('pi-skill-version-withdraw').click();
  await until(() => readback().versions.find(item => item.skillId === skill.id && item.version === '2.0.0')?.state === 'withdrawn');
  assert(await newVersion.getByTestId('pi-skill-version-activate').isDisabled());
  check('Version history drives rollback and withdrawal while original files remain exact and withdrawn activation is disabled');
  await page.getByTestId('pi-skill-team-name').fill('合成页面教研组');
  await page.getByTestId('pi-skill-team-create').click();
  await page.getByTestId('pi-skill-team-leave').waitFor();
  await oldVersion.getByTestId('pi-skill-share').click();
  const reviewCard = page.getByTestId('pi-skill-review'); await reviewCard.waitFor();
  const reviewId = await reviewCard.getAttribute('data-review-id');
  const pending = readback().reviews.find(review => review.id === reviewId); assert.equal(pending.status, 'pending');
  assert.equal(readback().versions.find(version => version.skillId === pending.skillId).state, 'pending_review');
  await reviewCard.getByTestId('pi-skill-review-approve').click();
  await until(() => readback().reviews.find(review => review.id === reviewId)?.status === 'approved');
  assert.equal(readback().skills.find(item => item.id === pending.skillId).scope, 'team');
  assert.notEqual(readback().versions.find(version => version.skillId === pending.skillId).package.directory, first.package.directory);
  check('Actual Team create share and administrator review publish an independent frozen copy through typed IPC');
  await page.getByTestId('pi-skill-governance-select').selectOption(pending.skillId);
  await page.getByTestId('pi-skill-team-edit').click();
  const editForm = page.getByTestId('pi-skill-publication-form');
  await editForm.getByTestId('pi-skill-create-description').fill('团队维护的通用核对流程');
  await editForm.getByTestId('pi-skill-create-document').fill('# 团队UI第二版\n核对来源，按团队流程验证结果。');
  await editForm.getByTestId('pi-skill-publish').click(); await editForm.waitFor({state: 'detached'});
  const updateReview = page.getByTestId('pi-skill-review'); await updateReview.waitFor();
  assert.equal(readback().skills.find(item => item.id === pending.skillId).activeVersion, '1.0.0');
  await updateReview.getByTestId('pi-skill-review-approve').click();
  await until(() => readback().skills.find(item => item.id === pending.skillId)?.activeVersion === '2.0.0');
  check('Team maintenance submits a new immutable pending version and keeps the approved active version until review');
  await create('1.0.0', '# 不合格资料\n学生姓名：合成学生，电话13800138000。', 'ui-private-blocked');
  const invalid = readback().skills.find(item => item.name === 'ui-private-blocked');
  assert.equal(readback().versions.find(item => item.skillId === invalid.id).state, 'draft');
  assert.match(await page.getByTestId('pi-skill-governance-notice').innerText(), /检查未通过/);
  assert((await page.getByTestId('pi-skill-version-history').innerText()).includes('sensitive_content'));
  const forged = await page.evaluate(() => window.omniEdu.mutateXiaozhiSkillGovernance({action: 'team_create', name: 'forged', actorRole: 'admin'}));
  assert.equal(forged.ok, false);
  check('Privacy validation has actionable visible Draft feedback and forged renderer roles are rejected');
  for (const size of [{width: 1366, height: 768}, {width: 1920, height: 1080}]) {
    await page.setViewportSize(size); const createButton = page.getByTestId('pi-skill-create'); await createButton.scrollIntoViewIfNeeded();
    const box = await createButton.boundingBox(); assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
    await page.screenshot({path: path.join(output, `skills-${size.width}.png`)});
  }
  check('Skill primary actions remain reachable at both required desktop viewport sizes');
  await application.close(); application = undefined; await launch();
  const cold = readback(); assert.equal(cold.skills.find(item => item.id === skill.id).activeVersion, '1.0.0');
  assert.equal(cold.skills.find(item => item.id === pending.skillId).activeVersion, '2.0.0');
  assert.equal(cold.versions.find(item => item.skillId === skill.id && item.version === '2.0.0').state, 'withdrawn');
  assert.equal(cold.runs, 0); assert.equal(cold.reviews.find(item => item.id === reviewId).status, 'approved');
  check('Actual application cold init retains versions reviews private ownership and zero replayed Agent Runs');
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {await application?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));}
