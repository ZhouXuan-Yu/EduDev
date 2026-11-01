import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {createHash} from 'node:crypto';
import type {ExternalOutputsBackup} from '../../shared/contracts';
import {conversationOutputLocation} from '../xiaozhi-agent/conversation-output-path';
import {approvedFile} from '../xiaozhi-agent/workspace-authority';
import {hashFileSha256} from '../local-file-security';

export const EXTERNAL_OUTPUT_PREFIX='__xiaozhi_external_outputs__';
export const RESTORED_EXTERNAL_DIRECTORY='RecoveredWorkspaces';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const within=(a:string,b:string)=>{const r=path.relative(a,b);return !r||!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);};
async function noLinks(file:string){let cursor=path.resolve(file);while(true){const stat=await fs.lstat(cursor);if(stat.isSymbolicLink())throw Error('成果路径包含链接，未纳入备份');const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}}

/** Read only the frozen SQLite snapshot, never enumerate an external workspace. */
export async function copyExternalOutputs(dataRoot:string,backupRoot:string):Promise<ExternalOutputsBackup>{
 const db=await new Promise<sqlite3.Database>((resolve,reject)=>{const d=new sqlite3.Database(path.join(backupRoot,'app.db'),sqlite3.OPEN_READONLY,e=>e?reject(e):resolve(d));});
 const all=(q:string)=>new Promise<Record<string,unknown>[]>((resolve,reject)=>db.all(q,(e,r)=>e?reject(e):resolve(r as Record<string,unknown>[])));
 const roots=new Map<string,{sourceRoot:string;prefix:string;fileCount:number}>(),targets=new Map<string,{root:string;relative:string}>();
 const omitted=new Set<string>(),bindings:{session:string;root:string;hash:string}[]=[];
 const outputs=conversationOutputLocation(dataRoot).path;
 const owned=(file:string)=>within(path.resolve(dataRoot),file)||within(outputs,file);
 function add(root:string,relative:string){
  if(!path.isAbsolute(root)||!relative||relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('成果账本路径无效');
  const file=approvedFile(root,relative);if(owned(file))return;
  targets.set(file.toLowerCase(),{root,relative});
 }
 try{
  const tables=new Set((await all("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>String(r.name)));
  if(tables.has('ai_conversation_sessions'))for(const row of await all('SELECT id FROM ai_conversation_sessions')){
   const root=path.join(outputs,String(row.id));bindings.push({session:String(row.id),root,hash:hash(root)});
  }
  for(const table of ['xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs'])if(tables.has(table))for(const row of await all(`SELECT conversation_id,path FROM ${table}`)){
   const root=String(row.path);if(path.isAbsolute(root))bindings.push({session:String(row.conversation_id),root,hash:hash(root)});
  }
  // A saved Office path plus its frozen relative path/hash can locate an older
  // output root even after the teacher selected a different directory.
  if(tables.has('xiaozhi_pi_office_drafts'))for(const row of await all("SELECT conversation_id,workspace_hash,relative_path,result_path FROM xiaozhi_pi_office_drafts WHERE state='saved' AND result_path IS NOT NULL")){
   const file=String(row.result_path),relative=String(row.relative_path);if(!path.isAbsolute(file)||!relative||relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..'))continue;
   let root=file;for(const _part of relative.split('/'))root=path.dirname(root);
   if(hash(root)===row.workspace_hash&&path.relative(root,file).split(path.sep).join('/')===relative)bindings.push({session:String(row.conversation_id),root,hash:hash(root)});
  }
  if(tables.has('xiaozhi_pi_text_changes'))for(const row of await all("SELECT id,conversation_id,workspace_hash,relative_path FROM xiaozhi_pi_text_changes WHERE state IN ('applied','undone','uncertain','executing')")){
   const binding=bindings.find(b=>b.session===row.conversation_id&&b.hash===row.workspace_hash);
   if(binding)add(binding.root,String(row.relative_path));else omitted.add('无法定位历史文本成果目录：'+String(row.id));
  }
  if(tables.has('ai_confirmation_items'))for(const row of await all("SELECT id,session_id,payload_json FROM ai_confirmation_items WHERE action_type='pi_office_copy'")){
   const value=JSON.parse(String(row.payload_json));if(!['executed','verified','uncertain','executing'].includes(value.state))continue;
   const binding=bindings.find(b=>b.session===row.session_id&&b.hash===value.workspaceHash);
   if(binding)add(binding.root,String(value.target));else omitted.add('无法定位历史复制成果目录：'+String(row.id));
  }
  for(const [table,column]of [['document_artifacts','file_path'],['attachments','file_path'],['teacher_resources','local_path'],['mistake_image_analyses','local_path']])if(tables.has(table))for(const row of await all(`SELECT rowid AS backup_id,"${column}" AS file FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}"<>''`)){
   const file=String(row.file);if(!path.isAbsolute(file)){omitted.add('文件路径不是绝对路径：'+table+'/'+String(row.backup_id));continue;}if(owned(file))continue;
   const binding=bindings.filter(b=>within(b.root,file)).sort((a,b)=>b.root.length-a.root.length)[0];
   add(binding?.root||path.dirname(file),path.relative(binding?.root||path.dirname(file),file).split(path.sep).join('/'));
  }
 }finally{await new Promise<void>((resolve,reject)=>db.close(e=>e?reject(e):resolve()));}
 const destination=path.join(backupRoot,EXTERNAL_OUTPUT_PREFIX);try{await fs.lstat(destination);throw Error('数据目录含外部成果备份保留目录');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const facts:{file:string;version:string;sha256:string}[]=[];
 const stamp=(s:import('node:fs').Stats)=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');
 for(const {root,relative}of targets.values()){
  const file=approvedFile(root,relative);let before;
  try{await noLinks(file);before=await fs.lstat(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT'){omitted.add('成果文件已缺失：'+file);continue;}throw e;}
  if(!before.isFile()||before.nlink!==1)throw Error('成果不是独立普通文件，未完成备份');
  const key=hash(root),entry=roots.get(key)||{sourceRoot:root,prefix:key,fileCount:0};roots.set(key,entry);
  const to=path.join(destination,key,relative);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(file,to);
  await noLinks(file);const digest=await hashFileSha256(file);
  if(stamp(before)!==stamp(await fs.lstat(file))||await hashFileSha256(to)!==digest)throw Error('外选目录成果在备份期间变化，请重新备份');
  facts.push({file,version:stamp(before),sha256:digest});entry.fileCount++;
 }
 for(const fact of facts){await noLinks(fact.file);if(stamp(await fs.lstat(fact.file))!==fact.version||await hashFileSha256(fact.file)!==fact.sha256)throw Error('外选目录成果在备份期间变化，请重新备份');}
 return{schemaVersion:1,backupPrefix:EXTERNAL_OUTPUT_PREFIX,roots:[...roots.values()],fileCount:facts.length,omittedCount:omitted.size,omitted:[...omitted].slice(0,64)};
}

/** Descriptive source paths never grant reads during verification/restoration. */
export function readExternalOutputsBackup(raw:unknown,files:Iterable<string>):ExternalOutputsBackup|undefined{
 if(raw===undefined)return undefined;
 const fail=()=>{throw Error('外选目录成果备份信息与清单不一致');};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail();
 const v=raw as ExternalOutputsBackup;
 if(Object.keys(v).sort().join(',')!=='backupPrefix,fileCount,omitted,omittedCount,roots,schemaVersion'||v.schemaVersion!==1||v.backupPrefix!==EXTERNAL_OUTPUT_PREFIX||!Array.isArray(v.roots)||v.roots.length>10000||!Number.isSafeInteger(v.fileCount)||v.fileCount<0||!Number.isSafeInteger(v.omittedCount)||v.omittedCount<0||!Array.isArray(v.omitted)||v.omitted.length!==Math.min(64,v.omittedCount)||v.omitted.some(t=>typeof t!=='string'||!t||t.length>32768))return fail();
 const keys=new Set<string>(),counts=new Map<string,number>();
 for(const row of v.roots){if(!row||typeof row!=='object'||Object.keys(row).sort().join(',')!=='fileCount,prefix,sourceRoot'||typeof row.sourceRoot!=='string'||!path.isAbsolute(row.sourceRoot)||row.prefix!==hash(row.sourceRoot)||keys.has(row.prefix)||!Number.isSafeInteger(row.fileCount)||row.fileCount<=0)return fail();keys.add(row.prefix);}
 for(const file of files)if(file.startsWith(EXTERNAL_OUTPUT_PREFIX+'/')){const key=file.split('/')[1];if(!keys.has(key)||file.split('/').length<3)return fail();counts.set(key,(counts.get(key)||0)+1);}
 if(v.roots.some(r=>counts.get(r.prefix)!==r.fileCount)||[...counts.values()].reduce((a,b)=>a+b,0)!==v.fileCount)return fail();
 return v;
}
