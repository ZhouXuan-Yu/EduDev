# 当前架构

## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

主进程/shared/preload/数据库Schema/依赖/供应商/凭证/权限/隐私规则本轮未改；Pi 1.0.2仍唯一生产编排，无运行预算，自动整理接缝保持。资料只通过已有typed本地导入与目录；教学文件通过真实document_artifacts和原PiWorkspaceFiles授权宿主，不新增文件访问旁路。

教师资料页使用现有 getKnowledgeOverview/importKnowledgeResources/showKnowledgeResource，显示实际资源/摘录和收录状态，已添加不等于已解析。当前仅TXT/Markdown真的收录；PDF/Office/图片仍正文待处理，不伪称可检索。资源最近100份、摘录最近24块、教学文件最近100份；筛选仅当前已载入名称/格式，非全文或全库检索。教学默认artifacts，跨会话目录显示真实保存事实，历史保存内容与当前本地文件预览分开展示；预览仍复用已有会话授权/version校验，定位由main核实际路径/产物ID后发送OS文件夹定位。文件不存在必须失败，不以旧摘要冒充当前内容。外链/图片不在目录Markdown中自动加载。旧knowledge工程页仅legacy-test，备课/讲义/题本入口保留。

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。 Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

正式ProductRail统一导航，ProductSpaceShell为已有typed教育页面薄适配。App保持PiEducationWorkspace持续挂载，跨空间hidden，不重建唯一Pi host/会话；窗口历史用现有navigator。生产技术view归ai，legacy-test保旧入口；设置busy五入口禁用。main/shared/schema/provider/权限/凭证本轮未改，无第二Loop/新依赖。Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-01/P3-02仅导航与聊天连续性实现层 A/C 接受；完整 Phase3、Goal、日常、发布、人工仍 NOT_ACCEPTED。旧接口模拟数据不作为新能力真源，跳过测试样例书与旧模拟业务兼容投入。 Next P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

Phase2唯一生产Pi/重复Runtime隔离/Domain保留已实现层A/C接受；12实际main库存无历史test-runtime。Pi原生prepare/compact/append与Hana工具批次接缝保持，正式无运行预算，真实usage持久化；生产源码本轮未修改。旧模拟业务不注入，新接口本地事实优先。Next P3-01五产品空间；教育Domain作为Phase4/5能力迁移，不恢复第二Loop。完整Goal/人工/发布未接受。详见Goal CURRENT_STATE、PHASE2_RUNTIME_CONTRACT与apps/desktop/test-results/goal/phase2-accept-20261005/。

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

M01/M10：正式运行入口只有Pi发起Agent循环；旧代码/typed名称保留至兼容与Domain移交验收。尚未以Facade迁移旧返回契约，不声称重复装配已经物理移除。

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

复用现有Hana只读文件/Office解析、typed IPC、SQLite会话授权，以及原HeroUI Pro FileTree/Markdown和OSS Tabs/Resizable。生产仅两处：glass覆盖文件筛选placeholder使用语义muted色且opacity1；PiWorkspaceFiles在当前选中项或原Tabs滚动容器尺寸变化时，用scoped ref/ResizeObserver/rAF仅调整横向scrollLeft，使当前页签保持可见，不滚聊天、不抢焦点，卸载清理。文件正文不进模型、不持久化；未新增依赖/Schema/IPC/权限/loop/预算或自动上传。

source4保护快照，仅PiWorkspaceFiles和glass两个生产修改，另一个原文件CSS未改，原UI runner扩展。无迁移；回滚仅本轮差异，保其他脏改/原数据/授予目录。

下一唯一：Phase1按Master第2247段完成整体requirements与证据审计（sidebar/chat/composer/history/working/summary/plan/tool/progress/artifacts/files/approval/steer/retry/resume/compaction/model/skills/settings/glass）。先映射现有源码/固定build/各有限closeout，列最早缺口并完成正式实例与真实视觉，再决定Phase1接受；学生提示间歇风险列入主路径欠项。不得无限重复已关闭文件小切片或跳到Phase2。之后按Master执行唯一Pi runtime、五产品空间、教育能力/飞轮和黄金A–G。

日常D/用户原凭证联网图片失败、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS实际版式、安全与Pro分发许可保持OPEN。三元暂停；日常out/profile/key、代理/DNS/VPN、Master/HEAD及上一轮closeout均保持，未提交/push。本轮未新测或估算DeepSeek缓存率。


