import {createHash,randomUUID} from 'node:crypto';
import type {QuestionBankItem,QuestionSearchFilters,ResourceChunk,SimilarQuestionMatch} from '../../shared/contracts';
import {RETRIEVAL_SCHEMA,EMBEDDING_ID,EMBEDDING_MODEL,EMBEDDING_TOKENIZER,RETRIEVAL_BATCH_OBJECTS,RETRIEVAL_BATCH_TEXT,RETRIEVAL_BATCH_BYTES,freshIndexMaintenance,validIndexMaintenance,type IndexMaintenance,type RetrievalFact,type RetrievalKind,type RetrievalStatus,type GenerationSpec,type SemanticCoverage} from '../../shared/retrieval';
import {archiveEligible} from '../../shared/question-archive';
import {answerEnrichmentRoles} from '../../shared/question-answer-enrichment';
import type {QuestionContextPurpose} from '../../shared/question-context';
import {questionFacts,questionFactConflicts} from '../../shared/question-facts';
import {questionPresentation} from '../../shared/native-question';
import {materialBodyVersion,materialUnitDigest,type MaterialReadingUnit} from '../assets/material-source';
import {MaterialAiTextIndex} from './material-ai-text-index';
import type {AiPageView} from '../../shared/material-ai-page';
import type {MaterialFullTextSearch} from '../assets/material-full-text';
import {validatedQuestionFilters} from '../education/question-retrieval';
import type {QuestionBlock} from '../../shared/question-document';
import {RERANK_ID,RERANK_LIMIT,type RerankCoverage} from '../../shared/reranker';
import {rerankContext} from './rerank-context';
import type {VectorPort} from './vector-host';
import {validateAiPageSource} from '../assets/material-ai-page-source';
import {readAiPageReceipt} from '../assets/material-ai-page-evidence';
import {aiPageQuestionIssues} from '../assets/material-ai-page-publish';
type Row=Record<string,unknown>;type Value=string|number|null;
type ResultReceipt={id:string;seq:number;sources?:{id:string;revision:number}[]};
type Host={all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;chunk:(r:Row)=>ResourceChunk;question:(r:Row)=>QuestionBankItem;
  page?:(batchId:string,ordinal:number)=>Promise<AiPageView>;clean?:(text:string)=>Promise<string>;
  fullText:()=>MaterialFullTextSearch;keyword:(f:QuestionSearchFilters)=>Promise<SimilarQuestionMatch[]>;
  writer:<T>(action:(repo:RetrievalRepository)=>Promise<T>)=>Promise<T>};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const readable=['ready','partial','parsed','chunked','indexed','graph_extracted'];
const issue=(error:unknown)=>{const code=(error as Error)?.message;return ['index_busy','embedding_unavailable','generation_mismatch','index_timeout','source_changed','invalid_input','too_large','index_disk_full'].includes(code)?code:'index_unavailable';};
export function fuseRanks(lexical:string[],semantic:string[]){const scores=new Map<string,number>();for(const list of [lexical,semantic])for(const [i,id]of [...new Set(list)].entries())scores.set(id,(scores.get(id)||0)+1/(60+i+1));return [...scores].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([id])=>id);}

