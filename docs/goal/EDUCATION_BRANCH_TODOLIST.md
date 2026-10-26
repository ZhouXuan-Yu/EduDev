# DeepTutor / OpenMAIC / Hermes 三主线执行清单

## 最新交接（2026-10-17｜上下文压缩）

本节覆盖下方旧快照的“当前/下一步”描述；历史证据保留。Master ACTIVE，Phase 4/5/6 DOING。智能组卷按用户要求移出当前队列；三主线为 DeepTutor、OpenMAIC、Hermes，当前教育唯一执行项为 DT-05。

- 已完成的限定切片：EV-MAIN-02 9/9；DT-03 read/review/history/concurrency 与 DT-04 plan 共43项；DT-05-questions 6/6。均仅按各自报告范围接受。
- 最新已核对报告：`apps/desktop/test-results/education-journey-WsXH6Q/report.json`，`DT-05-review` success=true，17/17，3次启动，0 renderer errors；buildAfter SHA256 `fed5e0bd3f9b3ea8c562c4e1cb185b16a296c1da379d112aa336697a515bc51c`，368 files。命令：在 `apps/desktop` 执行 `npm run test:education-journeys -- --scenario=DT-05-review`。这是2026-10-16已有运行，本整理轮只读取报告，未重跑。
- review 限定覆盖：真实题目来源→Pi/DeepSeek待审核候选→质量阻断/SymPy检查→教师编辑/确认/拒绝→原子保存与父子谱系→题库回读；错误答案隔离、编辑后重新审核、停止恢复、冷启动不重放、确认幂等。不能据此宣称全科教学正确或 DT-05 全部完成。
- 视觉状态：上一轮已查看 edited-dark 与 blocked-light 的1366×768截图；16张截图已生成但其余状态及1920×1080尚未全部人工查看。生成截图不等于视觉验收通过。
- 下一步顺序：补齐 review 关键状态双尺寸视觉检查→`DT-05-practice`→`DT-05-photo`→`DT-05-photo-facts`→`DT-05-photo-cycle`。每片先看首次失败，再修具体缺口；记录当前构建SHA、renderer错误、真实图/公式/答案、SQLite/文件回读和冷恢复，不扩大无关测试。
- DT-05达到上述范围后，继续 OpenMAIC 逐字讲稿/导入，再做三主线联动；Hermes既有明确/隐式呈现偏好仅 LIMITED_ACCEPTED。Harness按 `docs/goal/HARNESS_EXECUTION.md` 独立续接，Feishu S3/NET/IMG/FILE仍OPEN。
- 边界：Pi唯一编排；DeepTutor仅经现有Adapter/Provider；SQLite/文件唯一事实真源；保留教师确认、来源/CAS、student/session隔离、取消/幂等/冷恢复；confidence不等于答案验证。不得恢复第二运行时。
- 工作区：`gitbutler/workspace`，HEAD `e4763a1535e9692f57d0c5bc3cd162ef6fec98f7`，大量并行脏改动；本轮未重新联网核远端，未提交/推送，未改生产代码、数据库、凭证或用户资料。

<!-- handoff-current-20261016 -->
## 最新状态（2026-10-16 20:45）

唯一继续入口：[Goal 当前状态](CURRENT_STATE.md)。Master ACTIVE；Phase 4/5/6 DOING；智能组卷移出当前队列。

EV-MAIN-02 已 LIMITED_ACCEPTED：正式 Electron/DeepSeek 9/9，构建 fed5e0bd...。DeepTutor 当前切片 DT-03-read 7/7、DT-03-review 11/11、DT-03-history 10/10、DT-03-concurrency 6/6、DT-04-plan 9/9 均在同一当前冻结构建上通过；证据与边界以 CURRENT_STATE 为准。历史失败不覆盖。

当前唯一教育下一项：DT-05 题目与学习路径，先冻结 question/practice 复用、父子来源、教师确认、答案/数学校验、去重、练习引用、结果/错题/相似题和冷恢复合同。随后做真实视觉证据，再进入 OpenMAIC 逐字讲稿/导入。Harness 与 Feishu 不并入本清单，分别按各自合同恢复。


<!-- context-reconcile-20261016:start -->
## 2026-10-16 上下文恢复与状态纠偏

当前阶段与唯一教育继续队列见 docs/goal/CURRENT_STATE.md（从本文件按仓库根解析）；智能组卷移出当前队列，三主线继续。EV-MAIN-01/02、DT-03/04 与 MA 既有切片按 CURRENT_STATE 的最新范围解释；旧 NEEDS_FIX/未完成描述保留为历史证据，不覆盖当前限定接受状态。DT-05 仍需完成题目/练习/视觉证据，MA 逐字讲稿/导入仍 OPEN。

本轮只审查和整理文档，未修生产代码、未重跑业务验收。DT-05 是下一实施片；不把文档整理写成生产能力完成。未宣称完整 DeepTutor/OpenMAIC/Hermes 或 Phase 0–3 全部完成；历史记录按其当时范围保留。

已脱敏现场与校验：apps/desktop/test-results/goal/context-save-20261016/。可恢复的已提交历史归档 docs/archive/context-20261016/，不是覆盖前未提交长文的完整恢复。已有详细验收/决策正文保留，本节不改上游/权限/事实真源/安全边界。HEAD/远端读回 d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63，master dirty，未提交。
<!-- context-reconcile-20261016:end -->


<!-- ma-documents-status-20261015:start -->
## 2026-10-15 MA-MAIN-02-B2：讲义/备课稿 Word/PDF 限定接受，下一 Hermes 隐式反馈

Current Phase：4/5/6 DOING；Master ACTIVE。上轮 DT-FOLLOWUP-01 为 progress；本轮 MA 文档交付为 progress。智能组卷仍移出当前队列。Current Task/Next：EV-MAIN-02 隐式修订反馈→候选偏好→留出评价→版本化采用/回滚；其后 DT 独立作答/提示协助/视觉证据与其他模式，MA 逐字讲稿/导入继续 OPEN。

Done：教学内容→互动课堂新增 Word/PDF 学生讲义与教师备课稿入口，沿唯一 Pi 的 education_read_classroom/export_classroom、同一 Office 预览/明确审批/版本化保存。新增 classroom-document-office.v1，旧课堂PPTX v1不变；main确定性读取完整已确认版本/context，原生成/保存CAS保留，拒绝把课堂导出稿降级为无来源普通文档。学生讲义不附随堂题参考答案/解析；教师备课稿复用已有解析。完整课页由同一固定 OpenMAIC SlideCanvas 离线渲染为不可编辑图片，文字题目可编辑，不伪造教学讲述。无新 Agent/DDL/IPC/依赖/事实真源。

Evidence：apps/desktop/test-results/goal/ma-documents-20261015/{contract.md,before,research,domain-final.log,build-release.log,components.log,first-visual-failure.md,artifact-check.json,wps-handout,wps-teacher,progress.json,commands.ps1}；正式 Electron education-journey-9MIe8g 5/5、2次启动、4次真实Pi/DeepSeek导出请求、0renderer错误；四份真实文件及账本hash/源课堂/学习记录/冷回读核对。冻结build-release SHA c95a175107f78669b0a0f08d8c1288df58ea917c61d8135c19dec403e9ec86d5 /368，运行前后相同。build/type exit0，组件217/217、领域4/4。产品PDF教师3页/学生2页，各2张完整课页；两份Word在独立受控WPS12打开各2页，原文件hash不变。9页实际文件渲染及浅1366/暗1920 UI已查看，公式/完整长题/答案隔离可见。

Failed/Recovery：首次 ebHq89 操作成功但第一课页公式缺失，视觉拒收；显式加载本地KaTeX FontFace、等待fonts.ready及两帧后 NT8bBk 和最终实例恢复公式。首次脚本相对路径cwd错误未改源码，后续使用绝对根修正；保留初次日志，不以初次build作为最终证据。graph查询300秒超时；转定向已知源码。官方网页429，git ls-remote核HEAD ecb940c；官方raw讲稿导出与固定636fab0内容一致，MIT原文已读，无上游新代码复制或安装。

Boundary：教师备课稿不是逐字讲稿（现课堂没有speech actions），学生讲义只隔离quiz答案，课页原有文字完整保留，教师须检查是否适合发学生。图义/答案仍answerVerified=false；第二课页原有英文公式措辞和版面不因导出自动修改。PDF跨页题目会续页，不承诺像素一致或可编辑图形；教学文件列表同名文档需打开预览区分受众，后续可优化。未扩全量回归/容量/组卷；完整Golden E/全科复杂图/导入/逐字讲稿/无VPN/安装/全部DeepTutor/EV留出仍OPEN。

Last verified commit：d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63 dirty；未commit/push。回滚before及本片新增classroom-document-pages.ts；保留独立Harness脏改、原资料/配置/凭据/课堂/正式产物。后续按唯一队列推进，不重回组卷。
<!-- ma-documents-status-20261015:end -->


<!-- dt-followup-status-20261015:start -->
## 2026-10-15 DT-FOLLOWUP-01：单次作答续接限定接受，下一 MA 教学文档交付

Current Phase：4/5/6 DOING；Master ACTIVE。智能组卷已按用户要求退出当前队列。DT-FOLLOWUP-01 仅“选中实际作答→同学生Pi复盘/讲解→冷恢复”LIMITED_ACCEPTED，不称DeepTutor整体/教育正确性完成。Current Task/Next：MA-MAIN-02-B2 已确认互动课堂→讲义/讲稿 Word/PDF；随后 EV 隐式改稿反馈/留出评价，再回 DT 独立作答/提示协助/视觉证据与剩余模式。保留JOIN-01已验接缝，不重跑组卷。

Evidence：apps/desktop/test-results/goal/dt-followup-20261015/{contract.md,before,slice.patch,research,domain-current.log,build-current.log,components.log,progress.json,commands.ps1}。正式 Electron H7RATs：3/3操作检查、2次启动、2轮实际Pi/DeepSeek、0renderer错误；原IaAkgM已保存概念学习结果克隆至隔离profile，实际工具逐轮返回选中来源与完整观察，学习事实/确认计划未改。冻结build-final SHA dd2a8a8412948bb93601b35f2d25718700ee6168ff78dfe236ed8a593ea1bfc5 /366，运行前后相同；build/type exit0，领域13/13，组件217/217，diff exit0；浅1366/暗1920截图实际查看，两按钮可达，长计划需滚动。

Boundary：本例缺少完整题面/逐字作答/图形，不作为数学正确性验收。最终解释仍出现“同乘可能丢失解”等不严谨泛化，答案/讲解未经确定性或教师验证，不得标已验证、不得写学习事实；后续DT教育质量门禁需结合真实原题/答案与协助证据解决。本片只接受证据续接、事实语义及操作功能。全部DeepTutor模式、transfer真实调用、全科/复杂图、MA Word/PDF/导入、EV隐式优化/留出、安装/容量/无VPN仍OPEN。

<!-- dt-followup-status-20261015:end -->

<!-- join-status-20261015:start -->
## 2026-10-15 JOIN-01：三主线接缝限定接受，继续 DeepTutor 长期辅导

Current Phase：4/5/6 DOING；Master ACTIVE。智能组卷已按用户要求移出本轮队列。JOIN-01 的“同一学生/资料/偏好→辅导→互动课堂→教师修订→PPTX→冷恢复”接缝 LIMITED_ACCEPTED；不称三个上游完整融合或 Master DONE。Current Task/Next：DT 长期辅导续接，随后 MA 讲义/讲稿与导入、EV 隐式反馈评价，按下方唯一队列执行。

Done：阅读页新增“用这一段制作互动课堂”，复用唯一 Pi、原 DeepTutor 引文核验、固定 OpenMAIC 生成/归一/沙盒/编辑器/PPTX及既有 Office 审批。main 只收集本轮真正送达模型的段落，classroom-context.v1 保存原 MaterialSource/正文版本、脱敏标题、送达字数/截断、OCR未校对标记和冻结偏好 revision；不保存私有笔记/原件路径/学生事实。课堂 stage、教师确认、Office最终提交在原事务内复核资料账本hash/正文/隐私；教师改内容不替换来源，Office精确快照保留相同context，旧无context课堂兼容。无新增 AgentLoop/DDL/IPC/依赖或事实真源。

Evidence：apps/desktop/test-results/goal/join-20261015/{contract.md,progress.json,commands.ps1,before,domain.log,build-current.log,components.log}。实际物理扫描卷沿已接受 nYQae6→fkMAqF 的真实本地OCR记录复用到隔离副本；正式2OltyJ完成5个实际操作检查、4轮真实Pi/DeepSeek、1次启动、0renderer错误；Vst2vG冷恢复3/3、2次启动、0模型重跑、0renderer错误。冻结build SHA 9e0ea7864648523eaa821dc84bb66c43b97f611f86e55efa9ba67906f5b22b62 /366，冷验前后相同；build/type exit0，领域11/11，组件217/217。PPTX 103568字节、5页，经现WPS12独立受控COM打开、转PDF且原件hash未变，5页PNG与浅1366/暗1920 UI已逐页实际查看。资料段落、6条既有阅读记录及学生学习事实不改，偏好head/revision始终1。

Failed/Recovery：h6bocz在学生会话切换未完成时取旧snapshot，已改等待真实student绑定；2OltyJ所有5个业务步骤成功，但收尾错误断言将每轮应追加的偏好应用event与初始反馈数组全等，故其report.success=false（保留原报告）。修为head/version不变、4个run应用证据合法，再原位冷读Vst2vG通过，不重生成四轮。一次并行prepare被原宿主resource_busy拒绝，模型实际按工具错误重新准备后成功；未放宽并发/授权。首次部分源码写入时build TS失败保留build-first.log，完整修复后当前build成功。

Boundary：原图1没有上传/读取，生成图明确“教学示意（非原图1）”；两题经本轮物理条件复核为向上3.3N向下、教学变式下落2.3N向下，仍answerVerified=false，无独立标准答案gold。视觉检查发现生成页标题“三步”对应4个提示、图底来源说明与箭头轻微交叠；来源按钮/确认/导出可达，JOIN只接受接缝，不称内容排版或教育正确性全量通过。PDF为WPS验收转换，不是已实现产品PDF导出。全部DeepTutor模式、复杂图/全科正确性、OpenMAIC全部DSL/Word/PDF/导入、隐式优化与留出评价、安装/容量/无VPN仍OPEN。

Blocked：无。Last verified commit：d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63（dirty；本轮远端未重新核验）。无commit/push；用户资料、配置、凭据及独立Harness修改保留。回滚仅按before撤本片接缝delta和新增classroom-context/ClassroomSources，不回滚其他未提交变更，不删除已确认课堂/偏好/正式产物。
<!-- join-status-20261015:end -->

### 当前唯一推进队列（历史条目不覆盖本节）

|顺序|主线与教师可见结果|当前状态 / 下一步|
|---|---|---|
|1|JOIN-01 同资料/学生/偏好→辅导→互动课堂→教师改稿→PPTX|本片接缝 LIMITED_ACCEPTED；不重复模型链。生成版式瑕疵作为MA内容质量修复项保留|
|2|DeepTutor 长期辅导：最近错题/真实练习结果→下一任务→提示/详细讲解/错因复盘/相似训练→教师记录→继续|DT-03/DT-04 当前构建切片 LIMITED_ACCEPTED；DT-05 题目/练习/相似题/视觉来源为当前下一项，见 CURRENT_STATE|
|3|OpenMAIC 课堂教学交付：图示修订、讲稿/讲义Word/PDF、导入|MA-MAIN-02-B2 讲义/备课稿Word/PDF四组合限定接受（9MIe8g）；逐字讲稿/导入及课页内容质量仍OPEN，待 DT-05 后继续，不整搬上游服务|
|4|Hermes 式后台学习：教师实际改稿→候选偏好→留出评价→版本推广/撤销|OPEN：已实现明确偏好保存与应用；下一扩真实修订信号和效果门禁。许可未核齐不得复制Hermes代码；不自动改事实/代码/权限|
|5|三主线自然日常使用与Master剩余门禁|OPEN：功能补齐后做有界联合恢复/隐私/安装/无VPN；不以本片替代完整Golden E/F/G|

每一片先Reuse/Compare/合同，再实施并做必要实例，更新Goal4/稳定CURRENT/根4。第2项按当前 Goal 顺序继续 DT-05，随后转 OpenMAIC；不回退知识库/组卷测试长队列，不为了通过实例再建runtime或真源。

<!-- join-contract-20261015:start -->
## JOIN-01 交付合同（实施前冻结）

