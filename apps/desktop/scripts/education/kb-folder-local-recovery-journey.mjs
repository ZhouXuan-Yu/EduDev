import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {Document,Paragraph,Packer} from 'docx';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
const desktop=process.cwd(),output=fs.mkdtempSync(path.join(os.tmpdir(),'kb-folder-local-recovery-')),folder=path.join(output,'教师资料'),nested=path.join(folder,'数学','初二','算术'),data=path.join(output,'data'),profile=path.join(output,'profile'),ledger=path.join(output,'calls.json');
fs.mkdirSync(nested,{recursive:true});
const metadata=['学科：数学','年级：初二','知识点：算术','题型：解答题','难度：中等'];
fs.writeFileSync(path.join(folder,'健康题.md'),[...metadata,'第1题 计算 12 - 5。','【答案】7','【解析】12减5等于7。'].join('\n'));
const word=[...metadata,...[['6 + 4','10','6与4相加得到10。'],['7 + 8','15','7与8相加得到15。'],['16 - 9','7','16减9等于7。']].flatMap(([sum,answer,analysis],i)=>[`第${i+1}题 计算 ${sum}。`,`【答案】${answer}`,`【解析】${analysis}`])];
fs.writeFileSync(path.join(nested,'三道题.docx'),await Packer.toBuffer(new Document({sections:[{children:word.map(t=>new Paragraph(t))}]})));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={output,checks:[],rendererErrors:[],buildMainSha:sha(fs.readFileSync(path.join(desktop,'out/main/index.js'))),scope:'Formal directory UI, real local parsers/typed IPC/SQLite and generated Word source proofs. One controlled Word utility launch failure and controlled DeepSeek responses; not real model quality, billing, 40GiB or installer acceptance'};
let app,page,batchId;
const sql=(q,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}};
async function until(fn,timeout=180000){const end=Date.now()+timeout;while(Date.now()<end){const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,150));}throw Error('Local recovery journey timeout');}
async function launch(blockWord){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
 for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[key];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net,utilityProcess},{ledger,blockWord})=>{
  const fs=process.getBuiltinModule('fs');globalThis.localRecoveryProbe={blockWord,failedStarts:0};
  const fork=utilityProcess.fork.bind(utilityProcess);utilityProcess.fork=(entry,...args)=>{if(globalThis.localRecoveryProbe.blockWord&&String(entry).endsWith('word-worker.js')){globalThis.localRecoveryProbe.failedStarts++;throw Error('controlled local utility unavailable');}return fork(entry,...args);};
  for(const owner of [globalThis,net]){const ordinary=owner.fetch.bind(owner);owner.fetch=async(url,options)=>{
   const address=new URL(typeof url==='string'?url:url.url||url.href);if(address.origin!=='https://api.deepseek.com')return ordinary(url,options);
   if(address.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:65536,input_modalities:['text','image']}]}),{status:200,headers:{'content-type':'application/json'}});
   if(!/chat\/completions/.test(address.pathname))throw Error('Unexpected controlled provider route');
   const body=JSON.parse(options.body),context=JSON.parse(body.messages[1].content[0].text),native=body.messages[0].content.includes('xiaozhi.material-ai-native-response.v1');
   const material=native?JSON.parse(context.material):undefined,stem=material?.roles.question||'计算 12 - 5。',answer=material?.roles.answer||'7',analysis=material?.roles.analysis||'12减5等于7。';
   const rows=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];rows.push({number:rows.length+1,native,sourceNumber:material?.number,final:!!context.firstDraft,images:body.messages[1].content.filter(c=>c.type==='image_url').length});fs.writeFileSync(ledger,JSON.stringify(rows));
   const projection=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'?'provided':'not_applicable',text:k==='statement'?stem:''}]));
   const question={number:material?.number||'1',stem,answer,analysis,subject:'数学',grade:'初二',knowledgePoint:'算术',questionType:'解答题',difficulty:'medium',answerOrigin:native?'source':'ai_generated',analysisOrigin:native?'source':'ai_generated',requiresImage:false,issues:[],...(native?{projection}:{})};
   const raw=JSON.stringify({schemaVersion:native?'xiaozhi.material-ai-native-response.v1':'xiaozhi.material-ai-response.v1',outcome:'questions',questions:[question]});
   return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:raw}}]}),{status:200,headers:{'content-type':'application/json'}});
  };}
 },{ledger,blockWord});
 page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.locator('[data-testid="nav-knowledge"]:visible').click();await page.getByTestId('materials-import-folder').waitFor();
}
const panel=()=>page.getByTestId('folder-ai-'+batchId),batch=()=>page.getByTestId('material-batch-'+batchId);
const view=()=>page.evaluate(id=>window.omniEdu.getMaterialFolderAi({schemaVersion:'xiaozhi.material-folder-ai.v1',batchId:id}),batchId);
const note=name=>{report.checks.push(name);console.log('PASS '+name);};
try{
 await launch(true);const configured=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings().then(s=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:s.value.version,defaultModel:'deepseek-flash',apiKey:'synthetic-local-recovery-never-network'})));assert(configured.ok);
 await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await page.getByTestId('materials-import-folder').click();
 batchId=await until(()=>sql('SELECT id FROM material_import_batches WHERE root_path=?',[folder])[0]?.id);report.batchId=batchId;
 await openMaterialDisclosure(page.getByTestId('materials-batches'));await openMaterialDisclosure(panel());await panel().getByTestId('folder-ai-open-authorization').click();await panel().getByTestId('folder-ai-budget').fill('8');await panel().getByTestId('folder-ai-public').check();await panel().getByTestId('folder-ai-consent').check();await until(async()=>!await panel().getByTestId('folder-ai-authorize').isDisabled());await panel().getByTestId('folder-ai-authorize').click();
 const held=await until(async()=>{const v=await view();return v?.status==='attention'&&v.readyQuestions===1?v:undefined;});assert.equal(held.calls,2);assert.equal(held.review,1);assert.equal(held.issues[0].error,'local_parse_failed');assert.equal(await app.evaluate(()=>globalThis.localRecoveryProbe.failedStarts),1);report.before=held;
 const resources=sql('SELECT id,local_path,content_hash,original_file_name FROM teacher_resources ORDER BY id');for(const r of resources)assert.equal(sha(fs.readFileSync(r.local_path)),r.content_hash);
 const healthy=resources.find(r=>r.original_file_name.endsWith('.md')),healthyTask=sql("SELECT * FROM ai_tasks WHERE task_type='resource_parse' AND json_extract(payload_json,'$.resourceId')=?",[healthy.id]);
 await batch().getByTestId('batch-files-'+batchId).click();await batch().getByTestId('batch-files-issues').click();const bad=batch().getByTestId('batch-file').filter({hasText:'三道题.docx'});await bad.getByTestId('batch-file-retry').waitFor();await page.screenshot({path:path.join(output,'local-failure-1366.png'),fullPage:true});note('One folder authorization processes the healthy file while a real Word utility launch failure remains unbilled and visible for local retry');
 await app.evaluate(()=>{globalThis.localRecoveryProbe.blockWord=false;});await bad.getByTestId('batch-file-retry').click();
 const done=await until(async()=>{const v=await view();return v?.status==='complete'&&v.readyQuestions===4?v:undefined;});assert.equal(done.calls,8);assert.equal(done.reserved,8);assert.equal(done.units,4);assert.equal(done.review+done.failed+done.waiting,0);report.after=done;
 const plans=sql('SELECT resource_id,total,cursor FROM material_folder_ai_resources WHERE batch_id=?',[batchId]);assert.equal(plans.find(p=>p.resource_id!==healthy.id).total,3);assert.equal(sql('SELECT COUNT(*) n FROM material_ai_task_keys WHERE folder_id=?',[batchId])[0].n,4);assert.deepEqual(sql("SELECT * FROM ai_tasks WHERE task_type='resource_parse' AND json_extract(payload_json,'$.resourceId')=?",[healthy.id]),healthyTask);for(const r of resources)assert.equal(sha(fs.readFileSync(r.local_path)),r.content_hash);note('The existing local retry automatically resumes the original folder grant, recomputes three Word questions, and completes all four drafts with exactly eight controlled calls');
 await page.getByTestId('nav-teaching').filter({visible:true}).click();await page.getByTestId('hub-entry-question_notebook').click();await page.getByTestId('question-notebook-search').waitFor();const bank=await page.evaluate(()=>window.omniEdu.listQuestionNotebook({limit:20}));assert.equal(bank.total,4);const native=bank.items.filter(q=>q.archive?.native);assert.equal(native.length,3);assert.deepEqual(native.map(q=>q.answer).sort(),['10','15','7']);report.questionIds=bank.items.map(q=>q.id);
 const card=page.getByTestId('question-notebook-card-'+native[0].id);await card.getByTestId('native-picture-open').click();await until(async()=>await card.getByTestId('native-picture-image').evaluateAll(nodes=>nodes.some(n=>n.complete&&n.naturalWidth>0))||await card.getByTestId('native-picture-no-source').count()>0);await page.screenshot({path:path.join(output,'recovered-bank-1366.png'),fullPage:true});note('All recovered drafts are available from the real question notebook with retained Word role sources and correct controlled answers');
 const ledgerBefore=fs.readFileSync(ledger,'utf8'),factsBefore=sql('SELECT id,stem,answer,analysis,document_json,archive_json FROM question_bank_items ORDER BY id');await app.close();app=undefined;await launch(false);await page.setViewportSize({width:1920,height:1080});assert.equal((await view()).status,'complete');assert.deepEqual(sql('SELECT id,stem,answer,analysis,document_json,archive_json FROM question_bank_items ORDER BY id'),factsBefore);await new Promise(r=>setTimeout(r,2600));assert.equal(fs.readFileSync(ledger,'utf8'),ledgerBefore);assert.equal((await page.evaluate(()=>window.omniEdu.listQuestionNotebook({limit:20}))).total,4);for(const r of resources)assert.equal(sha(fs.readFileSync(r.local_path)),r.content_hash);await openMaterialDisclosure(page.getByTestId('materials-batches'));await openMaterialDisclosure(panel());await page.screenshot({path:path.join(output,'recovered-cold-1920.png'),fullPage:true});assert.deepEqual(report.rendererErrors,[]);note('Cold restart preserves drafts, source hashes and billing records without another request or local retry replay');report.success=true;
}catch(error){report.success=false;report.error=error.stack||String(error);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}
finally{if(app)await app.close();report.requests=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,requests:report.requests.length,error:report.error}));}
