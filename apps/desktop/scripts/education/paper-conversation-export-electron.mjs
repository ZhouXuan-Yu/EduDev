import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT, fixture=process.env.OMNI_EDU_PAPER_READ_FIXTURE;
assert(acceptance&&fixture);
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json')));
assert(baseline.ok&&baseline.sessionId&&baseline.editedId&&!fs.existsSync(path.join(fixture,'data','app.db-wal')));
const output=fs.mkdtempSync(path.join(acceptance,'paper-conversation-export-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),destination=path.join(output,'新导出目录');
fs.cpSync(path.join(fixture,'data'),data,{recursive:true});
fs.mkdirSync(destination);
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const sessionId=baseline.sessionId;
const report={ok:false,output,main,sha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],paidRequests:0,files:[]};
const check=(name,details)=>{report.checks.push({name,...details});console.log('PASS '+name);};
const query=(sql,args=[])=>{
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 try{return db.prepare(sql).all(...args);}finally{db.close();}
};
const paperFacts=()=>query("SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type='pi_paper_candidate' ORDER BY confirmed_at,id",[sessionId]);
const existing=paperFacts(),edited=existing.find(row=>row.id===baseline.editedId),other=existing.at(-1);
assert(edited&&other&&other.status==='confirmed'&&other.id!==edited.id&&other.confirmed_at>=edited.confirmed_at);
const paper={paperId:edited.id,digest:JSON.parse(edited.result_json).digest,title:edited.title};
const errors=[];
let app,page;

async function until(read,timeout=90000){
 const end=Date.now()+timeout;
 while(Date.now()<end){const value=await read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,150));}
 throw Error('Conversation export timed out');
}

async function launch(cold=false){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
  OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-paper-conversation-export',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
 await app.evaluate(({net,dialog},{destination,paper,cold})=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[destination]});
  globalThis.conversationExport={requests:[]};
  net.fetch=async(raw,init)=>{
   const url=new URL(typeof raw==='string'?raw:raw.url);
   if(url.origin!=='https://api.deepseek.com')throw Error('External request blocked');
   if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{
    id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],
    effort:{supported_levels:['low','high','max'],default_level:'high'},
   }]}),{headers:{'content-type':'application/json'}});
   if(cold||url.pathname!=='/v1/chat/completions')throw Error('Unexpected model dispatch');
   const state=globalThis.conversationExport,phase=state.requests.length,body=JSON.parse(init.body);
   const lastTool=()=>{
    const entry=body.messages.filter(message=>message.role==='tool').at(-1);
    const content=typeof entry?.content==='string'?entry.content:entry?.content?.map(part=>part.text||'').join('\n');
    return JSON.parse(content.split('\n')[0]);
   };
   const find=name=>({name:'find_education_tools',args:{query:name}});
   const plan=()=>{
    const system=body.messages.filter(message=>message.role==='system').map(message=>message.content).join('\n');
    const line=system.split('\n').findLast(value=>value.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
    const task=line?JSON.parse(line):{requirementsVersion:1,revision:0};
    return {name:'update_task_plan',args:{schemaVersion:'xiaozhi.task-plan.v3',
     requirementsVersion:task.requirementsVersion,expectedRevision:task.revision,reason:'导出教师在对话中指定的确认卷',
     steps:[{id:'save',text:'导出教师要求的试卷',dependsOn:[],reported:'pending',kind:'saved_office',target:state.file},
      {id:'review',text:'请教师核对文件',dependsOn:['save'],reported:'pending',kind:'human'}]}};
   };
   const action=()=>({name:'education_export_paper',args:{taskStepId:'save',format:'docx',audience:state.audience,path:state.file,
    ...(state.reference||{})}});
   let offer;
   if(state.ambiguous){
    if(phase===0)offer=find('education_export_paper 导出确认卷');
    if(phase===1)offer=plan();
    if(phase===2)offer=action();
    if(phase===3){state.outcome=lastTool();if(state.outcome.error!=='ambiguous_paper')throw Error('Ambiguous export did not stop');}
    if(phase>3)throw Error('Unexpected extra request after ambiguity');
   }else{
    if(phase===0)offer=find('education_read_paper 按完整卷名读取确认卷');
    if(phase===1)offer={name:'education_read_paper',args:{title:paper.title}};
    if(phase===2){
     const read=lastTool();
     if(read.paperId!==paper.paperId||read.digest!==paper.digest||read.totalPoints!==7)throw Error('Pi read wrong paper');
     state.reference={paperId:read.paperId,digest:read.digest};
     offer=find('education_export_paper 试卷Word导出');
    }
    if(phase===3)offer=plan();
    if(phase===4)offer=action();
    if(phase>5)throw Error('Unexpected extra request after Office approval');
   }
   if(offer&&!body.tools?.some(tool=>tool.function.name===offer.name))throw Error('Missing tool '+offer.name);
   state.requests.push(offer?.name||'answer');
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'conversation-paper-export',object:'chat.completion.chunk',created:0,
    model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant'})+chunk(offer?{tool_calls:[{index:0,id:'conversation-'+state.audience+'-'+phase,
    type:'function',function:{name:offer.name,arguments:JSON.stringify(offer.args)}}]}
    :{content:state.ambiguous?'本会话有两份确认卷。请告诉我要导出哪份。':'已保存本次指定试卷的 Word 文件。'})
    +chunk({},offer?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{destination,paper,cold});
 page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(String(error)));
 await page.getByTestId('office-prompt-input').waitFor();
 await assertIsolatedPiMain(app,main,profile);
 await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===sessionId&&
  !await page.getByTestId('pi-event-synchronization').isVisible());
}