目标M02/M08/M09/M10：教师从资料阅读一键请求互动课堂，同一Pi会话沿用学生与已保存教学偏好，真正实读指定段落后生成课堂；教师修订确认→Office预览/审批→PPTX→重启回读。资料正文、学生事实与笔记不自动修改，未核对OCR不称教材正确答案。

现状：MaterialRepository/MaterialSource已有正文hash、隐私及源变化检查；office_read_material已实读但只向本轮observedMaterials记文件hash；课堂账本保存会话/学生，没有段落来源及采用偏好版本，导出也无此链。阅读只问答，无课堂入口。优先扩这些接缝，复用Pi、固定OpenMAIC生成/编辑/渲染/PPTX和现HeroUI Button/MaterialSourceNavigation，不新建Agent、数据库或来源真源。

Compare：A导入完整DeepTutor/OpenMAIC工作区会增加runtime/服务且复制资料；B另建上下文数据库重复事实；C现有MaterialSource+课堂payload可选context引用+已有Office源快照，选C。现参考目录为D:/WorkProject/小智智能体借鉴项目，OpenMAIC636fab0、DeepTutor be170110本地已核；DeepTutor有用户脏改不改动；最新官方仓库页面已读，本片不升级/复制新上游源码，保留已审计固定依赖与许可证。HeroUI官方Button文档已核、复用当前组件。graph查询300秒超时，使用定向源读取。

合同：新增classroom-context.v1，只存本轮实际送达段落的MaterialSource、脱敏标题、送达字数/截断标记和本轮冻结偏好revision；不存私有笔记/学生事实/路径。来源只能main实读回调收集，不接受模型/renderer传入；课堂stage事务重验正文/隐私/文件hash，教师确认与导出最终CAS再查，变化失败，不偷补。既有无context课堂保持兼容；教师修订保留原来源，不得注入或替换。Office快照携带同context，旧稿合同兼容，无DDL/新增IPC/依赖。

改动：shared可选context及验证、main实读证据/事务校验、课堂工具/账本/Office编译；阅读页增加同款按钮、课堂及Office来源展示复用原来源跳转。失败显示来源已变化/拒绝，不静默移除来源；取消/幂等沿现宿主。回滚before加本片新增文件，保留原资料/课堂/偏好/正式产物和独立Harness改动。

验收：有界来源/隐私/幂等/教师修订/旧课堂兼容/源变更CAS例；build/type、相关组件；一组正式Electron/真实DeepSeek资料→阅读辅导→实际课堂→教师修订→真实PPTX→冷恢复，核SQLite/native/实际图公式及浅1366暗1920。只相关实例，不重跑组卷或容量。未通过不标完成；全科正确性/完整三项目/安装/容量/无VPN仍独立OPEN。
<!-- join-contract-20261015:end -->

<!-- ev-feedback-status-20261015:start -->
## 2026-10-15 当前：三主线已交付首批功能，下一 JOIN-01

Master ACTIVE；Phase4/5/6 DOING。智能组卷已移出当前队列。DeepTutor 阅读/笔记续接与学习计划辅导、OpenMAIC 课堂生成/直接编辑/教师确认/PPTX交付已分别限定接受；本轮 EV-MAIN-01 普通反馈偏好子片 LIMITED_ACCEPTED，不称三项目或自进化全部完成。当前任务转 JOIN-01 三主线共同使用。

教师现在可直接说“以后讲解详细些，分步骤，先给提示再给答案”，后台生成固定枚举偏好，经本地合同评价/版本/CAS保存；新会话自动采用，重启保持，普通聊天“撤销上次记住的教学偏好”追加回滚版本。只复用同一Pi的protectedContext、原app_settings/私有事务与普通聊天；无新Agent、DDL、IPC、模型调用或依赖。当前请求优先，不把学生事实/答案/授权当偏好，原始反馈不复制到模型动态上下文。

Evidence：apps/desktop/test-results/goal/hermes-20261015/{progress.json,commands.ps1,before,research}。最终正式Electron hbi02B：4/4、2次启动、4次真实Pi/DeepSeek回合、0renderer错误；普通反馈→新聊天顺逆流多步讲解→冷恢复→撤销→新聊天已撤销上下文，SQLite/native记录均核对。build cd493923b0ba0ea4a4f4e7157671aeedee4acd6f323d9912bfc627b4bf3175bc /366，前后相同。build/type exit0、组件217/217、领域contract-h9aufY 8/8、diff exit0。浅1366/暗1920截图已实际查看，消息区可滚动。

首次h15FB0实际已保存偏好，但模型又询问详细档位形成waiting_input；已修动态上下文明确保存成功、不重复问档位/技术配置，最终实例通过。否定表达反向匹配、旧TS库Object.hasOwn及生产SQL私有接口差异已处理，失败现场保留。Hermes HEAD0a929e3aa20e15cf04dc7c28492a7d41a5139125源码已读；README/pyproject声称MIT，许可原文仍未取到，因此仅参考候选/评价/版本/回退思想，未复制其代码或安装GEPA/DSPy。

边界：本片只验明确中文表达偏好；评价是枚举合同一致性，不是教育正确率。隐式修订信号、留出效果评价、routing/retrieval优化、效果下降自动回退仍OPEN；表格/导出偏好未逐项真实交付验收。完整DeepTutor各模式、OpenMAIC PDF/DOCX/导入、全科图义正确性、安装/容量/无VPN仍OPEN。HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63 dirty；远端TLS失败未核，无commit/push，独立Harness及真实数据/配置/凭据保留。

Next：JOIN-01先复用资料阅读/学习计划的上下文、现课堂工具与Office宿主，补“同一资料/学生→辅导→互动课→教师修订→教学文件”缺口；保存当前偏好版本与真实来源，不追加第二运行时或自动学习事实。完成接缝实现后仅一组联合实例；随后DT剩余模式→MA交付/导入→EV隐式反馈与留出评价。回滚仅撤本片观察/注入与新增领域文件，保留偏好历史与原教育事实。
<!-- ev-feedback-status-20261015:end -->

<!-- ev-feedback-contract-20261015:start -->
## EV-MAIN-01 实施合同：普通反馈到下次采用

M10，教师可见：正常说“以后讲解详细些，分步骤，先提示再给答案”等表达习惯，小智后台记住；新会话自动采用，重启仍在；“撤销上次记住的教学偏好”可恢复旧版，无技术配置/每次授权弹窗。第一片涵盖讲解长度、讲解顺序、段落/表格、交付格式；不把此片称整个Phase6完成。

现状审查：现L2/L3教育记忆由教师选择及授权读取，含事实，不能挪作自动全局偏好；managed-skills已有Pi parser/包验证/版本与epoch，不能自动改SKILL.md。现app_settings可存独立主进程键，session-state Sql已有事务和CAS，Pi protectedContext已在每次实际prompt前注入当前本地安全上下文且位于稳定prefix之后；因此复用这些接缝，无新增Agent、DDL、IPC或UI库。

Recherche/Compare：2026-10-15实读Hermes README、evolution/skills/evolve_skill.py、skill_module.py、core/constraints.py；HEAD0a929e3aa20e15cf04dc7c28492a7d41a5139125与此前一致。README/pyproject声明MIT，但LICENSE/同名md/txt均404，API树403，尚无完整许可原文，生产不复制其代码/安装DSPy/GEPA。真实constraints只含大小、增长、非空、frontmatter检查，不能等同语义/教育正确性。A复用L2/L3全局化会破授权，不选；B完整GEPA额外模型/依赖及许可未齐，不选；C复用Pi稳定上下文与现本地Sql，将Hermes trace→candidate→eval→version→rollback思想适配为有界偏好策略，选C。后续许可齐全且有真实留出反馈时再接纯候选优化；不以“来自Hermes”虚称源码迁入。

合同：teacher-preference.v1；仅固定enum，无任意prompt/代码/学生信息。主进程读取已持久化且与当前run/session绑定的真实user消息；只接明确面向将来的一般表达要求，拒绝引用、假设、否定歧义及敏感/权限要求。生成候选→schema/敏感/互斥/本次明确要求回放/未改变字段门禁→app_settings独立namespace追加不可变版本与本地证据（message/run引用及hash，不复制正文），head事务CAS；幂等以run为键。撤销也追加版本、不覆盖历史。当前请求优先；每轮开始冻结所用版本，正文不含原始消息、学生事实和本地路径，中途不改系统prefix/工具。

改动：shared教师偏好合同；education领域偏好候选/评价、私有SQLite状态；session-state组合；production-host在已持久化用户消息后观察、向原protectedContext追加本轮固定偏好、保留应用证据。已有普通聊天承担操作和反馈，无单独技术设置。失败明确不能声称已记住；未知schema拒绝，不忽略损坏并恢复旧偏好。

验收：先边界/旧库无迁移/重复run/并发CAS/撤销/重启/引用及敏感拒绝实例，再正式Electron两次普通会话与真实DeepSeek，新请求不含偏好词但实际回复采用，撤销后下轮不再注入；检查数据库版本和native上下文，不用测试脚本伪造学习。build/type、相关组件及diff。只相关实例，不重跑组卷；截图验证普通教师路径，未验证语义质量不称提高教学准确性。回滚撤该slice注入/观察，保留app_settings历史以便恢复，原教育记忆/学生/课堂/凭据不改。完整自适应routing/retrieval/隐式修订信号/自动效果下降回退留后续EV任务。
<!-- ev-feedback-contract-20261015:end -->

<!-- ma-delivery-status-20261015:start -->
## 2026-10-15 MA-MAIN-02-B1：课堂 PPTX 教学交付限定接受，转 Hermes

Current Phase：4/5 DOING，6 开始实施；Master ACTIVE。Current Task：EV-MAIN-01 教师偏好闭环。智能组卷不在当前队列。

Done：已确认课堂→选择教学文件目录→自然语言导出→同 Pi 读取当前课堂标题/版本→确定性 Office 草稿→原 HeroUI 审批预览/教师核对→真实 PPTX→教学文件目录→冷启动回读。复制固定 OpenMAIC636fab0 的 HTML/颜色/图形路径格式函数，MIT 与 Himalaya ISC 原文、9文件来源hash/依赖锁记录齐全；既有 PptxGenJS4.0.1/Office 宿主复用。文字/线条/图形保留可编辑对象，2个公式用现本地排版图片且明确不可编辑；2题完整题面/答案/长解析自动分页为6页。原课堂/学习事实不改，源版本CAS和写文件审批保留，无新增Agent、DDL、IPC或原图上云。

Evidence：apps/desktop/test-results/goal/ma-delivery-20261014/progress.json、commands.ps1、before。正式 Electron q6wisy，3/3、2启动、0 renderer errors；真实 Pi/DeepSeek 使用9U0u4m已修订课堂，不重新生成课。build SHA 4e95128abeca9cecc5afcad78303a9a21105cc755d189a7190c77d766b9d74e9 /366，运行前后相同。build/type exit0；组件217/217；合同3组覆盖标题/会话/版本、精确快照、最终源CAS；diff --check exit0。WPS12实际打开最终PPTX6页并导出PDF；6页PNG与已逐页查看的首份WPS渲染字节相同。浅1366与暗1920实际查看，内容区需滚动；1366首屏不能看到完整课页，未称全部同屏。

Failed/Recovery：先后修复输出目录与冻结工作区冲突、草稿注入竞态、课堂工具名遗漏、旧文件dispatcher重复注册web、模型引用历史候选而非当前确认、屏幕外iframe rAF使核对选项锁住。最后改React提交后当前frame/token/scene回执，保留不可信沙盒。第一次ZIP测试把自动分页6误当4，修正断言并保留失败r0pnmH；脚本sourceFile重复刷新问题修为幂等，重新成功。完整失败日志见evidence，不抹除。

Boundary：LIMITED_ACCEPTED仅B1有界课堂PPTX。PDF/DOCX/讲稿/导入、全部DSL/复杂媒体、全科图义与答案正确性、完整OpenMAIC/三主线/安装/无VPN仍OPEN。answerVerified=false。新增3个纯JS锁版直接依赖共999608字节（非安装包增量），无服务/模型；npm已有漏洞不宣称清零。Blocked无。Last verified commit d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63（dirty），本轮远端TLS读取失败未核；无commit/push，独立Harness/正式数据/凭据保留。

Next：EV-MAIN-01 按下方合同实现普通教师反馈→本地证据→评价→版本化偏好→下一任务应用/撤销。随后三主线JOIN与各模式剩余能力；不回退组卷全集。回滚仅撤本片入口/adapter/依赖delta，历史课堂和正式产物保留。
<!-- ma-delivery-status-20261015:end -->

<!-- ma-editor-status-20261014:start -->
## 2026-10-14 当前 MA-MAIN-02-A：课页直接编辑限定接受

Master ACTIVE；Phase4/5 DOING。用户指定三主线 DeepTutor → OpenMAIC → Hermes，智能组卷已移出当前队列。Done：复用固定 OpenMAIC editor0.0.9 MIT 的 controlled UI/ProseMirror/core transaction-history，教师可直接改课页文字、撤销重做、选中被遮挡线条并拖动端点修正、取消不保存、追加确认版本并冷恢复。沿用原 opaque sandbox/主进程课堂CAS/SQLite确认账本，无第二Agent、DDL、事实真源或新增IPC。公式/图形编辑入口可用，但未逐项实例验收，不能标为完整编辑器或完整OpenMAIC完成。

Evidence：apps/desktop/test-results/goal/ma-editor-20261014/progress.json、commands.ps1、before/。最终正式Electron 9U0u4m，5/5、2次启动、0renderer错误；沿先前真实Pi/DeepSeek课堂a72a37的隔离SQLite/文件副本，本轮0模型调用。冻结build 37ee9cbeb1e9e356e889cd48a57b2118993624ee396ff6986ff8cb8a5af7e9bd /351前后相同。build含typecheck exit0、组件217/217、真实editor core例3/3；仓库diff --check exit0。浅1366×768编辑和暗1920×1080冷读截图实际查看；控件可滚动到达，不称1366全部同屏。最后图中橙色斜边已由教师实际编辑对齐填充三角形。

Failed/Recovery：types子路径由局部声明桥接；首次iframe自动点击不命中改为真实窗口/DOM坐标；独立Harness nativeRoot启动问题由其任务修复，保留其改动。包审计输出误命名package.json导致冻结build启动失败，现改npm-pack.json并留现场。实际遮挡线条难选，补教师“选择元素”并复用上游端点工具，未开放same-origin/Node/网络。最初模型图中斜边方向错误，teacher修订例不等于自动数学验证，answerVerified=false。

Boundary：LIMITED_ACCEPTED仅本片文字/history/取消/线条修正/版本CAS/冷恢复；课堂导入/PPTX-PDF-讲稿交付、自动图义/全科可靠性、完整三主线/安装/无VPN仍OPEN。19新增包锁版、实际树约77.6MB，包许可证notice已保存；不冒称安装包增量体积。before支持撤本片delta，保留原版本及独立Harness/正式数据配置凭据。HEAD/remote已核同d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63，dirty，无commit/push。Blocked无。

Next：MA-MAIN-02-B先复用上游纯导出函数和现Office文件宿主贯通教师教学交付；完成该片再EV-MAIN-01 Hermes普通反馈→可评估偏好→版本化应用与回滚，最后JOIN三主线联动。DeepTutor阅读续接/学习计划子片已接受，不等于所有DeepTutor模式完成；不再重跑组卷或无关测试。
<!-- ma-editor-status-20261014:end -->

<!-- ma-classroom-status-20261014:start -->
## 2026-10-14 MA-MAIN-01：互动课堂子片限定接受，下一课堂编辑与交付

Master ACTIVE，Phase4/5 DOING。固定 OpenMAIC DSL0.11.2/generation0.3.15/renderer0.1.11 已实际接 Pi：上游原生提示→同一 Pi 生成回调→结构归一化→现 ai_confirmation_items 待核对/教师确认/追加修订→教学内容互动课堂→离线隔离 SlideCanvas 与随堂题。无第二 Agent、新事实表或自动成绩。3个 typed IPC；main 执行会话/学生隔离、取消、幂等、版本CAS与内容边界。教师可修改课堂名称、题干、答案和解析；完整图形/文字编辑与教学导出仍属于 MA-MAIN-02。

Evidence：apps/desktop/test-results/goal/ma-classroom-20261014/progress.json 与 commands.ps1。最终正式 Electron/真实 DeepSeek a72a37：6项/2启动/0renderer错误，生成三页/图形/公式/两题→实际答题和解析→教师修订确认→旧版本/不安全内容拒绝→冷恢复，同版 build SHA d592531c4fb33bfdbab1c5d2c344cd858edd86c950c294c6c70013a0449b5b01 /351文件运行前后相同。build/type exit0；组件217/217；领域7项含三个并行真实适配器准备/提交。最终浅1366×768与暗1920×1080截图实际查看，课页/控件可滚动到达，不称1366全部同屏。只做本片实例和必要门禁，未重跑组卷或容量专项。

