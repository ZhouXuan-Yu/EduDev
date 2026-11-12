import type { PermissionOwner, PermissionScope, PermissionView, PermissionSettingsInput, PermissionGrantInput, PermissionApprovalInput, PermissionRequest } from '../../../shared/xiaozhi-permissions';
import type { PermissionStore } from './store';
import { createPermissionEngine } from './engine';
import { filesystemScope, scopeCovers, digest } from './resources';
import { permissionHash, plain, exact, text, validScope, sessionId as validSession } from './validation';
import { createToolPermissionRuntime, systemPowerShell } from './tool-runtime';
import { authorizedWorkspace } from '../workspace-authority';
import { PERMISSION_MODES } from '../../../shared/xiaozhi-permissions';
import fs from 'node:fs';
import path from 'node:path';
import {fileVersion} from '../workspace-files';
import {checkedFile} from './resources';
import {permissionRequestSummary} from './summary';

export function createPermissionService(options: {
  store: PermissionStore;
  dataRoot: string;
  owner: (sessionId: string) => PermissionOwner | null;
  archived: (sessionId: string) => Promise<boolean>;
  workspace: (sessionId: string) => Promise<{path: string}>;
  requirementsVersion?: (sessionId: string) => number;
  task?: (taskId: string) => Promise<{sessionId: string; requirementsVersion: number; state: string} | null>;
  verifyProvider?: (provider: NonNullable<PermissionRequest['provider']>) => Promise<boolean>;
  process?: () => Promise<{executable: string; executableHash: string}>;
  runtimeScope?: () => PermissionScope;
  needsRuntimeConfiguration?: () => Promise<boolean>;
  validateTaskOwner?: (owner: PermissionOwner) => Promise<boolean>;
  legacyApprovals?: (sessionId: string) => Promise<NonNullable<PermissionView['legacyApprovals']>>;
  sanitizeSummary?: (text: string) => Promise<string>;
  notify?: (sessionId: string) => void | Promise<void>;
}) {
  const engine = createPermissionEngine({store: options.store,
    current: async owner => permissionHash(options.owner(owner.sessionId)) === permissionHash(owner)
      && (!options.validateTaskOwner || await options.validateTaskOwner(owner)), notify: options.notify,
    verifyRequest: async request => {
      if (options.task) {
        const task = await options.task(request.owner.taskId);
        if (!task || task.sessionId !== request.owner.sessionId || task.requirementsVersion !== request.requirementsVersion || task.state === 'cancelled') return false;
      }
      if (request.provider && options.verifyProvider && !await options.verifyProvider(request.provider)) return false;
      for (const file of request.files) {
        const scope = request.scopes.find(scope => scope.kind === 'filesystem' && scope.root === file.root);
        if (!scope || scope.kind !== 'filesystem') return false;
        try {
          const filename = checkedFile(scope, path.resolve(file.root, file.path), 'read');
          if (file.version === null ? fs.existsSync(filename) : !fs.existsSync(filename) || fileVersion(fs.lstatSync(filename)) !== file.version) return false;
          if (file.sha256 !== null) {
            const read = filesystemScope(scope.root, ['read']);
            const grants = await options.store.grants(request.owner.sessionId);
            if (!grants.some(grant => !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.now())
                && (grant.taskId === null || grant.taskId === request.owner.taskId) && scopeCovers(grant.scope, read))) return false;
            if (digest(fs.readFileSync(filename)) !== file.sha256) return false;
          }
        } catch {return false;}
      }
      return true;
    }});

  async function checkSession(sessionId: string) {
    if (!validSession(sessionId) || await options.archived(sessionId)) throw Error('permission_denied');
  }

  async function normalize(scope: PermissionScope) {
    if (!validScope(scope)) throw Error('invalid_input');
    if (scope.kind === 'filesystem') {
      const verified = filesystemScope(authorizedWorkspace(scope.root, options.dataRoot), scope.actions);
      if (permissionHash(verified) !== permissionHash(scope)) throw Error('permission_denied');
    }
    if (scope.kind === 'process') {
      const runtime = await (options.process || (async () => systemPowerShell()))();
      if (scope.executable !== runtime.executable || scope.executableHash !== runtime.executableHash
          || scope.backend !== 'appcontainer') throw Error('permission_denied');
      authorizedWorkspace(scope.workspace, options.dataRoot);
    }
    return structuredClone(scope);
  }

  async function summarize(action: string, input: unknown) {
    const frozen = permissionRequestSummary(action, input);
    return options.sanitizeSummary ? (await options.sanitizeSummary(frozen)).slice(0, 4096) : frozen;
  }
  return {
    engine,
    summarize,
    async ensureWorkspace(sessionId: string, root: string, legacy: boolean) {
      await checkSession(sessionId);
      const scope = filesystemScope(root, legacy ? ['read'] : ['read', 'write', 'delete']);
      if (legacy) return options.store.importWorkspace(sessionId, scope);
      const reference = 'application-output:' + permissionHash({sessionId, root, identity: scope.identity});
      const previous = (await options.store.grants(sessionId)).filter(grant => grant.provenance.reference === reference);
      if (previous.length) return previous;
      return options.store.issue(sessionId, [scope], {kind: 'teacher', reference});
    },
    async assertWorkspaceRead(sessionId: string, root: string) {
      await checkSession(sessionId);
      const requested = filesystemScope(root, ['read']);
      const current = options.owner(sessionId);
      const grants = await options.store.grants(sessionId);
      if (!grants.some(grant => !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.now())
          && (grant.taskId === null || grant.taskId === current?.taskId) && scopeCovers(grant.scope, requested))) {
        throw Error('permission_denied');
      }
    },
    async view(sessionId: string): Promise<PermissionView> {
      await checkSession(sessionId);
      await options.workspace(sessionId);
      await engine.revalidate(sessionId);
      return {...await options.store.view(sessionId), ...(options.legacyApprovals ? {legacyApprovals: await options.legacyApprovals(sessionId)} : {})};
    },
    async setMode(raw: PermissionSettingsInput) {
      if (!plain(raw) || !exact(raw, ['sessionId', 'revision', 'mode']) || !validSession(raw.sessionId)
          || !Number.isSafeInteger(raw.revision) || !PERMISSION_MODES.includes(raw.mode)) throw Error('invalid_input');
      await checkSession(raw.sessionId);
      const root = (await options.workspace(raw.sessionId)).path;
      const profile = await options.store.setMode(raw.sessionId, raw.revision, raw.mode);
      if (raw.mode !== 'request') {
        const scopes: PermissionScope[] = [filesystemScope(root, ['read', 'write', 'delete'])];
        if (raw.mode === 'fullAccess' || raw.mode === 'approveForMe') {
          scopes.push({kind: 'process', backend: 'appcontainer', ...await (options.process || (async () => systemPowerShell()))(), workspace: root});
          if (options.runtimeScope) scopes.push(options.runtimeScope());
        }
        await options.store.issue(raw.sessionId, scopes, {kind: 'teacher', reference: 'profile:' + profile.revision});
      }
      return options.store.view(raw.sessionId);
    },
    async issue(raw: PermissionGrantInput) {
      if (!plain(raw) || !exact(raw, ['sessionId', 'scopes', 'taskId', 'expiresAt']) || !validSession(raw.sessionId)
          || !Array.isArray(raw.scopes) || !raw.scopes.length || raw.scopes.length > 32 || !raw.scopes.every(validScope)
          || raw.taskId !== null && raw.taskId !== options.owner(raw.sessionId)?.taskId
          || raw.expiresAt !== null && (!text(raw.expiresAt) || !Number.isFinite(Date.parse(raw.expiresAt)) || Date.parse(raw.expiresAt) <= Date.now())) {
        throw Error('invalid_input');
      }
      await checkSession(raw.sessionId);
      const scopes = await Promise.all(raw.scopes.map(normalize));
      return options.store.issue(raw.sessionId, scopes, {kind: 'teacher', reference: 'explicit:' + permissionHash(scopes)}, raw.taskId, raw.expiresAt);
    },
    async decide(raw: PermissionApprovalInput) {
      if (!plain(raw) || !exact(raw, ['sessionId', 'approvalId', 'revision', 'decision', 'scope'])
          || !validSession(raw.sessionId) || !text(raw.approvalId) || !Number.isSafeInteger(raw.revision)
          || !['approve', 'reject'].includes(raw.decision) || !['operation', 'task', 'persistent'].includes(raw.scope)) throw Error('invalid_input');
      await checkSession(raw.sessionId);
      return engine.decide(raw);
    },
    async revoke(raw: {sessionId: string; grantId: string; revision: number}) {
      if (!plain(raw) || !exact(raw, ['sessionId', 'grantId', 'revision']) || !validSession(raw.sessionId)
          || !text(raw.grantId) || !Number.isSafeInteger(raw.revision)) throw Error('invalid_input');
      await checkSession(raw.sessionId);
      return engine.revoke(raw.sessionId, raw.grantId, raw.revision);
    },
    forRun(sessionId: string, runId: string) {
      return createToolPermissionRuntime({engine, workspace: () => options.workspace(sessionId), process: options.process,
        summarize,
        needsRuntimeConfiguration: options.needsRuntimeConfiguration,
        requirementsVersion: () => options.requirementsVersion?.(sessionId) || 1, runtimeScope: options.runtimeScope, owner: () => {
        const owner = options.owner(sessionId);
        if (!owner || owner.runId !== runId) throw Error('permission_denied');
        return owner;
      }});
    },
    async verifyProcess(scope: Extract<PermissionScope, {kind: 'process'}>) {
      const verified = await normalize(scope);
      if (verified.kind !== 'process' || digest(fs.readFileSync(verified.executable)) !== verified.executableHash) throw Error('permission_denied');
    }
  };
}
export type PermissionService = ReturnType<typeof createPermissionService>;
