# DT-03 学习评估与复习策略交付合同

## 2026-10-06 DT-05 同源五题与两周训练（当前）

本轮实施前冻结的同源五题与两周训练合同已限定接受。下方冻结内容保留；无计划之外Schema/IPC/Provider迁移。Done：当前照片入口发送完整教师可编辑草稿→唯一Pi实读原错题与学习事实→真实DeepSeek提出5道同源简答变式→教师修订确认5子题→Pi重读最终版本→确认五题练习/5引用→依真实错因制定完整14天→逐题录入实际表现与8/10→重新分析与修订14天→冷恢复不重放。读回为1原题+5子题、1五题练习、5引用、3真实记录（照片原事件/教师事实/本次逐题结果）及2计划版本。原照片与根题不变。 内容验收：逐题算核发现原AI第五题解析错误地用“3.5不比直角边长”排除直接相加，已在实际教师第五题textarea改为3.5²≠平方和；首题改为8/15→17，初始计划第1天和第13天说明亦由原教师控件修正，模型原候选与最终版本同时保留。强schema不保证数学/教学正确；本次未放宽教师确认或推断未来成绩。实际复用原ChatTool/HeroUI Button、题/练习/学习writer与DeepTutor算法，无第二Agent或新事实真源。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。


## 2026-10-06 DT-05 同源五题与两周训练合同（实施前冻结）

上一轮为 progress。已完整重读 Master（2584行，SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302），当前 Phase4/5 DOING；照片事实切片证据为 dt05-photo-facts-20261006/closeout.json，完整 Golden C/F 未接受。保留当前所有脏改、日常旧窗口及待确认任务。

教师可见结果：在当前真实照片事实点击“请小智准备5道练习”，发送可编辑草稿后，唯一 Pi 实读学习证据及照片根题，生成5道简答变式；教师逐题编辑确认，Pi重读最终版本并提交五题练习；教师核对后保存，Pi继续提出依错因/历史/难度制定的14天计划。保存实际逐题结果后，原学习能力重新评估并允许教师修订安排。原照片/根题保持，父子题/练习/结果和计划版本可冷恢复。

复用比较：A EduDev现有 questionReviews/practiceReviews/learningReviews、原题库/练习/学习记录writer及照片事实入口完整接缝，选用Adapter和现有ChatTool；B Pi1.0.2原customTools/Session负责连续调用与等待教师，无新增loop或包；C 固定DeepTutor f07029c Apache2原quiz归一及学习算法继续复用，原AgentLoop不执行；D OpenMAIC本地636fab/上游723005 MIT为后续课堂能力，本链无适合替换事实writer的实现。只读核对DeepTutor本地be170110有5处既有脏改/上游f07029c；OpenMAIC干净。Pi官方extensions、HeroUI官方Button可读；Pro MCP list_components传输失败，复用现有本地ChatTool/HeroUI Button，finesse无可用来源。本轮不加依赖、许可证或Windows打包增量。

变更范围：现有照片事实草稿交接、统一 Golden runner 的新完整场景与必要薄helper、现有组件/领域用例；仅在真实链路暴露缺口时修复对应Provider/Facade/UI。不预设新表/列、IPC或数据迁移。事实仍用当前SQLite/文件；宿主安全/取消/确认/脱敏不放宽。旧入口保留；草稿可回退至既有分步出题，未确认候选不写业务事实。

验收：同一正式Pi/真实DeepSeek/本地OCR照片路径，生成5题的内容单独核对（不以schema正确冒充数学正确）、教师编辑/无效输入零写、原根题不变、5条来源/练习引用、完整14天/错因个性化、实际作答与结果重新分析、冷恢复不重放。采用现有组件/领域runner、build/typecheck、相关smoke、浅暗1366×768/1920×1080逐图验收和git diff --check。测试照片及逐题作答均为明确owned合成教师实例，日常真实教师/无VPN/安装/全模式及整体Goal不因此完成。完整C/F实例通过后继续DT功能缺口及MA/JOIN/Phase6–8。

## 2026-10-06 本轮收尾增补（实施前冻结）

收尾实际代码复核发现新照片事实在传统档案时间线会直接展示JSON；补齐教师可读的知识点、实际作答、标准答案、表现、错因和难度，继续同一原记录writer，不改Schema或事实。正常自由文本保留原显示，损坏的照片结构显示可理解的失败信息，React文本转义；无需新包。新增组件边界和正式档案页真实路径/浅暗双尺寸图，最终构建重验。历史隔离no-provider回归本次再次出现外键失败，保留失败并开启既有只读诊断复验；不据此恢复三元题组业务或宣称根因已修复。


## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

本轮照片事实合同已限定接受：实际OCR/校正→教师显式学习事实→原来源根题与实际事件→Pi真实读取→恢复。新增confirmed_facts_json已在新库与旧副本验证。依次合同的第3项仍未完成：5变式/教师确认练习/14天安排/真实结果再分析。原writer保存一条实际事件，不覆盖图片原记录；原质性掌握门禁不变。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 照片学习事实与来源根题合同（实施前冻结）

Current Phase=4/5 DOING，完整 Goal ACTIVE。上一轮 progress 已复核37份源码/文档/日志哈希；照片前置切片接受，完整 Golden C/F 尚未接受。

教师可见结果：当前照片完成校正后，核对题干/标准答案/解析、科目/知识点/知识类型/难度、学生实际作答、明确表现、错因与发生时间；点击确认后原题库与原学习记录 writer 在同一事务保存，原图片、OCR原文与原学习记录保留。随后进入绑定学生的 Pi 草稿，实际读取原题与学习证据。没有假父题或自动评分。

复用对比：A 当前 createQuestionBankItem/createRecord + 既有照片安全读取/学习算法/确认模式，可直接 Adapter，选用；B DeepTutor mimic_source 原始解析将题目映射至 QuizTemplate，但带解析服务/Pipeline，不适合教师本地事实事务，不迁入第二运行时；继续已固定原格式和学习算法；C Pi 原生 customTools/Session 足够实读续接，扩展包不能代替本地业务事务；D OpenMAIC 为课堂能力，与本事实入口无直接对应。最新只读核验 DeepTutor本地be170110/上游f07029c Apache2，OpenMAIC本地636fab/上游723005 MIT，脏改保留。HeroUI官网Button可读，Pro MCP transport失败，复用现有HeroUI Button和教师表单，不新增依赖；finesse无可用本地来源。

变更范围：shared/mistake-facts.v1，main/students事实Repository及typed IPC，preload，现有学生错题页独立确认组件，既有Pi学习回执必要脱敏字段。mistake_image_analyses增量新增confirmed_facts_json默认空串，记录教师输入、来源/分析版本、request digest、原题引用和学习记录id；保持原SQLite题库/记录数据真源，不新增事实库。重复确认同请求返回原回执，变更输入冲突；照片/校正变化、归档、取消、事务切点失败零新增事实。旧照片无回执可继续人工校正，新根题确认需要实际OCR回执。

完成定义：共享边界、原writer同事务、正式五空间真实操作/本地OCR→事实→Pi真实DeepSeek实读→冷恢复、旧已验副本迁移、双尺寸浅暗视觉、build/typecheck、统一组件/领域与相关旧业务smoke、git diff --check。精确证据保存在test-results/goal/dt05-photo-facts-20261006。照片事实确认只接受其实际范围；随后必须完成5变式/教师确认练习/14天计划/结果再评估的完整Golden C/F，之后MA/JOIN/Phase6–8。不会用本切片替换完整目标。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

冻结合同第一步已限定接受：真实照片→本地 OCR/教师校正→Pi 绑定草稿；增量 local_ocr_json 已在全新数据库、旧数据副本与冷启动验证。第二步教师实际学习事实/来源根题与第三步 5 变式、14 天安排、结果再分析尚未完成。保持现有照片、学习记录、原题/练习 writer 与教师确认规则；不以识别文字冒充错因或成绩。

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 Golden C/F 照片来源合同（实施前冻结）

完整教师结果：学生错题照片 → 本地 OCR → 教师校正并核对实际作答/错因/知识点/难度 → 本地来源原题 → Pi 实读学生历史及原题 → 5 道可追溯练习 → 教师编辑确认 → 个性化十四天安排 → 真实作答与反馈 → 同一 Pi 重新评估。完整场景在全部真实链路通过前保持 DOING。

当前能力与缺口：聊天附件的 RapidOCR 宿主、校正和权限检查已有真实实现；传统学生错题页仅建立 needs_ocr，没有执行识别。原题 writer、Pi 题目/练习核对、DeepTutor 原格式与学习算法、实际结果 writer 均已存在。照片 OCR 校正还没有成为结构化错因/实际结果或可追溯原题，不得把 OCR 确认等同于成绩确认。

依次交付：

