import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {BACKUP_RESTORE_SCHEMA,type PreparedBackupRestore} from '../../shared/backup-restore';
import type {DataBackupVerificationResult} from '../../shared/contracts';
import {hashFileSha256} from '../local-file-security';
import {conversationOutputLocation} from '../xiaozhi-agent/conversation-output-path';
import {relocateBackupDatabase} from './restore-database';
const receiptName='xiaozhi-recovery.v1.json';
const inside=(a:string,b:string)=>{const r=path.relative(a,b);return !r||!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);};
async function noLinks(file:string){let cursor=path.resolve(file);while(true){const s=await fs.lstat(cursor);if(s.isSymbolicLink())throw Error('恢复路径包含链接，请选择实际目录');const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}}
export async function readRecoveryReceipt(root:string):Promise<PreparedBackupRestore|null>{
 try{await noLinks(root);const p=path.join(root,receiptName),s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>16384)throw Error('恢复记录无效');const v=JSON.parse(await fs.readFile(p,'utf8')) as PreparedBackupRestore;
  if(v.schemaVersion!==BACKUP_RESTORE_SCHEMA||!/^restore_[a-f0-9-]{36}$/.test(v.id)||v.dataRoot!==await fs.realpath(root)||!path.isAbsolute(v.backupPath)||!Array.isArray(v.warnings))throw Error('恢复记录无效');return v;
 }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
/** A new owned instance only. Never replace source data, a selected existing directory or another output scope. */
export async function prepareBackupRestore(options:{backupPath:string;parent:string;currentDataRoot:string;verify:(root:string)=>Promise<DataBackupVerificationResult>;copy?:(from:string,to:string)=>Promise<void>}):Promise<PreparedBackupRestore>{
 await noLinks(options.backupPath);await noLinks(options.parent);
 const backup=await fs.realpath(options.backupPath),parent=await fs.realpath(options.parent),current=await fs.realpath(options.currentDataRoot);
 if(inside(backup,parent)||inside(current,parent)||inside(conversationOutputLocation(current).path,parent))throw Error('恢复位置须在当前数据、生成文件和备份目录之外');
 const verification=await options.verify(backup);if(!verification.verified)throw Error(verification.errorMessage||'备份校验失败，未创建恢复目录');
 const manifestPath=path.join(backup,'omni-edu-backup-manifest.v1.json');const manifestBytes=await fs.readFile(manifestPath),manifest=JSON.parse(manifestBytes.toString('utf8')) as {files:{path:string;size:number;sha256:string}[]};
 const source=verification.conversationOutputs;if(!source)throw Error('此旧备份缺少原数据目录信息，不能猜测文件位置；请在原版本创建包含生成文件信息的新备份。原备份仍可校验。');
 const originalScope=createHash('sha256').update(source.sourceDataRoot.toLowerCase()).digest('hex').slice(0,16);
 if(source.scope!==originalScope||path.resolve(source.sourceOutputRoot)!==path.join(path.dirname(source.sourceDataRoot),'XiaozhiOutputs',originalScope))throw Error('备份原目录信息不一致，未创建恢复目录');
 if(!manifest.files.some(f=>f.path==='app.db'))throw Error('备份缺少数据库，未创建恢复目录');
 const names=new Set<string>();for(const entry of manifest.files){const parts=entry.path.split('/');if(!entry.path||entry.path.includes('\\')||parts.some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f:]/.test(p))||names.has(entry.path.toLowerCase())||!Number.isSafeInteger(entry.size)||entry.size<0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('备份包含不能恢复的路径或重复文件');names.add(entry.path.toLowerCase());}
 const required=manifest.files.reduce((n,f)=>n+f.size,0),space=await fs.statfs(parent);if(required>Number(space.bavail)*Number(space.bsize)-16*1024*1024)throw Error('恢复位置空间不足，原数据未更改');
 const id='restore_'+randomUUID(),instance=path.join(parent,'XiaozhiRecovered-'+id.slice(8)),root=path.join(instance,'OmniEduData');
 await fs.mkdir(instance);await fs.mkdir(root);const outputs=conversationOutputLocation(root),copied:{file:string;size:number;sha256:string}[]=[];
 try{
  for(const entry of manifest.files){
   if(entry.path===receiptName)continue; // A previous restoration receipt is superseded by this new instance.
   const prefix=source.backupPrefix+'/',output=entry.path.startsWith(prefix),relative=output?entry.path.slice(prefix.length):entry.path;
   const from=path.join(backup,entry.path),to=path.join(output?outputs.path:root,relative);await noLinks(from);const stat=await fs.lstat(from);
   if(!stat.isFile()||stat.nlink!==1||stat.size!==entry.size)throw Error('备份文件已变化，未激活恢复');
   await fs.mkdir(path.dirname(to),{recursive:true});await (options.copy||fs.copyFile)(from,to);
   if(await hashFileSha256(to)!==entry.sha256)throw Error('恢复副本校验失败，未激活恢复');
   copied.push({file:to,size:entry.size,sha256:entry.sha256});
  }
  const again=await options.verify(backup);if(!again.verified||!manifestBytes.equals(await fs.readFile(manifestPath)))throw Error('备份在恢复期间变化，未激活恢复');
  const warnings=await relocateBackupDatabase(path.join(root,'app.db'),source.sourceDataRoot,root,source.sourceOutputRoot,outputs.path);
  const database=copied.find(f=>f.file===path.join(root,'app.db'))!;database.sha256=await hashFileSha256(database.file);database.size=(await fs.stat(database.file)).size;
  const receipt:PreparedBackupRestore={schemaVersion:BACKUP_RESTORE_SCHEMA,id,dataRoot:root,backupPath:backup,fileCount:copied.length,generatedFiles:source.fileCount,warnings};
  await fs.writeFile(path.join(root,receiptName),JSON.stringify(receipt,null,2),'utf8');
  await fs.writeFile(path.join(instance,'restoration-files.v1.json'),JSON.stringify({schemaVersion:BACKUP_RESTORE_SCHEMA,id,sourceManifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),files:copied,boundary:'Verified new-copy files after address migration; original events/native/check reports stay unchanged.'},null,2),'utf8');
  return receipt;
 }catch(e){await fs.writeFile(path.join(instance,'RESTORE_FAILED.txt'),e instanceof Error?e.message:'恢复失败','utf8').catch(()=>undefined);throw e;}
}
/** Recheck prepared bytes before committing the profile selection; failures never switch data. */
export async function verifyPreparedBackupRestore(value:PreparedBackupRestore){
 const receipt=await readRecoveryReceipt(value.dataRoot);if(!receipt||receipt.id!==value.id)throw Error('恢复副本已失效');
 const instance=path.dirname(value.dataRoot),file=path.join(instance,'restoration-files.v1.json');await noLinks(file);
 const manifest=JSON.parse(await fs.readFile(file,'utf8')) as {schemaVersion:string;id:string;files:{file:string;size:number;sha256:string}[]};
 if(manifest.schemaVersion!==BACKUP_RESTORE_SCHEMA||manifest.id!==value.id||!Array.isArray(manifest.files)||manifest.files.length!==value.fileCount)throw Error('恢复副本清单无效');
 for(const entry of manifest.files){if(!path.isAbsolute(entry.file)||!inside(instance,entry.file)||!Number.isSafeInteger(entry.size)||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('恢复副本清单无效');await noLinks(entry.file);const s=await fs.lstat(entry.file);if(!s.isFile()||s.nlink!==1||s.size!==entry.size||await hashFileSha256(entry.file)!==entry.sha256)throw Error('恢复副本在准备后已变化，未切换数据');}
}
