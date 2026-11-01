# U4-A：持久手选题篮与确切选题快照实施合同

日期：2026-11-01。状态：只读源码审查后冻结，交 Sol 实施；本文件不是功能已实现或验收通过的声明。

## 1. 交付目标与阶段边界

完整 U4-A 目标是：真实题源查询 → 完整题面 → 持久手选题篮 → 页内整理 → 同一题篮版本预览 → 确切指定题待确认快照 → 沿现有教师确认及文件审批交付。找题、整理、预览可以往返，返回教学工作台、应用内前进后退和重启恢复必须有真实证据。

不以 A0 浏览页、临时候选篮、内存数组或原型 localStorage 作为完整交付。必要的最小宿主协议和持久化随 A 实施，不新增 Runtime、数据库体系、模型流程或 UI 库。

本片“编辑”包括加入、删除、节内调序、跨节移动、分节和蓝图调整。题干、选项、答案的本卷独立修改、改编、父题谱系与条目内容修订/审核失效属于紧邻 U4-B。不得用修改题库原题冒充编辑本卷副本；A 不宣称这些内容编辑已实现，完整用户目标仍保留。

现有正整数考试蓝图合同先保留：时长、总分、题数、分值与分节来源配额仍按旧校验执行。不增加无考试字段练习模式，不用隐藏默认值冒充该能力。

## 2. 设计与源码基线

已确认方向来自：

- `.agents/skills/edudev-design/references/decisions.md:29`，D14：完整题目选题主区、持久题篮、选题/编辑/预览往返；用途不是三个同质工作流，不删除来源策略或导出业务。
- `docs/design/system/ideal/QUESTION_STUDIO.md:33`：8道合成题、OCR/AI演示和localStorage仅为原型，不是生产真源。
- `docs/design/system/ideal/STUDIO_DELIVERY.md:3`：旧交付合同仅覆盖离线原型。
- `docs/goal/UI_DESIGN_IMPLEMENTATION_V2.md:74`：U4-A至D为生产增量，不能用原型测试关闭。

实际消费者与能力边界：

| 文件定位 | 已核对事实 |
| --- | --- |
| `apps/desktop/src/renderer/components/product/WorkbenchPageNavigation.tsx:5`；`renderer/App.tsx:2811` | 教学工作台已有paper/question_notebook入口；App挂载PaperBlueprintWorkspace与题本 |
| `renderer/components/PaperBlueprintWorkspace.tsx:26` | 当前为蓝图编辑、宿主自动选题、保存快照核对及交付；不是自由手选篮 |
| `shared/paper-blueprint.ts:17` | createPaper输入没有selected IDs或条目排序；旧schema严格校验 |
| `main/education/paper-repository.ts:68` | create事务内自动selectPaper并写pending审批，不能保证手选成员 |
| `shared/question-collection.ts:9`；`main/education/question-collection-repository.ts:19` | QuestionCollection是绑定run/蓝图的审批题组，不是通用教师手选篮 |
| `preload/index.ts:491`；`main/db.ts:4239` | listQuestionNotebook/getQuestionNotebookEntry为真实查询；真源question_bank_items |
| `shared/contracts.ts:274` | 支持关键词、学科、年级、知识点、题型、难度、来源；没有chapterId或章节—题目关系协议 |
| `main/db.ts:4281` | QuestionNotebookEntry.version来自收藏记录，不是题目内容version |
| `renderer/components/paper-ui/paper-draft-storage.ts:6` | sessionStorage仅补题蓝图暂存，不含题目、PaperView、digest或确认 |
| `renderer/components/desktop/DesktopFrame.tsx:7` | 当前导航Target只有view/session/draft；同view/session不新增历史，历史仅内存 |

行号为审查时定位，实施前按符号核实；图谱可导航但不能替代最新磁盘源码。父当前集成和M4冻结证据不在本片改写范围。

## 3. typed IPC与schema

新增 `apps/desktop/src/shared/paper-basket.ts`，定义严格版本标识，例如 `xiaozhi.paper-basket.v1`。以下名称作为本合同的实现接口：

| API | 最小输入/作用 |
| --- | --- |
| `listPaperBaskets` | schemaVersion、sessionId；只列该owner可访问的题篮摘要 |
| `readPaperBasket` | schemaVersion、sessionId、basketId；读取持久事实及动态availability |
| `readPaperBasketCandidate` | schemaVersion、sessionId、basketId、questionId；宿主返回完整公开questionFacts、contentVersion、eligibility及同owner生成题引用，供教师核对后加入 |
| `createPaperBasket` | schemaVersion、sessionId、requestId、符合旧合同的blueprint；宿主分配basketId/entryId |
| `mutatePaperBasket` | schemaVersion、sessionId、basketId、expectedRevision、requestId、严格判别联合operation |
| `createPaperFromBasket` | schemaVersion、sessionId、basketId、expectedRevision、requestId；只提交引用，不提交题面数组 |

