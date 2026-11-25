import fs from 'node:fs';
import path from 'node:path';
import type {PermissionOwner, PermissionScope, PermissionRequest} from '../../shared/xiaozhi-permissions';
import type {McpStdioConfiguration, McpPermissionSource} from './mcp-runtime';
import type {PermissionService} from './permissions/service';
import type {PermissionStore} from './permissions/store';
import type {PermissionRuntimeManager} from './permissions/windows/runtime';
import {openPermissionLease} from './permissions/lease';
import {filesystemScope, checkedFile, containsPath} from './permissions/resources';
import {fileVersion} from './workspace-files';
import {permissionHash} from './permissions/validation';
import {prepareExecutionProjection, commitExecutionProjection, removeOwnedProjection} from './permissions/windows/projection';
import {createControlledStdioTransport} from './mcp-controlled-transport';
import {hashCapabilityFile} from './capabilities/acquisition/file-hash';
import type {AcquisitionCall} from './capabilities/acquisition/prepare-receipts';

export type PreparedStdioBinding = {
  artifactId: string;
  version: string;
  directory: string;
  source: string;
  package: string;
  packageHash: string;
  files: {path: string; sha256: string; bytes: number}[];
  executable: {path: string; sha256: string; packagePath?: string};
  arguments: string[];
  workspaceActions: ('read' | 'write' | 'delete')[];
  inputAdapter?: 'filesystem_read';
  limits: {memoryBytes: number; cpuRate: number; userTimeMs: number; leaseMs: number; maxInputBytes: number; maxOutputBytes: number; maxProcesses: number};
};

