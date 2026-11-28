import type {Sql} from '../session-state';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {FileHandle} from 'node:fs/promises';
import {TEACHING_DEPARTURE,TEACHING_ISOLATION,validTeachingDeparture,validTeachingIsolation} from '../native-teaching-epoch';

export type NativeTailBinding={file:string;offset:number;anchor:string};
export type NativeRunBinding=NativeTailBinding & {markerId:string;sessionId:string;runId:string;generation:number};
export type NativeToolEntry={id:string;callId:string;tool:string;digest:string;failed:boolean;message:{toolCallId:string;toolName:string;content:unknown;isError?:boolean}};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const identity=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_:.-]{1,128}$/.test(value);
function nativeFilename(relative:string,root:string){
 const base=path.resolve(root),file=path.resolve(base,relative),inside=path.relative(base,file);
 if(!inside||inside.startsWith('..')||path.isAbsolute(inside)||!file.endsWith('.jsonl'))throw Error('permission_denied');
 return {base,file};
}
function checkedFile(relative:string,root:string){
 const {base,file}=nativeFilename(relative,root);
 let target=file;
 while(target!==base){if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('permission_denied');target=path.dirname(target);}
 if(fs.lstatSync(base).isSymbolicLink())throw Error('permission_denied');
 return file;
}
async function checkedFileAsync(relative:string,root:string){
 const {base,file}=nativeFilename(relative,root);
 let target=file;
 while(target!==base){
  try{if((await fs.promises.lstat(target)).isSymbolicLink())throw Error('permission_denied');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  target=path.dirname(target);
 }
 if((await fs.promises.lstat(base)).isSymbolicLink())throw Error('permission_denied');
 return file;
}
function anchor(fd:number,offset:number){
 const size=Math.min(offset,4096),bytes=Buffer.alloc(size);if(size&&fs.readSync(fd,bytes,0,size,offset-size)!==size)throw Error('evidence_missing');return sha(bytes);
}
async function readAnchor(handle:FileHandle,offset:number){
 const size=Math.min(offset,4096),bytes=Buffer.alloc(size);
 if(size&&(await handle.read(bytes,0,size,offset-size)).bytesRead!==size)throw Error('evidence_missing');
 return sha(bytes);
}
/** Main captures a bounded immutable anchor before prompt delivery; never walks history. */
export function captureNativeTail(file:string,root:string):NativeTailBinding{
 const relative=path.relative(path.resolve(root),path.resolve(file));const checked=checkedFile(relative,root);
 if(!fs.existsSync(checked))return{file:relative,offset:0,anchor:sha('')};
 const fd=fs.openSync(checked,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.nlink!==1)throw Error('permission_denied');const digest=anchor(fd,stat.size),after=fs.fstatSync(fd);if(stat.size!==after.size||stat.mtimeMs!==after.mtimeMs)throw Error('evidence_missing');return{file:relative,offset:stat.size,anchor:digest};}finally{fs.closeSync(fd);}
}
export async function readNativeTail(binding:NativeTailBinding,root:string):Promise<Record<string,any>[]>{
 if(!Number.isSafeInteger(binding.offset)||binding.offset<0||!/^[a-f0-9]{64}$/.test(binding.anchor))throw Error('invalid_input');
 const file=await checkedFileAsync(binding.file,root),handle=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const stat=await handle.stat(),length=stat.size-binding.offset;
  if(!stat.isFile()||stat.nlink!==1||length<0||length>32*1048576)throw Error('evidence_missing');
  if(await readAnchor(handle,binding.offset)!==binding.anchor)throw Error('evidence_missing');
  const bytes=Buffer.alloc(length);let used=0;while(used<length){const n=await handle.read(bytes,used,length-used,binding.offset+used);if(!n.bytesRead)throw Error('evidence_missing');used+=n.bytesRead;}
  const after=await handle.stat(),current=await fs.promises.lstat(await checkedFileAsync(binding.file,root));
  if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||current.isSymbolicLink()||current.nlink!==1||current.ino!==stat.ino||current.size!==stat.size||current.mtimeMs!==stat.mtimeMs)throw Error('evidence_missing');
  if(bytes.length&&bytes.at(-1)!==10)throw Error('evidence_missing');
  const lines=bytes.toString('utf8').split('\n');if(lines.length>4096)throw Error('evidence_missing');
  return lines.filter(line=>line.trim()).map(line=>{const row=JSON.parse(line);if(!row||typeof row!=='object'||Array.isArray(row))throw Error('evidence_missing');return row;});
 }finally{await handle.close();}
}
/** Native messages omit transient details. Hash only the exact persisted result body. */
export function toolResultDigest(tool:string,content:unknown,failed:boolean){
 if(!identity(tool)||!Array.isArray(content))throw Error('invalid_input');
 const encoded=JSON.stringify([tool,content,failed]);if(Buffer.byteLength(encoded)>16*1048576)throw Error('evidence_missing');return sha(encoded);
}
/** Only an independently bound next Run can end tool accounting across a Pi authority branch. */
async function confirmedIsolationBoundary(rows:Record<string,any>[],index:number,start:number,
  binding:NativeRunBinding,root:string,sql:Sql,previous:string) {
  const isolation=rows[index],data=isolation.data;
  const teaching=isolation.customType===TEACHING_ISOLATION;
  if(isolation.type!=='custom'||(!teaching&&!['xiaozhi.skills.isolation.v1','xiaozhi.memory.isolation.v1'].includes(isolation.customType))
    ||!data||(!teaching&&Object.keys(data).length!==3)||data.fromLeaf!==previous||!/^[a-f0-9]{64}$/.test(data.authority)
    ||!Array.isArray(data.blockedRunIds)||data.blockedRunIds.length>4096||!data.blockedRunIds.every(identity)
    ||new Set(data.blockedRunIds).size!==data.blockedRunIds.length||!data.blockedRunIds.includes(binding.runId))return false;
  const old=rows.slice(start,index);
  const safeIndex=old.findIndex(entry=>entry.id===isolation.parentId);
  const begin=old[safeIndex+1];
  const taintType=isolation.customType.replace('isolation.v1','taint.v1');
  if(teaching){
    const departure=old.at(-1);
    if(!validTeachingIsolation(data)||data.safeLeaf!==isolation.parentId||safeIndex>=0
      ||departure?.type!=='custom'||departure.customType!==TEACHING_DEPARTURE||!validTeachingDeparture(departure.data)
      ||departure.data.safeLeaf!==data.safeLeaf||departure.data.authority!==data.authority||departure.data.scoped!==data.scoped)return false;
  }else if(safeIndex<0||begin?.type!=='custom'||begin.customType!=='xiaozhi.memory.run.v1'
    ||begin.data?.runId!==binding.runId||Object.keys(begin.data).length!==1
    ||!old.slice(safeIndex+2).some(entry=>entry.type==='custom'&&entry.customType===taintType
      &&entry.data?.safeLeaf===isolation.parentId&&entry.data?.runId===binding.runId&&Object.keys(entry.data).length===3
      &&/^[a-f0-9]{64}$/.test(entry.data?.authority)&&entry.data.authority!==data.authority))return false;
  const [next]=await sql.all(`SELECT b.binding_json,r.run_id AS next_id FROM xiaozhi_event_runs prior
    JOIN xiaozhi_event_runs r ON r.session_id=prior.session_id AND r.generation=prior.generation+1
    JOIN xiaozhi_native_run_bindings b ON b.run_id=r.run_id AND b.generation=r.generation
    WHERE prior.session_id=? AND prior.run_id=? AND prior.generation=?
      AND prior.status IN ('completed','failed','interrupted','cancelled')`,[binding.sessionId,binding.runId,binding.generation]);
  if(!next)return false;
  const following=JSON.parse(String(next.binding_json)) as NativeRunBinding;
  if(following.runId!==next.next_id||following.file!==binding.file||following.offset<=binding.offset||following.generation!==binding.generation+1
    ||following.sessionId!==binding.sessionId||!identity(following.markerId))return false;
  const [marker]=await readNativeTail(following,root);
  if(marker?.type!=='custom'||marker.customType!=='xiaozhi.event-owner.v1'||marker.id!==following.markerId
    ||marker.data?.schemaVersion!==1||marker.data.runId!==following.runId||marker.data.sessionId!==following.sessionId
    ||marker.data.generation!==following.generation)return false;
  const seen=new Set(old.map(entry=>entry.id));
  let parent=isolation.parentId;
  for(const entry of rows.slice(index)){
    if(!identity(entry.id)||seen.has(entry.id)||entry.parentId!==parent)return false;
    if(entry.customType==='xiaozhi.event-owner.v1')return JSON.stringify(entry)===JSON.stringify(marker);
    if(!['custom','model_change','thinking_level_change'].includes(entry.type))return false;
    seen.add(entry.id);parent=entry.id;
  }
  return false;
}

