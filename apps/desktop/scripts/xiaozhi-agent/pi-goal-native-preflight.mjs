import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {build} from 'esbuild';
import {Agent} from '@earendil-works/pi-agent-core';
import {createAssistantMessageEventStream,InMemoryCredentialStore} from '@earendil-works/pi-ai';
import {createAgentSession,DefaultResourceLoader,ModelRuntime,ModelRegistry,SessionManager,SettingsManager} from '@earendil-works/pi-coding-agent';
import {fetchDeepSeekCatalogue} from '../../src/main/xiaozhi-agent/model-capabilities.ts';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-goal-native-'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  const report={success:false,checks:[],sources:[],requests:[],previousFailures:['pi-goal-native-nvzxr4: guessed setTools API; source corrected to state.tools','pi-goal-native-cdKJ1T: error still invokes finishTurn before hard exit; incorrect test assumption corrected','pi-goal-native-T9cXrl: original AgentSession rejected continue without runnable custom context; original checkpoint retained, not production success'],boundary:'A: original Pi scheduler with declared synthetic transport; B: original AgentSession and official DeepSeek, synthetic local read-only material; Hana runtime persistence candidate only. Production goal/SQLite/preload/UI/recovery NOT implemented or accepted.'};
const check=(layer,name,value)=>{assert(value,name);report.checks.push({layer,name,pass:true});console.log(`PASS ${layer} ${name}`);};
let officialSession;
try {
  const urls=[
    ['hana/task-registry.ts','https://raw.githubusercontent.com/liliMozi/openhanako/v0.450.0/lib/task-registry.ts'],
    ['hana/safe-fs.ts','https://raw.githubusercontent.com/liliMozi/openhanako/v0.450.0/shared/safe-fs.ts'],
    ['hana/LICENSE','https://raw.githubusercontent.com/liliMozi/openhanako/v0.450.0/LICENSE'],
    ['pi/agent-loop.ts','https://raw.githubusercontent.com/earendil-works/pi/v1.0.2/packages/agent/src/agent-loop.ts'],
    ['pi/types.ts','https://raw.githubusercontent.com/earendil-works/pi/v1.0.2/packages/agent/src/types.ts'],
    ['pi/agent-session.ts','https://raw.githubusercontent.com/earendil-works/pi/v1.0.2/packages/coding-agent/src/core/agent-session.ts'],
    ['pi/LICENSE','https://raw.githubusercontent.com/earendil-works/pi/v1.0.2/LICENSE'],
  ];
  const lock=JSON.parse(fs.readFileSync(new URL('./goal-native-source.lock.json',import.meta.url)));assert.equal(lock.version,1);assert.equal(lock.pi,'1.0.2');assert.equal(lock.hana,'0.450.0');report.sourceLockSha256=sha(fs.readFileSync(new URL('./goal-native-source.lock.json',import.meta.url)));
  const fetched=await Promise.all(urls.map(async([file,url])=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});assert(r.ok,`${file} HTTP ${r.status}`);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(sha(bytes),lock.files[file],`${file}: pinned source changed`);return {file,url,bytes};}));
  for(const item of fetched){const file=path.join(output,'source',item.file);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,item.bytes);report.sources.push({file:item.file,url:item.url,bytes:item.bytes.length,sha256:sha(item.bytes)});}
  for(const pkg of ['pi-ai','pi-agent-core','pi-coding-agent','pi-tui'])assert.equal(JSON.parse(fs.readFileSync(`node_modules/@earendil-works/${pkg}/package.json`)).version,'1.0.2');
  check('source','Exact installed Pi 1.0.2 and pinned official source/license downloaded',report.sources.length===7);

  // Compile the original Hana bodies. Only logger import is a declared diagnostic test seam.
  const original=fs.readFileSync(path.join(output,'source/hana/task-registry.ts'),'utf8');
  const safe=fs.readFileSync(path.join(output,'source/hana/safe-fs.ts'),'utf8');
  const ast=ts.createSourceFile('safe-fs.ts',safe,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const atomic=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='atomicWriteSync');assert(atomic);
  fs.writeFileSync(path.join(output,'source/hana/atomic-extracted.ts'),`import fs from 'node:fs';\n${atomic.getText(ast)}\n`);
  report.hanaAdaptation={atomicBodySha256:sha(atomic.getText(ast)),boundary:'Original atomicWriteSync AST body. Logger is test-only console seam; original TaskRegistry body unchanged. No schedule, cron, or production state.'};
  const entry=original.replace('"../shared/safe-fs.ts"','"./atomic-extracted.ts"').replace('import { createModuleLogger } from "./debug-log.ts";','export const diagnosticWarnings=[]; const createModuleLogger=()=>({warn:message=>diagnosticWarnings.push(String(message)),error:message=>diagnosticWarnings.push(String(message))});');
  const adapted=path.join(output,'source/hana/task-candidate.ts');fs.writeFileSync(adapted,entry);
  const bundled=path.join(output,'hana-candidate.mjs');await build({entryPoints:[adapted],outfile:bundled,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const {TaskRegistry,diagnosticWarnings}=await import(pathToFileURL(bundled));report.hanaWarnings=diagnosticWarnings;
  report.previousFailures.push('pi-goal-native-uTEkO4: original task update left older tasks.json and newer .tmp; swallowed persistence failure, exact cause unavailable before logger capture. Positive assertion failed; cannot count as stable storage.');
  const persistent=path.join(output,'runtime/tasks.json'),registry=new TaskRegistry({persistencePath:persistent});let aborts=0;
  registry.registerHandler('education',{abort:()=>{aborts++;}});
  registry.register('one',{type:'education',parentSessionId:'session-a',meta:{objective:'核对合成教研资料'}});
  registry.update('one',{progress:{current:1,total:3},meta:{runId:'run-a'}});
  check('Hana','Original task registration/progress persisted with exact parent/run metadata',JSON.parse(fs.readFileSync(persistent)).tasks[0].meta.runId==='run-a');
  const view=registry.query('one');view.meta.runId='forged';check('Hana','Original queries return isolated clones',registry.query('one').meta.runId==='run-a');
  registry.update('one',{status:'paused'});const restored=new TaskRegistry({persistencePath:persistent});
  check('Hana-limit','Paused original task becomes recovering on cold load; cannot grant resume authority',restored.query('one').status==='recovering');
  registry.register('two',{type:'education',parentSessionId:'session-b'});
  registry.abortByParentSession({sessionId:'session-a'});
  check('Hana','Original parent-session abort affects only actual matching task',registry.query('one').status==='aborted'&&registry.query('two').status==='running'&&aborts===1);
  registry.complete('two',{evidence:'readback'});const finals=new TaskRegistry({persistencePath:persistent});
  check('Hana','Original completed evidence survives cold load',finals.query('two').status==='completed'&&finals.query('two').result.evidence==='readback');
  registry.register('two',{type:'education',parentSessionId:'session-b'});
  check('Hana-limit','Re-register revives completed task; main goal CAS must prohibit it',registry.query('two').status==='running');
  const impossible=path.join(output,'file-not-directory');fs.writeFileSync(impossible,'fixture');
  const failedWriter=new TaskRegistry({persistencePath:path.join(impossible,'tasks.json')});failedWriter.register('lost',{type:'education'});
  check('Hana-limit','Original failed persistence still returns in-memory task; not formal goal truth',!!failedWriter.query('lost')&&!fs.existsSync(path.join(impossible,'tasks.json')));

  const model={id:'scheduler-fixture',name:'Declared fixture',api:'openai-completions',provider:'fixture',baseUrl:'https://example.invalid',reasoning:false,input:['text'],contextWindow:16384,maxTokens:1024,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
  const response=(content,stopReason='stop')=>({role:'assistant',content,api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason,timestamp:Date.now()});
  function makeAgent(messages,finish){let calls=0;const requests=[];const events=[];const agent=new Agent({initialState:{model,systemPrompt:'Declared native scheduling fixture',tools:[]},streamFn:(_model,context,options)=>{options?.signal?.throwIfAborted();requests.push(structuredClone(context.messages));const answer=messages[calls++];assert(answer,'Unexpected extra request');const stream=createAssistantMessageEventStream();queueMicrotask(()=>{stream.push({type:'start',partial:answer});stream.push({type:answer.stopReason==='error'?'error':'done',reason:answer.stopReason==='error'?'error':answer.stopReason,message:answer,error:answer});});return stream;},finishTurn:(turn,signal)=>finish?.(turn,signal,agent,calls)});agent.subscribe(e=>events.push(e.type));return {agent,requests,events,calls:()=>calls};}
  const continued=makeAgent([response([{type:'text',text:'开始'}]),response([{type:'text',text:'完成'}])],(_turn,_signal,_agent,n)=>n===1?{action:'continue'}:undefined);
  await continued.agent.prompt('教师真实任务');
  check('A','Native continue makes exactly one next request without fake user input',continued.calls()===2&&continued.requests[1].filter(m=>m.role==='user').length===1&&continued.events.filter(e=>e==='agent_end').length===1);
  let toolCalls=0;
  const tool=makeAgent([response([{type:'toolCall',id:'tool-one',name:'read_fixture',arguments:{}}],'toolUse'),response([{type:'text',text:'已核对'}])],(_t,_s,_a,n)=>n===1?{action:'continue'}:undefined);
  tool.agent.state.tools=[{name:'read_fixture',label:'合成只读',description:'Declared fixture',parameters:{type:'object',properties:{}},execute:async()=>{toolCalls++;return {content:[{type:'text',text:'实际夹具结果'}],details:{}};}}];
  await tool.agent.prompt('读取');check('A','Native tool continuation satisfies continue without third request or duplicate tool',tool.calls()===2&&toolCalls===1&&tool.requests[1].some(m=>m.role==='toolResult'));
  const queued=makeAgent([response([{type:'text',text:'开始'}]),response([{type:'text',text:'已接续'}])],(_t,_s,a,n)=>{if(n===1){a.followUp({role:'user',content:'明确追加',timestamp:Date.now()});return {action:'continue'};}});
  await queued.agent.prompt('任务');check('A','Actual follow-up queue satisfies native continuation once',queued.calls()===2&&queued.requests[1].filter(m=>m.role==='user').length===2);
  const ended=makeAgent([response([{type:'text',text:'暂停'}])],(_t,_s,a)=>{a.steer({role:'user',content:'不可交付',timestamp:Date.now()});return {action:'end'};});
  await ended.agent.prompt('任务');check('A','Native end skips pending queues and new provider request',ended.calls()===1&&!ended.agent.state.messages.some(m=>m.role==='user'&&m.content==='不可交付'));ended.agent.clearAllQueues();
  let errorBoundaries=0;const errors=makeAgent([response([{type:'text',text:''}],'error')],()=>{errorBoundaries++;return {action:'continue'};});await errors.agent.prompt('任务');
  check('A','Provider error invokes final boundary but ignores continue and makes no next request',errors.calls()===1&&errorBoundaries===1);
  const aborted=makeAgent([response([{type:'text',text:'开始'}])],(_t,_s,a)=>{a.abort();return {action:'continue'};});await aborted.agent.prompt('任务');
  check('A','Aborted native signal admits no new transport request',aborted.calls()===1);

  const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key,'Missing local test credential');
  const catalog=await fetchDeepSeekCatalogue(path.join(output,'catalog'),key);const capability=catalog.models.find(v=>v.id==='deepseek-flash');assert(capability);
  const runtime=await ModelRuntime.create({credentials:new InMemoryCredentialStore(),modelsPath:null,allowModelNetwork:false,refreshOnCreate:false});const provider='education-goal-preflight';await runtime.setRuntimeApiKey(provider,key);
  const models=new ModelRegistry(runtime);models.registerProvider(provider,{name:'DeepSeek goal preflight',apiKey:key,baseUrl:'https://api.deepseek.com/v1',api:'openai-completions',models:[{id:capability.id,name:capability.name,reasoning:true,input:['text'],contextWindow:capability.contextWindow,maxTokens:512,cost:{input:0,output:0,cacheRead:0,cacheWrite:0},compat:{thinkingFormat:'deepseek',supportsStore:false,supportsDeveloperRole:false,supportsReasoningEffort:true,supportsUsageInStreaming:true,maxTokensField:'max_tokens',requiresReasoningContentOnAssistantMessages:true,requiresThinkingAsText:false}}]});
  const cwd=path.join(output,'official'),agentDir=path.join(cwd,'agent');fs.mkdirSync(agentDir,{recursive:true});
  const code=`EDUGOAL${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;const evidence=path.join(cwd,'public-synthetic-evidence.json');fs.writeFileSync(evidence,JSON.stringify({title:'公开合成教研核验资料',code,lessons:3}));const beforeSha=sha(fs.readFileSync(evidence));
  let nativeBoundaries=0,readCalls=0;const boundaries=[];
  const settings=SettingsManager.inMemory({compaction:{enabled:true,keepRecentTokens:2048,reserveTokens:4096},retry:{enabled:false,maxRetries:0},images:{autoResize:true,blockImages:true},packages:[],extensions:[],skills:[],prompts:[],themes:[]});
  const loader=new DefaultResourceLoader({cwd,agentDir,settingsManager:settings,noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,systemPrompt:'你是教师办公助手。公开说明简短，用真实工具核对资料。第一条回复仅用一句中文说明开始核对，不调用工具。随后宿主提供当前目标状态，再调用read_goal_evidence；拿到实际结果后仅输出JSON对象 {"code":原code,"lessons":数字}。不得猜code，不输出内部路径、工具参数或推理。',extensionFactories:[pi=>{pi.on('turn_end',event=>{nativeBoundaries++;boundaries.push({entryId:event.messageEntryId,toolEntries:event.toolResultEntryIds,outcome:event.outcome,canContinue:event.context.canContinue});if(nativeBoundaries===1){assert.equal(readCalls,0,'Initial response must be public progress only');return {continue:true,entries:[{type:'custom',customType:'education.goal-preflight.checkpoint.v1',data:{version:1,state:'active',step:'核对公开合成资料',messageEntryId:event.messageEntryId}},{type:'custom_message',customType:'education.goal-preflight.context.v1',content:'宿主当前目标状态：目标仍active，公开开始说明已完成。下一步调用read_goal_evidence核对唯一公开合成资料，再返回实际完整code和lessons。此状态不是教师新消息，不扩展任何权限或批准。',display:false,details:{version:1,state:'active'}}]};}return undefined;});}]});
  await loader.reload();const manager=SessionManager.create(cwd,path.join(cwd,'native'));
  const created=await createAgentSession({cwd,agentDir,modelRuntime:runtime,model:models.find(provider,capability.id),thinkingLevel:'off',settingsManager:settings,sessionManager:manager,resourceLoader:loader,noTools:'builtin',tools:['read_goal_evidence'],customTools:[{name:'read_goal_evidence',label:'核对公开资料',description:'读取唯一公开合成教研资料；code只有工具实际读取才能知道。无需确认，因为仅自造验收素材且只读。',parameters:{type:'object',properties:{},additionalProperties:false},execute:async(_id,_args,signal)=>{signal?.throwIfAborted();assert.equal(++readCalls,1,'Duplicate actual evidence read');const bytes=fs.readFileSync(evidence);assert.equal(sha(bytes),beforeSha);return {content:[{type:'text',text:bytes.toString()}],details:{success:true}};}}]});assert(!created.modelFallbackMessage);officialSession=created.session;
  const raw=officialSession.agent.streamFunction;officialSession.agent.streamFunction=(model,context,options)=>raw(model,context,{...options,onPayload:async payload=>{report.requests.push({model:payload.model,userMessages:payload.messages.filter(m=>m.role==='user').length,messageRoles:payload.messages.map(m=>m.role)});return await options?.onPayload?.(payload);},onResponse:async metadata=>{report.requests.at(-1).status=metadata.status;return await options?.onResponse?.(metadata);}});
  await officialSession.prompt('请核对这份公开合成教研资料，先说明开始，接着继续完成真实核验；最后准确返回资料中的code和lessons。');
  assert.notEqual(officialSession.messages.at(-1)?.stopReason,'error');const answer=officialSession.getLastAssistantText();report.official={model:capability.id,answer,readCalls,boundaries};const json=JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g,''));
  check('B','Official DeepSeek and original AgentSession continue from actual persisted turn boundary',nativeBoundaries>=3&&report.requests.length===3&&report.requests.every(r=>r.status===200));
  check('B','One native teacher prompt; continued context is explicit original custom message, not fake teacher input',officialSession.messages.filter(m=>m.role==='user').length===1&&manager.getEntries().filter(e=>e.type==='custom_message'&&e.customType==='education.goal-preflight.context.v1').length===1);
  check('B','Actual local tool read and exact unique result; no duplicate read or source writes',readCalls===1&&json.code===code&&json.lessons===3&&sha(fs.readFileSync(evidence))===beforeSha);
  const entries=manager.getEntries(),checkpoint=entries.filter(e=>e.type==='custom'&&e.customType==='education.goal-preflight.checkpoint.v1');
  check('B','Native checkpoint binds real assistant entry; original tool entry and public segments retained',checkpoint.length===1&&entries.some(e=>e.id===checkpoint[0].data.messageEntryId)&&entries.filter(e=>e.type==='message'&&e.message.role==='assistant').length===3&&entries.some(e=>e.type==='message'&&e.message.role==='toolResult'));
  const reopened=SessionManager.open(manager.getSessionFile(),path.join(cwd,'native'),cwd);check('B','Original native cold reopen preserves checkpoint without new request',reopened.getEntries().some(e=>e.id===checkpoint[0].id)&&report.requests.length===3);
  report.official={model:capability.id,answer,readCalls,boundaries,nativeSha256:sha(fs.readFileSync(manager.getSessionFile())),sourceSha256:beforeSha};
  report.success=true;
}catch(error){report.error=String(error?.message||error).replace(/sk-[a-zA-Z0-9]{16,}/g,'[redacted]').slice(0,1500);console.error(report.error);process.exitCode=1;}
finally{await officialSession?.dispose();report.scriptSha256=sha(fs.readFileSync(new URL(import.meta.url)));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,passed:report.checks.length,output}));}
