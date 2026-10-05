# Phase2 唯一Pi Runtime：P2-01实施合同

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

结论：Master Phase2 的“唯一 Pi Loop / 重复 Runtime 迁移 / 保留 Domain”已实现层 A/C 接受，进入 Phase3；完整 Goal 和人工/发布未接受。本轮合同是验收补强，生产源码未改。完整结果与状态见 CURRENT_STATE，精确SHA/原报告/native文件和实际12次启动见 apps/desktop/test-results/goal/phase2-accept-20261005/facts.json、closeout.json。

|冻结要求|实际证据|结论|
|---|---|---|
|正式只一个Pi、旧loop不加载|P2-01–03 authority/retirement/factory；当前39边界；4真实suite共12实际main库存，无test-runtime|接受|
|保留教育Domain，生产无旧mock注入|P2-03相同build教育207/正式17；所有生产源码指纹重核相同，历史只读不自动重放|接受；本轮未重跑207/17|
|真实工具与密钥导入/冷恢复|保存凭证工具16：Win safeStorage UI保存，环境空，真实200/read_text，改文件后冷启动实读当前版本|接受隔离配置；日常配置另验|
|教师确认与控制|控制30：公开问答/计划/steer/followUp/stop/冷崩溃；auto新鲜seed实读、教师拒绝复制、恢复不复用授权|接受本轮路径；Office高级产物非此门禁|
|浏览器/联网|浏览器20：真实MOE搜索/正文，日期区分，native标签∩当前DOM，实际PNG/hash/preview，失败返回/冷恢复/权限|接受当前网络路径；无VPN/安装仍OPEN|
|自动上下文整理|auto21 + boundary11：Pi原生prepare/compact/append，Hana工具批次接缝，split-turn两请求usage，重复整理/stop/失败/提交后kill|接受；提前阈值仅test|
|不设运行预算、真实缓存账本|无预算4；所有实际launch snapshot limits=false；保存工具10实际SSE字段与总账72900一致|接受；价格未知，不承诺高命中率|
|UI/构建/失败证据|build/tsc，renderer111；最终26PNG与首失败1PNG逐张审阅，87真实断言；首失败保留，修复后原suite通过|本轮范围接受，非完整像素/人工验收|

精确命令 cwd = D:/WorkProject/EduProject/apps/desktop：

```powershell
npm run build -- --config test-results/goal/phase2-accept-20261005/workspace-build.config.ts
npm run test:renderer-components
node scripts/xiaozhi-agent/pi-runtime-authority-smoke.mjs
node scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs
node scripts/xiaozhi-agent/pi-unlimited-usage-smoke.mjs
$env:OMNI_EDU_TEST_BUILD_ROOT=(Resolve-Path test-results/goal/phase2-accept-20261005/build).Path
node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-saved-credential-tools-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-auto-compaction-ui-smoke.mjs --fresh-seed
node scripts/xiaozhi-agent/pi-browser-delivery-ui-smoke.mjs
node test-results/goal/phase2-accept-20261005/archive.mjs
node test-results/goal/phase2-accept-20261005/verify-closeout.mjs
```

git diff --check 在仓库根运行。对应 build/renderer/runtime-boundary/auto-boundary/unlimited/control/saved-tools/auto-ui/browser-repaired.log；browser.log 为首失败，不能记成功。auto runner已有catch不设置exitCode，因此必须同时检查report.success和全部21断言，不能只用exit0。当前全部最终suite均原报告/精确scriptSHA绑定相同fixedbuild；关闭后native JSONL SHA已保存。

首失败xYg48f3项通过，exit1；实际native回执[10]“新闻”与截图一致，原白名单漏列。修复只原测试断言，加入实际回执/current DOM/回答三重匹配；adO3BF20项通过exit0，不更改提示或产品规避失败。重核先前P2-03 report/production/build后复用207/17，不改老closeout。

