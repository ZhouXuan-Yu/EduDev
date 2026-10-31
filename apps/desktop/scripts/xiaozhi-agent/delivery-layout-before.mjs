import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {execFile,spawn} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';
import {OFFICE_JOB_SOURCE} from '../../src/main/xiaozhi-agent/checks/native-office-job.ts';import {WPS_OWNER_SCRIPT} from '../../src/main/xiaozhi-agent/checks/wps-owner-script.ts';
// Exact committed previous adapter, same7-page bytes; a single sequential observation, never P95.
const root=path.resolve(process.argv[2]||'');assert.equal(path.dirname(root).toLowerCase(),os.tmpdir().replace(/[\\/]$/,'').toLowerCase());assert(path.basename(root).startsWith('omni-edu-layout-native-'));
const report={ok:false,source:'af0cbea082f31ec1c1992b23764fca2f24ecf81f',root,engines:[]},sha=b=>createHash('sha256').update(b).digest('hex');
try{
 const {stdout}=await promisify(execFile)('git',['show',report.source+':apps/desktop/src/main/xiaozhi-agent/checks/powerpoint-script.ts'],{cwd:path.resolve(import.meta.dirname,'../../../..')});
 const script=Function('OFFICE_JOB_SOURCE','WPS_OWNER_SCRIPT',stdout.replace(/^import .*;\r?\n/gm,'').replace('export const POWERPOINT_RENDER_SCRIPT=','return '))(OFFICE_JOB_SOURCE,WPS_OWNER_SCRIPT);
 const bytes=await fs.readFile(path.join(root,'fixture.pptx'));report.sha256=sha(bytes);
 for(const engine of ['microsoft','wps']){
  const folder=path.join(root,'before-'+engine);await fs.mkdir(folder);await fs.writeFile(path.join(folder,'input.pptx'),bytes);await fs.writeFile(path.join(folder,'request.json'),JSON.stringify({pages:7,fonts:['Arial'],officeEngine:engine}));await fs.writeFile(path.join(folder,'before.ps1'),'\uFEFF'+script);
  const start=Date.now(),actual=await new Promise((resolve,reject)=>{let out='',err='';const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(folder,'before.ps1')],{windowsHide:true,env:{...process.env,XIAOZHI_RENDER_ROOT:folder},stdio:['ignore','pipe','pipe']}),timer=setTimeout(()=>child.kill(),45000);child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);try{assert.equal(code,0,out+err);resolve(JSON.parse(out.trim()));}catch(e){reject(e);}});});
  assert(actual.ok);assert(!actual.findings.some(f=>['rendered_text_covered','system_glyph_missing'].includes(f.code)));assert.equal(sha(await fs.readFile(path.join(folder,'input.pptx'))),sha(bytes));report.engines.push({engine,elapsedMs:Date.now()-start,actual});
 }
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{await fs.writeFile(path.join(root,'before-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
