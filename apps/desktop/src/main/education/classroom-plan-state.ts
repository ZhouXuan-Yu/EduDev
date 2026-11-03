import {createHash,randomUUID} from 'node:crypto';
import type {Sql} from '../xiaozhi-agent/session-state';
import {CLASSROOM_PLAN_ACTION,CLASSROOM_PLAN_SCHEMA,validClassroomPlanDocument,validClassroomPlanSource,validClassroomPlanEdit,validClassroomPlanDecision,type ClassroomPlanDocument,type ClassroomPlanItem,type ClassroomPlanBinding,type ClassroomPlanSource,type ClassroomPlanEdit,type ClassroomPlanDecision,type ClassroomCheckpoint} from '../../shared/classroom-plan';
import {validClassroom,validClassroomScene,CLASSROOM_ACTION,CLASSROOM_SCHEMA,type ClassroomDocument} from '../../shared/classroom';
import {validClassroomContext,type ClassroomContext} from '../../shared/classroom-context';
import type {Scene} from '@openmaic/dsl';
import {assertClassroomContext} from './classroom-context';
import {assertTeachingLessonContext} from './teaching-lesson-context';
import {teachingLessonIssues} from '../../shared/teaching-lesson';

type Row=Record<string,unknown>;
type Payload={schemaVersion:typeof CLASSROOM_PLAN_SCHEMA;root:string;revision:number;previous:string;callId:string;inputDigest:string;document:ClassroomPlanDocument;context:ClassroomContext};
type Effect={state:ClassroomPlanItem['status'];checkpoints:ClassroomCheckpoint[];activeRunId?:string;classroomId?:string};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const payload=(row:Row)=>JSON.parse(String(row.payload_json)) as Payload;
function item(row:Row):ClassroomPlanItem{
 const p=payload(row),e=JSON.parse(String(row.result_json)) as Effect;
 if(p.schemaVersion!==CLASSROOM_PLAN_SCHEMA||!validClassroomPlanDocument(p.document)||!validClassroomContext(p.context)||!p.context.materials.length&&!p.document.lesson||!Number.isSafeInteger(p.revision)||p.revision<1||!['draft','confirmed','generating','interrupted','ready','rejected'].includes(e.state)||!Array.isArray(e.checkpoints))throw Error('unavailable');
 if(e.checkpoints.length>p.document.scenes.length||new Set(e.checkpoints.map(c=>c.sceneId)).size!==e.checkpoints.length||e.checkpoints.some(c=>!validClassroomScene(c.scene)||c.scene.id!==c.sceneId||!p.document.scenes.some(s=>s.sceneId===c.sceneId&&s.type===c.scene.type&&s.title===c.scene.title)||!/^[a-f0-9]{64}$/.test(c.inputDigest)))throw Error('unavailable');
 return{id:String(row.id),sessionId:String(row.session_id),runId:e.activeRunId||String(row.run_id),revision:p.revision,version:hash({id:row.id,sessionId:row.session_id,studentId:row.student_id,payload:p}),updatedAt:String(row.updated_at),document:structuredClone(p.document),context:structuredClone(p.context),status:e.state,checkpoints:structuredClone(e.checkpoints),...(e.classroomId?{classroomId:e.classroomId}:{})};
}
async function authorize(sql:Sql,sessionId:string,studentId?:string){
 const session=(await sql.all('SELECT student_id,archived_at FROM ai_conversation_sessions WHERE id=?',[sessionId]))[0];
 if(!session||session.archived_at||studentId!==undefined&&String(session.student_id||'')!==studentId)throw Error('permission_denied');
 if(session.student_id&&!(await sql.all("SELECT id FROM students WHERE id=? AND status='active'",[String(session.student_id)]))[0])throw Error('permission_denied');
 return String(session.student_id||'');
}
async function currentRow(sql:Sql,id:string){
 const row=(await sql.all('SELECT * FROM ai_confirmation_items WHERE id=? AND action_type=?',[id,CLASSROOM_PLAN_ACTION]))[0];
 if(!row)throw Error('permission_denied');await authorize(sql,String(row.session_id),String(row.student_id||''));
 const p=payload(row),rows=await sql.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=?',[String(row.session_id),CLASSROOM_PLAN_ACTION]);
 if(rows.length>1000)throw Error('unavailable');
 if(rows.some(r=>payload(r).root===p.root&&payload(r).revision>p.revision))throw Error('conflict');
 return row;
}
/** Called by final classroom confirmation and the existing Office source guards. */
export async function assertClassroomPlanSource(sql:Sql,source:ClassroomPlanSource,classroomId:string){
 if(!validClassroomPlanSource(source))throw Error('invalid_input');
 const value=item(await currentRow(sql,source.id));
 if(value.version!==source.version||value.status!=='ready'||value.classroomId!==classroomId)throw Error('conflict');
 await assertClassroomContext(sql,value.context);
}
/** Legacy v1 remains readable, but cannot bypass a live outline in the same session. */
export async function assertLegacyClassroomAllowed(sql:Sql,sessionId:string){
 const rows=await sql.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=?',[sessionId,CLASSROOM_PLAN_ACTION]);
 if(rows.some(r=>item(r).status!=='rejected'))throw Error('not_confirmed');
}

