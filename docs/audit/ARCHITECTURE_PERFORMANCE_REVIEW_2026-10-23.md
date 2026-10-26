# 架构减负与交互性能复核

日期：2026-10-23。目标：`D:\WorkProject\EduProject` 当前工作区。

本轮复核 `PI_EDUCATION_AGENT_AUDIT_2026-10-23.md`，不实施应用源码修改、不删除文件、不迁移数据库、不操作远端。结论来自图谱导航和当前源码逐段核对；不是 CPU profile、真实教师性能验收或已完成的性能修复。

## 1. 结论

现有问题需要分成三类处理：运行时重复工作、职责耦合、磁盘/样式遗留。优先级应是运行时重复工作 → 职责分离 → 已证实无生产用途的遗留收口。按文件行数机械拆分，不能保证界面变流畅。

继续采用 Electron + React + Pi 唯一循环 + SQLite 的进程内模块化架构。当前证据不支持再引入框架、事件总线、独立后端或第二调度循环。已有领域 repository、typed preload、journal 和权限接缝足够作为渐进重构起点。

本轮 `git status --porcelain` 共 562 项：67 个未暂存修改、155 个未跟踪、204 个新增暂存、20 个新增后修改、70 个修改暂存、46 个双层修改。此数字是本轮文档写入前快照。重构前必须保存目标文件的工作区内容及 staged/unstaged diff；不能用 reset/checkout 覆盖当前基线。

## 2. 当前代码证据

行数统计范围为 `apps/desktop/src` 的 ts/tsx/css，排除 vendor 与 heroui-pro；行数不是复杂度或耗时。

| 文件 | 行数 | 问题与处置 |
|---|---:|---|
| `main/db.ts` | 7498 | 广泛业务事实、迁移、查询与文件逻辑集中；沿现有 repository 逐域抽取，保留 OmniEduStore 兼容 facade 和原事务连接 |
| `renderer/styles.css` | 3093 | 全局样式与历史页面样式混合；按作用域迁移，单独做视觉验收 |
| `renderer/App.tsx` | 2852 | 生产外壳、旧界面、启动数据、副作用集中；优先分开生产与 legacy-test 生命周期 |
| `main/ai-harness/tool-registry.ts` | 2576 | schema、路由、executor 混合；先查真实生产引用，收益主要是维护性 |
| `shared/contracts.ts` | 2049 | 跨域类型汇总；按领域拆后保留 re-export，不改 IPC wire shape |
| `main/legacy-ai/test-runtime.ts` | 1784 | 旧验收基础；隔离而非直接删，main 已有按 authority 动态导入 |
| `main/xiaozhi-agent/production-host.ts` | 1223 | 组装、快照、生命周期、审批和设置集中，优先分离读取模型 |
| `main/xiaozhi-agent/pi-session.ts` | 1015 | 能力身份、工具、流式、压缩与 SDK 生命周期集中；fingerprint 和顺序优先于缩短文件 |

### P1：主进程技能检查存在高频同步文件工作

`pi-session.ts:678-709`：checkMemory 先调用 skills.check；运行期间每 500ms 再触发一次。另有模型/工具交付与压缩边界检查。

`managed-skill-runtime.ts:16-45,66-84`：checkFiles → capture → checkFiles；capture 前后各读一次 source.resources。`managed-skills.ts:134-143,261-268` 的 verify 对每个启用技能读取包、哈希、调用 native loader，再重读核对。checkFiles 自身也有同步 read/stat/hash。

这不是一次廉价 revision 查询。500ms 轮询加边界检查会重复执行这套工作，且部分操作直接占用 main 事件循环。确切占比需测量技能数、文件数、单次耗时和 main event-loop delay。

建议：先统计调用次数/持续时间；将“展示元数据”“权限版本”“磁盘内容完整性”分开。UI 不应为展示标题而验证整包。执行前严格校验保留，定时校验可合并在途请求；最终间隔须由外部篡改发现时限和实测决定。不能只将定时器改为 5s 就宣称安全和性能均已验收。

### P1：流式持久化不断重建完整 turn

