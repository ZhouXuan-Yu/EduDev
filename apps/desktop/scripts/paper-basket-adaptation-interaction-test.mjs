import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {fixture, deferred, ownerA, basketId} from './acceptance/paper-basket-renderer-fixture.mjs';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'http://localhost', pretendToBeVisual: true});
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement',
  'HTMLButtonElement', 'HTMLSelectElement', 'Document', 'NodeFilter', 'Element', 'Node', 'Event', 'MouseEvent',
  'PointerEvent', 'KeyboardEvent', 'SVGElement', 'getComputedStyle', 'localStorage', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
dom.window.Element.prototype.getAnimations = () => [];
globalThis.matchMedia = dom.window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {createRoot} = await import('react-dom/client');
const {act} = React;
const server = await createServer({configFile: false, appType: 'custom', optimizeDeps: {noDiscovery: true},
  server: {middlewareMode: true, hmr: false, ws: false, watch: null}});
const run = async (fn = () => {}) => act(async () => {await fn(); await new Promise(resolve => setTimeout(resolve, 10));});
const find = id => document.querySelector(`[data-testid="${id}"]`);
const press = element => run(() => {
  assert(element, 'missing press target');
  for (const type of ['pointerdown', 'pointerup']) element.dispatchEvent(new window.PointerEvent(type,
    {pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, bubbles: true, cancelable: true}));
  element.dispatchEvent(new window.MouseEvent('click', {button: 0, detail: 1, bubbles: true, cancelable: true}));
});
const edit = (id, value) => run(() => {
  const element = find(id); assert(element);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new window.Event('input', {bubbles: true}));
});

let root,loads=0,allow=false,state;const accepts=[];
const {PaperEntryAdaptation}=await server.ssrLoadModule('/src/renderer/components/paper-ui/PaperEntryAdaptation.tsx');
const basket={id:basketId,sessionId:ownerA,revision:2,entries:[]};
const view={intentId:'intent_unit',input:{sessionId:ownerA,studentId:'',basketId,entryId:'entry',requirements:'指定要求',intent:'replace'},status:'prepared',current:true,generationStarted:false,prompt:'exact frozen prompt',candidates:[]};
const api={listPaperBasketAdaptations:async()=>({ok:true,value:[structuredClone(view)]}),readPaperBasketAdaptation:async()=>({ok:true,value:structuredClone(view)}),acceptPaperBasketAdaptation:async input=>{accepts.push(input);if(accepts.length===1)throw Error('transport');return {ok:true,value:{basketRevision:3,questionId:'saved',entryId:'entry'}};}};
const props={basket,studentId:'',entryId:'entry',api,onRequestPi:async()=>{loads++;return allow;},onChanged:()=>{},onDirtyChange:dirty=>{props.dirty=dirty;}};
try{
 root=createRoot(document.getElementById('root'));await run(()=>root.render(React.createElement(PaperEntryAdaptation,props)));await run();await press(document.querySelector('[data-testid="paper-entry-adaptation"] button'));
 assert(find('paper-adaptation-requirements'));assert(find('paper-adaptation-intent'));assert(find('paper-adaptation-intent').tagName==='BUTTON');
 await press(find('paper-adaptation-send'));assert.equal(loads,1);assert(!find('paper-adaptation-send').disabled);assert(document.body.textContent.includes('未载入会话'));
 await run(()=>{const e=find('paper-adaptation-requirements');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(e,'未保存的新要求');e.dispatchEvent(new window.Event('input',{bubbles:true}));});assert(props.dirty);assert(find('paper-adaptation-send').disabled);await press(find('paper-adaptation-revert'));assert(!props.dirty);console.log('PASS unsaved requirements signal entry guard and explicit revert clears it');
 allow=true;await press(find('paper-adaptation-send'));assert.equal(loads,2);assert(find('paper-adaptation-send').disabled);console.log('PASS official controls + denied navigation retry + mark loaded only after success');
 await run(()=>root.render(null));view.generationStarted=true;await run(()=>root.render(React.createElement(PaperEntryAdaptation,props)));await run();await press(document.querySelector('[data-testid="paper-entry-adaptation"] button'));assert(find('paper-adaptation-send').disabled);assert.equal(loads,2);console.log('PASS cold restore actual run prevents new dispatch');
 await run(()=>root.render(null));const pendingList=deferred();const delayedApi={...api,listPaperBasketAdaptations:()=>pendingList.promise};
 await run(()=>root.render(React.createElement(PaperEntryAdaptation,{...props,api:delayedApi})));await press(document.querySelector('[data-testid="paper-entry-adaptation"] button'));assert(find('paper-adaptation-requirements').disabled);assert(find('paper-adaptation-intent').disabled);assert(props.dirty);
 await run(()=>pendingList.resolve({ok:true,value:[]}));assert(!find('paper-adaptation-requirements').disabled);assert(!props.dirty);console.log('PASS delayed empty list locks inputs then clears restoring dirty notification');
 const {usePaperEntryAdaptation}=await server.ssrLoadModule('/src/renderer/components/paper-ui/usePaperEntryAdaptation.ts');function Probe(){state=usePaperEntryAdaptation(basket,'','entry',api,()=>{});return null;}
 await run(()=>root.render(React.createElement(Probe)));await run();await run(()=>state.accept('candidate','a'.repeat(64)));assert(state.retryable);await run(()=>state.retry());assert.equal(accepts.length,2);assert.deepEqual(accepts[0],accepts[1]);assert.equal(state.view.status,'accepted');console.log('PASS uncertain accept retries same request without generation');
}finally{if(root)await run(()=>root.unmount());await server.close();dom.window.close();}
