# EduDev 代码深度审计与性能优化报告（来源转录）

来源：D:\Edge_down\EduDev_代码深度审计与性能优化报告_2026-10-28.docx
SHA256：aa3ff3f4f5d130ba2e21153f6fd9762d50b413cd840a4aec40080cabbd1fecd9
原文只读；正文与表格按OOXML顺序提取，修订/建议不代表当前代码事实。

[B001] EDUDEV  /  CODE AUDIT
[B002] EduDev 代码深度审计与性能优化报告
[B003] 以 AI 流式输出卡顿为入口的全链路只读审查

[B004] TABLE
审查对象 | 审查基线
仓库 | ZhouXuan-Yu/EduDev · master
Commit | d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63
提交时间 | 2026-10-12 07:13 UTC
审查日期 | 2026-10-28
技术栈 | Electron · React 19 · TypeScript · Pi Agent · SQLite · Python Worker
审查方式 | 远端源码静态检查 + 关键链路反向追踪 + 已有测试脚本审阅；不写入仓库

[B006] 结论速览  识别 26 项工程风险/优化机会：P0 4 项、P1 15 项、P2 7 项。标注的 P0 为优先排查项，不等于已实测复现。
[B007] 审查限制与可信度说明
[B008] 本报告仅对应上述 GitHub Commit。无法直接访问未推送的本地改动；未在项目本机运行 Electron、完整依赖构建、CPU/Heap Profiler、真实网络模型性能测试，因此所有耗时、内存增长和帧率影响均应通过第 7 章测试证实。
[B010] 01  执行摘要
[B011] 用户反馈的核心症状是“尤其在 AI 持续输出文本时明显卡顿”。静态源码中存在相互叠加的高频更新路径：Pi 输出增量 → 主进程投影 → Electron IPC → React 会话快照 → Markdown/代码块渲染 → 滚动与布局测量。任何单处放大都可能造成明显掉帧。
[B012] 除此前排查的流式渲染外，本轮扩展发现：周期性同步 Skill 校验、长对话无分页、重复快照读取、隐藏页面仍更新、异步恢复反模式、UI 序列缺号未处理、Python 子进程冷启动、部分 IPC 发送者鉴权不一致，以及缺少持续性能门禁。

[B013] TABLE
维度 | 重点结论 | 判断
流式处理 | delta→IPC→setSnapshot 缺少显示层聚合；双进程重复投影 | P0
主进程 | 500ms Skill 完整性检查含同步文件访问/Hash | P0
渲染 | 代码块依赖变化触发 Shiki；全部轮次参与 render | P0/P1
历史数据 | 聊天读全表、提交后再读完整会话、snapshot 多仓库串读 | P1
可靠性 | hydrate 放在 setState updater；序列缺号未显式修复 | P1
测试 | 已有真实 UI 功能测试，但缺定量性能回归预算 | P1

[B015] 建议首期目标  先测量、再小步消除热路径；不改变 Pi Harness、用户数据真源、审批授权与来源追溯协议。
[B016] 02  审查边界与方法
[B017] 代码证据：  GitHub 提交 d3e2decd01fd9898026b0a8c1bfc9b029d1d9b63；树索引 3811 个 tracked 文件条目（含测试、文档、第三方/生成源）。
[B018] 重点阅读：  Pi 会话与宿主、Electron IPC/preload、React 聊天渲染与附件/侧栏、Skill 校验、SQLite 会话数据、Worker、Electron/Vite 构建与既有 E2E。
[B019] 证据层级：  “确认行为”=源码直接证明该操作存在；“高概率风险”=可解释用户症状但未实测；“审查提示”=不满足直接确认条件，需要专门测试。
[B020] 未覆盖：  本地未提交源代码、用户设备 GPU/磁盘与驱动状态、真实生产数据量、实际模型服务速度、实际 SQL 执行计划、依赖 CVE/许可证完整扫描。
[B021] 优先级含义：P0 = 首期必须排查或设计修复的高成本热路径；P1 = 应在短期迭代中处理；P2 = 中期治理或按测量结果处理。所有优化收益在验收前均只是目标。
[B022] 03  热路径架构与可能的叠加放大

[B023] TABLE
① Pi SDK | 直接影响
message_update/text_delta 触发 emit，单轮有可见文本上限 | 高频调用/复杂历史/未隔离组件时成本叠加


[B025] TABLE
② Main / Production Host | 直接影响
publicEvent 调用 applyXiaozhiEvent；run.turn 逐增量复制/更新 | 高频调用/复杂历史/未隔离组件时成本叠加


[B027] TABLE
③ Electron IPC | 直接影响
xiaozhi:event 逐事件推入 Renderer；当前缺少面向显示的背压/聚合 | 高频调用/复杂历史/未隔离组件时成本叠加


[B029] TABLE
④ React State | 直接影响
setSnapshot 内 turns.slice + applyXiaozhiEvent + 整体 snapshot 新对象 | 高频调用/复杂历史/未隔离组件时成本叠加


