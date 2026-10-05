# 当前验收入口

## 2026-10-06 DT-05 同源五题与两周训练（当前）

Done：当前照片入口发送完整教师可编辑草稿→唯一Pi实读原错题与学习事实→真实DeepSeek提出5道同源简答变式→教师修订确认5子题→Pi重读最终版本→确认五题练习/5引用→依真实错因制定完整14天→逐题录入实际表现与8/10→重新分析与修订14天→冷恢复不重放。读回为1原题+5子题、1五题练习、5引用、3真实记录（照片原事件/教师事实/本次逐题结果）及2计划版本。原照片与根题不变。 正式Pi/真实DeepSeek与本地OCR链同固定构建通过；历史smoke隔离旧runtime仅回归。内容验收：逐题算核发现原AI第五题解析错误地用“3.5不比直角边长”排除直接相加，已在实际教师第五题textarea改为3.5²≠平方和；首题改为8/15→17，初始计划第1天和第13天说明亦由原教师控件修正，模型原候选与最终版本同时保留。强schema不保证数学/教学正确；本次未放宽教师确认或推断未来成绩。实际复用原ChatTool/HeroUI Button、题/练习/学习writer与DeepTutor算法，无第二Agent或新事实真源。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。



## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

本次限定接受照片事实与根题，再次通过真实OCR及正式Pi/DeepSeek只读续接。12张浅暗1366×768/1920×1080实际Electron图逐张检查，表单与校正操作可达、无横向溢出。旧已验结果副本增量迁移保持2题/2学习记录与55→55消息；原文件不变。日常旧窗口、人工、无VPN安装与完整Golden C/F未验。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

当前接受边界仅为照片 OCR 与 Pi 草稿交接。新版实际页面 8/8、迁移旧结果副本 2/2；旧副本原 2 题/2 学习记录与 55 条消息保持，无重放。浅暗 1366×768 / 1920×1080 四图已逐张查看，控件可达且无横向溢出。未验完整照片 Golden C/F、日常旧窗口 DOM、人工使用和无 VPN 安装。

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

Done：已确认练习→当前学生学习计划→逐题实际作答/表现/教师反馈与可选分数→原learning_records writer→同版本来源→唯一Pi/原DeepTutor重新评估→教师修订14天安排→冷启动恢复，当前纵向切片限定接受。实际两题作答为12厘米（错误）与5厘米（正确）、教师分数6/10、整体部分正确；一条起点记录加一条实际训练结果，共2条事实，原2题/2份练习/3条引用不变。计划确认产生版本1与版本2，不把未来安排计作成绩。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

静态滚动截图只验当前新表单/结果可达与布局，不声称完整像素/动画一致。历史smoke build-b和最终生产build-c的main/preload完全相同；其范围、最后复选框样式差异及8张当前UI证据明确记录，不混写通过版本。旧实际题本副本仍3题、无新增事实；当前结果副本仍2条实际记录、零回放。

Runtime/Last verified commit：默认out是已验build-c；日常旧main PID27584（2026-10-06T02:52:05.61533+08:00）未重启，只读日常store发现1条waiting_input，保留原窗口与确认，不把当前磁盘文件称为该进程已加载版本。下次正常npm start会按已有revision机制切到新构建；日常DOM/人工未验。HEAD90d67381a08db8ba040211921288b55c87de3f55，Master全量已读且SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302 不变，既有用户脏改保留，未提交/推送。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

Done：当前教师录入原题→选定学生→唯一Pi/真实DeepSeek实读原题→原DeepTutor格式能力生成变式→教师编辑5/12题最终答案13厘米→Pi重新实读→可编辑练习核对卡→教师修改顺序/用途/观察与说明→确认→同一SQLite原练习writer/usage→学生传统错题与练习页读回相同版本/父题来源。原3/4题5厘米不变；最终2题、2份练习、3条引用、2确认/1拒绝、0条虚构作答/成绩。空标题失败零写入，重新读取保留编辑；拒绝/停止不保存，停止候选冷恢复可删去一题并确认，重复确认与再次冷启动不重复保存。

Evidence：固定build-c 341文件/SHA 15cba713c2dea8db351973b488c9314909caf31e5ea55d837c525159b0545207，默认out逐文件一致；build/typecheck exit0、统一145/145（education-boundary-wraImL，新增18项）、组件156/156、当前唯一Pi/真实DeepSeek9/9（education-journey-ADH5Jm，3次启动/rendererErrors=0）、旧真实题目核对数据副本3/3（5RLgDA，3题/33→33模型消息，0新增事实）、相关旧业务smoke207/207均当前固定build-c。八张实际Electron浅暗1366×768/1920×1080图逐张查看；核对/拒绝/关闭可达、长内容内部滚动、无横向溢出。完整命令、源码/报告SHA、SQLite读回、失败留存与视觉边界：apps/desktop/test-results/goal/dt05-practice-20261006/closeout.json。领域故障回滚使用真实SQLite测试ports；原writer保存由真实页面证明，不冒称生产OS强杀。

全新真实教师操作和上一已验题目库副本都通过；八图仅覆盖新增核对卡与来源Modal，不代表全Codex像素相同或日常人工。生产OS强杀未验；测试注入的SQLite切点与取消回滚按领域范围报告。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

Runtime/Last verified commit：旧日常PID49296无主窗口句柄，CloseMainWindow返回false，未强杀；现有npm start/second-instance构建版本机制正常relaunch，旧main退出，单个新main PID27584（2026-10-06T02:52:05.61533+08:00）加载默认out/main/index.js，与固定build-c一致。未注入或读取日常事实，日常DOM/人工未验。HEAD90d67381a08db8ba040211921288b55c87de3f55；MasterSHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/网络/VPN或第三方工作树。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

Done：当前教师实际录入原题→唯一Pi实读来源→原DeepTutor格式函数归一→可编辑核对卡→教师确认→同一SQLite题本保存。教师最终5/12题答案13厘米、恢复后的8/15题答案17厘米；原3/4题5厘米不变，最终3题/2确认/1拒绝。空答案失败不写事实，重新读取保留编辑，拒绝/停止无新题，停止后的候选冷恢复可确认，重放不重复保存。模型收到教师最终标题并重新实读最终题，而不是继续使用初稿。

Evidence：固定341文件/SHA e80b3052e86609b0156b7f91f735b534b9ba47c92d04a9cd83b81abdb0190ab2；原源码verify/build/typecheck exit0、统一127/127、当前组件150/150、当前唯一Pi/真实DeepSeek教师核对10/10（education-journey-R7dHLl），3次启动、rendererErrors=0。浅暗1366×768/1920×1080四图实际逐张查看：确认/拒绝与输入可达，窄窗题目字段在内部滚动区，无横向溢出。相关历史回归207/207是在build-a、最终元数据/摘要绑定/重试修复之前，不能当成最终构建全部回归。精确命令、SHA、版本、失败留存、SQLite读回与视觉范围：apps/desktop/test-results/goal/dt05-review-20261006/closeout.json。

范围与剩余：四张实际看过的图仅接受本核对卡。真实provider/新库冷恢复、SQLite事务异常回滚有证据；不声称日常人工、OS强杀、安装或无VPN已验。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

Runtime/Last verified commit：旧日常main PID37732正常CloseMainWindow退出；npm start exit0，单个日常main PID49296（2026-10-06T02:10:40.669019+08:00）加载默认out/main/index.js，逐文件SHA匹配最终build-c。未注入或读取日常事实，日常DOM/人工未验。HEAD90d67381a08db8ba040211921288b55c87de3f55；MasterSHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/网络/VPN或第三方工作树。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 原测验格式能力复用（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05第2项DOING，完整Goal ACTIVE。上一轮为真实进展，其题库来源接缝6/99/146/8/207和4图报告本轮只读复核，未冒称重跑。

Evidence：npm run verify:deeptutor-question exit0；build/typecheck0、统一108/108（Q99ECJ，含9项新增原函数/真实进程/坏源码/取消等，与既有教育/SQLite/IPC/Pi回归）、renderer146/146。固定341文件/SHA fdda34a0a700f51827110cc796dd6992ce6f40fbcf0f758991665b380fec5f3c，out一致。精确源码/许可证/AST检查/命令/报告/边界：apps/desktop/test-results/goal/dt05-quiz-20261006/closeout.json。未改UI，renderer字节与上一轮build-a完全一致；本轮未执行新候选真实provider/页面/图审，也不以旧207回归代替新功能验收。

Failed：本轮最终门禁无失败；最初graph查询未带project与猜测不存在capability-worker.ts只读已更正，未影响源码。对已有graph行号不能当当前上游固定源码；最终原Git对象与AST函数体逐一比较。模板与校验规则不应由模型改写，格式有效不等于事实正确。Blocked：无当前功能外部阻塞；HeroUI MCP gateway transport失败，已有授权组件可复用，不因此停止；既有audit5发布项仍OPEN。

Runtime：npm start exit0，旧日常main正常退出后单个main PID37732（2026-10-06T01:12:59.463429+08:00）加载默认out，与固定build-a一致；未读取/注入日常事实，日常DOM/人工未验。Last verified commit 90d67381a08db8ba040211921288b55c87de3f55，MasterSHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 真实题库来源接缝（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05 DOING，第1项真实题库来源接缝限定接受；完整Goal ACTIVE。

固定337文件/SHA 674fc8daf1620bfcba385a31f4fe12da9d8326c1993314d292367c494e9134d3；build/typecheck0、统一99/99（pvBYRJ）、renderer146/146、Pi协议8/8（CKxuuD）、当前唯一Pi/真实DeepSeek题库6/6（yTcdQR）、相关历史回归207/207。rendererErrors=0；浅暗1366×768/1920×1080共4张来源页图实际逐张查看，中文题干/答案/解析与关闭控件可达，无横向溢出，仅接受本来源对话框，不接受完整Codex像素/原生动态。精确命令/源码SHA/构建/报告/失败留存：apps/desktop/test-results/goal/dt05-question-20261006/closeout.json。

Failed已修复并保留：prepared数组隐式类型、Object.hasOwn旧lib、boundary静态import先于源码loader；真实LK1TmY收藏断言误用不存在aria-pressed，改核真实aria-label后6/6通过，应用无需改。教训：按实际可访问控件验收，不为测试虚构DOM属性；事实版本与收藏覆盖层分离。Blocked：无当前外部功能阻塞，既有audit5项发布门禁保持OPEN。

Runtime：npm start exit0；旧日常main正常退出后单个main PID53792（2026-10-06T00:56:27.718815+08:00）加载默认out/main/index.js，与上述固定build-a逐文件SHA一致。未注入日常事实；日常DOM/人工未验。HEAD90d67381a08db8ba040211921288b55c87de3f55；MasterSHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/网络/VPN或第三方工作树。

下一唯一教育任务：DT-05第2项，固定DeepTutor纯测验归一与协议Adapter→唯一Pi可编辑题目/练习候选；第3项同一确认账本教师编辑/确认/原子题库和练习保存及父子谱系（先冻结增量兼容迁移合同）；第4项传统练习/路径/实际结果；第5项完整DT-05与Golden C/F，再MA-01至05→JOIN→Phase6/7/8。完整DeepTutor、OpenMAIC课堂、日常人工、完整Codex/Golden/安装/无VPN仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

固定337文件/SHA 41e083651dd0e72e308a2bf9ed1b26715128909db0ca506574bd768d012a62c3；build/typecheck exit0、统一89/89（JC5UXh）、renderer142/142、当前唯一Pi/真实DeepSeek学生计划14/14（gsPCmm）、rendererErrors=0。12张浅暗1366×768/1920×1080截图逐张查看：计划、结果表单、重新规划后实际结果，控件可滚动到达且无横向溢出。历史回归207/207在build-a通过，发生于逐条证据目录/参数修正提示补充前，仅作相关旧教育回归。完整命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-workspace-20261005/closeout.json。

接受范围：当前唯一Pi生产构建与真实DeepSeek的DT-04限定闭环。最终14项包括传统入口/来源、取消/未来拒绝/防重、历史提示、草稿不自动发送、实际核对/再规划、冷恢复、旧路径及另一学生空范围。真实模型错误来源/参数与测试定位红灯已保留并修复。无skip代替成功；相关207属于旧教育回归。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 当前 DT-04 限定接受

固定337文件/SHA 8af8cd343bcc97c858f266eafcabc7ad57fe3fc32aefc4c662860b1e00dd186b；build/typecheck0、统一81/81、renderer137/137、当前唯一Pi/真实DeepSeek训练9/9（education-journey-2yywL7）、相关历史回归207/207。rendererErrors=0。浅暗1366×768/1920×1080共12图逐张查看，分别定位训练字段与核对页尾，窄窗正常滚动可达、无横向溢出；不接受完整Codex像素/原生动态。精确命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-training-20261005/closeout.json。

