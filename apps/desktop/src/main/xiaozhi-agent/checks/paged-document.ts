import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {reserveLocalWorker} from '../local-utility-host';
import {readMaterialOriginal} from '../../assets/material-original';
import type {DocumentMetrics,CheckFinding} from '../../../shared/xiaozhi-delivery-checks';
import {PAGED_DOCUMENT_SCRIPT} from './paged-document-script';
import {visualMetadata} from './visual-evidence';

export const PAGED_RENDER_LIMITS={inputBytes:16*1048576,pages:64,totalBytes:96*1048576,timeout:60000,wordTimeout:15000};
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
let running=false;
export type PagedDocumentRender={pages:number[];captures:{bytes:Buffer;page:number;kind:'pdf_page'|'office_page';viewport:string}[];
 findings:CheckFinding[];engine:string;pdfBytes?:Buffer};
export async function renderPagedDocument(bytes:Buffer,metrics:DocumentMetrics,options:{dataRoot:string;signal:AbortSignal}):Promise<PagedDocumentRender>{
 const {signal}=options;signal.throwIfAborted();const format=metrics.format;
 if(!['pdf','docx'].includes(format)||!bytes.length||bytes.length>PAGED_RENDER_LIMITS.inputBytes||format==='pdf'&&(!metrics.pageCount||metrics.pageCount>64))throw Error('unsupported');
 if(metrics.externalLinks||metrics.nativeRenderBlocked)throw Error('external_content');
 if(process.platform!=='win32')throw Error('unavailable');if(running)throw Error('busy');
 const release=reserveLocalWorker();if(!release)throw Error('busy');running=true;let folder='';
 try{
  let base=path.resolve(options.dataRoot);if(!path.isAbsolute(options.dataRoot))throw Error('unavailable');
  for(const part of ['', 'cache','delivery-paged','v1']){
   if(part){base=path.join(base,part);await fs.mkdir(base).catch(e=>{if(e.code!=='EEXIST')throw e;});}
   const s=await fs.lstat(base);if(!s.isDirectory()||s.isSymbolicLink()||(await fs.realpath(base)).toLowerCase()!==base.toLowerCase())throw Error('unavailable');
  }
  folder=await fs.mkdtemp(path.join(base,'render-'));const input=path.join(folder,'input.'+format);
  await fs.writeFile(input,bytes,{flag:'wx'});
  await fs.writeFile(path.join(folder,'request.json'),JSON.stringify({format,pages:metrics.pageCount,fonts:metrics.fonts||[]}),{flag:'wx'});signal.throwIfAborted();
  const result=await new Promise<unknown>((resolve,reject)=>{
   const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
   const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(PAGED_DOCUMENT_SCRIPT,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...env,XIAOZHI_RENDER_ROOT:folder}});
   let output='',failure='';
   const stop=(code:string)=>{failure=code;child.kill();},abort=()=>stop(signal.reason==='timeout'?'timeout':'cancelled'),timer=setTimeout(()=>stop('timeout'),format==='docx'?PAGED_RENDER_LIMITS.wordTimeout:PAGED_RENDER_LIMITS.timeout);
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
   child.stdout.on('data',chunk=>{output+=String(chunk);if(output.length>65536)stop('too_large');});child.stderr.on('data',()=>{});
   const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
   child.once('error',()=>{cleanup();reject(Error('unavailable'));});
   child.once('close',()=>{cleanup();if(failure){reject(Error(failure));return;}try{resolve(JSON.parse(output.trim()));}catch{reject(Error('unavailable'));}});
  });signal.throwIfAborted();
  const value=result as {schemaVersion?:unknown;ok?:unknown;error?:unknown;pages?:unknown;engine?:unknown;findings?:unknown};
  if(value.schemaVersion!=='xiaozhi.paged-render.v1'||value.ok!==true)throw Error(['busy','too_large','unsupported','page_count_changed'].includes(String(value.error))?String(value.error):'unavailable');
  if(!Array.isArray(value.pages)||!value.pages.length||value.pages.length>64||format==='pdf'&&value.pages.length!==metrics.pageCount||typeof value.engine!=='string'||!/^(?:Word [\d.]{1,40} \/ )?Windows\.Data\.Pdf$/.test(value.engine)||!Array.isArray(value.findings)||value.findings.length>128)throw Error('unavailable');
  const findings:CheckFinding[]=[],captures:PagedDocumentRender['captures']=[];
  for(const item of value.findings as {code:string;font:string}[]){
   if(!item||item.code!=='font_missing'||typeof item.font!=='string'||!item.font.length||item.font.length>200)throw Error('unavailable');
   findings.push({kind:'visual',state:'failed',code:'font_missing',message:`本机未安装文件声明的字体“${item.font}”；实际页面可能使用替代字体。`});
  }
  let total=0;
  for(const [index,item] of (value.pages as {page:number;width:number;height:number}[]).entries()){
   if(!item||item.page!==index+1||![item.width,item.height].every(n=>Number.isInteger(n)&&n>=16&&n<=4096))throw Error('unavailable');
   signal.throwIfAborted();const file=path.join(folder,`page-${item.page}.png`),stat=await fs.lstat(file);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>3*1048576||(total+=stat.size)>PAGED_RENDER_LIMITS.totalBytes)throw Error('too_large');
   const buffer=await fs.readFile(file);await readMaterialOriginal(folder,file,hash(buffer),signal,3*1048576);
   const kind=format==='pdf'?'pdf_page' as const:'office_page' as const,proof=visualMetadata(buffer,{page:item.page,kind});if(proof.width!==item.width||proof.height!==item.height)throw Error('unavailable');
   captures.push({bytes:buffer,page:item.page,kind,viewport:`${proof.width}x${proof.height}`});
  }
  let pdfBytes:Buffer|undefined;
  if(format==='docx'){
   const file=path.join(folder,'input.pdf'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>16*1048576)throw Error('too_large');
   pdfBytes=await fs.readFile(file);await readMaterialOriginal(folder,file,hash(pdfBytes),signal,16*1048576);if(!pdfBytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('unavailable');
  }
  if(hash(await fs.readFile(input))!==hash(bytes))throw Error('changed');signal.throwIfAborted();
  findings.push({kind:'visual',state:'unchecked',code:'actual_paged_rendered',message:`${value.engine}已实际渲染全部${captures.length}页，截图可查看；缺字、公式字形、裁切与语义遮挡仍需核对，未据此判定视觉全通过。`});
  return{pages:captures.map(c=>c.page),captures,findings,engine:value.engine,...(pdfBytes?{pdfBytes}:{})};
 }finally{
  if(folder){
   // A Job close initiates Word shutdown; its file handles can outlive the helper's close event.
   const pending=new Set(['input.docx','input.pdf','request.json','owned.json',...Array.from({length:64},(_,i)=>`page-${i+1}.png`)]),deadline=Date.now()+2000;
   while(pending.size){
    for(const name of pending)try{await fs.unlink(path.join(folder,name));pending.delete(name);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')pending.delete(name);}
    if(!pending.size||Date.now()>=deadline)break;
    await new Promise(resolve=>setTimeout(resolve,50));
   }
   await fs.rmdir(folder).catch(()=>{});
  }
  running=false;release();
 }
}