[B031] TABLE
⑤ Chat View | 直接影响
turns.map、groupOfficeProcess、审批过滤、附件历史映射、Markdown | 高频调用/复杂历史/未隔离组件时成本叠加


[B033] TABLE
⑥ Layout / GPU | 直接影响
滚动锚点测量、ResizeObserver、代码高亮、多层 backdrop-filter | 高频调用/复杂历史/未隔离组件时成本叠加

[B035] 重要区分  React/Streamdown 本身并非“有 bug”的证据；真正要分析的是是否把原本可异步/低频的计算附着到每一个 Token 更新上。
[B036] 04  问题总表（26 项）

[B037] TABLE
编号 | 优先级 | 子系统 | 问题摘要
F01 | P0 | 流式数据链路 | Token 增量逐事件触发 UI 状态更新
F02 | P0 | 流式数据链路 | 同一增量在主、渲染进程重复复制消息数组
F03 | P0 | 主进程与文件系统 | 每 500ms 触发同步 Skill 完整性校验
F04 | P0 | Markdown/代码块 | 流式代码每次变化会重新触发 Shiki 高亮
F05 | P1 | React 渲染 | 聊天列表每次更新都遍历全部轮次及分组
F06 | P1 | 阅读位置与布局 | 滚动事件对大量 DOM 节点逐个测量布局
F07 | P1 | 后台可见性 | 聊天页隐藏后仍处理 Agent 事件
F08 | P1 | 附件与无关计算 | 每次对话更新都重算历史附件与 JSON 键
F09 | P1 | 审批和侧栏 | 渲染审批时按每一轮重复筛选多个全局集合
F10 | P1 | 历史加载 | SQL 读取会话时不限制历史消息数量
F11 | P1 | 数据库读写 | 每次追加消息后再次返回完整会话
F12 | P1 | 快照恢复 | 一次聊天快照包含多项串行数据库/文件读取
F13 | P1 | 请求与状态恢复 | 发送/状态结算触发多次完整刷新
F14 | P1 | 异步正确性 | 在 React setState updater 内发起 hydrate 副作用
F15 | P1 | 事件正确性 | 渲染订阅仅过滤旧序列，未在相邻事件缺号时恢复
F16 | P1 | 超长文本 | 单轮流式展示有 65536 字符的累计截断门槛
F17 | P1 | 响应首字延迟 | 每轮执行前可能查询远端模型能力，最长约 10 秒
F18 | P1 | 启动性能 | Pi 模式仍先执行传统工作台的串行 bootstrap
F19 | P2 | 打包与加载 | 超大 App 与静态视图依赖存在懒加载机会
F20 | P2 | GPU/样式 | 聊天框架多层 backdrop-filter 模糊
F21 | P2 | 侧车任务 | 多个教育 Worker 采用每次调用新建 Python 子进程
F22 | P2 | SQLite 并发 | 多个领域事务为每次事务开启独立连接
F23 | P2 | React Context | 每个 useOfficeComposerState 调用都建立未使用的本地状态
F24 | P1 | 工程质量/测试 | 已有真实 UI 测试，但缺少定量性能门禁
F25 | P2 | IPC 安全与边界 | IPC handler 的发送者鉴权模式未统一
F26 | P2 | 工程维护性 | 超大业务底座与双代际实现提高回归成本

