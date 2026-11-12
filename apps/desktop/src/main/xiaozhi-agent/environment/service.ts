import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { EnvironmentView, EnvironmentRepairResult } from '../../../shared/xiaozhi-environment';
import { filesystemScope, checkedFile, digest } from '../permissions/resources';
import { currentPermission } from '../permissions/current';
import type { PermissionStore } from '../permissions/store';
import { plain, exact } from '../permissions/validation';
import type {PermissionRuntimeManager} from '../permissions/windows/runtime';

const relative = '.xiaozhi/environment.json' as const;
type Configuration = {schemaVersion: 1; encoding: 'utf-8'; lineEnding: 'crlf'};
const configuration: Configuration = {schemaVersion: 1, encoding: 'utf-8', lineEnding: 'crlf'};
const validConfiguration = (value: unknown): value is Configuration => plain(value) && exact(value, ['schemaVersion', 'encoding', 'lineEnding'])
  && value.schemaVersion === 1 && value.encoding === 'utf-8' && value.lineEnding === 'crlf';

export function createEnvironmentService(options: {
  workspace: (sessionId: string) => Promise<{path: string}>;
  permissions: PermissionStore;
  managedTools: () => Promise<{tools: {id: string; status: string}[]}>;
  credentialAvailable: () => Promise<boolean>;
  permissionRuntime?: PermissionRuntimeManager;
  runtimeChecks?: () => Promise<EnvironmentView['checks']>;
}) {
  async function locate(sessionId: string) {
    const workspace = await options.workspace(sessionId);
    const scope = filesystemScope(workspace.path, ['read', 'write']);
    const filename = checkedFile(scope, path.join(workspace.path, relative), 'read');
    if (fs.existsSync(filename) && fs.statSync(filename).size > 65536) throw Error('too_large');
    const bytes = fs.existsSync(filename) ? fs.readFileSync(filename) : null;
    return {scope, filename, bytes, hash: bytes ? digest(bytes) : null};
  }
  return {
    async inspect(sessionId: string): Promise<EnvironmentView> {
      const target = await locate(sessionId);
      const checks: EnvironmentView['checks'] = [];
      if (options.runtimeChecks) checks.push(...await options.runtimeChecks());
      const permissionRuntime = await options.permissionRuntime?.inspect();
      if (permissionRuntime) checks.push({id: 'permission_runtime', label: '受控PowerShell', status: permissionRuntime.status,
        detail: permissionRuntime.status === 'ready' ? '已核验本机Microsoft运行时与受控helper'
          : permissionRuntime.status === 'needs_configuration' ? '可按固定源码recipe配置本机受控helper' : '本机可信运行时不可用，保留文件工具路径'});
      const managed = await options.managedTools();
      for (const tool of managed.tools) checks.push({id: 'managed:' + tool.id, label: tool.id,
        status: tool.status === 'ready' ? 'ready' : 'unavailable', detail: tool.status});
      const disk = fs.statfsSync(target.scope.root);
      checks.push({id: 'disk', label: '工作目录磁盘', status: Number(disk.bavail) * Number(disk.bsize) > 10485760 ? 'ready' : 'unavailable',
        detail: `可用 ${Math.floor(Number(disk.bavail) * Number(disk.bsize) / 1048576)} MiB`});
      let writable = true;
      try {fs.accessSync(target.scope.root, fs.constants.W_OK);} catch {writable = false;}
      checks.push({id: 'directory', label: '工作目录', status: writable ? 'ready' : 'unavailable', detail: writable ? '目录可写，实际变动仍检查当前授权' : '目录不可写'});
      let configured = false;
      try {configured = target.bytes !== null && validConfiguration(JSON.parse(target.bytes.toString('utf8')));} catch { /* Show the actual invalid configuration. */ }
      checks.push({id: 'workspace_text', label: '工作区文本配置', status: configured ? 'ready' : 'needs_configuration', detail: configured ? 'UTF-8 / CRLF' : '可生成非敏感文本配置'});
      const credential = await options.credentialAvailable();
      checks.push({id: 'model_credential', label: '模型凭据', status: credential ? 'ready' : 'missing_credential', detail: credential ? '已通过现有安全入口配置' : '请在模型与连接页安全输入密钥'});
      return {schemaVersion: 1, sessionId, platform: {os: os.platform() + ' ' + os.release(), arch: os.arch(),
        node: process.versions.node, electron: process.versions.electron || null}, checks,
        configuration: {recipe: 'workspace_text', path: relative, sha256: target.hash},
        ...(permissionRuntime ? {permissionRuntime: {status: permissionRuntime.status, sourceHash: permissionRuntime.sourceHash, helperHash: permissionRuntime.helperHash}} : {})};
    },
    async repairRuntime(sessionId: string, expectedSourceHash: string): Promise<EnvironmentRepairResult> {
      const authority = currentPermission();
      if (!options.permissionRuntime || !authority || authority.request.owner.sessionId !== sessionId
          || authority.request.action !== 'environment_repair') throw Error('permission_denied');
      const before = await options.permissionRuntime.inspect();
      const result = await options.permissionRuntime.prepare(authority, expectedSourceHash);
      return {schemaVersion: 1, recipe: 'permission_runtime', path: result.runtime.directory,
        beforeHash: before.helperHash, afterHash: result.runtime.manifest.helperSha256, changed: result.changed,
        grantRefs: authority.decision.grantRefs};
    },
    async repair(sessionId: string, expectedHash: string | null): Promise<EnvironmentRepairResult> {
      const authority = currentPermission();
      if (!authority || authority.request.owner.sessionId !== sessionId || authority.request.action !== 'environment_repair') throw Error('permission_denied');
      await authority.assert();
      const target = await locate(sessionId);
      if (target.hash !== expectedHash) throw Error('source_changed');
      // Existing unknown fields may contain private configuration. Preserve them.
      if (target.bytes) {
        const current = JSON.parse(target.bytes.toString('utf8'));
        if (!validConfiguration(current)) throw Error('unsupported_constraint');
      }
      const bytes = Buffer.from(JSON.stringify(configuration, null, 2) + '\n');
      const afterHash = digest(bytes);
      if (target.hash === afterHash) return {schemaVersion: 1, recipe: 'workspace_text', path: relative,
        beforeHash: target.hash, afterHash, changed: false, grantRefs: authority.decision.grantRefs};
      const directory = path.dirname(target.filename);
      checkedFile(target.scope, directory, 'write');
      fs.mkdirSync(directory, {recursive: true});
      const temporary = checkedFile(target.scope, path.join(directory, '.environment-' + randomUUID() + '.tmp'), 'write');
      try {
        fs.writeFileSync(temporary, bytes, {flag: 'wx', mode: 0o600});
        if (!validConfiguration(JSON.parse(fs.readFileSync(temporary, 'utf8')))) throw Error('configuration');
        await authority.assert();
        const latest = await locate(sessionId);
        if (latest.hash !== expectedHash) throw Error('source_changed');
        await authority.assert();
        checkedFile(target.scope, target.filename, 'write');
        fs.renameSync(temporary, target.filename);
        if (digest(fs.readFileSync(target.filename)) !== afterHash) throw Error('configuration');
        await options.permissions.audit(sessionId, 'environment_config_committed', relative,
          {owner: authority.request.owner, beforeHash: target.hash, afterHash, grantRefs: authority.decision.grantRefs});
        return {schemaVersion: 1, recipe: 'workspace_text', path: relative, beforeHash: target.hash,
          afterHash, changed: true, grantRefs: authority.decision.grantRefs};
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
    }
  };
}