## 2026-10-05 公开中文与教师确认办公交付有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。完整Master DoD保持，本轮仅M01/M10办公交付事实与默认中文公开过程有限A/C验收。

复用现有Office本地事实、Pi原生事件与宿主publicItems，新增office-delivery-presentation薄适配器。实际Office终态之后的模型文字先缓冲到message_end：非最终摘要继续展示并保后续工具/控制事件；最终草稿总结不作为公开交付，宿主从本轮实际Office状态生成回执并持久化。原模型文本仍在native中。拒绝/停止/冲突/uncertain分别说明，不据旧run文件推导本轮成功，不把保存等同整任务完成。普通聊天不新增Office查询。教师修改正文保持本地；没有为修正旧37总结自动上传确认版。有效提示后缀强调默认简体中文和实际工具，不改旧创建identity/能力指纹或权限。无新依赖/表/IPC/第二runtime/预算。

source5，仅3生产：新office-delivery-presentation、production-host接线、pi-session有效语言后缀；其余为既有测试扩展。无Schema或数据迁移，原SQLite公开metadata复用；回滚owned source-before5项不覆盖其他脏改，native不需逆迁移。

下一唯一：Phase1 Files/Artifacts完整面板验收。既有FILE面板当前证据只有浅色宽窄；冻结现有Hana文件宿主、HeroUI预览/来源与当前主题复用合同，补文件导航、版本变化/损坏/失败返回、冷恢复、浅暗双尺寸与真实PNG，保只读权限和本地事实。完整Shell验收后进入Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮/黄金A–G。

日常D/用户原凭证联网图片反馈、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS排版、安全修补与Pro分发许可保持OPEN，三元暂停。未更换日常out/profile/key、代理/DNS/VPN或提交/push；Master/HEAD与日常out SHA原样，旧证据保留。本轮不新统计缓存率或承诺命中。办公公开交付采用可信回执，不宣称已把模型原始总结变成事实或解决所有自然语言幻觉。


## 2026-10-05 原失败会话创建指纹兼容有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅 M01/M10 已识别旧创建身份兼容有限 A/C 通过，保持完整 Master DoD。

新增 creation-prompt-identity 薄适配器，只以当前规则或单个已核旧 copy 规则计算准确创建身份。pi-session 沿原创建版本验证 control/memory 等能力指纹，校验完再使用当前有效提示及原有能力后缀。新会话只使用当前身份；未知规则、模型/目录/工具/provider/权限变化、extra fields 或缺快照仍拒绝。原历史/创建记录不重写，当前宿主权限和教师新审阅/确认仍是真源。无新依赖、表、IPC、迁移表或第二 runtime。

本轮source边界3项：新增creation-prompt-identity、pi-session接线、既有compaction-context边界脚本；仅2项为生产。四份及稳定/Goal文档13项。原私有目录identity逻辑、native memory epoch、浏览器/Office权限与保护索引原样，先前当前请求排序修复保留。回滚恢复source-before3项（新helper原为null），不覆盖其他脏改或日常产物。

固定隔离 build1 正常 npm run build 含 tsc exit0；323 文件，SHA 9d63bf140a710c4a1b889c587b2c27431fca70220151fabeea66a39c2a70e0ee。创建身份/保护索引边界6/6、renderer106/106、原教育入口207/207 exit0。原 pi-auto-ui-ik9wla/data 副本真实正式 Electron + DeepSeek：Abh1wh 20/20 success、exit0、rendererErrors[]，绑定构建与 runner SHA；未以 fresh seed 关闭旧兼容。207 为旧教育入口回归，不作唯一 Pi runtime 完成证明。

下一唯一：Phase1 公开中文摘要与教师修订后事实一致性。先冻结当前实际旧37正文/已确认41文件差异与英文过程的交付合同，比较现有 Hana/Pi 公开事件、Office确认结果/产物回执，复用成熟接缝；以原真实教师编辑→确认→文件→公开回复→cold链路逐字段验收，不能用模型说已完成或测试回读替代文件真源。之后完成 Shell，再 Phase2 唯一 Pi runtime、Phase3 五空间、教育适配/飞轮/黄金 A–G。

