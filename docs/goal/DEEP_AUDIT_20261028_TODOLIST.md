# 2026-10-28 深度审计逐项修复清单

目标：完整处理用户指定DOCX的F01–F26；不能以旧报告或已有工作缩小完成定义。
来源：`D:/Edge_down/EduDev_代码深度审计与性能优化报告_2026-10-28.docx`，SHA256 `aa3ff3f4f5d130ba2e21153f6fd9762d50b413cd840a4aec40080cabbd1fecd9`；正文/11表/285块转录见 `../audit/DEEP_AUDIT_SOURCE_2026-10-28.md`。原文基线master/d3e2dec，当前修复起点main/3734df3。静态风险及建议阈值不是已复现或已验收事实。

## 执行合同

- 用户授权本轮逐项建分支、提交并合入main；`mian`按实际main处理。fetch后读到最新AGENTS/Master/1.Agent的2026-10-28持续正常push授权，按此提交、刷新整合并正常推送origin/main；不强推、不删除分支、不发布安装包、不上传教师资料或派付费provider任务。CLAUDE.md不新增外部动作授权。
- 一个问题一个分支，依赖项先行；每项必须有修前/当前证据、窄合同、实现、专项+真实Electron、Terra独立审核及实际操作、main合并提交、合并后启动/冷恢复证据，然后新建下一分支。报告已过期的描述也要以当前回归和量化证据闭合，不能仅标“已有实现”。
- 专职审核Agent `/root/terra_reviewer`：GPT-6.1 Terra/high，用户明确指定；根Agent实施，审核Agent独立接受/退回，不承担自审实现。审核结果逐项留档。
- 修复工作树 `C:/Users/ZhouXuan/.codex/worktrees/architecture-repairs/EduProject`，从main新建。D:当前codex/xiaozhi-composer-template及未提交文件归协作者，禁止切分支、清理/覆盖、整体合并或用其旧out冒充新main。main当前在32aa干净工作树，合并前重新核对HEAD/dirty/占用，保留其新增提交。受控主线启动使用明确main源码/独立数据profile，D:正式运行同步需有可验证所有权再执行，不能偷换分支。
- 新树desktop/node_modules只读Junction到D:现有依赖；已逐项核对dependencies/devDependencies/overrides相同。不得通过此Junction安装、删包或改共享node_modules。构建out/测试数据/trace只写本树；依赖实际版本和锁文件hash前后记录。若需改依赖，改用独立安装。
- Pi唯一循环、SQLite事实、来源/学生/版本绑定、权限撤销/教师确认、commit-before-emit、连续事件序列、Stop/取消/终态、旧入口及旧数据恢复均保留。性能优化不能关安全检查、丢Token、删日志/真实数据或伪造教师确认。

## 全量问题与验收

状态只用OPEN / MEASURING / FIXING / REVIEW / MERGED_STARTUP_PENDING / VERIFIED。表内初查不是完成证据；“下一实施”均是待Profile验证的候选方向，不是无条件指定实现。统计阈值是待校准候选，不能为通过而放宽。WP0采集检查点不是F24完成，后续需补稳定性/完整矩阵与CI。

