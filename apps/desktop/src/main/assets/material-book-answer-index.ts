import {MaterialBookAnswerWork} from './material-book-answer-work';
import {createHash} from 'node:crypto';
import {bookAnswerSectionReviewResolved} from './material-book-answer-content';
import {MaterialBookQuestionSection,BOOK_SECTION_LOOKBACK} from './material-book-question-section';
import {validMaterialPageSource} from '../../shared/material-ai-page';
import type {readAiPageReceipt} from './material-ai-page-evidence';
type Row=Record<string,unknown>;type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,p?:(string|number|null)[])=>Promise<void>;receipt:(batch:string,ordinal:number)=>ReturnType<typeof readAiPageReceipt>};
/** B-tree lookup cache only. Every selected entry is reopened from immutable receipts before use. */
export class MaterialBookAnswerIndex{
 constructor(private host:Host){}
 async migrate(){
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS material_book_answer_index_v1(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,start INTEGER NOT NULL,resource_id TEXT NOT NULL,version TEXT NOT NULL,page INTEGER NOT NULL,seq INTEGER NOT NULL,section_key TEXT NOT NULL,number TEXT NOT NULL,PRIMARY KEY(batch_id,ordinal,start))',
   'CREATE INDEX IF NOT EXISTS material_book_answer_lookup_v1 ON material_book_answer_index_v1(resource_id,version,section_key,number)',
   'CREATE INDEX IF NOT EXISTS material_book_answer_latest_v1 ON material_book_answer_index_v1(resource_id,version,page,seq)',
   'CREATE INDEX IF NOT EXISTS material_ai_batches_resource_version ON material_ai_batches(resource_id,version)',
   'CREATE TABLE IF NOT EXISTS material_book_answer_dirty_v1(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(batch_id,ordinal))',
   'CREATE TABLE IF NOT EXISTS material_book_answer_control_v1(id INTEGER PRIMARY KEY CHECK(id=1),cursor INTEGER NOT NULL)',
   'INSERT OR IGNORE INTO material_book_answer_control_v1(id,cursor) VALUES(1,0)'
  ])await this.host.run(sql);
  const columns=await this.host.all('PRAGMA table_info(material_book_answer_control_v1)');
  if(!columns.some(c=>c.name==='section_policy'))await this.host.run('ALTER TABLE material_book_answer_control_v1 ADD COLUMN section_policy INTEGER NOT NULL DEFAULT 0');
  const indexed=await this.host.all('PRAGMA table_info(material_book_answer_index_v1)');
  for(const name of ['book_role','proof_sha','review_state'])if(!indexed.some(c=>c.name===name))await this.host.run(`ALTER TABLE material_book_answer_index_v1 ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
  const dirty=await this.host.all('PRAGMA table_info(material_book_answer_dirty_v1)');
  if(!dirty.some(c=>c.name==='context_only'))await this.host.run('ALTER TABLE material_book_answer_dirty_v1 ADD COLUMN context_only INTEGER NOT NULL DEFAULT 0');
  for(const table of ['material_ai_units','material_ai_page_units'])for(const event of ['INSERT','UPDATE','DELETE']){
   const name=`material_book_answer_${table}_${event.toLowerCase()}`,r=event==='DELETE'?'old':'new';
   await this.host.run(`DROP TRIGGER IF EXISTS ${name}_v1`);
   await this.host.run(`CREATE TRIGGER IF NOT EXISTS ${name}_v2 AFTER ${event} ON ${table} BEGIN INSERT INTO material_book_answer_dirty_v1(batch_id,ordinal,context_only) VALUES(${r}.batch_id,${r}.ordinal,0) ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=revision+1,context_only=0; END`);
  }
  // One incremental pass upgrades old projections, without replaying any model receipt.
  await this.host.run('UPDATE material_book_answer_control_v1 SET cursor=0,section_policy=3 WHERE id=1 AND section_policy<3');
 }
 async pending(){return !!(await this.host.all('SELECT 1 FROM material_book_answer_dirty_v1 UNION ALL SELECT 1 FROM material_ai_page_units WHERE rowid>(SELECT cursor FROM material_book_answer_control_v1 WHERE id=1) LIMIT 1')).length;}
 async applyOne(){
  const dirty=(await this.host.all('SELECT batch_id,ordinal,revision,context_only FROM material_book_answer_dirty_v1 LIMIT 1'))[0];
  const slot=(await this.host.all(`SELECT rowid seq,* FROM material_ai_page_units WHERE ${dirty?'batch_id=? AND ordinal=?':'rowid>(SELECT cursor FROM material_book_answer_control_v1 WHERE id=1) ORDER BY rowid LIMIT 1'}`,dirty?[String(dirty.batch_id),Number(dirty.ordinal)]:[]))[0];
  if(!slot&&!dirty)return false;
  const batch=String(dirty?.batch_id??slot?.batch_id),ordinal=Number(dirty?.ordinal??slot?.ordinal);
  const before=await this.host.all('SELECT * FROM material_book_answer_index_v1 WHERE batch_id=? AND ordinal=? ORDER BY start',[batch,ordinal]);
  await this.host.run('DELETE FROM material_book_answer_index_v1 WHERE batch_id=? AND ordinal=? AND start>=0',[batch,ordinal]);
  // A deleted or invalid latest page retains its supersession marker, but loses usable provenance.
  await this.host.run("UPDATE material_book_answer_index_v1 SET proof_sha='',review_state='' WHERE batch_id=? AND ordinal=? AND start=-1",[batch,ordinal]);
  if(slot?.final_sha){
   // Record publication order even if the saved proof is now invalid; invalid newer output must suppress older answers.
   const owner=(await this.host.all('SELECT b.resource_id,b.version,u.input_json FROM material_ai_batches b JOIN material_ai_units u ON u.batch_id=b.id WHERE b.id=? AND u.ordinal=?',[batch,ordinal]))[0];
   if(owner){let page=0,kind='';try{const input=JSON.parse(String(owner.input_json));page=input.page;kind=input.bookRole?.kind==='answers'?'answers':'';}catch{/* Keep an existing supersession marker. */}
    if(Number.isSafeInteger(page)&&page>=1&&page<=10000){
     const previous=(await this.host.all('SELECT book_role FROM material_book_answer_index_v1 WHERE resource_id=? AND version=? AND page=? AND start=-1 ORDER BY seq DESC LIMIT 1',[String(owner.resource_id),String(owner.version),page]))[0];
     await this.put(batch,ordinal,-1,String(owner.resource_id),String(owner.version),page,Number(slot.seq),'','',kind||String(previous?.book_role||''),'');
    }
   }
   try{const proof=await this.host.receipt(batch,ordinal),source=proof.unit.pageSource;
    if(proof.unit.bookRole?.kind==='answers'&&validMaterialPageSource(source)){
     // A sentinel for every latest page prevents an older successful transcript surviving a later empty page.
     const {page,context}=await new MaterialBookQuestionSection(this.host,this).answerPage(proof);
     const fingerprint=createHash('sha256').update(JSON.stringify([source,proof.firstSha,proof.finalSha,proof.imageSha,context])).digest('hex');
     const resolved=proof.status==='review'&&!!context&&bookAnswerSectionReviewResolved(proof.first,proof.final,page);
     for(const entry of [{start:-1,sectionKey:'',number:''},...page.entries])await this.put(batch,ordinal,entry.start,source.resourceId,source.version,source.page,Number(slot.seq),entry.sectionKey,entry.number,'answers',fingerprint,entry.start===-1&&resolved?'section-resolved.v1':'');
    }
   }catch(error){if(!(error instanceof Error)||!['source_changed','source_incomplete','privacy_blocked'].includes(error.message))throw error;}
  }
  const after=await this.host.all('SELECT * FROM material_book_answer_index_v1 WHERE batch_id=? AND ordinal=? ORDER BY start',[batch,ordinal]);
  const marker=after.find(r=>Number(r.start)===-1);
  if(marker&&JSON.stringify(before)!==JSON.stringify(after)&&!(await this.host.all('SELECT 1 FROM material_book_answer_index_v1 WHERE resource_id=? AND version=? AND page=? AND seq>? LIMIT 1',[String(marker.resource_id),String(marker.version),Number(marker.page),Number(marker.seq)])).length){
   const work=new MaterialBookAnswerWork(this.host);
   if(marker.book_role==='answers'){
    await work.answerChanged(String(marker.resource_id),String(marker.version));
    // Raw changes fan out once. Context-only rebuilds never recurse or erase a pending raw invalidation.
    if(!dirty?.context_only)await this.invalidateFollowing(String(marker.resource_id),String(marker.version),Number(marker.page));
   }else await work.questionChanged(String(marker.resource_id),String(marker.version),Number(marker.page));
  }
  if(dirty)await this.host.run('DELETE FROM material_book_answer_dirty_v1 WHERE batch_id=? AND ordinal=? AND revision=?',[batch,ordinal,Number(dirty.revision)]);
  else await this.host.run('UPDATE material_book_answer_control_v1 SET cursor=? WHERE id=1',[Number(slot.seq)]);
  return true;
 }
 private async put(batch:string,ordinal:number,start:number,resource:string,version:string,page:number,seq:number,section:string,number:string,kind:string,fingerprint:string,reviewState=''){
  await this.host.run('INSERT OR REPLACE INTO material_book_answer_index_v1(batch_id,ordinal,start,resource_id,version,page,seq,section_key,number,book_role,proof_sha,review_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[batch,ordinal,start,resource,version,page,seq,section,number,kind,fingerprint,reviewState]);
 }
 /** Folder alias u is internal SQL only. Cached visibility never authorizes a question write. */
 folderReviewResolvedSql(){
  if(process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE==='0')return '0';
  return `u.state='review' AND u.error='page_content_incomplete' AND ${this.reviewResolvedSql('u.ai_batch_id','1','u.resource_id','u.version','u.unit')}`;
 }
 /** Batch-list aliases u and b are owned by MaterialAiRepository.list. */
 aiReviewResolvedSql(){
  if(process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE==='0')return '0';
  return `u.status='review' AND u.error='page_content_incomplete' AND ${this.reviewResolvedSql('u.batch_id','u.ordinal','b.resource_id','b.version',"json_extract(CASE WHEN json_valid(u.input_json) THEN u.input_json ELSE '{}' END,'$.page')")}`;
 }
 private reviewResolvedSql(batch:string,ordinal:string,resource:string,version:string,page:string){
  return `(NOT EXISTS(SELECT 1 FROM material_book_answer_dirty_v1)
   AND NOT EXISTS(SELECT 1 FROM material_ai_page_units WHERE rowid>(SELECT cursor FROM material_book_answer_control_v1 WHERE id=1))
   AND EXISTS(SELECT 1 FROM material_book_answer_index_v1 e
    JOIN teacher_resources r ON r.id=e.resource_id AND r.content_hash=e.version
    JOIN material_ai_units a ON a.batch_id=e.batch_id AND a.ordinal=e.ordinal
    JOIN material_book_pairs p ON p.answer_id=e.resource_id AND p.answer_version=e.version AND p.active=1
    JOIN teacher_resources q ON q.id=p.question_id AND q.content_hash=p.question_version
    WHERE e.batch_id=${batch} AND e.ordinal=${ordinal} AND e.start=-1 AND e.resource_id=${resource} AND e.version=${version} AND e.page=${page}
     AND e.review_state='section-resolved.v1' AND e.proof_sha<>'' AND a.status='review' AND a.error='page_content_incomplete'
     AND json_valid(a.input_json) AND json_extract(a.input_json,'$.bookRole.questionId')=p.question_id
     AND json_extract(a.input_json,'$.bookRole.questionVersion')=p.question_version
     AND json_extract(a.input_json,'$.bookRole.revision')=p.revision
     AND NOT EXISTS(SELECT 1 FROM material_book_answer_index_v1 n WHERE n.resource_id=e.resource_id AND n.version=e.version AND n.page=e.page AND n.seq>e.seq)))`;
 }
 private async invalidateFollowing(resource:string,version:string,page:number){
  await this.host.run(`INSERT INTO material_book_answer_dirty_v1(batch_id,ordinal,context_only) SELECT e.batch_id,e.ordinal,1 FROM material_book_answer_index_v1 e WHERE e.resource_id=? AND e.version=? AND e.page>? AND e.page<=? AND e.start=-1 AND e.book_role='answers' AND NOT EXISTS(SELECT 1 FROM material_book_answer_index_v1 n WHERE n.resource_id=e.resource_id AND n.version=e.version AND n.page=e.page AND n.seq>e.seq) AND true ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=revision+1`,[resource,version,page,Math.min(10000,page+BOOK_SECTION_LOOKBACK)]);
 }
 async find(resourceId:string,version:string,section:string,number:string){return this.host.all(`SELECT e.* FROM material_book_answer_index_v1 e WHERE resource_id=? AND version=? AND section_key=? AND number=? AND start>=0 AND NOT EXISTS(SELECT 1 FROM material_book_answer_index_v1 n WHERE n.resource_id=e.resource_id AND n.version=e.version AND n.page=e.page AND n.seq>e.seq) ORDER BY page,start LIMIT 3`,[resourceId,version,section,number]);}
 async sectionPages(resourceId:string,version:string,page:number,lookback:number){return this.host.all(`SELECT e.* FROM material_book_answer_index_v1 e WHERE resource_id=? AND version=? AND page>=? AND page<? AND start=-1 AND NOT EXISTS(SELECT 1 FROM material_book_answer_index_v1 n WHERE n.resource_id=e.resource_id AND n.version=e.version AND n.page=e.page AND n.seq>e.seq) ORDER BY page DESC LIMIT ?`,[resourceId,version,Math.max(1,page-lookback),page,lookback]);}
 async latestPage(resourceId:string,version:string,page:number){return(await this.host.all('SELECT batch_id,ordinal,proof_sha FROM material_book_answer_index_v1 WHERE resource_id=? AND version=? AND page=? AND start=-1 ORDER BY seq DESC LIMIT 1',[resourceId,version,page]))[0];}
 async rebuild(){await this.host.run('DELETE FROM material_book_answer_index_v1');await this.host.run('UPDATE material_book_answer_control_v1 SET cursor=0 WHERE id=1');}
}
