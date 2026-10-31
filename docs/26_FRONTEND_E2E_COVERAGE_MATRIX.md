# 前端接线与 Electron E2E 覆盖矩阵

## 2026-11-01 答案条目局部疑点与真实回写

M03/M05/M10：真实主书第4页与答案第3页已实现五题book_enriched规范回写；局部疑点按条目显示、模型漏报跨页由解析器继续拦截整页检索。双尺寸、错误/恢复、重试、同源关联恢复、冷启及Pi共用来源读取的最终结果见 docs/research/KB_ANSWER_ENTRY_SCOPE_20261101.json；旧状态断言与误选历史批次失败单独保留，不充当通过。完整Goal仍active：PDF图题原页证据归档、跨页补全、填空结构化冲突消解、自然几十GB长期稳定与召回/P95、真实教师/安装包验收尚未完成。D盘日常与安装包未更新。

2026-11-01 E07停止切片（0222d15）：当前正式composer实际点停止，覆盖停流下载/不结算cancel、真实QuickJS无限循环child及原文件审批等待；本地事件→可见反馈5.9/4.1/7.3ms，宿主下载3ms中止、child12ms关闭，1.1秒无新派发。临时物清理/组件保留、旧批准拒绝/文件未写、新会话实际42、双尺寸及四会话冷启共6项，0真实付费/renderer错误。专项15与原复制取消3通过；整条AT仍阶段集中。证据：docs/research/AGENT_RECOVERY_E07_20261031.json#stopStagesSlice。 同一冻结源码0222d15的一次legacy综合回归207/207 exit0；正式Pi6另记，完整AT不据此标过。

2026-11-01 E07普通工具前片（3a420f5）：正式Pi6覆盖缺文件→列目录→更名实际读取、短暂/持续占用、读重试等待停止及双尺寸/冷启；已停止历史不再承诺重试，原queued事件保留。源码7/边界20/SQLite10/呈现9，240组件；一次207归终态提示修复前构建，修后相关检查通过。证据：docs/research/AGENT_RECOVERY_E07_20261031.json#ordinaryToolSlice。


2026-11-01 E07：实际Pi7覆盖HTML保存后SQLite失败→仍失败阻断→恢复原task→不覆盖草稿→显式同task接续→双尺寸→冷启；文件/事件hash不重写，0真实模型/renderer错误。源码9/账本文件5/取消5/回执15；完整AT未集中。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#recordRecoverySlice。

本轮最终再次整合协作者main6bd287a为1d6358b：第一次正常原子推送遇并发主线更新被拒，未强推；13处Markdown冲突完整保留双方，知识库生产源码未变。最终build/type、240组件、协作者接续源码11与真实知识库UI7（双尺寸/错误/关联恢复/冷启/6道来源读回）exit0，0云端重放/renderer错误；37/28/19/9与207各归先前精确构建，不冒充最新全套重跑。最新主包3324949B、renderer7258909B，均含E07/E08；完整指纹/边界见KB_PAGE_PROMPT_20261031.json#lastIntegration。完整Goal active，D盘日常/安装包未更新。


## 2026-10-31 原页完整题面与真实OCR状态

已修复成功OCR被误称失败、选项仅在projection而规范stem缺失、陈述句题号被旧问句线索漏切三个真实缺口。新单元在既有input_json绑定page-restoration.v2与真实状态，来源复验；旧first_saved仍用旧提示。复用原parser的临时编号adapter，不改原OCR/原响应；覆盖字段须实际包含于完整stem与原页题面。无新表、依赖、IPC或额外执行器，数学/图题/跨页/来源门禁保留。

本轮6次真实HTTP200（同已检查主书第4页两轮各2次、答案第3页2次）：最新主书12题全部保留，6道纯文字题达到现有ai_final资格（1/2/3/7/9/11），另6道图/表题仍待核。答案册22条两遍一致仍有整页uncertain_ocr及页尾跨页；真实12条匹配到最新答案页、0规范回写。不能把AI一致或ai_final称数学正确/教师验收。整合96286b0后真实UI7项（双尺寸、错误、原关联恢复、冷启、6道typed Pi共用来源读回）通过，0云端重放/renderer错误，题目及原件hash不变。一次测试故障注入因SQLite争用失败，原回执未变；增加有界等待/CAS/关闭后恢复后正式通过。

整合build/type、240组件、原页37/批次28/匹配19/原生DeepSeek9通过，207/207综合exit0；207在最后原始字符串类型保护前构建，最终严格保护已有37项通过，不冒充207重跑。最终renderer与240组件构建逐字节相同。 64a8b2f最终构建再次真实UI7项通过，0付费重放/renderer错误，严格类型保护与原回执读取兼容。audit45（8高29中8低，0严重；exit1），未自动升级。主包3309674→3319358B、renderer7246099→7251525B，含协作者E08整合，不据单页宣称性能或召回提升。完整Goal active，图表/跨页、真实已知答案安全回写、自然几十GB质量/性能仍待推进；D盘日常/安装包未更新。回退先暂停新批次并用OMNI_EDU_AI_PAGE_RESTORATION=0停新页生产，保留v2读适配和原件/回执，不混用未知旧provider；无DDL回退，完整回滚未演练。证据：docs/research/KB_PAGE_PROMPT_20261031.json。

2026-10-31 E07：正式Pi首响应503/500、401/402/长429及等待停止的初次6项通过；断流隐藏缺陷保留并修复。最终接续4项验证双尺寸、原task/version、新run及冷启；最终停止/冷启2项41.95ms，0模型/renderer错误。源码11、任务SQLite11及原生附件21；完整E07与252AT仍未执行。证据：docs/research/AGENT_RECOVERY_E07_20261031.json；日常进度 docs/goal/WORK_PROGRESS.md。


2026-10-31 E08当前版本：E08当前版本接缝工程已实现：正式Pi原对话默认当前→教学文件按族/历史→实际当前检查→教师恢复第四版→旧检查可见过期→双视口/冷启8项，0renderer；源码16/240/一次207通过。完整AT仍未执行，原生打开成功不计入。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#currentVersionSlice；日常进度WORK_PROGRESS.md。

## 2026-10-31 封面跳过补强与明确计数

文件夹 PDF 封面现在校验完整成功回执及 text/nativeText/ocrText 全部通道，保护中文、全角与圈号题号；原 writer 内复查来源/游标/暂停及既有付费任务，跳过数沿原 typed IPC 显示。无新表/依赖/付费/上传，原件和教师数据保留。真实五三第1页派生PDF已通过原页像素一致验证，实际导入→本地OCR→文件夹授权→跳过→双尺寸→冷启3项通过，0调用/子任务/新题，原12题未变。

冻结eab6d1b的最终build/type、专项12/7/规则24、正式真实封面UI3项（双尺寸/冷启、0云端）通过；240组件的renderer与最终完全相同。207/207综合为最后付费任务/账本及缩进题号保护之前构建，不冒充最终全套重跑。主包3307397→3309674B（+2277），renderer7245763→7246099B（+336）；实际一次封面收录/OCR/跳过13.89秒，仅单样本不称P95改善。audit仍45（8高29中8低，0严重；exit1），未自动升级。精确范围/Git见 docs/research/KB_COVER_SKIP_20261031.json。完整Goal保持active，真实题面疑点和自然几十GB验收仍待解决，D盘日常/安装包未更新。暂停后逆序revert eab6d1b/96555d2即可回退本片，保留原件及既有跳过单元，无DDL回退；完整回滚未演练。

## 2026-10-31 封面跳过与已知答案匹配回写（第三切片）

复用原资料AI执行器、SQLite writer、两遍原图回执和 typed preload，接通独立答案册的本地匹配及受控回写。按当前关联文件版本＋完整试卷标题＋唯一题号＋题干原页定位；仅补齐缺失或升级未确认AI字段，教师/原资料字段保护。新增v6 book_extracted来源，保留原AI与journal前后快照；答案册缺解析时只升级答案，原AI解析继续独立标注。题目/答案先后到达、重新关联沿原drain的持久队列衔接，无第二个执行器或额外付费。目录采用受限增量与B-tree，写入前复查索引和原件，失效/冲突/跨卷重号保留候选。

用户明确非题目封面舍弃：本地成功识别且具明确封面信息、无习题线索时，规则不抽题，文件夹AI直接本地完成且不创建付费子任务；中文题号、混合题页和模糊/失败OCR保留。原始PDF不删除。实际已存主书第1页判cover/0新规则候选，第62页仍保留真实习题；旧4条前置页候选未自动删除。

本轮主书第4页真实DeepSeek两次HTTP200保存12题，仍有uncertain_ocr及两遍题面差异。已实际自动匹配12条到答案册第3页，题1定位基础卷D，不会取提优卷B；12条均待核，0真实规范答案回写。控制来源的SQLite正向回写/编辑/CAS/回滚已通过，不冒充真实教材正确性。证据入口docs/research/KB_BOOK_MATCH_20261031.json；最终整合b9686ac：build/type、240/240组件、匹配19、AI原页31、网页补答兼容12、条目15、关联7、关键归档13、封面/规则19、文件夹PDF9和调度7通过；冻结正式UI6项/双尺寸/冷启/0renderer错误及0付费重放，关联修订17→19，12条均held且规范题目未变。207/207综合在0b3afc3构建通过，仅作为整合E08及后续小修前的兼容回归，未冒充最终重跑。audit45（8高29中8低/0严重，exit1），无新依赖。最终主包SHA f1909fdbd26933c13e0b88ce003dd70dd69aebadc8b988dda954fa91b5cae4dc；renderer7245763B，含协作者E07/E08。

完整Goal仍active、252AT新增已实现0。当前主要缺口是对真实疑点进行逐题原图核验/跨页补全后安全入库，以及自然几十GB长期质量、召回率和端到端性能；D盘日常/安装包未更新。OMNI_EDU_BOOK_ANSWER_WRITEBACK=0可停新回写、保留历史读；回退须保留v6读适配，或对未被教师修改的journal快照CAS恢复，不能直接旧版读v6。完整回滚未演练。

## 2026-10-31 协作者 E08 版本恢复记录

2026-10-31 E08：E08覆盖更新：原Pi整包审批→PPT第4页备注新版→旧版恢复新当前、幂等/外改/移走/实际定位6项已取证；同一三份原文件最终Teaching Files预览/真实grid与控件几何/1366与1920/冷启/0请求/文件hash-mtime不变续测6项通过。不是完整E08或252AT通过。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json；日常进度以docs/goal/WORK_PROGRESS.md为准。

