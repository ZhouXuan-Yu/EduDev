import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import PptxGenJS from 'pptxgenjs';
import {wordPageFixture} from './word-page-fixture.mjs';
import {PAGED_DOCUMENT_SCRIPT} from '../../src/main/xiaozhi-agent/checks/paged-document-script.ts';
import {POWERPOINT_RENDER_SCRIPT} from '../../src/main/xiaozhi-agent/checks/powerpoint-script.ts';
import {inspectDocumentStructure} from '../../src/main/xiaozhi-agent/checks/structure.ts';
import {visualMetadata} from '../../src/main/xiaozhi-agent/checks/visual-evidence.ts';
const microsoftAuto=process.argv.includes('--microsoft-auto');
const output=await fs.mkdtemp(path.join(os.tmpdir(),'omni-edu-wps-native-')),report={ok:false,output,checks:[],boundary:'Actual Office/WPS COM and actual PNGs from fixed production scripts, synthetic inputs; no paid calls, no native edit/animation/full FX09 claim.'},sha=b=>createHash('sha256').update(b).digest('hex');
const check=s=>{report.checks.push(s);console.log('PASS '+s);};
async function powershell(script,folder,timeout=45000){
 await fs.writeFile(path.join(folder,'probe.ps1'),'\uFEFF'+script);
 return await new Promise((resolve,reject)=>{let stdout='',stderr='';const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(folder,'probe.ps1')],{windowsHide:true,env:{...process.env,XIAOZHI_RENDER_ROOT:folder},stdio:['ignore','pipe','pipe']}),timer=setTimeout(()=>child.kill(),timeout);
 child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('close',async code=>{clearTimeout(timer);await fs.writeFile(path.join(folder,'console.json'),JSON.stringify({code,stdout,stderr}));try{assert.equal(code,0,stdout+' '+stderr);resolve(JSON.parse(stdout.trim()));}catch(e){reject(e);}});});
}
const snapshot=()=>powershell("[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false);$p=@(Get-Process wps,wpp,et -ErrorAction SilentlyContinue | ForEach-Object {@{pid=$_.Id;start=$_.StartTime.ToUniversalTime().ToString('o');hwnd=$_.MainWindowHandle.ToInt64()}});ConvertTo-Json -InputObject $p -Compress",output);
try{
 report.microsoftAuto=microsoftAuto;report.before=await snapshot();
 const word=await wordPageFixture(),ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';
 for(let i=1;i<=3;i++){const slide=ppt.addSlide();slide.addText(`WPS实际页面 ${i} / PAGE_${i}`,{x:1,y:.4,w:10,h:.7,fontFace:'Microsoft YaHei',fontSize:24});slide.addText(i===2?'浸入高度：6cm':'科学观察与解释',{x:1,y:2,w:10,h:1,fontFace:'Microsoft YaHei',fontSize:20});slide.addNotes('教师说明：本页内容可编辑，数据来自合成题。');}
 const presentation=await ppt.write({outputType:'nodebuffer'});
 for(const[format,bytes,script]of[['docx',word,PAGED_DOCUMENT_SCRIPT],['pptx',presentation,POWERPOINT_RENDER_SCRIPT]]){
  const folder=path.join(output,format);await fs.mkdir(folder);await fs.writeFile(path.join(folder,'input.'+format),bytes);await fs.writeFile(path.join(folder,'request.json'),JSON.stringify({...(microsoftAuto?{}:{officeEngine:'wps'}),format,pages:3,fonts:['Microsoft YaHei']}));
  const start=Date.now(),actual=await powershell(script.replace('$result.error=$code','$result.error=$code;$result.diagnostic=$_.Exception.ToString()'),folder),proofs=[];assert(actual.ok);assert(format==='docx'?actual.engine.startsWith(microsoftAuto?'Word ':'WPS Writer '):actual.engine===(microsoftAuto?'PowerPoint':'WPS Presentation'));assert.equal(format==='docx'?actual.pages.length:actual.pages,3);
  for(let page=1;page<=3;page++){const png=await fs.readFile(path.join(folder,`page-${page}.png`));proofs.push(visualMetadata(png,{page,kind:'office_page'}));}
  assert.equal(sha(await fs.readFile(path.join(folder,'input.'+format))),sha(bytes));report[format]={elapsedMs:Date.now()-start,actual,proofs,sha256:sha(bytes),owner:JSON.parse(await fs.readFile(path.join(folder,'owned.json'),'utf8'))};
  if(format==='docx'){const parsed=await inspectDocumentStructure('export.pdf',await fs.readFile(path.join(folder,'input.pdf')));assert.equal(parsed.pageCount,3);assert(parsed.pages[1].text.includes('PAGE_TWO'));assert(parsed.pages[1].text.includes('6cm'));}
  check(`Actual ${microsoftAuto?'default Microsoft':'WPS'} ${format} renders all3 pages with independently read PNG dimensions and unchanged source; ${format==='docx'?'physical PDF page2 text verified':'slide page markers preserved'}`);
 }
 report.after=await snapshot();for(const before of report.before){const after=report.after.find(p=>p.pid===before.pid);assert(after);assert.equal(after.start,before.start);assert.equal(after.hwnd,before.hwnd);}for(const format of ['docx','pptx'])assert(!report.after.some(p=>p.pid===report[format].owner.pid));check('Every existing WPS PID/start/window preserved; both owned Automation servers exited');report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
