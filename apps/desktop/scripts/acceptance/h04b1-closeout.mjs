import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fingerprint,sha256} from './evidence.mjs';
const desktop=process.cwd(),repo=path.resolve('../..');
const root=path.resolve('test-results/goal/harness-h04b1-20261014');
const recordFile=path.join(root,'closeout.json');
assert(!fs.existsSync(recordFile),'Refuse to replace previous closeout');
const read=file=>JSON.parse(fs.readFileSync(path.resolve(desktop,file),'utf8'));
const build=read('test-results/goal/harness-h04b1-20261015-image-final/build-isolated.json');
const uiDirectory=process.argv[2],imageDirectory=process.argv[3];
assert(/^pi-tool-execution-ui-[A-Za-z0-9]+$/.test(uiDirectory||''));assert(/^pi-public-image-ui-[A-Za-z0-9]+$/.test(imageDirectory||''));
assert.equal(fingerprint(build.root).sha256,build.sha256);assert(build.sourceUnchanged);
const changes=build.source.filter(s=>sha256(fs.readFileSync(s.file))!==s.currentSha256);assert.equal(changes.length,0,'Listed source drift; preserve evidence and re-scope');
const items=[
 ['preflight','pi-preflight-w5WE0Z',9],
 ['tool-boundary','pi-tool-execution-55lvRt',17],
 ['attempt-journal','pi-tool-attempt-journal-QxMrxc',8],
 ['receipt','pi-tool-receipt-r4bp97',15],
 ['journal','pi-event-journal-9yZsq3',19],
 ['registration','pi-tool-registration-KuTw1c',2],
 ['formal-ui',uiDirectory,10],
 ['image-after-fix',imageDirectory,15],
];
const evidence=items.map(([name,directory,count])=>{
 const file=path.resolve('test-results/xiaozhi-agent',directory,'report.json'),r=read(file);
 assert(r.success&&r.checks.length===count&&r.checks.every(c=>c.pass===true&&!c.skipped),name);
 if(name==='formal-ui'||name==='image-after-fix')assert.equal(r.build.sha256,build.sha256);
 return{name,file,count,sha256:sha256(fs.readFileSync(file)),scope:r.scope||r.boundary};
});
const baseline=read('test-results/acceptance/harness-baseline-my0oOg/report.json');
assert(baseline.finished&&baseline.validation.valid&&baseline.cases.length===4&&baseline.cases.filter(c=>c.status==='PASS').length===3&&baseline.cases.find(c=>c.id==='IMG-04').status==='FAIL');
assert.equal(baseline.overall,'NOT_ACCEPTED');assert(!baseline.dailyAccepted&&!baseline.vpnOffAccepted&&!baseline.userFailuresClosed);
assert.equal(baseline.attempts.find(a=>a.suite==='vision').exitCode,1);
const components=fs.readFileSync(path.join(root,'components.log'),'utf8');assert(/"passed":\s*217/.test(components)&&/"total":\s*217/.test(components));
const legacy=fs.readFileSync(path.join(root,'legacy-current.log'),'utf8'),legacyValue=JSON.parse(legacy.slice(legacy.search(/\{\s*"ok":\s*true/)));
assert(legacyValue.ok&&legacyValue.frontendAcceptance.cases.length===207);
assert.equal(fs.readFileSync(path.join(root,'type-image.log'),'utf8').trim(),'');
const ui=read(evidence.find(e=>e.name==='formal-ui').file);
const imageResult=read(evidence.find(e=>e.name==='image-after-fix').file);
assert(imageResult.afterStop&&imageResult.afterStop.newControlId!==imageResult.afterStop.stoppedControlId);
assert(imageResult.afterStop.verification.state==='needs_human');
assert(imageResult.checks.some(c=>c.pass&&c.name.startsWith('Exact new natural request after a stopped image run')));
const screenshotNames=['attempt-1366-light.png','attempt-1920-dark.png','shutdown-pending-question.png'];
const screenshots=screenshotNames.map(name=>{const file=path.join(path.dirname(evidence.find(e=>e.name==='formal-ui').file),name);assert(fs.statSync(file).size>0);return{file,sha256:sha256(fs.readFileSync(file)),viewed:true};});
const next='H04-B2：处理启动/模型准备与关键 DB 等待中的停止及退出；审计全部领域工具的源版本和副作用读回；正式 Pi 在第一来源失败后使用授权替代来源并独立核对。完整 H04 逐项有证据后才进入 H05；日常旧会话/原图片、无 VPN、安装与 Office 人工继续 OPEN。';
const common=`

## H04-B1 当前继续位置（2026-10-15）

H04-B1 LIMITED_ACCEPTED；H04 DOING、方案B/Master/Goal ACTIVE，H05–H10未完成。此前 H04-A 记录为历史证据，不表示日常原故障已关闭。

已交付：工具 pre-delivery/checkMemory/started-attempt 纳入原 OpenMAIC race；终态 attempt 有最多15秒的关键等待，关键失败封闭 publisher 并停止交付。caller cancel 不冒充持久化失败；迟到准备不能调用工具。工具执行前等待共享该工具 manifest 的 active deadline，teacher wait 仍暂停时钟；取消仍可立即结束等待。真实底层未结束时保留锁。education_export_paper/classroom 使用宿主授权的实际输出目录锁，与同目录普通文件写入互斥。取消后无最终 attempt 的 admitted 非只读失败保持 uncertain/needs_check；独立效果 matched 可解决，纯读失败不虚构效果。Pi仍唯一循环，无新schema/依赖，不改变教师确认或来源事务。

冻结 ${build.sha256}/${build.count}，正式 UI ${uiDirectory} 10/10：真实 DeepSeek、受控503后实际官网200、403不自动retry、停止/迟到丢弃、补拉/冷启、浅1366/暗1920截图已查看；正常关闭受控卡住GET耗时${ui.hungShutdown.closeMs}ms，未回答问题退出及冷启无重放。仅这两条正常shutdown，不当作批准后写入、DB挂起、全部退出或实际崩溃。

首次完整baseline my0oOg（旧本片bcc94b08/366）NET-01/02与FILE-01三PASS，IMG-04 FAIL/native exit1且整报告保留：准备取消的泛化unknown文案使模型误认新任务仍停止。修复把公开图片工具归本地准备、保留有阶段含义的取消回执；真实上传仍独立回执，绝不复用批准或自动retry。当前冻结${imageDirectory}15/15使用原盲图片/原自然输入重新走确认、送达、核验码/图形、拒绝、停止、冷启、utility终止和供应商故障反例，另实证停止用途卡后同会话新确认、实际200/received、盲码及独立回执核对，不拿冷启代替它。旧三PASS和当前图片复测分构建，不拼成同版四PASS；日常反馈/完整最终基线尚未签认。VPN/代理状态来自用户答复运行中，未证明无VPN。

source受控等待/图片取消9、工具17、SQLite attempt8、receipt15、journal19、SDK2；type及原vite配置孤立构建exit0，组件217。legacy最低smoke207仅旧test-runtime，跑于本片bcc94b08，不冒充当前Pi或图片实例。正式UI的Playwright观察GC错误原样保留，原同进程重读而不吞产品异常；首次tsc缺details错误保留，修正后type0。列出的Harness源码与冻结摘要一致，不承诺未列教育源码或日常out/profile同版。

证据与精确命令：apps/desktop/test-results/goal/harness-h04b1-20261014；测试样例说明书TOOL-10–15。上一片及第一次构建/类型错误不删除；未改密钥/系统网络/真实学生数据，无commit/push。

下一唯一Harness切片：${next}
`;
const docs=['1.Agent.md','2.Memory.md','3.Learning.md','4.Wiki.md','docs/goal/CURRENT_STATE.md','docs/goal/CAPABILITY_MATRIX.md','docs/goal/DECISIONS.md','docs/goal/ACCEPTANCE.md','docs/architecture/CURRENT.md','docs/product/CURRENT.md','docs/acceptance/CURRENT.md','docs/integrations/CURRENT.md'];
const start='<!-- harness-execution-20261012:start -->',end='<!-- harness-execution-20261012:end -->';
const documentChanges=[];
for(const file of docs){
 const target=path.join(repo,file),before=fs.readFileSync(target),s=before.toString('utf8'),a=s.indexOf(start),b=s.indexOf(end,a);
 assert(a>=0&&b>a&&!s.includes('## H04-B1 当前继续位置（2026-10-15）'),file);
 const old=s.slice(a,b),outside=Buffer.from(s.slice(0,a)+s.slice(b));
 const updated=old.replace('下一唯一Harness切片H04-B：','H04-B既定缺口（历史计划）：')+common;
 assert(fs.readFileSync(target).equals(before),'Concurrent document mutation');
 fs.writeFileSync(target,s.slice(0,a)+updated+s.slice(b));
 const now=fs.readFileSync(target,'utf8'),aa=now.indexOf(start),bb=now.indexOf(end,aa);
 assert(outside.equals(Buffer.from(now.slice(0,aa)+now.slice(bb))),'Outside owned block changed');
 documentChanges.push({file,outsideSha256:sha256(outside),afterSha256:sha256(fs.readFileSync(target)),outsideBytesUnchanged:true});
}
const execution=path.join(repo,'docs/goal/HARNESS_EXECUTION.md');
assert(!fs.readFileSync(execution,'utf8').includes('## H04-B1 当前继续位置（2026-10-15）'));fs.appendFileSync(execution,common);
const record={schema:'xiaozhi.h04b1-closeout.v1',finished:new Date().toISOString(),status:'LIMITED_ACCEPTED',master:'ACTIVE',H04:'DOING',H05toH10:'NOT_COMPLETE',dailyAccepted:false,vpnOffAccepted:false,userFailuresClosed:false,build,evidence,firstBaseline:{build:baseline.build,output:baseline.output,cases:baseline.cases.map(c=>({id:c.id,status:c.status})),overall:baseline.overall,exitCode:1,suites:baseline.attempts.map(a=>({suite:a.suite,exitCode:a.exitCode,output:a.output}))},gates:{type:0,isolatedBuild:0,components:{passed:217,total:217},legacy:{checks:207,buildSha256:baseline.build.sha256,onlyLegacyRuntime:true}},screenshots,observationErrors:ui.observationErrors||[],documents:documentChanges,next,noSystemNetworkChange:true,noCredentialChange:true,noPrivateStudentUpload:true,noCommitPush:true,gitDiffCheck:'PENDING_FINAL_COMMAND'};
fs.writeFileSync(recordFile,JSON.stringify(record,null,2));
fs.writeFileSync(path.join(root,'progress.json'),JSON.stringify({master:'ACTIVE',H04:'DOING',H04B1:'LIMITED_ACCEPTED',next},null,2));
const commands=`# PowerShell; own frozen build, existing ignored credentials; no key printed
cd D:/WorkProject/EduProject/apps/desktop
npx tsc --noEmit
# Original electron-vite config, isolated output; choose a NEW task name, existing evidence is protected.
node scripts/acceptance/harness-isolated-build.mjs harness-h04b1-new-reproduction
$env:OMNI_EDU_TEST_BUILD_ROOT=(Resolve-Path test-results/goal/harness-h04b1-20261015-image-final/build-isolated).Path
npm run test:renderer-components
node scripts/xiaozhi-agent/pi-tool-preflight-boundaries.mjs
node scripts/xiaozhi-agent/pi-tool-execution-boundaries.mjs
node scripts/xiaozhi-agent/pi-tool-attempt-journal.mjs
node scripts/xiaozhi-agent/pi-tool-receipt-boundaries.mjs
node scripts/xiaozhi-agent/pi-event-journal-boundaries.mjs
node scripts/xiaozhi-agent/pi-tool-manifest-registration.mjs
node scripts/xiaozhi-agent/pi-tool-execution-ui.mjs --shutdown
$env:OMNI_EDU_TEST_IMAGE_FIXTURE_ROOT=(Resolve-Path test-results/acceptance/harness-baseline-my0oOg/vision-fixture).Path
$env:OMNI_EDU_VERIFY_RESULT_READBACK='1'
node scripts/xiaozhi-agent/pi-public-image-ui-smoke.mjs
node scripts/acceptance/harness-baseline.mjs # exit2 for four isolated PASS; daily NOT_ACCEPTED
node scripts/electron-smoke.mjs # same legacy smoke entry as npm test:smoke, build already frozen
git diff --check
`;
fs.writeFileSync(path.join(root,'commands-final.ps1'),commands);
console.log(JSON.stringify({status:record.status,root,build:build.sha256,documents:documentChanges.length,next}));
