import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Index,type Table,type Connection} from '@lancedb/lancedb';
import {freshIndexMaintenance,validIndexMaintenance,type IndexMaintenance} from '../../shared/retrieval';
import {IndexAccess} from './index-access';

export const freshMaintenance=freshIndexMaintenance;
export async function loadMaintenance(folder:string,vectors:Table):Promise<IndexMaintenance>{
  try{
    const file=path.join(folder,'maintenance-v1.json'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)return freshMaintenance();
    const state=JSON.parse(await fs.readFile(file,'utf8')) as IndexMaintenance;
    if(!validIndexMaintenance(state))return freshMaintenance();
    if(state.mode==='ivf_flat'){
      const index=(await vectors.listIndices()).find(i=>i.columns.includes('vector')&&i.indexType.replace(/[^a-z]/gi,'').toLowerCase()==='ivfflat');
      if(!index||state.vectorVersion>await vectors.version()||(await vectors.indexStats(index.name))?.distanceType?.toLowerCase()!=='cosine')return freshMaintenance();
    }
    return {...state,phase:'idle',error:''};
  }catch{return freshMaintenance();}
}
async function save(folder:string,state:IndexMaintenance){
  const temporary=path.join(folder,'.maintenance-'+randomUUID()+'.tmp');
  try{await fs.writeFile(temporary,JSON.stringify(state),{flag:'wx'});await fs.rename(temporary,path.join(folder,'maintenance-v1.json'));}
  finally{await fs.unlink(temporary).catch(()=>undefined);}
}
export function tieAwareRecall(truth:{key:unknown;_distance:unknown}[],found:{key:unknown;_distance:unknown}[]){
  if(!truth.length)return found.length?0:1;
  const boundary=Number(truth.at(-1)!._distance),strict=truth.filter(r=>Number(r._distance)<boundary-1e-5),keys=new Set(found.map(r=>String(r.key)));
  const exact=strict.filter(r=>keys.has(String(r.key))).length,ties=found.filter(r=>Math.abs(Number(r._distance)-boundary)<=1e-5).length;
  return (exact+Math.min(truth.length-strict.length,ties))/truth.length;
}
async function validate(vectors:Table,rows:number,partitions:number){
  const probes: number[][]=[];
  for(let i=0;i<8;i++){
    const row=(await vectors.query().select(['vector']).offset(Math.floor((rows-1)*i/7)).limit(1).toArray())[0];
    if(!row)throw Error('index_validation_failed');
    const v=Array.from(row.vector as Iterable<number>);if(v.length!==512)throw Error('index_validation_failed');probes.push(v);
  }
  // Mix source vectors to also probe partition boundaries; this is an algorithm check, not relevance labels.
  const mixed=probes.map((v,i)=>{const w=probes[(i+3)%probes.length],m=v.map((x,j)=>x+w[j]),norm=Math.hypot(...m);return norm>1e-8?m.map(x=>x/norm):v;});
  const samples=[...probes,...mixed],truth=[];
  for(const v of samples)truth.push(await vectors.vectorSearch(v).distanceType('cosine').bypassVectorIndex().select(['key','_distance']).limit(20).toArray());
  for(let nprobes=Math.min(32,partitions);;nprobes=Math.min(partitions,nprobes*2)){
    const recalls=[];
    for(let i=0;i<samples.length;i++){
      const found=await vectors.vectorSearch(samples[i]).distanceType('cosine').nprobes(nprobes).select(['key','_distance']).limit(20).toArray();
      recalls.push(tieAwareRecall(truth[i],found));
    }
    const recall=recalls.reduce((a,b)=>a+b,0)/recalls.length;
    if(recall>=0.98&&Math.min(...recalls)>=0.9)return {probes:nprobes,sampleRecall:recall,samples:samples.length};
    if(nprobes===partitions)throw Error('index_validation_failed');
  }
}

export type MaintainedTables={connection:Connection;vectors:Table;objects:Table;readVectors?:Table;access:IndexAccess;maintenance:IndexMaintenance;ann:boolean};
export async function maintainTables(folder:string,table:MaintainedTables,exclusiveOwner:()=>boolean,force=false){
  const {vectors,objects}=table,previous=table.maintenance,rows=await vectors.countRows(),vectorVersion=await vectors.version(),objectVersion=await objects.version();
  const train=rows>=4096&&(previous.mode!=='ivf_flat'||rows>=Math.max(4096,previous.indexedRows*2));
  if(!force&&previous.completedAt&&previous.phase!=='retry_pending'&&!train&&vectorVersion-previous.vectorVersion<64&&objectVersion-previous.objectVersion<32)return previous;
  const disk=await fs.statfs(folder,{bigint:true}),required=128n*1024n*1024n+BigInt(rows)*8192n+BigInt(await objects.countRows())*4096n;
  if(disk.bavail*disk.bsize<required)throw Error('index_disk_full');
  let next={...previous};
  if(train){
    const partitions=Math.min(512,Math.max(4,Math.floor(Math.sqrt(rows))));
    const reader=await table.connection.openTable('vectors');await reader.checkout(await vectors.version());
    await table.access.exclusive(async()=>{table.readVectors=reader;});
    try{
      // Invalidate the checkpoint before replacing an index. A crash cannot bless an unvalidated replacement.
      await save(folder,freshMaintenance());
      await vectors.createIndex('vector',{config:Index.ivfFlat({distanceType:'cosine',numPartitions:partitions,maxIterations:30,sampleRate:128}),replace:true});
      const measured=await validate(vectors,rows,partitions);next={...next,...measured,mode:'ivf_flat',partitions,indexedRows:rows};
      await table.access.exclusive(async()=>{table.readVectors=undefined;table.ann=true;table.maintenance=next;});
    }catch(error){await table.access.exclusive(async()=>{table.readVectors=undefined;table.ann=false;table.maintenance={...freshMaintenance(),phase:'retry_pending',error:'index_validation_failed'};});throw error;}
    finally{await table.access.exclusive(async()=>{table.readVectors=undefined;reader.close();});}
  }
  await table.access.exclusive(async()=>{
    // Queries and all index commits have left the native gate before pruning recent private versions.
    // Without a held OS writer lock keep Lance's conservative seven-day policy.
    const options=exclusiveOwner()?{cleanupOlderThan:new Date(Date.now()-60000),deleteUnverified:true}:{};
    await vectors.optimize(options);await objects.optimize(options);
  });
  next={...next,phase:'idle',error:'',completedAt:new Date().toISOString(),vectorVersion:await vectors.version(),objectVersion:await objects.version()};
  await save(folder,next);table.maintenance=next;return next;
}
