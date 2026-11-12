import { randomUUID } from 'node:crypto';
import type { Sql } from '../session-state';
import type { PermissionProfile, PermissionMode, ScopeGrant, PermissionScope, PermissionApproval, PermissionRequest, PermissionDecision, PermissionOwner } from '../../../shared/xiaozhi-permissions';
import { permissionHash, requestDigest, validProfile, validGrant, validApproval, validScope, snapshotRequest, sessionId as validSession } from './validation';
import { filesystemScope } from './resources';

const profiles = 'xiaozhi_permission_profiles_v1';
const grants = 'xiaozhi_permission_grants_v1';
const audit = 'xiaozhi_permission_audit_v1';
const approvalAction = 'xiaozhi_permission_v2';
const now = () => new Date().toISOString();

export function createPermissionStore(sql: Sql) {
  function transaction<T>(work: (connection: Sql) => Promise<T>) {
    if (!sql.transaction) throw Error('configuration');
    return sql.transaction(work);
  }

  async function append(work: Sql, sessionId: string, kind: string, reference: string, metadata: unknown) {
    await work.run(`INSERT INTO ${audit}(id,session_id,kind,reference,metadata_json,created_at) VALUES(?,?,?,?,?,?)`,
      ['xiaudit_' + randomUUID(), sessionId, kind, reference, JSON.stringify(metadata), now()]);
  }

  async function profile(work: Sql, sessionId: string): Promise<PermissionProfile> {
    if (!validSession(sessionId)) throw Error('invalid_input');
    const row = (await work.all(`SELECT * FROM ${profiles} WHERE session_id=?`, [sessionId]))[0];
    if (!row) return {schemaVersion: 1, sessionId, revision: 1, mode: 'request', updatedAt: '1970-01-01T00:00:00.000Z'};
    const value = JSON.parse(String(row.document_json));
    if (!validProfile(value) || value.sessionId !== sessionId || value.revision !== row.revision
        || permissionHash(value) !== row.document_hash) throw Error('permission_state_corrupt');
    return value;
  }

  async function readGrants(work: Sql, sessionId: string): Promise<ScopeGrant[]> {
    const rows = await work.all(`SELECT * FROM ${grants} WHERE session_id=? ORDER BY created_at,grant_id`, [sessionId]);
    return rows.map(row => {
      const value = JSON.parse(String(row.document_json));
      if (!validGrant(value) || permissionHash(value) !== row.document_hash
          || value.grantId !== row.grant_id || value.sessionId !== sessionId || value.taskId !== row.task_id
          || value.revision !== row.revision || (value.revokedAt !== null) !== (row.revoked === 1)) {
        throw Error('permission_state_corrupt');
      }
      return value;
    });
  }

  function parseApproval(row: Record<string, unknown>): PermissionApproval {
    const value = JSON.parse(String(row.payload_json));
    if (!validApproval(value) || value.id !== row.id || value.request.owner.sessionId !== row.session_id
        || value.request.owner.runId !== row.run_id) throw Error('permission_approval_corrupt');
    return value;
  }

  async function readApprovals(work: Sql, sessionId: string) {
    return (await work.all('SELECT * FROM ai_confirmation_items WHERE action_type=? AND session_id=? ORDER BY created_at,id',
      [approvalAction, sessionId])).map(parseApproval);
  }

  async function writeApproval(work: Sql, previous: PermissionApproval, next: PermissionApproval) {
    if (!work.change || !validApproval(next) || next.revision !== previous.revision + 1) throw Error('configuration');
    const status = next.state === 'pending' ? 'pending' : next.state === 'rejected' ? 'rejected'
      : ['approved', 'executing', 'executed'].includes(next.state) ? 'confirmed' : 'failed';
    const changed = await work.change(`UPDATE ai_confirmation_items SET payload_json=?,status=?,updated_at=?
      WHERE id=? AND action_type=? AND payload_json=?`,
      [JSON.stringify(next), status, next.updatedAt, previous.id, approvalAction, JSON.stringify(previous)]);
    if (changed !== 1) throw Error('permission_revision_conflict');
    await append(work, next.request.owner.sessionId, 'approval_' + next.state, next.id,
      {requestDigest: next.requestDigest, revision: next.revision, owner: next.admittedOwner || next.request.owner});
  }

  async function issue(work: Sql, sessionId: string, scopes: PermissionScope[], provenance: ScopeGrant['provenance'], taskId: string | null, expiresAt: string | null) {
    const created: ScopeGrant[] = [];
    for (const scope of scopes) {
      const item: ScopeGrant = {schemaVersion: 1, grantId: 'xigrant_' + randomUUID(), revision: 1,
        sessionId, taskId, scope: structuredClone(scope), provenance, createdAt: now(), expiresAt, revokedAt: null};
      if (!validGrant(item)) throw Error('invalid_input');
      await work.run(`INSERT INTO ${grants}(grant_id,session_id,task_id,revision,revoked,document_json,document_hash,created_at)
        VALUES(?,?,?,?,0,?,?,?)`, [item.grantId, sessionId, taskId, item.revision, JSON.stringify(item), permissionHash(item), item.createdAt]);
      await append(work, sessionId, 'grant_issued', item.grantId, {provenance, scopeHash: permissionHash(scope), taskId});
      created.push(item);
    }
    return created;
  }

  return {
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS ${profiles}(session_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,document_json TEXT NOT NULL,document_hash TEXT NOT NULL)`);
      await sql.run(`CREATE TABLE IF NOT EXISTS ${grants}(grant_id TEXT PRIMARY KEY,session_id TEXT NOT NULL,task_id TEXT,revision INTEGER NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,document_json TEXT NOT NULL,document_hash TEXT NOT NULL,created_at TEXT NOT NULL)`);
      await sql.run(`CREATE INDEX IF NOT EXISTS xiaozhi_permission_grants_owner ON ${grants}(session_id,task_id,revoked)`);
      await sql.run(`CREATE TABLE IF NOT EXISTS ${audit}(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,kind TEXT NOT NULL,reference TEXT NOT NULL,
        metadata_json TEXT NOT NULL,created_at TEXT NOT NULL)`);
      await sql.run(`CREATE UNIQUE INDEX IF NOT EXISTS xiaozhi_permission_approval_request ON ai_confirmation_items(session_id,
        json_extract(payload_json,'$.request.owner.taskId'),json_extract(payload_json,'$.requestDigest')) WHERE action_type='${approvalAction}'`);
    },
    profile: (sessionId: string) => profile(sql, sessionId),
    grants: (sessionId: string) => readGrants(sql, sessionId),
    async grantsForServer(serverId: string) {
      const sessions = await sql.all(`SELECT DISTINCT session_id FROM ${grants} WHERE json_extract(document_json,'$.scope.kind')='mcp'
        AND json_extract(document_json,'$.scope.serverId')=?`, [serverId]);
      const groups = await Promise.all(sessions.map(row => readGrants(sql, String(row.session_id))));
      return groups.flat().filter(grant => grant.scope.kind === 'mcp' && grant.scope.serverId === serverId && !grant.revokedAt);
    },
    async runtimeReceipts(version: string): Promise<{manifestHash: string; helperHash: string}[]> {
      const rows = await sql.all(`SELECT session_id,metadata_json FROM ${audit} WHERE kind='permission_runtime_ready' AND reference=?`, [version]);
      return rows.map(row => {
        const value = JSON.parse(String(row.metadata_json));
        if (!value || value.owner?.sessionId !== row.session_id || !/^[a-f0-9]{64}$/u.test(value.manifestHash)
            || !/^[a-f0-9]{64}$/u.test(value.helperHash)) throw Error('permission_state_corrupt');
        return {manifestHash: value.manifestHash, helperHash: value.helperHash};
      });
    },
    approvals: (sessionId: string) => readApprovals(sql, sessionId),
    async view(sessionId: string) {
      return transaction(async work => ({schemaVersion: 1 as const, profile: await profile(work, sessionId),
        grants: await readGrants(work, sessionId), approvals: await readApprovals(work, sessionId)}));
    },
    async setMode(sessionId: string, revision: number, mode: PermissionMode) {
      return transaction(async work => {
        const previous = await profile(work, sessionId);
        if (previous.revision !== revision) throw Error('permission_revision_conflict');
        const next: PermissionProfile = {...previous, revision: revision + 1, mode, updatedAt: now()};
        if (!validProfile(next)) throw Error('invalid_input');
        await work.run(`INSERT INTO ${profiles}(session_id,revision,document_json,document_hash) VALUES(?,?,?,?)
          ON CONFLICT(session_id) DO UPDATE SET revision=excluded.revision,document_json=excluded.document_json,document_hash=excluded.document_hash`,
          [sessionId, next.revision, JSON.stringify(next), permissionHash(next)]);
        await append(work, sessionId, 'profile_changed', sessionId, {mode, revision: next.revision});
        return next;
      });
    },
    async issue(sessionId: string, scopes: PermissionScope[], provenance: ScopeGrant['provenance'], taskId: string | null = null, expiresAt: string | null = null) {
      if (!validSession(sessionId) || !scopes.length || scopes.length > 32 || !scopes.every(validScope)) throw Error('invalid_input');
      return transaction(work => issue(work, sessionId, scopes, provenance, taskId, expiresAt));
    },
    async importWorkspace(sessionId: string, scope: PermissionScope) {
      return transaction(async work => {
        const source = (await work.all('SELECT * FROM xiaozhi_pi_workspaces WHERE conversation_id=?', [sessionId]))[0];
        if (!validSession(sessionId) || !source || Number(source.schema_version) !== 1 || scope.kind !== 'filesystem'
            || scope.actions.length !== 1 || scope.actions[0] !== 'read') throw Error('permission_denied');
        const verified = filesystemScope(String(source.path), ['read']);
        if (permissionHash(verified) !== permissionHash(scope)) throw Error('permission_denied');
        const reference = 'legacy-workspace:' + permissionHash({sessionId, path: source.path, updatedAt: source.updated_at});
        const existing = await readGrants(work, sessionId);
        const matching = existing.filter(item => item.provenance.kind === 'legacy_workspace' && item.provenance.reference === reference);
        if (matching.length) return matching;
        return issue(work, sessionId, [scope], {kind: 'legacy_workspace', reference}, null, null);
      });
    },
    async revoke(sessionId: string, grantId: string, revision: number) {
      return transaction(async work => {
        const previous = (await readGrants(work, sessionId)).find(item => item.grantId === grantId);
        if (!previous) throw Error('permission_denied');
        if (previous.revokedAt) return previous;
        if (previous.revision !== revision || !work.change) throw Error('permission_revision_conflict');
        const next = {...previous, revision: previous.revision + 1, revokedAt: now()};
        if (await work.change(`UPDATE ${grants} SET revision=?,revoked=1,document_json=?,document_hash=? WHERE grant_id=? AND revision=?`,
          [next.revision, JSON.stringify(next), permissionHash(next), grantId, revision]) !== 1) throw Error('permission_revision_conflict');
        for (const approval of await readApprovals(work, sessionId)) {
          if (['pending', 'approved'].includes(approval.state) && approval.grantRefs.some(ref => ref.grantId === grantId)) {
            await writeApproval(work, approval, {...approval, revision: approval.revision + 1, state: 'invalidated', invalidatedReason: 'grant_revoked', updatedAt: now()});
          }
        }
        await append(work, sessionId, 'grant_revoked', grantId, {revision: next.revision});
        return next;
      });
    },
    async request(raw: PermissionRequest, decision: PermissionDecision) {
      const request = snapshotRequest(raw);
      const hash = requestDigest(request);
      if (decision.requestDigest !== hash) throw Error('invalid_input');
      return transaction(async work => {
        const existing = (await readApprovals(work, request.owner.sessionId))
          .find(item => item.request.owner.taskId === request.owner.taskId && item.requestDigest === hash);
        if (existing) return existing;
        const item: PermissionApproval = {schemaVersion: 2, id: 'confirm_' + randomUUID(), revision: 1, request,
          requestDigest: hash, permissionSnapshotHash: decision.permissionSnapshotHash, grantRefs: decision.grantRefs,
          state: 'pending', scope: 'operation', createdAt: now(), updatedAt: now()};
        if (!validApproval(item)) throw Error('invalid_input');
        await work.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,action_type,status,title,description,preview_md,payload_json,created_at,updated_at)
          VALUES(?,?,?,?,'pending',?,'','',?,?,?)`, [item.id, request.owner.runId, request.owner.sessionId, approvalAction,
          request.purpose.slice(0, 120), JSON.stringify(item), item.createdAt, item.updatedAt]);
        await append(work, request.owner.sessionId, 'approval_pending', item.id, {requestDigest: hash});
        return item;
      });
    },
    async approval(sessionId: string, id: string) {
      return (await readApprovals(sql, sessionId)).find(item => item.id === id) || null;
    },
    async transition(sessionId: string, id: string, revision: number, from: PermissionApproval['state'][], to: PermissionApproval['state'],
      fields: Pick<Partial<PermissionApproval>, 'scope' | 'invalidatedReason' | 'admittedOwner'> = {}) {
      return transaction(async work => {
        const previous = (await readApprovals(work, sessionId)).find(item => item.id === id);
        if (!previous || previous.revision !== revision || !from.includes(previous.state)) throw Error('permission_revision_conflict');
        const next = {...previous, ...fields, state: to, revision: revision + 1, updatedAt: now()};
        await writeApproval(work, previous, next);
        return next;
      });
    },
    async consume(sessionId: string, id: string, revision: number, owner: PermissionOwner, snapshotHash: string) {
      return transaction(async work => {
        const previous = (await readApprovals(work, sessionId)).find(item => item.id === id);
        if (!previous || previous.state !== 'approved' || previous.revision !== revision
            || previous.permissionSnapshotHash !== snapshotHash || previous.request.owner.taskId !== owner.taskId
            || owner.sessionId !== sessionId || Date.parse(previous.request.expiresAt) <= Date.now()) throw Error('permission_denied');
        const next: PermissionApproval = {...previous, state: 'executing', admittedOwner: owner, revision: revision + 1, updatedAt: now()};
        await writeApproval(work, previous, next);
        return next;
      });
    },
    async decide(sessionId: string, id: string, revision: number, decision: 'approve' | 'reject',
      scope: PermissionApproval['scope'], expectedSnapshot: string) {
      return transaction(async work => {
        const previous = (await readApprovals(work, sessionId)).find(item => item.id === id);
        if (!previous || previous.revision !== revision || previous.state !== 'pending'
            || previous.permissionSnapshotHash !== expectedSnapshot) throw Error('permission_revision_conflict');
        if (Date.parse(previous.request.expiresAt) <= Date.now()) throw Error('permission_expired');
        const next: PermissionApproval = {...previous, scope, state: decision === 'approve' ? 'approved' : 'rejected',
          revision: revision + 1, updatedAt: now()};
        if (decision === 'approve' && scope !== 'operation') {
          await issue(work, sessionId, previous.request.scopes, {kind: 'approval', reference: id},
            scope === 'task' ? previous.request.owner.taskId : null, scope === 'task' ? previous.request.expiresAt : null);
        }
        await writeApproval(work, previous, next);
        return next;
      });
    },
    async recover() {
      const rows = await sql.all('SELECT * FROM ai_confirmation_items WHERE action_type=?', [approvalAction]);
      for (const row of rows) {
        const item = parseApproval(row);
        if (item.state === 'executing') await this.transition(item.request.owner.sessionId, item.id, item.revision, ['executing'], 'uncertain');
      }
    },
    async auditOnce(sessionId: string, kind: string, reference: string, metadata: unknown) {
      const id = 'xiaudit_' + permissionHash({sessionId, kind, reference, metadata});
      await sql.run(`INSERT OR IGNORE INTO ${audit}(id,session_id,kind,reference,metadata_json,created_at) VALUES(?,?,?,?,?,?)`,
        [id, sessionId, kind, reference, JSON.stringify(metadata), now()]);
    },
    audit: (sessionId: string, kind: string, reference: string, metadata: unknown) => append(sql, sessionId, kind, reference, metadata)
  };
}
export type PermissionStore = ReturnType<typeof createPermissionStore>;
