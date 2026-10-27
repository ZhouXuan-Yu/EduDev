# 小智能力与复用矩阵

<!-- kb-dom-enrichment-20261027:start -->
## 2026-10-27 M04/M05/M10 DOM取数与原生协议

已实现原生AI题共享协议/镜像/稳定内容身份，业务账本尚未；已接Hana浏览器extract+Mozilla正文库、选区保全、图式/Canvas/SVG缺口、取消/导航与Pi工具回执。完整自动联网解题/缺答写回、真实站点可用性与自然正确率仍OPEN，不声称任意网页都能完整DOM抽取。
<!-- kb-dom-enrichment-20261027:end -->

<!-- kb-word-proof-20261027:start -->
## 2026-10-27 M03/M05原生图稿

已接通原生范围→按角色安全PNG→引用/字节/源版本仓储→typed取消与读取→教师核对；崩溃清理、LRU32/128MiB、备份精确省略、缓存重建可操作。完整Goal保持ACTIVE。完整图文AI定稿同库、独立AI图片账本、图义检索/Pi及正式出卷、跨页/答案册、本地视觉包、自然质量/40GB与最终EXE仍须继续；本片原文图稿不授予AI/教师确认或学生卷资格。
<!-- kb-word-proof-20261027:end -->

<!-- kb-word-question-20261027:start -->
## 2026-10-27 M03/M05 Word原生题目基础

已接通：完整Word结构→真实按题范围→三角色公式/图表→版本复验仓储→typed preload→教师按题查看→实际桌面重启读回。部分层级/共用材料存在歧义时可见标注。新领域100%行/89.07%分支覆盖，24来源与6仓储-IPC；新旧Word Electron各5项通过。

仍缺：AI archive v3、图文语义投影、AI图片独立账本、同题库完整展示/编辑、图义索引/identity/Pi、按角色正式Word/PDF导出。来源预览与4000题内存探针不等于AI完成或40GB吞吐、自然高召回/准确率、干净Windows交付。
<!-- kb-word-question-20261027:end -->

## 2026-10-27 M01/M10/M12 启动读取边界

App生产启动保留共享bootstrap、知识概览和确认队列（学习概览/录入消费者）；runtime未决不读，旧设置/待输入IPC仅legacy-test调用，Pi仍自己加载会话，不再由外层旧App重复加载。学生事实与旧入口兼容通过专项/日常路径；这不是新功能、完整R2性能验收或不同版本页面根因证明。最终能力/消费者/门禁：`PRODUCTION_BOOTSTRAP_CONTRACT_20261027.md`，UI登记指纹失败仍OPEN。

<!-- kb-word-20261027:start -->
## 2026-10-27 Word 图文来源与主线续接

M02/M04/M05：DOCX 自动题号、段落/表格、受支持 OMML→LaTeX 和 SHA 原图可读回、检索、进入现有规则归档；旧资料可显式重整/取消/恢复图片。M03/M10 完整图文AI/OCR对照与最终AI定稿仍 OPEN，不能把 Word XML 结构通过作为图题理解正确的证据。
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

M04有限cross/RRF与父来源最后栅栏；M10模型本地预算/降级/版本/隐私；M12新冻结模型发行闭包。S6完整视觉与S7规模仍OPEN。

本轮build/typecheck exit0、renderer217/217；实际冻结模型5项（含独立16例质量），源类/SQLite重排8项、原检索17项回归通过；Electron4项/2启动/0renderer错误，实际文件夹导入、并行新资料导入时仍返回原题意结果、同题本和硬过滤、模型冷重启/事实hash保持。发行资源预检四套包逐文件通过；重排包157文件399017988字节，当前main SHA256 ec96ae05619e425ab5de30919fd2fd12a3aadb72e7714c08a48c76808f45f80a。详情见KB_IMPLEMENTATION_EVIDENCE.md。

整体Goal继续active。下一主线优先完整图文题/Word来源表示与归档、跨页/答案配对、可选视觉AI；随后旧代缓存GC、自然教师质量与长上下文/冷启动优化、40GB持续处理与统一最新EXE。当前合成质量/小型路径不能冒充企业级或全目标通过。当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；全目标完成后读取最新main、保留协作者变更并处理冲突。
<!-- kb-rerank-20261026:end -->


<!-- kb-semantic-20261026:start -->
## 2026-10-26 本地混合召回与批量索引（整体继续实施）

S5-A与S5-B1已接通本地题意检索和有界批量索引：冻结BGE中文embedding、LanceDB派生向量、FTS关键词RRF融合，资料库/同一题本/小智工具共用来源复验。教师可按改写题意查询、暂停/继续/重建；无系统Python或运行时模型下载。每批最多16事实、200000 UTF16字符及900KiB JSON，双文档编码穿插查询，推理后批量提交、receipt最后、事件批尾ACK。旧seq不能复活墓碑。

M04现有本地embedding/混合召回与硬过滤下推；M05题本按题意入口；M10来源闭包/隐私/版本和批量预算；M12新增冻结embedding EXE与资源manifest。完整检索质量/规模、视觉AI和最终发行均未因此完成。

本轮最终证据：build/typecheck exit0；renderer217/217（本轮UI修改后的组件门禁）；真实冻结ONNX+Lance原生8项、源类/SQLite受控边界17项、Windows实际多进程写锁3项。独立审查所报隐私、迁移中断和新旧版本竞争已修复并复验。Electron原主路径5项/3启动，派生索引损坏恢复3项；最终新构建另冷读5项，1366/1920界面及来源迁移43个对象追平。最终main SHA256 1e226913cceaf85efab934bc4e2d0c15754bd0f60a321e1c94ade9ae90e8ea66。精确命令、实例和范围见docs/goal/KB_IMPLEMENTATION_EVIDENCE.md。

完整目标继续active/DOING。当前实际向量搜索仍FLAT，尚无交叉编码器重排、自然教师holdout的Recall/Precision或百万级CPU P95证明；16条小样本批量通过不是40GB证据。下一位置：索引维护/ANN/重排与质量门槛，完整图文题/DOCX图公式锚点/跨页与答案册配对、受管本地视觉AI包、自然资料与40GB持续处理，最后统一EXE发行和main集成。旧NSIS不含当前源码。不得把本地embedding包称为本地视觉AI整理已完成。
<!-- kb-semantic-20261026:end -->


<!-- kb-pdf-20261024:start -->
## 2026-10-24 长PDF持续处理落地（完整目标仍进行中）

S2-B已接通长PDF按页持久处理：受管原件同一Windows只读句柄核验SHA，页结果逐条校验/事务落库后ACK；manifest/世代/任务lease与工作进程存活共同守卫发布。原生文字与OCR分别保存，混合页检查原生正文、数字和数学符号覆盖；needs_review/failed不发布正文。停止保留成功页，继续与显式重试分开。来源预览/layout支持第50页以后、直接页码跳转及已打开预览跟随引用。原件上限16GiB、10000页与单页/暂存预算是设计边界，未宣称已测极限。

M01/M02/M03新增有界分页与恢复、来源预览及显式重试，M04可查询已发布的partial完整页并报告覆盖缺口，M05有界窗口接续。S2所有格式完整性尚未完成；S6 AI自动定稿与S5语义检索仍未交付。

当前真实证据：固定新runtime 646文件/279039929字节，无新模型或Python依赖；61页/56272644字节明确合成混合PDF，1644453字符正文，59页完成、1空白、1超限失败，partial可检索。Electron主路径5项/2启动/0renderer错误；另3项来源跳转/双视口检查，旧S3数据库副本3项兼容读回。build、最终typecheck、renderer217/217、发布守卫4项和原生/OCR覆盖5项通过。精确记录见KB_IMPLEMENTATION_EVIDENCE.md；这不是自然教师资料质量、40GB规模或新安装包验收。
<!-- kb-pdf-20261024:end -->

<!-- kb-implementation-20261024:start -->
## 2026-10-24 知识库功能实施进展（整体未完成）

M02：S1批次/目录与文件持久化、异步复制、暂停/重启接续已实现。M04：S4-A SQLite全文候选、中文短词与公式字符规范化、旧正文补建、教师查正文/来源跳转、Pi共用检索已实现。M03/M05复杂切题与独立题答/图配对、S5 embedding、S6 AI定稿仍未完成。

