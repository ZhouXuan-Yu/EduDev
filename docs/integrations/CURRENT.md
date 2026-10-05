# 当前集成与复用

## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。

本轮只使用现有Pi+DeepSeek、本地资料与Office文件宿主。未迁入DeepTutor/OpenMAIC runtime或增加依赖/外部上传。HeroUI Pro项目现有ListView/EmptyState源+CSS/util与官方OSS SearchField复用；许可证和上游比较见既有Phase3合同。全Goal的供应商/无VPN/教育集成仍待后续验收。Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

本轮沿用Pi1.0.2、Hana现代设置、仓库内已有Pro布局与CSS；官方Pro站点不可读/MCP传输失败按授权local fallback。OSS Button官方文档已核onPress/ghost/isIconOnly；Tooltip API按安装类型核受控visible，关闭隐藏浮层。无新依赖/SDK升级/模型预算/第二Runtime，6正式main清单核独立profile与不加载历史编排。第三方分发许可完整门禁仍OPEN。Next P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

继续安装Pi1.0.2/Hana现成接缝；未升级SDK、添加依赖或引入Codex CLI/第二Runtime。DeepSeek UI保存/Win加密/空环境冷启动真实调用通过16项，缓存usage按10实际SSE逐字段对账；浏览器真实MOE/DOM/本地截图通过20项。当前网络不能证明无VPN或安装。Phase4/5仍待许可证/能力/依赖/个性化适配。见Goal合同。

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

原 Pi SDK1.0.2 / native session / Hana工具层及原Pro组件复用，本轮没有升级包或复制第三方Runtime。仅本机薄装配wrapper；官方Electron setPath已查证：https://www.electronjs.org/docs/latest/api/app#appsetpathname-path 。禁止接入Codex CLI替代国内provider定制Pi；新教育能力继续拆Domain/Capability。

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

核现有Hana0.449 Apache-2.0文件宿主，Pi1.0.2官方SDK https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md 保唯一编排器。Pro MCP网关及官网file-tree不可达，依约读D:/WorkProject/HeroUIPro/herouipro-v3/src/components/file-tree、CSS/utils复用现有vendored源码；OSS Tabs从已安装@heroui/react原实现确认ScrollShadow data-slot/横向滚动，沿现有ResizeObserver补薄适配。没有新依赖/新许可证/Windows打包成本。DeepTutor/OpenMAIC教育Domain不负责预览Runtime；本轮不复制新源。

下一唯一：Phase1按Master第2247段完成整体requirements与证据审计（sidebar/chat/composer/history/working/summary/plan/tool/progress/artifacts/files/approval/steer/retry/resume/compaction/model/skills/settings/glass）。先映射现有源码/固定build/各有限closeout，列最早缺口并完成正式实例与真实视觉，再决定Phase1接受；学生提示间歇风险列入主路径欠项。不得无限重复已关闭文件小切片或跳到Phase2。之后按Master执行唯一Pi runtime、五产品空间、教育能力/飞轮和黄金A–G。

日常D/用户原凭证联网图片失败、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS实际版式、安全与Pro分发许可保持OPEN。三元暂停；日常out/profile/key、代理/DNS/VPN、Master/HEAD及上一轮closeout均保持，未提交/push。本轮未新测或估算DeepSeek缓存率。


## 2026-10-05 公开中文与教师确认办公交付有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。完整Master DoD保持，本轮仅M01/M10办公交付事实与默认中文公开过程有限A/C验收。

本轮核Pi官方sdk.md、extensions.md及本地1.0.2声明：message_end为真实完成消息，agent_settled为最终静止接缝；沿当前host settlement。核本地openhanako/core/desktop-session-submit.ts recordMessagePresentationEntry的displayText与promptText分离。Hana0.449现有工具/审批/Office与Apache-2.0许可保持，无复制新源/依赖。DeepTutor/OpenMAIC为教育Domain，不另搬Runtime解决Office公开展示；无新UI设计/Pro/finesse源码需求。

