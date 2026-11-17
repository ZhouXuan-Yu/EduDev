import {createHash} from 'node:crypto';
import type {Sql} from '../session-state';

/** Local official review adapter. Enrollment is a trusted release/main operation, never IPC. */
export function createOfficialSkillAuthority(sql: Sql) {
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  async function migrate() {
    await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_skill_official_reviewers_v1 (
      actor_id TEXT PRIMARY KEY, source_reference TEXT NOT NULL, source_hash TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0, record_hash TEXT NOT NULL)`);
  }
  return {
    migrate,
    async recordReviewedRole(actorId: string, source: {reference: string; sha256: string}) {
      if (!/^[A-Za-z0-9_.-]{1,128}$/.test(actorId) || !source.reference.startsWith('app-reviewed:')
        || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('invalid_input');
      const record = JSON.stringify([actorId, source.reference, source.sha256, 0]);
      await sql.run(`INSERT OR IGNORE INTO xiaozhi_skill_official_reviewers_v1(actor_id,source_reference,source_hash,revoked,record_hash)
        VALUES(?,?,?,0,?)`, [actorId, source.reference, source.sha256, hash(record)]);
    },
    async revoke(actorId: string) {
      const rows = await sql.all('SELECT * FROM xiaozhi_skill_official_reviewers_v1 WHERE actor_id=?', [actorId]);
      if (rows.length !== 1) throw new Error('invalid_input');
      const row = rows[0];
      await sql.run('UPDATE xiaozhi_skill_official_reviewers_v1 SET revoked=1,record_hash=? WHERE actor_id=?',
        [hash(JSON.stringify([actorId, row.source_reference, row.source_hash, 1])), actorId]);
    },
    async reviewers() {
      const rows = await sql.all('SELECT * FROM xiaozhi_skill_official_reviewers_v1');
      const actors = new Set<string>();
      for (const row of rows) {
        if (typeof row.actor_id !== 'string' || typeof row.source_reference !== 'string'
          || !row.source_reference.startsWith('app-reviewed:') || typeof row.source_hash !== 'string'
          || !/^[a-f0-9]{64}$/.test(row.source_hash) || ![0, 1].includes(Number(row.revoked))
          || row.record_hash !== hash(JSON.stringify([row.actor_id, row.source_reference, row.source_hash, row.revoked]))) {
          throw new Error('configuration');
        }
        if (!row.revoked) actors.add(row.actor_id);
      }
      return actors;
    },
  };
}
