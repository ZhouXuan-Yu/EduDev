export type PiPermissionMode = 'request' | 'acceptEdits' | 'approveForMe' | 'fullAccess';

export const PI_PERMISSION_MODES: ReadonlyArray<{
  id: PiPermissionMode;
  label: string;
  description: string;
}> = [
  { id: 'request', label: '请求批准', description: '在设置未允许的编辑和命令前询问' },
  { id: 'acceptEdits', label: '接受编辑', description: '批准文件编辑和文件命令；其余操作会询问' },
  { id: 'approveForMe', label: '替我批准', description: '代你审核批准请求' },
  { id: 'fullAccess', label: '完全访问', description: '编辑或运行命令前从不询问' },
];

const STORAGE_KEY = 'xiaozhi.permissionMode.v1';

export function readPiPermissionMode(): PiPermissionMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return PI_PERMISSION_MODES.some(mode => mode.id === value) ? value as PiPermissionMode : 'request';
  } catch {
    return 'request';
  }
}

export function writePiPermissionMode(mode: PiPermissionMode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* local preference only */ }
}

export function piPermissionModeLabel(mode: PiPermissionMode) {
  return PI_PERMISSION_MODES.find(item => item.id === mode)?.label ?? '请求批准';
}
