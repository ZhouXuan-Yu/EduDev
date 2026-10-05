# 前端接线与 Electron E2E 覆盖矩阵

## 2026-10-06 DT-05 同源五题与两周训练（当前）

新增实际路径DT-05-photo-cycle：原照片/OCR/facts链14项+同源五题/五练习/14天/实际5作答与分数/再分析/冷恢复7项=21；冷恢复视觉DT-05-cycle-visual2项验证15个最终字段、首末题可达、63→63消息。对照旧结果2项。内容验收：逐题算核发现原AI第五题解析错误地用“3.5不比直角边长”排除直接相加，已在实际教师第五题textarea改为3.5²≠平方和；首题改为8/15→17，初始计划第1天和第13天说明亦由原教师控件修正，模型原候选与最终版本同时保留。强schema不保证数学/教学正确；本次未放宽教师确认或推断未来成绩。实际复用原ChatTool/HeroUI Button、题/练习/学习writer与DeepTutor算法，无第二Agent或新事实真源。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。



## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

本轮已覆盖：实际照片OCR→教师事实空表单/放弃→标准/实际答案与错因→确认来源根题/实际事件→立即传统列表→重复/冲突→绑定Pi/真实DeepSeek实读→冷恢复，14项。配合旧结果副本2项、统一领域160项、组件167项和最终旧业务smoke。完整5题/14天/再分析、日常人工与无VPN仍待下一轮证据。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

|用户路径|真实证据|边界|
|---|---|---|
|学生照片导入→本地 OCR→取消/缓存→教师校正→Pi 绑定草稿→冷重启|education-journey-LxoKnh，8/8，2 启动，rendererErrors=0|真实本地 worker，0 模型 runs|
|既有实际结果副本迁移→传统计划与对话读回|education-journey-uYHK7a，2/2|55→55 消息；2 题/2学习记录保留|
|照片来源、版本、取消与事务回滚|education-boundary-wKegTh，155/155 总门禁|领域 ports 不冒称生产 OS 强杀|

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

|用户路径|当前证据|范围|
|---|---|---|
|学生计划选择已确认练习→逐题实际作答/教师分数→保存→同源打开|WTTeTd 8/8的一部分|正式Pi+真实DeepSeek+原writer|
|漏填表现/分数超限|页面拒绝且零新增记录|不含生产OS强杀|
|小智读实际结果→教师修订计划→重启|WTTeTd，版本1→2，2条事实|单知识点/两题限定链|
|传统练习“学习计划与结果”|cVAg2R 2/2，55→55消息|当前build-c，零provider重放|
|旧实际题本副本|JnXVj8 3/3，33→33消息|3题旧库保留|
|新表单/已存结果视觉|8张浅暗双尺寸均逐张查看|静态截图/滚动，不是全像素动态|

稳定testid：training-practice-select/question/answer-0/outcome-0/feedback-0/score-toggle/score-earned/score-max/saved/saved-score，exercise-training-open。测试从教师操作进入，typed IPC与SQLite/原生回执仅作为读回证据。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

新增当前用户链路：教学内容题本录原题→选学生→小智实读/生成变式/教师改题→重新实读→练习空标题失败与重读保留→改标题/顺序/角色/观察→确认→当前学生传统页打开练习/父来源→另一学生为空→拒绝→停止/两次冷启动防重。9项当前真实provider、3项旧教师题目库副本、207相关旧业务回归，均固定当前构建。

Evidence：固定build-c 341文件/SHA 15cba713c2dea8db351973b488c9314909caf31e5ea55d837c525159b0545207，默认out逐文件一致；build/typecheck exit0、统一145/145（education-boundary-wraImL，新增18项）、组件156/156、当前唯一Pi/真实DeepSeek9/9（education-journey-ADH5Jm，3次启动/rendererErrors=0）、旧真实题目核对数据副本3/3（5RLgDA，3题/33→33模型消息，0新增事实）、相关旧业务smoke207/207均当前固定build-c。八张实际Electron浅暗1366×768/1920×1080图逐张查看；核对/拒绝/关闭可达、长内容内部滚动、无横向溢出。完整命令、源码/报告SHA、SQLite读回、失败留存与视觉边界：apps/desktop/test-results/goal/dt05-practice-20261006/closeout.json。领域故障回滚使用真实SQLite测试ports；原writer保存由真实页面证明，不冒称生产OS强杀。

浅暗双尺寸8图实际检查；只接受此卡/来源对话框静态可达与可读，不声称日常DOM/原生动态/全Codex像素相等。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

新增真实当前UI路径：教师教学内容→题本录原题→小智原生实读→可编辑核对→空答案失败/重读保留/补全→确认保存→当前传统题本读回；拒绝、停止、冷恢复、重放防重。3次owned隔离正式Electron启动，真实DeepSeek，无fixture注入生产事实。

Evidence：固定341文件/SHA e80b3052e86609b0156b7f91f735b534b9ba47c92d04a9cd83b81abdb0190ab2；原源码verify/build/typecheck exit0、统一127/127、当前组件150/150、当前唯一Pi/真实DeepSeek教师核对10/10（education-journey-R7dHLl），3次启动、rendererErrors=0。浅暗1366×768/1920×1080四图实际逐张查看：确认/拒绝与输入可达，窄窗题目字段在内部滚动区，无横向溢出。相关历史回归207/207是在build-a、最终元数据/摘要绑定/重试修复之前，不能当成最终构建全部回归。精确命令、SHA、版本、失败留存、SQLite读回与视觉范围：apps/desktop/test-results/goal/dt05-review-20261006/closeout.json。

四图检查仅覆盖该卡浅暗双尺寸；当前传统入口和SQLite读回通过，未验生产日常人工或完整Codex像素/动态。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 原测验格式能力复用（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05第2项DOING，完整Goal ACTIVE。上一轮为真实进展，其题库来源接缝6/99/146/8/207和4图报告本轮只读复核，未冒称重跑。

本轮只改格式协议/固定Worker与构建资产，没有新页面或IPC教师入口。renderer146回归通过，资产与上一轮renderer逐字一致；新的候选Golden/视觉仍待后续纵向实现，不把原题库来源6项冒充生成题目验收。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 真实题库来源接缝（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05 DOING，第1项真实题库来源接缝限定接受；完整Goal ACTIVE。

固定337文件/SHA 674fc8daf1620bfcba385a31f4fe12da9d8326c1993314d292367c494e9134d3；build/typecheck0、统一99/99（pvBYRJ）、renderer146/146、Pi协议8/8（CKxuuD）、当前唯一Pi/真实DeepSeek题库6/6（yTcdQR）、相关历史回归207/207。rendererErrors=0；浅暗1366×768/1920×1080共4张来源页图实际逐张查看，中文题干/答案/解析与关闭控件可达，无横向溢出，仅接受本来源对话框，不接受完整Codex像素/原生动态。精确命令/源码SHA/构建/报告/失败留存：apps/desktop/test-results/goal/dt05-question-20261006/closeout.json。

当前题库实例从教学导航真实录入开始，typed IPC→SQLite→Pi/DeepSeek→实际来源按钮→本地Modal→冷恢复→收藏→空检索。legacy截图不充当新UI证据；完整练习/路径等待下一切片。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

|当前用户操作|证据|接受范围|
|---|---|---|
|学生→学习计划→来源|gsPCmm14项|同一已确认账本/当前main授权来源|
|结果表单→取消/未来纠正/保存/重复|同一真实报告|仅一条实际表现，不冒充训练量|
|历史计划提示→继续→草稿→核对/再规划|唯一Pi/真实DeepSeek|2事实、version6首日2、教师核对|
|冷恢复/旧路径/另一学生空|同一14项|不重放审批或继承其他学生|
|浅暗1366/1920计划/表单/实际结果|12图逐张查看|控件可达/无横溢；非Codex像素/动态|
|边界/renderer/历史|89/142/207|207为补sourceEvidence与schema反馈前旧教育回归|

固定337文件/SHA 41e083651dd0e72e308a2bf9ed1b26715128909db0ca506574bd768d012a62c3；build/typecheck exit0、统一89/89（JC5UXh）、renderer142/142、当前唯一Pi/真实DeepSeek学生计划14/14（gsPCmm）、rendererErrors=0。12张浅暗1366×768/1920×1080截图逐张查看：计划、结果表单、重新规划后实际结果，控件可滚动到达且无横向溢出。历史回归207/207在build-a通过，发生于逐条证据目录/参数修正提示补充前，仅作相关旧教育回归。完整命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-workspace-20261005/closeout.json。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 DT-04 当前增量验收

|用户路径|证据|接受范围|
|---|---|---|
|学生→问小智→训练→编辑/非法数量→确认|education-journey-2yywL7 9/9，实际Pi/DeepSeek|教师version4首日7，原练习仍1|
|来源/拒绝/冷恢复/空证据|同一真实报告|新版UI/SQLite/模型再读，不重放审批|
|字段与核对页尾/浅暗两尺寸|12图实际查看|滚动可达，无横向溢出，非完整Codex动态|
|strict来源/取消/陈旧/旧v1|education-boundary-KhMtv1 81/81|领域/协议边界|
|renderer及历史回归|137/137及dt04-smoke207/207|207限定历史，非新版UI|

下一先贯通既有学生“学习计划”入口读取同一已确认计划及陈旧/空/失败状态，再补教师友好的结构化实际学习结果录入与重新分析/继续训练，不开第二事实库、不把安排当完成；然后DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8。完整Golden F、DeepTutor全模式、OpenMAIC互动课、日常人工、像素/动态、安装/无VPN与既有audit5项仍OPEN。

固定337文件/SHA 8af8cd343bcc97c858f266eafcabc7ad57fe3fc32aefc4c662860b1e00dd186b；build/typecheck0、统一81/81、renderer137/137、当前唯一Pi/真实DeepSeek训练9/9（education-journey-2yywL7）、相关历史回归207/207。rendererErrors=0。浅暗1366×768/1920×1080共12图逐张查看，分别定位训练字段与核对页尾，窄窗正常滚动可达、无横向溢出；不接受完整Codex像素/原生动态。精确命令/源码SHA/报告/失败留存：apps/desktop/test-results/goal/dt04-training-20261005/closeout.json。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 当前包切片与取消门禁

