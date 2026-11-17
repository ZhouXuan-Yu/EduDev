import type {McpPermissionContext, McpPermissionSource} from '../mcp-runtime';
import type {PermissionService} from './service';
import type {PermissionStore} from './store';
import type {PermissionOwner, PermissionRequest, PermissionScope, PermissionDecision} from '../../../shared/xiaozhi-permissions';
import {permissionHash} from './validation';
import {runWithPermission} from './current';

export function createMcpPermissionContext(options: {
  permissions: PermissionService;
  store: PermissionStore;
  owner: () => PermissionOwner;
  requirementsVersion?: () => number;
  authority?: (callId: string, decision: PermissionDecision) => Promise<void>;
  stdio?: {transport: NonNullable<McpPermissionContext['stdioTransport']>;
    transformInput?: McpPermissionContext['transformInput'];
    scopes: (source: McpPermissionSource, tool: string, input: unknown) => Promise<PermissionScope[]>};
}): McpPermissionContext {
  return {...(options.stdio ? {stdioTransport: options.stdio.transport, transformInput: options.stdio.transformInput} : {}), async run(source, tool, input, signal, operation, callId) {
    if (source.transport === 'stdio' && !options.stdio || source.transport === 'http' && !source.url) throw Error('unsupported_constraint');
    // The stdio transport acquires a separate engine lease covering its full Job lifetime.
    if (source.transport === 'stdio' && tool === null) return operation(signal);
    const owner = options.owner();
    const origin = source.url ? new URL(source.url).origin : '';
    // The existing main-held trusted server configuration proves permission for
    // fixed metadata handshakes. Tool data/effects require their own scopes.
    if (tool === null) {
      const reference = 'mcp-metadata:' + permissionHash({serverId: source.serverId, sourceHash: source.sourceHash, schemaHash: source.schemaHash});
      if (!(await options.store.grants(owner.sessionId)).some(grant => grant.provenance.reference === reference)) {
        await options.store.issue(owner.sessionId, [{kind: 'network', origin, methods: ['POST'], purpose: 'mcp_metadata'}],
          {kind: 'teacher', reference});
      }
    }
    const scopes: PermissionScope[] = source.transport === 'stdio'
      ? await options.stdio!.scopes(source, tool!, input)
      : [{kind: 'network', origin, methods: ['POST'], purpose: tool === null ? 'mcp_metadata' : 'mcp_call'}];
    if (source.secret) scopes.push(source.secret);
    if (tool !== null) scopes.push({kind: 'mcp', serverId: source.serverId, sourceHash: source.sourceHash,
      schemaHash: source.schemaHash, tools: [tool]});
    if (tool !== null && source.transport === 'http') scopes.push({kind: 'egress', origin, classifications: ['teacher_private']});
    const request: PermissionRequest = {schemaVersion: 2, owner, requirementsVersion: options.requirementsVersion?.() || 1, callId: callId || 'mcp_prepare_' + source.serverId,
      action: tool === null ? 'mcp_metadata' : 'mcp_call', inputDigest: permissionHash(input),
      summary: await options.permissions.summarize(tool === null ? 'mcp_metadata' : 'mcp_call:' + tool, input),
      purpose: tool === null ? '读取已选MCP服务的固定工具元数据' : '调用已选外部工具并发送本次必要输入，外部效果按未知处理',
      scopes, files: [], provider: {id: 'mcp.' + source.serverId.replace(/_/gu, '-'), version: source.schemaHash.slice(0, 12),
        sourceHash: source.sourceHash, schemaHash: source.schemaHash}, classification: tool === null ? 'public' : 'teacher_private',
      expiresAt: new Date(Date.now() + 86400000).toISOString()};
    return options.permissions.engine.run(request, signal, context => runWithPermission({request, ...context}, async () => {
      await context.assert();
      await options.authority?.(callId || request.callId, context.decision);
      return operation(context.signal);
    }));
  }};
}