| ID | 级别 | 报告问题 / 当前初查 | 下一实施/验证边界 | 完成所需证据 | 状态 |
|---|---|---|---|---|---|
| F24 | P1 | 缺量化性能门禁；已有ux00与长历史脚本，但不完整 | WP0先建固定10/100/1000轮、delta/code/scroll/hidden/Skill/SQL/冷启矩阵；明确采不到的指标 | 同硬件/构建口径每场景≥5次，原始samples+p50/p95、Chromium/React/main/资源四类证据；回退负例能使门禁失败 | MEASURING |
| F01 | P0 | 原逐事件setSnapshot；1489检查点已加有界视图缓冲，性能与扩展流控未验收 | UI有界按session/run/segment相邻文本合并，非文本立即flush | 10/50/200 delta/s，完整字节/顺序/末帧；commit下降、Stop/审批/隐藏/切会话 | MEASURING |
| F02 | P0 | 主/渲染共享投影多层复制 | 保留权威投影与序列，只减少实际被profile证明的复制 | 1/20/100消息段同delta，计算/分配曲线，来源/恢复不倒退 | OPEN |
| F03 | P0 | 500ms严格校验已有在途去重，仍同步重IO | 分开展示/权限/完整性；实测后Worker/去重，不仅改轮询间隔 | 5/20 Skill，check p50/p95/main eventloop，磁盘篡改/撤销及时拒绝、交付TOCTOU | OPEN |
| F04 | P0 | Shiki effect存在；实际流围栏触发次数待证 | 流式原文/完成后高亮与有界缓存，保留原厂设计 | 1000/5000/20000字代码，真实高亮次数/LongTask/可复制/终态 | OPEN |
| F05 | P1 | 已加载turn仍全map/group，无稳定逐轮memo | 保持历史引用/回调稳定，单turn memo；先不引虚拟列表 | 10/100/500轮当前更新时历史render近0，选区/展开/焦点/插页 | OPEN |
| F06 | P1 | 阅读锚点逐块测量 | rAF测量合并/可见集合，不改教师阅读语义 | Layout/Scripting/掉帧，向上阅读/最新/键盘/缩放/面板重排 | OPEN |
| F07 | P1 | hidden保活仍接事件 | 执行和序列持续，减少隐藏UI更新，返回有序追赶 | 真实运行切资料，隐藏commit下降、返回完整、审批/终态安全 | OPEN |
| F08 | P1 | 历史附件flatMap+JSON键 | 独立稳定附件selector/版本，不随纯delta扫描 | 无/多附件历史下扫描与缩略图次数，冷恢复来源/授权 | OPEN |
| F09 | P1 | 按每turn筛多个审批/产物集合 | 同run索引+稳定卡片，不改变确认归属 | 100轮/100审批，过滤次数/Profiler，过期/跨run卡拒绝 | OPEN |
| F10 | P1 | 报告无分页陈旧：主线已40轮游标，但全量API保留 | 查全部生产调用者与真正有界默认页，复用分页 | 10/100/1000轮，默认读行数/字节/内存不随全历史线性增，向上全加载无漏重、重启 | OPEN |
| F11 | P1 | append后全量detail仍存在 | 按消费者拆write receipt，旧IPC兼容 | 1000轮写入读行/耗时、计数持久性、并发/旧调用回归 | OPEN |
| F12 | P1 | snapshot恢复/flush/多仓库读取耦合 | 轻聊天/历史/capture/侧栏最小查询；不盲并行 | 分仓时长/SQL数/整包大小；权限/hash/来源、settlement/owner/generation一致 | OPEN |
| F13 | P1 | send/status/terminal多次hydrate/list | per-session single-flight/版本及取消，按域刷新 | 每次正常发送、停止、失败的IPC计数和最终状态；切会话晚响应 | OPEN |
| F14 | P1 | updater恢复副作用及缺快照竞态已修 | 同scope单在途、fresh/version/token、有界失败重试 | helper11/StrictMode12/真实Pi6及冷启；独立通过；main34aae9f及合并后6项 | VERIFIED |
| F15 | P1 | 当前receiver已具备恢复，补齐真实故障实证 | 复用现receiver；无生产重写 | 实际drop10/duplicate9&11/补读拒绝/无后继丢终态/cold；独立及main2c25e36后6项通过 | VERIFIED |
| F16 | P1 | 65536同时影响流和最终返回，已有truncated | 先核最终事实/文件上限再修可见提示与长产物路径 | >65536运行/终态/持久化/重启，明确完整与截断；不承诺不存在的全文 | OPEN |
| F17 | P1 | /models10s预算/缓存条件仍需测 | 正确缓存/取消/准备阶段可观察，不编能力 | 冷/热/过期/超时TTFT分阶段、错误/Stop、无伪模态 | OPEN |
| F18 | P1 | 已限legacy设置/外层会话/待输入；共享知识/确认有生产消费者 | 全消费者+按路由初始化测量，保留共享事实 | 冷启瀑布/TTI、IPC计数、学习概览非零/学生/录入/旧入口/重启 | OPEN |
| F19 | P2 | App静态多视图/包大 | bundle/parse后route lazy，typed业务原入口兼容 | chunk归因、冷启TTI前后、无重复依赖/白屏/不可达错误态 | OPEN |
| F20 | P2 | 指定glass文件已消失，真实样式待核 | 实际computed style/Layers/固定输入对比；不凭旧文件删CSS | 双尺寸/GPU合成/帧率与当前视觉合同；已无问题也需现实证据 | OPEN |
| F21 | P2 | 教育worker按任务spawn | 先量10次轻任务与频率；确有收益再有界复用 | 冷/热延迟、版本/request隔离、超时/取消/崩溃/idle回收/Windows | OPEN |
| F22 | P2 | 多repository事务开连接，未证死锁 | 连接/事务量化与writer隔离，旧库兼容 | 并发题库/组卷/索引busy/事务p95、原子性/取消/冷恢复 | OPEN |
| F23 | P2 | Provider内仍创建完整fallback hooks | Provider-only与独立fallback拆hook边界，不条件调用hook | 真组件Profiler/hooks分配与独立/Provider/切换行为 | OPEN |
| F25 | P2 | IPC sender/frame模式不一，非已证漏洞 | 清单敏感通道，统一admission并保合法窗口 | 非主window/子frame/导航/无效schema负例，全部IPC合同与合法UI | OPEN |
| F26 | P2 | 大db/App双代实现回归成本 | 逐责任纵切、保同连接facade/re-export/legacy；不机械拆行 | 依赖清单、旧库迁移/备份恢复、核心业务E2E/IPC/冷启；无循环增生 | OPEN |

