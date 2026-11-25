import assert from 'node:assert/strict';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configName = 'budget.json';
const modelId = /^deepseek-[a-z0-9-]{1,40}$/;
const defaultModels = ['deepseek-flash', 'deepseek-v4-pro'];
const arg = (args, name) => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1);

function configOf(dir) {
  const value = JSON.parse(readFileSync(path.join(dir, configName), 'utf8'));
  assert.equal(value.version, 1);
  assert(Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 180, 'Invalid shared request limit');
  assert(Array.isArray(value.models) && value.models.length > 0 && value.models.every(id => modelId.test(id)), 'Invalid shared model list');
  return value;
}

export function createSharedModelBudget(desktop, limit, models = defaultModels) {
  assert(Number.isInteger(limit) && limit >= 1 && limit <= 180, 'Invalid shared request limit');
  assert(models.length && models.every(id => modelId.test(id)), 'Invalid shared model list');
  const parent = path.join(realpathSync(desktop), 'test-results');
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(path.join(parent, 'r4-model-budget-'));
  mkdirSync(path.join(dir, 'slots'));
  writeFileSync(path.join(dir, configName), JSON.stringify({ version: 1, limit, models }), { flag: 'wx' });
  return dir;
}

export function readSharedModelBudget(args, desktop, { dryRun = false } = {}) {
  const supplied = arg(args, '--r4-shared-budget');
  if (supplied === undefined) return null;
  assert(dryRun || args.includes('--allow-paid-model'), 'Explicit approval is required for a shared live model evaluation');
  assert(path.isAbsolute(supplied), 'Shared budget path must be absolute');
  const dir = realpathSync(supplied);
  const owned = path.join(realpathSync(desktop), 'test-results');
  assert(path.dirname(dir) === owned && path.basename(dir).startsWith('r4-model-budget-'), 'Shared budget must be in owned test-results');
  const { limit, models } = configOf(dir);
  const used = readdirSync(path.join(dir, 'slots')).length;
  return { dir, limit, models, used };
}

// The file's exclusive creation is the reservation across all Electron lives.
// An empty slot after interruption remains consumed. No request body or key is saved.
export function reserveSharedModelRequest(dir, fields) {
  const { limit, models } = configOf(dir);
  assert(models.includes(fields.model), 'Model is outside the shared evaluation scope');
  assert(/^[A-Z][A-Z0-9-]{0,49}$/.test(fields.scenario), 'Invalid budget scenario');
  assert(Number.isSafeInteger(fields.bytes) && fields.bytes >= 0 && fields.bytes <= 2 * 1024 * 1024);
  for (let slot = 1; slot <= limit; slot++) {
    let fd;
    try {
      fd = openSync(path.join(dir, 'slots', String(slot).padStart(3, '0') + '.json'), 'wx');
    } catch (error) {
      if (error.code === 'EEXIST') continue;
      throw error;
    }
    try {
      writeFileSync(fd, JSON.stringify({ slot, at: new Date().toISOString(), scenario: fields.scenario,
        model: fields.model, bytes: fields.bytes }));
    } finally {
      closeSync(fd);
    }
    return slot;
  }
  throw Error('R4_SHARED_MODEL_BUDGET_EXHAUSTED');
}

function endpoint(input, method) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== 'https://api.deepseek.com' || url.username || url.password || url.search || url.hash) return null;
  if (method === 'GET' && ['/models', '/v1/models'].includes(url.pathname)) return 'catalogue';
  if (method === 'POST' && ['/chat/completions', '/v1/chat/completions'].includes(url.pathname)) return 'completion';
  return null;
}