当前入口：启动知识库开发版.cmd（npm start -- --knowledge-preview），业务数据位于%LOCALAPPDATA%/Xiaozhi-KnowledgePreview/data，profile独立，避免与日常窗口混用。未修改D:日常运行目录，未重打旧安装包、未提交/push/上云。代码、typed preload、资料UI已同步。必要路径使用151份嵌套资料验证暂停/重启/继续，全文尾部命中并打开第92段来源；151份正文ready、242段已索引，详细日志/限制见docs/goal/KB_IMPLEMENTATION_EVIDENCE.md。
<!-- kb-implementation-20261024:end -->

## 2026-10-26 main交付与用户指定分支清理

UI提交ce98bd1已成功推送origin/main，旧锁阻塞已解除；本轮build、renderer217＋样式8、合同25通过。用户指定的GitButler与orch-t1-paper分支已备份清理，D盘619个未提交文件及知识库工作树保留；未将大范围未提交内容冒充已合入。详见 `../audit/branch-integration-2026-10-26/README.md`。既有10月24日运行证据保留，不宣称本轮重跑provider；Master与整体业务UI精修仍DOING。

## 2026-10-24 已批准UI基线的正式替换

用户已确认统一亮色布局及过程→整体折叠→正文时序。正式展示已在同一1c54工作树接入；真实流程与样张证据分开，仍不把外壳迁移等同全部领域业务验收。M10展示切片、测试边界与main合并状态见 `../design/ui-rebuild-2026-10-24/DELIVERY.md`。Master仍DOING，本地优先、教师确认、Pi唯一编排与来源规则未变。旧记录保留为历史，当前以本段和最新交付为准。

## 2026-10-24 当前：撤回UI对齐结论，建立重建审阅基线

用户明确否决前轮UI；旧测试结果不能继续作为视觉接受。已只读复现旧真实构建并记录11处CSSOM，证实旧玻璃主题/无layer外壳规则继续覆盖原厂；旧应用AgentTrace组合也不等同官方示例。已在同一1c54工作树保存177文件回退快照，建立15页合同、原厂示例对照/组件指纹、可点击Electron审阅稿。合同检查21项，样张22项/0pageerror，renderer217＋隔离8通过；本轮未替换正式业务页、未发新provider请求。已询问整体视觉与过程组合，等待用户确认，不擅改组件配置。main/远端仍b5a7fc6；旧空锁仍在，先前清理被自动审批拒绝，未提交推送。详见 `../design/ui-rebuild-2026-10-24/README.md`。 本轮不变更Master的本地优先、教师确认、来源与Pi唯一编排规则；总体DOING。

## 2026-10-23 当前：官方Agent Trace Streaming与正文体验

本轮用户明确取代DSH预览：采用官方多块/嵌套组合，运行展开、整轮终态收起、正文独立流式；删除输入上方额外遥测，目标控件迁至侧栏。普通解释自然段落，必要任务结构保留。最终真实Electron25项、原厂亮色双尺寸与控制台通过；边界16/轨迹19/renderer217＋样式7、技能25/22/14、兼容旧路径207通过。没有新SDK循环/依赖/DDL/IPC，权限与教师确认保持；Windows原生路径解析只替换等价调用、不缓存授权。首段仍有约6–7秒本地准备延迟，整体视觉/性能和Master仍DOING。Git main交付尚受遗留index.lock阻塞，清理被自动审批拒绝。证据与精确命令：`../audit/chat-ui-2026-10-23/AGENT_TRACE_STREAMING_DELIVERY.md`。


## 2026-10-23 最新：M10 DSH披露策略

原modelReasoning真实数据保持；renderer每段默认收起＋本地真实首行预览，全文按需挂载；手动阅读保持、实际工具独立、泛用遥测不铺聊天。未改backend/shared/DDL/vendor。真实21项与完整207通过，原厂亮色保持；详见DSH_REASONING_DELIVERY.md。

## 2026-10-23 最新：M10模型推理展示

API reasoning_content经SDK thinking_delta进入主进程脱敏桥/独立typed事件/modelReasoning投影，既有assistant metadata版本化保存；原厂ChainOfThought展示实际返回文本与真实推理段状态、独立计时。原生SDK保留工具回传，正文/导出保持。真实Electron17项与原生块哈希对照通过；无新增循环/依赖/DDL/IPC，原厂亮色设计保持。详见MODEL_REASONING_DELIVERY.md。

## 2026-10-23 样式审计与公开阶段补齐（当前）

M10增量：原厂CSS保护边界与固定亮色；可选publicStages/traceSequence记录并持久保存真实公开阶段，traceElapsedMs按宿主完整墙钟计时；正文、教师卡、来源和回复动作保持。无新循环/权限/依赖/DDL。旧记录无阶段不补造。 证据：`../audit/chat-ui-2026-10-23/style-audit/DELIVERY.md`。

## 2026-10-23 Agent Trace Streaming

M10复用现Pi publicItems/activity/usage和Pro ChainOfThought，增加按轮公开过程、终态折叠/重开与持久耗时；M09回复动作与来源保持。无新循环、DDL、新IPC权限或依赖。工具/教师确认卡来自真实运行，旧记录缺耗时不造数。 详情：`../audit/chat-ui-2026-10-23/AGENT_TRACE_DELIVERY.md`。

## 2026-10-23 UX-00测量入口

M10测试能力增加正式Electron基线脚本test:ux00-baseline；复用现main/preload/SQLite与教师导航，记录M04/M06/M07/M08/M09入口而不新增领域能力。100/1000条合成历史用于压力，无真实模型/用户事实含义。结果及后段未测清单见 `../audit/chat-ui-2026-10-23/ux00/RESULTS.md`。

## 2026-10-23 对话体验增量

M10：会话本机草稿、真实准备/等待/响应阶段、读/查工具结果摘要、部分结果持久化与继续草稿；M09：回复Markdown预览确认保存到既有教学文件并回原会话；M04/M05：已知空范围入口不提供给当前请求，真实正文读取才作回复依据。数学在聊天/保存预览/教学文件详情可读。范围及23项正式Electron证据见 `../audit/chat-ui-2026-10-23/DELIVERY.md`。任务/资料/成果统一、跨域导航与学生中心仅为下一轮规划。

<!-- kb-s6-current:start -->
## 2026-10-12 当前：KB003扫描资料按页接续限定接受；功能优先

<!-- 以下保留 D 盘停写前的历史记录，供业务追溯；当前状态以上方 main 记录为准。 -->

## 2026-10-21 题目图片 OCR 与练习

|能力|证据|边界|
|---|---|---|
|本地图片OCR与教师校正|原生11/11、正式UI12/12|手写/公式准确率未验|
|校正文字进入Pi|只读脱敏文字，原图/base64不入native|不替代讲解正确性|
|题库变式与少练|真实Pi 9/9，两题保存、来源谱系、冷恢复|仅分段，不是图片起点联合链|
|教师等待预算|审阅等待暂停activeMs，waitMs仍限制|需联合实例验证|

## 2026-10-21 资料备课保存与状态写入

|能力|限定证据|边界|
|---|---|---|
|附件实读与年级备课|日常profile真实DeepSeek，随机码/37/8/来源；五年级备课稿|不证明教师独立使用|
|改稿审阅与保存|`daily-KNUJxO`不中断5/5；7085字节文件/review hash一致；12次HTTP200|不证明教师独立使用|
|冷启复用|同会话变更applied，文件面板重开，0模型重放|不含安装包/无VPN|
|并发状态写入|正式Store并发16/16，task-plan17/17|不扩宽业务写权限|

## 2026-10-21 教师答复误停修复与主线收紧

H05-C2a：实际教师答复来源读回＋v2单列输入进展＋纯聊天草稿原教师确认，正式UI5/反例23/原进展16/退出回归10通过；68事件/4原生回执独立对账。仅此范围LIMITED_ACCEPTED，排队指令交接/编辑撤回/旧task歧义、完整H05与真实NETIMGFILE仍OPEN。主线顺序改见FEATURE_FIRST_EXECUTION顶部，原H01–H10未删减。

