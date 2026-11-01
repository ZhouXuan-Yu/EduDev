/** PREPARED paired reference run. --run invokes real OpenMAIC providers; parent owns execution.
 * Source: runtime20261101/openmaic-outline-review.cjs + current OpenMAIC UI/run APIs.
 * No Electron launch/build, direct command API, SQL writes, storage seeding, HAR or body dumps.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {fixtureSha256,sha256,visiblePdfText,requirement,publicSettings,assertLocalOnlySettings,assertScenes} from './acceptance/openmaic-public-content.mjs';
import {getJson,reviewAndConfirm,waitForScenes,previewAndAnswer} from './acceptance/openmaic-live-ui.mjs';
import {configureLocalPdf} from './acceptance/openmaic-local-extractor.mjs';

const runtime='D:/WorkProject/小智智能体借鉴项目/_ui-review-runtime/20261101';
const source=process.env.UI_OPENMAIC_SOURCE||'D:/WorkProject/小智智能体借鉴项目/OpenMAIC';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=path.resolve(process.env.UI_PAIRED_PDF||process.env.UI_CLASSROOM_PDF||path.join(runtime,'buoyancy-review.pdf'));
const origin=new URL(process.env.UI_OPENMAIC_URL||'http://127.0.0.1:3013');
assert(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Use parent-owned local OpenMAIC deployment only');
assert(!origin.username&&!origin.password,'Credentials must not be embedded in URL');
const contracts={
 'components/generation/generation-toolbar.tsx':['course-material-button','course-material-chip','data-status={material.status}'],
 'app/generation-preview/page.tsx':['handleExpandStreamingOutline','holdOutline(view)','<OutlinesEditor'],
 'components/stage/scene-sidebar.tsx':['data-testid="scene-item"'],
 'components/slide-renderer/element-dom.ts':["'screen-element-'"],
 'components/scene-renderers/quiz-view.tsx':["t('quiz.startQuiz')","t('quiz.submitAnswers')",'persistQuizSubmission'],
};
function sourceProof(){return Object.fromEntries(Object.entries(contracts).map(([name,markers])=>{
 const bytes=fs.readFileSync(path.join(source,name));assert(markers.every(m=>bytes.toString('utf8').includes(m)),`Unsupported researched source: ${name}`);return[name,sha256(bytes)];
}));}
function fixtureProof(){const bytes=fs.readFileSync(fixture);assert.equal(sha256(bytes),fixtureSha256,'Paired PDF must be byte-identical');return{name:path.basename(fixture),bytes:bytes.length,sha256:fixtureSha256};}
if(process.argv.includes('--check')){
 console.log(JSON.stringify({prepared:true,fixture:fixtureProof(),sourceFiles:sourceProof(),run:'node scripts/ui-goal-openmaic-live.mjs --run',boundary:'No browser/network/model calls performed. Live selectors and provider configuration remain unverified.'},null,2));
}else if(process.argv.includes('--run'))await main();
else console.log('Prepared only. Parent explicitly executes with --run after starting the reference server; --check is offline.');

async function main(){
 const outputArg=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
 const base=path.join(desktop,'test-results/ui-goal-20261101/openmaic-live');fs.mkdirSync(base,{recursive:true});
 const output=outputArg?path.resolve(outputArg):fs.mkdtempSync(path.join(base,'run-'));fs.mkdirSync(output,{recursive:true});
 const report={app:'OpenMAIC',success:false,humanAccepted:false,output,checks:[],screenshots:[],consoleErrors:[],pageErrors:[],api:[],
  task:requirement,fixture:null,sourceFiles:{},inputChannel:null,paidRequestsStarted:false,
  comparison:{edudevModel:process.env.UI_EDUDEV_MODEL||'deepseek-flash (classroom-live script default; actual paired run must be checked)',
   differences:['OpenMAIC browser/server owner scope versus isolated EduDev Electron/Pi runtime','PDF composer upload versus EduDev saved-library reference; bytes must match','Reference UI confirmation triggers its own server generation pipeline; no quality equivalence inferred from completion']},
  boundary:'Only public educational content is exported. No native reasoning, raw events, tool arguments, credentials, full response bodies or storage dumps. Browser UI acceptance is not human teaching-quality acceptance.'};
 const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2));
 const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
 const start=Date.now(),budget=Math.min(900000,Math.max(60000,Number(process.env.UI_OPENMAIC_TIMEOUT_MS)||600000));
 let browser,context,page,restoreExtractor;
 const until=async(fn,label)=>{while(Date.now()-start<budget){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,200));}throw Error('TIMEOUT: '+label);};
 const watchdog=setTimeout(()=>{report.timeout=true;void context?.close().catch(()=>{});},budget);
 try{
  report.fixture=fixtureProof();report.sourceFiles=sourceProof();
  report.researchScriptSha256=sha256(fs.readFileSync(path.join(runtime,'openmaic-outline-review.cjs')));
  report.scriptSha256=sha256(fs.readFileSync(fileURLToPath(import.meta.url)));
  report.helperSha256=Object.fromEntries(['openmaic-live-ui.mjs','openmaic-public-content.mjs','openmaic-local-extractor.mjs'].map(f=>[f,sha256(fs.readFileSync(path.join(desktop,'scripts/acceptance',f)))]));
  browser=await chromium.launch({headless:process.env.UI_OPENMAIC_HEADED!=='1'});
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN',colorScheme:'light'});
  page=await context.newPage();page.setDefaultTimeout(20000);
  // No error messages or payloads: providers may put sensitive request text in them.
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({at:Date.now()-start,type:'console.error'});});
  page.on('pageerror',()=>report.pageErrors.push({at:Date.now()-start,type:'pageerror'}));
  page.on('response',r=>{const u=new URL(r.url());if(u.origin===origin.origin&&u.pathname.startsWith('/api/'))report.api.push({path:u.pathname,status:r.status(),method:r.request().method(),at:Date.now()-start});});
  await page.goto(origin.origin,{waitUntil:'domcontentloaded',timeout:60000});
  const textarea=page.locator('[data-pro-morph="composer"]:visible textarea');await textarea.waitFor();
  report.settings=publicSettings(await getJson(page,'/api/model-config'));
  if(process.env.UI_OPENMAIC_CONFIGURE_LOCAL_PDF==='1'){
   const configured=await configureLocalPdf({page,settings:report.settings,until,report});
   report.settings=configured.settings;restoreExtractor=configured.restore;
  }
  assertLocalOnlySettings(report.settings);
  check('Actual provider slots recorded without secrets; no web/media/cloud-document capabilities enabled');
  const interactive=page.getByRole('button',{name:/^(深度交互|Interactive Mode)$/i});
  assert.equal(await interactive.count(),1,'Real interactive-mode toggle missing; cannot establish no-simulation mode');
  if(await interactive.getAttribute('aria-pressed')==='true')await interactive.click();
  assert.equal(await interactive.getAttribute('aria-pressed'),'false');
  const material=page.getByTestId('course-material-button');
  if(await material.count()){
   await material.click();
   // Accept is supplied by the real document provider, not the ZIP/PPT import entry.
   const pdfInput=page.locator('input[type="file"]');
   const candidates=await pdfInput.evaluateAll(nodes=>nodes.map((node,index)=>({index,accept:node.accept})));
   const candidate=candidates.find(c=>/pdf/i.test(c.accept));assert(candidate,'PDF material input missing despite documented upload entry');
   await pdfInput.nth(candidate.index).setInputFiles(fixture);
   const chip=page.getByTestId('course-material-chip').filter({hasText:path.basename(fixture)});await chip.waitFor();
   await until(async()=>{const status=await chip.getAttribute('data-status');assert.notEqual(status,'failed','Real PDF extraction failed; no inline fallback after upload failure');return status==='ready';},'real PDF upload and local extraction');
   report.inputChannel='same-file bytes via real PDF material upload';
   report.materialStatus='ready';await page.keyboard.press('Escape');
  }else{
   assert.equal(process.env.UI_OPENMAIC_ALLOW_TEXT_CHANNEL,'1','No real attachment entry. Parent must explicitly allow accurate visible PDF text channel; not same-file parity');
   report.inputChannel='same information, different channel: exact visible PDF text, NOT same-file upload';
  }
  const prompt=report.materialStatus==='ready'?requirement:requirement+'\n\n以下为该合成PDF准确可见正文（文字输入，非附件上传）：\n'+visiblePdfText;
  await textarea.fill(prompt);report.promptSha256=sha256(prompt);
  const enter=page.getByRole('button',{name:/^(进入课堂|Enter Classroom)$/i});
  await until(async()=>await enter.isEnabled(),'ready classroom entry');
  report.paidRequestsStarted=true;await enter.click();
  const {id}=await reviewAndConfirm({page,until,output,report,save,check});
  const {run,document,content}=await waitForScenes(page,id,until);
  save('course-public.json',content);assertScenes(document);
  assert.equal(run.input.interactive,false,'Interactive mode enabled unexpectedly');
  if(report.materialStatus==='ready')assert.equal(run.input.materialIds.length,1,'Run did not use exactly the uploaded PDF');
  report.stageId=run.stageId;report.effectiveTaskEngine=run.input.taskEngine;report.materialKinds=run.materialKinds;
  assert(!Object.values(run.media||{}).length,'Unexpected media generation records');
  const finalSettings=publicSettings(await getJson(page,'/api/model-config'));
  assert.deepEqual(finalSettings,report.settings,'Provider settings changed during run; cannot attribute paired result to a stable configuration');
  check('Server completes exactly two real slides and one single-choice quiz without media');
  await previewAndAnswer({page,run,document,output,report,save,check});
  assert.equal(report.pageErrors.length,0,'Browser page errors recorded');
  assert.equal(report.consoleErrors.length,0,'Browser console errors recorded');
  check('No browser console/page errors');report.success=true;
 }catch(error){
  // Assertion text is authored in this script; avoid serializing Playwright DOM call logs.
  report.failure=error?.code==='ERR_ASSERTION'?String(error.message).split('\n')[0].slice(0,320):'Live operation failed; inspect safe API status ledger and last completed check';
  process.exitCode=1;
 }finally{
  clearTimeout(watchdog);
  if(restoreExtractor&&page&&!page.isClosed())try{await restoreExtractor();}catch{
   report.success=false;report.cleanupFailure='Owned document slot UI restoration did not complete; inspect localExtractorSetup. No DB/API reset attempted.';process.exitCode=1;
  }
  report.elapsedMs=Date.now()-start;save('report.json',report);
  await browser?.close().catch(()=>{});console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));
 }
}
