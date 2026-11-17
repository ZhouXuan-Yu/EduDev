import {randomUUID} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {TerminalJobView} from '../../../shared/xiaozhi-terminal-jobs';
import {TERMINAL_PARAMETERS} from '../tools/terminal';
import type {AcquisitionContext} from '../capabilities/acquisition/service';
import type {TerminalService} from './service';

const jobId = {type: 'string', pattern: '^term_[a-f0-9-]{36}$'};
const commandId = {type: 'string', pattern: '^xicmd_[a-f0-9-]{36}$'};
const receipt = (job: TerminalJobView) => ({content: [{type: 'text' as const, text: JSON.stringify(job)}],
  details: {success: !['failed', 'cancelled', 'timed_out'].includes(job.terminal.state), terminal: job.terminal, job},
  ...(['failed', 'cancelled', 'timed_out'].includes(job.terminal.state) ? {isError: true} : {})});

/** Extends the original foreground definition and keeps its unchanged default entry point. */
export function createPersistentTerminalTools(options: {
  service: TerminalService;
  sessionId: string;
  current: (callId: string) => Promise<AcquisitionContext>;
}, foreground: ToolDefinition): ToolDefinition[] {
  const execute: ToolDefinition = {...foreground,
    description: foreground.description + '\n需要交互或跨回答持续运行时传tty=true或background=true。返回jobId后用write_stdin向同一任务作业输入，list_terminals读取状态，close_terminal停止。yield_time_ms仅控制本次等待输出的时长，lease_ms控制作业寿命。原timeout仅用于默认前台调用。教师可在回答后直接操作终端，后续模型请求须明确续接原Task。',
    parameters: {...TERMINAL_PARAMETERS, properties: {...TERMINAL_PARAMETERS.properties,
      tty: {type: 'boolean'}, background: {type: 'boolean'},
      yield_time_ms: {type: 'integer', minimum: 0, maximum: 30000},
      lease_ms: {type: 'integer', minimum: 1000, maximum: 86400000}}} as ToolDefinition['parameters'],
    async execute(callId, raw, signal, update, context) {
      const args = raw as {cmd: string; workdir?: string; tty?: boolean; background?: boolean; yield_time_ms?: number; lease_ms?: number};
      if (!args.tty && !args.background) return foreground.execute(callId, raw, signal, update, context);
      signal?.throwIfAborted();
      const job = await options.service.start(options.sessionId, callId, args);
      update?.(receipt(job));
      const wait = args.yield_time_ms ?? 1000;
      if (wait > 0) await new Promise<void>(resolve => setTimeout(resolve, wait));
      const read = await options.service.api.readXiaozhiTerminal({sessionId: options.sessionId, jobId: job.jobId, sinceSequence: 0});
      if (!read.ok) throw Error(read.error);
      return receipt(read.data.job);
    },
  };
  return [execute, {
    name: 'write_stdin', label: '向终端输入',
    description: '向本任务已有终端输入UTF-8文本，换行用\\r。原shell中的变量和工作目录保持。返回确切commandId、sequence及ack；unknown时先读取核对，不能重复输入。跨Task或会话终端不可操作。Ctrl+C为\\u0003，typed EOF由教师终端专用操作提供。',
    parameters: {type: 'object', additionalProperties: false, required: ['job_id', 'chars'], properties: {
      job_id: jobId, command_id: commandId, chars: {type: 'string', minLength: 1, maxLength: 16384}}} as ToolDefinition['parameters'],
    async execute(callId, raw, signal) {
      signal?.throwIfAborted();
      const args = raw as {job_id: string; chars: string; command_id?: string};
      if (Buffer.byteLength(args.chars, 'utf8') > 16384) throw Error('input_limit');
      const controller = await options.service.agent(options.sessionId, callId, args.job_id);
      const result = await controller.write(args.command_id || 'xicmd_' + randomUUID(), args.chars);
      return {content: [{type: 'text', text: JSON.stringify(result)}], details: {
        success: result.ack.state === 'acknowledged', terminal: result.job.terminal, ack: result.ack},
      ...(result.ack.state === 'unknown' ? {isError: true} : {})};
    },
  }, {
    name: 'list_terminals', label: '读取任务终端', description: '读取当前Task持久终端的实际状态、输出、输入ACK和清理状态；不启动或恢复进程。',
    parameters: {type: 'object', additionalProperties: false, properties: {}} as ToolDefinition['parameters'],
    async execute(callId) {
      const context = await options.current(callId);
      const jobs = await options.service.agentList(context.owner);
      return {content: [{type: 'text', text: JSON.stringify({jobs})}], details: {success: true, jobs}};
    },
  }, {
    name: 'close_terminal', label: '结束任务终端', description: '停止本Task中的明确终端作业，等待实际进程树和PTY清理，并核对受控文件变动。与关闭输入通道、发送EOF分别记录。',
    parameters: {type: 'object', additionalProperties: false, required: ['job_id'], properties: {job_id: jobId, command_id: commandId}} as ToolDefinition['parameters'],
    async execute(callId, raw, signal) {
      signal?.throwIfAborted();
      const args = raw as {job_id: string; command_id?: string};
      const controller = await options.service.agent(options.sessionId, callId, args.job_id);
      const job = await controller.close(args.command_id || 'xicmd_' + randomUUID());
      return {content: [{type: 'text', text: JSON.stringify(job)}], details: {success: job.cleanup === 'complete', terminal: job.terminal, job},
        ...(job.cleanup === 'complete' ? {} : {isError: true})};
    },
  }];
}
