import {assertClassroomContext} from './classroom-context';
import {validClassroomContext,type ClassroomContext} from '../../shared/classroom-context';
import {createHash,randomUUID} from 'node:crypto';
import type {Sql} from '../xiaozhi-agent/session-state';
import {CLASSROOM_ACTION,CLASSROOM_SCHEMA,validClassroom,type ClassroomDocument,type ClassroomItem,type ClassroomDecision} from '../../shared/classroom';
type Row=Record<string,unknown>;
type Payload={schemaVersion:typeof CLASSROOM_SCHEMA;root:string;callId:string;inputDigest:string;document:ClassroomDocument;context?:ClassroomContext};
type Effect={document:ClassroomDocument;revision:number;previous:string;digest:string};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

/** One entity ledger in existing SQLite confirmations. Candidate and teacher revisions stay traceable. */
export function createClassroomState(sql:Sql){
 async function authorize(work:Sql,sessionId:string,studentId?:string){
  const s=(await work.all('SELECT student_id,archived_at FROM ai_conversation_sessions WHERE id=?',[sessionId]))[0];
  if(!s||s.archived_at||studentId!==undefined&&s.student_id!==studentId)throw new Error('permission_denied');
  if(s.student_id&&!(await work.all("SELECT id FROM students WHERE id=? AND status='active'",[String(s.student_id)]))[0])throw new Error('permission_denied');return String(s.student_id||'');
 }
 function item(row:Row):ClassroomItem{
  const p=JSON.parse(String(row.payload_json)) as Payload;if(p.schemaVersion!==CLASSROOM_SCHEMA||!validClassroom(p.document)||!p.root||p.context!==undefined&&!validClassroomContext(p.context))throw new Error('unavailable');
  const e=row.status==='confirmed'?JSON.parse(String(row.result_json)) as Effect:undefined;
  if(e&&(!validClassroom(e.document)||!Number.isSafeInteger(e.revision)||e.revision<1||e.digest!==hash({id:row.id,sessionId:row.session_id,studentId:row.student_id,document:e.document,revision:e.revision,previous:e.previous})))throw new Error('unavailable');
  if(!['pending','confirmed','rejected'].includes(String(row.status)))throw new Error('unavailable');
  return{id:String(row.id),sessionId:String(row.session_id),studentId:String(row.student_id),runId:String(row.run_id),revision:e?.revision||0,status:row.status as ClassroomItem['status'],updatedAt:String(row.updated_at),document:e?.document||p.document,...(p.context?{context:structuredClone(p.context)}:{}),version:hash({id:row.id,status:row.status,payload:row.payload_json,result:row.result_json})};
 }
 async function get(work:Sql,id:string){const row=(await work.all('SELECT * FROM ai_confirmation_items WHERE id=? AND action_type=?',[id,CLASSROOM_ACTION]))[0];if(!row)throw new Error('permission_denied');await authorize(work,String(row.session_id),String(row.student_id));return row;}
 async function latest(work:Sql,row:Row){const p=JSON.parse(String(row.payload_json)) as Payload;const rows=await work.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at DESC,id DESC',[String(row.session_id),CLASSROOM_ACTION]);if(rows.length>1000)throw new Error('unavailable');return rows.find(r=>(JSON.parse(String(r.payload_json)) as Payload).root===p.root);}
 async function confirmed(work:Sql,sessionId:string,id:string,version:string){const row=await get(work,id),value=item(row);if(value.sessionId!==sessionId)throw Error('permission_denied');if(value.status!=='confirmed'||value.version!==version||(await latest(work,row))?.id!==id)throw Error('conflict');if(value.context)await assertClassroomContext(work,value.context);return value;}
 const transaction=<T>(work:(db:Sql)=>Promise<T>)=>{if(!sql.transaction)throw new Error('unavailable');return sql.transaction(work);};
 return{
  async readConfirmed(sessionId:string,id:string,version:string){return confirmed(sql,sessionId,id,version);},
  async readConfirmedByTitle(sessionId:string,title:string,revision:number){
   if(typeof title!=='string'||!title.trim()||title.length>160||!Number.isSafeInteger(revision)||revision<1)throw Error('invalid_input');
   await authorize(sql,sessionId);const rows=await sql.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=? ORDER BY created_at DESC,id DESC LIMIT 1001',[sessionId,CLASSROOM_ACTION]);if(rows.length>1000)throw Error('unavailable');
   const roots=new Set<string>(),matches:ClassroomItem[]=[];
   for(const row of rows){const root=(JSON.parse(String(row.payload_json)) as Payload).root;if(roots.has(root))continue;roots.add(root);const value=item(row);if(value.status==='confirmed'&&value.document.title===title&&value.revision===revision)matches.push(value);}
   if(matches.length!==1)throw Error('conflict');const value=matches[0];return confirmed(sql,sessionId,value.id,value.version);
  },
  async withConfirmedSource<T>(sessionId:string,id:string,version:string,commit:(item:ClassroomItem)=>T){return transaction(async work=>commit(await confirmed(work,sessionId,id,version)));},
  async stage(sessionId:string,runId:string,callId:string,document:ClassroomDocument,current:()=>boolean,inputDigest=hash(document),context?:ClassroomContext){
   if(!validClassroom(document))throw new Error('invalid_input');return transaction(async work=>{
    const studentId=await authorize(work,sessionId);const run=(await work.all("SELECT id FROM ai_agent_runs WHERE id=? AND session_id=? AND status='running'",[runId,sessionId]))[0];if(!run||!current())throw new Error('cancelled');
    const id='classroom_'+hash({sessionId,runId,callId}).slice(0,36),old=(await work.all('SELECT * FROM ai_confirmation_items WHERE id=?',[id]))[0];
    if(old){const p=JSON.parse(String(old.payload_json)) as Payload;if(p.inputDigest!==inputDigest)throw new Error('conflict');return item(old);}
    if(context)await assertClassroomContext(work,context);
    const stamp=new Date().toISOString(),payload:Payload={schemaVersion:CLASSROOM_SCHEMA,root:id,callId,inputDigest,document,...(context?{context:structuredClone(context)}:{})};
    await work.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,sessionId,studentId,CLASSROOM_ACTION,document.title,JSON.stringify(payload),stamp,stamp]);
    if(!current())throw new Error('cancelled');return item((await work.all('SELECT * FROM ai_confirmation_items WHERE id=?',[id]))[0]);
   });
  },
  async list():Promise<ClassroomItem[]>{const rows=await sql.all(`SELECT c.* FROM ai_confirmation_items c JOIN ai_conversation_sessions s ON s.id=c.session_id LEFT JOIN students t ON t.id=s.student_id WHERE c.action_type=? AND s.archived_at IS NULL AND (s.student_id='' OR s.student_id IS NULL OR t.status='active') ORDER BY c.created_at DESC,c.id DESC LIMIT 1000`,[CLASSROOM_ACTION]);const seen=new Set<string>();return rows.filter(r=>{const root=(JSON.parse(String(r.payload_json)) as Payload).root;if(seen.has(root))return false;seen.add(root);return true;}).slice(0,100).map(item);},
  async read(id:string){return item(await get(sql,id));},
  async decide(input:ClassroomDecision):Promise<ClassroomItem>{
   if(!input||typeof input.id!=='string'||!/^[a-f0-9]{64}$/.test(input.version)||!['confirm','reject'].includes(input.decision)||input.document&&!validClassroom(input.document))throw new Error('invalid_input');
   return transaction(async work=>{
    const row=await get(work,input.id),old=item(row);if(old.version!==input.version||(await latest(work,row))?.id!==row.id||old.status==='rejected')throw new Error('conflict');
    const stamp=new Date().toISOString();if(input.decision==='reject'){if(old.status!=='pending')throw new Error('conflict');await work.run("UPDATE ai_confirmation_items SET status='rejected',rejected_at=?,updated_at=? WHERE id=? AND status='pending'",[stamp,stamp,input.id]);return item(await get(work,input.id));}
    if(old.context)await assertClassroomContext(work,old.context);
    const document=input.document||old.document,revision=old.revision+1,id=old.status==='pending'?old.id:'classroom_'+randomUUID();
    const effect:Effect={document,revision,previous:old.status==='pending'?'':old.id,digest:hash({id,sessionId:old.sessionId,studentId:old.studentId,document,revision,previous:old.status==='pending'?'':old.id})};
    if(old.status==='pending')await work.run("UPDATE ai_confirmation_items SET status='confirmed',result_json=?,confirmed_at=?,updated_at=? WHERE id=? AND status='pending'",[JSON.stringify(effect),stamp,stamp,id]);
    else await work.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,result_json,created_at,updated_at,confirmed_at) VALUES(?,?,?,?,?,'confirmed',?,?,?,?,?,?)`,[id,old.runId,old.sessionId,old.studentId,CLASSROOM_ACTION,document.title,String(row.payload_json),JSON.stringify(effect),stamp,stamp,stamp]);
    return item(await get(work,id));
   });
  }
 };
}