## 2026-10-21 等待审批退出崩溃：限定修复验收

退出治理已接main IPC准入/在途drain＋原生产者取消＋SQLite关闭；pending三种退出/冷启10、正常审批保存回归7、边界5/5/17，限定冻结构建与SSE夹具。每案46事件/3回执/0批准/无输出与零重放独立对账。证据harness-shutdown-20261021-ipc-drain/progress.json；完整H05-H10、真实NET/IMG/FILE等仍OPEN。

## 2026-10-21 H05-C1授权资料定位

|能力|当前实现/证据|边界|
|---|---|---|
|不同目录推进与同源去重|实际IO sourceIdentity＋当前lease/native/快照；原生7、Hana/FS反例19|中间定位进展，不代替正文或教学正确性|
|定位与最终成果隔离|中间changed目录unknown保留；最终只核真实正文/批准保存，原稿改稿14回归|纯教学草稿/教师补充策略仍OPEN|
|持久与可见范围|166事件/11回执/进展key与文件独立对账；浅暗双尺寸4图已看|SSE非真实provider；pending关闭native fatal另立待归因项|

完整同构建门禁和未验范围见harness-h05c1-20261021-discovery-delivery/progress.json，不关闭完整H05或原NETIMGFILE。

## 2026-10-21 教师验收要求增删与版本来源

|能力|当前实现与证据|边界|
|---|---|---|
|增删/重排教师标准|原typed correction、宿主新ID、保留项稳定；原生7/边界12/浏览器22|SSE模型，不是provider/独立教师认证|
|机器核验与审批保护|机器资源/依赖保留、旧checks失效；容量/假ID/事务/脱敏反例及同构建原稿改稿14|完整H05泛化进展/歧义迁移仍OPEN|
|持久化与恢复|68事件/2run/3回执、action/候选/历史/native前缀独立核对；浅暗双尺寸4图已看|完整H09、原NETIMGFILE不提升|

精确门禁及30745e68冻结构建见harness-h05b2-20261021-criteria-final/progress.json。

## 2026-10-21 新要求恢复/重新审批改稿

|能力|实际证据|边界|
|---|---|---|
|原稿读取→同轮批准改稿→新版教师确认|a755原生14、store8、input链17及独立257事件对账|SSE模型，真实Pi/文件/SQLite；不是provider/原NETIMGFILE验收|
|历史输入范围|file_before_edit核原始SHA/脱敏全文/before→after与当前权限；5张原生图已看|不能当当前file标准；普通当前读取仍单独核验|

精确门禁见harness-h05b2-20261021-goal-revision-delivery/progress.json。完整B2仍IMPLEMENTING，下一教师要求增删。

## 2026-10-21 正式目标与任务统一核验对账

|能力|当前实现|证据/边界|
|---|---|---|
|原教师多项标准|goal-binding主进程digest、固定goal_requirement_1至8，与运行revision分开|边界15含8项/旧version/源变化；非模型自定标准|
|单一确认权威|旧goal accept→acceptGoal→TaskTeacherActions/当前proof|正式Electron9；缺机器proof拒绝整次动作，不留部分human通过|
|修正要求同步|task/goal.criteria/state/action/history/复合公共事件同事务|真实Goal+Task store8；native实际改稿要求/冷启，尚未验新要求恢复改稿全过程|
|正式目标恢复|启动前只读核历史→原host.start→同task新run/原生效果重查|native9与普通resume8；多legacy task冲突停在未验迁移边界|
|教师可见核对卡|PiGoalControl复用PiTaskReview，旧重复入口隐藏；过期卡须刷新|4张真实浅暗/双尺寸图已看，1366聊天高度压力仍待H09|

当前52cc35ab/373文件/144源码，type/原npm隔离build/renderer234通过；最终全门禁见harness-h05b2-20261021-goal-task-delivery/progress.json。完整B2仍IMPLEMENTING，真实provider与原NETIMGFILE/其余Goal未因本片通过。

## 2026-10-21 v3准入/恢复能力对账（完整H05-B2仍IMPLEMENTING）

|能力|当前接线|验收与边界|
|---|---|---|
|任务级v3计划/标准/步骤|宿主来源、资源、digest；原Pi beforeDelivery；公共task/typed步骤卡|原生XIm1Bf7/7＋边界16；模型流受控，真实provider待验|
|显式继续剩余步骤|task-resume→原host.start；同身份新run、command精确幂等、lastRunId|gAXC7k8/8，含冷启、改文件阻断和只保存剩余文件|
|历史效果重查/最终核对|旧native/settled receipt＋当前文件/权限；跨run proof与原call权威|113条journal独立hash、实际两个保存文件/action一致；不能推断科学正确|
|旧版本兼容|旧d7二进制会话恢复到v3，旧native前缀不变|XIm1Bf＋v2plan21，legacy207仅历史教育兼容|
|正式goal多标准/通用进展|原goal入口保留，普通task恢复不假装涵盖|未完成，下一合同；原NET/IMG/FILE等保持OPEN|

最终同构建44d3dfc4，373文件/143源码hash；renderer234、真实store8、type/原npm隔离build通过。完整报告harness-h05b2-20261021-resume-delivery/progress.json；无新依赖/DDL/密钥/网络改变。浅暗/双尺寸8张原生图逐张已看，单run历史完整性与跨run任务确认的提示层级待H09优化。

## 2026-10-21 教师科普课件切片

|能力|实际接线与复用|证据边界|
|---|---|---|
|教学文字随演示保存|有界shared teaching→Anatomy SVG metadata→原审批/文件→固定HTML|专项6项；真实SQLite、合成会话/教学内容，不是模型/教师验收|
|教学课件导出|同一数据→原PptxGenJS/GIF/typed文件导出，学生页与教师备注分离|正式Electron8项，0新provider；Office最终见ANATOMY_TEACHER_PPT|
|低门槛自然语言备课|工具schema提示沿用对象/知识点，不询问编码坐标|真实模型自动选工具、真人教师仍未验；旧产物维持通用页|

## 2026-10-21 H05-B2生产接入能力（IMPLEMENTING）

|能力|当前实现与证据|边界|
|---|---|---|
|普通原请求核对|main coordinator→公共task事件→typed IPC/preload→PiTaskReview→SQLite；旧402实际UI6项|一个human原请求标准，非完整逐step核验|
|人类修正与版本|真实store8项、实际失败页修正/冷启；旧确认清空|增删标准及显式goal多标准同步未交付|
|当前结果重查|原native/settled receipt与当前权限文件/effect适配器；专项10项|声明native/SQL夹具，真实正面模型文件确认待额度恢复|
|失败隔离|坏task只提示不可核对，对话保留；异步身份/版本与同步门控浏览器11项|不把未知状态变通过，不重放效果|

构建d7a4d71b（373文件/134源码）与精确分层证据见harness-h05b2-20261021-product-review/progress.json。原TASK-03/04/07仍红，所有原OPEN门禁保留；以下未生产导入描述为历史时点。

## 2026-10-21 H05-B2 教师动作与要求版本（IMPLEMENTING，未生产激活）

在任务存储基础上新增tasks/teacher-actions.ts、tasks/task-evidence.ts及shared教师动作输入验证。主进程方法将确认绑定实际已保存assistant成果、成功run、公开内容digest和criterion版本，独立action回执与task/history在同一SQLite事务保存；同request精确重试不再读文件或写第二份确认。教师全选不能覆盖failed/unknown/缺失的系统核验，拒绝可直接记录。修正现有要求文本形成新来源/版本，保持task/step身份、清空旧checks并暂停；不是模型改标准。恢复把旧教师确认标unknown，需重新确认当前成果。

源/效果检查复用现生产result-readback，由main-only recheck回调取得当前证明；缺回调不因缓存passed而验收完成。已补跨run相同资源的旧效果防重放；dDyWJz反例证明换/退役stepId可绕过旧保护，现准入固定criterionIds，独立读回不依赖当前步骤名称。旧无此字段记录只按仍存在的原映射核对，不补造历史关联。没有模型循环、DDL、新包、vendor或凭证变化。

