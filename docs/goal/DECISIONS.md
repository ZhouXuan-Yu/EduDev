# Goal 决策记录

## 2026-11-03 S04 科学资源来源与许可（S04-07 已实现）

REQ-S04-07 已实现｜验收通过｜2026-11-03｜60ecfd8。原问小智/Pi已贯通资源发现、适用范围与许可校验、未许可资源同轮自制替代，以及实际文件随带来源/固定版本/完整MIT通知；原单次文件确认和冷启保留。只新增此项完整通过，累计6/252，WP-S04及Goal仍active。

必要检查一次：源码7、旧Anatomy13/文本7/整包13、245组件、build/TSC、仓库207smoke及正式Electron6通过。正式成功9、含失败共13条本地合成响应，新增付费0。PhET未下载/打包；原失败写入effect_state=uncertain保留，独立文件/草稿计数证明本例无未许可文件，不冒称C04全部已核验。 证据与回退：docs/research/AGENT_SCIENCE_RESOURCES_S04_20261103.json；docs/research/evidence/science-resources/20261103/manifest.json。

下一推进S05错因证据/教师修正/针对练习/复测→S06跨产物一致→T；完整FX08安装故障矩阵、自然教学、Office/WPS与安装仍留集中验收。回退停止新resourceId写入，保留可选身份读器、已有文件/来源/教师事实；无迁移，完整二进制降级未演练。

## 2026-11-03 S04 精确浮力模型驱动离线探究（工程子项已实现）

原问小智/Pi现可用完整题目条件生成自包含浮力HTML，复用已有精确模型联动数值与图示；4N临界不虚构深度、5N分清自由合力与触底支持。变量隔离、原始重置、键盘、单计时器播放/暂停、五步探究及折叠教师答案可操作。沿原单文件/整包一次确认、hash与冷启，无新表/DDL/IPC/依赖/Agent/审批。 源码5、旧文本7/整包13、245组件、最终build/TSC、仓库一次207smoke及正式双尺寸/实际文件/冷启8通过；8条本地合成响应，0新付费。两实际HTML直接file离线读回通过，原预览截图与操作通过；独立窗口capturePage出现UnknownVizError，离线独立视觉未验证，不以DOM代替。 REQ-S04-01至06及08仅上述工程子项 已实现，完整AT仍5/252，原252标准保留。S04-07成熟资源接入、完整跨产物/S06、自然REVIEW与Office/WPS/安装待功能对齐后集中。下一推进S04剩余资源→S05错因复测→S06→T，Goal active。回退停止新规格写入，保留新身份读器、已有HTML与教师事实；全二进制降级未演练。 证据与回退：docs/research/AGENT_BUOYANCY_DEMO_S04_20261103.json；docs/research/evidence/buoyancy-demo/20261103/manifest.json。


## 2026-11-03 S03 A4与三角色完整导出（工程子项已实现）

新导出固定A4/20mm/角色页眉页码，章节标题去重、答题区整题同页、Word表头重复/行不拆、表格公式按单元格宽度截取，PDF超宽公式明确失败。旧无模板版本草稿保留原排版。原六导出/原Pi/原文件审批及冷启贯通；无新表/DDL/IPC/依赖/Agent/审批。 最终源码5、原导出21/副本17、245组件/build与正式六格式/双尺寸/冷启8通过；最终12文件独立读回、12页PDF全页栅格化，学生文件无合成教师解析。仓库smoke一次207在最后版式修正前通过，最终专项及UI覆盖修正，未重复全仓。两次正式路径共48本地合成响应，新增付费0。 REQ-S03-06/07仅本工程子项 已实现，完整AT仍5/252，252冻结标准保持；完整FX05、自然REVIEW、Office/WPS实际编辑打印与安装仍待集中。下一直接推进S04科学演示/S05错因复测→S06→T，Goal active。回退停止新打印模板写入，保留版本读器、原题/来源/教师事实/文件；全二进制降级未演练。 证据与回退：docs/research/AGENT_PAPER_PRINT_S03_20261103.json；docs/research/evidence/paper-print/20261103/manifest.json。


## 2026-11-03 S03 逐题谱系与扫描去重（工程子项已实现）

逐题实际父题/版本、一题多父题与教师完整转写扫描去重子项 已实现；原Pi/修复/一次核对/题篮贯通，旧身份和指纹不重解释。源码9+旧69、245组件/build/一次207smoke及正式UI5通过，8本地合成响应、0新增付费。D日常已更新到4a3095e，主包+5354B、preload不变；P95/峰值未测。完整AT仍5/252，扫描导入UI/完整FX05及自然REVIEW、A4/全格式不扩为通过。下一S03剩余版式/导出→S04/S05→S06→T，Goal active；原教师事实与新版本读器保留。详情和回退：docs/research/AGENT_LINEAGE_DEDUP_S03_20261103.json。


## 2026-11-03 S03 变式逐题复算与父题版本对照（工程子项已实现）

新变式使用quality.v6：明确完整的单变量字面方程按当前题面自动交本地SymPy逐题复算，不依赖模型主动提交mathChecks。三题改变常数6/7/8，沿用父题x11均失败，实际解12/13/14；同一Pi运行修复后一次教师核对保存。另交无关正确算式不能掩盖错误，教师改题后重算。原折叠区显示父题确切版本、原题/变式题面与答案变化、知识点及难度估计；多父题只展示来源集合，不伪造唯一对应。

同版本封存检查直接复用原格式/计算回执，打开卡片或再次核对不重复启动Python；编辑内容才重新检查。最终源码9/9（含Python不可用时同版本0worker）、旧理科7/7、旧修复16/16、245/245组件、最终build/TSC通过；仓库smoke一次207/207为窄main缓存修改前构建，相关9源码及最终UI覆盖窄修改，未重复全仓。正式题本→原输入/Pi实际检索实读→三题错答案→同轮修复→一次核对保存→双尺寸/冷启5/5，0renderer错误/0冷启重放。成功路径7条本地合成响应，本轮正式尝试22条，新增付费0。

功能代码54c5c1f。D日常正常关闭404464，detached自身构建后PID410564/HWND96276202可见响应；main/preload与源SHA一致，另1窗口及3份脏文档hash保持，0教师消息。90件固定程序40328642B一致、0复制。主包3850247→3859699B（+9452B），preload37928B不变；每批最多8题，有界字面解析，仅显式检查运行。P95/峰值/自然质量未测；audit一次既有42（8高26中8低0严重），无新依赖/DDL/IPC/Agent。

REQ-S03-03/04仅上述工程子项 已实现。完整FX04/FX05图文、模糊及重复扫描、多父题精确对应、自然REVIEW及整条AT仍待功能对齐后集中验收；完整AT仍5/252，252冻结标准保留，Goal active。下一继续S03去重/谱系精确对应和完整导出隔离，再按S04/S05→S06→T推进。

回退停止新v6/新展示，保留v6读器、原来源/修复/回执、教师事实和文件；无表迁移，完整二进制降级未演练。失败现场保留。证据：docs/research/AGENT_VARIATION_EQUATION_S03_20261103.json；docs/research/evidence/variation-equation/20261103/manifest.json（30件限定合成证据，raw/stored SHA及大小核对）。


## 2026-11-03 S03 整卷编辑与一次确认（工程子项已实现）

教师可从原候选卷预览进入原持久题篮，修改本卷第2题分值与解析，再一次确认整卷；本次6题资格样本由30分变32分，第2题7分，原题和旧正式卷保留。原Pi等待返回实际修改版，旧候选明确被替代。未保存分值/解析不能离开或集中确认，分值可保存或放弃；聊天预览弹窗随编辑导航关闭。重开题篮从原确认回执恢复正式卷和导出入口，不重新确认。

复用原V2题篮/题目副本/SQLite writer事务和原PaperRepository确认；新typed IPC仅导入/集中确认2个，原paper_basket_operations增加import/confirm kind记录原卷→新卷。无新表/DDL/依赖/Agent。核对事件、快照、整卷确认与旧待定卷替代一起提交，失败/取消全回滚，幂等重试不重复保存。confirmedPaperId与supersededBy只从原回执派生，不成为第二事实源；保留旧API/旧历史。

回退：停止新编辑/集中确认动作，保留新增回执kind、V2副本及正式卷读取，原题/native/任务/文件保留；无DDL迁移，不回滚教师事实，完整二进制降级未演练。

证据：docs/research/AGENT_PAPER_WHOLE_EDIT_S03_20261103.json；docs/research/evidence/paper-whole-edit/20261103/manifest.json（40件限定合成证据，raw/stored size与SHA逐件核对）。


## 2026-11-03 S03 蓝图配额与实际选题（工程子项已实现）

原PaperReviewPanel现在区分实际题数/分值与蓝图目标，缺题4/6时显示20/30分，不把满分目标当候选实得；沿原折叠区显示每节知识点、原题/生成题配额及AI原创/变式数量。预计用时明确来自蓝图、非学生实测，知识点按保存标签匹配，不作独立学科正确性声明。原提卷/读卷工具返回相同只读派生fulfillment；不改原snapshot/hash、来源配额或整卷一次确认。

派生摘要不成为新持久真源或正确性证明；沿原typed PaperView、Pi工具与整卷确认，无新IPC/工具/表/依赖/审批。本轮无新增协作规则，原252条标准保留。

证据：docs/research/AGENT_PAPER_FULFILLMENT_S03_20261103.json；docs/research/evidence/paper-fulfillment/20261103/manifest.json（20件限定合成证据，raw/stored size及SHA逐件核对）。


## 2026-11-03 S02 讲解适配与实际思考路由（工程子项已实现）

简短讲解与计算/证明的思考预算分离：复杂方程、核验等不会因“简要”自动关闭思考；手动档位及模型可信能力仍优先。纯同题改讲法只从同会话最新教师原文提取临时分类背景，当前八年级/教师讲解覆盖旧呈现；换话题、改条件不继承。普通简短问答保留原请求路径，不注入无关讲解约束。旧结论有错须重核，不为一致而保错。

沿原Pi设置、每轮prompt和typed读取，无新工具/能力身份/IPC/表/依赖/审批；本轮无新增协作规则。临时原文仅分类，不成为已验证事实或权限。完整AT待集中验收。

证据：docs/research/AGENT_TEACHING_PRESENTATION_S02_20261103.json；docs/research/evidence/teaching-presentation/20261103/manifest.json（25件限定合成证据，raw/stored size与SHA逐件核对）。


## 2026-11-03 S02 浮力核验接入原审题保存（工程子项已实现）

已有精确浮力模型现可用于原education_propose_questions的mathChecks；quality.v5沿原卡显示实际浮力、浸深、临界载荷、支持力或合力。题干数量/单位、答案目标和解析近似声明逐字绑定；数值不符阻止保存，同轮修正保留失败谱系，经原一次教师确认保存。编辑题干/答案/解析使旧结果与勾选失效，旧计算数字不再展示。仅证明声明模型中的数量一致，conditionsVerified=false，不证明题意/图义翻译。

沿原Pi/审题/修复/一次教师确认，旧v1–v4严格读取；无新工具、能力身份、IPC/preload、表、依赖或审批。本轮无新增工作规则；完整AT待集中验收。

证据：docs/research/AGENT_BUOYANCY_REVIEW_S02_20261103.json；docs/research/evidence/buoyancy-review/20261103/manifest.json（24件限定合成证据，raw/stored size与SHA逐件核对）。


## 2026-11-03 S02 图题实读依据与未见标注（工程子项已实现）

原education_read_question新增派生question-reading-evidence.v1：六项文字覆盖区分provided/missing/not_applicable/unassessed，区分教师转写、AI转写与旧保存文字；所有成功读取明确originalImagesIncluded=false、semanticSufficiency=not_assessed。原过程卡展示简明中文依据，保留题源/版本、取消/变化复读和既有教师确认，不新增工具、native身份、IPC、表、审批或依赖。文字齐备不等于条件充分，不凭示意图外观补角度/长度/等长/平行/比例；先给可确定关系、范围与有条件分支，只追问决定结论的最少信息。

本轮不新增工作规则、权限或审批。现行答案册v3原AI转写/角色来源保留，不改变presentation。

证据：docs/research/AGENT_QUESTION_READING_S02_20261103.json；docs/research/evidence/question-reading/20261103/manifest.json（18件限定范围合成证据，压缩前后size/SHA逐件已核）。


## 2026-11-03 S02 浮力双方法、临界与条件缺口（工程子项已实现）

新增闭合cube-buoyancy.v1及独立native能力身份，沿原Pi/Hana、安全只读manifest/typed投影与原折叠过程。有限常用单位转有界精确分数，不内置g，不混淆质量/力。声明静水、刚性正方体、充分容器、忽略空气浮力/载荷体积/无其他外力；不满足则明确unsupported。底部静止须液体能作用底面，密封贴底不适用；无约束且浮力过大不能虚构负支持力。conditionsVerified=false，不证明题意/未见图或自然REVIEW。无新依赖/表/迁移/Worker、IPC/preload/Runtime；旧v1–v5及quality.v4不重解释。

双方法是在相同近似物理模型内交叉核对，不能升级成独立自然教学REVIEW；全浸没临界不能唯一推出深度，合力不等于速度，触底净力/支持力与未触底不同。合成传输须识别原Pi自动摘要请求，不能用工具调用应答摘要；恢复已完成native不重放五计算。改g前须明确液体从800恢复1000，不能用参数对而教师原文歧义的样例冒称语义通过。过程截图须等折叠动画完成且核实证据矩形完整可见；日常构建结束不等于首个HWND已出现。

证据：docs/research/AGENT_BUOYANCY_S02_20261103.json；docs/research/evidence/buoyancy/20261103/manifest.json（47件限定范围压缩原始证据，压缩前后size/SHA逐件已核）。REQ-S02-02/03/05/08仅工程部分实现；完整AT仍5/252、Goal active，不标全S02/S04通过。


## 2026-11-03 S02 解题链接入原审题与教师确认（工程子项已实现）

新增闭合QuestionSolutionCheck，题干/答案逐字片段及按顺序、不复用位置的stepTexts绑定当前解析；新增question-quality.v4，经原mathPlans→checkSolution/SymPy1.14.0→不可变质量历史→原审题卡/SQLite贯通。保留原三次修复谱系，不能删检查、换kind/domain或缩短既有步骤。旧v1/v2/v3严格校验/原hash不变。无新表/迁移、依赖、Worker、IPC/preload或Agent Runtime。文本绑定不证明题意翻译，conditionsVerified=false，unsupported/basis_changed仍人工核对。

新证明不能塞进旧策略，否则旧记录可静默接受新类型；使用独立v4策略并逐值验证旧v3质量hash/native冷启。数学正确也不是题意建模正确，逐字片段只证明当前版本绑定。首次TSC因重复比较已收窄unsupported状态报TS2367，删除冗余分支后通过；保留失败日志。日常进程应每轮实测PID/启动时间/HWND，旧PID可已退出或被系统复用。

证据：docs/research/AGENT_SOLUTION_REVIEW_S02_20261103.json；docs/research/evidence/solution-review/20261103/manifest.json（31件限定范围原始证据，压缩前后size/SHA均已核）。REQ-S02-01/02/07/08工程子项 已实现；完整AT仍5/252、Goal active，不升级整条通过。


## 2026-11-03 S02 解题链、增根丢根与首错证据（工程子项已实现）

新增math-check.v5，薄复用原SymPy1.14.0方程求解、原worker4并发/15s、Pi/Hana/native/typed投影。无新依赖/表/IPC/preload/Runtime；固定Windows运行时90件40328642B已同步。v1–v4及旧能力身份/回执逐值保持。conditionsVerified=false，仅证明提交的形式化链，不证明题意翻译、未见图义或整题教学质量；此片尚未接入题目保存科学计划。

独立算式成立、原方程答案正确不能证明整条推导；相邻解集须在原语法定义域中比较。候选扩展不是允许跳过代回，原式筛选不能去掉真解。公开过程原通用摘要不够，须只投影闭合宿主证明，不能复制模型任意自称。初次TSC4处unknown修为类型谓词；首次日常manifest字节比较因LF/CRLF失败且未复制，改为JSON语义相同并逐文件核SHA，原失败保留。

证据：docs/research/AGENT_SOLUTION_CHAIN_S02_20261103.json；docs/research/evidence/solution-chain/20261103/manifest.json（50件限定范围压缩原始证据，原始及压缩hash均已核）。完整AT仍5/252、Goal active；REQ-S02-01/02/07仅工程部分实现，不标整条已实现。


## 2026-11-03 结构化题与独立答案册写回已贯通（受控闭环）

整合收尾：正常合入origin/main 2831b59为d8e47a9，14处仅文档顶部冲突均核对共同尾部并保留双方；24份本功能生产源码hash不变，隐私helper另补答案册answerIssues.section人类文字负例。整合后build/TSC、245组件、原执行器126项（109旧+11跨页+6新增）及同一合成题库的双尺寸/冷启只读3项通过，0新增模型/外网请求/renderer错误。完整207/207在功能347be78通过一次，不冒称合并后重跑。最终456文件35242539B，主包3787650B（相对整合前另+2239B，含协作者和最后隐私负例修正），preload37712B不变。readback早期把被拦截的GET /v1/models误算作模型调用，已保留失败并区分；无重发/扣费或canonical变化。统一manifest24件，不包含自然资料或账户。


复用原pair/index/work/writer/journal，新增question-document.v3独立答案PDF角色证据；完整图题/跨页题按已认证题面、章节和题号匹配，answer/analysis/archive/document同事务写回。原图/context不变，冲突保留、教师/原文保护；教师前后编辑、源变化撤销、Pi完整读取及检索/组卷/导出版本检查已接通。已有unsupported可从原页按钮重试，不做全库启动扫描。

真实合成PDF链路发现并修复：裁剪坐标18位小数被整段JSON身份证检查误拦截，停在privacy_blocked。现在闭合schema内的人类文字仍按原PII规则批量检查，几何/hash仍严格认证；真正题干/答案/图义/页文/OCR隐私仍阻断。保留首稿和原失败，不自动重发未知请求。

回退新写回：OMNI_EDU_BOOK_DOCUMENT_WRITEBACK=0；保留v3读取、journal、原件与原隐私规则，历史不删除。D协作者工作树/运行时和受保护stash未动；本轮正常推main与知识库分支，以最终远端读回为准。

完整Goal active、AT数不变。此前自然六页样本仍1/6自动稿、5待核，物理解答内部矛盾未被三稿一致发现，qualityPassed=false保持；本片不篡改旧回执，不以合成答案册替代自然质量。下一继续自然主书/答案册结构化图题与冲突裁决、其余待核/续题归属和联网补答，再走整书→Pi组卷与自然10→40GB召回/恢复/P95/内存/受管安装，不能宣称整体交付。

证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#bookDocumentTrial；docs/research/evidence/book-document/20261103/manifest.json。只归档合成/受控报告及构建日志，不上传自然资料、数据库或账户。


## 2026-11-03 整包局部改页与4N→5N联动（工程子项已实现）

原请求目标大小写不敏感去重先于同值携带，防止别名碰撞误排除新文件检查。office_deliver_files在创建子草稿前调用既有preparePresentationEdit，保留来源版本/hash、幂等、原BoundEffect/审批/取消/部分恢复。未变化文件做新鲜磁盘回读，不声称重新内容检查。withStaticOfficePage以宿主停止Promise结算悬挂回调；隐藏DOM两帧等待加50ms兜底，原数值/交互检查不放松。无新依赖、表、共享协议、IPC/preload、Runtime或审批卡。

复用原精确版本编辑与整包集中确认，不另建Runtime/账本/审阅卡；没有新增付费请求授权。

证据：docs/research/AGENT_BUNDLE_PAGE_DELTA_20261103.json；docs/research/evidence/bundle-page-delta/20261103/manifest.json（86件限定范围压缩原始证据，原始/压缩hash已核）。回退5c44cc5及421b4ff，保留协作者提交、全部旧/新成果及native谱系；完整回退未演练。audit沿用本轮既有42（8高26中8低0严重、exit1），依赖未变。


## 2026-11-03 续题原文对应已修复，独立答案质量仍失败

复用原RapidOCR坐标、PDFium前缀PNG和Electron nativeImage，给新续题冻结page-continuation.v2/continuation-text.v1：只接受实际像素证明的印刷填空线、中文折行及括号字宽差异，数字/符号/单位/否定/选项和整段独立OCR仍严格对应。旧v1及原失败完全保留。独立事务仓库与冷启读取均注入无模型依赖的本地校验器。

独立事务/冷读依赖由每个Store工厂注入，不复制云端运行时。v1原义不变，不模糊合并关键条件；未核实答案不得以sourceGatePassed或ai_final冒称正确。

下一主线优先复用原答案册pair/index/work/writer打通结构化图题：现propose明确排除q.document，不能只删guard；须补独立答案PDF的版本化角色证据、document/archive/journal同步与来源校验，按章节/题号/原文匹配并保留答案冲突和教师修改。再处理其余待核题、前页续题归属及题级证据，接联网补答、整书→Pi检索组卷和自然10→40GB召回/恢复/P95/内存/安装交付；不盲目增加同稿复读。完整Goal active，AT数不变。 新创建开关OMNI_EDU_AI_CONTINUATION_TEXT默认关闭，回退保持未设/0；保留v1/v2读取、本地校验器、原件/PNG/三稿/失败与教师事实。D协作者工作树、运行时和受保护stash未动，正常推main和知识库分支，最终远端一致性以Git读回为准。

证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#continuationTextTrial；10件受控日志/构建/脱敏实测摘要及逐件hash见docs/research/evidence/continuation-text/20261103/manifest.json。自然原件、截图、OCR、请求响应、数据库与账户留在本机，不上传。

## 2026-11-03 S02/C04 已修复失败的原轮汇总（工程子项已实现）

仅确有宿主证据的修复终态使用xiaozhi.verification.v2，repairedOperations关联原失败执行证据与当前保存readback；旧v1严格闭合且历史核验逐值不变。复用原3次修复谱系与parent payload/revision hash、原BoundEffect/任务/Journal/typed preload；无新表、IPC、Runtime、依赖或审批。原任务重新核对按最多4096条sealed观察事件重算invalid/停止/未结算及原计数，不能只凭run succeeded。 完整AT仍5/252，Goal active，原28WP/252REQ范围保持。REQ-S02-07/E07-04/C04-03/09仅工程部分实现，完整AT待阶段集中；自然教学质量/独立REVIEW、S01/S02其余条件/图形/多解及FX01载荷4N→5N和图表/整包同步继续，随后原S03与S/T依赖。先核已有实现，不重复本轮已通过的汇总、原版本/来源/恢复或无关207/导入/完整Office矩阵。安装包、原生Office及物理拖窗/IME未重验，LogonUI仍锁定。 回退可关闭修复消歧callback，保留v2 reader/adapter、原失败计数、SQLite/native与教师文件；新轮保守partial，历史v2仍可读。不能把raw失败数清零或删证据，完整二进制降级未演练。 证据：docs/research/AGENT_REPAIRED_RUN_S02_20261103.json；docs/research/evidence/repaired-run/20261103/manifest.json（68件压缩原始证据及逐件原始/压缩hash已核，仅合成数据与构建/运行记录）。


## 2026-11-03 S01/S02 原审题接入方程与量纲（工程子项已实现）

整合补记：正常合并origin/main c3945b3为47f2a73，保留主线跨页实现及双方13处进度新增。整合后build/TSC、245组件、受影响源专项7和原保存记录双尺寸冷读1通过，0新增模型/worker重放。D日常正常关闭377128，以自身依赖构建启动47f2a73，新PID374280/HWND38474610响应且可见，另4窗口与3脏文档hash保留。整合主包3760942B（本功能+5932B、主线另+16649B，总+22581B），455件out35205568B（总+25605B），preload37712B不变；C/D同hash，未测P95。14件整合补充原始证据及hash见science-review/20261103/integration-manifest.json；初轮41件manifest不变。

使用新 quality policy xiaozhi.education.question-quality.v3 区分科学计划，旧v1/v2校验、hash及历史保持；原记录envelope/SQLite表/IPC/Worker/依赖均未新增。不复制原来源围栏，不增加审批。修正不可变更核验kind、方程domain或目标单位以逃避失败；quantity审题必须有非空expected。原句绑定不代表自然语义证明。 完整AT仍5/252，Goal active。REQ-S01-04/S02-01/02/03/07/08仅工程部分实现，整条待集中验收。实际整轮汇总仍显示“1项结果待核对”，虽然运行succeeded且2题已保存；已读回saved_questions条件通过、answer:human=needs_human；operations.failed=1令reason=execution_failed，需区分已修复失败与未完成，不冒称整轮已核验。下一沿原repair lineage/effect/readback/task human标准修正已修复失败的汇总呈现，再继续S01跨页/答案册完整读取、自然推导/独立REVIEW、图形/多解及FX01载荷4N→5N和图表同步，随后原S/T依赖。安装包、原生Office、物理拖窗/IME未重验，LogonUI仍锁定。 回退时先禁新科学计划，保留policyv3读取/历史adapter、原SQLite/native及教师文件；不把新记录重新标成旧策略。低于policyv3的二进制不承诺可读新记录，可保留兼容版只读；没有破坏性迁移，完整降级未演练。 证据：docs/research/AGENT_SCIENCE_REVIEW_S02_20261103.json；docs/research/evidence/science-review/20261103/manifest.json（41件压缩原始证据、逐件原始/压缩hash已核；仅合成测试数据和构建/进程记录，无教师库或密钥）。


## 2026-11-03 跨页父题已组装，真实质量仍未通过

继续复用原成熟版面/PDFium/RapidOCR、原队列/授权/账本、QuestionAssets、三稿与多页question-document；不增加第二知识库/Agent/任务系统。跨页描述仅限新冻结单元、必要前缀和原授权，旧回执保持。真实组装成功但OCR填空/括号对应与答案逻辑未解，保留严格待核，不靠删符号或重跑提高通过数。下一补有版本且保留关键符号的OCR/填空/布局对应、前页续题归属与题级证据，再接已知答案及联网补答核对；随后整书/答案册→Pi检索组卷及自然10→40GB召回/恢复/P95/内存/安装交付。完整Goal active，AT数量不因本片增加。新开关默认关闭；退回停止新跨页创建，保留描述读取、原件/图/三稿/失败及教师修改。D日常运行和安装包未触碰，受保护stash保留。

证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#crossPageParentTrial；受控日志压缩及逐件hash见docs/research/evidence/cross-page-parent/20261103/manifest.json。

## 2026-11-03 S02 物理量纲与单位换算（工程子项已实现）

复用原固定SymPy1.14.0 SI/convert_to/PREFIXES及4worker/15秒边界；新增有界quantity AST/v4、原Hana发现→Pi工具→原native身份/回执→SQLite→教师可见活动，不新增依赖、表、IPC或审批。零值/约分前保留量纲，v1/v2/v3与旧会话保持；旧question-review不可变计划仍v1/v2。 不额外建立单位服务、审查层或自然题意自动正确承诺；保留旧审题计划以便沿原版本契约继续对齐。完整AT仍5/252，Goal active；REQ-S02-03及相关07/08仅部分实现，不将工程子项标成整条验收通过。下一核对S01原题/来源完整读取和当前版本，再把v3/v4接入原审题计划与条件依据；继续自然推导/图形/多解及FX01载荷4N→5N与图表同步，随后原S/T依赖。不重复已有来源版本围栏、版本恢复或无关207/导入/Office矩阵。自然REVIEW、完整S02、安装包、原生Office、物理拖窗/IME未验，LogonUI仍锁定。 证据：[本轮记录](../research/AGENT_QUANTITY_VERIFICATION_S02_20261103.json)，40件压缩原始证据及逐件hash见对应manifest。


## 2026-11-02 S02 原方程与定义域核验（工程子项已实现）

S01既有底层retrieval已重核事实seq/来源版本，不重复堆await后审核。本片只补真实缺口：未知数分母与根式原方程核验及对话入口；自然题意、审题草稿计划、单位和教学评审各按原任务继续。完整AT仍5/252，Goal active；REQ-S02-01/02/07/08仅部分实现，未给整条AT备注已实现。S01跨页/答案册完整读取、自然推导与REVIEW、单位/图形/多解讲解、FX01载荷变化与图表同步仍待。安装包/原生Office/物理drag/IME未重验，LogonUI仍锁定。下一按原依赖继续核对S01/S02功能缺口及S/T，不重复已有版本/恢复与来源链，不重跑无关207/导入/完整Office矩阵。 证据：docs/research/AGENT_SCIENCE_VERIFICATION_S02_20261102.json；45件压缩原始证据及逐件hash：docs/research/evidence/equation-verification/20261102/manifest.json。


## 2026-11-02 UI U4-D1 当前确认卷导出绑定（限定通过）

不以卷名或latest代替点击身份；不开放历史被替代卷导出；不自动发送/增加权限。旧绑定任务续接必须回原卷核对；回退先停准备入口，保留绑定读器/拒绝，不将旧稿降为可发送明文。docs/audit/ui-goal-20261101/U4_D1_DELIVERY.md 与 U4_D1_MAIN_INTEGRATION_RESULT.json。