`events/publisher.ts:18-24` 将 text_delta 在 16ms 时间窗聚批；不是固定每 16ms 必写，也不是每个 token 单独事务。非文本事件立即 drain。

`events/journal.ts:63-82`：每批从 turn_json 解析完整 turn，逐事件应用，逐条写 journal/outbox，再把完整 turn 序列化 UPDATE。随着单轮正文增长，累计解析/序列化成本会增长。`serialized-state-sql.ts:6-18` 让这些写入与其他小智状态写共享串行队列，可能使审批/状态更新等待；目前没有实测队列延迟，不能把它定为已证明的卡顿根因。

建议：先测 batch 大小、事务数、排队时间、turn_json 字节数。第一片仅评估文本批次合并，保留事件原顺序、序号和 commit-before-emit。停止、工具效果、审批、任务 checkpoint 和终态继续即时 flush。减少 turn checkpoint 频率需要新的恢复合同，不能顺手改。

### P1：流式 UI 更新触及整个已加载会话

`PiEducationWorkspace.tsx:168-196`：每条已接收事件更新工作区 snapshot、复制 turns 数组、寻找 run、应用事件；状态事件又触发列表刷新，终态 hydrate。

`OfficeConversation.tsx:91-112`：遍历全部已加载 turns，重新计算 interactionLayout、groupOfficeProcess、图片回执并构造 Markdown 元素。尚未建立稳定的逐轮 memo 边界。React/StreamMarkdown 内部可能进一步跳过工作，因此“每个历史 Markdown 都实际重解析”尚未证实。

当前已有每页40轮的历史读取，不能将此项目描述为完全没有分页。但加载更多历史后，renderer 仍保留并遍历已加载轮次，分页不等于窗口化渲染。

建议顺序：稳定逐轮 props/回调 → 已完成 turn 的 memo 隔离 → 仅当前 run 高频订阅 → 性能仍不足再评估虚拟列表。纯文本可按帧合并呈现，receiver 仍逐序校验；不延迟终态、审批、同步 gate 和 Stop。虚拟化必须保住滚动锚点、文本选区、键盘焦点、工具展开和历史插页，不宜第一刀引入。

### P1：生产 App 仍运行历史启动流程

`App.tsx:383-399` 探测 runtime；但 `:640-660,687-689` 的 bootstrap 是独立无条件 effect，会依次读取知识概览、DeepSeek 配置、旧会话、旧确认和待输入。生产分支的 early return 位于 `:2805` 之后，不会阻止前面的 hooks/effect 执行。Pi workspace 还维护自己的会话加载。

这说明“旧页面没显示”不等于其启动工作没有执行。不是所有 bootstrap 内容都可删除：产品页确实共享学生等事实，须先标记各字段消费者。

建议先冻结最小生产 bootstrap，再拆 ProductApp 与 LegacyTestApp；共享学生/资料功能移到领域组件。旧入口通过明确 authority 懒加载，不能仅换文件名后仍由生产静态 import 整棵树。

现有 out 目录的主 renderer JS 为 6,943,257 bytes，另有 921,366 bytes 的主题命名 JS、879,742 bytes 的对应 CSS。这是已有构建产物的磁盘尺寸，未重新 build、未分析 bundle 归因，也不等于首屏全部下载/执行或可直接减少的体积。需要新构建和依赖分析确认。

### P2：一个完整快照承担多种读取职责

`production-host.ts:356-461`：snapshot 先恢复模型/任务，再读历史、学生、能力、多个 review、审批、产物、控制、预算、浏览器、usage、memory 和 skills，最后 flush journal 与合并 durable/current。

`historyPage` 仍通过 snapshot 组装历史页；`previewBrowserCapture:1174-1185` 只需一个 capture，却读取完整快照。学生绑定还先 listStudents 再 find。部分辅助列表按 session 读取，未与当前40轮页同步收窄。

建议：拆 session view、history page、capture lookup 的读取服务；capture lookup 必须继续核 session/已提交 run/capture 身份、文件 hash 与读取前后权限。不能用缓存或裸文件路径绕过公开投影来源。

