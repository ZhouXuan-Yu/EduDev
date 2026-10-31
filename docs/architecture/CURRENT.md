# 当前架构

## 2026-10-31 E06教师要求与检查依据（第八切片）

沿现task-state→delivery-checks→typed preload→PiDeliveryCheck/PiRequirementCoverage贯通要求关联。来源验证复用sources(sql,row.doc)，报告v1可选扩展兼容旧记录，无新业务表/IPC/运行时。文件字节与完整要求上下文分别失效；旧报告保留原快照。

证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#requirementsSlice；日常进度docs/goal/WORK_PROGRESS.md。

## 2026-10-31 五三题册与独立答案册第一切片

已按用户指定在隔离数据根导入主书.pdf（62页、198230194B）和答案.pdf（31页、123742446B）。现可从资料详情关联两份PDF，保存原件版本和修订号；答案册仅原页转录、不抽新题，关联不授权上传。独立排队复用同一受限OCR Worker，不能称为同时推理。封面无抽题，明确标记的广告页在规则抽题阶段跳过，AI提示排除非习题页与宣传缩略例题；保留原PDF/OCR回执，不按首尾页位置丢弃真实题目。

新增领域material-book-pairs及增量关联表，复用现串行writer，不增加Agent/服务/Worker/新依赖。输入版本化，IPC同窗口主frame校验，角色快照在派发/提交/读取处重验；既有数据不改写。回退前暂停受影响AI/抽题任务，再revert本片生产修改；保留增量关联表、原PDF、OCR/AI/题库事实及协作者WPS/版面检查变更。无新依赖/模型/服务，不删除已保存题目，完整回退尚未演练。

## 2026-10-31 E06文字遮挡与系统字形（第七切片）

现结构metrics可选embeddedFonts→原service→PowerPoint固定助手：WPF系统回退（最多32000字符）及原生文字边界/Z顺序（每页256文字/256实心矩形）。新发现经原检查报告/模型摘要/文件面板，原8槽/45秒/Job与版本绑定保留。只扩既有v1可选字段，无新DDL/IPC/依赖。docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#layoutSlice。

WPS整合收尾：正常合并main e06cc05为bc9777e，15处Markdown冲突保留双方完整阶段文字，无生产冲突；WPS检查源码与610f3eb一致。合并后build/type及240组件通过，207综合与WPS实际路径归整合前610f3eb，未重复全量。renderer7179937B/SHA未变；主线检索改进保留。完整Goal仍active、AT新增已实现0；本轮WPS未更新D盘日常/安装包。最终指纹与边界见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice.finalIntegration。

## 2026-10-31 E06 WPS真实页面（第六切片）

FileCheckRules.officeEngine可选→既有typed IPC/Pi checks/preflight→service→固定Word/PowerPoint脚本共享WPS新实例归属与Job；真实引擎及PNG沿原报告/缓存/读器。无DDL/第二Runtime/新包，旧数据规则兼容。见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice。

## 2026-10-31 百条候选与共享重排预算

生产3e7d1c2将20条单次协议与整次候选分离：最多100条分批全局比较，5秒共享重排预算贯穿宿主启动/IPC/排队/原生执行，失败原子回到完整原排序；第21条之后可晋级，100以后的尾部保留。模型/原生v1/业务事实不变，无新依赖/迁移/付费/上传。

内部可选截止时间向后兼容，typed preload/业务表与原生协议未变；query准备仍使用同一个受控ranker。模型、索引与来源事实保留。详见KB_RERANK_CANDIDATES_20261031.json。

本轮收尾：最终整合feef9d4保留main f4dce3f的资料库与侧栏改动，Word检查生产源码与44eb69a一致；整合后build/type、240/240组件通过。207综合归整合前a94ab29，Word停止/占用专项归44eb69a，未重复运行。既有PromptInput指纹/启动IPC两项失败门禁与audit45保留，完整AT新增0，日常D盘与安装包未更新；详细指纹、范围见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice.finalIntegration。

## 2026-10-31 E06 Word真实页面与停止清理（第五切片）

此前Word导出阻塞已定位并修复：输出路径显式[string]，Close/Quit使用[ref] SaveChanges；Word16实际三页A4含长标题/表格/OfficeMath现可沿原Pi检查→原文件面板两视口→冷启取回真实PNG。仅去掉字符串转换的同文件对照20秒无PDF。取消还发现Word锁晚于助手退出释放，新增最多2秒异步重试自有临时文件；最终停止/占用专项通过，原文件不变且不接管已有实例。

WPS、逐字缺字/语义遮挡、完整FX09与全教师要求绑定/混合终态仍未齐；E06及完整Goal保持active，完整252AT新增已实现0。随后E07/E08+C及W3集中验收。D盘日常与安装包未更新。回退上述调用/清理提交保留原文件、报告及PNG读器，无业务迁移，完整回退未演练。 精确命令/源码/失败和指纹见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice；日常进度仍以docs/goal/WORK_PROGRESS.md为准。

## 2026-10-31 40GiB最终主线整合

正常整合origin/main ef55c53为03f4654，14处Markdown冲突保留双方完整证据，4个知识导入生产文件与a3667ce一致。整合后build（含typecheck）、240组件、协作者11项源码/4项真实Windows PDF、空间恢复UI3项、40GiB旧库再开3项均exit0；207/207属于整合前a3667ce，未重复运行，不冒充最终合并验收。再开首次尺寸断言超时保留，测试改为页面所属窗口并记录native/CSS/DPR，后续两尺寸通过，未宣称产品窗口缺陷修复。合并后混合首查3963ms、重启后4543ms，40候选仅重排20，速度/召回质量仍未达标。知识库切片无新依赖；上游明确直锁已安装unpdf1.8.1，故最终锁文件发生上游变更。audit仍45（8高29中8低/0严重，exit1）；0新增付费/上传。完整Goal保持active、完整AT新增0、D盘日常树与安装包未更新。下一步处理混合冷启和候选覆盖，再复现Pi/原题旧页数/字节限制。完整历史、失败及最终构建指纹见docs/research/KB_BYTE_CAPACITY_20261031.json#finalIntegration。

## 2026-10-31 归档空间不足的可恢复边界

仍以SQLite/文件为事实真源，复用MaterialImportBatches、MaterialParseQueue、现PDF文件Worker和FTS/Lance/ONNX，无新服务/依赖/IPC/表。可选I/O错误码贯穿原导入返回值；ENOSPC（含SQLITE_FULL）中断当前批次，pending和未扫描目录保留。复制后未发表的副本只在确认没有SQLite事实持有时清理，查询/清理失败时保留原件。现页协议、隐私授权、题目资格与教师正式组卷确认不变。

## 2026-10-31 E06真实PDF页面与Word缺口（第四切片）

原Pi交付前及原文件面板现可检查PDF原字节的真实物理页数/逐页文本，并由Windows.Data.Pdf逐页栅格化，沿原PNG缓存、页选择、放大、历史和冷启读取。扫描页没有文本层时内容/数值/事实明确未检查；PNG尺寸读取实际IHDR，兼容本机150%显示缩放。Word只读副本→原生PDF薄适配已接入，但本机原生导出仍超时（不加入Job的30秒诊断亦未完成），生产Word等待限制15秒并明确未检查；不能称Word页面已实现。

实现1d86357，已正常整合主线3192261为7bb8671，无冲突。原生PDF4项、检查源码11项、240组件及构建通过；原正式输入→检查→一次整包确认→精确SHA保存→文件面板实际第2页/两视口→重检→冷启与扫描页/错页6项通过，同批成果续测停止2项exit0（2137ms含完整停止观察），最终Word超时/进程清理反馈2项exit0（0页，非正向通过）；首套UI因旧停止按钮断言exit1仍保留，不冒充整套全绿。最终源码9ebc430，合并build/type、240组件、11项源码通过，删除Word全局Options写入后的最终Vite构建及上述续测通过。完整AT仍未执行，新增已实现0/252，完整Goal保持active。证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#pagedDocumentSlice。

已安装的Hana间接依赖unpdf1.8.1明确直锁（MIT，JS文件合计2141399B），不安装可选canvas；无新Runtime、业务表或IPC。PDF60秒/Word15秒、16MiB/64页、PNG3MiB/合计96MiB，沿原8槽和取消；仅处理派生副本，原文件SHA保持。主renderer7175.29→7175.68kB的0.39kB变化来自主线资料面板，本片无renderer修改；合成3页本机原生渲染1541ms、扫描页827ms，仅单次样本，未测流式/P95。0新增付费；audit45（8高29中8低/0严重，exit1），未自动升级。

继续位置：E06 Word原生导出原因与实际成功路径、WPS、逐字缺字/语义遮挡、全教师要求绑定与混合终态；随后E07/E08+C及W3集中验收，保持28组252项原范围。D:/WorkProject/EduProject日常程序和安装包未更新。回退本片原生适配/检查接入可保留既有正式文件、检查读器与可选PNG索引；不删除业务表或成果，整提交回退未独立演练。

## 2026-10-31 混合图题正文召回与质量复核

本轮沿现原页回执→AiPageView→MaterialAiTextIndex→原FTS/Lance→Pi来源读取增加独立transcriptionStatus，原整体status/题库资格不变；共享aiTextSignature保留数字/字母边界。增量控制列transcription_policy=2，游标每次发现8条/处理4条，来源/隐私在索引及读取时照旧复验。无新IPC、依赖、模型或业务真源。证据KB_TRANSCRIPTION_RECALL_20261031.json；保留合并主线Office实际渲染能力。

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

接通原Pi/原单文件及整包审阅的真实候选检查：结构、内容/页数/备注、离线HTML真实控件/键盘/画布、独立浮力与合计、跨文件数值/题目版本；失败保留原草稿并回原Pi，每类最多2轮，冻结规则不能通过改名或删规则规避，教师手改不消耗自动轮次。确认保存使用已检查字节，教师改稿使候选缓存失效；原文件面板/草稿卡可查看逐项与过期结果。无新依赖/第二运行时/第二业务真源；新增同SQLite可重建检查表与隔离解析worker。

E06仍部分实现：Office实际页面/字体/遮挡渲染、持久视觉证据、自动绑定全部教师语义要求及完整混合终态仍待补齐；未渲染保持未检查。下一继续E06再E07/E08+C与W3集中AT，新增“已实现”0/252。D盘日常版本/安装包未更新，0真实付费请求。 详docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json。

## 2026-10-31 现检索Worker中的重排预热

vector-worker在ensure/apply/applyMany成功回包后以Promise隔离可选准备失败，原RerankerClient共享完整启动/ready给预热及真实查询；Node os.freemem控制2GiB准备/1GiB释放滞回，空闲最多10分钟/30秒检查。启动校验贯通AbortSignal且等待可独立取消，15秒准备超时与关闭均防迟到启动；后台故障仅冷却自动准备，不停止向量服务。原模型/排序/FTS/Lance、资料来源复验、typed IPC及业务schema不变，三生产文件窄切片；验证与内存代价见goal/KB_IMPLEMENTATION_EVIDENCE.md。

## 2026-10-31 AI输入文件证据

assets/material-ai-image-files.ts复用现FD/路径/哈希证明与Windows独占锁，按SHA在dataRoot/material-ai-images/v1分片保存原始输入，SQLite只保存file.v1引用与pending日志；旧inline.v1兼容。文件准备不占业务writer事务，引用发表仍经原授权guard/短事务，锁持有到清理。两个部分索引支持每次8条恢复和引用检查，备份沿原data-root-files收录；Pi/typed IPC/前端入口保持。来源读取与题目检索共用新旧读器，未知版本/混填/损坏拒绝。具体表列/回退和验证见goal/KB_IMPLEMENTATION_CONTRACT.md及KB_IMPLEMENTATION_EVIDENCE.md。

## 2026-10-31 活动工具文件证明

managed-skills.enabledResources与managed-skill-runtime.check接阶段AbortSignal，调用独立skill-package-async.ts的Node有界异步读。每次仍核对全部注册文件（含不发送模型的二进制）、目录/链接/规范路径、句柄与当前路径及内容哈希；解析缓存只保存不可变原生解析结果。模型缓存完整包证明覆盖的逐文件重读被取消，同步空闲编辑接口暂保留。SQLite/文件真源、Pi、现检索、typed IPC与schema均不变；性能和剩余启动阻塞见goal/KB_IMPLEMENTATION_EVIDENCE.md。

## 2026-10-30 E05与知识库主线最终整合

正常整合origin/main28ef069为f30212f，保留双方知识库正文来源与E05真实计算报告代码及13份Markdown完整新增节。合并后的build/type、240组件、20知识库页边界、E05正式Electron5项均exit0，0renderer错误；实际CSV/HTML/XLSX一次确认、所有文件账本回读、两尺寸预览及冷启0模型重放通过。最初KB专项因Node缺transform-types前置失败，按原脚本补正确参数后通过，未改协作源码。207综合仍属于合并前本轮代码，不冒充本次合并后重跑。 本地合并脚本曾未在失败后停止，误含标记的未推送提交已修正；全树标记与diff检查通过，未强推、未动其他已检出分支。下一仍E06→E07/E08+C→W3集中验收，新增已实现0/252；D盘日常版本及安装包未更新。详[最终整合证据](../research/AGENT_COMPUTATION_REPORTS_E05_20261030.json)的integration。

## 2026-10-30 E05类型CSV、图表与正式报告

实现b3170f8：类型化CSV显式声明文本/数值/空值；真实隔离计算得到30/200/10与合计240，001/002/003、带逗号备注和公式样文本保留。新增education_create_report直接引用本轮实际结果生成CSV、离线SVG/HTML与可编辑XLSX，复用原一次审阅/整包保存及独立文件账本核验；模型仍沿原脱敏输出。输入/代码/结果SHA与运行版本进入依据，临时结果清理不影响正式文件，过期/跨run引用不得发布。无新业务表/DDL/依赖或第二Agent循环。

最终build/type、8项实际进程/CSV/真实XLSX专项与正式Electron5项exit0，0renderer错误；一次原整包确认后真实文件回读通过，文件面板开图及冷启0模型重放。240组件与一次207/207综合exit0，在最终生成HTML窄栏样式调整前通过；后续最终build/8专项/5正式UI复测通过，不冒充再次运行综合。audit既有23项（0严重），0真实付费模型请求。 下一E06交付前结构/内容/视觉/交互/数值与整包核验及有界修复，再E07/E08与贯穿C，W3集中完整AT。E04/E05与252项仍未集中验收，本轮新增“已实现”0；保留知识库并行进度。D盘日常构建与安装包未更新。 详[进度](../goal/WORK_PROGRESS.md)与[本轮证据](../research/AGENT_COMPUTATION_REPORTS_E05_20261030.json)。

## 2026-10-30 最后主线整合42ac7be

最后刷新main83cf832（受管版本/FIFO计算），合并为42ac7be；13份Markdown同位置新增节冲突已逐项保留双方内容，preload自动合并已核对。该源码重新build/type、240组件、20页边界、目录→Pi来源→冷启五项均exit0（iLCx7P，原OCR183B、两视口、0renderer错误、每次2受控JSON/3受控SSE、0付费）。新小样本4资料、重排3候选，查询3918ms/重排3349ms，不能与4候选旧样本当提速A/B。207综合exit0仍明确属于fc2fd0d；未冒充最后这次无关受管版本合并后重跑。代码与新构建指纹见公开JSON latestIntegration。

## 2026-10-30 AI整页正文进入现检索与小智（M04/M10）

AI页正文是可重建的检索派生物，不得伪造resource_chunks或提升为教师确认的原文。原MaterialSource.v1/题目与课堂确认保持原权限；独立material-ai-text-source.v1严格绑定原件版本、原页、两遍回执与正文摘要。异步搜索/读取结束须复验文档及父资料修订，失效引用不能悄悄显示新稿。

复用单一FTS/检索时钟/本地LanceWorker；三张可重建页派生表，正负rowid隔离，旧OCR/归档权限不扩张。昂贵原页复验在写锁外，入锁复验修订；有界发现8/处理4，失败隔离与到期部分索引；原件及父私密状态变化立即推进原时钟。重建不调模型，停新生产保留读。

## 2026-10-30 E04版本生命周期工程更新

