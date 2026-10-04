import '../office-agent/register-source.mjs';
import {registerHooks} from 'node:module';import {EventEmitter} from 'node:events';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const children=[];
class Child extends EventEmitter{
  stderr=new EventEmitter();stdout=new EventEmitter();started=false;kills=0;
  postMessage(request){this.request=request;}
  kill(){this.kills++;return this.started;}
  spawn(){this.started=true;this.emit('spawn');}
}
globalThis.documentTestUtility={fork:(entry,args,options)=>{assert(!Object.keys(options.env).some(x=>/KEY|TOKEN|SECRET/i.test(x)));const child=new Child();children.push(child);return child;}};
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return {url:'data:text/javascript,export const utilityProcess=globalThis.documentTestUtility;',shortCircuit:true};return next(specifier,context);}});
const {extractLocalDocument}=await import('../../src/main/xiaozhi-agent/document-host.ts');
const request=()=>({schemaVersion:'xiaozhi.document.v1',requestId:`xifile_${randomUUID()}`,filename:'合成.docx',bytes:new Uint8Array([1])});
const controllers=Array.from({length:8},()=>new AbortController()),jobs=controllers.map(controller=>extractLocalDocument(request(),controller.signal));
assert.equal(children.length,8);assert.equal((await extractLocalDocument(request(),new AbortController().signal)).error,'busy');
controllers[0].abort();assert.equal((await jobs[0]).error,'cancelled');assert.equal(children[0].kills,1);
assert.equal((await extractLocalDocument(request(),new AbortController().signal)).error,'busy');
children[0].spawn();assert.equal(children[0].kills,2);children[0].emit('exit',0);children[0].emit('exit',0);
const next=extractLocalDocument(request(),new AbortController().signal);assert.equal(children.length,9);
for(const child of children.slice(1)){child.spawn();child.emit('message',{ok:true,schemaVersion:'xiaozhi.document.v1',requestId:'wrong',format:'docx',markdown:'PRIVATE BODY',parser:'hana-anydoc-0.1.2',warnings:[]});child.emit('exit',0);}
for(const result of await Promise.all([...jobs.slice(1),next])){assert.equal(result.error,'parse_failed');assert(!JSON.stringify(result).includes('PRIVATE BODY'));}
const invalid=await extractLocalDocument({...request(),filename:'../out.docx'},new AbortController().signal);assert.equal(invalid.error,'unsupported');assert.equal(children.length,9);
console.log(JSON.stringify({passed:4,total:4,scope:'Actual host logic with transport doubles: 8-slot limit, release only on exit, early-abort late-spawn kill, strict result fail closed. Not native extraction or actual OS crash proof.'}));
