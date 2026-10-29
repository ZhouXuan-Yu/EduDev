/** Actual production UI + deterministic long stream. No provider requests or teacher data. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {_electron} from 'playwright';import {execFileSync} from 'node:child_process';
const desktop=path.resolve(import.meta.dirname,'../..'),build=path.resolve(process.argv[2]||path.join(desktop,'out'));
const output=fs.mkdtempSync(path.join(desktop,'test-results/stream-window-')),runtime=fs.mkdtempSync(path.join(os.tmpdir(),'edu-stream-window-'));
const report={ok:false,build,checks:[],errors:[],scope:'Synthetic production Pi stream, actual renderer input/long tasks/native window. No model/network or natural quality claim.'};
let app,page;
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(runtime,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'synthetic-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await _electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(runtime,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.endsWith('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
   if(!url.endsWith('/chat/completions'))throw Error('Unexpected network blocked');
   const body=JSON.parse(init.body),encoder=new TextEncoder(),chunks=[];
   const chunk=delta=>'data: '+JSON.stringify({id:'stream-fixture',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason:null}]})+'\n\n';
   for(let i=1;i<=50;i++)chunks.push('第'+i+'段：课堂根据学生反馈调整讲解。'+ '这是连续生成的教学说明，明确条件并核对结论。'.repeat(8)+'\n\n');
   globalThis.expectedStream=chunks.join('')+'流式检查完成。';
   return new Response(new ReadableStream({async start(c){try{
    c.enqueue(encoder.encode(chunk({role:'assistant',content:''})));
    for(let i=0;i<250;i++){init.signal?.throwIfAborted();c.enqueue(encoder.encode(chunk({reasoning_content:'核对课堂条件。'})));await new Promise(r=>setTimeout(r,2));}
    for(const block of chunks)for(let p=0;p<block.length;p+=40){init.signal?.throwIfAborted();c.enqueue(encoder.encode(chunk({content:block.slice(p,p+40)})));await new Promise(r=>setTimeout(r,12));}
    c.enqueue(encoder.encode(chunk({content:'流式检查完成。'})));c.enqueue(encoder.encode('data: '+JSON.stringify({id:'stream-fixture',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'));c.close();
   }catch(e){c.error(e);}}}),{headers:{'content-type':'text/event-stream'}});
  };
 });
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>{const el=document.querySelector('[data-testid="office-prompt-input"]');return el&&!el.disabled;});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setBounds({x:40,y:40,width:1200,height:800});w.show();w.moveTop();w.focus();});
 const drag=page.getByTestId('desktop-titlebar-drag');
 report.chrome=await page.getByTestId('desktop-titlebar-safe').evaluate(el=>({controls:el.getBoundingClientRect().width,appRegion:getComputedStyle(el).getPropertyValue('-webkit-app-region'),windowWidth:innerWidth}));
 if(await drag.count()){
  const box=await drag.boundingBox();assert(box.width>150);assert.equal(await drag.evaluate(el=>getComputedStyle(el).getPropertyValue('-webkit-app-region')),'drag');
  const info=await app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0];return{hwnd:w.getNativeWindowHandle().readBigUInt64LE().toString(),content:w.getContentBounds(),bounds:w.getBounds(),scale:screen.getDisplayMatching(w.getBounds()).scaleFactor};});
  const x=Math.round((info.content.x+box.x+box.width/2)*info.scale),y=Math.round((info.content.y+box.y+box.height/2)*info.scale);
  // Read-only native hit test; actual pointer dragging is checked separately.
  const ps=String.raw`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class DragProbe{[DllImport("user32.dll")]public static extern bool SetProcessDPIAware();[DllImport("user32.dll")]public static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l);}'; [DragProbe]::SetProcessDPIAware()|Out-Null; $h=[IntPtr]::new([long]::Parse('__HWND__')); $p=[IntPtr]::new((__Y__ -shl 16) -bor (__X__ -band 65535)); [DragProbe]::SendMessage($h,0x84,[IntPtr]::Zero,$p).ToInt64();`;
  report.chrome.probe={...info,x,y,box};
  report.chrome.hit=Number(execFileSync('powershell.exe',['-NoProfile','-Command',ps.replaceAll('__HWND__',info.hwnd).replaceAll('__X__',String(x)).replaceAll('__Y__',String(y))],{encoding:'utf8',windowsHide:true}).trim());
  const after=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());report.chrome.before=info.bounds;report.chrome.after=after;report.chrome.movable=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMovable());
  assert.equal(report.chrome.hit,2);assert(report.chrome.movable);report.checks.push('Windows hit testing identifies a movable native caption; actual dragging requires a pointer check');
 }else report.chrome.baselineDragMissing=true;
 await page.evaluate(()=>{
  globalThis.perfProbe={long:[],gaps:[],keys:[],typing:[],animations:0};let last=performance.now();
  globalThis.probeTimer=setInterval(()=>{const n=performance.now();perfProbe.gaps.push(n-last-16);last=n;perfProbe.animations=Math.max(perfProbe.animations,document.getAnimations().length);},16);
  globalThis.probeObserver=new PerformanceObserver(list=>perfProbe.long.push(...list.getEntries().map(e=>e.duration)));probeObserver.observe({type:'longtask',buffered:false});
  document.querySelector('[data-testid="office-prompt-input"]').addEventListener('input',()=>{const at=performance.now();requestAnimationFrame(()=>perfProbe.keys.push(performance.now()-at));});
 });
 await page.getByTestId('office-prompt-input').fill('连续生成课堂说明。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByTestId('agent-reply-body').waitFor({timeout:90000});
 for(let i=0;i<8;i++){
  const at=performance.now();await page.getByTestId('office-prompt-input').fill('生成期间编辑草稿 '+i);
  await page.evaluate(ms=>perfProbe.typing.push(ms),performance.now()-at);await new Promise(r=>setTimeout(r,350));
 }
 await page.getByRole('button',{name:'发送消息',exact:true}).waitFor({timeout:120000});
 const actual=await page.getByTestId('agent-reply-body').innerText();
 assert(actual.includes('第50段'));assert(actual.includes('流式检查完成。'));assert.equal((actual.match(/课堂根据学生反馈调整讲解/g)||[]).length,50);
 report.checks.push('Long stream completes with all 50 paragraphs while draft remains editable');
 report.perf=await page.evaluate(()=>{clearInterval(probeTimer);probeObserver.disconnect();return perfProbe;});
 const stats=a=>{const sorted=[...a].sort((a,b)=>a-b);return{count:a.length,max:Math.max(0,...a),mean:a.reduce((s,n)=>s+n,0)/Math.max(1,a.length)};};
 report.metrics={longTasks:stats(report.perf.long),eventLoopDelay:stats(report.perf.gaps),inputToFrame:stats(report.perf.keys),typingRoundtrip:stats(report.perf.typing),maxAnimations:report.perf.animations};
 assert((await page.getByTestId('office-prompt-input').inputValue()).includes('草稿 7'));assert.deepEqual(report.errors,[]);report.ok=true;
 await page.screenshot({path:path.join(output,'complete.png')});
}catch(e){report.error=String(e.stack||e);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,output,metrics:report.metrics,error:report.error}));}
