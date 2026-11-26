export const XIAOZHI_MCP_SCHEMA = 'xiaozhi.mcp.v1' as const;
export type XiaozhiMcpTransport = 'stdio' | 'http';
export type XiaozhiMcpTool = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  selected: boolean;
};
export type XiaozhiMcpServer = {
  id: string;
  name: string;
  transport: XiaozhiMcpTransport;
  endpoint: string;
  revision: number;
  status: 'unverified' | 'ready' | 'failed' | 'schema_changed' | 'revoked';
  schemaHash?: string;
  trustedSchemaHash?: string;
  credentialConfigured?: boolean;
  credentialReference?: string;
  tools: XiaozhiMcpTool[];
  lastError?: 'configuration' | 'storage_unavailable' | 'timeout' | 'transport' | 'authentication' | 'schema_changed' | 'unsupported_constraint' | 'permission_pending' | 'permission_denied';
};
export type XiaozhiMcpCatalog = { schemaVersion: typeof XIAOZHI_MCP_SCHEMA; revision: number; servers: XiaozhiMcpServer[] };
export type XiaozhiMcpAddInput =
  | { name: string; transport: 'stdio'; command: string; args?: string[]; cwd?: string; secret?: string }
  | { name: string; transport: 'http'; url: string; bearerToken?: string };
export type XiaozhiMcpInput = { schemaVersion: typeof XIAOZHI_MCP_SCHEMA; revision: number; serverId: string };
export type XiaozhiMcpTrustInput = XiaozhiMcpInput & { schemaHash: string; tools: string[] };
export type XiaozhiMcpCredentialInput = XiaozhiMcpInput & ({action: 'set'; value: string} | {action: 'clear'});
export type XiaozhiMcpError = 'invalid_input' | 'permission_denied' | 'permission_pending' | 'busy' | 'conflict' | 'configuration' | 'storage_unavailable' | 'timeout' | 'transport' | 'authentication' | 'schema_changed' | 'not_found' | 'unsupported_constraint' | 'provider_unavailable';
export type XiaozhiMcpResult<T> = { ok: true; value: T } | { ok: false; error: XiaozhiMcpError };
export const XIAOZHI_MCP_ERRORS: Record<XiaozhiMcpError, string> = {
  provider_unavailable: '当前外部工具暂时不可用。请稍后重新连接核验，已保存的工具选择仍保留。',
  unsupported_constraint: '此连接尚未满足受管程序、依赖或隔离运行要求，请在能力目录准备已验证的本地能力。',
  permission_pending: '此调用需要授权，请在当前任务或资料与权限页处理集中申请。',
  invalid_input: 'MCP 配置无效，请检查名称和连接参数。', permission_denied: '当前页面无权管理 MCP 服务。', busy: '小智正在执行任务，请结束后再管理 MCP 服务。',
  conflict: 'MCP 配置已在其他位置更新，请刷新后重试。', configuration: 'MCP 服务配置无法读取或格式不受支持。', storage_unavailable: '本机安全存储不可用，密钥没有保存。',
  timeout: 'MCP 服务连接超时。', transport: '无法连接 MCP 服务，请检查地址或本地程序。', authentication: 'MCP 服务认证失败。', schema_changed: 'MCP 工具目录发生变化，旧信任已撤销。', not_found: '没有找到该 MCP 服务。',
};
