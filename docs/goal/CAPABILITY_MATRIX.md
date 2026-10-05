# 小智能力与复用矩阵

## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。

|能力|状态|真实证据/缺口|
|---|---|---|
|教师本地资料目录、名称/格式筛选、摘录、定位|P3-03限定A/C接受|native chooser取消/部分成功、实际文件/hash/SQLite、缺失失败与cold|
|跨会话教学文件目录与当前预览、来源对话|P3-03限定A/C接受|真实DeepSeek四Office格式+修订版，原授权宿主preview与missing/cold|
|当前两尺寸浅暗的本轮UI|限定接受|最终38 PNG逐张查看；标题测量不代表全页WCAG|
|PDF/Office资料收录、资料全量目录访问|OPEN Next P3-04|现有text收录、目录最近100/摘录24，不能称全量知识管理|
|传统教学/学生完整页面、DeepTutor/OpenMAIC、飞轮、Golden、安装与发布|OPEN|后续阶段不得以本轮目录测试替代|

固定build4：324文件/SHA 52d657eb2cae96eaeee305aca02ef1fe061fe547eb52c80ec92e713ff99a42fe；正常 build/typecheck 实际进程exit0，日志build4.log；renderer123/123 exit0；真实DeepSeek/Pi正式Electron工作台18/18、Office及目录45/45，均exit0/report.success=true/rendererErrors=[]，同一固定build与当前脚本SHA。实际8次独立userData/sessionData与main已加载模块核验，无旧test-runtime；最终38 PNG逐张查看（工作台21、目录/当前预览/冷恢复17），浅暗1366×768/1920×1080，本轮控件可达/可读。目录标题测量light11.65/dark13.07，只表示已测标题，不是全页WCAG证明。原教育隔离legacy-test回归207/207、suite.ok=true、独立exit0，在build2执行；build4只改生产导航归一与清除旧定位提示，main/shared/legacy业务不变，不冒称207在build4重跑或新教育闭环。证据/源码副本/失败报告见 apps/desktop/test-results/goal/phase3-materials-20261005/closeout.json；manifest SHA 278185debf61bf5944a97e91153740a2b7914b57c648c31d13647c42af82d8dd。

Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-01/P3-02仅导航与聊天连续性实现层 A/C 接受；完整 Phase3、Goal、日常、发布、人工仍 NOT_ACCEPTED。旧接口模拟数据不作为新能力真源，跳过测试样例书与旧模拟业务兼容投入。

|能力|本轮状态|证据/缺口|
|---|---|---|
|五主空间与真实传统页面接线|限定A/C接受|原18工作台/39设置，同build5；无mock替代|
|执行中切换、草稿、同会话、窗口前进后退、冷恢复|本轮A/C接受|实际DeepSeek同run与SQLite一致；6独立启动|
|设置保存中防离开|本轮A/C接受|真实两次model保存核5入口均disabled|
|两尺寸/两主题导航与本轮可读性|限定A/C接受|21逐图查看，危险按钮dark7.52/light5.64|
|教师资料信息架构/跨会话教学产物中心|OPEN Next P3-03|现有knowledge仍有工程布局；不因接线接受|
|传统教学/学生页整体体验、DeepTutor/OpenMAIC、飞轮、Golden与发布|OPEN|后续阶段，apps/desktop/test-results/goal/phase3-spaces-20261005/closeout.json不能代替完整Goal|

P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

|能力|状态|证据|
|---|---|---|
|Pi唯一生产Loop/退役重复装配/Domain保留|Phase2实现A/C接受|P2-03与本轮相同生产/build；39边界+12实际main启动清单|
|公开工作过程、计划、问答、steer/followUp/stop/恢复|本轮路径A/C接受|控制6suFAH30|
|保存DeepSeek密钥与冷启动真实工具|本轮隔离A/C接受|zHHCkQ16；空环境/加密/readback/真实200|
|内置浏览器/网页正文/本地截图/失败返回|当前网络A/C接受|adO3BF20；xYg48f首失败保留|
|Pi原生自动整理/工具批次续行/崩溃恢复|本轮A/C接受|T7faDQ21+native边界11|
|无运行预算、真实DeepSeek缓存usage|本轮A/C接受|unlimited4；10实际SSE与持久账本72900逐项一致|
|五产品空间|Next P3-01|现有传统页待盘点/接线，不记完成|
|DeepTutor/OpenMAIC/飞轮/Golden A–G/日常/无VPN/安装/人工/许可安全|OPEN|后续Phase4–8；本轮不冒充交付|

完整映射与精确命令见PHASE2_RUNTIME_CONTRACT最新段；26最终PNG已逐张审阅，本轮无产品UI源修改，不宣称完整Codex像素一比一。

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

|能力|复用与现状|状态|
|---|---|---|
|普通旧请求别名|同一Pi host/native done/公开投影|限定A/C接受|
|生产事实数据|取消自动demo注入，测试显式fixtures|限定A/C接受|
|旧模拟业务兼容|用户指定新接口为主，不再补旧参数|不再建设|
|重复Runtime装配|main仍有隔离legacy闭包，需要抽出/退役|P2-03 NEXT|
|教育个性化/互动课/飞轮|按Master Phase4/5/6|OPEN|


## 2026-10-05 Phase2 P2-01 启动与旧 Runtime 边界接受

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING。P2-01 限定实现 A/C 接受，完整 Phase2 / Goal / 发布 / 人工验收 NOT_ACCEPTED。跳过测试样例说明书专项，Master 唯一主线。

|能力|复用与现状|状态|
|---|---|---|
|正式启动/错误/重试|Pi Host + Pro AppLayout/HeroUI；原开关不回旧|P2-01 A/C接受|
|旧 Runtime IPC与历史|集中权限/策略wrapper；旧对话只读参考无重放|P2-01 A/C接受|
|旧 Console/续跑兼容|待同一Pi Facade与教育Domain接入|P2-02 OPEN|
|完整Phase2与后续阶段|重复装配、完整教育/联网/数据飞轮/最终门禁按Master继续|DOING/OPEN|

