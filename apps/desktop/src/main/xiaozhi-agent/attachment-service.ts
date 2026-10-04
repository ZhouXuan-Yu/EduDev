import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {approvedFile} from './workspace-authority';import {fileVersion,type WorkspaceLease} from './workspace-files';
import {detectMime} from '../office-agent/vendor/hana/lib/file-metadata';
import {DOCUMENT_MAX_INPUT,isOfficeDocument} from '../../shared/xiaozhi-documents';
import {validAttachmentSession,validAttachmentPath,validAttachmentSelection,type XiaozhiAttachmentFormat,type XiaozhiAttachmentSelection} from '../../shared/xiaozhi-attachments';
import {createAttachmentState,type PrivateAttachment,publicAttachment,attachmentIdentity} from './attachment-state';
const format=(name:string):XiaozhiAttachmentFormat=>/\.md$/i.test(name)?'markdown':/\.(txt|csv|json|yaml|yml|log)$/i.test(name)?'text':/\.(png|jpe?g|webp|gif)$/i.test(name)?'image':isOfficeDocument(name)?'office':(()=>{throw new Error('unsupported');})();
const limit=(kind:XiaozhiAttachmentFormat)=>kind==='office'?DOCUMENT_MAX_INPUT:kind==='image'?4*1048576:1048576;
/** Selection registers a local reference, never uploads or claims the agent viewed it. */
export function createAttachmentService(options:{state:ReturnType<typeof createAttachmentState>;resolve:(sessionId:string)=>Promise<WorkspaceLease>;isCurrent?:()=>boolean}){
 const current=(signal:AbortSignal)=>{signal.throwIfAborted();if(options.isCurrent?.()===false)throw new Error('cancelled');};
 async function readCaptured(sessionId:string,relative:string,signal:AbortSignal,includeBytes=false){
  if(!validAttachmentSession(sessionId)||!validAttachmentPath(relative))throw new Error('invalid_input');current(signal);
  const lease=await options.resolve(sessionId);current(signal);
  if(relative.split('/').some(p=>/^(\.ssh|\.pi|\.aws|\.azure)$/i.test(p)))throw new Error('permission_denied');
  const absolute=approvedFile(lease.path,relative),initial=fs.lstatSync(absolute);
  if(!initial.isFile()||initial.isSymbolicLink()||initial.nlink!==1)throw new Error('permission_denied');
  const kind=format(relative);if(initial.size>limit(kind))throw new Error('too_large');
  const version=fileVersion(initial),handle=await fs.promises.open(absolute,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
   if(fileVersion(await handle.stat())!==version)throw new Error('changed');
   const hasher=createHash('sha256'),chunk=Buffer.alloc(65536),parts:Buffer[]=[];let count=0,sample=Buffer.alloc(0);
   for(;;){current(signal);const read=await handle.read(chunk,0,chunk.length,count);if(!read.bytesRead)break;count+=read.bytesRead;if(count>limit(kind))throw new Error('too_large');const bytes=chunk.subarray(0,read.bytesRead);if(!sample.length)sample=Buffer.from(bytes.subarray(0,64));hasher.update(bytes);if(includeBytes)parts.push(Buffer.from(bytes));}
   current(signal);if(count!==initial.size||fileVersion(await handle.stat())!==version||fileVersion(fs.lstatSync(approvedFile(lease.path,relative)))!==version)throw new Error('changed');
   const mime=detectMime(sample,'application/octet-stream',path.basename(relative)) as string;
   if(kind==='image'){
    const valid=(mime==='image/png'&&sample.length>=8&&sample.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
     ||(mime==='image/jpeg'&&sample.length>=3&&sample[0]===255&&sample[1]===216&&sample[2]===255)
     ||(mime==='image/gif'&&/^GIF8[79]a$/.test(sample.subarray(0,6).toString('ascii')))
     ||(mime==='image/webp'&&sample.subarray(0,4).toString('ascii')==='RIFF'&&sample.subarray(8,12).toString('ascii')==='WEBP');
    if(!valid)throw new Error('unsupported');
   }
   const contentSha256=hasher.digest('hex');current(signal);
   if((await options.resolve(sessionId)).version!==lease.version)throw new Error('changed');current(signal);
   const candidate={sessionId,path:relative,name:path.basename(relative),mime:/\.log$/i.test(relative)&&mime==='application/octet-stream'?'text/plain':mime,size:count,format:kind,workspaceVersion:lease.version,version,contentSha256,
    sourceKey:attachmentIdentity({sessionId,workspaceVersion:lease.version,path:relative,version,contentSha256})};
   return {candidate,...(includeBytes?{bytes:Buffer.concat(parts,count)}:{})};
  }finally{await handle.close();}
 }
 async function capture(sessionId:string,relative:string,signal:AbortSignal){return (await readCaptured(sessionId,relative,signal)).candidate;}
 async function verify(row:PrivateAttachment,signal:AbortSignal){
  if(row.state==='removed')throw new Error('permission_denied');const latest=await capture(row.sessionId,row.path,signal);
  if(latest.workspaceVersion!==row.workspaceVersion||latest.version!==row.version||latest.contentSha256!==row.contentSha256)throw new Error('changed');return latest;
 }
 return {capture,verify,
  /** Main-only bounded bytes for explicitly selected local import. Never projected or sent to a model. */
  async readBytes(sessionId:string,relative:string,signal:AbortSignal){const result=await readCaptured(sessionId,relative,signal,true);return {candidate:result.candidate,bytes:result.bytes!};},
  async select(sessionId:string,relative:string,signal:AbortSignal){const candidate=await capture(sessionId,relative,signal);current(signal);return publicAttachment(await options.state.register(candidate));},
  async preview(sessionId:string,selection:XiaozhiAttachmentSelection,signal:AbortSignal){
   if(!validAttachmentSelection(selection))throw new Error('invalid_input');
   const row=await options.state.get(sessionId,selection.id);if(!row)throw new Error('not_found');if(row.revision!==selection.revision)throw new Error('changed');
   const captured=await verify(row,signal);return {path:captured.path,workspaceVersion:captured.workspaceVersion,version:captured.version};
  },
 };
}
