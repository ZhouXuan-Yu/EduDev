import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
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

async function run() {
  const first = await launchApp();
  const bootstrap = await first.page.evaluate(() => window.omniEdu.bootstrap());
  assert.equal(typeof bootstrap.dataRoot, 'string');
  assert.ok(bootstrap.students.length >= 1, 'seed student should exist');

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
  await first.app.close();

  const second = await launchApp();
  const afterRestart = await second.page.evaluate(() => window.omniEdu.listStudents('验证学生'));
  assert.equal(afterRestart.length, 30, '30 students should persist after restart');
  const dataRootAfterRestart = await second.page.evaluate(() => window.omniEdu.getDataRoot());
  assert.equal(dataRootAfterRestart, dataRoot);
  await second.app.close();

  console.log(JSON.stringify({
    ok: true,
    dataRoot,
    createdStudents: afterRestart.length,
  }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(dataRoot, { recursive: true, force: true });
  });
