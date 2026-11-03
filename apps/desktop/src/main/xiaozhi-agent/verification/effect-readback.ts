import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {approvedFile,workspaceHash} from '../workspace-authority';
import {fileVersion} from '../workspace-files';
import type {createTextChangeState} from '../text-change-state';
import {officeDraftText,type createOfficeArtifactState} from '../office-artifact-state';
import {OFFICE_OUTPUT_MAX_BYTES} from '../../../shared/xiaozhi-office-draft';
import {officeVersionFamilies} from '../office-version-family';
import {validPresentationUnchangedReceipt} from '../../../shared/xiaozhi-presentation-edit';

export type EffectSnapshot={digest:string;version:string};
export type BoundEffect=EffectSnapshot & {read:()=>Promise<EffectSnapshot>;repairFailures?:{callId:string;reference:string;attempt:number}[];input?:(read:{source:string;version:string;text:string;sha256?:string})=>Promise<BoundEffect|undefined>};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const digest=(value:unknown)=>sha(JSON.stringify(value));
const mime={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};

/** Bounded independent bytes read, through the existing workspace authority.
 * No preview worker, write, recovery action or provider call is performed. */
async function readFile(root:string,relative:string,max:number){
 const file=approvedFile(root,relative),handle=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const before=await handle.stat();
  if(!before.isFile()||before.nlink!==1||before.size>max)throw Error('evidence_missing');
  const bytes=Buffer.alloc(before.size);let offset=0;
  while(offset<bytes.length){const part=await handle.read(bytes,offset,bytes.length-offset,offset);if(!part.bytesRead)throw Error('evidence_missing');offset+=part.bytesRead;}
  const after=await handle.stat(),current=await fs.promises.lstat(approvedFile(root,relative));
  if(current.isSymbolicLink()||current.nlink!==1||fileVersion(before)!==fileVersion(after)||fileVersion(after)!==fileVersion(current))throw Error('evidence_missing');
  return{file,sha256:sha(bytes),size:bytes.length,version:fileVersion(before)};
 }finally{await handle.close();}
}

/** Bind only the main-owned final teacher-confirmed ledger for this exact call.
 * The captured expectation stays immutable; finish independently rereads current
 * authorization, SQLite and disk. A later consistent rewrite cannot reset it. */