Goal ACTIVE，Phase4/5 DOING。DT-03学习评估/复习策略领域按既有七项合同限定收口：原GwcHvH11、1DXgrz10、pvhhdt6、d2XYcU76报告本轮只读复核，结合当前81边界与旧v1档案恢复；不冒称全部实例本轮重跑。DT-04整体DOING，十四天提议/编辑/确认/恢复核心切片已接受。

下一先贯通既有学生“学习计划”入口读取同一已确认计划及陈旧/空/失败状态，再补教师友好的结构化实际学习结果录入与重新分析/继续训练，不开第二事实库、不把安排当完成；然后DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8。完整Golden F、DeepTutor全模式、OpenMAIC互动课、日常人工、像素/动态、安装/无VPN与既有audit5项仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 当前包切片与取消门禁

本轮当前固定62640cd5，包功能7与学习并发6真实DeepSeek实例接受；统一76、renderer133、web15、settings19、hostLock6。8当前图实际查看，历史207仅回归。精确证据apps/desktop/test-results/goal/pi-packages-20261005/closeout.json。完整Goal/安装/无VPN/全Codex仍OPEN。


## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：实际融合程度逐项对齐官方清单，见CAPABILITY_MATRIX/EDUCATION_BRANCH_TODOLIST最新功能表；既有检索/引文/学生上下文/算法/教师核对与历史已融合，完整测验、学习路径、两周训练、视频及互动课未完成。本轮修复恢复旧会话时先写入后校验的问题：全部学生/学习/核对范围和工具先验证，复用Pi公开解析及内存SessionManager迁移后才持久打开；未知分支/版本、错学生、移除或错工具拒绝且JSONL字节不变，未绑定普通聊天保持空范围。无需新依赖/Schema/Store/循环。

Evidence：固定337文件/SHA 806bfe0dfc046374c13ef86434ca16e55193c09621a2b76582b7e5cea6b30df4，build/typecheck exit0、renderer133/133、统一边界64/64（新增7项原生身份）、本轮真实DeepSeek教师核对/冷恢复/事务退出回滚11/11、历史回归207/207。正式4次隔离Pi启动、rendererErrors=0；4张当前浅暗双尺寸图实际查看，1366暗图确认按钮需卡内滚动，本轮不接受完整Codex动态/像素效果。完整命令/报告/SHA：apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/closeout.json。

Doing/Next：生产宿主并发取消/确认门禁→完整DT-03逐条接受→DT-04两周训练（真实证据→教师修订确认→本地计划→冷恢复）→DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8；Phase3UX欠项保持OPEN，不转回模拟样例或只做底层测试。

Failed：前置测试脚本转义/重复导入已修，最终上述门禁无失败；旧失败报告保留。Blocked：无当前外部阻塞。

Runtime：npm start exit0，默认out与固定构建一致；单个日常main PID60468创建于2026-10-05T21:07:20.5459380+08:00并加载默认out/main/index.js，未读取或注入日常事实；日常DOM/人工、安装/无VPN与完整Golden仍未验。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

以下保留历史，当前状态以上述记录为准。


## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

固定337文件/SHA 7d5299a4beea1317bc791a7da1e02081253b6ab1f2b588a1f2ea269180217a5b；build/typecheck exit0、统一领域边界57/57、renderer133/133、正式唯一Pi真实DeepSeek历史10/10、相关历史回归207/207。两次正常冷启动；4张浅暗1366×768/1920×1080图逐张实际查看，均为当前新五空间。207历史legacy画面仅作回归，不作新版UI证据。

真实实例 apps/desktop/test-results/education-journey-1DXgrz/report.json，边界 apps/desktop/test-results/education-boundary-FQ7cOz/report.json；默认out逐字匹配。跨会话历史子集接受；完整DT-03、native身份/生产宿主并发取消、Phase3欠项、日常人工/安装/无VPN/完整Golden未接受。

以下保留历史，当前状态以上述记录为准。

## 2026-10-05 学习校正与复习策略（本轮）

当前固定337文件/SHA ee4872bd4f5e66c8ddee8906fc7da5a766d47168f23721fc6fbdb50de9400c67：build/typecheck exit0、统一边界51/51、renderer133/133、正式唯一Pi真实DeepSeek教师核对/策略/事务强制退出+正常冷恢复11/11、207相关历史回归通过。4张浅暗双尺寸图逐张查看，首轮确认后实际再读教师最终校正而非复述初始建议。报告apps/desktop/test-results/education-journey-GwcHvH/report.json；完整DT-03/Goal仍DOING/ACTIVE，跨会话历史、新native身份与宿主并发取消、日常人工/安装无VPN未验。失败实例完整保留。精确命令和报告hash见teacher-review-closeout.json。

以下保留历史。


## 2026-10-05 DT-03 原学习算法与真实证据（进行中）

Current Phase：Phase4/5能力支线 DOING，完整 Goal ACTIVE。Current Task：DT-03；合同 docs/goal/PHASE4_LEARNING_STRATEGY_CONTRACT.md。

Done：固定 DeepTutor f07029cfcf2c8dfccdb671cdfc343db8334f5741 原 mastery/scheduler/grading/policy、必要 DTO 原字段与 Apache-2.0；6文件78198字节逐字复用，无 npm/pip 依赖。复用 reading 宿主的受限 Python Worker；一致 SQLite 全记录快照不静默截200条，strict 显式证据/有效时间/作废/跨科隔离。原算法掌握度、预计保留率、遗忘风险、到期顺序及同证据v1差异通过唯一Pi工具读取。新学生页保持，工具来源沿既有typed入口回读。

Doing：实际评分/错因建议与教师编辑、确认、拒绝、同库原子事务/版本回放/崩溃恢复；这些未交付前不能接受完整DT-03。默认复习保留率0.9目前是只读估计，教师策略还未可编辑。启发式grading仅本地适配，尚未作为正式可纠正UI能力开放。

Failed：首次 policy AST 漏普通 Assign 常量，已修并实跑；只读实例 lSmXj8/t02tKp 虽自动7项通过，人工回答复核分别发现自填确认标记被升格/质性子集重复计数，以及全正确记录被描述为非正确风险依据，均不计最终接受。修正确认来源、实际lastOutcome和条件风险解释，保留报告。首次英文公开说明仍是Phase3未解决项。

Blocked：无当前本地推进阻塞。Next：完成同 ai_confirmation_items 的独立 learning action/Service/Repository→strict mainFrame IPC+typed preload→同新版工作台教师核对表单→确认+注释/策略同SQLite事务→实读来源版本校验/并发/停止/冷恢复；不改原学习FACT。然后DT-04/05→MA-01至05→JOIN→Phase6/7/8。

Evidence：本轮最后build/typecheck exit0，337文件/SHA42af3d9b333e6c6e39a267d2ea3bb8df134b19c693a04c7254aa640cf46c7568，固定副本 apps/desktop/test-results/goal/phase4-learning-20261005/final-build。38统一边界 education-boundary-9HNFfM、renderer133/133；正式Pi真实DeepSeek只读7项 education-journey-xBepFt，来源/空档案/冷恢复通过；4张浅暗双尺寸图实际查看，人工核对教师确认来源/计数/近期结果语义。默认入口8项 daily-entry-sFaBVy，4张新版学生图已逐张查看；固定337文件构建历史回归207项通过（historical-report.json），旧版截图不作新版验收。npm start exit0，日常PID57056加载默认out/main/index.js，重建后SHA仍相同；日常DOM/人工/安装/无VPN未验。完整DT-03教师写入仍未完成。未提交/push、改凭据或日常事实。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。以下保留原历史。


## 2026-10-05 用户确认新版学生页：识别与实例复核

默认 out 正式 Pi 隔离实例 daily-entry-jYAstN：8/8、success=true、exit0；通过界面创建学生/记录、SQLite回读、冷重启一致、重复启动保持一个窗口。4张学生浅暗1366×768/1920×1080截图已逐张查看；build/typecheck exit0，renderer133/133。当前构建329文件/SHA 165fb35efc0ffef86ad3e840009b9310dcb0a03ad60e7027791fe74a5a65efee。日常PID62836当前路径仍为默认out；没有读取/写入日常事实，日常DOM/人工仍未验。

完整Goal、无VPN安装、日常人工与其余Phase3欠项仍OPEN；完整AI能力下一DT-03。

以下既有记录保留原历史范围。

## 2026-10-05 DT-02 学生上下文与新版页面（最新）

最新限定证据：docs/goal/PHASE4_STUDENT_CONTEXT_ACCEPTANCE.md与apps/desktop/test-results/goal/phase4-student-context-20261005/closeout.json。最终build6 25边界/133组件/真实DeepSeek9学生场景/冷图审2场景8图/真实队列键盘16/队列边界9；build5相关控制30、历史回归207且main/preload与build6逐字一致。保留3份队列鼠标失败，不能用键盘通过宣称鼠标稳定性。日常仅启动进程与out指纹已核，人工/安装/无VPN/完整Golden未验。

以下既有记录保留历史范围，当前状态以上述记录为准。


## 2026-10-05 DT-02入口修复与新版页面统一

最新入口/版本基准证据：docs/goal/PHASE4_STUDENT_CONTEXT_ACCEPTANCE.md与apps/desktop/test-results/goal/phase4-student-entry-20261005/closeout.json。7正式Pi场景+5实际图审接受；207是历史领域兼容回归，旧图不作当前UI证明。日常launcher/process/read-only构建指纹已核，日常DOM/人工未核；DT-02-context/Golden E/F仍OPEN。


## 2026-10-05 DT-01b 正文搜索与来源定位

最新阅读专项入口：docs/goal/PHASE4_DT_01B_ACCEPTANCE.md及apps/desktop/test-results/goal/phase4-reading-search-20261005/closeout.json。最终18边界、133组件、12相关回归、7真实实例、9实际图审；全套smoke学生保存反馈失败仍OPEN。只接受本切片自动化/静态可读可达，完整教育Golden、日常、人工、安装不在范围。

历史条目保留原范围；当前进度以上述记录和 Master 为准。

## 2026-10-05 能力支线恢复与 DT-01a 引文核验

真实证据入口：docs/goal/PHASE4_DT_01A_ACCEPTANCE.md及apps/desktop/test-results/goal/phase4-capabilities-20261005/closeout.json。静态截图明确finite animation推进；只接受本切片结果可读/控件可达，不冒称全UI/动画/日常/安装。

Goal ACTIVE。按本轮用户纠偏，当前工作转为 Phase4/5 能力支线；Phase3欠项保留OPEN，不因切换优先级记完成。详细顺序：docs/goal/EDUCATION_BRANCH_TODOLIST.md；当前限定验收：docs/goal/PHASE4_DT_01A_ACCEPTANCE.md。

Done（限定A/C）：固定新版DeepTutor源码的只读引文核验已接 Pi / EducationCapabilityProvider，真实DeepSeek正反核验、持久结果与冷恢复通过；11边界、12相关工具回归、133组件、正式Electron4场景及5张静态图审。原Python源码/Apache许可证逐字复用，无第二Loop/Store、新依赖或Schema。学生个性化/Golden F、OpenMAIC SDK/Golden E仍OPEN。

Next唯一：DT-01b，复用同一原版search_units补全资料正文搜索与来源定位；再DT-02学生真实事实→DT-03掌握度/复习→DT-04两周训练→DT-05题目/学习路径；随后MA-01 DSL本地合同→generation→renderer→编辑/导入→真实互动课堂。不能回到旧模拟样例兼容循环。

Failed/Open：原legacy全套smoke最新exit1（题本SQLite回执早于React显示）；两处断言已改为等待真实DOM，未全套重跑，不能声称207通过。Phase3完整39项、备课本全图审/整体验收、完整Goal/无VPN/安装/许可安全/人工仍OPEN。正式首4次图审失败与第五成功均保留；最后一次最终构建验收报告见closeout，不能宣称连续稳定。

日常版本统一：npm start/根启动小智.cmd先成功构建后开当前out，旧dist可恢复归档，release不跟随旧dev URL，单实例聚焦/版本变化重启；owned验收窗口隐藏。此前日常入口5/5有限验收、两图审及备课本独立8场景通过，不代表完整Phase3。默认out本轮有意更新；未清空日常事实、改密钥/供应商/DNS/proxy/VPN或提交/push。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55，工作树保留既有改动。

## 2026-10-05 P3-04：资料收录、全量目录与真实正文工具接受

收口复核：verify-closeout实际exit0，核186个源码/归档/日志/截图指纹及14份当前文档；git diff --check实际exit0，仅现有LF/CRLF提示。首次verifier把分页阶段121误当作所有测试结束后的目录总数；取消/冷恢复各增加一份，最终readback为123份。保留verification-first.log/.exit，按真实阶段分别核121分页与123最终事实；未改变生产代码、正式报告或manifest。

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-04仅资料收录、全量目录与正文工具实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。以下为当前生效状态，后文各轮记录保留历史范围。新接口只取真实本地事实，旧模拟业务兼容与测试样例书专项不再投入，不自动补回演示种子。