Next：P2-02旧 Console/直接请求兼容 Facade 到同一 Pi，先请求校验、单次投递与原 AiConsoleRunResult 接缝，再续跑/停止/问答/重试。禁用旧入口不等于教育能力迁移完成；P2-03重复装配退役、P2-04完整阶段验收随后。

## 2026-10-05 Goal主线恢复、Phase1整体验收与Phase2入口

Goal ACTIVE；Phase1 Master九项主工作台完成实现层A/C验收（非完整Goal/发布/人工接受）；Current Phase：Phase2 Pi Runtime Consolidation DOING。

|Phase|当前事实|状态|
|---|---|---|
|1 Codex Shell|九项Source/typedIPC/真实页面/有限历史证据及当前15+30/视觉审阅完成|实现层A/C接受|
|2 唯一Pi|正式Pi与旧loop入站同时存在；已核实际调用，待迁移|DOING|
|3 五空间|传统入口与技术菜单仍需治理|TODO|
|4 DeepTutor|Domain待剥离第二loop|TODO|
|5 OpenMAIC|互动课适配/实际课程待实现|TODO|
|6 飞轮|评估/版本/promotion/rollback待完成|TODO|
|7/8|安全/恢复/发布/黄金A–G与人工完整接受|TODO|

最终固定隔离build2，323文件/SHA 35c105f473b34db2ccdb7050b31a776294f0ba019a65f7b5fa70e56da612fdaa，正常npm run build含tsc exit0；renderer111/111，原Shell真实Pi/DeepSeek 1IvLdM 15项、原控制tc9lZN 30项、原教育主流程207均exit0，两个UI报告rendererErrors[]且绑定同build/script SHA。当前实际审阅9PNG：Shell浅暗双原生1366×768/1920×1080+dark cold5，原问答/驻留计划/补充/停止4。Shell35关键文字/代码标签/全部实际token颜色对比≥4.5，最低5.329007293127842；表格与真实渲染JSON实读核随机编号/37/8/分数课堂，冷恢复不重放。保上一轮文件32和Office28有限A/C原报告；各自所有冻结生产源码SHA当前相同，本轮未伪称重新执行。九项映射详见PHASE1_ACCEPTANCE_2026_10_05.md与owned results.json。

Next：Phase2 P2-01：按已核实旧IPC→Console/Graph/sidecar入站清单冻结RuntimeAuthority与兼容合同，移除正式环境回到旧编排的开关，逐条将旧聊天/续跑/停止迁移到Pi；保确定性教育Domain、旧数据和传统页面。不得直接删除agent-loop.ts或整搬DeepTutor/OpenMAIC Runtime。见docs/goal/PHASE2_RUNTIME_CONTRACT.md。

跳过测试样例书专项，唯一主线Master Goal；不无限重验已通过Shell小片，不将Phase2–8能力倒塞Phase1。日常原反馈/配置D、无VPN/安装E、完整Codex体感与像素对齐、教育黄金A–G、云视觉、WPS本轮版式、安全/Pro分发许可及三连稳定仍开放。没有改变Master、HEAD、daily out/profile/key、系统DNS/proxy/VPN，无提交/push。本轮不估算缓存命中率。

## 2026-10-05 文件面板主题与真实导航有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅M01/M09/M10只读文件面板有限A/C通过，完整Master DoD不降低。

|能力|本轮证据|状态|
|---|---|---|
|文件只读/授权/版本与取消|原22真实边界与IPC|有限A通过|
|导航/键盘/损坏/版本/冷恢复|正式Electron32、磁盘事实|有限C通过|
|浅暗双尺寸宽窄/选中页签可见|13PNG真实审阅与bounds、对比度|有限C通过|
|学生保存提示稳定|main1失败/main2通过，未修源码|OPEN|
|全Shell/日常无VPN|整体审计与D/E欠项|OPEN|

下一唯一：Phase1按Master第2247段完成整体requirements与证据审计（sidebar/chat/composer/history/working/summary/plan/tool/progress/artifacts/files/approval/steer/retry/resume/compaction/model/skills/settings/glass）。先映射现有源码/固定build/各有限closeout，列最早缺口并完成正式实例与真实视觉，再决定Phase1接受；学生提示间歇风险列入主路径欠项。不得无限重复已关闭文件小切片或跳到Phase2。之后按Master执行唯一Pi runtime、五产品空间、教育能力/飞轮和黄金A–G。

日常D/用户原凭证联网图片失败、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS实际版式、安全与Pro分发许可保持OPEN。三元暂停；日常out/profile/key、代理/DNS/VPN、Master/HEAD及上一轮closeout均保持，未提交/push。本轮未新测或估算DeepSeek缓存率。


## 2026-10-05 公开中文与教师确认办公交付有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。完整Master DoD保持，本轮仅M01/M10办公交付事实与默认中文公开过程有限A/C验收。

|能力|本轮事实|状态|
|---|---|---|
|教师确认办公交付|真实四格式+独立readback+公开回执+冷恢复|有限A/C通过|
|默认中文公开过程|本批28项真实任务逐段检查|有限C，非所有模型保证|
|后续过程/工具保留|11协调边界+message_end适配+真实后续读文件|有限A/C通过|
|文件面板完整浅暗/失败版本|既有25只浅色，新完整主题待验|OPEN，下一唯一|
|无VPN完整harness|日常D/E及全DoD|OPEN|

下一唯一：Phase1 Files/Artifacts完整面板验收。既有FILE面板当前证据只有浅色宽窄；冻结现有Hana文件宿主、HeroUI预览/来源与当前主题复用合同，补文件导航、版本变化/损坏/失败返回、冷恢复、浅暗双尺寸与真实PNG，保只读权限和本地事实。完整Shell验收后进入Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮/黄金A–G。

日常D/用户原凭证联网图片反馈、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS排版、安全修补与Pro分发许可保持OPEN，三元暂停。未更换日常out/profile/key、代理/DNS/VPN或提交/push；Master/HEAD与日常out SHA原样，旧证据保留。本轮不新统计缓存率或承诺命中。办公公开交付采用可信回执，不宣称已把模型原始总结变成事实或解决所有自然语言幻觉。


## 2026-10-05 原失败会话创建指纹兼容有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅 M01/M10 已识别旧创建身份兼容有限 A/C 通过，保持完整 Master DoD。