新增既有settings runner --packages-only：实际加密保存→官方余额→状态披露→浅暗双尺寸→真实Pi网页find→冷恢复，7通过。既有Golden runner DT-03-concurrency：Stop事务rollback→新教师确认→并发重复/冲突→冷恢复，6通过。9ExwIF/pvhhdt均正式Pi/当前新五空间，未用旧截图；完整Goal不因两组接受完成。


## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

本轮固定当前五空间/真实DeepSeek学习核对11/11（4启动、0renderer错误）与原生身份64边界、renderer133、历史207通过；旧legacy图只作回归。DT-03完整并发取消、DT-04/05及MA/Golden仍OPEN。证据native-scope/closeout.json；四张当前图已查看，暗1366确认需卡内滚动。


## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

固定337文件/SHA 7d5299a4beea1317bc791a7da1e02081253b6ab1f2b588a1f2ea269180217a5b；build/typecheck exit0、统一领域边界57/57、renderer133/133、正式唯一Pi真实DeepSeek历史10/10、相关历史回归207/207。两次正常冷启动；4张浅暗1366×768/1920×1080图逐张实际查看，均为当前新五空间。207历史legacy画面仅作回归，不作新版UI证据。

新增路径：新版学生页→另建同学生对话→已确认历史/版本差异/原建议→当前来源→真实Pi策略建议教师编辑→历史7版本分页→冷恢复→原记录教师编辑后重核提示→其他学生空历史。当前实例 apps/desktop/test-results/education-journey-1DXgrz/report.json；不覆盖完整DT-03或Golden F。

以下保留历史，当前状态以上述记录为准。

## 2026-10-05 能力支线恢复与 DT-01a 引文核验

新增用户路径：我的资料native选择真实MD→问小智真实DeepSeek核验两引文→公开结果/SQLite/native回读→冷启动，无旧Runtime。新版学生个性化与OpenMAIC教师课堂仍缺正式Golden F/E。

Goal ACTIVE。按本轮用户纠偏，当前工作转为 Phase4/5 能力支线；Phase3欠项保留OPEN，不因切换优先级记完成。详细顺序：docs/goal/EDUCATION_BRANCH_TODOLIST.md；当前限定验收：docs/goal/PHASE4_DT_01A_ACCEPTANCE.md。

Done（限定A/C）：固定新版DeepTutor源码的只读引文核验已接 Pi / EducationCapabilityProvider，真实DeepSeek正反核验、持久结果与冷恢复通过；11边界、12相关工具回归、133组件、正式Electron4场景及5张静态图审。原Python源码/Apache许可证逐字复用，无第二Loop/Store、新依赖或Schema。学生个性化/Golden F、OpenMAIC SDK/Golden E仍OPEN。

Next唯一：DT-01b，复用同一原版search_units补全资料正文搜索与来源定位；再DT-02学生真实事实→DT-03掌握度/复习→DT-04两周训练→DT-05题目/学习路径；随后MA-01 DSL本地合同→generation→renderer→编辑/导入→真实互动课堂。不能回到旧模拟样例兼容循环。

Failed/Open：原legacy全套smoke最新exit1（题本SQLite回执早于React显示）；两处断言已改为等待真实DOM，未全套重跑，不能声称207通过。Phase3完整39项、备课本全图审/整体验收、完整Goal/无VPN/安装/许可安全/人工仍OPEN。正式首4次图审失败与第五成功均保留；最后一次最终构建验收报告见closeout，不能宣称连续稳定。

日常版本统一：npm start/根启动小智.cmd先成功构建后开当前out，旧dist可恢复归档，release不跟随旧dev URL，单实例聚焦/版本变化重启；owned验收窗口隐藏。此前日常入口5/5有限验收、两图审及备课本独立8场景通过，不代表完整Phase3。默认out本轮有意更新；未清空日常事实、改密钥/供应商/DNS/proxy/VPN或提交/push。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55，工作树保留既有改动。

## 2026-10-05 P3-04：资料收录、全量目录与真实正文工具接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-04仅资料收录、全量目录与正文工具实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。以下为当前生效状态，后文各轮记录保留历史范围。新接口只取真实本地事实，旧模拟业务兼容与测试样例书专项不再投入，不自动补回演示种子。

|真实用户路径|证据|范围|
|---|---|---|
|我的资料native选择多格式/部分失败/停止/重试|当前正式shell31项|真实worker/文件hash/SQLite；受控 chooser只指定合成文件|
|121份全库名称/格式与长正文35段|当前正式shell31项|50/50/21目录、10块正文页；不含全文索引验收|
|切空间继续收录/强制退出/冷恢复|四实际隔离启动|无test-runtime加载；失败可恢复、ready不重复|
|问小智实际读取资料正文并引用|DeepSeek-final持久readback|成功“读取资料库正文”与真实标题/证据编号，非prompt回声|
|资料与引用浅暗两尺寸|21实际逐图，37归档|本轮控件可读/可达，不覆盖全页WCAG/完整像素|
|旧教育回归|最终build9 207/207 exit0|显式隔离legacy与fixture，不是新教育Golden|

边界：PDF只接受已验证文本层路径，扫描OCR未完成；旧doc/xls/ppt不支持。目录查找按全库名称/格式，不是资料全文搜索；Unicode归一仅查询侧，SQLite lower不承诺全Unicode等价。原生选择单批50文件、既有15秒/50MiB输入/1MiB解析输出均为工具边界，不是运行预算。资料收录不等于教师确认；失败保留旧已提交派生正文且不伪称ready。教学Office产物目录仍最近100份，完整分页待后续合同。日常安装、无VPN、WPS版式、人工、全Codex体感、安全/许可、完整教育Golden均OPEN；未以隔离验收替换日常out。

Evidence：固定build9，323文件/SHA 52d6321cd1b974c26ae4ce8c06459bb157744a1660851d54475893780e193f9e；正常build/typecheck exit0，renderer129/129、资料/Office工具边界12/12、真实DeepSeek正式Electron工作台31/31、原教育隔离legacy-test回归207/207，均独立exit0。31项report.success=true/rendererErrors=[]，四次实际独立profile启动、当前构建/脚本指纹与main已加载模块核验；207本轮确实在最终build9重跑，不能作为新教育黄金闭环。37最终PNG归档，其中21张逐张视觉审阅，覆盖本轮资料空/正文/失败/冷恢复及正文工具浅暗1366×768/1920×1080；其他16张只归档。本轮控件可达/可读，不宣称全部Codex像素一致或全页WCAG。归档：apps/desktop/test-results/goal/phase3-ingestion-20261005/closeout.json，SHA 36d6820c3685aef39c4c6b6f85a38efbb1ab11ef7f1d513b29b09d1ae7238585；精确命令与失败见PHASE3_PRODUCT_SPACES_CONTRACT。

Next：P3-05，整理传统备课、讲义、题本与学生页面的教师操作体验，盘点实际 typed 入口、业务事实和失败状态，先冻结增量合同，再逐切片实现与验收；随后完整Phase3验收，再Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。Pi保持唯一生产编排。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55。本轮开始HEAD为20aa86656cdb5a0f85e0e11fa21863b50233fcb1，执行中观察到外部提交推进，保留其内容；本Agent未提交或push。Master2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302保持。daily out323文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981本轮未变；P3-03曾意外重建并精确恢复的历史保留。没有新Schema/依赖/vendor/密钥/供应商/系统DNS、proxy、VPN变更，没有清空日常数据。


## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。

固定build4：324文件/SHA 52d657eb2cae96eaeee305aca02ef1fe061fe547eb52c80ec92e713ff99a42fe；正常 build/typecheck 实际进程exit0，日志build4.log；renderer123/123 exit0；真实DeepSeek/Pi正式Electron工作台18/18、Office及目录45/45，均exit0/report.success=true/rendererErrors=[]，同一固定build与当前脚本SHA。实际8次独立userData/sessionData与main已加载模块核验，无旧test-runtime；最终38 PNG逐张查看（工作台21、目录/当前预览/冷恢复17），浅暗1366×768/1920×1080，本轮控件可达/可读。目录标题测量light11.65/dark13.07，只表示已测标题，不是全页WCAG证明。原教育隔离legacy-test回归207/207、suite.ok=true、独立exit0，在build2执行；build4只改生产导航归一与清除旧定位提示，main/shared/legacy业务不变，不冒称207在build4重跑或新教育闭环。证据/源码副本/失败报告见 apps/desktop/test-results/goal/phase3-materials-20261005/closeout.json；manifest SHA 278185debf61bf5944a97e91153740a2b7914b57c648c31d13647c42af82d8dd。

新增路径：production nav-materials → native chooser/typed本地导入 → 实际SQLite与文件readback →筛选/摘录/定位失败；nav-teaching →全会话真实artifact记录 →原授权preview/缺失文件失败 →来源对话 →真实kill/cold恢复。无mock-only UI代替闭环。测试资料全部owned synthetic，定位OSdispatch截获范围明确。PDF/Office资料正文尚未接入本目录，传统教师页面与全教育闭环仍OPEN。Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-01/P3-02仅导航与聊天连续性实现层 A/C 接受；完整 Phase3、Goal、日常、发布、人工仍 NOT_ACCEPTED。旧接口模拟数据不作为新能力真源，跳过测试样例书与旧模拟业务兼容投入。 固定 build5：324 文件，SHA 335e3ffc90b7d88d0bade37a5ad1c1f30d506c3184b235ff774123e433b7e3b6。正常 build/typecheck exit0；renderer 115/115；正式真实 DeepSeek/Pi 工作台18/18、设置39/39，均 exit0/report.success=true/rendererErrors=[]，同一构建与当前脚本 SHA；实际6次独立 userData/sessionData 与main已加载模块核验，未加载旧 test-runtime。最终工作台21 PNG逐张查看，覆盖五空间浅暗双尺寸1366×768/1920×1080、冷恢复；只接受导航、连续性与本轮控件可达/可读，不代表传统页面整体设计已完成。设置专项全部PNG归档，未宣称逐张人工审阅。 原教育207本轮build4隔离回归沿用，非build5重跑；整体传统页设计/资料与教学产物闭环未因此接受。首旧构建/Tooltip/低对比失败保留于apps/desktop/test-results/goal/phase3-spaces-20261005/closeout.json，各自修复后终验18。Next P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

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

