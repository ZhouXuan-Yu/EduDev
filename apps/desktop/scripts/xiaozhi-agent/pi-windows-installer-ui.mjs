import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';

const desktop = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const installDirIndex = process.argv.indexOf('--install-dir');
const installDir = installDirIndex >= 0
  ? path.resolve(process.argv[installDirIndex + 1])
  : null;
if (!installDir) throw new Error('--install-dir is required');

const executable = path.join(installDir, '小智.exe');
if (!fs.existsSync(executable)) throw new Error(`installed executable missing: ${executable}`);

const output = fs.mkdtempSync(path.join(desktop, 'test-results', 'xiaozhi-agent', 'pi-windows-installer-ui-'));
const profile = path.join(output, 'profile');
const data = path.join(output, 'data');
const checks = [];
const report = {
  schema: 1,
  success: false,
  installDir,
  executable,
  output,
  checks,
  errors: [],
  boundary: [
    'Actual installed Electron executable and packaged resources, not the development out directory',
    'Isolated owned profile and data roots; no model request, file import or external upload',
    'This proves installation startup and teacher quick-start reachability, not curriculum quality, VPN-off or human acceptance',
  ],
};

const check = (name) => {
  checks.push({name, pass: true});
  console.log(`PASS ${name}`);
};

const appLog = (stream, prefix) => stream?.on('data', chunk => {
  fs.appendFileSync(path.join(output, `${prefix}.log`), chunk);
});

let application;
let page;
try {
  application = await electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${profile}`, '--force-device-scale-factor=1'],
    env: {
      ...process.env,
      DEEPSEEK_API_KEY: '',
      OMNI_EDU_DATA_ROOT: data,
    },
    timeout: 60000,
  });
  appLog(application.process().stdout, 'main');
  appLog(application.process().stderr, 'main-error');
  page = await application.firstWindow();
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(message.text());
  });

  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state: 'visible', timeout: 60000});
  await page.waitForFunction(() => Boolean(window.omniEdu));
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);

  const launch = await application.evaluate(({app}) => ({
    isPackaged: app.isPackaged,
    executablePath: process.execPath,
    userData: app.getPath('userData'),
    sessionData: app.getPath('sessionData'),
    resourcesPath: process.resourcesPath,
  }));
  report.launch = launch;
  assert.equal(launch.isPackaged, true, 'installed app must report app.isPackaged=true');
  assert.equal(fs.realpathSync(launch.executablePath).toLowerCase(), fs.realpathSync(executable).toLowerCase());
  assert.equal(fs.realpathSync(launch.userData).toLowerCase(), fs.realpathSync(profile).toLowerCase());
  assert.equal(fs.realpathSync(launch.sessionData).toLowerCase(), fs.realpathSync(profile).toLowerCase());
  check('Installed executable launches with app.isPackaged=true in the owned user-data profile');

  const resources = [
    ['python', path.join(launch.resourcesPath, 'python-embed', 'python.exe')],
    ['ocr', path.join(launch.resourcesPath, 'ocr-runtime', 'omni-edu-ocr.exe')],
    ['readingWorker', path.join(launch.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'reading-worker.py')],
    ['mathWorker', path.join(launch.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'math-worker.py')],
  ].map(([name, file]) => ({name, file, exists: fs.existsSync(file), bytes: fs.existsSync(file) ? fs.statSync(file).size : 0}));
  assert(resources.every(item => item.exists && item.bytes > 0));
  report.resources = resources;
  check('Installed resources contain bundled Python, OCR and unpacked education workers');

  const bootstrap = await page.evaluate(() => window.omniEdu.bootstrap());
  assert.equal(fs.realpathSync(bootstrap.dataRoot).toLowerCase(), fs.realpathSync(data).toLowerCase());
  report.bootstrap = {
    dataRoot: bootstrap.dataRoot,
    students: bootstrap.students.length,
  };
  check('Installed app uses the owned data root and does not manufacture demo students');

  const quickStarts = page.locator('[data-testid^="teacher-quick-start-"]');
  await page.getByTestId('teacher-quick-starts').waitFor({state: 'visible'});
  assert.equal(await quickStarts.count(), 3);
  assert.deepEqual(await quickStarts.locator('strong').allInnerTexts(), [
    '根据资料备课',
    '讲清一道错题',
    '做一份课堂课件',
  ]);
  report.quickStarts = await quickStarts.locator('strong').allInnerTexts();
  check('Installed teacher workspace exposes only the three reviewed high-frequency starts');

  await page.setViewportSize({width: 1366, height: 768});
  await page.emulateMedia({colorScheme: 'light', reducedMotion: 'reduce'});
  await page.getByTestId('teacher-quick-start-materials').click();
  const prompt = await page.getByTestId('office-prompt-input').inputValue();
  assert(prompt.includes('先读取资料'));
  assert(prompt.includes('确认后再保存'));
  report.quickStartDraft = prompt;
  assert.equal(await page.locator('.office-turn').count(), 0, 'quick start must not send a message');
  await page.screenshot({
    path: path.join(output, 'installed-quick-start-light-1366x768.png'),
    fullPage: false,
  });
  check('Quick start seeds the existing teacher draft without sending or creating a turn');

  await page.setViewportSize({width: 1920, height: 1080});
  await page.emulateMedia({colorScheme: 'dark', reducedMotion: 'reduce'});
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(output, 'installed-quick-start-dark-1920x1080.png'),
    fullPage: false,
  });
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  report.layout = layout;
  assert(layout.width >= 1920 && layout.height >= 1080);
  assert(layout.scrollWidth <= layout.clientWidth + 1, 'installed workspace must not overflow horizontally');
  check('Installed workspace captures reachable light and dark teacher views at the two desktop sizes');

  assert.deepEqual(report.errors, []);
  report.success = true;
} catch (error) {
  report.error = String(error instanceof Error ? error.stack : error);
  throw error;
} finally {
  if (application) await application.close().catch(() => undefined);
  report.profileExistsAfterClose = fs.existsSync(profile);
  report.dataExistsAfterClose = fs.existsSync(data);
  fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({success: report.success, checks: checks.length, output}));
}
