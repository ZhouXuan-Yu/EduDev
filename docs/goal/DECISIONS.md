# Goal 决策记录

## 2026-10-06 DT-05 同源五题与两周训练（当前）

决策：现有教育工具/审核/writer已支持完整链，生产仅增强原照片入口草稿，测试复用原Golden runner/OCR/facts/practice/plan路径。未新增数据库迁移、IPC、Agent runtime或包。原AI内容错误走教师修正，保留原稿与最终稿，不通过隐式改SQLite伪造模型正确性。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。



## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

选用当前原writer+Adapter，不迁入DeepTutor mimic_source解析服务/Pipeline，也不引入新Agent。Pi仍唯一生产loop，原DeepTutor学习算法继续复用。事实IPC独立于OCR执行器，但共用原宿主任务/取消权限。SQLite单列回执保持旧数据库兼容；实际事件新增一条而非覆盖原图片记录。修复原关键词查询来源标题漏检，没有第二套检索。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

决定：不新增 Agent loop、OCR 框架或学习事实库；从既有附件服务提取可复用安全读取器，原固定 OCR 宿主识别，既有 SQLite writer 保存。教师校正仅向 Pi 交付脱敏文字草稿，实际成绩/错因必须另行确认。单列增量迁移保留旧数据；旧入口待完整新路径验收后再删除。

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

复用：practice-result.v1只是现有student-training.v1的可选关联字段；旧输入/digest/记录保持不变。使用原exercise_sets、question_bank_usage、ai_confirmation_items及learning_records，无新增表/列/迁移/依赖/第二编排。确认练习sourceOn与结果writer共用原BEGIN IMMEDIATE；校验活跃学生、确认ledger digest、实际练习快照SHA、计划科目/知识点及完整逐题索引。答案/反馈/分数绑定原防重digest，重复不写、改动冲突、失败回滚；原concept/design质性门禁不放宽。Pi通过原education_analyse_learning收到脱敏实际答案/反馈/可选分数和整体结果，私有学生/练习ID不出现在回执正文，不自动打分或补造结果。

保持可选字段和原writer：Pi插件可以复用联网/MCP/目标能力，不能代替宿主的教师事实与版本校验。旧作答缺少practice字段仍可读；结果不修改题目或确认后的练习快照。sourceOn使用调用者连接，避免新连接嵌套BEGIN造成锁等待。未新增逐轮运行预算；单IPC字段/字节边界只是输入保护。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 Pi 插件目录与安装复核

继续已有三包精确版本，不引入旧 SDK 副本或第二目标/任务状态库。第三方MCP不兼容时选 Pi 原生；后台包待兼容版本。候选列表和理由见集成目录。

详见 [Pi包清单](../integrations/PI_PACKAGES.md)。本轮证据：apps/desktop/test-results/goal/pi-packages-review-20261006/closeout.json；既有audit 5项（2 moderate/3 high）仍为发布待处理项。当前教育阶段4/5与完整Goal ACTIVE保持。

## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

practice-review.v1 / education_propose_practice + education_read_practice纵向贯通Repository/Coordinator→production-host/Pi独立持久身份→主frame typedIPC/preload→现有工作台PiPracticeReview与传统PracticeSourceButton。复用ai_confirmation_items(action=pi_practice_candidate)、exercise_sets、question_bank_usage和原saveExerciseSetFromDraft writer，零新增表/列/迁移/依赖/第二编排。候选只接本轮成功实读别名，模型不得指定学生/ID/确认权；题目正文不可偷偷改写，改题先核对题目。确认digest绑定初稿、题目版本/本地父来源、教师最终安排和完整exercise快照；同generation租约、单BEGIN IMMEDIATE、防重/取消/失败回滚。原生身份未知或移除在open前拒绝，压缩只保存状态索引。

以当前active session绑定/实际run-session归属授权，兼容现有Pi run空学生字段；显式冲突拒绝。练习事实依旧通过原writer与usage、ledger同事务落库，没有第二事实源。旧练习无需新marker仍可读；原生独立能力marker验证保持。

Pi包状态保持：pi-web-access0.36.0与@narumitw/pi-usage0.62.0限定生产，pi-goal-x0.32.3安装STAGED，MCP/background候选peer不匹配Pi1.x未force；原生MCP配置、目标Adapter和后台任务仍后续。此教师确认业务复用既有SQLite与Pi customTools，不另装重复框架。DeepTutor当前f07029c（Apache2）固定原quiz格式函数继续通过题目核对使用；OpenMAIC723005（MIT）课堂仍后续。无新依赖/许可证/打包体积增量。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

question-review.v1 / education_propose_questions纵向贯通Repository/Coordinator→production-host/Pi身份→主frame typedIPC/preload→独立PiQuestionReview。复用现有ai_confirmation_items（action=pi_question_candidate）与question_bank_items writer，无新增Schema/表/依赖/第二事实库或编排循环。原始父题完整快照和事实SHA只留本地；确认digest绑定初稿SHA、父来源、教师最终稿及子题ID/版本。同generation租约、单SQLite事务、拒绝/停止/幂等保护确认权。receipt只给脱敏最终发现元数据，答案/解析按既有授权读取。最多8题是单IPC资源保护，不是运行预算。

采用原DeepTutor固定AST格式函数、现有题库writer和确认ledger的Adapter，不创建exercise新事实或整体迁移字段。该谱系本地账本方案先解决当前题目确认；下一练习集合/跨入口读取必须先冻结兼容合同，不以此宣布完整谱系领域完成。

包状态保持：pi-web-access0.36.0原关键词定位与@narumitw/pi-usage0.62.0原DeepSeek余额查询限定生产；pi-goal-x0.32.3已安装STAGED，现有SQLite目标Adapter后续。MCP/background候选peer不匹配Pi1.x，不force/不引第二SDK；原生MCP配置与后台任务仍后续。当前DT-05不再安装重复出题框架，复用原DeepTutor2文件104953字节/Apache2固定AST纯函数。安装≠桌面已启用。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 原测验格式能力复用（当前）

Done：DeepTutor固定f07029c/v1.6.13的pipeline.py和Apache许可证原样保存（104,953字节）；AST仅投影QuestionType、三个常量和三个原quiz解析/归一/issues函数体及原decorator，运行原imports/AgentLoop/THINK/Store/Provider均未迁入。question-draft.v1→question-host→既有固定白名单Worker协议→真实原Python→严格输出复核与打包已验证。

格式Adapter是分阶段候选流程的内部能力，当前未注册生产Pi工具/未新增写事实或UI；模型主编排仍唯一Pi1.0.2。宿主固定题型，choice/concept/fill_in_blank/short_answer/written/coding；严格字段/类型/重复键与选项碰撞防止误归一，完整答案/解析超长拒绝而不截断，issues保留。valid只表示格式完整，不证明数学正确/教师确认/保存；来源和学生授权由下一同账本Coordinator决定。零新npm/pip依赖、DB表/迁移/第二Store。

上游question main f07029c、OpenMAIC main723005本轮只读复核，无第三方checkout变更。Pi SDK官方customTools/会话为下一生产接入，HeroUI官方Pro可读而MCP transport失败；现有核对组件复用。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 真实题库来源接缝（当前）

question-context.v1复用searchQuestionBank/getQuestionNotebookEntry，两个Pi只读工具education_search_questions/education_read_question。每run主进程发现别名+题目事实SHA；答案/解析按需脱敏完整读取，超长拒绝、异步后重新核版本/租约。SHA不含收藏/分类覆盖层；模型不获原ID/私人字段/假确认。questions:context-source主frame→typed preload→HeroUI来源Modal只在本地展示全文。原生question-context身份在持久SessionManager.open前验证，未知版本/移除能力拒绝且JSONL字节不变；旧未标记兼容。无新Schema/依赖/Store/Loop。

Pi包继续锁定web-access0.36.0关键词定位与@narumitw/pi-usage0.62.0余额限定生产；goal-x0.32.3 STAGED，原生MCP/SQLite目标适配后续，不兼容MCP/background不强装。本轮再次核官方目录，无额外适合本题库权威接缝的包，现有Facade与Pi原工具复用；不把包安装当教育闭环完成。详见docs/integrations/PI_PACKAGES.md。