|能力|实际证据|状态|
|---|---|---|
|已核旧创建身份恢复|原ik9wla副本Abh1wh真实20、prefix3|有限A/C已修复|
|未知/模型/目录/权限变更拒绝|边界6、原当前能力严校|有限A通过，未放宽|
|原生自动整理/同任务cold续请求|Abh1wh真实整理/停止/提交前故障/commit后kill|有限C通过，非三连稳定|
|公开中文与教师修订后回复事实|前轮旧37vs实际41观察保留|OPEN，下一唯一|
|国内日常无VPN完整harness|D/E及全DoD|OPEN|

下一唯一：Phase1 公开中文摘要与教师修订后事实一致性。先冻结当前实际旧37正文/已确认41文件差异与英文过程的交付合同，比较现有 Hana/Pi 公开事件、Office确认结果/产物回执，复用成熟接缝；以原真实教师编辑→确认→文件→公开回复→cold链路逐字段验收，不能用模型说已完成或测试回读替代文件真源。之后完成 Shell，再 Phase2 唯一 Pi runtime、Phase3 五空间、教育适配/飞轮/黄金 A–G。

公开英文摘要、旧37正文与教师修订41文件一致性仍 OPEN。日常 D/用户原凭证联网图片反馈、无VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS排版、安全修补与 Pro 分发许可仍 OPEN；三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常profile/key、系统代理/DNS/VPN或提交/push。缓存策略不改，本轮未新统计命中率，不将历史比例写成当前保证。


## 2026-10-05 真实工作过程有限切片验收与继续位置

完整 Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮只接受 M01/M10 真实工作过程的有限 A/C 切片。

|能力|本轮证据|状态|
|---|---|---|
|公开working/tool/approval/input/compacting|renderer106、control30、auto20、Office26、26PNG|有限A/C通过|
|真实Pi队列编辑/撤回/不重放|queue16、control30|有限C通过|
|原生自动整理/多轮恢复|auto20、真实kill/新请求原码年级|新会话有限C通过，旧兼容失败|
|四格式教师修订/确认/文件回读|Office26、独立readback|有限C通过；正文事实/中文/WPS待修验|
|DeepSeek cacheRead|usage-readback真实numeric，旧run排除|有限统计；不承诺命中率|
|日常无VPN完整harness|D/E/三次稳定/完整DoD|OPEN|

下一唯一：先定位原 copied pi-auto-ui-ik9wla 会话的创建快照/配置指纹兼容失败（aXLjJ8），冻结可识别版本的迁移、回滚和原字节验收合同，再修复；不得用 fresh seed 通过关闭旧兼容、放松权限指纹或重写 native JSONL。之后补齐 Shell：中文公开摘要、教师修订后正文与实际文件数值一致；再 Phase2 唯一 Pi runtime、Phase3 五空间与教育能力/飞轮/黄金 A–G。

日常 D、无 VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS 实际排版、安全修补与 Pro 分发许可继续 OPEN；用户原凭证/联网/图片失败未关闭，三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常 profile/key、系统代理/DNS/VPN，未提交/push。


## 2026-10-05 联网与浏览器有限切片验收结果

M01/M10 本轮有限 A/C 验收通过；完整 Goal ACTIVE / Phase1 Codex Shell DOING / NOT_ACCEPTED。最终 build3 正常 npm run build 含 tsc exit0，323 文件 / SHA 64c478c6f816fdcaf58d3a2c99064a5acd8639c5c917b850677cee2727a808eb；renderer102/102、主教育入口207/207 exit0（旧入口回归，不是唯一 Pi runtime 完成证明）。native VI3QKb 23、正式 DeepSeek browser-delivery BdfOVS 20、web QbVOGi 22，均 success/exit0。两正式 UI 串行固定同一 build3，报告绑定 build/script SHA、无 renderer pageerror。

| 能力 | 最终证据 | 未关闭边界 |
| --- | --- | --- |
| 搜索/官网正文/来源/停止/冷恢复 | QbVOGi22 | 系统来源打开截获；日常D/E/三连待验 |
| 浏览页面/DOM截图/预览/失败返回 | BdfOVS20 + VI3QKb23 | 硬件crash根因未定；无全站操作承诺 |
| 浅暗/双尺寸 | 13PNG/28对比度 | 系统顶部主题与像素一致未验 |

下一唯一：继续 Phase1，冻结真实运行过程/确认/补充/自动整理的可见状态合同；按 VIEW-01/02 与 CTRL-01/02/03，用同一实际 Pi 任务核执行前摘要→工具→后续摘要、审批/补充、自动整理、排队编辑/撤回及双尺寸浅暗 PNG。复用当前 Hana/Pi 生命周期和 HeroUI 过程卡，不新增编排器。之后 Phase2 退役重复 runtime、Phase3 五空间及教育能力/飞轮/黄金 A–G。日常 D、无 VPN/安装 E、三次稳定、安全修补与 Pro 分发许可继续 OPEN，三元暂停。


## 2026-10-05 教师公开消息切片验收结果

M01/M10公开消息有限切片通过；整体Goal ACTIVE / Phase1 Codex Shell DOING / NOT_ACCEPTED。build1正常npm build含tsc exit0，323文件/SHA ba3913bf4ac71ddabd90ce9b612a85f2ee446690dc4f90a021e2ec951e3121fd；renderer102/102、主教育入口207/207（保旧入口，非Pi全runtime证明）。native21、最终附件UI iWd8da20、settings pwIw7239均success/exit0；两UI串行固定同build、各报告绑定脚本SHA，无renderer异常。settings实际保存safeStorage后两次官方DeepSeek HTTP200及第三次AbortError停止。

| 能力 | 本轮证据 | 边界 |
| --- | --- | --- |
| 教师原输入投影 | native21 / settings39 / attachment20，8PNG | 旧未知来源保原样 |
| 原执行/技能/工具 | raw/metadata/native SHA、实际读随机码 | 不重写SDK原生文本 |
| 全Shell与harness | DOING / NOT_ACCEPTED | NET下一，D/E等仍OPEN |