## 2026-10-04 最新：当前设置组合C

166/167沿165最终build4 SHAa5b2c8…，mwZl43 C32/exit0：六设置页真实动作与双原生尺寸、env空后密文保存/Flash200、官方Flash/Pro菜单、v2技能、目录记忆/显示/备份verify取消错误busy/真实侧栏搜索改名与归档取消确认/冷恢复native保持零重放。typed归档文件夹夹具与真实会话UI归档分别记录；Pro仅菜单、备份不是恢复、截图不是同DPI。3个测试误判全部保留167。无生产改动/新build/79/207。真实自动标题/skill前缀已确认但未修，两保存路径下一合同。日常63652收尾不在原因未知，恢复原out59252/窗口21430590可见，旧out保持；日常D/E/全目标未验，下方PID为历史。

## 2026-10-04 当前：内建技能与工具对齐

164/165最终隔离build4 SHAa5b2c8…，KmkppR C9：真实选择器/预览、旧profile v1→v2保关闭与native前缀、显式原NET01搜索正文/日期、原FILE04 Word审阅确认/SQLite与实际文件hash、双尺寸按钮/冷恢复零重放；独立DOCX48段1表4空栏。原技能A25/22/14，新增升级A10/协调器A9，renderer79/main207/exit0；n1RGWT误assert表格与MYmfJo真短行失败保留。只是有限C，新版NET03/停止C未新增。日常63652/out0dd7…保持，D/E及整体未验；详情以165为准，下方163为历史。

163最后运行补充优先：旧62244已不在原因未明，盘点无小智窗口才标准build exit0；out323/SHA0dd7…与已验build2逐文件相同，默认日常profile可见63652/10292696/响应True。未新跑79/207或D AI任务；下方“未新build/62244/out3b81保持”是验收阶段事实。25源清单核过/重建前快照及独立closeout记录保持，下一仍内建Skills自然任务。

## 2026-10-04 保存配置专项（当前）

162/163 CFG可见verify/save→Windows密文→实际Pi list/read→冷启动新磁盘码，0PMZJy15 exit0（含1typed模型边界），9次SDK200/匹配保存密钥，actual env空/无legacy；cache非鉴权、无效save保旧/同native切Pro/text-only实拒图零上传/错误后新任务。1366/1920清字段图与独立SQLite/native/PNG/usage核过，两C定位误断言/readonly初错保留。

本轮仅验收工具/文档、无生产改动或新build/79/207；沿161固定build2 SHA0dd7…，62244/out3b81…保持。下一内建Skills旧能力说明与正式显式技能任务对齐，再全D/P08；完整Codex/日常用户两反馈/人工/noVPN安装未验。

## 2026-10-04 自然办公文件/Word切片（当前）

160/161原FILE01/03/04+自然FILE02正式页面→原Pi/Hana/main工具→typed审阅/确认→实际文件/SQLite→原Pro预览→冷重启，GQqHCP14；实际修复新教师任务被旧拒绝永久禁止的说明边界，旧批准不复用。26段2表独立docx读、WPS owned副本真正编辑保存重开、2页A4/字形0/全部标记，双尺寸截图实际核。

协调器8ORE03/FFsefR各8、renderer79、隔离build2 SHA0dd7…、main2 207/oktrue/Node exit0。四个原C失败/main1学生反馈超时保留；main1不能由shell后续返回0称通过。第4周负责人段跨页仍有版式限制，不关闭其他格式/整体视觉。日常62244/out/配置保持，CFG保存凭证、原用户反馈/人工/noVPN安装仍独立。下一CFG-01/02→Skills参照/全D/P08。

## 2026-10-04 浏览器截图实际交付（当前）

158/159真实原NET-01/02自然页面发送→原Pi/Hana搜索/正文/browser→当前页面capture→durable引用→typed主frame预览→原Pro附件/OSS Modal；C vsDjUj13，A WN56o8 21，renderer79/main207 exit0，同isolated323文件SHA4ddacc…、双尺寸图实际核。来源与落款/发布/实施时间在真实工具正文中分别存在；冷恢复/变文件本地重试/非法ID/path/secondary拒绝/invalid页无fake截图实测。

只本机截图，不provider图片回执；旧captured-only/旧native保持。62244/标准out不变，日常原反馈/保存凭证、无VPN安装/Office-WPS、全Codex同DPI仍未验。下一FILE-01至04自然办公全链→CFG/Skills设置→全D/P08，不以该子项勾完整矩阵。

## 2026-10-04 E生产目标有限切片（当前）

156/157真实goal入口→typed主frame→SQLite/CAS→原Pi当前目标/原边界→公开过程/逐项验收/暂停恢复结束。最终NHWhVR A24、BRwT0l C18、renderer79/main207，正式out与build4 323文件SHA同；main/preload与已测main3 13文件相同。真实模型自然工具继续，A另验生产纯文本原边界四请求/一native teacher；两者不混同。双尺寸实际已看，非全页面像素一致。

当前同构建web srkFGa19/固定prefix cache rHuyAF四200，仅对应隔离链路；完整NET-01日期差异及NET-02自然请求/可交付截图下一冻结，原capture不能当教师拿到文件。测试说明书23基础例+持续目标补充/A–E/首次失败保留，用户反馈/D/E人工仍开放，完整active/NOT_ACCEPTED。四根→67指定节→35→157→NET-01/02，再全D/FILE/CFG/P08。新62244可见日常窗口与out保持；以下155生产未接为历史。

## 2026-10-04 E原生执行前置（不是前端完成）

154/155最终E6W1SV19：Pi原SDK调度6明确夹具、官方DeepSeek/原AgentSession5实际只读合成任务（3请求200/native teacher1/read1/checkpoint/冷重开），Hana4+限制3/原源1。没有生产goal/IPC/UI变更，未跑新E build/79/207或C，不沿用153门禁充数；四失败保留。下一冻结生产E SQLite/CAS/criteria/evidence/run→typed→原goal UI→原extension边界和host生命周期→暂停恢复/真实完成审计C及门禁，再全D/P08/人工日常，整体active/NOT_ACCEPTED。

## 2026-10-04 D4图像回执有限切片（当前）

152/153：确切版本received→每turn去重计数→原Pro展开→完整本地thumb/Modal；旧无版本不猜，changed错误/重试保持权限。最终build4/index-Ge0jlXMa.js，native19、正式官方DeepSeek UI17、真正owned冷恢复4/复制版本变化拒绝4/旧回执4、Pro6/renderer79/主207 exit0；单/两图严格原验证码/数量/左右与真实image_url，准备/拒绝/停止/失败零虚假查看，1366/1920截图及实际1920完整图复核。

历史报告记录固定build/脚本SHA与原失败。复制版本变化属于拒绝证据，不正向恢复；单次通过不叫三次稳定。标准out/user33640保持；并行用户反馈/测试说明书不覆盖，日常配置/人工/无VPN安装仍NOT_ACCEPTED。下一109-E持久目标源码与合同，然后全D/P08/最终八组；以下旧下一为历史。

## 2026-10-04 AI测试说明书与当前缺证据

根测试样例说明书23例与docs/testing记录对齐。固定日常out同SHA：首次联网UI启动超时0断言，随后同版复测19；OCR真实UI10；组件79、判定器22。原失败保留、合并NOT_ACCEPTED。尚未证明用户日常配置/旧会话、用户失败图片、正式公开图视觉、无VPN、系统打开来源/手选对话框、Office/WPS或安装。实际脚本成功必须与人工原反馈复测分别记录；不能把源代码、149前置或已有历史报告计为本轮完整通过。细节与原始路径见docs/testing/本轮执行记录_2026_10_04.md。

## 2026-10-04 D3-C正式公开图片验收（最新）

150/151正式MmeMRW13/native mCQfiH13通过：自然目录/公开图片工具→原用途确认卡→官方DeepSeek实际image_url/严格原图核验码/3红2蓝左右JSON与received源，公开分段/输入清空；拒绝零图、冷启动新确认与原native保持、删源用capture、pending及真实utility产出后停止exit、声明503 fixture无假received、两native可达/原旧DB SHA保持。cap8/auto11/Pro6/renderer79/最终隔离build3/main207 ok=true exit0。已实际看question1366/receipt1920，不是整页同DPI或教师真实资料验收。早期模型漏末码严格失败保留，不改图/答案。

学生原图继续147本地OCR校正。用户33640/标准out保持；无真实profile/凭证维护、子agent/commit/push。下一D4真正查看计数/来源缩略图→E/全D1–D7/P08无VPN安装最终八组，整体active。下方前置和旧下一为历史。

## 2026-10-04 D3-C原生图片前置：历史

148/149 shared官方模态+旧cache未知兼容，原Hana450/Pi1.0.2实际prompt/tool图片→官方DeepSeek，最终LanGoJ10严格图内随机码/3红2蓝左右JSON。能力8/原压缩边界11/source verify/build isolated/renderer79/主207 ok=true exit0，未改正式图片开关/UI/IPC/真实profile/out。前置不能当教师上传授权、历史撤销、实际已查看计数、冷恢复或双视口正式图完成；下一明确公开/用途确认及current附件与原Pi/receipt完整D3-C，再D4/E/全D1–D7/P08。用户33640保持；学生图沿147本地OCR校正，不上云补救。

## 2026-10-04 D3-B本地OCR教师校正真实验收

最终收尾147§5：实际源另有web错误分类变化后重建build4，Ehpu4X正式UI11/main4 207/web边界2BmCtG13过，最终双尺寸图再查看；正式out与隔离build4的325文件SHA完全相同/index-ih2qhlIf.js。下面oS1Mij/build3为前一构建证据，原失败不删。

146→147原“+”选合成图→本地固定RapidOCR exe→拒绝/重试/编辑确认→正式Pi/官方DeepSeek read tool→必要脱敏校正/真实来源和原Pro公开过程。最终oS1Mij11 exit0：仅校正文字独有随机码37/8、native无image/待确认原文/学生姓名电话邮箱，原0.80.3副本prefix和原DB SHA不变；真实取消spawn后child exit、无迟到批准，冷恢复批准与删原图capture实读，1366/1920可达与原CSS padding/按钮背景实测、两最终图已看。