保留DeepTutor question/capability的研究→规划→出题领域顺序；不迁QuestionPipeline AgentLoop/THINK/Session/Store。纯归一代码下一步按固定Git源码/许可证提取，当前未冒称已迁入。

下一唯一教育任务：DT-05第2项，固定DeepTutor纯测验归一与协议Adapter→唯一Pi可编辑题目/练习候选；第3项同一确认账本教师编辑/确认/原子题库和练习保存及父子谱系（先冻结增量兼容迁移合同）；第4项传统练习/路径/实际结果；第5项完整DT-05与Golden C/F，再MA-01至05→JOIN→Phase6/7/8。完整DeepTutor、OpenMAIC课堂、日常人工、完整Codex/Golden/安装/无VPN仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

student-training.v1主frame三接口经typed preload接同一LearningReviewRepository；计划仍ai_confirmation_items、结果仍learning_records，复用createRecord/FTS/本地目录与BEGIN IMMEDIATE，无新表/依赖/Store/Loop。宿主从确认计划解析知识点/科目/标题，renderer不能指定事实来源；UUID绑定内容防重且手工改后重放冲突。陈旧计划记录需教师主动确认，被新计划替代拒绝写入；质性结果不自动获得教师核对资格。旧无plan与旧路径保留。

真实红灯发现模型把较早证据当新结果：同一只读分析增加最多20条sourceEvidence（发生时间/结果/宿主核对状态，训练观察先脱敏再截断600字），与当前来源别名一致，不传原ID/digest。另发现rest却带知识点时原generic错误使模型向教师问技术参数：仍严格拒绝，工具返回未提交核对与rest=null/count=0等自修说明，不放宽来源或新建重试Loop。

复用现有Pro EmptyState、PiTrainingPlan及HeroUI Buttons/主题，不新增学生页事实库或并列导航。Pi负责编排，DeepTutor仅计算，教师主动保存实际结果。源日期与源核对状态属于最小教育上下文；原JSON/内部ID/计划digest无需上云。旧路径挂折叠兼容入口，验收通过后仍保留用户已确认历史。

Pi包继续复用已锁版本：pi-web-access0.36.0关键词定位与@narumitw/pi-usage0.62.0余额限定生产，pi-goal-x0.32.3已安装STAGED；不兼容的MCP/background未强装。CLI全局安装不构成桌面已启用证据；原生MCP/目标SQLite适配分别后续，详见docs/integrations/PI_PACKAGES.md。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 DT-04 复用与数据决定

training-plan.v1作为原learning-review strategy v1可选嵌套字段，旧无plan兼容；原工具名称/native marker/同库ledger/digest/版本/取消租约/typed IPC保持。宿主解析本轮知识点别名固定真实目录，提议与确认检查快照及版本，教师不得造来源或删除计划转普通策略；过期计划只读历史。无新依赖、DB表、Store、Loop或第二学生页。latest plan重新实读并声明sourceCurrent/strategyCurrent/teacherConfirmed/completedPractice=false。

继续执行原DeepTutor f07029c/v1.6.13算法；不引第二LearningStore。复用现有Pro ChatTool、学习历史与来源链接，官方资源不可用走已授权组件，无新UI库。下一先贯通既有学生“学习计划”入口读取同一已确认计划及陈旧/空/失败状态，再补教师友好的结构化实际学习结果录入与重新分析/继续训练，不开第二事实库、不把安排当完成；然后DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8。完整Golden F、DeepTutor全模式、OpenMAIC互动课、日常人工、像素/动态、安装/无VPN与既有audit5项仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 包生态复用决定

用户授权安装所需Pi包。采用精确项目npm安装，不修改全局PiCLI配置；web/usage直接编译审计过的原源码叶能力，goal-x安装但先保留SQLite唯一目标账本。旧命名MCP扩展及peer不含1.0的MCP-adapter/background不force安装；原生registerMcpServer优先。保留唯一Pi1.0.2、教师授权和脱敏，不引第二Loop/Store，不设预算。包清单与许可证/体积/Windows影响见integrations/PI_PACKAGES.md。


## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：实际融合程度逐项对齐官方清单，见CAPABILITY_MATRIX/EDUCATION_BRANCH_TODOLIST最新功能表；既有检索/引文/学生上下文/算法/教师核对与历史已融合，完整测验、学习路径、两周训练、视频及互动课未完成。本轮修复恢复旧会话时先写入后校验的问题：全部学生/学习/核对范围和工具先验证，复用Pi公开解析及内存SessionManager迁移后才持久打开；未知分支/版本、错学生、移除或错工具拒绝且JSONL字节不变，未绑定普通聊天保持空范围。无需新依赖/Schema/Store/循环。

Evidence：固定337文件/SHA 806bfe0dfc046374c13ef86434ca16e55193c09621a2b76582b7e5cea6b30df4，build/typecheck exit0、renderer133/133、统一边界64/64（新增7项原生身份）、本轮真实DeepSeek教师核对/冷恢复/事务退出回滚11/11、历史回归207/207。正式4次隔离Pi启动、rendererErrors=0；4张当前浅暗双尺寸图实际查看，1366暗图确认按钮需卡内滚动，本轮不接受完整Codex动态/像素效果。完整命令/报告/SHA：apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/closeout.json。

Doing/Next：生产宿主并发取消/确认门禁→完整DT-03逐条接受→DT-04两周训练（真实证据→教师修订确认→本地计划→冷恢复）→DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8；Phase3UX欠项保持OPEN，不转回模拟样例或只做底层测试。

Failed：前置测试脚本转义/重复导入已修，最终上述门禁无失败；旧失败报告保留。Blocked：无当前外部阻塞。

Runtime：npm start exit0，默认out与固定构建一致；单个日常main PID60468创建于2026-10-05T21:07:20.5459380+08:00并加载默认out/main/index.js，未读取或注入日常事实；日常DOM/人工、安装/无VPN与完整Golden仍未验。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

以下保留历史，当前状态以上述记录为准。


## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：同一新版问小智资料侧栏可读取当前学生跨会话的已确认历史，展开实际教师最终结果、编辑前宿主候选、前一确认版本及保留率差异。主进程固定当前学生；确认/写入仍局限原候选会话。分页真实7版本→首屏5→较早2；其他学生为真实空历史。原记录被教师从新版页面编辑后，历史仍可读且标记需重核，链接只打开实读当前版本。无新Schema/Store/依赖/模型工具/第二Loop。

Doing：完整DT-03尚未接受，学习核对历史是其中一个已验证子集。Next：新learning-review native身份兼容/未知版本/移除/错误工具与无副作用拒绝→生产宿主并发取消→完整DT-03逐条接受→DT-04/05→MA-01至05→JOIN→Phase6/7/8；Phase3旧欠项继续OPEN，完整Goal ACTIVE。

Failed：本轮最终10项实例无失败；GlaZHd的前置8项保留，作为较早构建证据。既有yzQ60K/2jRs1N/QvtXBi/0382P4失败不覆盖。Blocked：无当前外部阻塞。

Evidence：固定337文件/SHA 7d5299a4beea1317bc791a7da1e02081253b6ab1f2b588a1f2ea269180217a5b；build/typecheck exit0、统一领域边界57/57、renderer133/133、正式唯一Pi真实DeepSeek历史10/10、相关历史回归207/207。两次正常冷启动；4张浅暗1366×768/1920×1080图逐张实际查看，均为当前新五空间。207历史legacy画面仅作回归，不作新版UI证据。 实例 apps/desktop/test-results/education-journey-1DXgrz/report.json，边界 apps/desktop/test-results/education-boundary-FQ7cOz/report.json，精确命令与source/artifact hash见 apps/desktop/test-results/goal/phase4-learning-20261005/history-closeout.json。

Runtime：npm start exit0；默认out与固定验收副本逐字匹配。日常单个main PID16260创建于2026-10-05T20:24:41.59548+08:00，未读取或注入日常事实；日常DOM/人工未验，静态截图不接受原生动态或完整Codex体感。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/系统网络/VPN或第三方工作树。安装、无VPN及完整Golden仍未验。

