/** Explicit-cost opt-in. Runs synthetic tasks through the real production UI. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {randomInt} from 'node:crypto';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';import {fingerprint} from '../acceptance/evidence.mjs';
const args=process.argv.slice(2),arg=name=>args.find(x=>x.startsWith(name+'='))?.slice(name.length+1);
if(!args.includes('--allow-paid-model'))throw Error('Explicit user approval required; review HANA_ANSWER_QUALITY.md before --allow-paid-model. No requests sent.');
const limit=Number(arg('--max-requests')||20),caseLimit=Number(arg('--cases')||10);
if(!Number.isInteger(limit)||limit<1||limit>180||!Number.isInteger(caseLimit)||caseLimit<1||caseLimit>30)throw Error('Invalid bounded evaluation size');
if(arg('--env-file'))process.loadEnvFile(path.resolve(arg('--env-file')));
if(!process.env.DEEPSEEK_API_KEY)throw Error('Configured DEEPSEEK_API_KEY required. No requests sent.');
const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop),cases=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'answer-quality-cases.json'),'utf8')).cases.slice(0,caseLimit);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'edu-quality-live-')),data=path.join(root,'data'),profile=path.join(root,'profile');
const report={ok:false,build:fingerprint(path.dirname(path.dirname(main))).sha256,requestLimit:limit,answers:[],errors:[],scope:'Synthetic development tasks; teacher blind grading and independent natural holdout remain required.'};
console.log(JSON.stringify({output:root,requestLimit:limit}));
let app,page;
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,100));}throw Error('live evaluation timeout');};
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
try{
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_MODEL:process.env.DEEPSEEK_MODEL||'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});await assertIsolatedPiMain(app,main,profile);
 await app.evaluate(async({net},{limit,ledger})=>{const fs=process.getBuiltinModule('fs'),original=net.fetch.bind(net);globalThis.liveQuality={requests:0,limit,payloads:[]};fs.writeFileSync(ledger,JSON.stringify(globalThis.liveQuality));net.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url);if(url.hostname!=='api.deepseek.com'||!['/models','/chat/completions','/v1/models','/v1/chat/completions'].includes(url.pathname))throw Error('Evaluation permits only the approved DeepSeek endpoint');if(url.pathname.endsWith('/chat/completions')){if(globalThis.liveQuality.requests>=limit)throw Error('Live evaluation request cap reached');globalThis.liveQuality.requests++;const b=JSON.parse(init.body);globalThis.liveQuality.payloads.push({model:b.model,effort:b.reasoning_effort,maxTokens:b.max_tokens,bytes:Buffer.byteLength(init.body),tools:b.tools?.length||0});fs.writeFileSync(ledger,JSON.stringify(globalThis.liveQuality));}return original(input,init);};},{limit,ledger:path.join(root,'request-ledger.json')});
 page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 const ready=()=>page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&input.checkVisibility()&&!input.disabled&&!document.querySelector('[data-testid="pi-workspace-loading"]')&&!document.querySelector('button[aria-label="停止本轮"]');},null,{timeout:90000});
 await ready();
 for(const [index,item]of cases.entries())for(const mode of index%2?['optimized','legacy']:['legacy','optimized']){
   if(await app.evaluate(()=>globalThis.liveQuality.requests>=globalThis.liveQuality.limit)){report.capped=true;break;}
   await app.evaluate((_,mode)=>{process.env.XIAOZHI_ANSWER_QUALITY=mode;},mode);
   const previousSession=await page.locator('.office-composer-container').getAttribute('data-session-id');
   await page.getByTestId('pi-new-session').click();await page.waitForFunction(previous=>{const id=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');return id&&id!==previous;},previousSession);await ready();
   const sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id'),priorRuns=new Set(query('SELECT id FROM ai_agent_runs').map(row=>row.id));
   await page.getByTestId('office-prompt-input').fill(item.prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();
   const row=await until(()=>query("SELECT id,status,error_message FROM ai_agent_runs WHERE session_id=? ORDER BY created_at DESC",[sessionId]).find(r=>!priorRuns.has(r.id)&&['succeeded','failed','blocked'].includes(r.status)));
   await ready();const message=query("SELECT content,metadata_json FROM ai_conversation_messages WHERE json_extract(metadata_json,'$.agentRunId')=? AND role='assistant'",[row.id])[0];
   const metadata=message?JSON.parse(message.metadata_json):{};
   report.answers.push({caseId:item.id,mode,prompt:item.prompt,rubric:item.rubric,runId:row.id,status:row.status,error:row.error_message,answer:message?.content,metrics:metadata.answerQuality});
   fs.writeFileSync(path.join(root,'checkpoint.json'),JSON.stringify(report,null,2));
   console.log(JSON.stringify({caseId:item.id,mode,status:row.status,requests:await app.evaluate(()=>globalThis.liveQuality.requests)}));
 }
 report.requests=await app.evaluate(()=>globalThis.liveQuality.requests);report.ok=report.answers.length===cases.length*2&&report.answers.every(r=>r.status==='succeeded')&&!report.errors.length;
 if(!report.ok)process.exitCode=1;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{if(app){report.requests=await app.evaluate(()=>globalThis.liveQuality?.requests).catch(()=>report.requests);report.payloads=await app.evaluate(()=>globalThis.liveQuality?.payloads).catch(()=>undefined);await app.close();}
 const shuffled=[...report.answers];for(let i=shuffled.length-1;i>0;i--){const j=randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 report.blindKey=shuffled.map((a,i)=>({sampleId:`sample-${i+1}`,caseId:a.caseId,mode:a.mode,runId:a.runId}));fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
 const blind=shuffled.map((a,i)=>({sampleId:`sample-${i+1}`,caseId:a.caseId,prompt:a.prompt,rubric:a.rubric,answer:a.answer,status:a.status,correctness:null,requirements:null,evidence:null,teachingFit:null,clarity:null,notes:''}));
 fs.writeFileSync(path.join(root,'blind-review.json'),JSON.stringify(blind,null,2));console.log(JSON.stringify({ok:report.ok,requests:report.requests,output:root}));}
