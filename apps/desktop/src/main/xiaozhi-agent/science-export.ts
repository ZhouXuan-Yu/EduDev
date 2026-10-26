import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {withFileMutationQueue} from '@earendil-works/pi-coding-agent';
import {createWorkspaceFiles,validFileRequest,fileVersion,type WorkspaceLease} from './workspace-files';
import {approvedFile} from './workspace-authority';
import {SCIENCE_EXPORT_SCHEMA,type ScienceExportInput,type ScienceExportResult} from '../../shared/science-export';
import {XIAOZHI_FILE_ERRORS,type XiaozhiPreviewInput,type XiaozhiFileError} from '../../shared/xiaozhi-files';
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export type PowerPointMergeProof={targetSlides:number;generatedSlides:number;totalSlides:number};
/** Runs in a fresh hidden PowerPoint instance. Paths enter through environment
 * variables, never shell interpolation, and the input decks are never saved. */
export function mergePowerPointCopy(source:string,target:string,destination:string,signal:AbortSignal):Promise<PowerPointMergeProof>{
 if(process.platform!=='win32')return Promise.reject(Error('powerpoint_unavailable'));
 const script=String.raw`
$ErrorActionPreference='Stop'
$app=$null
$source=$null
$deck=$null
$verify=$null
try {
  $app=New-Object -ComObject PowerPoint.Application
  $source=$app.Presentations.Open($env:XIAOZHI_MERGE_SOURCE,$true,$false,$false)
  $deck=$app.Presentations.Open($env:XIAOZHI_MERGE_TARGET,$false,$false,$false)
  $sourceSlides=[int]$source.Slides.Count
  $targetSlides=[int]$deck.Slides.Count
  if($sourceSlides -lt 1 -or $targetSlides -lt 1){throw 'empty_presentation'}
  $start=$targetSlides
  $inserted=[int]$deck.Slides.InsertFromFile($env:XIAOZHI_MERGE_SOURCE,$start,1,$sourceSlides)
  if($inserted -ne $sourceSlides){throw 'insert_count_mismatch'}
  $deck.SaveAs($env:XIAOZHI_MERGE_OUTPUT,24)
  $total=[int]$deck.Slides.Count
  if($total -ne ($targetSlides+$sourceSlides)){throw 'merged_count_mismatch'}
  $deck.Close()
  $deck=$null
  $verify=$app.Presentations.Open($env:XIAOZHI_MERGE_OUTPUT,$true,$false,$false)
  if([int]$verify.Slides.Count -ne $total){throw 'reopen_count_mismatch'}
  $verify.Close()
  $verify=$null
  Write-Output (ConvertTo-Json -Compress -InputObject ([ordered]@{targetSlides=$targetSlides;generatedSlides=$sourceSlides;totalSlides=$total}))
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 23
} finally {
  if($source){try{$source.Close()}catch{}}
  if($deck){try{$deck.Close()}catch{}}
  if($verify){try{$verify.Close()}catch{}}
  if($app){try{$app.Quit()}catch{}}
}`;
 return new Promise((resolve,reject)=>{
  const encoded=Buffer.from(script,'utf16le').toString('base64');
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',encoded],{
   windowsHide:true,stdio:['ignore','pipe','pipe'],
   env:{...process.env,XIAOZHI_MERGE_SOURCE:source,XIAOZHI_MERGE_TARGET:target,XIAOZHI_MERGE_OUTPUT:destination}
  });
  let stdout='',stderr='',settled=false;
  const finish=(error?:Error,value?:PowerPointMergeProof)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve(value!);};
  const abort=()=>{try{child.kill();}catch{}finish(Error('cancelled'));};
  const timer=setTimeout(()=>{try{child.kill();}catch{}finish(Error('timeout'));},60000);
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
  child.stdout.on('data',chunk=>{if(stdout.length<65536)stdout+=String(chunk).slice(0,65536-stdout.length);});
  child.stderr.on('data',chunk=>{if(stderr.length<16384)stderr+=String(chunk).slice(0,16384-stderr.length);});
  child.once('error',error=>finish(Error((error as NodeJS.ErrnoException).code==='ENOENT'?'powerpoint_unavailable':'powerpoint_merge_failed')));
  child.once('exit',code=>{
   if(code!==0){const error=Error('powerpoint_merge_failed');(error as Error & {cause?:unknown}).cause=stderr.trim().slice(0,1024);finish(error);return;}
   try{
    const line=stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)!;
    const value=JSON.parse(line) as PowerPointMergeProof;
    if(!Number.isInteger(value.targetSlides)||!Number.isInteger(value.generatedSlides)||!Number.isInteger(value.totalSlides)
      ||value.targetSlides<1||value.generatedSlides<1||value.totalSlides!==value.targetSlides+value.generatedSlides)throw Error('invalid');
    finish(undefined,value);
   }catch{finish(Error('powerpoint_merge_failed'));}
  });
 });
}
export function scienceExportRequest(raw:unknown):raw is ScienceExportInput {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const {format,...input}=raw as ScienceExportInput;
 return (format==='pptx'||format==='gif'||format==='pptx_merge')&&validFileRequest(input,true)&&/\.html$/i.test(input.path);
}
/** Explicit teacher export, separate from model approvals. Rechecks the saved
 * source and current workspace, uses an exclusive new output, never overwrites. */