以下保留历史，当前状态以上述记录为准。

## 2026-10-05 DT-03 教师核对与策略事务（已验证子集，完整任务仍进行中）

Current Phase：Phase4/5 DOING；完整 Goal ACTIVE。Current Task：DT-03；保持用户确认的新版五空间/学生目录/四块档案/生命周期/证据时间线。

Done：唯一Pi实读证据→原本地评分建议→同新版工作台教师编辑/确认/拒绝→同一SQLite确认行原子保存校正/复习策略→确认后本轮重新分析最终结果→冷恢复与真实事务强制退出回滚，已在隔离真实DeepSeek实例验证11/11。原学习记录、发生时间与练习计数保持；拒绝不产生效果。build/typecheck exit0、统一边界51/51、renderer133/133、相关历史回归207/207；浅暗1366×768/1920×1080四图实际查看。

Doing：完整DT-03仍DOING，未将单链通过作为个性化辅导或完整Codex体验完成。跨会话版本历史可视化、新核对native身份兼容/移除/错误版本及宿主并发取消仍需正式门禁。Phase3既有欠项、DT-04/05、MA-01至05、JOIN、Phase6–8继续OPEN。

Failed：保留yzQ60K原JSON视觉失败、2jRs1N只kill启动PID的重启失败；QvtXBi虽然10项通过，人工发现初始提议与宿主评分候选的公开表述不一致，已修实际候选回执并要求确认后本轮实读。0382P4在强制退出后直接读未由宿主恢复的WAL报I/O，改为正常生产冷启动恢复后只读核对，无删库/手改数据。上述报告不覆盖或冒称完整通过。

Blocked：无当前外部阻塞。Next：依次补跨会话版本历史→核对native身份门禁→宿主并发取消→完整DT-03逐条接受→DT-04/05→MA-01至05→JOIN→Phase6/7/8；维持Master完整目标。

Evidence：apps/desktop/test-results/education-journey-GwcHvH/report.json；apps/desktop/test-results/education-boundary-7mjrS3/report.json；apps/desktop/test-results/goal/phase4-learning-20261005/teacher-review-closeout.json与teacher-review-semantic-*.log。固定构建337文件/SHA ee4872bd4f5e66c8ddee8906fc7da5a766d47168f23721fc6fbdb50de9400c67，默认out与验收副本逐字相同。旧legacy截图只作回归，不作为新版图审。日常窗口人工、安装/无VPN与完整Golden仍未验。

Runtime：npm start exit0；当前单个日常main PID66716加载默认out/main/index.js，重建后SHA与固定验收副本仍相同。未读取/注入日常事实；日常DOM/人工未验。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/系统网络/日常事实；无新依赖/Schema。


## 2026-10-05 DT-03 原学习算法与真实证据（进行中）

REUSE固定原Python学习算法+必要DTO字段机械AST投影；共享既有reading宿主，无Pydantic/第二Agent或Store。ADAPT strict显式记录和可信确认，保留v1策略。模型语义审查不通过的实例不得计教育完成。OpenMAIC本地636fab、当前上游7230053af019b89c83d22dcab0a94f38fe193856；进入MA前重新审计，不继续称636最新版。

以下保留原历史。


## 2026-10-05 用户确认新版学生页：识别与实例复核

用户最新学生截图为正式基准，保持现有布局；只扩展已有daily-entry runner做真实学生/时间线/冷恢复校验，不造第二学生页或加入示例数据。完整合同与下一项不变，见docs/design/CURRENT.md。

以下既有记录保留原历史范围。

## 2026-10-05 DT-02 学生上下文与新版页面（最新）

KEEP唯一Pi/SQLite与用户确认新版学生布局。ADAPT固定会话绑定+strict IPC/mainFrame+一致Repository/脱敏+独立native能力；DeepTutor f070 learning/identity.py只参考身份域，不能作为学生授权，不引LearningStore/runtime。只读来源投影复用既有资料/网页模式，面板复用HeroUI Button及现有记录中文标签，无新依赖。仅DT-02的保存事实读取限定接受；实际鼠标交互/英文过程/深色归档欠项保留Phase3，策略DT-03下一项。

以下既有记录保留历史范围，当前状态以上述记录为准。


## 2026-10-05 DT-02入口修复与新版页面统一

保留用户指定新版现有布局，旧图来自历史回归而非产品需另造页。正式UI证据统一入口加runtime/shell/rail断言；日常当前构建通过npm start的单实例版本切换，未删除历史兼容事实。保存ID由现有App返回，不新造学生存储。下一通过新绑定对话读取必要学习事实，不从教师档案显示名推导模型选人。


## 2026-10-05 DT-01b 正文搜索与来源定位

决定：延续原DeepTutor阅读代码与Pi唯一循环，一次一致SQLite正文快照保持原版全局匹配优先级；不把UI目录分页限制当搜索范围。只允许宿主真实来源建立导航，不接受模型伪造resource/offset。独立search marker保留quote身份与旧历史。无新依赖/Schema；全套学生反馈故障跟随DT-02核入口，不扩大到旧模拟样例专项。

历史条目保留原范围；当前进度以上述记录和 Master 为准。

## 2026-10-05 能力支线恢复与 DT-01a 引文核验

KEEP Pi/SQLite/原资料宿主；REUSE固定DeepTutor纯search/models；ADAPT独立namespace/protocol/Provider，不搬AgentLoop/Store。OpenMAIC选独立DSL/generation/renderer/editor/importer/storage抽象，下一实施前锁依赖与许可；不引Next.js/PG/director。用户本轮优先级变更明确，Phase3未完成项保留。

Goal ACTIVE。按本轮用户纠偏，当前工作转为 Phase4/5 能力支线；Phase3欠项保留OPEN，不因切换优先级记完成。详细顺序：docs/goal/EDUCATION_BRANCH_TODOLIST.md；当前限定验收：docs/goal/PHASE4_DT_01A_ACCEPTANCE.md。

Done（限定A/C）：固定新版DeepTutor源码的只读引文核验已接 Pi / EducationCapabilityProvider，真实DeepSeek正反核验、持久结果与冷恢复通过；11边界、12相关工具回归、133组件、正式Electron4场景及5张静态图审。原Python源码/Apache许可证逐字复用，无第二Loop/Store、新依赖或Schema。学生个性化/Golden F、OpenMAIC SDK/Golden E仍OPEN。

Next唯一：DT-01b，复用同一原版search_units补全资料正文搜索与来源定位；再DT-02学生真实事实→DT-03掌握度/复习→DT-04两周训练→DT-05题目/学习路径；随后MA-01 DSL本地合同→generation→renderer→编辑/导入→真实互动课堂。不能回到旧模拟样例兼容循环。

Failed/Open：原legacy全套smoke最新exit1（题本SQLite回执早于React显示）；两处断言已改为等待真实DOM，未全套重跑，不能声称207通过。Phase3完整39项、备课本全图审/整体验收、完整Goal/无VPN/安装/许可安全/人工仍OPEN。正式首4次图审失败与第五成功均保留；最后一次最终构建验收报告见closeout，不能宣称连续稳定。

日常版本统一：npm start/根启动小智.cmd先成功构建后开当前out，旧dist可恢复归档，release不跟随旧dev URL，单实例聚焦/版本变化重启；owned验收窗口隐藏。此前日常入口5/5有限验收、两图审及备课本独立8场景通过，不代表完整Phase3。默认out本轮有意更新；未清空日常事实、改密钥/供应商/DNS/proxy/VPN或提交/push。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55，工作树保留既有改动。

## 2026-10-05 P3-04：资料收录、全量目录与真实正文工具接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-04仅资料收录、全量目录与正文工具实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。以下为当前生效状态，后文各轮记录保留历史范围。新接口只取真实本地事实，旧模拟业务兼容与测试样例书专项不再投入，不自动补回演示种子。

