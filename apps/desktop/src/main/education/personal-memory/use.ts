import {personalMemoryCategory, teacherMemoryCategories} from '../../../shared/xiaozhi-personal-memory';
import {currentTeachingTarget} from '../../xiaozhi-agent/memory-scope-state';
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
        record.witness.sourceVersion!==selected.sourceVersion) return null;
    if (record.scope.kind === 'class') {
      const target = await currentTeachingTarget(sql,sessionId);
      if (!target || target.folderId!==record.scope.id || target.term!==record.term) return null;
    } else if (record.scope.kind!=='teacher' || record.scope.id!=='self' || record.term!=='unknown') return null;
    const text=await sanitize(record.value);
    if (!text.trim()) return null;
    const pin:PersonalMemorySelection={layer:'personal',source:'personal',id:selected.id,version:selected.version,
      sourceVersion:selected.sourceVersion};
    const fingerprint=createHash('sha256').update(JSON.stringify([pin,record.witness,record.kind,
      record.scope,record.term,text,policy.revision])).digest('hex');
    return {fingerprint,text,label:'教师确认的'+teacherMemoryCategories[personalMemoryCategory(record.kind)].label,
      scope:record.scope.kind,scopeId:record.scope.id,term:record.term,occurredAt:record.sourceOccurredAt};
  };
}
