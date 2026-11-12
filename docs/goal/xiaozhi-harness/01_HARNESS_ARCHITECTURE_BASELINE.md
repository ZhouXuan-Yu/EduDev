# 01 — Harness 总体架构基线

## 1. 产品定位

XiaoZhi 是面向教师的高度自主教育 Agent。教师表达目标和必要的关键决策；小智负责规划、发现能力、获取和配置能力、执行、核验、恢复并交付结果。教师不应被迫管理 Tool、Skill、MCP、依赖或内部状态。

## 2. 目标架构

```text
Teacher Workspace
       |
       v
Pi SDK (唯一 Agent Loop)
       |
       v
Autonomy Layer
  - Task Planner (复杂度自适应)
  - Capability Gap Detector
  - Skill Creator / Validator
  - Environment Manager
  - Recovery / Resume Coordinator
       |
       v
Capability Platform
  - Capability Registry
  - Capability Resolver
  - Discovery / Dependency / Health / Version
       |
       +--------------------+
       |                    |
       v                    v
Skill Registries       Capability Marketplace
Personal/Team/Official External catalogs + EduDev catalog
       |                    |
       +----------+---------+
                  v
          Provider System
       Native / MCP / Extension / Remote
                  |
                  v
      Permission & Execution Boundary
                  |
                  v
 Education Domain Capabilities / Local Data
```

## 3. 分层职责

### Pi Runtime
- 唯一负责模型推理、工具调用循环和消息上下文。
- 不承担市场抓取、安装器、任务数据库或权限真相。
- 不引入第二个 Planner/Recovery Agent Loop。

### Autonomy Layer
- 根据任务复杂度选择规划深度。
- 识别能力缺口。
- 请求 Resolver 和 Marketplace 提供结构化候选。
- 在权限允许范围内准备、验证、激活能力。
- 失败时诊断、重新规划和续接。

### Capability Platform
- 维护逻辑 Capability、Provider、Binding、Conformance、Revision。
- 解析某项能力的合格实现。
- 维护 Provider 健康、版本、撤销和表现记录。

### Marketplace
- 聚合官方 MCP Registry、可信社区目录、GitHub 等发现源。
- EduDev 自有目录负责审核状态、推荐、兼容性、缓存和分发。
- 搜索结果永远是候选，不直接进入生产执行。

### Permission & Execution Boundary
- 权限唯一权威。
- 验证每次实际执行的授权范围、资源、主体和撤销状态。
- 承担超时、取消、幂等、审计和副作用核对。

### Provider System
- Native / MCP / Extension / Remote Adapter 将不同实现转换成统一 Provider Contract。
- Provider 声明权限需求，不能自行授予权限。

## 4. 核心对象关系

- Capability：逻辑能力及其 Contract。
- Provider：实际实现一个或多个 Capability 的运行单元。
- Binding：Provider 与 Capability 的经验证映射。
- Skill：说明如何完成任务的版本化知识包，声明 Capability 依赖。
- Tool：Pi 可调用的执行接口；可以是核心业务 Tool 或动态 Dispatcher。
- MCP Server：外部协议服务，一个 Server 可提供多个 Tool。
- Extension：扩展 Pi Runtime 的受控代码包。
- Environment：运行依赖、配置、密钥引用和系统条件。

## 5. Tool 装配策略（H-23）

- 高频核心教育业务保留明确、可发现的 Tool Definition。
- 动态外部能力经有限的 Bootstrap / Dispatcher 入口调用。
- 两者共享 Capability Registry、Permission Engine、Execution Boundary、审计和结果协议。
- 不把所有业务 Tool 塞进一个万能 execute；也不为每个外部 Provider 永久增加一套 Pi Tool。

## 6. 任务规划（H-16）

- 简单任务：轻量能力检查后执行。
- 中等任务：列出关键步骤和依赖。
- 复杂任务：预先分解步骤、检查能力/权限/依赖、规划交付和恢复点。
- 执行中根据真实结果动态调整计划。
- 风险级别与规划深度分离：短任务也可能需要高风险门禁。

## 7. Local-first 和同步

- 本地 Registry 是实际运行状态权威。
- 官方目录提供签名定义、版本和撤销信息。
- 外部市场提供候选元数据。
- 同步不能覆盖本地授权、Provider 运行状态和用户偏好。
- 离线时使用最后一次验证且未过期/未撤销的缓存；涉及新外部接入时可标记待联网验证。

## 8. 迁移原则

先审计当前 HEAD。优先 Adapter 方式接入现有 `education-tool-catalog`、`managed-skills`、`mcp-runtime`、`tools/manifest`、`execution-bound`、`tasks/task-state`、`events/journal`、`session-state`、Office Artifact State。不得为了符合目录建议而重写已有可靠状态机。
