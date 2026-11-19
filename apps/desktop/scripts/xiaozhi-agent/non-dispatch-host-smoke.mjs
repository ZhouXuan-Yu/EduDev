import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {build}=createRequire(path.join(process.cwd(),'package.json'))('esbuild');

const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-non-dispatch-host-'));fs.copyFileSync('scripts/xiaozhi-agent/non-dispatch-host-worker.ts',path.join(output,'worker.ts'));
const source='src/main/xiaozhi-agent/production-host.ts';
const hash=()=>createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sourceHash=hash();
const scopedSources=['src/main/xiaozhi-agent/effects/non-dispatch.ts','src/main/xiaozhi-agent/tools/execution-bound.ts','src/main/xiaozhi-agent/tasks/task-state.ts','src/main/xiaozhi-agent/events/journal.ts','src/main/xiaozhi-agent/events/receipts.ts',source,'src/main/xiaozhi-agent/pi-session.ts','src/main/xiaozhi-agent/session-state.ts',
 'src/main/xiaozhi-agent/tasks/resources.ts','src/main/xiaozhi-agent/tasks/result-recheck.ts','src/main/xiaozhi-agent/tools/execution-bound.ts','src/main/xiaozhi-agent/verification/result-readback.ts',
 'scripts/xiaozhi-agent/non-dispatch-host-worker.ts','scripts/xiaozhi-agent/non-dispatch-host-smoke.mjs'];
const sourceHashes=Object.fromEntries(scopedSources.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
fs.writeFileSync(path.join(output,'SOURCE_HASHES.json'),JSON.stringify(sourceHashes,null,2));
await build({stdin:{contents:fs.readFileSync(path.join(output,'worker.ts'),'utf8'),resolveDir:path.resolve('scripts/xiaozhi-agent'),loader:'ts'},outfile:path.join(output,'worker.mjs'),
 bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
fs.copyFileSync('package.json',path.join(output,'package.json'));
fs.symlinkSync(path.resolve('node_modules'),path.join(output,'node_modules'),'junction');
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output,'profile'))});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(output,'worker.mjs')).href)});app.exit(process.exitCode||0);}catch(error){console.error(error.stack);app.exit(1);}});`);
const env={...process.env};
for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE'].includes(key))delete env[key];
const log=fs.createWriteStream(path.join(output,'worker.log'));
const child=spawn(createRequire(path.join(process.cwd(),'package.json'))('electron'),[bootstrap,output],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const timer=setTimeout(()=>child.kill(),240000);
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
clearTimeout(timer);await new Promise(resolve=>log.end(resolve));
let report;try{report=JSON.parse(fs.readFileSync(path.join(output,'REPORT.json'),'utf8'));}catch{}
const sourceUnchanged=scopedSources.every(file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')===sourceHashes[file]);
const summary={success:code===0&&report?.success===true&&report.checks.length===4&&sourceUnchanged,
 code,output,passed:report?.checks.length,error:report?.error,source,sourceHash,sourceUnchanged};
fs.writeFileSync(path.join(output,'SUMMARY.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));if(!summary.success)process.exitCode=1;
