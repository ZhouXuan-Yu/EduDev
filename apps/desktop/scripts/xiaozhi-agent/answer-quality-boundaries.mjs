import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const {resolveAnswerPolicy}=await import('../../src/main/xiaozhi-agent/answer-quality.ts');
const {createEducationToolCatalog}=await import('../../src/main/xiaozhi-agent/education-tool-catalog.ts');
const {createRepeatToolReminder}=await import('../../src/main/xiaozhi-agent/repeat-tool-reminder.ts');
const {withModelRequestRecovery}=await import('../../src/main/xiaozhi-agent/model-request-recovery.ts');
const {createAnswerEvidence}=await import('../../src/main/xiaozhi-agent/answer-evidence.ts');
const {normalizeAnswerCitations}=await import('../../src/shared/answer-citations.ts');
const {createModelReasoningTrace}=await import('../../src/main/xiaozhi-agent/model-reasoning.ts');
const {createQualityMetrics}=await import('../../src/main/xiaozhi-agent/quality-metrics.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {createNativeSessionResources}=await import('../../src/main/xiaozhi-agent/native-session-resources.ts');
const {validLocalAnswerSource}=await import('../../src/shared/local-answer-source.ts');

const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-answer-quality-'));
const report={ok:false,checks:[],metrics:{},boundary:'Real Pi SDK + serialized wire payload, deterministic HTTP/SSE and synthetic local resources. Not real DeepSeek answer quality or teacher acceptance.'};
const check=async(name,fn)=>{if(process.argv.includes('--wire-only')&&!name.startsWith('actual Pi wire'))return;await fn();report.checks.push(name);console.log('PASS '+name);};
const capacity={id:'deepseek-flash',name:'DeepSeek Flash',contextWindow:1048576,maxOutputTokens:32768,observedAt:new Date().toISOString(),source:'official',effort:{supportedLevels:['low','high','max'],defaultLevel:'high'}};
const originalFetch=globalThis.fetch,originalMode=process.env.XIAOZHI_ANSWER_QUALITY;
const definition=i=>({name:`mcp_${'a'.repeat(24)}_tool${i}`,label:`功能${i}`,description:i===29?'光学折射分析工具':'教育能力 '+i,parameters:{type:'object',properties:{query:{type:'string'}},required:['query']},execute:async()=>({content:[{type:'text',text:'授权内结果'}],details:{success:true}})});
let agent;
try{
  await check('task budgets are capability bounded and unknown/stale remains conservative',()=>{
    assert.deepEqual(resolveAnswerPolicy('你好',capacity),{mode:'fast',thinking:'low',maxOutputTokens:4096});
    assert.equal(resolveAnswerPolicy('详细推导数学证明',capacity).maxOutputTokens,16384);
    assert.equal(resolveAnswerPolicy('解释光的折射',capacity).thinking,'medium');
    assert.equal(resolveAnswerPolicy('详细',undefined).maxOutputTokens,4096);
    assert.equal(resolveAnswerPolicy('详细',{...capacity,stale:true}).maxOutputTokens,4096);
    assert.equal(resolveAnswerPolicy('详细',{...capacity,maxOutputTokens:6000}).maxOutputTokens,6000);
  });
  await check('Hana catalog ranks Chinese tasks, lazily exposes schemas, preserves every domain rule',async()=>{
    const defs=Array.from({length:30},(_,i)=>definition(i)),rule=`${defs[29].name}：${'读取后必须核对来源；'.repeat(30)}`;
    const catalog=createEducationToolCatalog('共同权限规则\n'+rule,defs);
    assert(catalog.deferred);assert(!catalog.exposed(defs[29].name));assert(catalog.prompt.includes('共同权限规则'));
    assert(!catalog.prompt.includes(rule));assert(catalog.description(defs[29]).includes(rule));
    const found=await catalog.tool.execute('find',{query:'光学折射'},new AbortController().signal);
    assert(found.content[0].text.includes(defs[29].name));assert(catalog.exposed(defs[29].name));
    catalog.reset('你好');assert(!catalog.exposed(defs[29].name));catalog.reset('光学折射');assert(catalog.exposed(defs[29].name));
    const small=createEducationToolCatalog('规则',defs.slice(0,3));assert(!small.deferred);assert(small.exposed(defs[1].name));
    await assert.rejects(catalog.tool.execute('x',{query:'',extra:1}),/invalid_input/);
  });
  await check('repeated calls canonicalize arguments, distinguish changed results and reset on user input',()=>{
    const reminder=createRepeatToolReminder();
    assert(!reminder.observe('read',{a:1,b:2},'unchanged'));assert(!reminder.observe('read',{b:2,a:1},'unchanged'));
    assert.match(reminder.observe('read',{a:1,b:2},'unchanged'),/3/);
    assert(!reminder.observe('read',{a:1,b:2},'new version'));reminder.reset();assert(!reminder.observe('read',{a:1,b:2},'new version'));
  });
  await check('HTTP recovery is bounded and never retries auth, long backoff, network or partial body',async()=>{
    const init={method:'POST',body:'{}'};let calls=0,guards=0;
    const retry=withModelRequestRecovery(async()=>new Response('',{status:++calls<3?503:200}),{delayMs:0,beforeRetry:async()=>{guards++;}});
    assert.equal((await retry('https://example.invalid',init)).status,200);assert.equal(calls,3);assert.equal(guards,2);
    for(const status of [400,401,403,429,503]){calls=0;const fetcher=withModelRequestRecovery(async()=>{calls++;return new Response('',{status,headers:{'retry-after':'20'}});},{delayMs:0,beforeRetry:async()=>{}});await fetcher('x',init);assert.equal(calls,1);}
    calls=0;await withModelRequestRecovery(async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':new Date(Date.now()+60000).toUTCString()}});},{beforeRetry:async()=>{}})('x',init);assert.equal(calls,1);
    calls=0;await assert.rejects(withModelRequestRecovery(async()=>{calls++;throw Error('network');},{beforeRetry:async()=>{}})('x',init));assert.equal(calls,1);
    calls=0;const broken=withModelRequestRecovery(async()=>{calls++;return new Response(new ReadableStream({start(c){c.error(Error('partial'));}}));},{beforeRetry:async()=>{}});
    await assert.rejects((await broken('x',init)).text());assert.equal(calls,1);
  });
  await check('Stop during HTTP backoff and authority revocation prevent another request',async()=>{
    let calls=0;const controller=new AbortController();
    const wrapped=withModelRequestRecovery(async()=>{calls++;return new Response('',{status:503});},{delayMs:200,beforeRetry:async()=>{}});
    const result=wrapped('x',{method:'POST',body:'{}',signal:controller.signal});setTimeout(()=>controller.abort(),5);await assert.rejects(result);assert.equal(calls,1);
    calls=0;await assert.rejects(withModelRequestRecovery(async()=>{calls++;return new Response('',{status:503});},{delayMs:0,beforeRetry:async()=>{throw Error('skill_scope_changed');}})('x',{method:'POST',body:'{}'}),/skill_scope_changed/);assert.equal(calls,1);
  });
  await check('citation registry rejects search, failure and cross-run references; preserves actual locator',()=>{
    const registry=createAnswerEvidence('r1'),source={title:'物理教材 · 第2页',material:{schemaVersion:'xiaozhi.material-source.v1',resourceId:'resource_00000000-0000-0000-0000-000000000000',version:'a'.repeat(64),offset:0,chunkId:'chunk_00000000-0000-0000-0000-000000000000',bodyVersion:'b'.repeat(64)}};
    // Use a public URL fixture independent of local material ID conventions.
    const result={content:[{type:'text',text:'折射的条件'}],details:{success:true,data:{sources:[{title:source.title,url:'https://example.org/lesson',kind:'read'}]}}};
    assert.equal(registry.attach('office_web_search',result),result);assert.equal(registry.attach('office_web_fetch',{...result,isError:true}).content.length,1);
    const cited=registry.attach('office_web_fetch',result),id=cited.details.data.sources[0].citationId;assert(id);assert.equal(cited.details.data.sources[0].url,result.details.data.sources[0].url);
    const text=`结论[教材](#${id})`;assert.equal(registry.normalize(text),text);assert(createAnswerEvidence('r2').normalize(text).includes('未核验'));
    assert(normalizeAnswerCitations('[假](#xz-cite-made-up)',[]).includes('未核验'));
  });
  await check('reasoning frame coalescing is bounded and terminal flush preserves exact sanitized content',async()=>{
    for(const frameMs of [0,33]){const events=[];let calls=0;const trace=createModelReasoningTrace({frameMs,secret:'never-log',sanitize:async s=>{calls++;return s.replaceAll('学生张三','学生A');},emit:b=>events.push(b)});
      const started=performance.now();for(let i=0;i<80;i++){trace.delta(1,0,i===0?'学生张三':'甲');await new Promise(r=>setTimeout(r,1));}await trace.finish('completed');
      assert.equal(events.at(-1).text,'学生A'+'甲'.repeat(79));assert.equal(events.at(-1).status,'completed');
      report.metrics[frameMs?'optimizedReasoning':'legacyReasoning']={sanitizations:calls,events:events.length,elapsedMs:performance.now()-started};
    }
    assert(report.metrics.optimizedReasoning.events<report.metrics.legacyReasoning.events/2);
  });
  await check('metrics distinguish reasoning arrival from answer text without retaining content',()=>{
    let clock=0;const m=createQualityMetrics(()=>clock);clock=10;m.event();clock=40;m.text();clock=70;m.text();m.request(1000,5);
    assert.equal(m.snapshot().firstProviderEventMs,10);assert.equal(m.snapshot().firstAnswerTextMs,40);assert.equal(m.snapshot().lastAnswerTextMs,70);assert(!JSON.stringify(m.snapshot()).includes('prompt'));
  });
  await check('native resources enforce single writer, exact file invalidation, scope, idle and pressure eviction',()=>{
    const stateRoot=path.join(output,'native-resources');fs.mkdirSync(stateRoot);let now=1,rss=0;
    const pool=createNativeSessionResources({idleMs:100,maxIdle:1,now:()=>now,rss:()=>rss,maxRss:1000});
    const input={sessionDir:stateRoot,workspace:output,scope:'model-A'},first=pool.acquire(input);
    first.manager.appendMessage({role:'assistant',content:[{type:'text',text:'synthetic resource fixture'}],api:'openai-completions',provider:'fixture',model:'fixture',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()});
    const file=first.manager.getSessionFile();assert(fs.existsSync(file));
    assert.throws(()=>pool.acquire({...input,file}),/busy/);first.release();
    const hot=pool.acquire({...input,file});assert(hot.hit);assert.equal(hot.manager,first.manager);hot.release();
    fs.appendFileSync(file,JSON.stringify({type:'custom',id:'external-note',parentId:hot.manager.getLeafId(),timestamp:new Date().toISOString(),customType:'fixture.external',data:{changed:true}})+'\n');
    const changed=pool.acquire({...input,file});assert(!changed.hit);assert.notEqual(changed.manager,first.manager);changed.release();
    const switched=pool.acquire({...input,file,scope:'model-B'});assert(!switched.hit);switched.release();
    now+=101;const expired=pool.acquire({...input,file,scope:'model-B'});assert(!expired.hit);expired.release();
    rss=1001;const pressure=pool.acquire({...input,file,scope:'model-B'});assert(!pressure.hit);pressure.release();assert.equal(pool.stats().idle,0);
  });
  await check('local citations bind real attachment/file line versions and reject unsafe paths or OCR drift shapes',()=>{
    const registry=createAnswerEvidence('local-run');
    for(const local of [{kind:'workspace',path:'课程/讲义.txt',version:'a'.repeat(64),locator:'text_lines',startLine:1,endLine:2},
      {kind:'attachment',id:'xiat_00000000-0000-0000-0000-000000000001',revision:2,version:'b'.repeat(64),locator:'extracted_lines',startLine:3,endLine:4},
      {kind:'attachment',id:'xiat_00000000-0000-0000-0000-000000000001',revision:2,version:'b'.repeat(64),locator:'ocr_lines',ocrRevision:3,startLine:1,endLine:2}]){
      assert(validLocalAnswerSource(local));const result=registry.attach(local.kind==='workspace'?'office_read_text':'office_read_attachment',{content:[{type:'text',text:'已实读'}],details:{success:true,data:{sources:[{title:'合成讲义',local}]}}});
      assert(result.details.data.sources[0].citationId);assert.deepEqual(result.details.data.sources[0].local,local);
      assert(!validLocalAnswerSource({...local,startLine:0}));
    }
    assert(!validLocalAnswerSource({kind:'workspace',path:'../private.txt',version:'a'.repeat(64),locator:'text_lines',startLine:1,endLine:1}));
    assert(!validLocalAnswerSource({kind:'attachment',id:'xiat_00000000-0000-0000-0000-000000000001',revision:0,version:'a'.repeat(64),locator:'ocr_lines',startLine:1,endLine:1}));
  });
  const captures=[];let stage=0,oldCalls=0,newCalls=0;const oldEvents=[],newEvents=[];
  globalThis.fetch=async(_url,init)=>{
    const body=JSON.parse(init.body);captures.push(body);
    let delta,reason='stop';
    if(stage===0){assert(!body.tools.some(t=>t.function.name===definition(29).name),'deferred schema must be absent before discovery');delta={tool_calls:[{index:0,id:'discover-1',type:'function',function:{name:'find_education_tools',arguments:JSON.stringify({query:'光学折射'})}}]};reason='tool_calls';}
    else if(stage===1){assert(body.tools.some(t=>t.function.name===definition(29).name),'newly loaded schema must reach the wire');delta={tool_calls:[{index:0,id:'read-1',type:'function',function:{name:definition(29).name,arguments:JSON.stringify({query:'折射'})}}]};reason='tool_calls';}
    else if(stage===4){delta={tool_calls:[{index:0,id:'new-read',type:'function',function:{name:'office_read_text',arguments:JSON.stringify({path:'续问.txt'})}}]};reason='tool_calls';}
    else if(stage===5){delta={tool_calls:[{index:0,id:'new-run-tool',type:'function',function:{name:definition(0).name,arguments:JSON.stringify({query:'新轮'})}}]};reason='tool_calls';}
    else {delta={content:stage===3?'本轮回答被截断，第二段尚未输出。':'依据实际工具返回，已完成合成验收。'};if(stage===3)reason='length';}
    stage++;const chunks=[{role:'assistant',content:''},delta,{}].map((d,i)=>'data: '+JSON.stringify({id:'quality-fixture',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:d,finish_reason:i===2?reason:null}]})+'\n\n').join('');
    return new Response(chunks+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
  await check('actual Pi wire loads discovered tools, routes effort/output and records numeric audit',async()=>{
    const stateRoot=path.join(output,'state'),workspace=path.join(output,'workspace');fs.mkdirSync(stateRoot);fs.mkdirSync(workspace);
    delete process.env.XIAOZHI_ANSWER_QUALITY;
    const base={stateRoot,workspace,apiKey:'synthetic-key',model:capacity.id,capabilities:capacity,mcpTools:Array.from({length:30},(_,i)=>({...definition(i),execute:async()=>{oldCalls++;return {content:[{type:'text',text:'旧轮结果'}],details:{success:true}};}})),limitsEnforced:false};
    agent=await createPiXiaozhiSession({...base,onEvent:event=>oldEvents.push(event)});
    const result=await agent.prompt('详细证明 1+1=2');assert(result.ok,JSON.stringify(result));assert.equal(captures.length,3);
    assert(captures[1].tools.length>captures[0].tools.length);
    assert.equal(captures[0].max_tokens,16384);assert.equal(captures[0].reasoning_effort,'high');assert(captures[0].tools.length<33);
    const next=await agent.prompt('你好');assert(next.ok);assert.equal(next.truncated,true,'provider output limit must be visible to the host');assert.equal(next.text,'本轮回答被截断，第二段尚未输出。','A filtered SDK projection must not substitute the previous complete answer');assert.equal(captures.at(-1).max_tokens,4096);assert.equal(captures.at(-1).thinking.type,'disabled');assert.equal(captures.at(-1).reasoning_effort,'none');
    assert.equal(agent.session.sessionManager.getEntries().filter(e=>e.customType==='xiaozhi.answer-metrics.v1').length,2);
    report.metrics.wire={firstTools:captures[0].tools.length,afterDiscovery:captures[1].tools.length,deepMaxTokens:captures[0].max_tokens,fastMaxTokens:captures.at(-1).max_tokens};
    const sessionFile=agent.sessionFile;await agent.dispose();agent=undefined;
    const beforeEvents=oldEvents.length,beforeCalls=oldCalls;
    fs.writeFileSync(path.join(workspace,'续问.txt'),'续问的第一行\n续问的第二行');
    agent=await createPiXiaozhiSession({...base,sessionFile,apiKey:'new-synthetic-key',onEvent:event=>newEvents.push(event),
      mcpTools:base.mcpTools.map(def=>({...def,execute:async()=>{newCalls++;return {content:[{type:'text',text:'新轮结果'}],details:{success:true}};}}))});
    const resumed=await agent.prompt('继续查看授权文件，并使用新轮教育工具');assert(resumed.ok);assert.equal(resumed.truncated,false);assert.equal(resumed.text,'依据实际工具返回，已完成合成验收。');
    assert.equal(agent.qualityMetrics().nativeSessionCacheHit,1);assert.equal(oldEvents.length,beforeEvents);assert.equal(oldCalls,beforeCalls);assert.equal(newCalls,1);
    const read=newEvents.find(event=>event.kind==='tool_end'&&event.tool==='office_read_text');
    assert(read?.sources?.[0]?.citationId);assert.equal(read.sources[0].local.kind,'workspace');assert.equal(read.sources[0].local.endLine,2);
    report.metrics.wire.nativeSessionCacheHit=1;report.metrics.wire.freshRunTools=true;
    await agent.dispose();agent=undefined;
  });
  report.ok=true;
}catch(error){report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;}
finally{await agent?.dispose();globalThis.fetch=originalFetch;if(originalMode===undefined)delete process.env.XIAOZHI_ANSWER_QUALITY;else process.env.XIAOZHI_ANSWER_QUALITY=originalMode;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,metrics:report.metrics,report:path.join(output,'report.json')}));}
