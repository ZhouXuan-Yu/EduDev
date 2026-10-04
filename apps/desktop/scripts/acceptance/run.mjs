import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import dns from 'node:dns/promises';
import {fingerprint,sha256,gradeAttempt,summarize} from './evidence.mjs';import {createSamples} from './create-samples.mjs';
const desktop=process.cwd();
if(!fs.existsSync('scripts/xiaozhi-agent/pi-web-ui-smoke.mjs'))throw new Error('Run from apps/desktop');
const args=process.argv.slice(2),selected=args.find(x=>x.startsWith('--cases='))?.slice(8).split(',')||['web','ocr'];
const repeat=Number(args.find(x=>x.startsWith('--repeat='))?.slice(9)||1);
if(args.some(x=>!/^--(?:cases|repeat)=/.test(x))||!Number.isInteger(repeat)||repeat<1||repeat>5||selected.some(x=>!['web','ocr'].includes(x))||new Set(selected).size!==selected.length)throw new Error('Usage: node scripts/acceptance/run.mjs --cases=web,ocr --repeat=1 (repeat 1..5)');
const safe=s=>String(s).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED_KEY]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [REDACTED]');
fs.mkdirSync('test-results/acceptance',{recursive:true});fs.mkdirSync('test-results/xiaozhi-agent',{recursive:true});
const output=fs.mkdtempSync(path.resolve('test-results/acceptance/run-')),build=path.join(output,'build'),started=new Date().toISOString();
const report={schema:1,started,output,selected,repeat,scope:'Pinned everyday out; isolated formal UI only',environment:{node:process.version,platform:process.platform,credentialSource:'local ignored .env.local; key not recorded',profile:'new synthetic profile, not current user profile',modelOverride:'web official directory prefers deepseek-flash; OCR deepseek-flash',networkSettings:'new-profile defaults; test changes only owned settings',vpn:'UNKNOWN; no OS network changes',nativeDialog:'OCR file picker intercepted; manual native dialog pending',externalOpener:'source opener intercepted; actual external browser pending'},attempts:[],manual:'UNVERIFIED',feedback:['NET-USER-001','IMG-USER-001']};
let sourceFingerprint;
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const scripts={web:'scripts/xiaozhi-agent/pi-web-ui-smoke.mjs',ocr:'scripts/xiaozhi-agent/pi-attachment-ocr-ui-smoke.mjs'};
report.testScripts=Object.fromEntries([...Object.values(scripts),'scripts/acceptance/run.mjs','scripts/acceptance/evidence.mjs','scripts/acceptance/create-samples.mjs'].map(file=>[file,sha256(fs.readFileSync(file))]));
const prefixes={web:'pi-web-ui-',ocr:'pi-attachment-ocr-ui-'};
async function child(script,env){return new Promise(resolve=>{
  const proc=spawn(process.execPath,[script],{cwd:desktop,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;
  proc.stdout.on('data',b=>{stdout+=safe(b);if(stdout.length>2e6)stdout=stdout.slice(-2e6);});
  proc.stderr.on('data',b=>{stderr+=safe(b);if(stderr.length>2e6)stderr=stderr.slice(-2e6);});
  const timer=setTimeout(()=>{timedOut=true;if(proc.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else proc.kill('SIGTERM');}},600000);
  proc.once('error',error=>{stderr+=safe(error);});
  proc.once('close',(exitCode,signal)=>{clearTimeout(timer);resolve({stdout,stderr,exitCode,signal,timedOut});});
});}
try {
  console.log('Acceptance evidence: '+output);
  sourceFingerprint=fingerprint(path.resolve('out'));fs.cpSync('out',build,{recursive:true,force:false,errorOnExist:true});
  report.build={source:path.resolve('out'),copy:build,sourceSha256:sourceFingerprint.sha256,copySha256:fingerprint(build).sha256,fileCount:sourceFingerprint.files.length,mainSha256:sha256(fs.readFileSync(path.join(build,'main/index.js'))),sourceBuildTime:fs.statSync('out/main/index.js').mtime.toISOString(),note:'This pins built assets; it does not prove latest source or saved user configuration'};
  if(report.build.sourceSha256!==report.build.copySha256)throw new Error('Build changed during copy');
  report.environment.dns=await Promise.all(['api.deepseek.com','www.moe.gov.cn','cn.bing.com'].map(async host=>{try{return{host,addresses:await dns.lookup(host,{all:true})};}catch(e){return{host,error:safe(e.message)};}}));
  const samples=await createSamples(path.join(output,'samples'));report.samples=samples;write();
  for(let attempt=1;attempt<=repeat;attempt++)for(const caseId of selected){
    const startMs=Date.now(),before=new Set(fs.readdirSync('test-results/xiaozhi-agent'));
    console.log(`START ${caseId} attempt ${attempt}/${repeat}`);
    const env={...process.env,OMNI_EDU_TEST_BUILD_ROOT:build,OMNI_EDU_TEST_OCR_IMAGE:path.join(samples,'01-打印文字.png')};
    const result=await child(scripts[caseId],env);
    fs.writeFileSync(path.join(output,`${caseId}-${attempt}.log`),result.stdout+'\n'+result.stderr);
    let receipt;for(const line of result.stdout.split(/\r?\n/)){try{const parsed=JSON.parse(line);if(parsed.output)receipt=parsed;}catch{}}
    const candidates=fs.readdirSync('test-results/xiaozhi-agent').filter(name=>name.startsWith(prefixes[caseId])&&!before.has(name));
    let caseOutput=receipt?.output;if(!caseOutput&&candidates.length===1)caseOutput=path.resolve('test-results/xiaozhi-agent',candidates[0]);
    let original,artifacts=[],artifactsVerified=false,error;
    try {
      if(!caseOutput)throw new Error('No unambiguous fresh output');
      const absolute=fs.realpathSync(caseOutput),parent=fs.realpathSync('test-results/xiaozhi-agent');
      if(path.dirname(absolute)!==parent||!path.basename(absolute).startsWith(prefixes[caseId])||before.has(path.basename(absolute)))throw new Error('Output is outside current owned case');
      const reportFile=path.join(absolute,'report.json');
      if(fs.statSync(reportFile).mtimeMs<startMs-2000)throw new Error('Stale report');
      original=JSON.parse(fs.readFileSync(reportFile,'utf8'));
      const required=caseId==='web'?['source-1366x768.png','source-1920x1080.png','real-moe-browser.png','visible-browser-failure.png','actual-public-error.png']:['ocr-1366.png','ocr-1920.png'];
      artifacts=required.filter(file=>fs.existsSync(path.join(absolute,file))).map(file=>{const p=path.join(absolute,file),stat=fs.lstatSync(p);if(!stat.isFile()||stat.isSymbolicLink()||stat.mtimeMs<startMs-2000)throw new Error('Artifact stale or not owned file');return{file:p,size:stat.size,sha256:sha256(fs.readFileSync(p))};});
      artifactsVerified=!!receipt&&receipt.success===true&&artifacts.length===required.length&&artifacts.every(x=>x.size>0);
    }catch(e){error=safe(e.message);}
    const unchanged=fingerprint(build).sha256===sourceFingerprint.sha256&&fingerprint(path.resolve('out')).sha256===sourceFingerprint.sha256;
    const scriptUnchanged=Object.entries(report.testScripts).every(([file,hash])=>sha256(fs.readFileSync(file))===hash);
    const evidence={exitCode:result.exitCode,timedOut:result.timedOut,report:original,artifactsVerified,buildUnchanged:unchanged,scriptUnchanged,requiredAssertions:caseId==='web'?19:10,layer:'isolated_formal_ui'};
    const item={caseId,attempt,started:new Date(startMs).toISOString(),durationMs:Date.now()-startMs,output:caseOutput,exitCode:result.exitCode,timedOut:result.timedOut,model:original?.model||(caseId==='ocr'?'deepseek-flash':'UNKNOWN'),error:error||safe(original?.error||''),checks:original?.checks||[],boundaries:original?.boundaries||[],artifacts,grade:gradeAttempt(evidence)};
    item.execution=/electron\.launch: Timeout/.test(item.error)&&!item.checks.length?'BLOCKED_STARTUP':item.grade.status;
    report.attempts.push(item);write();console.log(`${item.grade.status} ${caseId} (${item.grade.assertionCount} assertions); first failure retained`);
  }
}catch(e){report.runnerError=safe(e.stack||e);console.log('EVIDENCE INCOMPLETE: '+safe(e.message));}
finally {
  try{report.sourceBuildUnchanged=!!sourceFingerprint&&fingerprint(path.resolve('out')).sha256===sourceFingerprint.sha256;}catch{report.sourceBuildUnchanged=false;}
  if(!report.sourceBuildUnchanged)for(const a of report.attempts){a.grade={...a.grade,status:'FAIL',reasons:[...a.grade.reasons,'SOURCE_BUILD_CHANGED']};}
  report.finished=new Date().toISOString();report.summary=summarize(report.attempts,{requiredCases:['web','ocr'],requiredRepeats:repeat,openFeedback:report.feedback});write();
  report.selectedAutomation=report.attempts.length===selected.length*repeat&&report.attempts.every(a=>a.grade.status==='PASS')?'PASS':'FAIL_OR_INCOMPLETE';
  report.previousFailures=[];
  for(const dir of fs.readdirSync('test-results/acceptance').filter(x=>/^run-[A-Za-z0-9]+$/.test(x)&&path.resolve('test-results/acceptance',x)!==output)){
    try{const previous=JSON.parse(fs.readFileSync(path.resolve('test-results/acceptance',dir,'report.json'),'utf8'));
      if(previous.build?.sourceSha256===report.build?.sourceSha256&&previous.started<started)for(const item of previous.attempts||[])if(item.grade?.status==='FAIL')report.previousFailures.push({run:dir,caseId:item.caseId,attempt:item.attempt,output:item.output});
    }catch{/* Invalid older receipts never count as a pass. */}
  }
  if(report.previousFailures.length){report.summary.status='NOT_ACCEPTED';report.summary.repeatStatus='HAS_RECORDED_FAILURES';report.summary.reasons.push('SAME_BUILD_PRIOR_FAILURES');}
  write();
  const rows=report.attempts.map(a=>`| ${a.caseId} | ${a.attempt} | ${a.grade.status} | ${a.exitCode} | ${a.grade.assertionCount} | ${a.output||'无有效报告'} |`).join('\n');
  fs.writeFileSync(path.join(output,'验收报告.md'),`# 小智测试证据报告\n\n时间：${started}\n\n整体：**${report.summary.status}**。隔离自动实例：${report.summary.automation}；稳定性：${report.summary.repeatStatus}。用户两项失败仍待相同环境复现；人工验收、无VPN、日常保存配置、正式视觉未在本轮验证。\n\n构建SHA：${report.build?.sourceSha256||'未知'}；原out保持：${report.sourceBuildUnchanged}。\n\n| 案例 | 次数 | 自动状态 | 退出码 | 断言数 | 原始证据 |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n\n## 条件差异\n\n新profile；本地env凭证；显式测试模型；OCR对话框与系统打开来源有测试拦截；当前网络/VPN未知。自动通过不关闭用户反馈。完整边界及首次失败见同目录report.json；日志不含API Key。\n\n${report.runnerError?'## 运行阻塞\n\n'+safe(report.runnerError)+'\n':''}## 下一步\n\n按根测试样例说明书在日常旧会话核NET-01/IMG-01/IMG-04；提交人工记录和脱敏截图。不得把同轮未执行样例计为通过。退出2表示待人工验收，退出1表示自动失败/证据不完整。\n`);
  console.log(JSON.stringify({output,status:report.summary.status,automation:report.summary.automation,selectedAutomation:report.selectedAutomation,missing:report.summary.missing,previousFailures:report.previousFailures,sourceBuildUnchanged:report.sourceBuildUnchanged}));
  process.exitCode=report.runnerError||report.summary.automation!=='PASS'?1:2;
}
