# KB-S5/S6 已确认试卷的 Word/PDF 交付合同

日期：2026-10-09，续验2026-10-10。状态：S5-A LIMITED_ACCEPTED（文字范围），S5-B LIMITED_ACCEPTED（自然图文单题），S6 DOING。Master ACTIVE，Phase 4/5 DOING。本片承接 S3 的整卷快照和 S4 的受审练习；不恢复第二运行时，不把文字导出当作真实图公式验收。

## 教师可见结果与完成定义

从当前教学内容中的已确认试卷进入，或在同一小智会话提出导出：选择学生卷/教师答案卷、Word/PDF，核对实际完整拟产物，批准后得到真实版本化文件与可重启读取的交付记录。学生卷不含文本答案/解析或学生个人事实；教师卷保留参考答案、解析、来源与尚未独立核验的状态。源版本改变、未确认、缺题、停止、拒绝、目标已存在及生成失败都应显示可理解反馈，不覆盖旧文件。

## Recherche / Reuse 与当前缺口

- KEEP：`PaperRepository.review/latest` 的确认状态、整卷 digest、学生/会话授权、题目/原件版本回读；现 `QuestionDocument`/projection/原图查询；typed preload；当前五空间导航与 PaperReviewPanel。
- KEEP：`createOfficeArtifactCoordinator` 的同 Pi 教师等待、拟稿编辑/拒绝/批准、停止及失败恢复；`createOfficeArtifactService` 的授权工作目录、原生 Pi mutation queue、exclusive 新文件安装、输出 hash、prepared/committing/uncertain 和正式 artifact 发布。
- KEEP：已安装的 docx 9.8.1（原生 ImageRun/Office Math 类型已在本地类型文件确认）、现 Hana PDF renderer 0.449.0 和隔离 Electron printToPDF。先复用，不安装新依赖或引入额外云服务。
- EXTEND：确定性 Paper→Office 编译，不由 LLM 重新抄写题目和答案；整卷来源必须保存在现 Office 拟稿/正式产物的版本化元数据中，并在提出、教师修订/批准、生成与落盘前复核。仅“sources=[]”会误标 ai_generated，不能用于原题卷。
- 当前 Office draft v1 只有文字/表格、20 章节/每章20段/每段1000字符/256KiB；没有题库 CAS 或图片/公式对象。其来源表只接受 workspace_file/parent_artifact。必须兼容旧行，不能直接改变常量导致历史拟稿不可读。
- RETIRE：不使用旧 exportDocumentArtifact 或无审批的任意路径写入；不新建 paper 真源、文件宿主或 AgentLoop；不把扫描整页或摘要伪装为已完整切题。

## 切片顺序与冻结边界

### S5-A：安全交付骨架（必须贯通正式页面后才接受）

1. 新 `shared/paper-export.ts` 定义严格版本化请求与错误；主进程从实际确认快照编译学生卷/教师卷。
2. 对当前 Office v1 无法完整表示的题面明确拒绝或提示需要后续图公式交付；禁止截断、漏掉图表/选项/小问或退回仅 stem 的摘要。长度上限也要明确失败。
3. 扩展版本化 Office draft 的整卷来源元数据；旧 v1 原样可读。持久化复用现 draft_json/Office ledger，必要的正式来源记录是派生谱系，不成为新题库/整卷事实源。
4. `education_export_paper` 只接格式、受众和授权目录内相对文件名；从当前会话反查已确认卷。复用同一个 Office coordinator 等待教师审批，不接受模型提供的题目、答案、digest、studentId 或任意路径。
5. 传统组卷页提供同会话导出入口，复用已有文件授权/审阅控件。修订原题内容应回组卷重新确认；不能在导出草稿中改题后仍标原题保存版本。
6. 增量、幂等迁移先在全新库与旧副本验，保留旧 generator/schema 记录。重复请求、重复批准不得产生重复正式产物。

### S5-B/S6：图、公式及真实材料联合验收

#### 2026-10-10 实施前冻结

