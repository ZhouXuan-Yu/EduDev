import type sqlite3 from 'sqlite3';
import type {BackupContinuity} from '../../shared/backup-continuity';
import {THINKING_CHOICES} from '../../shared/xiaozhi-thinking';
import {withReadOnlyBackup} from './compatibility';

function query(db: sqlite3.Database, sql: string, args: string[] = []): Promise<Record<string, number>> {
  return new Promise((resolve, reject) => db.get(sql, args, (error, row: Record<string, number>) => {
    if (error) reject(error);
    else resolve(row);
  }));
}

const storedJson = (column: string) => `CASE WHEN json_valid(${column}) THEN ${column} ELSE '{}' END`;
const revision = (column: string) => `json_extract(${column}, '$.schema') = 1
  AND json_type(${column}, '$.revision') = 'integer' AND json_extract(${column}, '$.revision') > 0`;
const hasText = (column: string, field: string) => `json_type(${column}, '$.${field}') = 'text'
  AND length(trim(json_extract(${column}, '$.${field}'))) > 0`;
const thinkingChoices = THINKING_CHOICES.map(() => '?').join(',');

/** A verified full backup can contain account-bound settings. Return counts and flags only. */
export async function readBackupContinuity(file: string): Promise<BackupContinuity> {
  try {
    return await withReadOnlyBackup(file, async db => {
      const hasTable = async (name: string) => (await query(db,
        "SELECT count(*) AS total FROM sqlite_schema WHERE type='table' AND name=?", [name])).total === 1;
      if (!await hasTable('app_settings')) return {status: 'unavailable'};
      const settings = await query(db, `WITH known AS
        (SELECT key, ${storedJson('value_json')} AS doc FROM app_settings WHERE key IN
          ('xiaozhi.provider.v1', 'xiaozhi.thinking.default', 'deepseek', 'glm'))
        SELECT count(CASE WHEN key='xiaozhi.provider.v1' AND ${revision('doc')} AND ${hasText('doc', 'defaultModel')}
          OR key IN ('deepseek', 'glm') AND ${hasText('doc', 'model')} THEN 1 END) AS models,
          count(CASE WHEN key='xiaozhi.thinking.default' AND ${revision('doc')}
            AND json_extract(doc, '$.choice') IN (${thinkingChoices}) THEN 1 END) AS thinking,
          count(CASE WHEN key='xiaozhi.provider.v1' AND ${hasText('doc', 'sealedKey')}
            OR key IN ('deepseek', 'glm') AND ((${hasText('doc', 'apiKey')}) OR (${hasText('doc', 'sealedKey')})) THEN 1 END) AS credentials
        FROM known`, [...THINKING_CHOICES]);
      const sessions = await hasTable('ai_conversation_sessions') ? await query(db, `WITH choices AS (
        SELECT pref.key, ${storedJson('pref.value_json')} AS doc FROM ai_conversation_sessions s
        JOIN app_settings pref ON pref.key IN ('xiaozhi.model.' || s.id, 'xiaozhi.thinking.' || s.id))
        SELECT count(CASE WHEN key GLOB 'xiaozhi.model.*' AND ${revision('doc')}
          AND ${hasText('doc', 'model')} THEN 1 END) AS models,
          count(CASE WHEN key GLOB 'xiaozhi.thinking.*' AND ${revision('doc')}
            AND json_extract(doc, '$.choice') IN (${thinkingChoices}) THEN 1 END) AS thinking
        FROM choices`, [...THINKING_CHOICES]) : null;
      const personalSkills = await hasTable('xiaozhi_skill_governance_v1') ? (await query(db, `SELECT count(*) AS total
        FROM xiaozhi_skill_governance_v1 WHERE json_extract(${storedJson('payload_json')}, '$.scope')='personal'`)).total : null;
      const paperTemplates = await hasTable('paper_template_heads') && await hasTable('paper_template_versions')
        ? (await query(db, `SELECT count(*) AS total FROM paper_template_heads h JOIN paper_template_versions v
          ON v.template_id=h.template_id AND v.version=h.head_version`)).total : null;
      const savedWorkspaces = await hasTable('xiaozhi_pi_workspaces')
        ? (await query(db, 'SELECT count(*) AS total FROM xiaozhi_pi_workspaces')).total : null;
      return {status: 'checked', defaultModel: settings.models > 0, defaultThinking: settings.thinking > 0,
        sessionModels: sessions?.models ?? null, sessionThinking: sessions?.thinking ?? null,
        personalSkills, paperTemplates, savedWorkspaces, modelCredentialRecorded: settings.credentials > 0};
    });
  } catch {
    return {status: 'unavailable'};
  }
}
