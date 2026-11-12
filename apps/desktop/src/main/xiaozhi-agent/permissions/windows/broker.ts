import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import type {CurrentPermission} from '../current';
import {plain, exact, text} from '../validation';
import type {createPermissionNetworkBroker} from '../network';
import {filesystemScope, checkedFile} from '../resources';

type Broker = ReturnType<typeof createPermissionNetworkBroker>;

/** The AppContainer has no network capability. Requests cross this bounded main broker. */
export function createScriptNetworkSpool(root: string, authority: CurrentPermission, broker: Broker) {
  const directory = path.join(root, '.runtime/broker');
  fs.mkdirSync(directory, {recursive: true});
  const scope = filesystemScope(root, ['read', 'write']);
  const controller = new AbortController();
  const signal = AbortSignal.any([authority.signal, controller.signal]);
  let failure: unknown;
  let count = 0;
  const seen = new Set<string>();

  async function processRequest(name: string) {
    if (!/^[a-f0-9-]{36}\.request\.json$/iu.test(name) || seen.has(name)) return;
    seen.add(name);
    if (++count > 16) throw Error('resource_budget');
    await authority.assert();
    const filename = checkedFile(scope, path.join(directory, name), 'read');
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 131072) throw Error('invalid_input');
    const descriptor = fs.openSync(filename, 'r');
    let bytes: Buffer;
    try {
      const opened = fs.fstatSync(descriptor);
      if (opened.dev !== stat.dev || opened.ino !== stat.ino || !opened.isFile() || opened.nlink !== 1 || opened.size > 131072) throw Error('permission_denied');
      checkedFile(scope, filename, 'read');
      const bounded = Buffer.alloc(131073);
      let size = 0;
      while (size < bounded.length) {
        const read = fs.readSync(descriptor, bounded, size, bounded.length - size, null);
        if (read === 0) break;
        size += read;
      }
      bytes = bounded.subarray(0, size);
      const after = fs.lstatSync(checkedFile(scope, filename, 'read'));
      if (after.dev !== opened.dev || after.ino !== opened.ino) throw Error('source_changed');
    } finally {fs.closeSync(descriptor);}
    if (bytes.length > 131072) throw Error('invalid_input');
    const raw: unknown = JSON.parse(bytes.toString('utf8'));
    if (!plain(raw) || !exact(raw, ['url', 'method', 'body']) || !text(raw.url)
        || !['GET', 'POST'].includes(String(raw.method)) || raw.body !== null && typeof raw.body !== 'string') throw Error('invalid_input');
    // Scripts cannot downgrade workspace data to public or change the purpose.
    const result = await broker.fetch(authority.request.owner, authority.request.callId + ':' + name.slice(0, 36), {
      url: raw.url, method: raw.method as 'GET' | 'POST', body: raw.body as string | null,
      purpose: 'script_network', classification: 'teacher_private'
    }, signal);
    await authority.assert();
    const response = checkedFile(scope, path.join(directory, name.replace('.request.json', '.response.json')), 'write');
    fs.writeFileSync(response, JSON.stringify({success: true, ...result}), {flag: 'wx', mode: 0o600});
  }

  const task = (async () => {
    try {
      while (!signal.aborted) {
        checkedFile(scope, directory, 'read');
        const listing = fs.opendirSync(directory);
        let entries = 0;
        try {
          let entry = listing.readSync();
          while (entry) {
            if (++entries > 64) throw Error('resource_budget');
            await processRequest(entry.name);
            entry = listing.readSync();
          }
        } finally {listing.closeSync();}
        await delay(25, undefined, {signal});
      }
    } catch (error) {
      if (!signal.aborted) failure = error;
    }
  })();

  const prefix = `function Invoke-XiaozhiRequest {
  param([Parameter(Mandatory=$true)][string]$Uri, [ValidateSet('GET','POST')][string]$Method='GET', [string]$Body=$null)
  $requestId=[Guid]::NewGuid().ToString()
  $brokerRoot=Join-Path $env:XIAOZHI_WORKSPACE '.runtime/broker'
  $temporary=Join-Path $brokerRoot ($requestId+'.tmp')
  $request=Join-Path $brokerRoot ($requestId+'.request.json')
  $response=Join-Path $brokerRoot ($requestId+'.response.json')
  $payload=@{url=$Uri;method=$Method;body=$Body} | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($temporary,$payload,(New-Object Text.UTF8Encoding($false)))
  [IO.File]::Move($temporary,$request)
  while (-not [IO.File]::Exists($response)) { Start-Sleep -Milliseconds 40 }
  $reply=[IO.File]::ReadAllText($response) | ConvertFrom-Json
  return $reply
}
`;
  return {
    prefix,
    get failure() {return failure;},
    async stop() {controller.abort(); await task;}
  };
}
