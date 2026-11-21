import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {BACKUP_RESTORE_SCHEMA,type PreparedBackupRestore} from '../../shared/backup-restore';
import {hashFileSha256} from '../local-file-security';
import {conversationOutputLocation} from '../xiaozhi-agent/conversation-output-path';
import {assertBackupCompatibility} from './compatibility';
import {relocateBackupDatabase} from './restore-database';
import {EXTERNAL_OUTPUT_PREFIX,RESTORED_EXTERNAL_DIRECTORY} from './external-outputs';
import {inspectBackupRestore,inside,noLinks,recheckRestorePlan,recoveryReceiptName as receiptName,
  type RestoreSelection,type BackupRestorePlan} from './restore-plan';
export async function readRecoveryReceipt(root:string):Promise<PreparedBackupRestore|null>{
 try{await noLinks(root);const p=path.join(root,receiptName),s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>16384)throw Error('恢复记录无效');const v=JSON.parse(await fs.readFile(p,'utf8')) as PreparedBackupRestore;
  if(v.schemaVersion!==BACKUP_RESTORE_SCHEMA||!/^restore_[a-f0-9-]{36}$/.test(v.id)||v.dataRoot!==await fs.realpath(root)||!path.isAbsolute(v.backupPath)||!Array.isArray(v.warnings))throw Error('恢复记录无效');return v;
 }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
/** A new owned instance only. Never replace source data, a selected existing directory or another output scope. */
export async function prepareBackupRestore(options:RestoreSelection & {
  plan?:BackupRestorePlan;copy?:(from:string,to:string)=>Promise<void>;
}):Promise<PreparedBackupRestore>{
 const plan=options.plan ?? await inspectBackupRestore(options);
 await recheckRestorePlan(plan,options.currentDataRoot);
 const {backup,parent,manifestPath,manifestBytes,files,source,external}=plan;
 const id='restore_'+randomUUID(),instance=path.join(parent,'XiaozhiRecovered-'+id.slice(8)),root=path.join(instance,'OmniEduData');
 await fs.mkdir(instance);await fs.mkdir(root);const outputs=conversationOutputLocation(root),copied:{file:string;size:number;sha256:string}[]=[];
 const externalRoots=(external?.roots||[]).map(r=>({sourceRoot:r.sourceRoot,targetRoot:path.join(outputs.path,RESTORED_EXTERNAL_DIRECTORY,r.prefix),files:files.filter(f=>f.path.startsWith(EXTERNAL_OUTPUT_PREFIX+'/'+r.prefix+'/')).map(f=>f.path.slice(EXTERNAL_OUTPUT_PREFIX.length+r.prefix.length+2))}));
 try{
  for(const entry of files){
   const prefix=source.backupPrefix+'/',output=entry.path.startsWith(prefix),relative=output?entry.path.slice(prefix.length):entry.path;
   const extra=external?.roots.find(r=>entry.path.startsWith(EXTERNAL_OUTPUT_PREFIX+'/'+r.prefix+'/'));
   const from=path.join(backup,entry.path),to=extra?path.join(outputs.path,RESTORED_EXTERNAL_DIRECTORY,extra.prefix,entry.path.slice(EXTERNAL_OUTPUT_PREFIX.length+extra.prefix.length+2)):path.join(output?outputs.path:root,relative);await noLinks(from);const stat=await fs.lstat(from);
   if(!stat.isFile()||stat.nlink!==1||stat.size!==entry.size)throw Error('备份文件已变化，未激活恢复');
   await fs.mkdir(path.dirname(to),{recursive:true});await (options.copy||fs.copyFile)(from,to);
   if(await hashFileSha256(to)!==entry.sha256)throw Error('恢复副本校验失败，未激活恢复');
   copied.push({file:to,size:entry.size,sha256:entry.sha256});
  }
  const again=await options.verify(backup);if(!again.verified||!manifestBytes.equals(await fs.readFile(manifestPath)))throw Error('备份在恢复期间变化，未激活恢复');
  assertBackupCompatibility(again.compatibility);
  const warnings=await relocateBackupDatabase(path.join(root,'app.db'),source.sourceDataRoot,root,source.sourceOutputRoot,outputs.path,externalRoots);
  if(external?.omittedCount)warnings.push(`备份时有 ${external.omittedCount} 项外选目录成果未能纳入；请查看备份清单中的遗漏说明。`);
  const database=copied.find(f=>f.file===path.join(root,'app.db'))!;database.sha256=await hashFileSha256(database.file);database.size=(await fs.stat(database.file)).size;
  const receipt:PreparedBackupRestore={schemaVersion:BACKUP_RESTORE_SCHEMA,id,dataRoot:root,backupPath:backup,fileCount:copied.length,generatedFiles:source.fileCount+(external?.fileCount||0),warnings,purpose:again.purpose,compatibility:again.compatibility,continuity:again.continuity};
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
