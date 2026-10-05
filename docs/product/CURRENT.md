# 当前产品方向

## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。

资料工程页已由实际资料目录替代；教学内容默认进入真实跨会话文件目录，保存内容/当前预览/来源对话明确分开。完整传统教学与学生页面尚未完成。教师资料页使用现有 getKnowledgeOverview/importKnowledgeResources/showKnowledgeResource，显示实际资源/摘录和收录状态，已添加不等于已解析。当前仅TXT/Markdown真的收录；PDF/Office/图片仍正文待处理，不伪称可检索。资源最近100份、摘录最近24块、教学文件最近100份；筛选仅当前已载入名称/格式，非全文或全库检索。教学默认artifacts，跨会话目录显示真实保存事实，历史保存内容与当前本地文件预览分开展示；预览仍复用已有会话授权/version校验，定位由main核实际路径/产物ID后发送OS文件夹定位。文件不存在必须失败，不以旧摘要冒充当前内容。外链/图片不在目录Markdown中自动加载。旧knowledge工程页仅legacy-test，备课/讲义/题本入口保留。

Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-01/P3-02仅导航与聊天连续性实现层 A/C 接受；完整 Phase3、Goal、日常、发布、人工仍 NOT_ACCEPTED。旧接口模拟数据不作为新能力真源，跳过测试样例书与旧模拟业务兼容投入。 正式五入口已贯通真实本地管理页，执行/草稿/冷恢复保持；旧模拟种子已停止，新接口真实事实优先。现有资料技术布局与教学产物目录缺口保留，完整Codex体感/全设计尚未接受。Next P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

正式小智Runtime阶段实现A/C接受；Next P3-01盘点“问小智、我的资料、教学内容、学生、设置”，保传统可视化管理，隐藏技术菜单，接新接口真实本地数据。主聊天过程/控制/整理与浏览器本轮路径通过，完整Codex体感/教育能力/人工仍OPEN。详见Goal CURRENT_STATE。

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

教师默认进入小智；启动中有等待与返回，失败可重试；旧对话可打开参考，资料/学生/教学内容传统工作台保留。五个产品概念不变，不暴露运行策略或旧编排开关。

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

隔离build3正常npm build含tsc exit0，323文件/SHA 8f623c5ee2a3bb0c9cf7a81844221f9c9463b7c38fd778b26a60ff1dc5e6ded3。renderer106/106，原文件边界/真实IPC22/22，正式Electron文件UI d0GAsH 32/32 exit0、rendererErrors[]、remoteRequests[]；原教育主路径main2 207项exit0，均保首次失败。UI绑定同build/script SHA，保原25断言并补键盘tree/Tabs、真实拖动、损坏DOCX失败和实际重试、浅暗/错误/冷恢复；版本变化清旧正文后实际重读38、文件删除、未知/归档会话撤权、本地不存正文。测试采用合成文件/受控原生chooser，仅C，不含本轮真实provider任务。

保留wu6ikR首失败：light filter placeholder对比2.771，语义色修复。DI9b2z虽32功能通过，但真实图审发现选中Tabs在缩窄/主题切换后被裁出，不作最终验收；CAll3y首次新assert用了不存在的class（测试选择器错误），rJ4tO1改为原ScrollShadow data-slot后真实复现可见范围超时。build3同断言32通过。原main1在学生保存success提示等待超时；实际截图档案已创建且反馈消失，main2未改学生源码207通过，间歇提示风险仍OPEN，不能写成已修复或三次稳定。

下一唯一：Phase1按Master第2247段完成整体requirements与证据审计（sidebar/chat/composer/history/working/summary/plan/tool/progress/artifacts/files/approval/steer/retry/resume/compaction/model/skills/settings/glass）。先映射现有源码/固定build/各有限closeout，列最早缺口并完成正式实例与真实视觉，再决定Phase1接受；学生提示间歇风险列入主路径欠项。不得无限重复已关闭文件小切片或跳到Phase2。之后按Master执行唯一Pi runtime、五产品空间、教育能力/飞轮和黄金A–G。

apps/desktop/test-results/goal/files-panel-20261005/closeout.json

日常D/用户原凭证联网图片失败、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS实际版式、安全与Pro分发许可保持OPEN。三元暂停；日常out/profile/key、代理/DNS/VPN、Master/HEAD及上一轮closeout均保持，未提交/push。本轮未新测或估算DeepSeek缓存率。


## 2026-10-05 公开中文与教师确认办公交付有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。完整Master DoD保持，本轮仅M01/M10办公交付事实与默认中文公开过程有限A/C验收。

最终隔离build2正常npm build含tsc exit0，323文件/SHA 10cfb5c7c1575437d971c7ebc3f7ce452ed9bd3a69b3535ccc601411d28ded58；renderer106/106、coordinator11、创建身份/保护索引6、原教育入口207均exit0。正式Electron/真实DeepSeek pi-office-artifact-ui-np8ArB 28项success/exit0/rendererErrors[]，绑定同build/script SHA。4格式教师改标题/末段/数值41、旧revision拒绝、实际DOCX/PDF/XLSX/PPTX生成/独立文件内容、版本谱系/来源conflict/停止/两阶段kill/再次cold均验；4公开回执不复述未收到的教师正文、旧37或猜41，cold文本完全保持。中文逐段检查为本批真实自然任务的有限证据，不能保证未来所有模型回复。207保旧教育入口，不证明唯一Pi已完成。

复用现有Office本地事实、Pi原生事件与宿主publicItems，新增office-delivery-presentation薄适配器。实际Office终态之后的模型文字先缓冲到message_end：非最终摘要继续展示并保后续工具/控制事件；最终草稿总结不作为公开交付，宿主从本轮实际Office状态生成回执并持久化。原模型文本仍在native中。拒绝/停止/冲突/uncertain分别说明，不据旧run文件推导本轮成功，不把保存等同整任务完成。普通聊天不新增Office查询。教师修改正文保持本地；没有为修正旧37总结自动上传确认版。有效提示后缀强调默认简体中文和实际工具，不改旧创建identity/能力指纹或权限。无新依赖/表/IPC/第二runtime/预算。

首失败ZRNVxh保留：公开Markdown文件名转义句点，原测试直接includes未转义名，SQLite已经保存正确回执；修测试编码断言，不改实际文件。yb94y1保留：真实模型识别来源已41而新请求37/旧标题的矛盾，等待教师澄清并非生成器卡死。扩展已有runner，经正式问答回答来源41保持、新拟内容按本次37/8要求后再由教师修改确认；不禁用澄清、不篡改材料或降低产物断言。coordinator1/2/3均通过，首两份是早期适配器版本，不当最终构建证据。

下一唯一：Phase1 Files/Artifacts完整面板验收。既有FILE面板当前证据只有浅色宽窄；冻结现有Hana文件宿主、HeroUI预览/来源与当前主题复用合同，补文件导航、版本变化/损坏/失败返回、冷恢复、浅暗双尺寸与真实PNG，保只读权限和本地事实。完整Shell验收后进入Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮/黄金A–G。

证据：apps/desktop/test-results/goal/office-facts-20261005/closeout.json。

日常D/用户原凭证联网图片反馈、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS排版、安全修补与Pro分发许可保持OPEN，三元暂停。未更换日常out/profile/key、代理/DNS/VPN或提交/push；Master/HEAD与日常out SHA原样，旧证据保留。本轮不新统计缓存率或承诺命中。办公公开交付采用可信回执，不宣称已把模型原始总结变成事实或解决所有自然语言幻觉。


## 2026-10-05 原失败会话创建指纹兼容有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅 M01/M10 已识别旧创建身份兼容有限 A/C 通过，保持完整 Master DoD。

原 aXLjJ8 / copied pi-auto-ui-ik9wla 配置拒绝已定位：原授权工作目录会话创建时使用旧 copy 审批提示规则，后续文案更新直接改变创建 fingerprint，恢复在请求 provider 之前拒绝。两份旧授权 native 的指纹精确匹配已保存 p07-office-document-tools 原源码；私有会话精确匹配当前规则。不是这两份会话的凭证或网络故障。

固定隔离 build1 正常 npm run build 含 tsc exit0；323 文件，SHA 9d63bf140a710c4a1b889c587b2c27431fca70220151fabeea66a39c2a70e0ee。创建身份/保护索引边界6/6、renderer106/106、原教育入口207/207 exit0。原 pi-auto-ui-ik9wla/data 副本真实正式 Electron + DeepSeek：Abh1wh 20/20 success、exit0、rendererErrors[]，绑定构建与 runner SHA；未以 fresh seed 关闭旧兼容。207 为旧教育入口回归，不作唯一 Pi runtime 完成证明。

