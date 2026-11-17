/** Application-owned bootstrap bytes. The external entry is loaded only by this file inside the OS sandbox. */
export const EXTENSION_PACKAGE_WORKER = String.raw`
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath, pathToFileURL} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(directory, 'extension-config.json'), 'utf8'));
const manifest = config.manifest;
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const exact = (value, fields) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const error = (id, code, message) => send({jsonrpc: '2.0', id, error: {code, message}});
const log = code => send({jsonrpc: '2.0', method: 'extensions/log', params: {schemaVersion: 1, level: 'info', code}});

// Guest console text is never reflected into the RPC channel or retained as a log.
for (const name of ['log', 'info', 'warn', 'error', 'debug']) console[name] = () => {};
let modulePromise;
const load = () => modulePromise ||= import(pathToFileURL(path.join(directory, 'payload', config.entry)).href).then(module => {
  const hooks = {
    'context.transform': module.contextTransform ?? module.default?.contextTransform,
    'event.observe': module.observeEvent ?? module.default?.observeEvent,
  };
  if (manifest.hooks.some(hook => typeof hooks[hook] !== 'function')) throw Error('unsupported_extension_hook');
  return hooks;
});
let active = 0;
let windowStart = Date.now();
let requests = 0;
const input = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
input.on('line', async line => {
  let request;
  try {
    if (Buffer.byteLength(line) > 262144) throw Error('extension_message_limit');
    request = JSON.parse(line);
    if (!exact(request, ['jsonrpc', 'id', 'method', 'params']) || request.jsonrpc !== '2.0'
        || typeof request.id !== 'string') throw Error('extension_protocol');
    if (Date.now() - windowStart >= 1000) {windowStart = Date.now(); requests = 0;}
    if (++requests > 32 || active >= 4) {error(request.id, -32000, 'extension_busy'); return;}
    active++;
    try {
      if (request.method === 'extensions/health' && exact(request.params, ['schemaVersion']) && request.params.schemaVersion === 1) {
        await load();
        send({jsonrpc: '2.0', id: request.id, result: {schemaVersion: 1, status: 'ready', extensionId: manifest.extensionId,
          version: manifest.version, sourceHash: manifest.sourceHash, hooks: manifest.hooks}});
        return;
      }
      if (request.method !== 'extensions/hook' || !exact(request.params, ['schemaVersion', 'hook', 'payload'])
          || request.params.schemaVersion !== 1 || !manifest.hooks.includes(request.params.hook)) {
        error(request.id, -32601, 'unsupported_extension_hook'); return;
      }
      const hooks = await load();
      log('hook_started');
      const value = await hooks[request.params.hook](request.params.payload);
      log('hook_completed');
      send({jsonrpc: '2.0', id: request.id, result: {schemaVersion: 1, hook: request.params.hook,
        value: request.params.hook === 'event.observe' ? null : value}});
    } finally {active--;}
  } catch {
    if (typeof request?.id === 'string') error(request.id, -32000, 'extension_hook_failed');
    else process.exitCode = 1;
  }
});
`;
