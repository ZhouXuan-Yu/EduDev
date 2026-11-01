import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

// Mounted production components with a deferred preload fixture. No Electron,
// model calls, database writes or full renderer suite.
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','Element','Node','Event','MouseEvent','PointerEvent','KeyboardEvent','SVGElement','getComputedStyle','localStorage','MutationObserver'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame=fn=>setTimeout(fn,0);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.matchMedia=dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const {act}=React;
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
let root,passed=0;
const run=fn=>act(async()=>{fn();await new Promise(resolve=>setTimeout(resolve,5));});
const find=id=>document.querySelector(`[data-testid="${id}"]`);
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const press=async element=>{
 assert(element,'press target missing');
 await run(()=>{
  for(const type of ['pointerdown','pointerup'])element.dispatchEvent(new window.PointerEvent(type,{pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerdown'?1:0,bubbles:true,cancelable:true}));
  element.dispatchEvent(new window.MouseEvent('click',{button:0,detail:1,bubbles:true,cancelable:true}));
 });
};
const edit=async value=>run(()=>{
 const input=find('paper-title');
 Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
 input.dispatchEvent(new window.Event('input',{bubbles:true}));
});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
try{
 const load=path=>server.ssrLoadModule('/src/'+path);
 const {defaultPaperBlueprint}=await load('shared/paper-blueprint.ts');
 const {PaperReviewPanel}=await load('renderer/components/PaperReviewPanel.tsx');
 const {PaperBlueprintWorkspace}=await load('renderer/components/PaperBlueprintWorkspace.tsx');
 const {DesktopFrame,useDesktopNavigation,useDesktopCommands,useDesktopNavigationGuard}=await load('renderer/components/desktop/DesktopFrame.tsx');
 const {PAPER_UI_DRAFT_KEY,validPaperUiDraft,readPaperUiDraft}=await load('renderer/components/paper-ui/paper-draft-storage.ts');
 const {QuestionWebAnswerEvidence}=await load('renderer/components/QuestionWebAnswerEvidence.tsx');
 const snapshot=id=>({id,sessionId:'session-fixture',title:id,state:'pending',count:0,totalPoints:100,revision:1,blueprint:{...defaultPaperBlueprint(),title:id},complete:true,sourceCurrent:true,exportCurrent:true,answerVerified:false,selection:{items:[],shortages:[],scanned:0,scanComplete:true,excluded:{unsupported:0,missing_answer:0,source_unavailable:0},duplicateRecords:0}});
 root=createRoot(document.getElementById('root'));
 for(const oldOutcome of ['success','failure']){
  const requests=[],changed=[],a=deferred(),b=deferred();
  window.omniEdu={decidePaper:input=>{requests.push(input.id);return input.id==='A'?a.promise:b.promise;}};
  const render=id=>root.render(React.createElement(PaperReviewPanel,{view:snapshot(id),onChanged:view=>changed.push(view.id)}));
  await run(()=>render('A'));await press(find('paper-confirm'));
  check('A pending decision is busy '+oldOutcome,()=>assert.equal(find('paper-confirm').disabled,true));
  await run(()=>render('B'));
  check('B starts independently while A awaits '+oldOutcome,()=>{assert.equal(find('paper-confirm').disabled,false);assert(!find('paper-decision-error'));});
  await press(find('paper-confirm'));
  await run(()=>oldOutcome==='success'?a.resolve({ok:true,value:{...snapshot('A'),state:'confirmed'}}):a.reject(new Error('old A failure')));
  check('late A cannot clear B busy or leak state '+oldOutcome,()=>{assert.equal(find('paper-confirm').disabled,true);assert.deepEqual(changed,[]);assert(!find('paper-decision-error'));assert.deepEqual(requests,['A','B']);});
  await run(()=>b.resolve({ok:true,value:{...snapshot('B'),state:'confirmed'}}));
  check('B alone commits and releases busy '+oldOutcome,()=>{assert.deepEqual(changed,['B']);assert.equal(find('paper-confirm').disabled,false);});
  await run(()=>root.render(null));
 }
 let nav,nativeCommand,setOtherBlocked;
 const saved={...snapshot('saved'),state:'confirmed'};
 window.omniEdu={listPapers:async()=>({ok:true,value:[saved]}),reviewPaper:async()=>({ok:true,value:saved}),getDesktopChrome:async()=>({enabled:false}),onDesktopCommand:handler=>{nativeCommand=handler;return()=>{};}};
 function Host(){
  nav=useDesktopNavigation();
  const [otherBlocked,updateOtherBlocked]=React.useState(false);setOtherBlocked=updateOtherBlocked;
  useDesktopNavigationGuard(otherBlocked,'另一个页面的编辑未保存');
  useDesktopCommands(command=>{if(command==='settings'){nav.navigate({view:'settings'});return true;}return false;});
  return nav.target.view==='paper'?React.createElement(PaperBlueprintWorkspace):React.createElement('p',null,nav.target.view);
 }
 await run(()=>root.render(React.createElement(DesktopFrame,null,React.createElement(Host))));
 await run(()=>nav.navigate({view:'paper'}));
 for(const owner of ['new','saved']){
  if(owner==='saved'){
   const trigger=find('paper-history').querySelector('button[aria-expanded]');
   await press(trigger);assert.equal(trigger.getAttribute('aria-expanded'),'true');
   await press(find('paper-saved'));
  }
  if(owner==='saved')await press(find('paper-step-blueprint'));
  const baseline=find('paper-title').value;
  await edit('不能丢失的'+owner+'蓝图');
  check(owner+' draft marked after real input',()=>assert(find('paper-discard-edits')));
  for(const target of ['knowledge','notebook']){
   await run(()=>assert.equal(nav.navigate({view:target}),false));
   check(owner+' draft blocks '+target+' navigation',()=>{assert.equal(nav.target.view,'paper');assert.equal(find('paper-title').value,'不能丢失的'+owner+'蓝图');});
  }
  for(const command of ['back','settings']){
   await run(()=>nativeCommand(command));
   check(owner+' draft blocks native '+command,()=>{assert.equal(nav.target.view,'paper');assert.equal(find('paper-title').value,'不能丢失的'+owner+'蓝图');assert(find('desktop-navigation-notice').textContent.includes('蓝图'));});
  }
  await press(find('paper-discard-edits'));
  await press([...document.querySelectorAll('button')].find(button=>button.textContent==='继续编辑'));
  check(owner+' cancel retains edits and guard',()=>{assert.equal(find('paper-title').value,'不能丢失的'+owner+'蓝图');assert(find('paper-discard-edits'));});
  await press(find('paper-discard-edits'));await press(find('paper-discard-continue'));
  check(owner+' explicit discard restores original snapshot without deleting confirmation',()=>{assert.equal(find('paper-title').value,baseline);assert(!find('paper-discard-edits'));if(owner==='saved')assert(find('paper-confirmed'));});
  await run(()=>assert.equal(nav.navigate({view:'knowledge'}),true));
  check(owner+' only confirmed discard releases navigation',()=>assert.equal(nav.target.view,'knowledge'));
  await run(()=>nav.navigate({view:'paper'}));
 }
 const sessionId='aisession_11111111-1111-4111-8111-111111111111';
 const paperId='xipaper_22222222-2222-4222-8222-222222222222';
 const generatedBlueprint={...defaultPaperBlueprint(),mode:'hybrid',sections:defaultPaperBlueprint().sections.map(section=>({...section,generatedCount:1}))};
 const record={schemaVersion:'edudev.paper-ui-draft.v1',blueprint:generatedBlueprint,contextOwner:sessionId,targetSessionId:sessionId,currentView:{id:paperId,sessionId}};
 check('strict recovery accepts blueprint/reference only',()=>assert(validPaperUiDraft(record)));
 for(const patch of [{state:'confirmed'},{digest:'forged-confirmation'},{targetSessionId:'aisession_33333333-3333-4333-8333-333333333333'},{currentView:{id:paperId,sessionId,state:'confirmed'}},{blueprint:{...generatedBlueprint,totalPoints:999}}]){
  check('recovery refuses forged state, owner mismatch or invalid blueprint '+JSON.stringify(Object.keys(patch)),()=>assert.equal(validPaperUiDraft({...record,...patch}),false));
 }
 let created=0,confirmCalls=0,createPaperCalls=0;
 const context={sessionId,title:'已有题组任务',subject:'数学',grade:'初二',originalCount:10,variationCount:10};
 window.omniEdu.listPaperGenerationContexts=async()=>({ok:true,value:[context]});
 window.omniEdu.createAiConversationSession=async()=>{created++;return {session:{id:sessionId}};};
 window.omniEdu.decidePaper=async()=>{confirmCalls++;throw Error('Recovery must not decide papers');};
 window.omniEdu.createPaper=async()=>{createPaperCalls++;return {ok:false,error:'shortage'};};
 const chooseMode=mode=>run(()=>{const select=find('paper-mode');select.value=mode;select.dispatchEvent(new window.Event('change',{bubbles:true}));});
 await chooseMode('hybrid');await edit('混合蓝图返回恢复');
 await press(find('paper-generation-open-ai'));
 check('existing target session handoff bypasses only own guard',()=>{assert.equal(nav.target.view,'ai');assert.equal(nav.target.sessionId,sessionId);assert.equal(created,0);assert(nav.target.draft.includes('混合蓝图返回恢复'));});
 check('only validated local draft and references are stored',()=>{const stored=readPaperUiDraft(window.sessionStorage);assert.equal(stored.status,'ready');assert.equal(stored.draft.contextOwner,sessionId);assert(!('state' in stored.draft));assert(!('selection' in stored.draft));});
 await run(()=>nativeCommand('back'));
 check('back restores complete blueprint/context and dirty guard',()=>{assert.equal(nav.target.view,'paper');assert.equal(find('paper-title').value,'混合蓝图返回恢复');assert.equal(find('paper-mode').value,'hybrid');assert.equal(find('paper-generation-context').value,sessionId);assert(find('paper-discard-edits'));assert.equal(find('paper-step-delivery').disabled,true);assert.equal(window.sessionStorage.getItem(PAPER_UI_DRAFT_KEY),null);});
 await run(()=>setOtherBlocked(true));await press(find('paper-generation-open-ai'));
 check('other guard rejects controlled handoff without losing edits',()=>{assert.equal(nav.target.view,'paper');assert.equal(find('paper-title').value,'混合蓝图返回恢复');assert(find('paper-discard-edits'));assert(find('paper-error').textContent.includes('未跳转'));assert.equal(window.sessionStorage.getItem(PAPER_UI_DRAFT_KEY),null);assert.equal(created,0);});
 await run(()=>setOtherBlocked(false));await run(()=>assert.equal(nav.navigate({view:'knowledge'}),false));
 check('rejected handoff immediately reinstates own guard',()=>assert.equal(nav.target.view,'paper'));
 await press(find('paper-generation-open-ai'));await run(()=>nativeCommand('back'));
 check('retry stays in same target session and remains recoverable',()=>{assert.equal(created,0);assert.equal(find('paper-title').value,'混合蓝图返回恢复');});
 // Recover an existing pending paper by reference, never from a cached approval.
 await press(find('paper-discard-edits'));await press(find('paper-discard-continue'));
 await run(()=>nav.navigate({view:'knowledge'}));
 let reviewCalls=0;
 const pendingPaper={...snapshot(paperId),sessionId,blueprint:generatedBlueprint};
 window.omniEdu.reviewPaper=async input=>{reviewCalls++;assert.equal(input.id,paperId);assert.equal(input.sessionId,sessionId);return {ok:true,value:pendingPaper};};
 window.sessionStorage.setItem(PAPER_UI_DRAFT_KEY,JSON.stringify(record));
 await run(()=>nav.navigate({view:'paper'}));await press(find('paper-step-review'));
 check('restored pending snapshot is re-read but cannot confirm/export',()=>{assert.equal(reviewCalls,1);assert.equal(find('paper-confirm').disabled,true);assert.equal(find('paper-step-delivery').disabled,true);assert(find('paper-draft-status'));assert.equal(confirmCalls,0);assert.equal(createPaperCalls,0);});
 await press(find('paper-step-blueprint'));await press(find('paper-discard-edits'));await press(find('paper-discard-continue'));
 await run(()=>nav.navigate({view:'knowledge'}));
 window.omniEdu.reviewPaper=async()=>({ok:false,error:'permission_denied'});
 window.sessionStorage.setItem(PAPER_UI_DRAFT_KEY,JSON.stringify(record));
 await run(()=>nav.navigate({view:'paper'}));
 check('failed host revalidation retains edits with no actionable snapshot',()=>{assert.equal(find('paper-mode').value,'hybrid');assert.equal(find('paper-step-review').disabled,true);assert.equal(find('paper-step-delivery').disabled,true);assert(find('paper-error').textContent.includes('未能重新核验'));});
 await press(find('paper-discard-edits'));await press(find('paper-discard-continue'));
 await press([...document.querySelectorAll('button')].find(button=>button.textContent==='新建蓝图'));
 window.omniEdu.listPaperGenerationContexts=async()=>({ok:true,value:[]});
 await chooseMode('ai_original');await edit('原创新任务草稿');
 await press(find('paper-generation-open-ai'));await run(()=>nativeCommand('back'));
 check('new original task returns to its own unavailable context without pretending approval',()=>{assert.equal(created,1);assert.equal(find('paper-title').value,'原创新任务草稿');assert.equal(find('paper-generation-context').value,sessionId);assert(find('paper-generation-empty'));assert.equal(find('paper-step-delivery').disabled,true);});
 await press(find('paper-generate'));
 check('unapproved generated context still cannot create or confirm',()=>{assert.equal(createPaperCalls,0);assert.equal(confirmCalls,0);assert(find('paper-error').textContent.includes('已确认题组'));});
 await press(find('paper-generation-open-ai'));await run(()=>nativeCommand('back'));
 check('repeated supplement reuses new session instead of orphaning another task',()=>assert.equal(created,1));
 await press(find('paper-discard-edits'));await press(find('paper-discard-continue'));
 await run(()=>nav.navigate({view:'knowledge'}));
 window.sessionStorage.setItem(PAPER_UI_DRAFT_KEY,'{corrupted');
 await run(()=>nav.navigate({view:'paper'}));
 check('corrupt draft fails closed and is removed',()=>{assert.equal(find('paper-mode').value,'source_only');assert.equal(find('paper-step-review').disabled,true);assert.equal(find('paper-step-delivery').disabled,true);assert(find('paper-error').textContent.includes('损坏'));assert.equal(window.sessionStorage.getItem(PAPER_UI_DRAFT_KEY),null);assert.equal(confirmCalls,0);});
 let evidenceLoads=0;
 window.omniEdu.getQuestionWebAnswerEvidence=async()=>{evidenceLoads++;return {ok:true,items:[{id:'candidate-ui',state:'conflict',reason:'source_changed',observation:{title:'已保存网页证据',url:'https://example.test/solution',observedAt:'2026-11-01T00:00:00.000Z',text:'公开网页原文样本'}}]};};
 await run(()=>root.render(React.createElement(QuestionWebAnswerEvidence,{question:{id:'question-ui'}})));
 const evidenceTrigger=find('question-web-evidence-fold-question-ui').querySelector('button[aria-expanded]');
 check('web evidence uses a real collapsed accessible trigger without native triangles',()=>{assert.equal(evidenceTrigger.getAttribute('aria-expanded'),'false');assert.equal(document.querySelectorAll('details,summary').length,0);});
 await press(evidenceTrigger);await press(find('question-web-evidence-load'));
 const candidateTrigger=find('question-web-candidate').querySelector('button[aria-expanded]');
 await press(candidateTrigger);
 check('web evidence keeps real read callback, source conflict and stored public text',()=>{assert.equal(evidenceLoads,1);assert.equal(candidateTrigger.getAttribute('aria-expanded'),'true');assert(find('question-web-candidate').textContent.includes('原题或来源已变化'));assert.equal(find('question-web-observed-text').textContent,'公开网页原文样本');});
 const evidenceText=find('question-web-observed-text');
 await press(candidateTrigger);await press(candidateTrigger);
 check('collapse retains evidence nodes without another read or changing the answer',()=>{assert.equal(evidenceLoads,1);assert.strictEqual(find('question-web-observed-text'),evidenceText);assert.equal(confirmCalls,0);});
 console.log(JSON.stringify({success:true,passed,scope:'mounted U4 components; preload fixtures only; no build/Electron/model'}));
}finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close();}
