import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const fixture=process.env.OMNI_EDU_PAPER_READ_FIXTURE;
assert(acceptance&&fixture,'Provide the owned acceptance and prior synthetic fixture paths');
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'report.json')));
assert(baseline.ok&&baseline.sourceId&&baseline.editedId&&baseline.sessionId);
assert(!fs.existsSync(path.join(fixture,'data','app.db-wal')));
const output=fs.mkdtempSync(path.join(acceptance,'paper-agent-read-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
fs.cpSync(path.join(fixture,'data'),data,{recursive:true});
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const report={ok:false,output,main,sha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],paidRequests:0};
const check=(name,details)=>{report.checks.push({name,...details});console.log('PASS '+name);};
const facts=()=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare("SELECT * FROM ai_confirmation_items WHERE session_id=? AND action_type='pi_paper_candidate' ORDER BY confirmed_at,id").all(baseline.sessionId);}
  finally{db.close();}
};
const before=facts(),old=before.find(row=>row.id===baseline.sourceId),edited=before.find(row=>row.id===baseline.editedId),other=before.at(-1);
assert(old&&edited&&other&&other.id!==old.id&&other.id!==edited.id&&other.status==='confirmed');
const sourceChanged=process.argv.includes('--source-changed');
if(sourceChanged){
 const sourceId=JSON.parse(edited.payload_json).selection.items[0].source.questionId;
 const db=new DatabaseSync(path.join(data,'app.db'));
 try{
  const change=db.prepare("UPDATE question_bank_items SET analysis=analysis||? WHERE id=?").run('（合成验收后新增的教师复核备注）',sourceId);
  assert.equal(change.changes,1);
 }finally{db.close();}
 assert.deepEqual(facts(),before);
}
const target={sourceId:old.id,editedId:edited.id,otherId:other.id,otherTitle:other.title,originalDigest:JSON.parse(old.result_json).digest};
const errors=[];
let app,page;

async function waitFor(check,timeout=75000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  const result=await check();
  if(result)return result;
  await new Promise(resolve=>setTimeout(resolve,125));
 }
 throw Error('Paper agent readback timed out');
}

async function launch(cold){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-paper-read-identity',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
 await app.evaluate(({net},{target,cold})=>{
  globalThis.paperReadWire={requests:[],readbacks:[]};
  net.fetch=async(raw,init)=>{
   const url=new URL(typeof raw==='string'?raw:raw.url);
   if(url.origin!=='https://api.deepseek.com')throw Error('Unexpected external request');
   if(url.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{
    id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],
    effort:{supported_levels:['low','high','max'],default_level:'high'},
   }]}),{headers:{'content-type':'application/json'}});
   if(cold||url.pathname!=='/v1/chat/completions')throw Error('Cold startup or unknown model route');
   const wire=globalThis.paperReadWire,index=wire.requests.length,body=JSON.parse(init.body);
   const selectors=[{}, {paperId:target.sourceId}, {paperId:target.sourceId,digest:target.originalDigest},
    {title:target.otherTitle}, {paperId:target.sourceId,digest:'f'.repeat(64)},
    {paperId:'xipaper_00000000-0000-0000-0000-000000000000'}];
   if(index>1){
    const previous=body.messages.filter(message=>message.role==='tool').at(-1);
    const text=typeof previous.content==='string'?previous.content:previous.content.map(part=>part.text||'').join('\n');
    wire.readbacks.push(JSON.parse(text.split('\n')[0]));
   }
   const offer=index===0?{name:'find_education_tools',args:{query:'education_read_paper 核对指定试卷版本'}}
    :index<=selectors.length?{name:'education_read_paper',args:selectors[index-1]}:undefined;
   if(index>selectors.length+1||offer&&!body.tools?.some(tool=>tool.function.name===offer.name))throw Error('Unexpected paper agent model route '+index);
   wire.requests.push(offer?.name||'answer');
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'paper-read-identity',object:'chat.completion.chunk',
    created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant'})+chunk(offer?{tool_calls:[{index:0,id:'paper-read-'+index,type:'function',
    function:{name:offer.name,arguments:JSON.stringify(offer.args)}}]}:{content:'已核对同会话两个试卷和明确的历次版本。'})
    +chunk({},offer?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{target,cold});
 page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(String(error)));
 const input=page.getByTestId('office-prompt-input');
 await input.waitFor();
 await assertIsolatedPiMain(app,main,profile);
 await waitFor(async()=>!await input.isDisabled()&&!await page.getByTestId('pi-event-synchronization').isVisible());
 assert.equal(await page.locator('.office-composer-container').getAttribute('data-session-id'),baseline.sessionId);
}

try{
 await launch(false);
 const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),baseline.sessionId);
 const previous=(await snapshot()).projection.turns.at(-1)?.id;
 const input=page.getByTestId('office-prompt-input');
 await input.fill('请读取并核对本对话已确认的试卷。先看有哪些，再按原卷和编辑版核对分值；只查看现有记录。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await waitFor(async()=>{
  const state=await snapshot(),last=state.projection.turns.at(-1);
  return !state.running&&last?.id!==previous&&last?.status==='completed';
 });
 const {requests,readbacks}=await app.evaluate(()=>globalThis.paperReadWire);
 assert.equal(requests.length,8);
 const [ambiguous,current,historical,byTitle,badDigest,missing]=readbacks;
 assert.equal(ambiguous.code,'ambiguous_paper');
 assert.deepEqual(new Set(ambiguous.choices.map(item=>item.paperId)),new Set([target.editedId,target.otherId]));
 check('A later unrelated paper in the same conversation cannot silently become the target',{choices:ambiguous.choices});
 assert.equal(current.paperId,target.editedId);
 assert.equal(current.totalPoints,7);
 assert.equal(current.sourceCurrent,!sourceChanged);
 assert.equal(current.answerVerified,false);
 assert.equal(historical.paperId,target.sourceId);
 assert.equal(historical.digest,target.originalDigest);
 assert.equal(historical.supersededBy,target.editedId);
 assert.equal(historical.totalPoints,5);
 assert.equal(historical.sourceCurrent,!sourceChanged);
 if(sourceChanged)assert.match(current.message,/变化/);
 check('A prior ID follows the edit lineage, and a pinned digest reads the exact original',{current,historical});
 assert.equal(byTitle.paperId,target.otherId);
 assert.equal(badDigest.code,'paper_digest_mismatch');
 assert.equal(missing.code,'permission_denied');
 assert.deepEqual(facts(),before);
 check('An exact title works, and invalid references fail without substituting another paper',{byTitle:byTitle.paperId});
 await app.close();app=undefined;
 await launch(true);
 await waitFor(async()=>(await snapshot()).projection.turns.at(-1)?.status==='completed');
 assert.deepEqual(await app.evaluate(()=>globalThis.paperReadWire),{requests:[],readbacks:[]});
 assert.deepEqual(facts(),before);
 assert.deepEqual(errors,[]);
 check('Cold start preserves the original paper and edit snapshots without replay');
 report.sourceChanged=sourceChanged;
 report.ok=true;
}catch(error){
 report.error=String(error.stack);console.error(report.error);process.exitCode=1;
 await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>undefined);
}finally{
 await app?.close().catch(()=>undefined);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));
}
