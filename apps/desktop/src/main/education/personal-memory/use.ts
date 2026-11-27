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
  async function permitted(db:Sql,sessionId:string,selected:PersonalMemorySelection) {
    const [session]=await db.all('SELECT student_id,archived_at FROM ai_conversation_sessions WHERE id=?',[sessionId]);
    if (!session || session.student_id || session.archived_at) return null;
    const policy=await readTeacherMemoryPolicy(db);
    if (Object.keys(policy.use).length) return null;
    const record=await createPersonalMemoryRecordState(db,authority).read(selected.id);
    if (!record?.value || record.state!=='active' || !record.sourceCurrent || record.revision!==selected.version ||
        record.witness.sourceVersion!==selected.sourceVersion) return null;
    let targetVersion:number|undefined;
    if (record.scope.kind === 'class') {
      const target = await currentTeachingTarget(db,sessionId);
      if (!target || target.folderId!==record.scope.id || target.term!==record.term) return null;
      targetVersion=target.version;
    } else if (record.scope.kind!=='teacher' || record.scope.id!=='self' || record.term!=='unknown') return null;
    return {record,policyRevision:policy.revision,targetVersion};
  }
  return async(sessionId:string,selected:PersonalMemorySelection)=>{
    const check=(db:Sql)=>permitted(db,sessionId,selected);
    const read=()=>sql.readTransaction ? sql.readTransaction(check) : check(sql);
    const before=await read();
    if (!before) return null;
    const text=await sanitize(before.record.value);
    if (!text.trim()) return null;
    // Sanitization may yield while a teacher revises a source or changes class.
    const after=await read();
    if (!after || before.policyRevision!==after.policyRevision || before.targetVersion!==after.targetVersion) return null;
    const {record,policyRevision}=after;
    const pin:PersonalMemorySelection={layer:'personal',source:'personal',id:selected.id,version:selected.version,
      sourceVersion:selected.sourceVersion};
    const fingerprint=createHash('sha256').update(JSON.stringify([pin,record.witness,record.kind,
      record.scope,record.term,text,policyRevision])).digest('hex');
    return {fingerprint,text,label:'教师确认的'+teacherMemoryCategories[personalMemoryCategory(record.kind)].label,
      scope:record.scope.kind,scopeId:record.scope.id,term:record.term,occurredAt:record.sourceOccurredAt};
  };
}