原任务验收码/年级在多次原生整理后保持；工具后同一公开 run 继续、整理中停止不提交、真实摘要响应后的提交前故障不写历史、native commit 后实际 kill/cold 标记 interrupted、显式新请求继续原任务而不重放写入，当前完整协议超容量仍拒绝。原3份 native 文件字节前缀与 education.snapshot/control 创建条目逐字节保持，source 哈希与实施前一致。

原 aXLjJ8 报告保留为首失败；其已识别旧创建身份缺陷现为有限 A/C 已修复，未知配置依旧拒绝。本轮 boundary1 首失败是既有测试正则遗漏修改/产物字段；按实际5字段修断言，生产保护索引格式不变，boundary2 6项通过。其他历史失败不删除，单次成功不称三次稳定。

证据：apps/desktop/test-results/goal/compatibility-20261005/closeout.json。

下一唯一：Phase1 公开中文摘要与教师修订后事实一致性。先冻结当前实际旧37正文/已确认41文件差异与英文过程的交付合同，比较现有 Hana/Pi 公开事件、Office确认结果/产物回执，复用成熟接缝；以原真实教师编辑→确认→文件→公开回复→cold链路逐字段验收，不能用模型说已完成或测试回读替代文件真源。之后完成 Shell，再 Phase2 唯一 Pi runtime、Phase3 五空间、教育适配/飞轮/黄金 A–G。

公开英文摘要、旧37正文与教师修订41文件一致性仍 OPEN。日常 D/用户原凭证联网图片反馈、无VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS排版、安全修补与 Pro 分发许可仍 OPEN；三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常profile/key、系统代理/DNS/VPN或提交/push。缓存策略不改，本轮未新统计命中率，不将历史比例写成当前保证。


## 2026-10-05 真实工作过程有限切片验收与继续位置

完整 Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮只接受 M01/M10 真实工作过程的有限 A/C 切片。

复用 workspaceStatus、已有 Pi 公开 projection、OSS Spinner 和现有主题，在输入栏上方增加活动状态；收起资料栏仍可见。仅当前 inProgress 工具显示执行标签，审批/补充不转动，自动整理显示真实状态，终态不残留 working；不展示私有 reasoning/summary。pi-session 只将既有脱敏 protectedContext 放在当前教师请求之前，保原文本和同会话权限；不新增编排器、依赖、表、IPC、运行预算或新的记忆系统。

最终隔离 build2 正常 npm run build（含 tsc）exit0，323 文件/SHA da1be87276cc8495e1b6de073657f5d7ff246699d19fd9064183f93ff22009a0；renderer106/106、原教育入口207/207 exit0。串行固定同一 build2：control D2k7nY 30、auto TnxVWr 20、Office msC1oS 26、queue LIx1cj 16，均 success/exit0、rendererErrors[]，绑定脚本与构建 SHA。207 是原教育入口回归，不是唯一 Pi runtime 完成证明。

正式 Electron/真实 DeepSeek：plan/question/steer/followUp/编辑/撤回/停止/crash/cold/自然澄清；多次原生自动整理、工具后同 public run 续执行、整理中停止不提交、失败前提交不写 history、native commit 后真实 kill/cold/new explicit request 返回原验收码和年级，原旧 source bytes 保持。Office 实际教师修订/批准/拒绝、DOCX/PDF/XLSX/PPTX 文件生成与独立内容回读、来源变更/版本冲突、停止和两种崩溃恢复通过；数值最终以教师修订41和真实文件为准。

实际Office正文旧数值/英文过程仍OPEN；四格式文件正确不能外推完整办公质量。主题测量合同补充：a3RMrm保原失败，等待真实有限150/250ms过渡而不禁动画。

下一唯一：先定位原 copied pi-auto-ui-ik9wla 会话的创建快照/配置指纹兼容失败（aXLjJ8），冻结可识别版本的迁移、回滚和原字节验收合同，再修复；不得用 fresh seed 通过关闭旧兼容、放松权限指纹或重写 native JSONL。之后补齐 Shell：中文公开摘要、教师修订后正文与实际文件数值一致；再 Phase2 唯一 Pi runtime、Phase3 五空间与教育能力/飞轮/黄金 A–G。

证据：apps/desktop/test-results/goal/live-process-20261005/closeout.json。

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

教师新输入消息不显示自动加入的技能技术命令；手写命令保留。没有可验证原输入的旧消息保持原样，原事实不迁写。

依测试样例说明书为A/C有限切片，不是日常D、无VPN安装E或连续3次稳定，不关闭用户原凭证/联网/图片失败。NET、cache命中、OCR/视觉/四格式Office及全harness本轮未重新验；日常out SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302及HEAD20aa86656cdb5a0f85e0e11fa21863b50233fcb1保持，日常profile/key不改，无commit/push。

下一唯一：继续Phase1联网过程、来源预览与内置浏览器工作台验收。按测试样例说明书NET-01/02/03/04，核当前构建真实搜索→正文→浏览页面/截图→来源打开、错误/重试/停止/冷恢复与浅暗双尺寸；先比较Hana/Pi现有实现并冻结合同，复用现有工具/权限/浏览器宿主。原自动压缩、不设运行预算、国内DeepSeek保持；缓存命中率另以真实usage统计，不能拿提示词长度推算。之后Phase2唯一Pi、Phase3五空间与教育适配/飞轮/黄金A–G。D/E、连续三次稳定、Pro许可与安全修补仍OPEN，三元暂停。

## 2026-10-05 会话菜单切片验收结果

M01/M10会话菜单有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

教师可以用鼠标或键盘管理会话和分类，重命名失败保留编辑，归档经确认且不删除历史。最终公开消息仍含自动/skill技术命令，下一必须修公开投影；本地原文和事实保留。

证据入口：apps/desktop/test-results/goal/context-menu-20261005/closeout.json；本轮构建/日志与原始专项report/PNG逐文件SHA回读，所有首失败保持。

下一唯一：Phase1教师化公开消息投影。最终真实归档截图仍显示自动注入的/skill:teaching-office命令；先核其编码与projection来源，复用已有消息契约，只在公开UI呈现教师原输入，保native原文、技能选择、来源与旧会话兼容，冻结后以真实发送/工具/冷恢复及浅暗双尺寸验收。随后补齐其余Shell状态，再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮及黄金A–G。D/E、连续3次稳定、安全修补和Pro发布许可仍OPEN，三元暂停保持。

## Phase1 会话菜单合同（2026-10-05，实施前冻结）

M01/M10教师可见结果：现有小智会话及文件夹支持右键、Shift+F10/ContextMenu键打开菜单，上下键/Enter/Escape与焦点恢复，屏幕边缘避让，浅暗双尺寸可读。重命名、取消、失败重试、归档确认及冷恢复使用原typed服务；菜单操作不创建模型任务，草稿/消息保持。

候选A选已安装HeroUI3.2.2 MIT Dropdown.Menu/Item/Popover及React Aria1.19.0 Apache-2.0定位、焦点、键盘基础，仅适配业务目标及鼠标/键盘锚点。官方ContextMenu属Pro，文档有键盘支持但本地源码版本Trigger只有鼠标/触摸；B新搬Pro会增加许可待确认源且仍须键盘适配，故本轮不新增Pro源码。C原fixed div无菜单语义/碰撞/焦点，不采用。Pi无renderer菜单，DeepTutor/OpenMAIC业务runtime与此局部UI不对应；Hana现有业务宿主保留。既有finesse审阅是历史设计参考，不宣称新引入。官方来源：heroui.pro/docs/react/components/context-menu、react-aria.adobe.com/Popover、react-aria.adobe.com/Menu。

修改范围：AiConversationSidebar及现有pi-control-menus-ui-smoke；必要主题样式与已有renderer测试。无新依赖/IPC/表/目录迁移/凭证/运行预算/第二runtime，包体仅局部组件接线。旧非Codex入口保留原菜单分支。回退为本轮源文件备份，绝不重置用户脏树；数据真源和授权保持。

完成定义：正常隔离npm build含tsc、renderer、主207教育回归、扩展现有菜单native双尺寸浅暗/边缘/键盘/真实业务及冷恢复、设置专项已有改名归档链路、实际PNG审阅和git diff --check。首次失败保留，C单轮不当D/E/三次稳定，不关闭用户原失败；全Goal仍ACTIVE/Phase1 NOT_ACCEPTED。证据固定于test-results/goal/context-menu-20261005。完成后再评估最早Shell缺口，不能跳过Phase2–8。

## 2026-10-05 设置与弹层切片验收结果

M01/M10设置、模型菜单、归档确认与附件/OCR弹层有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

教师设置、技能状态、归档确认和本地附件预览统一浅暗主题；归档保消息，不是删除。教师校正后才允许模型读取必要脱敏文本。最小视觉切片通过不表示完整Codex同款、完整五空间或教育闭环完成。