本轮教师动作1cQfRN 26/26、任务存储9ITW2s 27/27、结果读回bxBVvf 26/26、v2计划IQrmDh 21/21、renderer234/234、type/隔离build/diff通过。独立核对action回执hash、实际成果内容digest、修正来源和文件字节；数据库重开一致。注意这些是main-only方法、实际SQLite/本地字节＋声明native/effect夹具，不是真实教师点击、provider或Electron恢复证明。当前生产v2反例tlTVT2仍TASK-03/04/07三项失败。

当前构建仍69edc5296350a39aadf38d030918ea1d5a51b617690883194101abded7e4a5f2（373文件，127项源码hash一致），因为任务模块仍未导入生产。整个B2不能标LIMITED_ACCEPTED。精确命令/脚本和源码hash、独立读回、原失败及边界：apps/desktop/test-results/goal/harness-h05b2-20261021-teacher-authority/{progress.json,commands.ps1,collect.mjs}。日常out/profile未替换，无新真实API/UI请求，无提交/push。

下一动作必须接真实纵向链：普通请求及显式goal的来源/标准→task coordinator→committed task事件→typed IPC/preload→可见核对/修正UI；原Pi beforeDelivery/跨run恢复接当前权限的native/effect reader。当前只支持已有human criterion文本修正，增删标准与正式goal来源同步仍需adapter；探索/草稿/教师补充进展政策及完整TASK-01–11仍未完成。原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工、完整H05/H08/H09/H10/H07国产认证继续OPEN，Goal ACTIVE。



## 2026-10-21 H05-B2 任务存储与准入基础（IMPLEMENTING，未完成）

新增shared/xiaozhi-task.ts、main/xiaozhi-agent/tasks/task-state.ts；复用现app_settings独立xiaozhi.task.v1:命名空间，当前文档/会话索引/不可变版本在现SQLite事务中CAS，零DDL。实际用户消息、command和journal owner绑定稳定taskId、来源版本、criterion与step；模型completed只作报告。准入冻结call/step/标准/计划版本，检查实际前置核验、工具/资源范围；已准入调用不能因重建边界再次派发。暂停/归档/旧generation拒绝迟到；显式新run保留身份并把旧效果标unknown等待重新核对，不执行历史效果。

本片仍未接入production-host/Pi start与resume/public task journal/typed IPC/UI，教师逐条确认来源与标准修改也未交付。现生产v2基线GnQAZi的TASK-03/04/07仍3项失败，必须继续修，不能用新模块专项绿测关闭。TASK-07当前仅真实nativePlanId函数身份层反例，不是Electron冷启。全合同docs/goal/H05_TASK_STEP_ACCEPTANCE_CONTRACT.md保持完整，状态IMPLEMENTING而非LIMITED_ACCEPTED。

本轮新模块真实SQLite/原执行边界＋自有合成工具专项APD5j2 27/27，v2计划兼容21/21、renderer234/234、type/build/diff通过；数据库重开与不相关配置原字节保持。首反例lNvg8r（重复准入）、Uy89QG（读步骤挂写工具）、cRdlvZ（同run改绑task）保留并修后重测。原配置隔离构建69edc5296350a39aadf38d030918ea1d5a51b617690883194101abded7e4a5f2，373文件、125项源码hash一致；SHA与B1相同，因为新模块尚未被生产入口导入。这不是功能已交付的构建。无真实provider/Electron任务路径新验收、无日常out/profile替换、无新包/vendor/凭证/DDL/提交/push。

精确命令、当前脚本hash、源码回读、独立SQLite审计、当前生产仍失败的基线和全部边界：apps/desktop/test-results/goal/harness-h05b2-20261021-storage/{progress.json,commands.ps1,collect.mjs}。下一步先补真实教师确认/修正与旧效果重新核对，再接普通任务/显式goal/恢复、原Pi beforeDelivery、committed task事件、typed UI与完整TASK-01–11验收。原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工和完整H05/H08/H09/H10/H07国产认证继续OPEN，Goal ACTIVE。



H05-B2合同：docs/goal/H05_TASK_STEP_ACCEPTANCE_CONTRACT.md，最新实施/未完成边界以上方IMPLEMENTING为准。

## 2026-10-21 H05-B1 独立证据与有限续跑（LIMITED_ACCEPTED）

本片按冻结合同完成，完整Goal保持ACTIVE。修复C3宿主引用后缀导致真实文件核验项丢失的回归；仅剥离与实际call/tool匹配的固定宿主后缀，其他异常输出显式partial。生产边界通过主进程独立readback并提交verification后计算进展；重复正文、计划/摘要改写、重复来源、web抓取时刻与image用途改写不算新证据。私有去重集合有界，公共提示只说明资料/产物完整性范围。连续3个无新证据边界沿原Pi finishTurn停止；暂停/归档/旧owner/权限版本变化拦迟到回调。等待验收后允许正常最终文字，再继续出工具则明确结束，未增加模型循环。

最终原配置隔离构建69edc5296350a39aadf38d030918ea1d5a51b617690883194101abded7e4a5f2（373文件，123项源码hash本轮收尾复核一致）。正式旧C3构建→当前构建恢复→真实重复读取停滞→冷启→显式恢复去重：iga552 7/7；同一自有profile正常教师备课→读取盲资料→预览→教师点击确认保存→两项教师标准确认→冷启：51guh5 5/5。合计14次DeepSeek HTTP200、5启动、无renderer错误（旧二进制2次请求，当前12次）。独立只读核589条journal hash一致、2次goal_stalled、保存文件hash和旧native前缀一致。四张实际1366×768/1920×1080浅暗截图已逐张查看；提示最小对比度5.39336/7.79543，自然过渡，无强制finish。

native调度27/27、进展16/16、结果回读26/26、保存效果34/34、计划21/21、journal19/19、queue9/9、renderer234/234、同构建legacy207/207及type/build/diff通过。native含受控provider stream，legacy只作历史兼容，二者不能冒充真实provider或日常使用验收。精确命令、报告、源码/脚本hash、独立读回与原失败见apps/desktop/test-results/goal/harness-h05b1-20261021-delivery/{progress.json,commands.ps1,collect.mjs}。本轮复核既有测试产物，未重新请求provider；日常out/真实profile未替换，无DDL/新依赖/vendor/凭证变更，无提交/push。

下一片H05-B2：先冻结任务范围step/criterion/教师来源版本，逐步独立核验、真实工具依赖admission、跨run剩余步骤恢复；模型completed仍只是报告。当前教师goal确认不等于每个step已核验，普通聊天/目录探索/纯教学草稿/教师补充的进展类型未全验。完整H05/H08/H09/H10、H07国产公网认证、原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工继续OPEN；科普教师课件方向保留。



## 2026-10-21 H09-C3 计划版本与实际依据（LIMITED_ACCEPTED）

本片完成，Goal ACTIVE；不关闭完整H05/H09/H10。新增严格plan.v2稳定stepId/依赖/退役ID、公开原因/版本CAS和同call幂等；同run/generation已提交工具回执作调整依据，typed只读历史支持前后比较/分页/重试/定位。采用仅指结构，模型completed仍标“已报告完成”，不能冒充逐步结果核验。snapshot仅显示已提交plan；旧v1字节/native历史身份保持，plan.v2能力另记。Pi唯一Loop，无DDL/新依赖/凭证变更，教师权限/业务事实不改。

最终原配置隔离构建1d529c746dfc90a5e8070e0bda4650468ed60f981932772c3308350730c2270e：373文件、118项合同源码hash收尾一致。实际旧14f414b7构建创建→新构建恢复/继续→教师回答→实际journal写失败→冷启，正式Pi/DeepSeek bWQsU8 10/10、9次deepseek-flash HTTP200、3启动、0renderer错误。独立回读383条journal全部hash一致、3版成功计划、失败CAS无control公开记录、旧native前缀完整。冷启精确视图3gHttU 3/3，实际1366×768/1920×1080与PNG像素×DPR一致；浅暗4图逐张查看、自然过渡，输入/计划原因最小对比度10.02385/5.39336，无新run/provider。

