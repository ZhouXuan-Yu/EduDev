# EXECUTION_BOOK — XiaoZhi Harness 实施任务书

## 0. 执行规则

本任务书是有限范围的实施合同。总控 Agent 必须逐 Phase 执行，不能把“继续优化”当作开放任务。每个任务只在证据、测试、文档和独立验收齐全后关闭。

### 必须遵守

- 先读取当前 HEAD 和本目录全部文档。
- 先 Phase 0 审计，未通过不得修改生产代码。
- 先找现有实现，优先 Adapter/扩展，禁止平行造第二套 Task State、Event Journal、MCP Runtime、Skill Runtime 或 Permission Engine。
- 每个改动列明文件、符号、迁移、风险、测试和回滚。
- 不得假设 Pi SDK API；检查 lockfile、安装包 types 和实际实现。
- 不得将计划功能写成已实现。
- 每 Phase 独立提交或形成可审查变更集。
- 超范围工作写入 `FOLLOW_UP.md`，本轮不做。

## Phase 0 — 基线审计（只读）

### T0.1 仓库基线
- 记录 HEAD commit、分支、工作区状态、Node/package manager、锁文件和测试命令。
- 阅读 `00_HARNESS_DECISION_LOG.md` 至 `13_EXTENSION_AND_ENVIRONMENT.md`。

### T0.2 Pi Runtime 调用链
- 追踪 production-host → pi-session → createAgentSession → Tool Definition / customTools → dispatcher → execution boundary。
- 查明 Pi 锁定版本是否支持动态更新 Tool Definition/active tools；给出类型/源码证据。

### T0.3 Task / Session / Event 基线
- 审计 `tasks/task-state.ts`、`goal-state.ts`、`events/journal.ts`、`events/receipts.ts`、`session-state.ts`。
- 列出现有表、状态机、revision/CAS、generation fencing、recover/pause/resume。
- 标出已有功能和真实缺口，不新增代码。

### T0.4 Skill / MCP / Permission 基线
- 审计 `managed-skills.ts`、`managed-skill-runtime.ts`、`skill-catalog-state.ts`、`native-skill-epoch.ts`、`mcp-runtime.ts`、`tools/manifest.ts`、`tools/execution-bound.ts`、`runtime-budget.ts`、`approval-coordinator.ts`。
- 找出权限模式的持久化和实际执行链；不能只看 UI 或配置字段。

### T0.5 交付与 Gate
交付 `PHASE_0_BASELINE.md`：调用链图、真实文件路径/符号/行号、现有数据库表、Pi API 证据、测试基线、问题分级、重复机制、迁移建议、未知项。

**Gate 0：** 由独立审查 Agent 确认审计证据充分；产品负责人确认实施顺序。未通过不得进入 Phase 1。

## Phase 1 — Capability Protocol 最小实现

### T1.1 Contract 与 Schema
实现 Capability Definition、Provider Manifest、Binding、Conformance、Resolution 的类型和运行时 Schema 校验。

### T1.2 本地 Registry
建立最小 Registry Store，复用现有 SQLite/迁移体系；不复制 Tool Schema、Skill 正文或 MCP 凭据。

### T1.3 Native Adapter
先选一个低风险、已有稳定实现的核心能力试点（由 Phase 0 证据决定），将现有 Tool 包装为 Provider，不改变业务行为。

### T1.4 Resolver
实现硬约束过滤、Required/Optional/Conditional Conformance 和结构化 Resolution。第一版可不接 AI 排序，先保证确定性正确。

**Gate 1：** 原有工具回归通过；一个 Capability 可绑定两个 Provider；权限不足和 Required 缺失会被排除。

## Phase 2 — Provider Contract 与 Dispatcher

### T2.1 Adapter
将 Native Tool 通过 Adapter 接入；随后才考虑 MCP Adapter。统一输入/输出/错误/取消/副作用字段。

### T2.2 Dispatcher
保留核心明确 Tool；新增有限动态 Dispatcher。所有执行继续经过原 Execution Boundary。

### T2.3 Provider Snapshot
为 Task/Run 保存 Provider ID、版本、Contract 版本和 Registry Revision。

### T2.4 Dynamic Refresh
实现安全切换点刷新；撤销和权限撤销优先。按 Pi 锁定版本验证是否能同 Session 更新；不支持则安全重建 Session 并恢复原 Task。

**Gate 2：** 新 Provider 可在任务安全点被使用；旧 Provider 撤销后新调用被阻断；Session 不丢失 Task 上下文。

## Phase 3 — Autonomy & Permission

### T3.1 权限基线
梳理现有模式，形成 Permission Profile → Scope Grant → Execution Check 的实际映射。

### T3.2 完全授权
在明确授予的目录、命令、网络、依赖、MCP 和文件范围内免重复询问；超范围阻断并集中申请。

