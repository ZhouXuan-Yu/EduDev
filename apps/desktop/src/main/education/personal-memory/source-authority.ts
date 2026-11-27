import {currentTeachingTarget} from '../../xiaozhi-agent/memory-scope-state';
import { createHash } from 'node:crypto';
import type { HistorySourceRef } from '../../../shared/xiaozhi-history-memory';
import { readHistorySource, validHistoryRef } from '../../xiaozhi-agent/history/source';
import { createHistoryState, historyId } from '../../xiaozhi-agent/history/state';
import type { Sql } from '../../xiaozhi-agent/session-state';
import { candidateEvidence } from './candidate-admission';
import type { CandidateAuthority, PersonalMemoryDraft, PersonalMemorySource } from './candidate-admission';
import { invalidatePersonalMemoryDrafts } from './candidate-state';

type Binding = Readonly<{ scope: PersonalMemorySource['scope']; term: string }>;
type ExtractPermission = Readonly<{
  sourceId: string;
  ref: HistorySourceRef;
  revision: number;
  historyGeneration: number;
  allowed: boolean;
  binding: Binding;
}>;

export const personalMemoryExtractSchema = `
CREATE TABLE personal_memory_extract_grants (
  source_id TEXT PRIMARY KEY REFERENCES memory_source_access(source_id),
  source_version TEXT NOT NULL CHECK(length(source_version)=64),
  history_generation INTEGER NOT NULL CHECK(history_generation>0),
  grant_revision INTEGER NOT NULL CHECK(grant_revision>0),
  extract_allowed INTEGER NOT NULL CHECK(extract_allowed IN (0,1)),
  scope_kind TEXT NOT NULL CHECK(scope_kind IN ('teacher','class','course','task','artifact')),
  scope_id TEXT NOT NULL,
  term TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  extraction_job_id TEXT
);
CREATE INDEX personal_memory_grants_ready ON personal_memory_extract_grants(extract_allowed,updated_at,source_id);
CREATE TRIGGER personal_memory_extract_history_invalidation
AFTER UPDATE OF generation, memory_state ON memory_source_access
WHEN NEW.generation<>OLD.generation OR NEW.memory_state<>OLD.memory_state
BEGIN
  UPDATE personal_memory_pending SET state='stale', revision=revision+1
    WHERE source_id=OLD.source_id AND state IN ('pending','conflict');
  UPDATE personal_memory_extract_grants SET extract_allowed=0, grant_revision=grant_revision+1,
    updated_at=CAST(strftime('%s','now') AS INTEGER)*1000
    WHERE source_id=OLD.source_id AND extract_allowed=1;
END;
`;

const digestPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-z0-9][a-z0-9_-]{0,179}$/i;
const runPattern = /^run_[a-z0-9_-]{1,176}$/i;
const sensitiveCredential = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-|ghp_|xox[baprs]-)[a-z0-9_-]{12,}\b|\b(?:authorization|cookie|api[_ -]?key)\s*[:=]\s*\S)/i;

// A teacher-authored chat can still contain a pupil record. Keep identified
// student data out of personal-memory extraction, including late job delivery.
const studentIdentifier = /(?:学生姓名|学生编号|学籍号|学号)\s*[：:=]\s*\S|(?:学籍号|学号)\s*[a-z]?\d{3,}/iu;
const individualScore = /(?:学生(?!版|用书)|同学)[^。！？\n]{0,32}(?:成绩|分数|得分|得了|考了|考得|考到)\s*[：:=为是]?\s*\d+(?:\.\d+)?\s*分/u;
export function containsPrivateMemoryText(text:string) {
  return sensitiveCredential.test(text) || studentIdentifier.test(text) || individualScore.test(text);
}


function validBinding(binding: Binding | undefined): binding is Binding {
  return !!binding && ['teacher','class','course','task','artifact'].includes(binding.scope?.kind)
    && typeof binding.scope.id === 'string' && idPattern.test(binding.scope.id)
    && typeof binding.term === 'string' && binding.term.length <= 80 && !!binding.term.trim();
}

function unavailable(error: unknown) {
  return error instanceof Error && ['source_unavailable','source_changed'].includes(error.message);
}

