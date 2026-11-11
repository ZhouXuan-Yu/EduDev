# 20261111 教学 smoke UI-ready QA 交接

## 冻结结果

只修改 `apps/desktop/scripts/electron-smoke.mjs`，新增四处同步 DOM 就绪等待。生产 11 文件按原 `static-check.json` 全量 SHA 比较一致。async helper 保持原 SHA。最后两个隔离短 Electron case 均已结束，此交接后 GUI 交还 root。

最新 QA 精确清单使用 `chapter-ui-ready-static-check.json` 的 `files` 数组。历史 `async-ui-wait-static-check.json` 对应上一次冻结，历史报告与失败日志保留。

| QA 文件 | SHA256 |
| --- | --- |
| apps/desktop/scripts/electron-smoke.mjs | 9ff03c9ea8549a7fc3c160ec5fa5b1fa15306b653ca2fbc5172aae3573c7b2ec |
| apps/desktop/scripts/acceptance/async-ui-wait.mjs | 1d28d626a08c0e5b3725afede17c0a245199fb8053a51e5ce5d6cfd8a295aae4 |

## 实际失败与原因

`chapter-electron-original.json` 使用 immutable `after-final-out`，原 single click 与原 30000ms 章节真谓词实际 FAIL。

- browserEvents.samples 的 version-poll 在 11206.3ms 读到 book version 2，editor inert 为 true，章节 title/objectives 均为空。
- version2-readback 在 11207.9ms 时 inert 仍为 true，字段仍为空。
- 接下来的原顺序执行 title.fill 和 objectives.fill。记录中没有这两个字段的 focusin、beforeinput 或 input 事件。
- mutations 在 11256.9ms 记录 inert 解除。13208.4ms 的章节保存 click 为 trusted，title/objectives 仍空。UI 显示“请选择讲义并填写章节标题。”。
- UI requested/selected bookId 与 SQLite 唯一 bookId 均为 teaching_book_ec0ccb99-2e39-4145-94f5-ebc4f5a7caed，status ready，version 2。全部 books 与 chapters 只读快照显示一书、零章。
- 没有单独记录每次 Playwright fill 的开始和结束时间戳。具体实测阶段以上述 samples、原调用顺序、输入事件缺失和最终提示为准。

`chapter-electron-ui-ready.json` 只在 chapter fill 前增加同步 DOM 条件，实际 PASS。单击一次，SQLite 唯一 chapter a9268ed2-8cf3-4a77-9896-99b663360b67，所属 book 4ea21082-df82-44fb-bdd2-3e1ce19b669e，chapter version 1，book ready/version 2。全部源与 immutable build 相同。

两个短 case 的 DOM/readback/SQLite、browserEvents、截图和 owned DB 均保留。保存后的快照可早于 UI 解除本次 inert，本次验收严格依据原 chapter===1、chapter version1、归属ID及 SQLite。

## 新等待位置

每处使用同步 `page.waitForFunction`，检查下一字段存在、无 inert 祖先且未 disabled，同时检查对应提交按钮存在且未 disabled。使用原默认 30000ms。

| 源行 | 下一操作 | 必要原因 |
| --- | --- | --- |
| 1334 | chapter-title.fill | metadata version2 已落库时编辑区仍可能在回读 |
| 1347 | page-chapter.selectOption / page-title.fill | chapters.length===1 可早于章节保存回读结束 |
| 1361 | source-ref.fill | pages.length===1 可早于页面保存回读结束 |
| 1373 | block-page.selectOption / block-title.fill | sources.some 可早于来源保存回读结束 |

原 book 信息字段本身带 saving/loading disabled。后续块编辑入口通过正常 click 等待可交互，再同步设置编辑态。原候选应用、撤销、取消和重新生成入口仍按原正常 click 使用。没有更改其 guard、服务载荷、预览、结果判断或原等待目标。

## 静态核验

`node --check apps/desktop/scripts/electron-smoke.mjs` PASS。

`node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/chapter-ui-ready-static-check.cjs` PASS。

- 原 459 个 assert 表达式逐项保持。
- 原 199 个等待目标逐项保持，当前等待调用 203，额外同步就绪等待 4。
- 46 个 waitForAsyncUi 的完整调用表达式逐项保持，无 async page.waitForFunction 回归。
- 原显式 4000ms 一处、默认 30000ms、三个 launchApp 和 207 验收项保持。
- 删除四处新增等待及注释后，源码与上一冻结版本逐字节一致。
- 生产 11 文件 SHA 全部一致。

## 保留路径

- 原失败 owned DB 位于 C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-chapter-short-data-sHAIxv/app.db。
- UI-ready 成功 owned DB 位于 C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-chapter-short-data-kkoAd7/app.db。
- 原失败截图 chapter-electron-original.png，成功截图 chapter-electron-ui-ready.png。
- 原失败报告 chapter-electron-original.json，成功报告 chapter-electron-ui-ready.json。
- 快照 chapter-electron-original-snapshots.jsonl 与 chapter-electron-ui-ready-snapshots.jsonl。
- 实际短 case 脚本 chapter-electron-short.mjs，保存取证 helper chapter-save-capture.mjs。
- 最初 QA preview 错映射失败保留为 chapter-realhost-harness-mapping-fail.json。后续 QA host 复用 index.ts 同一个真实 renderer，settled/overlap 两个真实 Store DOM case PASS。
- smoke-final.log 与 smoke-async-fixed.log 保持原 FAIL。完整 207 本 writer 未重跑，等待 root 用最终 QA source 一次统一复验。

本轮没有产品 R2 修改，所有生产源码继续冻结。回退本轮 QA 等待时可按 chapter-ui-ready-smoke-before.json 恢复上一 QA 源，此操作会重现已证实的输入时序风险。
