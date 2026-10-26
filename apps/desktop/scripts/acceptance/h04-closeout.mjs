import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fingerprint,sha256}from'./evidence.mjs';
const desktop=process.cwd(),repo=path.resolve('../..'),root=path.resolve('test-results/goal/harness-h04-20261014');
const relative='test-results/xiaozhi-agent/',evidence=[];
for(const[name,dir,count]of[['boundary','pi-tool-execution-Xmpr9X',17],['attempt journal','pi-tool-attempt-journal-OGMiKM',6],['registration','pi-tool-registration-DemZlV',2],['attempt SSR','tool-attempt-renderer-J3UbPQ',5],['receipt','pi-tool-receipt-nErXHM',15],['event journal','pi-event-journal-TvlVr5',19],['native','pi-native-receipt-rg9KsM',10],['formal current UI','pi-tool-execution-ui-KLOtFp',8],['formal registration UI','pi-tool-execution-ui-dYig9f',8],['actual main crash','pi-receipt-crash-VnmYpl',7]]){
 const file=path.resolve(relative,dir,'report.json'),r=JSON.parse(fs.readFileSync(file));assert.equal(r.success,true,file);assert.equal(r.checks.length,count,file);assert(r.checks.every(c=>c.pass===true&&!c.skipped),file);evidence.push({name,file,sha256:sha256(fs.readFileSync(file)),checks:count,build:r.build?.sha256,scope:r.scope||r.layer,processExitFromReport:false});
}
const current=JSON.parse(fs.readFileSync('test-results/goal/harness-h04-20261014-current/build-isolated.json')),registration=JSON.parse(fs.readFileSync('test-results/goal/harness-h04-20261014-registration/build-isolated.json'));
assert.equal(fingerprint(current.root).sha256,current.sha256);assert.equal(fingerprint(registration.root).sha256,registration.sha256);assert.equal(evidence.find(e=>e.name==='formal current UI').build,current.sha256);assert.equal(evidence.find(e=>e.name==='actual main crash').build,registration.sha256);
const sourceChanges=current.source.filter(s=>sha256(fs.readFileSync(s.file))!==s.currentSha256).map(s=>s.file);assert.deepEqual(sourceChanges,[],'Owned source drift must be investigated before documenting this closeout');
const baselineFile=path.resolve('test-results/acceptance/harness-baseline-qzj69k/report.json'),baseline=JSON.parse(fs.readFileSync(baselineFile));assert.equal(baseline.build.sha256,registration.sha256);assert.equal(baseline.overall,'NOT_ACCEPTED');assert(baseline.validation.valid);assert(baseline.cases.every(c=>c.status==='PASS'));evidence.push({name:'natural network/image/file baseline',file:baselineFile,sha256:sha256(fs.readFileSync(baselineFile)),cases:baseline.cases.map(c=>({id:c.id,status:c.status})),build:baseline.build.sha256,scope:'C owned fresh profiles; actual provider; NOT_ACCEPTED overall'});
for(const file of['components-current.log','legacy-final.log']){const text=fs.readFileSync(path.join(root,file),'utf8');assert(text.includes(file.startsWith('components')?'"passed": 217':'"passed": 207'));}
const screenshots=['attempt-1366-light.png','attempt-1920-dark.png'].map(file=>{const p=path.resolve(relative,'pi-tool-execution-ui-KLOtFp',file);return{file:p,sha256:sha256(fs.readFileSync(p)),actuallyViewed:true};});
const body=`## Harness H04-A 工具边界与正式页面限定接受（2026-10-14）

方案B/Master/工具Goal仍ACTIVE。H02/H03保持此前限定接受；H04-A LIMITED_ACCEPTED，完整H04及H05–H10未完成；日常NET/IMG反馈保持OPEN。

本片交付：现Pi dispatcher统一manifest/input/output/错误/工具等待边界，复用Hana执行一次与取消registry、OpenMAIC 636fab0 MIT timeout；Pi仍唯一循环。仅公开网页读取/搜索safe_read最多两次，401/403/权限不自动retry，写入/上传/浏览器/缓存读取不自动retry。资源锁在实际底层结束前保留，超时/取消只结束等待，不能证明外部效果已停止。teacher budget.wait暂停active deadline。typed tool_attempt→journal/barrier→projection→现Pro工具卡→SQLite/重启；未知效果写existing effect_state=uncertain，native失败不能抹掉unknown，不增加事实表。

修复真实注册缺陷：旧Hana文件dispatcher误包含已启用联网名称，导致重复工具注册。现仅legacyNames进入旧dispatcher，授权webTools单独注册一次；SDK实际组装2项通过。首个正式冻结ef01fc0/366的网络/图片/文件四FAIL均保留，不称无效API Key。并行课堂增加education_read_classroom及manifest已保留，不覆盖其源。

证据：当前冻结${current.sha256}/${current.count}，current UI KLOtFp 8/8，含真实DeepSeek、第一次受控HTTP503→实际官网200、403零自动retry、同call原生单结果/SQLite/页面刷新/正常冷启、真实停止按钮与迟到响应丢弃；浅1366×768/暗1920×1080真实颜色及PNG已查看。稍早registration冻结${registration.sha256}/${registration.count}：dYig9f UI8/8、实际main强退/确认文件/终态拒写VnmYpl7/7、自然baseline qzj69k四PASS（network20/image13/file15；总NOT_ACCEPTED）。两build分开，不声称所有证据同版。

source定向反例17/17、真实SQLite attempt6/6、SDK注册/许可证2/2、attempt SSR5/5、receipt15/15、event19/19、native10/10；当前type与孤立vite构建exit0、renderer217/217。registration build legacy最低smoke207/207，仅历史test-runtime，不冒充Pi实例。原始报告/日志/构建和复现命令在apps/desktop/test-results/goal/harness-h04-20261014；测试样例说明书新增TOOL-01–09。未改凭证/系统DNS/VPN、未上传真实学生资料、无新增Harness依赖、无commit/push。

网络状态来自用户答复VPN/代理运行中；四例恢复不证明长期稳定或无VPN可用。UI故障注入明确只在自有测试main，不是供应商自然503/403。当前源码与列出的当前冻结Harness文件一致，未对未列并行教育源码或日常out/profile作可复现承诺。

下一唯一Harness切片H04-B：补交付前memory/permission/admission/attempt等待的取消和截止、shutdown；先审教育导出等写文件工具的跨会话workspace锁与领域源版本/效果读回；贯通实际替代来源与领域golden。现硬等待race只包def.execute，交付前关键await未全部有界，不得称完整H04完成。写后unknown只读核对；保留全部首次失败。完成H04后才H05，日常D/无VPN/E安装/Office人工继续OPEN。
`;
const tails={
 '1.Agent.md':'执行规则：每个新生产tool必须显式manifest；受控注入、模型真实调用、实际UI与日常人工分层。关键持久化失败不得绕过barrier交付。保留实际工作锁至settlement，不把超时写成效果已停止。只更换本文件Harness块，其他教育主线规则保持。',
 '2.Memory.md':'继续位置：H04-A已收拢；H04-B修改前合同在HARNESS_EXECUTION。先处理交付前await与shutdown，再核导出workspace资源与领域golden。H03不重做、原图隐私不改变、无第二执行循环。',
 '3.Learning.md':'本轮教训：SDK组装/实际UI才能揭露重复web注册；SQLite测试漏migrate是测试缺陷不是生产故障。ESM命名fetch不能通过改CJS导出注入；真实dispatcher handler须保留原型/this，MockAgent误回到拦截器造成测试递归，改真实503/403 handler。Playwright GC只是观测错误，应重读同一活进程；KLOtFp记录一次并继续，不能据此重启或伪造成功。SSR不能搜索整张卡的已完成字样，因为既有失败提示说明已完成操作仍保留；改只核attempt摘要，首次失败保留。',
 '4.Wiki.md':'稳定口径：manifest=执行策略，不是能力已验；attempt=某一逻辑call的最多两次纯web读取，不是模型全部轮次。只有真实HTTP正文/文件/SQLite读回才提供事实，公开卡不含原生正文/隐藏推理/凭证。未知effect在既有receipt字段保存并冷恢复为needs_check。',
 'docs/goal/CURRENT_STATE.md':'状态：H04 DOING，H04-A限定接受；H04-B→H05继续。原反馈、日常/无VPN/安装条件OPEN。',
 'docs/goal/CAPABILITY_MATRIX.md':'能力边界：工具执行race/有限safe retry/恢复卡已有证据；交付前等待与全部adapter资源/version/shutdown未验。全部工具完成、全Codex功能和日常可用均不得标PASS。',
 'docs/goal/DECISIONS.md':'决策：不另建executor；仅office_web_search/fetch可自动重试一次；401/403/写/上传不重试；OpenMAIC许可与provenance进入main/vendor/harness-openmaic。粗粒度workspace/session锁仍需H04-B领域审计。',
 'docs/goal/ACCEPTANCE.md':'接受范围仅H04-A已列专项，完整H04保持DOING。当前UI与更早baseline/build分开，不合并成同版本全通过；原失败保留，dailyAccepted=false，vpnOffAccepted=false，humanAccepted=false。',
 'docs/architecture/CURRENT.md':'稳定架构：Pi原生模型/工具loop→现dispatcher边界→领域工具；main持久attempt/barrier，typed事件与原投影负责展示。没有新loop/事实表，Hana registry与execute-once保留。',
 'docs/product/CURRENT.md':'教师可见：读取失败会呈现重试次数/来源；权限拒绝不自动重试；停止后回到可发送；未知外部效果明确需要核对。功能不以模型自称完成验收，当前样例是隔离实测。',
 'docs/acceptance/CURRENT.md':'验收：TOOL-01–09追加说明书；原NET/IMG/FILE与A–E条件保持。源反例、受控故障正式UI、真实provider、实际强退和日常人工分别记录。当前全方案NOT_ACCEPTED。',
 'docs/integrations/CURRENT.md':'集成：OpenMAIC固定636fab0 timeout MIT，完整license/source-manifest随构建保留；Hana Apache-2.0现registry与执行一次；Pi1.0.2五参context透传。Harness本片无新增依赖，其他并行教育依赖不属于本片结论。',
};
const start=Buffer.from('<!-- harness-execution-20261012:start -->'),end=Buffer.from('<!-- harness-execution-20261012:end -->'),documents=[];
for(const[file,tail]of Object.entries(tails)){
 const p=path.join(repo,file),before=fs.readFileSync(p),a=before.indexOf(start),b=before.indexOf(end);assert(a>=0&&b>a&&before.indexOf(start,a+1)===-1,file);const prefix=before.subarray(0,a+start.length),suffix=before.subarray(b),next=Buffer.concat([prefix,Buffer.from('\n'+body+'\n'+tail+'\n'),suffix]);assert(fs.readFileSync(p).equals(before),'Concurrent document changed; retry scoped read');fs.writeFileSync(p,next);const after=fs.readFileSync(p);assert(after.subarray(0,prefix.length).equals(prefix));assert(after.subarray(after.length-suffix.length).equals(suffix));documents.push({file,prefixSha256:sha256(prefix),suffixSha256:sha256(suffix),outsideBytesUnchanged:true});
}
const extra=`

### H04-A 实际结果与 H04-B 继续合同（2026-10-14）

${body}

#### 完整 H04 缺口冻结（不得用 H04-A 缩小原合同）

1. 交付前 checkMemory、权限、admission 和关键 attempt/barrier 等待仍可能不响应；在现边界接取消/执行时间限制，但关键写失败或超时必须明确暂停，不吞掉迟到提交，不绕过owner/receipt。安全替代路径是中断并冷恢复核对，不能跳过持久化继续动作。
2. 应用 shutdown：真实工具挂起时正常关闭、确认后关闭、旧run迟到结果与再次启动。只操作自有PID/profile，不将正常关闭当崩溃，也不把长操作强停成功当效果停止。
3. 逐现生产工具manifest/领域adapter查资源键与源版本：特别education_export_classroom/education_export_paper会写workspace，目前粗session锁需审查；跨会话同目录写入、引用资料变化、工作目录切换、真实现领域CAS/teacher确认不弱化。
4. 领域golden保持并有失败读回：文件复制/生成/导出、解析/OCR、公开图、browser交互与教育草稿/确认，效果查询不支持时明确not_checked/unknown，不自动重放。已验测试不扩大成整域完成；没有真实学生资料上传。
5. 网络正文来源失败后，Pi真实读取授权替代来源→独立标准满足/来源记录仍保留首失败。不能用最终流畅回复或模型自评当verified。
6. 将H04全部要求逐条映射证据后才能接受并进入H05；原日常NET/IMG、无VPN、安装/Office人工及H05–H10持续OPEN。source漂移或外部观测超时先检查同一handle/实际加载模块；无法证明版本时不能继续宣称同build。

原始失败：IMq3Ce四FAIL、xxr1d4/OVSsKq重复注册；jktDhC未实际注入；do4B2p测试handler失去原型造成timeout；8UnXNf测试MockAgent递归；lBuECe观测GC；RBMjuj漏migrate；SSR导入/断言失败日志均保留。最终actualUI KLOtFp含一次GC重观测成功，不删观察异常。OpenMAIC helper重放对比vendor一致（shim只存内存，不覆盖vendor），provenance outputSha和构建legal assets已核。
`;
const contract=path.join(repo,'docs/goal/HARNESS_EXECUTION.md'),old=fs.readFileSync(contract);assert(!old.includes(Buffer.from('### H04-A 实际结果与 H04-B 继续合同')));fs.writeFileSync(contract,Buffer.concat([old,Buffer.from(extra.trimEnd()+'\n')]));
const commands=`$ErrorActionPreference = 'Stop'
Set-Location 'D:/WorkProject/EduProject/apps/desktop'
# 真实调用既有忽略配置凭证，不打印密钥。使用自有测试目录。
$env:OMNI_EDU_TEST_BUILD_ROOT = (Resolve-Path 'test-results/goal/harness-h04-20261014-current/build-isolated').Path
node scripts/xiaozhi-agent/pi-tool-manifest-registration.mjs
node scripts/xiaozhi-agent/pi-tool-execution-boundaries.mjs
node scripts/xiaozhi-agent/pi-tool-attempt-journal.mjs
node scripts/xiaozhi-agent/tool-attempt-renderer.mjs
node scripts/xiaozhi-agent/pi-tool-execution-ui.mjs
# 本轮真实baseline/强退/legacy针对稍早registration冻结；两个build不混称同版。
$env:OMNI_EDU_TEST_BUILD_ROOT = (Resolve-Path 'test-results/goal/harness-h04-20261014-registration/build-isolated').Path
node scripts/xiaozhi-agent/pi-receipt-crash-ui.mjs
node scripts/acceptance/harness-baseline.mjs
# baseline四PASS也设计exit2/总NOT_ACCEPTED，人工D/E/无VPN仍未验。
node scripts/electron-smoke.mjs
# legacy207是历史test-runtime，不是Pi实例。
node scripts/xiaozhi-agent/pi-tool-receipt-boundaries.mjs
node scripts/xiaozhi-agent/pi-event-journal-boundaries.mjs
node scripts/xiaozhi-agent/pi-native-receipt-boundaries.mjs
npm run test:renderer-components
npx tsc --noEmit
# 已执行npm run build，日志build-first.log。current孤立完整编译使用:
# node scripts/acceptance/harness-isolated-build.mjs harness-h04-20261014-current
# 重复冻结会拒绝覆盖；再次构建使用新的自有task名称。
Set-Location 'D:/WorkProject/EduProject'
git diff --check
`;
fs.writeFileSync(path.join(root,'commands-final.ps1'),commands);
const report={schema:'harness.h04a.closeout.v1',stage:'LIMITED_ACCEPTED',master:'ACTIVE',H04:'DOING',H04A:'LIMITED_ACCEPTED',wholeHarnessAccepted:false,dailyAccepted:false,vpnOffAccepted:false,humanAccepted:false,currentBuild:current,registrationBuild:registration,evidence,sourceChanges,screenshots,documents,environment:{vpn:'Running; user reply',systemSettingsChanged:false,credentialChanged:false,realStudentUpload:false},failuresPreserved:true,next:'H04-B: pre-delivery await / shutdown / adapter locks+source versions+effects / golden / actual alternate source',observations:JSON.parse(fs.readFileSync(path.join(relative,'pi-tool-execution-ui-KLOtFp/report.json'))).observationErrors||[],buildGate:{npmBuildLog:'build-first.log',typeCheckLog:'type-closeout.log',isolatedBuild:current.exitCode,rendererReport:'components-current.log',renderer217:true,legacyLog:'legacy-final.log',legacy207:true,legacyBuild:registration.sha256},gitDiffCheck:'pending final readback',processExitNote:'Per-suite reports and logs preserved; shell pipelines ending in log reads do not prove every nested process exit. Current isolated build/type/renderer/formal current UI terminal exits observed 0. Baseline runner final exit not recovered after user interruption; source intentionally returns 2 for all isolated cases PASS.'};
fs.writeFileSync(path.join(root,'closeout.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(root,'progress.json'),JSON.stringify({stage:'H04_A_LIMITED_ACCEPTED',master:'ACTIVE',H04:'DOING',build:current.sha256,next:report.next,failuresPreserved:true,closeout:'closeout.json'},null,2));console.log(JSON.stringify({documents:documents.length,evidence:evidence.length,currentBuild:current.sha256,H04:'DOING'}));