下一唯一：继续Phase1联网过程、来源预览与内置浏览器工作台验收。按测试样例说明书NET-01/02/03/04，核当前构建真实搜索→正文→浏览页面/截图→来源打开、错误/重试/停止/冷恢复与浅暗双尺寸；先比较Hana/Pi现有实现并冻结合同，复用现有工具/权限/浏览器宿主。原自动压缩、不设运行预算、国内DeepSeek保持；缓存命中率另以真实usage统计，不能拿提示词长度推算。之后Phase2唯一Pi、Phase3五空间与教育适配/飞轮/黄金A–G。D/E、连续三次稳定、Pro许可与安全修补仍OPEN，三元暂停。

## 2026-10-05 会话菜单切片验收结果

M01/M10会话菜单有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

| 能力 | 新证据 | 边界 |
| --- | --- | --- |
| 会话/文件夹菜单 | C41、键盘/实际右键/数据失败重试/cold，12菜单PNG | 边缘与scroll是明确controlled事件 |
| CFG与历史 | C35、保存配置后真实200/停止/归档/cold | 原日常失败仍OPEN |
| 完整Shell | DOING / NOT_ACCEPTED | 自动/skill前缀仍公开，下一教师化投影 |

最终隔离context-menu-20261005/build5正常npm build含tsc exit0，323文件/SHA5cf0d26962365242a2428652253c1ba5116713bcedd84368c45387251fc63b4c；renderer102/102（新增无document的Codex portal SSR边界）、主教育入口207/207本轮exit0。串行同构建menus-8PCpdS41、settings-Gee4lY35均success/exit0/rendererErrors[]，报告绑定build与脚本SHA；两修改脚本node --check和git diff --check exit0。207保旧教育入口，不作全Pi完成证明。

本轮实际逐张查看最终16PNG：会话/文件夹键盘菜单8、右下边缘4、归档确认4。native BrowserWindow content1366×768/1920×1080×media浅暗，DPR1.5；菜单宽220px、靠近锚点、边缘内距/按钮可达，归档焦点隔离。两专项156条关键文本/状态/菜单idle-hover对比度≥4.5，最低5.393。边缘坐标为真实行上的明确MouseEvent构造，滚动关闭为controlled scroll事件；不伪称人在屏幕角落找到会话或实际长列表滚动。普通右键、键盘和菜单外点击是真实页面mouse/keyboard；其余设置/入口菜单截图本轮未逐张新审阅。系统Windows暗主题、无backdrop引擎与完整Shell像素一致未新验。

按测试样例说明书记录C隔离正式Electron单轮有限通过；不是日常D、无VPN/安装E、连续3次稳定，不关闭用户原凭证/联网/图片失败。联网、缓存命中率、OCR/视觉/四格式办公及全harness本轮未新验。日常out323文件SHA0dd7…、默认profile/钥、Master和HEAD保护，无commit/push；原Pro许可hold保持。

证据入口：apps/desktop/test-results/goal/context-menu-20261005/closeout.json；本轮构建/日志与原始专项report/PNG逐文件SHA回读，所有首失败保持。

下一唯一：Phase1教师化公开消息投影。最终真实归档截图仍显示自动注入的/skill:teaching-office命令；先核其编码与projection来源，复用已有消息契约，只在公开UI呈现教师原输入，保native原文、技能选择、来源与旧会话兼容，冻结后以真实发送/工具/冷恢复及浅暗双尺寸验收。随后补齐其余Shell状态，再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮及黄金A–G。D/E、连续3次稳定、安全修补和Pro发布许可仍OPEN，三元暂停保持。

## 2026-10-05 设置与弹层切片验收结果

M01/M10设置、模型菜单、归档确认与附件/OCR弹层有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

| 能力 | 本轮证据 | 保留边界 |
| --- | --- | --- |
| CFG/设置 | 35项/32PNG、safeStorage保存后真实200与停止 | 原日常无效key反馈未关闭 |
| OCR/IMG | 12项/4PNG、实际OCR→教师校正→真实read/脱敏/cold/cancel | 合成印刷样本，不是扫描PDF/手写评测 |
| 附件/FILE | 17项/14PNG、清空/retry保新输入/dup/CAS/kill/cold | 本地预览非云视觉或联网 |
| 入口菜单 | 20项/12PNG、contrast/键盘Escape/设置返回保草稿 | 会话右键菜单仍OPEN |
| 完整产品 | Phase1 DOING / NOT_ACCEPTED | Phase2+、A–G、D/E与稳定性待验 |

精确证据与SHA回读：apps/desktop/test-results/goal/overlays-20261005/closeout.json；原始专项报告及首次失败独立目录保留，最终命令/日志见docs/acceptance/CURRENT.md。前面layout/标题/controls为历史，不覆盖。

下一唯一：继续Phase1，先冻结会话右键菜单合同，复用成熟ContextMenu/Menu适配器，补Shift+F10/上下键/Enter/Escape与焦点恢复、屏幕边缘避让及native浅暗双尺寸；当前仍是fixed原始div，不能因归档Modal已验就称会话菜单完成。其余Shell状态验完后再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；D/E、安全修补及Pro许可仍OPEN，三元暂停保持。

## 2026-10-05 布局与暗色控件切片验收结果

M01/M10布局与暗色控件有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

| 能力 | 当前证据 | 保留边界 |
| --- | --- | --- |
| UI/CTRL：问答、计划、停止与壳 | control27，浅暗native双尺寸4PNG及0隐藏scroll | 原偶发裁切未自然再现，非完整Shell |
| CFG入口菜单 | menus20，12PNG/idle-hover contrast/Escape真实焦点 | 不代替当前设置全状态 |
| OFFICE | office24，四格式独立回读/审批拒绝/教师改写/CAS/kill/cold | 非本轮Office/WPS应用排版 |
| FILE面板 | files25，当前4浅色宽窄PNG/冷恢复/来源版本 | 无provider新请求，不作暗色截图证明 |
| 整体 | C单轮有限通过 | D/E、3次稳定、Phase2+、黄金A–G待完 |

最终隔离layout-20261005/build5正常npm build含tsc exit0，323文件，SHA39efed9fca86c25a9d4a8fd9e298abf23d7958c3dcfc7c376d81ba48dd30f651；renderer101/101、主Electron smoke207/207。menus-GMkqc3 20、control-OBP44f 27、office-DsX0vl 24、files-ZpfW8J 25均success/exit0且无rendererErrors；四脚本syntax与收尾git diff --check exit0。前3份报告内嵌同build/script SHA；files既有报告无指纹，由实际启动OMNI_EDU_TEST_BUILD_ROOT及构建前后SHA绑定，不伪造报告字段。

