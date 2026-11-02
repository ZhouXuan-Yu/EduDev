# 知识库与智能组卷：唯一当前执行索引

## 2026-11-03 续题原文对应已修复，独立答案质量仍失败

真实原两页新批次6次HTTP200，109884tokens；第9题完整两问/A–D和1条实际填空线通过原文/来源/一致性门禁，1/6为AI自动稿、5待核。但解析仍以同一物理效果给相反选项判断，三稿一致未发现；该AI自动稿不能视为答案正确，独立质量验收仍exit1。合并后的实际题本原件2→3页、双尺寸及冷启只读3项通过、0新模型/0renderer错误，质量失败不改。

下一主线优先复用原答案册pair/index/work/writer打通结构化图题：现propose明确排除q.document，不能只删guard；须补独立答案PDF的版本化角色证据、document/archive/journal同步与来源校验，按章节/题号/原文匹配并保留答案冲突和教师修改。再处理其余待核题、前页续题归属及题级证据，接联网补答、整书→Pi检索组卷和自然10→40GB召回/恢复/P95/内存/安装交付；不盲目增加同稿复读。完整Goal active，AT数不变。 新创建开关OMNI_EDU_AI_CONTINUATION_TEXT默认关闭，回退保持未设/0；保留v1/v2读取、本地校验器、原件/PNG/三稿/失败与教师事实。D协作者工作树、运行时和受保护stash未动，正常推main和知识库分支，最终远端一致性以Git读回为准。

证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#continuationTextTrial；10件受控日志/构建/脱敏实测摘要及逐件hash见docs/research/evidence/continuation-text/20261103/manifest.json。自然原件、截图、OCR、请求响应、数据库与账户留在本机，不上传。

## 2026-11-02 同题归属裁图与整卷质量失败

新裁图策略在原成熟版面/PDFium/RapidOCR/原队列上保留重叠图注、完整分割同题块。原同稿离线72→60组，边缘问题6→2题，第8题补出6组。自然完整六页18次均HTTP200，60组真实OCR各一次成功、0局部失败；但仅4/15 AI自动稿、11待核、0合格图题，质量断言exit1保留，未通过整卷验收。新策略仍默认关闭，不能声称质量已达标。

下一主线先做通用跨页父题拼接与来源绑定，再细化题级证据及OCR/公式/填空完整性；不继续盲目重跑三遍。第9题虽页内图/OCR一致，但原图第3页确有续小问，当前拦截正确；第2题仍图义投影分歧。已知答案/联网补答、Pi整卷、自然10GB/40GB召回/P95/内存与安装交付仍OPEN，Goal active。

证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#ownedCropGeometryTrial。

## 2026-10-29 当前知识库线程入口

当前专用分支codex/knowledge-base-reuse-implementation已整合协作主线；OCR原图文字纠错与自然题库检索实读的新有限通过见WORK_PROGRESS与KB_IMPLEMENTATION_EVIDENCE。下方2026-10-12等Next为历史，不覆盖当前KR队列。未完成：真实第4图题接原生v3、跨页/答案册、自然质量、实际40GB长期导入和受管安装。完整Goal继续。

<!-- feature-priority-20261012:start -->
## 2026-10-12 功能优先执行中

功能优先规则保持；F1页面文字位置→真实Pi候选本片限定接受，完整识题质量仍DOING。已不再是上一轮仅文档规划状态。当前真实结果、首次失败、边界与下一项见下方kb-s6-current和FEATURE_FIRST_EXECUTION.md；历史Next不覆盖当前队列。
<!-- feature-priority-20261012:end -->

更新时间：2026-10-12。Master ACTIVE；Phase 4/5 DOING。完整模块未完成。HEAD/origin HEAD：488f8109d68027a6eb488e9d04c4eb5073d153cd；工作区未提交改动保留。

## 固定目标

1. 教师资料 → 本地解析/索引 → 结构化题库/知识库 → 蓝图组卷 → 教师确认 → 学生卷与教师解析 Word/PDF。
2. 错题照片 → 本地 OCR/教师校正 → 知识点/错因 → 相似或变式题 → 教师确认的针对性练习。

Pi SDK 唯一编排；SQLite/本地文件唯一事实来源；来源版本、教师审批、取消/幂等和隐私规则不可绕过。通用聊天、学校平台及独立解题 Agent 均不作为本专题前置。

## 当前读点

## 2026-10-12 当前：C3-C1恒等式校验限定接受；C3-C完整质量DOING

Current Phase：4/5 DOING；Master ACTIVE。Current Task：KB002-C3-C完整解析覆盖与自然复杂三模式整卷；专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，origin HEAD本轮只读核对一致，未提交）。

