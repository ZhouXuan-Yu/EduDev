import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'),prior=process.argv.includes('--resume')?process.argv[process.argv.indexOf('--resume')+1]:undefined;
if(prior){assert.equal(path.dirname(path.resolve(prior)).toLowerCase(),os.tmpdir().toLowerCase());assert(path.basename(prior).startsWith('xiaozhi-office-source-'));}
const root=prior||fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-office-source-')),workspace=path.join(root,'workspace'),data=path.join(root,'data'),profile=path.join(root,'profile');
const files=['备课.docx','教研.xlsx','课件.pptx','讲义.pdf'],name='四种文档课堂摘要.html';
if(!prior){
 const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 const made=spawnSync(python,[path.join(desktop,'scripts/xiaozhi-agent/make-office-fixtures.py'),workspace,'OFFICE-SOURCE-'+randomUUID()],{encoding:'utf8',windowsHide:true});assert.equal(made.status,0,made.stderr);
}
const hash=b=>createHash('sha256').update(b).digest('hex'),report={ok:false,root,checks:[],errors:[],boundary:'Original Pi/composer -> actual four-format Hana utility extraction -> original HTML review/save -> answer/artifact/history/catalog source controls -> changed/missing -> cold. Synthetic SSE only,0 paid; extracted lines are not physical pages or full FX05/REVIEW acceptance.'};
const dbQuery=(q,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...args);}finally{db.close();}};
const until=async(fn,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,60));}throw Error('Office source condition timed out');};
const check=s=>{report.checks.push(s);console.log('PASS '+s);};let app,page,sessionId,saved;
async function boot(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},files)=>{
  const state=globalThis.officeSourceTest={requests:[],receipts:[],stage:0};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions'))throw Error('External network disabled');
   const body=JSON.parse(init.body),n=state.stage++;state.requests.push({n,tools:body.tools.map(t=>t.function.name)});let call;
    if(state.citationOnly&&n===0)call={name:'office_read_document',arguments:JSON.stringify({path:files[0],startLine:2,lineCount:2})};
    else if(state.citationOnly){}
    else if(n<files.length)call={name:'office_read_document',arguments:JSON.stringify({path:files[n],startLine:2,lineCount:2})};
   else if(n===4){
    for(const message of body.messages.filter(m=>m.role==='tool')){const text=typeof message.content==='string'?message.content:message.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');try{state.receipts.push(JSON.parse(text.split('\n本轮实际读取的引用登记')[0]));}catch{}}
    const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),line=system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"')),task=line?JSON.parse(line):{requirementsVersion:1,revision:0};
    call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,expectedRevision:task.revision,reason:'根据四种实际读取文档保存课堂摘要',steps:[{id:'save',text:'保存课堂摘要',dependsOn:[],reported:'pending',kind:'saved_text',target:'四种文档课堂摘要.html'},{id:'review',text:'教师核对课堂摘要',dependsOn:['save'],reported:'pending',kind:'human'}]})};
   }else if(n===5)call={name:'office_create_text',arguments:JSON.stringify({path:'四种文档课堂摘要.html',content:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>课堂摘要</title><h1>合成课堂摘要</h1><p>教师根据四份实际读取文档核对。</p></html>',taskStepId:'save'})};
    const latestCitations=JSON.stringify(body.messages.filter(message=>message.role==='tool').at(-1)||{}).match(/xz-cite-[a-f0-9]{16}-[1-9]\d{0,2}/g)||[];
    if(latestCitations.length)state.citations=latestCitations;const citations=state.citations||[];
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'office-source',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
    const encoder=new TextEncoder();return new Response(new ReadableStream({async start(controller){
      controller.enqueue(encoder.encode(chunk({role:'assistant',content:''})));
      if(call)controller.enqueue(encoder.encode(chunk({tool_calls:[{index:0,id:(state.citationOnly?'citation-':'office-source-')+n,type:'function',function:call}]})));
      else {const content='<xiaozhi_answer>'+(citations.length?'请核对[实际文档来源](#'+citations.at(-1)+')。':'来源尚未登记。');for(const piece of content.match(/.{1,12}/gs)||[]){controller.enqueue(encoder.encode(chunk({content:piece})));await new Promise(resolve=>setTimeout(resolve,4));}}
      controller.enqueue(encoder.encode(chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n'));controller.close();
    }}),{headers:{'content-type':'text/event-stream'}});
  };
 },files);
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
const control=scope=>scope.locator(`[data-testid="artifact-sources"][data-artifact-id="${saved.id}"]`).first();
async function expand(c){if(await c.getByTestId('artifact-sources-toggle').getAttribute('aria-expanded')!=='true')await c.getByTestId('artifact-sources-toggle').click();await c.getByTestId('artifact-sources-body').waitFor();await until(async()=>!await c.getByTestId('artifact-sources-refresh').isDisabled());}
async function openLine(c,index){
 const link=c.getByTestId('pi-local-source-open').nth(index);await link.click();const dialog=page.getByTestId('pi-local-source-preview');await dialog.getByTestId('pi-local-source-text').waitFor();
 const actual=await dialog.getByTestId('pi-local-source-text').textContent();assert(actual.length>0);assert((await dialog.innerText()).includes('提取文字第2–3行'));
 const file=files[index],workspaceState=(await snapshot()).workspace;
 const listing=await page.evaluate(({sessionId})=>window.omniEdu.listXiaozhiFiles({schemaVersion:'xiaozhi.files.v1',sessionId,requestId:'xifile_'+crypto.randomUUID(),path:'.'}),{sessionId});assert(listing.ok);
 const entry=listing.data.entries.find(x=>x.path===file);assert(entry);
 const preview=await page.evaluate(({sessionId,file,version,workspaceVersion})=>window.omniEdu.previewXiaozhiFile({schemaVersion:'xiaozhi.files.v1',sessionId,requestId:'xifile_'+crypto.randomUUID(),path:file,version,workspaceVersion}),{sessionId,file,version:entry.version,workspaceVersion:listing.workspaceVersion});assert(preview.ok);
 assert.equal(actual,preview.data.text.split('\n').slice(1,3).join('\n'));
 await dialog.getByRole('button',{name:'关闭',exact:true}).click();return {path:file,text:actual,version:entry.version,workspace:!!workspaceState};
}
async function artifactView(){await productEntry(page,'teaching').click();await page.getByTestId('artifacts-search').fill('四种文档课堂摘要');await page.getByTestId('artifact-'+saved.id).getByRole('button').click();const c=control(page.getByTestId('artifacts-detail'));await expand(c);return c;}
try{
 await boot();
  if(prior&&process.argv.includes('--finalize')){
    Object.assign(report,JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8')));assert.equal(report.checks.length,6);assert.deepEqual(report.errors,[]);
    const snap=await snapshot();saved=snap.changes.find(c=>c.id===report.saved.id&&c.state==='applied');assert(saved);
    const sources=await page.evaluate(({sessionId,artifactId})=>window.omniEdu.artifactSources({schemaVersion:'xiaozhi.artifact-sources.v1',sessionId,artifactId}),{sessionId,artifactId:saved.id});assert(sources.ok);assert.deepEqual(sources.value,report.sources);
    assert.equal(hash(fs.readFileSync(path.join(workspace,name))),report.outputSha256);assert.equal(await app.evaluate(()=>globalThis.officeSourceTest.requests.length),0);
    report.inspections=dbQuery('SELECT COUNT(*) AS count FROM xiaozhi_delivery_inspections');report.finalization='Only corrected optional inspection count query; original six completed UI checks retained, same associations/bytes cold-read with zero model calls';delete report.error;delete report.wire;report.ok=true;
  }else{
 if(!prior){
  await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},workspace);
  await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snapshot()).workspace));
  await page.getByTestId('office-prompt-input').fill('实际读取备课.docx、教研.xlsx、课件.pptx、讲义.pdf各提取正文第2–3行，据此保存四种文档课堂摘要.html。使用真实来源，给我确认保存。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const card=page.getByTestId('pi-text-change').filter({has:page.locator('[title="'+name+'"]')}).last();await card.getByTestId('pi-text-approve').waitFor({timeout:90000});await card.getByTestId('pi-text-approve').click();await until(async()=>{const s=await snapshot();if(!s.running&&s.projection.turns.at(-1)?.status==='failed')throw Error(s.projection.turns.at(-1).error);return !s.running&&!await page.getByTestId('office-prompt-input').isDisabled();});
 }
 const snap=await snapshot();saved=snap.changes.find(c=>c.path===name&&c.state==='applied');assert(saved);report.saved=saved;
 const sourceReply=await page.evaluate(({sessionId,artifactId})=>window.omniEdu.artifactSources({schemaVersion:'xiaozhi.artifact-sources.v1',sessionId,artifactId}),{sessionId,artifactId:saved.id});assert(sourceReply.ok);report.sources=sourceReply.value;assert.equal(sourceReply.value.items.length,4);
 for(const [index,item]of sourceReply.value.items.entries()){const local=item.source.local;assert.equal(local.path,files[index]);assert.equal(local.locator,'extracted_lines');assert.equal(local.startLine,2);assert.equal(local.endLine,3);assert(/^[a-f0-9]{64}$/.test(local.version));}
 check('Original Pi reads all four actual Office/PDF formats and saves through original approval; artifact source projection retains exact file/version/line locators');
  const card=page.locator(`[data-testid="pi-text-change"][data-change-id="${saved.id}"]`),c=control(card);await expand(c);const previous=prior?JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8')):undefined;report.located=previous?.located||[];
  if(report.located.length!==4){report.located=[];for(let i=0;i<4;i++)report.located.push(await openLine(c,i));}else report.resumedAfter='Four actual line dialogs passed; resume citation/history/catalog/failure/cold only';
  if(!await page.getByTestId('answer-citation').count()){
    assert(prior,'Fresh realistic SSE must publish final citation');await app.evaluate(()=>{globalThis.officeSourceTest.citationOnly=true;globalThis.officeSourceTest.stage=0;});
    await page.getByTestId('office-prompt-input').fill('仅核对备课.docx提取正文第2–3行，并给出本次来源链接。不要生成文件。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await page.getByTestId('answer-citation').last().waitFor({timeout:60000});await until(async()=>!((await snapshot()).running));
  }
 assert(await page.getByTestId('answer-citation').count()>0);await page.getByTestId('answer-citation').last().click();check('Original reply citation is registered and all four source controls display exactly the raw extraction lines2–3, without calling them physical pages');
 await card.getByTestId('office-versions-toggle').click();const historical=control(card.getByTestId('pi-office-versions'));await expand(historical);assert.equal(await historical.getByTestId('pi-local-source-open').count(),4);check('Selected original artifact history uses the same four bound source locations');
 const requests=await app.evaluate(()=>globalThis.officeSourceTest.requests.length),target=path.join(workspace,name);report.outputSha256=hash(fs.readFileSync(target));let current=await artifactView();assert.equal(await current.getByTestId('pi-local-source-open').count(),4);
 report.viewports=[];for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},v)=>BrowserWindow.getAllWindows()[0].setContentSize(v.width,v.height),{width,height});await page.waitForFunction(v=>innerWidth===v.width&&innerHeight===v.height,{width,height});await current.getByTestId('pi-local-source-open').nth(2).click();await page.getByTestId('pi-local-source-text').waitFor();const b=await page.getByTestId('pi-local-source-preview').boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1);report.viewports.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})));await page.screenshot({path:path.join(root,width+'.png')});await page.getByTestId('pi-local-source-preview').getByRole('button',{name:'关闭',exact:true}).click();}
 check('Teaching Files source controls and actual line modal remain reachable at both native viewport sizes');
 await app.close();app=undefined;await boot();current=await artifactView();await openLine(current,2);assert.equal(await app.evaluate(()=>globalThis.officeSourceTest.requests.length),0);assert.equal(hash(fs.readFileSync(target)),report.outputSha256);check('Cold original application reopens actual Office lines from the saved artifact with zero model/publication replay');
 const changed=path.join(workspace,files[0]);fs.appendFileSync(changed,'changed synthetic bytes');await current.getByTestId('pi-local-source-open').nth(0).click();let dialog=page.getByTestId('pi-local-source-preview');await dialog.getByRole('alert').waitFor();assert((await dialog.innerText()).includes('变化'));assert.equal(await dialog.getByTestId('pi-local-source-text').count(),0);await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 const missing=path.join(workspace,files[1]);fs.renameSync(missing,missing+'.test-moved');await current.getByTestId('pi-local-source-open').nth(1).click();dialog=page.getByTestId('pi-local-source-preview');await dialog.getByRole('alert').waitFor();assert((await dialog.innerText()).includes('不存在'));assert.equal(await dialog.getByTestId('pi-local-source-text').count(),0);await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 assert.equal(await current.getByTestId('pi-local-source-open').count(),4);assert.equal(await app.evaluate(()=>globalThis.officeSourceTest.requests.length),0);assert.equal(hash(fs.readFileSync(target)),report.outputSha256);check('Changed and moved Office sources retain original associations, show explicit failures and never open replacement bytes or regenerate output');
  assert.deepEqual(report.errors,[]);report.currentBootRequests=requests;report.inspections=dbQuery('SELECT COUNT(*) AS count FROM xiaozhi_delivery_inspections');report.ok=true;
  }
}catch(e){report.error=String(e.stack);report.wire=await app?.evaluate(()=>globalThis.officeSourceTest).catch(()=>null);await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));}