精确证据与SHA回读：apps/desktop/test-results/goal/overlays-20261005/closeout.json；原始专项报告及首次失败独立目录保留，最终命令/日志见docs/acceptance/CURRENT.md。前面layout/标题/controls为历史，不覆盖。

下一唯一：继续Phase1，先冻结会话右键菜单合同，复用成熟ContextMenu/Menu适配器，补Shift+F10/上下键/Enter/Escape与焦点恢复、屏幕边缘避让及native浅暗双尺寸；当前仍是fixed原始div，不能因归档Modal已验就称会话菜单完成。其余Shell状态验完后再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；D/E、安全修补及Pro许可仍OPEN，三元暂停保持。

## Phase1 设置与弹层合同（2026-10-05，实施前冻结）

M01/M10：继续尚未验收的设置、会话管理和附件/OCR浅暗主题及可达性。复核layout切片26张PNG/同构建门禁后继续，不重做已通过审计；完整Shell/Goal保持DOING / NOT_ACCEPTED。

真实缺口：设置壳、模型子页、技能详情显式白底/灰字，默认模型Dropdown与附件Modal不在局部palette范围；会话归档为内联div冒充aria-modal，缺成熟焦点/键盘隔离。现有Hana449设置 primitives/row/search与原typed服务已贯通，Pi附件本地OCR/CAS已有；无需新设置系统或OCR引擎。

复用对比：A现有Hana Apache-2.0设置及HeroUI OSS Modal/Dropdown/表单+共享pi palette选定；B迁移DeepTutor/OpenMAIC设置会带入另一provider/runtime或web应用，不适合当前仅UI接缝；C新手写dialog/menu/focus不采用。HeroUI官方MCP已核Modal inside滚动/焦点/ESC、ContextMenu和AlertDialog；现有Pro/OSS与Hana许可清单保留，不复制新受限源码。Pi控制与自动压缩独立保持。未开放不存在的settings-layout/settings-row API。

将改局部office主题CSS、相关settings/附件/会话弹层class及现有专项测试；按需以既有OSS Modal适配Codex归档确认，保legacy入口、原归档回调与原消息数据。无表/IPC/协议/数据迁移/依赖升级/模型切换/凭证改动/预算/外部上传。仅owned测试配置保存和合成材料；日常out/profile不变。回滚局部CSS/组件/测试即可。

完成定义：正常build含tsc、renderer/main既有门禁；现有设置/附件/OCR专项完整路径仍过，真实DeepSeek或固定本地OCR证据分开写。真实native1366×768/1920×1080浅暗设置/模型菜单/附件识别审阅/归档确认PNG实际看；关键文本/控件contrast≥4.5，操作与关闭可达，成熟modal焦点隔离/ESC恢复，失败/重试/停止/冷恢复不回退。首次失败保留，C不当D/E或3次稳定。自定义会话context-menu若仍缺键盘/边缘定位验收则保留为Phase1下一修复，不据其他弹层通过关闭；随后完整Shell→Phase2唯一Pi→五空间→教育/飞轮/黄金A–G。

## 2026-10-05 布局与暗色控件切片验收结果

M01/M10布局与暗色控件有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

复用既有HeroUI AppLayout content、Sidebar、ChatConversation、Dropdown及控制卡。直接aside由100dvh改为父内容区100%，消除36px菜单+8px间距形成的44px外层隐藏滚动；仅消息/侧栏内容拥有滚动。工作区与其pi-office-menu portal统一pi语义色，并补HeroUI accent-soft/segment及旧text/line/danger别名；技能Popover补现有主题class。问答、计划、失败/审阅及办公编辑浅暗色一致，未新增依赖/表/IPC/迁移/凭证/预算/第二runtime；原自动压缩保持。

本轮实际查看最终26PNG：菜单12、问答4、Office审批4/编辑2、文件面板4。1366×768/1920×1080是真实BrowserWindow content尺寸，截图DPR1.5为2049×1152/2880×1620；控件聚焦/展开与菜单Escape后壳无隐藏滚动、标题/输入/停止及审批操作可达。非禁用关键正文/编号/计划、菜单idle与鼠标hover、审批接受/拒绝及编辑字段实测对比度≥4.5。文件4PNG为浅色宽/窄，不能当暗色视觉证明；工作区dark由媒体模拟，不是Windows整机主题或无backdrop/forced-colors当前视觉验收。1366暗问答卡顶部允许随消息内容滚动，未声称全部正文同屏。

依测试样例说明书按C隔离正式Electron记录，仅最终单轮通过，不追认为连续3次稳定，不关闭用户旧配置/会话失败。Office真实模型四格式生成、确认/拒绝、教师修订、来源CAS/版本冲突、实际kill与两次冷恢复、SQLite/file SHA及独立Python格式回读通过；本轮未新验WPS/Microsoft Office应用排版。文件面板无provider新请求；未借此外推NET/OCR/视觉或全harness完成。日常out323文件SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master与HEAD保持，日常profile/钥未改，无提交/push。

证据入口：apps/desktop/test-results/goal/layout-20261005/closeout.json；原始报告在apps/desktop/test-results/xiaozhi-agent上述独立目录，build5.log、renderer-build5.log、main-build5.log及四专项最终日志在owned layout目录。前面历史标题/controls/glass结果保留，以下新增记录为当前有限状态。

下一唯一：继续Phase1，冻结设置工作区、会话管理与附件/OCR弹层合同，核浅暗主题、错误/重试与可达性，再用真实native双尺寸验收。完整Shell后继续Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；日常人工D、无VPN/安装E、安全修补及Pro许可仍开放。

## Phase1 布局与暗色控件合同（2026-10-05，实施前冻结）

M01/M10教师结果：问答、长过程和菜单在实际桌面双尺寸下保持会话头、输入和停止入口可达；浅色/深色控件使用同一语义主题。仍是Phase1有限切片，完整Shell与Goal未完成。按照测试样例说明书的CTRL/CFG真实操作链路复用既有脚本，C隔离Electron不能代替D日常人工或E无VPN安装。

当前证据：旧control截图Va2mxP/question-1366x768.png顶部确实裁切；本轮未改源码的0l0sP9真实DeepSeek问答probe未再次裁切，但测得外层provider在两尺寸均有44px隐藏滚动范围。AppLayout侧栏基类使用100dvh，桌面内容扣36px顶栏与8px间距；先测直接子项再修尺寸。问答卡、计划条、菜单portal有固定浅色，既有glass覆盖不完整。不能把一次正常截图称偶发裁切已经解决。

复用比较：采用现有HeroUI AppLayout content模式、Sidebar/ChatConversation/Dropdown/控制卡及局部glass语义token；官方MCP文档明确main独占内容滚动。替换为page模式/另造sticky布局会改变滚动权属；搬其他智能体壳或runtime不能解决尺寸与主题，均不采用。finesse现有MIT产品/AI控制台指导作为审阅依据；不复制新的Pro源码。依赖、许可和Windows打包不变。

范围：局部office主题CSS、现有控制/菜单UI验收脚本；按需调整局部组件class接线。无新表、IPC、schema、迁移、凭证、上传、预算或runtime，原自动压缩保持。旧日常out/profile不变；新构建只写owned测试目录。回滚恢复局部CSS/测试即可，不触碰业务/native数据。

完成定义：保留旧裁切截图及当前尺寸基线；真实native1366×768/1920×1080检查外层无隐藏滚动范围、会话头/输入/操作可达，展开/折叠与键盘聚焦不移动壳；浅暗问答、计划和portal菜单配色/对比及截图实际检查。沿用真实DeepSeek控制链路、菜单操作、现有renderer/main门禁，记录命令/计数/失败边界。只关闭证据支持的有限切片；剩余Phase1及Phase2唯一runtime、五空间、教育适配/飞轮、黄金A–G、D/E继续保持。

## 2026-10-05 自动标题兼容切片验收结果

自动标题本地fallback兼容切片有限通过；Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。普通append与附件原子publish共用conversationTitle，合法/skill前缀不挤占任务标题，保原提示词/Pi原生记录；不是新增LLM语义摘要命名。

native实际旧表迁移两次/中文英文emoji40码点/严格ASCII空格命令边界/原prompt/并发rename/真实旧trigger替换故障rollback/原原子失败/dup/CAS及claimed/committed实际kill两次重启通过。settings空环境Key/model、实际页面保存safeStorage配置后DeepSeek Flash真实200，运行中AbortError取消；自动任务标题、改回默认名后继续任务/停止/归档/冷恢复保手工名。附件页面技能首轮任务标题与原消息、清空/两尺寸/预览/原文件删除/切会话/冷恢复/仅附件发送/失败重试保新输入/教师等待停止/owned claim kill通过；文件对话框仅controlled owned合成材料。