实现8587057；真实双版本冻结/升级/回退与2进程FIFO队列已贯通现设置、typed IPC、Pi和隔离子进程。build、8+12源码专项、240组件、正式Electron5项通过；综合日志207/207（shell退出回执未跨轮保留），讲义既有间歇断言本次未复现。完整AT仍未集中验收，新增已实现0。后续E05图表/CSV/正式文件；精确事实见[WORK_PROGRESS](../goal/WORK_PROGRESS.md)与docs/research/AGENT_MANAGED_TOOL_VERSIONS_E04_20261030.json，D盘日常版本未更新。

## 2026-10-30 E04薄适配与本机组件配置

首个受管免费组件quickjs-wasi3.6.2已贯通现设置/typed IPC/Pi工具：真实缺失/可用/需授权/不支持/故障分类；固定官方包下载568844B、SHA校验、只取637405B WASM、隔离进程实际健康检查后原子激活。同版本共享准备、独立消费者取消、在用卸载锁、离线冷启可用。education_compute缺组件时同run自动准备后真实计算，不再只返回口算文字；结果240、文本00123和非法域检查已实跑。无新业务表/第二Agent循环/系统Python安装；现Pi间接依赖明确锁为生产直接依赖，版本未增加。

## 2026-10-30 E03请求来源与精确身份兼容

新增read_teacher_request，原请求/已应用追加/已回答问题均沿原SQLite事实，可分页发现旧来源并精确分段重读；全文先脱敏再分页，ID/版本保持。追加按实际送达顺序记录，旧无顺序记录明确未知，撤回/未应用不进入当前要求。复用原ask_teacher选择第二份独立课件后局部改页。修复手动压缩无taskRuntime误换控制提示词指纹的真实配置失败；按已知原提示词精确恢复，未知权限/工具/指纹仍拒绝。无新表/DDL/依赖、第二循环或新审批。

## 2026-10-30 PDF原页还原来源与读取

MaterialAiRepository沿原两阶段/授权/预算/事务保存page-response.v1；新增页来源表绑定实际PDF generation/receipt、原件版本、两遍原始响应和图片SHA。v5保留实际正文sources（可空）及pageSource，旧协议仍读；原件/OCR事实不覆盖。来源变动时原页资格/派生覆盖/检索时钟失效；新typed materials:ai-page按需读正文，轮询只传小标志。原图由既有Worker预览，busy的retry_at/local_retries采用到期索引，不新增运行时或依赖。

## 2026-10-29 E03原任务与Office薄扩展

不新增工具名或创建指纹；office_create_document可选presentationEdit经原Service转换为完整Office Proposal，再用原审阅/存储/生成/回执。task.resume允许真实短继续，任务修改新请求的历史sources仅供上下文；goal绑定按origin来源，不按sources数组首项。原SQL/文件真源及typed批准IPC不变。长请求完整读取与队列上下文接缝仍待补齐。

## 2026-10-29 PDF本地发布与目录AI隔离

PDF页回执/暂存chunks与canonical resource_chunks继续由原publish隔离；目录AI在发布就绪后取来源，不引入另一份正文真源。现folder表新增plan_cursor及两个派生部分索引，小批8资源轮转，旧未计费误判页按同版本证据恢复。规则抽题按明确原页边界排除后一题元数据前言，不丢真正跨页条件；共享协议/typed IPC/主页面不变。

## 2026-10-29 E02薄适配

沿原模型设置State/API、原互斥锁、typed preload、正式composer与唯一Pi Runtime添加thinking契约；独立可选app_settings键/CAS，无新表/业务事实库/运行循环。主进程按官方能力冻结策略，最后payload覆盖普通与工具续轮/压缩的三个参数；完整请求门校验同一输出预算。最近准备配置不冒充已发请求。

## 2026-10-29 同源派生关联

material_question_origins是可重建展示关系，不是第二题库；同原件版本/完整sources/原始题面指纹区分rule/ai，covered派生联动needs_attention。现AI发布与规则创建同writer登记，历史按8条有界回填并锁内验证，坏历史不阻塞新导入。题目/源/回执变化和教师操作失效，typed notebook showSourceCandidates读取原始记录；ID读取不再先加载50题/全库使用汇总。原业务事实、权限和Pi唯一runtime保持。

## 2026-10-29 默认输出纳入既有备份

默认生成文件已纳入原设置页备份/校验：manifest.v1带schema1的conversationOutputs引用信息，包含真实HTML/PPT并显示数量；同名会话文件隔离、另一实例不扫描、源变化/链接/递归目标拒绝，旧v1清单兼容。新增启动停写开关OMNI_EDU_XIAOZHI_FILE_WRITES=0，保留native装配和读取/核验，只阻止自动文件提案/批准/执行/撤销及Pi复制门；无新表/依赖。

## 2026-10-29 整包文件薄编排

E01整包工具已贯通原文件/Office服务、schema1引用元数据、typed IPC、正式整包卡和saved_bundle全文件独立核验；2–8份草稿一次审阅确认，PPT改稿使旧确认失效，拒绝不写新文件。HTML成功/PPT失败保留部分成果；可见续做进入新轮，只重提未完成PPT，HTML账本数/文件mtime不变。未知PPT提交先只读核验，已落盘文件不重写。连续事件刷新原8次重试误失败已修为有界等待稳定，不能只用DB状态宣称界面通过。

元数据不保存第二份正文；新增saved_bundle任务类型及附加native identity，旧创建/Office身份不变。

## 2026-10-29 统一导入题核验资格

共享archiveEligible增加无AI导入来源的明确核验条件，沿现Pi/检索fact/组卷/题本消费，无新schema/IPC/表。MaterialQuestionArchive及QuestionWebAnswerRepository按同一资格写派生needs_attention；迁移仅回填未标记旧成员，不改原始事实。无AI规则题仍可在题本编辑/核验，不能因字段齐全或联网补答自动升级。

## 2026-10-29 目录AI调度

MaterialFolderAiRepository为既有归档/AI执行器之间的持久调度器，非Agent。material_folder_ai/resources/units及material_ai_task_keys只保存授权、游标和子批次关联，SQLite/本地原件/同题库真源保持。增量pause_reason区分teacher/folder/startup；发送和发布前复核父授权，单元2次预留、未知不重发，有界轮转与全局单AI消费者。typed目录schema/IPC/preload和原资料卡片贯通，旧单资料路径保留。

## 2026-10-29 精确PPT契约与复用读取

新增presentation-draft.v1及presentation-layout/generator，原tool、typed preload与SQLite draft_json/content_md贯通备注，generator_version仅新schema前缀改变。原v1保持字段/生成/身份。现Hana anydoc已读notes，保留原document-worker；测试独立OOXML/PPT原生读取，无第二生产解析器或DDL/依赖。


## 2026-10-29 默认产物与HTML的实际接入

E01部分接通：conversation-output提供稳定生成目录，production-host默认注册文本/Office/document工具并解析文件租约，pi-session通过独立fileReadWorkspace保持旧cwd和fingerprint。HTML沿原change账本，shared离线策略→opaque iframe→主窗子frame请求/导航限制；原ScienceDemo专属导出仍独立。无DDL/新IPC/新依赖，回退不删文件或旧记录。

## 2026-10-29 归档结果与全库概览分离

MaterialImportBatches在每128目录项后有界归档128文件，再继续发现；旧队列/来源版本/取消与原件hash校验复用。db仅窄接线并抽出原归档方法：内部不加载overview，公共导入包装器保留原返回。无DDL/IPC/依赖变更。DeepSeek共用OCR还原规则v1，明确原图恢复、无图保守策略和解题标注分工；模型schema及放行标准未放松。

## 2026-10-29 新能力规格的架构边界

../product/PRD-XIAOZHI-AGENT-DELIVERY.md定义待实施逻辑契约、现有schema缺口与复用/兼容/回退要求，不代表已新建表/IPC/Worker。保持Pi唯一Runtime、SQLite/本地文件真源；具体映射在WP .01冻结，新增PPT备注/通用HTML等须同时贯通契约到真实输出。
## 2026-10-29 图文文字回执与轻量范围探测

新增shared/material-ai-image严格响应；现MaterialAiRepository增量幂等创建material_ai_image_inputs保存实际发送图，<=4MiB/unit，按hash与原资料/两遍回执复验，新policy image-text-complete.v1不覆盖OCR。不同批次同图暂重复保存，大库空间未验。无新IPC/Agent/依赖；核心题库只读schema常驻，getChatSourcePresence固定EXISTS代替每请求完整概览和limit1合格检索。关闭新图文请求须保留既有回执读支持。

## 2026-10-29 流式响应与窗口拖动

OfficeMarkdown在应用适配层memo合并components，默认animated=false；正文保持32ms、推理100ms合并并终态flush。DesktopFrame以独立空白drag区分离实际no-drag按钮，不改原生caption/位置持久化或IPC。

## 2026-10-29 会话资源与引用补齐

原生SessionManager通过native-session-resources独占租约复用，最多4个空闲、2分钟释放，字节/作用域变化重载；每轮AgentSession、工具、凭证和授权仍新建。来源结构新增可选local行定位，沿既有typed预览IPC核版本；没有新表/迁移。详情../goal/HANA_ANSWER_QUALITY.md。

## 2026-10-28 Hana回答优化独立切片

Hana ToolCatalog作为唯一Pi的provider-facing适配，不改变原生会话identity；全工具仍由宿主边界执行，按需只改变请求曝光。缓存仅含经全内容复核的技能解析，run工具闭包不复用。每run证据表在内存登记，可选citationId随既有事件和SQLite元数据持久化，无新表/迁移。详../goal/HANA_ANSWER_QUALITY.md。

## 2026-10-29 成熟后端实测，生产默认未切换

隔离AnythingLLM包含SQLite/Prisma与LanceDB；按官方空库初始化后49迁移通过，client临时切官方library引擎才能完成此对照，不能当未修改桌面验收。Docling坐标结构有实证但题面仍缺；不迁生产表/IPC/索引。本片仅两处导出模型指引及既有真实UI夹具；仍使用原Pi/Office审批/生成器。

## 2026-10-28 安装层与本体解耦（待实施）

用户允许安装/首次启用自动下载配置受管后端、运行时和模型，本体提供统一业务入口；组件/版本目录与原件/SQLite事实分离，安装下载与离线Worker分离。解除全内嵌EXE限制，先完成成熟后端同资料/规模资格，再薄适配；现无生产架构或默认引擎变动。详../goal/KB_MANAGED_COMPONENTS_CONTRACT.md。

## 2026-10-28 复用方向纠偏（尚未实施）

已重开完整成熟知识库后端作为通用层候选，优先标准摄入/索引/检索/阅读API或成熟parser统一结构的薄适配；Pi和SQLite/本地原件领域事实保持。AnythingLLM vector-search不等于完整中文混合检索，WeKnora Lite Simple不等于标准版复杂解析。几十GB规模资格与来源/质量同在定案前验证。当前只有研究合同，无运行时、Schema、依赖、默认后端或数据迁移。

## 2026-10-28 新UI与事件投影整合

保留fdc模板输入/附件/四权限/命令/三栏；F01 renderer-only文本缓冲有界32ms/128条/65536字符，同scope相邻文本合并、非文本/Stop/隐显flush。权威snapshot替换才同步commit，校验当前cursor/连续后缀与scope/revision后ack；重入期间ref+可见同步屏障阻止手动及自动审批。无新IPC/表/生产Runtime；完全无重叠历史页失败关闭，F10继续处理该范围。F01性能尚未验收。

## 2026-10-28 输出目录任务标识与扫描题结构

复用现extractMaterialQuestions处理明确卷首说明/完整编号块/连续小问，AI题干只兼容明确填空与选项句号版式；没有新题库真源或迁移。任务资源可选officeOutput resolver仅在saved_office且workspace不存在时标识现授权输出目标，普通读文件/保存文本/office_create_document保持workspace要求。真实Pi计划可采用，实际Officeconfiguration仍未定位，完整交付不宣称通过，详KB_IMPLEMENTATION_EVIDENCE.md。

## 2026-10-28 页面恢复协调边界

PiEducationWorkspace使用pi-snapshot-hydrator管理同导航scope的在途快照和事件版本栅栏，updater无IPC。只协调renderer读取：公共事件顺序仍由createEventReceiver/main journal负责，fresh操作后刷新不得加入旧事实后直接完成；scope token隔离A→B→A及卸载。8次冲突上限后fail-closed/教师重试，不增加数据库或协议真源。验收与未验边界见goal/DEEP_AUDIT_20261028_EVIDENCE.md。

## 2026-10-28 原生AI生产链与单账户

最新状态替代下方历史未接线说明：OmniEduStore已拥有NativeQuestionRepository及六类幂等表（新增context）。专用autocommit准备连接承担Word排版/OCR/输入提升，同caller writer读取真实first/final/member并原子发布native修订与题本；私有account能力传给writer。每次实际HTTP前复验隐私/配置/授权，确定未发返预算，真实已发未知不自动重试。

题本typed native-image/native-original、编辑修订/撤旧图、Pi投影、FTS trigger升级、语义fact/重排与Office native resolver均接线。正式文件使用当前角色字节，业务PNG不受预览LRU影响。原生v3联网写回/完整备份引用校验仍OPEN；无新依赖/服务。

<!-- kb-native-ledger-20261028:start -->
## 2026-10-28 原生AI业务图片与持久输入（完整目标继续）

原生AI持久层新增NativeQuestionRepository及五类表：revisions、images、pending、inputs、input_images。私有Word proof evidence复读生产者manifest与实际PNG；业务输入保留源/排版环境/角色字节，永久事实与inflight输入共同保护pending回收。准备连接专用autocommit，writer实例在caller事务内发布/读刚写凭据，同根短命permit跨实例；禁止SQL探针影响共享保存。尚未在OmniEduStore实例化/迁移这些表，生产接线继续。
<!-- kb-native-ledger-20261028:end -->

## 2026-10-27 日常spawn显示边界

> 2026-10-28 主线交付：用户已授权提交及推送；本节通过结果为10月27日D:历史证据。本轮依赖安装未完成，build（缺tsc）/组件（缺react-aria文件）exit1；原生专项未重跑。专项已补全新工作区目录初始化。详见 DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md 的发布与核验记录。

start-desktop先build后spawn同out；交互Electron windowsHide=false避免Windows首次ShowWindow被隐藏启动标志压制，后台构建继续隐藏。不改变BrowserWindow/runtime/IPC/renderer/数据库。证据见../goal/DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md。

<!-- kb-web-writeback-20261027:start -->
## 2026-10-27 S6-C 持久联网补答与批判修复

S6-C由education域QuestionWebAnswerRepository/Tools及archive v4贯通，SQLite授权/观察/候选是持久事实，writer原子发布缺角色CAS与来源。Retrieval内部web_source_check复用隐私/源修订闭包，不授予完整题或向量资格。现Pi新增唯一education_web_answer local_write manifest，补答会话顺序执行；浏览器/通用网页/MCP分别守批次。不新增依赖或部署服务。
<!-- kb-web-writeback-20261027:end -->

<!-- kb-enrichment-read-20261027:start -->
## 2026-10-27 S6-C 缺答题实读与独立批判修复

缺答实读新增独立目的，不改变SQLite业务真源或索引资格。archiveEligible仍控制通常读取/向量；answerEnrichmentRoles只控制缺角色完整题面。RetrievalRepository.fact的内部补答目的复用已有chunk/page隐私和来源修订，validateAnswerEnrichment再检查digest与filterCurrent。既有Word原件验证仍执行；末次读取变化明确失败。无schema迁移、新依赖或第二Agent。
<!-- kb-enrichment-read-20261027:end -->

<!-- kb-dom-enrichment-20261027:start -->
## 2026-10-27 浏览器DOM提取层

现Hana DOM/ref宿主新增extract，isolatedWorld1005对当前DOM清理克隆执行原样Mozilla Readability0.6.0；指定ref走保全区域文本，整页可能lossy。20k节点/2Mi字符输入、24k字符且48KiB输出、15秒/取消与revision复验，纯文本和公式表格边界，图/SVG/Canvas另外标缺口；不加载外链或呈现Readability HTML。权限确认、公开IP代理、同Pi均保留。下一web答案来源账本独立于原MaterialSource与临时30条工具观察。
<!-- kb-dom-enrichment-20261027:end -->

<!-- kb-word-proof-20261027:start -->
## 2026-10-27 Word角色PNG派生层

