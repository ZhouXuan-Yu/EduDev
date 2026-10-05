import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-attachment-send-native-'));
const oldSource=spawnSync('git',['show','HEAD:apps/desktop/src/main/xiaozhi-agent/attachment-send-state.ts'],{encoding:'utf8',windowsHide:true});
if(oldSource.status!==0)throw new Error('Prior committed attachment trigger is required for migration acceptance');
const oldTrigger=oldSource.stdout.match(/CREATE TRIGGER IF NOT EXISTS xiaozhi_pi_attachment_send_publish[\s\S]*?END`/)[0].slice(0,-1);
fs.writeFileSync(path.join(output,'prior-trigger.sql'),oldTrigger);
await build({entryPoints:['scripts/xiaozhi-agent/pi-attachment-send-native-worker.ts'],outfile:path.join(output,'worker.mjs'),bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const {app}=require('electron');const path=require('node:path');const fs=require('node:fs');const profile=path.join(process.argv[2],'profile');fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);app.whenReady().then(async()=>{try{await import(${JSON.stringify(pathToFileURL(path.join(output,'worker.mjs')).href)});app.quit();}catch(error){console.error(String(error.stack).slice(0,1800));app.exit(1);}});\n`,{flag:'wx'});
const env={...process.env};delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
const child=spawnSync(createRequire(import.meta.url)('electron'),[bootstrap,output],{cwd:process.cwd(),env,encoding:'utf8',windowsHide:true,timeout:90000});
fs.writeFileSync(path.join(output,'worker.log'),String(child.stdout||'')+String(child.stderr||''));
console.log(String(child.stdout||'').slice(-5500));if(child.status!==0){process.exitCode=1;console.log(String(child.stderr||child.error||'').slice(0,1400));}
console.log(JSON.stringify({exitCode:child.status,output}));
