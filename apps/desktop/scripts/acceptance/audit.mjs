import fs from 'node:fs';import path from 'node:path';import {fingerprint,sha256,gradeAttempt,summarize} from './evidence.mjs';
const names=process.argv.slice(2);
if(names.length===2&&names[0]==='--security'){
  await captureSecurity(names[1]);
  process.exit(process.exitCode||0);
}
if(names.length===2&&names[0]==='--packages'){
  await capturePackages(names[1]);
  process.exit(process.exitCode||0);
}
if(names.length===1&&names[0]==='--baseline'){
  await captureBaseline();
  process.exit(process.exitCode||0);
}
if(!names.length||names.some(n=>!/^run-[A-Za-z0-9]+$/.test(n))||new Set(names).size!==names.length)throw new Error('Usage from apps/desktop: node scripts/acceptance/audit.mjs run-XXX run-YYY | --baseline | --packages <owned consumer> | --security <owned evidence directory>');
const attempts=[],runs=[],base=fs.realpathSync('test-results/acceptance'),caseBase=fs.realpathSync('test-results/xiaozhi-agent');let buildSha;
for(const name of names){
  const dir=fs.realpathSync(path.join(base,name));if(path.dirname(dir)!==base)throw new Error('Run must stay inside acceptance');
  const original=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
  if(fs.realpathSync(original.build.copy)!==fs.realpathSync(path.join(dir,'build')))throw new Error('Build copy must belong to this run');
  if(buildSha&&buildSha!==original.build?.sourceSha256)throw new Error('Cannot combine different builds');buildSha=original.build?.sourceSha256;
  runs.push({name,sourceBuildSha256:buildSha,sourceBuildUnchangedAtRun:original.sourceBuildUnchanged,testScriptHashesRecorded:!!original.testScripts});
  for(const item of original.attempts){
    let receipt,verified=false,error;
    try{
      const output=fs.realpathSync(item.output);if(path.dirname(output)!==caseBase)throw new Error('Case output outside owned test area');
      const reportFile=path.join(output,'report.json');receipt=JSON.parse(fs.readFileSync(reportFile,'utf8'));
      const required=item.caseId==='web'?['source-1366x768.png','source-1920x1080.png','real-moe-browser.png','visible-browser-failure.png','actual-public-error.png']:item.caseId==='ocr'?['ocr-1366.png','ocr-1920.png']:[];
      verified=required.length>0&&fs.statSync(reportFile).mtimeMs>=Date.parse(item.started)-2000&&required.every(file=>{
        const p=path.join(output,file);if(!fs.existsSync(p))return false;const stat=fs.lstatSync(p),record=(item.artifacts||[]).find(a=>path.resolve(a.file)===p);
        return stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.mtimeMs>=Date.parse(item.started)-2000&&record?.sha256===sha256(fs.readFileSync(p));
      });
    }catch(e){error=e.message;}
    const unchanged=original.sourceBuildUnchanged===true&&fingerprint(original.build.copy).sha256===buildSha;
    const grade=gradeAttempt({exitCode:item.exitCode,timedOut:item.timedOut,report:receipt,artifactsVerified:verified,buildUnchanged:unchanged,requiredAssertions:item.caseId==='web'?19:10,layer:'isolated_formal_ui'});
    attempts.push({run:name,caseId:item.caseId,attempt:item.attempt,output:item.output,grade,execution:/electron\.launch: Timeout/.test(item.error||'')&&!item.checks.length?'BLOCKED_STARTUP':grade.status,error:error||item.error||''});
  }
}
const output=fs.mkdtempSync(path.join(base,'audit-')),report={schema:1,date:new Date().toISOString(),buildSha,runs,attempts,summary:summarize(attempts,{openFeedback:['NET-USER-001','IMG-USER-001']}),boundary:'Regrading retained evidence only; not a new product run. Older run script hashes may not have been recorded. Manual/profile/VPN/vision remain unverified.'};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,summary:report.summary,attempts:attempts.map(a=>({run:a.run,caseId:a.caseId,execution:a.execution,grade:a.grade.status,checks:a.grade.assertionCount}))}));process.exitCode=report.summary.automation==='PASS'?2:1;