公开英文摘要、旧37正文与教师修订41文件一致性仍 OPEN。日常 D/用户原凭证联网图片反馈、无VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS排版、安全修补与 Pro 分发许可仍 OPEN；三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常profile/key、系统代理/DNS/VPN或提交/push。缓存策略不改，本轮未新统计命中率，不将历史比例写成当前保证。


## 2026-10-05 真实工作过程有限切片验收与继续位置

完整 Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮只接受 M01/M10 真实工作过程的有限 A/C 切片。

复用 workspaceStatus、已有 Pi 公开 projection、OSS Spinner 和现有主题，在输入栏上方增加活动状态；收起资料栏仍可见。仅当前 inProgress 工具显示执行标签，审批/补充不转动，自动整理显示真实状态，终态不残留 working；不展示私有 reasoning/summary。pi-session 只将既有脱敏 protectedContext 放在当前教师请求之前，保原文本和同会话权限；不新增编排器、依赖、表、IPC、运行预算或新的记忆系统。

仅4个生产源边界：新PiWorkspaceActivity、PiEducationWorkspace接线、同域glass样式、pi-session请求顺序。其余5个source备份边界为测试。没有数据库/目录迁移或第二runtime。测试已有capture-workspace-metrics新增finite动画结束等待，最多2秒，排除无限Spinner。

最终隔离 build2 正常 npm run build（含 tsc）exit0，323 文件/SHA da1be87276cc8495e1b6de073657f5d7ff246699d19fd9064183f93ff22009a0；renderer106/106、原教育入口207/207 exit0。串行固定同一 build2：control D2k7nY 30、auto TnxVWr 20、Office msC1oS 26、queue LIx1cj 16，均 success/exit0、rendererErrors[]，绑定脚本与构建 SHA。207 是原教育入口回归，不是唯一 Pi runtime 完成证明。

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

ADR-016：采用Hana displayText独立展示记录的思路，适配当前SQLite metadata/原子附件提交，避免为展示再修改Pi JSONL。已读本地openhanako/core/desktop-session-submit.ts recordMessagePresentationEntry及449 server/routes/sessions.ts presentation投影；449裁剪包缺lib/core实现，以完整本地源码补核，不宣称449文件不存在却已读。A现有metadata薄适配选用；B Pi原生_expandSkillCommand生成XML供模型，不能证明原UI输入来源；C正则隐藏拒绝。官方 https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/agent-session.ts 与安装lock对应扩展源码已核；HeroUI官方chat-message/prompt-input文档已查，沿当前vendor，不新取Pro源，许可hold保持。Hana函数依赖sessionManager/业务refs，整搬会添加不必要记录；仅适配展示契约，不增服务/依赖/打包体积。

选择技能时只给自动生成的执行命令附presentation v1（version/skill/text），主进程严校exact prompt、版本/字段/访问器；公开投影仅使用匹配本地主Pi运行的元数据。普通append保raw content并写metadata；附件ledger增presentation_json空默认列，原子同statement写metadata，新请求hash绑定presentation，旧请求hash保持。旧未知/手写命令/代码不猜测裁切，损坏metadata回退原文。即时pending、运行中、完成、归档、cold投影一致；失败显式重试携带原presentation并保新草稿，Pi/native/执行prompt/技能扩展/工具权限保持。无新依赖/第二runtime/运行预算/凭证变化。

证据入口：apps/desktop/test-results/goal/public-message-20261005/closeout.json。精确命令/日志：隔离npm run build -- --config test-results/goal/public-message-20261005/workspace-build1.config.ts → build1.log；npm run test:renderer-components → renderer1.log；node scripts/xiaozhi-agent/pi-attachment-send-native-smoke.mjs → native1.log；以OMNI_EDU_TEST_BUILD_ROOT指向build1串行node scripts/xiaozhi-agent/pi-attachment-send-ui-smoke.mjs → attachment-ui1/2.log，node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs → settings-ui1.log，node scripts/electron-smoke.mjs → main1.log；node --check两UI脚本与git diff --check exit0。

下一唯一：继续Phase1联网过程、来源预览与内置浏览器工作台验收。按测试样例说明书NET-01/02/03/04，核当前构建真实搜索→正文→浏览页面/截图→来源打开、错误/重试/停止/冷恢复与浅暗双尺寸；先比较Hana/Pi现有实现并冻结合同，复用现有工具/权限/浏览器宿主。原自动压缩、不设运行预算、国内DeepSeek保持；缓存命中率另以真实usage统计，不能拿提示词长度推算。之后Phase2唯一Pi、Phase3五空间与教育适配/飞轮/黄金A–G。D/E、连续三次稳定、Pro许可与安全修补仍OPEN，三元暂停。