Done（本片限定）：复用现SymPy1.14.0固定Worker，mathChecks新增identity核对单变量x有理系数四次以内恒等式。真实x³−147x−686的错误分解被主进程mismatch隔离，同Pi带原repairReference修复为(x+7)²(x−14)；教师看列出的等式并明确核对后保存一题，失败前版仍隔离，冷启回读无模型重放。identity计划绑定analysis，改关联解析不沿用旧结果；旧expression/polynomial hash保持原值。结果conditionsVerified=false、answerVerification=not_run不变。

Evidence：apps/desktop/test-results/goal/kb-identity-20261012/progress.json。build/type exit0，SHA 25472fd6bd894ce04f6855a40d54362b61ec1dec7182a3ebfe1805d8e7a0c2ed/346文件；6个真实本地定向实例（正确/错符号/同根不同系数/变量分母拒绝/解析改动废止/旧hash兼容）；正式Electron真实Pi错误→修复1项（education-journey-adA70M原失败报告保留），复用同一已保存候选继续教师批准与再冷启2项（recovery-report.json）/2次补验启动/0renderer错误。浅1366×768、暗1920×1080审核截图已实看。未重复全量领域、组件或207回归。

Failed：首次脚本在修复校验落账前读history；第二次选择器同时命中前后两份回执。均为实例脚本问题，修正等待/精确当前回执后在原候选继续批准，不再次模型生成。原始日志保留。旧12题fixture数学事实未自动修改，仍不得据文件交付通过声称全卷正确。

Doing/Next：C3-C完整解析步骤检查覆盖、条件映射与自然复杂图文三模式100分卷/24题分层质量→D错题五变式→KB003后台增量/任务优先/30–40GB/安装。当前每题可选一项形式化计算，未自动提取所有解析步骤；工具调用仍由同Pi选择，不能据局部matched断言完整答案正确。需继续补多步骤覆盖及教师可见缺口，不以LLM置信代替正确性。Blocked：无。

Reuse/边界：沿原Pi注册/schema、同审核ledger/修复隔离/typedIPC/UI和固定SymPy，不新增依赖/DDL/AgentLoop。官方Poly API已核；DeepTutor/OpenMAIC官方HEAD只读取得但不等于完整最新版能力审计，指定本地根目录当前不存在，未虚称新源码已迁移。DeepTutor既有格式Worker继续使用；课堂/Hermes支线后续。前片C3-B四文件交付证据保留apps/desktop/test-results/goal/kb-paper-output-20261012/progress.json。用户正式资料/数据库/凭据与Master未改，未提交/push。

## 按依赖继续，完成一项再切下一项

| 顺序 | 教师可见结果 | 状态/完成门槛 |
|---|---|---|
| S2/S3 | 中文关键词及硬过滤、保守去重、source_only 100分蓝图/缺额/版本快照 | 各自受控范围限定接受；不是全库语义质量或数学正确性 |
| S4 | 错题确认 → 本机Top10候选 → 同Pi实读 → 5题受审练习 | 限定接受；关键词关联，非通用语义准确率 |
| S5 | 学生/教师Word、PDF，来源谱系、图片审批及冷读 | 文字整卷/自然单题分别限定接受 |
| S6-A | 自然扫描整卷完整题干/图表/公式、四文件、Office/WPS | 限定接受文件交付；排版/自然数学质量仍OPEN |
| KB002-A/B | 答案验证合同、同Pi修复、未通过隔离、教师复核 | A1/A2b/B限定接受；不是整题正确性或通用修复保证 |
| **KB002-C3（当前）/D** | 三模式整卷；复杂图文难题与简化集中审核；错题5道变式 | C1/C2限定接受；三模式准入/混合配额已验，整卷内部批处理/集中审核/五变式未完成，禁止AI偷补缺额 |
| KB003 | 后台增量整理、任务优先、取消恢复、大资料库 | 现解析队列可复用；增量30–40GB和Windows安装实测待做 |
| 专题收口 | 当前导航完成两条闭环；旧数据/备份恢复/安装 | 尚未完成；构建和低层smoke不能代替教师真实实例 |

## 证据与合同

