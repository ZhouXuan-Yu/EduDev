import fs from 'node:fs';
import path from 'node:path';
import { createBashToolDefinition, createPowerShellToolDefinition, type ToolDefinition, type PowerShellOperations } from '@earendil-works/pi-coding-agent';
import { TERMINAL_OUTPUT_LIMIT, type XiaozhiTerminalOutput } from '../../../shared/xiaozhi-terminal';
import {currentPermission} from '../permissions/current';

type Options = {
  workspace: string;
  secret: string;
  sanitize: (text: string) => Promise<string>;
  beforeExecute: () => void;
  operations?: PowerShellOperations;
};
export const TERMINAL_PARAMETERS = {
  type: 'object', additionalProperties: false, required: ['cmd'],
  properties: {
    cmd: {type: 'string', minLength: 1, maxLength: 16384},
    workdir: {type: 'string', minLength: 1, maxLength: 2048},
    timeout: {type: 'integer', minimum: 1, maximum: 120}
  }
};

/** Foreground terminal execution shares Pi's process-tree cancellation and output accumulator. */
export function createTerminalTool(options: Options): ToolDefinition {
  const root = fs.realpathSync(options.workspace);
  const shell: XiaozhiTerminalOutput['shell'] = process.platform === 'win32' ? 'powershell' : 'bash';
  const clean = async (text: string) => {
    const masked = options.secret ? text.split(options.secret).join('[redacted]') : text;
    return options.sanitize(masked);
  };
  return {
    name: 'exec_command', label: '运行终端命令',
    description: `在已授工作目录的受控执行副本中运行${shell === 'powershell' ? 'PowerShell' : 'Bash'}脚本，支持计算与文件加工，完成后按当前授权和源版本提交变动。cmd填写实际命令，workdir可选目录下的子目录，timeout为秒。返回实际输出、退出码及截断状态，运行中可停止。前台非交互，每次为独立shell。直接网络连接受系统边界限制，获准网络请求使用Invoke-XiaozhiRequest -Uri URL -Method GET或POST -Body 文本，经主进程分别核对网络与外发范围。需要依赖时使用已授权环境固定recipe。`,
    parameters: TERMINAL_PARAMETERS as ToolDefinition['parameters'],
    async execute(id, values, signal, update, context) {
      options.beforeExecute();
      if (shell === 'powershell' && !options.operations) throw Error('unsupported_constraint');
      signal?.throwIfAborted();
      const args = values as { cmd: string; workdir?: string; timeout?: number };
      const cwd = fs.realpathSync(path.resolve(root, args.workdir || '.'));
      const relative = path.relative(root, cwd);
      if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) throw Error('permission_denied');
      if (!fs.statSync(cwd).isDirectory()) throw Error('invalid_input');
      const sdkOptions = {
        operations: options.operations,
        exposeSessionEnvironment: false,
        spawnHook: (spawn: { command: string; cwd: string; env: NodeJS.ProcessEnv }) => ({
          ...spawn, cwd,
          env: Object.fromEntries(Object.entries(spawn.env).filter(([key]) =>
            !/API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTHORIZATION|^OMNI_EDU|^CODEX|^PI_|^ELECTRON_|^NODE_OPTIONS$/i.test(key))),
        }),
      };
      const sdk = shell === 'powershell' ? createPowerShellToolDefinition(cwd, sdkOptions) : createBashToolDefinition(cwd, sdkOptions);
      const started = performance.now();
      const base = { version: 1 as const, shell, command: (await clean(args.cmd)).slice(0, 16384), cwd: (await clean(cwd)).slice(0, 4096) };
      let current: XiaozhiTerminalOutput = { ...base, output: '', state: 'running', truncated: false };
      let pending = Promise.resolve();
      let progressError: unknown;
      const emit = (terminal: XiaozhiTerminalOutput) => {
        current = terminal;
        update?.({ content: [{ type: 'text', text: terminal.output }], details: { terminal } });
      };
      emit(current);
      const receipt = async (terminal: XiaozhiTerminalOutput, failureCode?: string) => ({
        content: [{ type: 'text' as const, text: JSON.stringify(terminal) },
          ...(currentPermission()?.execution ? [{type: 'text' as const, text: await clean(JSON.stringify({execution: currentPermission()!.execution}))}] : [])],
        details: { success: terminal.state === 'completed', terminal,
          ...(terminal.state === 'completed' ? {} : { error: { code: failureCode || (terminal.state === 'cancelled' ? 'cancelled' : terminal.state === 'timed_out' ? 'timeout' : 'execution_failed') } }) },
        ...(terminal.state === 'completed' ? {} : { isError: true }),
      });
      try {
        const result = await sdk.execute(id, { command: args.cmd, timeout: args.timeout || 60 }, signal, progress => {
          const text = progress.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
          if (!text) return;
          // Pi already throttles progress. Serialize sanitization and drain it
          // before the final receipt so snapshots cannot arrive out of order.
          pending = pending.then(async () => {
            if (progressError) return;
            const output = await clean(text.slice(-TERMINAL_OUTPUT_LIMIT));
            if (!signal?.aborted) emit({ ...base, output: output.slice(-TERMINAL_OUTPUT_LIMIT), state: 'running',
              truncated: text.length > TERMINAL_OUTPUT_LIMIT || Boolean(progress.details?.truncation) });
          }).catch(error => { progressError = error; });
        }, context as Parameters<typeof sdk.execute>[4]);
        await pending;
        if (progressError) throw progressError;
        const data = result.structuredContent as { output: string; truncated: boolean; exit_code: number };
        const output = await clean(data.output.slice(-TERMINAL_OUTPUT_LIMIT));
        const terminal: XiaozhiTerminalOutput = { ...base, output: output.slice(-TERMINAL_OUTPUT_LIMIT),
          state: data.exit_code === 0 ? 'completed' : 'failed', exitCode: data.exit_code,
          truncated: data.truncated || data.output.length > TERMINAL_OUTPUT_LIMIT,
          durationMs: Math.round(performance.now() - started) };
        emit(terminal);
        return receipt(terminal);
      } catch (error) {
        await pending;
        const message = error instanceof Error ? error.message : 'Command failed';
        const state = signal?.aborted || /Command aborted$/.test(message) ? 'cancelled'
          : /Command timed out/.test(message) ? 'timed_out' : 'failed';
        const terminal: XiaozhiTerminalOutput = { ...current, state, durationMs: Math.round(performance.now() - started),
          output: (await clean(message)).slice(-TERMINAL_OUTPUT_LIMIT) };
        emit(terminal);
        const code = ['permission_pending', 'permission_denied', 'source_changed', 'unsupported_constraint', 'needs_configuration', 'resource_budget'].includes(message) ? message : undefined;
        return receipt(terminal, code);
      }
    },
  };
}
