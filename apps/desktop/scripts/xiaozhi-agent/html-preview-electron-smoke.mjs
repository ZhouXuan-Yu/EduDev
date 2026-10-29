import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {_electron as electron} from 'playwright';
import {htmlArtifactPreview} from '../../src/shared/html-artifact.ts';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-html-preview-'));
let requests=0,application;
const server=createServer((_req,res)=>{requests++;res.end('forbidden');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const target=`http://127.0.0.1:${server.address().port}/forbidden`;
const html=htmlArtifactPreview(`<!doctype html><html lang="zh-CN"><title>浮力</title><body><label for="volume">排液体积</label><input id="volume" type="range" min="1" max="10" value="1"><output id="force">10 N</output><math><mi>F</mi><mo>=</mo><mi>ρ</mi><mi>g</mi><mi>V</mi></math><button id="navigate">导航探针</button><p id="probe"></p><script>
volume.addEventListener('input',()=>force.textContent=volume.value*10+' N');
let parentBlocked=false;try{parent.document.body.dataset.overwritten='bad';}catch{parentBlocked=true;}
probe.textContent=JSON.stringify({node:typeof require,process:typeof process,parentBlocked});
fetch('${target}').catch(()=>{});const image=new Image();image.src='${target}?image';navigator.sendBeacon('${target}?beacon','synthetic');
navigate.onclick=()=>location.href='${target}?navigation';
</script></body></html>`);
const fixture=path.join(output,'fixture.html');fs.writeFileSync(fixture,'<!doctype html><title>本地预览隔离检查</title><body data-host="unchanged"><iframe id="preview" title="教学交互演示" sandbox="allow-scripts" referrerpolicy="no-referrer" style="width:900px;height:600px" srcdoc="'+html.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></iframe></body>');
const bootstrap=path.join(output,'bootstrap.cjs');
await build({stdin:{contents:`import {app,BrowserWindow} from 'electron';import {installLocalFrameIsolation} from './src/main/xiaozhi-agent/local-frame-isolation';app.whenReady().then(()=>{const window=new BrowserWindow({width:1100,height:800,show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});installLocalFrameIsolation(window.webContents);window.loadFile(${JSON.stringify(fixture)});});app.on('window-all-closed',()=>app.quit());`,resolveDir:desktop},outfile:bootstrap,bundle:true,platform:'node',format:'cjs',external:['electron'],logLevel:'silent'});
const report={ok:false,checks:[],boundary:'Actual Electron sandbox and same host network/navigation helper; synthetic page. This is an interaction/boundary check, not complete teacher/model acceptance.'};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
try{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 application=await electron.launch({args:[bootstrap,`--user-data-dir=${path.join(output,'profile')}`],env,timeout:30000});
 const page=await application.firstWindow(),frame=page.frameLocator('#preview');await frame.locator('#probe').waitFor();
 assert.deepEqual(JSON.parse(await frame.locator('#probe').textContent()),{node:'undefined',process:'undefined',parentBlocked:true});check('Opaque sandbox denies Node and parent DOM access');
 await frame.locator('#volume').fill('4');await frame.locator('#volume').dispatchEvent('input');assert.equal(await frame.locator('#force').textContent(),'40 N');assert.equal(await frame.locator('math').textContent(),'F=ρgV');check('Inline interaction, Chinese and native formula work offline');
 await frame.locator('#navigate').click();await page.waitForTimeout(150);assert.equal(requests,0);assert.equal(await page.locator('body').getAttribute('data-host'),'unchanged');assert.equal(await frame.locator('#force').textContent(),'40 N');check('Fetch, beacon, image and self-navigation make zero network requests');
 await page.screenshot({path:path.join(output,'preview.png')});report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;console.error(report.error);}
finally{await application?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,requests},null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
