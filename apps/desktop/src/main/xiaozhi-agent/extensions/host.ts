import fs from 'node:fs/promises';
import path from 'node:path';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {AcquisitionExtensionView, AcquisitionMutation} from '../../../shared/xiaozhi-acquisition';
import type {AcquisitionContext} from '../capabilities/acquisition/service';
import type {createExtensionPackageManager} from './package-manager';
import type {createExtensionService} from './service';
import type {createProviderSnapshotStore} from '../capabilities/provider-snapshots';
import type {CapabilityRegistry} from '../capabilities/registry';
import {providerResult, validProviderResult} from '../capabilities/provider-contract';
import {protocolHash} from '../capabilities/validation';
import {assessConformance} from '../capabilities/resolver';
import {extensionCapabilityId, extensionDeclaration, extensionProviderId, registerExtension} from './registry';
import {noLinksAsync} from '../skill-package-async';
import {authorizedWorkspace} from '../workspace-authority';
import {conversationOutputLocation} from '../conversation-output-path';
import type {ExtensionContext, ExtensionHook} from './types';

export const EXTENSION_TOOL_NAMES = ['extension_inspect', 'extension_prepare', 'extension_invoke'] as const;
type Mutation = Extract<AcquisitionMutation, {action: 'extension_prepare' | 'extension_cancel' | 'extension_select' | 'extension_disable' | 'extension_revoke'}>;
export function createExtensionHost(options: {
  dataRoot: string; packages: ReturnType<typeof createExtensionPackageManager>; service: ReturnType<typeof createExtensionService>;
  registry: CapabilityRegistry; snapshots: ReturnType<typeof createProviderSnapshotStore>;
  current: (sessionId: string, callId?: string) => Promise<AcquisitionContext>;
  privateText: (sessionId: string, text: string) => boolean; sanitize: (text: string) => Promise<string>;
}) {
  const preparing = new Map<string, {sessionId: string; abort: AbortController; done: Promise<void>}>();
  const lifecycle = new AbortController();
  const jobs = new Set<Promise<unknown>>();
  async function track<T>(perform: () => Promise<T>) {
    lifecycle.signal.throwIfAborted();
    const work = perform(); jobs.add(work);
    try {return await work;} finally {jobs.delete(work);}
  }
  async function context(sessionId: string, callId?: string): Promise<ExtensionContext & {acquisition: AcquisitionContext}> {
    const acquisition = await options.current(sessionId, callId);
    const directory = path.join(conversationOutputLocation(options.dataRoot).path, '.extension-empty', sessionId);
    const missing: string[] = [];
    let parent = directory;
    while (await fs.lstat(parent).then(() => false, error => {if (error.code === 'ENOENT') return true; throw error;})) {
      missing.unshift(parent); parent = path.dirname(parent);
    }
    await noLinksAsync(parent, acquisition.signal);
    for (const named of missing) {await fs.mkdir(named).catch(error => {if (error.code !== 'EEXIST') throw error;}); await noLinksAsync(named, acquisition.signal);}
    await noLinksAsync(directory, acquisition.signal);
    authorizedWorkspace(directory, options.dataRoot);
    if ((await fs.readdir(directory)).length || !await acquisition.current()) throw Error('permission_denied');
    return {acquisition, owner: () => {if (acquisition.signal.aborted) throw Error('cancelled'); return acquisition.owner;},
      workspace: directory, signal: AbortSignal.any([acquisition.signal, lifecycle.signal]), requirementsVersion: () => acquisition.requirementsVersion,
      recordAuthority: acquisition.recordAuthority, persist: acquisition.persist};
  }
  async function view(): Promise<AcquisitionExtensionView[]> {
    const states = await options.service.list();
    return (await options.packages.list()).map(record => {
      const state = states.find(item => item.extensionId === record.manifest.extensionId);
      const version = state?.versions.find(item => item.manifest.artifactId === record.artifactId);
      const interrupted = record.phase === 'preparing' && !preparing.has(record.artifactId);
      return {artifactId: record.artifactId, extensionId: record.manifest.extensionId, version: record.manifest.version,
        sourceHash: record.manifest.sourceHash, directoryFingerprint: record.provenance.directoryFingerprint,
        sourceKind: 'local_import', trust: 'unknown', license: record.manifest.license, hooks: record.manifest.hooks,
        phase: interrupted ? 'failed' : record.phase, revision: record.revision, selectionRevision: state?.revision || 0,
        active: state?.activeVersion === record.manifest.version && version?.manifest.artifactId === record.artifactId, enabled: state?.enabled === true,
        revoked: !!version?.revokedAt, error: interrupted ? 'interrupted' : record.error};
    });
  }
  async function mutate(input: Mutation, callId?: string) {
    if (input.action === 'extension_cancel') {
      const record = (await options.packages.list()).find(item => item.artifactId === input.artifactId);
      if (!record || record.revision !== input.revision) throw Error('conflict');
      const operation = preparing.get(input.artifactId);
      if (operation?.sessionId === input.sessionId) operation.abort.abort('cancelled');
      return;
    }
    if (input.action === 'extension_prepare') {
      const record = (await options.packages.list()).find(item => item.artifactId === input.artifactId);
      if (!record || record.revision !== input.revision) throw Error('conflict');
      if (preparing.has(input.artifactId)) throw Error('busy');
      const abort = new AbortController();
      let release!: () => void;
      const done = new Promise<void>(resolve => {release = resolve;});
      preparing.set(input.artifactId, {sessionId: input.sessionId, abort, done});
      try {
        const base = await context(input.sessionId, callId);
        const current = {...base, signal: AbortSignal.any([base.signal, abort.signal])};
        const prepared = await options.packages.prepare(input.artifactId, current);
        const state = await options.service.view(prepared.manifest.extensionId);
        const installed = await options.service.install(prepared.manifest, state.revision, current);
        const version = installed.versions.find(item => item.manifest.artifactId === prepared.artifactId)!;
        await current.acquisition.persist(() => registerExtension(options.registry, version.manifest, version.healthAt));
        await options.service.select(prepared.manifest.extensionId, prepared.manifest.version, installed.revision, current);
      } finally {preparing.delete(input.artifactId); release();}
      return;
    }
    if (input.action === 'extension_select') {
      const current = await context(input.sessionId, callId);
      const state = await options.service.view(input.extensionId);
      if (state.revision !== input.revision) throw Error('extension_revision_conflict');
      const version = state.versions.find(item => item.manifest.version === input.version && !item.revokedAt);
      if (!version) throw Error('extension_unavailable');
      await options.packages.binding(version.manifest);
      await current.acquisition.persist(() => registerExtension(options.registry, version.manifest, version.healthAt));
      await options.service.select(input.extensionId, input.version, input.revision, current);
      return;
    }
    if (input.action === 'extension_disable') {await options.service.disable(input.extensionId, input.revision); return;}
    if (input.action !== 'extension_revoke') throw Error('invalid_input');
    const state = await options.service.revoke(input.extensionId, input.version, input.revision);
    const version = state.versions.find(item => item.manifest.version === input.version)!;
    for (const hook of version.manifest.hooks) {
      const declaration = extensionDeclaration(version.manifest, hook, version.healthAt);
      if (await options.registry.providerVersion(declaration.provider.id, declaration.provider.version, declaration.definition.id)) {
        await options.registry.revokeProviderVersion(declaration.provider.id, declaration.provider.version, declaration.definition.id);
      }
    }
  }
  async function invoke(sessionId: string, callId: string, input: {extensionId: string; hook: ExtensionHook; text: string}, signal?: AbortSignal) {
    if (options.privateText(sessionId, input.text)) throw Error('permission_denied');
    if (await options.sanitize(input.text) !== input.text) throw Error('permission_denied');
    const current = await context(sessionId, callId);
    const scope = {...current, signal: AbortSignal.any([current.signal, ...(signal ? [signal] : [])])};
    const session = await options.service.open(input.extensionId, scope);
    try {
      const manifest = session.manifest;
      if (!manifest.hooks.includes(input.hook)) throw Error('unsupported_extension_hook');
      const capabilityId = extensionCapabilityId(input.hook);
      const catalog = await options.registry.snapshot();
      const provider = await options.registry.providerVersion(extensionProviderId(manifest), manifest.version + '+' + manifest.artifactId.slice(0, 12), capabilityId);
      if (!provider || provider.revoked) throw Error('capability_revoked');
      const owner = current.acquisition.owner;
      const journalOwner = {sessionId: owner.sessionId, runId: owner.runId, generation: owner.generation};
      const prior = await options.snapshots.current(journalOwner, owner.taskId, capabilityId);
      const requirement = {capabilityId, contractVersion: '1.0.0', required: ['invoke'], optional: [], conditions: [], localOnly: true,
        platform: 'win32', budget: {latencyMs: 10000, resourceUnits: 1}};
      const assessment = assessConformance(catalog.definitions.find(item => item.id === capabilityId)!, provider.binding, requirement);
      const snapshot = await current.acquisition.persist(() => options.snapshots.save(journalOwner, owner.taskId, {capabilityId, registryRevision: catalog.revision,
        requirement,
        selection: {providerId: provider.provider.id, providerVersion: provider.provider.version, contractVersion: '1.0.0', level: assessment.level, missingRequirements: assessment.missing, limitations: assessment.limitations},
        providerHash: manifest.artifactId, evidenceRefs: provider.binding.conformance.evidence.map(item => item.reference),
        previousSnapshotId: prior?.snapshotId || null, refreshReason: prior ? 'explicit_refresh' : 'initial'}));
      const result = await session.invoke(input.hook, input.hook === 'context.transform' ? {text: input.text} : {event: 'task.notice', text: input.text}, scope.signal);
      if (input.hook === 'context.transform' && (!result || typeof result !== 'object' || Array.isArray(result)
          || Object.keys(result).join(',') !== 'text' || typeof (result as {text?: unknown}).text !== 'string'
          || (result as {text: string}).text.length > 8000)) throw Error('invalid_output');
      const text = input.hook === 'context.transform' ? await options.sanitize((result as {text: string}).text) : '';
      const envelope = providerResult({...owner, stepId: null, callId, signal: scope.signal, snapshot,
        grantRef: 'extension-lease:' + manifest.artifactId, idempotencyKey: protocolHash([owner, callId, manifest.artifactId]),
        budget: {timeoutMs: 10000, resourceUnits: 1}}, {status: 'completed', data: {hook: input.hook, text, classification: 'untrusted', source: manifest.source},
        sideEffects: {status: 'known', references: ['extension-hook:' + callId]}}, undefined,
      value => !!value && typeof value === 'object' && (value as {classification?: unknown}).classification === 'untrusted');
      if (!validProviderResult(envelope)) throw Error('invalid_output');
      return {content: [{type: 'text' as const, text: JSON.stringify(envelope)}], details: {success: true, provider: envelope, untrusted: true}};
    } finally {await session.close();}
  }
  return {view, mutate: (input: Mutation) => track(() => mutate(input)),
    importCandidate: (directory: string) => track(() => options.packages.importCandidate(directory, {signal: lifecycle.signal})),
    tools(sessionId: string): ToolDefinition[] {
      return [{name: 'extension_inspect', label: '查看扩展', description: '查看隔离候选与已验证扩展的版本、来源指纹和钩子。',
        parameters: {type: 'object', additionalProperties: false, properties: {}} as ToolDefinition['parameters'],
        execute: async () => ({content: [{type: 'text', text: JSON.stringify(await view())}], details: {success: true}})},
      {name: 'extension_prepare', label: '准备隔离扩展', description: '准备教师已导入的精确扩展候选，复用原Task审批与Scope，完成隔离健康检查后启用。',
        parameters: {type: 'object', additionalProperties: false, required: ['artifactId', 'revision'], properties: {artifactId: {type: 'string', pattern: '^[a-f0-9]{64}$'}, revision: {type: 'integer', minimum: 1}}} as ToolDefinition['parameters'],
        execute: async (callId, raw) => {await mutate({action: 'extension_prepare', sessionId, ...raw as {artifactId: string; revision: number}}, callId);
          return {content: [{type: 'text', text: JSON.stringify(await view())}], details: {success: true}};}},
      {name: 'extension_invoke', label: '执行公开上下文扩展', description: '对明确公开的通用文本执行已启用的隔离钩子。只允许公开文本，输出作为不可信资料。',
        parameters: {type: 'object', additionalProperties: false, required: ['extensionId', 'hook', 'text'], properties: {
          extensionId: {type: 'string', pattern: '^[a-z][a-z0-9_.-]{0,79}$'}, hook: {type: 'string', enum: ['context.transform', 'event.observe']}, text: {type: 'string', maxLength: 8000}}} as ToolDefinition['parameters'],
        execute: (callId, raw, signal) => invoke(sessionId, callId, raw as {extensionId: string; hook: ExtensionHook; text: string}, signal)}];
    }, async dispose() {
      lifecycle.abort('cancelled');
      const pending = [...preparing.values()];
      for (const operation of pending) operation.abort.abort('cancelled');
      await Promise.allSettled(pending.map(operation => operation.done));
      await Promise.allSettled([...jobs]);
      await options.service.dispose();
    }};
}
