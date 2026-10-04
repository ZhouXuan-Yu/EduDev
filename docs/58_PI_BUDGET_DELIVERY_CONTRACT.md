# P04-B 预算与上下文交付合同

2026-10-02。M10/M01，完整目标仍见 docs/35、48。上一轮 P04-A 已验收，不能据此声称完整 Harness/Codex 对齐完成。

## 现状与复用选择

当前 Pi 0.80.3 原生 AgentSession 管模型循环/队列/私有 JSONL；Hana 使用同类 streamFn 和 getContextUsage 协调。小智仅有90秒活动计时，ask_teacher 暂停但复制审批仍受30秒工具计时，没有正式用量/配置读回。SDK cost=0 为注册占位，不能称免费；SDK getSessionStats 只统计当前有效上下文，压缩后不能当总账。

P04-B 分三个连续纵向交付单元，先落 B1，再 B2/B3，不改变全目标：

1. **B1 本轮**：会话预算设置、每run固定快照、原生streamFn前模型调用门禁、工具执行门禁、有界活动/等待计时、真实usage回执与SQLite/重启。主进程持久化、typed preload、正式工作区、失败态、真实DeepSeek实例及必要冒烟。
2. **B2 下一项**：原生compact/SessionManager，来源、计划、审批/文件版本保护；压缩成本也入账，失败/停止保留原分支，新旧JSONL兼容。不可将SDK摘要作为教育确认事实。
3. **B3**：已有教育L1/L2/L3授权作用域读取/证据/脱敏，不创建第二记忆真源；队列撤回/编辑结合原生队列快照与持久CAS，迟到消费不能伪称已撤回。

## B1 可核验交付

- 教师在小智右侧展开“运行预算”，设置模型请求数、工具次数、token观察阈值、活动秒数、单次教师等待秒数；保存/错误/忙碌可见，重启保持。设置按会话隔离，有版本防止旧页面覆盖；运行中拒绝改当前快照。
- 新增 xiaozhi_pi_budget_settings(schema_version=1)、xiaozhi_pi_usage(schema_version=1)，SQLite保存公开运行指标和固定预算；不迁移业务表、不删除旧文件。未知版本拒绝；旧库无记录采用明确默认。遗留运行指标标中断，不自动继续。
- runtime-budget独立域组合Pi原生流函数；不重写模型循环，不使用CLI。每次provider请求前检查模型调用数/累计观察token；每次新的工具执行前检查工具上限。达到上限阻止进一步调用，当前已完成回复保留；无自动重试/续跑，教师可调整下轮预算。
- 供应商usage取实际助手消息；公开input/output/cacheRead/cacheWrite/total与完整性，不包含私有消息/路径/凭证/原始推理。token缺失显示未知或部分，费用固定未知。token是收到usage后阻止下一请求的阈值，单请求可能超过；不承诺硬费用封顶或提前知道供应商账单。
- 教师澄清与复制审批暂停活动计时，分别有等待上限；超限中止模型/工具信号，未批准效果零写。普通文件工具仍有独立30秒执行限时；复制等待改用明确运行等待控制，不能在等待时悄悄消耗活动预算。
- shared契约、ipc、preload、生产host、session-state、Pi门面、正式组件一起修改；复用已复制Pro ChatTool slots，实际MCP文档和finesse成本回执/真实状态规范，无新增依赖。

## 完成定义与回退

真实正式Electron/DeepSeek证明：设置实际用户操作/版本/会话隔离/重启；简单回复usage与私有SDK助手usage逐项相等；一请求上限阻止工具后第二请求；token阈值阻止下一请求；工具预算零额外效果；澄清/审批等待活动计时不增长且超限迟到无效；停止与进程退出保留指标；双视口可达。必要边界可用隔离故障注入，但不得代替真实provider成功实例。运行 build、renderer-components、本轮专项、关键路径smoke、git diff --check；报告精确命令、通过数、失败、skip和未验证范围。

迁移只增量CREATE/索引，旧数据库测试副本与新库验证，真实教师数据不改；旧入口回退OMNI_EDU_XIAOZHI_PI=0。不commit/push、不修改系统网络/权限、不启用子Agent。B1不等于B2/B3完成，也不等于Skills、办公、视觉与实际无VPN/安装完成。
