import type {McpTransport, JsonRpcMessage} from '@earendil-works/pi-mcp';
import {randomUUID} from 'node:crypto';
import {plain, exact} from '../permissions/validation';
import {boundedJson} from './validation';
import type {ExtensionLog} from './types';

const logCodes = ['started', 'health_ready', 'hook_started', 'hook_completed', 'hook_failed', 'stopping'];
/** A main-owned protocol peer. Guest messages never select a main method or channel. */
export function createExtensionRpc(transport: McpTransport, options: {signal: AbortSignal; timeoutMs: number; assert: () => Promise<void>}) {
  const pending = new Map<string, {resolve: (value: unknown) => void; reject: (error: Error) => void}>();
  const entries: ExtensionLog[] = [];
  const unsubscribers: (() => void)[] = [];
  let closing: Promise<void> | undefined;
  let stopped = false;
  let failure = 'extension_closed';
  let windowStart = Date.now(), sent = 0, received = 0;
  const count = (direction: 'send' | 'receive') => {
    if (Date.now() - windowStart >= 1000) {windowStart = Date.now(); sent = 0; received = 0;}
    if (direction === 'send' ? ++sent > 32 : ++received > 64) throw Error('extension_rate_limit');
  };
  const settle = () => {
    stopped = true;
    for (const item of pending.values()) item.reject(Error(failure));
    pending.clear();
  };
  const close = (code = 'extension_closed') => {
    if (!closing) {
      failure = code; settle();
      closing = transport.close().finally(() => {
        options.signal.removeEventListener('abort', onAbort);
        for (const unsubscribe of unsubscribers) unsubscribe();
      });
    }
    return closing;
  };
  const onAbort = () => {void close('extension_cancelled').catch(() => undefined);};
  const fail = (code: string) => {void close(code).catch(() => undefined);};
  unsubscribers.push(transport.onMessage((message: JsonRpcMessage) => {
    try {
      count('receive');
      if (!boundedJson(message)) throw Error('extension_message_limit');
      const value = message as unknown as Record<string, unknown>;
      if (value.jsonrpc !== '2.0') throw Error('extension_protocol');
      if ('method' in value) {
        if ('id' in value) {
          if (!exact(value, ['jsonrpc', 'id', 'method', 'params']) || typeof value.method !== 'string'
              || typeof value.id !== 'string' && typeof value.id !== 'number') throw Error('extension_protocol');
          // No guest-to-host IO is supported by protocol v1. A reply prevents a guest wait loop.
          void transport.send({jsonrpc: '2.0', id: value.id as string | number,
            error: {code: -32601, message: 'unsupported_host_method'}}).catch(() => fail('extension_protocol'));
          return;
        }
        const params = value.params;
        if (!exact(value, ['jsonrpc', 'method', 'params']) || value.method !== 'extensions/log'
            || !plain(params) || !exact(params, ['schemaVersion', 'level', 'code'])
            || params.schemaVersion !== 1 || !['info', 'warn', 'error'].includes(String(params.level))
            || typeof params.code !== 'string' || !logCodes.includes(params.code)) throw Error('extension_protocol');
        entries.push({schemaVersion: 1, level: params.level as ExtensionLog['level'], code: params.code, at: new Date().toISOString()});
        if (entries.length > 64) entries.shift();
        return;
      }
      if (!exact(value, ['jsonrpc', 'id', 'error' in value ? 'error' : 'result'])) throw Error('extension_protocol');
      if ('error' in value && (!plain(value.error) || !exact(value.error, ['code', 'message'])
          || !Number.isSafeInteger(value.error.code) || typeof value.error.message !== 'string')) throw Error('extension_protocol');
      if (typeof value.id !== 'string' || !pending.has(value.id)) throw Error('extension_response_id');
      const item = pending.get(value.id)!;
      if ('error' in value) item.reject(Error('extension_guest_error'));
      else item.resolve(value.result);
      pending.delete(value.id);
    } catch (error) {fail(error instanceof Error ? error.message : 'extension_protocol');}
  }));
  unsubscribers.push(transport.onError(() => fail('extension_transport')));
  unsubscribers.push(transport.onClose(() => {settle();}));
  options.signal.addEventListener('abort', onAbort, {once: true});
  return {
    async start() {
      options.signal.throwIfAborted();
      try {await transport.start();} catch (error) {await close('extension_start_failed'); throw error;}
    },
    async request(method: 'extensions/health' | 'extensions/hook', params: Record<string, unknown>, signal?: AbortSignal) {
      if (stopped) throw Error(failure);
      if (!boundedJson(params)) throw Error('extension_message_limit');
      await options.assert();
      if (stopped) throw Error(failure);
      if (pending.size >= 4) throw Error('extension_busy');
      count('send');
      if (signal?.aborted) {await close('extension_cancelled'); throw Error('extension_cancelled');}
      const id = 'extension_' + randomUUID();
      let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
      const result = new Promise<unknown>((success, failed) => {resolve = success; reject = failed;});
      pending.set(id, {resolve, reject});
      const cancel = () => fail('extension_cancelled');
      signal?.addEventListener('abort', cancel, {once: true});
      if (signal?.aborted) cancel();
      const timer = setTimeout(() => fail('extension_timeout'), options.timeoutMs); timer.unref();
      // Observe result before a send failure or synchronous transport response can settle it.
      const settled = result.then(value => ({value}), error => ({error: error as Error}));
      try {
        await transport.send({jsonrpc: '2.0', id, method, params});
        const outcome = await settled;
        if ('error' in outcome) throw outcome.error;
        await options.assert();
        return outcome.value;
      } catch (error) {
        await close(error instanceof Error && /^extension_[a-z_]+$/u.test(error.message) ? error.message : 'extension_transport');
        throw error;
      } finally {clearTimeout(timer); signal?.removeEventListener('abort', cancel); pending.delete(id);}
    },
    logs: () => structuredClone(entries),
    close: () => close(),
  };
}
