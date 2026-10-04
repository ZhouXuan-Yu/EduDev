import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const flags=process.argv.slice(2),mode=flags[0];
assert.equal(process.platform,'win32','This native profile acceptance/maintenance helper targets Windows');
assert(flags.length<=1&&(!mode||['--check-real-user-profile','--repair-real-user-profile'].includes(mode)),'Unknown credential maintenance option');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-credential-profile-')),worker=path.join(output,'worker.mjs');
await build({entryPoints:['scripts/xiaozhi-agent/credential-profile-worker.ts'],outfile:worker,bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning'});
const electron=createRequire(import.meta.url)('electron'),bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const {app}=require('electron');const job=JSON.parse(process.env.OMNI_EDU_CREDENTIAL_JOB);app.setName('OmniEduAgent');app.setPath('userData',job.actualProfile);app.whenReady().then(async()=>{try{const {runCredentialProfileJob}=await import(${JSON.stringify(pathToFileURL(worker).href)});const result=await runCredentialProfileJob(job);console.log(JSON.stringify(result));if(result.success)app.quit();else app.exit(1);}catch{console.log('credential_worker_failed');app.exit(1);}});\n`,{flag:'wx'});
const env={...process.env,DEEPSEEK_API_KEY:'',DEEPSEEK_MODEL:''};delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
function run(name,job){
 const target=path.join(output,name);fs.mkdirSync(target);fs.mkdirSync(job.actualProfile,{recursive:true});
 const child=spawnSync(electron,[bootstrap],{cwd:process.cwd(),env:{...env,OMNI_EDU_CREDENTIAL_JOB:JSON.stringify({...job,output:target})},encoding:'utf8',windowsHide:true,timeout:60000});
 fs.writeFileSync(path.join(target,'worker.log'),String(child.stdout||'')+String(child.stderr||''));
 assert(fs.existsSync(path.join(target,'report.json')),'Credential worker did not return a report');
 const result=JSON.parse(fs.readFileSync(path.join(target,'report.json'),'utf8'));
 return {exitCode:child.status,result};
}
const report={success:false,checks:[],scope:mode?'Explicit existing real profile, only provider settings replacement or read-only check. No Store initialization or teacher task.':'Actual native safeStorage in two owned profiles and separate processes; synthetic plaintext only.'};
try{
 if(mode){
  assert(process.platform==='win32'&&process.env.APPDATA);
  const profile=path.join(process.env.APPDATA,'OmniEduAgent');assert(fs.existsSync(path.join(profile,'Local State'))&&fs.existsSync(path.join(profile,'OmniEduData','app.db')));
  if(mode==='--repair-real-user-profile'){
   // Never race a live user Electron instance or terminate it for maintenance.
   const live=String(execFileSync('powershell.exe',['-NoProfile','-Command',"@(Get-CimInstance Win32_Process -Filter \"Name = 'electron.exe'\").Count"],{encoding:'utf8',windowsHide:true})).trim();
   assert.equal(live,'0','A live Electron app is present; finish its work before credential maintenance');
  }
  const checked=run(mode==='--repair-real-user-profile'?'replace':'inspect',{mode:mode==='--repair-real-user-profile'?'replace':'inspect',actualProfile:profile,expectedProfile:profile,dataRoot:path.join(profile,'OmniEduData'),model:'deepseek-flash'});
  assert.equal(checked.exitCode,0);assert(checked.result.success);report.checks.push({name:'Actual real user profile credential and official connection',pass:true});
 }else{
  const first=path.join(output,'profile-a'),other=path.join(output,'profile-b'),probe=path.join(output,'synthetic-probe.json');
  const written=run('write-a',{mode:'probe-write',actualProfile:first,expectedProfile:first,probe});assert.equal(written.exitCode,0);assert(written.result.decryptionSucceeded);report.checks.push({name:'Native encryption and immediate decryption in owned profile',pass:true});
  const restart=run('restart-a',{mode:'probe-read',actualProfile:first,expectedProfile:first,probe});assert.equal(restart.exitCode,0);assert(restart.result.decryptionSucceeded);report.checks.push({name:'Separate restarted Electron process decrypts in the same profile',pass:true});
  const foreign=run('read-b',{mode:'probe-read',actualProfile:other,expectedProfile:other,probe});assert.equal(foreign.exitCode,0);assert.equal(foreign.result.decryptionSucceeded,false);report.checks.push({name:'Foreign profile cannot decrypt the same native ciphertext',pass:true});
  const before=fs.readFileSync(probe),guard=run('guard',{mode:'probe-write',actualProfile:other,expectedProfile:first,probe});assert.equal(guard.exitCode,1);assert.equal(guard.result.error,'profile_mismatch');assert.deepEqual(fs.readFileSync(probe),before);report.checks.push({name:'Wrong maintenance profile is rejected before writing',pass:true});
 }
 report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.message).slice(0,240);}
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,...(report.error?{error:report.error}:{})}));
