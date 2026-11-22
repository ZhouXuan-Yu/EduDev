import path from 'node:path';
import {validTeachingArtifactOrigin} from '../../shared/teaching-artifact-reference';
import type {WorkbenchArtifactLink, WorkbenchArtifactTaskLink, WorkbenchQuery, WorkbenchSummary} from '../../shared/xiaozhi-workbench';
import {officeVersionFamilies, type OfficeFamilyRecord} from './office-version-family';
import {createTextChangeState} from './text-change-state';
import {textVersionFamilies} from './text-version-family';
import {createTaskState} from './tasks/task-state';
import {workbenchText, type WorkbenchRead} from './workbench-state';
import {mockExamWorkbenchRows} from '../education/mock-exam-state';

type Query = Extract<WorkbenchQuery, {kind: 'task_artifacts'|'artifact_tasks'}>;
type Version = Omit<WorkbenchArtifactLink,'relation'> & {hash: string; producerRunId: string | null};
type OfficeRow = OfficeFamilyRecord & {title: string; hash: string; runId: string; originalPath: string | null; originalHash: string | null};
const digest = (hash:unknown) => typeof hash==='string' && /^[a-f0-9]{64}$/.test(hash);
const restored = (row:{runId:string}) => row.runId.startsWith('local_restore_');

function producer<T extends {runId:string}>(start:T, source:(row:T)=>T|undefined) {
  const seen = new Set<T>();
  let row:T|undefined=start;
  while(row&&restored(row)) {
    if(seen.has(row))return null;
    seen.add(row);row=source(row);
  }
  return row?.runId||null;
}

/** File bodies remain in their existing preview path. */
async function versions(read:WorkbenchRead, sessionId:string) {
  const result=new Map<string,Version>();
  const text=await createTextChangeState(read.sql).versionRecords(sessionId);
  const textFamilies=textVersionFamilies(text), byId=new Map(text.map(row=>[row.id,row]));
  for(const row of text) {
    const family=textFamilies.get(row.id);
    if(!family||!row.htmlArtifact||!digest(row.afterSha256))continue;
    const producerRunId=producer(row,item=>{
      const parent=item.callId.startsWith('restore:')&&byId.get(item.callId.slice(8));
      return parent&&parent.htmlArtifact&&['applied','reverted'].includes(parent.state)
        &&parent.afterSha256===item.afterSha256&&parent.workspaceHash===item.workspaceHash?parent:undefined;
    });
    result.set(row.id,{sessionId,artifactId:row.id,currentArtifactId:family.currentId||null,
      title:workbenchText(path.posix.basename(row.path)),version:family.versions.indexOf(row)+1,hash:row.afterSha256,restored:restored(row),producerRunId});
  }

  const office=await read.sql.all(`SELECT d.artifact_id AS artifactId,d.relative_path AS path,d.title,d.output_hash AS hash,
    d.workspace_hash AS workspaceHash,d.parent_artifact_id AS parentArtifactId,d.run_id AS runId,json_extract(d.draft_json,'$.schemaVersion') AS draftSchema,
    (SELECT relative_path FROM xiaozhi_pi_office_draft_sources s WHERE s.draft_id=d.id AND s.kind='workspace_file' AND s.ordinal=0) AS originalPath,
    (SELECT sha256 FROM xiaozhi_pi_office_draft_sources s WHERE s.draft_id=d.id AND s.kind='workspace_file' AND s.ordinal=0) AS originalHash
    FROM xiaozhi_pi_office_drafts d JOIN document_artifacts a ON a.id=d.artifact_id AND a.session_id=d.conversation_id
      AND a.status='exported' AND a.content_hash=d.output_hash
    WHERE d.conversation_id=? AND d.state='saved' ORDER BY d.updated_at,d.rowid`,[sessionId]) as OfficeRow[];
  const families=officeVersionFamilies(office), ordinal=new Map<string,number>(), positions=new Map(office.map((row,i)=>[row,i]));
  for(const row of office) {
    const family=families.get(row.artifactId), version=family ? (ordinal.get(family.familyId)||0)+1 : null;
    if(family&&version)ordinal.set(family.familyId,version);
    if(!digest(row.hash))continue;
    const producerRunId=producer(row,item=>{
      if(!family)return undefined;
      const candidates=office.slice(0,positions.get(item)).filter(parent=>digest(item.originalHash)&&item.originalHash===item.hash
        &&parent.path===item.originalPath&&parent.hash===item.originalHash&&parent.workspaceHash===item.workspaceHash
        &&families.get(parent.artifactId)?.familyId===family.familyId);
      return candidates.length===1?candidates[0]:undefined;
    });
    result.set(row.artifactId,{sessionId,artifactId:row.artifactId,currentArtifactId:family?.currentArtifactId||row.artifactId,
      title:workbenchText(row.title),version,hash:row.hash,restored:restored(row),producerRunId});
  }
  const legacy=await read.sql.all("SELECT id,title,content_hash FROM document_artifacts WHERE session_id=? AND status='exported'",[sessionId]);
  for(const row of legacy)if(typeof row.id==='string'&&typeof row.content_hash==='string'&&digest(row.content_hash)&&!result.has(row.id)) {
    result.set(row.id,{sessionId,artifactId:row.id,currentArtifactId:row.id,title:workbenchText(row.title),version:null,hash:row.content_hash,restored:false,producerRunId:null});
  }
  if(read.tables.has('mock_exam_compilation_versions')){
    for(const row of await mockExamWorkbenchRows(read.sql,sessionId)){
      result.set(row.id,{kind:'mock_exam',sessionId,artifactId:row.id,currentArtifactId:row.id,title:row.title,version:row.revision,
        hash:row.digest,restored:false,producerRunId:row.runId});
    }
  }
  return result;
}

