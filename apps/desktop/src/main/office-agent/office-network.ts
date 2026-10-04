import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';

// The same checked DNS answer is used for connection, including each redirect.
// No cookies, proxy credentials, uploads, custom headers or private endpoints.
export function isPublicOfficeAddress(raw: string): boolean {
  try {
    const address = ipaddr.process(raw);
    return address.range() === 'unicast';
  } catch { return false; }
}

export function officeWebUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
    || (url.port && !['80', '443'].includes(url.port)) || raw.length > 2048) {
    throw new Error('permission_denied');
  }
  url.hash = '';
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || (isIP(host) && !isPublicOfficeAddress(host))) throw new Error('permission_denied');
  return url;
}

export type OfficeFetchResponse = {
  status: number; ok: boolean; headers: Headers;
  text(): Promise<string>; json(): Promise<unknown>;
};
export type OfficeDnsMode = 'auto' | 'system' | 'cloudflare' | 'alidns';
type Addresses={address:string;family:number}[];
type ResolverDependencies={system:(host:string)=>Promise<Addresses>;public:(host:string,signal:AbortSignal,mode:'cloudflare'|'alidns')=>Promise<Addresses>};
const virtualAddress=(raw:string)=>{try{return ipaddr.process(raw).kind()==='ipv4'&&ipaddr.process(raw).match(ipaddr.parse('198.18.0.0'),15);}catch{return false;}};
export async function resolveOfficePublicAddresses(host: string, signal: AbortSignal, dnsMode: OfficeDnsMode = 'system',
  dependencies:ResolverDependencies={system:host=>lookup(host,{all:true}),public:publicResolverAddresses}) {
  signal.throwIfAborted();host=host.toLowerCase().replace(/\.$/,'');
  if(!isIP(host)&&(!host.includes('.')||/\.(?:localhost|local|internal|lan|home|test|invalid)$/.test(host)))throw new Error('permission_denied');
  let addresses:Addresses;
  if(isIP(host))addresses=[{address:host,family:isIP(host)}];
  else if(dnsMode==='auto'){
    try{addresses=await waitOfficeAbort(dependencies.system(host),signal);}
    catch(error){signal.throwIfAborted();const code=(error as {code?:string}).code;
      if(!['ENOTFOUND','EAI_AGAIN','ETIMEOUT','ETIMEDOUT'].includes(code||''))throw error;
      addresses=await dependencies.public(host,signal,'alidns');
    }
    // Never send a private answer to a public resolver. Only the proxy's reserved
    // virtual-only range is retried; connect to the newly checked public IP.
    if(addresses.length&&addresses.every(item=>virtualAddress(item.address)))addresses=await dependencies.public(host,signal,'alidns');
  }else addresses=dnsMode==='system'?await waitOfficeAbort(dependencies.system(host),signal):await dependencies.public(host,signal,dnsMode);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(item => !isPublicOfficeAddress(item.address)))
    throw new Error(addresses.length&&addresses.every(item=>virtualAddress(item.address))?'dns_blocked':'permission_denied');
  return addresses;
}

export function waitOfficeAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export async function fetchOfficePublicUrl(raw: string, options: {
  signal: AbortSignal;
  dnsMode?: OfficeDnsMode;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
}): Promise<OfficeFetchResponse> {
  options.signal.throwIfAborted();
  const url = officeWebUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await resolveOfficePublicAddresses(host, options.signal, options.dnsMode);
  const chosen = addresses[0];
  const dispatcher = new Agent({ connect: { lookup: (_hostname, settings, callback) => {
    if (settings.all) callback(null, [{ address: chosen.address, family: chosen.family }]);
    else callback(null, chosen.address, chosen.family);
  } } });
  try {
    const response = await undiciFetch(url, {
      method: options.method || 'GET', body: options.body, headers: options.headers || {
        'user-agent': 'XiaozhiOffice/0.1', accept: 'text/html,application/json,text/plain',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }, redirect: 'manual', signal: options.signal, dispatcher,
    });
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > 1024 * 1024) throw new Error('too_large');
    const chunks: Uint8Array[] = []; let size = 0;
    for await (const chunk of response.body || []) {
      options.signal.throwIfAborted();
      size += chunk.length;
      if (size > 1024 * 1024) throw new Error('too_large');
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return { status: response.status, ok: response.ok, headers: new Headers(response.headers),
      text: async () => body, json: async () => JSON.parse(body) as unknown };
  } finally { await dispatcher.destroy(); }
}

// Explicit per-host setting for environments whose system DNS returns proxy
// virtual addresses. No OS DNS, proxy or account configuration is modified.
async function publicResolverAddresses(host: string, signal: AbortSignal, mode: 'cloudflare' | 'alidns') {
  const base = mode === 'alidns' ? 'https://223.5.5.5/resolve' : 'https://1.1.1.1/dns-query';
  const response = await fetchOfficePublicUrl(`${base}?name=${encodeURIComponent(host)}&type=A`, {
    signal, headers: { accept: 'application/dns-json' },
  });
  if (!response.ok) throw new Error('network');
  const payload = await response.json() as { Status?: number; Answer?: { type: number; data: string }[] };
  if (payload.Status !== 0) throw new Error('network');
  const answers = (payload.Answer || []).filter(item => item.type === 1).map(item => ({ address: item.data, family: 4 }));
  if (!answers.length || answers.some(item => !isPublicOfficeAddress(item.address))) throw new Error('permission_denied');
  return answers;
}
