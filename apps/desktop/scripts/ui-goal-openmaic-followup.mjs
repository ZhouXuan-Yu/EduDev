/** Supplementary evidence for an ALREADY FAILED reference run.
 * --run never generates a course or invokes AI grading. success always stays false.
 * Existing owner access is required; 401/404 stops rather than claiming/rewriting ownership.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {getJson,readRun,screenshots,selectors} from './acceptance/openmaic-live-ui.mjs';
import {publicDocument,sha256} from './acceptance/openmaic-public-content.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=path.join(desktop,'test-results/ui-goal-20261101/openmaic-live/run-BhNFAC');
const original=JSON.parse(fs.readFileSync(path.join(baseline,'report.json'),'utf8'));
const saved=JSON.parse(fs.readFileSync(path.join(baseline,'course-public.json'),'utf8'));
assert.equal(original.success,false,'Follow-up is only supplementary evidence for a failed run');
assert(/^run-[A-Za-z0-9_-]+$/.test(original.runId),'Existing run ID missing');
const stageIds=[...new Set((original.api||[]).flatMap(e=>{
 const match=/^\/api\/stages\/([^/]+)\/(?:manifest|scenes)$/.exec(e.path);return match?[match[1]]:[];
}))];
assert(stageIds.length===1,'Cannot uniquely identify existing stage from public API ledger');
const stageId=stageIds[0],runId=original.runId;
assert.equal(runId,'run-vNU8VcMTxnvHgY1Q','Only original BhNFAC run is authorized');
assert.equal(stageId,'stage--W1UazzJr3r6','Only original BhNFAC stage is authorized');
const persistedPublic=document=>JSON.parse(JSON.stringify(publicDocument(document)));
const origin=new URL(process.env.UI_OPENMAIC_URL||'http://127.0.0.1:3013');
assert(['127.0.0.1','localhost','[::1]'].includes(origin.hostname)&&!origin.username&&!origin.password,'Local parent-owned reference only');
const quizSummary=saved.scenes.filter(s=>s.type==='quiz').map(s=>({sceneId:s.id,expectedQuestionCount:1,actualQuestionCount:s.questions.length,
 questions:s.questions.map(q=>({id:q.id,type:q.type,points:q.points,question:q.question}))}));
if(process.argv.includes('--check'))console.log(JSON.stringify({prepared:true,runId,stageId,originalSuccess:false,quizSummary,
 ownerAccess:'Use current authorized CDP context or explicit UI_OPENMAIC_OWNER_STATE; otherwise fresh-context GET must independently succeed. Never manufacture owner credentials.',
 command:'node scripts/ui-goal-openmaic-followup.mjs --run',noBrowserOrModelCalls:true},null,2));
else if(process.argv.includes('--run'))await main();
else console.log('Prepared only; --check is offline. Parent runs --run with existing owner access. Overall result remains FAIL.');

async function main(){
 const output=fs.mkdtempSync(path.join(baseline,'followup-'));
 const report={success:false,overallSuccess:false,supplementaryEvidenceComplete:false,humanAccepted:false,output,runId,stageId,quizSummary,
  originalFailure:original.failure,originalReportSha256:sha256(fs.readFileSync(path.join(baseline,'report.json'))),checks:[],screenshots:[],
  consoleErrors:[],pageErrors:[],blockedRequests:[],api:[],boundary:'Public educational content only. Original instruction failure is immutable. Only UI quiz attempt persistence is writable; no course/model/config/ownership writes.'};
 const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2));
 const check=name=>{report.checks.push({name,pass:true});console.log('EVIDENCE '+name);};
 let browser,context,page,attached=false;
 const start=Date.now();const timer=setTimeout(()=>void page?.close().catch(()=>{}),180000);
 try{
  if(process.env.UI_OPENMAIC_CDP_URL){
   const endpoint=new URL(process.env.UI_OPENMAIC_CDP_URL);
   assert(['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname),'Only parent-owned local CDP');
   browser=await chromium.connectOverCDP(endpoint.href);attached=true;
   context=browser.contexts().find(c=>c.pages().some(p=>{try{return new URL(p.url()).origin===origin.origin;}catch{return false;}}));
   assert(context,'No existing reference context; do not pick another app profile');
   report.ownerChannel='Existing parent-owned reference CDP context, credentials not exported';
  }else{
   browser=await chromium.launch({headless:true});
   context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN',colorScheme:'light',
    ...(process.env.UI_OPENMAIC_OWNER_STATE?{storageState:path.resolve(process.env.UI_OPENMAIC_OWNER_STATE)}:{})});
   report.ownerChannel=process.env.UI_OPENMAIC_OWNER_STATE?'Explicit parent-provided private owner state, not copied/exported':'Fresh context; existing owner GET must succeed or stop';
  }
  page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({type:'console.error'});});
  page.on('pageerror',()=>report.pageErrors.push({type:'pageerror'}));
  // A page-only firewall leaves other parent CDP pages untouched. No model/agent
  // command is allowed, even if the reference UI accidentally tries one.
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),method=request.method();
   if(url.origin!==origin.origin){if(/^https?:$/.test(url.protocol)){report.blockedRequests.push({kind:'external',method});return route.abort();}return route.continue();}
   const api=url.pathname.startsWith('/api/'),write=!['GET','HEAD','OPTIONS'].includes(method);
   const quizPersistence=url.pathname.startsWith(`/api/persistence/runtime/stages/${encodeURIComponent(stageId)}/`);
   if(api&&write&&!quizPersistence){report.blockedRequests.push({path:url.pathname,method});return route.abort();}
   return route.continue();
  });
  if(typeof page.routeWebSocket==='function')await page.routeWebSocket('**/*',socket=>socket.close());
  page.on('response',response=>{
   const url=new URL(response.url());if(url.origin===origin.origin&&url.pathname.startsWith('/api/'))report.api.push({
    path:url.pathname.startsWith('/api/persistence/runtime/')?'/api/persistence/runtime/[owned-stage]/…':url.pathname,
    status:response.status(),method:response.request().method()});
  });
  // Establish ordinary reference identity, without emitting a generation command.
  await page.goto(origin.origin,{waitUntil:'domcontentloaded'});
  const access=await page.request.get(new URL(`/api/generation-runs/${runId}`,origin).href);
  report.ownerAccessStatus=access.status();assert(access.ok(),'Existing run is inaccessible to this owner; no recovery/bypass attempted');
  const run=(await access.json()).run;
  assert.equal(run.id,runId);assert.equal(run.state,'completed');assert.equal(run.stageId,stageId);
  const document=await getJson(page,`/api/stages/${stageId}`),content=persistedPublic(document);
  assert.deepEqual(content,saved,'Existing public content changed since failed acceptance; do not attribute it to the original run');
  save('existing-course-public.json',content);check('Original completed run and unchanged public course verified in current owner scope');
  await page.goto(new URL(`/classroom/${stageId}`,origin).href,{waitUntil:'domcontentloaded'});
  const items=page.getByTestId('scene-item');await items.nth(2).waitFor();assert.equal(await items.count(),document.scenes.length);
  assert.deepEqual(document.scenes.map(s=>s.type),['slide','slide','quiz'],'Existing scene structure changed');
  for(let index=0;index<document.scenes.length;index++)if(document.scenes[index].type==='slide'){
   await items.nth(index).click();const elements=page.locator('[id^="screen-element-"]:visible');await elements.first().waitFor();
   const ids=document.scenes[index].content.canvas.elements.filter(e=>e.type==='text').map(e=>e.id);
   await page.waitForFunction(values=>values.some(id=>document.getElementById('screen-element-'+id)),ids);
   const region=elements.first().locator('xpath=ancestor::div[contains(@style,"position: relative") and contains(@style,"width: 100%") and contains(@style,"height: 100%")][1]');
   const legacy=elements.first().locator('xpath=ancestor::div[contains(@class,"select-none")][1]');
   const visible=await elements.allInnerTexts();assert(visible.join('').trim(),'Existing slide preview text is empty');
   save(`slide-${index+1}-visible.json`,{title:document.scenes[index].title,text:visible});
   await screenshots(page,await region.count()?region:legacy,`existing-slide-${index+1}`,output,report);
  }
  check('Both existing slides actually previewed; public text and two-size screenshots retained');
  const quizIndex=document.scenes.findIndex(s=>s.type==='quiz');assert(quizIndex>=0);
  const questions=document.scenes[quizIndex].content.questions;
  // This is a paid-call safety gate, NOT a relaxation of the original count gate.
  assert(questions.length>0&&questions.every(q=>q.type==='single'&&q.options?.length>=2&&Array.isArray(q.answer)&&q.answer.length===1),'Non-choice or invalid single-choice question present; no model-graded submission permitted');
  await items.nth(quizIndex).click();
  const feedback=page.getByText(selectors.report,{exact:true});
  if(!await feedback.isVisible()){
   await page.getByRole('button',{name:selectors.startQuiz}).click();report.answers=[];
   for(const q of questions){
    const card=page.getByText(q.question,{exact:true}).locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," rounded-2xl ") and contains(concat(" ",normalize-space(@class)," ")," border ")][1]');
    const selected=q.options[0].value,pattern=new RegExp('^'+selected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
    const option=card.getByRole('button').filter({has:page.locator('span').filter({hasText:pattern})});
    assert.equal(await option.count(),1,'Existing quiz option selector ambiguous');await option.click();
    report.answers.push({id:q.id,selected,points:q.points??1,expectedCorrect:q.answer.some(a=>a===selected||q.options.filter(o=>o.label===a).length===1&&q.options.find(o=>o.label===a).value===selected)});
   }
   await page.getByRole('button',{name:selectors.submit}).click();report.quizAction='Actually selected one option for every existing question, including zero-point placeholder, and submitted via UI';
  }else report.quizAction='Existing saved feedback already visible; not reset or resubmitted';
  await feedback.waitFor();
  const region=feedback.locator('xpath=ancestor::div[contains(@class,"flex-1") and contains(@class,"flex-col")][1]');
  const feedbackText=await region.innerText();assert(/正确|错误|correct|incorrect/i.test(feedbackText),'No actual grading feedback');
  for(const q of questions)assert(feedbackText.includes(q.question),'Feedback omitted an existing question');
  if(report.answers){const correct=report.answers.filter(a=>a.expectedCorrect).length,incorrect=questions.length-correct;
   assert(new RegExp(correct+'\\s*(?:正确|correct)','i').test(feedbackText));assert(new RegExp(incorrect+'\\s*(?:错误|incorrect)','i').test(feedbackText));}
  save('quiz-feedback-public.json',{expectedQuestionCount:1,actualQuestionCount:questions.length,answers:report.answers,feedbackText});
  await screenshots(page,region,'existing-quiz-feedback',output,report);check('Actual multi-question feedback captured without ignoring the instruction-violating placeholder');
  const before=sha256(JSON.stringify(content));await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('scene-item').nth(quizIndex).click();
  await feedback.waitFor();const restoredText=await region.innerText();
  for(const q of questions)assert(restoredText.includes(q.question),'Refreshed saved feedback omitted a question');
  assert.equal(sha256(JSON.stringify(persistedPublic(await getJson(page,`/api/stages/${stageId}`)))),before);
  const restoredRun=await readRun(page,runId);assert.equal(restoredRun.state,'completed');assert.equal(restoredRun.stageId,stageId);
  save('refresh-readback-public.json',{contentSha256:before,expectedQuestionCount:1,actualQuestionCount:questions.length,feedbackText:restoredText});
  await screenshots(page,region,'existing-refreshed-feedback',output,report);check('Refresh restores unchanged course and saved public quiz feedback');
  report.supplementaryEvidenceComplete=true;
 }catch(error){report.followupFailure=error?.code==='ERR_ASSERTION'?String(error.message).split('\n')[0].slice(0,300):'Follow-up UI operation failed; no model replay or ownership bypass attempted';}
 finally{
  clearTimeout(timer);report.elapsedMs=Date.now()-start;save('followup-report.json',report);
  await page?.close().catch(()=>{});if(!attached)await browser?.close().catch(()=>{});
  process.exitCode=1; // Original reference acceptance remains FAIL, including when all supplementary evidence is collected.
  console.log(JSON.stringify({overallSuccess:false,supplementaryEvidenceComplete:report.supplementaryEvidenceComplete,output,failure:report.followupFailure}));
 }
}
