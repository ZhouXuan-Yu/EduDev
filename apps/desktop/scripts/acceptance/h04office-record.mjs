import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fingerprint,sha256} from './evidence.mjs';

const repo=path.resolve('../..');
const root=path.resolve('test-results/goal/harness-h04office-20261015');
const record=path.join(root,'closeout.json');
assert(!fs.existsSync(record),'Preserve existing closeout');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const build=read('test-results/goal/harness-h04office-20261015-build1/build-isolated.json');
assert.equal(build.exitCode,0);assert(build.sourceUnchanged);
assert.equal(fingerprint(build.root).sha256,build.sha256);
assert(build.source.every(s=>sha256(fs.readFileSync(s.file))===s.currentSha256));
for(const name of ['office-artifact-service.ts','office-artifact-state.ts','ipc.ts'])assert(build.source.some(s=>s.file.endsWith(name)));
const suites=[
 ['office-ui','pi-office-interruption-ui-mFuKkZ',8],
 ['natural-file-ui','pi-natural-file-d6AbVM',14],
 ['file-stop','pi-office-file-stop-ohLAGy',5],
 ['office-foundation','pi-office-artifact-foundation-A0hp6r',17],
 ['effect-readback','pi-effect-readback-3c2jEn',34],
];
const evidence=suites.map(([name,dir,count])=>{
 const file=path.resolve('test-results/xiaozhi-agent',dir,'report.json'),r=read(file);
 assert(r.success&&r.checks.length===count&&r.checks.every(c=>c.pass&&!c.skipped),name);
 if(name.endsWith('ui'))assert.equal(r.build.sha256,build.sha256);
 return {name,file,count,sha256:sha256(fs.readFileSync(file)),scope:r.scope,exitCode:0,exitObserved:true};
});
const ui=read(evidence[0].file);assert(ui.closeMs<10000);assert.equal(ui.stateAfterStop,'uncertain');
const firstFailures=['pi-office-file-stop-lUBeTx','pi-office-interruption-ui-lJ2N0v','pi-office-interruption-ui-cfcnmZ','pi-office-interruption-ui-NOGiTx'].map(dir=>{
 const file=path.resolve('test-results/xiaozhi-agent',dir,'report.json'),r=read(file);assert(!r.success);
 return {file,sha256:sha256(fs.readFileSync(file)),passedBeforeFailure:r.checks.length,error:r.error,exitCode:1,exitObserved:true};
});
const legacyLog=fs.readFileSync(path.join(root,'legacy.log'),'utf8');
const legacy=JSON.parse(legacyLog.slice(legacyLog.search(/\{\s*"ok":\s*true/)));
assert(legacy.ok&&legacy.frontendAcceptance.cases.length===207);
assert(/"passed":\s*217/.test(fs.readFileSync(path.join(root,'components.log'),'utf8')));
assert.equal(fs.readFileSync(path.join(root,'type.log'),'utf8').trim(),'');
const next='继续 H04：逐领域源版本/副作用读回和原行为 golden；首次来源失败后的授权替代来源真实实例。附件原子接收、执行终结数据库等待仍需逐阶段反例。完整 H04 有证据后进入 H05–H10；日常旧会话/原图、无VPN、安装和人工Office仍OPEN。';
const common=`\n\n## H04-B2 文件到事实中断恢复进度（2026-10-15）\n\nM10/M12，H04-B2/H04 DOING、Master/Goal ACTIVE。正式页面首失败 lJ2N0v 与真实 SQLite/文件反例 lUBeTx 均证明：文件已安装后停止仍 committing。生产复用 OfficeArtifactService/State、Pi 文件 mutation queue 和原 saved SQLite trigger；invalidateRun 将 committing 条件置 uncertain，file 等待返回后复查取消/执行权，阻止迟到 saved。已落盘文件保留；教师只读核验原 hash/size 后登记一次，教师改动显示 conflict 并保留改动。没有新增 schema/依赖/授权/第二 executor。\n\n冻结构建 ${build.sha256}/${build.count}（原 electron-vite 配置孤立目录），Office service/state/IPC 均纳入 source SHA；type/构建 exit0，组件217、旧legacy207 exit0（legacy test-runtime不是Pi验收）。真实正式 Pi/DeepSeek 页面8项 exit0：实际自然请求与教师确认、file切断停止、信号忽略的迟到返回无事实/模型/原生/公开事件、教师核验、正常退出${ui.closeMs}ms、实际 owned taskkill/cold、教师改动反例、二次cold无重放。真实文件页面本轮实际14项 exit0（基础模式，按报告计数），独立 python-docx读回与实际Word预览/重启；领域原Office golden17、file-stop5、effect-readback34 exit0。1366/1920恢复截图已查看，停止/冲突提示明确，未把任务回复当通过。\n\n原失败报告全部保留。cfcnmZ是测试菜单角色定位错误；NOGiTx前4项通过，强制结束后测试观察器在正式应用恢复前只读数据库报disk I/O；改为结束前捕获native prefix、cold应用初始化后读回，完整8项复测通过。loader静态import早于注册的设置失败也有记录。没有删除数据库/journal或跳过强制结束断言。精确命令、报告、首次失败与截图：apps/desktop/test-results/goal/harness-h04office-20261015。\n\n本轮VPN按用户所述运行，未改系统网络/日常out/profile/凭证/学生资料；日常真实反馈与无VPN尚未签认。上一轮 dd2adb 构建的联网/图片基线是历史证据，本轮339dc构建只完成这里列出的专项复测，不合并成当前全基线通过。人工WPS/Office打开未执行。其他教育域脏改动保留，无commit/push。\n\n下一继续位置：${next}\n`;
const docs=['1.Agent.md','2.Memory.md','3.Learning.md','4.Wiki.md','docs/goal/CURRENT_STATE.md','docs/goal/CAPABILITY_MATRIX.md','docs/goal/DECISIONS.md','docs/goal/ACCEPTANCE.md','docs/architecture/CURRENT.md','docs/product/CURRENT.md','docs/acceptance/CURRENT.md','docs/integrations/CURRENT.md'];
const start='<!-- harness-execution-20261012:start -->',end='<!-- harness-execution-20261012:end -->';
const documents=[];
// Validate every existing marker before changing any document.
const pending=docs.map(file=>{const p=path.join(repo,file),before=fs.readFileSync(p),s=before.toString('utf8'),a=s.indexOf(start),b=s.indexOf(end,a);assert(a>=0&&b>a&&!s.includes('## H04-B2 文件到事实中断恢复进度（2026-10-15）'));return {file,p,before,s,a,b};});
for(const {file,p,before,s,a,b}of pending){
 const outside=Buffer.from(s.slice(0,a)+s.slice(b));assert(fs.readFileSync(p).equals(before));
 fs.writeFileSync(p,s.slice(0,b)+common+s.slice(b));
 const now=fs.readFileSync(p,'utf8'),aa=now.indexOf(start),bb=now.indexOf(end,aa);
 assert(outside.equals(Buffer.from(now.slice(0,aa)+now.slice(bb))));documents.push({file,outsideUnchanged:true,outsideSha256:sha256(outside)});
}
fs.appendFileSync(path.join(repo,'docs/goal/HARNESS_EXECUTION.md'),common);
const manual=path.join(repo,'测试样例说明书.md'),before=fs.readFileSync(manual,'utf8'),marker='<!-- harness-h04-tests:end -->';assert(before.includes(marker));
fs.writeFileSync(manual,before.replace(marker,`\n### H04-B2 确认后文件到事实边界\n\n仅脚本新建的 test-results 数据/profile/workspace 可启用分阶段暂停；需真实正式Pi、实际provider、教师UI确认和实际Office生成库。每次保留原失败报告。不可在日常数据库或学生文件上强制结束/改写。\n\n| 编号 | 操作 | 必须核验 |\n| --- | --- | --- |\n| TOOL-25 | 合成Word自然请求、UI批准、实际file阶段停止 | 文件字节/hash/mtime保留，状态uncertain，零正式产物事实 |\n| TOOL-26 | 放开原忽略取消信号的等待 | 无迟到saved/新模型请求/原生历史/公开事件；不自动重写 |\n| TOOL-27 | 教师点击只读核验保存结果，重复停止/核验 | 原hash/size恰好一份事实，文件mtime不变，终态不被重复取消覆盖 |\n| TOOL-28 | file切断期间正常退出、原profile冷启动后核验 | 10秒测试上限内退出；cold不调用模型、不重放；teacher核验只登记一次 |\n| TOOL-29 | 同边界实际结束该owned进程，冷启动后核验 | 正式应用先恢复SQLite，然后独立读回；native prefix保留、不重放、不生成第二文件 |\n| TOOL-30 | 停止后独立修改该测试文件，再点击核验 | conflict，教师字节完整保留，零原批准产物事实；不可覆盖 |\n| TOOL-31 | 二次cold与两种窗口尺寸 | exact事实IDs/native prefix一致，无模型重放；1366×768/1920×1080恢复操作可达 |\n\n本轮 Office UI8、基础真实文件UI14、原领域Office17、停止反例5、效果读回34通过；类型/构建/组件217/旧legacy207各单列。未验证日常旧profile、无VPN、人工WPS/Office、全部教育领域golden；不能写成全部AI功能通过。证据与精确命令：apps/desktop/test-results/goal/harness-h04office-20261015。\n\n${marker}`));
const screenshots=['recovery-1366.png','recovery-1920.png'].map(name=>{const file=path.join(path.dirname(evidence[0].file),name);return {file,sha256:sha256(fs.readFileSync(file)),visuallyViewed:true};});
fs.writeFileSync(path.join(root,'progress.md'),'# 本轮真实验收记录\n'+common+'\n## 报告\n\n'+evidence.map(e=>`- ${e.name}: ${e.count}项；${e.file}；实际观察exit0。`).join('\n')+'\n\n首次失败保留于 closeout.json 与 setup-failures.md。完整Goal保持ACTIVE。\n');
fs.writeFileSync(record,JSON.stringify({status:'OFFICE_FILE_TO_FACT_LIMITED_ACCEPTED',H04:'DOING',master:'ACTIVE',build,evidence,firstFailures,screenshots,documents,closeMs:ui.closeMs,next,gates:{type:0,build:0,components:217,legacy:207,legacyNotPi:true,exitsObserved:true},dailyAccepted:false,vpnOffAccepted:false,wpsAccepted:false,userFailuresClosed:false,gitDiffCheck:'PENDING',finished:new Date().toISOString()},null,2));
console.log(JSON.stringify({root,status:'OFFICE_FILE_TO_FACT_LIMITED_ACCEPTED',documents:documents.length,next}));
