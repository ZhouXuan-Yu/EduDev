import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { approvedFile } from './workspace-authority';
import { resolveReadableFileRef } from '../office-agent/vendor/hana/lib/file-ref/resource-io';
import { DOCUMENT_SCHEMA,DOCUMENT_MAX_INPUT,isOfficeDocument } from '../../shared/xiaozhi-documents';
import { XIAOZHI_FILES_SCHEMA, type XiaozhiFileEntry, type XiaozhiFileError, type XiaozhiFileFormat, type XiaozhiFileInput,
  type XiaozhiFileList, type XiaozhiFilePreview, type XiaozhiFileResult, type XiaozhiPreviewInput } from '../../shared/xiaozhi-files';

export type WorkspaceLease = { path: string; label: string; version: string };
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const fileVersion = (stat: fs.Stats) => hash([stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':'));
const raise = (code: XiaozhiFileError): never => { throw new Error(code); };
const formats = (name:string):XiaozhiFileFormat => /\.md$/i.test(name)?'markdown':/\.(txt|csv|json|yaml|yml|log)$/i.test(name)?'text':/\.(png|jpe?g|webp|gif)$/i.test(name)?'image':isOfficeDocument(name)?'office':'unsupported';
const errors = new Set<XiaozhiFileError>(['invalid_input','permission_denied','no_workspace','not_found','changed','too_large','unsupported','busy','cancelled','timeout','read_failed','needs_ocr','parse_failed','empty','unavailable','text_unreadable']);
export function validFileRequest(raw:unknown, preview=false): raw is XiaozhiPreviewInput {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return false;
  const value=raw as Record<string,unknown>,keys=['schemaVersion','sessionId','requestId','path','workspaceVersion',...(preview?['version']:[])];
  if(Object.keys(value).some(key=>!keys.includes(key)) || value.schemaVersion!==XIAOZHI_FILES_SCHEMA
    || typeof value.sessionId!=='string' || !/^aisession_[a-f0-9-]{36}$/i.test(value.sessionId)
    || typeof value.requestId!=='string' || !/^xifile_[a-f0-9-]{36}$/i.test(value.requestId)
    || typeof value.path!=='string' || !value.path || value.path.length>500 || /[\\:\x00-\x1f]/.test(value.path)
    || value.path.startsWith('/') || (value.path!=='.' && value.path.split('/').some(part=>!part||part==='.'||part==='..'))
    || value.path.split('/').length>8)return false;
  if(value.workspaceVersion!==undefined && (typeof value.workspaceVersion!=='string'||!/^[a-f0-9]{64}$/.test(value.workspaceVersion)))return false;
  return !preview || (value.path!=='.' && typeof value.workspaceVersion==='string' && typeof value.version==='string' && /^[a-f0-9]{64}$/.test(value.version));
}
const safeStat=(root:string,relative:string)=>{
  if(relative.split(/[\\/]/).some(part=>/^(\.ssh|\.pi|\.aws|\.azure)$/i.test(part)))raise('permission_denied');
  const file=approvedFile(root,relative),stat=fs.lstatSync(file);
  if(stat.isSymbolicLink() || (!stat.isDirectory()&&!stat.isFile()) || (stat.isFile()&&stat.nlink!==1))raise('permission_denied');
  return {file,stat};
};
function imageMime(bytes:Buffer):string {
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=6&&/^GIF8[79]a$/.test(bytes.subarray(0,6).toString('ascii')))return 'image/gif';
  if(bytes.length>=12&&bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')return 'image/webp';
  return raise('unsupported');
}
/** Main-only lease + existing Hana resolver, bounded local reads; no agent/tool mutation. */
export function createWorkspaceFiles(resolve:(sessionId:string)=>Promise<WorkspaceLease>) {
  async function operation<T>(input:XiaozhiFileInput, signal:AbortSignal, run:(lease:WorkspaceLease)=>Promise<T>):Promise<XiaozhiFileResult<T>> {
    try {
      signal.throwIfAborted();const lease=await resolve(input.sessionId);
      if(input.workspaceVersion && input.workspaceVersion!==lease.version)raise('changed');
      const data=await run(lease);signal.throwIfAborted();
      if((await resolve(input.sessionId)).version!==lease.version)raise('changed');
      signal.throwIfAborted();return {ok:true,schemaVersion:XIAOZHI_FILES_SCHEMA,requestId:input.requestId,workspaceVersion:lease.version,data};
    }catch(error){const item=error as Error & {code?:string};const reason=signal.aborted?(signal.reason==='timeout'?'timeout':'cancelled'):
      item.code==='ENOENT'?'not_found':errors.has(item.message as XiaozhiFileError)?item.message as XiaozhiFileError:'read_failed';
      return {ok:false,schemaVersion:XIAOZHI_FILES_SCHEMA,requestId:input.requestId,error:reason};}
  }
  return {
    list(input:XiaozhiFileInput,signal:AbortSignal):Promise<XiaozhiFileResult<XiaozhiFileList>> {
      return operation(input,signal,async lease=>{
        const directory=safeStat(lease.path,input.path);if(!directory.stat.isDirectory())raise('unsupported');
        await resolveReadableFileRef({type:'path',path:directory.file},{cwd:lease.path,allowedRoots:[lease.path]});
        signal.throwIfAborted();const entries:XiaozhiFileEntry[]=[];let partial=false;
        const handle=await fs.promises.opendir(directory.file);let seen=0;
        try{for await(const entry of handle){signal.throwIfAborted();if(++seen>256){partial=true;break;}
          const relative=path.relative(lease.path,path.join(directory.file,entry.name)).split(path.sep).join('/');
          if(relative.length>500 || relative.split('/').length>8 || /[\\:\x00-\x1f]/.test(relative)){partial=true;continue;}
          try{const current=safeStat(lease.path,relative);entries.push({path:relative,name:entry.name,kind:current.stat.isDirectory()?'directory':'file',version:fileVersion(current.stat),size:current.stat.size,format:formats(entry.name)});}
          catch(error){if((error as Error).message!=='permission_denied'&&(error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
        }}finally{await handle.close().catch(()=>undefined);}
        if(fileVersion(safeStat(lease.path,input.path).stat)!==fileVersion(directory.stat))raise('changed');
        entries.sort((a,b)=>a.kind===b.kind?a.name.localeCompare(b.name,'zh-CN'):a.kind==='directory'?-1:1);
        return {label:lease.label,path:input.path,entries,partial};
      });
    },
    preview(input:XiaozhiPreviewInput,signal:AbortSignal):Promise<XiaozhiFileResult<XiaozhiFilePreview>> {
      return operation(input,signal,async lease=>{
        const current=safeStat(lease.path,input.path);if(!current.stat.isFile())raise('unsupported');
        if(fileVersion(current.stat)!==input.version)raise('changed');
        const format=formats(input.path),base={path:input.path,name:path.basename(current.file),version:input.version,size:current.stat.size,format};
        if(format==='unsupported')return base;
        const max=format==='office'?DOCUMENT_MAX_INPUT:format==='image'?4*1048576:1048576;if(current.stat.size>max)raise('too_large');
        await resolveReadableFileRef({type:'path',path:current.file},{cwd:lease.path,allowedRoots:[lease.path]});signal.throwIfAborted();
        const handle=await fs.promises.open(current.file,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW||0));
        try{
          if(fileVersion(await handle.stat())!==input.version)raise('changed');
          const buffer=Buffer.alloc(current.stat.size+1);let count=0;
          while(count<buffer.length){signal.throwIfAborted();const read=await handle.read(buffer,count,buffer.length-count,count);if(!read.bytesRead)break;count+=read.bytesRead;}
          signal.throwIfAborted();const post=await handle.stat();
          if(count!==current.stat.size || fileVersion(post)!==input.version || fileVersion(safeStat(lease.path,input.path).stat)!==input.version)raise('changed');
          const bytes=buffer.subarray(0,count);
          if(format==='image')return {...base,image:`data:${imageMime(bytes)};base64,${bytes.toString('base64')}`};
          if(format==='office'){
            const {extractLocalDocument}=await import('./document-host');signal.throwIfAborted();
            const result=await extractLocalDocument({schemaVersion:DOCUMENT_SCHEMA,requestId:input.requestId,filename:base.name,bytes},signal);
            signal.throwIfAborted();
            if(fileVersion(await handle.stat())!==input.version||fileVersion(safeStat(lease.path,input.path).stat)!==input.version)raise('changed');
            if(!result.ok)return raise(result.error);
            return {...base,text:result.markdown,document:{format:result.format,parser:result.parser,warnings:result.warnings}};
          }
          try { const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))raise('unsupported');return {...base,text}; }
          catch { return raise('unsupported'); }
        }finally{await handle.close();}
      });
    },
  };
}
