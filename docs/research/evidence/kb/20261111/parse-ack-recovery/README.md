# 已关闭的后台解析回执卡住缺陷

2026-11-11，基线7f3a6e6ba041e6264e755a43371b62083793263d。

## 修复前的实际失败

生产MaterialParseQueue完成本地ingest后，最终任务读取或完成状态CAS若抛出临时SQL错误，外层会吞异常并移除active登记。SQLite仍保存当前活进程拥有的running，pump只取pending，启动恢复只认死进程，应用内永久卡住。

before.log在完成ACK注入一次SQLITE_BUSY，实际SQLite资源已ready、内容提交1次，任务仍running，断言失败。

## 生产修复

MaterialParseQueue增加自身未追踪租约恢复。SQL先按schema、running、当前pid及实例nonce过滤，再LIMIT100。逐条重新验证payload与所有权，active中的执行者跳过，其余以原不可变payload CAS转pending/interrupted。重新进入原ingest，由MaterialRepository/MaterialPdfRepository重新校验原件并按原规则复用完成结果。其他实例、活动解析和取消操作仍由原lease/CAS保护。

正常pump按单调performance时钟每500ms至多扫描一次，关闭等待执行者退出后强制归还一次。原500ms心跳、并发槽位、SQLite任务格式、来源版本及界面通道沿用。无新依赖、DDL、IPC或模型调用。

修改文件为src/main/assets/material-parse-queue.ts、scripts/education/material-queue-ack-recovery.mjs及原队列fixture的测试导出。

## 针对性验证

从D:/WorkProject/EduProject-kb-isolation/apps/desktop执行。

| 命令 | 结果 |
| --- | --- |
| `node --experimental-transform-types scripts/education/material-queue-ack-recovery.mjs`，修复前 | exit1，一次ACK失败后资源ready、任务running，before.log。 |
| 同上，修复后 | exit0，9组定向及24组原队列相关回归，after.log。 |
| `node node_modules/typescript/bin/tsc --noEmit` | exit0，无诊断。 |
| `npm audit --json` | exit1，存量28项，8 high/12 moderate/8 low/0 critical，audit-summary.json。依赖与锁文件无改动。 |
| `git diff --check`及暂存区检查 | exit0。 |

定向覆盖最终ACK、最终读取、活动租约不变、101个同pid不同nonce的其他实例租约、取消优先、原件版本变化、关闭/同进程重启、后续文件推进及持续错误节流。正常恢复的资源只提交1次，完成ACK可重试并恢复succeeded，取消和原件变化按原规则终止。

验证使用生产队列与真实SQLite，ingest及瞬时SQL故障为受控注入。实际OCR、真实几十GB目录及Electron界面本轮保持未验证，原件验证/完成结果复用依据现有生产ingest代码。本轮关闭的是此任务生命周期缺陷。

## 成本与回滚

修复前一次ACK失败会持续running并占据错误状态。修复后由既有心跳恢复，新增扫描每500ms至多一次、每次最多100条，仅查running及本实例owner，既有ai_tasks状态索引可用于筛选。正常任务完成不会因高文件吞吐逐文件新增恢复查询。持续ACK故障的定向案例在1100ms观察内最多4次ingest入口尝试、内容只提交1次，验证没有快速自激重试。

存储持续不可用时恢复等待数据库可用。实际大库吞吐/P95、磁盘耗尽的完整应用恢复仍需按原目标推进。

正常revert本轮代码并重建即可回滚，原任务与原始资料无需迁移。回滚会恢复旧的活进程ACK卡住行为。完整Goal保持ACTIVE。
