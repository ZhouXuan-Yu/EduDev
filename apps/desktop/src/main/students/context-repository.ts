import {createHash} from 'node:crypto';
import type {Student,LearningRecord} from '../../shared/contracts';
import {STUDENT_CONTEXT_PAGE_SIZE,validStudentId,type StudentContextQuery} from '../../shared/student-context';
import {LEARNING_MAX_RECORDS,LEARNING_MAX_BYTES,validLearningQuery,type LearningQuery} from '../../shared/student-learning';
type Row=Record<string,unknown>;
type Host={all:(sql:string,params?:(string|number|null)[])=>Promise<Row[]>;mapStudent:(row:Row)=>Student;mapRecord:(row:Row)=>LearningRecord};
const version=(row:Row)=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
export class StudentContextRepository{
 private readonly host:Host;
 constructor(host:Host){this.host=host;}
 /** Whole explicit-evidence history from one consistent statement, never UI pagination. */
 async learningSnapshot(studentId:string,query:LearningQuery={}){
  if(!validStudentId(studentId))throw new Error('student_unavailable');
  if(!validLearningQuery(query))throw new Error('invalid_input');
  const subject=query.subject?.trim(),params:(string|number)[]=[studentId];
  if(subject)params.push(subject);
  const rows=await this.host.all(`WITH matching AS (SELECT * FROM learning_records WHERE student_id=?${subject?' AND subject=?':''}),
   totals AS (SELECT COUNT(*) AS count,COALESCE(SUM(length(CAST(COALESCE(content,'')||COALESCE(summary,'')||COALESCE(title,'')||COALESCE(tags,'')||COALESCE(subject,'')||COALESCE(record_type,'')||COALESCE(occurred_at,'')||COALESCE(created_at,'')||COALESCE(updated_at,'')||id AS BLOB))),0) AS bytes FROM matching),
   ordered AS (SELECT * FROM matching ORDER BY occurred_at DESC,created_at DESC,id DESC LIMIT ${LEARNING_MAX_RECORDS})
   SELECT s.*,(SELECT count FROM totals) AS matching_count,(SELECT COUNT(*) FROM learning_records WHERE student_id=s.id) AS record_count,0 AS attachment_bytes,
    (SELECT bytes FROM totals) AS total_bytes,
    CASE WHEN (SELECT count FROM totals)<=${LEARNING_MAX_RECORDS} AND (SELECT bytes FROM totals)<=${LEARNING_MAX_BYTES}
    THEN (SELECT json_group_array(json_object('record_type',record_type,'subject',subject,'title',title,'content',content,'summary',summary,'tags',tags,'occurred_at',occurred_at,'created_at',created_at,'updated_at',updated_at,'id',id)) FROM ordered) ELSE NULL END AS records_json
   FROM students s WHERE s.id=?`,[...params,studentId]);
  if(!rows.length)throw new Error('student_unavailable');
  const row=rows[0],profile={...row};for(const key of ['matching_count','total_bytes','records_json'])delete profile[key];
  const student=this.host.mapStudent(profile);if(student.status!=='active')throw new Error('student_unavailable');
  if(Number(row.matching_count)>LEARNING_MAX_RECORDS||Number(row.total_bytes)>LEARNING_MAX_BYTES||typeof row.records_json!=='string'||Buffer.byteLength(row.records_json,'utf8')>LEARNING_MAX_BYTES)throw new Error('too_large');
  const rawRecords:Row[]=JSON.parse(row.records_json);
  const records=rawRecords.map(raw=>{const fact={student_id:studentId,...raw};const {attachments:_attachments,...record}=this.host.mapRecord(fact);return{record,version:version(fact)};});
  if(records.length!==Number(row.matching_count))throw new Error('unavailable');
  return{student,profileVersion:version(profile),records,total:records.length,totalRecords:student.recordCount,subject:subject||null,fingerprint:version({profile,subject:subject||null,rawRecords})};
 }
 async snapshot(studentId:string,query:StudentContextQuery={},recordId?:string){
  if(!validStudentId(studentId))throw new Error('student_unavailable');
  const clauses=['student_id=?'],params:(string|number)[]=[studentId];
  if(recordId){clauses.push('id=?');params.push(recordId);}
  for(const [key,column]of [['type','record_type'],['subject','subject']]as const)if(query[key]){clauses.push(`${column}=?`);params.push(query[key]!.trim());}
  if(query.keyword){clauses.push("instr(lower(COALESCE(title,'')||' '||COALESCE(content,'')||' '||COALESCE(summary,'')),lower(?))>0");params.push(query.keyword.trim());}
  // One statement snapshots the profile, full matching count, and selected page.
  const rows=await this.host.all(`WITH matching AS (SELECT * FROM learning_records WHERE ${clauses.join(' AND ')}),
   page AS (SELECT * FROM matching ORDER BY occurred_at DESC,created_at DESC,id DESC LIMIT ? OFFSET ?)
   SELECT s.*, (SELECT COUNT(*) FROM matching) AS matching_count,(SELECT COUNT(*) FROM learning_records WHERE student_id=s.id) AS record_count,
    0 AS attachment_bytes,r.id AS context_record_id,r.record_type AS context_record_type,r.subject AS context_subject,r.title AS context_title,
    r.content AS context_content,r.summary AS context_summary,r.tags AS context_tags,r.occurred_at AS context_occurred_at,r.created_at AS context_created_at,r.updated_at AS context_updated_at
   FROM students s LEFT JOIN page r ON r.student_id=s.id WHERE s.id=? ORDER BY r.occurred_at DESC,r.created_at DESC,r.id DESC`,[...params,STUDENT_CONTEXT_PAGE_SIZE,query.offset||0,studentId]);
  if(!rows.length)throw new Error('student_unavailable');
  const profile={...rows[0]};for(const key of Object.keys(profile))if(key.startsWith('context_')||key==='matching_count')delete profile[key];
  const student=this.host.mapStudent(profile);if(student.status!=='active')throw new Error('student_unavailable');
  const records=rows.filter(row=>row.context_record_id).map(row=>{
   const raw:Row={student_id:studentId};for(const [key,value]of Object.entries(row))if(key.startsWith('context_'))raw[key.slice(8)]=value;
   raw.id=raw.record_id;delete raw.record_id;
   const {attachments:_attachments,...record}=this.host.mapRecord(raw);return {record,version:version(raw)};
  });
  const total=Number(rows[0].matching_count);if((query.offset||0)>0&&(query.offset||0)>=total)throw new Error('invalid_input');
  return {student,profileVersion:version(profile),records,total,totalRecords:student.recordCount,offset:query.offset||0,
   nextOffset:(query.offset||0)+records.length<total?(query.offset||0)+records.length:null,fingerprint:version({rows})};
 }
}
