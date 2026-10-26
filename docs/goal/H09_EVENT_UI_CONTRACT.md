# H09-C：事件状态与教师可操作性

## 2026-10-21 后继H05-B1状态与下一步

H09-C3后已完成H05-B1限定独立完整性进展/停滞原生终止，原C3宿主引用结果归一化回归已修。正式7＋5真实Pi路径、双尺寸浅暗四图与589条journal读回见H05_EVIDENCE_PROGRESS_CONTRACT和harness-h05b1-20261021-delivery/progress.json。下一片H05-B2先冻结任务范围step/criterion/教师来源与真实执行依赖，不能继续把模型completed当通过；本合同历史C3“下一片”由此条更新。完整H09状态深链/窄屏/DPI/读屏/性能与其他原OPEN门禁保持。


## H09-C3 最终限定结果（2026-10-21）

本合同C3范围LIMITED_ACCEPTED，Goal ACTIVE。最终原配置隔离构建1d529c746dfc90a5e8070e0bda4650468ed60f981932772c3308350730c2270e，373文件、118合同源码当前一致。正式Pi/DeepSeek bWQsU8 10/10：实际旧14f414b7创建→新恢复→三版计划及同轮真实读取依据→教师回答→实际journal失败无伪采用→冷启；9次HTTP200、3启动、0renderer错误。383条journal独立hash/readback一致，旧native完整前缀/身份保留，失败CAS没有公开control。

冷启精确视图3gHttU 3/3：实际inner1366×768/1920×1080与PNG×DPR相符，浅暗4图逐张查看，自然过渡、最小输入/原因对比度10.02385/5.39336，0新run/provider。原正式首张截图未核准实际尺寸的不足由本补测覆盖，不倒推旧图已正确。浏览器MdF5Is 8/8、计划0AiSBp 21/21、工具17/17、journal19/19、receiver10/10、queue9/9、renderer234/234、同构建legacy207/207及type/build/diff通过。legacy只作历史兼容，受控组件不作provider证明。

所有反例/夹具失败保留，特别是tOAaWH实际错误basis ID导致未继续；在既有有界工具结果返回宿主planBasisCallId后严格同run/generation回执核验重测通过。结构采用与模型报告进度不等于逐步骤验证，不能关闭H05；完整后续缺口见下一节与E对账。日常out/用户根未替换，无DDL/新依赖/提交/push。精确命令、构建/脚本/source hash和独立读回：apps/desktop/test-results/goal/harness-h09c3-20261021-receipt/{progress.json,commands.ps1,collect.mjs}。

## H05/H09 下一片源码对账（2026-10-21，未实施）

本轮C3恢复了计划结构与历史，不能关闭F的H05完成定义。下一片优先处理真实步骤核验与有限续跑，再收尾H09其他状态：

- `shared/xiaozhi-goal.ts`目前criteria为`string[]`，教师接受仍是数组下标；新plan稳定stepId尚未绑定这些验收项。必须先冻结目标/任务范围、criterion身份和旧v1只读adapter，不能按中文相似度从前端猜对应。
- `goal-coordinator.ts:createGoalRuntime.boundary`当前fingerprint包含正文、summary、nextStep和evidence；仅改写措辞便可能避开重复计数。新进展应由宿主已提交且经过核验的证据/教师实质修改判定，不能把plan版本增长、工具次数或摘要改写等同于进展。
- `verification/verifier.ts:verifyCriteria`已有同run注册、expectedDigest/version与宿主独立readback接缝，优先复用。C3的basis只证明某个实际工具回执存在，既不是step交付核验，也不能替代teacher/human标准。
- `goal-state.ts.bind/recover`与原Pi native turnBoundary是恢复与继续入口；暂停/恢复会有新run，新plan id按run hash派生。下一片须定义task范围内步骤身份及剩余步骤映射、失效来源重核、旧批准不复活，并验证恢复不重放文件写入；不另写Goal→model while。
- 逐步核验记录至少绑定目标/criteria权威版本、plan revision/stepId、run/generation、真实回读与来源版本。模型只能提出完成，宿主缺证据须保持待核验/需教师，而不能用工具success或最终正文代替。相关证据仍受隐私与教师确认规则约束。

上述为当前源码缺口与下一片合同输入，尚无实现或验收结论；完整H05/H08/H09/H10及原NET/IMG/FILE等范围继续有效。

## H09-C3 冻结交付合同（2026-10-20，编码前）

