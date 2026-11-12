# 06 — Task Execution Protocol

## 1. 核心实体

- Task：教师的一项长期工作，Task ID 稳定。
- Run：一次执行尝试，每次恢复生成新 Run ID。
- Session：Pi 对话运行环境，可重建。
- Plan：当前任务计划，有独立 revision。
- Step：计划中的可验收工作单元。
- Checkpoint：可靠保存的任务进度。
- Effect：有副作用的操作记录。
- Artifact：任务产生的文件或其他成果。

## 2. 状态与阶段分离

Task Status 建议：`created`、`active`、`waiting_approval`、`paused`、`interrupted`、`review_required`、`completed`、`partial`、`blocked`、`failed`、`cancelled`。实际枚举优先映射现有 Task State，避免另建平行状态机。

Task Phase 建议：`planning`、`preflight`、`executing`、`acquiring_capability`、`waiting_approval`、`recovering`、`verifying`、`delivering`。

Step Status：`pending`、`running`、`waiting_dependency`、`waiting_approval`、`completed`、`verified`、`failed`、`skipped`。

状态转移必须有白名单；终态不能无条件回到运行态。取消任务不能自动恢复，除非教师明确创建新任务或重新发起。

## 3. Plan Contract

Task Plan 保存原始目标引用、planRevision、planningLevel（1/2/3）、步骤、依赖、Capability Requirements、验收条件和创建时间。计划可以修订，但教师原始目标和明确验收要求不能被模型静默覆盖。

## 4. H-16 动态规划

- Level 1：简单、低不确定任务，轻量能力检查后执行。
- Level 2：多工具任务，列出步骤、关键依赖和验证。
- Level 3：复杂/长任务/能力缺口/多 Provider 任务，预先检查能力、权限、依赖、风险、成果和恢复点。
- 规划深度与风险级别分离；短任务也可能需要高风险审批。
- 执行中依据真实结果更新计划，不创建第二个 Planner Agent Loop。

## 5. 执行顺序

接收任务 → 创建/绑定 Task → 复杂度评估 → 规划 → 能力预检 → 权限检查 → 创建 Run → 执行 Step → 记录 Effect → 验证 Step → Checkpoint → 最终验证 → 交付。

## 6. 并发与所有权

一个 Task 在同一时刻只有一个有效执行 Owner/Generation。多任务可以并行，但 Task 之间的上下文、权限、Provider Snapshot、Effect 和 Artifact 必须隔离。

## 7. SQLite 事实来源（H-24）

SQLite 保存 Task、Run、Step、Plan Revision、Checkpoint、Approval、Effect、Artifact 引用、Capability Snapshot 引用和状态转移。Pi Session JSONL 保存对话历史。二者通过稳定 ID 关联。

## 8. 验收

- Task ID 跨 Run/Session 稳定。
- 每次恢复有新 Run ID / Generation。
- Plan Revision 可追溯。
- Step 依赖和状态转移有效。
- Task 与 Session 解耦。
- 多任务不串上下文或授权。
