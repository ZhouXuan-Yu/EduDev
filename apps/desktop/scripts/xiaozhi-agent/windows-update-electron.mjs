import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {inc} from 'semver';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from '../acceptance/build-root.mjs';

const desktop = path.resolve(import.meta.dirname, '../..');
const main = testMain(desktop);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-windows-update-'));
const data = path.join(root, 'data'), profile = path.join(root, 'profile'), snapshots = path.join(root, 'snapshots');
const rollbackParent = path.join(root, 'rollbacks');
for (const directory of [data, profile, snapshots, rollbackParent]) fs.mkdirSync(directory);
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
  body:'',
};

const checks = [], rendererErrors = [];
let app, page, error;
async function useFixture({file = installer, body = release, status = 200, destination = snapshots, verifyRoot = '', rollbackRecord = '', normalDestination = ''} = {}) {
  await app.evaluate(({dialog,net},fixture) => {
    dialog.showOpenDialog = async options => {
      const picked = options.title.includes('更新前快照') ? fixture.destination
        : options.title.includes('完整数据目录备份位置') ? fixture.normalDestination
        : options.title.includes('完整性校验') ? fixture.verifyRoot
        : options.title === '选择小智更新记录' ? fixture.rollbackRecord
        : options.title === '选择独立恢复副本的保存位置' ? fixture.rollbackParent : fixture.file;
      return picked ? {canceled:false,filePaths:[picked]} : {canceled:true,filePaths:[]};
    };
    net.fetch = async (input, options) => {
      const url = String(input);
      globalThis.updateFixtureRequests.push(url);
      if (url !== 'https://api.github.com/repos/ZhouXuan-Yu/EduDev/releases/latest' ||
        options.redirect !== 'error' || options.credentials !== 'omit') throw Error('Unexpected fixture traffic');
      return new Response(JSON.stringify(fixture.body), {status:fixture.status,headers:{'content-type':'application/json'}});
    };
  }, {file,body,status,destination,verifyRoot,rollbackParent,rollbackRecord,normalDestination});
}

async function inspect(check) {
  await page.getByTestId('windows-update-inspect').click();
  await page.locator(`[data-testid="windows-update-candidate"][data-check="${check}"]`).waitFor({timeout:30000});
}

async function until(action,timeout=15000){
  const deadline=performance.now()+timeout;
  while(performance.now()<deadline){const result=await action();if(result)return result;await new Promise(resolve=>setTimeout(resolve,30));}
  assert.fail('Update did not reach its publication barrier in time');
}