## 2026-11-02 W3完整浮力旅程：版本生成与恢复已实现

完整FX01三参数离线HTML及8页/逐页备注PPT，沿正式输入、原Pi、整包/局改审阅、版本历史、取回旧版、教学文件预览和冷启集中走通。6检查通过；AT-E08-04/05按各自UI/DB/DISK完整标准通过，备注“已实现”，累计5/252，Goal active。 产品运行构建37ba4c5（原功能4ed966d），验收脚本fe688f9；五种独立物理状态、reset/键盘/非法输入在双尺寸通过。只改第4页标题，其他包内容（除Office元数据）、全部备注、旧PPT及HTML hash/mtime保持；同值不建草稿/文件/版本/审批；恢复新增第3版当前，后来第2版仍保留；双入口/冷启0模型重放、0renderer错误。包括首个脚本断言失败共11次本地合成SSE，0付费。 不代表自然模型质量、FX01所有后续指令、完整FX09/10、Office/WPS原生编辑排版、物理drag/IME或其他AT已验。产品代码/依赖/运行包未变，本轮不重复build/type/245组件、207、导入、安装或Office矩阵；D日常程序未触碰，既有运行身份本轮未重验。包体3718350B且hash不变，无新增性能结论；audit既有42（8高26中8低0严重，exit1）。 下一按原W3→S/T顺序核对尚存实际功能缺口，随后S01/S02源码对齐；不重复实现已存在的版本/恢复/来源链路，也不为未满足前置的AT记通过。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#fx01ConcentratedSlice；26件压缩原始证据与逐件hash：docs/research/evidence/fx01-versions/20261102/manifest.json。


## 2026-11-02 E08 同值局部修改不产生空版本

工程子项已实现（4ed966d）：本产品PPT的显式同值局部修改先核原版本/hash并比较内容；不创建草稿/候选/成果/版本/新文件，不重复确认。真实变化仍走原一次审阅及另存谱系，完整draft同内容复制不被抑制。原native回执与SQLite/文件独立读回标为unchanged_office，不冒充saved_office；原最终说明压住模型虚报的新文件，双尺寸冷启0重放。9边界、15原回执回归、正式Pi/双尺寸/冷启/后续真修改4项、build/type与245组件通过。首次脚本层级/初始化错误留档并复用同一源文件续测，合计15次本地合成SSE、0付费。 完整AT仍3/252、Goal active；W3已核实的双尺寸交互及同值PPT缺口已补。继续按原FX/AT核对W3集中旅程，发现实际功能缺口继续实现，随后S01/S02与T依赖；不重复建设已有版本/恢复/来源，不重跑无关207、导入、安装。完整自然质量、格式/Office教师操作、物理drag/IME未验，LogonUI仍锁定。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#unchangedPresentationSlice；docs/research/evidence/presentation-unchanged/20261102/manifest.json。


## 2026-11-02 E06 双尺寸真实交互与W3对齐

同一原私有窗口按尺寸重载，不新增后台窗口/协议/表。实际D主包3713047→3713585B（+538B），455文件总量35123734→35124272B，preload37712B不变，C/D主包与preload同hash。交互检查覆盖翻为两尺寸，共用原20秒截止；只增加本地交付检查，不进逐token链路，P95/峰值未测、不称提速。无新依赖，audit既有42项。 回退保留所有报告与文件；不能将宽屏原生证据改称两尺寸。 docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#htmlViewportSlice。


## 2026-11-02 E06 HTML真实控件与检查兼容

复用原私有Hana窗口与Electron输入运输层，原schema/Pi/审阅/检查表保留；历史结果按策略版本重读为过期，不回写旧报告。本轮实际D构建455文件总量35115767→35123734B（+7967B），主包3705080→3713047B（+7967B），preload37712B不变，C/D主包与preload同hash。仅本地文件检查增加有界原生输入，不进逐token链路，P95/峰值内存未测，不声称提速；无新依赖，audit既有42项。 回退保留全部报告/文件及读器，不把旧合成结果改称原生；完整回退演练未做。 docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#htmlNativeInputSlice。


最终整合主线资料题目回接e265ec3为b093113：四份协作记录顶部冲突保留双方，公式/Pi/shared/成果卡源码与f9a062e相同。整合后build/type、245组件、协作者21接力＋49编辑守卫、同三文件双尺寸冷启只读3检查通过，0新增模型调用；旧原生成/WPS证据不冒称重跑。日常D再次正常关闭297000并以自身依赖build/type/245组件启动整合代码，新PID298792/窗口14553942响应可见，3脏文档hash及其他任务窗口PID/start/HWND保留；C/D主包和preload同hash。完整AT仍3/252、Goal active。证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#officeMathSlice.integration。


## 2026-11-02 E08 普通教学文件公式排版

普通文档/PPT采用独立v2公式语义而非改变v1。复用原KaTeX、Hana静态宿主、typed Office及单次整包确认；保留原生PPT文字和真实图片限制。修复共用公式截图串帧，旧已存文件不重写。 完整AT仍3/252、Goal active；本片不等于完整FX09/全学科或原生Office编辑保存验收。Microsoft PPT因已有PID217336未运行；物理drag/IME仍受LogonUI限制。普通XLSX仍v1，标题普通文字，公式图片不可直接编辑。 回退可停止提供新v2工具语义，但保留v2读器、原账本/版本与全部文件，不把旧v1重解释成v2；完整回退演练未做。 docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#officeMathSlice。


## 2026-11-02 E07 中断写入临时物归属与回收

以原两账本私有文件身份替代进程退出时不可恢复的随机临时路径；沿原verify回收，不建立扫描器/新审批/平行运行时。创建空临时文件到归属落库之间退出仍可能留无归属空文件；不猜测删除。真实UI切点仅先保存HTML、再在DOCX安装前退出，不能替代所有格式/断电/完整FX10或整条AT。回退代码保留新增可空列和全部文件/记录，不删表/目录；完整回退演练未做。 本轮实际观察原D主包3701750→3704117B（+2367B），C/D最终主包及preload同hash；旧文3614965B不是本轮观察基线。每次实际安装增加2次私有元数据更新，不进逐token链路，无扫描/新模型请求；P95未测，不声称提速。 docs/research/AGENT_RECOVERY_E07_20261031.json#ownedFileStagesSlice。


## 2026-11-02 E06 无草稿文件失败终态

文件写入在建立草稿前失败时仍须以原toolAttempt/manifest派生最终事实，effect=none与unknown分开；不得凭“无草稿”显示模型全部完成。原账本优先、只读失败和工具间说明沿原流程，不扩审批或执行层。 先前怀疑快速回复丢正文，经原四格式成果只读及本轮单包SSE正常保存验证未复现：文件保存后模型旧草稿复述本来就应隐藏。真正缺口是草稿前失败未触发宿主文件终态。两次测试又过早读取启动快照（均0模型请求），改为明确await的Node轮询同时等待持久终态，失败记录完整保留。 docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#beforeDraftFailureSlice。


## 2026-11-02 同题归属裁图与整卷质量失败

冻结可选cropGeometryPolicy=owned-block-margins.v1，仅OMNI_EDU_AI_OWNED_CROP_MARGINS=1的新page-fragments.v3单元采用。≤32有序自有块，12像素边距受外来块限制，连续分组矩形不得相交组外块，动态规划≤8组完整覆盖；同题重叠图注随图纳入。图注适配只认独立完整边缘OCR、单一figure_title与纯图号，并保留最终题面/图义精确对应；旧单元原义和原转录不改。

保留默认关闭；下一先跨页完整父题，禁止把实际续题判成独立页来提升通过数。回退不启用新建裁图开关，保留可选字段读取、原图/裁图/三稿/失败/教师修改；无新表、IPC、依赖或运行包。D日常和安装未由本知识库切片更新。

证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#ownedCropGeometryTrial。

## 2026-11-02 E08 Office来源行导航

workspace/extracted_lines复用LocalAnswerSource v1及原typed预览；实际工具、answer evidence和Pi公开投影三处贯通，不增加表/IPC/依赖/批准/Agent Loop。范围仅为提取行；脱敏改变行数时不建立错误跳转，旧无定位不补造。关闭或换源清旧预览，版本/Office格式仍校验。 主包3612940→3613327B（+387B），preload36452B不变；来源只点击时沿原解析器读一次，不新增模型请求或逐token路径。未测延迟/P95，不声称自然质量或速度提升。回退仅停新Office来源写入/登记/公开投影，保留通用来源读器、所有原文件/记录；无迁移，完整回退演练未执行。 docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#officeReadSourcesSlice。


## 2026-11-02 E06 局部文字遮挡

沿原PowerPoint/WPS固定私有脚本与原CheckFinding消息/page保存新增rendered_text_partly_covered，不增加业务真源、共享IPC、批准或Agent Loop。只有完整字符实际边界被上层静态实心矩形覆盖才判失败；空白/后置/透明不误报，复杂字形、相交笔画、预算/映射异常仍未检查。原生位置只含页/对象/UTF16字符序号/遮挡对象，不含原文。 回退仅撤cd4ef03的新增检测和native适配，保留原文件/所有报告/截图及通用code/message读器；6d2bdb3已有新教师规则兼容，不回退到缺questions/checks读支持的c37。完整回退演练未执行。 下一仍补齐W3 E06/E07/E08+C功能，再集中验收、之后S/T；不重复已通过生成/导入/安装/207。上轮本任务L2综合失败保留，主线另一次207通过不冒作本片证据。 docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#partialCoverSlice。


## 2026-11-02 局部OCR有界静默恢复

沿原inspectPageCrop/recognizeLocalImage及共享槽位，每张裁图暂时失败最多重试一次，250ms可取消退避；永久错误/空图不重试，旧失败不自动重放。原quality_json增版本化可选ocrAttempts，成功/失败保留最多2次本机结果及只含阶段/退出码/字节数的诊断；不进入模型上下文，无新队列/表/IPC/UI。禁用OMNI_EDU_CROP_OCR_RETRY=0保留读兼容及全部原件/回执。

局部图三遍试验保持默认关闭；本地有界恢复独立默认开启，不增加云授权/计费，不重解释旧模型单元。 docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#quietCropOcrRecovery

2026-11-02 E06教师硬约束子项工程已实现（源码290d73c，整合a845938）：宿主从当前教师原始要求绑定明确PPT页数/逐页备注/题数和引用文本，模型7页/1题不能覆盖8页/3题；实际7页2题失败后一次修成8页3题。续交实测又发现约束丢失，现沿原DeliveryRow v1 JSON保留实际规则，旧包沿同会话parent/原检查读回，仅继承约束、重检新字节，不继承旧通过或task bindings；统一确认保存及同资料冷启3项、最终整合0调用读回2项通过。16边界、6兼容、240组件及最终build/type通过，综合回归在既有L2记忆采纳1515行失败，未记207通过；0新增付费。完整语义/视觉、完整FX/AT仍待W3集中，累计仍3/252；继续W3后S/T。docs/research/AGENT_TEACHER_RULES_E06_20261102.json。 最后整合cb46cf4保留双方13份文档全部非空行；最终build/type、245组件（主线新增5纠错状态项）与同记录0调用读回2通过，11份本轮生产源码hash不变。D仍为已验a845938，含本轮完整修复；本次无关OCR整合/文档不再重启。 日常D已按接管授权正常关闭旧PID163732，无强杀；detached更新a845938，原npm.cmd start/自身build/type及240组件通过，新PID224824/窗口46269054，准确D入口/响应/native visible已核，3脏文档hash保留。0教师对话/付费；LogonUI仍在，物理drag/IME、完整日常旅程及安装未验。


## 2026-11-02 局部图接通与质量试验未通过

复用原QuestionAssets/分块回执/第二次dispatch，按题号、组序与PNG hash实际发送局部裁图和OCR；旧无字段/v1不重解释，新v3仅OMNI_EDU_AI_CROP_IMAGES=1冻结local-crop-review.v2。最多160组/16MiB裁图，无新依赖、表、IPC、UI或额外调用，原质量门禁不改。

同一自然六页12次均200，72张实际裁图4281955B/7305B OCR与原保存资产逐一核对，冷启原事实一致、0 renderer错误；仍4自动稿/11待核，图题0通过，原质量断言exit1保留，不重跑凑成功。因此默认继续v1，图策略仅显式试验，完整Goal active。

原图第2题确有B→A箭头，第二遍新增箭头描述触发图义投影精确差异；这是待验证纠错，不能清空mismatch。下一先区分原图真源、派生转录与纠错后验证，追踪Pi/组卷/导出消费者；停止仅补提示/图片并期待两遍逐字相同。边缘、空格/填空OCR、跨页、答案正确性/已知答案与联网补答、40GB召回/P95仍OPEN。 证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#cropImagesTrial。

## 2026-11-02 OCR管道字符完整性修复

原ocr-host逐Buffer独立String解码会在UTF-8字符跨块时静默写入替换字符，JSON/schema仍可成功。已沿原宿主改为严格流式TextDecoder并在结束时flush，非法/截断UTF-8拒绝；BOM、字节预算、取消/退出后释放槽位、运行时固定清单及全部协议校验保持原要求。无新增依赖、表、IPC、页面或模型调用，旧回执/已存OCR不改写。

不通过模糊匹配/删除填空线或清空issues提高自动稿数；先保证实际识别流无传输损坏，再让模型获得必要图像细节。保留旧失败和未知根因，完整Goal active。证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#ocrUtf8Transport。

## 2026-11-02 局部OCR进入模型复核

新v3原页单元冻结cropReviewPolicy=local-crop-review.v1，第二遍沿原执行器发送已认证局部OCR、边缘、原块坐标/资产hash及首稿比较，绑定原页和首稿hash。只作为不可信辅助证据，发送前隐私差异阻断；每块2048B、合计24KiB，截断明确。旧单元不补字段或重解释；无新模型调用、图片、依赖、表或IPC。带分值章节标题后紧接父题号才认下一页另起节，正文/图注/续题仍保守。

不把OCR结果变成批准、不以两遍相同替代数学正确；真实修改仍保留分歧。讲义修复仅信息表单忙碌态，不扩展成全局导航/未保存草稿重写。完整Goal仍active。下一优先解决题面/图义与原图的完整对应、双遍答案稳定性和跨页拼接，再贯通已知答案/联网补答、Pi整卷与40GB召回/P95、按需下载和最终安装。原OCR间歇parse_failed及每次646文件279039929B认证成本未关闭。D日常工作树、运行窗口和安装未改。回退用OMNI_EDU_AI_CROP_REVIEW=0停止新策略创建，保留新读适配及原件/回执/资产，不重放旧付费调用。 证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#cropOcrSecondPass。

2026-11-02 C06：只读复用与本树manifest/buildInputs逐项hash吻合的固定构建资产，复制为自身资源，未借node_modules/改变他树。当前payload本机隔离安装，测试包仅关闭快捷方式创建，无公开发布；D生产字节不变故不重启。完整AT集中、不新增通过。docs/research/AGENT_PACKAGED_C06_20261102.json。


2026-11-02 C05循环提醒沿原DSH advisory和唯一Pi dispatcher，不引入硬工具禁令或第二调度器。只将宿主关联附加移到比较后，实际进度/参数完整参与；短周期限2–4步，超过4步不冒称全覆盖。真实模型可能忽略提醒，受控SSE证明接线而非自然智能效果。W3→S/T及完整验收标准不变。


2026-11-02 C04本轮诊断复用原journal/usage，仅显式纯读单轮并allowlist投影；不新增日志、数据库迁移、模型调用、定时器、审核或工具权限。8份/10分钟临时快照绑定原会话，先预览后导出相同字节；旧/缺失事实标未知。完整AT与W3→S/T顺序不变。


2026-11-01 C04/C05沿原host usage、SQLite、snapshot和任务详情，不新增资源限额/计费真源/运行时。只修缺失、部分、停止后显示与缓存诚实性，未知费用不替换为免费；完整AT与W3→S/T顺序不变。

2026-11-01 C03：复用原设置/在线SQLite快照/manifest/新副本激活，不新增备份服务、IPC或依赖；外选文件来源限已登记精确路径，实际字节独立于原保存证据。原外部权限不恢复，只绑定自有副本；有遗漏须显式显示。完整252AT及W3→S/T顺序不变。

## 2026-11-01 已存局部OCR失败的本地恢复

沿原MaterialAiRepository.drain、writer与typed preload，在资料详情→题目与校正→原AI批次增加“仅重检本地OCR”。不新建模型批次、不读取模型账户、不增加云请求；旧失败/首稿/终稿不可变。新增material_ai_crop_rechecks与material_ai_crop_recheck_results幂等任务/结果日志；成功证据依原件、冻结输入、原块和资产hash读回，同一题ID只重算archive/document。原题全部字段和教师/答案册改动受完整指纹保护；OCR成功不自动消除两遍模型内容分歧。待处理可暂停/重启中断/显式重试，原云批次保持暂停。

原parse_failed间歇根因未关闭：同一hash资产在独立进程与实际宿主复探均成功，不能据此称OCR引擎已修复。原宿主每次认证646文件279039929B的成本、跨页/双遍内容与解题稳定性、答案联网、Pi整卷、40GB召回/P95和最终安装均保持开放，Goal active；D日常/安装未更新。回滚先暂停新本地任务并停止调度写路径，保留新读适配、日志、原件/资产与两遍回执，不删除新表或退回只读旧回执的版本。 证据：docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#localCropRecovery。

2026-11-01 本轮核对接线：复用原host回执、原notice和官方Disclosure，失效/跨轮不显示为有效，本轮核对/跨轮任务/逐文件状态保持各自范围；不新建核验或安全批准流程。源码399f1f7，详docs/research/AGENT_RUN_RECEIPTS_20261101.json。

2026-11-01 C02键盘待处理工程：只为教师显式进入移交焦点，非问题卡无可见输入时停在审阅trigger，不默认选批准。原File通知可能卸载，关闭后按同会话稳定入口返回；不扩大权限、确认层次或Agent循环。完整252验收定义与W3→S/T顺序不变。

## 2026-11-01 结构化题面来源与局部OCR失败

冻结page-fragments.v3，沿原SQLite/文件真源、MaterialAi双遍执行器与question-document.v2，原v1/v2不重解释。编号比较与图号/标题布局证据分开，局部明确OCR失败保存负面回执，同页独立题继续。无新表、依赖、IPC或Agent；正式组卷教师确认与每批图片授权保留。真实六页15候选/4自动稿/11待核、1道六图来源路径及冷启通过，仍不是整卷质量验收。来源、未解决项和回退见docs/research/KB_ARCHITECTURE_BASELINE_20261101.json#structuredPageSource。

## 2026-11-01 后台多块原题归档

沿原MaterialAiRepository双遍执行器和QuestionAssets接入多块归档，复用RapidLayout/PP-DocLayoutV3、PDFium/RapidOCR及question-document.v2多图。page-fragments.v1回执保留；新v2冻结同页OCR块线索，最多32个选块，仅在不框入其他检测块时合并为最多8张图片。原题查看和Office源图读取全部图片；无新DDL、依赖、Agent或IPC。OMNI_EDU_AI_PAGE_FRAGMENTS=0只停止新策略，旧回执仍可读。 两遍归属一致仅作为原题来源的一项证据；失败不修改首稿/终稿，不自动复发结果未知的收费请求。


2026-11-01 C02继续采用应用外层布局修复，保护原输入框/底栏/弹层和Pi；极端宽度允许局部滚动取回控件，设置目录/行堆叠。真实物理drag、系统DPI、IME、教师视觉与工程可达性分别记录。一次综合在最后设置行CSS前通过，最终专项覆盖该变化，不再重复综合。


## 2026-11-01 复用成熟图文分块来源层

复用成熟RapidLayout1.2.1+PP-DocLayoutV3，不引入整套第二RAG/数据库/Agent。只增加未核对数值图文块，正文继续PDFium/RapidOCR。新运行时/manifest独立可选，普通OCR及旧数据不要求新组件；默认不打包，显式发行flag才校验附带。模型130MB不等于组件417MB。下一采用既有question-document.v2多图与原双遍writer做块归属，禁止直接把检测框当题目、清空requires_image或修改旧回执语义。 新组件安全复核独立升级Pillow/证书/构建依赖，保留旧OCR锁；图文块刷新不重跑文字OCR，避免无谓开销与校对区变化。


2026-11-01 C02决定：复用原Electron Menu承载窄窗全部菜单，typed原通道仅增加app分组，不自造菜单/窗口移动协议、不改composer内部。标题栏子验通过与真实drag、极窄正文及系统DPI/弹层矩阵分开记录，不改原252AT标准。

2026-11-01 日常运行补录：用户明确“直接关了重启，接管使用”。已正常关闭旧D主进程52540（无强杀），保留3份脏文档hash，D从c59ec05快进d76e6e5，以本目录自己的依赖npm.cmd start重新build/type并启动exit0。新PID58588/窗口6295124，Computer Use Raise后可见，实际renderer URL为file:///D:/WorkProject/EduProject/apps/desktop/out/renderer/index.html，本轮窗口几何修复已进入日常版。未发送对话/新增付费测试，不归档真实UI或教师数据。原生标题栏双击可最大化；普通drag位置未变、最大化drag未还原，原因未确定，AT03仍未通过。用户物理Esc终止后续Computer Use，最后还原按钮动作结果未知，已停止全部窗口输入。详docs/research/AGENT_INTERACTION_C02_20261101.json#runtime。Goal仍active，其余功能及集中矩阵继续，不因日常启动通过标全组。

2026-11-01 C02约定：原host最小宽与窗口偏好须共用常量；可选geometry既处理窗口close，也在app before-quit同步保存，因为原退出drain会destroy窗口。分数DPI只按实际测量做最多两次小幅修正，不能放宽精确冷启断言掩盖逐次漂移。OS前台条件拒绝不能换成setBounds/HTCAPTION宣布拖动通过；日常目录有其他任务活跃进程时保留现场。固定测试构建通过OMNI_EDU_TEST_BUILD_ROOT或专项build参数选择。 当前复杂控制样本未复现严重卡顿，故本轮不改projection/阅读锚点或历史memo来追求数字。

## 2026-11-01 复用本地布局辅助图题取图

复用现有本地layout和缓存，禁止新建OCR/Agent真源。新普通PDF使用page-regions.v3，旧首稿按旧政策恢复。只有来源与原图hash一致、区域与冻结候选一致才取图；交错图注/多栏/错号保守拒绝，答案差异保持待核。回滚先暂停v3批次、设OMNI_EDU_AI_PAGE_REGIONS=0停用新区域生产，保留v3读适配及原证据。

2026-11-01 C03采用独立目录恢复，显式切换且保留原目录；原事件/native/检查hash不可为迁移而重写。旧缺源目录信息不猜路径，外部目录无文件不恢复授权；复制副本暂停旧积压，保留原新任务调度。工程专项通过不降低FX07/10或将3条REQ提前记已实现。见docs/research/AGENT_OUTPUT_BACKUP_C03_20261029.json#restoreSlice。

## 2026-11-01 图题自动归档的独立来源检查

两遍AI一致、区域坐标相同和名义ready数不能证明裁剪完整。新图题必须保存本地像素边缘及RapidOCR首尾/邻题证据，下一页续题或来源未知保持待核；旧实验缺证据不补写成功。原PDF/首稿/终稿/错误裁剪保留，测试观察器失败不能归因模型或静默重放未知调用。原题面AI来源与教师核对来源保持区分。

2026-11-01 已保存成果检查读取原账本并按所选版本定位；保留原结果，不把失效投影覆盖原诊断。仅当前同内容可发起原本机检查，历史不改写/自动重检；取消复用原64清理。完整AT不以工程14个UI子检查代替，后续转适用C项；详docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#artifactChecksSlice。

2026-11-01 E08整包目录沿原SQLite/文件事实、选择后读取；列表不进流式事件。所选整包意图进入原start命令hash及工具绑定，后继状态按事实展示；集中验收不拆成简化AT，工程10项通过不改完整FX10/252标准。

2026-11-01 E08：成果来源是原事实的按需投影，明确绑定/领域确认/仅观察读取分别说明，不新建来源真源。合并bfaa6ae的ChatSources展开与引用焦点后复用条目，最终Pi8通过；FX05/REVIEW和全AT不提前记通过。

## 2026-11-01 整份试卷质量漏斗与共性修复

新普通原页冻结page-restoration.v3：覆盖字段只取题干连续原文，不混入选项摘要或解题公式；原第二遍携带有界本地字段检查代码，不新增调用循环。只有v3的临时parser输入可剔除与实际PDF页/总页匹配的末尾独立页码，原pageText/不可变回执保持。新输入冻结并复验总页数；旧v2/无元信息/答案册保持原语义，无新表、依赖、IPC或运行时。

整套验收仍失败；不放宽图题、跨页、双遍、数学符号与来源校验。先暂停v3批次再做受控回退，保留既有读适配和不可变证据。

## 2026-11-01 整套导入后的答案册关联

整套资料验收继续作为主线。已修复“先导入/OCR后关联答案册”被规则候选阻止的问题：原writer/CAS保留全部题目及教师记录，只在当前有效答案角色下默认隐藏未经处理的规则候选；原始候选开关可查看，解除关联恢复。教师编辑/确认/收藏/分类/使用过的记录不隐藏，来源过期或未知格式保持可见，付费AI角色冻结不变。抽题读窗口中途变更角色时留在pending重读，不误报来源变化。 无新表结构/依赖/IPC/运行时。保留原AI回执兼容限制。先关联后执行答案AI与“导入后关联”兼容；取消关联不隐式重放付费任务。


## 2026-11-01 K0文件式访问实施

K0沿现有文件Worker接通遗漏消费者，页权限改用原SQLite一条一致元数据查询；partial仅放行已发表对应页，原件/隐私/取消校验不降级。无新表/依赖/IPC/Agent；K0余项为资源协调和完整Pi链路。 [整体架构](../architecture/KNOWLEDGE_BASE.md)。


2026-11-01 E08：HTML教学文件目录是原账本的只读投影；Office生成器/旧show/get不接管HTML。时间语义明确成功保存回执/恢复核验/未知，不追填旧日期。沿原三版真实Pi夹具续测，不反复生成或重跑已知失败综合；完整来源导航与集中AT继续。

2026-11-01 E08：HTML不另建成果/版本真源，旧版本按需从原修改账本预览，OS查看副本可重建；恢复另存链接当前版本。教学文件HTML目录与全来源导航仍后续实现，不用合成Pi6替代完整AT或真实OS接受。

## 2026-11-01 知识库整体架构优先

按用户最新指示，知识库先冻结并贯通整体架构，固定K0→K1→K2→K3→K4；[架构正文](../architecture/KNOWLEDGE_BASE.md)作为唯一当前知识库顺序。保留现有本地组件，先统一原件访问及任务边界，不重新选一整套RAG产品；未完成单页实验保存本地stash，不混入main。若同真实留出集证明候选引擎更好，再在同层替换。


2026-11-01 记忆修复采用最小原组件协调：读回不同值保留输入、相同值释放已保存草稿；既有版本锁保持。5项受影响UI复验，不新增机制或重复综合验收。

2026-11-01 C03：一次综合回归的真实草稿覆盖只修原组件两处加载函数，受影响正式UI专项复验；保留首次整套失败，不重新跑全套掩盖。

2026-11-01 E07：当前文件三方对照沿原review返回可选快照，绝不将快照变成新事实库或批准；后续操作仍实读/重新确认。0付费合成SSE验证真实Pi/文件和owned强退，不新增安全审查。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#conflictReviewSlice。

## 2026-11-01 答案条目局部疑点与真实回写

新答案册单元冻结 answer-entry-uncertainty.v2，六字段响应按完整试卷标题与原题号记录局部疑点；两遍任一疑点拦截对应条目，未知/歧义范围及原 pageIssues 仍整页拦截。无政策的旧 first_saved 保持原提示/schema。解析器发现的跨页/漏条等问题也进入页面待核与整页检索门禁，不能只相信模型 outcome。既有题面资格、原件/图片/两遍hash、关联身份、教师字段、journal/CAS不放宽；无新依赖、表或IPC。

回退先暂停新批次，并以 OMNI_EDU_BOOK_ANSWER_WRITEBACK=0 停新回写；保留新schema严格读适配、原件、两遍原响应和v6 journal。恢复字段须走未被教师修改快照的CAS，不让未知旧provider执行新单元；无DDL回退，完整回滚未演练。 证据：docs/research/KB_ANSWER_ENTRY_SCOPE_20261101.json。

2026-11-01 E07：只补原受管安装等待接缝；工具运行与审批停止沿已有实际child close/原批准事务验证，不新增取消协议、执行器、依赖或审查层。测试固定已认可免费组件，正式Pi用同pin公开包字节的受控传输与本地合成模型，0新付费。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#stopStagesSlice。


2026-11-01 E07：沿Hana adapter、原Pi result/manifest/execution-bound补普通工具错误和有界纯读；使用原SessionExecutionRegistry登记重试等待，不引入第二执行器。缺文件由模型核对目录后再读，固定提示不自动猜替代文件；写入/审批/未知效果仍沿原账本处理。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#ordinaryToolSlice。