1. M03/M07/M08：传统学生错题照片直接复用现有固定 RapidOCR 宿主、Hana 文件读取边界；前端识别/取消/失败/教师校正与冷恢复可操作。已保存校正的必要脱敏文字通过原 student-context 对话入口进入 Pi 草稿，教师再次发送；生产入口不再调用退役的 mistake_triplet runtime。
2. M05/M07/M08/M10：教师核对实际答案、表现、错因、知识点和难度；同一原 SQLite writer/事务保存根题与证据、保留照片与 OCR 来源版本，防重、拒绝/取消零新增事实。不得伪造题库父题。
3. DT-05：唯一 Pi 从成功读取来源出发，原 DeepTutor 能力生成 5 题，教师确认题本及练习；接已实现十四天计划和实际结果链，完成 Golden C/F 真实 DeepSeek 验收。

本次实现切片为第 1 项。共享契约新增 mistake-ocr.v1，main 新增学生 OCR Adapter/API，通过 typed preload 暴露；MistakesWorkspace 复用现有入口和校正 writer。原 mistake_image_analyses 增量添加一个 local_ocr_json 列，默认空串兼容旧记录；保存引擎版本、照片 SHA、文件版本和识别原文，教师校正不覆盖识别原文。不新增 Store、云 OCR、npm/pip 依赖或 Agent loop。现有 Pi 包不能替代教师事实权限；现有 RapidOCR/ONNX Runtime 已锁定 Apache-2.0/MIT，Windows runtime 继续使用现有分发件。

安全/兼容：只接受学生/分析 ID 和版本，拒绝 renderer 路径与字节。当前活跃学生、原 learning_records/attachments 所属关系及 managed 路径、文件 SHA 都需核对；调用固定本地引擎前后核对版本。取消/切换学生/窗口退出释放本地 worker，无迟到保存；教师已校正记录不可被重识别覆盖。OCR 写回和原教师校正 writer 各在同一 BEGIN IMMEDIATE 内核对来源与租约，失败回滚；旧手动校正路径保留。新列幂等迁移，旧数据库副本/全新数据库及冷启动验证。回滚使用旧入口手动校正，新增列可保留，不删除真实资料。

本切片完成定义：当前生产五区导航 → 实际导入合成图片 → 固定本地 OCR → 原文可见/可修改 → 教师确认校正 → SQLite/附件读回 → 冷恢复；重复识别不新增分析，取消、版本变化、外来学生和旧数据失败边界明确；build/typecheck、组件、统一领域、相关 smoke、浅暗双尺寸逐图检查。该切片不声明已完成照片结构化事实、5 题、完整 Golden C/F、完整 Codex 视觉、安装与无 VPN 验收。

比较证据：本地 DeepTutor be170110/远端 f07029c（Apache-2.0）、OpenMAIC 636fab0/远端 7230053（MIT）当前只读核对，原工作树保留。它们的学习/课堂 Runtime 不迁入。Pi 1.0.2 的 native Session/customTools 继续作为唯一编排；官方包目录 https://pi.dev/packages 本轮复核，既有 web-access/usage 接入与 goal-x 待适配不变。HeroUI 官方 Button 文档与既有 AttachmentOcrPanel 对照，Pro MCP 传输失败，使用已有 HeroUI 组件。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

本轮实施前冻结的“练习与训练路径真实结果续接”合同按当前纵向切片限定接受。

Done：已确认练习→当前学生学习计划→逐题实际作答/表现/教师反馈与可选分数→原learning_records writer→同版本来源→唯一Pi/原DeepTutor重新评估→教师修订14天安排→冷启动恢复，当前纵向切片限定接受。实际两题作答为12厘米（错误）与5厘米（正确）、教师分数6/10、整体部分正确；一条起点记录加一条实际训练结果，共2条事实，原2题/2份练习/3条引用不变。计划确认产生版本1与版本2，不把未来安排计作成绩。

复用：practice-result.v1只是现有student-training.v1的可选关联字段；旧输入/digest/记录保持不变。使用原exercise_sets、question_bank_usage、ai_confirmation_items及learning_records，无新增表/列/迁移/依赖/第二编排。确认练习sourceOn与结果writer共用原BEGIN IMMEDIATE；校验活跃学生、确认ledger digest、实际练习快照SHA、计划科目/知识点及完整逐题索引。答案/反馈/分数绑定原防重digest，重复不写、改动冲突、失败回滚；原concept/design质性门禁不放宽。Pi通过原education_analyse_learning收到脱敏实际答案/反馈/可选分数和整体结果，私有学生/练习ID不出现在回执正文，不自动打分或补造结果。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

Failed已修复并留存：初始表单测试选了不存在的practice选项，改用已有homework；续接测试未等新session ID，读取了旧回执，原生新会话实际已有保存证据，现等待新会话；额外克隆检查误要求学习会话包含题目核对，现分支分别验。组件生成脚本的转义正则已修正。功能通过后的截图发现通用input样式放大复选框，复用已有checkbox-label后重建并重新走真实provider/8图。Blocked：无当前功能阻塞。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 练习与训练路径真实结果续接（实施前冻结）

上一轮分类为progress：练习切片9真实/3旧库/145领域/156组件/207smoke与8图、源码/报告/341文件固定SHA本轮只读复核一致。完整Master已读、SHA不变，Goal ACTIVE。教师可见目标：已确认练习→学生学习计划→选择相同知识点的真实练习→填写逐题实际作答/表现/反馈和可选分数→原学习记录writer保存→当前页回看作答与来源→唯一Pi/原DeepTutor评估实际结果→教师核对新安排→冷恢复。

比较与复用：A现有StudentTrainingWorkspace、LearningReviewRepository.recordTrainingResult、learning_records、原学习证据收集/DeepTutor原算法、Pi customTools已最贴合；仅补练习版本关联。B DeepTutor当前f07029c（Apache2）LearningService/attempt/question关联与原grading/mastery能力可参考，但其Store/AgentLoop不迁入，当前固定原算法继续使用。C OpenMAIC当前723005（MIT）课堂quiz/DSL留MA支线，不能为记录结果引另一Runtime。D Pi官方Session/customTools足够，包不能替代本地教师事实writer；无新依赖/包/License体积。HeroUI官方网站可读、Pro MCP transport失败，继续合法现有Button/表单/Modal/来源链；finesse无本地来源。DeepTutor本地五份用户脏文件保留。

纵向变更：共享practice-result.v1及旧student-training.v1可选practice字段→原LearningRepository/同一事务Facade→既有typed IPC/preload→独立练习作答表单组件嵌入现有训练结果页、传统练习的学习计划入口→现有learning-provider仅追加脱敏实际作答摘要。没有新表/迁移/第二结果Store；旧无practice输入/记录/digest不变。确认后的练习快照SHA从主进程返回，模型和renderer不能制造确认；保存时同事务验证所属学生、confirmed ledger digest、实际exercise版本、对应计划科目/知识点、完整逐题索引。题庫以后改正文不改既有练习快照；exercise本身变化拒绝。原结果idempotent digest绑定新增作答/反馈/分数，重复不写、改变冲突。实际结果明确由教师保存，模型不得写成绩；概念/design结果仍不绕过原质性门禁。

原单条training-result语义为一次整体教学表现；关联练习时逐题均教师输入，整体correct/incorrect/partial按明确已保存逐题表现归一，分数仅教师显式填写且校验范围，不从答案/模型推测。不自动打分/造未来结果。字段/字节上限是单IPC保护，非运行预算。旧结果重放不因新字段缺失失败；旧源记录保留。回滚移除可选组件/关联字段，不删除已有记录。

验收：严格输入/未知字段/错学生/版本与科目知识点冲突/未来时间/分数范围/漏题/重复索引/防重/取消与原结果兼容；实际唯一Pi/真实DeepSeek的新记录→评估→教师新计划；原writer与ledger/usage不被结果写入改动、SQLite/文件readback/冷恢复、浅暗双尺寸逐图、build/typecheck/renderer/统一领域/相关smoke/git diff --check。结果保存与source验证共用已有BEGIN IMMEDIATE，不嵌套新连接事务。完整DT-05/Golden C/F、整套学习路径与MA/JOIN/Phase6–8仍按清单继续，不以本切片宣布Master完成。

## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

Done：当前教师录入原题→选定学生→唯一Pi/真实DeepSeek实读原题→原DeepTutor格式能力生成变式→教师编辑5/12题最终答案13厘米→Pi重新实读→可编辑练习核对卡→教师修改顺序/用途/观察与说明→确认→同一SQLite原练习writer/usage→学生传统错题与练习页读回相同版本/父题来源。原3/4题5厘米不变；最终2题、2份练习、3条引用、2确认/1拒绝、0条虚构作答/成绩。空标题失败零写入，重新读取保留编辑；拒绝/停止不保存，停止候选冷恢复可删去一题并确认，重复确认与再次冷启动不重复保存。

practice-review.v1 / education_propose_practice + education_read_practice纵向贯通Repository/Coordinator→production-host/Pi独立持久身份→主frame typedIPC/preload→现有工作台PiPracticeReview与传统PracticeSourceButton。复用ai_confirmation_items(action=pi_practice_candidate)、exercise_sets、question_bank_usage和原saveExerciseSetFromDraft writer，零新增表/列/迁移/依赖/第二编排。候选只接本轮成功实读别名，模型不得指定学生/ID/确认权；题目正文不可偷偷改写，改题先核对题目。确认digest绑定初稿、题目版本/本地父来源、教师最终安排和完整exercise快照；同generation租约、单BEGIN IMMEDIATE、防重/取消/失败回滚。原生身份未知或移除在open前拒绝，压缩只保存状态索引。

