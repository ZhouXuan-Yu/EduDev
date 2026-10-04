import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createAttachmentState,publicAttachment} from './attachment-state';
import {createAttachmentImportState,attachmentImportIdentity,type AttachmentImport} from './attachment-import-state';
import {createAttachmentService} from './attachment-service';
import {createWorkspaceFiles,type WorkspaceLease} from './workspace-files';
import {approvedFile,workspaceHash} from './workspace-authority';
import {safeFilename} from './vendor/hana/lib/session-files/inbound-filenames';
import {MAX_XIAOZHI_ATTACHMENTS,validAttachmentSession,validAttachmentSelection,type XiaozhiAttachmentSelection,type XiaozhiAttachment} from '../../shared/xiaozhi-attachments';
import {XIAOZHI_FILES_SCHEMA,type XiaozhiFilePreview} from '../../shared/xiaozhi-files';

const inside=(root:string,target:string)=>{const relative=path.relative(root.toLowerCase(),target.toLowerCase());return !relative||(!relative.startsWith('..')&&!path.isAbsolute(relative));};
const noLinks=(absolute:string)=>{
 let current=path.resolve(absolute);
 for(;;){const stat=fs.lstatSync(current);if(stat.isSymbolicLink())throw new Error('permission_denied');const parent=path.dirname(current);if(parent===current)break;current=parent;}
};
/** Main-only native-picker grants. This API is never exposed as a renderer path/bytes importer. */
export function createAttachmentImportService(options:{dataRoot:string;state:ReturnType<typeof createAttachmentState>;imports:ReturnType<typeof createAttachmentImportState>;
 isCurrent?:()=>boolean;validateImage?:(bytes:Buffer,mime:string,signal:AbortSignal)=>Promise<unknown>;
 afterStage?:(stage:'intent'|'file'|'ready'|'registered')=>Promise<void>}){
 const jobs=new Map<string,Promise<XiaozhiAttachment>>();
 const current=(signal:AbortSignal)=>{signal.throwIfAborted();if(options.isCurrent?.()===false)throw new Error('cancelled');};
 const source=(raw:string)=>{
  if(typeof raw!=='string'||!path.isAbsolute(raw)||raw.length>2048||/[\x00-\x1f]/.test(raw)||raw.startsWith('\\\\'))throw new Error('invalid_input');
  const absolute=path.resolve(raw);noLinks(absolute);
  const parts=absolute.split(/[\\/]/);
  if(parts.some(p=>/^(\.env(?:\..*)?|\.git|\.codex|\.pi|\.ssh|\.aws|\.azure|.*\.(?:key|pem))$/i.test(p))
   ||inside(path.resolve(options.dataRoot),absolute)||inside(process.env.WINDIR||'C:\\Windows',absolute))throw new Error('permission_denied');
  const stat=fs.lstatSync(absolute);if(!stat.isFile()||stat.nlink!==1)throw new Error('permission_denied');return absolute;
 };
 async function resolve(sessionId:string):Promise<WorkspaceLease>{
  if(!validAttachmentSession(sessionId))throw new Error('invalid_input');
  const data=path.resolve(options.dataRoot);noLinks(data);if(!fs.lstatSync(data).isDirectory())throw new Error('configuration');
  let directory=data;
  for(const part of ['xiaozhi-pi','attachments',sessionId]){
   directory=path.join(directory,part);
   try{await fs.promises.mkdir(directory);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
   noLinks(directory);if(!fs.lstatSync(directory).isDirectory())throw new Error('permission_denied');
  }
  return {path:directory,label:'本地附件',version:workspaceHash(directory)};
 }
 const managed=createAttachmentService({state:options.state,resolve,isCurrent:options.isCurrent});
 async function registerReady(record:AttachmentImport,signal:AbortSignal){
  if(record.state!=='ready')throw new Error('busy');current(signal);
  const copy=await managed.capture(record.sessionId,record.relativePath,signal);
  if(copy.contentSha256!==record.originalSha256||copy.size!==record.size||copy.mime!==record.mime)throw new Error('changed');
  current(signal);
  const previous=(await options.state.list(record.sessionId)).find(v=>v.state==='draft'&&v.sourceKey===copy.sourceKey);
  current(signal);const registered=await options.state.register(copy);
  try{await options.afterStage?.('registered');current(signal);return publicAttachment(registered);}
  catch(error){
   // Cancellation after an actual SQL receipt must not expose a new late draft.
   // A deduplicated previously selected draft belongs to its earlier selection and is retained.
   if(previous?.id!==registered.id)await options.state.remove(record.sessionId,{id:registered.id,revision:registered.revision}).catch(()=>undefined);
   throw error;
  }
 }
 async function importOne(sessionId:string,absolute:string,signal:AbortSignal){
  const count=(await options.state.list(sessionId)).filter(v=>v.state==='draft').length;
  current(signal);
  const parent=path.dirname(absolute),lease={path:parent,label:'已选择的文件',version:workspaceHash(parent)};
  const reader=createAttachmentService({state:options.state,resolve:async()=>lease,isCurrent:options.isCurrent});
  const captured=await reader.readBytes(sessionId,path.basename(absolute),signal);
  if(captured.candidate.format==='image'){await options.validateImage?.(captured.bytes,captured.candidate.mime,signal);current(signal);}
  const identity={sessionId,originalPath:absolute,originalVersion:captured.candidate.version,originalSha256:captured.candidate.contentSha256};
  const sourceKey=attachmentImportIdentity(identity),previous=await options.imports.current(sessionId,sourceKey);current(signal);
  if(previous)return registerReady(previous,signal);
  if(count>=MAX_XIAOZHI_ATTACHMENTS)throw new Error('busy');
  const filename=safeFilename(captured.candidate.name,captured.candidate.mime,captured.candidate.format==='image'?'image':'file') as string;
  const relativePath=`${randomUUID()}/${filename}`;
  const prepared=await options.imports.prepare({...identity,sourceKey,relativePath,size:captured.candidate.size,mime:captured.candidate.mime});
  if(!prepared.owned)return registerReady(prepared.item,signal);
  const record=prepared.item;
  try{
   current(signal);await options.afterStage?.('intent');current(signal);
   const root=await resolve(sessionId);current(signal);const file=approvedFile(root.path,record.relativePath);
   await fs.promises.mkdir(path.dirname(file));noLinks(path.dirname(file));current(signal);
   const handle=await fs.promises.open(file,'wx');
   try{await handle.writeFile(captured.bytes);await handle.sync();}finally{await handle.close();}
   current(signal);await fs.promises.chmod(file,0o444);current(signal);
   const copy=await managed.capture(sessionId,record.relativePath,signal);
   if(copy.contentSha256!==record.originalSha256||copy.size!==record.size||copy.mime!==record.mime)throw new Error('changed');
   await options.afterStage?.('file');current(signal);
   const ready=await options.imports.finish(record.id,sessionId,'ready');
   await options.afterStage?.('ready');current(signal);return registerReady(ready,signal);
  }catch(error){await options.imports.finish(record.id,sessionId,'interrupted').catch(()=>undefined);throw error;}
 }
 async function verify(sessionId:string,selection:XiaozhiAttachmentSelection,signal:AbortSignal){
  if(!validAttachmentSelection(selection))throw new Error('invalid_input');current(signal);
  const target=await managed.preview(sessionId,selection,signal),record=(await options.imports.list(sessionId)).find(v=>v.relativePath===target.path&&v.state==='ready');
  if(!record)throw new Error('permission_denied');
  const row=await options.state.get(sessionId,selection.id);if(!row||row.contentSha256!==record.originalSha256)throw new Error('changed');return target;
 }
 return {
  /** Native picker provides one explicitly selected path; no directory listing or adjacent-file authority. */
  async importFile(sessionId:string,raw:string,signal:AbortSignal){
   if(!validAttachmentSession(sessionId))throw new Error('invalid_input');current(signal);const absolute=source(raw);
   const key=JSON.stringify([sessionId,process.platform==='win32'?absolute.toLowerCase():absolute]);
   const prior=jobs.get(key);if(prior){const value=await prior;current(signal);return value;}
   if(jobs.size>=8)throw new Error('busy');
   const work=importOne(sessionId,absolute,signal);jobs.set(key,work);
   try{return await work;}finally{jobs.delete(key);}
  },
  verify,
  /** Current captured image bytes, main-only, bounded by the original native-picker authority. */
  async readImageBytes(sessionId:string,selection:XiaozhiAttachmentSelection,signal:AbortSignal){
   const target=await verify(sessionId,selection,signal),row=await options.state.get(sessionId,selection.id);current(signal);
   if(!row||row.state!=='submitted'||row.format!=='image')throw new Error('permission_denied');
   const captured=await managed.readBytes(sessionId,target.path,signal);current(signal);
   if(captured.candidate.contentSha256!==row.contentSha256||captured.candidate.version!==row.version)throw new Error('changed');
   await verify(sessionId,selection,signal);current(signal);return {bytes:captured.bytes,mime:captured.candidate.mime};
  },
  async preview(sessionId:string,selection:XiaozhiAttachmentSelection,signal:AbortSignal):Promise<Omit<XiaozhiFilePreview,'path'>>{
   const target=await verify(sessionId,selection,signal);current(signal);
   const result=await createWorkspaceFiles(resolve).preview({schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId,requestId:`xifile_${randomUUID()}`,...target},signal);
   if(!result.ok)throw new Error(result.error);current(signal);
   await managed.preview(sessionId,selection,signal);const {path:_privatePath,...publicPreview}=result.data;return publicPreview;
  },
 };
}
