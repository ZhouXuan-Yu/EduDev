# 当前集成与复用

## 2026-11-01 整份试卷质量漏斗与共性修复

新普通原页冻结page-restoration.v3：覆盖字段只取题干连续原文，不混入选项摘要或解题公式；原第二遍携带有界本地字段检查代码，不新增调用循环。只有v3的临时parser输入可剔除与实际PDF页/总页匹配的末尾独立页码，原pageText/不可变回执保持。新输入冻结并复验总页数；旧v2/无元信息/答案册保持原语义，无新表、依赖、IPC或运行时。

仍复用原MaterialAiRepository/provider、原writer/页回执、typed preload与资料AI/题本界面。没有新PDF/OCR/RAG或Agent轮子。

## 2026-11-01 整套导入后的答案册关联

整套资料验收继续作为主线。已修复“先导入/OCR后关联答案册”被规则候选阻止的问题：原writer/CAS保留全部题目及教师记录，只在当前有效答案角色下默认隐藏未经处理的规则候选；原始候选开关可查看，解除关联恢复。教师编辑/确认/收藏/分类/使用过的记录不隐藏，来源过期或未知格式保持可见，付费AI角色冻结不变。抽题读窗口中途变更角色时留在pending重读，不误报来源变化。 复用原表、SQLite writer、typed preload、题本与关联面板，无新服务/依赖或模型调用。


## 2026-11-01 K0文件式访问实施

沿原PDF文件Worker新增唯一renderPdfFilePage adapter，替换资料/AI原图回调并接通原题候选与小智页工具；原题verify复用既有流式hash。无依赖/许可证/组件版本变化，保留旧byte小文件测试入口，失败不自动切回整书字节。 [整体架构](../architecture/KNOWLEDGE_BASE.md)。


2026-11-01 E08：HTML目录复用原text-change/Pi算法、原资源列表/HTML预览与版本组件；0依赖/新IPC/付费。源码6、HTML8、Office16、组件240、正式目录8及build/type通过；原生OS只核回调派发，不声称浏览器接受。证据docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#htmlCatalogSlice。

2026-11-01 E08：HTML历史复用Pi编辑/原text ledger、Office版本DTO/typed IPC和原ScienceDemoFrame；零新组件库/CSS/依赖。Office16与原冲突6专项通过。

## 2026-11-01 知识库整体架构优先