async function captureSecurity(evidencePath){
  const {default:assert}=await import('node:assert/strict');
  const desktop=fs.realpathSync(process.cwd()),area=fs.realpathSync(path.join(desktop,'test-results/goal'));
  const requested=path.resolve(evidencePath),evidence=fs.realpathSync(requested);
  assert.equal(requested,evidence,'Evidence directory must not be a symlink');
  assert(evidence.startsWith(area+path.sep),'Use an owned directory inside test-results/goal');
  const output=fs.mkdtempSync(path.join(evidence,'security-audit-'));
  const report={schema:1,kind:'phase0-security-inventory',started:new Date().toISOString(),success:false,output,
    scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url))),checks:[],errors:[],
    boundary:'Inventory and scoped existing boundary tests only. Vulnerabilities are NOT fixed; no exploit, Windows isolation, native JSONL confidentiality or release approval is claimed.'};
  const inputs=['npm-audit.json','dependency-paths.json','windows-acl.json'];
  const load=name=>JSON.parse(fs.readFileSync(path.join(evidence,name),'utf8').replace(/^\uFEFF/,''));
  const check=name=>report.checks.push({name,pass:true});
  try{
    report.inputs=inputs.map(name=>{const file=path.join(evidence,name);assert(!fs.lstatSync(file).isSymbolicLink());return{name,sha256:sha256(fs.readFileSync(file))};});
    const audit=load(inputs[0]),dependencies=load(inputs[1]),acl=load(inputs[2]);
    assert.equal(audit.auditReportVersion,2);assert(Array.isArray(dependencies));
    assert(audit.metadata?.vulnerabilities&&audit.vulnerabilities);
    report.counts=audit.metadata.vulnerabilities;
    // Record every actual advisory; a newly introduced package cannot silently disappear.
    const pathNotes={
      electron:'Actual main BrowserWindow and browser WebContentsView. Popup denial mitigates GHSA-gr2m-v5gq-v685 only. Remaining preload/protocol/worker advisories require a patched runtime and real regressions before release.',
      undici:'office-network uses Agent + fetch, checked DNS and manual redirects, bounded decoded response. No direct BalancedPool/SOCKS/cache/retry/decompress-interceptor use was found in this selected host; other transitive callers remain unproven. Upgrade before release.',
      mermaid:'streamdown transitive dependency. Current StreamMarkdown supplies no mermaid plugin; installed/bundled parser is not proof of active diagram execution. Future diagrams require patched parser, strict configuration and untrusted-content tests.',
      dompurify:'mermaid transitive dependency. No selected app IN_PLACE/addHook caller was found. Preserve this risk and verify patched sanitizer in actual diagram integration.',
      nanoid:'Affected 3.x instance belongs to postcss/vite tooling; docx has separate 6.x. No selected app custom generator was found; tooling still requires patch and build regression.'
    };
    report.risks=Object.entries(audit.vulnerabilities).map(([name,v])=>({name,severity:v.severity,range:v.range,nodes:v.nodes,
      fixAvailable:v.fixAvailable,advisories:v.via.map(a=>typeof a==='string'?{dependency:a}:{title:a.title,url:a.url,range:a.range,severity:a.severity}),
      instances:dependencies.filter(d=>d.name===name).map(d=>({version:d.version,location:d.location,parents:d.dependents.map(p=>p.from?.name||'desktop')})),
      status:'OPEN',reachability:pathNotes[name]||'New finding: manual path review required before release.'}));
    check('All fresh npm advisories retained with actual installed dependency paths');
    assert.equal(acl.readback,'PUBLIC-SYNTHETIC-NO-STUDENT-NO-KEY');assert(Array.isArray(acl.rules));
    report.windows={protected:acl.protected,rules:acl.rules,scope:'Owned synthetic repository file only; not the actual userData root.',
      conclusion:'Inherited ACL permits additional Windows principals; filesystem locality and mode 0600 are not Windows privacy isolation. Dedicated userData ACL and backup restore validation remain Phase7 gates.'};
    check('Actual Windows synthetic write/readback and inherited ACL retained without changing permissions');
    const sourceFiles=['src/main/index.ts','src/main/office-agent/office-network.ts','src/main/xiaozhi-agent/browser-host.ts',
      'src/main/xiaozhi-agent/browser-proxy.ts','src/main/xiaozhi-agent/pi-session.ts','src/main/xiaozhi-agent/production-host.ts',
      'src/renderer/heroui-pro/components/markdown/markdown.tsx'];
    report.sources=sourceFiles.map(file=>({file,sha256:sha256(fs.readFileSync(path.join(desktop,file)))}));
    report.logs={public:'Pi classifies failures into allowlisted codes; production terminal/SQLite event summaries use XIAOZHI_ERRORS, not provider error text.',
      private:'Native SDK JSONL keeps local transcript and may retain provider error text. No full JSONL redaction/encryption proof; do not export/upload private transcripts automatically.',
      legacy:'Old DeepTutor bounded error path remains separate and requires retirement/redaction gate. No blanket all-product log-safety claim.'};
    check('Reviewed host/source identities and public versus private logging limits recorded');
    report.success=true;
  }catch(error){report.errors.push(String(error.message).slice(0,1000));process.exitCode=1;}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,counts:report.counts,errors:report.errors}));
}

