import type {Sql} from '../session-state';

const keys='xiaozhi.memory-use.task.v1:*';

/** The session/classroom mutation and all dependent Task invalidations share its SQLite transaction. */
export async function invalidateTaskHistoryForSession(work:Sql,sessionId:string) {
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
