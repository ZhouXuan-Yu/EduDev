export const taskSummaryPrefix = 'xiaozhi_task_summary_';
export const taskPrefix = 'xiaozhi.task.v1:';
export const taskDocumentPrefix = taskPrefix + 'xitask_';
const taskKeyLength = taskDocumentPrefix.length + 64;
const table = taskSummaryPrefix + 'rows';
const control = taskSummaryPrefix + 'control';
const dirty = taskSummaryPrefix + 'dirty';
const sessions = taskSummaryPrefix + 'dirty_sessions';
const failures = taskSummaryPrefix + 'failures';
const owners = taskSummaryPrefix + 'owners';
const dependencies = taskSummaryPrefix + 'dependencies';

const schemas = {
  [control]: `CREATE TABLE IF NOT EXISTS ${control}(
    id INTEGER PRIMARY KEY CHECK(id=1), epoch TEXT NOT NULL, generation INTEGER NOT NULL,
    phase TEXT NOT NULL CHECK(phase IN ('rebuilding','ready')), cursor TEXT NOT NULL,
    projected_rows INTEGER NOT NULL CHECK(projected_rows>=0));`,
  [table]: `CREATE TABLE IF NOT EXISTS ${table}(
    task_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL, state TEXT NOT NULL, task_group TEXT NOT NULL,
    resumable INTEGER NOT NULL CHECK(resumable IN(0,1)), blocked INTEGER NOT NULL CHECK(blocked IN(0,1)),
    row_json TEXT NOT NULL CHECK(json_valid(row_json))); `,
  [dirty]: `CREATE TABLE IF NOT EXISTS ${dirty}(task_id TEXT PRIMARY KEY);`,
  [sessions]: `CREATE TABLE IF NOT EXISTS ${sessions}(session_id TEXT PRIMARY KEY,after_task TEXT NOT NULL DEFAULT '');`,
  [owners]: `CREATE TABLE IF NOT EXISTS ${owners}(task_id TEXT PRIMARY KEY,session_id TEXT NOT NULL);`,
  [dependencies]: `CREATE TABLE IF NOT EXISTS ${dependencies}(
    task_id TEXT NOT NULL,kind TEXT NOT NULL,ref TEXT NOT NULL,PRIMARY KEY(task_id,kind,ref));`,
  [failures]: `CREATE TABLE IF NOT EXISTS ${failures}(
    task_id TEXT NOT NULL, source TEXT NOT NULL, code TEXT NOT NULL, records INTEGER, PRIMARY KEY(task_id,source,code));`,
};

const indexes = {
  [taskSummaryPrefix+'ordered']: `CREATE INDEX IF NOT EXISTS ${taskSummaryPrefix}ordered ON ${table}(updated_at DESC,task_id ASC);`,
  [taskSummaryPrefix+'by_session']: `CREATE INDEX IF NOT EXISTS ${taskSummaryPrefix}by_session ON ${table}(session_id,updated_at DESC,task_id ASC);`,
  [taskSummaryPrefix+'session_task']: `CREATE INDEX IF NOT EXISTS ${taskSummaryPrefix}session_task ON ${owners}(session_id,task_id);`,
  [taskSummaryPrefix+'dependency_ref']: `CREATE INDEX IF NOT EXISTS ${taskSummaryPrefix}dependency_ref ON ${dependencies}(kind,ref);`,
  [taskSummaryPrefix+'by_state']: `CREATE INDEX IF NOT EXISTS ${taskSummaryPrefix}by_state ON ${table}(state,updated_at DESC,task_id ASC);`,
  [taskSummaryPrefix+'approval_owner']: `CREATE INDEX IF NOT EXISTS ${taskSummaryPrefix}approval_owner ON ai_confirmation_items(session_id,action_type);`,
};

const isTaskKey = (ref: string) => `${ref}.key GLOB '${taskDocumentPrefix}*' AND
  (length(${ref}.key)=${taskKeyLength} OR substr(${ref}.key,${taskKeyLength+1},10)=':revision:')`;
const isLatest = (ref: string) => `${ref}.key GLOB '${taskPrefix}session:*'`;
const approval = (ref: string) => `${ref}.action_type IN ('xiaozhi_permission_v2','pi_office_copy')`;
const changed = `UPDATE ${control} SET generation=generation+1 WHERE id=1;`;

