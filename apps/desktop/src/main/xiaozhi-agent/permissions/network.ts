import {Agent, fetch as undiciFetch} from 'undici';
import {isIP} from 'node:net';
import type {PermissionOwner, PermissionRequest} from '../../../shared/xiaozhi-permissions';
import type {PermissionEngine} from './engine';
import {permissionHash, plain, exact, text} from './validation';
import {fetchOfficePublicUrl} from '../../office-agent/office-network';
import {currentPermission} from './current';
import {permissionRequestSummary} from './summary';

export type BrokerRequest = {url: string; method: 'GET' | 'POST'; body: string | null; purpose: string; classification: PermissionRequest['classification']};
const secret = /\bsk-[\w-]{20,}|["']?(?:api[_-]?key|authorization|password|access[_-]?token)["']?\s*[:=]\s*["']?[^\s"']{8,}/iu;

export function createPermissionNetworkBroker(options: {engine: PermissionEngine; sanitize: (text: string) => Promise<string>; purpose?: string}) {
  return {
    async fetch(owner: PermissionOwner, callId: string, raw: BrokerRequest, signal: AbortSignal) {
      if (!plain(raw) || !exact(raw, ['url', 'method', 'body', 'purpose', 'classification']) || !text(raw.url)
          || raw.url.length > 2048 || !['GET', 'POST'].includes(raw.method) || !text(raw.purpose)
          || !['public', 'redacted', 'teacher_private', 'student_private'].includes(raw.classification)
          || raw.body !== null && (typeof raw.body !== 'string' || Buffer.byteLength(raw.body) > 65536)
          || raw.method === 'GET' && raw.body !== null || raw.purpose !== (options.purpose || 'script_network')) throw Error('invalid_input');
      const url = new URL(raw.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw Error('permission_denied');
      const payload = raw.url + '\n' + (raw.body || '') + '\n' + raw.purpose;
      if (secret.test(payload) || await options.sanitize(payload) !== payload) throw Error('permission_denied');
      const parent = currentPermission();
      const request: PermissionRequest = {schemaVersion: 2, owner,
        requirementsVersion: parent?.request.owner.taskId === owner.taskId ? parent.request.requirementsVersion : 1,
        callId, action: 'network_broker', inputDigest: permissionHash(raw),
        summary: await options.sanitize(permissionRequestSummary('network_broker', raw)),
        purpose: raw.purpose, scopes: [{kind: 'network', origin: url.origin, methods: [raw.method], purpose: raw.purpose},
          {kind: 'egress', origin: url.origin, classifications: [raw.classification]}], files: [], provider: null,
        classification: raw.classification, expiresAt: new Date(Date.now() + 300000).toISOString()};
      return options.engine.run(request, signal, async context => {
        await context.assert();
        // Explicit loopback grants support reviewed local services. Literal IPs
        // avoid DNS rebinding and this dispatcher ignores ambient proxy settings.
        const loopback = ['127.0.0.1', '[::1]'].includes(url.hostname) && isIP(url.hostname.replace(/[\[\]]/gu, '')) > 0;
        if (!loopback) {
          const response = await fetchOfficePublicUrl(url.href, {method: raw.method, body: raw.body || undefined,
            signal: context.signal, dnsMode: 'system', headers: {'content-type': 'application/json', accept: 'application/json,text/plain'},
            beforeRequest: async (actualUrl, method) => {
              if (new URL(actualUrl).origin !== url.origin || method !== raw.method) throw Error('permission_denied');
              await context.assert();
            }});
          if (response.status >= 300 && response.status < 400) throw Error('permission_denied');
          await context.assert();
          return {status: response.status, body: await options.sanitize(await response.text())};
        }
        const dispatcher = new Agent();
        try {
          await context.assert();
          const response = await undiciFetch(url, {method: raw.method, body: raw.body || undefined, redirect: 'manual',
            signal: context.signal, dispatcher, headers: {'content-type': 'application/json', accept: 'application/json,text/plain'}});
          if (response.status >= 300 && response.status < 400) {await response.body?.cancel(); throw Error('permission_denied');}
          const chunks: Uint8Array[] = [];
          let size = 0;
          for await (const chunk of response.body || []) {
            await context.assert();
            size += chunk.length;
            if (size > 1048576) throw Error('too_large');
            chunks.push(chunk);
          }
          await context.assert();
          return {status: response.status, body: await options.sanitize(Buffer.concat(chunks).toString('utf8'))};
        } finally {await dispatcher.destroy();}
      });
    }
  };
}
