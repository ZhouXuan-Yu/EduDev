# 小智回答质量优化：任务清单、交付合同与对照验收

2026-10-28；分支 `codex/hana-answer-quality`；研究基线 d229b1a，实施基线 3d11e5b（本次拉取 main 仅增加知识库合同）。本文件是本次 M10/M12 优化队列，不改变并行知识库 KR 队列的进度。

## 交付合同

教师结果：简单提问尽快回答；复杂教学任务有足够推理与输出空间；有资料的结论能定位本轮实际证据；故障有界恢复、停止立即生效；追问准备和推理刷新减少重复工作。

复用 Hana/Pi 单一运行时；DSH 提供重复调用提醒和有界恢复设计；SourceWeft 提供证据登记、范围/缺口、压缩摘要设计。固定上游分别为 Hana `9a6cabf8c513db5edc6cf8179a538c9075885c6e`、DSH `f3803c96974ad4a94195fb97e5c637e9c2a3afe3`、SourceWeft `0ccc867a53903b04c26d5c2c2f959659904f3b6d`。复制代码记录许可证、源路径、SHA、适配项。

修改边界：main/xiaozhi-agent 的请求、准备、工具和证据适配；既有 shared 事件/来源与 renderer 回复；对应本地脚本。SQLite 事实表、资料权限、教师确认、原件、正式产物与唯一 Pi loop 保留。无破坏性迁移；新元数据可选，旧会话可读取。不能复用旧 run 的工具闭包/审批；不能以 mtime 代替授权与内容复验。

回滚：独立提交可 revert；`XIAOZHI_ANSWER_QUALITY=legacy`（主进程环境开关）用于同构建 A/B 和整组回退，历史证据仍兼容。不改变 API Key、生产用户根、其它工作树、安装包。

## 实施清单

### 2026-10-29 续接合同

中断恢复时 `ed17e87` 已提交、工作树干净，尚未推送。用户明确改为先对齐并完成全部功能、每片测试一次、最后集中验收；不继续增加离线盲评工具。本轮按最初研究方案补齐：①Hana式原生会话资源租约/有界空闲复用；②非活动消息渲染隔离；③已授权附件/工作文件的本轮正文引用。

会话复用只保存Pi原生SessionManager，不保存旧run的工具闭包、API凭证、权限、审批或事件owner；每轮重新绑定并完整复验来源/模型/技能/记忆，原生文件字节变更则重载，单写者、空闲过期/LRU/内存压力释放。所有功能沿现有main→typed preload→renderer契约；不新增表或迁移。附件/文件引用只来自成功实读回执并沿原版本定位打开。目标是完成可用功能与一次针对性检查，最终集中质量验收另行记录；已用完20次API额度，不自动追加调用。`legacy`开关和独立revert可回退。

