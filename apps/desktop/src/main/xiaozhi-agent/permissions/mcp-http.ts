import {Agent, fetch as undiciFetch} from 'undici';
import {isIP} from 'node:net';
import {resolveOfficePublicAddresses} from '../../office-agent/office-network';
import {assertCurrentNetwork} from './current';

/** Fixed-origin, DNS-pinned transport. Ambient proxy settings do not select its route. */
export async function fetchMcpHttp(endpoint: string, raw: string | URL | Request, init?: RequestInit): Promise<Response> {
  const target = new URL(typeof raw === 'string' ? raw : raw instanceof URL ? raw.href : raw.url);
  const expected = new URL(endpoint);
  if (target.origin !== expected.origin || target.username || target.password) throw Error('permission_denied');
  const method = init?.method || 'GET';
  await assertCurrentNetwork(target.href, method);
  const signal = init?.signal || AbortSignal.timeout(10000);
  signal.throwIfAborted();
  const hostname = target.hostname.replace(/[\[\]]/gu, '');
  const loopback = ['127.0.0.1', '::1'].includes(hostname) && isIP(hostname) > 0;
  const addresses = hostname === 'localhost' ? [{address: '127.0.0.1', family: 4}]
    : loopback ? [{address: hostname, family: isIP(hostname)}]
    : await resolveOfficePublicAddresses(hostname, signal, 'system');
  await assertCurrentNetwork(target.href, method);
  const address = addresses[0];
  const dispatcher = new Agent({connect: {lookup: (_host, settings, callback) => {
    if (settings.all) callback(null, [{address: address.address, family: address.family}]);
    else callback(null, address.address, address.family);
  }}});
  try {
    const response = await undiciFetch(target, {...init, body: init?.body as string | undefined,
      signal, redirect: 'error', dispatcher});
    const headers = new Headers();
    response.headers.forEach((value, name) => headers.append(name, value));
    if (!response.body) {await dispatcher.close(); return new Response(null, {status: response.status, headers});}
    const reader = response.body.getReader();
    let count = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          signal.throwIfAborted();
          await assertCurrentNetwork(target.href, method);
          const chunk = await reader.read();
          if (chunk.done) {controller.close(); await dispatcher.close(); return;}
          count += chunk.value.byteLength;
          if (count > 2097152) throw Error('too_large');
          controller.enqueue(chunk.value);
        } catch (error) {controller.error(error); await reader.cancel().catch(() => undefined); await dispatcher.destroy();}
      },
      async cancel() {await reader.cancel().catch(() => undefined); await dispatcher.destroy();}
    });
    return new Response(body, {status: response.status, headers});
  } catch (error) {await dispatcher.destroy(); throw error;}
}