export function createClassroomPlanState(sql:Sql){
 const transaction=<T>(work:(db:Sql)=>Promise<T>)=>{if(!sql.transaction)throw Error('unavailable');return sql.transaction(work);};
 async function save(work:Sql,row:Row,e:Effect,status?:string){
  await work.run('UPDATE ai_confirmation_items SET result_json=?,status=?,updated_at=? WHERE id=? AND payload_json=? AND result_json=?',[JSON.stringify(e),status??String(row.status),new Date().toISOString(),String(row.id),String(row.payload_json),String(row.result_json)]);
  const fresh=(await work.all('SELECT * FROM ai_confirmation_items WHERE id=?',[String(row.id)]))[0];
  if(!fresh||String(fresh.result_json)!==JSON.stringify(e))throw Error('conflict');return item(fresh);
 }
 async function bound(work:Sql,sessionId:string,runId:string,binding:ClassroomPlanBinding,current:()=>boolean){
  if(!validClassroomPlanSource({id:binding?.id,version:binding?.version}))throw Error('invalid_input');
  const row=await currentRow(work,binding.id),value=item(row),e=JSON.parse(String(row.result_json)) as Effect;
  if(value.sessionId!==sessionId)throw Error('permission_denied');
  if(value.version!==binding.version||e.activeRunId!==runId||!['generating','ready'].includes(value.status))throw Error('conflict');
  const run=(await work.all("SELECT id FROM ai_agent_runs WHERE id=? AND session_id=? AND status='running'",[runId,sessionId]))[0];
  if(!run||!current())throw Error('cancelled');await assertClassroomContext(work,value.context);return{row,value,e};
 }
 const state={
  async assertOutlineRun(sessionId:string,runId:string,current:()=>boolean){
   await authorize(sql,sessionId);
   const run=(await sql.all("SELECT id FROM ai_agent_runs WHERE id=? AND session_id=? AND status='running'",[runId,sessionId]))[0];
   if(!run||!current())throw Error('cancelled');
  },
  async propose(sessionId:string,runId:string,callId:string,document:ClassroomPlanDocument,context:ClassroomContext,current:()=>boolean){
   if(!validClassroomPlanDocument(document)||!validClassroomContext(context))throw Error('invalid_input');
   if(!context.materials.length&&!document.lesson)throw Error('source_required');
   return transaction(async work=>{
    const studentId=await authorize(work,sessionId),run=(await work.all("SELECT id FROM ai_agent_runs WHERE id=? AND session_id=? AND status='running'",[runId,sessionId]))[0];
    if(!run||!current())throw Error('cancelled');await assertClassroomContext(work,context);await assertTeachingLessonContext(work,document,context);
    const id='classplan_'+hash({sessionId,runId,callId}).slice(0,36),inputDigest=hash({document,context}),old=(await work.all('SELECT * FROM ai_confirmation_items WHERE id=?',[id]))[0];
    if(old){if(payload(old).inputDigest!==inputDigest)throw Error('conflict');return item(await currentRow(work,id));}
    const p:Payload={schemaVersion:CLASSROOM_PLAN_SCHEMA,root:id,revision:1,previous:'',callId,inputDigest,document:structuredClone(document),context:structuredClone(context)},stamp=new Date().toISOString();
    await work.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?,?)`,[id,runId,sessionId,studentId,CLASSROOM_PLAN_ACTION,document.title,JSON.stringify(p),JSON.stringify({state:'draft',checkpoints:[]}),stamp,stamp]);
    if(!current())throw Error('cancelled');return item((await work.all('SELECT * FROM ai_confirmation_items WHERE id=?',[id]))[0]);
   });
  },
  async read(id:string){return item(await currentRow(sql,id));},
  async history(id:string){
   const latest=await currentRow(sql,id),root=payload(latest).root;
   const rows=await sql.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type=?',[String(latest.session_id),CLASSROOM_PLAN_ACTION]);
   if(rows.length>1000)throw Error('unavailable');
   return rows.filter(r=>payload(r).root===root).sort((a,b)=>payload(b).revision-payload(a).revision).map(item);
  },
  async list(){
   const rows=await sql.all(`SELECT c.* FROM ai_confirmation_items c JOIN ai_conversation_sessions s ON s.id=c.session_id LEFT JOIN students t ON t.id=s.student_id WHERE c.action_type=? AND s.archived_at IS NULL AND (s.student_id='' OR s.student_id IS NULL OR t.status='active') ORDER BY c.created_at DESC,c.id DESC LIMIT 1001`,[CLASSROOM_PLAN_ACTION]);
   if(rows.length>1000)throw Error('unavailable');const latest=new Map<string,Row>();
   for(const row of rows){const p=payload(row),old=latest.get(p.root);if(!old||payload(old).revision<p.revision)latest.set(p.root,row);}
   return [...latest.values()].slice(0,100).map(item);
  },
  async edit(input:ClassroomPlanEdit){
   if(!validClassroomPlanEdit(input))throw Error('invalid_input');return transaction(async work=>{
    const row=await currentRow(work,input.id),value=item(row);if(value.version!==input.version||['generating','rejected'].includes(value.status))throw Error('conflict');
    if(value.document.scenes.map(s=>s.sceneId+':'+s.type).join()!==input.document.scenes.map(s=>s.sceneId+':'+s.type).join())throw Error('invalid_input');
    if(Boolean(value.document.lesson)!==Boolean(input.document.lesson))throw Error('invalid_input');
    await assertClassroomContext(work,value.context);await assertTeachingLessonContext(work,input.document,value.context);if(JSON.stringify(input.document)===JSON.stringify(value.document))return value;
    const id='classplan_'+randomUUID(),p:Payload={...payload(row),revision:value.revision+1,previous:value.id,document:structuredClone(input.document)},stamp=new Date().toISOString();
    await work.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,result_json,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?,?)`,[id,String(row.run_id),value.sessionId,String(row.student_id||''),CLASSROOM_PLAN_ACTION,input.document.title,JSON.stringify(p),JSON.stringify({state:'draft',checkpoints:[]}),stamp,stamp]);
    return item((await work.all('SELECT * FROM ai_confirmation_items WHERE id=?',[id]))[0]);
   });
  },
  async decide(input:ClassroomPlanDecision){
   if(!validClassroomPlanDecision(input))throw Error('invalid_input');return transaction(async work=>{
    const row=await currentRow(work,input.id),value=item(row);if(value.version!==input.version||!['draft','confirmed'].includes(value.status))throw Error('conflict');
    if(input.decision==='confirm'){if(teachingLessonIssues(value.document).length)throw Error('invalid_input');await assertClassroomContext(work,value.context);await assertTeachingLessonContext(work,value.document,value.context);}
    const next=await save(work,row,{state:input.decision==='confirm'?'confirmed':'rejected',checkpoints:[]},input.decision==='confirm'?'confirmed':'rejected');
    await work.run(input.decision==='confirm'?'UPDATE ai_confirmation_items SET confirmed_at=? WHERE id=?':'UPDATE ai_confirmation_items SET rejected_at=? WHERE id=?',[new Date().toISOString(),input.id]);return next;
   });
  },
  async assertStart(sessionId:string,binding:ClassroomPlanBinding){
   const value=item(await currentRow(sql,binding.id));if(value.sessionId!==sessionId)throw Error('permission_denied');if(value.document.lesson)throw Error('invalid_input');if(value.version!==binding.version)throw Error('conflict');if(!['confirmed','interrupted'].includes(value.status))throw Error('not_confirmed');await assertClassroomContext(sql,value.context);return value;
  },
  async begin(sessionId:string,runId:string,binding:ClassroomPlanBinding,current:()=>boolean){
   return transaction(async work=>{
    const row=await currentRow(work,binding.id),value=item(row);if(value.sessionId!==sessionId)throw Error('permission_denied');if(value.document.lesson)throw Error('invalid_input');if(value.version!==binding.version)throw Error('conflict');if(!['confirmed','interrupted'].includes(value.status))throw Error('not_confirmed');
    if(!(await work.all("SELECT id FROM ai_agent_runs WHERE id=? AND session_id=? AND status='running'",[runId,sessionId]))[0]||!current())throw Error('cancelled');await assertClassroomContext(work,value.context);
    const next=await save(work,row,{state:'generating',checkpoints:value.checkpoints,activeRunId:runId});if(!current())throw Error('cancelled');return next;
   });
  },
  async readForRun(sessionId:string,runId:string,binding:ClassroomPlanBinding,current:()=>boolean){return (await bound(sql,sessionId,runId,binding,current)).value;},
  async checkpoint(sessionId:string,runId:string,binding:ClassroomPlanBinding,sceneId:string,scene:Scene,current:()=>boolean,inputDigest=hash(scene)){
   if(!validClassroomScene(scene)||scene.id!==sceneId||!/^[a-f0-9]{64}$/.test(inputDigest))throw Error('invalid_input');
   return transaction(async work=>{
    const {row,value,e}=await bound(work,sessionId,runId,binding,current),spec=value.document.scenes.find(s=>s.sceneId===sceneId);
    if(!spec||spec.type!==scene.type||spec.title!==scene.title)throw Error('invalid_input');
    const old=e.checkpoints.find(c=>c.sceneId===sceneId);if(old){if(old.inputDigest!==inputDigest)throw Error('conflict');return value;}
    if(e.state!=='generating')throw Error('conflict');e.checkpoints.push({sceneId,scene:structuredClone(scene),runId,inputDigest});
    if(JSON.stringify({schemaVersion:CLASSROOM_SCHEMA,title:value.document.title,scenes:e.checkpoints.map(c=>c.scene),origin:'ai_generated',answerVerified:false}).length>250000)throw Error('invalid_input');
    const saved=await save(work,row,e);if(!current())throw Error('cancelled');return saved;
   });
  },
  async complete(sessionId:string,runId:string,binding:ClassroomPlanBinding,current:()=>boolean){
   return transaction(async work=>{
    const {row,value,e}=await bound(work,sessionId,runId,binding,current);if(e.state==='ready')return value;
    if(e.checkpoints.length!==value.document.scenes.length)throw Error('incomplete');
    const document:ClassroomDocument={schemaVersion:CLASSROOM_SCHEMA,title:value.document.title,scenes:value.document.scenes.map(s=>e.checkpoints.find(c=>c.sceneId===s.sceneId)!.scene),origin:'ai_generated',answerVerified:false};
    if(!validClassroom(document))throw Error('invalid_input');
    const id='classroom_'+hash({planId:value.id,version:value.version}).slice(0,36),stamp=new Date().toISOString(),source={id:value.id,version:value.version};
    const p={schemaVersion:CLASSROOM_SCHEMA,root:id,callId:'classroom-plan:'+value.id,inputDigest:hash(document),document,context:value.context,plan:source};
    await work.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?)`,[id,runId,sessionId,String(row.student_id||''),CLASSROOM_ACTION,document.title,JSON.stringify(p),stamp,stamp]);
    const ready=await save(work,row,{...e,state:'ready',classroomId:id});if(!current())throw Error('cancelled');return ready;
   });
  },
  async finishRun(runId:string){return transaction(async work=>{
   const rows=await work.all('SELECT * FROM ai_confirmation_items WHERE action_type=?',[CLASSROOM_PLAN_ACTION]);
   for(const row of rows){const e=JSON.parse(String(row.result_json)) as Effect;if(e.state==='generating'&&e.activeRunId===runId)await save(work,row,{...e,state:'interrupted'});}
  });},
  async recover(){return transaction(async work=>{
   const rows=await work.all('SELECT * FROM ai_confirmation_items WHERE action_type=?',[CLASSROOM_PLAN_ACTION]);
   for(const row of rows){const e=JSON.parse(String(row.result_json)) as Effect;if(e.state==='generating')await save(work,row,{...e,state:'interrupted'});}
  });}
 };
 return state;
}
