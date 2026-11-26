import {createHash} from 'node:crypto';
import type {PersonalMemorySelection} from '../../../shared/xiaozhi-personal-memory';
import {readTeacherMemoryPolicy} from '../teacher-memory-policy';
import type {Sql} from '../../xiaozhi-agent/session-state';
import {createPersonalMemoryRecordState} from './record-state';
import {createPersonalMemorySourceAuthority} from './source-authority';

export function createPersonalMemoryUse(sql:Sql,sanitize:(text:string)=>Promise<string>) {
  const authority=createPersonalMemorySourceAuthority(sql,sanitize);
  const records=createPersonalMemoryRecordState(sql,authority);
  return async(sessionId:string,selected:PersonalMemorySelection)=>{
    const [session]=await sql.all('SELECT student_id,archived_at FROM ai_conversation_sessions WHERE id=?',[sessionId]);
    if (!session || session.student_id || session.archived_at) return null;
    const policy=await readTeacherMemoryPolicy(sql);
    if (Object.keys(policy.use).length) return null;
    const record=await records.read(selected.id);
    if (!record || record.state!=='active' || !record.sourceCurrent || record.revision!==selected.version ||
        record.witness.sourceVersion!==selected.sourceVersion || record.scope.kind!=='teacher' || record.scope.id!=='self') return null;
    const text=await sanitize(record.value);
    if (!text.trim()) return null;
    const pin:PersonalMemorySelection={layer:'personal',source:'personal',id:selected.id,version:selected.version,
      sourceVersion:selected.sourceVersion};
    const fingerprint=createHash('sha256').update(JSON.stringify([pin,record.witness,record.kind,
      record.scope,record.term,text,policy.revision])).digest('hex');
    return {fingerprint,text,label:record.kind==='preference'?'教师确认的教学偏好':'教师确认的任教自述',
      scope:record.scope.kind,term:record.term,occurredAt:record.sourceOccurredAt};
  };
}
