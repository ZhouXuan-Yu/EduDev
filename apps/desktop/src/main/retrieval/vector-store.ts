import fs from 'node:fs/promises';
import path from 'node:path';
import {connect,Index} from '@lancedb/lancedb';
import {Schema,Field,Utf8,Float64,Float32,FixedSizeList} from 'apache-arrow';
import {EmbeddingClient} from './embedding-client';
import {IndexAccess} from './index-access';
import {loadMaintenance,maintainTables,type MaintainedTables} from './vector-maintenance';
import {RETRIEVAL_BATCH_OBJECTS,RETRIEVAL_BATCH_TEXT,RETRIEVAL_BATCH_BYTES,validGeneration,EMBEDDING_ID,EMBEDDING_MODEL,EMBEDDING_TOKENIZER,type GenerationSpec,type RetrievalFact,type VectorQuery,type VectorCandidate} from '../../shared/retrieval';
const quoted=(s:string)=>"'"+s.replaceAll("'","''")+"'";
export function embeddingTextWindows(text:string){const parts:{text:string;offset:number}[]=[];let offset=0;
  while(offset<text.length){let end=Math.min(text.length,offset+11000);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;
    parts.push({text:text.slice(offset,end),offset});if(end===text.length)break;offset=end-256;if(offset>0&&/[\uDC00-\uDFFF]/.test(text[offset])&&/[\uD800-\uDBFF]/.test(text[offset-1]))offset--;
  }return parts;
}
const schema=(vector:boolean)=>new Schema([
  ...['key','object_id','kind','digest','resource_id','subject','grade','knowledge_point','question_type','difficulty','source_kind'].map(n=>new Field(n,new Utf8(),false)),
  ...['seq','start','end'].map(n=>new Field(n,new Float64(),false)),
  ...(vector?[new Field('vector',new FixedSizeList(512,new Field('item',new Float32(),true)),false)]:[])
]);
type GenerationTables=MaintainedTables&{scalar:boolean;objectCount?:number};
export class LocalVectorStore{
  private generations=new Map<string,GenerationTables>();
  private openings=new Map<string,Promise<GenerationTables>>();
  private writes:Promise<unknown>=Promise.resolve();
  private queries=new Map<string,number[]>();
  constructor(private root:string,private encoder:EmbeddingClient,private exclusiveOwner:()=>boolean=()=>false){}
  private async open(spec:GenerationSpec):Promise<GenerationTables>{
    if(!validGeneration(spec.id)||spec.modelHash!==EMBEDDING_MODEL||spec.tokenizerHash!==EMBEDDING_TOKENIZER||spec.identity!==EMBEDDING_ID||spec.dimension!==512||spec.normalization!=='l2'||spec.pooling!=='cls'||spec.distanceMetric!=='cosine'||!Number.isSafeInteger(spec.factSnapshotSeq)||spec.factSnapshotSeq<0)throw Error('generation_mismatch');
    if(this.generations.has(spec.id))return this.generations.get(spec.id)!;
    if(this.openings.has(spec.id))return this.openings.get(spec.id)!;
    const task=this.openFresh(spec);this.openings.set(spec.id,task);try{return await task;}finally{this.openings.delete(spec.id);}
  }
  private async openFresh(spec:GenerationSpec):Promise<GenerationTables>{
    const folder=path.join(this.root,spec.id);await fs.mkdir(folder,{recursive:true});
    if((await fs.lstat(folder)).isSymbolicLink()||(await fs.realpath(folder)).toLowerCase()!==folder.toLowerCase())throw Error('index_path');
    const metadata=path.join(folder,'generation.json');
    try{const saved=JSON.parse(await fs.readFile(metadata,'utf8'));if(JSON.stringify(saved)!==JSON.stringify(spec))throw Error('generation_mismatch');}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await fs.writeFile(metadata,JSON.stringify(spec),{flag:'wx'});}
    const connection=await connect(folder);try{const tables=await connection.tableNames();
    const vectors=tables.includes('vectors')?await connection.openTable('vectors'):await connection.createEmptyTable('vectors',schema(true));
    const objects=tables.includes('objects')?await connection.openTable('objects'):await connection.createEmptyTable('objects',schema(false));
    const maintenance=await loadMaintenance(folder,vectors),result={connection,vectors,objects,scalar:false,ann:maintenance.mode==='ivf_flat',maintenance,access:new IndexAccess(),objectCount:undefined as number|undefined};this.generations.set(spec.id,result);return result;
    }catch(error){connection.close();throw error;}
  }
  ensure(spec:GenerationSpec){return this.open(spec).then(()=>undefined);}
  apply(spec:GenerationSpec,fact:RetrievalFact){return this.applyMany(spec,[fact]);}
  applyMany(spec:GenerationSpec,facts:RetrievalFact[]){
    const task=this.writes.then(async()=>{
      if(!Array.isArray(facts)||!facts.length||facts.length>RETRIEVAL_BATCH_OBJECTS||Buffer.byteLength(JSON.stringify(facts))>RETRIEVAL_BATCH_BYTES)throw Error('invalid_input');
      let characters=0;const newest=new Map<string,RetrievalFact>();
      for(const fact of facts){
        if(!fact||!['material','question'].includes(fact.kind)||!new RegExp('^'+(fact.kind==='material'?'chunk':'question')+'_[a-f0-9-]{36}$').test(fact.id)||!Number.isSafeInteger(fact.seq)||fact.seq<1||!/^([a-f0-9]{64})?$/.test(fact.digest)||typeof fact.text!=='string'||fact.text.length>128000||typeof fact.deleted!=='boolean'||['resourceId','subject','grade','knowledgePoint','questionType','difficulty','sourceKind'].some(k=>typeof fact[k as keyof RetrievalFact]!=='string'||String(fact[k as keyof RetrievalFact]).length>128))throw Error('invalid_input');
        characters+=fact.text.length;const key=fact.kind+':'+fact.id,previous=newest.get(key);if(!previous||previous.seq<fact.seq)newest.set(key,fact);
      }
      if(characters>RETRIEVAL_BATCH_TEXT)throw Error('invalid_input');
      const disk=await fs.statfs(this.root,{bigint:true});if(disk.bavail*disk.bsize<128n*1024n*1024n+BigInt(Math.max(1,Math.ceil(characters/448))*512*4*8))throw Error('index_disk_full');
      const table=await this.open(spec),{vectors,objects}=table;
      const previous=await table.access.read(()=>objects.query().where('object_id IN ('+[...newest.keys()].map(quoted).join(',')+')').select(['object_id','seq','end']).limit(newest.size).toArray());
      const revisions=new Map(previous.map(row=>[String(row.object_id),Number(row.seq)])),pending=[...newest].filter(([key,fact])=>(revisions.get(key)||0)<fact.seq);
      const rows:Record<string,unknown>[]=[],receipts:Record<string,unknown>[]=[],parts:{object:string;text:string;offset:number}[]=[],bases=new Map<string,Record<string,unknown>>(),counts=new Map<string,number>();
      // Infer all members before mutation. Query requests can run between each two-document model call.
      for(const [object,fact]of pending){
        const base={object_id:object,kind:fact.kind,digest:fact.digest,resource_id:fact.resourceId,subject:fact.subject,grade:fact.grade,knowledge_point:fact.knowledgePoint,question_type:fact.questionType,difficulty:fact.difficulty,source_kind:fact.sourceKind,seq:fact.seq};
        bases.set(object,base);counts.set(object,0);if(!fact.deleted)parts.push(...embeddingTextWindows(fact.text).map(p=>({...p,object})));
      }
      for(let i=0;i<parts.length;i+=2){const group=parts.slice(i,i+2),encoded=await this.encoder.embed('document',group.map(p=>p.text));for(const [j,windows]of encoded.entries()){const part=group[j];let count=counts.get(part.object)!;for(const w of windows)rows.push({...bases.get(part.object)!,key:part.object+':'+count++,start:w.start+part.offset,end:w.end+part.offset,vector:w.vector});counts.set(part.object,count);}}
      for(const [object]of pending)receipts.push({...bases.get(object)!,key:object,start:0,end:counts.get(object)!});
      if(pending.length){
        await table.access.exclusive(async()=>{
          const count=table.objectCount;table.objectCount=undefined;
          await vectors.delete('object_id IN ('+pending.map(([key])=>quoted(key)).join(',')+')');
          if(rows.length)await vectors.add(rows);
          // This is the commit receipt: a crash before it leaves the whole unacknowledged batch replayable.
          await objects.mergeInsert('object_id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(receipts);
          if(count!==undefined){const before=new Map(previous.map(r=>[String(r.object_id),Number(r.end)>0]));table.objectCount=count+receipts.reduce((n,r)=>n+(Number(r.end)>0?1:0)-(before.get(String(r.object_id))?1:0),0);}
        });
      }
      if(!table.scalar&&await objects.countRows()>0){let complete=true;for(const candidate of [objects,vectors]){if(!await candidate.countRows()){complete=false;continue;}if(!(await candidate.listIndices()).some(index=>index.columns.includes('object_id')))await candidate.createIndex('object_id',{config:Index.btree()});}table.scalar=complete;}
      return{applied:pending.length,skipped:newest.size-pending.length,vectors:rows.length};
    });this.writes=task.catch(()=>undefined);return task;
  }
  async query(spec:GenerationSpec,input:VectorQuery):Promise<{hits:VectorCandidate[];exhausted:boolean;ann:boolean}>{
    if(input.generation!==spec.id||!['material','question'].includes(input.kind)||typeof input.query!=='string'||!input.query.trim()||input.query.length>240||!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>1000)throw Error('invalid_input');
    const table=await this.open(spec),cacheKey=spec.modelHash+':'+input.query;let vector=this.queries.get(cacheKey);
    if(!vector){vector=(await this.encoder.embed('query',[input.query]))[0][0].vector;if(this.queries.size>=32)this.queries.delete(this.queries.keys().next().value!);this.queries.set(cacheKey,vector);}
    const clauses=['kind = '+quoted(input.kind)];
    for(const [key,column]of [['resourceId','resource_id'],['subject','subject'],['grade','grade'],['questionType','question_type'],['difficulty','difficulty'],['sourceKind','source_kind']]as const){const value=input[key];if(value!==undefined){if(typeof value!=='string'||value.length>128)throw Error('invalid_input');clauses.push(column+' = '+quoted(value));}}
    if(input.knowledgePoint!==undefined){if(typeof input.knowledgePoint!=='string'||input.knowledgePoint.length>128)throw Error('invalid_input');clauses.push('strpos(knowledge_point,'+quoted(input.knowledgePoint)+') > 0');}
    return table.access.read(async()=>{
    let query=(table.readVectors||table.vectors).vectorSearch(vector).distanceType('cosine').where(clauses.join(' AND ')).select(['object_id','seq','digest','start','end','_distance']).limit(input.limit);
    if(input.exact||!table.ann)query=query.bypassVectorIndex();else query=query.nprobes(table.maintenance.probes).maximumNprobes(table.maintenance.partitions);
    const rows=await query.toArray();
    return {hits:rows.map(r=>({id:String(r.object_id).slice(input.kind.length+1),seq:Number(r.seq),digest:String(r.digest),start:Number(r.start),end:Number(r.end),distance:Number(r._distance)})),exhausted:rows.length===input.limit,ann:table.ann&&!input.exact};
    });
  }
  optimize(spec:GenerationSpec,force=false){
    const task=this.writes.then(async()=>maintainTables(path.join(this.root,spec.id),await this.open(spec),this.exclusiveOwner,force));this.writes=task.catch(()=>undefined);return task;
  }
  async counts(spec:GenerationSpec){const table=await this.open(spec);return table.access.read(async()=>{table.objectCount??=await table.objects.countRows('end > 0');return {objects:table.objectCount,vectors:await table.vectors.countRows(),ann:table.ann};});}
  close(){this.encoder.close();for(const table of this.generations.values()){table.readVectors?.close();table.vectors.close();table.objects.close();table.connection.close();}this.generations.clear();}
}
