/** PREPARE ONLY: parent runs after the unified production build. No API key required.
 * node scripts/ui-goal-students-live.mjs
 * Optional: OMNI_EDU_TEST_BUILD_ROOT (owned out/test-results build via acceptance helper).
 * All fixture writes are actual visible UI actions. SQLite is opened read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {productEntry} from './product-navigation.mjs';
import {fingerprint} from './acceptance/evidence.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const selectors = {
  home: 'nav-student-workbench', empty: 'student-workbench-empty', create: 'student-create',
  row: 'student-row-{sqlite-id}', form: 'student-profile-form', name: 'student-form-display-name',
  grade: 'student-form-grade', save: 'student-form-save', edit: 'student-edit',
  readback: 'student-profile-readback', tabs: 'student-page-navigation', route: 'hub-entry-{route}',
  search: 'global-search-workspace', searchInput: 'global-search-input', searchSubmit: 'global-search-submit',
  recordForm: 'learning-record-form', mistakes: 'mistakes-student-state',
  training: 'student-training-workspace', trainingEmpty: 'student-training-empty',
  review: 'review-report-workspace', reviewEmpty: 'review-report-history-empty',
  navigationNotice: 'desktop-navigation-notice',
};
const routes = ['students','search','intake','mistakes','mastery','review','analytics'];
const fixture = {
  A: {name:'U5合成学生甲_仅本地验收', grade:'八年级', draft:'U5合成学生甲_未保存草稿'},
  B: {name:'U5合成学生乙_仅本地验收', grade:'九年级'},
};
const hash = value => createHash('sha256').update(value).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const args=process.argv.slice(2);
  assert(args.length===0||(args.length===1&&args[0].startsWith('--pins=')),'Use optional --pins=<owned current pins>');
  const pinsFile=args.length?fs.realpathSync(path.resolve(desktop,args[0].slice(7))):undefined;
  if(pinsFile)assert(pinsFile.startsWith(fs.realpathSync(path.join(desktop,'test-results'))+path.sep),'Owned pins required');
  const pins=pinsFile?JSON.parse(fs.readFileSync(pinsFile,'utf8')):undefined;
  if(pins)process.env.OMNI_EDU_TEST_BUILD_ROOT=pins.buildRoot;
  const mainFile = testMain(desktop); // Refuse absent/unowned build; never builds implicitly.
  const verify=()=>{if(pins){assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(path.dirname(path.dirname(mainFile))).sha256,pins.build);}};
  verify();
  const base = path.join(desktop, 'test-results', 'ui-goal-20261101', 'students-live');
  fs.mkdirSync(base, {recursive:true});
  const output = fs.mkdtempSync(path.join(base, 'run-'));
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'edudev-u5-students-'));
  const data = path.join(isolated,'data'), profile = path.join(isolated,'profile');
  fs.mkdirSync(data); fs.mkdirSync(profile);
  const env = {...process.env};
  for (const key of Object.keys(env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') ||
      ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
  }
  Object.assign(env, {NODE_ENV:'development', OMNI_EDU_DATA_ROOT:data,
    OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'), OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'',DEEPSEEK_MODEL:''}); // Existing switch also prevents .env.local loading.
  const report = {
    suite:'U5-real-student-UI', success:false, preparedOnly:false,pins,networkAttempts:[],
    buildMainSha256:hash(fs.readFileSync(mainFile)), scriptSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    selectors, checks:[], routes:[], screens:[], errors:[], consoleErrors:[],
    fixtures:'Two clearly labelled synthetic local profiles, created via UI; no learning facts seeded',
    boundaries:['No model request, model key or .env.local loading', 'SQL readback only; no INSERT/UPDATE/DELETE in test',
      'Global search and teacher overview retain their original global semantics',
      'Fresh process may safely show selection empty state; automatic selection of A as restored B is a failure',
      'Screenshots and isolated fixture database retained locally; not teacher/model quality acceptance'],
    isolatedRoots:{tempDirectoryBasename:path.basename(isolated),data:'data',profile:'profile'},
    nativeGuardBoundary:'Real installed Electron settings menu callback -> desktop:command IPC -> renderer guard. Not an OS Ctrl+, keystroke acceptance.',
    humanAccepted:false,
  };
  let app, page, stage='bootstrap', ids={};
  const tidy = value => String(value).replace(/sk-[A-Za-z0-9_-]+/g,'[credential]')
    .replace(/Bearer\s+\S+/gi,'Bearer [credential]').replaceAll(isolated,'[isolated]')
    .replaceAll(desktop,'[desktop]').replace(/[A-Za-z]:[\\/][^\s"<>]+/g,'[local path]').slice(0,1200);
  const flush = () => fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const tid = id => page.getByTestId(id);
  const content = () => tid('product-space-content');
  const tab = route => content().locator('[data-testid="student-page-navigation"]:visible').getByTestId(`hub-entry-${route}`);
  async function openRoute(route) {
    if(await tid('student-workbench-layout').isVisible()) {
      assert.equal(await tid('student-workbench-empty').isVisible(),false,'Select a real student before entering student tools');
      if(route==='search'||route==='intake')await tid('student-context-tab-records').click();
      if(route==='students'){
        await tid('student-context-tab-profile').click();
        if(await tid('student-profile-more').getAttribute('aria-expanded')!=='true')await tid('student-profile-more').click();
      }
    }
    const entry=route==='students'||route==='search'||route==='intake'
      ? content().getByTestId(`hub-entry-${route}`):tab(route);
    assert.equal(await entry.count(),1,'One original student route entry '+route);
    assert.equal(await entry.isVisible(),true,'Original student route is reachable '+route);
    await entry.click();
  }
  const check = (name, detail={}) => {report.checks.push({name,pass:true,...detail});flush();};
  function sql(query, params=[]) {
    const db = new DatabaseSync(path.join(data,'app.db'), {readOnly:true});
    try {return db.prepare(query).all(...params);} finally {db.close();}
  }
  async function until(fn, label, timeout=20000) {
    const end=Date.now()+timeout;
    while(Date.now()<end) {if(await fn())return;await pause(100);}
    throw new Error('Timed out: '+label);
  }
  async function screen(label, failed=false) {
    if (!page || page.isClosed()) return;
    const name=`${String(report.screens.length+1).padStart(2,'0')}-${label.replace(/[^a-z0-9-]/gi,'-')}${failed?'-failure':''}.png`;
    try {
      const viewport=await page.evaluate(()=>({cssWidth:innerWidth,cssHeight:innerHeight,dpr:devicePixelRatio,visualViewport:visualViewport?{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}:null}));
      const native=await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];return{contentBoundsDIP:win.getContentBounds(),zoomFactor:win.webContents.getZoomFactor()};});
      const png=await page.screenshot({path:path.join(output,name),fullPage:false,scale:'device',timeout:10000});
      report.screens.push({stage:label,file:name,failed,viewport,native,png:{width:png.readUInt32BE(16),height:png.readUInt32BE(20),scale:'device',resized:false}});
    }
    catch(error) {report.errors.push({stage:'capture',message:tidy(error)});}
    flush();
  }
  async function step(name, work) {
    stage=name;
    try {await work();check(name);} catch(error) {
      report.errors.push({stage:name,message:tidy(error)});await screen(name,true);flush();throw error;
    }
  }
  async function launch() {
    verify();
    const bootstrap=zeroNetworkBootstrap({output,main:mainFile,profile,counter:'__studentHttp'});
    app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:60000});
    page=await app.firstWindow();page.setDefaultTimeout(20000);
    page.on('pageerror',error=>report.consoleErrors.push({type:'pageerror',message:tidy(error.message)}));
    page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({type:'console',message:tidy(message.text())});});
    // JS dialogs must be explicitly handled by the relevant step. No blanket auto-accept.
    await tid('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});
    await assertIsolatedPiMain(app,mainFile,profile);
    const actual=await page.evaluate(()=>window.omniEdu.getDataRoot());
    assert.equal(path.resolve(actual),path.resolve(data),'App must use this test data root');
    await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.setContentSize(1366,768);win.webContents.setBackgroundThrottling(false);});
  }
  async function close() {
    const value=app;app=undefined;
    try{const attempts=await value.evaluate(()=>globalThis.__studentHttp);assert(Array.isArray(attempts));report.networkAttempts.push(...attempts);assert.deepEqual(attempts,[],'Zero network during real student operations');}
    finally{await value.close();}
  }
  async function home() {await productEntry(page,'students').click();await tid('student-workbench-layout').waitFor();}
  async function profileFor(name) {
    await tid('student-profile-readback').waitFor();
    await until(async()=> (await tid('student-profile-readback').innerText()).includes(name),'profile UI readback');
  }
  async function select(alias) {await tid('student-row-'+ids[alias]).click();await profileFor(fixture[alias].name);}
  async function create(alias) {
    await tid('student-create').click();await tid('student-profile-form').waitFor();
    await tid('student-form-display-name').fill(fixture[alias].name);
    await tid('student-form-grade').fill(fixture[alias].grade);
    await tid('student-form-save').click();
    await until(()=>sql('SELECT id FROM students WHERE display_name=?',[fixture[alias].name]).length===1,'UI-created SQLite row');
    const rows=sql('SELECT id,grade FROM students WHERE display_name=?',[fixture[alias].name]);
    ids[alias]=rows[0].id;assert.equal(rows[0].grade,fixture[alias].grade);
    await profileFor(fixture[alias].name);
    assert.equal(await tid('student-profile-form').count(),0,'Save must close form');
  }
  async function noLearningFacts() {
    for(const table of ['learning_records','review_reports','ai_agent_runs']) {
      assert.equal(Number(sql(`SELECT count(*) AS n FROM ${table}`)[0].n),0,table+' must remain empty');
    }
    assert.equal(Number(sql('SELECT count(*) AS n FROM students')[0].n),2,'Exactly two synthetic profiles');
  }
  async function assertBContext(route) {
    if(route==='students') await profileFor(fixture.B.name);
    if(route==='intake') {
      await tid('learning-record-form').waitFor();
      const focus=content().locator('.student-focus');
      assert((await focus.innerText()).includes(fixture.B.name),'Intake binds B');
      assert(!(await focus.innerText()).includes(fixture.A.name),'Intake does not bind A');
    }
    if(route==='mistakes') {
      await tid('mistakes-student-state').waitFor();
      assert((await tid('mistakes-student-state').innerText()).includes(fixture.B.name),'Mistakes bind B');
    }
    if(route==='mastery') {
      await tid('student-training-empty').waitFor();
      assert((await tid('student-training-workspace').innerText()).includes(fixture.B.name),'Plan binds B');
      assert.equal(await tid('student-training-version').count(),0,'No invented plan');
    }
    if(route==='review') {
      await tid('review-report-history-empty').waitFor();
      assert((await tid('review-report-workspace').innerText()).includes(fixture.B.name),'Review binds B');
      assert.equal(await tid('review-report-meta').count(),0,'No invented review');
    }
    if(route==='search') {
      await tid('global-search-workspace').waitFor();
      await tid('global-search-input').fill(fixture.B.name);
      await tid('global-search-submit').click();
      await tid('global-search-student-'+ids.B).waitFor();
      assert.equal(await tid('global-search-student-'+ids.A).count(),0,'B query excludes A');
    }
    if(route==='analytics') {
      // This is a teacher-level aggregate, not an invented student-scoped analytics tab.
      await content().getByText('教师工作台概览',{exact:true}).waitFor();
      const text=await content().innerText();
      assert(!/(?:掌握率|正确率|诊断结果)\s*[:：]?\s*\d+(?:\.\d+)?\s*%/.test(text),'No invented mastery/accuracy statistic');
      assert.equal(await content().locator('[data-testid^="timeline-record-"]').count(),0);
    }
    await noLearningFacts();
  }
  try {
    await step('fresh-empty-state',async()=>{
      await launch();await home();await tid('student-workbench-empty').waitFor();
      assert.equal(Number(sql('SELECT count(*) AS n FROM students')[0].n),0,'Fresh real SQLite has no profiles');
      assert.equal(await tid('student-create').isVisible(),true);
      assert.equal(await tid('student-profile-readback').count(),0,'Empty state exposes no stale student profile');
      await screen(stage);
    });
    await step('create-two-profiles-by-ui',async()=>{await create('A');await create('B');await noLearningFacts();await screen(stage);});
    await step('cancel-switch-retains-A-draft',async()=>{
      await home();await select('A');await tid('student-edit').click();
      await tid('student-form-display-name').fill(fixture.A.draft);
      const dialogPromise=page.waitForEvent('dialog',{timeout:10000});
      const click=tid('student-row-'+ids.B).click();
      const dialog=await dialogPromise;assert.equal(dialog.type(),'confirm');await dialog.dismiss();await click;
      assert.equal(await tid('student-form-display-name').inputValue(),fixture.A.draft,'Cancel retains draft');
      await profileFor(fixture.A.name);
      assert.equal(sql('SELECT display_name FROM students WHERE id=?',[ids.A])[0].display_name,fixture.A.name,'Draft not persisted');
      assert.equal(sql('SELECT display_name FROM students WHERE id=?',[ids.B])[0].display_name,fixture.B.name,'B untouched');
      await screen(stage);
    });
    await step('main-navigation-blocked-by-student-draft',async()=>{
      await productEntry(page,'teaching').click();
      await tid('desktop-navigation-notice').waitFor();
      assert.match(await tid('desktop-navigation-notice').innerText(),/学生档案尚未保存/);
      assert.equal(await tid('student-form-display-name').inputValue(),fixture.A.draft,'Main navigation retains A draft');
      await profileFor(fixture.A.name);
      assert.equal(await tid('workbench-hub-teaching').count(),0,'Teaching route not committed');
      assert.equal(sql('SELECT display_name FROM students WHERE id=?',[ids.A])[0].display_name,fixture.A.name,'Blocked navigation does not save draft');
      await screen(stage);
    });
    await step('production-settings-menu-IPC-blocked-by-student-draft',async()=>{
      // Observe only the real typed IPC delivery. Never dispatch an internal DOM/custom event.
      await page.evaluate(()=>{
        globalThis.__u5ObservedSettingsCommands=0;
        globalThis.__u5StopObservingSettings=window.omniEdu.onDesktopCommand(command=>{if(command==='settings')globalThis.__u5ObservedSettingsCommands++;});
      });
      try {
        const command=await app.evaluate(({Menu,BrowserWindow})=>{
          const menu=Menu.getApplicationMenu(),item=menu?.getMenuItemById('settings');
          if(!item||!item.enabled||typeof item.click!=='function')throw new Error('Actual production settings menu item unavailable');
          const metadata={id:item.id,accelerator:item.accelerator,entry:'installed production Electron menu callback',transport:'desktop:command IPC',nativeKeystroke:false};
          item.click(item,BrowserWindow.getAllWindows()[0],{triggeredByAccelerator:false});
          return metadata;
        });
        assert.equal(command.accelerator,'CmdOrCtrl+,','Actual registered shortcut maps to settings menu command');
        await until(()=>page.evaluate(()=>globalThis.__u5ObservedSettingsCommands===1),'actual production settings IPC arrival');
        assert.match(await tid('desktop-navigation-notice').innerText(),/学生档案尚未保存/);
        assert.equal(await tid('pi-settings-workspace').count(),0,'Native settings IPC cannot commit settings route while dirty');
        assert.equal(await tid('student-form-display-name').inputValue(),fixture.A.draft,'Production IPC preserves A draft');
        await profileFor(fixture.A.name);
        report.nativeGuard=command;
        await screen(stage);
      } finally {
        await page.evaluate(()=>{globalThis.__u5StopObservingSettings?.();delete globalThis.__u5StopObservingSettings;delete globalThis.__u5ObservedSettingsCommands;});
      }
    });
    await step('save-A-then-switch-B',async()=>{
      await tid('student-form-save').click();
      await until(()=>sql('SELECT display_name FROM students WHERE id=?',[ids.A])[0]?.display_name===fixture.A.draft,'Saved A SQLite readback');
      await tid('student-profile-form').waitFor({state:'detached'});
      await select('B');assert.equal(await tid('pi-settings-workspace').count(),0,'Blocked native command must not replay after save');await screen(stage);
    });
    for(const route of routes) await step('route-'+route+'-roundtrip-B',async()=>{
      await openRoute(route);await assertBContext(route);await screen(stage);
      report.routes.push({route,context:['search','analytics'].includes(route)?'original global view; B retained on return':'B-specific UI',pass:true});
      await openRoute('students');await profileFor(fixture.B.name);
      assert(!(await tid('student-profile-readback').innerText()).includes(fixture.A.draft),'No A profile in B detail');
    });
    await step('same-process-return-home-context',async()=>{
      await home();await profileFor(fixture.B.name);await noLearningFacts();await screen(stage);
    });
    await step('restart-safe-context',async()=>{
      await close();await launch();await home();
      await until(async()=>await tid('student-workbench-empty').isVisible()||await tid('student-profile-readback').isVisible(),'safe restored state');
      if(await tid('student-profile-readback').isVisible()) {
        await profileFor(fixture.B.name);report.restart='B safely restored';
      } else report.restart='Explicit selection required; no stale profile exposed';
      await select('B');await noLearningFacts();
      assert.equal(sql('SELECT display_name FROM students WHERE id=?',[ids.A])[0].display_name,fixture.A.draft);
      await screen(stage);
      await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));await screen('final-1920');
    });
    assert.equal(report.consoleErrors.filter(item=>item.type==='pageerror').length,0,'No renderer uncaught errors');
    report.success=true;
  } catch(error) {
    if(!report.errors.some(item=>item.stage===stage)){report.errors.push({stage,message:tidy(error)});await screen(stage,true);}
    process.exitCode=1;
  } finally {
    if(app)try{await close();}catch(error){report.errors.push({stage:'close',message:tidy(error)});report.success=false;process.exitCode=1;}
    try{verify();}catch(error){report.errors.push({stage:'pins',message:tidy(error)});report.success=false;process.exitCode=1;}
    flush();console.log(JSON.stringify({suite:report.suite,success:report.success,passed:report.checks.length,report:path.join(output,'report.json')}));
  }
}
await main().catch(error=>{console.error(String(error.message).replace(/sk-[A-Za-z0-9_-]+/g,'[credential]'));process.exitCode=1;});