## 2026-10-05 会话菜单切片验收结果

M01/M10会话菜单有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

现有HeroUI3.2.2 MIT Dropdown.Menu/Item/Popover与React Aria1.19.0 Apache-2.0复用；宿主仅选择目标/鼠标键盘锚点，成熟组件负责导航、焦点/碰撞。锚点Portal到body，避开玻璃backdrop创建的fixed参照，12px安全内距；复用标准dropdown BEM样式和pi主题。Shift+F10/ContextMenu/上下键/Home/End/Enter/Escape、取消/成功后焦点恢复及被归档移除后聚焦新聊天，busy编辑锁和外部滚动关闭已接。原非Codex菜单/归档分支保持。无新增依赖、Pro源码、表/IPC/迁移/凭证/运行预算/第二runtime，Pi自动压缩不改。

原SQLite/typed preload服务为数据真源，Menu只触发原业务回调；成熟RAC overlay管理菜单焦点/碰撞，归档确认继续原Modal。不会为菜单创建运行记录。

证据入口：apps/desktop/test-results/goal/context-menu-20261005/closeout.json；本轮构建/日志与原始专项report/PNG逐文件SHA回读，所有首失败保持。

下一唯一：Phase1教师化公开消息投影。最终真实归档截图仍显示自动注入的/skill:teaching-office命令；先核其编码与projection来源，复用已有消息契约，只在公开UI呈现教师原输入，保native原文、技能选择、来源与旧会话兼容，冻结后以真实发送/工具/冷恢复及浅暗双尺寸验收。随后补齐其余Shell状态，再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮及黄金A–G。D/E、连续3次稳定、安全修补和Pro发布许可仍OPEN，三元暂停保持。

## 2026-10-05 设置与弹层切片验收结果

M01/M10设置、模型菜单、归档确认与附件/OCR弹层有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

稳定口径：设置和附件/归档portal统一pi-themed-surface；应用CSS覆盖Hana状态透明度，vendor许可/源不改。Codex归档使用既有OSS Modal，旧入口modal=false保持原行为；本地真源、权限/教师确认、typed服务和原Pi compaction不变。右键菜单仍待独立适配。

稳定规则：Portal与表单派生token须在局部主题重绑定；占位文字/状态透明度纳入真实对比度。成熟Modal负责焦点和关闭，旧入口保持兼容。截图须等实际主题/入口/子树动画与图片加载，保首失败；测试通过不替代PNG审阅，C/D/E和单轮/三次稳定分开。

精确证据与SHA回读：apps/desktop/test-results/goal/overlays-20261005/closeout.json；原始专项报告及首次失败独立目录保留，最终命令/日志见docs/acceptance/CURRENT.md。前面layout/标题/controls为历史，不覆盖。

下一唯一：继续Phase1，先冻结会话右键菜单合同，复用成熟ContextMenu/Menu适配器，补Shift+F10/上下键/Enter/Escape与焦点恢复、屏幕边缘避让及native浅暗双尺寸；当前仍是fixed原始div，不能因归档Modal已验就称会话菜单完成。其余Shell状态验完后再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；D/E、安全修补及Pro许可仍OPEN，三元暂停保持。

## 2026-10-05 布局与暗色控件切片验收结果

M01/M10布局与暗色控件有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

复用既有HeroUI AppLayout content、Sidebar、ChatConversation、Dropdown及控制卡。直接aside由100dvh改为父内容区100%，消除36px菜单+8px间距形成的44px外层隐藏滚动；仅消息/侧栏内容拥有滚动。工作区与其pi-office-menu portal统一pi语义色，并补HeroUI accent-soft/segment及旧text/line/danger别名；技能Popover补现有主题class。问答、计划、失败/审阅及办公编辑浅暗色一致，未新增依赖/表/IPC/迁移/凭证/预算/第二runtime；原自动压缩保持。

available content height=window content−36px native menu−8px shell margin；aside使用父100%，消息/文件/侧栏内滚，外层scroll range≤1px且scrollTop0。语义主题只作用.ai-console-v3.xiaozhi-pi-workspace与.pi-office-menu，不修改vendor/global root。