async function capturePackages(consumerPath){
  const {default:assert}=await import('node:assert/strict');
  const {spawnSync}=await import('node:child_process');
  const {pathToFileURL}=await import('node:url');
  const {build}=await import('esbuild');
  const {_electron:electron}=await import('playwright');
  const desktop=fs.realpathSync(process.cwd());
  const area=fs.realpathSync(path.join(desktop,'test-results/goal'));
  const requested=path.resolve(consumerPath),consumer=fs.realpathSync(requested);
  assert.equal(requested,consumer,'Consumer must not be a symlink');
  assert(consumer.startsWith(area+path.sep)&&path.basename(consumer)==='consumer','Use an owned consumer inside test-results/goal');
  const output=fs.mkdtempSync(path.join(path.dirname(consumer),'package-probe-'));
  const lockFile=path.join(consumer,'package-lock.json'),before=sha256(fs.readFileSync(lockFile));
  const report={schema:1,kind:'phase0-openmaic-package-seam',started:new Date().toISOString(),success:false,consumer,output,
    scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url))),lockSha256:before,checks:[],errors:[],requests:[],screenshots:[],
    boundaries:['Deterministic injected responses only; no provider, user profile, production main, credentials or system network changes.',
      'This is a package/API/rendering probe, not delivered classroom functionality, application visual acceptance or no-VPN/installer acceptance.',
      'Registry SHA512 integrity and matching version do not verify a source commit or a cryptographic provenance attestation.',
      'License inventory preserves notices; full production bundled-asset/attribution review and package-size optimization remain migration gates.']};
  const manifest=name=>JSON.parse(fs.readFileSync(path.join(consumer,'node_modules',name,'package.json'),'utf8'));
  const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
  let application;
  try{
    const inventory=JSON.parse(fs.readFileSync(path.join(path.dirname(consumer),'license-inventory.json'),'utf8'));
    assert.equal(inventory.lockSha256,before);
    assert(inventory.packages.every(p=>p.notices.length),'Inspect license notices before loading packages');
    report.inventory={packages:inventory.packages.length,installedBytes:inventory.bytes,sha256:sha256(fs.readFileSync(path.join(path.dirname(consumer),'license-inventory.json')))};
    report.packages=['dsl','generation','renderer'].map(name=>{const p=manifest('@openmaic/'+name);return{name:p.name,version:p.version,license:p.license,exports:p.exports};});
    assert.deepEqual(report.packages.map(p=>p.version),['0.11.2','0.3.15','0.1.11']);
    const lock=JSON.parse(fs.readFileSync(lockFile,'utf8'));
    assert.deepEqual(Object.keys(lock.packages).filter(k=>k.endsWith('node_modules/@openmaic/dsl')),['node_modules/@openmaic/dsl']);
    for(const name of ['generation','renderer'])assert.equal(manifest('@openmaic/'+name).dependencies['@openmaic/dsl'],'^0.11.2');
    check('Fixed packed versions, retained license inventory and one deduplicated DSL');
    // Adapted from upstream scripts/smoke-test-package-tarballs.mjs and generation/test/scene-generation.test.ts.
    const nodeProbe=path.join(output,'node-probe.mjs');
    const url=name=>pathToFileURL(path.join(consumer,'node_modules/@openmaic',name,'dist/index.js')).href;
    const probe=`import assert from 'node:assert/strict';
import {buildPrompt,PROMPT_IDS,generateSceneContent} from ${JSON.stringify(url('generation'))};
import {RUNTIME_DSL_VERSION,validateRuntimeSession} from ${JSON.stringify(url('dsl'))};
import {SlideCanvas} from ${JSON.stringify(url('renderer'))};
assert.equal(typeof RUNTIME_DSL_VERSION,'string');assert.equal(typeof validateRuntimeSession,'function');assert.equal(typeof SlideCanvas,'function');
const prompt=buildPrompt(PROMPT_IDS.REQUIREMENTS_TO_OUTLINES,{mediaEnabled:true});
assert(prompt.system.length>100);assert.match(prompt.system,/Content Safety Guidelines for Generation Prompts/);
assert.doesNotMatch(prompt.system+prompt.user,/\\{\\{snippet:/);
const outline={id:'edu-audit',type:'slide',title:'勾股定理',description:'合成教学材料',keyPoints:['本地资源'],order:1};
let calls=0;const content=await generateSceneContent(outline,async(system,user)=>{calls++;assert(system.length>100);assert(user.length>50);return JSON.stringify({elements:[{type:'text',left:60,top:55,width:850,height:110,content:'<p style="font-size:40px">勾股定理 · 离线组件核验</p>'},{type:'text',left:60,top:210,width:850,height:170,content:'<p style="font-size:28px">直角三角形：3² + 4² = 5²</p><p style="font-size:22px">公开合成内容；生成结果需要教师确认。</p>'}],background:{type:'solid',color:'#fff'}});});
assert.equal(calls,1);assert.equal(content.elements.length,2);
const quiz=await generateSceneContent({...outline,type:'quiz',quizConfig:{questionCount:1,difficulty:'easy',questionTypes:['single']}},async()=>JSON.stringify([{type:'single',question:'直角边为3和4，斜边长度？',options:['5','7'],correctAnswer:'A'}]));
assert.deepEqual(quiz.questions[0].options,[{value:'A',label:'5'},{value:'B',label:'7'}]);assert.deepEqual(quiz.questions[0].answer,['A']);
const failures=[];assert.equal(await generateSceneContent(outline,async()=>JSON.stringify({background:{type:'solid',color:'#fff'}}),{onFailure:f=>failures.push(f)}),null);assert.deepEqual(failures,[{code:'invalid-model-output'}]);
console.log(JSON.stringify({content,quiz,checks:4,engine:process.versions}));`;
    fs.writeFileSync(nodeProbe,probe);
    const nodeRun=spawnSync(process.execPath,[nodeProbe],{cwd:output,encoding:'utf8',timeout:30000,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP}});
    fs.writeFileSync(path.join(output,'node-probe.log'),nodeRun.stdout||'');fs.writeFileSync(path.join(output,'node-probe.stderr.log'),nodeRun.stderr||'');
    assert.equal(nodeRun.status,0,nodeRun.stderr||String(nodeRun.error));
    const nodeResult=JSON.parse(nodeRun.stdout.trim().split('\n').at(-1));
    fs.writeFileSync(path.join(output,'generated.json'),JSON.stringify(nodeResult,null,2));
    check('Actual Node ESM imports, packed prompt snippets, injected slide/quiz normalization and invalid-output callback');
    const entry=path.join(output,'renderer.jsx');
    fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {SlideCanvas} from '@openmaic/renderer';import data from './generated.json';