计划21/21、生产组件浏览器8/8、工具边界17/17、journal19/19、receiver10/10、queue9/9、renderer234/234、同构建legacy207/207，type/build/diff通过。legacy与受控组件不作真实provider或日常证明。命令、脚本/源码hash、独立读回及完整边界：apps/desktop/test-results/goal/harness-h09c3-20261021-receipt/{progress.json,commands.ps1,collect.mjs}。

原MYQ2oN/tOAaWH产品反例保留；tOAaWH实际模型引用错误ID后停止推进，修为在既有工具结果边界返回宿主planBasisCallId，仍严格核已提交回执。4q9TTO/3RHtji/pSGEWV/J0vvVU为已解释的测试夹具错误，原报告保留；早期展开/首张尺寸时机不足的图不作最终视觉证据。日常out未替换，正常启动重建源码，无提交/push。

下一片回到H05/H09关键缺口：冻结step→criterion稳定映射、宿主独立回读核验、基于证据的停滞判定及剩余步骤暂停/恢复，沿现Pi turnBoundary，不新增模型循环。源码对账在H09_EVENT_UI_CONTRACT顶部。完整H09其余状态/证据深链/390与768窄屏/DPI/读屏/性能、H08整体FACT/跨域/质量、H07国产认证及H10原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工仍OPEN。教师科普PPT/HTML方向保留，不以本片计划功能代替教学设计验收。


## 2026-10-20 H09-C2 同步与过期操作（LIMITED_ACCEPTED）

本片完成，Goal ACTIVE，不关闭H09整体。已知事件缺口开始即通知并禁用当前会话变更；补齐失败/旧snapshot不能解除，连续journal或权威snapshot恢复。内联审批及试卷/目标/技能portal、queue/send、范围/压缩、附件移除/OCR确认和新科普导出受控，草稿/关闭/Stop/既有请求取消保留；原main权限/revision/CAS不变，Pi唯一Loop，无DDL/新依赖。

最终隔离构建14f414b7cf1c13302a7415078b7da0156faa385f497f5e27d2a77bc67e93809c（373文件、113合同源码hash一致）。正式Pi/DeepSeek kV6nKt 10/10、3次HTTP200、2启动、0renderer错误；实际通知缺口/读取失败阻断、恢复后唯一精确写入、真正旧revision撤销拒绝、同步中Stop与冷启通过。122条journal hash一致且冷启无新增行，实际丢失通知从typed页恢复。浏览器cqlqKr13/13、receiver10/10、journal19/19、coordinator8/8、renderer234/234、同构建legacy207/207及type/build/diff通过；受控领域UI和legacy不冒充真实业务或Pi/provider。浅暗双尺寸4图自然过渡，输入最小对比度10.02385、提示5.39336，无强制finish。

原dMLxCw/RsSs2B产品反例、XnW5VU/X3glDz夹具失败保留。kliWrW虽功能9项绿但暗1366图未稳定，保留原图、不计视觉通过；同构建自然settle复测后接受本片。精确命令/脚本hash/独立核验：apps/desktop/test-results/goal/harness-h09c2-20261020-accepted/{progress.json,commands.ps1,source-readback.json,collect.mjs}。日常out未替换，正常启动重建源码，无提交/push。

下一片H09-C3先冻结稳定步骤/依赖/变更原因/版本及旧v1/native兼容；当前计划只有text/status，control prompt身份级联到memory，禁止前端猜依赖或直接改旧prompt。调查见H09_EVENT_UI_CONTRACT末节。完整H09其余状态/证据cursor深链、390/768/DPI/读屏/性能，H08整体FACT/跨域/质量、H07国产认证及H10原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工仍OPEN。


## 2026-10-20 H09-C1 计划与核对记录（LIMITED_ACCEPTED）

本片完成，Goal ACTIVE，不关闭H09整体。合同与E状态逐条对账：docs/goal/H09_EVENT_UI_CONTRACT.md。PiTaskPlan不再按done重挂：保留无手动选择时自动收合，教师同plan/模式手动选择优先，完成不丢触发焦点；补步骤list/current语义。OfficeVerificationNotice复用主进程已校验的同run evidence引用，给只读操作标签、记录类型与时间，校验标识二级折叠；不新增重跑/批准/文件打开动作、不更改验证事实。无新main/IPC/schema/依赖，原Pi唯一Loop与教师确认保持。

最终原配置隔离构建2c518304284437aa619d18fb99c9900702db875470c6391690f4a5c7c18d68e1（373文件、98项合同源码当前hash一致）。浏览器DviVnk 9/9；正式Electron/Pi/DeepSeek 1r4MLh 5/5、4次HTTP200、2启动、0renderer错误，真实文件读取/计划完成/手动展开与焦点/核对记录/冷启贯通。独立只读journal审计183条hash一致，2次计划同id，verification与metadata/final projection相同且先于终态。原生可见主题zjVOUO 3/3、6视图，输入文字最小对比度11.6475，无强制finish动画；type/build exit0，renderer234/234、verifier SSR10/10、同构建legacy207/207、diff通过。legacy不是Pi/provider证明。精确命令与校验报告：apps/desktop/test-results/goal/harness-h09c-20261020/{progress.json,commands.ps1}。

首反例asxOZ7手动展开在完成后变false保留；kwCXuE原生主题观察被Playwright默认颜色覆盖挡住，清除模拟后通过，未据此改产品CSS或断言旧白色截图唯一原因。实际Pi仅在真实读取后短暂等待下一次模型请求便于键盘观察，没有注入模型/工具/event结果，不作速度证明。正式四张浅暗/双尺寸证据图已逐张看。

仍OPEN：H09计划稳定stepId/依赖/变更原因、gap期间所有变更控件一致禁用、event/cursor及文件证据深链、恢复/unknown/审批/队列/压缩全状态同版UI、390/768窄屏与125/150%DPI、读屏/所有点击区/对比度/焦点及长历史性能。H08整体FACT/跨域/质量、H07国产认证和H10原NET/IMG/FILE/日常无VPN/安装/Office-WPS/人工仍保留。日常out未替换；正常启动会重建当前源码，无提交/push。下一片H09-C2先实测journal gap/reconnect时已显示审批控件是否禁用，核原main revision拒绝与教师反馈；并冻结计划依赖/变更与公开事件关联所需后端契约，不能从前端虚构。H08原对账项必须继续完成，不由H09界面通过关闭。

## 2026-10-20 教师备课PPT导出（LIMITED_ACCEPTED）

用户追加方向是教育辅导教师实际备课/上课、降低门槛。已交付文件面板“导出课件PPT”“导出动图”“在文件夹中显示”，HTML交互保留；PPT内嵌GIF并附同类部件讲解页、可编辑标题/提问/备注。实例5页，不运行HTML交互控件，无插件/系统FFmpeg/转换模型调用；保存到同一授权教学目录，独占写、源版本/工作目录/hash复核，不覆盖已有产物。Pi唯一Loop、原生成审批不改，本按钮为教师显式导出，无DDL。新增gifenc1.0.3 MIT，实际172516字节、无依赖/原生模块，复用pptxgenjs4.0.1。

最终隔离构建e1e08b00dce1a4acbd8687abe991bdae62b1d26301101de5f963c764631f4453（373文件、90合同源码收尾hash一致）。真实Electron tbHJKC 7/7、2启动、0renderer错误；本机PowerPoint16.0 build20430 5/5，真实窗口GIF变化像素均值6.3497并看图，静态讲解页可翻页，原PPT字节不改。独立Pillow25帧/24种画面/8140ms/loop0。领域M0uFHL 10/10（受控生成器，不冒称PPT）、Anatomy NR7vi4 13/13、renderer234/234、同构建legacy207/207、type/build/diff通过。legacy仅兼容旁证；UI重用上一轮真实DeepSeek审批的45实体HTML，未新增provider对话。精确命令/报告见apps/desktop/test-results/goal/harness-anatomy-ppt-20261020-teacher/{progress.json,commands.ps1}。

失败保留：bBD6ss CJS命名导入，KD8c4O宿主脚本字符串语法，8GHkKM真实取消悬挂。已用default导入、编译受检的固定renderFrame函数与WebContents显式abort race修复。同类编号部件合并、淡化非重点表面解决后方部件不清楚；最多6个类别，完整结构仍见总览/GIF。Office早期脚本误用HWND成员的夹具失败保留，最终定位该样本新建的放映窗口，不操作其他用户文稿。