依测试样例说明书按C隔离正式Electron记录，仅最终单轮通过，不追认为连续3次稳定，不关闭用户旧配置/会话失败。Office真实模型四格式生成、确认/拒绝、教师修订、来源CAS/版本冲突、实际kill与两次冷恢复、SQLite/file SHA及独立Python格式回读通过；本轮未新验WPS/Microsoft Office应用排版。文件面板无provider新请求；未借此外推NET/OCR/视觉或全harness完成。日常out323文件SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master与HEAD保持，日常profile/钥未改，无提交/push。

证据入口：apps/desktop/test-results/goal/layout-20261005/closeout.json；原始报告在apps/desktop/test-results/xiaozhi-agent上述独立目录，build5.log、renderer-build5.log、main-build5.log及四专项最终日志在owned layout目录。前面历史标题/controls/glass结果保留，以下新增记录为当前有限状态。

下一唯一：继续Phase1，冻结设置工作区、会话管理与附件/OCR弹层合同，核浅暗主题、错误/重试与可达性，再用真实native双尺寸验收。完整Shell后继续Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；日常人工D、无VPN/安装E、安全修补及Pro许可仍开放。

## 2026-10-05 自动标题兼容切片验收结果

自动标题本地fallback兼容切片有限通过；Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。普通append与附件原子publish共用conversationTitle，合法/skill前缀不挤占任务标题，保原提示词/Pi原生记录；不是新增LLM语义摘要命名。

M01/M10：ai_conversation_sessions增title_source（旧行legacy/新默认automatic/自定manual，任何rename设manual）；旧“新对话”来源无法推断，保原标题不重写。普通UPDATE按当前行来源与默认名决定，保并发教师rename。附件send增display_title默认空列；发布仍一个SQL statement原子提交，schemaVersion1/get旧command回执不变；trigger升级savepoint失败恢复旧trigger。无新依赖、公开IPC、运行预算、上传或第二runtime；原自动压缩保持。

旧app实际副本cold读取兼容通过，保原消息/发送/native，不把新增派生标题列作为模型上下文或第二事实记录器。唯一生产loop退役仍待Phase2。

下一唯一：Phase1专项定位问答/长过程中的Shell顶部裁切，冻结布局/滚动与完整暗色菜单合同，复用既有HeroUI/语义主题和原控制卡，以真实native双尺寸、可达性与PNG验收。完整Shell后再Phase2退役重复runtime、Phase3五空间、教育适配/飞轮/黄金A–G；日常人工D、无VPN安装E、安全修补与Pro许可仍开放。

## 2026-10-05 CTRL/CFG当前构建验收结果

Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。仅复用现有Pi1.0.2/Hana队列宿主、控制卡和设置进行当前构建验收；本轮没有生产源码、依赖、表、IPC、预算、凭证或日常数据迁移。

主进程Pi→Hana queue mutation→typed preload→原控制卡/Composer→SQLite/public projection/native binding链路沿现有接缝，queue9/legacy3补证。设置校验候选、保存safeStorage、SDK读取已保存Key分别验；无新key优先级/网络策略/权限或上传规则。问答等待/dispatch seam kill不能外推所有写文件crash安全。完整唯一runtime待Phase2领域迁移。

下一唯一：冻结/skill自动标题兼容合同，核普通append与附件原子append两条路径，保手工标题、原提示词、历史/native绑定与本地真源；完成后继续Shell顶部裁切、完整暗色菜单与其余缺口。Phase2退役重复runtime、Phase3五空间、教育适配/飞轮、黄金A–G、日常D与无VPN安装E仍开放，不重复已通过的有限审计。

## 2026-10-05 Glass主壳与文件版本接缝结果

本轮Glass主壳与来源版本接缝有限验收通过，Phase1完整Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。生产新增仅工作区glass语义CSS、原OSS Tooltip接线，以及Hana文件回执可选version回调；Pi两处host复用既有fileVersion。正文sha256与来源version分开，读取前后变化拒绝，不放宽来源CAS/权限/教师确认。不新增依赖、表、IPC或第二runtime，不设置运行预算，原自动压缩保持。

