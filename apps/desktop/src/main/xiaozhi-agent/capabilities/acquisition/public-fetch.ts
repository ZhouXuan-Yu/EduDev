import {waitOfficeAbort} from '../../../office-agent/office-network';
import type {PublicFetch} from './npm-source';

export const DISCOVERY_ORIGINS = ['https://registry.npmjs.org', 'https://registry.modelcontextprotocol.io',
  'https://api.github.com', 'https://raw.githubusercontent.com', 'https://nodejs.org'] as const;

/** Public source GETs carry fixed application headers and omit ambient credentials. */
export function createPublicSourceFetch(options: {fetch?: typeof fetch; origins?: readonly string[]} = {}): PublicFetch {
  const fetcher = options.fetch || globalThis.fetch;
  const origins = options.origins || DISCOVERY_ORIGINS;
  return async (input, signal, maximumBytes, accept = 'application/json') => {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 128 * 1048576) throw Error('resource_budget');
    const url = new URL(input);
    if (!origins.includes(url.origin) || url.username || url.password || url.hash || url.href.length > 4096) throw Error('source_untrusted');
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(maximumBytes > 8 * 1048576 ? 180000 : 30000)]);
    const pending = fetcher(url.href, {method: 'GET', credentials: 'omit', redirect: 'error', signal: deadline,
      headers: {Accept: accept, 'User-Agent': 'EduDev-Capability-Acquisition/1.0'}});
    void pending.then(response => {if (deadline.aborted) void response.body?.cancel().catch(() => undefined);}, () => undefined);
    let response: Response;
    try {response = await waitOfficeAbort(pending, deadline);}
    catch {signal.throwIfAborted(); throw Error('source_unavailable');}
    if (!response.ok || !response.body) {
      void response.body?.cancel().catch(() => undefined);
      throw Error(response.status === 429 || response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0' ? 'rate_limited' : 'source_unavailable');
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let bytes = 0;
    try {
      while (true) {
        const entry = await waitOfficeAbort(reader.read(), deadline);
        deadline.throwIfAborted();
        if (entry.done) return Buffer.concat(chunks);
        bytes += entry.value.length;
        if (bytes > maximumBytes) throw Error('resource_budget');
        chunks.push(Buffer.from(entry.value));
      }
    } catch (error) {
      void reader.cancel().catch(() => undefined);
      signal.throwIfAborted();
      throw error instanceof Error && error.message === 'resource_budget' ? error : Error('source_unavailable');
    } finally {reader.releaseLock();}
  };
}
