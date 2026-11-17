# Gate4 首轮实际运行

结论 **REJECTED**，具体 finding 为 G4-F03，限新增无原生 transaction 的旧 Sql fallback 兼容路径。

受审候选为 history-k1ea5k，37 source/466 out 独立 hash 核对零差异。原生 OmniEduStore 的独立事务连接路径在此探针中没有发生失败，不能把本结果泛化到所有 SQLite 调用。

## 独立精确命令

cwd 为 `D:/WorkProject/EduProject-harness/apps/desktop`。

```powershell
node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate4-review-3625f274df9a45888c3f1953ea5fe083/sql-fallback-probe.mjs
```

实际 exit 1，3/4 通过。

- 旧形态事务的 callback work 嵌套模块操作及竞争 writer 串行通过。
- throw 回滚和后续排队写入可用通过。
- 原生 transaction 优先委派通过。
- 外部治理 view 隔离失败，暴露了稍后回滚的 Skill。

## G4-F03 · P1

`serialized-state-sql.ts` 第 14 行 all 直接调用 source.all。第 19–25 行新 fallback 在同一 source 连接上 BEGIN/COMMIT/ROLLBACK。

探针使用真实 Node SQLite、该原 wrapper、实际 createSkillGovernanceState 与 createSkillGovernance.view。包管理 API 在此纯元数据场景没有调用。合法唯一 users.owner 已写入自有 TEMP 数据库。

事务在保存 skill_owned_pending 后暂停，外部独立异步链调用 service.view，在事务释放前返回该 Skill。随后事务抛错并真实 ROLLBACK，下一次 view 为空。

```json
{
  "readBeforeRelease": true,
  "visibleIds": ["skill_owned_pending"],
  "afterRollbackIds": []
}
```

此结果证明外部业务 view 可以看见半提交/回滚脏事实。最小修复应在 fallback 下使事务外读取等待当前事务，保留 callback work 的同连接读取与内部闭包读取，避免排队等待自身。实际现有 Team review 会在 service.transaction 中调用闭包绑定的 officialReviewers，应一并保持可用。原生 transaction 优先和旧无 transaction 调用者形态继续兼容。

按 root 指令，其余五套固定专项尚未运行。修后先重跑同一探针，再核最终 source/out 并执行原固定专项。

## 原始证据

实际 root 为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate4-sql-fallback-kNB5fU`，含真实 authority.sqlite 和 report.json。探针、报告、日志和受审源码副本位于本目录 `sql-fallback-first-failure`。

受审 serialized-state-sql.ts SHA256 为 `f6402946698923a6e3f48ff0cb1ccfb19b5bc30e8758af662774d8f16a60390c`。完整原 36、37 文件清单和所有候选前证据均保留。本轮生产写入、build、付费和真实模型调用为 0。