来源接缝：现有workspace-files.fileVersion→Pi idle/per-run createHanaOfficeTools callback→read_text/stat.version→Office既有sources.version CAS。读前后变化明确conflict；正文sha256只作完整性校验。原native历史不重写，没有新目录/migration/IPC/运行编排；老callback调用保持原字段。当前Pi默认自动压缩且无运行预算策略未改。唯一全产品Pi仍需Phase2旧runtime退役验收。

下一从Phase1原CTRL/CFG的当前构建验收继续：真实运行中编辑/撤回、停止、补充/重试、设置保存返回同会话；按实际缺口冻结合同修复。随后独立兼容合同处理/skill自动标题两条路径，完成完整Shell，再Phase2退役旧runtime、Phase3五空间。原用户失败/D日常、E无VPN与安装、A–G、安全补丁/私有日志/userData ACL/备份恢复、Pro许可仍OPEN；三元暂停保持。已有壳/包审计不再重复。

更新2026-10-05；最高合同 [Master](../goal/XIAOZHI_CODEX_GOAL.md)，执行状态 [CURRENT_STATE](../goal/CURRENT_STATE.md)。

## 目标

最新独立包probe在owned consumer完成Node及实际Electron main ESM、packed prompt资源与sandbox renderer点击/两尺寸，原Pi/业务入口本轮未变。三包安装与bundle分别149529125/11203418字节，具体源/许可/hold见 [integrations CURRENT](../integrations/CURRENT.md)。生产适配仍由Pi注入AICallFn、版本schema/资源授权/内容sanitize，本次不是第二runtime接入。renderer预编译文字样式自包含，无字体CDN；不能据此推广为editor/KaTeX/媒体/导出已可用。

Electron main领域宿主 + typed preload + React五空间；Pi唯一Agent编排；SQLite/files本地真源。DeepTutor作为个性化教育能力adapter，OpenMAIC独立包作为交互课堂/内容studio能力；无上游整站/auth/数据库/第二runtime。

## 实际代码边界（审计中）

- `apps/desktop/src/main/xiaozhi-agent/ipc.ts` 创建正式production host、注册工具/设置；`pi-session.ts` 接Pi。
- 旧 `main/index.ts` 仍引入 `runAiAgentLoop` 并执行 `startDeepTutorTurn`；preload `runDeepTutorConsole` 与App仍有调用。唯一runtime目标尚未达成。
- App2798 / db7330 / main2267行；后续按切片拆领域，不大爆炸改写。
- 云模型只接当前任务必要脱敏上下文；文件/写入由宿主权限、审阅、版本、确认保障，记忆不能授权。
- `data/user`仍7个Git跟踪运行文件；尚未迁移。

## 迁移规则

DOMAIN保留；RUNTIME逐入口替换后退役；INFRA统一接本地宿主；LEGACY明确兼容与删除条件。每项共享类型→main/Worker→preload→renderer→用户操作→持久化→恢复验收闭合后替换，旧入口在新入口验收前保留。详细候选见 [能力矩阵](../goal/CAPABILITY_MATRIX.md)。

## 已确认的分类与调用边界

| 分类 | 代码/调用链 | 保留或迁移方式 |
| --- | --- | --- |
| RUNTIME | 正式 `registerXiaozhiIpc → createXiaozhiProductionHost → createPiXiaozhiSession` | 保留Pi编排、原事件/native/工具/压缩；不增加第三方loop |
| LEGACY + RUNTIME | App `runAiConsole → preload.runDeepTutorConsole → ai:deepTutorRunConsole → startDeepTutorTurn → DeepTutorSidecarClient → bridge._run_deeptutor_loop` | App的Pi聊天条件分支与旧错题调用分别检查；有注册/处理器不等于日常已执行。迁域service后替换入口与旧恢复，最后退役 |
| LEGACY + RUNTIME | `main/index.ts` 1307/1730调用 `runTripletGraph`，在Console三元请求及用户输入续跑路径 | 三元目前暂停；仍需Phase2迁移/兼容清单，不能因暂停当引用清零。恢复/确认与DOMAIN规则保留后再退役LangGraph编排 |
| LEGACY + DOMAIN | `ai:runDeepSeek → runAiAgentLoop → compileAiContext → runDeepSeekChat` | TS runAiAgentLoop无迭代模型loop，是路由/领域context编译。保context/roles/privacy/来源规则，替换旧请求及编排入口 |
| DOMAIN | `ai-harness/review-scheduler.ts` / `learning-analytics.ts` | 纯确定性复习决策/学习证据统计，迁领域模块并复用旧契约测试，不随harness整体删除 |
| DOMAIN + INFRA | DeepTutor `learning/service/models/policy/grading/scheduler` + `LearningStore` | 规则/models与读写分开。新HEADstore为SQLite/CAS/lease，不直接建立第二业务真源；接EduDev持久化adapter |
| DOMAIN + INFRA | OpenMAIC `generation.generateSceneContent(outline, aiCall, options)` / DSL / renderer | AICallFn由宿主提供，包不自行选provider/存储；PBL loop fallback不能另起runtime；asset/document接本地真源 |