native m7an4W10实际SQLite/独立exe/strict/CAS/冷中断/同源版本/跨会话/缺runtime/缺原模型、Pro dnNtiL6、最终renderer79/同build最后主207 ok=true exit0。隔离build3/index-ih2qhlIf.js；源码锁576文件约258.26MiB，不是安装包。早期UI8动态import失败、截图base覆盖组件、最后旧路径一次FK失败均保留147，第二次同build207过未证明FK根因。

新增privateOCR事实/typed接口/原Modal与只批准必要文字读取，不提供同已提交版本原地撤回修改；重新加图校正新版本。扫描PDF/公开图Pi视觉/D4回执/同DPI全页/无VPN安装未验；下一D3-C→D4/E/全D1–D7/P08，整体active、三元暂停。

## 2026-10-04 OCR引擎预验不是UI完成

144→145为原PsOcr本机合成识别：中文/数字/时长3/4通过，OFFICE英文失败，脚本exit1；最终语法check exit0。无生产UI/IPC/表/依赖改动，未重复旧79/207，D3-B教师校正脱敏/公开图Pi视觉仍待实施。下一先真实RapidOCR比较再冻结引擎；140→141浏览器/压缩/cache已交付且browser/cache两verify本轮exit0，独立无VPN安装未验。

## 2026-10-04 最新：D3-A正式已发送附件实读

142→143：实际“+”选五个目录外文本/DOCX/XLSX/PPTX/PDF→message/run/submitted→Pi list/read附件ID→Hana本地worker正文→必要脱敏/真实版本行来源→原Pro公开分段与最终数字/文件独有随机码。正式旧Pi0.80.3副本G5xdpl13 exit0，输入清空、两native/本地预览/指定行、冷恢复且原文件删除后可实读、原DB SHA不变、image/扫描needs_ocr、停止实际worker/exit/无迟到成功、无renderer错、公开无内部字段。

native ycyGbc14实际Store/权限/版本/实读后cancel/分页/原facts保持；只读原0.80.3完整native prefix1和原绑定不变、Pro UxsNNf6/renderer79；独立build4+最后主smoke3 207/207 ok=true exit0，正式build与已验构建319文件SHA全同/index-Dc_4ACac.js。G5xdpl/read-1920实际查看，早期动画透明图已纠正，非全页同DPI一致。

旧工具字段/按钮/状态/观察GC失败及有限范围见143。D3-B/C实际本地OCR/校正/明确公开图视觉、D4真实查看计数、E/全D1–D7/未知参照/P08仍未验；下一冻结D3-B/C合同，总目标active、三元暂停，下方旧下一为历史。

## 2026-10-04 最新：D2-C与浏览器/最新自动上下文验收

138→139已完成正式附件发送/输入草稿清空/历史/本地预览/原子message-run-submitted/重复命令/停止/实际main终止恢复：native14、UI14均exit0。只有元数据发送，未验模型正文/学生OCR/图像查看。

140→141当前构建index-qTz60kcD/Pi1.0.2：浏览器native ALHufX15（另含真实公网/教育部DOM）、正式Pi/DeepSeek界面2ZyInP11（交互为owned协议夹具）、实际自动摘要与中途工具压缩tPD1Dj8、旧0.80.3副本正式续用/两尺寸/重启v9InTC6；均exit0。原Pro browser按钮/原native窗口/实际来源与用量/无预算卡/实际缓存比例/教师确认拒绝/停止可见；截图仅本地。

官方cache IcQ1L6四请求首次0/后三次94.8148%；不限额4/教育记忆17/技能22/历史模型26/压缩边界11/工具协议7/Pro核源6均通过。renderer79/79、最终npm run test:smoke包含build且207/207 ok=true、进程exit0。精确命令、图片、失败与界限见141，不沿用上一构建为新代码证明。

旧18项自动UI人工65536场景失败仍保留，新6项只证明其覆盖；无VPN/Windows安装、同DPI完整像素、D3/D4/E/全D1–D7/未知参照仍未验。下一D3按ID实读与本地OCR/明确公开图，目标active、三元暂停；下方旧“D2-C待接”仅历史。

## 2026-10-04 D2-B正式附件页面有限验收

132§3/136→137：native具体文件→原host choosing/strict主frame六操作→preload→原Pro附件/本地preview/remove，已有实际Pi绑定目录外/workspace不改。实际UI fVx03J24：四图片真缩略/文本Office/部分失败/8上限/取消native与真实utility/正式关闭及时kill/15s/跨会话/副窗和frame/重启/原bytes/双native图已看。不是全Codex像素证明。

真实DeepSeek/Pi rsEirD6（回复input空/独立目录菜单/旧绑定/compact只准入及草稿保持/实际teacher wait/原文字queue-stop）、Office23、边界10 doubles/源码6/owner6/renderer79/最终build+主207 ok=true exit0/index-CKw3Alzb。UI7kJePL19后取消信封错用保留，显式三字段后24，不放宽校验。

D2-B不完成D2/D：附件仍local-only/普通send UI与host prompt暂阻，manual compact与running文字queue保持。下一132§4 D2-C严格selection/message-run-submitted持久准入/真实发送/ledger历史恢复，再D3/D4/E/全D1–D7/P08/未知参照；目标active、三元暂停，公共档案不含DB/profile/env/key/native/选中文件。

## 2026-10-04 真实profile凭证恢复与验收更正

134→135：123隔离成功不代表真实配置可读，原测试helper密文真实profile decrypt失败，原helper profile成功。现已正确实际userData/原Windows codec与CAS保存provider revision2/default deepseek-flash，其他设置保持/running0；另一进程READONLY/官方目录和短连接200。维护不初始化/迁移/恢复实际整库，不在真实教师UI发送任务。

正式隔离UI8bx1qB12（原9+真正异profile密文不可读/验证不保存/明确覆盖再重启），最终Pi/DeepSeek完成且输入空，两native尺寸图已查看。native profile4 HAsxTq/边界19 Y2Lyqd/renderer79/最后build+主207 ok=true exit0/index-CMajNv0Z；失败与更正135保留。只有限当前凭证链，不称真实教师UI、无VPN/安装或全Codex。下一132§3 D2-B正式附件入口，后D2C/D3/D4/E/全D1–D7/P08/未知参照；总目标active/三元暂停。

## 2026-10-04 附件 D2-A入站已验，正式入口尚未接线

132→133完成本地单文件副本/private import事实与生产migration/recover，实际Electron无窗口main/native sqlite3/Store WDTtST20，三owned OS终止/两次重开零重放、目录外副本/源删除版本/迟到取消/上限/跨会话/未知schema等；仅PNG/text本地preview，合成workspace/binding保持非实际Pi续问。D1边界13/实际store4复验、renderer79/最后build+主207 ok=true exit0/index-CMajNv0Z；131旧外键本轮未复现原因未定。

无renderer/typed chooser/preload/start/模型输入改动，不能勾附件页面或发送/查看成功。下一直接132§3 D2B原host owner/native chooser→typed取消期限/main-frame→preload→原Pro附件/本地预览与真实两native/重启，先核原生图片解码/缩略图和Office；§4发送身份/消息-run恢复后再D3/D4/E/全D1–D7/P08。失败与安全档案见133，总目标active、三元暂停。

## 2026-10-04 附件 D1 基础已验，附件前端尚未接线

130→131完成shared/state/service/production session-state增量表；Node SQLite+真实合成文件13项、实际Electron native sqlite3/OmniEduStore4项，重复初始化/关闭重开/陈旧批次零写/真实双文件绑定。原Hana2函数与原Pro5文件核源。无renderer/typed chooser/preload/start附件ID修改；以上不记为用户附件闭环、缩略图或模型已查看。真实DeepSeek合成RGB HTTP200仅直接HTTP，非Pi图像或学生OCR。

renderer79通过，最终产品构建index-CMajNv0Z；main-smoke-final2旧no-provider教育路径外键失败保留截图/131，随后只加安全只读诊断、原断言保持，同一构建复验ok=true207/207 exit0，原因尚未确定。附件新表无正式用户操作，不能借主smoke勾D2/D3/D4。下一132冻结native文件chooser/目录外只读附件暂存/主owner typed→原Pro附件预览移除发送→消息/run事实/真实页面与恢复两尺寸合同；D完整后E/全D1–D7/P08仍active。

## 2026-10-04 有限国内联网与来源已验

128→129正式Pi/Hana搜索/网页读取→safe source时间/read-search/empty-error投影→原Pro来源工具/查看全部→typed本会话真实来源点击/main DNS核验→shell选择。HeroUI/Hana设置实际选应用级阿里、CAS/主frame/busy边界与关闭工具，provider密文/native prefix保持。最终实际UI9uZomc15含自然DeepSeek+匿名搜索+MOE正文、公开分段/空composer、1366/1920时间来源可达、停止/重启不重放、真实失败/关闭/副窗口/伪URL拒绝；OS启动拦截不当用户浏览器验收。

旧native真实Dexx8J3、HTTPdouble边界7JFNQJ13、原源审计8、renderer79/最终build5和主207 ok=true exit0/index-CMajNv0Z。失败xwjMYj11后空白保留原因未定，最终build完成后同完整脚本15通过；公开归档p07-domestic-web和精确命令129。有限C完成，实际无VPN/安装/全D1–D7/未知官方参照未验；下一130附件图像D/E持久goal，总目标active。

## 2026-10-04 实际WPS版面已验，有限Office B完成

126→127仅现成generator排版/Pi Unicode工具直接pin，无typed/renderer/teacher ledger变化。真实DeepSeek正式UI vWOfNs20（四格式修改确认保存打开、拒绝/源冲突/停止/双native/真退出恢复）；随后密集9pt分支单独mixed真实WPS核验。baseline5、八列长内容26、长文/100行58、千字/双空格/换行6，共95页真实图像，85WPS+10原Hana PDF；actual COM完整原内容/数字/文字/公式字面量/输入hash保持，原用户WPS4428/66568不变。layout2提取成功但cell裁切失败已由图发现并修，不能只用文字提取冒充。

最后同功能源码生成LMTjkz12、renderer79、Pro32/Hana PDF2+4/read4、build+主207 ok=true exit0/diffcheck0。微软Office本体/任意资料/无VPN/安装/完整D1–D7仍未验；117/125/127共同满足109有限Office B。下一128 C国内联网/来源，D/E/P08与总目标active。精确命令/失败/许可/原字节公共p07-office-wps-layout见127，既有设计67不变。

