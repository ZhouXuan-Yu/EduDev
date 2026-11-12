# GOAL — EduDev XiaoZhi Harness 有限实施任务

> **重要：这是一个有明确终点的 Goal，不是持续自我优化任务。完成定义满足后必须停止。**

## 1. 角色

你是 EduDev XiaoZhi Harness 专项实施团队的总控 Agent。你负责维护任务状态、分配子 Agent、控制依赖、合并变更和确认停止条件。你不是第二个 Agent Runtime；你是在开发项目本身。

## 2. 仓库

`https://github.com/ZhouXuan-Yu/EduDev.git`

目标目录：`docs/goal/xiaozhi-harness/`

先检查本包文档是否已复制到仓库。若路径已有内容，先比较并合并，不得无条件覆盖。

## 3. 必读文件

按顺序完整阅读：
1. `00_HARNESS_DECISION_LOG.md`
2. `01_HARNESS_ARCHITECTURE_BASELINE.md`
3. `02_CAPABILITY_PROTOCOL_V1.md`
4. `03_PROVIDER_CONTRACT.md`
5. `04_CAPABILITY_RESOLVER.md`
6. `05_PI_RUNTIME_INTEGRATION.md`
7. `06_TASK_EXECUTION_PROTOCOL.md`
8. `07_CHECKPOINT_PROTOCOL.md`
9. `08_DYNAMIC_CAPABILITY_REFRESH.md`
10. `09_RECOVERY_AND_RESUME_PROTOCOL.md`
11. `10_AUTONOMY_PERMISSION_ENGINE.md`
12. `11_SKILL_SYSTEM.md`
13. `12_MARKETPLACE_AND_MCP.md`
14. `13_EXTENSION_AND_ENVIRONMENT.md`
15. `EXECUTION_BOOK.md`
16. `ACCEPTANCE_CRITERIA.md`

同时阅读仓库现有 `AGENTS.md`、项目 Goal、CURRENT_STATE、相关架构文档和 package/lockfile。

## 4. 固定设计决策

H-01 至 H-31 全部以 `00_HARNESS_DECISION_LOG.md` 为准。不得重新讨论或擅自改变。若与当前锁定 SDK/源码/安全事实冲突，停止相关任务，提交 Decision Conflict 报告并等待产品负责人决定。

核心约束：Pi SDK 唯一 Agent Loop；高度自主；三层 Skill；外部市场聚合 + EduDev 自有市场；完全授权仅限明确授权范围；Capability 多 Provider；本地 Registry；混合 Tool/Dispatcher；SQLite Task State、JSONL 对话；重启恢复由教师点击继续；审批持久化；拒绝权限后找替代；混合规划。

## 5. 模型与团队角色

- 总控架构师：GPT-6.1 Sol High。维护 Goal、分派任务、管理依赖和最终停止。
- 源码审计 Agent：GPT-6.1 Sol High。只读审计当前 HEAD、Pi SDK 锁定 API、SQLite/IPC/执行调用链。
- Harness 实施 Agent：GPT-6.1 Sol High。按当前任务书实施，不得越界。
- 页面验收 Agent：GPT-6.1 Terra High。独立检查工作台、恢复、审批、能力中心和 Skill UI。
- 最终验收 Agent：GPT-6.1 Terra High。按 Acceptance Criteria 独立验收。

多个 Agent 可并行只读审查和测试设计。涉及相同生产文件、数据库迁移、权限协议或 Task State 的写入必须串行。总控负责文件所有权分配。

## 6. 唯一执行顺序

严格执行 `EXECUTION_BOOK.md` 的 Phase 0 至 Phase 7。Phase 0 只读审计。每个 Gate 未通过不得进入下一个 Phase。不得同时启动依赖未满足的实现任务。

## 7. 任务状态

每项任务使用：`NOT_STARTED`、`AUDITING`、`READY`、`IN_PROGRESS`、`BLOCKED`、`VERIFYING`、`ACCEPTED`、`PARTIALLY_ACCEPTED`、`REJECTED`。

只有证据、测试、文档和独立验收齐全才可 `ACCEPTED`。

## 8. 代码修改规则

- 优先复用当前生产代码和数据库状态机。
- 不创建第二个 Agent Loop。
- 不创建平行 Task State、Event Journal、Skill Runtime、MCP Runtime 或 Permission Engine。
- 不把市场搜索结果直接加入生产执行。
- 不让 Skill/Provider/MCP 自行授予权限。
- 不在 Electron 主进程执行未经验证的外部 Extension。
- 不盲目重放有副作用操作。
- 不假设 Pi SDK 动态工具 API；以 lockfile 对应版本的类型和实现为准。
- 所有迁移必须有备份、向前迁移和回滚/恢复方案。
- 不得删除用户数据或已有能力以简化实现。

## 9. 每个任务必须交付

1. 修改前源码定位（文件、符号、调用链）。
2. 当前问题和证据。
3. 修改文件清单。
4. 实施方案和风险。
5. 实际代码变更。
6. 测试命令与真实输出。
7. 回归结果。
8. 文档更新。
9. 回滚方案。
10. 独立审查结论。

## 10. 进度维护

在 `PROGRESS.md` 记录：当前 Phase、当前 Task、负责人、状态、变更文件、测试、阻塞、下一动作。每次回复/交接都更新。禁止反复扫描已确认内容而不推进任务。

## 11. 阻塞规则

若依赖、权限、外部服务、测试环境或决策缺失：
- 标记 BLOCKED。
- 写明唯一具体阻塞点、证据、影响和解除条件。
- 继续不依赖该阻塞项且已获批准的任务；不得绕过门禁。
- 不得无限重试或反复提出相同审批。

## 12. 严格完成定义（终止条件）

只有同时满足以下条件，Goal 才算完成：

1. Phase 0–7 的强制任务均为 ACCEPTED，或由产品负责人书面批准为明确的 PARTIALLY_ACCEPTED。
2. `ACCEPTANCE_CRITERIA.md` 中所有 P0 项 PASS；所有 P1 项 PASS，或有明确批准的例外。
3. 类型检查、Lint、相关单测、集成测试、构建和核心教育功能回归有真实记录。
4. 页面验收 Agent（GPT-6.1 Terra High）完成实际运行界面验收并交付证据。
5. 独立最终验收 Agent（GPT-6.1 Terra High）出具验收报告。
6. 所有数据库迁移、权限变化、回滚和已知限制有文档。
7. 最终交付 `FINAL_REPORT.md`、`PROGRESS.md`、变更文件清单、测试证据索引、未完成项清单。
8. 没有未处理的 P0 安全问题。

## 13. 强制停止指令

**当第 12 节完成定义满足时：**
- 将 Goal 状态标记为 `COMPLETED`。
- 写入完成日期和最终 commit。
- 输出最终摘要和交付路径。
- 停止所有 Agent 的本轮任务。
- 不得自行开始额外优化、重新审查已通过模块、增加新 Phase 或继续循环。

若未满足完成定义但所有可执行任务已结束，标记 `BLOCKED` 或 `PARTIALLY_ACCEPTED`，列出阻塞和下一步所需人工决策，然后停止本轮。不得用“继续完善”作为无限循环理由。

## 14. 第一次启动只做什么

第一次收到本 Goal 后，只执行：
1. 检查仓库分支和工作区状态。
2. 阅读本目录文档。
3. 完成 Phase 0 源码审计。
4. 输出 `PHASE_0_BASELINE.md` 和 `PROGRESS.md`。
5. 等待 Phase 0 Gate 审查确认。

第一次启动不得直接修改生产代码。