官方来源：https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md 。

下一唯一：Phase1 Files/Artifacts完整面板验收。既有FILE面板当前证据只有浅色宽窄；冻结现有Hana文件宿主、HeroUI预览/来源与当前主题复用合同，补文件导航、版本变化/损坏/失败返回、冷恢复、浅暗双尺寸与真实PNG，保只读权限和本地事实。完整Shell验收后进入Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮/黄金A–G。

日常D/用户原凭证联网图片反馈、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS排版、安全修补与Pro分发许可保持OPEN，三元暂停。未更换日常out/profile/key、代理/DNS/VPN或提交/push；Master/HEAD与日常out SHA原样，旧证据保留。本轮不新统计缓存率或承诺命中。办公公开交付采用可信回执，不宣称已把模型原始总结变成事实或解决所有自然语言幻觉。


## 2026-10-05 原失败会话创建指纹兼容有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅 M01/M10 已识别旧创建身份兼容有限 A/C 通过，保持完整 Master DoD。

本轮官方Pi SDK页面已实际读取：https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md 。保现有SessionManager/custom资源与显式cwd接缝。Pi1.0.2/Hana0.449源保持，本轮无需升级或引入DeepTutor/OpenMAIC，它们为教育能力而非创建身份解释器。无新许可证/安装体积/Windows打包依赖。

新增 creation-prompt-identity 薄适配器，只以当前规则或单个已核旧 copy 规则计算准确创建身份。pi-session 沿原创建版本验证 control/memory 等能力指纹，校验完再使用当前有效提示及原有能力后缀。新会话只使用当前身份；未知规则、模型/目录/工具/provider/权限变化、extra fields 或缺快照仍拒绝。原历史/创建记录不重写，当前宿主权限和教师新审阅/确认仍是真源。无新依赖、表、IPC、迁移表或第二 runtime。

固定隔离 build1 正常 npm run build 含 tsc exit0；323 文件，SHA 9d63bf140a710c4a1b889c587b2c27431fca70220151fabeea66a39c2a70e0ee。创建身份/保护索引边界6/6、renderer106/106、原教育入口207/207 exit0。原 pi-auto-ui-ik9wla/data 副本真实正式 Electron + DeepSeek：Abh1wh 20/20 success、exit0、rendererErrors[]，绑定构建与 runner SHA；未以 fresh seed 关闭旧兼容。207 为旧教育入口回归，不作唯一 Pi runtime 完成证明。

下一唯一：Phase1 公开中文摘要与教师修订后事实一致性。先冻结当前实际旧37正文/已确认41文件差异与英文过程的交付合同，比较现有 Hana/Pi 公开事件、Office确认结果/产物回执，复用成熟接缝；以原真实教师编辑→确认→文件→公开回复→cold链路逐字段验收，不能用模型说已完成或测试回读替代文件真源。之后完成 Shell，再 Phase2 唯一 Pi runtime、Phase3 五空间、教育适配/飞轮/黄金 A–G。

公开英文摘要、旧37正文与教师修订41文件一致性仍 OPEN。日常 D/用户原凭证联网图片反馈、无VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS排版、安全修补与 Pro 分发许可仍 OPEN；三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常profile/key、系统代理/DNS/VPN或提交/push。缓存策略不改，本轮未新统计命中率，不将历史比例写成当前保证。


## 2026-10-05 真实工作过程有限切片验收与继续位置

完整 Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮只接受 M01/M10 真实工作过程的有限 A/C 切片。

Pi1.0.2+Hana0.449既有自动整理/稳定prefix保持，无升级/新依赖。官方Pi SDK核Session队列/工具/compaction/agent_settled；官方DeepSeekKVcache搜索索引确认自动前缀缓存与usage读入字段，直接网页open超时记录保留，不能伪称完整最新页面读取成功。