KEEP：Pi1.0.2唯一编排、Hana execution-once/现有Office脱敏/AnyDoc worker/原chunk算法；ADAPT：SQLite资料Repository、短事务和typed主宿主、两资料只读工具、已有Pro ListView/Markdown/EmptyState与OSS Pagination。新增version1 marker保持旧创建身份和JSONL原前缀。

不增加第二Agent、独立Python解析服务、云OCR、Schema或新依赖。DeepTutor缓存/engine signature、OpenMAIC MinerU/RFC只作接缝比较，后续按Phase4/5能力适配。原始资料仍本地，必要脱敏分段仅为当前任务发送；权限/教师确认规则不改变。

边界：PDF只接受已验证文本层路径，扫描OCR未完成；旧doc/xls/ppt不支持。目录查找按全库名称/格式，不是资料全文搜索；Unicode归一仅查询侧，SQLite lower不承诺全Unicode等价。原生选择单批50文件、既有15秒/50MiB输入/1MiB解析输出均为工具边界，不是运行预算。资料收录不等于教师确认；失败保留旧已提交派生正文且不伪称ready。教学Office产物目录仍最近100份，完整分页待后续合同。日常安装、无VPN、WPS版式、人工、全Codex体感、安全/许可、完整教育Golden均OPEN；未以隔离验收替换日常out。

Evidence：固定build9，323文件/SHA 52d6321cd1b974c26ae4ce8c06459bb157744a1660851d54475893780e193f9e；正常build/typecheck exit0，renderer129/129、资料/Office工具边界12/12、真实DeepSeek正式Electron工作台31/31、原教育隔离legacy-test回归207/207，均独立exit0。31项report.success=true/rendererErrors=[]，四次实际独立profile启动、当前构建/脚本指纹与main已加载模块核验；207本轮确实在最终build9重跑，不能作为新教育黄金闭环。37最终PNG归档，其中21张逐张视觉审阅，覆盖本轮资料空/正文/失败/冷恢复及正文工具浅暗1366×768/1920×1080；其他16张只归档。本轮控件可达/可读，不宣称全部Codex像素一致或全页WCAG。归档：apps/desktop/test-results/goal/phase3-ingestion-20261005/closeout.json，SHA 36d6820c3685aef39c4c6b6f85a38efbb1ab11ef7f1d513b29b09d1ae7238585；精确命令与失败见PHASE3_PRODUCT_SPACES_CONTRACT。

Next：P3-05，整理传统备课、讲义、题本与学生页面的教师操作体验，盘点实际 typed 入口、业务事实和失败状态，先冻结增量合同，再逐切片实现与验收；随后完整Phase3验收，再Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。Pi保持唯一生产编排。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55。本轮开始HEAD为20aa86656cdb5a0f85e0e11fa21863b50233fcb1，执行中观察到外部提交推进，保留其内容；本Agent未提交或push。Master2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302保持。daily out323文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981本轮未变；P3-03曾意外重建并精确恢复的历史保留。没有新Schema/依赖/vendor/密钥/供应商/系统DNS、proxy、VPN变更，没有清空日常数据。


## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

复用现有SQLite资源/产物typed接口、HeroUI Pro ListView/EmptyState、HeroUI OSS SearchField和PiWorkspaceFiles，新增薄renderer页面，不造第二导入/文件宿主/Agent Loop。官方Pro站点和MCP不可访问时按已授权项目现有组件源码/CSS/util fallback；不引新依赖，Pro分发许可门禁仍OPEN。已核本地DeepTutor be1701108a22c1037bb8004322ef6145302cbf5e Apache-2.0、OpenMAIC636fab0d7edee5e7c2694117c38ece8f623573f9 MIT：资料中心/存储抽象可参考，但本轮已有本地接口足够，没有迁移其runtime或新代码许可。参考源码/官方链接见既有Phase3合同。

教师资料页使用现有 getKnowledgeOverview/importKnowledgeResources/showKnowledgeResource，显示实际资源/摘录和收录状态，已添加不等于已解析。当前仅TXT/Markdown真的收录；PDF/Office/图片仍正文待处理，不伪称可检索。资源最近100份、摘录最近24块、教学文件最近100份；筛选仅当前已载入名称/格式，非全文或全库检索。教学默认artifacts，跨会话目录显示真实保存事实，历史保存内容与当前本地文件预览分开展示；预览仍复用已有会话授权/version校验，定位由main核实际路径/产物ID后发送OS文件夹定位。文件不存在必须失败，不以旧摘要冒充当前内容。外链/图片不在目录Markdown中自动加载。旧knowledge工程页仅legacy-test，备课/讲义/题本入口保留。

本轮 npm run test:smoke 内部先执行 npm run build，忽略隔离验收构建env而短暂重建默认out。发现后核历史逐文件SHA，找回全部323文件，先将意外重建版本改名保存在owned/daily-rebuilt，再恢复原out并核总SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981；详见daily-restoration.json。不能说daily out从未变化。未触及用户日常数据/profile、密钥、系统DNS/proxy/VPN；未提交/push。以后需要保留日常out时必须显式owned build +直接 node scripts/electron-smoke.mjs，不能用会隐式重建out的npm wrapper。

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。 Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

复用现有Pro AppLayout/Sidebar、HeroUI Button/Tooltip和Hana设置，增加薄ProductRail/ProductSpaceShell统一五入口，沿用现有desktop navigator而非引入第二router。Pi保持挂载，visible控制订阅/浮层外观；隐藏页面不能在窗口上留下交互浮层。设置own/child busy同锁入口。传统Search实际只学生/记录，所以归学生；未知/技术路径生产归ai。Scope仅导航/连续性；无需schema/provider/预算/依赖变更。官方Pro站点不可读取/MCP传输失败按已授权本地源fallback；未找到finesse，不声称使用。Next P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

选择扩展现有4真实UI suites和原build-root接缝；无新生产Loop/预算/依赖。用真实SSE usage校对账本；不估计高缓存命中率。栏目断言依据当轮native/current可见DOM/实际回答，去旧白名单，首失败保留。依据Master Phase2范围接受唯一Pi装配、Domain保留及本轮工具控制/整理恢复；后续教育能力/人工/发布仍OPEN。Next Phase3五空间盘点合同，新接口真实数据优先，旧模拟兼容停止。

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

用户最新范围决定优先：旧模拟业务可删，未来以新接口为主，放弃学生/范围/旧checkpoint兼容工程。普通wire两别名薄Facade已实际接受，保持轻量，不扩展旧schema。Pi唯一主编排器；教育Domain保留待Phase4/5。生产业务模拟回填移到显式测试夹具。


## 2026-10-05 Phase2 P2-01 启动与旧 Runtime 边界接受

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING。P2-01 限定实现 A/C 接受，完整 Phase2 / Goal / 发布 / 人工验收 NOT_ACCEPTED。跳过测试样例说明书专项，Master 唯一主线。

采用现有Pi唯一Host加薄 RuntimeAuthority/legacy registrar；保原Domain与数据。受控legacy仅原隔离教育回归，产品不可选择。旧开关回退、把DeepTutor/OpenMAIC Runtime整搬、按Loop名称删除Domain均拒绝。官方setPath同步显式profile，默认profile不动；原导航runner等待真实UI入口。

Next：P2-02旧 Console/直接请求兼容 Facade 到同一 Pi，先请求校验、单次投递与原 AiConsoleRunResult 接缝，再续跑/停止/问答/重试。禁用旧入口不等于教育能力迁移完成；P2-03重复装配退役、P2-04完整阶段验收随后。

## 2026-10-05 Goal主线恢复、Phase1整体验收与Phase2入口

Goal ACTIVE；Phase1 Master九项主工作台完成实现层A/C验收（非完整Goal/发布/人工接受）；Current Phase：Phase2 Pi Runtime Consolidation DOING。

生产只加OfficeMarkdown薄适配器：沿原Pro StreamMarkdown/CodeBlock，pre恢复Streamdown2.5 data-block标记；app-owned CSS绑定原Shiki双主题到现有workspace media/semantic色。原vendor未改，无新依赖/Schema/IPC/model/权限/预算/上传变化；原OfficeConversation仅替换import/调用。inline、JSON fence、无语言fence、部分stream、HTML escaping边界5项加入原组件suite。