- 候选A（采用）：现 QuestionDocument v2 完整投影 + 既有原图裁剪/角色账本 + docx 9.8.1 ImageRun + Hana 隔离 PDF 宿主。公式/图形按完整题面原图交付，非可编辑数学对象；不上传图片。
- 候选B（后续）：OpenMAIC `lib/export/latex-to-omml.ts`，本地HEAD636fab0、最新只读HEAD7d324aa，MIT。依赖temml/mathml2omml且转换为PPTX专用OMML，并非Word通用验证器；本片不直接复制，不用失败时null当成功。DeepTutor本地HEADbe17011、最新6cf793b，Apache-2.0，docx skill是Python/shell文件生成说明，无当前题库授权/CAS/Office审批，保留现宿主更适合。
- 候选C（不采用）：安装完整Office/渲染服务或模型重抄题面；增加真源/资源权限并丢失原图语义。Pi现工具等待/文件变更队列已足够，不新增编排。
- 官方docx网页本轮连接失败，使用已锁定安装包MIT许可证/类型与源码核查ImageRun；不宣称本轮升级上游。HeroUI继续复用已查过的ChatTool、Button及现字段组件。
- 新拟稿 `xiaozhi.office-paper-draft.v3`：现sections扩展有序本地图片引用（question/version/block/role/asset/hash/dimensions/afterParagraph），不含路径、URL或base64。仍256KiB与16MiB产物上限；只v3允许最多121章节/每章128段，旧v1/v2限制不变。超限明确拒绝。
- 只有v2完整题面可导图文；sourceBlockIds决定题面原图，既有确认账本复核图片角色。老师的答案/解析保持原origin；含LaTeX且没有对应答案/解析原图时明确阻止，不输出裸LaTeX或偷补。
- `OriginalQuestionRepository`增加薄交付图片方法，复用binding/currentOriginal/assets；Office service在本地审阅和生成前解析严格图片引用，主进程限定PNG/hash/尺寸/总容量。typed现Office review增加本地图片数据，不新增IPC或图片真源；公开事件和模型结果不含图片。
- 教师确认必须逐版本明确勾选已检查全部图片的清晰度、完整题面、答案隔离和个人信息。主进程拒绝缺少勾选的v3批准；在现Office账本增量添加可空`image_review_hash`记录已批准draftHash，旧行保持NULL，批准/生成/回读均校验；编辑后旧勾选失效。拒绝/停止仍无需勾选。
- Word/PDF图片缩放保留宽高比、不裁剪；过高图分段应回原题裁剪，不强行缩至不可读。独立核查DOCX图片hash/尺寸顺序及PDF嵌入图/页面；需正式Electron、自然扫描、双主题双尺寸和WPS/Office实际打开后才关闭S6。
- 修改范围：上述shared/main/原图facade/OfficeGenerator/PDF/productionHost/现OfficeCard/CSS及现export边界/Golden runner。回滚点 `apps/desktop/test-results/goal/kb-office-rich-20261010/before.json`，S5-A frozen build和源码保留；不改日常资料/凭据、无新依赖。

复用 QuestionDocument 已确认完整内容和版本化本地原图；先审查图片角色、裁剪范围及答案区域，学生卷不能无提示夹带答案图。Word/PDF 均需保留完整题面、公式/图、选项、小问、编号、分数和来源。若采用原图表达公式，应如实标记非可编辑公式，并让教师检查清晰度；不以 LaTeX 字符串、空图片或不含题面的整页预览冒充可用数学卷。

使用 `D:/WorkProject/EduProject/test` 的已授权匿名资料。用户允许补充答案和讲解：必须标 teacher/ai_generated 来源，保留生成者/版本/待核验状态；不得改为教材标准答案。只用自制图只能接受骨架，不能关闭 S6。

## 测试与证据

### 2026-10-11 S6-A 并发预览修复合同