Evidence：固定build-c 341文件/SHA 15cba713c2dea8db351973b488c9314909caf31e5ea55d837c525159b0545207，默认out逐文件一致；build/typecheck exit0、统一145/145（education-boundary-wraImL，新增18项）、组件156/156、当前唯一Pi/真实DeepSeek9/9（education-journey-ADH5Jm，3次启动/rendererErrors=0）、旧真实题目核对数据副本3/3（5RLgDA，3题/33→33模型消息，0新增事实）、相关旧业务smoke207/207均当前固定build-c。八张实际Electron浅暗1366×768/1920×1080图逐张查看；核对/拒绝/关闭可达、长内容内部滚动、无横向溢出。完整命令、源码/报告SHA、SQLite读回、失败留存与视觉边界：apps/desktop/test-results/goal/dt05-practice-20261006/closeout.json。领域故障回滚使用真实SQLite测试ports；原writer保存由真实页面证明，不冒称生产OS强杀。

本轮实施前冻结的练习集合合同按当前纵向切片接受。原题与教师最终变式/练习均可追溯；学习路径、真实结果、完整测验模式和Golden C/F继续开放，不能以保存练习宣布掌握或全目标完成。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 学生练习集合纵向合同（实施前冻结）

上一轮有进展：教师核对题目切片10真实/127领域/150组件与四图已接受，当前源码/固定build-c/报告SHA本轮只读复核；完整DT-05不变。下一教师可见结果：选择学生→小智实读原题/已核对变式→提出练习集合→教师修改标题、逐题角色/观察并核对题目→确认→学生传统练习页读取相同版本与父题来源。练习安排不是实际作答或成绩。

复用比较：A现有saveExerciseSetFromDraft/listExerciseSets和question_bank_usage最贴合本地事实，原writer及事务Facade复用；B Pi1.0.2原customTools/同会话等待/持久身份承担唯一编排；C DeepTutor固定原quiz格式与逐题来源规划继续先生成可核对题目，原QuestionPipeline/THINK/Store不迁入；OpenMAIC quiz/scene留下一课堂步骤。上游DeepTutor仍f07029c（Apache2）、OpenMAIC723005（MIT），本地DeepTutor五份用户脏文件保护。HeroUI官方Pro可读，继续现有授权ChatTool/来源链/Button/Modal/表单；finesse无本地来源。无匹配本地教师确认事实的Pi新包，不额外安装重复框架。

变更：新practice-review.v1共享契约、education Repository/Coordinator/typed主frameIPC→preload→独立核对卡及学生练习来源视图；Pi新增独立持久身份，production-host只接注册/事件/租约。候选只接受本轮成功实读别名，学生由当前会话宿主决定，模型不能指定ID/保存状态/成绩。所有题目正文、答案、解析、版本由真实题库读取，教师若改题先通过既有题目核对流程。标题、说明、题目角色和观察允许教师编辑。

存储/兼容：复用同一ai_confirmation_items（action pi_practice_candidate）、exercise_sets、question_bank_usage，零新增表/列/迁移。候选保存题目完整本地快照/事实SHA和可核来源父题；确认result保存教师最终稿、exercise ID/完整快照及digest（绑定初稿与题目版本）。单BEGIN IMMEDIATE中执行原练习writer及usage与确认ledger，失败/停止全部回滚。旧练习/旧题目核对/旧native身份不改，未标记会话兼容，未知/移除新身份在open之前拒绝；旧练习无新谱系标签仍正常可读。禁止删除日常事实；测试只用owned空库/旧库副本。

验收：严格输入与主frame、错学生/归档/未实读/来源变化、教师编辑最终稿、防重、拒绝、停止/事务切点回滚、旧库副本/新库/冷恢复、原生未知身份字节不变；build/typecheck、renderer、统一领域、相关smoke；当前唯一Pi/真实DeepSeek→教师核对→传统学生页→SQLite/usage/本地谱系读回与浅暗双尺寸逐图查看。资源上限只保护单IPC，不是运行预算。实际学习结果/路径续接和完整DT-05/Golden C/F后续继续，不能以练习保存宣布全Goal完成。回滚关闭新工具/UI，新身份历史在能力缺失时安全拒绝；不删旧事实。

## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

Done：当前教师实际录入原题→唯一Pi实读来源→原DeepTutor格式函数归一→可编辑核对卡→教师确认→同一SQLite题本保存。教师最终5/12题答案13厘米、恢复后的8/15题答案17厘米；原3/4题5厘米不变，最终3题/2确认/1拒绝。空答案失败不写事实，重新读取保留编辑，拒绝/停止无新题，停止后的候选冷恢复可确认，重放不重复保存。模型收到教师最终标题并重新实读最终题，而不是继续使用初稿。

question-review.v1 / education_propose_questions纵向贯通Repository/Coordinator→production-host/Pi身份→主frame typedIPC/preload→独立PiQuestionReview。复用现有ai_confirmation_items（action=pi_question_candidate）与question_bank_items writer，无新增Schema/表/依赖/第二事实库或编排循环。原始父题完整快照和事实SHA只留本地；确认digest绑定初稿SHA、父来源、教师最终稿及子题ID/版本。同generation租约、单SQLite事务、拒绝/停止/幂等保护确认权。receipt只给脱敏最终发现元数据，答案/解析按既有授权读取。最多8题是单IPC资源保护，不是运行预算。

Evidence：固定341文件/SHA e80b3052e86609b0156b7f91f735b534b9ba47c92d04a9cd83b81abdb0190ab2；原源码verify/build/typecheck exit0、统一127/127、当前组件150/150、当前唯一Pi/真实DeepSeek教师核对10/10（education-journey-R7dHLl），3次启动、rendererErrors=0。浅暗1366×768/1920×1080四图实际逐张查看：确认/拒绝与输入可达，窄窗题目字段在内部滚动区，无横向溢出。相关历史回归207/207是在build-a、最终元数据/摘要绑定/重试修复之前，不能当成最终构建全部回归。精确命令、SHA、版本、失败留存、SQLite读回与视觉范围：apps/desktop/test-results/goal/dt05-review-20261006/closeout.json。

本轮实施前冻结的教师出题核对合同按题目切片接受；后续exercise_sets/usage、传统练习、学习路径与完整DT-05合同仍开放，不把本次ledger谱系当完整跨入口谱系功能。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对纵向合同（实施前冻结）

目标：当前唯一 Pi 从本轮实际读取的题库来源起草变式题，调用原 DeepTutor quiz 格式函数；教师在当前聊天核对卡编辑题干、答案、解析、科目、年级、知识点、难度，确认后在同一 SQLite 原子保存题目及来源谱系。拒绝、停止、来源变化、错会话和陈旧提交不得写题库。此切片不关闭完整测验、练习集合和学习路径任务。

复用顺序已核：现有题库 Facade、learning-review 确认账本/事务/控件和 Pi customTools；已固定的原 DeepTutor 格式 Worker；OpenMAIC 课堂仍后续；HeroUI 已授权 ChatTool/Button/来源组件和现有主题。Pi SDK 官方文档当前仍提供单一 Session/customTools/原生取消及压缩；不迁入第三方 AgentLoop、模型重试循环、第二 Store 或预算。

谱系增量兼容合同：沿用 ai_confirmation_items 的 action_type 文本和版本化 payload_json/result_json，不新增题库列或迁移真实题目。新 action=pi_question_candidate；payload v1 固定会话/实际 run/call、父题 ID、事实 SHA 和完整原题快照、原候选；result v1 固定教师最终候选、新题 IDs/事实 SHA、确认行绑定 digest。父子谱系属于同一账本的不可变版本记录，不以自由 tags/sourceTitle 当权威。旧无此 action 的数据库与题目保持可读；全新库与旧库副本同一代码运行；确认事务复用 createQuestionBankItem，失败全部回滚。后续练习集合/跨入口谱系读取另按合同接入，不能声称这次已实现。

变更边界：shared question-review.v1 → education Repository/Coordinator → db 小型事务 Facade → production-host/native 身份预开验证 → 主 frame typed IPC/preload → 独立 PiQuestionReview，沿用当前工作台。候选来源只接受本轮成功实读回调生成的别名/版本；模型不得指定原 ID、学生、确认状态、保存 ID。教师不能替换父来源或题型，允许修正全部教育正文。最多八题为一次 IPC 资源保护，非运行预算；类型仍支持上游六种。原格式 valid 不保证答案正确；教师明确核对后才保存。

验收：实际 Pi/DeepSeek/当前教师入口起草→编辑→确认→题本读回，拒绝无事实、来源失配、同请求防重、取消/事务中断回滚、旧库/新库、冷恢复；格式原函数、权限/schema/前后租约、原生身份拒绝字节不变；build/typecheck、renderer、统一领域、相关旧回归、浅暗双尺寸真实截图逐张查看，git diff --check。固定源码/构建 SHA 和真实报告写 existing closeout。回滚可移除新能力与 UI，新身份历史在能力缺失时安全拒绝；不删除既有题目或历史。完整 Goal 保持 ACTIVE。

