import '../office-agent/register-source.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const {POWERPOINT_RENDER_SCRIPT}=await import('../../src/main/xiaozhi-agent/checks/powerpoint-script.ts');
const {PAGED_DOCUMENT_SCRIPT}=await import('../../src/main/xiaozhi-agent/checks/paged-document-script.ts');
const {inspectDocumentStructure}=await import('../../src/main/xiaozhi-agent/checks/structure.ts');
const {visualMetadata}=await import('../../src/main/xiaozhi-agent/checks/visual-evidence.ts');
const source=path.resolve(process.argv[2]||'');assert.equal(path.dirname(source).toLowerCase(),os.tmpdir().toLowerCase());assert(path.basename(source).startsWith('xiaozhi-office-math-ui-'));
const saved=JSON.parse(await fs.readFile(path.join(source,'report.json'),'utf8'));assert(saved.ok);
const root=await fs.mkdtemp(path.join(os.tmpdir(),'xiaozhi-office-math-native-')),report={ok:false,source,root,checks:[],renders:[],boundary:'Already saved synthetic files, no generation/model replay; actual owned WPS/Microsoft/Windows renders. No physical teacher editing or complete FX09 acceptance.'},sha=b=>createHash('sha256').update(b).digest('hex');
const check=s=>{report.checks.push(s);console.log('PASS '+s);};
async function ps(script,folder){await fs.writeFile(path.join(folder,'probe.ps1'),'\uFEFF'+script);return new Promise((resolve,reject)=>{let stdout='',stderr='';const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(folder,'probe.ps1')],{windowsHide:true,env:{...process.env,XIAOZHI_RENDER_ROOT:folder},stdio:['ignore','pipe','pipe']}),timer=setTimeout(()=>child.kill(),60000);child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('close',async code=>{clearTimeout(timer);await fs.writeFile(path.join(folder,'console.json'),JSON.stringify({code,stdout,stderr}));try{assert.equal(code,0,stdout+' '+stderr);resolve(JSON.parse(stdout.trim()));}catch(e){reject(e);}});});}
const snapshot=()=>ps("[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false);ConvertTo-Json -InputObject @(Get-Process wps,wpp,et,POWERPNT,WINWORD -ErrorAction SilentlyContinue | ForEach-Object {@{pid=$_.Id;start=$_.StartTime.ToUniversalTime().ToString('o');hwnd=$_.MainWindowHandle.ToInt64();name=$_.ProcessName}}) -Compress",root);
try{
 report.before=await snapshot();
 const cases=[['wps','pptx'],['wps','docx'],['microsoft','docx'],['windows','pdf']];
 // The production Microsoft adapter deliberately preserves an already running PowerPoint server.
 if(!report.before.some(p=>p.name==='POWERPNT'))cases.push(['microsoft','pptx']);else report.microsoftPpt='unverified: pre-existing PowerPoint preserved';
 for(const [engine,format]of cases){
  const original=saved.files.find(f=>f.format===format),bytes=await fs.readFile(original.path);assert.equal(sha(bytes),original.sha256);const metrics=await inspectDocumentStructure('input.'+format,bytes),folder=path.join(root,engine+'-'+format);await fs.mkdir(folder);await fs.writeFile(path.join(folder,'input.'+format),bytes);
  await fs.writeFile(path.join(folder,'request.json'),JSON.stringify({officeEngine:engine,format,pages:metrics.pageCount,fonts:metrics.fonts,embeddedFonts:metrics.embeddedFonts}));
  const start=Date.now(),actual=await ps(format==='pptx'?POWERPOINT_RENDER_SCRIPT:PAGED_DOCUMENT_SCRIPT,folder);assert(actual.ok,JSON.stringify(actual));const count=format==='pptx'?actual.pages:actual.pages.length;assert.equal(count,format==='pptx'?2:1);
  const images=[];for(let page=1;page<=count;page++)images.push(visualMetadata(await fs.readFile(path.join(folder,`page-${page}.png`)),{page,kind:'office_page'}));
  assert.equal(sha(await fs.readFile(original.path)),original.sha256);report.renders.push({engine,format,actual,elapsedMs:Date.now()-start,sha256:original.sha256,images,folder,owner:format==='pdf'?null:JSON.parse(await fs.readFile(path.join(folder,'owned.json'),'utf8'))});
  check(`${engine} ${format}: actual ${count} pages and independently read PNGs; reviewed source bytes unchanged`);
 }
 report.after=await snapshot();for(const before of report.before)assert.deepEqual(report.after.find(p=>p.pid===before.pid),before);for(const render of report.renders)if(render.owner)assert(!report.after.some(p=>p.pid===render.owner.pid));check('All existing Office/WPS PID/start/window identities preserved and every owned native server exited');report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}