Evidence：固定build9，323文件/SHA 52d6321cd1b974c26ae4ce8c06459bb157744a1660851d54475893780e193f9e；正常build/typecheck exit0，renderer129/129、资料/Office工具边界12/12、真实DeepSeek正式Electron工作台31/31、原教育隔离legacy-test回归207/207，均独立exit0。31项report.success=true/rendererErrors=[]，四次实际独立profile启动、当前构建/脚本指纹与main已加载模块核验；207本轮确实在最终build9重跑，不能作为新教育黄金闭环。37最终PNG归档，其中21张逐张视觉审阅，覆盖本轮资料空/正文/失败/冷恢复及正文工具浅暗1366×768/1920×1080；其他16张只归档。本轮控件可达/可读，不宣称全部Codex像素一致或全页WCAG。归档：apps/desktop/test-results/goal/phase3-ingestion-20261005/closeout.json，SHA 36d6820c3685aef39c4c6b6f85a38efbb1ab11ef7f1d513b29b09d1ae7238585；精确命令与失败见PHASE3_PRODUCT_SPACES_CONTRACT。

Failed（全部留存）：PrB89J 0项后因Repository在dataRoot赋值前初始化，移到constructor；LwD9Tx 18项后PDF自然换行使证据编号断言误报，仅规范断言空白；2Q5uin 20项后误用聊天零溢出断言检查传统页，改实际产品控件几何，同时修轮询query闭包；cUgoPK 21项后分页数字先于数据回执、旧行仍可点，生产隐藏旧行/禁用翻页并核已接收offset；P3gEz1 29项后实际正文调用成功但新工具公开标签仍泛化，修生产projection中文标签。KccQ9H虽31项通过，SQLite最终assistant暴露只读检索摘录、未读资料正文，作为不足断言留档，不接受；追加上述两工具并强化持久最终回答+实际成功正文工具断言，最终Ab1CP5 31通过。未修改模型输出来迎合测试，不宣称三次连续稳定。

边界：PDF只接受已验证文本层路径，扫描OCR未完成；旧doc/xls/ppt不支持。目录查找按全库名称/格式，不是资料全文搜索；Unicode归一仅查询侧，SQLite lower不承诺全Unicode等价。原生选择单批50文件、既有15秒/50MiB输入/1MiB解析输出均为工具边界，不是运行预算。资料收录不等于教师确认；失败保留旧已提交派生正文且不伪称ready。教学Office产物目录仍最近100份，完整分页待后续合同。日常安装、无VPN、WPS版式、人工、全Codex体感、安全/许可、完整教育Golden均OPEN；未以隔离验收替换日常out。

Next：P3-05，整理传统备课、讲义、题本与学生页面的教师操作体验，盘点实际 typed 入口、业务事实和失败状态，先冻结增量合同，再逐切片实现与验收；随后完整Phase3验收，再Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。Pi保持唯一生产编排。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55。本轮开始HEAD为20aa86656cdb5a0f85e0e11fa21863b50233fcb1，执行中观察到外部提交推进，保留其内容；本Agent未提交或push。Master2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302保持。daily out323文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981本轮未变；P3-03曾意外重建并精确恢复的历史保留。没有新Schema/依赖/vendor/密钥/供应商/系统DNS、proxy、VPN变更，没有清空日常数据。


## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。

固定build4：324文件/SHA 52d657eb2cae96eaeee305aca02ef1fe061fe547eb52c80ec92e713ff99a42fe；正常 build/typecheck 实际进程exit0，日志build4.log；renderer123/123 exit0；真实DeepSeek/Pi正式Electron工作台18/18、Office及目录45/45，均exit0/report.success=true/rendererErrors=[]，同一固定build与当前脚本SHA。实际8次独立userData/sessionData与main已加载模块核验，无旧test-runtime；最终38 PNG逐张查看（工作台21、目录/当前预览/冷恢复17），浅暗1366×768/1920×1080，本轮控件可达/可读。目录标题测量light11.65/dark13.07，只表示已测标题，不是全页WCAG证明。原教育隔离legacy-test回归207/207、suite.ok=true、独立exit0，在build2执行；build4只改生产导航归一与清除旧定位提示，main/shared/legacy业务不变，不冒称207在build4重跑或新教育闭环。证据/源码副本/失败报告见 apps/desktop/test-results/goal/phase3-materials-20261005/closeout.json；manifest SHA 278185debf61bf5944a97e91153740a2b7914b57c648c31d13647c42af82d8dd。

本轮 npm run test:smoke 内部先执行 npm run build，忽略隔离验收构建env而短暂重建默认out。发现后核历史逐文件SHA，找回全部323文件，先将意外重建版本改名保存在owned/daily-rebuilt，再恢复原out并核总SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981；详见daily-restoration.json。不能说daily out从未变化。未触及用户日常数据/profile、密钥、系统DNS/proxy/VPN；未提交/push。以后需要保留日常out时必须显式owned build +直接 node scripts/electron-smoke.mjs，不能用会隐式重建out的npm wrapper。

首失败均在本轮closeout保留，非三次连续稳定。Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

固定 build5：324 文件，SHA 335e3ffc90b7d88d0bade37a5ad1c1f30d506c3184b235ff774123e433b7e3b6。正常 build/typecheck exit0；renderer 115/115；正式真实 DeepSeek/Pi 工作台18/18、设置39/39，均 exit0/report.success=true/rendererErrors=[]，同一构建与当前脚本 SHA；实际6次独立 userData/sessionData 与main已加载模块核验，未加载旧 test-runtime。最终工作台21 PNG逐张查看，覆盖五空间浅暗双尺寸1366×768/1920×1080、冷恢复；只接受导航、连续性与本轮控件可达/可读，不代表传统页面整体设计已完成。设置专项全部PNG归档，未宣称逐张人工审阅。 原教育207本轮build4隔离回归并注明非build5重跑；本轮门禁限定导航/连续性，非完整Phase3/Goal。三首失败保留，证据apps/desktop/test-results/goal/phase3-spaces-20261005/closeout.json，精确命令见PHASE3_PRODUCT_SPACES_CONTRACT。Next P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

本轮正常build/tsc、renderer111；确定性边界39+11、无预算4；真实DeepSeek/Pi控制30、保存工具16、自动整理21、浏览器20，共87项及26最终PNG逐张审阅、12实际独立启动。首浏览器白名单误报保留，修后20项；前轮相同生产/build的207教育与17正式仅复用证据未重跑。Phase2实现A/C接受，完整Goal/日常/人工/发布仍未接受。详见Goal PHASE2_RUNTIME_CONTRACT、ACCEPTANCE及apps/desktop/test-results/goal/phase2-accept-20261005/closeout.json。Next P3-01五产品空间。

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

固定 owned build3：323/SHA 81acedfc0e0cad93d3a7d30189c83792a1b160406fa9f5b19789b0175d7c17fe；正常 build/tsc exit0，renderer111/111，运行边界22/22，原教育207/207（另核实际 profile 与 legacy-test），正式真实 DeepSeek/Pi UI vazbqj 13/13、rendererErrors=[]。最终10 PNG逐张读取；准备/失败浅暗双尺寸8处正文对比最低5.39336466369807，旧历史与实际教学回复2图。发送清空、唯一 succeeded Pi run、冷重启无再投递。详见 docs/goal/PHASE2_P2_01_ACCEPTANCE.md 与 apps/desktop/test-results/goal/phase2-runtime-20261005/closeout.json。

新真实用户路径：启动prepare/error/retry/leave、侧栏旧对话无重放、env=0真实Pi教学回复与冷恢复。原教育207在明确隔离legacy-test运行；不能充作正式Pi教育能力验收。

Next：P2-02旧 Console/直接请求兼容 Facade 到同一 Pi，先请求校验、单次投递与原 AiConsoleRunResult 接缝，再续跑/停止/问答/重试。禁用旧入口不等于教育能力迁移完成；P2-03重复装配退役、P2-04完整阶段验收随后。

## 2026-10-05 Goal主线恢复、Phase1整体验收与Phase2入口

Goal ACTIVE；Phase1 Master九项主工作台完成实现层A/C验收（非完整Goal/发布/人工接受）；Current Phase：Phase2 Pi Runtime Consolidation DOING。

生产只加OfficeMarkdown薄适配器：沿原Pro StreamMarkdown/CodeBlock，pre恢复Streamdown2.5 data-block标记；app-owned CSS绑定原Shiki双主题到现有workspace media/semantic色。原vendor未改，无新依赖/Schema/IPC/model/权限/预算/上传变化；原OfficeConversation仅替换import/调用。inline、JSON fence、无语言fence、部分stream、HTML escaping边界5项加入原组件suite。

最终固定隔离build2，323文件/SHA 35c105f473b34db2ccdb7050b31a776294f0ba019a65f7b5fa70e56da612fdaa，正常npm run build含tsc exit0；renderer111/111，原Shell真实Pi/DeepSeek 1IvLdM 15项、原控制tc9lZN 30项、原教育主流程207均exit0，两个UI报告rendererErrors[]且绑定同build/script SHA。当前实际审阅9PNG：Shell浅暗双原生1366×768/1920×1080+dark cold5，原问答/驻留计划/补充/停止4。Shell35关键文字/代码标签/全部实际token颜色对比≥4.5，最低5.329007293127842；表格与真实渲染JSON实读核随机编号/37/8/分数课堂，冷恢复不重放。保上一轮文件32和Office28有限A/C原报告；各自所有冻结生产源码SHA当前相同，本轮未伪称重新执行。九项映射详见PHASE1_ACCEPTANCE_2026_10_05.md与owned results.json。

首次2LZ7WT：真实fence误渲inline，修兼容接缝；fZwHSm：原runner硬编码旧304/62而当前254/52，按当前布局事实修断言保滚动/可达/不裁切；u9Lu08：误要求持久化files:false，原schema只保存files:true，读端默认false，修测试保完整冷恢复。s5JOqA功能15成功但实际dark图审代码低对比，退回补原主题接缝和全部token断言；均保报告/PNG/日志。不删除首次失败，不追认为三次连续稳定。先前学生保存success提示间歇失败保持OPEN，当前main207通过未改学生源码，列Phase7稳定性欠项。

Next：Phase2 P2-01：按已核实旧IPC→Console/Graph/sidecar入站清单冻结RuntimeAuthority与兼容合同，移除正式环境回到旧编排的开关，逐条将旧聊天/续跑/停止迁移到Pi；保确定性教育Domain、旧数据和传统页面。不得直接删除agent-loop.ts或整搬DeepTutor/OpenMAIC Runtime。见docs/goal/PHASE2_RUNTIME_CONTRACT.md。

跳过测试样例书专项，唯一主线Master Goal；不无限重验已通过Shell小片，不将Phase2–8能力倒塞Phase1。日常原反馈/配置D、无VPN/安装E、完整Codex体感与像素对齐、教育黄金A–G、云视觉、WPS本轮版式、安全/Pro分发许可及三连稳定仍开放。没有改变Master、HEAD、daily out/profile/key、系统DNS/proxy/VPN，无提交/push。本轮不估算缓存命中率。

## 2026-10-05 文件面板主题与真实导航有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅M01/M09/M10只读文件面板有限A/C通过，完整Master DoD不降低。

隔离build3正常npm build含tsc exit0，323文件/SHA 8f623c5ee2a3bb0c9cf7a81844221f9c9463b7c38fd778b26a60ff1dc5e6ded3。renderer106/106，原文件边界/真实IPC22/22，正式Electron文件UI d0GAsH 32/32 exit0、rendererErrors[]、remoteRequests[]；原教育主路径main2 207项exit0，均保首次失败。UI绑定同build/script SHA，保原25断言并补键盘tree/Tabs、真实拖动、损坏DOCX失败和实际重试、浅暗/错误/冷恢复；版本变化清旧正文后实际重读38、文件删除、未知/归档会话撤权、本地不存正文。测试采用合成文件/受控原生chooser，仅C，不含本轮真实provider任务。

已逐张审阅最终13PNG：宽面板浅暗双尺寸4、360最小面板隐藏文件树后浅暗双尺寸4、真实损坏Office错误2、磁盘版本变化错误2、cold当前文件1。content1366×768/1920×1080、DPR1.5；当前选中页签在原Tabs滚动区内有实际bounds断言，输入/页头/刷新/关闭均可达。57关键文字/按钮/placeholder对比度≥4.5，最低5.3017093866821705。窄面板文件树可隐藏扩展阅读，cold保授权和宽度并重读磁盘。未验证系统暗主题/forced-colors或全Shell像素一比一。