2026-11-01 E07：沿原journal、取消修复、task coordinator加单轮在线恢复；复用实际executing计数及配置锁，追加publisher结束栅栏，不加执行器。仅在原账本核对后清runtime失败标记，读回不执行工具或继承批准。 证据：docs/research/AGENT_RECOVERY_E07_20261031.json#recordRecoverySlice。

## 2026-10-31 原页题面与提示版本

新原页单元冻结page-restoration.v2及真实OCR状态；旧first_saved沿原提示。完整stem必须含选项、小问、表格和公式，projection不能代替规范题面；parser只临时识别已声明原文编号，不改原回执。真实缺图/跨页/不清晰继续待核。ai_final仅表示当前AI原页证据资格，不是教师确认或数学正确性保证。回退保留新单元严格读适配，不让未知旧provider静默恢复。详见docs/research/KB_PAGE_PROMPT_20261031.json。

2026-10-31 E07：复用HTTP恢复、事件journal、task resume与typed start，新增可选意图和公开事件，无新IPC/账本。真实测试发现文字接续另建任务，改为宿主两层复查ID/版本；原样准备稿绑定，编辑按普通新请求，不静默绑定其他任务。证据：docs/research/AGENT_RECOVERY_E07_20261031.json；日常进度 docs/goal/WORK_PROGRESS.md。


2026-10-31 E08当前版本：复用统一officeVersionFamilies轻量投影，原Office账本/原报告不变；当前交付证明策略只用于空闲教师任务复核，历史工具/来源证明不改。列表读后遇到新发布版本补读原artifact事实，避免整族消失；无DDL/依赖/付费。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json#currentVersionSlice；日常进度WORK_PROGRESS.md。

## 2026-10-31 封面跳过补强

封面跳过必须校验完整成功页回执、全部识别文字通道及明确无题线索；在原writer内复查版本、发表状态、游标和暂停，不能覆盖既有付费任务。当前页任务键采用原主键查询，不逐页扫描整批付费元数据。skippedCover从既有本地完成单元派生，原PDF/OCR保留，无新真源或云端权限。正式结果和边界见 docs/research/KB_COVER_SKIP_20261031.json；完整Goal仍active。

## 2026-10-31 答案册受控回写与封面跳过

新增目录定位微基准：5000页/10万条合成元数据、内存SQLite预热；去掉每次查整本批次元数据的旧fence，换为持久dirty/sentinel及writer复查，median3.3461→0.0219ms，P953.9623→0.0428ms。仅目录查找，不含原图复验、文件IO、AI、完整检索或自然40GB；不据此宣称产品提速验收。

MaterialBookAnswerRepository沿原MaterialAiRepository.drain空闲周期推进本地目录/匹配，复用主库事务与发送之外的历史原件校验。派生表material_book_answer_index_v1、material_book_answer_dirty_v1、material_book_answer_control_v1、material_book_answer_work_v1及不可变业务material_book_answer_journal_v1均在同一SQLite，无新服务/依赖/密钥。原页发表、答案更新、关联恢复触发work；一次一页/最多20道题/每页64KiB、200答案条目。当前页发表顺序以sentinel抑制旧页回退；单元/页回执变更置dirty，writer内再查pending与候选目录，并核对原图、两遍原响应、关联修订和题目版本。检索重建同时重建派生答案目录，保留业务journal。

v6保留v5的AI/pageSource/sources并增加book.roles；教师改角色解除相应来源，改题干不能静默沿用旧答案。Pi/题本读取重新校验journal和原页；解除关联不抹去既有已应用来源，新写入仍要求当前修订。typed materials:book-matches/book-match贯通原页面板，记录轮询只查受限行/版本，不反复读取整本原件。历史记录显示已写入不等于当前数学/教师验收。原AI/联网补答路径保留，书答案仅可用来源字段有book_extracted归属。

封面策略本地只接受明确书目信息且无实际习题线索、OCR成功；不按页码位置推断。无题封面跳过文件夹付费子任务，普通/不清/混合页仍进入原处理链。证据docs/research/KB_BOOK_MATCH_20261031.json；完整Goal未完成。

## 2026-10-31 协作者 E08 版本恢复记录

2026-10-31 E08：E08复用原保存事实与parent_artifact谱系，不新增版本真源或模型流程；教师恢复调用同一原保存队列，selected/current版本与command绑定。最后成功保存顺序派生当前，未核验效果不发布，完全相同字节不创建空版本。新工作台Tabs后只补本领域data-edu-domain，不更改全局CSS隔离或原生组件源码。 证据：docs/research/AGENT_DELIVERY_VERSIONS_E08_20261031.json；日常进度以docs/goal/WORK_PROGRESS.md为准。

最终再次整合main32e7071为c99f6bb，14处Markdown冲突保留双方，终态及对话UI源码与b35b5fc一致；最终build/type和240组件exit0。原Pi精简回复3项归b35b5fc，本次未重跑。最终构建另含答案分组功能，指纹/范围见AGENT_DELIVERY_CHECKS_E06_20261031.json#terminalSlice.lastIntegration；Goal active，完整AT仍待阶段集中，D盘日常/安装包未更新。

收尾实测：正常整合main0723242为b35b5fc，4处根Markdown冲突完整保留双方记录，终态源码与ec55ac2一致。最终合并build/type、240组件及同文件精简回复/双视口/冷启3项均exit0，0renderer；原混合UI9项归技术信息精简前构建；一轮综合207/207归整合前界面（legacy Pi0，观测到的主进程入口哈希与最终入口相同），没有重复全套。主进程3247835→3257529B（+9694B），本切片无renderer改动；合并renderer变大来自上游工作台。无配对时延/P95，不宣称性能不退化。Goal active，完整252AT新增已实现0，E06仍部分实现；D盘日常/安装包未更新，audit45保留。下一E07/E08+C功能对齐，E06语义/FX09矩阵与W3集中AT继续保留。回退ec55ac2保留成果/记录，无迁移，未演练。

## 2026-10-31 E06逐文件混合终态（第九切片）

终态复用本轮原账本和检查结果，不新增第二真源/审批；正文不暴露全hash及内部ID。工具间过程继续显示，文件工具后的模型完成断言先缓冲，最后统一由真实效果陈述。普通无工具回答不增加文件账本读取。

证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#terminalSlice；唯一日常进度docs/goal/WORK_PROGRESS.md。

## 2026-10-31 已知答案逐条证据（第二切片）

复用现两遍AI执行器/图像回执/typed preload/原页详情，按章节与题号派生逐条证据。没有第二套导入器、匹配执行器、RAG或数据真源。误解除后可恢复完全相同两份原件/版本且所有历史单元已保存为complete/review/no_questions的关联；空、在途、失败、未知或其他角色/来源批次仍拒绝。仅历史只读回执允许跨revision；发送、迟到发表和续跑仍严格revision，不继承云端授权。真实UI修订5→7、两尺寸/重启4项通过且0新增云端调用、原账本仍2次；最终新工作台复验修订9→11、同22条/两个试卷及失效错误界面/双尺寸/重启4项通过，0新增云端/renderer错误。

要求关联整合收尾：正常合并origin/main ad06954为4cc627b，12处Markdown冲突保留双方完整记录，本切片生产/脚本与0018ab3一致，无生产冲突。合并后build/type、240/240组件exit0；207综合和正式Pi旅程归整合前0018ab3，未重复全套。最终构建另含上游题册关联/非习题页处理，指纹及边界见AGENT_DELIVERY_CHECKS_E06_20261031.json#requirementsSlice.finalIntegration；D盘日常/安装包仍未更新。

## 2026-10-31 E06教师要求与检查依据（第八切片）

采用已有TaskView快照+声明规则引用，不增第二要求编辑器、真源或审批。实际检查finding附checkId，coverage从真实结果派生；未关联要求逐项展示。digest排除执行进度，包含任务/要求/来源；同版本不同任务不能复用。全文语义仍未验证，完整E06继续部分实现。

证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#requirementsSlice；日常进度docs/goal/WORK_PROGRESS.md。

## 2026-10-31 E06文字遮挡与系统字形（第七切片）

复用原Office检查器增加系统WPF字形覆盖与实际Z顺序完整矩形遮挡，失败归原visual类和原Pi有限修复，不另设Runtime/表/IPC。实际PNG仍是视觉查看依据，独立整形不能覆盖Office公式/嵌入字体。固定脚本以进程级-File运行以避编码命令长度限制，原只读/Job/清理保持。docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#layoutSlice。

WPS整合收尾：正常合并main e06cc05为bc9777e，15处Markdown冲突保留双方完整阶段文字，无生产冲突；WPS检查源码与610f3eb一致。合并后build/type及240组件通过，207综合与WPS实际路径归整合前610f3eb，未重复全量。renderer7179937B/SHA未变；主线检索改进保留。完整Goal仍active、AT新增已实现0；本轮WPS未更新D盘日常/安装包。最终指纹与边界见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice.finalIntegration。

## 2026-10-31 E06 WPS真实页面（第六切片）

沿既有FileCheckRules增加可选officeEngine，不增IPC/业务真源/包；旧请求缺省auto，Microsoft未注册才回退WPS。原文件面板用轻量原生select，实际报告引擎不能伪标。WPS新空Automation沿现Job归属；不因用户打开WPS阻断可独立执行的工作。见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wpsSlice。

## 2026-10-31 百条候选与共享重排预算

复用现BGE/ONNX、FTS/Lance和Pi，不引入第二知识库。20保留为协议批大小，整次候选100、重排总预算5秒；失败保持现原召回和来源门禁。扩覆盖与限等待分别取证，未以小语料或神经覆盖计数承诺自然Recall。证据见KB_RERANK_CANDIDATES_20261031.json。

本轮收尾：最终整合feef9d4保留main f4dce3f的资料库与侧栏改动，Word检查生产源码与44eb69a一致；整合后build/type、240/240组件通过。207综合归整合前a94ab29，Word停止/占用专项归44eb69a，未重复运行。既有PromptInput指纹/启动IPC两项失败门禁与audit45保留，完整AT新增0，日常D盘与安装包未更新；详细指纹、范围见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice.finalIntegration。

## 2026-10-31 E06 Word真实页面与停止清理（第五切片）

此前Word导出阻塞已定位并修复：输出路径显式[string]，Close/Quit使用[ref] SaveChanges；Word16实际三页A4含长标题/表格/OfficeMath现可沿原Pi检查→原文件面板两视口→冷启取回真实PNG。仅去掉字符串转换的同文件对照20秒无PDF。取消还发现Word锁晚于助手退出释放，新增最多2秒异步重试自有临时文件；最终停止/占用专项通过，原文件不变且不接管已有实例。

WPS、逐字缺字/语义遮挡、完整FX09与全教师要求绑定/混合终态仍未齐；E06及完整Goal保持active，完整252AT新增已实现0。随后E07/E08+C及W3集中验收。D盘日常与安装包未更新。回退上述调用/清理提交保留原文件、报告及PNG读器，无业务迁移，完整回退未演练。 精确命令/源码/失败和指纹见docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#wordInteropSlice；日常进度仍以docs/goal/WORK_PROGRESS.md为准。

## 2026-10-31 40GiB最终主线整合

正常整合origin/main ef55c53为03f4654，14处Markdown冲突保留双方完整证据，4个知识导入生产文件与a3667ce一致。整合后build（含typecheck）、240组件、协作者11项源码/4项真实Windows PDF、空间恢复UI3项、40GiB旧库再开3项均exit0；207/207属于整合前a3667ce，未重复运行，不冒充最终合并验收。再开首次尺寸断言超时保留，测试改为页面所属窗口并记录native/CSS/DPR，后续两尺寸通过，未宣称产品窗口缺陷修复。合并后混合首查3963ms、重启后4543ms，40候选仅重排20，速度/召回质量仍未达标。知识库切片无新依赖；上游明确直锁已安装unpdf1.8.1，故最终锁文件发生上游变更。audit仍45（8高29中8低/0严重，exit1）；0新增付费/上传。完整Goal保持active、完整AT新增0、D盘日常树与安装包未更新。下一步处理混合冷启和候选覆盖，再复现Pi/原题旧页数/字节限制。完整历史、失败及最终构建指纹见docs/research/KB_BYTE_CAPACITY_20261031.json#finalIntegration。

## 2026-10-31 先证明真实字节容量并修复全局I/O故障

沿现唯一资料/检索实现开展逐段10→40GiB实际文件压测，保留源码指纹，合成PDF负载字节与有效正文分开报告。没有用新知识库服务替换现SQLite/文件、PDFium/RapidOCR、FTS/Lance/ONNX/Pi。ENOSPC/SQLITE_FULL停止当前归档批次，权限问题仅局部失败；失败后只清理确认无业务引用的本次未发表副本。复用现typed IPC与重试界面，无表迁移/新依赖/云端授权。完整自然语义Recall/全科质量及EXE仍需独立证据。

## 2026-10-31 E06真实PDF页面与Word缺口（第四切片）

原Pi交付前及原文件面板现可检查PDF原字节的真实物理页数/逐页文本，并由Windows.Data.Pdf逐页栅格化，沿原PNG缓存、页选择、放大、历史和冷启读取。扫描页没有文本层时内容/数值/事实明确未检查；PNG尺寸读取实际IHDR，兼容本机150%显示缩放。Word只读副本→原生PDF薄适配已接入，但本机原生导出仍超时（不加入Job的30秒诊断亦未完成），生产Word等待限制15秒并明确未检查；不能称Word页面已实现。

实现1d86357，已正常整合主线3192261为7bb8671，无冲突。原生PDF4项、检查源码11项、240组件及构建通过；原正式输入→检查→一次整包确认→精确SHA保存→文件面板实际第2页/两视口→重检→冷启与扫描页/错页6项通过，同批成果续测停止2项exit0（2137ms含完整停止观察），最终Word超时/进程清理反馈2项exit0（0页，非正向通过）；首套UI因旧停止按钮断言exit1仍保留，不冒充整套全绿。最终源码9ebc430，合并build/type、240组件、11项源码通过，删除Word全局Options写入后的最终Vite构建及上述续测通过。完整AT仍未执行，新增已实现0/252，完整Goal保持active。证据docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json#pagedDocumentSlice。

已安装的Hana间接依赖unpdf1.8.1明确直锁（MIT，JS文件合计2141399B），不安装可选canvas；无新Runtime、业务表或IPC。PDF60秒/Word15秒、16MiB/64页、PNG3MiB/合计96MiB，沿原8槽和取消；仅处理派生副本，原文件SHA保持。主renderer7175.29→7175.68kB的0.39kB变化来自主线资料面板，本片无renderer修改；合成3页本机原生渲染1541ms、扫描页827ms，仅单次样本，未测流式/P95。0新增付费；audit45（8高29中8低/0严重，exit1），未自动升级。

继续位置：E06 Word原生导出原因与实际成功路径、WPS、逐字缺字/语义遮挡、全教师要求绑定与混合终态；随后E07/E08+C及W3集中验收，保持28组252项原范围。D:/WorkProject/EduProject日常程序和安装包未更新。回退本片原生适配/检查接入可保留既有正式文件、检查读器与可选PNG索引；不删除业务表或成果，整提交回退未独立演练。

## 2026-10-31 混合图题正文召回与质量复核

沿原唯一Pi、SQLite/本地文件和FTS/Lance/ONNX派生层修复，不引入第二知识库。正文与结构化题目风险解耦；转录两遍一致且没有文字疑点才进入检索，图题/答案/抽题疑点仍按旧资格门禁。共享NFC比较保留词元边界，已知题型词表独立；有界策略升级只重排旧质量阻塞。原模型响应schema、来源权限、正式组卷确认保持。详细证据见KB_TRANSCRIPTION_RECALL_20261031.json。

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

E06沿原Pi和原审阅检查候选，原draft/output为缓存真源；派生报告不授予文件权限。规则/版本冻结，自动修复每类2轮，人工改稿独立失效。正式保存回执追加实际检查摘要，不混淆保存与检查；缺Office渲染保持未检查。 详docs/research/AGENT_DELIVERY_CHECKS_E06_20261031.json。

## 2026-10-31 原重排模型预热而非换模型

冷查主要为完整组件证明/ONNX装载，采用现单一实例异步准备与复用，不改模型/分数/排序/资料权限；没有第二服务或业务真源。约863MiB实际工作集要求2GiB准备/1GiB释放滞回、30秒检查及10分钟上限；后台失败60秒冷却不负缓存明确查询。15秒预算、关闭立即结束等待并阻迟到进程。无业务schema变化，普通回退三个生产文件可恢复旧生命周期，保留上轮file.v1读取和新旧资料。模型驻留不是整机内存硬保证，需继续低内存并发与40GB实证。

## 2026-10-31 大图片保存文件，引用与回执保存SQLite

沿现本地优先真源，将新AI输入字节按SHA去重保存为file.v1，复用readMaterialOriginal、acquireWriterLock与data-root-files，不另造数据库/服务/备份系统。现图片上限4MiB不变；先记pending、写/sync/rename，再原短事务复验授权并发表引用。恢复每次8条/部分索引，不扫整库；临时占用重试与非法路径隔离分开。旧inline.v1增量兼容不强搬迁，回退开关OMNI_EDU_AI_IMAGE_FILES=0只停新写，已有file证据必须保留读器/文件/恢复。无新依赖与外发规则变更，不以冷热重排差异或13项受控UI检查代替规模与自然质量验收。

## 2026-10-31 完整来源证明采用异步IO

CPU证据显示主线程同步包验证造成SQLite回调等待，不更换数据库客户端/事务。活动工具以Node内置异步有界API逐次完整验证来源及模型缓存，保留逐级链接/目录与句柄身份/哈希；仅去除证明已覆盖的冗余重读，不缓存旧权限或正文。原空闲同步变更入口待独立迁移后移除；无新依赖/schema/IPC。普通revert本轮实现即可回退，不删业务数据；受管组件及E05身份不改变。

## 2026-10-30 计算结果引用与文件事实分离

计算结果仅本机当前run持有最多8个引用，报告由宿主直接使用实际结果生成；模型文本继续脱敏。正式CSV/HTML/XLSX仍归原SQLite/文件账本，复用一次整包确认和原版本核验，不引入新业务真源。CSV本身无类型：ID需按文本列导入，XLSX保留文本；公式样文本CSV加单引号保护、XLSX/HTML保留字面值。临时结果失效提示实际重算；已有部分整包仍走原resumeBundleId，不重写成功文件。

## 2026-10-30 AI整页正文进入现检索与小智（M04/M10）

AI页正文是可重建的检索派生物，不得伪造resource_chunks或提升为教师确认的原文。原MaterialSource.v1/题目与课堂确认保持原权限；独立material-ai-text-source.v1严格绑定原件版本、原页、两遍回执与正文摘要。异步搜索/读取结束须复验文档及父资料修订，失效引用不能悄悄显示新稿。

回退：OMNI_EDU_AI_TEXT_INDEX=0停新派生，已有原页/档案读取保留；旧MaterialSource.v1/QuestionArchive.v1–v5不变。新增三张派生表/列索引增量幂等，重建从原回执恢复，无AI重发；停用不得删除原资料、教师编辑或回执。无本轮新增依赖，main合入的受管组件另见E04记录。npm audit仍23项既有风险（8高/7中/8低），不称审计通过。

## 2026-10-30 版本配置与业务事实分离

复用原单版准备器、独立不可变目录及统一原子活动选择；schema2仅机器缓存配置，沿原SQLite/native事实，不另造任务账本。原run冻结、后续run切换，全宿主共享2进程FIFO队列，停止/取消只回收所属工作。0新JS依赖版本，完整E04/E05 AT留W3；来源与精确证据见WORK_PROGRESS。

## 2026-10-30 工具包与宿主权限分离

认可免费清单固定官方URL/版本/双哈希/许可/体积/健康条件；不接受模型或renderer替换URL/安装脚本。准备只激活本机配置，不授予教师文件/网络/账户权限；实际计算以Pi既有quickjs-wasi的WASM隔离执行，所有教学文件仍走原审阅服务。机器缓存指针不是第二业务事实库，版本升级与旧版回退仍需继续。

## 2026-10-30 任务模式不改变既有会话身份

手动压缩无当前taskRuntime时按既有control snapshot精确选择两种已知历史提示词之一，不能重新计算另一模式指纹后误拒绝旧会话。创建/control/memory原记录不重写，未知配置仍拒绝。教师原话及control为唯一请求真源，目录摘要只定位；长文先脱敏再分页，新工具使用独立additive identity。

## 2026-10-30 用实际原页恢复，保留OCR事实

新PDF图文批次统一整页page-response，不因OCR complete就假定可读；无OCR块时以实际页回执证明来源，不伪造chunk。原图复核与AI推导答案分开存，疑点仍待核。复用原SQLite执行器/账本/题本/预览/Pi；新增页来源表和小型读取接口，保留旧v1–v4读取。busy等待只重试确定未外发阶段，回退停新生产、保留新档案读取。

## 2026-10-29 任务承接与局部修改沿原真源

短继续只绑定本机会话真实教师消息与当前未完成任务，效果重新读回；实质修订形成当前要求，历史源不成为冲突的活动标准。PPT修改使用presentation-edit.v1+当前父文件version+新路径，宿主从原已保存草稿复制未改字段；版本/正文漂移拒绝覆盖。持续目标从origin.messageId对应的来源绑定，不能假设sources[0]就是当前要求；旧人工确认仍清除。

## 2026-10-29 等待本地发布，保留准确页界

目录AI复用当前PDF发布事务后再取canonical来源，不从staging伪造已发布正文。耗时可长但不能把正常等待判为失败，按持久游标有界轮转。旧误判自动恢复不涉及任何已关联AI请求，源和授权仍须复验；额度/暂停后结束本轮规划。修原确定性抽题器的明确页元数据边界，不放宽原AI质量或同源覆盖判断，不重写旧题事实，不新增模型/业务真源/IPC。

## 2026-10-29 E02沿官方能力映射

DeepSeek目录字段为effort.supported_levels/default_level。关闭=disabled/none；低/高/最高=enabled/low|high|max，基础输出上限4K/8K/16K/32K，再受可信窗口与输出容量约束。Auto问候关闭、日常优先低、复杂任务优先高；未完成短确认沿任务深度。每轮冻结，设置不生成，不把额外输出预算当质量证据。C03不阻断E03。

## 2026-10-29 保留原记录，以严格同源关系优先AI

不覆写原题或借相似度去重，新增可重建origin指纹及SQL覆盖标记。源版本/正文片段/原始题面必须一致，AI先通过原质量规则，原生来源须无歧义；历史事务内复验，坏行隔离。教师行为和来源/回执变化使覆盖失效；默认展示与待核汇总共用覆盖，原始记录随时可查。多AI稿不相互吞并，无法证明对应的记录继续保留。

## 2026-10-29 C类贯穿不阻断思考功能

默认产物备份与停写基础已接通，下一按W1进入E02→E03；完整新目录恢复、外部成果备份与身份迁移保留在C03，在W3集中交付前补齐，不降低完成标准，不额外把整个C03加为E02前置。

## 2026-10-29 复用原备份与保留读取

沿原manifest.v1增加有版本的输出附加区，旧包不改；源位置解析不创建目录，不扩大教师私人目录复制范围。回退先停自动文件写，保留新schema/native读取；恢复新目录另做完整路径/身份迁移与实际UI核证。没有新增真实付费模型调用或审核Agent。

## 2026-10-29 整包复用与刷新决策

用原两类服务聚合一次审阅，metadata只存引用；整包批准全部子草稿后才开始真实保存，某文件失败保留成功文件。独立读取全部子账本/磁盘才允许saved_bundle通过。仅对快照真实版本变化等待稳定，保留有限失败边界；不增加审核Agent或新依赖。

## 2026-10-29 规则收录不冒充核题

不新增archive schema字段或删除旧题，按既有AI回执/state/sourceChecked计算资格；无AI的导入来源题需教师明确核验，手工录入和AI自动稿保持。历史只更新needs_attention派生标记，联网只补缺失答案不能把未核题面升级为可组卷。原题与AI稿归并另需同源同题依据，不按近似文本覆盖。

## 2026-10-29 目录AI沿原执行器而非再建知识库

增加父授权/有界资源与单元游标，不复制模型/Agent/题库。事务任务键实现同目录/版本/单元幂等，AI调用保守预留2次、实际调用持久计数；结果未知不自动重发。父授权变更发送前复核，老师单题暂停不能由目录恢复撤销。有界轮转不能固定首16条终态。原OCR不替换，AI还原与补充解题来源分开，图题缺完整证据继续待核。

## 2026-10-29 精确PPT页的兼容决策

新presentation-draft.v1表达页ID与备注角色，不悄悄给旧Office v1增加字段。准确页数不靠裁切或自动加页；过密明确失败。读取先实测成熟Hana能力，原anydoc可读notes，因此不新增生产notes解析。现包能力与最终教学质量分别验。


## 2026-10-29 默认产物接入决策

采用单一现有文本修改/Office账本和原typed preload，不新增事实库/IPC/runtime/依赖。生成目录不替换旧native cwd，不额外打开office_copy_file；原teacher审批与版本核验保持。代码检查通过不回填完整AT；CSV被占用不绕锁。

## 2026-10-29 最新质量优先与后台边界

用户允许长时间静默处理，禁止为赶完成牺牲内容质量。先复用现持久队列，移除逐文件全库概览并交替发现/归档；不改OCR质量参数。DeepSeek以原图修复OCR，先忠实题面再独立解题/知识标注；缺失不猜、推导不冒充原答案，正式整卷集中确认保持。自动整目录AI及质量就绪规则尚未接通，不以提示/归档切片代替最终目标。

## 2026-10-29 Goal与审核精简决策

以四份规格执行，按依赖实现，不加无关审查/多Agent/评分平台；已有授权延续，必要检查一次，阶段齐备后集中验收。只有AT全部标准/证据满足才三处备注已实现；回归失效重开保留历史，不把局部通过扩为整组。

## 2026-10-29 最终效果驱动任务与验收

所有功能按WP任务、REQ最终效果、AT操作断言、FX数据/答案追踪；E01–E03先行，E04–E08依赖推进、C项贯穿，理科S后全科T。252用例可由少量完整旅程共同取证，不要求252次模型调用；实际效果/费用/兼容优先，未知字段与包hash不凭空编造。
## 2026-10-29 依据真实不足修复宿主，而非盲换后端

完整WeKnora Lite已在Windows未改源运行；九份OCR文本可检索，但原始六图需VLM、三PDF缺DocReader失败，原生百万向量热P95 3755ms。因此不直接切为生产默认。保留已成熟LanceDB/SQLite事实与Pi，先解除原图纠错被OCR字面锁死、核心题库被目录和首条候选假空隐藏的实际缺口。新回执两遍一致不是独立数学正确性；新旧批次严格分版，正式整卷确认保持。

## 2026-10-29 以真实交付确定能力排序

用户明确选择先通用执行，再理科，最后全科。Hana/Pi继续作为唯一Runtime；参照Cowork完整执行、NotebookLM来源工作、Khanmigo/MagicSchool/Brisk/Diffit/希沃教学工作流。具体新增功能列为候选，共同判断后纳入，不把商业产品描述当源码可复制或已优于竞品的证据。

## 2026-10-29 流式响应与窗口拖动

在OfficeMarkdown应用适配层稳定components并默认关闭blurIn，不修改成熟vendor组件；推理100ms合并保留终态flush。原生窗口标题栏只将实际按钮设no-drag，保留Windows caption按钮和既有位置持久化，无新IPC/迁移。

## 2026-10-29 实际窗口过程记录失败修复

截图对应D:日常08e26bc构建，正式SQLite三轮均在工具开始前失败；最新291条累计推理约1.09秒生成、约19秒落账，工具回执0。证据支持推理积压路径，原始异常日志未捕获，不能断言唯一根因。当前版本已有33ms推理合并，本片再让streaming reasoning与正文共享16ms落盘批次，生命周期/工具/终态仍立即flush，保序不丢事件、不放宽权限或超时。实际300段SQLite专项保留302条事件、≤4批推理写入并可继续工具准入，20/20通过（pi-event-journal-eI9ERJ）。原失败记录不删除、不自动重放；本轮无真实模型请求。回滚为revert本片或恢复日常目录备份ref；不回退用户数据。

## 2026-10-29 功能先交付与原生资源边界

遵循用户最新顺序：补齐前案功能，每片必要测试一次，最后集中验收。会话资源层复用原生SessionManager的加载结果，通过独占租约/完整字节失效/空闲淘汰管理；不持有任何旧AgentSession、API Key或业务闭包。附件/文件引用扩展现来源字段和typed预览，不新建来源数据库、IPC或模型调用。

## 2026-10-28 Hana回答优化独立切片

沿Hana/Pi直接复用ToolCatalog并薄接当前工具，保留运行时/持久化与权限；DSH式重复调用提醒不硬禁轮询，HTTP恢复不重放部分输出或工具。SourceWeft式证据登记不冒充语义正确性。常驻HanaEngine涉及run闭包，当前仅复用经过全内容复核的解析对象，不缓存教师授权。详HANA_ANSWER_QUALITY.md。

