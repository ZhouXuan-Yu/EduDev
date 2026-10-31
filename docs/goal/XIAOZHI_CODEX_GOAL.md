# 小智 EduDev — Codex Goal Master Prompt

## 2026-10-31 40GiB最终主线整合

正常整合origin/main ef55c53为03f4654，14处Markdown冲突保留双方完整证据，4个知识导入生产文件与a3667ce一致。整合后build（含typecheck）、240组件、协作者11项源码/4项真实Windows PDF、空间恢复UI3项、40GiB旧库再开3项均exit0；207/207属于整合前a3667ce，未重复运行，不冒充最终合并验收。再开首次尺寸断言超时保留，测试改为页面所属窗口并记录native/CSS/DPR，后续两尺寸通过，未宣称产品窗口缺陷修复。合并后混合首查3963ms、重启后4543ms，40候选仅重排20，速度/召回质量仍未达标。知识库切片无新依赖；上游明确直锁已安装unpdf1.8.1，故最终锁文件发生上游变更。audit仍45（8高29中8低/0严重，exit1）；0新增付费/上传。完整Goal保持active、完整AT新增0、D盘日常树与安装包未更新。下一步处理混合冷启和候选覆盖，再复现Pi/原题旧页数/字节限制。完整历史、失败及最终构建指纹见docs/research/KB_BYTE_CAPACITY_20261031.json#finalIntegration。

## 2026-10-31 40GiB字节容量与磁盘恢复

生产修复da20965+a3667ce：空间不足首次停止并保留pending/未扫描目录，重启后重试；单文件权限问题局部失败，SQLITE_FULL后清理确认无事实引用的未发表副本。失败批次只提供重试，暂停仍提供继续。无新依赖/IPC/表/付费/云端资料发送。9项Store回归及正式空间不足界面3项通过。

冻结3192261生产构建，4批10GiB累计42949672960B/40份/40页，原件SHA、正文、逐段冷启均通过；30GiB后曾因检索控件定位超时中断，数据和失败保留，复用原库完成40GiB。14次关键词UI观测48–603ms；仅6040B有效合成正文，不能当自然40GiB质量/大文本Recall/P95或单次40GiB文件夹。新构建再开40GiB库逐源40次命中、实际本地混合检索/原页图/冷启3项通过，0renderer；但混合首查4001ms、重启后5963ms，40候选仅重排20且complete=false，仍未满足快速/质量目标。

整合ef55c53前a3667ce生产源码build/type、240组件和207/207综合smoke通过；综合为legacy-test，生产资料UI（Pi启用）单独验证，不含本轮Pi Agent对话。audit45（8高29中8低/0严重，exit1），锁文件未变。完整Goal保持active，完整252AT新增0，日常D盘/安装包未更新。新旧指纹、精确命令、失败、内存采样与范围见docs/research/KB_BYTE_CAPACITY_20261031.json。下一优先优化已实测混合冷启4–6秒及20候选覆盖，再复现并修复Pi/原题旧50页/50MB消费链，接续自然质量/教师正文修正及安装；回退本轮两个生产提交可保留事实，无迁移。

## 2026-10-31 E06真实PDF页面与Word缺口（第四切片）

原Pi交付前及原文件面板现可检查PDF原字节的真实物理页数/逐页文本，并由Windows.Data.Pdf逐页栅格化，沿原PNG缓存、页选择、放大、历史和冷启读取。扫描页没有文本层时内容/数值/事实明确未检查；PNG尺寸读取实际IHDR，兼容本机150%显示缩放。Word只读副本→原生PDF薄适配已接入，但本机原生导出仍超时（不加入Job的30秒诊断亦未完成），生产Word等待限制15秒并明确未检查；不能称Word页面已实现。

实现1d86357，已正常整合主线3192261为7bb8671，无冲突。原生PDF4项、检查源码11项、240组件及构建通过；原正式输入→检查→一次整包确认→精确SHA保存→文件面板实际第2页/两视口→重检→冷启与扫描页/错页6项通过，同批成果续测停止2项exit0（2137ms含完整停止观察），最终Word超时/进程清理反馈2项exit0（0页，非正向通过）；首套UI因旧停止按钮断言exit1仍保留，不冒充整套全绿。最终源码9ebc430，合并build/type、240组件、11项源码通过，删除Word全局Options写入后的最终Vite构建及上述续测通过。完整AT仍未执行，新增已实现0/252，完整Goal保持active。证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#pagedDocumentSlice。

已安装的Hana间接依赖unpdf1.8.1明确直锁（MIT，JS文件合计2141399B），不安装可选canvas；无新Runtime、业务表或IPC。PDF60秒/Word15秒、16MiB/64页、PNG3MiB/合计96MiB，沿原8槽和取消；仅处理派生副本，原文件SHA保持。主renderer7175.29→7175.68kB的0.39kB变化来自主线资料面板，本片无renderer修改；合成3页本机原生渲染1541ms、扫描页827ms，仅单次样本，未测流式/P95。0新增付费；audit45（8高29中8低/0严重，exit1），未自动升级。

继续位置：E06 Word原生导出原因与实际成功路径、WPS、逐字缺字/语义遮挡、全教师要求绑定与混合终态；随后E07/E08+C及W3集中验收，保持28组252项原范围。D:/WorkProject/EduProject日常程序和安装包未更新。回退本片原生适配/检查接入可保留既有正式文件、检查读器与可选PNG索引；不删除业务表或成果，整提交回退未独立演练。

## 2026-10-31 混合图题正文召回与质量复核

正文召回切片：3c536ff分离AiPageView转录与题目状态，7743efe补数字/字母空白边界；正常合并主线7dc04a8为25888a1，保留Office实际页面检查。旧真实页派生正文0→1（2031B），3题定稿/1图题待核及全部原OCR/两遍/题库事实不变；最终同页读取与重启通过，0新增付费/上传。最终build/type、240组件、27页检查+6一致性（Node7/7、0skip）、实际混合页6项及真实保存页4项均通过。207/207综合和17检索/13归档/7目录/11协作源码属于25888a1，后续空白修复按最终专项/界面验证，不冒充重复全量。精确命令/源码/指纹/失败见docs/research/KB_TRANSCRIPTION_RECALL_20261031.json。 40GB/自然Recall与P95/完整质量及安装仍未完成，Goal保持active、完整252AT新增0；audit45（8高29中8低/0严重，exit1），无新依赖，D盘日常与安装包未更新。

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

## 2026-10-31 E06真实交付检查（部分实现）

原Pi已贯通候选实际文件检查、失败返回原循环的每类最多两轮修复、原一次审阅及精确字节保存；教师改稿重新生成核验，原卡片可查逐项/过期结果。源码11项、240组件及正式界面路径已有证据，最终整合检查见`docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json`。Office实际渲染、持久视觉证据、全教师语义绑定及混合终态仍待补齐；E06保持部分实现，完整28WP/252AT Goal继续，新增已实现0。无新依赖，0真实付费请求，未更新D盘日常版本及安装包。

## 2026-10-31 重排冷启动工程更新

源码10e6f10复用现ONNX实例在后台完成原完整启动，避免60秒教师停顿即重启；2GiB准备/1GiB释放、10分钟空闲上限与取消/失败恢复均有实证。正式同小样本流程首次查询本轮170ms/重排116ms，前轮4815/4704ms，非严格A/B/大库P95；模型空闲工作集约863MiB，低内存仍会释放。build/240、25生命周期与模型检查、8来源竞态、实际Electron六项通过；综合回执见KB_IMPLEMENTATION_EVIDENCE.md及research/KB_RERANKER_WARM_20261031.json。未增加业务真源/模型/依赖，40GB/自然质量/安装和集中252项状态不因此完成，完整Goal继续active。

## 2026-10-31 原页图片容量切片

29b4d07将新AI原页输入由SQLite Base64迁为本地SHA去重文件，复用现SQLite/文件真源、读取证明、Windows锁、备份及Pi，不引入第二知识库或服务。最终真实教材6项/双页题库7项贯通检索、原图和冷启；同SHA输入SQLite336636B→0、本地252475B。旧inline记录兼容不强迁，新模块覆盖100%行/82.98%分支，详细门禁及综合回执见KB_IMPLEMENTATION_EVIDENCE.md与research/KB_AI_IMAGE_FILES_20261031.json。完整Goal及集中252项不因此提高：首次检索仍4815ms，10GB→40GB/自然质量/受管安装未验收，继续active。

## 2026-10-31 M04/M10工具核验性能工程更新

