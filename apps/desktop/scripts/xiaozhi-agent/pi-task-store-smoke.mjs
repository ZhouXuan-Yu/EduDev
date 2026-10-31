import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-task-store-'));
await build({entryPoints:['scripts/xiaozhi-agent/pi-task-store-worker.ts'],outfile:path.join(output,'worker.mjs'),bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
const bootstrap=path.join(output,'bootstrap.cjs');fs.writeFileSync(bootstrap,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(output,'profile'))});app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(output,'worker.mjs')).href)});app.quit();}catch(error){console.error(String(error.stack).slice(0,2200));app.exit(1);}});`,{flag:'wx'});
const env={...process.env};delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
const log=fs.createWriteStream(path.join(output,'worker.log')),child=spawn(createRequire(import.meta.url)('electron'),[bootstrap,output],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});await new Promise(resolve=>log.end(resolve));
let report;try{report=JSON.parse(fs.readFileSync(path.join(output,'report.json'),'utf8'));}catch{}
const success=code===0&&report?.success===true&&report.checks?.length===11&&report.checks.every(c=>c.pass===true);
if(!success)process.exitCode=1;console.log(JSON.stringify({success,exitCode:code,checks:report?.checks?.length,output,error:report?.error}));
