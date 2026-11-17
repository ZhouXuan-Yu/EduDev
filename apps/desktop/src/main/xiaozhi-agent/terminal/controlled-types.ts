import type {SandboxResult} from '../permissions/windows/launcher';

export type ControlledTerminalPort = {
  writeSequenced: (input: {sequence: number; bytes: Buffer}) => Promise<{sequence: number}>;
  resize: (input: {controlId: string; cols: number; rows: number}) => Promise<void>;
  close: () => void;
};
export type ControlledTerminalResult = {
  result: SandboxResult;
  helperHash: string;
  outputBytes: number;
  started: boolean;
};
/** Main injects one admitted helper launch. This interface carries no database or renderer authority. */
export type ControlledTerminalBackendOptions = {
  controller: AbortController;
  onData: (bytes: Buffer) => void;
  launch: (callbacks: {
    onStarted: (pid: number, helperPid: number) => void;
    onBytes: (stream: 'stdout' | 'stderr' | 'pty', bytes: Buffer) => void;
    onSession: (port: ControlledTerminalPort) => void;
  }) => Promise<ControlledTerminalResult>;
};
export type ControlledTerminalHandle = {
  ready: Promise<{pid: number; helperPid: number}>;
  write: (input: {sequence: number; bytes: Buffer}) => Promise<{sequence: number}>;
  resize: (input: {controlId: string; cols: number; rows: number}) => Promise<void>;
  closeInput: () => void;
  cancel: (reason: 'cancelled' | 'timeout' | 'revoked') => void;
  closed: Promise<ControlledTerminalResult>;
};