实际查看8张本轮PNG：title/history/preview各双尺寸6 + models双尺寸2；标题侧栏/会话头显示任务正文、输入与预览可达。消息正文仍保原/skill指令，不据此声称教师化投影已经完成。1366历史首拍图片缩略图尚未加载、随后真实预览和1920缩略图正常，未将静态首拍当图片识别。问答顶部裁切、完整暗色与其他Shell状态仍待下一项；本轮未做整壳像素/系统主题/不支持backdrop引擎验收。

下一唯一：Phase1专项定位问答/长过程中的Shell顶部裁切，冻结布局/滚动与完整暗色菜单合同，复用既有HeroUI/语义主题和原控制卡，以真实native双尺寸、可达性与PNG验收。完整Shell后再Phase2退役重复runtime、Phase3五空间、教育适配/飞轮/黄金A–G；日常人工D、无VPN安装E、安全修补与Pro许可仍开放。

## Phase1 自动标题兼容合同（2026-10-05，实施前冻结）

M01/M10教师结果：新对话使用实际任务文字命名，/skill前缀不挤占标题；普通发送与附件原子发送相同，手工改名、原提示词和Pi native记录保持。现状：db.ts append截40 UTF16单位；attachment_send_publish触发器截40 SQLite字符；两路径不一致且手工改回“新对话”会被后续发送覆盖。graph方法行号陈旧，已核实际文件。四根/Goal及上一轮controls closeout已核，当前Phase1仍未验收。

复用对比：A 现有本地标题fallback+Pi1.0.2严格首ASCII空格命令边界（采用共享纯函数，Unicode码点截40）；B Hana core/llm-utils.summarizeTitle（已核真实LLM依赖、首轮最多500+500字符/可取消/失败null），独立语义摘要能力保留候选，不为本次显示命令前缀多传一次用户内容；C 搬DeepTutor/OpenMAIC会话管理或新标题runtime（不兼容既有SQLite事实且多余）。UI沿现有Sidebar/会话头/重命名组件，纯标题修复不新增组件/Pro源；完整主题裁切后续独立处理。此为本地自动fallback修复，不能称实现了Codex专有语义摘要命名。

修改：新增main/xiaozhi-agent/conversation-title.ts；db facade仅接标题函数、title_source列幂等迁移/新建/改名/append当前行CAS；attachment-send-state增display_title默认空列与trigger升级，仍一条发布语句提交所有可见事实。title_source旧行默认legacy，不能推断历史标题是否手工，旧标题不重写；新建默认automatic、自定manual，重命名即manual，即使名为“新对话”仍锁定。附件旧send回执不改；get已存在command仍原receipt，不重放。trigger替换用SQLite savepoint，失败恢复旧trigger，启动迁移完成前不接用户发送；不引入第二runtime、外部上传、依赖或新公开IPC/schema。

验收：扩现有native附件send worker覆盖旧DB两次迁移/旧标题不变、两发送路径/中文英文emoji长度/严格命令边界/手工默认名/并发rename CAS/原prompt、故障rollback/replay/cold；扩已有settings真实UI路径覆盖新普通+附件技能标题、手工改名/发送清空/冷恢复，真实DeepSeek和实际双尺寸PNG。正常配置隔离新build、renderer门禁、专项native与关键主smoke；原失败保持，不覆盖日常out/profile。回滚以恢复旧代码并保增量列，先在旧副本验证旧app安全读取；不删列/不破坏旧文件。完成只记该有限切片，随后Shell顶部裁切/完整暗色及其余Phase1，再Phase2–8与日常D/无VPN安装E。

## 2026-10-05 CTRL/CFG当前构建验收结果

Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。仅复用现有Pi1.0.2/Hana队列宿主、控制卡和设置进行当前构建验收；本轮没有生产源码、依赖、表、IPC、预算、凭证或日常数据迁移。

CFG保存设置在主进程Key/model空且无旧有效凭证的新profile运行：Windows safeStorage实际密文、缓存不能代替验证，页面保存后Flash/Pro共9次真实200/零图片块；重启无重放，主动续问实读新核验码/41；无效save保原密文/version/default，文本Pro实际拒图且后续文本工具可用。settings32另实证200与运行中停止AbortError/设置返回同run；技能和归档样本有typed fixture，对话框仅选owned合成素材，不当全自然人工路径。

已实际查看20张本轮PNG：queue2/control2/settings六页双尺寸12/credential4。控制问答改用BrowserWindow真实content1366×768/1920×1080并等待inner尺寸，不以setViewportSize冒充；按钮与输入可达。但问答截图主壳顶部标题发生裁切，完整VIEW01与Shell视觉仍未验收，须专项定位；浅色设置可读不等于全部暗色组件通过。

下一唯一：冻结/skill自动标题兼容合同，核普通append与附件原子append两条路径，保手工标题、原提示词、历史/native绑定与本地真源；完成后继续Shell顶部裁切、完整暗色菜单与其余缺口。Phase2退役重复runtime、Phase3五空间、教育适配/飞轮、黄金A–G、日常D与无VPN安装E仍开放，不重复已通过的有限审计。

## Phase1 CTRL/CFG当前构建验收合同（2026-10-05，执行前冻结）

执行补充：保存凭证真实工具suite首CiczPb在冷启动实读后失败，公开回答实际给出新码/41分钟且合法比较旧码/37。旧断言禁止全文出现旧码，误把历史对比当旧答案；修测试判定为当前核验码字段、新课堂时长和本轮成功read_text回执同时含新码/41且回执不含旧码，真实HTTP200/保存密钥/原提示词/无重放断言保持。原失败保留，生产代码不改；重跑完整15项而非只重试此断言。

目标M10/M01：教师运行中补充、编辑/撤回待处理项，停止/重试与退出恢复；设置验证/保存/返回/重启保同会话与真实调用。原测试说明书CTRL01–03/CFG01–02为标准，不把注入队列间隙当真实provider，也不把C层当日常D/E。

比较A 现有Pi SDK1.0.2原生队列、Hana宿主ID/revision接缝、现成OfficeComposer/控制卡/设置（采用）；B 再迁上游完整Hana/DeepTutor/OpenMAIC运行循环（重复，未授权额外运行数据真源）；C 自建队列和设置控件（已有成熟实现，不必要）。npm官方查询当前Pi1.0.2，安装版本固定，不升级依赖；上游控制机制与保留领域矩阵沿已验架构，非新增教育adapter。复用既有UI/官方组件，无新Pro源码。

本轮先仅扩原pi-queue-ui/pi-control-ui两suite的构建/脚本SHA与页面错误记录、真实发送清空断言；使用上一轮build5固定SHA90f47528…且串行Electron。按既有原断言跑队列/控制、当前设置workspace32及保存凭证真实工具suite，必要原边界/renderer。原失败保留；若出现生产缺口，另补修复合同再改最小领域文件，不能放宽断言。无新表/IPC/migration/schema/model/key/default/预算/第二runtime，真实日常out/profile不改。控制/问答/计划/设置双尺寸截图必须查看；C和带测试延迟的crash-gap分别标注。

回滚本轮测试增量即可，业务/native记录不变。完成仅为当前构建CTRL/CFG有限验收；整个Shell还需标题/历史/错误/完整主题入口及原用户D/E。后续标题冻结独立兼容合同、Phase2唯一runtime/Phase3五空间与教育迁移/飞轮全目标保持。

## 2026-10-05 Glass主壳与文件版本接缝结果

本轮Glass主壳与来源版本接缝有限验收通过，Phase1完整Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。生产新增仅工作区glass语义CSS、原OSS Tooltip接线，以及Hana文件回执可选version回调；Pi两处host复用既有fileVersion。正文sha256与来源version分开，读取前后变化拒绝，不放宽来源CAS/权限/教师确认。不新增依赖、表、IPC或第二runtime，不设置运行预算，原自动压缩保持。

最终隔离build5含tsc exit0（323文件 / 16116826字节 / SHA 90f47528c57f9ce6cbabee340e5deae0a51e6f2bd7eaaf4059344de743b73ad9）；renderer101/101；原主smoke207/207。最终baseline-qNl91y 13、files-OUVs7O 25、browser-delivery-y3Qfqd 13、natural-file-tntQjR 14均exit0；Hana14/Pi边界8/Office协调10均过。NET01原通知读取日期区分、NET02真实DOM/页面截图/失败/冷恢复；FILE01附件实读清空、FILE02授权与拒绝、FILE03拒绝不写和确认37→41、FILE04原文审阅生成实际DOCX/SQLite SHA/独立python-docx/冷恢复。FILE04本次未触发问答，未引用无关资料（sources空并明确说明），不能把它当真实provider引用版本CAS验证；来源接缝由Hana/Pi/Office边界实际读取与服务验证。

