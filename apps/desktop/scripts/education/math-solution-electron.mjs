import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {solutionCases} from './math-solution-fixtures.mjs';
const desktop=path.resolve(import.meta.dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-solution-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),existing=process.env.MATH_SOLUTION_EXISTING_ROOT;
assert(existing,'MATH_SOLUTION_EXISTING_ROOT must name the original synthetic quantity fixture');
assert.equal(JSON.parse(fs.readFileSync(path.join(existing,'report.json'),'utf8')).ok,true);
fs.cpSync(path.join(existing,'data'),data,{recursive:true});fs.cpSync(path.join(existing,'profile'),profile,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function query(sql,args=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}}
const receipts=tool=>query('SELECT run_id,tool,success,native_state,effect_state FROM xiaozhi_tool_receipts WHERE tool=? ORDER BY rowid',[tool]);
const oldEquation=receipts('education_verify_equation'),oldQuantity=receipts('education_verify_quantity');assert.equal(oldEquation.length,4);assert.equal(oldQuantity.length,6);
const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings');assert.equal(binding.length,1);
const nativeFile=path.join(data,'xiaozhi-pi',binding[0].session_file),oldNative=fs.readFileSync(nativeFile);
const report={ok:false,output,checks:[],errors:[],originalNative:{bytes:oldNative.length,sha256:sha(oldNative)},boundary:'Original synthetic v3/v4 native session, formal composer/Pi/Hana discovery and actual local SymPy chain solver. Transport is local synthetic SSE; zero paid calls, no natural model-quality or full S02 acceptance.'};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push(name);console.log('PASS '+name);save();};
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,80));}throw Error('Solution UI timed out');};
let app,page;
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},args)=>{
  const s=globalThis.solutionFixture={phase:args.cold?'cold':'chain',index:0,requests:[],results:[],blocked:[]};
  net.fetch=async(url,init)=>{
   url=typeof url==='string'?url:url.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.includes('/chat/completions')||s.phase==='cold'){s.blocked.push(url);throw Error('External request or cold model replay forbidden');}
   const body=JSON.parse(init.body),phase=s.phase,index=s.index++;if(index>5)throw Error('Bounded local SSE exceeded');
   let receipt;const last=body.messages.filter(message=>message.role==='tool').at(-1)?.content;
   if(last&&index>0){const text=typeof last==='string'?last:last.filter(p=>p.type==='text').map(p=>p.text).join('\n');try{receipt=JSON.parse(text.split('\n')[0]);if('state'in receipt)s.results.push({phase,index,result:receipt});}catch{}}
   let call;
   if(phase==='chain'){
    if(index>=2){const expected=['mismatch','matched','matched'][index-2];if(receipt?.state!==expected)throw Error('Must consume actual chain result: '+expected);if(index===2&&receipt.firstMismatch!==1)throw Error('Middle error hidden');}
    if(index===0)call={name:'find_education_tools',arguments:JSON.stringify({query:'education_verify_solution 解题步骤 等价变形 增根 丢根 代回原式'})};
    else if(index<=3)call={name:'education_verify_solution',arguments:JSON.stringify(args.inputs[index-1])};
   }else{
    if(index===0)call={name:'education_verify_solution',arguments:JSON.stringify(args.changed)};
    else if(receipt?.state!=='matched'||receipt.original?.solutions?.[0]!=='15')throw Error('Changed condition must produce fresh actual root15');
   }
   s.requests.push({phase,index,tool:call?.name||null,model:body.model,thinking:body.thinking,reasoning_effort:body.reasoning_effort,max_tokens:body.max_tokens});
   const content=phase==='chain'?'第1步展开错误：3(x−2)应为3x−6，不能写3x−2；最后碰巧写x=11不能证明中间推导正确。修正展开后，原方程与每一步等价，解为x=11。根式示例平方会增加候选−1，已按原式代回排除−1，最终保留x=2。这里只证明提交的形式化方程链，题意翻译与整题解释仍待教师核对。':'把右边常数改为9后重新核验整条链，解为x=15；不能沿用旧答案11。原定义域保持，题意翻译仍待核对。';
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'solution-fixture',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'solution-'+phase+'-'+index,type:'function',function:call}]}:{content})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{cold,inputs:['wrong-expansion-correct-last-answer','fx04-valid-chain','explicit-expansion-and-original-filter'].map(id=>solutionCases.find(c=>c.id===id).input),changed:solutionCases.find(c=>c.id==='new-original-condition-recomputed').input});
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
}
async function run(phase,prompt){
 await app.evaluate((_,value)=>Object.assign(globalThis.solutionFixture,{phase:value,index:0}),phase);
 const before=query('SELECT count(*) n FROM ai_agent_runs')[0].n;
 await page.getByTestId('office-prompt-input').fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(()=>query('SELECT count(*) n FROM ai_agent_runs')[0].n>before);const id=query('SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0].id;
 await until(()=>['succeeded','failed','interrupted','cancelled','blocked','partial'].includes(query('SELECT status FROM ai_agent_runs WHERE id=?',[id])[0]?.status));
 await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());assert.equal(query('SELECT status FROM ai_agent_runs WHERE id=?',[id])[0].status,'succeeded');return id;
}
try{
 report.bundleHash=sha(fs.readFileSync(path.join(desktop,'out/main/index.js')));
 if(process.argv.includes('--read-only')){
  const oldSolution=receipts('education_verify_solution');assert.equal(oldSolution.length,4);await launch(true);await page.getByText('解为x=15',{exact:false}).last().waitFor({timeout:30000});
  await page.getByTestId('agent-trace-toggle').last().click();const tool=page.locator('[data-tool-name="education_verify_solution"]').last();await tool.getByTestId('agent-tool-trigger').click();assert((await tool.getByTestId('office-tool-evidence').innerText()).includes('原解集：15'));
  for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:path.join(output,'readonly-'+width+'.png')});}
  assert(fs.readFileSync(nativeFile).equals(oldNative));assert.deepEqual(receipts('education_verify_solution'),oldSolution);assert.deepEqual(receipts('education_verify_equation'),oldEquation);assert.deepEqual(receipts('education_verify_quantity'),oldQuantity);
  report.coldWire=await app.evaluate(()=>globalThis.solutionFixture);assert.equal(report.coldWire.requests.length,0);assert.equal(report.coldWire.blocked.length,0);assert.deepEqual(report.errors,[]);check('Integrated build reads exact original v3/v4/v5 native proofs and answer in both viewports with zero replay');report.ok=true;
 }else{
 await launch();
 const chain=await run('chain','请逐步核验3(x−2)=2x+5。我的展开写3x−2=2x+5，但最后写x=11；不能只看最终答案。修正错误后再核验。另核验√(x+2)=x，说明平方产生的增根如何代回筛掉。');
 report.firstWire=await app.evaluate(()=>globalThis.solutionFixture);save();assert.deepEqual(report.firstWire.results.map(row=>row.result.state),['mismatch','matched','matched']);
 assert.equal(report.firstWire.results[0].result.firstMismatch,1);assert.deepEqual(report.firstWire.results[2].result.steps[0].added,['-1']);assert.deepEqual(report.firstWire.results[2].result.steps[1].removed,['-1']);
 assert((await page.locator('body').innerText()).includes('第1步展开错误'));assert.equal(await page.getByTestId('pi-office-approve').count(),0);
 await page.getByTestId('agent-trace-toggle').last().click();const failed=page.locator('[data-tool-name="education_verify_solution"]').first();await failed.getByTestId('agent-tool-trigger').click();const proofText=await failed.getByTestId('office-tool-evidence').innerText();for(const text of ['第1步首次','减少候选：11','新增候选：7','最终答案一致'])assert(proofText.includes(text));await page.screenshot({path:path.join(output,'first-error.png')});
 check('Original Pi/Hana discovers real chain tool; actual first-error and root changes visible despite correct final answer; corrected chain and expansion/filter checked');
 const changed=await run('changed','把3(x−2)=2x+5的右边常数5改为9，重新核验完整推导，不要继续沿用11。');
 report.warmWire=await app.evaluate(()=>globalThis.solutionFixture);report.runs={chain,changed};save();assert((await page.locator('body').innerText()).includes('解为x=15'));assert.equal(report.warmWire.requests.length,7);assert.equal(report.warmWire.blocked.length,0);check('New original condition recomputes actual full chain and original root15');
 await page.getByTestId('agent-trace-toggle').last().click();await page.locator('[data-tool-name="education_verify_solution"]').last().waitFor();
 const currentTool=page.locator('[data-tool-name="education_verify_solution"]').last();await currentTool.getByTestId('agent-tool-trigger').click();assert((await currentTool.getByTestId('office-tool-evidence').innerText()).includes('原解集：15'));
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});assert((await page.locator('body').innerText()).includes('核验解题步骤与增根丢根'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:path.join(output,'warm-'+width+'.png')});}
 const added=receipts('education_verify_solution');assert.equal(added.length,4);assert(added.every(row=>row.success===1&&row.native_state==='matched'));assert.deepEqual(receipts('education_verify_equation'),oldEquation);assert.deepEqual(receipts('education_verify_quantity'),oldQuantity);
 const bytes=fs.readFileSync(nativeFile);assert(bytes.subarray(0,oldNative.length).equals(oldNative));const entries=bytes.toString().trim().split('\n').map(JSON.parse);
 const identity=entries.filter(entry=>entry.type==='custom'&&entry.customType==='xiaozhi.education.solution.v1');assert.equal(identity.length,1);
 report.nativeIdentity=identity[0];report.nativeResults=entries.filter(entry=>entry.type==='message'&&entry.message?.role==='toolResult'&&entry.message?.toolName==='education_verify_solution');assert.equal(report.nativeResults.length,4);
 report.receipts=added;report.nativeHash=sha(bytes);assert.equal(query('SELECT count(*) n FROM document_artifacts')[0].n,0);assert.equal(query('SELECT count(*) n FROM xiaozhi_pi_office_drafts')[0].n,0);check('Both viewports expose original execution tool; old native prefix and v3/v4 receipts unchanged; four new native proofs and zero writes');
 await app.close();app=null;await launch(true);await page.getByText('解为x=15',{exact:false}).last().waitFor({timeout:30000});
 for(const [width,height]of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await page.screenshot({path:path.join(output,'cold-'+width+'.png')});}
 assert.equal(sha(fs.readFileSync(nativeFile)),report.nativeHash);assert.deepEqual(receipts('education_verify_solution'),added);assert.deepEqual(receipts('education_verify_equation'),oldEquation);assert.deepEqual(receipts('education_verify_quantity'),oldQuantity);
 report.coldWire=await app.evaluate(()=>globalThis.solutionFixture);assert.equal(report.coldWire.requests.length,0);assert.equal(report.coldWire.blocked.length,0);assert.deepEqual(report.errors,[]);check('Cold startup retains chain evidence and latest result without model/tool replay or renderer error');report.ok=true;
 }
}catch(error){report.error=String(error.stack);report.failedWire=await app?.evaluate(()=>globalThis.solutionFixture).catch(()=>null);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await app?.close().catch(()=>{});save();console.log(JSON.stringify({ok:report.ok,output,checks:report.checks.length,error:report.error}));}