M10/M12，接H05计划数据缺口。教师可看到同一任务步骤的稳定身份、前置依赖/等待标签、每版公开调整原因、前后计划与关联实际操作，并在重启后查看同一记录。Pi唯一生产循环、教师确认/隐私与业务事实不变。

### 对比与复用

当前control-tools/control-state/journal/typed snapshot已有唯一生产接缝，直接升级；openhanako/lib/tools/todo.ts与todo-compat.ts已读，当前也是三态整体替换/历史重建，没有所需DAG/版本CAS，不能替代本合同。复用已审Pi customTools、现SQLite控制表/journal、现ChainOfThought/原生details，不复制新上游源码/加包/引入第二Loop。

### 版本化边界与改动面

1. shared新增xiaozhi-plan契约：新update_plan必须schemaVersion=“xiaozhi.plan.v2”、expectedRevision（首次0）、完整1–8步（id/text/status/dependsOn）、公开reason、basisCallIds（可空，最多8）。ID在本plan内稳定、主进程验证；依赖只指本版存在的不同ID、无重复/自环/环；至多1步in_progress，前置未报告完成时禁止开始/报告完成。旧revision拒绝，删除ID退役，不隐式改名映射，退役上限64；同一native call和同一规范化输入重试不增加版本，冲突重试不改记录。
2. 新plan metadata存revision/previousRevision/changedAt、proposedBy=model、本次真实callId及已提交同run/generation的关联tool_end回执（名称/成功失败/sequence）。旧schema_version=1计划原字节保留；新计划用现表schema_version=2+严格plan metadata，现v2 instruction兼容。无DDL。CAS覆盖相同旧payload和版本，保留旧read adapter；生产不再把旧无ID输入当新协议。
3. “采用”仅指宿主检查了计划结构/版本，不是执行或教学结论通过。步骤status仍是公开进度声明，UI写“已报告完成/待核验”；不伪造逐步verified、criterion映射或权限。H05每个完成step的独立教学/产物核验及全任务依赖执行约束仍需后续闭环，本片不以结构检查替代。
4. coordinator在计划CAS后提交公共control并等待现publisher flush；snapshot中v2计划只取已提交turn中的完整plan，不把未能写入journal的ledger新值投成已采用。OfficeProjectedItem仅新增可选完整plan字段；旧journal/旧投影不重写。
5. 新只读history输入(sessionId/runId/planId/beforeSequence/limit≤16)，main按现控制记录/本会话run授权、读取有界公共journal并逐条校验hash/身份/版本；typed IPC/preload→PiTaskPlan。历史包含真实cursor、完整前后版本、公开原因/时间/关联操作。缺上一版/legacy无版本必须明确，分页不伪造；展开/定位只读取/滚动，不重做工具。跨会话/异run/篡改/参数错误、读取失败反馈与重试都需验证。
6. native保留旧creation/control/memory及其他历史fingerprint和原prompt不变；在历史指纹检查之后单独添加plan.v2标记及schema hash，旧会话首次新调用显式追加一次。坏标记/降级schema拒绝，恢复不执行旧tool。新增main plan服务/共享schema/历史IPC与组件、适配control/host/projection/native能力标记，现preload和Pi会话为唯一入口，不上传新数据。

### 验收与回滚

真实反例tOAaWH：新模型流程首版与真实读取已发生，但下一版引用了与宿主回执不符的模型侧ID，严格拒绝后未继续到提问，不能计为通过。补工具结果中的有界planBasisCallId宿主引用（只在已验证plan.v2能力启用时，进入既有结果大小/超时/回执边界），schema引导复制而不猜ID；该引用只作候选，后续仍须校验同run/generation已提交终态回执，不把候选当效果核验。旧fingerprint/prompt保持，隔离开发中未交付的v2 schema hash随本次冻结更新；旧v1正式二进制仍用于真实恢复验收。

先留原代码缺少新协议/版本身份的反例；实SQLite参数/DAG/CAS/同call重试/并发、sanitize后复验、retired id、坏hash/跨run/history分页、发布失败无伪已采用；实际Chromium使用生产组件核依赖、稳定row key/键盘/前后版本/旧版/失败重试。正式Electron/Pi/DeepSeek先用上一版14f414b7冻结构建创建旧native/旧plan，再用新构建同隔离profile恢复并产生有依赖和真实读取依据的多版计划，核旧fingerprint、DB/journal、typed历史、可见操作、冷启一致且无重放。全部门禁/图像检查/命令/构建及源码hash绑定，原失败保留；类型/原配置隔离build/renderer/专项/关键路径smoke/diff。

