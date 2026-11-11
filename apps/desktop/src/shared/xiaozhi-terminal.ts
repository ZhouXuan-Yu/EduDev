export const TERMINAL_OUTPUT_LIMIT = 32768;

export interface XiaozhiTerminalOutput {
  version: 1;
  shell: 'powershell' | 'bash';
  command: string;
  cwd: string;
  output: string;
  state: 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
  truncated: boolean;
  exitCode?: number;
  durationMs?: number;
}

export function validTerminalOutput(value: unknown): value is XiaozhiTerminalOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const keys = ['version', 'shell', 'command', 'cwd', 'output', 'state', 'truncated', 'exitCode', 'durationMs'];
  return Object.keys(row).every(key => keys.includes(key)) && row.version === 1
    && ['powershell', 'bash'].includes(String(row.shell))
    && typeof row.command === 'string' && row.command.length <= 16384
    && typeof row.cwd === 'string' && row.cwd.length <= 4096
    && typeof row.output === 'string' && row.output.length <= TERMINAL_OUTPUT_LIMIT
    && ['running', 'completed', 'failed', 'cancelled', 'timed_out'].includes(String(row.state))
    && typeof row.truncated === 'boolean'
    && (row.exitCode === undefined || Number.isSafeInteger(row.exitCode))
    && (row.durationMs === undefined || typeof row.durationMs === 'number'
      && Number.isFinite(row.durationMs) && row.durationMs >= 0);
}