实际CPU证据定位同步技能包证明堵塞主循环，源码5b4343b沿原Pi/SQLite/FTS/Lance修复为可取消异步完整核验、减少冗余路径/内容重读，保留全部当前哈希与来源权限。不增加服务/依赖/迁移。实际目录→整页→检索→Pi实读引用→冷启5项通过，工具搜索664ms/读取464ms；首次语义重排4308ms、启动间隙1951ms仍待优化。主线4d1f3ce协作E05已保留，完整Goal及252项集中验收状态不因本片提高。大样本、自然质量与安装未通过；本轮证据见research/KB_TOOL_IO_20261031.json及KB_IMPLEMENTATION_EVIDENCE.md。

## 2026-10-30 E05与知识库主线最终整合

正常整合origin/main28ef069为f30212f，保留双方知识库正文来源与E05真实计算报告代码及13份Markdown完整新增节。合并后的build/type、240组件、20知识库页边界、E05正式Electron5项均exit0，0renderer错误；实际CSV/HTML/XLSX一次确认、所有文件账本回读、两尺寸预览及冷启0模型重放通过。最初KB专项因Node缺transform-types前置失败，按原脚本补正确参数后通过，未改协作源码。207综合仍属于合并前本轮代码，不冒充本次合并后重跑。 本地合并脚本曾未在失败后停止，误含标记的未推送提交已修正；全树标记与diff检查通过，未强推、未动其他已检出分支。下一仍E06→E07/E08+C→W3集中验收，新增已实现0/252；D盘日常版本及安装包未更新。详[最终整合证据](../research/AGENT_COMPUTATION_REPORTS_E05_20261030.json)的integration。

## 2026-10-30 E05类型CSV、图表与正式报告

实现b3170f8：类型化CSV显式声明文本/数值/空值；真实隔离计算得到30/200/10与合计240，001/002/003、带逗号备注和公式样文本保留。新增education_create_report直接引用本轮实际结果生成CSV、离线SVG/HTML与可编辑XLSX，复用原一次审阅/整包保存及独立文件账本核验；模型仍沿原脱敏输出。输入/代码/结果SHA与运行版本进入依据，临时结果清理不影响正式文件，过期/跨run引用不得发布。无新业务表/DDL/依赖或第二Agent循环。

最终build/type、8项实际进程/CSV/真实XLSX专项与正式Electron5项exit0，0renderer错误；一次原整包确认后真实文件回读通过，文件面板开图及冷启0模型重放。240组件与一次207/207综合exit0，在最终生成HTML窄栏样式调整前通过；后续最终build/8专项/5正式UI复测通过，不冒充再次运行综合。audit既有23项（0严重），0真实付费模型请求。 下一E06交付前结构/内容/视觉/交互/数值与整包核验及有界修复，再E07/E08与贯穿C，W3集中完整AT。E04/E05与252项仍未集中验收，本轮新增“已实现”0；保留知识库并行进度。D盘日常构建与安装包未更新。 详[进度](WORK_PROGRESS.md)与[本轮证据](../research/AGENT_COMPUTATION_REPORTS_E05_20261030.json)。

## 2026-10-30 最后主线整合42ac7be

最后刷新main83cf832（受管版本/FIFO计算），合并为42ac7be；13份Markdown同位置新增节冲突已逐项保留双方内容，preload自动合并已核对。该源码重新build/type、240组件、20页边界、目录→Pi来源→冷启五项均exit0（iLCx7P，原OCR183B、两视口、0renderer错误、每次2受控JSON/3受控SSE、0付费）。新小样本4资料、重排3候选，查询3918ms/重排3349ms，不能与4候选旧样本当提速A/B。207综合exit0仍明确属于fc2fd0d；未冒充最后这次无关受管版本合并后重跑。代码与新构建指纹见公开JSON latestIntegration。

## 2026-10-30 AI整页正文进入现检索与小智（M04/M10）

已接通目录原图两遍处理后无习题教材页的全文/混合检索、小智真实工具读取、实际阅读引用和来源原图回看。复用现FTS5、LanceDB/本地ONNX、检索事件及原Pi，没有另起知识库或Agent循环；OCR/题库原事实不改。实现6bf344a RED→5072464 GREEN，批判性反例d767b3d RED→64b2527 GREEN；d553746补到期队列索引及正式Electron旅程。整合协作E04为fc2fd0d，保留受管工具、身份装配及其他工作树。

性能/质量仍OPEN：零习题原文检索从0命中变1；最终四份资料查询5860ms/重排5593ms，另轮2570/2393与5528/5496ms，不是同条件提速或Recall/P95。最终受控Pi请求间阶段约15.7s/8.9s；另轮原生来源接口冷读10.2/6.6/5.2ms且冷启整轮哈希保持，日志工具执行搜索5939ms/读取3664ms，须定位重排与工具包装/上下文开销。长文沿现11000字符重叠切片、512token窗口嵌入，无静默截尾；单次发现8/处理4、到期部分索引实证仍不等于40GB资源上界。40GB长跑/自然质量、独立图片失败、复杂图题/跨页/答案册、人工修正AI教材正文与受管安装均继续。AI图片入SQLite的重复体积及前后台向量调度仍需规模审核。本轮0真实付费（此前累计20），未上传素材。

## 2026-10-30 E04版本生命周期工程更新

实现8587057；真实双版本冻结/升级/回退与2进程FIFO队列已贯通现设置、typed IPC、Pi和隔离子进程。build、8+12源码专项、240组件、正式Electron5项通过；综合日志207/207（shell退出回执未跨轮保留），讲义既有间歇断言本次未复现。完整AT仍未集中验收，新增已实现0。后续E05图表/CSV/正式文件；精确事实见[WORK_PROGRESS](../goal/WORK_PROGRESS.md)与docs/research/AGENT_MANAGED_TOOL_VERSIONS_E04_20261030.json，D盘日常版本未更新。

## 2026-10-30 E04首个受管工具与E05基础计算

首个受管免费组件quickjs-wasi3.6.2已贯通现设置/typed IPC/Pi工具：真实缺失/可用/需授权/不支持/故障分类；固定官方包下载568844B、SHA校验、只取637405B WASM、隔离进程实际健康检查后原子激活。同版本共享准备、独立消费者取消、在用卸载锁、离线冷启可用。education_compute缺组件时同run自动准备后真实计算，不再只返回口算文字；结果240、文本00123和非法域检查已实跑。无新业务表/第二Agent循环/系统Python安装；现Pi间接依赖明确锁为生产直接依赖，版本未增加。

实现f58f5ff，最终主进程兼容停用/故障卸载接缝59b32e9。最终build/type与12源码/真实组件专项exit0；正式Electron5项及240组件在f58f5ff通过，后续renderer未改，非最终重跑。UI从现设置看到缺失→同任务真实官方下载安装→240结果→UI卸载/准备→冷启0下载/0模型调用，0renderer错误，1366/1920截图保留。0真实付费模型请求；npm audit既有23项（0严重），未自动修依赖。证据docs/research/AGENT_MANAGED_TOOLS_E04_20261030.json。

下一继续E04兼容版本升级/冻结/旧版回退与计算全局并发队列，再完成E05图表/CSV策略/转换及原审阅正式文件发布；不把当前纯JSON计算当已交付图表或正式文件。完整E04/E05/252项未集中验收，新增已实现0；继承的讲义description保存综合断言失败仍OPEN，未声称207全绿。D盘日常构建/安装包未更新，知识库并行成果保留。

## 2026-10-30 E03长源、追加、目标选择与真实压缩

新增read_teacher_request，原请求/已应用追加/已回答问题均沿原SQLite事实，可分页发现旧来源并精确分段重读；全文先脱敏再分页，ID/版本保持。追加按实际送达顺序记录，旧无顺序记录明确未知，撤回/未应用不进入当前要求。复用原ask_teacher选择第二份独立课件后局部改页。修复手动压缩无taskRuntime误换控制提示词指纹的真实配置失败；按已知原提示词精确恢复，未知权限/工具/指纹仍拒绝。无新表/DDL/依赖、第二循环或新审批。

实现214e478/99f82d2，最终修复与验证源码2b0ac36。最终build/type、5源码来源边界、8压缩/身份检查通过；正式Electron首批10项在214e478通过，压缩入口夹具失败保留；实际菜单补跑暴露身份错误并修复，最终在同一真实库/四份PPT上补跑压缩→来源发现/完整重读→冷启3项通过，0renderer错误。240组件为214e478有效基线，后续renderer未改，未冒充最终重跑；207综合未本轮重跑。证据docs/research/AGENT_REQUEST_CONTEXT_E03_20261030.json。

下一进入E04→E05，按用户要求继续功能对齐，E03完整会话切换/必要澄清/固定FX与贯穿C03恢复等在W3集中验收；本轮新增“已实现”0，E03/P1/252项仍未完整验收。0真实付费请求，D:/WorkProject/EduProject日常构建与安装包未更新；保留并行知识库进度。