证据入口：apps/desktop/test-results/goal/layout-20261005/closeout.json；原始报告在apps/desktop/test-results/xiaozhi-agent上述独立目录，build5.log、renderer-build5.log、main-build5.log及四专项最终日志在owned layout目录。前面历史标题/controls/glass结果保留，以下新增记录为当前有限状态。

下一唯一：继续Phase1，冻结设置工作区、会话管理与附件/OCR弹层合同，核浅暗主题、错误/重试与可达性，再用真实native双尺寸验收。完整Shell后继续Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；日常人工D、无VPN/安装E、安全修补及Pro许可仍开放。

## 2026-10-05 自动标题兼容切片验收结果

自动标题本地fallback兼容切片有限通过；Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。普通append与附件原子publish共用conversationTitle，合法/skill前缀不挤占任务标题，保原提示词/Pi原生记录；不是新增LLM语义摘要命名。

| 能力 | 新证据 | 保留边界 |
| --- | --- | --- |
| 新默认任务标题 | native19 + ordinary settings34 + attachment17 | 本地40码点fallback，非LLM语义摘要 |
| 手工/旧标题与迁移 | legacy幂等、当前行rename、savepoint故障、旧app副本读1 | 旧行不推断、不自动改名，非日常迁移/安装降级 |
| 原发送与控制 | 同build1真实API/清空/stop/retry/cold/owned claim kill | 没有云文件实读/OCR/视觉/全部执行中kill新证明 |
| VIEW | 本轮8PNG实际查看 | 顶部裁切/全暗色/整壳未验收 |

下一唯一：Phase1专项定位问答/长过程中的Shell顶部裁切，冻结布局/滚动与完整暗色菜单合同，复用既有HeroUI/语义主题和原控制卡，以真实native双尺寸、可达性与PNG验收。完整Shell后再Phase2退役重复runtime、Phase3五空间、教育适配/飞轮/黄金A–G；日常人工D、无VPN安装E、安全修补与Pro许可仍开放。

## 2026-10-05 CTRL/CFG当前构建验收结果

Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。仅复用现有Pi1.0.2/Hana队列宿主、控制卡和设置进行当前构建验收；本轮没有生产源码、依赖、表、IPC、预算、凭证或日常数据迁移。

| 能力 | 当前新证据 | 保留边界 |
| --- | --- | --- |
| CTRL01队列 | VbXK9A16、Va2mxP21、X9Ppea9 | 自然教师请求与原生队列，少数typed/CAS边界非人工；旧副本LcBJKG3 |
| CTRL02/03 | 真实停止/恢复、owned kill/不重放 | 文件写入/上传执行中kill与日常D未全验 |
| CFG01/02 | 2EbTnw32、UnbTlU15，保存密钥9次200/冷新码/无效save/Pro拒图 | 官方列表/能力按当前请求，不承诺固定catalog；D/E未验 |
| VIEW01/02 | 本轮20PNG已看，native双尺寸按钮输入可达 | 标题裁切/全部暗色/完整Shell未验 |

下一唯一：冻结/skill自动标题兼容合同，核普通append与附件原子append两条路径，保手工标题、原提示词、历史/native绑定与本地真源；完成后继续Shell顶部裁切、完整暗色菜单与其余缺口。Phase2退役重复runtime、Phase3五空间、教育适配/飞轮、黄金A–G、日常D与无VPN安装E仍开放，不重复已通过的有限审计。

## 2026-10-05 Glass主壳与文件版本接缝结果

本轮Glass主壳与来源版本接缝有限验收通过，Phase1完整Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。生产新增仅工作区glass语义CSS、原OSS Tooltip接线，以及Hana文件回执可选version回调；Pi两处host复用既有fileVersion。正文sha256与来源version分开，读取前后变化拒绝，不放宽来源CAS/权限/教师确认。不新增依赖、表、IPC或第二runtime，不设置运行预算，原自动压缩保持。

最终隔离build5含tsc exit0（323文件 / 16116826字节 / SHA 90f47528c57f9ce6cbabee340e5deae0a51e6f2bd7eaaf4059344de743b73ad9）；renderer101/101；原主smoke207/207。最终baseline-qNl91y 13、files-OUVs7O 25、browser-delivery-y3Qfqd 13、natural-file-tntQjR 14均exit0；Hana14/Pi边界8/Office协调10均过。NET01原通知读取日期区分、NET02真实DOM/页面截图/失败/冷恢复；FILE01附件实读清空、FILE02授权与拒绝、FILE03拒绝不写和确认37→41、FILE04原文审阅生成实际DOCX/SQLite SHA/独立python-docx/冷恢复。FILE04本次未触发问答，未引用无关资料（sources空并明确说明），不能把它当真实provider引用版本CAS验证；来源接缝由Hana/Pi/Office边界实际读取与服务验证。

同一已确认Word副本经真实新建owned WPS12.0打开、编辑负责人单元格、保存重开成功；原DOCX不变。独立回读12段/1表/5行；WPS导出1页A4，28内容marker齐全、无页外字形、页面PNG实际查看。保护已有WPS实例。未测试Microsoft Office/PPTX/Excel。

最终build5双1366×768/1920×1080浅色/深色长历史、真实联网截图预览、文件、Word审阅/打开PNG已实际查看；forced-colors已看。light正文/用户/标题/次级对比度11.65/10.58/11.65/5.39，dark13.07/11.27/13.07/7.80；键盘Tooltip/focus、reduced-motion和forced-colors真实断言通过。系统主题由浏览器media模拟，不冒称Windows设置；不支持backdrop回退只有CSS声明，未在不支持引擎实测。dark小标题Folder图标对比及完整Office/菜单暗色仍待专项。

