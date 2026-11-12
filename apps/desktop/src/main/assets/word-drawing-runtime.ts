import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {app,net} from 'electron';
import {createManagedWorkerQueue} from '../managed-tools/worker-queue';
import {reserveLocalWorker} from '../xiaozhi-agent/local-utility-host';
import {createWordOfficeComponent,runWordOfficeProcess} from './word-office-component';
import {WORD_DRAWING_SCHEMA,validWordDrawingReceipt,type WordDrawingRequest,type WordDrawingReceipt,type WordOfficeProgress} from '../../shared/material-word-drawing';

const queue=createManagedWorkerQueue(1,32);
let progress:WordOfficeProgress|undefined;
let component:ReturnType<typeof createWordOfficeComponent>|undefined;
export const wordDrawingProgress=()=>progress?{...progress}:undefined;

export function renderWordDrawings(bytes:Uint8Array,items:WordDrawingRequest[],signal:AbortSignal):Promise<WordDrawingReceipt>{
 return queue.run(async owned=>{
  component ||= createWordOfficeComponent({root:path.join(app.getPath('userData'),'managed-components'),fetch:(url,options)=>net.fetch(String(url),options),onProgress:value=>{progress=value;}});
  const program=await component.ensure(owned);
  owned.throwIfAborted();
  const release=reserveLocalWorker();if(!release)throw Error('busy');
  let job:string|undefined;
  try{
   job=await fs.mkdtemp(path.join(app.getPath('temp'),'xiaozhi-word-drawing-'));
   const sourceSha256=createHash('sha256').update(bytes).digest('hex');
   const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(key=>process.env[key]?[[key,process.env[key]]]:[]));
   Object.assign(env,{PYTHONDONTWRITEBYTECODE:'1',PYTHONPYCACHEPREFIX:path.join(job,'python-cache'),XIAOZHI_OFFICE_PROGRAM:program});
   const worker=fileURLToPath(new URL('./word-drawing-worker.py',import.meta.url));
   const stdout=await runWordOfficeProcess(path.join(program,'python.exe'),['-B',worker],{cwd:job,env,signal:owned,timeout:300000,stdoutLimit:96*1048576,
    input:JSON.stringify({schemaVersion:WORD_DRAWING_SCHEMA,parentPid:process.pid,sourceSha256,data:Buffer.from(bytes).toString('base64'),items,jobRoot:job})+'\n'});
   const receipt:unknown=JSON.parse(stdout);
   if(!validWordDrawingReceipt(receipt)||receipt.sourceSha256!==sourceSha256)throw Error('parse_failed');
   owned.throwIfAborted();return receipt;
  }finally{
   release();
   if(job){const resolved=path.resolve(job);if(path.dirname(resolved)!==path.resolve(app.getPath('temp'))||!path.basename(resolved).startsWith('xiaozhi-word-drawing-'))throw Error('configuration');await fs.rm(resolved,{recursive:true,force:true});}
  }
 },signal);
}
