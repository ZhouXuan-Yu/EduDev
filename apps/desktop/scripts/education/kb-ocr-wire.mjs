// Actual OCR host + OS pipes with a controlled child, not OCR-engine or corpus acceptance.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-ocr-wire-')),root=path.join(output,'ocr-runtime');
fs.mkdirSync(root);const locked=Buffer.from('compiled runtime fixture'),file=path.join(root,'omni-edu-ocr.exe');fs.writeFileSync(file,locked);
const manifest={files:[{path:'omni-edu-ocr.exe',size:locked.length,sha256:createHash('sha256').update(locked).digest('hex')}]};
const helper=path.join(output,'child.cjs'),bundle=path.join(output,'host.mjs');
const text='题目：−0.0014 Ω；R₁²，光学🔬。\n原文保持完整。';
fs.writeFileSync(helper,String.raw`
const {setTimeout:pause}=require('node:timers/promises');
let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',async()=>{
 const request=JSON.parse(input),scenario=process.env.OCR_WIRE_CASE,text=${JSON.stringify(text)};
 if(scenario==='wait'){setTimeout(()=>{},60000);return;}
 if(scenario==='overflow'){process.stdout.write(Buffer.alloc(1048577,32));return;}
 if(scenario==='stderr'){process.stderr.write(Buffer.alloc(65537,32));return;}
 let value={schemaVersion:'xiaozhi.local-ocr.v1',ok:true,engine:scenario==='engine'?'unknown':'rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1',text,lines:2,width:80,height:80,scores:[.98,.97]};
 let body=JSON.stringify(value);
 if(scenario==='pdf')body=JSON.stringify({schemaVersion:'xiaozhi.local-pdf-ocr.v1',kind:'progress',page:1,total:1})+'\n'+JSON.stringify({schemaVersion:'xiaozhi.local-pdf-ocr.v2',kind:'completed',total:1,result:{page:1,text,width:80,height:80}})+'\n'+JSON.stringify({schemaVersion:'xiaozhi.local-pdf-ocr.v1',ok:true,engine:'pdfium-5.14.0-rapidocr-3.9.2.v1',pages:[{page:1,text,width:80,height:80}]});
 let bytes=Buffer.from(body);
 if(scenario==='invalid'){const at=bytes.indexOf(Buffer.from('题'));bytes=Buffer.concat([bytes.subarray(0,at),Buffer.from([255]),bytes.subarray(at+3)]);}
 if(scenario==='truncated'){process.stdout.write(Buffer.concat([bytes,Buffer.from([0xe4,0xb8])]));return;}
 if(scenario==='bom')bytes=Buffer.concat([Buffer.from([239,187,191]),bytes]);
 if(['chinese','emoji','pdf'].includes(scenario)){
  const target=Buffer.from(scenario==='emoji'?'🔬':'题');let cursor=0,start=bytes.indexOf(target);
  while(start>=0){const at=start+(scenario==='emoji'?2:1);process.stdout.write(bytes.subarray(cursor,at));await pause(40);cursor=at;start=scenario==='pdf'?bytes.indexOf(target,start+target.length):-1;}
  process.stdout.write(bytes.subarray(cursor));
 }else process.stdout.write(bytes);
});
`);
execFileSync(process.execPath,['--check',helper],{stdio:'pipe'});
await build({entryPoints:['src/main/xiaozhi-agent/ocr-host.ts'],outfile:bundle,bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning',plugins:[{name:'controlled-os-worker',setup(b){
 b.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'wire'}));
 b.onResolve({filter:/^node:child_process$/},()=>({path:'child',namespace:'wire'}));
 b.onResolve({filter:/^wire-real-child$/},()=>({path:'node:child_process',external:true}));
 b.onLoad({filter:/.*/,namespace:'wire'},args=>({contents:args.path==='electron'?'export const app={isPackaged:true};export const utilityProcess={};':`
  import {spawn as ordinary} from 'wire-real-child';
  export function spawn(file,args,options){
   if(file!==${JSON.stringify(file)}||!options.windowsHide)throw Error('Unexpected spawn');
   globalThis.__wireSpawns=(globalThis.__wireSpawns||0)+1;
   const child=ordinary(process.execPath,[${JSON.stringify(helper)}],{...options,env:{...options.env,OCR_WIRE_CASE:globalThis.__wireCase}});
   globalThis.__wireChild=child;globalThis.__wireClosed=false;globalThis.__wireChunks=[];child.once('close',()=>globalThis.__wireClosed=true);
   child.stdout.on('data',b=>globalThis.__wireChunks.push(b.length));return child;
  }`,loader:'js'}));
 b.onLoad({filter:/[\\/]ocr-runtime-manifest\.json$/},()=>({contents:JSON.stringify(manifest),loader:'json'}));
}}]});
process.resourcesPath=output;
const host=await import(pathToFileURL(bundle)),report={output,ok:true,checks:[],failures:[],scope:'Production OCR host through real OS pipe; worker and compiled-lock manifest are controlled fixtures, not engine/corpus quality.'};
async function check(name,fn){try{await fn();report.checks.push(name);console.log('PASS '+name);}catch(error){report.ok=false;report.failures.push({name,error:String(error.stack)});console.log('FAIL '+name+' '+error.message);}}
const image=()=>host.recognizeLocalImage(Buffer.from('controlled image bytes'),new AbortController().signal,root);
for(const scenario of ['chinese','emoji'])await check('Exact '+scenario+' survives an OS chunk boundary',async()=>{globalThis.__wireCase=scenario;const v=await image();assert.equal(v.text,text);assert(globalThis.__wireChunks.length>=2);});
await check('PDF progress and completed Chinese text survive the same decoder',async()=>{globalThis.__wireCase='pdf';const events=[];const v=await host.recognizeLocalPdf(Buffer.from('%PDF-controlled'),new AbortController().signal,p=>events.push(p));assert.equal(v.pages[0].text,text);assert.equal(events.length,1);});
for(const [scenario,error] of [['invalid','parse_failed'],['truncated','parse_failed'],['bom','parse_failed'],['engine','parse_failed'],['overflow','too_large'],['stderr','too_large']])await check('Reject '+scenario+' without accepting a receipt',async()=>{globalThis.__wireCase=scenario;await assert.rejects(image(),e=>e.message===error);});
await check('Cancel joins the owned child before releasing the slot',async()=>{globalThis.__wireCase='wait';const abort=new AbortController(),promise=host.recognizeLocalImage(Buffer.from('controlled'),abort.signal,root);setTimeout(()=>abort.abort(),60);await assert.rejects(promise,e=>e.message==='cancelled');assert.equal(globalThis.__wireClosed,true);});
await check('Changed compiled runtime fixture is rejected before spawning',async()=>{const count=globalThis.__wireSpawns;fs.writeFileSync(file,'changed');try{await assert.rejects(image(),e=>e.message==='configuration');assert.equal(globalThis.__wireSpawns,count);}finally{fs.writeFileSync(file,locked);}});
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:report.checks.length,failed:report.failures.length,output}));if(!report.ok)process.exitCode=1;