Next：下一从Phase1原CTRL/CFG的当前构建验收继续：真实运行中编辑/撤回、停止、补充/重试、设置保存返回同会话；按实际缺口冻结合同修复。随后独立兼容合同处理/skill自动标题两条路径，完成完整Shell，再Phase2退役旧runtime、Phase3五空间。原用户失败/D日常、E无VPN与安装、A–G、安全补丁/私有日志/userData ACL/备份恢复、Pro许可仍OPEN；三元暂停保持。已有壳/包审计不再重复。

## 2026-10-05 最新增量

2026-10-05：Phase0有限审计已退出；Phase1 Shell DOING，整体NOT_ACCEPTED。新增office/workspace-status.ts并接PiWorkspaceContext，旧历史不称新任务成功；恢复、审批、补充、手动/自动整理、失败/停止按公开真实状态呈现。自动整理从实际applyXiaozhiEvent投影读取，不把它等同manual operation。后端/权限/IPC/native记录/模型/key/预算/数据未改。

最后隔离正常build含tsc exit0；renderer101（原79+18状态+4实际compaction投影转换）exit0；web13/证据grader22 exit0。最终baseline-mLN2E0真实Electron10项：空/typed历史状态、200条公开合成记录/只读SQLite、冷恢复、双content尺寸输入可达/实际PNG已看；构建323文件/16105165字节/SHA f5d71e0e73bd140ae4ba9de1c6c4e0e89aba69b01420219340c2e52093c082cc。首ijFI2G为前一有限通过，保两个build/日志，不称3次稳定。离线例不证明B/provider、NET/FILE/CTRL全路径或日常D/E，也不是新Glass完整视觉验收。

security-audit-DBWIc2库存3项/exit0；fresh npm audit exit1仍0critical/3high/2moderate。只有路径/日志/owned Windows ACL与修补门禁审计通过，漏洞没有修复。证据在 apps/desktop/test-results/goal/security-0785b4e6/security-audit-DBWIc2/report.json 和 apps/desktop/test-results/acceptance/baseline-mLN2E0/report.json；完整命令见docs/acceptance/CURRENT.md。

下一项：Phase1继续真实Pi主工作台：先冻结glass主壳/低噪音过程/输入栏/文件与来源的本轮组件、token、状态、回滚和验收清单；优先既有组件与公开主题token，保持实际Pi接线。按测试说明书原NET-01/FILE-01/CTRL/CFG分步跑同输入，补运行/审批/输入/自动整理在真实任务中可见的双尺寸证据，再完成其余Shell。标题属于独立兼容切片；Phase2后退役旧编排。安全修补/私有日志/实际userData ACL/备份restore、许可分发、A–G、D/E均继续开放，不重做已完成包/基线审计。

更新：2026-10-05；合同：[Master Goal](XIAOZHI_CODEX_GOAL.md)。状态按真实证据区分，功能存在不等于产品验收完成。

| 能力 / Phase | EduDev 当前事实 | Pi | DeepTutor | OpenMAIC / 外部候选 | 决策与缺口 | 状态 / 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| Agent 编排 / 2 | `xiaozhi-agent/pi-session` 正式聊天 host；旧Console/preload/App处理器仍存在，旧TS runAiAgentLoop实际是确定性context编译，Pythonbridge确实另建AgentLoop | SDK 1.0.2 原生 session、tools、stream、steer、compact | 有独立 agentic/agent loop，不可整体接入 | OpenMAIC app 自带 Pi0.78、CopilotKit、server runtime，不整体引入 | 保留 Pi 正式 host；迁移教育 DOMAIN；适配后退役重复 RUNTIME，不按名称误删确定性逻辑 | 部分 C 已验；“唯一全产品编排器”未验 |
| 对话/过程/停止/恢复 / 1 | 有公开工具过程、原生 JSONL、队列编辑撤回、审批、恢复；自动标题暴露 `/skill` 命令 | 原生事件/队列/上下文压缩 | Hana 为历史实现参考 | HeroUI chat-conversation / chat-tool / prompt-input | 复用正式契约；补标题两条原子路径、五空间壳、失败状态/真实视觉 | 历史 167 C32；新 Shell 未验 |
| 工作台视觉 / 1 | 现有Pro工作台、限定glass语义主题/OSS Tooltip；最终光暗/审批/文件双尺寸已看 | 不提供完整桌面 UX | 不移植完整上游站点 | 官方 HeroUI glass tokens、Pro blocks；finesse 本地设计参考 | Glass × Codex × Education；Pro 逐组件授权，不以“同款源码”假定公开可用 | Glass切片baseline13/真实NET13/FILE14与视觉有限通过；完整Shell/暗色全部菜单未验 |
| 联网/浏览器 / 1,2 | 搜索、正文、内置浏览器、页面截图、权限、冷恢复已有正式工具与历史 C | Tool 执行接统一 runtime | Hana 450 适配来源/版本回执作为参考 | 保留当前 Electron browser host，避免另起 Agent | 以 NET01–04 同构建原例验；独立区分搜索/正文/显示/截图/引用 | 原 C 有限通过；用户旧失败/D/E 未关闭 |
| 文件与 Office / 1,3 | 授权目录读写、附件、文本修改审阅、DOCX、WPS 既有闭环 | 注册正式 tools；审批由宿主保障 | notebook/book/outputs 可选能力候选 | OpenMAIC importer/editor + PPTX 是后续候选 | 保留文件权限/版本/CAS/来源；实 PPTX 不能以图片卡代替 | 最终build5 FILE14与真实WPS1页编辑保存重开通过；来源version接缝A层14/8/10；PPTX/完整导出未验 |
| 供应商/模型 / 1,2 | DeepSeek 保存/校验/官方模型缓存、会话模型与默认独立 | 原 SDK provider/streamFn | 可取模型 client seam，不能第二 loop | 中国 API 按官方兼容 adapter | 自动/快速/高质量为前台；高级实际 ID；最小上下文、缓存 hit 实测 | 167 保存 SDK HTTP200；Pro 该轮仅菜单；D/E 未验 |
| 自动压缩 / 2 | 正式 host 默认 `OMNI_EDU_PI_AUTO_COMPACTION !== '0'`；既有 compaction适配与证据 | 原生 prepare/compact/append；不设置运行预算 | Hana compaction 源适配已在旧切片 | 不引入第二摘要 Agent runtime | 核实长任务/恢复/中断/stop/来源/approval 保持；命中率观测不固定承诺 | 旧专项有限通过；新Master回归待验 |
| 我的资料 / 3 | 既有导入/OCR/检索/文件资产及 SQLite | 调用 domain tools | file_library / knowledge / imports / book / reading | OpenMAIC material/asset 契约候选 | 保本地真源；界面可看/筛/改/引用；不隐藏所有管理页 | 存在，完整黄金 A/C 未验 |
| 教学内容 / 3,5 | 题库、组卷、文档产物已有实现，部分仍散落 App/db | 内容工具调度 | notebook / practice / question / quiz_judge / outputs | DSL0.11.2、generation0.3.15、renderer0.1.11、editor0.0.9、importer0.3.0 | 独立包适配真实本地内容与课堂；不上完整 Next.js | 候选 manifest 已核；黄金 B/D/E 未验 |
| 学生与个性化 / 3,4 | 档案/错题领域；review-scheduler/learning-analytics为可保留确定性DOMAIN | 教师意图→教育 domain 工具 | mastery_path/learning service、policy、grading、scheduler、notebook/book候选；HEAD LearningStore已改SQLite CAS/lease | 不搬多用户/auth/school管理 | 接EduDev真源/教师修正，不能直接迁新store；grading短答案相似度/open关键词是启发式，不能当教师事实真值 | 固定教育路径55变更/部分接口已核；黄金 C/F 未验 |
| 本地数据 / 0,7 | SQLite/files 为真源；7 个 data/user 文件仍被 Git 跟踪 | session 留本地，非业务真源替代 | 上游自身 user/workspace 目录不能另成真源 | storage0.37.1含HTTP/PG/S3/browser独立subpaths | 接 EduDev SQLite/file adapter；先备份、迁移、readback，再清理 Git跟踪 | 元数据审计通过；迁移未做 |
| 不可见学习飞轮 / 6 | 不以现有记忆/日志冒称评估晋升系统 | runtime 仅执行已批准版本 | 可复用偏好/学习分析领域逻辑，来源须验证 | Hermes self-evolution 当前README已实现技能优化，其余多为计划 | 本地 trace→候选→eval→版本→promote/rollback；禁改事实/代码/凭证/权限 | 研究候选；未实现/未验黄金 G |
| 测试/安装/性能 / 0,7,8 | 134npm脚本；本轮renderer79、调度20/学情8/web13/grader22/离线Electron7及隔离build；历史main207/settings32保持 | SDK边界可测；实provider独立 | 上游tests可作适配参考，不能代替EduDev用例 | production audit3high/2moderate；fresh/cold/IPC/200消息/本地I/O有限快照已有，完整长任务/provider/安装未测 | 复用既有suite/audit/说明书；同323/SHA构建关联证据，不把out体积当安装体积或I/O当解析延迟 | 有限基线通过；新Master全门禁未通过 |

