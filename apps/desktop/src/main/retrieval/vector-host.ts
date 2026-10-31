import {app,utilityProcess} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {verifyRetrievalRuntime} from './runtime-command';
import type {GenerationSpec,RetrievalFact,VectorQuery,VectorCandidate} from '../../shared/retrieval';
import {RETRIEVAL_SCHEMA,validIndexMaintenance,type IndexMaintenance} from '../../shared/retrieval';
import type {RerankInput,RerankResult} from '../../shared/reranker';
export type VectorPort={ensure:(spec:GenerationSpec)=>Promise<void>;apply:(spec:GenerationSpec,fact:RetrievalFact)=>Promise<unknown>;applyMany?:(spec:GenerationSpec,facts:RetrievalFact[])=>Promise<unknown>;query:(spec:GenerationSpec,query:VectorQuery)=>Promise<{hits:VectorCandidate[];exhausted:boolean;ann:boolean}>;counts:(spec:GenerationSpec)=>Promise<{objects:number;vectors:number;ann:boolean}>;optimize:(spec:GenerationSpec)=>Promise<unknown>;maintain?:(spec:GenerationSpec,force?:boolean)=>Promise<IndexMaintenance>;rerank?:(query:string,items:RerankInput[],timeoutMs?:number)=>Promise<RerankResult>;interrupt?:()=>Promise<void>;close:()=>Promise<void>};
/** Sole persistent native-index owner. Renderer never supplies an executable or index path. */
export class VectorHost implements VectorPort{
  private child?:Electron.UtilityProcess;
  private starting?:Promise<void>;
  private closing=false;
  private epoch=0;
  private stopping=new WeakSet<Electron.UtilityProcess>();
  private pending=new Map<string,{resolve:(v:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(private dataRoot:()=>string){}
  private async start(){
    if(this.closing)throw Error('cancelled');if(this.starting)return this.starting;
    const epoch=this.epoch;
    const job=(async()=>{
      const moduleDir=path.dirname(fileURLToPath(import.meta.url));
      const runtime=app.isPackaged?path.join(process.resourcesPath,'retrieval-runtime'):path.resolve(moduleDir,'../../.local-retrieval/dist/omni-edu-retrieval');
      const executable=await verifyRetrievalRuntime(runtime);if(this.closing||this.epoch!==epoch)throw Error('cancelled');
      const child=utilityProcess.fork(path.join(moduleDir,'retrieval-worker.js'),[],{stdio:'pipe',serviceName:'小智本地语义检索',env:{...Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[])),RAYON_NUM_THREADS:'2',LANCE_INCLUDE_VECTOR_CENTROIDS:'false'}});this.child=child;
      child.once('spawn',()=>{if(this.closing||this.stopping.has(child))child.kill();});
      let stderr=0;child.stdout?.on('data',()=>{});child.stderr?.on('data',bytes=>{stderr+=bytes.length;if(stderr>65536)child.kill();});
      child.on('message',v=>{if(this.child!==child)return;if(!v||v.schemaVersion!==RETRIEVAL_SCHEMA||typeof v.id!=='string'||typeof v.ok!=='boolean'){child.kill();return;}const entry=this.pending.get(v.id);if(!entry)return;clearTimeout(entry.timer);this.pending.delete(v.id);if(v.ok===true)entry.resolve(v.value);else entry.reject(Error(['index_busy','embedding_unavailable','generation_mismatch','index_disk_full','invalid_input','index_validation_failed','reranker_unavailable','reranker_timeout','busy'].includes(v.error)?v.error:'index_unavailable'));});
      child.once('exit',()=>{if(this.child===child){this.child=undefined;this.starting=undefined;for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.reject(Error('index_unavailable'));}this.pending.clear();}});
      await this.send('init',{root:path.join(this.dataRoot(),'cache','semantic-v1'),executable,rerankerRoot:app.isPackaged?path.join(process.resourcesPath,'reranker-runtime'):path.resolve(moduleDir,'../../.local-reranker/dist/omni-edu-reranker')});
    })();
    const started=job.catch(error=>{if(this.starting===started){this.starting=undefined;this.child?.kill();}throw error;});this.starting=started;return started;
  }
  private send(op:string,body:Record<string,unknown>):Promise<any>{
    if(!this.child||this.pending.size>=32)return Promise.reject(Error('busy'));
    const id=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(op==='rerank'?'reranker_timeout':'index_timeout'));if(op!=='rerank')this.child?.kill();},op==='rerank'?20000:op==='applyMany'?180000:op==='optimize'?900000:60000);this.pending.set(id,{resolve,reject,timer});try{this.child!.postMessage({schemaVersion:RETRIEVAL_SCHEMA,id,op,...body});}catch{clearTimeout(timer);this.pending.delete(id);reject(Error('index_unavailable'));}});
  }
  private async call(op:string,body:Record<string,unknown>){await this.start();return this.send(op,body);}
  ensure(spec:GenerationSpec){return this.call('ensure',{spec}) as Promise<void>;}
  apply(spec:GenerationSpec,fact:RetrievalFact){return this.call('apply',{spec,fact});}
  applyMany(spec:GenerationSpec,facts:RetrievalFact[]){return this.call('applyMany',{spec,facts});}
  query(spec:GenerationSpec,query:VectorQuery){return this.call('query',{spec,query}) as Promise<{hits:VectorCandidate[];exhausted:boolean;ann:boolean}>;}
  counts(spec:GenerationSpec){return this.call('counts',{spec}) as Promise<{objects:number;vectors:number;ann:boolean}>;}
  async rerank(query:string,items:RerankInput[],timeoutMs=15000):Promise<RerankResult>{
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('invalid_input');
    const deadlineAt=Date.now()+timeoutMs;let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([(async()=>{await this.start();if(Date.now()>=deadlineAt)throw Error('reranker_timeout');return this.send('rerank',{query,items,deadlineAt});})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('reranker_timeout')),timeoutMs);})]);}
    finally{if(timer)clearTimeout(timer);}
  }
  optimize(spec:GenerationSpec){return this.call('optimize',{spec,force:true});}
  async maintain(spec:GenerationSpec,force=false){const result=await this.call('optimize',{spec,force});if(!validIndexMaintenance(result))throw Error('index_unavailable');return result;}
  async interrupt(){this.epoch++;const starting=this.starting,child=this.child;if(child){this.stopping.add(child);const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));child.kill();await exited;}await starting?.catch(()=>undefined);}
  async close(){this.closing=true;await this.interrupt();}
}
