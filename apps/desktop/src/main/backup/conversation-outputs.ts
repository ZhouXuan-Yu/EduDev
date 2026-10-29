import fs from 'node:fs/promises';
import path from 'node:path';
import {conversationOutputLocation} from '../xiaozhi-agent/conversation-output-path';
import type {ConversationOutputsBackup} from '../../shared/contracts';

export const OUTPUT_BACKUP_PREFIX='__xiaozhi_outputs__';
const within=(root:string,target:string)=>{const rel=path.relative(root,target);return !rel||!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep);};
async function noLinks(target:string,missing=false){
 const absolute=path.resolve(target),anchor=path.parse(absolute).root;let current=anchor;
 for(const part of absolute.slice(anchor.length).split(path.sep).filter(Boolean)){
  current=path.join(current,part);let stat;
  try{stat=await fs.lstat(current);}catch(e){if(missing&&(e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}
  if(stat.isSymbolicLink())throw Error('备份路径包含链接，请选择实际目录');
 }
}
export async function assertOutputBackupDestination(dataRoot:string,destination:string){
 const source=conversationOutputLocation(dataRoot);await noLinks(source.path,true);await noLinks(destination,true);
 if(within(source.path,path.resolve(destination)))throw Error('备份目标不能位于小智生成文件目录内，避免递归复制');
 return source;
}
/** Add generated files to the original complete backup without copying other instances or private grants. */
export async function copyConversationOutputs(dataRoot:string,backupRoot:string):Promise<ConversationOutputsBackup>{
 const source=await assertOutputBackupDestination(dataRoot,backupRoot),destination=path.join(backupRoot,OUTPUT_BACKUP_PREFIX);
 try{await fs.lstat(destination);throw Error('数据目录含备份保留目录，请先核对：'+OUTPUT_BACKUP_PREFIX);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 let count=0;
 const facts:{relative:string;size:number;mtimeMs:number;ino:number;dev:number}[]=[];
 async function visit(relative:string){
  const directory=path.join(source.path,relative);await noLinks(directory);
  const entries=await fs.opendir(directory);await fs.mkdir(path.join(destination,relative),{recursive:true});
  for await(const entry of entries){
   const next=relative?relative+'/'+entry.name:entry.name,file=path.join(source.path,next);await noLinks(file);
   const before=await fs.lstat(file);
   if(before.isDirectory())await visit(next);
   else if(before.isFile()&&before.nlink===1){
    await fs.copyFile(file,path.join(destination,next));const after=await fs.lstat(file);await noLinks(file);
    if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino||after.dev!==before.dev)throw Error('生成文件在备份期间有变化，请重新备份');
    facts.push({relative:next,size:before.size,mtimeMs:before.mtimeMs,ino:before.ino,dev:before.dev});count++;
   }else throw Error('生成文件包含链接或不支持的类型，未完成备份');
  }
 }
 let present=true;try{await fs.lstat(source.path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;present=false;}
 if(present)await visit('');
 // A later edit to a previously copied file also invalidates this attempt.
 for(const fact of facts){const file=path.join(source.path,fact.relative);await noLinks(file);const stat=await fs.lstat(file);if(stat.size!==fact.size||stat.mtimeMs!==fact.mtimeMs||stat.ino!==fact.ino||stat.dev!==fact.dev)throw Error('生成文件在备份期间有变化，请重新备份');}
 return{schemaVersion:1,sourceDataRoot:source.dataRoot,sourceOutputRoot:source.path,scope:source.scope,backupPrefix:OUTPUT_BACKUP_PREFIX,fileCount:count};
}

/** Old v1 manifests omit this extension. Source paths are descriptive, never followed during verification. */
export function readConversationOutputsBackup(raw:unknown,files:Iterable<string>):ConversationOutputsBackup|undefined{
 if(raw===undefined)return undefined;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('生成文件备份信息无效');
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).length!==6||x.schemaVersion!==1||x.backupPrefix!==OUTPUT_BACKUP_PREFIX||typeof x.sourceDataRoot!=='string'||!path.isAbsolute(x.sourceDataRoot)
  ||typeof x.sourceOutputRoot!=='string'||!path.isAbsolute(x.sourceOutputRoot)||typeof x.scope!=='string'||!/^[a-f0-9]{16}$/.test(x.scope)||!Number.isSafeInteger(x.fileCount)||Number(x.fileCount)<0
  ||[...files].filter(f=>f.startsWith(OUTPUT_BACKUP_PREFIX+'/')).length!==x.fileCount)throw Error('生成文件备份信息与清单不一致');
 return x as ConversationOutputsBackup;
}
