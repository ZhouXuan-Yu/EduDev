import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';

const desktop = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const installDirIndex = process.argv.indexOf('--install-dir');
const packageDirIndex = process.argv.indexOf('--package-dir');
assert((installDirIndex >= 0) !== (packageDirIndex >= 0), 'Specify exactly one of --install-dir or --package-dir');
const directoryIndex = installDirIndex >= 0 ? installDirIndex : packageDirIndex;
assert(process.argv[directoryIndex + 1] && !process.argv[directoryIndex + 1].startsWith('--'), 'Directory is required');
const installDir = path.resolve(process.argv[directoryIndex + 1]);
const mode = installDirIndex >= 0 ? 'installed' : 'unpacked';

const executable = path.join(installDir, '小智.exe');
if (!fs.existsSync(executable)) throw new Error(`packaged executable missing: ${executable}`);

const output = fs.mkdtempSync(path.join(desktop, 'test-results', 'xiaozhi-agent', 'pi-windows-installer-ui-'));
const profile = path.join(output, 'profile');
const data = path.join(output, 'data');
const checks = [];
const report = {
  schema: 1,
  success: false,
  mode,
  installDir,
  executable,
  output,
  checks,
  errors: [],
  boundary: [
    `Actual ${mode} executable and current electron-builder.cjs resources; unpacked does not prove NSIS installation`,
    'Isolated owned profile and data roots; no model request, file import or external upload',
    'This proves packaged startup, current Composer and a local worker, not curriculum quality, a clean VM or human acceptance',
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
  const env = {...process.env, PATH: '', OMNI_EDU_PYTHON: 'C:\\not-installed\\python.exe', OMNI_EDU_DATA_ROOT: data};
  for (const key of Object.keys(env)) {
    if (/API_KEY|AUTH_TOKEN|ACCESS_TOKEN/.test(key) || key.startsWith('OMNI_EDU_E2E_') ||
      ['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'NODE_OPTIONS'].includes(key)) delete env[key];
  }
  application = await electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${profile}`, '--force-device-scale-factor=1'],
    env,
    timeout: 60000,
  });
  appLog(application.process().stdout, 'main');
  appLog(application.process().stderr, 'main-error');
  await application.evaluate(({net}) => {
    globalThis.__packagedBlockedRequests = [];
    const blocked = async input => {
      globalThis.__packagedBlockedRequests.push(String(input?.url ?? input));
      throw new Error('Network disabled in packaged startup check');
    };
    net.fetch = blocked;
    globalThis.fetch = blocked;
  });
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
  check(`${mode} executable launches with app.isPackaged=true in the owned user-data profile`);

  const resources = [
    ['ocr', path.join(launch.resourcesPath, 'ocr-runtime', 'omni-edu-ocr.exe')],
    ['education', path.join(launch.resourcesPath, 'education-runtime', 'omni-edu-education.exe')],
    ['retrieval', path.join(launch.resourcesPath, 'retrieval-runtime', 'omni-edu-retrieval.exe')],
    ['reranker', path.join(launch.resourcesPath, 'reranker-runtime', 'omni-edu-reranker.exe')],
  ].map(([name, file]) => ({name, file, exists: fs.existsSync(file), bytes: fs.existsSync(file) ? fs.statSync(file).size : 0}));
  assert(resources.every(item => item.exists && item.bytes > 0));
  report.resources = resources;
  check('Current packaged resources contain all four frozen Windows runtimes');

  report.worker = await application.evaluate(async ({app}) => {
    const path = process.getBuiltinModule('node:path');
    const require = process.getBuiltinModule('node:module').createRequire(path.join(app.getAppPath(), 'package.json'));
    const {runEducationWorker} = require(path.join(app.getAppPath(), 'out/main/education-runtime.js'));
    const result = await runEducationWorker('reading', {text: '方程的解。', quote: '方程的解'},
      'xiaozhi.education.quote.v1', new AbortController().signal, 65536, 2048, value => value.found === true, value => value);
    return {found: result.found, schemaVersion: result.schemaVersion, path: process.env.PATH, interpreter: process.env.OMNI_EDU_PYTHON};
  });
  assert.equal(report.worker.found, true);
  assert.equal(report.worker.path ?? '', '');
  check('Packaged education host executes the frozen worker with empty PATH and no system Python');

  const bootstrap = await page.evaluate(() => window.omniEdu.bootstrap());
  assert.equal(fs.realpathSync(bootstrap.dataRoot).toLowerCase(), fs.realpathSync(data).toLowerCase());
  report.bootstrap = {
    dataRoot: bootstrap.dataRoot,
    students: bootstrap.students.length,
  };
  check('Packaged app uses the owned data root and does not manufacture demo students');

  await page.setViewportSize({width: 1366, height: 768});
  await page.emulateMedia({colorScheme: 'light', reducedMotion: 'reduce'});
  const draft = '先读取资料，整理一元一次方程讲义，确认后再保存。';
  await page.getByTestId('office-prompt-input').fill(draft);
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), draft);
  report.draft = draft;
  assert.equal(await page.locator('.office-turn').count(), 0, 'editing a draft must not create a turn');
  await page.screenshot({
    path: path.join(output, 'packaged-draft-light-1366x768.png'),
    fullPage: false,
  });
  check('Current packaged Composer accepts a teacher draft without sending or creating a turn');

  await page.setViewportSize({width: 1920, height: 1080});
  await page.emulateMedia({colorScheme: 'dark', reducedMotion: 'reduce'});
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(output, 'packaged-draft-dark-1920x1080.png'),
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
  check('Packaged workspace captures reachable light and dark teacher views at the two desktop sizes');

  report.blockedRequests = await application.evaluate(() => globalThis.__packagedBlockedRequests);
  assert.deepEqual(report.blockedRequests, []);
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