| ID | 工作及逐项对照 | 验收标准 | 状态 |
|---|---|---|---|
| AQ00 | 基线与分段观测：准备/首个模型事件/首段答案/末段/终态；请求大小与真实 usage/cache | 元数据只含数值；区分推理与答案；保留 legacy 对照 | 已实现；实际 SDK 请求体计量，完整性能样本待验 |
| AQ01 | Hana 思考策略：固定 low/4096 → 简单/常规/深入，受当前模型容量约束 | 真实 SDK wire 参数；未知/陈旧容量保守；长输出标记截断 | 已实现；wire 与边界通过；自然质量待验 |
| AQ02 | Hana 目录与提示词：全领域规则 → 稳定公共规则、按需领域说明/工具 | 可发现已授权工具；不增加权限；小集合不必发现；保留领域约束 | 已直接复用固定 SHA ToolCatalog；schema 延迟加载实测通过 |
| AQ03 | Hana 不可变准备资源与原生会话资源复用 | 每次全内容/链接校验；32 项技能解析；原生历史单写者、字节失效、空闲有界；不缓存授权/凭证/run闭包 | 已实现技能解析、重叠扫描合并及原生历史资源租约；4个空闲/2分钟/16MiB限制，模型或原生文件变化重载；AgentSession逐轮绑定 |
| AQ04 | SourceWeft 证据登记：资料列表 → 本轮引用与原来源定位 | 伪造/旧轮引用不成立；查找和实读分离；原定位校验；UI/冷恢复 | 已实现资料/题目/网页/已提交附件/授权工作文件引用；附件行号与OCR修订、文件版本打开时复核 |
| AQ05 | DSH 重复工具提醒与有限模型请求恢复 | 规范化参数；不同结果/新输入重置；无硬禁轮询；停止/401/正文中断不重放 | 已实现；HTTP/取消/权限撤销边界通过 |
| AQ06 | 推理累计脱敏/刷新有界；回复组件隔离 | 首个反馈及时、终态 flush、跨段隔离；不改变既有正文节拍 | 已实现33ms推理合并、正文与过程独立更新、历史附件回调稳定与非活动答案memo；最终内容一致 |
| AQ07 | 分层上下文与任务核验：目标/约束/授权来源/进展/未完成 | 既有偏好与显式记忆；撤销生效；摘要不是证据/权限；无私密信息自动收录 | 已实现提示与压缩规则；长期记忆编译不在本次范围 |
| AQ08 | 同条件质量集、失败矩阵、构建/组件/原生路径、集成 | 逐项报告通过/失败/未验；实际 build、SQLite/重启；正常 push 回读 | 功能完成后的集中本地检查已通过；20次真实API/10组初步A/B完成；最终自然教学效果另行集中评估 |

会话资源层现在保存可跨轮复用的Pi原生历史资源，AgentSession、工具闭包、权限、凭证和事件owner按轮重建；原生历史的缓存命中不跳过任何原授权校验。按最初研究边界，复杂任务子Agent保留为可选方向；现有授权教师偏好、当前任务保护上下文和按需记忆查询继续接入，不自动编译私密对话。

## 质量与性能的 A/B 标准

以下保留最终集中效果评估标准；用户2026-10-29明确先完成全部功能、每片测试一次，再集中验收，因此不把扩建盲评工具或完成大样本作为继续实现的前置条件。

同一模型/版本、资料 SHA、网络环境交替跑 legacy/optimized。整组对照保留两版各自的策略参数并逐请求记录；另作相同 effort/output 的消融对照，区分更大预算与调度本身的收益。至少 30 个冻结任务，覆盖常识解释、数学推导、指定资料、多资料冲突/不足、长教案、工具产物、错题练习、追问与停止；每个任务至少三次。保留错误与超时，不选择性丢弃样本。

人工盲评：正确性 35%、要求覆盖 25%、证据支持 20%、教学适配 15%、表达清晰 5%。所有事实引用须合法，关键结论还须人工核对支持关系；引用合法不等于答案正确。高风险隐私/越权/重复写入必须 0。至少 20 个未参与调参的留出任务；优化平均分需提高，且任何类别不能出现系统性退化。未完成盲评不得宣称全面优于 Hana/旧版或“1+1=3 已实现”。

性能分层：本地 preparation、首个 provider event、首个可用正文、正文间隔、末段至落账、UI 长任务、RSS。至少 30 次才报告样本 P95，并标注样本与环境；深入模式可以增加模型思考时间，需用质量与成本解释，不混入简单问答延迟。简单任务准备和首正文 P95 不得恶化超过 10%；流式更新每秒不超设计节拍、终态不等待动画。

异常矩阵：401/429/503、首字前失败、正文中断、重试等待中停止、工具拒绝后重复、同参数不同结果、资料变更、技能内容改变/禁用、记忆撤销、模型切换、会话切换、退出/冷重启、事件缺口。以实际生产入口与持久化读回为证据。

## 证据记录

