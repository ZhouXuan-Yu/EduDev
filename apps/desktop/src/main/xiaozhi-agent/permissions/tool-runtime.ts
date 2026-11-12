import fs from 'node:fs';
import path from 'node:path';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { PermissionOwner, PermissionRequest, PermissionScope } from '../../../shared/xiaozhi-permissions';
import type { PermissionEngine } from './engine';
import { filesystemScope, checkedFile, digest } from './resources';
import { permissionHash } from './validation';
import { runWithPermission } from './current';
import {fileVersion} from '../workspace-files';
import {nativePermissionProvider} from './provider-source';
import {permissionRequestSummary} from './summary';
import {unwrapTaskArguments} from '../tasks/tool-envelope';

type Result = Awaited<ReturnType<ToolDefinition['execute']>>;
export type PermissionToolExecution = (callId: string, name: string, input: unknown, signal: AbortSignal,
  execute: (signal: AbortSignal) => Promise<Result>) => Promise<Result>;
const reads = new Set(['office_read_text', 'office_file_stat', 'office_list_files', 'office_read_document', 'capability_execute', 'environment_inspect']);
const writes = new Set(['office_copy_file', 'office_create_text', 'office_edit_text', 'office_create_science_figure',
  'office_create_document', 'office_deliver_files', 'education_create_report', 'exec_command', 'environment_repair']);

export function systemPowerShell() {
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  if (!fs.existsSync(executable)) throw Error('unsupported_constraint');
  return {executable: fs.realpathSync(executable), executableHash: digest(fs.readFileSync(executable))};
}

export function createToolPermissionRuntime(options: {
  engine: PermissionEngine;
  owner: () => PermissionOwner;
  requirementsVersion?: () => number;
  workspace: () => Promise<{path: string}>;
  process?: () => {executable: string; executableHash: string} | Promise<{executable: string; executableHash: string}>;
  runtimeScope?: () => PermissionScope;
  needsRuntimeConfiguration?: () => Promise<boolean>;
  summarize?: (action: string, input: unknown) => Promise<string>;
}) {
  async function request(callId: string, name: string, raw: unknown): Promise<PermissionRequest | null> {
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? unwrapTaskArguments(raw).input : {};
    const scopes: PermissionScope[] = [];
    const files: PermissionRequest['files'] = [];
    let frozenInput: unknown = input;
    if (reads.has(name) || writes.has(name)) {
      const workspace = await options.workspace();
      const runtimeRepair = name === 'environment_repair' && input.recipe === 'permission_runtime';
      const actions: ('read' | 'write' | 'delete')[] = writes.has(name) && !runtimeRepair ? ['read', 'write'] : ['read'];
      if (name === 'exec_command') actions.push('delete');
      const scope = filesystemScope(workspace.path, actions);
      scopes.push(scope);
      const business = name === 'capability_execute' && input.input && typeof input.input === 'object'
        ? input.input as Record<string, unknown> : input;
      for (const key of ['path', 'source', 'target', 'workdir']) {
        if (typeof business[key] === 'string') {
          const filename = path.resolve(workspace.path, business[key]);
          checkedFile(scope, filename, key === 'target' ? 'write' : 'read');
          if (key === 'source' || reads.has(name) && key === 'path') files.push({root: scope.root, path: path.relative(scope.root, filename) || '.',
            version: fs.existsSync(filename) ? fileVersion(fs.lstatSync(filename)) : null, sha256: null});
        }
      }
      if (name === 'office_copy_file' && typeof input.source === 'string') {
        const readRequest: PermissionRequest = {schemaVersion: 2, owner: options.owner(), requirementsVersion: options.requirementsVersion?.() || 1,
          callId, action: 'office_copy_source_check', inputDigest: permissionHash(input), purpose: '核对已授来源文件', scopes: [filesystemScope(scope.root, ['read'])],
          files: [], provider: null, classification: 'redacted', expiresAt: new Date(Date.now() + 86400000).toISOString()};
        if ((await options.engine.evaluate(readRequest)).state !== 'allow') throw Error('permission_denied');
        const sourceHash = digest(fs.readFileSync(checkedFile(scope, path.resolve(workspace.path, input.source), 'read')));
        frozenInput = {input, sourceHash};
        const source = files.find(file => file.path === path.relative(scope.root, path.resolve(scope.root, input.source as string)));
        if (source) source.sha256 = sourceHash;
      }
      if (name === 'exec_command') {
        if (process.platform !== 'win32') throw Error('unsupported_constraint');
        scopes.push({kind: 'process', backend: 'appcontainer', ...await (options.process || systemPowerShell)(), workspace: scope.root});
        if (await options.needsRuntimeConfiguration?.()) {
          if (!options.runtimeScope) throw Error('unsupported_constraint');
          scopes.push(options.runtimeScope());
        }
      }
      if (runtimeRepair) {
        if (!options.runtimeScope) throw Error('unsupported_constraint');
        scopes.push(options.runtimeScope());
      }
    } else if (name === 'office_web_fetch' || name === 'office_web_search') {
      const origin = name === 'office_web_search' ? 'https://api.anysearch.com' : new URL(String(input.url)).origin;
      scopes.push({kind: 'network', origin, methods: [name === 'office_web_search' ? 'POST' : 'GET'], purpose: 'public_research'},
        {kind: 'egress', origin, classifications: ['public', 'redacted']});
    }
    if (!scopes.length) return null;
    return {schemaVersion: 2, owner: options.owner(), requirementsVersion: options.requirementsVersion?.() || 1, callId, action: name, inputDigest: permissionHash(frozenInput),
      summary: options.summarize ? await options.summarize(name, input) : permissionRequestSummary(name, input),
      purpose: name === 'exec_command' ? '在已授工作区运行受控脚本并提交文件变动' : '使用已授资源完成当前教学任务',
      scopes, files, provider: nativePermissionProvider(name), classification: 'redacted', expiresAt: new Date(Date.now() + 86400000).toISOString()};
  }
  const execute: PermissionToolExecution = async (callId, name, input, signal, perform) => {
    const frozen = await request(callId, name, input);
    if (!frozen) return perform(signal);
    return options.engine.run(frozen, signal, async context => runWithPermission({request: frozen, ...context}, () => perform(context.signal)));
  };
  return {request, execute};
}
