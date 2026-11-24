import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {closeSqlite,openSqlite,setSqliteJournalMode,sqliteExec} from '../sqlite-connections';
import {hashFileSha256} from '../local-file-security';
import {PORTABLE_LOCAL_ENV_FILE, type BackupPurpose} from '../../shared/backup-purpose';

/** Disposable vectors and Word layout PNGs are rebuilt from retained source facts. */
export const REBUILDABLE_BACKUP_PATHS=['cache/semantic-v1','cache/word-question-pages'] as const;
const liveSqlite=new Set(['app.db','app.db-wal','app.db-shm','app.db-journal']);
export async function copyBackupFile(source:string,target:string,signal?:AbortSignal){
 if(!signal){await fs.copyFile(source,target);return;}
 signal.throwIfAborted();
 await pipeline(createReadStream(source),createWriteStream(target,{flags:'wx'}),{signal});
}
const excluded=(relative:string,purpose:BackupPurpose)=>{
 const key=relative.toLowerCase();
 return REBUILDABLE_BACKUP_PATHS.some(item=>key===item) || liveSqlite.has(key) ||
   key==='omni-edu-backup-manifest.v1.json' || purpose==='portable' && key===PORTABLE_LOCAL_ENV_FILE;
};
export async function copyDataBackupFiles(root:string,destination:string,purpose:BackupPurpose='full',signal?:AbortSignal):Promise<number>{
 let count=0;
 async function visit(relative:string){
  signal?.throwIfAborted();
  const source=path.join(root,relative),target=path.join(destination,relative);
  await fs.mkdir(target,{recursive:true});
  const directory=await fs.opendir(source);
  for await(const entry of directory){
   signal?.throwIfAborted();
   const next=relative?relative+'/'+entry.name:entry.name;
   if(excluded(next,purpose))continue;
   if(entry.isSymbolicLink())throw Error('备份源包含链接，请先核对数据目录');
   if(entry.isDirectory())await visit(next);
   else if(entry.isFile()){await copyBackupFile(path.join(root,next),path.join(destination,next),signal);count++;}
   else throw Error('备份源包含不支持的文件类型');
  }
 }
 await visit('');signal?.throwIfAborted();return count;
}

export async function captureBackupSource(root:string,purpose:BackupPurpose,signal?:AbortSignal){
 const entries:Array<{path:string; size:number; sha256:string; identity:string}>=[];
 async function visit(relative:string){
  signal?.throwIfAborted();
  const directory=await fs.opendir(path.join(root,relative));
  for await(const entry of directory){
   signal?.throwIfAborted();
   const next=relative?relative+'/'+entry.name:entry.name;
   if(excluded(next,purpose))continue;
   if(entry.isDirectory()){await visit(next);continue;}
   if(!entry.isFile()||entry.isSymbolicLink())throw Error('backup_source_invalid');
   const file=path.join(root,next);
   const inspect=async()=>{
    const stat=await fs.lstat(file,{bigint:true});
    if(!stat.isFile()||stat.isSymbolicLink())throw Error('backup_source_changed');
    return {size:Number(stat.size),identity:[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(':')};
   };
   const before=await inspect();
   const sha256=await hashFileSha256(file,signal);
   if((await inspect()).identity!==before.identity)throw Error('backup_source_changed');
   entries.push({path:next,sha256,...before});
  }
 }
 await visit('');
 return entries.sort((a,b)=>a.path.localeCompare(b.path));
}

export async function collectDataBackupEntries(root:string,signal?:AbortSignal){
 const entries:Array<{path:string;size:number;sha256:string}>=[];
 async function visit(relative:string){
  const directory=await fs.opendir(path.join(root,relative));
  for await(const entry of directory){
   signal?.throwIfAborted();
   if(entry.name==='omni-edu-backup-manifest.v1.json')continue;
   const next=relative?relative+'/'+entry.name:entry.name,file=path.join(root,next);
   if(entry.isSymbolicLink())throw Error('备份包含链接，不能确认完整性');
   if(entry.isDirectory())await visit(next);
   else if(entry.isFile())entries.push({path:next,size:(await fs.stat(file)).size,sha256:await hashFileSha256(file,signal)});
   else throw Error('备份包含不支持的文件类型');
  }
 }
 await visit('');return entries.sort((a,b)=>a.path.localeCompare(b.path));
}

type NativeBackup={completed:boolean;step:(pages:number,callback:(error?:Error&{code?:string})=>void)=>void;finish:(callback:(error?:Error)=>void)=>void};
type NativeDatabase={backup:(destination:string,callback:(error?:Error)=>void)=>NativeBackup};
/** sqlite3's online backup, in bounded page steps; never copy a live DB/WAL pair. */
export async function snapshotDataBackupSqlite(database:unknown,destination:string,signal?:AbortSignal){
 signal?.throwIfAborted();
 await new Promise<void>((resolve,reject)=>{
  const deadline=Date.now()+60000;
  const backup=(database as NativeDatabase).backup(destination,error=>{
   if(error){finish(error);return;}step();
  });
  function finish(error?:Error){backup.finish(finalError=>{const failure=error||finalError;failure?reject(failure):resolve();});}
  function step(){
   if(signal?.aborted){finish(signal.reason instanceof Error?signal.reason:Error('cancelled'));return;}
   if(Date.now()>deadline){finish(Error('数据库备份超时，请在任务结束后重试'));return;}
   backup.step(128,error=>{
    if(error&&!['SQLITE_BUSY','SQLITE_LOCKED'].includes(error.code||'')){finish(error);return;}
    if(backup.completed){finish();return;}
    setTimeout(step,error?20:0);
   });
  }
 });
 signal?.throwIfAborted();
 // A standalone snapshot must not create fresh WAL/SHM files on its first cold read.
 const snapshot=await openSqlite(destination,'backupWrite');
 const exec=(sql:string)=>sqliteExec(snapshot,sql);
 try{
  await setSqliteJournalMode(snapshot,'delete');
  const tables=await new Promise<Array<{name:string}>>((resolve,reject)=>snapshot.all("SELECT name FROM sqlite_master WHERE type='table'",(error,rows)=>error?reject(error):resolve(rows as Array<{name:string}>)));
  const present=new Set(tables.map(row=>row.name));
  // Cache files are deliberately absent. Clear only their derived completion claims
  // in this exported copy, so a restored app builds a new full snapshot automatically.
  const reset=[...(present.has('retrieval_control')?["UPDATE retrieval_control SET active='',building='',error='' WHERE id=1"]:[]),...['retrieval_generations','retrieval_failures','retrieval_maintenance','material_word_proof_files','material_word_proofs'].filter(name=>present.has(name)).map(name=>'DELETE FROM '+name)];
  if(reset.length)try{await exec('BEGIN IMMEDIATE;'+reset.join(';')+';COMMIT;');}catch(error){await exec('ROLLBACK;').catch(()=>undefined);throw error;}
 }
 finally{await closeSqlite(snapshot);}
}
