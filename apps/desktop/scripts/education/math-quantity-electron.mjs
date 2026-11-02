import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {pressure,gravity,input,q,r} from './math-quantity-fixtures.mjs';
const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-quantity-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),existing=process.env.MATH_QUANTITY_EXISTING_ROOT;
assert(existing,'MATH_QUANTITY_EXISTING_ROOT must name the original synthetic equation fixture');
assert.equal(JSON.parse(fs.readFileSync(path.join(existing,'report.json'),'utf8')).ok,true);
fs.cpSync(path.join(existing,'data'),data,{recursive:true});fs.cpSync(path.join(existing,'profile'),profile,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function query(sql,args=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}}
const receiptSql=tool=>query('SELECT run_id,tool,success,native_state,effect_state FROM xiaozhi_tool_receipts WHERE tool=? ORDER BY rowid',[tool]);
const oldReceipts=receiptSql('education_verify_equation');assert.equal(oldReceipts.length,4);
const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings');assert.equal(binding.length,1);
const nativeFile=path.join(data,'xiaozhi-pi',binding[0].session_file),oldNative=fs.readFileSync(nativeFile);
const report={ok:false,output,checks:[],errors:[],originalNative:{bytes:oldNative.length,sha256:sha(oldNative)},boundary:'Original synthetic v3 session copied into isolated fixture; formal composer/Pi/Hana discovery/actual SymPy SI worker; zero paid provider requests. No natural model/complete S02 AT acceptance.'};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push(name);console.log('PASS '+name);save();};
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,80));}throw Error('Quantity UI timed out');};
let app,page;
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},args)=>{
  const s=globalThis.quantityFixture={phase:args.cold?'cold':'physics',index:0,requests:[],results:[],blocked:[]};
  net.fetch=async(url,init)=>{
   url=typeof url==='string'?url:url.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')||s.phase==='cold'){s.blocked.push(url);throw Error('No external request or cold model replay permitted');}
   const body=JSON.parse(init.body),phase=s.phase,index=s.index++;if(index>7)throw Error('Bounded local SSE exceeded');
   let receipt;const last=body.messages.filter(message=>message.role==='tool').at(-1)?.content;
   if(last&&index>0){const text=typeof last==='string'?last:last.filter(p=>p.type==='text').map(p=>p.text).join('\n');try{receipt=JSON.parse(text.split('\n')[0]);if('state'in receipt)s.results.push({phase,index,result:receipt});}catch{}}
   let call;
   if(phase==='physics'){
    if(index>=2){const expected=['mismatch','matched','matched','dimension_mismatch','matched'][index-2];if(receipt?.state!==expected)throw Error('Must consume actual quantity result before next step: '+expected);}
    if(index===0)call={name:'find_education_tools',arguments:JSON.stringify({query:'education_verify_quantity 物理单位换算 量纲 压强 速度 质量 重力'})};
    else if(index<=5)call={name:'education_verify_quantity',arguments:JSON.stringify(args.inputs[index-1])};
   }else{
    if(index===0)call={name:'education_verify_quantity',arguments:JSON.stringify(args.changed)};
    else if(receipt?.state!=='matched'||receipt.actual?.exact!=='147/25')throw Error('Changed g requires actual new result');
   }
   s.requests.push({phase,index,tool:call?.name||null,model:body.model,thinking:body.thinking,reasoning_effort:body.reasoning_effort,max_tokens:body.max_tokens});
   const content=phase==='physics'?'核验后修正：200 cm² = 0.02 m²，所以压强为 5000 Pa；直接算100/200得到0.5而漏掉面积单位换算是错误的。1 m/s = 3.6 km/h。kg是质量，不能直接换N；0.6 kg乘题中给定g=10 N/kg才得到重力6 N。这里只核验提交的数量表达式。':'按新给定g=9.8 N/kg重新核验，重力是5.88 N（147/25 N），不能沿用旧6 N。';
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'quantity-fixture',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'quantity-'+phase+'-'+index,type:'function',function:call}]}:{content})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{cold,inputs:[pressure(r(1,2)),pressure(r(5000)),input(q(1,'m/s'),'km/h',r(18,5)),input(q(6,'kg',10),'N',r(6)),gravity()],changed:gravity(98,10)});
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
}
async function run(phase,prompt){
 await app.evaluate((_,value)=>Object.assign(globalThis.quantityFixture,{phase:value,index:0}),phase);
 const before=query('SELECT count(*) n FROM ai_agent_runs')[0].n;
 await page.getByTestId('office-prompt-input').fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(()=>query('SELECT count(*) n FROM ai_agent_runs')[0].n>before);const id=query('SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0].id;
 await until(()=>['succeeded','failed','interrupted','cancelled','blocked','partial'].includes(query('SELECT status FROM ai_agent_runs WHERE id=?',[id])[0]?.status));
 await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());assert.equal(query('SELECT status FROM ai_agent_runs WHERE id=?',[id])[0].status,'succeeded');return id;
}
try{
 report.bundleHash=sha(fs.readFileSync(path.join(desktop,'out/main/index.js')));await launch();
 const physics=await run('physics','请核验100N作用在200cm²上的压强、1m/s是多少km/h，以及0.6kg在题给g=10N/kg时的重力。检查面积平方换算与kg和N的区别；发现错误先修正，再给结论。');
 report.firstWire=await app.evaluate(()=>globalThis.quantityFixture);save();assert.deepEqual(report.firstWire.results.map(row=>row.result.state),['mismatch','matched','matched','dimension_mismatch','matched']);
 assert((await page.locator('body').innerText()).includes('压强为 5000 Pa'));assert.equal(await page.getByTestId('pi-office-approve').count(),0);check('Original v3 session continues through Hana discovery and actual SI checks, rejects wrong area scale/kg-to-N then corrects with no approval');
 const changed=await run('changed','把g改为9.8N/kg，质量仍0.6kg；请按新条件重新核验，不要继续用6N。');
 report.warmWire=await app.evaluate(()=>globalThis.quantityFixture);report.runs={physics,changed};save();assert((await page.locator('body').innerText()).includes('重力是5.88 N'));assert.equal(report.warmWire.requests.length,9);assert.equal(report.warmWire.blocked.length,0);check('Changed explicit physical condition produces a fresh actual worker result5.88N');
 await page.getByTestId('agent-trace-toggle').last().click();await page.locator('[data-tool-name="education_verify_quantity"]').last().waitFor();
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});assert((await page.locator('body').innerText()).includes('核验物理量与单位'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:path.join(output,'warm-'+width+'.png')});}
 const receipts=receiptSql('education_verify_quantity');assert.equal(receipts.length,6);assert(receipts.every(row=>row.success===1&&row.native_state==='matched'));assert.deepEqual(receiptSql('education_verify_equation'),oldReceipts);
 const bytes=fs.readFileSync(nativeFile);assert(bytes.subarray(0,oldNative.length).equals(oldNative));const entries=bytes.toString().trim().split('\n').map(JSON.parse);
 const identity=entries.filter(entry=>entry.type==='custom'&&entry.customType==='xiaozhi.education.quantity.v1');assert.equal(identity.length,1);
 report.nativeIdentity=identity[0];report.nativeResults=entries.filter(entry=>entry.type==='message'&&entry.message?.role==='toolResult'&&entry.message?.toolName==='education_verify_quantity');assert.equal(report.nativeResults.length,6);
 report.receipts=receipts;report.nativeHash=sha(bytes);assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,0);assert.equal(query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n,0);check('Both viewports show named original tool; original v3 native prefix/receipts preserved with six actual new receipts and zero writes');
 await app.close();app=null;await launch(true);await page.getByText('重力是5.88 N',{exact:false}).last().waitFor({timeout:30000});
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await page.screenshot({path:path.join(output,'cold-'+width+'.png')});}
 assert.equal(sha(fs.readFileSync(nativeFile)),report.nativeHash);assert.deepEqual(receiptSql('education_verify_quantity'),receipts);assert.deepEqual(receiptSql('education_verify_equation'),oldReceipts);
 report.coldWire=await app.evaluate(()=>globalThis.quantityFixture);assert.equal(report.coldWire.requests.length,0);assert.equal(report.coldWire.blocked.length,0);assert.deepEqual(report.errors,[]);check('Cold startup retains original and new native receipts/latest answer with zero replay or renderer errors');report.ok=true;
}catch(error){report.error=String(error.stack);report.failedWire=await app?.evaluate(()=>globalThis.quantityFixture).catch(()=>null);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await app?.close().catch(()=>{});save();console.log(JSON.stringify({ok:report.ok,output,checks:report.checks.length,error:report.error}));}
