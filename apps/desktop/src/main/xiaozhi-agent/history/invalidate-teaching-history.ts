import type {Sql} from '../session-state';
import {invalidateHistoryProjections} from './state';

const keys='xiaozhi.memory-use.task.v1:*';

/** A source moved to another teaching scope requires fresh consent in that scope. */
export async function invalidateTeachingHistoryForSession(work:Sql,sessionId:string) {
  const affected=await work.all(`SELECT source_id FROM memory_source_access WHERE session_id=? AND memory_state='active'
    AND (discover_allowed=1 OR index_allowed=1)`,[sessionId]);
  await work.run(`UPDATE memory_source_access SET memory_state='disabled',discover_allowed=0,index_allowed=0,
    access_revision=access_revision+1,generation=generation+1,updated_at=? WHERE session_id=? AND memory_state='active'
    AND (discover_allowed=1 OR index_allowed=1)`,[new Date().toISOString(),sessionId]);
  for(const row of affected)await invalidateHistoryProjections(work,String(row.source_id));
  await work.run(`UPDATE app_settings SET value_json=json_set(value_json,'$.invalidated',json('true')),updated_at=?
    WHERE key GLOB ? AND CASE WHEN json_valid(value_json) THEN value_json->>'$.sessionId' END=?`,
  [new Date().toISOString(),keys,sessionId]);
  await work.run(`UPDATE app_settings SET value_json=json_set(value_json,'$.revision',(value_json->>'$.revision')+1,
    '$.selections',json((SELECT json_group_array(json(retained.value)) FROM json_each(value_json,'$.selections') retained
      WHERE NOT EXISTS(SELECT 1 FROM memory_source_access affected
        WHERE affected.source_id=retained.value->>'$.id' AND affected.session_id=?)))),updated_at=?
    WHERE key GLOB ? AND CASE WHEN json_valid(value_json) THEN
      value_json->>'$.sessionId'<>? AND (value_json->>'$.invalidated') IS NULL
      AND EXISTS(SELECT 1 FROM json_each(value_json,'$.selections') pin JOIN memory_source_access affected
        ON affected.source_id=pin.value->>'$.id' WHERE affected.session_id=?)
      ELSE 0 END`,[sessionId,new Date().toISOString(),keys,sessionId,sessionId]);
}
