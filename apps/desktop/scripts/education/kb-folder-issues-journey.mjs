import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {Document,Paragraph,Packer} from 'docx';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
const resume=process.argv.find(a=>a.startsWith('--resume='))?.slice(9);
const desktop=process.cwd(),output=resume?path.resolve(resume):fs.mkdtempSync(path.join(os.tmpdir(),'kb-folder-issues-ui-')),folder=path.join(output,'教师混合资料'),nested=path.join(folder,'物理','初二','第一章'),data=path.join(output,'data'),profile=path.join(output,'profile');
const reportFile=path.join(output,resume?'resume-report-'+Date.now()+'.json':'report.json');
if(!resume){
fs.mkdirSync(nested,{recursive:true});
const text='学科：物理\n年级：初二\n知识点：质量\n第1题 质量为2千克的物体，质量等于多少克？\n【答案】2000克\n【解析】1千克等于1000克。';
fs.writeFileSync(path.join(folder,'正常.md'),text);fs.writeFileSync(path.join(nested,'正常.txt'),text.replaceAll('2千克','3千克').replaceAll('2000','3000'));
fs.writeFileSync(path.join(nested,'正常.docx'),await Packer.toBuffer(new Document({sections:[{children:text.split('\n').map(t=>new Paragraph(t))}]})));
fs.writeFileSync(path.join(nested,'损坏.pdf'),'%PDF-1.7\nThis is an intentionally truncated synthetic PDF.');fs.writeFileSync(path.join(folder,'跳过.zip'),'unsupported');
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={output,checks:[],rendererErrors:[],buildMainSha:sha(fs.readFileSync(path.join(desktop,'out/main/index.js'))),scope:'Formal Electron UI -> typed IPC -> real folder/archive/parsers/SQLite, synthetic mixed three-level folder with intentionally corrupt PDF, no AI or natural quality/large-scale acceptance'};
let app,page,batchId,modelRequests=0;
function sql(q,p=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}}
async function until(fn,timeout=180000){const end=Date.now()+timeout;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,150));}throw Error('Folder issue journey timeout');}
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
 for(const k of Object.keys(env))if(['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'].includes(k))delete env[k];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net})=>{globalThis.folderIssueModelRequests=0;for(const owner of [globalThis,net]){const ordinary=owner.fetch.bind(owner);owner.fetch=async(url,options)=>{const address=new URL(typeof url==='string'?url:url.url||url.href);if(address.hostname==='api.deepseek.com'){globalThis.folderIssueModelRequests++;throw Error('Cloud request not authorized by this local-only fixture');}return ordinary(url,options);};}});
 page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.locator('[data-testid="nav-knowledge"]:visible').click();await page.getByTestId('materials-import-folder').waitFor();
}
const batch=()=>page.getByTestId('material-batch-'+batchId);
async function openFiles(){await openMaterialDisclosure(page.getByTestId('materials-batches'));await batch().getByTestId('batch-files-'+batchId).click();await batch().getByTestId('batch-file-list').waitFor();}
function taskRows(){return sql("SELECT t.id,t.status,t.retry_count,t.payload_json FROM ai_tasks t WHERE t.task_type='resource_parse' ORDER BY t.id");}
const note=name=>{report.checks.push(name);console.log('PASS '+name);};
try{
 await launch();if(!resume){await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await page.getByTestId('materials-import-folder').click();}
 batchId=await until(async()=>{const p=await page.evaluate(()=>window.omniEdu.listMaterialBatches({schemaVersion:'xiaozhi.material-import-batch.v1',offset:0}));return p.batches[0]?.id;});report.batchId=batchId;
 const summary=await until(async()=>{const p=await page.evaluate(()=>window.omniEdu.listMaterialBatches({schemaVersion:'xiaozhi.material-import-batch.v1',offset:0}));const b=p.batches.find(b=>b.id===batchId);return b?.archived===4&&b.readable===3&&b.parseFailed===1&&b.waiting===0?b:undefined;});assert.equal(summary.skipped,1);report.summary=summary;
 await openFiles();const bad=batch().getByTestId('batch-file').filter({hasText:'损坏.pdf'});await bad.getByText('已归档 · 正文解析未完成',{exact:true}).waitFor();assert.equal(await batch().getByTestId('batch-file').count(),5);note('One real nested mixed-folder import archives four originals; three actual parsers produce readable text and corrupt PDF is isolated');
 await batch().getByTestId('batch-files-issues').click();await until(async()=>await batch().getByTestId('batch-file').count()===1);await bad.getByTestId('batch-file-retry').waitFor();assert.match(await batch().getByTestId('batch-file-list').innerText(),/共 1 个待处理项/);await page.screenshot({path:path.join(output,'issues-1366.png'),fullPage:true});note('Existing file detail filters the parse failure with truthful count, local retry and source entry at 1366x768');
 const files=sql('SELECT r.id,r.local_path,r.content_hash,r.parse_status FROM teacher_resources r ORDER BY r.id'),before=taskRows();for(const f of files)assert.equal(sha(fs.readFileSync(f.local_path)),f.content_hash);
 const corrupt=files.find(f=>f.parse_status==='failed'),badTask=before.find(t=>JSON.parse(t.payload_json).resourceId===corrupt.id);assert(badTask);
 const moved=folder+'-offline';fs.renameSync(folder,moved);await bad.getByTestId('batch-file-retry').click();await until(()=>{const t=taskRows().find(t=>t.id===badTask.id);return t?.retry_count>badTask.retry_count&&t.status==='failed';});
 const after=taskRows();assert.deepEqual(after.filter(t=>t.id!==badTask.id),before.filter(t=>t.id!==badTask.id));for(const f of files)assert.equal(sha(fs.readFileSync(f.local_path)),f.content_hash);report.retry={before:badTask.retry_count,after:after.find(t=>t.id===badTask.id).retry_count,healthyUnchanged:true};note('Single local retry runs with external folder offline, preserves all healthy task rows and original hashes, and honestly retains the damaged PDF failure');
 modelRequests+=await app.evaluate(()=>globalThis.folderIssueModelRequests);await app.close();app=undefined;await launch();await page.setViewportSize({width:1920,height:1080});await openFiles();await batch().getByTestId('batch-files-issues').click();await until(async()=>await batch().getByTestId('batch-file').count()===1);await batch().getByTestId('batch-file').filter({hasText:'损坏.pdf'}).getByTestId('batch-file-retry').waitFor();assert.deepEqual(taskRows(),after);for(const f of files)assert.equal(sha(fs.readFileSync(f.local_path)),f.content_hash);await page.screenshot({path:path.join(output,'issues-cold-1920.png'),fullPage:true});modelRequests+=await app.evaluate(()=>globalThis.folderIssueModelRequests);assert.equal(modelRequests,0);assert.deepEqual(report.rendererErrors,[]);note('Cold restart preserves partial status without retry replay, with source hashes and healthy tasks unchanged at 1920x1080 and zero cloud calls');report.success=true;
}catch(error){report.success=false;report.error=error.stack||String(error);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}
finally{report.modelRequests=modelRequests;if(app)await app.close();fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify({output,reportFile,success:report.success,checks:report.checks.length,error:report.error}));}
