# R10 — AgentLoop 事件预算与硬终止

## 本轮交付范围

- Electron main 对每个 DeepTutor turn 归一化 `maxEvents` 到 `1..256`，并只接受不超过预算的 sidecar 事件。
- Python sidecar 的 `TurnState` 同样持有 `max_events`；在写出下一事件前触发同一 `budget_exhausted` terminal event 并停止 AgentLoop，避免取消消息延迟时继续运行。
- 超限时写入 `guardrail` 事件，`terminationReason=budget_exhausted`、`hardStop=true`；在 continuation 次数未达上限时以 `blocked` 结算本地 run，发放一次性 continuation token，取消 sidecar 并清理内存 binding。
- UI 收到合成 `done` 事件；binding 删除后，sidecar 晚到事件被忽略，不得复活或修改已结算 run。

## 对抗验收

`npm run test:deeptutor-r10-budget`

结果：31/31 通过。覆盖零值预算归一化、真实 Electron/SQLite 运行、blocked 终态、guardrail 可观察、一次性 continuation token、子 run 成功结算、parent lineage、预算增加必须审批、审批并发单赢家、重复/过期 token 拒绝、checkpoint 状态脱敏、三代 settlement 链和硬终止上限。

`npm run test:deeptutor-bridge`

结果：sidecar bridge 对抗通过，并额外覆盖 `maxEvents=1` 的 sidecar 自身 `budget_exhausted` terminal event。

## 边界

本切片完成宿主/sidecar 事件预算、最多三代受限续写、追加预算审批 checkpoint、parent lineage、过期/单次消费与 renderer checkpoint 脱敏，并提供真实 UI 继续入口；仍未完成 token/费用预算和真实 provider 长输出恢复，不得将本切片描述为完整 R10。
