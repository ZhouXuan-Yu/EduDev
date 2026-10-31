import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement as h, act, useEffect, useState} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import ts from 'typescript';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const check = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name); };
// Isolated DOM only: no Electron, IPC, user profile, database or model requests.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url:'http://localhost/',pretendToBeVisual:true});
const {window} = dom;
for (const name of ['window','document','HTMLElement','SVGElement','Element','Node','Event','MouseEvent','KeyboardEvent','PointerEvent','MutationObserver']) {
  Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name === 'window' ? window : window[name]});
}
for (const name of Object.getOwnPropertyNames(window).filter(name => /^HTML.*Element$/.test(name))) {
  Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:window[name]});
}
const domErrors=[];window.addEventListener('error',event=>domErrors.push(event.error?.name || 'Error'));
Object.defineProperty(globalThis,'navigator',{configurable:true,value:window.navigator});
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = query => ({matches:false,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}});
window.ResizeObserver = globalThis.ResizeObserver = class {observe(){} unobserve(){} disconnect(){}};
window.Element.prototype.getAnimations ??= () => [];
const server = await createServer({root:desktop,configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false,watch:null}});
const {createRoot} = await import('react-dom/client');
const root = createRoot(document.getElementById('root'));
let caseId = 0;
const settle = async fn => {await act(async () => {await fn();await new Promise(resolve => setTimeout(resolve,30));});};
const trigger = () => document.querySelector('[data-slot="disclosure-trigger"]');
const panel = () => document.querySelector('[data-slot="disclosure-content"]');
const expanded = () => trigger().getAttribute('aria-expanded') === 'true';
const press = async target => settle(() => {
  target.dispatchEvent(new window.PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:1,bubbles:true,cancelable:true}));
  target.dispatchEvent(new window.PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:0,bubbles:true,cancelable:true}));
  target.dispatchEvent(new window.MouseEvent('click',{button:0,detail:1,bubbles:true,cancelable:true}));
});
const key = async value => settle(() => {
  trigger().dispatchEvent(new window.KeyboardEvent('keydown',{key:value,code:value === ' ' ? 'Space' : value,bubbles:true,cancelable:true}));
  trigger().dispatchEvent(new window.KeyboardEvent('keyup',{key:value,code:value === ' ' ? 'Space' : value,bubbles:true,cancelable:true}));
});
try {
  const {DisclosureCard} = await server.ssrLoadModule('/src/renderer/components/ui/DisclosureCard.tsx');
  const mount = async props => {caseId++;await settle(() => root.render(h(DisclosureCard,{key:caseId,title:'合成核对',...props},props?.children ?? h('input',{'aria-label':'合成草稿',defaultValue:'未保存'}))));};
  await check('Focused strict TypeScript contract accepts official props and CSS module', () => {
    const cssType=path.join(desktop,'__disclosure_card_css_types.d.ts');
    const options={target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Node10,jsx:ts.JsxEmit.ReactJSX,strict:true,skipLibCheck:true,noEmit:true,esModuleInterop:true,allowSyntheticDefaultImports:true};
    const host=ts.createCompilerHost(options),original=host.getSourceFile.bind(host);
    const samePath=name=>path.resolve(name).replaceAll('\\','/').toLowerCase()===cssType.replaceAll('\\','/').toLowerCase();
    host.getSourceFile=(name,language,...rest)=>samePath(name)?ts.createSourceFile(name,"declare module '*.module.css' {const value: Readonly<Record<string,string>>; export default value;}",language):original(name,language,...rest);
    const program=ts.createProgram([path.join(desktop,'src/renderer/components/ui/DisclosureCard.tsx'),cssType],options,host);
    const diagnostics=ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length,0,diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));
  });
  await check('Official Card and all six Disclosure parts; no native details or summary', async () => {
    await mount({id:'synthetic-disclosure','data-testid':'test-card',className:'caller-card',bodyClassName:'caller-body',headingLevel:2});
    assert.equal(document.querySelectorAll('[data-slot="card"]').length,1);
    for(const slot of ['disclosure','disclosure-heading','disclosure-trigger','disclosure-indicator','disclosure-content','disclosure-body']) assert.equal(document.querySelectorAll(`[data-slot="${slot}"]`).length,1);
    assert.equal(document.querySelectorAll('details,summary').length,0);
    assert(document.querySelector('[data-slot="card"]').classList.contains('caller-card'));
    assert(document.querySelector('[data-slot="disclosure-body"] .caller-body'));
    const disclosure=document.querySelector('[data-testid="test-card"]');
    assert(document.getElementById('synthetic-disclosure')===disclosure.closest('[data-slot="card"]'));
    assert.equal(document.querySelector('[data-slot="disclosure-heading"]').tagName,'H2');
    assert.equal(expanded(),false);assert.equal(panel().getAttribute('aria-hidden'),'true');
    assert.equal(trigger().getAttribute('aria-controls'),panel().id);
  });
  await check('Long ReactNode title stays in the application title slot with official sibling indicator', async () => {
    const long='合成超长标题'.repeat(30);await mount({title:h('span',null,long)});
    const parts=trigger().children;assert.equal(parts.length,2);assert.equal(parts[0].tagName,'SPAN');assert.equal(parts[0].textContent,long);
    assert.equal(parts[1].getAttribute('data-slot'),'disclosure-indicator');assert.notEqual(trigger().className.indexOf('trigger'),-1);
    await key('Enter');assert.equal(expanded(),true);
  });
  await check('Pointer toggles official disclosure and reports next state', async () => {
    const changes=[];await mount({onExpandedChange:value=>changes.push(value)});
    await press(trigger());assert.equal(expanded(),true);assert.equal(panel().getAttribute('aria-hidden'),'false');
    await press(trigger());assert.equal(expanded(),false);assert.deepEqual(changes,[true,false]);
  });
  await check('Enter and Space toggle via real React Aria keyboard handlers', async () => {
    await mount({});await settle(()=>trigger().focus());
    await key('Enter');assert.equal(expanded(),true);await key(' ');assert.equal(expanded(),false);
  });
  await check('Keyboard focus uses official focus-visible state', async () => {
    await mount({});await settle(()=>{document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));trigger().focus();});
    assert(document.activeElement===trigger());assert.equal(trigger().getAttribute('data-focus-visible'),'true');
  });
  await check('Controlled state never changes without owner update', async () => {
    const changes=[];await mount({isExpanded:false,onExpandedChange:value=>changes.push(value)});
    await press(trigger());assert.equal(expanded(),false);assert.deepEqual(changes,[true]);
    await settle(()=>root.render(h(DisclosureCard,{key:caseId,title:'合成核对',isExpanded:true},h('p',null,'正文'))));assert.equal(expanded(),true);
  });
  await check('Default expanded and disabled preserve official semantics', async () => {
    const changes=[];await mount({defaultExpanded:true,isDisabled:true,onExpandedChange:value=>changes.push(value)});
    assert.equal(expanded(),true);assert.equal(trigger().disabled,true);await press(trigger());await key('Enter');assert.equal(expanded(),true);assert.deepEqual(changes,[]);
  });
  await check('Collapsed children remain mounted and retain unsaved local state', async () => {
    let mounts=0,unmounts=0;
    function Draft(){const [text,setText]=useState('未保存');useEffect(()=>{mounts++;return()=>{unmounts++;};},[]);return h('button',{onClick:()=>setText('保留草稿'),'data-testid':'stateful-child'},text);}
    await mount({defaultExpanded:true,children:h(Draft)});
    const child=document.querySelector('[data-testid="stateful-child"]');await settle(()=>child.click());
    await press(trigger());assert.equal(expanded(),false);assert(document.querySelector('[data-testid="stateful-child"]')===child);assert.equal(unmounts,0);
    await press(trigger());assert.equal(child.textContent,'保留草稿');assert.equal(mounts,1);assert.equal(unmounts,0);
  });
  await check('Official motion/focus stay intact; app CSS owns only explicit Card/trigger/title composition', () => {
    const css=fs.readFileSync(path.join(desktop,'node_modules/@heroui/styles/dist/components/disclosure.css'),'utf8');
    assert.match(css,/motion-reduce:transition-none/);assert.match(css,/data-focus-visible/);
    const ownCss=fs.readFileSync(path.join(desktop,'src/renderer/ui-system/disclosure-card.module.css'),'utf8');
    const clean=ownCss.replace(/\/\*[\s\S]*?\*\//g,'');
    assert.equal(clean.match(/\.card\s*\{([^}]+)\}/)[1].trim(),'padding: var(--space-16, 16px);');
    assert.match(clean,/\.trigger\s*\{[^}]*display:\s*flex;[^}]*width:\s*100%;/);
    assert.match(clean,/\.title\s*\{[^}]*flex:\s*1;[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/);
    assert.match(clean,/\.indicator\s*\{[^}]*flex-shrink:\s*0;/);
    assert(!/!important|\.disclosure__|\[data-slot|(?:^|})\s*(?:button|svg|\*)\b/.test(clean));
  });
  const {MistakeSimilarResults} = await server.ssrLoadModule('/src/renderer/components/students/MistakeSimilarQuestions.tsx');
  const {StudentPracticeResult} = await server.ssrLoadModule('/src/renderer/components/students/StudentPracticeResult.tsx');
  const {MistakeRecognitionState, StudentMistakeOcr} = await server.ssrLoadModule('/src/renderer/components/students/StudentMistakeOcr.tsx');
  await check('Similar question title, count, evidence and empty states survive migration', async () => {
    const question={id:'synthetic_question',stem:'合成题干',answer:'合成答案',analysis:'合成解析',subject:'数学',grade:'七年级',knowledgePoint:'方程'};
    caseId++;await settle(()=>root.render(h(MistakeSimilarResults,{key:caseId,value:{items:[{source:{questionId:question.id},question,reasons:['同知识点']}],scanned:1}})));
    assert.equal(document.querySelectorAll('details,summary').length,0);assert.equal(document.querySelectorAll('[data-slot="card"]').length,1);
    assert(document.querySelector('[data-testid="mistake-similar-count"]').textContent.includes('1 / 10'));
    assert(trigger().textContent.includes('方程'));await press(trigger());
    assert(document.querySelector('[data-testid="question-answer-text"]').textContent.includes('合成答案'));
    assert(document.querySelector('[data-testid="question-answer-verification"]'));
    await settle(()=>root.render(h(MistakeSimilarResults,{key:caseId,value:{items:[],scanned:0}})));
    assert(document.querySelector('[data-testid="mistake-similar-empty"]'));assert.equal(document.querySelectorAll('[data-slot="card"]').length,0);
  });
  await check('Practice answer disclosure retains selected source and unsaved answer form', async () => {
    const sourceRequests=[],changes=[];
    const exercise={id:'exercise_set_00000000-0000-0000-0000-000000000001',title:'合成实际练习',subject:'数学',knowledgePoint:'方程',reviewSource:{id:'synthetic'},items:[{stem:'合成练习题',answer:'参考值',analysis:'参考解析'}]};
    window.omniEdu={listExerciseSets:async id=>{assert.equal(id,'student_A');return [exercise];},readPracticeSource:async input=>{sourceRequests.push(input);return {ok:true,value:{state:'confirmed',exercise,exerciseVersion:'a'.repeat(64)}};}};
    const onChange=(...value)=>changes.push(value);
    caseId++;await settle(()=>root.render(h(StudentPracticeResult,{key:caseId,studentId:'student_A',topic:{name:'方程',subject:'数学'},disabled:false,onChange})));
    const select=document.querySelector('[data-testid="training-practice-select"]');
    await settle(()=>{select.value=exercise.id;select.dispatchEvent(new window.Event('change',{bubbles:true}));});
    assert.equal(sourceRequests.length,1);assert.equal(sourceRequests[0].studentId,'student_A');assert.equal(sourceRequests[0].exerciseId,exercise.id);
    assert.equal(document.querySelectorAll('details,summary').length,0);
    const answer=document.querySelector('[data-testid="training-practice-answer-0"]');
    await settle(()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(answer,'教师未保存的实际作答');answer.dispatchEvent(new window.Event('input',{bubbles:true}));});
    const outcome=document.querySelector('[data-testid="training-practice-outcome-0"]');
    await settle(()=>{outcome.value='correct';outcome.dispatchEvent(new window.Event('change',{bubbles:true}));});
    assert.equal(changes.at(-1)[0]?.answers[0].answer,'教师未保存的实际作答');
    await press(trigger());await press(trigger());assert(document.querySelector('[data-testid="training-practice-answer-0"]')===answer);
    assert.equal(answer.value,'教师未保存的实际作答');assert.equal(select.value,exercise.id);assert.equal(sourceRequests.length,1);
    assert.equal(document.querySelector('[data-testid="training-practice-score-earned"]'),null);
  });
  const analysis={id:'image_A',studentId:'student_A',version:'a'.repeat(64),ocrStatus:'recognized',localOcr:{original:'合成本地原文'}};
  await check('OCR original disclosure never starts processing and preserves disabled correction guards', async () => {
    let starts=0,cancels=0;caseId++;
    await settle(()=>root.render(h(MistakeRecognitionState,{key:caseId,analysis:{...analysis,ocrStatus:'teacher_corrected'},busy:false,error:'',onStart:()=>starts++,onCancel:()=>cancels++})));
    assert.equal(document.querySelector('[data-testid="student-mistake-ocr-start"]').disabled,true);
    const original=document.querySelector('[data-testid="student-mistake-ocr-original"]');await press(trigger());await press(trigger());
    assert.equal(original.textContent,'合成本地原文');assert(document.querySelector('[data-testid="student-mistake-ocr-original"]')===original);
    assert.equal(starts,0);assert.equal(cancels,0);assert.equal(document.querySelectorAll('details,summary').length,0);
  });
  await check('OCR late response cannot cross a changed student context', async () => {
    let complete;const received=[],requests=[],cancellations=[];
    window.omniEdu={startMistakeOcr:input=>{requests.push(input);return new Promise(resolve=>{complete=resolve;});},cancelMistakeOcr:async input=>cancellations.push(input)};
    const props={analysis,onAnalysis:value=>received.push(value),onBusy:()=>{}};
    caseId++;await settle(()=>root.render(h(StudentMistakeOcr,{key:caseId,...props})));
    await press(document.querySelector('[data-testid="student-mistake-ocr-start"]'));assert.equal(requests[0].studentId,'student_A');
    await settle(()=>root.render(h(StudentMistakeOcr,{key:caseId,...props,analysis:{...analysis,id:'image_B',studentId:'student_B'}})));
    await settle(()=>complete({ok:true,analysis:{...analysis,localOcr:{original:'过期合成结果'}}}));
    assert.equal(received.length,0);assert.equal(cancellations.length,1);assert.equal(cancellations[0].studentId,'student_A');
    assert.equal(document.querySelector('[data-testid="student-mistake-ocr-original"]').textContent,'合成本地原文');
    delete window.omniEdu;
  });
  await check('No component runtime errors in the isolated DOM',()=>assert.deepEqual(domErrors,[]));
  console.log(JSON.stringify({success:true,checks:checks.length,scope:'Isolated jsdom + actual installed HeroUI interaction, focused component typecheck; no Electron or visual CSSOM acceptance'}));
} finally {
  await settle(()=>root.unmount());await server.close();dom.window.close();
}
