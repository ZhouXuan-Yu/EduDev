import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

assert(process.env.OMNI_EDU_ACCEPTANCE_ROOT && process.env.DEEPSEEK_API_KEY);
const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'method-review-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:'deepseek-flash'};
for(const name of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK','OMNI_EDU_HISTORY_TOKEN'])delete env[name];
const prompt='请评估这个候选工作方法：每次组卷后，再核对一遍题目与答案的编号。仅在对话中说明已有依据和还缺哪些验证，先不要发布技能。';
const report={root,source:execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim(),
  build:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),prompt,cost:'UNKNOWN',ok:false};
const read=(query,...args)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...args);}finally{db.close();}
};
let app;
try{
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  const page=await app.firstWindow(),input=page.getByTestId('office-prompt-input');
  await input.waitFor();await assertIsolatedPiMain(app,main,profile);
  await app.evaluate(({net},prompt)=>{
    const fetch=net.fetch.bind(net);globalThis.methodReviewRequests=[];
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')return fetch(input,init);
      const rows=globalThis.methodReviewRequests;
      if(rows.length>=4)throw Error('method_review_model_budget');
      const payload=JSON.parse(init.body);
      const row={model:payload.model,effort:payload.reasoning_effort,maxTokens:payload.max_tokens,
        hasPrompt:payload.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes(prompt)),
        hasTaskEvidence:payload.messages.some(m=>JSON.stringify(m.content).includes('方法的独立任务与留出验证尚无已核验依据')),
        canPublish:payload.tools?.some(tool=>tool.function?.name==='skill_create')??false,status:0};
      rows.push(row);const started=Date.now();const response=await fetch(input,init);
      row.status=response.status;row.firstResponseMs=Date.now()-started;return response;
    };
  },prompt);
  const skills=()=>read('SELECT id,payload_hash FROM xiaozhi_skill_versions_v1 ORDER BY id');
  assert((await page.evaluate(()=>window.omniEdu.getXiaozhiSkillGovernance())).ok);
  const before=skills();
  await input.fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await page.waitForFunction(async()=>{
    const id=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    if(!id)return false;
    const state=await window.omniEdu.getXiaozhiSnapshot(id);
    return !state.running&&state.projection.turns.some(turn=>['completed','failed','interrupted'].includes(turn.status));
  },undefined,{timeout:120000});
  const sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
  const state=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
  const turn=state.projection.turns.at(-1);report.runId=turn.id;report.status=turn.status;
  report.requests=await app.evaluate(()=>globalThis.methodReviewRequests);
  report.usage=state.usage.find(row=>row.runId===turn.id);
  assert.equal(turn.status,'completed');assert(report.requests.some(row=>row.status===200&&row.hasPrompt&&row.hasTaskEvidence));
  assert(report.requests.every(row=>!row.canPublish));
  assert.deepEqual(skills(),before);report.versionsUnchanged=before.length;
  const [reply]=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_valid(metadata_json) AND metadata_json->>'$.agentRunId'=?",sessionId,turn.id);
  assert(reply?.content?.trim());report.persistedReply=reply.content;
  await page.screenshot({path:path.join(root,'reply.png')});report.ok=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{await app?.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(root,report.ok);}