实施前：工作树 clean；已从 detached HEAD 建立新分支并正常 fetch/ff-only main；没有接管其它工作树。研究没有真实模型 A/B，不能写成性能或答案质量基线。下方随实施更新精确结果。

## 源码吸收方式与逐项对比标准

| 优势来源 | 原小智 | 本次实现 | 必须比较的结果/未覆盖项 |
|---|---|---|---|
| Hana ToolCatalog | 模型同时接收大量工具/schema | 直接复用 BM25/CJK 目录；固定常用工具、任务匹配补充、find_education_tools 按需加载；完整领域规则随工具描述加载 | 对照实际首轮工具数、请求字节、误选工具率与任务成功率；发现工具可能增加一次模型往返，不保证每次更快 |
| Hana 任务思考与容量利用 | low、最多4096输出 | fast low/4096，standard medium/8192，deep high/16384；陈旧/未知容量仍4096；输出上限结束明确截断 | 同模型实际请求参数、长任务覆盖与正确率；深入任务允许更长思考，必须记录成本 |
| Hana 准备复用 | 重复解析同版本技能 | 每次仍验证完整字节/链接/当前授权，仅复用原生解析对象 | 变更、禁用、撤销、异步读取期间变化不得穿透；不能宣称整个 session 常驻或准备耗时已大幅下降 |
| Hana 的流式体验方向 | 正文已有32ms合并；推理反复脱敏累积全文 | 保留正文机制；推理33ms合并、首帧及时、终态强制排空；Markdown组件memo隔离 | 最终内容完全一致、停止无迟到事件、实际长任务/掉帧待测。未搬入上游未被调用的 adaptive-stream hook |
| DSH 运行恢复与循环提示 | 单次临时HTTP失败中止；重复工具缺统一提示 | HTTP429/502/503/504最多2次重试，尊重≤5秒Retry-After，重试前重新校验；相同工具/规范参数/结果第3/5/8次提醒 | 401/403/网络歧义/部分正文不重放；停止中断等待；不同结果与新用户轮重置；不硬禁合法轮询 |
| SourceWeft 证据与覆盖 | 显示本轮读取资料，正文缺注册引用 | 成功实读的资料/题目/网页/已提交附件/授权工作文件登记run级citation；正文点击定位来源，附件/文件可打开原版本文字行；提示覆盖/冲突/缺口 | 引用注册率、定位与版本正确、逐条结论支持度；OCR只引用教师确认文字，工作路径脱敏发生变化时保留标题而不公开原路径 |
| SourceWeft/Hana 上下文组织 | 历史压缩、偏好与记忆已存在 | 稳定公共提示；当前资料可用范围放当前用户消息的宿主说明；统一结构化任务摘要与当前要求优先级 | 多轮目标保持率/撤销后无残留/摘要不升级权限；未引入 SourceWeft 全量研究 agent 或自动私密记忆 |

复用不是同时接入三个运行时。Hana/Pi 继续承载唯一会话与工具执行，DSH/SourceWeft 的可用机制经小智现有权限、来源和教师业务边界适配。没有新增依赖或数据库 migration。新增 vendor 代码约两个源文件，Apache-2.0 LICENSE/NOTICE/manifest 随构建复制；来源验证命令 `node scripts/xiaozhi-agent/reuse-hana-quality.mjs`。

## 操作验收清单