const slide={id:'audit-slide',viewportSize:1000,viewportRatio:0.5625,theme:{backgroundColor:'#ffffff',themeColors:['#2463eb'],fontColor:'#172033',fontName:'Microsoft YaHei'},elements:data.content.elements,background:data.content.background};
window.auditClicks=[];createRoot(document.getElementById('root')).render(<main><h1>OpenMAIC 独立包接缝核验</h1><p>公开合成数据 · 无模型请求 · 非生产课堂</p><section id="canvas"><SlideCanvas slide={slide} onElementClick={e=>window.auditClicks.push(e.id)} /></section><output id="quiz">练习：{data.quiz.questions[0].question} 答案：{data.quiz.questions[0].options[0].label}</output></main>);`);
    // nodePaths is a fallback: an entry beside the consumer otherwise resolves EduDev's React first.
    const bundled=await build({entryPoints:[entry],bundle:true,format:'iife',platform:'browser',target:'chrome142',outfile:path.join(output,'renderer.js'),nodePaths:[path.join(consumer,'node_modules')],alias:{react:path.join(consumer,'node_modules/react'),'react-dom':path.join(consumer,'node_modules/react-dom')},metafile:true,minify:true,legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'}});
    fs.writeFileSync(path.join(output,'metafile.json'),JSON.stringify(bundled.metafile,null,2));
    report.bundle={bytes:fs.statSync(path.join(output,'renderer.js')).size,inputs:Object.keys(bundled.metafile.inputs).length,outputs:bundled.metafile.outputs};
    assert(!Object.keys(bundled.metafile.inputs).some(p=>/fonts\.css$/.test(p)));
    const reactInputs=Object.keys(bundled.metafile.inputs).filter(p=>/node_modules\/react(?:-dom)?\//.test(p));
    assert(reactInputs.length>0&&reactInputs.every(p=>path.resolve(desktop,p).startsWith(path.join(consumer,'node_modules')+path.sep)),'One actual React/DOM copy in the browser bundle');
    assert(!Object.keys(bundled.metafile.inputs).some(p=>/@openmaic\/generation\//.test(p)),'Node-only generation is not in renderer');
    check('Actual browser bundle resolves React/renderer peers without Node prompt modules or font CDN CSS');
    fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'"><title>教育组件审计</title><style>html,body{margin:0;font-family:'Microsoft YaHei',sans-serif;background:#edf4f3;color:#172033}main{max-width:1060px;margin:22px auto;padding:0 24px}h1{font-size:24px}p{color:#5c6774}#canvas{width:100%;aspect-ratio:16/9;background:white;border-radius:14px;box-shadow:0 8px 32px #17203314}output{display:block;margin-top:20px}</style></head><body><div id="root"></div><script src="./renderer.js"></script></body></html>`);
    const main=path.join(output,'main.cjs');
    fs.writeFileSync(main,`const {app,BrowserWindow,session}=require('electron');const path=require('node:path');
app.commandLine.appendSwitch('disable-background-networking');app.setPath('userData',path.join(__dirname,'profile'));
app.whenReady().then(async()=>{globalThis.auditRequests=[];session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{globalThis.auditRequests.push({url:details.url,method:details.method});callback({cancel:true});});
const win=new BrowserWindow({width:1366,height:768,useContentSize:true,show:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});win.setMenu(null);
session.defaultSession.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));win.webContents.setWindowOpenHandler(()=>({action:'deny'}));await win.loadFile(path.join(__dirname,'index.html'));
await import(${JSON.stringify(pathToFileURL(nodeProbe).href)});globalThis.auditNodeProbeComplete=true;}).catch(error=>{console.error(error);app.exit(1);});`);
    const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP};
    application=await electron.launch({args:[main],cwd:output,env,timeout:30000});
    const page=await application.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
    await page.getByText('勾股定理 · 离线组件核验',{exact:true}).waitFor();
    for(let attempt=0;attempt<300&&!await application.evaluate(()=>globalThis.auditNodeProbeComplete===true);attempt++)await page.waitForTimeout(100);
    assert.equal(await application.evaluate(()=>globalThis.auditNodeProbeComplete),true);
    assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
    await page.getByText('直角三角形：3² + 4² = 5²',{exact:true}).click();
    assert.equal(await page.evaluate(()=>window.auditClicks.length),1);
    check('Actual sandboxed Electron rendering and element-click callback with no renderer Node access');
    for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
      await application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),size);
      await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
      await page.waitForFunction(()=>document.getElementById('canvas').getBoundingClientRect().height>300);
      const bounds=await page.locator('#canvas').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=size.width+1&&bounds.y+bounds.height<=size.height);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const file=path.join(output,`renderer-${size.width}.png`);await page.screenshot({path:file});
      report.screenshots.push({file,viewport:size,bounds,sha256:sha256(fs.readFileSync(file))});
    }
    report.requests=await application.evaluate(()=>globalThis.auditRequests);assert.deepEqual(report.requests,[]);assert.deepEqual(report.errors,[]);
    check('Two actual native content sizes, reachable slide bounds and zero observed HTTP requests under pre-navigation blocking');
    assert.equal(sha256(fs.readFileSync(lockFile)),before);report.success=true;
  }catch(e){
    report.error=String(e.stack||e);console.error(report.error);process.exitCode=1;
    if(application){
      try{
        report.requests=await application.evaluate(()=>globalThis.auditRequests||[]);
        const page=await application.firstWindow(),file=path.join(output,'first-failure.png');
        await page.screenshot({path:file});report.failureScreenshot={file,sha256:sha256(fs.readFileSync(file))};
        report.failureVisibleText=(await page.locator('body').innerText()).slice(0,4000);
      }catch(error){report.failureCaptureError=String(error);}
    }
  }
  finally{if(application)await application.close().catch(e=>{report.closeError=String(e);report.success=false;process.exitCode=1;});report.finished=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,bundle:report.bundle?.bytes}));}
}

