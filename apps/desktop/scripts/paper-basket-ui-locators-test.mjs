import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer, transformWithEsbuild} from 'vite';
import {chromium} from 'playwright';
import {entryCard, entryAnchors, visibleUnique, selectTrigger} from './acceptance/paper-basket-ui-locators.mjs';
import {answerKeyboard, capturePaper} from './acceptance/paper-basket-ui-driver.mjs';

// Production React markup in independent headless Chromium. The native window adapter below only
// maps requested sizes to actual browser viewports; this is not an Electron/native-window pass.
const firstId = 'xibasketentry_11111111-1111-4111-8111-111111111111';
const secondId = 'xibasketentry_22222222-2222-4222-8222-222222222222';
const entry = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PaperBasketOrganizer} from '/src/renderer/components/paper-ui/PaperBasketOrganizer.tsx';
import {PaperBasketPreview} from '/src/renderer/components/paper-ui/PaperBasketPreview.tsx';
import {validQuestionDocument} from '/src/shared/question-document.ts';
const projection = Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions']
  .map(field => [field, {state:'provided',text:field === 'statement' ? '完整题干：求 2+3。' : '完整 ' + field}]));
const document = {schemaVersion:'xiaozhi.question-document.v2',
  source:{resourceId:'resource_11111111-1111-4111-8111-111111111111',resourceVersion:'a'.repeat(64),parserVersion:'unit-layout',ocrVersion:''},
  blocks:[{id:'picture',kind:'image',anchors:[{page:1,box:[0,0,1,1]}],assetId:'asset_11111111-1111-4111-8111-111111111111',sha256:'a'.repeat(64),mime:'image/png',width:10,height:10}],
  context:{schemaVersion:'xiaozhi.question-projection.v1',projection,sourceBlockIds:['picture']},
  answer:{origin:'teacher',text:'5',anchors:[]},analysis:{origin:'teacher',text:'2+3=5',anchors:[]}};
if (!validQuestionDocument(document)) throw Error('Unit question document must be structurally valid');
const question = {id:'question_11111111-1111-4111-8111-111111111111',subject:'数学',grade:'初二',knowledgePoint:'加法',questionType:'选择题',difficulty:'easy',
  stem:projection.statement.text,answer:'5',analysis:'2+3=5',sourceTitle:'Unit only',sourceKind:'teacher_resource',tags:[],createdAt:'2026-11-01',updatedAt:'2026-11-01',document};
const basket = {id:'xibasket_11111111-1111-4111-8111-111111111111',schemaVersion:'xiaozhi.paper-basket.v1',sessionId:'aisession_11111111-1111-4111-8111-111111111111',
  title:'定位回归',revision:2,state:'active',complete:true,count:2,gaps:[],
  blueprint:{title:'定位回归',subject:'数学',grade:'初二',durationMinutes:60,totalPoints:100,mode:'source_only',sections:[{id:'choice',label:'选择题',questionType:'选择题',count:2,points:50}]},
  entries:['${firstId}','${secondId}'].map((entryId,position)=>({entryId,questionId:question.id,contentVersion:'a'.repeat(64),sectionId:'choice',position,question,availability:{available:true}}))};
