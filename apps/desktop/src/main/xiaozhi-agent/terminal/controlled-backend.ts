import type {
  ControlledTerminalBackendOptions, ControlledTerminalHandle, ControlledTerminalPort,
} from './controlled-types';

export function createControlledTerminalBackend(options: ControlledTerminalBackendOptions): ControlledTerminalHandle {
  let started = false, ended = false, inputClosed = false;
  let port: ControlledTerminalPort | undefined;
  let resolveReady!: (value: {pid: number; helperPid: number}) => void;
  let rejectReady!: (error: unknown) => void;
  let resolvePort!: (value: ControlledTerminalPort) => void;
  let rejectEnded!: (error: unknown) => void;
  const ready = new Promise<{pid: number; helperPid: number}>((resolve, reject) => {
    resolveReady = resolve; rejectReady = reject;
  });
  const input = new Promise<ControlledTerminalPort>(resolve => {resolvePort = resolve;});
  const terminal = new Promise<never>((_, reject) => {rejectEnded = reject;});
  // Consumers may only observe closed after a launch failure.
  void ready.catch(() => {});
  void terminal.catch(() => {});
  const available = async () => {
    options.controller.signal.throwIfAborted();
    if (ended) throw Error('closed');
    await Promise.race([ready, terminal]);
    const value = await Promise.race([input, terminal]);
    options.controller.signal.throwIfAborted();
    if (ended) throw Error('closed');
    return value;
  };
  const closed = Promise.resolve().then(() => {
    options.controller.signal.throwIfAborted();
    return options.launch({
      onStarted(pid, helperPid) {
        if (started || ended || !Number.isSafeInteger(pid) || pid <= 0 || !Number.isSafeInteger(helperPid) || helperPid <= 0)
          throw Error('invalid_protocol');
        started = true;
        resolveReady({pid, helperPid});
      },
      onBytes(_stream, bytes) {
        if (!started || ended || !Buffer.isBuffer(bytes) || bytes.length > 16384) throw Error('invalid_protocol');
        options.onData(Buffer.from(bytes));
      },
      onSession(value) {
        if (port || ended) throw Error('invalid_protocol');
        port = value;
        if (inputClosed) port.close();
        resolvePort(port);
      },
    });
  }).finally(() => {
    ended = true;
    const error = Error('closed');
    rejectReady(error);
    rejectEnded(error);
  });
  // Core retains closed for its durable cleanup decision.
  void closed.catch(() => {});
  return {
    ready,
    async write(value) {
      if (inputClosed) throw Error('input_closed');
      const current = await available();
      if (inputClosed) throw Error('input_closed');
      return Promise.race([current.writeSequenced(value), terminal]);
    },
    async resize(value) {
      const current = await available();
      await Promise.race([current.resize(value), terminal]);
    },
    closeInput() {
      if (inputClosed || ended) return;
      inputClosed = true;
      port?.close();
    },
    cancel(reason) {options.controller.abort(reason);},
    closed,
  };
}