async function captureBaseline(){
  const {default:assert}=await import('node:assert/strict');
  const {performance}=await import('node:perf_hooks');
  const {DatabaseSync}=await import('node:sqlite');
  const {_electron:electron}=await import('playwright');
  const {testMain}=await import('./build-root.mjs');
  const desktop=fs.realpathSync(process.cwd()),repo=path.resolve(desktop,'../..');
  assert(fs.existsSync(path.join(repo,'docs/goal/XIAOZHI_CODEX_GOAL.md')),'Run from apps/desktop');
  const output=fs.mkdtempSync(path.join(desktop,'test-results/acceptance/baseline-'));
  const data=path.join(output,'data'),profile=path.join(output,'profile');
  const build=path.dirname(path.dirname(testMain(desktop))),fixed=fingerprint(build);
  const report={schema:1,kind:'goal-phase0-baseline',success:false,started:new Date().toISOString(),output,
    build:{root:build,sha256:fixed.sha256,files:fixed.files.length,bytes:fixed.files.reduce((sum,f)=>sum+fs.statSync(path.join(build,f.file)).size,0)},
    scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url))),checks:[],measurements:{launches:[],viewports:[]},
    boundaries:['Owned synthetic Electron/profile/data only; no credentials read, provider call or OS network change.',
      'Seeded public history is a local rendering/load baseline, not a Pi long-task or learning acceptance.',
      'Large-file metric is owned local I/O only, not OCR/parser/document-tool throughput.',
      'Chat/provider latency and installer performance remain unmeasured; one sample is not a stability claim.']};
  const safe=value=>String(value).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED_KEY]');
  const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
  const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return{samples:values.length,p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)]};};
  const groups={
    RUNTIME:['triplet-graph.ts'],
    DOMAIN:['education-grader.ts','error-taxonomy.ts','learning-analytics.ts','mastery-policy.ts','mastery-snapshot.ts','model-grader.ts','notebook-analysis.ts','question-notebook.ts','research-outline.ts','review-reminder.ts','review-scheduler.ts','role-profile.ts','router.ts','schema.ts','teaching-book-planner.ts','teaching-book-renderer.ts','teaching-book.ts','usability-policy.ts','vision-solver.ts','visualization.ts'],
    INFRA:['agent-harness-profile.ts','deeptutor-capability-evals.ts','deeptutor-event-bounds.ts','eval-cases.ts','evals.ts','host-tool-proxy.ts','sqlite-graph-checkpointer.ts','tool-registry.ts','usability-eval-cases.ts'],
    LEGACY:['agent-loop.ts','sidecar-client.ts']};
  let application,page,id;const errors=[];
  const close=async()=>{if(application){await application.close();application=undefined;}};
  const launch=async(kind)=>{
    const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo,DEEPSEEK_API_KEY:'',DEEPSEEK_MODEL:''};
    delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
    for(const name of Object.keys(env))if(name.startsWith('OMNI_EDU_E2E_'))delete env[name];
    // The unpackaged test gate skips loadLocalEnv; the owned cwd also has no .env.local.
    env.OMNI_EDU_E2E_DIALOG_MODE='1';
    const start=performance.now();
    application=await electron.launch({args:[testMain(desktop),`--user-data-dir=${profile}`],cwd:output,env,timeout:60000});
    page=await application.firstWindow();const firstWindowMs=performance.now()-start;
    page.on('pageerror',error=>errors.push(safe(error)));
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
    await page.getByTestId('office-prompt-input').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
    id=await page.locator('.office-composer-container').getAttribute('data-session-id');assert(id);
    report.measurements.launches.push({kind,firstWindowMs,composerReadyMs:performance.now()-start,
      navigation:await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return n?{domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd}:null;})});
    assert(await application.evaluate(()=>process.env.DEEPSEEK_API_KEY===''&&process.env.DEEPSEEK_MODEL===''));
    await page.evaluate(()=>{globalThis.baselineEvents=[];window.omniEdu.onXiaozhiEvent(event=>globalThis.baselineEvents.push(event));});
  };
  try{
    const harness=path.join(desktop,'src/main/ai-harness');
    report.harness=fs.readdirSync(harness).filter(file=>file.endsWith('.ts')).sort().map(file=>{
      const category=Object.entries(groups).find(([,files])=>files.includes(file))?.[0];assert(category,`Unclassified Harness file ${file}`);
      const source=fs.readFileSync(path.join(harness,file),'utf8');return{file,category,sha256:sha256(source),lines:source.split('\n').length,
        exports:[...source.matchAll(/^export (?:async )?(?:function|class|const) ([A-Za-z0-9_]+)/gm)].map(m=>m[1]),
        decision:category==='RUNTIME'?'replace orchestration after domain adapter and resume tests':category==='LEGACY'?'preserve domain/transport seam; retire old entry after replacement':'preserve; extract domain and permission concerns through adapters'};
    });
    assert.equal(report.harness.length,Object.values(groups).flat().length);check('All existing Harness source files have explicit classification and source identities');
    const manifest=JSON.parse(fs.readFileSync(path.join(desktop,'package.json'),'utf8'));
    const layers={unit:[],domain:[],integration:[],electron:[],provider:[],other:[]};
    for(const [name,command]of Object.entries(manifest.scripts).filter(([name])=>name.startsWith('test:'))){
      const layer=/renderer-components|boundary|protocol|state/.test(name)?'unit':/live|deepseek$|ai-provider/.test(name)?'provider':/ui|electron|smoke$/.test(name)?'electron':/host|bridge|proxy|crash|recovery|checkpoint/.test(name)?'integration':/mastery|scheduler|analytics|notebook|book|taxonomy|grader|eval/.test(name)?'domain':'other';
      layers[layer].push({name,command,executedThisBaseline:false});
    }
    report.testInventory={layers,note:'Script-name triage only; each selected suite must still be inspected for real coverage. No blanket passing claims.'};
    check('Existing test commands mapped without executing or relabelling them as passed');
    await launch('fresh');
    await page.getByTestId('xiaozhi-pi-status').filter({hasText:'等待提问'}).waitFor();
    assert.equal(await page.getByTestId('xiaozhi-pi-status').getAttribute('data-state'),'idle');
    check('Fresh actual workspace reports idle rather than completed');
    // Keyboard users receive the same purpose label as pointer users; Escape
    // dismisses the overlay without activating navigation or abandoning a run.
    await page.getByTestId('pi-rail-chats').focus();
    await page.getByRole('tooltip').filter({hasText:'会话侧栏'}).waitFor();
    assert(await page.getByTestId('pi-rail-chats').evaluate(e=>e.matches(':focus-visible')));
    await page.keyboard.press('Escape');await page.getByRole('tooltip').waitFor({state:'hidden'});
    assert(await page.getByTestId('pi-rail-chats').evaluate(e=>e===document.activeElement));
    await page.getByTestId('office-prompt-input').focus();
    check('Real OSS tooltip opens on keyboard focus and Escape closes it without losing focus');
    const samples=[];
    for(let i=0;i<20;i++){const start=performance.now();await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);samples.push(performance.now()-start);}
    report.measurements.snapshotIpc=summarize(samples);
    report.measurements.processMemory=await application.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,memory:m.memory})));
    check('Actual Electron launch, composer readiness, snapshot IPC and process memory measured on the owned profile');
    let seededId;
    const seedStart=performance.now();
    seededId=await page.evaluate(async()=>{
      const detail=await window.omniEdu.createAiConversationSession({title:'合成长对话基线'});
      for(let i=1;i<=100;i++){
        await window.omniEdu.appendAiConversationMessage(detail.session.id,{role:'user',content:`合成用户任务 ${i}：${'请核对教学材料与可追溯来源。'.repeat(40)}`});
        await window.omniEdu.appendAiConversationMessage(detail.session.id,{role:'assistant',content:`合成答复 ${i}：${'教师核验后再用于课堂。'.repeat(40)}`});
      }
      return detail.session.id;
    });
    report.measurements.historySeed={messages:200,via:'existing typed local conversation APIs',durationMs:performance.now()-seedStart};
    await page.reload();await page.getByTestId('xiaozhi-pi-workspace').waitFor();
    const openStart=performance.now();await page.getByTestId(`ai-conversation-session-${seededId}`).click();
    await page.getByTestId('office-conversation').getByText(/合成答复 100：/).waitFor({timeout:60000});
    report.measurements.historyOpenMs=performance.now()-openStart;id=seededId;
    await page.getByTestId('xiaozhi-pi-status').filter({hasText:'历史记录'}).waitFor();
    assert.equal(await page.getByTestId('xiaozhi-pi-status').getAttribute('data-state'),'history');
    check('Actual typed-API legacy history is not presented as new execution success');
    const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
    try{
      const rows=db.prepare('SELECT COUNT(*) AS count FROM ai_conversation_messages WHERE session_id=?').get(seededId);assert.equal(rows.count,200);
      const timings=[];for(let i=0;i<25;i++){const start=performance.now();db.prepare('SELECT role,content FROM ai_conversation_messages WHERE session_id=? ORDER BY created_at').all(seededId);timings.push(performance.now()-start);}
      report.measurements.sqliteHistory={messages:rows.count,...summarize(timings)};
    }finally{db.close();}
    check('Synthetic 200-message history opens in the actual workspace and persists in readonly SQLite');
    for(const size of[{width:1366,height:768},{width:1920,height:1080}]){
      await application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),size);
      await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,size);
      const measurements=await page.evaluate(()=>{const box=document.querySelector('[data-testid="office-prompt-input"]').getBoundingClientRect();return{width:innerWidth,height:innerHeight,bodyWidth:document.documentElement.clientWidth,bodyScroll:document.documentElement.scrollWidth,composer:{x:box.x,y:box.y,right:box.right,bottom:box.bottom}};});
      assert(measurements.bodyScroll<=measurements.bodyWidth+1);assert(measurements.composer.x>=0&&measurements.composer.y>=0&&measurements.composer.right<=size.width&&measurements.composer.bottom<=size.height);
      const file=`chat-history-${size.width}.png`;await page.screenshot({path:path.join(output,file)});report.measurements.viewports.push({...measurements,file});
    }
    check('Actual long-history workspace captured at both required native content sizes with reachable composer');
    report.measurements.glass=[];
    const inspectTheme=async()=>page.evaluate(()=>{
      const root=document.querySelector('[data-testid="xiaozhi-pi-workspace"]');
      const text=document.querySelector('.office-turn [data-slot="markdown"] p');
      const paper=document.querySelector('.office-conversation');
      const style=getComputedStyle(root),ink=getComputedStyle(text).color,bg=getComputedStyle(paper).backgroundColor;
      const luminance=color=>{
        const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
        return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
      };
      const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const user=document.querySelector('.office-turn [data-slot="chat-message-user"] [data-slot="markdown"] p');
      const bubble=document.querySelector('.office-turn [data-slot="chat-message-bubble"]');
      const title=document.querySelector('[data-slot="chat-list-view-item-content"].active [data-slot="chat-list-view-title"]');
      return{scheme:style.colorScheme,ink,bg,contrast:contrast(ink,bg),
        userContrast:contrast(getComputedStyle(user).color,getComputedStyle(bubble).backgroundColor),
        titleContrast:contrast(getComputedStyle(title).color,getComputedStyle(paper).backgroundColor),
        mutedContrast:contrast(getComputedStyle(document.querySelector('[data-testid="xiaozhi-pi-status"]')).color,getComputedStyle(paper).backgroundColor),
        blur:getComputedStyle(document.querySelector('.ai-chat-header')).backdropFilter,
        reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
        animation:getComputedStyle(document.querySelector('.pi-icon-rail button')).animationDuration,
        transition:getComputedStyle(document.querySelector('.pi-icon-rail button')).transitionDuration};
    });
    await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
    const light=await inspectTheme();assert.equal(light.scheme,'light');assert(light.contrast>=4.5&&light.mutedContrast>=4.5&&light.userContrast>=4.5&&light.titleContrast>=4.5);assert(light.blur.includes('blur'));assert(light.reducedMotion&&light.animation==='0s'&&light.transition==='0s');
    report.measurements.glass.push(light);
    await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
    const dark=await inspectTheme();report.measurements.glass.push(dark);assert.equal(dark.scheme,'dark');assert(dark.contrast>=4.5&&dark.mutedContrast>=4.5&&dark.userContrast>=4.5&&dark.titleContrast>=4.5);assert.notEqual(dark.bg,light.bg);
    for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
      await application.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),size);
      await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
      const send=await page.locator('.office-composer [data-slot="prompt-input-send"]').boundingBox();assert(send&&send.x>=0&&send.x+send.width<=size.width&&send.y+send.height<=size.height);
      await page.screenshot({path:path.join(output,`chat-dark-${size.width}.png`),animations:'disabled'});
    }
    check('Actual light/dark reading text exceeds 4.5 contrast with reduced motion and pinned composer at both sizes');
    await page.emulateMedia({colorScheme:'light',forcedColors:'active'});
    const forced=await page.evaluate(()=>({active:matchMedia('(forced-colors: active)').matches,blur:getComputedStyle(document.querySelector('.ai-chat-header')).backdropFilter}));
    report.measurements.forcedColors=forced;assert(forced.active&&forced.blur==='none');
    await page.getByTestId('pi-rail-chats').focus();assert(await page.getByTestId('pi-rail-chats').evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
    await page.screenshot({path:path.join(output,'chat-forced-colors.png'),animations:'disabled'});
    check('Actual forced-colors mode removes blur and retains visible keyboard focus');
    await page.emulateMedia({colorScheme:'light',forcedColors:'none',reducedMotion:'no-preference'});
    await page.getByTestId('office-prompt-input').focus();
    report.boundaries.push('System dark/reduced-motion/forced-colors are browser emulation on the actual build; OS theme menus, unsupported-backdrop runtime and real task/approval visuals are not covered here.');
    await close();await launch('cold-history');await page.getByTestId(`ai-conversation-session-${seededId}`).click();await page.getByTestId('office-conversation').getByText(/合成答复 100：/).waitFor();
    await page.getByTestId('xiaozhi-pi-status').filter({hasText:'历史记录'}).waitFor();
    assert.equal(await page.getByTestId('xiaozhi-pi-status').getAttribute('role'),'status');
    check('Cold restored history retains honest live-region status');
    assert.equal((await page.evaluate(()=>globalThis.baselineEvents)).filter(e=>e.kind==='tool_start').length,0);
    check('Cold restart restores seeded history; no tool events observed after composer readiness');
    const fixture=path.join(output,'owned-8MiB.txt');fs.writeFileSync(fixture,Buffer.alloc(8*1024*1024,65));
    const fileTimings=[];for(let i=0;i<5;i++){const start=performance.now();assert.equal(fs.readFileSync(fixture).length,8*1024*1024);fileTimings.push(performance.now()-start);}
    report.measurements.largeFileIo={bytes:8*1024*1024,...summarize(fileTimings),boundary:'Node local file I/O, not parser or model throughput'};
    report.measurements.chatProviderLatency={status:'UNMEASURED',reason:'No credentials or provider requests in this offline baseline'};
    assert.deepEqual(errors,[]);assert.equal(fingerprint(build).sha256,fixed.sha256);
    check('Owned local large-file I/O measured, build unchanged and renderer exceptions absent');report.success=true;
  }catch(error){report.error=safe(error.stack||error).slice(0,2400);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
  finally{
    await close().catch(error=>{report.cleanupError=safe(error);report.success=false;process.exitCode=1;});
    report.finished=new Date().toISOString();report.rendererErrors=errors;
    report.artifacts=fs.readdirSync(output).filter(name=>name.endsWith('.png')).map(file=>({file,sha256:sha256(fs.readFileSync(path.join(output,file)))}));
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,error:report.error}));
  }
}