安全静态原生HTML/MathML与精确图片白名单，经私有Electron离屏1x生成最多8片；每段/行/纵向合并单元为原子分页，过高/过宽明确拒绝，不裁尾。material_word_proofs/proof_files保存源与环境摘要/引用，PNG存cache/word-question-pages/v1，32份/128MiB有界LRU。每根JS门+Windows独占锁保护发布/读取/崩溃恢复，长渲染不持锁；原件/结构再次复验后manifest事务最后发布。AI正式图片账本仍未接通。
<!-- kb-word-proof-20261027:end -->

<!-- kb-word-question-20261027:start -->
## Word原生题目来源（2026-10-27）

新增word-question-source索引与shared原生范围协议，主部件由document/body根锚点确定；精确UTF16文字范围及原子公式/图片按题面、答案、解析解析。共用材料只保留一份，按需合成单题proof；未归属/层级歧义显式标记。单题详情96KiB/64范围/8张所选独立图片；proof里的邻题图片仅元数据，不获得发送/出卷权限。

MaterialWordRepository.questions复用既有派生结构，缓存最多一份资料索引，按源摘要失效，返回前再读结构/版本；无新DDL或模型依赖。typed IPC→MaterialWordQuestions可操作预览，严格源验证函数保留后续AI入账使用。archive v3、独立AI图片来源账本和正式输出接线仍继续，未把候选来源升级为已确认事实。
<!-- kb-word-question-20261027:end -->

## 2026-10-27 App bootstrap 生命周期

runtime探测未决时App不bootstrap；判定Pi或failed后执行共享init/student、知识概览和确认队列数据路径，明确legacy-test才继续旧DeepSeek表单/外层会话/待输入读取。knowledgeOverview/aiConfirmations仍服务学习概览/录入；Pi/资料/设置组件仍自行加载。共享IPC、学生records/reports、main authority与订阅不变。未拆App、未改DDL/协议/依赖。限定证据：`../goal/PRODUCTION_BOOTSTRAP_CONTRACT_20261027.md`。

<!-- kb-word-20261027:start -->
## 2026-10-27 Word 图文来源与主线续接

新增 Word 受管 utility，固定 60 秒超时/取消及 ZIP/XML/图片预算。正文、FTS、结构、资源版本在同一 SQLite 事务发布；图片先 SHA 校验并临时文件原子发布。读图复用文件描述符限量读取/身份与SHA校验。旧资料显式重整用正文摘要和引擎 CAS，保留业务题目；派生结构不授予题目完整资格。

Word重整进度独立于页面生命周期：主进程最多64条状态/一个active任务，typed word-job轮询恢复，取消匹配资源版本，完成按jobId触发正文刷新。
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

当前完整基线仍是本地资料→持久解析/OCR→FTS+BGE+Lance混合检索→规则文字题/可选逐批授权云端双阶段AI定稿→同题本/整卷集中确认。此次重排为独立本地文本模型，受管本地视觉识题、完整图文/DOCX公式与图片锚点、跨页/答案册配对仍须继续。

S5-B3已接通有限中文交叉编码器：资料库、同一题本与小智现检索适配器使用BGE-reranker-base q8，对前20对象评分，再与原召回等权RRF融合，未评分尾部保留。新冻结Windows EXE懒启动、15秒总预算、队列/输出/窗口有界、空闲回收；错误/超时保留原排序并显示降级。模型不更改题目、答案或来源，不给教师展示虚构正确率。

末次返回改为对象版本及父来源revision的一条SQL栅栏，保留不受后台新资料影响的结果；父来源变私密/删除只剔除相关项并明确partial。新增retrieval_source_revisions派生时钟，不进入向量事件类型；历史seq0和墓碑的存在/内容/seq来自同一SELECT，防止旧行被错误绑定到新seq。原事实与索引世代不因重排重写。

RerankerClient由现utility拥有、固定manifest逐文件核验后启动独立只读ONNX子进程；向量写者不因重排超时被杀。cache仅保存分数拷贝，query/ID/正文/完整性/模型身份进入key；score不作为业务资格。

用户2026-10-26最新指令：此前均为测试信息，影响新流程的旧版本内容/测试数据可直接清理重建，以最新实现为准，不将开发测试数据永久兼容作为阻碍。此授权不等于覆盖协作者源码；正式交付后的教师数据仍按产品保护规则处理。自动删除旧包及未采用模型曾被审批策略拒绝（仅返回blocked by policy），已改为可恢复隔离，用户已索要路径自行删除；工具未声称已释放磁盘。

整体Goal继续active。下一主线优先完整图文题/Word来源表示与归档、跨页/答案配对、可选视觉AI；随后旧代缓存GC、自然教师质量与长上下文/冷启动优化、40GB持续处理与统一最新EXE。当前合成质量/小型路径不能冒充企业级或全目标通过。当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；全目标完成后读取最新main、保留协作者变更并处理冲突。
<!-- kb-rerank-20261026:end -->


<!-- kb-semantic-20261026:start -->
## 2026-10-26 本地混合召回与批量索引（整体继续实施）

S5-A与S5-B1已接通本地题意检索和有界批量索引：冻结BGE中文embedding、LanceDB派生向量、FTS关键词RRF融合，资料库/同一题本/小智工具共用来源复验。教师可按改写题意查询、暂停/继续/重建；无系统Python或运行时模型下载。每批最多16事实、200000 UTF16字符及900KiB JSON，双文档编码穿插查询，推理后批量提交、receipt最后、事件批尾ACK。旧seq不能复活墓碑。

retrieval领域隔离SQLite事实事件、单utility Lance写者、冻结embedding子进程、模型/分词器/代元数据、来源复验。Windows writer独占共享锁由实际utility进程持有，OS于进程死亡释放；generation追平后原子切换。

来源依赖随题目事务维护；父正文/资源变化推动关联题目事件。archive按正文hash/隐私/可读状态校验；完整原图题按所有嵌套题面、答案和解析引用页检查隐私，未知/非法页按可能引用处理。OCR失败本身不废弃已核验完整原图和教师转写。来源升级DDL、触发器、source-closure.v2标记及重建安排在同一writer事务提交，中断回滚后重试；旧失败墓碑只能使用旧快照seq，不能误标教师刚修正的新版本。

完整目标继续active/DOING。当前实际向量搜索仍FLAT，尚无交叉编码器重排、自然教师holdout的Recall/Precision或百万级CPU P95证明；16条小样本批量通过不是40GB证据。下一位置：索引维护/ANN/重排与质量门槛，完整图文题/DOCX图公式锚点/跨页与答案册配对、受管本地视觉AI包、自然资料与40GB持续处理，最后统一EXE发行和main集成。旧NSIS不含当前源码。不得把本地embedding包称为本地视觉AI整理已完成。
<!-- kb-semantic-20261026:end -->


<!-- kb-pdf-20261024:start -->
## 2026-10-24 长PDF持续处理落地（完整目标仍进行中）

S2-B已接通长PDF按页持久处理：受管原件同一Windows只读句柄核验SHA，页结果逐条校验/事务落库后ACK；manifest/世代/任务lease与工作进程存活共同守卫发布。原生文字与OCR分别保存，混合页检查原生正文、数字和数学符号覆盖；needs_review/failed不发布正文。停止保留成功页，继续与显式重试分开。来源预览/layout支持第50页以后、直接页码跳转及已打开预览跟随引用。原件上限16GiB、10000页与单页/暂存预算是设计边界，未宣称已测极限。

新领域MaterialPdfRepository暂存页及chunks、持锁发布，db只提供事务/metadata/lease端口。PDF进程执行signal与用户signal联立，guard异步操作后及紧邻COMMIT均检查。发布按SQL复制，不在JS构造全书；S3从readingWindow消费。原始文件/题目事实及Pi唯一编排保持。

当前真实证据：固定新runtime 646文件/279039929字节，无新模型或Python依赖；61页/56272644字节明确合成混合PDF，1644453字符正文，59页完成、1空白、1超限失败，partial可检索。Electron主路径5项/2启动/0renderer错误；另3项来源跳转/双视口检查，旧S3数据库副本3项兼容读回。build、最终typecheck、renderer217/217、发布守卫4项和原生/OCR覆盖5项通过。精确记录见KB_IMPLEMENTATION_EVIDENCE.md；这不是自然教师资料质量、40GB规模或新安装包验收。
<!-- kb-pdf-20261024:end -->

<!-- kb-implementation-20261024:start -->
## 2026-10-24 知识库功能实施进展（整体未完成）

新增assets域MaterialImportBatches确定性消费者：SQLite保存授权根身份、目录游标、相对路径和逐文件状态；主进程独立于页面消费，人工暂停不自动恢复，退出中断的queued批次下次启动恢复。导入复用现原件hash/CAS与解析队列，流式复制可取消，重复提交不重复创建同名同内容事实。

MaterialFullTextSearch维护SQLite FTS和dirty触发器；发布新正文在同事务建索引，旧正文后台独立写事务补建，源变动/删除可重建。教师和Pi共享索引候选，Pi仍用现DeepTutor匹配，最多200候选，不再构造整库正文快照。

当前入口：启动知识库开发版.cmd（npm start -- --knowledge-preview），业务数据位于%LOCALAPPDATA%/Xiaozhi-KnowledgePreview/data，profile独立，避免与日常窗口混用。未修改D:日常运行目录，未重打旧安装包、未提交/push/上云。代码、typed preload、资料UI已同步。必要路径使用151份嵌套资料验证暂停/重启/继续，全文尾部命中并打开第92段来源；151份正文ready、242段已索引，详细日志/限制见docs/goal/KB_IMPLEMENTATION_EVIDENCE.md。
<!-- kb-implementation-20261024:end -->

## 2026-10-24 已批准的UI正式替换

统一亮色EduShell/15页合同及AgentProcess已接入真实typed业务入口；原厂样式独立、旧领域几何暂兼容，不引入第二套模型循环、DDL或IPC。公开过程在answer交接时整体收起；原始reasoning仅详情。范围、真实验证、未验领域及协作main交付以 `../design/ui-rebuild-2026-10-24/DELIVERY.md` 为准。

## 2026-10-24 当前：撤回UI对齐结论，建立重建审阅基线

用户明确否决前轮UI；旧测试结果不能继续作为视觉接受。已只读复现旧真实构建并记录11处CSSOM，证实旧玻璃主题/无layer外壳规则继续覆盖原厂；旧应用AgentTrace组合也不等同官方示例。已在同一1c54工作树保存177文件回退快照，建立15页合同、原厂示例对照/组件指纹、可点击Electron审阅稿。合同检查21项，样张22项/0pageerror，renderer217＋隔离8通过；本轮未替换正式业务页、未发新provider请求。已询问整体视觉与过程组合，等待用户确认，不擅改组件配置。main/远端仍b5a7fc6；旧空锁仍在，先前清理被自动审批拒绝，未提交推送。详见 `../design/ui-rebuild-2026-10-24/README.md`。 本轮不变更Master的本地优先、教师确认、来源与Pi唯一编排规则；总体DOING。

## 2026-10-23 当前：官方Agent Trace Streaming与正文体验

本轮用户明确取代DSH预览：采用官方多块/嵌套组合，运行展开、整轮终态收起、正文独立流式；删除输入上方额外遥测，目标控件迁至侧栏。普通解释自然段落，必要任务结构保留。最终真实Electron25项、原厂亮色双尺寸与控制台通过；边界16/轨迹19/renderer217＋样式7、技能25/22/14、兼容旧路径207通过。没有新SDK循环/依赖/DDL/IPC，权限与教师确认保持；Windows原生路径解析只替换等价调用、不缓存授权。首段仍有约6–7秒本地准备延迟，整体视觉/性能和Master仍DOING。Git main交付尚受遗留index.lock阻塞，清理被自动审批拒绝。证据与精确命令：`../../docs/audit/chat-ui-2026-10-23/AGENT_TRACE_STREAMING_DELIVERY.md`。


## 2026-10-23 DSH展示修正（最新）

只改renderer组合：每段推理独立披露/本地预览、执行入口分离、正文独立；原Pi/shared/SQLite不改，原厂HeroUI不改。用户已确认默认收起并保留手动展开。见 [本轮交付](../audit/chat-ui-2026-10-23/DSH_REASONING_DELIVERY.md)。

## 2026-10-23 模型推理输出通道（最新）

用户批准供应商API推理文本接入。Pi唯一loop和原生reasoning回传保持；新main脱敏桥只转发thinking_delta，独立model_reasoning事件/modelReasoning投影，既有assistant metadata version1持久化，32段/65536字符。原SDK消息/签名留main，正文items不混入推理；无新DDL/IPC/依赖。停止先中断SDK再清理确认卡；原厂亮色组件样式保持。实证见 [本轮交付](../audit/chat-ui-2026-10-23/MODEL_REASONING_DELIVERY.md)。

## 2026-10-23 样式审计与公开阶段补齐（当前）

新增应用CSS scope保护边界与统一heroui-styles入口；原厂CSS/源码不改。Pi公开阶段经共享投影→原消息metadata→主进程冷读→原ChainOfThought展示，限长/验证/按sequence排序，正文分段不改；可选finishedAt提供完整处理墙钟，预算用量独立。无新loop、表或IPC通道。 证据：`../audit/chat-ui-2026-10-23/style-audit/DELIVERY.md`。

## 2026-10-23 Agent Trace Streaming

Pi入口显式开启agentTrace，抽出OfficeAgentTurn/OfficeAgentTrace/agent-trace纯分组逻辑，沿用通用OfficeConversation兼容路径。shared只增可选startedAt，投影保留首个真实preparing，终态沿用elapsedMs；无存储迁移或新IPC。历史终态无计时器、折叠过程不挂载，稳定回调与单轮memo减少草稿牵动历史。 详情：`../audit/chat-ui-2026-10-23/AGENT_TRACE_DELIVERY.md`。

## 2026-10-23 对话体验增量（Pi与数据真源不变）

shared可选activity/resultSummary与partial_answer贯通main→preload事件→projection→renderer；按请求过滤宿主已知空范围，关闭记忆不可读；OfficeMarkdown统一公式，仅展示时兼容TeX括号。回复Markdown新窄IPC由main重读持久Pi正文、核hash、系统目录确认后复用现有document_artifacts；无DDL。证据/兼容见 `../audit/chat-ui-2026-10-23/DELIVERY.md`。统一任务展示适配器与成果工作台是下一轮规划，未建立新Harness协议。

<!-- 以下保留 D 盘停写前的历史记录，供业务追溯；当前状态以上方 main 记录为准。 -->

## 2026-10-22 DPI布局门禁

Electron以`--force-device-scale-factor=1.25/1.5`启动isolated实例，窗口内容区设置1366×768/1920×1080。测试同时记录实际DPR、CSS viewport、控件矩形和PNG物理尺寸，避免把请求尺寸当成生效尺寸；Windows fractional rounding最多允许2 CSS px。

构建`c7e088ca...`/373上两轮8视图通过。浅暗是实际build上的Chromium媒体仿真；系统主题菜单与真人读屏仍OPEN。

## 2026-10-22 Journal continuity与UI同步

event journal的SQLite state/event/outbox仍为单事务真源；receiver按run/generation/sequence连续拉取，重复丢弃、gap补页、navigation epoch阻止旧响应覆盖新会话。UI只在main权威snapshot或连续journal补齐后解除同步阻断，审批/写入/队列/当前事件依赖操作随gate禁用，草稿、只读、Stop和导航保持。

构建`c7e088ca...`/373通过19项journal、10项真实同步UI和12项真实journal UI。冷启只读取已提交turn；writer失败后为interrupted/unknown且不重试。H09真人读屏和全状态视觉仍OPEN。

## 2026-10-22 H10软件边界

当前构建`c7e088ca...`/373以隔离Electron、owned配置副本和真实DeepSeek通过网络两轮、公开图片13项与自然文件14项。任务step绑定仍走唯一计划步骤确定性解析；浏览器、图片上传、文件效果和教师确认的权限/回读未放宽。

发布边界未变：项目未引入electron-builder/forge；PowerPoint/WPS动态放映和安装包没有因软件测试通过而完成。H10整体继续NOT_ACCEPTED。

## 2026-10-22 任务工具的唯一计划步骤绑定

`tasks/plan-runtime.ts`仍是写入与候选卡的唯一准入点。effectful工具没有模型传入的`taskStepId`时，宿主先刷新当前run证明，再从最新计划筛选该工具对应的criterion kind：只允许唯一executing，或唯一pending/needs_fix步骤。随后继续原`previewAdmission`与SQLite checkpoint，记录step、plan revision、run/generation、call、tool、input digest、resource和criterion IDs。

