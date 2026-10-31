import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {layoutFixture} from './delivery-layout-fixture.mjs';
import {POWERPOINT_RENDER_SCRIPT} from '../../src/main/xiaozhi-agent/checks/powerpoint-script.ts';
import {GLYPH_CHECK_SCRIPT} from '../../src/main/xiaozhi-agent/checks/glyph-script.ts';
import {inspectDocumentStructure} from '../../src/main/xiaozhi-agent/checks/structure.ts';
import {visualMetadata} from '../../src/main/xiaozhi-agent/checks/visual-evidence.ts';
const output=await fs.mkdtemp(path.join(os.tmpdir(),'omni-edu-layout-native-')),report={ok:false,output,checks:[]},sha=b=>createHash('sha256').update(b).digest('hex');
const check=x=>{report.checks.push(x);console.log('PASS '+x);};
async function ps(script,folder,timeout=45000){await fs.writeFile(path.join(folder,'probe.ps1'),'\uFEFF'+script);return new Promise((resolve,reject)=>{let stdout='',stderr='';const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(folder,'probe.ps1')],{windowsHide:true,env:{...process.env,XIAOZHI_RENDER_ROOT:folder},stdio:['ignore','pipe','pipe']}),timer=setTimeout(()=>child.kill(),timeout);child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('close',async code=>{clearTimeout(timer);await fs.writeFile(path.join(folder,'console.json'),JSON.stringify({code,stdout,stderr}));try{assert.equal(code,0,stdout+' '+stderr);resolve(JSON.parse(stdout.trim()));}catch(e){reject(e);}});});}
try{
 const snapshot=()=>ps("ConvertTo-Json -InputObject @(Get-Process wps,wpp,et,POWERPNT -ErrorAction SilentlyContinue | ForEach-Object {@{pid=$_.Id;start=$_.StartTime.ToUniversalTime().ToString('o');hwnd=$_.MainWindowHandle.ToInt64()}}) -Compress",output);
 report.before=await snapshot();
 const glyph=await ps(GLYPH_CHECK_SCRIPT+`\n$a=Find-MissingGlyphs '普通中文 F=ρgV' 'Arial';$b=Find-MissingGlyphs ('X'+[char]::ConvertFromUtf32(0x10FFFD)) 'Arial';$script:glyphRemaining=1;$c=Find-MissingGlyphs 'more than one' 'Arial';ConvertTo-Json -InputObject @($a,$b,$c) -Depth 4 -Compress`,output);
 assert.deepEqual(glyph[0].points,[]);assert.equal(glyph[0].unchecked,false);assert.deepEqual(glyph[1].points,['U+10FFFD']);assert.equal(glyph[2].unchecked,true);report.glyph=glyph;check('Real Windows fallback preserves Arial Chinese/formula and detects a missing supplementary glyph; character budget explicitly unchecked');
 const bytes=await layoutFixture();report.sha256=sha(bytes);await fs.writeFile(path.join(output,'fixture.pptx'),bytes);const metrics=await inspectDocumentStructure('fixture.pptx',bytes);assert.equal(metrics.embeddedFonts,false);
 for(const engine of ['microsoft','wps']){
  const folder=path.join(output,engine);await fs.mkdir(folder);await fs.writeFile(path.join(folder,'input.pptx'),bytes);await fs.writeFile(path.join(folder,'request.json'),JSON.stringify({officeEngine:engine,pages:7,fonts:metrics.fonts,embeddedFonts:metrics.embeddedFonts}));
  const start=Date.now(),actual=await ps(POWERPOINT_RENDER_SCRIPT.replace('$result.error=$code','$result.error=$code;$result.diagnostic=$_.Exception.ToString()'),folder);assert(actual.ok);assert.equal(actual.pages,7);
  assert(actual.findings.some(f=>f.code==='rendered_text_covered'&&f.page===2));assert(actual.findings.some(f=>f.code==='system_glyph_missing'&&f.page===5&&f.point==='U+10FFFD'));
  assert(!actual.findings.some(f=>['rendered_text_covered','system_glyph_missing'].includes(f.code)&&[1,3,4,6].includes(f.page)),JSON.stringify(actual.findings));assert(actual.findings.some(f=>f.code==='layer_coverage_partial'&&f.page===7));
  const proofs=[];for(let page=1;page<=7;page++)proofs.push(visualMetadata(await fs.readFile(path.join(folder,`page-${page}.png`)),{page,kind:'office_page'}));assert.equal(sha(await fs.readFile(path.join(folder,'input.pptx'))),sha(bytes));report[engine]={elapsedMs:Date.now()-start,actual,proofs,owner:JSON.parse(await fs.readFile(path.join(folder,'owned.json'),'utf8'))};
  check(`${engine}: actual7-page PNGs, exact page/object obstruction and missing glyph; transparent/background/Chinese positives not falsely failed; rotated coverage unchecked; source unchanged`);
 }
 report.after=await snapshot();for(const before of report.before){const after=report.after.find(p=>p.pid===before.pid);assert.deepEqual(after,before);}for(const engine of ['microsoft','wps'])assert(!report.after.some(p=>p.pid===report[engine].owner.pid));check('Existing Office/WPS process/window identities preserved; owned native renderers exited');report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