async function visibleStudent(read:WorkbenchRead,id:string) {
  if(!read.sessions.has(id))return null;
  const [row]=await read.sql.all(`SELECT coalesce(c.student_id,'') AS student FROM ai_conversation_sessions c
    WHERE c.id=? AND (coalesce(c.student_id,'')='' OR EXISTS(SELECT 1 FROM students s WHERE s.id=c.student_id AND s.status='active'))`,[id]);
  return row&&typeof row.student==='string'?row.student:null;
}

const attachmentQuery=`SELECT a.conversation_id AS sessionId,a.run_id AS runId,a.artifact_origin_json AS origin,a.content_sha256 AS hash
  FROM xiaozhi_pi_attachments a JOIN ai_conversation_messages m ON m.id=a.message_id AND m.session_id=a.conversation_id
  WHERE a.state='submitted' AND a.artifact_origin_json IS NOT NULL AND m.role='user'
    AND CASE WHEN json_valid(m.metadata_json) THEN json_extract(m.metadata_json,'$.agentRunId') END=a.run_id`;

function originFrom(row:Record<string,unknown>) {
  try {
    const origin:unknown=JSON.parse(String(row.origin));
    return validTeachingArtifactOrigin(origin)&&origin.contentHash===row.hash?origin:undefined;
  } catch { return undefined; }
}

function publicVersion({hash:_hash,producerRunId:_producer,...version}:Version,relation:WorkbenchArtifactLink['relation']):WorkbenchArtifactLink {
  return {...version,relation};
}

