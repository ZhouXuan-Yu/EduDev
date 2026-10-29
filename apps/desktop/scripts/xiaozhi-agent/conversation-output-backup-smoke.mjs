import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {conversationOutputLocation} from '../../src/main/xiaozhi-agent/conversation-output-path.ts';
import {copyConversationOutputs,assertOutputBackupDestination,readConversationOutputsBackup,OUTPUT_BACKUP_PREFIX} from '../../src/main/backup/conversation-outputs.ts';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-output-backup-')),data=path.join(root,'data'),other=path.join(root,'other-data');await fs.mkdir(data);await fs.mkdir(other);
const location=conversationOutputLocation(data),foreign=conversationOutputLocation(other),ids=[`aisession_${randomUUID()}`,`aisession_${randomUUID()}`];
const report={ok:false,checks:[],boundary:'Original output location and backup helper, real files/hash-independent byte comparisons; no full restore, UI, natural provider or complete C03 acceptance.'};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
try{
 await check('Missing default output root is described without creating or authorizing it',async()=>{
  const backup=path.join(root,'empty-backup');await fs.mkdir(backup);const meta=await copyConversationOutputs(data,backup);assert.equal(meta.fileCount,0);await assert.rejects(fs.stat(location.path),{code:'ENOENT'});assert.equal(readConversationOutputsBackup(undefined,[]),undefined);
 });
 for(const [i,id]of ids.entries()){await fs.mkdir(path.join(location.path,id),{recursive:true});await fs.writeFile(path.join(location.path,id,'同名.html'),'会话'+i);}
 await fs.writeFile(path.join(location.path,ids[0],'opaque.bin'),Buffer.from([0,255,32,4]));await fs.mkdir(foreign.path,{recursive:true});await fs.writeFile(path.join(foreign.path,'other.txt'),'不属于本实例');
 await check('Backup contains both same-name conversation files and binary bytes without scanning another data instance',async()=>{
  const backup=path.join(root,'full');await fs.mkdir(backup);const meta=await copyConversationOutputs(data,backup);assert.equal(meta.fileCount,3);assert.equal(meta.scope,location.scope);
  for(const[i,id]of ids.entries())assert.equal(await fs.readFile(path.join(backup,OUTPUT_BACKUP_PREFIX,id,'同名.html'),'utf8'),'会话'+i);
  assert((await fs.readFile(path.join(backup,OUTPUT_BACKUP_PREFIX,ids[0],'opaque.bin'))).equals(Buffer.from([0,255,32,4])));await assert.rejects(fs.stat(path.join(backup,OUTPUT_BACKUP_PREFIX,'other.txt')),{code:'ENOENT'});
  assert.equal(readConversationOutputsBackup(meta,[...ids.map(id=>OUTPUT_BACKUP_PREFIX+'/'+id+'/同名.html'),OUTPUT_BACKUP_PREFIX+'/'+ids[0]+'/opaque.bin']).fileCount,3);
  assert.throws(()=>readConversationOutputsBackup({...meta,fileCount:4},[]),/清单不一致/);
 });
 await check('Targets under the generated root are rejected before recursive backup can begin',async()=>{
  await assert.rejects(assertOutputBackupDestination(data,location.path),/不能位于/);await assert.rejects(assertOutputBackupDestination(data,path.join(location.path,'not-created')),/不能位于/);await assert.rejects(fs.stat(path.join(location.path,'not-created')),{code:'ENOENT'});
 });
 await check('A reserved backup-prefix collision fails instead of replacing original data',async()=>{
  const backup=path.join(root,'collision');await fs.mkdir(path.join(backup,OUTPUT_BACKUP_PREFIX),{recursive:true});await fs.writeFile(path.join(backup,OUTPUT_BACKUP_PREFIX,'teacher.txt'),'keep');await assert.rejects(copyConversationOutputs(data,backup),/保留目录/);assert.equal(await fs.readFile(path.join(backup,OUTPUT_BACKUP_PREFIX,'teacher.txt'),'utf8'),'keep');
 });
 await check('Editing a generated file during its copy invalidates the backup attempt',async()=>{
  const backup=path.join(root,'changed');await fs.mkdir(backup);const original=fs.copyFile;
  fs.copyFile=async(...args)=>{await original(...args);await fs.appendFile(args[0],'changed');};
  try{await assert.rejects(copyConversationOutputs(data,backup),/备份期间有变化/);}finally{fs.copyFile=original;}
 });
 await check('A directory junction is rejected and its target bytes remain unchanged',async()=>{
  const target=path.join(root,'teacher'),link=path.join(location.path,'linked');await fs.mkdir(target);await fs.writeFile(path.join(target,'private.txt'),'private');await fs.symlink(target,link,'junction');
  const backup=path.join(root,'linked-backup');await fs.mkdir(backup);await assert.rejects(copyConversationOutputs(data,backup),/链接/);assert.equal(await fs.readFile(path.join(target,'private.txt'),'utf8'),'private');
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);console.error(report.error);process.exitCode=1;}
finally{await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root}));}