A薄adapter恢复已安装Streamdown和原Shiki默认语义；B改vendor/C依赖降级/自造parser不用。根据Master阶段1九项范围收口；完整Goal最终门禁不提前接受。Phase2需要逐入口替换真实编排，TS确定性context保留，DeepTutor/OpenMAIC教育能力剥离成Domain/Capability。

Next：Phase2 P2-01：按已核实旧IPC→Console/Graph/sidecar入站清单冻结RuntimeAuthority与兼容合同，移除正式环境回到旧编排的开关，逐条将旧聊天/续跑/停止迁移到Pi；保确定性教育Domain、旧数据和传统页面。不得直接删除agent-loop.ts或整搬DeepTutor/OpenMAIC Runtime。见docs/goal/PHASE2_RUNTIME_CONTRACT.md。

跳过测试样例书专项，唯一主线Master Goal；不无限重验已通过Shell小片，不将Phase2–8能力倒塞Phase1。日常原反馈/配置D、无VPN/安装E、完整Codex体感与像素对齐、教育黄金A–G、云视觉、WPS本轮版式、安全/Pro分发许可及三连稳定仍开放。没有改变Master、HEAD、daily out/profile/key、系统DNS/proxy/VPN，无提交/push。本轮不估算缓存命中率。

## 2026-10-05 文件面板主题与真实导航有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅M01/M09/M10只读文件面板有限A/C通过，完整Master DoD不降低。

复用现有Hana只读文件/Office解析、typed IPC、SQLite会话授权，以及原HeroUI Pro FileTree/Markdown和OSS Tabs/Resizable。生产仅两处：glass覆盖文件筛选placeholder使用语义muted色且opacity1；PiWorkspaceFiles在当前选中项或原Tabs滚动容器尺寸变化时，用scoped ref/ResizeObserver/rAF仅调整横向scrollLeft，使当前页签保持可见，不滚聊天、不抢焦点，卸载清理。文件正文不进模型、不持久化；未新增依赖/Schema/IPC/权限/loop/预算或自动上传。

A选现有组件薄适配；B重造文件管理器/C迁移教育runtime无必要，均不用。原Tabs保滚动按钮与键盘语义，只补当前selection/尺寸变化的定位。

下一唯一：Phase1按Master第2247段完成整体requirements与证据审计（sidebar/chat/composer/history/working/summary/plan/tool/progress/artifacts/files/approval/steer/retry/resume/compaction/model/skills/settings/glass）。先映射现有源码/固定build/各有限closeout，列最早缺口并完成正式实例与真实视觉，再决定Phase1接受；学生提示间歇风险列入主路径欠项。不得无限重复已关闭文件小切片或跳到Phase2。之后按Master执行唯一Pi runtime、五产品空间、教育能力/飞轮和黄金A–G。

日常D/用户原凭证联网图片失败、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS实际版式、安全与Pro分发许可保持OPEN。三元暂停；日常out/profile/key、代理/DNS/VPN、Master/HEAD及上一轮closeout均保持，未提交/push。本轮未新测或估算DeepSeek缓存率。


## 2026-10-05 公开中文与教师确认办公交付有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。完整Master DoD保持，本轮仅M01/M10办公交付事实与默认中文公开过程有限A/C验收。

A选本地真实交付投影，保Pi/工具/审批和原native。B仅prompt无法阻止本地确认后旧数值；C自动上传本地修订正文改变隐私，均不作为方案。应用在message_end缓冲分类，不展示私有CoT，不截断工具过程；最终文件交付消息来自本轮状态。

下一唯一：Phase1 Files/Artifacts完整面板验收。既有FILE面板当前证据只有浅色宽窄；冻结现有Hana文件宿主、HeroUI预览/来源与当前主题复用合同，补文件导航、版本变化/损坏/失败返回、冷恢复、浅暗双尺寸与真实PNG，保只读权限和本地事实。完整Shell验收后进入Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮/黄金A–G。

日常D/用户原凭证联网图片反馈、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS排版、安全修补与Pro分发许可保持OPEN，三元暂停。未更换日常out/profile/key、代理/DNS/VPN或提交/push；Master/HEAD与日常out SHA原样，旧证据保留。本轮不新统计缓存率或承诺命中。办公公开交付采用可信回执，不宣称已把模型原始总结变成事实或解决所有自然语言幻觉。


## 2026-10-05 原失败会话创建指纹兼容有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅 M01/M10 已识别旧创建身份兼容有限 A/C 通过，保持完整 Master DoD。

原 aXLjJ8 / copied pi-auto-ui-ik9wla 配置拒绝已定位：原授权工作目录会话创建时使用旧 copy 审批提示规则，后续文案更新直接改变创建 fingerprint，恢复在请求 provider 之前拒绝。两份旧授权 native 的指纹精确匹配已保存 p07-office-document-tools 原源码；私有会话精确匹配当前规则。不是这两份会话的凭证或网络故障。

选A：应用创建身份薄适配器，复用当前Pi SessionManager。B直接改JSONL/SQLite指纹会覆盖历史并绕审核，拒绝；C放松配置保护/加入另一编排器无必要。已核单旧规则用于identity，最新规则用于有效prompt；所有控制/记忆能力保原严格校验。无迁移表/依赖变化，回滚恢复owned source-before中3项，原历史不需逆迁移。

下一唯一：Phase1 公开中文摘要与教师修订后事实一致性。先冻结当前实际旧37正文/已确认41文件差异与英文过程的交付合同，比较现有 Hana/Pi 公开事件、Office确认结果/产物回执，复用成熟接缝；以原真实教师编辑→确认→文件→公开回复→cold链路逐字段验收，不能用模型说已完成或测试回读替代文件真源。之后完成 Shell，再 Phase2 唯一 Pi runtime、Phase3 五空间、教育适配/飞轮/黄金 A–G。

公开英文摘要、旧37正文与教师修订41文件一致性仍 OPEN。日常 D/用户原凭证联网图片反馈、无VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS排版、安全修补与 Pro 分发许可仍 OPEN；三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常profile/key、系统代理/DNS/VPN或提交/push。缓存策略不改，本轮未新统计命中率，不将历史比例写成当前保证。


## 2026-10-05 真实工作过程有限切片验收与继续位置

完整 Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮只接受 M01/M10 真实工作过程的有限 A/C 切片。

采用已有workspaceStatus+公开Pi projection+OSSSpinner，避免复制另一套编排/私有CoT。采用既有protectedContext顺序调整，当前教师文本不重写。测试现代化使用真实UI fresh seed、实际原生chronology和131072提前阈值；不篡改JSONL、不降低生产容量/权限保护。等待有限主题过渡以测稳定最终对比度，保原过渡失败证据。

真实 reported usage（排除auto副本继承30条旧run，未上报/停止分开）：control3个reported run缓存读入占输入87.08%；auto10个55.33%；Office7个94.65%；queue2个69.87%。分母=input+cacheRead+cacheWrite，input不含缓存读入；未报告分别2/3/3/3条，不按0补齐，不推算成本或保证未来命中率。原始可核验数字见usage-readback.json；原有稳定prefix与Hana/Pi缓存/压缩接缝保持，不为提高比例增加warmup调用。

下一唯一：先定位原 copied pi-auto-ui-ik9wla 会话的创建快照/配置指纹兼容失败（aXLjJ8），冻结可识别版本的迁移、回滚和原字节验收合同，再修复；不得用 fresh seed 通过关闭旧兼容、放松权限指纹或重写 native JSONL。之后补齐 Shell：中文公开摘要、教师修订后正文与实际文件数值一致；再 Phase2 唯一 Pi runtime、Phase3 五空间与教育能力/飞轮/黄金 A–G。

日常 D、无 VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS 实际排版、安全修补与 Pro 分发许可继续 OPEN；用户原凭证/联网/图片失败未关闭，三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常 profile/key、系统代理/DNS/VPN，未提交/push。


## 2026-10-05 联网与浏览器有限切片验收结果