## 2026-10-29 依据运行结果保留候选边界

继续直接复用成熟方案评估，不因SQLite或包体预先淘汰。当前AnythingLLM/Docling默认处理未满足扫描题完整与来源定位，不盲切生产；WeKnora固定源Windows Lite本机构建继续，Pi/SQLite/原件领域事实保留。导出工具和Pi指令统一承认已授权试卷保存位置，不新增普通文件权限。历史0文件是当时失败，本轮四文件成功不倒推未知根因或整体完成。

## 2026-10-28 本体和受管组件分开

按用户最新澄清，不要求所有依赖打包进一个EXE；安装或首次启用可自动下载/配置成熟后端、运行时和模型，由小智统一管理。公共组件下载不改变资料外发规则；不因进程/包体预先淘汰整套方案，也不未经实测直接换默认后端。细则KB_MANAGED_COMPONENTS_CONTRACT.md。

## 2026-10-28 重开整套成熟后端候选

修订旧v4仅将成熟产品作参考的预设；先用AnythingLLM官方发布版作完整Windows个人库对照，WeKnora Lite作整套检索后端候选，Docling为复杂解析候选，kotaemon为证据交互对照。无实机/同资料/规模结果时不指定质量胜者、不迁移默认生产；只复用检索/阅读等通用能力，不接第二Agent或第二正式题库。用户几十GB高效检索要求前置于后端定案。

## 2026-10-28 所有分支先统一

10个本地有名分支均为fdc8e9c祖先，禁止重复merge旧分支或用旧整文件覆盖新UI。旧D:残留启动/doc增量逐行已被main包含，先本地保全再消除冗余；素材不上传、不移动，使用git/info/exclude本机排除。F01以明确未验收检查点398e5e7保存，615a6d2三方保留新UI。自动审批复用现权限选择，先核同步/scope后派发，旧响应不影响新会话。

## 2026-10-28 最新授权与修复边界

用户追加授权本知识库任务真实DeepSeek测试不限次数，覆盖历史总7次；记录实际发送并优先本地定位，最新请求先拉取重审时暂停付费。结构修复只消除卷首说明、完整块线索和连续小问的误判，以及明确填空/选项句号版式差异；OCR缺条件、公式/否定变化和缺图继续隔离。任务目标只在无workspace的saved_office使用已授权paperOutput，不新增普通文件权限。单层草稿服务通过不等于真实Pi导出通过，真实0文件的configuration仍是下一阻塞。

## 2026-10-28 F15复用既有receiver

当前已具备gap/tail恢复，不新建序列或因旧静态报告改写生产路径。只扩展现真实Electron受控传输harness，所有补页取实际main IPC/SQLite数据。时序/逐token/草稿/零写入/每run单在途和冷启均验证后，按限定范围闭合报告风险；真实provider、任意规模延迟及全部Stop/审批组合不由该测试证明。

## 2026-10-28 真实模型格式兼容与预算

只在provider边界兼容根对象精确type=json_object标记，继续严格校验题目schema与来源；不删除其他未知字段，不把HTTP200等同成功。原授权4次后用户追加为总7次，持久ledger实际7次，到此停止云端；这不是后续默认付费授权。原资料/密钥/原响应不进Git，隔离数据留本机复读。旧文字题一致性与缺图资格不因测试难通过而放宽，PDF/图像适配须另用真实证据补齐。


## 2026-10-28 F14只修恢复生命周期

复用现typed snapshot/settings、receiver及SQLite，不新增协议/表或第二事件序列。缺快照事件恢复可join；操作后fresh请求要求调用后的读；所有附带状态按scope token守卫。自动恢复最多8次冲突，失败后terminal/gap/unavailable不得通知风暴，教师显式刷新仍可重试。本片未做流批次或全局快照性能重构，F24预算不校准即不称性能验收。

## 2026-10-28 审计基线与产品规则

以用户指定2026-10-28 DOCX为26项整改真源，旧静态建议逐项核实现码。WP0有限历史采集可先落主线，F24未完成；同构建7/18失败不调阈值掩盖，不冒充CI稳定门禁。CLAUDE.md完整保存用户十条及六项交付要求。独立审核固定用户指定Terra/high；每项新分支，刷新整合/正常push HEAD:main并回读远端，保留其他工作树。详见本轮TODO与EVIDENCE。

## 2026-10-28 统一账户与每轮主线交付

按用户最新要求，知识库生产调用复用小智现DeepSeek API Key，固定deepseek-flash完成图文两阶段；不配置第二云厂商/Key，不改历史Qwen证据为DeepSeek。必要Word三角色PNG与本地OCR按批授权，源图持久化不赋予重启自动外发许可。题本AI自动定稿，正式整卷集中确认原则保持。

用户明确每一轮结束提交并推送到GitHub主线main，作为持续固定动作，覆盖历史仅本地整合/等待全Goal结束再push的时序。正常提交与合并推送已授权；不包含强推、发布安装包或覆盖协作者现场。占用main时当前分支整合最新origin/main后push HEAD:main并核远端，不能背后移动另一工作树已检出main。

<!-- kb-native-ledger-20261028:start -->
## 2026-10-28 原生AI业务图片与持久输入（完整目标继续）

选择独立业务PNG及不可变AI输入，不依赖预览LRU或重启重截图。私有Word producer attestation与实际AI transcriptor分开证明原始像素/AI角色文字，不能靠模型自报SHA。准备连接专用autocommit，caller writer事务发布，禁止共享连接BEGIN/ROLLBACK探针；来源base逐字段比较，不把JSON属性顺序当身份变化。重启恢复的本地证据不继承为新外发许可。
<!-- kb-native-ledger-20261028:end -->

## 2026-10-27 交互Electron不得隐藏启动

> 2026-10-28 主线交付：用户已授权提交及推送；本节通过结果为10月27日D:历史证据。本轮依赖安装未完成，build（缺tsc）/组件（缺react-aria文件）exit1；原生专项未重跑。专项已补全新工作区目录初始化。详见 DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md 的发布与核验记录。

受控同构建对比确认首次窗口被windowsHide:true压制，仅将日常Electron spawn设false。用户已要求显示并启动最新项目；后台build辅助进程继续隐藏。保留协作者全部脏工作、既有profile/数据、环境过滤、构建失败边界与单实例。不同版本页面未复现，不能把隐藏现象直接等同旧bundle。合同：DAILY_LAUNCH_VISIBILITY_CONTRACT_20261027.md。

<!-- kb-web-writeback-20261027:start -->
## 2026-10-27 S6-C 持久联网补答与批判修复

复用Hana+原样Mozilla DOM，不引另一Agent/浏览器/服务/依赖。web独立来源账本不伪造teacher或Qwen。批次许可不继承给generic web/MCP；成功缺答实读即待批，补答Pi顺序执行且DNS/发送前重查。完整同题/角色原文仅证明关联与来源，不证明数学正确；与已有答案/解析未能一致时候选。正式整卷仍集中确认。
<!-- kb-web-writeback-20261027:end -->

<!-- kb-enrichment-read-20261027:start -->
## 2026-10-27 S6-C 缺答题实读与独立批判修复

S6-C先补齐缺答案题实读，复用现Pi/typed工具，不为同一题新建第二题库。purpose仅改变完整答案准入，沿用原始来源和隐私闭包；同一题的不同用途分配不同别名，补答不登记下游完成实读。必要续查采用受限offset并明确不保证并发改库时全局快照；每条实际内容仍按原版本强复验。自动答案写回保留为下一必做步骤，不以复制网页或模型口头表示代替事务。
<!-- kb-enrichment-read-20261027:end -->

<!-- kb-dom-enrichment-20261027:start -->
## 2026-10-27 选择Hana DOM加Mozilla Readability

用户问DOM元素取数是否有成熟方案，已核Playwright MCP Apache-2.0、Stagehand MIT、browser-use MIT与Mozilla Apache-2.0官方来源。选择直接复用已集成Hana和Mozilla Readability原始源码，保留唯一Pi及Electron权限/生命周期；不为相同能力再引Chrome/Python服务。指定ref保可见内容，整页Readability筛选另标lossy。提取结果不是可直接写库的答案，下一须题面匹配/持久网页来源及专用CAS补空。
<!-- kb-dom-enrichment-20261027:end -->

<!-- kb-word-proof-20261027:start -->
## 2026-10-27 原生图稿缓存不冒充AI事实

复用已有Electron/静态Office隔离与本机字体，不新增服务或运行时依赖；PNG按角色来源布局且不虚构Word页码。源摘要/字体/引擎/固定1x环境作为身份。使用独立派生缓存而不是修改教师confirmed账本；以后AI正式图片必须另有不可由缓存冒认的来源账本。Windows OS锁保护异常恢复和发布，备份仅省略精确缓存目录。用户授权保存协作改动并合并main，其他未归属文件不入提交。
<!-- kb-word-proof-20261027:end -->

<!-- kb-word-question-20261027:start -->
## 2026-10-27 Word原生题目角色与证据

采用独立原生Word范围协议，不虚构Word页码或教师确认记录。区分原段proof清单与本题所选范围；来源强校验包含完整document SHA、确定的ordinal和范围，不只检查JSON结构。歧义共用材料、答案合并、数字层级和独立答案册保留为待分析原因。共有前缀只存一份，按需组合。

完整AI文档使用archive v3/独立AI来源账本的既定方向继续；本轮仅实现可操作来源基础，不修改当前AI归档资格、上云授权或正式整卷教师确认。D盘协作者未提交的主线内容保留，后续在其提交后整合，不挪动在用主线指针。
<!-- kb-word-question-20261027:end -->

## 2026-10-27 只隔离无生产消费者的启动读取

选择在现有App bootstrap中按已确定runtime分支，effect等待判定；保留app:bootstrap及共享学生刷新，不拆整棵ProductApp/LegacyTestApp、不删IPC/旧入口、不改宿主权限与启动器。Pi与资料阅读辅导仍使用现有会话接口。旧bootstrap被执行已复现，但其与用户偶发版本页面的因果未证明。合同/回滚/门禁：`PRODUCTION_BOOTSTRAP_CONTRACT_20261027.md`。

<!-- kb-word-20261027:start -->
## 2026-10-27 Word 图文来源与主线续接

选择有界 OOXML 读取补齐 anydoc 0.1.2 的公式丢失，其他 Office 继续用现有通道。Word 只保存真实部件/节点，图片不外取，嵌入对象不执行；OMML 原式保留，不能表示的公式/图像明确警告。显式重整仅替换派生正文/索引，旧题库事实和隐私标记保留；新版来源与旧题来源不静默混用。
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

S5-B3已接通有限中文交叉编码器：资料库、同一题本与小智现检索适配器使用BGE-reranker-base q8，对前20对象评分，再与原召回等权RRF融合，未评分尾部保留。新冻结Windows EXE懒启动、15秒总预算、队列/输出/窗口有界、空闲回收；错误/超时保留原排序并显示降级。模型不更改题目、答案或来源，不给教师展示虚构正确率。

末次返回改为对象版本及父来源revision的一条SQL栅栏，保留不受后台新资料影响的结果；父来源变私密/删除只剔除相关项并明确partial。新增retrieval_source_revisions派生时钟，不进入向量事件类型；历史seq0和墓碑的存在/内容/seq来自同一SELECT，防止旧行被错误绑定到新seq。原事实与索引世代不因重排重写。

选择base而非m3随包：开发集base0.874/m30.883纯cross但后者延迟约2.6倍，base与原召回等权融合减少开发集退化；冻结独立v2后再验证，未依据v2重新调权。

已隔离到apps/desktop/.retired-builds/S0-20261026（旧安装包/程序约1554876094字节）和m3-evaluation-20261026（未采用评估权重约587843930字节），共2142720024字节。当前选定base模型与最新out不在这两处；原.release路径已收起，后续全新安装包另构建。删除情况待用户实际操作，未替用户确认完成。

整体Goal继续active。下一主线优先完整图文题/Word来源表示与归档、跨页/答案配对、可选视觉AI；随后旧代缓存GC、自然教师质量与长上下文/冷启动优化、40GB持续处理与统一最新EXE。当前合成质量/小型路径不能冒充企业级或全目标通过。当前codex/knowledge-base-delivery、HEAD d3e2dec，未提交/合并/push；全目标完成后读取最新main、保留协作者变更并处理冲突。
<!-- kb-rerank-20261026:end -->


<!-- kb-semantic-20261026:start -->
## 2026-10-26 本地混合召回与批量索引（整体继续实施）

S5-A与S5-B1已接通本地题意检索和有界批量索引：冻结BGE中文embedding、LanceDB派生向量、FTS关键词RRF融合，资料库/同一题本/小智工具共用来源复验。教师可按改写题意查询、暂停/继续/重建；无系统Python或运行时模型下载。每批最多16事实、200000 UTF16字符及900KiB JSON，双文档编码穿插查询，推理后批量提交、receipt最后、事件批尾ACK。旧seq不能复活墓碑。

来源依赖随题目事务维护；父正文/资源变化推动关联题目事件。archive按正文hash/隐私/可读状态校验；完整原图题按所有嵌套题面、答案和解析引用页检查隐私，未知/非法页按可能引用处理。OCR失败本身不废弃已核验完整原图和教师转写。来源升级DDL、触发器、source-closure.v2标记及重建安排在同一writer事务提交，中断回滚后重试；旧失败墓碑只能使用旧快照seq，不能误标教师刚修正的新版本。

模型与索引留本机；不增加第二Agent、网络向量服务或运行时下载。FLAT现状与未实施的ANN/重排分开记录，不把存在optimize方法当已执行。

当前codex/knowledge-base-delivery，HEAD仍d3e2dec；未提交/合并/push，未修改协作者main或D:日常目录。用户已授权完整功能完成后合并main并解决冲突；届时须读取最新主线、保留协作者变更，不能沿用旧主线SHA或提前宣称交付。
<!-- kb-semantic-20261026:end -->


<!-- kb-pdf-20261024:start -->
## 2026-10-24 长PDF持续处理落地（完整目标仍进行中）

S2-B已接通长PDF按页持久处理：受管原件同一Windows只读句柄核验SHA，页结果逐条校验/事务落库后ACK；manifest/世代/任务lease与工作进程存活共同守卫发布。原生文字与OCR分别保存，混合页检查原生正文、数字和数学符号覆盖；needs_review/failed不发布正文。停止保留成功页，继续与显式重试分开。来源预览/layout支持第50页以后、直接页码跳转及已打开预览跟随引用。原件上限16GiB、10000页与单页/暂存预算是设计边界，未宣称已测极限。

按持续目标优先解除长PDF的50页/50MiB/整书base64限制，不引入第二Agent或新模型。基础页处理与AI定稿分离；问题页保诊断，不把处理成功当题答正确。旧PDF升级为显式动作以保既有引用；批次重试只处理未完成资源。Git主线合并在完整目标完成后进行。

当前真实证据：固定新runtime 646文件/279039929字节，无新模型或Python依赖；61页/56272644字节明确合成混合PDF，1644453字符正文，59页完成、1空白、1超限失败，partial可检索。Electron主路径5项/2启动/0renderer错误；另3项来源跳转/双视口检查，旧S3数据库副本3项兼容读回。build、最终typecheck、renderer217/217、发布守卫4项和原生/OCR覆盖5项通过。精确记录见KB_IMPLEMENTATION_EVIDENCE.md；这不是自然教师资料质量、40GB规模或新安装包验收。
<!-- kb-pdf-20261024:end -->

<!-- kb-implementation-20261024:start -->
## 2026-10-24 知识库功能实施进展（整体未完成）

用户再次强调按既定方案实现功能、停止以重复测试验收作为主要产出。本轮直接落地S1和S4-A，保留必要检查，不再反复打包。新增表/typed IPC/资料UI按KB_IMPLEMENTATION_CONTRACT.md；无删除性迁移或上云。原件物理内容寻址目录/全库迁移与S1解耦，本片保持旧原件布局。

本轮依用户要求以功能落地为主：S1文件夹持久归档与S4-A正文检索已接入当前源码。目录批次/逐文件状态/暂停继续重试、退出后自动接续可用；异步流式复制与取消避免大文件同步阻塞；新正文事务内索引，旧正文后台补建，中文短词/NFKC公式字符检索和真实来源跳转可用。Pi education_search_materials复用有限FTS候选，未解析/索引未完成/候选截断明确报告覆盖不完整。复杂图文切题/独立题答配对、AI图片对照定稿、语义向量检索和40GB验收仍未完成，不把原件归档冒充自动题库完成。
<!-- kb-implementation-20261024:end -->

## 2026-10-26 main交付与用户指定分支清理

UI提交ce98bd1已成功推送origin/main，旧锁阻塞已解除；本轮build、renderer217＋样式8、合同25通过。用户指定的GitButler与orch-t1-paper分支已备份清理，D盘619个未提交文件及知识库工作树保留；未将大范围未提交内容冒充已合入。详见 `../audit/branch-integration-2026-10-26/README.md`。既有10月24日运行证据保留，不宣称本轮重跑provider；Master与整体业务UI精修仍DOING。

## 2026-10-24 已批准UI基线的正式替换

用户已确认统一亮色布局及过程→整体折叠→正文时序。正式展示已在同一1c54工作树接入；真实流程与样张证据分开，仍不把外壳迁移等同全部领域业务验收。M10展示切片、测试边界与main合并状态见 `../design/ui-rebuild-2026-10-24/DELIVERY.md`。Master仍DOING，本地优先、教师确认、Pi唯一编排与来源规则未变。旧记录保留为历史，当前以本段和最新交付为准。

## 2026-10-24 当前：撤回UI对齐结论，建立重建审阅基线

用户明确否决前轮UI；旧测试结果不能继续作为视觉接受。已只读复现旧真实构建并记录11处CSSOM，证实旧玻璃主题/无layer外壳规则继续覆盖原厂；旧应用AgentTrace组合也不等同官方示例。已在同一1c54工作树保存177文件回退快照，建立15页合同、原厂示例对照/组件指纹、可点击Electron审阅稿。合同检查21项，样张22项/0pageerror，renderer217＋隔离8通过；本轮未替换正式业务页、未发新provider请求。已询问整体视觉与过程组合，等待用户确认，不擅改组件配置。main/远端仍b5a7fc6；旧空锁仍在，先前清理被自动审批拒绝，未提交推送。详见 `../design/ui-rebuild-2026-10-24/README.md`。 本轮不变更Master的本地优先、教师确认、来源与Pi唯一编排规则；总体DOING。

## 2026-10-23 当前：官方Agent Trace Streaming与正文体验

本轮用户明确取代DSH预览：采用官方多块/嵌套组合，运行展开、整轮终态收起、正文独立流式；删除输入上方额外遥测，目标控件迁至侧栏。普通解释自然段落，必要任务结构保留。最终真实Electron25项、原厂亮色双尺寸与控制台通过；边界16/轨迹19/renderer217＋样式7、技能25/22/14、兼容旧路径207通过。没有新SDK循环/依赖/DDL/IPC，权限与教师确认保持；Windows原生路径解析只替换等价调用、不缓存授权。首段仍有约6–7秒本地准备延迟，整体视觉/性能和Master仍DOING。Git main交付尚受遗留index.lock阻塞，清理被自动审批拒绝。证据与精确命令：`../audit/chat-ui-2026-10-23/AGENT_TRACE_STREAMING_DELIVERY.md`。


## 2026-10-23 最新：用户确认DSH默认披露策略

用户选择默认收起＋真实单行预览，取代运行时自动展开全文；手动展开跨正文/完成保留。工具与过程独立，不在思考区重复准备/等待/生成；原始推理和持久化不改。保留HeroUI原厂设计，仅应用预览内容做单行溢出布局；不引入DSH CSS或可选外部翻译。参考固定官方commit687f282e。

## 2026-10-23 最新：用户批准模型推理字段

用户明确批准MODEL_REASONING_ALIGNMENT_PLAN，取代仅执行轨迹选择。接API明确返回的推理文本，非未公开内部状态；默认原模型low，沿Pi唯一循环和原生回传。展示独立脱敏/限长/metadata版本化；正文导出不包含推理。原厂设计/亮色/教师写入确认保持，无新增模型调用、依赖、DDL或IPC。不得为凑时间轴伪造某个工具回合的推理。

## 2026-10-23 样式审计与公开阶段补齐（当前）

用户先批准A恢复组件原设计，随后指定不使用暗色，并再次要求解决空过程；据原有确认继续补齐公开步骤。凡改变组件设计必须另获允许；保留外层布局，应用CSS在原厂保护边界止步，禁止vendor修改和全局!important。公开状态不替代私有reasoning。 证据：`../audit/chat-ui-2026-10-23/style-audit/DELIVERY.md`。

## 2026-10-23 Agent Trace Streaming

用户明确选择真实步骤/工具结果/公开说明，以及正文流式、整轮完成自动折叠。采用现有Pro组合示例，不接入隐藏reasoning。当前流式段无法预知最终性，先在正文显示，真实工具边界后才归入过程；计时标明总处理时间。直接main提交推送授权持续有效。 详情：`../audit/chat-ui-2026-10-23/AGENT_TRACE_DELIVERY.md`。

## 2026-10-23 阶段一与Git目标更新

用户授权每轮提交推送，随后明确目标为main；远端原无main，已从a547557建立，master/default设置保持。UX-00先冻结真实基线，当前不跨域重构。测出1000条输入迟滞后，下片先查组件订阅/历史渲染；必要分页/虚拟化另立兼容合同。性能目标与非原生输入测量边界见 `../audit/chat-ui-2026-10-23/ux00/RESULTS.md`。依赖audit不通过保留为独立修复事项，本片不强行升级。

## 2026-10-23 对话展示修复与下一轮规划

公开阶段/数量采用可选事件字段，旧记录保守兼容；数学兼容只改渲染；回复保存采用主进程取持久化正文+SHA+原生目录选择，复用既有Markdown产物，不新增schema。用户最新要求先规划交互架构调整：先聊天与成果工作台，后跨域导航/学生；性能测量提前，保持Pi与领域审核/授权独立。不因方案文字自动启用自动答题提交、远端PR或团队模块。详见 `../audit/chat-ui-2026-10-23/DELIVERY.md` 和 `NEXT_IMPLEMENTATION_PLAN.md`。

<!-- 以下保留 D 盘停写前的历史记录，供业务追溯；当前状态以上方 main 记录为准。 -->

## 2026-10-21 资料备课：写锁、计划语义与审阅确认

小智状态写入在同一Store内先排队再开事务，解决SQLITE_BUSY；事务内部保留同连接CAS。无taskStepId的safe_read/local_cache不获取task-state写锁，所有写/外部效果仍走任务准入。

任务计划kind按实际操作映射；file只读，saved_text写md/txt，human只最终教师确认。显式保存不要求老师额外发言，保存工具的全文/差异卡就是确认边界。任务计划参数schema继续冻结；只调整外层工具说明和运行提示，避免旧会话configuration。

## 2026-10-21 教师答复误停修复与主线收紧

实际答复在idle3误停后，选择把输入送达与成果证据分开；不把模型草稿变化、报告摘要或计划版本算进展。readTeacherAnswerDigests核控制行/事件hash/原生回执/owner并按答案正文去重；GoalProgress新增严格v2，v1原字节可读。纯草稿仍须原教师候选核对。按用户要求C2a收尾后回资料备课→题目辅导→课件复用，底层剩余仅作为主线支撑推进，完整Goal边界保留。

## 2026-10-21 等待审批退出崩溃：限定修复验收

直接app.quit也复现134，不能归咎于Playwright断连；仅关闭store又暴露renderer访问已释放db。因此先停止IPC准入/drain、关闭本进程窗口与生产者、最后SQLite close；重复quit不能提前退出。复用现数据库/领域取消/Pi，无新Loop/IPC参数。save回执保持实际uncertain，不能由安全退出补造成功。限定证据与剩余边界见harness-shutdown-20261021-ipc-drain/progress.json。

## 2026-10-21 资料定位采用真实来源身份，单列继续与完成

Vw9fcT证明三个不同目录会误停，不能把list/stat的执行成功直接算进展。RdhBQT/nPpPRd又证明异步绑定时才读dev/ino会认到替换后的同名目录，因此Hana在实际IO附sourceIdentity，main独立核当前身份和快照。同物理来源list/stat同一进展key，元信息时间与条目变化不续命。

目录快照在批准写入后可能合理改变，故定位只作中间checkpoint并留journal，最终教师成果标准不含目录/元信息；原正文、效果、Task source/criterion均不放宽。旧无身份记录不给新信用，不补造旧通过。新schema是data增量、工具参数与SDK身份不变，无新Loop/包/表。完整H05与退出待归因项保持OPEN。

## 2026-10-21 教师标准身份与Goal位置解耦

新增标准由main按requestId/行位置生成ID，renderer只提交新行text；保留项ID稳定，撤回不删除机器标准或自动完成任务。输入可省ID是增量合同，持久action仍必须全部含已解析ID，旧文档继续读。Goal文本数组按当前human顺序比对，不按新位置重编号；旧Goal accept也复用当前Task标准ID。正式Goal清candidate后不再把旧答复显示成可确认，需显式恢复。

新增要求映射到已有教师核对步骤，空human步骤保身份并关联当前要求，机器依赖/效果不退役；checks清空/暂停后按新版本核对。68事件/原生回执与7项桌面、12项边界已验；完整H05仍待合法探索等策略，不将标准变化本身当结果进展。

## 2026-10-21 原稿历史输入独立核验与教师标准增删

原生yNlxmZ暴露合法“读原稿后批准修改”会使原读取unknown，故新增main-only before关系，严格原始SHA＋脱敏全文＋同run新批准native/edit账本＋当前after读回；公开历史输入标识，不放宽当前file标准。a75514项原生及边界/SQLite/native独立对账有效，原失败保留。

下一教师标准增删继续复用同typed correction/事务；新ID主进程生成，保留项ID稳定，不能按新位置重编号或删除机器核验。新增/撤回只使旧结论失效并暂停，不自动完成。合同H05_TASK_STEP_ACCEPTANCE_CONTRACT顶部；不新建Loop或表。

## 2026-10-21 正式目标共用任务验收与事务

从教师原始标准出发：goal保存的objective/criteria为权威，合成prompt只作执行上下文；新增TaskView.goal digest关联固定human IDs，运行revision/waiting不升级标准。复用现Pi/TaskTeacherActions/原SQLite事务与核对卡，避免第二套可绕过系统proof的完成入口。旧GoalController.accept转同main核验，缺adapter不能确认；唯一旧task可显式采用，多个旧task不猜合并或复制效果。

实际mxoWq1发现返回失败仍留下human passes，故把全部必需机器当前通过设为正面动作提交的前置；goal/task/action/history/复合事件一同回滚，负面决定仍可记录。标准修正同步goal文本和task版本，旧候选/proof清空；新要求可能需要重新审批改稿，下一实例须验证此流程，不能直接放宽旧admission版本过滤。

界面复用既有HeroUI核对卡，保持陈旧revision门控和显式刷新；1366展开高度压力与历史核验范围措辞列H09继续，不声称已完整对齐闭源界面。受控模型流、真实本地效果、真实provider和教师使用分层验收；整体Goal不因本片关闭。

## 2026-10-21 显式任务恢复复用原Pi，历史效果只重查

采用task-resume typed命令，不按普通消息语义猜续接。原host.start/command幂等创建新run，保留task/step/criterion与要求版本；附加lastRunId兼容旧记录。相比复制旧tool_call或新起独立loop，现有native/receipt/effect reader能保留原权威、防重复写并继续原Pi；不重放旧批准。最终教师确认重查各run实际产物，而不是只认可最后run文件。

准入核来源前后及传递依赖，human步骤不能冒充机器写目标；旧效果未知停在unknown，不能为测试改failed/passed。可修复task拒绝与真正journal持久化错误分开，后者原子回滚/停止publisher。正式goal原入口暂保留，必须另做多标准/来源版本adapter，不能复用单human标准假装完成。无新包/DDL/凭证/网络设置变化。

真实provider有历史402期间使用明确SSE夹具补安全反例，不提升provider验收，不反复收费重试。UI单run历史结果与跨run最终确认保持两份真实记录，措辞层级列入H09。完整B2/Goal继续IMPLEMENTING/ACTIVE；证据harness-h05b2-20261021-resume-delivery/progress.json。

## 2026-10-21 教师备课优先的科普产物

采用现PPT内嵌GIF＋可编辑问题/讲解，HTML交互另保留。比较：网页加载项增加课堂依赖；仅图片/GIF缺教学结构；现有Anatomy＋可选teaching版本数据可复用已审产物/原导出且无需新依赖。故以教师“描述知识点→预览/改稿/确认→导出或放入已有课件”为路线；导出不隐式生成新教学内容，答案仅备注。旧数据不迁移/覆盖。此次不切换Pi、不扩学校平台，原Harness欠项继续。

## 2026-10-21 H05-B2生产接缝与验收层次