教师说明与可直接打开的真实PPT/GIF实例：docs/integrations/ANATOMY_TEACHER_PPT.md、docs/integrations/examples/anatomy/散热片课堂演示.pptx。WPS发现已安装但KWPP/WPP COM未注册，未改注册或算通过；WPS/网页版、既有课件复制合并人工、其他DPI/安装、MP4、广泛科学正确性仍未验。未改变日常out/真实数据，正常npm.cmd start重新构建后可用，测试目录不作为日常入口。未提交/推送。整体Harness Goal ACTIVE；H08整体/完整H09/H10/H07国产公网及原NET/IMG/FILE/日常无VPN等继续OPEN。下一步回H09-C主题/事件状态/证据入口/键盘核验。

## 2026-10-20 Anatomy 科普绘图与HTML演示（LIMITED_ACCEPTED）

已安装固定MIT上游1482e8469b0a9e0d8cc18ea2740a01423d29ae80，新增“科普绘图（Anatomy）”技能与office_create_science_figure。Pi唯一Loop，box/cylinder/repeat→宿主SVG/HTML→现typed审阅→教师确认→原子保存/回读/撤销；无DDL/新npm依赖。用户追加选型为离线HTML内嵌演示优先，支持播放暂停、进度/键盘、前后步、全貌；SVG静态备用，GIF/MP4未做。结构演示非物理仿真；教师仍核查科学含义。HTML固定脚本、SVG作img、opaque sandbox/CSP隔离，保存文件重建模板而不执行任意HTML。

最终隔离构建f43820f2e46d0e7f4c5bc4db27bde288e3c1180b1f2a9d7aee6864bf655c2bf2，372文件，83合同源码收尾hash一致，许可/manifest打包字节一致。真实Electron/Pi/DeepSeek G5k6xX 8/8、6次deepseek-flash HTTP200、2启动、0renderer错误；实际预览交互/双尺寸可达/确认精确写入/文件面板重开交互/拒绝零写入/冷启无重放。HTML浏览器6/6、SVG浏览器3/3、绘图13/13、技能目录25/25、旧v1迁移10/10、协调器8/8、文本基础20/20；renderer234/234、同构建legacy207/207、type/build通过。legacy仅兼容旁证。截图已逐张看；精确命令、报告和失败边界见apps/desktop/test-results/goal/harness-anatomy-html-20261020-reviewed/{progress.json,commands.ps1}。真实保存的独立示例见docs/integrations/examples/anatomy/散热片.html。

e45NqM/qUUVYo机械绿但视觉/几何错误，orQJXZ严格44≠45，均保留；修正最小角坐标、遮挡排序、repeat精确展开。BXNRYz首次HTML播放观察超时，独立浏览器通过但同场另有Electron兼容验收；G5k6xX显式检查文档visible并使测试窗口前台后通过，未将原失败算成功，也不将并发遮挡推断为已证实唯一根因。两个旧host/API源码脚本因Node24 JSON import attribute加载失败不计通过。

仅本切片LIMITED_ACCEPTED；Harness Goal ACTIVE。H08整体/完整H09/H10/H07国产公网认证及原NET/IMG/FILE/日常无VPN/安装/OfficeWPS/人工仍OPEN。日常out未替换，统一启动器npm.cmd start会重新构建源码；测试目录不作日常启动入口。无提交/推送。下一步回到H09-C主题差异与E_EVENT_UI状态、证据入口和键盘核验。

## 2026-10-20 H09-B 流式选区与阅读（LIMITED_ACCEPTED）

H09-B仅本片LIMITED_ACCEPTED，Goal ACTIVE。最终隔离构建7d275058fb1addb245d0b19832e911aae1490cd53ff14783cc4687021044af47（370文件、63项合同源码当前一致）。实际PiConversationSurface浏览器10/10；H09-A展开jsdom7/7与焦点浏览器7/7；正式Electron/Pi/DeepSeek6/6（VltzC1，1次deepseek-flash HTTP200、2启动、0renderer错误）；renderer234/234、同构建legacy207/207、type/build通过。精确证据：apps/desktop/test-results/goal/harness-h09b-20261020-final/{progress.json,commands.ps1}。

browser-4DTDlq实际鼠标选区在同段增量后变空；父级React快照修复仍m2LPJS失败，因Markdown可异步提交。现OfficeTextSelection在原阅读host保存当前公开正文的两个端点，只在同thread/item且前缀不变时恢复方向；用户新的指针/按键及源变化撤销旧书签，不读剪贴板、不持久化、不加DOM盒或焦点操作。无新依赖/DDL/IPC/main/权限/第二Loop；滚动仍现有Pro+OfficeReadingPosition，未另写滚动控制。

正式实例用真实DeepSeek响应字节（50ms/chunk及marker暂停只改变时序，不造内容），鼠标选前缀→实际增量后保留→真实wheel向上至历史→增量完结不回底→原返回最新→冷启公共turn/run数一致、临时选区为空。冷启网络仅观察ready以后，不扩大为最早启动零网络。组件前插历史原段落偏移仅0.0625px；最初程序化定位与挂载RAF竞争的3MHepg保留，真实滚轮重测通过，未凭该测试假设改生产滚动。

正式浅暗4图、组件浅色2图已逐张看；1366暗色切换截图输入框仍呈浅色，保留为H09-C视觉差异，不能宣称主题完全一致。日常out未替换、未提交/推送。下一步H09-C按E_EVENT_UI核journal→projection→可见计划/attempt/verification/recovery/证据入口逐状态缺口，先复现主题差异并完成状态/键盘可达性；随后窄屏/125%等DPI/读屏/长历史性能。H08整体与跨域FACT/质量、完整H09/H10、H07国产公网认证、原NET/IMG/FILE/日常无VPN/安装/Office/WPS/人工仍OPEN；不重复已验切片冒充整Goal进展。


## 2026-10-20 H09-A 展开与触发焦点（LIMITED_ACCEPTED）

H09-A仅本片LIMITED_ACCEPTED，Goal ACTIVE。最终隔离构建faf3568680f89798452686ded6019b16f17dc8c49fac2326394e016d968cc420（370 files、60项合同源码指纹当前一致）；实际OfficeConversation的jsdom7/7、Chromium组件7/7、正式Electron/Pi/DeepSeek5/5、renderer234/234、同构建legacy207/207，type/build通过。工具单项变组、拆分合并时保留教师展开选择与触发焦点；主动移到其他控件不抢焦点，run/thread隔离。Pi唯一Loop、main/preload/事实/权限不因本片改变。

真实Pi实例iieHTy含三次DeepSeek HTTP200、两次依赖文件读取、持久回执、答案和冷启公共事件读回，2次启动、0renderer错误；自然模型在工具间插入公开说明，所以实际是两个独立段，精确重分组由独立组件层证明。正式四张双尺寸浅暗图已查看（Windows150%DPI）；独立组件fixture四图都为浅色，不能用系统偏好标签冒称暗色。展开是临时UI状态，冷启回默认。构建未替换日常out，未提交/推送。

G2AmYj展开丢失、browser-aFJ2mv焦点落BODY原失败保留；测试观察器/自然分段假设/夹具启动失败单独记，不归咎供应商。精确证据与命令：apps/desktop/test-results/goal/harness-h09a-20261020-focus/{progress.json,commands.ps1}及docs/goal/HARNESS_EXECUTION.md。H08整体、完整H09/H10、H07国产公网认证、原NET/IMG/FILE/日常无VPN/安装/Office/WPS/人工均OPEN。

下一片H09-B先冻结公共事件流阅读锚点与正文选区合同，真实浏览器复现用户向上阅读时新增事件是否拉回底部，再最小修复并从正式Pi流验收；保持本片7/7门禁，不重新重复H08已验切片。之后补事件/核验提示、键盘读屏及窄屏/DPI；H08广泛质量/跨域/FACT攻击和H10日常原失败仍必须补验，不能由UI绿测关闭。服务统一事项沿docs/integrations/SERVICE_REQUESTS.md，当前只需百度AppBuilder国内搜索只读MCP凭证，未代开付费账户。