1. 输入“你好”：正常回复；继续追问可发送，简单任务 wire low/4096。
2. 输入详细推导/教案：wire high/16384，实际模型上限更小则收缩；用例对照条件、步骤、验证与长度。达到输出上限显示截断，不能伪称完整。
3. 调用尚未加载的授权工具：先查目录，下一次真实请求出现对应 schema；工具仍经过原宿主 gate，权限不被目录扩大。
4. 导入合成教材，要求按资料回答：实际本地读回后生成引用；点击正文引用展开来源，打开资料仍校验 resource/version；伪造与旧轮引用不变成有效来源。
5. 受控503首响应：同一轮恢复；在5秒等待期间停止：持久化 interrupted，之后无第二请求。401和部分正文中断不得自动重放。
6. 推理80个增量：终态完整且脱敏一致；工具参数相同但结果变更不提醒重复；撤销技能/记忆立即阻断新送达。
7. 1366×768与1920×1080检查回复、引用、发送和停止；冷重启恢复原回答/来源/中断状态，新增模型请求为0。
8. 真实教学质量：冻结题、原始回答、usage/成本/时间均保存；教师盲评和独立留出集通过后，才能把状态改成“整体质量优于旧版”。

真实模型初步脚本：在 apps/desktop 运行 `node scripts/xiaozhi-agent/answer-quality-live-eval.mjs --allow-paid-model --max-requests=20 --cases=10`，要求环境中有已配置 DEEPSEEK_API_KEY。只用合成输入、隔离数据根，输出 report.json 与 blind-review.json；不能把模型自动打分当教师验收。不读取或自动上传正式用户库。

回滚操作：退出应用，在启动进程设置 `XIAOZHI_ANSWER_QUALITY=legacy` 后重新启动；回退分档、目录、证据注册、重试、推理合并与解析缓存。新增数值审计/可选citation渲染兼容保留；若需完全源码回退，revert本次提交而不回退共享main或删除资料。

## 2026-10-28 本地验收实录

执行目录均为 `apps/desktop`，Windows 本机、Node24.12、当前e147隔离源码/临时资料；没有启动或更新D:日常应用、安装包或正式用户库。所有模型fixture明确标记受控，不作为自然质量证据。

| 命令 | 结果 | 证据与边界 |
|---|---|---|
| npm run build | PASS | quality-build-guard-final.log；生产out指纹 a1ba662fd96b82b00cd93609ce08b086a0b918d138695112a181f850d78248ac；带Hana许可/清单 |
| npm run test:renderer-components | 240/240 PASS | quality-renderer-final.log |
| npm run test:smoke | 207/207 PASS | quality-smoke.log，原有legacy广覆盖；不能代替新Pi路径 |
| node scripts/xiaozhi-agent/answer-quality-boundaries.mjs | 9/9 PASS | Temp/xiaozhi-answer-quality-rhQROL/report.json；实际Pi wire、动态schema、预算、HTTP/取消、引用、推理节拍、指标 |
| node scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs | 22/22 PASS | Temp/xiaozhi-pi-skill-authority-sk2Quv；包含撤销、重启、篡改、脱敏过程变更与500ms巡检 |
| 既有pi-education-boundary-smoke / model-reasoning-boundaries | 8/8、16/16 PASS | quality-boundary-existing.log、quality-reasoning.log |
| 既有snapshot-hydration Electron | 6/6 PASS | test-results/audit-hydration-electron-NY6SXX/report.json；生产Pi恢复、双尺寸、IPC失败、冷恢复0重放 |
| node scripts/xiaozhi-agent/answer-quality-electron.mjs --paths-only | 4/4 PASS | test-results/answer-quality-electron-2qjN35/report.json；实际UI导入→工具实读→引用打开、伪造标记、503重试、等待中停止、冷恢复，0 renderer错误 |
| node scripts/xiaozhi-agent/reuse-hana-quality.mjs | 3文件SHA PASS | 固定上游源/适配后SHA验证；许可随out复制 |
| npm audit --json | FAIL：22项既有风险 | 8 high / 6 moderate / 8 low；无新增依赖或锁文件改动；test-results/answer-quality-audit.json仅本机保留 |
| npm run test:ui-contracts | FAIL：既有来源指纹不符 | prompt-input/index.ts等5文件；原HEAD同样不匹配记录指纹，LF/CRLF也影响字节哈希。本轮未修改这些源或放宽断言 |

