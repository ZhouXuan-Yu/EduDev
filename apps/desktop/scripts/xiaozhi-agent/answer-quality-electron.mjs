import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';import {fingerprint} from '../acceptance/evidence.mjs';
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop),build=fingerprint(path.dirname(path.dirname(main))).sha256;
fs.mkdirSync(path.join(desktop,'test-results'),{recursive:true});
const output=fs.mkdtempSync(path.join(desktop,'test-results/answer-quality-electron-')),runtime=fs.mkdtempSync(path.join(os.tmpdir(),'edu-answer-quality-ui-'));
const material=path.join(runtime,'合成折射教材.txt');fs.writeFileSync(material,'合成物理教材\n光从空气斜射入水时，折射角小于入射角；垂直入射时传播方向不变。\n这份资料仅用于本地验收，不包含学生信息。');
const attachment=path.join(runtime,'合成附件.txt');fs.writeFileSync(attachment,'附件第一行\n附件中的关键教学结论\n附件第三行');
const workspace=path.join(runtime,'教学工作文件');fs.mkdirSync(workspace);
const workFile=path.join(workspace,'合成折射教材.txt');fs.copyFileSync(material,workFile);
const pathsOnly=process.argv.includes('--paths-only');
const report={ok:false,pathsOnly,build,checks:[],errors:[],runs:[],runtime,boundary:'Actual visible Electron/Pi/typed preload/local import/SQLite/restart; controlled model catalogue and SSE transport, synthetic textbook. Timing measures local preparation under controlled transport, not real DeepSeek or natural answer quality.'};
let app,page,data,profile;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const until=async(fn,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,50));}throw Error('quality UI timeout');};
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const ready=()=>page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&input.checkVisibility()&&!input.disabled&&!document.querySelector('[data-testid="pi-workspace-loading"]')&&!document.querySelector('button[aria-label="停止本轮"]');},null,{timeout:90000});
async function launch(mode,existing=false){
  data=path.join(runtime,mode,'data');profile=path.join(runtime,mode,'profile');
  const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'synthetic-aq-key',DEEPSEEK_MODEL:'deepseek-flash',XIAOZHI_ANSWER_QUALITY:mode};
  for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
  app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net},mode)=>{
    const state=globalThis.aq={mode,scenario:'simple',step:0,requests:[],blocked:[],materialId:''};
    net.fetch=async(input,init)=>{
      const url=typeof input==='string'?input:input.url;
      if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
      if(!url.includes('/chat/completions')){state.blocked.push(url);throw Error('Unexpected external network');}
      const body=JSON.parse(init.body),index=state.step++;
      state.requests.push({scenario:state.scenario,index,maxTokens:body.max_tokens,effort:body.reasoning_effort,tools:body.tools?.length||0,systemChars:body.messages.filter(m=>m.role==='system').map(m=>m.content).join('').length,bytes:Buffer.byteLength(init.body)});
      if((state.scenario==='retry'||state.scenario==='stop')&&index===0)return new Response('',{status:503,headers:{'retry-after':state.scenario==='stop'?'5':'0.05'}});
      let content='合成验收：已收到。',call;
      if(state.scenario==='citation'){
        if(index===0)call={name:'office_list_materials',arguments:JSON.stringify({query:'合成折射',offset:0})};
        else if(index===1)call={name:'office_read_material',arguments:JSON.stringify({resourceId:state.materialId,offset:0})};
        else {const text=body.messages.filter(m=>m.role==='tool').map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)).join('\n');const id=text.match(/#(xz-cite-[a-f0-9]{16}-[1-9]\d*)/)?.[1];if(!id)throw Error('Real material read did not register citation');content=`光从空气斜射入水时，折射角小于入射角。[教材](#${id})\n垂直入射时方向不变。\n伪造引用测试：[不存在](#xz-cite-deadbeefdeadbeef-999)`;}
      }
      if(state.scenario==='local-file'||state.scenario==='attachment'){
        const texts=body.messages.filter(m=>m.role==='tool').map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content));
        if(index===0)call=state.scenario==='local-file'?{name:'office_read_text',arguments:JSON.stringify({path:'合成折射教材.txt'})}:{name:'office_list_attachments',arguments:'{}'};
        else if(state.scenario==='attachment'&&index===1){
          const latest=texts.at(-1),id=latest.match(/xiat_[a-f0-9-]{36}/)?.[0],revision=Number(latest.match(/"revision"\s*:\s*(\d+)/)?.[1]);
          if(!id||!Number.isSafeInteger(revision))throw Error('Actual attachment directory missing ID/revision');
          call={name:'office_read_attachment',arguments:JSON.stringify({id,revision,startLine:2,lineCount:1})};
        }else{
          const ids=[...texts.at(-1).matchAll(/#(xz-cite-[a-f0-9]{16}-[1-9]\d*)/g)],id=ids.at(-1)?.[1];
          if(!id)throw Error('Local read did not register citation');content='根据本轮实际读取的文字作答。[本地来源](#'+id+')';
        }
      }
      const chunk=(delta,reason=null)=>'data: '+JSON.stringify({id:'aq-controlled',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason:reason}]})+'\n\n';
      const encoder=new TextEncoder();return new Response(new ReadableStream({async start(c){try{
        c.enqueue(encoder.encode(chunk({role:'assistant',content:''})));
        // Match the reported burst before tools; all bytes are synthetic/local.
        if(index===0)for(let i=0;i<300;i++){init.signal?.throwIfAborted();c.enqueue(encoder.encode(chunk({reasoning_content:'核对授权资料条件。'})));if(i%10===0)await new Promise(r=>setTimeout(r,1));}
        if(call)c.enqueue(encoder.encode(chunk({tool_calls:[{index:0,id:state.callPrefix+'-'+index,type:'function',function:call}]})));
        else {for(const piece of content.match(/.{1,12}/gs)||[]){init.signal?.throwIfAborted();c.enqueue(encoder.encode(chunk({content:piece})));await new Promise(r=>setTimeout(r,4));}}
        c.enqueue(encoder.encode(chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n'));c.close();
      }catch(error){c.error(error);}}}),{headers:{'content-type':'text/event-stream'}});
    };
  },mode);
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await ready();await page.bringToFront();
  if(!existing){
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},material);
    await page.getByTestId('nav-knowledge').click();await page.getByTestId('materials-import').click();
    const resource=await until(async()=>{const rows=await page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'合成折射',offset:0}));return rows?.resources?.find(r=>r.chunkCount>0);});
    report.importedId=resource.id;await app.evaluate((_,id)=>{globalThis.aq.materialId=id;},resource.id);
    await page.locator('[data-testid="nav-ai-workspace"]:visible').click();await ready();
  }
}
async function close(){if(!app)return;const current=app;app=undefined;const child=current.process();await current.close();await until(()=>child.exitCode!==null,15000);assert.equal(child.exitCode,0);}
async function scenario(name){await app.evaluate((_,name)=>{globalThis.aq.scenario=name;globalThis.aq.step=0;globalThis.aq.callPrefix='aq-'+crypto.randomUUID();},name);}
async function send(text){await ready();const before=query('SELECT count(*) n FROM ai_agent_runs')[0].n;await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();return until(()=>{const rows=query('SELECT id,status,error_message FROM ai_agent_runs ORDER BY created_at DESC');return rows.length>before?rows[0].id:undefined;});}
async function complete(id){await until(()=>{const row=query('SELECT status,error_message FROM ai_agent_runs WHERE id=?',[id])[0];if(row?.status==='failed')throw Error('Actual run failed: '+row.error_message);return row?.status==='succeeded';});await ready();const message=query("SELECT metadata_json FROM ai_conversation_messages WHERE role='assistant' ORDER BY created_at DESC LIMIT 1")[0];if(message)report.runs.push({id,metadata:JSON.parse(message.metadata_json).answerQuality});}
try{
  for(const mode of pathsOnly?['optimized']:['legacy','optimized']){
    await launch(mode);
    if(!pathsOnly){for(let i=0;i<3;i++){await scenario('simple');await complete(await send('你好'));}
      report[mode]=await app.evaluate(()=>globalThis.aq.requests);check(`${mode}: three real UI turns complete with actual model payload and local audit`);}
    if(mode==='optimized'){
      await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},workspace);
      await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await ready();
      await until(()=>page.evaluate(async()=>{const id=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');return id&&(await window.omniEdu.getXiaozhiSnapshot(id)).workspace?.label==='教学工作文件';}));
      await scenario('citation');const id=await send('依据合成折射教材说明折射规律，逐条标注来源。');await complete(id);
      const turn=page.locator(`[data-turn-id="${id}"]`);await turn.getByTestId('answer-citation').click();
      assert.equal(await turn.getByTestId('reply-sources').locator('button[data-slot="chat-sources-trigger"]').getAttribute('aria-expanded'),'true');assert((await turn.innerText()).includes('引用未核验'));
      await turn.getByTestId('pi-material-source-open').click();await page.getByTestId('materials-detail').waitFor();
      assert((await page.getByTestId('materials-detail').innerText()).includes('折射'));await page.locator('[data-testid="nav-ai-workspace"]:visible').click();await ready();
      const saved=query("SELECT metadata_json FROM ai_conversation_messages WHERE role='assistant' ORDER BY created_at DESC LIMIT 1")[0];
      assert(saved.metadata_json.includes('citationId'));assert(saved.metadata_json.includes('resource_'));check('Actual local material tool registers a located citation; UI reveals source and rejects forged reference');
      for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.screenshot({path:path.join(output,`citations-${width}.png`)});}
      await scenario('local-file');const fileRun=await send('读取工作目录的合成折射教材.txt并引用。');await complete(fileRun);
      const fileTurn=page.locator('[data-turn-id="'+fileRun+'"]');await fileTurn.getByTestId('answer-citation').click();await fileTurn.getByTestId('pi-local-source-open').click();
      await page.getByTestId('pi-local-source-text').waitFor();assert((await page.getByTestId('pi-local-source-text').innerText()).includes('折射角小于入射角'));
      await page.getByTestId('pi-local-source-preview').getByRole('button',{name:'关闭',exact:true}).click();
      fs.appendFileSync(workFile,'\n来源已变化。');
      await fileTurn.getByTestId('pi-local-source-open').click();await page.getByTestId('pi-local-source-preview').getByRole('alert').waitFor();
      assert((await page.getByTestId('pi-local-source-preview').innerText()).includes('变化'));await page.getByTestId('pi-local-source-preview').getByRole('button',{name:'关闭',exact:true}).click();
      check('Workspace text citation opens actual version and rejects changed source');
      await page.locator('[data-testid="office-composer"] input[type=file]').setInputFiles([attachment]);
      await page.getByTestId('pi-attachments').getByRole('button',{name:'预览附件 合成附件.txt',exact:true}).waitFor();
      await scenario('attachment');const attachmentRun=await send('读取刚添加附件第2行并引用。');await complete(attachmentRun);
      const attachmentTurn=page.locator('[data-turn-id="'+attachmentRun+'"]');await attachmentTurn.getByTestId('answer-citation').click();await attachmentTurn.getByTestId('pi-local-source-open').click();
      await page.getByTestId('pi-local-source-text').waitFor();assert.equal(await page.getByTestId('pi-local-source-text').innerText(),'附件中的关键教学结论');
      await page.getByTestId('pi-local-source-preview').getByRole('button',{name:'关闭',exact:true}).click();check('Submitted attachment citation opens only the located extracted line');
      // Close any source side panel by returning to the current conversation if needed.
      await scenario('retry');const retry=await send('简短回答：临时错误恢复。');await complete(retry);assert.equal(await app.evaluate(()=>globalThis.aq.requests.filter(r=>r.scenario==='retry').length),2);check('503 retries once within the same real Pi turn and completes without duplicated tools');
      await scenario('stop');const stopped=await send('简短回答：停止等待恢复。');await until(()=>app.evaluate(()=>globalThis.aq.requests.some(r=>r.scenario==='stop')));await page.getByRole('button',{name:'停止本轮',exact:true}).click();
      await until(()=>query('SELECT status FROM xiaozhi_event_runs WHERE run_id=?',[stopped])[0]?.status==='interrupted');await new Promise(r=>setTimeout(r,5500));assert.equal(await app.evaluate(()=>globalThis.aq.requests.filter(r=>r.scenario==='stop').length),1);check('Stop cancels backoff and commits interrupted with no later transport');
      const count=query('SELECT count(*) n FROM ai_agent_runs')[0].n;await close();await launch(mode,true);assert.equal(query('SELECT count(*) n FROM ai_agent_runs')[0].n,count);assert.equal(await app.evaluate(()=>globalThis.aq.requests.length),0);assert(await page.getByTestId('answer-citation').count()>0);check('Cold restart restores cited answer and interrupted run without a model replay');
    }
    await close();
  }
  assert.deepEqual(report.errors,[]);assert.equal(fingerprint(path.dirname(path.dirname(main))).sha256,build);report.ok=true;
}catch(error){report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await close().catch(e=>{report.closeError=String(e);process.exitCode=1;});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