保留wu6ikR首失败：light filter placeholder对比2.771，语义色修复。DI9b2z虽32功能通过，但真实图审发现选中Tabs在缩窄/主题切换后被裁出，不作最终验收；CAll3y首次新assert用了不存在的class（测试选择器错误），rJ4tO1改为原ScrollShadow data-slot后真实复现可见范围超时。build3同断言32通过。原main1在学生保存success提示等待超时；实际截图档案已创建且反馈消失，main2未改学生源码207通过，间歇提示风险仍OPEN，不能写成已修复或三次稳定。

精确命令（cwd apps/desktop）：npm run build -- --config test-results/goal/files-panel-20261005/workspace-build3.config.ts → build3.log；npm run test:renderer-components → renderer3.log；node scripts/xiaozhi-agent/pi-workspace-files-smoke.mjs → boundary1.log；OMNI_EDU_TEST_BUILD_ROOT=owned/build3 串行 node scripts/xiaozhi-agent/pi-workspace-files-ui-smoke.mjs → files5.log；node scripts/electron-smoke.mjs → main2.log；node --check、git diff --check → final-check.log。build1/2、files1–4、main1和全部首失败报告/截图保留。

apps/desktop/test-results/goal/files-panel-20261005/closeout.json

下一唯一：Phase1按Master第2247段完成整体requirements与证据审计（sidebar/chat/composer/history/working/summary/plan/tool/progress/artifacts/files/approval/steer/retry/resume/compaction/model/skills/settings/glass）。先映射现有源码/固定build/各有限closeout，列最早缺口并完成正式实例与真实视觉，再决定Phase1接受；学生提示间歇风险列入主路径欠项。不得无限重复已关闭文件小切片或跳到Phase2。之后按Master执行唯一Pi runtime、五产品空间、教育能力/飞轮和黄金A–G。

日常D/用户原凭证联网图片失败、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS实际版式、安全与Pro分发许可保持OPEN。三元暂停；日常out/profile/key、代理/DNS/VPN、Master/HEAD及上一轮closeout均保持，未提交/push。本轮未新测或估算DeepSeek缓存率。


## 2026-10-05 公开中文与教师确认办公交付有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。完整Master DoD保持，本轮仅M01/M10办公交付事实与默认中文公开过程有限A/C验收。

最终隔离build2正常npm build含tsc exit0，323文件/SHA 10cfb5c7c1575437d971c7ebc3f7ce452ed9bd3a69b3535ccc601411d28ded58；renderer106/106、coordinator11、创建身份/保护索引6、原教育入口207均exit0。正式Electron/真实DeepSeek pi-office-artifact-ui-np8ArB 28项success/exit0/rendererErrors[]，绑定同build/script SHA。4格式教师改标题/末段/数值41、旧revision拒绝、实际DOCX/PDF/XLSX/PPTX生成/独立文件内容、版本谱系/来源conflict/停止/两阶段kill/再次cold均验；4公开回执不复述未收到的教师正文、旧37或猜41，cold文本完全保持。中文逐段检查为本批真实自然任务的有限证据，不能保证未来所有模型回复。207保旧教育入口，不证明唯一Pi已完成。

实际逐张审阅最终15PNG：审阅浅暗双尺寸4、编辑浅暗2、公开交付浅暗双尺寸4、四格式实际预览4、cold1。content1366×768/1920×1080、media浅暗、DPR1.5；交付回执清晰，1920可见教师确认41表格，1366正文在既有滚动区，页头/输入可达。22条关键文字/按钮对比度≥4.5，最低5.39336466369807。无新组件/样式，沿HeroUI卡/Markdown。未新验系统暗主题/forced-colors/全Shell像素完全一致/Office或WPS排版。

首失败ZRNVxh保留：公开Markdown文件名转义句点，原测试直接includes未转义名，SQLite已经保存正确回执；修测试编码断言，不改实际文件。yb94y1保留：真实模型识别来源已41而新请求37/旧标题的矛盾，等待教师澄清并非生成器卡死。扩展已有runner，经正式问答回答来源41保持、新拟内容按本次37/8要求后再由教师修改确认；不禁用澄清、不篡改材料或降低产物断言。coordinator1/2/3均通过，首两份是早期适配器版本，不当最终构建证据。

精确命令（cwd apps/desktop）：npm run build -- --config test-results/goal/office-facts-20261005/workspace-build2.config.ts → build2.log；npm run test:renderer-components → renderer2.log；node scripts/xiaozhi-agent/pi-office-artifact-coordinator-smoke.mjs → coordinator3.log；node scripts/xiaozhi-agent/pi-compaction-context-smoke.mjs → identity1.log；OMNI_EDU_TEST_BUILD_ROOT=owned/build2 串行 node scripts/xiaozhi-agent/pi-office-artifact-ui-smoke.mjs → office3.log、node scripts/electron-smoke.mjs → main1.log；node --check与git diff --check → final-check.log。原office1/2与报告、诊断及15图均留存SHA。

证据：apps/desktop/test-results/goal/office-facts-20261005/closeout.json。

下一唯一：Phase1 Files/Artifacts完整面板验收。既有FILE面板当前证据只有浅色宽窄；冻结现有Hana文件宿主、HeroUI预览/来源与当前主题复用合同，补文件导航、版本变化/损坏/失败返回、冷恢复、浅暗双尺寸与真实PNG，保只读权限和本地事实。完整Shell验收后进入Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮/黄金A–G。

日常D/用户原凭证联网图片反馈、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS排版、安全修补与Pro分发许可保持OPEN，三元暂停。未更换日常out/profile/key、代理/DNS/VPN或提交/push；Master/HEAD与日常out SHA原样，旧证据保留。本轮不新统计缓存率或承诺命中。办公公开交付采用可信回执，不宣称已把模型原始总结变成事实或解决所有自然语言幻觉。


## 2026-10-05 原失败会话创建指纹兼容有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅 M01/M10 已识别旧创建身份兼容有限 A/C 通过，保持完整 Master DoD。

固定隔离 build1 正常 npm run build 含 tsc exit0；323 文件，SHA 9d63bf140a710c4a1b889c587b2c27431fca70220151fabeea66a39c2a70e0ee。创建身份/保护索引边界6/6、renderer106/106、原教育入口207/207 exit0。原 pi-auto-ui-ik9wla/data 副本真实正式 Electron + DeepSeek：Abh1wh 20/20 success、exit0、rendererErrors[]，绑定构建与 runner SHA；未以 fresh seed 关闭旧兼容。207 为旧教育入口回归，不作唯一 Pi runtime 完成证明。

原任务验收码/年级在多次原生整理后保持；工具后同一公开 run 继续、整理中停止不提交、真实摘要响应后的提交前故障不写历史、native commit 后实际 kill/cold 标记 interrupted、显式新请求继续原任务而不重放写入，当前完整协议超容量仍拒绝。原3份 native 文件字节前缀与 education.snapshot/control 创建条目逐字节保持，source 哈希与实施前一致。

本轮实际逐张审阅 Abh1wh 全9PNG：整理完成4、真实整理中1、提交后继续工作4。native content1366×768/1920×1080，media浅暗、DPR1.5；页头/输入可达，工作行随真实原生状态改变。4条真实活动文字对比度最低5.39336466369807，均≥4.5。无新 UI 源变更；未新验系统暗主题、forced-colors、无backdrop、完整像素一致或Office/WPS排版。

原 aXLjJ8 报告保留为首失败；其已识别旧创建身份缺陷现为有限 A/C 已修复，未知配置依旧拒绝。本轮 boundary1 首失败是既有测试正则遗漏修改/产物字段；按实际5字段修断言，生产保护索引格式不变，boundary2 6项通过。其他历史失败不删除，单次成功不称三次稳定。

精确命令（cwd apps/desktop）：npm run build -- --config test-results/goal/compatibility-20261005/workspace-build1.config.ts → build1.log；node scripts/xiaozhi-agent/pi-compaction-context-smoke.mjs → boundary1.log（首失败）/boundary2.log（最终）；npm run test:renderer-components → renderer1.log；$env:OMNI_EDU_TEST_BUILD_ROOT=(Resolve-Path test-results/goal/compatibility-20261005/build1).Path；串行 node scripts/xiaozhi-agent/pi-auto-compaction-ui-smoke.mjs test-results/xiaozhi-agent/pi-auto-ui-ik9wla/data → auto-old1.log；node scripts/electron-smoke.mjs → main1.log；修改测试 node --check 与仓库 git diff --check → final-check.log。独立 prefix-readback.json 3项，closeout.json 绑定源3/文档13/构建/原报告/首失败/日志/图及原native前缀。

证据：apps/desktop/test-results/goal/compatibility-20261005/closeout.json。

下一唯一：Phase1 公开中文摘要与教师修订后事实一致性。先冻结当前实际旧37正文/已确认41文件差异与英文过程的交付合同，比较现有 Hana/Pi 公开事件、Office确认结果/产物回执，复用成熟接缝；以原真实教师编辑→确认→文件→公开回复→cold链路逐字段验收，不能用模型说已完成或测试回读替代文件真源。之后完成 Shell，再 Phase2 唯一 Pi runtime、Phase3 五空间、教育适配/飞轮/黄金 A–G。

公开英文摘要、旧37正文与教师修订41文件一致性仍 OPEN。日常 D/用户原凭证联网图片反馈、无VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS排版、安全修补与 Pro 分发许可仍 OPEN；三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常profile/key、系统代理/DNS/VPN或提交/push。缓存策略不改，本轮未新统计命中率，不将历史比例写成当前保证。


## 2026-10-05 真实工作过程有限切片验收与继续位置

完整 Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮只接受 M01/M10 真实工作过程的有限 A/C 切片。

最终隔离 build2 正常 npm run build（含 tsc）exit0，323 文件/SHA da1be87276cc8495e1b6de073657f5d7ff246699d19fd9064183f93ff22009a0；renderer106/106、原教育入口207/207 exit0。串行固定同一 build2：control D2k7nY 30、auto TnxVWr 20、Office msC1oS 26、queue LIx1cj 16，均 success/exit0、rendererErrors[]，绑定脚本与构建 SHA。207 是原教育入口回归，不是唯一 Pi runtime 完成证明。

正式 Electron/真实 DeepSeek：plan/question/steer/followUp/编辑/撤回/停止/crash/cold/自然澄清；多次原生自动整理、工具后同 public run 续执行、整理中停止不提交、失败前提交不写 history、native commit 后真实 kill/cold/new explicit request 返回原验收码和年级，原旧 source bytes 保持。Office 实际教师修订/批准/拒绝、DOCX/PDF/XLSX/PPTX 文件生成与独立内容回读、来源变更/版本冲突、停止和两种崩溃恢复通过；数值最终以教师修订41和真实文件为准。

实际逐张审阅最终26PNG：control4、auto9、Office11、queue2。native content1366×768/1920×1080×media浅暗，DPR1.5；queue仅浅色。活动行与等待/整理/真实工作状态一致，审批/补充关闭资料栏仍可见，输入与页头可达；停止/终态消失。关键文本对比度>=4.5，Office主题需等待真实150/250ms有限过渡完成；未禁用产品动画。系统原生顶部沿系统主题，未新验Windows系统暗主题/forced-colors/无backdrop/全页面像素一致。四格式预览是本地提取正文，不作Office/WPS版式还原或教学质量证明。

保全部首失败：aXLjJ8 旧创建快照配置不匹配仍 FAILED/OPEN；cHWws6 旧65536 E2E阈值容不下当前完整请求，测试提前阈值改131072，官方1048576和生产策略不改；5jenZk 可选私有notice断言过严，改实际tool→native compaction→final chronology；lQQ7lJ 四份摘要均含原码/年级但新回复只答“已阅读”，不能称摘要丢失，调整现有上下文/当前请求顺序后实际恢复通过；yeAVkk/e0KuiY 测试 disclosure与新旧run过滤问题；LYvsz0 oversized只读协议实际能容下，改真实UI授权工作区检验完整协议。Office a3RMrm 暗色编辑测在过渡中ratio1.60596，保失败PNG，补等待真实有限动画后再测。所有测试误判与真实失败单列，不以最终单次green冒充三次稳定。

精确命令，cwd apps/desktop：npm run build -- --config test-results/goal/live-process-20261005/workspace-build2.config.ts → build2.log；npm run test:renderer-components → renderer2.log；OMNI_EDU_TEST_BUILD_ROOT=owned/build2 串行 node scripts/xiaozhi-agent/pi-auto-compaction-ui-smoke.mjs test-results/xiaozhi-agent/pi-auto-ui-LYvsz0/data、pi-office-artifact-ui-smoke.mjs、pi-control-ui-smoke.mjs、pi-queue-ui-smoke.mjs、scripts/electron-smoke.mjs → auto8/office2/control2/queue2/main2.log；四个修改runner node --check、git diff --check → final-check.log。精确原auto命令由closeout.json记录。