try {
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/API_KEY|ACCESS_TOKEN|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL|OMNI_EDU_E2E/.test(key)) delete env[key];
  Object.assign(env,{OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'), OMNI_EDU_DATA_ROOT:data, OMNI_EDU_XIAOZHI_PI:'1'});
  app = await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page = await app.firstWindow();
  page.on('pageerror', value => rendererErrors.push(String(value)));
  await assertIsolatedPiMain(app,main,profile);
  const database = new DatabaseSync(path.join(data, 'app.db'), {readOnly:true});
  try {
    const {user_version:dataVersion} = database.prepare('PRAGMA user_version').get();
    release.body = `<!-- xiaozhi-update-v1\n${JSON.stringify({targetDataVersion:dataVersion,
      sources:[{appVersion:currentVersion,dataVersion}]})}\n-->`;
  } finally {database.close();}
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

  if(process.argv.includes('--self-wait-probe')){
    await page.getByTestId('windows-update-prepare').click();
    const blocked=page.getByTestId('windows-update-feedback').filter({hasText:'backup_publishers_busy'});
    await page.getByTestId('windows-update-snapshot').or(blocked).waitFor({timeout:30000});
    assert.equal(await blocked.count(),0,await blocked.first().textContent({timeout:100}).catch(()=>''));
    checks.push('A verified update candidate completes its snapshot without waiting for its own publisher.');
  } else {

  const controlParent=path.join(root,'snapshot-control');
  const normalDestination=path.join(root,'verification-export');
  for(const directory of [controlParent,normalDestination])fs.mkdirSync(directory);
  await app.evaluate((_,{requirePath,controlParent})=>{
    const module=process.getBuiltinModule('module'),fs=process.getBuiltinModule('fs/promises');
    const db=module.createRequire(requirePath)('sqlite3').Database.prototype;
    const run=db.run,rename=fs.rename;
    const gate=globalThis.updatePublication={events:[],pending:null,hold:true,fail:false};
    db.run=function(sql,params,callback){
      if(gate.hold && sql.includes('INSERT INTO students') && params.includes('R2 update publisher')){
        gate.events.push('publisher_waiting');
        gate.pending=()=>{gate.pending=null;return run.call(this,sql,params,callback);};
        return this;
      }
      return run.call(this,sql,params,callback);
    };
    fs.rename=async(from,to)=>{
      if(gate.fail && String(to).startsWith(controlParent) && String(from).includes('.xiaozhi-backup-partial-')){
        gate.events.push('rename_failed');
        throw Error('controlled update publication failure');
      }
      return rename(from,to);
    };
    gate.restore=()=>{db.run=run;fs.rename=rename;};
  },{requirePath:path.join(desktop,'package.json'),controlParent});
  const prepare=page.getByTestId('windows-update-prepare');
  const noteFeedback=page.getByTestId('windows-update-feedback');
  const barrierBusy=()=>page.evaluate(async()=>{
    try{await window.omniEdu.listStudents('R2 update publisher');return false;}
    catch(error){if(!String(error).includes('backup_busy'))throw error;return true;}
  });
  await useFixture({destination:controlParent,normalDestination});
  const publisher=page.evaluate(()=>window.omniEdu.createStudent({displayName:'R2 update publisher'}));
  await until(()=>app.evaluate(()=>Boolean(globalThis.updatePublication.pending)));
  await prepare.click();
  await until(barrierBusy);
  assert.deepEqual(fs.readdirSync(controlParent),[],'Action waits for the admitted native writer');
  await assert.rejects(page.evaluate(()=>window.omniEdu.createStudent({displayName:'R2 rejected publisher'})),/backup_busy/u);
  assert.deepEqual(await page.evaluate(()=>window.omniEdu.cancelDataBackup()),{cancelled:true});
  await noteFeedback.filter({hasText:/已取消/}).waitFor();
  await app.evaluate(()=>{globalThis.updatePublication.pending();});
  const [admitted]=await publisher;
  assert(admitted.id);
  assert.deepEqual(fs.readdirSync(controlParent),[]);
  assert.equal((await page.evaluate(()=>window.omniEdu.exportDataRoot('full'))).verified,true);
  checks.push('Existing native writes drain before the action; freezing rejects new writers, and cancel releases the settings job for another verified export.');

  await app.evaluate(()=>{globalThis.updatePublication.fail=true;});
  await prepare.click();
  await noteFeedback.filter({hasText:'controlled update publication failure'}).waitFor();
  assert.deepEqual(fs.readdirSync(controlParent),[]);
  assert.equal((await page.evaluate(()=>window.omniEdu.exportDataRoot('full'))).verified,true);
  assert.deepEqual(await app.evaluate(()=>globalThis.updatePublication.events),['publisher_waiting','rename_failed']);
  await app.evaluate(()=>{globalThis.updatePublication.fail=false;});
  checks.push('A failed snapshot publication cleans temporary files and releases the settings job for another verified export.');
  await useFixture();

  fs.writeFileSync(path.join(data,'合成备课.txt'),'升级前的备课记录');
  const draining=page.evaluate(()=>window.omniEdu.createStudent({displayName:'R2 update publisher'}));
  await until(()=>app.evaluate(()=>Boolean(globalThis.updatePublication.pending)));
  await page.getByTestId('windows-update-prepare').click();
  await until(barrierBusy);
  assert.deepEqual(fs.readdirSync(snapshots),[]);
  await app.evaluate(()=>{globalThis.updatePublication.pending();});
  const [drained]=await draining;
  const snapshotResult = page.getByTestId('windows-update-snapshot');
  const preparationError = page.getByTestId('windows-update-feedback').filter({hasText:'backup_publishers_busy'});
  await snapshotResult.or(preparationError).waitFor({timeout:30000});
  assert.equal(await preparationError.count(), 0, await preparationError.first().textContent({timeout:100}).catch(()=>'Update preparation'));
  const entries = fs.readdirSync(snapshots);
  assert.equal(entries.length,2);
  const backup = path.join(snapshots, entries.find(value => value.startsWith('OmniEduData-backup-')));
  const copied=new DatabaseSync(path.join(backup,'app.db'),{readOnly:true});
  try {assert.equal(copied.prepare('SELECT display_name FROM students WHERE id=?').get(drained.id).display_name,'R2 update publisher');}
  finally {copied.close();}
  await app.evaluate(()=>globalThis.updatePublication.restore());
  const recordPath = path.join(snapshots, entries.find(value => value.startsWith('Xiaozhi-update-')));
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
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

  const badRecord = path.join(snapshots,'mismatched-update.json');
  fs.writeFileSync(badRecord,JSON.stringify({...record,manifestSha256:'0'.repeat(64)}));
  await useFixture({rollbackRecord:badRecord});
  const rollbackButton = page.getByTestId('data-backup-update-rollback');
  await rollbackButton.click();
  await page.getByTestId('data-backup-error').filter({hasText:'当前备份与更新记录不匹配'}).waitFor({timeout:30000});
  assert.deepEqual(fs.readdirSync(rollbackParent),[]);
  checks.push('A record with the wrong snapshot digest fails before making a copy.');

  const note = '合成备课.txt';
  fs.writeFileSync(path.join(data,note),'升级后新增的内容');
  // Moving the snapshot and record together must not require its original absolute path.
  const relocated = path.join(root,'moved-update');
  fs.renameSync(snapshots,relocated);
  await useFixture({rollbackRecord:path.join(relocated,path.basename(recordPath))});
  const pendingFile = path.join(profile,'xiaozhi-pending-rollback.v1.json');
  const pendingPanel = page.getByTestId('data-backup-pending-rollback');
  async function scheduleRollback() {
    await rollbackButton.click();
    const info = page.getByTestId('data-backup-rollback-version');
    await info.filter({hasText:currentVersion}).filter({hasText:targetVersion}).waitFor({timeout:30000});
    await page.getByTestId('data-backup-restore-prepare').click();
    const activate = page.getByTestId('data-backup-restore-activate');
    await activate.filter({hasText:'安排旧版启动时启用'}).click({timeout:30000});
    await pendingPanel.filter({hasText:currentVersion}).waitFor({timeout:30000});
    const pending = JSON.parse(fs.readFileSync(pendingFile,'utf8'));
    assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), data);
    assert.equal(pending.previousRoot,data);
    assert.equal(pending.rollback.sourceVersion,currentVersion);
    assert.equal(fs.readFileSync(path.join(pending.dataRoot,note),'utf8'),'升级前的备课记录');
    return pending;
  }
  await page.setViewportSize({width:1366,height:768});
  const cancelled = await scheduleRollback();
  await pendingPanel.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root,'update-rollback-pending-1366.png')});
  await page.getByTestId('data-backup-cancel-rollback').click();
  await pendingPanel.waitFor({state:'hidden'});
  assert(!fs.existsSync(pendingFile));
  assert(fs.existsSync(path.join(cancelled.dataRoot,'app.db')));
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()),data);
  checks.push('The UI prepares a relocated snapshot, schedules it without switching, and cancels the handoff while preserving the recovery copy.');

  await page.setViewportSize({width:1920,height:1080});
  const pending = await scheduleRollback();
  await pendingPanel.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root,'update-rollback-pending.png')});
  await app.close();
  app = await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page = await app.firstWindow();
  page.on('pageerror',value => rendererErrors.push(String(value)));
  await assertIsolatedPiMain(app,main,profile);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()),pending.dataRoot);
  assert(!fs.existsSync(pendingFile));
  assert.equal(fs.readFileSync(path.join(data,note),'utf8'),'升级后新增的内容');
  assert.equal(fs.readFileSync(path.join(pending.dataRoot,note),'utf8'),'升级前的备课记录');
  assert.deepEqual(rendererErrors,[]);
  checks.push('On cold launch the matching real source build activates the scheduled copy and retains both sets of lesson notes.');

  await app.close();
  app = undefined;
  const startupData = path.join(root,'startup-damaged-data');
  const startupProfile = path.join(root,'startup-profile');
  const startupCopies = path.join(root,'startup-copies');
  for (const directory of [startupData,startupProfile,startupCopies]) fs.mkdirSync(directory);
  const damaged = path.join(startupData,'app.db');
  fs.writeFileSync(damaged,'synthetic upgrade failure: database cannot open');
  const damagedDigest = sha(fs.readFileSync(damaged));
  const startupSelection = path.join(startupProfile,'xiaozhi-data-selection.v1.json');
  const startupLog = path.join(root,'startup-dialogs.json');
  const fixtureMain = path.join(root,'startup-fixture.mjs');
  fs.writeFileSync(fixtureMain, `
    import {dialog} from 'electron';
    import {readFileSync, writeFileSync} from 'node:fs';
    import {pathToFileURL} from 'node:url';
    const fixture = JSON.parse(process.env.RECOVERY_TEST_DIALOGS);
    const events = [];
    const ready = new Promise(resolve => { globalThis.beginRecovery = resolve; });
    const report = event => {
      events.push(event);
      writeFileSync(fixture.log, JSON.stringify(events));
    };
    dialog.showOpenDialog = async options => {
      await ready;
      report({title: options.title});
      const file = options.properties.includes('openFile') ? fixture.record : fixture.destination;
      return {canceled: !file, filePaths: file ? [file] : []};
    };
    dialog.showMessageBox = async options => {
      report({type: options.type, message: options.message, detail: options.detail, buttons: options.buttons,
        cancelId: options.cancelId, defaultId: options.defaultId});
      if (options.type === 'warning' && fixture.changeManifest) {
        const manifest = readFileSync(fixture.changeManifest);
        writeFileSync(fixture.changeManifest, Buffer.concat([manifest, Buffer.from(' ')]));
      }
      return {response: options.type === 'warning' && fixture.confirm ? 1 : 0, checkboxChecked: false};
    };
    await import(pathToFileURL(fixture.main));
  `);
  const movedRecord = path.join(relocated, path.basename(recordPath));
  const movedManifest = path.join(relocated,path.basename(backup),'omni-edu-backup-manifest.v1.json');
  const startupEnv = {...env, OMNI_EDU_DATA_ROOT: startupData};
  async function launchRecovery({record = movedRecord, confirm = false, changeManifest = ''} = {}) {
    const dialogs = JSON.stringify({main, log:startupLog, record, destination:startupCopies, confirm, changeManifest});
    app = await electron.launch({args:[fixtureMain,'--user-data-dir='+startupProfile,'--xiaozhi-recover'],
      cwd:desktop,env:{...startupEnv,RECOVERY_TEST_DIALOGS:dialogs},timeout:60000});
    await assertIsolatedPiMain(app,main,startupProfile);
    const child = app.process();
    const finished = once(child,'exit',{signal:AbortSignal.timeout(30000)});
    const triggered = app.evaluate(() => {setTimeout(globalThis.beginRecovery,100);});
    const [[code]] = await Promise.all([finished,triggered]);
    assert.equal(code,0);
    app = undefined;
    assert.equal(sha(fs.readFileSync(damaged)),damagedDigest);
    return JSON.parse(fs.readFileSync(startupLog,'utf8'));
  }

  const cancelledStartup = await launchRecovery();
  const confirmation = cancelledStartup.find(event => event.type === 'warning');
  assert.equal(confirmation.defaultId,0);
  assert.deepEqual(confirmation.buttons,['取消','创建并启用副本']);
  assert(confirmation.detail.includes(currentVersion) || confirmation.message.includes(currentVersion));
  assert(confirmation.detail.includes(targetVersion) && confirmation.detail.includes('MiB'));
  assert.deepEqual(fs.readdirSync(startupCopies),[]);
  assert(!fs.existsSync(startupSelection));
  const malformed = await launchRecovery({record:path.join(relocated,path.basename(badRecord)),confirm:true});
  assert.match(malformed.at(-1).detail,/不匹配/);
  assert.deepEqual(fs.readdirSync(startupCopies),[]);
  assert(!fs.existsSync(startupSelection));
  checks.push('Startup recovery skips the unreadable working SQLite, defaults to cancel, and rejects a mismatched update record without writing a copy or selection.');

  const wrongVersionRecord = path.join(relocated,'wrong-startup-version.json');
  fs.writeFileSync(wrongVersionRecord,JSON.stringify({...record,currentVersion:'0.0.0',targetVersion:currentVersion,fileName:name(currentVersion)}));
  const newerProgram = await launchRecovery({record:wrongVersionRecord,confirm:true});
  assert.match(newerProgram.at(-1).detail,/需要小智 0\.0\.0/);
  const alreadyPending = path.join(startupProfile,'xiaozhi-pending-rollback.v1.json');
  const pendingBytes = JSON.stringify({...pending,baseRoot:startupData,previousRoot:startupData});
  fs.writeFileSync(alreadyPending,pendingBytes);
  try {
    const occupied = await launchRecovery({confirm:true});
    assert.match(occupied.at(-1).detail,/已有回退安排/);
    assert.equal(fs.readFileSync(alreadyPending,'utf8'),pendingBytes);
    assert.deepEqual(fs.readdirSync(startupCopies),[]);
    assert(!fs.existsSync(startupSelection));
  } finally {
    fs.unlinkSync(alreadyPending);
  }
  checks.push('Startup recovery rejects even the recorded newer program and retains an existing scheduled rollback without preparing a copy.');

  const manifestBytes = fs.readFileSync(movedManifest);
  try {
    const changed = await launchRecovery({confirm:true,changeManifest:movedManifest});
    assert.match(changed.at(-1).detail,/变化/);
    assert.deepEqual(fs.readdirSync(startupCopies),[]);
    assert(!fs.existsSync(startupSelection));
  } finally {
    fs.writeFileSync(movedManifest,manifestBytes);
  }
  checks.push('Startup recovery rechecks the snapshot after confirmation and refuses a changed manifest before selecting any data.');

  const recovered = await launchRecovery({confirm:true});
  assert.equal(recovered.at(-1).message,'恢复副本已启用');
  const startupPointer = JSON.parse(fs.readFileSync(startupSelection,'utf8'));
  assert.equal(startupPointer.activeAppVersion,currentVersion);
  assert.equal(startupPointer.previousAppVersion,targetVersion);
  assert.equal(startupPointer.previousRoot,startupData);
  assert.equal(fs.readFileSync(path.join(startupPointer.dataRoot,note),'utf8'),'升级前的备课记录');
  app = await electron.launch({args:[main,'--user-data-dir='+startupProfile],cwd:desktop,env:startupEnv,timeout:60000});
  page = await app.firstWindow();
  await assertIsolatedPiMain(app,main,startupProfile);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()),startupPointer.dataRoot);
  assert.equal(sha(fs.readFileSync(damaged)),damagedDigest);
  checks.push('The real startup entry creates and activates a verified copy without a readable upgraded database or pending rollback, then a normal launch reads it with the original bytes intact.');

  const shutdownData=path.join(root,'shutdown-data'),shutdownProfile=path.join(root,'shutdown-profile');
  const shutdownDestination=path.join(root,'shutdown-snapshots'),donePath=path.join(root,'shutdown-native-writer.txt');
  fs.mkdirSync(shutdownDestination);
  await app.close();
  const shutdownEnv={...env,OMNI_EDU_DATA_ROOT:shutdownData};
  app=await electron.launch({args:[main,'--user-data-dir='+shutdownProfile],cwd:desktop,env:shutdownEnv,timeout:60000});
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,shutdownProfile);
  await app.evaluate(()=>{globalThis.updateFixtureRequests=[];});
  await useFixture({destination:shutdownDestination,normalDestination});
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByTestId('pi-settings-tab-backup').click();
  await inspect('ready');
  await app.evaluate((_,{requirePath,donePath})=>{
    const db=process.getBuiltinModule('module').createRequire(requirePath)('sqlite3').Database.prototype;
    const raw=db.run,fs=process.getBuiltinModule('fs');
    db.run=function(sql,params,callback){
      if(sql.includes('INSERT INTO students') && params.includes('R2 shutdown publisher')){
        globalThis.releaseShutdownWriter=()=>raw.call(this,sql,params,error=>{
          fs.writeFileSync(donePath,error?String(error):'native write completed');
          callback(error);
        });
        return this;
      }
      return raw.call(this,sql,params,callback);
    };
  },{requirePath:path.join(desktop,'package.json'),donePath});
  const shutdownWriter=page.evaluate(()=>window.omniEdu.createStudent({displayName:'R2 shutdown publisher'})).catch(()=>undefined);
  await until(()=>app.evaluate(()=>Boolean(globalThis.releaseShutdownWriter)));
  await page.getByTestId('windows-update-prepare').click();
  await until(barrierBusy);
  const child=app.process();
  const stopped=once(child,'exit',{signal:AbortSignal.timeout(15000)});
  await app.evaluate(({app})=>{
    setTimeout(()=>app.quit(),20);
    setTimeout(()=>{globalThis.releaseShutdownWriter();},400);
  });
  assert.deepEqual(await stopped,[0,null]);
  await shutdownWriter;
  app=undefined;page=undefined;
  assert.equal(fs.readFileSync(donePath,'utf8'),'native write completed');
  assert.deepEqual(fs.readdirSync(shutdownDestination),[]);
  const closed=new DatabaseSync(path.join(shutdownData,'app.db'),{readOnly:true});
  try {assert(closed.prepare('SELECT id FROM students WHERE display_name=?').get('R2 shutdown publisher'));}
  finally {closed.close();}
  checks.push('Normal Electron shutdown cancels the waiting update snapshot, drains the admitted native writer and exits without a late snapshot.');
  }
} catch (failure) {
  error = failure.stack;
  process.exitCode = 1;
  if (page) await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>undefined);
} finally {
  await app?.evaluate(()=>{globalThis.updatePublication?.pending?.();}).catch(()=>undefined);
  await app?.close();
  const report={ok:!error,root,mainSha256:sha(fs.readFileSync(main)),fixtureSha256:digest,checks,rendererErrors,error};
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