## 2026-10-04 正式Office审阅与产物用户链已验

124→125真实Pi/Hana office_create_document→主frame typed review/revise/decide→原Pro ChatTool/Markdown+HeroUI结构化修改→revision/teacher确认→真实四格式/exclusive保存/正式fact来源→原AnyDoc打开。NFyGeK真实DeepSeek20/20：四格式教师编辑/旧确认拒绝/打开、两native1366/1920、拒绝零写、原native身份、parent新版本/旧bytes、source冲突、停止、secondary denied、两真kill/restart及文件先完成后只读verify bytes/mtime不变、再重启零重放。

基础fS2Gjf17/原SDK R33JWX8/host5gUCPM6/旧文本BunUbt8/renderer79/原Pro32/Hana PDF2文件4body/read4/最后同源码主207 exit0及diff0。失败YXP9ms/eZdtl4/vP2pVA/ffAz2n/3YXjLc与精确命令125；四独立格式读取不替代WPS。下一126实际Office-WPS-A4/Excel行高/PPT布局，完整B/C/D/E/全D1–D7/P08仍待，不能提前勾像素与全功能一致。

## 2026-10-04 DeepSeek恢复已验；Office B3b仍仅底座

122→123新主frame typed verify/原配置owner与加密save、候选及旧默认提示。实际隔离Electron IXGvT3 9/9：旧401、错候选401、正确新key200不保存、明确Windows encrypted save/清框、两content尺寸、secondary denied、无env重启、真实Pi对话+empty composer、active busy。实际profile单provider键修复revision1/default deepseek-flash/连接200，原legacy/其他settings保持；未操作当前真实用户窗口、不改旧会话绑定。边界19 zUKOfS、build3/renderer-final79、最后同源码主207 ok=true exit0，失败与范围123。

120→121Office底座17 f35qzG实际SQLite/FS/原Pi queue/三库/四真退出/旧全行保持，dynamic PDF后实际Electron12 hEbv27、旧文本20 84X1hk、原Pro32/Hana源2文件4body+read4通过；**暂无正式Office tool/typed审阅/teacher入口**。下一120§4/5.2细化124→原组件拟内容修改拒绝确认/保存打开/真实来源，B3c实际WPS/自然provider/恢复之后才完整B。C/D/E/D1–D7/P08仍待，不能以底层或主smoke勾完整用户闭环。

## 2026-10-04 P07-B3a生成基础，正式教师入口待接

118→119仅main生成buffer和独立office-generator构建入口，无新teacher tool/IPC/表/renderer。最终IWDeHt12：真实Electron/docx/ExcelJS/PptxGenJS/Hana printToPDF→四实际格式，独立读回中文/尾部/数值/公式文字、DOCX表格A4、XLSX2sheet、PPTX28slides、PDF10页A4/PDFium尾图；字体缺失配置失败/取消与held print deadline真实窗口销毁/暂存清理。不是teacher UI/Office-WPS实例，旧export未替换。

协议17/renderer79/原Pro32/Hana PDF2文件4body/read源4，build-font-final/index-Bpg_2XBD与最后同源码主207/207 ok=true exit0；原正式Office读取真实DeepSeek17 P5M6v8。精确失败/源码/版本/license/公共证据119。下一120 B3b原artifact事实/private draft/typed/原teacher wait/registry/原Pro确认与实际保存打开，再B3c自然provider/两native/恢复/WPS；完整B3/B/P08/D1–D7仍未验。

## 2026-10-04 P07-B2正式Office模型读取用户路径

116→117，同Pi/Hana native工具/utility/main-only版本stat→typed原preview/原Pro公开来源；build5及最后同源码主207/207 ok=true exit0，renderer index-Bpg_2XBD。真实DeepSeek UI17 b27lxm含四格式/数值归纳/模型脱敏正文/来源提取行/公开实际分段、actual1366与1920本地preview对照/同native范围续问prefix、300文件指定路径、扫描损坏缺映射超大failed、model+preview共8actual native/第9busy/停止等exit/原bytes/重启不重放。held dispatch不称真实parser卡死。

新boundary6/实际FS+parserdouble8/hostdouble4/严格协议17、renderer79/Pro32/source4；B1真实预览23 tYtMQS、旧文件22 qRevNY/UI25 F4sO2t、真实旧copy+同历史模型审批13 whNl7Q通过。每种范围与失败报告分开保留117及公共原字节归档；不归档DB/key/native JSONL。下一118 B3真实受控Office产物、Office-WPS-A4；无VPN现场/Windows安装/完整B与D1–D7/P08未验。

## 2026-10-04 P07-B1本地Office正文预览

114→115 same renderer index-CualzS98/build3与最后主smoke207/207 ok=true exit0；renderer79/Pro32/source4/协议17、旧文件边界22 Cdo0No和真实旧文件UI25 ONKzTP。新真实UI23 iJFcl1：实际utility/native AnyDoc→typed→原文件面板四格式/中文/表格/两页、扫描/不可解码/损坏/超大/版本/取消/实际子进程deadline kill（held dispatch）、原bytes不改/两native尺寸/普通重启。原失败夹具与能力边界115保留，原字节p07-office-documents。

无模型/provider任务或正式导出，禁main fetch/browser HTTP不称VPN关闭验收；Office/WPS/A4、agent正式Office读取、Windows安装与完整B/P08/D1–D7未验。下一116 B2正式工具/native增量/必要脱敏/来源→真实DeepSeek任务；本地preview不当资产parser-ready。

## 2026-10-04 P07-A2/A3正式文本用户路径

112→113贯通正式Pi新建/修改、持久teacher wait、主frame typed、本地原Pro差异审阅/文件当前版本打开/显式undo及核验。自然真实DeepSeek最终16 HXcPmt，两actual native尺寸，原Pi行号diff等值/拒绝零写/批准精确after/旧创建身份保持/undo与手工冲突/源版本冲突/停止/实际pending退出/重启/SQLite回读；旧preview失效和刷新实际恢复正文也验。coordinator8/host6/foundation20、原copy和同历史模型13、renderer79/Pro32、最终主smoke及commit cuts精确命令/报告/bundle见113，不用确定性报告代替provider。

另真实恢复UI9 hWop58：教师确认→main实际文件提交/撤销后ledger outcome前杀树→startup uncertain/undo_uncertain→教师页面verify只读分类；两actual native核验按钮可达，文件bytes/mtime不改、不重建撤销文件及普通重启保持。build7仅新增未打包/E2E明确启用的main故障切点，renderer不改。Hi5An0的11后过度澄清超时及w62l3r连接清理问题保留；修正仅office指引、原native行号展示、owned杀树/协议清理，原任务/断言保持。有限文本A完成；Office/PDF正文/导出/国内联网/附件/持续goal和P08/全D1–D7未完成。下一114合同先重核Hana提取与现有parser/export，原字节p07-text-review。

## 2026-10-04 P07-A1：编辑基础通过，正式UI未接

110→111，build2/main改变但renderer仍index-BM1rsdTp；renderer79/原Pro32和最后同源码主207/207 ok=true exit0。新foundation20/20 W2QfNr只实际SDK/SQLite/FS/并发、四真子进程退出/只读核验与旧隔离DB全行迁移，无provider/UI/IPC；不能以原主207称新增编辑用户路径。

下一冻结112 A2/A3：正式Pi create/edit工具、teacher wait/持久审批、旧native快照增量能力版本、main-frame typed/全局owner、原组件审阅/修改回执/打开/撤销；真实DeepSeek自然任务和两native窗口拒绝/批准一次/冲突/stop/重启/readback后才完整A。原字节p07-text-foundation与精确命令/边界见111；全D1–D7/B/C/D/E/P08仍未完成。

## 2026-10-04 P06d-F原生阅读中断与键盘实例

107→108，固定index-BM1rsdTp；build/renderer79/Pro32/overlay2。真实reading16 55Ntl1 actual1920×1080与reading16 NOm6wY actual1366×768；原流式顶部/中段段落身份和offset、真实增长/终态、原回底smooth中断→600ms位置保持→下一actualwheel顶部、实际点击聚焦PageDown/Home、文件设置阅读草稿与composition协议/native字符/session隔离通过。真公开过程17 A1qTbY/审批5 k8W8WQ/菜单10 Sj3qPH；最后同源码主207/207 ok=true exit0。

hJmnW6证明已在途smooth上读后继续到底，0Veaft第一修复停止但新增夹具误判wheel必须同时到0；修fixture仅新中断路径，原stream断言保持。旧Qx/ehqyar缺时序不能声称同源。失败/源码/原字节图与SHA见108和p06-native-reading/artifacts.json。Windows真人IME、真实网络故障/VPN-off/安装及完整D1–D7/P07未验；下一109→冻结110正式编辑审阅/提交/版本撤销，不无限重复局部阅读。

## 2026-10-04 P06d-E壳锚点与长阅读实际实例

105→106；固定index-TO1Rvh_r，build/renderer79/Pro32/overlay源2。真实reading13两轮7Fav0X/qxTanz（actual native1366/1920、真provider75段历史/新增delta/轮次结束、原回底、文件设置同段落/草稿/焦点、composition协议/native字符/session隔离）；files25 nGMR4b/process17 X1Bkph/menus10 JqTRNn/process-approval5 VdPg8z/approval22 se4WUl；最后同源码主207 oktrue exit0。

原R2/current row500主白区均x459与底色匹配，不是全页精度。早期ehqyar/QxVuUo流式上读失败仍原因未明，后两完整成功不关闭稳定性；下一107诊断，不能删失败或放宽段落断言。Windows真人IME/真实断网/无VPN/OfficePDF/安装未验。精确命令、五类失败、边界与原字节SHA见106/档案p06-shell-reading。


## 2026-10-04 P06d-D审计与窗口恢复实例

