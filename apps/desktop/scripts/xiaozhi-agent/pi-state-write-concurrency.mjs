import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {spawn} from 'node:child_process';import {build} from 'esbuild';import {createRequire} from 'node:module';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-state-write-concurrency-')),worker=path.join(output,'worker.mjs');
await build({entryPoints:['scripts/xiaozhi-agent/pi-state-write-concurrency-worker.ts'],outfile:worker,bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
const bootstrap=path.join(output,'bootstrap.cjs');fs.writeFileSync(bootstrap,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output,'profile'))});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(worker).href)});app.quit();}catch{app.exit(1);}});`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const child=spawn(createRequire(import.meta.url)('electron'),[bootstrap,output],{env,windowsHide:true,stdio:['ignore','pipe','pipe']}),log=fs.createWriteStream(path.join(output,'worker.log'));child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});await new Promise(r=>log.end(r));
let report;try{report=JSON.parse(fs.readFileSync(path.join(output,'report.json')));}catch{}
const success=exitCode===0&&report?.success===true&&report.checks.length===5;
console.log(JSON.stringify({success,exitCode,checks:report?.checks.length,output}));if(!success)process.exitCode=Number(exitCode)||1;
