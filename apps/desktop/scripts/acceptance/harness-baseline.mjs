import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fingerprint,sha256} from './evidence.mjs';
import {createSamples} from './create-samples.mjs';
import {HARNESS_CASES,validateHarnessReport,appendAttempt,redact} from './harness-evidence.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(process.cwd()!==desktop)throw new Error('Run from apps/desktop');
const parent=path.join(desktop,'test-results/acceptance');fs.mkdirSync(parent,{recursive:true});
const output=fs.mkdtempSync(path.join(parent,'harness-baseline-')),build=path.join(output,'build');
const report={schema:'xiaozhi.harness-baseline.v1',started:new Date().toISOString(),output,
 overall:'NOT_ACCEPTED',dailyAccepted:false,vpnOffAccepted:false,userFailuresClosed:false,
 feedback:['NET-USER-001','IMG-USER-001'],environment:{node:process.version,credentialSource:'existing ignored .env.local; value never recorded',profile:'fresh owned test profile; not daily settings',model:'deepseek-flash selected by existing suites',vpn:'UNKNOWN; no system changes',sourceBuildCorrespondence:'UNKNOWN; source and built files captured independently; no claim daily process loads this digest',nativeChooser:'controlled native dialog responses in tests; manual chooser unverified'},
 cases:HARNESS_CASES.map(id=>({id,status:'UNVERIFIED',layer:'C',synthetic:true,modelJudged:false})),attempts:[]};
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const suites=[
 {name:'network',script:'pi-browser-delivery-ui-smoke.mjs',prefix:'pi-browser-delivery-',cases:{'NET-01':[/Exact NET-01 natural input actually searches/,/Final NET-01 distinguishes/],'NET-02':[/Exact NET-02 natural input opens real internal/,/Delivered capture matches actual/]}},
 {name:'vision',script:'pi-public-image-ui-smoke.mjs',prefix:'pi-public-image-ui-',cases:{'IMG-04':[/Natural teacher prompt selects real image tool/,/genuine|actual.*image|visual|vision|strict/i]}},
 {name:'file',script:'pi-natural-file-ui-smoke.mjs',prefix:'pi-natural-file-',cases:{'FILE-01':[/FILE-01|attachment.*code|attachment.*body/i]}}
];
let fixed;
async function child(script,env){return new Promise(resolve=>{
 const proc=spawn(process.execPath,[script],{cwd:desktop,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='',timedOut=false;
 const add=b=>{log=(log+redact(b)).slice(-2000000);};proc.stdout.on('data',add);proc.stderr.on('data',add);proc.once('error',e=>add(e.stack));
 const timer=setTimeout(()=>{timedOut=true;if(proc.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else proc.kill('SIGTERM');}},600000);
 proc.once('close',exitCode=>{clearTimeout(timer);resolve({exitCode,timedOut,log});});
});}
try{
 console.log('BASELINE '+output);
 const sourceFiles=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw new Error('No source symlinks');if(e.isDirectory())walk(p);else if(e.isFile())sourceFiles.push({file:path.relative(desktop,p).replaceAll('\\','/'),sha256:sha256(fs.readFileSync(p))});}}
 walk(path.join(desktop,'src'));for(const file of ['package.json','package-lock.json','electron.vite.config.ts'])sourceFiles.push({file,sha256:sha256(fs.readFileSync(file))});
 fs.writeFileSync(path.join(output,'source.json'),JSON.stringify({sha256:sha256(JSON.stringify(sourceFiles)),files:sourceFiles},null,2));
 fixed=fingerprint(path.join(desktop,'out'));fs.cpSync(path.join(desktop,'out'),build,{recursive:true,errorOnExist:true,force:false});
 report.build={sha256:fixed.sha256,files:fixed.files.length,root:build,source:path.join(desktop,'out'),unchanged:fingerprint(build).sha256===fixed.sha256};
 if(!report.build.unchanged||fingerprint(path.join(desktop,'out')).sha256!==fixed.sha256)throw new Error('Build changed during freeze');
 fs.writeFileSync(path.join(output,'build.json'),JSON.stringify(fixed,null,2));
 report.environment.dns=await Promise.all(['api.deepseek.com','www.moe.gov.cn','cn.bing.com'].map(async host=>{try{return{host,addresses:await dns.lookup(host,{all:true})};}catch(e){return{host,error:redact(e.message)};}}));
 const samples=await createSamples(path.join(output,'samples'));
 const answers=JSON.parse(fs.readFileSync(path.join(samples,'答案.json'))),fixture=path.join(output,'vision-fixture');fs.mkdirSync(fixture);
 fs.copyFileSync(path.join(samples,'02-公开视觉.png'),path.join(fixture,'prompt-public-synthetic.png'));
 fs.copyFileSync(path.join(samples,'02-公开视觉.png'),path.join(fixture,'tool-public-synthetic.png'));
 fs.writeFileSync(path.join(fixture,'report.json'),JSON.stringify({synthetic:true,source:'independent generated ground truth, never a model answer',promptAnswer:JSON.stringify(answers.vision),toolAnswer:JSON.stringify(answers.vision)}));
 report.samples={root:samples,answerFile:'答案.json',answerNeverAttached:true,files:answers.files};write();
 for(const suite of suites){
  const script=path.join(desktop,'scripts/xiaozhi-agent',suite.script),scriptHash=sha256(fs.readFileSync(script)),caseParent=path.join(desktop,'test-results/xiaozhi-agent'),before=new Set(fs.readdirSync(caseParent)),start=Date.now();
  console.log('START '+suite.name);
  const result=await child(script,{...process.env,OMNI_EDU_TEST_BUILD_ROOT:build,OMNI_EDU_TEST_IMAGE_FIXTURE_ROOT:fixture});
  fs.writeFileSync(path.join(output,suite.name+'.log'),result.log);
  const fresh=fs.readdirSync(caseParent).filter(name=>name.startsWith(suite.prefix)&&!before.has(name));let original,caseOutput,error,artifacts=[];
  try{
   if(fresh.length!==1)throw new Error('No unambiguous fresh suite report');caseOutput=fs.realpathSync(path.join(caseParent,fresh[0]));
   if(path.dirname(caseOutput)!==fs.realpathSync(caseParent))throw new Error('Suite output outside owned test area');
   const file=path.join(caseOutput,'report.json');if(fs.statSync(file).mtimeMs<start-2000)throw new Error('Stale suite report');original=JSON.parse(fs.readFileSync(file));
   for(const name of fs.readdirSync(caseOutput).filter(n=>n==='report.json'||n.endsWith('.png'))){const f=path.join(caseOutput,name),stat=fs.lstatSync(f);if(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.mtimeMs>=start-2000)artifacts.push({file:f,bytes:stat.size,sha256:sha256(fs.readFileSync(f))});}
  }catch(e){error=redact(e.message);}
  const suiteValid=result.exitCode===0&&!result.timedOut&&original?.success===true&&original?.build?.sha256===fixed.sha256&&original?.scriptSha256===scriptHash&&sha256(fs.readFileSync(script))===scriptHash;
  for(const [id,patterns]of Object.entries(suite.cases)){
   const assertions=(original?.checks||[]).filter(c=>patterns.some(re=>re.test(c.name)));
   const coverage=patterns.every(re=>assertions.some(c=>re.test(c.name)&&c.pass===true&&!c.skipped));
   const pass=suiteValid&&coverage&&artifacts.some(a=>a.file.endsWith('.png'));
   Object.assign(report.cases.find(c=>c.id===id),{status:pass?'PASS':result.timedOut?'BLOCKED':'FAIL',buildSha256:fixed.sha256,scriptSha256:scriptHash,assertions,artifacts,output:caseOutput,reason:pass?'suite, fixed build, source-bound checks and independent artifact readback':redact(error||original?.error||'suite/coverage proof incomplete')});
  }
  const attempt={suite:suite.name,started:new Date(start).toISOString(),durationMs:Date.now()-start,exitCode:result.exitCode,timedOut:result.timedOut,output:caseOutput,cases:Object.keys(suite.cases).map(id=>({...report.cases.find(c=>c.id===id)})),error:redact(error||original?.error||'')};
  appendAttempt(output,attempt);report.attempts.push(attempt);write();console.log(JSON.stringify({suite:suite.name,exitCode:result.exitCode,cases:attempt.cases.map(c=>({id:c.id,status:c.status})),error:attempt.error.slice(0,250)}));
 }
}catch(e){report.runnerError=redact(e.stack);console.log('BASELINE INCOMPLETE '+redact(e.message));}
finally{
 report.finished=new Date().toISOString();if(fixed)report.build.unchanged=fingerprint(build).sha256===fixed.sha256;
 report.validation=validateHarnessReport(report,{readArtifacts:true,evidenceRoot:path.join(desktop,'test-results')});write();
 fs.writeFileSync(path.join(output,'验收报告.md'),`# H01 当前基线\n\n整体NOT_ACCEPTED；用户原故障仍开放，日常配置与无VPN条件未验证。\n\n构建${report.build?.sha256||'未知'}。案例结果：\n\n${report.cases.map(c=>`- ${c.id}：${c.status}；${c.reason||'未执行'}`).join('\n')}\n\n报告证据校验${report.validation.valid?'通过':'未通过'}；不是应用功能全部通过。首次失败见attempts.jsonl。下一H02验证契约，H06视觉能力/链路，H10日常同环境验收。\n`);
 console.log(JSON.stringify({output,cases:report.cases.map(c=>({id:c.id,status:c.status})),validation:report.validation,overall:report.overall}));
 process.exitCode=report.runnerError||!report.validation.valid?1:report.cases.every(c=>c.status==='PASS')?2:1;
}