operation至少包括add、remove、reorderSection、moveEntry、updateBlueprint和archive。输入禁止未知字段、非法原型/数组、超长字符串和越界数值，沿用现有plain-input校验惯例。题篮条目数量最多沿用现有100题上限；不允许无限JSON、无限历史或无界一次性返回。

add输入是questionId、目标sectionId及必填expectedSourceVersion等选择意图。列表仅定位questionId；完整题面必须先取得readPaperBasketCandidate返回的宿主contentVersion，教师据该版本选择，add事务内重新读取并比对同一版本，变化则拒绝，避免所见与加入内容换版。expectedSourceVersion只作期望值，不把客户端版本或题面当事实；不得猜updatedAt、抄收藏version或向renderer引入node:crypto。reorderSection输入必须是该节全部现有entryId的精确排列。moveEntry显式指定目标节与位置并重新校验资格。

输出使用明确的结果联合与稳定错误码；至少区分invalid_input、permission_denied、conflict、source_changed、shortage、unavailable、cancelled。renderer显示可执行错误，不把失败变为空篮或自动重试生成。

新IPC接入现有合法renderer事件校验和typed preload/API声明，不增加通用SQL/文件路径入口，不注册新AI工具。浏览、选题、恢复和结构整理无需模型。

## 4. 持久化、owner与生命周期

沿现有应用SQLite添加最小两表，不另存原题库：

1. 题篮表：id、session_id、宿主取得的student_id、revision、active/archived状态、schema版本、蓝图、bounded entries JSON及时间戳；可包含单独校验的UI恢复偏好。
2. 操作表：session/owner作用域、request_id、操作类型、规范输入摘要、目标basket、结果revision/整卷ID等重试所需事实及时间戳；建立唯一约束。

字段和表名可遵循仓库迁移命名，语义不得省略。JSON中的公开题面是宿主保存的pinned缓存，不是第二套题库权威。

创建时从会话读取studentId，renderer不能指定或转移所有权。每次读写检查会话未归档、学生仍有效且与创建绑定一致；读取失败不得泄露其他owner的篮。沿用PaperRepository.authorize和现有canWrite/取消租约等语义，不因新UI扩大权限。

归档保留内容，不删除题库或历史整卷。新建非空题篮前必须提供保留当前篮或归档当前篮的明确行为，不能静默清空。列举和恢复依据持久宿主记录，不依赖模块全局Map。

## 5. revision、幂等与事务

revision从1开始；有效变更在同一事务中比较expectedRevision，成功递增一次。条目entryId创建后稳定，删除/调序不重编号其身份；显示题号由规范顺序派生。

执行顺序为：校验输入 → authorize → 查持久幂等记录 → 未命中时CAS及业务校验 → 原子写题篮/操作记录 → 提交。相同requestId和相同规范操作摘要只执行一次；同requestId不同输入必须conflict。规范摘要包含操作类型、owner/篮引用、期望修订及实际操作参数，不能只hash题目ID。

重试可以返回原提交身份和结果，但必须重新验证访问权限，并重新计算当前availability和交付资格；不得重放旧“可确认/可导出”布尔值。已提交操作不因稍后来源失效而再次执行。

题篮变更、操作记录和必要派生快照写入必须同事务；取消、冲突、写失败回滚，不留下半次成员变化。并发失败保留renderer尚未提交的输入，提示重新读取/核对，禁止静默last-write-wins。

复用db.ts:1111的paperTransaction及同一SQL连接。不得在题篮事务里调用再次打开writer的papers.create，不得跨连接嵌套BEGIN IMMEDIATE。提取可共享的事务内pending写入逻辑，并保持旧入口行为。

## 6. 条目身份、版本与来源资格

持久条目至少包含：entryId、questionId、宿主计算的questionVersion、sectionId、节内顺序、宿主pinned questionFacts、必要的generation groupId/effectDigest/generationKind与来源引用。renderer不能直接写这些事实快照或审核状态。

questionVersion采用现有questionVersion(q)语义，即questionFacts的内容摘要；questionContentIdentity仅用于去重，不能替代版本。QuestionNotebookEntry.version是收藏版本，禁止复用。

宿主加入时重新读取题目，核对以下现有资格：

- 可用内容身份、无重复questionId或已识别重复内容；身份不可可靠建立时不能进入正式选题。
- 完整题面、答案和解析；archiveEligible及图文题必要条件符合现有规则。
- 原件可用、资源/题面版本当前、v2投影与当前宿主读取一致。
- 原题符合source_only/hybrid语义；generated题符合owner、学科/年级、当前有效教师确认题组、质量证据、父题、保存版本和effectDigest。