## 2026-10-06 DT-05 原测验格式能力复用（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05第2项DOING，完整Goal ACTIVE。上一轮为真实进展，其题库来源接缝6/99/146/8/207和4图报告本轮只读复核，未冒称重跑。

上述候选生成复用冻结合同的格式Worker部分已实施并验证；完整教师可编辑候选与后续确认仍按合同继续，未以格式Adapter收口第2项。

Evidence：npm run verify:deeptutor-question exit0；build/typecheck0、统一108/108（Q99ECJ，含9项新增原函数/真实进程/坏源码/取消等，与既有教育/SQLite/IPC/Pi回归）、renderer146/146。固定341文件/SHA fdda34a0a700f51827110cc796dd6992ce6f40fbcf0f758991665b380fec5f3c，out一致。精确源码/许可证/AST检查/命令/报告/边界：apps/desktop/test-results/goal/dt05-quiz-20261006/closeout.json。未改UI，renderer字节与上一轮build-a完全一致；本轮未执行新候选真实provider/页面/图审，也不以旧207回归代替新功能验收。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 候选生成复用合同（实施前冻结）

上一轮是真实进展：dt05-question-20261006/closeout复核固定337文件、6真实/99边界/146组件/8Pi/207历史与4图；DT-05第1项接受，第2–5项继续，不缩小完整Master目标。当前主任务为题目/练习候选→教师编辑确认→同库保存谱系→传统练习/路径→实际结果。

本轮先接候选必须的原DeepTutor quiz解析、归一与issues校验能力：从当前上游f07029c Git对象原样保存pipeline.py/Apache许可证；AST仅提取QuestionType、三个quiz常量及_parse_quiz_payload/_normalize_quiz_payload/_collect_quiz_issues的原函数体。零依赖Python stdlib单次处理，不导入原Pipeline或THINK/AgentLoop/Session/Store/Provider，不复制其循环。现有Pi1.0.2 customTools/会话/确认账本继续；当前OmniEdu题库/练习facade保持。OpenMAIC当前上游723005 MIT的scene/quiz适配后续，不引Next/Auth。HeroUI官方Pro网站已复核而MCP gateway transport仍失败，已有授权核对组件可复用；finesse未安装。选择原源码抽取而非TypeScript重写或完整上游运行时；只新增必要EduDev严格schema/Worker adapter。

修改范围：shared question-draft.v1协议、fixed question-worker.py/question-host.ts、已有worker-host固定白名单和打包source-assets、原education边界runner与独立领域cases、原NOTICE来源清单。单题归一支持choice/concept/fill_in_blank/short_answer/written/coding完整上游类型，固定题型由宿主计划传入，模型不得改类型。完整题干、答案、解析和A–D校验；未知字段/非字符串/重复键/丢失选项与选项键碰撞拒绝，issues明确返回，不能默默制造正确答案。协议只返回候选，不授予teacherConfirmed/已保存/数学正确性。字段/字节上限为IPC资源保护，不是运行预算；无截断答案、无新模型调用、DB迁移或事实写入。

验收：固定源码/manifest SHA/AST白名单、实际原Python进程、类型/选项/填空/缺字段/恶意额外字段/取消/缺Python/坏manifest、打包资产逐字匹配、类型构建、现有组件与领域回归；此adapter通过只说明候选格式能力真实可用，第2项完整Pi→可编辑候选与后续确认仍须当前生产UI/真实DeepSeek/双尺寸浅暗/重启和相关回归。下一继续既有确认ledger的question领域增量兼容合同后纵向接Pi，不注册无教师编辑入口的写事实工具。Worker回滚去掉固定白名单与新增asset，旧题库/会话不改；测试只用owned目录。

## 2026-10-06 DT-05 真实题库来源接缝（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05 DOING，第1项真实题库来源接缝限定接受；完整Goal ACTIVE。

冻结DT-05合同仅第1项接受，实施前冻结文本与后续2–5项保留。

question-context.v1复用searchQuestionBank/getQuestionNotebookEntry，两个Pi只读工具education_search_questions/education_read_question。每run主进程发现别名+题目事实SHA；答案/解析按需脱敏完整读取，超长拒绝、异步后重新核版本/租约。SHA不含收藏/分类覆盖层；模型不获原ID/私人字段/假确认。questions:context-source主frame→typed preload→HeroUI来源Modal只在本地展示全文。原生question-context身份在持久SessionManager.open前验证，未知版本/移除能力拒绝且JSONL字节不变；旧未标记兼容。无新Schema/依赖/Store/Loop。

固定337文件/SHA 674fc8daf1620bfcba385a31f4fe12da9d8326c1993314d292367c494e9134d3；build/typecheck0、统一99/99（pvBYRJ）、renderer146/146、Pi协议8/8（CKxuuD）、当前唯一Pi/真实DeepSeek题库6/6（yTcdQR）、相关历史回归207/207。rendererErrors=0；浅暗1366×768/1920×1080共4张来源页图实际逐张查看，中文题干/答案/解析与关闭控件可达，无横向溢出，仅接受本来源对话框，不接受完整Codex像素/原生动态。精确命令/源码SHA/构建/报告/失败留存：apps/desktop/test-results/goal/dt05-question-20261006/closeout.json。

下一唯一教育任务：DT-05第2项，固定DeepTutor纯测验归一与协议Adapter→唯一Pi可编辑题目/练习候选；第3项同一确认账本教师编辑/确认/原子题库和练习保存及父子谱系（先冻结增量兼容迁移合同）；第4项传统练习/路径/实际结果；第5项完整DT-05与Golden C/F，再MA-01至05→JOIN→Phase6/7/8。完整DeepTutor、OpenMAIC课堂、日常人工、完整Codex/Golden/安装/无VPN仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 题目、练习与学习路径合同（实施前冻结）

模块 M04/M05/M07/M10，Phase4 DT-05；完整目标仍为真实资料/学生证据→唯一Pi→可编辑题目与答案解析→教师确认→原题库/练习/学习路径→实际作答→核对→冷恢复。DT-04证据gsPCmm14项与closeout已只读核验；本轮先实现题库真实来源接缝，不能用只读接缝关闭完整DT-05或Golden C/F。

复用顺序与结论：现有OmniEduStore.searchQuestionBank/getQuestionNotebookEntry/question_bank_items/question_bank_usage/exercise_sets保留；查询启发式score不作为正确性/教师确认。Pi1.0.2 ToolDefinition与SessionManager预开身份校验可直接接工具。DeepTutor本地be170（5份用户脏文件保持），远端main仍f07029c/v1.6.13 Apache2；question/capability、pipeline、zh/pipeline提示要求先探索来源再规划逐题，但其中QuestionPipeline循环、原THINK协议和Session/Store不迁入生产；纯题型/题面归一与模板协议后续采用固定源码提取适配，保持许可证。OpenMAIC本地636fab/上游723005 MIT，quiz/scene validation用于下一课堂适配，不为当前题库引入Next/Auth/Store。Pi官方目录已核；web/usage限定生产、goal-x staged，不新增重复出题插件。HeroUI官方Pro网站可读、MCP transport失败，继续现有授权ChatSources/ChatTool/HeroUI Button与Modal，semantic theme与两尺寸；finesse未安装。自己只写EduDev权限/版本/脱敏Adapter，检索和存储复用现有Facade，不新造搜索引擎。

依次执行：
1. 真实题库检索/读取：必要query+科目/知识点过滤；本轮宿主生成别名，只能读取本轮实际发现题目；正文版本SHA覆盖题目事实，不拿收藏覆盖版本代替。检索只返回脱敏题干摘要，答案/解析按需读取；错误/空/超长/取消/陈旧可见。工具来源能在当前聊天打开真实本地题干/答案/解析；新会话身份预开验证，旧无身份兼容。
2. Pi使用当前来源+学生实际薄弱点提出题目与练习；固定schema、题型/答案完整校验，DeepTutor纯归一能力适配；模型不能伪造来源、学生、教师确认或直接写事实。
3. 同一ai_confirmation_items候选账本，教师编辑题干/答案/解析/难度，确认事务原子保存question_bank_items、来源父子谱系、exercise_sets与usage；拒绝/取消无生效事实，幂等重放/并发/来源改变拒绝。当前题库无完整父子/version字段：先冻结增量兼容迁移合同，旧数据副本与新库验证；不提前当谱系已完成。
4. 新版教学内容/学生传统入口使用同一数据；练习与学习路径可打开、继续、结果重新分析；读书/讲义与可靠检索覆盖后续DT-05任务，不以Markdown回复替代产物。
5. 每步build/typecheck、现有统一领域/SQLite/IPC门禁、renderer、当前唯一Pi真实DeepSeek Golden、浅暗1366/1920逐图验收、相关回归与冷恢复后才逐步接受；完整DT-05全合同与Golden C/F另收口。

本轮改动边界：新增shared question-context.v1、main只读question Provider/API、typed preload、既有source组件/生产Pi注册及预开identity；扩展既有education边界与Golden runner，不新增数据库表、外部上传策略、依赖、第二Agent/Store。模型只接当前必要脱敏题面，不含学生原图/私人字段/整库。点击本地来源不自动上云。保留原题库管理入口，回滚为移除当前新注册与UI；身份存在的历史在能力移除时须安全拒绝，不重写JSONL。旧版本引用变化须重新检索，不能显示未验的新内容为原证据。