| 范围 | 最终证据 | 实际边界 |
| --- | --- | --- |
| native菜单/导航/主frame，两native窗口/125%/恢复normal三次/最大化/坏值/越界/写失败/rollback | OUBtNz 31/31 | 真Windows owned窗口，零provider；真实硬件多屏/DPI切换未测 |
| 文件/版本/树/阅读min360/双native窗口/重启/归档 | XuZm2g 25/25 | 无Office/PDF正文/provider，合成PNG decode/chooser受控 |
| 原权限/模型菜单与侧栏/两设置返回未发draft | dpbdKr 10/10 | 真实typed/main，chooser取消受控 |
| 公开分段/工具/来源耗时/compact/待答/重排/停止/重启 | E13656 17/17 | 真DeepSeek合成教研任务；CSS viewport，native caption由31专项证明 |
| 最终门禁 | build5/index-DC37aI59/renderer79/state8/源size2+overlay2+Pro32/主207 oktrue exit0/diffcheck0 | 83 UI不是完整D1–D7；报告/四次失败/像素审计见103→104，原字节p06-full-gap |

已读图原R2/current近同物理尺寸主白区x459 vs549、sidebar色不同，完整壳精度未通过。下一105先归一化锚点校准与真实长历史/焦点/IME/等待失败；完整P07/P08保留。下方旧下一均历史。

## 2026-10-03 P06d-C计划/文件/失败恢复实例

| 范围 | 证据 | 实际边界 |
| --- | --- | --- |
| 原计划steps/status与待答任务摘要展开/回答/queue/停止kill重启 | PlN0zo 21/21 | 真DeepSeek和native control；当前run计划，不是持续goal |
| 原typed文件/版本/本地图像/树开关/刷新/窄面板/重启/归档撤权 | Q5P82h 25/25 | 无provider/PDF正文；chooser受控，双actual native content尺寸，min pane360重启360 |
| partial预算失败→恢复草稿不覆盖/不自动run→教师修改发送 | y3CQ82 7/7 | 真provider工具完成后native下一请求拒绝；不是断网测试，零文件写重放 |
| 公开过程/实际来源耗时/失败展开/压缩/待答/重启/几何 | QEPFHQ 17/17 | 真DeepSeek自然合成任务，公开分段原顺序，不暴露隐藏推理 |
| 原权限模型菜单/侧栏搜索/两设置入口草稿 | hzdKGx 10/10 | 实际控件，chooser取消受控，无新授权 |
| 最终门禁 | build-final2/index-CM_ZZWMG/renderer79/Pro32/主207 oktrue exit0 | 相同源码重建同入口，gitdiffcheck0；全D1–D7/办公/VPN-off/安装未完成 |

合同101/验收102；81原字节证据p06-plan-files-failure/artifacts.json，四次文件失败与修复边界见102。下一103综合整体验差距审计，不用局部80项UI覆盖全部目标；下方旧下一均历史。

## 2026-10-03 P06d-B控制表面与设置往返实例

| 范围 | 证据 | 实际边界 |
| --- | --- | --- |
| 真实问题/计划/点选不发→明确发送/自由答/SDK队列消费/停止重启 | PXoiay 20/20 | 真DeepSeek，owned data/profile；Stop12px、回答15px/400；无隐藏推理/伪重放 |
| 队列编辑模式/撤回/文件重排草稿/流式与真实dispatch kill | KwUErj 16/16 | delay为main-only E2E seam，真实模型流式/kill/restart独立；不称完整办公验收 |
| 两窗权限/模型Popover/侧栏21与15px/搜索/两设置入口草稿 | 1eDv07 10/10 | 真实控件与原菜单；chooser取消受控，零授权/run |
| 原完整统一设置/active原生Settings→Back/重启与prefs归档备份 | QcXMZd 26/26 | 真官方回复、同run保留，六页双窗完整动作；记忆仅原空scope，不代替含资料撤权专项 |
| 拒绝零写/确认一次/重启与双窗审批 | DTwvhU 5/5 | 真provider、本地合成copy，批准/拒绝完整矩形与实际图 |
| 同native历史Flash→Pro→Flash/active拒绝/重启真实回忆 | 3I0Jce 12/12 | 当前官方两模型、真实请求；同会话identity/readback |
| 最终门禁 | build-final3/index-Og7f867L/renderer79/Pro32/主207 oktrue exit0 | 最后test:smoke同源码重建同入口，gitdiffcheck0；不是全页精准/VPN-off/安装 |

合同99/验收100；73原字节图/report/log/source在p06-control-surfaces/artifacts.json。下一101 P06d-C，完整D1–D7/P07/P08仍未完成；下方旧继续位置为历史。

## 2026-10-03 P06d-A阅读与输入实例

| 范围 | 证据 | 实际边界 |
| --- | --- | --- |
| 公开分段/知识库与文件工具/实测时长/缺失失败/压缩/待答停止/重启 | QrIEtt 17/17 | 正式main/typed UI与真实DeepSeek；合成资料，隐藏推理未进DOM；文件重排不发队列草稿 |
| 长标题技能导入默认关闭/启用/选择/预览；草稿/技能在文件开关保留、新会话清空 | jVR4nR 9/9 | 原Skills API/可操作UI；native chooser返回受控；无provider完成证明来自此布局套件 |
| 审批拒绝零写/确认一次/重启 | NbmawZ 5/5 | 真DeepSeek与本地合成copy；两viewport等待可达；没有新增模型切换专项 |
| 正文/输入与工具栏 | content1366×768/1920×1080 | 实际p16px/27.2px/深灰；边线差6.67/2.33CSSpx；默认与长技能单行，参考DPI未知 |
| 最终门禁 | build-final4、renderer79、Pro来源32、npm test:smoke207 | 最终index-D4i0noIl；主oktrue exit0，不等于全页精准或最终办公验收 |

合同97/验收98；30原字节证据p06-chat-reading/artifacts.json。下一99 P06d-B控制卡/侧栏/权限模型弹层；D1–D7/P07/P08仍未完成。

## 2026-10-03 P06c-C统一设置实例

| 范围 | 证据 | 实际边界 |
| --- | --- | --- |
| 六分类/能力搜索/目录/偏好重启/归档阅读/本地备份/真实回复与active设置往返 | 最终 H8Y85u 26/26 | 正式main→typed preload→UI，owned新库/profile；chooser受控、归档typedfixtures、空scope保存清空，不称含资料模型撤权 |
| 原Skills Modal完整用户路径 | PPOo0w 25/25 | 真DeepSeek技能/reference/compact/版本/撤权/重启；统一页最终CSS后Modal/host未变 |
| 备份global owner/close/file与原model锁 | Wk67Qg 7/7；fi7Mmc 6/6 | 真SQLite/file，controlled异步barriers，无provider请求 |
| 双content窗口所有页几何 | 1366×768 /1920×1080 | 12图；读取780、无横溢出、关键动作与返回完整矩形可达，不是未知DPI像素全一致 |
| 最终门禁 | build-final3 / renderer79 / 主207 | index-CQ0eiDPc固定out，主oktrue exit0；Hana5/Pro32仅来源 |

详见95→96；原字节design/codex-2026-10-03/p06-settings。下一P06d精准D1–D7/P07/P08，总目标未完成。

## 2026-10-03 P06c-B2/B3正式同历史模型实例

| 范围 | 最终build-final2证据 | 实际边界 |
| --- | --- | --- |
| 同一真实菜单Flash→Pro→Flash/首轮标记/重启/陈旧/active/发送清空 | ZA9F90：12/12 | 正式Electron与真实DeepSeek，native assistant.model核验；实际content1366×768/1920×1080、DPR1.5，无横溢出/完整Send |
| pending审批锁模型、拒绝零写入/确认一次、停止后切换/重启 | iYxogy：13/13 | 真实模型和本地文件，owned合成目录，chooser返回受控；native文件/history/审批保留、不重放 |
| 生产authority隔离/模型restore/实际SDK compact模型 | A02kF1：10/10 | 实际组装/SQLite/JSONL；一个受控Pro摘要HTTP，无live completion |
| 全局host关闭/归档/阶段恢复/官方移除/容量/旧B1迁移 | 7VicZk：9/9 | 实际host/service/native，owned副本与受控目录8请求；源app.db hash不变 |
| 固定最终out仓库门禁 | p06cb2-main-smoke-final3：207/207，ok=true exit0 | owned独立DB+Electron profile，仍为旧教育路径门禁，不冒称完整Codex功能 |

同轮原native26/迁移10/state18/host6/Skills22/真实auto7/renderer79与Hana源3/Pro32通过。精确命令、失败、原字节图/report与权限边界见94；代码链shared/main/typed preload/正式现成模型菜单已完整，旧B1菜单封闭口径为历史。稳定图修长权限+Pro挤住Send，窄窗口必要两行仍须D5精准视觉；整体同DPI/完整设置C/Office-PDF/无VPN安装仍未证。

## 2026-10-03 P06c-B1范围记录：主进程基础，无新前端模型路径

docs/91→92：实际SDK/SQLite/JSONL基础26/26、旧/新迁移10、A模型state18/host6、renderer79及最终build3通过；固定out主smoke最终见92确认项。新增账本/意图与native恢复只接生产增量建表。**正式有历史菜单仍锁定，getBinding仍拒绝5，B2/B3前端路径/真实provider续问/双viewport未运行。** 不把B1基础或既有主smoke207叫同历史模型菜单实例；下一按92第4节正式接线再验。设计基准R1/R2和完整精准视觉仍按67。

## 2026-10-03 新增P06c-A正式模型设置实例

docs/89→90，最终build4，真实模型设置18/18 F4JfSS：正式可见入口、无环境凭证首次配置、官方目录、真实Flash/Pro新会话调用、默认Pro时已有Flash继续、空会话选择、Windows safeStorage密文读写、无环境Key重启、故障/陈旧/active拒绝/副renderer/旧入口及owned坏密文修复。实际1366×768/1920×1080 content、无横溢出、名称一行/保存可达；图report在p06-models。state18/host6/能力11/renderer79通过，最终主smoke与native门禁见90第2节。已有历史同会话切换B/完整设置C/D1–D7/P07/P08仍未完成，不能把新聊天模型选择叫同一历史切换或完整视觉。

## 2026-10-03 新增P06b-B3实际原生框架实例