type ControlledMcpOwner = {
  scopes(source: McpPermissionSource, tool: string, input: unknown): Promise<PermissionScope[]>;
  transformInput(source: McpPermissionSource, tool: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  healthInput(source: McpPermissionSource, tool: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  transport(configuration: McpStdioConfiguration, initialSignal?: AbortSignal): Promise<ReturnType<typeof createControlledStdioTransport>>;
  fork(): ControlledMcpOwner;
};

function quoteArgument(value: string) {
  if (value.includes('\0')) throw Error('invalid_input');
  return '"' + value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1') + '"';
}

/** The resolver returns only locally verified immutable acquisition records. */
export function createControlledMcpService(options: {
  permissions: PermissionService;
  store: PermissionStore;
  runtime: PermissionRuntimeManager;
  binding: (source: McpPermissionSource, owner: PermissionOwner) => Promise<PreparedStdioBinding>;
}) {
  return {
    forOwner(context: {owner: () => PermissionOwner; signal: AbortSignal; workspace: string; requirementsVersion: () => number;
      acquisitionCall?: AcquisitionCall; recordPendingApproval?: (request: PermissionRequest) => Promise<void>;
      recordAuthority?: (reference: string, refs: {grantId: string; revision: number}[]) => Promise<void>}) {
      const frozenOwner = context.owner();
      const verifiedFiles = new Map<string, {version: string; sha256: string}>();
      // Share file identity checks for this owner, while each view owns its projection lifetime.
      const createView = (): ControlledMcpOwner => {
        const projections = new Map<string, Awaited<ReturnType<typeof prepareExecutionProjection>>>();
        const assertOwner = () => {
          context.signal.throwIfAborted();
          if (permissionHash(context.owner()) !== permissionHash(frozenOwner)) throw Error('permission_denied');
        };
        const binding = async (source: McpPermissionSource) => {
          assertOwner();
          const recipe = await options.binding(source, frozenOwner);
          const packageScope = filesystemScope(recipe.directory, ['read']);
          for (const entry of recipe.files) {
            const filename = checkedFile(packageScope, path.resolve(recipe.directory, entry.path), 'read');
            const stat = await fs.promises.lstat(filename);
            if (!stat.isFile() || stat.nlink !== 1 || stat.size !== entry.bytes) throw Error('source_changed');
            const version = fileVersion(stat);
            const verified = verifiedFiles.get(filename);
            if (verified?.version !== version || verified.sha256 !== entry.sha256) {
              if (await hashCapabilityFile(filename, context.signal) !== entry.sha256
                  || fileVersion(await fs.promises.lstat(filename)) !== version) throw Error('source_changed');
              verifiedFiles.set(filename, {version, sha256: entry.sha256});
            }
          }
          const executable = await fs.promises.lstat(recipe.executable.path);
          if (!executable.isFile() || executable.isSymbolicLink()) throw Error('source_changed');
          if (recipe.executable.packagePath) {
            const filename = checkedFile(packageScope, path.resolve(recipe.directory, recipe.executable.packagePath), 'read');
            if (filename !== recipe.executable.path || executable.nlink !== 1
                || verifiedFiles.get(filename)?.sha256 !== recipe.executable.sha256) throw Error('source_changed');
          } else {
            const system = await options.runtime.systemRuntime();
            if (system.path !== recipe.executable.path || system.sha256 !== recipe.executable.sha256
                || await hashCapabilityFile(system.path, context.signal) !== system.sha256) throw Error('source_changed');
          }
          assertOwner();
          return recipe;
        };
        const scopes = (recipe: PreparedStdioBinding): PermissionScope[] => [
          filesystemScope(context.workspace, recipe.workspaceActions),
          {kind: 'process', backend: 'appcontainer', executable: recipe.executable.path,
            executableHash: recipe.executable.sha256, workspace: context.workspace},
          {kind: 'dependency', source: recipe.source, package: recipe.package, version: recipe.version,
            sha256: recipe.packageHash, environment: recipe.directory, installScripts: false},
        ];
        return {
          fork() { assertOwner(); return createView(); },
          async scopes(source: McpPermissionSource, _tool: string, _input: unknown) {return scopes(await binding(source));},
          async transformInput(source: McpPermissionSource, tool: string, input: Record<string, unknown>) {
            const recipe = await binding(source);
            if (!recipe.inputAdapter) return input;
            if (recipe.inputAdapter !== 'filesystem_read' || !['read_text_file', 'list_directory', 'get_file_info'].includes(tool)
                || typeof input.path !== 'string') throw Error('permission_denied');
            const relative = path.relative(context.workspace, path.resolve(context.workspace, input.path));
            if (relative.split(/[\\/]/u).some(part => /^(?:\.runtime|\.xiaozhi-projection\.json|\.xiaozhi-probe-.*|\.env(?:\..*)?|\.git|\.ssh|\.aws|\.azure)$/iu.test(part))) throw Error('permission_denied');
            const original = checkedFile(filesystemScope(context.workspace, ['read']), path.resolve(context.workspace, relative), 'read');
            const projection = projections.get(source.serverId);
            if (!projection) throw Error('permission_denied');
            const entry = projection.entries.find(row => row.relative === relative);
            if (relative && (!entry || fileVersion(await fs.promises.lstat(original)) !== entry.version)) throw Error('source_changed');
            return {...input, path: path.resolve(projection.root, relative)};
          },
          async healthInput(source: McpPermissionSource, tool: string, input: Record<string, unknown>) {
            const recipe = await binding(source);
            const projection = projections.get(source.serverId);
            if (recipe.inputAdapter !== 'filesystem_read' || !projection || tool !== 'read_text_file'
                || Object.keys(input).join(',') !== 'path' || input.path !== '__edudev_health__') throw Error('permission_denied');
            return {path: path.join(projection.root, '.xiaozhi-probe-' + projection.executionId + '.txt')};
          },
          async transport(configuration: McpStdioConfiguration, initialSignal?: AbortSignal) {
            const recipe = await binding(configuration.source);
            if (projections.has(configuration.source.serverId)) throw Error('resource_busy');
            if (configuration.command !== 'managed:' + recipe.artifactId || configuration.args.length || configuration.cwd) throw Error('source_changed');
            initialSignal?.throwIfAborted();
            const requested = scopes(recipe);
            if ((await options.runtime.inspect()).status === 'needs_configuration') requested.push(options.runtime.recipe());
            if (configuration.secret) requested.push(configuration.secret.scope);
            else if (Object.keys(configuration.environment).length) requested.push({kind: 'secret', reference: configuration.source.serverId,
              consumer: 'mcp.' + configuration.source.serverId});
            const request: PermissionRequest = {schemaVersion: 2, owner: frozenOwner, requirementsVersion: context.requirementsVersion(),
              callId: 'mcp_lease_' + configuration.source.serverId, action: 'mcp_stdio_start',
              inputDigest: permissionHash({source: configuration.source, packageHash: recipe.packageHash, limits: recipe.limits}),
              purpose: '在受控本地进程中运行已验证的MCP服务，授权覆盖其存活期间资源', scopes: requested, files: [], provider: null,
              classification: 'teacher_private', expiresAt: new Date(Date.now() + recipe.limits.leaseMs).toISOString()};
            let lease: Awaited<ReturnType<typeof openPermissionLease>>;
            try {lease = await openPermissionLease(options.permissions.engine, request, context.signal);}
            catch (error) {if (error instanceof Error && error.message === 'permission_pending') await context.recordPendingApproval?.(request); throw error;}
            let projection: Awaited<ReturnType<typeof prepareExecutionProjection>> | undefined;
            let terminalState: string | undefined;
            let cleanupVerified = false;
            try {
              await context.recordAuthority?.('permission-request:' + lease.authority.decision.requestDigest, lease.authority.decision.grantRefs);
              const environment = configuration.secret ? configuration.secret.open() : configuration.environment;
              if ((await options.runtime.inspect()).status === 'needs_configuration') await options.runtime.prepare(lease.authority, options.runtime.recipe().sha256);
              const runtime = await options.runtime.resolve(lease.authority);
              await binding(configuration.source);
              initialSignal?.throwIfAborted();
              projection = await prepareExecutionProjection(context.workspace, '', lease.authority);
              const packageRoot = path.join(projection.root, '.runtime/package');
              fs.mkdirSync(packageRoot, {recursive: true});
              await fs.promises.writeFile(path.join(projection.root, '.xiaozhi-probe-' + projection.executionId + '.txt'), 'EDUDEV_CAPABILITY_HEALTH_V1', {flag: 'wx'});
              for (const entry of recipe.files) {
                await lease.authority.assert();
                const destination = path.resolve(packageRoot, entry.path);
                if (!containsPath(packageRoot, destination)) throw Error('source_changed');
                const source = checkedFile(filesystemScope(recipe.directory, ['read']), path.resolve(recipe.directory, entry.path), 'read');
                await fs.promises.mkdir(path.dirname(destination), {recursive: true});
                await fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
                if (await hashCapabilityFile(destination, lease.authority.signal) !== entry.sha256) throw Error('source_changed');
              }
              const executable = recipe.executable.packagePath ? path.resolve(packageRoot, recipe.executable.packagePath) : recipe.executable.path;
              const arguments_ = recipe.arguments.map(value => value.replaceAll('$PACKAGE', packageRoot).replaceAll('$WORKSPACE', projection!.cwd));
              const selected = projection;
              projections.set(configuration.source.serverId, selected);
              await options.store.audit(frozenOwner.sessionId, 'mcp_service_intent', selected.executionId, {
                owner: frozenOwner, ...(context.acquisitionCall ? {acquisitionCall: context.acquisitionCall} : {}), serverId: configuration.source.serverId, artifactId: recipe.artifactId, packageHash: recipe.packageHash,
                projectionRoot: selected.root, helperVersion: runtime.version, helperHash: runtime.manifest.helperSha256,
                grantRefs: lease.authority.decision.grantRefs, leaseExpiresAt: request.expiresAt, limits: recipe.limits});
              return createControlledStdioTransport({runtime, signal: lease.authority.signal, assert: async () => {assertOwner(); await lease.authority.assert();},
                start: {schemaVersion: 1, type: 'start', executionId: selected.executionId, owner: frozenOwner,
                  grantHash: lease.authority.decision.permissionSnapshotHash, executable, executableHash: recipe.executable.sha256,
                  projectionRoot: selected.root, cwd: selected.cwd, command: '', env: {XIAOZHI_WORKSPACE: selected.root},
                  timeoutMs: recipe.limits.leaseMs, maxOutputBytes: recipe.limits.maxOutputBytes, maxProcesses: recipe.limits.maxProcesses,
                  session: {schemaVersion: 1, mode: 'stdio', arguments: arguments_.map(quoteArgument).join(' '),
                    maxInputBytes: recipe.limits.maxInputBytes, memoryBytes: recipe.limits.memoryBytes,
                    cpuRate: recipe.limits.cpuRate, userTimeMs: recipe.limits.userTimeMs, environment}},
                receipt: async result => {
                  cleanupVerified = result.cleanup.jobActiveProcesses === 0 && result.cleanup.profileRemoved && result.cleanup.remainingOwnedAces === 0;
                  // The helper's completed state confirms that the Job ended. Only
                  // an exit code of zero can authorize the projection commit.
                  terminalState = !cleanupVerified || result.state === 'completed' && result.exitCode !== 0 ? 'failed' : result.state;
                  await options.store.audit(frozenOwner.sessionId, 'mcp_service_terminal', selected.executionId,
                    {owner: frozenOwner, ...(context.acquisitionCall ? {acquisitionCall: context.acquisitionCall} : {}), serverId: configuration.source.serverId, artifactId: recipe.artifactId, result});
                },
                cleanup: async state => {
                  try {
                    if (terminalState === 'completed' && recipe.workspaceActions.includes('write')) await commitExecutionProjection(selected, lease.authority, options.store);
                    if (cleanupVerified || !state.launched) removeOwnedProjection(selected.root);
                    else await options.store.audit(frozenOwner.sessionId, 'mcp_service_cleanup_required', selected.executionId,
                      {owner: frozenOwner, ...(context.acquisitionCall ? {acquisitionCall: context.acquisitionCall} : {}), serverId: configuration.source.serverId, projectionRoot: selected.root, helperVersion: runtime.version});
                  } finally {
                    if (projections.get(configuration.source.serverId) === selected) projections.delete(configuration.source.serverId);
                    if (!state.launched) await options.store.audit(frozenOwner.sessionId, 'mcp_service_not_started', selected.executionId,
                      {owner: frozenOwner, ...(context.acquisitionCall ? {acquisitionCall: context.acquisitionCall} : {}), serverId: configuration.source.serverId});
                    await lease.close(terminalState === 'completed' || !state.launched ? undefined : Error('mcp_service_incomplete'));
                  }
                }});
            } catch (error) {
              await options.store.audit(frozenOwner.sessionId, 'mcp_service_start_failed', configuration.source.serverId,
                {owner: frozenOwner, ...(context.acquisitionCall ? {acquisitionCall: context.acquisitionCall} : {}), artifactId: recipe.artifactId, code: error instanceof Error && /^[A-Za-z0-9_:.-]{1,100}$/u.test(error.message)
                  ? error.message : 'configuration'}).catch(() => undefined);
              if (projection && projections.get(configuration.source.serverId) === projection) projections.delete(configuration.source.serverId);
              if (projection) removeOwnedProjection(projection.root);
              await lease.close(error instanceof Error ? error : Error('mcp_service_incomplete')).catch(() => undefined);
              throw error;
            }
          },
        };
      };
      return createView();
    },
  };
}
