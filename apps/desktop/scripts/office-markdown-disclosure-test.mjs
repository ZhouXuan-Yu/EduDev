import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement as h, act, useContext, useEffect, useLayoutEffect, useRef} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import ts from 'typescript';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const failures = [];
const check = async (name, run) => {
  try {await run();checks.push(name);console.log('PASS '+name);}
  catch(error) {failures.push({name,error});console.error('FAIL '+name+'\n'+error.stack);}
};
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
// A failing strictEqual on jsdom nodes inspects their cyclic React fiber graph
// while constructing its diff and can exhaust memory before reporting the failure.
// Compare the same references, but keep assertion diagnostics bounded.
const sameNode = (actual, expected, message) => assert.ok(actual === expected, message);
const expanded = () => trigger().getAttribute('aria-expanded') === 'true';
const dispatchPress = target => {
  target.dispatchEvent(new window.PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:1,bubbles:true,cancelable:true}));
  target.dispatchEvent(new window.PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:0,bubbles:true,cancelable:true}));
  target.dispatchEvent(new window.MouseEvent('click',{button:0,detail:1,bubbles:true,cancelable:true}));
};
const press = async target => settle(() => dispatchPress(target));
const key = async value => settle(() => {
  trigger().dispatchEvent(new window.KeyboardEvent('keydown',{key:value,code:value === ' ' ? 'Space' : value,bubbles:true,cancelable:true}));
  trigger().dispatchEvent(new window.KeyboardEvent('keyup',{key:value,code:value === ' ' ? 'Space' : value,bubbles:true,cancelable:true}));
});
try {
  await check('Strict TypeScript check of the two changed source modules (no emit)',()=>{
    const cssType=path.join(desktop,'__office_markdown_css_types.d.ts');
    const options={target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Node10,jsx:ts.JsxEmit.ReactJSX,strict:true,skipLibCheck:true,noEmit:true,esModuleInterop:true,allowSyntheticDefaultImports:true,types:['node']};
    const host=ts.createCompilerHost(options),original=host.getSourceFile.bind(host);
    host.getSourceFile=(name,language,...rest)=>path.resolve(name)===cssType?ts.createSourceFile(name,"declare module '*.module.css' {const value: Readonly<Record<string,string>>; export default value;}",language):original(name,language,...rest);
    const program=ts.createProgram(['OfficeMarkdown.tsx','OfficeMarkdownDisclosure.tsx'].map(name=>path.join(desktop,'src/renderer/components/office',name)).concat(cssType),options,host);
    const diagnostics=ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length,0,diagnostics.map(d=>(d.file?.fileName??'')+': '+ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));
  });
  const {OfficeAnswerMarkdown} = await server.ssrLoadModule('/src/renderer/components/office/OfficeAnswerMarkdown.tsx');
  const {OfficeMarkdown} = await server.ssrLoadModule('/src/renderer/components/office/OfficeMarkdown.tsx');
  const {OfficeMarkdownDisclosure, OfficeMarkdownDisclosureScope, OfficeMarkdownSummary} = await server.ssrLoadModule('/src/renderer/components/office/OfficeMarkdownDisclosure.tsx');
  await check('Initial layout before ancestor root ref initializes raw open; remount restores state without timers',()=>{
    const observations=[];
    function Probe(props) {
      const scope=useContext(OfficeMarkdownDisclosureScope);
      useLayoutEffect(()=>{
        const state=scope.states.get(0);
        observations.push({rootAttached:Boolean(scope.root.current),state:state && {htmlOpen:state.htmlOpen,expanded:state.expanded}});
      },[]);
      return h(OfficeMarkdownDisclosure,props);
    }
    const components={details:Probe};
    const text='<details open><summary>Layout order</summary>Layout body</details>';
    const view=streaming=>h(OfficeMarkdown,{key:'sync-layout',isStreaming:streaming,components},text);
    // Synchronous act flushes the commit/layout work. No settle(), await, or
    // timer advancement can mask initialization after the ancestor ref attaches.
    act(()=>root.render(view(true)));
    assert.equal(observations[0].rootAttached,false);
    assert.deepEqual(observations[0].state,{htmlOpen:true,expanded:true});
    assert.equal(expanded(),true);assert.equal(panel().getAttribute('aria-hidden'),'false');
    act(()=>dispatchPress(trigger()));assert.equal(expanded(),false);
    act(()=>root.render(view(false)));
    assert.equal(expanded(),false);assert.equal(panel().getAttribute('aria-hidden'),'true');
    assert(panel().textContent.includes('Layout body'));
    assert.equal(observations.length,2,'Mode switch must exercise a real adapter remount');
    assert.deepEqual(observations[1].state,{htmlOpen:true,expanded:false});
  });
  const positions=[];
  const captureComponents={details:props=>{positions.push(props.node?.position);return h(OfficeMarkdownDisclosure,props);}};
  const positionalText='Leading paragraph.\n\n<details><summary>Duplicate</summary><p>first</p><details><summary>Duplicate</summary>nested</details></details>\n\nMiddle paragraph.\n\n<details><summary>Duplicate</summary>last</details>';
  await check('Inspect actual block-relative streaming and message-relative static HAST positions',async()=>{
    const snapshots=[];
    for(const streaming of [true,false]) {
      positions.length=0;
      await settle(()=>root.render(h(OfficeMarkdown,{key:'position-probe',isStreaming:streaming,components:captureComponents},positionalText)));
      snapshots.push(positions.map(position=>position.start.offset));
    }
    assert.deepEqual(snapshots,[[0,49,0],[20,69,153]]);
    console.log('HAST start offsets '+JSON.stringify(snapshots));
  });
  const turn={id:'synthetic-markdown',status:'completed',items:[]};
  const render = async (text, streaming=false, fresh=true) => {
    if(fresh)caseId++;
    await settle(()=>root.render(h(OfficeAnswerMarkdown,{key:caseId,text,streaming,turn})));
    assert.equal(document.querySelectorAll('details,summary').length,0);
  };
  for(const streaming of [false,true]) for(const suffix of ['</p></details>','']) {
    await check(`Actual answer consumer HTML full/partial streaming=${streaming} closed=${Boolean(suffix)}`,async()=>{
      await render('<details><summary>合成标题</summary><p>完整内容'+suffix,streaming);
      assert.equal(trigger().textContent.trim(),'合成标题');
      assert(document.querySelector('[data-slot="disclosure-body"]').textContent.includes('完整内容'));
      assert.equal(expanded(),false);assert.equal(panel().getAttribute('aria-hidden'),'true');
    });
  }
  await check('Raw open attribute, keyboard Enter and Space, focus and mounted content',async()=>{
    await render('<details open><summary>公开详情</summary><p>正文保留</p></details>');
    assert.equal(expanded(),true);
    const originalPanel=panel();const body=document.querySelector('[data-slot="disclosure-body"]');
    await settle(()=>trigger().focus());await key('Enter');assert.equal(expanded(),false);
    sameNode(document.activeElement,trigger(),'Keyboard focus must remain on trigger');sameNode(panel(),originalPanel,'Collapse must retain panel');assert(body.isConnected);
    await key(' ');assert.equal(expanded(),true);sameNode(panel(),originalPanel,'Expand must retain panel');
  });
  await check('Summary links preserved outside trigger; title cannot contain interactive descendants',async()=>{
    await render('<details><summary>参考 <a href="https://example.com/reference">原始来源</a> 与 <strong>重点</strong></summary><p>正文</p></details>');
    assert(trigger().textContent.includes('原始来源'));
    assert.equal(trigger().querySelectorAll('a,button,input,select,textarea').length,0);
    const link=document.querySelector('[data-slot="disclosure-body"] a');
    assert.equal(link?.getAttribute('href'),'https://example.com/reference');
    await press(trigger());assert.equal(expanded(),true);assert(link.isConnected);
  });
  await check('Raw body math, code, nested details and orphan summary retain content',async()=>{
    await render('<summary>独立标题</summary>\n\n<details open><summary>主标题</summary>\n\n数学 $x^2+1$\n\n```html\n<details open><summary>代码原文</summary>literal</details>\n```\n\n<details><summary>内层</summary><p>内层正文</p></details>\n</details>');
    assert(document.querySelector('.katex'));assert(document.body.textContent.includes('独立标题'));
    assert(document.querySelector('code').textContent.includes('<details open><summary>代码原文</summary>literal</details>'));
    assert.equal(document.querySelectorAll('[data-slot="disclosure-trigger"]').length,2);
    assert(document.body.textContent.includes('内层正文'));
  });
  for(const streaming of [false,true]) await check(`Literal fenced/inline/escaped HTML unchanged streaming=${streaming}`,async()=>{
    const literal='<details open><summary>literal</summary>text</details>';
    await render('```html\n'+literal+'\n```\n\n`'+literal+'`\n\n&lt;details&gt;原文&lt;/details&gt;',streaming);
    assert.equal(document.querySelectorAll('[data-slot="disclosure-trigger"]').length,0);
    assert([...document.querySelectorAll('code')].some(el=>el.textContent.includes(literal)));
    assert(document.body.textContent.includes('<details>原文</details>'));
  });
  await check('Within-stream DOM identity and completion semantic expansion/content survive',async()=>{
    const prefix='<details><summary>实时标题</summary><p>第一段';
    await render(prefix,true);await press(trigger());
    const originalTrigger=trigger(),originalPanel=panel();
    await render(prefix+'继续输出</p></details>',true,false);
    sameNode(trigger(),originalTrigger,'Partial streaming update must retain trigger');sameNode(panel(),originalPanel,'Partial streaming update must retain panel');assert.equal(expanded(),true);
    await render(prefix+'继续输出</p></details>',false,false);
    assert(panel().textContent.includes('第一段继续输出'));
    assert.equal(expanded(),true,'Streaming completion must retain manual expansion');
    assert.equal(panel().getAttribute('aria-hidden'),'false');
  });
  await check('Manual collapse survives streaming completion despite unchanged raw open attribute',async()=>{
    const text='<details open><summary>Collapse</summary><p>Retained body</p></details>';
    await render(text,true);await press(trigger());assert.equal(expanded(),false);
    await render(text+'\n\nTail',true,false);assert.equal(expanded(),false);
    await render(text+'\n\nTail',false,false);
    assert(panel().textContent.includes('Retained body'));assert.equal(expanded(),false);
  });
  await check('Genuine raw open attribute changes override manual state',async()=>{
    const view=open=>'<details'+(open?' open':'')+'><summary>Attribute</summary>Body</details>';
    await render(view(false),true);await press(trigger());assert.equal(expanded(),true);
    await render(view(true),true,false);assert.equal(expanded(),true);
    await press(trigger());assert.equal(expanded(),false);
    await render(view(true)+'\n\nTail',true,false);assert.equal(expanded(),false);
    await render(view(false),false,false);assert.equal(expanded(),false);
    await render(view(true),false,false);assert.equal(expanded(),true);
  });
  await check('Duplicate sibling titles across blocks and nested details retain distinct choices',async()=>{
    await render(positionalText,true);
    const triggers=()=>[...document.querySelectorAll('[data-slot="disclosure-trigger"]')];
    const states=()=>triggers().map(element=>element.getAttribute('aria-expanded')==='true');
    assert.equal(triggers().length,3);
    await press(triggers()[0]);await press(triggers()[2]);
    assert.deepEqual(states(),[true,false,true]);
    await render(positionalText,false,false);
    assert(document.body.textContent.includes('nested'));assert(document.body.textContent.includes('last'));
    assert.deepEqual(states(),[true,false,true]);
    await press(triggers()[1]);assert.deepEqual(states(),[true,true,true]);
    await press(triggers()[0]);assert.deepEqual(states(),[false,true,true]);
  });
  await check('Disclosure choices are isolated between mounted Markdown providers',async()=>{
    const text='<details><summary>Same</summary>Same body</details>';
    const view=streaming=>h('div',null,...['left','right'].map(id=>h(OfficeMarkdown,{key:id,isStreaming:streaming},text)));
    await settle(()=>root.render(view(true)));
    const states=()=>[...document.querySelectorAll('[data-slot="disclosure-trigger"]')].map(element=>element.getAttribute('aria-expanded')==='true');
    await press(trigger());assert.deepEqual(states(),[true,false]);
    await settle(()=>root.render(view(false)));assert.deepEqual(states(),[true,false]);
  });
  await check('Append-only footnote reordering cannot transfer expansion to a new main disclosure',async()=>{
    for(const mainTitle of ['Main','Footnote']) {
      const before='Reference[^note].\n\n[^note]: <details><summary>Footnote</summary>Footnote body</details>\n';
      const after=before+'\n<details><summary>'+mainTitle+'</summary>Main body</details>\n';
      assert(after.startsWith(before));
      await render(before,false);assert.equal(trigger().textContent.trim(),'Footnote');
      assert(trigger().closest('[data-footnotes]'),'Fixture must render disclosure inside the actual footnote section');
      await press(trigger());assert.equal(expanded(),true);
      await render(after,false,false);
      const triggers=[...document.querySelectorAll('[data-slot="disclosure-trigger"]')];
      assert.deepEqual(triggers.map(node=>node.textContent.trim()),[mainTitle,'Footnote']);
      assert.equal(triggers[0].getAttribute('aria-expanded'),'false','Inserted main disclosure must not inherit footnote state, even with an identical title');
      // Upstream retains the existing footnote instance here; keeping its own
      // local expansion is valid. No cache migration to its new ordinal needed.
      assert.equal(triggers[1].getAttribute('aria-expanded'),'true');
      await press(triggers[1]);assert.equal(triggers[1].getAttribute('aria-expanded'),'false');
      await render(after,true,false);await render(after,false,false);
      assert.deepEqual([...document.querySelectorAll('[data-slot="disclosure-trigger"]')].map(node=>node.getAttribute('aria-expanded')),['false','false']);
    }
  });
  await check('Appending an indistinguishable duplicate resets ambiguous cached expansion',async()=>{
    const text='<details><summary>Duplicate</summary>Body</details>';
    await render(text,false);await press(trigger());assert.equal(expanded(),true);
    await render(text+'\n\n'+text,false,false);
    const triggers=[...document.querySelectorAll('[data-slot="disclosure-trigger"]')];
    assert.equal(triggers.length,2);assert.equal(triggers[1].getAttribute('aria-expanded'),'false');
    await render(text+'\n\n'+text,true,false);await render(text+'\n\n'+text,false,false);
    assert.deepEqual([...document.querySelectorAll('[data-slot="disclosure-trigger"]')].map(node=>node.getAttribute('aria-expanded')),['false','false']);
  });
  await check('Official Markdown root forwards object and React 19 cleanup refs without an extra root wrapper',async()=>{
    const ref={current:null};
    await settle(()=>root.render(h(OfficeMarkdown,{key:'object-root-ref',ref},'Root')));
    assert(ref.current?.matches('[data-office-markdown-root][data-slot="markdown"]'));
    sameNode(ref.current,document.getElementById('root').firstElementChild,'Official root must be the direct child');
    let cleanupCount=0;
    const callback=node=>{assert(node?.matches('[data-slot="markdown"]'));return()=>{cleanupCount++;};};
    await settle(()=>root.render(h(OfficeMarkdown,{key:'callback-root-ref',ref:callback},'Root')));
    assert.equal(ref.current,null);
    await settle(()=>root.render(null));assert.equal(cleanupCount,1);
  });
  await check('Non-append replacement and truncation clear prior disclosure choices',async()=>{
    const a='<details><summary>A</summary>Body A</details>';
    const b='<details><summary>B</summary>Body B</details>';
    await render(a,true);await press(trigger());assert.equal(expanded(),true);
    await render(b,true,false);assert.equal(expanded(),false);assert(panel().textContent.includes('Body B'));
    await press(trigger());await render(b+'\n\nTail',true,false);assert.equal(expanded(),true);
    await render(b,true,false);assert.equal(expanded(),false);
    await render(b,false,false);assert.equal(expanded(),false);
    await press(trigger());await render(b,false,true);assert.equal(expanded(),false);
  });
  await check('Focused trigger is restored on completion and remains keyboard operable',async()=>{
    const text='<details><summary>Focus</summary>Body</details>';
    await render(text,true);await settle(()=>trigger().focus());await key('Enter');assert.equal(expanded(),true);
    await render(text,false,false);
    sameNode(document.activeElement,trigger(),'Completion must restore owned trigger focus');
    assert.equal(expanded(),true);await key(' ');assert.equal(expanded(),false);
    sameNode(document.activeElement,trigger(),'Space must retain trigger focus');
  });
  await check('Focused body link is not redirected to the trigger on completion',async()=>{
    const text='<details open><summary>Link focus</summary><a href="https://example.com/reference">Source link</a></details>';
    await render(text,true);
    const link=panel().querySelector('a');assert(link);
    await settle(()=>link.focus());sameNode(document.activeElement,link,'Fixture must focus the body link');
    await render(text,false,false);
    assert.equal(document.activeElement === trigger(),false,'Link focus must never be redirected to the trigger');
    assert.equal(expanded(),true);assert(panel().querySelector('a').textContent.includes('Source link'));
  });
  await check('Nested disclosure restores its own focus without focusing the outer trigger',async()=>{
    await render(positionalText,true);
    const triggers=()=>[...document.querySelectorAll('[data-slot="disclosure-trigger"]')];
    await press(triggers()[0]);await settle(()=>triggers()[1].focus());await press(triggers()[1]);
    await render(positionalText,false,false);
    sameNode(document.activeElement,triggers()[1],'Completion must restore the nested trigger');
    assert.equal(triggers()[0].getAttribute('aria-expanded'),'true');
    assert.equal(triggers()[1].getAttribute('aria-expanded'),'true');
  });
  await check('Completion does not steal focus from a connected control outside Markdown',async()=>{
    const text='<details><summary>Focus</summary>Body</details>';
    const view=streaming=>h('div',null,h('button',{'data-testid':'outside'},'Outside'),h(OfficeMarkdown,{isStreaming:streaming},text));
    await settle(()=>root.render(view(true)));await press(trigger());
    const outside=document.querySelector('[data-testid="outside"]');await settle(()=>outside.focus());
    await settle(()=>root.render(view(false)));
    sameNode(document.activeElement,outside,'Completion must preserve focus outside Markdown');assert.equal(expanded(),true);
  });
  await check('Pending focus restoration yields to another control focused during completion layout',async()=>{
    const text='<details><summary>Focus</summary>Body</details>';
    function Other({streaming}) {
      const ref=useRef(null);
      useLayoutEffect(()=>{if(!streaming)ref.current.focus();},[streaming]);
      return h('button',{ref,'data-testid':'layout-focus'},'Other');
    }
    const view=streaming=>h('div',null,h(Other,{streaming}),h(OfficeMarkdown,{isStreaming:streaming},text));
    await settle(()=>root.render(view(true)));await settle(()=>trigger().focus());
    await settle(()=>root.render(view(false)));
    sameNode(document.activeElement,document.querySelector('[data-testid="layout-focus"]'),'Pending restore must yield to focus acquired during layout');
  });
  await check('Adapter collapse and streaming updates preserve mounted input state',async()=>{
    let mounts=0;
    function Draft(){useEffect(()=>{mounts++;},[]);return h('input',{'aria-label':'synthetic draft',defaultValue:'initial'});}
    const view=tail=>h(OfficeMarkdownDisclosure,{key:'stable',open:true},h(OfficeMarkdownSummary,null,'标题'),h(Draft),tail);
    await settle(()=>root.render(view('first')));
    const input=document.querySelector('input');input.value='retained draft';
    await press(trigger());await settle(()=>root.render(view('second')));
    assert.equal(expanded(),false);sameNode(document.querySelector('input'),input,'Collapsed update must retain input');
    assert.equal(input.value,'retained draft');assert.equal(mounts,1);
    await key('Enter');assert.equal(expanded(),true);assert.equal(input.value,'retained draft');
  });
  await check('Missing/empty summary has accessible fallback and retains body',async()=>{
    await render('<details><p>没有标题的正文</p></details>');
    assert.equal(trigger().textContent.trim(),'查看详情');assert(panel().textContent.includes('没有标题的正文'));
  });
  await check('No isolated component runtime errors',()=>assert.deepEqual(domErrors,[]));
  console.log(JSON.stringify({success:failures.length===0,checks:checks.length,failed:failures.length,scope:'actual answer renderer + installed HeroUI in jsdom; no Electron or visual acceptance'}));
  if(failures.length)throw new AggregateError(failures.map(({error})=>error),'Markdown disclosure checks failed');
} finally {
  await settle(()=>root.unmount());await server.close();dom.window.close();
}