回滚只撤本片写入入口/呈现，须保留v2记录与native读取adapter；旧不认识v2的二进制不得直接承诺可读当前DB，不删除记录、标记或重放旧任务。原NET/IMG/FILE、日常无VPN/安装/Office-WPS、H07国产公网、H08整体、完整H05/H09/H10仍按原合同验收。无新依赖/账号/凭证/真实用户数据迁移。

## H09-C2 冻结交付合同（2026-10-20，编码前）

M10/M12。当前receiver发现缺口只后台拉取，直到失败才通知UI；内联审批卡、已打开的试卷审核弹窗、输入补充和文件导出缺统一同步保护。目标：已知缺口/重连读取失败/过程保存不可用时，教师看到同步状态，依赖当前会话记录的变更控件禁用；草稿不清空、已读正文保留、停止与导航仍可用。全量主进程snapshot或连续已提交事件补齐才能解除；失败不能因promise结束解除，跨会话异步不得解除新会话保护。

收尾检查发现附件整行fieldset会同时禁用既有“取消添加”，而已打开附件的OCR确认在portal中。补同一保护边界：仅包附件移除控件，OCR开始/确认/拒绝用当前同步context显式门控，原文读取/校正草稿/关闭/取消保持；不改变OCR/图片模型能力或原IMG验收结论。科普导出同样只拦新导出，已发请求的取消仍可用。

改动：shared/xiaozhi-event-receiver增加临时同步状态回调与未解决缺口，现typed list/snapshot合同复用；renderer新增OfficeSynchronization context、通用交互fieldset/激活事件保护，接入OfficeInteractionCards、PiEducationWorkspace、OfficeComposer、PiGoalControl/Context入口、科普导出及试卷Modal.Body。现HeroUI组件/vendor复用，不加包。只读来源弹窗保持关闭能力；DOM外portal不靠外层fieldset推定已保护。主进程不改审批语义，实际typed旧revision请求必须返回conflict且零效果，UI明确版本已变。不得用UI保护代替CAS/权限。

无DDL/新持久字段/Worker或上传变更；Pi唯一Loop、既有原子文件保存与教师逐次确认保持。临时门控不写业务事实，不把同步中伪装正在提交。回滚仅本片receiver/UI差量，保留journal、文件、draft和失败报告，不重放批准。模型/目录切换、queue/send、压缩/goal、当前卡片及其变更portal和科普导出均在本片检查；会话导航和只读来源不构成批准。

验收顺序：先留当前receiver/真实组件反例，再实现；覆盖延迟/失败/不完整snapshot、generation/会话epoch、多页/重排/重复、恢复后唯一提交、pointer/Enter/Space与已按下后变同步、草稿保留/Stop；真实Pi/DeepSeek提出文件修改后，仅阻断通知/补齐transport来验可见旧审批与零IPC/零写入，实际journal补齐后正常批准；另直接typed旧revision核main拒绝并readback，冷启不重放。记录隔离build/source hash、精确命令/首次失败/真实与受控分层；type/build、renderer、专项和关键路径兼容smoke、diff。仅C2通过不关闭完整H09/H08/H10或原NET/IMG/FILE。

2026-10-20，从已验H09-A/B及科普课件分支回到批准方案B。前一轮为有效进展，Goal仍ACTIVE。M10/M12，仅消费现journal/projection，Pi仍唯一Loop；不绕过H08整体和原NET/IMG/FILE未验项目。

## 冻结结果与步骤

先核当前代码的journal→公共投影→实际组件→教师操作/证据链，保留缺口；优先复现H09-B所见1366暗色输入框仍浅色，分清真实样式错误与隐藏窗口动画/截图时序。没有反例不改产品。然后补计划、attempt、核验、恢复的可达性/真实证据入口，逐状态验收；不伪造状态或新增前端事实真源。

本轮候选区域：office主题CSS、PiTaskPlan、OfficeToolProcess、OfficeVerificationNotice/RecoveryNotice及其公共投影adapter，只有反例证明必要才改。新增实际Electron主题/键盘检查与状态对账，复用本地已审HeroUI组件，不改vendor。若需跨main/shared/IPC变更，先更新本合同具体范围；当前不增表、不迁移、无新依赖。

## 完成标准与证据