复用paper-selection.ts:29、db.ts:1105的校验及question-review-repository.ts:101的approvedForPaper资格，不复制一套放宽规则。搜索结果、入库状态、sourceKind或模型文字均不是审批资格。

readPaperBasket动态返回当前availability及阻断原因；来源变更时保留原pinned题面供核对，不自动覆盖、删除或替换条目。生成资格失效同样阻断正式快照/确认。快照与导出时再次校验，加入成功不是永久授权。

## 7. 顺序、分节和三策略

本片规范顺序明确为：blueprint.sections顺序 + 每个section内entryIds精确排列。该顺序对应现有PaperReviewPanel.tsx:41、paper-export.ts及rich导出按节分组的消费者。

不支持跨节交错的全局顺序。跨节移动是显式操作，须重新核对目标节题型、难度、知识点及来源配额，不能通过简单改index绕过资格；预览与导出不得悄悄重排。

保留source_only/hybrid/ai_original全部语义：source_only只用合格原题；hybrid按各节generatedCount；ai_original只用当前有效教师确认原创题，不能混入变式。分值仍来自section.points，不新增任意逐题分值合同。

空篮、缺额、超额可以作为不完整草稿持久保存，返回明确缺口；正式快照必须满足旧完整蓝图及配额。变更蓝图不得静默删除、换节、补题或替换手选成员；有不匹配条目时保留并标出，待教师处理。重复加入原子拒绝。

## 8. 确切指定题快照

createPaperFromBasket采用独立严格schema/payload分支，旧paper v1/v2自动蓝图接口及历史数据兼容保留，不通过在旧输入偷偷增加可选数组实现。

在一个paperTransaction中完成：

1. authorize与幂等核验，读取basket及expectedRevision。
2. 验证active状态、蓝图、成员唯一性、规范section顺序及精确配额。
3. 对每个确切questionId重读，验证与pinned questionVersion相同，执行来源/生成审批资格检查。
4. 只按这些条目构造selection、连续题号和section.points，保存basketId+basketRevision以及必要entryId映射。
5. 写入现有ai_confirmation_items的pending整卷及幂等记录，提交前再次满足租约。

不得调用selectPaper自动匹配、暗中补题、换题或丢弃不可用条目；任何一个条目失效时整次原子拒绝，不创建部分整卷。用户草稿保留。

选择统计不能伪装成扫描全题库。新手选快照应明确选择方式和核验范围；旧scanned/scanComplete字段若沿用必须有准确语义，UI不能显示未发生的全库扫描。

## 9. 教师确认、历史与导出保护

手选派生整卷绑定basketId+basketRevision；确认时重新核对绑定修订、owner、所有来源及完整配额，不信renderer按钮状态。改变题篮使旧派生快照不能再作为当前篮确认或导出；保留旧确认/拒绝记录与已交付文件，不篡改旧历史。

不带basket引用的旧整卷仍按旧规则处理。新payload解析、摘要、历史比较及读取必须兼容旧数据，不能令历史卷不可打开。

导出继续使用现有最新confirmed、complete、sourceCurrent、digest及文件审批链。对新手选卷，basket修订检查必须接入宿主实际导出/安装边界，并在现有withConfirmedSource来源租约内复核；仅禁用UI按钮不合格。原PaperExportEntry/education_export_paper路径、学生卷/教师卷/答题卡、DOCX/PDF、原图/公式/表格、输出目录授权、失败恢复及审批回执保留。

确认整卷不等于答案独立正确，也不等于文件已导出。旧最新确认版本防误导出、快照digest及同步文件安装限制不放宽。

## 10. renderer状态与真实页面

默认以完整真实题目为主区，复用题本查询及已有QuestionMathText、QuestionOriginalPicture/NativeQuestionPicture、QuestionAnswerEvidence等。保留公式、表格、图形条件、选项、小问；答案和来源可渐进展开，不能把整题默认藏成摘要。

题篮/整理/预览共用同basketId及宿主revision。每次mutation成功后使用宿主返回状态；拒绝或超时不能先显示已保存成功。请求使用owner/请求代次保护，旧响应不得覆盖切换后的篮。

保持已有paper路由与教学工作台入口；必要时扩充窄范围导航引用，使页内往返、应用内前进后退识别同一篮和阶段。筛选、分页、滚动锚点作为可校验的UI恢复偏好与领域事实分开，可随宿主篮保存；不得将其当作题目或审批资格。恢复先读取宿主篮并重算availability，不能仅恢复旧可导出状态。

现有查询没有真实chapterId关系，首片使用真实知识点和分类，不把自由分类伪装成教材章节。不得加入8题演示、假OCR、假AI、假来源或不可执行的“加入试卷”按钮。