export function installSharedModelBudget({ net, session }, { dir, scenario, offline = false }) {
  const { models } = configOf(dir);
  const tickets = new Map();
  const marker = 'x-edudev-r4-request-ticket';
  const webRequest = session.defaultSession.webRequest;
  const registerBefore = webRequest.onBeforeRequest.bind(webRequest);
  const nativeFetch = net.fetch.bind(net);
  let formalBefore;
  // Electron keeps a single listener. Keep normal local-frame policy composed with the evaluation scope.
  const before = (details, callback) => {
    const remote = /^https?:/i.test(details.url);
    if (remote && (offline || !endpoint(details.url, details.method))) return callback({ cancel: true });
    if (formalBefore) return formalBefore(details, callback);
    callback({ cancel: false });
  };
  webRequest.onBeforeRequest = (...args) => {
    if (args.length !== 1 || (args[0] !== null && typeof args[0] !== 'function')) throw Error('Unsupported formal network hook');
    formalBefore = args[0];
    registerBefore(before);
  };
  registerBefore(before);

  webRequest.onBeforeSendHeaders({ urls: ['https://api.deepseek.com/*'] }, (details, callback) => {
    if (offline) return callback({ cancel: true });
    if (endpoint(details.url, details.method) !== 'completion') return callback({ requestHeaders: details.requestHeaders });
    const headers = { ...details.requestHeaders };
    const key = Object.keys(headers).find(name => name.toLowerCase() === marker);
    const ticket = key && headers[key];
    const info = tickets.get(ticket);
    if (!info) return callback({ cancel: true });
    tickets.delete(ticket);
    delete headers[key];
    try {
      reserveSharedModelRequest(dir, info);
    } catch {
      return callback({ cancel: true });
    }
    callback({ requestHeaders: headers });
  });

  net.fetch = async (input, init = {}) => {
    if (offline) throw Error('R4_SHARED_MODEL_OFFLINE_PREFLIGHT');
    const method = String(init.method ?? input.method ?? 'GET').toUpperCase();
    const target = endpoint(input, method);
    if (!target) throw Error('R4_SHARED_MODEL_NETWORK_SCOPE');
    if (target === 'catalogue') return nativeFetch(input, { ...init, redirect: 'error' });
    const body = typeof init.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : undefined;
    if (typeof body !== 'string' || Buffer.byteLength(body) > 2 * 1024 * 1024) throw Error('Uninspectable model request');
    const { model } = JSON.parse(body);
    if (!models.includes(model)) throw Error('Model is outside the shared evaluation scope');
    const ticket = randomUUID();
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(marker, ticket);
    tickets.set(ticket, { model, bytes: Buffer.byteLength(body), scenario });
    try {
      return await nativeFetch(input, { ...init, headers, redirect: 'error' });
    } finally {
      tickets.delete(ticket);
    }
  };
}

export function sharedModelBudgetEntry(main, profile, budget, scenario, { offline = false } = {}) {
  if (!budget) return main;
  const helper = import.meta.url;
  const config = { dir: budget.dir, scenario, offline };
  const entry = path.join(path.dirname(profile), 'r4-live-model-bootstrap.cjs');
  const source = `const electron = require('electron');
const { mkdirSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
mkdirSync(${JSON.stringify(profile)}, { recursive: true });
electron.app.setPath('userData', ${JSON.stringify(profile)});
electron.app.setPath('sessionData', ${JSON.stringify(profile)});
(async () => {
  await electron.app.whenReady();
  const { installSharedModelBudget } = await import(${JSON.stringify(helper)});
  installSharedModelBudget(electron, ${JSON.stringify(config)});
  await import(pathToFileURL(${JSON.stringify(main)}).href);
})().catch(() => { console.error('R4_MODEL_BOOTSTRAP_FAILED'); electron.app.exit(1); });
`;
  writeFileSync(entry, source);
  return entry;
}

if (import.meta.main) {
  const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const limit = Number(arg(process.argv, '--max-requests'));
  const models = arg(process.argv, '--models')?.split(',');
  console.log(JSON.stringify({ path: createSharedModelBudget(desktop, limit, models), limit, providerRequests: 0 }));
}