[B039] 05  逐项技术审查证据与修复要求
[B040] F01  Token 增量逐事件触发 UI 状态更新
[B041] P0   /   流式数据链路   /   确认行为/影响待测
[B042] 源码依据：apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx  (L117–L142)
[B043] 确认行为  Pi 订阅器对每个 text_delta 发出事件；IPC 即时转发；渲染器收到事件后调用 setSnapshot，未见前端批处理。
[B044] 潜在后果  在高频输出下产生密集 IPC/React 调度；消息和 UI 复杂度越高越容易掉帧。
[B045] 修复建议  在 UI 投影层建立按 runId/segment 的有界增量缓冲，按 32–50ms 或每帧刷新，工具/审批/终止事件立即 flush；保持序列和丢包补偿。
[B046] 专项验收  模拟 10/50/200 delta·s⁻¹：文本完整、最后一帧不丢失、UI commit 次数显著下降。
[B047] F02  同一增量在主、渲染进程重复复制消息数组
[B048] P0   /   流式数据链路   /   确认行为/规模影响待测
[B049] 源码依据：apps/desktop/src/shared/xiaozhi-projection.ts  (L31–L47)
[B050] 确认行为  主进程 publicEvent 使用 applyXiaozhiEvent 重建 items；渲染器处理同一事件又调用同函数；该函数按次复制每个 item。
[B051] 潜在后果  每个 Token 的成本随当前工具/片段数增加；连续拼接文本还可能累积为超线性开销。
[B052] 修复建议  主进程保留权威投影，渲染层把热路径压缩为单消息增量更新；使用不可变分段状态并避免全 items.map 克隆。
[B053] 专项验收  用 1、20、100 段消息进行相同增量压力测试，确认每次计算量不随历史片段线性放大。
[B054] F03  每 500ms 触发同步 Skill 完整性校验
[B055] P0   /   主进程与文件系统   /   确认行为/影响待测
[B056] 源码依据：apps/desktop/src/main/xiaozhi-agent/pi-session.ts  (L554–L585)
[B057] 确认行为  运行中的定时器每 500ms 执行 checkMemory；管理型 Skill check 包含同步目录遍历、readPackage、文件哈希和多轮 verify。
[B058] 潜在后果  主进程事件循环可能被本地磁盘 I/O 阻塞，影响模型流和 Electron IPC；Skill 越多越明显。
[B059] 修复建议  保留执行前/工具授权前的严格检查；把重校验迁入 Worker，合并重复检查；建立版本快照和主动变更标记，不单独依赖文件 watcher 保证安全。
[B060] 专项验收  测量校验耗时 p50/p95、主进程事件循环延迟；更改 Skill 时仍必须及时拒绝。
[B061] F04  流式代码每次变化会重新触发 Shiki 高亮
[B062] P0   /   Markdown/代码块   /   确认行为/影响待测
[B063] 源码依据：apps/desktop/src/renderer/heroui-pro/components/code-block/code-block.tsx  (L106–L148)
[B064] 确认行为  CodeBlockCode 的高亮 effect 依赖 code/cacheKey；codeToHtml 运行在内容变化后，取消状态更新不代表取消已启动的高亮计算。
[B065] 潜在后果  模型输出长代码块时会反复执行高亮，增加 CPU 占用和渲染卡顿。
[B066] 修复建议  流式代码采用纯文本；围栏完成/本轮完成后统一高亮；缓存 {lang,theme,hash}，必要时放 Worker。
[B067] 专项验收  1000/5000/20000 字符代码块持续流式更新：高亮次数降至接近 1 次/块，文本可复制。
[B068] • 避免一次性重构；每次变更都应先保存基线，并以真实 Electron Profile 验证。
[B069] F05  聊天列表每次更新都遍历全部轮次及分组
[B070] P1   /   React 渲染   /   确认行为/影响待测
[B071] 源码依据：apps/desktop/src/renderer/components/office/OfficeConversation.tsx  (L49–L105)
[B072] 确认行为  OfficeConversation 在 render 中 turns.map、groupOfficeProcess、flatMap、reverse/find；未见按 turn 划分稳定 memo 边界。
[B073] 潜在后果  长对话时 VDOM 协调和分组成本随历史消息累积。Markdown 的 memo 只能缓解部分文本解析。
[B074] 修复建议  拆出 memoized TurnView；冻结已完成轮次引用；缓存分组数据；必要时加入兼容锚点的虚拟列表。
[B075] 专项验收  10/100/500 轮对话时，更新当前消息的历史 TurnView render 次数保持接近零。
[B076] F06  滚动事件对大量 DOM 节点逐个测量布局
[B077] P1   /   阅读位置与布局   /   确认行为/影响待测
[B078] 源码依据：apps/desktop/src/renderer/components/office/OfficeReadingPosition.ts  (L12–L33)
[B079] 确认行为  OfficeReadingPosition.record 使用 querySelectorAll、flatMap、getBoundingClientRect、sort 找到视口内锚点；在滚动处理时执行。
[B080] 潜在后果  复杂 Markdown 下可能触发布局计算，导致滚轮操作抖动或长任务。
[B081] 修复建议  使用 requestAnimationFrame 合并测量；优先维护当前可见 item，必要时 IntersectionObserver；避免每次排序全部块。
[B082] 专项验收  长文滚动期间记录 layout / scripting 时长；保留当前阅读位置、返回底部和面板重排行为。
[B083] F07  聊天页隐藏后仍处理 Agent 事件
[B084] P1   /   后台可见性   /   确认行为/影响待测
[B085] 源码依据：apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx  (L106–L149)
[B086] 确认行为  App 始终挂载已进入的 PiEducationWorkspace，并只用 hidden 切换；事件订阅 effect 仅依赖 hasEntered，回调未按 visible 隔离。
[B087] 潜在后果  教师在知识库/题库页面工作时，后台流式消息仍可驱动昂贵 React 更新。
[B088] 修复建议  隐藏期间保持主进程执行与事件序列记录，但将 UI delta 低频积累；再次可见时只做一次有序追赶/快照。
[B089] 专项验收  运行 AI 后切换至资料页，确认后台 UI commit 显著减少且返回对话不会缺字。
[B090] F08  每次对话更新都重算历史附件与 JSON 键
[B091] P1   /   附件与无关计算   /   确认行为/影响待测
[B092] 源码依据：apps/desktop/src/renderer/components/office/usePiAttachments.tsx  (L1–L53)
[B093] 确认行为  usePiAttachments 接收 turns.flatMap(items)，内部再 flatMap/过滤历史图片并 JSON.stringify 生成 historyKey。
[B094] 潜在后果  即使 Token 与附件无关，仍随历史条目数反复遍历。
[B095] 修复建议  将附件历史投影改为稳定 memo/独立 selector；只有附件版本变化时更新缩略图索引。
[B096] 专项验收  无附件/多附件长对话压测，确认 Token 更新不会反复遍历历史附件。
[B097] F09  渲染审批时按每一轮重复筛选多个全局集合
[B098] P1   /   审批和侧栏   /   确认行为/影响待测
[B099] 源码依据：apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx  (L197–L205)
[B100] 确认行为  renderApprovals 在每个 turn 内多次过滤 approvals/changes/artifacts/reviews/controls 等全局数组并拼接元素。
[B101] 潜在后果  轮次数 × 审批项数增加时产生重复扫描与组件实例创建。
[B102] 修复建议  收到业务事件时按 runId 建索引 Map；把审批卡片列表 memo 化，并保持事件身份和教师确认契约。
[B103] 专项验收  100 轮 + 100 条审批记录，用 Profiler 验证不随每次 delta 全量筛选。
[B104] F10  SQL 读取会话时不限制历史消息数量
[B105] P1   /   历史加载   /   确认行为/影响待测
[B106] 源码依据：apps/desktop/src/main/db.ts  (L4364–L4371)
[B107] 确认行为  getAiConversationSession 对 ai_conversation_messages 按 created_at ASC 查询整个 session，无 LIMIT/游标；snapshot 会据此重建 projection。
[B108] 潜在后果  大型会话打开、发送完成后的恢复和重渲染都可能逐渐变慢，内存/IPC 包体增长。
[B109] 修复建议  引入游标分页和最近 N 轮默认投影；旧消息按需加载；不能丢失 SQLite 真源和工具来源链。
[B110] 专项验收  10/100/1000 轮恢复耗时、IPC 字节、内存峰值，历史向上加载与搜索无遗漏。
[B111] • 避免一次性重构；每次变更都应先保存基线，并以真实 Electron Profile 验证。
[B112] F11  每次追加消息后再次返回完整会话
[B113] P1   /   数据库读写   /   确认行为/影响待测
[B114] 源码依据：apps/desktop/src/main/db.ts  (L4374–L4402)
[B115] 确认行为  appendAiConversationMessage 插入消息后查询 COUNT、更新会话元数据，随后直接 return getAiConversationSession。
[B116] 潜在后果  消息越多，每次提交/结束会多出全历史读回与 JSON 解析，即使调用方不消费全部消息。
[B117] 修复建议  拆分 write receipt 和 detail read API；按需要返回 messageId/count/updatedAt，旧 IPC 维持兼容过渡。
[B118] 专项验收  写入 1000 轮会话，比较延迟/读取行数；确认计数和持久性不变。
[B119] F12  一次聊天快照包含多项串行数据库/文件读取
[B120] P1   /   快照恢复   /   确认行为/影响待测
[B121] 源码依据：apps/desktop/src/main/xiaozhi-agent/production-host.ts  (L255–L336)
[B122] 确认行为  production-host.snapshot 顺序读取会话、run、附件、多个审核仓库、目标、usage、memory、skills 等，最后再合并运行态。
[B123] 潜在后果  频繁 hydrate 可能形成读延迟与 I/O 竞争；会话较大时尤其明显。
[B124] 修复建议  拆成轻量聊天快照+按需侧栏数据；缓存静态目录/技能；在一致性要求允许时并行独立读取。
[B125] 专项验收  分别记录每个仓库读时长与整包大小；核对运行态和 SQLite 版本一致性。
[B126] F13  发送/状态结算触发多次完整刷新
[B127] P1   /   请求与状态恢复   /   确认行为/影响待测
[B128] 源码依据：apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx  (L143–L162)
[B129] 确认行为  send 成功后并行 hydrate、refreshList、attachments.refresh；status 事件还会 refreshList，终态再次 hydrate。
[B130] 潜在后果  一次交互内可能多次重查同一会话与侧栏列表，尤其在流式输出开始或结束阶段造成顿挫。
[B131] 修复建议  建立 per-session single-flight refresh、版本戳与请求合并；按发生变化的数据域做增量更新。
[B132] 专项验收  对单次正常发送统计 snapshot/list/attachment IPC 调用次数，回归保证没有重复加载。
[B133] F14  在 React setState updater 内发起 hydrate 副作用
[B134] P1   /   异步正确性   /   确认反模式/触发条件待测
[B135] 源码依据：apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx  (L117–L129)
[B136] 确认行为  setSnapshot(previous=>{ if(!previous) { void hydrate(...); return previous; } ... }) 在状态计算函数内执行异步请求。
[B137] 潜在后果  更新函数可能重试或重放，导致重复加载、请求竞争；不符合纯 updater 语义。
[B138] 修复建议  把缺失快照判断移到事件处理器/显式 effect；用并发版本和取消标识单独安排一次 hydrate。
[B139] 专项验收  模拟事件早于首次快照、StrictMode/重新挂载、快速切换会话，确认至多一次有效恢复。
[B140] F15  渲染订阅仅过滤旧序列，未在相邻事件缺号时恢复
[B141] P1   /   事件正确性   /   确认缺少分支/丢包未复现
[B142] 源码依据：apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx  (L117–L142)
[B143] 确认行为  事件回调仅检查 sequence <= last、随后记录当前编号；未验证 sequence === last+1。
[B144] 潜在后果  如果监听切换/传递环节造成丢事件，可能少显示中间文本直到下一次 hydrate。
[B145] 修复建议  为 runId 维护 expectedSequence；遇缺号立即安排快照并回放边界；合并 delta 时引入 seqStart/seqEnd。
[B146] 专项验收  人为丢弃第 10 个事件，验证 UI 自动补齐且没有重复 Token。
[B147] F16  单轮流式展示有 65536 字符的累计截断门槛
[B148] P1   /   超长文本   /   确认行为/触发频率待测
[B149] 源码依据：apps/desktop/src/main/xiaozhi-agent/pi-session.ts  (L717–L745)
[B150] 确认行为  pi-session 将 text_delta 用 MAX_TEXT-streamedLength 裁剪，达到阈值后停止发出新的文本 delta。
[B151] 潜在后果  极长任务在运行中 UI 文本停止增长，用户容易误判为“卡死”；需要明确截断提示。
[B152] 修复建议  将输出上限与可见截断状态公开；长产物转文件/分页，停止额外 UI 投影并提示仍在运行；明确避免改变持久化语义。
[B153] 专项验收  超过 65536 字符回复时可见状态准确，最终结果/文件与提示一致。
[B154] F17  每轮执行前可能查询远端模型能力，最长约 10 秒
[B155] P1   /   响应首字延迟   /   确认行为/实际概率待测
[B156] 源码依据：apps/desktop/src/main/xiaozhi-agent/model-capabilities.ts  (L61–L91)
[B157] 确认行为  resolveDeepSeekCapabilities 在缓存过期/缺模态信息时请求 /models，并设置 10s timeout，然后才创建 Pi session。
[B158] 潜在后果  缓存条件不满足时首 Token 延迟，容易被用户主观认为是“AI 响应卡顿”。
[B159] 修复建议  将模型能力刷新与 UI 阶段提示分开；在允许的正确性边界上使用有效缓存/后台预热，严禁编造上下文能力。
[B160] 专项验收  冷/热/过期缓存对比 TTFT；模拟 /models 超时确保状态提示准确。
[B161] F18  Pi 模式仍先执行传统工作台的串行 bootstrap
[B162] P1   /   启动性能   /   确认行为/影响待测
[B163] 源码依据：apps/desktop/src/renderer/App.tsx  (L626–L689)
[B164] 确认行为  App 挂载时 bootstrap 依次调用基础数据、知识库、设置、会话/审批和 DeepTutor 等读取，不论当前是否进入 Pi 页面。
[B165] 潜在后果  打开聊天页前发生多项并非当前视图必需的数据读取，可能拉长冷启动。
[B166] 修复建议  按当前路由做按需初始化；首屏仅拿启动状态和当前会话，历史业务视图首次进入再加载。
[B167] 专项验收  冷启动性能瀑布图、首屏可交互时间、历史功能进入后的状态完整性。
[B168] • 避免一次性重构；每次变更都应先保存基线，并以真实 Electron Profile 验证。
[B169] F19  超大 App 与静态视图依赖存在懒加载机会
[B170] P2   /   打包与加载   /   代码结构确认/收益待测
[B171] 源码依据：apps/desktop/src/renderer/App.tsx  (L31–L70)
[B172] 确认行为  App.tsx 超过 2800 行，静态 import 多个业务页面；renderer 构建配置未显式按路由划分 chunk。
[B173] 潜在后果  初始 JS 解析与执行、模块初始化成本可能较高；实际产物大小须分析。
[B174] 修复建议  按路由拆 React.lazy/异步导入，优先对冷门工作区加载；先统计生产构建 chunk/parse 时间。
[B175] 专项验收  构建 bundle 可视化和冷启动 TTInteractive；无依赖重复与交互闪烁。
[B176] F20  聊天框架多层 backdrop-filter 模糊
[B177] P2   /   GPU/样式   /   确认样式/影响待测
[B178] 源码依据：apps/desktop/src/renderer/components/office/pi-workspace-glass.css  (L20–L40)
[B179] 确认行为  pi-workspace-glass.css 对会话侧栏、顶栏、右侧栏和文件工具栏使用 backdrop-filter blur。
[B180] 潜在后果  在某些显卡/缩放比例、复杂动效和频繁绘制时可能增加合成开销。
[B181] 修复建议  使用 DevTools Layers/Rendering 观察绘制；提供低特效模式和降低模糊的 A/B 对比，不预设 GPU 必为根因。
[B182] 专项验收  固定输入速度、固定屏幕尺寸，对比合成耗时、帧率与视觉接受度。
[B183] F21  多个教育 Worker 采用每次调用新建 Python 子进程
[B184] P2   /   侧车任务   /   确认行为/业务影响待测
[B185] 源码依据：apps/desktop/src/main/education/worker-host.ts  (L14–L37)
[B186] 确认行为  runEducationWorker 每次任务使用 spawn 启动 Python，设置了 5s/15s 超时而不是长驻 worker pool。
[B187] 潜在后果  重复数学/题目计算时产生冷启动成本；在 Windows 和杀毒软件扫描下更明显。
[B188] 修复建议  先量化真实调用频率；频繁小任务可使用有界长驻 Worker 池并保持协议、取消、隔离和限流。
[B189] 专项验收  10 次连续轻量任务测冷/热延迟，验证进程退出与异常回收。
[B190] F22  多个领域事务为每次事务开启独立连接
[B191] P2   /   SQLite 并发   /   确认行为/冲突待测
[B192] 源码依据：apps/desktop/src/main/db.ts  (L1068–L1127)
[B193] 确认行为  db.ts 中多类 repository 的 transaction 回调创建新 OmniEduStore、openDatabase，BEGIN IMMEDIATE，结束关闭连接。
[B194] 潜在后果  密集事务可能带来连接建立成本和 SQLite 写锁等待；当前未证明有实际死锁。
[B195] 修复建议  统一事务调度与连接复用，清晰区分只读/写入；保留事务原子性和旧库迁移兼容。
[B196] 专项验收  并发组卷/题库保存/索引任务下测 busy 等待、事务 p95、锁冲突数。
[B197] F23  每个 useOfficeComposerState 调用都建立未使用的本地状态
[B198] P2   /   React Context   /   确认行为/影响较低
[B199] 源码依据：apps/desktop/src/renderer/components/office/OfficeComposerState.tsx  (L1–L45)
[B200] 确认行为  useOfficeComposerState 先执行 useDraftState，再读取 Context；即使 Provider 存在也分配完整的本地 hooks/refs。
[B201] 潜在后果  组件实例多时增加无效状态和 hooks 开销（未能确认是主要卡顿源）。
[B202] 修复建议  拆分 Provider-only 使用 hooks 与无 Provider fallback，保持 hooks 规则和旧调用兼容。
[B203] 专项验收  Profiler 对比 hooks 与 render 成本；确认独立组件模式仍可用。
[B204] F24  已有真实 UI 测试，但缺少定量性能门禁
[B205] P1   /   工程质量/测试   /   已查测试/性能覆盖判断
[B206] 源码依据：apps/desktop/scripts/xiaozhi-agent/pi-shell-reading-ui-smoke.mjs  (L24–L68)
[B207] 确认行为  pi-production-ui-smoke 测流式事件/恢复；pi-shell-reading-ui-smoke 测滚动与视口；未见相应 FPS、Long Task、Commit、heap 增长断言。
[B208] 潜在后果  功能回归通过并不能防止下次改动重新引入卡顿。
[B209] 修复建议  建立固定数据集和可复现环境，增加 React Profiler/Chromium tracing、事件循环延迟与内存采样门禁。
[B210] 专项验收  CI 在性能显著回退时失败；保留真实 Electron、实际 Chromium 的功能测试。
[B211] F25  IPC handler 的发送者鉴权模式未统一
[B212] P2   /   IPC 安全与边界   /   审查提示/非已确认漏洞
[B213] 源码依据：apps/desktop/src/main/index.ts  (L242–L265)
[B214] 确认行为  xiaozhi-agent/ipc.ts 对主窗口 sender 与 mainFrame 做校验，而 main/index.ts 部分其他业务 handler 未显式做同等级 senderFrame 校验。
[B215] 潜在后果  是否可利用取决于窗口/导航隔离，不能仅凭此认定安全漏洞；但存在边界不一致风险。
[B216] 修复建议  为所有敏感 IPC 统一 sender/frame 验证、输入 schema、权限与审计；开展窗口/iframe 级攻击面测试。
[B217] 专项验收  伪造非主窗口 sender 的负向用例、跨页面/子 frame IPC 拒绝测试。
[B218] F26  超大业务底座与双代际实现提高回归成本
[B219] P2   /   工程维护性   /   确认结构/间接风险
[B220] 源码依据：apps/desktop/src/main/db.ts  (L1058–L1145)
[B221] 确认行为  db.ts 大约 7397 行、App.tsx 2853 行，同时保留 legacy-test 与 Pi 路径。
[B222] 潜在后果  新增功能时容易隐式影响初始化、数据访问和 UI 组件；不一定直接造成运行时卡顿。
[B223] 修复建议  以纵向切片渐进拆分边界，废弃路径先做证据清单，保留测试直至符合删除条件。
[B224] 专项验收  重构后跑旧库迁移、核心业务 E2E、所有 IPC 合同和冷启动测试。
[B225] 06  分层改造设计：最小侵入，而不是重写
[B226] 6.1 显示层事件聚合与序列保证
[B227] 将 UI 事件队列放在清晰的边界：主进程仍维护细粒度权威投影与持久化语义，Renderer 接收到增量事件先入队，按适合帧率的时间窗更新当前文本。工具开始/结束、审批、终态和会话切换等不得延迟到造成状态错误；聚合必须严格保持顺序并覆盖最后一次 flush。
[B228] 只有同一 sessionId/runId/segment、相邻 text_delta 才允许合并，不能跨越 tool/status/approval。
[B229] 持续保留可检查的源序号；收到序号缺口需从权威 snapshot 校正。
[B230] 运行被停止、窗口隐藏、页面卸载或会话切换时，明确处理队列：flush / discard + hydrate 的条件必须有测试。
[B231] Renderer 的 commit 限频不能影响 Main 对业务结果的保存、权限校验和用户可见最终答案。
[B232] 6.2 Skill 校验与主线程减负
[B233] 先分别测量 checkFiles、capture、目录遍历、文件哈希和相关 DB 读取耗时。重型校验转 Worker，并把校验请求按相同资源版本去重；在安全边界仍需验证不可变版本和当前授权。文件 watcher 只能辅助触发，不能替代有效性检查。
[B234] 6.3 会话读写与快照分页
[B235] SQLite 保留全部历史为真源；UI 只加载最近 N 轮并提供向上游标分页。拆出 append receipt、当前会话投影、侧栏审查状态等接口。带版本戳的 single-flight 防止并发 hydrate 互相覆盖，原有审批/引用/产物校验继续依赖主进程。
[B236] 6.4 Markdown、代码高亮与滚动
[B237] 代码块处于流式阶段时先渲染原文本，完成后再高亮；历史轮次需要稳定缓存，Markdown 的 memo 要在真正的 TurnView 边界上发挥作用。滚动锚点测量以帧为单位合并，并保持向上阅读时不抢滚动位置。
[B238] 6.5 后台渲染和首屏加载
[B239] 切换到知识库/学生/组卷页面期间，业务执行不中断；只降低无关 UI 工作频率。把旧工作台的初始化拆为路由级懒加载，并将模型能力元数据的耗时呈现在可观察状态中。
[B240] 07  性能量化方案与验收矩阵
[B241] 下面全部是拟议验收阈值，尚未在仓库实测。必须记录测试环境（Windows 版本、GPU、屏幕缩放、应用 release/dev、数据库行数、模型速度），对比原始 commit 和优化分支至少各 5 次。