window.omniEdu = {getOriginalQuestionImage:async()=>({ok:true,value:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'})};
function Fixture(){
  const [key,setKey]=useState(0),[archived,setArchived]=useState(false);
  window.remount = () => setKey(value=>value+1);
  window.archiveFixture = () => {setArchived(true);setKey(value=>value+1);};
  const view = {...basket,state:archived?'archived':'active'};
  return <div key={key} data-testid="paper-basket-workspace">
    <PaperBasketOrganizer basket={view} disabled={archived} onMutate={async()=>false}/>
    <PaperBasketPreview basket={view} disabled={archived} dirty={false} onSnapshot={()=>{}} onDecide={()=>{}}/>
  </div>;
}
createRoot(window.document.getElementById('root')).render(<Fixture/>);
`;
const server = await createServer({configFile:false,appType:'custom',esbuild:{jsx:'automatic'},
  optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','@heroui/react','lucide-react','katex','marked','react-markdown','remark-gfm']},
  plugins:[{name:'paper-locator-fixture',resolveId(id){if(id==='/__paper_locator_fixture.jsx')return '\0paper-locator-fixture.jsx';},
    async load(id){if(id==='\0paper-locator-fixture.jsx')return transformWithEsbuild(entry,'paper-locator-fixture.jsx',{loader:'jsx',jsx:'automatic'});},
    configureServer(server){server.middlewares.use((request,response,next)=>{
      if(request.url!=='/')return next();response.setHeader('Content-Type','text/html');
      response.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__paper_locator_fixture.jsx"></script></body></html>');
    });}}],server:{host:'127.0.0.1',port:0,hmr:false,ws:false,watch:null}});
const output = fs.mkdtempSync('test-results/paper-basket-locator-unit-');
const report = {success:false,screens:[],errors:[],checks:[],scope:'standalone production React in Chromium; viewport adapter only, no Electron/host/DB/model/product build'};
let browser, context;
const check = (name, assertion) => {assertion();report.checks.push({name,pass:true});console.log('PASS '+name);};
try {
  await server.listen();browser=await chromium.launch({headless:true});context=await browser.newContext();
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:60000});
  await visibleUnique(entryCard(page,secondId),'Exact second organizer entry');
  const card=entryCard(page,secondId);
  const broadCount=await card.locator('h3').count();
  check('old descendant heading selector reproduces ambiguity in actual organizer markup',()=>assert(broadCount>=3));
  const moveTrigger=await visibleUnique(selectTrigger(card,'移动至分节'),'Official Select includes its selected value');
  const selectName=await moveTrigger.ariaSnapshot();
  check('actual Select label and current value use a unique official trigger without assuming name equals label',()=>{
    assert.match(selectName,/移动至分节/);assert.match(selectName,/选择题/);
  });
  const nativeAdapter={browserWindow:async()=>({
    evaluate:async(_fn,size)=>Array.isArray(size)?page.setViewportSize({width:size[0],height:size[1]}):true,
    dispose:async()=>{}})};
  async function screenshot(name,preview=false){
    const {heading,body}=await entryAnchors(page,secondId,preview);
    await capturePaper(nativeAdapter,page,output,report,name,heading,body);
    check(name+': exact non-first entry heading and full body at both real viewport sizes',()=>{
      assert.equal(report.screens.filter(screen=>screen.file.startsWith(name+'-')).length,2);
    });
  }
  await screenshot('organized');
  await entryAnchors(page,secondId,true);
  const descendantH4=await entryCard(page,secondId,true).locator('h4').count();
  check('preview number heading excludes actual projection h4 headings',()=>assert(descendantH4>1));
  const studentAnswers=await page.getByTestId('paper-basket-preview-page').getByTestId('paper-basket-answer').count();
  check('student preview has no answer disclosure DOM',()=>assert.equal(studentAnswers,0));
  await screenshot('student',true);
  await page.getByTestId('paper-basket-teacher').click();
  await visibleUnique(entryCard(page,secondId,true).getByTestId('paper-basket-answer'),'Exact teacher answer');
  await screenshot('teacher',true);
  await answerKeyboard(page,report,firstId);
  check('real teacher Tab/Enter/Escape retains official disclosure behavior',()=>assert.equal(report.answerKeyboard.finalExpanded,false));
  await page.evaluate(()=>window.remount());await screenshot('remounted-organize');
  await page.evaluate(()=>window.archiveFixture());await screenshot('archived-preview',true);
  check('archived preview is distinct while organizer with the same entry identity also exists',()=>assert.equal(report.screens.length,10));
  const exact = entryCard(page,secondId,true);
  await exact.evaluate(node=>node.appendChild(node.querySelector(':scope > h4').cloneNode(true)));
  const duplicateError=await entryAnchors(page,secondId,true).catch(error=>error);
  check('duplicate direct number headings fail instead of selecting first',()=>assert.match(duplicateError.message,/strict mode|exactly one/));
  await exact.evaluate(node=>node.lastElementChild.remove());
  await exact.evaluate(node=>{node.querySelector(':scope > h4').style.display='none';});
  page.setDefaultTimeout(300);
  const hiddenError=await entryAnchors(page,secondId,true).catch(error=>error);
  check('hidden direct heading fails instead of becoming a visible screenshot anchor',()=>assert.match(hiddenError.message,/Timeout/));
  check('no uncaught renderer errors in the standalone component fixture',()=>assert.deepEqual(report.errors,[]));
  report.success=true;console.log(JSON.stringify({success:true,passed:report.checks.length,output}));
} finally {
  if(context)await context.close();if(browser)await browser.close();await server.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
}