- RED：隔离副本真实5题/8图，8个并发 `papers.review` 中4个 `SQLITE_BUSY`；证据 `apps/desktop/test-results/goal/kb-natural-paper-20261011/concurrent-paper-8G9YTX/report.json`。原正式教师PDF uncertain 不能仅凭此实验断言同一根因已完全证明，须正式重验。
- 仅抽取本轮 `db.ts` 的 Paper 事务宿主；为只读 review 增加 SQLite `query_only=ON; BEGIN` 快照。create/decide/withConfirmedSource 保持 BEGIN IMMEDIATE 写租约；不能移除 source CAS、外键、教师批准或文件安装复核。其他领域事务不改。
- 无DDL、依赖或新Agent；只读事务连接独立，关闭不影响主连接。现注入测试宿主可保留 transaction 兼容；生产必须显式提供 readTransaction。旧数据/Paper digest 不变。回滚保存修复前 db/repository 副本。
- 验证：同一RED并发实验、只读禁止写入、写租约及源变化/取消边界、build/组件/领域/导出/兼容门禁、全新真实Electron自然100分流程与Word/WPS。诊断构建、曾中断的诊断或已有文件拒绝不计正式接受。

### 2026-10-11 S6-A 自然物理100分整卷：实施前合同

- 承接 S5-B closeout `d8d04eb52f2f518afe2808d13ac2e6b25d53cd50d5d6dbba8cdbc92abae205e4`，新证据目录 `apps/desktop/test-results/goal/kb-natural-paper-20261011/`。本片不重新建设导出器、审核或题库。
- 用户提供的真实资料为物理，取 sample-03 第1/4/8/9/10题（跨两页，含原图、滑轮、温度时间图、表格、科学计数及多小问）。教师练习蓝图5题×20=100分，明确是重新配分的综合练习，不冒充原卷原有分值。每道整题按综合解答归类；答案与讲解为教师补充，仍未独立认证。
- 复用现原题多区域提取、六项投影确认、source_only 蓝图/版本快照和 S5-B 同 Pi/Office 宿主。测试只扩展现 rich journey 的样本参数及多题流程，不改生产数据真源/权限/接口，不安装依赖。
- 逐题核对完整题面、独立图/表/选项/小问、裁剪顺序和答案隔离。第9题图7位于题干外，必须额外区域保留；第8题只取图6，不能夹带图7/8冒充本题附图。缺图、超高图或来源变化必须明确拒绝，不使用模型补图/补缺条件。
- 接受：真实新版 UI 导入→同Pi逐题提取→教师逐题确认→100分蓝图→教师预览→学生/教师 DOCX/PDF→全题原图哈希/像素、全参考文字和答案隔离→冷读/停止/损坏拒绝；原生 Word/WPS 各自只读打开与实际渲染/视觉检查。截图内容视口双尺寸浅暗，原生分数DPI仍不冒充已验。
- 独立算术仅核对能形式化的数值，不把该测试结果写成生产可信答案回执。开放题/图义由明确教师复核；数学语义检索、全学科准确率、自动校验/修复隔离仍属 KB002，不能凭本片通过标完成。
- 新鲜隔离目录与冻结构建/测试源码，保留 S5-B 产物、原件和首次失败。若生产缺口出现，先追加精确修复合同再实现；S6-A 接受后继续 KB002，不能反复扩张同一图文交付测试矩阵。

正式第六次仍在 main inspector 的 setContentSize evaluate 报 Promise GC，固定 DPI 未解决，不把它写为已修。仅 rich 测试截图改用 Playwright page.setViewportSize，继续断言实际 innerWidth/innerHeight、控件边界、截图像素与横向溢出；这是 Chromium 内容视口验收，不宣称操作系统原生窗口尺寸/DPI 验收。源构建不变，测试源码重新冻结，失败根保留。

2026-10-11 补充：serialize 修复后的兼容 Electron 首次暴露重复 bootstrap 同时迁移，报 Safety level may not be changed inside a transaction。以现 OmniEduStore 的实例级初始化 Promise 合并迁移/启动恢复，失败可重试、关闭后失效；bootstrap 仍实时读学生和概览，不缓存业务事实。验证并发初始化只迁移一次，已有事务内重复 bootstrap 不迁移。正式截图仅测试启动添加 force-device-scale-factor=1 并验证 devicePixelRatio，固定 CSS/像素尺寸；不改产品 DPI，原生分数缩放仍另验。