export async function readNativeToolEntries(binding:NativeRunBinding,root:string,sql?:Sql):Promise<NativeToolEntry[]>{
 if(!identity(binding.markerId)||!identity(binding.runId)||!/^aisession_[a-f0-9-]{36}$/i.test(binding.sessionId)||!Number.isSafeInteger(binding.generation)||binding.generation<1)throw Error('invalid_input');
 const rows=await readNativeTail(binding,root),index=rows.findIndex(row=>row.id===binding.markerId);
 const marker=rows[index];
 if(!marker||marker.type!=='custom'||marker.customType!=='xiaozhi.event-owner.v1'||marker.data?.schemaVersion!==1||marker.data.runId!==binding.runId||marker.data.sessionId!==binding.sessionId||marker.data.generation!==binding.generation)throw Error('evidence_missing');
 const results:NativeToolEntry[]=[],calls=new Set<string>(),declarations=new Map<string,string>(),ids=new Set<string>([binding.markerId]);let parent=binding.markerId;
 for(let i=index+1;i<rows.length;i++){
  const row=rows[i];
  if(row.type==='custom'&&row.customType==='xiaozhi.event-owner.v1')break;
  if(row.parentId!==parent&&sql&&await confirmedIsolationBoundary(rows,i,index,binding,root,sql,parent))break;
  if(!identity(row.id)||ids.has(row.id)||row.parentId!==parent)throw Error('evidence_missing');ids.add(row.id);parent=row.id;
  if(row.type==='message'&&row.message?.role==='assistant'&&Array.isArray(row.message.content))for(const call of row.message.content.filter((item:any)=>item?.type==='toolCall')){if(!identity(call.id)||!identity(call.name)||declarations.has(call.id))throw Error('evidence_missing');declarations.set(call.id,call.name);}
  if(row.type!=='message'||row.message?.role!=='toolResult')continue;
  const message=row.message;if(!identity(message.toolCallId)||!identity(message.toolName)||calls.has(message.toolCallId)||typeof message.isError!=='boolean'||declarations.get(message.toolCallId)!==message.toolName)throw Error('evidence_missing');calls.add(message.toolCallId);
  results.push({id:row.id,callId:message.toolCallId,tool:message.toolName,failed:message.isError,digest:toolResultDigest(message.toolName,message.content,message.isError),message});
 }
 return results;
}
