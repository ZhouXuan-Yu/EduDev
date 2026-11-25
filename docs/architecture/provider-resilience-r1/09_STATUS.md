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
| 01 故障语义 | 部分完成 | 原 MCP 异常与模型 HTTP 白名单消费 `provider-fault-policy.ts`。固定矩阵与混合反例通过 AC-01，AC-02 的实际工具、调度和权限计量仍需验证。 |
| 02 MCP 信任 | 部分完成 | AC-03 和 AC-05 通过。直接 HTTP、直接受控 stdio、Managed stdio 在实际传输结束后可以重新核验原信任与工具选择。AC-04 的包、实例、权限和驻留全路径待补。 |
| 03 熔断 | 部分完成 | AC-06、AC-07 通过。MCP 和 Pi 模型请求共用宿主健康协调。AC-08 已覆盖实际 Electron 冷启、凭证隔离和生产唤醒回调注入。还需 Windows 系统真实挂起与恢复和完整矩阵。 |
| 04 实际预算 | 部分完成 | AC-09、AC-10 通过。原 Pi 补发由同一 owner 处理，健康拦截零扣减，实际发送和持久化预算一致。AC-11 已禁止旧读取未结束时启动同一读取。跨 Pi、工具、Provider 与业务的总物理预算及原调度租约对账待补。 |
| 05 兼容接续 | 已验证完成 | AC-12 至 AC-14 通过。原生 stat 在旧实现不可用且本次未发出时，在原任务安全点运行兼容读取。拒绝矩阵均为零替代调用，并带可继续入口。正式桌面在真正冷启后沿用原合格快照。 |
| 06 Effect 与版本 | 已验证完成 | AC-15 至 AC-17 通过。Windows 宿主、真实文件、网络和终端验证了派发与版本屏障。已确认原题卷从真实 PDF 打印故障恢复，只补齐缺失输出。SQLite 中原教师确认、Word 历史和新 PDF 回执均已读回。 |
| 07 worker | 部分完成 | AC-18 和 AC-21 在 Provider 构建通过。AC-19 和 AC-20 在资源调度 R1 依赖构建通过。已验证真实 OCR 同一任务续页、落盘与租约，向量游标和原生 embedding 超时降级，以及 PDF 取消时原窗口持有租约、前台继续工作、晚回执不写入、重新授权后导出成功。完整组合和各类十轮循环待验。 |
| 08 桌面恢复 | 部分完成 | `tasks/startup-recovery.ts` 已有原任务冷启动读回，`phase6-startup-recovery-smoke.mjs` 是候选入口。网络和原生 suspend/resume、截止时间的组合待验。 |
| 09 固定修复 | 部分完成 | `environment/service.ts` 提供现有受权 recipe。只用合成目录核对 hash、拒绝危险修复与代表能力读回。 |
| 10 Goal | 部分完成 | `goal-coordinator.ts` 与 `goal-progress.ts` 保留教师验收和证据推进。等健康等待接入后验原任务预算及真实模型计数。 |
| 11 诊断 | 部分完成 | `diagnostics/report.ts` 有现有有界导出基础。四类状态、实际 IPC 和隐私 canary 待补。 |
| 12 集成 | 待核验 | 按 05 分离模块、真实组合和最终 main，真实模型评测先按 AC-34 判断适用性。 |

当前状态为实施中，必需验收模块阶段 17/36。WP-01 累计 5/8，WP-02 累计 4/8，WP-03 累计 7/8。WP-04 累计 8/8，负责的 AC-12 至 AC-17 全部通过。WP-05 累计 5/8，AC-18 和 AC-21 已通过，AC-19、AC-20 的依赖模块验证通过。WP-06 至 WP-08 尚未开始实现，集成候选 0/3。本轮接入资源调度 R1 的 PDF 租约与原 Office 版本校验，无表结构迁移，真实付费请求为 0。

下一步为 WP-05 的 AC-22。复用 AC-18 至 AC-21 的真实测试入口，按 owner 各执行十轮并记录 PID、世代或 nonce、退出证明，以及 listener、lease 和临时项的回落。加入无法结束的受控实例，核对同 key 禁止复用、其它任务可用和关停后恢复入口。AC-19、AC-20 在正式 Provider 组合重跑。AC-02、AC-04 可独立补验，AC-11 与 AC-08 的其余边界维持原合同。
