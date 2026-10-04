import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { withFileMutationQueue } from '@earendil-works/pi-coding-agent';
import type { XiaozhiChangeDecision } from '../../shared/xiaozhi-changes';
import { authorizedWorkspace, approvedFile, workspaceHash } from './workspace-authority';
import { prepareTextEdit, textProposalInput, changeText, MAX_CHANGE_BYTES } from './text-edit-proposal';
import { changeHash, createTextChangeState, publicTextChange, type PrivateTextChange } from './text-change-state';

type Ledger = ReturnType<typeof createTextChangeState>;
const signalCheck = (signal?: AbortSignal) => { if (signal?.aborted) throw new Error('cancelled'); };
function changeFile(root: string, raw: string): string {
  const segments = raw.split(/[\\/]/);
  if (!raw || raw.length > 500 || path.isAbsolute(raw) || /[:\x00-\x1f]/.test(raw)
    || segments.some(v => !v || v === '.' || v === '..' || /[. ]$/.test(v)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(v)
      || /^(\.pi|\.ssh)$/i.test(v)) || !/\.(md|txt)$/i.test(raw)) throw new Error('permission_denied');
  const file = approvedFile(root, raw);
  if (!fs.existsSync(path.dirname(file)) || !fs.lstatSync(path.dirname(file)).isDirectory()) throw new Error('not_found');
  return file;
}
function read(root: string, relative: string): Buffer | null {
  const file = changeFile(root, relative);
  if (!fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('permission_denied');
  if (stat.size > MAX_CHANGE_BYTES) throw new Error('too_large');
  const bytes = fs.readFileSync(file); changeText(bytes); return bytes;
}
function version(root: string, row: PrivateTextChange, which: 'before' | 'after') {
  const bytes = read(root, row.path), expected = which === 'before' ? row.beforeSha256 : row.afterSha256;
  return bytes === null ? expected === null : changeHash(bytes) === expected;
}

/** Durable local file effects. Tool registration, typed UI and teacher waits are separate. */
export function createTextChangeService(options: {
  state: Ledger; dataRoot: string; workspace: (sessionId: string) => Promise<string | null>;
  isCurrent: (sessionId: string, runId: string) => boolean;
  /** Main-only isolated fault cuts. Never supplied through IPC. */
  afterStage?: (stage: 'intent' | 'file' | 'undo-intent' | 'undo-file') => Promise<void>;
}) {
  const { state } = options;
  async function authority(sessionId: string, row?: PrivateTextChange) {
    const raw = await options.workspace(sessionId);
    if (!raw) throw new Error('permission_denied');
    const root = authorizedWorkspace(raw, options.dataRoot);
    if (row && (row.sessionId !== sessionId || workspaceHash(root) !== row.workspaceHash)) throw new Error('permission_denied');
    return root;
  }
  function current(row: PrivateTextChange, signal?: AbortSignal) {
    signalCheck(signal);
    if (!options.isCurrent(row.sessionId, row.runId)) throw new Error('permission_denied');
  }
  function writeVersion(root: string, row: PrivateTextChange, undo: boolean) {
    if (workspaceHash(authorizedWorkspace(root, options.dataRoot)) !== row.workspaceHash) throw new Error('permission_denied');
    if (!version(root, row, undo ? 'after' : 'before')) throw new Error('conflict');
    const file = changeFile(root, row.path), content = undo ? row.before : row.after;
    if (content === null) { fs.unlinkSync(file); return; } // Explicit undo of this exact new artifact.
    const temporary = path.join(path.dirname(file), `.xiaozhi-${randomUUID()}.tmp`);
    let handle: number | undefined;
    try {
      handle = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(handle, content); fs.fsyncSync(handle); fs.closeSync(handle); handle = undefined;
      // No await between last authority/version check and installation.
      if (workspaceHash(authorizedWorkspace(root, options.dataRoot)) !== row.workspaceHash) throw new Error('permission_denied');
      changeFile(root, row.path);
      if (!version(root, row, undo ? 'after' : 'before')) throw new Error('conflict');
      if (!undo && row.operation === 'create') {
        fs.linkSync(temporary, file); // Exclusive install: EEXIST cannot overwrite a competing creator.
        fs.unlinkSync(temporary);
      } else fs.renameSync(temporary, file);
    } finally {
      if (handle !== undefined) fs.closeSync(handle);
      try { fs.unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  async function owned(sessionId: string, id: string) {
    const row = await state.get(id);
    if (!row || row.sessionId !== sessionId) throw new Error('permission_denied');
    return row;
  }
  async function uncertain(row: PrivateTextChange, undo: boolean) {
    const latest = await state.get(row.id);
    if (latest?.state === (undo ? 'reverting' : 'executing')) await state.transition(latest, [latest.state], undo ? 'undo_uncertain' : 'uncertain');
  }
  return {
    async propose(sessionId: string, runId: string, callId: string, raw: unknown, signal?: AbortSignal) {
      signalCheck(signal);
      if (!options.isCurrent(sessionId, runId) || !callId || callId.length > 128) throw new Error('permission_denied');
      const input = textProposalInput(raw), root = await authority(sessionId), inputHash = changeHash(JSON.stringify(input));
      const existing = await state.call(sessionId, runId, callId);
      if (existing) {
        if (existing.inputHash !== inputHash || existing.workspaceHash !== workspaceHash(root)) throw new Error('conflict');
        return publicTextChange(existing); // A repeated call never executes or prepares a new version.
      }
      const before = read(root, input.path);
      if (input.operation === 'edit' ? before === null : before !== null) throw new Error(input.operation === 'edit' ? 'not_found' : 'conflict');
      const proposal = await prepareTextEdit(root, input, before, callId, signal);
      signalCheck(signal);
      if (!options.isCurrent(sessionId, runId) || root !== await authority(sessionId)) throw new Error('permission_denied');
      const row = await state.create({ sessionId, runId, callId, operation: input.operation,
        path: path.relative(root, changeFile(root, input.path)).replace(/\\/g, '/'), workspaceHash: workspaceHash(root), inputHash,
        before, beforeSha256: before === null ? null : changeHash(before), after: proposal.after,
        afterSha256: changeHash(proposal.after), diff: proposal.diff, patch: proposal.patch });
      // Cancel after proposal persistence must not leave a live grant.
      if (signal?.aborted || !options.isCurrent(sessionId, runId)) {
        await state.transition(row, ['pending'], 'interrupted'); throw new Error('cancelled');
      }
      return publicTextChange(row);
    },
    async review(sessionId: string, id: string) {
      const row = await owned(sessionId, id); const root = await authority(sessionId, row);
      changeFile(root, row.path);
      return { ...publicTextChange(row), before: row.before?.toString('utf8') ?? null, after: row.after.toString('utf8') };
    },
    async decision(input: XiaozhiChangeDecision) {
      if (!input || input.schemaVersion !== 'xiaozhi.change.v1' || !Number.isSafeInteger(input.revision) || input.revision < 0
        || Object.keys(input).some(key => !['schemaVersion', 'sessionId', 'changeId', 'revision', 'action'].includes(key))
        || !['approve', 'reject', 'verify', 'undo'].includes(input.action)) throw new Error('invalid_input');
      const row = await owned(input.sessionId, input.changeId);
      if (row.revision !== input.revision) throw new Error('conflict');
      const root = await authority(input.sessionId, row), file = changeFile(root, row.path);
      return withFileMutationQueue(file, async () => {
        const latest = await owned(input.sessionId, input.changeId);
        if (latest.revision !== input.revision) throw new Error('conflict');
        if (input.action === 'approve' || input.action === 'reject') {
          current(latest);
          if (latest.state !== 'pending') throw new Error('conflict');
          if (input.action === 'approve' && !version(root, latest, 'before')) return publicTextChange(await state.transition(latest, ['pending'], 'conflict'));
          return publicTextChange(await state.transition(latest, ['pending'], input.action === 'approve' ? 'approved' : 'rejected'));
        }
        if (input.action === 'verify') {
          if (!['uncertain', 'undo_uncertain'].includes(latest.state)) throw new Error('conflict');
          const undo = latest.state === 'undo_uncertain';
          const outcome = version(root, latest, undo ? 'before' : 'after') ? (undo ? 'reverted' : 'applied')
            : version(root, latest, undo ? 'after' : 'before') ? (undo ? 'applied' : 'interrupted') : (undo ? 'undo_conflict' : 'conflict');
          return publicTextChange(await state.transition(latest, [latest.state], outcome));
        }
        if (latest.state !== 'applied') throw new Error('conflict');
        if (!version(root, latest, 'after')) return publicTextChange(await state.transition(latest, ['applied'], 'undo_conflict'));
        const intent = await state.transition(latest, ['applied'], 'reverting');
        try {
          await options.afterStage?.('undo-intent');
          const currentRoot = await authority(input.sessionId, intent);
          if (root !== currentRoot) throw new Error('permission_denied');
          writeVersion(root, intent, true);
          await options.afterStage?.('undo-file');
          if (!version(root, intent, 'before')) throw new Error('conflict');
          return publicTextChange(await state.transition(intent, ['reverting'], 'reverted'));
        } catch (error) { await uncertain(intent, true); throw error; }
      });
    },
    async apply(sessionId: string, id: string, signal?: AbortSignal) {
      const row = await owned(sessionId, id), root = await authority(sessionId, row);
      current(row, signal);
      return withFileMutationQueue(changeFile(root, row.path), async () => {
        const latest = await owned(sessionId, id); current(latest, signal);
        if (latest.state !== 'approved') throw new Error('conflict');
        if (!version(root, latest, 'before')) return publicTextChange(await state.transition(latest, ['approved'], 'conflict'));
        const intent = await state.transition(latest, ['approved'], 'executing');
        try {
          await options.afterStage?.('intent');
          const currentRoot = await authority(sessionId, intent); current(intent, signal);
          if (root !== currentRoot) throw new Error('permission_denied');
          writeVersion(root, intent, false);
          await options.afterStage?.('file');
          if (!version(root, intent, 'after')) throw new Error('conflict');
          // Physical success is retained even if cancellation arrives after installation.
          return publicTextChange(await state.transition(intent, ['executing'], 'applied'));
        } catch (error) { await uncertain(intent, false); throw error; }
      });
    },
  };
}