真实 reported usage（排除auto副本继承30条旧run，未上报/停止分开）：control3个reported run缓存读入占输入87.08%；auto10个55.33%；Office7个94.65%；queue2个69.87%。分母=input+cacheRead+cacheWrite，input不含缓存读入；未报告分别2/3/3/3条，不按0补齐，不推算成本或保证未来命中率。原始可核验数字见usage-readback.json；原有稳定prefix与Hana/Pi缓存/压缩接缝保持，不为提高比例增加warmup调用。

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

**ADR-015：现有OSS Menu/Popover适配会话菜单。** A采用已安装HeroUI/RAC，同一主题/键盘/定位库；B官方Pro ContextMenu文档有键盘描述，但本地Trigger只鼠标/触摸且需新增授权源，未迁入；C原fixed div缺成熟语义/碰撞/焦点，不保作Codex新入口。Pi无renderer菜单，DeepTutor/OpenMAIC第二runtime不对应UI切片。现有Hana业务服务保留，finesse历史审阅不当本轮新源。官方[HeroUI ContextMenu](https://heroui.pro/docs/react/components/context-menu)、[RAC Popover](https://react-aria.adobe.com/Popover)、[RAC Menu](https://react-aria.adobe.com/Menu)与本地版本源码已核；Windows无新增依赖/服务/安装体积，既有Pro发布许可未因此关闭。

现有HeroUI3.2.2 MIT Dropdown.Menu/Item/Popover与React Aria1.19.0 Apache-2.0复用；宿主仅选择目标/鼠标键盘锚点，成熟组件负责导航、焦点/碰撞。锚点Portal到body，避开玻璃backdrop创建的fixed参照，12px安全内距；复用标准dropdown BEM样式和pi主题。Shift+F10/ContextMenu/上下键/Home/End/Enter/Escape、取消/成功后焦点恢复及被归档移除后聚焦新聊天，busy编辑锁和外部滚动关闭已接。原非Codex菜单/归档分支保持。无新增依赖、Pro源码、表/IPC/迁移/凭证/运行预算/第二runtime，Pi自动压缩不改。

证据入口：apps/desktop/test-results/goal/context-menu-20261005/closeout.json；本轮构建/日志与原始专项report/PNG逐文件SHA回读，所有首失败保持。

下一唯一：Phase1教师化公开消息投影。最终真实归档截图仍显示自动注入的/skill:teaching-office命令；先核其编码与projection来源，复用已有消息契约，只在公开UI呈现教师原输入，保native原文、技能选择、来源与旧会话兼容，冻结后以真实发送/工具/冷恢复及浅暗双尺寸验收。随后补齐其余Shell状态，再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮及黄金A–G。D/E、连续3次稳定、安全修补和Pro发布许可仍OPEN，三元暂停保持。

## 2026-10-05 设置与弹层切片验收结果

M01/M10设置、模型菜单、归档确认与附件/OCR弹层有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

**ADR-014：复用已有Hana设置和OSS Modal，统一局部主题。** A选现成设置/Modal/Dropdown+共享token；B不为局部问题新增整套设置或OCR引擎；C不搬DeepTutor/OpenMAIC第二runtime。官方Pro库存66/OSS72、Modal/ContextMenu/AlertDialog文档本轮已核，settings-layout/settings-row不在库存，未宣称存在。无新增Pro源码/依赖，既有Pro发布授权hold保持。

Hana449设置行/搜索/技能Row与其样式沿既有Apache-2.0来源复用，原vendored源保持；本轮只应用宿主CSS。OSS组件沿现有lock与Windows打包，无新增安装体积/运行服务。Pi版本未升级，未修改Hana/Pi运行循环。既有finesse0.20 MIT审阅记录仅历史参考，本轮未重新取得源码或增加其实现。

精确证据与SHA回读：apps/desktop/test-results/goal/overlays-20261005/closeout.json；原始专项报告及首次失败独立目录保留，最终命令/日志见docs/acceptance/CURRENT.md。前面layout/标题/controls为历史，不覆盖。

下一唯一：继续Phase1，先冻结会话右键菜单合同，复用成熟ContextMenu/Menu适配器，补Shift+F10/上下键/Enter/Escape与焦点恢复、屏幕边缘避让及native浅暗双尺寸；当前仍是fixed原始div，不能因归档Modal已验就称会话菜单完成。其余Shell状态验完后再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；D/E、安全修补及Pro许可仍OPEN，三元暂停保持。

## 2026-10-05 布局与暗色控件切片验收结果

M01/M10布局与暗色控件有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

复用现有HeroUI Pro AppLayout/Sidebar/ChatConversation/Dropdown与OSS变量，官方MCP可用且已核content模式/滚动接缝；原finesse MIT0.20设计指导仅审阅。不增依赖、不升级Pi、不引入浏览器/runtime新轮子；Windows包体/许可证本轮无新增，既有Pro许可发布hold保持。

复用既有HeroUI AppLayout content、Sidebar、ChatConversation、Dropdown及控制卡。直接aside由100dvh改为父内容区100%，消除36px菜单+8px间距形成的44px外层隐藏滚动；仅消息/侧栏内容拥有滚动。工作区与其pi-office-menu portal统一pi语义色，并补HeroUI accent-soft/segment及旧text/line/danger别名；技能Popover补现有主题class。问答、计划、失败/审阅及办公编辑浅暗色一致，未新增依赖/表/IPC/迁移/凭证/预算/第二runtime；原自动压缩保持。

依测试样例说明书按C隔离正式Electron记录，仅最终单轮通过，不追认为连续3次稳定，不关闭用户旧配置/会话失败。Office真实模型四格式生成、确认/拒绝、教师修订、来源CAS/版本冲突、实际kill与两次冷恢复、SQLite/file SHA及独立Python格式回读通过；本轮未新验WPS/Microsoft Office应用排版。文件面板无provider新请求；未借此外推NET/OCR/视觉或全harness完成。日常out323文件SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master与HEAD保持，日常profile/钥未改，无提交/push。

证据入口：apps/desktop/test-results/goal/layout-20261005/closeout.json；原始报告在apps/desktop/test-results/xiaozhi-agent上述独立目录，build5.log、renderer-build5.log、main-build5.log及四专项最终日志在owned layout目录。前面历史标题/controls/glass结果保留，以下新增记录为当前有限状态。

下一唯一：继续Phase1，冻结设置工作区、会话管理与附件/OCR弹层合同，核浅暗主题、错误/重试与可达性，再用真实native双尺寸验收。完整Shell后继续Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；日常人工D、无VPN/安装E、安全修补及Pro许可仍开放。

## 2026-10-05 自动标题兼容切片验收结果

自动标题本地fallback兼容切片有限通过；Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。普通append与附件原子publish共用conversationTitle，合法/skill前缀不挤占任务标题，保原提示词/Pi原生记录；不是新增LLM语义摘要命名。

已核本机Pi1.0.2 _expandSkillCommand源码首ASCII空格边界、Hana core/llm-utils.summarizeTitle真实依赖与取消/null；未新增库/云请求或升级上游。许可证/Windows体积/分发无新增；现有Pro许可hold不解除。settings真实保存配置正式Flash200 + native取消；官方目录缓存仍不当凭证验证。

下一唯一：Phase1专项定位问答/长过程中的Shell顶部裁切，冻结布局/滚动与完整暗色菜单合同，复用既有HeroUI/语义主题和原控制卡，以真实native双尺寸、可达性与PNG验收。完整Shell后再Phase2退役重复runtime、Phase3五空间、教育适配/飞轮/黄金A–G；日常人工D、无VPN安装E、安全修补与Pro许可仍开放。

## 2026-10-05 CTRL/CFG当前构建验收结果

Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。仅复用现有Pi1.0.2/Hana队列宿主、控制卡和设置进行当前构建验收；本轮没有生产源码、依赖、表、IPC、预算、凭证或日常数据迁移。

npm官方本轮只读查询@earendil-works/pi-coding-agent当前1.0.2，与锁定安装一致；未安装/升级，也不当全上游diff复核。Pi/Hana原生消费和旧native续接通过3，UI保存配置正式Flash/Pro9次200；模型与能力是当前官方目录结果，不承诺永远不变。依赖/许可证/Windows分发影响无新增；Pro授权和后续教育适配hold仍在。

下一唯一：冻结/skill自动标题兼容合同，核普通append与附件原子append两条路径，保手工标题、原提示词、历史/native绑定与本地真源；完成后继续Shell顶部裁切、完整暗色菜单与其余缺口。Phase2退役重复runtime、Phase3五空间、教育适配/飞轮、黄金A–G、日常D与无VPN安装E仍开放，不重复已通过的有限审计。

## 2026-10-05 Glass主壳与文件版本接缝结果

本轮使用官方HeroUI MCP AppLayout/Sidebar/PromptInput/ChatTool/Tooltip与glass variables；复用原Pro结构，只新接既有@heroui/react OSS Tooltip。源码、LICENSE/NOTICE和安装版本未改；既有Pro公开分发授权继续独立OPEN。finesse本地MIT0.20.0，ai-console/product-ui可用；引用product-palettes等文件缺失，选择Master固定视觉与官方token而非未经验证下载。公开主题证据在apps/desktop/test-results/goal/glass-20261005/heroui-glass-reference.md。

本轮Glass主壳与来源版本接缝有限验收通过，Phase1完整Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。生产新增仅工作区glass语义CSS、原OSS Tooltip接线，以及Hana文件回执可选version回调；Pi两处host复用既有fileVersion。正文sha256与来源version分开，读取前后变化拒绝，不放宽来源CAS/权限/教师确认。不新增依赖、表、IPC或第二runtime，不设置运行预算，原自动压缩保持。

下一从Phase1原CTRL/CFG的当前构建验收继续：真实运行中编辑/撤回、停止、补充/重试、设置保存返回同会话；按实际缺口冻结合同修复。随后独立兼容合同处理/skill自动标题两条路径，完成完整Shell，再Phase2退役旧runtime、Phase3五空间。原用户失败/D日常、E无VPN与安装、A–G、安全补丁/私有日志/userData ACL/备份恢复、Pro许可仍OPEN；三元暂停保持。已有壳/包审计不再重复。

更新2026-10-05。版本/状态详见 [矩阵](../goal/CAPABILITY_MATRIX.md)，逐迁移须补许可证、依赖体积、Windows兼容和真实场景证据。

| 集成 | 锁定身份 / 边界 |
| --- | --- |
| Pi | SDK1.0.2，MIT；唯一目标编排器，保原stream/native/tool/compaction |
| DeepTutor | vendored/local1.5.11；隔离官方HEADf07029c…源码1.6.13，Apache2.0；选教育服务，不搬loop/站点/storage |
| OpenMAIC | 636fab0…/1.2.0-rc.1，独立六包；根MIT，逐模块/字体/LICENSE核查，bundled LGPL不能忽略 |
| HeroUI | MCP66个Pro组件与glass查询可用；现有本地vendor商业许可发布证据待核，OSS与Pro分开 |
| finesse | 既有本地Skill/设计refs可参考；无可用MCP，不假称在线组件源 |
| Hana | 既有450适配来源/NOTICE保留；工具/配置/压缩参考，不接CodexCLI或第二loop |
| Hermes self-evolution | 官方README候选；仅部分技能优化已实现，其余计划；固定源/完整许可/评估边界未闭合，不直接移植 |

官方来源：[Pi](https://github.com/earendil-works/pi)、[DeepTutor](https://github.com/HKUDS/DeepTutor)、[OpenMAIC](https://github.com/THU-MAIC/OpenMAIC)、[Hermes self-evolution](https://github.com/NousResearch/hermes-agent-self-evolution)。锁定Git身份比未锁README“最新版”更精确，版本不自动升级已有用户环境。

六个独立包完整MIT许可已读；包源码（排除dist/node_modules，包含测试/文档）分别DSL315,656 / generation849,835 / renderer627,549 / editor989,903 / importer1,617,669 / storage1,893,890字节。这些不是安装体积；还需打包后测量。React19可满足声明peer，但Tailwind≥4、字体、渲染sandbox、导出依赖和Electron资源加载尚需实测。

`generation` 的AICallFn与无provider/存储设计是优先适配接缝；`storage`仅选本地backend契约，不搬PG/S3/HTTP server；DeepTutor新store不可直接接入第二SQLite真源。详见 [架构分类](../architecture/CURRENT.md)。

## UI/桌面候选对比（2026-10-05 官方只读研究）

| 候选 | 核实来源与能力 | 当前取舍 |
| --- | --- | --- |
| 现有HeroUI/Pi/Hana closure | 当前真实接线及C证据、官方Pro glass/components查询 | 优先沿现有状态与组件边界落地，许可未闭的Pro源码不新增迁移 |
| assistant-ui | [官方自定义runtime](https://www.assistant-ui.com/docs/runtimes/custom/overview)支持ExternalStoreRuntime/AssistantTransport接外部状态和双向指令；[根LICENSE](https://github.com/assistant-ui/assistant-ui/blob/main/LICENSE)为MIT | 可作展示层备选；不让UI LocalRuntime接管Pi编排。暂不加第二套组件/依赖，只有现有组件无法满足具体需求时验证最小adapter |
| OpenWork | [官方仓库](https://github.com/different-ai/openwork)说明桌面/core非ee目录MIT、ee另有商业条款；由OpenCode驱动 | 工作流/文件体验参考；完整runtime不适合Pi唯一编排，未做固定源码/许可证闭包验证，不迁移 |
| Open WebUI | [官方LICENSE](https://github.com/open-webui/open-webui/blob/main/LICENSE)有品牌保留及例外条款 | 不作为“小智”换牌基础；未做完整依赖/桌面架构验证，不迁移 |

这是架构适合度判断，非候选在EduDev实跑通过；许可证摘要不代替迁移时固定commit、文件、NOTICE与转依赖检查。Liquid Glass优先官方主题token与原可访问组件，避免引入第二整站/后台。

## 新增上游接口与发布边界

DeepTutor15项处置见 [能力矩阵](../goal/CAPABILITY_MATRIX.md)。ReadingService明确注入store且不知LLM/chat/HTTP；QuestionBank工具有六动作且是graded entries，不是普通笔记；ParseService按需解析/引擎就绪/cache；RAGService每KB绑定provider；LLMClient自称legacy且会配env；attachments/session存储不能取代现有native或上传规则。八个固定Git blob接口记录在Phase0 owned证据目录。上游Session POSIX锁和agentic client SSL bypass不能迁入Windows正式运行路径。

官方 [HeroUI Pro licensing](https://heroui.pro/docs/react/getting-started/licensing) 与 [Terms §8–9](https://heroui.pro/terms) 本轮已读取：有许可的项目集成与底层源码独立传播是不同边界；Pro不是MIT。仍未读取用户购买/席位/版本许可证明，也未查明本地Pro根LICENSE；不访问用户token、不做购买/发布。现有OSS可继续，Pro新增源码迁移与公开发布保留明确hold；不因MCP查询成功当商业授权已核闭。

当前没有生产依赖安装或vendor升级；仅在ignored owned consumer完成三个固定OpenMAIC包的隔离审计安装。候选原生binary/Python引擎/Office及正式Windows打包仍待验证。只在package scripts/Git跟踪目标中未找到Electron builder/forge/NSIS或应用安装脚本、未见.github，这不是扫描所有用户磁盘后断言没有安装包；安装/CI属于明确待建门禁。

## 三个独立包的隔离实测（2026-10-05）

官方registry固定 `@openmaic/dsl@0.11.2`、`generation@0.3.15`、`renderer@0.1.11`；三个tarball实际SHA512与registry一致，压缩116153/234014/915959、解包500691/835458/1507135字节。Git官方HEAD只读再次核对636fab…且本地clean；registry未提供gitHead，不把版本相同称作完整构建可复现或签名验证。renderer的45份source-map嵌入源与固定checkout经CRLF规范化全部相同，generation38份模板/snippets/PBL资源相同；DSL16/generation32份map没有sourcesContent，未证明这些JS逐字来自同commit。

owned consumer安装命令为 `npm install --ignore-scripts --no-audit --no-fund`，78包、149529125字节；原manifest/lock/vendor未动。完整许可/NOTICE正文与SHA写入 `test-results/goal/phase0-3f5282f0/package-audit/license-inventory.json`（apps/desktop下）：无缺license文件包；声明MIT、ISC、Apache2、BSD2/BSD3、0BSD。ECharts还包括d3 BSD3及Apache NOTICE，Lucide含Feather MIT，不能只保根MIT；Shiki包含onig.wasm，无.node/.exe/.dll，grammar/wasm最终分发闭包仍是Phase5 gate。

复用上游tarball smoke与scene-generation测试方法，在原audit新增 `--packages <owned consumer>`：一份DSL/caret范围、真实Node/实际Electron主进程ESM imports、prompt资源、注入slide/quiz、错误输出callback、真实browser bundle、sandbox renderer点击及两content尺寸通过。注入是合成响应，没有provider/正式Pi/教师课堂验收。最终u38Mxk 5项/exit0；eMcaeG为前一有限通过；两初失败I7RsMQ（ESM顶层await启动超时）、kzrqoQ（重复React导致useContext null）保持，修复只在测试entry和bundle alias。

完整renderer bundle11203418字节（3128个input，最终metafile实际回读），这不是安装包大小；支持根入口的ECharts6.1.0注册解包60MB，占安装体积显著。预编译SlideCanvas内置prose/styles，本次文字无需Tailwind扫描就正确显示；没有证明editor/classroom全CSS正确。两PNG已实际查看，中文/3²+4²=5²/练习完整，不越界；只是合成组件接缝，非LiquidGlass新工作台视觉验收。

字体没有下载：renderer/fonts.css默认外部CDN，**DO NOT USE**。OFL、ZCOOL Happy及Arphic完整文本分别核；如未来分发字体必须保对应notice/保留名称及修改条款，不能标MIT。本例用Windows系统字体，未测试KaTeX专用字体、图片/视频/chart/code、snapshot/export。富文本/表格/shape与latex使用dangerouslySetInnerHTML，正式adapter必须宿主schema/sanitize、资源URL allowlist与独立sandbox；现有包不是安全过滤器，不因合法合成例可用直接迁移不可信内容。

## 2026-10-05 实际依赖可达性与发布修补门禁

fresh npm audit --omit=dev --json exit1，0critical/3high/2moderate；npm explain保全路径，原report及inventory在security-0785b4e6。Undici7.24.7属公网host与transitive，Electron43.2.0实际桌面host；Mermaid11.16.0→DOMPurify3.4.12属于Streamdown，nanoid3.3.16属PostCSS/Vite，docx另为6.0.1。本轮不改依赖/锁/vendor，不执行audit fix。

官方[Electron弹窗公告](https://github.com/electron/electron/security/advisories/GHSA-gr2m-v5gq-v685)说明deny可阻断该一项；不外推全部四项。官方[Undici BalancedPool](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3)与[decompress interceptor](https://github.com/nodejs/undici/security/advisories/GHSA-3xpg-4rpp-hhhm)分别限定受影响API；实际公网host使用Agent，选定源码无上述API，不代表所有transitive安全。后续升级到覆盖完整fresh audit集合的固定补丁版本，验证真实DNS/代理/取消/浏览器/流式/Markdown/安装，再复审无未处置风险才过发布gate。

本轮审计没有新依赖；新状态策略只用既有shared契约，不复制受限制Pro源或引入第二loop。阶段已进Phase1，完整迁移许可/字体/媒体/grammar/wasm仍保原hold。
