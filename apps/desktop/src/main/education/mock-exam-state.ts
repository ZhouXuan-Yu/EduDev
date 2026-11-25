import {randomUUID} from 'node:crypto';
import {MOCK_EXAM_SCHEMA,type MockExamCatalog,type MockExamCatalogChange,type MockExamCatalogSummary,
  mockExamAnswerPermission,mockExamRevision,type MockExamEntry,type MockExamScope,type MockExamHistoryEntry} from '../../shared/mock-exam-compilation';
import {mockExamSelectionIssue} from '../../shared/mock-exam-selection';
import {protocolHash} from '../xiaozhi-agent/capabilities/validation';
import type {Sql} from '../xiaozhi-agent/session-state';
import type {WorkbenchMockExamRow} from '../../shared/xiaozhi-workbench';
import type {MockExamOfficeSource} from '../../shared/mock-exam-export';
import {createTaskState} from '../xiaozhi-agent/tasks/task-state';
import type {HandoutOwner} from './teaching-handout-state';
import {createMockExamArchiveState} from './mock-exam-archive-state';
import {mockExamTitle} from './mock-exam-metadata';
import {assertMockExamSource,mockExamSources} from './mock-exam-sources';

type Row=Record<string,unknown>;
type Snapshot=Omit<MockExamCatalog,'summary'>;
type Verify=(id:string,version:string,signal:AbortSignal)=>Promise<void>;

function summary(row:Row):MockExamCatalogSummary {
  return {schemaVersion:MOCK_EXAM_SCHEMA,id:String(row.id),runId:String(row.run_id),taskId:String(row.task_id),title:String(row.title),
    revision:Number(row.revision),state:row.state as MockExamCatalogSummary['state'],count:Number(row.entry_count),digest:String(row.digest)};
}
const snapshotColumns='c.id,c.run_id,c.task_id,c.title,v.revision,v.state,v.entry_count,v.digest';
const currentJoin='FROM mock_exam_compilations c JOIN mock_exam_compilation_versions v ON v.catalog_id=c.id AND v.revision=c.revision';

/** The workbench projects the current version without loading source documents or duplicate records. */
export async function mockExamWorkbenchRows(sql:Sql,sessionId?:string):Promise<WorkbenchMockExamRow[]> {
  const rows=await sql.all(`SELECT ${snapshotColumns},c.session_id,v.created_at ${currentJoin}
    JOIN ai_conversation_sessions s ON s.id=c.session_id
    WHERE COALESCE(s.student_id,'')='' AND COALESCE(s.archived_at,'')=''${sessionId?' AND c.session_id=?':''}`,sessionId?[sessionId]:[]);
  return rows.map(row=>({...summary(row),sessionId:String(row.session_id),updatedAt:String(row.created_at)}));
}

