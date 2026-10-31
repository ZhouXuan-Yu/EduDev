import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {reserveLocalWorker} from '../local-utility-host';
import {readMaterialOriginal} from '../../assets/material-original';
import type {DocumentMetrics,CheckFinding,OfficeCheckEngine} from '../../../shared/xiaozhi-delivery-checks';
import {POWERPOINT_RENDER_SCRIPT} from './powerpoint-script';
import {visualMetadata} from './visual-evidence';
import {clearOfficeStage} from './office-stage';

export const POWERPOINT_RENDER_SCHEMA='xiaozhi.powerpoint-render.v1';
export const POWERPOINT_LIMITS={inputBytes:16*1048576,pages:64,totalBytes:96*1048576,timeout:45000};
let running=false;
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export type PowerPointRender={pages:number[];captures:{bytes:Buffer;page:number;kind:'office_page';viewport:string}[];findings:CheckFinding[];engine:string};
/** Only actual parsed PPTX snapshots, no caller path, command, Office edits or model-authored image proof. */
export async function renderPowerPoint(bytes:Buffer,metrics:DocumentMetrics,options:{dataRoot:string;signal:AbortSignal;officeEngine?:OfficeCheckEngine}):Promise<PowerPointRender>{
 const {signal}=options;signal.throwIfAborted();
 if(metrics.format!=='pptx'||!metrics.pageCount||metrics.pageCount>64||bytes.length>POWERPOINT_LIMITS.inputBytes)throw Error('unsupported');
 if(metrics.externalLinks||metrics.nativeRenderBlocked)throw Error('external_content');
 if(process.platform!=='win32')throw Error('unavailable');if(running)throw Error('busy');
 const release=reserveLocalWorker();if(!release)throw Error('busy');running=true;let folder='';
 try{
  let base=path.resolve(options.dataRoot);if(!path.isAbsolute(options.dataRoot))throw Error('unavailable');
  for(const part of ['', 'cache','delivery-office','v1']){
   if(part){base=path.join(base,part);await fs.mkdir(base).catch(e=>{if(e.code!=='EEXIST')throw e;});}
   const s=await fs.lstat(base);if(!s.isDirectory()||s.isSymbolicLink()||(await fs.realpath(base)).toLowerCase()!==base.toLowerCase())throw Error('unavailable');
  }
  folder=await fs.mkdtemp(path.join(base,'render-'));
  await fs.writeFile(path.join(folder,'input.pptx'),bytes,{flag:'wx'});
  await fs.writeFile(path.join(folder,'request.json'),JSON.stringify({pages:metrics.pageCount,fonts:metrics.fonts||[],officeEngine:options.officeEngine||'auto'}),{flag:'wx'});signal.throwIfAborted();
  const result=await new Promise<unknown>((resolve,reject)=>{
   const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
   const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(POWERPOINT_RENDER_SCRIPT,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...env,XIAOZHI_RENDER_ROOT:folder}});
   let output='',failure='';
   const stop=(code:string)=>{failure=code;child.kill();};
   const abort=()=>stop(signal.reason==='timeout'?'timeout':'cancelled'),timer=setTimeout(()=>stop('timeout'),POWERPOINT_LIMITS.timeout);
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
   child.stdout.on('data',chunk=>{output+=String(chunk);if(output.length>65536)stop('too_large');});child.stderr.on('data',()=>{});
   const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
   child.once('error',()=>{cleanup();reject(Error('unavailable'));});
   // Process slot and staging cleanup remain held until actual helper exit, not a cancellation receipt.
   child.once('close',()=>{cleanup();if(failure){reject(Error(failure));return;}try{resolve(JSON.parse(output.trim()));}catch{reject(Error('unavailable'));}});
  });signal.throwIfAborted();
  const value=result as {schemaVersion?:unknown;ok?:unknown;error?:unknown;pages?:unknown;width?:unknown;height?:unknown;version?:unknown;engine?:unknown;findings?:unknown};
  if(value.schemaVersion!==POWERPOINT_RENDER_SCHEMA||value.ok!==true)throw Error(['busy','too_large','unsupported','page_count_changed'].includes(String(value.error))?String(value.error):'unavailable');
  if(value.pages!==metrics.pageCount||!Number.isInteger(value.width)||!Number.isInteger(value.height)||Number(value.width)<16||Number(value.width)>1600||Number(value.height)<16||Number(value.height)>1600||!['PowerPoint','WPS Presentation'].includes(String(value.engine))||typeof value.version!=='string'||!/^[\d.]{1,40}$/.test(value.version)||!Array.isArray(value.findings)||value.findings.length>128)throw Error('unavailable');
  const engine=`${value.engine} ${value.version}`,findings:CheckFinding[]=[];
  for(const item of value.findings as {code:string;page:number;font?:string}[]){
   if(!item||!['font_missing','rendered_text_outside','rendered_text_overflow'].includes(item.code)||!Number.isInteger(item.page)||item.page<0||item.page>metrics.pageCount||item.font!==undefined&&(typeof item.font!=='string'||item.font.length>200))throw Error('unavailable');
   findings.push({kind:'visual',state:'failed',code:item.code,...(item.page?{page:item.page}:{}),message:item.code==='font_missing'?`本机未安装文件声明的字体“${item.font}”；页面可能使用替代字体，不能判定原字体视觉通过。`:item.code==='rendered_text_outside'?`${engine}实际排版的文字边界超出页面。`:`${engine}实际排版的文字高度超出文本框，请核对截图中的裁切或遮挡。`});
  }
  const captures:PowerPointRender['captures']=[];let total=0;
  for(let page=1;page<=metrics.pageCount;page++){
   signal.throwIfAborted();const file=path.join(folder,`page-${page}.png`),s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>3*1048576||(total+=s.size)>POWERPOINT_LIMITS.totalBytes)throw Error('too_large');
   const buffer=await fs.readFile(file);await readMaterialOriginal(folder,file,hash(buffer),signal,3*1048576);
   const proof=visualMetadata(buffer,{page,kind:'office_page'});if(proof.width!==value.width||proof.height!==value.height)throw Error('unavailable');
   captures.push({bytes:buffer,page,kind:'office_page',viewport:`${proof.width}x${proof.height}`});
  }
  if(hash(await fs.readFile(path.join(folder,'input.pptx')))!==hash(bytes))throw Error('changed');signal.throwIfAborted();
  findings.push({kind:'visual',state:'unchecked',code:'actual_office_rendered',message:`${engine}已实际渲染全部${captures.length}页并核对文字边界；截图可查看。语义遮挡、逐字缺字及动画效果仍未完整验证。`});
  return{pages:captures.map(c=>c.page),captures,findings,engine};
 }finally{
  await clearOfficeStage(folder,['input.pptx','request.json','owned.json']);
  running=false;release();
 }
}