失败保留：初始根目录tsc误入口、早期夹具的旧import IPC拒绝、导航名称/隐藏实例、消息容器定位、发送状态未收尾、一次测试窗口关闭，以及真实eval动态import初始化错误（尚未发出模型请求）。相关quality-*.log和test-results失败report保留；改正夹具后复验，不以绕过权限取得通过。

性能已证实的限定结果：同一份合成资料、三轮“你好”的生产wire，旧版工具32个，新版13个；首轮请求90382→49019字节（-45.8%），第二/三轮93717/97052→51491/53963。系统提示旧版13952→14256→14560字符，新版10708稳定。来自PeJtnf报告已完成的6轮，后续引用定位失败不抹去但也不升级为整组通过。该批旧/新首答案耗时未改善（旧17.9–21.0秒、新24.6–25.8秒），因此增加不重叠权限巡检后继续实测，不能拿请求压缩率声称延迟同幅下降。

80个受控推理增量最终脱敏内容一致，旧81次、新25–28次脱敏/发布（Windows计时抖动）；只证明重复处理减少，不报告真实token速度/P95。完整性能/质量验收需前述样本与人工盲评。

真实API授权：用户明确批准本轮最多20次DeepSeek请求，只发送10道合成题的新旧对照。runner在真正net.fetch前递增并落盘request-ledger，超过上限拒绝；错误/重试也占用名额。未经新授权不运行180次完整矩阵。

## 真实 DeepSeek 初步 A/B（20/20请求，额度已用完）

命令：`node scripts/xiaozhi-agent/answer-quality-live-eval.mjs --allow-paid-model --max-requests=20 --cases=10`。实际模型deepseek-flash；交替旧/新顺序，独立20会话，10题均为自包含合成题。20个HTTP请求、20个succeeded运行、20条独立assistant落账、0重试，未发送正式教师资料。测试构建为上表a1ba662f。

证据根：`C:/Users/ZhouXuan/AppData/Local/Temp/edu-quality-live-Jr9MVP`；以`reconciled-report.json`和`reconciled-blind-review.json`为准。原report/checkpoint两行因新建会话尚未切换就读取旧session而错配，原报告保留；`node scripts/xiaozhi-agent/answer-quality-readback.mjs <该目录>`从只读SQLite用`metadata.agentRunId`一对一关联实际prompt/mode重建，并校验每题各一旧一新、无重复run。修正过程无网络请求。runner现已等待session切换并按run读回，旧报表不用于统计。

| 指标（每组10条，非P95） | 旧版 | 优化初版 | 变化 |
|---|---:|---:|---:|
| preparation中位数 | 1273.63ms | 1221.18ms | -4.1% |
| 运行内首段正文中位数 | 7484.57ms | 5970.07ms | -20.2% |
| 宿主开始到SDK结束中位数 | 11807.01ms | 10537.87ms | -10.7% |
| 保存的过程耗时中位数 | 12445.50ms | 10631.00ms | -14.6% |
| 实际请求体平均字节 | 87226 | 69239.1 | -20.6% |
| 实际请求工具数量 | 27 | 12–14 | 曝光减少 |

这是小样本、一次/题、有序交替但非随机重复实验。网络/provider缓存、不同effort和输出长度均影响耗时；不据此推断所有任务/P95/冷启动或纯代码的因果提速。准备阶段与首正文使用不同起点，不能相加当用户端完整延迟。

### 逐题开发者复核（不是教师盲评）