- 历史C1证据：apps/desktop/test-results/goal/kb-original-ai-20261011/closeout.json（首次失败、RED/GREEN、冻结源码/build、精确门禁、截图、回滚副本）；B历史见kb-repair-20261011/closeout.json。
- S5-B接受证据：apps/desktop/test-results/goal/kb-office-rich-20261010/closeout.json。
- S6精确合同：[KB_S5_S6_DELIVERY_CONTRACT.md](KB_S5_S6_DELIVERY_CONTRACT.md)。
- KB002草案：[KB_GENERATION_DELIVERY_CONTRACT.md](KB_GENERATION_DELIVERY_CONTRACT.md)，实施前补全具体共享类型/迁移/IPC和门禁。
- 总专题方案：[XIAOZHI_KNOWLEDGE_EXAM_TECHNICAL_PLAN.md](XIAOZHI_KNOWLEDGE_EXAM_TECHNICAL_PLAN.md)。
- 原索引完整副本：apps/desktop/test-results/goal/kb-natural-paper-20261011/before/KB_EXAM_ACTIVE_TASK.md；历史阶段仍见Goal状态/验收台账，本文件仅保留一个当前执行点。


### 2026-10-12 本轮增量：C3-A仍DOING，根目录启动器已更新

- 主线进展：现审批账本整卷集合v1与子批v6绑定、精确配额、同事务批量确认/回滚及跨批重复冲突隔离已写入；独立真实SQLite专项11/11（boundary-2）。普通工具原保护保留。Pi集合协调器和独立会话scope代码已写并通过当前build/type，但尚未接入production host、typed IPC和集中审核UI，未做真实Pi/Electron整卷验收，不能标C3-A完成。
- 用户临时指定根目录启动器：启动小智.cmd增加Node/npm/依赖检查、明确更新和失败提示；npm start固定当前源码构建、同out的main/preload/renderer，清理已有验收/旧页面继承变量，NODE_ENV=development。构建失败不打开旧版，沿已有单实例/构建变化重启机制，保留原数据与模型配置。根目录cmd实际执行exit0，现有日常窗口保留。
- 当前构建5cf07d516af255cd2a38c088771b39a85c9286436f1fff20796a60afcdbe5aae；npm run build exit0，组件217/217；日常正式Electron入口8/8、2次启动/冷读、0renderer错误。报告test-results/daily-entry-3WLecV/report.json；当前聊天浅1366×768/暗1920×1080及学生同尺寸两图已实看。首次隐藏窗口动画停滞、第二次冷读尚loading的脚本失败保留，复用已有hiddenSnapshot策略及等待真实session加载后第三次通过。
- 失败：领域全套首次164项后worker timeout，见domain-startup.log；不是完整领域验收通过。第二次重跑160项后同为worker timeout（domain-2.log），尚未定位根因，未改超时保护，领域全套仍未通过；首次失败均保留。不把12道合成函数机制题当独立数学正确性或全科难题证据。
- Next：先定位并修复领域worker timeout，再完成集合原生工具测试→production host/typed IPC→集中审核UI→真实Pi超过8题/取消/冷读/双尺寸视觉→现实三模式100分卷/Office和24道跨学科复杂题；再D五变式→KB003。Master ACTIVE，完整目标不变。未提交/push，不改凭据、日常业务资料或数据库结构。
- 本轮证据根：apps/desktop/test-results/goal/kb-paper-collection-20261011；startup-before为启动范围原文副本，before为C3副本；question-quality两行导出修改的原文是逆向本片patch重建，并非修改前抓取，已明确标reconstructed。


## 2026-10-12 当前：整卷集中审核主路径已实例通过，C3仍DOING

Current Phase：4/5 DOING。Master ACTIVE。Current Task：KB002-C3-A/B；知识库与智能组卷完整专题未完成。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd，工作树dirty未提交。Blocked：无。

Done（本轮实例范围）：生产Pi注册三个整卷工具及独立scope；typed IPC、snapshot/event和聊天集中卡贯通。复用原题目编辑器、DeepTutor原格式校验与HeroUI ChatTool/Checkbox/Button；内部批次不逐批等待，修改重检后只勾选一次当前整卷，沿原SQLite同事务保存，再用原Paper流程预览并确认整卷。

Evidence：apps/desktop/test-results/education-journey-BZG6HP/report.json，真实DeepSeek/Pi + 正式Electron 5项通过、2次启动、0renderer错误，12题100分且修改后版本确实入库，冷启无模型重放；build/type通过，SHA 2d71b324206380eadc664d3b7422017cb3849906fe68fa1759c1c585792d2e52/346文件。浅1366×768、暗1920×1080两张审核图已实际查看。原报告文案写8+4，是提示词期望；SQLite实际4+4+4，均≤8，复核已记本轮integration-progress.json，不修改原始报告。repo专项先前11/11保留，不当本轮全回归。