无计划、多匹配、waiting dependency、verified、tool scope、resource和source不符合仍失败；human不能覆盖机器目标，跨run效果不重放。构建`c7e088ca...`/373通过17项边界和三条教师主线回归。PowerPoint前3项原生打开/渲染/文字备注通过，动态放映仍受Windows前台权限阻塞。

## 2026-10-22 教师资料备课回归

当前构建`03e62d96...`/373的纵向链仍是：快捷入口草稿→附件选择/正文读取→Pi唯一教育循环→全文草稿→教师审阅→main-only审批与文件写入→SQLite/native readback→冷启恢复。`pi-teacher-materials-current-OTCw4d`5/5通过，7次provider请求200、0 renderer错误、冷启0请求；长历史分页未改变附件、审批、文件或Pi真源。

本结果只证明软件链，不证明目标教师课程判断。owned test profile因递归清理策略剩余321文件/47,090,422字节，记录在主线进度JSON，不作为生产profile或正式证据数据重新使用。

## 2026-10-22 H09有界历史页

首次`getXiaozhiSnapshot()`只构造最近40轮。SQLite `getAiConversationHistoryPage()`用当前session的user message rowid与公开turn身份`agentRunId||messageId`形成页边界，查询该页完整消息、最多40个turn和`hasMore`；`xiaozhiState.runs(id,pageRunIds)`与`eventJournal.snapshotsForRuns()`只读取该页run，不再先取全会话消息或journal。

`xiaozhi:history-page`只接受当前session的`before`和1–40页大小。renderer把更早turn插入头部，Event journal cursor按run合并；`OfficeConversation`用React layout提交后的同一turn视口位置补偿滚动。无DDL、依赖、新Agent Loop或业务真源变化。最终`03e62d96...`/373连续两轮1000轮Electron验收通过，H09整体仍IMPLEMENTING。

## 2026-10-22 H09窄窗与Portal移动侧栏

`src/main/index.ts`主窗口最小宽度390、最小高度720。`PiWorkspaceShell`把桌面侧栏包在`pi-sidebar-primary`，并在HeroUI `Sidebar.Mobile`中复用同一`AiConversationSidebar`；移动Sheet在Portal中不继承workspace祖先，因此使用`pi-sidebar-mobile-sheet`专属作用域恢复`.sidebar__offcanvas-wrapper`显示、全高和`pi-themed-surface` token。

构建`8375c55c...`/373的同构建证据为窄屏两轮（含forced-colors）、网络安全一次、图片一次、文件一次、快捷入口9/9及renderer240/240；accessibility tree确认移动Dialog名称为“会话侧栏”。无新IPC/DDL/依赖/权限或第二Loop。该结构只支持窄桌面/测试；真人读屏软件操作、长历史性能和journal压力仍OPEN。

## 2026-10-22 H10同构建观察（前一构建）

最终构建`4dfb959f...`/373上，任务准入继续遵守显式`safeAfterVerified`：只有同资源、只读、身份不变的浏览器观察可在verified步骤后追加，导航/交互/换URL/写效果仍拒绝。`kind=human`上无意义的`target`在计划输入规范化时移除，其他字段和严格校验保持。

最终同构建网络5/5两轮、图片13/13两轮、文件14/14、renderer240/240，Pi唯一Loop、SQLite/文件真源、教师确认、供应商送达记录和冷恢复边界不变。周计划独立回读现在兼容宽表与每周键值表，但机器仍独立要求四周、目标/任务和空负责人；这是验收语义扩展，不改变产品写入权限或DOCX生成结构。后续架构改动只服务教师资料、错题、已有课件三条真实路径。

## 2026-10-22 已验证网页步骤的同资源只读观察

`tasks/plan-runtime.ts`对工具和实际action派生`safeAfterVerified`：普通safe_read/local_cache，以及`office_browser`的snapshot/screenshot/show/tabs/wait/scroll可在同一criterion资源已验证后追加；navigate/click/type/select/key/close和写工具仍受`task_step_already_verified`。`tasks/task-state.ts`仅在显式safeAfterVerified时放宽verified拦截，step resource、criterion、run、generation和call身份不变。最终`d8ec...`/373真实日常配置副本联网连续两次5/5。

## 2026-10-22 小智状态写锁恢复

`OmniEduStore.xiaozhiState.sql.transaction`在独立sqlite3连接上以`busy_timeout=0`执行`BEGIN IMMEDIATE`。`SQLITE_BUSY/LOCKED`只重试“获取锁”：关闭连接，异步指数退避25/50/100/200/250ms后重开，总窗口10秒；BEGIN成功后事务动作不重放。这样避免多个连接同步busy wait占满libuv，同时保持事件回执和工具准入为执行前持久化门槛。

构建`a66595d2c3a7cbaeda35333cc3ebfed10f02e5a5764a4167c14b1007ea3db46c`/373。状态专项5/5在真实6秒外部锁下恢复并冷读；正式Electron/真实DeepSeek事件链12/12。无Schema、IPC、依赖、provider、Pi Loop、权限或隐私规则变更。

## 2026-10-21 小智状态写入排队与任务安全读取

`main/xiaozhi-agent/serialized-state-sql.ts`包装production Store的`run/change/transaction`，在打开新写连接前排队；失败释放队列，事务内继续使用同一work连接。`tasks/plan-runtime.ts`允许无taskStepId的safe_read/local_cache在任务状态写锁外通过，写与外部效果仍要求已准入步骤和匹配资源。`events/publisher.ts`把失败对象传给production-host，仅记录有界内部故障码和工具/超时元数据。任务计划schema哈希未变，旧会话继续可读。

## 2026-10-21 教师答复误停修复与主线收紧

verification/teacher-input-readback.ts为main-only只读适配器；原native-tail/已提交控制事件/实际回执共同证明ask_teacher答复已送达，返回有界opaque摘要，不公开正文或新模型循环。production-host在原Goal boundary调用；GoalProgress v2=evidence_and_teacher_input，newTeacherInputs与newEvidence独立，v1兼容；typed现有goal事件/快照与PiGoalControl显示同源状态，无新IPC/表/包。队列handoff未激活，不能据此称全部补充输入已完善。

## 2026-10-21 等待审批退出崩溃：限定修复验收

main/desktop-ipc-lifetime.ts代理现ipcMain.handle，关闭准入并等待已进入监听器（含拒绝），其余Electron事件/移除行为保留。main/index.ts重复before-quit必须等待同一清理，关闭本进程窗口、drain IPC/原生产者后await store.close再quit。无新IPC/表/包/Loop。正式pending三路径10、正常Pi审批保存7及门禁见harness-shutdown-20261021-ipc-drain/progress.json；任意强杀/永久挂起未据此通过。

## 2026-10-21 探索资料不误停，定位不冒充成果

office_list_files/file_stat经Hana实际IO来源身份＋当前授权/native/快照复核后可推进持续目标，同源只得一次定位信用；目录/元信息仅作中间checkpoint，最终正文/保存/教师验收仍独立。UI说明仅定位、未核正文。旧记录不补造通过，无新IPC/DDL/依赖/Loop。

85e235ee同构建：实际Pi Electron三级定位→正文→同目录审批保存→确认/冷启、同源idle3停止共7项，Hana/FS反例19、旧改稿14、真实store8及type/npm隔离build/renderer234/legacy207通过；166事件/11回执/进展key/文件/native独立对账，4张原生浅暗双尺寸图已看。模型明确SSE，不是provider/真人证明。精确范围harness-h05c1-20261021-discovery-delivery/progress.json。

完整H05和原NETIMGFILE等仍OPEN；HARNESS-SHUTDOWN-PENDING-01保留超时收尾NAPI fatal待归因，未因正常冷启通过而关闭。日常out/profile未替换。

## 2026-10-21 教师验收要求增删/重排

在“核对目标成果/任务成果→修正要求”添加、移除或上移教学验收要求；main分配新增ID、保留项不重编号，机器标准和依赖不删除。保存使旧确认失效/暂停，正式目标显式恢复后按新版本确认；旧目标API仍用同一Task验收权威。

冻结30745e68：实际Pi/typed Electron增删→恢复→新确认→冷启7项、同构建读原稿/重新审批改稿14项、边界12、浏览器22、真实store8及type/npm隔离build/renderer234/legacy207通过；68事件/native/action/history独立对账、4张原生浅暗双尺寸图已看。模型明确SSE，不是新provider/教师人工证明。精确命令及范围见harness-h05b2-20261021-criteria-final/progress.json；完整H05、原NETIMGFILE与后续Goal仍OPEN，日常out/profile未替换。

## 2026-10-21 新要求恢复与原稿历史核验

实际原Pi/typed教师操作现已验证修改要求后重新读资料/原稿、两次新批准改稿、新版教师确认及冷启；冻结a755，正式Electron14项模型流为明确SSE，非真实provider/教师独立证明。原稿经raw SHA/脱敏全文/before与当前after核验后标“历史输入”，不代替当前file标准。真实store8、专项与renderer234/legacy207、257事件及文件链独立对账见harness-h05b2-20261021-goal-revision-delivery/progress.json。完整H05仍IMPLEMENTING，教师要求增删下一片；原NETIMGFILE、真实provider、无VPN/安装/Office动画-WPS/真人继续OPEN。

## 2026-10-21 正式Goal与Task单一验收接缝（整体IMPLEMENTING）

新增tasks/goal-binding：TaskView可选goal id/要求digest，1–8项原教师标准固定映射human criteria，机器来源/效果标准保持现readback权威。摘要/waiting/run revision不升级要求版本。正式恢复经prepareGoal只读预检→原host.start→同task新run；唯一旧task显式补精确要求，冲突历史不猜合并。

GoalController旧accept转TaskCoordinator.acceptGoal，TeacherActions.review/correct同步goal.state/criteria、task、action/source/history；journal.changeTask在同事务附带goal公开投影，renderer同事件更新两者。所有机器当前proof通过才记录正面教师动作；缺proof整次回滚，不留下部分human通过。复用PiTaskReview、原typed操作与Pi唯一loop，无新表/包/外部传输。当前冻结52cc35ab，373文件/144列明源码；验收见H05合同和goal-task-delivery报告。修改要求后的新版本恢复/改稿仍待验，不自动继承旧proof。

## 2026-10-21 H05-B2 v3实际派发与恢复接缝（IMPLEMENTING）

v3任务计划与旧v2分版；tasks/plan-runtime在原Pi beforeDelivery生成宿主resource/digest、核来源和传递依赖，剥离模型taskStepId后才交领域工具。task状态与公共checkpoint同SQLite事务；修复最终refresh的来源撤回分类，不把可修正准入失败当持久化故障。未知效果不放行，human步骤不能接管机器写目标，跨run换工具也不能重放同资源效果。

显式typed task-resume→原production-host.start→同task新run；revision/要求版本/command幂等、来源和owner由main核。result-recheck.run读取旧中断native绑定/实际settled回执及当前权限效果，恢复第一模型请求前先重查；教师确认聚合当前与历史run的新证明。lastRunId新增可选兼容字段，不改旧v2/native字节。零DDL/新依赖/第二loop；正式goal多标准adapter仍未交付。以下前轮“恢复未完成”为历史时点，精确证据见H05_TASK_STEP_ACCEPTANCE_CONTRACT顶部。

## 2026-10-21 科普教学数据适配

shared/science-teaching.ts唯一数据契约；main/science-figure校验真实部件映射并写惰性metadata；main/science-teaching严格解码版本/字节/字段/部件，science-demo固定模板展示教学内容，science-ppt读取同一版本。沿原text-change审批、workspace版本/权限、typed预览与导出，不新增表或IPC。脚本/URL/模型任意HTML不由教学字段执行；导出阶段零模型生成。旧无teaching文件按原通用页处理。

## 2026-10-21 H05-B2生产任务接缝（实施中）

production-host使用tasks/coordinator：普通start/finalize、压缩事件owner、人类snapshot/review/correct贯通task私有状态与已提交公共事件。journal.changeTask在原事务内提交task/来源动作/历史/event/outbox，publisher.checkpointTask保序；真实OmniEduStore事务callback已补同连接change。未知/损坏任务只禁核对而保留对话。tasks/result-recheck重建原native/settled receipt，以当前权限复用现Hana/附件/教育effect readback；不执行模型或重放效果。

typed IPC/preload与PiTaskReview已接入，但只有原请求human标准；plan.v3/逐step准入、正式goal标准同步与剩余步骤恢复未完成。Pi唯一loop、旧plan.v2指纹/数据及教育事实保持，无DDL/新依赖。精确实现/分层验证和原红项见H05_TASK_STEP_ACCEPTANCE_CONTRACT顶部及harness-h05b2-20261021-product-review/progress.json。

## 2026-10-21 H05-B2教师动作后端（未生产导入）

新增teacher-actions与task-evidence，main-only方法把真实保存成果digest/criterion版本、人类决定与修正来源回执同SQLite事务保存，要求修正失效旧检查并暂停。readback复用既有Verifier；缺main回调不拿缓存通过，系统failed/unknown不能被全选覆盖。准入固定criterionIds，按task资源保护跨run效果，兼容旧记录不补造映射。仍无production-host/typed IPC/UI接入，下一步必须贯通该纵向链；当前进度/26＋27专项及反例见H05_TASK_STEP_ACCEPTANCE_CONTRACT与harness-h05b2-20261021-teacher-authority/progress.json，B2未完成。


## 2026-10-21 H05-B2状态基础（未生产激活）

新增tasks/task-state.ts与shared/xiaozhi-task.ts，独立app_settings命名空间和现SQL事务/CAS保存task、source/criterion、step、准入与不可变版本，零DDL。来源从实际用户消息/command/owner读取；模型状态与核验分开。准入核依赖、工具/资源，防重复call重建派发；resume保ID、旧效果待核对。尚未接到production-host/Pi/公共journal/typed IPC/UI，教师确认与标准修正也未完。严禁把内部历史当公共journal。现构建SHA仍与B1相同；完整合同H05_TASK_STEP_ACCEPTANCE_CONTRACT，状态IMPLEMENTING，真实路径仍OPEN。


## 2026-10-21 H05-B1 独立读回与原Pi有限续跑

生产host复用本轮readback、native tail、现文件/效果权限与publisher，在原goal turnBoundary前提交独立verification，再由纯goal-progress按语义证据去重。私有seen集合与公开result_integrity提示分开；原Pi finishTurn链action=end，保留原SDK调度与队列，不引入第二模型循环。归档/暂停/旧authority fence，3idle终止；review_required仅正常最终文字收束。兼容旧goal/native数据，无DDL/新依赖。限定验收、反例和B2任务范围身份/criterion/admission缺口见docs/goal/H05_EVIDENCE_PROGRESS_CONTRACT.md、HARNESS_EXECUTION及harness-h05b1-20261021-delivery/progress.json。


## 2026-10-21 H09-C3 版本化公开计划

plan.v2共享契约→现control-state CAS→已提交journal完整plan→host snapshot/typed只读history→PiTaskPlan/PiPlanHistory。旧v1读取保留，native能力标记独立追加、不改旧指纹/prompt；工具结果边界附宿主引用，计划依据仍核真实同轮回执。无DDL/新依赖/第二Loop；私有CAS成功但journal失败不得公开为采用。结构采用不是步骤结果核验。限定验收/下一步见docs/goal/HARNESS_EXECUTION.md及apps/desktop/test-results/goal/harness-h09c3-20261021-receipt/progress.json，Goal ACTIVE。


## 2026-10-20 H09-C2 同步与过期操作（LIMITED_ACCEPTED）

receiver临时同步状态→现typed list/snapshot→OfficeSynchronization context/原生fieldset与portal内边界。同步ref防导航/渲染间隙，最终执行权仍在main CAS/权限。草稿与取消独立，无DDL/新包/第二Loop。对账与下一步见docs/goal/H09_EVENT_UI_CONTRACT.md；精确证据apps/desktop/test-results/goal/harness-h09c2-20261020-accepted/progress.json。Goal ACTIVE，其他原验收仍OPEN。


## 2026-10-20 H09-C1事件界面

H09-C1只改公开事件消费者：稳定计划身份与临时展开选择、严格核验引用的只读详情。原journal/typed IPC/主机验证/Pi Loop不改；真实journal与metadata/final projection一致，既有backend→UI链实际读回。 对账及下一步见docs/goal/H09_EVENT_UI_CONTRACT.md，精确证据harness-h09c-20261020/progress.json；Goal ACTIVE。

## 2026-10-20 教师课件交付

