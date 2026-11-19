# Provider 失效的执行准入修复

2026-11-19，源码基线 `4abe0658c58f09b0e484b58acc8112855643bdbd`。本轮修改4个纵向链生产文件和1个必要回归脚本。源码已冻结，writer释放。没有out、generated、打包文件、Git或付费模型写入/调用。

## 冻结合同与实现

可预期的当前Provider撤销/不可用，以及当前MCP身份与已注册来源不一致，由core-governance中的明确检查抛出既有 `TaskAdmissionError`，保留原reason `capability_revoked` 或 `source_changed`。Registry/SQLite读取、schema哈希、owner/current等原检查继续保留。没有按错误message捕获并转换普通存储错误。

execution-bound继续使用 `taskAdmissionFailure`。只有该明确类型、原工具 `invoked=false` 时才产生不可重试失败反馈，持久化host attempt `delivery=not_delivered`。该分支同时覆盖beforeDelivery准备阶段，以及governance.execute再次检查时的变化。实际原工具一旦调用，后续失败继续保持原effect unknown，不产生未派发证明。

shared attempt schema添加可选字段，严格限定为failed、task_blocked、effect none的组合。旧事件没有该字段，仍按原规则恢复。

receipts在原事务内消费此host marker，将未派发回执的admitted设为0。只有原effect_state为not_checked才允许，uncertain与matched均拒绝覆盖。后续原tool_end把回执settled/success0，原reconcile依据admitted0返回not_delivered且automaticReplay=false。没有新增数据库表、列、独立日志或状态机。

## 修改文件与最终SHA256

以下均相对 `D:/WorkProject/EduProject-harness/apps/desktop/`。

| 文件 | SHA256 |
|---|---|
| src/main/xiaozhi-agent/capabilities/core-governance.ts | ee64a5b9bc9008725e6b0a7f8c0ba20dd165fbf3dac8c29d30e93be3641c19a0 |
| src/main/xiaozhi-agent/tools/execution-bound.ts | 97ab0d3f57b73e17ea71300b34e6947caea02a1107954ee73ca62ddf8d165c12 |
| src/main/xiaozhi-agent/events/receipts.ts | 7fd6a8758f1616669367343b53915728af15cf0edf53577dd6c852109e2ae4a3 |
| src/shared/xiaozhi-tool-attempt.ts | cc74abb459df7fa3c7e9535bf3e0c65e1903ad5222057796d2870be288fad8d5 |
| scripts/xiaozhi-agent/governance-admission-boundaries.mjs | 3cf6c27f5d761d40e5550558b7d0dc254a769ad24cbaaa4ba5dda490dd0981ea |

## 原红与真实Host同样本

原始证据入口为仓库 `docs/goal/xiaozhi-harness/evidence/phase8/http-mcp-projection-20261119/FINAL_FINDINGS.md`。

修改前只复制原 `omni-edu-phase8-p0-provider-trace-2ca8ee49b0` 的focused-worker.ts和run.mjs到新目录，实际重现于 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-provider-red-304b30df5d`。其计数fixture SUMMARY显示success，但独立只读SQLite证明Run failed，第二receipt仍admitted/success null/contract null，CRITICAL_FAILURES.jsonl为普通Error source_changed。这一红证据保持原样。

writer首次修改后，原字节fixture复制重跑位于 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-provider-green-4be90fc197`。Run succeeded，第二receipt settled/admitted0/success0，实际外部调用仍1。该次发生在最后收紧matched保护前，保留其准确身份。