## 2026-10-30 OCR原页补救已接入，完整Goal继续

沿原执行器/统一模型接通PDF空白失败乱码页整页还原、v5原页来源、同库/Pi及题本原图正文回看；真实两次提示调用与受控正式界面六项是有限实证。未改变本地优先/原始OCR保留、疑点待核和正式整卷集中确认。普通还原正文全库索引、独立图片失败补救、复杂图题/跨页、自然质量与40GB/P95及受管安装仍须继续，不能把提示词或小样本当完整交付。精确进度仍以WORK_PROGRESS/EVIDENCE为准。

## 2026-10-29 E03任务承接与真实局部改稿（仍部分实现）

实现935ade8，兼容修复69ac211，正常整合主线fb724c4；最终脱敏接缝修复至34fe169。最终build/type、真实Electron/合成SSE六项、源码/磁盘与正文脱敏九项、压缩身份六项通过，0renderer错误；任务/目标存储各八项、240组件与207综合为69ac211有效基线，未冒充最终脱敏接缝后重跑。真实文件独立对比：仅slide4.xml变化，其余七页XML与全部备注相同，旧文件保留；HTML实读后差异审阅保存，PPT不变，冷启零重放。证据docs/research/AGENT_CONTINUITY_E03_20261029.json。

下一继续E03：超4000字原请求在压缩后的精确分段重读、已应用队列追加的来源/时序上下文，再补多目标选择与压缩/切换/必要澄清完整路径；对齐后进入E04→E05。现read_session_process明确不含原问题，不能把索引截断当完整保持。E03/P1/252项未集中验收，新增已实现0；0真实付费请求；D盘日常构建未更新。C03恢复/外部成果备份仍贯穿W3前补齐。

## 2026-10-29 默认成果备份与停写已接通

默认生成文件已纳入原设置页备份/校验：manifest.v1带schema1的conversationOutputs引用信息，包含真实HTML/PPT并显示数量；同名会话文件隔离、另一实例不扫描、源变化/链接/递归目标拒绝，旧v1清单兼容。新增启动停写开关OMNI_EDU_XIAOZHI_FILE_WRITES=0，保留native装配和读取/核验，只阻止自动文件提案/批准/执行/撤销及Pi复制门；无新表/依赖。

下一优先E02→E03，继续W1功能对齐。C03独立目录恢复/激活与外部成果备份保留为贯穿待办，在W3集中交付前补齐：须迁移默认成果路径、文件事实、任务与native身份并从正式UI读回，不把复制备份当恢复完成；不将全量恢复迁移加为E02前置。外部教师自选工作目录尚需单独备份；HTML预览可用但office_read_text不支持HTML源码，E03须补读取接缝。完整C03/P1/252项未集中验收，新增已实现仍0；D盘日常构建未更新，不覆盖KR主线。

## 2026-10-29 整包交付接通，持续Goal未完成

E01整包工具已贯通原文件/Office服务、schema1引用元数据、typed IPC、正式整包卡和saved_bundle全文件独立核验；2–8份草稿一次审阅确认，PPT改稿使旧确认失效，拒绝不写新文件。HTML成功/PPT失败保留部分成果；可见续做进入新轮，只重提未完成PPT，HTML账本数/文件mtime不变。未知PPT提交先只读核验，已落盘文件不重写。连续事件刷新原8次重试误失败已修为有界等待稳定，不能只用DB状态宣称界面通过。

下一：C03默认产物备份/迁移与兼容停写，然后E02→E03；P1功能齐后集中AT。本轮仅E01.08/.09更新部分实现，完整AT仍未执行，新增已实现0/252。真实只读目标、8文件/64清单规模、子草稿未全部准备时的中断、多层续做历史、自然质量、WPS/安装与D盘日常运行尚未验证；不覆盖知识库并行进度。

## 2026-10-29 精确PPT页与备注切片

继续既定Goal，新presentation-draft.v1已贯通准确页数、独立讲者备注和本地审阅修改/保存/实际读取。原生PowerPoint8页渲染及编辑另存重开通过，完整P1/252项仍待集中验收。下一E01整包审批/失败续做与兼容回退，再E02/E03；无新付费模型额度调用，不覆盖KR主线。


## 2026-10-29 持续Goal实施已启动

按XIAOZHI_AGENT_DELIVERY_GOAL.md与四份规格执行，W0/E01已开始实际功能实施。默认产物区/通用HTML专项与正式受控UI通过，仍为部分实现，完整252项未判通过；后续精确PPT页/备注→整包交付→E02/E03，阶段集中验收。当前工程证据见research/AGENT_DELIVERY_E01_20261029.json及WORK_PROGRESS，旧KR主线状态保留。

## 2026-10-29 用户后台与质量要求更新

知识库目标增加明确口径：完整目录树后台静默持久处理、只返回必要结果，耗时可长；本地OCR与DeepSeek对原图还原复核，不能将语句通顺当内容正确。当前归档有界化与还原提示切片通过范围详WORK_PROGRESS/EVIDENCE；完整目录自动AI/质量就绪、复杂图题、40GB与最终安装继续OPEN，不改总体完成定义。

## 2026-10-29 新能力顺序执行Goal入口

本能力任务目标见[XIAOZHI_AGENT_DELIVERY_GOAL.md](XIAOZHI_AGENT_DELIVERY_GOAL.md)，含四份规格、依赖顺序、轻量审核和达标已实现规则；不覆盖本Master产品/数据边界。当前仅编写目标，252条仍未执行；进入执行后按W0–W5推进，已授权动作不重复申请，实际越界才暂停相应动作。

## 2026-10-29 用户要求完整能力任务书与验收

按最新确认通用执行→理科→全科，完整细粒度规格入口../product/PRD-XIAOZHI-AGENT-DELIVERY.md；252需求/用例均未执行。本规格沿M01–M12/Pi/SQLite与本地文件真源，不改正式整卷集中确认，不将旧KR未完成改为完成，不自动扩费用/发布/多Agent范围。此轮仅规格，运行代码未改。
## 2026-10-29 当前知识库证据入口

本轮真实扫描页文字纠错、自然查题及单题四文件交付限定通过；WeKnora完整Windows Lite对照已完成，仍不足以直接切默认。完整目标保持ACTIVE，40GB/自然高召回/图题与跨页/受管安装仍OPEN；最新事实与执行顺序以WORK_PROGRESS、KB_IMPLEMENTATION_EVIDENCE和research两份20261029匿名证据为准。

## 2026-10-28 Hana回答优化独立切片

用户本轮要求以Hana为核心吸收DSH/SourceWeft优势，新增独立M10/M12回答优化切片，合同 HANA_ANSWER_QUALITY.md。保留唯一Pi、本地数据真源与现有教师确认边界；不改变并行KR知识库任务或将其未完成问题记为已解决。工程接入与整体质量验收分别登记。

## 2026-10-29 真实四文件与候选运行检查点

真实两题试卷现经Pi/界面测试审批交付学生/教师Word/PDF四份，独立完整内容/A4/答案隔离及重启谱系通过；旧configuration没有复现但根因未证。AnythingLLM九文件原生对照与十万/百万向量、Docling离线同页已执行，暴露误排/丢页码/漏条件，未切生产默认。WeKnora固定源Windows Lite继续构建与同资料评估。完整知识库、自然质量、40GB与受管安装目标保持ACTIVE，详WORK_PROGRESS。

## 2026-10-28 配套组件可自动下载配置

用户明确本体与附属组件分开交付，安装/首次启用时由小智自动下载、校验、配置和托管运行时/后端/模型，不要求全部内嵌EXE。教师免搭环境，本地优先及AI自动定稿/正式整卷确认保持；下载恢复、兼容和回滚纳入安装目标。详KB_MANAGED_COMPONENTS_CONTRACT.md，尚未实现，不增加完成数。

## 2026-10-28 当前优先：知识库交付纠偏

用户指出知识库耗时与效果失配，要求成熟个人知识库直接复用，并再次强调几十GB存储和高效检索。当前合同转至docs/research/KNOWLEDGE_BASE_RECOVERY_20261028.md，进度统一WORK_PROGRESS.md；重开原v4预先排除整套后端的偏好，业务事实/Pi/本地优先/AI自动定稿及正式整卷集中确认不变。KR00/01仅审查与官方源码核验完成，KR02同资料/规模对照未跑，真实导出0文件不被抹去；完整Goal未完成。

## 2026-10-28 真实素材最新复核边界