完成定义：第1项全部纵向证据成立只能称DT-05真实题库接缝接受，第2–5项仍DOING/OPEN。保持完整Master Goal ACTIVE，随后MA-01..05→JOIN→Phase6..8。

## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

DT-04训练计划与实际结果领域按冻结合同限定收口：学生→学习计划读取原已确认账本，来源/历史/空/失败反馈；中文表单保存一次实际部分正确表现；原1条记录保持，最终2条，不把首日7项算7次作答。继续按钮创建教师选定学生对话与可编辑草稿，不自动发送；原DeepTutor分析→教师核对新结果→Pi重排十四天→教师首日改2→同库version6，模型实读及冷恢复一致，旧version4实际结果保留。取消/未来时间/重复防重/错学生空视图/旧路径入口均已实测。

固定337文件/SHA 41e083651dd0e72e308a2bf9ed1b26715128909db0ca506574bd768d012a62c3；build/typecheck exit0、统一89/89（JC5UXh）、renderer142/142、当前唯一Pi/真实DeepSeek学生计划14/14（gsPCmm）、rendererErrors=0。12张浅暗1366×768/1920×1080截图逐张查看：计划、结果表单、重新规划后实际结果，控件可滚动到达且无横向溢出。历史回归207/207在build-a通过，发生于逐条证据目录/参数修正提示补充前，仅作相关旧教育回归。完整命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-workspace-20261005/closeout.json。

冻结的学生计划/实际结果纵向合同按限定门禁接受；来源、数据库/文件读回、IPC与可操作新版UI、失败/取消/冷恢复都有证据。后两项工具反馈修复保持原严格来源与唯一Pi，统一边界补充后89项通过。前一轮算法/评估/计划报告未冒称本轮全重跑；完整Golden F与所有DeepTutor模式不随此关闭。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 DT-04 学生计划与实际结果续接（实施前冻结）

本轮 M07/M08/M10，上一轮是有效进展而非等待：真实计划9项、81边界/137组件/207历史回归及12图已有报告。Master全文复核SHA dbc1619f；Phase4/5，最早未接受是学生学习计划入口和实际训练结果续接，完整Goal ACTIVE。

复用调查：图谱缺少新领域符号，窄范围实时源码确认 product-spaces 学习计划仍指向 MasteryPathWorkspace 的旧路径；保留旧路径折叠入口，生产改为同一已确认训练策略视图。现有 LearningReviewRepository/BEGIN IMMEDIATE/ai_confirmation_items、createRecord/FTS/学生目录、Pi绑定对话/原工具以及PiTrainingPlan/Pro EmptyState可直接复用。Pi提供编排不是学生事实库；DeepTutor原算法及LearningStore均已核，本地be170有5处用户脏改、上游f070不变（Apache2）；OpenMAIC本地636fab/上游723005不变（MIT），课堂SDK不承担学生计划账本。官方HeroUI页面可读而组件文档不可用、MCP传输失败，复用当前授权EmptyState/Buttons及已迁移训练组件；finesse目录未找到，不阻塞已有设计。官方Pi SDK和上游来源已读，无新增依赖、Schema、Store、运行预算或Loop。

纵向范围：strict student-training.v1读/来源/结果DTO→existing learning repository 的教师显式学生授权查询及确认计划约束→单主窗口main-frame IPC/typed preload→独立StudentTrainingWorkspace（App仅入口替换）→同一learning_records实际结果与现有FTS/目录→原Pi分析/教师核对继续。模型没有新写事实工具。结果录入中文表单，只能选保存计划实际知识点和非休息日；宿主决定标题、科目、来源、知识类型，不信任renderer JSON。发生时间必须真实合法且非未来；教师主动保存一次整体学习表现，不把训练量当答题次数。概念/迁移结果仍遵循既有教师质性核对，不凭正文布尔值获得确认。

结果请求UUID绑定本次学生/计划/版本/日/内容；同库事务保证重复请求仅一条实际结果、冲突拒绝、原记录不改。结果使计划来源变旧，界面诚实标历史；教师仍以历史安排记录须主动确认，已被另一个训练计划取代则拒绝陈旧写入。来源打开检查当前版本与计划真实目录，不依赖旧归档会话授权。保存失败可重试同一请求，取消/换学生不晚到覆盖其他学生视图。

兼容：无SQLite迁移，旧无plan仍真实空训练视图，可展开既有路径；host-only createRecord身份参数不向renderer开放，默认旧调用行为不变。失败事务保留原事实，测试只用owned验收副本，不注入日常库，不删除旧入口。功能回滚撤掉新导航/API，保存实际记录仍是旧记录表可读，不删除用户数据。

门禁：既有统一边界补未知/越权/伪造来源/未来时间/重复冲突/同库回滚/归档/旧v1；组件状态与现有Golden runner扩展真实当前Pi+DeepSeek：计划页读回→来源→取消→真实表单保存→原练习增加一次→陈旧提示→重新分析/教师核对→计划调整/冷恢复。浅暗两尺寸实际截图检查表单/保存控件；build/typecheck、renderer、领域/IPC、相关smoke与git diff --check。完整DT-04/Golden F只有完整场景符合时才能接受，DT-05/MA/后续Goal不随子集完成。

### 本轮真实红灯修复（仍待最终验收）

固定build-a的education-journey-4PejgC已通过9项实际操作，但真实模型对新结果核对选中了旧记录。未批准错误来源。原因是原学习分析只回传汇总与证据别名，不含逐条发生时间、结果和宿主核对状态，不能可靠定位最新事件。本轮在同一只读工具中补sourceEvidence目录（最多20条，与原sources一致），提供时间/结果/宿主确认及训练结果必要观察；观察先经现有脱敏再截断600字，不回传原ID/digest或整段JSON。使用当前快照和最终授权检查，不变v1持久身份/算法/原始记录。统一边界新增实际provider隐私与对应关系检验。build-b用官方electron-vite的outDir构建，避免覆盖正在回归使用的out。

2026-10-06 午夜续接：0kMRZS实际11项通过后，恢复检查因聊天与传统计划页复用training-day-1造成测试strict定位失败，已限制到student-training-workspace，不改产品组件。egyCoi实际10项后模型计划第13天rest却带pointReference=知识点1，严格边界正确拒绝，但原generic反馈导致模型ask_teacher让教师处理技术参数；现同一工具invalid_input返回未提交审核与明确schema修正说明（rest必须null/0），不松来源、不新增重试Loop。边界验证没有候选/事实写入且反馈可自修。失败报告全保留，最终实例待下文收口。

## 2026-10-05 DT-04 切片验收结果（上一轮）

Goal ACTIVE，Phase4/5 DOING。DT-03学习评估/复习策略领域按既有七项合同限定收口：原GwcHvH11、1DXgrz10、pvhhdt6、d2XYcU76报告本轮只读复核，结合当前81边界与旧v1档案恢复；不冒称全部实例本轮重跑。DT-04整体DOING，十四天提议/编辑/确认/恢复核心切片已接受。

真实学生证据→原DeepTutor算法→唯一Pi/真实DeepSeek十四天提议→既有新版核对卡教师改日期、知识点、数量、难度及说明→同一SQLite确认事务→模型重新实读最终版本→来源跳转/拒绝/冷恢复。教师首日改为7、十四天version4，同轮及冷恢复模型读到相同内容，原练习仍1条；空证据拒绝。训练策略不是生成题目、未来成绩或已完成练习。

training-plan.v1作为原learning-review strategy v1可选嵌套字段，旧无plan兼容；原工具名称/native marker/同库ledger/digest/版本/取消租约/typed IPC保持。宿主解析本轮知识点别名固定真实目录，提议与确认检查快照及版本，教师不得造来源或删除计划转普通策略；过期计划只读历史。无新依赖、DB表、Store、Loop或第二学生页。latest plan重新实读并声明sourceCurrent/strategyCurrent/teacherConfirmed/completedPractice=false。

固定337文件/SHA 8af8cd343bcc97c858f266eafcabc7ad57fe3fc32aefc4c662860b1e00dd186b；build/typecheck0、统一81/81、renderer137/137、当前唯一Pi/真实DeepSeek训练9/9（education-journey-2yywL7）、相关历史回归207/207。rendererErrors=0。浅暗1366×768/1920×1080共12图逐张查看，分别定位训练字段与核对页尾，窄窗正常滚动可达、无横向溢出；不接受完整Codex像素/原生动态。精确命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-training-20261005/closeout.json。

下一先贯通既有学生“学习计划”入口读取同一已确认计划及陈旧/空/失败状态，再补教师友好的结构化实际学习结果录入与重新分析/继续训练，不开第二事实库、不把安排当完成；然后DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8。完整Golden F、DeepTutor全模式、OpenMAIC互动课、日常人工、像素/动态、安装/无VPN与既有audit5项仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 DT-04 两周训练切片（实施前冻结）

