import fs from 'node:fs/promises';
import {constants, type BigIntStats} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {Sql} from '../session-state';
import type {TaskRecoveryInspection} from '../../../shared/xiaozhi-task-recovery';
import {createTaskState} from './task-state';
import {createEffectState} from '../effects/state';
import {createProviderSnapshotStore} from '../capabilities/provider-snapshots';
import {protocolHash} from '../capabilities/validation';
import {validApproval} from '../permissions/validation';
import {createModelSwitchState, validModelIdentity} from '../model-switch-state';
import {readNativeToolEntries, type NativeRunBinding} from '../events/native-tail';
import {NATIVE_SESSION_FORMAT_VERSION} from '../native-session-format';

type NativeState = TaskRecoveryInspection['native'];
type Lineage = {runId: string; generation: number}[];
type Snapshot = {file: string; bytes: Buffer; stat: BigIntStats; digest: string};
const sameFile = (left: string, right: string) => path.relative(path.resolve(left), path.resolve(right)) === '';
const identityMatches = (left: BigIntStats, right: BigIntStats) => right.isFile() && right.nlink === 1n
  && left.dev === right.dev && left.ino === right.ino && left.size === right.size
  && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;

async function checkedPath(root: string, value: string) {
  const base = path.resolve(root), file = path.resolve(base, value), relative = path.relative(base, file);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)
      || !file.endsWith('.jsonl')) throw Error('permission_denied');
  // Check every ancestor, including the caller-owned root, before opening a file.
  let current = file;
  const ancestors: string[] = [];
  for (;;) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const ancestor of ancestors.reverse()) {
    if ((await fs.lstat(ancestor)).isSymbolicLink()) throw Error('permission_denied');
  }
  if (!sameFile(await fs.realpath(file), file)) throw Error('permission_denied');
  return file;
}

async function readSnapshot(root: string, value: string): Promise<Snapshot> {
  const file = await checkedPath(root, value), before = await fs.lstat(file, {bigint: true});
  if (!before.isFile() || before.nlink !== 1n || before.size > 32n * 1048576n) throw Error('permission_denied');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat({bigint: true});
    if (!identityMatches(before, stat)) throw Error('source_changed');
    const bytes = Buffer.alloc(Number(stat.size));
    let used = 0;
    while (used < bytes.length) {
      const read = await handle.read(bytes, used, bytes.length - used, used);
      if (!read.bytesRead) throw Error('source_changed');
      used += read.bytesRead;
    }
    if (!identityMatches(stat, await handle.stat({bigint: true}))) throw Error('source_changed');
    const snapshot = {file, bytes, stat, digest: createHash('sha256').update(bytes).digest('hex')};
    await assertUnchanged(root, snapshot);
    return snapshot;
  } finally {await handle.close();}
}

async function assertUnchanged(root: string, snapshot: Snapshot) {
  const file = await checkedPath(root, snapshot.file);
  if (!identityMatches(snapshot.stat, await fs.lstat(file, {bigint: true}))) throw Error('source_changed');
}

function nativeHeaderId(bytes: Buffer): string | null {
  if (!bytes.length || bytes.at(-1) !== 10) return null;
  try {
    const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    let start = 0, headerId: string | null = null;
    // Validate the full bounded file without retaining a second parsed transcript.
    while (start < text.length) {
      const end = text.indexOf('\n', start), line = text.slice(start, end);
      start = end + 1;
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      if (headerId === null) {
        const version = row.version ?? 1;
        if (row.type !== 'session' || typeof row.id !== 'string' || !row.id
            || typeof row.cwd !== 'string' || !Number.isSafeInteger(version)
            || version < 1 || version > NATIVE_SESSION_FORMAT_VERSION) return null;
        headerId = row.id;
      }
    }
    return headerId;
  } catch {return null;}
}