ADR-017：沿现有 Hana/Pi 浏览器薄适配；成熟 WebContentsView 负责 native capture，主进程固定状态动作负责恢复，OSS Button/Modal负责控件。整搬Hana broad IPC会绕过本项目网页/写操作授权，不采用；独立Playwright生产服务无必要。Playwright仅复用已安装测试启动器。多入口共用语义theme，glass布局独占主入口以避免Vite hoist回退。

生产沿现有 Pi customTools、Hana v0.450.0 DOM/ref/wait/截图文件名与 Electron WebContentsView。删除截图前可能挂起的 renderer RAF 前置等待，原生 capturePage(stayAwake) 受15秒工具取消/超时、samePage/revision及文件hash校验约束；此为单次工具边界，不是运行预算。失败页复用 OSS Button，固定返回动作只被本地 status view 的 will-navigate 消费并关闭本会话窗口，保失败历史/其他会话，不重放模型或偷偷重新联网。截图 Modal 加同一主题边界。共享颜色 token 从 glass 抽为独立 theme CSS，布局覆盖仅留主入口；status HTML 与主入口同 HeroUI layer 顺序。无新依赖/表/共享 IPC/第二 runtime，自动压缩和无预算规则保持。

证据入口：apps/desktop/test-results/goal/browser-workspace-20261005/closeout.json，固定身份 identities.json、source-before/docs-before、最终报告和13PNG均 SHA 回读。精确命令（cwd apps/desktop）：npm run build -- --config test-results/goal/browser-workspace-20261005/workspace-build3.config.ts → build3.log；npm run test:renderer-components → renderer2.log；OMNI_EDU_TEST_BUILD_ROOT=owned/build3 串行 node scripts/xiaozhi-agent/pi-browser-native-smoke.mjs → native15-final.log、node scripts/xiaozhi-agent/pi-browser-delivery-ui-smoke.mjs → delivery-ui2.log、node scripts/xiaozhi-agent/pi-web-ui-smoke.mjs → web-ui4.log、node scripts/electron-smoke.mjs → main2.log；三个修改runner node --check、仓库 git diff --check → final-check.log。

下一唯一：继续 Phase1，冻结真实运行过程/确认/补充/自动整理的可见状态合同；按 VIEW-01/02 与 CTRL-01/02/03，用同一实际 Pi 任务核执行前摘要→工具→后续摘要、审批/补充、自动整理、排队编辑/撤回及双尺寸浅暗 PNG。复用当前 Hana/Pi 生命周期和 HeroUI 过程卡，不新增编排器。之后 Phase2 退役重复 runtime、Phase3 五空间及教育能力/飞轮/黄金 A–G。日常 D、无 VPN/安装 E、三次稳定、安全修补与 Pro 分发许可继续 OPEN，三元暂停。


## 2026-10-05 教师公开消息切片验收结果

ADR-016：采用Hana displayText独立展示记录的思路，适配当前SQLite metadata/原子附件提交，避免为展示再修改Pi JSONL。已读本地openhanako/core/desktop-session-submit.ts recordMessagePresentationEntry及449 server/routes/sessions.ts presentation投影；449裁剪包缺lib/core实现，以完整本地源码补核，不宣称449文件不存在却已读。A现有metadata薄适配选用；B Pi原生_expandSkillCommand生成XML供模型，不能证明原UI输入来源；C正则隐藏拒绝。官方 https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/agent-session.ts 与安装lock对应扩展源码已核；HeroUI官方chat-message/prompt-input文档已查，沿当前vendor，不新取Pro源，许可hold保持。Hana函数依赖sessionManager/业务refs，整搬会添加不必要记录；仅适配展示契约，不增服务/依赖/打包体积。

选择技能时只给自动生成的执行命令附presentation v1（version/skill/text），主进程严校exact prompt、版本/字段/访问器；公开投影仅使用匹配本地主Pi运行的元数据。普通append保raw content并写metadata；附件ledger增presentation_json空默认列，原子同statement写metadata，新请求hash绑定presentation，旧请求hash保持。旧未知/手写命令/代码不猜测裁切，损坏metadata回退原文。即时pending、运行中、完成、归档、cold投影一致；失败显式重试携带原presentation并保新草稿，Pi/native/执行prompt/技能扩展/工具权限保持。无新依赖/第二runtime/运行预算/凭证变化。

证据入口：apps/desktop/test-results/goal/public-message-20261005/closeout.json。精确命令/日志：隔离npm run build -- --config test-results/goal/public-message-20261005/workspace-build1.config.ts → build1.log；npm run test:renderer-components → renderer1.log；node scripts/xiaozhi-agent/pi-attachment-send-native-smoke.mjs → native1.log；以OMNI_EDU_TEST_BUILD_ROOT指向build1串行node scripts/xiaozhi-agent/pi-attachment-send-ui-smoke.mjs → attachment-ui1/2.log，node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs → settings-ui1.log，node scripts/electron-smoke.mjs → main1.log；node --check两UI脚本与git diff --check exit0。

下一唯一：继续Phase1联网过程、来源预览与内置浏览器工作台验收。按测试样例说明书NET-01/02/03/04，核当前构建真实搜索→正文→浏览页面/截图→来源打开、错误/重试/停止/冷恢复与浅暗双尺寸；先比较Hana/Pi现有实现并冻结合同，复用现有工具/权限/浏览器宿主。原自动压缩、不设运行预算、国内DeepSeek保持；缓存命中率另以真实usage统计，不能拿提示词长度推算。之后Phase2唯一Pi、Phase3五空间与教育适配/飞轮/黄金A–G。D/E、连续三次稳定、Pro许可与安全修补仍OPEN，三元暂停。

## 2026-10-05 会话菜单切片验收结果

M01/M10会话菜单有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