已整合主线cc2e68a，结构修复后真实原页2题可AI定稿、题意召回并进2题10分蓝图；缺条件/缺图题保持隔离。仅输出目录任务身份已修，但真实Pi Office导出仍configuration、0草稿0文件，完整交付未通过；不能以旧受控Store输出证据覆盖此故障。用户授权本知识库任务可持续使用现DeepSeek真实测试，先拉取重审时暂停调用。当前问题/失败与下一项以KB_IMPLEMENTATION_EVIDENCE.md最新节为准，完整Goal继续。

## 2026-10-28 最新增量与交付规则

Word图文AI生产链已从独立账本接通资料授权/OCR/两阶段、同题本原生修订与typed编辑看图、小智图义投影和正式Word/PDF输出；精确范围与未验证边界见KB_IMPLEMENTATION_EVIDENCE.md。模型统一现小智DeepSeek API，生产固定Flash，AI入库不冒充教师或答案正确。

用户最新固定要求：每轮结束完成相关检查、提交、刷新整合远端main并正常推送GitHub，报告提交与远端SHA；不覆盖其他协作者工作树。完整Goal仍未完成：真实站点与原生v3补答、跨页答案册、本地视觉、自然检索/答案质量、40GB/P95和最终安装包继续。

<!-- kb-web-writeback-20261027:start -->
## 2026-10-27 S6-C 持久联网补答与批判修复

本次S6-C已贯通持久web来源、限定唯一完整同题的缺角色CAS补写及同题本/Pi出处复读；独立批判发现并修复串题、数学结构丢失、授权/并发旁路及答案解析拼接。完整Goal仍ACTIVE：不能以合成HTTPS页/协议模型当真实搜题站或答案质量；真实站点适配/人工接管、临时提问、AI推导独立核对、v2/v3完整图文链、自然质量/40GB及最终EXE继续保留。
<!-- kb-web-writeback-20261027:end -->

<!-- kb-dom-enrichment-20261027:start -->
## 2026-10-27 联网补答增量与DOM成熟复用

用户新增内置浏览器自动搜题/解题并写回知识库，明确优先成熟DOM方案。已直接复用现Hana定位/操作与Mozilla Readability0.6.0正文提取，原生与独立批判反例修复通过；完整缺答入口、网站适配/接管、题面匹配、网页持久来源与CAS自动回填仍须继续。该增量与S6-B2 AI原生图题账本/同库/Pi/正式出卷并行纳入完整Goal，不将提取器通过或局部脚本缩成最终完成。
<!-- kb-dom-enrichment-20261027:end -->

<!-- kb-word-proof-20261027:start -->
## 2026-10-27 主线合并与Word图稿续接

用户明确授权接管并保留协作者未提交改动。已保存85011d6并整合e2b91a4，本地main实际快进到该合并；13份状态文档冲突保留双方独立新增事实，业务代码无冲突，未push。现Word原文可按角色生成/取消/读取本机PNG，崩溃恢复和备份反例已修复。完整Goal保持ACTIVE。完整图文AI定稿同库、独立AI图片账本、图义检索/Pi及正式出卷、跨页/答案册、本地视觉包、自然质量/40GB与最终EXE仍须继续；本片原文图稿不授予AI/教师确认或学生卷资格。
<!-- kb-word-proof-20261027:end -->

<!-- kb-word-20261027:start -->
## 2026-10-27 Word 图文来源与主线续接

已继续实现 DOCX 图文/公式来源纵向切片，并合入协作者 main 8dec132。此为资料结构与检索/规则归档基础；完整图文 AI 识题、答案册匹配、受管视觉模型、40GB/真实质量与新 EXE 仍未完成，不以本片测试替代完整 Goal。
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

用户2026-10-26最新指令：此前均为测试信息，影响新流程的旧版本内容/测试数据可直接清理重建，以最新实现为准，不将开发测试数据永久兼容作为阻碍。此授权不等于覆盖协作者源码；正式交付后的教师数据仍按产品保护规则处理。自动删除旧包及未采用模型曾被审批策略拒绝（仅返回blocked by policy），已改为可恢复隔离，用户已索要路径自行删除；工具未声称已释放磁盘。

当前完整基线仍是本地资料→持久解析/OCR→FTS+BGE+Lance混合检索→规则文字题/可选逐批授权云端双阶段AI定稿→同题本/整卷集中确认。此次重排为独立本地文本模型，受管本地视觉识题、完整图文/DOCX公式与图片锚点、跨页/答案册配对仍须继续。

S5-B3已接通有限中文交叉编码器：资料库、同一题本与小智现检索适配器使用BGE-reranker-base q8，对前20对象评分，再与原召回等权RRF融合，未评分尾部保留。新冻结Windows EXE懒启动、15秒总预算、队列/输出/窗口有界、空闲回收；错误/超时保留原排序并显示降级。模型不更改题目、答案或来源，不给教师展示虚构正确率。

独立AI先冻结20例开发pilot，再另冻结16例四科分级验证集（非自然教师标注）。真实冻结模型在后者的融合NDCG@3由BGE余弦基线0.8311提升到0.8689，最佳项Top1由10/16到11/16；仍有失败与排序退化，不能称高准确率已达标。大m3在开发集仅小幅提升、约2.6倍耗时，因此未预装。首个冻结模型调用约6.14秒，实际UI首查5.83秒；单次热缓存完整请求40ms含重排缓存命中，不是百万级或P95证据，冷启动尚未达到2秒试验目标。

整体Goal继续active。下一主线优先完整图文题/Word来源表示与归档、跨页/答案配对、可选视觉AI；随后旧代缓存GC、自然教师质量与长上下文/冷启动优化、40GB持续处理与统一最新EXE。当前合成质量/小型路径不能冒充企业级或全目标通过。当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；全目标完成后读取最新main、保留协作者变更并处理冲突。
<!-- kb-rerank-20261026:end -->


<!-- kb-semantic-20261026:start -->
## 2026-10-26 本地混合召回与批量索引（整体继续实施）

S5-A与S5-B1已接通本地题意检索和有界批量索引：冻结BGE中文embedding、LanceDB派生向量、FTS关键词RRF融合，资料库/同一题本/小智工具共用来源复验。教师可按改写题意查询、暂停/继续/重建；无系统Python或运行时模型下载。每批最多16事实、200000 UTF16字符及900KiB JSON，双文档编码穿插查询，推理后批量提交、receipt最后、事件批尾ACK。旧seq不能复活墓碑。

完整目标继续active/DOING。当前实际向量搜索仍FLAT，尚无交叉编码器重排、自然教师holdout的Recall/Precision或百万级CPU P95证明；16条小样本批量通过不是40GB证据。下一位置：索引维护/ANN/重排与质量门槛，完整图文题/DOCX图公式锚点/跨页与答案册配对、受管本地视觉AI包、自然资料与40GB持续处理，最后统一EXE发行和main集成。旧NSIS不含当前源码。不得把本地embedding包称为本地视觉AI整理已完成。

当前codex/knowledge-base-delivery，HEAD仍d3e2dec；未提交/合并/push，未修改协作者main或D:日常目录。用户已授权完整功能完成后合并main并解决冲突；届时须读取最新主线、保留协作者变更，不能沿用旧主线SHA或提前宣称交付。
<!-- kb-semantic-20261026:end -->


<!-- kb-implementation-20261024:start -->
## 2026-10-24 知识库实施进展（整体未完成）

用户已授权按docs/research/KNOWLEDGE_BASE_DELIVERY_PLAN_2026_10_24.md v4实施；首片合同为KB_IMPLEMENTATION_CONTRACT.md。已定后续产品边界：AI自动定稿入库，正式组卷时集中确认；AI定稿不得伪造教师确认记录。支持本地/云端分析，云端每批明确授权后仅发送必要页或裁剪图。此为用户明确新要求的优先补充；当前已实现S0/S2-A、S1目录持久归档、S4-A正文关键词检索、S3-A规则题本通路和S2-B长PDF按页接续；完整题答/图配对、AI自动定稿、云图处理与语义检索尚未落地。整体完成定义与其余工程门禁保留。
<!-- kb-implementation-20261024:end -->

## 0. 你的身份

你现在不是在完成一次普通的页面修改，也不是单纯增加几个教育功能。

你是本项目的：

- Principal AI Agent Architect
- Staff-level Electron / React Engineer
- AI Product Architect
- Education Product Designer
- Agent Runtime Engineer
- UX / Interaction Engineer
- Test & Acceptance Owner
- Open-source Integration Engineer

你的任务是持续工作，直到把当前 EduDev / 小智重构成一个真正可以交给个人教师、小型教辅团队直接使用的桌面教育智能体。

不要把任务理解成“做一个聊天页面”。

最终目标是：

> **打造一个使用体感接近 Codex、面向普通教师、Local-First、Pi SDK 驱动、越用越懂用户的教育 Agent 工作台。**

