import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {build} from 'esbuild';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-attachment-native-')),worker=path.join(output,'worker.mjs');
await build({entryPoints:['scripts/xiaozhi-agent/pi-attachment-native-store-worker.ts'],outfile:worker,bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
const require=createRequire(import.meta.url),electron=require('electron'),env={...process.env,ELECTRON_RUN_AS_NODE:'1'};delete env.NODE_OPTIONS;
const result=spawnSync(electron,[worker,output],{cwd:process.cwd(),env,encoding:'utf8',windowsHide:true,timeout:45000});
fs.writeFileSync(path.join(output,'worker.log'),String(result.stdout||'')+String(result.stderr||''));console.log(String(result.stdout||'').slice(-3000));if(result.status!==0){process.exitCode=1;console.log(String(result.stderr||result.error||'').slice(0,1500));}console.log(JSON.stringify({exitCode:result.status,output}));