DeepTutor固定vendor→HEAD选定教育路径有55文件变更。HEAD纯policy无LLM/I/O；grading对短答使用相似度、开放答用关键词，是启发式而非学科真值，必须经教师修正与领域评估。mastery router绑定新turn应用与lease，不能只复制REST端点。

旧main注册11个`ai:*`通道：handshake/start/continue/budget/mutate/console/user-input/cancel/stop/pending-input/runDeepSeek。Pi enabled时App在AI/settings直接渲染Pi工作区；传统其他视图仍保留，MistakesWorkspace的onSendAi直接调用旧runAiConsole。Phase2必须检查这些入口与续跑/停止/预算旧协议，不将“默认聊天已切Pi”当全产品退役完成。旧budget接口记录为兼容候选，不新增运行预算。

## 基线限制

默认业务数据 `app.getPath('userData')/OmniEduData`（显式环境路径可覆盖）；Git里的遗留data/user不能直接当日常数据。lock为Pi1.0.2/Electron43.2.0/React19.2.8/HeroUI3.2.2/SQLite6.0.1；OpenMAIC renderer要求Tailwind≥4，与现有renderer样式接法需验证。build4产物16,103,757字节只是编译产物体积；本轮有限性能快照见下节，完整长任务/provider/安装未量，没有依赖迁移或整体性能验收声明。

## 32 文件分类与退役顺序

既有 `scripts/acceptance/audit.mjs --baseline` 保存全32文件/源SHA/导出/分类；计数RUNTIME1、DOMAIN20、INFRA9、LEGACY2。分类是迁移优先级，不声称每个文件纯属一类：135,467字节tool-registry仍混合领域/schema/权限；agent-loop.ts包含必须保留的领域编译，sidecar-client是进程transport。Python AgentLoop在该32文件目录之外另计。

1. 保现有Pi工具和教育确定性规则；逐领域提取facade，沿typed契约加教育能力adapter。
2. 替换传统错题onSendAi与旧Console/继续/停止等入口；同输入、新旧数据、取消与确认恢复过验后切换。
3. 分离bridge的能力service与 `_run_deeptutor_loop`；只有实际引用清零、历史兼容和回滚可用才删旧编排/依赖。
4. 保留旧确认/状态的只读兼容；恢复旧历史不重放模型或写入。不能把旧budget通道复用为新运行限额。

## 数据与威胁模型（源码核查，非全安全认证）

| 边界 | 当前核实 | 缺口与处置 |
| --- | --- | --- |
| 本机事实与凭证 | SQLite/files/native历史为本地；`ipc.ts` provider key codec用Electron safeStorage，主frame gate限制新Pi IPC | 凭证加密不等于业务SQLite/备份加密；账户ACL、跨账户恢复、敏感日志全扫描待Phase7，不声称整库密文 |
| 公网页面与主应用 | browser-host临时独立partition、无Node/preload、sandbox/contextIsolation/webSecurity、权限/下载/window-open拒绝；HTTP代理核公网地址；非GET/HEAD需短时同origin确认 | 网页内容标untrusted，不能授权工具或改系统指令；DNS/redirect/停止边界持续复用原suite，Electron依赖high仍待修 |
| 搜索/工具上下文 | query/URL及结果sanitize、敏感/私网/重定向拒绝、来源按会话回执绑定；13项原web-boundary本轮通过 | HTTP用MockAgent，不能证明真实官网或无VPN；不提升到NET01/02或用户旧失败已修复 |
| 附件/学生 | 原图与校正默认本地、宿主授权+版本；模型只取当前任务必要脱敏文本 | 新能力不能整体上传原图/学生库；按IMG/FILE原样例与跨学生测试验，记忆不授权 |
| 备份 | `exportDataRoot`当前复制目录、生成v1大小/SHA清单后verify；已有设置C只验证export/verify | 哈希只能验文件一致性；仍需运行中SQLite一致性、恢复/中断/回滚验证。源码copyDirectory不是SQLite事务备份，不声称已满足灾备 |
| Git运行数据 | 7个跟踪data/user路径，仅盘点元数据；默认运行目录与它不同 | 先区分遗留/实际profile，owned旧数据副本→备份→版本/count/hash readback→恢复验证→迁移切换，最后停止跟踪；不删真实文件/改Git历史 |