## 顺序、门禁和记录

WP0/F24基线→F14/15正确性→F01/02/04/05流热路径→F03主进程→F06/07/08/09→F10/11/12/13→F16/17/18/19→F20/21/22/23/25/26（依赖关系需要调整时记录理由；保持逐项分支串行落主线）。P0测量在WP0内先行，不能因安全问题难测而跳过。

每项固定最少：build/typecheck、renderer-components、对应契约/安全/领域专项、真实Electron与必要关键smoke、git diff --check，提交前npm audit（记录而非自动破坏性升级）。审核Agent独立代码与实际操作给出通过/退回，主线HEAD变化后重新集成验证。报告§7所有场景/四类证据与§6队列/序列/flush合同逐项关联，不以mock-only、历史不同bundle或少量fixture替代完整验收。

记录字段：ID/分支/base SHA/改动文件/旧数据恢复与回滚/修前样本/修后样本/构建与脚本hash/命令exit与通过失败skipped/审核意见/merge SHA/主线启动与冷恢复证据/未验边界。任何字段缺失不标VERIFIED。所有26项均VERIFIED、矩阵门禁和最终独立审核完成前，线程Goal保持active。

## 当前切片 F24/WP0 冻结合同

分支codex/audit-20261028-f24-baseline，base3734df3。本片先建立可复用计量/原始样本/回退检测；只写测试脚本和文档，若需profiling专用构建插件，必须显式opt-in且不改变日常产物/协议/数据。优先复用当前长历史/receiver/生产UI fixture。profile/data/trace在本工作树test-results，禁止读教师正式库或凭证。模型/网络以受控响应计量并标非provider。

进行中：全文转录和独立26项初查已完成；新树已索引；依赖清单一致后复用只读Junction；当前build启动待最终exit。一次相对工作目录误写了嵌套空test-results目录、日志路径不存在，命令未执行build；已按正确desktop/test-results重试，不冒充源码失败。

