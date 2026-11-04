import {BOOK_SECTION_LOOKBACK} from './material-book-question-section';
type Row=Record<string,unknown>;
type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,p?:(string|number|null)[])=>Promise<void>};
/** Durable local work, drained by the existing material-AI executor after page publication. */
export class MaterialBookAnswerWork{
 constructor(private host:Host){}
 async migrate(){
  await this.host.run("CREATE TABLE IF NOT EXISTS material_book_answer_work_v1(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,revision INTEGER NOT NULL,error TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,ordinal))");
  // Publication and association changes enqueue in the caller's transaction. Nothing is marked running.
  const select=`SELECT DISTINCT m.batch_id,m.ordinal,p.revision FROM material_ai_members m JOIN material_ai_batches b ON b.id=m.batch_id JOIN material_book_pairs p ON p.question_id=b.resource_id AND p.question_version=b.version AND p.active=1`;
  for(const event of ['INSERT','UPDATE'])await this.host.run(`CREATE TRIGGER IF NOT EXISTS material_book_match_pair_${event.toLowerCase()}_v1 AFTER ${event} ON material_book_pairs WHEN new.active=1 BEGIN INSERT INTO material_book_answer_work_v1(batch_id,ordinal,revision) ${select} WHERE p.question_id=new.question_id AND true ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=excluded.revision,error=''; END`);
  await this.host.run(`CREATE TRIGGER IF NOT EXISTS material_book_match_member_v1 AFTER INSERT ON material_ai_members BEGIN INSERT INTO material_book_answer_work_v1(batch_id,ordinal,revision) ${select} WHERE m.question_id=new.question_id AND true ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=excluded.revision,error=''; END`);
 }
 async answerChanged(resource:string,version:string){
  await this.host.run(`INSERT INTO material_book_answer_work_v1(batch_id,ordinal,revision) SELECT DISTINCT m.batch_id,m.ordinal,p.revision FROM material_book_pairs p JOIN material_ai_batches b ON b.resource_id=p.question_id AND b.version=p.question_version JOIN material_ai_members m ON m.batch_id=b.id WHERE p.active=1 AND p.answer_id=? AND p.answer_version=? AND true ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=excluded.revision,error=''`,[resource,version]);
 }
 async next(){return(await this.host.all(`SELECT w.* FROM material_book_answer_work_v1 w JOIN material_ai_batches b ON b.id=w.batch_id JOIN material_book_pairs p ON p.question_id=b.resource_id AND p.question_version=b.version AND p.active=1 AND p.revision=w.revision WHERE w.error='' ORDER BY w.rowid LIMIT 1`))[0];}
 async questionChanged(resource:string,version:string,page:number){
  // Existing page B-tree bounds the affected window; no per-question whole-book scan.
  await this.host.run(`INSERT INTO material_book_answer_work_v1(batch_id,ordinal,revision) SELECT DISTINCT e.batch_id,e.ordinal,p.revision FROM material_book_answer_index_v1 e JOIN material_book_pairs p ON p.question_id=e.resource_id AND p.question_version=e.version AND p.active=1 JOIN material_ai_members m ON m.batch_id=e.batch_id AND m.ordinal=e.ordinal WHERE e.resource_id=? AND e.version=? AND e.page>=? AND e.page<=? AND e.start=-1 AND NOT EXISTS(SELECT 1 FROM material_book_answer_index_v1 n WHERE n.resource_id=e.resource_id AND n.version=e.version AND n.page=e.page AND n.seq>e.seq) AND true ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=excluded.revision,error=''`,[resource,version,page,Math.min(10000,page+BOOK_SECTION_LOOKBACK)]);
 }
 async state(batch:string,ordinal:number){return(await this.host.all('SELECT revision,error FROM material_book_answer_work_v1 WHERE batch_id=? AND ordinal=?',[batch,ordinal]))[0];}
 async finish(batch:string,ordinal:number,revision:number,error=''){if(error)await this.host.run('UPDATE material_book_answer_work_v1 SET error=? WHERE batch_id=? AND ordinal=? AND revision=?',[error,batch,ordinal,revision]);else await this.host.run('DELETE FROM material_book_answer_work_v1 WHERE batch_id=? AND ordinal=? AND revision=?',[batch,ordinal,revision]);}
}
