import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {randomUUID} from 'node:crypto';
import {EMBEDDING_ID,EMBEDDING_MODEL,EMBEDDING_TOKENIZER,type VectorWindow} from '../../shared/retrieval';

/** One owned offline model process. A failed/cancelled protocol is killed, never recycled. */
export class EmbeddingClient{
  private child?:ChildProcessWithoutNullStreams;
  private ready?:Promise<void>;
  private accept?:{id:string;resolve:(value:VectorWindow[][])=>void;reject:(error:Error)=>void};
  private queue:{role:'query'|'document';texts:string[];resolve:(v:VectorWindow[][])=>void;reject:(e:Error)=>void}[]=[];
  private pumping=false;
  private idle?:ReturnType<typeof setTimeout>;
  private closed=false;
  constructor(private executable:string,private verify?:()=>Promise<void>){}
  private start(){
    if(this.ready)return this.ready;
    this.ready=(async()=>{await this.verify?.();if(this.closed)throw Error('cancelled');return new Promise<void>((resolve,reject)=>{
      let settled=false,buffer='',stderr=0;const decoder=new StringDecoder('utf8');
      const child=spawn(this.executable,['--parent-pid',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]))});this.child=child;
      const timer=setTimeout(()=>fail(),60000);
      const fail=()=>{clearTimeout(timer);if(!settled){settled=true;reject(Error('embedding_unavailable'));}child.kill();if(this.child===child){this.accept?.reject(Error('embedding_unavailable'));this.accept=undefined;this.child=undefined;this.ready=undefined;}};
      child.on('error',fail);child.on('exit',fail);child.stderr.on('data',value=>{stderr+=value.length;if(stderr>65536)fail();});
      child.stdout.on('data',bytes=>{
        buffer+=decoder.write(bytes);if(Buffer.byteLength(buffer)>2*1048576){fail();return;}
        let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);let v;try{v=JSON.parse(line);}catch{fail();return;}
          if(!settled){if(v.schemaVersion!=='xiaozhi.embedding.v1'||v.kind!=='ready'||v.identity!==EMBEDDING_ID||v.modelHash!==EMBEDDING_MODEL||v.tokenizerHash!==EMBEDDING_TOKENIZER||v.dimension!==512){fail();return;}settled=true;clearTimeout(timer);resolve();continue;}
          const current=this.accept;
          if(current&&v.schemaVersion==='xiaozhi.embedding.v1'&&v.requestId===current.id&&v.kind==='error'&&v.code==='invalid_input'){this.accept=undefined;current.reject(Error('invalid_input'));continue;}
          if(!current||v.schemaVersion!=='xiaozhi.embedding.v1'||v.requestId!==current.id||v.kind!=='result'||v.identity!==EMBEDDING_ID||!Array.isArray(v.values)||!v.values.length||v.values.length>2){fail();return;}
          const valid=v.values.every((windows:unknown)=>Array.isArray(windows)&&windows.length>0&&windows.length<=32&&windows.every(w=>w&&Object.keys(w).sort().join(',')==='end,start,vector'&&Number.isSafeInteger(w.start)&&Number.isSafeInteger(w.end)&&w.start>=0&&w.end>w.start&&w.end<=12000&&Array.isArray(w.vector)&&w.vector.length===512&&w.vector.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n))&&Math.abs(Math.hypot(...w.vector)-1)<0.001));
          if(!valid){fail();return;}this.accept=undefined;current.resolve(v.values);
        }
      });
    });})();
    return this.ready;
  }
  embed(role:'query'|'document',texts:string[]):Promise<VectorWindow[][]>{
    if(this.closed)return Promise.reject(Error('cancelled'));
    if(this.queue.length>=16)return Promise.reject(Error('busy'));
    return new Promise((resolve,reject)=>{const request={role,texts,resolve,reject},background=this.queue.findIndex(q=>q.role==='document');if(role==='query'&&background>=0)this.queue.splice(background,0,request);else this.queue.push(request);void this.pump();});
  }
  private async pump(){
    if(this.pumping)return;this.pumping=true;if(this.idle)clearTimeout(this.idle);
    try{while(this.queue.length){const request=this.queue.shift()!;try{
      await this.start();const id=randomUUID();
      const value=await new Promise<VectorWindow[][]>((resolve,reject)=>{
        const timer=setTimeout(()=>{this.accept=undefined;this.closeChild();reject(Error('embedding_timeout'));},30000);
        this.accept={id,resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
        this.child!.stdin.write(JSON.stringify({schemaVersion:'xiaozhi.embedding.v1',requestId:id,role:request.role,texts:request.texts})+'\n');
      });
      if(value.length!==request.texts.length||value.some((windows,i)=>windows.some(w=>w.end>request.texts[i].length)))throw Error('embedding_contract');request.resolve(value);
    }catch(error){const code=(error as Error).message==='invalid_input'?'invalid_input':'embedding_unavailable';request.reject(Error(code));if(code!=='invalid_input')this.closeChild();}}}
    finally{this.pumping=false;this.idle=setTimeout(()=>this.closeChild(),60000);this.idle.unref();}
  }
  private closeChild(){this.child?.kill();this.child=undefined;this.ready=undefined;}
  close(){this.closed=true;if(this.idle)clearTimeout(this.idle);this.accept?.reject(Error('cancelled'));this.accept=undefined;for(const q of this.queue)q.reject(Error('cancelled'));this.queue=[];this.closeChild();}
}
