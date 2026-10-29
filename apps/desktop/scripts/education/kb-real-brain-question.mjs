import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
const output=process.argv[2],marker=process.argv[3]||'智能家居';
if(!output||!path.isAbsolute(output)||!fs.existsSync(path.join(output,'ai-inspect-report.json')))throw Error('Pass the existing authorized isolated real-material journey directory');
const relative=path.relative(os.tmpdir(),path.resolve(output));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Real-material test must remain inside OS Temp');
if(!marker.trim()||marker.length>60)throw Error('Use a short known question marker');
const desktop=path.resolve(import.meta.dirname,'../..'),data=path.join(output,'data'),profile=path.join(output,'profile'),tag=Date.now(),ledger=path.join(output,'real-brain-cloud-ledger.json');
const report={success:false,checks:[],rendererErrors:[],scope:'Actual isolated Electron UI, saved original-image AI question, real DeepSeek natural-language search/read. One targeted query, not a recall benchmark.'};
const sql=(s,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(s).all(...p);}finally{db.close();}};
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,300));}throw Error('Real knowledge query timed out');};
let app,page,session;
try{
 const target=sql("SELECT id,stem,archive_json FROM question_bank_items WHERE stem LIKE ? ORDER BY updated_at DESC",['%'+marker+'%']).find(q=>{const a=JSON.parse(q.archive_json||'null');return a?.state==='ai_final'&&a.ai?.policy==='image-text-complete.v1';});assert(target,'Known corrected AI question must already be in the real test bank');
 const env={...process.env,OMNI_EDU_DATA_ROOT:data};for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'].includes(key))delete env[key];
 Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'});
 const launch=async()=>{app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));page.setDefaultTimeout(30000);};
 await launch();
 await app.evaluate(({net},{ledger,tag})=>{
  const fs=process.getBuiltinModule('fs');
  for(const owner of [globalThis,net]){const ordinary=owner.fetch.bind(owner);owner.fetch=async(url,options)=>{
   const address=new URL(typeof url==='string'?url:url.url||url.href);if(!/chat\/completions/.test(address.pathname))return ordinary(url,options);
   if(address.origin!=='https://api.deepseek.com')throw Error('Only the authorized DeepSeek account is permitted');
   const rows=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];if(rows.filter(r=>r.tag===tag).length>=8)throw Error('Natural question test call ceiling reached');
   const body=JSON.parse(typeof options?.body==='string'?options.body:await url.clone().text()),row={tag,at:new Date().toISOString(),model:body.model,tools:(body.tools||[]).map(t=>t.function.name)};rows.push(row);fs.writeFileSync(ledger,JSON.stringify(rows,null,2));
   const response=await ordinary(url,options);row.status=response.status;fs.writeFileSync(ledger,JSON.stringify(rows,null,2));return response;
  };}
 },{ledger,tag});
 await page.locator('[data-testid="nav-ai-workspace"]:visible').click();await page.getByTestId('office-prompt-input').waitFor();
 const oldSession=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await page.getByTestId('pi-new-session').click();
 const input=page.getByTestId('office-prompt-input');await until(async()=>!await input.isDisabled());
 session=await until(async()=>{const id=await page.locator('.office-composer-container').getAttribute('data-session-id');return id&&id!==oldSession?id:undefined;});assert(session);
 const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
 await input.fill(`请从我的本地题库找出“${marker}”这道物理题，先读取完整原题，再列出题干、参考答案、解析并附来源。不要另造题。`);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 const result=await until(async()=>{const s=await snapshot();return !s.running&&s.projection.turns.length?s:undefined;});
 const turn=result.projection.turns.at(-1),encoded=JSON.stringify(turn);report.turn=turn;
 assert(encoded.includes(marker),'Natural answer must identify the requested question');
 const events=sql('SELECT j.event_json FROM xiaozhi_event_journal j JOIN xiaozhi_event_runs r ON r.run_id=j.run_id WHERE r.session_id=? ORDER BY j.sequence',[session]).map(r=>JSON.parse(r.event_json));
 report.toolEvents=events.filter(e=>e.kind==='tool_end').map(e=>({tool:e.tool,success:e.success,sources:e.sources}));
 assert(report.toolEvents.some(e=>e.tool==='education_search_questions'&&e.success));
 assert(report.toolEvents.some(e=>e.tool==='education_read_question'&&e.success&&e.sources?.some(s=>s.question?.questionId===target.id)),'Pi must actually read the corrected question with an authoritative source');
 const calls=JSON.parse(fs.readFileSync(ledger,'utf8')).filter(r=>r.tag===tag);assert(calls.length&&calls[0].tools.includes('education_search_questions')&&calls[0].tools.includes('education_read_question'));
 report.calls=calls.length;report.discoveryCalls=report.toolEvents.filter(e=>e.tool==='find_education_tools').length;report.checks.push('Natural teacher question reaches existing real AI-final question through production search and versioned full read');
 await page.screenshot({path:path.join(output,'real-brain-question-'+tag+'.png'),fullPage:true});
 const digest=createHash('sha256').update(encoded).digest('hex');await app.close();app=undefined;await launch();
 const restored=await until(async()=>{const s=await snapshot();return s?.projection?.turns?.some(t=>t.id===turn.id)?s:undefined;});
 assert.equal(createHash('sha256').update(JSON.stringify(restored.projection.turns.find(t=>t.id===turn.id))).digest('hex'),digest);
 report.checks.push('Actual native restart preserves exact answer and source-bearing turn');report.success=report.rendererErrors.length===0;
}catch(e){report.error=e.stack||String(e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'real-brain-question-failure-'+tag+'.png'),fullPage:true}).catch(()=>{});}
finally{if(app)await app.close();fs.writeFileSync(path.join(output,'real-brain-question-'+tag+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,error:report.error,calls:report.calls,discoveryCalls:report.discoveryCalls,tag,output}));}
