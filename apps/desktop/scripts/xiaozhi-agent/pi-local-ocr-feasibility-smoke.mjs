// Source/engine feasibility only. No app profile, file picker, API key or cloud request.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

assert.equal(process.platform,'win32','This native engine probe requires Windows');
const commit='0e25eb553d57077193d186eb447815330d7c8c99';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-local-ocr-preflight-'));
const moduleRoot=path.join(output,'PsOcr');fs.mkdirSync(moduleRoot);
const hashes=[];
for(const name of ['root.psm1','PsOcr.psd1','LICENSE']){
  const relative=name==='LICENSE'?name:`Modules/PsOcr/1.1.0/${name}`;
  const response=await fetch(`https://raw.githubusercontent.com/TobiasPSP/PsOcr/${commit}/${relative}`,{signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,`Original source unavailable: ${name}`);
  const bytes=Buffer.from(await response.arrayBuffer());assert(bytes.length>100&&bytes.length<32768);
  fs.writeFileSync(path.join(moduleRoot,name),bytes,{flag:'wx'});
  hashes.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
assert.match(fs.readFileSync(path.join(moduleRoot,'LICENSE'),'utf8'),/MIT License/);
const worker=String.raw`
$ErrorActionPreference='Stop'
[Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$request=[Console]::ReadLine() | ConvertFrom-Json
Import-Module -Name $request.module -ErrorAction Stop
$languages=@([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object {$_.LanguageTag})
$language=New-Object Windows.Globalization.Language('zh-Hans-CN')
if ($null -eq [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)) {throw 'Chinese OCR unavailable'}
Add-Type -AssemblyName System.Drawing
$bitmap=New-Object System.Drawing.Bitmap(1400,400)
$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
$font=New-Object System.Drawing.Font('Microsoft YaHei',32)
try {
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.DrawString('教师资料 本地识别',$font,[System.Drawing.Brushes]::Black,40,40)
  $graphics.DrawString('OFFICE 731928',$font,[System.Drawing.Brushes]::Black,40,150)
  $graphics.DrawString('课程时间 37 分钟',$font,[System.Drawing.Brushes]::Black,40,260)
  $bitmap.Save($request.image,[System.Drawing.Imaging.ImageFormat]::Png)
} finally {$font.Dispose();$graphics.Dispose();$bitmap.Dispose()}
$rows=@(Convert-PsoImageToText -Path $request.image -Language $language)
$text=($rows | ForEach-Object {$_.Text}) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($request.privateText,$text,[System.Text.UTF8Encoding]::new($false))
$compact=$text -replace '\s',''
[pscustomobject]@{schemaVersion=1;engine='Windows.Media.Ocr';moduleVersion=(Get-Module PsOcr).Version.ToString();languages=$languages;maxDimension=[Windows.Media.Ocr.OcrEngine]::MaxImageDimension;lines=$rows.Count;chineseMatched=$compact.Contains('教师资料本地识别');englishMatched=$compact.Contains('OFFICE');codeMatched=$compact.Contains('731928');durationMatched=$compact.Contains('37')} | ConvertTo-Json -Depth 4 -Compress
`;
// Windows PowerShell 5.1 otherwise interprets UTF-8 scripts as the system ANSI code page.
const script=path.join(output,'worker.ps1');fs.writeFileSync(script,'\uFEFF'+worker,{flag:'wx'});
const systemRoot=process.env.SystemRoot??'C:\\Windows';
const powershell=path.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');assert(fs.existsSync(powershell));
const env={SystemRoot:systemRoot,WINDIR:systemRoot,TEMP:output,TMP:output};
const child=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-File',script],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
let stdout='',stderr='',oversized=false,timedOut=false;
const timer=setTimeout(()=>{timedOut=true;child.kill();},60000);
for(const [stream,kind] of [[child.stdout,'stdout'],[child.stderr,'stderr']])stream.on('data',chunk=>{
  if(kind==='stdout')stdout+=String(chunk);else stderr+=String(chunk);
  if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)>1024*1024){oversized=true;child.kill();}
});
child.stdin.end(JSON.stringify({module:path.join(moduleRoot,'PsOcr.psd1'),image:path.join(output,'synthetic.png'),privateText:path.join(output,'synthetic-ocr.txt')})+'\n');
const exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);}).finally(()=>clearTimeout(timer));
fs.writeFileSync(path.join(output,'private-worker.log'),stdout+'\n'+stderr);
let result;try{result=JSON.parse(stdout.trim());}catch{result=null;}
const success=exitCode===0&&!timedOut&&!oversized&&result?.schemaVersion===1&&result?.moduleVersion==='1.1.0'&&result.chineseMatched&&result.englishMatched&&result.codeMatched&&result.durationMatched;
const report={success,exitCode,timedOut,oversized,upstream:{repository:'TobiasPSP/PsOcr',version:'1.1.0',commit,license:'MIT',files:hashes,totalBytes:hashes.reduce((sum,item)=>sum+item.bytes,0)},engine:result,boundary:'Original unmodified module and synthetic print only. Child receives minimal Windows environment and no credentials; OCR has no network/API calls. Engine preflight is not attachment/OCR correction UI, public image Pi vision, handwriting/formula accuracy, packaged or no-VPN acceptance.'};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,...report}));assert(success,'Actual local OCR feasibility failed; inspect private worker log');
