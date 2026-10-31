import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {_electron} from 'playwright';
const root=path.resolve(process.argv[2]||'');
assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(/^omni-real-material-[a-z0-9]+$/i.test(path.basename(root)));assert.equal(fs.realpathSync(root),root);
const desktop=process.cwd(),data=path.join(root,'data'),output=fs.mkdtempSync(path.join(root,'k0-file-'));
const query=(sql,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...p);}finally{db.close();}};
const resource=query("SELECT id,content_hash,local_path,file_size FROM teacher_resources WHERE original_file_name='主书.pdf'")[0];assert(resource&&resource.file_size>50*1048576);
const before=query('SELECT id,stem,answer,analysis,archive_json,updated_at FROM question_bank_items ORDER BY id');
const callsBefore=query('SELECT id,calls FROM material_ai_batches ORDER BY id');
const probeDir=fs.mkdtempSync(path.join(desktop,'test-results','k0-file-probe-')),probe=path.join(probeDir,'host.cjs');
await build({stdin:{contents:`
import {DatabaseSync} from 'node:sqlite';
import {MaterialRepository} from './src/main/assets/material-repository';
import {createMaterialPageTools} from './src/main/assets/material-page-tools';
import {renderPdfFilePage} from './src/main/xiaozhi-agent/pdf-file-host';
import {previewMaterialPage} from './src/main/assets/material-page-preview';
import {MATERIAL_PREVIEW_SCHEMA} from './src/shared/material-page-preview';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
export async function run(data,id,operation,page=62){
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 try{
  const repo=new MaterialRepository({root:path.join(data,'teacher_resources'),all:async(sql,p=[])=>db.prepare(sql).all(...p),mapResource:r=>({id:r.id,contentHash:r.content_hash,localPath:r.local_path,originalFileName:r.original_file_name}),mapChunk:()=>{throw Error('Unexpected full body');}});
  repo.original=async()=>{throw Error('Forbidden whole-book bytes');};repo.readingSnapshot=async()=>{throw Error('Forbidden book snapshot');};
  const r=await repo.resource(id),signal=new AbortController();if(operation==='cancel')signal.abort();
  const start=performance.now(),memoryBefore=process.memoryUsage().rss;
  if(operation==='preview'){
   const p=await previewMaterialPage(repo,{schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:randomUUID(),resourceId:id,version:r.contentHash,page,box:[0,0,1,1]},signal.signal,async()=>{throw Error('Forbidden byte render');},renderPdfFilePage);
   return {ok:p.ok,page:p.page,total:p.total,sha256:p.sha256,width:p.width,height:p.height,ms:performance.now()-start};
  }
  const store={materials:repo,getDataRoot:()=>data,listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text})};
  const tool=createMaterialPageTools(store,()=>true,new Map([[id,r.contentHash]]))[0];
  const raw={resourceId:id,page,...(operation==='region'?{box:[0,0,.5,.5]}:{})};
  let result,cursor={},windows=0,returnedLines=0,characters=0;const seen=new Set(),lineIds=new Set();
  for(;windows<34;){result=JSON.parse((await tool.execute('owned-real-file',{...raw,...cursor},signal.signal)).content[0].text);windows++;if(!result.success)break;for(const line of result.lines){const key=line.id+':'+line.characterOffset;if(seen.has(key))throw Error('Repeated source window');seen.add(key);lineIds.add(line.id);returnedLines++;characters+=line.text.length;}if(!result.next)break;cursor=result.next;}
  if(result.success&&result.next)throw Error('Unfinished source pagination');
  if(result.success&&lineIds.size!==result.totalLines)throw Error('Source lines omitted');
  return {success:result.success,code:result.code,page:result.page,totalPages:result.totalPages,totalLines:result.totalLines,next:result.next,windows,returnedLines,positionBasis:result.positionBasis,characters,ms:performance.now()-start,rssBefore:memoryBefore,rssAfter:process.memoryUsage().rss};
 }finally{db.close();}
}`,resolveDir:desktop,sourcefile:'k0-owned-probe.ts',loader:'ts'},outfile:probe,platform:'node',format:'cjs',bundle:true,packages:'external',define:{'import.meta.url':JSON.stringify(pathToFileURL(probe).href)},logLevel:'silent'});
const report={output,checks:[],observations:[],cloudRequests:0,rendererErrors:[],scope:'Actual production Electron material UI plus source-bundled production page-tool factory/file Worker against existing authorized real-book SQLite read-only adapter. No Pi/provider generation, mathematical/quality or 40GB acceptance.',buildSha256:createHash('sha256').update(fs.readFileSync('out/main/index.js')).digest('hex')};
let app,page;
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+path.join(output,'profile')],cwd:output,env,timeout:60000});await app.evaluate(({net})=>{globalThis.k0CloudRequests=0;for(const o of [globalThis,net])o.fetch=async()=>{globalThis.k0CloudRequests++;throw Error('No network in local K0 journey');};});page=await app.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.locator('[data-testid="nav-knowledge"]:visible').click();}
async function close(){if(app){report.cloudRequests+=await app.evaluate(()=>globalThis.k0CloudRequests||0);await app.close();app=undefined;}}
const run=async(operation,n=62)=>app.evaluate(async(_electron,args)=>{const require=process.getBuiltinModule('module').createRequire(args.probe);return require(args.probe).run(args.data,args.id,args.operation,args.page);},{probe,data,id:resource.id,operation,page:n});
try{
 await launch();await page.getByTestId('material-'+resource.id).getByRole('button').click();await page.getByTestId('materials-original-open').click();await page.getByTestId('materials-original-image').waitFor();
 await page.getByTestId('materials-original-page-input').fill('62');await page.getByTestId('materials-original-page-jump').click();await page.locator('[data-testid="materials-original-image"][alt*="62"]').waitFor();
 for(const width of [1366,1920]){await page.setViewportSize({width,height:width===1366?768:1080});const button=page.getByTestId('materials-original-page-jump');await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();assert(b&&b.x>=0&&b.y>=0);await page.screenshot({path:path.join(output,'page62-'+width+'.png')});}
 report.checks.push('Visible material UI opens unchanged 198MB book page 62 at both viewport sizes');
 for(const n of [51,62]){const r=await run('page',n);assert(r.success,JSON.stringify(r));assert.equal(r.page,n);assert.equal(r.totalPages,62);assert(r.characters>0);report.observations.push(r);}
 report.checks.push('Actual default production page tool/file OCR reads pages 51 and 62 without original()/readingSnapshot()');
 const region=await run('region');assert(region.success,JSON.stringify(region));assert.equal(region.positionBasis,'selected_region');report.observations.push(region);
 const preview=await run('preview');assert(preview.ok);assert.equal(preview.total,62);report.observations.push(preview);report.checks.push('Same file adapter stages a source-backed original image and local region OCR');
 const cancel=await run('cancel');assert.equal(cancel.code,'cancelled');report.checks.push('Pre-stopped operation refuses processing');
 await close();await launch();const cold=await run('page');assert(cold.success,JSON.stringify(cold));report.observations.push(cold);report.checks.push('Cold Electron restart reuses source-backed page evidence');
 assert.deepEqual(query('SELECT id,stem,answer,analysis,archive_json,updated_at FROM question_bank_items ORDER BY id'),before);assert.deepEqual(query('SELECT id,calls FROM material_ai_batches ORDER BY id'),callsBefore);assert.deepEqual(report.rendererErrors,[]);await close();assert.equal(report.cloudRequests,0);report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
