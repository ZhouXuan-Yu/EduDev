import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {app} from 'electron';
import {LOCAL_OCR_SCHEMA,validLocalOcrReceipt,type LocalOcrReceipt} from '../../shared/xiaozhi-ocr';
import {reserveLocalWorker} from './local-utility-host';
import {OCR_DIAGNOSTIC_SCHEMA,type OcrDiagnostic} from './ocr-diagnostic';
import manifest from './ocr-runtime-manifest.json';
import blocksManifest from './page-blocks-runtime-manifest.json' with {type:'json'};
import {PDF_PAGE_SCHEMA,validPdfPageReceipt,validPageBox,type PdfPageReceipt,type PageBox} from '../../shared/material-page-preview';
import {MATERIAL_PDF_RESUME_SCHEMA,validMaterialOcrPages,validMaterialOcrCompleted,validMaterialOcrProgress,validMaterialPdfOcrResult,type MaterialOcrPage,type MaterialOcrProgress,type MaterialPdfOcrResult} from '../../shared/material-pdf-ocr';
import {materialOcrCheckpoint} from '../assets/material-ocr-checkpoint';
import {PDF_LAYOUT_SCHEMA,validPdfLayout,type PdfLayoutReceipt} from '../../shared/material-layout';
import {PAGE_BLOCKS_SCHEMA,validPageBlocks,type PageBlocksReceipt} from '../../shared/material-page-blocks';

