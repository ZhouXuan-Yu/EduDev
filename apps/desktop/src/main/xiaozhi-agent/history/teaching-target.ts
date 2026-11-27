import {validTeachingTarget} from '../../../shared/xiaozhi-memory';
import {createPiMemoryScopeState} from '../memory-scope-state';
import type {Sql} from '../session-state';

export type HistoryTeachingTarget={folderId:string|null;term:string|null};

export async function historyTeachingContext(sql:Sql,sessionId:string) {
  const saved=await createPiMemoryScopeState(sql).memoryScope(sessionId);
  const [owner]=await sql.all(`SELECT s.folder_id FROM ai_conversation_sessions s
    LEFT JOIN ai_conversation_folders f ON f.id=s.folder_id
    WHERE s.id=? AND COALESCE(s.student_id,'')='' AND COALESCE(s.archived_at,'')=''
    AND (s.folder_id IS NULL OR f.id IS NOT NULL AND COALESCE(f.archived_at,'')='')`,[sessionId]);
  if(!owner)throw Error('permission_denied');
  const folderId=typeof owner.folder_id==='string'&&owner.folder_id?owner.folder_id:null;
  if(saved.teachingTarget&&saved.teachingTarget.folderId!==folderId)throw Error('memory_scope_changed');
  return {saved,target:{folderId,term:saved.teachingTarget?.term??null}};
}

export function historyTargetApplies(source:HistoryTeachingTarget,target:HistoryTeachingTarget) {
  return (source.folderId===null||source.folderId===target.folderId)&&(source.term===null||source.term===target.term);
}


/** Bulk filter a bounded discovery result before original content is read or ranked. */
export async function eligibleHistorySessions(sql:Sql,ids:readonly string[],target:HistoryTeachingTarget) {
  const keys=[...new Set(ids)];
  if(!keys.length)return new Set<string>();
  const rows=await sql.all(`SELECT s.id,s.folder_id,scope.schema_version,scope.payload_json FROM ai_conversation_sessions s
    LEFT JOIN ai_conversation_folders f ON f.id=s.folder_id
    LEFT JOIN xiaozhi_pi_memory_scopes scope ON scope.conversation_id=s.id
    WHERE s.id IN (${keys.map(()=>'?').join(',')}) AND COALESCE(s.archived_at,'')='' AND COALESCE(s.student_id,'')=''
      AND (s.folder_id IS NULL OR f.id=? AND COALESCE(f.archived_at,'')='')`,[...keys,target.folderId]);
  return new Set(rows.flatMap(row=>{
    if(row.payload_json===null)return [String(row.id)];
    if(![1,2,3,4].includes(Number(row.schema_version))||typeof row.payload_json!=='string')return [];
    let payload;
    try{payload=JSON.parse(row.payload_json);}catch{return [];}
    if(!payload||typeof payload!=='object'||Array.isArray(payload))return [];
    const scoped=payload.teachingTarget;
    if(scoped!==undefined&&(row.schema_version!==4||!validTeachingTarget(scoped)||scoped.folderId!==row.folder_id))return [];
    return historyTargetApplies({folderId:typeof row.folder_id==='string'?row.folder_id:null,term:scoped?.term??null},target)
      ?[String(row.id)]:[];
  }));
}
