/** Prepared paired UI run. Executing this file sends ONE real model request.
 * No tracing/HAR/video/DOM dumps: these would retain private provider reasoning.
 * Source contract: DeepTutor web/components/common/AssistantResponse.tsx maps
 * public segments to direct MarkdownRenderer children (.md-renderer.prose),
 * think segments to ModelThinkingCard (details). TracePanels.hasFinishMarker
 * requires call_status + complete + finish; UnifiedChatContext ends on done.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';
import {pairedScenario} from './acceptance/chat-paired-scenarios.mjs';

const runtime='D:/WorkProject/小智智能体借鉴项目/_ui-review-runtime/20261101';
const reference='D:/WorkProject/小智智能体借鉴项目/DeepTutor';
const scenario=pairedScenario();
const prompt=scenario.prompt;
const model='deepseek-flash';
const fixture=path.resolve(process.env.UI_PAIRED_PDF||path.join(runtime,'buoyancy-review.pdf'));
const outputArg=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
const output=outputArg?path.resolve(outputArg):path.join(runtime,'paired-deeptutor-'+scenario.name+'-'+Date.now());
const publicSelector='[role="article"][aria-live="polite"] > .md-renderer.prose';
const report={app:'DeepTutor',supported:false,complete:false,failure:null,model,prompt,scenario:scenario.name,promptOverride:scenario.promptOverride,
  promptSha256:createHash('sha256').update(prompt).digest('hex'),
  scriptSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  scenarioConfigSha256:createHash('sha256').update(fs.readFileSync(new URL('./acceptance/chat-paired-scenarios.mjs',import.meta.url))).digest('hex'),
  fixture:{name:path.basename(fixture),sha256:null},events:[],timings:{},screenshots:[],
  sourceContract:{publicSelector,finish:'trace_kind=call_status,call_state=complete,call_role=finish',
    terminal:'done.metadata.status=completed (missing status defaults to completed in reference)',files:{}},
  boundary:'Single fresh browser context, exact synthetic attachment/prompt. UI run, not teacher quality acceptance. No native reasoning/raw tool bodies stored.'};
async function main(){
let browser,context,page,started=0,turnId='',sessionId='',doneStatus='',finish=false,sent=false;
let resolveTerminal;
const terminal=new Promise(resolve=>{resolveTerminal=resolve;});
const wallStart=performance.now(),deadline=wallStart+300_000;
const remaining=()=>Math.max(1,Math.floor(deadline-performance.now()));
const fail=code=>{throw new Error(code);};
const token=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(v)?v:undefined;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const recordTiming=key=>{if(started&&report.timings[key]===undefined)report.timings[key]=Math.round(performance.now()-started);};
let selected;
const seen=new Set();
const watchdog=setTimeout(()=>{
  doneStatus='timeout_300s';resolveTerminal();
  void context?.close().catch(()=>{});
},300_000);
// Fail closed before browser/model use if the researched source anatomy changed.
function verifySource(){
  const contracts=[
    ['web/components/common/AssistantResponse.tsx',s=>s.includes('role="article"')&&s.includes('segment.kind === "think"')&&s.includes('<ModelThinkingCard')&&s.includes('variant="prose"')],
    ['web/components/common/ModelThinkingCard.tsx',s=>s.includes('<details')],
    ['web/components/common/SimpleMarkdownRenderer.tsx',s=>s.includes('md-renderer prose max-w-none')],
    ['web/components/common/RichMarkdownRenderer.tsx',s=>s.includes('md-renderer prose')],
    ['web/components/chat/home/TracePanels.tsx',s=>s.includes('meta.call_role === "finish"')&&s.includes('meta.call_state === "complete"')],
    ['web/context/UnifiedChatContext.tsx',s=>s.includes('event.type === "done"')&&s.includes('"completed"')],
  ];
  for(const [file,valid] of contracts){const bytes=fs.readFileSync(path.join(reference,file));if(!valid(bytes.toString('utf8')))fail('unsupported_source_contract:'+file);report.sourceContract.files[file]=hash(bytes);}
}
function receive(payload){
  // Parsed only transiently; never log/serialize content, args, errors or results.
  let event;try{event=JSON.parse(String(payload));}catch{return;}
  if(!sent||!event||typeof event!=='object')return;
  const meta=event.metadata||{};
  const id=token(event.turn_id||meta.turn_id);
  if(!turnId&&id)turnId=id;
  if(id&&turnId!==id)return;
  if(!turnId)return; // Never attribute an unscoped frame to this run.
  const sid=token(event.session_id||meta.session_id);if(sid){if(sessionId&&sid!==sessionId)return;sessionId=sid;}
  if(Number.isSafeInteger(event.seq)){const key=turnId+':'+event.seq;if(seen.has(key))return;seen.add(key);}
  recordTiming('firstEventMs');
  if(meta.trace_kind==='call_status'&&meta.call_state==='complete'&&meta.call_role==='finish'){finish=true;recordTiming('finishMarkerMs');}
  if(event.type==='tool_call'||event.type==='tool_result'){
    recordTiming('firstToolMs');
    report.events.push({atMs:Math.round(performance.now()-started),type:event.type,
      // StreamBus.tool_call.content is the operation NAME, not arguments;
      // tool_result.metadata.tool is its paired name. Never read result.content.
      turnId,seq:Number.isSafeInteger(event.seq)?event.seq:undefined,
      tool:token(event.type==='tool_call'?event.content:(meta.tool_name||meta.tool)),
      callId:token(meta.call_id),state:token(meta.call_state),source:token(event.source),stage:token(event.stage)});
  }
  if(event.type==='error'&&meta.turn_terminal===true){doneStatus='error';resolveTerminal();}
  if(event.type==='done'){doneStatus=token(meta.status)||'completed';recordTiming('doneMs');resolveTerminal();}
}
try {
  fs.mkdirSync(output,{recursive:true});
  verifySource();report.fixture.sha256=hash(fs.readFileSync(fixture));
  browser=await chromium.launch({headless:true,timeout:remaining()});
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});
  context.setDefaultTimeout(5000);page=await context.newPage();
  // No raw pageerror/console text: tool/provider errors can include payloads.
  page.on('pageerror',()=>{report.pageErrorCount=(report.pageErrorCount||0)+1;});
  page.on('websocket',ws=>{
    if(!new URL(ws.url()).pathname.endsWith('/api/v1/ws'))return;
    ws.on('framereceived',({payload})=>receive(payload));
    ws.on('framesent',({payload})=>{
      let e;try{e=JSON.parse(String(payload));}catch{return;}
      if(!sent||!['message','start_turn'].includes(e.type))return;
      report.requestVerified=e.content===prompt&&e.llm_selection?.profile_id===selected?.profile_id&&e.llm_selection?.model_id===selected?.model_id&&e.attachments?.some(a=>a.filename===path.basename(fixture));
      if(!report.requestVerified){doneStatus='request_mismatch';resolveTerminal();}
    });
  });
  await page.goto('http://127.0.0.1:3012/home',{waitUntil:'domcontentloaded',timeout:remaining()});
  // Read-only configured model map; the UI selection remains the actual setter.
  const response=await context.request.get('http://127.0.0.1:8012/api/v1/settings/llm-options',{timeout:remaining()});
  if(!response.ok())fail('unsupported_model_catalog');
  const catalog=await response.json();
  const matches=(catalog.options||[]).filter(o=>o.model===model);
  if(matches.length!==1)fail('unsupported_ambiguous_or_missing_deepseek_flash');
  selected={profile_id:matches[0].profile_id,model_id:matches[0].model_id};
  const picker=page.getByRole('button',{name:/^(选择模型|Select model)$/});
  await picker.waitFor({state:'visible',timeout:remaining()});await picker.click({timeout:remaining()});
  const option=picker.locator('..').locator('button:not([aria-label])').filter({has:page.locator('span').filter({hasText:/^deepseek-flash$/})});
  if(await option.count()!==1)fail('unsupported_model_picker_anatomy');
  await option.click({timeout:remaining()});
  if(!(await picker.textContent()).includes(model))fail('unsupported_model_selection_not_applied');
  if(await page.locator('[role="article"]').count())fail('unsupported_context_not_clean');
  await page.locator('input[type="file"]').first().setInputFiles(fixture,{timeout:remaining()});
  await page.getByText(path.basename(fixture),{exact:true}).waitFor({state:'visible',timeout:remaining()});
  const input=page.locator('textarea');if(await input.count()!==1)fail('unsupported_composer_anatomy');
  await input.fill(prompt,{timeout:remaining()});
  await input.screenshot({path:path.join(output,'composer-before-send.png'),timeout:remaining()});report.screenshots.push('composer-before-send.png');
  report.supported=true;sent=true;started=performance.now();
  await page.getByRole('button',{name:/^(发送|Send)$/}).click({timeout:remaining()});
  // Event-driven terminal wait with a single deadline. No polling sleeps.
  let timer;
  try {await Promise.race([terminal,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout_300s')),remaining());})]);}
  finally {clearTimeout(timer);}
  if(doneStatus!=='completed')fail('terminal_'+doneStatus);
  if(!finish)fail('missing_explicit_final_answer_marker');
  if(!report.requestVerified)fail('unverified_exact_request');
  const publicAnswer=page.locator(publicSelector);
  await publicAnswer.first().waitFor({state:'visible',timeout:remaining()});
  // done ends isStreaming, so the reference smooth renderer becomes pass-through.
  await page.getByRole('button',{name:/^(停止生成|Stop generating)$/}).waitFor({state:'hidden',timeout:remaining()});
  await page.getByRole('button',{name:/^(发送|Send)$/}).waitFor({state:'visible',timeout:remaining()});
  if(await page.locator('[role="article"][aria-live="polite"]').count()!==1)fail('unsupported_multiple_answer_articles');
  const answers=await publicAnswer.allTextContents();
  const answer=answers.join('\n\n').trim();if(!answer)fail('empty_public_final_answer');
  // Only direct public markdown roots: no article/trace/body text extraction.
  fs.writeFileSync(path.join(output,'public-answer.txt'),answer,'utf8');
  fs.writeFileSync(path.join(output,'public-answer.json'),JSON.stringify({app:'DeepTutor',scenario:scenario.name,
    sessionId,runId:turnId,model,prompt,promptSha256:report.promptSha256,sourcePdfSha256:report.fixture.sha256,answer},null,2)+'\n');
  for(let i=0;i<await publicAnswer.count();i++){
    const filename=`public-answer-${i+1}.png`;
    await publicAnswer.nth(i).screenshot({path:path.join(output,filename),timeout:remaining()});report.screenshots.push(filename);
  }
  report.complete=true;recordTiming('completeMs');report.turnId=turnId;report.sessionId=sessionId;
} catch(error) {
  // Do not persist Playwright's exception/call log: it may contain DOM text.
  const message=error instanceof Error?error.message:'';
  report.failure=performance.now()>=deadline?'timeout_300s':/^(unsupported_[a-zA-Z0-9_:/.-]+|terminal_[a-zA-Z0-9_]+|missing_explicit_final_answer_marker|unverified_exact_request|empty_public_final_answer|timeout_300s)$/.test(message)?message:'ui_or_runtime_failure';
  report.complete=false;
} finally {
  clearTimeout(watchdog);
  report.timings.totalMs=Math.round(performance.now()-wallStart);
  await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,supported:report.supported,complete:report.complete,failure:report.failure}));
  if(!report.complete)process.exitCode=1;
}
}
if(process.argv.includes('--help')||process.argv.includes('--check'))console.log(JSON.stringify({preparedOnly:true,
  scenario:scenario.name,prompt,promptSha256:report.promptSha256,model,source:fixture,
  usage:'node scripts/ui-goal-deeptutor-live.mjs [--scenario=default|misconception|practice] [--output=PATH]. Shared UI_PAIRED_PROMPT/UI_PAIRED_PDF/UI_PAIRED_SCENARIO. Uses the existing configured local DeepTutor runtime and a fresh browser context; --check/--help never launch or call a model.'}));
else await main();
