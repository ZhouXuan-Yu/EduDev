import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-file-text-privacy-'));
const source='src/main/xiaozhi-agent/production-host.ts';
const hash=()=>createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sourceHash=hash();
await build({entryPoints:['scripts/xiaozhi-agent/file-text-privacy-host-worker.ts'],outfile:path.join(output,'worker.mjs'),
 bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
fs.copyFileSync('package.json',path.join(output,'package.json'));
fs.symlinkSync(path.resolve('node_modules'),path.join(output,'node_modules'),'junction');
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output,'profile'))});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(output,'worker.mjs')).href)});app.exit(process.exitCode||0);}catch(error){console.error(error.stack);app.exit(1);}});`);
const env={...process.env};
for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE'].includes(key))delete env[key];
const log=fs.createWriteStream(path.join(output,'worker.log'));
const child=spawn(createRequire(import.meta.url)('electron'),[bootstrap,output],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const timer=setTimeout(()=>child.kill(),240000);
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
clearTimeout(timer);await new Promise(resolve=>log.end(resolve));
let report;try{report=JSON.parse(fs.readFileSync(path.join(output,'REPORT.json'),'utf8'));}catch{}
const summary={success:code===0&&report?.success===true&&report.checks.length===6&&hash()===sourceHash,
 code,output,passed:report?.checks.length,error:report?.error,source,sourceHash,sourceUnchanged:hash()===sourceHash};
fs.writeFileSync(path.join(output,'SUMMARY.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));if(!summary.success)process.exitCode=1;
