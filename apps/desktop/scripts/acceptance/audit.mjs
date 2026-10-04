import fs from 'node:fs';import path from 'node:path';import {fingerprint,sha256,gradeAttempt,summarize} from './evidence.mjs';
const names=process.argv.slice(2);
if(!names.length||names.some(n=>!/^run-[A-Za-z0-9]+$/.test(n))||new Set(names).size!==names.length)throw new Error('Usage from apps/desktop: node scripts/acceptance/audit.mjs run-XXX run-YYY');
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