Recherche/Reuse → Contract → Implement → Typecheck → Unit/Integration → 正式 Electron → 实际文件/公式/图/答案审查 → 故障恢复 → Acceptance。

- 定向领域：未确认/缺题/源变化/跨会话/旧 digest/恶意路径/超限/不支持题面拒绝；学生答案隔离、教师出处、逐字完整、不偷补。
- Office 兼容：旧 v1 ledger/正式 artifact 可读；新旧数据库迁移幂等；源变化在教师等待与生成/落盘之间拒绝；冲突/拒绝/停止零新文件、零正式记录；中断后 uncertain 仅核验，不自动重写。
- 正式新版 Electron：真实 UI 组卷确认→同 Pi 导出→教师实际审阅/编辑允许项/批准→真实 DOCX/PDF→打开/读回→冷重启；拒绝/停止和已有目标失败可见。
- 检查 ZIP/document.xml、图片/来源 hash、PDF 页数/文本/渲染结果；A4 下题号分数、全部题目、图公式和答案无漏项/不可读。Office/WPS 只能以实际打开结果报告，未打开必须标未验。
- build、相关组件/领域测试及必要兼容 smoke、1366×768 与1920×1080 浅暗视觉、git diff --check；绑定真实构建 SHA/命令/首次失败/截图与回滚点。

## 回滚与不做

编辑前备份涉及源码/旧库副本；通过撤下新导出入口回退，保留新旧正式文件和谱系，不删除用户资料/历史。S5-A 限定接受不能替代 S6；完成二者后再进入 KB002 三模式/五变式/自动审核修复与隔离，以及 KB003 后台增量/任务优先/30–40GB/安装。

## S5-A真实收口

KB-S5-A文字整卷Office交付 LIMITED_ACCEPTED。build e73b1f1c3a393192b7858953d53a84ccd2807ebf23b4c1d547d4670d6d3ac3a0 /340文件；build/typecheck exit0、领域291、组件203/203、导出边界11、Office底座17、coordinator11、正式新版Electron19项/2启动/0 renderer错误、兼容smoke207/207。24张最终浅暗双尺寸UI截图和4张最终A4 PDF渲染实际查看；独立Word XML/PDF文本核对20题及学生答案隔离。同一Pi→现Office教师审批→学生/教师DOCX/PDF四份真实文件、4条Paper谱系且0条误标AI来源，冷启读回一致。来源变化、实际拒绝与停止均零落盘；同会话新卷确认后旧选择隐藏导出，避免导错版本。教师仅改标题，原题不改，answerVerified=false。证据：apps/desktop/test-results/goal/kb-office-20261009/closeout.json。

限定为教师UI创建的文字题100分卷；不是自然扫描/数学正确性或图公式验收。扫描题/公式当前明确拒绝，未降级摘要。Office/WPS实际打开、自然材料S6、hybrid/ai_original、5变式/验证隔离、30–40GB及安装仍OPEN。

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S5-B/S6：已确认QuestionDocument/本地原图→同Office图公式交付→自然扫描、答案隔离、Word/PDF与Office/WPS联合验收。Done：S2-A/S2-B/S3/S4-A/S4-B/S5-A各自限定接受。Doing：知识库与智能组卷完整交付。Next：S5-B/S6后KB002三模式、5变式/验证修复隔离，再KB003后台增量/任务优先/30–40GB/安装。Failed：保留首次失败；S5-A最终19项通过。Blocked：无。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。

### 2026-10-10 自然验收发现的工具恢复补丁（实施前补充）
真实DeepSeek第二次试验给regions同时附加顶层page，被既有互斥校验正确拒绝，但返回通用题干错误后模型重复同一输入。只扩展现original-question-coordinator的有界错误提示：明确删除顶层page/box，仅用regions；不放松校验、不新增运行时或写事实。扩展同original-question-boundaries验证零写入与可操作提示。原文件已备份于S5-B before。首次自然报告与日志保留。

