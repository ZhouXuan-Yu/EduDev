import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {fingerprint,sha256,gradeAttempt} from './evidence.mjs';import {createSamples} from './create-samples.mjs';
const root=process.cwd(),build=fs.realpathSync(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
if(build!==path.join(root,'out')&&!build.startsWith(path.join(root,'test-results')+path.sep))throw new Error('Only owned build');
const suites={
 web:{script:'pi-web-ui-smoke.mjs',prefix:'pi-web-ui-',cases:['NET-01','NET-02','NET-03','NET-04','VIEW-01','VIEW-02'],min:19},
 ocr:{script:'pi-attachment-ocr-ui-smoke.mjs',prefix:'pi-attachment-ocr-ui-',cases:['IMG-01','IMG-02','IMG-03','VIEW-01'],min:10},
 vision:{script:'pi-public-image-ui-smoke.mjs',prefix:'pi-image-views-ui-',args:['test-results/xiaozhi-agent/pi-browser-ui-uY2Gak/data','--views'],cases:['IMG-04','IMG-05','VIEW-01','VIEW-02'],min:17},
 attachments:{script:'pi-attachment-read-ui-smoke.mjs',prefix:'pi-attachment-read-ui-',cases:['FILE-01'],min:1},
 files:{script:'pi-workspace-files-ui-smoke.mjs',prefix:'pi-files-ui-',cases:['FILE-02'],min:1},
 text:{script:'pi-text-change-ui-smoke.mjs',prefix:'pi-text-ui-',cases:['FILE-03','CTRL-03'],min:1},
 office:{script:'pi-office-artifact-ui-smoke.mjs',prefix:'pi-office-artifact-ui-',cases:['FILE-04','CTRL-03'],min:1},
 control:{script:'pi-control-ui-smoke.mjs',prefix:'pi-control-ui-',cases:['CTRL-02','CTRL-03'],min:1},
 queue:{script:'pi-queue-ui-smoke.mjs',prefix:'pi-queue-ui-',cases:['CTRL-01','CTRL-02','CTRL-03'],min:1},
 credentials:{script:'pi-credential-recovery-ui-smoke.mjs',prefix:'pi-credential-recovery-ui-',cases:['CFG-01','CFG-02'],min:1},
};
const selected=process.argv.slice(2).length?process.argv.slice(2):Object.keys(suites);if(selected.some(x=>!suites[x])||new Set(selected).size!==selected.length)throw new Error('Choose known distinct suites: '+Object.keys(suites));
fs.mkdirSync('test-results/acceptance',{recursive:true});const output=fs.mkdtempSync(path.resolve('test-results/acceptance/suites-')),initial=fingerprint(build).sha256;
const report={schema:1,started:new Date().toISOString(),build,buildSha256:initial,selected,attempts:[],manualAccepted:false,boundaries:['Formal isolated UI with synthetic local files and actual DeepSeek; no daily user-data writes','Native dialog and declared supplier/fault fixtures remain explicit; no no-VPN claim','Mappings show related coverage, not exact original user input or complete manual acceptance; first failures retained']};
const safe=s=>String(s).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED_KEY]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [REDACTED]');
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const samples=await createSamples(path.join(output,'samples'));console.log('SUITES '+output);write();
for(const name of selected){
 const suite=suites[name],script='scripts/xiaozhi-agent/'+suite.script,scriptSha=sha256(fs.readFileSync(script)),before=new Set(fs.readdirSync('test-results/xiaozhi-agent')),start=Date.now();console.log('START '+name);write();
 const env={...process.env,OMNI_EDU_TEST_BUILD_ROOT:build,OMNI_EDU_TEST_OCR_IMAGE:path.join(samples,'01-打印文字.png')};
 const result=await new Promise(resolve=>{const child=spawn(process.execPath,[script,...suite.args||[]],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let text='',timedOut=false;child.stdout.on('data',b=>{text+=safe(b);});child.stderr.on('data',b=>{text+=safe(b);});const timer=setTimeout(()=>{timedOut=true;if(child.exitCode===null)spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});},600000);child.once('error',e=>{text+=safe(e.message);});child.once('close',exitCode=>{clearTimeout(timer);resolve({exitCode,text,timedOut});});});
 fs.writeFileSync(path.join(output,name+'.log'),result.text);const fresh=fs.readdirSync('test-results/xiaozhi-agent').filter(d=>d.startsWith(suite.prefix)&&!before.has(d));let original,caseOutput,error,artifactsVerified=false;
 try{if(fresh.length!==1)throw new Error('Ambiguous fresh evidence');caseOutput=path.resolve('test-results/xiaozhi-agent',fresh[0]);const file=path.join(caseOutput,'report.json');if(fs.statSync(file).mtimeMs<start-2000)throw new Error('Stale case report');original=JSON.parse(fs.readFileSync(file));
 const shots=fs.readdirSync(caseOutput).filter(f=>f.endsWith('.png')&&!/合成|公开图表|教师合成/.test(f));artifactsVerified=shots.length>0&&shots.every(f=>{const stat=fs.lstatSync(path.join(caseOutput,f));return stat.isFile()&&!stat.isSymbolicLink()&&stat.mtimeMs>=start-2000;});
 }catch(e){error=safe(e.message);}
 const grade=gradeAttempt({exitCode:result.exitCode,timedOut:result.timedOut,report:original,artifactsVerified,buildUnchanged:fingerprint(build).sha256===initial,scriptUnchanged:sha256(fs.readFileSync(script))===scriptSha,requiredAssertions:suite.min,layer:'isolated_formal_ui'});
 const item={name,cases:suite.cases,started:new Date(start).toISOString(),durationMs:Date.now()-start,output:caseOutput,exitCode:result.exitCode,scriptSha256:scriptSha,grade,error:error||safe(original?.error||''),checks:original?.checks||[],boundary:original?.boundaries||original?.boundary};report.attempts.push(item);console.log(grade.status+' '+name+' '+grade.assertionCount+(item.error?' '+item.error.slice(0,160):''));write();
}
report.finished=new Date().toISOString();report.selectedAutomation=report.attempts.every(a=>a.grade.status==='PASS')?'PASS':'FAIL';report.overall='NOT_ACCEPTED';write();console.log(JSON.stringify({output,selectedAutomation:report.selectedAutomation,overall:report.overall,failures:report.attempts.filter(a=>a.grade.status==='FAIL').map(a=>({name:a.name,error:a.error,output:a.output}))}));process.exitCode=report.selectedAutomation==='PASS'?2:1;
