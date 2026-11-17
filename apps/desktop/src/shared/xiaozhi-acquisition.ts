export const ACQUISITION_SCHEMA = 'xiaozhi.acquisition.v1' as const;
export type DiscoverySource = 'official_mcp' | 'github' | 'community' | 'reviewed';
export type CapabilityCandidate = {
  id: string;
  source: DiscoverySource;
  externalId: string;
  name: string;
  description: string;
  version: string;
  repository: string | null;
  packageName: string | null;
  transport: 'stdio' | 'http' | 'unknown';
  sourceHash: string;
  fetchedAt: string;
  expiresAt: string;
};
export type AcquisitionPhase = 'discovered' | 'quarantined' | 'resolving' | 'needs_approval' | 'downloading' | 'verifying'
  | 'registering' | 'ready' | 'failed' | 'cancelled' | 'interrupted' | 'revoked';
export type AcquisitionOperationView = {
  id: string;
  candidateId: string;
  revision: number;
  phase: AcquisitionPhase;
  error: string | null;
  artifactId: string | null;
  updatedAt: string;
  running?: boolean;
};
export type AcquisitionArtifactView = {
  id: string;
  name: string;
  version: string;
  source: string;
  license: string;
  revision: number;
  status: 'verifying' | 'ready' | 'revoked' | 'failed';
  schemaHash: string | null;
  installedBytes: number;
  expiresAt: string;
};
export type AcquisitionView = {
  schemaVersion: typeof ACQUISITION_SCHEMA;
  context?: {sessionId: string; taskId: string; runId: string; generation: number} | null;
  candidates: CapabilityCandidate[];
  operations: AcquisitionOperationView[];
  artifacts: AcquisitionArtifactView[];
  sourceStatus?: {source: DiscoverySource; status: 'online' | 'cached' | 'unavailable'; error?: string}[];
  extensions?: AcquisitionExtensionView[];
};
export type AcquisitionExtensionView = {
  artifactId: string; extensionId: string; version: string; sourceHash: string; directoryFingerprint: string;
  sourceKind: 'local_import'; trust: 'unknown'; license: string; hooks: ('context.transform' | 'event.observe')[];
  phase: 'quarantined' | 'preparing' | 'prepared' | 'needs_approval' | 'cancelled' | 'failed';
  revision: number; selectionRevision: number; active: boolean; enabled: boolean; revoked: boolean; error: string | null;
};
export type AcquisitionSearch = {sessionId: string; query: string; sources?: DiscoverySource[]};
export type AcquisitionMutation = {action: 'prepare'; sessionId: string; candidateId: string}
  | {action: 'cancel'; sessionId: string; operationId: string; revision: number}
  | {action: 'revoke'; sessionId: string; artifactId: string; revision: number}
  | {action: 'extension_import'; sessionId: string}
  | {action: 'extension_prepare' | 'extension_cancel'; sessionId: string; artifactId: string; revision: number}
  | {action: 'extension_select' | 'extension_disable' | 'extension_revoke'; sessionId: string; extensionId: string; version: string; revision: number};
export type AcquisitionApiResult<T> = {ok: true; value: T} | {ok: false; error: string};
export const ACQUISITION_ERRORS: Record<string, string> = {
  invalid_input: '输入不符合当前能力合同。', permission_denied: '当前授权或任务已失效。', permission_pending: '请处理现有权限审批后重试。',
  task_required: '请在小智当前任务中准备所需能力。', busy: '该能力已有准备操作正在处理。', conflict: '状态已更新，请刷新后重试。',
  source_unavailable: '公开来源暂时不可达，可保留已有能力继续工作。', source_changed: '来源或安装内容已变化，需重新验证。',
  source_requires_review: '此候选需要来源与权限审查，已保留在隔离候选中。', license_requires_review: '许可证需要进一步核查。',
  install_scripts_require_review: '安装脚本需要隔离审查与明确授权。', unsupported_runtime: '当前平台或运行依赖尚未就绪。',
  missing_dependency: '运行依赖尚未就绪。', unsupported_dependency: '依赖尚未具备受管安装合同。', checksum_mismatch: '下载内容与固定完整性记录不一致。',
  archive_invalid: '包内文件布局不符合安全解包要求。', resource_budget: '本次资源预算已达到上限。', no_space: '受管环境可用空间不足。',
  schema_changed: '外部工具参数已变化，需要重新验证与授权。', rate_limited: '公开来源暂时限流，可稍后重试。',
  cancelled: '本次准备已停止。', not_found: '候选或操作记录已失效。', acquisition_failed: '能力准备没有完成，可查看状态后重试。',
  unavailable: '当前能力管理尚不可用。',
  extension_revision_conflict: '扩展版本状态已更新，请刷新后重试。', extension_disabled: '该扩展已停用。',
  extension_unavailable: '该扩展版本不可用。', invalid_package: '扩展包不符合导入合同。',
  extension_workspace_not_empty: '扩展隔离工作目录需要重新准备。',
  interrupted: '上次准备已中断，请在当前任务中重试并核对原版本。',
};
