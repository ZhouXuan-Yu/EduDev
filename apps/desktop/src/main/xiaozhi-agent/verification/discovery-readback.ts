import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createHanaOfficeTools,officeSourceIdentity} from '../../office-agent/hana-tool-adapter';
import {fileVersion,type WorkspaceLease} from '../workspace-files';
import type {BoundEffect} from './effect-readback';
import {approvedFile} from '../workspace-authority';

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const discoveryTools=new Set(['office_list_files','office_file_stat']);
/** Full snapshot version protects native/current agreement. The separate
 * source digest is stable across list/stat, timestamps and directory changes. */
export function discoverySnapshot(tool:string,payload:Record<string,any>){
 if(!discoveryTools.has(tool)||payload.schemaVersion!=='xiaozhi.office.tool.v1'||payload.tool!==tool||payload.success!==true||!object(payload.data))return;
 const d=payload.data;if(typeof d.source!=='string'||d.source.length>500||path.isAbsolute(d.source)||/[:\x00-\x1f]/.test(d.source)||d.source.split(/[\\/]/).includes('..')||typeof d.sourceIdentity!=='string'||!/^[a-f0-9]{64}$/.test(d.sourceIdentity))return;
 const source=path.normalize(d.source||'.'),identity=process.platform==='win32'?source.toLowerCase():source;
 let snapshot:unknown;
 if(tool==='office_list_files'){
  if(typeof d.truncated!=='boolean'||!Array.isArray(d.entries)||d.entries.length>256||d.entries.some((e:unknown)=>!object(e)||Object.keys(e).sort().join(',')!=='kind,name'||typeof e.name!=='string'||!e.name||e.name.length>255||/[/\\\x00-\x1f]/.test(e.name)||['.','..'].includes(e.name)||!['file','directory','blocked_link'].includes(e.kind))||new Set(d.entries.map((e:{name:string})=>e.name)).size!==d.entries.length)return;
  snapshot=['directory.v1',identity,d.sourceIdentity,d.truncated,[...d.entries].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).map(e=>[e.name,e.kind])];
 }else{
  if(typeof d.isDirectory!=='boolean'||!Number.isSafeInteger(d.size)||d.size<0||!Number.isFinite(d.modifiedAt)||typeof d.kind!=='string'||d.kind.length>80||typeof d.mime!=='string'||d.mime.length>120||typeof d.version!=='string'||!/^[a-f0-9]{64}$/.test(d.version))return;
  snapshot=['file-metadata.v1',identity,d.sourceIdentity,d.size,d.kind,d.mime,d.isDirectory,d.modifiedAt,d.version];
 }
 return{digest:hash(['discovered-source.v1']),version:hash(snapshot),payload};
}

/** Main-only current authority binding, with no writes, network, approval or
 * content read. A directory snapshot can advance discovery, never a file step. */
export function createDiscoveryReadback(options:{sessionId:string;runId:string;current:()=>boolean;workspace:()=>Promise<WorkspaceLease>}){
 const fence=()=>{if(!options.current())throw Error('cancelled');};
 function authority(lease:WorkspaceLease){
  const stat=fs.lstatSync(lease.path);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('permission_denied');
  const root=fs.realpathSync(lease.path);return hash([process.platform==='win32'?root.toLowerCase():root,stat.dev,stat.ino,lease.version]);
 }
 function sourceIdentity(lease:WorkspaceLease,source:string){
  const target=approvedFile(lease.path,source||'.'),stat=fs.lstatSync(target);
  if(stat.isSymbolicLink()||!stat.isDirectory()&&(!stat.isFile()||stat.nlink!==1))throw Error('permission_denied');
  return officeSourceIdentity(fs.realpathSync(lease.path),stat);
 }
 return async(_callId:string,tool:string,payload:Record<string,any>):Promise<BoundEffect>=>{
  fence();const snapshot=discoverySnapshot(tool,payload);if(!snapshot)throw Error('evidence_missing');
  const lease=await options.workspace(),scope=authority(lease),source=sourceIdentity(lease,payload.data.source);if(source!==payload.data.sourceIdentity)throw Error('evidence_missing');fence();
  const digest=hash([scope,source]),version=hash([digest,snapshot.version]);
  return{digest,version,read:async()=>{
   fence();const current=await options.workspace();if(authority(current)!==scope||sourceIdentity(current,payload.data.source)!==source)throw Error('permission_denied');
   const tools=createHanaOfficeTools({workspace:current.path,sessionId:options.sessionId,runId:options.runId,networkAllowed:false,fileVersion});
   const result=await tools.execute(tool,'discovery_readback',{path:payload.data.source||'.'},AbortSignal.timeout(10000));fence();
   const fresh=discoverySnapshot(tool,result as unknown as Record<string,any>);
   const final=await options.workspace();if(!fresh||fresh.version!==snapshot.version||fresh.digest!==snapshot.digest||authority(final)!==scope||sourceIdentity(final,payload.data.source)!==source)throw Error('evidence_missing');
   fence();return{digest,version};
  }};
 };
}
