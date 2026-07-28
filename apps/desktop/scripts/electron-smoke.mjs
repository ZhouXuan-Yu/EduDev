import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-smoke-'));

async function launchApp() {
  const app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: {
      ...process.env,
      OMNI_EDU_DATA_ROOT: dataRoot,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));
  return { app, page };
}

async function closeApp(app) {
  await Promise.race([
    app.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  const child = app.process();
  if (child && !child.killed) child.kill();
}

async function run() {
  const first = await launchApp();
  const bootstrap = await first.page.evaluate(() => window.omniEdu.bootstrap());
  assert.equal(typeof bootstrap.dataRoot, 'string');
  assert.ok(bootstrap.students.length >= 1, 'seed student should exist');

  const knowledgeFile = join(dataRoot, 'teacher-note.md');
  writeFileSync(
    knowledgeFile,
    [
      '# 一次函数讲义',
      '',
      'k 值为正时，函数图像从左下到右上；k 值为负时，函数图像从左上到右下。',
      '',
      '## 易错点',
      '',
      '学生常把截距 b 和斜率 k 的图像影响混在一起，需要用图像变化分步训练。',
    ].join('\n'),
    'utf8',
  );
  const knowledgeImport = await first.page.evaluate((filePath) => window.omniEdu.importKnowledgeResourcePaths([filePath]), knowledgeFile);
  assert.equal(knowledgeImport.status, 'succeeded', 'knowledge import should succeed');
  assert.equal(knowledgeImport.overview.counts.resources, 1, 'one knowledge resource should be imported');
  assert.ok(knowledgeImport.overview.counts.chunks >= 1, 'knowledge chunks should be created');
  assert.ok(knowledgeImport.overview.counts.nodes >= 2, 'knowledge graph nodes should be created');
  assert.ok(knowledgeImport.overview.counts.edges >= 1, 'knowledge graph edges should be created');

  const savedSettings = await first.page.evaluate(() => window.omniEdu.saveDeepSeekSettings({
    apiKey: 'sk-smoke-test-local-only',
    model: 'deepseek-v4-flash',
  }));
  assert.equal(savedSettings.configured, true, 'DeepSeek settings should be saved');
  assert.equal(savedSettings.model, 'deepseek-v4-flash');

  for (let index = 1; index <= 30; index += 1) {
    await first.page.evaluate((studentIndex) => window.omniEdu.createStudent({
      displayName: `验证学生${studentIndex}`,
      grade: '初二',
      subjects: ['数学'],
      goals: '持久化验证',
      currentIssues: '用于验证重启后仍可读取',
      tags: ['持久化验证'],
    }), index);
  }

  const afterCreate = await first.page.evaluate(() => window.omniEdu.listStudents('验证学生'));
  assert.equal(afterCreate.length, 30, 'should create 30 verification students');
  await closeApp(first.app);

  const second = await launchApp();
  const afterRestart = await second.page.evaluate(() => window.omniEdu.listStudents('验证学生'));
  assert.equal(afterRestart.length, 30, '30 students should persist after restart');
  const settingsAfterRestart = await second.page.evaluate(() => window.omniEdu.getDeepSeekSettings());
  assert.equal(settingsAfterRestart.configured, true, 'DeepSeek settings should persist after restart');
  assert.equal(settingsAfterRestart.model, 'deepseek-v4-flash');
  const dataRootAfterRestart = await second.page.evaluate(() => window.omniEdu.getDataRoot());
  assert.equal(dataRootAfterRestart, dataRoot);
  const knowledgeAfterRestart = await second.page.evaluate(() => window.omniEdu.getKnowledgeOverview());
  assert.equal(knowledgeAfterRestart.counts.resources, 1, 'knowledge resources should persist after restart');
  assert.ok(knowledgeAfterRestart.counts.chunks >= 1, 'knowledge chunks should persist after restart');
  await closeApp(second.app);

  console.log(JSON.stringify({
    ok: true,
    dataRoot,
    createdStudents: afterRestart.length,
    knowledgeResources: knowledgeImport.overview.counts.resources,
    knowledgeChunks: knowledgeImport.overview.counts.chunks,
    knowledgeNodes: knowledgeImport.overview.counts.nodes,
  }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    process.exit(process.exitCode ?? 0);
  });