| 题目 | 对照发现 | 质量结论 |
|---|---|---|
| AQ01 有理数一句话 | 两版定义、分母非0与例子均正确 | 核心满足，未证明新版更正确 |
| AQ02 分配律100字 | 两版数值正确；去空白字符为旧125、新106，均超100 | 严格长度约束OPEN；“字”与公式计数口径须预先统一 |
| AQ03 方程与验证 | 均得x=11、两边16；新版补充另一过程及错算代回 | 核验更丰富，但不能以长当优质 |
| AQ04 两负数和 | 两版主证明正确；旧“较大”与min混用及零条件措辞有误；新版扩展有限多个时应明确至少两个 | 扩展严谨性有风险 |
| AQ05 负数平方 | 两版均算对并区分括号；均引入负边长/方向类比 | 教学解释不严谨，不能验收为高质量 |
| AQ06 等路程均速 | 两版48km/h；新版增加具体数与调和平均交叉核对 | 新版核验完整；仍须评估冗长 |
| AQ07 周长不定面积 | 两版反例成立；新版表格便于比较，但增加未要求扩展 | 核心满足，表达由教师盲评 |
| AQ08 折射区别 | 两版核心条件正确，新版更短；仍有附加描述 | 核心满足，精简程度待评分 |
| AQ09 三角形缺条件 | 两版1<c<7正确；新版结尾把猜5描述为不宜判错 | 新版额外建议违背严格按题意作答，OPEN |
| AQ10 两组数据因果 | 两版均不能证明唯一原因；新版额外给出资料没有的热膨胀量级 | 无依据扩展须独立核验，OPEN |

**工程整合完成不等于整体答案质量验收通过**。本次不能宣称“完全吸收所有优势”或“1+1=3已证明”；独立自然任务、教师盲评、资料型长任务、P95和成本仍待验。

### 真实样本后精修与待办

已在通用回答规则中补充硬长度/格式约束、深入预算用于核对而非扩写、类比适用范围、额外量级须核验、条件不足不把猜测当标准答案。这是错误类别通用修正，没有植入题目答案。最终提示精修版只做本地构建/边界测试；上方20次数据属于精修前a1ba662f构建，**不能声称这些缺陷已被真实复测修复**。

下一验收：①补充上述错误类别的独立自然题并由教师复核；②新的明确额度授权后做精修版A/B；③至少30×3与20自然留出，分任务统计质量/首正文/成本；④通过后才关闭AQ08整体质量状态。没有自动继续付费或扩大到用户私密资料。

最终精修版复验：`npm run build` exit0（quality-build-delivery.log）；`answer-quality-boundaries.mjs`9/9，包括真实Pi的finish_reason=length向宿主传播truncated（Temp/xiaozhi-answer-quality-LFRULF）；`answer-quality-electron.mjs --paths-only`4/4、0页面错误（test-results/answer-quality-electron-d6qWT6）。最终out指纹`8a35deb548362f1383d8bb1a5ca329bbf3eddf286f383aeb34baf744fa2033c6`。推理样本本轮81→29次发布，最终内容相同；早期25–28仅时序抖动，不用固定次数当生产性能保证。vendor质量源以.gitattributes固定LF，避免Windows检出破坏字节SHA。

## 2026-10-29 功能对齐结果与一次集中检查

| 最初方案功能 | 当前结果 |
|---|---|
| 请求策略与分段观测 | 已完成：三档思考/输出、容量约束、截断、实际请求/首正文/落账分段 |
| Hana工具目录与稳定提示 | 已完成：直接复用目录、按需schema、公共/动态上下文分离 |
| Hana会话资源层 | 已完成当前教育适配：原生历史资源独占租约、热复用、字节/作用域失效、4个空闲/2分钟/16MiB及RSS淘汰；技能解析继续复用。每轮AgentSession与权限重新绑定 |
| 证据与逐条引用 | 已完成：资料/题目/网页/附件/工作文件；附件按文字行与已确认OCR修订定位，工作文件按原版本打开；变化明确拒绝 |
| 对话更新隔离 | 已完成：推理33ms合并、正文增长不触发过程全文更新、历史附件/图片回调稳定、非活动答案memo |
| DSH恢复与重复提醒 | 已完成：有界HTTP恢复、停止取消、3/5/8提醒，保留不同结果与合法轮询 |
| 教学偏好/任务/记忆分层 | 已接现有授权偏好、动态任务事实和按需记忆；当前要求优先。原方案的只读子Agent探索为可选项，按授权启用，不属于默认执行路径 |