同一已确认Word副本经真实新建owned WPS12.0打开、编辑负责人单元格、保存重开成功；原DOCX不变。独立回读12段/1表/5行；WPS导出1页A4，28内容marker齐全、无页外字形、页面PNG实际查看。保护已有WPS实例。未测试Microsoft Office/PPTX/Excel。

最终build5双1366×768/1920×1080浅色/深色长历史、真实联网截图预览、文件、Word审阅/打开PNG已实际查看；forced-colors已看。light正文/用户/标题/次级对比度11.65/10.58/11.65/5.39，dark13.07/11.27/13.07/7.80；键盘Tooltip/focus、reduced-motion和forced-colors真实断言通过。系统主题由浏览器media模拟，不冒称Windows设置；不支持backdrop回退只有CSS声明，未在不支持引擎实测。dark小标题Folder图标对比及完整Office/菜单暗色仍待专项。

Next：下一从Phase1原CTRL/CFG的当前构建验收继续：真实运行中编辑/撤回、停止、补充/重试、设置保存返回同会话；按实际缺口冻结合同修复。随后独立兼容合同处理/skill自动标题两条路径，完成完整Shell，再Phase2退役旧runtime、Phase3五空间。原用户失败/D日常、E无VPN与安装、A–G、安全补丁/私有日志/userData ACL/备份恢复、Pro许可仍OPEN；三元暂停保持。已有壳/包审计不再重复。

下方实施前合同与旧首切片描述为保留历史；最新实现/验收以上文和Goal状态为准。

## Phase1 玻璃主壳切片合同（2026-10-05，实施前冻结）

目标M10/M01呈现层：问小智保留当前真实Pi会话/工具/审批/文件/设置接线，采用Master的Liquid Glass × Codex Productivity × Education Warmth。本文本切片不等于完整Phase1或最终五空间交付。

- 复用比较：A 现有AppLayout/Sidebar/PromptInput/ChatTool/FileTree/Resizable配公开官方glass语义token（采用）；B 另导入Pro聊天模板（没有必要，增加授权和接线风险）；C 独立重建聊天或画布壳（重复现成布局/可访问交互且不适合当前教师委派任务）。正文居中，历史和任务/文件各自滚动，输入固定在主列底部。
- 已查官方HeroUI MCP AppLayout/Sidebar/PromptInput/ChatTool/Tooltip接口及glass主题；设计依据现有两张Codex工作台参考图、项目内MIT finesse ai-console/product-ui。finesse是精简副本，product-palettes等引用文件缺失；本轮颜色采用Master已固定方向和官方glass token，不下载未知样例补齐。功能工作台不设装饰图资产。
- 修改文件：新增office/pi-workspace-glass.css（仅小智工作区，光暗语义token、壳/输入/上下文/文件层次、焦点/reduced-motion/forced-colors/无backdrop回退）；PiEducationWorkspace.tsx仅追加CSS；PiWorkspaceShell.tsx/OfficeComposer.tsx/PiWorkspaceContext.tsx复用OSS Tooltip为图标入口提供键盘提示。保留原DOM行动和稳定testid。
- 层次：导航和面板chrome半透明、20px blur与细边缘；正文、输入、审批、文件正文实底。暖灰墨色/蓝绿色中性底、克制蓝色主行动；待确认和失败有文字与形状，不能只靠颜色；不加发光、粒子、玻璃嵌套卡片。状态继续由workspaceStatus和host projection决定，不能为了视觉改变真实运行事实。
- 无新增依赖/表/IPC/schema/provider/凭证/预算/上下文算法；不写日常out或真实profile，不迁移native记录/教师数据。保持旧入口。回滚为新增CSS/import与Tooltip包装撤回，权限和数据真源不受影响。Tooltip使用现有@heroui/react，既有Pro分发授权仍独立开放。
- 门禁：tsc+隔离build；原renderer101；原acceptance baseline补键盘提示、语义对比度、系统dark/reduced-motion、forced-colors与无blur回退的真实浏览器断言；原文件UI检查真文件/布局/冷启动；必要真实provider样例沿测试说明书CFG/FILE/NET分步跑。双1366×768/1920×1080真实截图必须查看，首失败保留。离线/文件例不替代provider/CTRL/审批/原用户失败D或无VPN安装E。
- 本切片完成仅可记“Glass壳有限实现与验收”。完整Shell仍需真实Pi任务公开过程、原NET/FILE/CTRL/CFG、审批拒绝与产物、旧历史搜索归档/设置返回/恢复、标题兼容等。五空间属于Phase3，安全/许可/最终A–G与D/E仍保持OPEN。

执行中补充：实际FILE-04模型通过ask_teacher询问学科/场景，原测试只等Office审批而超时。保留DlOTRk原失败；仅补原实例脚本的可选问答分支：原FILE-04提示词保持，合成教师从真实问答框指定“通用型教研活动、不限定学科、目标任务由小智拟定、负责人留空”，断言durable answered再等原审批。第二次澄清明确失败，不自动批准文件或替代工具/客观答案。不改生产行为，不能把这一分支冒称原用户人工验收。

### FILE来源版本修复合同（同轮实际失败0auxVr后冻结）

office_read_text旧回执只有正文sha256；office_create_document.sources.version却要求现有fileVersion（dev/ino/size/mtime/ctime的版本摘要）。真实模型将sha256当version并触发conflict，未进入审批/没有文件，原失败保留。最小修复范围：office-agent/hana-tool-adapter.ts新增可选宿主fileVersion回调，Pi在现有createHanaOfficeTools入口传入workspace-files原函数；文本读取实读前后版本一致才返回version，stat文件也返回同一版本。正文sha256继续独立命名；不将SHA解释成version、不取消来源CAS、教师确认或权限校验。

无依赖/表/IPC/migration，既有结果schema兼容增量字段；旧native回执不改造。旧adapter未传回调时保持旧字段；Pi两处host创建必须一致接入。原Pi boundary/Office adapter和coordinator门禁扩展真实读取版本→实际Office来源校验、读后变化拒绝；隔离build、原NET/FILE原文和主smoke重新验证最终构建。回滚为可选回调/字段接线撤回；原来源CAS继续保留，旧回执缺version不可猜写。这是M10/M01能力接缝修复，不宣称完整办公或Phase1交付。

更新2026-10-05；最高合同 [Master](../goal/XIAOZHI_CODEX_GOAL.md)。状态见 [CURRENT_STATE](../goal/CURRENT_STATE.md)。

面向普通独立教师与小型教辅团队的本地教育办公工作台。启动默认问小智，五个用户空间：**问小智 / 我的资料 / 教学内容 / 学生 / 设置**。保留教师熟悉的资料、学生、教学内容可视化管理，不做学校平台/完整LMS。

核心仍为资料→题库/知识库→教师确认组卷→实际产物，错题→校正→原因/知识点→针对练习；扩展真实教学PPTX、交互课堂、个性化计划与有证据的后台偏好学习。

过程公开简明计划、工作摘要、工具状态、审批、文件和产物。技术概念默认隐藏，不展示私有思维链。视觉采用 Liquid Glass × Codex Productivity × Education Warmth；玻璃用于有层次的壳，正文/输入/审批要高可读，支持键盘和减弱动态。

当前阶段为Phase1主工作台；Phase0有限审计已退出，五空间、新玻璃设计、DeepTutor/OpenMAIC适配和飞轮尚未完整实现或验收，不以规划冒称产品完成。

## 工作台组件映射与视觉基线

本轮实际查看隔离Electron的200条合成历史，两种content尺寸输入控件可达、无横向越界；这是现状截图，不是新版设计完成。PiWorkspaceShell/AiConversationSidebar/OfficeComposer/OfficeConversation仍为真实接线基础，官方MCP AppLayout/Sidebar/PromptInput/ChatTool文档已核。