## 第一轮处置清单

### 追加包接缝证据与选择

固定registry DSL0.11.2/generation0.3.15/renderer0.1.11，SHA512/完整license inventory/单DSL实际核；78包149529125字节，browser bundle11203418字节。audit --packages最终u38Mxk Node/Electron/渲染5项过；两初失败与前次有限成功保持。renderer45嵌入源、generation38资源匹配clean固定636fab…；另48 map无源，未证明全构建来源。详见 [集成CURRENT](../integrations/CURRENT.md)。

- DSL：**ADAPT候选**，单一schema/version/纯契约，生产边界必须转EduDev版本化资产。
- generation：**ADAPT候选**，main侧原生ESM/模板资源，AICallFn只由Pi宿主提供；注入fixture不代表真实provider或教师内容质量。browser subpath仅用于未来确需的纯工具，不搬Node prompt loader进renderer。
- renderer：**ADAPT候选**，实际预编译SlideCanvas文字/点击可用；根入口optional ECharts/Shiki必须安装，完整bundle偏大，最终分发grammar/wasm/NOTICE/媒体/KaTeX仍gate。富文本不是sanitizer，接本地URL和sandbox。
- fonts.css远端CDN、整站/独立runtime/PostgreSQL/S3：**DO NOT USE**。系统字体合成例不等于所有字体支持；editor/importer/storage/PPTX额外闭包仍逐迁移验。

这是Phase0最小包接缝有限通过，黄金D/E、完整许可证分发和Windows安装保持未验。Phase0有限审计已退出；Phase1冻结首切片并按真实Pi逐步实现，当前增量见上方。

### 保留

- Pi native session、正式 production host、typed preload、权限/审批、SQLite/files、不可变 Skills、现有真实工具及有效验收资产。
- 教师修正、来源/父子谱系、OCR、题库、组卷、错题、学生 domain 能力；稳定 facade 暂保兼容。

### 适配/迁移候选（尚未批准移植）

- DeepTutor 学习领域 service/schema/client，通过现有 `omni_edu_deeptutor_bridge`；逐函数剥离循环/上云/自身存储依赖。
- OpenMAIC 六包的最小闭包；优先 DSL/generation/renderer，再 editor/importer；storage 仅契约与本地 adapter。
- HeroUI MCP 官方 glass 与现有授权组件闭包。禁止整包盲搬；许可证、bundle体积、Windows兼容为前置门禁。
- assistant-ui仅外部状态展示adapter备选；OpenWork完整OpenCode runtime与Pi目标不符；OpenWebUI品牌条款不适合作换牌基础。官方对比来源与适合度推断见 [集成CURRENT](../integrations/CURRENT.md)，尚未迁移/实跑。

### 重构

- 五空间真实导航；App2798 / db7330 / main2267行按本轮领域边界逐步拆，不一次推倒。
- 模型前台简化、错误/恢复过程可读；标题普通append与附件publish一致；稳定文档/测试/数据目录。

### 退役/删除候选（当前不执行删除）

- LangGraph 编排、旧 `ai-harness/runAiAgentLoop`、DeepTutor AgentLoop/Console重复编排、新OpenMAIC整站runtime。
- 退役条件：实际引用图清零、新adapter完整链路过验、旧数据兼容与回滚核对完成；上游DOMAIN不能随loop删。
- Git跟踪运行数据和历史文档清理须有备份/链接迁移与readback；不删除用户真实资料。