科普导出为教师显式文件操作，Pi唯一Loop不改。main复用workspace预览和授权，固定沙箱img/canvas生成GIF与PPT，abort显式终止WebContents等待，源版本/hash重核与独占保存，无DDL。新增MIT gifenc1.0.3（172516bytes、纯JS），复用pptxgenjs4.0.1。 说明和实例见docs/integrations/ANATOMY_TEACHER_PPT.md；准确证据见harness-anatomy-ppt-20261020-teacher/progress.json。整体Goal ACTIVE，下一步H09-C。

## 2026-10-20 Anatomy科普绘图

Pi唯一Loop新增声明式绘图工具，原typed change→审阅→教师批准→文件hash/CAS/undo复用，无DDL或第二Loop。固定HTML脚本+SVG img，iframe allow-scripts无same-origin；工作区仅抽取有界场景重建受信模板。MIT vendor/许可随build。 详见docs/integrations/ANATOMY.md与harness-anatomy-html-20261020-reviewed/progress.json。整体Goal仍ACTIVE，下一步H09-C。

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

架构：共享training-progress + main training-results仅适配现学习事实；原student-training.v1视图追加可选progress，旧调用兼容，不新增IPC/迁移/Agent。原Pi learning provider以相同事实集合提供最小进度数据，不暴露recordId。
<!-- dt-path-status-20261014:end -->


<!-- dt-reading-20261014:start -->
## 2026-10-14 阅读续接交付，下一 DT-MAIN-02

DT-MAIN-01 版本化逐段阅读/笔记/重启恢复/当前段落辅导入口 LIMITED_ACCEPTED。Master ACTIVE，Phase4/5 DOING；智能组卷已移出队列。下一 DT-MAIN-02 个性化辅导与学习路径→OpenMAIC 互动课→Hermes 无感反馈。

Evidence：apps/desktop/test-results/goal/dt-reading-20261014/progress.json（最终同build正式4项/2启动/0 renderer错误；组件217/217、6项定向实例；实际浅1366/暗1920图审）。复用此前通过实际UI导入/OCR的真实物理扫描事实；本次不重复OCR。原图/笔记不上云、旧版本/笔记不覆盖；LLM讲解未独立判正确，完整沉浸阅读/全DeepTutor仍未完成。详细结果与首次失败见 CURRENT_STATE 和上述 progress.json；无提交/push、正式数据或凭证修改。

架构增量：MaterialRepository.readingPage/study/saveStudy；独立幂等增量迁移material_reading_entries，resource_id关联原资料。源/body/最新revision原子CAS；追加历史不覆盖，源变化保旧记录。薄typed IPC和MaterialStudyPanel接原宿主。
<!-- dt-reading-20261014:end -->

<!-- harness-execution-20261012:start -->

## 2026-10-15：S1/F07 原位置交互与 BoardUI 复核

M10/M12；Master/Goal ACTIVE，H04 DOING，本片限定接受。问题、回答、复制/文本/产物/教育核对沿原组件及回调，按原runId/callId回到对应工具后、下一段正文前；工具组在卡处切开，未知旧锚明确保留在“其他交互记录”。Learning/Collection只读补已有callId；原题批组补已有rootCallId并仍聚合一组。无新DDL/IPC/依赖/循环或上传授权。

固定2df5ce828d1787ccf6eb3e06944d151b505024ac3675fb285492abb5d9d298e5/368：正式Pi/DeepSeek提问、回答、复制批准/拒绝、刷新/切会话、正常退出/真实自有进程崩溃分开验证，9jyRZp 8/8。原公开合成图Dg1XGd 13/13，独立先查看PNG冻结gold，真实图hash/HTTP200/验证码及形状位置一致；冷恢复原位置YZ2lO3 3/3，包括相同回答幂等、冲突回答拒绝且无新run/native。浅1366/暗1920图已查看。

renderer11、领域98、BoardUI复核8、独立SQLite/native/文件/图/源码manifest读回5、组件217、隔离legacy教育smoke207均通过且exit0已收取；type/原vite配置隔离build exit0。BoardUI6文件原/适配hash均一致，仍由host真实状态和来源驱动。不是模型自评；未把图片送达当成所有识别正确。

首失败cAPgAK与j2yCK0保留：前者复现旧尾部定位，后者是测试误把正常退出当崩溃恢复；生产正常停止规则未放宽。旧学习夹具缺collections只补fail-closed测试依赖；SSR复用实际classroom-preview构建器。收尾production-host出现并行源码漂移，未覆盖；本片证据只对应固定构建，不归到最新main/共享out/安装包。

证据与精确命令：apps/desktop/test-results/goal/feishu-inline-20261015/{progress.json,progress.md,commands.ps1}。原日常IMG/FILE反馈、用户原图、无VPN、全业务卡真实UI/全部H04 golden、完整12路及H05–H10仍OPEN。下一步S2：先核“2”的实际来源，再冻结安全只读12路；F05/A13无callId队列保留原入口，不能猜定位。无commit/push。

本文件口径：OfficeConversation接收只读interactions并按工具边界插入；PiInteractionCards复用原教育/Office/控制组件。既有payload的可选callId/rootCallId摘要，无新表/IPC。


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

稳定架构：Pi原生模型/工具loop→现dispatcher边界→领域工具；main持久attempt/barrier，typed事件与原投影负责展示。没有新loop/事实表，Hana registry与execute-once保留。


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

当前实现画像见A；目标设计见D。Pi原生循环继续唯一运行时，建议增量建立Goal/Task/Step、Effect/Evidence/Verifier/Event协议及SQLitejournal，旧domain/JSONL通过adapter对账。目标接口不是当前API；不能把文档Mermaid当上线。

<!-- harness-audit-20261012:end -->


## 2026-10-11 KB-S5-B限定接受，接续S6（历史读点）

现Paper确认快照→确定性v3编译→本地来源图片facade→同Office审阅/图片hash批准→原ImageRun/PDF生成器→现文件权限/源CAS/同步安装→Paper派生谱系；未新建题库、文件宿主或Agent编排。

KB-S5-B自然扫描图文交付 LIMITED_ACCEPTED（单题范围）。build 517b30ea70e2e46b1e1b2fbc68d311a461b9d052f1d50e42850b00fa74fb867e /340文件；build/typecheck exit0、领域292、组件203/203、导出边界15、Office底座17、coordinator11、正式新版Electron17项/2启动/20张浅暗双尺寸截图/0 renderer错误、兼容smoke207/207。真实授权物理扫描→同Pi提取完整题面原图→教师六项核对及补充答案→纯题库1题8分卷→同Office按版本图片确认→学生/教师DOCX/PDF四份真实文件→重启读回。DOCX媒体hash与PDF解码像素等于确认原图；学生文本答案隔离、改标题旧确认失效、缺图片确认拒绝、实际图片损坏拒绝与停止无落盘均通过。Microsoft Word 16.0 独立实例只读打开两份DOCX并实际渲染，输入文件字节不变。4条Paper谱系、0条误标AI来源，4个批准hash匹配；教师补充答案和解析仍未独立验证。证据：apps/desktop/test-results/goal/kb-office-rich-20261010/closeout.json。


## 2026-10-10 KB-S5-A限定接受，下一图公式联合验收（历史读点）

PaperRepository已确认快照→确定性compilePaperOffice→同Office coordinator→版本化v2拟稿→源复核→现OfficeGenerator→exclusive文件安装→Paper派生谱系。旧v1无改。

KB-S5-A文字整卷Office交付 LIMITED_ACCEPTED。build e73b1f1c3a393192b7858953d53a84ccd2807ebf23b4c1d547d4670d6d3ac3a0 /340文件；build/typecheck exit0、领域291、组件203/203、导出边界11、Office底座17、coordinator11、正式新版Electron19项/2启动/0 renderer错误、兼容smoke207/207。24张最终浅暗双尺寸UI截图和4张最终A4 PDF渲染实际查看；独立Word XML/PDF文本核对20题及学生答案隔离。同一Pi→现Office教师审批→学生/教师DOCX/PDF四份真实文件、4条Paper谱系且0条误标AI来源，冷启读回一致。来源变化、实际拒绝与停止均零落盘；同会话新卷确认后旧选择隐藏导出，避免导错版本。教师仅改标题，原题不改，answerVerified=false。证据：apps/desktop/test-results/goal/kb-office-20261009/closeout.json。


## 2026-10-09 KB-S4-B限定接受，下一S5/S6（历史读点）

S4-B：LearningProvider交付证据map→MistakeSimilarProvider当前学生/快照CAS→同题库候选→共享题目别名→QuestionContextProvider实读→PracticeReview。单Pi；无DDL/新增依赖。DeepSeek私有provider fetch适配覆盖现唯一streamFn，自动压缩仍复用原SDK机制。

KB-S4-B同Pi本地候选→实读→受审练习 LIMITED_ACCEPTED。build ab6835d59e7d7c65e24895eafeaef6915482dc3b60e02a3f8f68c66004b2a037 /340文件；build/typecheck exit0、领域289、组件203/203、模型目录19、SDK fetch边界5、正式新版Electron26项/5启动/20张已查看浅暗双尺寸截图/0 renderer错误、冻结构建兼容207/207。真实DeepSeek读取实际交付照片学习证据，查询10候选、实读原题及所选5题版本，排除两道实际进入Top10的面积干扰；教师修改后只保存1份5题练习及5条使用记录。实际拒绝、停止冷恢复不重放、重复确认幂等及冷读通过，题库/学生事实不新增或改写。Node fetch目录/SDK ECONNRESET通过Pi原生fetch hook接Electron net.fetch修复，固定官方HTTPS/不带cookies/不重定向；容量来自官方目录，不硬编码。证据：apps/desktop/test-results/goal/kb-similar-pi-20261009/closeout.json。


## 2026-10-09 KB-S4-A限定接受，下一S4-B（历史读点）

S4-A沿照片facts.forRecord→同题库游标→保守身份→来源CAS→typed preload→MistakeSimilarQuestions；无新事实表/依赖/Agent runtime。

KB-S4-A本地关联候选 LIMITED_ACCEPTED。build 428fbf1a36c6ac12608442ed82a4c8def91734bccf889753daec5e34e3aca31a /340文件；build/typecheck exit0、领域282、组件203/203、正式Electron19项/3启动/0 renderer错误、兼容smoke207/207。12张最终浅暗1366×768/1920×1080截图实际查看。教师自制数学图片→固定本地OCR→教师事实确认→17条真实UI题库对照→本地Top10；原题/副本/错年级/错学科/缺答案排除，空结果、源版本故障与恢复、跨学生/旧receipt拒绝、真实停止无晚结果、冷读一致通过。纯文字题不伪造原图入口。method=local_knowledge_keyword_v1，仅知识点/文字关联，未证明语义或答案正确；不调用模型补题、不改学生事实。证据：apps/desktop/test-results/goal/kb-similar-20261009/closeout.json。


## 2026-10-09 KB-S3限定接受，下一S4（历史读点）

paper-selection/repository/coordinator/API→现productionHost/fromMain/typedpreload→PaperBlueprintWorkspace/PiPaperReview；同Pi education_propose_paper/education_read_paper等待教师审批、只回脱敏摘要。独立native identity marker兼容旧会话，compaction复护已保存审核状态，不重放。

KB-S3 source_only整卷蓝图/审核/快照 LIMITED_ACCEPTED。build a0f860ac56680a4ddb1fa7798edd1e7c90812fae92f73b7a1156dddee7338448 /340文件；build/typecheck exit0、领域274、组件200/200、正式新版Electron12项/3启动/0 renderer错误、补充冷副本视觉3项/1启动/0模型请求、兼容smoke207/207。32张最终浅暗1366×768/1920×1080截图实际查看。23道教师UI创建对照，20道唯一题满足10×3+6×5+4×10=100；重复/缺答案/错年级、编辑废止、拒绝、精确缺口、真实源变化与恢复、幂等、停止无晚写、两次冷读和真实DeepSeek同Pi等待教师审批通过。原题不改，不自动补题，answerVerified=false；自制文字对照不是自然扫描卷或数学正确性证据。证据：apps/desktop/test-results/goal/kb-paper-20261009/closeout.json。


## 2026-10-09 KB-S2-B限定接受，下一S3（历史读点）

shared保守内容投影→题本当前页/现Pi当前返回集合；本机key不出站，Pi只出安全别名duplicateOf与scope，CAS保持原questionVersion。整卷候选将对全配额候选去重，页面局部结果不代表全库。

KB-S2-B 保守同题候选/版本绑定 LIMITED_ACCEPTED。build cb0a5c473cbffc23d483cd2c2027f80405ac1fdbb57b44495fa4402072e8c79f /340文件；build/typecheck exit0、领域258、组件194/194、正式新版Electron12项/3启动/0 renderer错误、兼容smoke207/207。12张浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照：跨记录ID/CRLF同题2条，改数值条件保持独立；20+2分页，真实Pi/DeepSeek同次10条安全别名/duplicateOf，源变化拒绝、精确恢复、两次冷启与索引重建通过。仅本地保守候选，绝不自动合并/删题或证明答案正确；页面范围current_page、Pi范围returned_candidates。证据：apps/desktop/test-results/goal/kb-identity-20261009/closeout.json。


## 2026-10-09 KB-S2-A 关键词底座限定接受（历史读点）

查询接缝：shared filters → 现IPC/preload → OmniEduStore facade → 同SQLite过滤/派生FTS；Notebook共用谓词，Pi保留源CAS/取消/别名。无新事实表。

KB-S2-A 关键词检索底座限定接受。当前build `443eae07f599fda05dfc5f241f85a8f62c942bc5cc9855cbc5e48f69777e3314` / 340文件；build/typecheck exit0，领域252、组件194/194、正式新版Electron11项/3启动/0 renderer错误、兼容smoke207/207。8张当前浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照题，六项硬过滤命中22道、20+2分页；真实Pi/DeepSeek读10条并标hasMore；冷恢复、索引删除重建、旧来源拒绝与精确恢复均通过。不是语义Top10、同题指纹、答案正确性、100分卷、数学Word/PDF或30–40GB验收。证据：`apps/desktop/test-results/goal/kb-retrieval-20261009/closeout.json`。


## 当前最高专题优先级：知识库与智能组卷（2026-10-09）

已验边界与后续门禁见精简执行卡；本次整理不把尚未实施模块标完成。

用户最新指示：整理上下文，集中完成知识库与智能组卷。当前唯一执行索引：[KB_EXAM_ACTIVE_TASK.md](../goal/KB_EXAM_ACTIVE_TASK.md)（仓库绝对定位 `docs/goal/KB_EXAM_ACTIVE_TASK.md`）。接续为 **KB-S2检索→S3纯题库100分卷→S4错题相似练习→S5/S6 Word/PDF联合验收→KB-002三模式/5变式→KB-003增量30–40GB**。R3/R4只按组卷/变式所需嵌入，通用解题长线及其他模式延后；下方旧节的R2→R3→R4线性Next不再是当前执行顺序。Master及知识库四项产品决策保持。


## 2026-10-09 B5-B限定接受与R2接续

架构接缝：shared事实helper与QuestionContextResult→现主进程reader/现IPC→typed preload→题本和来源dialog。无新Agent、表、索引或权限旁路。FastAPI仍仅未来可选计算transport。

本节是当前读点，下方同日旧节保留历史证据，不能覆盖本节。M05/M10 B5-B仅来源事实一致性保护已接受：answer/analysis镜像冲突及v2题干冲突由同一只读helper检测；typed IPC保留安全错误，题本/同Pi来源弹窗拒绝展示冲突正文，精确恢复后可读。旧v1摘要语义、questionVersion、批准与原图未被自动修复或重写。

当前build 367d53b3d85dbb2e1855cbb7db977859f94129e529aec6898f40b2dca8d3f6bf / 340文件，正式前后、冻结快照与兼容smoke后一致。build/typecheck exit0；领域243、组件194/194、兼容smoke207/207；真实DeepSeek/Pi Electron24项/4启动/0 renderer错误。32张当前浅暗1366×768/1920×1080截图与4份原图实际查看；三个隔离标量故障均拒绝、精确恢复、冷启一致；原生手动压缩1次后冷继续通过。此压缩不是新的自然自动阈值基准，smoke仅兼容路径，不作新版视觉依据。

物理扫描无独立标准答案仍missing，图15未知标记不认作答案；教师自制跨页算术仅来源绑定对照，answerVerified=false。完整B5独立质量、可靠求解/五tools、语义Top10、100分卷/Office、30–40GB、自然教师、安装/VPN-off与完整Codex体验仍OPEN。