额外修复真实功能缺口：`usePiAttachments.sendBlocked`此前把`items.length>0`作为禁发条件，导致已有主进程附件提交能力无法从当前输入框使用。已改为仅loading/busy/ocrBusy阻止发送，沿原附件revision/消息绑定/隐私校验提交；真实UI“添加附件→发送→读取第2行→点击引用”通过。

本轮测试使用合成资料、受控provider传输，无新增真实模型请求。最后源码构建`npm run build` exit0（quality-continuation-build-final.log），out指纹`d72c5fd226d7eeb574e672b788b648b3926d3f382202cc63fcdbd6704f14ebe2`。`npm run test:renderer-components`240/240；`answer-quality-boundaries.mjs`11/11（Temp/xiaozhi-answer-quality-RMV630）；`pi-skill-authority-smoke.mjs`22/22（Temp/xiaozhi-pi-skill-authority-Z7llAZ）；原生`answer-quality-electron.mjs --paths-only`6/6、0页面错误（test-results/answer-quality-electron-nBq3rF）。原生4次运行缓存命中为0/1/1/1；实际SDK测试同时证明跨轮换凭证/工具/事件回调，不沿用旧run闭包。这些是功能证据，没有新宣称冷/热提速比例。

保留首次失败：2xQJai的工作目录误包含测试数据根，现改独立目录；y2M3IP暴露上述附件禁发缺陷，已修复；8XNdXN夹具跨run重复工具callId，现按run生成唯一ID，六项路径完整通过。未删失败报告或绕过同步/权限边界。通用legacy首轮在修复前无终态而中止；最终构建的 `node scripts/electron-smoke.mjs`已自然结束exit0、207/207（quality-continuation-smoke-final.log），不是以前轮结果代替。`npm audit`当前23项（8 high/7 moderate/8 low），依赖和锁文件无新增。UI来源指纹既有失败未改。

实现阶段不扩建盲评工具。当前上述功能清单已对齐，最终自然教学效果/精修版模型复测/性能长样本留作集中评估；原20次真实A/B的错误及预算边界仍保留。回滚继续使用主进程legacy开关；附件禁发修复独立于优化开关，完整源码回退使用本轮提交revert。

主线整合：功能提交`c669803`；已在本分支合入`origin/main 076e0d9`为`c63d398`，保留其试卷保存授权修复及真实四文件证据。14处冲突均是两支在文档顶部追加进度，逐块保留；生产源码自动合并仅更新一段导出提示。整合后再次`npm run build` exit0（quality-integrated-build.log），最终out指纹`55349b7b4d39508464b729340365a0ee990a9db59e15fc07e0737b370a042299`。前述11/22/6/240/207属于功能完成构建d72c5f；本次没有重复整套评测或调用真实模型。D:日常目录与其它工作树未更新。

## 2026-10-29 实际窗口过程记录失败修复

截图对应D:日常08e26bc构建，正式SQLite三轮均在工具开始前失败；最新291条累计推理约1.09秒生成、约19秒落账，工具回执0。证据支持推理积压路径，原始异常日志未捕获，不能断言唯一根因。当前版本已有33ms推理合并，本片再让streaming reasoning与正文共享16ms落盘批次，生命周期/工具/终态仍立即flush，保序不丢事件、不放宽权限或超时。实际300段SQLite专项保留302条事件、≤4批推理写入并可继续工具准入，20/20通过（pi-event-journal-eI9ERJ）。原失败记录不删除、不自动重放；本轮无真实模型请求。回滚为revert本片或恢复日常目录备份ref；不回退用户数据。

