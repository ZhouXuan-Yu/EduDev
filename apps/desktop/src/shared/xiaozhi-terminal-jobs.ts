import type {XiaozhiTerminalOutput} from './xiaozhi-terminal';
import {TOOL_EXECUTION_MESSAGES} from './xiaozhi-tool-attempt';

export const TERMINAL_JOB_SCHEMA = 1 as const;
export const TERMINAL_INPUT_FRAME_BYTES = 16384;
export const TERMINAL_ERRORS = {
  system_disk_full: TOOL_EXECUTION_MESSAGES.system_disk_full,
  invalid_input: '终端操作参数无效。',
  not_found: '此终端已不可用，请刷新作业列表。',
  permission_denied: '当前任务没有此终端操作的授权。',
  needs_approval: '此终端操作需要授权，请查看当前任务的权限请求。',
  changed: '终端控制状态已更新，请读取最新状态后继续。',
  source_changed: '终端运行环境或工作目录已变化，需要重新核验。',
  busy: '终端正在处理另一项控制操作。',
  input_limit: '输入超出本次终端支持的大小。',
  input_backpressure: '终端正在接收前一段输入，请稍后继续。',
  unknown_ack: '这段输入的接收状态需要核对，请勿重复发送。',
  expired: '终端授权或运行期限已结束。',
  revoked: '终端授权已撤销。',
  closed: '此终端已结束。',
  cleanup_failed: '终端已经停止，仍有本地清理事项需要处理。',
  unavailable: '终端状态暂时无法读取，请重试。',
} as const;
export type TerminalError = keyof typeof TERMINAL_ERRORS;
export type TerminalResult<T> = {ok: true; data: T} | {ok: false; error: TerminalError};

/** Output cursor changes never increment the business/controller/lease revisions. */
export type TerminalJobView = {
  schemaVersion: typeof TERMINAL_JOB_SCHEMA;
  jobId: string;
  sessionId: string;
  taskId: string;
  revision: number;
  controllerRevision: number;
  leaseRevision: number;
  controller: 'teacher' | 'agent' | null;
  terminal: XiaozhiTerminalOutput;
  tty: boolean;
  background: boolean;
  createdAt: string;
  outputSequence: number;
  inputSequence: number;
  acknowledgedInputSequence: number;
  cleanup: 'pending' | 'complete' | 'needs_check';
  controls: {write: boolean; resize: boolean; eof: boolean; closeInput: boolean; close: boolean; takeControl: boolean};
  inputMaxBytes: number;
  notice?: TerminalError | 'interrupted' | 'needs_check';
};
export type TerminalList = {sessionId: string; jobs: TerminalJobView[]};
export type TerminalReadInput = {sessionId: string; jobId: string; sinceSequence: number; commandId?: string};
export type TerminalRead = {
  sessionId: string;
  job: TerminalJobView;
  sequence: number;
  reset: boolean;
  output: string;
  hasMore: boolean;
  ack?: TerminalInputAck;
};
export type TerminalJobRef = {
  sessionId: string;
  jobId: string;
  expectedRevision: number;
  expectedControllerRevision: number;
  expectedLeaseRevision: number;
  commandId: string;
};
export type TerminalWrite = TerminalJobRef & {chars: string};
export type TerminalResize = TerminalJobRef & {cols: number; rows: number};
export type TerminalInputAck = {
  jobId: string;
  commandId: string;
  sequence: number;
  state: 'acknowledged' | 'unknown';
};
export type TerminalWriteResult = {job: TerminalJobView; ack: TerminalInputAck};
export type TerminalUpdate = {sessionId: string; job: TerminalJobView};

export type XiaozhiTerminalApi = {
  listXiaozhiTerminals: (sessionId: string) => Promise<TerminalResult<TerminalList>>;
  readXiaozhiTerminal: (input: TerminalReadInput) => Promise<TerminalResult<TerminalRead>>;
  writeXiaozhiTerminal: (input: TerminalWrite) => Promise<TerminalResult<TerminalWriteResult>>;
  resizeXiaozhiTerminal: (input: TerminalResize) => Promise<TerminalResult<TerminalJobView>>;
  sendEofXiaozhiTerminal: (input: TerminalJobRef) => Promise<TerminalResult<TerminalWriteResult>>;
  closeInputXiaozhiTerminal: (input: TerminalJobRef) => Promise<TerminalResult<TerminalJobView>>;
  closeXiaozhiTerminal: (input: TerminalJobRef) => Promise<TerminalResult<TerminalJobView>>;
  takeControlXiaozhiTerminal: (input: TerminalJobRef) => Promise<TerminalResult<TerminalJobView>>;
  onXiaozhiTerminal: (listener: (event: TerminalUpdate) => void) => () => void;
};
