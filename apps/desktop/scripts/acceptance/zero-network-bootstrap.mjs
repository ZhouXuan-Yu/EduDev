import fs from 'node:fs';
import path from 'node:path';

/** Install the acceptance network boundary before importing the formal main. */
export function zeroNetworkBootstrap({output, main, profile, counter = '__templateHttp'}) {
  if (!/^__[a-zA-Z]+$/.test(counter)) throw new Error('Invalid owned network counter');
  const file = path.join(output, 'zero-network-bootstrap.cjs');
  fs.writeFileSync(file, `
const e = require('electron'), fs = require('node:fs');
const start = Date.now(), phases = [];
function mark(stage) {
  phases.push({stage, elapsed: Date.now() - start});
  fs.writeFileSync(${JSON.stringify(path.join(output, 'startup.json'))}, JSON.stringify(phases));
}
mark('started');
e.app.on('browser-window-created', () => mark('window-created'));
process.on('exit', () => mark('exit'));
e.app.setPath('userData', ${JSON.stringify(profile)});
e.app.setPath('sessionData', ${JSON.stringify(profile)});
globalThis[${JSON.stringify(counter)}] = [];
function guarded(fetch, receiver) {
  return function (...args) {
    const value = args[0], url = typeof value === 'string' ? value : value?.url || String(value);
    if (/^https?:/i.test(url)) {
      globalThis[${JSON.stringify(counter)}].push('blocked-http');
      return Promise.reject(new Error('Owned acceptance forbids network'));
    }
    return fetch.apply(receiver, args);
  };
}
globalThis.fetch = guarded(globalThis.fetch, globalThis);
e.app.whenReady().then(async () => {
  mark('app-ready');
  e.net.fetch = guarded(e.net.fetch, e.net);
  e.session.defaultSession.webRequest.onBeforeRequest(
    {urls: ['http://*/*', 'https://*/*']}, (_details, callback) => {
      globalThis[${JSON.stringify(counter)}].push('blocked-http');
      callback({cancel: true});
    });
  mark('before-main-import');
  await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);
  mark('after-main-import');
}).catch(error => {
  fs.writeFileSync(${JSON.stringify(path.join(output, 'bootstrap-error.json'))}, JSON.stringify({
    code: error.code,
    hash: require('node:crypto').createHash('sha256').update(String(error.stack)).digest('hex')
  }));
  e.app.exit(1);
});
`);
  return file;
}