**Next：R2保守同题指纹/中文检索、硬过滤/版本与可信复用合同→R3受限AST/SymPy→R4同Pi五tools→R5–R7错题/组卷/Office/容量。** 不因缺物理答案停止后续，也不凭题面批准/来源标签把答案当正确。Master ACTIVE、Phase4/5 DOING。证据：`apps/desktop/test-results/goal/b5-facts-20261009/closeout.json`；首次RED/build/组件失败与回滚副本保留。无DDL/依赖/第二runtime/日常资料或凭据改动，无提交/push，另一worktree保留。


## 2026-10-09 本轮低成本解题路线审查交付

解题域挂现main/education facade，同Pi注册五tools prepare/finalize，复用现MaterialRepository/question/practice/mistake/Office。确定性后台队列与计算Worker不另开Agent。精确指纹/FTS和向量索引均由本机事实版本驱动；FastAPI仅可选loopback薄传输。具体合同仍设计，五tools/数学验算未上线。

完整设计：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；实施：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`。证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-route-review/readback.json` / `supplement.json`。Master ACTIVE、Phase4/5 DOING；本轮未重跑build/provider/Electron/上游测试，当前B5-B草稿未接受，资料/凭据/另一worktree保留，无提交或push。


## 2026-10-09 B5-A：题本来源与答案声明的限定接受

QuestionNotebookWorkspace沿同typed list与现QuestionDocument，抽出QuestionAnswerEvidence只读presenter；翻译sourceKind/useType显示，不改存储或version CAS。新组件无新IPC/main/DB/DDL/deps，保持Pi唯一运行时。现renderer和original-multi Golden增来源/缺失断言，不另建runner。

题本参考答案与解析分别标注原资料提供、教师补充、小智生成、尚未提供或历史来源待确认；所有参考答案明确尚未独立核验。真实来源对照答案/教师解析与物理扫描题缺失都经过当前页面展开操作。教师确认题面不等于答案正确；原题、来源origin、批准、版本和图片字节保持，冷重启与同Pi精确读回通过。内部sourceKind/canonical/SQLite等不再出现在该题本的教师可见文案；未知来源不猜测。

仅接受B5-A来源/答案声明与本切片UI；完整B5独立图义/公式/条件/答案质量仍DOING。物理扫描卷无独立标准答案，仍missing；教师自制跨页算术只是来源绑定对照，不是扫描答案gold。answerVerified=false，不上传原图/私有路径，不将模型自评作证明。原生手动压缩1次与冷继续已验，不是新的自然自动阈值基准。完整可靠解题、Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off、完整Codex体验及Master后续阶段仍OPEN。

**Next：B5-B逐题独立对照来源/公式/必要条件与答案质量 → R2可信同题零额外生成、相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题/组卷/Office/30–40GB。** 不重复B4四类兼容代替新质量任务，不把本轮文案修复当完整解题完成。

Evidence：`apps/desktop/test-results/goal/b5-source-20261009/closeout.json`；正式 `education-journey-n5msKi`，含当前源/加载脚本、固定build、日志、24张已查看截图、失败与回滚点。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty），Master SHA未改，Phase4/5 DOING、Master ACTIVE。无DDL、新依赖、第二runtime、日常资料/凭据变更、提交或push；另一worktree保留。历史节保留当时范围，不覆盖本节。

## 2026-10-09 B4-D：单区域完整审核与新旧版本同构建兼容的限定接受

新page/box工具输入适配为一个region，复用现multi完整六项审核；旧同call的single候选继续原id/校验，不分叉。真正pending确认必须有projection，省略字段或必要图义尚未核对，UI/main均阻断；范围成功更改后实际六项全missing且每项草稿保留。源CAS、取消/真实子进程停止、事务内main强制死亡/回滚、损坏画廊/恢复、幂等和冷启动通过。旧v1单/多页及new-v2均经题本修订、精确版本Pi读回，原批准/图片/答案出处不改。

复用现coordinator/OriginalQuestionRepository.multi、QuestionProjectionFields、typed IPC、数据库和assets，没有新增IPC/DDL/deps或Agent。现golden/domain runner扩展；成功验收后删除未执行过时fresh摘要测试函数，正式加载版本SHA与清理后源码SHA分别归档。

只接受已核对文本传递和版本/权限/恢复安全。真实扫描原图已查看，图15深色标记显式记录来源不明；未核实的必要读数保持missing。物理卷没有独立标准答案，算术跨页资料是教师自制绑定控制，不能作为扫描答案gold。answerVerified=false；Pi只获必要文本，不发原图/私有路径。原生手动压缩1次＋冷继续不是新的自然自动阈值基准。完整B4/B5、可靠解题、语义Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off和完整Codex一致性仍OPEN。

**Next：B5原图/公式/来源/答案质量合同与独立核对 → R2可信同题零额外生成/相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题、三模式组卷、Office与30–40GB。** 现题本可见`teacher_resource`/`generated`内部来源文案，列为B5/R2产品文案待修，不把40截图限定核对当整页UX完成。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4d-closeout.json`，含当前源码/加载脚本、build、命令、首次失败、40张已查看截图及回滚快照。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty保留），Master SHA未变、Phase4/5 DOING、Master ACTIVE。没有DDL、新依赖、第二运行时、日常数据/凭据变更、提交/push；另一worktree保留。历史节只保留其当时范围。

## 2026-10-09 B4-C：新多区域审核与完整转写传递的限定接受

同question-projection helper、QuestionProjectionFields、PiOriginalMultiQuestionReview和现original-multi golden/domain runner扩展；未新增main/IPC/DDL/runtime/deps。本轮实际Pi/DeepSeek遵循既有question context/source/approval验证，只接收六项文本。范围修改完成沿typed现接口，renderer保留文字并撤所有coverage；可选冷视觉分支复用同runner，只处理已接受隔离副本。

接受范围是教师提供六项文本的完整传递与版本/审核/恢复安全，不是每个图义已经独立判真。图15已有深色标记，来源不明，须补明确原图审查；物理卷无独立标准答案，保持 missing；跨页算术是教师自制来源控制，不冒充扫描卷答案gold。完整B4/B5、可靠解题、语义Top10、100分数学卷、40GB、自然教师、安装/VPN-off与完整Codex一致性仍OPEN。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4c-closeout.json`；正式 `education-journey-cHFfHO`，定点视觉 `education-journey-otIM5j`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`；Master/日常数据/凭据/另一worktree未改，未提交或push。Phase **4/5 DOING**，Master **ACTIVE**。以下旧节仅保留当时证据，不能覆盖本节。


## 2026-10-09 B4-B Goal续行记录

B4-B同OriginalQuestionRepository作为单/多图facade，独立question-context-revision负责不可变修订合同，db只提供read facade。canonical题与批准根不复制；无新运行时、DDL、依赖。当前结构限定236领域/10正式路径证据，完整B4/B5未接受。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/`；正式 `education-journey-H1dgFq`。兼容冒烟 **207/207，exit 0**；见最终b4b-closeout.json。Phase4/5 DOING、Master ACTIVE。

## 2026-10-09 最新审查读回与实施边界

本次审查维持现Pi→教育facade→同资料/题库/错题/Office真源，固定Worker默认。B4-A草稿采用同document_json v2/六项投影/原确认账本，无新事实库或Agent；旧题编辑与正式接受未完成。新solver服务及五tools仍为分阶段设计。

方案：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；开发卡：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`；本次证据：`apps/desktop/test-results/goal/solver-audit-20261009/final-current-review/`。以下历史仅保留当时范围。


## 2026-10-09 本轮低成本解题路线审查与交接

本轮架构审查维持同Pi与SQLite/文件真源；解题纯domain facade接现host，固定Worker默认，FastAPI可选薄transport。完整题面/B4先于可靠解题；固定验证器须受限AST/版本receipt/覆盖与Windows生命周期适配，未生产采用。

方案：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；任务卡：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`；证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-review/`。以下历史保留其当时范围。


## 2026-10-09 B3 多区域原图与来源答案审核：纵切限定接受

M03/M05/M10 原题审核延伸已纵贯 shared→同repo→coordinator→main/preload→现卡→题本 gallery。同 SQLite 与正式 assets；无 DDL。完整语义题面读取仍是 B4 前置。

Phase **4/5 DOING**，Master **ACTIVE**。只接受 B3 多区域原图/来源审核纵切，不接受完整原题转写、数学正确性、B4/B5 或完整 KB-EXAM-001。

最终 build `df2a6f837b39d5feaa66df56b4239101552ebd613c23277a2ef4b4e317c99828` / 340 文件与当前 out、正式流程前后逐文件一致。build/typecheck、renderer **181/181**、领域 **225**、真实 DeepSeek/Pi 正式 Electron **12 项 / 3 启动 / 0 renderer 错误**、全部 5 张原件像素对照和旧兼容 **207/207** 通过。12 张深浅主题、1366×768/1920×1080 截图及 5 张原图实际查看。停止真实范围渲染子进程实测 **1617ms / SIGTERM**，不外推其他设备或完整性能基准。

真实物理扫描题两块原图完整保留条件、图14/图15、表、选项与小题；**手工文字仅摘要，缺少例如“不更换实验器材”等完整条件，不能单独作为 LLM 完整题面**。该卷没有独立答案 gold，答案保持 missing。另 3 页算术对照为明确教师自制材料，只验证跨页及来源锚点，不冒充该卷标准答案；来源答案与教师补解分别保存。scope 更改须重确认，source CAS、外帧拒绝、真正确认 SQL 事务中 main 强制死亡/回滚、冷恢复、损坏整组报错/恢复与幂等均通过。

复用同 Pi、ai_confirmation_items、question_bank_items/document_json 与 QuestionAssets；取消修复沿现 owner AbortSignal，不新增 AgentLoop、DDL、依赖或模型。SDK 12 条 assistant usage 保留，cacheRead 是 SDK 报告 token，不是题库命中率；SDK 价格 0 表示这里未知，不等于账单免费。

**Next：B4 完整必要题面上下文精确合同 → B5 联合验收 → R2 可信精确复用/相似 Top10 → R3 受限 AST/SymPy → R4 同 Pi 五 tools → R5–R7 两 MVP、Office、三组卷模式和 30–40GB。** 不得通过删除 document 或仅发 stem 绕过 `document_context_unavailable`。完整解题/语义检索/数学导出/40GB、自然教师、设备/安装/VPN-off 仍 OPEN；Master 其他 DT/MA/JOIN 与 Phase6–8 保持 OPEN。

Evidence：`apps/desktop/test-results/goal/original-multi-20261009/closeout.json`；最终正式路径 `education-journey-15t76q`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`（dirty 保留）；未提交/push，不改日常资料、凭据、历史或另一 worktree。Master SHA 未变。以下历史保留其当时范围，以本节和最新真实证据为准。

## 2026-10-09 解题技术路线审查

十项现状/11开源/许可/两方案/工具/成本/Demo交付见[技术报告](XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md)。保留唯一Pi/同SQLite/固定OCR与Office；同education facade扩展检索/受限验证。FastAPI仅可选纯计算transport，不引第二runtime/库。当前B3多区域是未接受草稿，完整Pi图文reader仍阻断；当前out1cb12a07…不能用旧B2-c85d8e4d7…背书。本轮仅文档无产品变更。Next：B3正式接受→B4/B5→R2–R7；MasterACTIVE、Phase4/5DOING。

## 2026-10-09 B2-c 原页文字区域：生产纵切限定接受

M02/M03接缝：shared/material-layout→fixed worker/ocr-host→assets/material-layout→materials:page-layout/layout-cancel→typed preload→现MaterialOriginalPreview/MaterialLayoutPreview。派生cache以resource/source/engine/page寻址和hash envelope写入；已有OriginalQuestionRepository/QuestionAssets/question-document仍为后续B3事实与原图真源。

Phase **4/5 DOING**，Master Goal **ACTIVE**。仅接受B2-c文字区域切片；完整B2、R1-B、KB-EXAM-001、可靠解题与两条最终业务闭环仍OPEN。

最终build `85d8e4d7ecf997f052bf56f532c73e09d5f0710dfc7bc993ffaf8ab8b408f872`（340文件）与当前out逐文件一致；build/typecheck、renderer179、领域216、原生兼容11、正式Electron11/2启动/0 renderer错误、旧smoke207/207通过；16张深浅双尺寸截图实际查看。

公开物理扫描卷6页共304待校正文字行；UI识别＋回读实测每页7.851–8.900秒，不是纯模型基准或总体准确率。Page4 S₂→zS、Page6 U₀→U。且部分选项漏识别，原图完整保留；不能称完整切题/数学正确/来源答案。临时校对稿未存为正式题目，重启只复用派生候选cache；本片0模型请求，不等于整个解题成本0。S/M公式POC未推广；自然教师/日常profile、安装、16GB、VPN-off、30–40GB未验。

下一步：知识库方案§41 B3完整多块/跨页题目与来源答案审核→B4完整必要Pi上下文→B5联合验收→R2可信精确/语义Top10→R3受限SymPy→R4同Pi五tools→R5–R7组卷/错题双MVP、Office/三模式与30–40GB。Master其他DT/MA/JOIN与Phase6–8保持OPEN。

Evidence：`apps/desktop/test-results/goal/material-layout-20261009/closeout.json`（含source/build清单、commands、first-failures、manual-review和16张实际查看的截图）；正式当前UI为`education-journey-NEu3AR`，旧207仅兼容证据。

以下历史保持当时范围，当前状态以本节与真实证据为准。

## 2026-10-09 B2-b 版面/公式可行性结论（包含失败，非生产完成）

架构不替换：现Pi/MaterialRepository/同SQLite/原题ledger/Office；本片只在隔离POC复用官方API。下一版面协议和teacher UI适配见知识库方案§38，未经门禁不改变当前v1生产路径。

6页公开扫描卷保留304文字行四边形，单页3.609–4.263秒。S中文/单位/LaTeX质量失败；M三清晰crop主要内容匹配预先人工转写（1.494–2.331秒），退化单位错误、图表180秒超时、空白两次减号。没有完整题界/数学正确性/总体准确率证明。CPU实验设备i7-13650HX/约32GiB，不是16GB基准。

仅测试env安装71个hash锁包与官方本地权重，未改生产OCR/资料/数据库/凭据。商业发行闭包、Windows进程树强制取消和安装/设备门禁未接受。原正式out SHA e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件与Master/worker/manifest未变，无新产品UI或solver完成证据；未提交/push。

Next：知识库方案§38 B2-c版本化候选协议/现teacher入口合同→B3多块/跨页/来源答案→B4完整Pi题面→B5联合验收→R2可信检索→R3受限验证→R4五tools→R5–R7双闭环/Office/三模式/大库。Phase4/5 DOING，Master ACTIVE；本片不将完整B2、KB-EXAM-001或可靠解题标完成。

Evidence：apps/desktop/test-results/goal/layout-formula-20261009/closeout.json、manual-review.json、first-failures.json；知识库方案§37为结论、§38为下一合同草案。下方原历史证据保持其范围。

## 2026-10-09 B2-a 后台资料整理（限定接受）

新薄assets/material-parse-queue.ts挂同store和main start/before-quit/close；MaterialRepository commit接可选task lease，在同SQLite事务检查owner/CAS，取消失效拒绝。原件/正文/题库仍原真源，fixed worker协议及模型未变。Pi仅通过现office_read_material请求队列，归属检查沿用isCurrent/signal。

B2-a 后台资料整理已实现，已验最终build e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件：build/typecheck、renderer177、统一领域209（新增队列17）、正式Electron11/4启动/0 renderer错误及12张双尺寸深浅截图通过。实际deepseek-flash/Pi实读触发优先解析，SDK usage单独保留，不算账单/单题成本。同一最终build兼容207/207通过。仅B2-a持久后台整理切片接受；完整B2/R1-B/KB-EXAM-001未完成。

Phase4/5 DOING，Master Goal ACTIVE。仅本机确定性任务消费，无新依赖/DDL/AgentLoop/公式模型安装；不把OCR正文当原题、标准答案或已审核事实。新队列仅显式采用资料，旧占位不自动消费；旧同步入口保留。单文件整体提交与重启，不承诺页级checkpoint、30–40GB吞吐、PID复用抢占或自然教师/安装验收。Git本地/远端HEAD均488f8109d68027a6eb488e9d04c4eb5073d153cd，dirty保留、未提交/push；日常资料/配置/历史及另一worktree未改。

