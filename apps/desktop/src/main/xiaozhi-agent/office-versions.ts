import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {OFFICE_VERSIONS_SCHEMA,type OfficeVersionInput,type OfficeVersionView,type OfficeVersionError,type OfficeVersionResult,validOfficeVersionInput} from '../../shared/xiaozhi-office-versions';
import {OFFICE_ARTIFACT_SCHEMA,officeHash,officeRelativePath} from '../../shared/xiaozhi-office-artifacts';
import {createOfficeArtifactService} from './office-artifact-service';
import {createOfficeArtifactState,officeSha} from './office-artifact-state';
import {authorizedWorkspace,approvedFile,workspaceHash} from './workspace-authority';
import {fileVersion} from './workspace-files';
import {assertFileWritesEnabled} from './file-write-policy';
import {officeVersionFamilies} from './office-version-family';

type RecordVersion={artifactId:string;path:string;title:string;format:string;parentArtifactId:string|null;savedAt:string;size:number;sha256:string;workspaceHash:string;draftSchema:string;sourcePaths:string;changedSections:string;sectionCount:number;parentSectionCount:number|null;runId:string};
const ordinary=(row:RecordVersion)=>['xiaozhi.office-draft.v1','xiaozhi.presentation-draft.v1'].includes(row.draftSchema);
const error=(raw:unknown):OfficeVersionError=>{const message=raw instanceof Error?raw.message:'';return Object.hasOwn({invalid_input:1,permission_denied:1,busy:1,changed:1,missing:1,conflict:1,unsupported:1,file_writes_disabled:1,open_failed:1},message)?message as OfficeVersionError:'configuration';};

