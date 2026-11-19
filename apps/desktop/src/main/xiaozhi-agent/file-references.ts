import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {Sql} from './session-state';
import {approvedFile} from './workspace-authority';
import {fileVersion,type WorkspaceLease} from './workspace-files';

export const FILE_REFERENCE_SCHEMA='xiaozhi.file-reference.v1';
const prefix='xiaozhi-file://';
const reference=(value:unknown):value is string=>typeof value==='string'&&/^xiaozhi-file:\/\/[a-f0-9]{32}$/.test(value);
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
type FileReference={selector:string;sessionId:string;taskId:string;workspace:string;relative:string;identity:string;version:string;kind:'file'|'directory'|'blocked_link'};
type Result=Awaited<ReturnType<ToolDefinition['execute']>>;
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Private derived references share the existing SQLite connection and lifecycle. */
export function createFileReferenceState(sql:Sql){
 const decode=(row:Record<string,unknown>):FileReference=>{
  if(Number(row.schema_version)!==1||!reference(row.selector)||!['file','directory','blocked_link'].includes(String(row.kind)))throw Error('configuration');
  return{selector:String(row.selector),sessionId:String(row.session_id),taskId:String(row.task_id),workspace:String(row.workspace_identity),relative:String(row.relative_path),identity:String(row.physical_identity),version:String(row.file_version),kind:String(row.kind) as FileReference['kind']};
 };
 return{
  async migrate(){
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_file_references(
    selector TEXT PRIMARY KEY,schema_version INTEGER NOT NULL DEFAULT 1,session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,workspace_identity TEXT NOT NULL,relative_path TEXT NOT NULL,
    physical_identity TEXT NOT NULL,file_version TEXT NOT NULL,kind TEXT NOT NULL,
    created_at TEXT NOT NULL,UNIQUE(session_id,task_id,workspace_identity,relative_path,physical_identity,file_version))`);
   if(!(await sql.all('PRAGMA table_info(xiaozhi_file_references)')).some(row=>row.name==='schema_version'))await sql.run('ALTER TABLE xiaozhi_file_references ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1');
  },
  async get(selector:string){const row=(await sql.all('SELECT * FROM xiaozhi_file_references WHERE selector=?',[selector]))[0];return row?decode(row):undefined;},
  async put(value:Omit<FileReference,'selector'>){
   const selector=prefix+randomUUID().replaceAll('-','');
   await sql.run(`INSERT INTO xiaozhi_file_references(selector,session_id,task_id,workspace_identity,relative_path,physical_identity,file_version,kind,created_at)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id,task_id,workspace_identity,relative_path,physical_identity,file_version) DO NOTHING`,
    [selector,value.sessionId,value.taskId,value.workspace,value.relative,value.identity,value.version,value.kind,new Date().toISOString()]);
   const row=(await sql.all(`SELECT * FROM xiaozhi_file_references WHERE session_id=? AND task_id=? AND workspace_identity=? AND relative_path=? AND physical_identity=? AND file_version=?`,
    [value.sessionId,value.taskId,value.workspace,value.relative,value.identity,value.version]))[0];
   if(!row)throw Error('event_persistence');return decode(row);
  },
 };
}

/** References identify a source. Permission Engine still authorizes every operation. */
export function createFileReferenceProjection(options:{state:ReturnType<typeof createFileReferenceState>;sessionId:string;taskId:string;
 workspace:()=>Promise<WorkspaceLease>;current:()=>boolean;sanitize:(text:string)=>Promise<string>;sanitizer?:()=>Promise<(text:string)=>Promise<string>>;
 fileLabel?:(tool:string,relative:string)=>Promise<string>}){
 const fence=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw Error('permission_denied');};
 async function authority(signal?:AbortSignal){
  fence(signal);const lease=await options.workspace();
  if((await fs.lstat(lease.path)).isSymbolicLink())throw Error('permission_denied');
  const root=await fs.realpath(lease.path),stat=await fs.lstat(root);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('permission_denied');fence(signal);
  return{lease,root,identity:hash([process.platform==='win32'?root.toLowerCase():root,stat.dev,stat.ino,lease.version])};
 }
 async function facts(relative:string,scope:Awaited<ReturnType<typeof authority>>,blocked=false){
  const file=blocked?path.join(approvedFile(scope.root,path.dirname(relative)),path.basename(relative)):approvedFile(scope.root,relative),stat=await fs.lstat(file);
  if(blocked){
   if(!stat.isSymbolicLink())throw Error('source_changed');
   return{relative:path.relative(scope.root,file).replaceAll('\\','/'),identity:hash([stat.dev,stat.ino]),version:fileVersion(stat),kind:'blocked_link' as const};
  }
  if(stat.isSymbolicLink()||!stat.isFile()&&!stat.isDirectory()||stat.isFile()&&stat.nlink!==1)throw Error('permission_denied');
  const actual=await fs.realpath(file);if(actual.toLowerCase()!==path.resolve(file).toLowerCase())throw Error('permission_denied');
  return{relative:path.relative(scope.root,actual).replaceAll('\\','/')||'.',identity:hash([stat.dev,stat.ino]),version:fileVersion(stat),kind:stat.isDirectory()?'directory' as const:'file' as const};
 }
 async function stored(selector:string,signal?:AbortSignal){
  if(!reference(selector))throw Error('invalid_input');
  const scope=await authority(signal),row=await options.state.get(selector);fence(signal);
  if(!row||row.sessionId!==options.sessionId||row.taskId!==options.taskId||row.workspace!==scope.identity)throw Error('permission_denied');
  approvedFile(scope.root,row.kind==='blocked_link'?path.dirname(row.relative):row.relative);
  return{row,scope};
 }
 async function resolve(value:string,signal?:AbortSignal){
  fence(signal);if(!value.startsWith(prefix))return value;
  const {row,scope}=await stored(value,signal);if(row.kind==='blocked_link')throw Error('permission_denied');
  const actual=await facts(row.relative,scope);fence(signal);
  if(actual.identity!==row.identity||actual.version!==row.version||actual.kind!==row.kind)throw Error('source_changed');
  return row.relative;
 }
 async function issue(relative:string,signal?:AbortSignal,blocked=false){
  const scope=await authority(signal),actual=await facts(await resolve(relative,signal),scope,blocked);fence(signal);
  const row=await options.state.put({sessionId:options.sessionId,taskId:options.taskId,workspace:scope.identity,...actual});fence(signal);
  if((await authority(signal)).identity!==scope.identity)throw Error('permission_denied');return row;
 }
 const pathTools=new Set(['office_list_files','office_file_stat','office_read_text','office_read_document','office_create_text','office_edit_text','office_create_science_figure','office_create_document']);
 const relatedTools=new Set([...pathTools,'office_copy_file','capability_execute','office_deliver_files']);
 const historyTools=new Set([...relatedTools,'update_task_plan']);
 async function input(tool:string,raw:unknown,signal?:AbortSignal){
  if(!relatedTools.has(tool)||!object(raw))return raw;const value=structuredClone(raw);
  if(pathTools.has(tool)&&typeof value.path==='string')value.path=await resolve(value.path,signal);
  if(tool==='office_copy_file')for(const field of ['source','target'])if(typeof value[field]==='string')value[field]=await resolve(value[field],signal);
  if(tool==='capability_execute'&&value.requirement?.capabilityId==='edu.workspace.file.stat'&&object(value.input)&&typeof value.input.path==='string')value.input.path=await resolve(value.input.path,signal);
  if(tool==='office_create_document'&&Array.isArray(value.sources))for(const source of value.sources)if(object(source)&&typeof source.path==='string')source.path=await resolve(source.path,signal);
  if(tool==='office_deliver_files'&&Array.isArray(value.files))for(const file of value.files){
   if(!object(file))continue;if(typeof file.path==='string')file.path=await resolve(file.path,signal);
   if(Array.isArray(file.sources))for(const source of file.sources)if(object(source)&&typeof source.path==='string')source.path=await resolve(source.path,signal);
  }
  return value;
 }
 async function canonical(tool:string,payload:Record<string,any>){
  if(payload.fileReferenceSchema!==FILE_REFERENCE_SCHEMA)return payload;
  const value=structuredClone(payload);delete value.fileReferenceSchema;
  if(object(value.data)&&['office_list_files','office_file_stat','office_read_text'].includes(tool)){
   if(reference(value.data.source))value.data.source=(await stored(value.data.source)).row.relative;
   delete value.data.sourceLabel;delete value.data.labels;
   if(tool==='office_list_files')for(const entry of value.data.entries){
    if(reference(entry.name)){const item=await stored(entry.name);entry.name=path.posix.basename(item.row.relative);}
   }
  }
  if(tool==='office_copy_file'&&object(value.data))for(const field of ['source','target'])if(reference(value.data[field]))value.data[field]=(await stored(value.data[field])).row.relative;
  if(tool==='capability_execute'&&value.capabilityId==='edu.workspace.file.stat'&&object(value.data)&&reference(value.data.path)){
   value.data.path=(await stored(value.data.path)).row.relative;delete value.data.pathLabel;
  }
  if(typeof value.file==='string'&&reference(value.file)){
   const row=(await stored(value.file)).row;value.file=options.fileLabel?await options.fileLabel(tool,row.relative):row.relative;delete value.fileLabel;
  }
  if(tool==='office_deliver_files'&&Array.isArray(value.files))for(const file of value.files){
   if(!object(file)||!reference(file.file))continue;
   const row=(await stored(file.file)).row;file.file=options.fileLabel?await options.fileLabel(file.format==='text'?'office_create_text':'office_create_document',row.relative):row.relative;delete file.fileLabel;
  }
  return value;
 }
 async function project(tool:string,result:Result,rawInput?:unknown,signal?:AbortSignal):Promise<Result>{
  if(!relatedTools.has(tool))return result;
  if(!result.content.some(part=>part.type==='text'))return result;
  const clean=options.sanitizer?await options.sanitizer():options.sanitize;
  const content=[];
  for(const part of result.content){
   if(part.type!=='text'||typeof part.text!=='string'){content.push(part);continue;}
   let payload:Record<string,any>;try{const parsed=JSON.parse(part.text);if(!object(parsed)){content.push(part);continue;}payload=parsed;}catch{content.push(part);continue;}
   let changed=false;
   if(tool==='office_read_text'&&object(payload.data)&&typeof payload.data.text==='string'){
    const text=await clean(payload.data.text);if(text!==payload.data.text){payload.data.text=text;payload.data.sanitized=true;changed=true;}
   }
   if(payload.fileReferenceSchema===FILE_REFERENCE_SCHEMA){content.push(changed?{...part,text:JSON.stringify(payload)}:part);continue;}
   if(payload.success===true&&object(payload.data)&&['office_list_files','office_file_stat','office_read_text'].includes(tool)){
    const relative=payload.data.source||'.',sourceLabel=await clean(relative),sensitiveSource=sourceLabel!==relative;
    if(sensitiveSource){
     const source=await issue(relative,signal);
     if(typeof payload.data.version==='string'&&payload.data.version!==source.version)throw Error('source_changed');
     payload.data.source=source.selector;payload.data.sourceLabel=sourceLabel;changed=true;
    }
    if(tool==='office_list_files'){
     const labels:Record<string,string>={};
     for(const entry of payload.data.entries){
      const label=await clean(entry.name);
      if(label===entry.name&&!sensitiveSource)continue;
      const row=await issue(path.posix.join(relative,entry.name),signal,entry.kind==='blocked_link');entry.name=row.selector;labels[row.selector]=label;changed=true;
     }
     if(Object.keys(labels).length)payload.data.labels=labels;
    }
   }
   if(payload.success===true&&tool==='office_copy_file'&&object(payload.data)){
    for(const field of ['source','target'])if(await clean(payload.data[field])!==payload.data[field]){const row=await issue(payload.data[field],signal);payload.data[field]=row.selector;changed=true;}
   }
   if(tool==='capability_execute'&&payload.capabilityId==='edu.workspace.file.stat'&&object(payload.data)&&typeof payload.data.path==='string'){
    const label=await clean(payload.data.path);
    if(label!==payload.data.path){const row=await issue(payload.data.path,signal);if(row.version!==payload.data.version)throw Error('source_changed');payload.data.path=row.selector;payload.data.pathLabel=label;changed=true;}
   }
   if(tool==='office_read_document'&&object(payload.source)&&typeof payload.source.title==='string'){
    const title=await clean(payload.source.title);if(title!==payload.source.title){payload.source.title=title;changed=true;}
   }
   if(['office_edit_text','office_create_text','office_create_science_figure','office_create_document'].includes(tool)&&typeof payload.file==='string'){
    let relative=object(rawInput)&&typeof rawInput.path==='string'?rawInput.path:payload.file;
    if(reference(relative))relative=(await stored(relative,signal)).row.relative;
    const label=await clean(relative);
    if(label!==relative){
     try{const row=await issue(relative,signal);payload.file=row.selector;}catch(error){fence(signal);if(!result.isError)throw error;payload.file=await clean(payload.file);}
     payload.fileLabel=label;changed=true;
    }
   }
   if(tool==='office_deliver_files'&&Array.isArray(payload.files)){
    for(const file of payload.files){
     if(!object(file)||typeof file.file!=='string')continue;
     const original=object(rawInput)&&Array.isArray(rawInput.files)?rawInput.files.find((item:unknown)=>object(item)&&item.fileId===file.fileId):undefined;
     let relative=object(original)&&typeof original.path==='string'?original.path:file.file;
     if(reference(relative))relative=(await stored(relative,signal)).row.relative;
     const label=await clean(relative);if(label===relative)continue;
     try{file.file=(await issue(relative,signal)).selector;}catch(error){fence(signal);if(file.outcome==='applied'||file.outcome==='saved')throw error;file.file=label;}
     file.fileLabel=label;changed=true;
    }
    if(object(payload.repairDraft)&&typeof payload.repairDraft.path==='string'){
     const label=await clean(payload.repairDraft.path);if(label!==payload.repairDraft.path){payload.repairDraft.path=label;changed=true;}
    }
   }
   if(changed){fence(signal);payload.fileReferenceSchema=FILE_REFERENCE_SCHEMA;content.push({...part,text:JSON.stringify(payload)});}else content.push(part);
  }
  return{...result,content};
 }
 // Native history stays local and unchanged. Only the provider context copy is
 // projected, including legacy tool arguments that predate file references.
 async function history<T>(messages:T[],signal?:AbortSignal):Promise<T[]>{
  if(!messages.some(message=>object(message)&&(message.role==='toolResult'&&relatedTools.has(message.toolName)||message.role==='assistant'&&Array.isArray(message.content)&&message.content.some(part=>object(part)&&part.type==='toolCall'&&historyTools.has(part.name)))))return messages;
  const clean=options.sanitizer?await options.sanitizer():options.sanitize;
  const output:T[]=[];
  for(const message of messages){
   if(!object(message)){output.push(message);continue;}
   let value=message;
   if(message.role==='toolResult'&&typeof message.toolName==='string'&&Array.isArray(message.content)){
    try{const projected=await project(message.toolName,{content:message.content,details:{}},undefined,signal);value={...message,content:projected.content};}
    catch{fence(signal);value={...message,content:[{type:'text',text:JSON.stringify({success:false,message:'历史文件来源已变化或不可用，请重新列目录核对当前来源。'})}]};}
   }
   if(message.role==='assistant'&&Array.isArray(message.content)){
    const content=[];
    for(const part of message.content){
     if(!object(part)||part.type!=='toolCall'||!historyTools.has(part.name)||!object(part.arguments)){content.push(part);continue;}
     const args=structuredClone(part.arguments);
     const conceal=async(record:Record<string,any>,field:string)=>{
      const raw=record[field];if(typeof raw!=='string'||reference(raw)||await clean(raw)===raw)return;
      try{record[field]=(await issue(raw,signal)).selector;}
      catch{fence(signal);record[field]='[历史文件路径已脱敏，请重新列目录]';}
     };
     if(pathTools.has(part.name))await conceal(args,'path');
     if(part.name==='office_copy_file')for(const field of ['source','target'])await conceal(args,field);
     if(part.name==='capability_execute'&&args.requirement?.capabilityId==='edu.workspace.file.stat'&&object(args.input))await conceal(args.input,'path');
     if(part.name==='office_create_document'&&Array.isArray(args.sources))for(const source of args.sources)if(object(source))await conceal(source,'path');
     if(part.name==='office_deliver_files'&&Array.isArray(args.files))for(const file of args.files){if(!object(file))continue;await conceal(file,'path');if(Array.isArray(file.sources))for(const source of file.sources)if(object(source))await conceal(source,'path');}
     if(part.name==='update_task_plan'&&Array.isArray(args.steps))for(const step of args.steps)if(object(step)&&['file','saved_text','saved_office'].includes(step.kind))await conceal(step,'target');
     content.push({...part,arguments:args});
    }
    value={...message,content};
   }
   output.push(value as T);
  }
  return output;
 }
 return{resolve,input,project,canonical,history};
}
export type FileReferenceProjection=ReturnType<typeof createFileReferenceProjection>;
