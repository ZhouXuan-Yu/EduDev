/** Source-backed UI operations; no mocked API, storage mutation or direct command POST. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {publicOutline,publicDocument,assertOutline,assertScenes,sha256} from './openmaic-public-content.mjs';

export const selectors={
 review:/tap to review|点击审阅|點擊審閱/i,
 outlineTitle:/scene outline|场景大纲|場景大綱/i,
 confirm:/confirm and generate course|确认并生成课程|確認並生成課程/i,
 startQuiz:/^(开始答题|Start Quiz)$/i,
 submit:/^(提交答案|Submit Answers)$/i,
 report:/^(答题报告|Quiz Report)$/i,
};
export async function getJson(page,route){
 assert(/^\/api\/(model-config|generation-runs\/[^/?]+|stages\/[^/?]+)$/.test(route),'Read-only API not allowlisted');
 const response=await page.request.get(new URL(route,page.url()).href,{timeout:15000});
 assert(response.ok(),`Read-only ${route.split('/')[2]} HTTP ${response.status()}`);
 return response.json();
}
export const readRun=async(page,id)=>(await getJson(page,`/api/generation-runs/${encodeURIComponent(id)}`)).run;
export async function screenshots(page,region,label,output,report){
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});await region.waitFor({state:'visible'});
  // Locator screenshots deliberately exclude agent/chat/private reasoning panes.
  const file=`${label}-${width}.png`;
  await region.screenshot({path:path.join(output,file),animations:'disabled',timeout:15000});
  report.screenshots.push({file,width,height,scope:'public educational content only'});
 }
 await page.setViewportSize({width:1366,height:768});
}
export async function reviewAndConfirm({page,until,output,report,save,check}){
 await page.waitForURL(/\/generation-preview\?run=/,{timeout:45000});
 const id=new URL(page.url()).searchParams.get('run');assert(id);report.runId=id;
 const review=page.getByRole('button',{name:selectors.review});
 const heading=page.getByRole('heading',{name:selectors.outlineTitle});
 await until(async()=>{
  if(await review.isVisible()){await review.click();return true;}
  if(await heading.isVisible())return true;
  const run=await readRun(page,id);assert(!['generating','completed','paused','ended'].includes(run.state),'Run continued before explicit teacher review');
  return false;
 },'open streaming outline review');
 await heading.waitFor();
 let run;
 await until(async()=>{
  run=await readRun(page,id);
  assert(!['generating','completed','paused','ended'].includes(run.state),'Run did not wait for teacher confirmation');
  return run.state==='awaiting_outline_confirmation'&&run.input?.outlineReview==='wait'&&!run.outlineAutoConfirmAt;
 },'server-held outline with countdown cancelled');
 const revision=run.outline?.revision;
 // Server countdown is 2500ms. Survive longer than that without any confirm command.
 await page.waitForTimeout(3000);
 run=await readRun(page,id);
 assert.equal(run.state,'awaiting_outline_confirmation');assert.equal(run.input.outlineReview,'wait');
 assert(!run.outlineAutoConfirmAt);assert.equal(run.outline.revision,revision);
 if(run.stageId){const existing=await getJson(page,`/api/stages/${encodeURIComponent(run.stageId)}`);assert.equal(existing.scenes?.length,0,'Scene generated before explicit confirmation');}
 report.confirmation={held:true,observedBeyondDefaultCountdownMs:3000,revision,explicitUiClick:false};
 check('Outline remains held beyond default countdown; no automatic confirmation counted');
 save('outline-public.json',publicOutline(run));
 const surface=heading.locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]');
 await screenshots(page,surface,'outline',output,report);
 const outline=assertOutline(run);
 const confirm=page.getByRole('button',{name:selectors.confirm});await confirm.waitFor();assert(await confirm.isEnabled());
 const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/generation-runs/${id}/confirm-outline`&&r.request().method()==='POST');
 await confirm.click();const response=await responsePromise;assert(response.ok(),`UI outline confirmation HTTP ${response.status()}`);
 report.confirmation.explicitUiClick=true;report.confirmation.status=response.status();
 check('Teacher confirms exactly three 40-minute outline scenes through real UI');
 return {id,outline};
}
export async function waitForScenes(page,id,until){
 let run;
 await until(async()=>{
  run=await readRun(page,id);
  assert(!['paused','ended'].includes(run.state),`Generation stopped: ${run.state}, step=${run.step||'none'}`);
  return run.state==='completed';
 },'all real generation steps completed');
 assert(run.stageId,'Completed run missing stage');
 const document=await getJson(page,`/api/stages/${encodeURIComponent(run.stageId)}`);
 return {run,document,content:publicDocument(document)};
}
export async function previewAndAnswer({page,run,document,output,report,save,check}){
 const stageUrl=new URL(`/classroom/${encodeURIComponent(run.stageId)}`,page.url()).href;
 if(page.url()!==stageUrl)await page.goto(stageUrl,{waitUntil:'domcontentloaded'});
 const items=page.getByTestId('scene-item');await items.nth(2).waitFor();assert.equal(await items.count(),3);
 for(let index=0;index<2;index++){
  await items.nth(index).click();
  const elements=page.locator('[id^="screen-element-"]:visible');await elements.first().waitFor();
  const expected=document.scenes[index].content.canvas.elements.filter(e=>e.type==='text').map(e=>e.id);
  await page.waitForFunction(ids=>ids.some(id=>document.getElementById('screen-element-'+id)),expected);
  const canvas=elements.first().locator('xpath=ancestor::div[contains(@style,"position: relative") and contains(@style,"width: 100%") and contains(@style,"height: 100%")][1]');
  const legacy=elements.first().locator('xpath=ancestor::div[contains(@class,"select-none")][1]');
  const region=await canvas.count()?canvas:legacy;assert.equal(await region.count(),1,'Unknown rendered slide surface');
  const visible=await elements.allInnerTexts();assert(visible.join('').trim(),'Rendered slide text is empty');
  save(`slide-${index+1}-visible.json`,{title:document.scenes[index].title,text:visible});
  await screenshots(page,region,`slide-${index+1}`,output,report);
 }
 check('Both persisted slides actually rendered and public text/screenshots captured');
 await items.nth(2).click();
 const start=page.getByRole('button',{name:selectors.startQuiz});await start.waitFor();await start.click();
 const question=document.scenes[2].content.questions[0],answer=question.options[0];
 // Option value has a dedicated plain-text span; the label may render TeX and
 // therefore must not be located by unrendered model text.
 const valuePattern=new RegExp('^'+answer.value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
 const option=page.getByRole('button').filter({has:page.locator('span').filter({hasText:valuePattern})});
 assert.equal(await option.count(),1,'Quiz option selector ambiguous');
 await option.click();await page.getByRole('button',{name:selectors.submit}).click();
 const feedback=page.getByText(selectors.report,{exact:true});await feedback.waitFor();
 const region=feedback.locator('xpath=ancestor::div[contains(@class,"flex-1") and contains(@class,"flex-col")][1]');
 const feedbackText=await region.innerText();assert(/正确|错误|correct|incorrect/i.test(feedbackText),'Visible scoring feedback missing');
 const expectedCorrect=question.answer.includes(answer.value);
 const expectedCount=expectedCorrect?/1\s*(?:正确|correct)/i:/1\s*(?:错误|incorrect)/i;
 assert(expectedCount.test(feedbackText),'Feedback disagrees with public answer key');
 report.quiz={selected:answer.value,expectedCorrect,feedbackText};
 save('quiz-feedback-public.json',report.quiz);
 await screenshots(page,region,'quiz-feedback',output,report);check('Real single-choice selection submits and displays expected grading feedback');
 const before=sha256(JSON.stringify(assertScenes(document)));
 await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('scene-item').nth(2).waitFor();await page.getByTestId('scene-item').nth(2).click();
 await page.getByText(selectors.report,{exact:true}).waitFor({timeout:30000});
 const restored=await getJson(page,`/api/stages/${encodeURIComponent(run.stageId)}`);
 assert.equal(sha256(JSON.stringify(assertScenes(restored))),before,'Persisted educational content changed on reload');
 const restoredText=await region.innerText();assert(expectedCount.test(restoredText),'Quiz feedback not restored after reload');
 save('refresh-readback-public.json',{contentSha256:before,sceneCount:restored.scenes.length,feedbackText:restoredText});
 await screenshots(page,region,'refresh-quiz-feedback',output,report);check('Reload restores identical three-scene educational content and saved quiz feedback');
}