## 2026-10-19 H08-C 当前结果（覆盖中间构建与收尾状态）

H08-C LIMITED_ACCEPTED，Goal ACTIVE，H08整体/H09/H10及原NET/IMG/FILE仍OPEN。最终隔离构建16ab8e4a78fde74e330851a45ef7967267e446430367457fa5e3e337876ab7ad/370文件，56项合同源码指纹仍一致；领域FnrQKy 24/24、正式Pi/DeepSeek yMz4NE 9/9、2次启动、0renderer错误，组件217、呈现17、候选25、隐式18、明确8、type/build/diff通过。实际文件/已选记忆→工具回执与已提交事件身份核对→设置显示/原版本回放/显式复核→来源修订与撤权失效→SQLite与冷启动贯通。当前8张双尺寸浅暗截图已逐张查看。

保留VqB3Km首次shadow 8015ms无HTTP响应，原脚本/配置/8秒限制复测才9/9，不能称网络稳定；mq1zgU/d1WTwI/VS9eDt首失败也保留。32ec85构建legacy207是最后journal核对补丁前的兼容旁证，非当前同构建Pi证明；已核唯一main源码差异为route-observation.ts、renderer/preload字节相同。日常out未替换，未提交/推送。

下一步：逐条对账H08剩余跨域/FACT/更广质量要求，补缺后进入H09真实事件UI；首个界面反例为ToolStep/组随attention更换key可能丢展开状态，须冻结合同与组件交互反例后修复。H07认证服务待统一账号配置，原日常/无VPN/安装/Office/WPS/人工及教育DT-05独立。精确证据：[Harness执行记录](HARNESS_EXECUTION.md)与apps/desktop/test-results/goal/harness-h08c-20261019-journal/{progress.json,commands.ps1}。

## 2026-10-17 H08-B 本线程 Harness 续接

H08-B LIMITED_ACCEPTED：候选来源/学生与goal绑定→原评估/留出/采用/撤销→typed设置查看/本机复核/拒绝已贯通；整个Goal ACTIVE，H08整体仍OPEN。当前构建414cc39a.../370 files，领域25、正式采用12/拒绝及学生绑定5、组件217及type/build通过；隐式18、明确8、决策17及同构建legacy207回归通过；51源码指纹仍一致，diff exit0。原98ttpM真实失败揭示末尾摘要与页面不同，现从同一durable公共turn评估，原失败库只读比对相同；其余首失败保留。已查看采用/拒绝8张双尺寸浅暗截图。精确SHA、通用回归最终结果、命令、失败/边界和下一片H08-C统一见[Harness执行记录](HARNESS_EXECUTION.md)。本次不改教育DT-05顺序；H07公网、H09/H10、原NET/IMG/FILE/日常无VPN安装仍OPEN，日常out未替换。

## 2026-10-17 H08-A 本线程 Harness 更新

新增的限定能力：真实Pi偏好选择→版本/来源摘要持久审计→typed IPC→设置记录→离线原规则回放→手动DeepSeek shadow对照。17项领域与11项实际Electron检查覆盖失败/恢复/撤销/冷恢复；仅五项标量上云，无tools/第二Loop。spec v2使用实际非空偏好，v1历史不重解释。完整候选生命周期、路由优化、教学质量基线仍OPEN。构建、命令、截图、通用回归与下一片见HARNESS_EXECUTION；不覆盖DT-05及原NET/IMG/FILE。

完整记录：[Harness 执行合同与验收](HARNESS_EXECUTION.md)。服务申请：[服务配置清单](../integrations/SERVICE_REQUESTS.md)。

## 2026-10-17 本线程 Harness 续接

H07 首片 LIMITED_ACCEPTED，整体 Goal ACTIVE；不覆盖独立教育 DT-05 队列。当前构建 23574a1364dc4d12b96fd7f50f6c00f912d1e89635c4eb0441fc63cd84cf5bad（368 files）：MCP专项28/28、正式Electron/DeepSeek/Pi8/8、renderer217/217、type/build exit0。真实公开课程 HTTP 测试服务已贯通设置/授权/调用/attempt/native/SQLite/冷启，失效服务不阻断内建工具；stdio在实际子进程边界测试通过。

修复了Pi active-name白名单遗漏、动态工具污染固定memory fingerprint、初始化失败连接释放和多慢服务耗尽初始化期限。207项legacy回归属于期限补丁前1e5e00ac构建，仅作兼容旁证。BoardUI6文件原/适配hash一致。日常out未替换，国产公网认证（预检401）、原NET/IMG/FILE、无VPN/安装/人工及H08–H10仍OPEN；原ypzvPF、4ygUTX失败保留。

完整证据与精确命令：apps/desktop/test-results/goal/harness-h07-20261017/{progress.json,commands.ps1}；详见 docs/goal/HARNESS_EXECUTION.md。服务统一申请清单：docs/integrations/SERVICE_REQUESTS.md。下一步H08：核固定mu DecisionSpec/ledger与现偏好候选/CAS、memory scope，冻结合同后接可回放shadow决策及评估/晋升/回滚；H07公网配置单独补验。未提交/推送。


## 最新交接（2026-10-17｜上下文压缩）

本节覆盖下方旧快照的“当前/下一步”描述；历史证据保留。Master ACTIVE，Phase 4/5/6 DOING。智能组卷按用户要求移出当前队列；三主线为 DeepTutor、OpenMAIC、Hermes，当前教育唯一执行项为 DT-05。

- 已完成的限定切片：EV-MAIN-02 9/9；DT-03 read/review/history/concurrency 与 DT-04 plan 共43项；DT-05-questions 6/6。均仅按各自报告范围接受。
- 最新已核对报告：`apps/desktop/test-results/education-journey-WsXH6Q/report.json`，`DT-05-review` success=true，17/17，3次启动，0 renderer errors；buildAfter SHA256 `fed5e0bd3f9b3ea8c562c4e1cb185b16a296c1da379d112aa336697a515bc51c`，368 files。命令：在 `apps/desktop` 执行 `npm run test:education-journeys -- --scenario=DT-05-review`。这是2026-10-16已有运行，本整理轮只读取报告，未重跑。
- review 限定覆盖：真实题目来源→Pi/DeepSeek待审核候选→质量阻断/SymPy检查→教师编辑/确认/拒绝→原子保存与父子谱系→题库回读；错误答案隔离、编辑后重新审核、停止恢复、冷启动不重放、确认幂等。不能据此宣称全科教学正确或 DT-05 全部完成。
- 视觉状态：上一轮已查看 edited-dark 与 blocked-light 的1366×768截图；16张截图已生成但其余状态及1920×1080尚未全部人工查看。生成截图不等于视觉验收通过。
- 下一步顺序：补齐 review 关键状态双尺寸视觉检查→`DT-05-practice`→`DT-05-photo`→`DT-05-photo-facts`→`DT-05-photo-cycle`。每片先看首次失败，再修具体缺口；记录当前构建SHA、renderer错误、真实图/公式/答案、SQLite/文件回读和冷恢复，不扩大无关测试。
- DT-05达到上述范围后，继续 OpenMAIC 逐字讲稿/导入，再做三主线联动；Hermes既有明确/隐式呈现偏好仅 LIMITED_ACCEPTED。Harness按 `docs/goal/HARNESS_EXECUTION.md` 独立续接，Feishu S3/NET/IMG/FILE仍OPEN。
- 边界：Pi唯一编排；DeepTutor仅经现有Adapter/Provider；SQLite/文件唯一事实真源；保留教师确认、来源/CAS、student/session隔离、取消/幂等/冷恢复；confidence不等于答案验证。不得恢复第二运行时。
- 工作区：`gitbutler/workspace`，HEAD `e4763a1535e9692f57d0c5bc3cd162ef6fec98f7`，大量并行脏改动；本轮未重新联网核远端，未提交/推送，未改生产代码、数据库、凭证或用户资料。


<!-- handoff-current-20261016 -->
## 最新状态（2026-10-16 21:37 上下文整理）

