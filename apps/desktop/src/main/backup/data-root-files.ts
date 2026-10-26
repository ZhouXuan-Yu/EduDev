import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {hashFileSha256} from '../local-file-security';

/** Derived vectors own exclusive Windows handles and are rebuilt from SQLite facts. */
export const REBUILDABLE_BACKUP_PATHS=['cache/semantic-v1'] as const;
const liveSqlite=new Set(['app.db','app.db-wal','app.db-shm','app.db-journal']);
export async function copyDataBackupFiles(root:string,destination:string):Promise<number>{
 let count=0;
 async function visit(relative:string){
  const source=path.join(root,relative),target=path.join(destination,relative);
  await fs.mkdir(target,{recursive:true});
  const directory=await fs.opendir(source);
  for await(const entry of directory){
   const next=relative?relative+'/'+entry.name:entry.name,canonical=next.toLowerCase();
   if(REBUILDABLE_BACKUP_PATHS.some(p=>canonical===p)||!relative&&liveSqlite.has(canonical))continue;
   if(entry.isSymbolicLink())throw Error('备份源包含链接，请先核对数据目录');
   if(entry.isDirectory())await visit(next);
   else if(entry.isFile()){await fs.copyFile(path.join(root,next),path.join(destination,next));count++;}
   else throw Error('备份源包含不支持的文件类型');
  }
 }
 await visit('');return count;
}

export async function collectDataBackupEntries(root:string){
 const entries:Array<{path:string;size:number;sha256:string}>=[];
 async function visit(relative:string){
  const directory=await fs.opendir(path.join(root,relative));
  for await(const entry of directory){
   if(entry.name==='omni-edu-backup-manifest.v1.json')continue;
   const next=relative?relative+'/'+entry.name:entry.name,file=path.join(root,next);
   if(entry.isSymbolicLink())throw Error('备份包含链接，不能确认完整性');
   if(entry.isDirectory())await visit(next);
   else if(entry.isFile())entries.push({path:next,size:(await fs.stat(file)).size,sha256:await hashFileSha256(file)});
   else throw Error('备份包含不支持的文件类型');
  }
 }
 await visit('');return entries.sort((a,b)=>a.path.localeCompare(b.path));
}

type NativeBackup={completed:boolean;step:(pages:number,callback:(error?:Error&{code?:string})=>void)=>void;finish:(callback:(error?:Error)=>void)=>void};
type NativeDatabase={backup:(destination:string,callback:(error?:Error)=>void)=>NativeBackup};
/** sqlite3's online backup, in bounded page steps; never copy a live DB/WAL pair. */
export async function snapshotDataBackupSqlite(database:unknown,destination:string){
 await new Promise<void>((resolve,reject)=>{
  const deadline=Date.now()+60000;
  const backup=(database as NativeDatabase).backup(destination,error=>{
   if(error){finish(error);return;}step();
  });
  function finish(error?:Error){backup.finish(finalError=>{const failure=error||finalError;failure?reject(failure):resolve();});}
  function step(){
   if(Date.now()>deadline){finish(Error('数据库备份超时，请在任务结束后重试'));return;}
   backup.step(128,error=>{
    if(error&&!['SQLITE_BUSY','SQLITE_LOCKED'].includes(error.code||'')){finish(error);return;}
    if(backup.completed){finish();return;}
    setTimeout(step,error?20:0);
   });
  }
 });
 // A standalone snapshot must not create fresh WAL/SHM files on its first cold read.
 const snapshot=await new Promise<sqlite3.Database>((resolve,reject)=>{const db=new sqlite3.Database(destination,sqlite3.OPEN_READWRITE,error=>error?reject(error):resolve(db));});
 const exec=(sql:string)=>new Promise<void>((resolve,reject)=>snapshot.exec(sql,error=>error?reject(error):resolve()));
 try{
  await exec('PRAGMA journal_mode=DELETE;');
  const tables=await new Promise<Array<{name:string}>>((resolve,reject)=>snapshot.all("SELECT name FROM sqlite_master WHERE type='table'",(error,rows)=>error?reject(error):resolve(rows as Array<{name:string}>)));
  const present=new Set(tables.map(row=>row.name));
  // Cache files are deliberately absent. Clear only their derived completion claims
  // in this exported copy, so a restored app builds a new full snapshot automatically.
  const reset=[...(present.has('retrieval_control')?["UPDATE retrieval_control SET active='',building='',error='' WHERE id=1"]:[]),...['retrieval_generations','retrieval_failures','retrieval_maintenance'].filter(name=>present.has(name)).map(name=>'DELETE FROM '+name)];
  if(reset.length)try{await exec('BEGIN IMMEDIATE;'+reset.join(';')+';COMMIT;');}catch(error){await exec('ROLLBACK;').catch(()=>undefined);throw error;}
 }
 finally{await new Promise<void>((resolve,reject)=>snapshot.close(error=>error?reject(error):resolve()));}
}