/** A view of the original saved Office ledger, never another version truth or model turn. */
export function createOfficeVersions(options:{state:ReturnType<typeof createOfficeArtifactState>;dataRoot:string;workspace:(id:string)=>Promise<string>;afterStage?:(stage:'prepared'|'intent'|'file'|'fact')=>Promise<void>}){
 const {state}=options;
 async function records(sessionId:string){
  const rows=await state.versionRecords(sessionId) as RecordVersion[];
  if(rows.length>256||rows.some(row=>typeof row.artifactId!=='string'||!/^artifact_[a-f0-9-]{36}$/i.test(row.artifactId)||!officeRelativePath(row.path)||!officeHash(row.sha256)||!officeHash(row.workspaceHash)||!Number.isSafeInteger(row.size)||row.size<1||row.size>16*1048576))throw Error('configuration');
  return rows;
 }
 function family(rows:RecordVersion[],id:string){
  const selected=rows.find(row=>row.artifactId===id);if(!selected)throw Error('permission_denied');if(!ordinary(selected))throw Error('unsupported');
  const families=officeVersionFamilies(rows),ancestor=families.get(id)!.familyId;return rows.filter(row=>families.get(row.artifactId)?.familyId===ancestor);
 }
 async function workspace(sessionId:string,row:RecordVersion){const root=authorizedWorkspace(await options.workspace(sessionId),options.dataRoot);if(workspaceHash(root)!==row.workspaceHash)throw Error('permission_denied');return root;}
 async function inspect(root:string,row:RecordVersion){
  try{
   const file=approvedFile(root,row.path),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==row.size)return {integrity:'changed' as const};
   const handle=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));try{
    const before=await handle.stat();if(fileVersion(before)!==fileVersion(stat))return {integrity:'changed' as const};
    const buffer=Buffer.alloc(row.size+1);let read=0;while(read<buffer.length){const result=await handle.read(buffer,read,buffer.length-read,read);if(!result.bytesRead)break;read+=result.bytesRead;}
    const bytes=buffer.subarray(0,read),after=await handle.stat(),last=await fs.lstat(approvedFile(root,row.path));
    if(bytes.length!==row.size||fileVersion(after)!==fileVersion(stat)||fileVersion(last)!==fileVersion(stat)||officeSha(bytes)!==row.sha256)return {integrity:'changed' as const};
    return {integrity:'same' as const,version:fileVersion(stat),file};
   }finally{await handle.close();}
  }catch(raw){if((raw as NodeJS.ErrnoException).code==='ENOENT')return {integrity:'missing' as const};throw raw;}
 }
 function changed(row:RecordVersion){
  if(!row.parentArtifactId)return '首次保存';
  if(row.runId.startsWith('local_restore_'))return `恢复旧版文件：${(JSON.parse(row.sourcePaths) as string[])[0]||'已保存版本'}`;
  if(row.draftSchema==='xiaozhi.presentation-draft.v1'){
   const pages=JSON.parse(row.changedSections) as number[],removed=row.parentSectionCount!==null&&row.parentSectionCount>row.sectionCount;
   return (pages.length?`第 ${pages.slice(0,20).join('、')} 页内容或备注变化${pages.length>20?'等':''}`:'各页内容及备注未变化')+(removed?'；页数减少':'');
  }
  return '基于上一版保存新文件';
 }
 async function view(sessionId:string,id:string):Promise<OfficeVersionView>{
  const rows=family(await records(sessionId),id),selected=rows.find(row=>row.artifactId===id)!;if(!ordinary(selected))throw Error('unsupported');
  const root=await workspace(sessionId,selected),status=await inspect(root,selected),latest=rows.at(-1)!;
  await workspace(sessionId,selected);
  return {schemaVersion:OFFICE_VERSIONS_SCHEMA,sessionId,selectedArtifactId:id,currentArtifactId:latest.artifactId,integrity:status.integrity,canRestore:id!==latest.artifactId&&selected.sha256!==latest.sha256&&ordinary(selected)&&ordinary(latest)&&status.integrity==='same',
   versions:rows.map((row,index)=>({artifactId:row.artifactId,path:row.path,title:row.title,format:row.format,number:index+1,savedAt:row.savedAt,parentArtifactId:row.parentArtifactId,size:row.size,change:changed(row)}))};
 }
 async function restore(input:Extract<OfficeVersionInput,{action:'restore'}>,assertCurrent:()=>void){
  assertFileWritesEnabled();assertCurrent();
  const runId=`local_restore_${input.commandId}`,existing=await state.call(input.sessionId,runId,'restore');assertCurrent();
  const rows=family(await records(input.sessionId),input.artifactId),selected=rows.find(row=>row.artifactId===input.artifactId)!,latest=rows.at(-1)!,root=await workspace(input.sessionId,selected);assertCurrent();
  const service=createOfficeArtifactService({state,dataRoot:options.dataRoot,workspace:async id=>{assertCurrent();return options.workspace(id);},isCurrent:(id,run)=>{try{assertCurrent();return id===input.sessionId&&run===runId;}catch{return false;}},afterStage:options.afterStage});
  if(existing){
   // The command is bound to both versions. An uncertain completed write is checked, never replayed.
   if(existing.parentArtifactId!==input.currentArtifactId||!existing.sources.some(source=>source.kind==='workspace_file'&&source.path===selected.path&&source.sha256===selected.sha256))throw Error('conflict');
   if(existing.state==='uncertain'){if(latest.artifactId!==input.currentArtifactId)throw Error('conflict');await service.decide({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId:input.sessionId,draftId:existing.id,revision:existing.revision,action:'verify'});assertCurrent();}
   const result=await state.get(existing.id);if(result?.state!=='saved'||!result.artifactId)throw Error('configuration');return view(input.sessionId,result.artifactId);
  }
  if(latest.artifactId!==input.currentArtifactId||selected.artifactId===latest.artifactId)throw Error('conflict');
  if(!ordinary(selected)||!ordinary(latest)||selected.format!==latest.format)throw Error('unsupported');
  if(selected.workspaceHash!==latest.workspaceHash)throw Error('permission_denied');
  const oldStatus=await inspect(root,selected),newStatus=await inspect(root,latest);assertCurrent();
  if(oldStatus.integrity!=='same')throw Error(oldStatus.integrity);if(newStatus.integrity!=='same')throw Error(newStatus.integrity);
  if(selected.sha256===latest.sha256)return view(input.sessionId,latest.artifactId);
  const original=await state.byArtifact(input.sessionId,selected.artifactId);assertCurrent();if(!original?.output||original.outputHash!==selected.sha256)throw Error('configuration');
  const first=rows[0],extension=path.posix.extname(first.path),destination=path.posix.join(path.posix.dirname(first.path),path.posix.basename(first.path,extension)+`-恢复版${rows.length+1}`+extension);
  let proposal=await service.propose(input.sessionId,runId,'restore',{path:destination,format:original.format,draft:original.draft,sources:[{path:selected.path,version:oldStatus.version!}],parentArtifactId:latest.artifactId});assertCurrent();
  // Restore exact previously saved bytes. Do not run a generator or reuse an old approval.
  const row=await state.get(proposal.id);if(!row)throw Error('configuration');await state.cacheCandidate(row,original.output);assertCurrent();
  proposal=await service.decide({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId:input.sessionId,draftId:proposal.id,revision:proposal.revision,action:'approve'});assertCurrent();
  if(proposal.state!=='approved')throw Error('conflict');const saved=await service.apply(input.sessionId,proposal.id);assertCurrent();
  if(saved.state!=='saved'||!saved.artifactId)throw Error('configuration');return view(input.sessionId,saved.artifactId);
 }
 return {
  async execute(raw:unknown,assertCurrent:()=>void,useFile?:(file:string,action:'open'|'locate')=>Promise<void>):Promise<OfficeVersionResult>{
   if(!validOfficeVersionInput(raw))return {ok:false,error:'invalid_input'};
   try{
    assertCurrent();if(raw.action==='restore')return {ok:true,value:await restore(raw,assertCurrent)};
    const value=await view(raw.sessionId,raw.artifactId);assertCurrent();
    if(raw.action!=='view'){
     if(value.integrity!=='same')throw Error(value.integrity);
     const row=(await records(raw.sessionId)).find(row=>row.artifactId===raw.artifactId)!;const root=await workspace(raw.sessionId,row),status=await inspect(root,row);assertCurrent();
     if(status.integrity!=='same')throw Error(status.integrity);if(!useFile||!status.file)throw Error('open_failed');await useFile(status.file,raw.action);assertCurrent();
    }
    return {ok:true,value};
   }catch(rawError){return {ok:false,error:error(rawError)};}
  }
 };
}