目标为 M07/M08/M10：选定学生实读学习证据→原 DeepTutor mastery/scheduler 推导→Pi 提出十四天训练策略→教师调整日期、每日知识点、练习量、难度与说明→同库原子确认→重新实读及冷恢复。训练安排是建议，不是未来成绩或已完成练习。

复用调查：当前没有可用的训练计划领域实现（图谱与限定源码检索均无）；Pi 1.0.2 已提供工具等待、取消、原生会话；原 DeepTutor f07029c 的 scheduler/review_sort_key 已在当前 worker 执行，保留其真实风险与到期结果，不模拟未来正确答案；OpenMAIC 属课堂能力不承担学生计划真源；已安装 Pi web/usage/goal-x 不提供教师训练策略；沿用当前 HeroUI Pro ChatTool、核对表单与历史，不新增组件库。Pro 官方页面/MCP本轮访问失败，使用项目已迁移授权组件及现有样式。无新增依赖、Schema、Store或Agent Loop。

范围：新增版本化 training-plan.v1 共享契约，作为既有 strategy draft 的可选嵌套字段，旧 assessment/strategy 字段、原 native marker与工具名称不变；模型只传本轮知识点别名，宿主将其解析为本地真实知识点，并固定完整来源目录。Repository 在提议与确认两处检查快照、策略版本和来源目录；教师不能伪造知识点或删除计划变成普通策略。复用 ai_confirmation_items 的原 action/结果 digest/递增版本/事务租约与 strict IPC/preload。读取最新计划必须再次核查来源当前性，过期计划只作为历史而不能宣称当前有效。

UI：既有问小智核对卡编辑十四天安排；确认结果和跨会话历史显示教师最终内容。原记录及练习次数保持。无证据拒绝创建计划并提供中文说明。只从 owned 真实用户路径创建验收资料，不能向日常库注入内容。

兼容/恢复：旧 v1 draft 无 plan 仍可读取；新增嵌套 schema 严格拒绝未知字段/访问器/错误日期/重复或缺失天数/非来源知识点。确认后重启从 SQLite 恢复，不重放模型或旧审批；拒绝、停止、陈旧及并发冲突不产生计划效果。回滚保留已保存 ledger，不删除数据，旧代码不允许消费无法识别的新计划。

门禁：在既有统一 education boundary 与 Golden runner 扩展，验证严格边界、教师编辑、来源约束、拒绝/取消/版本冲突/原子回滚、旧记录兼容；build/typecheck、renderer、相关 smoke；当前唯一 Pi+真实 DeepSeek→页面编辑确认/拒绝→SQLite readback→实际重新读取→冷恢复；浅暗1366×768/1920×1080图审；git diff --check。DT-04未通过完整门禁前 DOING，Golden F 与完整 Goal 仍 ACTIVE。

DT-03 收口核对：7项合同已分别具备 evidence。实际教师核对及恢复/事务崩溃 GwcHvH 11，跨会话历史 1DXgrz 10，原生身份及严格协议 d2XYcU 76，宿主停止并发 pvhhdt 6；四组当前图审与 build/typecheck/renderer133/相关历史回归207有原始报告。此处是已有证据只读复核，不冒称本轮全部重跑；接受 DT-03 学习评估/策略领域，完整 DeepTutor、所有模式及 Golden F 不随之接受。

## 2026-10-05 当前包切片与取消门禁

本轮并发合同已按限定门禁接受：startup command/session错误及idle ABA/终末await问题先红复现，76统一边界与当前真实Stop/rollback/新确认/并发幂等冲突/冷恢复6通过，4图查看。整体DT-03按下方完整合同收口后进入DT-04；此节不冒称两周训练已完成。


## 2026-10-05 本轮：生产确认与停止并发合同（实施前冻结）

目标：DT-03/M08/M10，教师停止任务后，尚未提交的学习核对不能晚到保存；重新主动确认仍可用。同一学生当前会话启动新任务时，旧请求不得因任务又结束而重新取得写权限。当前真实缺口：starting以commandId索引，而learning coordinator用sessionId查询；idle确认的owner仅以active空值判断，存在开始/结束后的ABA；repository最后异步读回之后缺少提交前租约检查。

复用：沿用production-host现有starting/active、Pi abort/waitForIdle与learning coordinator；沿用现有确认账本及BEGIN IMMEDIATE原子事务，不新增Agent Loop/Store。Pi官方SDK取消负责模型生命周期，EduDev宿主负责教师写入授权；DeepTutor学习文件Store与OpenMAIC课程库不承担本地教师确认租约。此次不变页面组件，复用已有Pro核对卡和统一领域/Golden验收runner，无新增依赖或Schema。

范围：production-host记录启动项会话身份及学习决定世代，stop与新启动使已有请求永久失效；repository最终读回后复核租约；现有education边界/Golden runner扩展并发实例，正式IPC仅在unpackaged隔离验收目录安装受控写后暂停接缝。兼容：确认内容、版本、来源及原记录保持；已提交结果不因后续停止撤销；相同命令重放不产生第二运行，其他会话不受影响；重启后旧候选仅通过新的教师动作确认。回滚代码不删除账本或资料。

门禁：先复现当前启动/停止租约错误，再验证启动等待、开始结束ABA、停止未提交、独立会话、重新明确确认、重复/冲突决定、最终读回取消；build/typecheck、renderer、统一边界、正式当前Pi+DeepSeek页面停止与SQLite回滚/恢复、必要主流程smoke、git diff --check。合成并发不替代真实功能；完整DT-03仅在整体清单复核后接受，随后进入DT-04两周训练真实功能。完整Goal保持ACTIVE。

## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：实际融合程度逐项对齐官方清单，见CAPABILITY_MATRIX/EDUCATION_BRANCH_TODOLIST最新功能表；既有检索/引文/学生上下文/算法/教师核对与历史已融合，完整测验、学习路径、两周训练、视频及互动课未完成。本轮修复恢复旧会话时先写入后校验的问题：全部学生/学习/核对范围和工具先验证，复用Pi公开解析及内存SessionManager迁移后才持久打开；未知分支/版本、错学生、移除或错工具拒绝且JSONL字节不变，未绑定普通聊天保持空范围。无需新依赖/Schema/Store/循环。

Evidence：固定337文件/SHA 806bfe0dfc046374c13ef86434ca16e55193c09621a2b76582b7e5cea6b30df4，build/typecheck exit0、renderer133/133、统一边界64/64（新增7项原生身份）、本轮真实DeepSeek教师核对/冷恢复/事务退出回滚11/11、历史回归207/207。正式4次隔离Pi启动、rendererErrors=0；4张当前浅暗双尺寸图实际查看，1366暗图确认按钮需卡内滚动，本轮不接受完整Codex动态/像素效果。完整命令/报告/SHA：apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/closeout.json。

Doing/Next：生产宿主并发取消/确认门禁→完整DT-03逐条接受→DT-04两周训练（真实证据→教师修订确认→本地计划→冷恢复）→DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8；Phase3UX欠项保持OPEN，不转回模拟样例或只做底层测试。

Failed：前置测试脚本转义/重复导入已修，最终上述门禁无失败；旧失败报告保留。Blocked：无当前外部阻塞。

Runtime：npm start exit0，默认out与固定构建一致；单个日常main PID60468创建于2026-10-05T21:07:20.5459380+08:00并加载默认out/main/index.js，未读取或注入日常事实；日常DOM/人工、安装/无VPN与完整Golden仍未验。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

以下保留历史，当前状态以上述记录为准。


## 2026-10-05 当前轮：DeepTutor功能对齐及学习能力恢复门禁（实施前冻结）

用户要求定位实际融合程度并继续Goal。本轮已复核官方README、upstream main=f07029cfcf2c8dfccdb671cdfc343db8334f5741、生产sessionConfiguration与既有真实实例报告。DT-01检索/引文、DT-02学生上下文及DT-03算法/教师核对/跨会话确认历史已有实际融合；两周训练、题目/测验/学习路径、完整沉浸阅读和互动课程尚未完成。普通聊天不具备学生绑定，教师入口为新版学生档案→问小智；不能把旧legacy回归或上游README当当前新版能力。

教师结果与顺序：恢复学习对话时保持原学生、来源与教师确认历史；错误配置不得污染历史。完成DT-03恢复和生产取消门禁后进入DT-04：真实学习证据→两周训练建议→教师修订确认→本地计划→重启继续；再DT-05题目/测验/学习路径，随后MA与JOIN。不新增模式菜单来冒充功能，不迁入第二循环。

当前具体缺口：createPiXiaozhiSession在最后校验learning-review前已追加学生/学习等身份；SDK SessionManager.open还会先迁移旧JSONL并重写。错误学生、工具、未知版本或移除能力因此可能在拒绝前修改原生历史。

复用比较：EduDev已有独立身份marker及既有验收runner；Pi 1.0.2公开parseSessionEntries、SessionManager.inMemory和open负责原生解析/迁移，采用内存预检后才持久打开；官方npm最新为1.0.3，本切片不混入未验SDK升级。Hana现有会话/去重接缝保持；DeepTutor LearningStore不承担教师账本；OpenMAIC课程库不承担学生绑定。无需新组件、依赖、Schema或Store。新增的薄身份校验器是EduDev授权边界，解析/迁移仍复用Pi。官方对比：https://pi.dev/docs/latest/sdk 、https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest 。