async function allowed(work:Sql,sessionId:string) {
  const [row]=await work.all(`SELECT id FROM ai_conversation_sessions
    WHERE id=? AND COALESCE(student_id,'')='' AND COALESCE(archived_at,'')=''`,[sessionId]);
  if(!row)throw Error('permission_denied');
}
export async function assertMockExamRun(work:Sql,owner:HandoutOwner) {
  const tasks=createTaskState(work,{sanitize:async value=>value});
  const binding=await tasks.ownerForRun(owner.sessionId,owner.runId);
  const task=await tasks.get(owner.taskId);
  const [run]=await work.all("SELECT status FROM ai_agent_runs WHERE id=? AND session_id=?",[owner.runId,owner.sessionId]);
  if(binding?.taskId!==owner.taskId||binding.generation!==owner.generation||binding.requirementsVersion!==owner.requirementsVersion||
    task?.binding?.runId!==owner.runId||task.requirementsVersion!==owner.requirementsVersion||run?.status!=='running')throw Error('permission_denied');
}
function unpack(row:Row):MockExamCatalog {
  const snapshot=JSON.parse(String(row.image_json)) as Snapshot;
  if(!Array.isArray(snapshot.entries)||!snapshot.scope||protocolHash(snapshot)!==row.digest)throw Error('configuration');
  return {summary:summary(row),...snapshot};
}
function corrected(catalog:MockExamCatalog,changes:MockExamCatalogChange[]):Snapshot {
  const bySource=new Map(changes.map(item=>[item.resourceId,item]));
  if(changes.length!==catalog.entries.length||bySource.size!==changes.length)throw Error('invalid_input');
  const {scope,unlinkedAnswers,limited,pendingCovers}=catalog;
  const entries=catalog.entries.map((item):MockExamEntry=>{
    const change=bySource.get(item.resourceId);
    if(!change)throw Error('invalid_input');
    const {metadata,include,permission}=change;
    const answerPermission=mockExamAnswerPermission(item,change.answerPermission??item.answerPermission);
    if(change.answerPermission&&!answerPermission)throw Error('source_changed');
    const {answerPermission:_priorPermission,...rest}=item;
    const current={...rest,...(answerPermission?{answerPermission}:{})};
    if(!include){
      if(permission==='local_only')return {...current,metadata,include:false,permission:'unknown'};
      return {...current,metadata,include:false,permission};
    }
    if(permission==='excluded')throw Error('invalid_input');
    const inferred={...item.inferred};
    for(const key of Object.keys(metadata) as (keyof MockExamEntry['metadata'])[]){
      if(item.metadata[key]!==metadata[key]||item.conflicts.includes(key))inferred[key]='老师核对';
    }
    return {...current,metadata,inferred,conflicts:[],include,permission};
  });
  const issue=mockExamSelectionIssue(entries,scope);
  if(issue)throw Error(issue.code);
  return {...(catalog.restoredFrom?{restoredFrom:catalog.restoredFrom}:{}),scope,entries,unlinkedAnswers,limited,...(pendingCovers?{pendingCovers}:{})};
}

function restoreSnapshot(target:MockExamCatalog,current:MockExamCatalog):Snapshot {
  const {summary,...snapshot}=target;
  const currentEntries=new Map(current.entries.map(entry=>[entry.resourceId,entry]));
  const entries=snapshot.entries.map(entry=>{
    const latest=currentEntries.get(entry.resourceId);
    const permission=latest?.version===entry.version?latest.permission:'unknown';
    const answerPermission=mockExamAnswerPermission(entry,latest?.answerPermission);
    const {answerPermission:_historicalPermission,...original}=entry;
    return {...original,permission,include:entry.include&&permission!=='excluded',...(answerPermission?{answerPermission}:{})};
  });
  return {...snapshot,entries,restoredFrom:summary.revision};
}

export async function verifyMockExamOriginals(entries:MockExamEntry[],verify:Verify,signal:AbortSignal){
  for(const entry of entries){
    try {
      await verify(entry.resourceId,entry.version,signal);
      if(entry.answer.state==='linked')await verify(entry.answer.resourceId!,entry.answer.version!,signal);
    }catch(error){if(signal.aborted)throw error;throw Error('source_changed');}
  }
}

