import {randomUUID} from 'node:crypto';
import type {Sql} from '../session-state';
import type {PermissionService} from '../permissions/service';
import type {PermissionStore} from '../permissions/store';
import type {PermissionRequest} from '../../../shared/xiaozhi-permissions';
import {permissionHash, plain, exact} from '../permissions/validation';
import {openPermissionLease} from '../permissions/lease';
import {createControlledMcpService} from '../mcp-controlled-service';
import type {PermissionRuntimeManager} from '../permissions/windows/runtime';
import {createExtensionState} from './state';
import {createExtensionRpc} from './rpc';
import {validManifest, extensionSchemaHash, boundedJson, extensionDependencySource} from './validation';
import type {ExtensionManifest, ExtensionContext, ExtensionBinding, ExtensionSession, ExtensionView} from './types';

export type {ExtensionManifest, ExtensionContext, ExtensionBinding, ExtensionSession, ExtensionView} from './types';
export {EXTENSION_HOOKS} from './types';

/** Trusted main supplies acquisition-verified manifests and bindings. Third-party modules stay in the OS sandbox. */
export function createExtensionService(options: {
  sql: Sql;
  permissions: PermissionService;
  store: PermissionStore;
  runtime: PermissionRuntimeManager;
  binding: (manifest: ExtensionManifest) => Promise<ExtensionBinding>;
  timeoutMs?: number;
}) {
  const state = createExtensionState(options.sql);
  const sessions = new Map<string, Set<{close: () => Promise<void>}>>();
  const timeoutMs = options.timeoutMs ?? 10000;
  const persist = <T>(context: ExtensionContext, action: () => Promise<T>) => context.persist ? context.persist(action) : action();
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 60000) throw Error('invalid_input');
  const stop = async (extensionId: string) => {
    await Promise.all([...sessions.get(extensionId) || []].map(session => session.close()));
  };
  async function launch(manifest: ExtensionManifest, context: ExtensionContext, actions: ('install' | 'run')[], assertSelection: () => Promise<void>) {
    if (!validManifest(manifest)) throw Error('invalid_input');
    const frozen = structuredClone(manifest);
    const owner = structuredClone(context.owner());
    const recipe = structuredClone(await options.binding(frozen));
    // Extensions cannot receive a writable workspace projection or an unreviewed runtime argument.
    if (recipe.artifactId !== frozen.artifactId || recipe.version !== frozen.version || recipe.source !== extensionDependencySource(frozen.source)
        || recipe.workspaceActions.some(action => action !== 'read') || !recipe.executable.packagePath
        || !recipe.files.some(file => file.path === recipe.executable.packagePath && file.sha256 === recipe.executable.sha256)) throw Error('source_changed');
    const request: PermissionRequest = {schemaVersion: 2, owner, requirementsVersion: context.requirementsVersion(),
      callId: 'extension_lease_' + randomUUID(), action: 'extension_' + actions.join('_'), inputDigest: permissionHash(frozen),
      purpose: '在受控隔离进程运行已审核扩展', scopes: [{kind: 'extension', extensionId: frozen.extensionId, sourceHash: frozen.sourceHash, actions}],
      files: [], provider: null, classification: 'teacher_private', expiresAt: new Date(Date.now() + recipe.limits.leaseMs).toISOString()};
    const controller = new AbortController();
    const lease = await openPermissionLease(options.permissions.engine, request, AbortSignal.any([context.signal, controller.signal]));
    let rpc: ReturnType<typeof createExtensionRpc> | undefined;
    let closing: Promise<void> | undefined;
    const group = sessions.get(frozen.extensionId) || new Set<{close: () => Promise<void>}>();
    const assert = async () => {
      if (closing) throw Error('extension_closed');
      if (permissionHash(context.owner()) !== permissionHash(owner)) throw Error('permission_denied');
      await lease.authority.assert();
      await assertSelection();
    };
    const tracked = {close: () => closing ||= (async () => {
      controller.abort('extension_closed');
      try {await rpc?.close();}
      finally {
        group.delete(tracked); if (!group.size) sessions.delete(frozen.extensionId);
        await lease.close();
      }
    })()};
    group.add(tracked); sessions.set(frozen.extensionId, group);
    try {
      await context.recordAuthority?.('permission-request:' + lease.authority.decision.requestDigest, lease.authority.decision.grantRefs);
      await assert();
      const serverId = 'extension.' + frozen.extensionId + '.' + frozen.artifactId.slice(0, 16) + '.' + randomUUID();
      const source = {serverId, transport: 'stdio' as const, sourceHash: frozen.sourceHash,
        schemaHash: extensionSchemaHash(frozen), tools: [], url: null};
      const controlled = createControlledMcpService({permissions: options.permissions, store: options.store, runtime: options.runtime,
        binding: async candidate => {
          if (permissionHash(candidate) !== permissionHash(source)) throw Error('source_changed');
          const current = await options.binding(frozen);
          if (permissionHash(current) !== permissionHash(recipe)) throw Error('source_changed');
          return current;
        }});
      const transport = await controlled.forOwner({...context, signal: lease.authority.signal}).transport({source,
        command: 'managed:' + frozen.artifactId, args: [], environment: {}});
      rpc = createExtensionRpc(transport, {signal: lease.authority.signal, timeoutMs, assert});
      transport.onClose(() => {void tracked.close().catch(() => undefined);});
      await assert();
      await rpc.start();
      const health = await rpc.request('extensions/health', {schemaVersion: 1});
      if (!plain(health) || !exact(health, ['schemaVersion', 'status', 'extensionId', 'version', 'sourceHash', 'hooks'])
          || health.schemaVersion !== 1 || health.status !== 'ready' || health.extensionId !== frozen.extensionId
          || health.version !== frozen.version || health.sourceHash !== frozen.sourceHash || permissionHash(health.hooks) !== permissionHash(frozen.hooks)) throw Error('extension_health_failed');
      const peer = rpc;
      const session: ExtensionSession = {manifest: structuredClone(frozen),
        async invoke(hook, payload, signal) {
          if (!frozen.hooks.includes(hook)) throw Error('unsupported_extension_hook');
          if (!boundedJson(payload)) throw Error('extension_message_limit');
          const result = await peer.request('extensions/hook', {schemaVersion: 1, hook, payload}, signal);
          if (!plain(result) || !exact(result, ['schemaVersion', 'hook', 'value']) || result.schemaVersion !== 1 || result.hook !== hook
              || !boundedJson(result.value) || hook === 'event.observe' && result.value !== null) {
            await tracked.close(); throw Error('extension_result_schema');
          }
          return result.value;
        }, logs: peer.logs, close: tracked.close};
      return session;
    } catch (error) {await tracked.close(); throw error;}
  }
  const selection = (manifest: ExtensionManifest) => async () => {
    const view = await state.read(manifest.extensionId);
    const active = view.versions.find(version => version.manifest.version === manifest.version);
    if (!view.enabled || view.activeVersion !== manifest.version || !active || active.revokedAt
        || permissionHash(active.manifest) !== permissionHash(manifest)) throw Error('extension_disabled');
  };
  return {
    view: state.read,
    list: state.list,
    async install(raw: ExtensionManifest, revision: number, context: ExtensionContext): Promise<ExtensionView> {
      if (!validManifest(raw)) throw Error('invalid_input');
      const manifest = structuredClone(raw);
      const previous = await state.read(manifest.extensionId);
      if (previous.revision !== revision) throw Error('extension_revision_conflict');
      const existing = previous.versions.find(version => version.manifest.version === manifest.version);
      if (existing && (existing.revokedAt || permissionHash(existing.manifest) !== permissionHash(manifest))) throw Error('source_changed');
      const session = await launch(manifest, context, ['install', 'run'], async () => {
        if ((await state.read(manifest.extensionId)).revision !== revision) throw Error('extension_revision_conflict');
      });
      try {
        return await persist(context, () => state.update(manifest.extensionId, revision, view => ({...view, revision: revision + 1,
          versions: existing ? view.versions : [...view.versions, {manifest, healthAt: new Date().toISOString(), revokedAt: null}]})));
      } finally {await session.close();}
    },
    async select(extensionId: string, version: string, revision: number, context: ExtensionContext) {
      const previous = await state.read(extensionId);
      if (previous.revision !== revision) throw Error('extension_revision_conflict');
      const chosen = previous.versions.find(item => item.manifest.version === version && !item.revokedAt);
      if (!chosen) throw Error('extension_unavailable');
      const session = await launch(chosen.manifest, context, ['run'], async () => {
        if ((await state.read(extensionId)).revision !== revision) throw Error('extension_revision_conflict');
      });
      try {
        const next = await persist(context, () => state.update(extensionId, revision, view => ({...view, revision: revision + 1, enabled: true, activeVersion: version})));
        await stop(extensionId);
        return next;
      } finally {await session.close();}
    },
    async disable(extensionId: string, revision: number) {
      const next = await state.update(extensionId, revision, view => ({...view, revision: revision + 1, enabled: false}));
      await stop(extensionId); return next;
    },
    async revoke(extensionId: string, version: string, revision: number) {
      const next = await state.update(extensionId, revision, view => {
        if (!view.versions.some(item => item.manifest.version === version)) throw Error('extension_unavailable');
        return {...view, revision: revision + 1, enabled: view.activeVersion === version ? false : view.enabled,
          activeVersion: view.activeVersion === version ? null : view.activeVersion,
          versions: view.versions.map(item => item.manifest.version === version ? {...item, revokedAt: item.revokedAt || new Date().toISOString()} : item)};
      });
      await stop(extensionId); return next;
    },
    async open(extensionId: string, context: ExtensionContext) {
      const view = await state.read(extensionId);
      const chosen = view.versions.find(item => item.manifest.version === view.activeVersion && !item.revokedAt);
      if (!view.enabled || !chosen) throw Error('extension_disabled');
      return launch(chosen.manifest, context, ['run'], selection(chosen.manifest));
    },
    async dispose() {await Promise.all([...sessions.keys()].map(stop));},
  };
}