[B242] TABLE
场景 | 关键指标 | 建议目标/判定方式
纯文本 50 delta/s | IPC 数量、UI commit/s、输入延迟 | UI 可见刷新 ~20–30 次/s；字节/顺序准确；无额外终态延迟
代码块连续输出 | codeToHtml 执行次数、Long Task | 流式中不反复高亮；完成后每块约 1 次
100/500 轮历史 | React Commit p95、DOM 节点、Heap | 随历史增长曲线明显优于基线，历史轮次不持续全量 rerender
滚动长回复 | scroll handlers、Layout ms、掉帧 | 非底部阅读不抢焦点/滚动；滚轮和键盘可用
隐藏聊天页面 | 后台 React commits | 隐藏期间 UI commit 显著降低，返回不丢事件
Skill 5/20 项 | 主进程 event-loop delay p95、check ms | 重校验不会产生长期 >50ms 阻塞；安全校验功能不回退
1000 轮持久会话 | snapshot 行数/字节/耗时/内存 | 默认页面响应不随全部历史线性增长；分页正确
远端能力 10s 超时 | TTFT 分阶段耗时 | 显示“读取模型能力/等待网络”阶段，不误报模型无响应
异常事件 | 缺序、取消、终止、重连 | 最终文本和来源完整且不重复；清晰告知截断
数据库并发 | 事务 p95、busy 次数 | 写锁可控；数据完整、重启可恢复