唯一继续入口：[Goal 当前状态](CURRENT_STATE.md)。Master ACTIVE，Phase 4/5/6 DOING；智能组卷移出当前队列。S2/F02 只读调度于2026-10-16在冻结构建上 LIMITED_ACCEPTED；正式受控实例4/4，12 active+第13排队并与SQLite/journal对账；真实站点/自然吞吐/无VPN未验，见 [调度合同](FEISHU_READ_SCHEDULER_CONTRACT.md)。BoardUI 源码按用户授权复用并保留来源/hash，见 [复用合同](BOARDUI_REUSE_CONTRACT.md)。

H04 工具可靠性：**LIMITED_ACCEPTED**。当前源码注册13/13、47 tools，教育边界365、执行17、预检9、回执15、journal9；日常/安装/无VPN/完整业务仍 OPEN。H05 Goal/Task/Step：**LIMITED_ACCEPTED**。状态24、真实 Electron UI18，覆盖暂停/续跑/教师验收/冷恢复和无重放。

H06 上下文/模型能力：**LIMITED_ACCEPTED**。压缩上下文6、memory epoch17、scope15、模型设置19、host lock6、切换10，DeepSeek目录HTTP200；existing-session compaction、日常长历史/性能、真实图片仍 OPEN。Harness 后续按 `HARNESS_EXECUTION.md` 独立恢复。

已撤回回显型提示/视觉工具注册及伪设置重置/历史入口，保留真实 OCR/教师校正和聊天撤销。EV 评价器 v2 与真实 Pi educationTools 组装回归已修复：领域 18/18、工具注册 3/3、组件 217/217、build 成功；正式 Electron/DeepSeek EV-FEEDBACK --implicit 已 9/9 LIMITED_ACCEPTED，构建 SHA fed5e0bd3f9b3ea8c562c4e1cb185b16a296c1da379d112aa336697a515bc51c。旧 n1lZ85/a7OjDX/3FUjex 失败保留；完整 Hermes 数据飞轮仍未完成。

当前教育下一步：DT-05题目/练习/相似题/学习路径和视觉来源证据→MA逐字讲稿/导入→三主线联动。既有DT/MA/EV均为限定接受；Harness 与 Feishu 保持独立队列。原历史按其当时范围解释，详细SHA、失败报告、命令与边界集中在Goal状态和验收记录。本轮仅保存文档，无生产修改或新模型调用。
DT-05 最新题目来源证据：DeepTutor 固定纯 helper 校验 `verified=true`（revision `f07029cfcf2c8dfccdb671cdfc343db8334f5741`，2 files/104953 bytes）；desktop build 通过；education capability baseline `365/365`；当前 Electron `DT-05-questions` `6/6`，报告 `apps/desktop/test-results/education-journey-TRUAZ2/report.json`。当前只接受题目来源/read path；notebook smoke 因 Electron→Node ESM bundle 的 `child_process` 动态 require 失败而未验，不将其写成生产缺陷或闭环完成。Review/practice/photo/visual evidence 仍 OPEN。


2026-10-16 当前摘要；Master ACTIVE，Phase 4/5/6 DOING。完成范围以 CURRENT_STATE.md 和真实报告为准；历史项目全量对比见 ../archive/context-20261016/docs/goal/CAPABILITY_MATRIX.md（历史基线）。

|能力|现有实现/复用|当前状态|证据或缺口|
|---|---|---|---|
|Agent 编排|Pi production host、原工具/会话/审批宿主|生产主路径沿用|不因本次整理宣称全部 legacy/所有模式退役完毕|
|学习计划/阅读/作答续接|DeepTutor 固定纯领域 + 既有学习 provider|LIMITED_ACCEPTED 子片|DT-03/DT-04 当前构建：read7/7、review11/11、history10/10、concurrency6/6、plan9/9；完整模式/题目/视觉/正确性未全验|
|分步提示与视觉证据|已撤回回显工具生产注册，既有真实 OCR/校正保留|OPEN / 待真实闭环|不是上游迁移完成；源绑定/协助/独立作答仍待实施|
|课堂生成/渲染/编辑/PPTX|固定 OpenMAIC 模块，现 classroom/Office|LIMITED_ACCEPTED 子片|ma-classroom / ma-editor / ma-delivery 历史报告|
|课堂讲义/教师备课稿 DOCX/PDF|固定 SlideCanvas + 现 Office|LIMITED_ACCEPTED|ma-documents-20261015/progress.json；9MIe8g 5/5；图义和答案未独立验证|
|逐字讲稿/导入|上游可复用能力待适配|OPEN|现备课稿不等于逐字讲稿，不整搬 Next/Agent Runtime|
|明确教师偏好|现 app_settings/事务/CAS/protectedContext|LIMITED_ACCEPTED EV-MAIN-01|hermes-20261015/progress.json；hbi02B 4/4|
|隐式改稿学习/留出|teacher-preference-learning，现 Pi|LIMITED_ACCEPTED EV-MAIN-02|正式 Electron/DeepSeek 9/9；fed5e0bd.../education-journey-l9Ym5e；仅覆盖 teacher_presentation_observed.v2，完整飞轮与答案正确性仍 OPEN|
|偏好设置重置/历史|已撤去未验 IPC/preload/UI，原聊天撤销保留|退回未验入口 / 当前UI待正式检查|不保留伪重置/伪历史，不称完整设置功能已实现|
|三主线接缝|同资料/学生/偏好 + 既有 Pi|LIMITED_ACCEPTED JOIN-01|join-20261015/progress.json 保留首失败与冷恢复，不是完整 Golden E/F/G|
|知识库/题库/组卷|现 MaterialRepository/归一/审核/组卷/导出|移出当前队列|用户确认组卷已完成；本轮不扩大为全科正确性或容量验收|
|全科复杂图文/答案可靠性|本地 OCR/校正、专业工具/教师审核|PARTIAL / OPEN|不能用模型置信度或流程运行成功替代正确性|
|安装/容量/无 VPN/完整 CI/全部 Golden|沿现 Master 与 Harness 队列|OPEN|本轮文档整理不构成任何运行验收|

证据目录相对 apps/desktop/test-results/goal/。HeroUI 复用与依赖许可见 docs/integrations/CURRENT.md 及各 evidence/research；许可证、模型和硬件要求不因短摘要自动核准。Hermes 许可原文仍需核实，仅参考候选/评价/回退思想。

## 2026-10-16 DT-03/DT-04 当前构建状态

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

## 2026-10-24 知识库设计基线（未实施）

本轮按用户要求完成源码审计、文件夹自动题库/可选AI深度整理方案及独立AI批判复审。完整方案：docs/research/KNOWLEDGE_BASE_DELIVERY_PLAN_2026_10_24.md；审查：KNOWLEDGE_BASE_CRITICAL_REVIEW_2026_10_24.md；隔离截尾探针：KNOWLEDGE_BASE_SOURCE_AUDIT_2026_10_24.json。用户选择AI定稿入库、正式组卷集中确认；本地/云端均支持，云端每批授权必要页/裁剪图。这是待技术探针验证的设计，未实施代码/DDL/清库/上传/安装；不改变历史验收状态。下一拟议切片S0发行组件探针，未声称40GB/质量/延迟通过。

### 2026-10-24 v4设计补充（未实施）

完整方案§7.1–7.4新增小智连续问答、考点/方法找题和自然语言蓝图组卷。独立AI批判3项并修订复核：宿主持久上下文/跨run别名重绑、蓝图新版本与确定性检查、库存快照/语义标注覆盖的缺额证明；保留现Pi及实读/整卷集中确认/Office链路。只更新设计文档，不改变现实现和验收状态。

- DT-03 只读/审核/历史/并发切片：7/7、11/11、10/10、6/6，报告分别为 `education-journey-uoFHqO`、`JqFKdk`、`crF5um`、`fCqxMu`；当前冻结构建 `fed5e0bd...`，所有实例 0 renderer errors。
- DT-04 两周训练计划切片：9/9，`education-journey-ChIaul`，12 张双尺寸视觉图；真实证据、教师编辑确认/拒绝、错误输入、冷恢复、空档案边界通过。
- 状态保持 LIMITED_ACCEPTED：完整 DT-03/DT-04、题目/练习、视觉学习、Golden F、日常人工、安装/无 VPN仍 OPEN。下一入口为 DT-05。