不能简单把所有 await 改成 Promise.all：当前 flush、settlementRead、owner/generation 与 current 合并顺序有一致性意义。名称叫 snapshot 也不代表它纯读，现代码包含 recoverModel、tasks.recover 和 publisher.flush。

## 3. 对原审计报告的修正

| 原建议 | 本轮判断 |
|---|---|
| 按 catalog.revision 缓存 publicSkills，声称任何文件变化都会递增 revision | 只覆盖应用内 catalog 提交，外部磁盘修改不自动提交 revision。可缓存展示元数据，但执行/预览完整性检查必须独立；故障结果不能永久缓存 |
| 500ms 改为5s是安全低风险改动 | 可作候选实验，会改变运行期撤权/文件变化发现延迟；同时保留交付边界检查并验证发现时限，不能先定安全结论 |
| 只保留最近50轮 journal/outbox，在 begin 后后台 prune | 当前 events.list(:166-174) 不支持“历史已压缩”标记，cursor 仍可能很大但 events 为空。应先设计快照重置/保留水位和 receiver 恢复，再评估维护时机。未经数据保留批准不删除 |
| H6 close 清空几个 Map 可显著减轻长期资源占用 | close 后清空主要是生命周期卫生，不证明运行期间内存泄漏；应测会话结束后的 Map/host 引用是否被释放 |
| 先给 reading/learning/question/math 各设一个 warm worker | 先量化各 worker 启动耗时与请求频率；常驻多个 Python 进程也会增加空闲内存。需空闲回收、取消、崩溃恢复和 requestId 隔离合同 |
| 统一 HostContext / PiRunState 后按文件行区间拆 | 巨型 context 会把闭包耦合搬到跨文件。各服务只传最小能力接口，运行 owner 状态只保留一份；原报告部分行区间重叠，不可按区间机械剪切 |
| CSS :not([data-slot]) 能放行所有第三方组件 | 仅保护带该属性的节点；第三方组件及其内层原生节点不一定有。更稳妥是 legacy 容器作用域/明确 CSS layer，经 Portal 与浅暗色验证 |
| 重构 tool-registry 最优先 | 维护收益明确，但生产性能收益未证明；优先生产 App/流式/UI/snapshot。不要因 legacy 命名或低图谱入度就删除代码 |

Orca 插件、用户级技能配置和跨项目修改不属于本轮 EduProject 性能优化范围。原报告中的历史测试数不能用作本轮源码/构建验收。

## 4. 目标边界

```text
renderer
  ProductApp：导航与最小启动
  Conversation：receiver/同步状态 + 按轮呈现 + composer
  Materials / Students / Artifacts：领域页面与局部数据
          ↓ typed preload（协议保持）
main
  ProductionHost：只负责组装与生命周期
  SessionQueries：session/history/capture 读取与投影
  PiRuntime：唯一 AgentSession、工具交付与取消
  Authority：权限/版本/教师批准，执行前独立校验
  Journal：持久事件、outbox、恢复
  DomainRepositories：复用现有 SQLite 连接/事务
          ↓ 按需、有界 worker
SQLite 业务事实 + 本地文件产物
```

这是职责目标，不是要求新增上述所有抽象。优先复用现有模块；未用到的接口不提前建设。稳定文件路径/导出使用薄适配，不生成另一份业务状态。

## 5. 执行顺序与可核验合同

### R0：性能基线（M12，支撑三条教师主线）

- 教师结果：可区分启动、流式、切会话、长历史、OCR/worker 等待造成的不流畅。
- 当前缺口：功能测试较多，尚无本轮同构建 main/renderer 性能采样。
- 变更范围：owned profile 性能脚本/有界计时，禁止记录正文、图片或密钥；不改表、业务文件根、IPC 业务语义、provider。
- 场景：冷启/热切换；40/200/1000轮；长 Markdown；运行中审批/Stop；三条教师路径；1366×768 和1920×1080。
- 记录：构建hash、机器与数据规模、样本数、p50/p95、main event-loop delay、renderer long tasks、commit 次数、事务排队、snapshot SQL 数、技能检查次数/耗时、RSS/DOM 数。每场景至少5次，p95在小样本下仅作观察，正式阈值用更多样本确认。
- 验收：同构建可重复基线；无真实用户数据写入、无 provider 自动重放。先记录事实，不设未经测量的性能承诺。

