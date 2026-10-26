import fs from 'node:fs/promises';
import path from 'node:path';
import {EmbeddingClient} from './embedding-client';
import {LocalVectorStore} from './vector-store';
import {verifyRetrievalRuntime} from './runtime-command';
import {RETRIEVAL_SCHEMA} from '../../shared/retrieval';
import {acquireWriterLock} from './writer-lock';
import {RerankerClient} from './reranker-client';
import {verifyRerankerRuntime} from './reranker-runtime';
const parent=(process as unknown as {parentPort?:{on:(name:string,fn:(event:{data:unknown})=>void)=>void;postMessage:(value:unknown)=>void}}).parentPort;
let store:LocalVectorStore|undefined,ranker:RerankerClient|undefined,owner:import('node:fs/promises').FileHandle|undefined;
const reply=(v:Record<string,unknown>)=>{const message={schemaVersion:RETRIEVAL_SCHEMA,...v};return parent?parent.postMessage(message):process.send?.(message);};
async function receive(message:unknown){
  const v=message as Record<string,any>,id=v?.id;
  if(typeof id!=='string'||id.length>64)return;
  try{
    if(v.schemaVersion!==RETRIEVAL_SCHEMA||Buffer.byteLength(JSON.stringify(v))>1048576)throw Error('invalid_input');
    if(v.op==='init'){
      if(store)throw Error('already_initialized');
      if(typeof v.root!=='string'||!path.isAbsolute(v.root)||typeof v.executable!=='string'||!path.isAbsolute(v.executable))throw Error('invalid_input');
      const root=path.resolve(v.root);await fs.mkdir(root,{recursive:true});
      if((await fs.lstat(root)).isSymbolicLink()||(await fs.realpath(root)).toLowerCase()!==root.toLowerCase())throw Error('index_path');
      owner=await acquireWriterLock(root);
      if(typeof v.rerankerRoot==='string'&&path.isAbsolute(v.rerankerRoot))ranker=new RerankerClient(()=>verifyRerankerRuntime(v.rerankerRoot));
      store=new LocalVectorStore(root,new EmbeddingClient(v.executable,async()=>{await verifyRetrievalRuntime(path.dirname(v.executable));}),()=>!!owner&&owner.fd>=0);reply({id,ok:true,value:{ready:true}});return;
    }
    if(!store||!owner||owner.fd<0)throw Error('unavailable');
    let value;
    if(v.op==='ensure')value=await store.ensure(v.spec);
    else if(v.op==='apply')value=await store.apply(v.spec,v.fact);
    else if(v.op==='applyMany')value=await store.applyMany(v.spec,v.facts);
    else if(v.op==='query')value=await store.query(v.spec,v.query);
    else if(v.op==='counts')value=await store.counts(v.spec);
    else if(v.op==='rerank'){if(!ranker)throw Error('reranker_unavailable');value=await ranker.rerank(v.query,v.items);}
    else if(v.op==='optimize')value=await store.optimize(v.spec,v.force===true);
    else throw Error('invalid_input');
    reply({id,ok:true,value});
  }catch(error){const code=error instanceof Error?error.message:'';reply({id,ok:false,error:['generation_mismatch','embedding_unavailable','invalid_input','index_busy','index_path','index_disk_full','index_validation_failed','reranker_unavailable','reranker_timeout','busy'].includes(code)?code:'index_unavailable'});}
}
if(parent)parent.on('message',event=>void receive(event.data));else process.on('message',v=>void receive(v));
process.on('exit',()=>{ranker?.close();store?.close();});
// Do not unlink or explicitly unlock during exit: the OS releases exclusive sharing at actual process death.