真实 reported usage（排除auto副本继承30条旧run，未上报/停止分开）：control3个reported run缓存读入占输入87.08%；auto10个55.33%；Office7个94.65%；queue2个69.87%。分母=input+cacheRead+cacheWrite，input不含缓存读入；未报告分别2/3/3/3条，不按0补齐，不推算成本或保证未来命中率。原始可核验数字见usage-readback.json；原有稳定prefix与Hana/Pi缓存/压缩接缝保持，不为提高比例增加warmup调用。

证据：apps/desktop/test-results/goal/live-process-20261005/closeout.json。

下一唯一：先定位原 copied pi-auto-ui-ik9wla 会话的创建快照/配置指纹兼容失败（aXLjJ8），冻结可识别版本的迁移、回滚和原字节验收合同，再修复；不得用 fresh seed 通过关闭旧兼容、放松权限指纹或重写 native JSONL。之后补齐 Shell：中文公开摘要、教师修订后正文与实际文件数值一致；再 Phase2 唯一 Pi runtime、Phase3 五空间与教育能力/飞轮/黄金 A–G。

日常 D、无 VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS 实际排版、安全修补与 Pro 分发许可继续 OPEN；用户原凭证/联网/图片失败未关闭，三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常 profile/key、系统代理/DNS/VPN，未提交/push。


## 2026-10-05 联网与浏览器有限切片验收结果

M01/M10 本轮有限 A/C 验收通过；完整 Goal ACTIVE / Phase1 Codex Shell DOING / NOT_ACCEPTED。最终 build3 正常 npm run build 含 tsc exit0，323 文件 / SHA 64c478c6f816fdcaf58d3a2c99064a5acd8639c5c917b850677cee2727a808eb；renderer102/102、主教育入口207/207 exit0（旧入口回归，不是唯一 Pi runtime 完成证明）。native VI3QKb 23、正式 DeepSeek browser-delivery BdfOVS 20、web QbVOGi 22，均 success/exit0。两正式 UI 串行固定同一 build3，报告绑定 build/script SHA、无 renderer pageerror。

生产沿现有 Pi customTools、Hana v0.450.0 DOM/ref/wait/截图文件名与 Electron WebContentsView。删除截图前可能挂起的 renderer RAF 前置等待，原生 capturePage(stayAwake) 受15秒工具取消/超时、samePage/revision及文件hash校验约束；此为单次工具边界，不是运行预算。失败页复用 OSS Button，固定返回动作只被本地 status view 的 will-navigate 消费并关闭本会话窗口，保失败历史/其他会话，不重放模型或偷偷重新联网。截图 Modal 加同一主题边界。共享颜色 token 从 glass 抽为独立 theme CSS，布局覆盖仅留主入口；status HTML 与主入口同 HeroUI layer 顺序。无新依赖/表/共享 IPC/第二 runtime，自动压缩和无预算规则保持。

原 NET-01 自然语言真实搜索→教育部正文，区分正文落款2022-03-25/网页发布2022-04-21/2022秋季实施；原 NET-02 真实 DOM→截图保存/本地预览，实际 PNG 字节/hash与保存文件一致，坏文件重试/伪造路径/次级窗口拒绝；NET-03 关闭无实际联网工具执行、重开同原文实际读取；NET-04 执行中停止→冷恢复保来源/native prefix/偏好且零重放。来源点击到 main 的 native opener 经实际校验后被测试截获，不冒充已打开用户系统浏览器。

本轮实际逐张审阅最终13PNG：来源4、截图弹层4、失败返回4、真实浏览器原图1。真实 content1366×768/1920×1080、media light/dark、DPR1.5。28条正文来源/时间、顶部标题/侧栏时间、失败标题/说明/返回按钮实测对比度≥4.5，最低4.90069。系统原生顶部仍沿系统主题，Windows暗系统主题、forced-colors、无backdrop及全页面像素一致未新验。

首次失败全部保留：native1–13 的 RAF Timeout / raw spawn Viz crash / 实验启动参数 / vm dynamic import 失败记录在 owned日志及各原目录；临时 throttle/owner/zorder/GPU flags均撤回，最终 runner 复用已有 Playwright Electron 启动（未新增生产服务），两次完整native成功，硬件崩溃根因未确定，不外推所有设备。web yb1IbF 首断言过严（要求重开已知URL必须再search），改为实际联网读取且有官网来源；build2 web oU45EC 虽报告green，实际PNG白底浅字，判视觉失败，抽 token 修CSS加载顺序。build3 XQtFJM 15项后真实浏览网页 network 失败，后同代码 QbVOGi22完整通过；保原失败，不称已找到所有网络间歇失败根因或达到三连稳定。

依测试样例说明书仅有限 A/C，不关闭原用户日常凭证/联网/图片失败。D/E、三连稳定、完整 harness/办公四格式/云视觉、缓存命中率仍需独立真实验收；本轮未改变或重验自动压缩/usage策略。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1保持；未重启日常窗口、改 profile/key、系统代理/DNS/VPN或提交/push。

证据入口：apps/desktop/test-results/goal/browser-workspace-20261005/closeout.json，固定身份 identities.json、source-before/docs-before、最终报告和13PNG均 SHA 回读。精确命令（cwd apps/desktop）：npm run build -- --config test-results/goal/browser-workspace-20261005/workspace-build3.config.ts → build3.log；npm run test:renderer-components → renderer2.log；OMNI_EDU_TEST_BUILD_ROOT=owned/build3 串行 node scripts/xiaozhi-agent/pi-browser-native-smoke.mjs → native15-final.log、node scripts/xiaozhi-agent/pi-browser-delivery-ui-smoke.mjs → delivery-ui2.log、node scripts/xiaozhi-agent/pi-web-ui-smoke.mjs → web-ui4.log、node scripts/electron-smoke.mjs → main2.log；三个修改runner node --check、仓库 git diff --check → final-check.log。

下一唯一：继续 Phase1，冻结真实运行过程/确认/补充/自动整理的可见状态合同；按 VIEW-01/02 与 CTRL-01/02/03，用同一实际 Pi 任务核执行前摘要→工具→后续摘要、审批/补充、自动整理、排队编辑/撤回及双尺寸浅暗 PNG。复用当前 Hana/Pi 生命周期和 HeroUI 过程卡，不新增编排器。之后 Phase2 退役重复 runtime、Phase3 五空间及教育能力/飞轮/黄金 A–G。日常 D、无 VPN/安装 E、三次稳定、安全修补与 Pro 分发许可继续 OPEN，三元暂停。


## 2026-10-05 教师公开消息切片验收结果

M01/M10公开消息有限切片通过；整体Goal ACTIVE / Phase1 Codex Shell DOING / NOT_ACCEPTED。build1正常npm build含tsc exit0，323文件/SHA ba3913bf4ac71ddabd90ce9b612a85f2ee446690dc4f90a021e2ec951e3121fd；renderer102/102、主教育入口207/207（保旧入口，非Pi全runtime证明）。native21、最终附件UI iWd8da20、settings pwIw7239均success/exit0；两UI串行固定同build、各报告绑定脚本SHA，无renderer异常。settings实际保存safeStorage后两次官方DeepSeek HTTP200及第三次AbortError停止。

实际正式页面选择技能+合成附件，office_list_attachments/office_read_attachment完成并返回提示中未给的随机核验码/来源；SQLite保原命令及元数据、cold保原生文件字节，原附件预览/删除原文件/只附件发送/失败重试/等待停止/claimed实际kill恢复均通过。普通技能任务完成后实际手写/skill再发，原命令仍可见；归档读同公开原输入。native旧表重复迁移、trigger创建失败rollback、精确绑定/坏版本/getter不执行/hash冲突、两阶段kill各两次cold通过。

本轮实际审阅最终8PNG：附件原输入/附件卡/过程4、普通自动与手写命令对比4；native content1366×768/1920×1080×media浅暗，DPR1.5。附件首轮XB35Au19项green但截图滚到底只拍回复区，保原报告/图，不作公开气泡视觉证明；扩展scroll到用户节点并补失败技能重试后iWd8da20通过。其余设置/预览截图本轮未新逐张审阅；132条原关键设置/预览对比度>=4.5，不虚称新增气泡对比度已测。未新验系统暗主题/像素完全一致。

依测试样例说明书为A/C有限切片，不是日常D、无VPN安装E或连续3次稳定，不关闭用户原凭证/联网/图片失败。NET、cache命中、OCR/视觉/四格式Office及全harness本轮未重新验；日常out SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302及HEAD20aa86656cdb5a0f85e0e11fa21863b50233fcb1保持，日常profile/key不改，无commit/push。

证据入口：apps/desktop/test-results/goal/public-message-20261005/closeout.json。精确命令/日志：隔离npm run build -- --config test-results/goal/public-message-20261005/workspace-build1.config.ts → build1.log；npm run test:renderer-components → renderer1.log；node scripts/xiaozhi-agent/pi-attachment-send-native-smoke.mjs → native1.log；以OMNI_EDU_TEST_BUILD_ROOT指向build1串行node scripts/xiaozhi-agent/pi-attachment-send-ui-smoke.mjs → attachment-ui1/2.log，node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs → settings-ui1.log，node scripts/electron-smoke.mjs → main1.log；node --check两UI脚本与git diff --check exit0。

下一唯一：继续Phase1联网过程、来源预览与内置浏览器工作台验收。按测试样例说明书NET-01/02/03/04，核当前构建真实搜索→正文→浏览页面/截图→来源打开、错误/重试/停止/冷恢复与浅暗双尺寸；先比较Hana/Pi现有实现并冻结合同，复用现有工具/权限/浏览器宿主。原自动压缩、不设运行预算、国内DeepSeek保持；缓存命中率另以真实usage统计，不能拿提示词长度推算。之后Phase2唯一Pi、Phase3五空间与教育适配/飞轮/黄金A–G。D/E、连续三次稳定、Pro许可与安全修补仍OPEN，三元暂停。

## 2026-10-05 会话菜单切片验收结果

M01/M10会话菜单有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

最终隔离context-menu-20261005/build5正常npm build含tsc exit0，323文件/SHA5cf0d26962365242a2428652253c1ba5116713bcedd84368c45387251fc63b4c；renderer102/102（新增无document的Codex portal SSR边界）、主教育入口207/207本轮exit0。串行同构建menus-8PCpdS41、settings-Gee4lY35均success/exit0/rendererErrors[]，报告绑定build与脚本SHA；两修改脚本node --check和git diff --check exit0。207保旧教育入口，不作全Pi完成证明。

真实页面新建文件夹、右键/键盘改名、空名取消、owned SQLite trigger注入的真实IPC重命名失败/原值保持/重试、归档失败保确认及可取消、两类归档Escape恢复焦点、空文件夹确认归档、同profile冷启动保manual标题/归档/消息且零模型turn，草稿不被菜单操作清空。正式设置实际保存safeStorage配置后DeepSeek两个HTTP200、真实完成回复及运行中停止、对话确认归档后读历史并冷恢复，native原字节保持。

本轮实际逐张查看最终16PNG：会话/文件夹键盘菜单8、右下边缘4、归档确认4。native BrowserWindow content1366×768/1920×1080×media浅暗，DPR1.5；菜单宽220px、靠近锚点、边缘内距/按钮可达，归档焦点隔离。两专项156条关键文本/状态/菜单idle-hover对比度≥4.5，最低5.393。边缘坐标为真实行上的明确MouseEvent构造，滚动关闭为controlled scroll事件；不伪称人在屏幕角落找到会话或实际长列表滚动。普通右键、键盘和菜单外点击是真实页面mouse/keyboard；其余设置/入口菜单截图本轮未逐张新审阅。系统Windows暗主题、无backdrop引擎与完整Shell像素一致未新验。

首build1类型检查拒绝GridListItem.onKeyDownCapture，改侧栏捕获真实row；原失败日志保留。build2 QUXklW41之前38项green但实际4PNG发现裸菜单56px、角落总在左上，未作视觉通过：原测试dispatchEvent未构造MouseEvent且fixed受backdrop参照，修Portal/标准样式和真实坐标断言。build4 hGk60x6项后失败揭示主轴贴边内距不足，补锚点安全内距；build5 mRpW2J28项后locator点击被成熟浮层body拦截，改真实mouse坐标点击underlay验证关闭，未force穿透，最终41项完整通过。历史settings-xVOetE35/build2与旧截图保留，不冒充最终build5。文档备份首shell表达式多括号失败，修后保存13份未覆盖历史。

按测试样例说明书记录C隔离正式Electron单轮有限通过；不是日常D、无VPN/安装E、连续3次稳定，不关闭用户原凭证/联网/图片失败。联网、缓存命中率、OCR/视觉/四格式办公及全harness本轮未新验。日常out323文件SHA0dd7…、默认profile/钥、Master和HEAD保护，无commit/push；原Pro许可hold保持。

