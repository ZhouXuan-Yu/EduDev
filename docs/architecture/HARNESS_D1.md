# 小智 Harness D1 实施合同

## 基线 11b29d4

M10 底座由 `createXiaozhiSessionState` 通过原串行 Sql 初始化 `xiaozhi_capability_registry_v1` 和 `xiaozhi_capability_provider_versions_v1`，旧任务使用另有归属校验的 Provider Snapshot。Capability 具备稳定标识、版本、Schema 引用、限制和幂等及取消语义。Registry 文档允许独立的能力与 Provider 配对，并逐配对归档；但 Provider 替换会让现有其他配对继续携带旧版本。ProviderManifest 同时保存声明和运行状态。Binding 已有符合性证据和启用位，缺独立管理入口。

生产 Pi 从 `production-host` 装配原 `capability_execute`，沿现有 Task Runtime、Resolver、Provider Snapshot 调用 Native 或 Managed MCP。Native 使用已审制品和工作区授权，Managed MCP 使用真实工具探针和现有权限租约。扩展另有隔离包验证、RPC、许可与 AppContainer，在 `extension_invoke` 中派发。日常命名工具仍走原 Tool Governance 和 Effect。沿这些入口加接入合同，保留原权限、绑定快照、恢复以及命名工具边界。

## 范围和验收

- 保留一个 Capability Registry。以原 ProviderManifest 作可兼容的持久表示，从同一记录导出 Definition。独立 Instance 写入同一数据库的增量表，旧默认实例延续现有执行路径，额外实例隔离配置引用、连接引用和状态。关键状态变动提升现有 Registry 版本。
- 保留旧 Binding 与逐边版本档案。独立核验合同与符合性，维护边的停用、撤销和重验。版本升级仅发布已验证边，继续保留已封存的旧版本与原任务身份。
- Adapter 在宿主注册并执行，统一使用原 Provider 请求、结果和快照语义。核心使用原 Native 和 Managed MCP，实现外部代码使用原有包验证与 AppContainer。T1 描述受控独立进程，T2 声明实际隔离能力，缺少验证的宿主环境不降级执行。有界生命周期需要验证非法迁移、停止、撤销、卸载和重启诊断。
- 生产入口走真实 SQLite、Native、受控 Managed MCP 和真实测试扩展。迁移运行于旧数据副本和新数据，不改任务、事件、授权表，不回放副作用。老师从原小智界面及扩展入口使用，现有 preload/IPC 和教师审批语义维持原行为。
- 交付需通过 D1-001 至 D1-017 自检，包括真正多对多、同定义不同实例、独立阻断、升级重验、受控扩展运行、越权拒绝及原生产路径。较早的应用继续读取原 v1 数据，直接降级前应备份并确认 D1 管理状态与旧程序边界，保留原任务和资料。不实施 D2、D3、Marketplace 或任意第三方沙箱后端。

## 生产装配

| 对象 | 主进程入口 | 持久事实 |
| --- | --- | --- |
| Capability | 原稳定 ID、版本、输入输出 Schema 引用、保证、限制、幂等和取消约定 | 原 `xiaozhi_capability_registry_v1` |
| Provider Definition | `registerProviderDefinition` 独立注册声明，`providerDefinitions` 查询 | 原清单保留 v1 格式并投影定义，逐版本档案保留摘要 |
| Provider Instance | `putProviderInstance` 按实例 revision 比较并写入，`providerInstances` 查询 | 新增 `xiaozhi_capability_provider_instances_v1`，只存不透明引用和状态 |
| Binding | `registerBinding`、`verifyBinding`、`setBindingState` 和 `executionBinding` | 原配对和逐版本档案，新增 `xiaozhi_capability_binding_controls_v1` |
| Adapter | 一个 Host 内的 Adapter Registry 管理版本、兼容性和生命周期。可信宿主注入通道，使用原 Provider 请求、结果和快照 | Core 来源于发行版本。Community 验证事实复用原包状态、选择记录及逐钩子 Binding 证据 |

生产 Pi 先用现有 Resolver 和任务快照确定精确版本。统一 Adapter 执行边界核对开发者权限上限和来源，再经原宿主授权、输入校验、接入、执行、输出校验和清理。任务终止与 Adapter 停用使用同一调用信号。普通命名工具继续走原 Tool Governance 和 Effect，受同一默认实例状态约束。

Provider 更新后，旧 Binding 保留在版本档案。新版本只发布已针对该版本登记的边。旧任务仅在相同配对当前仍启用、旧版本已验证且可执行时使用原制品。被撤销的配对和实例保留撤销记录。新增实例可以由受信宿主管理和核验，生产 Pi 继续使用兼容默认实例。

Community Adapter 使用原 Windows AppContainer、Job 对象和宿主权限代理。激活前逐个执行合成公开钩子，坏钩子单独标记不兼容。旧安装首次调用时在原运行授权下补证。选定制品再次启动前重核对哈希、许可证及依赖，输出始终作为不可信资料。第三方扩展 ID 和 Adapter ID 跨版本连续，既有 Provider 快照仍定位到精确制品的 Provider ID。更新与回退各自保留版本证据。

| 隔离等级 | 宿主行为 |
| --- | --- |
| T0 | 审核过的 Core Native 通过宿主管理文件范围和调用授权 |
| T1 | 独立进程或 Worker 的策略模型。本轮没有通用 Worker 启动器 |
| T2 | Windows 现有 AppContainer、Job、经核验的只读文件投影及网络拒绝。当前适用于受控 Managed MCP 和 Community RPC |
| T3 | 不满足宿主隔离条件时拒绝激活。不提供其他平台的第三方执行降级 |

## 迁移与恢复

启动在同一 SQLite 事务内增量创建两张表并回填缺失的原版本档案。读取校验原目录和新增实例校验和。重复启动保留旧目录、快照、任务和现有版本记录。旧版数据库没有实例记录时，原 Provider 的状态作为默认实例读取，不产生第二份 Provider 声明。

部署前沿用正式备份创建可验证副本。如果需要回退，优先用回退入口让旧版打开升级前的备份副本，保留新版数据目录用于诊断。旧进程无法应用新增的逐配对控制或实例状态，回退时不能直接让旧版接管使用了 D1 管理功能的库。失效制品和删除需求沿原归档及备份路径处理。

[实施记录](../goal/xiaozhi-harness/D1_IMPLEMENTATION.md) · [验收自检](../goal/xiaozhi-harness/D1_SELF_CHECK.md)
