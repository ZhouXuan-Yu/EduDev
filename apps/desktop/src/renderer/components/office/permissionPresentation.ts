import type {PermissionRequest, PermissionScope} from '../../../shared/xiaozhi-permissions';

export const permissionClassification: Record<PermissionRequest['classification'], string> = {
  public: '公开资料', redacted: '脱敏资料', teacher_private: '教师私有资料', student_private: '学生私有资料'
};
export function permissionAction(action: string) {
  const names: Record<string, string> = {exec_command: '运行受控脚本', mcp_call: '调用外部MCP工具',
    network_broker: '网络请求与资料外发', environment_repair: '修复本地环境', office_copy_file: '复制文件'};
  return names[action] || action;
}
export function permissionResource(scope: PermissionScope) {
  if (scope.kind === 'filesystem') {
    const names = {read: '读取', write: '写入或覆盖', delete: '删除'};
    return `${scope.root} · ${scope.actions.map(action => names[action]).join('、')}`;
  }
  if (scope.kind === 'network') return `网络 ${scope.origin} · ${scope.methods.join('/')} · ${scope.purpose}`;
  if (scope.kind === 'egress') return `资料外发 ${scope.origin} · ${scope.classifications.map(value => permissionClassification[value]).join('、')}`;
  if (scope.kind === 'process') return `受控进程 ${scope.executable} · 工作副本 ${scope.workspace}`;
  if (scope.kind === 'mcp') return `MCP ${scope.serverId} · ${scope.tools.join('、')}`;
  if (scope.kind === 'dependency') return `本地组件 ${scope.package}@${scope.version} · ${scope.source} · ${scope.environment}`;
  if (scope.kind === 'secret') return `安全凭据引用 ${scope.reference} · 使用者 ${scope.consumer}`;
  return `扩展 ${scope.extensionId} · ${scope.actions.join('、')}`;
}