组件遵循已查官方HeroUI SearchField/Select/Tabs及现有本地原厂API，以安装版本为准，不升级依赖来套新文档。保留OfficeComposer、底部工具栏及弹层；不修改vendor/全局控件样式。

## 11. 实际文件集合与职责

所有路径相对本仓库根目录；实施目标沿父集成后的实际工作区，不借另一worktree或旧构建验收。

| 文件/目录 | 允许职责 |
| --- | --- |
| 新shared/paper-basket.ts | 严格schema、输入输出、错误码、条目/摘要/availability类型 |
| 新main/education/paper-basket-repository.ts | owner、CAS、幂等、持久题篮、来源复核；不启动模型 |
| 新main/education/paper-basket-api.ts | 受限IPC注册与错误映射 |
| main/db.ts | 现有库迁移、表/索引、repository和同连接事务接线；不重构全db |
| 现有主进程IPC注册点；preload/index.ts及其API类型声明 | 新typed API最小接线；沿用合法renderer校验 |
| shared/paper-blueprint.ts；main/education/paper-repository.ts | 手选payload分支、事务内精确selection/pending写入、修订绑定；旧v1/v2兼容 |
| main/education/paper-selection.ts（仅必要共享提取） | 复用资格/配额检查，不改变旧自动挑题结果语义 |
| main/education/paper-export.ts及实际rich/host校验入口（仅必要绑定校验） | 新派生修订的实际导出/安装校验；不改写Office或审批框架 |
| renderer/components/PaperBlueprintWorkspace.tsx；paper-ui/新组件及状态适配；ui-system/paper.css | 完整选题主区、持久篮、整理/预览共享与局部样式 |
| renderer/components/PaperReviewPanel.tsx、paper-ui/PaperQuestionReviewCard.tsx（按需） | 共享完整题面展示、手选范围说明；不丢来源/答案内容 |
| renderer/components/desktop/DesktopFrame.tsx、renderer/App.tsx（仅必要） | 篮ID/阶段与返回的窄接线，不重写App树或导航系统 |
| 新scripts/education/paper-basket-boundaries.mjs、paper-basket-journey.mjs；新scripts/paper-basket-ui-test.mjs | 领域事务、精确快照、真实UI行为验证；命名按仓库约定可调整 |

复用已有独立类型声明机制，先定位其真实文件，不另建重复全局window声明。正文副本编辑、OCR/AI扩展、无考试模式、模板提取和新导出体系不进入本片。若必要接线触及表中范围之外，先说明具体消费者与最小原因，不能趁机重构无关模块。

## 12. 拒绝条件、最小验证与完成定义

宿主必须拒绝：非法schema/未知字段、越界数据、跨owner、已归档/失效会话或学生、旧revision、同requestId异内容、重复题、不完整排列、非法跨节移动、不可用内容身份、来源版本变化、原件/投影不可验证、生成题审批失效或owner不符、不满足正式配额、取消/失去写租约。失败不得静默降级为自动选题或跳过条目。

最小确定性测试：

- owner隔离、revision CAS、同请求幂等/异请求冲突、并发与事务回滚、取消后无半写。
- 重复内容/ID、稳定entryId、节内精确排列、跨节移动重验、蓝图变更不暗删成员。
- pinned事实/内容version与收藏version区分；失效展示保留，快照整次拒绝。
- 候选完整题面由宿主提供contentVersion；读取后、加入前题源换版时add拒绝，不静默加入教师未见的新版本。
- generated审批/父题/保存版本失效、三策略配额和缺额语义。
- createFromBasket精确成员及section顺序一致，绝不调用自动补选；确认/导出绑定修订；旧无basket payload兼容。
- renderer异步乱序、切篮不串响应、失败保留输入、完整图文题、真实返回与未保存guard；不要用源码字符串或AST形状镜像测试冒充行为。

随后真实Electron验收使用隔离数据库中的真实入库题，不发模型：查询 → 加入 → 整理调序 → 预览 → 继续选题 → 返回教学 → 应用内前进后退 → 重启恢复同篮；核对持久条目/顺序/revision、真实错误状态、Tab/Enter/Esc及1366×768/1920×1080布局。来源变化后确认/导出必须实际被宿主阻断；学生答案隔离和真实文件审批/导出保护按触及消费者执行必要回归。

保留现有paper-workflow-ui-test、paper-draft-decision-interaction-test、desktop-navigation-guard-test及相关paper-boundaries、生成题、导出边界测试，不改断言掩盖失败。由实施方执行适合改动的typecheck/build及原厂保护检查；本合同编写阶段未执行。

完成需真实持久手选闭环及宿主拒绝证据，不以原型交互或单测数量宣布生产完成。独立教师视觉/试用仍单列，不是重新申请开发授权的前置条件。父既有授权有效；父当前集成、M4评分与历史失败证据保持冻结，不重采样或改分。
