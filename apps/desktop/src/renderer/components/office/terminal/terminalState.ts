import {TERMINAL_ERRORS, type TerminalJobRef, type TerminalJobView} from '../../../../shared/xiaozhi-terminal-jobs';

export function terminalMessage(code: string) {
  if (code === 'interrupted') return '应用重开后终端已中断，请在原任务中明确继续。';
  if (code === 'needs_check') return '终端执行或清理结果需要核对。';
  return TERMINAL_ERRORS[code as keyof typeof TERMINAL_ERRORS] || TERMINAL_ERRORS.unavailable;
}

export function mergeJob(previous: TerminalJobView | undefined, incoming: TerminalJobView) {
  if (!previous || previous.jobId !== incoming.jobId || previous.sessionId !== incoming.sessionId) return incoming;
  const current = incoming.revision >= previous.revision && incoming.controllerRevision >= previous.controllerRevision
    && incoming.leaseRevision >= previous.leaseRevision;
  const base = current ? incoming : previous;
  const outputCurrent = incoming.outputSequence > previous.outputSequence || incoming.outputSequence === previous.outputSequence && current;
  const terminal = previous.terminal.state !== 'running' && base.terminal.state === 'running' ? previous.terminal : base.terminal;
  return {...base,
    terminal: {...terminal, output: outputCurrent ? incoming.terminal.output : previous.terminal.output},
    outputSequence: Math.max(previous.outputSequence, incoming.outputSequence),
    inputSequence: Math.max(previous.inputSequence, incoming.inputSequence),
    acknowledgedInputSequence: Math.max(previous.acknowledgedInputSequence, incoming.acknowledgedInputSequence)};
}

export function commandRef(job: TerminalJobView): TerminalJobRef {
  return {sessionId: job.sessionId, jobId: job.jobId, expectedRevision: job.revision,
    expectedControllerRevision: job.controllerRevision, expectedLeaseRevision: job.leaseRevision,
    commandId: 'xicmd_' + crypto.randomUUID()};
}

export function splitInput(chars: string, maximum: number) {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw Error('input_limit');
  const encoder = new TextEncoder(), chunks: string[] = [];
  let chunk = '', bytes = 0;
  for (const point of chars) {
    const length = encoder.encode(point).length;
    if (length > maximum) throw Error('input_limit');
    if (bytes + length > maximum) {chunks.push(chunk); chunk = ''; bytes = 0;}
    chunk += point; bytes += length;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export async function bounded<T>(work: Promise<T> | undefined) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {return await Promise.race([Promise.resolve(work), new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(Error('unavailable')), 10000);
  })]);} finally {clearTimeout(timer);}
}

export type TerminalFrame = {deliveryId: number; reset: boolean; text: string};

type FeedbackArea = 'read' | 'input' | 'control' | 'resize';
type Feedback = {message: string; owner?: string | symbol};
export type TerminalFeedback = Partial<Record<FeedbackArea, Feedback>>;
export type TerminalFeedbackAction = {type: 'reset'}
  | {type: 'set'; area: FeedbackArea; message: string; owner?: string | symbol}
  | {type: 'clear'; area: FeedbackArea; owner?: string | symbol};

/** Each completion clears only its own feedback; input ACKs additionally match their command. */
export function terminalFeedback(state: TerminalFeedback, action: TerminalFeedbackAction): TerminalFeedback {
  if (action.type === 'reset') return {};
  if (action.type === 'set') return {...state, [action.area]: {message: action.message, owner: action.owner}};
  if (action.owner !== undefined && state[action.area]?.owner !== action.owner) return state;
  const next = {...state}; delete next[action.area]; return next;
}