Doing/Next（顺序）：补齐中止/部分草稿跨运行恢复及自然语言默认整卷引导→C3-B最终整卷与Word/PDF连续交付/减少确认负担→C3-C自然复杂三模式100分卷与24题分层质量→D五变式→KB003后台增量/任务优先/30–40GB/安装。当前实例是合成函数分类题工作流，不证明自然图文、全科、独立答案准确率或Office完成。

Failed：首次构建把集合当作含callId的单批事件，已分支修正后build通过；首次实例脚本cwd错误未进入应用，修正后正式实例通过。此前全领域160/164后5秒worker timeout留存；math冷启探针约3.4秒，现只将math上限改为15秒（其它5秒、取消/输出/AST界限不变），四次方程真实SymPy实例matched/conditionsVerified=false；不声称已证明此前所有timeout根因或完整领域重新通过。

执行范围：按用户最新要求优先功能、仅构建和关键实例；本轮未重复全量领域/renderer/207回归。既有5秒失败不再作为无止境重跑主线，后续按具体风险定向验收。无新DDL/依赖/AgentLoop；Master未改、用户资料/数据库/凭据未改，未提交或push。回滚副本与精确日志见test-results/goal/kb-paper-collection-20261011/integration-before及integration-progress.json。

<!-- kb-s6-current:start -->
## 2026-10-13 当前：F2线性条件检查与同Pi修复限定接受，下一F3复杂错题

Current Phase：4/5 DOING；Master ACTIVE；Current Task：F3复杂错题照片→本地同类候选/不足时五变式→集中核对→针对性练习。F2形式化线性条件子片LIMITED_ACCEPTED，完整自动题意/全科可靠性仍DOING。Last verified HEAD/remote d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63，dirty未提交，独立Harness修改保留。

Done：复用已固定SymPy1.14.0/mpmath、原DeepTutor纯格式helper、Pi题目工具与现质量/修复/集中审核账本。新增有界linear_system适配（4变量/8有理系数方程/4目标），v2 Worker请求，原v1计算/恒等式/步骤不改；题干/答案原文片段绑定不可变mathPlans。判断形式条件矛盾、目标未确定、目标答案不符，失败沿math_mismatch隔离及同Pi最多三次修复。无关自由变量不误判目标不确定；教师编辑使旧计划失效。无新依赖/Agent/DDL/IPC；SQLite和原题事实真源不变。

真实实例：受控缺电压电路→实际DeepSeek/Pi提交→本地检查缺条件→同run返回修复引用→使用教师已授权220V修复→原审核卡明确核对→只保存一题→冷启动回读，无请求重放。旧错误候选仍隔离。6组定向例覆盖上一轮电路/浮力矛盾、修正、错误答案、无关自由量、绑定/旧v1；不是简单算术题或自评正确率。

Evidence：apps/desktop/test-results/goal/kb-condition-check-20261013/progress.json及commands.ps1。最终build/type exit0、SHA d5e07d5208754dff3952a3fff09eadcb5c4e7332a589ae36c6098794b1a528bd /348运行前后相同，组件217/217；正式msPBaf3项/2启动/0renderer错误，浅1366/暗1920实际查看。仅本片实例和必要门禁，未重复无关全集。前片11题100分混合卷及学生/教师WordPDF四文件仍见kb-natural-language-paper-20261013/progress.json，135分源卷不是原卷100分重建。

Failed/Recovery：56bGMX首次真实Worker已给缺条件，但旧ledger要求calculation完全等于表达式，新增说明令history unavailable，工具拿不到repairReference。改成严格状态对应的有限说明+完整不可变方程校验，未放宽来源/hash/审批。组件旧文案断言及诊断静态加载/cwd错误已修，首现场保留。before支持撤本片delta；保护正式资料和独立Harness区域。

Boundary：conditionsVerified=false、answerVerification=not_run仍保留。题干片段证明出处，不证明自然语言翻译、单位、物理规律或图义正确。实际Pi案例由教师提供明确形式计划，仅证明真实工具/隔离/同轮修复/审核/冷读，不称自主审全题、独立金标或全学科正确。复杂手写/图义与真人金标仍OPEN。

Next：直接F3复杂自然错题与练习，复用已通MistakeFacts/本地相似/五变式/PracticeReview，只修真实暴露缺口；随后F4长教材/30–40GB/安装→F5固定OpenMAIC课堂DSL/renderer/组件实际复用→F6 Hermes反馈候选/批准/下次使用/回滚。DeepTutor部分已生产复用，后两项尚未完成，不能用包探测代替。Blocked：无。
<!-- kb-s6-current:end -->
