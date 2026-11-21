import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inc} from 'semver';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const desktop = path.resolve(import.meta.dirname, '../..');
const main = testMain(desktop);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-windows-update-'));
const data = path.join(root, 'data'), profile = path.join(root, 'profile'), snapshots = path.join(root, 'snapshots');
for (const directory of [data, profile, snapshots]) fs.mkdirSync(directory);
const currentVersion = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8')).version;
const targetVersion = inc(currentVersion, 'patch');
assert(targetVersion);
const name = version => `Xiaozhi-Setup-${version}-x64.exe`;
const installer = path.join(root, name(targetVersion));
const unsigned = path.join(root, 'unsigned', name(targetVersion));
fs.mkdirSync(path.dirname(unsigned));
fs.writeFileSync(unsigned, 'harmless unsigned fixture');
// Windows catalog signature is checked by the original Authenticode adapter.
// This owned copy is never executed. Only the public release response is synthetic.
fs.copyFileSync(path.join(process.env.SystemRoot || 'C:\\Windows','System32','whoami.exe'), installer);
const original = fs.readFileSync(installer);
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = sha(original);
const release = {
  tag_name:'v'+targetVersion, draft:false, prerelease:false, assets:[{
    name:name(targetVersion), state:'uploaded', digest:'sha256:'+digest, size:original.length,
  }],
  body:`<!-- xiaozhi-update-v1\n${JSON.stringify({targetDataVersion:0,sources:[{appVersion:currentVersion,dataVersion:0}]})}\n-->`,
};

const checks = [], rendererErrors = [];
let app, page, error;
async function useFixture({file = installer, body = release, status = 200, destination = snapshots, verifyRoot = ''} = {}) {
  await app.evaluate(({dialog,net},fixture) => {
    dialog.showOpenDialog = async options => {
      const picked = options.title.includes('更新前快照') ? fixture.destination
        : options.title.includes('完整性校验') ? fixture.verifyRoot : fixture.file;
      return picked ? {canceled:false,filePaths:[picked]} : {canceled:true,filePaths:[]};
    };
    net.fetch = async (input, options) => {
      const url = String(input);
      globalThis.updateFixtureRequests.push(url);
      if (url !== 'https://api.github.com/repos/ZhouXuan-Yu/EduDev/releases/latest' ||
        options.redirect !== 'error' || options.credentials !== 'omit') throw Error('Unexpected fixture traffic');
      return new Response(JSON.stringify(fixture.body), {status:fixture.status,headers:{'content-type':'application/json'}});
    };
  }, {file,body,status,destination,verifyRoot});
}

async function inspect(check) {
  await page.getByTestId('windows-update-inspect').click();
  await page.locator(`[data-testid="windows-update-candidate"][data-check="${check}"]`).waitFor({timeout:30000});
}

try {
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/API_KEY|ACCESS_TOKEN|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL|OMNI_EDU_E2E/.test(key)) delete env[key];
  Object.assign(env,{OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'), OMNI_EDU_DATA_ROOT:data, OMNI_EDU_XIAOZHI_PI:'1'});
  app = await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page = await app.firstWindow();
  page.on('pageerror', value => rendererErrors.push(String(value)));
  await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(() => { globalThis.updateFixtureRequests = []; });
  await useFixture({file:''});
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByTestId('pi-settings-tab-backup').click();
  await page.getByTestId('windows-update-panel').waitFor();
  await page.getByTestId('windows-update-inspect').click();
  await page.getByTestId('windows-update-feedback').filter({hasText:'已取消选择安装包。'}).waitFor();
  assert.deepEqual(fs.readdirSync(snapshots), []);
  checks.push('Selecting and cancelling writes no snapshot and makes no release request.');

  await useFixture({file:path.join(root,name(currentVersion))});
  await inspect('same_or_older');
  await useFixture({file:unsigned});
  await inspect('signature_invalid');
  assert.equal(await page.getByTestId('windows-update-prepare').count(),0);
  assert.equal(await app.evaluate(() => globalThis.updateFixtureRequests.length),0);
  checks.push('Version and actual Windows Authenticode rejection block preparation before querying GitHub.');

  await useFixture({status:503});
  await inspect('release_unavailable');
  await useFixture({body:{...release,body:''}});
  await inspect('incompatible');
  await useFixture({body:{...release,assets:[{...release.assets[0], digest:'sha256:'+'0'.repeat(64)}]}});
  await inspect('package_mismatch');
  assert.deepEqual(fs.readdirSync(snapshots), []);
  checks.push('Unavailable release, missing source data compatibility and different release digest each block preparation.');

  await useFixture();
  await inspect('ready');
  for (const size of [{width:1366,height:768},{width:1920,height:1080}]) {
    await page.setViewportSize(size);
    const button=page.getByTestId('windows-update-prepare');
    await button.scrollIntoViewIfNeeded();
    const box=await button.boundingBox();
    assert(box && box.x>=0 && box.x+box.width<=size.width && box.y>=0 && box.y+box.height<=size.height);
    await page.screenshot({path:path.join(root,`update-ready-${size.width}.png`)});
  }
  fs.appendFileSync(installer,'changed for fixture');
  await page.getByTestId('windows-update-prepare').click();
  await page.getByTestId('windows-update-feedback').filter({hasText:/安装包内容已更改/}).waitFor();
  assert.deepEqual(fs.readdirSync(snapshots), []);
  fs.writeFileSync(installer, original);
  checks.push('Changing the inspected installer before creating the snapshot prevents any copy.');

  fs.writeFileSync(path.join(data,'合成备课.txt'),'升级前的备课记录');
  await page.getByTestId('windows-update-prepare').click();
  await page.getByTestId('windows-update-snapshot').waitFor({timeout:30000});
  const entries = fs.readdirSync(snapshots);
  assert.equal(entries.length,2);
  const backup = path.join(snapshots, entries.find(value => value.startsWith('OmniEduData-backup-')));
  const record = JSON.parse(fs.readFileSync(path.join(snapshots, entries.find(value => value.startsWith('Xiaozhi-update-'))), 'utf8'));
  assert.equal(record.sha256,digest);
  assert.equal(record.snapshotPath,backup);
  assert.equal(record.targetVersion,targetVersion);
  assert.equal(record.currentVersion,currentVersion);
  assert.equal(record.manifestSha256,sha(fs.readFileSync(path.join(backup,'omni-edu-backup-manifest.v1.json'))));
  assert.equal(fs.readFileSync(path.join(backup,'合成备课.txt'),'utf8'),'升级前的备课记录');
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()),data);
  await useFixture({verifyRoot:backup});
  const readback = await page.evaluate(() => window.omniEdu.verifyDataBackup());
  assert.equal(readback.verified,true);
  assert.equal(readback.compatibility.sourceAppVersion,currentVersion);
  assert.equal(await app.evaluate(() => globalThis.updateFixtureRequests.length),4);
  assert.deepEqual(rendererErrors,[]);
  checks.push('A signature-valid SHA-matching candidate with a compatible synthetic release creates a real verified backup and adjacent update receipt, preserving the active workspace.');
} catch (failure) {
  error = failure.stack;
  process.exitCode = 1;
  if (page) await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>undefined);
} finally {
  await app?.close();
  const report={ok:!error,root,mainSha256:sha(fs.readFileSync(main)),fixtureSha256:digest,checks,rendererErrors,error};
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
