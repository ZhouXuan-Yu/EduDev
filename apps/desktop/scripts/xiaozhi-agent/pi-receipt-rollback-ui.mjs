import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const source=fs.realpathSync(process.env.OMNI_EDU_TEST_RECEIPT_SOURCE||''),owned=fs.realpathSync('test-results');
assert(source.startsWith(owned+path.sep));
const accepted=JSON.parse(fs.readFileSync(path.join(source,'report.json')));assert.equal(accepted.success,true);
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-receipt-rollback-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const sourceBefore=fingerprint(path.join(source,'data'));fs.cpSync(path.join(source,'data'),data,{recursive:true});
const current=fs.realpathSync(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),rollback=fs.realpathSync(process.env.OMNI_EDU_TEST_ROLLBACK_BUILD||'test-results/goal/harness-h03a-20261014/build-retry-fence');
assert(rollback.startsWith(owned+path.sep));
const builds=[current,rollback].map(root=>({root,...fingerprint(root)}));
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const report={success:false,checks:[],source:{root:source,sha256:sourceBefore.sha256},builds:builds.map(b=>({root:b.root,sha256:b.sha256,files:b.files.length})),scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),layer:'C: actual formal Electron B -> previous accepted H03-A journal reader -> B, owned database copy',humanAccepted:false,boundary:'Additive rollback keeps journal/receipt tables and reads existing effects only. Older reader lacks the new receipt UI; no new actions while rolled back. Not a daily database rollback, power loss or H02 reader compatibility for new journal-only processes.'};
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
let app,page;const errors=[];
const read=sql=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const facts=()=>({receipts:read('SELECT * FROM xiaozhi_tool_receipts ORDER BY run_id,call_id'),bindings:read('SELECT * FROM xiaozhi_native_run_bindings ORDER BY run_id'),journal:read('SELECT run_id,sequence,event_hash FROM xiaozhi_event_journal ORDER BY run_id,sequence')});
const slim=turns=>turns.map(({recovery,...turn})=>turn);
async function launch(root){
 process.env.OMNI_EDU_TEST_BUILD_ROOT=root;const main=testMain(process.cwd());
 const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.evaluate(id=>localStorage.setItem('xiaozhi.current-session.v1',id),accepted.sessionId);await page.reload();await page.getByTestId('xiaozhi-pi-workspace').waitFor();
 await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===id,accepted.sessionId);
 await page.getByTestId('office-prompt-input').waitFor();
 (report.launches??=[]).push(await assertIsolatedPiMain(app,main,profile));
 return page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),accepted.sessionId);
}
async function close(){await app.close();app=undefined;page=undefined;}
try{
 assert.equal(read("SELECT count(*) n FROM xiaozhi_event_runs WHERE status='running'")[0].n,0);
 const before=facts(),native=fingerprint(path.join(data,'xiaozhi-pi')),effects=fingerprint(path.join(source,'workspace'));
 const initial=await launch(current);assert(initial.projection.turns.some(t=>t.recovery?.receipts.some(r=>r.effect==='matched')));assert.deepEqual(facts(),before);check('Current formal build reads recovered receipts in the actual copied profile; no receipt/journal mutation');
 await page.screenshot({path:path.join(output,'current-before-rollback.png'),animations:'disabled'});await close();
 const previous=await launch(rollback);assert.deepEqual(slim(previous.projection.turns),slim(initial.projection.turns));assert.deepEqual(facts(),before);assert.equal(fingerprint(path.join(data,'xiaozhi-pi')).sha256,native.sha256);assert.equal(fingerprint(path.join(source,'workspace')).sha256,effects.sha256);check('Actual previous accepted H03-A build opens the additive database and exact saved public process without replaying effects or deleting receipts');
 await page.screenshot({path:path.join(output,'actual-rollback-reader.png'),animations:'disabled'});await close();
 const restored=await launch(current);assert.deepEqual(restored.projection.turns,initial.projection.turns);assert.deepEqual(facts(),before);assert.equal(fingerprint(path.join(data,'xiaozhi-pi')).sha256,native.sha256);assert.equal(fingerprint(path.join(source,'workspace')).sha256,effects.sha256);check('Re-upgrade restores exact receipt UI and public projection with original native bytes, facts and file effects');
 await page.screenshot({path:path.join(output,'reupgrade-receipts.png'),animations:'disabled'});
 const notice=page.locator(`[data-testid="office-recovery"][data-run-id="${accepted.runs[0]}"]`),summary=notice.getByText('查看操作结果',{exact:true});await summary.click();
 const colors=[];for(const view of[{width:1366,height:768,theme:'light'},{width:1920,height:1080,theme:'dark'}]){await page.emulateMedia({colorScheme:view.theme});await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),view);await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,view);await summary.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const box=await summary.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=view.width&&box.y+box.height<=view.height);colors.push(await notice.evaluate(el=>getComputedStyle(el).color));await page.screenshot({path:path.join(output,`receipt-${view.width}-${view.theme}.png`),animations:'disabled'});}assert.notEqual(colors[0],colors[1],'Actual theme colors must change, not only screenshot labels');report.visualColors=colors;
 check('Recovery details control is reachable in actual 1366x768 light and 1920x1080 dark layouts; screenshots retained for visual inspection');await close();
 assert.equal(fingerprint(path.join(source,'data')).sha256,sourceBefore.sha256);for(const b of builds)assert.equal(fingerprint(b.root).sha256,b.sha256);assert.deepEqual(errors,[]);report.success=true;check('Owned source database and both fixed builds unchanged; no renderer errors across three actual launches');
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,4500);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
