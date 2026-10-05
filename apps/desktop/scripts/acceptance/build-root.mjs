import fs from 'node:fs';import path from 'node:path';
import assert from 'node:assert/strict';
export function testMain(desktop) {
  const base=fs.realpathSync(desktop),root=fs.realpathSync(process.env.OMNI_EDU_TEST_BUILD_ROOT||path.join(base,'out'));
  if(root!==path.join(base,'out')&&!root.startsWith(path.join(base,'test-results')+path.sep))throw new Error('Test build must be everyday out or owned test-results');
  const main=path.join(root,'main/index.js');if(!fs.existsSync(main))throw new Error('Test build missing main');return main;
}

// V8 reports compiled scripts already loaded by the actual Electron main process.
// Dynamic-import chunks which have not been loaded cannot appear in this inventory.
export async function inspectLoadedMainModules(app, main) {
  const inventory = await app.evaluate(async () => {
    const inspector = process.getBuiltinModule('inspector');
    const session = new inspector.Session(), urls = new Set();
    session.connect();
    session.on('Debugger.scriptParsed', event => { if (event.params.url) urls.add(event.params.url); });
    const post = method => new Promise((resolve, reject) => session.post(method, error => error ? reject(error) : resolve()));
    try { await post('Debugger.enable'); await post('Debugger.disable'); return [...urls]; }
    finally { session.disconnect(); }
  });
  const normalize = value => decodeURI(value).replaceAll('\\','/').replace(/^file:\/\//,'').toLowerCase();
  const expected = normalize(main);
  if (!inventory.some(url => normalize(url).endsWith(expected))) throw new Error('Main module inventory unavailable');
  const directory = path.dirname(main).replaceAll('\\','/').toLowerCase()+'/';
  return inventory.filter(url => normalize(url).includes(directory)).map(normalize).sort();
}

export async function assertIsolatedPiMain(app, main, profile) {
  const paths = await app.evaluate(({app}) => ({userData:app.getPath('userData'),sessionData:app.getPath('sessionData')}));
  assert.equal(paths.userData,path.resolve(profile),'Electron preferences must use the owned profile');
  assert.equal(paths.sessionData,path.resolve(profile),'Chromium data must use the owned profile');
  const modules = await inspectLoadedMainModules(app,main);
  assert(!modules.some(url=>/test-runtime-/.test(url)),'Formal Pi must never load the historical orchestrators');
  return {paths,modules};
}