2026-10-31 E06混合终态工程已实现：逐文件保存/失败/未检查、只续做PPT、carried HTML不重写、最终精简回复与冷启已取证。完整AT仍未执行，标准不变；最终build/type240+原Pi同文件3通过，初版原Pi9/综合207单列。证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#terminalSlice；日常进度WORK_PROGRESS.md。

## 2026-10-31 已知答案逐条证据（第二切片）

已用答案.pdf第3页真实DeepSeek两次HTTP200，保存两遍原图/转录；该页22条、两套试卷、同号1分别D/B。现资料详情→AI深度整理→查看原页与AI还原正文，可按完整试卷标题和题号查看答案/解析/两遍原文及待核原因。两遍22条一致仍保留整页uncertain_ocr，页尾续题不补写；本片未实现题册逐题匹配/答案回写，不以预览冒充全链落地。

误解除后可恢复完全相同两份原件/版本且所有历史单元已保存为complete/review/no_questions的关联；空、在途、失败、未知或其他角色/来源批次仍拒绝。仅历史只读回执允许跨revision；发送、迟到发表和续跑仍严格revision，不继承云端授权。真实UI修订5→7、两尺寸/重启4项通过且0新增云端调用、原账本仍2次；最终新工作台复验修订9→11、同22条/两个试卷及失效错误界面/双尺寸/重启4项通过，0新增云端/renderer错误。

源码a4bda04，先整合协作者main6d45424为c3fa341，再整合新工作台0723242为c2e8e5c；生产无冲突，四份协作记录顶部冲突保留双方内容。build/type、240组件、条目15（含实际已存响应1）、关联7、AI原页31、关键归档13、协作者要求契约6通过；207/207综合在a4bda04冻结构建通过一次（Pi=0历史回归）；最终c2e8e5c含新工作台的build/type、240/240组件及正式知识库UI4项通过，0云端重放/renderer错误，不把整合前207算最终重跑。详docs/research/KB_BOOK_ANSWER_ENTRIES_20261031.json。无新依赖/表/模型/服务；audit45（8高29中8低，0严重，exit1），D盘日常与安装包未更新。

完整Goal保持active、集中252AT新增已实现0。下一步按章节/试卷/题号＋题面上下文对齐已知答案，增加真实来源回写与教师编辑CAS；仍缺跨页合并、逐项纠错及自然几十GB质量/性能验收。旧4条前置页候选和偶发导航问题保留，不能宣称已清理/修复。回退前暂停任务再revert本片，原PDF/AI回执/题库及协作者工作保留，无DDL迁移；完整回滚未演练。

## 2026-10-31 五三题册与独立答案册第一切片

实际93页已终结：91complete、2needs_review、0failed/0pending；待核为主书61和答案30，目视均为广告，主书62仍是真题。关联/解除/答案角色/两尺寸/重启正式Electron4项通过，0renderer/云端。原导入测试误带2张生成封面PNG，不能将其4文件结果称为2本原始文件；15分钟harness超时及首次调整尺寸后资料页消失失败保留，最终重跑通过但导航根因未确认。

关联源码242890b，正常整合协作者origin/main 02fc8e0为d34a006，无冲突；随后752b063收紧页首广告标记，2743687按整页多chunk排除明确宣传/目录并阻止AI发表非题页假题。最终build/type、240组件（renderer之后未改）、关联5/规则11+真实OCR页只读3/AI原页30/归档13、正式关联UI4项及协作者源码12项通过。207/207综合归整合前242890b，未冒充最终源码全套重跑。audit45（8高29中8低、0严重；exit1）未自动升级。详docs/research/KB_BOOK_PAIRS_20261031.json。

**逐题答案匹配和回写尚未实现**：答案第3页含多个试卷，题号各自重启，必须按章节/试卷/题号及原页证据对齐；不得仅按题号覆盖。原AI/联网补答链未改，答案书云端自然准确率未验收，本轮真实provider调用0。没有泛化的持久非习题页分类器。完整Goal保持active、集中252AT新增0，D盘日常与安装包未更新。

WPS整合收尾：正常合并main e06cc05为bc9777e，15处Markdown冲突保留双方完整阶段文字，无生产冲突；WPS检查源码与610f3eb一致。合并后build/type及240组件通过，207综合与WPS实际路径归整合前610f3eb，未重复全量。renderer7179937B/SHA未变；主线检索改进保留。完整Goal仍active、AT新增已实现0；本轮WPS未更新D盘日常/安装包。最终指纹与边界见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice.finalIntegration。

## 2026-10-31 E06 WPS真实页面（第六切片）

原Pi指定WPS检查两文件、原文件面板WPS选择/实际第二页1366与1920/冷启读回、DOCX在途停止通过；PPT三页提前完成首套exit1保留，64页在途停止补测通过，0renderer错误。E06仍部分实现，完整AT新增已实现0/252，Goal保持active。逐字缺字/语义遮挡、完整FX09、全教师要求绑定/混合终态仍待补；WPS图片导出不代表原生编辑保存或动态放映验收。日常D盘和安装包未更新；audit45（8高29中8低/0严重，exit1），既有两个UI门禁未修。 见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice。

## 2026-10-31 百条候选与共享重排预算

证据docs/research/KB_RERANK_CANDIDATES_20261031.json：RED20≠40；候选8、宿主3、既有边界8、生命周期15、冻结模型5、真实原生超时恢复2通过。3e7d1c2的207/207综合smoke通过；正常整合f818237为4fadfb0，无冲突，5个检索生产文件未变。整合后build/type、240组件、候选8、交付源码11/真实PDF4、新侧栏13及正式40GiB复开3通过，首次可见/冷启均明确完整重排40/40、0renderer/云端。

合成40GiB仅40页/6040B正文；最终首查4248/4824ms未改善，不是自然教材Recall/P95。5秒只限重排阶段；复杂/大候选池超时会明确退回原召回排序，质量权衡仍需验收。《初中物理·五年中考三年模拟》未找到本地文件，路径待提供、尚未导入。完整Goal保持active、完整252AT新增0，audit45（8高29中8低/0严重、exit1），D盘日常与安装包未更新；上游记录的PromptInput/启动IPC门禁亦未在本轮重跑。下一步拆解冷启动/索引等待，再做真实教材及Pi大页/大文件闭环。回退3e7d1c2保留协作者导航和业务事实，无需清库。

本轮收尾：最终整合feef9d4保留main f4dce3f的资料库与侧栏改动，Word检查生产源码与44eb69a一致；整合后build/type、240/240组件通过。207综合归整合前a94ab29，Word停止/占用专项归44eb69a，未重复运行。既有PromptInput指纹/启动IPC两项失败门禁与audit45保留，完整AT新增0，日常D盘与安装包未更新；详细指纹、范围见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice.finalIntegration。

## 2026-10-31 E06 Word真实页面与停止清理（第五切片）

此前Word导出阻塞已定位并修复：输出路径显式[string]，Close/Quit使用[ref] SaveChanges；Word16实际三页A4含长标题/表格/OfficeMath现可沿原Pi检查→原文件面板两视口→冷启取回真实PNG。仅去掉字符串转换的同文件对照20秒无PDF。取消还发现Word锁晚于助手退出释放，新增最多2秒异步重试自有临时文件；最终停止/占用专项通过，原文件不变且不接管已有实例。

WPS、逐字缺字/语义遮挡、完整FX09与全教师要求绑定/混合终态仍未齐；E06及完整Goal保持active，完整252AT新增已实现0。随后E07/E08+C及W3集中验收。D盘日常与安装包未更新。回退上述调用/清理提交保留原文件、报告及PNG读器，无业务迁移，完整回退未演练。 精确命令/源码/失败和指纹见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice；日常进度仍以docs/goal/WORK_PROGRESS.md为准。

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

正文召回切片：3c536ff分离AiPageView转录与题目状态，7743efe补数字/字母空白边界；正常合并主线7dc04a8为25888a1，保留Office实际页面检查。旧真实页派生正文0→1（2031B），3题定稿/1图题待核及全部原OCR/两遍/题库事实不变；最终同页读取与重启通过，0新增付费/上传。最终build/type、240组件、27页检查+6一致性（Node7/7、0skip）、实际混合页6项及真实保存页4项均通过。207/207综合和17检索/13归档/7目录/11协作源码属于25888a1，后续空白修复按最终专项/界面验证，不冒充重复全量。精确命令/源码/指纹/失败见docs/research/KB_TRANSCRIPTION_RECALL_20261031.json。 实际混合页包含本地OCR后故障空白及受控模型；真实保存页复用先前自然响应、非本轮新付费准确率。1366×768来源状态/实际输入图与1920×1080冷启均覆盖，0renderer；不等于教师盲审、40GB或完整Pi验收。

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

源码11项、240组件、正式界面9条原路径与独立停止1项已通过；新原Pi修复/原一次确认/预算/教师改稿4项及同库只读PPT精确SHA回读1项通过。早期测试的错误计划缺human步骤、错误SQL列名、停止状态错误断言及坏ZIP检查失败均保留，未以它们宣称全通过。最终构建/改名预算补跑/整合验证以证据JSON后续记录为准。audit本次45项（8高/29中/8低/0严重），依赖文件未变化，未自动升级。

E06仍部分实现：Office实际页面/字体/遮挡渲染、持久视觉证据、自动绑定全部教师语义要求及完整混合终态仍待补齐；未渲染保持未检查。下一继续E06再E07/E08+C与W3集中AT，新增“已实现”0/252。D盘日常版本/安装包未更新，0真实付费请求。 详docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json。

## 2026-10-31 后台预热的实际查询回归

10e6f10最终同一构建运行未改的kb-restored-text-journey.mjs，3PaftH六项exit0：正式目录→真实OCR空白边界→两遍受控AI→文件化图片/SQLite0B→全文与实际本地ONNX/Lance语义→Pi实读引用原图→两视口冷启0重发，0renderer/0假题/0原OCR块。首次查询170ms/其中重排116ms；前轮相同小样本4815/4704ms，非严格A/B/大库P95。240组件通过；综合终态见goal/KB_IMPLEMENTATION_EVIDENCE.md。后台预热不新增UI，既有错误/降级保持；自然质量与规模不据此完成。

## 2026-10-31 文件化原页的真实入口回归