export function createScienceExport(options:{resolve:(id:string)=>Promise<WorkspaceLease>;
  generate?:(html:string,format:'pptx'|'gif',signal:AbortSignal)=>Promise<{bytes:Buffer;frames:number;slides:number}>;
  chooseMergeTarget?:(sessionId:string)=>Promise<string|undefined>;
  merge?:(source:string,target:string,destination:string,signal:AbortSignal)=>Promise<PowerPointMergeProof>;
}) {
 const files=createWorkspaceFiles(options.resolve);let busy=false;
 return async(raw:unknown,signal:AbortSignal):Promise<ScienceExportResult>=>{
  const fail=(error:XiaozhiFileError):ScienceExportResult=>({ok:false,schemaVersion:SCIENCE_EXPORT_SCHEMA,error});
  if(!scienceExportRequest(raw))return fail('invalid_input');if(busy)return fail('busy');busy=true;
   const {format,...input}=raw;let temporary:string|undefined,temporaryCopy:string|undefined,temporaryMerged:string|undefined;
  try{
   signal.throwIfAborted();const lease=await options.resolve(input.sessionId);if(lease.version!==input.workspaceVersion)throw Error('changed');
   const before=await files.preview(input,signal);if(!before.ok)return fail(before.error);if(before.data.format!=='science_demo'||!before.data.html)throw Error('unsupported');
   const sourceHash=sha(before.data.html);
    const generate=options.generate||(await import('./science-ppt')).scienceClassroomMedia;
    const media=await generate(before.data.html,format==='pptx_merge'?'pptx':format,signal);signal.throwIfAborted();
   if(!Buffer.isBuffer(media.bytes)||!media.bytes.length||media.bytes.length>24*1048576||media.frames<2||media.frames>82)throw Error('too_large');
   const after=await files.preview(input,signal);if(!after.ok)return fail(after.error);if(!after.data.html||sha(after.data.html)!==sourceHash)throw Error('changed');
   const current=await options.resolve(input.sessionId);if(current.path!==lease.path||current.version!==lease.version)throw Error('changed');signal.throwIfAborted();
    const stem=path.posix.basename(input.path,'.html').slice(0,80),directory=path.posix.dirname(input.path);
    const suffix=format==='pptx'?'课堂课件':format==='gif'?'演示动图':'课堂课件合并';
    const extension=format==='gif'?'gif':'pptx';
    const name=`${stem}-${suffix}-${input.requestId.slice(7,15)}.${extension}`;
   const relative=directory==='.'?name:directory+'/'+name,destination=approvedFile(lease.path,relative);
   return await withFileMutationQueue(destination,async()=>{
    signal.throwIfAborted();const last=await files.preview(input,signal);if(!last.ok)return fail(last.error);if(!last.data.html||sha(last.data.html)!==sourceHash)throw Error('changed');
    const active=await options.resolve(input.sessionId);if(active.path!==lease.path||active.version!==lease.version)throw Error('changed');
    // No await from this last authority check through the exclusive install.
    signal.throwIfAborted();const source=approvedFile(lease.path,input.path);approvedFile(lease.path,relative);
    const stat=fs.lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||fileVersion(stat)!==input.version)throw Error('changed');
    if(fs.existsSync(destination))throw Error('changed');
     const tempBase=path.posix.join(directory,`.xiaozhi-science-${input.requestId}`);
     temporary=approvedFile(lease.path,tempBase+`.${extension}`);
     const handle=fs.openSync(temporary,'wx',0o600);try{fs.writeFileSync(handle,media.bytes);fs.fsyncSync(handle);}finally{fs.closeSync(handle);}
     const digest=sha(fs.readFileSync(temporary));if(digest!==sha(media.bytes))throw Error('read_failed');
     if(format!=='pptx_merge'){
      fs.linkSync(temporary,destination);fs.unlinkSync(temporary);temporary=undefined;
      return {ok:true,schemaVersion:SCIENCE_EXPORT_SCHEMA,data:{requestId:input.requestId,path:relative,format,bytes:media.bytes.length,sha256:digest,frames:media.frames,slides:media.slides}};
     }
     const selected=await options.chooseMergeTarget?.(input.sessionId);if(!selected)throw Error('cancelled');
     const targetRelative=path.relative(lease.path,path.resolve(selected));if(!targetRelative||targetRelative.startsWith('..')||path.isAbsolute(targetRelative)||!/\.pptx$/i.test(targetRelative))throw Error('permission_denied');
     const target=approvedFile(lease.path,targetRelative.replace(/\\/g,'/')),targetStat=fs.lstatSync(target);
     if(!targetStat.isFile()||targetStat.isSymbolicLink()||targetStat.nlink!==1||targetStat.size>64*1048576)throw Error('permission_denied');
     const targetHash=sha(fs.readFileSync(target));
     temporaryCopy=approvedFile(lease.path,tempBase+'-target.pptx');fs.copyFileSync(target,temporaryCopy,fs.constants.COPYFILE_EXCL);
     if(sha(fs.readFileSync(temporaryCopy))!==targetHash)throw Error('changed');
     temporaryMerged=approvedFile(lease.path,tempBase+'-merged.pptx');
     const merge=options.merge||mergePowerPointCopy;
     const proof=await merge(temporary,temporaryCopy,temporaryMerged,signal);signal.throwIfAborted();
     if(sha(fs.readFileSync(target))!==targetHash||sha(fs.readFileSync(temporary))!==digest||!fs.existsSync(temporaryMerged))throw Error('changed');
     const mergedBytes=fs.readFileSync(temporaryMerged),mergedHash=sha(mergedBytes);
     if(!mergedBytes.length||mergedBytes.length>128*1048576||proof.totalSlides!==proof.targetSlides+proof.generatedSlides||proof.generatedSlides!==media.slides)throw Error('read_failed');
     if(fs.existsSync(destination))throw Error('changed');
     fs.renameSync(temporaryMerged,destination);temporaryMerged=undefined;
     return {ok:true,schemaVersion:SCIENCE_EXPORT_SCHEMA,data:{requestId:input.requestId,path:relative,format,bytes:mergedBytes.length,sha256:mergedHash,frames:media.frames,slides:proof.totalSlides,
      merged:{targetPath:targetRelative.replace(/\\/g,'/'),targetSha256:targetHash,targetSlides:proof.targetSlides,generatedSlides:proof.generatedSlides,totalSlides:proof.totalSlides}}};
   });
   }catch(error){const message=(error as Error).message as XiaozhiFileError;return fail(signal.aborted?(signal.reason==='timeout'?'timeout':'cancelled'):message in XIAOZHI_FILE_ERRORS?message:'read_failed');}
   finally{busy=false;for(const file of[temporary,temporaryCopy,temporaryMerged])if(file)try{fs.unlinkSync(file);}catch{/* owned staging file only */}}
 };
}
