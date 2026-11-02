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
const helper=path.join(output,'child.cjs'),bundle=path.join(output,'host.mjs'),entry=path.join(output,'entry.mjs');
fs.writeFileSync(entry,`export * from ${JSON.stringify(path.resolve('src/main/xiaozhi-agent/ocr-host.ts'))};export * from ${JSON.stringify(path.resolve('src/main/assets/material-ai-crop-inspector.ts'))};export * from ${JSON.stringify(path.resolve('src/main/assets/material-ai-crop-quality.ts'))};export * from ${JSON.stringify(path.resolve('src/main/assets/material-ai-crop-ocr-receipt.ts'))};`);
const text='题目：−0.0014 Ω；R₁²，光学🔬。\n原文保持完整。';
fs.writeFileSync(helper,String.raw`
const {setTimeout:pause}=require('node:timers/promises');
let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',async()=>{
 const request=JSON.parse(input),scenario=process.env.OCR_WIRE_CASE,text=${JSON.stringify(text)};
 if(scenario==='wait'){setTimeout(()=>{},60000);return;}
 if(scenario==='overflow'){process.stdout.write(Buffer.alloc(1048577,32));return;}
 if(scenario==='stderr'){process.stderr.write(Buffer.alloc(65537,32));return;}
 if(scenario==='exit'){process.stderr.write('Private contents and path must not be retained');process.exitCode=7;return;}
 if(scenario==='json'){process.stdout.write('Private non-JSON content');return;}
 if(['empty','configuration','parse_failed','too_large','invalid_input'].includes(scenario)){process.stdout.write(JSON.stringify({schemaVersion:'xiaozhi.local-ocr.v1',ok:false,error:scenario}));return;}
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
await build({entryPoints:[entry],outfile:bundle,bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning',plugins:[{name:'controlled-os-worker',setup(b){
 b.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'wire'}));
 b.onResolve({filter:/^node:child_process$/},()=>({path:'child',namespace:'wire'}));
 b.onResolve({filter:/^wire-real-child$/},()=>({path:'node:child_process',external:true}));
 b.onLoad({filter:/.*/,namespace:'wire'},args=>({contents:args.path==='electron'?'export const app={isPackaged:true};export const utilityProcess={};export const nativeImage={createFromBuffer:()=>({getSize:()=>({width:80,height:80}),isEmpty:()=>false,toBitmap:()=>Buffer.alloc(80*80*4,255)})};':`
  import {spawn as ordinary} from 'wire-real-child';
  export function spawn(file,args,options){
   if(file!==${JSON.stringify(file)}||!options.windowsHide)throw Error('Unexpected spawn');
   globalThis.__wireSpawns=(globalThis.__wireSpawns||0)+1;
   const scenario=Array.isArray(globalThis.__wireCase)?globalThis.__wireCase.shift():globalThis.__wireCase;
   const child=ordinary(process.execPath,[${JSON.stringify(helper)}],{...options,env:{...options.env,OCR_WIRE_CASE:scenario}});
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
for(const [scenario,phase]of [['exit','exit'],['json','json'],['engine','schema'],['invalid','utf8'],['parse_failed','worker'],['overflow','stdout_limit'],['stderr','stderr_limit']])await check('Sanitized '+phase+' diagnostic preserves the failure stage',async()=>{globalThis.__wireCase=scenario;await assert.rejects(image(),e=>{assert.equal(e.cause.phase,phase);assert.deepEqual(Object.keys(e.cause).sort(),['exitCode','phase','schemaVersion','signalled','stderrBytes','stdoutBytes']);assert(!JSON.stringify(e.cause).includes('Private'));if(scenario==='exit')assert.equal(e.cause.exitCode,7);return true;});});
const inspect=()=>host.inspectPageCrop(Buffer.from('controlled image'),new AbortController().signal,root);
await check('An ordinary successful crop starts exactly one child',async()=>{globalThis.__wireCase='chinese';const before=globalThis.__wireSpawns,v=await inspect();assert.equal(globalThis.__wireSpawns-before,1);assert.deepEqual(v.ocrAttempts.attempts,[{outcome:'success'}]);assert(host.validCropQuality(v));});
await check('A transient real child failure silently recovers once and retains both outcomes',async()=>{globalThis.__wireCase=['json','chinese'];const before=globalThis.__wireSpawns,v=await inspect();assert.equal(globalThis.__wireSpawns-before,2);assert.equal(v.text,text);assert.deepEqual(v.ocrAttempts.attempts.map(a=>a.outcome),['parse_failed','success']);assert(host.validCropQuality(v));assert.equal(v.ocrAttempts.attempts[0].diagnostic.phase,'json');});
await check('Persistent failures stop after exactly two children with both receipts retained',async()=>{globalThis.__wireCase='parse_failed';const before=globalThis.__wireSpawns;await assert.rejects(inspect(),e=>e.message==='ocr_failed'&&host.validCropOcrAttempts(e.ocrAttempts,'parse_failed'));assert.equal(globalThis.__wireSpawns-before,2);});
await check('A host timeout joins the old child before one bounded recovery',async()=>{globalThis.__wireCase=['wait','chinese'];const ordinary=setTimeout;globalThis.setTimeout=(fn,ms,...a)=>ordinary(fn,ms===45000?500:ms,...a);try{const before=globalThis.__wireSpawns,v=await inspect();assert.equal(globalThis.__wireSpawns-before,2);assert.deepEqual(v.ocrAttempts.attempts.map(a=>a.outcome),['timeout','success']);assert.equal(v.ocrAttempts.attempts[0].diagnostic.phase,'timeout');}finally{globalThis.setTimeout=ordinary;}});
await check('A full shared pool retries busy once without spawning and releases after cancellation',async()=>{globalThis.__wireCase='wait';const controllers=Array.from({length:8},()=>new AbortController()),before=globalThis.__wireSpawns,promises=controllers.map(c=>host.recognizeLocalImage(Buffer.from('controlled'),c.signal,root).catch(e=>e));try{const deadline=Date.now()+5000;while(globalThis.__wireSpawns<before+8){if(Date.now()>deadline)throw Error('Pool not reserved');await new Promise(r=>setTimeout(r,10));}const held=globalThis.__wireSpawns;await assert.rejects(inspect(),e=>e.message==='busy'&&e.ocrAttempts.attempts.length===2);assert.equal(globalThis.__wireSpawns,held);}finally{controllers.forEach(c=>c.abort());await Promise.all(promises);}globalThis.__wireCase='chinese';assert(host.validCropQuality(await inspect()));});
for(const scenario of ['configuration','too_large','invalid_input','empty'])await check('Do not retry permanent or empty '+scenario,async()=>{globalThis.__wireCase=scenario;const before=globalThis.__wireSpawns;if(scenario==='empty'){const v=await inspect();assert.equal(v.text,'');assert(host.validCropQuality(v));}else await assert.rejects(inspect(),e=>e.message==='ocr_failed'&&e.ocrAttempts.attempts.length===1);assert.equal(globalThis.__wireSpawns-before,1);});
await check('Cancellation during backoff never starts the retry child',async()=>{globalThis.__wireCase='json';const abort=new AbortController(),before=globalThis.__wireSpawns,promise=host.inspectPageCrop(Buffer.from('controlled'),abort.signal,root);const deadline=Date.now()+5000;while(globalThis.__wireSpawns===before||!globalThis.__wireClosed){if(Date.now()>deadline)throw Error('Child did not close');await new Promise(r=>setTimeout(r,5));}abort.abort();await assert.rejects(promise,e=>e.message==='cancelled');assert.equal(globalThis.__wireSpawns-before,1);});
await check('Rollback disables retries while keeping the original failure',async()=>{globalThis.__wireCase='json';const old=process.env.OMNI_EDU_CROP_OCR_RETRY;process.env.OMNI_EDU_CROP_OCR_RETRY='0';try{const before=globalThis.__wireSpawns;await assert.rejects(inspect(),e=>e.ocrAttempts.attempts.length===1);assert.equal(globalThis.__wireSpawns-before,1);}finally{if(old===undefined)delete process.env.OMNI_EDU_CROP_OCR_RETRY;else process.env.OMNI_EDU_CROP_OCR_RETRY=old;}});
await check('Attempt validators reject invented success, extra fields and unbounded recovery',async()=>{const v={schemaVersion:host.CROP_OCR_ATTEMPTS_SCHEMA,attempts:[{outcome:'parse_failed'},{outcome:'success'}]};assert(host.validCropOcrAttempts(v,'success'));const sparse=new Array(2);sparse[1]={outcome:'success'};for(const attempts of [sparse,[{outcome:'success'},{outcome:'success'}],[{outcome:'configuration'},{outcome:'success'}],[...v.attempts,{outcome:'success'}],[{outcome:'success',privateText:'secret'}]])assert(!host.validCropOcrAttempts({...v,attempts},'success'));});
await check('Changed compiled runtime fixture is rejected before spawning',async()=>{const count=globalThis.__wireSpawns;fs.writeFileSync(file,'changed');try{await assert.rejects(image(),e=>e.message==='configuration');assert.equal(globalThis.__wireSpawns,count);}finally{fs.writeFileSync(file,locked);}});
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:report.checks.length,failed:report.failures.length,output}));if(!report.ok)process.exitCode=1;