复用现SQLite事务/journal/outbox和Pi publisher，task独立状态与公共事件原子提交；提供同连接change修正真实store接缝，不新增DDL或第二loop。任务核对仅确认当前原请求成果，plan.v2仍是模型提案，正式goal验收保留；完整plan.v3/逐step准入属于后续必做范围。

确认调用现readback重查当前权限的原生已交付来源/效果，不把旧缓存或全选覆盖系统失败；只读/负面人类判断与模型执行分开。renderer异步请求按task身份、revision/ticket隔离；任务损坏只禁核对权威，已有对话保持可读。DeepSeek HTTP402需账户恢复，不改凭证/代理、不循环请求。失败恢复6项与浏览器/真实store分层，正面provider未过就不关闭B2；最终证据harness-h05b2-20261021-product-review/progress.json。

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

采用固定mu纯合同与现Pi SDK单次分类，不接其private judge/Jev或第二AgentLoop。选择审计引用原偏好receipt，不复制教学事实；shadow永不覆盖权限/偏好/验证。空偏好修复升spec v2，v1保留原digest/规则回放并失效新复核资格。可选审计故障显示不可用而不阻断主聊天，关键journal仍强持久化。H08-B复用现候选/CAS/memory scope后补来源生命周期，不另外创造业务真源。依据与实际证据见HARNESS_EXECUTION。

完整记录：[Harness 执行合同与验收](HARNESS_EXECUTION.md)。服务申请：[服务配置清单](../integrations/SERVICE_REQUESTS.md)。

## 2026-10-17 H07 决定

MCP 动态能力在每轮从当前 server 信任目录装配，接到同一个 Pi ToolExecutor/attempt/journal；不进入固定教育/记忆 fingerprint，不靠 native 历史恢复权限。凭证仅经原安全 codec 存于主进程私有配置；Schema/地址身份变化及撤销失效。先接受受控 28 项与真实 Pi 8 项的范围，国产认证实例/日常/安装保留 OPEN，完整 Harness 不关闭。服务申请统一见 docs/integrations/SERVICE_REQUESTS.md，H08不增加第二编排或默认国外judge。


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

## 2026-10-16 H04/H05 决策

将 H04、H05 标记为 LIMITED_ACCEPTED。依据是当前源码同一隔离构建上的真实注册/边界/回执/恢复与 Electron UI 证据；旧失败不删除。H05 UI 中“结束后必须再有模型请求”属于错误测试假设，停止旧目标的正确结果是无额外请求；改为记录 observed value，并以真实 usage、SQLite/native 和冷恢复作为验收依据。下一步进入 H06，不把限定接受扩大成整体 Harness 完成。

## 2026-10-16 H06 决策

将 H06 标记为 LIMITED_ACCEPTED。上下文/记忆/模型设置/切换边界均有真实专项；模型能力目录只证明官方目录响应与声明模态，不证明图片链路。existing-session compaction 缺证据保持 UNVERIFIED，不用合成或旧历史替代。下一步进入 H07 受控 MCP。
## 2026-10-16 S2 验收决定

按 `FEISHU_READ_SCHEDULER_CONTRACT.md` 将 S2/F02 记为 **LIMITED_ACCEPTED**：固定构建正式 Electron/DeepSeek 样例证明生产 `safe_read` 的12路活动上限、第13项等待、释放后 admission，以及 UI/attempt/SQLite 一致性。报告使用受控合成网页 body，只接受调度与状态持久化结论；真实站点、自然任务并发、无 VPN 和全联网质量仍 OPEN。BoardUI 组件复用遵循用户明确授权，来源和 hash 以 `BOARDUI_REUSE_CONTRACT.md` 为准，不复制第二 runtime/数据状态机。

<!-- dt03-dt04-accepted-20261016:start -->
## 2026-10-16 DT-03 / DT-04 当前构建限定接受

当前冻结构建 fed5e0bd...（368 files）上的正式切片：DT-03-read 7/7（education-journey-uoFHqO）、DT-03-review 11/11（JqFKdk）、DT-03-history 10/10（crF5um）、DT-03-concurrency 6/6（fCqxMu）、DT-04-plan 9/9（ChIaul）。所有报告 build SHA 与冻结构建一致、renderer errors=0；DT-04 有12张双尺寸轻/暗截图，DT-03 review/history/concurrency/read 各有当前报告视觉证据。

范围包括真实学生事实与 Pi/DeepSeek 只读学习分析、教师编辑/确认/拒绝、策略版本与跨会话历史、事务终止回滚、停止/冲突幂等、冷恢复、14天计划编辑/确认/拒绝、无效计数阻断和空档案诚实反馈。DT-03-read 的正式来源断言已修为验证教师可读投影和隐藏内部 JSON 标记，未放宽产品隐私边界。

状态为 LIMITED_ACCEPTED 子片，不代表完整 DT-03/DT-04、题目/练习、视觉学习、Golden F、日常人工、安装或无 VPN。下一项为 DT-05 题目与学习路径。
<!-- dt03-dt04-accepted-20261016:end -->

<!-- ev-main-02-decision-20261016:start -->
## 2026-10-16 EV-MAIN-02 验收决定

将 EV-MAIN-02 记为 LIMITED_ACCEPTED。正式 Electron/DeepSeek 9/9 证明隐式教师呈现偏好可以在 Pi 唯一运行时中经两次独立训练、独立留出、真实正反馈、版本/CAS 采用、冷恢复和自然撤销形成可回滚闭环。采用证据不包含原始反馈文本或学生事实；确认/致谢不消耗留出试验。该决定只覆盖当前 teacher_presentation_observed.v2 和本报告范围，不扩展为完整数据飞轮、答案正确性、全科教学或其他主线完成。

下一主线切换为 DeepTutor 个性化教育能力：真实来源、教师确认、提示协助、独立作答和视觉证据；继续沿 Pi Adapter/Provider，不引入第二 AgentLoop。
<!-- ev-main-02-decision-20261016:end -->

<!-- handoff-current-20261016 -->
## 当前恢复指针（2026-10-16 20:45）

教育主线唯一当前任务为 DT-05，详见 `CURRENT_STATE.md` 与 `EDUCATION_BRANCH_TODOLIST.md`。EV-MAIN-02、DT-03/DT-04 的最新受限接受记录见本文件顶部对应决策；本节以下 EV NEEDS_FIX 内容属于旧快照，不覆盖当前状态。Harness H04–H06 与 Feishu S2/S3 使用独立队列，不能替代 DT-05。

## 历史快照（2026-10-16 上下文保存）

唯一继续入口：[Goal 当前状态](CURRENT_STATE.md)。Master ACTIVE，Phase 4/5/6 DOING；智能组卷移出当前队列。

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

Blocked：无。Last verified commit：d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63（dirty；本轮只读核对origin HEAD相同）。无commit/push；独立Harness变更、正式资料/数据库/配置/凭据保留。回滚仅撤before/slice.patch本片delta，不删除已存结果或确认历史。

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

决定：从现learning_records/确认effect派生覆盖，不建第二学习路径表；保留非正确项复盘且显示新证据令旧安排过时。默认全科读取可见最新科目计划，明确科目查询不继承其他科目计划。
<!-- dt-path-status-20261014:end -->


<!-- dt-reading-20261014:start -->
## 2026-10-14 阅读续接交付，下一 DT-MAIN-02

DT-MAIN-01 版本化逐段阅读/笔记/重启恢复/当前段落辅导入口 LIMITED_ACCEPTED。Master ACTIVE，Phase4/5 DOING；智能组卷已移出队列。下一 DT-MAIN-02 个性化辅导与学习路径→OpenMAIC 互动课→Hermes 无感反馈。

Evidence：apps/desktop/test-results/goal/dt-reading-20261014/progress.json（最终同build正式4项/2启动/0 renderer错误；组件217/217、6项定向实例；实际浅1366/暗1920图审）。复用此前通过实际UI导入/OCR的真实物理扫描事实；本次不重复OCR。原图/笔记不上云、旧版本/笔记不覆盖；LLM讲解未独立判正确，完整沉浸阅读/全DeepTutor仍未完成。详细结果与首次失败见 CURRENT_STATE 和上述 progress.json；无提交/push、正式数据或凭证修改。

决策：扩现MaterialRepository/source和同SQLite，以追加记录保旧笔记、单SQL CAS防覆盖；资料版本变化提示重新核对。进入当前选定Pi对话，不另建Agent/教育数据库。固定DeepTutor reading manifest复用，源码/许可原样；本轮上游目录缺失，仅验证本地固定hash，未声称最新源码迁移。
<!-- dt-reading-20261014:end -->

<!-- mainlines-20261014:start -->
## 2026-10-14 主线纠偏（当前有效，覆盖历史 Next）

用户明确：智能组卷已完成，回归 DeepTutor 教育能力、OpenMAIC 互动课堂、Hermes 无感数据飞轮三条主线。组卷从当前执行队列移出；此前 F3/F4 及组卷扩展清单转为后续专项，不再作为三主线的前置门禁。原有实现与验收边界保留，不据此宣称全科自动正确或 40GB/安装已验。

当前 Phase 4/5 DOING，Phase 6 待实施；Master Goal ACTIVE。唯一执行清单：docs/goal/EDUCATION_BRANCH_TODOLIST.md 顶部“三主线”。当前任务 DT-MAIN-01：复用已有资料读取/DeepTutor reading、学习证据与训练计划，补阅读学习入口、可继续进度及同 Pi 辅导；随后 MA-MAIN-01 真实互动课，再 EV-MAIN-01 教师反馈版本化应用与回滚。只做相关实例与必要构建检查，不重跑组卷或无关回归。

本轮完成的是执行方向/合同对齐和当前源码接缝核查，尚未新增三主线生产功能、运行实例或视觉验收。HEAD d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63，既有 dirty 修改保留；本轮没有验证远端 HEAD。详见上述执行清单。
<!-- mainlines-20261014:end -->

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

本文件口径：复用原业务卡与callback，单一interaction只读映射；旧锚回退、批组不拆。维持正常关闭停止，崩溃恢复才可显式续答。


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

决策：不另建executor；仅office_web_search/fetch可自动重试一次；401/403/写/上传不重试；OpenMAIC许可与provenance进入main/vendor/harness-openmaic。粗粒度workspace/session锁仍需H04-B领域审计。


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

架构推荐B：保留Pi原生loop/provider/session/compaction与现领域事务，重构GoalTask、ToolExecutor、Evidence/Verifier、EventJournal等宿主控制面。A可作adapter过渡但不作为最终目标；不引入第二AgentLoop、Codex CLI、DeepTutor/OpenMAIC server runtime或默认国外judge。新模块与接口均为设计待实施。

<!-- harness-audit-20261012:end -->


## 2026-10-11 KB-S5-B限定接受，接续S6（历史读点）

采用现QuestionDocument完整原图、docx ImageRun、Hana PDF和HeroUI Checkbox；无新依赖或AgentLoop。OpenMAIC的PPTX专用OMML不作为Word转换器直接复制。现SQLite历史兼容saver的父子写顺序修复仅用于兼容，生产仍唯一Pi。

本片仅接受自然物理扫描的一道8分图文题及原图交付；不是自然数学100分卷、复杂公式/图表完整正确性、可编辑公式或答案正确性证明。WPS实际打开、S6更广自然材料/质量、hybrid/ai_original、5变式/自动修复隔离、30–40GB及安装仍OPEN。


## 2026-10-10 KB-S5-A限定接受，下一图公式联合验收（历史读点）

KEEP现Office宿主/生成器/Pi等待/题库/Paper确认快照；EXTEND确定性编译、v2拟稿/派生谱系及最终源CAS写租约；不新增AgentLoop、文档真源或依赖。S5-A仅文字范围接受，图公式另走完整原图及教师区域核对，不抄LaTeX或丢图。


## 2026-10-09 KB-S4-B限定接受，下一S5/S6（历史读点）

S4-B不新增AgentLoop/向量服务/数据库真源；本地确定性召回+同Pi题面实读比较+现PracticeReview批准。受控教学筛选成功不宣称普遍语义精度。官方目录不含旧默认deepseek-v4-flash；只修新配置默认为deepseek-flash，不改已有显式模型、历史或凭证。导出按确定性已确认Paper快照编译，同Office宿主审批，不让模型抄写整卷或走旧无版本导出。


## 2026-10-09 KB-S4-A限定接受，下一S4-B（历史读点）

S4拆为A本地关联候选与B同Pi练习/语义质量；A不增加embedding模型、DDL或另一个AgentLoop。既有Pi负责B语义判断和受审练习，不能把旧固定0.9/0.6分值作语义置信。Office继续使用现文件宿主；未知窗口不得编造。


## 2026-10-09 KB-S3限定接受，下一S4（历史读点）

KEEP唯一Pi/现题库/来源/CAS/Office；EXTEND薄paper领域/shared/typedIPC/nativepaper_review；ADAPT现HeroUI Button/Modal与Golden runner。复用审核action而非新表，真实teacher session可无student/run；整卷不写exercise_sets，不绕过写文件审批。

KB-S3 source_only整卷蓝图/审核/快照 LIMITED_ACCEPTED。build a0f860ac56680a4ddb1fa7798edd1e7c90812fae92f73b7a1156dddee7338448 /340文件；build/typecheck exit0、领域274、组件200/200、正式新版Electron12项/3启动/0 renderer错误、补充冷副本视觉3项/1启动/0模型请求、兼容smoke207/207。32张最终浅暗1366×768/1920×1080截图实际查看。23道教师UI创建对照，20道唯一题满足10×3+6×5+4×10=100；重复/缺答案/错年级、编辑废止、拒绝、精确缺口、真实源变化与恢复、幂等、停止无晚写、两次冷读和真实DeepSeek同Pi等待教师审批通过。原题不改，不自动补题，answerVerified=false；自制文字对照不是自然扫描卷或数学正确性证据。证据：apps/desktop/test-results/goal/kb-paper-20261009/closeout.json。


## 2026-10-09 KB-S2-B限定接受，下一S3（历史读点）

KEEP questionFacts/validQuestionDocument/questionFactConflicts/questionVersion；EXTEND薄shared内容比较和现题本/Pi；ADAPT现runner。无新DDL/IPC/包/运行时，无自动原题合并。S3沿原ai_confirmation_items独立paper action/整卷快照，禁止向≤8题且学生强绑定PracticeReview硬塞整卷或虚构学生。

KB-S2-B 保守同题候选/版本绑定 LIMITED_ACCEPTED。build cb0a5c473cbffc23d483cd2c2027f80405ac1fdbb57b44495fa4402072e8c79f /340文件；build/typecheck exit0、领域258、组件194/194、正式新版Electron12项/3启动/0 renderer错误、兼容smoke207/207。12张浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照：跨记录ID/CRLF同题2条，改数值条件保持独立；20+2分页，真实Pi/DeepSeek同次10条安全别名/duplicateOf，源变化拒绝、精确恢复、两次冷启与索引重建通过。仅本地保守候选，绝不自动合并/删题或证明答案正确；页面范围current_page、Pi范围returned_candidates。证据：apps/desktop/test-results/goal/kb-identity-20261009/closeout.json。


## 2026-10-09 KB-S2-A 关键词底座限定接受（历史读点）

KEEP原题库、typed preload、Pi别名/版本/脱敏与来源读回；EXTEND统一query facade和可重建索引；ADAPT现题本控件与Golden runner。无新包、模型、服务或第二Agent。source_only仍禁止AI补缺口。S3依赖已验结构化过滤/去重/来源，语义相似随S4继续，不把未验S2整体标完成。

KB-S2-A 关键词检索底座限定接受。当前build `443eae07f599fda05dfc5f241f85a8f62c942bc5cc9855cbc5e48f69777e3314` / 340文件；build/typecheck exit0，领域252、组件194/194、正式新版Electron11项/3启动/0 renderer错误、兼容smoke207/207。8张当前浅暗1366×768/1920×1080截图已实际查看。28道教师UI创建对照题，六项硬过滤命中22道、20+2分页；真实Pi/DeepSeek读10条并标hasMore；冷恢复、索引删除重建、旧来源拒绝与精确恢复均通过。不是语义Top10、同题指纹、答案正确性、100分卷、数学Word/PDF或30–40GB验收。证据：`apps/desktop/test-results/goal/kb-retrieval-20261009/closeout.json`。


## 当前最高专题优先级：知识库与智能组卷（2026-10-09）

最新排程决定：教育专题优先，通用解题研究保留为依赖参考，不作为独立前置产品线。缺题/不确定/验证失败必须进入明确缺口或待审，不能偷补过关。

用户最新指示：整理上下文，集中完成知识库与智能组卷。当前唯一执行索引：[KB_EXAM_ACTIVE_TASK.md](KB_EXAM_ACTIVE_TASK.md)（仓库绝对定位 `docs/goal/KB_EXAM_ACTIVE_TASK.md`）。接续为 **KB-S2检索→S3纯题库100分卷→S4错题相似练习→S5/S6 Word/PDF联合验收→KB-002三模式/5变式→KB-003增量30–40GB**。R3/R4只按组卷/变式所需嵌入，通用解题长线及其他模式延后；下方旧节的R2→R3→R4线性Next不再是当前执行顺序。Master及知识库四项产品决策保持。


## 2026-10-09 B5-B限定接受与R2接续

决定：同Pi、现题库真源、OSS Modal/Button/presenter复用；退休的是来源弹窗重复答案展示，非历史数据入口。R2可信缓存需完整条件/图/选项/版本匹配，加独立答案核对或有效receipt；origin或题面批准单独不够。

本节是当前读点，下方同日旧节保留历史证据，不能覆盖本节。M05/M10 B5-B仅来源事实一致性保护已接受：answer/analysis镜像冲突及v2题干冲突由同一只读helper检测；typed IPC保留安全错误，题本/同Pi来源弹窗拒绝展示冲突正文，精确恢复后可读。旧v1摘要语义、questionVersion、批准与原图未被自动修复或重写。

当前build 367d53b3d85dbb2e1855cbb7db977859f94129e529aec6898f40b2dca8d3f6bf / 340文件，正式前后、冻结快照与兼容smoke后一致。build/typecheck exit0；领域243、组件194/194、兼容smoke207/207；真实DeepSeek/Pi Electron24项/4启动/0 renderer错误。32张当前浅暗1366×768/1920×1080截图与4份原图实际查看；三个隔离标量故障均拒绝、精确恢复、冷启一致；原生手动压缩1次后冷继续通过。此压缩不是新的自然自动阈值基准，smoke仅兼容路径，不作新版视觉依据。

物理扫描无独立标准答案仍missing，图15未知标记不认作答案；教师自制跨页算术仅来源绑定对照，answerVerified=false。完整B5独立质量、可靠求解/五tools、语义Top10、100分卷/Office、30–40GB、自然教师、安装/VPN-off与完整Codex体验仍OPEN。

**Next：R2保守同题指纹/中文检索、硬过滤/版本与可信复用合同→R3受限AST/SymPy→R4同Pi五tools→R5–R7错题/组卷/Office/容量。** 不因缺物理答案停止后续，也不凭题面批准/来源标签把答案当正确。Master ACTIVE、Phase4/5 DOING。证据：`apps/desktop/test-results/goal/b5-facts-20261009/closeout.json`；首次RED/build/组件失败与回滚副本保留。无DDL/依赖/第二runtime/日常资料或凭据改动，无提交/push，另一worktree保留。


## 2026-10-09 本轮低成本解题路线审查交付

本轮维持路线A、可选GPU B；高价搜题非核心，未经授权爬虫禁用。Math bank AGPL仅设计参考；Edu-RAG/Math-GPT授权待核，后者模型Python执行/LLM验证异常路径不采用。LanceDB HEAD bcf5ee2…仅研究快照，不升级生产包。没有新增运行时/DDL/依赖或产品边界决策。

完整设计：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；实施：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`。证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-route-review/readback.json` / `supplement.json`。Master ACTIVE、Phase4/5 DOING；本轮未重跑build/provider/Electron/上游测试，当前B5-B草稿未接受，资料/凭据/另一worktree保留，无提交或push。


## 2026-10-09 B5-A：题本来源与答案声明的限定接受

复用现题本/QuestionDocument，不复制第三方题库UI或增来源数据库。仅界面翻译既有origin，不回写sourceKind、answerVerified或批准；未知来源保留待确认。参考答案永不因题面核对而变标准答案，后续验证须独立范围与receipt。

仅接受B5-A来源/答案声明与本切片UI；完整B5独立图义/公式/条件/答案质量仍DOING。物理扫描卷无独立标准答案，仍missing；教师自制跨页算术只是来源绑定对照，不是扫描答案gold。answerVerified=false，不上传原图/私有路径，不将模型自评作证明。原生手动压缩1次与冷继续已验，不是新的自然自动阈值基准。完整可靠解题、Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off、完整Codex体验及Master后续阶段仍OPEN。

**Next：B5-B逐题独立对照来源/公式/必要条件与答案质量 → R2可信同题零额外生成、相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题/组卷/Office/30–40GB。** 不重复B4四类兼容代替新质量任务，不把本轮文案修复当完整解题完成。

Evidence：`apps/desktop/test-results/goal/b5-source-20261009/closeout.json`；正式 `education-journey-n5msKi`，含当前源/加载脚本、固定build、日志、24张已查看截图、失败与回滚点。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty），Master SHA未改，Phase4/5 DOING、Master ACTIVE。无DDL、新依赖、第二runtime、日常资料/凭据变更、提交或push；另一worktree保留。历史节保留当时范围，不覆盖本节。

## 2026-10-09 B4-D：单区域完整审核与新旧版本同构建兼容的限定接受

选择适配已有multi而非再写single六项writer/UI；fresh与legacy同call不得两种id分叉，已有legacy原校验复用，冲突拒绝。pending main确认必须完整projection，不能依赖renderer自检。可见未知来源标记可记录现象，但未核实必要内容保持missing；来源答案、教师补解和数学验证是三种独立事实。

只接受已核对文本传递和版本/权限/恢复安全。真实扫描原图已查看，图15深色标记显式记录来源不明；未核实的必要读数保持missing。物理卷没有独立标准答案，算术跨页资料是教师自制绑定控制，不能作为扫描答案gold。answerVerified=false；Pi只获必要文本，不发原图/私有路径。原生手动压缩1次＋冷继续不是新的自然自动阈值基准。完整B4/B5、可靠解题、语义Top10、100分数学卷/Office、40GB、自然教师、安装/VPN-off和完整Codex一致性仍OPEN。

**Next：B5原图/公式/来源/答案质量合同与独立核对 → R2可信同题零额外生成/相似Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7错题、三模式组卷、Office与30–40GB。** 现题本可见`teacher_resource`/`generated`内部来源文案，列为B5/R2产品文案待修，不把40截图限定核对当整页UX完成。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4d-closeout.json`，含当前源码/加载脚本、build、命令、首次失败、40张已查看截图及回滚快照。 本地/远端HEAD 488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty保留），Master SHA未变、Phase4/5 DOING、Master ACTIVE。没有DDL、新依赖、第二运行时、日常数据/凭据变更、提交/push；另一worktree保留。历史节只保留其当时范围。

## 2026-10-09 B4-C：新多区域审核与完整转写传递的限定接受

范围成功更新使六项coverage全部missing，保留草稿文字；失败/停止不能提交新范围版本。全部核对是文本覆盖声明，不证明答案、图义或数学正确。只由主进程原receipt/source CAS/资产/绑定授权，模型无直接事实写权限。Pi原生手动compaction与冷恢复复用，不建第二运行时或token预算；该实测不是自动阈值基准。

接受范围是教师提供六项文本的完整传递与版本/审核/恢复安全，不是每个图义已经独立判真。图15已有深色标记，来源不明，须补明确原图审查；物理卷无独立标准答案，保持 missing；跨页算术是教师自制来源控制，不冒充扫描卷答案gold。完整B4/B5、可靠解题、语义Top10、100分数学卷、40GB、自然教师、安装/VPN-off与完整Codex一致性仍OPEN。

**Next：B4-D：原图细节/不明标记质量审查、单区域新审核与新旧版本联合正式门禁 → B5 → R2可信同题复用/Top10 → R3受限AST/SymPy → R4同Pi五tools → R5–R7。**

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/b4c-closeout.json`；正式 `education-journey-cHFfHO`，定点视觉 `education-journey-otIM5j`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`；Master/日常数据/凭据/另一worktree未改，未提交或push。Phase **4/5 DOING**，Master **ACTIVE**。以下旧节仅保留当时证据，不能覆盖本节。


## 2026-10-09 B4-B Goal续行记录

B4-B不新建候选事实库：原批准effect的digest/draft/saved不改，追加contextRevisions，当前题版本指向最后after；源/全图/绑定与CAS提交前后核对。历史聊天归档不撤销本地教师已批准题所有权；失效学生关联拒绝修改。借由模型输入伪造projection或caller身份不能授权。

Evidence：`apps/desktop/test-results/goal/question-projection-20261009/`；正式 `education-journey-H1dgFq`。兼容冒烟 **207/207，exit 0**；见最终b4b-closeout.json。Phase4/5 DOING、Master ACTIVE。

## 2026-10-09 最新审查读回与实施边界

保持普通桌面A为默认，GPU整页B可选，核Paddle/RapidOCR/权重与依赖许可再引入；不接付费专业搜题为核心、不用私有接口爬虫。SymPy受限AST、未知/冲突隔离；B4现草稿仍须真实ledger/资产校验，旧题不能凭tag升级。新LanceDBHEAD不触发自动升级。

方案：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；开发卡：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`；本次证据：`apps/desktop/test-results/goal/solver-audit-20261009/final-current-review/`。以下历史仅保留当时范围。


## 2026-10-09 本轮低成本解题路线审查与交接

低成本主线采用既有Pi/RapidOCR/SQLite/审批与Office；Paddle公式/版面、BGE/LanceDB、受限SymPy按POC接入。math-worksheets-skill列R3/R6局部适配候选，拒绝直接采样PASS/字符串parser；FastAPI仅可选transport。百度高价搜题/私有爬虫不作核心。

收尾仅同步报告旧进度和第12项目退出策略，不修改Master、运行时或数据规则。题面完整性与来源审核、数学验算分别接受，B3通过不能越过B4/B5。

方案：`docs/architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md`；任务卡：`docs/goal/XIAOZHI_SOLVER_IMPLEMENTATION_TODOLIST.md`；证据：`apps/desktop/test-results/goal/solver-audit-20261009/requested-review/`。以下历史保留其当时范围。


## 2026-10-09 B3 多区域原图与来源答案审核：纵切限定接受

保持 question-document.v1 和多区域 review.v2；原件答案只在实际 answer 区域＋教师核对后标 source。教师自补为 teacher。停止沿现 owner 取消信号贯通 renderer，lease/CAS 同时防写；idle恢复沿现授权，未新建运行时。

Phase **4/5 DOING**，Master **ACTIVE**。只接受 B3 多区域原图/来源审核纵切，不接受完整原题转写、数学正确性、B4/B5 或完整 KB-EXAM-001。

最终 build `df2a6f837b39d5feaa66df56b4239101552ebd613c23277a2ef4b4e317c99828` / 340 文件与当前 out、正式流程前后逐文件一致。build/typecheck、renderer **181/181**、领域 **225**、真实 DeepSeek/Pi 正式 Electron **12 项 / 3 启动 / 0 renderer 错误**、全部 5 张原件像素对照和旧兼容 **207/207** 通过。12 张深浅主题、1366×768/1920×1080 截图及 5 张原图实际查看。停止真实范围渲染子进程实测 **1617ms / SIGTERM**，不外推其他设备或完整性能基准。

真实物理扫描题两块原图完整保留条件、图14/图15、表、选项与小题；**手工文字仅摘要，缺少例如“不更换实验器材”等完整条件，不能单独作为 LLM 完整题面**。该卷没有独立答案 gold，答案保持 missing。另 3 页算术对照为明确教师自制材料，只验证跨页及来源锚点，不冒充该卷标准答案；来源答案与教师补解分别保存。scope 更改须重确认，source CAS、外帧拒绝、真正确认 SQL 事务中 main 强制死亡/回滚、冷恢复、损坏整组报错/恢复与幂等均通过。

复用同 Pi、ai_confirmation_items、question_bank_items/document_json 与 QuestionAssets；取消修复沿现 owner AbortSignal，不新增 AgentLoop、DDL、依赖或模型。SDK 12 条 assistant usage 保留，cacheRead 是 SDK 报告 token，不是题库命中率；SDK 价格 0 表示这里未知，不等于账单免费。

**Next：B4 完整必要题面上下文精确合同 → B5 联合验收 → R2 可信精确复用/相似 Top10 → R3 受限 AST/SymPy → R4 同 Pi 五 tools → R5–R7 两 MVP、Office、三组卷模式和 30–40GB。** 不得通过删除 document 或仅发 stem 绕过 `document_context_unavailable`。完整解题/语义检索/数学导出/40GB、自然教师、设备/安装/VPN-off 仍 OPEN；Master 其他 DT/MA/JOIN 与 Phase6–8 保持 OPEN。

