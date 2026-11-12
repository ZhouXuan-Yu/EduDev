# 07 — Checkpoint Protocol

## 1. 检查点分类（H-26）

- Task Checkpoint：阶段进度、计划、步骤和成果引用。
- Effect Record：每次有副作用操作的执行意图、执行状态、结果和核验。
- Capability Snapshot：当前任务实际使用的 Capability / Provider / Contract 版本。
- Artifact Checkpoint：文件/成果 ID、版本、路径引用、哈希和验证状态。

普通流式文字和细粒度事件继续使用现有 Event Journal，不为每个 token 创建 Task Checkpoint。

## 2. Effect 三阶段协议

### INTENT（执行前）
持久化 effectId、taskId、runId、stepId、callId、capabilityId、providerId/version、操作类型、资源目标、inputDigest、幂等键、权限 Grant 引用、generation。持久化成功后才允许执行。

### EFFECT（执行中）
记录开始、进度、取消请求、超时、外部回执。进程崩溃后 `executing` 不代表操作未发生。

### COMMIT / RECONCILE（执行后）
持久化实际结果、Artifact、哈希、side-effect 状态和工具 Receipt；独立核验后才标记 Step verified。

## 3. 不承诺跨系统 Exactly Once

SQLite 与文件系统/远程 HTTP/MCP 无法组成原子事务。采用持久化意图 + 幂等键 + 状态核对 + 补偿。无法确认的操作标记 `unknown`，禁止盲目重放。

## 4. Effect 状态

`intent`、`executing`、`committed`、`failed`、`unknown`、`reconciled`、`compensated`。`compensated` 表示做了补偿，不代表原操作从未发生。

## 5. 何时创建检查点

任务创建、计划正式化/修订、阶段完成、Provider 切换、能力安装/激活、审批结果、文件生成/修改/交付、任务暂停/中断/恢复、最终验证。普通流式输出由 Event Journal 批量处理。

## 6. 操作恢复规则

- 只读查询：可按成本和新鲜度决定重查；保留来源引用。
- 文件创建/修改：先检查文件、哈希、版本、Artifact 和临时文件。
- 依赖安装：检查实际包版本、锁文件和安装状态。
- MCP 连接：重新核验 endpoint、身份、Schema 和授权。
- Skill 发布：检查版本目录、内容哈希和发布状态。
- 外部发送：查询服务端回执/幂等键；未知时不重发。
- 删除：检查目标实际状态，禁止自动重复破坏性操作。

## 7. 现有实现复用

优先复用 `tasks/task-state.ts`、`events/journal.ts`、`events/receipts.ts`、`session-state.ts`、Office Artifact State 的 revision/CAS、generation fencing、receipt 和恢复机制。先审计再决定迁移，不得新建平行事件日志或平行 Task 数据库。

## 8. 验收

模拟在 INTENT 后、执行中、外部副作用成功但 COMMIT 前、COMMIT 后分别崩溃。恢复后不得丢失结果、重复副作用或让旧 Run 覆盖新 Run。