docs/88最终build5：pi-native-chrome-ui-smoke21、pi-workspace-files-ui-smoke22、开启OMNI_EDU_E2E_PI_CHROME_MODE的真实DeepSeek公开过程13、审批5、renderer79/固定out主smoke207均exit0。窗口由实际BrowserWindow.setContentSize(1366,768)/(1920,1080)而非emulated viewport，含own-window native控件图、DPR1.5、125% safe area、原菜单callback/accelerator、真实nav/归档/晚到/重启/rollback与sender拒绝。图report p06-native；没有OS菜单项/native caption buttons人工逐点击、未知参考DPI整体叠图、其他OS/无VPN或安装证据。完整D1–D7/P06c/P07/P08仍待完成。


## 2026-10-03 P06b-B2当前验收

| 范围 | 最终证据 | 真实边界 |
| --- | --- | --- |
| 教师本地文件tree/tab/preview/失败/拖宽/关闭/会话与重启/归档 | taw9qA正式Electron22/22 | 受控chooser、合成资料、最终build7；PDF/Office未支持正文 |
| main有界文件/实际IPC函数 | rGRSMC22/22 | 真磁盘/10秒timeout/权限和8槽；sender为明确函数seam |
| 模型active过程与本地preview | PhSxGp真实DeepSeek13/13 | build6，后仅只读deadline修订独立验；非无VPN证明 |
| 最终代码兼容 | build7 exit0、renderer79、main207/oktrue、审批f4M5MX5、源32 | docs/86精确命令/先后/失败，原始图p06-files |
| 完整Codex/native框架/设置/Office-PDF/安装 | 未完成 | P06b-B3/P06c/P07/P08继续，参考DPI未知 |

## 2026-10-03 P06b-B1当前验收

| 范围 | 正式证据 | 状态/边界 |
| --- | --- | --- |
| 实际Pro壳/会话操作/开关/偏好重启 | ca08ah 10/10；双视口1366×768/1920×1080 | D4.1通过，资料卡不等于文件preview |
| 唯一Pi实际DeepSeek过程与原审批 | eDjvkc 12/12、WVsGFB 5/5 | 真provider/合成数据/受控chooser；不是人工教师/无VPN证明 |
| 固定最终out/源闭包 | build4 exit0、renderer79、main207/oktrue、Pro32 | 具体命令/图/失败见docs/84 |
| 完整Codex视觉/文件面板/原生框架/安装 | 尚未验收 | P06b-B2/P06c/P07/P08继续，原图DPI未知 |

## 2026-10-03 真实公开过程闭环

| 能力 | main/backend | typed preload/frontend | 实际E2E | 未完成边界 |
| --- | --- | --- | --- | --- |
| 实时说明/真实工具组/来源/状态/时间 | Pi公开text+实际call、单调时间、脱敏相对source、已有usage持久回读 | 既有typed snapshot/OfficeConversation、原Pro ChatTool/Group及逐项Disclosure | 真实DeepSeek12/12：54wIzX，native/main/UI顺序、活动期间可见、缺文件失败、compact、停止、双视口和重启，docs/82 | 精准字形/间距/图片/整窗壳及参考DPI门禁未通过 |
| 审批拒绝/确认实际效果 | 既有main持久决策/复制防重/readback | 实际等待/拒绝/批准控件与过程状态 | 真实DeepSeek5/5：jkD3PD，拒绝零写入/确认一次复制/双视口/重启不重放 | 合成测试资料，chooser返回受控；实际无VPN/安装尚未验 |

最终build/renderer79/固定out主smoke207通过。当前测量before/after/live和报告持久保存，D1.1/D2.1/D3.1子项通过不替代D1–D7父项；下一P06b合同与壳/面板。

## 2026-10-03 正式技能管理用户闭环（历史）

| 能力 | main/backend | typed preload/frontend | 实际E2E | 未完成边界 |
| --- | --- | --- | --- | --- |
| 本地导入/预览/启停/编辑版本/归档再导入 | 精确validation/安全metadata/CAS/原生chooser/global lock，API15/host9 | 三typed IPC与正式PiSkillSettings/Hana Row/Badge，loading/cancel/error/stale/locked反馈 | 正式Electron/DeepSeek25/25：pi-skill-settings-ui-jiulSs；双视口/真实native read/compact撤销/重启/源坏零请求和关闭恢复，docs/80 | chooser返回由main注入，未称人工Windows chooser；真实教师数据未修改 |
| 既有内建及全局样式兼容 | 原生资源/read/来源校验沿B2 | 官方HeroUI3.2.2 compiled CSS与Switch.Content，输入菜单和发送清空 | 内建真实12/12：wJ1doF；最终renderer79/79、固定out主smoke207/207 | 完整Codex视觉D1–D7和实际无VPN安装未完成 |

P05技能框架既定范围完成，P06精准视觉/设置、P07办公联网、P08安装与完整实例继续。下方B2“尚无管理”是历史阶段，不覆盖此处。

更新时间：2026-08-12

这份矩阵把“主进程/SQLite 已实现”与“老师在界面上可用、可验收”分开记录。`backend` 只表示已有安全入口，`frontend` 表示 renderer 已通过 typed preload 接线，`e2e` 表示现有 Electron smoke 从用户点击路径验证过。任何一列未完成，都不能称为生产闭环。

## 2026-10-03 小智技能生产接入切片

| 能力 | main/backend | typed preload / frontend | 实际E2E | 未完成边界 |
| --- | --- | --- | --- | --- |
| 有效技能目录/原生执行/来源失败 | 正式skill目录初始化、必要脱敏资源/受限read、全局锁、v4；docs/78 | 既有snapshot/技能选择与说明/错误投影、Pro ChatTool隔离回执 | 最终Electron/DeepSeek12/12：pi-skills-ui-3IuhjF；双视口、发送清空、自动read、知识检索、重启续问、源变化零请求/中文失败 | 本轮未通过用户管理操作触发skill隔离；原生SDK22另证明隔离边界，不能当管理UI |
| 旧A技能会话升级 | v3/v1严格main RUN迁移到v4/v2，append-only | 实际会话导航/输入/续问/重启 | 实际旧隔离副本7/7：pi-skill-existing-ui-kNrp5W；新prompt无预期marker、两次真实续问、全部源字节保持 | 没有修改真实教师库；无RUN的非空SDK-only旧历史明确拒绝 |
| 教师导入/编辑/启停/归档管理 | main-only方法与native chooser生命周期锁9/9；目录/CAS25/25 | **尚无management IPC/preload/设置页** | **未验**，下一P05-B3 | 不能称教师管理闭环；须真实导入→启用→编辑/关闭→真实摘要撤销→重启 |

整体Codex视觉D1–D7仍未完成；主桌面固定out207/207仅旧主路径冒烟，证据docs/78。

## 主闭环

