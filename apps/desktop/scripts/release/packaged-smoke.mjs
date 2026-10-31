import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {_electron} from 'playwright';
import {Document,Packer,Paragraph} from 'docx';
import {setTimeout as delay} from 'node:timers/promises';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(desktop,'test-results/goal/kb-s0','packaged-'+Date.now());
fs.mkdirSync(output,{recursive:true});
const profile=path.join(output,'profile'),data=path.join(output,'data'),exe=process.env.OMNI_EDU_PACKAGED_EXE||path.join(desktop,'.release/win-unpacked/小智.exe');
const text=path.join(output,'教师教案.md'),docx=path.join(output,'教师讲义.docx');
const longText=path.join(output,'长教材.txt'),image=path.join(output,'题目照片.png'),pdf=path.join(output,'扫描题页.pdf');
fs.writeFileSync(text,'# 一元一次方程\n\n方程的解必须使等式两边相等。');
fs.writeFileSync(docx,await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('一元一次方程讲义：移项必须变号。')]}]})));
fs.writeFileSync(longText,'完整教材内容。'.repeat(18000)+'\n教材尾部验证：尾部知识点不能丢失。');
const report={executable:exe,profile,data,checks:[],rendererErrors:[],boundary:'Packaged executable on this Windows host with empty PATH; not a clean VM or signed release.'};
let app,page;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_PYTHON:'C:\\not-installed\\python.exe',PATH:''};
 for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(key))delete env[key];
 app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+profile],cwd:output,env,timeout:60000});
 page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));
 await page.setViewportSize({width:1366,height:768});
 await page.getByTestId('nav-knowledge').waitFor({timeout:60000});
 await page.getByTestId('nav-knowledge').click();await page.getByTestId('materials-import').waitFor();
}
try{
 await launch();
 const components=await app.evaluate(async({app},root)=>{
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),url=process.getBuiltinModule('node:url');
  if(!app.isPackaged)throw new Error('Not packaged');
  const require=process.getBuiltinModule('node:module').createRequire(path.join(app.getAppPath(),'package.json'));
  const runtime=require(path.join(app.getAppPath(),'out/main/education-runtime.js'));
  const cp=process.getBuiltinModule('node:child_process'),spawn=cp.spawn,commands=[];
  cp.spawn=function(command,...args){commands.push(String(command));return spawn.call(this,command,...args);};
  process.getBuiltinModule('node:module').syncBuiltinESMExports();
  try{
   const value=await runtime.runEducationWorker('reading',{text:'方程的解。',quote:'方程的解'},'xiaozhi.education.quote.v1',new AbortController().signal,65536,2048,v=>v.found===true,v=>v);
   if(!value.found||!commands.length||commands.some(x=>!x.startsWith(path.join(process.resourcesPath,'education-runtime'))))throw new Error('System interpreter fallback');
   const calls=Array.from({length:5},()=>runtime.runEducationWorker('reading',{text:'方程的解。',quote:'方程的解'},'xiaozhi.education.quote.v1',new AbortController().signal,65536,2048,v=>v.found===true,v=>v).then(()=>({ok:true}),e=>({error:e.message})));
   const results=await Promise.all(calls);
   if(results.filter(x=>x.ok).length!==4||results.filter(x=>x.error==='busy').length!==1)throw new Error('Worker admission bound failed: '+JSON.stringify(results));
   const abort=new AbortController(),pending=runtime.runEducationWorker('reading',{text:'方程的解。',quote:'方程的解'},'xiaozhi.education.quote.v1',abort.signal,65536,2048,v=>v.found===true,v=>v);abort.abort();
   const cancelled=await pending.then(()=>'',e=>e.message);if(cancelled!=='cancelled')throw new Error('Validation cancellation failed');
  }finally{cp.spawn=spawn;process.getBuiltinModule('node:module').syncBuiltinESMExports();}
  const lance=require('@lancedb/lancedb'),db=await lance.connect(path.join(root,'lance'));
  const table=await db.createTable('s0_vectors',[{id:1,vector:[1,0,0]},{id:2,vector:[0,1,0]}]);
  const hits=await table.search([1,0,0]).limit(1).toArray();if(hits[0].id!==1)throw new Error('Vector readback failed');
  return {packaged:app.isPackaged,resourcesPath:process.resourcesPath,workerCommands:commands,vectorId:hits[0].id};
 },output);
 report.checks.push({name:'Packaged frozen worker and native LanceDB',passed:true,components});
 const png=await app.evaluate(async({BrowserWindow})=>{
  const win=new BrowserWindow({show:false,width:900,height:300,webPreferences:{offscreen:true,sandbox:true,nodeIntegration:false,contextIsolation:true}});
  try{await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html><body style="margin:40px;background:white;color:black;font:72px Arial">1 + 1 = 2</body></html>'));return(await win.webContents.capturePage()).toPNG().toString('base64');}finally{win.destroy();}
 });
 fs.writeFileSync(image,Buffer.from(png,'base64'));
 const pdfBytes=await app.evaluate(async({BrowserWindow},png)=>{
  const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
  try{await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html><body><img width="700" src="data:image/png;base64,'+png+'"></body></html>'));return(await win.webContents.printToPDF({pageSize:'A4',printBackground:true})).toString('base64');}finally{win.destroy();}
 },png);
 fs.writeFileSync(pdf,Buffer.from(pdfBytes,'base64'));
 const pdfComponent=await app.evaluate(async({app},file)=>{
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),require=process.getBuiltinModule('node:module').createRequire(path.join(app.getAppPath(),'package.json'));
  const ocr=require(path.join(app.getAppPath(),'out/main/ocr-runtime.js'));
  const receipt=await ocr.renderLocalPdfPage(fs.readFileSync(file),{page:1,box:[0,0,1,1]},new AbortController().signal);
  if(!receipt.ok)throw new Error('PDF page component failed');return {ok:receipt.ok};
 },pdf);
 report.checks.push({name:'Packaged PDFium page component on one synthetic scanned page',passed:true,pdfComponent});
 // Use the real teacher action; only the native picker selection is controlled.
 await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},[text,docx,longText,image,pdf]);
 await page.getByTestId('materials-import').click();
 const deadline=Date.now()+180000;let ready=false,last;
 while(Date.now()<deadline){
  last=await page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'',offset:0}));
  if(last.total===5&&last.resources.every(x=>x.parseStatus==='ready')){ready=true;break;}
  await delay(250);
 }
 assert(ready,'Import did not complete: '+JSON.stringify(last?.resources.map(x=>({name:x.originalFileName,status:x.parseStatus,engine:x.parseEngine}))));
 report.checks.push({name:'Teacher imports long text, Markdown, DOCX, image and synthetic scanned PDF through local parsers',passed:true});
 await page.screenshot({path:path.join(output,'materials-packaged.png'),fullPage:true});
 await app.close();app=undefined;await launch();
 const catalog=await page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'',offset:0}));
 assert.equal(catalog.total,5);assert(catalog.resources.every(x=>x.parseStatus==='ready'));
 const bodies=await page.evaluate(async resources=>Promise.all(resources.map(r=>window.omniEdu.getMaterialBody({schemaVersion:'xiaozhi.materials.v1',resourceId:r.id,offset:0}))),catalog.resources);
 assert(bodies.every(x=>x.chunks.length>0));
 const longResource=catalog.resources.find(x=>x.originalFileName==='长教材.txt');assert(longResource.chunkCount>80);
 const tail=await page.evaluate(async r=>window.omniEdu.getMaterialBody({schemaVersion:'xiaozhi.materials.v1',resourceId:r.id,offset:r.chunkCount-1}),longResource);
 assert(tail.chunks.some(x=>x.contentMd.includes('尾部知识点不能丢失')));
 const imageResource=catalog.resources.find(x=>x.originalFileName==='题目照片.png');
 const imageBody=bodies.find(x=>x.resource.id===imageResource.id);assert(imageBody.chunks.some(x=>x.contentMd.includes('2')));
 assert(imageResource.parseEngine.startsWith('image-rapidocr'));
 await page.getByTestId('material-'+imageResource.id).click();
 await page.getByTestId('materials-ocr-notice').waitFor();
 assert.match(await page.getByTestId('materials-ocr-notice').innerText(),/尚未由教师核对/);
 await page.screenshot({path:path.join(output,'image-ocr-after-restart.png'),fullPage:true});
 await page.setViewportSize({width:1920,height:1080});
 await page.screenshot({path:path.join(output,'image-ocr-1920.png'),fullPage:true});
 report.checks.push({name:'Tail beyond 80 chunks and image OCR persist after cold restart',passed:true});
 report.checks.push({name:'Cold restart catalogue/body readback',passed:true});
 assert.deepEqual(report.rendererErrors,[]);
 report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{if(app)await app.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...report},null,2));}
