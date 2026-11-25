# Provider 健康管理与自主故障恢复 R1

## 现场基线与合同

- 实际远端 `main` 和隔离工作树的起点为 `9b192954e3d64e7d00fe15382a2db34f8351d0cc`。已包含 DB R2 及 DB R3 的普通配置和模型目录提交。工程包的 `0dc86d8` 作为设计审计参考。
- 本专项分支 `codex/xiaozhi-provider-resilience-r1`，工作树 `D:/WorkProject/EduProject-provider-resilience-r1`。原日常工作树为 detached HEAD 且含其他任务的改动，未使用该目录修改代码。现场没有检出承载本专项的旧分支。
- 规格原件为用户提供的 `D:/WorkProject/EduProject/docs/第二阶段/底座优化/Xiaozhi_Provider_Resilience_R1_20261125`。原 `05_ACCEPTANCE_CRITERIA.md` SHA-256 为 `50b0c774e3f2ca0c36ec795c9f71a0d38be969f3e5ec739f73b9820b525db5ef`。静态包校验确认 12 REQ、8 WP、36 AC 与 22 个故障夹具，不作为产品证据。保留原重试上限、Retry-After 和固定验收门槛。
- Windows `10.0.26300`、Node `24.12.0`、npm `11.6.2`。证据根 `D:/WorkProject/EduProject/acceptance/provider-resilience-r1`。首次 HTTP 复现使用独占 loopback 服务、临时 SQLite、合成工具元数据。组合构建、正式 Electron 数据根、原生组件与真实 CI 保护待实测。主线树未见 `.github` 文件，这项观察不足以确认远端规则集或串行集成安排。

## 依赖和所有权

| 模块 | 现场版本及接续方式 |
| --- | --- |
| Host Resource Scheduling R1 | `codex/host-resource-scheduling-r1` 截止 `ed618c1` 保存了实际 lease、OCR/PDF 工作者退出和材料队列接线，原 36 项当前 8 项通过。其成果未进入当前 main。消费原实现须在独立组合候选明确版本，Provider 首轮 MCP 合同可独立验证。 |
| 数据库 R2/R3 | `0dc86d8` 和 `9b19295` 已包含在实际 main。保留 `prepared-agent-config.ts` 及普通配置事务。可读取原 R2/R3 固定证据根，组合前须复验本专项使用的 SQLite 路径。 |
| Agent Experience R1 / D1 / D3 | 使用 main 的 Pi、现有 Provider Instance、Binding、Snapshot、Task、Effect 与 Goal，交叉合同沿 07 再确认；D3 保留其原分支与业务状态。 |
| UI / 记忆 / 知识库 | 独立工作树并行。当前切片仅主进程 MCP 运行时和测试，无共享业务或界面改动。后续按 07 确认可消费版本。 |

## 逐项现状审计

下表是 `9b19295` 源码和调用入口审计。未运行的现有入口不计为 PASS。

| REQ | 分类 | 实际锚点、保留边界和下一项验证 |
| --- | --- | --- |
| 01 故障语义 | 部分完成 | `mcp-runtime.ts` 的 `safeError` 与运行失败码、`model-request-recovery.ts` 的特定状态支持分流。接入固定 fault matrix 的统一宿主判定，区分实际网络失败、输入和未知效果。 |
| 02 MCP 信任 | 部分完成 | 已修复直接 HTTP 临时失效清空信任和 Managed MCP 拦在握手前的问题。真实 SQLite、HTTP 与 Windows AppContainer 分别证实原信任保留、授权下重验及部分撤权屏障。旧记录和各类并发失效仍待完整验收。 |
| 03 熔断 | 尚未实现 | `capabilities/provider-instances.ts` 的运行可用状态已在 Resolver 中消费。首批执行边界缺共享故障域熔断和单探针的组合证据。 |
| 04 实际预算 | 部分完成 | `model-request-recovery.ts` 持有原 HTTP 白名单及最多三次；`pi-session.ts` 接现有执行边界。用 `request-recovery-electron.mjs` 核对真实请求序列及预算是否叠加。 |
| 05 兼容接续 | 部分完成 | `capabilities/runtime.ts` 和 `resolver.ts` 管理原快照恢复及安全刷新。后续只在原安全点验证合格替代与拒绝原因。 |
| 06 Effect 与版本 | 部分完成 | `effects/reconcile.ts`、`tasks/recovery-inspection.ts` 已处理未决状态。沿真实文件、既有回执和 dispatch 屏障检查受控恢复。 |
| 07 worker | 部分完成 | 当前主线有 `local-utility-host.ts`、`ocr-host.ts`、`vector-host.ts`、`embedding-client.ts` 和私有打印 owner。R1 分支 lease 未合入，组合单独核验。 |
| 08 桌面恢复 | 部分完成 | `tasks/startup-recovery.ts` 已有原任务冷启动读回，`phase6-startup-recovery-smoke.mjs` 是候选入口。网络和原生 suspend/resume、截止时间的组合待验。 |
| 09 固定修复 | 部分完成 | `environment/service.ts` 提供现有受权 recipe。只用合成目录核对 hash、拒绝危险修复与代表能力读回。 |
| 10 Goal | 部分完成 | `goal-coordinator.ts` 与 `goal-progress.ts` 保留教师验收和证据推进。等健康等待接入后验原任务预算及真实模型计数。 |
| 11 诊断 | 部分完成 | `diagnostics/report.ts` 有现有有界导出基础。四类状态、实际 IPC 和隐私 canary 待补。 |
| 12 集成 | 待核验 | 按 05 分离模块、真实组合和最终 main，真实模型评测先按 AC-34 判断适用性。 |

当前状态为实施中。WP-02 累计 2/8 轮。第一轮修复直接 HTTP，第二轮在 `171ecfd` 复现 Managed MCP 握手次数为 0 的故障，再运行真实 Windows 测试修复。恢复仅在既有 Resolver 选定兼容且已授权的绑定后尝试，只准备目标 MCP。每个当前 adapter 复用进行中的恢复，并等待旧 Job 处置。验证的真实付费请求为 0。WP-01 与 WP-03–08 未进入实施验证，集成候选 0/3。使用原 SQLite 设置行，无数据迁移。

下一步用实际 SQLite 并发屏障覆盖旧握手中的撤销、删除、更新和无信任旧行，再补 ACTIVE stdio 元数据失败与直接 stdio 真进程路径。随后按 WP-01 固定 fault matrix 建立统一故障语义。跨 owner 的共享单探针、熔断和调度租约按后续工作包验证。