## 上游锁定记录

| 来源 | 已读取身份 | 许可证事实/限制 |
| --- | --- | --- |
| Pi npm | `@earendil-works/pi-coding-agent@1.0.2`，官方npm查询1.0.2 | manifest / 官方仓库 MIT；未新增依赖 |
| DeepTutor vendored | 1.5.11 / `456f9c24226e008f1ff07a7e3455d7b4d39f6221` | 已保存 Apache-2.0 notice；不可直接改vendor |
| DeepTutor local | 1.5.11 / `be1701108a22c1037bb8004322ef6145302cbf5e` | Apache-2.0；5项用户dirty，保护 |
| DeepTutor official HEAD | 1.6.13 / `f07029cfcf2c8dfccdb671cdfc343db8334f5741` | 源blob版本读取；逐能力依赖和差异仍Doing |
| OpenMAIC | 1.2.0-rc.1 / `636fab0d7edee5e7c2694117c38ece8f623573f9` | 根MIT；mathml2omml LGPL3+、fonts与包LICENSE逐个核，不宣称全MIT |
| HeroUI | MCP glass/组件查询可用；本地Pro1.0.0-beta.7 vendor记录 | Pro受商业授权；本地根LICENSE缺证据，不能当OSS |
| Hermes self-evolution | 官方README候选 | README MIT声明；完整LICENSE/固定commit/可执行能力尚未核闭；不迁移计划功能 |

## DeepTutor 15 项审计处置（固定 HEAD，不代表移植完成）

固定官方 `f07029cfcf2c8dfccdb671cdfc343db8334f5741` / 1.6.13；vendor 1.5.11及本地dirty保持。以下是接口/依赖审计决定；升级候选在完整调用闭包、版本schema、Windows与原样例过验前不复制进生产。八个追加接口的Git blob/头部/签名保存在 `test-results/goal/phase0-3f5282f0/upstream-interfaces.json`，55文件差异仍保留。

| 主要能力 | 处置 | 固定上游接缝与理由 | 后续门禁 |
| --- | --- | --- | --- |
| AgentLoop | REPLACE / DO NOT USE | `runtime/agentic/loop.py`；Python bridge确实构建AgentLoop，Pi已拥有正式循环 | Phase2逐旧IPC与续跑替换，旧引用清零后退役；保领域能力 |
| Capability | ADAPT | `core/capability_protocol.py` 是多步骤pipeline，不把整个capability当纯函数；按领域service拆工具 | 有版本输入/结果、取消/进度/主宿主确认，不能绕过Pi再调loop |
| Memory | KEEP + ADAPT | `services/memory/store.py` facade/三层与consolidator可参考；现有EduDev记忆与来源保留 | 禁自动改FACT/权限；接现有真源，飞轮晋升与回滚另验 |
| Mastery | UPGRADE + ADAPT | `learning/policy.py`纯策略；`grading.py`启发式；`service.py`依赖store/lease与模型；mastery router依赖应用turn | 0.9阈值/短答相似度/关键词不能当学科真值；教师校正、旧记录回读与评估 |
| Question Bank | KEEP + ADAPT | `tools/question_bank.py::run_question_bank` overview/list/organize/unfile/bookmark/record，依赖notebook_entries与类别store | 映射EduDev题库ID/来源/谱系；写入走本地确认，不能搬上游表或把题库混成笔记 |
| Reading | ADAPT | `reading/service.py::parse_locators/render_units/search_material/verify_quote` 明确无LLM/HTTP/chat依赖，注入ReadingStore | 本地asset版本/页码/引文证据adapter；缓存可重建、读取有界；Windows路径核验 |
| Book | KEEP + ADAPT | `book/storage.py` 按book JSON/asset存储；现有teaching-book/planner/renderer可继续用 | 映射教师确认内容与EduDev文件目录，避免第二book真源；黄金A/D/E |
| Parsing | KEEP + ADAPT | `services/parsing/service.py::ParseService` 按需解析、content-addressed cache、engine readiness gate | 复用现有OCR/document worker优先；引擎/模型下载、大小/取消/版本/安装闭包逐项核 |
| RAG | KEEP / DO NOT USE | `services/rag/service.py::RAGService` provider按KB绑定，依赖embedding/factory/runtime路径 | 保现有FTS/LanceDB/混合检索；GraphRAG/LightRAG/外部知识库自动上传不采用；最小文本/来源验证 |
| Provider | REPLACE | `services/llm/client.py`自称legacy、推荐factory；会配置环境。`runtime/agentic/client.py`另含SSL bypass选项 | Pi统一模型host；教育utility须注入同一模型接口，不复制env/凭证管理或关闭TLS校验 |
| Session | DO NOT USE / ADAPT | `services/session/sqlite_store.py`第二session DB、POSIX生产锁；attachments parsing有独立函数接缝 | Pi native/公开projection保真；不搬第二会话store，Windows文件锁不能视为生产验证 |
| Tool Protocol | ADAPT | `core/tool_protocol.py`包含schema/items与sensitive追踪字段；不是授权/脱敏本身 | 映射现有typed tools；边界拒绝未知/非法参数、主frame、来源与审批，保原失败回执 |
| Student state | KEEP + ADAPT | `learning/models.py/service.py/storage.py`新SQLite CAS/lease与interaction幂等；EduDev学生/错题/学情规则已有 | 以现有SQLite为事实源；状态版本/跨学生隔离/教师纠正；不导入第二LearningStore |
| Workspace | ADAPT / DROP | `services/workspace/service.py/models.py`路径/发布接缝；multi_user/服务站点依赖 | 保本地授权目录/已确认产物；DROP多用户/auth/学校管理与完整REST站点 |
| Attachments | KEEP + ADAPT | `services/storage/attachment_store.py::AttachmentStore` put/delete/resolve；`session/attachment_parsing.py::parse_chat_pdf_attachments` | 原typed附件、hash/CAS、校正与本地预览优先；不能套上游上传URL/S3或自动上云原图 |

本轮保留教育规则的实际前置验证：原复习调度suite 20项、学情suite 8项（统计、跨学生/脱敏与教师确认回读）通过。它们是本地领域/集成证据，不代表新版DeepTutor adapter或黄金F完成。
