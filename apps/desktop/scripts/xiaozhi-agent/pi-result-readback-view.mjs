import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

// Read already-produced synthetic results through the actual renderer. Never
// supplies a tool result or changes a criterion to make the presentation pass.
const desktop=process.cwd(),source=fs.realpathSync(process.argv[2]);
assert(source.startsWith(fs.realpathSync('test-results/xiaozhi-agent')+path.sep));
const previous=JSON.parse(fs.readFileSync(path.join(source,'report.json')));assert(previous.success);
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT),fixed=fingerprint(buildRoot);assert.equal(fixed.sha256,previous.build.sha256);
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-readback-view-')),data=path.join(source,'data'),profile=path.join(source,'profile');
const report={success:false,checks:[],source,build:{root:buildRoot,sha256:fixed.sha256},layer:'C: cold formal renderer on owned synthetic results',humanAccepted:false};
const query=sql=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const nativeBefore=query('SELECT session_file FROM xiaozhi_pi_session_bindings').map(r=>({file:path.join(data,'xiaozhi-pi',r.session_file),bytes:fs.readFileSync(path.join(data,'xiaozhi-pi',r.session_file))}));
const metadataBefore=query('SELECT id,role,metadata_json FROM ai_conversation_messages');
const cfg=fs.readFileSync('.env.local','utf8'),key=cfg.match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
let app,page;const errors=[];const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const main=testMain(desktop);app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
 report.launch=await assertIsolatedPiMain(app,main,profile);
 const id=await page.locator('.office-composer-container').getAttribute('data-session-id'),snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);assert(!snapshot.running);
 const turns=snapshot.projection.turns.filter(t=>t.verification?.checks.some(c=>/^(web|file|attachment|image|saved_text|saved_office):/.test(c.id)&&c.state==='passed'));assert(turns.length,'No actual passed integrity scope');report.turns=turns.map(t=>({runId:t.id,verification:t.verification}));
 for(const turn of turns){
  const row=metadataBefore.filter(r=>r.role==='assistant').map(r=>JSON.parse(r.metadata_json||'{}')).find(m=>m.agentRunId===turn.id);assert.deepEqual(turn.verification,row.verification);
  assert.notEqual(turn.verification.state,'verified');const notice=page.locator(`.office-turn[data-turn-id="${turn.id}"] [data-testid="office-verification"]`);
  assert.equal(await notice.getByTestId('office-verification-time').locator('time').getAttribute('datetime'),turn.verification.checkedAt);
  await notice.getByTestId('office-verification-checks').locator('summary').click();const body=await notice.innerText();assert(body.includes('回复内容与图片识别结果是否符合你的要求'));assert(body.includes('需要你核对'));
  for(const c of turn.verification.checks){const item=notice.locator(`[data-check-id="${c.id}"]`);assert.equal(await item.getAttribute('data-state'),c.state);}
  for(const [theme,width,height]of[['light',1366,768],['dark',1920,1080]]){
   await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await app.evaluate(({BrowserWindow},s)=>{BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height);return true;},{width,height});
   await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await notice.locator('li').last().evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
   const box=await notice.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   const pane=await page.getByTestId('office-conversation').boundingBox(),last=await notice.locator('li').last().boundingBox();assert(pane&&last&&last.y>=pane.y&&last.y+last.height<=pane.y+pane.height+1,'Last review scope must be reachable inside the actual reading pane');
   const file=`${turn.id}-${theme}-${width}.png`;await page.screenshot({path:path.join(output,file),animations:'disabled'});
  }
  check('Actual cold '+turn.id+' shows saved integrity scope and separate answer-review check at both viewports');
 }
 assert.deepEqual(query('SELECT id,role,metadata_json FROM ai_conversation_messages'),metadataBefore);for(const r of nativeBefore)assert(fs.readFileSync(r.file).equals(r.bytes));
 assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);assert.deepEqual(errors,[]);check('No native/assistant metadata rewrite, action replay, renderer error or frozen-build change');report.success=true;
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,3000);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});report.scriptSha256=sha256(fs.readFileSync(new URL(import.meta.url)));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