export function createMockExamState(sql:Sql) {
  const archives=createMockExamArchiveState(sql);
  function write<T>(action:(work:Sql)=>Promise<T>) {
    if(!sql.transaction)throw Error('configuration');
    return sql.transaction(action);
  }
  async function view(work:Sql,sessionId:string,id:string,revision?:number) {
    await allowed(work,sessionId);
    const byRevision='FROM mock_exam_compilations c JOIN mock_exam_compilation_versions v ON v.catalog_id=c.id AND v.revision=?';
    const [row]=await work.all(`SELECT ${snapshotColumns},v.image_json ${revision===undefined?currentJoin:byRevision}
      WHERE c.id=? AND c.session_id=?`,revision===undefined?[id,sessionId]:[revision,id,sessionId]);
    if(!row){
      if(revision!==undefined){
        const [catalog]=await work.all('SELECT id FROM mock_exam_compilations WHERE id=? AND session_id=?',[id,sessionId]);
        if(catalog)throw Error('history_missing');
      }
      throw Error('permission_denied');
    }
    return unpack(row);
  }
  async function append(work:Sql,id:string,revision:number,state:MockExamCatalogSummary['state'],snapshot:Snapshot) {
    const digest=protocolHash(snapshot);
    await work.run(`INSERT INTO mock_exam_compilation_versions(catalog_id,revision,state,entry_count,digest,image_json,created_at)
      VALUES(?,?,?,?,?,?,?)`,[id,revision,state,snapshot.entries.filter(item=>item.include).length,digest,JSON.stringify(snapshot),new Date().toISOString()]);
  }
  async function install(work:Sql,sessionId:string,id:string,priorRevision:number,state:MockExamCatalogSummary['state'],snapshot:Snapshot){
    const revision=priorRevision+1;
    await append(work,id,revision,state,snapshot);
    await work.run('UPDATE mock_exam_compilations SET revision=? WHERE id=? AND revision=?',[revision,id,priorRevision]);
    return view(work,sessionId,id);
  }
  async function confirmed(work:Sql,sessionId:string,source:MockExamOfficeSource){
    const current=await view(work,sessionId,source.catalogId);
    if(current.summary.revision!==source.revision||current.summary.digest!==source.digest)throw Error('version_conflict');
    if(current.summary.state!=='confirmed')throw Error('not_confirmed');
    for(const entry of current.entries.filter(entry=>entry.include))await assertMockExamSource(work,entry);
    return current;
  }
  return {
    archives,
    async migrate() {
      await archives.migrate();
      await sql.run(`CREATE TABLE IF NOT EXISTS mock_exam_compilations (
        id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL UNIQUE REFERENCES ai_agent_runs(id) ON DELETE CASCADE,task_id TEXT NOT NULL,
        generation INTEGER NOT NULL,call_id TEXT NOT NULL,title TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL)`);
      await sql.run('CREATE INDEX IF NOT EXISTS mock_exam_compilation_session ON mock_exam_compilations(session_id,created_at)');
      await sql.run(`CREATE TABLE IF NOT EXISTS mock_exam_compilation_versions (
        catalog_id TEXT NOT NULL REFERENCES mock_exam_compilations(id) ON DELETE CASCADE,revision INTEGER NOT NULL,
        state TEXT NOT NULL,entry_count INTEGER NOT NULL,digest TEXT NOT NULL,image_json TEXT NOT NULL,created_at TEXT NOT NULL,
        PRIMARY KEY(catalog_id,revision))`);
    },
    async list(sessionId:string){
      return (await sql.all('SELECT '+snapshotColumns+' '+currentJoin+' WHERE c.session_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT 100',[sessionId])).map(summary);
    },
    async targets(sessionId:string,taskId:string,title?:string){
      await allowed(sql,sessionId);
      const bucket=async(condition:string,value?:string)=>(await sql.all(`SELECT ${snapshotColumns} ${currentJoin}
        WHERE c.session_id=?${condition} ORDER BY v.created_at DESC,c.id LIMIT 12`,value===undefined?[sessionId]:[sessionId,value])).map(summary);
      if(title!==undefined)return bucket(' AND c.title=?',title);
      const inTask=await bucket(' AND c.task_id=?',taskId);
      return inTask.length?inTask:bucket('');
    },
    readConfirmed:(sessionId:string,source:MockExamOfficeSource)=>confirmed(sql,sessionId,source),
    withConfirmed:<T>(sessionId:string,source:MockExamOfficeSource,action:(catalog:MockExamCatalog,work:Sql)=>T)=>
      write(async work=>action(await confirmed(work,sessionId,source),work)),
    view:(sessionId:string,id:string,revision?:number)=>view(sql,sessionId,id,revision),
    viewWithin:view,
    installDraft:(work:Sql,sessionId:string,id:string,priorRevision:number,snapshot:Snapshot)=>install(work,sessionId,id,priorRevision,'draft',snapshot),
    async history(sessionId:string,id:string):Promise<MockExamHistoryEntry[]> {
      const read=async(work:Sql)=>{
        await view(work,sessionId,id);
        const rows=await work.all(`SELECT revision,state,entry_count,digest,created_at,
          json_extract(image_json,'$.restoredFrom') AS restored_from FROM mock_exam_compilation_versions
          WHERE catalog_id=? ORDER BY revision DESC`,[id]);
        return rows.map(row=>({revision:Number(row.revision),state:row.state as MockExamHistoryEntry['state'],
          count:Number(row.entry_count),digest:String(row.digest),savedAt:String(row.created_at),
          ...(mockExamRevision(row.restored_from)?{restoredFrom:row.restored_from}:{})}));
      };
      return sql.readTransaction?sql.readTransaction(read):read(sql);
    },
    async generate(owner:HandoutOwner,callId:string,scope:MockExamScope,fence:()=>void) {
      fence();
      const sources=await (sql.readTransaction?sql.readTransaction(work=>mockExamSources(work,scope)):mockExamSources(sql,scope));
      fence();
      const snapshot={scope,...sources};
      return write(async work=>{
        fence();
        await allowed(work,owner.sessionId);
        await assertMockExamRun(work,owner);
        const [prior]=await work.all('SELECT id,call_id FROM mock_exam_compilations WHERE run_id=? AND session_id=?',[owner.runId,owner.sessionId]);
        if(prior){
          const previous=await view(work,owner.sessionId,String(prior.id));
          if(prior.call_id!==callId||protocolHash(previous.scope)!==protocolHash(scope))throw Error('version_conflict');
          return previous;
        }
        if(!sources.entries.length)throw Error(sources.pendingCovers?'sources_processing':'no_sources');
        for(const entry of snapshot.entries){fence();await assertMockExamSource(work,entry);}
        const id='mock_catalog_'+randomUUID(),title=mockExamTitle(scope);
        await work.run(`INSERT INTO mock_exam_compilations(id,session_id,run_id,task_id,generation,call_id,title,revision,created_at)
          VALUES(?,?,?,?,?,?,?,1,?)`,[id,owner.sessionId,owner.runId,owner.taskId,owner.generation,callId,title,new Date().toISOString()]);
        await append(work,id,1,'draft',snapshot);
        fence();
        return view(work,owner.sessionId,id);
      });
    },
    async confirm(sessionId:string,id:string,expectedRevision:number,digest:string,changes:MockExamCatalogChange[],verify:Verify) {
      const initial=await view(sql,sessionId,id);
      if(initial.summary.revision!==expectedRevision||initial.summary.digest!==digest)throw Error('version_conflict');
      const next=corrected(initial,changes), included=next.entries.filter(item=>item.include);
      const signal=AbortSignal.timeout(80_000);
      await verifyMockExamOriginals(included,verify,signal);
      return write(async work=>{
        const current=await view(work,sessionId,id);
        if(current.summary.digest!==digest||current.summary.revision!==initial.summary.revision)throw Error('version_conflict');
        for(const entry of included)await assertMockExamSource(work,entry);
        signal.throwIfAborted();
        if(current.summary.state==='confirmed'&&protocolHash(next)===digest)return current;
        return install(work,sessionId,id,current.summary.revision,'confirmed',next);
      });
    },
    async restore(sessionId:string,id:string,expectedRevision:number,digest:string,sourceRevision:number,sourceDigest:string,verify:Verify) {
      const initial=await view(sql,sessionId,id);
      if(initial.summary.revision!==expectedRevision||initial.summary.digest!==digest)throw Error('version_conflict');
      const source=await view(sql,sessionId,id,sourceRevision);
      if(source.summary.digest!==sourceDigest)throw Error('version_conflict');
      const snapshot=restoreSnapshot(source,initial),included=snapshot.entries.filter(entry=>entry.include);
      const signal=AbortSignal.timeout(80_000);
      await verifyMockExamOriginals(included,verify,signal);
      return write(async work=>{
        const current=await view(work,sessionId,id);
        if(current.summary.digest!==digest||current.summary.revision!==expectedRevision)throw Error('version_conflict');
        for(const entry of included)await assertMockExamSource(work,entry);
        signal.throwIfAborted();
        return install(work,sessionId,id,expectedRevision,'draft',snapshot);
      });
    },
  };
}

export async function readMockExamEffect(sql:Sql,owner:Pick<HandoutOwner,'sessionId'|'runId'|'generation'>,callId:string){
  const [row]=await sql.all(`SELECT v.image_json,v.digest FROM mock_exam_compilations c
    JOIN mock_exam_compilation_versions v ON v.catalog_id=c.id AND v.revision=1
    WHERE c.session_id=? AND c.run_id=? AND c.generation=? AND c.call_id=?`,
  [owner.sessionId,owner.runId,owner.generation,callId]);
  return row&&protocolHash(JSON.parse(String(row.image_json)))===row.digest?'matched' as const:'uncertain' as const;
}
