import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
import os from 'node:os';
import {RERANK_SCHEMA,RERANK_ID,RERANK_MODEL,RERANK_TOKENIZER,RERANK_LIMIT,type RerankInput,type RerankResult} from '../../shared/reranker';
type RankJob={query:string;items:RerankInput[];key:string;done:boolean;timer?:ReturnType<typeof setTimeout>;resolve:(v:RerankResult)=>void;reject:(e:Error)=>void};

/** One lazy, offline, bounded cross-encoder. Failure never terminates the vector owner. */
export class RerankerClient {
  private child?:ChildProcessWithoutNullStreams;
  private ready?:Promise<void>;
  private accept?:{id:string;items:RerankInput[];resolve:(v:RerankResult)=>void;reject:(e:Error)=>void};
  private queue:RankJob[]=[];
  private active?:RankJob;
  private epoch=0;
  private pumping=false;
  private closed=false;
  private idle?:ReturnType<typeof setTimeout>;
  private startup?:AbortController;
  private warming?:Promise<void>;
  private warmRetryAt=0;
  private cache=new Map<string,RerankResult>();
  constructor(private executable:(signal:AbortSignal)=>Promise<string>){}
  private start(){
    if(this.ready)return this.ready;
    const epoch=this.epoch,controller=new AbortController();this.startup=controller;
    const promise=(async()=>{let stop!:()=>void;
      const cancelled=new Promise<string>((_,reject)=>{stop=()=>reject(Error('cancelled'));controller.signal.addEventListener('abort',stop,{once:true});});
      let executable:string;try{executable=await Promise.race([this.executable(controller.signal),cancelled]);}finally{controller.signal.removeEventListener('abort',stop);}
      controller.signal.throwIfAborted();if(this.closed||epoch!==this.epoch)throw Error('cancelled');
      return new Promise<void>((resolve,reject)=>{
        const child=spawn(executable,['--parent-pid',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]))});this.child=child;
        let settled=false,buffer='',stderr=0;const decoder=new StringDecoder('utf8'),timer=setTimeout(()=>fail(),60000);
        const fail=()=>{clearTimeout(timer);if(!settled){settled=true;reject(Error('reranker_unavailable'));}child.kill();if(this.child===child){this.accept?.reject(Error('reranker_unavailable'));this.accept=undefined;this.child=undefined;this.ready=undefined;}};
        child.on('error',fail);child.on('exit',fail);child.stdin.on('error',fail);child.stderr.on('data',bytes=>{stderr+=bytes.length;if(stderr>65536)fail();});
        child.stdout.on('data',bytes=>{
          if(this.child!==child)return;buffer+=decoder.write(bytes);if(Buffer.byteLength(buffer)>32768){fail();return;}
          let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);let v;try{v=JSON.parse(line);}catch{fail();return;}
            if(!settled){if(v.schemaVersion!==RERANK_SCHEMA||v.kind!=='ready'||v.identity!==RERANK_ID||v.modelHash!==RERANK_MODEL||v.tokenizerHash!==RERANK_TOKENIZER){fail();return;}settled=true;clearTimeout(timer);resolve();continue;}
            const current=this.accept;if(!current||v.schemaVersion!==RERANK_SCHEMA||v.requestId!==current.id){fail();return;}
            if(v.kind==='error'&&v.code==='invalid_input'){this.accept=undefined;current.reject(Error('invalid_input'));continue;}
            if(v.kind!=='result'||v.identity!==RERANK_ID||!Number.isSafeInteger(v.elapsedMs)||v.elapsedMs<0||!Array.isArray(v.scores)||v.scores.length!==current.items.length||v.scores.some((s:any,i:number)=>!s||Object.keys(s).sort().join(',')!=='complete,id,score'||s.id!==current.items[i].id||typeof s.score!=='number'||!Number.isFinite(s.score)||Math.abs(s.score)>1000||typeof s.complete!=='boolean')){fail();return;}
            this.accept=undefined;current.resolve({scores:v.scores,elapsedMs:v.elapsedMs});
          }
        });
      });
    })().catch(error=>{if(this.ready===promise)this.ready=undefined;throw error;});this.ready=promise;return promise;
  }
  /** Optional preparation shares the real startup; foreground requests never use its failure cooldown. */
  warm():Promise<void>{
    if(this.closed)return Promise.reject(Error('cancelled'));
    if(this.warming)return this.warming;
    if(this.pumping||Date.now()<this.warmRetryAt||os.freemem()<2*1024**3)return Promise.resolve();
    if(this.idle)clearTimeout(this.idle);
    const promise=Promise.resolve().then(async()=>{let timer:ReturnType<typeof setTimeout>|undefined;
      try{if(this.closed)throw Error('cancelled');await Promise.race([this.start(),new Promise<void>((_,reject)=>{timer=setTimeout(()=>{this.closeChild();reject(Error('reranker_timeout'));},15000);})]);}
      catch(error){this.warmRetryAt=Date.now()+60000;throw error;}
      finally{if(timer)clearTimeout(timer);this.warming=undefined;if(!this.pumping&&!this.active&&!this.queue.length)this.park();}
    });this.warming=promise;return promise;
  }
  private park(){
    if(this.idle)clearTimeout(this.idle);if(this.closed||!this.child)return;
    const until=Date.now()+600000;
    const check=()=>{if(this.closed||this.pumping||this.active||this.queue.length)return;
      if(os.freemem()<1024**3||Date.now()>=until){this.closeChild();return;}
      this.idle=setTimeout(check,Math.min(30000,until-Date.now()));this.idle.unref();
    };
    this.idle=setTimeout(check,30000);this.idle.unref();
  }
  rerank(query:string,items:RerankInput[],timeoutMs=15000):Promise<RerankResult>{
    if(this.closed)return Promise.reject(Error('cancelled'));
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)return Promise.reject(Error('invalid_input'));
    if(typeof query!=='string'||!query.trim()||query.length>240||query.includes('\0')||!Array.isArray(items)||!items.length||items.length>RERANK_LIMIT||items.some(i=>!i||typeof i.id!=='string'||!/^[A-Za-z0-9_.:-]{1,128}$/.test(i.id)||typeof i.text!=='string'||!i.text.trim()||i.text.length>1024||i.text.includes('\0')||typeof i.complete!=='boolean')||new Set(items.map(i=>i.id)).size!==items.length)return Promise.reject(Error('invalid_input'));
    const key=createHash('sha256').update(JSON.stringify([RERANK_ID,query,items])).digest('hex'),cached=this.cache.get(key);if(cached)return Promise.resolve(structuredClone(cached));
    if(this.queue.length>=4)return Promise.reject(Error('busy'));
    return new Promise((resolve,reject)=>{const job:RankJob={query,items:structuredClone(items),key,done:false,resolve:v=>{if(job.done)return;job.done=true;clearTimeout(job.timer);resolve(v);},reject:e=>{if(job.done)return;job.done=true;clearTimeout(job.timer);reject(e);}};
      job.timer=setTimeout(()=>{job.reject(Error('reranker_timeout'));if(this.active===job){this.accept?.reject(Error('reranker_timeout'));this.accept=undefined;this.closeChild();}},timeoutMs);this.queue.push(job);void this.pump();});
  }
  private async pump(){
    if(this.pumping)return;this.pumping=true;if(this.idle)clearTimeout(this.idle);
    try{while(this.queue.length){const request=this.queue.shift()!;if(request.done)continue;this.active=request;try{
      await this.start();if(request.done)throw Error('reranker_timeout');const id=randomUUID();const value=await new Promise<RerankResult>((resolve,reject)=>{
        const timer=setTimeout(()=>{this.accept=undefined;this.closeChild();reject(Error('reranker_timeout'));},12000);
        this.accept={id,items:request.items,resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
        this.child!.stdin.write(JSON.stringify({schemaVersion:RERANK_SCHEMA,requestId:id,identity:RERANK_ID,query:request.query,items:request.items.map(({id,text})=>({id,text}))})+'\n');
      });if(!request.done){if(this.cache.size>=16)this.cache.delete(this.cache.keys().next().value!);this.cache.set(request.key,value);request.resolve(structuredClone(value));}
    }catch(error){const known=['invalid_input','reranker_timeout','cancelled'];request.reject(Error(known.includes((error as Error).message)?(error as Error).message:'reranker_unavailable'));if((error as Error).message!=='invalid_input')this.closeChild();}finally{this.active=undefined;}}}
    finally{this.pumping=false;this.park();}
  }
  private closeChild(){this.epoch++;this.startup?.abort();this.startup=undefined;this.child?.kill();this.child=undefined;this.ready=undefined;}
  close(){this.closed=true;if(this.idle)clearTimeout(this.idle);this.active?.reject(Error('cancelled'));this.accept?.reject(Error('cancelled'));this.accept=undefined;for(const q of this.queue)q.reject(Error('cancelled'));this.queue=[];this.cache.clear();this.closeChild();}
}