上游依据：[Pi v1.0.2 compaction](https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/docs/compaction.md)、[DeepSeek真实usage字段](https://api-docs.deepseek.com/api/create-chat-completion/)。已核官方当前上游与安装1.0.2；本轮无SDK升级，继续现成SDK/Hana wrapper，未新造压缩循环。

## 2026-10-05 P2-04 阶段验收合同（执行前冻结）

目标 M01/M10：验证 P2-01–03 后正式 Pi 的真实工具、教师确认、控制、自动压缩、重启/崩溃恢复和 provider usage；新接口读取真实本地事实，停止旧模拟业务兼容。当前 Phase2 DOING，尚未阶段接受。

复用当前 Pi 1.0.2 / Hana Adapter / ProductionHost 和原有验收脚本。候选 A：扩展原控制、保存凭证工具、浏览器交付、自动整理脚本并跑当前固定构建，选 A；B：新造测试编排/压缩循环，拒绝；C：只用 mock/历史报告验收，拒绝。Pi 官方 v1.0.2 compaction 文档与当前上游已核，API 原生 prepare/compact/append 与既有 Hana 接缝保持；不引入 SDK 升级或第二 Runtime。DeepSeek 缓存按官方实际 usage 字段校对，不估计缓存命中率、不以本地“缓存”替代 provider 回执。

本轮首先扩展原 acceptance/build-root 的实际 profile/Pi 模块装配检查，并用于原控制、自动压缩、保存凭证工具和浏览器脚本；补当前无运行预算/usage readback 验收。生产源码只有发现实际失败才按证据修改。无 Schema、共享协议、密钥、provider 默认模型或数据目录变更；不更换日常 out，不清空用户数据库。执行前保存精确源码/脚本/文档/构建/HEAD/Master 快照。

完成定义：正常 build/typecheck、renderer；当前边界与压缩契约；真实 DeepSeek 控制/问答/steer/followUp/stop/retry/崩溃恢复；UI 保存的 Windows 加密密钥冷启动后真实工具请求；真实网页搜索、浏览器 DOM/截图与失败返回；长上下文自动整理、工具批次后的续行、停止与提交后崩溃恢复；SQLite/native/file/usage readback，实际 PNG 浅暗双尺寸审阅，git diff --check。被压缩阈值测试降低只属于隔离验收，不当成生产 provider 容量。

若失败，保留原报告与日志，修复后再跑覆盖具体风险的原脚本；不靠反复通过掩盖失败。通过后依据 Phase2 范围审计决定阶段接受并进入 Phase3 五产品空间。完整教育黄金 A–G、DeepTutor/OpenMAIC 能力迁移、飞轮、发布/无VPN/人工/安全属于后续阶段；不因这些后续欠项循环重做 Phase2。

官方参考：[Pi compaction v1.0.2](https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/docs/compaction.md)、[Pi upstream](https://github.com/earendil-works/pi)、[DeepSeek usage](https://api-docs.deepseek.com/api/create-chat-completion/)。

## 2026-10-05 P2-03 生产唯一 Pi 装配接受

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING；Current Task：P2-03 限定 A/C 接受。完整 Phase2、Goal、发布与人工验收仍 NOT_ACCEPTED。用户的新接口真实数据优先、旧模拟兼容停止、跳过测试样例书专项规则继续生效。

Done：main/index.ts 从约2300行减为502行；Direct/DeepTutor Sidecar/Graph 的旧状态、闭包与注册移入 legacy-ai/test-runtime.ts。生产只装配 Pi；两普通旧名经同一 Pi Facade，9旧编排名明确退役。测试模块在显式隔离 opt-in 时动态加载，factory 再核当前真实 packaged/env/data/profile 策略；教育 Domain、传统业务及历史只读保持。

Evidence：owned build 324 文件/SHA ee048bf95d934b5b9dbef6925931153591aeabda333c018971542eb01e5cebd8；正常 npm build/tsc exit0，renderer111/111，运行边界39/39，原教育隔离回归207/207 exit0，正式真实DeepSeek/Pi UI 2cvNGJ 17/17 exit0、rendererErrors=[]。V8 Inspector 实际主进程已加载脚本清单证明正常启动和实际请求/冷重试均不含 test-runtime；原教育回归反向断言该隔离模块确实加载。最终6PNG逐张审阅，浅暗双尺寸输入控件可达、回复和历史可读；本轮无UI源修改，不宣称Codex像素一比一。

新鲜/重复/冷启动的学生、学习记录、题库均无自动演示注入。真实页面发送清空输入，旧别名并发同commandId只新增一次Pi run，结果与SQLite正文相同，cold receipt/native JSONL SHA保持。新接口继续取真实本地事实；没有清空日常库、猜测已有记录、回填模拟结果或投入旧三元/续跑兼容。

Failed：初次抽取后相对导入深度错误，首tsc失败；修正shared和dynamic type import路径后tsc/build通过。诊断读取两次工作目录错配，仅只读且已重读。正式17/17和教育207/207本轮首次运行通过；不宣称三连稳定。

Doing/Next：P2-04 全Phase2验收：真实工具调用、权限确认/控制、自动上下文整理、恢复、当前无运行预算与provider真实缓存口径；之后Phase3五产品空间，再Phase4/5教育能力。移走旧编排不等于DeepTutor/OpenMAIC个性化能力已完成。

Blocked：无当前阻塞。Open：用户日常联网/图片/凭证反馈、无VPN/安装、完整教育黄金A–G、分发许可/安全、全UI人工与完整Goal。未替换日常out，Master与HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未提交/push，无新依赖/Schema/预算/密钥/系统proxy/DNS/VPN修改。先前P2-01首启动profile偏好可能触及的事实保留，本轮所有实际测试独立profile已核验。

证据：apps/desktop/test-results/goal/phase2-retire-20261005/；交付合同：docs/goal/PHASE2_P2_03_DELIVERY.md。


## 2026-10-05 普通请求单Pi与无模拟注入接受、用户新接口范围修订

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING。普通教师旧别名与生产无模拟注入限定 A/C接受，完整 Phase2/Goal/发布/人工 NOT_ACCEPTED。

用户明确旧接口数据为模拟，可删除，以新接口为主；跳过测试样例书专项。旧学生/范围/三元/续跑兼容不再作为交付目标，不将放弃兼容记作教育能力已完成。

生产：两个旧普通请求别名投递同一 Pi host，native done 后核 SQLite终态，公开 receipt/真实回复/工具/来源，不伪造grader；增量可选commandId跨别名并发/冷重试只一次run。删除db.init自动小A/两条学习记录和空题库两道演示题注入，迁入原验收显式typed fixture。默认老师/字典/空模板保留；已有无来源标记的记录未按姓名批删，日常库未清空。

固定 owned build2：323/SHA 9afa29f2d4083689c4945ea51619427327b7d6c6d4bebbf8758035ab64b580b1；正常build/tsc exit0，renderer111/111，原边界扩展34/34，原教育207/207（明确隔离legacy回归、显式fixture），正式真实DeepSeek/Pi UI iZe6lx 15/15 exit0、rendererErrors=[]。fresh/repeated/cold三业务表0；两旧别名同命令只有一个新增Pi run，返回与SQLite正文逐字相同，cold receipt/native JSONL SHA原样。6PNG实际审阅：兼容回复浅暗双尺寸4、原真实回复及旧历史2；无UI源修改/不宣称像素一比一。

首失败保留：qBUGFd功能10已过但cold locator变成两个assistant，改last；9W53Od实际两run均succeeded，模型在“兼容”和编号间加空格使硬编码复合字符串断言误报，改独立随机编号，并加返回正文与SQLite完全相同断言。未改模型输出，不删除失败，不宣称三连稳定。

Next：P2-03：抽出/退役旧 Direct、DeepTutor 与 Graph 编排装配；生产只注册 Pi 当前请求和控制，保确定性教育 Domain。停止为旧模拟参数补业务兼容。新接口从真实本地事实读取，不回填模拟结果。之后 P2-04阶段验收，再 Phase3五产品空间。

Master、HEAD、daily out SHA保持，无提交/push/新依赖/Schema/预算/密钥或系统DNS/proxy/VPN变更。本轮最终运行已核实际profile隔离；原P2-01首次默认profile偏好可能触及的事实保持。原用户日常联网/图片/凭证、无VPN/安装、完整教育黄金A–G、分发许可/安全/全UI人工仍OPEN。

稳定口径：新接口真实本地数据优先；旧模拟回填不进入生产，唯一Pi完整装配仍待P2-03。


## 2026-10-05 Phase2 P2-01 启动与旧 Runtime 边界接受

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING。P2-01 限定实现 A/C 接受，完整 Phase2 / Goal / 发布 / 人工验收 NOT_ACCEPTED。跳过测试样例说明书专项，Master 唯一主线。

RuntimeAuthority 由 main 决定，正常开发旧 env=0 与打包策略仍 Pi；legacy-test 仅明确 opt-in、未打包、独立 OS 临时数据/配置目录且无重解析。11 个旧编排 IPC 校验主窗口主 frame + runtime；sidecar 另有内部保护；生产不重建旧 pending input。Host 默认 Pi；App 准备/失败/重试不显示旧 Console。显式 launcher --user-data-dir 在 ready 前同步 app userData/sessionData，无 switch 不改路径。保教育 Domain、旧数据与传统页面，不新增 loop/依赖/Schema/预算/上传。

固定 owned build3：323/SHA 81acedfc0e0cad93d3a7d30189c83792a1b160406fa9f5b19789b0175d7c17fe；正常 build/tsc exit0，renderer111/111，运行边界22/22，原教育207/207（另核实际 profile 与 legacy-test），正式真实 DeepSeek/Pi UI vazbqj 13/13、rendererErrors=[]。最终10 PNG逐张读取；准备/失败浅暗双尺寸8处正文对比最低5.39336466369807，旧历史与实际教学回复2图。发送清空、唯一 succeeded Pi run、冷重启无再投递。详见 docs/goal/PHASE2_P2_01_ACCEPTANCE.md 与 apps/desktop/test-results/goal/phase2-runtime-20261005/closeout.json。

下列入站清单保留为施工前事实。P2-01已接受，P2-02–04仍未完成；旧接口目前拒绝是边界阶段，不是兼容能力交付。

Next：P2-02旧 Console/直接请求兼容 Facade 到同一 Pi，先请求校验、单次投递与原 AiConsoleRunResult 接缝，再续跑/停止/问答/重试。禁用旧入口不等于教育能力迁移完成；P2-03重复装配退役、P2-04完整阶段验收随后。

日期：2026-10-05。唯一主线：XIAOZHI_CODEX_GOAL.md。Phase1九项工作台实现接受；本合同为下一步骤，尚未进行Phase2生产迁移。

## 1. 目标与当前真实调用

M01/M10：正式教师操作只有Pi发起Agent模型/工具循环。保留教育Domain、SQLite事实、原文件、来源/教师确认与传统页面。

|入口|当前事实|处置|
|---|---|---|
|App.tsx:378/381/1856/2759|初始piEnabled=false，异步isXiaozhiEnabled；为false显示旧Console，主默认进入ai|改为正式Pi唯一工作台，准备/失败用原组件，不能切回旧Agent|
|production-host.ts:85|OMNI_EDU_XIAOZHI_PI=0仍关闭Pi|制定仅受控隔离测试的legacy允许条件，正式打包/正常开发不接受旧loop回退|
|preload/index.ts:321–334|旧runDeepSeek/runDeepTutorConsole和start/continue/mutate/input/cancel/stop仍typed暴露|逐项兼容adapter或明确退役；保已有调用者返回类型，不丢教师事实|
|main/index.ts:1282–1294、1701、1738、1834、1847、1867、2127|旧DeepTutor/Graph/直连生成handlers仍注册|抽出legacy/runtime入口模块；生产主frame权限在入口核；迁移后旧loop不可被调用|
|main/index.ts:startDeepTutorTurn|懒启动Python bridge，恢复/预算批准可另续旧loop|先核启动前旧checkpoint处理，不自动重放/绕过权限；对未迁移历史明确只读/中断，不篡改native|
|bridge.py:919/1167/1176|真正导入、构建并run DeepTutor AgentLoop|Phase2退役生产编排；学习掌握度/领域schema/retrieval等保留作Pi Capability，Phase4深化|
|ai-harness/agent-loop.ts完整函数|route→compileAiContext→trace，只有固定本地遍历，无模型Agent循环|保留Domain，必要时明确命名；不能按Loop名称整删|
|LangGraph triplet|main仍注册resume且旧Console可走Graph|保数据/readback，三元需求暂停；不新增题组功能，不留第二生产AgentLoop|

当前入站6文件SHA固定在owned phase2-ingress.json。源码图有遗漏/历史快照节点；已按实际文件核对，不把静态无调用数当不可达。

## 2. 候选比较与复用

A采用现有Pi ProductionHost/typed start/snapshot/stop/answer/queue及Domain，新增薄兼容Facade与RuntimeAuthority入口约束；选A。B把DeepTutor/OpenMAIC全Runtime搬入，不符合唯一Pi，拒绝。C全重写教育Domain或删除旧数据，拒绝。Hana的工具/会话/恢复接缝已在当前Pi可用，直接复用；SDK升级须核最新官方源码/变更/锁版本而非盲升。没有因为截图是Codex便接入Codex CLI。

## 3. 实施顺序与验收

1. P2-01先冻结RuntimeAuthority与legacy兼容边界：正常/packaged Pi唯一，受控测试须明确允许、无真实教师数据；梳理启动前restore、IPC来源、旧会话读取。新代码前保存实际source/文档快照。
2. P2-02将旧Console/直接生成调用路由到同一Pi host，统一取消、问答、steer、retry/snapshot，保Domain可调用、旧类型明确adapter；迁移不能只是把旧按钮禁用却失去教师业务。
3. P2-03退役第二loop的生产注册/worker启动与隐式恢复，确认实际引用清零；旧checkpoint显式中断/只读而非自动续；保可回滚原数据。
4. P2-04真实普通教学任务、工具/控制/自动压缩与冷启动，证明只一个Pi loop、一次模型投递、无预算、真实缓存usage口径、旧数据可读。全部过验再Phase3。

共享契约→main/domain→typed preload→renderer→实际用户操作→SQLite/native/file readback；正常npm build、renderer、针对性边界/正式Electron、相关原主路径与视觉；不扩大为测试样例书专项。改关键源先比Pi/Hana/DeepTutor/OpenMAIC已实现，禁止新造loop。未查证的新依赖不可引入。

## 4. 兼容、失败与回滚

不得删除旧会话/题库/确认事实/原文件，不批量重写native JSONL或创建指纹，不在恢复中重放外部操作。不要先卸载依赖再替换实际调用。迁移仅incremental adapter，既有传统教育页保持；test-only legacy隔离于正式生产权限。每切片原source/doc、build SHA和首失败保留，回滚只本轮差异；正式入口错误可见，Pi准备失败不自动启动旧loop。日常profile/out/key保持，任何真实数据不可逆动作先停。

## 5. 当前未完成

本轮只核实旧入口并冻结下一实施方向，未实施唯一Runtime，未宣布第二loop已退役。完整Goal、Phase3–8和人工/发布门禁仍待完成。
