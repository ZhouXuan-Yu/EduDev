# R11 — 取消、重试、再生成与分支

本轮完成第一条可运行的持久 lineage 切片：

- 每个 DeepTutor request 在本地 SQLite 保存私有快照，renderer 只通过 typed preload 触发变更，不读取快照正文。
- `retry` 只允许 failed/blocked/cancelled 源运行；成功运行必须使用 `branch` 或 `regenerate`。
- 子运行写入 `parent_run_id`，action 表以 `(source_run_id, action, idempotency_key)` 唯一约束防止重复执行。
- branch/retry/regenerate 都复用同一 sidecar AgentLoop 和宿主工具边界，不直接复制业务写入。

验收命令：

`npm run test:deeptutor-r11-lineage`

结果：12/12 通过。覆盖分支并发幂等、parent lineage、成功源 retry 拒绝、blocked 源 retry 成功、重复 retry readback、close/reopen 后 lineage 保留。

生产边界：取消与 sidecar 断线恢复已有独立首片，但 R11 仍未完成多设备分支冲突、真实 provider 质量、复杂写工具事务回滚和完整对话 UI 结果合并。
