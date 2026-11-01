import {ARTIFACT_CHECK_SCHEMA,validArtifactCheck,type ArtifactCheckResult,type ArtifactCheckView} from '../../shared/artifact-check';
import {officeRelativePath} from '../../shared/xiaozhi-office-artifacts';
import {workspaceHash} from './workspace-authority';
import {officeVersionFamilies,type OfficeFamilyRecord} from './office-version-family';
import {textVersionFamilies} from './text-version-family';
import type {createTextChangeState} from './text-change-state';
import type {createOfficeArtifactState} from './office-artifact-state';
import type {createInspectionState} from './checks/state';
import type {createDeliveryChecks} from './checks/service';
import {readInspectionFile} from './checks/read-file';
import type {WorkspaceLease} from './workspace-files';

/** Exact saved identity from the original ledger; never infer a receipt from a same-name file. */
export function createArtifactCheck(options:{changes:ReturnType<typeof createTextChangeState>;office:ReturnType<typeof createOfficeArtifactState>;
 inspections:ReturnType<typeof createInspectionState>;checks:Pick<ReturnType<typeof createDeliveryChecks>,'get'>;
 authorize:(id:string)=>Promise<unknown>;workspace:(id:string)=>Promise<WorkspaceLease>}){
 return async(input:unknown):Promise<ArtifactCheckResult>=>{
  if(!validArtifactCheck(input))return{ok:false,error:'invalid_input'};
  try{
   await options.authorize(input.sessionId);const lease=await options.workspace(input.sessionId);
   let target:{path:string;sha256:string;draftId:string;workspaceHash:string;current:boolean}|undefined;
   if(input.artifactId.startsWith('xichange_')){
    const rows=await options.changes.versionRecords(input.sessionId),row=rows.find(r=>r.id===input.artifactId&&['applied','reverted'].includes(r.state));
    if(row){const family=textVersionFamilies(rows).get(row.id);target={path:row.path,sha256:row.afterSha256,draftId:row.id,workspaceHash:row.workspaceHash,
     current:family?family.currentId===row.id:row.state==='applied'&&rows.filter(r=>r.workspaceHash===row.workspaceHash&&r.path===row.path&&r.state==='applied').at(-1)?.id===row.id};}
   }else{
    const rows=await options.office.versionRecords(input.sessionId) as (OfficeFamilyRecord&{sha256:string;draftId:string})[],row=rows.find(r=>r.artifactId===input.artifactId);
    if(row){const family=officeVersionFamilies(rows).get(row.artifactId);target={path:row.path,sha256:row.sha256,draftId:row.draftId,workspaceHash:row.workspaceHash,current:!family||family.currentArtifactId===row.artifactId};}
   }
   if(!target)return{ok:false,error:'not_found'};
   if(target.workspaceHash!==workspaceHash(lease.path))return{ok:false,error:'permission_denied'};
   if(!officeRelativePath(target.path)||!/^[a-f0-9]{64}$/.test(target.sha256))throw Error('invalid_record');
   let integrity:ArtifactCheckView['integrity']='unavailable',version:string|undefined;
   try{const file=await readInspectionFile(lease,target.path);integrity=file.sha256===target.sha256?'same':'changed';if(integrity==='same')version=file.fileVersion;}
   catch(error){if(['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code||''))integrity='missing';}
   const report=await options.inspections.forArtifact(input.sessionId,target),refreshed=report?await options.checks.get(input.sessionId,report.id):null;
   await options.authorize(input.sessionId);if((await options.workspace(input.sessionId)).version!==lease.version)return{ok:false,error:'permission_denied'};
   return{ok:true,value:{schemaVersion:ARTIFACT_CHECK_SCHEMA,artifactId:input.artifactId,path:target.path,sha256:target.sha256,current:target.current,integrity,
    ...(version?{fileVersion:version}:{}),workspaceVersion:lease.version,report,applicable:!!report&&target.current&&integrity==='same'&&!!refreshed&&refreshed.state!=='stale'&&refreshed.contextCurrent!==false,retainedReports:64}};
  }catch{return{ok:false,error:'unavailable'};}
 };
}