Failed/Recovery：安装 ECONNRESET/缓存缺项，固定 audited html2canvas-pro2.5.1 后恢复；初始导航和草稿会话绑定已修；opaque origin 本地module iframe加载失败，改可信IIFE+本地字体+nonce srcdoc，未开放same-origin/preload/Node/网络。aJXBsK标题误作引用、O3a1n6并行编号覆盖/超时现场保留；页号现在在第一个await前分配，错误返回可用课页引用。空继承字体误拒、全局选项样式放大与初始发送竞态已修。ZAou4Z旧生成、qdu4pB仅克隆UI证据仍保留，最终接受基于a72a37完整新链路。before目录可撤回本片；原事实/正式库/配置/凭据未改。

Boundary：LIMITED_ACCEPTED仅AI生成的有界slide/quiz课堂、交互/教师确认/版本化保存/冷恢复；answerVerified=false，不称教学或答案独立正确、完整OpenMAIC/GoldenE、全学科、导出、安装或无VPN接受。源/依赖/license manifest与notices在vendor/openmaic；实际新增14包均保存license，未称全上游可复现。HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63 dirty，未核远端，无提交/push，独立Harness改动保留。scoped diff --check通过；仓库级只报独立docs/goal/HARNESS_EXECUTION.md末尾空行，未替他修改。Blocked无。

Next：MA-MAIN-02复用上游editor/import/export补课页修订与教学交付→EV-MAIN-01 Hermes无感教师偏好反馈/证据/版本/回滚→三主线联动。智能组卷已移出当前队列。
<!-- ma-classroom-status-20261014:end -->

<!-- ma-delivery-contract-20261014:start -->
## MA-MAIN-02-B 下一实施合同：课堂教学交付

M09/M10；教师可见结果：在已确认课堂选择导出，预览课页与随堂题/解析，确认保存真实文件，教学文件页面可重开；保留课堂revision/version与文件hash，不覆盖旧产物。当前课堂只在本地账本/预览，尚无导出入口。复用现 Office artifact service/coordinator 的主进程授权、文件mutation queue、审批、CAS、原子安装与版本记录；新教育adapter负责读取已确认课堂，而非另起文件宿主或Agent。

Recherche/Reuse 已定位：固定OpenMAIC636fab0 的 lib/export/use-export-pptx.ts:buildPptxBlob（包括图形、线条、公式、备注）及 use-export-script.ts 的纯格式函数，MIT；本机 Office generator 已有 PptxGenJS/docx/PDF，不再默认安装第二套。上游PPTX依赖应用store、媒体解析及定制pptxgenjs/custom geometry，必须先逐段审查其纯边界和本项目已装版本差异，适配有界离线DSL；不复制上游store/网络代理/AgentRuntime。现classroom.v1明确actions=[]，collectSceneScripts不能凭空产生讲稿，必须区分课页正文/随堂题解析与真实讲稿，不能把空输出当交付。

拟改：单一classroom export contract（已确认id/version、所选格式与包括解析选项）；education/classroom-delivery adapter；必要Office draft新版本/共享校验及现 typed preload/UI入口、loading/error/cancel/conflict/部分支持反馈。保留原Office/试卷合同兼容。图形与公式不可静默降级；若需以图片输出，教师预览明确“不可编辑”，留原DSL及原课页版本。导入PPTX另下一片，不能用导出接受替代。

完成定义：先源码复用/许可证与版本兼容→冻结最小格式合同→实现→build/相关组件→一组当前已修订真实课堂的正式Electron教师预览/审批/文件打开/冷恢复；文件逐页查图形、公式和随堂答案，旧版本/取消拒绝不留正式文件，保持原版。只做该片实例，不重跑组卷或容量全集。若新依赖必须记录精确版本/许可证/实际体积/Windows影响；任何外部上传、授权绕过或覆盖事实不允许。回滚只撤该slice入口/adapter，旧课堂与正式产物保留。接受后进入EV-MAIN-01 Hermes普通教师反馈与无感偏好应用/回滚，Master继续ACTIVE。
<!-- ma-delivery-contract-20261014:end -->

<!-- ma-editor-contract-20261014:start -->
## MA-MAIN-02-A 实施合同：直接编辑课堂课页

M09/M10，教师可见结果：在现有互动课堂点击编辑，直接选择/移动/修订文字、线条、图形和公式，撤销/重做，保存追加版本并冷启动恢复。复用 OpenMAIC editor0.0.9 的 controlled surface、core transaction/history、现 renderer/dsl、HeroUI 操作区以及课堂确认账本。编辑器在原 opaque sandbox 内，外层仅接受当前 iframe/当前课页/当前随机消息凭证的有界 DSL，经 validClassroom 与原 main CAS 再保存。无新 Agent、DDL 或事实真源。

当前缺口：MA-MAIN-01只允许外层改标题与随堂题，幻灯片只读；原件修改不应靠教师填写 JSON。改动：新增固定 editor 包/其运行依赖与本地许可证通知；修改 classroom-preview 沙盒、父层编辑消息合同、课页编辑/撤销控件，拓展现正式 Electron 的编辑实例。保留现幻灯片预览与随堂题；不开放外部图片/媒体、文件选择器/Node/网络权限。未支持内容明确拒绝，不静默去除。

依赖：本地固定 OpenMAIC636fab0源码 editor/LICENSE 为MIT；npm0.0.9 integrity 已查，安装前核 tarball LICENSE。复用现 dsl0.11.2/renderer0.1.11/React19，不升级现核心；ProseMirror、immer、react-colorful 为文字/撤销/颜色能力，真实安装体积和各包许可证存 evidence/notice。Windows打包只增加沙盒静态代码，无原生模块/服务；若依赖闭包出现许可或版本不兼容，停止该包接入并保持只读课堂。

验收：build/type/相关组件最低门禁+一个原真实生成课堂副本的教师点击文字编辑、撤销/重做、保存revision2、旧revision拒绝、冷恢复实例；不重放模型或重跑组卷。实际浅1366/暗1920核控件与文本，source/hash/命令/首次失败/回滚写 ma-editor-20261014。取消编辑不写账本；最终保存只能追加、不覆盖原候选/旧确认。回滚仅本片 delta和 package/lock，保留数据历史。MA-MAIN-02-B教学交付/导入导出、完整OpenMAIC仍待实施，随后EV-MAIN-01 Hermes无感反馈。
<!-- ma-editor-contract-20261014:end -->


## MA-MAIN-01 实施合同（2026-10-14，当前）

M09/M10 教学内容：一句话交给同一 Pi 生成讲解幻灯片与互动题，教师预览/编辑/确认，版本化保存并冷启动重开。复用 OpenMAIC DSL 0.11.2、generation 0.3.15 的 buildPrompt/generateSceneContent/buildCompleteScene、renderer 0.1.11 的 SlideCanvas；Pi 工具提供上游提示并接收同轮模型结果作为 AICallFn 回调，不增加模型循环。固定已审计包闭包见 phase0-3f5282f0/package-audit：78依赖约149.5MB审计安装，实际新增与构建体积另记；顶层MIT但包含Apache/BSD/ISC等依赖，保留完整许可证清单。Windows无新本机编译服务；与既有React/Motion/KaTeX去重，不导入CDN字体。

新增 classroom.v1、领域服务/账本、Pi固定工具身份、三个typed IPC及教学内容课堂页/隔离预览；使用现 ai_confirmation_items 的独立action，草稿/确认/修订追加，不新建资料/题库事实源。课堂不能标教材原题；自动答题只是当前课堂答案对照，不写学生成绩/掌握。教师编辑只改课堂，不改来源。会话有效性/学生范围/原run/取消/幂等与版本CAS由main核验；旧普通确认入口排除课堂action。来源关联仅接受宿主实读证据，缺少来源标AI教学草稿。

预览只支持已校验slide/quiz子集，所有富HTML在sandbox allow-scripts且无same-origin的独立页面渲染；禁止外部URL、脚本/事件、网络、Node/preload、图片原件上传。题意/图形/答案仍由教师核对；上游结构验证不宣称正确性。持久化仍本地，模型仅显式课程要求和必要脱敏上下文。

先功能再本片一个真实DeepSeek/Electron勾股定理课（图形/讲解/互动题/编辑确认/保存/冷恢复），必要build/type/组件与定向CAS/越界反例，浅1366/暗1920看实际图。不跑组卷/容量全集。回滚撤本片入口/工具与依赖，保留已追加账本历史不删用户资料；包或模型失败明确报错/重试，未通过不标完成。MA-MAIN-02导出/更深编辑及EV-MAIN-01仍待后续。

<!-- dt-path-status-20261014:start -->
## 2026-10-14 DT-MAIN-02：计划续接子片限定接受，下一 OpenMAIC

Master ACTIVE，Phase4/5 DOING。已交付“学生→学习计划”的下一项、全历史当前版本记录覆盖、错误/部分正确复盘、四种可编辑辅导入口、按当天记录、同学生 Pi 会话续接与重启恢复。复用现 DeepTutor learning Worker/核对算法、学习结果真源/确认账本与原 typed IPC；无新依赖、表或第二Agent。默认全科分析遗漏科目计划的差异已修；计划来源按原科目快照核对，不自动改事实。

证据：apps/desktop/test-results/goal/dt-path-20261014/progress.json/commands.ps1/before。最终 build/type exit0；组件217/217、8组定向合同/全历史/科目计划集成；正式 Pi/真实DeepSeek IaAkgM 4项/2启动/0renderer错误；build SHA 655f09146bde1343367376f893e2e95505400d4e7876f9155fd11b271793ee60 /348 前后相同。独立只读冷图 rCZjEp 1项，无模型调用/结果写入，浅1366/暗1920已实际查看。原深色1.5 DPR缩放残影图保留且不作为最终图审，改为等待viewport/稳定帧的DPR1截图。本片 git diff --check 通过；仓库级检查只报独立 Harness 文档末尾空行，保留其改动；只做本片实例，未重跑组卷/无关全集。

边界：LIMITED_ACCEPTED是已确认计划的续接与真实结果覆盖，不是完整DeepTutor或掌握/答案正确性证明。真实运行只验逐步提示；其余三种草稿合同已核、未逐一模型验收。实例沿旧正式UI创建/教师确认的代数概念计划副本，科目差异为定向Repository例；不冒称自然全科材料/真人日常验收。旧数据与Harness改动保留，无提交/push、真实用户数据/配置/凭据修改。Last verified HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63（dirty）；本轮未核远端。Blocked：无。

Next：MA-MAIN-01 OpenMAIC 真实互动课→MA-MAIN-02教师编辑/教学交付→EV-MAIN-01 Hermes无感反馈。DeepTutor其他完整模式留主线后续，不再用组卷或容量专项阻挡下一项。
<!-- dt-path-status-20261014:end -->


<!-- dt-path-20261014:start -->
## DT-MAIN-02 本轮合同：当前计划续接与分步辅导

M08/M10；功能优先，智能组卷不回到本轮队列。真实缺口：已有两周计划、学习结果、核对及 DeepTutor learning 算法；工作台记录默认第1天，没有全历史派生的下一项与当天辅导入口。复用现 LearningReviewRepository、student-training.v1/既有 typed IPC、Pi 学习分析/核对工具、学生绑定会话、PiTrainingPlan/Button；不恢复旧 Mastery Agent。

范围：增加纯进度推导合同，按当前确认计划版本、真实记录及最新实际发生时间显示已记录/未记录与需复习项；从完整主进程快照推导，不能用页面最近10条推断全进度。扩原只读视图和同 Pi 学习分析回执；工作台提供继续下一项、逐步提示/详细讲解/错因复盘/举一反三，并按选定当天录结果。每次辅导重新读取主进程计划，同版本学生会话可续接；所有草稿可编辑且不自动发给模型。计划变化须刷新，历史来源明确提醒，已有结果不自动改写。

无新表、迁移、依赖、Agent、事实真源或上传授权。已记录不等于掌握，错误/部分正确不自动转正确；新计划不继承旧计划完成计数。失败可重试，原记录及计划不覆盖。回滚撤本片字段/UI/helper，不删除真实结果。完成：必要 build/组件门禁、定向全历史/版本/最新结果例、一个隔离正式 Electron 原已确认计划→提示草稿→真实 Pi/DeepSeek→实际结果→下一项→重启回读例及浅1366/暗1920可达检查。其后直接 MA-MAIN-01，而不扩组卷回归或容量专项。
<!-- dt-path-20261014:end -->

<!-- dt-reading-20261014:start -->
## 2026-10-14 DT-MAIN-01：阅读续接子片已限定接受，下一 DT-MAIN-02

Current Phase：4/5 DOING；Master ACTIVE。Done：资料详情“开始／继续阅读”、逐段正文、每段笔记/显式读完、追加保存、重启恢复、回看前段笔记、当前段落提问进入已有 Pi 对话。现 MaterialRepository/source、原件预览、Markdown/Button/TextArea、导航及 Pi 复用；固定 DeepTutor reading/search 能力仍保留，本例不虚称额外调用了它的搜索 Worker。新 material-study.v1/4 typed IPC；同 SQLite 追加 material_reading_entries，由 source/正文/最新 revision 单 SQL CAS 保护，无旧资料/题库覆盖、新依赖或第二运行时。笔记留本机，明确提问只给必要脱敏段落和问题，原图与笔记不附带上云。

Evidence：apps/desktop/test-results/goal/dt-reading-20261014/progress.json/commands.ps1/before；正式 education-journey-nYQae6，4项/2启动/0 renderer errors。真实授权物理扫描 6 段来自此前实际导入/OCR的 fkMAqF；同隔离 profile 复用原件和缓存，最终构建实际完成阅读/保存/冷恢复/源冲突/真实 Pi-DeepSeek 问答。build/type exit0，组件217/217，6组定向迁移/合同/CAS/旧笔记恢复/源变化/固定vendor校验；build SHA 3a390be4c9b853bd6c0e1b7082b194d2a3b75c548f41a38afaa3ad4567ff9a47 /348 前后相同。已查看浅1366与暗1920 PNG；浅图操作区可滚动到达，不称全部同屏。git diff --check通过；不重跑组卷或无关全集。

Failed/Recovery：保存 schema 键数错误已修；提问原来只有view/draft而未绑定session，已复用当前已选会话ID补齐。旧测试库无资料、重用副本读取失败、首次窗口关闭弹窗和启动观察失败、复用同值笔记未触发dirty的首次日志保留。迁移现在用唯一目标的 SQLite 一致快照；不称真实库损坏。源码复用脚本假定上游本地目录存在而失败，已改本次验证为固定manifest三文件hash/size与实际Apache许可证；未声称最新版或上游字节比对通过。

Boundary：LIMITED_ACCEPTED只覆盖版本化逐段阅读/笔记/恢复/显式辅导入口；不是完整沉浸阅读/视频、全科图义或讲解正确性、完整DeepTutor。模型本例仅看到段落文字，明确没有读图；保留原件核对。源变化旧历史不覆盖；未保存笔记鼠标/Enter切换保护已接，完整菜单导航行为尚未专项覆盖。正式用户数据/配置/凭据不改，无提交或push，独立Harness修改保留。Last verified HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63（dirty）；本轮未验证远端HEAD。

Next：DT-MAIN-02，复用既有学习证据/DeepTutor学习算法/核对/训练结果，交付可继续的个性化辅导与学习路径；随后 MA-MAIN-01 OpenMAIC 实际互动课、EV-MAIN-01 Hermes无感反馈。智能组卷已移出当前队列；不以阅读更大样例或容量专项阻挡后续功能。Blocked：无。
<!-- dt-reading-20261014:end -->

<!-- mainlines-20261014:start -->
## 三主线执行清单（2026-10-14，当前唯一队列）

### 方向与现状

智能组卷按用户确认从当前主线收口，保留已有三模式、审核、版本和 Office 产物能力。暂停上一片拟进行的复杂错题 F3 验收及 F4 大资料容量专项；不以这些专项阻挡三项目功能集成。这里的收口是任务范围决定，不扩大已有技术验收范围。

