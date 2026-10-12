# 知识库与智能组卷：唯一当前执行索引

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
## 2026-10-12 当前：KB003扫描资料按页接续限定接受；功能优先

Current Phase：4/5 DOING；Master未完成。Goal工具本轮读取为历史blocked，不能用文档伪称已恢复；本轮无技术阻塞，按用户继续指示推进。Current Task：扫描资料中断不再重复已完成页。Last verified commit：488f8109d68027a6eb488e9d04c4eb5073d153cd（保护dirty，未提交）。Previous turn：C3候选结构化转写。Next：复杂整卷候选自动整理与集中审核。

Done（本片限定）：复用现PDFium/RapidOCR逐页处理与MaterialRepository/确定性队列，私有v2请求支持已完成页接续；进度缓存按资料SHA/worker SHA/引擎绑定、严格页序/大小/完整性/路径校验、临时文件原子替换。停止或重启保留页进度；全部完成仍走现source CAS/lease/SQLite事务才提交正文，未完成页不是可检索事实。旧v1图片/预览/layout与正文引擎身份保留。损坏缓存重识别，旧runtime完整保留回滚。无新包、模型下载、额外模型调用、AgentLoop、DDL或IPC。

Evidence：apps/desktop/test-results/goal/kb-ocr-resume-20261012/progress.json；build/type exit0 SHA77a4ba6b3181df787756c9ff1f7064ba37fde3fa02d4f01dc740b321b0e0a3f6/348。正式Electron education-journey-MzsnED：3项/3启动/0renderer错误，真实六页物理扫描→完成1页后UI停止→零部分正文→重启/教师重试从第2页→六页事务提交→再次重启精确冷读，模型0次。缓存实例5项包含损坏/源版本隔离/恢复。没有修改前端，不新增视觉验收声明；没有反复运行旧全套。

Failed/Learning：首次patch上下文不匹配未写入；一次测试文件编辑工作目录错导致FileNotFoundError，纠正后完成。首E8mP4j实例已过，检查到接续流增加wire体积后，有限扩大传输边界而不放宽文档上限，重建并用最终MzsnED闭环核对。原始日志、两个实例与回滚before保留。

Doing/Next：执行表docs/goal/FEATURE_FIRST_EXECUTION.md。知识库/智能组卷整体DOING；下一整卷候选集中整理/审核→复杂100分卷与答案修复隔离→错题同类/变式→长教材/目录/30–40GB/安装→OpenMAIC互动课堂→Hermes教师反馈技能晋升/回滚。Pi唯一编排。每片功能可用后做对应必要实例，旧无关全套不作为独立功能前置；具体风险才加定向验证。

限界：仍为50页/50MiB/1MiB正文边界，不等于长教材或40GB验收。复杂图/公式自动识别及可靠答案、跨学科24题质量、安装、完整OpenMAIC/Hermes仍OPEN。上轮候选由明确用户参考转写产生，不证明自主看图。三项目复用清单是实施计划，本轮未复制OpenMAIC/Hermes代码或复核其HEAD。独立harness审计块保持。
<!-- kb-s6-current:end -->