[B244] 7.1 必须采集的四类证据
[B245] Chromium Performance Trace：主线程长任务、Layout、Paint、Compositor、JS 火焰图；按场景打标。
[B246] React Profiler：PiEducationWorkspace、OfficeConversation、OfficeMarkdown、TurnView、审批组件 commit 次数和耗时。
[B247] Electron 主进程：eventLoopDelay、Skill checkFiles/capture 耗时、SQLite snapshot/append 调用次数与 p95。
[B248] 资源观测：Renderer/Main RSS/Heap、CPU、GPU 合成耗时、IPC payload 字节和队列长度。
[B249] 7.2 不允许的“优化”
[B250] 不允许在 UI 减少渲染后丢 Token、改变消息次序或吞掉状态事件。
[B251] 不允许关掉 Skill 可信来源校验、权限确认或教师审核以换性能。
[B252] 不允许直接删除历史记录、清空生产数据库或抹除学生资料。
[B253] 不允许以 mock-only 成功替代 Electron 真正可交互验证。
[B254] 08  修复迭代与 Git Worktree 协作计划

[B255] TABLE
工作包 | 建议工期级别 | 修改边界 | 验收产物
WP0 基线与测量 | S | 独立性能脚本/metrics，不改业务 | 重放 fixture、baseline.json、CPU/React Trace
WP1 流式热路径 | M | 事件队列、投影、聊天 current turn、代码高亮 | 高频 delta 与代码压测 + 事件顺序回归
WP2 主进程与恢复 | M/L | Skill Worker、hydrate single-flight、sequence gap、隐藏态 | 安全校验 E2E + 恢复/断流/停止 E2E
WP3 数据与长对话 | L | SQLite 分页、快照拆分、侧栏按需、启动懒加载 | 旧库迁移/1000 轮长会话/备份恢复证据
WP4 资源与维护 | M | Worker 池、GPU 模式、工程模块拆分、IPC 统一校验 | Windows 打包、可访问性、资源消耗报告

