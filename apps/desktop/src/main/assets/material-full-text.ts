import type {MaterialReadingUnit} from './material-source';
import type {ResourceChunk} from '../../shared/contracts';
import type {MaterialIndexStatus} from '../../shared/material-search';
import type {MaterialAiTextIndex} from '../retrieval/material-ai-text-index';
import {validAiTextSource} from '../../shared/material-ai-text';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;map:(r:Row)=>ResourceChunk;withWriter?:(action:(index:MaterialFullTextSearch)=>Promise<void>)=>Promise<void>;restored?:()=>MaterialAiTextIndex|undefined};
const index='material_body_fts_v1',dirty='material_body_dirty_v1';
/** Shared normalisation, explicit version via v1 tables. No model/SQLite extension dependency. */
const characters=(s:string)=>Array.from(s.normalize('NFKC').toLowerCase().replace(/\s+/gu,''));
const token=(s:string[])=>s.map(c=>c.codePointAt(0)!.toString(16)).join('x');
export function materialSearchTokens(text:string){const c=characters(text),tokens=new Set<string>();for(let i=0;i<c.length;i++){tokens.add('u'+token([c[i]]));if(i+1<c.length)tokens.add('b'+token(c.slice(i,i+2)));}return [...tokens].join(' ');}
function queryExpression(query:string){
 return query.trim().split(/\s+/u).filter(Boolean).slice(0,12).map(part=>{
  const c=characters(part);return '('+(c.length===1?['u'+token(c)]:c.slice(0,-1).map((_,i)=>'b'+token(c.slice(i,i+2)))).map(t=>'"'+t+'"').join(' AND ')+')';
 }).join(' OR ');
}
/** Rebuildable index; dirty revisions prevent concurrent backfill from losing a source change. */
export class MaterialFullTextSearch{
 recreated=false;private columns:string[]=[];
 available=false;private timer?:ReturnType<typeof setInterval>;private pumping?:Promise<void>;
 private host:Host;
 constructor(host:Host){this.host=host;}
 async migrate(){
  const prior=await this.host.all(`SELECT name FROM sqlite_master WHERE name IN ('${index}','${dirty}','material_body_ai_v1','material_body_au_v1','material_body_ad_v1')`);
  this.recreated=!prior.some(r=>r.name===index);this.columns=(await this.host.all('PRAGMA table_info(resource_chunks)')).map(r=>String(r.name));
  try{await this.host.run(`CREATE VIRTUAL TABLE IF NOT EXISTS ${index} USING fts5(tokens,normalised UNINDEXED)`);}catch(e){if(/no such module: fts5/i.test(String(e)))return;throw e;}
  await this.host.run(`CREATE TABLE IF NOT EXISTS ${dirty}(chunk_rowid INTEGER PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 1)`);
  for(const [name,event,which]of [['ai','INSERT','new'],['au','UPDATE','new'],['ad','DELETE','old']])await this.host.run(`CREATE TRIGGER IF NOT EXISTS material_body_${name}_v1 AFTER ${event} ON resource_chunks BEGIN INSERT INTO ${dirty}(chunk_rowid) VALUES(${which}.rowid) ON CONFLICT(chunk_rowid) DO UPDATE SET revision=revision+1; END`);
  if(prior.length!==5)await this.host.run(`INSERT INTO ${dirty}(chunk_rowid) SELECT rowid FROM resource_chunks WHERE true ON CONFLICT(chunk_rowid) DO UPDATE SET revision=revision+1`);
  this.available=true;
 }
 start(){if(this.timer||!this.available)return;const pump=()=>{if(this.pumping)return;this.pumping=(async()=>{await this.host.restored?.()?.drain();await this.drain(50);})().catch(()=>undefined).finally(()=>{this.pumping=undefined;});};this.timer=setInterval(pump,700);this.timer.unref();pump();}
 async close(){if(this.timer)clearInterval(this.timer);this.timer=undefined;await this.pumping;}
 private async indexRow(row:Row){
  const id=Number(row.chunk_rowid);await this.host.run(`DELETE FROM ${index} WHERE rowid=?`,[id]);
  if(row.id&&!row.contains_personal_data)await this.host.run(`INSERT INTO ${index}(rowid,tokens,normalised) VALUES (?,?,?)`,[id,materialSearchTokens(String(row.content_md)),characters(String(row.content_md)).join('')]);
  await this.host.run(`DELETE FROM ${dirty} WHERE chunk_rowid=? AND revision=?`,[id,Number(row.revision)]);
 }
 async indexResource(resourceId:string){
  // Called in the same writer transaction as source publication, including on another store connection.
  if(!(await this.host.all(`SELECT name FROM sqlite_master WHERE name=?`,[index])).length)return;
  const rows=await this.host.all(`SELECT c.*,d.chunk_rowid,d.revision FROM ${dirty} d JOIN resource_chunks c ON c.rowid=d.chunk_rowid WHERE c.resource_id=?`,[resourceId]);for(const row of rows)await this.indexRow(row);
 }
 async drain(limit=50){if(!this.available||!(await this.host.all(`SELECT chunk_rowid FROM ${dirty} LIMIT 1`)).length)return;if(this.host.withWriter)await this.host.withWriter(target=>target.applyPending(limit));else await this.applyPending(limit);}
 async applyPending(limit:number){const rows=await this.host.all(`SELECT c.*,d.chunk_rowid,d.revision FROM ${dirty} d LEFT JOIN resource_chunks c ON c.rowid=d.chunk_rowid ORDER BY d.chunk_rowid LIMIT ?`,[limit]);for(const row of rows)await this.indexRow(row);}
 async status():Promise<MaterialIndexStatus>{if(!this.available)return {available:false,pending:0,indexed:0};const rows=await this.host.all(`SELECT (SELECT COUNT(*) FROM ${dirty}) pending,(SELECT COUNT(*) FROM ${index}) indexed_count`),restored=await this.host.restored?.()?.status();return {available:true,pending:Number(rows[0].pending)+(restored?restored.pending+Number(restored.backfilling):0),indexed:Number(rows[0].indexed_count),...(restored?{restored}:{})};}
 async candidates(query:string,resourceId?:string,limit=200,offset=0,resolveOffsets=true):Promise<{units:MaterialReadingUnit[];hasMore:boolean;index:MaterialIndexStatus;coverage:{resources:number;totalChunks:number;excludedPrivateChunks:number;unparsedResources:number}}>{
  if(!this.available)throw new Error('unavailable');
  const expression=queryExpression(query);if(!expression)throw new Error('invalid_input');
  const literals=query.trim().split(/\s+/u).filter(Boolean).slice(0,12).map(s=>characters(s).join(''));
  const sourceState="r.parse_status IN ('ready','partial','parsed','chunked','indexed','graph_extracted')";
  const restored=!!this.host.restored?.(),condition=`${index} MATCH ? AND (${literals.map(()=>`instr(f.normalised,?)>0`).join(' OR ')}) ${resourceId?'AND r.id=?':''}`,args=[expression,...literals,...(resourceId?[resourceId]:[])];
  const original=`SELECT c.*,r.original_file_name AS source_name,r.content_hash AS source_version,r.title AS resource_title,${resolveOffsets?'(SELECT COUNT(*) FROM resource_chunks p WHERE p.resource_id=c.resource_id AND (p.chunk_index<c.chunk_index OR p.chunk_index=c.chunk_index AND p.id<c.id))':'-1'} AS source_offset,'' AS restored_json,bm25(${index}) AS search_rank FROM ${index} f JOIN resource_chunks c ON c.rowid=f.rowid JOIN teacher_resources r ON r.id=c.resource_id WHERE ${condition} AND ${sourceState} AND c.contains_personal_data=0`;
  const values:Record<string,string>={id:'a.id',resource_id:'a.resource_id',chunk_index:'0',heading:"'AI还原正文'",content_md:'a.content_md',page_number:'a.page_number',contains_personal_data:'0',source_trust:"'unverified'",evidence_strength:"'background'",quality_score:'0',embedding_status:"'pending'",created_at:"''"};
  const ai=restored?` UNION ALL SELECT ${this.columns.map(c=>(values[c]||'NULL')+' AS "'+c.replaceAll('"','""')+'"').join(',')},r.original_file_name source_name,r.content_hash source_version,r.title resource_title,0 source_offset,a.source_json restored_json,bm25(${index}) search_rank FROM ${index} f JOIN material_ai_text_documents_v1 a ON a.rowid=-f.rowid JOIN teacher_resources r ON r.id=a.resource_id AND r.content_hash=a.version WHERE ${condition} AND (${sourceState} OR r.parse_status='failed') AND a.active=1`:'';
  const rows=await this.host.all(`${original}${ai} ORDER BY search_rank,id LIMIT ? OFFSET ?`,[...args,...(restored?args:[]),limit+1,offset]);
  const count=(await this.host.all(`SELECT COUNT(DISTINCT r.id) resources,COUNT(*) total_chunks,COALESCE(SUM(c.contains_personal_data<>0),0) excluded FROM resource_chunks c JOIN teacher_resources r ON r.id=c.resource_id WHERE r.parse_status IN ('ready','partial','parsed','chunked','indexed','graph_extracted') ${resourceId?'AND r.id=?':''}`,[...(resourceId?[resourceId]:[])]))[0];
  const hasPdfJobs=(await this.host.all("SELECT name FROM sqlite_master WHERE name='material_pdf_jobs'")).length>0;
  const complete=hasPdfJobs?"r.parse_status IN ('ready','parsed','chunked','indexed','graph_extracted') AND CASE WHEN lower(r.original_file_name) LIKE '%.pdf' THEN EXISTS(SELECT 1 FROM material_pdf_jobs p WHERE p.resource_id=r.id AND p.version=r.content_hash AND p.state='complete') ELSE EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id) END":"r.parse_status IN ('ready','parsed','chunked','indexed','graph_extracted') AND EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id)";
  const unparsed=Number((await this.host.all(`SELECT COUNT(*) n FROM teacher_resources r WHERE NOT (${complete}) ${resourceId?'AND r.id=?':''}`,[...(resourceId?[resourceId]:[])]))[0]?.n||0);
  const units:MaterialReadingUnit[]=rows.slice(0,limit).flatMap(r=>{let reference;try{if(r.restored_json){reference=JSON.parse(String(r.restored_json));if(!validAiTextSource(reference))return[];}}catch{return[];}return[{resourceId:String(r.resource_id),version:String(r.source_version),title:String(r.source_name),offset:Number(r.source_offset),chunk:this.host.map(r),...(reference?{restored:reference}:{})}];});
  const aiCount=restored?(await this.host.all(`SELECT COUNT(*) total_chunks,COUNT(DISTINCT CASE WHEN NOT EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=a.resource_id) THEN a.resource_id END) resources FROM material_ai_text_documents_v1 a JOIN teacher_resources r ON r.id=a.resource_id AND r.content_hash=a.version WHERE a.active=1 AND a.content_md<>'' ${resourceId?'AND r.id=?':''}`,[...(resourceId?[resourceId]:[])]))[0]:undefined;
  return {units,hasMore:rows.length>limit,index:await this.status(),coverage:{resources:Number(count.resources)+Number(aiCount?.resources||0),totalChunks:Number(count.total_chunks)+Number(aiCount?.total_chunks||0),excludedPrivateChunks:Number(count.excluded),unparsedResources:unparsed}};
 }
}