async function retiredFiles(sql: Sql, root: string, sessionId: string, taskId: string, lineage: Lineage) {
  const retired = new Set<string>();
  for (const owner of lineage) {
    const row = (await sql.all('SELECT value_json FROM app_settings WHERE key=?', ['xiaozhi.native-rebuild.v1:' + owner.runId]))[0];
    if (!row) continue;
    try {
      const archive = JSON.parse(String(row.value_json)), document = archive.document;
      if (archive.schemaVersion !== 1 || document?.schemaVersion !== 1 || protocolHash(document) !== archive.hash
          || document.taskId !== taskId || document.owner?.sessionId !== sessionId
          || document.owner.runId !== owner.runId || document.owner.generation !== owner.generation
          || document.inspection?.taskId !== taskId || document.inspection.sessionId !== sessionId
          || document.inspection.canRebuildSession !== true
          || document.previousBinding?.conversation_id !== sessionId || typeof document.previousBinding.session_file !== 'string'
          || !document.replacement || !validModelIdentity(document.replacement) || document.replacement.sessionId !== sessionId) continue;
      const bound = (await sql.all('SELECT generation,binding_json FROM xiaozhi_native_run_bindings WHERE run_id=?', [owner.runId]))[0];
      const replacementBinding = bound ? JSON.parse(String(bound.binding_json)) : null;
      if (!replacementBinding || Number(bound.generation) !== owner.generation
          || replacementBinding.sessionId !== sessionId || replacementBinding.runId !== owner.runId
          || replacementBinding.generation !== owner.generation || typeof replacementBinding.file !== 'string'
          || !sameFile(path.resolve(root, replacementBinding.file), path.resolve(root, document.replacement.sessionFile))) continue;
      retired.add(path.resolve(root, document.previousBinding.session_file));
    } catch {/* Unverified archives never exempt a native binding. */}
  }
  return retired;
}