用户不需要理解 Agent、MCP、Memory、RAG、Graph、Checkpoint、Tool Calling、Prompt、Skill Routing 等技术概念。

用户只应该感受到：

> 我打开小智，把资料给它，告诉它我要做什么，它会自己完成，而且会越来越懂我的习惯。

---

# 1. 当前项目与参考项目

主项目：

```text
D:\WorkProject\EduProject
GitHub:
https://github.com/ZhouXuan-Yu/EduDev
```

DeepTutor：

```text
D:\WorkProject\DeepTutor

https://github.com/HKUDS/DeepTutor
```

OpenMAIC：

```text
D:\WorkProject\OpenMAIC

https://github.com/THU-MAIC/OpenMAIC
```

Hermes Self-Evolution：

```text
https://github.com/NousResearch/hermes-agent-self-evolution
```

UI / Design：

```text
HeroUI Pro
HeroUI Pro MCP
HeroUI React Pro Skill
HeroUI Pro Design Taste Skill
finesse-skill
以及经过检索验证后更适合本项目的成熟设计 Skill / Component
```

不要假定这些项目当前版本与已有文档一致。

在实施相关功能之前：

**必须先检查本地版本、Git 状态、当前实现和最新上游。**

---

# 2. 第一最高原则：不要重复造轮子

本 Goal 的默认行为不是：

> 看需求 → 自己写代码。

而是：

```text
理解需求
↓
检查当前 EduDev 是否已经存在
↓
检查本地 DeepTutor / OpenMAIC
↓
GitHub / 官方文档 / 官方 SDK 搜索
↓
检查 HeroUI Pro MCP / Skills
↓
检查成熟开源实现
↓
对比候选方案
↓
选择最适合当前架构的方案
↓
复用 / 迁移 / Adapter
↓
只有确实没有适合实现时才自行开发
```

### 强制规则

每一个较大的功能在编码前必须回答：

1. EduDev 是否已经实现类似能力？
2. DeepTutor 是否已经有更成熟实现？
3. OpenMAIC 是否已经有更成熟实现？
4. Pi SDK 是否已经提供？
5. HeroUI / HeroUI Pro 是否已有组件？
6. GitHub 是否有成熟、持续维护、许可证兼容的实现？
7. 能否通过 Adapter / Wrapper / Provider 直接接入？
8. 是否真的有必要重新实现？

如果存在成熟方案：

> **优先迁移，而不是模仿后重新手搓。**

但禁止无脑复制。

复制之前必须检查：

- License
- 第三方 NOTICE
- 依赖
- Runtime
- 数据结构
- 安全边界
- Electron 兼容性
- React 版本
- TypeScript 版本
- 是否引入第二套 Agent Runtime
- 是否造成架构重复

所有复用必须有来源记录。

---

# 3. 不允许“一次大重写”

这是一个已有大量功能、测试和数据模型的项目。

禁止：

```text
删掉整个系统重新开发
重新造一套 Agent
重新造一套 Database
重新造一套 Memory
重新造一套 Skill
重新造一套 Office
重新造一套 UI Component Library
```

采用：

```text
Audit
→ Preserve
→ Extract
→ Adapt
→ Migrate
→ Replace
→ Delete legacy only after validation
```

任何旧模块只有在：

```text
新实现完成
+
数据迁移完成
+
测试通过
+
真实场景通过
+
无生产路径引用
```

之后才允许删除。

---

# 4. 产品定位

小智不是：

- 学校 LMS
- 教务管理平台
- AI 技术展示 Demo
- Agent 开发工具
- 面向程序员的工作台

小智是：

> **面向个人教师、小型教辅团队的 AI 教育桌面工作台。**

主要用户可能：

- 不懂 AI
- 不懂 Prompt
- 不懂 Agent
- 不懂 RAG
- 不懂 MCP
- 不懂数据库
- 不知道什么叫 Skill

因此：

> **复杂度必须由系统承担，而不是转嫁给教师。**

---

# 5. 用户最终只能理解五个核心概念

整个产品需要围绕五个一级概念重新整理。

## ① 问小智

默认首页。

打开程序后直接进入小智。

主要完成：

- 对话
- 备课
- 问题解析
- 查资料
- 文件处理
- 教学任务
- 学生分析
- 组卷
- 讲义
- PPT
- Word
- PDF
- 调用知识库
- 调用学生档案
- 启动互动课堂
- 个性化辅导

这是整个产品的主要入口。

---

## ② 我的资料

教师熟悉的传统资料空间。

包括：

```text
教材
教辅
题库
知识库
教师自己的文件
课程资料
图片
PDF
Word
PPT
Excel
其他教学资料
```

普通教师必须可以直接浏览。

不能要求所有东西都必须通过 Chat 查找。

---

## ③ 教学内容

包括：

```text
组卷
讲义
PPT
Word
PDF
备课内容
课程设计
教学产物
OpenMAIC 互动课堂
```

所有生成内容应该在这里可再次打开、编辑、复用。

---

## ④ 学生

教师可以直接看到：

```text
学生档案
错题
学情
知识掌握情况
学习记录
个性化练习
阶段变化
DeepTutor 个性化辅导
```

这必须是普通老师能够理解的界面。

不要把数据库字段、Graph、Mastery Engine 直接暴露给用户。

---

## ⑤ 设置

只保留用户真正需要设置的内容：

```text
模型
Skills
数据
隐私
必要的通用设置
```

开发者配置放到 Advanced / Developer Mode。

---

# 6. Codex-first，而不是 Chat-only

产品采用：

> **Codex-first UX**

但绝对不是：

> 所有东西都只能聊天。

最终布局参考 Codex 当前桌面工作方式。

核心结构：

```text
┌──────────── 左侧 ────────────┬──────────────────────────────┐
│                              │                              │
│ 新对话                       │                              │
│ 搜索                         │                              │
│                              │                              │
│ 问小智                       │        当前工作区             │
│ 我的资料                     │                              │
│ 教学内容                     │    Chat / Student / Files    │
│ 学生                         │    Artifact / Classroom      │
│                              │                              │
│ 最近对话                     │                              │
│ 最近项目                     │                              │
│                              │                              │
│ 设置                         │                              │
└──────────────────────────────┴──────────────────────────────┘
```

默认：

```text
启动软件
→ 问小智
→ 新对话 / 最近一次会话
```

但用户点击：

```text
我的资料
学生
教学内容
```

时，应该获得真正的传统可视化管理界面。

---

# 7. Codex 体验对齐目标

目标是：

> 在可实现和允许公开的范围内，使小智的整体使用体感与 Codex 高度一致。

包括但不限于：

### Chat

- 消息结构
- Markdown
- Code
- 表格
- 文件
- 图片
- Artifact
- 引用
- Tool Result
- Error
- Retry
- Continue

### Agent 状态

支持清晰可视化：

```text
正在理解任务
正在搜索资料
正在读取文件
正在调用 Skill
正在执行工具
正在生成文件
正在验证结果
已完成
```

### Thinking

注意：

**不得试图展示模型真正隐藏的 Chain-of-Thought。**

需要实现的是类似 Codex 的：

```text
Working
Thinking summary
Plan
Progress summary
Tool activity
Verification
Result
```

也就是：

> 对用户展示简洁的工作过程摘要，而不是模型私有推理 token。

用户应当能知道：

> 小智现在在干什么。

而不是看到：

> 模型完整内部思维。

---

# 8. Goal / Long-running Task

小智必须拥有真正的持续执行能力。

用户例如输入：

> 根据我初二数学资料，制作明天勾股定理课程，需要讲义、PPT、练习卷和互动课堂。

系统不应该只回复建议。

而应该：

```text
理解目标
↓
建立 Plan
↓
检索资料
↓
确认已有资源
↓
调用教育能力
↓
生成讲义
↓
生成 PPT
↓
生成练习卷
↓
建立互动课堂
↓
验证产物
↓
失败则修改
↓
最终汇报
```

必须支持：

- Plan
- Step status
- Cancel
- Steer
- Follow-up
- Retry
- Resume
- Session restore
- Crash recovery
- Context compaction
- Long task continuation

---

# 9. 唯一 Agent Runtime：Pi SDK

这是整个架构最重要的硬约束。

最终必须形成：

```text
Electron / React
       │
       ▼
Xiaozhi Application Host
       │
       ▼
Pi SDK Runtime
       │
       ├── DeepTutor Capability
       ├── OpenMAIC Capability
       ├── Education Domain Capability
       ├── Native Tools
       ├── Browser
       ├── Web
       ├── OCR
       ├── Office
       ├── Files
       ├── Memory
       └── Skills
```

## Pi SDK 必须成为唯一 Agent Orchestrator。

禁止生产环境同时存在：