| 主线 | 当前代码事实 | 接下来交付给教师的结果 | 复用与完成实例 |
| --- | --- | --- | --- |
| DeepTutor / Phase 4 | 已有固定 1.6.13 reading/learning/question 纯能力源码、同 Pi 搜索/引用/学习核对/训练计划；完整阅读学习与精通路径仍有缺口 | 阅读资料时提问、继续上次阅读、结合真实学习记录获得分步辅导和学习路径 | reading-host.ts、search-provider.ts、MaterialRepository、learning-review-repository.ts、student-training-api.ts；资料→阅读→有来源辅导→保存进度→重启继续 |
| OpenMAIC / Phase 5 | 历史 SDK/DSL 审计；未交付正式互动课堂。包探测不算功能 | 一句话生成课程，教学内容中打开、互动答题、修订、保存和重开 | 固定上游 DSL/schema、generation AICallFn、renderer/互动组件；沿现 Pi、typed IPC、SQLite/文件及 artifact 宿主，不运行第二个网站/Agent |
| Hermes / Phase 6 | 规划与局部源码调查；未交付完整反馈飞轮 | 教师正常修改输出后，下次自然采用合规偏好，可查看和撤销 | 本地真实交互/修订记录→候选→离线评价→约束门禁→版本化应用→回滚；复制前核实具体源码许可证，禁止修改事实与核心权限 |

### 依次实施的任务卡

1. **DT-MAIN-01 阅读续接子片已限定接受：阅读学习闭环。** 先核资料详情/正文/源版本/现阅读入口与持久化接缝，复用已固定 DeepTutor reading search/models。阅读位置与教师笔记必须挂同资料版本；Pi 只获得授权必要片段。共享合同→主进程→preload→教师页面→保存/重启；缺正文/源变更/取消有可见反馈。聊天滚动书签不是教材阅读进度，不能复用其瞬时状态冒充持久学习。保留原资料事实，无新题库或第二会话运行时。
2. **DT-MAIN-02 已确认计划续接子片限定接受：辅导与学习路径。** 基于已存在学习证据/核对/训练结果和原学习算法，补提示、讲解、错因与可继续路径。真实结果才能调整学习状态，缺证据明确提示；不重新建设已完成的组卷。一个真实学习记录→建议→教师必要校正→训练记录→下一次续接。
3. **MA-MAIN-01 当前：互动课最小闭环。** 核固定 OpenMAIC 源码/许可/依赖闭包→直接复用 DSL 与 renderer→接 Pi 生成回调→教学内容入口→编辑/确认→版本化保存→重开。首例为真实勾股定理课，含图形、解释和互动题；生成、实际交互与保存缺一不算完成。可直接复用的模块不重写。
4. **MA-MAIN-02：编辑与教学交付。** 在已可运行课堂上复用 editor/import/export，补教师修订、源版本冲突与离线资产恢复，不引入上游认证/服务/数据库栈。
5. **EV-MAIN-01：无感教师反馈。** 复用可独立的 Hermes 信号/候选/约束代码与现本地记录；普通偏好依 Master 第 15–18 节后台学习，不要求教师管理 Prompt 或逐次批准 Skill。候选须评价、版本、证据与回滚；敏感/事实修改仍遵原审批，绝不自动改成绩、原题答案、权限、凭证、Schema 或源代码。
6. **JOIN：三主线共同使用。** 同一学生/资料上下文→辅导→互动课→教师修订→下一次改进；保持唯一 Pi、SQLite/文件真源和本地隐私。模块完成后再安排安装/容量专项。

### 本轮核查与执行边界

已实读 reading-host.ts、search-provider.ts、OfficeReadingPosition.ts、student-training-api.ts 和 deeptutor-reading/source-manifest.json。reading worker 已接固定 f07029c/1.6.13 的 search.py/models.py，Apache-2.0、stdlib；搜索有隐私/源指纹/取消保护。OfficeReadingPosition 仅是聊天滚动瞬时适配，不是资料学习进度。学生训练已有 typed 主进程入口，应扩现事实和版本合同。图谱已存在但新 education 文件覆盖不足，使用精确源文件补读，不从旧 db/legacy Mastery 判断新能力已完成。

本轮只调整队列并核查接缝，未安装依赖、复制新上游代码、改生产功能或运行 UI 验收。已冻结下一卡结果/复用/保存/恢复/验收要求，DT-MAIN-01 生产状态为待实施，不标完成。旧 F1–F6 和历史 DT/MA 表仅保留证据；顶层本清单决定后续顺序。每张卡先功能落地，再一个相应真实实例；不得继续以组卷/数学校验例扩展为主线。

### DT-MAIN-01 实施合同：版本化阅读与辅导（2026-10-14）

M02/M04/M10。教师可见结果：资料详情开始/继续逐段阅读，保存笔记和明确完成状态，重启恢复位置；当前段落提问进入同 Pi 工作台。复用固定 DeepTutor search/models、MaterialRepository.source、现 Markdown/Button/原件预览及导航；无新模型/Agent/第三方包。

改动范围：新 material-study.v1 共享类型、material-reading 独立迁移/领域存储方法、typed materials:reading/get-page/save/question IPC、MaterialStudyPanel 和当前资料入口、既有正式 Electron runner 的一个阅读实例。新增同一 SQLite 的 material_reading_entries（追加记录：源版本/正文哈希/笔记/显式状态/上次 revision），不是资料或题库第二真源。迁移 CREATE IF NOT EXISTS，旧库无写旧事实，全新库/旧副本启动兼容；只在独立测试 profile 验证。单条条件 INSERT 对源/正文与最新 revision 做 CAS，双提交拒绝旧版本；资料变更保留旧笔记和旧位置，明确提示重新开始。原数据/文件不覆盖。

完成门禁：build/必要组件检查+一个当前 Electron 资料→阅读→笔记保存→翻段→冷恢复→提问的实例，源变化/旧 revision 只做定向反例。辅导只给脱敏必要段落且排除标记私密正文，显式点击后形成可编辑草稿；不自动上云整本。Pi 通用模式不因此恢复旧运行时。回滚撤本片新入口/IPC/代码，追加数据表保留不删除。完整沉浸模式、精通路径、全科解题仍不能凭此子片标完成。

<!-- mainlines-20261014:end -->

<!-- feature-priority-20261012:start -->
## 2026-10-12 功能优先执行中

功能优先规则保持；F1页面文字位置→真实Pi候选本片限定接受，完整识题质量仍DOING。已不再是上一轮仅文档规划状态。当前真实结果、首次失败、边界与下一项见下方kb-s6-current和FEATURE_FIRST_EXECUTION.md；历史Next不覆盖当前队列。
<!-- feature-priority-20261012:end -->

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

## 2026-10-11 KB-S5-B限定接受，接续S6（历史读点）

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S6：自然材料整卷/复杂图公式/答案质量及Office-WPS联合验收，随后KB002三模式/5变式/验证修复隔离，再KB003后台增量/任务优先/30–40GB/安装。Done：S2-A/S2-B/S3/S4-A/S4-B/S5-A/S5-B各自限定接受。Doing：知识库与智能组卷完整交付。Failed：首次失败保留，当前定向门禁通过。Blocked：无。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。

本片仅接受自然物理扫描的一道8分图文题及原图交付；不是自然数学100分卷、复杂公式/图表完整正确性、可编辑公式或答案正确性证明。WPS实际打开、S6更广自然材料/质量、hybrid/ai_original、5变式/自动修复隔离、30–40GB及安装仍OPEN。


## 2026-10-10 KB-S5-A限定接受，下一图公式联合验收（历史读点）

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S5-B/S6：已确认QuestionDocument/本地原图→同Office图公式交付→自然扫描、答案隔离、Word/PDF与Office/WPS联合验收。Done：S2-A/S2-B/S3/S4-A/S4-B/S5-A各自限定接受。Doing：知识库与智能组卷完整交付。Next：S5-B/S6后KB002三模式、5变式/验证修复隔离，再KB003后台增量/任务优先/30–40GB/安装。Failed：保留首次失败；S5-A最终19项通过。Blocked：无。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。

限定为教师UI创建的文字题100分卷；不是自然扫描/数学正确性或图公式验收。扫描题/公式当前明确拒绝，未降级摘要。Office/WPS实际打开、自然材料S6、hybrid/ai_original、5变式/验证隔离、30–40GB及安装仍OPEN。


## 2026-10-09 KB-S4-B限定接受，下一S5/S6（历史读点）

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S5/S6：已确认整卷→学生卷/教师答案卷→同Office审批宿主Word/PDF→真实扫描/公式/图/答案联合验收。Done：S2-A/S2-B/S3/S4-A/S4-B限定接受。Doing：知识库与智能组卷完整交付。Next：S5/S6后KB002三模式、5变式和校验隔离，再KB003后台增量、任务优先、30–40GB及安装。Failed：保留各片首次失败，S4-B最终26项通过；自然扫描/导出尚未验。Blocked：无。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。

限定为教师自制照片/受控题库与两个教学干扰对照；不是自然数学扫描、复杂图/公式、通用语义准确率或答案正确性证明。answerVerified=false；Word/PDF、hybrid/ai_original、5变式/校验隔离及30–40GB仍OPEN。


## 2026-10-09 KB-S4-A限定接受，下一S4-B（历史读点）

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S4-B：同Pi安全别名交接关联候选→实读版本→教师审核练习；补语义推荐质量，不用关键词分值代替。Next：S4-B后S5/S6学生/教师Word/PDF与真实图公式答案联合验收，再KB002三模式/5变式、KB003增量30–40GB。Done：S2-A/S2-B/S3及S4-A各自限定范围；Doing：S4完整闭环；Failed：首次build Object.hasOwn编译不兼容已修；首次formal11项后AI阅读context_limit，仍未接受S4-B，目录GET另见TLS ECONNRESET；Blocked：无，仍可推进本地能力。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty）。

KB-S4-A本地关联候选 LIMITED_ACCEPTED。build 428fbf1a36c6ac12608442ed82a4c8def91734bccf889753daec5e34e3aca31a /340文件；build/typecheck exit0、领域282、组件203/203、正式Electron19项/3启动/0 renderer错误、兼容smoke207/207。12张最终浅暗1366×768/1920×1080截图实际查看。教师自制数学图片→固定本地OCR→教师事实确认→17条真实UI题库对照→本地Top10；原题/副本/错年级/错学科/缺答案排除，空结果、源版本故障与恢复、跨学生/旧receipt拒绝、真实停止无晚结果、冷读一致通过。纯文字题不伪造原图入口。method=local_knowledge_keyword_v1，仅知识点/文字关联，未证明语义或答案正确；不调用模型补题、不改学生事实。证据：apps/desktop/test-results/goal/kb-similar-20261009/closeout.json。


## 2026-10-09 KB-S3限定接受，下一S4（历史读点）

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S4：真实错题照片→本地OCR/教师确认→本机相似Top10→可审核练习；复用现错题facts/题库/PracticeReview。随后S5/S6学生卷与教师卷Word/PDF/真实图公式联合验收，再KB002 hybrid/ai_original/5变式及答案校验、KB003增量30–40GB。语义检索质量、可信答案与导出仍OPEN。

KB-S3 source_only整卷蓝图/审核/快照 LIMITED_ACCEPTED。build a0f860ac56680a4ddb1fa7798edd1e7c90812fae92f73b7a1156dddee7338448 /340文件；build/typecheck exit0、领域274、组件200/200、正式新版Electron12项/3启动/0 renderer错误、补充冷副本视觉3项/1启动/0模型请求、兼容smoke207/207。32张最终浅暗1366×768/1920×1080截图实际查看。23道教师UI创建对照，20道唯一题满足10×3+6×5+4×10=100；重复/缺答案/错年级、编辑废止、拒绝、精确缺口、真实源变化与恢复、幂等、停止无晚写、两次冷读和真实DeepSeek同Pi等待教师审批通过。原题不改，不自动补题，answerVerified=false；自制文字对照不是自然扫描卷或数学正确性证据。证据：apps/desktop/test-results/goal/kb-paper-20261009/closeout.json。


## 2026-10-09 KB-S2-B限定接受，下一S3（历史读点）

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S3：100分source_only蓝图→确定性配额去重选题→缺题提示→教师预览/确认→版本化整卷快照/冷读。随后S4真实错题Top10、S5/S6 Office联合验收、KB002三模式/变式、KB003 30–40GB。语义相似与可信答案复用仍OPEN，不恢复通用解题支线。

KB-S2-B 保守同题候选/版本绑定 LIMITED_ACCEPTED。build cb0a5c473cbffc23d483cd2c2027f80405ac1fdbb57b44495fa4402072e8c79f /340文件；build/typecheck exit0、领域258、组件194/194、正式新版Electron12项/3启动/0 renderer错误、兼容smoke207/207。12张浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照：跨记录ID/CRLF同题2条，改数值条件保持独立；20+2分页，真实Pi/DeepSeek同次10条安全别名/duplicateOf，源变化拒绝、精确恢复、两次冷启与索引重建通过。仅本地保守候选，绝不自动合并/删题或证明答案正确；页面范围current_page、Pi范围returned_candidates。证据：apps/desktop/test-results/goal/kb-identity-20261009/closeout.json。


## 2026-10-09 KB-S2-A 关键词底座限定接受（历史读点）

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S2-B：先完成组卷所需保守同题去重/版本绑定，再接S3纯题库100分蓝图、缺题与教师预览；可信答案复用/语义相似仍为S2余项，随S4完成，不作为不依赖它们的整卷预览前置。通用解题及其他模式不恢复为独立前置。

KB-S2-A 关键词检索底座限定接受。当前build `443eae07f599fda05dfc5f241f85a8f62c942bc5cc9855cbc5e48f69777e3314` / 340文件；build/typecheck exit0，领域252、组件194/194、正式新版Electron11项/3启动/0 renderer错误、兼容smoke207/207。8张当前浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照题，六项硬过滤命中22道、20+2分页；真实Pi/DeepSeek读10条并标hasMore；冷恢复、索引删除重建、旧来源拒绝与精确恢复均通过。不是语义Top10、同题指纹、答案正确性、100分卷、数学Word/PDF或30–40GB验收。证据：`apps/desktop/test-results/goal/kb-retrieval-20261009/closeout.json`。


## 当前最高专题优先级：知识库与智能组卷（2026-10-09）

已验边界与后续门禁见精简执行卡；本次整理不把尚未实施模块标完成。

用户最新指示：整理上下文，集中完成知识库与智能组卷。当前唯一执行索引：[KB_EXAM_ACTIVE_TASK.md](KB_EXAM_ACTIVE_TASK.md)（仓库绝对定位 `docs/goal/KB_EXAM_ACTIVE_TASK.md`）。接续为 **KB-S2检索→S3纯题库100分卷→S4错题相似练习→S5/S6 Word/PDF联合验收→KB-002三模式/5变式→KB-003增量30–40GB**。R3/R4只按组卷/变式所需嵌入，通用解题长线及其他模式延后；下方旧节的R2→R3→R4线性Next不再是当前执行顺序。Master及知识库四项产品决策保持。


## 2026-10-09 B5-B限定接受与R2接续

下一R2交付合同先保守指纹/中文FTS/元数据硬过滤，统一现题库检索facade，Top10不足诚实返回；20同题/20改条件图版本负例、200题对随后评测。可信解析零额外生成与Pi路由调用分开记账。

本节是当前读点，下方同日旧节保留历史证据，不能覆盖本节。M05/M10 B5-B仅来源事实一致性保护已接受：answer/analysis镜像冲突及v2题干冲突由同一只读helper检测；typed IPC保留安全错误，题本/同Pi来源弹窗拒绝展示冲突正文，精确恢复后可读。旧v1摘要语义、questionVersion、批准与原图未被自动修复或重写。

当前build 367d53b3d85dbb2e1855cbb7db977859f94129e529aec6898f40b2dca8d3f6bf / 340文件，正式前后、冻结快照与兼容smoke后一致。build/typecheck exit0；领域243、组件194/194、兼容smoke207/207；真实DeepSeek/Pi Electron24项/4启动/0 renderer错误。32张当前浅暗1366×768/1920×1080截图与4份原图实际查看；三个隔离标量故障均拒绝、精确恢复、冷启一致；原生手动压缩1次后冷继续通过。此压缩不是新的自然自动阈值基准，smoke仅兼容路径，不作新版视觉依据。

物理扫描无独立标准答案仍missing，图15未知标记不认作答案；教师自制跨页算术仅来源绑定对照，answerVerified=false。完整B5独立质量、可靠求解/五tools、语义Top10、100分卷/Office、30–40GB、自然教师、安装/VPN-off与完整Codex体验仍OPEN。

**Next：R2保守同题指纹/中文检索、硬过滤/版本与可信复用合同→R3受限AST/SymPy→R4同Pi五tools→R5–R7错题/组卷/Office/容量。** 不因缺物理答案停止后续，也不凭题面批准/来源标签把答案当正确。Master ACTIVE、Phase4/5 DOING。证据：`apps/desktop/test-results/goal/b5-facts-20261009/closeout.json`；首次RED/build/组件失败与回滚副本保留。无DDL/依赖/第二runtime/日常资料或凭据改动，无提交/push，另一worktree保留。