### R1：热路径减负（M10/M12）

- 教师结果：长回复时输入、滚动与 Stop 仍可响应。
- 顺序：技能展示与完整性检查分离/合并重复检查；逐轮 UI 隔离；文本批次实验。各自独立 diff 和验证，不捆绑交付。
- 可能涉及：managed-skills/runtime、pi-session、OfficeConversation/独立 turn、PiEducationWorkspace、publisher 与专项脚本；共享事件 schema/序号不变，不迁移数据库。
- 回滚：仅恢复本片保存的文件内容；隔离构建目录验证后才替换日常 out；试验参数撤回不改已提交记录。
- 完成定义：同一 owned 数据前后对比重复工作/延迟确有下降，短会话无明显回退；权限篡改/撤回、审批、取消、journal gap、终态、SQLite readback 和冷启通过。
- 不做：日志删除、进程池、fingerprint 表驱动、全站换肤。

### R2：收窄读取与启动（M01/M10/M12）

- 教师结果：打开/切换会话与查看截图只读取所需内容。
- 先列 bootstrap 消费者和快照读取依赖，再拆最小接口；历史页不能附带所有设置/review/技能正文。
- 对外 typed preload 尽可能兼容；若确需新契约，先定义版本/失败状态再实现 main→preload→renderer→专项/Electron。
- 不改 SQLite 真源/表结构；单学生与分页 repo 查询保留旧调用适配。
- 完成定义：启动重复会话读取减少；历史补页与 capture 权限/来源核对通过；终态快照不倒退；1000轮完整加载、切换、二次冷启通过。

### R3：按职责拆长文件（M01及实际受影响领域）

- 顺序：App 生产/legacy 生命周期 → host queries → db 中实际触及的单一领域 → contracts 领域化 → registry schema/executor。高风险 Pi identity 最后处理。
- 数据层保持 facade 与同连接事务，不新增独立数据库或并行业务真源；迁移函数仅搬移时 SQL 不改。
- 迁移签名、公开导出、错误码、fingerprint/entry order 在拆分前冻结；对并发/取消等真实行为做特征验证，不用测试重复实现。
- 完成定义：每片只移动一个职责，引用无循环增生、依赖最小化、原功能与恢复通过；拆分本身不声明性能收益。

### R4：有证据地收口遗留

按生产依赖、动态 import、脚本引用、许可证/hash 和恢复用途分类。无生产引用也可能仍是回归基线。先退出生产加载，再处理归档；OCR dist 与 journal 保留属于独立清理/数据策略，不在性能片中删除。

## 6. 验收门禁与本轮验证

实施桌面代码后的最低命令仍为：

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm.cmd run build
npm.cmd run test:renderer-components
node scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs
# 按改动运行 memory epoch、skill authority、journal、long-history 专项
# 改变关键用户路径时再运行 test:smoke 及三条教师路径回归
cd D:\WorkProject\EduProject
git diff --check
```

权限发现时限、长历史滚动、选区/展开/焦点、Stop、审批、断流、持久化失败、重启恢复均不能由 build 代替。性能通过需要同机器、同构建口径、同数据、同 provider 条件的前后记录；模型首 token 等待与本地卡顿分开计量。

本轮实际执行：源码统计、图谱查询/调用关系、fast 图谱刷新、逐段源码核对。图谱辅助定位但部分行号漂移，以当前源码为准，属于部分图谱支持的审查。

`apps/desktop/node_modules/.bin/tsc.cmd --noEmit` exit0；仓库 `git diff --check` exit0（存在原有LF/CRLF转换提示）。未运行 build、组件套件、Electron/profile、真实provider或教师路径，不沿用原报告通过数，也不据此证明性能改进。未删除业务记录。
