import {StringDecoder} from 'node:string_decoder';
import {setTimeout as delay} from 'node:timers/promises';
import {parseJsonRpcMessage, type JsonRpcMessage, type McpTransport, type McpTransportMessageListener,
  type McpTransportErrorListener, type McpTransportCloseListener} from '@earendil-works/pi-mcp';
import {runNativeSandbox, type SandboxInput, type SandboxStart, type SandboxResult} from './permissions/windows/launcher';
import type {PermissionRuntime} from './permissions/windows/runtime';

/** Public Pi transport. The caller owns the permission lease until terminal cleanup. */
export function createControlledStdioTransport(options: {
  runtime: PermissionRuntime;
  start: SandboxStart;
  signal: AbortSignal;
  assert: () => Promise<void>;
  receipt: (result: SandboxResult) => Promise<void>;
  cleanup: (state: {launched: boolean}) => Promise<void>;
  /** Main-private diagnostic consumer. Production callers redact before any persistence. */
  onStderr?: (bytes: Buffer) => void;
}): McpTransport {
  if (!options.start.session) throw Error('unsupported_constraint');
  const controller = new AbortController();
  const signal = AbortSignal.any([options.signal, controller.signal]);
  const messages = new Set<McpTransportMessageListener>();
  const errors = new Set<McpTransportErrorListener>();
  const closes = new Set<McpTransportCloseListener>();
  const decoder = new StringDecoder('utf8');
  let input: SandboxInput | undefined;
  let running: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  let cleanupTask: Promise<void> | undefined;
  let closed = false, pending = '', stderrBytes = 0;
  let sendTail: Promise<void> = Promise.resolve(), queuedBytes = 0;
  let windowStart = Date.now(), windowMessages = 0;
  const notifyClose = () => {
    if (closed) return;
    closed = true;
    for (const listener of closes) listener();
  };
  const fail = (error: unknown) => {
    const safe = error instanceof Error ? error : Error('invalid_protocol');
    for (const listener of errors) listener(safe);
    controller.abort('transport_failed');
  };
  const cleanup = () => cleanupTask ||= options.cleanup({launched: running !== undefined}).finally(notifyClose);
  return {
    onMessage(listener) {messages.add(listener); return () => messages.delete(listener);},
    onError(listener) {errors.add(listener); return () => errors.delete(listener);},
    onClose(listener) {closes.add(listener); return () => closes.delete(listener);},
    async start() {
      if (running || closed || signal.aborted) throw Error('input_closed');
      await options.assert();
      if (closed || closing || signal.aborted) throw Error('input_closed');
      let ready!: () => void, rejectReady!: (error: Error) => void;
      const started = new Promise<void>((resolve, reject) => {ready = resolve; rejectReady = reject;});
      running = (async () => {
        let terminal: SandboxResult | undefined;
        let receiptRecorded = false;
        try {
          const outcome = await runNativeSandbox({manifest: options.runtime.manifest, directory: options.runtime.directory,
            start: options.start, signal, onSession: session => {input = session;}, onStarted: () => ready(), onResult: result => {terminal = result;},
            onBytes(stream, bytes) {
              if (stream === 'stderr') {
                stderrBytes += bytes.length;
                if (stderrBytes > 65536) fail(Error('output_limit'));
                else options.onStderr?.(bytes);
                return;
              }
              try {
                pending += decoder.write(bytes);
                let newline = pending.indexOf('\n');
                while (newline >= 0) {
                  if (Buffer.byteLength(pending.slice(0, newline)) > 262144) throw Error('message_limit');
                  const message = parseJsonRpcMessage(JSON.parse(pending.slice(0, newline)));
                  pending = pending.slice(newline + 1);
                  if (Date.now() - windowStart >= 1000) {windowStart = Date.now(); windowMessages = 0;}
                  if (++windowMessages > 1000) throw Error('message_limit');
                  for (const listener of messages) listener(message);
                  newline = pending.indexOf('\n');
                }
                if (Buffer.byteLength(pending) > 262144) throw Error('message_limit');
              } catch (error) {fail(error);}
            }});
          await options.receipt(outcome.result);
          receiptRecorded = true;
          if (outcome.result.state === 'failed') throw Error(outcome.result.error || 'execution_failed');
          if (pending.trim() || decoder.end()) throw Error('invalid_protocol');
        } catch (error) {
          if (terminal && !receiptRecorded) {
            try {await options.receipt(terminal);} catch (receiptError) {fail(receiptError);}
          }
          rejectReady(error instanceof Error ? error : Error('execution_failed'));
          if (!closing) fail(error);
        } finally {
          rejectReady(Error('input_closed'));
          try {await cleanup();} catch (error) {fail(error);}
        }
      })();
      await started;
      await options.assert();
    },
    async send(message: JsonRpcMessage) {
      if (!input || closed || closing || signal.aborted) throw Error('input_closed');
      const bytes = Buffer.from(JSON.stringify(parseJsonRpcMessage(message)) + '\n');
      if (bytes.length > 262144 || queuedBytes + bytes.length > 1048576) throw Error('message_limit');
      queuedBytes += bytes.length;
      const pendingSend = sendTail.then(async () => {
        try {
          for (let offset = 0; offset < bytes.length; offset += 16384) {
            await options.assert();
            await input!.write(bytes.subarray(offset, offset + 16384));
          }
        } catch (error) {fail(error); throw error;}
        finally {queuedBytes -= bytes.length;}
      });
      sendTail = pendingSend.catch(() => undefined);
      return pendingSend;
    },
    close() {
      closing ||= (async () => {
        try {input?.close();} catch {controller.abort('cancelled');}
        if (running) {
          await Promise.race([running, delay(200)]);
          controller.abort('cancelled');
          await running;
        } else await cleanup();
      })();
      return closing;
    },
  };
}