[B257] 协作与回滚  一个 worktree 对应一个目标；先产出测试门禁，再写代码；每包都提供修改文件清单、旧数据验证、差异报告、回滚方式。不得未经用户授权提交、push 或部署。
[B258] 09  可直接交给 Codex 的执行合同
[B259] 任务范围  只在最新拉取的 EduDev 工作树上执行代码优化，优先解决 F01–F06、F10–F15、F24；其余问题按 Profile 决定是否排期。
[B260] 先行审查  先读 AGENTS.md、docs/goal/XIAOZHI_CODEX_GOAL.md、docs/architecture/CURRENT.md 等约束；对照本报告每项源码路径，确认当前工作树没有新变更已修复问题。
[B261] 基线冻结  收集 git status/HEAD、依赖锁定、SQL 数据副本、会话 10/100/1000 轮 fixture，先写性能与功能测试，不允许先重写旧接口。
[B262] 工作方式  采用 git worktree；按 WP0→WP1→WP2→WP3 顺序，记录每个问题的证据、根因假设、改动、实测前后指标和未通过测试。
[B263] 安全要求  保留本地优先、学生数据脱敏、SQLite 真源、文件授权、Skill 指纹与撤销、工具审批、消息顺序、取消/重启恢复。
[B264] 验收与交付  运行 npm run build、npm run test:renderer-components、对应专项测试及关键 Electron smoke；输出 p50/p95、FPS/Long Task、Heap、CPU、IPC 次数的前后差异表。未经许可不得 push。
[B265] 10  风险复核：哪些目前不能宣称已解决
[B266] 本报告能证明高频计算、同步文件检查和全历史读回等代码行为存在，却不能在缺少设备 Profile、实际业务数据量和运行日志的情况下精确断定哪一项占总卡顿的百分比。建议按照“抓取 Profile → A/B 隔离 → 小步修复 → 真机复测”的顺序确认主因。
[B267] 对于 IPC 安全、数据库死锁、Python Worker 冷启动、GPU 模糊层等问题，目前只属于有代码依据的风险提示；没有发现足以直接下结论为已被利用漏洞或稳定复现故障的证据。
[B268] 此外，远端 master 截止审查时仍是 2026-10-12 的提交。如果正在开发的本地目录或其他分支比该 SHA 更新，应先 git diff/compare，再把报告作为复核清单，而不能将其作为最新工作树的无条件结论。
[B269] 11  源码定位索引
[B270] 报告的每项 Fxx 均附有固定 Commit 的 GitHub 源码链接，避免 master 后续移动导致行号失真。关键入口如下：
[B271] Pi 增量与生命周期：apps/desktop/src/main/xiaozhi-agent/pi-session.ts
[B272] 主进程权威投影：apps/desktop/src/main/xiaozhi-agent/production-host.ts
[B273] 主进程到 Renderer 的 IPC：apps/desktop/src/main/xiaozhi-agent/ipc.ts
[B274] 渲染器事件订阅：apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx
[B275] 共享投影函数：apps/desktop/src/shared/xiaozhi-projection.ts
[B276] Markdown/Streamdown：apps/desktop/src/renderer/heroui-pro/components/markdown/markdown.tsx
[B277] Shiki 高亮：apps/desktop/src/renderer/heroui-pro/components/code-block/code-block.tsx
[B278] Skill 校验：apps/desktop/src/main/xiaozhi-agent/managed-skill-runtime.ts
[B279] 数据库完整会话：apps/desktop/src/main/db.ts
[B280] 真实流式 E2E：apps/desktop/scripts/xiaozhi-agent/pi-production-ui-smoke.mjs
[B281] 真实滚动 E2E：apps/desktop/scripts/xiaozhi-agent/pi-shell-reading-ui-smoke.mjs
[B282] 12  最终建议
[B283] 不要以“升级模型”“换电脑”“关动效”作为主要解决方案，也不要先推翻现有 Pi Harness。第一轮集中解决 Token 更新/状态复制/高亮与 Skill 校验，第二轮解决长对话与生命周期并发，最后才是路由拆分和 GPU/UI 精修。此顺序能最大程度保护已有业务闭环和恢复语义，并通过可量化指标决定是否继续投入。
[B284] 交付口径：这是面向工程团队的“诊断与修复合同”，而不是已执行完的修复报告。每项影响必须通过同 Commit、同硬件、同测试数据的对照实验确认。