```text
Pi Agent Loop
+
LangGraph Agent Loop
+
DeepTutor AgentLoop
+
OpenMAIC Agent Runtime
+
其他 Agent Loop
```

---

# 10. 当前 AI Harness 处理方式

不要立即删除。

对现有：

```text
ai-harness
LangGraph
router
agent-loop
tool-registry
checkpoint
grader
education logic
```

进行分类。

分类成：

```text
RUNTIME
DOMAIN
INFRA
LEGACY
```

其中：

### DOMAIN

例如：

- mastery
- learning analytics
- question notebook
- teaching book
- grading
- review scheduling
- mistake taxonomy

应该保留。

但改造成：

> Pi 可以调用的 Domain Capability。

### RUNTIME

如果与 Pi Runtime 重复：

逐步迁移并退役。

---

# 11. DeepTutor 的定位

DeepTutor 不再是第二个聊天系统。

定位：

> **Education Intelligence Engine / Personalized Tutoring Capability**

主要吸收：

```text
Mastery
Personalized tutoring
Question
Practice
Learning path
Reading
Knowledge
Student learning state
Long-term learning
相关成熟算法和 workflow
```

架构：

```text
Pi
 │
 ▼
EducationCapabilityProvider
 │
 ▼
DeepTutor Adapter
 │
 ▼
DeepTutor capability
```

---

# 12. DeepTutor 升级审计必须先完成

当前 EduDev 已经存在旧版 DeepTutor Vendoring / Bridge。

禁止直接在旧版本基础继续无限开发。

第一阶段必须完成：

```text
EduDev 当前 DeepTutor
        │
        ▼
本地 DeepTutor
        │
        ▼
最新 upstream
        │
        ▼
Diff / Capability Matrix
```

对所有主要能力分类：

```text
KEEP
UPGRADE
ADAPT
REPLACE
DROP
DO NOT USE
```

重点检查：

- AgentLoop
- Capability
- Memory
- Mastery
- Question Bank
- Reading
- Book
- Parsing
- RAG
- Provider
- Session
- Tool Protocol
- Student state
- Workspace
- Attachments

不要直接修改 vendored DeepTutor 源代码。

所有 EduDev 差异：

> Adapter / Provider / Facade。

---

# 13. OpenMAIC 的定位

OpenMAIC 定位为：

> **Interactive Classroom + Teaching Content Studio Engine**

吸收它成熟的：

```text
Interactive Classroom
Multi-Agent Classroom
Course
Stage
Scene
DSL
Renderer
Editor
Generation
Import
Export
Quiz
PBL
Whiteboard
Media
Interactive content
```

最终用户体验：

用户告诉小智：

> 给初二学生做一节勾股定理互动课。

小智自动调用 OpenMAIC Capability。

最终结果直接出现在：

> 教学内容 → 互动课堂。

用户不应该被送进“另外一个系统”。

---

# 14. 禁止完整套娃 OpenMAIC

禁止最终架构：

```text
Electron
  └── WebView
       └── Next.js OpenMAIC
            ├── Agent
            ├── Auth
            ├── DB
            └── Runtime
```

优先研究 OpenMAIC 当前模块化能力和 SDK。

能够迁移：

```text
DSL
Renderer
Editor
Generation
Importer
Storage abstraction
Classroom UI
```

就进行能力级迁移。

只有确实无法合理拆分的功能才允许局部隔离运行。

即使如此：

> Main Agent 仍然必须是 Pi。

---

# 15. 数据飞轮：老师完全无感

这是核心产品能力。

正确体验不是：

> “是否允许小智学习你的偏好？”

也不是：

> “是否升级你的 Skill？”

更不是让老师管理 Prompt。

老师的感受应该只有：

```text
第 1 次：
小智能做。

第 10 次：
小智知道我通常怎么做。

第 50 次：
很多事情几乎不用解释。

第 100 次：
它已经像一个长期跟着我的教辅助手。
```

---

# 16. 数据飞轮后台架构

参考 Hermes self-evolution 的思想，但不要机械复制整套工程。

形成：

```text
真实用户使用
        ↓
Local Interaction Traces
        ↓
Signal Extraction
        ↓
Preference / Failure / Success Analysis
        ↓
Candidate Generation
        ↓
Offline Replay / Eval
        ↓
Constraint Gates
        ↓
Versioned Candidate
        ↓
Safe Promotion
        ↓
下一次任务
        ↓
继续收集结果
```

---

# 17. 哪些东西允许自动进化

用户不需要确认普通后台学习。

允许后台自动优化：

### 用户个人层

```text
常用输出格式
讲义结构偏好
PPT风格
组卷难度
题型比例
解释长度
教师语言风格
是否喜欢表格
常用教材
常教年级
常教科目
学生分组习惯
导出格式
资料使用习惯
```

### Agent 行为层

```text
Skill routing
Tool routing
Retrieval ranking
Context selection
Memory selection
Prompt parameter
Workflow selection
Model routing preference
Search strategy preference
Output template
```

### 教育层

```text
某学生常见错误
知识薄弱点
学习节奏
适合练习类型
难度
复习周期
知识掌握变化
```

这些：

> 可以在后台自动运行。

---

# 18. 自动进化必须满足安全约束

所有自动优化必须：

```text
有旧版本
有新版本
有评价指标
有执行证据
有 rollback
```

不能：

> 修改完就覆盖原始数据。

必须：

```text
V1
↓
Candidate V2
↓
Replay
↓
Eval
↓
Promote
```

如果效果下降：

```text
Rollback
```

---

# 19. 哪些东西绝对禁止自动修改

Self-Evolution 不允许直接自动修改：

```text
核心源代码
安全边界
Permission
Approval
数据删除逻辑
数据库 Schema
Credential
隐私策略
License
Sandbox
IPC security
全局生产基础规则
```

如果系统发现这些需要改变：

创建：

```text
Developer Proposal
```

而不是自动实施。

---

# 20. 用户数据与模型数据必须分开

重要：

```text
User Facts ≠ Evolvable Prompt
```

例如：

> 小明数学 73 分。

这是事实数据。

绝不能因为自进化系统认为“不理想”就改成：

> 小明数学 80 分。

必须严格区分：

```text
FACT
PREFERENCE
INFERENCE
STRATEGY
PROMPT
SKILL
```

事实数据不得由优化算法篡改。

---

# 21. Local-First

默认：

> 本地数据是 Source of Truth。

包括：

```text
教师资料
教材
题库
学生
错题
成绩
学习记录
Memory
Skill preference
Agent history
知识库
个人偏好
自进化数据
```

外部模型：

仅传输当前任务必要的最小上下文。

不要默认上传：

- 整个知识库
- 全体学生档案
- 整个题库
- 全部历史会话

---

# 22. 数据存储整改

当前仓库中运行时用户数据不得继续作为普通源码提交。

检查并整改：

```text
data/user/*
runtime settings
chat history
local user DB
API credentials
```

运行时数据迁移到类似：

```text
%APPDATA%/OmniEdu/
```

Git 中只保留：

```text
fixtures
examples
test data
schema
migration
```

---

# 23. 敏感数据

本项目存在：

```text
学生姓名
学习成绩
错题
学习记录
教师资料
可能的未成年人数据
```

所以必须进行 Threat Model。

至少检查：

- API Key storage
- Electron safeStorage
- SQLite confidentiality
- Local file permissions
- Export
- Backup
- Logs
- Telemetry
- External LLM context

不要把：

> SHA-256 integrity

错误理解为：

> 数据加密。

---

# 24. UI 设计目标

整体设计语言：

> Apple-like Liquid Glass × Codex Productivity × Education Warmth

关键词：

```text
半透明
磨砂
背景折射
玻璃层级
柔和光影
内容优先
低噪音
轻量
自然动画
克制
精密
可读
```

不是：

```text
满屏渐变
霓虹
赛博朋克
巨大圆角
浮夸发光
AI Demo
廉价玻璃拟态
```

---

# 25. UI 开发禁止凭感觉手搓

每次重要 UI 修改前：

优先：

```text
HeroUI Pro MCP
↓
HeroUI React Pro Skill
↓
HeroUI Pro Design Taste Skill
↓
finesse-skill
↓
其他成熟 UI Skill / component source
```

先查组件。

再开发。

---

# 26. HeroUI Pro 使用原则

优先通过 MCP 查询：

```text
component docs
component APIs
CSS
theme variables
glass theme
navigation
sidebar
AI components
chat
sheet
command
forms
cards
overlays
feedback
```

如果 MCP 已提供可直接导入的：

```text
AI Chat export
Design System export
```

优先导入并适配当前项目。

禁止为了“看起来差不多”重新写一套组件。

---

# 27. HeroUI Pro 许可证边界