最后4文件冻结后，独立Agent使用原Grant/Provider样本加强最终读回，报告位于 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-phase8-p0-revoke-retest-98a6a26c7b/REPORT.json`。

- 两支2/2 PASS，两个真实生产Host Run均succeeded，781个bundle输入前后无漂移，付费0，模型为owned loopback SSE。
- 每支首次实际HTTP tools/call为1。撤销后的旧direct closure及原Pi工具重调，实际calls保持1、POST保持8。当前Task随后通过office_read_text安全读取继续。
- Provider失败receipt为settled/admitted0/success0/effect not_checked，原failed tool_attempt持久化delivery=not_delivered，recovery.disposition=not_delivered，automaticReplay=false。
- Grant支回调自身返回permission_pending，属于原工具内的保守拒绝。其receipt保留settled/admitted1/uncertain，恢复needs_check，没有新增delivery标记。

writer另以Node SQLite readOnly重新读取原红、writer green和独立最终的真实数据库。结果见本目录 `host-state-readback.json`，命令为 `node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-governance-admission-ODgfFh/read-host-states.mjs`，exit0。

同样本原runner命令如下，cwd为 `D:/WorkProject/EduProject-harness/apps/desktop`。

```powershell
node C:/Users/ZhouXuan/AppData/Local/Temp/omni-provider-red-304b30df5d/run.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-provider-red-304b30df5d
node C:/Users/ZhouXuan/AppData/Local/Temp/omni-provider-green-4be90fc197/run.mjs C:/Users/ZhouXuan/AppData/Local/Temp/omni-provider-green-4be90fc197
```

以上记录已经执行，不应在这些证据目录再次运行。复现时新建owned TEMP并仅复制两份原fixture脚本。

## 定向机制与原回归

| 实际命令 | 结果 | 报告 |
|---|---|---|
| node scripts/xiaozhi-agent/governance-admission-boundaries.mjs | 9/9，exit0 | 本目录report.json |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-governance-admission-ODgfFh/pi-tool-preflight-boundaries.mjs | 9/9，exit0 | TEMP/writer-pi-preflight-4jkwJL/report.json |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-governance-admission-ODgfFh/pi-tool-execution-boundaries.mjs | 21/21，exit0 | TEMP/writer-pi-tool-execution-tzZqRH/report.json |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-governance-admission-ODgfFh/pi-tool-attempt-journal.mjs | 10/10，exit0 | TEMP/writer-pi-tool-attempt-journal-uBESq3/report.json |
| node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-governance-admission-ODgfFh/pi-tool-receipt-boundaries.mjs | 15/15，exit0 | TEMP/writer-pi-tool-receipt-WBFWu3/report.json |
| npx tsc --noEmit | exit0 | 当前完整src类型检查，无诊断输出 |

合计64/64机制断言通过，另有4个marker schema非法组合断言通过。后三组SQLite/native回调边界和前两组工具计数夹具不等同完整生产Host，真实Host证据另按上节给出。

本轮新增9项明确覆盖以下边界。

1. 来源撤回与Registry撤销在before阶段产生typed不可重试失败、settled/admitted0，并可执行安全替代。
2. Provider在before与execute之间变化时，原工具仍未调用，明确未派发。
3. 原工具实际调用后抛相同TaskAdmissionError，依然保留unknown，不误标未派发。
4. 普通Error source_changed不被转换为TaskAdmissionError，publisher关闭。
5. 真实SQLite BEFORE UPDATE OF contract_json触发器失败，使原事务回滚、publisher永久关闭、底层调用0，未生成伪settled成功。
6. 真实SQLite tool_attempt INSERT触发器失败时，marker引起的admitted更新随事务回滚，publisher关闭、底层调用0。
7. 原effect_state uncertain与matched均不能被marker覆盖。

四份原专项的TEMP适配只改import绝对路径及test-results输出为TEMP，其余断言保留。原始日志在本目录同名log，没有重写生产测试脚本或生成文件。原专项仍证明旧unknown、取消、prototype nullable admission和真实写入故障不被新逻辑改写。

## 交付边界

本修复没有新增权限、改变当前授权/来源/owner围栏或把外部错误JSON视为未执行证明。未覆盖新的Provider族、真实模型质量、可见页面、安装包及全系统性能，这些继续由既定Phase8负责人处理。

安装候选/out属于原冻结源码身份，本修复未重新构建它们。总控需按源码身份分别记录并执行后续正常整合。源码回退可恢复这4文件并保留新增回归及原红数据；可选marker没有数据库迁移，旧事件继续按原保守规则读取。