1. 用当前隔离构建复现浅→暗→浅，核nativeTheme、CSS真实值、已稳定动画与截图；1366/1920分别记录，不用主题标签当证据。
2. 每个状态按E_EVENT_UI指出持久来源、投影校验、教师可见文字、键盘入口及验证脚本；缺失明确OPEN，不从存在组件推断闭环。
3. 如有修复，先保存首失败，再同case重测；type/build/renderer/专项及关键路径兼容门禁，当前源码hash与实际构建绑定。实际provider、受控公开事件和纯布局证据分开。
4. 同步Goal四份状态、稳定CURRENT和根四份协作文档。日常out不以隔离测试产物覆盖；回滚仅本轮适配，不删产物/历史/用户数据，不重放写操作。

125/150%DPI、390窄屏、读屏、长历史性能、全部状态的真实provider路径仍按原H09要求逐项补齐；不得用本片主题通过关闭完整H09/H10。

## H09-C 本轮具体修改合同（实现前追加）

源码对账发现计划组件以done作为React key，完成时可能重挂而丢展开/焦点；核验组件已有严格同run证据evidenceIds/callId/digest/time，但界面只显示检查标签，未呈现关联记录。先用实际生产组件浏览器反例验证，再限定改PiTaskPlan和OfficeVerificationNotice两文件及专项/构建指纹清单。

计划保持原无手动选择时的自动收合，教师手动展开/收起在同plan与compact模式内优先、状态更新不重挂触发点，换plan重置；步骤补list/current语义。核对范围内提供只读证据记录，显示主进程现有kind、实际公开操作标签和核对时刻；原始校验标识只在二级详情，缺操作不虚构、异run/无效证据沿原legacy降级，不新增执行按钮、上传、IPC或事实。公共投影仍唯一来源，不能把记录展示当当前重新核验或完整证据打开已实现。

新测试包括实际Chromium手动/默认状态、焦点、键盘、同plan/新plan隔离、有效/异run/无效证据及全核验状态；真实Pi/DeepSeek执行读取→核验记录→冷启回读单列。type/build/renderer与既有关键路径门禁；390/DPI/读屏/完整事件cursor和产物深链仍OPEN。回滚仅两组件差量，不影响已存journal。

## E_EVENT_UI对账（当前实现，不代表全项通过）

|要求|现持久来源→公共投影→界面|本轮证据/剩余缺口|
|---|---|---|
|公开计划更新|plan-service/control-state plan.v2 CAS、journal完整control→turn.plan/typed历史→PiTaskPlan/PiPlanHistory|C3生产组件浏览器8/正式Pi10/冷启精确视图3通过；稳定stepId/依赖/原因/版本/前后比较/已提交工具依据已接通。仅结构采用与报告进度，H05逐步骤criteria/独立核验及执行依赖仍OPEN|
|开始/进度/尝试|H04持久tool receipt与journal tool_start/tool_attempt/tool_end→toolAttempt→OfficeToolProcess|排队/执行时长、attempt与未知效果已有标签；本轮不作全部重试/timeout/unknown的真实UI验收|
|等待确认/补充|control/change/office_artifact及领域review版本→现内联卡片|C2当前变更边界/portal/版本失效已有真实与受控分层证据，C3真实教师回答沿原链继续；完整业务同版审批状态与H10验收仍待做|
|核验通过/部分/未知/需人工/阻断|journal verification→validTaskVerification同run/引用校验→OfficeVerificationNotice|本轮真实文件回读、只读证据记录、冷启和异run反例；不等于教育答案正确性，未新增文件深链或重新核验动作|
|效果未知/恢复|receipt reconciliation→journal recovery→OfficeRecoveryNotice|只读处置/效果标签及不重放承诺在代码；当前未增安全续做按钮，本轮不声称全恢复实例通过|
|结束失败/中断|journal status与metadata/projection→TurnNotice/PiConversationSurface|“重新整理任务”只填草稿不自动重做；其余真实失败/取消/保留草稿/queued各旧证据需H10同版重核|
|缺口/重连|event receiver cursor/generation与snapshot→needsHydration→同步提示|C2增加同步开始/失败门控、跨epoch与旧snapshot反例，真实Pi文件审批/Stop/冷启10及组件13通过；领域portal为受控呈现旁证，event/cursor教师证据深链及全业务同版实例仍待补验|
|主题/键盘/窄屏/性能|现HeroUI+scoped主题+原阅读位置|native可见窗口主题切换无强制finish通过；本文只验计划/核验键盘。125/150%DPI、390/768窄屏/Sheet、读屏、长任务性能、约40px点击区/全部正文对比度/焦点样式及完整逐组件Codex对照仍OPEN|

