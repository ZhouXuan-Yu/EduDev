import {MaterialBookAnswerWork} from './material-book-answer-work';
import {bookAnswerPage} from './material-book-answer-content';
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
   'INSERT OR IGNORE INTO material_book_answer_control_v1 VALUES(1,0)',
   ...['material_ai_units','material_ai_page_units'].flatMap(table=>['INSERT','UPDATE','DELETE'].map(event=>{const r=event==='DELETE'?'old':'new';return `CREATE TRIGGER IF NOT EXISTS material_book_answer_${table}_${event.toLowerCase()}_v1 AFTER ${event} ON ${table} BEGIN INSERT INTO material_book_answer_dirty_v1(batch_id,ordinal) VALUES(${r}.batch_id,${r}.ordinal) ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=revision+1; END`;}))
  ])await this.host.run(sql);
 }
 async pending(){return !!(await this.host.all('SELECT 1 FROM material_book_answer_dirty_v1 UNION ALL SELECT 1 FROM material_ai_page_units WHERE rowid>(SELECT cursor FROM material_book_answer_control_v1 WHERE id=1) LIMIT 1')).length;}
 async applyOne(){
  const dirty=(await this.host.all('SELECT batch_id,ordinal,revision FROM material_book_answer_dirty_v1 LIMIT 1'))[0];
  const slot=(await this.host.all(`SELECT rowid seq,* FROM material_ai_page_units WHERE ${dirty?'batch_id=? AND ordinal=?':'rowid>(SELECT cursor FROM material_book_answer_control_v1 WHERE id=1) ORDER BY rowid LIMIT 1'}`,dirty?[String(dirty.batch_id),Number(dirty.ordinal)]:[]))[0];
  if(!slot&&!dirty)return false;
  const batch=String(dirty?.batch_id??slot?.batch_id),ordinal=Number(dirty?.ordinal??slot?.ordinal);
  await this.host.run('DELETE FROM material_book_answer_index_v1 WHERE batch_id=? AND ordinal=? AND start>=0',[batch,ordinal]);
  if(slot?.final_sha){
   // Record publication order even if the saved proof is now invalid; invalid newer output must suppress older answers.
   const owner=(await this.host.all('SELECT b.resource_id,b.version,u.input_json FROM material_ai_batches b JOIN material_ai_units u ON u.batch_id=b.id WHERE b.id=? AND u.ordinal=?',[batch,ordinal]))[0];
   if(owner){let page=0;try{page=JSON.parse(String(owner.input_json)).page;}catch{/* Keep an existing supersession marker. */}if(Number.isSafeInteger(page)&&page>=1&&page<=10000){await this.host.run('INSERT OR REPLACE INTO material_book_answer_index_v1 VALUES(?,?,?,?,?,?,?,?,?)',[batch,ordinal,-1,String(owner.resource_id),String(owner.version),page,Number(slot.seq),'','']);await new MaterialBookAnswerWork(this.host).answerChanged(String(owner.resource_id),String(owner.version));}}
   try{const proof=await this.host.receipt(batch,ordinal),source=proof.unit.pageSource;
    if(proof.unit.bookRole?.kind==='answers'&&validMaterialPageSource(source)){
     // A sentinel for every latest page prevents an older successful transcript surviving a later empty page.
     const entries=bookAnswerPage(proof.first,proof.final).entries;
     await new MaterialBookAnswerWork(this.host).answerChanged(source.resourceId,source.version);
     for(const entry of [{start:-1,sectionKey:'',number:''},...entries])await this.host.run('INSERT OR REPLACE INTO material_book_answer_index_v1 VALUES(?,?,?,?,?,?,?,?,?)',[batch,ordinal,entry.start,source.resourceId,source.version,source.page,Number(slot.seq),entry.sectionKey,entry.number]);
    }
   }catch(error){if(!(error instanceof Error)||!['source_changed','source_incomplete','privacy_blocked'].includes(error.message))throw error;}
  }
  if(dirty)await this.host.run('DELETE FROM material_book_answer_dirty_v1 WHERE batch_id=? AND ordinal=? AND revision=?',[batch,ordinal,Number(dirty.revision)]);
  else await this.host.run('UPDATE material_book_answer_control_v1 SET cursor=? WHERE id=1',[Number(slot.seq)]);
  return true;
 }
 async find(resourceId:string,version:string,section:string,number:string){return this.host.all(`SELECT e.* FROM material_book_answer_index_v1 e WHERE resource_id=? AND version=? AND section_key=? AND number=? AND start>=0 AND NOT EXISTS(SELECT 1 FROM material_book_answer_index_v1 n WHERE n.resource_id=e.resource_id AND n.version=e.version AND n.page=e.page AND n.seq>e.seq) ORDER BY page,start LIMIT 3`,[resourceId,version,section,number]);}
 async rebuild(){await this.host.run('DELETE FROM material_book_answer_index_v1');await this.host.run('UPDATE material_book_answer_control_v1 SET cursor=0 WHERE id=1');}
}