## 2026-10-09 本轮低成本解题路线审查交付

用户本轮要求先交付技术审查，R0已交付。产品接续：B5-B限定同源事实一致性/恢复→R2保守精确/相似Top10→R3受限AST/SymPy→R4同Pi五tools→R5–R7两MVP/数学Office/三模式/增量30–40GB；更广B5独立质量随R3/R4继续。不重复原页展示和四类旧兼容代替解题实现。

完整设计：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；实施：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`。证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-route-review/readback.json` / `supplement.json`。Master ACTIVE、Phase4/5 DOING；本轮未重跑build/provider/Electron/上游测试，当前B5-B草稿未接受，资料/凭据/另一worktree保留，无提交或push。


## 2026-10-09 B5-A：题本来源与答案声明的限定接受

B5-A只读出处与缺失/未核验UI限定接受。B5整体DOING；DT/MA/JOIN、R2–R7及Master后续Phase仍OPEN，不用本slice替代两条教育能力支线。

当前 build `55b02f7db10fe4530098f0447bd92d89566841acb698e51b02e68ec6e38df9a3` / 340文件与正式前后、smoke后及固定快照一致。build/typecheck exit 0；领域 **239**、组件 **190/190**、兼容冒烟 **207/207**。真实 Pi/DeepSeek 正式 Electron **22项 / 4启动 / 0 renderer错误**。24张当前product-five-spaces浅暗1366×768/1920×1080截图实际逐张查看；新增答案出处与缺失/未核验提示均有当前像素。smoke只在正式进程退出后重建；另存并查看1张legacy兼容题本截图，不把该旧壳截图当新版设计验收。

仅接受B5-A来源/答案声明与本切片UI；完整B5独立图义/公式/条件/答案质量仍DOING。物理扫描卷无独立标准答案，仍missing；教师自制跨页算术只是来源绑定对照，不是扫描答案gold。answerVerified=false，不上传原图/私有路径，不将模型自评作证明。原生手动压缩1次与冷继续已验，不是新的自然自动阈值基准。完整可靠解题、Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off、完整Codex体验及Master后续阶段仍OPEN。

**Next：B5-B逐题独立对照来源/公式/必要条件与答案质量 → R2可信同题零额外生成、相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题/组卷/Office/30–40GB。** 不重复B4四类兼容代替新质量任务，不把本轮文案修复当完整解题完成。

Evidence：`apps/desktop/test-results/goal/b5-source-20261009/closeout.json`；正式 `education-journey-n5msKi`，含当前源/加载脚本、固定build、日志、24张已查看截图、失败与回滚点。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty），Master SHA未改，Phase4/5 DOING、Master ACTIVE。无DDL、新依赖、第二runtime、日常资料/凭据变更、提交或push；另一worktree保留。历史节保留当时范围，不覆盖本节。

## 2026-10-09 B4-D：单区域完整审核与新旧版本同构建兼容的限定接受

B4-D adapter/六项阻断/四类正式同build兼容限定接受；B4整体质量仍DOING，B5与R2–R7保持OPEN。DT/MA/JOIN和Master后续Phase不受此切片完成影响，不重排已接受原图底座。

当前build `e02ddc1d62d37152928c97718ea14894389982fcdbfd2453cb673cd08a417c51` / 340文件与四次正式流程前后、smoke后out和固定快照逐文件一致。build/typecheck exit 0；领域 **239**、组件 **185/185**、兼容smoke **207/207**。真实Pi/DeepSeek正式 **50项 / 13启动 / 0 renderer错误**：fresh single 20、旧v1单页10、旧v1多页10、新v2再修订10；40张浅暗1366×768/1920×1080截图实际逐张查看。smoke在四次正式进程退出后才重建，未与正式测试重叠。

**Next：B5原图/公式/来源/答案质量合同与独立核对 → R2可信同题零额外生成/相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题、三模式组卷、Office与30–40GB。** 现题本可见`teacher_resource`/`generated`内部来源文案，列为B5/R2产品文案待修，不把40截图限定核对当整页UX完成。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4d-closeout.json`，含当前源码/加载脚本、build、命令、首次失败、40张已查看截图及回滚快照。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty保留），Master SHA未变、Phase4/5 DOING、Master ACTIVE。没有DDL、新依赖、第二运行时、日常数据/凭据变更、提交/push；另一worktree保留。历史节只保留其当时范围。

## 2026-10-09 B4-C：新多区域审核与完整转写传递的限定接受

B4-C初审六项/精确Pi读取/手动压缩/冷恢复技术链限定接受，原图语义与完整B4/B5仍DOING；不重新排已接受资料/原图底座。

**Next：B4-D：原图细节/不明标记质量审查、单区域新审核与新旧版本联合正式门禁 → B5 → R2可信同题复用/Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7。**

接受范围是教师提供六项文本的完整传递与版本/审核/恢复安全，不是每个图义已经独立判真。图15已有深色标记，来源不明，须补明确原图审查；物理卷无独立标准答案，保持 missing；跨页算术是教师自制来源控制，不冒充扫描卷答案gold。完整B4/B5、可靠解题、语义Top10、100分数学卷、40GB、自然教师、安装/VPN-off与完整Codex一致性仍OPEN。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4c-closeout.json`；正式 `education-journey-cHFfHO`，定点视觉 `education-journey-otIM5j`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`；Master/日常数据/凭据/另一worktree未改，未提交或push。Phase **4/5 DOING**，Master **ACTIVE**。以下旧节仅保留当时证据，不能覆盖本节。


## 2026-10-09 B4-B Goal续行记录

B4-B旧题补全已有限定正式证据；B4整体DOING。B4-C：新多区域审核六项字段的正式入口（先更新原KB-ORIGINAL-MULTI旧stem选择器），完整图/公式/选项与独立答案审查，编辑/停止/压缩/恢复联合验收→B5→R2精确可信复用与Top10→R3受限AST/SymPy→R4同Pi五tools→R5–R7。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/`；正式 `education-journey-H1dgFq`。兼容冒烟 **207/207，exit 0**；见最终b4b-closeout.json。Phase4/5 DOING、Master ACTIVE。

## 2026-10-09 本轮低成本解题路线审查与交接

最新审查已交付，下一卡R1-B4/B5→R2可信同题/相似→R3受限验证→R4五tools→R5–R7双MVP/Office/三模式/大库。新增R3/R6固定验证器局部适配POC，不重启已接受B3或迁整套第三方runtime。

方案：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；任务卡：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`；证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-review/`。以下历史保留其当时范围。


## 2026-10-09 B3 多区域原图与来源答案审核：纵切限定接受

当前最早未验前置移至B4必要完整题面合同；不是启动新的求解runtime。B3只有原图/来源审核限定接受，公式与全文语义缺口保留。

Phase **4/5 DOING**，Master **ACTIVE**。只接受 B3 多区域原图/来源审核纵切，不接受完整原题转写、数学正确性、B4/B5 或完整 KB-EXAM-001。

最终 build `df2a6f837b39d5feaa66df56b4239101552ebd613c23277a2ef4b4e317c99828` / 340 文件与当前 out、正式流程前后逐文件一致。build/typecheck、renderer **181/181**、领域 **225**、真实 DeepSeek/Pi 正式 Electron **12 项 / 3 启动 / 0 renderer 错误**、全部 5 张原件像素对照和旧兼容 **207/207** 通过。12 张深浅主题、1366×768/1920×1080 截图及 5 张原图实际查看。停止真实范围渲染子进程实测 **1617ms / SIGTERM**，不外推其他设备或完整性能基准。

真实物理扫描题两块原图完整保留条件、图14/图15、表、选项与小题；**手工文字仅摘要，缺少例如“不更换实验器材”等完整条件，不能单独作为 LLM 完整题面**。该卷没有独立答案 gold，答案保持 missing。另 3 页算术对照为明确教师自制材料，只验证跨页及来源锚点，不冒充该卷标准答案；来源答案与教师补解分别保存。scope 更改须重确认，source CAS、外帧拒绝、真正确认 SQL 事务中 main 强制死亡/回滚、冷恢复、损坏整组报错/恢复与幂等均通过。

复用同 Pi、ai_confirmation_items、question_bank_items/document_json 与 QuestionAssets；取消修复沿现 owner AbortSignal，不新增 AgentLoop、DDL、依赖或模型。SDK 12 条 assistant usage 保留，cacheRead 是 SDK 报告 token，不是题库命中率；SDK 价格 0 表示这里未知，不等于账单免费。

**Next：B4 完整必要题面上下文精确合同 → B5 联合验收 → R2 可信精确复用/相似 Top10 → R3 受限 AST/SymPy → R4 同 Pi 五 tools → R5–R7 两 MVP、Office、三组卷模式和 30–40GB。** 不得通过删除 document 或仅发 stem 绕过 `document_context_unavailable`。完整解题/语义检索/数学导出/40GB、自然教师、设备/安装/VPN-off 仍 OPEN；Master 其他 DT/MA/JOIN 与 Phase6–8 保持 OPEN。

Evidence：`apps/desktop/test-results/goal/original-multi-20261009/closeout.json`；最终正式路径 `education-journey-15t76q`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`（dirty 保留）；未提交/push，不改日常资料、凭据、历史或另一 worktree。Master SHA 未变。以下历史保留其当时范围，以本节和最新真实证据为准。

## 2026-10-09 当前专题接续：B2-c限定接受

原页文字候选、教师临时选择校对、源CAS/坏缓存/取消/冷恢复已在当前正式入口验收；完整题块、跨页和来源答案仍未实现。最新事实以 `CURRENT_STATE.md`、知识库方案§40及 `apps/desktop/test-results/goal/material-layout-20261009/closeout.json` 为准。

下一实施卡为知识库方案§41：B3多块/跨页原题审核→B4完整必要Pi上下文→B5联合→R2可信题库检索/Top10→R3受限验证→R4五tools→R5–R7双业务闭环。Master保持ACTIVE、Phase4/5 DOING；本片不替代其他DT/MA/JOIN任务，不将文字框称完整题或可靠解题。

## 2026-10-09 B2-b 版面/公式可行性结论（包含失败，非生产完成）

当前先补完整原题前置，不扩大DeepTutor运行时。B2-c→B3→B4→B5→R2–R7；Master DT/MA/JOIN及Phase6–8原任务仍OPEN。

6页公开扫描卷保留304文字行四边形，单页3.609–4.263秒。S中文/单位/LaTeX质量失败；M三清晰crop主要内容匹配预先人工转写（1.494–2.331秒），退化单位错误、图表180秒超时、空白两次减号。没有完整题界/数学正确性/总体准确率证明。CPU实验设备i7-13650HX/约32GiB，不是16GB基准。

仅测试env安装71个hash锁包与官方本地权重，未改生产OCR/资料/数据库/凭据。商业发行闭包、Windows进程树强制取消和安装/设备门禁未接受。原正式out SHA e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件与Master/worker/manifest未变，无新产品UI或solver完成证据；未提交/push。

Next：知识库方案§38 B2-c版本化候选协议/现teacher入口合同→B3多块/跨页/来源答案→B4完整Pi题面→B5联合验收→R2可信检索→R3受限验证→R4五tools→R5–R7双闭环/Office/三模式/大库。Phase4/5 DOING，Master ACTIVE；本片不将完整B2、KB-EXAM-001或可靠解题标完成。

Evidence：apps/desktop/test-results/goal/layout-formula-20261009/closeout.json、manual-review.json、first-failures.json；知识库方案§37为结论、§38为下一合同草案。下方原历史证据保持其范围。

## 2026-10-09 B2-a 后台资料整理（限定接受）

本片B2-a已限定接受；B2-b按知识库方案§34冻结窄POC，后续完整原题/可靠检索验证/双业务闭环保持原顺序。未把模型安装/界面按钮数等同教育功能完成。

B2-a 后台资料整理已实现，已验最终build e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件：build/typecheck、renderer177、统一领域209（新增队列17）、正式Electron11/4启动/0 renderer错误及12张双尺寸深浅截图通过。实际deepseek-flash/Pi实读触发优先解析，SDK usage单独保留，不算账单/单题成本。同一最终build兼容207/207通过。仅B2-a持久后台整理切片接受；完整B2/R1-B/KB-EXAM-001未完成。

Phase4/5 DOING，Master Goal ACTIVE。仅本机确定性任务消费，无新依赖/DDL/AgentLoop/公式模型安装；不把OCR正文当原题、标准答案或已审核事实。新队列仅显式采用资料，旧占位不自动消费；旧同步入口保留。单文件整体提交与重启，不承诺页级checkpoint、30–40GB吞吐、PID复用抢占或自然教师/安装验收。Git本地/远端HEAD均488f8109d68027a6eb488e9d04c4eb5073d153cd，dirty保留、未提交/push；日常资料/配置/历史及另一worktree未改。

Next：B2-b真实版面块与唯一公式候选许可/设备POC（方案§34）→B3多块/跨页/源答案教师校正→B4完整必要Pi图/公式上下文→B5联合验收→R2可信检索/Top10→R3受限SymPy→R4同Pi五tools→R5–R7双MVP/Office/三模式/大库；Master其余DT/MA/JOIN/Phase6–8保持OPEN。

Evidence：apps/desktop/test-results/goal/material-background-20261009/（commands、first-failures、source-manifest、visual-review、native-usage与真实readback）；完整收口见该目录closeout.json；最终207在accepted-build5运行，之前build3的207仅为历史证据。下方历史保留，以本节与实际证据为准。


## 2026-10-09 B1 原题资产与教师审核：单题单页切片接受

优先专题推进到原题单页入库，不重复已接受的预览或writer。下一B2–B5，之后可信检索/验证/解题与两条KB业务闭环；原DT/MA/JOIN、Phase6–8全部仍按Master保留，不把此切片当完整DeepTutor模式融合。

仅接受单题、单页、一个原件区域的原题审核/入库切片。完整B1/R1-B、KB-EXAM-001、可靠解题、100分组卷/错题Top10/数学导出/30–40GB仍OPEN；Phase4/5 DOING，Master Goal ACTIVE。

最终build/typecheck通过；renderer174/174、统一领域192（新增原题边界17）、真实DeepSeek正式Electron13/4次启动/0 renderer错误、独立原PDF与候选/正式PNG逐像素对照2项通过。8张深浅主题、1366×768/1920×1080原题审核与题本截图已实际查看。最终accepted-build4与当前out逐文件一致，采用现evidence.mjs指纹SHA `991bcce76eab745609ccb8fa012ff2d17711749366261656e753514d0fa94a0b`（340文件）；旧smoke207通过于build3 `d16dfa9b639d55c0b517b5b94c754a18b6f8c5e56fc160ed4ed4ccc936989da4`，main与最终不同，不能称全207在最终构建运行。

真实Pi请求证明本轮正文实读→工具→审核流程，不证明数学答案正确；教师交互为隔离Electron自动操作，不是独立人类教师签收。当前答案origin=missing，未新增学生事实。原图只在本机显示，Pi题面reader遇document仍明确拒绝不完整文本读取；完整上下文待B4，不允许漏图解题。

Next：B2真实版面/题块定位、唯一公式候选许可/权重/设备POC、现SQLite上的确定性持久解析任务与任务优先→B3完整题块/跨页/来源答案校正→B4题本/Pi完整必要上下文→B5原图/公式/答案与恢复联合验收→R2可信精确复用/语义Top10→R3受限验证→R4同Pi五tools/讲解→R5–R7双业务闭环/导出/三模式/大库，继续Master其余任务。

Evidence：`apps/desktop/test-results/goal/original-review-20261009/closeout.json`。本地/远端HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`一致；dirty保留。无新依赖/DDL/Worker或AgentLoop，无提交/push；测试使用隔离资料/数据/profile，未改日常凭据、资料、历史或另一worktree。Master SHA未变：`dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302`。

以下保留历史，当前实现状态以本节和最新真实证据为准。


## 2026-10-09 解题路线当前复核（审查交付）

解题路线当前审查交付；优先原题审核/完整读取，然后检索与验证。KB-EXAM-001组卷和错题两个MVP继续保留；新专题不取消原Master DT/MA/JOIN及Phase6–8。

当前Phase4/5 DOING、Master Goal ACTIVE。本次仅完成源码/许可/方案复核；既有R1-A文字、B1题面存储及原页预览保持限定接受，完整原题、可靠求解、语义Top10、100分/数学导出/40GB仍OPEN。下一实施：R1-B/B1正式题图与原题审核writer精确合同→B2–B5真实原题闭环→R2可信检索→R3受限验证→R4同Pi五tools/讲解→R5–R7两业务闭环，再继续Master。

