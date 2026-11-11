# 20261111 Public handoff QA 分阶段等待交接

## 最终冻结

本轮精确 QA 写集只有 `apps/desktop/scripts/ui-final-public-handoff-live.mjs`。

SHA256 为 `f77446fb066a8fc10e2f712efbfc323ba61e00c07c069fa8f2b44a11ebb0b132`。

最新机器清单使用 `public-handoff-qa-static-check.json` 的 `files` 数组，每项含仓库相对 path 与 sha256。源码基线备份位于 `public-handoff-qa-before.json`，原 SHA 为 `b99b0a3941698e90743efc2ca2dcb831b1147a719a157dd04bb7862ffc284fa7`。

生产 src 实际全量 fingerprint 为 `fe397552bafe0daea9b09e6cbd0a7d5ed98148ef0d2a45bcdac8982034d3a9d0`，1480 个文件。fixture `scripts/acceptance/streaming-css-provider.mjs` 保持 `30346d1d5f314556cf3e046fb9ad4d0c21bf0a5edce2b2e64f24d2681a72fc92`。

## 修改后的真实阶段

| 源行 | 阶段 | 实际判断 | 单阶段预算 |
| --- | --- | --- | --- |
| 130 | PUBLIC_ACTIVITY | 当前运行轮次出现 assistant 实际公开文本，登记真实 runId | 25000ms |
| 139 | TOOL_COMPLETION | 同一 runId 的 office_list_attachments 公开投影达到 completed | 25000ms |
| 146 | SECOND_RESPONSE_HOLDING | fixture requests 恰为 2 且 holding 为 true | 25000ms |

整体仍由原 180000ms hard timer 及原 until 的 deadline-10000 约束。原 bootstrap、terminal、cold recovery 及其余等待保持原表达式。只发送一次教师任务，无新增 provider 请求或启动重试。原 beginPrefix、beginAnswer、release 顺序与调用位置保持，工具 completed 和原全部 assert 仍须真实满足。

`report.timing.submittedAt` 在原 Enter 操作前取真实 Date.now。三个阶段分别保存 startedAt、budgetMs 和观察到条件成立时的 observedAt。`submitToSecondResponseHoldingMs` 记录提交至首次观察到第二 response holding 的真实壁钟耗时，包含轮询观察延迟。`legacyCompositeBudgetMs` 为 25000，`legacyComposite25sExceeded` 与 `legacyCompositeOverrunMs` 只作旧复合窗口比较。第二 response 尚未观察到时三个结果保持 null，不推测其耗时。

旧 25 秒属于先前 QA 复合等待，没有新增产品性能标准。分阶段等待结果需要 root 实际复验，不能据此声称产品性能改善。

## 失败关闭前取证

新增 captureFailureEvidence，在 catch 中、app.close 前执行。

- provider 仅使用原 readStreamingCssProvider 的脱敏元数据，并读取原浏览器请求计数。
- snapshot 保留运行状态、轮次 ID、工具状态、公开活动与 presentation。消息正文仅记录 textLength、textHash。
- 数据库通过 readOnly 连接读取最多 64 个 receipt 和最后 32 个 journal 事件的状态摘要。
- native 路径取本 QA DB 的正式 session binding，并校验解析后的真实路径位于本 QA data/xiaozhi-pi 内。只读最后最多 65536 bytes、最后 12 条完整记录。正文仅记录长度和哈希，工具参数和正文不写入报告。
- live 取证并行读取最多 5000ms，受剩余原总预算限制。取证异常记录哈希，原失败及原退出码保留。

取证读取和报告写入只涉及本轮 owned QA 数据与 test-results。既有正式用户运行 46612 及其资料没有操作。

## 验证与历史

`node --check apps/desktop/scripts/ui-final-public-handoff-live.mjs` PASS。

`node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/public-handoff-qa-static-check.cjs` PASS。

原 50 条 assert 表达式逐项一致。原 6 个 check 名称、调用及 case 顺序逐项一致。launch、electron.launch、任务 Enter、键盘 Enter、关闭、pin 校验及原其余 until 表达式均逐项一致。原 until 调用 10，当前 12，一处复合等待拆成三处。除新增取证函数、复合等待替换和 catch 调用外，原源码可逐字节恢复。无新 GUI、Electron 或模型任务执行，真实结果留待 root 一次复验。

历史 jWYATC 与 QdeptM 的 report.json 继续为 success=false、0 check。

| 历史报告 | SHA256 | 原失败 |
| --- | --- | --- |
| ui-final-public-handoff-jWYATC/report.json | 8b58762ef0f3d1be9160e73b1acd369702152e6aa8bf2d6d893ed8064a9105fc | bootstrap firstWindow 25000ms |
| ui-final-public-handoff-QdeptM/report.json | aad5f2177e7ba3d26c79f57e914bf6fafdf16fefb51ea25c5c1a713aaff619db | public-process TOOL_RECEIPT |

两份历史报告、owned DB、native 文件和截图均保留。源码与 QA 冻结后，由 root 使用原 --run-ui / --pins 参数执行一次正式复验，复验及证据收尾后的 Git FF 收口由 root 统一办理。
