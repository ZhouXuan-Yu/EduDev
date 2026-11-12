import fs from 'node:fs';
import path from 'node:path';
import type { OmniEduStore } from '../db';
import type { OfficeCopyApproval } from '../../shared/office-tools';
import type { XiaozhiActionResult, XiaozhiAgentEventPayload, XiaozhiDecisionInput } from '../../shared/xiaozhi-agent';
import { publicApproval } from './persistent-state';
import { authorizedWorkspace, verifyCopy, workspaceHash } from './workspace-authority';
import { currentPermission, assertCurrentPermission } from './permissions/current';
import type {PrivateApproval} from './persistent-state';
import type {PermissionApproval} from '../../shared/xiaozhi-permissions';

/** Hana frozen copy input enters a persistent teacher decision; no second loop. */
export function createPiApprovalCoordinator(options: { store: OmniEduStore; dataRoot: string;
  isCurrent: (session: string, run: string) => boolean;
  legacyBridge?: (row: PrivateApproval, decision?: 'approve' | 'reject') => Promise<PermissionApproval>;
  legacyValidate?: (row: PrivateApproval) => Promise<unknown>;
  resumedLegacyId?: (sessionId: string, runId: string) => string | undefined;
  emit: (session: string, run: string, value: XiaozhiAgentEventPayload) => void }) {
  const state = options.store.xiaozhiState;
  const waiting = new Map<string, { session: string; run: string; resolve: (approved: boolean) => void }>();
  const notify = async (id: string) => { const row = await state.getApproval(id); if (row) options.emit(row.sessionId, row.runId, { kind: 'approval', approval: publicApproval(row) }); };
  const locate = async (session: string, run: string, copy: OfficeCopyApproval) => {
    const row = (await state.approvals(session)).find(item => item.runId === run && item.callId === copy.callId);
    if (!row || row.source !== copy.source || row.target !== copy.target || row.sourceSha256 !== copy.sourceSha256) throw new Error('permission_denied');
    const folder = await state.workspace(session);
    if (!folder || workspaceHash(authorizedWorkspace(folder.path, options.dataRoot)) !== row.workspaceHash) throw new Error('permission_denied');
    return row;
  };
  return {
    async migrateLegacy(sessionId: string) {
      if (!options.legacyBridge) return;
      for (const row of await state.approvals(sessionId)) {
        if (!['pending', 'approved'].includes(row.state) || waiting.has(row.id)) continue;
        try {await options.legacyBridge(row);}
        catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (['permission_denied', 'source_changed', 'not_found'].includes(code)) {
            await state.transition(row.id, [row.state], 'interrupted');
          }
        }
      }
    },
    callbacks(session: string, run: string, root: string) {
      return {
        approveCopy: async (copy: OfficeCopyApproval, signal: AbortSignal) => {
          if (signal.aborted || !options.isCurrent(session, run)) return false;
          const item = await state.createApproval(session, run, copy, workspaceHash(root));
          if (signal.aborted || !options.isCurrent(session, run)) { await state.invalidate(run); return false; }
          const permission = currentPermission();
          if (permission) {
            await permission.assert();
            if (item.state === 'pending') await state.transition(item.id, ['pending'], 'approved');
            return (await state.getApproval(item.id))?.state === 'approved';
          }
          if (item.state !== 'pending') return false;
          // Install waiter before publishing the actionable card.
          return new Promise<boolean>(resolve => {
            const finish = (value: boolean) => { waiting.delete(item.id); signal.removeEventListener('abort', cancel); resolve(value); };
            const cancel = () => {
              const update = signal.reason === 'app_shutdown' ? Promise.resolve() : state.invalidate(run);
              void update.then(() => notify(item.id)).catch(() => undefined).finally(() => finish(false));
            };
            waiting.set(item.id, { session, run, resolve: finish }); signal.addEventListener('abort', cancel, { once: true });
            if (signal.aborted) cancel(); else void notify(item.id).catch(() => finish(false));
          });
        },
        beforeCopy: async (copy: OfficeCopyApproval, signal: AbortSignal) => {
          await assertCurrentPermission();
          if (signal.aborted || !options.isCurrent(session, run)) return false;
          const row = await locate(session, run, copy);
          if (signal.aborted || !options.isCurrent(session, run)) return false;
          const claimed = await state.transition(row.id, ['approved'], 'executing');
          if (claimed) await notify(row.id);
          return claimed && !signal.aborted && options.isCurrent(session, run);
        },
        afterCopy: async (copy: OfficeCopyApproval, succeeded: boolean) => {
          const row = await locate(session, run, copy);
          // Explicit isolated fault cut: physical copy finished, SQLite outcome not committed.
          if (succeeded && process.env.OMNI_EDU_E2E_DIALOG_MODE === '1' && process.env.OMNI_EDU_E2E_PI_AFTER_COPY_DELAY_MS) {
            fs.writeFileSync(path.join(options.dataRoot, '.e2e-pi-copy-committed'), row.id);
            await new Promise(resolve => setTimeout(resolve, Math.min(30000, Math.max(0, Number(process.env.OMNI_EDU_E2E_PI_AFTER_COPY_DELAY_MS) || 0))));
          }
          if (!await state.transition(row.id, ['executing'], succeeded ? 'executed' : 'failed')) throw new Error('permission_denied');
          const legacyId = options.resumedLegacyId?.(session, run);
          const legacy = legacyId ? await state.getApproval(legacyId) : null;
          if (succeeded && legacy?.state === 'approved' && legacy.source === copy.source && legacy.target === copy.target
              && legacy.sourceSha256 === copy.sourceSha256) await state.transition(legacy.id, ['approved'], 'executed');
          await notify(row.id);
        },
      };
    },
    async decide(input: XiaozhiDecisionInput): Promise<XiaozhiActionResult> {
      if (!input || typeof input !== 'object' || Object.keys(input).some(key => !['sessionId', 'approvalId', 'decision'].includes(key))
        || !/^aisession_[a-f0-9-]{36}$/i.test(input.sessionId) || !/^confirm_[a-f0-9-]{36}$/i.test(input.approvalId)
        || !['approve', 'reject', 'verify'].includes(input.decision)) return { ok: false, error: 'invalid_input' };
      try {
        const row = await state.getApproval(input.approvalId);
        if (!row || row.sessionId !== input.sessionId) return { ok: false, error: 'permission_denied' };
        if (input.decision === 'verify') {
          if (row.state === 'verified') return { ok: true };
          if (row.state !== 'uncertain') return { ok: false, error: 'permission_denied' };
          const folder = await state.workspace(row.sessionId);
          if (!folder) return { ok: false, error: 'permission_denied' };
          const root = authorizedWorkspace(folder.path, options.dataRoot);
          if (workspaceHash(root) !== row.workspaceHash) return { ok: false, error: 'permission_denied' };
          if (!await state.transition(row.id, ['uncertain'], verifyCopy(root, row.target, row.sourceSha256) ? 'verified' : 'failed')) return { ok: false, error: 'permission_denied' };
          await notify(row.id); return { ok: true };
        }
        const desired = input.decision === 'approve' ? 'approved' : 'rejected';
        if (row.state === desired || (desired === 'approved' && ['executing', 'executed', 'verified'].includes(row.state))) return { ok: true };
        const waiter = waiting.get(row.id);
        if (!waiter && options.legacyBridge && row.state === 'pending') {
          try {await options.legacyBridge(row, input.decision as 'approve' | 'reject');}
          catch (error) {
            if (!(error instanceof Error) || error.message !== 'task_source_required' || !options.legacyValidate) throw error;
            await options.legacyValidate(row);
          }
          if (!await state.transition(row.id, ['pending'], desired)) return {ok: false, error: 'permission_denied'};
          await notify(row.id);
          return {ok: true};
        }
        if (row.state !== 'pending' || !waiter || waiter.run !== row.runId || !options.isCurrent(row.sessionId, row.runId)) return { ok: false, error: 'permission_denied' };
        const folder = await state.workspace(row.sessionId);
        if (!folder || workspaceHash(authorizedWorkspace(folder.path, options.dataRoot)) !== row.workspaceHash) return { ok: false, error: 'permission_denied' };
        if (!await state.transition(row.id, ['pending'], desired)) return { ok: false, error: 'permission_denied' };
        await notify(row.id);
        // Stop may have arrived while the SQLite decision was committing.
        waiter.resolve(input.decision === 'approve' && options.isCurrent(row.sessionId, row.runId));
        return { ok: true };
      } catch { return { ok: false, error: 'configuration' }; }
    },
    async cancel(run: string, preservePending = false) {
      if (!preservePending) await state.invalidate(run);
      for (const [id, waiter] of waiting) if (waiter.run === run) { await notify(id); waiter.resolve(false); }
    },
  };
}