Evidence：apps/desktop/test-results/goal/solver-audit-20261009/current-review/。本次不提交/push、不改凭据/资料/另一worktree。


## 2026-10-09 R1-B/B1 原页保真预览（最新，限定范围）

仅接受B1原页/区域预览小切片，完整B1/R1-B/KB001与可靠解题仍OPEN，Phase4/5 DOING，Goal ACTIVE。现“我的资料”可在本机查看PDF原页、翻页、放大、停止、重试；源变化/丢失/坏文件诚实提示。保留图、表、公式及选项的原件栅格，不等于自动切题、公式转写或答案正确。无新依赖/DDL/模型调用/另一AgentLoop，无原题/答案/学生事实写入。

最终out与accepted-build3逐文件一致，SHA b3e51f18bbe0ff8604918a3a4dc846020136679dc6e5f4333686827ad3839843 / 340文件。最终build/typecheck通过、renderer174、领域175、正式Electron12/2次启动/0 renderer错误/前后build一致，3项独立原件像素对照通过，8张深浅双尺寸原页截图已查看（仅预览面板；不代替完整Shell/动画/教师D/安装E）。PDF13及旧smoke207在accepted-build2通过，其main/preload与最终完全一致，renderer不同；不混称全207在最终build运行。旧image宿主10通过，同新固定runtime。证据：apps/desktop/test-results/goal/material-preview-20261009/closeout.json；逐命令/首失败/回滚与指纹均保留。

Next：B1正式question-assets/v1同源快照、现ledger原题类别与内部writer精确合同/实现→B2真实版面/唯一公式候选POC/持久确定性后台任务→B3教师校正确认→B4题本/Pi完整必要上下文→B5逐题原图/答案/故障恢复验收。然后R2–R7及KB001纯题库100分/错题Top10/Word-PDF/重启双闭环，继续Master其他任务。

以下保留历史，当前状态以上节为准。


## 2026-10-09 R1-B/B1 题面与版本底座（最新，限定范围）

只接受R1-B/B1题面存储与版本底座小切片；完整B1、R1-B、KB001、Phase4/5及Master Goal仍OPEN/DOING/ACTIVE。题面合同结构合格不等于原件真实、完整、数学正确或教师已确认。

本片底座完成，证据apps/desktop/test-results/goal/question-document-20261009/closeout.json。完整B1尚未完成，不直接跳到求解或整卷；继续补齐B1同源题图资产根/哈希/授权与现审核ledger原题类别/内部writer合同，再B2真实版面与唯一公式候选POC/持久任务→B3教师校正确认→B4题本与Pi完整上下文→B5原件逐题/故障/冷恢复。R2–R7及KB001双闭环保持OPEN。

以下保留历史，当前状态以上节为准。


## 2026-10-09 解题路线审查复核（最新）

R0十项技术审查/开源许可/两方案/成本/验收与开发清单已交付；R1-A文字前置已接受、当前build未变，禁止重新列作未验。下一唯一实施R1-B B1精确题块/来源/审核/迁移合同→B2–B5；再R2可信解复用/相似、R3受限verify、R4同Pi解题、100分+Top10、数学导出/40GB，最后Master DT/MA/JOIN。详XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md；本轮无产品实现，不标全Phase/KB001完成。


## 2026-10-09 R1-A 扫描PDF文字前置验收（当前）

- [x] R1-A 扫描PDF文字前置限定接受。
- [ ] R1-B完整原题图公式/来源/教师校正确认（NEXT）。
- [ ] R2可信题库优先/结构检索/相似→R3受限verify→R4唯一Pi solve。
- [ ] KB001组卷100分＋错题Top10/数学WordPDF联合接受。
- [ ] 三模式/大库→原DT/MA/JOIN/Phase6–8。

当前build 8f2c2f180a5bf337dbff2258c9ec408d06cba944a4c2bf86d1867019f38c693b / 340文件；renderer174、领域164、正式Electron13、旧image宿主10、旧业务smoke207均通过。8张新版浅暗1366×768/1920×1080首末页截图已逐张查看；静态视觉不替代动画、全Codex或人类教师验收。证据：apps/desktop/test-results/goal/kb-exam-samples-20261008/closeout-r1a.json。

以下保留历史；当前状态与下一任务以上节为准。


## 2026-10-09 低成本解题审查与路线修正（当前）

当前用户先低成本解题审计/开源方案，R0文档交付不替换原Goal。R1-A先接受扫描PDF草稿→R1-B原题来源/教师确认→R2可信题库/相似→R3verify→R4唯一Pi解题→100分/错题双链→数学导出→三模式/大库，再回DT/MA/JOIN/Phase6–8。

[逐卡TODO](XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md)；[十项审查](../architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md)。test已到，不再样本待补；主要扫描物理/无独立数学gold。所有未验功能保持OPEN，上游新版本/历史实例数量不能提前关卡。

以下旧记录保留历史；本轮状态与下一任务以上节为准。


## 2026-10-08 知识库与智能组卷专题（当前）

用户2026-10-08指定优先完成“本地知识库＋智能组卷＋错题相似练习”，随后继续原Goal。原Master保持2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302；Phase4/5 DOING、Goal ACTIVE。旧“下一唯一任务讲义”仅为历史，本次优先级以本节为准。

- [x] 专题基线与关键源码差距/复用分类整理（不是功能接受）。
- [ ] KB-EXAM-001-S1 完整原题导入/来源/教师确认/Pi读取。
- [ ] S2 结构化分页/资格/方法相似检索与质量比较。
- [ ] S3 纯原题20题100分约束组卷。
- [ ] S4 真实错题图片→OCR确认→Top10/专项练习。
- [ ] S5 数学Word/PDF，学生版/答案版隔离。
- [ ] S6 两闭环正式Electron/重启/失败联合接受。
- [ ] 三模式/5变式质量隔离、40GB稳定化。
- [ ] 返回DT剩余→MA/JOIN→Phase6–8；既有OPEN项保持。

