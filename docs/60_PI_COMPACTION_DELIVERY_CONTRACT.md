# P04-B2 原生上下文压缩合同

2026-10-02，M10/M01。上一轮B1为已验收进展；完整目标与B3/Skills/视觉/办公/无VPN安装仍保留。

## 来源与边界

固定Pi 0.80.3 AgentSession.compact原生实现：prepareCompaction→native streamFn/result→appendCompaction→buildSessionContext；失败/取消在append前检查，JSONL只追加、不删原消息。Hana session-compactor包含大量特定缓存/人格依赖，本轮采用同底层native SDK与已有stream/执行registry适配，不复制整套特殊compactor，不另写模型循环。SDK默认近期保留量20000过大，当前教学会话采用keepRecentTokens=2048/reserveTokens=4096。

## 本轮交付合同

源码复核补充（docs/62）：Hana 的完整压缩依赖官方 session_before_compact extension 与缓存保留/历史修复，不是裸调 compact。本切片先交付原生手动路径；keepRecentTokens=2048/reserveTokens=4096 为待真实实例验证的候选配置，不冒称模型官方窗口。自动压缩前需确认模型能力及完整请求大小，禁止静默有损截断；没有通过验收前保持关闭。

- 正式页面“压缩上下文”typed入口，和普通任务共享单会话owner、固定模型/目录、持久command hash、防重、budget/usage、停止/失败/崩溃收敛。压缩忙碌时拒绝另开run/修改范围/排队追加；没有历史时不调用provider。
- 采用native compact与SessionManager，不把生成摘要显示为思考过程或教育事实。公开卡显示运行/完成/失败及SDK压缩前tokens、压缩后estimatedTokensAfter，明确估计，费用未知；压缩的真实provider usage也保存账本。SQLite保留全部可见消息/计划/审批，SDK JSONL保留原前缀与压缩entry；无需新业务表。
- main每会话构造有界教育上下文保护，来自既有计划/文件审批版本hash/相对来源与公共source标题；全部重新脱敏。模型摘要之外追加main事实作为受保护记忆（不是新授权），下轮从同一会话SQLite重新取事实，不能借摘要批准旧写入。超出投影上限明确标有省略，原记录仍SQLite可读，未知不可补造。
- 压缩stream.result的包装只负责真实usage与摘要脱敏/事实footer，不写summary生成循环；内容为空/截断/失败拒绝commit。取消调用abortCompaction，失败保留原JSONL，已提交压缩但UI未提交的崩溃允许下一轮读取原生entry，不重复command或旧文件效果。
- 先完成显式压缩纵向实例；自动阈值触发只有在同预算、隐私保护、取消/失败实例验收后才放行，不能先打开SDK自动重试。自动阈值和B3完整教育记忆/队列编辑保持待办，不把一次手动压缩当完整P04。
- 文件：shared契约/投影、main压缩保护小域/Pi门面/production-host、IPC/preload、Pro工具卡/正式按钮、专项测试/包命令和四文档/架构。复用现有ChatTool（实际MCP文档）及finesse真实状态原则，无新依赖。

## 完成定义

真实正式Electron/DeepSeek多轮合成教师资料→可见压缩按钮→native entry/实际摘要及usage→来源/计划/文件版本受保护→续问→重启；未知历史、小会话/重复command/额外字段/运行中拒绝；停止/预算失败/强制进程退出保留原历史且不重放；双视口卡/停止可达。预算/控制专项复验、本轮build/renderer/必要smoke/diff门禁；报告精确命令/通过/失败/skip/未验证范围。测试仅隔离数据根，旧SDK测试副本兼容；回退OMNI_EDU_XIAOZHI_PI=0保留旧数据。无commit/push/系统配置/子Agent。