29b4d07同一最终生产构建：kb-restored-text-journey.mjs六项（9uqSXR）沿现目录授权→本地OCR空白故障→两遍原图→SQLite元数据/实际文件SHA→FTS/本地ONNX/Lance→Pi真实search/read/来源→1366/1920冷启；kb-folder-pdf-publication-journey.mjs --restore-ocr七项（MjMyry）沿实际双页>50MiB PDF发布等待→空白/乱码故障→两遍AI/2题→题本原文/原图→实际语义召回→冷启。两轮0renderer、0重发，云端受控/0付费；新增存储沿现typed入口，不加无用控件。最终240组件通过，综合精确终态见goal/KB_IMPLEMENTATION_EVIDENCE.md。不是自然复杂题/40GB/安装验收。

## 2026-10-31 活动工具IO的实机回归

5b4343b生产构建T2NRe7沿原kb-restored-text-journey附只记录方法/耗时的私有CPU探针，正式目录→本地OCR空白边界→两遍受控整页→实际FTS/ONNX/Lance→Pi实际search/read/引用原图→两尺寸冷启五项exit0、0renderer错误、0重发/0假题/0原OCR块。工具664/464ms；首次查询4335ms/重排4308ms、启动1951ms间隙仍保留。受控模型不能替代自然质量、Recall/P95、40GB或安装验收，精确综合结果见goal/KB_IMPLEMENTATION_EVIDENCE。

最终fc2fd0d生产源码/9b128e4夹具：目录→AI整页→检索→Pi实读与引用→冷启5项exit0/0renderer错误，GASk1N原OCR183B后受控清空。修正换行/绘制边界并实看截图，旧裁切夹具不计自然质量。整合后240组件与207综合exit0；冷读/来源哈希与到期查询计划补查通过，详见KB_IMPLEMENTATION_EVIDENCE及公开JSON。

## 2026-10-30 AI整页正文进入现检索与小智（M04/M10）

新增kb-restored-text-journey.mjs五项实际纵向路径：可见目录授权→真实本地OCR输出边界空白注入→双阶段受控AI普通页（0题/0原OCR块）→资料全文搜索/真实原图→固定本地ONNX/Lance同义检索→生产Pi实际search/read/引用打开→冷启不重发，1366与1920/0renderer错误。首轮来源卡折叠点击超时保留，正确展开后五项通过。不是自然AI准确性、40GB、质量Recall/P95或安装包验收；整合源码最终补跑记录以KB_IMPLEMENTATION_EVIDENCE为准。

## 2026-10-30 PDF空OCR原页还原与题本入口

最终d021da6数学上下标严格比较重建后，已存v5在1366/1920原生两次启动再读取通过2项：2题、正文、原图和0模型请求/0renderer错误。全模块综合在讲义描述保存断言仍失败；本节仅记录该知识库路径，不标完整207通过。

`node scripts/education/kb-folder-pdf-publication-journey.mjs --restore-ocr`六项通过：正式目录授权→真实Worker OCR→输出边界注入blank/乱码→发布等待无误发→4受控请求/2题→题本点击还原正文/OCR对照/真实原图→1920×1080冷启0重发，1366×768同入口可达、0renderer错误。初次实机RED证明组件未被题本挂载，eae90d6已补接；失败和最终报告均保留。生产提示另有已授权第1页的两次真实DeepSeek响应，未冒充本受控旅程的真实模型。精确范围与40GB/自然质量未验边界见goal/KB_IMPLEMENTATION_EVIDENCE.md及research/KB_PAGE_RESTORATION_20261030.json。

## 2026-10-29 E01精确PPT备注受控路径

`node scripts/xiaozhi-agent/default-file-delivery-electron.mjs --presentation` 5项通过：正式输入→无私人目录→HTML审阅→8页PPT审阅→修改第4页标题/备注→精确版本确认→实际文件/读取工具/面板读回→重启绑定保留。模型为合成SSE、教师点击由测试驱动，非自然质量/完整FX01/真实教师验收。PowerPoint原生另检8页渲染与文字/表格/备注编辑另存重开；精确报告见docs/research/AGENT_PRESENTATION_E01_20261029.json。


## 2026-10-29 后台目录恢复与还原提示复验

当前构建kb-folder-search-journey真实资料页→选择含子目录文件夹→暂停→原生重启仍暂停→继续后退出再开自动接续→151文件/1跳过→长文尾部检索并打开真实正文，5项/0renderer错误（Temp/omni-edu-folder-search-HqON0k）。同已授权PDF第1页新版OCR还原提示从现AI面板两遍实发，修复遗漏解题任务后3条ai_final/1图题review。不能当自然质量/全目录自动AI/40GB通过。

## 2026-10-29 真实OCR纠错题与自然题库读取

隔离真实资料：图文第3题在原生重启后题本可见，语义5候选含该题；单题蓝图/测试教师确认/学生教师四份DOCX/PDF及1920×1080冷启哈希谱系通过，导出前1366×768、0renderer错误。真实自然语言新聊天实际执行search/read当前题并保存带来源回复，3个DeepSeek请求、0目录、原生重启逐字一致；scope仅一题，不是自然召回率或教师答案验收。私有报告路径见goal/KB_IMPLEMENTATION_EVIDENCE。

## 2026-10-29 回答功能补齐

同一专项新增工作文件引用原版本打开/变化拒绝、已提交附件第2行引用定位，并修复当前输入框有附件就禁发的缺口。最终原生6/6、0页面错误（answer-quality-electron-nBq3rF），缓存命中0/1/1/1；构建、240组件、11边界、22权限及207旧smoke通过。精确日志/指纹及首次失败保留在goal/HANA_ANSWER_QUALITY.md。所有本轮模型传输受控，无新增真实API请求。

## 2026-10-28 Hana回答优化增量

answer-quality-electron.mjs --paths-only：真实生产Pi入口、合成资料UI导入→实际工具读取→正文引用展开来源并打开原资料、伪造引用标记、503恢复、等待重试时停止、冷重启恢复且0重放，4/4、0 renderer错误；双尺寸截图1366×768/1920×1080。证据test-results/answer-quality-electron-2qjN35，构建指纹与局限详goal/HANA_ANSWER_QUALITY.md。传输使用受控SSE；真实API答案质量独立验收。

## 2026-10-28 主线统一增量

fdc模板UI整合后：独立三栏8(Tq5O97)/菜单8(Wr5pxH)、真实React恢复/权限36(LnypGl)、真实Pi恢复6(3x9tsm)/gap6(QQQEZE)通过。菜单旧.codex夹具超时、根cwd导致classroom-preview入口错误均保留；合成runtime移OS temp后复验，不放宽生产权限。最终D:启动与真实Stop/审批文件读回仍待本轮继续。

## 2026-10-28 原生Word AI题本UI

scripts/education/kb-native-batch-journey.mjs：真实文件夹Word导入→统一DeepSeek设置→逐批三角色图片授权→现两阶段HTTP/OCR→同题本→typed看图/缺图重试→教师改答撤旧图→改公式题干撤题图→恢复真实AI题干→删预览图/冷重启。已通过7项/2次启动/0 rendererErrors，1366×768与1920×1080；最终指纹与日志见goal/KB_IMPLEMENTATION_EVIDENCE.md。HTTP由受控fixture回应，不是真实模型质量；Store10另证Pi和真实Word/PDF字节，未代替Office/WPS人工视觉验收。

## 2026-10-27 首次窗口可见性

> 2026-10-28 主线交付：用户已授权提交及推送；本节通过结果为10月27日D:历史证据。本轮依赖安装未完成，build（缺tsc）/组件（缺react-aria文件）exit1；原生专项未重跑。专项已补全新工作区目录初始化。详见 DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md 的发布与核验记录。

新增scripts/daily-launch-visibility.mjs：读取当前launcher交互spawn配置，同out实际Node spawn→独立profile/data→CDP确认真实Pi会话→Win32 IsWindowVisible→WM_CLOSE优雅退出。修前true隐藏RED，修后false可见通过；原有Playwright _electron直启不覆盖此Windows启动标志。精确记录/边界见goal/DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md。

<!-- kb-web-writeback-20261027:start -->
## 2026-10-27 S6-C 持久联网补答与批判修复

S6-C原题本网页出处与补答记录：实际Electron双尺寸可见操作、typed IPC错误/重试、展开持久原文、教师改写撤销对应当前web引用/保留历史、冷进程重启读回已通过。准确最终实例/构建指纹见KB_IMPLEMENTATION_EVIDENCE.md；不是通用网站登录或模型答案正确率验收。

最终补验：build/typecheck及240组件exit0；真实Electron12项/0 rendererErrors/双尺寸冷重启，ODZIoG/out18715c90；实际Pi+生产taskRuntime准入6项、旧任务19项及独立SQLite账本/任务回放通过。live/recheck保存证据绑定真实首个application callId，不冒充教师确认。207历史smoke属最后task修复前冻结构建，最终精确边界见EVIDENCE。
<!-- kb-web-writeback-20261027:end -->

<!-- kb-enrichment-read-20261027:start -->
## 2026-10-27 S6-C 缺答题实读与独立批判修复

S6-C本片使用现小智工具入口及来源卡，新增15源边界与7Electron Store读回项；未增加独立教师UI。本片没有真实provider驱动的聊天E2E、真人网站题解、写回答案或冷进程UI验收，不以底层工具/Store通过冒充这些用户闭环。现renderer组件门禁与最终兼容smoke结果见EVIDENCE。
<!-- kb-enrichment-read-20261027:end -->

<!-- kb-dom-enrichment-20261027:start -->
## 2026-10-27 浏览器DOM取数限定路径

| 实际路径 | 证据与边界 |
| --- | --- |
| 原生内置浏览器→动态题解DOM→实际Pi工具extract→来源SHA/图式缺口→两尺寸→导航/取消 | pi-browser-extract-native-final.log，8项，5ff7QZ/report.json；真实Electron/本地HTTPS协议夹具，无真实provider/搜索站/写回声明 |
| 隐藏/折叠/选区/表/式/图及Readability省略 | 10组jsdom，独立15组复放；纯文本保全与lossy，非数学正确性 |
| 持久缺答任务→网页核对→写回→冷启 | 仍未实现，本轮提取器不得作为通过证据 |
<!-- kb-dom-enrichment-20261027:end -->

<!-- kb-word-proof-20261027:start -->
## 2026-10-27 原生Word图稿真实路径