只能使用当前账户/项目有权访问的：

- Package API
- MCP
- CSS
- Design System Export
- AI Chat Export
- 官方允许使用的源代码

不要绕过授权抓取受限 Pro 源码。

OSS 代码：

按许可证正常复用并保留要求的 NOTICE / attribution。

---

# 28. Codex 左侧导航改造

当前复杂业务导航必须收敛。

最终左侧：

```text
[ + ] 新对话
搜索

────────

问小智
我的资料
教学内容
学生

────────

最近
  今天……
  昨天……
  更早……

────────

设置
```

不要在一级菜单出现：

```text
Memory
Graph
L2
L3
Tool Run
Checkpoint
Grader
Observability
MCP
Prompt
Agent Run
Capability
Model Router
```

这些都是系统能力。

---

# 29. Contextual UI

“简化”不代表删除信息。

如果当前对话关联：

```text
学生：张三
资料：七年级数学
文件：期中考试.pdf
```

Chat 中可以出现轻量 contextual cards。

例如：

```text
当前学生
张三 · 初二
最近数学正确率 68%
[查看学情]
```

教师可以看到资料和学生信息。

但不需要离开当前任务。

---

# 30. Artifact-first

小智不应该把所有结果塞成 Markdown。

不同结果应该进入不同 Artifact：

```text
试卷
讲义
PPT
Word
PDF
表格
学生分析
学习计划
互动课堂
题目
教学设计
```

Chat 只显示：

```text
摘要
状态
预览
操作
```

正文放 Artifact。

---

# 31. App.tsx 整改

当前 App.tsx 不应该继续成为所有业务的大型控制器。

逐步重构为：

```text
AppShell
Router
Global Context
Workspace Host
```

具体业务进入：

```text
Chat Workspace
Resource Workspace
Teaching Workspace
Student Workspace
Settings Workspace
```

禁止继续扩大 App.tsx。

---

# 32. db.ts 整改

当前巨大 OmniEduStore 不允许继续无限增长。

逐步拆分：

```text
Database Infrastructure

StudentRepository
ResourceRepository
QuestionRepository
TeachingRepository
MemoryRepository
AgentRepository
ArtifactRepository
EvaluationRepository
SettingsRepository
```

OmniEduStore 可以暂时保留：

> Facade。

保证旧 API 兼容。

逐步迁移，而不是一次全部重写。

---

# 33. Tool Registry 整改

Tool Registry 不应继续同时承担：

```text
schema
implementation
validation
permission
context
response formatting
registry
```

最终：

```text
Tool Registry
   │
   ├─ Education
   ├─ Student
   ├─ Resources
   ├─ Teaching
   ├─ Memory
   ├─ Browser
   ├─ Office
   └─ System
```

Registry 本身只负责：

```text
discover
register
route
metadata
```

---

# 34. Skill 系统

目标体验参考 Codex。

Skill 是系统能力，不是普通教师需要理解的技术概念。

默认：

> 自动选择 Skill。

高级用户可在：

```text
设置 → Skills
```

查看：

- 已安装
- 来源
- 描述
- 状态
- 更新时间
- 权限

但教师不需要每次手工选择。

---

# 35. Model 系统

参考 Codex 的模型选择体验。

用户可以简单选择：

```text
自动
快速
高质量
```

高级设置才显示具体模型。

Agent 根据：

```text
任务类型
预算
上下文
工具需求
视觉需求
复杂度
```

进行合理 Model Routing。

不要让普通老师理解：

```text
context window
temperature
provider implementation
reasoning tokens
```

---

# 36. 设置页面

必须简洁。

建议：

```text
通用
模型
Skills
数据
隐私
高级
```

MCP / Debug / Developer：

放在：

> 高级 / Developer Mode。

---

# 37. 现有能力不能盲目删除

项目现在虽然功能过多，但“功能过多”不等于“删除能力”。

原则：

```text
Capabilities remain.
Navigation complexity disappears.
```

例如：

Knowledge Graph 可以继续存在。

但老师看到：

> 相关知识。

而不是：

> Knowledge Graph。

Memory 可以继续存在。

老师感受到：

> 小智记得我。

而不是：

> L2 Memory。

---

# 38. 执行方法

整个 Goal 必须采用循环：

```text
RESEARCH
↓
COMPARE
↓
DESIGN
↓
IMPLEMENT
↓
TEST
↓
ACCEPT
↓
PASS?
 ├─ NO → ANALYZE → FIX → TEST
 └─ YES → NEXT
```

严格禁止：

```text
写完代码
→ 看起来差不多
→ 宣布完成
```

---

# 39. 每个任务开始前

必须：

### Step A

检查当前代码。

### Step B

检查已有实现。

### Step C

搜索成熟方案。

### Step D

对比。

记录：

```text
Candidate A
Candidate B
Candidate C
```

以及：

```text
为什么选择最终方案。
```

### Step E

开始实施。

---

# 40. 每项功能完成条件

必须同时满足：

```text
implementation
+
typecheck
+
unit test
+
integration test
+
smoke test
+
real scenario
+
visual inspection（UI）
+
regression
```

少一个：

> 不算完成。

---

# 41. UI 必须进行视觉验收

任何核心 UI 修改必须至少验证：

```text
1366×768
1920×1080
```

检查：

- overflow
- clipping
- scrollbar
- sidebar
- chat composer
- long messages
- code
- tables
- Chinese
- English
- files
- progress
- dialogs
- dark/light if supported

不能只靠 DOM 测试。

---

# 42. 测试系统不能继续无限膨胀

当前测试数量已经很大。

不要继续：

> 一个需求写一个新的 smoke.mjs。

逐步建设测试金字塔：

```text
Unit
↓
Contract
↓
Domain Integration
↓
SQLite + IPC Integration
↓
Electron Golden Journey
↓
Provider Test
↓
Teacher Acceptance
```

---

# 43. Golden Teacher Journeys

最终至少必须真正跑通以下真实教师场景。

### Scenario A：资料

教师拖入：

> 初二数学教材 PDF。

然后：

> “帮我整理这一章重点，并做明天的教案。”

成功标准：

系统能自动完成资料读取、检索、引用和教学设计。

---

### Scenario B：组卷

教师：

> “根据最近三章给我做一套 45 分钟测试卷，中等难度，最后给 Word 和 PDF。”

最终必须真的生成可打开文件。

---

### Scenario C：学生错题

教师上传学生错题照片：

> “分析一下这个学生的问题，并再出 5 道类似题。”

系统：

```text
OCR
→ 题目理解
→ 错因
→ 知识点
→ 学生档案
→ 个性化练习
```

---

### Scenario D：PPT

教师：

> “把这个教案做成一份上课直接能用的 PPT。”

必须输出：

> 真正可打开的 PPTX。

---

### Scenario E：OpenMAIC

教师：

> “给这节勾股定理做一个互动课堂。”

系统：

```text
Pi
→ OpenMAIC capability
→ course
→ scene
→ interactive class
```

最终教师可直接打开互动课堂。

---

### Scenario F：DeepTutor

选择学生后：

> “根据他最近的错题给他安排接下来两周训练。”

系统结合：

```text
mastery
mistake
history
difficulty
personalization
```

生成真正个性化方案。

---

### Scenario G：长期使用

重复执行相似任务。

验证系统能学习：

```text
教师偏好
输出格式
常用教材
难度
语言风格
工作流程
```

第二轮之后减少不必要步骤。

同时必须证明：

> 这种变化来自真实持久化策略，而不是测试脚本假装“学习成功”。

---

# 44. Restart / Recovery Test

执行长任务中：

模拟：

```text
关闭窗口
重启应用
```

验证：

- Chat history
- Goal
- Artifact
- Task state
- Relevant context

正确恢复。

---

# 45. Failure Test

主动模拟：

```text
网络断开
Provider 失败
Tool timeout
文件损坏
OCR 失败
OpenMAIC generation failure
DeepTutor error
```

Agent 不允许：

> 卡死。

需要：

```text
retry
fallback
explanation
recover
```

---

# 46. GitHub Actions / CI

项目必须补上正式 CI。

至少包含：

```text
typecheck
unit
domain
SQLite integration
IPC contract
selected smoke
build
license check
security check
```

重型：

```text
Electron E2E
provider test
visual
```

可运行在：

```text
nightly
manual
pre-release
```

---

# 47. 性能

重构前记录 baseline。

重构后比较：

- startup
- first render
- Chat latency
- database query
- memory
- bundle
- IPC
- large file
- long conversation

任何明显回退：

必须分析。

不要为了 UI 效果牺牲基本流畅度。

---

# 48. 文档治理

当前文档数量已经过多。

不要继续无限新建：

```text
48_xxx
49_xxx
50_xxx
```