修复续接结果：e147与D:源码均build exit0，240组件及20事件边界通过；推理burst原生专项前三项（资料、工作文件、附件引用）通过，随后发送被同步保护禁用，整套6项未通过，失败DL8GkE保留，不声明全修复。D:由08e26bc更新到8448339，原ref backup/daily-before-journal-fix-20261029保留，原生产数据未修改。用户随后明确授权把原问题在原会话真实重发一次，已发送run_9f6fc23e-987e-4581-a0d3-19086cc79989；当前已成功执行两次find_education_tools，仍在观察，不自动重复发。该单次复原授权不重启20次A/B配额。audit23项既有风险。

单次真实复原终态：run_9f6fc23e-987e-4581-a0d3-19086cc79989为succeeded，421条公共事件正常保存，3次find_education_tools均成功，无event_persistence。模型没有执行education_search_questions或education_read_question，最终称无题源并输出未执行的ask_teacher样式文本；没有生成PPT。正式库有20条题记录，尚未证明其课堂可用资格，不能把模型说法当题库为空。此问题保留为后续工具发现/题库可用性对齐缺口；不自动追加真实请求。

## 2026-10-29 流式卡顿与窗口拖动修复合同

本轮目标：生成中输入/滚动/停止保持响应，标题栏空白可原生拖动，最大化可还原。确认缺口：标题栏controls no-drag撑满可用宽度；OfficeMarkdown每个增量重建components且默认blurIn。修改chrome CSS/标题栏空白区、Markdown稳定配置/关闭模糊动画、推理100ms节拍。无表/IPC迁移，不改授权、正文内容或停止语义；保留原生caption按钮与窗口位置持久化。以同一合成流对照旧/新构建、实际输入延迟/长任务/正文一致性及原生拖动检查一次，不调用真实模型。回滚revert本轮提交；D:运行根同步前保留ref并正常退出。

专项结果：`npm run build` exit0（stream-window-build.log），`npm run test:renderer-components` 240/240（stream-window-components.log），`node scripts/xiaozhi-agent/answer-quality-boundaries.mjs` 11/11。`node scripts/xiaozhi-agent/stream-window-performance.mjs test-results/stream-window-fix/before` 与新版相同命令（省略build参数）分别报告stream-window-l7Tq3I、stream-window-Q74xs5；同50段正文全量完成、生成中8次草稿编辑保留、无pageerror；动画峰值51→6，两版均无>50ms长任务，事件循环最大延迟37.4→29ms，输入到帧最大8.5→6.2ms。Playwright fill往返最大16.49→21.92ms、均值14.19→13.81ms存在噪声，不能宣称整体固定提速或已复现用户严重卡顿。原生空白命中HTCAPTION=2且isMovable，初始指针注入未移动，失败报告保留；脚本现在只读命中，实际移动另用原生窗口操作验证。`npm audit --json` 23项既有（8 high/7 moderate/8 low），无新依赖；git diff --check通过。回滚revert本片，日常根另保留更新前ref。

日常实际交付：D:/WorkProject/EduProject已由8448339更新8ddf549，更新前工作树干净、旧窗口空闲且草稿为空，正常关闭；备份ref `backup/daily-before-stream-window-fix-20261029` 保留8448339。D:原依赖独立 `npm run build --prefix apps/desktop` exit0（daily-stream-window-build.log），renderer index-B-uYNiej SHA256=55a571fdbcd2ad2316af502f6e5a2e1a011b726ec90bf387c4f4ba540697c34c；沿正式OmniEduAgent profile重开，不发送问题、不改业务数据。Computer Use实测标题栏双击最大化成功；从最大化拖动后bounds由(-7,-7,1722×1034,maximized=true)变为(173,0,1380×944,maximized=false)，原生拖动还原有实际位移。普通窗口自动拖动几次未取得位移，不能扩称该自动化路径全通过；初始失效指针证据保留。无新UI回退、IPC或权限更改。最终日常实例通过正常Electron启动，不依赖测试夹具。