### 2026-10-11 图文交付锁竞争修复合同（实施前补充）

正式第5次在批准后、生成前中断；隔离诊断抓到SQLITE_BUSY。现sqlite3默认并发Database.run在另一连接持有BEGIN IMMEDIATE、校验本地源文件期间，可占满libuv线程池：500ms busy_timeout的8次写入全部失败，文件读取与提交延迟约4.9秒。相同数据/锁/8次写入，采用官方Database.serialize()连接内串行后全部成功约20ms。初版使用exec的实验未复现，已纠正为生产实际run；真实Paper短事务对照通过，不将其作为锁竞争修复证据。

范围：只在现OmniEduStore.openDatabase创建连接后启用sqlite3官方串行模式；保持WAL、现事务/源CAS/审批/文件安装，不增加依赖、迁移或运行时。既有paper-export-boundaries追加实际生产连接方法的run+异步文件校验竞争用例，先RED再修复GREEN；之后build/组件/领域/Office专项、冻结构建正式图文流程和必要兼容门禁。诊断构建不用于接受。保留首次失败、当前db与专项测试before副本；通过恢复该连接模式改动回滚，不触碰用户数据。

### 2026-10-10 兼容门禁有界修复（实施前补充）
两次现有electron-smoke在历史图兼容路径报外键错误。只读诊断为1 checkpoint/0 writes；真实SqliteGraphCheckpointer + 当前LangGraph + 生产DDL，在checkpoint序列化延迟50ms时可确定复现putWrites抢在父checkpoint提交之前，sync配置也能复现。补丁仅在既有SQLite saver内登记进行中的同键put，putWrites等待对应持久化，不改DDL、不解除FK、不恢复生产第二Agent运行时。扩展已有graph-checkpoint-resume-smoke的定向延迟用例和Node-only import适配，随后正式兼容smoke。before保留原文件；首次两次兼容失败及RED诊断保留。此修复不扩展三元题组产品支线。

## S5-B真实收口

KB-S5-B自然扫描图文交付 LIMITED_ACCEPTED（单题范围）。build 517b30ea70e2e46b1e1b2fbc68d311a461b9d052f1d50e42850b00fa74fb867e /340文件；build/typecheck exit0、领域292、组件203/203、导出边界15、Office底座17、coordinator11、正式新版Electron17项/2启动/20张浅暗双尺寸截图/0 renderer错误、兼容smoke207/207。真实授权物理扫描→同Pi提取完整题面原图→教师六项核对及补充答案→纯题库1题8分卷→同Office按版本图片确认→学生/教师DOCX/PDF四份真实文件→重启读回。DOCX媒体hash与PDF解码像素等于确认原图；学生文本答案隔离、改标题旧确认失效、缺图片确认拒绝、实际图片损坏拒绝与停止无落盘均通过。Microsoft Word 16.0 独立实例只读打开两份DOCX并实际渲染，输入文件字节不变。4条Paper谱系、0条误标AI来源，4个批准hash匹配；教师补充答案和解析仍未独立验证。证据：apps/desktop/test-results/goal/kb-office-rich-20261010/closeout.json。

本片仅接受自然物理扫描的一道8分图文题及原图交付；不是自然数学100分卷、复杂公式/图表完整正确性、可编辑公式或答案正确性证明。WPS实际打开、S6更广自然材料/质量、hybrid/ai_original、5变式/自动修复隔离、30–40GB及安装仍OPEN。

Current Phase 4/5 DOING；Master ACTIVE。Current Task KB-S6：自然材料整卷/复杂图公式/答案质量及Office-WPS联合验收，随后KB002三模式/5变式/验证修复隔离，再KB003后台增量/任务优先/30–40GB/安装。Done：S2-A/S2-B/S3/S4-A/S4-B/S5-A/S5-B各自限定接受。Doing：知识库与智能组卷完整交付。Failed：首次失败保留，当前定向门禁通过。Blocked：无。Last verified commit488f8109d68027a6eb488e9d04c4eb5073d153cd（dirty，未提交）。