| 教师可见面 | 现有代码/成熟组件 | 下一切片要求 |
| --- | --- | --- |
| 主壳/资料面板 | PiWorkspaceShell→现有AppLayout/Sidebar/Resizable；workspace preferences只管布局 | 五空间导航与玻璃层级，保真实Pi及传统管理入口、布局恢复 |
| 历史/检索/归档 | AiConversationSidebar→ChatListView/Sidebar，原会话typed API | 标题不显示/skill指令、教师改名保持；搜索/归档失败与取消可见 |
| 输入/发送/停止/排队 | OfficeComposer→PromptInput/OSS Button/Dropdown，原ComposerState与typed run | 发送清空、IME/附件/运行中指令编辑撤回保持；停止常驻，键盘可达 |
| 正文与来源 | OfficeConversation→ChatConversation/ChatMessage/StreamMarkdown | 正文高可读；读取与搜索来源分开，引用可开，不把失败当来源 |
| 工作过程/计划 | 原ChatTool/Group/ChainOfThought公开projection | idle/working/waiting/approval/compressing/stopped/failed/completed/recovering按实际状态；不展示私有CoT |
| 审批/问答 | 原ChatTool approval slots/OSS Modal与typed确认 | 对象、影响、来源、批准/拒绝清楚；拒绝后不自动重放 |
| 文件/产物 | PiWorkspaceFiles + 原FileTree/Tabs/本地reader/Office draft | 真文件可预览/编辑/保存；真实DOCX/PPTX/PDF回读；不以静态卡片代替 |
| 模型/设置/技能 | PiSettingsWorkspace + OSS输入/开关 + 原Hana设置adapter | 模型前台自动/快速/高质量，实际ID放高级；技术技能默认隐藏、专家入口保持 |

现状新增缺口：合成旧历史没有当前Pi run时，右栏仍写“已完成”；需要与“暂无任务”区分，不能暗示新任务成功。当前raw模型ID与顶部/左栏“技能”也是普通教师概念简化的待办。不得为了修文案改变审批/运行状态真源。

Glass只用于导航、面板与悬浮层；正文/输入/审批实底，低透明叠层不降低对比度。复用官方token/原可访问组件，支持reduced-motion、forced-colors和键盘焦点；1366窄窗右栏可收起。新设计必须实际工作任务/错误/审批/长历史双尺寸截图及操作验收，不能靠静态demo过门禁。

## Phase1真实Shell合同（2026-10-05 首切片冻结）

M10/M01与主工作台呈现层：教师进入问小智即可使用真实当前Pi，任务过程/工具/文件/产物/设置保持真实可操作。采用成熟壳和公开glass token，不新增许可不明Pro源码，不加另一runtime。Phase0退出仅代表审计闭合，依赖修补、Windows隐私隔离和完整迁移/最终验收保持开放。

**本轮实施范围：公开状态首切片。** main snapshot在无run行的旧user消息上也投影completed；不能将其当作真实执行成功。抽出office工作区纯展示策略，以snapshot.running/operation、needsHydration、实际turn状态及中断发送为依据；空会话等待提问，历史completed只称“上轮已结束”，运行/审批/输入/压缩/失败/停止分别显示。未拿到snapshot显示“正在读取会话”，失去active但turn仍running/等待时显示“正在恢复会话”，不伪报完成。

文件：新增office/workspace-status.ts，修改PiWorkspaceContext.tsx与原renderer-component-state-test.mjs、原acceptance/audit.mjs的既有baseline。无表、目录迁移、IPC、权限、模型或原native历史更改。SSR策略/组件状态门禁、tsc和隔离build；既有真实Electron baseline以typed API种入旧消息并冷启动，检验空/历史状态与双尺寸可达性、实际截图。此离线路径不能证明provider任务/黄金场景或最终Glass视觉。回滚仅上述呈现策略/组件/验收变更，后端真源保留。首切片后再按下方完整Shell范围推进。

