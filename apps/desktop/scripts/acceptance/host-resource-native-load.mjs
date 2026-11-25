import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';

const require=createRequire(import.meta.url);
const desktop=path.resolve(import.meta.dirname,'../..');
const [fixtures,acceptance]=process.argv.slice(2);
assert(fixtures&&path.isAbsolute(fixtures)&&acceptance&&path.isAbsolute(acceptance));
const root=await fs.mkdtemp(path.join(await fs.realpath(acceptance),'r1-native-mixed-'));
const appEntry=path.join(desktop,'out/main/index.js');
const worker=path.join(desktop,'out/main/retrieval-worker.js');
const nativeEntry=path.join(desktop,'out/main',path.basename(root)+'.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity={app:sha(await fs.readFile(appEntry)),worker:sha(await fs.readFile(worker))};
await build({
  absWorkingDir:desktop, bundle:true, format:'esm', platform:'node', packages:'external',
  outfile:nativeEntry, entryPoints:['scripts/acceptance/host-resource-native-load-entry.ts'],
});
identity.harness=sha(await fs.readFile(nativeEntry));
const output=await fs.open(path.join(root,'electron.log'),'wx');
const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_R1_FIXTURES:fixtures,OMNI_EDU_R1_OUTPUT:root,OMNI_EDU_SKIP_DOTENV:'1'};
for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'])delete env[key];
try{
  const exit=await new Promise((resolve,reject)=>{
    const child=spawn(require('electron'),[nativeEntry,'--user-data-dir='+path.join(root,'profile')],{
      cwd:root,env,stdio:['ignore',output.fd,output.fd],windowsHide:true,
    });
    const timer=setTimeout(()=>child.kill(),240000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{clearTimeout(timer);resolve(code);});
  });
  const report=JSON.parse(await fs.readFile(path.join(root,'report.json'),'utf8'));
  await fs.writeFile(path.join(root,'identity.json'),JSON.stringify(identity,null,2),{flag:'wx'});
  assert.equal(exit,0,report.error);
  assert.equal(report.success,true);
  console.log(JSON.stringify({root,identity,checks:report.checks,paidCalls:0}));
}finally{
  await output.close();
}