| 用户操作 | 限定证据 |
| --- | --- |
| 文件夹→Word按题→生成图稿→独立题/答/解→表尾→停止→坏缓存重建→冷启动 | 整合前f4996628；kb-word-proof-journey-recovery.log，6项/2启动/0错误，1366/1920，omni-word-proof-ui-3nzbRc；不是AI入库/正式试卷 |
| 图稿进程exit(79)→新进程恢复；另进程持锁→拒绝清理；备份→冷读 | 3真实崩溃/锁+4实际SQLite备份专项；只回收无引用精确派生文件，原件与活库记录保留 |
整合后补验完成：build/typecheck及240组件通过，生产启动9项、Word图稿6项/2启动均0rendererErrors；两套报告共享完整out指纹c58e043b7a3a8b4c7126e5ec419c51b70b0bdc0d578481cba7353d2cc8469a03。预整合冻结out的207项历史兼容回归exit0；不冒充整合后全套Pi或正式模型验收。文档/专项收尾提交将真实快进main，未push。
<!-- kb-word-proof-20261027:end -->

<!-- kb-word-question-20261027:start -->
## 2026-10-27 Word原生按题视图

| 真实用户路径 | 结果与证据 | 限定 |
| --- | --- | --- |
| 添加文件夹→DOCX→按题查看→题面公式、独立答案图/解析→15行表→尾题→六个同段图片范围翻页→冷启动 | 最终ad1ac1e6构建，`kb-word-native-reviewed-journey.log`，5项/2启动/0 rendererErrors，1366×768与1920×1080；报告kPOGrR | 合成DOCX与可解码不同PNG，证明来源/UI/角色/字节/重启；没有AI定稿或图题出卷声明 |
| 旧Word→原文5块仅显示一次→查看图表→重整/隐私与旧题保留→取消→坏图拒绝/修复→冷启动 | `kb-word-native-existing-word-reviewed.log`，5项/3启动/0错误，报告zANa0b | 修复前BBCGwZ 10!==5失败保留，避免新入口测试掩盖原文回归 |
| 错误来源/版本、范围、角色、预算/大共用索引 | 24范围+6真实SQLite/IPC；新领域覆盖100%行/89.07%分支；2000前缀/4000题约3.37MB常驻 | 不是40GB长时吞吐/召回/真实云模型或EXE验收 |
<!-- kb-word-question-20261027:end -->

## 2026-10-27 生产启动隔离

`scripts/production-bootstrap-ui.mjs`：最终真实Electron/typed preload9项，覆盖runtime未决不bootstrap、旧设置/待输入失败不影响Pi、生产学习概览保留非零知识与确认数据、探测失败/重试不回旧壳、共享失败显示/重载恢复、显式legacy全读取/待输入恢复/失败止步。`scripts/daily-entry-smoke.mjs`按现侧栏稳定testid核五组入口，8项含学生/记录SQLite读回、双视口、单实例和冷启；均0rendererErrors。精确证据与综合smoke见 `goal/PRODUCTION_BOOTSTRAP_CONTRACT_20261027.md`。不代表偶发旧版本页面已复现、视觉接受、真实provider或新EXE通过；UI合同既存CSS指纹门禁仍失败。

同最终out7afdb798完整smoke已exit0，30隔离学生/207历史兼容项通过（0失败，未输出skipped字段）；非全部Pi UI或真实provider结论。

<!-- kb-word-20261027:start -->
## 2026-10-27 Word 图文来源与主线续接

Word资料贯通：添加文件夹→自动DOCX结构→公式/按需原图→表格翻行→旧资料重整→键盘取消→冷恢复→坏图拒绝及幂等修复。预整合5项/3启动/0rendererErrors，1366/1920，脚本 apps/desktop/scripts/education/kb-word-journey.mjs。最终整合构建与回归结果见KB_IMPLEMENTATION_EVIDENCE.md；不是视觉AI或自然题库质量验收。

独立批判后最终两条Word路径均exit0：普通图文5项/3启动、18,000段DOCX切换A/B/A取消1项，均0rendererErrors；14组解析/5组任务边界/240组件通过。记录见KB_IMPLEMENTATION_EVIDENCE.md，207综合历史路径属于修复前整合构建。
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

新增retrieval-rerank-notice。kb-reranker-journey.mjs真实Electron4项/2启动/0rendererErrors：初次UI题意查询同时导入其他资料不清空有效结果，typed前20比较覆盖，题本3题与硬学科过滤、冷重启事实一致；1366实际操作、1920截图reranker-question-1920.png已读图。

本轮build/typecheck exit0、renderer217/217；实际冻结模型5项（含独立16例质量），源类/SQLite重排8项、原检索17项回归通过；Electron4项/2启动/0renderer错误，实际文件夹导入、并行新资料导入时仍返回原题意结果、同题本和硬过滤、模型冷重启/事实hash保持。发行资源预检四套包逐文件通过；重排包157文件399017988字节，当前main SHA256 ec96ae05619e425ab5de30919fd2fd12a3aadb72e7714c08a48c76808f45f80a。详情见KB_IMPLEMENTATION_EVIDENCE.md。

独立AI先冻结20例开发pilot，再另冻结16例四科分级验证集（非自然教师标注）。真实冻结模型在后者的融合NDCG@3由BGE余弦基线0.8311提升到0.8689，最佳项Top1由10/16到11/16；仍有失败与排序退化，不能称高准确率已达标。大m3在开发集仅小幅提升、约2.6倍耗时，因此未预装。首个冻结模型调用约6.14秒，实际UI首查5.83秒；单次热缓存完整请求40ms含重排缓存命中，不是百万级或P95证据，冷启动尚未达到2秒试验目标。

整体Goal继续active。下一主线优先完整图文题/Word来源表示与归档、跨页/答案配对、可选视觉AI；随后旧代缓存GC、自然教师质量与长上下文/冷启动优化、40GB持续处理与统一最新EXE。当前合成质量/小型路径不能冒充企业级或全目标通过。当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；全目标完成后读取最新main、保留协作者变更并处理冲突。
<!-- kb-rerank-20261026:end -->


<!-- kb-maintenance-20261026:start -->
## 2026-10-26 索引维护与受校验ANN（目标继续）

维护切片增加retrieval-maintenance稳定入口；kb-index-maintenance-journey.mjs在43对象实例执行4项/2启动/0renderer错误，实际后台维护和BGE题意查询、暂停→关闭→注入派生running→冷启动→提示→继续→实际完成，三张原始表hash一致。1920图index-maintenance-1920.png，1366实际操作。

整体仍active/DOING。当前只证明近邻算法对照及维护闭环；受控512维向量不是自然教师题意质量，1.6万不是百万级或40GB。小库仍使用exact，大库经校验才ANN。旧代目录整体GC、交叉编码器重排与教学质量holdout、完整图文/DOCX锚点/跨页和答案册配对、受管本地视觉AI、40GB耐久和最终新安装包/main合并继续OPEN。
<!-- kb-maintenance-20261026:end -->


<!-- kb-semantic-20261026:start -->
## 2026-10-26 本地混合召回与批量索引（整体继续实施）

本轮新增材料题意/关键词模式、后台暂停/继续/重建与题本按题意检索，实际Electron原主路径5项/3启动+最后冷读5项；1366×768/1920×1080输入框和select可达，文字题无假原图按钮，过滤改变清掉旧结果。来源升级追平43对象。脚本kb-retrieval-journey.mjs与kb-retrieval-ui-readback.mjs；数据/命令/未验证范围见KB_IMPLEMENTATION_EVIDENCE.md。

完整目标继续active/DOING。当前实际向量搜索仍FLAT，尚无交叉编码器重排、自然教师holdout的Recall/Precision或百万级CPU P95证明；16条小样本批量通过不是40GB证据。下一位置：索引维护/ANN/重排与质量门槛，完整图文题/DOCX图公式锚点/跨页与答案册配对、受管本地视觉AI包、自然资料与40GB持续处理，最后统一EXE发行和main集成。旧NSIS不含当前源码。不得把本地embedding包称为本地视觉AI整理已完成。
<!-- kb-semantic-20261026:end -->

## 2026-10-22 当前三主线与计划步骤绑定

构建`c7e088ca418a65a361d254482553a9c5b0c4fc0b5316f20e1380721fd972374b`/373。任务准入边界`pi-task-plan-boundaries-JyTOx4`17/17；错题少练`education-journey-N9nyqY/VcojgR`连续两次12/12；资料备课`pi-teacher-materials-current-oDVIOE`5/5；自然课堂`pi-science-natural-ui-LXxDhC`6/6；已有课件合并`pi-science-merge-ui-YhBc4l`5/5；长历史`pi-long-history-ui-Zy5NVG`7/7；快捷入口9/9；renderer240/240。

真实产品失败`education-journey-R5JJQX`保留：已采用唯一executing任务步骤时模型漏填`taskStepId`，候选卡被`task_plan_required`挡住。现宿主只在唯一匹配时确定性绑定，多匹配/无计划/依赖未验/资源不符仍失败。PowerPoint播放`pi-science-powerpoint-playback-LXxDhC`打开/渲染/教学文字备注通过，动态放映在`SetForegroundWindow`被Windows拒绝，WPS与投影仍OPEN。总进度`apps/desktop/test-results/goal/h05-task-envelope-deterministic-binding-20261022/progress.json`。

同构建网络`pi-daily-network-copy-mzNHp4/jKfIYi`两轮5/5、公开图片`pDFn8E`13/13、自然文件`w5DsIS`14/14。旧浏览器准入失败`kLjoTg`保留并由当前两轮证据解决。H10整体仍NOT_ACCEPTED；总进度`apps/desktop/test-results/goal/h10-current-build-software-20261022/progress.json`。

Journal门禁同构建`pi-event-journal-XMx2OZ`19/19、`pi-event-sync-ui-CvMrmV`10/10、`pi-event-journal-ui-QOMPZa`12/12；同步UI的210行journal hash与typed页一致，通知丢失、同步失败、旧revision和冷恢复均覆盖。进度`apps/desktop/test-results/goal/h09-journal-gap-recovery-20261022/progress.json`。真人读屏、完整动态状态和DPI/性能仍OPEN。

DPI矩阵已补：`pi-dpi-interface-ui-OACw5j/HEqdwU`在真实Electron DPR1.25/1.5下各8视图通过，覆盖1366/1920和浅暗、物理截图及主要控件；进度`apps/desktop/test-results/goal/h09-dpi-interface-20261022/progress.json`。系统主题菜单、真人读屏、全部动态状态与性能仍OPEN。

## 2026-10-22 H09窄屏与键盘可达