Next：B2-b真实版面块与唯一公式候选许可/设备POC（方案§34）→B3多块/跨页/源答案教师校正→B4完整必要Pi图/公式上下文→B5联合验收→R2可信检索/Top10→R3受限SymPy→R4同Pi五tools→R5–R7双MVP/Office/三模式/大库；Master其余DT/MA/JOIN/Phase6–8保持OPEN。

Evidence：apps/desktop/test-results/goal/material-background-20261009/（commands、first-failures、source-manifest、visual-review、native-usage与真实readback）；完整收口见该目录closeout.json；最终207在accepted-build5运行，之前build3的207仅为历史证据。下方历史保留，以本节与实际证据为准。


## 2026-10-09 B1 原题资产与教师审核：单题单页切片接受

新增薄OriginalQuestionRepository/Coordinator/API及QuestionAssets，挂同production-host、同Pi native tools、同SQLite连接/题库/批准账本；shared questionFacts共用版本投影。没有新增数据真源、DDL或后台Agent。canonical document与legacy stem/answer/analysis同事务；teacher_resource与generated writer分开。cache只存候选，formal仅不可变大产物，批准与qid/version赋权。

仅接受单题、单页、一个原件区域的原题审核/入库切片。完整B1/R1-B、KB-EXAM-001、可靠解题、100分组卷/错题Top10/数学导出/30–40GB仍OPEN；Phase4/5 DOING，Master Goal ACTIVE。

最终build/typecheck通过；renderer174/174、统一领域192（新增原题边界17）、真实DeepSeek正式Electron13/4次启动/0 renderer错误、独立原PDF与候选/正式PNG逐像素对照2项通过。8张深浅主题、1366×768/1920×1080原题审核与题本截图已实际查看。最终accepted-build4与当前out逐文件一致，采用现evidence.mjs指纹SHA `991bcce76eab745609ccb8fa012ff2d17711749366261656e753514d0fa94a0b`（340文件）；旧smoke207通过于build3 `d16dfa9b639d55c0b517b5b94c754a18b6f8c5e56fc160ed4ed4ccc936989da4`，main与最终不同，不能称全207在最终构建运行。

真实Pi请求证明本轮正文实读→工具→审核流程，不证明数学答案正确；教师交互为隔离Electron自动操作，不是独立人类教师签收。当前答案origin=missing，未新增学生事实。原图只在本机显示，Pi题面reader遇document仍明确拒绝不完整文本读取；完整上下文待B4，不允许漏图解题。

Next：B2真实版面/题块定位、唯一公式候选许可/权重/设备POC、现SQLite上的确定性持久解析任务与任务优先→B3完整题块/跨页/来源答案校正→B4题本/Pi完整必要上下文→B5原图/公式/答案与恢复联合验收→R2可信精确复用/语义Top10→R3受限验证→R4同Pi五tools/讲解→R5–R7双业务闭环/导出/三模式/大库，继续Master其余任务。

