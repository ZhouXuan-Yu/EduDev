import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export type NativeTailBinding={file:string;offset:number;anchor:string};
export type NativeRunBinding=NativeTailBinding & {markerId:string;sessionId:string;runId:string;generation:number};
export type NativeToolEntry={id:string;callId:string;tool:string;digest:string;failed:boolean;message:{toolCallId:string;toolName:string;content:unknown;isError?:boolean}};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const identity=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_:.-]{1,128}$/.test(value);
function checkedFile(relative:string,root:string){
 const base=path.resolve(root),file=path.resolve(base,relative),inside=path.relative(base,file);
 if(!inside||inside.startsWith('..')||path.isAbsolute(inside)||!file.endsWith('.jsonl'))throw Error('permission_denied');
 let target=file;
 while(target!==base){if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('permission_denied');target=path.dirname(target);}
 if(fs.lstatSync(base).isSymbolicLink())throw Error('permission_denied');
 return file;
}
function anchor(fd:number,offset:number){
 const size=Math.min(offset,4096),bytes=Buffer.alloc(size);if(size&&fs.readSync(fd,bytes,0,size,offset-size)!==size)throw Error('evidence_missing');return sha(bytes);
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
 const file=checkedFile(binding.file,root),handle=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const stat=await handle.stat(),length=stat.size-binding.offset;
  if(!stat.isFile()||stat.nlink!==1||length<0||length>32*1048576)throw Error('evidence_missing');
  if(anchor(handle.fd,binding.offset)!==binding.anchor)throw Error('evidence_missing');
  const bytes=Buffer.alloc(length);let used=0;while(used<length){const n=await handle.read(bytes,used,length-used,binding.offset+used);if(!n.bytesRead)throw Error('evidence_missing');used+=n.bytesRead;}
  const after=await handle.stat(),current=fs.lstatSync(checkedFile(binding.file,root));
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
export async function readNativeToolEntries(binding:NativeRunBinding,root:string):Promise<NativeToolEntry[]>{
 if(!identity(binding.markerId)||!identity(binding.runId)||!/^aisession_[a-f0-9-]{36}$/i.test(binding.sessionId)||!Number.isSafeInteger(binding.generation)||binding.generation<1)throw Error('invalid_input');
 const rows=await readNativeTail(binding,root),index=rows.findIndex(row=>row.id===binding.markerId);
 const marker=rows[index];
 if(!marker||marker.type!=='custom'||marker.customType!=='xiaozhi.event-owner.v1'||marker.data?.schemaVersion!==1||marker.data.runId!==binding.runId||marker.data.sessionId!==binding.sessionId||marker.data.generation!==binding.generation)throw Error('evidence_missing');
 const results:NativeToolEntry[]=[],calls=new Set<string>(),declarations=new Map<string,string>(),ids=new Set<string>([binding.markerId]);let parent=binding.markerId;
 for(const row of rows.slice(index+1)){
  if(row.type==='custom'&&row.customType==='xiaozhi.event-owner.v1')break;
  if(!identity(row.id)||ids.has(row.id)||row.parentId!==parent)throw Error('evidence_missing');ids.add(row.id);parent=row.id;
  if(row.type==='message'&&row.message?.role==='assistant'&&Array.isArray(row.message.content))for(const call of row.message.content.filter((item:any)=>item?.type==='toolCall')){if(!identity(call.id)||!identity(call.name)||declarations.has(call.id))throw Error('evidence_missing');declarations.set(call.id,call.name);}
  if(row.type!=='message'||row.message?.role!=='toolResult')continue;
  const message=row.message;if(!identity(message.toolCallId)||!identity(message.toolName)||calls.has(message.toolCallId)||typeof message.isError!=='boolean'||declarations.get(message.toolCallId)!==message.toolName)throw Error('evidence_missing');calls.add(message.toolCallId);
  results.push({id:row.id,callId:message.toolCallId,tool:message.toolName,failed:message.isError,digest:toolResultDigest(message.toolName,message.content,message.isError),message});
 }
 return results;
}