async function nativeInspection(sql: Sql, tables: Set<string>, root: string, sessionId: string, taskId: string, lineage: Lineage): Promise<NativeState> {
  if (!tables.has('xiaozhi_pi_session_bindings') || !tables.has('xiaozhi_native_run_bindings')) return {state: 'unbound', digest: null};
  const session = (await sql.all('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?', [sessionId]))[0];
  const bindings: {owner: Lineage[number]; row: Record<string, unknown>}[] = [];
  for (const owner of lineage) {
    const row = (await sql.all('SELECT * FROM xiaozhi_native_run_bindings WHERE run_id=?', [owner.runId]))[0];
    if (row) bindings.push({owner, row});
  }
  if (!session || !bindings.length) return {state: 'unbound', digest: null};
  if (typeof session.session_file !== 'string') return {state: 'changed', digest: null};
  let snapshot: Snapshot;
  try {snapshot = await readSnapshot(root, session.session_file);}
  catch (error) {return {state: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unavailable', digest: null};}
  const result = (state: NativeState['state']): NativeState => ({state, digest: snapshot.digest});
  const headerId = nativeHeaderId(snapshot.bytes);
  if (headerId === null) return result('invalid');
  if (![1, 2, 3, 4, 5].includes(Number(session.schema_version))) return result('changed');
  try {
    if (tables.has('xiaozhi_pi_model_state')) {
      // The original getter validates ModelIdentity and its current binding.
      const model = await createModelSwitchState(sql).current(sessionId);
      if (model && (model.nativeSessionId !== headerId || model.sessionFile !== session.session_file
          || model.model !== session.model)) return result('changed');
    }
    const retired = await retiredFiles(sql, root, sessionId, taskId, lineage);
    for (const {owner, row} of bindings) {
      const binding = JSON.parse(String(row.binding_json)) as NativeRunBinding;
      if (!binding || binding.sessionId !== sessionId || binding.runId !== owner.runId
          || binding.generation !== owner.generation || Number(row.generation) !== owner.generation
          || typeof binding.file !== 'string') return result('changed');
      const file = path.resolve(root, binding.file);
      const isCurrent = sameFile(file, snapshot.file);
      if (!isCurrent) {
        // Only a previously committed, hash-verified rebuild can explain old files.
        if (owner.runId === bindings.at(-1)!.owner.runId || ![...retired].some(old => sameFile(old, file))) return result('changed');
        continue;
      }
      const entries = await readNativeToolEntries(binding, root);
      const receipts = tables.has('xiaozhi_tool_receipts')
        ? await sql.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? ORDER BY start_sequence,call_id', [owner.runId]) : [];
      if (receipts.length > 1024 || receipts.some(receipt => Number(receipt.generation) !== owner.generation)) return result('changed');
      for (const entry of entries) {
        const receipt = receipts.find(item => item.call_id === entry.callId);
        if (!receipt || receipt.tool !== entry.tool || receipt.admitted === 0 && !entry.failed
            || receipt.result_digest && receipt.result_digest !== entry.digest
            || receipt.success !== null && Boolean(receipt.success) !== !entry.failed
            || receipt.native_entry_id && receipt.native_entry_id !== entry.id
            || receipt.native_digest && receipt.native_digest !== entry.digest) return result('changed');
      }
      if (receipts.some(receipt => (receipt.result_digest || receipt.native_digest || receipt.native_entry_id)
          && !entries.some(entry => entry.callId === receipt.call_id))) return result('changed');
    }
    await assertUnchanged(root, snapshot);
    return result('available');
  } catch (error) {
    try {await assertUnchanged(root, snapshot);} catch {return {state: 'unavailable', digest: null};}
    return result((error as NodeJS.ErrnoException).code ? 'unavailable' : 'changed');
  }
}

/** Read-only diagnosis. SQLite remains the Task/Effect authority, including when native history is damaged. */
export async function inspectTaskRecovery(input: {sql: Sql; nativeRoot: string; sessionId: string; taskId: string}): Promise<TaskRecoveryInspection> {
  const {sql, nativeRoot, sessionId, taskId} = input;
  const saved = await createTaskState(sql, {sanitize: async () => {throw Error('invalid_input');}}).inspection(taskId);
  if (!saved) throw Error('task_missing');
  if (saved.view.sessionId !== sessionId) throw Error('permission_denied');
  const tables = new Set((await sql.all("SELECT name FROM sqlite_master WHERE type='table'")).map(row => String(row.name)));
  const belongs = (runId: string, generation: number) => saved.lineage.some(owner => owner.runId === runId && owner.generation === generation);
  const effects = tables.has('xiaozhi_effects_v1') ? await createEffectState(sql).forTask(sessionId, taskId) : [];
  if (effects.some(effect => effect.owner.sessionId !== sessionId || effect.owner.taskId !== taskId
      || !belongs(effect.owner.runId, effect.owner.generation))) throw Error('effect_corrupt');
  const approvals: TaskRecoveryInspection['approvals'] = [];
  if (tables.has('ai_confirmation_items')) {
    const rows = await sql.all("SELECT id,session_id,run_id,payload_json FROM ai_confirmation_items WHERE session_id=? AND action_type='xiaozhi_permission_v2' AND json_extract(payload_json,'$.request.owner.taskId')=? ORDER BY rowid", [sessionId, taskId]);
    for (const row of rows) {
      const approval: unknown = JSON.parse(String(row.payload_json));
      if (!validApproval(approval) || approval.id !== row.id || approval.request.owner.sessionId !== row.session_id
          || approval.request.owner.taskId !== taskId || approval.request.owner.runId !== row.run_id
          || !belongs(approval.request.owner.runId, approval.request.owner.generation)) throw Error('permission_approval_corrupt');
      approvals.push({id: approval.id, revision: approval.revision, state: approval.state, action: approval.request.action});
    }
  }
  const snapshots = tables.has('xiaozhi_capability_snapshots_v1') ? await createProviderSnapshotStore(sql).history(taskId) : [];
  if (snapshots.some(snapshot => snapshot.sessionId !== sessionId || !belongs(snapshot.runId, snapshot.generation))) throw Error('capability_snapshot_corrupt');
  const native = await nativeInspection(sql, tables, nativeRoot, sessionId, taskId, saved.lineage);
  return {schemaVersion: 1, sessionId, taskId, taskRevision: saved.view.revision,
    requirementsVersion: saved.view.requirementsVersion, checkpointId: saved.checkpoint?.id ?? null, native,
    canRebuildSession: !['active', 'completed', 'ended'].includes(saved.view.state) && !['available', 'unbound'].includes(native.state),
    unknownEffects: effects.filter(effect => ['intent', 'executing', 'unknown', 'failed'].includes(effect.state))
      .map(effect => ({id: effect.id, revision: effect.revision, state: effect.state})),
    approvals, providerSnapshots: snapshots.map(snapshot => ({id: snapshot.snapshotId, capabilityId: snapshot.capabilityId,
      providerId: snapshot.selection.providerId, version: snapshot.selection.providerVersion, hash: snapshot.providerHash})), automaticReplay: false};
}