2026-10-28当前：fetch发现远端新增16个提交，修复分支从3734df3无冲突快进origin/main/d710541；新基线build/typecheck与240组件已通过。WP0形成有限历史采集检查点，6组×5样本/6 trace；独立同构建比较7/18候选阈值失败，故F24保持MEASURING，不设CI硬门禁。详见DEEP_AUDIT_20261028_EVIDENCE.md。先集成此检查点并检查主线启动，再新分支针对F14做缺快照/StrictMode/切换恢复修复；其前后样本不可混用不同product build或调整探针版本。

## F14 冻结窄合同

分支codex/audit-20261028-f14-pure-recovery，base e7ee92e（WP0已推main并通过配置原生窗口探针）。M10/M12教师结果：事件先于首快照或快速切会话时，最终能看到完整当前会话，失败保持禁写并可重试，旧请求不得覆盖或解锁新会话。

现码PiEducationWorkspace.applyEvent在React updater内调用hydrate，StrictMode可重复副作用；每事件version++让并发快照失效，最后事件可能只推进游标却没有快照。复用现typed snapshot/settings和createEventReceiver，不更改SQLite/IPC/schema/生产Pi/序列/权限/旧入口。只在该组件的恢复生命周期加同scope单在途、事件版本栅栏和失效后的有界重读，updater保持纯函数；scope在open与卸载失效，旧finally不得清新锁。失败catch显示重试并fail-closed；不无限自动重试，持续冲突允许显式刷新。

验收先行：真实React StrictMode组件受控snapshot/settings分别延迟、突发和跨一次读取的事件、拒绝与教师重试、A→B→A、卸载重挂；请求并发同scope峰值1、最后文本/终态完整、mutation不可提前放行、0 unhandled。真实Electron通过当前生产页/typed IPC/隔离SQLite与本地受控响应验证事件提前、切换/冷启，双尺寸。前后比较恢复读取次数/峰值/完整性，原始计时只作观察，F24预算仍未校准。build/typecheck、240组件、receiver专项、关键smoke、Terra独立实际操作、diffcheck/audit与主线启动后才标VERIFIED。回滚仅本片组件/恢复helper与测试，数据库无需迁移；F01批流/其他页面/全局hydration性能重构不属本片。

## F15 冻结窄合同

分支codex/audit-20261028-f15-event-recovery；base3ecc2af。M10/M12老师结果：真实本轮过程通知丢失/重复后仍看到完整回复与正确终态；已知缺口期间草稿保留，确认/新写入阻断，补读失败后可显式恢复，冷重启无重放。现createEventReceiver已经实现generation、连续cursor、分页pull、失败态、reset和尾poll；旧DOCX的无恢复描述不能直接作为源码缺陷。先复用并测试，若事实证明有缺口只修该边界。

只扩展现audit真实Pi受控catalogue/SSE测试设施以复用同一生产main/preload/journal：实际第10通知丢弃、第9/11重复，修复页由原IPC实读后持有/拒绝，不直接写入/伪造journal或模型业务成果。实际SQLite/完整字节/顺序/丢终态无后继/冷重启；已有receiver10/journal19及F14 StrictMode12覆盖非法/外代/旧请求。每项区分真实传输故障与受控负例，记录补读次数/每run单在途，F24稳定时延仍未校准。无新表/协议/循环/包/页面，保留权限与旧入口。生产无改动时不为形式重复重建out或改源码；复用同冻结d457f435构建/240/207门禁，重跑受影响测试、Terra独立实际操作、主线集成与启动后才关闭F15。回滚限本片测试/文档，完整Goal继续active。

## F01 冻结窄合同（先测后改）

分支codex/audit-20261028-f01-stream-batching，base cc2e68ae1d17b0cec03a59a72183881fd4dceba8。M10/M12教师结果：高频输出完整且更平稳，首段/审批/停止/终态立即可见，切换/恢复不重复或丢尾。现main已有16ms落库/通知批次，renderer仍逐条setSnapshot；只测并优化renderer公开投影，不改commit-before-emit/journal/receiver序列或共享IPC。