const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function start(audience,file,ambiguous=false){
 await app.evaluate((_electron,value)=>{globalThis.conversationExport={...value,requests:[]};},{audience,file,ambiguous});
 const input=page.getByTestId('office-prompt-input'),before=(await snapshot()).projection.turns.at(-1)?.id;
 await input.fill(ambiguous
  ?'请把试卷导出为学生版 Word，文件名为“'+file+'”。'
  :'请将已确认的「'+paper.title+'」当前版导出为'+(audience==='teacher'?'教师答案版':'学生版')+' Word，文件名为“'+file+'”。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 return ()=>until(async()=>{
  const state=await snapshot(),turn=state.projection.turns.at(-1);
  return !state.running&&turn?.id!==before&&turn?.status!=='running'&&turn;
 });
}

try{
 await launch();
 const card=page.locator('[data-testid="pi-paper-review"][data-current-paper-id="'+paper.paperId+'"]');
 const trigger=card.locator('[data-slot="chat-tool-trigger"]');
 await trigger.waitFor();
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 await card.getByTestId('pi-paper-preview').click();
 const preview=page.getByTestId('pi-paper-dialog');
 await preview.getByTestId('paper-output-choose').click();
 await until(async()=>(await preview.getByTestId('paper-output-label').innerText()).includes(path.basename(destination)));
 await preview.getByRole('button',{name:'关闭',exact:true}).click();
 for(const audience of ['teacher','student']){
  const name=audience==='teacher'?'对话导出教师答案.docx':'对话导出学生卷.docx',file=path.join(destination,name);
  const finish=await start(audience,name);
  const draft=await until(async()=>(await snapshot()).officeArtifacts?.find(item=>item.path===name&&item.state==='pending'));
  const saved=query('SELECT draft_json FROM xiaozhi_pi_office_drafts WHERE id=?',[draft.id])[0];
  const source=JSON.parse(saved.draft_json).paperSource;
  assert.deepEqual({paperId:source.paperId,digest:source.digest},await app.evaluate(()=>globalThis.conversationExport.reference));
  assert.equal(source.selection,'selected_version');
  assert.equal(source.audience,audience);
  const user=query("SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role='user' ORDER BY rowid DESC LIMIT 1",[sessionId])[0];
  assert.equal(JSON.parse(user.metadata_json).paperExportIntent,undefined);
  assert.equal(fs.existsSync(file),false);
  if(audience==='teacher')await page.screenshot({path:path.join(output,'before-approval.png'),animations:'disabled'});
  await page.locator('[data-testid="pi-office-artifact"][data-office-id="'+draft.id+'"]').getByTestId('pi-office-approve').click();
  assert.equal((await finish()).status,'completed');
  await until(()=>fs.existsSync(file));
  const xml=execFileSync('python',['-c',"import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))",file],{encoding:'utf8',windowsHide:true});
  assert.match(xml,/7 分/);
  assert.doesNotMatch(xml,/同会话无关卷/);
  assert.equal(xml.includes('两边减 7 后得到 3x = 18'),audience==='teacher');
  report.files.push({name,bytes:fs.statSync(file).size,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
  check('Typed conversation exports exact seven-point '+audience+' Word only after approval',{source});
 }
 const completed=await start('student','未指定试卷.docx',true);
 await completed();
 const outcome=await app.evaluate(()=>globalThis.conversationExport.outcome);
 assert.equal(outcome.error,'ambiguous_paper');
 assert(!fs.existsSync(path.join(destination,'未指定试卷.docx')));
 assert(!(await snapshot()).officeArtifacts.some(item=>item.path==='未指定试卷.docx'));
 assert.deepEqual(paperFacts(),existing);
 check('An ambiguous unbound request opens no approval and produces no file',{outcome});
 await app.close();app=undefined;
 await launch(true);
 const rows=query("SELECT file_name,file_size,file_path FROM document_artifacts WHERE status='exported' AND file_path LIKE ?",[destination+'%']);
 assert.deepEqual(rows.map(row=>row.file_name).sort(),report.files.map(file=>file.name).sort());
 assert(report.files.every(file=>rows.some(row=>row.file_name===file.name&&row.file_size===file.bytes)));
 assert.deepEqual((await app.evaluate(()=>globalThis.conversationExport)).requests,[]);
 assert.deepEqual(errors,[]);
 check('Both installed files retain their artifact records after cold restart without replay');
 report.ok=true;
}catch(error){
 report.error=String(error.stack);console.error(report.error);process.exitCode=1;
 report.failedWire=await app?.evaluate(()=>globalThis.conversationExport).catch(()=>undefined);
 await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
}finally{
 await app?.close().catch(()=>undefined);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));
}
