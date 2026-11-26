import {app,utilityProcess} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {verifyRetrievalRuntime,retrievalRuntimeRoots} from './runtime-command';
import type {GenerationSpec,RetrievalFact,VectorQuery,VectorCandidate} from '../../shared/retrieval';
import {RETRIEVAL_SCHEMA,validIndexMaintenance,type IndexMaintenance} from '../../shared/retrieval';
import type {RerankInput,RerankResult} from '../../shared/reranker';
import {reserveHostStage} from '../host-resources/desktop';
import type {ResourceLease} from '../host-resources/scheduler';
import {EmbeddingClient} from './embedding-client';
import {embeddingResult,isEmbeddingRequest} from './embedding-worker-port';
export type VectorPort={ensure:(spec:GenerationSpec)=>Promise<void>;apply:(spec:GenerationSpec,fact:RetrievalFact)=>Promise<unknown>;applyMany?:(spec:GenerationSpec,facts:RetrievalFact[])=>Promise<unknown>;query:(spec:GenerationSpec,query:VectorQuery)=>Promise<{hits:VectorCandidate[];exhausted:boolean;ann:boolean}>;counts:(spec:GenerationSpec)=>Promise<{objects:number;vectors:number;ann:boolean}>;optimize:(spec:GenerationSpec)=>Promise<unknown>;maintain?:(spec:GenerationSpec,force?:boolean)=>Promise<IndexMaintenance>;rerank?:(query:string,items:RerankInput[],timeoutMs?:number)=>Promise<RerankResult>;interrupt?:()=>Promise<void>;close:()=>Promise<void>};
/** Sole persistent native-index owner. Renderer never supplies an executable or index path. */
export class VectorHost implements VectorPort{
  private child?:Electron.UtilityProcess;
  private starting?:Promise<void>;
  private retiringEmbedding?:Promise<void>;
  private closing=false;
  private epoch=0;
  private stopQueue=new AbortController();
  private stopping=new WeakSet<Electron.UtilityProcess>();
  private pending=new Map<string,{child:Electron.UtilityProcess;lease:ResourceLease;resolve:(v:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(private dataRoot:()=>string){}
  private async start(){
    if(this.closing)throw Error('cancelled');
    if(this.retiringEmbedding)throw Error('busy');
    if(this.starting)return this.starting;
    const epoch=this.epoch;
    const job=(async()=>{
      const moduleDir=path.dirname(fileURLToPath(import.meta.url));
      const roots=retrievalRuntimeRoots({packaged:app.isPackaged,resourcesPath:process.resourcesPath,moduleDir,repoRoot:process.env.OMNI_EDU_REPO_ROOT});
      const resident=await reserveHostStage('vector-owner','resident','foreground',{memoryMiB:448,processes:1},60000,this.stopQueue.signal);
      let child:Electron.UtilityProcess|undefined;
      try{
        if(this.closing||this.epoch!==epoch||!resident.start())throw Error('cancelled');
        const executable=await verifyRetrievalRuntime(roots.embedding);
        if(this.closing||this.epoch!==epoch)throw Error('cancelled');
        child=utilityProcess.fork(path.join(moduleDir,'retrieval-worker.js'),[],{stdio:'pipe',serviceName:'小智本地语义检索',env:{...Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[])),RAYON_NUM_THREADS:'2',LANCE_INCLUDE_VECTOR_CENTROIDS:'false'}});
        this.child=child;
        child.once('exit',()=>resident.settle());
        await this.initialize(child,executable,roots.reranker);
      }catch(error){if(!child)resident.settle();throw error;}
    })();
    const started=job.catch(error=>{if(this.starting===started){if(this.child)this.stop(this.child);else this.starting=undefined;}throw error;});this.starting=started;return started;
  }
  private async initialize(child:Electron.UtilityProcess,executable:string,rerankerRoot:string){
      // The main process owns this native child and can observe its real close
      // even if the vector utility crashes before reporting back.
      const embedding=new EmbeddingClient(executable,async()=>{await verifyRetrievalRuntime(path.dirname(executable));},async (signal,role)=>{
        const lease=await reserveHostStage('vector-owner','embedding-resident',role==='query'?'foreground':'background',
          {memoryMiB:640,processes:1},60000,signal);
        if(signal.aborted||!lease.start()){lease.settle();throw Error('embedding_unavailable');}
        return ()=>{lease.settle();};
      });
      const onSpawn=()=>{if(this.closing||this.stopping.has(child))child.kill();};
      const drain=()=>{};
      let stderr=0;
      const onStderr=(bytes:Buffer)=>{stderr+=bytes.length;if(stderr>65536)this.stop(child);};
      const sendEmbedding=(result:ReturnType<typeof embeddingResult>)=>{
        if(this.child!==child||this.stopping.has(child))return;
        try{child.postMessage(result);}catch{this.stop(child);}
      };
      const onMessage=(v:any)=>{
        if(this.child!==child)return;
        if(v?.schemaVersion===RETRIEVAL_SCHEMA&&isEmbeddingRequest(v)){
          if(this.stopping.has(child)||this.closing)return;
          void embedding.embed(v.role,v.texts).then(
            values=>sendEmbedding(embeddingResult(v.id,values)),
            error=>sendEmbedding(embeddingResult(v.id,undefined,error instanceof Error?error.message:undefined)));
          return;
        }
        if(!v||v.schemaVersion!==RETRIEVAL_SCHEMA||typeof v.id!=='string'||typeof v.ok!=='boolean'){this.stop(child);return;}
        const entry=this.pending.get(v.id);if(!entry||entry.child!==child)return;
        clearTimeout(entry.timer);this.pending.delete(v.id);entry.lease.settle();
        if(v.ok===true)entry.resolve(v.value);
        else entry.reject(Error(['index_busy','embedding_unavailable','generation_mismatch','index_disk_full','invalid_input','index_validation_failed','reranker_unavailable','reranker_timeout','busy'].includes(v.error)?v.error:'index_unavailable'));
      };
      child.once('spawn',onSpawn);
      child.stdout?.on('data',drain);child.stderr?.on('data',onStderr);
      child.on('message',onMessage);
      child.once('exit',()=>{
        child.removeListener('spawn',onSpawn);child.removeListener('message',onMessage);
        child.stdout?.removeListener('data',drain);child.stderr?.removeListener('data',onStderr);
        const retiring=embedding.closeAndWait();
        if(this.child===child){
          this.retiringEmbedding=retiring;
          this.child=undefined;this.starting=undefined;
          void retiring.then(()=>{if(this.retiringEmbedding===retiring)this.retiringEmbedding=undefined;},()=>{});
        }
        for(const [id,entry] of this.pending){if(entry.child!==child)continue;clearTimeout(entry.timer);this.pending.delete(id);entry.lease.settle();entry.reject(Error('index_unavailable'));}
      });
      await this.send('init',{root:path.join(this.dataRoot(),'cache','semantic-v1'),executable,rerankerRoot});
  }
  private stop(child:Electron.UtilityProcess){
    if(this.stopping.has(child))return;
    this.stopping.add(child);
    child.kill();
  }
  private async send(op:string,body:Record<string,unknown>):Promise<any>{
    const child=this.child;
    if(!child||this.stopping.has(child)||this.pending.size>=32)throw Error('busy');
    const id=randomUUID(), timeout=op==='rerank'?20000:op==='applyMany'?180000:op==='optimize'?900000:60000;
    const remaining=op==='rerank'&&typeof body.deadlineAt==='number'?Math.min(timeout,body.deadlineAt-Date.now()):timeout;
    if(remaining<=0)throw Error('reranker_timeout');
    const deadline=performance.now()+remaining;
    const foreground=op==='query'||op==='rerank';
    const lease=await reserveHostStage('vector-owner',op,foreground?'foreground':'background',
      {cpu:1,memoryMiB:op==='applyMany'||op==='optimize'?512:256,indexOps:1},remaining,this.stopQueue.signal,id);
    if(this.closing||this.child!==child||this.stopping.has(child)||!lease.start()){
      lease.settle();throw Error('cancelled');
    }
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        reject(Error(op==='rerank'?'reranker_timeout':'index_timeout'));
        if(op!=='rerank')this.stop(child);
      },Math.max(1,deadline-performance.now()));
      this.pending.set(id,{child,lease,resolve,reject,timer});
      try{child.postMessage({schemaVersion:RETRIEVAL_SCHEMA,id,op,...body});}
      catch{clearTimeout(timer);this.pending.delete(id);lease.settle();reject(Error('index_unavailable'));}
    });
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
  async interrupt(){
    this.epoch++;
    this.stopQueue.abort();
    this.stopQueue=new AbortController();
    const starting=this.starting,child=this.child;
    if(child){const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));this.stop(child);await exited;}
    await starting?.catch(()=>undefined);
  }
  async close(){this.closing=true;await this.interrupt();}
}