export async function readWorkbenchArtifactLinks(read:WorkbenchRead,input:Query):Promise<WorkbenchSummary> {
  const student=await visibleStudent(read,input.sessionId);
  if(student===null)throw Error('permission_denied');
  const tasks=createTaskState(read.sql,{sanitize:async text=>text});
  const catalogs=new Map<string,Promise<Map<string,Version>>>();
  function catalog(sessionId:string) {
    const cached=catalogs.get(sessionId);if(cached)return cached;
    const pending=versions(read,sessionId);catalogs.set(sessionId,pending);return pending;
  }
  let partial=false;
  if(input.kind==='task_artifacts') {
    const record=await tasks.summaryRecord(input.taskId);
    if(!record||record.view.sessionId!==input.sessionId)throw Error('permission_denied');
    const runs=new Set(record.runIds), items:WorkbenchArtifactLink[]=[];
    for(const version of (await catalog(input.sessionId)).values()) {
      if(version.producerRunId&&runs.has(version.producerRunId))items.push(publicVersion(version,'produced'));
    }
    const refs=await read.sql.all(`${attachmentQuery} AND a.conversation_id=? AND a.run_id IN (${record.runIds.map(()=>'?').join(',')}) ORDER BY a.rowid LIMIT 257`,
      [input.sessionId,...record.runIds]);
    const seen=new Set<string>();
    for(const ref of refs.slice(0,256)) {
      const origin=originFrom(ref);
      if(!origin){partial=true;continue;}
      if(seen.has(origin.artifactId)||await visibleStudent(read,origin.sourceSessionId)!==student)continue;
      const version=(await catalog(origin.sourceSessionId)).get(origin.artifactId);
      if(!version||version.hash!==origin.contentHash){partial=true;continue;}
      seen.add(origin.artifactId);items.push(publicVersion(version,'referenced'));
    }
    return {schemaVersion:1,kind:input.kind,items,partial:partial||refs.length>256};
  }

  const version=(await catalog(input.sessionId)).get(input.artifactId);
  if(!version)throw Error('changed');
  const items:WorkbenchArtifactTaskLink[]=[], seen=new Set<string>();
  async function add(sessionId:string,runId:string,relation:WorkbenchArtifactLink['relation']) {
    const matches=await read.sql.all(`SELECT json_extract(doc,'$.view.id') AS taskId FROM (
      SELECT key,CASE WHEN json_valid(value_json) THEN value_json END AS doc FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:xitask_*'
      ) WHERE key='xiaozhi.task.v1:'||json_extract(doc,'$.view.id') AND json_extract(doc,'$.view.sessionId')=?
      AND EXISTS(SELECT 1 FROM json_each(doc,'$.lineage') WHERE type='object' AND json_extract(value,'$.runId')=?) LIMIT 2`,[sessionId,runId]);
    if(matches.length!==1||typeof matches[0].taskId!=='string')return;
    const task=await tasks.summaryRecord(matches[0].taskId);
    if(!task||task.view.sessionId!==sessionId||!task.runIds.includes(runId))return;
    const key=relation+':'+task.view.id;if(seen.has(key))return;
    const title=workbenchText(task.view.criteria.find(item=>item.id==='teacher_request')?.text,160)||read.sessions.get(sessionId)?.title||'';
    seen.add(key);items.push({relation,sessionId,taskId:task.view.id,title,restored:version!.restored});
  }
  if(version.producerRunId)await add(input.sessionId,version.producerRunId,'produced');
  if(version.kind==='mock_exam')return {schemaVersion:1,kind:input.kind,items,partial};
  const refs=await read.sql.all(`${attachmentQuery} AND CASE WHEN json_valid(a.artifact_origin_json) THEN
    json_extract(a.artifact_origin_json,'$.artifactId') END=? AND a.content_sha256=? ORDER BY a.rowid LIMIT 257`,[input.artifactId,version.hash]);
  for(const ref of refs.slice(0,256)) {
    const origin=originFrom(ref);
    if(!origin){partial=true;continue;}
    if(origin.sourceSessionId!==input.sessionId||typeof ref.sessionId!=='string'||typeof ref.runId!=='string'
      ||await visibleStudent(read,ref.sessionId)!==student)continue;
    await add(ref.sessionId,ref.runId,'referenced');
  }
  return {schemaVersion:1,kind:input.kind,items,partial:partial||refs.length>256};
}