证据入口：apps/desktop/test-results/goal/context-menu-20261005/closeout.json；本轮构建/日志与原始专项report/PNG逐文件SHA回读，所有首失败保持。

下一唯一：Phase1教师化公开消息投影。最终真实归档截图仍显示自动注入的/skill:teaching-office命令；先核其编码与projection来源，复用已有消息契约，只在公开UI呈现教师原输入，保native原文、技能选择、来源与旧会话兼容，冻结后以真实发送/工具/冷恢复及浅暗双尺寸验收。随后补齐其余Shell状态，再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮及黄金A–G。D/E、连续3次稳定、安全修补和Pro发布许可仍OPEN，三元暂停保持。

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run build -- --config test-results/goal/context-menu-20261005/workspace-build5.config.ts
npm run test:renderer-components
$env:OMNI_EDU_TEST_BUILD_ROOT=(Resolve-Path "test-results/goal/context-menu-20261005/build5").Path
node scripts/xiaozhi-agent/pi-control-menus-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs
node scripts/electron-smoke.mjs
node --check scripts/xiaozhi-agent/pi-control-menus-ui-smoke.mjs
node --check scripts/renderer-component-state-test.mjs
# repo root: git diff --check
```

## 2026-10-05 设置与弹层切片验收结果

M01/M10设置、模型菜单、归档确认与附件/OCR弹层有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

最终隔离overlays-20261005/build4正常npm build含tsc exit0，323文件/SHA e249818fc7f70d701d70a869fc9e299d7a0f63a8924b6f7e2da55bc443fd2492；renderer101/101、主Electron smoke207/207本轮exit0。settings-hpdpHg35、OCR-KEhjBr12、attachment-AKqW6717、menus-H0jhuZ20均success/exit0，报告固定同一构建与脚本SHA；四修改脚本node --check和仓库git diff --check exit0。主207是原教育入口回归（Pi=0），Pi真实行为由专项验，不拿207当唯一runtime完成。

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run build -- --config test-results/goal/overlays-20261005/workspace-build4.config.ts
npm run test:renderer-components
$env:OMNI_EDU_TEST_BUILD_ROOT=(Resolve-Path 'test-results/goal/overlays-20261005/build4').Path
node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-attachment-ocr-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-attachment-send-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-control-menus-ui-smoke.mjs
node scripts/electron-smoke.mjs
# 四个修改脚本逐个 node --check；仓库根 git diff --check
```

实际逐张查看最终62PNG：设置六页/默认模型菜单/归档确认32，OCR4，附件标题/历史/图片及文本预览14，入口菜单12。light/dark×真实BrowserWindow content1366×768/1920×1080，DPR1.5截图2049×1152/2880×1620；关键操作可达、Modal键盘焦点隔离/Escape与工作区布局通过。176条关键文本/占位/菜单idle-hover/状态含透明度实测对比度≥4.5（最低5.393）。设置长表允许内部滚动，不称全部字段同屏；Windows原生菜单未验暗系统主题，不支持backdrop/forced-colors本轮未新验。

设置空环境Key/model的新隔离profile，经真实页面保存safeStorage配置后官方DeepSeek返回200，运行中主动停止记录AbortError并保同会话。OCR实际固定RapidOCR/ONNX可执行文件、教师拒绝/重试/校正，真实Pi/DeepSeek read仅收到已确认脱敏文字；原图/未确认原OCR不上传，原native前缀保留。真实子进程取消退出、冷启动删除原图后读取捕获副本通过。附件实际发送清空、重复/冲突、失败重试保新输入、切会话/删除原文件/冷恢复、教师等待停止与claimed后真实host kill恢复通过；合成材料与controlled chooser，不称人工点击系统对话框。

首次失败全部保留：ev7iE1启动等待超时（owned PID随后确认退出）；VRnyEb原构建暗设置白底。xsgo1h/a3AUmR虽35green，PNG发现搜索/悬停与技能状态过淡，未作最终视觉通过。S11EHK现代CSS颜色被旧测量器误读，改Chromium canvas转sRGB并纳入透明度；gkfjFf真实占位alpha对比度2.771，宿主修不透明。orPdU0模型菜单入口动画opacity0.03075、TtTuVO深色textarea转换中RGB135，分别等真实入口/子树动画完成后测，阈值未降。5fcrby17green历史1366暗截图拍到切换中的白输入和首浅缩略图未加载，保报告并加实际子树收敛/缩略图加载/placeholder断言，最终AKqW67完整17项过；不靠green忽略视觉失败。

依测试样例说明书记C隔离正式Electron单轮有限通过，不追认为连续3次稳定/D日常人工/E无VPN安装，不关闭用户旧凭证/会话失败。未新验联网、DeepSeek缓存命中率、办公四格式排版、扫描PDF/手写/数学视觉或全harness；那些范围继续按Master。日常out原SHA保持、未操作日常profile/钥，无commit/push。

精确证据与SHA回读：apps/desktop/test-results/goal/overlays-20261005/closeout.json；原始专项报告及首次失败独立目录保留，最终命令/日志见docs/acceptance/CURRENT.md。前面layout/标题/controls为历史，不覆盖。

下一唯一：继续Phase1，先冻结会话右键菜单合同，复用成熟ContextMenu/Menu适配器，补Shift+F10/上下键/Enter/Escape与焦点恢复、屏幕边缘避让及native浅暗双尺寸；当前仍是fixed原始div，不能因归档Modal已验就称会话菜单完成。其余Shell状态验完后再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；D/E、安全修补及Pro许可仍OPEN，三元暂停保持。

## 2026-10-05 布局与暗色控件切片验收结果

M01/M10布局与暗色控件有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