const taskOutbox = (ref: string) => `INSERT INTO ${dirty}(task_id)
  SELECT substr(${ref}.key,${taskPrefix.length+1},71) WHERE ${isTaskKey(ref)} ON CONFLICT(task_id) DO NOTHING;
  INSERT INTO ${sessions}(session_id) SELECT substr(${ref}.key,${taskPrefix.length+'session:'.length+1})
  WHERE ${isLatest(ref)} ON CONFLICT(session_id) DO UPDATE SET after_task='';
  INSERT INTO ${sessions}(session_id)
  SELECT o.session_id FROM ${owners} o JOIN app_settings a ON a.key='${taskPrefix}session:' || o.session_id
  WHERE length(${ref}.key)=${taskKeyLength} AND ${isTaskKey(ref)}
    AND o.task_id=substr(${ref}.key,${taskPrefix.length+1},71)
    AND CASE WHEN json_valid(a.value_json) THEN json_extract(a.value_json,'$.taskId')=o.task_id ELSE 0 END
  ON CONFLICT(session_id) DO UPDATE SET after_task='';`;
const effectOutbox = (ref: string) => `INSERT INTO ${dirty}(task_id)
  SELECT ${ref}.task_id WHERE ${ref}.task_id GLOB 'xitask_*' ON CONFLICT(task_id) DO NOTHING;`;
const approvalOutbox = (ref: string) => `INSERT INTO ${sessions}(session_id)
  SELECT ${ref}.session_id WHERE ${approval(ref)}
  ON CONFLICT(session_id) DO UPDATE SET after_task='';`;
const sessionOutbox = (ref: string) => `INSERT INTO ${sessions}(session_id) VALUES(${ref}.id)
  ON CONFLICT(session_id) DO UPDATE SET after_task='';`;
const dependencyOutbox=(kind:string,ref:string)=>`INSERT INTO ${sessions}(session_id)
  SELECT o.session_id FROM ${dependencies} d JOIN ${owners} o ON o.task_id=d.task_id
  WHERE d.kind='${kind}' AND d.ref=${ref} ON CONFLICT(session_id) DO UPDATE SET after_task='';`;
const actionPrefix=taskPrefix+'action:';
const dependencyActive=(kind:string,ref:string)=>`EXISTS(SELECT 1 FROM ${dependencies} WHERE kind='${kind}' AND ref=${ref})`;

const triggers: Record<string,string> = {};
for(const [event, refs] of [
  ['INSERT',['new']], ['UPDATE',['old','new']], ['DELETE',['old']],
] as const){
  const update=event==='UPDATE';
  const trigger=(name:string,source:string,eventSql:string,when:string,body:string)=>{
    const id=taskSummaryPrefix+name+'_'+event.toLowerCase();
    triggers[id]=`CREATE TRIGGER IF NOT EXISTS ${id} AFTER ${eventSql} ON ${source} WHEN ${when} BEGIN ${changed} ${body} END;`;
  };
  const any=(predicate:(ref:string)=>string)=>refs.map(ref=>'('+predicate(ref)+')').join(' OR ');
  trigger('task','app_settings',event,
    `(${any(ref=>isTaskKey(ref)+' OR '+isLatest(ref))})${update?' AND (old.key IS NOT new.key OR old.value_json IS NOT new.value_json)':''}`,
    refs.map(taskOutbox).join(' '));
  const actionId=(ref:string)=>`substr(${ref}.key,${actionPrefix.length+1})`;
  trigger('teacher_action','app_settings',event,any(ref=>`${ref}.key GLOB '${actionPrefix}*'
    AND ${dependencyActive('action',actionId(ref))}`),refs.map(ref=>dependencyOutbox('action',actionId(ref))).join(' '));
  trigger('message','ai_conversation_messages',update?'UPDATE OF id,role,session_id,content,metadata_json':event,
    any(ref=>dependencyActive('message',ref+'.id')),refs.map(ref=>dependencyOutbox('message',ref+'.id')).join(' '));
  trigger('run','ai_agent_runs',update?'UPDATE OF id,session_id,status':event,
    any(ref=>dependencyActive('run',ref+'.id')),refs.map(ref=>dependencyOutbox('run',ref+'.id')).join(' '));
  trigger('approval','ai_confirmation_items',event,any(approval),refs.map(approvalOutbox).join(' '));
  trigger('effect','xiaozhi_effects_v1',event,any(ref=>`${ref}.task_id GLOB 'xitask_*'`),refs.map(effectOutbox).join(' '));
  trigger('session','ai_conversation_sessions',update?'UPDATE OF id,title,archived_at':event,
    update?'old.id IS NOT new.id OR old.title IS NOT new.title OR old.archived_at IS NOT new.archived_at':'1',
    update?'':refs.map(sessionOutbox).join(' '));
}

export const taskSummaryObjects = {tables:Object.keys(schemas),indexes:Object.keys(indexes),triggers:Object.keys(triggers)};
export const taskSummarySchema = [
  ...Object.values(schemas),...Object.values(indexes),
  `INSERT OR IGNORE INTO ${control} VALUES(1,lower(hex(randomblob(16))),0,'rebuilding','',0);`,
  ...Object.values(triggers),
].join('\n');