当前构建`8375c55c...`/373。`pi-narrow-interface-ui-MhwwDT/bmoNMB`连续两次通过：1366×768浅色、768×1024浅色、390×844暗色、390 forced-colors及390冷启；产品最小宽390，所有Composer主控件可达，横向溢出0。Tab覆盖附件/权限/技能/发送，快捷卡Enter填草稿并聚焦；移动侧栏Enter打开、焦点进入名为“会话侧栏”的Dialog、Escape返回触发器；Chromium accessibility tree含main、textbox和主要按钮；0消息、0错误。

同构建网络5/5、图片13/13、文件15/15、快捷入口9/9、renderer240/240。首版空白Sheet、浅色半高、无名称Dialog和Portal选择器失败均保留。真人读屏软件操作、动态状态、长历史和journal压力仍OPEN。

## 2026-10-22 最终构建资料备课主线

构建`4dfb959f...`/373上，`pi-teacher-materials-current-czmU6b`5/5：owned日常配置副本从“根据资料备课”进入，附件先选、资料实读、完整五年级稿、41分钟改稿、全文审阅、审批前零文件、确认保存与冷启文件面板重开。8次DeepSeek HTTP200、0 renderer错误、冷启0模型请求；审阅与文件SHA一致，源日常DB不变。

`daily-B03Dhp`因档案脚本只改变父进程`APPDATA`、Electron仍打开默认日常userData，在启动断言处安全停止；新脚本显式传`--user-data-dir`并核对实际路径，owned profile已删除。该结果只关闭软件主路径，真人/课程审阅和另外两条教师主线仍OPEN。

## 2026-10-22 H10同构建矩阵（前一构建）

最终构建`4dfb959f3ed9e60d38f6f0313c64293bcf47441cd1fb8c1cf9f3dee2ff75ee40`/373与owned副本完全一致。网络`pi-daily-network-copy-D4UQf0/fG3tZB`各5/5；公开图片`pi-public-image-ui-z19EBM/DnmrJ6`各13/13；文件`pi-natural-file-6rw96n`14/14。任务状态28/28、浏览器准入4/4、任务计划17/17、renderer240/240；0 Electron、0 PowerPoint，两个WPS为用户早先启动的现有实例。

文件首次`9tdx5O`在审阅前失败，因为真实DOCX使用周章节键值表，而旧回读只识别分列宽表。现两种结构均接受，同时仍独立核四周、目标/任务非空、负责人空白；同一真实草稿重算4周/4表/20行，最终构建完整重跑14/14。`wGFxRF/C0qnOS/R1PbZP/oprbps/9tdx5O`均为保留失败。

H10整体仍`NOT_ACCEPTED`。后续前端不扩展覆盖矩阵，只优先覆盖目标教师真实资料备课主路径，再到真实错题少练和已有课件放映。汇总进度`apps/desktop/test-results/goal/h10-current-build-closeout-20261022/progress.json`。

## 2026-10-22 H10日常配置副本联网

`pi-daily-profile-network-ui.mjs`从真实日常profile最小副本启动正式out，隐藏侧栏后截图中央工作区。`RxMvJv`与`Qdx3qZ`连续5/5完成真实搜索、两正文、内置浏览器和PNG，源DB不变。任务准入新增same-resource safeAfterVerified：snapshot/screenshot/show/tabs/wait/scroll及safe_read/local_cache可在verified步骤后追加，navigate/交互/换URL/写仍拒绝。原`R1PbZP/oprbps`保留。构建`d8ec…`/373。

## 2026-10-22 H10日常配置与旧会话只读副本

`pi-daily-profile-copy-ui.mjs`从真实%APPDATA%/OmniEduAgent复制最小配置、DB和Pi native到owned profile，用正式out启动且不设环境key/model/data override。`43LyZQ`与`iO1eVO`连续4/4：DeepSeek/deepseek-flash/auto DNS恢复，旧备课会话历史2turn可读且字节不变，副本新聊天两次真实完成；源DB SHA不变，报告仅保留标题哈希并在写入前删除owned profile，截图前收起会话侧栏，0错误/进程。H10整体仍NOT_ACCEPTED。

## 2026-10-22 小智状态写锁恢复

生产`OmniEduStore.xiaozhiState.sql.transaction`现用`busy_timeout=0`获取快失败、异步退避重开`BEGIN IMMEDIATE`，10秒总窗口；事务动作不重试。构建`a66595d2c3a7cbaeda35333cc3ebfed10f02e5a5764a4167c14b1007ea3db46c`/373，状态专项5/5、正式Electron/真实DeepSeek事件链12/12，真实6秒锁6156ms恢复且冷读成功；journal19、回执15、attempt9、preflight9、读调度10、lifecycle5、renderer240、build/diff通过。`daily-0AxcRF`等历史失败保留。

## 2026-10-22 教师文件栏拖拽命中区

`pi-workspace-files.css`只把当前`pi-shell-files`的Resizable把手提升到`z-index:12`，修复相邻文件面板覆盖8px透明命中区的问题；原始HeroUI Pro、1px视觉分隔线和布局持久化不变。构建`ee2639938681efc3fd5b1abe31b6749d9905ad92652cfcb8709238690b402c55`/373，`pi-files-ui-epp8uJ`与`pi-files-ui-0lU3GY`连续两次32/32：真实hover/drag，四组面板约360px、正文359.33px以上、控件可达，0错误/远程请求。`TTu3HI/Dq65HM/RqLsSX/xeghZa`全部保留。renderer240/build/diff通过。

## 2026-10-22 课件合并取消文案

`ScienceClassroomExport`在PPT合并取消时明确“已取消合并，原课件未修改。”，普通导出取消显示未写入。当前构建`da005f9311a36b95a0c57f2411a7c6484bd9a393886a8df1bc7804e0ef7ebc85`/373，真实PowerPoint `pi-science-merge-ui-nB4HEw`5/5：6页副本、source/target hash不变、取消零副本、双尺寸与冷启通过。失败/旧文案证据`1JLycX`保留；动态放映/WPS/投影仍OPEN。

## 2026-10-22 教师工作目录显示名称

`teacherWorkspaceLabel`统一文件树、上下文标题、资料范围和设置页，仅内部workspace名称映射“教学工作目录”。当前构建`dde1e30018a6a8edd0a4954faa8ff941a026d79d448ed627a0bf745fb6a3ed0f`/373，聚焦Electron复制DB验证raw workspace→teacher“教学工作目录”及真实文件显示；同构建完整文件面板`UbEhQt`32/32、13布局/41对比度、0错误/远程请求。renderer240/build/diff通过。失败图`failed-workspace-header-raw.png`保留。历史`layout-formula-20261009`通过C盘归档+Junction保留。

## 2026-10-22 练习来源总题数与第二题可达

`PiPracticeReview`多题来源弹层显示总题数、`第n/N题`和滚动核对提示；吸顶提示通过`scroll-margin-top`避开标题。当前构建`5dea640810ed6542d74f7fc53890cc4e037ff3f6f30f9f3e5831031c18f4df77`/373，复制已确认练习DB的真实Electron在1366×768暗色验证第二题标题可见，无provider/源DB或练习写入；renderer240/build/diff通过。失败图`failed-second-heading-under-sticky.png`保留。本片LIMITED_ACCEPTED，真实模型与真人错题布置仍OPEN。

## 2026-10-22 教师长稿章节目录

`PiWorkspaceFiles`从本地Markdown提取最多32个标题，≥2标题显示折叠目录；点击定位真实渲染标题并显示状态。正式Electron`pi-files-ui-EFfXJN`32/32：45段长稿3节跳转、1366/1920浅暗四组重新定位截图、13布局/41通用对比度最低5.3017、目录项最低4.90069、0错误/远程请求，原文件/权限/冷启边界通过。构建`1d4226a7985d66790878fda7e96b183f76dadf5f0bc35b04e88ef479dea949fb`/373。`MqMhXx`ENOSPC、`YpCPOe`尺寸等待、`zzrZ2f`截图重置缺失保留，迁移清单`test-results/goal/EVIDENCE_RELOCATED_20261022_FILES_UI.json`；真人长稿仍OPEN。

## 2026-10-22 教师文件阅读空间

`PiWorkspaceFiles`在≤760px文件面板打开文件时自动收起树，正文获得整栏；工具栏显示“文件列表/收起列表”。正式Electron`pi-files-ui-PGhnt8`32/32：1366/1920浅暗13布局/39对比度（最低5.3017）、键盘/标签/变更/超限/损坏/授权/归档/冷启通过，0 renderer错误、0远程请求。构建`d50a408b72d45a13019bff0c19db181300237b27c00dba00e2524f545436c9f3`/373。原`eJnMQh`隐藏窗口截图动画等待失败保留；真人教师长稿定位仍OPEN。证据`test-results/goal/teacher-mainline-reader-space-20261022/progress.json`。

## 2026-10-21 教师答复误停修复与主线收紧

教师答复误停专项a7RhUU5/5：两个idle→真实界面选择并发送→聊天草稿→实际教师确认→冷启，原生模型流SSE夹具；浅暗双尺寸四图已看，输入/成果范围分开。输入反例23与同构建退出10通过；原YBsXtw红报告保留。不是队列全部行为、真实provider/教师独立使用验收。证据harness-teacher-input-20261021-answer-delivery/progress.json。

## 2026-10-21 等待审批退出崩溃：限定修复验收

HARNESS-SHUTDOWN-PENDING-01 LIMITED_ACCEPTED：正式Electron等待保存审批→三种关闭→冷启10/10；真实新审批保存/成果核对回归7/7。退出后无伪running/批准/输出/重放，Task/Goal/待审与SQLite/native一致；模型SSE夹具。代表图已看，未修改布局，不计真人/日常NETIMGFILE验收。证据harness-shutdown-20261021-ipc-drain/progress.json；原失败保留。

## 2026-10-21 探索资料不误停，定位不冒充成果

office_list_files/file_stat经Hana实际IO来源身份＋当前授权/native/快照复核后可推进持续目标，同源只得一次定位信用；目录/元信息仅作中间checkpoint，最终正文/保存/教师验收仍独立。UI说明仅定位、未核正文。旧记录不补造通过，无新IPC/DDL/依赖/Loop。

85e235ee同构建：实际Pi Electron三级定位→正文→同目录审批保存→确认/冷启、同源idle3停止共7项，Hana/FS反例19、旧改稿14、真实store8及type/npm隔离build/renderer234/legacy207通过；166事件/11回执/进展key/文件/native独立对账，4张原生浅暗双尺寸图已看。模型明确SSE，不是provider/真人证明。精确范围harness-h05c1-20261021-discovery-delivery/progress.json。

