import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFile} from 'node:child_process';
import {_electron} from 'playwright';

const root=path.resolve(process.argv[2]||'');
assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(/^omni-byte-capacity-[a-z0-9]+$/i.test(path.basename(root)));assert.equal(fs.realpathSync(root),root);
const original=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));
assert(original.success&&original.output===root&&original.final.bytes===40*1024**3,'Only the completed owned 40GiB fixture can be reopened');
const desktop=process.cwd(),output=fs.mkdtempSync(path.join(root,'reopen-')),data=path.join(root,'data');
const report={output,checks:[],queries:[],rendererErrors:[],cloudRequests:0,buildSha256:createHash('sha256').update(fs.readFileSync(path.join(desktop,'out/main/index.js'))).digest('hex'),scope:'Current production build reopens the actual retained 40GiB byte-capacity fixture. 40 one-page synthetic PDFs, small visible text plus binary load. Source UI, real local embedding/reranker, typed keyword queries and original-page image; NOT natural large-corpus recall, OCR/AI correctness or installer acceptance.'};
let app,page;
const sql=q=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all();}finally{db.close();}};
const facts=()=>sql('SELECT id,original_file_name,local_path,content_hash,file_size,parse_status FROM teacher_resources ORDER BY id');
const before=facts();assert.equal(before.length,40);assert(before.every(r=>r.parse_status==='ready'));
const manifest=original.stages.flatMap(s=>s.manifest);
for(const r of before){const m=manifest.find(m=>path.basename(m.file)===r.original_file_name);assert(m);assert.equal(r.file_size,m.bytes);assert.equal(r.content_hash,m.sha256);assert.equal(fs.statSync(r.local_path).size,m.bytes);}
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,250));}throw Error('40GiB reopen deadline exceeded');};
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
  for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
  app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+path.join(output,'profile')],cwd:output,env,timeout:60000});
  await app.evaluate(({net})=>{globalThis.capacityReopenCloud=0;for(const object of [globalThis,net])object.fetch=async()=>{globalThis.capacityReopenCloud++;throw Error('Owned capacity verification blocks cloud');};});
  page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));
  await page.locator('[data-testid="nav-knowledge"]:visible').click();await page.getByTestId('materials-text-query').waitFor();
}
async function close(){if(app){report.cloudRequests+=await app.evaluate(()=>globalThis.capacityReopenCloud||0);await app.close();app=undefined;}}
async function search(label,mode){
  await page.locator('[data-testid="nav-knowledge"]:visible').click();await page.getByTestId('materials-search-mode').selectOption(mode);
  await page.getByTestId('materials-text-query').fill(label);const start=performance.now();await page.getByTestId('materials-text-submit').click();
  await until(async()=>!await page.getByTestId('materials-text-submit').isDisabled());
  await until(async()=>await page.locator('[data-testid^="material-text-hit-"]').count()>0);
  assert((await page.getByTestId('materials-text-results').innerText()).includes(label));
  const sample={label,mode,uiMs:performance.now()-start};report.queries.push(sample);
  if(mode==='hybrid'){
    sample.rerankNotice=(await page.locator('[data-testid="retrieval-rerank-notice"]:visible').innerText()).trim();
    assert.equal(sample.rerankNotice,'已用本地模型进一步比较题意。','The first visible query must complete comparison, rather than succeeding only on a cached retry');
  }
}
try{
  await launch();
  report.retrieval=await until(async()=>{const s=await page.evaluate(()=>window.omniEdu.getRetrievalStatus());return s.available&&!s.pending&&!s.failed&&!s.building?s:undefined;});
  const first=manifest[0].label,last=manifest.at(-1).label;
  await search(first,'keyword');await search(last,'keyword');
  for(const m of manifest){
    const result=await page.evaluate(query=>window.omniEdu.searchMaterialText({schemaVersion:'xiaozhi.material-search.v1',query,offset:0,mode:'keyword'}),m.label);
    const expected=before.find(r=>r.original_file_name===path.basename(m.file));assert(result.hits.some(h=>h.source.resourceId===expected.id&&h.excerpt.includes(m.label)));
  }
  report.checks.push('Current build finds each of the 40 persisted sources through typed keyword retrieval; visible first/last queries reach the full 40GiB library');
  await search(first,'hybrid');
  const hybrid=await page.evaluate(query=>window.omniEdu.searchMaterialText({schemaVersion:'xiaozhi.material-search.v1',query,offset:0,mode:'hybrid'}),first);
  assert(hybrid.semantic?.available&&hybrid.semantic.complete,JSON.stringify(hybrid.semantic));assert(hybrid.semantic.rerank?.available&&hybrid.semantic.rerank.processed===40&&hybrid.semantic.rerank.complete,JSON.stringify(hybrid.semantic.rerank));report.hybridCoverage=hybrid.semantic;
  report.memory=await app.evaluate(({app})=>app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,workingSetKiB:m.memory.workingSetSize})));
  if(process.platform==='win32'){
    const parents=report.memory.map(m=>m.pid).filter(Number.isSafeInteger);
    report.nativeMemory=await new Promise(resolve=>execFile('powershell.exe',['-NoProfile','-Command',`$owned=@(${parents.join(',')}); Get-CimInstance Win32_Process -Filter "Name LIKE 'omni-edu-%'" | Where-Object { $owned -contains [int]$_.ParentProcessId } | ForEach-Object { $p=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if($p){[pscustomobject]@{pid=$p.Id;name=$p.ProcessName;parentPid=$_.ParentProcessId;workingSetBytes=$p.WorkingSet64;privateBytes=$p.PrivateMemorySize64}} } | ConvertTo-Json -Compress`],{windowsHide:true,timeout:5000},(_e,stdout)=>{try{const j=JSON.parse(stdout);resolve(Array.isArray(j)?j:[j]);}catch{resolve([]);}}));
  }
  const hit=page.locator('[data-testid^="material-text-hit-"]').filter({hasText:first}).first();await hit.click();
  await page.getByTestId('materials-detail').waitFor();assert((await page.getByTestId('materials-detail').innerText()).includes(first));
  await page.getByTestId('materials-detail').getByTestId('materials-original-open').click();await page.getByTestId('materials-detail').locator('img').waitFor({state:'visible'});
  assert(await page.getByTestId('materials-detail').locator('img').evaluate(i=>i.naturalWidth>0));
  report.checks.push('Existing local embeddings cover these 40 small texts and real reranking processes bounded candidates; teacher opens exact source and actual page image from a 1GiB PDF');
  report.viewports=[];
  const window=await app.browserWindow(page);
  for(const [width,height]of [[1366,768],[1920,1080]]){
    const before=await window.evaluate(w=>({id:w.id,bounds:w.getContentBounds(),maximized:w.isMaximized(),zoom:w.webContents.getZoomFactor()}));
    await window.evaluate((w,s)=>w.setContentSize(s.width,s.height),{width,height});
    const sample={requested:{width,height},before,native:await window.evaluate(w=>w.getContentBounds()),css:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))};
    report.viewports.push(sample);
    await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height},{timeout:10000});
    sample.css=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`source-${width}.png`),fullPage:true});
  }
  await close();await launch();assert.deepEqual(facts(),before);assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');await search(last,'hybrid');
  report.checks.push('Second current-build native restart preserves all 40 immutable resource facts; final source remains retrievable, both viewport sizes are reachable');
  assert.equal(report.rendererErrors.length,0);report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;try{await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});report.failureText=(await page.locator('body').innerText()).slice(0,2000);}catch{}}
finally{await close();if(report.cloudRequests){report.success=false;process.exitCode=1;}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