范围：main/xiaozhi-agent教育身份校验器及pi-session前置调用；现有education统一边界runner添加原生恢复场景；Goal状态与稳定CURRENT更新。IPC/UI/学生FACT/模型凭据不变。先验证所有选项及原生全部分支，再允许modelHistory.authorize或追加marker；未绑定普通会话的空studentId仍合法且不获得学生权限。

兼容/恢复：原marker字段、顺序及提示保持；只读旧会话可增量启用核对能力；恢复第二次不重复追加；未知版本、错范围、移除能力拒绝且字节不变。旧SDK版本迁移先在不落盘SessionManager验证；空/非法header拒绝而不由SDK初始化重写。没有数据库迁移。回滚代码保留原文件及确认记录。

完成门禁：真实SDK身份恢复/旧版本迁移/所有分支/拒绝无副作用；统一领域边界、build/typecheck、renderer、现有正式Electron真实DeepSeek教师核对与冷恢复、必要相关回归、git diff --check。合成身份测试不代替真实功能验收。完整DT-03、Golden F与Goal在门禁齐全前保持DOING；本轮不宣称DeepTutor全量模式或已完成DT-04。

## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：同一新版问小智资料侧栏可读取当前学生跨会话的已确认历史，展开实际教师最终结果、编辑前宿主候选、前一确认版本及保留率差异。主进程固定当前学生；确认/写入仍局限原候选会话。分页真实7版本→首屏5→较早2；其他学生为真实空历史。原记录被教师从新版页面编辑后，历史仍可读且标记需重核，链接只打开实读当前版本。无新Schema/Store/依赖/模型工具/第二Loop。

Doing：完整DT-03尚未接受，学习核对历史是其中一个已验证子集。Next：新learning-review native身份兼容/未知版本/移除/错误工具与无副作用拒绝→生产宿主并发取消→完整DT-03逐条接受→DT-04/05→MA-01至05→JOIN→Phase6/7/8；Phase3旧欠项继续OPEN，完整Goal ACTIVE。

Failed：本轮最终10项实例无失败；GlaZHd的前置8项保留，作为较早构建证据。既有yzQ60K/2jRs1N/QvtXBi/0382P4失败不覆盖。Blocked：无当前外部阻塞。

Evidence：固定337文件/SHA 7d5299a4beea1317bc791a7da1e02081253b6ab1f2b588a1f2ea269180217a5b；build/typecheck exit0、统一领域边界57/57、renderer133/133、正式唯一Pi真实DeepSeek历史10/10、相关历史回归207/207。两次正常冷启动；4张浅暗1366×768/1920×1080图逐张实际查看，均为当前新五空间。207历史legacy画面仅作回归，不作新版UI证据。 实例 apps/desktop/test-results/education-journey-1DXgrz/report.json，边界 apps/desktop/test-results/education-boundary-FQ7cOz/report.json，精确命令与source/artifact hash见 apps/desktop/test-results/goal/phase4-learning-20261005/history-closeout.json。

Runtime：npm start exit0；默认out与固定验收副本逐字匹配。日常单个main PID16260创建于2026-10-05T20:24:41.59548+08:00，未读取或注入日常事实；日常DOM/人工未验，静态截图不接受原生动态或完整Codex体感。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/系统网络/VPN或第三方工作树。安装、无VPN及完整Golden仍未验。

以下保留历史，当前状态以上述记录为准。

日期：2026-10-05。Master全文已恢复，当前Phase4/5能力支线；上一轮新版页面识别8项及23文件/329构建指纹复核为有效进展。完整Goal ACTIVE。本任务服务M07/M08/M10及Golden F前置，不替代DT-04两周训练或OpenMAIC。

## 复用与对比

|候选|当前事实|决定|
|---|---|---|
|EduDev|已有mastery-policy/snapshot/review-scheduler/learning-analytics与确认队列；旧快照最多200记录、旧周期不含保留率、类型优先排序|保留历史策略，复用领域边界和单一事实库；新快照严格显式证据并与v1差异回放|
|Pi|1.0.2唯一生产编排、ToolDefinition、取消、会话恢复、审批和工具生命周期已存在|能力注册到同一个Pi；不引入教育AgentLoop或CLI|
|DeepTutor|只读ls-remote核上游f07029cfcf2c8dfccdb671cdfc343db8334f5741，v1.6.13，Apache-2.0；本地be170有5份既有脏改动|逐字固定mastery/scheduler/grading/models源码与LICENSE；执行原算法，协议及数据DTO在Adapter中，不修改vendor|
|ts-fsrs|官方TypeScript间隔复习实现，成熟候选；需要独立评分映射、参数及数据验证|保留候选，不在缺少校准资料时冒称FSRS效果。DeepTutor当前是指数保留率基线，不能称经校准FSRS|
|OpenMAIC|本地636fab，当前上游7230053af019b89c83d22dcab0a94f38fe193856；课堂内容能力，不负责学生FACT与评估真源|本轮无迁移；MA开始前重做版本差异审计|
|HeroUI|Pro MCP目录/docs当前传输失败；现有HeroUI组件、AppLayout与项目Sheet/工作卡可复用|公开官方文档核API，按既有授权本地源适配；不造组件库或第二学生页|