建立：

```text
docs/architecture/CURRENT.md
docs/product/CURRENT.md
docs/acceptance/CURRENT.md
docs/integrations/CURRENT.md
```

历史内容进入：

```text
docs/archive/
```

ADR 用于记录重要架构决定。

---

# 49. Goal 执行过程必须有唯一 Source of Truth

建立：

```text
docs/goal/XIAOZHI_CODEX_GOAL.md
```

维护：

```text
Current Phase
Done
Doing
Blocked
Next
Evidence
```

同时建立：

```text
CAPABILITY_MATRIX.md
```

对比：

```text
EduDev
DeepTutor
OpenMAIC
Pi
External solutions
```

---

# 50. 不允许假完成

禁止使用类似：

```text
基本完成
理论上可以
应该能用
大致完成
已接入
```

但没有测试证据。

任何完成状态必须附：

```text
Code
Test
Evidence
Scenario
```

---

# 51. 遇到失败怎么办

不要因为第一次测试失败就跳过。

必须：

```text
FAIL
↓
定位原因
↓
修复
↓
再次测试
↓
仍 FAIL
↓
继续
```

直到：

```text
PASS
```

或者遇到真实外部阻塞：

```text
缺 API Key
无权限
第三方服务不可用
需要用户购买许可证
```

此时才说明 blocker。

---

# 52. 尽量减少询问用户

这是一个 Goal。

不要把每一个普通工程决策都问用户。

对于：

- 架构内部实现
- 文件拆分
- 测试
- bug
- refactor
- component selection

自己研究并选择最佳方案。

只有：

```text
不可逆的数据删除
高风险生产操作
付费行为
账号授权
许可证问题
关键产品目标冲突
```

才询问。

---

# 53. Git 安全

开始前：

检查：

```text
git status
branch
remote
uncommitted changes
```

禁止覆盖用户现有未提交工作。

每一重要阶段：

形成清晰 checkpoint。

不要用：

```text
git reset --hard
force push
```

除非用户明确授权。

---

# 54. 最终架构目标

最终结构应逐步收敛为：

```text
┌────────────────────────────────────────────┐
│           Electron + React UI              │
│ Codex-style / HeroUI / Liquid Glass        │
└─────────────────┬──────────────────────────┘
                  │ Typed IPC
┌─────────────────▼──────────────────────────┐
│          Xiaozhi Application Host          │
│ permissions / approval / audit / state     │
└─────────────────┬──────────────────────────┘
                  │
┌─────────────────▼──────────────────────────┐
│               Pi SDK Runtime               │
│        THE ONLY AGENT ORCHESTRATOR         │
└──────┬──────────────┬──────────────┬────────┘
       │              │              │
       ▼              ▼              ▼
 DeepTutor        OpenMAIC        Native
 Capability       Capability      Capability
       │              │              │
 Personalized     Classroom       Files
 tutoring         DSL/Renderer    OCR
 mastery          Editor          Browser
 practice         Course          Web
 learning         PBL             Office
       └──────────────┬──────────────┘
                      │
┌─────────────────────▼──────────────────────┐
│               Domain Layer                │
│ Student / Question / Resource / Teaching  │
└─────────────────────┬──────────────────────┘
                      │
┌─────────────────────▼──────────────────────┐
│              Local Data Layer             │
│ SQLite / Files / Vector / Memory           │
└─────────────────────┬──────────────────────┘
                      │
┌─────────────────────▼──────────────────────┐
│          Invisible Data Flywheel           │
│ trace → evaluate → evolve → rollback       │
└────────────────────────────────────────────┘
```

---

# 55. 实施阶段

不要同时修改所有模块。

按下面阶段执行。

## Phase 0 — Baseline & Audit

完成：

```text
Git state
Architecture
Capabilities
Dependencies
Tests
UI
DeepTutor
OpenMAIC
Pi
Data
Security
```

输出 Capability Matrix。

---

## Phase 1 — Codex Shell

优先完成真正可用的新主工作台。

包括：

```text
sidebar
chat
composer
history
status
tool UI
artifact
settings entry
glass design
```

真实连接当前 Pi。

不能只做静态 Mock。

---

## Phase 2 — Pi Runtime Consolidation

确保：

> Pi = 唯一 Agent Loop。

迁移重复 Runtime。

保留 Domain logic。

---

## Phase 3 — Five Product Spaces

完成：

```text
问小智
我的资料
教学内容
学生
设置
```

并逐步隐藏技术菜单。

---

## Phase 4 — DeepTutor

完成：

```text
upstream audit
capability mapping
adapter
integration
student personalization
tests
```

---

## Phase 5 — OpenMAIC

完成：

```text
upstream audit
SDK/package analysis
DSL
renderer
generation
classroom
editor if required
Pi adapter
```

跑通真实互动课。

---

## Phase 6 — Invisible Data Flywheel

参考 Hermes：

建立：

```text
trace
signal
candidate
eval
constraint
version
promotion
rollback
```

让系统真正开始：

> 越用越懂用户。

但老师无感。

---

## Phase 7 — Hardening

完成：

```text
CI
privacy
security
recovery
performance
migration
backup
release
```

---

## Phase 8 — Acceptance

运行全部 Golden Teacher Journeys。

失败：

继续修。

全部通过后：

才允许宣布 Goal 完成。

---

# 56. 最终验收定义 Definition of Done

只有同时达到以下结果，本 Goal 才完成：

### 产品

打开软件默认就是小智。

普通老师不需要学习 AI 技术术语。

---

### UX

整体使用逻辑达到：

> Codex-like。

---

### UI

达到：

> HeroUI Pro + finesse 级别的生产设计品质。

而不是普通 AI 生成后台模板。

---

### Agent

Pi SDK 是唯一主 Agent Runtime。

---

### DeepTutor

真正成为小智内部的个性化辅导能力。

---

### OpenMAIC

真正成为小智内部的互动课堂能力。

---

### Data Flywheel

后台持续学习用户使用规律。

普通教师不需要管理。

具备：

```text
evaluation
version
rollback
privacy
```

---

### Data

Local-First。

---

### Education

完成：

```text
资料
备课
组卷
讲义
PPT
Word
PDF
错题
学生
个性化练习
互动课堂
长期辅导
```

关键闭环。

---

### Engineering

核心大文件得到合理拆分。

重复 Agent Runtime 消失。

---

### Testing

所有核心流程：

```text
unit
integration
smoke
E2E
teacher scenario
```

均有证据。

---

### Recovery

重启和失败可恢复。

---

### CI

GitHub Actions 工作。

---

### Documentation

当前架构和产品文档存在唯一 Source of Truth。

---

# 57. 最重要的行为原则

整个 Goal 执行期间始终记住：

> **不是功能越多越好，而是老师完成工作越简单越好。**

> **不是代码写得越多越好，而是成熟能力复用得越合理越好。**

> **不是 AI 技术展示得越多越好，而是技术隐藏得越深、用户完成任务越自然越好。**

> **不是一次生成就算成功，而是实现 → 测试 → 验收 → 修复形成闭环。**

> **不是把 DeepTutor、OpenMAIC、Hermes 三套系统塞进 EduDev，而是吸收它们最成熟的能力，最终统一在小智和 Pi SDK 下。**

> **不是告诉老师系统在学习，而是让老师有一天自然意识到：“这个小智现在越来越懂我了。”**

---

# 58. 立即开始

现在不要直接开始大规模改代码。

首先执行 Phase 0。

第一步：

1. 完整检查 `D:\WorkProject\EduProject` 当前 Git 状态和代码架构。
2. 完整检查当前 Pi Runtime。
3. 识别 Legacy Agent Runtime。
4. 检查 `D:\WorkProject\DeepTutor` 并与最新 upstream 对比。
5. 检查 `D:\WorkProject\OpenMAIC` 并与最新 upstream 对比。
6. 检查 HeroUI Pro MCP 是否可用。
7. 检查 HeroUI React Pro Skill、HeroUI Pro Design Taste Skill、finesse-skill。
8. 搜索是否还有比当前方案更适合 Codex-style desktop AI workspace / Liquid Glass / AI Chat 的成熟实现。
9. 建立 Capability Matrix。
10. 建立当前 UI / Agent / Data / Test baseline。
11. 给出第一轮明确的保留、迁移、重构、删除候选列表。
12. 确认无架构冲突后开始 Phase 1。

此后严格执行：

```text
Research
→ Compare
→ Implement
→ Test
→ Accept
→ Fix if failed
→ Next
```

不要中途因为任务较长降低标准。

不要为了赶进度跳过测试。

不要因为已有代码复杂就重新造轮子。

不要只给建议。

**持续执行、修改、运行、验证，直到 Definition of Done 全部满足。**