Evidence：`apps/desktop/test-results/goal/original-review-20261009/closeout.json`。本地/远端HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`一致；dirty保留。无新依赖/DDL/Worker或AgentLoop，无提交/push；测试使用隔离资料/数据/profile，未改日常凭据、资料、历史或另一worktree。Master SHA未变：`dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302`。

以下保留历史，当前实现状态以本节和最新真实证据为准。


## 2026-10-09 解题路线当前复核（审查交付）

挂载保持typed preload→现main教育facade/唯一Pi→同repository与固定计算worker；未增加新服务/DDL。FastAPI设计为可移除的localhost纯transport，无独立事实库/Agent。

当前Phase4/5 DOING、Master Goal ACTIVE。本次仅完成源码/许可/方案复核；既有R1-A文字、B1题面存储及原页预览保持限定接受，完整原题、可靠求解、语义Top10、100分/数学导出/40GB仍OPEN。下一实施：R1-B/B1正式题图与原题审核writer精确合同→B2–B5真实原题闭环→R2可信检索→R3受限验证→R4同Pi五tools/讲解→R5–R7两业务闭环，再继续Master。

Evidence：apps/desktop/test-results/goal/solver-audit-20261009/current-review/。本次不提交/push、不改凭据/资料/另一worktree。


## 2026-10-09 R1-B/B1 原页保真预览（最新，限定范围）

挂载：MaterialOriginalPreview→typed materials:page-preview/page-cancel→现主帧授权/MaterialRepository→readMaterialOriginal→现固定Worker中的单页PDFium渲染→源/回执验证。三个格式边界已版本化；取消按requestId。独立服务只是确定性领域能力，不新建AgentLoop/FastAPI进程或资产数据库。

仅接受B1原页/区域预览小切片，完整B1/R1-B/KB001与可靠解题仍OPEN，Phase4/5 DOING，Goal ACTIVE。现“我的资料”可在本机查看PDF原页、翻页、放大、停止、重试；源变化/丢失/坏文件诚实提示。保留图、表、公式及选项的原件栅格，不等于自动切题、公式转写或答案正确。无新依赖/DDL/模型调用/另一AgentLoop，无原题/答案/学生事实写入。

最终out与accepted-build3逐文件一致，SHA b3e51f18bbe0ff8604918a3a4dc846020136679dc6e5f4333686827ad3839843 / 340文件。最终build/typecheck通过、renderer174、领域175、正式Electron12/2次启动/0 renderer错误/前后build一致，3项独立原件像素对照通过，8张深浅双尺寸原页截图已查看（仅预览面板；不代替完整Shell/动画/教师D/安装E）。PDF13及旧smoke207在accepted-build2通过，其main/preload与最终完全一致，renderer不同；不混称全207在最终build运行。旧image宿主10通过，同新固定runtime。证据：apps/desktop/test-results/goal/material-preview-20261009/closeout.json；逐命令/首失败/回滚与指纹均保留。

Next：B1正式question-assets/v1同源快照、现ledger原题类别与内部writer精确合同/实现→B2真实版面/唯一公式候选POC/持久确定性后台任务→B3教师校正确认→B4题本/Pi完整必要上下文→B5逐题原图/答案/故障恢复验收。然后R2–R7及KB001纯题库100分/错题Top10/Word-PDF/重启双闭环，继续Master其他任务。

以下保留历史，当前状态以上节为准。


## 2026-10-09 R1-B/B1 题面与版本底座（最新，限定范围）

同Pi、同SQLite：question_bank_items.document_json增量字段和shared question-document v1；source/六类题块/答案出处进入questionFacts与SHA，旧题无字段SHA完全兼容；db与错题根都严格读取。迁移幂等并拒绝字段schema漂移。无新依赖、工具名、Agent runtime或公开写权限；source schema/Pi identity仍v1。后续canonical document与旧文本字段必须由内部writer原子生成兼容投影。只接受R1-B/B1题面存储与版本底座小切片；完整B1、R1-B、KB001、Phase4/5及Master Goal仍OPEN/DOING/ACTIVE。题面合同结构合格不等于原件真实、完整、数学正确或教师已确认。

Next：补齐B1同源题图资产根/哈希/授权与现审核ledger原题类别/内部writer合同，再B2真实版面与唯一公式候选POC/持久任务→B3教师校正确认→B4题本与Pi完整上下文→B5原件逐题/故障/冷恢复。R2–R7及KB001双闭环保持OPEN。

以下保留历史，当前状态以上节为准。


## 2026-10-09 解题路线审查复核（最新）

审查入口：XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md。Pi唯一编排，现education facade/teacher_resources/resource_chunks/question_bank_items/审核/错题/Office复用。现readingSnapshot有20,000 chunks/8MiB内存边界，R2改索引有限召回；questionVersion无题图来源字段，R1-B v2全条件CAS及旧v1兼容必须先冻结。当前R1-A文字接受但非完整原题；新五tools/FastAPI/受限SymPy均设计待实施。无新运行时/DDL/依赖。


## 2026-10-09 R1-A 扫描PDF文字前置验收（当前）

现MaterialRepository仅PDF needs_ocr fallback→固定离线PDFium/RapidOCR→同SQLite CAS事务全页提交；原Pi/IPC/文件宿主复用。真实页码在bodyVersion内，未知页历史兼容；新OCR证据machine_extracted/background。仅接受R1-A文字前置，完整S1/KB001/Phase4/5仍OPEN/DOING，Goal ACTIVE。新版资料页面真实6页扫描卷→本地fixedexe→同SQLite实际页码→停止/重试/坏或加密PDF/源CAS/真实主进程死亡/冷恢复；无模型调用、题目/答案或学生事实写入。下一唯一任务R1-B：完整原题图/公式/来源→教师校正确认→原题库/Pi读取。

以下保留历史；当前状态与下一任务以上节为准。


## 2026-10-09 低成本解题审查与路线修正（当前）

本轮只审计/方案，未实现solver。Pi唯一Orchestrator→教育facade→现资料/题库/审核/错题/Office；Python纯OCR/embedding/固定AST计算。可信原题解析复用→未命中当前Pi候选→验证→教师审核；五tools不等于五Agent。可选FastAPI只是同schema transport，默认stdio。

FTS/向量可重建、后台确定性persisted任务；当前仍主要关键词/8题，PDFdraft未验。[新审查与架构](XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md)，[开发卡](../goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md)。原Master/事实/隐私/CAS/审批保持。

以下旧记录保留历史；本轮状态与下一任务以上节为准。


## 2026-10-08 知识库与智能组卷专题（当前）

用户2026-10-08指定优先完成“本地知识库＋智能组卷＋错题相似练习”，随后继续原Goal。原Master保持2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302；Phase4/5 DOING、Goal ACTIVE。旧“下一唯一任务讲义”仅为历史，本次优先级以本节为准。

专题沿原MaterialRepository→确定性本地解析任务→原题库及审核→Pi customTools→Paper领域→Office文件宿主；允许扩展可重建索引，禁止第二事实库/AgentLoop。精确DDL实施前冻结，当前仅逻辑合同。

[方案与源码审查](../goal/XIAOZHI_KNOWLEDGE_EXAM_TECHNICAL_PLAN.md#19-2026-10-08-本地源码审查与进度)。

以下旧记录保留历史；当前优先级以上述专题为准。


## 2026-10-06 DT-05 同源五题与两周训练（当前）

本轮沿用Pi唯一Orchestrator→原教育Provider→原SQLite/文件writer→typed preload→现有审核卡与传统学生页面。只增加shared草稿构造与原Button使用；schema/IPC/事实真源保持现有契约。Done：当前照片入口发送完整教师可编辑草稿→唯一Pi实读原错题与学习事实→真实DeepSeek提出5道同源简答变式→教师修订确认5子题→Pi重读最终版本→确认五题练习/5引用→依真实错因制定完整14天→逐题录入实际表现与8/10→重新分析与修订14天→冷恢复不重放。读回为1原题+5子题、1五题练习、5引用、3真实记录（照片原事件/教师事实/本次逐题结果）及2计划版本。原照片与根题不变。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。



## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

架构增量：shared/mistake-facts.v1 → main/students/mistake-facts-repository + mistake-facts-api → typed preload → StudentMistakeFacts。原OmniEduStore仅Facade，用原createQuestionBankItem/createRecord同连接事务；复用MistakeOcrRepository的所有权和安全照片读取。学习Provider通过forRecord核验回执/原题/记录/照片/校正后提供必要脱敏作答、错因、难度。没有新依赖、第二Store或Agent。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

架构增量：shared/mistake-ocr → main/students/mistake-ocr-api + repository → typed preload → StudentMistakeOcr/MistakesWorkspace。repository 使用原 OmniEduStore 同连接事务与 Hana 安全读取器，宿主固定本地 OCR、60 秒单次超时与取消；这是操作超时，不是 Agent 运行预算。Pi 仍唯一生产运行时，传统入口的 production handoff 创建绑定学生的原会话草稿。

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

复用：practice-result.v1只是现有student-training.v1的可选关联字段；旧输入/digest/记录保持不变。使用原exercise_sets、question_bank_usage、ai_confirmation_items及learning_records，无新增表/列/迁移/依赖/第二编排。确认练习sourceOn与结果writer共用原BEGIN IMMEDIATE；校验活跃学生、确认ledger digest、实际练习快照SHA、计划科目/知识点及完整逐题索引。答案/反馈/分数绑定原防重digest，重复不写、改动冲突、失败回滚；原concept/design质性门禁不放宽。Pi通过原education_analyse_learning收到脱敏实际答案/反馈/可选分数和整体结果，私有学生/练习ID不出现在回执正文，不自动打分或补造结果。

纵向入口：shared/practice-result.ts→education/practice-result.ts+LearningReviewRepository→原db Facade/typed preload→StudentPracticeResult/StudentTrainingWorkspace；ExerciseSetLibrary以现有DesktopNavigation打开学习计划与结果，record-type-labels显示“练习”。learning-provider只向现有原教育分析回执增加脱敏实际证据，原DeepTutor算法和Pi唯一loop不变。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

practice-review.v1 / education_propose_practice + education_read_practice纵向贯通Repository/Coordinator→production-host/Pi独立持久身份→主frame typedIPC/preload→现有工作台PiPracticeReview与传统PracticeSourceButton。复用ai_confirmation_items(action=pi_practice_candidate)、exercise_sets、question_bank_usage和原saveExerciseSetFromDraft writer，零新增表/列/迁移/依赖/第二编排。候选只接本轮成功实读别名，模型不得指定学生/ID/确认权；题目正文不可偷偷改写，改题先核对题目。确认digest绑定初稿、题目版本/本地父来源、教师最终安排和完整exercise快照；同generation租约、单BEGIN IMMEDIATE、防重/取消/失败回滚。原生身份未知或移除在open前拒绝，压缩只保存状态索引。

新增exercise.reviewSource只是当前readback的来源overlay，不是新的存储事实或授权。source读取验证confirmed digest及原exercise完整快照；当前已选学生决定模型可读范围，异步完成前再校验租约。

Evidence：固定build-c 341文件/SHA 15cba713c2dea8db351973b488c9314909caf31e5ea55d837c525159b0545207，默认out逐文件一致；build/typecheck exit0、统一145/145（education-boundary-wraImL，新增18项）、组件156/156、当前唯一Pi/真实DeepSeek9/9（education-journey-ADH5Jm，3次启动/rendererErrors=0）、旧真实题目核对数据副本3/3（5RLgDA，3题/33→33模型消息，0新增事实）、相关旧业务smoke207/207均当前固定build-c。八张实际Electron浅暗1366×768/1920×1080图逐张查看；核对/拒绝/关闭可达、长内容内部滚动、无横向溢出。完整命令、源码/报告SHA、SQLite读回、失败留存与视觉边界：apps/desktop/test-results/goal/dt05-practice-20261006/closeout.json。领域故障回滚使用真实SQLite测试ports；原writer保存由真实页面证明，不冒称生产OS强杀。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

question-review.v1 / education_propose_questions纵向贯通Repository/Coordinator→production-host/Pi身份→主frame typedIPC/preload→独立PiQuestionReview。复用现有ai_confirmation_items（action=pi_question_candidate）与question_bank_items writer，无新增Schema/表/依赖/第二事实库或编排循环。原始父题完整快照和事实SHA只留本地；确认digest绑定初稿SHA、父来源、教师最终稿及子题ID/版本。同generation租约、单SQLite事务、拒绝/停止/幂等保护确认权。receipt只给脱敏最终发现元数据，答案/解析按既有授权读取。最多8题是单IPC资源保护，不是运行预算。

持久Pi预开身份新增独立question-review.v1；未知/移除能力在SessionManager.open前拒绝且JSONL字节不变；旧未标记会话兼容。Compaction只保留状态/数量索引，不重放正文或授予教师授权。

Evidence：固定341文件/SHA e80b3052e86609b0156b7f91f735b534b9ba47c92d04a9cd83b81abdb0190ab2；原源码verify/build/typecheck exit0、统一127/127、当前组件150/150、当前唯一Pi/真实DeepSeek教师核对10/10（education-journey-R7dHLl），3次启动、rendererErrors=0。浅暗1366×768/1920×1080四图实际逐张查看：确认/拒绝与输入可达，窄窗题目字段在内部滚动区，无横向溢出。相关历史回归207/207是在build-a、最终元数据/摘要绑定/重试修复之前，不能当成最终构建全部回归。精确命令、SHA、版本、失败留存、SQLite读回与视觉范围：apps/desktop/test-results/goal/dt05-review-20261006/closeout.json。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 原测验格式能力复用（当前）

Current Phase：Phase4/5 DOING；Current Task：DT-05第2项DOING，完整Goal ACTIVE。上一轮为真实进展，其题库来源接缝6/99/146/8/207和4图报告本轮只读复核，未冒称重跑。

格式Adapter是分阶段候选流程的内部能力，当前未注册生产Pi工具/未新增写事实或UI；模型主编排仍唯一Pi1.0.2。宿主固定题型，choice/concept/fill_in_blank/short_answer/written/coding；严格字段/类型/重复键与选项碰撞防止误归一，完整答案/解析超长拒绝而不截断，issues保留。valid只表示格式完整，不证明数学正确/教师确认/保存；来源和学生授权由下一同账本Coordinator决定。零新npm/pip依赖、DB表/迁移/第二Store。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 真实题库来源接缝（当前）

question-context.v1复用searchQuestionBank/getQuestionNotebookEntry，两个Pi只读工具education_search_questions/education_read_question。每run主进程发现别名+题目事实SHA；答案/解析按需脱敏完整读取，超长拒绝、异步后重新核版本/租约。SHA不含收藏/分类覆盖层；模型不获原ID/私人字段/假确认。questions:context-source主frame→typed preload→HeroUI来源Modal只在本地展示全文。原生question-context身份在持久SessionManager.open前验证，未知版本/移除能力拒绝且JSONL字节不变；旧未标记兼容。无新Schema/依赖/Store/Loop。

Current Phase：Phase4/5 DOING；Current Task：DT-05 DOING，第1项真实题库来源接缝限定接受；完整Goal ACTIVE。

下一唯一教育任务：DT-05第2项，固定DeepTutor纯测验归一与协议Adapter→唯一Pi可编辑题目/练习候选；第3项同一确认账本教师编辑/确认/原子题库和练习保存及父子谱系（先冻结增量兼容迁移合同）；第4项传统练习/路径/实际结果；第5项完整DT-05与Golden C/F，再MA-01至05→JOIN→Phase6/7/8。完整DeepTutor、OpenMAIC课堂、日常人工、完整Codex/Golden/安装/无VPN仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

student-training.v1主frame三接口经typed preload接同一LearningReviewRepository；计划仍ai_confirmation_items、结果仍learning_records，复用createRecord/FTS/本地目录与BEGIN IMMEDIATE，无新表/依赖/Store/Loop。宿主从确认计划解析知识点/科目/标题，renderer不能指定事实来源；UUID绑定内容防重且手工改后重放冲突。陈旧计划记录需教师主动确认，被新计划替代拒绝写入；质性结果不自动获得教师核对资格。旧无plan与旧路径保留。

真实红灯发现模型把较早证据当新结果：同一只读分析增加最多20条sourceEvidence（发生时间/结果/宿主核对状态，训练观察先脱敏再截断600字），与当前来源别名一致，不传原ID/digest。另发现rest却带知识点时原generic错误使模型向教师问技术参数：仍严格拒绝，工具返回未提交核对与rest=null/count=0等自修说明，不放宽来源或新建重试Loop。

OfficeComposerSeed仅从当前目标会话消费教师草稿，history移除一次性draft，generation/owner锁防换学生后的晚到响应覆盖当前视图。生产仍唯一Pi1.0.2，DeepTutor/OpenMAIC本轮没有新Runtime或Store。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 DT-04 训练接缝

training-plan.v1作为原learning-review strategy v1可选嵌套字段，旧无plan兼容；原工具名称/native marker/同库ledger/digest/版本/取消租约/typed IPC保持。宿主解析本轮知识点别名固定真实目录，提议与确认检查快照及版本，教师不得造来源或删除计划转普通策略；过期计划只读历史。无新依赖、DB表、Store、Loop或第二学生页。latest plan重新实读并声明sourceCurrent/strategyCurrent/teacherConfirmed/completedPractice=false。

下一先贯通既有学生“学习计划”入口读取同一已确认计划及陈旧/空/失败状态，再补教师友好的结构化实际学习结果录入与重新分析/继续训练，不开第二事实库、不把安排当完成；然后DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8。完整Golden F、DeepTutor全模式、OpenMAIC互动课、日常人工、像素/动态、安装/无VPN与既有audit5项仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 当前包切片与取消门禁

项目精确锁定3个Pi包；原web find/usage query编译到既有唯一Pi主进程，SQLite和当前授权保持。余额只读typed IPC使用main当前凭据/版本/abort；goal-x staged不迁入第二GoalCore。每会话确认generation与启动会话检查防ABA，提交前最后租约复核。无新Schema。


## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：实际融合程度逐项对齐官方清单，见CAPABILITY_MATRIX/EDUCATION_BRANCH_TODOLIST最新功能表；既有检索/引文/学生上下文/算法/教师核对与历史已融合，完整测验、学习路径、两周训练、视频及互动课未完成。本轮修复恢复旧会话时先写入后校验的问题：全部学生/学习/核对范围和工具先验证，复用Pi公开解析及内存SessionManager迁移后才持久打开；未知分支/版本、错学生、移除或错工具拒绝且JSONL字节不变，未绑定普通聊天保持空范围。无需新依赖/Schema/Store/循环。

Evidence：固定337文件/SHA 806bfe0dfc046374c13ef86434ca16e55193c09621a2b76582b7e5cea6b30df4，build/typecheck exit0、renderer133/133、统一边界64/64（新增7项原生身份）、本轮真实DeepSeek教师核对/冷恢复/事务退出回滚11/11、历史回归207/207。正式4次隔离Pi启动、rendererErrors=0；4张当前浅暗双尺寸图实际查看，1366暗图确认按钮需卡内滚动，本轮不接受完整Codex动态/像素效果。完整命令/报告/SHA：apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/closeout.json。

Doing/Next：生产宿主并发取消/确认门禁→完整DT-03逐条接受→DT-04两周训练（真实证据→教师修订确认→本地计划→冷恢复）→DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8；Phase3UX欠项保持OPEN，不转回模拟样例或只做底层测试。

Failed：前置测试脚本转义/重复导入已修，最终上述门禁无失败；旧失败报告保留。Blocked：无当前外部阻塞。

Runtime：npm start exit0，默认out与固定构建一致；单个日常main PID60468创建于2026-10-05T21:07:20.5459380+08:00并加载默认out/main/index.js，未读取或注入日常事实；日常DOM/人工、安装/无VPN与完整Golden仍未验。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

以下保留历史，当前状态以上述记录为准。


## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

学习历史新增只读typed DTO→既有coordinator/主frame IPC/preload→PiWorkspaceContext独立PiLearningHistory。SQLite确认ledger是唯一策略/校正版本源；无第二Store。固定当前学生跨会话读取、一致事务、效果digest、稳定版本游标；陈旧注释仍可本地审计，但原算法来源版本失配时不授予当前掌握门禁。

以下保留历史，当前状态以上述记录为准。

## 2026-10-05 学习校正与复习策略（本轮）

新增education learning-review Repository/Coordinator/API；同库独立连接事务Facade仅增加接缝。Pi实读别名→原评分校验的候选→typed主frame教师核对→同一确认行原子保存校正/策略→本轮再次实读→原算法回放。工具回执仅必要编辑前候选，不能代替教师最终版本。取消捕获任务owner lease，旧run结束不能让在途提交重新取得idle授权。

以下保留历史。


## 2026-10-05 DT-03 原学习算法与真实证据（进行中）

同SQLite students/learning_records的一致全记录快照→严格显式证据→固定原Python一次性能力Worker→唯一Pi读工具→现有来源typed回查。reading/learning共享受限宿主；环境无凭据、取消/超时/并发/字节上限，不是任务运行预算。独立student-learning native身份在已校验学生范围后追加，拒绝换学生不得污染旧历史；教师写入链仍待交付。

以下保留原历史。


## 2026-10-05 用户确认新版学生页：识别与实例复核

页面基准与证据固定在docs/design/CURRENT.md；正式页面沿用ProductRail / ProductSpaceShell / StudentProfileLifecycle和既有App证据时间线，主进程typed事实链路不变，本轮无schema/依赖/IPC或第二Loop/Store。

以下既有记录保留原历史范围。

## 2026-10-05 DT-02 学生上下文与新版页面（最新）

新增薄学生域Repository/Service/Sanitizer与EducationCapabilityProvider；同一SQLite一致快照→最小脱敏→范围/取消/变更复核→唯一Pi Tool。students/learning_records与会话student_id为真源，未迁移表。strict typed mainFrame IPC与独立native能力身份防跨学生历史；公开引用只由实读成功的宿主工具创建。没有第二Agent/Store，新依赖或学生事实自动写入。DT-03之后按主合同推进。

以下既有记录保留历史范围，当前状态以上述记录为准。


## 2026-10-05 DT-02入口修复与新版页面统一

新版所有传统域页面继续由ProductSpaceShell宿主，问小智由PiEducationWorkspace，五空间保持单一产品入口。旧test-runtime仅历史隔离回归，与正式页面证据分开。学生保存通过原typed IPC/SQLite，App返回ID→Lifecycle作用域回执，无表/权限更改。日常current out单实例自动切换已核；学生上下文Provider下一项未接。


## 2026-10-05 DT-01b 正文搜索与来源定位

链路：MaterialRepository一致正文快照→education/search-provider本地脱敏→原worker search_units→Pi唯一工具→持久公开来源→materials:source主窗口主frame typed IPC→既有资料详情。原件/派生正文双版本校验；独立native搜索marker。无第二runtime/store、新依赖或Schema。docs/goal/PHASE4_DT_01B_ACCEPTANCE.md限定接受；DT-02下一项。

历史条目保留原范围；当前进度以上述记录和 Master 为准。

## 2026-10-05 能力支线恢复与 DT-01a 引文核验

M02/M04/M10新增education域Provider，生产host只注入工具，PiSession只认独立能力marker。阅读匹配与下一步学习策略均在Pi下方；没有新增Agent runtime。

Goal ACTIVE。按本轮用户纠偏，当前工作转为 Phase4/5 能力支线；Phase3欠项保留OPEN，不因切换优先级记完成。详细顺序：docs/goal/EDUCATION_BRANCH_TODOLIST.md；当前限定验收：docs/goal/PHASE4_DT_01A_ACCEPTANCE.md。

Done（限定A/C）：固定新版DeepTutor源码的只读引文核验已接 Pi / EducationCapabilityProvider，真实DeepSeek正反核验、持久结果与冷恢复通过；11边界、12相关工具回归、133组件、正式Electron4场景及5张静态图审。原Python源码/Apache许可证逐字复用，无第二Loop/Store、新依赖或Schema。学生个性化/Golden F、OpenMAIC SDK/Golden E仍OPEN。

Next唯一：DT-01b，复用同一原版search_units补全资料正文搜索与来源定位；再DT-02学生真实事实→DT-03掌握度/复习→DT-04两周训练→DT-05题目/学习路径；随后MA-01 DSL本地合同→generation→renderer→编辑/导入→真实互动课堂。不能回到旧模拟样例兼容循环。

Failed/Open：原legacy全套smoke最新exit1（题本SQLite回执早于React显示）；两处断言已改为等待真实DOM，未全套重跑，不能声称207通过。Phase3完整39项、备课本全图审/整体验收、完整Goal/无VPN/安装/许可安全/人工仍OPEN。正式首4次图审失败与第五成功均保留；最后一次最终构建验收报告见closeout，不能宣称连续稳定。

日常版本统一：npm start/根启动小智.cmd先成功构建后开当前out，旧dist可恢复归档，release不跟随旧dev URL，单实例聚焦/版本变化重启；owned验收窗口隐藏。此前日常入口5/5有限验收、两图审及备课本独立8场景通过，不代表完整Phase3。默认out本轮有意更新；未清空日常事实、改密钥/供应商/DNS/proxy/VPN或提交/push。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55，工作树保留既有改动。

## 2026-10-05 P3-04：资料收录、全量目录与真实正文工具接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-04仅资料收录、全量目录与正文工具实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。以下为当前生效状态，后文各轮记录保留历史范围。新接口只取真实本地事实，旧模拟业务兼容与测试样例书专项不再投入，不自动补回演示种子。

实现：复用Hana0.449.0 Apache-2.0 extractDocument、既有AnyDoc0.1.2 MIT/native Windows与document-worker。新增materials v1共享契约、主窗口主frame限定typed IPC、SQLite资料Repository、原chunk/graph算法的独立连接短事务；正文与ready状态原子提交，hash/size/托管目录校验，取消终止实际worker，失败保存原件，重启可重试，同hash ready重试不重复块。全库名称/格式目录50项分页，单份正文10块分页，替代资料页旧最近100份/全局24块限制；外链/图片不自动加载，加载回执到达前旧行与分页不可交互。

Pi工具：office_list_materials与office_read_material从同一SQLite事实按ID/offset只读已提交正文，严格拒绝路径/额外参数/学生库/任意SQL，按当前run及AbortSignal校验，复用Office教育脱敏和Hana execution-once。正文工具一次一块、最多12000字符，返回真实版本、段落来源、nextOffset；teacherConfirmed=false、originalPageLocated=false，不冒称教师确认或原页码。xiaozhi.education.material-read.v1独立marker位于既有snapshot/fingerprint之后，原native JSONL与创建身份不重写，未知/缺失能力拒绝。真实DeepSeek持久最终回答与成功“读取资料库正文”回执均已核验，不用检索摘录冒充全文。

主宿主拥有当前收录job/AbortController，renderer只调用typed IPC及ID；webContents退出中止job。单独短事务连接复用原chunk/graph与状态原子提交，不把并发聊天写入混入。Pi只注入host创建的固定工具；分段正文按需进入同一已有会话，无另建Runtime。

边界：PDF只接受已验证文本层路径，扫描OCR未完成；旧doc/xls/ppt不支持。目录查找按全库名称/格式，不是资料全文搜索；Unicode归一仅查询侧，SQLite lower不承诺全Unicode等价。原生选择单批50文件、既有15秒/50MiB输入/1MiB解析输出均为工具边界，不是运行预算。资料收录不等于教师确认；失败保留旧已提交派生正文且不伪称ready。教学Office产物目录仍最近100份，完整分页待后续合同。日常安装、无VPN、WPS版式、人工、全Codex体感、安全/许可、完整教育Golden均OPEN；未以隔离验收替换日常out。

Evidence：固定build9，323文件/SHA 52d6321cd1b974c26ae4ce8c06459bb157744a1660851d54475893780e193f9e；正常build/typecheck exit0，renderer129/129、资料/Office工具边界12/12、真实DeepSeek正式Electron工作台31/31、原教育隔离legacy-test回归207/207，均独立exit0。31项report.success=true/rendererErrors=[]，四次实际独立profile启动、当前构建/脚本指纹与main已加载模块核验；207本轮确实在最终build9重跑，不能作为新教育黄金闭环。37最终PNG归档，其中21张逐张视觉审阅，覆盖本轮资料空/正文/失败/冷恢复及正文工具浅暗1366×768/1920×1080；其他16张只归档。本轮控件可达/可读，不宣称全部Codex像素一致或全页WCAG。归档：apps/desktop/test-results/goal/phase3-ingestion-20261005/closeout.json，SHA 36d6820c3685aef39c4c6b6f85a38efbb1ab11ef7f1d513b29b09d1ae7238585；精确命令与失败见PHASE3_PRODUCT_SPACES_CONTRACT。

Next：P3-05，整理传统备课、讲义、题本与学生页面的教师操作体验，盘点实际 typed 入口、业务事实和失败状态，先冻结增量合同，再逐切片实现与验收；随后完整Phase3验收，再Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。Pi保持唯一生产编排。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55。本轮开始HEAD为20aa86656cdb5a0f85e0e11fa21863b50233fcb1，执行中观察到外部提交推进，保留其内容；本Agent未提交或push。Master2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302保持。daily out323文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981本轮未变；P3-03曾意外重建并精确恢复的历史保留。没有新Schema/依赖/vendor/密钥/供应商/系统DNS、proxy、VPN变更，没有清空日常数据。


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

## 2026-10-16 BoardUI 复用复核

当前架构中的 BoardUI 代码只承担只读联网过程展示；`OfficeToolProcess` 负责条件分支，`OfficeWebSearchProcess` 负责状态/来源映射，typed IPC 负责来源打开。其专项 8/8 与通用 217/217 均不替代真实 provider 或用户路径验收。