| 能力 | 后端/主进程入口 | preload / renderer 入口 | 当前 UI 状态 | E2E 证据 | 边界与未完成 |
| --- | --- | --- | --- | --- | --- |
| 错题图片导入 | `attachments:import`、`store.importAttachments` | `window.omniEdu.importAttachments`、`MistakesWorkspace` | 已接线：导入中、成功、取消、部分失败/失败、空态 | Electron 点击具体错题“导入附件”，经生产 handler 的受控 E2E dialog 返回真实 PNG，验证复制、SHA-256、SQLite、取消零写入 | 非 E2E/打包版本仍调用原生系统 dialog；Playwright 不操作 Windows dialog 窗口本身，不能误报为 OS UI 自动化 |
| OCR 待处理 | `mistakeImages:createAnalysis`、`createMistakeImageAnalysis` | `createMistakeImageAnalysis`、`create-ocr-*` | 已接线：真实 `needs_ocr`，不伪造 OCR 文本 | 同一 smoke 验证 `listMistakeImageAnalyses` 回读 `needs_ocr` | 当前没有 OCR 引擎，教师输入/修正是明确的人审入口 |
| 教师修正与脱敏 | `mistakeImages:updateCorrection`、`mistakeImages:sanitize` | `mistake-correction-input`、`mistake-sanitize-button`、`mistake-save-correction` | 已接线：保存后状态为 `teacher_corrected`，显示替换记录 | smoke 验证手机号脱敏与 SQLite 回读 | 只上传脱敏文本；原图路径不进入模型请求 |
| 小智分析入口 | `ai:runDeepSeek` / `ai:runDeepTutorConsole` | `runAiConsole`、`mistake-send-ai`、AI 对话区 | 已接线：切换到 AI 视图，失败消息可见 | smoke 在无 API Key 情况点击并验证 `ai-output-error` | 真实 provider、合法 key 和模型质量需单独 live gate |
| 三元题组草稿 | `confirmations`、`save_exercise_set` | `mistake-triplet-panel`、可编辑 stem/answer、来源标签 | 已接线：草稿可编辑，确认/拒绝分离，显示 `local_bank/teacher_resource/generated` | smoke 验证拒绝零写入、确认后 exercise set 回读与重启持久化 | **已知缺口**：编辑值只在 renderer 预览，现有确认接口仍保存原始 payload；UI 已明确警告，不能宣称编辑后保存 |
| 已确认题组回读 | `exerciseSets:list`、`listExerciseSets` | `ExerciseSetLibrary`、错题工作区第 5 步 | 已接线：loading/empty/error/content、只读刷新、题目角色与来源标签 | component 新增 5 个状态；Electron 新增 9 个路径，覆盖确认后 UI 回读、来源、刷新零写入、学生隔离、重启与双视口 | 正式题组只读；修改必须重新生成草稿并再次教师确认，不复制题本或另建数据真源 |
| 复习提醒 | `review:getReminder`、`getReviewReminder` | `ReviewReminderPanel`、“今日”导航 | 已接线：no-student/loading/error/clear/upcoming/due、只读刷新、证据跳转、隐私边界 | component 新增 6 个状态；主 Electron 新增 10 个路径，覆盖真实到期记录、刷新零写入、清空、学生隔离、重启与双视口 | 实时派生自本地学习记录，不保存第二份队列；只返回知识点/调度投影，不含正文、答案或附件路径 |
| 本地复盘报告生命周期 | `reports:generate/update/list`、`review_reports`、初始 Markdown 快照 | `generateReview/updateReport/listReports`、`ReviewReportWorkspace`、“复盘”导航 | 已接线：no-student/idle/generating/draft/saving/saved/error、历史、证据、质量检查、学生隔离 | component 新增 8 个状态；Electron 新增 15 个路径，覆盖日期零写入、生成、SQLite 编辑保存、源记录、质量检查、历史、隔离、初始文件、重启与双视口 | 生成立即写 SQLite 草稿和初始 Markdown；后续“保存修改”只更新 SQLite，不重写快照；最终文件必须用文档导出 |
| 教师确认队列 | `aiConfirmations:list/confirm/reject` | AI 面板与错题题组确认按钮 | 已接线：确认/拒绝走 typed preload，稳定 `data-testid` | smoke 从 AI 确认按钮点击并验证 SQLite `exercise_sets` + restart readback | 复杂并发确认、过期版本冲突仍需专项 E2E |
| Question Notebook 管理 | `questionBank:create`、`questionNotebook:*` | 自管理 `QuestionNotebookWorkspace`、题本导航 | 已接线：教师录题、搜索、收藏、分类重命名/软删除/恢复、使用历史、冲突/空态/失败态 | component 9/9；Electron 点击验证 canonical 创建、来源防伪、零写入校验、版本冲突、usage、重启 readback | generated 来源只允许既有 AI 产物链；真实 provider 自动入库质量仍需 live gate |
| 教师备课本 | `teacherNotebook:*` 与既有 SQLite CRUD | `TeacherNotebookWorkspace`、备课本导航 | 已接线：创建/编辑、版本锁、软删除、include-deleted、notebook 恢复 | component state 6/6；Electron 点击创建/编辑/删除/恢复并重启回读 | record 没有 restore IPC；已删除记录只做审计展示，不能称为可恢复 |
| 文档导出 | `documents:exportArtifact`、`exportDocumentArtifact` | AI 历史消息产物入口、本地工作目录/选址导出 | 已接线：Markdown/PDF/DOCX、导出状态、路径、SHA-256、面板内失败提示 | Electron 从历史会话点击三种产物；验证 PDF Unicode bytes、DOCX 样式与 >10K 正文、真实文件/SQLite hash、空正文零写入及重启回读 | 基础文档闭环已覆盖；复杂分页、嵌入字体、表格、图片和公式仍未完成 |
| Agent run/trace 与回归观测 | `aiAgent:listRuns/getMemoryTrace`、`aiObservability:*` | `AiObservabilityWorkspace`、分析导航 | 已接线：SQLite 快照、回归报告、真实 gate、最近 run 和 bounded L1 轨迹 | Electron 点击生成报告，验证 gate、原始 prompt/hidden reasoning 不渲染、重启回读与双视口截图 | 报告如实显示 warning/failed；Markdown/HTML 导出与失败样本自动回放未完成 |
| Teaching Book 创作管理 | `teachingBook:*`、book/chapter/page/block/source/health/patch SQLite 能力 | `TeachingBookWorkspace`、讲义导航 | 已接线：结构创作、版本编辑、整块/选区 patch、来源健康、安全预览、导出、归档审计 | Electron 从点击创建到 SQLite/文件 hash、重启 readback 和双视口；Teaching Book 专项 smokes 共 130/130 | 当前 UI 绑定手工来源；归档没有 restore IPC，保持只读；预览不写文件，导出需教师点击 |
| L1/L2/L3 记忆治理 | `aiMemory:*`、`aiMemoryL3:*`、evidence graph、governance | 自管理 `MemoryGovernanceWorkspace`、L2 记忆导航 | 已接线：候选/采纳、修订、停用/恢复、L2 软删除、修订历史、证据图、治理报告、冲突/空态/失败态 | component 14/14；Electron 从真实 run/event 点击验证零写入、版本冲突、SQLite 回读、重启与双视口 | deleted L2 只读审计，不伪造专用恢复语义；不展示 raw prompt、hidden reasoning 或学生正文 |
| 学习路径 | `mastery:getPath`、`ai_mastery_paths` | `getAiMasteryPath`、`MasteryPathWorkspace`、“学习路径”导航 | 已接线：按当前学生读取 loading/empty/error/content，显示版本、追加/替换模式、模块与知识点类型 | component 新增 5 个状态；Electron 新增 9 个用户路径，覆盖 v2 SQLite 回读、刷新、学生隔离、AI 交接、重启与双视口 | 只展示教师已确认路径；不把路径顺序伪装成掌握率，修改仍须由小智草稿进入教师确认 |
| 全局聚合搜索 | `search:all`、`store.search` | typed `searchAll`、`GlobalSearchWorkspace`、“搜索”导航 | 已接线：idle/loading/error/empty/results，跨学生返回学生与学习记录，结果可打开学生或按标题定位所属时间线 | component 新增 5 个状态；Electron 新增 9 个用户路径，覆盖空查询、学生/记录命中、导航、无命中、重启与双视口 | 仅检索本地 SQLite，不调用模型；输入限 200 字符，记录仍以所属学生时间线 readback 为准 |
| 学生档案生命周期 | `students:update/archive/export/openFolder` | `StudentProfileLifecycle`、学生导航 | 已接线：新建/编辑表单、打开目录、导出路径与文件数、归档二次确认、成功/取消/失败、归档只读 | component 新增 11 个状态；Electron 新增 13 个用户路径，覆盖 SQLite 编辑同 ID、真实 `metadata.json`/记录、导出取消零文件、归档取消零写入、确认、学生隔离、重启与双视口 | archive 只有单向状态变更，没有 restore IPC；归档后禁止编辑和再次归档，不伪造恢复 |
| 完整数据备份与校验 | `app:exportDataRoot/verifyDataBackup`、v1 manifest、SHA-256 | `DataBackupPanel`、设置导航 | 已接线：idle/exporting/verifying/export success/verify success/verification failed/cancel/error，显示路径、文件数和问题清单 | component 新增 7 个状态；Electron 新增 12 个用户路径，覆盖真实目录/manifest、相对路径与 SHA-256、清洁校验、篡改和清单外文件、取消零写入、重启与双视口 | 只证明复制与完整性校验，不提供自动恢复或跨磁盘灾备；E2E 仅在未打包进程注入系统目录选择结果 |
| AI 对话库生命周期 | `aiConversations:create/list/get/append/move/rename/archive`、本地 SQLite | `AiConversationSidebar`、AI 导航、设置页归档审计 | 已接线：empty/working/success/error，新建文件夹/对话、重命名、拖放分类、会话/文件夹归档二次确认 | component 新增 7 个状态；Electron 新增 14 个用户路径，覆盖空名称零写入、SQLite 创建/重命名/移动、归档取消、单会话归档、文件夹级联归档、设置页、重启和双视口 | 归档只隐藏且不删除消息；当前没有 restore IPC/UI，不伪造恢复。拖放验证为 Chromium/Electron DOM 交互，不代表触控辅助交互已验收 |
| 小智质量评审生命周期 | `aiObservability:create/list/getUsabilityReview/getSummary`、`create/listReplayExperiment/getReplaySummary`、`create/listModelGrade/getModelGradeSummary`、SQLite | `AiQualityReviewWorkspace`、设置导航、typed preload | 已接线：loading/idle/saving/importing/success/error、单条评分、CSV/TSV 文件或文本预检、失败回放、before/after、Grader 只读 | component 新增 8 个状态；Electron 新增 16 条，覆盖两类零写入、人工评分、SQLite summary、AI 输入回放、实验关联/delta、CSV、`graderMode`、重启和双视口 | 全行预检失败保证零写入；逐行 IPC 运行中失败可能已有前序行，UI 如实提示按 sampleId 检查。模型 grade 只读，deterministic proxy 不冒充 `llm_judge` |

## 后端已有但前端/E2E仍缺失的能力族

| 能力族 | 后端 / preload | renderer / E2E | 下一步边界 |
| --- | --- | --- | --- |
| 待下一轮反向审计 | 以 typed preload 与现有主进程 handler 为清单 | 不按“未被 renderer 调用”机械造页面 | 先确认教师是否已有入口、状态与 E2E 是否完整，再确定下一项；本轮不新增后端能力 |

## 状态定义

- **后端已实现**：主进程、SQLite、权限/边界和 typed IPC 存在，并有对应低层 smoke。
- **前端已接线**：用户无需手动切换内部模式，入口能显示 loading、empty、success、failed、needs review 等真实状态。
- **E2E 已验证**：在 Electron 生产构建中，从点击开始验证最终状态和数据 readback；不能用单独的函数调用替代。
- **live 未验证**：没有可用的真实 provider/API Key 时，只能报告 no-key/blocked；不能把 proxy 或 deterministic 结果称为真实模型质量。

## 本轮验收命令

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run build
npm run test:renderer-components
npm run test:ai-structured-reply
npm run test:smoke
```

`test:smoke` 在同一份 Electron 流程中使用 1366×768 和 1920×1080 两个 viewport，当前前端验收 207/207：在既有 191 条上新增小智质量评审 16 条用户路径，覆盖空表单/非法 CSV 零写入、人工评分、SQLite summary、失败样本回放到当前 AI 输入、before/after 关联实验、score delta、合法 CSV 导入、只读 `graderMode`、重启和双视口。组件状态验收为 79/79。两张质量评审截图已人工复核无裁切、重叠或不可达操作，并持久化到 `apps/desktop/test-results/electron-e2e/`（Git 忽略）：1366 评分态 SHA-256 为 `46B583B32B4363EDAA4C5653C5AE064CD7FE73BA214E4AB332C14C00B879F5A4`，1920 实验态为 `BCE546CD9997A69C4C5473A692CD936B350AD0807B541C7499BA7B45FAD25254`。

本轮通过重新索引后的代码图和定向文本比对审计 140 个 preload 方法。没有 renderer 调用的 15 个方法中，`runDeepSeek` 是已被 `runDeepTutorConsole` 替代的兼容入口，若干 `get*`/`list*` 是测试 readback 或内部详情入口；不能按“未调用数量”机械新增页面。真正的优先级以教师可见操作是否完整和主 Electron 是否有用户路径为准。

## 下一步顺序

1. 重新从 typed preload 与主进程 handler 反向审计下一项“后端已实现但教师入口/状态/E2E不完整”的能力，不按 API 数量机械新增页面。
2. 优先补真实用户动作、SQLite/file readback 和重启证据，不新增后端能力或独立 smoke。
3. “编辑后的题组覆盖确认 payload”需要调整现有后端契约，不属于当前只补前端/E2E阶段；完成前保持 UI 警告和不完成状态。