完整H05和原NETIMGFILE等仍OPEN；HARNESS-SHUTDOWN-PENDING-01保留超时收尾NAPI fatal待归因，未因正常冷启通过而关闭。日常out/profile未替换。

## 2026-10-21 教师验收要求增删/重排

在“核对目标成果/任务成果→修正要求”添加、移除或上移教学验收要求；main分配新增ID、保留项不重编号，机器标准和依赖不删除。保存使旧确认失效/暂停，正式目标显式恢复后按新版本确认；旧目标API仍用同一Task验收权威。

冻结30745e68：实际Pi/typed Electron增删→恢复→新确认→冷启7项、同构建读原稿/重新审批改稿14项、边界12、浏览器22、真实store8及type/npm隔离build/renderer234/legacy207通过；68事件/native/action/history独立对账、4张原生浅暗双尺寸图已看。模型明确SSE，不是新provider/教师人工证明。精确命令及范围见harness-h05b2-20261021-criteria-final/progress.json；完整H05、原NETIMGFILE与后续Goal仍OPEN，日常out/profile未替换。

## 2026-10-21 新要求恢复与原稿历史核验

实际原Pi/typed教师操作现已验证修改要求后重新读资料/原稿、两次新批准改稿、新版教师确认及冷启；冻结a755，正式Electron14项模型流为明确SSE，非真实provider/教师独立证明。原稿经raw SHA/脱敏全文/before与当前after核验后标“历史输入”，不代替当前file标准。真实store8、专项与renderer234/legacy207、257事件及文件链独立对账见harness-h05b2-20261021-goal-revision-delivery/progress.json。完整H05仍IMPLEMENTING，教师要求增删下一片；原NETIMGFILE、真实provider、无VPN/安装/Office动画-WPS/真人继续OPEN。

## 2026-10-21 正式目标多标准与统一核对

|教师动作|当前证据|边界|
|---|---|---|
|建立两项正式目标→真实读来源/审批保存→停止/重启→恢复剩余|7RBmEj正式Pi Electron9项，同task/step/criteria保持|明确SSE模型流，非真实provider|
|外部改已保存讲义→恢复被阻断→旧goal checked也不能确认|同9项，后续练习admitted=0/无文件、确认失败无部分human通过|原mxoWq1红保留，修后同路径重测|
|恢复原字节→仅保存练习→两项要求确认|同9项，goal/task同时completed、原call/run证明保持|教师实际教学判断尚未真人验收|
|修正一项年级要求→两边文本/版本/状态同步→冷启|同9项，checks/candidate清空，零新模型run|修改后新版本继续/改稿仍待验|
|陈旧展开卡刷新→继续核对|jOkNhg缺刷新错误保留；最终用户点击“重新读取”后操作|不解除旧revision/sync保护|
|浅暗1366/1920|ZsoXSB4图逐张已看，viewport/PNG×DPR/自然过渡/对比度|1366展开压缩聊天高度，H09继续优化；不称全部视觉通过|

普通resume同构建fFtJHm8/8；renderer234、type/原npm隔离build及真实store8已过。完整同构建门禁与报告harness-h05b2-20261021-goal-task-delivery/progress.json；原NETIMGFILE/无VPN/Office等仍OPEN。

## 2026-10-21 H05-B2 v3步骤与继续任务（整体IMPLEMENTING）

|用户路径|实际证据|限制/未验|
|---|---|---|
|原v2会话→当前v3计划→读来源→审批保存→核对步骤|XIm1Bf 7/7，旧真实二进制/当前正式Pi，旧native前缀保持|模型传输SSE夹具，非真实provider|
|保存讲义→停止→重启→继续剩余→审批练习→教师确认→冷启|gAXC7k 8/8，实际typed UI、SQLite/native/文件；精确重试同run|真人备课/真实模型待验；正式goal未接|
|旧讲义被外部修改后点继续|同8项内独立反例：效果unknown、练习admitted=0/零文件、不可确认|恢复原字节后才放行，未把unknown改通过|
|迟到/模糊响应/同步中/旧任务操作|Nb7Siu 17/17生产组件＋声明typed API；main另16/16|组件夹具不替代主进程反例|
|浅暗1366×768/1920×1080|0kWuOM4冷恢复视图＋XIm1Bf4视图，8图逐张已看、前后viewport/PNG×DPR/自然过渡|单run历史完整性与跨run最终任务提示层级列H09待改|

同构建44d3dfc4、renderer234/234、legacy207/207（仅历史兼容）、真实store8/type/build通过；独立113条journal及来源/文件/确认hash一致。精确报告harness-h05b2-20261021-resume-delivery/progress.json；原NET/IMG/FILE等不改绿。

## 2026-10-21 科普教学版

|用户路径|当前证据|限制|
|---|---|---|
|HTML按知识点观察/讲解，答案默认收起|真实sandbox Chromium，教学专项6项|内容/会话为夹具；完整模型→教师UI审批另验|
|文件面板→PPT/GIF导出→定位/取消/源变化→冷启|正式Electron Cfpmkp 8/8，1366/1920|0新provider；reveal观察自有shell参数；Office另验|
|学生页/教师备注一致性|正式UI导出文件回读，目标/问题/解释一致，答案不在学生页|教学正确性仍由教师审核；真人使用待验|

## 2026-10-21 H05-B2普通请求核对卡（IMPLEMENTING）

|链路|当前证据|边界|
|---|---|---|
|普通task→公共事件→typed API→可见核对/修正|生产已接入；真实HTTP402失败副本p3cC2N6/6|失败路径通过不等于真实正面成果确认通过|
|修正版本→action/task/history/journal→冷启|真实Electron与OmniEduStore SerP0U8/8|不写教师题库/成绩事实，不自动重跑|
|旧异步结果/同步中变更/重试幂等/可读确认|生产组件浏览器oUaFEI11/11，实际浅暗双尺寸图已看|声明API响应，非真实provider；完整逐step仍未接|
|坏task记录|实际冷启显示不可核对提示，原对话保留|未知权威不接受、不静默迁移成功|

构建d7a4d71b、精确门禁/独立读回见harness-h05b2-20261021-product-review/progress.json。真实模型eQdimA为HTTP402/Insufficient Balance；等待充值后跑既有pi-task-review-ui.mjs。原TASK-03/04/07仍红，原NET/IMG/FILE与全Harness未验边界保持。

## 2026-10-21 H05-B2教师动作仍待UI验收

candidate/review/correct/recheck与输入验证已在main-only模块实现，后端26/26；当前没有typed IPC/preload/可操作教师核对界面，因此前端闭环仍OPEN。源/效果专项使用真实SQLite/字节＋声明native/effect夹具，不能算真实教师点击或Electron冷启。生产v2 TASK-03/04/07仍失败；下一步coordinator→公共task事件→typed UI及恢复实例。证据harness-h05b2-20261021-teacher-authority/progress.json；完整合同及原NET/IMG/FILE等不变。


## 2026-10-21 TASK H05-B2覆盖缺口

当前新增任务存储/准入只有专项27/27，无typed IPC/UI生产入口或真实Electron用户验收；不可把SQLite重开叫Electron冷启。当前v2生产基线TASK-03/04/07仍3项失败（GnQAZi，TASK-07只身份函数层）；后续必须普通自然语言start、显式goal、教师确认/改标准、暂停/真实冷启/恢复剩余步骤贯通。当前type/隔离构建/renderer234及v2计划21只作分层旁证；完整TASK矩阵与现场见H05_TASK_STEP_ACCEPTANCE_CONTRACT和harness-h05b2-20261021-storage/progress.json。


## 2026-10-21 H05-B1 真实持续目标用户路径

原配置最终构建69edc529，正式Pi/DeepSeek iga552 7/7：旧C3会话恢复、实际重复读取→3idle原调度停止、公开说明、双尺寸浅暗/对比度、冷启与显式恢复同证据去重；同数据51guh5 5/5：新教师目标、盲文件读取、可见预览/单次确认保存、实际产物回读、两标准教师验收与冷启。14次HTTP200、5启动，无renderer错误；独立589条journal及文件hash一致。精确1366×768/1920×1080与DPR核实，四图查看。证据harness-h05b1-20261021-delivery/progress.json。本轮复核历史产物，非日常原profile复测；完整step验证/普通任务覆盖、390/768/DPI/读屏/性能仍OPEN。


## 2026-10-21 H09-C3 计划调整与历史

新增backend plan.v2 CAS/已提交journal→typed plan-history→PiTaskPlan/PiPlanHistory→实际教师展开/比较/定位/回答→SQLite/native/冷启证据。正式Pi10、精确冷启视图3、生产组件浏览器8通过；私有CAS与journal断裂反例无伪采用。双尺寸浅暗自然过渡/像素与DPR已核；完整390/768/DPI/读屏/性能矩阵仍待做。范围仅结构和记录，逐步骤独立教学/交付核验仍OPEN。精确测试命令、构建与源码hash及原失败见docs/goal/HARNESS_EXECUTION.md和apps/desktop/test-results/goal/harness-h09c3-20261021-receipt/progress.json；日常/原NET/IMG/FILE不据此通过。


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

## 2026-10-11 KB-S5-B限定接受，接续S6（历史读点）

KB-S5-B自然扫描图文交付 LIMITED_ACCEPTED（单题范围）。build 517b30ea70e2e46b1e1b2fbc68d311a461b9d052f1d50e42850b00fa74fb867e /340文件；build/typecheck exit0、领域292、组件203/203、导出边界15、Office底座17、coordinator11、正式新版Electron17项/2启动/20张浅暗双尺寸截图/0 renderer错误、兼容smoke207/207。真实授权物理扫描→同Pi提取完整题面原图→教师六项核对及补充答案→纯题库1题8分卷→同Office按版本图片确认→学生/教师DOCX/PDF四份真实文件→重启读回。DOCX媒体hash与PDF解码像素等于确认原图；学生文本答案隔离、改标题旧确认失效、缺图片确认拒绝、实际图片损坏拒绝与停止无落盘均通过。Microsoft Word 16.0 独立实例只读打开两份DOCX并实际渲染，输入文件字节不变。4条Paper谱系、0条误标AI来源，4个批准hash匹配；教师补充答案和解析仍未独立验证。证据：apps/desktop/test-results/goal/kb-office-rich-20261010/closeout.json。

