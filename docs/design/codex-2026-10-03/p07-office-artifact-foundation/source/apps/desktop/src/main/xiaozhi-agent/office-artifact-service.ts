import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {withFileMutationQueue} from '@earendil-works/pi-coding-agent';
import {authorizedWorkspace,approvedFile,workspaceHash} from './workspace-authority';
import {fileVersion} from './workspace-files';
import {OFFICE_ARTIFACT_SCHEMA,officeRelativePath,validOfficeProposal,type OfficeArtifactDecision,type OfficeArtifactSource} from '../../shared/xiaozhi-office-artifacts';
import {validOfficeDraft,type OfficeDraft} from '../../shared/xiaozhi-office-draft';
import {createOfficeArtifactState,officeSha,officeSummary,type PrivateOfficeArtifact} from './office-artifact-state';
type Ledger=ReturnType<typeof createOfficeArtifactState>;
const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw new Error('cancelled');};
function file(root:string,relative:string){
 if(!officeRelativePath(relative))throw new Error('permission_denied');
 return approvedFile(root,relative);
}
function target(root:string,row:Pick<PrivateOfficeArtifact,'path'|'format'>){
 const value=file(root,row.path);
 if(!row.path.toLowerCase().endsWith('.'+row.format))throw new Error('invalid_input');
 const parent=fs.lstatSync(path.dirname(value));
 if(!parent.isDirectory()||parent.isSymbolicLink())throw new Error('permission_denied');
 return value;
}
function capture(root:string,relative:string,version?:string){
 const value=file(root,relative),stat=fs.lstatSync(value);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new Error('permission_denied');
 if(stat.size>50*1048576)throw new Error('too_large');
 if(version&&fileVersion(stat)!==version)throw new Error('conflict');
 const handle=fs.openSync(value,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const opened=fs.fstatSync(handle);if(!opened.isFile()||opened.nlink!==1||fileVersion(opened)!==fileVersion(stat))throw new Error('conflict');
  const bytes=fs.readFileSync(handle),post=fs.fstatSync(handle);
  if(bytes.length!==stat.size||fileVersion(post)!==fileVersion(stat)||fileVersion(fs.lstatSync(file(root,relative)))!==fileVersion(stat))throw new Error('conflict');
  return {version:fileVersion(stat),sha256:officeSha(bytes)};
 }finally{fs.closeSync(handle);}
}
function sourceVersions(root:string,row:PrivateOfficeArtifact){
 return row.sources.every(source=>{const v=capture(root,source.path,source.version);return v.sha256===source.sha256;});
}
function missing(root:string,row:Pick<PrivateOfficeArtifact,'path'|'format'>){return !fs.existsSync(target(root,row));}
/** Main application glue around original Pi mutation queue and existing Office generators. */
export function createOfficeArtifactService(options:{state:Ledger;dataRoot:string;workspace:(sessionId:string)=>Promise<string|null>;isCurrent:(sessionId:string,runId:string)=>boolean;
 generate?: (format:PrivateOfficeArtifact['format'],draft:OfficeDraft,options:{dataRoot:string;signal?:AbortSignal})=>Promise<Buffer>;
 afterStage?:(stage:'prepared'|'intent'|'file'|'fact')=>Promise<void>}){
 const {state}=options;
 const current=(row:Pick<PrivateOfficeArtifact,'sessionId'|'runId'>,signal?:AbortSignal)=>{check(signal);if(!options.isCurrent(row.sessionId,row.runId))throw new Error('permission_denied');};
 async function authority(sessionId:string,row?:PrivateOfficeArtifact){
  const raw=await options.workspace(sessionId);if(!raw)throw new Error('permission_denied');
  const root=authorizedWorkspace(raw,options.dataRoot);
  if(row&&(row.sessionId!==sessionId||row.workspaceHash!==workspaceHash(root)))throw new Error('permission_denied');return root;
 }
 async function owned(sessionId:string,id:string){const row=await state.get(id);if(!row||row.sessionId!==sessionId)throw new Error('permission_denied');return row;}
 async function recheck(row:PrivateOfficeArtifact,root:string,signal?:AbortSignal){
  if(row.parentArtifactId){
   const parent=await state.parent(row.parentArtifactId),source=row.sources.find(s=>s.kind==='parent_artifact');
   if(!parent||!source||parent.session_id!==row.sessionId||parent.content_hash!==source.sha256||parent.file_path!==file(root,source.path))throw new Error('conflict');
  }
  const active=await authority(row.sessionId,row);current(row,signal);
  if(root!==active)throw new Error('permission_denied');return active;
 }
 async function conflict(row:PrivateOfficeArtifact){return officeSummary(await state.transition(row,[row.state],'conflict'));}
 function compatible(root:string,row:PrivateOfficeArtifact){try{return missing(root,row)&&sourceVersions(root,row);}catch(error){if((error as Error).message==='permission_denied')throw error;return false;}}
 function install(root:string,row:PrivateOfficeArtifact,signal?:AbortSignal){
  if(!row.output||!row.outputHash)throw new Error('configuration');
  current(row,signal);
  if(workspaceHash(authorizedWorkspace(root,options.dataRoot))!==row.workspaceHash)throw new Error('permission_denied');
  if(!compatible(root,row))throw new Error('conflict');
  const destination=target(root,row),temporary=path.join(path.dirname(destination),`.xiaozhi-office-${randomUUID()}.tmp`);
  let handle:number|undefined;
  try{
   handle=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(handle,row.output);fs.fsyncSync(handle);fs.closeSync(handle);handle=undefined;
   current(row,signal);authorizedWorkspace(root,options.dataRoot);
   if(!compatible(root,row))throw new Error('conflict');
   fs.linkSync(temporary,destination);fs.unlinkSync(temporary);
  }finally{if(handle!==undefined)fs.closeSync(handle);try{fs.unlinkSync(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
 }
 function outputMatches(root:string,row:PrivateOfficeArtifact){
  const destination=target(root,row);
  if(destination!==row.resultPath||!row.output||!row.outputHash)throw new Error('configuration');
  if(!fs.existsSync(destination))return 'absent' as const;
  return capture(root,row.path).sha256===row.outputHash?'same' as const:'different' as const;
 }
 return {
  async propose(sessionId:string,runId:string,callId:string,raw:unknown,signal?:AbortSignal){
   current({sessionId,runId},signal);if(!validOfficeProposal(raw)||!callId||callId.length>128)throw new Error('invalid_input');
   const input=JSON.parse(JSON.stringify(raw)) as typeof raw,root=await authority(sessionId);current({sessionId,runId},signal);
   const inputHash=officeSha(JSON.stringify(input)),existing=await state.call(sessionId,runId,callId);current({sessionId,runId},signal);
   if(existing){if(existing.inputHash!==inputHash||existing.workspaceHash!==workspaceHash(root))throw new Error('conflict');return officeSummary(existing);}
   if(!missing(root,input))throw new Error('conflict');
   const sources:OfficeArtifactSource[]=input.sources.map(s=>({kind:'workspace_file',sourceId:'',path:s.path,...capture(root,s.path,s.version)}));
   if(input.parentArtifactId){
    const parent=await state.parent(input.parentArtifactId);current({sessionId,runId},signal);
    if(!parent||parent.session_id!==sessionId)throw new Error('permission_denied');
    const relative=path.relative(root,String(parent.file_path)).replace(/\\/g,'/');
    if(relative===input.path||sources.some(s=>s.path.toLowerCase()===relative.toLowerCase()))throw new Error('invalid_input');
    const captured=capture(root,relative);
    if(captured.sha256!==parent.content_hash||file(root,relative)!==String(parent.file_path))throw new Error('conflict');
    sources.push({kind:'parent_artifact',sourceId:input.parentArtifactId,path:relative,...captured});
   }
   const rootNow=await authority(sessionId);current({sessionId,runId},signal);if(rootNow!==root)throw new Error('permission_denied');
   const row=await state.create({sessionId,runId,callId,path:input.path,format:input.format,draft:input.draft,sources,parentArtifactId:input.parentArtifactId??null,inputHash,workspaceHash:workspaceHash(root)});
   try{await recheck(row,root,signal);}catch(error){await state.transition(row,['pending'],'interrupted');throw error;}
   return officeSummary(row);
  },
  async review(sessionId:string,id:string){
   const row=await owned(sessionId,id),root=await authority(sessionId,row);target(root,row);
   return {...officeSummary(row),draft:row.draft,sources:row.sources,parentArtifactId:row.parentArtifactId};
  },
  async revise(sessionId:string,id:string,revision:number,draft:unknown){
   if(!Number.isSafeInteger(revision)||revision<0||!validOfficeDraft(draft))throw new Error('invalid_input');
   const content=JSON.parse(JSON.stringify(draft)) as OfficeDraft,row=await owned(sessionId,id),root=await authority(sessionId,row);current(row);
   return withFileMutationQueue(target(root,row),async()=>{
    const latest=await owned(sessionId,id);await recheck(latest,root);
    if(latest.revision!==revision||latest.state!=='pending')throw new Error('conflict');
    if(!compatible(root,latest))return conflict(latest);
    return officeSummary(await state.transition(latest,['pending'],'pending',{draft:content}));
   });
  },
  async decide(input:OfficeArtifactDecision){
   if(!input||input.schemaVersion!==OFFICE_ARTIFACT_SCHEMA||Object.keys(input).some(k=>!['schemaVersion','sessionId','draftId','revision','action'].includes(k))
    ||!Number.isSafeInteger(input.revision)||input.revision<0||!['approve','reject','verify'].includes(input.action))throw new Error('invalid_input');
   const row=await owned(input.sessionId,input.draftId),root=await authority(input.sessionId,row);
   return withFileMutationQueue(target(root,row),async()=>{
    const latest=await owned(input.sessionId,input.draftId),active=await authority(input.sessionId,latest);
    if(root!==active)throw new Error('permission_denied');if(latest.revision!==input.revision)throw new Error('conflict');
    if(input.action==='verify'){
     if(latest.state!=='uncertain')throw new Error('conflict');
     const outcome=outputMatches(root,latest);
     return officeSummary(await state.transition(latest,['uncertain'],outcome==='same'?'saved':outcome==='absent'?'interrupted':'conflict'));
    }
    await recheck(latest,root);if(latest.state!=='pending')throw new Error('conflict');
    if(input.action==='approve'&&!compatible(root,latest))return conflict(latest);
    return officeSummary(await state.transition(latest,['pending'],input.action==='approve'?'approved':'rejected'));
   });
  },
  async apply(sessionId:string,id:string,signal?:AbortSignal){
   const row=await owned(sessionId,id),root=await authority(sessionId,row);current(row,signal);
   return withFileMutationQueue(target(root,row),async()=>{
    let latest=await owned(sessionId,id);await recheck(latest,root,signal);
    if(latest.state!=='approved')throw new Error('conflict');if(!compatible(root,latest))return conflict(latest);
    latest=await state.transition(latest,['approved'],'generating');
    try{
     const generate=options.generate??(await import('./office-generator')).generateOfficeDocument;
     await recheck(latest,root,signal);
     const bytes=await generate(latest.format,latest.draft,{dataRoot:options.dataRoot,signal});
     await recheck(latest,root,signal);
     if(!compatible(root,latest))return conflict(latest);
     latest=await state.transition(latest,['generating'],'prepared',{output:bytes,resultPath:target(root,latest)});
     await options.afterStage?.('prepared');await recheck(latest,root,signal);
     latest=await state.transition(latest,['prepared'],'committing');
     await options.afterStage?.('intent');await recheck(latest,root,signal);
     install(root,latest,signal);await options.afterStage?.('file');
     if(outputMatches(root,latest)!=='same')throw new Error('conflict');
     const saved=await state.transition(latest,['committing'],'saved');await options.afterStage?.('fact');return officeSummary(saved);
    }catch(error){
     const pending=await state.get(id);
     if(pending&&['generating','prepared','committing'].includes(pending.state))await state.transition(pending,[pending.state],pending.state==='committing'?'uncertain':signal?.aborted||(error as Error).message==='cancelled'?'interrupted':(error as Error).message==='conflict'?'conflict':'failed');
     throw error;
    }
   });
  }
 };
}