迁移前保留旧路径与备份manifest；失败回滚旧指针，不创建第二业务真源。FTS/向量/缩略图缓存可重建，教师确认题目/原件/正式产物不可覆盖。本轮没有执行数据迁移、删除或账号/凭证变更。

## 实测性能快照

`baseline-IfNQQo/report.json`：固定build4 SHAa5b2c8…；新profile输入就绪1930.35ms、同profile冷启动1912.19ms；snapshot IPC20样本p50=5.01ms/p95=6.65ms；200条合成公开历史打开198.06ms、只读SQLite25样本p95=2.12ms；8MiB本地I/O5样本p95=7.94ms。getAppMetrics四类workingSetSize原单位记录Browser271448/GPU231572/Utility54564/Tab135744 KB，共享页不可当独占总量。

实际查看1366×768与1920×1080 content截图，正文/输入框无横向越界；PNG2049×1152/2880×1620，不能当参考截图同DPI像素对齐。200条是合成公开历史、8MiB是Node I/O，均不代Pi长任务/自动压缩/解析吞吐。Provider延迟、安装体积与最终稳定性仍UNMEASURED。

## 2026-10-05 安全边界与Phase1增量

无表/IPC/权限/JSONL/模型编排更改；新增纯renderer策略，不改host状态真源。主窗口和浏览器拒绝新窗口只覆盖相应弹窗风险；其余Electron advisory必须升级与真实回归。office-network实际Agent+fetch，selected路径没有BalancedPool/缓存/重试/decompress interceptor，不能外推所有transitive。StreamMarkdown未传mermaid plugin，安装parser不等于启用；未来diagram仍需补丁及不可信内容测试。

公开Pi失败为allowlisted code/XIAOZHI_ERRORS；私有SDK历史可能保provider错误文本，旧DeepTutor bounded错误路径仍需退役/脱敏。owned仓库文件ACL实际继承，包含Authenticated Users Modify/Users ReadAndExecute，未修改权限；实际userData/跨账户/恢复未验，不称隐私隔离。安全修补仍发布gate。

2026-10-05：Phase0有限审计已退出；Phase1 Shell DOING，整体NOT_ACCEPTED。新增office/workspace-status.ts并接PiWorkspaceContext，旧历史不称新任务成功；恢复、审批、补充、手动/自动整理、失败/停止按公开真实状态呈现。自动整理从实际applyXiaozhiEvent投影读取，不把它等同manual operation。后端/权限/IPC/native记录/模型/key/预算/数据未改。

最后隔离正常build含tsc exit0；renderer101（原79+18状态+4实际compaction投影转换）exit0；web13/证据grader22 exit0。最终baseline-mLN2E0真实Electron10项：空/typed历史状态、200条公开合成记录/只读SQLite、冷恢复、双content尺寸输入可达/实际PNG已看；构建323文件/16105165字节/SHA f5d71e0e73bd140ae4ba9de1c6c4e0e89aba69b01420219340c2e52093c082cc。首ijFI2G为前一有限通过，保两个build/日志，不称3次稳定。离线例不证明B/provider、NET/FILE/CTRL全路径或日常D/E，也不是新Glass完整视觉验收。

security-audit-DBWIc2库存3项/exit0；fresh npm audit exit1仍0critical/3high/2moderate。只有路径/日志/owned Windows ACL与修补门禁审计通过，漏洞没有修复。证据在 apps/desktop/test-results/goal/security-0785b4e6/security-audit-DBWIc2/report.json 和 apps/desktop/test-results/acceptance/baseline-mLN2E0/report.json；完整命令见docs/acceptance/CURRENT.md。