图谱已fast更新，仍存在遗漏/历史片段；符号调用链用于定位，行号不符处使用窄范围实时源码补证。官方来源：[DeepTutor固定scheduler](https://github.com/HKUDS/DeepTutor/blob/f07029cfcf2c8dfccdb671cdfc343db8334f5741/deeptutor/learning/scheduler.py)、[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)。

## 教师可见结果与完整链路

1. 已绑定学生的Pi读取真实显式练习/评估，报告证据范围、未知/无效/作废事实；不能从自由文本分数推导正确率，空档案不能判完成。
2. 原算法按真实发生时间回放掌握度、保留率、遗忘风险与到期顺序，显示版本、旧策略差异和可追溯来源。短间隔重复练习不无限延后原截止时间；质性掌握必须有教师评估。
3. 模型可起草评分/错因校正或复习策略；输出版本化strict schema，建议不是FACT。启发式评分与粗粒度错因必须标明需要教师核对。
4. 教师在同一新版工作台核对、编辑、确认或拒绝。批准写本地有版本策略/评估注释，原学习记录不覆盖；拒绝不产生评估/策略。确认+结果写入同一SQLite事务，双击/并发、取消/退出、陈旧来源、重启需有真实证据。
5. main/Repository→typed preload/IPC→可操作UI→SQLite/文件readback→冷恢复齐全后才接受DT-03；不能只接受算法然后关闭该任务。

## 实现边界

### 本轮跨会话核对历史合同（2026-10-05）

教师结果：在既有新版问小智资料侧栏展开学习核对历史，查看同一学生所有会话的已确认校正/策略、教师编辑前后及上一有效版本差异。分页可继续读取，不把首屏数量冒称全部。原记录变化/缺失保留历史并标明重核；已有学生页与五空间保持用户确认图为基准。

复用决策：Pi会话历史不是学生事实库；DeepTutor的按book文件LearningStore不是教师确认账本；OpenMAIC课程版本不承担学生校正。本轮扩展已有LearningReviewRepository与ai_confirmation_items，同一事务一致读、同一main-frame授权、typed preload及授权Pro ChatSources/Disclosure和HeroUI按钮；无新依赖/Schema/Store/循环。Pro MCP仍传输失败，现有授权源码可用；官方HeroUI v3组件API已核。

修改范围：shared学习历史strict DTO；repository只读分页与来源状态/差异投影；coordinator、既有IPC/preload/production-host；独立PiLearningHistory组件接现有侧栏；既有统一边界与Golden runner。输入仅当前会话和版本游标，不接收学生ID、路径或SQL。主进程从活跃会话固定学生；可读其他历史会话的已确认版本，但跨会话确认/修改仍禁止。历史完整反馈只在本地教师UI，不进入模型快照/压缩。

旧数据/恢复：同一确认ledger，无迁移或事实重写。原来源被改/删除时仍可看保存的教师校正，不能伪造旧原文或当前有效掌握；查看当前记录使用实读版本与现有来源路由。回滚撤下历史UI/API即可，历史与原记录保留。测试只复制owned验收档案，不动日常数据或第三方工作树。

本轮门禁：严格游标/越权/篡改、同学生跨会话/异学生隔离、分页及版本差异、归档来源会话只读、当前会话/学生失效拒绝、来源变化/缺失标识；构建、renderer组件、统一领域边界、Golden实际当前新版UI与真实provider、SQLite读回及冷恢复、浅暗双尺寸图审、git diff --check。完整DT-03仍DOING，native身份与生产宿主并发取消另外待验，完整Goal ACTIVE。

当前验收结果：最终固定337文件/SHA ee4872bd4f5e66c8ddee8906fc7da5a766d47168f23721fc6fbdb50de9400c67，正式唯一Pi真实DeepSeek教师核对、确认后同轮再读、拒绝、策略版本、正常冷恢复与实际事务强制退出回滚11/11（education-journey-GwcHvH）；统一边界51/51、renderer133/133、相关历史回归207/207、build/typecheck与git diff --check通过。四张当前浅暗双尺寸图已逐张查看；第一轮最终回复已按教师真实“错误/仍缺必要前提”归纳，不再把模型初始正确建议说成保存结果。默认out逐字匹配，npm start已打开当前单个日常main PID66716；日常DOM/人工未验。完整DT-03保持DOING，下一补跨会话版本历史、新native身份与宿主并发取消门禁；完整Goal ACTIVE。精确命令、来源与文件hash见 apps/desktop/test-results/goal/phase4-learning-20261005/teacher-review-closeout.json。

真实回复语义复核新增修复合同：QvtXBi 的事务/UI 10项和207回归通过，但模型在第一轮仍复述初始“正确”提议，而宿主原评分已将核对卡候选改为“错误”。修复范围限学习工具回执、既有Pi说明及统一边界/实例脚本；返回待教师编辑前实际候选的必要结果与是否经过本地评分，明确不是最终结果。教师确认后必须重新实读再回复，不自动写入或回传未脱敏的教师编辑正文。重新固定构建并验收实际首轮回复、当前来源/练习计数与恢复；旧构建证据保留，完整DT-03/Goal不提前完成。

2026-10-05 确认写入实现细化：校正注释直接保存为同一确认行的版本化 result_json，而不新增 learning_records 注释行。确认行ID就是结果身份，digest绑定学生、来源ID/原版本、教师最终内容与递增版本；这样原事实、事件时间和练习计数都不变，避免对注释表面的teacherConfirmed或ID文本给予权限。主进程固定学生会话，模型只使用本轮实读的学习证据别名；读取到提议、提议到确认分别验证事实与策略版本。旧generic确认入口排除pi_student_learning_change。无新Schema或Store。

复用落地：唯一Pi工具生命周期/原Hana执行去重 + 现有ai_confirmation_items + 独立同库BEGIN IMMEDIATE事务Facade + Pro ChatTool.Approval/OfficeComposerState + 原DeepTutor stdlib评分/复习Worker。内联可编辑核对卡保留当前工作台；不需要另一个Sheet/学生页面。正式UI仅中文证据字段，原结构化技术标记不直接呈现。已核本地源码与最新upstream：DeepTutor f070/OpenMAIC 723仍相同，无修改第三方工作树。Pro MCP本轮仍gateway传输错误，采用已有授权组件。

验收严格区分：首次yzQ60K真实8项通过，但原记录JSON视觉呈现不满足产品语言，不能作为最终新版图审；2jRs1N通过9项包括真实事务kill回滚，但重启时只kill启动PID遗留子实例占隔离profile，整体失败。复用既有Windows taskkill/PID/T/F模式清理仅本次owned验收进程树后复跑；不得清空配置或把失败报告覆盖为成功。最后固定构建337文件/SHA d10189cab89755158e22e5b7b895046b6be5898ee0cad3597c87ae80ce17df92。完整DT-03仍需核对所有门禁与跨会话历史/新native身份边界，不凭单个绿色报告提前关闭。

- 固定原Python算法运行一次性stdlib Worker；models的必要枚举/DTO字段机械AST投影为dataclass，记录投影与model_copy映射；不加载Pydantic全Store/Agent，不声称完整原Pydantic模型迁移。无新增npm/pip依赖，源码/License/字段与算法一致性可核。
- 抽取现有reading Worker宿主共用超时/取消/环境白名单/并发/输入输出上限，原reading协议兼容；工具边界不是运行预算。
- 学生快照来自students/learning_records同一语句，不受UI分页或旧200条上限静默截断；必要安全上限明确报错。规范化知识点ID包含科目与名称，避免跨科合并；有效时间不得回退Date.now。
- 保留omni.mastery.policy.v1和原记录；新版本包括固定源revision、snapshot fingerprint、explicit/unknown counts、推导时间及教师策略版本。证据版本变化必须重新读取。
- 复用ai_confirmation_items保存候选/历史，不引第二Store；独立领域action与严格主窗口IPC阻止旧确认入口消费新payload。独立同库事务连接避免异步操作混入另一事务。
- 学生范围固定main会话绑定，模型不能提供姓名/学生ID/SQL/文件路径；外部仅必要匿名字段，继承现有强脱敏。确认校正保留原来源、版本、教师编辑和结果，无自动改原FACT、权限或凭据。
- 五空间及用户指定学生页布局不变；审批组件与学生学习概览作为上下文功能进入，不新增一级概念。公开反馈中文且不展示私有思维。

## 兼容、恢复及完成门禁

无新数据库Schema，旧确认/会话/学习事实与v1策略保持；新增独立Pi能力marker检查版本，旧JSONL不重写。回滚撤除新Provider/UI与API并保留候选及评估历史，不删除事实。停止时工具取消、未确认候选可恢复核对，但旧run不得自动重放。新评估注释必须有来源及教师确认，任何未知旧字段不能补成确认事实。

门禁：机械源码与DTO核验；原复习边界回放/空与未知/跨科同名/超过200条/作废/短间隔/时序/保留率/旧状态/严格参数；SQLite确认/拒绝/并发/陈旧/崩溃原子性；正常build/typecheck、renderer组件及相关领域回归；正式Pi真实DeepSeek工具→教师编辑→本地确认→下一次分析→冷恢复；浅暗1366×768/1920×1080实际图审；git diff --check。

只扩展已有education capability-boundary和golden-teacher-journeys，不为每项追加独立smoke。所有夹具在owned test-results，禁止向日常库插入模拟内容。失败证据保留，完成台账记录精确命令/构建/报告/未验证边界。DT-03全部门禁未过保持DOING，完整Goal不完成。

## 本轮只读基础与下一实施接缝（不缩小DT-03）

本轮已接原学习算法、严格全记录快照、匿名Pi只读工具、同显式证据v1回放及既有学生来源。grade_answer/classify_error仅在本地协议验证，不冒称已开放可纠正评分。默认retention=0.9是推导参数，尚未成为教师可编辑策略。真实实例人工复核必须比自动assert更严格：记录自填确认、覆盖子集和条件错误风险都已实际暴露过误读。

下一步依次落地，不切换第二聊天/学生页或新数据真源：

1. **共享提议契约**：main冻结学生、来源记录ID/原版本、快照fingerprint及上次策略版本；模型只用本次实读别名提出评分/错因校正或复习参数候选。严格schema拒绝未知字段、任意学生、路径、SQL或客户端确认状态。原分析marker保持v1，提议能力另加独立版本身份，不能把旧JSONL原地改为新tool列表。
2. **同库候选**：复用ai_confirmation_items，领域action使用独立pi_student_learning_change，不让旧generic confirmation入口消费。Candidate是建议，不是FACT；Pi同一工具等待教师处理，可取消，不增加循环/会话或持久Store。
3. **原子确认与 provenance**：独立同库连接BEGIN IMMEDIATE，检查学生活跃/固定会话、来源和策略版本、候选pending条件。确认状态、教师修改、结果、校正注释或策略版本在一个事务提交。评估校正只追加有版本注释；源记录原文不覆盖，不把校正注释当新增练习重复计数。最新有效校正替换同一来源在回放中的解释，原来源时间保持；确认时间另存。拒绝只记录拒绝，无校正/策略效果。
4. **可信确认校验**：注释中的teacherConfirmed或confirmationId也不能凭文本相信。需核对同库确认状态、固定学生/来源版本、结果记录ID与结果内容摘要；教师后续编辑注释或原来源后失配的记录不能沿用确认。重复校正需递增版本并保留历史，旧来源变更时明确提示重核。
5. **typed IPC/preload/现有工作台表单**：strict mainFrame授权、校验及中文安全失败；复用现有Sheet/审批/表单组件，显示原证据和建议，教师可改结果、错因、说明及复习参数后确认/拒绝。不在App.tsx/db.ts继续堆领域逻辑。原读取上限/失败不是运行预算。
6. **状态/差异回放**：宿主读取确认后的策略与校正，原算法在相同显式事实上按版本回放；retention变更不产生新练习，保留来源和确认版本。compaction/cold restore后仍按SQLite重新校验，未确认候选恢复为待核对，旧run不自动执行。
7. **完整验收**：已有统一边界与Golden runner扩展真实DeepSeek→教师编辑→确认及拒绝→SQLite读回→下一次分析→冷恢复；来源改变、双击/并发、事务中退出及取消没有重复事实或半写。原历史回归与浅暗双尺寸实际图审完成后才接受DT-03，再进入DT-04/05和MA。

上述为待实施合同，不能作为已经完成的代码证据。

组件接缝已核：现有PiCopyApproval复用HeroUI Pro ChatTool.Approval和OfficeComposerState提交锁/中文失败，pi-control-surfaces.css已有浅暗变量；评分字段编辑应组合既有表单/Sheet，不复制第二审批系统。Pro MCP本轮两次gateway传输失败，官方[HeroUI v3 Modal文档](https://heroui.com/en/docs/react/components/modal)已核compound API，不能用v2 ModalContent/useDisclosure写法。进入UI实现时仍须读取复用组件与实际CSS/依赖；此项只完成调查，没有把确认表单写成已交付。