export function createEffectReadback(options:{sessionId:string;runId:string;current:()=>boolean;requireCurrentOffice?:boolean;
 workspace:()=>Promise<string>;fileLabel:(tool:string,path:string)=>Promise<string>;fileText?:(text:string)=>Promise<string>;changes:ReturnType<typeof createTextChangeState>;artifacts:ReturnType<typeof createOfficeArtifactState>}){
 const check=()=>{if(!options.current())throw Error('cancelled');};
 async function snapshot(callId:string,tool:string,payload:Record<string,unknown>):Promise<EffectSnapshot>{
  check();const root=await options.workspace();check();
  if(tool==='office_create_text'||tool==='office_edit_text'||tool==='office_create_science_figure'){
   const row=await options.changes.call(options.sessionId,options.runId,callId);check();
   if(!row||row.sessionId!==options.sessionId||row.runId!==options.runId||row.callId!==callId||row.state!=='applied'
    ||row.workspaceHash!==workspaceHash(root)||payload.outcome!=='applied'||payload.operation!==row.operation
    ||(tool!=='office_edit_text')!==(row.operation==='create'))throw Error('evidence_missing');
   if(payload.file!==await options.fileLabel(tool,row.path))throw Error('evidence_missing');check();
   const file=await readFile(root,row.path,65536);check();
   if(file.sha256!==row.afterSha256||file.size!==row.after.length)throw Error('evidence_missing');
   const version=digest([row.id,row.revision,row.workspaceHash,row.path,row.operation,row.afterSha256]);
   return{version,digest:digest([version,file.sha256,file.size])};
  }
  if(tool!=='office_create_document')throw Error('invalid_input');
  const unchanged=validPresentationUnchangedReceipt(payload);
  const row=unchanged?await options.artifacts.byArtifact(options.sessionId,payload.artifactId as string):await options.artifacts.call(options.sessionId,options.runId,callId);check();
  if(!row||row.sessionId!==options.sessionId||!unchanged&&(row.runId!==options.runId||row.callId!==callId)||row.state!=='saved'
   ||row.workspaceHash!==workspaceHash(root)||!row.output||!row.outputHash||!row.artifactId||!row.resultPath
   ||payload.outcome!==(unchanged?'unchanged':'saved')||payload.format!==row.format||payload.artifactId!==row.artifactId)throw Error('evidence_missing');
  if(payload.file!==await options.fileLabel(tool,row.path))throw Error('evidence_missing');check();
  if(options.requireCurrentOffice){const family=officeVersionFamilies(await options.artifacts.versionRecords(options.sessionId) as import('../office-version-family').OfficeFamilyRecord[]).get(row.artifactId);check();if(family&&family.currentArtifactId!==row.artifactId)throw Error('evidence_missing');}
  const file=await readFile(root,row.path,OFFICE_OUTPUT_MAX_BYTES);check();
  if(unchanged&&(payload.version!==file.version||payload.sha256!==file.sha256||payload.draftHash!==row.draftHash))throw Error('evidence_missing');
  const fact=await options.artifacts.parent(row.artifactId);check();
  if(file.file!==path.resolve(row.resultPath)||file.sha256!==row.outputHash||file.size!==row.output.length
   ||!fact||fact.id!==row.artifactId||fact.session_id!==options.sessionId||fact.status!=='exported'
   ||fact.file_path!==file.file||fact.file_name!==row.path||fact.content_hash!==file.sha256||Number(fact.file_size)!==file.size
   ||fact.title!==row.draft.title||fact.artifact_type!==row.format||fact.mime_type!==mime[row.format]
   ||fact.content_md!==officeDraftText(row.draft))throw Error('evidence_missing');
  const version=digest([row.id,row.revision,row.workspaceHash,row.path,row.format,row.draftHash,row.outputHash,row.artifactId,row.sources,...(unchanged?['unchanged',file.version]:[])]);
  return{version,digest:digest([version,file.sha256,file.size,fact.id,fact.session_id,fact.status,fact.content_md])};
 }
 return async(callId:string,tool:string,payload:Record<string,unknown>):Promise<BoundEffect>=>{
  const expected=await snapshot(callId,tool,payload);
  const before=tool==='office_edit_text'?await options.changes.call(options.sessionId,options.runId,callId):null;
  // This is a historical input relation, never a statement that the old source
  // is still the current file. Raw before bytes stay inside this main closure.
  const input=before?.before&&options.fileText?async(read:{source:string;version:string;text:string;sha256?:string}):Promise<BoundEffect|undefined>=>{
   check();if(!/^[a-f0-9]{64}$/.test(read.version)||!read.text||read.sha256!==before.beforeSha256)return;
   const root=await options.workspace();check();
   if(workspaceHash(root)!==before.workspaceHash||approvedFile(root,read.source)!==approvedFile(root,before.path)||await options.fileText!(before.before!.toString('utf8'))!==read.text)return;
   const version=digest(['approved-file-input.v1',expected.version,read.version,before.beforeSha256]),value={version,digest:digest([version,read.source,read.text,before.beforeSha256,expected.digest])};
   return Object.freeze({...value,read:async()=>{
    const actual=await snapshot(callId,tool,payload),row=await options.changes.call(options.sessionId,options.runId,callId);check();
    if(actual.digest!==expected.digest||actual.version!==expected.version||!row?.before||row.beforeSha256!==before.beforeSha256||!row.before.equals(before.before!))throw Error('evidence_missing');
    return value;
   }});
  }:undefined;
  return Object.freeze({...expected,read:()=>snapshot(callId,tool,payload),...(input?{input}:{})});
 };
}
