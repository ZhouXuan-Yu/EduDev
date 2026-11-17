# Phase6 状态底座测试交付

2026-11-18。SOURCE_DONE / TEST_LEAF_FROZEN。测试根D:/WorkProject/EduProject-harness，仅新增两份phase6-state脚本。

## 命令与最终结果

```powershell
cd D:/WorkProject/EduProject-harness/apps/desktop
D:/Node/node.exe scripts/xiaozhi-agent/phase6-state-foundation-smoke.mjs
```

固定8/8通过，各检查耗时合计1684.77ms。最终报告C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-state-dcaa9y/report.json，SHA256 33649a6a9d26cdbacc8166ff15cbdf1011e1d871962a68da8aafad643fdb3c0b。两脚本node --check通过，git diff --check返回0。9份被测生产源与测试开始时SHA逐一比较，sourceDrift为空。

| 新脚本，相对apps/desktop/scripts/xiaozhi-agent | SHA256 |
| --- | --- |
| phase6-state-foundation-worker.mjs | 8449ae5d16f86871fee2a5bace6d72233b98effa0e7c3cfdeb3bafe8497bf77a |
| phase6-state-foundation-smoke.mjs | beed52139cd518a0b689f427bdbb8ed16634dd2d60dd4ac49a773403c0699956 |

同目录SOURCE_MANIFEST.json保存脚本字节数、被测Effect/Journal/Task/checkpoint源SHA、报告SHA及实际crash终态。

## 实际覆盖

复用原register-source、Node SQLite及coordinator fixture表。每个正向Effect都先走原coordinator.start、Task.propose、ToolStart、Task.admit、Journal.admitTool、recordToolContract。Effect Authority取自实际Journal owner及Task绑定，ToolContract为可信合成fixture，沿真实admitted receipt写入。合成副作用由owned文件的真实fs写入承担，readEffect只读精确文件hash。

| 实际SIGKILL切点 | 独立连接读到的持久Effect | 首次恢复后Effect | 物理效果计数 | 第二冷开 |
| --- | --- | --- | --- | --- |
| Intent提交后 | intent | unknown | 0 | snapshot hash相同，readback0，效果0 |
| Executing及execution绑定提交后 | executing | unknown | 0 | snapshot hash相同，readback0，效果0 |
| owned文件成功、Commit前 | executing | committed，精确readback | 1 | snapshot hash相同，readback0，效果1 |
| ToolEnd与Task checkpoint提交后 | committed | committed | 1 | snapshot hash相同，readback0，效果1 |

四个子进程均由父进程收到boundary_committed后，用独立readOnly SQLite连接核对真实行，再发送SIGKILL。实际close均code=null/signal=SIGKILL。各case目录保留SQLite、identity.json、boundary-snapshot.json、reopened-before-recovery.json、recovery-committed.json、stdout/stderr、真实产物及计数文件。恢复后Task保持原ID/requirements/steps，状态interrupted；checkpoint引用精确Effect revision/state，Journal task event与checkpoint cursor一致，owner清空Run并递增generation。recovery公开数据automaticReplay=false。

余下四项分别验证以下行为。

- 原Journal.recover的outbox INSERT故障，Effect、Task、immutable checkpoint/history、Journal/outbox、owner整个事务回滚。显式原API重试后实际文件效果仍为1。
- 原publisher.checkpointTask的outbox故障，Task/checkpoint/history及公开事件回滚。保留publisher永久失败gate，沿原journal.changeTask显式重试成功。
- 同key同digest返回原Effect且created=false，同key改digest及receipt contract改digest拒绝。两个并发CAS只有一个胜出，旧revision的execution更新拒绝。
- 新Run/Task真实建立后，旧Run及跨Task请求拒绝，旧Task revision拒绝，所有负例的DB snapshot及物理效果计数保持一致。

## 原失败保留

首轮C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-state-GnI46J/report.json为4/8。四个child切点和SIGKILL已实际执行，但初始只读快照比较把Node SQLite null-prototype row与JSON plain-object的原型差异当成内容差异，尚未进入对应recover。另四项当轮通过。

唯一修复在测试端，将snapshot中的每行展开为plain-object，随后同固定8项集中复验通过。首报告、DB、边界快照和stderr全部保留。生产修复数量0。

## 交付边界

这是原状态API与真实SQLite/owned文件/Node进程切点证据。完整Pi调度、Provider/Grant授权、Job/controller、native helper、应用重启、Electron交互、预算持久化及外部loopback回执仍由core/root后续验收，当前这些边界为NOT_RUN。合成合同没有承担真实Registry/provider与Permission审批证明。

Commit前的真实副作用选择owned文件路径，loopback服务分支为NOT_RUN。第二冷开明确验证原状态恢复不会重新发送业务IO。测试不关闭完整T条目。

root持有Git整合，本测试leaf回滚范围为这两份新增脚本。owned证据目录继续保留。该任务未占native runtime窗口，模型调用和真实key访问均为0。