/** The host authorizes extraction as its own purpose on the existing R1 source identity. */
export function createPersonalMemorySourceAuthority(sql: Sql, sanitize: (text: string) => Promise<string>) {
  const history = createHistoryState(sql);
  async function permission(id: string, db = sql): Promise<ExtractPermission | null> {
    const [row] = await db.all(`
      SELECT a.source_id,a.kind,a.session_id,a.record_id,a.generation,a.memory_state,
        g.source_version,g.history_generation,g.grant_revision,g.extract_allowed,g.scope_kind,g.scope_id,g.term
      FROM personal_memory_extract_grants g JOIN memory_source_access a ON a.source_id=g.source_id
      WHERE g.source_id=?
    `, [id]);
    if (!row) return null;
    const ref = {kind:row.kind, sessionId:row.session_id, recordId:row.record_id, sourceVersion:row.source_version};
    const binding = {scope:{kind:row.scope_kind, id:row.scope_id}, term:row.term} as Binding;
    const revision = Number(row.grant_revision);
    const historyGeneration = Number(row.history_generation);
    if (!validHistoryRef(ref) || !validBinding(binding) || !Number.isSafeInteger(revision) || revision < 1
        || !Number.isSafeInteger(historyGeneration) || historyGeneration < 1) throw Error('configuration');
    return {sourceId:id, ref, revision, historyGeneration, binding,
      allowed:row.extract_allowed===1 && row.memory_state==='active' && row.generation===historyGeneration};
  }

  async function change(ref: HistorySourceRef, expectedRevision: number, binding: Binding | null, teachingTargetVersion?:number) {
    if (!validHistoryRef(ref) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
        || (binding !== null && !validBinding(binding))) throw Error('invalid_input');
    if (!sql.transaction) throw Error('configuration');
    const id = historyId(ref);
    return sql.transaction(async db=>{
      const current = await permission(id,db);
      if ((current?.revision ?? 0)!==expectedRevision) throw Error('revision_conflict');
      if (teachingTargetVersion !== undefined) {
        if (!binding || !Number.isSafeInteger(teachingTargetVersion) || teachingTargetVersion < 1) throw Error('invalid_input');
        const target = await currentTeachingTarget(db,ref.sessionId);
        if (!target || target.version !== teachingTargetVersion) throw Error('revision_conflict');
        binding = {scope:{kind:'class',id:target.folderId},term:target.term};
      }
      if (!binding) {
        if (!current) return null;
        if (current.ref.sourceVersion !== ref.sourceVersion) throw Error('source_changed');
        if (!current.allowed) return current;
        await db.run(`UPDATE personal_memory_extract_grants SET extract_allowed=0,grant_revision=grant_revision+1,updated_at=?
          WHERE source_id=?`, [Date.now(),id]);
        await invalidatePersonalMemoryDrafts(db,id,current.revision);
        return permission(id,db);
      }

      const source = await readHistorySource(db,ref);
      if (!runPattern.test(source.runId) || containsPrivateMemoryText(source.teacherText)) throw Error('permission_denied');
      if (current?.allowed && current.ref.sourceVersion === ref.sourceVersion &&
          current.binding.scope.kind === binding.scope.kind && current.binding.scope.id === binding.scope.id &&
          current.binding.term === binding.term) return current;
      const identity = await history.get(id,db);
      if (identity && identity.status !== 'active') throw Error('permission_denied');
      if (!identity) {
        await db.run(`INSERT INTO memory_source_access (source_id,kind,session_id,record_id,source_version,
          access_revision,generation,index_allowed,discover_allowed,memory_state,updated_at)
          VALUES(?,?,?,?,?,1,1,0,0,'active',?)`,[id,ref.kind,ref.sessionId,ref.recordId,ref.sourceVersion,new Date().toISOString()]);
      }
      await db.run(`INSERT INTO personal_memory_extract_grants
        (source_id,source_version,history_generation,grant_revision,extract_allowed,scope_kind,scope_id,term,updated_at)
        VALUES(?,?,?,?,1,?,?,?,?)
        ON CONFLICT(source_id) DO UPDATE SET source_version=excluded.source_version,history_generation=excluded.history_generation,
          grant_revision=excluded.grant_revision,extract_allowed=1,scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,
          term=excluded.term,updated_at=excluded.updated_at,extraction_job_id=NULL`,
      [id,ref.sourceVersion,identity?.generation ?? 1,expectedRevision+1,binding.scope.kind,binding.scope.id,binding.term,Date.now()]);
      if (current) await invalidatePersonalMemoryDrafts(db,id,current.revision);
      return permission(id,db);
    });
  }

  // Local sanitization may yield while the source changes or a grant is revoked.
  async function stillCurrent(db: Sql, saved: ExtractPermission, teacherText: string) {
    const current = await permission(saved.sourceId, db);
    if (!current?.allowed || current.revision !== saved.revision || current.ref.sourceVersion !== saved.ref.sourceVersion) return false;
    const latest = await readHistorySource(db, current.ref);
    const confirmed = await permission(saved.sourceId, db);
    return latest.teacherText === teacherText && confirmed?.allowed === true && confirmed.revision === saved.revision;
  }

  async function snapshot(ids: readonly string[], policy: CandidateAuthority): Promise<PersonalMemorySource[]> {
    if (ids.length > 12 || ids.some(id=>!digestPattern.test(id))) throw Error('invalid_input');
    const sources: PersonalMemorySource[] = [];
    for (const id of new Set(ids)) {
      const saved = await permission(id);
      if (!saved?.allowed) continue;
      try {
        const source = await readHistorySource(sql,saved.ref);
        if (!runPattern.test(source.runId) || containsPrivateMemoryText(source.teacherText)) continue;
        const sanitizedText = await sanitize(source.teacherText);
        if (!sanitizedText.trim() || Buffer.byteLength(sanitizedText,'utf8') > 32*1024) continue;
        if (!await stillCurrent(sql, saved, source.teacherText)) continue;
        sources.push({id,sourceVersion:saved.ref.sourceVersion,generation:saved.revision,policyRevision:policy.policyRevision,
          role:'teacher',purpose:['extract'],scope:saved.binding.scope,term:saved.binding.term,sanitizedText});
      } catch (error) {
        if (!unavailable(error)) throw error;
      }
    }
    return sources;
  }

  async function witnessCurrent(db: Sql, draft: PersonalMemoryDraft) {
    const {witness} = draft;
    const saved = await permission(witness.sourceId,db);
    if (!saved?.allowed || saved.revision!==witness.generation || saved.ref.sourceVersion!==witness.sourceVersion
        || saved.binding.scope.kind!==draft.scope.kind || saved.binding.scope.id!==draft.scope.id || saved.binding.term!==draft.term) return false;
    try {
      const source = await readHistorySource(db,saved.ref);
      return runPattern.test(source.runId) && !containsPrivateMemoryText(source.teacherText);
    } catch(error) {
      if (unavailable(error)) return false;
      throw error;
    }
  }

  async function reviewQuote(db: Sql, draft: PersonalMemoryDraft, purpose:'candidate'|'record'='record') {
    if (!await witnessCurrent(db,draft)) return null;
    const saved = await permission(draft.witness.sourceId,db);
    if (!saved?.allowed) return null;
    try {
      const source = await readHistorySource(db,saved.ref);
      const sanitized = await sanitize(source.teacherText);
      const {textDigest,start,end} = draft.witness;
      if (start < 0 || end <= start || end > sanitized.length ||
          createHash('sha256').update(sanitized).digest('hex') !== textDigest) return null;
      if (purpose === 'candidate') {
        const span = candidateEvidence(sanitized, sanitized.slice(start,end));
        if (!span || span.start !== start || span.end !== end || span.statement !== draft.proposedValue) return null;
      }
      return await stillCurrent(db, saved, source.teacherText)
        ? {quote:sanitized.slice(start,end),occurredAt:source.occurredAt} : null;
    } catch (error) {
      if (unavailable(error)) return null;
      throw error;
    }
  }

  async function revokeWitness(db: Sql, id: string, revision: number) {
    if (!db.change) throw Error('configuration');
    const changed = await db.change(`UPDATE personal_memory_extract_grants
      SET extract_allowed=0,grant_revision=grant_revision+1,updated_at=?
      WHERE source_id=? AND grant_revision=? AND extract_allowed=1`, [Date.now(),id,revision]);
    if (changed) await invalidatePersonalMemoryDrafts(db,id,revision);
  }

  async function dispatchCurrent(db: Sql, id: string, sourceVersion: string, revision: number) {
    const saved=await permission(id,db);
    if (!saved?.allowed || saved.ref.sourceVersion!==sourceVersion || saved.revision!==revision) return false;
    try {
      const source=await readHistorySource(db,saved.ref);
      return runPattern.test(source.runId) && !containsPrivateMemoryText(source.teacherText);
    } catch(error) {
      if (unavailable(error)) return false;
      throw error;
    }
  }

  return {permission, change, snapshot, witnessCurrent, dispatchCurrent, reviewQuote, revokeWitness};
}