最终隔离layout-20261005/build5正常npm build含tsc exit0，323文件，SHA39efed9fca86c25a9d4a8fd9e298abf23d7958c3dcfc7c376d81ba48dd30f651；renderer101/101、主Electron smoke207/207。menus-GMkqc3 20、control-OBP44f 27、office-DsX0vl 24、files-ZpfW8J 25均success/exit0且无rendererErrors；四脚本syntax与收尾git diff --check exit0。前3份报告内嵌同build/script SHA；files既有报告无指纹，由实际启动OMNI_EDU_TEST_BUILD_ROOT及构建前后SHA绑定，不伪造报告字段。

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run build -- --config test-results/goal/layout-20261005/workspace.config.ts
npm run test:renderer-components
$env:OMNI_EDU_TEST_BUILD_ROOT=(Resolve-Path test-results/goal/layout-20261005/build5).Path
node scripts/xiaozhi-agent/pi-control-menus-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-office-artifact-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-workspace-files-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs
node scripts/electron-smoke.mjs
# 四修改脚本逐个node --check，仓库根git diff --check
```

本轮实际查看最终26PNG：菜单12、问答4、Office审批4/编辑2、文件面板4。1366×768/1920×1080是真实BrowserWindow content尺寸，截图DPR1.5为2049×1152/2880×1620；控件聚焦/展开与菜单Escape后壳无隐藏滚动、标题/输入/停止及审批操作可达。非禁用关键正文/编号/计划、菜单idle与鼠标hover、审批接受/拒绝及编辑字段实测对比度≥4.5。文件4PNG为浅色宽/窄，不能当暗色视觉证明；工作区dark由媒体模拟，不是Windows整机主题或无backdrop/forced-colors当前视觉验收。1366暗问答卡顶部允许随消息内容滚动，未声称全部正文同屏。

首次失败全部保留：原Va2mxP/question-1366x768.png裁切；本轮0l0sP9旧构建诊断未自然再裁切，但UkPoJY基线明确44px外溢失败。菜单qu36P1为ReactAria可访问名定位错误，78isaC为Escape焦点恢复异步等待不足，VqLI7H为真实暗模型标签黑字。Office WY6QHT首schema参数无效再有效proposal，被旧调用总数断言误判；只允许匹配的前置Pi validation-error，拒绝回执后不得再同路径调用且仅一durable产物。ylZcQQ虽然24项green，但实际截图暗拒绝与tab不可读，仍不作视觉验收；补语义token与审批按钮对比度后最终DsX0vl通过。原日志/构建/报告不删除，偶发自然裁切根因不能仅凭一次未复现就全部关闭。

依测试样例说明书按C隔离正式Electron记录，仅最终单轮通过，不追认为连续3次稳定，不关闭用户旧配置/会话失败。Office真实模型四格式生成、确认/拒绝、教师修订、来源CAS/版本冲突、实际kill与两次冷恢复、SQLite/file SHA及独立Python格式回读通过；本轮未新验WPS/Microsoft Office应用排版。文件面板无provider新请求；未借此外推NET/OCR/视觉或全harness完成。日常out323文件SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master与HEAD保持，日常profile/钥未改，无提交/push。

证据入口：apps/desktop/test-results/goal/layout-20261005/closeout.json；原始报告在apps/desktop/test-results/xiaozhi-agent上述独立目录，build5.log、renderer-build5.log、main-build5.log及四专项最终日志在owned layout目录。前面历史标题/controls/glass结果保留，以下新增记录为当前有限状态。

下一唯一：继续Phase1，冻结设置工作区、会话管理与附件/OCR弹层合同，核浅暗主题、错误/重试与可达性，再用真实native双尺寸验收。完整Shell后继续Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；日常人工D、无VPN/安装E、安全修补及Pro许可仍开放。

## 2026-10-05 自动标题兼容切片验收结果

自动标题本地fallback兼容切片有限通过；Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。普通append与附件原子publish共用conversationTitle，合法/skill前缀不挤占任务标题，保原提示词/Pi原生记录；不是新增LLM语义摘要命名。

M01/M10：ai_conversation_sessions增title_source（旧行legacy/新默认automatic/自定manual，任何rename设manual）；旧“新对话”来源无法推断，保原标题不重写。普通UPDATE按当前行来源与默认名决定，保并发教师rename。附件send增display_title默认空列；发布仍一个SQL statement原子提交，schemaVersion1/get旧command回执不变；trigger升级savepoint失败恢复旧trigger。无新依赖、公开IPC、运行预算、上传或第二runtime；原自动压缩保持。

隔离build1本轮正常npm build（含tsc）exit0：323文件 / SHA1b3337c466957afc1e87995ed3fa76d2e2a460c96e69a5df243b0cf5952db3a2。renderer101/101、主smoke207/207本轮exit0。native-KPb2Ns19、settings-JDjyZu34、attachment-EEZvgn17、rollback-read-jcrGqn1均success/exit0；UI串行同一build1。原样例CFG/CTRL/附件发送相关路径有限验证，NET/FILE实读与OCR/视觉不在本轮重跑。

native实际旧表迁移两次/中文英文emoji40码点/严格ASCII空格命令边界/原prompt/并发rename/真实旧trigger替换故障rollback/原原子失败/dup/CAS及claimed/committed实际kill两次重启通过。settings空环境Key/model、实际页面保存safeStorage配置后DeepSeek Flash真实200，运行中AbortError取消；自动任务标题、改回默认名后继续任务/停止/归档/冷恢复保手工名。附件页面技能首轮任务标题与原消息、清空/两尺寸/预览/原文件删除/切会话/冷恢复/仅附件发送/失败重试保新输入/教师等待停止/owned claim kill通过；文件对话框仅controlled owned合成材料。

实际查看8张本轮PNG：title/history/preview各双尺寸6 + models双尺寸2；标题侧栏/会话头显示任务正文、输入与预览可达。消息正文仍保原/skill指令，不据此声称教师化投影已经完成。1366历史首拍图片缩略图尚未加载、随后真实预览和1920缩略图正常，未将静态首拍当图片识别。问答顶部裁切、完整暗色与其他Shell状态仍待下一项；本轮未做整壳像素/系统主题/不支持backdrop引擎验收。

首native-IKAc3E exit1保留：测试初始化前误取尚未打开的DB，finally未判空又掩盖错误；改用独立真实sqlite3构造旧表、关闭后再store.init，close判空，完整19项重跑通过。旧 immutable build5在新测试数据的副本实际冷启动/侧栏读手工默认标题；原messages/send/native SHA及源测试profile事实不变。此证明旧版读取兼容，不证明旧版新任务仍遵循新标题规则或安装降级。所有首次失败保留，仅单轮通过，不称三次稳定。

精确证据与回读：apps/desktop/test-results/goal/titles-20261005/closeout.json；日常out/profile、默认凭证、Master和上游checkout不改，无commit/push。

下一唯一：Phase1专项定位问答/长过程中的Shell顶部裁切，冻结布局/滚动与完整暗色菜单合同，复用既有HeroUI/语义主题和原控制卡，以真实native双尺寸、可达性与PNG验收。完整Shell后再Phase2退役重复runtime、Phase3五空间、教育适配/飞轮/黄金A–G；日常人工D、无VPN安装E、安全修补与Pro许可仍开放。

精确命令（cwd D:/WorkProject/EduProject/apps/desktop；两个UI及main先设OMNI_EDU_TEST_BUILD_ROOT为绝对test-results/goal/titles-20261005/build1）：

- npm run build -- --config test-results/goal/titles-20261005/workspace.config.ts → build-first.log / exit0
- npm run test:renderer-components → renderer.log / 101/101 / exit0
- node scripts/xiaozhi-agent/pi-attachment-send-native-smoke.mjs → native-second.log / 19 / exit0（native-first.log首fixture错误exit1保留）
- node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs → settings-first.log / 34 / exit0
- node scripts/xiaozhi-agent/pi-attachment-send-ui-smoke.mjs → attachment-first.log / 17 / exit0
- node scripts/electron-smoke.mjs → main-smoke.log / 207/207 / exit0
- node test-results/goal/titles-20261005/rollback-read.mjs → rollback-first.log / 1 / exit0（脚本只复制owned数据并用前一build5，不读日常profile）

以上日志位于apps/desktop/test-results/goal/titles-20261005；首次失败、源与构建SHA、语法/whitespace/12文档回读见closeout。主smoke产生的其他教育业务截图本轮未逐张视觉复核，不算新的整模块视觉验收。

## 2026-10-05 CTRL/CFG当前构建验收结果

Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。仅复用现有Pi1.0.2/Hana队列宿主、控制卡和设置进行当前构建验收；本轮没有生产源码、依赖、表、IPC、预算、凭证或日常数据迁移。

同一隔离build5 SHA90f47528…（323文件），串行Electron：queue-VbXK9A 16、control-Va2mxP 21、legacy-LcBJKG 3、settings-2EbTnw 32、credential-UnbTlU 15均success/exit0；原边界X9Ppea 9、renderer101/101本轮exit0。build/tsc/main207是上一轮同SHA证据，本轮未重跑，不能追认为新结果。

队列真实编辑/撤回/原生消费与输入清空，停止后新任务、问答/计划/显式崩溃恢复通过。CTRL03实际kill在问答等待和主进程E2E dispatch间隙；没有对真实写文件/上传执行中kill做全覆盖，不把测试延迟当provider行为。旧v1合成profile只复制测试，原native字节/receipt不改；非日常数据迁移。

CFG保存设置在主进程Key/model空且无旧有效凭证的新profile运行：Windows safeStorage实际密文、缓存不能代替验证，页面保存后Flash/Pro共9次真实200/零图片块；重启无重放，主动续问实读新核验码/41；无效save保原密文/version/default，文本Pro实际拒图且后续文本工具可用。settings32另实证200与运行中停止AbortError/设置返回同run；技能和归档样本有typed fixture，对话框仅选owned合成素材，不当全自然人工路径。

已实际查看20张本轮PNG：queue2/control2/settings六页双尺寸12/credential4。控制问答改用BrowserWindow真实content1366×768/1920×1080并等待inner尺寸，不以setViewportSize冒充；按钮与输入可达。但问答截图主壳顶部标题发生裁切，完整VIEW01与Shell视觉仍未验收，须专项定位；浅色设置可读不等于全部暗色组件通过。

原CiczPb失败保留：模型本轮实读新码/41，末段比较旧码/37，旧“全文不能有旧码”断言误判。修为新答案含新码/当前课堂时长且本轮实读回执含新码/41不含旧码，原提示词/HTTP/密钥/native/权限断言保持，完整15项重跑通过。queue-existing/auto-control-edge首调用缺必需data参数，ENOENT在模型和应用动作前；legacy改testMain与owned profile后用明确旧测试副本通过3。auto-control-edge历史suite会主动设maxModelCalls=1，与当前无预算合同不同，未执行预算分支、不当自动压缩验收；原日志保留。

精确报告、日志SHA和回读：apps/desktop/test-results/goal/controls-20261005/closeout.json。日常out/Profile/Master不改，无commit/push。

下一唯一：冻结/skill自动标题兼容合同，核普通append与附件原子append两条路径，保手工标题、原提示词、历史/native绑定与本地真源；完成后继续Shell顶部裁切、完整暗色菜单与其余缺口。Phase2退役重复runtime、Phase3五空间、教育适配/飞轮、黄金A–G、日常D与无VPN安装E仍开放，不重复已通过的有限审计。

精确命令（cwd D:/WorkProject/EduProject/apps/desktop；所有UI先设置OMNI_EDU_TEST_BUILD_ROOT为绝对test-results/goal/glass-20261005/build5）：

- node scripts/xiaozhi-agent/pi-queue-ui-smoke.mjs → controls-20261005/queue-first.log / 16 / exit0
- node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs → control-native.log / 21 / exit0（先control-first.log21仅viewport，保留但最终采用native）
- node scripts/xiaozhi-agent/pi-queue-existing-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-5bucLj/data → queue-existing-final.log / 3 / exit0
- node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs → settings-first.log / 32 / exit0
- node scripts/xiaozhi-agent/pi-saved-credential-tools-ui-smoke.mjs → credentials-corrected.log / 15 / exit0（credentials-final.log首9后误断言exit1保留）
- node scripts/xiaozhi-agent/pi-queue-boundary-smoke.mjs → queue-boundary.log / 9 / exit0
- npm run test:renderer-components → renderer.log / 101/101 / exit0

以上log位于apps/desktop/test-results/goal/controls-20261005。语法/whitespace与固定构建/12文档回读由同目录closeout记录，不替代用户日常人工签认。

## 2026-10-05 Glass主壳与文件版本接缝结果

本轮Glass主壳与来源版本接缝有限验收通过，Phase1完整Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。生产新增仅工作区glass语义CSS、原OSS Tooltip接线，以及Hana文件回执可选version回调；Pi两处host复用既有fileVersion。正文sha256与来源version分开，读取前后变化拒绝，不放宽来源CAS/权限/教师确认。不新增依赖、表、IPC或第二runtime，不设置运行预算，原自动压缩保持。

最终隔离build5含tsc exit0（323文件 / 16116826字节 / SHA 90f47528c57f9ce6cbabee340e5deae0a51e6f2bd7eaaf4059344de743b73ad9）；renderer101/101；原主smoke207/207。最终baseline-qNl91y 13、files-OUVs7O 25、browser-delivery-y3Qfqd 13、natural-file-tntQjR 14均exit0；Hana14/Pi边界8/Office协调10均过。NET01原通知读取日期区分、NET02真实DOM/页面截图/失败/冷恢复；FILE01附件实读清空、FILE02授权与拒绝、FILE03拒绝不写和确认37→41、FILE04原文审阅生成实际DOCX/SQLite SHA/独立python-docx/冷恢复。FILE04本次未触发问答，未引用无关资料（sources空并明确说明），不能把它当真实provider引用版本CAS验证；来源接缝由Hana/Pi/Office边界实际读取与服务验证。

同一已确认Word副本经真实新建owned WPS12.0打开、编辑负责人单元格、保存重开成功；原DOCX不变。独立回读12段/1表/5行；WPS导出1页A4，28内容marker齐全、无页外字形、页面PNG实际查看。保护已有WPS实例。未测试Microsoft Office/PPTX/Excel。

最终build5双1366×768/1920×1080浅色/深色长历史、真实联网截图预览、文件、Word审阅/打开PNG已实际查看；forced-colors已看。light正文/用户/标题/次级对比度11.65/10.58/11.65/5.39，dark13.07/11.27/13.07/7.80；键盘Tooltip/focus、reduced-motion和forced-colors真实断言通过。系统主题由浏览器media模拟，不冒称Windows设置；不支持backdrop回退只有CSS声明，未在不支持引擎实测。dark小标题Folder图标对比及完整Office/菜单暗色仍待专项。

首7by4th forced-colors blur失败；zNiObF assistant-only对比度检查遗漏用户白气泡；HDrhny新增真实user断言测1.09，修selector/主题后最终通过，未降低4.5阈值。KuLyrj重启布局即时415/期望360，保原<5px断言加入2秒ResizeObserver收敛等待；最终25过。DlOTRk真实FILE04等待教师问答，原脚本未答超时；补可选真实控件答复且第二问拒绝，本次最终未触发。0auxVr来源sha256误当version触发真实conflict，无文件/无审批；补回执和工具说明，保CAS。FYPufG最终build首次files在归档菜单点击时DOM脱离/超时，原因未确证；并行Electron窗口后改串行原断言重跑OUVs7O 25过，无生产菜单改动，不能追认稳定三连。所有原日志/报告/构建保持。

精确命令（cwd apps/desktop；最终UI命令均先设置OMNI_EDU_TEST_BUILD_ROOT=绝对test-results/goal/glass-20261005/build5）：

- npm run build -- --config test-results/goal/glass-20261005/workspace.config.ts → build-fifth.log / exit0（含tsc）
- npm run test:renderer-components → renderer-final.log / 101/101 / exit0
- node scripts/acceptance/audit.mjs --baseline → baseline-fifth.log / qNl91y13 / exit0
- node scripts/xiaozhi-agent/pi-workspace-files-ui-smoke.mjs → files-final-sequential.log / OUVs7O25 / exit0；首次FYPufG22 / exit1保留
- node scripts/xiaozhi-agent/pi-browser-delivery-ui-smoke.mjs → network-fifth.log / y3Qfqd13 / exit0
- node scripts/xiaozhi-agent/pi-natural-file-ui-smoke.mjs → natural-file-fifth.log / tntQjR14 / exit0
- node scripts/electron-smoke.mjs → main-smoke-fifth.log / 207/207 / exit0
- node scripts/office-agent/hana-tools-smoke.mjs → hana-version.log / FTtF8s14 / exit0
- node scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs → pi-version.log / rM0epJ8 / exit0
- node scripts/xiaozhi-agent/pi-office-artifact-coordinator-smoke.mjs → office-version.log / Ae5FQM10 / exit0
- ./scripts/xiaozhi-agent/pi-office-wps-acceptance.ps1 -Mode render -OutputRoot test-results/xiaozhi-agent/pi-natural-file-tntQjR/wps-render -SourceRoot test-results/xiaozhi-agent/pi-natural-file-tntQjR/wps-source -Formats docx -EditDocxCopy → wps-final.log / actual report success
- bundled Python scripts/xiaozhi-agent/verify-natural-word.py 同wps-source/generated.docx 同wps-source/expected.json 同wps-render/report.json → wps-readback.json / exit0
- node test-results/goal/glass-20261005/prepare-word-markers.mjs；bundled Python scripts/xiaozhi-agent/verify-office-wps-render.py 同wps-render 同wps-render/markers.json → wps-render-readback.log / exit0

全部日志位于apps/desktop/test-results/goal/glass-20261005。报告/原文件/私有native/profile只留ignored owned test-results，不归档到公开文档；截图均合成资料与授权公开页面。12文档回读、来源SHA、构建/daily/Master保护与语法/whitespace门禁见同目录closeout.json。下一：下一从Phase1原CTRL/CFG的当前构建验收继续：真实运行中编辑/撤回、停止、补充/重试、设置保存返回同会话；按实际缺口冻结合同修复。随后独立兼容合同处理/skill自动标题两条路径，完成完整Shell，再Phase2退役旧runtime、Phase3五空间。原用户失败/D日常、E无VPN与安装、A–G、安全补丁/私有日志/userData ACL/备份恢复、Pro许可仍OPEN；三元暂停保持。已有壳/包审计不再重复。

## 2026-10-05 最新有限验收

收尾同目录closeout.json success true/5项：Master/daily out未变、最终隔离build身份、全部风险仍OPEN、12文档/21本地链接/9状态头回读。git-diff-check-final.log和最终audit语法均exit0。文档utility初缺Next段失败保first脚本/手工回执，幂等修复后过；不算产品失败或模型故障。

2026-10-05：Phase0有限审计已退出；Phase1 Shell DOING，整体NOT_ACCEPTED。新增office/workspace-status.ts并接PiWorkspaceContext，旧历史不称新任务成功；恢复、审批、补充、手动/自动整理、失败/停止按公开真实状态呈现。自动整理从实际applyXiaozhiEvent投影读取，不把它等同manual operation。后端/权限/IPC/native记录/模型/key/预算/数据未改。

最后隔离正常build含tsc exit0；renderer101（原79+18状态+4实际compaction投影转换）exit0；web13/证据grader22 exit0。最终baseline-mLN2E0真实Electron10项：空/typed历史状态、200条公开合成记录/只读SQLite、冷恢复、双content尺寸输入可达/实际PNG已看；构建323文件/16105165字节/SHA f5d71e0e73bd140ae4ba9de1c6c4e0e89aba69b01420219340c2e52093c082cc。首ijFI2G为前一有限通过，保两个build/日志，不称3次稳定。离线例不证明B/provider、NET/FILE/CTRL全路径或日常D/E，也不是新Glass完整视觉验收。

security-audit-DBWIc2库存3项/exit0；fresh npm audit exit1仍0critical/3high/2moderate。只有路径/日志/owned Windows ACL与修补门禁审计通过，漏洞没有修复。证据在 apps/desktop/test-results/goal/security-0785b4e6/security-audit-DBWIc2/report.json 和 apps/desktop/test-results/acceptance/baseline-mLN2E0/report.json；完整命令见docs/acceptance/CURRENT.md。

精确命令（cwd apps/desktop）：

- npm audit --omit=dev --json（exit1，风险保留）
- npm explain dompurify mermaid nanoid undici --json（exit0）
- node scripts/acceptance/audit.mjs --security test-results/goal/security-0785b4e6（3/exit0）
- node scripts/xiaozhi-agent/pi-web-boundary-smoke.mjs（13/exit0，原transport doubles）
- npm run build -- --config test-results/goal/security-0785b4e6/workspace.config.ts（最终workspace-build2；含tsc，exit0）
- npm run test:renderer-components（101/exit0；初版97保持）
- OMNI_EDU_TEST_BUILD_ROOT=owned workspace-build2 + node scripts/acceptance/audit.mjs --baseline（最终mLN2E0 10/exit0；原mode保留名字，作为状态回归而非新架构/课堂验收）
- node scripts/acceptance/grade-smoke.mjs（22/exit0，仅证据评分）
- git diff --check（exit0；收尾再次记录）

最后两content尺寸PNG已实际查看：历史标签、正文/来源卡/输入可读且可达，无横向越界；仅有限状态视觉，不称新glass风格完成。没有新B/provider、D日常、E无VPN/安装验证。

Next：Phase1继续真实Pi主工作台：先冻结glass主壳/低噪音过程/输入栏/文件与来源的本轮组件、token、状态、回滚和验收清单；优先既有组件与公开主题token，保持实际Pi接线。按测试说明书原NET-01/FILE-01/CTRL/CFG分步跑同输入，补运行/审批/输入/自动整理在真实任务中可见的双尺寸证据，再完成其余Shell。标题属于独立兼容切片；Phase2后退役旧编排。安全修补/私有日志/实际userData ACL/备份restore、许可分发、A–G、D/E均继续开放，不重做已完成包/基线审计。

以下Phase0合同/报告保留为历史证据，不恢复为当前Next。

更新2026-10-05。唯一持续台账：[Goal ACCEPTANCE](../goal/ACCEPTANCE.md)。样本与层级：[测试样例说明书](../../测试样例说明书.md)。

整体 **NOT_ACCEPTED**，当前Phase1 DOING，Phase0有限审计已退出。历史167 settings真实桌面C32有效，但不是新Goal的完成结论。79/207等历史门禁注明构建和执行日期，不追认为本轮重跑。

新验收复用现有领域suite与合成样本，保留首次失败和持久回读。任务完成要求实现、类型、单元、集成、冒烟、真实场景、回归与UI视觉；D日常/E无VPN安装与C隔离桌面分开。最终黄金A–G、崩溃恢复、安装、安全、许可与性能待完成。

## Phase 0 继续合同：最小上游包闭包与Windows接缝

沿上一轮32/15/基线证据继续，不重做已过项。本轮先核OpenMAIC DSL/generation/renderer的固定注册包与Git源身份、完整模块/转依赖许可、peer与字体网络边界；复用上游tarball smoke的DSL去重/实际import/Node模板资源/renderer服务端与浏览器校验方法，在owned consumer中运行，明确不当教育能力已移植。

只写ignored `test-results/goal` 下隔离consumer、报告和必要的现有audit入口扩展；registry读取/固定tarball下载与本地 `npm install --ignore-scripts` 为审计，不安装上游整站、不改三个工作树依赖/锁/vendor、不发模型请求或改用户配置。先核LICENSE后在隔离环境加载源码；包源码/安装/打包字节分别记。根LICENSE不能替代fonts/额外bundled许可证；拒绝默认字体CDN，禁止第二runtime。

保第一次失败；Windows进程命令、Node-only generation入口、React peer、Tailwind预编译与本地资源加载实际核验。已知未采用/有hold对象记录处置与后续门禁，不能用“所有未来能力已实现”作为Phase0审计通过条件。通过剩余审计并冻结真实Pi Shell纵向合同后才改生产UI。

## Phase 0 本轮执行合同：补齐可重跑的基线

- 修改既有 `apps/desktop/scripts/acceptance/audit.mjs`，增加明确的 `--baseline` 模式；原历史证据审计参数/退出语义保持。复用build-root/evidence/Playwright/SQLite，不新增独立smoke或依赖。
- 输出独立忽略目录中的schema1基线：32个旧Harness文件的四类清单/源指纹、既有测试分层映射、默认数据路径与安全边界、启动/首屏/IPC/SQLite/内存/构建体积/合成历史与本地大文件测量，以及双尺寸实际截图。
- 固定原build4；只创建owned测试profile/合成材料。默认不联网/不读凭证，不改日常窗口、配置、资料、vendor、表/schema、IPC或依赖；可选真实模型延迟后续单独测，不以本地读取替代解析/模型能力。
- 先核持久化/权限/旧loop与上游15项能力接缝；保存第一失败。验收包括脚本语法、基线实际执行与JSON/文件回读、已有renderer测试/类型检查（不重建日常out）、视觉检查、仓库diff检查。
- Phase0通过只意味着审计范围与后续合同清楚，未来能力与许可证未闭合项保留为明确门禁，不提前迁移或称完整产品DONE。

### 执行中发现的最小修复

既有 `deeptutor-learning-analytics-smoke.mjs` 在断言前因 esbuild 将新增 Pi/CJS 依赖内联进 ESM 而报 `Dynamic require of child_process is not supported`。保留首次日志，修复仅限该测试的依赖打包边界；继续复用原8项学情/跨学生脱敏/教师确认与SQLite回读断言，不改生产逻辑或放宽检查。Windows `rg` 路径通配应使用 `-g`，不把工具路径语法错误当产品失败。

## 本轮实测结果（Phase0有限基线通过）

### 追加：最小包Windows接缝（2026-10-05）

`node scripts/acceptance/audit.mjs --packages test-results/goal/phase0-3f5282f0/package-audit/consumer` 最终 `package-probe-u38Mxk/report.json` success true/5项/exit0，保最终stdout `package-audit/probe-final.log`。入口只接受realpath位于owned goal区域且名称consumer的目录，固定版本与已核license inventory/lock SHA，生成独立输出，不写生产main/profile。Node和实际Electron主进程均运行原包ESM与prompt模板；slide/quiz/invalid-model-output为上游方法的合成注入响应，**不是B模型验证或C正式课堂用户路径**。

初I7RsMQ Node过后Electron ESM入口顶层await app.whenReady启动超时；改CJS异步入口。次kzrqoQ渲染TypeError useContext null，metafile确认测试entry解析了两份React；加明确consumer alias及单React/DOM路径断言。最终eMcaeG/u38Mxk均过5项，两个首失败报告保持，不追称3连。两最终PNG均记录SHA；eMcaeG两图已查看，u38Mxk本轮收尾另行查看，非新生产UI验收。

实际78包安装149529125字节，完整root/额外许可证与NOTICE留存；bundle11203418字节。没有下载字体/LLM请求；HTTP拦截在loadFile前注册，成功例记录零HTTP请求，仅证明此合成路径。renderer内置styles文字通过；未验Tailwind编辑器、KaTeX专用字体、图表/code/媒体/导出、恶意内容或正式安装。unsafe HTML必须后续校验，不因纯合成通过绕过权限。

追加门禁：`node --check scripts/acceptance/audit.mjs` exit0；renderer79/79 exit0；grade-smoke22 exit0；`npm run build -- --config test-results/goal/phase0-3f5282f0/package.config.ts` exit0，正常配置只隔离outDir到package-audit-build，含tsc。对应log保在package-audit。原207/领域20/8/web13本轮不重复运行，保前轮证据日期，不伪造重跑。

### 所选测试与黄金任务的实际覆盖关系

| 既有suite/证据 | 源码核对到的范围 | 黄金任务关联与剩余缺口 |
| --- | --- | --- |
| renderer-component-state-test /79 | Vite SSR静态markup加载知识本/教案/错题/学生/备份/会话等状态 | A/B/C/F管理控件旁证；不含真实点击、provider、文件和新glass视觉 |
| deeptutor-learning-analytics /8、review-scheduler /20（前轮） | SQLite合成record、日期/学科/另一学生、privacy sentinel、教师确认；确定性调度边界 | F教育DOMAIN保留最小回归；不是完整真实两周计划 |
| pi-web-boundary /13（前轮） | MockAgent禁止真实net、脱敏关键词/编码URL、Hana once、accessor拒绝、权限与projection | NET工具边界；不替代NET-01/02正文/截图实际成功和用户D/E |
| package probe /5 | 固定tarball/DSL、Node/Electron模板、合成生成与真实组件渲染 | E后续adapter接缝；无Pi编排/持久课堂/交互页、黄金E未过 |
| 原161/163/165/167 C evidence | FILE/CFG/Skills当前独立构建真实路径与持久回读 | 部分A/B办公旁证；原文档适用边界保持，不能覆盖新Master A–G |
| grade-smoke /22 | 首失败/证据层级/缺失/重复稳定判定 | 只测报告规则；D教学PPTX、G飞轮及全崩溃/安装仍缺最终例 |

继续使用《测试样例说明书》原23例及补充，尤其NET-01自然原文、NET-02截图、发送清空、CFG保存实际请求和旧会话恢复。Phase0性能/包probe均不能关闭原NET/IMG/凭证反馈；日常同构建配置输入由用户确认、无VPN/安装E独立。

所有命令cwd `apps/desktop`。owned证据根 `test-results/goal/phase0-3f5282f0`。最新隔离编译与原build4全323文件指纹相同SHA `a5b2c8e939a50555fb2c01a63241d85a7dc888d1ab586812335e6ba7b90d8c96`；没有重建日常out。

| 命令 / 证据 | 实测结论 | 边界 |
| --- | --- | --- |
| `node --check scripts/acceptance/audit.mjs` | exit0 | 脚本语法 |
| `npx tsc --noEmit` / typecheck.log | exit0 | 当前TypeScript，非UI实例 |
| `npm run build -- --config test-results/goal/phase0-3f5282f0/baseline.config.ts` / build.log | exit0；三个输出目录隔离；build-identities.json逐文件身份匹配 | 构建警告/大JS体积保留；不代表安装包 |
| `npm run test:renderer-components` / renderer-components.log | 79/79、exit0 | 原状态组件测试，不代整体用户流程 |
| `node scripts/deeptutor-review-scheduler-smoke.mjs` | 20项、exit0 | 确定性/时区/有界规则 |
| `node scripts/deeptutor-learning-analytics-smoke.mjs` | 修复后8项、exit0 | SQLite领域/统计/脱敏/教师确认回读；首动态require失败保留 |
| `node scripts/xiaozhi-agent/pi-web-boundary-smoke.mjs` | 13项、exit0；pi-web-boundary-Nponp3 | A边界；HTTP transport mock，不是联网正向验收 |
| `node scripts/acceptance/grade-smoke.mjs` | 22项、exit0 | 分层/首次失败/完整性判定规则，不算22个产品功能 |
| `$env:OMNI_EDU_TEST_BUILD_ROOT='…/pi-skill-capability-build4'; node scripts/acceptance/audit.mjs --baseline` | 最后IfNQQo 7项、Node exit0；JSON/SQLite/图片回读；两张PNG实际查看 | owned离线C性能/公开历史；不是provider、全Pi长任务或D/E |
| `node scripts/acceptance/audit.mjs run-J5fGBi` | 原web19证据通过；整体exit1/NOT_ACCEPTED | 正确拒绝缺OCR/人工/日常配置的单例，不为了回归让它变绿 |

基线第一次KwhKiQ断言失败：main会用.env.local覆盖空env，失败启动确实读取了本地配置，旧报告边界文字不能作为未读凭证证明；未输出密钥或提交模型任务。第二1f7hU0是侧栏预览/正文重复文本严格定位失败。均保留，修复只改隔离启动与限定真实正文容器。IfNQQo启动跳过.env.local且owned cwd，实际key/model为空。冷恢复只断言ready后未观测tool_start，未宣称整个启动期被监听。

性能数字见 [architecture CURRENT](../architecture/CURRENT.md)。单次快照不等于三次稳定；真实NET/IMG/FILE/CFG/GOAL任务按说明书原文继续，不能用基线关闭用户反馈。本轮无生产功能修改、新provider请求、新预算或用户数据迁移。