1. 先按真实snapshot/projection核对空会话、旧历史、运行/审批/等待输入/压缩/停止/失败/完成/恢复状态；当前PiWorkspaceContext以最后projection turn存在即已完成，合成历史能形成turn，不能把“存在历史”当新执行成功。抽出公开展示策略并补现有renderer状态suite，保后端状态真源。
2. 沿PiWorkspaceShell/OfficeComposer/OfficeConversation/PiWorkspaceContext/PiWorkspaceFiles/AiConversationSidebar实现glass壳、低噪音工作区、始终可达发送/停止、来源与实际文件、历史搜索/归档、设置入口；CSS限定office工作区，不影响传统教育管理页。主Shell先接当前导航facade，完整五空间实现属于Phase3。
3. 标题在普通append及附件原子发布两路径一致去掉/skill前缀作为展示标题，原raw prompt/native/用户改名/历史不变；变更需单独数据兼容合同，不能为了UI顺手改业务或native历史。
4. 可能修改office/*组件与CSS、最小PiEducationWorkspace接线、现有renderer suite/acceptance入口；不新增表/迁移/IPC/provider/key/预算。若标题需main/共享变更，先冻结对应同一事实来源再做，不堆入App/db/index。
5. 最小验收：真实Pi普通任务/NET-01/FILE-01（说明书原文）、发送清空、CTRL编辑撤回/停止、审批拒绝后文件SHA保持、错误与手动重试、旧会话/冷启动来源产物、设置返回仍同run；按实际依赖分步运行，不一次脚本算全覆盖。组件/类型/隔离build与必要主smoke，再双尺寸人工看正文/过程/审批/文件。C不替代日常D/E。
6. 回滚为限定组件/CSS恢复及原导航/标题策略兼容；权限、批准、工具/JSONL/业务文件不变。保持原入口直到新链路验收。完成必须有真实用户路径，不用本次合成OpenMAIC组件图代替工作台视觉。

下一顺序：公开状态首切片有限验收→冻结glass主壳本轮合同→其余真实Shell工作流逐切片实现。禁止把PPT/课堂/飞轮、无VPN安装和原用户失败从总目标删掉。

## 首切片实际结果

2026-10-05：Phase0有限审计已退出；Phase1 Shell DOING，整体NOT_ACCEPTED。新增office/workspace-status.ts并接PiWorkspaceContext，旧历史不称新任务成功；恢复、审批、补充、手动/自动整理、失败/停止按公开真实状态呈现。自动整理从实际applyXiaozhiEvent投影读取，不把它等同manual operation。后端/权限/IPC/native记录/模型/key/预算/数据未改。

最后隔离正常build含tsc exit0；renderer101（原79+18状态+4实际compaction投影转换）exit0；web13/证据grader22 exit0。最终baseline-mLN2E0真实Electron10项：空/typed历史状态、200条公开合成记录/只读SQLite、冷恢复、双content尺寸输入可达/实际PNG已看；构建323文件/16105165字节/SHA f5d71e0e73bd140ae4ba9de1c6c4e0e89aba69b01420219340c2e52093c082cc。首ijFI2G为前一有限通过，保两个build/日志，不称3次稳定。离线例不证明B/provider、NET/FILE/CTRL全路径或日常D/E，也不是新Glass完整视觉验收。

security-audit-DBWIc2库存3项/exit0；fresh npm audit exit1仍0critical/3high/2moderate。只有路径/日志/owned Windows ACL与修补门禁审计通过，漏洞没有修复。证据在 apps/desktop/test-results/goal/security-0785b4e6/security-audit-DBWIc2/report.json 和 apps/desktop/test-results/acceptance/baseline-mLN2E0/report.json；完整命令见docs/acceptance/CURRENT.md。

Next：Phase1继续真实Pi主工作台：先冻结glass主壳/低噪音过程/输入栏/文件与来源的本轮组件、token、状态、回滚和验收清单；优先既有组件与公开主题token，保持实际Pi接线。按测试说明书原NET-01/FILE-01/CTRL/CFG分步跑同输入，补运行/审批/输入/自动整理在真实任务中可见的双尺寸证据，再完成其余Shell。标题属于独立兼容切片；Phase2后退役旧编排。安全修补/私有日志/实际userData ACL/备份restore、许可分发、A–G、D/E均继续开放，不重做已完成包/基线审计。

## Phase1 教师公开消息合同（2026-10-05，实施前冻结）

M01/M10：选择技能时公开消息呈现教师原输入，Pi执行文本与原生历史原样保留；输入、处理中、完成、归档、冷恢复一致。用户手写/skill命令、代码中的命令和来源不明旧消息不做猜测裁切。

候选A：复用现有StartInput、消息metadata、原子附件发布和OfficeConversation，添加可验证presentation v1，精确绑定技能名/原输入/执行prompt；选择此薄适配。B Pi原生技能XML块解析可用于SDK显示，但不是本地SQLite原输入来源证明，不重写原生记录。C全局正则删除/skill会误伤用户文本，拒绝。Hana既有来源/会话文件和组件保留；DeepTutor/OpenMAIC不负责宿主消息投影，不搬第二runtime。HeroUI官方chat-message/prompt-input文档已核，复用当前vendor组件，不新增Pro源码/依赖/安装体积，既有许可hold保持。Pi官方地址已重定向earendil-works/pi，安装版仍沿当前lock，不因局部展示升级runtime。

范围：shared StartInput/验证与公开文本helper，OfficeComposer/状态/PiEducationWorkspace，production-host，attachment-send-state；现有attachment native/UI、settings UI与renderer边界专项。普通消息metadata存presentation，附件ledger增可空presentation_json列并在同一发布语句写metadata；旧行默认空，升级幂等，trigger失败rollback。command hash只对新presentation额外绑定，旧请求hash保持；retry携带原presentation，不随新选择改变；审批/上传/权限/模型文本/自动压缩/预算均保持。

验收：隔离正式build含tsc、renderer、主207回归；native旧表/新表重复migration、trigger故障恢复、presentation损坏/错误版本/getter拒绝、raw保留/hash冲突与kill/cold；真实DeepSeek正式页面普通/附件选择技能、tool真实读取合成附件、清空/错误重试保新输入、归档/cold和浅暗双尺寸PNG逐张审阅。首次失败保留，遵循测试样例说明书A/B/C分层，不外推日常D/无VPN安装E或三次稳定。全Goal ACTIVE/Phase1 NOT_ACCEPTED，下一按Shell缺口继续。

## Phase1 联网与浏览器合同（2026-10-05，实施前冻结）

目标M10/M01：按测试说明书NET-01/02/03/04贯通真实搜索、官网正文、内置页面/截图、失败返回、联网权限和停止/冷恢复；双尺寸浅暗验证。现有Pi工具、Hana v0.450.0 DOM/ref/wait与截图文件名已复用，生产浏览器为Electron WebContentsView+受限代理。当前失败状态没有返回入口，截图Modal缺pi-themed-surface。

对比A沿已有Hana浏览器宿主/OSS Button/Modal，选用；B整搬Hana Electron IPC/reload会绕过当前公共地址与写操作确认；C新增Playwright服务/第二Agent无必要。已核完整openhanako lib/browser/browser-manager.ts、lib/tools/browser-tool.ts及desktop/main.cjs浏览器reload/goBack；Pi官方SDK customTools/lifecycle与Electron WebContentsView官方文档已核。新改仅本地状态页固定关闭动作、宿主关闭本会话窗口、预览主题以及已有native/delivery/web测试；不新增表/共享IPC/依赖，不自动重放模型、不在失败页偷偷重试网络。返回聊天明确新任务重试。

完成定义：当前固定隔离正式build，实际DeepSeek+官网搜索/正文/DOM截图/打开来源、失败返回与本地截图坏文件重试、关闭联网与重新开启、停止后冷恢复零重放，102组件/主入口门禁及git diff --check；截图需实际审阅。保存首失败。D/E、原用户失败及三连稳定单列OPEN。原子历史、自动压缩、无运行预算、国内API与隐私授权不变。回滚为恢复本轮源备份，不覆盖日常out/profile/key。

实施中合同补充（2026-10-05）：正式 build2 的真实 PNG 发现深色顶部/来源侧栏白底浅字，既有正文对比度检查没有覆盖主壳。已确认 index.html 先加载共享 glass CSS 再加载 legacy workspace CSS，新增状态页引入完整 glass 导致覆盖顺序回退。修复采用抽取现有同一语义 token 为共享文件，布局覆盖仅保留主入口；状态页沿用原 HeroUI 层序。增加顶部标题/侧栏来源时间对比度检查，保留首次失败报告与 PNG，再固定 build3 重验。本轮新增两个样式相关源边界，无新增依赖/数据变更。


## Phase1 真实工作过程合同（2026-10-05，实施前冻结）

M01/M10：当前主进程→typed preload→Pi projection→UI 已有 plan/question/approval/queue/compaction，右侧 workspaceStatus 已区分公开状态；OfficeConversation 在 running 时无 TurnNotice，收起资料栏后首次回复前无明确 working。选 A 复用 workspaceStatus + 已安装 OSS Spinner/图标及现有 theme，在输入栏上方常驻准确 activity；B 新复制 Pro ChatLoader 并不能弥补状态来源，现 vendor 无此组件且分发许可 OPEN，不新增源；C 模型私有 reasoning 或第二编排器不采用。

已核 Pi1.0.2 本地声明及官方 SDK：compaction_start/end、message/tool、agent_settled；Hana0.449已提取 installMidRunCompaction 保 previous context hook，已有能力继续使用。DeepTutor/OpenMAIC是教育 capability，不负责聊天主编排状态。HeroUI官方 ChatTool/ChainOfThought/ChatLoader API已查，沿用现有 disclosure和OSS控件。finesse本地技能入口未找到；本轮不阻断既有成熟主题。无新依赖/表/目录迁移/IPC/权限/凭证变化，不改变无预算/自动整理/云上传规则。

改动边界：PiWorkspaceActivity新增公开展示小组件，PiEducationWorkspace仅接线，glass加同域语义布局；既有renderer边界、control UI、auto compaction UI扩展。历史结束/失败/停止不残留running；真实inProgress tool才显示执行标签；approval/input不转动，compaction不显示私有摘要。旧数据只读兼容，回滚为恢复owned源备份。

完成定义：固定隔离build含tsc，组件/主入口门禁；真实DeepSeek waiting/input/plan/queue/stop/crash/自然澄清、现有queue edit/withdraw边界；真实summary+同任务续执行、停止与native commit后crash；双尺寸浅暗实际截图、状态与主快照一致、资料栏关闭仍可见、终态消失、private summary不公开。自动整理使用现有65536 E2E提前阈值并独立记录，不能称官方容量改变。所有首失败保留。D/E、原用户失败、三连稳定/完整Shell与Goal保持OPEN；完成该有限切片后核剩余Shell产物/文件接缝再Phase2。


合同执行差异（首失败后记录，2026-10-05）：copied pi-auto-ui-ik9wla 旧会话在创建快照配置校验前拒绝，保 aXLjJ8/report 和 auto1.log；旧兼容保持 FAILED/OPEN，不通过新会话关闭。既有auto runner新增 --fresh-seed，由正式UI生成真实plan/read/reject/manual-summary，不篡改native JSONL；cHWws6 在旧65536测试阈值下真实summary完成后仍被完整请求容量保护拒绝，保原报告。当前工具协议+批次不适配旧提前阈值，改本脚本E2E为131072，provider官方1,048,576/生产策略不改；动态等待实际summary计数增加，有界迭代是测试等待边界而非产品运行预算。补验既有Office实际批准/拒绝UI，增加该runner源备份；无生产权限放宽。


续执行修复合同（auto4首失败后、改生产前冻结）：lQQ7lJ 原生4次summary均包含原验收码和五年级，新请求也确实进入native，实际assistant只答“已阅读”。因此没有证据说摘要丢失；问题表现为新请求未获正确遵循。现有pi-session把本地保护索引追加在教师请求之后，改为先提供原有脱敏、非授权索引，再在明确教师本次请求分隔后放原文本；模型最后看到当前明确请求。选复用既有protectedContext，不新增事实抽取、第二memory/loop、teacher prompt重写、权限/Schema或预算。合同增加pi-session单处接缝与owned源备份，以真实多次自动summary/停止/commit后crash/新请求原验收码与年级证据验，old copied configuration failure仍OPEN。


## Phase1旧创建指纹兼容合同（2026-10-05，实施前冻结）

M01/M10：aXLjJ8配置拒绝已定位为copy审批提示规则更新直接改变创建fingerprint；diagnosis.json对原两份授权native指纹精确匹配已存p07-office-document-tools旧源码规则，私有会话当前规则已匹配。原模型/目录/工具不变，不是凭证问题。

A选择应用层薄身份Adapter：既有当前/已核旧copy文字只用于重算准确创建身份，当前有效prompt仍用最新copy规则；所有下游control/memory等身份沿创建版本验证。B直接改旧JSONL/SQLite hash会覆盖历史且绕过审核，拒绝；C放开配置校验或新Pi runtime无必要。Pi原生SessionManager管理历史/compaction，原SDK1.0.2维持；DeepTutor/OpenMAIC无需介入应用创建身份。无新依赖、表、IPC、权限变化；无新UI/Pro源，许可证保持。

改动仅creation-prompt-identity小适配器、pi-session接线、既有compaction-context边界测试。新会话只创建最新身份；恢复只接受当前或精确匹配的单个已知旧规则，模型/目录/工具/未知fields变化仍拒绝；工具授权仍由当前宿主和教师确认，旧identity不是新权限。原native字节前缀保留，不重写历史，不新增迁移表；回滚恢复本轮源码备份，未改日常out/profile/key。

完成定义：边界当前/旧/私有/未知身份与extra fields/changed model/tools/workspace拒绝；固定隔离build含tsc、renderer106和主207；原pi-auto-ui-ik9wla副本真实DeepSeek恢复、原码/年级、同run自动整理、停止/提交后crash和cold、原nativeprefix/创建指纹不变，真实浅暗双尺寸PNG，首失败保留。按测试说明书有限A/C，不关闭日常D、E、3连稳定或全Goal。之后修公开中文与教师修订后正文事实一致性。


## Phase1 公开中文与办公事实交付合同（2026-10-05实施前冻结）

M01/M10：原msC1oS真实教师改41的文件正确，模型正文仍旧37，现receipt已要求不复述但无法保证遵循。当前确认正文默认本地、不回传云；禁止为消除回答差异自动上传教师修改。当前Hana presentation独立显示记录、Pi SDK原生message_end/agent_settled、宿主publicItems已有；不需要另一个Agent/翻译loop。DeepTutor/OpenMAIC是教育Domain，不解决本地Office提交事实。UI保持当前HeroUI卡和Markdown，无新Pro/组件/依赖，finesse无新增UI设计需求。

A选既有本地主进程结果投影Adapter：本轮Office进入保存/拒绝/冲突等实际终态后，不再把随后的模型草稿总结流到公开页面；工具/计划/问题照常，最终公开消息由本轮真实Office状态生成文件回执，保原native模型文本供核验。只按本轮状态，不继承旧文件成功；失败/停止保已保存与未保存分别说明，不将文件保存等同整轮完成。当前SDK继续唯一编排。B仅加强prompt没有强事实保证，不单独采用；C教师本地修订全文再传云违反现边界，拒绝。语言采用当前有效规则默认简体中文过程/最终、保原文件/代码/引用及教师明确语言要求；不改创建identity/prompt指纹链，稳定有效后缀。

边界source5：新office-delivery-presentation、production-host接线、pi-session有效语言规则、既有coordinator/UI脚本扩展。无表/IPC/native重写；SQLite现publicItems持久化同一公开结果，旧历史不篡改，冷重启一致。回滚owned源备份，不改日常out/profile/key/网络。首失败保留。

完成定义：真实原教师修改→拒绝/新确认→实际4格式字节与独立内容→公开回执不出现未回传教师正文/旧37→cold保持；真实停止/conflict/commit后kill准确；保存后恶意模型旧正文delta边界被拒绝且普通任务不受影响；6身份边界、正常隔离build含tsc、renderer及原207。双尺寸浅暗过程与最终回执PNG实际审阅。有限A/C不闭日常D/E、三次稳定、云视觉、安全许可和完整Goal；后续完整Shell剩余验收再Phase2。


## Phase1 文件与产物面板合同（2026-10-05，实施前冻结）

M01/M09/M10：现有PiWorkspaceFiles、typed文件IPC、Hana只读解析/版本校验和HeroUI FileTree/Tabs/Resizable均已存在。旧files25只浅色宽窄；上一轮真实Office28/15PNG和四格式readback已通过，但不代表完整文件导航主题/失败已验。以当前源码和固定构建为准。

A选扩展既有文件UI专项及边界，复用现有语义主题/导航，发现缺陷再局部修复。B新建文件管理器或引入Pi文件loop无必要；C完整迁移DeepTutor/OpenMAIC工作台违反唯一Pi边界，二者是教育Domain不负责该只读面板。本地Hana0.449 Apache-2.0仍沿现有适配器；Pi1.0.2官方SDK只负责会话/工具，预览不进入模型。HeroUI官方网站/MCP本轮不可达，按规则核本地file-tree源、CSS/utils和既有vendored组件；沿当前Tabs/Resizable/Markdown而非新造组件，Pro分发许可仍OPEN。finesse未提供该已实现文件交互所需新能力。无新依赖/库/许可证/表/IPC/网络上传/编排器。

边界source4：PiWorkspaceFiles、其CSS、现有glass主题、既有pi-workspace-files-ui-smoke；仅必要修改，不扩App/db/main。保原25断言，补浅暗双尺寸宽窄、关键文字/筛选placeholder/按钮对比度、键盘文件树导航、真实损坏Office失败后可返回与重试、磁盘版本变化/删除/cold、未知或归档会话权限、远程资源零请求。已有实际4格式Office交付保持，新增面板本地C不宣称provider或WPS。日常out/profile/key不动，native不写，源/文档备份回滚只本轮差异，原失败保存。

完成需正常隔离build含tsc、renderer组件、文件边界/IPC、扩展原UI真实Electron操作、原教育207，报告绑定同build/script/PNG且实际逐张视觉审阅，git diff --check。有限A/C，不闭日常D、无VPN安装E、三次稳定或完整Shell。文件面板验完后审计Phase1剩余requirements再进入Phase2唯一runtime，保持全Goal DoD。


## Phase1 整体要求审计与既有Shell实例合同（2026-10-05，实施前冻结）

M01/M10：Master全文2584行与Phase1九项为真源，文件面板closeout本轮已校验，完整Goal仍active。先逐项映射当前生产Source→typedIPC→真实页面→当前证据；不由狭窄有限closeout推导全Shell。现有Shell原runner直接daily out且预算旧断言，与实际固定build/limitsEnforced=false不匹配。A选扩展既有Shell原UI实例并绑定同一隔离固定build、原Pi真实DeepSeek、实际文本/Markdown/表格/代码、双尺寸浅暗/设置来回/会话分类/归档/冷恢复；B新增平行mock-only showcase/C全面新造组件或Agent均不用。沿现有Pro AppLayout/ChatConversation/StreamMarkdown/Sidebar和Pi原native/session，官方SDK主会话/事件接缝已复核，无新依赖/许可证/运行时。DeepTutor/OpenMAIC为后续教育Domain，不另搬Runtime实现此Shell。

本轮源边界先仅既有pi-workspace-shell-ui-smoke.mjs；没有生产修改/Schema/IPC/权限/凭证/预算/上传规则调整。若真实验收暴露生产缺陷，先追加具体源码与回滚合同再修。旧源/13文档快照保留，测试仅自有fresh data/profile，不改daily out/profile/系统网络或发真实教师资料。GUI串行；同构建可复用已封存build3（323/SHA8f623c5…），源码无变化时不把重建当进展。新实例报告绑定build/script/PNG、保第一次失败。审计层为代码证据，真实provider/UI为C；D/E/3stability/Pro许可/全Goal保持开放。

完成定义：Phase1每条能力具权威source和适当层级证据，旧script被当前实际路线替换保实质断言；当前实例实际运行终态并审所有最终PNG、相关renderer106/语法/git diff gates。学生保存提示首失败属于原入口回归欠项，不能因main2成功直接闭合；本轮不扩旧App/db业务大重写。Phase1仍未接受时，下一唯一最早真实欠项；只有Phase1 requirements全部证明才转Phase2。


### Phase1真实代码块失败修复追加合同（2026-10-05，生产修改前冻结）

首次真实Shell pi-shell-ui-2LZ7WT/report.json失败于assistant pre code，failure.png已实际审阅；合成公开回复含正确json fenced block而UI成inline。安装Streamdown2.5.0原pre用cloneElement注入data-block；现有Pro pre Fragment覆写丢标记，触发virtual inlineCode。A选app-owned OfficeMarkdown薄Adapter仅恢复原pre标记，复用原Pro CodeBlock/Header/Copy/Shiki、其余StreamMarkdown，B改vendor/C降级依赖或自造Markdown不采用。源码限定OfficeConversation、新增OfficeMarkdown、已有renderer-component-state-test及已有Shell runner。无新依赖/Schema/IPC/provider/凭证/权限/预算/网络变化；Streamdown Apache2原依赖保留，Pro vendor不改。

完成定义：inline与有语言/无语言fence、部分流及HTML escaping组件边界；原Shell真实模型同断言pre code/表格/双主题双尺寸/设置来回/冷恢复及PNG，原主路径回归同新固定build。仅owned isolated build/data/profile；daily out不动。首次失败保留。回滚只按本轮source-before范围复原或移除新adapter，禁止覆盖其他脏工作。原样例说明书全文已读，A–E/原文/首次失败/人工签认不变；本次synthetic Shell只补VIEW/普通回复旁证，不能顶替NET/IMG/FILE正向或D/E。


### Phase1代码卡真实暗色图审追加（2026-10-05，样式修改前冻结）

Shell s5JOqA功能15成功，实际dark1366截图显示json标签/标点及token低对比；不是最终视觉通过。Pro原CSS以.dark selector选Shiki双主题，工作台基于prefers-color-scheme，未切换根.dark，原组件仍light。A选新增app-owned office-markdown.css，仅OfficeMarkdown class范围内连接现有office/pi语义色与Shiki原--shiki-light/dark变量，media与工作台同源；B改全局theme/C改vendor不用。Shiki官方dual-themes文档已核，保原dual codeToHtml/API/依赖不改。源范围追加新CSS，其余沿已有adapter，扩既有Shell header/所有token对比与真实代码JSON实读，原失败/15pass但视觉不合格证据保留。仍无权限/model/文件事实/预算/网络调整，回滚仅本轮范围。用户纠偏已确认：唯一主线Master Goal；跳过测试样例书专项，不创建该专项工作。
