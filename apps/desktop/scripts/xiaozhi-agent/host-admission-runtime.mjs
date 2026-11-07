/** Source-only admission tests. These sentinels must never act as an Electron UI. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {registerHooks} from 'node:module';

export function installHostAdmissionRuntime(){
  const source="export const utilityProcess={};export const app={isPackaged:false};export class BrowserWindow{constructor(){throw Error('Host admission test must not render PDF');}}export const session=new Proxy({},{get(){throw Error('Host admission test must not access Electron session');}});";
  registerHooks({
    resolve(specifier,context,next){return specifier==='electron'?{url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true}:next(specifier,context);},
    load(url,context,next){return url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json')?{format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true}:next(url,context);}
  });
}

/** Explicit existing QA SQLite only; no fallback to a daily teacher database. */
export function hostAdmissionFixture(legacy){
  const args=process.argv.slice(2);assert(args.length<=1&&args.every(a=>a.startsWith('--fixture=')),'Only an explicit owned fixture is accepted');
  const resolved=path.resolve(args[0]?.slice(10)||legacy),fixture=fs.realpathSync(resolved),root=fs.realpathSync(path.resolve('test-results'));
  assert.equal(fixture,resolved,'Fixture redirects are forbidden');
  assert(fixture.startsWith(root+path.sep)&&path.basename(fixture)==='app.db'&&fs.statSync(fixture).nlink===1,'Owned actual SQLite fixture required');
  assert(!fs.existsSync(fixture+'-wal')||fs.statSync(fixture+'-wal').size===0,'Source fixture must be cold');
  return fixture;
}