### T3.3 Approval
扩展现有 Approval Coordinator，支持 capability acquisition、dependency install、MCP、Extension、filesystem 和 external data 等申请；SQLite 持久化并绑定 request digest。

### T3.4 Revocation
实现撤销优先、活动执行阻断/取消和审批失效。

**Gate 3：** 完全授权范围内不重复弹窗；越权不能执行；重启后审批仍在；授权条件变化使相关审批失效。

## Phase 4 — Skill System

### T4.1 Personal Skill Creator
实现纯说明型 Skill Draft → 结构/隐私/依赖/权限检查 → 自动测试 → Personal Publish。

### T4.2 Versioning
不可变版本、内容哈希、激活版本、回滚和撤回。

### T4.3 Team Registry
每位教师最多属于一个团队；分享生成独立副本；管理员审批后发布。

### T4.4 Official Registry
建立官方审核元数据和发布流程；本轮不要求建设完整云端平台，先完成本地协议和接口边界。

**Gate 4：** 个人自动发布；团队未经管理员批准不可见/不可用；Skill 不能扩权；旧版本可回滚。

## Phase 5 — Marketplace / MCP / Extension / Environment

### T5.1 Marketplace Provider
用适配器聚合官方 MCP Registry、选定社区目录和 GitHub；先核实 API、条款和可用性。

### T5.2 Candidate Pipeline
候选 → 来源/许可证/哈希/依赖/权限检查 → 隔离验证 → 策略判断 → 安装/连接 → 功能验证 → Registry 注册。

### T5.3 MCP Adapter
复用现有 MCP Runtime；Schema 变化和权限变化触发重新审核；不能将 readOnlyHint 当安全证明。

### T5.4 Extension Isolation
外部 Extension 不进入 Electron 主进程；实现受控运行、日志、取消、版本、撤销和回滚。

### T5.5 Environment Manager
诊断依赖和非敏感配置；凭据通过安全存储和用户安全输入处理。

**Gate 5：** 可信候选按策略自动接入；未知来源隔离/审批；离线缓存有效；核心教育能力不依赖外部市场。

## Phase 6 — Task / Checkpoint / Recovery

### T6.1 Task State 复用
基于现有 task-state、goal-state、Event Journal 和 Artifact State 扩展，不另建平行任务系统。

### T6.2 Effect Ledger
实现 Intent → Executing → Commit/Reconcile；有副作用操作必须先持久化 Intent。

### T6.3 Startup Recovery
启动时恢复任务状态和只读诊断，生成工作台恢复卡片；不自动执行写操作。

### T6.4 Resume
教师点击继续后创建新 Run/Generation；恢复同一 Task；核验旧 Provider，不可用则 Resolver 选择兼容 Provider。

### T6.5 Approval Resume
审批跨重启保留；请求或授权变化失效；批准后重新核验再执行。

### T6.6 Failure Recovery
错误分类、副作用核验、替代 Provider、配置修复、任务续接、预算和停止条件。

**Gate 6：** 应用崩溃/重启测试不丢成果、不重复副作用；拒绝授权后寻找替代；旧 Run 无法覆盖新 Run。

## Phase 7 — 页面实现和独立页面验收

完成工作台、任务恢复、审批和能力中心的真实页面，贯通typed IPC、持久状态与失败恢复。GPT-6.1 Terra High对两种尺寸、键盘、关键状态及真实用户操作独立验收。

## Phase 8 — 最终集成和验收

- 运行所有单元、集成、E2E、类型检查、lint、构建和打包测试。
- 完成 `ACCEPTANCE_CRITERIA.md` 所有 P0/P1 项。
- 页面验收 Agent 使用 6.1 Terra High 检查工作台、审批、能力中心、恢复体验。
- 最终验收 Agent 独立检查代码证据和测试结果。
- 输出最终变更清单、迁移说明、回滚说明、已知限制和未完成项。

## 每个任务的完成定义

任务只有在以下条件全部满足时才可标记 ACCEPTED：
1. 目标和范围符合本任务书。
2. 修改有源码证据。
3. 测试真实执行且结果记录。
4. 相关回归测试通过。
5. 文档同步。
6. 风险和回滚说明齐全。
7. 独立审查通过。

## 停止规则

- 用户最新Goal指定Phase0至Phase8为固定范围。
- 不自行新增Phase9或扩大无关范围。
- Gate发现缺陷时先修复复验，再进入依赖阶段。仅真实外部阻塞时记录阻塞和替代任务，Goal状态遵循当前系统规则。
- 若存在不影响 P0/P1 的未完成项，记录 FOLLOW_UP，不扩大本轮。
- 全部完成定义满足后，输出最终报告并停止，不再继续扫描、优化或空转。