**ADR-015：现有OSS Menu/Popover适配会话菜单。** A采用已安装HeroUI/RAC，同一主题/键盘/定位库；B官方Pro ContextMenu文档有键盘描述，但本地Trigger只鼠标/触摸且需新增授权源，未迁入；C原fixed div缺成熟语义/碰撞/焦点，不保作Codex新入口。Pi无renderer菜单，DeepTutor/OpenMAIC第二runtime不对应UI切片。现有Hana业务服务保留，finesse历史审阅不当本轮新源。官方[HeroUI ContextMenu](https://heroui.pro/docs/react/components/context-menu)、[RAC Popover](https://react-aria.adobe.com/Popover)、[RAC Menu](https://react-aria.adobe.com/Menu)与本地版本源码已核；Windows无新增依赖/服务/安装体积，既有Pro发布许可未因此关闭。

现有HeroUI3.2.2 MIT Dropdown.Menu/Item/Popover与React Aria1.19.0 Apache-2.0复用；宿主仅选择目标/鼠标键盘锚点，成熟组件负责导航、焦点/碰撞。锚点Portal到body，避开玻璃backdrop创建的fixed参照，12px安全内距；复用标准dropdown BEM样式和pi主题。Shift+F10/ContextMenu/上下键/Home/End/Enter/Escape、取消/成功后焦点恢复及被归档移除后聚焦新聊天，busy编辑锁和外部滚动关闭已接。原非Codex菜单/归档分支保持。无新增依赖、Pro源码、表/IPC/迁移/凭证/运行预算/第二runtime，Pi自动压缩不改。

证据入口：apps/desktop/test-results/goal/context-menu-20261005/closeout.json；本轮构建/日志与原始专项report/PNG逐文件SHA回读，所有首失败保持。

下一唯一：Phase1教师化公开消息投影。最终真实归档截图仍显示自动注入的/skill:teaching-office命令；先核其编码与projection来源，复用已有消息契约，只在公开UI呈现教师原输入，保native原文、技能选择、来源与旧会话兼容，冻结后以真实发送/工具/冷恢复及浅暗双尺寸验收。随后补齐其余Shell状态，再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮及黄金A–G。D/E、连续3次稳定、安全修补和Pro发布许可仍OPEN，三元暂停保持。

## 2026-10-05 设置与弹层切片验收结果

M01/M10设置、模型菜单、归档确认与附件/OCR弹层有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

**ADR-014：复用已有Hana设置和OSS Modal，统一局部主题。** A选现成设置/Modal/Dropdown+共享token；B不为局部问题新增整套设置或OCR引擎；C不搬DeepTutor/OpenMAIC第二runtime。官方Pro库存66/OSS72、Modal/ContextMenu/AlertDialog文档本轮已核，settings-layout/settings-row不在库存，未宣称存在。无新增Pro源码/依赖，既有Pro发布授权hold保持。

稳定口径：设置和附件/归档portal统一pi-themed-surface；应用CSS覆盖Hana状态透明度，vendor许可/源不改。Codex归档使用既有OSS Modal，旧入口modal=false保持原行为；本地真源、权限/教师确认、typed服务和原Pi compaction不变。右键菜单仍待独立适配。

精确证据与SHA回读：apps/desktop/test-results/goal/overlays-20261005/closeout.json；原始专项报告及首次失败独立目录保留，最终命令/日志见docs/acceptance/CURRENT.md。前面layout/标题/controls为历史，不覆盖。

下一唯一：继续Phase1，先冻结会话右键菜单合同，复用成熟ContextMenu/Menu适配器，补Shift+F10/上下键/Enter/Escape与焦点恢复、屏幕边缘避让及native浅暗双尺寸；当前仍是fixed原始div，不能因归档Modal已验就称会话菜单完成。其余Shell状态验完后再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；D/E、安全修补及Pro许可仍OPEN，三元暂停保持。

## 2026-10-05 布局与暗色控件切片验收结果

M01/M10布局与暗色控件有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

**ADR-013：复用HeroUI壳的父内容高度与局部语义主题。** A：现有AppLayout content+parent100%+现有控件/Portal主题选定；B：page/sticky新壳会改变已有滚动权属，不采用；C：整搬其他agent/runtime与局部尺寸/主题无关，不采用。官方Pro AppLayout/ChatConversation文档已核，既有finesse MIT产品/控制台指导用于审阅；本轮不复制新Pro源码。

复用既有HeroUI AppLayout content、Sidebar、ChatConversation、Dropdown及控制卡。直接aside由100dvh改为父内容区100%，消除36px菜单+8px间距形成的44px外层隐藏滚动；仅消息/侧栏内容拥有滚动。工作区与其pi-office-menu portal统一pi语义色，并补HeroUI accent-soft/segment及旧text/line/danger别名；技能Popover补现有主题class。问答、计划、失败/审阅及办公编辑浅暗色一致，未新增依赖/表/IPC/迁移/凭证/预算/第二runtime；原自动压缩保持。

依测试样例说明书按C隔离正式Electron记录，仅最终单轮通过，不追认为连续3次稳定，不关闭用户旧配置/会话失败。Office真实模型四格式生成、确认/拒绝、教师修订、来源CAS/版本冲突、实际kill与两次冷恢复、SQLite/file SHA及独立Python格式回读通过；本轮未新验WPS/Microsoft Office应用排版。文件面板无provider新请求；未借此外推NET/OCR/视觉或全harness完成。日常out323文件SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master与HEAD保持，日常profile/钥未改，无提交/push。

下一唯一：继续Phase1，冻结设置工作区、会话管理与附件/OCR弹层合同，核浅暗主题、错误/重试与可达性，再用真实native双尺寸验收。完整Shell后继续Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；日常人工D、无VPN/安装E、安全修补及Pro许可仍开放。

## 2026-10-05 自动标题兼容切片验收结果

**ADR-012：统一本地标题派生与保守来源迁移。** A采用既有fallback+Pi严格命令边界；B已核Hana真实LLM summarizeTitle，为后续候选；C不迁移DeepTutor/OpenMAIC会话runtime。共享纯函数与增量provenance；旧legacy不猜手工、新rename必manual，附件触发器savepoint更新、原一语句发布/旧receipt保持。旧版实际副本读通过，new task旧语义未外推。

自动标题本地fallback兼容切片有限通过；Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。普通append与附件原子publish共用conversationTitle，合法/skill前缀不挤占任务标题，保原提示词/Pi原生记录；不是新增LLM语义摘要命名。

下一唯一：Phase1专项定位问答/长过程中的Shell顶部裁切，冻结布局/滚动与完整暗色菜单合同，复用既有HeroUI/语义主题和原控制卡，以真实native双尺寸、可达性与PNG验收。完整Shell后再Phase2退役重复runtime、Phase3五空间、教育适配/飞轮/黄金A–G；日常人工D、无VPN安装E、安全修补与Pro许可仍开放。

## 2026-10-05 CTRL/CFG当前构建验收结果

**ADR-011：当前构建控制/配置与历史测试政策分离。** 复用Pi原生队列和Hana ID/revision宿主，无生产新runtime。legacy suite改为既有testMain固定构建和owned user profile，仅明确旧测试副本。历史auto-control-edge的finite-budget gate不符合当前合同，首缺参数在启动前即终止，保持源与日志，不以恢复预算来“通过”。合法旧新比较按当前字段/真实读取回执校验，首次误断言保留。

Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。仅复用现有Pi1.0.2/Hana队列宿主、控制卡和设置进行当前构建验收；本轮没有生产源码、依赖、表、IPC、预算、凭证或日常数据迁移。

下一唯一：冻结/skill自动标题兼容合同，核普通append与附件原子append两条路径，保手工标题、原提示词、历史/native绑定与本地真源；完成后继续Shell顶部裁切、完整暗色菜单与其余缺口。Phase2退役重复runtime、Phase3五空间、教育适配/飞轮、黄金A–G、日常D与无VPN安装E仍开放，不重复已通过的有限审计。

## 2026-10-05 Glass主壳与文件版本接缝结果

**ADR-010：Glass限定语义主题与来源版本接缝。** 采用既有成熟组件和官方glass tokens，未另导Pro/依赖。原正文/输入/审批保实底；光暗/强色/键盘验证分开，视觉基线不能代替业务成功。fileVersion保持既有文件身份规则，Hana可选注入兼容旧结果，正文SHA独立；读前后检查和Office CAS各负责一个边界，不移除审批或将SHA接受成版本。无表/IPC/migration/native历史变更。有限切片回滚为CSS/import/Tooltip及version回调撤回；权限/来源服务保持。

本轮Glass主壳与来源版本接缝有限验收通过，Phase1完整Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。生产新增仅工作区glass语义CSS、原OSS Tooltip接线，以及Hana文件回执可选version回调；Pi两处host复用既有fileVersion。正文sha256与来源version分开，读取前后变化拒绝，不放宽来源CAS/权限/教师确认。不新增依赖、表、IPC或第二runtime，不设置运行预算，原自动压缩保持。

Next：下一从Phase1原CTRL/CFG的当前构建验收继续：真实运行中编辑/撤回、停止、补充/重试、设置保存返回同会话；按实际缺口冻结合同修复。随后独立兼容合同处理/skill自动标题两条路径，完成完整Shell，再Phase2退役旧runtime、Phase3五空间。原用户失败/D日常、E无VPN与安装、A–G、安全补丁/私有日志/userData ACL/备份恢复、Pro许可仍OPEN；三元暂停保持。已有壳/包审计不再重复。

## ADR-009 — 2026-10-05 独立包实际接缝与迁移gate

复用OpenMAIC官方tarball smoke/scene-generation测试方法，原audit加--packages；只在owned ignored consumer安装固定三包，scripts禁执行。npm registry SHA512验证与Git clean/head分别记；renderer45 map源及generation38资源匹配，DSL/generation缺embedded source不当全来源签名或构建复现。

Node及实际sandbox Electron合成渲染5项过，bundle11.2MB/安装149.5MB分别量。测试的ESM ready死等与双React初失败保留；用CJS异步ready及consumer React/DOM alias，不修改上游或生产。React dedupe必须按真实bundle inputs验证，nodePaths只是fallback。

最小包接缝审计通过，不提前移植生产教学能力。完整license/NOTICE保留但grammar/wasm及最终分发范围继续gate；fonts.css CDN不采用，系统字体合成例不证明KaTeX/Office字体。富文本/shape/table等原包危险HTML渲染须宿主schema/sanitize/URL边界。PBL第二loop/整站/PG/远端存储仍不采用。

Phase0应收敛固定审计范围和可执行hold，而非要求所有Phase4/5/7能力已实现；同样不能把未修风险或未验证资源改为通过。下一安全可达性/日志/Windows收敛及Phase1真实Shell合同，保持《测试样例说明书》原失败D/E条件和整体active。

## ADR-001 — 2026-10-05 新 Master 优先级

用户明确指定 `XIAOZHI_CODEX_GOAL.md` 为最高工程合同。它将方向更新为 Codex-first教育桌面、五空间、Liquid Glass、唯一Pi编排与受评估的本地学习飞轮。

旧28/35/67及四根文档的方向/下一项在冲突处由新Master取代，历史有效证据保留；167自动标题转入Phase1/3缺口。Phase0先完成，不能把已有设置通过当新Goal完成。

## ADR-002 — 唯一生产编排器与教育能力适配

Pi SDK是唯一目标Orchestrator。当前旧Console/Harness仍可达，所以这是待实现目标而非已达事实。通过adapter/provider/facade保留教育DOMAIN，逐步退役重复RUNTIME；不直接修改vendoredDeepTutor，不整站嵌套OpenMAIC，不删域数据。

每个迁移先冻结共享契约、调用替代、schema/脱敏、错误/取消/恢复、旧数据与回滚。退役须新链路过验、旧引用清零。

已核TS旧runAiAgentLoop为确定性context编译，教育DOMAIN应保留；Pythonbridge独立loop及Console/用户输入路径LangGraph为编排退役候选。Pi聊天条件分支不消除传统错题回调的旧入口，按真实接线逐入口迁移。旧budget通道只作兼容审计，不新增运行预算。

## ADR-003 — 用户概念与过程可见性

主导航仅问小智/我的资料/教学内容/学生/设置。技术概念默认隐藏，传统数据管理页保留。显示公开计划/工作摘要/工具回执/进度/审批/文件/产物/停止恢复，不展示模型私有Chain-of-Thought。

Codex一致使用体感以真实行为与交付为准；新视觉按Apple-like Liquid Glass × Codex Productivity × Education Warmth，不继续要求未公开桌面组件源码逐像素复制。

## ADR-004 — 复用、许可证与上游快照

调查顺序EduDev→Pi→DeepTutor→OpenMAIC→HeroUI/finesse→官方开源候选，最后才自写。只读隔离上游源，保护原checkout脏改动。

根仓库许可证不能代替模块/字体/转依赖许可证。OpenMAIC部分bundled LGPL代码不能标全MIT；Pro查询可用不证明发布授权。证据未闭合的源码不移植，审计其他项继续。

## ADR-005 — 数据真源与后台学习边界

SQLite/files本地真源；运行数据退出Git须备份/迁移/readback/恢复验证后执行，当前仅元数据审计，不删用户文件。

飞轮允许可评估、版本化、回滚的偏好/策略/路由优化；FACT/PREFERENCE/INFERENCE/STRATEGY/PROMPT/SKILL分开。禁自动改事实、源码、schema、credential、权限/approval、安全隐私规则。Hermes README当前仅部分优化落地，不能冒称完整飞轮可直接搬入。

## ADR-006 — 稳定文档与测试收敛

后续使用四份Goal文件与四份领域CURRENT作为稳定入口，不再每个切片新增编号合同/报告/独立smoke。复用已有测试框架、说明书与合成样本；需要新测试时补现有领域suite。

旧证据不可覆盖；历史文档归档前先迁移链接。新Master全门禁决定DONE，A/B/C/D/E层级不串用；缺真实视觉不称UI完成。本轮只审计/文档，无生产改动，不为了文档重复跑无关79/207。

## ADR-007 — 可重复审计入口与离线基线

复用既有audit.mjs新增--baseline，不另建独立smoke/依赖。owned profile/cwd + 现有unpackaged E2E_DIALOG_MODE跳过.env.local；key/model必须实断言为空，固定生产构建指纹。合成公开历史与本地I/O只说明对应性能/恢复，provider与安装标UNMEASURED。

首KwhKiQ环境断言失败：空env仍让main loadLocalEnv加载本地.env.local，不能称该失败启动“未读凭证”；未打印值，也未提交模型任务。改owned cwd+既有测试gate。次1f7hU0定位器匹配侧栏预览及正文，改限定office-conversation，不放宽真实正文检查；第三IfNQQo C7通过。保全部失败，不追认重复稳定；冷恢复的零tool事件仅在composer ready后观察，不以迟注册监听证明整个启动期零重放。

领域学情suite在断言前遇Pi传递CJS打包错误，只externalize安装的pi-coding-agent，原8项断言不变。renderer79、typecheck、原scheduler20、web13、evidence grader22实际重跑；原audit run-J5fGBi仍正确拒绝缺OCR与人工层的记录，exit1是验收未完整而非本轮新产品回归失败。

## ADR-008 — 审计通过与未来迁移门禁分开

记录32文件分类/15上游处置/真实基线属于Phase0进展；无新版adapter、唯一全产品runtime、五空间或安全修补交付声明。Pro许可、转依赖闭包、Windows、备份一致性/恢复、依赖high和真实用户反馈仍保留最早未验项；不以一条“审计有风险”把这些改成已通过。后续先补候选最小闭包和UI合同，再入Phase1；三元暂停保持。

## ADR-009 — 有限审计退出与真实状态首切片

安全库存/源码路径/日志/owned Windows证据已形成；发布补丁与实际userData/备份恢复保Phase7，不要求未来所有功能在Phase0预先实现。候选许可/资源逐迁移gate继续，唯一全产品Pi在Phase2验而非冒称现成。Phase1先状态策略及原组件接线，旧历史completed不能作成功证据；通过SSR与实际typed旧历史/冷恢复/双尺寸有限验收。自动compaction沿现有public投影，不新造runtime或预算。

2026-10-05：Phase0有限审计已退出；Phase1 Shell DOING，整体NOT_ACCEPTED。新增office/workspace-status.ts并接PiWorkspaceContext，旧历史不称新任务成功；恢复、审批、补充、手动/自动整理、失败/停止按公开真实状态呈现。自动整理从实际applyXiaozhiEvent投影读取，不把它等同manual operation。后端/权限/IPC/native记录/模型/key/预算/数据未改。

最后隔离正常build含tsc exit0；renderer101（原79+18状态+4实际compaction投影转换）exit0；web13/证据grader22 exit0。最终baseline-mLN2E0真实Electron10项：空/typed历史状态、200条公开合成记录/只读SQLite、冷恢复、双content尺寸输入可达/实际PNG已看；构建323文件/16105165字节/SHA f5d71e0e73bd140ae4ba9de1c6c4e0e89aba69b01420219340c2e52093c082cc。首ijFI2G为前一有限通过，保两个build/日志，不称3次稳定。离线例不证明B/provider、NET/FILE/CTRL全路径或日常D/E，也不是新Glass完整视觉验收。

security-audit-DBWIc2库存3项/exit0；fresh npm audit exit1仍0critical/3high/2moderate。只有路径/日志/owned Windows ACL与修补门禁审计通过，漏洞没有修复。证据在 apps/desktop/test-results/goal/security-0785b4e6/security-audit-DBWIc2/report.json 和 apps/desktop/test-results/acceptance/baseline-mLN2E0/report.json；完整命令见docs/acceptance/CURRENT.md。

Next：Phase1继续真实Pi主工作台：先冻结glass主壳/低噪音过程/输入栏/文件与来源的本轮组件、token、状态、回滚和验收清单；优先既有组件与公开主题token，保持实际Pi接线。按测试说明书原NET-01/FILE-01/CTRL/CFG分步跑同输入，补运行/审批/输入/自动整理在真实任务中可见的双尺寸证据，再完成其余Shell。标题属于独立兼容切片；Phase2后退役旧编排。安全修补/私有日志/实际userData ACL/备份restore、许可分发、A–G、D/E均继续开放，不重做已完成包/基线审计。
