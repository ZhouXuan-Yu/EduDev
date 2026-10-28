import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';

assert.equal(process.platform,'win32','This regression covers Windows startup visibility');
const desktop=path.resolve(import.meta.dirname,'..');
fs.mkdirSync(path.join(desktop,'test-results'),{recursive:true});
const output=fs.mkdtempSync(path.join(desktop,'test-results/daily-launch-visibility-'));
const source=fs.readFileSync(path.join(desktop,'scripts/start-desktop.mjs'),'utf8');
const match=source.match(/detached:\s*true,\s*windowsHide:\s*(true|false)/);
assert(match,'Identify the existing interactive Electron spawn option');
const report={ok:false,build:fingerprint(path.join(desktop,'out')).sha256,configuredWindowsHide:match[1]==='true',cases:[],rendererErrors:[]};
function nativeWindow(pid,close=false) {
  const script=`$ProgressPreference='SilentlyContinue';Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class VisibilityProbe{
public delegate bool Callback(IntPtr h,IntPtr p);
[DllImport("user32.dll")]public static extern bool EnumWindows(Callback c,IntPtr p);
[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
[DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
[DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
}
'@
$script:windows=@();[VisibilityProbe]::EnumWindows({param($h,$p) $windowPid=0;[void][VisibilityProbe]::GetWindowThreadProcessId($h,[ref]$windowPid);if($windowPid -eq ${pid}){$caption=[System.Text.StringBuilder]::new(512);[void][VisibilityProbe]::GetWindowText($h,$caption,512);if($caption.ToString() -eq 'Omni-Edu Agent'){$script:windows += [pscustomobject]@{pid=$windowPid;hwnd=$h.ToInt64();visible=[VisibilityProbe]::IsWindowVisible($h)};${close?'[void][VisibilityProbe]::PostMessage($h,16,[IntPtr]::Zero,[IntPtr]::Zero);':''}}};return $true},[IntPtr]::Zero)|Out-Null;ConvertTo-Json -InputObject @($script:windows) -Compress`;
  return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim());
}
async function probe(windowsHide) {
  const root=path.join(output,windowsHide?'hidden':'interactive');fs.mkdirSync(root);
  const profile=path.join(root,'profile');
  const env={...process.env, NODE_ENV:'development', OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:path.join(root,'data')};
  for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_'))delete env[key];
  for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','OMNI_EDU_XIAOZHI_PI'])delete env[key];
  Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'});
  const child=spawn(path.join(desktop,'node_modules/electron/dist/electron.exe'),[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile,'--remote-debugging-port=0'],{cwd:desktop,env,stdio:'ignore',detached:true,windowsHide});
  let browser;
  try {
    const portFile=path.join(profile,'DevToolsActivePort'),deadline=Date.now()+60000;
    while(!fs.existsSync(portFile)){if(child.exitCode!==null)throw Error('Electron exited: '+child.exitCode);if(Date.now()>deadline)throw Error('Debug endpoint not ready');await delay(100);}
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
    browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
    let page;
    while(!(page=browser.contexts().flatMap(context=>context.pages()).find(item=>item.url().includes('/out/renderer/index.html')))){if(Date.now()>deadline)throw Error('File renderer not ready');await delay(100);}
    page.on('pageerror',error=>report.rendererErrors.push(String(error)));
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'attached',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')?.startsWith('aisession_'));
    const [window]=nativeWindow(child.pid);assert(window,'Find the real native product window');
    const entry={windowsHide,pid:child.pid,url:page.url(),...window};
    report.cases.push(entry);console.log(JSON.stringify(entry));
    return entry;
  } finally {
    if(browser)await browser.close();
    nativeWindow(child.pid,true);
    const deadline=Date.now()+20000;
    while(child.exitCode===null && Date.now()<deadline)await delay(100);
    if(child.exitCode===null){child.kill();throw Error('Owned probe did not close gracefully');}
  }
}
try {
  const hidden=await probe(true),interactive=await probe(false);
  assert.equal(interactive.visible,true,'Explicit interactive Electron must show its first window');
  assert.equal(hidden.visible,false,'Reproduce the original hidden-first-window counterexample');
  assert.equal(report.cases.find(item=>item.windowsHide===report.configuredWindowsHide).visible,true,'The actual daily launcher configuration must show the new build');
  assert.deepEqual(report.rendererErrors,[]);report.ok=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,report:path.join(output,'report.json'),error:report.error}));}
