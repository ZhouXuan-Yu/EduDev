# 小智 Harness D1 实施报告

实施日期为 2026-11-22。基线为 `11b29d47df1f0e853acce7ebee4faea12b8fc09d`，实施在现有 Harness 分支 `codex/harness-phase8-tail-evidence-20261121`。代码提交以本文件同批提交和验收目录的 `git-delivery.json` 为准。

## 核对和改造

| 阶段 | 基线及变更 |
| --- | --- |
| 基线审查 | 读取工作区的 README、AGENTS、Master Goal、状态页、目录和 D1 合同。核对原 SQLite Registry、版本档案、Provider Snapshot、Native、Managed MCP 和扩展从宿主到工具的调用路径。保留日常工作树的协作者改动。 |
| 合同和对象 | 复用 `CapabilityDefinition`、`CapabilityBinding`、`ProviderExecutionContext` 和 `CapabilityExecutionResult`。声明可以单独注册并验证，运行状态和实例引用独立管理。 |
| Provider 和 Binding | 单个 Provider 可挂多条独立 Binding，同一 Capability 可使用多个 Provider。启用、停用和撤销按配对生效。升级后仅发布重新核验过的边，已确认的历史版本及来源保留。 |
| Adapter 合同和 Registry | 宿主管理 ID、版本、来源、合同、生命周期和执行。稳定的 Provider 执行合同继续承载任务、运行归属、精确快照、授权引用、幂等和取消。 |
| Core 兼容 | Native 和 Managed MCP 在生产 `capability_execute` 接入统一边界，继续用原 Resolver、制品验证和许可租约。命名工具受同一默认实例状态约束。 |
| Community 兼容 | 复用已有本地扩展导入和安装，核对来源、包完整性、许可证和 Node 依赖。公开合成输入在实际隔离运行中逐个核验钩子。旧安装在原授权下补证。 |
| 隔离和权限 | 宿主计算 T0–T3。开发者权限上限先于用户授权。T2 走现有 Windows AppContainer、Job 和受控文件投影。拒绝以现有权限审计存储追踪。 |
| 迁移和回归 | 同库增量建立实例、Binding 控制表，保留原目录和任务状态。验证真实旧库、空库、重复迁移、损坏、正式构建和现有用户路径。 |

## 修改范围

| 目录 | 文件 |
| --- | --- |
| `capabilities/adapters/` | 新增 `contract.ts`、`core.ts`、`lifecycle.ts`、`registry.ts`、`security.ts` |
| `capabilities/` | 新增 `bindings.ts` 和 `provider-instances.ts`。修改 `types.ts`、`registry.ts`、`resolver.ts`、`provider-contract.ts`、`provider-snapshots.ts`、`runtime.ts`、`core-governance.ts`、`acquisition/managed-mcp.ts` 和三个生成清单 |
| 生产装配及 `extensions/` | 修改 `production-host.ts`、`host.ts`、`registry.ts`、`service.ts`，新增 `conformance.ts` |
| `apps/desktop/scripts/` | 新增 D1 SQLite/Adapter 专项，扩展真实社区扩展复验，更新原 Phase 2 快照夹具和通用桌面验收目录选项 |
| 项目文档 | 更新架构、状态和验收入口、协作记录。补充社区扩展页的来源调研及单独交付边界 |

## 运行及回退

启动迁移无需手工 SQL。迁移应先在应用正式备份的副本上验证。回退使用升级前的备份副本并保留新版数据目录。本轮未覆盖日常运行目录，也未用真实教师数据或付费模型请求做验收。

Windows AppContainer 的实际运行记录与 T1/T3 的模型验证见自检报告。多实例管理提供可信主进程接口。界面仍使用默认实例和原有管理入口。社区下载页为独立切片。 [完整架构](../../architecture/HARNESS_D1.md) · [社区扩展页设计](../../architecture/COMMUNITY_CATALOG_DESIGN.md) · [逐项自检](D1_SELF_CHECK.md)
