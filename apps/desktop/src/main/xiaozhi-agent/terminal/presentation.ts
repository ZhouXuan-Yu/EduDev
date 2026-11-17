import type {TerminalJobView, TerminalJobRef} from '../../../shared/xiaozhi-terminal-jobs';
import type {TerminalJobRecord} from './job-types';

export function terminalJobView(record: TerminalJobRecord, input: {live: boolean; authorized: boolean}): TerminalJobView {
  const doc = record.document;
  const active = input.live && ['starting', 'running'].includes(doc.state);
  const control = active && input.authorized && Date.parse(doc.expiresAt) > Date.now() && doc.controller.kind === 'teacher' && !doc.inputClosed;
  const notice = doc.notice === 'unknown_ack' && record.acknowledgedInputSequence >= record.inputSequence ? undefined : doc.notice;
  return {
    schemaVersion: 1, jobId: doc.jobId, sessionId: doc.sessionId, taskId: doc.taskId,
    revision: doc.revision, controllerRevision: doc.controllerRevision, leaseRevision: doc.leaseRevision, controller: doc.controller.kind,
    terminal: {version: 1, shell: 'powershell', command: doc.command, cwd: doc.cwd, jobId: doc.jobId, output: record.output,
      state: doc.state === 'starting' ? 'running' : doc.state === 'interrupted' ? 'cancelled' : doc.state,
      truncated: record.truncated, ...(doc.exitCode === undefined ? {} : {exitCode: doc.exitCode}), ...(doc.durationMs === undefined ? {} : {durationMs: doc.durationMs})},
    tty: doc.tty, background: doc.background, createdAt: doc.createdAt,
    outputSequence: record.outputSequence, inputSequence: record.inputSequence, acknowledgedInputSequence: record.acknowledgedInputSequence,
    cleanup: doc.cleanup,
    controls: {write: control && notice !== 'unknown_ack', eof: control && notice !== 'unknown_ack', resize: control,
      closeInput: control, close: active, takeControl: active && input.authorized && doc.controller.kind !== 'teacher'},
    inputMaxBytes: 16384, ...(notice ? {notice} : {}),
  };
}

export const terminalJobRef = (record: TerminalJobRecord, commandId: string): TerminalJobRef => ({
  sessionId: record.document.sessionId, jobId: record.document.jobId,
  expectedRevision: record.document.revision, expectedControllerRevision: record.document.controllerRevision,
  expectedLeaseRevision: record.document.leaseRevision, commandId,
});