Evidence：`apps/desktop/test-results/goal/original-multi-20261009/closeout.json`；最终正式路径 `education-journey-15t76q`。本地/远端 HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`（dirty 保留）；未提交/push，不改日常资料、凭据、历史或另一 worktree。Master SHA 未变。以下历史保留其当时范围，以本节和最新真实证据为准。

## 2026-10-09 解题成本路线决策

采用现Pi＋固定本地OCR/PDFium＋同SQLite题库优先/中文FTS＋受限SymPy＋DeepSeek；embedding/LanceDB/公式模型只在专项POC后按需启用。高资源整页视觉为可退A的B方案。AGPL Math bank只设计对照，Edu-RAG/Math-GPT许可待核实不复制；Math-GPT执行生成Python/LLM verifier不作为验证底座。FastAPI只薄计算transport，不开第二Agent/事实DB。最新用户本轮先审查/方案，未继续产品实施；B3草稿待正式接受，Next按solver清单B3→B4/B5→R2–R7。MasterACTIVE，原优先级及双MVP不变。

## 2026-10-09 B2-c 原页文字区域：生产纵切限定接受

裁决：当前固定RapidOCR/PDFium延伸文字框是复用成本最小的生产路线；S/M公式增强仍未通过质量/发行/设备门禁。HeroUI官方Checkbox compound与现安装源码复用，旧label CSS只在新面板纠正。主帧opaque引用→源CAS→固定exe→hash cache→typed preload→现原页UI；不使用第二Agent/FastAPI事实库，不静默用LLM补漏图/选项。

Phase **4/5 DOING**，Master Goal **ACTIVE**。仅接受B2-c文字区域切片；完整B2、R1-B、KB-EXAM-001、可靠解题与两条最终业务闭环仍OPEN。

最终build `85d8e4d7ecf997f052bf56f532c73e09d5f0710dfc7bc993ffaf8ab8b408f872`（340文件）与当前out逐文件一致；build/typecheck、renderer179、领域216、原生兼容11、正式Electron11/2启动/0 renderer错误、旧smoke207/207通过；16张深浅双尺寸截图实际查看。

公开物理扫描卷6页共304待校正文字行；UI识别＋回读实测每页7.851–8.900秒，不是纯模型基准或总体准确率。Page4 S₂→zS、Page6 U₀→U。且部分选项漏识别，原图完整保留；不能称完整切题/数学正确/来源答案。临时校对稿未存为正式题目，重启只复用派生候选cache；本片0模型请求，不等于整个解题成本0。S/M公式POC未推广；自然教师/日常profile、安装、16GB、VPN-off、30–40GB未验。

下一步：知识库方案§41 B3完整多块/跨页题目与来源答案审核→B4完整必要Pi上下文→B5联合验收→R2可信精确/语义Top10→R3受限SymPy→R4同Pi五tools→R5–R7组卷/错题双MVP、Office/三模式与30–40GB。Master其他DT/MA/JOIN与Phase6–8保持OPEN。

Evidence：`apps/desktop/test-results/goal/material-layout-20261009/closeout.json`（含source/build清单、commands、first-failures、manual-review和16张实际查看的截图）；正式当前UI为`education-journey-NEu3AR`，旧207仅兼容证据。

以下历史保持当时范围，当前状态以本节与真实证据为准。

## 2026-10-09 B2-b 版面/公式可行性结论（包含失败，非生产完成）

替换§34历史首选：S质量不足不作默认，M仅清晰公式候选；保持原图和教师校正，公式商业发行/16GB/真实树取消未通过不得默认上生产。FastAPI只可选纯计算transport，不承载第二Agent或事实DB。

6页公开扫描卷保留304文字行四边形，单页3.609–4.263秒。S中文/单位/LaTeX质量失败；M三清晰crop主要内容匹配预先人工转写（1.494–2.331秒），退化单位错误、图表180秒超时、空白两次减号。没有完整题界/数学正确性/总体准确率证明。CPU实验设备i7-13650HX/约32GiB，不是16GB基准。

仅测试env安装71个hash锁包与官方本地权重，未改生产OCR/资料/数据库/凭据。商业发行闭包、Windows进程树强制取消和安装/设备门禁未接受。原正式out SHA e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件与Master/worker/manifest未变，无新产品UI或solver完成证据；未提交/push。

Next：知识库方案§38 B2-c版本化候选协议/现teacher入口合同→B3多块/跨页/来源答案→B4完整Pi题面→B5联合验收→R2可信检索→R3受限验证→R4五tools→R5–R7双闭环/Office/三模式/大库。Phase4/5 DOING，Master ACTIVE；本片不将完整B2、KB-EXAM-001或可靠解题标完成。

Evidence：apps/desktop/test-results/goal/layout-formula-20261009/closeout.json、manual-review.json、first-failures.json；知识库方案§37为结论、§38为下一合同草案。下方原历史证据保持其范围。

## 2026-10-09 B2-a 后台资料整理（限定接受）

复用现ai_tasks.resource_parse和MaterialRepository，不复制Hana内存authority/disk-snapshot task-store，不迁DeepTutor/OpenMAIC loop。借现SQLite CAS实现确定性consumer，无新表；保守不抢活PID；任务目录有界100+选中项。公式候选官方卡Apache声明与固定revision保留，独立许可文件404，不以此称完整权重合规/部署已完成。

B2-a 后台资料整理已实现，已验最终build e128d1521fb00761a3b8f3ecd8248fb21ccda6362ee419792d4fd90d153a060f/340文件：build/typecheck、renderer177、统一领域209（新增队列17）、正式Electron11/4启动/0 renderer错误及12张双尺寸深浅截图通过。实际deepseek-flash/Pi实读触发优先解析，SDK usage单独保留，不算账单/单题成本。同一最终build兼容207/207通过。仅B2-a持久后台整理切片接受；完整B2/R1-B/KB-EXAM-001未完成。

Phase4/5 DOING，Master Goal ACTIVE。仅本机确定性任务消费，无新依赖/DDL/AgentLoop/公式模型安装；不把OCR正文当原题、标准答案或已审核事实。新队列仅显式采用资料，旧占位不自动消费；旧同步入口保留。单文件整体提交与重启，不承诺页级checkpoint、30–40GB吞吐、PID复用抢占或自然教师/安装验收。Git本地/远端HEAD均488f8109d68027a6eb488e9d04c4eb5073d153cd，dirty保留、未提交/push；日常资料/配置/历史及另一worktree未改。

Next：B2-b真实版面块与唯一公式候选许可/设备POC（方案§34）→B3多块/跨页/源答案教师校正→B4完整必要Pi图/公式上下文→B5联合验收→R2可信检索/Top10→R3受限SymPy→R4同Pi五tools→R5–R7双MVP/Office/三模式/大库；Master其余DT/MA/JOIN/Phase6–8保持OPEN。

Evidence：apps/desktop/test-results/goal/material-background-20261009/（commands、first-failures、source-manifest、visual-review、native-usage与真实readback）；完整收口见该目录closeout.json；最终207在accepted-build5运行，之前build3的207仅为历史证据。下方历史保留，以本节与实际证据为准。


## 2026-10-09 B1 原题资产与教师审核：单题单页切片接受

延续A及唯一Pi；现PDFium+MaterialRepository/Sqlite/ledger与HeroUI ChatTool直接扩展，不迁DeepTutor MinerU/LLM循环或OpenMAIC IndexedDB媒体真源。正式资产使用exclusive link发布并去掉temp（读前nlink=1），不能rename覆盖同名已批准图。文件先于SQLite提交，失败孤儿保留且无事实权利；本片不做自动GC。未知标准答案不接受模型在原题工具提交；教师补解来源teacher，不标source。

仅接受单题、单页、一个原件区域的原题审核/入库切片。完整B1/R1-B、KB-EXAM-001、可靠解题、100分组卷/错题Top10/数学导出/30–40GB仍OPEN；Phase4/5 DOING，Master Goal ACTIVE。

最终build/typecheck通过；renderer174/174、统一领域192（新增原题边界17）、真实DeepSeek正式Electron13/4次启动/0 renderer错误、独立原PDF与候选/正式PNG逐像素对照2项通过。8张深浅主题、1366×768/1920×1080原题审核与题本截图已实际查看。最终accepted-build4与当前out逐文件一致，采用现evidence.mjs指纹SHA `991bcce76eab745609ccb8fa012ff2d17711749366261656e753514d0fa94a0b`（340文件）；旧smoke207通过于build3 `d16dfa9b639d55c0b517b5b94c754a18b6f8c5e56fc160ed4ed4ccc936989da4`，main与最终不同，不能称全207在最终构建运行。

真实Pi请求证明本轮正文实读→工具→审核流程，不证明数学答案正确；教师交互为隔离Electron自动操作，不是独立人类教师签收。当前答案origin=missing，未新增学生事实。原图只在本机显示，Pi题面reader遇document仍明确拒绝不完整文本读取；完整上下文待B4，不允许漏图解题。

Next：B2真实版面/题块定位、唯一公式候选许可/权重/设备POC、现SQLite上的确定性持久解析任务与任务优先→B3完整题块/跨页/来源答案校正→B4题本/Pi完整必要上下文→B5原图/公式/答案与恢复联合验收→R2可信精确复用/语义Top10→R3受限验证→R4同Pi五tools/讲解→R5–R7双业务闭环/导出/三模式/大库，继续Master其余任务。

Evidence：`apps/desktop/test-results/goal/original-review-20261009/closeout.json`。本地/远端HEAD `488f8109d68027a6eb488e9d04c4eb5073d153cd`一致；dirty保留。无新依赖/DDL/Worker或AgentLoop，无提交/push；测试使用隔离资料/数据/profile，未改日常凭据、资料、历史或另一worktree。Master SHA未变：`dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302`。

以下保留历史，当前实现状态以本节和最新真实证据为准。


## 2026-10-09 解题路线当前复核（审查交付）

继续采用A：现Pi/RapidOCR/PDFium/SQLite，公式只选一个候选POC；按评测引入小中文embedding/可重建LanceDB、受限SymPy与DeepSeek。B为GPU本地增强，统一合同可降级A；未知许可不复制，AGPL仅设计参考。

当前Phase4/5 DOING、Master Goal ACTIVE。本次仅完成源码/许可/方案复核；既有R1-A文字、B1题面存储及原页预览保持限定接受，完整原题、可靠求解、语义Top10、100分/数学导出/40GB仍OPEN。下一实施：R1-B/B1正式题图与原题审核writer精确合同→B2–B5真实原题闭环→R2可信检索→R3受限验证→R4同Pi五tools/讲解→R5–R7两业务闭环，再继续Master。

Evidence：apps/desktop/test-results/goal/solver-audit-20261009/current-review/。本次不提交/push、不改凭据/资料/另一worktree。


## 2026-10-09 R1-B/B1 原页保真预览（最新，限定范围）

本片选择现PDFium能力加薄源授权/回执适配，不复制DeepTutor的MinerU/LLM抽题循环或OpenMAIC的DSL/IndexedDB资产真源。原页读取与OCR收录分开，预览不改变parseStatus/chunks。继续复用现SQLite/教师ledger；未来canonical document和文本兼容投影须同事务。

仅接受B1原页/区域预览小切片，完整B1/R1-B/KB001与可靠解题仍OPEN，Phase4/5 DOING，Goal ACTIVE。现“我的资料”可在本机查看PDF原页、翻页、放大、停止、重试；源变化/丢失/坏文件诚实提示。保留图、表、公式及选项的原件栅格，不等于自动切题、公式转写或答案正确。无新依赖/DDL/模型调用/另一AgentLoop，无原题/答案/学生事实写入。

最终out与accepted-build3逐文件一致，SHA b3e51f18bbe0ff8604918a3a4dc846020136679dc6e5f4333686827ad3839843 / 340文件。最终build/typecheck通过、renderer174、领域175、正式Electron12/2次启动/0 renderer错误/前后build一致，3项独立原件像素对照通过，8张深浅双尺寸原页截图已查看（仅预览面板；不代替完整Shell/动画/教师D/安装E）。PDF13及旧smoke207在accepted-build2通过，其main/preload与最终完全一致，renderer不同；不混称全207在最终build运行。旧image宿主10通过，同新固定runtime。证据：apps/desktop/test-results/goal/material-preview-20261009/closeout.json；逐命令/首失败/回滚与指纹均保留。

Next：B1正式question-assets/v1同源快照、现ledger原题类别与内部writer精确合同/实现→B2真实版面/唯一公式候选POC/持久确定性后台任务→B3教师校正确认→B4题本/Pi完整必要上下文→B5逐题原图/答案/故障恢复验收。然后R2–R7及KB001纯题库100分/错题Top10/Word-PDF/重启双闭环，继续Master其他任务。

以下保留历史，当前状态以上节为准。


## 2026-10-09 R1-B/B1 题面与版本底座（最新，限定范围）

- 同question_bank_items扩展document_json，不创建第二题目真源或新AgentLoop。
- 文档内部源/图/公式/出处全部纳入现题目SHA；旧无document的原SHA保持逐字节兼容；present但损坏的document不得丢弃再作旧SHA。
- 公共QuestionBankItemInput保持不变，document由未来原题审核主进程内部writer写入；格式验证不授予资产权限/教师批准。
- 文本Pi接口暂时拒绝structured original，明确缺上下文，B4再适配完整授权内容；没有暗中自动上传图像。
- B3内部writer必须同事务生成document权威题面及既有stem/answer/analysis兼容投影，二者不允许独立编辑成两套答案。AI补解保存ai_generated候选，不作为source答案。

只接受R1-B/B1题面存储与版本底座小切片；完整B1、R1-B、KB001、Phase4/5及Master Goal仍OPEN/DOING/ACTIVE。题面合同结构合格不等于原件真实、完整、数学正确或教师已确认。

Next：补齐B1同源题图资产根/哈希/授权与现审核ledger原题类别/内部writer合同，再B2真实版面与唯一公式候选POC/持久任务→B3教师校正确认→B4题本与Pi完整上下文→B5原件逐题/故障/冷恢复。R2–R7及KB001双闭环保持OPEN。

以下保留历史，当前状态以上节为准。


## 2026-10-09 解题路线审查复核（最新）

推荐组合仍为现Pi+RapidOCR+SQLite，公式/布局候选逐一许可与设备POC，小语义/可重建索引按评测，固定数学AST/SymPy验证，DeepSeek候选生成；Qwen显式替代。高成本商业搜题不作核心，无未授权爬虫。原题可信解析优先复用；不精确语义命中不套答案。SymPy最新HEAD补核不自动装到产品；AGPL及未知许可不直接复制。保持R1-A文字接受、R1-B为下一实施；本轮先方案无新增产品代码/DDL/依赖。Master不改。


## 2026-10-09 R1-A 扫描PDF文字前置验收（当前）

仅接受R1-A文字前置，完整S1/KB001/Phase4/5仍OPEN/DOING，Goal ACTIVE。新版资料页面真实6页扫描卷→本地fixedexe→同SQLite实际页码→停止/重试/坏或加密PDF/源CAS/真实主进程死亡/冷恢复；无模型调用、题目/答案或学生事实写入。下一唯一任务R1-B：完整原题图/公式/来源→教师校正确认→原题库/Pi读取。

Pi仍唯一编排；PDFium5.14.0/RapidOCR3.9.2固定本地exe，无新增Agent/DDL/云传输。新PDF OCR片段machine_extracted/background，私密仍unverified，不批改历史事实；真实pageNumber加入bodyVersion，旧未知页hash原样，过时定位须重读。识别文字不等于公式/题目/答案正确。

以下保留历史；当前状态与下一任务以上节为准。


## 2026-10-09 低成本解题审查与路线修正（当前）

当前用户路线：开源、本地题库、低成本国内API主体；高成本商业搜题不作核心，无未授权爬虫。本轮先审计方案，不扩PDF草稿/大改。建议A（现Pi/RapidOCR/SQLite＋可插拔公式/语义＋受限SymPy/DeepSeek），B为高资源本地增强，具体新包待许可/设备POC锁定。

可信原题先复用，语义不套答案；固定AST验证，禁止模型Python执行；receipt限定检查范围。AI补解为候选/教师独立gold，FastAPI可选薄transport默认stdio，无第二Agent/事实库。Mathbank AGPL仅参考；EduRAG/MathGPT未核许可不复制；MathVerify Windows先验。

KB001两闭环、三模式、持久确定性任务优先、疑点隔离和教师确认原四决策保持。[依据](../architecture/XIAOZHI_SOLVER_OPEN_SOURCE_TECHNICAL_REVIEW.md)。

以下旧记录保留历史；本轮状态与下一任务以上节为准。


## 2026-10-08 知识库与智能组卷专题（当前）

用户2026-10-08指定优先完成“本地知识库＋智能组卷＋错题相似练习”，随后继续原Goal。原Master保持2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302；Phase4/5 DOING、Goal ACTIVE。旧“下一唯一任务讲义”仅为历史，本次优先级以本节为准。

四决策冻结：首期组卷和错题相似题同时交付；source_only/hybrid/ai_original；持久后台增量任务与任务优先（确定性调度，非Agent）；自动修复疑点隔离。正式发布沿原教师预览确认和文件审批，auto-ready不豁免；修复候选最多2次不是Agent token预算。原题不能复用generated writer冒充教材出处。

[知识库与智能组卷专题](XIAOZHI_KNOWLEDGE_EXAM_TECHNICAL_PLAN.md#19-2026-10-08-本地源码审查与进度)

以下旧记录保留历史；当前优先级以上述专题为准。


## 2026-10-06 DT-05 同源五题与两周训练（当前）

决策：现有教育工具/审核/writer已支持完整链，生产仅增强原照片入口草稿，测试复用原Golden runner/OCR/facts/practice/plan路径。未新增数据库迁移、IPC、Agent runtime或包。原AI内容错误走教师修正，保留原稿与最终稿，不通过隐式改SQLite伪造模型正确性。

Evidence：固定build-a 340文件/SHA 084bf520ca6b5ebe6d5595cc7df6be486bd933eebd610153dd2856b6241d1126，默认out逐文件一致。build/typecheck exit0；组件171/171、领域160/160（education-boundary-dS4I2L）；正式Pi/真实DeepSeek照片完整链21/21（education-journey-cctc7q，4次启动，rendererErrors=0），旧结果副本2/2（education-journey-dmiKuo，55→55消息），冷恢复视觉2/2（education-journey-zWgsj5，63→63消息）。原链28图与冷恢复首末题8图合计36张浅暗1366×768/1920×1080已逐张查看；静态滚动位置不替代全Codex视觉一致或原生动画验收。固定build-a旧业务smoke207/207、exit0（smoke-a.log）。精确命令、哈希、内容校正、SQLite读回与范围：apps/desktop/test-results/goal/dt05-photo-cycle-20261006/closeout.json。

Doing/Next：Phase4/5 DOING，Goal ACTIVE。本轮接受的是owned印刷数学照片与显式合成学习作答的完整C/F实例，完整DT-05仍OPEN。下一唯一任务：核对并复用讲义结构与可靠检索能力，完成检索质量对比和M04/M05/M06/M07/M09联合验收，再依次MA-01至05→JOIN→Phase6–8。所有DeepTutor模式、完整Codex组件/体感、浏览器/MCP、长期偏好、日常人工、安装/无VPN及既有audit5（2 moderate/3 high）发布门禁仍OPEN。日常旧main PID27584（02:52:05）保留未重启，磁盘构建不是旧窗口加载证明。未提交/push、改凭据或网络/VPN、第三方工作树；无新增依赖。

以下内容保留历史；当前进度与下一任务以上述收尾为准。



## 2026-10-06 DT-05 照片学习事实与来源根题（当前）

选用当前原writer+Adapter，不迁入DeepTutor mimic_source解析服务/Pipeline，也不引入新Agent。Pi仍唯一生产loop，原DeepTutor学习算法继续复用。事实IPC独立于OCR执行器，但共用原宿主任务/取消权限。SQLite单列回执保持旧数据库兼容；实际事件新增一条而非覆盖原图片记录。修复原关键词查询来源标题漏检，没有第二套检索。

Evidence：最终build-f 340文件/SHA de02aa8acf282e5b76e43027e5a630cb2385feead9ce438039f83928b2f3459b，默认out逐文件一致；build/typecheck exit0、组件170/170、统一领域160/160（education-boundary-KZBdUV），正式Pi/真实DeepSeek照片事实14/14（education-journey-Ddv96H，3次启动/rendererErrors=0）、旧结果副本2/2（education-journey-RMLfIe，55→55消息）。12张浅暗双尺寸图已逐张实际查看。最终固定build-f旧业务smoke207/207、exit0（smoke-f.log）；隔离旧runtime不替代正式Pi/provider验收。精确命令、哈希、读回、失败与视觉范围：apps/desktop/test-results/goal/dt05-photo-facts-20261006/closeout.json。

Doing/Next：Current Phase=4/5 DOING，完整DT-05/Golden C/F及Goal ACTIVE。下一唯一教育任务为照片同源5变式→教师确认题目/练习→个性化14天→实际结果再分析；随后MA/JOIN/Phase6–8。完整Codex设计、所有DeepTutor模式、课堂、长期偏好、浏览器/MCP、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。未提交/push、改凭据、网络/VPN或第三方工作树；日常旧进程未重启。


收尾补齐：传统学生档案时间线复用已有shared/learning-source-preview，显示实际作答、参考答案、表现、错因和难度，隐藏内部Schema/ID/hash；薄组件不另造解析器，正常自由文本保留。实际冷启动验证揭示原选择ID在fallback学生已可用时仍为空，最终比较真正activeStudent.id，保留迟到更新保护。新增档案真实路径和4张浅暗双尺寸图，与原8图合计12图；当前14项仍仅是照片事实/根题/只读Pi续接，不冒称已生成5题。

失败留存：build-e首次Object.hasOwn超出现有TS lib，最终复用原摘要函数；CZrABU揭示冷启动记录读取缺口并修复；X0gypp已有真实可读记录，截图断言在滚动布局完成前取几何，最终同build-f等待真实可达位置。smoke-d.log再次出现隔离旧no-provider外键错误，同build-d带诊断复验207通过；该历史间歇根因仍OPEN，不能归因或宣称照片/样式修复了它。最终build-f回归及当前正式Pi/真实DeepSeek、领域、组件和兼容均通过；原失败/旧构建保留。日常旧main PID27584未重启，待确认状态与正式数据保持。
以下旧记录保留历史；本轮状态以上述记录为准。


## 2026-10-06 DT-05 真实照片 OCR 与 Pi 草稿（当前）

决定：不新增 Agent loop、OCR 框架或学习事实库；从既有附件服务提取可复用安全读取器，原固定 OCR 宿主识别，既有 SQLite writer 保存。教师校正仅向 Pi 交付脱敏文字草稿，实际成绩/错因必须另行确认。单列增量迁移保留旧数据；旧入口待完整新路径验收后再删除。

Evidence（本轮照片前置切片）：固定 build-c 340 文件，SHA 6f9309b5aa178021b3dcdac20089f583edfbfa43fbc43139a97d0a5089225f8f；build/typecheck exit0，组件164/164，统一领域155/155，正式五空间照片路径8/8，旧数据库副本兼容2/2。四张浅暗双尺寸实际 Electron 截图已逐张检查。最终固定 build-c 的旧业务 smoke207/207、exit0；该隔离旧 runtime 回归不能替代新版 Pi/真实 provider 验收。精确命令、源码/报告哈希、失败留存与读回：apps/desktop/test-results/goal/dt05-photo-20261006/closeout.json。

Current Phase=4/5 DOING；完整 DT-05/Golden C/F 与 Goal ACTIVE。Next：教师实际作答/错因/知识点/难度→原学习事实与照片来源根题→5道有来源练习→教师确认14天计划→实际结果再评估。日常旧进程未重启；完整 Codex 设计、所有 DeepTutor 模式、浏览器/MCP、安装与无 VPN 人工验收和既有 audit5 发布门禁仍 OPEN。未提交、push 或更改凭据。

以下旧记录保留历史；本轮状态以上述记录为准。

## 2026-10-06 DT-05 练习实际结果与重新分析（当前）

复用：practice-result.v1只是现有student-training.v1的可选关联字段；旧输入/digest/记录保持不变。使用原exercise_sets、question_bank_usage、ai_confirmation_items及learning_records，无新增表/列/迁移/依赖/第二编排。确认练习sourceOn与结果writer共用原BEGIN IMMEDIATE；校验活跃学生、确认ledger digest、实际练习快照SHA、计划科目/知识点及完整逐题索引。答案/反馈/分数绑定原防重digest，重复不写、改动冲突、失败回滚；原concept/design质性门禁不放宽。Pi通过原education_analyse_learning收到脱敏实际答案/反馈/可选分数和整体结果，私有学生/练习ID不出现在回执正文，不自动打分或补造结果。

保持可选字段和原writer：Pi插件可以复用联网/MCP/目标能力，不能代替宿主的教师事实与版本校验。旧作答缺少practice字段仍可读；结果不修改题目或确认后的练习快照。sourceOn使用调用者连接，避免新连接嵌套BEGIN造成锁等待。未新增逐轮运行预算；单IPC字段/字节边界只是输入保护。

Evidence：最终build-c 341文件/SHA 34004180d6173abcf458bd8fd4e2d933390afd504e5f413b46233d3a9cebf750，默认out逐文件一致。build含typecheck exit0、组件160/160、统一领域149/149（education-boundary-qANG7X）；当前正式Pi/真实DeepSeek8/8（education-journey-WTTeTd，2次启动/rendererErrors=0）、旧题目核对数据副本3/3（JnXVj8，33→33模型消息）、当前练习→计划/结果跨入口副本2/2（cVAg2R，55→55消息）均固定build-c。8张静态Electron浅暗1366×768/1920×1080截图逐张查看；保存/取消/来源可达，长逐题列表内部滚动、无横向溢出，分数复选框复用既有checkbox-label且几何断言通过。相关旧业务smoke207/207固定build-b；其main/preload与最终build-c逐文件相同，c仅给新表单复用既有复选框样式。没有把旧runtime smoke称为新版真实教育验收。精确命令/源码与报告SHA/读回/失败留存：apps/desktop/test-results/goal/dt05-result-20261006/closeout.json。

Doing/Next：Current Phase=Phase4/5 DOING；完整DT-05/Goal ACTIVE。下一唯一教育任务先对照现有本地OCR/教师校正、题库/错题、Pi和DeepTutor question/learning能力，冻结完整Golden C/F合同，再贯通实际照片→本地OCR与教师校正→错因/知识点/学生历史/难度→5道有来源练习→教师确认的个性化14天训练→实际结果与重新评估。当前单知识点两题结果链不冒称该完整场景。之后MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN和既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 Pi 插件目录与安装复核

继续已有三包精确版本，不引入旧 SDK 副本或第二目标/任务状态库。第三方MCP不兼容时选 Pi 原生；后台包待兼容版本。候选列表和理由见集成目录。

详见 [Pi包清单](../integrations/PI_PACKAGES.md)。本轮证据：apps/desktop/test-results/goal/pi-packages-review-20261006/closeout.json；既有audit 5项（2 moderate/3 high）仍为发布待处理项。当前教育阶段4/5与完整Goal ACTIVE保持。

## 2026-10-06 DT-05 学生练习集合与传统来源读回（当前）

practice-review.v1 / education_propose_practice + education_read_practice纵向贯通Repository/Coordinator→production-host/Pi独立持久身份→主frame typedIPC/preload→现有工作台PiPracticeReview与传统PracticeSourceButton。复用ai_confirmation_items(action=pi_practice_candidate)、exercise_sets、question_bank_usage和原saveExerciseSetFromDraft writer，零新增表/列/迁移/依赖/第二编排。候选只接本轮成功实读别名，模型不得指定学生/ID/确认权；题目正文不可偷偷改写，改题先核对题目。确认digest绑定初稿、题目版本/本地父来源、教师最终安排和完整exercise快照；同generation租约、单BEGIN IMMEDIATE、防重/取消/失败回滚。原生身份未知或移除在open前拒绝，压缩只保存状态索引。

以当前active session绑定/实际run-session归属授权，兼容现有Pi run空学生字段；显式冲突拒绝。练习事实依旧通过原writer与usage、ledger同事务落库，没有第二事实源。旧练习无需新marker仍可读；原生独立能力marker验证保持。

Pi包状态保持：pi-web-access0.36.0与@narumitw/pi-usage0.62.0限定生产，pi-goal-x0.32.3安装STAGED，MCP/background候选peer不匹配Pi1.x未force；原生MCP配置、目标Adapter和后台任务仍后续。此教师确认业务复用既有SQLite与Pi customTools，不另装重复框架。DeepTutor当前f07029c（Apache2）固定原quiz格式函数继续通过题目核对使用；OpenMAIC723005（MIT）课堂仍后续。无新依赖/许可证/打包体积增量。

Doing/Next：Current Phase=Phase4/5 DOING；Current Task=DT-05练习集合限定接受、学习路径/实际结果续接DOING；完整Goal ACTIVE。下一唯一教育任务先冻结现有练习→路径/实际学习结果的兼容合同，再将已确认练习接现有学习计划/精通路径与教师实际作答/成绩记录，唯一Pi/DeepTutor重新评估并继续下一轮练习。完整DT-05/Golden C/F后依次MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、全部DeepTutor模式、课堂、长期偏好、日常人工、安装/无VPN与既有audit5发布门禁仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 教师出题核对与题本保存（当前）

question-review.v1 / education_propose_questions纵向贯通Repository/Coordinator→production-host/Pi身份→主frame typedIPC/preload→独立PiQuestionReview。复用现有ai_confirmation_items（action=pi_question_candidate）与question_bank_items writer，无新增Schema/表/依赖/第二事实库或编排循环。原始父题完整快照和事实SHA只留本地；确认digest绑定初稿SHA、父来源、教师最终稿及子题ID/版本。同generation租约、单SQLite事务、拒绝/停止/幂等保护确认权。receipt只给脱敏最终发现元数据，答案/解析按既有授权读取。最多8题是单IPC资源保护，不是运行预算。

采用原DeepTutor固定AST格式函数、现有题库writer和确认ledger的Adapter，不创建exercise新事实或整体迁移字段。该谱系本地账本方案先解决当前题目确认；下一练习集合/跨入口读取必须先冻结兼容合同，不以此宣布完整谱系领域完成。

包状态保持：pi-web-access0.36.0原关键词定位与@narumitw/pi-usage0.62.0原DeepSeek余额查询限定生产；pi-goal-x0.32.3已安装STAGED，现有SQLite目标Adapter后续。MCP/background候选peer不匹配Pi1.x，不force/不引第二SDK；原生MCP配置与后台任务仍后续。当前DT-05不再安装重复出题框架，复用原DeepTutor2文件104953字节/Apache2固定AST纯函数。安装≠桌面已启用。

Doing/Next：DT-05仍DOING、完整Goal ACTIVE。下一唯一教育任务先冻结练习集合的旧数据兼容合同，再把已核对题目接入现有exercise_sets/question_bank_usage及跨入口谱系读取，贯通传统练习、学习路径和实际结果；完整DT-05/Golden C/F后再MA-01至05→JOIN→Phase6/7/8。完整Codex像素/原生动态、日常人工、安装/无VPN、既有audit5发布门禁及其余Master未完项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 原测验格式能力复用（当前）

Done：DeepTutor固定f07029c/v1.6.13的pipeline.py和Apache许可证原样保存（104,953字节）；AST仅投影QuestionType、三个常量和三个原quiz解析/归一/issues函数体及原decorator，运行原imports/AgentLoop/THINK/Store/Provider均未迁入。question-draft.v1→question-host→既有固定白名单Worker协议→真实原Python→严格输出复核与打包已验证。

格式Adapter是分阶段候选流程的内部能力，当前未注册生产Pi工具/未新增写事实或UI；模型主编排仍唯一Pi1.0.2。宿主固定题型，choice/concept/fill_in_blank/short_answer/written/coding；严格字段/类型/重复键与选项碰撞防止误归一，完整答案/解析超长拒绝而不截断，issues保留。valid只表示格式完整，不证明数学正确/教师确认/保存；来源和学生授权由下一同账本Coordinator决定。零新npm/pip依赖、DB表/迁移/第二Store。

上游question main f07029c、OpenMAIC main723005本轮只读复核，无第三方checkout变更。Pi SDK官方customTools/会话为下一生产接入，HeroUI官方Pro可读而MCP transport失败；现有核对组件复用。

Doing/Next：继续DT-05第2项原格式Adapter→同一ai_confirmation_items可编辑题目/练习候选→Pi/真实DeepSeek及当前教师核对UI；第3项先冻结谱系增量兼容迁移合同，再教师编辑/确认/原子题库及exercise保存；第4项传统练习/路径与实际结果；第5项完整DT-05/Golden C/F→MA-01至05→JOIN→Phase6/7/8。全Goal及教育/课堂/长期偏好/CI/安装/无VPN/原生动态未完成项保持OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-05 真实题库来源接缝（当前）

question-context.v1复用searchQuestionBank/getQuestionNotebookEntry，两个Pi只读工具education_search_questions/education_read_question。每run主进程发现别名+题目事实SHA；答案/解析按需脱敏完整读取，超长拒绝、异步后重新核版本/租约。SHA不含收藏/分类覆盖层；模型不获原ID/私人字段/假确认。questions:context-source主frame→typed preload→HeroUI来源Modal只在本地展示全文。原生question-context身份在持久SessionManager.open前验证，未知版本/移除能力拒绝且JSONL字节不变；旧未标记兼容。无新Schema/依赖/Store/Loop。

Pi包继续锁定web-access0.36.0关键词定位与@narumitw/pi-usage0.62.0余额限定生产；goal-x0.32.3 STAGED，原生MCP/SQLite目标适配后续，不兼容MCP/background不强装。本轮再次核官方目录，无额外适合本题库权威接缝的包，现有Facade与Pi原工具复用；不把包安装当教育闭环完成。详见docs/integrations/PI_PACKAGES.md。

保留DeepTutor question/capability的研究→规划→出题领域顺序；不迁QuestionPipeline AgentLoop/THINK/Session/Store。纯归一代码下一步按固定Git源码/许可证提取，当前未冒称已迁入。

下一唯一教育任务：DT-05第2项，固定DeepTutor纯测验归一与协议Adapter→唯一Pi可编辑题目/练习候选；第3项同一确认账本教师编辑/确认/原子题库和练习保存及父子谱系（先冻结增量兼容迁移合同）；第4项传统练习/路径/实际结果；第5项完整DT-05与Golden C/F，再MA-01至05→JOIN→Phase6/7/8。完整DeepTutor、OpenMAIC课堂、日常人工、完整Codex/Golden/安装/无VPN仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-06 DT-04 学生计划与实际结果续接（当前）

student-training.v1主frame三接口经typed preload接同一LearningReviewRepository；计划仍ai_confirmation_items、结果仍learning_records，复用createRecord/FTS/本地目录与BEGIN IMMEDIATE，无新表/依赖/Store/Loop。宿主从确认计划解析知识点/科目/标题，renderer不能指定事实来源；UUID绑定内容防重且手工改后重放冲突。陈旧计划记录需教师主动确认，被新计划替代拒绝写入；质性结果不自动获得教师核对资格。旧无plan与旧路径保留。

真实红灯发现模型把较早证据当新结果：同一只读分析增加最多20条sourceEvidence（发生时间/结果/宿主核对状态，训练观察先脱敏再截断600字），与当前来源别名一致，不传原ID/digest。另发现rest却带知识点时原generic错误使模型向教师问技术参数：仍严格拒绝，工具返回未提交核对与rest=null/count=0等自修说明，不放宽来源或新建重试Loop。

复用现有Pro EmptyState、PiTrainingPlan及HeroUI Buttons/主题，不新增学生页事实库或并列导航。Pi负责编排，DeepTutor仅计算，教师主动保存实际结果。源日期与源核对状态属于最小教育上下文；原JSON/内部ID/计划digest无需上云。旧路径挂折叠兼容入口，验收通过后仍保留用户已确认历史。

Pi包继续复用已锁版本：pi-web-access0.36.0关键词定位与@narumitw/pi-usage0.62.0余额限定生产，pi-goal-x0.32.3已安装STAGED；不兼容的MCP/background未强装。CLI全局安装不构成桌面已启用证据；原生MCP/目标SQLite适配分别后续，详见docs/integrations/PI_PACKAGES.md。

下一唯一教育任务 DT-05：先核现有Question/Practice/Grading领域、Pi与DeepTutor原实现，冻结教师可编辑的题目/练习/学习路径纵向合同，再接真实来源与同库确认；随后 MA-01至05→JOIN→Phase6/7/8。完整DeepTutor模式、OpenMAIC课堂、Codex像素/原生动态、日常人工、完整Golden与安装/无VPN仍OPEN；Goal ACTIVE。

以下旧记录保留历史；当前状态以上述记录为准。


## 2026-10-05 DT-04 复用与数据决定

training-plan.v1作为原learning-review strategy v1可选嵌套字段，旧无plan兼容；原工具名称/native marker/同库ledger/digest/版本/取消租约/typed IPC保持。宿主解析本轮知识点别名固定真实目录，提议与确认检查快照及版本，教师不得造来源或删除计划转普通策略；过期计划只读历史。无新依赖、DB表、Store、Loop或第二学生页。latest plan重新实读并声明sourceCurrent/strategyCurrent/teacherConfirmed/completedPractice=false。

继续执行原DeepTutor f07029c/v1.6.13算法；不引第二LearningStore。复用现有Pro ChatTool、学习历史与来源链接，官方资源不可用走已授权组件，无新UI库。下一先贯通既有学生“学习计划”入口读取同一已确认计划及陈旧/空/失败状态，再补教师友好的结构化实际学习结果录入与重新分析/继续训练，不开第二事实库、不把安排当完成；然后DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8。完整Golden F、DeepTutor全模式、OpenMAIC互动课、日常人工、像素/动态、安装/无VPN与既有audit5项仍OPEN。

以下旧记录保留历史；当前状态以上述记录为准。

## 2026-10-05 包生态复用决定

用户授权安装所需Pi包。采用精确项目npm安装，不修改全局PiCLI配置；web/usage直接编译审计过的原源码叶能力，goal-x安装但先保留SQLite唯一目标账本。旧命名MCP扩展及peer不含1.0的MCP-adapter/background不force安装；原生registerMcpServer优先。保留唯一Pi1.0.2、教师授权和脱敏，不引第二Loop/Store，不设预算。包清单与许可证/体积/Windows影响见integrations/PI_PACKAGES.md。


## 2026-10-05 DeepTutor功能对齐与学习会话恢复（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：实际融合程度逐项对齐官方清单，见CAPABILITY_MATRIX/EDUCATION_BRANCH_TODOLIST最新功能表；既有检索/引文/学生上下文/算法/教师核对与历史已融合，完整测验、学习路径、两周训练、视频及互动课未完成。本轮修复恢复旧会话时先写入后校验的问题：全部学生/学习/核对范围和工具先验证，复用Pi公开解析及内存SessionManager迁移后才持久打开；未知分支/版本、错学生、移除或错工具拒绝且JSONL字节不变，未绑定普通聊天保持空范围。无需新依赖/Schema/Store/循环。

Evidence：固定337文件/SHA 806bfe0dfc046374c13ef86434ca16e55193c09621a2b76582b7e5cea6b30df4，build/typecheck exit0、renderer133/133、统一边界64/64（新增7项原生身份）、本轮真实DeepSeek教师核对/冷恢复/事务退出回滚11/11、历史回归207/207。正式4次隔离Pi启动、rendererErrors=0；4张当前浅暗双尺寸图实际查看，1366暗图确认按钮需卡内滚动，本轮不接受完整Codex动态/像素效果。完整命令/报告/SHA：apps/desktop/test-results/goal/phase4-learning-20261005/native-scope/closeout.json。

Doing/Next：生产宿主并发取消/确认门禁→完整DT-03逐条接受→DT-04两周训练（真实证据→教师修订确认→本地计划→冷恢复）→DT-05题目/测验/学习路径→MA-01至05→JOIN→Phase6/7/8；Phase3UX欠项保持OPEN，不转回模拟样例或只做底层测试。

Failed：前置测试脚本转义/重复导入已修，最终上述门禁无失败；旧失败报告保留。Blocked：无当前外部阻塞。

Runtime：npm start exit0，默认out与固定构建一致；单个日常main PID60468创建于2026-10-05T21:07:20.5459380+08:00并加载默认out/main/index.js，未读取或注入日常事实；日常DOM/人工、安装/无VPN与完整Golden仍未验。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、修改凭据/网络/VPN或第三方工作树。

以下保留历史，当前状态以上述记录为准。


## 2026-10-05 DT-03 跨会话学习核对历史（已验收子集）

Current Phase：Phase4/5 DOING；Current Task：DT-03 DOING；完整Goal ACTIVE。

Done：同一新版问小智资料侧栏可读取当前学生跨会话的已确认历史，展开实际教师最终结果、编辑前宿主候选、前一确认版本及保留率差异。主进程固定当前学生；确认/写入仍局限原候选会话。分页真实7版本→首屏5→较早2；其他学生为真实空历史。原记录被教师从新版页面编辑后，历史仍可读且标记需重核，链接只打开实读当前版本。无新Schema/Store/依赖/模型工具/第二Loop。

Doing：完整DT-03尚未接受，学习核对历史是其中一个已验证子集。Next：新learning-review native身份兼容/未知版本/移除/错误工具与无副作用拒绝→生产宿主并发取消→完整DT-03逐条接受→DT-04/05→MA-01至05→JOIN→Phase6/7/8；Phase3旧欠项继续OPEN，完整Goal ACTIVE。

Failed：本轮最终10项实例无失败；GlaZHd的前置8项保留，作为较早构建证据。既有yzQ60K/2jRs1N/QvtXBi/0382P4失败不覆盖。Blocked：无当前外部阻塞。

Evidence：固定337文件/SHA 7d5299a4beea1317bc791a7da1e02081253b6ab1f2b588a1f2ea269180217a5b；build/typecheck exit0、统一领域边界57/57、renderer133/133、正式唯一Pi真实DeepSeek历史10/10、相关历史回归207/207。两次正常冷启动；4张浅暗1366×768/1920×1080图逐张实际查看，均为当前新五空间。207历史legacy画面仅作回归，不作新版UI证据。 实例 apps/desktop/test-results/education-journey-1DXgrz/report.json，边界 apps/desktop/test-results/education-boundary-FQ7cOz/report.json，精确命令与source/artifact hash见 apps/desktop/test-results/goal/phase4-learning-20261005/history-closeout.json。

Runtime：npm start exit0；默认out与固定验收副本逐字匹配。日常单个main PID16260创建于2026-10-05T20:24:41.59548+08:00，未读取或注入日常事实；日常DOM/人工未验，静态截图不接受原生动态或完整Codex体感。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/系统网络/VPN或第三方工作树。安装、无VPN及完整Golden仍未验。

以下保留历史，当前状态以上述记录为准。

## 2026-10-05 DT-03 教师核对与策略事务（已验证子集，完整任务仍进行中）

Current Phase：Phase4/5 DOING；完整 Goal ACTIVE。Current Task：DT-03；保持用户确认的新版五空间/学生目录/四块档案/生命周期/证据时间线。

Done：唯一Pi实读证据→原本地评分建议→同新版工作台教师编辑/确认/拒绝→同一SQLite确认行原子保存校正/复习策略→确认后本轮重新分析最终结果→冷恢复与真实事务强制退出回滚，已在隔离真实DeepSeek实例验证11/11。原学习记录、发生时间与练习计数保持；拒绝不产生效果。build/typecheck exit0、统一边界51/51、renderer133/133、相关历史回归207/207；浅暗1366×768/1920×1080四图实际查看。

Doing：完整DT-03仍DOING，未将单链通过作为个性化辅导或完整Codex体验完成。跨会话版本历史可视化、新核对native身份兼容/移除/错误版本及宿主并发取消仍需正式门禁。Phase3既有欠项、DT-04/05、MA-01至05、JOIN、Phase6–8继续OPEN。

Failed：保留yzQ60K原JSON视觉失败、2jRs1N只kill启动PID的重启失败；QvtXBi虽然10项通过，人工发现初始提议与宿主评分候选的公开表述不一致，已修实际候选回执并要求确认后本轮实读。0382P4在强制退出后直接读未由宿主恢复的WAL报I/O，改为正常生产冷启动恢复后只读核对，无删库/手改数据。上述报告不覆盖或冒称完整通过。

Blocked：无当前外部阻塞。Next：依次补跨会话版本历史→核对native身份门禁→宿主并发取消→完整DT-03逐条接受→DT-04/05→MA-01至05→JOIN→Phase6/7/8；维持Master完整目标。

Evidence：apps/desktop/test-results/education-journey-GwcHvH/report.json；apps/desktop/test-results/education-boundary-7mjrS3/report.json；apps/desktop/test-results/goal/phase4-learning-20261005/teacher-review-closeout.json与teacher-review-semantic-*.log。固定构建337文件/SHA ee4872bd4f5e66c8ddee8906fc7da5a766d47168f23721fc6fbdb50de9400c67，默认out与验收副本逐字相同。旧legacy截图只作回归，不作为新版图审。日常窗口人工、安装/无VPN与完整Golden仍未验。

Runtime：npm start exit0；当前单个日常main PID66716加载默认out/main/index.js，重建后SHA与固定验收副本仍相同。未读取/注入日常事实；日常DOM/人工未验。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55；Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302。未提交/push、改凭据/系统网络/日常事实；无新依赖/Schema。


## 2026-10-05 DT-03 原学习算法与真实证据（进行中）

REUSE固定原Python学习算法+必要DTO字段机械AST投影；共享既有reading宿主，无Pydantic/第二Agent或Store。ADAPT strict显式记录和可信确认，保留v1策略。模型语义审查不通过的实例不得计教育完成。OpenMAIC本地636fab、当前上游7230053af019b89c83d22dcab0a94f38fe193856；进入MA前重新审计，不继续称636最新版。

以下保留原历史。


## 2026-10-05 用户确认新版学生页：识别与实例复核

用户最新学生截图为正式基准，保持现有布局；只扩展已有daily-entry runner做真实学生/时间线/冷恢复校验，不造第二学生页或加入示例数据。完整合同与下一项不变，见docs/design/CURRENT.md。

以下既有记录保留原历史范围。

## 2026-10-05 DT-02 学生上下文与新版页面（最新）

KEEP唯一Pi/SQLite与用户确认新版学生布局。ADAPT固定会话绑定+strict IPC/mainFrame+一致Repository/脱敏+独立native能力；DeepTutor f070 learning/identity.py只参考身份域，不能作为学生授权，不引LearningStore/runtime。只读来源投影复用既有资料/网页模式，面板复用HeroUI Button及现有记录中文标签，无新依赖。仅DT-02的保存事实读取限定接受；实际鼠标交互/英文过程/深色归档欠项保留Phase3，策略DT-03下一项。

以下既有记录保留历史范围，当前状态以上述记录为准。


## 2026-10-05 DT-02入口修复与新版页面统一

保留用户指定新版现有布局，旧图来自历史回归而非产品需另造页。正式UI证据统一入口加runtime/shell/rail断言；日常当前构建通过npm start的单实例版本切换，未删除历史兼容事实。保存ID由现有App返回，不新造学生存储。下一通过新绑定对话读取必要学习事实，不从教师档案显示名推导模型选人。


## 2026-10-05 DT-01b 正文搜索与来源定位

决定：延续原DeepTutor阅读代码与Pi唯一循环，一次一致SQLite正文快照保持原版全局匹配优先级；不把UI目录分页限制当搜索范围。只允许宿主真实来源建立导航，不接受模型伪造resource/offset。独立search marker保留quote身份与旧历史。无新依赖/Schema；全套学生反馈故障跟随DT-02核入口，不扩大到旧模拟样例专项。

历史条目保留原范围；当前进度以上述记录和 Master 为准。

## 2026-10-05 能力支线恢复与 DT-01a 引文核验

KEEP Pi/SQLite/原资料宿主；REUSE固定DeepTutor纯search/models；ADAPT独立namespace/protocol/Provider，不搬AgentLoop/Store。OpenMAIC选独立DSL/generation/renderer/editor/importer/storage抽象，下一实施前锁依赖与许可；不引Next.js/PG/director。用户本轮优先级变更明确，Phase3未完成项保留。

Goal ACTIVE。按本轮用户纠偏，当前工作转为 Phase4/5 能力支线；Phase3欠项保留OPEN，不因切换优先级记完成。详细顺序：docs/goal/EDUCATION_BRANCH_TODOLIST.md；当前限定验收：docs/goal/PHASE4_DT_01A_ACCEPTANCE.md。

Done（限定A/C）：固定新版DeepTutor源码的只读引文核验已接 Pi / EducationCapabilityProvider，真实DeepSeek正反核验、持久结果与冷恢复通过；11边界、12相关工具回归、133组件、正式Electron4场景及5张静态图审。原Python源码/Apache许可证逐字复用，无第二Loop/Store、新依赖或Schema。学生个性化/Golden F、OpenMAIC SDK/Golden E仍OPEN。

Next唯一：DT-01b，复用同一原版search_units补全资料正文搜索与来源定位；再DT-02学生真实事实→DT-03掌握度/复习→DT-04两周训练→DT-05题目/学习路径；随后MA-01 DSL本地合同→generation→renderer→编辑/导入→真实互动课堂。不能回到旧模拟样例兼容循环。

Failed/Open：原legacy全套smoke最新exit1（题本SQLite回执早于React显示）；两处断言已改为等待真实DOM，未全套重跑，不能声称207通过。Phase3完整39项、备课本全图审/整体验收、完整Goal/无VPN/安装/许可安全/人工仍OPEN。正式首4次图审失败与第五成功均保留；最后一次最终构建验收报告见closeout，不能宣称连续稳定。

日常版本统一：npm start/根启动小智.cmd先成功构建后开当前out，旧dist可恢复归档，release不跟随旧dev URL，单实例聚焦/版本变化重启；owned验收窗口隐藏。此前日常入口5/5有限验收、两图审及备课本独立8场景通过，不代表完整Phase3。默认out本轮有意更新；未清空日常事实、改密钥/供应商/DNS/proxy/VPN或提交/push。Last verified commit：90d67381a08db8ba040211921288b55c87de3f55，工作树保留既有改动。

## 2026-10-05 P3-04：资料收录、全量目录与真实正文工具接受

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-04仅资料收录、全量目录与正文工具实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。以下为当前生效状态，后文各轮记录保留历史范围。新接口只取真实本地事实，旧模拟业务兼容与测试样例书专项不再投入，不自动补回演示种子。

KEEP：Pi1.0.2唯一编排、Hana execution-once/现有Office脱敏/AnyDoc worker/原chunk算法；ADAPT：SQLite资料Repository、短事务和typed主宿主、两资料只读工具、已有Pro ListView/Markdown/EmptyState与OSS Pagination。新增version1 marker保持旧创建身份和JSONL原前缀。

不增加第二Agent、独立Python解析服务、云OCR、Schema或新依赖。DeepTutor缓存/engine signature、OpenMAIC MinerU/RFC只作接缝比较，后续按Phase4/5能力适配。原始资料仍本地，必要脱敏分段仅为当前任务发送；权限/教师确认规则不改变。

边界：PDF只接受已验证文本层路径，扫描OCR未完成；旧doc/xls/ppt不支持。目录查找按全库名称/格式，不是资料全文搜索；Unicode归一仅查询侧，SQLite lower不承诺全Unicode等价。原生选择单批50文件、既有15秒/50MiB输入/1MiB解析输出均为工具边界，不是运行预算。资料收录不等于教师确认；失败保留旧已提交派生正文且不伪称ready。教学Office产物目录仍最近100份，完整分页待后续合同。日常安装、无VPN、WPS版式、人工、全Codex体感、安全/许可、完整教育Golden均OPEN；未以隔离验收替换日常out。

Evidence：固定build9，323文件/SHA 52d6321cd1b974c26ae4ce8c06459bb157744a1660851d54475893780e193f9e；正常build/typecheck exit0，renderer129/129、资料/Office工具边界12/12、真实DeepSeek正式Electron工作台31/31、原教育隔离legacy-test回归207/207，均独立exit0。31项report.success=true/rendererErrors=[]，四次实际独立profile启动、当前构建/脚本指纹与main已加载模块核验；207本轮确实在最终build9重跑，不能作为新教育黄金闭环。37最终PNG归档，其中21张逐张视觉审阅，覆盖本轮资料空/正文/失败/冷恢复及正文工具浅暗1366×768/1920×1080；其他16张只归档。本轮控件可达/可读，不宣称全部Codex像素一致或全页WCAG。归档：apps/desktop/test-results/goal/phase3-ingestion-20261005/closeout.json，SHA 36d6820c3685aef39c4c6b6f85a38efbb1ab11ef7f1d513b29b09d1ae7238585；精确命令与失败见PHASE3_PRODUCT_SPACES_CONTRACT。

Next：P3-05，整理传统备课、讲义、题本与学生页面的教师操作体验，盘点实际 typed 入口、业务事实和失败状态，先冻结增量合同，再逐切片实现与验收；随后完整Phase3验收，再Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。Pi保持唯一生产编排。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55。本轮开始HEAD为20aa86656cdb5a0f85e0e11fa21863b50233fcb1，执行中观察到外部提交推进，保留其内容；本Agent未提交或push。Master2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302保持。daily out323文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981本轮未变；P3-03曾意外重建并精确恢复的历史保留。没有新Schema/依赖/vendor/密钥/供应商/系统DNS、proxy、VPN变更，没有清空日常数据。


## 2026-10-05 P3-03：教师资料与跨会话教学文件目录接受

复用现有SQLite资源/产物typed接口、HeroUI Pro ListView/EmptyState、HeroUI OSS SearchField和PiWorkspaceFiles，新增薄renderer页面，不造第二导入/文件宿主/Agent Loop。官方Pro站点和MCP不可访问时按已授权项目现有组件源码/CSS/util fallback；不引新依赖，Pro分发许可门禁仍OPEN。已核本地DeepTutor be1701108a22c1037bb8004322ef6145302cbf5e Apache-2.0、OpenMAIC636fab0d7edee5e7c2694117c38ece8f623573f9 MIT：资料中心/存储抽象可参考，但本轮已有本地接口足够，没有迁移其runtime或新代码许可。参考源码/官方链接见既有Phase3合同。

教师资料页使用现有 getKnowledgeOverview/importKnowledgeResources/showKnowledgeResource，显示实际资源/摘录和收录状态，已添加不等于已解析。当前仅TXT/Markdown真的收录；PDF/Office/图片仍正文待处理，不伪称可检索。资源最近100份、摘录最近24块、教学文件最近100份；筛选仅当前已载入名称/格式，非全文或全库检索。教学默认artifacts，跨会话目录显示真实保存事实，历史保存内容与当前本地文件预览分开展示；预览仍复用已有会话授权/version校验，定位由main核实际路径/产物ID后发送OS文件夹定位。文件不存在必须失败，不以旧摘要冒充当前内容。外链/图片不在目录Markdown中自动加载。旧knowledge工程页仅legacy-test，备课/讲义/题本入口保留。

本轮 npm run test:smoke 内部先执行 npm run build，忽略隔离验收构建env而短暂重建默认out。发现后核历史逐文件SHA，找回全部323文件，先将意外重建版本改名保存在owned/daily-rebuilt，再恢复原out并核总SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981；详见daily-restoration.json。不能说daily out从未变化。未触及用户日常数据/profile、密钥、系统DNS/proxy/VPN；未提交/push。以后需要保留日常out时必须显式owned build +直接 node scripts/electron-smoke.mjs，不能用会隐式重建out的npm wrapper。

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。 Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。

## 2026-10-05 P3-01/P3-02：五空间导航与聊天连续性接受

复用现有Pro AppLayout/Sidebar、HeroUI Button/Tooltip和Hana设置，增加薄ProductRail/ProductSpaceShell统一五入口，沿用现有desktop navigator而非引入第二router。Pi保持挂载，visible控制订阅/浮层外观；隐藏页面不能在窗口上留下交互浮层。设置own/child busy同锁入口。传统Search实际只学生/记录，所以归学生；未知/技术路径生产归ai。Scope仅导航/连续性；无需schema/provider/预算/依赖变更。官方Pro站点不可读取/MCP传输失败按已授权本地源fallback；未找到finesse，不声称使用。Next P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。

## 2026-10-05 P2-04：Phase2 Runtime 阶段接受

选择扩展现有4真实UI suites和原build-root接缝；无新生产Loop/预算/依赖。用真实SSE usage校对账本；不估计高缓存命中率。栏目断言依据当轮native/current可见DOM/实际回答，去旧白名单，首失败保留。依据Master Phase2范围接受唯一Pi装配、Domain保留及本轮工具控制/整理恢复；后续教育能力/人工/发布仍OPEN。Next Phase3五空间盘点合同，新接口真实数据优先，旧模拟兼容停止。

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

用户最新范围决定优先：旧模拟业务可删，未来以新接口为主，放弃学生/范围/旧checkpoint兼容工程。普通wire两别名薄Facade已实际接受，保持轻量，不扩展旧schema。Pi唯一主编排器；教育Domain保留待Phase4/5。生产业务模拟回填移到显式测试夹具。


## 2026-10-05 Phase2 P2-01 启动与旧 Runtime 边界接受

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING。P2-01 限定实现 A/C 接受，完整 Phase2 / Goal / 发布 / 人工验收 NOT_ACCEPTED。跳过测试样例说明书专项，Master 唯一主线。

采用现有Pi唯一Host加薄 RuntimeAuthority/legacy registrar；保原Domain与数据。受控legacy仅原隔离教育回归，产品不可选择。旧开关回退、把DeepTutor/OpenMAIC Runtime整搬、按Loop名称删除Domain均拒绝。官方setPath同步显式profile，默认profile不动；原导航runner等待真实UI入口。

Next：P2-02旧 Console/直接请求兼容 Facade 到同一 Pi，先请求校验、单次投递与原 AiConsoleRunResult 接缝，再续跑/停止/问答/重试。禁用旧入口不等于教育能力迁移完成；P2-03重复装配退役、P2-04完整阶段验收随后。

## 2026-10-05 Goal主线恢复、Phase1整体验收与Phase2入口

Goal ACTIVE；Phase1 Master九项主工作台完成实现层A/C验收（非完整Goal/发布/人工接受）；Current Phase：Phase2 Pi Runtime Consolidation DOING。

生产只加OfficeMarkdown薄适配器：沿原Pro StreamMarkdown/CodeBlock，pre恢复Streamdown2.5 data-block标记；app-owned CSS绑定原Shiki双主题到现有workspace media/semantic色。原vendor未改，无新依赖/Schema/IPC/model/权限/预算/上传变化；原OfficeConversation仅替换import/调用。inline、JSON fence、无语言fence、部分stream、HTML escaping边界5项加入原组件suite。

A薄adapter恢复已安装Streamdown和原Shiki默认语义；B改vendor/C依赖降级/自造parser不用。根据Master阶段1九项范围收口；完整Goal最终门禁不提前接受。Phase2需要逐入口替换真实编排，TS确定性context保留，DeepTutor/OpenMAIC教育能力剥离成Domain/Capability。

Next：Phase2 P2-01：按已核实旧IPC→Console/Graph/sidecar入站清单冻结RuntimeAuthority与兼容合同，移除正式环境回到旧编排的开关，逐条将旧聊天/续跑/停止迁移到Pi；保确定性教育Domain、旧数据和传统页面。不得直接删除agent-loop.ts或整搬DeepTutor/OpenMAIC Runtime。见docs/goal/PHASE2_RUNTIME_CONTRACT.md。

跳过测试样例书专项，唯一主线Master Goal；不无限重验已通过Shell小片，不将Phase2–8能力倒塞Phase1。日常原反馈/配置D、无VPN/安装E、完整Codex体感与像素对齐、教育黄金A–G、云视觉、WPS本轮版式、安全/Pro分发许可及三连稳定仍开放。没有改变Master、HEAD、daily out/profile/key、系统DNS/proxy/VPN，无提交/push。本轮不估算缓存命中率。

## 2026-10-05 文件面板主题与真实导航有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅M01/M09/M10只读文件面板有限A/C通过，完整Master DoD不降低。

复用现有Hana只读文件/Office解析、typed IPC、SQLite会话授权，以及原HeroUI Pro FileTree/Markdown和OSS Tabs/Resizable。生产仅两处：glass覆盖文件筛选placeholder使用语义muted色且opacity1；PiWorkspaceFiles在当前选中项或原Tabs滚动容器尺寸变化时，用scoped ref/ResizeObserver/rAF仅调整横向scrollLeft，使当前页签保持可见，不滚聊天、不抢焦点，卸载清理。文件正文不进模型、不持久化；未新增依赖/Schema/IPC/权限/loop/预算或自动上传。

A选现有组件薄适配；B重造文件管理器/C迁移教育runtime无必要，均不用。原Tabs保滚动按钮与键盘语义，只补当前selection/尺寸变化的定位。

下一唯一：Phase1按Master第2247段完成整体requirements与证据审计（sidebar/chat/composer/history/working/summary/plan/tool/progress/artifacts/files/approval/steer/retry/resume/compaction/model/skills/settings/glass）。先映射现有源码/固定build/各有限closeout，列最早缺口并完成正式实例与真实视觉，再决定Phase1接受；学生提示间歇风险列入主路径欠项。不得无限重复已关闭文件小切片或跳到Phase2。之后按Master执行唯一Pi runtime、五产品空间、教育能力/飞轮和黄金A–G。

日常D/用户原凭证联网图片失败、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS实际版式、安全与Pro分发许可保持OPEN。三元暂停；日常out/profile/key、代理/DNS/VPN、Master/HEAD及上一轮closeout均保持，未提交/push。本轮未新测或估算DeepSeek缓存率。


## 2026-10-05 公开中文与教师确认办公交付有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。完整Master DoD保持，本轮仅M01/M10办公交付事实与默认中文公开过程有限A/C验收。

A选本地真实交付投影，保Pi/工具/审批和原native。B仅prompt无法阻止本地确认后旧数值；C自动上传本地修订正文改变隐私，均不作为方案。应用在message_end缓冲分类，不展示私有CoT，不截断工具过程；最终文件交付消息来自本轮状态。

下一唯一：Phase1 Files/Artifacts完整面板验收。既有FILE面板当前证据只有浅色宽窄；冻结现有Hana文件宿主、HeroUI预览/来源与当前主题复用合同，补文件导航、版本变化/损坏/失败返回、冷恢复、浅暗双尺寸与真实PNG，保只读权限和本地事实。完整Shell验收后进入Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮/黄金A–G。

日常D/用户原凭证联网图片反馈、无VPN/安装E、连续三次稳定、完整Shell/Goal、云视觉、WPS排版、安全修补与Pro分发许可保持OPEN，三元暂停。未更换日常out/profile/key、代理/DNS/VPN或提交/push；Master/HEAD与日常out SHA原样，旧证据保留。本轮不新统计缓存率或承诺命中。办公公开交付采用可信回执，不宣称已把模型原始总结变成事实或解决所有自然语言幻觉。


## 2026-10-05 原失败会话创建指纹兼容有限验收

Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮仅 M01/M10 已识别旧创建身份兼容有限 A/C 通过，保持完整 Master DoD。

原 aXLjJ8 / copied pi-auto-ui-ik9wla 配置拒绝已定位：原授权工作目录会话创建时使用旧 copy 审批提示规则，后续文案更新直接改变创建 fingerprint，恢复在请求 provider 之前拒绝。两份旧授权 native 的指纹精确匹配已保存 p07-office-document-tools 原源码；私有会话精确匹配当前规则。不是这两份会话的凭证或网络故障。

选A：应用创建身份薄适配器，复用当前Pi SessionManager。B直接改JSONL/SQLite指纹会覆盖历史并绕审核，拒绝；C放松配置保护/加入另一编排器无必要。已核单旧规则用于identity，最新规则用于有效prompt；所有控制/记忆能力保原严格校验。无迁移表/依赖变化，回滚恢复owned source-before中3项，原历史不需逆迁移。

下一唯一：Phase1 公开中文摘要与教师修订后事实一致性。先冻结当前实际旧37正文/已确认41文件差异与英文过程的交付合同，比较现有 Hana/Pi 公开事件、Office确认结果/产物回执，复用成熟接缝；以原真实教师编辑→确认→文件→公开回复→cold链路逐字段验收，不能用模型说已完成或测试回读替代文件真源。之后完成 Shell，再 Phase2 唯一 Pi runtime、Phase3 五空间、教育适配/飞轮/黄金 A–G。

公开英文摘要、旧37正文与教师修订41文件一致性仍 OPEN。日常 D/用户原凭证联网图片反馈、无VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS排版、安全修补与 Pro 分发许可仍 OPEN；三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常profile/key、系统代理/DNS/VPN或提交/push。缓存策略不改，本轮未新统计命中率，不将历史比例写成当前保证。


## 2026-10-05 真实工作过程有限切片验收与继续位置

完整 Goal ACTIVE；Phase1 Codex Shell DOING / NOT_ACCEPTED。本轮只接受 M01/M10 真实工作过程的有限 A/C 切片。

采用已有workspaceStatus+公开Pi projection+OSSSpinner，避免复制另一套编排/私有CoT。采用既有protectedContext顺序调整，当前教师文本不重写。测试现代化使用真实UI fresh seed、实际原生chronology和131072提前阈值；不篡改JSONL、不降低生产容量/权限保护。等待有限主题过渡以测稳定最终对比度，保原过渡失败证据。

真实 reported usage（排除auto副本继承30条旧run，未上报/停止分开）：control3个reported run缓存读入占输入87.08%；auto10个55.33%；Office7个94.65%；queue2个69.87%。分母=input+cacheRead+cacheWrite，input不含缓存读入；未报告分别2/3/3/3条，不按0补齐，不推算成本或保证未来命中率。原始可核验数字见usage-readback.json；原有稳定prefix与Hana/Pi缓存/压缩接缝保持，不为提高比例增加warmup调用。

下一唯一：先定位原 copied pi-auto-ui-ik9wla 会话的创建快照/配置指纹兼容失败（aXLjJ8），冻结可识别版本的迁移、回滚和原字节验收合同，再修复；不得用 fresh seed 通过关闭旧兼容、放松权限指纹或重写 native JSONL。之后补齐 Shell：中文公开摘要、教师修订后正文与实际文件数值一致；再 Phase2 唯一 Pi runtime、Phase3 五空间与教育能力/飞轮/黄金 A–G。

日常 D、无 VPN/安装 E、连续三次稳定、完整 Shell/Goal、云视觉、WPS 实际排版、安全修补与 Pro 分发许可继续 OPEN；用户原凭证/联网/图片失败未关闭，三元题组暂停。日常 out 323 文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302、HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未改日常 profile/key、系统代理/DNS/VPN，未提交/push。


## 2026-10-05 联网与浏览器有限切片验收结果

ADR-017：沿现有 Hana/Pi 浏览器薄适配；成熟 WebContentsView 负责 native capture，主进程固定状态动作负责恢复，OSS Button/Modal负责控件。整搬Hana broad IPC会绕过本项目网页/写操作授权，不采用；独立Playwright生产服务无必要。Playwright仅复用已安装测试启动器。多入口共用语义theme，glass布局独占主入口以避免Vite hoist回退。

生产沿现有 Pi customTools、Hana v0.450.0 DOM/ref/wait/截图文件名与 Electron WebContentsView。删除截图前可能挂起的 renderer RAF 前置等待，原生 capturePage(stayAwake) 受15秒工具取消/超时、samePage/revision及文件hash校验约束；此为单次工具边界，不是运行预算。失败页复用 OSS Button，固定返回动作只被本地 status view 的 will-navigate 消费并关闭本会话窗口，保失败历史/其他会话，不重放模型或偷偷重新联网。截图 Modal 加同一主题边界。共享颜色 token 从 glass 抽为独立 theme CSS，布局覆盖仅留主入口；status HTML 与主入口同 HeroUI layer 顺序。无新依赖/表/共享 IPC/第二 runtime，自动压缩和无预算规则保持。

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

稳定口径：设置和附件/归档portal统一pi-themed-surface；应用CSS覆盖Hana状态透明度，vendor许可/源不改。Codex归档使用既有OSS Modal，旧入口modal=false保持原行为；本地真源、权限/教师确认、typed服务和原Pi compaction不变。右键菜单仍待独立适配。

精确证据与SHA回读：apps/desktop/test-results/goal/overlays-20261005/closeout.json；原始专项报告及首次失败独立目录保留，最终命令/日志见docs/acceptance/CURRENT.md。前面layout/标题/controls为历史，不覆盖。

下一唯一：继续Phase1，先冻结会话右键菜单合同，复用成熟ContextMenu/Menu适配器，补Shift+F10/上下键/Enter/Escape与焦点恢复、屏幕边缘避让及native浅暗双尺寸；当前仍是fixed原始div，不能因归档Modal已验就称会话菜单完成。其余Shell状态验完后再Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；D/E、安全修补及Pro许可仍OPEN，三元暂停保持。

## 2026-10-05 布局与暗色控件切片验收结果

M01/M10布局与暗色控件有限切片通过；Phase1完整Codex Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。

**ADR-013：复用HeroUI壳的父内容高度与局部语义主题。** A：现有AppLayout content+parent100%+现有控件/Portal主题选定；B：page/sticky新壳会改变已有滚动权属，不采用；C：整搬其他agent/runtime与局部尺寸/主题无关，不采用。官方Pro AppLayout/ChatConversation文档已核，既有finesse MIT产品/控制台指导用于审阅；本轮不复制新Pro源码。

复用既有HeroUI AppLayout content、Sidebar、ChatConversation、Dropdown及控制卡。直接aside由100dvh改为父内容区100%，消除36px菜单+8px间距形成的44px外层隐藏滚动；仅消息/侧栏内容拥有滚动。工作区与其pi-office-menu portal统一pi语义色，并补HeroUI accent-soft/segment及旧text/line/danger别名；技能Popover补现有主题class。问答、计划、失败/审阅及办公编辑浅暗色一致，未新增依赖/表/IPC/迁移/凭证/预算/第二runtime；原自动压缩保持。

依测试样例说明书按C隔离正式Electron记录，仅最终单轮通过，不追认为连续3次稳定，不关闭用户旧配置/会话失败。Office真实模型四格式生成、确认/拒绝、教师修订、来源CAS/版本冲突、实际kill与两次冷恢复、SQLite/file SHA及独立Python格式回读通过；本轮未新验WPS/Microsoft Office应用排版。文件面板无provider新请求；未借此外推NET/OCR/视觉或全harness完成。日常out323文件SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981、Master与HEAD保持，日常profile/钥未改，无提交/push。

下一唯一：继续Phase1，冻结设置工作区、会话管理与附件/OCR弹层合同，核浅暗主题、错误/重试与可达性，再用真实native双尺寸验收。完整Shell后继续Phase2唯一Pi runtime、Phase3五空间、教育适配/飞轮与黄金A–G；日常人工D、无VPN/安装E、安全修补及Pro许可仍开放。

## 2026-10-05 自动标题兼容切片验收结果

**ADR-012：统一本地标题派生与保守来源迁移。** A采用既有fallback+Pi严格命令边界；B已核Hana真实LLM summarizeTitle，为后续候选；C不迁移DeepTutor/OpenMAIC会话runtime。共享纯函数与增量provenance；旧legacy不猜手工、新rename必manual，附件触发器savepoint更新、原一语句发布/旧receipt保持。旧版实际副本读通过，new task旧语义未外推。

自动标题本地fallback兼容切片有限通过；Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。普通append与附件原子publish共用conversationTitle，合法/skill前缀不挤占任务标题，保原提示词/Pi原生记录；不是新增LLM语义摘要命名。

下一唯一：Phase1专项定位问答/长过程中的Shell顶部裁切，冻结布局/滚动与完整暗色菜单合同，复用既有HeroUI/语义主题和原控制卡，以真实native双尺寸、可达性与PNG验收。完整Shell后再Phase2退役重复runtime、Phase3五空间、教育适配/飞轮/黄金A–G；日常人工D、无VPN安装E、安全修补与Pro许可仍开放。

## 2026-10-05 CTRL/CFG当前构建验收结果

**ADR-011：当前构建控制/配置与历史测试政策分离。** 复用Pi原生队列和Hana ID/revision宿主，无生产新runtime。legacy suite改为既有testMain固定构建和owned user profile，仅明确旧测试副本。历史auto-control-edge的finite-budget gate不符合当前合同，首缺参数在启动前即终止，保持源与日志，不以恢复预算来“通过”。合法旧新比较按当前字段/真实读取回执校验，首次误断言保留。

Phase1完整Shell仍DOING / NOT_ACCEPTED，Goal ACTIVE。仅复用现有Pi1.0.2/Hana队列宿主、控制卡和设置进行当前构建验收；本轮没有生产源码、依赖、表、IPC、预算、凭证或日常数据迁移。

下一唯一：冻结/skill自动标题兼容合同，核普通append与附件原子append两条路径，保手工标题、原提示词、历史/native绑定与本地真源；完成后继续Shell顶部裁切、完整暗色菜单与其余缺口。Phase2退役重复runtime、Phase3五空间、教育适配/飞轮、黄金A–G、日常D与无VPN安装E仍开放，不重复已通过的有限审计。

## 2026-10-05 Glass主壳与文件版本接缝结果

**ADR-010：Glass限定语义主题与来源版本接缝。** 采用既有成熟组件和官方glass tokens，未另导Pro/依赖。原正文/输入/审批保实底；光暗/强色/键盘验证分开，视觉基线不能代替业务成功。fileVersion保持既有文件身份规则，Hana可选注入兼容旧结果，正文SHA独立；读前后检查和Office CAS各负责一个边界，不移除审批或将SHA接受成版本。无表/IPC/migration/native历史变更。有限切片回滚为CSS/import/Tooltip及version回调撤回；权限/来源服务保持。

本轮Glass主壳与来源版本接缝有限验收通过，Phase1完整Shell仍DOING / NOT_ACCEPTED，整体Goal ACTIVE。生产新增仅工作区glass语义CSS、原OSS Tooltip接线，以及Hana文件回执可选version回调；Pi两处host复用既有fileVersion。正文sha256与来源version分开，读取前后变化拒绝，不放宽来源CAS/权限/教师确认。不新增依赖、表、IPC或第二runtime，不设置运行预算，原自动压缩保持。

Next：下一从Phase1原CTRL/CFG的当前构建验收继续：真实运行中编辑/撤回、停止、补充/重试、设置保存返回同会话；按实际缺口冻结合同修复。随后独立兼容合同处理/skill自动标题两条路径，完成完整Shell，再Phase2退役旧runtime、Phase3五空间。原用户失败/D日常、E无VPN与安装、A–G、安全补丁/私有日志/userData ACL/备份恢复、Pro许可仍OPEN；三元暂停保持。已有壳/包审计不再重复。

## ADR-009 — 2026-10-05 独立包实际接缝与迁移gate

复用OpenMAIC官方tarball smoke/scene-generation测试方法，原audit加--packages；只在owned ignored consumer安装固定三包，scripts禁执行。npm registry SHA512验证与Git clean/head分别记；renderer45 map源及generation38资源匹配，DSL/generation缺embedded source不当全来源签名或构建复现。

Node及实际sandbox Electron合成渲染5项过，bundle11.2MB/安装149.5MB分别量。测试的ESM ready死等与双React初失败保留；用CJS异步ready及consumer React/DOM alias，不修改上游或生产。React dedupe必须按真实bundle inputs验证，nodePaths只是fallback。

最小包接缝审计通过，不提前移植生产教学能力。完整license/NOTICE保留但grammar/wasm及最终分发范围继续gate；fonts.css CDN不采用，系统字体合成例不证明KaTeX/Office字体。富文本/shape/table等原包危险HTML渲染须宿主schema/sanitize/URL边界。PBL第二loop/整站/PG/远端存储仍不采用。

Phase0应收敛固定审计范围和可执行hold，而非要求所有Phase4/5/7能力已实现；同样不能把未修风险或未验证资源改为通过。下一安全可达性/日志/Windows收敛及Phase1真实Shell合同，保持《测试样例说明书》原失败D/E条件和整体active。

## ADR-001 — 2026-10-05 新 Master 优先级

用户明确指定 `XIAOZHI_CODEX_GOAL.md` 为最高工程合同。它将方向更新为 Codex-first教育桌面、五空间、Liquid Glass、唯一Pi编排与受评估的本地学习飞轮。

旧28/35/67及四根文档的方向/下一项在冲突处由新Master取代，历史有效证据保留；167自动标题转入Phase1/3缺口。Phase0先完成，不能把已有设置通过当新Goal完成。

## ADR-002 — 唯一生产编排器与教育能力适配

Pi SDK是唯一目标Orchestrator。当前旧Console/Harness仍可达，所以这是待实现目标而非已达事实。通过adapter/provider/facade保留教育DOMAIN，逐步退役重复RUNTIME；不直接修改vendoredDeepTutor，不整站嵌套OpenMAIC，不删域数据。

每个迁移先冻结共享契约、调用替代、schema/脱敏、错误/取消/恢复、旧数据与回滚。退役须新链路过验、旧引用清零。

已核TS旧runAiAgentLoop为确定性context编译，教育DOMAIN应保留；Pythonbridge独立loop及Console/用户输入路径LangGraph为编排退役候选。Pi聊天条件分支不消除传统错题回调的旧入口，按真实接线逐入口迁移。旧budget通道只作兼容审计，不新增运行预算。

## ADR-003 — 用户概念与过程可见性

主导航仅问小智/我的资料/教学内容/学生/设置。技术概念默认隐藏，传统数据管理页保留。显示公开计划/工作摘要/工具回执/进度/审批/文件/产物/停止恢复，不展示模型私有Chain-of-Thought。

Codex一致使用体感以真实行为与交付为准；新视觉按Apple-like Liquid Glass × Codex Productivity × Education Warmth，不继续要求未公开桌面组件源码逐像素复制。

## ADR-004 — 复用、许可证与上游快照

调查顺序EduDev→Pi→DeepTutor→OpenMAIC→HeroUI/finesse→官方开源候选，最后才自写。只读隔离上游源，保护原checkout脏改动。

根仓库许可证不能代替模块/字体/转依赖许可证。OpenMAIC部分bundled LGPL代码不能标全MIT；Pro查询可用不证明发布授权。证据未闭合的源码不移植，审计其他项继续。

## ADR-005 — 数据真源与后台学习边界

SQLite/files本地真源；运行数据退出Git须备份/迁移/readback/恢复验证后执行，当前仅元数据审计，不删用户文件。

飞轮允许可评估、版本化、回滚的偏好/策略/路由优化；FACT/PREFERENCE/INFERENCE/STRATEGY/PROMPT/SKILL分开。禁自动改事实、源码、schema、credential、权限/approval、安全隐私规则。Hermes README当前仅部分优化落地，不能冒称完整飞轮可直接搬入。

## ADR-006 — 稳定文档与测试收敛

后续使用四份Goal文件与四份领域CURRENT作为稳定入口，不再每个切片新增编号合同/报告/独立smoke。复用已有测试框架、说明书与合成样本；需要新测试时补现有领域suite。

旧证据不可覆盖；历史文档归档前先迁移链接。新Master全门禁决定DONE，A/B/C/D/E层级不串用；缺真实视觉不称UI完成。本轮只审计/文档，无生产改动，不为了文档重复跑无关79/207。

## ADR-007 — 可重复审计入口与离线基线

复用既有audit.mjs新增--baseline，不另建独立smoke/依赖。owned profile/cwd + 现有unpackaged E2E_DIALOG_MODE跳过.env.local；key/model必须实断言为空，固定生产构建指纹。合成公开历史与本地I/O只说明对应性能/恢复，provider与安装标UNMEASURED。

首KwhKiQ环境断言失败：空env仍让main loadLocalEnv加载本地.env.local，不能称该失败启动“未读凭证”；未打印值，也未提交模型任务。改owned cwd+既有测试gate。次1f7hU0定位器匹配侧栏预览及正文，改限定office-conversation，不放宽真实正文检查；第三IfNQQo C7通过。保全部失败，不追认重复稳定；冷恢复的零tool事件仅在composer ready后观察，不以迟注册监听证明整个启动期零重放。

领域学情suite在断言前遇Pi传递CJS打包错误，只externalize安装的pi-coding-agent，原8项断言不变。renderer79、typecheck、原scheduler20、web13、evidence grader22实际重跑；原audit run-J5fGBi仍正确拒绝缺OCR与人工层的记录，exit1是验收未完整而非本轮新产品回归失败。

## ADR-008 — 审计通过与未来迁移门禁分开

记录32文件分类/15上游处置/真实基线属于Phase0进展；无新版adapter、唯一全产品runtime、五空间或安全修补交付声明。Pro许可、转依赖闭包、Windows、备份一致性/恢复、依赖high和真实用户反馈仍保留最早未验项；不以一条“审计有风险”把这些改成已通过。后续先补候选最小闭包和UI合同，再入Phase1；三元暂停保持。

## ADR-009 — 有限审计退出与真实状态首切片

安全库存/源码路径/日志/owned Windows证据已形成；发布补丁与实际userData/备份恢复保Phase7，不要求未来所有功能在Phase0预先实现。候选许可/资源逐迁移gate继续，唯一全产品Pi在Phase2验而非冒称现成。Phase1先状态策略及原组件接线，旧历史completed不能作成功证据；通过SSR与实际typed旧历史/冷恢复/双尺寸有限验收。自动compaction沿现有public投影，不新造runtime或预算。

2026-10-05：Phase0有限审计已退出；Phase1 Shell DOING，整体NOT_ACCEPTED。新增office/workspace-status.ts并接PiWorkspaceContext，旧历史不称新任务成功；恢复、审批、补充、手动/自动整理、失败/停止按公开真实状态呈现。自动整理从实际applyXiaozhiEvent投影读取，不把它等同manual operation。后端/权限/IPC/native记录/模型/key/预算/数据未改。

最后隔离正常build含tsc exit0；renderer101（原79+18状态+4实际compaction投影转换）exit0；web13/证据grader22 exit0。最终baseline-mLN2E0真实Electron10项：空/typed历史状态、200条公开合成记录/只读SQLite、冷恢复、双content尺寸输入可达/实际PNG已看；构建323文件/16105165字节/SHA f5d71e0e73bd140ae4ba9de1c6c4e0e89aba69b01420219340c2e52093c082cc。首ijFI2G为前一有限通过，保两个build/日志，不称3次稳定。离线例不证明B/provider、NET/FILE/CTRL全路径或日常D/E，也不是新Glass完整视觉验收。

security-audit-DBWIc2库存3项/exit0；fresh npm audit exit1仍0critical/3high/2moderate。只有路径/日志/owned Windows ACL与修补门禁审计通过，漏洞没有修复。证据在 apps/desktop/test-results/goal/security-0785b4e6/security-audit-DBWIc2/report.json 和 apps/desktop/test-results/acceptance/baseline-mLN2E0/report.json；完整命令见docs/acceptance/CURRENT.md。

Next：Phase1继续真实Pi主工作台：先冻结glass主壳/低噪音过程/输入栏/文件与来源的本轮组件、token、状态、回滚和验收清单；优先既有组件与公开主题token，保持实际Pi接线。按测试说明书原NET-01/FILE-01/CTRL/CFG分步跑同输入，补运行/审批/输入/自动整理在真实任务中可见的双尺寸证据，再完成其余Shell。标题属于独立兼容切片；Phase2后退役旧编排。安全修补/私有日志/实际userData ACL/备份restore、许可分发、A–G、D/E均继续开放，不重做已完成包/基线审计。

## 2026-10-24 知识库设计基线（未实施）

本轮按用户要求完成源码审计、文件夹自动题库/可选AI深度整理方案及独立AI批判复审。完整方案：docs/research/KNOWLEDGE_BASE_DELIVERY_PLAN_2026_10_24.md；审查：KNOWLEDGE_BASE_CRITICAL_REVIEW_2026_10_24.md；隔离截尾探针：KNOWLEDGE_BASE_SOURCE_AUDIT_2026_10_24.json。用户选择AI定稿入库、正式组卷集中确认；本地/云端均支持，云端每批授权必要页/裁剪图。这是待技术探针验证的设计，未实施代码/DDL/清库/上传/安装；不改变历史验收状态。下一拟议切片S0发行组件探针，未声称40GB/质量/延迟通过。

### 2026-10-24 v4设计补充（未实施）

完整方案§7.1–7.4新增小智连续问答、考点/方法找题和自然语言蓝图组卷。独立AI批判3项并修订复核：宿主持久上下文/跨run别名重绑、蓝图新版本与确定性检查、库存快照/语义标注覆盖的缺额证明；保留现Pi及实读/整卷集中确认/Office链路。只更新设计文档，不改变现实现和验收状态。

## 2026-10-16 EV-MAIN-02 修复合同冻结

采用 apps/desktop/test-results/goal/ev-repair-20261016/contract.md：复用已有 Pi/偏好事务/聊天撤销，区分教学任务与确认交流；撤出模型自报视觉验证和假重置的未验草稿入口，保持 DT 真实协助/视觉目标完整，后续按源证据接入。无新 runtime/DDL/依赖/权限变化。已保存本片 before 与 hash，后续只按真实实例结果接受。

## 2026-10-16 BoardUI 复用复核决定

保留用户提供的 BoardUI Web Search 组件作为 renderer 展示层适配，继续由唯一 Pi host/projection 提供状态与来源；不引入第二 AgentLoop、第二数据状态机或新依赖。将本轮结果记为 LIMITED_ACCEPTED，真实联网链路继续沿 Feishu NET/IMG/FILE 队列单独验收。
## 2026-10-16 DT-05 上下文整理决定

- 继续沿唯一 Pi production host 和既有 question/practice/mistake/review provider 接入 DeepTutor；不迁入第二 AgentLoop、第二事实库或完整 DeepTutor runtime。
- `reuse-deeptutor-question.mjs` 允许从多个本地候选目录发现上游源码，但必须固定 revision、记录来源和字节/文件计数；当前实际来源为 `D:/WorkProject/小智智能体借鉴项目/DeepTutor`，revision `f07029cfcf2c8dfccdb671cdfc343db8334f5741`。
- `DT-05-questions` 的 6/6 只接受为题目 source/read path；不能外推到教师确认、练习结果、错题相似题、照片 OCR 或视觉证据。
- `test:deeptutor-question-notebook` 的动态 `child_process` 失败归类为 Node ESM smoke bundle 与 Electron CommonJS 边界问题。临时 externalize/stub 方案已撤回；除非后续需要该 smoke，否则不为测试绕过生产模块边界。
- 历史 journey 报告必须保留，但在当前构建的 review/practice/photo 报告生成前不得升级 DT-05 状态。每片完成后再同步 CURRENT_STATE、CAPABILITY_MATRIX、ACCEPTANCE、EDUCATION_BRANCH_TODOLIST 和根四文档。