/** SQLite owns facts and the event clock; Lance is a replaceable derivative. */
export class RetrievalRepository{
  readonly restoredText:MaterialAiTextIndex;
  private port?:VectorPort;private timer?:ReturnType<typeof setInterval>;private pumping?:Promise<void>;private closing=false;private retryAt=0;
  constructor(private host:Host){this.restoredText=new MaterialAiTextIndex({...host,write:action=>host.writer(target=>action(target.restoredText))});}
  configure(port:VectorPort){this.port=port;}
  async migrate(){const reset=!!this.host.fullText().recreated;await this.host.writer(target=>target.migrateInWriter(reset));if(reset)this.host.fullText().recreated=false;}
  private async migrateInWriter(reset=false){
    for(const sql of [
      `CREATE TABLE IF NOT EXISTS retrieval_changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,object_id TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS retrieval_current(kind TEXT NOT NULL,object_id TEXT NOT NULL,seq INTEGER NOT NULL,PRIMARY KEY(kind,object_id))`,
      `CREATE TABLE IF NOT EXISTS retrieval_control(id INTEGER PRIMARY KEY CHECK(id=1),active TEXT NOT NULL DEFAULT '',building TEXT NOT NULL DEFAULT '',paused INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '')`,
      `INSERT OR IGNORE INTO retrieval_control(id) VALUES(1)`,
      `CREATE TABLE IF NOT EXISTS retrieval_generations(id TEXT PRIMARY KEY,snapshot_seq INTEGER NOT NULL,applied_seq INTEGER NOT NULL DEFAULT 0,material_cursor TEXT NOT NULL DEFAULT '',question_cursor TEXT NOT NULL DEFAULT '',backfill_done INTEGER NOT NULL DEFAULT 0,indexed INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS retrieval_failures(generation TEXT NOT NULL,kind TEXT NOT NULL,object_id TEXT NOT NULL,seq INTEGER NOT NULL,error TEXT NOT NULL,PRIMARY KEY(generation,kind,object_id))`,
      `CREATE TABLE IF NOT EXISTS retrieval_question_sources(question_id TEXT NOT NULL,resource_id TEXT NOT NULL,chunk_id TEXT NOT NULL,PRIMARY KEY(question_id,resource_id,chunk_id))`,
      `CREATE TABLE IF NOT EXISTS retrieval_schema_migrations(name TEXT PRIMARY KEY)`,
      `CREATE TABLE IF NOT EXISTS retrieval_maintenance(generation TEXT PRIMARY KEY,state_json TEXT NOT NULL,checked_at INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS retrieval_source_revisions(resource_id TEXT PRIMARY KEY,revision INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS retrieval_question_source_resource ON retrieval_question_sources(resource_id,question_id)`,
      `CREATE INDEX IF NOT EXISTS retrieval_question_source_chunk ON retrieval_question_sources(chunk_id,question_id)`,
      `CREATE INDEX IF NOT EXISTS retrieval_chunk_private_page ON resource_chunks(resource_id,contains_personal_data,page_number)`,
      `CREATE TRIGGER IF NOT EXISTS retrieval_change_current AFTER INSERT ON retrieval_changes BEGIN INSERT INTO retrieval_current(kind,object_id,seq) VALUES(new.kind,new.object_id,new.seq) ON CONFLICT(kind,object_id) DO UPDATE SET seq=excluded.seq; END`
    ])await this.host.run(sql);
    for(const [table,events]of [['teacher_resources',[['INSERT','new.id'],['UPDATE OF content_hash,parse_status','new.id'],['DELETE','old.id']]],['resource_chunks',[['INSERT','new.resource_id'],['UPDATE OF resource_id,chunk_index,content_md,contains_personal_data,page_number','new.resource_id'],['DELETE','old.resource_id']]]] as const)for(const [i,[event,key]]of events.entries())await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_source_revision_${table}_${i}_v1 AFTER ${event} ON ${table} BEGIN INSERT INTO retrieval_source_revisions(resource_id,revision) VALUES(${key},1) ON CONFLICT(resource_id) DO UPDATE SET revision=revision+1; ${table==='resource_chunks'&&i===1?'INSERT INTO retrieval_source_revisions(resource_id,revision) SELECT old.resource_id,1 WHERE old.resource_id<>new.resource_id ON CONFLICT(resource_id) DO UPDATE SET revision=revision+1;':''} END`);
    for(const [table,kind]of [['resource_chunks','material'],['question_bank_items','question']])for(const [name,event,ref]of [['ai','INSERT','new'],['au','UPDATE','new'],['ad','DELETE','old']])await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_${kind}_${name}_v1 AFTER ${event} ON ${table} BEGIN INSERT INTO retrieval_changes(kind,object_id) VALUES('${kind}',${ref}.id); END`);
    await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_resource_au_v1 AFTER UPDATE OF content_hash,parse_status ON teacher_resources WHEN old.content_hash<>new.content_hash OR old.parse_status<>new.parse_status BEGIN INSERT INTO retrieval_changes(kind,object_id) SELECT 'material',id FROM resource_chunks WHERE resource_id=new.id; END`);
    await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_resource_ad_v1 BEFORE DELETE ON teacher_resources BEGIN INSERT INTO retrieval_changes(kind,object_id) SELECT 'material',id FROM resource_chunks WHERE resource_id=old.id; END`);
    for(const [event,name]of [['INSERT','ai'],['UPDATE','au']]){await this.host.run(`DROP TRIGGER IF EXISTS retrieval_question_links_${name}_v1`);await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_question_links_${name}_v2 AFTER ${event} ON question_bank_items BEGIN DELETE FROM retrieval_question_sources WHERE question_id=new.id; ${this.linkSql('new').join(';')}; END`);}
    await this.host.run('CREATE TRIGGER IF NOT EXISTS retrieval_question_links_ad_v1 AFTER DELETE ON question_bank_items BEGIN DELETE FROM retrieval_question_sources WHERE question_id=old.id; END');
    for(const [event,name,ref]of [['INSERT','ai','new'],['UPDATE OF resource_id,chunk_index,content_md,contains_personal_data,page_number','au','new'],['DELETE','ad','old']]){await this.host.run(`DROP TRIGGER IF EXISTS retrieval_parent_chunk_${name}_v1`);await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_parent_chunk_${name}_v2 AFTER ${event} ON resource_chunks BEGIN INSERT INTO retrieval_changes(kind,object_id) SELECT DISTINCT 'question',question_id FROM retrieval_question_sources WHERE chunk_id=${ref}.id OR chunk_id='' AND resource_id IN (${event.startsWith('UPDATE')?'old.resource_id,new.resource_id':ref+'.resource_id'}); END`);}
    for(const [event,name,ref]of [['INSERT','ai','new'],['UPDATE OF content_hash,parse_status','au','new'],['DELETE','ad','old']])await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_parent_resource_${name}_v1 AFTER ${event} ON teacher_resources BEGIN INSERT INTO retrieval_changes(kind,object_id) SELECT DISTINCT 'question',question_id FROM retrieval_question_sources WHERE resource_id=${ref}.id; END`);
    const tables=new Set((await this.host.all("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>String(r.name)));
    if(tables.has('material_pdf_pages')&&tables.has('material_pdf_jobs'))for(const [table,events]of [['material_pdf_pages',['INSERT','UPDATE','DELETE']],['material_pdf_jobs',['UPDATE OF generation,version,state,total','DELETE']]] as const)for(const [i,event]of events.entries()){
      const ref=event==='DELETE'?'old':'new',ids=table==='material_pdf_jobs'?`SELECT ${ref}.resource_id`:`SELECT resource_id FROM material_pdf_jobs WHERE generation IN (${event==='UPDATE'?'old.generation,new.generation':ref+'.generation'})`;
      await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_page_${table}_${i}_v1 AFTER ${event} ON ${table} BEGIN INSERT INTO retrieval_source_revisions(resource_id,revision) SELECT id,1 FROM teacher_resources WHERE id IN (${ids}) ON CONFLICT(resource_id) DO UPDATE SET revision=revision+1; INSERT INTO retrieval_changes(kind,object_id) SELECT DISTINCT 'question',question_id FROM retrieval_question_sources WHERE resource_id IN (${ids}); END`);
    }
    if(tables.has('material_ai_members'))for(const table of ['material_ai_units','material_ai_page_units','material_ai_image_inputs','material_ai_members'])if(tables.has(table))for(const [i,event]of ['UPDATE','DELETE'].entries()){
      const ids=table==='material_ai_members'?'SELECT old.question_id':`SELECT question_id FROM material_ai_members WHERE batch_id=old.batch_id AND ordinal=old.ordinal`;
      await this.host.run(`CREATE TRIGGER IF NOT EXISTS retrieval_receipt_${table}_${i}_v1 BEFORE ${event} ON ${table} BEGIN INSERT INTO retrieval_source_revisions(resource_id,revision) SELECT DISTINCT s.resource_id,1 FROM retrieval_question_sources s WHERE s.question_id IN (${ids}) ON CONFLICT(resource_id) DO UPDATE SET revision=revision+1; INSERT INTO retrieval_changes(kind,object_id) SELECT DISTINCT 'question',question_id FROM retrieval_question_sources WHERE question_id IN (${ids}); END`);
    }
    await this.restoredText.migrate(reset);
    if(!(await this.host.all('PRAGMA table_info(retrieval_generations)')).some(c=>c.name==='restored_cursor'))await this.host.run("ALTER TABLE retrieval_generations ADD COLUMN restored_cursor TEXT NOT NULL DEFAULT ''");
    // Existing derivative generations need one new snapshot when source-closure tracking is introduced.
    if(!(await this.host.all("SELECT name FROM retrieval_schema_migrations WHERE name='source-closure.v2'")).length){
      const c=await this.control();if(c.building)await this.host.run("UPDATE retrieval_generations SET question_cursor='',backfill_done=0 WHERE id=?",[String(c.building)]);else if(c.active)await this.newGeneration();
      await this.host.run("INSERT INTO retrieval_schema_migrations(name) VALUES('source-closure.v2')");
    }
    await this.host.run("UPDATE retrieval_maintenance SET state_json=json_set(state_json,'$.phase','retry_pending','$.error','interrupted'),checked_at=0 WHERE json_valid(state_json) AND json_extract(state_json,'$.phase')='running'");
  }
  private linkSql(prefix:'new'|'q'){
    const safe=(column:string)=>`CASE WHEN json_valid(${prefix}.${column}) THEN ${prefix}.${column} ELSE '{}' END`;
    const array=`CASE WHEN json_type(${safe('archive_json')},'$.sources')='array' THEN json_extract(${safe('archive_json')},'$.sources') ELSE '[]' END`;
    const item="CASE WHEN s.type='object' THEN s.value ELSE '{}' END",from=prefix==='q'?'question_bank_items q, ':'';
    return [`INSERT OR IGNORE INTO retrieval_question_sources(question_id,resource_id,chunk_id) SELECT ${prefix}.id,json_extract(${item},'$.resourceId'),json_extract(${item},'$.chunkId') FROM ${from}json_each(${array}) s WHERE json_extract(${item},'$.resourceId') IS NOT NULL AND json_extract(${item},'$.chunkId') IS NOT NULL ${prefix==='q'?'AND q.id=?':''}`,
      `INSERT OR IGNORE INTO retrieval_question_sources(question_id,resource_id,chunk_id) SELECT ${prefix}.id,json_extract(${safe('document_json')},'$.source.resourceId'),'' ${prefix==='q'?'FROM question_bank_items q':''} WHERE json_extract(${safe('document_json')},'$.source.resourceId') IS NOT NULL ${prefix==='q'?'AND q.id=?':''}`,
      `INSERT OR IGNORE INTO retrieval_question_sources(question_id,resource_id,chunk_id) SELECT ${prefix}.id,json_extract(${safe('archive_json')},'$.pageSource.resourceId'),'' ${prefix==='q'?'FROM question_bank_items q':''} WHERE json_extract(${safe('archive_json')},'$.pageSource.resourceId') IS NOT NULL ${prefix==='q'?'AND q.id=?':''}`];
  }
  private async linkQuestion(id:string){await this.host.run('DELETE FROM retrieval_question_sources WHERE question_id=?',[id]);for(const sql of this.linkSql('q'))await this.host.run(sql,[id]);}
  private async control(){return (await this.host.all('SELECT * FROM retrieval_control WHERE id=1'))[0];}
  private async generation(id:string){const row=(await this.host.all('SELECT * FROM retrieval_generations WHERE id=?',[id]))[0];if(!row)throw Error('generation_mismatch');return row;}
  private spec(row:Row):GenerationSpec{return {id:String(row.id),identity:EMBEDDING_ID,modelHash:EMBEDDING_MODEL,tokenizerHash:EMBEDDING_TOKENIZER,dimension:512,pooling:'cls',normalization:'l2',distanceMetric:'cosine',factSnapshotSeq:Number(row.snapshot_seq)};}
  private async maximum(){return Number((await this.host.all('SELECT COALESCE(MAX(seq),0) n FROM retrieval_changes'))[0].n);}
  async action(action:'pause'|'resume'|'rebuild'){
    if(action==='rebuild')await this.host.writer(async target=>{
      const c=await target.control();if(c.building)throw Error('busy');await target.newGeneration();
    });else await this.host.run('UPDATE retrieval_control SET paused=?,error=CASE WHEN ?=0 THEN \'\' ELSE error END WHERE id=1',[action==='pause'?1:0,action==='pause'?1:0]);
    if(action==='pause')await this.port?.interrupt?.();this.retryAt=0;
  }
  private async newGeneration(){const id='generation_'+randomUUID(),snapshot=await this.maximum();await this.host.run('INSERT INTO retrieval_generations(id,snapshot_seq,applied_seq,created_at) VALUES(?,?,?,?)',[id,snapshot,snapshot,new Date().toISOString()]);await this.host.run("UPDATE retrieval_control SET building=?,paused=0,error='' WHERE id=1",[id]);}
  async status():Promise<RetrievalStatus>{
    const c=await this.control(),id=String(c.active||c.building),g=id?await this.generation(id):undefined;
    const max=await this.maximum();
    const maintenance=id?await this.maintenanceState(id):undefined;
    return{schemaVersion:RETRIEVAL_SCHEMA,available:!!this.port&&!c.error,generation:String(c.active),building:String(c.building),paused:!!c.paused,phase:c.building?'building':c.active?'ready':'waiting',pending:Math.max(0,max-Number(g?.applied_seq||0)),indexed:Number(g?.indexed||0),failed:id?await this.failed(id):0,error:String(c.error),model:EMBEDDING_ID,...(maintenance?{maintenance}:{})};
  }
  start(){if(this.timer)return;this.closing=false;const pump=()=>{if(this.pumping||!this.port||this.closing||Date.now()<this.retryAt)return;this.pumping=this.drain().then(()=>undefined).catch(async error=>{if(this.closing||(await this.control()).paused)return;this.retryAt=Date.now()+15000;await this.host.run('UPDATE retrieval_control SET error=? WHERE id=1',[issue(error)]).catch(()=>undefined);}).finally(()=>{this.pumping=undefined;});};this.timer=setInterval(pump,400);this.timer.unref();pump();}
  async close(){this.closing=true;if(this.timer)clearInterval(this.timer);this.timer=undefined;await this.port?.close();await this.pumping;}
  private async failed(id:string){return Number((await this.host.all('SELECT COUNT(*) n FROM retrieval_failures WHERE generation=?',[id]))[0].n);}
  private async maintenanceState(id:string){const row=(await this.host.all('SELECT state_json FROM retrieval_maintenance WHERE generation=?',[id]))[0];try{const state=JSON.parse(String(row?.state_json));return validIndexMaintenance(state)?state:undefined;}catch{return undefined;}}
  private async maintain(id:string){
    if(!this.port?.maintain||this.closing||(await this.control()).paused)return;
    const row=(await this.host.all('SELECT * FROM retrieval_maintenance WHERE generation=?',[id]))[0];if(row&&Date.now()-Number(row.checked_at)<30000)return;
    const previous=await this.maintenanceState(id)||freshIndexMaintenance(),running:IndexMaintenance={...previous,phase:'running',error:''};
    await this.host.run('INSERT INTO retrieval_maintenance(generation,state_json,checked_at) VALUES(?,?,?) ON CONFLICT(generation) DO UPDATE SET state_json=excluded.state_json,checked_at=excluded.checked_at',[id,JSON.stringify(running),Date.now()]);
    let state:IndexMaintenance;
    try{state=await this.port.maintain(this.spec(await this.generation(id)),!row||previous.phase==='retry_pending'||!previous.completedAt);if(!validIndexMaintenance(state))throw Error('index_unavailable');}
    catch(error){state={...previous,phase:'retry_pending',error:this.closing||(await this.control()).paused?'interrupted':(error as Error).message==='index_validation_failed'?'index_validation_failed':issue(error)};}
    await this.host.run('UPDATE retrieval_maintenance SET state_json=?,checked_at=? WHERE generation=?',[JSON.stringify(state),Date.now(),id]);
  }
  private async backfill(id:string){
    const g=await this.generation(id);if(g.backfill_done)return;
    const column=g.material_cursor!=='~'?'material_cursor':g.restored_cursor!=='~'?'restored_cursor':'question_cursor',kind:RetrievalKind=column==='question_cursor'?'question':'material',table=column==='material_cursor'?'resource_chunks':column==='restored_cursor'?'material_ai_text_documents_v1':'question_bank_items';
    const rows=await this.host.all(`SELECT id FROM ${table} WHERE id>? ORDER BY id COLLATE BINARY LIMIT 8`,[String(g[column])]);
    const objects:{kind:RetrievalKind;id:string}[]=[];for(const row of rows){
      if(this.closing||(await this.control()).paused)return;
      const objectId=String(row.id);
      if(kind==='question')await this.host.writer(target=>target.linkQuestion(objectId));
      // Only historical facts without a clock receipt get an initial event. Rebuilds never change fact time.
      await this.host.run("INSERT INTO retrieval_changes(kind,object_id) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM retrieval_current WHERE kind=? AND object_id=?)",[kind,objectId,kind,objectId]);
      objects.push({kind,id:objectId});
    }
    await this.applyObjects(this.spec(g),objects);
    const cursor=rows.length===8?String(rows.at(-1)!.id):'~';
    await this.host.run(`UPDATE retrieval_generations SET ${column}=?,backfill_done=CASE WHEN ?='~' AND ?='question' THEN 1 ELSE backfill_done END WHERE id=? AND ${column}=?`,[cursor,cursor,kind,id,String(g[column])]);
  }
  private async applyObject(spec:GenerationSpec,kind:RetrievalKind,id:string){
    let failedSeq=Number((await this.host.all('SELECT seq FROM retrieval_current WHERE kind=? AND object_id=?',[kind,id]))[0]?.seq||0);
    try{const loaded=await this.fact(kind,id);if(!loaded.fact.seq)throw Error('source_changed');failedSeq=loaded.fact.seq;await this.port!.apply(spec,loaded.fact);await this.host.run('DELETE FROM retrieval_failures WHERE generation=? AND kind=? AND object_id=? AND seq<=?',[spec.id,kind,id,failedSeq]);}
    catch(error){if(!['too_large','invalid_input'].includes((error as Error).message))throw error;
      if(!failedSeq)throw Error('source_changed');
      // A late failure belongs to this snapshot, never to a newer teacher correction.
      await this.port!.apply(spec,{kind,id,seq:failedSeq,digest:'',resourceId:'',subject:'',grade:'',knowledgePoint:'',questionType:'',difficulty:'',sourceKind:'',text:'',deleted:true});
      await this.host.run('INSERT INTO retrieval_failures(generation,kind,object_id,seq,error) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM retrieval_current WHERE kind=? AND object_id=? AND seq=?) ON CONFLICT(generation,kind,object_id) DO UPDATE SET seq=excluded.seq,error=excluded.error',[spec.id,kind,id,failedSeq,(error as Error).message,kind,id,failedSeq]);
    }
  }
  private async applyObjects(spec:GenerationSpec,objects:{kind:RetrievalKind;id:string}[]){
    if(!this.port?.applyMany){for(const object of objects){if(this.closing||(await this.control()).paused)throw Error('cancelled');await this.applyObject(spec,object.kind,object.id);}return;}
    let batch:RetrievalFact[]=[],characters=0,bytes=2;
    const flush=async()=>{if(!batch.length)return;if(this.closing||(await this.control()).paused)throw Error('cancelled');
      const facts=batch;batch=[];characters=0;bytes=2;
      try{await this.port!.applyMany!(spec,facts);for(const fact of facts)await this.host.run('DELETE FROM retrieval_failures WHERE generation=? AND kind=? AND object_id=?',[spec.id,fact.kind,fact.id]);}
      catch(error){if(!['invalid_input','too_large'].includes((error as Error).message))throw error;for(const fact of facts)await this.applyObject(spec,fact.kind,fact.id);}
    };
    for(const object of objects){if(this.closing||(await this.control()).paused)throw Error('cancelled');let fact:RetrievalFact;
      try{fact=(await this.fact(object.kind,object.id)).fact;if(!fact.seq)throw Error('source_changed');}catch(error){if(!['invalid_input','too_large'].includes((error as Error).message))throw error;await flush();await this.applyObject(spec,object.kind,object.id);continue;}
      const size=Buffer.byteLength(JSON.stringify(fact))+1;if(batch.length&&(batch.length>=RETRIEVAL_BATCH_OBJECTS||characters+fact.text.length>RETRIEVAL_BATCH_TEXT||bytes+size>RETRIEVAL_BATCH_BYTES))await flush();batch.push(fact);characters+=fact.text.length;bytes+=size;
    }await flush();
  }
  private async events(id:string,limit=16){
    const g=await this.generation(id),spec=this.spec(g);await this.port!.ensure(spec);
    const events=await this.host.all('SELECT * FROM retrieval_changes WHERE seq>? ORDER BY seq LIMIT ?',[Number(g.applied_seq),limit]);
    if(events.length){if(this.closing||(await this.control()).paused)return 0;await this.applyObjects(spec,[...new Map(events.map(event=>[String(event.kind)+':'+String(event.object_id),{kind:String(event.kind) as RetrievalKind,id:String(event.object_id)}])).values()]);const seq=Number(events.at(-1)!.seq);await this.host.run('UPDATE retrieval_generations SET applied_seq=? WHERE id=? AND applied_seq<?',[seq,id,seq]);await new Promise<void>(resolve=>setImmediate(resolve));}
    return events.length;
  }
  async fact(kind:RetrievalKind,id:string,purpose?:QuestionContextPurpose|'web_source_check'):Promise<{fact:RetrievalFact;unit?:MaterialReadingUnit;question?:QuestionBankItem;sources?:{id:string;revision:number}[]}>{
    let seq=0;
    const deleted:RetrievalFact={kind,id,seq,digest:'',resourceId:'',subject:'',grade:'',knowledgePoint:'',questionType:'',difficulty:'',sourceKind:'',text:'',deleted:true};
    if(kind==='material'){
      const row=(await this.host.all("SELECT c.*,r.original_file_name source_name,r.content_hash source_version,r.parse_status source_status,k.seq fact_seq FROM (SELECT ? requested_id) s LEFT JOIN resource_chunks c ON c.id=s.requested_id LEFT JOIN teacher_resources r ON r.id=c.resource_id LEFT JOIN retrieval_current k ON k.kind='material' AND k.object_id=s.requested_id",[id]))[0];
      seq=Number(row?.fact_seq||0);deleted.seq=seq;
      if(!row?.id){const restored=await this.restoredText.unit(id);if(!restored)return{fact:deleted};return{fact:{...deleted,seq:restored.seq,digest:materialUnitDigest(restored.unit),resourceId:restored.unit.resourceId,text:restored.unit.chunk.contentMd,sourceKind:'ai_restored_page',deleted:false},unit:restored.unit};}
      if(row.contains_personal_data||!readable.includes(String(row.source_status)))return {fact:deleted};
      const chunk=this.host.chunk(row);
      const unit={resourceId:String(row.resource_id),version:String(row.source_version),title:String(row.source_name),offset:-1,chunk};
      const digest=hash([unit.resourceId,unit.version,materialBodyVersion(chunk)]);
      return{fact:{...deleted,deleted:false,digest,resourceId:unit.resourceId,subject:String(row.subject||''),grade:String(row.grade||''),knowledgePoint:String(row.knowledge_point||''),questionType:String(row.question_type||''),difficulty:String(row.difficulty||''),sourceKind:'teacher_resource',text:chunk.contentMd},unit};
    }
    const row=(await this.host.all("SELECT q.*,k.seq fact_seq FROM (SELECT ? requested_id) s LEFT JOIN question_bank_items q ON q.id=s.requested_id LEFT JOIN retrieval_current k ON k.kind='question' AND k.object_id=s.requested_id",[id]))[0];seq=Number(row?.fact_seq||0);deleted.seq=seq;if(!row?.id)return{fact:deleted};
    let q:QuestionBankItem;try{q=this.host.question(row);if((purpose==='web_source_check'?false:purpose==='answer_enrichment'?!answerEnrichmentRoles(q).length:!archiveEligible(q))||questionFactConflicts(q).length||q.document&&q.document.schemaVersion!=='xiaozhi.question-document.v2')return{fact:deleted};}catch{return{fact:deleted};}
    const sourceRevisions=new Map<string,number>();const remember=(id:string,revision:number)=>{const previous=sourceRevisions.get(id);sourceRevisions.set(id,revision);return previous===undefined||previous===revision;};
    for(const source of q.archive?.sources||[]){const parent=(await this.host.all('SELECT c.*,r.content_hash parent_version,r.parse_status parent_status,COALESCE(v.revision,0) source_revision FROM resource_chunks c JOIN teacher_resources r ON r.id=c.resource_id LEFT JOIN retrieval_source_revisions v ON v.resource_id=r.id WHERE c.id=? AND c.resource_id=?',[source.chunkId,source.resourceId]))[0];if(!parent||!remember(source.resourceId,Number(parent.source_revision))||parent.parent_version!==source.version||parent.contains_personal_data||!readable.includes(String(parent.parent_status))||materialBodyVersion(this.host.chunk(parent))!==source.bodyVersion)return{fact:deleted};}
    if(q.archive?.pageSource){
      const source=q.archive.pageSource,receipt=q.archive.ai;if(!receipt)return{fact:deleted};
      try{
        const parent=(await this.host.all('SELECT COALESCE(v.revision,0) revision FROM teacher_resources r LEFT JOIN retrieval_source_revisions v ON v.resource_id=r.id WHERE r.id=?',[source.resourceId]))[0];if(!parent||!remember(source.resourceId,Number(parent.revision)))return{fact:deleted};
        await validateAiPageSource(this.host,source);const proof=await readAiPageReceipt(this.host,receipt.batchId,receipt.ordinal),original=proof.final.questions.find(p=>p.number===q.archive!.number);
        if(!original||receipt.firstSha!==proof.firstSha||receipt.finalSha!==proof.finalSha||receipt.imageSha!==proof.imageSha||JSON.stringify(source)!==JSON.stringify(proof.unit.pageSource)||(await this.host.all('SELECT 1 FROM material_ai_members WHERE batch_id=? AND ordinal=? AND question_id=? AND number=?',[receipt.batchId,receipt.ordinal,q.id,q.archive.number])).length!==1)return{fact:deleted};
        if(q.archive.state==='ai_final'&&(aiPageQuestionIssues(proof.first,proof.final,source,proof.imageSha,original).length||(['stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty'] as const).some(k=>q[k]!==original[k])))return{fact:deleted};
      }catch{return{fact:deleted};}
    }
    if(q.document){const document=q.document,parent=(await this.host.all('SELECT content_hash,COALESCE(v.revision,0) source_revision FROM teacher_resources r LEFT JOIN retrieval_source_revisions v ON v.resource_id=r.id WHERE r.id=?',[document.source.resourceId]))[0];if(!parent||!remember(document.source.resourceId,Number(parent.source_revision))||parent.content_hash!==document.source.resourceVersion)return{fact:deleted};
      // A verified full original can remain usable after OCR failure. Privacy on any cited page cannot.
      const pages=new Set<number>([...document.answer.anchors,...document.analysis.anchors].map(a=>a.page));const visit=(blocks:QuestionBlock[])=>{for(const b of blocks){b.anchors.forEach(a=>pages.add(a.page));if(b.kind==='subquestion')visit(b.blocks);if(b.kind==='choices')b.options.forEach(o=>visit(o.blocks));}};visit(document.blocks);
      const privateRows=await this.host.all(`SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0 AND (page_number IS NULL OR typeof(page_number)<>'integer' OR page_number NOT BETWEEN 1 AND 100000 OR page_number IN (${[...pages].map(()=>'?').join(',')})) LIMIT 1`,[document.source.resourceId,...pages]);if(privateRows.length)return{fact:deleted};}
    if(q.archive?.native){const native=q.archive.native,bound=(await this.host.all('SELECT native_json FROM material_ai_native_revisions WHERE question_id=? AND question_version=?',[q.id,hash(questionFacts(q))]))[0];if(!bound||bound.native_json!==JSON.stringify(native)||(await this.host.all('SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0 LIMIT 1',[native.source.resourceId])).length)return{fact:deleted};}
    const text=[q.subject,q.grade,q.knowledgePoint,q.questionType,...q.tags,...(questionPresentation(q).projection?Object.values(questionPresentation(q).projection!).map(p=>p.text):[q.stem])].join('\n');
    if(text.length>128000)throw Error('too_large');
    return{fact:{...deleted,deleted:false,digest:hash(questionFacts(q)),subject:q.subject,grade:q.grade,knowledgePoint:q.knowledgePoint,questionType:q.questionType,difficulty:q.difficulty,sourceKind:q.sourceKind,text},question:q,sources:[...sourceRevisions].map(([id,revision])=>({id,revision}))};
  }
  /** Same privacy/source revision closure as ordinary retrieval, without granting index or paper eligibility. */
  async validateAnswerEnrichment(question:QuestionBankItem,signal?:AbortSignal,purpose:QuestionContextPurpose|'web_source_check'='answer_enrichment'){
    signal?.throwIfAborted();const current=await this.fact('question',question.id,purpose);
    if(!current.question||current.fact.deleted||current.fact.digest!==hash(questionFacts(question)))throw Error('source_changed');
    const valid=await this.filterCurrent('question',[{id:question.id,seq:current.fact.seq,sources:current.sources}]);
    signal?.throwIfAborted();if(!valid.has(question.id))throw Error('source_changed');
  }
  async drain(){
    if(!this.port||this.closing)return false;let c=await this.control();if(c.paused)return false;
    if(!c.active&&!c.building){await this.host.writer(async target=>{const fresh=await target.control();if(!fresh.active&&!fresh.building)await target.newGeneration();});c=await this.control();}
    const id=String(c.building||c.active),g=await this.generation(id),spec=this.spec(g);
    if(!c.building&&g.backfill_done&&Number(g.applied_seq)===await this.maximum()&&!c.error){await this.maintain(id);return false;}
    await this.port.ensure(spec);
    let oldUnavailable=false;
    if(c.building&&c.active){try{await this.events(String(c.active),8);}catch(error){if((error as Error).message!=='generation_mismatch')throw error;oldUnavailable=true;}}
    if(!g.backfill_done)await this.backfill(id);
    const eventCount=await this.events(id);
    const fresh=await this.generation(id),max=await this.maximum();
    const counts=await this.port.counts(spec);await this.host.run('UPDATE retrieval_generations SET indexed=? WHERE id=?',[counts.objects,id]);
    if(fresh.backfill_done&&Number(fresh.applied_seq)===max){
      await this.host.writer(async target=>{const now=await target.generation(id);if(Number(now.applied_seq)!==await target.maximum()||!now.backfill_done)return;
        await target.host.run('UPDATE retrieval_generations SET indexed=? WHERE id=?',[counts.objects,id]);
        await target.host.run("UPDATE retrieval_control SET active=?,building=CASE WHEN building=? THEN '' ELSE building END,error='' WHERE id=1",[id,id]);
      });
      await this.maintain(id);
    }else {await this.host.run('UPDATE retrieval_control SET error=? WHERE id=1',[oldUnavailable?'generation_mismatch':'']);await this.maintain(id);}
    return !!eventCount||!fresh.backfill_done;
  }
  private async semantic(kind:RetrievalKind,query:string,filters:Partial<QuestionSearchFilters>&{resourceId?:string},limit:number,desired=20){
    const c=await this.control(),id=String(c.active||c.building),g=id?await this.generation(id):undefined;
    const coverage:SemanticCoverage={available:false,complete:false,generation:id,pending:g?Math.max(0,await this.maximum()-Number(g.applied_seq)):0,failed:g?await this.failed(id):0,backfilling:!g?.backfill_done,reason:'not_ready',candidateLimit:limit,exhausted:false};
    if(!this.port||!g)return{hits:[],coverage};
    try{const began=Date.now();let result;
      while(true){result=await this.port.query(this.spec(g),{generation:id,kind,query,limit,...Object.fromEntries(Object.entries(filters).filter(([key,value])=>['resourceId','subject','grade','knowledgePoint','questionType','difficulty','sourceKind'].includes(key)&&value!==undefined))});
        const unique=[...new Set(result.hits.map(h=>h.id))];
        const rows=unique.length?await this.host.all(`SELECT object_id,seq FROM retrieval_current WHERE kind=? AND object_id IN (${unique.map(()=>'?').join(',')})`,[kind,...unique]):[];
        const revisions=new Map(rows.map(r=>[String(r.object_id),Number(r.seq)])),valid=new Set(result.hits.filter(h=>revisions.get(h.id)===h.seq).map(h=>h.id));
        if(valid.size>=desired||!result.exhausted||limit>=1000||Date.now()-began>1500)break;limit=Math.min(1000,limit*2);
      }
      coverage.candidateLimit=limit;
      coverage.available=true;coverage.complete=!!g.backfill_done&&coverage.pending===0&&coverage.failed===0;coverage.reason=coverage.complete?'':coverage.backfilling?'backfilling':coverage.failed?'failed_objects':'pending_changes';coverage.exhausted=result.exhausted;return{hits:result.hits,coverage};
    }catch(error){coverage.reason=issue(error);return{hits:[],coverage};}
  }
  private async refresh(coverage:SemanticCoverage){if(!coverage.generation)return;const g=await this.generation(coverage.generation);coverage.pending=Math.max(0,await this.maximum()-Number(g.applied_seq));coverage.backfilling=!g.backfill_done;coverage.failed=await this.failed(coverage.generation);coverage.complete=coverage.available&&!coverage.pending&&!coverage.failed&&!coverage.backfilling;coverage.reason=coverage.complete?'':coverage.backfilling?'backfilling':coverage.failed?'failed_objects':coverage.pending?'pending_changes':coverage.reason;}
  async filterCurrent(kind:RetrievalKind,receipts:ResultReceipt[],coverage?:SemanticCoverage){
    if(!receipts.length)return new Set<string>();
    const parents=[...new Set(receipts.flatMap(r=>(r.sources||[]).map(s=>s.id)))],rows=await this.host.all(`SELECT 'object' record_kind,object_id id,seq revision FROM retrieval_current WHERE kind=? AND object_id IN (${receipts.map(()=>'?').join(',')})${parents.length?` UNION ALL SELECT 'source',resource_id,revision FROM retrieval_source_revisions WHERE resource_id IN (${parents.map(()=>'?').join(',')})`:''}${coverage?.generation?" UNION ALL SELECT 'clock','',COALESCE(MAX(seq),0) FROM retrieval_changes UNION ALL SELECT 'applied','',applied_seq FROM retrieval_generations WHERE id=?":''}`,[kind,...receipts.map(r=>r.id),...parents,...(coverage?.generation?[coverage.generation]:[])]);
    if(coverage?.generation){coverage.pending=Math.max(0,Number(rows.find(r=>r.record_kind==='clock')?.revision||0)-Number(rows.find(r=>r.record_kind==='applied')?.revision||0));coverage.complete=coverage.available&&!coverage.pending&&!coverage.failed&&!coverage.backfilling;if(coverage.pending)coverage.reason='pending_changes';}
    const revisions=new Map(rows.filter(r=>r.record_kind==='object').map(r=>[String(r.id),Number(r.revision)])),sources=new Map(rows.filter(r=>r.record_kind==='source').map(r=>[String(r.id),Number(r.revision)]));return new Set(receipts.filter(r=>(revisions.get(r.id)||0)===r.seq&&(r.sources||[]).every(s=>(sources.get(s.id)||0)===s.revision)).map(r=>r.id));
  }
  private async rerank(ids:string[],query:string,context:(id:string)=>{text:string;focus?:number}){
    const began=Date.now(),coverage:RerankCoverage={available:false,complete:false,model:RERANK_ID,candidates:ids.length,processed:0,elapsedMs:0,reason:'unavailable'};
    if(ids.length<2){coverage.available=true;coverage.complete=true;coverage.reason='not_needed';return{ids,coverage};}
    if(!this.port?.rerank)return{ids,coverage};
    try{const selected=ids.slice(0,RERANK_LIMIT),items=selected.map(id=>{const value=context(id);return rerankContext(id,value.text,query,value.focus);}),result=await this.port.rerank(query,items);
      if(!Array.isArray(result.scores)||result.scores.length!==items.length||new Set(result.scores.map(s=>s.id)).size!==items.length||result.scores.some(s=>!selected.includes(s.id)||!Number.isFinite(s.score)||typeof s.complete!=='boolean'))throw Error('invalid_result');
      const scores=new Map(result.scores.map(s=>[s.id,s.score]));selected.sort((a,b)=>scores.get(b)!-scores.get(a)!||ids.indexOf(a)-ids.indexOf(b));
      // The cross-encoder is another relevance signal; preserve the original recall ranking as an equal vote.
      const fused=new Map(selected.map((id,i)=>[id,1/(61+i)+1/(61+ids.indexOf(id))]));selected.sort((a,b)=>fused.get(b)!-fused.get(a)!||ids.indexOf(a)-ids.indexOf(b));
      coverage.available=true;coverage.processed=items.length;coverage.complete=ids.length<=RERANK_LIMIT&&items.every(i=>i.complete)&&result.scores.every(s=>s.complete);coverage.reason=items.some(i=>!i.complete)||result.scores.some(s=>!s.complete)?'partial_context':ids.length>RERANK_LIMIT?'candidate_limit':'';
      return{ids:[...selected,...ids.slice(RERANK_LIMIT)],coverage};
    }catch(error){coverage.reason=['busy','reranker_timeout','invalid_input'].includes((error as Error).message)?(error as Error).message:'unavailable';return{ids,coverage};}
    finally{coverage.elapsedMs=Date.now()-began;}
  }
  async materials(query:string,resourceId?:string,limit=200,offset=0,pageSize=20){
    let lexical=await this.host.fullText().candidates(query,resourceId,limit,0,false);const semantic=await this.semantic('material',query,{resourceId},100,offset+pageSize);
    const fallback=!semantic.coverage.available;
    if(fallback)lexical=await this.host.fullText().candidates(query,resourceId,pageSize,offset,false);
    const byId=new Map<string,{unit:MaterialReadingUnit;method:string;start:number;end:number;seq:number}>();
    const lexicalIds:string[]=[];
    for(const unit of lexical.units){const current=await this.fact('material',unit.chunk.id);if(current.fact.deleted||!current.unit||current.fact.digest!==materialUnitDigest(unit))continue;lexicalIds.push(unit.chunk.id);byId.set(unit.chunk.id,{unit:current.unit,method:'keyword',start:0,end:0,seq:current.fact.seq});}
    const semanticIds:string[]=[];
    for(const hit of semantic.hits){if(semanticIds.includes(hit.id))continue;const current=await this.fact('material',hit.id);
      if(current.fact.deleted||current.fact.seq!==hit.seq||current.fact.digest!==hit.digest||!current.unit||resourceId&&current.unit.resourceId!==resourceId)continue;
      semanticIds.push(hit.id);const prior=byId.get(hit.id);byId.set(hit.id,{unit:current.unit,method:prior?'hybrid':'semantic',start:hit.start,end:hit.end,seq:current.fact.seq});
    }
    const ranked=await this.rerank(fuseRanks(lexicalIds,semanticIds),query,id=>{const hit=byId.get(id)!;return{text:hit.unit.chunk.contentMd,...(hit.method!=='keyword'?{focus:hit.start}:{})};});semantic.coverage.rerank=ranked.coverage;
    const ids=ranked.ids,selected=ids.slice(fallback?0:offset,(fallback?0:offset)+pageSize).map(id=>byId.get(id)!);
    for(const hit of selected){if(hit.unit.restored)continue;const c=hit.unit.chunk;hit.unit.offset=Number((await this.host.all('SELECT COUNT(*) n FROM resource_chunks WHERE resource_id=? AND (chunk_index<? OR chunk_index=? AND id<?)',[hit.unit.resourceId,c.chunkIndex,c.chunkIndex,c.id]))[0].n);}
    await this.refresh(semantic.coverage);
    semantic.coverage.exhausted||=!fallback&&lexical.hasMore;
    const valid=await this.filterCurrent('material',selected.map(h=>({id:h.unit.chunk.id,seq:h.seq})),semantic.coverage),hits=selected.filter(h=>valid.has(h.unit.chunk.id));if(hits.length!==selected.length){semantic.coverage.complete=false;semantic.coverage.reason='source_changed';}
    return{...lexical,units:hits.map(v=>v.unit),hits,hasMore:fallback?lexical.hasMore:ids.length>offset+pageSize,semantic:semantic.coverage};
  }
  async questions(raw:QuestionSearchFilters){
    const filters=validatedQuestionFilters(raw),query=filters.query?.trim()||'';
    if(!query||!this.port){const questions:SimilarQuestionMatch[]=[],receipts:ResultReceipt[]=[];for(const candidate of await this.host.keyword(raw)){const current=await this.fact('question',candidate.id);if(current.question&&!current.fact.deleted&&current.fact.digest===hash(questionFacts(candidate))){questions.push({...current.question,score:candidate.score,matchReason:candidate.matchReason});receipts.push({id:candidate.id,seq:current.fact.seq,sources:current.sources});}}const valid=await this.filterCurrent('question',receipts);return{questions:questions.filter(q=>valid.has(q.id)),semantic:undefined};}
    const lexicalBefore=await this.host.keyword({...filters,limit:50}),semantic=await this.semantic('question',query,filters,100,raw.limit??8),found=new Map<string,QuestionBankItem>(),ids:string[]=[],lexical:QuestionBankItem[]=[];
    const revisions=new Map<string,ResultReceipt>();
    for(const q of lexicalBefore){const current=await this.fact('question',q.id);if(!current.question||current.fact.deleted||current.fact.digest!==hash(questionFacts(q)))continue;lexical.push(current.question);found.set(q.id,current.question);revisions.set(q.id,{id:q.id,seq:current.fact.seq,sources:current.sources});}
    for(const hit of semantic.hits){if(ids.includes(hit.id))continue;const current=await this.fact('question',hit.id),q=current.question;
      if(!q||current.fact.deleted||current.fact.seq!==hit.seq||current.fact.digest!==hit.digest)continue;
      if(['subject','grade','questionType','difficulty','sourceKind'].some(key=>filters[key as keyof QuestionSearchFilters]!==undefined&&q[key as keyof QuestionBankItem]!==filters[key as keyof QuestionSearchFilters]))continue;
      if(filters.knowledgePoint&&!q.knowledgePoint.includes(filters.knowledgePoint))continue;
      found.set(q.id,q);ids.push(q.id);revisions.set(q.id,{id:q.id,seq:current.fact.seq,sources:current.sources});
    }
    const ranked=await this.rerank(fuseRanks(lexical.map(q=>q.id),ids),query,id=>{const q=found.get(id)!,hit=semantic.hits.find(h=>h.id===id),projection=questionPresentation(q).projection?Object.entries(questionPresentation(q).projection!).filter(([key])=>key!=='statement').map(([,v])=>v.text):[];return{text:[q.stem,...projection].join('\n'),...(hit?{focus:Math.max(0,hit.start-[q.subject,q.grade,q.knowledgePoint,q.questionType,...q.tags].join('\n').length-1)}:{})};});semantic.coverage.rerank=ranked.coverage;
    await this.refresh(semantic.coverage);
    semantic.coverage.exhausted||=lexicalBefore.length===50;
    const selected=ranked.ids.slice(0,raw.limit??8),valid=await this.filterCurrent('question',selected.map(id=>revisions.get(id)!),semantic.coverage);if(valid.size!==selected.length){semantic.coverage.complete=false;semantic.coverage.reason='source_changed';}
    return{questions:selected.filter(id=>valid.has(id)).map(id=>({...found.get(id)!,matchReason:ids.includes(id)?'按题意和知识点检索；相似不代表答案已核验':'命中关键词',retrievalMethod:'local_hybrid_v1' as const,score:0})),semantic:semantic.coverage};
  }
}