本片仅接受自然物理扫描的一道8分图文题及原图交付；不是自然数学100分卷、复杂公式/图表完整正确性、可编辑公式或答案正确性证明。WPS实际打开、S6更广自然材料/质量、hybrid/ai_original、5变式/自动修复隔离、30–40GB及安装仍OPEN。


## 2026-10-10 KB-S5-A限定接受，下一图公式联合验收（历史读点）

KB-S5-A文字整卷Office交付 LIMITED_ACCEPTED。build e73b1f1c3a393192b7858953d53a84ccd2807ebf23b4c1d547d4670d6d3ac3a0 /340文件；build/typecheck exit0、领域291、组件203/203、导出边界11、Office底座17、coordinator11、正式新版Electron19项/2启动/0 renderer错误、兼容smoke207/207。24张最终浅暗双尺寸UI截图和4张最终A4 PDF渲染实际查看；独立Word XML/PDF文本核对20题及学生答案隔离。同一Pi→现Office教师审批→学生/教师DOCX/PDF四份真实文件、4条Paper谱系且0条误标AI来源，冷启读回一致。来源变化、实际拒绝与停止均零落盘；同会话新卷确认后旧选择隐藏导出，避免导错版本。教师仅改标题，原题不改，answerVerified=false。证据：apps/desktop/test-results/goal/kb-office-20261009/closeout.json。

限定为教师UI创建的文字题100分卷；不是自然扫描/数学正确性或图公式验收。扫描题/公式当前明确拒绝，未降级摘要。Office/WPS实际打开、自然材料S6、hybrid/ai_original、5变式/验证隔离、30–40GB及安装仍OPEN。


## 2026-10-09 KB-S4-B限定接受，下一S5/S6（历史读点）

KB-S4-B同Pi本地候选→实读→受审练习 LIMITED_ACCEPTED。build ab6835d59e7d7c65e24895eafeaef6915482dc3b60e02a3f8f68c66004b2a037 /340文件；build/typecheck exit0、领域289、组件203/203、模型目录19、SDK fetch边界5、正式新版Electron26项/5启动/20张已查看浅暗双尺寸截图/0 renderer错误、冻结构建兼容207/207。真实DeepSeek读取实际交付照片学习证据，查询10候选、实读原题及所选5题版本，排除两道实际进入Top10的面积干扰；教师修改后只保存1份5题练习及5条使用记录。实际拒绝、停止冷恢复不重放、重复确认幂等及冷读通过，题库/学生事实不新增或改写。Node fetch目录/SDK ECONNRESET通过Pi原生fetch hook接Electron net.fetch修复，固定官方HTTPS/不带cookies/不重定向；容量来自官方目录，不硬编码。证据：apps/desktop/test-results/goal/kb-similar-pi-20261009/closeout.json。

限定为教师自制照片/受控题库与两个教学干扰对照；不是自然数学扫描、复杂图/公式、通用语义准确率或答案正确性证明。answerVerified=false；Word/PDF、hybrid/ai_original、5变式/校验隔离及30–40GB仍OPEN。


## 2026-10-09 KB-S4-A限定接受，下一S4-B（历史读点）

KB-S4-A本地关联候选 LIMITED_ACCEPTED。build 428fbf1a36c6ac12608442ed82a4c8def91734bccf889753daec5e34e3aca31a /340文件；build/typecheck exit0、领域282、组件203/203、正式Electron19项/3启动/0 renderer错误、兼容smoke207/207。12张最终浅暗1366×768/1920×1080截图实际查看。教师自制数学图片→固定本地OCR→教师事实确认→17条真实UI题库对照→本地Top10；原题/副本/错年级/错学科/缺答案排除，空结果、源版本故障与恢复、跨学生/旧receipt拒绝、真实停止无晚结果、冷读一致通过。纯文字题不伪造原图入口。method=local_knowledge_keyword_v1，仅知识点/文字关联，未证明语义或答案正确；不调用模型补题、不改学生事实。证据：apps/desktop/test-results/goal/kb-similar-20261009/closeout.json。


## 2026-10-09 KB-S3限定接受，下一S4（历史读点）

KB-PAPER-BLUEPRINT正式12项/3启动/20图＋KB-PAPER-VISUAL冷副本3项/1启动/12图；教师UI23题→100分→来源→改蓝图→拒绝→缺题→旧源拒绝/恢复→幂等→停止→冷读→真实Pi审批→再次冷读。32最终图已看；S4/S5S6仍待做。

KB-S3 source_only整卷蓝图/审核/快照 LIMITED_ACCEPTED。build a0f860ac56680a4ddb1fa7798edd1e7c90812fae92f73b7a1156dddee7338448 /340文件；build/typecheck exit0、领域274、组件200/200、正式新版Electron12项/3启动/0 renderer错误、补充冷副本视觉3项/1启动/0模型请求、兼容smoke207/207。32张最终浅暗1366×768/1920×1080截图实际查看。23道教师UI创建对照，20道唯一题满足10×3+6×5+4×10=100；重复/缺答案/错年级、编辑废止、拒绝、精确缺口、真实源变化与恢复、幂等、停止无晚写、两次冷读和真实DeepSeek同Pi等待教师审批通过。原题不改，不自动补题，answerVerified=false；自制文字对照不是自然扫描卷或数学正确性证据。证据：apps/desktop/test-results/goal/kb-paper-20261009/closeout.json。


## 2026-10-09 KB-S2-B限定接受，下一S3（历史读点）

KB-QUESTION-SEARCH扩展到12项/3启动/12当前截图。新增同题2独立记录/改条件负例/Pi别名与重启保持事实；语义Top10/100分卷/数学导出未完成。

KB-S2-B 保守同题候选/版本绑定 LIMITED_ACCEPTED。build cb0a5c473cbffc23d483cd2c2027f80405ac1fdbb57b44495fa4402072e8c79f /340文件；build/typecheck exit0、领域258、组件194/194、正式新版Electron12项/3启动/0 renderer错误、兼容smoke207/207。12张浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照：跨记录ID/CRLF同题2条，改数值条件保持独立；20+2分页，真实Pi/DeepSeek同次10条安全别名/duplicateOf，源变化拒绝、精确恢复、两次冷启与索引重建通过。仅本地保守候选，绝不自动合并/删题或证明答案正确；页面范围current_page、Pi范围returned_candidates。证据：apps/desktop/test-results/goal/kb-identity-20261009/closeout.json。


## 2026-10-09 KB-S2-A 关键词底座限定接受（历史读点）

新增当前路径KB-QUESTION-SEARCH 11项，仅关键词/过滤/分页/Pi/恢复；截图8张是新版five-spaces。未将兼容旧壳截图或未验semantic/paper/export标完成。

KB-S2-A 关键词检索底座限定接受。当前build `443eae07f599fda05dfc5f241f85a8f62c942bc5cc9855cbc5e48f69777e3314` / 340文件；build/typecheck exit0，领域252、组件194/194、正式新版Electron11项/3启动/0 renderer错误、兼容smoke207/207。8张当前浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照题，六项硬过滤命中22道、20+2分页；真实Pi/DeepSeek读10条并标hasMore；冷恢复、索引删除重建、旧来源拒绝与精确恢复均通过。不是语义Top10、同题指纹、答案正确性、100分卷、数学Word/PDF或30–40GB验收。证据：`apps/desktop/test-results/goal/kb-retrieval-20261009/closeout.json`。


## 当前最高专题优先级：知识库与智能组卷（2026-10-09）

已验边界与后续门禁见精简执行卡；本次整理不把尚未实施模块标完成。

用户最新指示：整理上下文，集中完成知识库与智能组卷。当前唯一执行索引：[KB_EXAM_ACTIVE_TASK.md](goal/KB_EXAM_ACTIVE_TASK.md)（仓库绝对定位 `docs/goal/KB_EXAM_ACTIVE_TASK.md`）。接续为 **KB-S2检索→S3纯题库100分卷→S4错题相似练习→S5/S6 Word/PDF联合验收→KB-002三模式/5变式→KB-003增量30–40GB**。R3/R4只按组卷/变式所需嵌入，通用解题长线及其他模式延后；下方旧节的R2→R3→R4线性Next不再是当前执行顺序。Master及知识库四项产品决策保持。


## 2026-10-09 B5-B限定接受与R2接续

范围：只接受本切片事实一致性/来源读取与恢复；更广答案质量不标完成。

本节是当前读点，下方同日旧节保留历史证据，不能覆盖本节。M05/M10 B5-B仅来源事实一致性保护已接受：answer/analysis镜像冲突及v2题干冲突由同一只读helper检测；typed IPC保留安全错误，题本/同Pi来源弹窗拒绝展示冲突正文，精确恢复后可读。旧v1摘要语义、questionVersion、批准与原图未被自动修复或重写。

当前build 367d53b3d85dbb2e1855cbb7db977859f94129e529aec6898f40b2dca8d3f6bf / 340文件，正式前后、冻结快照与兼容smoke后一致。build/typecheck exit0；领域243、组件194/194、兼容smoke207/207；真实DeepSeek/Pi Electron24项/4启动/0 renderer错误。32张当前浅暗1366×768/1920×1080截图与4份原图实际查看；三个隔离标量故障均拒绝、精确恢复、冷启一致；原生手动压缩1次后冷继续通过。此压缩不是新的自然自动阈值基准，smoke仅兼容路径，不作新版视觉依据。

物理扫描无独立标准答案仍missing，图15未知标记不认作答案；教师自制跨页算术仅来源绑定对照，answerVerified=false。完整B5独立质量、可靠求解/五tools、语义Top10、100分卷/Office、30–40GB、自然教师、安装/VPN-off与完整Codex体验仍OPEN。

**Next：R2保守同题指纹/中文检索、硬过滤/版本与可信复用合同→R3受限AST/SymPy→R4同Pi五tools→R5–R7错题/组卷/Office/容量。** 不因缺物理答案停止后续，也不凭题面批准/来源标签把答案当正确。Master ACTIVE、Phase4/5 DOING。证据：`apps/desktop/test-results/goal/b5-facts-20261009/closeout.json`；首次RED/build/组件失败与回滚副本保留。无DDL/依赖/第二runtime/日常资料或凭据改动，无提交/push，另一worktree保留。


## 2026-10-09 本轮低成本解题路线审查交付

本轮未新增Electron/视觉验收，不沿用B5-A旧build给B5-B草稿背书。B5-B同源冲突UI、typed IPC稳定错误/无泄漏、精确恢复与同Pi来源弹窗仍OPEN。后续从真实用户入口补双主题1366×768/1920×1080，不以SSR/低层查询冒充闭环。