编码前先用同一真实React Profiler组件场景采10/50/200 delta/s、双尺寸各≥5个原始样本，保存commit/actualDuration/首字/终态及文本/游标；实际Pi用既有受控SSE/SQLite及F14/F15重验。只有Profile支持收益再写有界视图缓冲helper，局限PiEducationWorkspace与测试。候选32ms节奏、每段首delta立即、最多128条或65536字符；只同session/run/generation、同segment内相邻text_delta可合并（assistant_start/end等非文本是边界）。保留首条traceSequence锚点与最终sourceSequence，不更改公共事件结构。非文本先flush再立即应用；snapshot publish先清空/flush待合并前缀，禁止快照包含后再次apply导致重复。切会话清旧scope，hide/Stop/终态和卸载有明确flush/cancel，不留定时器/跨代写。

验收：中文/Unicode精确字节、非文本交错、run/segment/代切换、超限、计时末帧、快照恢复覆盖、隐显/重挂、Stop/审批即刻、gap/tail恢复均测。200/s场景commit显著下降，10/s不应人为延迟首字；保留采样原值，不放宽F24候选门禁消除波动。这里只证明限定视图性能和正确性，不同时做F02深复制/F04高亮/F05memo/F07隐藏优化。无表/迁移/依赖/模型或文件权限变更，旧入口保留。build/typecheck、renderer组件、对应helper/实际组件/真实Pi、相关smoke、Terra独立、正常集成及主线启动后才标VERIFIED。回滚本片renderer/helper及测试即可，持久事实不变。

## 2026-10-28 主线统一优先级

用户要求先整合全部分支、清理工作区并从最新页面源码启动，再继续优化。origin/main 已推进fdc8e9c，包含模板输入栏/附件/权限和三栏。F01暂存为未验收检查点：原8dd基线helper37/恢复15/StrictMode31、build及240通过，17/11/9上游边界通过；原生Stop前缀通过，后续因旧导航定位失败而整组不通过；同hash最终性能与最新版UI尚未验收。F01保持MEASURING，不把本次集成当性能交付。完全无重叠历史页失败关闭保留已加载事实，跨40轮跳跃恢复留F10。

## 主线统一后的执行计划与实时口径

任务入口为WORK_PROGRESS.md；每个检查点同步当前分支/base、执行中动作、命令最终exit、通过/失败/skipped、报告路径、下一步与阻塞。单次样本或WIP合入main不增加完成数。

1. I01–I06：全分支包含检查/本机备份/最新UI三方整合/回归与独立操作/正常推main及D同步/实际日常启动；最后才关闭“版本对齐”。
2. 第一批：F01完成最新UI上的同探针前后采样和正式验收，再按分支逐项处理F02复制、F04高亮、F05历史渲染；不并行堆生产修改。
3. 第二批：F03主进程校验与资源，F06阅读锚点、F07隐藏保活、F08附件、F09审批索引。
4. 第三批：F10分页（含已加载页完全无重叠）、F11写后读、F12轻快照、F13刷新去重、F16长输出、F17模型准备。
5. 第四批：F18启动读取、F19路由包、F20真实合成样式、F21 worker、F22 SQLite连接、F23 hooks、F25 IPC一致性、F26逐域拆分。
6. F24贯穿每批：固定硬件/构建/探针/5样本、保留raw/p50/p95与失败；门禁稳定和全部26项完成后才关闭总体审计。

集成附带未解决项：R01 `test:ui-contracts`旧来源指纹与新版prompt-input不匹配，需来源/版本审阅后修复，不能盲改hash；R02 npm audit22项(8high/6moderate/8low)，需独立依赖升级评估；真实Office导出configuration保持原知识库台账。它们不因main统一而隐藏。

R03（F01验收前置）：扩展真实流控HBvBst前4项通过但复制审批60s未就绪；fCy2pz为CDP promise GC；marker复测zuyP4z在第二次发送未进入模型请求而超时，仅前1项通过。保留全部失败，先分辨probe/主进程退出settlement与发送准入，不能删审批断言或宣称F01完成。本轮主线/UI统一不承担修复此额外故障。