[知识库与智能组卷专题](XIAOZHI_KNOWLEDGE_EXAM_TECHNICAL_PLAN.md#19-2026-10-08-本地源码审查与进度)

以下旧记录保留历史；当前优先级以上述专题为准。


## 2026-10-06 DT-05 同源五题与两周训练（当前）

本轮第3项照片同源5变式→教师保存题/练习→完整14天→5实际结果/8分→再分析修订已在owned实例通过。原DT-05任务行仍OPEN；先完成讲义结构、检索质量对比与M04/M05/M06/M07/M09联合验收，再进入MA/JOIN，禁止从实例绿色直接关闭完整支线。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。



## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

- [x] 实际OCR、教师校正、Pi草稿与冷恢复。
- [x] 教师实际作答/表现/错因/知识点/类型/难度→原root/event同事务→真实Pi实读→立即传统列表与冷恢复。
- [ ] 下一唯一教育任务：同照片根题5道变式，教师确认题本和练习集合，保留父子来源。
- [ ] 根据错因、掌握、历史与难度安排14天，教师确认；保存真实训练结果再分析，完整Golden C/F真实DeepSeek验收。
- [ ] 完整DT-05后MA-01至05→JOIN→Phase6/7/8；全部未验项保持OPEN。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

- [x] 冻结 Golden C/F 照片来源合同。
- [x] 真实照片本地 OCR、取消、缓存、教师校正、绑定 Pi 草稿与冷恢复。
- [ ] 下一唯一教育任务：教师实际作答/表现、错因、知识点、难度和学生历史，复用现有 writer 原子保存来源根题与学习事实；禁止虚构父题。
- [ ] 唯一 Pi 实读上述事实，5 道变式→教师确认练习→个性化 14 天计划→真实结果→再评估，完成完整 Golden C/F。
- [ ] 完整 DT-05 后依次 MA-01–05、JOIN、Phase6/7/8；剩余 Codex 设计与所有学习模式不提前完成。

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

- [x] 已确认练习→原计划/结果writer的可选版本关联合同。
- [x] 逐题实际作答、明确表现、教师反馈和可选分数，来源/失败状态/防重/回滚。
- [x] 唯一Pi/原DeepTutor读取实际保存结果→教师确认修订14天计划→冷恢复。
- [x] 传统练习跨入口、旧题本副本、领域/组件/真实provider/浅暗双尺寸本切片验收。
- [ ] 对照现有OCR/题库/学习能力，冻结完整Golden C/F合同。
- [ ] 实际错题照片→本地OCR/教师校正→错因/知识点/学生历史/难度→5道来源可追溯练习→个性化14天训练及真实结果。
- [ ] 完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 Pi 插件目录与安装复核

- [x] 官方目录与npm版本/peer/安装树复核，三个兼容包项目安装与当前门禁。
- [ ] Pi原生MCP接宿主授权服务器；goal-x完成审计接既有SQLite。
- [ ] 浏览器候选源码/Windows/权限适配；后台包兼容版复核。

教育下一步仍是DT-05练习→实际作答/成绩→Pi/DeepTutor评估，插件任务不能替代该闭环。

详见 [Pi包清单](../integrations/PI_PACKAGES.md)。本轮证据：apps/desktop/test-results/goal/pi-packages-review-20261006/closeout.json；既有audit 5项（2 moderate/3 high）仍为发布待处理项。当前教育阶段4/5与完整Goal ACTIVE保持。

## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

- [x] 原题实际检索/读取、原DeepTutor格式与教师出题编辑确认。
- [x] 冻结练习集合旧数据兼容/失败恢复合同。
- [x] 实读已核对题目→教师编辑练习安排→原exercise_sets/question_bank_usage与确认ledger同事务保存。
- [x] 当前学生传统练习与同版本父题来源，拒绝/停止/冷恢复/防重、旧真实题目库副本、浅暗双尺寸本切片验收。
- [ ] 冻结并接通已确认练习→学习路径/真实作答与成绩→Pi/DeepTutor继续评估。
- [ ] 完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。

Evidence：固定build-c 341文件/SHA 15cba713c2dea8db351973b488c9314909caf31e5ea55d837c525159b0545207，默认out逐文件一致；build/typecheck exit0、统一145/145（education-boundary-wraImL，新增18项）、组件156/156、当前唯一Pi/真实DeepSeek9/9（education-journey-ADH5Jm，3次启动/rendererErrors=0）、旧真实题目核对数据副本3/3（5RLgDA，3题/33→33模型消息，0新增事实）、相关旧业务smoke207/207均当前固定build-c。八张实际Electron浅暗1366×768/1920×1080图逐张查看；核对/拒绝/关闭可达、长内容内部滚动、无横向溢出。完整命令、源码/报告SHA、SQLite读回、失败留存与视觉边界：apps/desktop/test-results/goal/dt05-practice-20261006/closeout.json。领域故障回滚使用真实SQLite测试ports；原writer保存由真实页面证明，不冒称生产OS强杀。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

- [x] 原题真实检索/读取与原DeepTutor格式Worker。
- [x] 唯一Pi→可编辑题目候选→教师确认→同库题本保存/本地父子谱系核心→真实DeepSeek/冷恢复（限定题目切片）。
- [ ] 冻结练习集合旧数据兼容与失败恢复合同。
- [ ] 同一确认把候选题目保存为exercise_sets/question_bank_usage，贯通跨入口谱系读取。
- [ ] 传统练习、学习路径、实际结果与继续分析。
- [ ] 完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。

Evidence：固定341文件/SHA e80b3052e86609b0156b7f91f735b534b9ba47c92d04a9cd83b81abdb0190ab2；原源码verify/build/typecheck exit0、统一127/127、当前组件150/150、当前唯一Pi/真实DeepSeek教师核对10/10（education-journey-R7dHLl），3次启动、rendererErrors=0。浅暗1366×768/1920×1080四图实际逐张查看：确认/拒绝与输入可达，窄窗题目字段在内部滚动区，无横向溢出。相关历史回归207/207是在build-a、最终元数据/摘要绑定/重试修复之前，不能当成最终构建全部回归。精确命令、SHA、版本、失败留存、SQLite读回与视觉范围：apps/desktop/test-results/goal/dt05-review-20261006/closeout.json。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 原测验格式能力复用（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05第2项DOING，完整Goal ACTIVE。上一轮为真实进展，其题库来源接缝6/99/146/8/207和4图报告本轮只读复核，未冒称重跑。

- [x] DT-05第1项真实题库来源（上一轮限定接受）。
- [x] 第2项内部原quiz解析/归一/issues/强schema/固定Worker与包资产门禁。
- [ ] 第2项完整Pi→可编辑候选→真实教师UI/DeepSeek/冷恢复接受。
- [ ] 第3项谱系迁移合同、教师编辑/确认/原子原题库和练习保存。
- [ ] 第4项传统练习/路径/实际结果；第5项完整DT-05/Golden C/F。
- [ ] MA-01至05→JOIN→Phase6/7/8。

Evidence：npm run verify:deeptutor-question exit0；build/typecheck0、统一108/108（Q99ECJ，含9项新增原函数/真实进程/坏源码/取消等，与既有教育/SQLite/IPC/Pi回归）、renderer146/146。固定341文件/SHA fdda34a0a700f51827110cc796dd6992ce6f40fbcf0f758991665b380fec5f3c，out一致。精确源码/许可证/AST检查/命令/报告/边界：apps/desktop/test-results/goal/dt05-quiz-20261006/closeout.json。未改UI，renderer字节与上一轮build-a完全一致；本轮未执行新候选真实provider/页面/图审，也不以旧207回归代替新功能验收。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 真实题库来源接缝（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05 DOING，第1项真实题库来源接缝限定接受；完整Goal ACTIVE。

- [x] DT-05第1项：真实保存题库来源→Pi/DeepSeek实读→脱敏→本地来源/冷恢复/收藏/空结果。
- [ ] DT-05第2项：DeepTutor纯quiz归一、强schema及Pi候选。
- [ ] DT-05第3项：教师编辑/同库确认/原子保存题库与练习、谱系增量兼容。
- [ ] DT-05第4项：传统练习/精通路径与实际结果续接。
- [ ] DT-05第5项完整合同/Golden C/F→MA-01至05→JOIN→Phase6/7/8。

固定337文件/SHA 674fc8daf1620bfcba385a31f4fe12da9d8326c1993314d292367c494e9134d3；build/typecheck0、统一99/99（pvBYRJ）、renderer146/146、Pi协议8/8（CKxuuD）、当前唯一Pi/真实DeepSeek题库6/6（yTcdQR）、相关历史回归207/207。rendererErrors=0；浅暗1366×768/1920×1080共4张来源页图实际逐张查看，中文题干/答案/解析与关闭控件可达，无横向溢出，仅接受本来源对话框，不接受完整Codex像素/原生动态。精确命令/源码SHA/构建/报告/失败留存：apps/desktop/test-results/goal/dt05-question-20261006/closeout.json。

下一唯一教育任务：DT-05第2项，固定DeepTutor纯测验归一与协议Adapter→唯一Pi可编辑题目/练习候选；第3项同一确认账本教师编辑/确认/原子题库和练习保存及父子谱系（先冻结增量兼容迁移合同）；第4项传统练习/路径/实际结果；第5项完整DT-05与Golden C/F，再MA-01至05→JOIN→Phase6/7/8。完整DeepTutor、OpenMAIC课堂、日常人工、完整Codex/Golden/安装/无VPN仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

- [x] DT-04聊天两周提议/教师编辑确认/保存恢复（既有2yywL7九项，只读复核）。
- [x] DT-04传统学生学习计划、来源/历史/空/失败视图。
- [x] 中文实际结果录入→唯一Pi重新分析→教师核对→十四天再规划→冷恢复；当前14/89/142及12图。
- [x] 原结果1→2，原记录不改；旧version4实际表现保留，新version6首日2。
- [ ] DT-05原Question/Practice/Grading复用与真实来源/可编辑练习路径合同→纵向实施验收。
- [ ] MA-01至05→JOIN→Phase6/7/8；完整Golden F在联合与教师人工验收收口。
- [ ] 原生MCP真实配置、goal-x现有SQLite适配、兼容后台包分别核验；安装不代替生产。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

固定337文件/SHA 41e083651dd0e72e308a2bf9ed1b26715128909db0ca506574bd768d012a62c3；build/typecheck exit0、统一89/89（JC5UXh）、renderer142/142、当前唯一Pi/真实DeepSeek学生计划14/14（gsPCmm）、rendererErrors=0。12张浅暗1366×768/1920×1080截图逐张查看：计划、结果表单、重新规划后实际结果，控件可滚动到达且无横向溢出。历史回归207/207在build-a通过，发生于逐条证据目录/参数修正提示补充前，仅作相关旧教育回归。完整命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-workspace-20261005/closeout.json。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 当前执行清单（优先）

- [x] DT-03评估/复习策略领域七项合同限定收口；完整DeepTutor未完成。
- [x] DT-04实读来源→Pi十四天提议→教师修订确认→同库版本计划→模型再读/拒绝/冷恢复：9真实、81边界、137组件、207历史回归，12图。
- [ ] DT-04下一：既有学生学习计划入口读取同一账本、来源和陈旧/空/失败状态。
- [ ] DT-04下一：结构化实际学习结果录入与继续训练，不将安排算完成。
- [ ] 完整DT-04/Golden F门禁，再DT-05题目、测验、学习路径。
- [ ] MA-01至05→JOIN→Phase6/7/8。
- [ ] 原生MCP真实配置、goal-x现有SQLite适配和兼容后台候选分别核验，包安装不代替教师功能。

Goal ACTIVE。固定337文件/SHA 8af8cd343bcc97c858f266eafcabc7ad57fe3fc32aefc4c662860b1e00dd186b；build/typecheck0、统一81/81、renderer137/137、当前唯一Pi/真实DeepSeek训练9/9（education-journey-2yywL7）、相关历史回归207/207。rendererErrors=0。浅暗1366×768/1920×1080共12图逐张查看，分别定位训练字段与核对页尾，窄窗正常滚动可达、无横向溢出；不接受完整Codex像素/原生动态。精确命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-training-20261005/closeout.json。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 当前包切片与取消门禁

本轮包web/usage限定接入已接受，goal-x staged；DT-03生产确认/取消门禁已通过真实6与统一76，核心全合同接受仍需逐项收口。下一首要教育功能DT-04两周训练→DT-05→MA→JOIN，不转回模拟样例。扩展执行清单见integrations/PI_PACKAGES.md；教育既有顺序不改。


## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：实际融合程度逐项对齐官方清单，见CAPABILITY_MATRIX/EDUCATION_BRANCH_TODOLIST最新功能表；既有检索/引文/学生上下文/算法/教师核对与历史已融合，完整测验、学习路径、两周训练、视频及互动课未完成。本轮修复恢复旧会话时先写入后校验的问题：全部学生/学习/核对范围和工具先验证，复用Pi公开解析及内存SessionManager迁移后才持久打开；未知分支/版本、错学生、移除或错工具拒绝且JSONL字节不变，未绑定普通聊天保持空范围。无需新依赖/Schema/Store/循环。

Evidence：固定337文件/SHA 806bfe0dfc046374c13ef86434ca16e55193c09621a2b76582b7e5cea6b30df4，build/typecheck exit0、renderer133/133、统一边界64/64（新增7项原生身份）、本轮真实DeepSeek教师核对/冷恢复/事务退出回滚11/11、历史回归207/207。正式4次隔离Pi启动、rendererErrors=0；4张当前浅暗双尺寸图实际查看，1366暗图确认按钮需卡内滚动，本轮不接受完整Codex动态/像素效果。完整命令/报告/SHA：apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/closeout.json。

Doing/Next：生产宿主并发取消/确认门禁→完整DT-03逐条接受→DT-04两周训练（真实证据→教师修订确认→本地计划→冷恢复）→DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8；Phase3UX欠项保持OPEN，不转回模拟样例或只做底层测试。

Failed：前置测试脚本转义/重复导入已修，最终上述门禁无失败；旧失败报告保留。Blocked：无当前外部阻塞。

Runtime：npm start exit0，默认out与固定构建一致；单个日常main PID60468创建于2026-10-05T21:07:20.5459380+08:00并加载默认out/main/index.js，未读取或注入日常事实；日常DOM/人工、安装/无VPN与完整Golden仍未验。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

以下保留历史，当前状态以上述记录为准。


## 2026-10-05 用户功能纠偏：DeepTutor当前融合程度（当前定位）

定位结论：已有真实的部分能力融合，尚未交付完整DeepTutor学习工作空间。只读核验本轮官方README及远端main，upstream仍为f07029cfcf2c8dfccdb671cdfc343db8334f5741（v1.6.13）。用户列举的功能是上游能力清单，不能直接作为EduDev已完成清单。Master §11/12要求选择性吸收教育能力，Pi仍为唯一生产编排。原上游专用Loop/Session/账号/CLI与第二LearningStore不能随模式一起搬入。

|上游功能/教师结果|小智当前实际程度|当前入口/下一交付|
|---|---|---|
|聊天、提问与有来源辅导|已有唯一Pi+DeepSeek聊天、资料正文读取/搜索/原文核验；不是完整DeepTutor辅导模式|问小智；资料先收录再提问，DT-01a/01b限定接受|
|知识与阅读|复用原reading搜索/匹配，教师点击来源可定位并继续读已收录段落；全文沉浸阅读/书籍进度未融合|我的资料→问小智；Book/Reading学习状态待DT-05适配|
|学生学习上下文|当前新版学生档案绑定固定对话，必要脱敏读取实际记录、分页与来源；普通聊天不自动选学生|学生档案→问小智；DT-02限定接受|
|掌握度/评分/复习|原mastery/scheduler/grading已执行；显式证据分析、教师编辑确认/拒绝、策略版本与跨会话确认历史可用；完整精通路径未完成|同一学生对话与学习核对卡/资料侧栏历史；DT-03 DOING|
|测验、题目生成、解题、学习路径|既有领域/历史回归不等于新版Pi完整闭环；当前DT-05 OPEN|接入Question/Practice/Grading workflow并保留来源和教师修订|
|接下来两周训练、长期学习|尚无完整真实学习状态→教师确认→持久训练计划闭环|DT-04 OPEN；DT-03收口后的首个功能交付|
|课程学习、可视化、互动课堂|OpenMAIC只做过审计，正式生成/渲染未完成；DeepTutor对应完整模式未融合|DT-05与MA-01至05，教学内容空间统一入口|
|研究|已有Pi联网/浏览器工具，不能称已迁入DeepTutor Research workflow|按教育资料研究需求适配，最终用有来源真实产物验收|
|任务板|已有运行计划/Goal，未融合DeepTutor三列学习任务板、笔记及可恢复归档；两者不等价|训练计划阶段复用上游任务领域/UI接缝，沿同一SQLite；不以静态卡片冒充完成|
|连接学习语境|本地资料/学生事实/已确认学习策略已接；书籍、笔记本、题库、共写草稿统一上下文仍有缺口|DT-05/MA/JOIN；必要本地范围由宿主选择，不能默认整库上传|
|沉浸视频|YouTube字幕/时间戳辅导/继续进度未融合|记录为未融合候选；国内可用与本地优先要求下另审素材来源，不在当前DT-03扩建视频平台|
|子代理、Partner、外部CLI|未迁入DeepTutor这些模式；当前Master禁止第二生产编排|保持Pi，不能为了功能菜单接回Codex/Claude CLI或第二Runtime|
|多引擎知识库|当前资料索引/正文搜索不代表已迁LlamaIndex/PageIndex/GraphRAG/LightRAG/WeKnora/IMA/MarginNote/Kiwix全部后端|选择性知识能力适配；高级GraphRAG与多服务不属于当前单机闭环|
|可检查记忆|已有Pi教育记忆接缝；不是DeepTutor L1/L2/L3 Memory Graph全量迁移|Phase6无感飞轮、版本/评估/回滚仍OPEN|

实际可体验路径：从新版学生档案选择学生→问小智→“根据已保存的学习记录，分析当前问题和复习先后；不足的证据请说明”→打开来源核对；要求校正时在核对卡编辑确认→查看资料侧栏的学习核对历史。已有记录若只有自由文字，当前不会凭空补为结构化成绩/掌握事实；这个输入与引导缺口随DT-04/05闭环解决，不能要求教师理解内部JSON来替代产品交付。

真实旧证据本轮只读回核验：DT-01a LIumb0 4/4；DT-01b FeErHd 7/7；DT-02 8mHAh4 9/9；DT-03教师核对GwcHvH 11/11；跨会话历史1DXgrz 10/10，报告均success=true。精确SHA/构建在apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/deeptutor-prior-evidence-readback.json。这是既有实例证据复核，不能称本轮重新跑过全部功能。

下一步执行队列：1 DT-03学习能力恢复拒绝无副作用（已按本轮子集验收）→2 生产宿主并发取消/确认门禁→3 完整DT-03按合同核对→4 DT-04真实两周训练计划（建议/修订/确认/本地保存/冷恢复）→5 DT-05题目、测验、学习路径和知识检索→6 MA-01至05→7 JOIN→Phase6/7/8。用户感知结果为每个任务的完成定义；不转回测试样例书，不再把测试数当功能完成度。Phase3既有UX欠项保留OPEN。

官方来源：https://github.com/HKUDS/DeepTutor/blob/f07029cfcf2c8dfccdb671cdfc343db8334f5741/README.md 。以下是历史记录；冲突状态以本节与最新CURRENT_STATE为准。


## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

DT-03跨会话历史子集已验收，完整任务仍DOING。下一依次：新learning-review native身份兼容/未知版本/移除/错误工具与无副作用拒绝→生产宿主并发取消→完整DT-03逐条接受→DT-04/05→MA-01至05→JOIN→Phase6/7/8；Phase3旧欠项继续OPEN，完整Goal ACTIVE。

证据 apps/desktop/test-results/education-journey-1DXgrz/report.json（10项、真实7版本分页/来源修改/冷恢复），领域57项。

以下保留历史，当前状态以上述记录为准。

## 2026-10-05 学习校正与复习策略（本轮）

DT-03教师核对实现已贯通但完整Acceptance仍DOING：真实恢复11项与51边界/133组件/207回归已收；接下来补跨会话版本历史→新native身份→宿主并发取消完整门禁→DT-04两周训练→DT-05题目学习路径→MA-01至05→JOIN/Phase6–8。禁止把只读或单链绿色视为完整个性化辅导。

以下保留历史。


## 2026-10-05 DT-03 原学习算法与真实证据（进行中）

DT-03 DOING，完整Goal ACTIVE：只读原学习算法/显式全快照/工具已接，教师写入链当前Next。依次：1同库候选与校正注释契约；2独立action/来源版本/原子确认；3typed IPC+现有工作台可编辑核对；4真实DeepSeek→教师编辑确认/拒绝→版本回放→停止/重启/并发→A/C；5DT-04/05；6MA-01至05（上游已变7230053，需重审）；7JOIN/Phase6/7/8。当前自动/视觉只读测试不关闭完整DT-03。

以下保留原历史。


## 2026-10-05 DT-02 学生上下文与新版页面（最新）

当前唯一下一能力任务：DT-03；DT-02-entry/context已经限定接受，保存记录读取不等于完整个性化策略。此前正文里的context NEXT/未实现为当时历史记录。完整Goal ACTIVE，DT-04/05、MA-01至05、JOIN和Phase6/7/8仍OPEN。详见PHASE4_STUDENT_CONTEXT_ACCEPTANCE.md。

以下既有记录保留历史范围，当前状态以上述记录为准。


日期：2026-10-05。主合同：`XIAOZHI_CODEX_GOAL.md`（完整 Goal ACTIVE）。

## 本轮优先级与真实进度

用户要求集中完成两个能力支线。本清单覆盖 Master §11–14、Phase4/5、Golden E/F，并读取了 `架构图` 三份 HTML 内的结构数据和三仓审计。图中的目标连线不是已实现证据。Phase3 传统教学/学生页仍未整体接受；按本轮用户纠偏，先推进能力支线，保留原欠项，后续接回同一五空间。未修改 Master 的完成标准。

当前已有：唯一 Pi 1.0.2 编排、真实 DeepSeek、办公/网页/浏览器工具、资料收录与正文工具；新版 DeepTutor Provider 已接入首个只读引用核验切片。正文检索与可点击来源现已限定接受；当前缺失：学生个性化训练、OpenMAIC SDK/课程生成/课堂渲染。旧教育回归通过不能代替新版 Golden E/F。

## 固定源码与复用决策

|对象|核对事实|决定|
|---|---|---|
|EduDev|HEAD `90d67381a08db8ba040211921288b55c87de3f55`，工作树有未提交改动|KEEP 产品/SQLite/文件/权限；按域增量适配|
|DeepTutor vendored|v1.5.11 / `456f9c24226e008f1ff07a7e3455d7b4d39f6221`|保历史隔离，不原地改 vendor|
|本地 DeepTutor 工作树|`be1701108a22c1037bb8004322ef6145302cbf5e`，有5份未提交修改|不切换、不覆盖；不能将该工作树称为最新版|
|DeepTutor upstream main|read-only ls-remote：`f07029cfcf2c8dfccdb671cdfc343db8334f5741`，架构审计 v1.6.13；本地已有 Git 对象|从固定 Git blob 提取选择性能力，Apache-2.0|
|OpenMAIC|本地 `636fab0d7edee5e7c2694117c38ece8f623573f9`，当前上游已变 `7230053af019b89c83d22dcab0a94f38fe193856`；原本地审计MIT|进入MA前重新核差异/SDK/许可证；仍复用独立SDK，不迁移整站|

|DeepTutor 能力|处理|接缝/边界|
|---|---|---|
|Learning / Mastery / Student state|UPGRADE + ADAPT|策略与证据接 EduDev 学生/学习事实；不引第二 LearningStore|
|Practice scheduler|ADAPT|纯 state/rating/now；与现有按知识类型复习策略做差异回放，版本化，不静默覆盖历史|
|Reading|REUSE + ADAPT|原始纯匹配函数与本地资料段落；准确区分原页码和收录段落|
|Question / Grading / Learning path|ADAPT|版本化输出、教师纠正/确认、来源谱系；启发式评分不是事实|
|Book|ADAPT|教学知识结构/内容计划；互动渲染归 OpenMAIC|
|Parsing / Attachments|KEEP existing|先复用现有 Hana/AnyDoc/OCR/typed 宿主，按缺口升级|
|RAG / Provider|SELECTIVE ADAPT|索引版本、来源检索、评估；不搬全套 GraphRAG/LightRAG|
|Workspace|ADAPT patterns|复核路径约束/反链接/输出授权，沿用唯一文件宿主|
|Memory / Consolidator|ADAPT patterns in Phase6|只输出可评估偏好/策略候选，不写学生 FACT|
|AgentLoop / Agentic Loop / Session / FastAPI / Web/Auth|DO NOT USE|生产仍只有 Pi loop、EduDev 会话与本地真源|

|OpenMAIC 包|固定审计版本|作用/边界|
|---|---|---|
|@openmaic/dsl|0.11.2|纯课程/Stage/Scene 合同与验证；无 runtime dependency|
|@openmaic/generation|0.3.15|AICallFn 注入同一 DeepSeek模型宿主；jsonrepair/katex/nanoid/parse5/partial-json 需锁定与许可核验|
|@openmaic/renderer|0.1.11|同一教学内容空间只读渲染；不是 HTML 安全消毒器，字体许可另核|
|@openmaic/editor|0.0.9|受控文档编辑，宿主负责保存、版本、冲突和恢复|
|@openmaic/importer|0.3.0|PPTX→DSL，浏览器解析隔离，文件/产物仍由 main 托管|
|@openmaic/storage|0.37.1|仅接口/抽象接 EduDev；不启用 PG/HTTP/S3 Store|

官方来源：[DeepTutor](https://github.com/HKUDS/DeepTutor)、[OpenMAIC](https://github.com/THU-MAIC/OpenMAIC)。源码位置为 `packages/@openmaic/`。不把上游 director/server Agent 当作可直接搬进生产的 SDK。

## 依次实施与完成定义

所有任务先冻结增量合同；实现→typecheck/build→相关边界/集成→正式 Electron 实例→本地 readback/冷恢复→实际图审（有 UI）→状态记录。禁止用 stub/模拟结果宣布能力完成。测试夹具只放 owned test-results。

|顺序/ID|教师可见结果与实施|前置|验收与状态|
|---|---|---|---|
|0 B0|三方升级审计、能力处置、所有权、许可证与源码固定|Master/架构图|源码/工作树/远端比较已核；AUDIT DONE，集成未完成|
|1 DT-01a|核验引用是否确实位于指定资料的保存版本；原 DeepTutor reading 匹配代码直接复用，Pi Provider 注入|B0、已有资料正文|11边界/12相关回归/133组件/正式真实DeepSeek4场景及冷恢复、5图审；限定A/C ACCEPTED，非完整DeepTutor|
|2 DT-01b|全资料正文搜索、按定位继续阅读、教师点来源可定位|DT-01a|真实超过分页边界资料、原段落与来源版本一致；原页码未建立前不伪称页码；18边界/133组件/12相关回归/真实DeepSeek7场景/9图审；限定A/C ACCEPTED，见PHASE4_DT_01B_ACCEPTANCE.md|
|3 DT-02|选定学生后按真实错题、成绩、历史读取必要脱敏事实|B0|共享学生上下文契约→Repository→typed学生选择→Pi；越权/空档案/重启/姓名脱敏；DOING；DT-02-entry/context已限定接受（context：25边界/9真实DeepSeek/8图/133组件，16真实队列键盘；鼠标及全页面欠项保留），DT-03 NEXT，见PHASE4_STUDENT_CONTEXT_ACCEPTANCE.md|
|4 DT-03|掌握度、错因、评分与复习策略解释/可纠正|DT-02|DOING：原算法只读基础38边界/7真实DeepSeek/8新版入口/133组件/207历史回归；教师编辑、确认/拒绝/策略版本与跨会话历史已按子集验收；native身份及生产宿主并发取消完整门禁本轮继续；PHASE4_LEARNING_STRATEGY_CONTRACT.md|
|5 DT-04|“接下来两周训练”：真实学习状态→训练建议→教师修订确认→本地计划|DT-03|Pi/DeepSeek真实工具、来源与难度、计划版本、无资料诚实反馈、冷恢复；Golden F；OPEN|
|6 DT-05|题目/学习路径/讲义结构与可靠检索接入|DT-01b/03|强 schema、父子来源、可修正、检索质量对比；M04/M05/M06/M07/M09 联合验收；OPEN|
|7 MA-01|锁定 SDK 依赖/许可证/安装体积/Windows；本地课程版本化合同与 Artifact Repository|B0|DSL非法内容/迁移/损坏恢复/单一SQLite真源；不引第二 Session；OPEN|
|8 MA-02|小智调用 generation 生成真实课程/Stage/Scene|MA-01|AICallFn注入已有模型宿主，必要脱敏文本，取消/失败/有来源，无 runtime预算；OPEN|
|9 MA-03|教学内容→互动课堂，真实课程可打开与交互|MA-02|复用 renderer/CSS，quiz/whiteboard/PBL按DSL能力递进；恶意HTML/外链、浅暗双尺寸；OPEN|
|10 MA-04|编辑/修订/恢复互动课，按需求接 PPTX importer/export|MA-03|复用 editor/importer；版本冲突、旧课迁移、离线资产、字体许可、真文件；OPEN|
|11 MA-05|“给勾股定理做互动课堂”：聊天→生成→打开→答题/修订→重启|MA-04|真实 DeepSeek/正式Pi、源文件/SQLite回读、Golden E；OPEN|
|12 JOIN|两支线串联：学生问题→训练/互动课，传统教学/学生页面收尾|DT-05/MA-05|无第二Agent/数据真源，Phase3欠项收口，Phase4/5联合接受；OPEN|
|13 NEXT|Phase6无感飞轮→Phase7安全/恢复/国内API/无VPN/安装→Phase8 Golden A–G|JOIN|完整Master DoD；未达到前 Goal ACTIVE；OPEN|

每项实质完成后写清 Done/Failed/Next、精确命令、固定源码/构建/报告及未验证边界。无需再次派生测试样例书专项。旧 runtime 的退役条件是新版能力覆盖与重要教育回归迁移完成，不能现在按目录删除。

## DT-01a 本轮交付合同（M02/M04/M10）

- 原始 `reading/search.py` + `reading/models.py` 从固定 f070 Git blob逐字提取到独立 education/vendor；保留 Apache LICENSE/source manifest，旧 python/vendor 不动。匹配本身无模型、HTTP、Store、Agent依赖。
- main 的 EducationCapabilityProvider 装配 Pi 只读工具；参数只有真实 resourceId、offset、保存版本及必要 quote，不允许路径/SQL/学生库。使用已有 MaterialRepository 和教育脱敏；独立 additive native marker，旧 JSONL 创建身份不重写。
- 单次 stdlib Python worker 执行原始函数，明确协议/输入输出上限/超时/取消，worker 不获得凭据；失败有中文可重试状态，无第二持久服务。桌面构建复制固定代码资产；现有 Python 解析选择仅 main 控制，Windows 安装包自带运行时仍属 Phase7未完成门禁。
- 无数据库迁移、无新增 npm/pip 依赖，不改变事实/权限/上云规则。匹配只证明已收录的脱敏段落支持引用，不等于教师确认、原PDF页码、答案正确或整库搜索。
- 旧会话添加能力独立marker；未知/缺失工具或版本拒绝。回滚撤除 provider+marker版本兼容处理，不重写历史；只读不需要事实回滚。
- 限定完成：原代码SHA一致、真实worker边界/Pi旧会话/执行一次、正常build/renderer、正式Electron真实DeepSeek引文核验及保存后冷恢复。任何门禁未过仍 DOING；不宣称完整DeepTutor或Golden F。

验收详情与遗留门禁见 `PHASE4_DT_01A_ACCEPTANCE.md`。下一唯一任务 DT-02；学生个性化/Golden F与OpenMAIC/Golden E均OPEN。原legacy全套smoke本轮失败保留，不作为这个只读能力的完整教育回归证明；与新能力直接相关的原12项资料/Office回归实际通过。

## DT-01b 当前收口

限定接受：PHASE4_DT_01B_ACCEPTANCE.md。历史学生保存反馈故障已在DT-02-entry修复；最新全套历史smoke207通过，DT-02-context下一项。目标完整未完成；后续依次DT-02/03/04/05、MA-01至05及JOIN。

## 新版页面与当前下一项

用户指定学生页新版布局保持。正式UI证据排除legacy-test截图，日常启动已切至当前out。DT-02-entry限定接受，DT-02-context未实现；随后DT-03/04/05、MA-01至05及JOIN。207历史回归不是新版Golden E/F。

## 2026-10-12 功能优先执行清单（当前）

原则：先完成教师可用功能，每片只做构建/类型检查和对应关键实例；失败修复只验证直接风险。现24题分层质量不扩大成无限回归，质量缺口随复杂题/变式功能暴露、处理和记录。保留教师确认及不确定标注。操作复杂度在内部处理。

### 三个参考项目的复用落点

| 项目 | 已有真实落点 | 后续直接复用候选与宿主接缝 | 状态 |
|---|---|---|---|
| DeepTutor | question-worker.py通过固定f07029c/1.6.13源码AST复用_parse_quiz_payload、_normalize_quiz_payload、_collect_quiz_issues；同Pi工具已有题目/练习/阅读适配 | 题目变式与原题图文来源能力；现QuestionReviewRepository、MistakeFacts、PracticeReview和MaterialRepository承接；先比较已固定源码与新版本的差异，再机械提取必要纯函数/提示资产 | 部分已复用；完整模式及最新源码差异迁移未完成 |
| OpenMAIC | 已有DSL/renderer/generation包审计和AICallFn接缝设计，当前生产package.json没有@openmaic包 | 优先generation+DSL+renderer，后editor；AI调用由Pi宿主控制，产物沿Office版本审批/本地事实保存；课堂按Master Phase5实现 | 未接入正式课堂功能；不能将审计记为已交付 |
| Hermes Self-Evolution | Master Phase6规划；本轮读取evolution/skills/evolve_skill.py，确认技能加载、候选优化、约束和留出评估代码 | 先复用技能文本读取/重组、候选差异和约束筛选；结果作为待教师启用的新技能版本，既有技能管理/审核保存；DSPy/GEPA独立离线候选优化的引入另冻结合同 | 尚未集成；不能宣称工具/系统提示/代码/连续进化已完成 |

上游只读2026-10-12：git ls-remote HEAD为DeepTutor 6cf793bd868ba5ecbe64722936d4be8fab5a01df、OpenMAIC 7ca6077cdd3e769750932c50347042883cbe0dc7、Hermes 0a929e3aa20e15cf04dc7c28492a7d41a5139125。HEAD核对不等于该commit全部源码已审。DeepTutor官网main README当前列1.6.14；本地旧整包manifest仍1.5.11，生产题目Worker单独固定1.6.13，版本不能一概称“最新”。指定DeepTutor/OpenMAIC本地根目录当前不存在，D:/WorkProject/开源只有langgraphjs、openhanako及版本副本、ZCode；Hana继续作为文件/界面辅助复用来源，不替代这三个Goal项目。

许可证：DeepTutor LICENSE原文Apache-2.0、OpenMAIC LICENSE原文MIT本轮实读；Hermes README声明MIT，固定HEAD LICENSE路径404，实际许可证文件和转依赖在复制前必须核实。原版权/NOTICE/固定revision/hash保留。不整搬上游运行时、数据库或网站。

参考来源：[DeepTutor题目源码](https://github.com/HKUDS/DeepTutor/blob/main/deeptutor/agents/question/pipeline.py)、[OpenMAIC SDK目录与接入说明](https://github.com/THU-MAIC/OpenMAIC)、[Hermes技能优化真实入口](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py)。API无鉴权只读树请求403限流，未使用凭据绕过；三个固定HEAD raw路径404未当能力证据。新包/新源码迁入前补准确路径、许可证、SHA与Windows影响，当前功能沿既有合法复用实现。

### 实施顺序与最小实例

| 优先级 | 任务/教师结果 | 复用入口 | 完成实例 |
|---|---|---|---|
| 1 | C3多组题目修改，一次检查、一次整卷确认 | PiQuestionCollection+原编辑器+reviewXiaozhiQuestions | 两组修改→一键检查→12题100分预览→冷读，本轮已通过 |
| 2 | D错题五变式：从已确认错题一键继续，内部读取原题/检索/生成，显示五道不同训练点与原题来源 | 现MistakeFacts/MistakeSimilar、question-review coordinator/collection、DeepTutor格式与生成提示资产、PracticeReview | 一个真实复杂错题照片→本地OCR/校正→五变式→失败隔离/修正→一次确认→练习保存/冷读 |
| 3 | C3跨学科图文条件与解题质量：知识点/难度/完整条件、来源图文、可行数学检查与主观题证据审核 | 原QuestionDocument、source preview、question-quality/math、DeepTutor已有纯校验 | 数学/理化生/史地政/语英等分层复杂材料，按现24题清单逐项实例，不冒称单一SymPy覆盖全科 |
| 4 | KB003大资料库后台增量、任务优先、取消恢复，教师只导入/选资料/说需求 | MaterialRepository、既有确定性队列/文件hash/Worker | 导入→只处理变化文件→正在组卷的资料优先→退出/重启继续；30–40GB性能另按实际设备记录 |
| 5 | Phase5可编辑交互教学内容/课堂 | OpenMAIC独立包+Pi AI注入+原本地Office宿主 | 已确认课程材料→课件/交互题→保存/再打开 |
| 6 | Phase6教师反馈→可审查技能改进 | Hermes技能纯函数/约束+现Pi技能管理 | 一次真实教师修正→候选版本→差异/检查→教师启用→下轮使用，不中途替换 |

下一唯一开发入口：D错题五变式。先核现mistakeSimilarPiJourney、QuestionReview/PracticeReview共享契约，确定五题内部起草与集中确认接缝；有真实缺口才扩展，保持原学生/会话/原图权限与源版本，不新建AgentLoop或题库。跨学科质量随功能实例补齐，不把自动正确性冒称已完成。

### 2026-10-12 清单更新
- [x] D独立五变式入口及自然物理照片关键实例：14项，冷读一致，两个不同授权，限定接受。
- [ ] KB003核既有调度/增量/优先/恢复实际缺口并直接复用补齐。
- [ ] C3原选项重复显示清理、复杂图文条件/全科质量随功能推进。
- [ ] Phase5 OpenMAIC课堂；Phase6 Hermes教师反馈技能改进（先许可证/固定源码，现Pi与本地审批接缝）。

### 2026-10-12 KB003接续
- [x] 重复同名内容复用与变化不可变新源，原件损坏/取消/冷读关键实例限定接受。
- [ ] 目录批量导入→原hash复用→原后台队列，减少50文件分批人工选择。
- [ ] 30–40GB/Windows安装，C3全科图文质量及重复选项。

### 2026-10-12 目录批量接续
- [x] 一次原生目录选择/20文件内部批次、61资料/重复/变化/停止/重新选择/冷读限定实例。
- [ ] C3规范化重复选项，复杂自然图文/条件/步骤的学科分层质量。
- [ ] KB003 30–40GB、安装、目录/页级持久断点；现重选接续不冒称全自动。

### 2026-10-12 功能优先：唯一继续队列（覆盖上方历史Next）
- [x] 原选项重复/字段冲突隔离与同正文入库；缺图/缺表隔离；明确多小问答案和解析结构覆盖、同Pi修复（均限定实例接受）。
- [x] 错题五变式独立入口、集中核对/安排；资料内容复用/变化新版本/文件夹批量、停止重选接续。
- [ ] C3 全科复杂图文：沿原24题分层清单用真实资料逐项解决教师操作/完整条件/解析缺口，不重新重复已接受实例。
- [ ] KB003 正式后台持久接续与任务优先，30–40GB实际设备表现、Windows安装；页级断点/watch只按实际需求扩展既有确定性队列。
- [ ] 教师资料→题库→蓝图→100分试卷与解析、错题→相似/变式→练习两闭环整体收口；不足如实标识，不能AI补事实。
- [ ] 主线收口后推进OpenMAIC互动教学与Hermes无感学习；仍Pi唯一生产编排。

### 2026-10-12 KB003接续纠偏
- [x] 全部匹配schema中断claim分页恢复、正在后台解析资料可优先（限定实例）。
- [ ] 下一直接推进C3真实复杂图文/全科学科分层题库与整卷内容，不重跑已接受队列实例。
- [ ] 页级/目录持久接续、30–40GB实际性能及Windows安装；原selected-folder重复导入接续保持。

### 2026-10-12 表格Office接续（当前Next）
- [x] 现Office宿主v5：学生/教师WordPDF四文件、来源谱系与冷读限定接受，见kb-table-office-20261012。
- [ ] C3自然复杂图文跨学科内容与24题分层质量；不重跑已验的表格导出。
- [ ] KB003目录/页级持久接续、30–40GB与安装。
- [ ] 主线收口后OpenMAIC互动课堂与Hermes教师反馈；在原Pi接缝合法复用。

### 2026-10-12 可视框选接续
- [x] 原题范围可视选择：真实复杂扫描、取消、键盘、教师确认和冷读限定接受。
- [ ] C3自然跨学科图文、公式与答案完整性；24题分层质量仍OPEN。
- [ ] KB003目录/页级接续、30–40GB与安装。
- [ ] 主线之后OpenMAIC课堂与Hermes反馈，原Pi框架内复用。

### 2026-10-12 候选转写接续
- [x] 原题候选结构化转写贯通同Pi工具→审核页→教师→冷读，限定接受。
- [ ] C3自然复杂图文和跨学科24题质量，不能以预填代替OCR/数学验证。
- [ ] KB003目录/页级接续、30–40GB及安装。
- [ ] 主线收口后OpenMAIC与Hermes；Pi唯一生产编排。

## 2026-10-12 功能优先执行顺序
统一执行表：[FEATURE_FIRST_EXECUTION.md](FEATURE_FIRST_EXECUTION.md)。先完成当前按页接续，随后整卷候选集中审核→复杂100分卷及答案修复→错题同类练习→长教材/容量/安装→OpenMAIC→Hermes。不再让无关旧回归阻塞独立功能交付；每片用必要实例收口，保留安全和教师确认。

## 2026-10-16 上下文整理后的唯一续接卡：DT-05

状态：DOING。智能组卷已移出当前队列；不重开组卷专题。

- [x] 固定 DeepTutor question helper 的本地来源发现、revision 和投影内容校验；`verify:deeptutor-question` 通过。
- [x] 当前 desktop build 通过；education capability baseline `365/365`。
- [x] 当前 Electron `DT-05-questions` 题目来源/read path `6/6`，报告 `education-journey-TRUAZ2/report.json`。
- [ ] `DT-05-review`：教师编辑/确认、拒绝、来源谱系、原子保存、冷恢复。
- [ ] `DT-05-practice`：练习引用、作答结果、错题链接、重启回读和取消/恢复。
- [ ] `DT-05-photo` / `photo-facts` / `photo-cycle`：真实错题图片、OCR/事实确认、相似题 Top10、教师复核。
- [ ] 视觉来源证据：图形/公式/扫描页定位，1366×768 与 1920×1080，失败转教师复核。
- [ ] notebook smoke：仅在需要时解决 Electron 依赖与 Node ESM 打包边界；不能通过绕过生产模块来“修绿”。

执行顺序固定为：review → practice → photo → photo-facts → photo-cycle → 视觉审查 → 更新 Goal 四状态与根四文档。每片必须绑定当前 build SHA、首次失败、renderer errors、截图和 SQLite/file readback；历史报告只能作参考。