完整设计：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；实施：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`。证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-route-review/readback.json` / `supplement.json`。Master ACTIVE、Phase4/5 DOING；本轮未重跑build/provider/Electron/上游测试，当前B5-B草稿未接受，资料/凭据/另一worktree保留，无提交或push。


## 2026-10-09 B5-A：题本来源与答案声明的限定接受

当前 build `55b02f7db10fe4530098f0447bd92d89566841acb698e51b02e68ec6e38df9a3` / 340文件与正式前后、smoke后及固定快照一致。build/typecheck exit 0；领域 **239**、组件 **190/190**、兼容冒烟 **207/207**。真实 Pi/DeepSeek 正式 Electron **22项 / 4启动 / 0 renderer错误**。24张当前product-five-spaces浅暗1366×768/1920×1080截图实际逐张查看；新增答案出处与缺失/未核验提示均有当前像素。smoke只在正式进程退出后重建；另存并查看1张legacy兼容题本截图，不把该旧壳截图当新版设计验收。

题本参考答案与解析分别标注原资料提供、教师补充、小智生成、尚未提供或历史来源待确认；所有参考答案明确尚未独立核验。真实来源对照答案/教师解析与物理扫描题缺失都经过当前页面展开操作。教师确认题面不等于答案正确；原题、来源origin、批准、版本和图片字节保持，冷重启与同Pi精确读回通过。内部sourceKind/canonical/SQLite等不再出现在该题本的教师可见文案；未知来源不猜测。

当前真实操作打开来源答案和教师解析，以及无答案物理扫描题；8张新增来源/缺失截图加16张关联原题页面，共24张已查看。两尺寸和双主题控件可达、内容可读，不能外推全产品UI一致性。

仅接受B5-A来源/答案声明与本切片UI；完整B5独立图义/公式/条件/答案质量仍DOING。物理扫描卷无独立标准答案，仍missing；教师自制跨页算术只是来源绑定对照，不是扫描答案gold。answerVerified=false，不上传原图/私有路径，不将模型自评作证明。原生手动压缩1次与冷继续已验，不是新的自然自动阈值基准。完整可靠解题、Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off、完整Codex体验及Master后续阶段仍OPEN。

**Next：B5-B逐题独立对照来源/公式/必要条件与答案质量 → R2可信同题零额外生成、相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题/组卷/Office/30–40GB。** 不重复B4四类兼容代替新质量任务，不把本轮文案修复当完整解题完成。

Evidence：`apps/desktop/test-results/goal/b5-source-20261009/closeout.json`；正式 `education-journey-n5msKi`，含当前源/加载脚本、固定build、日志、24张已查看截图、失败与回滚点。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty），Master SHA未改，Phase4/5 DOING、Master ACTIVE。无DDL、新依赖、第二runtime、日常资料/凭据变更、提交或push；另一worktree保留。历史节保留当时范围，不覆盖本节。

## 2026-10-09 B4-D：单区域完整审核与新旧版本同构建兼容的限定接受

当前build `e02ddc1d62d37152928c97718ea14894389982fcdbfd2453cb673cd08a417c51` / 340文件与四次正式流程前后、smoke后out和固定快照逐文件一致。build/typecheck exit 0；领域 **239**、组件 **185/185**、兼容smoke **207/207**。真实Pi/DeepSeek正式 **50项 / 13启动 / 0 renderer错误**：fresh single 20、旧v1单页10、旧v1多页10、新v2再修订10；40张浅暗1366×768/1920×1080截图实际逐张查看。smoke在四次正式进程退出后才重建，未与正式测试重叠。

当前可见问小智→单区域完整原图核对→必要信息缺失阻断→六项确认→题本→三类历史题修订→真实Pi/冷继续均有当前正式路径。40张覆盖浅暗双尺寸核对/保存/来源/未核对提示，实际查看。全产品UX未接受，来源内部标签待修。

只接受已核对文本传递和版本/权限/恢复安全。真实扫描原图已查看，图15深色标记显式记录来源不明；未核实的必要读数保持missing。物理卷没有独立标准答案，算术跨页资料是教师自制绑定控制，不能作为扫描答案gold。answerVerified=false；Pi只获必要文本，不发原图/私有路径。原生手动压缩1次＋冷继续不是新的自然自动阈值基准。完整B4/B5、可靠解题、语义Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off和完整Codex一致性仍OPEN。

**Next：B5原图/公式/来源/答案质量合同与独立核对 → R2可信同题零额外生成/相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题、三模式组卷、Office与30–40GB。** 现题本可见`teacher_resource`/`generated`内部来源文案，列为B5/R2产品文案待修，不把40截图限定核对当整页UX完成。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4d-closeout.json`，含当前源码/加载脚本、build、命令、首次失败、40张已查看截图及回滚快照。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty保留），Master SHA未变、Phase4/5 DOING、Master ACTIVE。没有DDL、新依赖、第二运行时、日常数据/凭据变更、提交/push；另一worktree保留。历史节只保留其当时范围。

## 2026-10-09 B4-C：新多区域审核与完整转写传递的限定接受

当前build `33ffc86cc404e48068dbb18f18138aaa153753b0ca14c424e572e5bb6fc7ff1b` / 340文件，与正式流程前后、当前out及固定快照逐文件指纹一致。build/typecheck **exit 0**；领域 **237**、renderer **185/185**、兼容smoke **207/207**。正式当前Pi/真实DeepSeek **16项 / 4启动 / 0 renderer错误**；补充冷副本UI **2项 / 8张 / 0模型请求**。共 **20张**浅暗1366×768/1920×1080截图实际逐张查看；新增核对进度与原图/来源/按钮均有当前像素证据。

新原题初审支持六项逐项核对，字段修改撤销覆盖和完整确认；范围原生修改成功后六项状态全重置、保留未保存转写。共享界面显示已核对6/6或5/6及缺项，未完整核对不能确认。真实物理原图→教师转写→题本→同Pi精确读回→原生手动压缩→冷继续已贯通；不上传原图/私有路径、不补物理答案、不改批准事实。source CAS、外帧/旧版本、真实渲染停止、事务内main强制死亡/回滚、损坏整组报错/恢复、冷启动及幂等通过。停止实测 **1483ms / SIGTERM**，仅当前设备样本，不是性能承诺。

接受范围是教师提供六项文本的完整传递与版本/审核/恢复安全，不是每个图义已经独立判真。图15已有深色标记，来源不明，须补明确原图审查；物理卷无独立标准答案，保持 missing；跨页算术是教师自制来源控制，不冒充扫描卷答案gold。完整B4/B5、可靠解题、语义Top10、100分数学卷、40GB、自然教师、安装/VPN-off与完整Codex一致性仍OPEN。

首次失败完整保留：旧stem选择器超时、模板字符串构建错误、同值fill未触发React编辑、原生CDP评估promise被回收。已修对应接缝；只对该精确观测错误限时重试同一存活应用，不吞执行错误。截图在动画稳定后复位外层scroll；克隆先核hash再只重绑定本副本local_path。smoke构建曾与同源formal进程重叠，最终指纹相同，但后续禁止并发重建与正式运行。图谱精确查找本轮未返回，采用有界当前源码，不把图谱当行为证据。

**Next：B4-D：原图细节/不明标记质量审查、单区域新审核与新旧版本联合正式门禁 → B5 → R2可信同题复用/Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7。**

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4c-closeout.json`；正式 `education-journey-cHFfHO`，定点视觉 `education-journey-otIM5j`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`；Master/日常数据/凭据/另一worktree未改，未提交或push。Phase **4/5 DOING**，Master **ACTIVE**。以下旧节仅保留当时证据，不能覆盖本节。


## 2026-10-09 Goal续行：B4-B旧题补全的限定证据

Phase **4/5 DOING**，Master **ACTIVE**。本节为审查交付之后的Goal实施，不覆盖此前审计的历史边界。复用同Pi、题库/批准账本、QuestionAssets和HeroUI表单；无DDL、新依赖、第二Agent、提交或push。

当前build `3ccdf438a6671069d74a3e80c19487816de21dc05340b38c3575766ee796234e` / 340文件，正式流程前后与当前out一致。类型/build通过；领域 **236**、renderer **183**；正式Pi/真实DeepSeek旧题补全 **10项 / 3启动 / 0 renderer错误**，证据 `education-journey-H1dgFq`。8张浅暗1366×768/1920×1080实际逐张查看，确认控件可达、标题栏归位、无横向溢出。兼容冒烟 **207/207，exit 0**；最终日志与固定build读回已归档。

教师可在题本补全六项转写，同题更新版本；原批准digest/draft/saved、所有原图和来源答案保留，修订链与canonical文档同事务。真实取消、原件变更、外帧/旧版本拒绝、事务内main强制死亡/回滚、字段修改撤销确认、重启和新版本原图读回通过。实际新Pi收到六项脱敏文本及来源答案，answerVerified=false、originalImagesIncluded=false；不发送原图/私有路径。

范围：正式旧多页算术资料为明确教师自制对照，非独立数学gold；旧单页/new-v2追加与恶意/损坏/关联隔离为领域证据，未外推自然教师、全学科或正式新审核入口。原物理扫描题仍缺完整可靠图义，不自动补条件或升级为可解题。完整B4/B5、解题验证、语义Top10、100分/数学Office、40GB、安装/VPN-off仍OPEN。每题修订历史当前受256条/2MiB安全边界限制，上限UX/长期归档仍待验证；这不是运行token预算。

首次失败保留：缺方法RED；Checkbox结构与隐藏input定位；旧验收SQLite路径未重绑定引发错误源故障注入。只改到test-results旧测试文件，已从保留原件按SHA `01f3c751…`恢复；后续克隆先核hash、仅重绑定本份local_path并强制故障目标在新隔离目录，不能作为生产备份搬迁验收。最后截图修正外层scroll，不使用force点击。日常数据/凭据/另worktree未改。

**Next：B4-C：新多区域审核六项字段的正式入口（先更新原KB-ORIGINAL-MULTI旧stem选择器），完整图/公式/选项与独立答案审查，编辑/停止/压缩/恢复联合验收→B5→R2精确可信复用与Top10→R3受限AST/SymPy→R4同Pi五tools→R5–R7。** Evidence：`apps/desktop/test-results/goal/question-projection-20261009/` 的b4b日志/build/source读回与固定build快照；最终证据见b4b-closeout.json。Git本地/远端HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`（dirty保留）。以下历史按原范围解释。

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