知识库复用选择冻结于[整体架构第7节](../architecture/KNOWLEDGE_BASE.md#7-成熟方案复用决策)：保留现有LanceDB、RapidOCR/PDFium、Hana/Word、FTS5/BGE、DeepSeek与Pi；AnythingLLM/WeKnora为真实对照，Docling为待同样本证明收益的parser候选。当前不嵌完整第三方RAG产品、不新增服务或依赖。先统一已有文件host消费者。


2026-11-01 收尾：main d80b9b5知识库实现完整整合；原记忆接口未改，草稿精确匹配读回再清除。无新依赖/DDL/Runtime，0付费。

2026-11-01 C03：记忆页复用原get/update接口和版本锁，去除两处server→draft灌入；不新增依赖、Runtime或审查层。

2026-11-01 E07：继续复用Pi原编辑/差异、withFileMutationQueue、现有text ledger和HeroUI Tabs/CodeBlock/Button；只补原review快照与冲突提示，无新依赖/下载/组件库/CSS。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#conflictReviewSlice。

## 2026-11-01 答案条目局部疑点与真实回写

沿原DeepSeek统一API、原执行器/typed preload和SQLite writer复用，新增单元政策 answer-entry-uncertainty.v2 与六字段答案响应；旧单元不改提示、不重写响应。未知政策/新旧混用在付费前或回执读回拦截，无新表、依赖、IPC、运行时与外传范围。回退先暂停新批次，并以 OMNI_EDU_BOOK_ANSWER_WRITEBACK=0 停新回写；保留新schema严格读适配、原件、两遍原响应和v6 journal。恢复字段须走未被教师修改快照的CAS，不让未知旧provider执行新单元；无DDL回退，完整回滚未演练。 证据：docs/research/KB_ANSWER_ENTRY_SCOPE_20261101.json。

2026-11-01 E07：复用第一方office-network.waitOfficeAbort到原managed-tools/version-service，继续固定quickjs-wasi3.6.2 pin/哈希/健康检查与共享消费者；本轮无依赖或版本更新。实际受管child及批准流程不重写。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#stopStagesSlice。


2026-11-01 E07：继续复用Hana真实文件IO及SessionExecutionRegistry，原OpenMAIC等待边界和Pi工具dispatcher。错误用现shared枚举贯通主进程及原工具证据；没有下载或替换依赖，原写/缓存/外部操作最大1次。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#ordinaryToolSlice。

2026-11-01 E07：复用createEffectReadback、conversationOutputLocation、原Office/Text账本及native receipts；DB仅向原session state传惰性dataRoot。新guarded records-refresh/typed preload接现有刷新按钮，旧事件兼容，无依赖/迁移。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#recordRecoverySlice。

## 2026-10-31 原页题面与提示版本

新原页单元冻结page-restoration.v2及真实OCR状态；旧first_saved沿原提示。完整stem必须含选项、小问、表格和公式，projection不能代替规范题面；parser只临时识别已声明原文编号，不改原回执。真实缺图/跨页/不清晰继续待核。ai_final仅表示当前AI原页证据资格，不是教师确认或数学正确性保证。回退保留新单元严格读适配，不让未知旧provider静默恢复。详见docs/research/KB_PAGE_PROMPT_20261031.json。

2026-10-31 E07：复用withModelRequestRecovery、XiaozhiStartInput、原preload start/snapshot、task coordinator/state、composer与设置入口；无新通道、表或依赖。原参数无continueTask时命令hash及goal路径不变。证据：docs/research/AGENT_RECOVERY_E07_20261031.json；日常进度 docs/goal/WORK_PROGRESS.md。


2026-10-31 E08当前版本：Office族投影沿原listDocumentArtifacts、delivery summary及officeVersion typed IPC使用，无新通道；任务idle复核要求当前Office，历史来源维持原策略。普通Office支持当前预览/系统打开/定位，confirmed领域保留原流程；未改D盘日常/安装包。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#currentVersionSlice；日常进度WORK_PROGRESS.md。

## 2026-10-31 封面跳过补强

封面跳过必须校验完整成功页回执、全部识别文字通道及明确无题线索；在原writer内复查版本、发表状态、游标和暂停，不能覆盖既有付费任务。当前页任务键采用原主键查询，不逐页扫描整批付费元数据。skippedCover从既有本地完成单元派生，原PDF/OCR保留，无新真源或云端权限。正式结果和边界见 docs/research/KB_COVER_SKIP_20261031.json；完整Goal仍active。

## 2026-10-31 答案册受控回写与封面跳过

新增目录定位微基准：5000页/10万条合成元数据、内存SQLite预热；去掉每次查整本批次元数据的旧fence，换为持久dirty/sentinel及writer复查，median3.3461→0.0219ms，P953.9623→0.0428ms。仅目录查找，不含原图复验、文件IO、AI、完整检索或自然40GB；不据此宣称产品提速验收。

MaterialBookAnswerRepository沿原MaterialAiRepository.drain空闲周期推进本地目录/匹配，复用主库事务与发送之外的历史原件校验。派生表material_book_answer_index_v1、material_book_answer_dirty_v1、material_book_answer_control_v1、material_book_answer_work_v1及不可变业务material_book_answer_journal_v1均在同一SQLite，无新服务/依赖/密钥。原页发表、答案更新、关联恢复触发work；一次一页/最多20道题/每页64KiB、200答案条目。当前页发表顺序以sentinel抑制旧页回退；单元/页回执变更置dirty，writer内再查pending与候选目录，并核对原图、两遍原响应、关联修订和题目版本。检索重建同时重建派生答案目录，保留业务journal。

v6保留v5的AI/pageSource/sources并增加book.roles；教师改角色解除相应来源，改题干不能静默沿用旧答案。Pi/题本读取重新校验journal和原页；解除关联不抹去既有已应用来源，新写入仍要求当前修订。typed materials:book-matches/book-match贯通原页面板，记录轮询只查受限行/版本，不反复读取整本原件。历史记录显示已写入不等于当前数学/教师验收。原AI/联网补答路径保留，书答案仅可用来源字段有book_extracted归属。

封面策略本地只接受明确书目信息且无实际习题线索、OCR成功；不按页码位置推断。无题封面跳过文件夹付费子任务，普通/不清/混合页仍进入原处理链。证据docs/research/KB_BOOK_MATCH_20261031.json；完整Goal未完成。

## 2026-10-31 协作者 E08 版本恢复记录

2026-10-31 E08：新增xiaozhi:office-version（schema xiaozhi.office-versions.v1），shared DTO→主进程原Office版本投影/保存服务→typed preload→PiOfficeVersions双入口。系统打开/定位只对本次哈希一致的选定原文件派发；恢复不调用provider，无DDL/worker/native identity变更。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json；日常进度以docs/goal/WORK_PROGRESS.md为准。

最终再次整合main32e7071为c99f6bb，14处Markdown冲突保留双方，终态及对话UI源码与b35b5fc一致；最终build/type和240组件exit0。原Pi精简回复3项归b35b5fc，本次未重跑。最终构建另含答案分组功能，指纹/范围见AGENT_DELIVERY_CHECKS_E06_20261031.json#terminalSlice.lastIntegration；Goal active，完整AT仍待阶段集中，D盘日常/安装包未更新。

收尾实测：正常整合main0723242为b35b5fc，4处根Markdown冲突完整保留双方记录，终态源码与ec55ac2一致。最终合并build/type、240组件及同文件精简回复/双视口/冷启3项均exit0，0renderer；原混合UI9项归技术信息精简前构建；一轮综合207/207归整合前界面（legacy Pi0，观测到的主进程入口哈希与最终入口相同），没有重复全套。主进程3247835→3257529B（+9694B），本切片无renderer改动；合并renderer变大来自上游工作台。无配对时延/P95，不宣称性能不退化。Goal active，完整252AT新增已实现0，E06仍部分实现；D盘日常/安装包未更新，audit45保留。下一E07/E08+C功能对齐，E06语义/FX09矩阵与W3集中AT继续保留。回退ec55ac2保留成果/记录，无迁移，未演练。

## 2026-10-31 E06逐文件混合终态（第九切片）

检查服务observe钩子标记真实检查已发生；forRun按当前会话/run读原表并刷新版本，重复候选证据去重。原Office呈现扩至change/delivery_bundle/实际检查，复用既有assistant_end规则，不改变模型native transcript或文件权限。

证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#terminalSlice；唯一日常进度docs/goal/WORK_PROGRESS.md。

## 2026-10-31 已知答案逐条证据（第二切片）

复用现DeepSeek原图两遍请求和保存回执，真实调用2次/同一必要页，派生查看/恢复/重启0重放。既有OCR、资料/Pi入口及AI/联网补答链保持；新增可选BookAnswerPage而非独立数据库或服务。已用答案.pdf第3页真实DeepSeek两次HTTP200，保存两遍原图/转录；该页22条、两套试卷、同号1分别D/B。现资料详情→AI深度整理→查看原页与AI还原正文，可按完整试卷标题和题号查看答案/解析/两遍原文及待核原因。两遍22条一致仍保留整页uncertain_ocr，页尾续题不补写；本片未实现题册逐题匹配/答案回写，不以预览冒充全链落地。

要求关联整合收尾：正常合并origin/main ad06954为4cc627b，12处Markdown冲突保留双方完整记录，本切片生产/脚本与0018ab3一致，无生产冲突。合并后build/type、240/240组件exit0；207综合和正式Pi旅程归整合前0018ab3，未重复全套。最终构建另含上游题册关联/非习题页处理，指纹及边界见AGENT_DELIVERY_CHECKS_E06_20261031.json#requirementsSlice.finalIntegration；D盘日常/安装包仍未更新。

## 2026-10-31 E06教师要求与检查依据（第八切片）

inspect_delivery_files现支持file.rules.bindings引用真实taskId、criterion/version及已声明规则ID；工具回执带原要求预览/来源和实际证据，语义固定未检查。现Pi/preflight/缓存/修复预算复用；policy摘要含检查器版本与要求digest。无新服务或依赖。

证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#requirementsSlice；日常进度docs/goal/WORK_PROGRESS.md。

## 2026-10-31 五三题册与独立答案册第一切片

已按用户指定在隔离数据根导入主书.pdf（62页、198230194B）和答案.pdf（31页、123742446B）。现可从资料详情关联两份PDF，保存原件版本和修订号；答案册仅原页转录、不抽新题，关联不授权上传。独立排队复用同一受限OCR Worker，不能称为同时推理。封面无抽题，明确标记的广告页在规则抽题阶段跳过，AI提示排除非习题页与宣传缩略例题；保留原PDF/OCR回执，不按首尾页位置丢弃真实题目。

复用现本地PDF/OCR、MaterialAi受控执行器及SQLite事实层，API仍统一DeepSeek。新增2个typed IPC方法/关联UI；联网上网补答未变，不建立第二套RAG或模型服务。**逐题答案匹配和回写尚未实现**：答案第3页含多个试卷，题号各自重启，必须按章节/试卷/题号及原页证据对齐；不得仅按题号覆盖。原AI/联网补答链未改，答案书云端自然准确率未验收，本轮真实provider调用0。没有泛化的持久非习题页分类器。完整Goal保持active、集中252AT新增0，D盘日常与安装包未更新。

## 2026-10-31 E06文字遮挡与系统字形（第七切片）

沿本机PowerPoint/WPS只读Automation及Windows WPF成熟整形接入，无下载/新依赖。相同真实课件字节两引擎定位具体问题，原PNG查看/冷启保持；新render.ps1固定代码不接受模型源码，原有界已知文件清理及Job保持。完整动画/嵌入字体/原生编辑矩阵不在本轮达标范围。docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#layoutSlice。

WPS整合收尾：正常合并main e06cc05为bc9777e，15处Markdown冲突保留双方完整阶段文字，无生产冲突；WPS检查源码与610f3eb一致。合并后build/type及240组件通过，207综合与WPS实际路径归整合前610f3eb，未重复全量。renderer7179937B/SHA未变；主线检索改进保留。完整Goal仍active、AT新增已实现0；本轮WPS未更新D盘日常/安装包。最终指纹与边界见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice.finalIntegration。

## 2026-10-31 E06 WPS真实页面（第六切片）

复用本机已安装WPS COM KWPS/KWPP与既有pi-office-wps-acceptance归属经验，生产薄适配共享Office Job/清理/PNG路径；旧默认Microsoft三页回归通过。无安装/依赖/凭证变化。E06仍部分实现，完整AT新增已实现0/252，Goal保持active。逐字缺字/语义遮挡、完整FX09、全教师要求绑定/混合终态仍待补；WPS图片导出不代表原生编辑保存或动态放映验收。日常D盘和安装包未更新；audit45（8高29中8低/0严重，exit1），既有两个UI门禁未修。 见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice。

## 2026-10-31 百条候选与共享重排预算

生产3e7d1c2将20条单次协议与整次候选分离：最多100条分批全局比较，5秒共享重排预算贯穿宿主启动/IPC/排队/原生执行，失败原子回到完整原排序；第21条之后可晋级，100以后的尾部保留。模型/原生v1/业务事实不变，无新依赖/迁移/付费/上传。

整合协作者f818237导航与Word修复为4fadfb0，检索5个生产文件一致；无依赖或Runtime资源变更。最终证据分别绑定整合前207项与整合后的真实源页/导航复核，详见KB_RERANK_CANDIDATES_20261031.json。

本轮收尾：最终整合feef9d4保留main f4dce3f的资料库与侧栏改动，Word检查生产源码与44eb69a一致；整合后build/type、240/240组件通过。207综合归整合前a94ab29，Word停止/占用专项归44eb69a，未重复运行。既有PromptInput指纹/启动IPC两项失败门禁与audit45保留，完整AT新增0，日常D盘与安装包未更新；详细指纹、范围见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice.finalIntegration。

## 2026-10-31 E06 Word真实页面与停止清理（第五切片）

此前Word导出阻塞已定位并修复：输出路径显式[string]，Close/Quit使用[ref] SaveChanges；Word16实际三页A4含长标题/表格/OfficeMath现可沿原Pi检查→原文件面板两视口→冷启取回真实PNG。仅去掉字符串转换的同文件对照20秒无PDF。取消还发现Word锁晚于助手退出释放，新增最多2秒异步重试自有临时文件；最终停止/占用专项通过，原文件不变且不接管已有实例。

WPS、逐字缺字/语义遮挡、完整FX09与全教师要求绑定/混合终态仍未齐；E06及完整Goal保持active，完整252AT新增已实现0。随后E07/E08+C及W3集中验收。D盘日常与安装包未更新。回退上述调用/清理提交保留原文件、报告及PNG读器，无业务迁移，完整回退未演练。 精确命令/源码/失败和指纹见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice；日常进度仍以docs/goal/WORK_PROGRESS.md为准。

## 2026-10-31 40GiB最终主线整合

正常整合origin/main ef55c53为03f4654，14处Markdown冲突保留双方完整证据，4个知识导入生产文件与a3667ce一致。整合后build（含typecheck）、240组件、协作者11项源码/4项真实Windows PDF、空间恢复UI3项、40GiB旧库再开3项均exit0；207/207属于整合前a3667ce，未重复运行，不冒充最终合并验收。再开首次尺寸断言超时保留，测试改为页面所属窗口并记录native/CSS/DPR，后续两尺寸通过，未宣称产品窗口缺陷修复。合并后混合首查3963ms、重启后4543ms，40候选仅重排20，速度/召回质量仍未达标。知识库切片无新依赖；上游明确直锁已安装unpdf1.8.1，故最终锁文件发生上游变更。audit仍45（8高29中8低/0严重，exit1）；0新增付费/上传。完整Goal保持active、完整AT新增0、D盘日常树与安装包未更新。下一步处理混合冷启和候选覆盖，再复现Pi/原题旧页数/字节限制。完整历史、失败及最终构建指纹见docs/research/KB_BYTE_CAPACITY_20261031.json#finalIntegration。

## 2026-10-31 大库容量与磁盘故障

直接验证现Node流式复制/SHA、sqlite3、PDFium/RapidOCR文件Worker、SQLite FTS及Lance/ONNX消费路径，没有替换成熟解析/检索层。既有AttachmentImportItem仅新增可选白名单I/O原因；SQLITE_FULL归一为空间不足，不修改供应商/模型、依赖锁文件或安装组件。实际字节容量长跑与自然OCR/AI质量必须分别记录。

## 2026-10-31 E06真实PDF页面与Word缺口（第四切片）

原Pi交付前及原文件面板现可检查PDF原字节的真实物理页数/逐页文本，并由Windows.Data.Pdf逐页栅格化，沿原PNG缓存、页选择、放大、历史和冷启读取。扫描页没有文本层时内容/数值/事实明确未检查；PNG尺寸读取实际IHDR，兼容本机150%显示缩放。Word只读副本→原生PDF薄适配已接入，但本机原生导出仍超时（不加入Job的30秒诊断亦未完成），生产Word等待限制15秒并明确未检查；不能称Word页面已实现。

实现1d86357，已正常整合主线3192261为7bb8671，无冲突。原生PDF4项、检查源码11项、240组件及构建通过；原正式输入→检查→一次整包确认→精确SHA保存→文件面板实际第2页/两视口→重检→冷启与扫描页/错页6项通过，同批成果续测停止2项exit0（2137ms含完整停止观察），最终Word超时/进程清理反馈2项exit0（0页，非正向通过）；首套UI因旧停止按钮断言exit1仍保留，不冒充整套全绿。最终源码9ebc430，合并build/type、240组件、11项源码通过，删除Word全局Options写入后的最终Vite构建及上述续测通过。完整AT仍未执行，新增已实现0/252，完整Goal保持active。证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#pagedDocumentSlice。

已安装的Hana间接依赖unpdf1.8.1明确直锁（MIT，JS文件合计2141399B），不安装可选canvas；无新Runtime、业务表或IPC。PDF60秒/Word15秒、16MiB/64页、PNG3MiB/合计96MiB，沿原8槽和取消；仅处理派生副本，原文件SHA保持。主renderer7175.29→7175.68kB的0.39kB变化来自主线资料面板，本片无renderer修改；合成3页本机原生渲染1541ms、扫描页827ms，仅单次样本，未测流式/P95。0新增付费；audit45（8高29中8低/0严重，exit1），未自动升级。

继续位置：E06 Word原生导出原因与实际成功路径、WPS、逐字缺字/语义遮挡、全教师要求绑定与混合终态；随后E07/E08+C及W3集中验收，保持28组252项原范围。D:/WorkProject/EduProject日常程序和安装包未更新。回退本片原生适配/检查接入可保留既有正式文件、检查读器与可选PNG索引；不删除业务表或成果，整提交回退未独立演练。

## 2026-10-31 混合图题正文召回与质量复核

原typed getMaterialAiPage/getMaterialSource保持，AiPageView只加可选transcriptionStatus；office_read_material附题目待核状态及说明，来源引用仍按原版本/批次/摘要验证。新派生控制策略逐批恢复旧页，不发模型、不改模型schema或教师事实；共享文字签名不删除数字/字母间边界。无新外部集成或依赖，原DeepSeek/本地OCR及Windows组件复用。

## 2026-10-31 E06实际页面最终整合

实现4661a2d，整合图片主线4ff4fea为ba225b7，逐页临时图总量限制修正25149d1。14处新增Markdown冲突保留双方完整内容，生产代码无冲突。最终build/type、11项检查源码、修正后固定生产脚本全8页实际PowerPoint渲染通过（0发现）；原正式UI7+同成果冷启/取消/占用3项及240组件属于整合前，未冒充全部最终重跑。原生源码未变部分沿其真实证据；新增总量限制不改变原稿。最终renderer7175.29kB，较本片整合前+1.46kB来自主线图片面板，未测流式P95。0新增付费，D盘与安装包未更新，E06/完整Goal仍未完成。详docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#powerPointSlice的finalIntegration。

## 2026-10-31 E06实际PowerPoint页面（第三切片）

原Pi交付前与原文件面板检查现可使用本机PowerPoint只读渲染PPTX全部页面，沿原检查/PNG缓存/截图选择放大及历史版本读取；缺字体和实际文字越页/超框记录具体页，未证明的逐字缺字/语义遮挡/动画仍未检查。外链/嵌入活动对象不自动打开，既有PowerPoint占用时明确忙而不接管。固定助手共享本地8槽、单项原生渲染，45秒/64页/16MiB；新实例核HWND/PID/启动时间/空集合后加入Windows Job，取消清理所属进程，正式文件不改写。

实际发现原8页标题框41.6pt小于PowerPoint字形45.055pt，修复标题留白+0.12英寸并下移正文，保留检查阈值/内容/字体/备注；实际全8页重渲染无该溢出。build、240组件、原生成4项通过；正式路径7项通过，首轮停止断言因8页已完成保留为失败；复用同一成果冷启、64页在途停止、独立既有Office占用3项通过（共10个不同相关路径，0renderer错误）。停止观察2235ms含进程退出探测，不冒称流式P95或1秒调度目标。主renderer7173.83kB未变，0新依赖/付费，audit45（0严重）。证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#powerPointSlice。

E06仍部分实现，新增已实现0/252；下一继续Word/PDF/WPS实际页面、缺字与语义遮挡、全部教师要求绑定及混合终态，再E07/E08+C和W3集中AT。D盘日常程序/安装包未更新；回退本片适配/服务接入/可选结构字段及标题高度可保留原正式文件和旧检查，整提交回退未独立演练。

## 2026-10-31 图片补救最终主线整合

最终正常合并origin/main de9dd38为057c489，14处Markdown插入冲突保留双方段落，生产代码无冲突。同一最终构建build/type、240组件、专项Node16/16（含22页检查、0skip）、E06源码11及截图缓存8项、正式图片导入→原生检索→Pi引用→冷启6项均exit0/0renderer。该4资料样本查询179ms/重排137ms，仅观测值；207/207综合及4次真实付费仍归属于bfd754c，最终整合0新增付费，不冒充重复全量或40GB验收。audit45（8高29中8低/0严重，exit1），未改依赖。完整Goal保持active，混合图题页AI正文索引阻塞等缺口继续；D盘日常目录/安装包未更新。回退仍关闭新页执行并保留来源读器、回执及原件。详docs/research/KB_INDEPENDENT_IMAGE_20261031.json的latestIntegration。

## 2026-10-31 独立图片补救与真实素材闭环

源码2c0262b，整合537c3dd为bfd754c；独立PNG/JPEG/WebP在实际OCR空白/失败时沿现两遍原页执行器恢复，不再直接local_parse_failed。复用RapidOCR、SQLite/文件、FTS/Lance/ONNX和Pi，无新依赖、模型、服务或IPC。图片来源独立schema，当前回执/历史增量保存并受版本/解析lease保护；重试保留原回执，父资料删除同时清理。只有显式includeImage的教师页读取返回核对输入图，后台/Pi不带Base64。题型只归一已知标签的等价分隔符，题干/答案/解析/投影用NFC，拒绝上下标被NFKC抹平。

此前已授权同一页PNG递归子目录实测，本轮4次真实DeepSeek HTTP200（两个独立授权批次各2次），未发送其他素材；最终4题中3题AI定稿、1图题待核，1857B原OCR/两遍响应/1.5与2.8及0.5条件保留，题本开正文/核对输入图，1920冷启0追加付费。首轮题1仅题型分隔符变化误挂待核，同一原始响应只读复读已证修复；最终付费响应不同，不当严格A/B。

bfd754c同一合并构建：build/type、240组件、15专项（含真实响应只读复读）+22页检查合并Node16/16且0skip，目标两模块100%行/89.89%分支/100%函数（旧image模块分支78.05%，新OCR模块全100%）；28批次/17检索/13归档/15图片文件/7目录、协作E06源码11项通过。正式图片6项ONtWNB、PDF回归6项wURQEA、真实素材3项qVnqCD均exit0/0renderer，实际ONNX/Lance/Pi/来源及冷启通过；同一构建最终207/207综合与shell exit0。综合走显式legacy-test，不冒充全Pi/教师验收。精确命令、私有回执位置、失败与构建指纹见research/KB_INDEPENDENT_IMAGE_20261031.json。

性能仅小样本：最终图片4资料首查193ms/重排143ms，PDF95/68ms；前轮图片OCR空白为0次AI、0还原结果，不能据此宣称40GB/P95/自然正确率或零错误。图题待核仍会使混合页AI正文暂不全文索引（3个合格题和原OCR仍可用），后续须分离正文完整性与题目图义风险；AI正文教师补正、跨页/答案册、40GB/低内存并发、旧inline迁移和受管安装继续。252集中验收与完整Goal不因此提高，保持active。audit45（8高29中8低/0严重，exit1），未改依赖。D盘日常构建和安装包未更新。

回退OMNI_EDU_AI_PAGE_RESTORATION=0停止新页处理，保留新图片来源读器、OCR当前/历史回执与输入文件，不追改旧已入库待核状态或删除原件/教师事实。保留协作E06完整记录，后续主线整合回执另记。

## 2026-10-31 E06持久实际截图（第二切片）

原文件/草稿检查卡现可按需查看实际渲染PNG、选择两种视口并放大；明确文件SHA/截图SHA/实际像素与CSS视口，旧文件版本标历史。冷启按原检查索引取回，缓存缺失/损坏明确不可用，不删除正式成果。复用同SQLite可选JSON字段及typed preload；派生缓存最多256张/96MiB、单图3MiB，不把Base64放进数据库或自动发送模型。修复弹窗Esc关闭外层文件面板及样式作用域隔离。

源码缓存8项、组件240项及最终正式Electron15项通过，0renderer错误；实际死循环停止1859ms。组件运行后只改小范围UI守卫/样式，最终15路径覆盖受影响行为，未重复无关全量。renderer7167.51→7173.83kB（+6.32kB），未测流式/P95；audit45（8高/29中/8低/0严重），0新依赖/付费调用。本机PowerPoint16成功导出合成课件8页仅为可行性探针，尚未接入生产检查。详docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json的visualEvidenceSlice（含早期失败）。

E06保持部分实现，新增已实现0/252；下一优先复用现有Office实际渲染路径接入检查，继续字体/遮挡/全教师要求绑定/混合终态，再E07/E08+C与W3集中AT。D盘日常目录/安装包未更新。回退本片可选缓存/读取/UI不改变原正式文件及账本；整提交回退未独立演练。

## 2026-10-31 最后整合重排预热主线

追加整合origin/main26bd4fd，保留双方14份新增Markdown段落；生产代码无冲突。最终build/type、8项重排边界及1项停止取消exit0。完整原生重排专项因本工作树未安装.local-reranker模型包返回unavailable、0项执行，保留主线既有25项证据但不冒充本地重跑；未新下载模型。240组件/207综合属于12f9dbf，正式Pi交付10项与0renderer错误属于4310c04；最新仅检索生命周期变动，未无差别重跑。E06仍部分实现，下一续Office实际渲染/持久视觉证据等，再E07/E08+C；0新增付费、D盘日常版本与安装包未更新。详docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json的latestIntegration。

## 2026-10-31 E06整合与回执兼容修复

实现6b11cb0，整合origin/main8f8d97f为12f9dbf；4310c04修复检查摘要追加第二段JSON导致原saved_bundle独立回读失效，摘要现合入原JSON且保留原字段/核验器。最终构建、正式Pi交付10/10及0renderer错误通过：真实CSV/HTML/XLSX一次确认、原文件账本核验、两尺寸预览、过期、冷启0模型重放、真实控件/键盘/画布、脚本错误与死循环停止（1750ms）。240组件与207/207综合在整合12f9dbf通过；综合禁用Pi，未冒充4310c04后再次运行。原11源码/两轮修复预算/教师改稿后8页8备注精确SHA证据保留；初期失败与修复原因均入证据JSON。

E06仍部分实现，新增已实现0/252：继续实际Office页面/字体/遮挡渲染、持久视觉证据、全部教师要求绑定及完整混合终态，再E07/E08+C与W3集中AT。renderer主包7166.22→7167.51kB（+1.29kB），未测P95；0新依赖，audit45（0严重）未自动升级。0新增真实付费请求，D盘日常目录/安装包未更新。停新写沿已有环境开关并保留原账本、native身份及读器，整提交回退兼容未独立验证。详细命令/边界与指纹见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json。

## 2026-10-31 E06候选检查与有界修复

E06复用Hana/Pi、原Office生成/私有页面、原文本/Office/bundle状态与文件权限、已有jsdom29.0.2/yauzl3.4.0。新增inspection-worker和typed IPC，仅派生表增量CREATE IF NOT EXISTS；不改旧native创建/control/memory/computation身份，独立inspection.v1追加。E06仍部分实现：Office实际页面/字体/遮挡渲染、持久视觉证据、自动绑定全部教师语义要求及完整混合终态仍待补齐；未渲染保持未检查。下一继续E06再E07/E08+C与W3集中AT，新增“已实现”0/252。D盘日常版本/安装包未更新，0真实付费请求。 详docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json。

## 2026-10-31 继续复用现ONNX重排

原BGE冻结EXE/ONNX InferenceSession直接预热复用，未换模型/修改Python模型包或新增依赖、下载和安装产物。Node内置os、AbortSignal、Promise和测试MockTimers支撑有界驻留/取消；现SQLite/FTS/Lance/Pi/typed IPC均保持。2GiB/1GiB内存滞回对应实测约863MiB工作集，并不等于整应用内存硬上限。官方API参考与构建指纹记录在research/KB_RERANKER_WARM_20261031.json；audit仍45项（8高29中8低/0严重），依赖锁未改，不自动扩域升级。

## 2026-10-31 AI图片复用现文件基础

继续复用SQLite事实、Node内置fs/crypto、readMaterialOriginal、Windows acquireWriterLock、现SQLite writer与data-root-files备份；无新依赖、许可证/下载体积/安装组件增量。MaterialAi/检索Host仅接现dataRoot，不增加IPC/服务/Agent循环；两列与pending/部分索引增量幂等。原字节文件保留在数据根，后续安装备份不能当缓存删除。npm audit本次45项（8高29中8低0严重）exit1，锁文件和依赖未改，较上一轮23为现审计反馈变化，不自动扩域升级。

## 2026-10-31 Pi完整文件核验优化

继续复用Pi原生技能加载器、既有不可变解析缓存、SQLite/FTS5/Lance/本地ONNX及原资料来源界面；无新增依赖、服务、表、IPC或安装组件。Node内置异步文件API用于运行期完整证明，逐级链接与内容哈希保留；空闲导入/编辑同步API待单独迁移。已整合main4d1f3ce协作E05，未改变对方受管工具/报告身份。npm audit本轮23项既有风险（8高7中8低/0严重），exit1，不称通过。

## 2026-10-30 E05与知识库主线最终整合

正常整合origin/main28ef069为f30212f，保留双方知识库正文来源与E05真实计算报告代码及13份Markdown完整新增节。合并后的build/type、240组件、20知识库页边界、E05正式Electron5项均exit0，0renderer错误；实际CSV/HTML/XLSX一次确认、所有文件账本回读、两尺寸预览及冷启0模型重放通过。最初KB专项因Node缺transform-types前置失败，按原脚本补正确参数后通过，未改协作源码。207综合仍属于合并前本轮代码，不冒充本次合并后重跑。 本地合并脚本曾未在失败后停止，误含标记的未推送提交已修正；全树标记与diff检查通过，未强推、未动其他已检出分支。下一仍E06→E07/E08+C→W3集中验收，新增已实现0/252；D盘日常版本及安装包未更新。详[最终整合证据](../research/AGENT_COMPUTATION_REPORTS_E05_20261030.json)的integration。

## 2026-10-30 E05类型CSV、图表与正式报告

实现b3170f8：类型化CSV显式声明文本/数值/空值；真实隔离计算得到30/200/10与合计240，001/002/003、带逗号备注和公式样文本保留。新增education_create_report直接引用本轮实际结果生成CSV、离线SVG/HTML与可编辑XLSX，复用原一次审阅/整包保存及独立文件账本核验；模型仍沿原脱敏输出。输入/代码/结果SHA与运行版本进入依据，临时结果清理不影响正式文件，过期/跨run引用不得发布。无新业务表/DDL/依赖或第二Agent循环。

最终build/type、8项实际进程/CSV/真实XLSX专项与正式Electron5项exit0，0renderer错误；一次原整包确认后真实文件回读通过，文件面板开图及冷启0模型重放。240组件与一次207/207综合exit0，在最终生成HTML窄栏样式调整前通过；后续最终build/8专项/5正式UI复测通过，不冒充再次运行综合。audit既有23项（0严重），0真实付费模型请求。 下一E06交付前结构/内容/视觉/交互/数值与整包核验及有界修复，再E07/E08与贯穿C，W3集中完整AT。E04/E05与252项仍未集中验收，本轮新增“已实现”0；保留知识库并行进度。D盘日常构建与安装包未更新。 详[进度](../goal/WORK_PROGRESS.md)与[本轮证据](../research/AGENT_COMPUTATION_REPORTS_E05_20261030.json)。

## 2026-10-30 最后主线整合42ac7be

最后刷新main83cf832（受管版本/FIFO计算），合并为42ac7be；13份Markdown同位置新增节冲突已逐项保留双方内容，preload自动合并已核对。该源码重新build/type、240组件、20页边界、目录→Pi来源→冷启五项均exit0（iLCx7P，原OCR183B、两视口、0renderer错误、每次2受控JSON/3受控SSE、0付费）。新小样本4资料、重排3候选，查询3918ms/重排3349ms，不能与4候选旧样本当提速A/B。207综合exit0仍明确属于fc2fd0d；未冒充最后这次无关受管版本合并后重跑。代码与新构建指纹见公开JSON latestIntegration。

## 2026-10-30 AI整页正文进入现检索与小智（M04/M10）

现SQLite FTS5/分词、RetrievalRepository时钟及重建、固定本地ONNX/LanceDB和原Pi的education_search_materials/office_read_material直接复用。没有新增模型、服务、工具名称或Agent循环。typed materials:source识别独立AI正文引用，原六字段OCR来源仍严格；生产Pi公共阅读引用登记后由现来源卡打开MaterialAiPagePanel，旧课堂/归档不接纳AI引用。回退：OMNI_EDU_AI_TEXT_INDEX=0停新派生，已有原页/档案读取保留；旧MaterialSource.v1/QuestionArchive.v1–v5不变。新增三张派生表/列索引增量幂等，重建从原回执恢复，无AI重发；停用不得删除原资料、教师编辑或回执。无本轮新增依赖，main合入的受管组件另见E04记录。npm audit仍23项既有风险（8高/7中/8低），不称审计通过。

## 2026-10-30 E04版本生命周期工程更新

实现8587057；真实双版本冻结/升级/回退与2进程FIFO队列已贯通现设置、typed IPC、Pi和隔离子进程。build、8+12源码专项、240组件、正式Electron5项通过；综合日志207/207（shell退出回执未跨轮保留），讲义既有间歇断言本次未复现。完整AT仍未集中验收，新增已实现0。后续E05图表/CSV/正式文件；精确事实见[WORK_PROGRESS](../goal/WORK_PROGRESS.md)与docs/research/AGENT_MANAGED_TOOL_VERSIONS_E04_20261030.json，D盘日常版本未更新。

## 2026-10-30 E04复用现Pi计算依赖

quickjs-wasi3.6.2原已为Pi间接依赖，tar7.5.22原也在锁内；新增直接生产声明，无新包版本/原生addon。官方包与已装WASM实际字节一致；主进程受管服务/独立子进程/现typed preload/原设置组件贯通，原文件生成与确认不变。实现f58f5ff，最终主进程兼容停用/故障卸载接缝59b32e9。最终build/type与12源码/真实组件专项exit0；正式Electron5项及240组件在f58f5ff通过，后续renderer未改，非最终重跑。UI从现设置看到缺失→同任务真实官方下载安装→240结果→UI卸载/准备→冷启0下载/0模型调用，0renderer错误，1366/1920截图保留。0真实付费模型请求；npm audit既有23项（0严重），未自动修依赖。证据docs/research/AGENT_MANAGED_TOOLS_E04_20261030.json。

## 2026-10-30 E03原Pi与SQLite薄适配

新增只读read_teacher_request及独立teacher-requests.v1 native记录；沿原main会话回调/manifest/catalog/task envelope。原teacher消息与controls是唯一请求事实，既有typed preload/ask_teacher/Office文件确认不变。无DDL、新依赖、真实API调用；精确control历史提示词匹配避免压缩误判配置。

## 2026-10-30 复用原OCR/DeepSeek执行器

还原提示OCR_RESTORATION_INSTRUCTION由文字、图片与Word角色图稿共用，PDF新页模式增加pageText/pageIssues；继续现统一DeepSeek、严格schema、原隐私/来源/额度与双阶段。复用现PDF文件Worker、原图预览、imageTextEvidence、同题本与Pi，不引入第二Agent或后端。无新依赖、许可证或打包体积变更；新v5须保留读取，OMNI_EDU_AI_PAGE_RESTORATION=0停新生产。

## 2026-10-29 E03工具输入扩展

Hana office_read_text扩展.html/.htm/.svg，仍64KiB UTF8，只读不运行脚本。原office_create_document增加presentationEdit v1参数，不与draft并用，仅本会话已保存逐页PPT按当前version另存修改；普通Office v1及原工具身份保持。PPT旧版/来源漂移返回错误，不重建外部任意PPT。

## 2026-10-29 长PDF沿原Worker修复

复用原PDF file.v3流式Worker/页ACK/发布事务、MaterialFolderAiRepository及AI首终稿与同题本；只修发布就绪判断、持久轮转、未计费旧误判恢复和确定性页前言边界。不新增库/服务/模型/IPC；52MiB测试嵌入载荷通过现PIL/pypdf生成，属于测试夹具而非产品依赖或真实教师语料。无新增付费调用。

## 2026-10-29 DeepSeek思考元数据

官方/models现在声明effort.supported_levels/default_level，缓存保留同字段语义；Chat Completions关闭使用thinking.type=disabled与reasoning_effort=none，low/high/max使用enabled及对应effort。参考https://api-docs.deepseek.com/api/list-models/ 和 https://api-docs.deepseek.com/api/create-chat-completion/ 。SDK内部level与供应商参数通过宿主最终payload桥接，拒绝伪Ultra，不自动切换供应商。

## 2026-10-29 规则与AI来源关联复用

沿现确定性抽题器、Word无歧义角色来源、AI回执和SQLite同题库增加派生关系；不另做相似度引擎/Agent。原题/OCR/首终稿不变，现notebook typed通道新增showSourceCandidates并贯通严格布尔校验。无依赖/模型/安装资源增加；整合main整包交付后构建与专项兼容范围分别记录。

## 2026-10-29 备份与停写复用

原store.exportDataRoot/verifyDataBackup与DataBackupPanel追加默认输出范围和数量，typed结果扩可选字段，无新IPC/DDL/依赖；旧manifest.v1兼容。原text/Office服务、整包工具和Pi复制回调共用启动停写门，审批/权限/native身份不替换。

## 2026-10-29 整包集成

沿原text/Office service、PPT生成器、Hana读取与原审阅字段，新增office_deliver_files、delivery DTO/event及唯一整包decision IPC。无新依赖/许可证/安装体积依赖；只新增引用元数据表。回退须保留新kind/记录/文件读取，停写开关与备份后续实现。

## 2026-10-29 规则题核验复用

共用现question-archive schema、AI回执和教师sourceChecked编辑入口，未增加模型/依赖/存储真源。现Pi/检索/组卷经同一archiveEligible，联网补答仅补缺失角色并保留题面核验状态；旧原件和题目事实不迁移，needs_attention为可重建派生标记。

## 2026-10-29 目录AI复用边界

复用现MaterialImportBatches、本地解析OCR、MaterialAiRepository、Word原生图稿/图片回执、统一DeepSeek配置与同题库；新增的是目录授权调度与typed卡片入口，不另建模型设置/Agent/检索服务。图片/Word/文本两阶段共用OCR还原规则v1，原图核对与补充解题分开。无新依赖/锁文件/外部部署，Windows包装资源变化为0，完整受管组件与EXE安装验收另续。

## 2026-10-29 PPT生成与备注读取复用

仍用PptxGenJS4.0.1实际生成文字/表格/notes；Hana anydoc0.1.2本来可提取备注，实证后直接复用，移除重复生产XML解析。独立checker复用既有有界ZIP/XML包，PowerPoint原生检查只打开本轮合成文件；无新包、付费任务或运行时。


## 2026-10-29 默认文件能力复用

复用Hana/Pi目录读取、原文本编辑/差异、Office生成/审阅/SQLite与现文件面板，新增薄接默认产物和HTML离线预览。无新依赖、包下载、第二runtime或外部付费请求。通用HTML不伪装为Anatomy专属导出，备份/工具准备等完整目标继续。

## 2026-10-29 继续现队列及DeepSeek，不加第二运行时

后台归档复用原复制/hash/来源守卫和持久解析队列，仅分离内部窄结果与公共overview，按128目录项交替处理。OCR还原提示直接复用当前DeepSeek单账户两阶段图片/Word协议，不新增模型或自建识别引擎。原OCR/原图/模型回答仍分别保留；全目录自动AI调度及整页修订正文暂未接入。

## 2026-10-29 受管接入与验收规格

详细任务书和AT要求真实工具源/固定版本/hash/许可/平台/兼容/空间/健康检查，不编造未定工具包的hash。受控小包只测边界，真实受管工具准备后继续任务才算产品能力。入口../product/PRD-XIAOZHI-AGENT-DELIVERY.md；此轮无新依赖或运行时集成。
## 2026-10-29 WeKnora完整运行对照已完成

Tencent/WeKnora固定dacb9c2未改源，用隔离签名校验UCRT GCC15完整构建277858304B EXE，带三个运行DLL、无编译器PATH健康200。九份同OCR文本/API检索与同向量容量实跑；原图需VLM/PDF需DocReader，百万热P95 3755ms，故未切生产。E5本地桥仅比较夹具、无第二Agent。新增OCR文字纠错复用现DeepSeek/projection/Pi/SQLite，非自建通用后端。详细匿名证据research/KB_WEKNORA_RUNTIME_EVIDENCE_20261029.json。

## 2026-10-29 工具自主准备范围纠偏

用户新增要求常用工具可用、缺少时能自主准备。现生产技能只有本地包导入，自动下载配置仍未完成；该方向纳入统一受管组件层，不另建Agent Loop。候选合同区分技能/工具/依赖/授权，固定来源、版本/校验、许可、隔离与失败恢复，实际方案见../product/XIAOZHI_AGENT_CAPABILITY_ROADMAP.md。

## 2026-10-29 Hana资源层继续薄适配

沿Hana加载/空闲生命周期设计复用Pi原生历史资源，未引入另一Engine或Runtime；工具与权限逐轮绑定。local引用扩展现公开来源，主进程登记，renderer使用已有文件/附件预览与OCR审核读API。无新增依赖，主进程legacy开关回退原生缓存和引用注册。

## 2026-10-28 Hana回答优化独立切片

新增Hana质量ToolCatalog固定SHA/许可证追踪，复用脚本与源清单见 vendor/hana/quality。没有新增npm/Python依赖，也未接入DSH或SourceWeft服务；其机制由当前Pi适配。默认优化可用主进程环境XIAOZHI_ANSWER_QUALITY=legacy回退，既有来源/权限/审阅IPC兼容。详../goal/HANA_ANSWER_QUALITY.md。

## 2026-10-29 候选已运行，尚非生产接入

AnythingLLM官方v1.19.0原生后端经明确兼容调整，隔离摄入九文件并用默认/多语言模型查询；Docling 2.144.0隔离CPU安装/离线同页测试有页码坐标且仍漏条件；WeKnora dacb9c2源已下载并构建Windows Lite中。没有替换小智SQLite或新增第二Agent。Ghostscript许可/Windows短模型路径/兼容初始化须在受管组件清单解决。本片生产只修试卷保存授权指令。

## 2026-10-28 允许独立受管组件

按最新用户要求，成熟后端/解析器与模型可由安装层自动下载、配置、启动和更新，老师不手动搭环境；不再以单EXE体积排除候选。官方AnythingLLM v1.19.0发行件已获取并通过SHA256核验，仅在隔离目录解包，未接生产或取得桌面白标权。下一继续KR02；自动安装未实现，详../goal/KB_MANAGED_COMPONENTS_CONTRACT.md。

## 2026-10-28 知识库集成候选已核验、未接入

AnythingLLM已发布v1.19.0的摄入/索引更新/检索API和WeKnora只读检索/全文接口为复用接缝；只允许受管本机服务与既有Pi资料入口薄适配，现仍未安装/注册候选或变更凭据。先同资料/几十GB资源资格，再定迁移；保留当前可回退索引与SQLite来源事实。

## 2026-10-28 Git与日常入口整合

当前仅在独占审计工作树三方整合main；全分支已提交内容均包含于fdc8e9c。D:备份冗余后ff并跟踪origin/main，Desktop启动器经D:启动器到npm start；不使用工作树测试窗口替代日常源码。用户私有资料和截图通过本机exclude保留，未上传；最终提交/远端SHA与D启动结果补WORK_PROGRESS。

## 2026-10-28 真实资料重审与输出授权接线

production-host将现resolvePaperOutput接入createTaskResources的可选officeOutput，不增加IPC/权限或新写入器；仅解决无workspace的试卷/课堂输出任务身份，正式写入仍走现Office审批与来源校验。真实扫描页2题已从AI两遍进入题意检索/蓝图，Office实际仍configuration且0文件。新增真实材料/实际Pi脚本均隔离本机原件与账户、记录请求，不用受控模型冒充真实provider；最新主线cc2e68a只增加F15测试/文档。详KB_IMPLEMENTATION_EVIDENCE.md。

## 2026-10-28 DeepSeek统一接入与原生图题消费者

生产图文整理复用createModelSettings/runtime与现加密Key，固定deepseek-flash及https://api.deepseek.com/chat/completions，reasoning_effort=none，JSON schema本地校验；createDeepSeekFetch沿既有Electron网络边界。官方能力说明：https://api-docs.deepseek.com/guides/vision/ 与 https://api-docs.deepseek.com/api/create-chat-completion/ 。历史Qwen模型ID/receipt仍可读，生产调用不回退其他厂商。

沿用Word排版、本地OCR、SQLite、Pi/typed preload、原Office Word/PDF生成器，无新依赖/部署服务。NativeAiContext+v2输入digest保存必要角色/OCR/图片；现Pi仅传脱敏图义，正式Office resolver核当前角色与SHA。EXE安装体积及真实provider质量尚未验收。

<!-- kb-native-ledger-20261028:start -->
## 2026-10-28 原生AI业务图片与持久输入（完整目标继续）

复用现Electron渲染、image-size、SQLite/sqlite3和Windows OS锁，无新增依赖/服务或外发权限。WordQuestionProofRepository.evidence为main-private真实来源提升接口；native unit可携带版本化Word selector（不是上传payload）。NativeQuestionRepository提供stageInput/readInput/withInput与questionVersion角色读回，供现AI pipeline后续接线。installer体积与完整生产集成仍未验收。
<!-- kb-native-ledger-20261028:end -->

## 2026-10-27 Windows日常启动

> 2026-10-28 主线交付：用户已授权提交及推送；本节通过结果为10月27日D:历史证据。本轮依赖安装未完成，build（缺tsc）/组件（缺react-aria文件）exit1；原生专项未重跑。专项已补全新工作区目录初始化。详见 DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md 的发布与核验记录。

Node子进程交互Electron配置windowsHide=false；仅后台build/probe辅助进程隐藏，无新依赖或外部服务。专项复用现Playwright CDP读取Pi页面、Win32 EnumWindows验证原生可见、WM_CLOSE优雅退出，独立profile/data。证据见../goal/DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md。

<!-- kb-web-writeback-20261027:start -->
## 2026-10-27 S6-C 持久联网补答与批判修复

沿用Hana0.450.0 Electron+Mozilla Readability0.6.0 Apache-2.0原始源码，无新npm/Python依赖。本次新增education_web_answer authorize/propose/status、questions:web-answer-evidence typed IPC、archive v4逐角色证据及同题本。Hana通用网络可选main-only beforeNetworkRequest/beforeRequest，在每次跳转和DNS前后重查，旧无guard消费者保持。真实搜题站适配/登录接管仍须实证。
<!-- kb-web-writeback-20261027:end -->

<!-- kb-enrichment-read-20261027:start -->
## 2026-10-27 S6-C 缺答题实读与独立批判修复

S6-C继续复用现Hana/Readability和唯一Pi。education_search_questions/read_question的可选purpose是兼容扩展；缺答实读使用独立本地候选查询与已有来源/隐私校验，不增IPC、部署服务、npm包或上云权限。已有web DOM观察仍不是持久答案回执；后续需独立web来源账本和版本栅栏补写，不伪装teacher或MaterialSource。
<!-- kb-enrichment-read-20261027:end -->

<!-- kb-dom-enrichment-20261027:start -->
## 2026-10-27 Mozilla原始源码直接复用

现Hana v0.450.0 Apache-2.0操作层保持，新增Mozilla Readability0.6.0原始89980B源码字符串与LICENSE/SHA清单。源SHA34dcab3d0832d0019f02990eed6b6124e029e8c32b9f0c6f2550544ff8dff174；无新npm依赖/Chrome/Python/browser-use服务。office_browser.extract及版本化元数据进入现来源回读；构建复制许可清单，LF规则保持hash。未集成Stagehand/browser-use完整Agent，也未向网站上传教师数据。
<!-- kb-dom-enrichment-20261027:end -->

<!-- kb-word-proof-20261027:start -->
## 2026-10-27 Word图稿typed接线

新增materials:word-proof-create/cancel/image与typed preload，单宿主requestId所有权/取消/退出drain；MaterialWordProof复用现按题页面，不改变AI批次上传授权。复用image-size、现MathML/Office隔离和Windows字体，不新增依赖；最终EXE体积与干净机器验证仍待实测。backup精确省略cache/word-question-pages并只清副本两表，正式AI图片仍须独立账本。
<!-- kb-word-proof-20261027:end -->

<!-- kb-word-question-20261027:start -->
## 2026-10-27 Word按题来源入口

新增xiaozhi.word-question-source.v1、materials:word-questions与typed getMaterialWordQuestions，复用material_word_documents和word-assets，不新增依赖/服务/DDL。每次最多5摘要+按需1题详情，所有查询包含resource/version，源码仓储复验digest后返回。MaterialWordBlocks供原文与按题视图复用，片段/图片key绑定全局位置、资源及图片版本。

后续AI必须仅发送resolved范围的必要图文，不能直接发送含邻题proof manifest的完整JSON。新的预览没有上云动作，也没有授予已有云端会话原图访问权限。
<!-- kb-word-question-20261027:end -->

## 2026-10-27 启动读取兼容

不新增/移除typed IPC、preload、schema或第三方依赖：仅App启动按runtime隔离旧消费者；共享会话接口继续供Pi和资料阅读辅导显式使用。D:node_modules补齐已锁定yauzl3.4.0/@types/yauzl3.4.0/pend1.2.0属于本机环境恢复，package/lock不变。证据与未验边界：`../goal/PRODUCTION_BOOTSTRAP_CONTRACT_20261027.md`。

<!-- kb-word-20261027:start -->
## 2026-10-27 Word 图文来源与主线续接

DOCX 新增固定纯 JS yauzl3.4.0(MIT)/saxes6.0.0(ISC)，开发类型 @types/yauzl3.4.0；无新 native/Python/常驻服务。其他 Office 保留 anydoc0.1.2。打包入口增加 word-worker.js，typed preload 提供 Word结构、单图、显式重整/取消；IPC 使用主进程 admission/drain owner。新增依赖体积/限额见KB_IMPLEMENTATION_CONTRACT.md，最终EXE尚未重发。

追加 typed materials:word-job 主进程状态查询；任务状态不依赖renderer组件是否挂载，且不改变SQLite业务真源或外部上传规则。
<!-- kb-word-20261027:end -->

<!-- kb-main-merge-20261026:start -->
## 2026-10-26 先整合 main，继续完整知识库主线

用户最新授权优先先整合本地 main、处理协作冲突，再继续知识库主线，替代此前“完整 Goal 结束后再合并”的时序。本轮检查点 59b4303，整合协作者 main 076edd1（含亮色工作台、会话/推理流和整合修复）；28 个冲突文件按双方有效行为组合。本地 main 已于本轮整合到 8f14752（双方历史及修复），未 push。快进前发现D盘协作者切到 codex/composer-grouped-conformance 并有4个已跟踪脏文件及1个新测试，已保留原现场；改在干净 beca 工作树切 main 快进后切回知识库分支。未把D盘当前分支/运行目录冒充同步到新main。此状态文档收尾提交也将快进本地main。未发布新安装包，后续 Git 状态以实际 HEAD 为准。

已修正 partial 资料阅读笔记 CAS、新材料/检索/AI IPC 退出 drain、启动恢复晚到、未保存笔记的新入口与同资料搜索定位。综合 smoke 实际暴露语义索引独占锁使备份 EBUSY，已在 backup 领域改为有界异步复制/哈希、原生 SQLite 在线快照，精确排除 cache/semantic-v1；快照改 DELETE journal 模式，并只在备份副本清除省略索引的完成资格，恢复后自动全量回填。原件、题目、来源时钟、暂停选择和产物保留。

已完成 build/typecheck、renderer 240/240，重排8、检索17、AI16组回归；独立合并5、原生备份3、独立恢复5项定向探针通过，冻结教育包7项含主线新增线性方程组 v2，四套发行资源预检通过。重排/阅读 Electron 预备构建5项/2启动/0 rendererErrors通过；最终构建并发综合回归期间另一次冷查未出现成功重排提示而等待断言超时（未单独实证模型失败原因），该失败保留 kb-main-journey-current.log，不能以预备通过掩盖。最后整合 bundle SHA256 b8012530a716fbcc3232bb4d86786844762f1d0348e97107b37b03d6f014961c。

综合 smoke 修复后 exit0：kb-main-smoke-final.log，ok=true/30名隔离学生/207项历史教育兼容路径，包含12项备份导出/校验/取消/篡改/重启/双视口。该legacy兼容路径不代表当前全部Pi UI或真实provider已验收；当前Pi知识库/阅读另在最终bundle上串行复验5项/2启动/0 rendererErrors（kb-main-journey-serial.log），首查9851ms、热请求134ms，仍未达到2秒冷查目标，非P95/40GB证据。首次备份EBUSY与并行冷查成功提示断言超时的失败日志保留。npm audit 最终21项（8 high/5 moderate/8 low），尚未清零；无自动大版本升级。原 main 带来的4处历史 EOF 空行由 staged diff --check 报告，本轮相对 main 的 diff --check 通过，未重写协作者/上游源码消除风格告警。

完整 Goal 仍 active。继续 S6-B Word 结构与完整图文题：已用真实 anydoc 0.1.2 证明 toDocument 保留图片 SHA/part，OMML 分数在 AST 和 Markdown 均缺失。随后是跨页/答案册匹配、受管本地视觉AI、自然教师召回质量/冷查询优化、40GB持续导入与最终EXE；以上未验证边界继续 OPEN。
<!-- kb-main-merge-20261026:end -->


<!-- kb-rerank-20261026:start -->
## 2026-10-26 有限中文重排与最新实现基线（目标继续）

S5-B3已接通有限中文交叉编码器：资料库、同一题本与小智现检索适配器使用BGE-reranker-base q8，对前20对象评分，再与原召回等权RRF融合，未评分尾部保留。新冻结Windows EXE懒启动、15秒总预算、队列/输出/窗口有界、空闲回收；错误/超时保留原排序并显示降级。模型不更改题目、答案或来源，不给教师展示虚构正确率。

新资产详见src/main/retrieval/reranker-assets.json、reranker-runtime-manifest.json和python/omni_edu_reranker/SOURCE.md；MIT base模型399017988字节未压缩发行增量，Apache-2.0 m3仅评估现已隔离。无新pip/npm运行框架；build/prepare/afterPack已增加新包的校验和许可。

已隔离到apps/desktop/.retired-builds/S0-20261026（旧安装包/程序约1554876094字节）和m3-evaluation-20261026（未采用评估权重约587843930字节），共2142720024字节。当前选定base模型与最新out不在这两处；原.release路径已收起，后续全新安装包另构建。删除情况待用户实际操作，未替用户确认完成。

整体Goal继续active。下一主线优先完整图文题/Word来源表示与归档、跨页/答案配对、可选视觉AI；随后旧代缓存GC、自然教师质量与长上下文/冷启动优化、40GB持续处理与统一最新EXE。当前合成质量/小型路径不能冒充企业级或全目标通过。当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；全目标完成后读取最新main、保留协作者变更并处理冲突。
<!-- kb-rerank-20261026:end -->


<!-- kb-semantic-20261026:start -->
## 2026-10-26 本地混合召回与批量索引（整体继续实施）

新增独立离线embedding runtime：BGE-small-zh-v1.5 MIT；Xenova固定ONNX镜像commit75c43b069aac4d136ba6bc1122f995fedcfd2781；q8模型24010842字节SHA15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc，tokenizer SHA48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26。tokenizers0.21.4 Apache-2.0固定win wheel2507568字节，复用经审构建Python/ORT，不改共享环境。

冻结包156文件127076474字节，完整许可证/工具链/buildInputs/每文件SHA在retrieval/runtime-manifest.json与python/omni_edu_retrieval/SOURCE.md；运行时无系统Python、PyTorch、网络下载。发行配置已追加资源，prepare-resources实检三套runtime通过；未重打新NSIS。源码资产准备需要网络并按固定SHA核对，不能宣称源码离线构建。

完整目标继续active/DOING。当前实际向量搜索仍FLAT，尚无交叉编码器重排、自然教师holdout的Recall/Precision或百万级CPU P95证明；16条小样本批量通过不是40GB证据。下一位置：索引维护/ANN/重排与质量门槛，完整图文题/DOCX图公式锚点/跨页与答案册配对、受管本地视觉AI包、自然资料与40GB持续处理，最后统一EXE发行和main集成。旧NSIS不含当前源码。不得把本地embedding包称为本地视觉AI整理已完成。
<!-- kb-semantic-20261026:end -->


<!-- kb-pdf-20261024:start -->
## 2026-10-24 长PDF持续处理落地（完整目标仍进行中）

S2-B已接通长PDF按页持久处理：受管原件同一Windows只读句柄核验SHA，页结果逐条校验/事务落库后ACK；manifest/世代/任务lease与工作进程存活共同守卫发布。原生文字与OCR分别保存，混合页检查原生正文、数字和数学符号覆盖；needs_review/failed不发布正文。停止保留成功页，继续与显式重试分开。来源预览/layout支持第50页以后、直接页码跳转及已打开预览跟随引用。原件上限16GiB、10000页与单页/暂存预算是设计边界，未宣称已测极限。

私有file.v3事件manifest→progress/page+ACK→finished持锁发布+commit ACK→released。新typed材料IPC pdf-status/pdf-retry，公开预览/layout上限10000，旧bytes协议保持独立50页界限。新OCR固定runtime资源路径file-v3-dist，electron-builder/prepare/打包校验已同步，尚未重新发行NSIS。

当前真实证据：固定新runtime 646文件/279039929字节，无新模型或Python依赖；61页/56272644字节明确合成混合PDF，1644453字符正文，59页完成、1空白、1超限失败，partial可检索。Electron主路径5项/2启动/0renderer错误；另3项来源跳转/双视口检查，旧S3数据库副本3项兼容读回。build、最终typecheck、renderer217/217、发布守卫4项和原生/OCR覆盖5项通过。精确记录见KB_IMPLEMENTATION_EVIDENCE.md；这不是自然教师资料质量、40GB规模或新安装包验收。
<!-- kb-pdf-20261024:end -->

<!-- kb-implementation-20261024:start -->
## 2026-10-24 知识库功能实施进展（整体未完成）

S1/S4-A不新增依赖、模型或服务，复用现Node文件流、SQLite FTS5、typed IPC、HeroUI现组件、Pi/DeepTutor固定匹配。追加两张目录事实表、版本化FTS/dirty派生表和触发器，旧原件/题库事实不迁移。主进程归档/补建可关闭并恢复；知识库开发版使用独立profile/dataRoot，旧S0安装包未重建。
<!-- kb-implementation-20261024:end -->

## 2026-10-24 已批准的UI正式替换

统一亮色EduShell/15页合同及AgentProcess已接入真实typed业务入口；原厂样式独立、旧领域几何暂兼容，不引入第二套模型循环、DDL或IPC。公开过程在answer交接时整体收起；原始reasoning仅详情。范围、真实验证、未验领域及协作main交付以 `../design/ui-rebuild-2026-10-24/DELIVERY.md` 为准。

## 2026-10-24 当前：撤回UI对齐结论，建立重建审阅基线

用户明确否决前轮UI；旧测试结果不能继续作为视觉接受。已只读复现旧真实构建并记录11处CSSOM，证实旧玻璃主题/无layer外壳规则继续覆盖原厂；旧应用AgentTrace组合也不等同官方示例。已在同一1c54工作树保存177文件回退快照，建立15页合同、原厂示例对照/组件指纹、可点击Electron审阅稿。合同检查21项，样张22项/0pageerror，renderer217＋隔离8通过；本轮未替换正式业务页、未发新provider请求。已询问整体视觉与过程组合，等待用户确认，不擅改组件配置。main/远端仍b5a7fc6；旧空锁仍在，先前清理被自动审批拒绝，未提交推送。详见 `../design/ui-rebuild-2026-10-24/README.md`。 本轮不变更Master的本地优先、教师确认、来源与Pi唯一编排规则；总体DOING。

## 2026-10-23 当前：官方Agent Trace Streaming与正文体验

本轮用户明确取代DSH预览：采用官方多块/嵌套组合，运行展开、整轮终态收起、正文独立流式；删除输入上方额外遥测，目标控件迁至侧栏。普通解释自然段落，必要任务结构保留。最终真实Electron25项、原厂亮色双尺寸与控制台通过；边界16/轨迹19/renderer217＋样式7、技能25/22/14、兼容旧路径207通过。没有新SDK循环/依赖/DDL/IPC，权限与教师确认保持；Windows原生路径解析只替换等价调用、不缓存授权。首段仍有约6–7秒本地准备延迟，整体视觉/性能和Master仍DOING。Git main交付尚受遗留index.lock阻塞，清理被自动审批拒绝。证据与精确命令：`../../docs/audit/chat-ui-2026-10-23/AGENT_TRACE_STREAMING_DELIVERY.md`。


## 2026-10-23 官方DSH交互对照（最新）

参考deepseek-ai/deepseek-harness固定687f282e的ReasoningRow/use-disclosure及测试；学习每段默认收起、真实段落首行预览和独立工具，不复制其CSS、安装依赖或替换runtime。HeroUI原厂样式与亮色保持，未启用DSH可选外部翻译。见 [证据](../audit/chat-ui-2026-10-23/DSH_REASONING_DELIVERY.md)。

## 2026-10-23 官方推理组件接入（最新）

HeroUI MCP和官方ChainOfThought文档已核：AgentTraceStreaming为组合示例、isStreaming只控制标题动效。供应商reasoning_content由现有Pi SDK解析为thinking_delta，本轮在应用边界接入真实内容与生命周期；原生SDK继续工具回传，不改vendor、不新建推理loop或翻译调用。样式保护/官方OSS→Pro顺序和亮色保持。见 [本轮证据](../audit/chat-ui-2026-10-23/MODEL_REASONING_DELIVERY.md)。

## 2026-10-23 样式审计与公开阶段补齐（当前）

OSS/Pro统一导入顺序，复用原ChainOfThought组合；原厂CSS/组件与本地来源SHA核对，未改vendor。应用PostCSS防止旧样式进入保护根，不新增包；仅官方亮色主题。公开事件/metadata为可选增量，费用/预算与处理墙钟分开，既有audit告警未强升依赖。 证据：`../audit/chat-ui-2026-10-23/style-audit/DELIVERY.md`。

## 2026-10-23 Agent Trace Streaming

当前HeroUI Pro MCP list_components/get_component_docs(chain-of-thought)/get_css均返回成功，复用仓库既有ChainOfThought受控展开与流式Trigger/Steps；Agent Trace Streaming为组合示例。无新包/许可证或Windows打包依赖变化，既有audit告警如实记录。未改变模型设置、隐藏reasoning、外部上传或Pi唯一loop。 详情：`../audit/chat-ui-2026-10-23/AGENT_TRACE_DELIVERY.md`。

## 2026-10-23 数学与既有产物复用

锁定@streamdown/math 1.0.3（Apache-2.0），复用KaTeX与现Pro Markdown/Actions/Modal；新增13包安装内容约302,174字节、MIT/ISC/Apache许可，无原生组件。新reply-export复用document_artifacts/既有Markdown导出，不替换Word/PDF审批。包体/Windows安装器未重验；完整边界见 `../audit/chat-ui-2026-10-23/DELIVERY.md`。下一轮优先复用现任务/来源/审核组件，不新增UI框架或Agent loop。

<!-- 以下保留 D 盘停写前的历史记录，供业务追溯；当前状态以上方 main 记录为准。 -->

## 2026-10-21 教师资料备课保存

无新第三方依赖。沿用Pi唯一循环、DeepSeek保存配置、Hana附件读取、既有text-change审批卡、typed preload、SQLite/WAL与native回执。新增main-only状态写排队、任务安全读取旁路和计划kind提示；真实证据使用日常profile合成附件，不把真实账户余额或系统网络设置写进产品数据。测试覆盖见teacher-materials-20261021/progress.json。

## 2026-10-21 教师答复误停修复与主线收紧

教师答复进展复用Pi原工具循环、native-tail、既有control/journal/receipt与typed goal事件，不新增第三方依赖。明确SSE正式桌面5、输入反例23、退出回归10、组件234/兼容207有各自范围；真实DeepSeek/原NETIMGFILE/公网MCP/Office动画-WPS等仍待验。当前证据harness-teacher-input-20261021-answer-delivery/progress.json。

## 2026-10-21 等待审批退出崩溃：限定修复验收

无新外部集成/依赖；沿用Pi/Hana/sqlite3与原typed preload。main退出边界修复：实际Electron pending三种关闭10/10、读写审批回归7/7和138事件独立对账，SSE夹具与真实provider分开。证据harness-shutdown-20261021-ipc-drain/progress.json；公网MCP、真实NET/IMG/FILE、Office动画/WPS等原未验项保留。

## 2026-10-21 探索资料不误停，定位不冒充成果

office_list_files/file_stat经Hana实际IO来源身份＋当前授权/native/快照复核后可推进持续目标，同源只得一次定位信用；目录/元信息仅作中间checkpoint，最终正文/保存/教师验收仍独立。UI说明仅定位、未核正文。旧记录不补造通过，无新IPC/DDL/依赖/Loop。

85e235ee同构建：实际Pi Electron三级定位→正文→同目录审批保存→确认/冷启、同源idle3停止共7项，Hana/FS反例19、旧改稿14、真实store8及type/npm隔离build/renderer234/legacy207通过；166事件/11回执/进展key/文件/native独立对账，4张原生浅暗双尺寸图已看。模型明确SSE，不是provider/真人证明。精确范围harness-h05c1-20261021-discovery-delivery/progress.json。

完整H05和原NETIMGFILE等仍OPEN；HARNESS-SHUTDOWN-PENDING-01保留超时收尾NAPI fatal待归因，未因正常冷启通过而关闭。日常out/profile未替换。

## 2026-10-21 教师验收要求增删/重排

在“核对目标成果/任务成果→修正要求”添加、移除或上移教学验收要求；main分配新增ID、保留项不重编号，机器标准和依赖不删除。保存使旧确认失效/暂停，正式目标显式恢复后按新版本确认；旧目标API仍用同一Task验收权威。

冻结30745e68：实际Pi/typed Electron增删→恢复→新确认→冷启7项、同构建读原稿/重新审批改稿14项、边界12、浏览器22、真实store8及type/npm隔离build/renderer234/legacy207通过；68事件/native/action/history独立对账、4张原生浅暗双尺寸图已看。模型明确SSE，不是新provider/教师人工证明。精确命令及范围见harness-h05b2-20261021-criteria-final/progress.json；完整H05、原NETIMGFILE与后续Goal仍OPEN，日常out/profile未替换。

## 2026-10-21 新要求恢复与原稿历史核验

实际原Pi/typed教师操作现已验证修改要求后重新读资料/原稿、两次新批准改稿、新版教师确认及冷启；冻结a755，正式Electron14项模型流为明确SSE，非真实provider/教师独立证明。原稿经raw SHA/脱敏全文/before与当前after核验后标“历史输入”，不代替当前file标准。真实store8、专项与renderer234/legacy207、257事件及文件链独立对账见harness-h05b2-20261021-goal-revision-delivery/progress.json。完整H05仍IMPLEMENTING，教师要求增删下一片；原NETIMGFILE、真实provider、无VPN/安装/Office动画-WPS/真人继续OPEN。

## 2026-10-21 正式Goal复用现任务核验权威

原GoalState、TaskState/TeacherActions、Pi publisher/journal/Hana/native reader与PiTaskReview直接复用。新goal-binding仅建立真实教师要求digest/固定criterion映射和旧task采用规则；typed任务操作不增加外部权限。task事件可同事务携带当前goal投影，旧goal accept委托同一main读回链；无adapter不以旧run成功/全选完成。

冻结52cc35ab与原npm隔离build对照，未改依赖/DDL/vendor/凭证/网络。正式Electron9与普通恢复8的模型流明确SSE夹具；真实文件、审批、SQLite/native实际运行。历史DeepSeek402与原NETIMGFILE不因受控通过改绿。当前真实store8、边界15等及最终同构建门禁见harness-h05b2-20261021-goal-task-delivery/progress.json；修改要求后的版本恢复、旧多task迁移和公网MCP仍待验。

## 2026-10-21 Pi v3任务准入与跨run重查

继续复用原Pi SDK实际beforeDelivery/finishTurn、执行边界attempt/journal/timeout、Hana授权文件、native-tail与settled receipt/readback；没有Codex CLI或新Agent Loop。v3 tool envelope在宿主剥离taskStepId后交原工具，资源与digest由实际参数独立生成。恢复复用原host.start/command幂等和publisher.task checkpoint；旧run新proof保留原run/call权威，教师最终核对覆盖所有实际产物。

typed IPC新增显式task-resume，认证/密钥配置未改变。当前原生测试使用明确SSE模型夹具与未改时间的官方目录缓存，真实SQLite/原生调用/审批和文件效果仍实际运行；不能将该模型流记成DeepSeek HTTP200。旧历史HTTP402/Insufficient Balance保持，未循环收费请求。完整goal adapter及H07国产公网认证仍未验，证据见harness-h05b2-20261021-resume-delivery。

## 2026-10-21 Anatomy教学版扩展

继续复用固定MIT Anatomy与原gifenc/PptxGenJS，不安装新包；新增版本化可选教学数据与宿主解析，不改全局技能已锁版本或原技能包hash。实际路径science-figure→既有审批/保存→science-demo→typed文件面板→science-ppt。教师答案/notes仅PPT备注；旧产物保原通用行为。0新provider/密钥/网络设置变更。证据与Office兼容边界见ANATOMY_TEACHER_PPT及harness-science-teaching-20261021-first/progress.json。

## 2026-10-21 H05-B2生产任务/核对集成

现有SQLite事务、journal/outbox、Pi publisher、Hana工具、native-tail和readback被tasks/coordinator与result-recheck直接复用；零DDL/新依赖/vendor/凭证更改。main tasks/api注册来源检查的snapshot/review/correct，经typed preload到PiTaskReview；普通请求human核对不增加模型loop或替代正式goal。真实store事务需提供同连接change，坏task在snapshot隔离提示。

当前实际失败恢复UI6项、真实store8项与重查适配器10项等证据见harness-h05b2-20261021-product-review/progress.json，后者native/SQL明确为夹具；真实正面provider→当前文件proof→教师确认待充值。完整step/criterion/native admission/恢复仍未完成，旧plan.v2历史兼容保留。

## 2026-10-21 H05-B2人类动作与读回接缝

tasks/teacher-actions.ts＋task-evidence.ts复用现SQL事务/TaskVerification/result-readback，无新依赖或DDL。主进程方法、shared输入验证已实现，未注册模型工具/IPC。实际权限、native/effect重建、正式goal标准同步及公开task journal必须在生产coordinator接入；目前recheck只是main回调合同，专项的native/effect为声明夹具。127项源码与26/27检查证据见harness-h05b2-20261021-teacher-authority/progress.json，未宣称生产或领域权限通过。


## 2026-10-21 H05-B2存储选择与待接缝

复用现SQLite app_settings＋Sql.transaction/change，独立xiaozhi.task.v1:命名空间；不改旧plan.v2、control schema/native指纹，不新增表/依赖/vendor。main-only factory暂未导入生产：真实beforeDelivery、effect reader、committed task事件、typed preload/UI及教师确认来源是下一步必接项。受控执行边界测试27/27，原生产反例3项仍失败；相关源码/命令/报告在harness-h05b2-20261021-storage。结果属于IMPLEMENTING，不作生产/Office/网络能力验收。


## 2026-10-21 H05-B1 读回与Pi调度接缝

固定宿主planBasis后缀与结果JSON分别处理，未知/重复/外国后缀不静默丢核验。复用原Pi1.0.2 AgentSession边界及核心finishTurn end，extension continue=false本身不能终止工具后原生调度；本片链原实现，不改vendor/旧native身份。main独立readback→committed verification→goal进展→原调度退出，保存完整性不冒充教学验收。限定证据harness-h05b1-20261021-delivery/progress.json；任务范围step/criterion/教师来源/admission仍待B2。


## 2026-10-21 教师科普PPT使用与后续接缝

现science-ppt.ts输出通用结构观察PPT，ScienceClassroomExport.tsx提供PPT/GIF显式导出；HTML交互不作为普通PPT内嵌网页承诺。教师下一片要求及验收在ANATOMY_TEACHER_PPT.md顶部，操作在根目录“科普课件使用.md”。后续教学字段须贯通审阅/保存/导出、版本兼容旧产物，导出阶段不静默补生成教学内容。本轮仅文档澄清，历史实例不代表本轮重测Office/WPS。

## 2026-10-21 H09-C3 计划协议复用

直接复用已审Pi customTools/现工具attempt边界、SQLite控制表/公共journal、typed preload和本地HeroUI ChainOfThought/原生details。对比openhanako todo/todo-compat后确认其无本片所需DAG/CAS，不复制新的上游源码或引入新依赖。旧native prompt/fingerprint保留，plan能力hash独立；新增宿主调用引用不改变权限、教师事实与隐私。无新账号/凭证/DDL/第二Loop。证据/后续边界见docs/goal/HARNESS_EXECUTION.md及apps/desktop/test-results/goal/harness-h09c3-20261021-receipt/progress.json，Goal ACTIVE。


## 2026-10-20 H09-C2 同步与过期操作（LIMITED_ACCEPTED）

复用已审HeroUI组件与浏览器原生fieldset，不改vendor/加依赖。现typed事件页、snapshot、主进程变更服务CAS继续作为记录/执行真源；不增加Codex CLI或新的Agent Loop。对账与下一步见docs/goal/H09_EVENT_UI_CONTRACT.md；精确证据apps/desktop/test-results/goal/harness-h09c2-20261020-accepted/progress.json。Goal ACTIVE，其他原验收仍OPEN。


## 2026-10-20 H09-C1事件界面

H09-C1继续复用现已审HeroUI ChainOfThought/Disclosure与现有原生details模式，vendor无改动、无新增包/服务/凭据。核验信息只取现有版本化公共证据，Pi唯一生产循环不改。 对账及下一步见docs/goal/H09_EVENT_UI_CONTRACT.md，精确证据harness-h09c-20261020/progress.json；Goal ACTIVE。

## 2026-10-20 教师课件交付

科普HTML交互之外，新增内嵌GIF的PPT课件与GIF文件导出；gifenc1.0.3 MIT锁定，现pptxgenjs复用，无Office插件或系统FFmpeg生产依赖。实际PowerPoint16.0 build20430验过；WPS安装存在但COM未注册，未改注册也未验播放。 说明和实例见docs/integrations/ANATOMY_TEACHER_PPT.md；准确证据见harness-anatomy-ppt-20261020-teacher/progress.json。整体Goal ACTIVE，下一步H09-C。

## 2026-10-20 Anatomy科普绘图

Anatomy固定MIT 1482e8469b0a9e0d8cc18ea2740a01423d29ae80，直接复用iso-kit，无npm依赖/生图密钥/CDN；全局完整开发技能保留。新增science-illustration和office_create_science_figure，HTML主演示、SVG备用。 详见docs/integrations/ANATOMY.md与harness-anatomy-html-20261020-reviewed/progress.json。整体Goal仍ACTIVE，下一步H09-C。

## 2026-10-20 H09-B 流式选区与阅读（LIMITED_ACCEPTED）

公开正文增量选区已沿原阅读host修复，按thread/item/前缀隔离；保留原滚动机制，无IPC/事实/权限/Loop变化。7d275058构建：浏览器10、原展开/焦点7+7、正式Pi6、renderer234、同构建legacy207及type/build通过，63源码hash当前一致。首失败、时序控制、冷启与视觉边界见[Harness执行记录](../goal/HARNESS_EXECUTION.md)。日常out未替换；1366暗色切换composer浅色差异待H09-C核，完整H08/H09/H10与原NET/IMG/FILE仍OPEN。


## 2026-10-20 H09-A 展开与触发焦点（LIMITED_ACCEPTED）

工具展开选择和触发焦点按thread/turn/call临时隔离，重新分组保留，主动移开不抢回。当前faf35686构建：jsdom7、浏览器组件7、正式Pi/DeepSeek5、renderer234、同构建legacy207及type/build通过；正式文件/回执/冷启贯通。正式浅暗4图已看，组件夹具只算浅色布局；无整页视觉一致/日常/无VPN接受。精确SHA、原失败、证据层和下一步见[Harness执行记录](../goal/HARNESS_EXECUTION.md)。H08整体/完整H09/H10和原NET/IMG/FILE仍OPEN；下一片阅读锚点与选区先反例再修。日常out未替换、未提交/推送。


## 2026-10-19 H08-C 来源与路径对照（LIMITED_ACCEPTED）

来源版本/权限/候选状态核对、有限路径shadow、原journal与工具回执身份对照及设置原规则回放已贯通；建议不改Pi工具/权限/事实，回执成功不代表产物/教学答案正确。最终16ab8e4a.../370文件构建领域24、正式Pi/DeepSeek9、组件217及type/build通过，56源码指纹仍一致、8张双尺寸浅暗图已查看。保留真实shadow首次8秒超时；原脚本/期限复测成功不认证网络稳定。legacy207属于补丁前32ec85构建，仅兼容旁证，当前renderer/preload与其逐字节相同。精确证据/失败/命令见[Harness执行记录](../goal/HARNESS_EXECUTION.md)及最新progress。完整H08/H09/H10、原NET/IMG/FILE和日常/无VPN/安装仍OPEN，日常out未切换、DT-05独立。

## 2026-10-17 H08-B 候选来源与采用（LIMITED_ACCEPTED）

复用原teacher-preference候选/评估/留出/版本/回滚，新增实际来源/学生绑定/goal重核和设置查看/本机复核/CAS拒绝。表达指标读取同一持久公共turn，避免只评末尾摘要；不使用私有思维，不改变教学事实。当前414cc39a.../370文件构建领域25、正式采用12/拒绝及学生绑定5、组件217、type/build通过，同构建legacy207及diff通过；8张双尺寸浅暗候选截图已查看。精确SHA、通用回归、首失败、剩余H08-C及日常等边界见[Harness执行记录](../goal/HARNESS_EXECUTION.md)。未新增依赖/DDL/第二Loop；日常out不变，DT-05仍独立。

## 2026-10-17 H08-A 策略审计更新

已贯通真实Pi呈现选择→现app_settings版本记录→typed IPC→设置记录/离线回放/显式DeepSeek shadow。spec v2区分撤销后的空值和历史revision，旧v1按原规则回放但不可新复核；shadow只对照、不改事实/偏好。当前冻结构建1aeb566c.../370 files，领域17、真实桌面11、组件217及type/build通过。精确命令、通用回归、四张已查看截图与未验边界见[Harness执行记录](../goal/HARNESS_EXECUTION.md)。H08整体、国产MCP认证公网、H09/H10、原NET/IMG/FILE/日常无VPN安装仍OPEN；下一片H08-B，教育DT-05独立，日常out未替换。

## 2026-10-17 Harness H07 更新

受控 MCP 首片按限定证据接受：设置管理→typed IPC→加密CAS→唯一 Pi 工具/回执/冷恢复；当前28项专项、8项正式Electron/DeepSeek、217项组件通过。固定教育/记忆身份不包含动态MCP目录。日常out未替换，国产认证公网实例/无VPN/安装/原NET/IMG/FILE及H08–H10仍OPEN。精确构建、首次失败、兼容回归范围和下一步见 [Harness 执行记录](../goal/HARNESS_EXECUTION.md)。服务配置申请见 [服务清单](../integrations/SERVICE_REQUESTS.md)。本节是独立Harness线程更新，不重排教育DT-05。


## 最新指针（2026-10-17）

以下2026-10-16旧快照仅保留历史。EV-MAIN-02与DT-03/04已按各自范围限定接受；当前为DT-05，review已17/17，仍待视觉、practice与photo闭环。智能组卷移出当前队列。真实证据、SHA和唯一下一步见 [Goal 当前状态](../goal/CURRENT_STATE.md) 顶部；本轮无架构或业务代码变更。

<!-- handoff-current-20261016 -->
## 最新状态（2026-10-16 上下文保存）

唯一继续入口：[Goal 当前状态](../goal/CURRENT_STATE.md)。Master ACTIVE，Phase 4/5/6 DOING；智能组卷移出当前队列。

已撤回回显型提示/视觉工具注册及伪设置重置/历史入口，保留真实 OCR/教师校正和聊天撤销。确认/致谢误判已修；EV-MAIN-02 正式 n1lZ85 仍失败（表格计算未被步骤计数识别），不能升级为验收完成。领域15/15、组件217/217及通用smoke通过有各自范围，不替代专项。

下一步：EV评价表达覆盖/真实教育工具组装→留出/采用/冷恢复/视觉→DT真实协助/独立/视觉证据→MA逐字讲稿/导入。既有DT/MA/EV均为限定接受；原历史按其当时范围解释，详细SHA、失败报告、命令与边界集中在Goal状态和验收记录。本轮仅保存文档，无生产修改或新模型调用。


<!-- context-reconcile-20261016:start -->
## 2026-10-16 上下文恢复与状态纠偏

当前阶段与唯一继续队列见 docs/goal/CURRENT_STATE.md（从本文件按仓库根解析）；智能组卷移出当前队列，三主线继续。EV-MAIN-01 是明确偏好子片限定接受；EV-MAIN-02 隐式反馈仅有领域例 13/13，缺正式留出实例。DT 新 hint/visual 工具与偏好设置 IPC/UI 标 NEEDS_FIX：回显模型 OCR/置信度不是验证，清 React 状态不是持久化重置，重复读 head 不是真实历史。MA 讲义/备课稿四导出限定接受，逐字讲稿/导入仍 OPEN。

本轮只审查和整理文档，未修这些生产代码、未重跑业务验收。先冻结修复合同解决上述缺口，再 EV 正式 --implicit→DT 协助/独立/视觉闭环→MA 讲稿/导入→联合与 Master 其余门禁。未宣称完整 DeepTutor/OpenMAIC/Hermes 或 Phase 0–3 全部完成；历史记录按其当时范围保留。

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

Done：StudentTrainingView.results增加由原source version派生的16hex作答引用，现typed IPC/preload自然承载；每条结果旁新增HeroUI“复盘这次作答 / 继续讲解”，复核当前列表后准备可编辑草稿，沿用该学生已有会话，不自动发送。现education_analyse_learning可按trainingResultReference唯一解析本学生已确认计划中的真实记录，指定记录优先占用原20条来源槽位，即使不在知识点最近3条也返回；观察脱敏上限为原2000、逐题作答沿现practice格式、原来源版本/链接保留。未知/碰撞/编辑/删除/换学生拒绝，读后原fingerprint/策略/授权CAS仍有效。历史计划按确认版本区分；sourceCurrent=false仅证据基线改变，teacherAssessmentVerified仅独立掌握门禁，不否定已保存观察。无新Agent/DDL/依赖/事实真源/IPC。

Reuse/Compare：实际沿用固定f07029c Apache-2.0原DeepTutor纯mastery/scheduler/grading及受控models/policy投影，唯一Pi不变；HeroUI官方Button已核。官方raw HTTP200取到当前main五份代码并存hash/diff，mastery/grading相同；scheduler新增同一修复阶段防重复lapse，models/policy新增提示协助/独立作答/视觉任务。对应证据合同当前未齐，未伪填或升级原文；GitHub API403未核最新commit。下一DT先冻结协助/独立/视觉证据再固定上游提交适配，不复制完整上游runtime。

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

<!-- ev-feedback-status-20261015:start -->
## 2026-10-15 当前：三主线已交付首批功能，下一 JOIN-01

Master ACTIVE；Phase4/5/6 DOING。智能组卷已移出当前队列。DeepTutor 阅读/笔记续接与学习计划辅导、OpenMAIC 课堂生成/直接编辑/教师确认/PPTX交付已分别限定接受；本轮 EV-MAIN-01 普通反馈偏好子片 LIMITED_ACCEPTED，不称三项目或自进化全部完成。当前任务转 JOIN-01 三主线共同使用。

教师现在可直接说“以后讲解详细些，分步骤，先给提示再给答案”，后台生成固定枚举偏好，经本地合同评价/版本/CAS保存；新会话自动采用，重启保持，普通聊天“撤销上次记住的教学偏好”追加回滚版本。只复用同一Pi的protectedContext、原app_settings/私有事务与普通聊天；无新Agent、DDL、IPC、模型调用或依赖。当前请求优先，不把学生事实/答案/授权当偏好，原始反馈不复制到模型动态上下文。

Evidence：apps/desktop/test-results/goal/hermes-20261015/{progress.json,commands.ps1,before,research}。最终正式Electron hbi02B：4/4、2次启动、4次真实Pi/DeepSeek回合、0renderer错误；普通反馈→新聊天顺逆流多步讲解→冷恢复→撤销→新聊天已撤销上下文，SQLite/native记录均核对。build cd493923b0ba0ea4a4f4e7157671aeedee4acd6f323d9912bfc627b4bf3175bc /366，前后相同。build/type exit0、组件217/217、领域contract-h9aufY 8/8、diff exit0。浅1366/暗1920截图已实际查看，消息区可滚动。

首次h15FB0实际已保存偏好，但模型又询问详细档位形成waiting_input；已修动态上下文明确保存成功、不重复问档位/技术配置，最终实例通过。否定表达反向匹配、旧TS库Object.hasOwn及生产SQL私有接口差异已处理，失败现场保留。Hermes HEAD0a929e3aa20e15cf04dc7c28492a7d41a5139125源码已读；README/pyproject声称MIT，许可原文仍未取到，因此仅参考候选/评价/版本/回退思想，未复制其代码或安装GEPA/DSPy。

边界：本片只验明确中文表达偏好；评价是枚举合同一致性，不是教育正确率。隐式修订信号、留出效果评价、routing/retrieval优化、效果下降自动回退仍OPEN；表格/导出偏好未逐项真实交付验收。完整DeepTutor各模式、OpenMAIC PDF/DOCX/导入、全科图义正确性、安装/容量/无VPN仍OPEN。HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63 dirty；远端TLS失败未核，无commit/push，独立Harness及真实数据/配置/凭据保留。

Next：JOIN-01先复用资料阅读/学习计划的上下文、现课堂工具与Office宿主，补“同一资料/学生→辅导→互动课→教师修订→教学文件”缺口；保存当前偏好版本与真实来源，不追加第二运行时或自动学习事实。完成接缝实现后仅一组联合实例；随后DT剩余模式→MA交付/导入→EV隐式反馈与留出评价。回滚仅撤本片观察/注入与新增领域文件，保留偏好历史与原教育事实。
<!-- ev-feedback-status-20261015:end -->

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


<!-- dt-path-status-20261014:start -->
## 2026-10-14 当前：计划续接限定接受，下一 MA-MAIN-01

DT-MAIN-02已确认计划续接子片 LIMITED_ACCEPTED；Master ACTIVE/Phase4/5 DOING。全历史当前计划进度、四模式草稿、当天结果、同学生Pi上下文和冷恢复已接原主进程/typed IPC；不将已记录判为掌握。最终build/type0、组件217/217、定向8项、正式Pi/DeepSeek4项/2启动/0renderer错误；最终只读浅1366/暗1920图已查看（原缩放残影图不接受）。完整边界、首次现场、SHA与命令见 CURRENT_STATE 及 apps/desktop/test-results/goal/dt-path-20261014/progress.json。下一直接OpenMAIC互动课，再Hermes；组卷移出当前队列。

复用：固定DeepTutor1.6.13/f07029c Apache2纯学习源码/Worker（本地hash完整性8例之一，不声称最新版比对）、现Pi学习分析/核对、StudentTraining/PiTrainingPlan/Button。OpenMAIC已有固定包审计资源可沿用；下一核DSL/renderer/generation依赖闭包并落教学内容，不再只做包探测。
<!-- dt-path-status-20261014:end -->


<!-- dt-reading-20261014:start -->
## 2026-10-14 阅读续接交付，下一 DT-MAIN-02

DT-MAIN-01 版本化逐段阅读/笔记/重启恢复/当前段落辅导入口 LIMITED_ACCEPTED。Master ACTIVE，Phase4/5 DOING；智能组卷已移出队列。下一 DT-MAIN-02 个性化辅导与学习路径→OpenMAIC 互动课→Hermes 无感反馈。

Evidence：apps/desktop/test-results/goal/dt-reading-20261014/progress.json（最终同build正式4项/2启动/0 renderer错误；组件217/217、6项定向实例；实际浅1366/暗1920图审）。复用此前通过实际UI导入/OCR的真实物理扫描事实；本次不重复OCR。原图/笔记不上云、旧版本/笔记不覆盖；LLM讲解未独立判正确，完整沉浸阅读/全DeepTutor仍未完成。详细结果与首次失败见 CURRENT_STATE 和上述 progress.json；无提交/push、正式数据或凭证修改。

复用：固定DeepTutor reading search/models及现搜索/来源能力；新增UI用既有Markdown/Button/TextArea、原件预览和导航；Pi仍唯一执行。DeepTutor本例不额外调用搜索Worker；未复制新上游或安装包。OpenMAIC许可本轮官网MIT已查看，尚未迁移课堂；依赖闭包另卡固定。
<!-- dt-reading-20261014:end -->

<!-- feature-priority-20261012:start -->
## 2026-10-12 功能优先执行中

功能优先规则保持；F1页面文字位置→真实Pi候选本片限定接受，完整识题质量仍DOING。已不再是上一轮仅文档规划状态。当前真实结果、首次失败、边界与下一项见下方kb-s6-current和FEATURE_FIRST_EXECUTION.md；历史Next不覆盖当前队列。
<!-- feature-priority-20261012:end -->

<!-- harness-execution-20261012:start -->

## 2026-10-15：S1/F07 原位置交互与 BoardUI 复核

M10/M12；Master/Goal ACTIVE，H04 DOING，本片限定接受。问题、回答、复制/文本/产物/教育核对沿原组件及回调，按原runId/callId回到对应工具后、下一段正文前；工具组在卡处切开，未知旧锚明确保留在“其他交互记录”。Learning/Collection只读补已有callId；原题批组补已有rootCallId并仍聚合一组。无新DDL/IPC/依赖/循环或上传授权。

固定2df5ce828d1787ccf6eb3e06944d151b505024ac3675fb285492abb5d9d298e5/368：正式Pi/DeepSeek提问、回答、复制批准/拒绝、刷新/切会话、正常退出/真实自有进程崩溃分开验证，9jyRZp 8/8。原公开合成图Dg1XGd 13/13，独立先查看PNG冻结gold，真实图hash/HTTP200/验证码及形状位置一致；冷恢复原位置YZ2lO3 3/3，包括相同回答幂等、冲突回答拒绝且无新run/native。浅1366/暗1920图已查看。

renderer11、领域98、BoardUI复核8、独立SQLite/native/文件/图/源码manifest读回5、组件217、隔离legacy教育smoke207均通过且exit0已收取；type/原vite配置隔离build exit0。BoardUI6文件原/适配hash均一致，仍由host真实状态和来源驱动。不是模型自评；未把图片送达当成所有识别正确。

首失败cAPgAK与j2yCK0保留：前者复现旧尾部定位，后者是测试误把正常退出当崩溃恢复；生产正常停止规则未放宽。旧学习夹具缺collections只补fail-closed测试依赖；SSR复用实际classroom-preview构建器。收尾production-host出现并行源码漂移，未覆盖；本片证据只对应固定构建，不归到最新main/共享out/安装包。

证据与精确命令：apps/desktop/test-results/goal/feishu-inline-20261015/{progress.json,progress.md,commands.ps1}。原日常IMG/FILE反馈、用户原图、无VPN、全业务卡真实UI/全部H04 golden、完整12路及H05–H10仍OPEN。下一步S2：先核“2”的实际来源，再冻结安全只读12路；F05/A13无callId队列保留原入口，不能猜定位。无commit/push。

本文件口径：BoardUI原6展示文件/原NOTICE/manifest保留，6对hash本轮复核一致。宿主状态/来源控制展示，原typed IPC来源入口，Pi唯一生产循环不变。


## 2026-10-15 当前：S1双栈虚拟DNS修复，真实联网与日常配置验收

本线程当前按已读飞书F01/F03推进；Master/Goal ACTIVE、H04 DOING。先冻结FEISHU_NETWORK_STREAM_CONTRACT.md，再保留8a7854/uNiBhh首失败：auto/enabled下搜索/正文/浏览器均权限拒绝，工具网络尚未发出；流式/停止/冷恢复原已通过。系统实际返回28.0.0.x与fdfe:dcba:9876::配对，本机clash-verge/mihomo进程存活；不凭此修改系统代理。

只改原office-network的完整配对识别，继续用原固定国内DoH取得真实公网IP并校验/固定连接。真实私网/混合/单独ULA继续拒绝，显式system仍拒绝，28/8单独公网结果不猜成代理。Pi/Hana/typed IPC/SQLite/教师与来源边界保持，无新依赖/DDL/第二循环；主进程其他并行教育代码未编辑。

冻结b7fabbd461828bd356a90db1b3d654c19c33e5316d5b35ecf777e329764c9a9c/368：正式Pi/DeepSeek iueWOd 5/5 exit0（真实搜索→教育部/西藏政府两正文→实际内置浏览器/PNG→停止→冷启）；真实回复481增量、71次运行中DOM增长，首DOM早于终态。17 DNS边界、15 web边界、组件217、隔离legacy smoke207均exit0。标准npm run build及type也exit0。

实际默认日常profile、原加密DeepSeek配置/auto DNS，在相同固定b7候选上的pi-daily-network-ui-EXQIYv 4/4 exit0，搜索两正文、实际内置页与截图、刷新readback通过；只通过UI创建公开政策对话，不种业务夹具、不改凭证/资料。隔离及日常各3项独立读回核验通知落款3月25、网页发布4月21、秋季实施/两URL及原PNG大小/hash。不是模型自评，答案语义仍保留人工范围。

日常共享out的5e9754测试先过3项后因测试错误假定纯web树失败；实际是update_plan+web混合组沿原视图。随后另一构建把out换为c95a17，恢复脚本SHA门禁正确拒绝，未覆盖或放宽。最终用不可变b7候选+真实日常profile重验，**不声称当前共享out/安装包已验**。首失败、测试路径/loader/定位错误均保留。固定build测试期间不变；收尾并行source漂移apps/desktop/src/main/xiaozhi-agent/office-artifact-service.ts，原样保留，不把本片结果归到它们的新代码。

证据/命令：apps/desktop/test-results/goal/feishu-net-stream-20261015/{progress.json,progress.md,commands.ps1}；实际浅1366/暗1920与原浏览器截图已查看。用户原图/文件、无VPN、当前共享out/安装/Office、完整12路、旧领域golden失败与H05–10仍未完成。下一步优先飞书F07：提问/审批/教师回答按callId回原位置并真实恢复验收，再S2安全12路；不可退回“等登录”或因本片通过关Goal。无commit/push。

### 此前Harness记录（保留历史证据）

## 2026-10-15 最新：飞书需求已读，BoardUI复用限定交付

本节覆盖本线程旧飞书登录BLOCKED记录，原记录保留为历史。用户登录后实际读到《任务清单》三组10条，已先写docs/goal/FEISHU_REQUIREMENTS_SOURCE.md、FEISHU_REQUIREMENTS_PLAN.md（F01–10、S0–5、A01–31），再按用户“源码可以直接复用”指令冻结BOARDUI_REUSE_CONTRACT.md并实现M10/F06小片。原Master/线程Goal ACTIVE、H04 DOING；未完成全部飞书或H01–H10。

直接复制用户桌面boardui-web-search的WebSearch/types/CSS/timeline/brands/index到renderer/vendor，保留NOTICE及原/适配hash；箭头复用已有lucide，无新依赖/字体。OfficeToolProcess仅新增只读WebSearch分支，OfficeWebSearchProcess读原projection/真实状态/来源/已记录耗时；原ToolStep错误/重试/未知效果及混合教育/浏览器组回退保留。未引入App/demo-data/输入框回填，不以动画onComplete结束业务。没有本片main/preload/DDL/权限/第二模型循环变更。公共事件缺实际查询词时不从模型话术猜出查询。

正式隔离构建SHA 6c810e5802964b7262b4b6d36314ade02d60256608c3f376e9fae2b0a5d26ec9/366：真实Pi/DeepSeek桌面84bf4G 9项、键盘/减少动效5olBSy 2项、状态边界8项、原attempt边界5项、组件217/217、隔离legacy教育smoke207/207；这些最终进程退出码均已实际收取0，type及原配置隔离编译exit0。浅1366/暗1920与键盘焦点截图实际查看；未把整个npm run build/test:smoke串联说成运行过，精确等效命令在apps/desktop/test-results/goal/boardui-20261015/commands.ps1。

真实例仍区分受控首页403（保留一次失败）与实际教育部备用通知HTTP200正文；正文/答复独立核对2022-03-25落款、2022-04-21网页发布、秋季实施。整体partial/answer:human保留，SQLite/native/journal/刷新冷启一致。来源沿原typed IPC校验后实际shell.openExternal交接系统浏览器，未验内置浏览器页面；不是两来源搜索或联网整体修好。冷启最早阶段零请求仍无独立观察。

首失败均保留：构建路径漏build-isolated属于启动设置错误；SSR错误期望单工具仍有group；TJ2Czx三项后错误假设同turn一个树；m1o3pA三项后错误等待Electron新窗口。按真实callId、原单工具回退及shell交接修正测试后重测通过，没有伪造产品成功或修改网络策略。

证据范围固定为该不可变构建。本片renderer编译后未改；收尾清单检测到并行源码漂移：apps/desktop/src/main/xiaozhi-agent/pi-session.ts、apps/desktop/src/main/xiaozhi-agent/office-artifact-service.ts。未覆盖它们，也不把本片结果冒称这些更新实现的验收。仅新增本线程状态，不改其他教育分支段落。日常NET/IMG/FILE、用户原图、无VPN、实际12路调度、输入框/内联问题全量、安装/人工Office及旧领域golden54后FAIL仍OPEN。

下一步按已读飞书S1：从日常同构建/配置复现真实搜索/浏览器和流式首增量，修证实根因；补callId内联补充/确认，之后S2安全只读12路、S3输入框与少追问，再按S4/S5题库/模板。旧“等登录”不再是下一步，不回退优先级。不修改真实学生资料/系统VPN/日常配置凭证，不提交/push。

### 以下为此前Harness历史记录

## Harness H04-A 工具边界与正式页面限定接受（2026-10-14）

方案B/Master/工具Goal仍ACTIVE。H02/H03保持此前限定接受；H04-A LIMITED_ACCEPTED，完整H04及H05–H10未完成；日常NET/IMG反馈保持OPEN。

本片交付：现Pi dispatcher统一manifest/input/output/错误/工具等待边界，复用Hana执行一次与取消registry、OpenMAIC 636fab0 MIT timeout；Pi仍唯一循环。仅公开网页读取/搜索safe_read最多两次，401/403/权限不自动retry，写入/上传/浏览器/缓存读取不自动retry。资源锁在实际底层结束前保留，超时/取消只结束等待，不能证明外部效果已停止。teacher budget.wait暂停active deadline。typed tool_attempt→journal/barrier→projection→现Pro工具卡→SQLite/重启；未知效果写existing effect_state=uncertain，native失败不能抹掉unknown，不增加事实表。

修复真实注册缺陷：旧Hana文件dispatcher误包含已启用联网名称，导致重复工具注册。现仅legacyNames进入旧dispatcher，授权webTools单独注册一次；SDK实际组装2项通过。首个正式冻结ef01fc0/366的网络/图片/文件四FAIL均保留，不称无效API Key。并行课堂增加education_read_classroom及manifest已保留，不覆盖其源。

证据：当前冻结0ecb4653557542c3c4c4d110812e4c18a00900772c1b653c99f7aa32e38127c4/366，current UI KLOtFp 8/8，含真实DeepSeek、第一次受控HTTP503→实际官网200、403零自动retry、同call原生单结果/SQLite/页面刷新/正常冷启、真实停止按钮与迟到响应丢弃；浅1366×768/暗1920×1080真实颜色及PNG已查看。稍早registration冻结0a044776fe7dd09849e15d220e9d33fbfa5faebd9dba718fe5cd90d33d70f873/366：dYig9f UI8/8、实际main强退/确认文件/终态拒写VnmYpl7/7、自然baseline qzj69k四PASS（network20/image13/file15；总NOT_ACCEPTED）。两build分开，不声称所有证据同版。

source定向反例17/17、真实SQLite attempt6/6、SDK注册/许可证2/2、attempt SSR5/5、receipt15/15、event19/19、native10/10；当前type与孤立vite构建exit0、renderer217/217。registration build legacy最低smoke207/207，仅历史test-runtime，不冒充Pi实例。原始报告/日志/构建和复现命令在apps/desktop/test-results/goal/harness-h04-20261014；测试样例说明书新增TOOL-01–09。未改凭证/系统DNS/VPN、未上传真实学生资料、无新增Harness依赖、无commit/push。

网络状态来自用户答复VPN/代理运行中；四例恢复不证明长期稳定或无VPN可用。UI故障注入明确只在自有测试main，不是供应商自然503/403。当前源码与列出的当前冻结Harness文件一致，未对未列并行教育源码或日常out/profile作可复现承诺。

H04-B既定缺口（历史计划）：补交付前memory/permission/admission/attempt等待的取消和截止、shutdown；先审教育导出等写文件工具的跨会话workspace锁与领域源版本/效果读回；贯通实际替代来源与领域golden。现硬等待race只包def.execute，交付前关键await未全部有界，不得称完整H04完成。写后unknown只读核对；保留全部首次失败。完成H04后才H05，日常D/无VPN/E安装/Office人工继续OPEN。

集成：OpenMAIC固定636fab0 timeout MIT，完整license/source-manifest随构建保留；Hana Apache-2.0现registry与执行一次；Pi1.0.2五参context透传。Harness本片无新增依赖，其他并行教育依赖不属于本片结论。


## H04-B1 当前继续位置（2026-10-15）

H04-B1 LIMITED_ACCEPTED；H04 DOING、方案B/Master/Goal ACTIVE，H05–H10未完成。此前 H04-A 记录为历史证据，不表示日常原故障已关闭。

已交付：工具 pre-delivery/checkMemory/started-attempt 纳入原 OpenMAIC race；终态 attempt 有最多15秒的关键等待，关键失败封闭 publisher 并停止交付。caller cancel 不冒充持久化失败；迟到准备不能调用工具。工具执行前等待共享该工具 manifest 的 active deadline，teacher wait 仍暂停时钟；取消仍可立即结束等待。真实底层未结束时保留锁。education_export_paper/classroom 使用宿主授权的实际输出目录锁，与同目录普通文件写入互斥。取消后无最终 attempt 的 admitted 非只读失败保持 uncertain/needs_check；独立效果 matched 可解决，纯读失败不虚构效果。Pi仍唯一循环，无新schema/依赖，不改变教师确认或来源事务。

冻结 68de755f663f3d61c81c996c49430d0b1ac44946fdc75f477b4279939d7f95cb/366，正式 UI pi-tool-execution-ui-aax7Qo 10/10：真实 DeepSeek、受控503后实际官网200、403不自动retry、停止/迟到丢弃、补拉/冷启、浅1366/暗1920截图已查看；正常关闭受控卡住GET耗时1839ms，未回答问题退出及冷启无重放。仅这两条正常shutdown，不当作批准后写入、DB挂起、全部退出或实际崩溃。

首次完整baseline my0oOg（旧本片bcc94b08/366）NET-01/02与FILE-01三PASS，IMG-04 FAIL/native exit1且整报告保留：准备取消的泛化unknown文案使模型误认新任务仍停止。修复把公开图片工具归本地准备、保留有阶段含义的取消回执；真实上传仍独立回执，绝不复用批准或自动retry。当前冻结pi-public-image-ui-4KgjsA15/15使用原盲图片/原自然输入重新走确认、送达、核验码/图形、拒绝、停止、冷启、utility终止和供应商故障反例，另实证停止用途卡后同会话新确认、实际200/received、盲码及独立回执核对，不拿冷启代替它。旧三PASS和当前图片复测分构建，不拼成同版四PASS；日常反馈/完整最终基线尚未签认。VPN/代理状态来自用户答复运行中，未证明无VPN。

source受控等待/图片取消9、工具17、SQLite attempt8、receipt15、journal19、SDK2；type及原vite配置孤立构建exit0，组件217。legacy最低smoke207仅旧test-runtime，跑于本片bcc94b08，不冒充当前Pi或图片实例。正式UI的Playwright观察GC错误原样保留，原同进程重读而不吞产品异常；首次tsc缺details错误保留，修正后type0。列出的Harness源码与冻结摘要一致，不承诺未列教育源码或日常out/profile同版。

证据与精确命令：apps/desktop/test-results/goal/harness-h04b1-20261014；测试样例说明书TOOL-10–15。上一片及第一次构建/类型错误不删除；未改密钥/系统网络/真实学生数据，无commit/push。

下一唯一Harness切片：H04-B2：处理启动/模型准备与关键 DB 等待中的停止及退出；审计全部领域工具的源版本和副作用读回；正式 Pi 在第一来源失败后使用授权替代来源并独立核对。完整 H04 逐项有证据后才进入 H05；日常旧会话/原图片、无 VPN、安装与 Office 人工继续 OPEN。


## H04-B2 当前继续位置（2026-10-15）

本轮推进准备/模型交付/正常退出等待；H04-B2、H04 DOING，Master/方案B/Goal ACTIVE；不缩小 F_NEXT_GOALS 的 H01–H10 或完整 H04 定义。先前片次为历史证据。

直接复用已审 OpenMAIC race，通过 lifecycle-wait adapter 保护 Pi 创建的异步权限/资源/SDK等待、当前事实/记忆/上下文及模型 journal gate；一般关键等待15秒，宿主停止/关闭清理整体5秒。Pi仍唯一循环，typed stop/失败投影/冷恢复沿原入口，无新schema/依赖或权限。模型请求未交付时停止可结束等待；迟到返回不得获得新轮权限。race不保证同步主线程死锁可中断，也不撤销已经开始的SQLite原子写或外部效果，未知写入由冷恢复核对。

源码专项 lifecycle 5、原工具 preflight 9；正式生命周期UI 6、正式联网/工具UI 10 均通过。主进程受控 signal-ignoring 准备等待只安装在非打包、明确E2E、owned test-results/temp profile/data；可见停止零chat请求、迟到返回零补发/事件、新轮真实DeepSeek200及独立随机码、准备时正常关闭350ms后冷启零重放、15秒失败门禁。该等待接缝不是实际SQLite死锁或全部退出证明。1366/1920失败、浅暗工具截图已查看。

冻结build b64f0fa67d4db1894a80918238c68e52563236fba76f8c04021f900d906ec60a/366；当前baseline u0oqDG的NET-01、NET-02、IMG-04、FILE-01四个隔离正式实例PASS，各套全部通过，runner应exit2且整体NOT_ACCEPTED，日常/无VPN/原用户故障未关闭。原my0oOg三PASS一IMG失败与本轮khZYvD四项后失败均保留；首次type因闭包未保留key的非空类型返回2，已修为验证后的局部变量；准备超时曾错误降成model_error，修明确分类后同专项5通过。非模型自评，未覆盖失败。组件217、旧legacy smoke207、type与原vite配置孤立构建通过；legacy不是Pi验收。命令/报告位于apps/desktop/test-results/goal/harness-h04b2-20261015。源码列出的Harness文件与冻结一致；不证明日常out/profile同版。

图检索无当前wait节点、已有db snippet行号偏移；按已定位源码回读补证，不声称穷尽调用图。用户声明VPN/代理运行中；未修改系统网络、日常凭证/out、真实学生数据或其他教育块，无commit/push。

下一唯一Harness继续位置：继续 H04-B2：真实 DB 队列/命令创建及已确认写入中的停止退出；逐领域源版本/副作用读回与 golden；首次来源失败后的授权替代来源实例。逐条完成完整 H04 后再进入 H05–H10；日常旧会话/原图片、无VPN、安装和人工Office仍OPEN。


## H04-B2 真实数据库等待进度（2026-10-15）

M10/M12，H04-B2/H04 DOING、Master/Goal ACTIVE。生产 start 的异步恢复/读取和普通命令创建复用生命周期 adapter；停止从入站起持有 controller，迟到 claim 按 command/conversation/hash 条件置 interrupted，不得重新绑定任务，终态事实保留。普通任务/消息写入后不再获得新模型交付权限；排队 SQL 本身没有被 Promise race 撤销。退出开始后不补排取消写入，已提交事实由现有冷恢复核对；无新 schema/依赖/权限/第二循环。

真实第二 SQLite 连接 BEGIN IMMEDIATE 持锁，主进程实际 claim SQL 发出被观察，教师使用发送/停止按钮；同冻结构建数据库UI4、准备UI6通过。数据库 stop 的按钮/IPC观察 2756ms，正常退出 5812ms；解锁后零新增任务/消息/provider，独立新请求真实200及随机码，冷启零重放。1366/1920恢复截图已查看。命令条件中断3、SDK生命周期5、工具preflight9；type/原vite配置孤立构建通过，组件217、legacy207（旧test-runtime，不是Pi验收）。

当前冻结 dd2adb918751d2ba23052b853205c065384b4418a7ee528f0f78f0292fde4f68/366，baseline LAJ6Uo 的 NET-01/02、IMG-04、FILE-01 隔离正式实例四PASS，整体仍NOT_ACCEPTED/应exit2；日常用户反馈、无VPN均未签认。原 jfaEoz 在实际 claim 写锁下停止失败保留；pZUJs6 是测试脚本把空输入的发送禁用误作未恢复；K14WXF 正常退出10795ms超原上限保留；observer动态import失败和错误tsconfig路径也保留并明确属于测试设置。没有用模型“通过”评价判定。证据/命令：apps/desktop/test-results/goal/harness-h04db-20261015。

未修改日常out/profile/凭证、系统VPN、真实学生数据或其他教育块，无commit/push。图中旧DB snippet偏移和新工具缺节点已用已定位源码核对。没有证明同步主线程死锁可打断、全部 DB/附件/领域等待已覆盖，也没有以此结束完整目标。

下一继续位置：继续 H04-B2：教师确认后 file→fact 切断恢复；逐领域源版本/副作用读回与 golden；首次来源失败后的授权替代来源实例。附件原子接收和执行终结 DB 等待仍需逐阶段反例。完整 H04 有证据后才进入 H05–H10；日常旧会话/原图片、无VPN、安装和人工Office仍OPEN。


## H04-B2 文件到事实中断恢复进度（2026-10-15）

M10/M12，H04-B2/H04 DOING、Master/Goal ACTIVE。正式页面首失败 lJ2N0v 与真实 SQLite/文件反例 lUBeTx 均证明：文件已安装后停止仍 committing。生产复用 OfficeArtifactService/State、Pi 文件 mutation queue 和原 saved SQLite trigger；invalidateRun 将 committing 条件置 uncertain，file 等待返回后复查取消/执行权，阻止迟到 saved。已落盘文件保留；教师只读核验原 hash/size 后登记一次，教师改动显示 conflict 并保留改动。没有新增 schema/依赖/授权/第二 executor。

冻结构建 339dccef1c82ffad185d0ce3d7b4bd8e6a41104a049e3ec5774a189ffd5d6ea4/366（原 electron-vite 配置孤立目录），Office service/state/IPC 均纳入 source SHA；type/构建 exit0，组件217、旧legacy207 exit0（legacy test-runtime不是Pi验收）。真实正式 Pi/DeepSeek 页面8项 exit0：实际自然请求与教师确认、file切断停止、信号忽略的迟到返回无事实/模型/原生/公开事件、教师核验、正常退出565ms、实际 owned taskkill/cold、教师改动反例、二次cold无重放。真实文件页面本轮实际14项 exit0（基础模式，按报告计数），独立 python-docx读回与实际Word预览/重启；领域原Office golden17、file-stop5、effect-readback34 exit0。1366/1920恢复截图已查看，停止/冲突提示明确，未把任务回复当通过。

原失败报告全部保留。cfcnmZ是测试菜单角色定位错误；NOGiTx前4项通过，强制结束后测试观察器在正式应用恢复前只读数据库报disk I/O；改为结束前捕获native prefix、cold应用初始化后读回，完整8项复测通过。loader静态import早于注册的设置失败也有记录。没有删除数据库/journal或跳过强制结束断言。精确命令、报告、首次失败与截图：apps/desktop/test-results/goal/harness-h04office-20261015。

本轮VPN按用户所述运行，未改系统网络/日常out/profile/凭证/学生资料；日常真实反馈与无VPN尚未签认。上一轮 dd2adb 构建的联网/图片基线是历史证据，本轮339dc构建只完成这里列出的专项复测，不合并成当前全基线通过。人工WPS/Office打开未执行。其他教育域脏改动保留，无commit/push。

下一继续位置：继续 H04：逐领域源版本/副作用读回和原行为 golden；首次来源失败后的授权替代来源真实实例。附件原子接收、执行终结数据库等待仍需逐阶段反例。完整 H04 有证据后进入 H05–H10；日常旧会话/原图、无VPN、安装和人工Office仍OPEN。


## H04-C 授权替代联网来源进度（2026-10-15）

M10/M12；Master/Goal ACTIVE，H04 DOING，本片授权替代来源实例 LIMITED_ACCEPTED。没有修改生产代码、schema、授权、模型循环、依赖或日常配置；复用现Hana Web、Pi、attempt journal、native正文readback、typed snapshot与核验组件。冻结339dc构建 339dccef1c82ffad185d0ce3d7b4bd8e6a41104a049e3ec5774a189ffd5d6ea4/366 实际加载且前后不变，已有记录的Harness source SHA仍一致。只新增专项验收脚本与说明，不以本轮重新完成构建/组件/legacy门禁；这些生产门禁沿上一轮记录为历史证据。

真实正式Electron UcRk8C 8/8，实际观察exit0：自然请求先读教育部首页，实际undici GET受控403且仅一次；同一run按教师授权读取准确通知 http://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html，实际网络HTTP200，成功响应和模型未伪造。原生模型元数据 provider=xiaozhi_deepseek/model=deepseek-flash/api=openai-completions；不是另一次服务器模型名探测。实际正文/最终回答独立核对2022-03-25落款、2022-04-21网页发布日期、2022秋季实施。主进程source readback通过，但整体仍partial、保留1成功/1失败和answer:human；绝不将正文hash核对说成答案全自动正确。

原403 callId/attempt1无重试/失败仍在UI、native单结果、SQLite receipt/journal/assistant metadata；另一来源URL/observedAt/body与核验范围对应。只允许失败首页且明确禁止换源的第二轮只发一次403、blocked无成功证据。刷新及cold保留精确历史、native字节和metadata，不重放工具/模型。1366×768/1920×1080失败与替代核验截图已查看，操作可滚动到达。相关源码反例 result-readback20、verification25 exit0；不是daily/VPN-off或全部领域golden。

首轮MD4qmc（exit1/0项）完整保留：测试初拟备用URL为t20220421_620011，并未成功读到正文，应用正确显示两项失败/blocked。依据上一轮真实NET报告定位准确t20220420_619921地址再测，不填造成功响应。初稿未在失败前存transport，故不声称原响应具体HTTP状态；本轮新增失败分支保存transport，未覆盖原报告。顺便核对测试文案使用正式组件已有“网页正文与本轮保存记录一致”。外部搜索工具一次429是研究工具故障，不作为小智测试结果。

证据/精确命令：apps/desktop/test-results/goal/harness-h04alternative-20261015。用户声明VPN/代理运行，未更改系统网络、日常out/profile/凭证、真实学生资料或其他教育域脏改动；无commit/push。全项目联网/图片/文件日常反馈仍OPEN，不因本片通过清除。

冷启的网络观察器在页面就绪后安装；本片直接证明native/SQLite无重放、就绪后观察窗口无新模型/工具事件，启动最早阶段零网络请求仍需更早的独立观察证据，不能据此宣称全启动窗口零GET。

下一继续位置：H04-D：按生产注册清单逐领域核对 source/effect 原行为 golden，补附件入站原子接收和执行终结SQLite等待的停止/退出反例。完整H04满足DoD后进入H05–H10；日常旧会话/用户原图、无VPN、安装和人工Office仍OPEN。


## H04-D 终结等待与附件原子接收进度（2026-10-15）

M10/M12；Master/Goal ACTIVE、H04 DOING，本片 LIMITED_ACCEPTED。正式旧339dc构建 zpolSU 首失败已保留：真实 sqlite3 assistant INSERT 在第二 SQLite BEGIN IMMEDIATE 下等待时点击停止，放锁后仍 completed/run=succeeded/command=finished。不是模型自评，也不是 HTTP200 代替用户操作。

修复仅新增现 journal/publisher 的终结取消校正与内部 terminal-cancellation adapter；production-host 注入同 run 停止信号。当前 owner/generation 的同一 SQLite 事务更新中断核验、run、消息metadata、command、usage、finalize记录及目标未完成状态，保留实际回复/工具结果/原事件审计；COMMIT回调期间收到停止则先校正后发布。校正失败回滚、旧owner不能触碰新run。无新schema/IPC/依赖/模型循环/上传授权。未发送到前端的早期终结事件仍可在审计中看到，最新持久投影以中断校正为准，不删除历史或重做效果。

实际新构建 03d7e401cdff4226fbfe2504683aa8d6b4f3ea3416e98774004196b909e4fad0/366；原vite配置只重定向 owned test-results，已检查真正加载路径，清单内 Harness source SHA 与构建前后相同。正式真实 DeepSeek/Pi O18kpG 8/8 exit0：终结SQL等待停止、metadata/任务/command/journal一致、刷新冷启保留native字节、下一条自然指令成功、已提交附件原子事实保留一次且不交模型、冷启不重发、终结与附件接收锁等待正常退出恢复。退出分别 5539ms/5650ms；附件退出分支实际是零提交，不虚称同轮同时测过提交分支，已提交分支由停止案例覆盖。额外独立SQLite读回usage=interrupted、finalize=failed。1366/1920中断与核验提示截图均已查看。观察器对3次promise GC仅在原进程重读，没有按新建实例掩盖失败。

同构建真实联网替代 SLqINq 8/8 exit0，保留受控403一次失败与另一实际HTTP200正文、独立日期核对，整体partial/answer:human；不是所有联网、用户原图或无VPN通过。终结SQLite边界5、原journal19、原附件native21、verification25均exit0。npx tsc --noEmit exit0；原配置隔离build exit0；组件217/217、隔离legacy教育smoke207/207 exit0。默认SDK装配uhDVOS2项是本轮修复前清单检查，不当成所有生产领域工具验收。

失败原件保留：jqg8FS观察器GC导致未到有效SQL断言；zpolSU是真实产品失败；z5LPc0前4项通过后测试误用不存在列submitted_run_id，随后按当前原子SQL字段/run_id及参数索引修正；迁移测试FU9B27依赖HEAD提取旧触发器而启动失败，改为从20aa86656cdb5a0f85e0e11fa21863b50233fcb1直接复制固定v1 SQL样例，zsZAkh重跑21通过。第一次误用不存在tsconfig.node.json的TS5058属于命令设置失败，随后使用仓库tsconfig.json重跑type通过；不能合并成零失败。

冻结742d之后production-host出现并行教师偏好上下文接入，首次收尾SHA检查直接拒绝；未触碰偏好实现，重新冻结03d7并实际重跑8+8/217/207与native21。前次结果仅对应旧构建；sourceScope只覆盖清单内Harness，不将未捕获的并行教育源声称全部可复现。

冷启网络观察器仍在页面就绪后安装：证明native/SQLite无重放与就绪后无模型调用，启动最早阶段零网络尚未证明。用户代理运行，未改系统网络、日常profile/凭证/真实学生资料，未向日常out构建；教育分支并行脏改动保留，无commit/push。报告/精确命令：apps/desktop/test-results/goal/harness-h04settlement-20261015。联网/图片/文件日常反馈依然OPEN。

下一继续位置：H04-E：按全部生产工具的实际注册组合审计 manifest/effect/cancel/time/retry 与各领域原行为 golden；保留本片已验的附件/终结等待证据。完整 H04 DoD 后按序进入 H05–H10。日常旧会话/用户原图、关闭代理、安装/人工 Office 和启动最早阶段网络观察仍 OPEN。


## H04-E 注册证据与新需求优先级（2026-10-15）

实际正式隔离构建 9e0ea7864648523eaa821dc84bb66c43b97f611f86e55efa9ba67906f5b22b62/366，四组合13项报告success：私有无网35工具、授权目录有网46、仅输出无网38、合成学生/授权目录/有网/持续目标47。真实Pi AgentSession和原样发给DeepSeek的schema逐项一致，5次真实HTTP200；随机码/native/SQLite及冷启保存均核对，目标保留review_required等待教师。47个工具都有唯一manifest，取消/时限/效果/重试明确；注册并不代表47项领域功能通过。没有改生产代码或用户VPN/日常配置。

实际执行边界17、preflight9，exit0已观察。领域golden UpdXfG前54项后FAIL：旧host夹具缺questionReviews.collections，尚未修复/重测通过。先前jQx2dz为源runner缺OCR JSON import attribute，vZW7Tc为Electron app导出缺失；仅补测试loader读取原JSON及fail-closed app proxy，不冒充生产Electron/OCR。注册autGPn/AwxqxK为SDK观察器加载设置错误；G7U9P9前三组合9项后学生夹具误取列表为单对象，已修正。新构建前发现并行classroomContext/偏好版本接入，拒绝旧03d7结果归到新源码，保留并行实现后重冻9e0ea7。

构建exit0已观察；组件输出217/217、type日志空，但这两项和最终注册/领域任务原进程handle在本次续转时已不存在，最终shell exit未收取，因此明确exit未观察，不补写exit0。注册report成功和日志不替代该退出证据。当前清单source drift数量0，仅清单内Harness有此检查，不覆盖全部并行教育源码。未做日常用户图/无VPN/安装/人工Office或所有工具功能验收。

下一步：用户最新优先级：先读取飞书 VJazw0B8EixwBFk1X6KcdY8snbd 原文，交付需求清单、实施方案与逐条审核验收标准，再开始改造。目前链接跳转扫码登录，已请求登录或文档副本；不得猜正文。原 Harness Goal ACTIVE/H04 DOING，待新需求映射后安排剩余领域验收与H05–H10。


2026-10-15 14:11 飞书访问复核：仍为 accounts.feishu.cn 扫码登录页，正文未读取。上一轮已有注册证据/优先级记录属于进展；本次只读复核确认相同访问阻塞仍在，不当作需求或实现进展。用户已要求先方案及验收后改造，当前仅等待登录或文档副本，不继续扩大旧产品改动；原Goal ACTIVE，未关闭或擅自暂停。下一步仍为读取原文并逐条映射方案/验收。访问证据在 apps/desktop/test-results/goal/harness-h04inventory-20261015/feishu-access.jsonl。


2026-10-15 14:14 飞书阻塞审计：含原用户触发轮与后续连续轮共3轮，均未取得 VJazw0B8EixwBFk1X6KcdY8snbd 正文；本轮实际浏览器仍为飞书扫码登录页。前轮仅访问状态重述，无需求/实现进展。现无不依赖原文的必要改造可继续：用户已指定先该文档方案/审核验收，再改造。已尝试可用浏览器/读取途径并请求登录或导出副本；不能猜正文或转回旧优先级。本轮阻塞审计成立，将线程Goal设为BLOCKED（以工具返回为准），不是完成或用户暂停；全部目标范围、H04领域失败和既有证据保留。恢复条件：用户登录后可读，或提供文档正文/导出。随后先逐条需求→现状差距→实施方案→验收标准。证据：apps/desktop/test-results/goal/harness-h04inventory-20261015/feishu-blocked-audit.json。
<!-- harness-execution-20261012:end -->

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

<!-- harness-audit-20261012:start -->
## 2026-10-12 Harness审计设计（独立分支）

本轮为独立的Harness审计/设计交付，未实施业务修复；Master ACTIVE、Phase4/5 DOING及上方教育分支状态保持。交付索引：`docs/audit/harness-2026-10-12/README.md`。

源码对照见C/EVIDENCE：mu faed8c364323c477399b1dc2ef1d2fa36ce51267、DeepTutor be1701108a22c1037bb8004322ef6145302cbf5e、OpenMAIC 636fab0d7edee5e7c2694117c38ece8f623573f9；book/Edurag无Git以文件SHA。候选移植尚未执行；MCP产品接入为H07拟建，开发工具可访问不等于产品支持。HeroUI MCP可读组件文档，Pro分发许可须独立核验，现本地closure保留。

<!-- harness-audit-20261012:end -->


## 2026-10-11 KB-S5-B限定接受，接续S6（历史读点）

education_export_paper的format/audience/path合同不变；沿现typed Office review增加本地图像，决策允许imagesReviewed:true，由main按草稿hash登记。旧schema和IPC保持兼容，模型结果不携带原图。

KB-S5-B自然扫描图文交付 LIMITED_ACCEPTED（单题范围）。build 517b30ea70e2e46b1e1b2fbc68d311a461b9d052f1d50e42850b00fa74fb867e /340文件；build/typecheck exit0、领域292、组件203/203、导出边界15、Office底座17、coordinator11、正式新版Electron17项/2启动/20张浅暗双尺寸截图/0 renderer错误、兼容smoke207/207。真实授权物理扫描→同Pi提取完整题面原图→教师六项核对及补充答案→纯题库1题8分卷→同Office按版本图片确认→学生/教师DOCX/PDF四份真实文件→重启读回。DOCX媒体hash与PDF解码像素等于确认原图；学生文本答案隔离、改标题旧确认失效、缺图片确认拒绝、实际图片损坏拒绝与停止无落盘均通过。Microsoft Word 16.0 独立实例只读打开两份DOCX并实际渲染，输入文件字节不变。4条Paper谱系、0条误标AI来源，4个批准hash匹配；教师补充答案和解析仍未独立验证。证据：apps/desktop/test-results/goal/kb-office-rich-20261010/closeout.json。


## 2026-10-10 KB-S5-A限定接受，下一图公式联合验收（历史读点）

同Pi education_export_paper复用Office文件授权与审批，不收模型题目/答案/ID/digest。新增document_artifact_paper_sources仅派生谱系，旧Office迁移与正式发布兼容。

KB-S5-A文字整卷Office交付 LIMITED_ACCEPTED。build e73b1f1c3a393192b7858953d53a84ccd2807ebf23b4c1d547d4670d6d3ac3a0 /340文件；build/typecheck exit0、领域291、组件203/203、导出边界11、Office底座17、coordinator11、正式新版Electron19项/2启动/0 renderer错误、兼容smoke207/207。24张最终浅暗双尺寸UI截图和4张最终A4 PDF渲染实际查看；独立Word XML/PDF文本核对20题及学生答案隔离。同一Pi→现Office教师审批→学生/教师DOCX/PDF四份真实文件、4条Paper谱系且0条误标AI来源，冷启读回一致。来源变化、实际拒绝与停止均零落盘；同会话新卷确认后旧选择隐藏导出，避免导错版本。教师仅改标题，原题不改，answerVerified=false。证据：apps/desktop/test-results/goal/kb-office-20261009/closeout.json。


## 2026-10-09 KB-S4-B限定接受，下一S5/S6（历史读点）

education_find_similar_questions入同Pi工具集合与公开来源投影；严格别名输入，最终授权/大小/取消检查后原子登记别名。Pi SDK fetch hook复用Electron net.fetch固定官方端点，禁止cookie与重定向；不改系统网络/全局fetch或凭证。

KB-S4-B同Pi本地候选→实读→受审练习 LIMITED_ACCEPTED。build ab6835d59e7d7c65e24895eafeaef6915482dc3b60e02a3f8f68c66004b2a037 /340文件；build/typecheck exit0、领域289、组件203/203、模型目录19、SDK fetch边界5、正式新版Electron26项/5启动/20张已查看浅暗双尺寸截图/0 renderer错误、冻结构建兼容207/207。真实DeepSeek读取实际交付照片学习证据，查询10候选、实读原题及所选5题版本，排除两道实际进入Top10的面积干扰；教师修改后只保存1份5题练习及5条使用记录。实际拒绝、停止冷恢复不重放、重复确认幂等及冷读通过，题库/学生事实不新增或改写。Node fetch目录/SDK ECONNRESET通过Pi原生fetch hook接Electron net.fetch修复，固定官方HTTPS/不带cookies/不重定向；容量来自官方目录，不硬编码。证据：apps/desktop/test-results/goal/kb-similar-pi-20261009/closeout.json。


## 2026-10-09 KB-S4-A限定接受，下一S4-B（历史读点）

mistakeSimilar:find/cancel受当前主窗口/主frame授权；严格mistake-similar.v1，最多8在途/60秒超时、销毁/退出取消。无外部请求，本地照片/题目只读；旧Pi能力与新本地候选的交接待S4-B。


## 2026-10-09 KB-S3限定接受，下一S4（历史读点）

无新包/依赖/AgentLoop/模型安装。现Pi SDK工具注册、身份与等待审批复用；DeepTutor exam_mimic委托AgentCoordinator生成卷，不适配source_only，不复制并列runtime；OpenMAIC内容生成不提供本机版本CAS选题。现HeroUI Button/Modal和题本来源/图片/答案组件直接复用。

KB-S3 source_only整卷蓝图/审核/快照 LIMITED_ACCEPTED。build a0f860ac56680a4ddb1fa7798edd1e7c90812fae92f73b7a1156dddee7338448 /340文件；build/typecheck exit0、领域274、组件200/200、正式新版Electron12项/3启动/0 renderer错误、补充冷副本视觉3项/1启动/0模型请求、兼容smoke207/207。32张最终浅暗1366×768/1920×1080截图实际查看。23道教师UI创建对照，20道唯一题满足10×3+6×5+4×10=100；重复/缺答案/错年级、编辑废止、拒绝、精确缺口、真实源变化与恢复、幂等、停止无晚写、两次冷读和真实DeepSeek同Pi等待教师审批通过。原题不改，不自动补题，answerVerified=false；自制文字对照不是自然扫描卷或数学正确性证据。证据：apps/desktop/test-results/goal/kb-paper-20261009/closeout.json。


## 2026-10-09 KB-S2-B限定接受，下一S3（历史读点）

无安装/模型/打包增量；复用现status-chip并查HeroUI Chip官方docs https://heroui.com/docs/react/components/chip.mdx 。DeepTutor本地be1701108a22c1037bb8004322ef6145302cbf5e/Apache-2.0 source_explorer._dedupe_and_clip按source/ref/截断文本，OpenMAIC636fab0d7edee5e7c2694117c38ece8f623573f9/MIT courseMaterialFingerprint按文件元数据，均不等价完整同题。已读真实源码和许可证，未复制或更新上游。

KB-S2-B 保守同题候选/版本绑定 LIMITED_ACCEPTED。build cb0a5c473cbffc23d483cd2c2027f80405ac1fdbb57b44495fa4402072e8c79f /340文件；build/typecheck exit0、领域258、组件194/194、正式新版Electron12项/3启动/0 renderer错误、兼容smoke207/207。12张浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照：跨记录ID/CRLF同题2条，改数值条件保持独立；20+2分页，真实Pi/DeepSeek同次10条安全别名/duplicateOf，源变化拒绝、精确恢复、两次冷启与索引重建通过。仅本地保守候选，绝不自动合并/删题或证明答案正确；页面范围current_page、Pi范围returned_candidates。证据：apps/desktop/test-results/goal/kb-identity-20261009/closeout.json。


## 2026-10-09 KB-S2-A 关键词底座限定接受（历史读点）

复用SQLite FTS5 trigram，无安装/打包增量。官方依据：[SQLite FTS5 trigram](https://www.sqlite.org/fts5.html#the_trigram_tokenizer)。HeroUI Button/NativeSelect官方lookup已留component-reference.json；本片复用现题本表单/按钮风格、现HeroUI来源Modal，不迁移整页。

KB-S2-A 关键词检索底座限定接受。当前build `443eae07f599fda05dfc5f241f85a8f62c942bc5cc9855cbc5e48f69777e3314` / 340文件；build/typecheck exit0，领域252、组件194/194、正式新版Electron11项/3启动/0 renderer错误、兼容smoke207/207。8张当前浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照题，六项硬过滤命中22道、20+2分页；真实Pi/DeepSeek读10条并标hasMore；冷恢复、索引删除重建、旧来源拒绝与精确恢复均通过。不是语义Top10、同题指纹、答案正确性、100分卷、数学Word/PDF或30–40GB验收。证据：`apps/desktop/test-results/goal/kb-retrieval-20261009/closeout.json`。


## 当前最高专题优先级：知识库与智能组卷（2026-10-09）

已验边界与后续门禁见精简执行卡；本次整理不把尚未实施模块标完成。

用户最新指示：整理上下文，集中完成知识库与智能组卷。当前唯一执行索引：[KB_EXAM_ACTIVE_TASK.md](../goal/KB_EXAM_ACTIVE_TASK.md)（仓库绝对定位 `docs/goal/KB_EXAM_ACTIVE_TASK.md`）。接续为 **KB-S2检索→S3纯题库100分卷→S4错题相似练习→S5/S6 Word/PDF联合验收→KB-002三模式/5变式→KB-003增量30–40GB**。R3/R4只按组卷/变式所需嵌入，通用解题长线及其他模式延后；下方旧节的R2→R3→R4线性Next不再是当前执行顺序。Master及知识库四项产品决策保持。


## 2026-10-09 B5-B限定接受与R2接续

Pi当前读取/来源按钮沿现生产host；使用现官方OSS Modal/Button，无新Pro复制。外部OCR/solver依赖仍待R3专项审查、Windows打包与许可证验证；本切片未安装。

本节是当前读点，下方同日旧节保留历史证据，不能覆盖本节。M05/M10 B5-B仅来源事实一致性保护已接受：answer/analysis镜像冲突及v2题干冲突由同一只读helper检测；typed IPC保留安全错误，题本/同Pi来源弹窗拒绝展示冲突正文，精确恢复后可读。旧v1摘要语义、questionVersion、批准与原图未被自动修复或重写。

当前build 367d53b3d85dbb2e1855cbb7db977859f94129e529aec6898f40b2dca8d3f6bf / 340文件，正式前后、冻结快照与兼容smoke后一致。build/typecheck exit0；领域243、组件194/194、兼容smoke207/207；真实DeepSeek/Pi Electron24项/4启动/0 renderer错误。32张当前浅暗1366×768/1920×1080截图与4份原图实际查看；三个隔离标量故障均拒绝、精确恢复、冷启一致；原生手动压缩1次后冷继续通过。此压缩不是新的自然自动阈值基准，smoke仅兼容路径，不作新版视觉依据。

物理扫描无独立标准答案仍missing，图15未知标记不认作答案；教师自制跨页算术仅来源绑定对照，answerVerified=false。完整B5独立质量、可靠求解/五tools、语义Top10、100分卷/Office、30–40GB、自然教师、安装/VPN-off与完整Codex体验仍OPEN。

**Next：R2保守同题指纹/中文检索、硬过滤/版本与可信复用合同→R3受限AST/SymPy→R4同Pi五tools→R5–R7错题/组卷/Office/容量。** 不因缺物理答案停止后续，也不凭题面批准/来源标签把答案当正确。Master ACTIVE、Phase4/5 DOING。证据：`apps/desktop/test-results/goal/b5-facts-20261009/closeout.json`；首次RED/build/组件失败与回滚副本保留。无DDL/依赖/第二runtime/日常资料或凭据改动，无提交/push，另一worktree保留。


## 2026-10-09 本轮低成本解题路线审查交付

12项目逐项许可/模型/硬件/替代/维护/退出见报告§2–§3；MIT/Apache/BSD还须依赖/权重/NOTICE/SBOM。保持既有固定OCR与DeepTutor纯helper，不安装调研全栈。Qwen只作未来显式provider替代，当前默认DeepSeek。原图/整库不自动上云；移除计算/索引provider不影响SQLite事实。

完整设计：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；实施：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`。证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-route-review/readback.json` / `supplement.json`。Master ACTIVE、Phase4/5 DOING；本轮未重跑build/provider/Electron/上游测试，当前B5-B草稿未接受，资料/凭据/另一worktree保留，无提交或push。


## 2026-10-09 B5-A：题本来源与答案声明的限定接受

复用现Pi工具/DeepSeek/provider/stream/session/手动compaction、QuestionAssets与HeroUI题本结构。未引入上游UI或AgentLoop；DeepTutor/OpenMAIC本地HEAD仍be170110…/636fab0…。无依赖/许可/模型配置变更；正确答案验证服务待R3，五tools待R4。

当前 build `55b02f7db10fe4530098f0447bd92d89566841acb698e51b02e68ec6e38df9a3` / 340文件与正式前后、smoke后及固定快照一致。build/typecheck exit 0；领域 **239**、组件 **190/190**、兼容冒烟 **207/207**。真实 Pi/DeepSeek 正式 Electron **22项 / 4启动 / 0 renderer错误**。24张当前product-five-spaces浅暗1366×768/1920×1080截图实际逐张查看；新增答案出处与缺失/未核验提示均有当前像素。smoke只在正式进程退出后重建；另存并查看1张legacy兼容题本截图，不把该旧壳截图当新版设计验收。

仅接受B5-A来源/答案声明与本切片UI；完整B5独立图义/公式/条件/答案质量仍DOING。物理扫描卷无独立标准答案，仍missing；教师自制跨页算术只是来源绑定对照，不是扫描答案gold。answerVerified=false，不上传原图/私有路径，不将模型自评作证明。原生手动压缩1次与冷继续已验，不是新的自然自动阈值基准。完整可靠解题、Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off、完整Codex体验及Master后续阶段仍OPEN。

**Next：B5-B逐题独立对照来源/公式/必要条件与答案质量 → R2可信同题零额外生成、相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题/组卷/Office/30–40GB。** 不重复B4四类兼容代替新质量任务，不把本轮文案修复当完整解题完成。

Evidence：`apps/desktop/test-results/goal/b5-source-20261009/closeout.json`；正式 `education-journey-n5msKi`，含当前源/加载脚本、固定build、日志、24张已查看截图、失败与回滚点。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty），Master SHA未改，Phase4/5 DOING、Master ACTIVE。无DDL、新依赖、第二runtime、日常资料/凭据变更、提交或push；另一worktree保留。历史节保留当时范围，不覆盖本节。

## 2026-10-09 B4-D：单区域完整审核与新旧版本同构建兼容的限定接受

本轮复用Pi现tool/stream/session/手动compaction、DeepSeek provider、同原题multi review/typed IPC、HeroUI React Checkbox/TextArea。HeroUI MCP docs已取得，未装新库或更新SDK。DeepTutor/OpenMAIC纯教育逻辑保留，不迁其AgentLoop/数据库/教师权限。旧single adapter保持；待以后完整迁移验收才考虑退役。

当前build `e02ddc1d62d37152928c97718ea14894389982fcdbfd2453cb673cd08a417c51` / 340文件与四次正式流程前后、smoke后out和固定快照逐文件一致。build/typecheck exit 0；领域 **239**、组件 **185/185**、兼容smoke **207/207**。真实Pi/DeepSeek正式 **50项 / 13启动 / 0 renderer错误**：fresh single 20、旧v1单页10、旧v1多页10、新v2再修订10；40张浅暗1366×768/1920×1080截图实际逐张查看。smoke在四次正式进程退出后才重建，未与正式测试重叠。

**Next：B5原图/公式/来源/答案质量合同与独立核对 → R2可信同题零额外生成/相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题、三模式组卷、Office与30–40GB。** 现题本可见`teacher_resource`/`generated`内部来源文案，列为B5/R2产品文案待修，不把40截图限定核对当整页UX完成。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4d-closeout.json`，含当前源码/加载脚本、build、命令、首次失败、40张已查看截图及回滚快照。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty保留），Master SHA未变、Phase4/5 DOING、Master ACTIVE。没有DDL、新依赖、第二运行时、日常数据/凭据变更、提交/push；另一worktree保留。历史节只保留其当时范围。

## 2026-10-09 B4-C：新多区域审核与完整转写传递的限定接受

本轮复用现SDK原生stream/手动compaction/session、DeepSeek provider、MaterialRepository/本地固定Worker、原typed IPC、同question/approval真源、HeroUI TextArea/Checkbox。不装依赖/更新SDK/接第三方Agent。官方Checkbox页面及HeroUI MCP TextArea/Checkbox docs已取得（§51的MCP待返回已解决）；DeepTutor/OpenMAIC没有本机批准authority，保持纯教育能力复用。

当前build `33ffc86cc404e48068dbb18f18138aaa153753b0ca14c424e572e5bb6fc7ff1b` / 340文件，与正式流程前后、当前out及固定快照逐文件指纹一致。build/typecheck **exit 0**；领域 **237**、renderer **185/185**、兼容smoke **207/207**。正式当前Pi/真实DeepSeek **16项 / 4启动 / 0 renderer错误**；补充冷副本UI **2项 / 8张 / 0模型请求**。共 **20张**浅暗1366×768/1920×1080截图实际逐张查看；新增核对进度与原图/来源/按钮均有当前像素证据。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4c-closeout.json`；正式 `education-journey-cHFfHO`，定点视觉 `education-journey-otIM5j`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`；Master/日常数据/凭据/另一worktree未改，未提交或push。Phase **4/5 DOING**，Master **ACTIVE**。以下旧节仅保留当时证据，不能覆盖本节。


## 2026-10-09 B4-B Goal续行记录

B4-B新增typed IPC questions:complete-context，经production host/coordinator和preload completeOriginalQuestionContext接题本；Pi现education_search_questions/read_question无需新工具或runtime。真实DeepSeek读取六项已确认投影，原图/资产路径仍留本地。技术研究12项目仍不是已安装集成。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/`；正式 `education-journey-H1dgFq`。兼容冒烟 **207/207，exit 0**；见最终b4b-closeout.json。Phase4/5 DOING、Master ACTIVE。

## 2026-10-09 最新审查读回与实施边界

12项目固定源码研究覆盖指定4项与扩展8项；Math bank仅设计参考，Edu-RAG/Math-GPT许可待核实。LanceDB新HEAD32436a7…已补读许可/依赖/RRF，不自动生产升级。Paddle/BGE/Lance/SymPy按POC接现合同，不能迁入其他AgentLoop。

方案：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；开发卡：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`；本次证据：`apps/desktop/test-results/goal/solver-audit-20261009/final-current-review/`。以下历史仅保留当时范围。


## 2026-10-09 本轮低成本解题路线审查与交接

新增选型候选math-worksheets-skill（MIT、固定21312be…），仅审源码/测试/CI，不安装或执行。其固定验证/答案绑定可POC，非新的Agent runtime；现Pi注册/流式/压缩/账本与Office直接复用。未知许可仓库不复制。

方案：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；任务卡：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`；证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-review/`。以下历史保留其当时范围。


## 2026-10-09 B3 多区域原图与来源答案审核：纵切限定接受

四条 guarded typed 多区域 review/revise/decide/gallery 接口共用 opaque saved revision / approved assets。真实 Pi tool 仍按已观察材料版本提出候选，教师文字及PNG不回传模型；完整必要上下文待 B4。

Phase **4/5 DOING**，Master **ACTIVE**。只接受 B3 多区域原图/来源审核纵切，不接受完整原题转写、数学正确性、B4/B5 或完整 KB-EXAM-001。

最终 build `df2a6f837b39d5feaa66df56b4239101552ebd613c23277a2ef4b4e317c99828` / 340 文件与当前 out、正式流程前后逐文件一致。build/typecheck、renderer **181/181**、领域 **225**、真实 DeepSeek/Pi 正式 Electron **12 项 / 3 启动 / 0 renderer 错误**、全部 5 张原件像素对照和旧兼容 **207/207** 通过。12 张深浅主题、1366×768/1920×1080 截图及 5 张原图实际查看。停止真实范围渲染子进程实测 **1617ms / SIGTERM**，不外推其他设备或完整性能基准。

真实物理扫描题两块原图完整保留条件、图14/图15、表、选项与小题；**手工文字仅摘要，缺少例如“不更换实验器材”等完整条件，不能单独作为 LLM 完整题面**。该卷没有独立答案 gold，答案保持 missing。另 3 页算术对照为明确教师自制材料，只验证跨页及来源锚点，不冒充该卷标准答案；来源答案与教师补解分别保存。scope 更改须重确认，source CAS、外帧拒绝、真正确认 SQL 事务中 main 强制死亡/回滚、冷恢复、损坏整组报错/恢复与幂等均通过。

复用同 Pi、ai_confirmation_items、question_bank_items/document_json 与 QuestionAssets；取消修复沿现 owner AbortSignal，不新增 AgentLoop、DDL、依赖或模型。SDK 12 条 assistant usage 保留，cacheRead 是 SDK 报告 token，不是题库命中率；SDK 价格 0 表示这里未知，不等于账单免费。

**Next：B4 完整必要题面上下文精确合同 → B5 联合验收 → R2 可信精确复用/相似 Top10 → R3 受限 AST/SymPy → R4 同 Pi 五 tools → R5–R7 两 MVP、Office、三组卷模式和 30–40GB。** 不得通过删除 document 或仅发 stem 绕过 `document_context_unavailable`。完整解题/语义检索/数学导出/40GB、自然教师、设备/安装/VPN-off 仍 OPEN；Master 其他 DT/MA/JOIN 与 Phase6–8 保持 OPEN。

Evidence：`apps/desktop/test-results/goal/original-multi-20261009/closeout.json`；最终正式路径 `education-journey-15t76q`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`（dirty 保留）；未提交/push，不改日常资料、凭据、历史或另一 worktree。Master SHA 未变。以下历史保留其当时范围，以本节和最新真实证据为准。

## 2026-10-09 低成本解题选型复核

11上游/25源码与许可本轮核查，84历史hash无失败，7个404保持未知；正文见[技术审查](../architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md)。现RapidOCR/PDFium和Pi继续；Paddle/MFR只候选，BGE/LanceDB/SymPy拟接纯组件，无本轮安装或复制。AGPL/无已核许可模块不入闭源；代码/权重/依赖/内容权利分别审核。Qwen别名/快照能力不同，DeepSeek默认不变。Next：先B3正式接受→B4/B5→R2–R7，MasterACTIVE；当前草稿不是集成已验。

## 2026-10-09 B2-c 原页文字区域：生产纵切限定接受

复用RapidOCR3.9.2/ONNX Runtime1.30.0/PDFium5.14.0，fixed Windows layout-v1-dist主机；旧page-v1保留，licenses/notices与manifest固定。无新增模型/API/包；Pi本片无需调用。锁定命令须显式`node scripts/xiaozhi-agent/lock-ocr-runtime.mjs layout-v1`，避免默认page-v1被误重锁。窗口/main授权和source CAS继续强制。

Phase **4/5 DOING**，Master Goal **ACTIVE**。仅接受B2-c文字区域切片；完整B2、R1-B、KB-EXAM-001、可靠解题与两条最终业务闭环仍OPEN。

最终build `85d8e4d7ecf997f052bf56f532c73e09d5f0710dfc7bc993ffaf8ab8b408f872`（340文件）与当前out逐文件一致；build/typecheck、renderer179、领域216、原生兼容11、正式Electron11/2启动/0 renderer错误、旧smoke207/207通过；16张深浅双尺寸截图实际查看。

公开物理扫描卷6页共304待校正文字行；UI识别＋回读实测每页7.851–8.900秒，不是纯模型基准或总体准确率。Page4 S₂→zS、Page6 U₀→U。且部分选项漏识别，原图完整保留；不能称完整切题/数学正确/来源答案。临时校对稿未存为正式题目，重启只复用派生候选cache；本片0模型请求，不等于整个解题成本0。S/M公式POC未推广；自然教师/日常profile、安装、16GB、VPN-off、30–40GB未验。

下一步：知识库方案§41 B3完整多块/跨页题目与来源答案审核→B4完整必要Pi上下文→B5联合验收→R2可信精确/语义Top10→R3受限SymPy→R4同Pi五tools→R5–R7组卷/错题双MVP、Office/三模式与30–40GB。Master其他DT/MA/JOIN与Phase6–8保持OPEN。

Evidence：`apps/desktop/test-results/goal/material-layout-20261009/closeout.json`（含source/build清单、commands、first-failures、manual-review和16张实际查看的截图）；正式当前UI为`education-journey-NEu3AR`，旧207仅兼容证据。

以下历史保持当时范围，当前状态以本节与真实证据为准。

## 2026-10-09 B2-b 版面/公式可行性结论（包含失败，非生产完成）

官方FormulaRecognition在隔离CPU环境使用本地核hash权重；生产依赖未新增。71包/模型声明与notices已留，完整发行许可闭包未批准；不复制AGPL或未核许可模块进入闭源，不引入私人搜题爬虫。

6页公开扫描卷保留304文字行四边形，单页3.609–4.263秒。S中文/单位/LaTeX质量失败；M三清晰crop主要内容匹配预先人工转写（1.494–2.331秒），退化单位错误、图表180秒超时、空白两次减号。没有完整题界/数学正确性/总体准确率证明。CPU实验设备i7-13650HX/约32GiB，不是16GB基准。

仅测试env安装71个hash锁包与官方本地权重，未改生产OCR/资料/数据库/凭据。商业发行闭包、Windows进程树强制取消和安装/设备门禁未接受。原正式out SHA e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件与Master/worker/manifest未变，无新产品UI或solver完成证据；未提交/push。

Next：知识库方案§38 B2-c版本化候选协议/现teacher入口合同→B3多块/跨页/来源答案→B4完整Pi题面→B5联合验收→R2可信检索→R3受限验证→R4五tools→R5–R7双闭环/Office/三模式/大库。Phase4/5 DOING，Master ACTIVE；本片不将完整B2、KB-EXAM-001或可靠解题标完成。

Evidence：apps/desktop/test-results/goal/layout-formula-20261009/closeout.json、manual-review.json、first-failures.json；知识库方案§37为结论、§38为下一合同草案。下方原历史证据保持其范围。

## 2026-10-09 B2-a 后台资料整理（限定接受）

新增typed材料后台三入口；公开动作严格schema+resourceId+version+prioritize/cancel/retry。现Pi工具注册/错误/流/持久化保持，office_read_material增加等待已有队列的本机优先解析；没有FastAPI新服务或第二运行时。prepare停止等待时不取消其他教师任务；原有成功正文观察与来源授权保持。

B2-a 后台资料整理已实现，已验最终build e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件：build/typecheck、renderer177、统一领域209（新增队列17）、正式Electron11/4启动/0 renderer错误及12张双尺寸深浅截图通过。实际deepseek-flash/Pi实读触发优先解析，SDK usage单独保留，不算账单/单题成本。同一最终build兼容207/207通过。仅B2-a持久后台整理切片接受；完整B2/R1-B/KB-EXAM-001未完成。

Phase4/5 DOING，Master Goal ACTIVE。仅本机确定性任务消费，无新依赖/DDL/AgentLoop/公式模型安装；不把OCR正文当原题、标准答案或已审核事实。新队列仅显式采用资料，旧占位不自动消费；旧同步入口保留。单文件整体提交与重启，不承诺页级checkpoint、30–40GB吞吐、PID复用抢占或自然教师/安装验收。Git本地/远端HEAD均488f8109d68027a6eb488e9d04c4eb5073d153cd，dirty保留、未提交/push；日常资料/配置/历史及另一worktree未改。

Next：B2-b真实版面块与唯一公式候选许可/设备POC（方案§34）→B3多块/跨页/源答案教师校正→B4完整必要Pi图/公式上下文→B5联合验收→R2可信检索/Top10→R3受限SymPy→R4同Pi五tools→R5–R7双MVP/Office/三模式/大库；Master其余DT/MA/JOIN/Phase6–8保持OPEN。

Evidence：apps/desktop/test-results/goal/material-background-20261009/（commands、first-failures、source-manifest、visual-review、native-usage与真实readback）；完整收口见该目录closeout.json；最终207在accepted-build5运行，之前build3的207仅为历史证据。下方历史保留，以本节与实际证据为准。


## 2026-10-09 B1 原题资产与教师审核：单题单页切片接受

typed preload新增reviewOriginalQuestion / decideOriginalQuestion / getOriginalQuestionImage，主帧注册xiaozhi:original-review / xiaozhi:original-decide / questions:original-image。Pi原题工具仅同run成功office_read_material观察过的source版本可用；回执只含state/count，图片与教师最终转写保留本地。原图不自动上传，真实native history image blocks=0；确认在已停止run中进行，未把这一步冒称额外provider成功轮。原Pi身份/压缩计数保护同步扩展。

仅接受单题、单页、一个原件区域的原题审核/入库切片。完整B1/R1-B、KB-EXAM-001、可靠解题、100分组卷/错题Top10/数学导出/30–40GB仍OPEN；Phase4/5 DOING，Master Goal ACTIVE。

最终build/typecheck通过；renderer174/174、统一领域192（新增原题边界17）、真实DeepSeek正式Electron13/4次启动/0 renderer错误、独立原PDF与候选/正式PNG逐像素对照2项通过。8张深浅主题、1366×768/1920×1080原题审核与题本截图已实际查看。最终accepted-build4与当前out逐文件一致，采用现evidence.mjs指纹SHA `991bcce76eab745609ccb8fa012ff2d17711749366261656e753514d0fa94a0b`（340文件）；旧smoke207通过于build3 `d16dfa9b639d55c0b517b5b94c754a18b6f8c5e56fc160ed4ed4ccc936989da4`，main与最终不同，不能称全207在最终构建运行。

真实Pi请求证明本轮正文实读→工具→审核流程，不证明数学答案正确；教师交互为隔离Electron自动操作，不是独立人类教师签收。当前答案origin=missing，未新增学生事实。原图只在本机显示，Pi题面reader遇document仍明确拒绝不完整文本读取；完整上下文待B4，不允许漏图解题。

Next：B2真实版面/题块定位、唯一公式候选许可/权重/设备POC、现SQLite上的确定性持久解析任务与任务优先→B3完整题块/跨页/来源答案校正→B4题本/Pi完整必要上下文→B5原图/公式/答案与恢复联合验收→R2可信精确复用/语义Top10→R3受限验证→R4同Pi五tools/讲解→R5–R7双业务闭环/导出/三模式/大库，继续Master其余任务。

Evidence：`apps/desktop/test-results/goal/original-review-20261009/closeout.json`。本地/远端HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`一致；dirty保留。无新依赖/DDL/Worker或AgentLoop，无提交/push；测试使用隔离资料/数据/profile，未改日常凭据、资料、历史或另一worktree。Master SHA未变：`dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302`。

以下保留历史，当前实现状态以本节和最新真实证据为准。


## 2026-10-09 解题路线当前复核（审查交付）

4指定＋7额外项目保持固定HEAD来源/许可记录；RapidOCR/PDFium继续现已锁版本，新公式/embedding/SymPy尚未安装。Math-Verify Windows timeout与Pix2Text依赖许可闭包必须POC，不能凭主包许可部署。

当前Phase4/5 DOING、Master Goal ACTIVE。本次仅完成源码/许可/方案复核；既有R1-A文字、B1题面存储及原页预览保持限定接受，完整原题、可靠求解、语义Top10、100分/数学导出/40GB仍OPEN。下一实施：R1-B/B1正式题图与原题审核writer精确合同→B2–B5真实原题闭环→R2可信检索→R3受限验证→R4同Pi五tools/讲解→R5–R7两业务闭环，再继续Master。

Evidence：apps/desktop/test-results/goal/solver-audit-20261009/current-review/。本次不提交/push、不改凭据/资料/另一worktree。


## 2026-10-09 R1-B/B1 原页保真预览（最新，限定范围）

复用现Pi1.0.2（编排不变）、RapidOCR3.9.2/ORT1.30.0固定runtime和pypdfium2/PDFium5.14.0。只新增已有PDFium单页调用的版本化封装；许可证/NOTICE沿现646文件锁保留，无新下载/安装。官方接口依据：https://pypdfium2.readthedocs.io/en/stable/python_api.html 与 https://heroui.com/en/docs/react/components/pagination。

仅接受B1原页/区域预览小切片，完整B1/R1-B/KB001与可靠解题仍OPEN，Phase4/5 DOING，Goal ACTIVE。现“我的资料”可在本机查看PDF原页、翻页、放大、停止、重试；源变化/丢失/坏文件诚实提示。保留图、表、公式及选项的原件栅格，不等于自动切题、公式转写或答案正确。无新依赖/DDL/模型调用/另一AgentLoop，无原题/答案/学生事实写入。

最终out与accepted-build3逐文件一致，SHA b3e51f18bbe0ff8604918a3a4dc846020136679dc6e5f4333686827ad3839843 / 340文件。最终build/typecheck通过、renderer174、领域175、正式Electron12/2次启动/0 renderer错误/前后build一致，3项独立原件像素对照通过，8张深浅双尺寸原页截图已查看（仅预览面板；不代替完整Shell/动画/教师D/安装E）。PDF13及旧smoke207在accepted-build2通过，其main/preload与最终完全一致，renderer不同；不混称全207在最终build运行。旧image宿主10通过，同新固定runtime。证据：apps/desktop/test-results/goal/material-preview-20261009/closeout.json；逐命令/首失败/回滚与指纹均保留。

Next：B1正式question-assets/v1同源快照、现ledger原题类别与内部writer精确合同/实现→B2真实版面/唯一公式候选POC/持久确定性后台任务→B3教师校正确认→B4题本/Pi完整必要上下文→B5逐题原图/答案/故障恢复验收。然后R2–R7及KB001纯题库100分/错题Top10/Word-PDF/重启双闭环，继续Master其他任务。

以下保留历史，当前状态以上节为准。


## 2026-10-09 R1-B/B1 题面与版本底座（最新，限定范围）

Pi唯一production编排不变，现education_search_questions/education_read_question和questions:context-source typed IPC复用，旧IPC ok/value union不改。read返回structured原件时先明确document_context_unavailable；local typed source可读元数据但图资产根/授权/原题writer待补。未安装任何公式/向量/SymPy/FastAPI依赖或调用新API，本片模型请求0。只接受R1-B/B1题面存储与版本底座小切片；完整B1、R1-B、KB001、Phase4/5及Master Goal仍OPEN/DOING/ACTIVE。题面合同结构合格不等于原件真实、完整、数学正确或教师已确认。

Next：补齐B1同源题图资产根/哈希/授权与现审核ledger原题类别/内部writer合同，再B2真实版面与唯一公式候选POC/持久任务→B3教师校正确认→B4题本与Pi完整上下文→B5原件逐题/故障/冷恢复。R2–R7及KB001双闭环保持OPEN。

以下保留历史，当前状态以上节为准。


## 2026-10-09 解题路线审查复核（最新）

4指定+7扩展项目/代码权重依赖许可/Windows硬件与退出方案见技术审查§2–§4。默认沿现RapidOCR，公式Paddle或纯MFR择一POC；BGE/LanceDB仅可重建检索候选；SymPy固定AST纯计算；DeepTutor仅现固定helper，不整套AgentLoop。Mathbank AGPL参考设计、EduRAG/MathGPT商用授权待核实；MathVerify需Windows专项POC。当前上游SymPy8c02bd2补审，不安装HEAD/新增依赖；其它10HEAD不变。价格快照来自国内API官方文档，不是实测每题费用。


## 2026-10-09 R1-A 扫描PDF文字前置验收（当前）

复用原RapidOCR/ORT/父进程watcher/hash锁/共享Worker池，固定PDFium5.14.0 wheel/依赖notices收集；646文件279,003,674bytes，旧image宿主10项兼容通过。未新增公式模型/API或额外Agent。PyPDF只在现有测试工具环境生成密码测试fixture，不作产品依赖。

仅接受R1-A文字前置，完整S1/KB001/Phase4/5仍OPEN/DOING，Goal ACTIVE。新版资料页面真实6页扫描卷→本地fixedexe→同SQLite实际页码→停止/重试/坏或加密PDF/源CAS/真实主进程死亡/冷恢复；无模型调用、题目/答案或学生事实写入。下一唯一任务R1-B：完整原题图/公式/来源→教师校正确认→原题库/Pi读取。

以下保留历史；当前状态与下一任务以上节为准。


## 2026-10-09 低成本解题审查与路线修正（当前）

只读核11仓库HEAD/选择性真实源码与许可：4指定＋RapidOCR/Pix2Text/FlagEmbedding/SymPy/LanceDB/DeepTutor/MathVerify。未clone/安装/执行调研项目。现RapidOCR/DeepTutor纯helper保留；新公式/embedding/verify待Windows/依赖许可POC，不部署整套外部Agent runtime。

Mathbank AGPL仅参考，EduRAG/MathGPT许可待核不可复制；Pix2Text MIT不覆盖PyMuPDF/YOLO；MathVerify Apache根＋文件MIT且Windows timeout风险。每项替代/维护/退出及权重/硬件：[审查§2–3](../architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md)。现DeepSeek主配置、Qwen后续显式接入；官方视觉/价目快照不代替产品验收。

以下旧记录保留历史；本轮状态与下一任务以上节为准。


## 2026-10-08 知识库与智能组卷专题（当前）

用户2026-10-08指定优先完成“本地知识库＋智能组卷＋错题相似练习”，随后继续原Goal。原Master保持2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302；Phase4/5 DOING、Goal ACTIVE。旧“下一唯一任务讲义”仅为历史，本次优先级以本节为准。

只读复核：EduDev本地/远端488f8109；DeepTutor本地be170110（5脏改保留）/远端6cf793bd；OpenMAIC本地636fab干净/远端472b26d。现教育vendored仍f07029c，不视为已升级。优先原解析/OCR/审核/Office；公式/复杂解析补缺先POC核代码/权重许可、包体与Windows资源，未安装新依赖。

[复用矩阵](../goal/XIAOZHI_KNOWLEDGE_EXAM_TECHNICAL_PLAN.md#19-2026-10-08-本地源码审查与进度)。

以下旧记录保留历史；当前优先级以上述专题为准。


## 2026-10-06 DT-05 同源五题与两周训练（当前）

Pi1.0.2原Session/customTools持续编排，固定DeepTutor question复用已再verify（2文件104953字节）；不加载其AgentLoop。DeepTutor本地be170110/上游f07029c Apache2、5处既有脏改保留；OpenMAIC本地636fab/上游723005 MIT，课堂支线尚未验收。Pro MCP传输失败后复用当前合法本地ChatTool/HeroUI Button；无新包/打包体积增量。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。



## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

继续原固定RapidOCR/Hana安全读取、Pi原customTools/Session及DeepTutor原学习算法；本轮无新增包。DeepTutor上游f07029c、本地be170110且5份用户脏改保留，Apache2；OpenMAIC上游723005、本地636fab，MIT，课堂仍下一分支。Pi当前1.0.2与已安装包范围不变，MCP/goal-x/background/browser门禁保持。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

继续复用固定 RapidOCR 3.9.2 / ONNX Runtime 1.30.0 / PPOCRv6-small 本地识别包与 Hana 安全读取模式；没有 OCR 云端替代或新依赖。Pi package 状态见 PI_PACKAGES.md：web-access 关键词定位、usage DeepSeek 余额已有限接入；goal-x 安装待适配；原生 MCP / 浏览器 / background 继续原门禁。

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

复用：practice-result.v1只是现有student-training.v1的可选关联字段；旧输入/digest/记录保持不变。使用原exercise_sets、question_bank_usage、ai_confirmation_items及learning_records，无新增表/列/迁移/依赖/第二编排。确认练习sourceOn与结果writer共用原BEGIN IMMEDIATE；校验活跃学生、确认ledger digest、实际练习快照SHA、计划科目/知识点及完整逐题索引。答案/反馈/分数绑定原防重digest，重复不写、改动冲突、失败回滚；原concept/design质性门禁不放宽。Pi通过原education_analyse_learning收到脱敏实际答案/反馈/可选分数和整体结果，私有学生/练习ID不出现在回执正文，不自动打分或补造结果。

本轮已核最新上游：DeepTutor远端f07029c（本地be170110，Apache2、五份用户脏文件保留），OpenMAIC远端723005、本地636fab（MIT）；原DeepTutor学习attempt/question关联供比较，现有固定原算法继续复用，不迁入Store/AgentLoop。Pi原customTools/Session已足够该事实续接；HeroUI官网可读、Pro MCP transport失败，复用项目合法现有Button/表单/来源链及checkbox-label；finesse没有可用本地来源。

Pi包三项精确安装与限定接入仍按PI_PACKAGES，不因本次实际结果扩大到完整联网、原生MCP或goal-x生产接入。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 Pi 插件目录与安装复核

插件安装命令、用途、体积、许可证、原生替代与待接入状态已更新到 PI_PACKAGES.md。web-access/usage仅既有范围，goal-x未启用；无新增依赖或数据迁移。

详见 [Pi包清单](PI_PACKAGES.md)。本轮证据：apps/desktop/test-results/goal/pi-packages-review-20261006/closeout.json；既有audit 5项（2 moderate/3 high）仍为发布待处理项。当前教育阶段4/5与完整Goal ACTIVE保持。

## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

practice-review.v1 / education_propose_practice + education_read_practice纵向贯通Repository/Coordinator→production-host/Pi独立持久身份→主frame typedIPC/preload→现有工作台PiPracticeReview与传统PracticeSourceButton。复用ai_confirmation_items(action=pi_practice_candidate)、exercise_sets、question_bank_usage和原saveExerciseSetFromDraft writer，零新增表/列/迁移/依赖/第二编排。候选只接本轮成功实读别名，模型不得指定学生/ID/确认权；题目正文不可偷偷改写，改题先核对题目。确认digest绑定初稿、题目版本/本地父来源、教师最终安排和完整exercise快照；同generation租约、单BEGIN IMMEDIATE、防重/取消/失败回滚。原生身份未知或移除在open前拒绝，压缩只保存状态索引。

Pi包状态保持：pi-web-access0.36.0与@narumitw/pi-usage0.62.0限定生产，pi-goal-x0.32.3安装STAGED，MCP/background候选peer不匹配Pi1.x未force；原生MCP配置、目标Adapter和后台任务仍后续。此教师确认业务复用既有SQLite与Pi customTools，不另装重复框架。DeepTutor当前f07029c（Apache2）固定原quiz格式函数继续通过题目核对使用；OpenMAIC723005（MIT）课堂仍后续。无新依赖/许可证/打包体积增量。

继续复用DeepTutor原quiz纯能力、Pi唯一session和当前合法HeroUI组件；不搬AgentLoop/THINK/Store/Provider，也不引OpenMAIC第二runtime。上游工作树用户改动未覆盖。

Evidence：固定build-c 341文件/SHA 15cba713c2dea8db351973b488c9314909caf31e5ea55d837c525159b0545207，默认out逐文件一致；build/typecheck exit0、统一145/145（education-boundary-wraImL，新增18项）、组件156/156、当前唯一Pi/真实DeepSeek9/9（education-journey-ADH5Jm，3次启动/rendererErrors=0）、旧真实题目核对数据副本3/3（5RLgDA，3题/33→33模型消息，0新增事实）、相关旧业务smoke207/207均当前固定build-c。八张实际Electron浅暗1366×768/1920×1080图逐张查看；核对/拒绝/关闭可达、长内容内部滚动、无横向溢出。完整命令、源码/报告SHA、SQLite读回、失败留存与视觉边界：apps/desktop/test-results/goal/dt05-practice-20261006/closeout.json。领域故障回滚使用真实SQLite测试ports；原writer保存由真实页面证明，不冒称生产OS强杀。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

question-review.v1 / education_propose_questions纵向贯通Repository/Coordinator→production-host/Pi身份→主frame typedIPC/preload→独立PiQuestionReview。复用现有ai_confirmation_items（action=pi_question_candidate）与question_bank_items writer，无新增Schema/表/依赖/第二事实库或编排循环。原始父题完整快照和事实SHA只留本地；确认digest绑定初稿SHA、父来源、教师最终稿及子题ID/版本。同generation租约、单SQLite事务、拒绝/停止/幂等保护确认权。receipt只给脱敏最终发现元数据，答案/解析按既有授权读取。最多8题是单IPC资源保护，不是运行预算。

包状态保持：pi-web-access0.36.0原关键词定位与@narumitw/pi-usage0.62.0原DeepSeek余额查询限定生产；pi-goal-x0.32.3已安装STAGED，现有SQLite目标Adapter后续。MCP/background候选peer不匹配Pi1.x，不force/不引第二SDK；原生MCP配置与后台任务仍后续。当前DT-05不再安装重复出题框架，复用原DeepTutor2文件104953字节/Apache2固定AST纯函数。安装≠桌面已启用。

来源：DeepTutor当前远端f07029cfcf2c8dfccdb671cdfc343db8334f5741/Apache2；OpenMAIC当前7230053af019b89c83d22dcab0a94f38fe193856/MIT只读核验，课堂另按顺序接。原pipeline与LICENSE共104953字节，三个原格式函数按hash/AST提取，零新增npm/pip依赖；第三方用户脏文件保持。

Evidence：固定341文件/SHA e80b3052e86609b0156b7f91f735b534b9ba47c92d04a9cd83b81abdb0190ab2；原源码verify/build/typecheck exit0、统一127/127、当前组件150/150、当前唯一Pi/真实DeepSeek教师核对10/10（education-journey-R7dHLl），3次启动、rendererErrors=0。浅暗1366×768/1920×1080四图实际逐张查看：确认/拒绝与输入可达，窄窗题目字段在内部滚动区，无横向溢出。相关历史回归207/207是在build-a、最终元数据/摘要绑定/重试修复之前，不能当成最终构建全部回归。精确命令、SHA、版本、失败留存、SQLite读回与视觉范围：apps/desktop/test-results/goal/dt05-review-20261006/closeout.json。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 原测验格式能力复用（当前）

Done：DeepTutor固定f07029c/v1.6.13的pipeline.py和Apache许可证原样保存（104,953字节）；AST仅投影QuestionType、三个常量和三个原quiz解析/归一/issues函数体及原decorator，运行原imports/AgentLoop/THINK/Store/Provider均未迁入。question-draft.v1→question-host→既有固定白名单Worker协议→真实原Python→严格输出复核与打包已验证。

格式Adapter是分阶段候选流程的内部能力，当前未注册生产Pi工具/未新增写事实或UI；模型主编排仍唯一Pi1.0.2。宿主固定题型，choice/concept/fill_in_blank/short_answer/written/coding；严格字段/类型/重复键与选项碰撞防止误归一，完整答案/解析超长拒绝而不截断，issues保留。valid只表示格式完整，不证明数学正确/教师确认/保存；来源和学生授权由下一同账本Coordinator决定。零新npm/pip依赖、DB表/迁移/第二Store。

Evidence：npm run verify:deeptutor-question exit0；build/typecheck0、统一108/108（Q99ECJ，含9项新增原函数/真实进程/坏源码/取消等，与既有教育/SQLite/IPC/Pi回归）、renderer146/146。固定341文件/SHA fdda34a0a700f51827110cc796dd6992ce6f40fbcf0f758991665b380fec5f3c，out一致。精确源码/许可证/AST检查/命令/报告/边界：apps/desktop/test-results/goal/dt05-quiz-20261006/closeout.json。未改UI，renderer字节与上一轮build-a完全一致；本轮未执行新候选真实provider/页面/图审，也不以旧207回归代替新功能验收。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 真实题库来源接缝（当前）

question-context.v1复用searchQuestionBank/getQuestionNotebookEntry，两个Pi只读工具education_search_questions/education_read_question。每run主进程发现别名+题目事实SHA；答案/解析按需脱敏完整读取，超长拒绝、异步后重新核版本/租约。SHA不含收藏/分类覆盖层；模型不获原ID/私人字段/假确认。questions:context-source主frame→typed preload→HeroUI来源Modal只在本地展示全文。原生question-context身份在持久SessionManager.open前验证，未知版本/移除能力拒绝且JSONL字节不变；旧未标记兼容。无新Schema/依赖/Store/Loop。

Pi包继续锁定web-access0.36.0关键词定位与@narumitw/pi-usage0.62.0余额限定生产；goal-x0.32.3 STAGED，原生MCP/SQLite目标适配后续，不兼容MCP/background不强装。本轮再次核官方目录，无额外适合本题库权威接缝的包，现有Facade与Pi原工具复用；不把包安装当教育闭环完成。详见docs/integrations/PI_PACKAGES.md。

固定337文件/SHA 674fc8daf1620bfcba385a31f4fe12da9d8326c1993314d292367c494e9134d3；build/typecheck0、统一99/99（pvBYRJ）、renderer146/146、Pi协议8/8（CKxuuD）、当前唯一Pi/真实DeepSeek题库6/6（yTcdQR）、相关历史回归207/207。rendererErrors=0；浅暗1366×768/1920×1080共4张来源页图实际逐张查看，中文题干/答案/解析与关闭控件可达，无横向溢出，仅接受本来源对话框，不接受完整Codex像素/原生动态。精确命令/源码SHA/构建/报告/失败留存：apps/desktop/test-results/goal/dt05-question-20261006/closeout.json。

下一唯一教育任务：DT-05第2项，固定DeepTutor纯测验归一与协议Adapter→唯一Pi可编辑题目/练习候选；第3项同一确认账本教师编辑/确认/原子题库和练习保存及父子谱系（先冻结增量兼容迁移合同）；第4项传统练习/路径/实际结果；第5项完整DT-05与Golden C/F，再MA-01至05→JOIN→Phase6/7/8。完整DeepTutor、OpenMAIC课堂、日常人工、完整Codex/Golden/安装/无VPN仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

Pi包继续复用已锁版本：pi-web-access0.36.0关键词定位与@narumitw/pi-usage0.62.0余额限定生产，pi-goal-x0.32.3已安装STAGED；不兼容的MCP/background未强装。CLI全局安装不构成桌面已启用证据；原生MCP/目标SQLite适配分别后续，详见docs/integrations/PI_PACKAGES.md。

本轮仅增加宿主student-training Adapter与现有确认/记录/FTS的Facade，继续原DeepTutor f07029c（Apache2）算法与唯一Pi1.0.2；新依赖0。OpenMAIC本地636fab/上游723005（MIT）只读复核，未迁入课堂本轮。HeroUI官方查阅/Pro MCP失败后复用当前授权EmptyState/PiTrainingPlan，finesse未找到，不阻塞已有合法组件。

真实红灯发现模型把较早证据当新结果：同一只读分析增加最多20条sourceEvidence（发生时间/结果/宿主核对状态，训练观察先脱敏再截断600字），与当前来源别名一致，不传原ID/digest。另发现rest却带知识点时原generic错误使模型向教师问技术参数：仍严格拒绝，工具返回未提交核对与rest=null/count=0等自修说明，不放宽来源或新建重试Loop。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 当前训练集成

原DeepTutor f07029c/v1.6.13 scheduler等实际算法继续，经唯一Pi1.0.2/真实DeepSeek起草训练；EduDev宿主适配目录、来源和教师确认。不是迁入LearningStore，也不是经校准FSRS；未改vendor/OpenMAIC。本轮无新依赖/SDK升级。Pi包web/usage限定生产、goal-x staged、MCP/background兼容决定保持，详见PI_PACKAGES.md。

training-plan.v1作为原learning-review strategy v1可选嵌套字段，旧无plan兼容；原工具名称/native marker/同库ledger/digest/版本/取消租约/typed IPC保持。宿主解析本轮知识点别名固定真实目录，提议与确认检查快照及版本，教师不得造来源或删除计划转普通策略；过期计划只读历史。无新依赖、DB表、Store、Loop或第二学生页。latest plan重新实读并声明sourceCurrent/strategyCurrent/teacherConfirmed/completedPractice=false。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 当前包切片与取消门禁

Pi包选择/安装/兼容与实际接入，以PI_PACKAGES.md为稳定目录。web-access0.36.0/usage0.62.0直接复用原发布源码，MIT/SHA/build同步；goal-x0.32.3仅staged。MCP扩展/adapter/background当前不兼容Pi1.0.2未安装，原生MCP无实际服务器连接证据。


## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：实际融合程度逐项对齐官方清单，见CAPABILITY_MATRIX/EDUCATION_BRANCH_TODOLIST最新功能表；既有检索/引文/学生上下文/算法/教师核对与历史已融合，完整测验、学习路径、两周训练、视频及互动课未完成。本轮修复恢复旧会话时先写入后校验的问题：全部学生/学习/核对范围和工具先验证，复用Pi公开解析及内存SessionManager迁移后才持久打开；未知分支/版本、错学生、移除或错工具拒绝且JSONL字节不变，未绑定普通聊天保持空范围。无需新依赖/Schema/Store/循环。

Evidence：固定337文件/SHA 806bfe0dfc046374c13ef86434ca16e55193c09621a2b76582b7e5cea6b30df4，build/typecheck exit0、renderer133/133、统一边界64/64（新增7项原生身份）、本轮真实DeepSeek教师核对/冷恢复/事务退出回滚11/11、历史回归207/207。正式4次隔离Pi启动、rendererErrors=0；4张当前浅暗双尺寸图实际查看，1366暗图确认按钮需卡内滚动，本轮不接受完整Codex动态/像素效果。完整命令/报告/SHA：apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/closeout.json。

Doing/Next：生产宿主并发取消/确认门禁→完整DT-03逐条接受→DT-04两周训练（真实证据→教师修订确认→本地计划→冷恢复）→DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8；Phase3UX欠项保持OPEN，不转回模拟样例或只做底层测试。

Failed：前置测试脚本转义/重复导入已修，最终上述门禁无失败；旧失败报告保留。Blocked：无当前外部阻塞。

Runtime：npm start exit0，默认out与固定构建一致；单个日常main PID60468创建于2026-10-05T21:07:20.5459380+08:00并加载默认out/main/index.js，未读取或注入日常事实；日常DOM/人工、安装/无VPN与完整Golden仍未验。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

以下保留历史，当前状态以上述记录为准。


## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

本轮复用Pi1.0.2、同库learningReview Repository/事务Facade、既有主frame权限及学生来源导航。DeepTutor文件LearningStore不是学生确认ledger，不迁移；OpenMAIC课堂版本不参与校正真源。Pro MCP仍传输失败，使用现有授权ChatSources/Disclosure/HeroUI按钮；官方HeroUI v3 API已核。无新依赖、许可证或Windows打包变动，第三方工作树未修改。

以下保留历史，当前状态以上述记录为准。

## 2026-10-05 学习校正与复习策略（本轮）

DeepTutor固定f070原grade_answer/classify_error只在有结构化作答/参考答案/题型的本地记录上运行，提议而非确认。原评分修正的候选由工具回执明确区分于模型初稿；教师最终校正从既有脱敏分析工具重新实读，无新模型调用入口。无新依赖/第二Loop/Store。2026-10-05只读upstream复核DeepTutor仍f070、OpenMAIC723；本地第三方未改。Pro MCP仍gateway传输失败，复用现有Pro ChatTool和表单状态。

以下保留历史。


## 2026-10-05 DT-03 原学习算法与真实证据（进行中）

固定DeepTutor f070学习原函数与Apache-2.0，6文件78198字节；stdlib DTO机械投影和纯Worker，无新增npm/pip依赖，不迁移LearningStore、AgentLoop或Pydantic验证器。Pi1.0.2仍唯一编排；已有DeepSeek接口/本地密钥配置未改。正式只读工具、旧能力身份兼容、原算法边界38项已过。

以下保留原历史。


## 2026-10-05 用户确认新版学生页：识别与实例复核

此轮只补默认构建正式Pi的UI识别测试，无新外部集成、provider请求、凭据或权限改动；DeepTutor/OpenMAIC能力顺序不变。见docs/design/CURRENT.md。

以下既有记录保留原历史范围。

## 2026-10-05 DT-02 学生上下文与新版页面（最新）

正式Pi1.0.2继续唯一生产编排；新增education_read_student_context只读能力和学生独立native marker，严格参数不含studentId/name/path/SQL，授权由main会话闭包给出。复用现有已知个人信息脱敏、HeroUI Button与资料来源模式。固定DeepTutor f070身份域参考不搬LearningStore或AgentLoop。API/凭据/网络未改，真实DeepSeek学生实例9项通过；OpenMAIC SDK集成未完成。

以下既有记录保留历史范围，当前状态以上述记录为准。


## 2026-10-05 DT-02入口修复与新版页面统一

本轮复用已有学生typed IPC/SQLite和五空间HeroUI布局，未新增依赖或替代实现。统一教育runner复用真实Pi主进程核验/视口控制/冷恢复，强制五空间证据标签；学生保存反馈属UI适配。DeepTutor f070纯阅读已接，Learning学生事实Adapter为下一项；OpenMAIC636fab0仍审计阶段。


## 2026-10-05 DT-01b 正文搜索与来源定位

DT-01b直接继续复用f070原search.py/models.py，原3文件SHA/39,486字节核验通过；worker添加独立search.v1，原quote.v1不变。原码不改，新协议/权限/定位在Adapter，未引新的npm/pip包。Hana教育脱敏与执行一次继续复用，HeroUI现有资料/按钮接真实typed来源。OpenMAIC固定636fab0仍仅审计，下一按SDK清单推进。

历史条目保留原范围；当前进度以上述记录和 Master 为准。

## 2026-10-05 能力支线恢复与 DT-01a 引文核验

新复用：DeepTutor f070原search.py/models.py/Apache LICENSE共39486字节，无额外pip/npm依赖；manifest固定SHA，worker隔离加载，桌面build复制源资产。旧1.5.11 vendor、本地DeepTutor5份dirty文件未改。OpenMAIC本地main与远端636一致，仅包级审计，不宣称已安装。

Goal ACTIVE。按本轮用户纠偏，当前工作转为 Phase4/5 能力支线；Phase3欠项保留OPEN，不因切换优先级记完成。详细顺序：docs/goal/EDUCATION_BRANCH_TODOLIST.md；当前限定验收：docs/goal/PHASE4_DT_01A_ACCEPTANCE.md。

Done（限定A/C）：固定新版DeepTutor源码的只读引文核验已接 Pi / EducationCapabilityProvider，真实DeepSeek正反核验、持久结果与冷恢复通过；11边界、12相关工具回归、133组件、正式Electron4场景及5张静态图审。原Python源码/Apache许可证逐字复用，无第二Loop/Store、新依赖或Schema。学生个性化/Golden F、OpenMAIC SDK/Golden E仍OPEN。

Next唯一：DT-01b，复用同一原版search_units补全资料正文搜索与来源定位；再DT-02学生真实事实→DT-03掌握度/复习→DT-04两周训练→DT-05题目/学习路径；随后MA-01 DSL本地合同→generation→renderer→编辑/导入→真实互动课堂。不能回到旧模拟样例兼容循环。

Failed/Open：原legacy全套smoke最新exit1（题本SQLite回执早于React显示）；两处断言已改为等待真实DOM，未全套重跑，不能声称207通过。Phase3完整39项、备课本全图审/整体验收、完整Goal/无VPN/安装/许可安全/人工仍OPEN。正式首4次图审失败与第五成功均保留；最后一次最终构建验收报告见closeout，不能宣称连续稳定。

日常版本统一：npm start/根启动小智.cmd先成功构建后开当前out，旧dist可恢复归档，release不跟随旧dev URL，单实例聚焦/版本变化重启；owned验收窗口隐藏。此前日常入口5/5有限验收、两图审及备课本独立8场景通过，不代表完整Phase3。默认out本轮有意更新；未清空日常事实、改密钥/供应商/DNS/proxy/VPN或提交/push。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55，工作树保留既有改动。

## 2026-10-05 P3-04：资料收录、全量目录与真实正文工具接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-04仅资料收录、全量目录与正文工具实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。以下为当前生效状态，后文各轮记录保留历史范围。新接口只取真实本地事实，旧模拟业务兼容与测试样例书专项不再投入，不自动补回演示种子。

本轮复用现有Hana0.449.0（Apache-2.0，source-manifest/NOTICE保持）、AnyDoc0.1.2（MIT，已锁定native Windows）和Pi1.0.2；无安装/下载/依赖变化。DeepTutor本地be1701108a22c1037bb8004322ef6145302cbf5e（Apache-2.0）ParseService与OpenMAIC本地636fab0d7edee5e7c2694117c38ece8f623573f9（MIT）MinerU接缝只比较，保两仓既有脏改，未搬独立Runtime。HeroUI Pro MCP transport失败，直接复用已有组件/CSS/util与官方OSS Pagination API；finesse不可用不冒称应用。

官方来源：[AnyDoc](https://github.com/firecrawl/anydoc)、[AnyDoc本地解析说明](https://firecrawl.github.io/anydoc/)、[许可证](https://github.com/firecrawl/anydoc/blob/main/LICENSE)、[DeepTutor知识接缝](https://github.com/HKUDS/DeepTutor/blob/main/KNOWLEDGE_MIGRATION.md)、[OpenMAIC ETL RFC](https://github.com/THU-MAIC/OpenMAIC/issues/621)、[HeroUI Pagination](https://heroui.com/en/docs/react/components/pagination)。RFC不是已完成实现证据。

Pi工具：office_list_materials与office_read_material从同一SQLite事实按ID/offset只读已提交正文，严格拒绝路径/额外参数/学生库/任意SQL，按当前run及AbortSignal校验，复用Office教育脱敏和Hana execution-once。正文工具一次一块、最多12000字符，返回真实版本、段落来源、nextOffset；teacherConfirmed=false、originalPageLocated=false，不冒称教师确认或原页码。xiaozhi.education.material-read.v1独立marker位于既有snapshot/fingerprint之后，原native JSONL与创建身份不重写，未知/缺失能力拒绝。真实DeepSeek持久最终回答与成功“读取资料库正文”回执均已核验，不用检索摘录冒充全文。

边界：PDF只接受已验证文本层路径，扫描OCR未完成；旧doc/xls/ppt不支持。目录查找按全库名称/格式，不是资料全文搜索；Unicode归一仅查询侧，SQLite lower不承诺全Unicode等价。原生选择单批50文件、既有15秒/50MiB输入/1MiB解析输出均为工具边界，不是运行预算。资料收录不等于教师确认；失败保留旧已提交派生正文且不伪称ready。教学Office产物目录仍最近100份，完整分页待后续合同。日常安装、无VPN、WPS版式、人工、全Codex体感、安全/许可、完整教育Golden均OPEN；未以隔离验收替换日常out。

Evidence：固定build9，323文件/SHA 52d6321cd1b974c26ae4ce8c06459bb157744a1660851d54475893780e193f9e；正常build/typecheck exit0，renderer129/129、资料/Office工具边界12/12、真实DeepSeek正式Electron工作台31/31、原教育隔离legacy-test回归207/207，均独立exit0。31项report.success=true/rendererErrors=[]，四次实际独立profile启动、当前构建/脚本指纹与main已加载模块核验；207本轮确实在最终build9重跑，不能作为新教育黄金闭环。37最终PNG归档，其中21张逐张视觉审阅，覆盖本轮资料空/正文/失败/冷恢复及正文工具浅暗1366×768/1920×1080；其他16张只归档。本轮控件可达/可读，不宣称全部Codex像素一致或全页WCAG。归档：apps/desktop/test-results/goal/phase3-ingestion-20261005/closeout.json，SHA 36d6820c3685aef39c4c6b6f85a38efbb1ab11ef7f1d513b29b09d1ae7238585；精确命令与失败见PHASE3_PRODUCT_SPACES_CONTRACT。

Next：P3-05，整理传统备课、讲义、题本与学生页面的教师操作体验，盘点实际 typed 入口、业务事实和失败状态，先冻结增量合同，再逐切片实现与验收；随后完整Phase3验收，再Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。Pi保持唯一生产编排。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55。本轮开始HEAD为20aa86656cdb5a0f85e0e11fa21863b50233fcb1，执行中观察到外部提交推进，保留其内容；本Agent未提交或push。Master2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302保持。daily out323文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981本轮未变；P3-03曾意外重建并精确恢复的历史保留。没有新Schema/依赖/vendor/密钥/供应商/系统DNS、proxy、VPN变更，没有清空日常数据。


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

三项目复用计划仍以Master为准：DeepTutor教育纯函数（本轮继续使用固定question/pipeline.py AST格式校验，Apache-2.0，来源manifest已有）；OpenMAIC课堂DSL/Renderer在课堂支线接入；Hermes用于后续偏好学习/版本/回滚。Hana是额外安全工具与文档参考，并非Master第三项目。当前集中审批是EduDev本地主进程授权语义，不搬三方AgentLoop或数据库。无本轮新下载/复制第三方源码或依赖安装，不能把计划说成已迁移。

## 2026-10-16 BoardUI 复用复核

集成记录：`OfficeToolProcess` 仅对全组联网工具使用 BoardUI 过程视图；教育/浏览器/旧工具视图保持原路径。来源打开仍使用既有 typed IPC，未新增主进程通道或第二运行时。
