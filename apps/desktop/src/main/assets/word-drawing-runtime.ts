import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {app,net} from 'electron';
import {createManagedWorkerQueue} from '../managed-tools/worker-queue';
import {reserveLocalWorker} from '../xiaozhi-agent/local-utility-host';
import {createWordOfficeComponent,runWordOfficeProcess} from './word-office-component';
import {WORD_DRAWING_SCHEMA,WORD_DRAWING_VECTOR_SCHEMA,validWordDrawingVectorReceipt,type WordDrawingRequest,type WordDrawingReceipt,type WordDrawingItem,type WordOfficeProgress} from '../../shared/material-word-drawing';
import {rasterWordDrawing} from './word-drawing-raster';
import {WORD_IMAGES} from '../../shared/material-word';

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
    input:JSON.stringify({schemaVersion:WORD_DRAWING_VECTOR_SCHEMA,parentPid:process.pid,sourceSha256,data:Buffer.from(bytes).toString('base64'),items,jobRoot:job})+'\n'});
   const receipt:unknown=JSON.parse(stdout);
   if(!validWordDrawingVectorReceipt(receipt)||receipt.sourceSha256!==sourceSha256||receipt.items.length!==items.length)throw Error('parse_failed');
   const rendered:WordDrawingItem[]=[];let renderedBytes=0;
   for(let index=0;index<receipt.items.length;index++){
    const item=receipt.items[index];
    if(item.inputSha256!==items[index].sha256)throw Error('source_changed');
    if(!item.ok){rendered.push(item);continue;}
    const svg=Buffer.from(item.svg,'base64');
    if(svg.toString('base64')!==item.svg||createHash('sha256').update(svg).digest('hex')!==item.sha256)throw Error('source_changed');
    try{
     const png=await rasterWordDrawing(svg,item.width,item.height,job,owned);
     if(renderedBytes+png.length>WORD_IMAGES){rendered.push({inputSha256:item.inputSha256,ok:false,error:'too_large'});continue;}
     renderedBytes+=png.length;
     rendered.push({inputSha256:item.inputSha256,ok:true,png:png.toString('base64'),sha256:createHash('sha256').update(png).digest('hex'),width:item.width+4,height:item.height+4});
    }catch(error){owned.throwIfAborted();rendered.push({inputSha256:item.inputSha256,ok:false,error:error instanceof Error&&error.message==='too_large'?'too_large':'render_failed'});}
   }
   owned.throwIfAborted();return {schemaVersion:WORD_DRAWING_SCHEMA,sourceSha256,items:rendered};
  }finally{
   release();
   if(job){const resolved=path.resolve(job);if(path.dirname(resolved)!==path.resolve(app.getPath('temp'))||!path.basename(resolved).startsWith('xiaozhi-word-drawing-'))throw Error('configuration');await fs.rm(resolved,{recursive:true,force:true});}
  }
 },signal);
}
