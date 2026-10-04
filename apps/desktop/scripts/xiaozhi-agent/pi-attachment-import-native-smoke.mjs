import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-attachment-import-native-')),worker=path.join(output,'worker.mjs');
await build({entryPoints:['scripts/xiaozhi-agent/pi-attachment-import-native-worker.ts'],outfile:worker,bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
const electron=createRequire(import.meta.url)('electron'),env={...process.env};delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const {app}=require('electron');const path=require('node:path');const fs=require('node:fs');const profile=path.join(process.argv[2],'profile');fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(worker).href)});}catch(error){console.error(String(error.stack).slice(0,1800));process.exitCode=1;}app.exit(process.exitCode||0);});\n`,{flag:'wx'});
const result=spawnSync(electron,[bootstrap,output],{cwd:process.cwd(),env,encoding:'utf8',windowsHide:true,timeout:90000});
fs.writeFileSync(path.join(output,'worker.log'),String(result.stdout||'')+String(result.stderr||''));
console.log(String(result.stdout||'').slice(-5000));
if(result.status!==0){process.exitCode=1;console.log(String(result.stderr||result.error||'').slice(0,1500));}
console.log(JSON.stringify({exitCode:result.status,output}));