export function ocrRuntimeRoot(includeBlocks=false){
 if(app.isPackaged)return path.join(process.resourcesPath,includeBlocks?'page-blocks-runtime':'ocr-runtime');
 let current=path.dirname(fileURLToPath(import.meta.url));
 for(let level=0;level<10;level++,current=path.dirname(current)){
  const pkg=path.join(current,'package.json');
  try{if(JSON.parse(fs.readFileSync(pkg,'utf8')).name==='omni-edu-desktop-prototype')return path.join(current,'.local-ocr',includeBlocks?'blocks-v1-dist':'file-v3-dist','omni-edu-ocr');}catch{/* Only fixed ancestor application roots. */}
 }
 throw new Error('unavailable');
}
export async function recognizeLocalImage(bytes:Buffer,signal:AbortSignal,ownedRuntimeRoot?:string):Promise<Extract<LocalOcrReceipt,{ok:true}>>{
 return runOcr(bytes,signal,{schema:LOCAL_OCR_SCHEMA,maxInput:4*1048576,maxOutput:1048576,timeout:45000,valid:validLocalOcrReceipt},ownedRuntimeRoot);
}
export async function recognizeLocalPdf(bytes:Buffer,signal:AbortSignal,onProgress:(progress:MaterialOcrProgress)=>void,checkpointRoot?:string):Promise<Extract<MaterialPdfOcrResult,{ok:true}>>{
 if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('invalid_input');
 const checkpoint=checkpointRoot?materialOcrCheckpoint(checkpointRoot,createHash('sha256').update(bytes).digest('hex'),manifest.workerSha256):undefined;
 const pages:MaterialOcrPage[]=checkpoint?.load()??[];
 return runOcr(bytes,signal,{schema:MATERIAL_PDF_RESUME_SCHEMA,maxInput:50*1048576,maxOutput:16*1048576,timeout:300000,valid:validMaterialPdfOcrResult,onProgress,payload:{resumePages:pages.slice()},onCompleted:item=>{
  if(item.result.page!==pages.length+1)throw new Error('parse_failed');
  pages.push(item.result);if(!validMaterialOcrPages(pages))throw new Error('too_large');checkpoint?.save(pages);
 }});
}
export async function renderLocalPdfPage(bytes:Buffer,input:{page:number;box:PageBox},signal:AbortSignal):Promise<Extract<PdfPageReceipt,{ok:true}>>{
 if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!Number.isInteger(input.page)||input.page<1||input.page>50||!validPageBox(input.box))throw new Error('invalid_input');
 return runOcr(bytes,signal,{schema:PDF_PAGE_SCHEMA,maxInput:50*1048576,maxOutput:6*1048576,timeout:45000,valid:validPdfPageReceipt,payload:{page:input.page,box:input.box}});
}
export async function recognizeLocalPdfLayout(bytes:Buffer,page:number,signal:AbortSignal):Promise<Extract<PdfLayoutReceipt,{ok:true}>>{
 if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!Number.isInteger(page)||page<1||page>50)throw new Error('invalid_input');
 return runOcr(bytes,signal,{schema:PDF_LAYOUT_SCHEMA,maxInput:50*1048576,maxOutput:6*1048576,timeout:45000,valid:validPdfLayout,payload:{page}});
}
export async function recognizeLocalPageBlocks(bytes:Buffer,signal:AbortSignal):Promise<Extract<PageBlocksReceipt,{ok:true}>>{
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('invalid_input');
 return runOcr(bytes,signal,{schema:PAGE_BLOCKS_SCHEMA,maxInput:4*1048576,maxOutput:128*1024,timeout:60000,valid:validPageBlocks});
}
async function runOcr<T extends {ok:boolean;error?:string}>(bytes:Buffer,signal:AbortSignal,options:{schema:string;maxInput:number;maxOutput:number;timeout:number;valid:(value:unknown)=>value is T;onProgress?:(progress:MaterialOcrProgress)=>void;onCompleted?:(item:import('../../shared/material-pdf-ocr').MaterialOcrCompleted)=>void;payload?:{page:number;box?:PageBox}|{resumePages:MaterialOcrPage[]}},ownedRuntimeRoot?:string):Promise<Extract<T,{ok:true}>>{
 signal.throwIfAborted();if(!bytes.length||bytes.length>options.maxInput)throw new Error('too_large');
 const root=await verifyOcrRuntime(signal,ownedRuntimeRoot,options.schema===PAGE_BLOCKS_SCHEMA);
 signal.throwIfAborted();const release=reserveLocalWorker();if(!release)throw new Error('busy');
 return new Promise((resolve,reject)=>{
  let stdout='',size=0,stderrSize=0,reason='',settled=false,phase:OcrDiagnostic['phase']='exit',exitCode:number|null=null,signalled=false;
  const failure=(code:string)=>new Error(code,{cause:{schemaVersion:OCR_DIAGNOSTIC_SCHEMA,phase,exitCode,signalled,stdoutBytes:size,stderrBytes:stderrSize} satisfies OcrDiagnostic});
  // Pipe chunks can split a UTF-8 character. Never certify replacement text as OCR.
  const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
  const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].flatMap(key=>process.env[key]?[[key,process.env[key]!]]:[]));
  let child:ReturnType<typeof spawn>;
  try{child=spawn(path.join(root,'omni-edu-ocr.exe'),[],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});}catch{phase='spawn';release();reject(failure('unavailable'));return;}
  const stop=(code:string,stage:OcrDiagnostic['phase'])=>{if(reason||settled)return;reason=code;phase=stage;child.kill();};
  const abort=()=>stop(signal.reason==='timeout'?'timeout':'cancelled',signal.reason==='timeout'?'timeout':'cancelled');
  const timer=setTimeout(()=>stop('timeout','timeout'),options.timeout);
  const finish=(error?:string)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);release();
   if(error||reason||signal.aborted){reject(failure(reason||error||'cancelled'));return;}
   try{stdout+=decoder.decode();}catch{phase='utf8';reject(failure('parse_failed'));return;}
   let value:unknown;try{value=JSON.parse(stdout);}catch{phase='json';reject(failure('parse_failed'));return;}
   if(!options.valid(value)){phase='schema';reject(failure('parse_failed'));return;}
   if(!value.ok){phase='worker';reject(failure(value.error||'parse_failed'));return;}resolve(value as Extract<T,{ok:true}>);
  };
  signal.addEventListener('abort',abort,{once:true});
  child.stdout?.on('data',value=>{if(reason||settled)return;size+=value.length;if(size>options.maxOutput){stop('too_large','stdout_limit');return;}
   try{stdout+=decoder.decode(value,{stream:true});}catch{stop('parse_failed','utf8');return;}
   if(options.onProgress){while(stdout.includes('\n')){const end=stdout.indexOf('\n'),line=stdout.slice(0,end);let item:unknown;
    try{item=JSON.parse(line);}catch{stop('parse_failed','progress');return;}
    if(validMaterialOcrProgress(item)){stdout=stdout.slice(end+1);if(!signal.aborted&&!reason)options.onProgress(item);}
    else if(options.onCompleted&&validMaterialOcrCompleted(item)){stdout=stdout.slice(end+1);if(!signal.aborted&&!reason)try{options.onCompleted(item);}catch{stop('parse_failed','progress');return;}}else break;
   }}
  });
  child.stderr?.on('data',value=>{stderrSize+=value.length;if(stderrSize>65536)stop('too_large','stderr_limit');});
  child.once('error',()=>{phase='spawn';finish('unavailable');});
  child.once('close',(code,signal)=>{exitCode=code;signalled=signal!==null;finish(code===0?undefined:'parse_failed');});
  child.stdin?.on('error',()=>stop('unavailable','stdin'));
  child.stdin?.end(JSON.stringify({schemaVersion:options.schema,parentPid:process.pid,data:bytes.toString('base64'),...options.payload})+'\n');
  if(signal.aborted)abort();
 });
}
/** Compiled resource lock shared by old protocols and the file reader. No runtime manifest trust. */
export async function verifyOcrRuntime(signal:AbortSignal,ownedRuntimeRoot?:string,includeBlocks=false){
 const root=ownedRuntimeRoot??ocrRuntimeRoot(includeBlocks);if(!path.isAbsolute(root)||!fs.existsSync(root)||fs.lstatSync(root).isSymbolicLink())throw new Error('unavailable');
 // Compiled application lock, not an attacker-supplied manifest next to an executable.
 try{for(const file of (includeBlocks?blocksManifest:manifest).files){
  signal.throwIfAborted();const target=path.join(root,file.path);let cursor=root;
  for(const piece of file.path.split('/')){cursor=path.join(cursor,piece);if((await fs.promises.lstat(cursor)).isSymbolicLink())throw new Error('configuration');}
  const stat=await fs.promises.stat(target);if(!stat.isFile()||stat.size!==file.size||createHash('sha256').update(await fs.promises.readFile(target)).digest('hex')!==file.sha256)throw new Error('configuration');
 }}catch(error){if(signal.aborted)throw Error('cancelled');if(includeBlocks)throw Error('configuration');throw error;}
 signal.throwIfAborted();return root;
}