与Master/H08的依赖：C1是稳定公共事件消费者上的修复，不关闭H08整体；跨域/FACT/教学质量/更广来源组合仍按F和HARNESS_EXECUTION原对账补验。H09后续不得用本表源文件存在当作完成证据。

## H09-C1 最终限定结果

浏览器9/9 DviVnk、正式Pi/DeepSeek5/5 1r4MLh、原生可见主题3/3 zjVOUO、独立journal183条一致、SSR10/10、renderer234/234与同构建兼容207/207通过，type/build/diff exit0。最终2c518304284437aa619d18fb99c9900702db875470c6391690f4a5c7c18d68e1/373文件/98合同源码hash一致。原asxOZ7、kwCXuE失败保留；截图及精确边界、命令、哈希校验见apps/desktop/test-results/goal/harness-h09c-20261020/{progress.json,commands.ps1}。本节只接受C1，表中缺口及原F全部要求不变。

下一片C2先针对同步gap/reconnect与现审批卡冻结反例：源revision未确认时，UI必须明确同步并禁止变更；同时原main仍严格拒绝旧revision。不得通过绕过receiver或伪造“已同步”解决。计划稳定stepId/依赖/变更原因需先核H05实际持久任务契约，再定shared/main/IPC/迁移范围，不从文本猜依赖。

## H09-C2 最终限定结果

14f414b7cf1c13302a7415078b7da0156faa385f497f5e27d2a77bc67e93809c，373文件、113合同源码hash一致。实际Pi/DeepSeek kV6nKt 10/10（3次HTTP200、2启动、0renderer错误）：真实待审文件+已提交但未通知的队列事件构成gap，typed补齐/快照transport延迟及失败；UI强制点击零审批IPC/零写，实际同步恢复后单次保存精确原文，批准前旧revision无法撤销，另一轮gap中Stop无提案文件，冷启不重放。122条journal行/哈希与冷启一致，独立collector确认丢失事件确实由真实typed页取回。

浏览器cqlqKr13/13（内联、键盘按下后切同步、portal、冲突反馈、附件/OCR与两类取消；业务响应受控，不称领域后端/科学正确性通过）；receiver10/10、journal19/19、coordinator8/8、renderer234/234、同构建历史兼容207/207、type/build通过。自然可见浅暗/双尺寸4图逐张检查，输入/同步提示最小对比度10.02385/5.39336，无强制finish；非完整theme/DPI/读屏验收。

保留dMLxCw/RsSs2B产品反例与XnW5VU/X3glDz夹具失败。kliWrW功能绿但1366暗图过渡未稳定，原图不算视觉通过；同构建补自然settle/实际对比度后复验，不据此解释历史用户白composer唯一原因。脚本、命令、完整边界和核验入口：apps/desktop/test-results/goal/harness-h09c2-20261020-accepted/{progress.json,commands.ps1,collect.mjs}。本片LIMITED_ACCEPTED，Goal ACTIVE；下一步C3及H08/H09/H10/原NET/IMG/FILE未完范围不变。

## H09-C3 续接调查（C2结束时的历史基线）

- `shared/xiaozhi-agent.ts`当前`XiaozhiPlanStep`仅text/status，control revision只有instruction的公开投影；不能给现计划前端补造稳定ID或依赖。
- `control-tools.ts`的update_plan是宿主自定义工具，plan id固定run hash，但每次只接完整steps数组；`control-state.ts`计划沿schema_version=1的payload_json覆盖当前值。journal保留完整公共control事件，可复用为版本历史，不再造第二历史真源。
- `pi-session.ts`现controlFingerprint由creation fingerprint、tools与prompt决定，memory fingerprint又包含controlFingerprint。直接更改旧control prompt会影响native冷恢复及记忆身份，不能只改类型/提示词就宣称兼容。
- 下一片先冻结版本化步骤/依赖/变更原因与CAS协议、旧v1计划只读回放和新能力标记/旧native身份兼容方案，再贯通shared→control coordinator/state→journal/typed snapshot→PiTaskPlan。未知ID/自依赖/环/旧revision/异run/重试/旧DB与旧native必须反例；不因本轮C2通过跳过这些数据契约，也不借计划升级扩大教师权限。

本节保留C2结束时的调查记录，描述当时源码，不代表C3当前实现。C3交付与下一步已在本文顶部和HARNESS_EXECUTION更新；C1/C2中“下一片”均为各轮历史续接说明，不覆盖最新位置。
