# 2026-11-26 项目进度与流程健壮性复查

## 审查基线

远端基线 `be28dd24e7ad544b42f742c80bf8bd2ddab23b67`。日常检出目录位于分离的 `7ee410d`，存在多方未提交修改。本次复查在独立分支 `codex/quality-review-20261126` 进行。已经检出的本地 `main` 有分叉，远端提交用于判断主线进度。

| 工作线 | 当前证据和边界 |
| --- | --- |
| D3 教学工作流 | 已入主线。前轮记录显示组卷、讲义、模考和教案在同一生产构建完成指定任务。自然材料覆盖、真实教师采用和规模指标仍待验收。见 [D3 综合验收](../product-agent/08_D3_DELIVERY_ACCEPTANCE.md)。 |
| 数据库 R2 与 R3 | 已入主线（`0dc86d8`、`55cf47f`）。迁移、备份、准入配置与冷启验证以对应构建证据为准。见 [数据库验收入口](../acceptance/CURRENT.md#小智数据库-r3)。 |
| 历史记忆 R1 | 已入主线。前轮交付包括授权查找、原文引用、旧库兼容及在途撤销。见 [历史记忆入口](../product-agent/HISTORY_MEMORY_R1.md)。 |
| 教师界面交互 | 已入主线（`4996957`、`aa870c5`、`1409949`）。前轮项目报告记录 10 项 Electron 通过及 76 个页面布局观测，旧 PromptInput 指纹差异另列。见 [上轮记录](ux-motion-20261126/RESULT.md)。 |
| 宿主资源调度、Provider 恢复、数据库 R4 与复查 | 分别保存在 `ed618c1`、`7f54a01`、`67d273e`、`cbc0872`。Provider 恢复账本为 28/36。本次以分支提交和账本确定边界，保留各自的集成与验证工作。 |

## 本次修复

学习记录和错题工作区共用附件导入回执。主进程在复制前检查记录归属、可写状态，在实际 SQLite 提交时以同一条件再次核验。写入已保存清单后，学生列表和记录读回可以独立失败。失败回执区分已复制、拒绝或复制失败与列表待刷新。临时失败的副本只清理本次拥有的路径。历史不一致链接在记录读回中被过滤，原始文件与数据库行保留供核对。

页面按发起学生展示回执。复制在途时通过同一入口锁阻止重复开启选择器。复制后通过当前查询回读，保留筛选和其他学生正在显示的时间线。列表读回失败时，页面说明文件已保存并给出重新读取方式。

兼容已有 SQLite 表和 typed preload，新增可选的刷新状态。可用 Git revert 撤回应用改动。已保存的正确归属附件可由原版本读取，回退时历史错绑会重新进入旧版投影。进程在复制后而 SQLite 提交前异常退出时，仍需单独处理无引用文件和验证磁盘恢复。

## 验收方法和记录

固定证据根为 `D:/WorkProject/EduProject/acceptance/quality-review-20261126`。生产 Electron 运行 [附件回归脚本](../../apps/desktop/scripts/acceptance/student-attachment-owner-electron.mjs)。文件选择和故障时机使用受控夹具，实际复制、提交、筛选和重启走正式应用。旧构建与新构建分别保存原始结果。

在 `apps/desktop` 构建后运行以下命令。脚本为每次运行创建独立数据根。

```powershell
$env:OMNI_EDU_TEST_EVIDENCE = 'D:/WorkProject/EduProject/acceptance/quality-review-20261126'
node scripts/acceptance/student-attachment-owner-electron.mjs
```

| 检查 | 结果与证据 |
| --- | --- |
| 旧版 Electron | 构建 `e3997eb486ccba14b5809ed9f78289db807c3b6d840b473173b1bb4014b0f336`。7 项中 6 项复现缺陷，部分导入与取消原已通过。见 `student-attachments-pec7qD/report.json`。 |
| 新版 Electron + SQLite | 构建 `a1a74d1a323a083b4e691fd74abe85f1d07f3de17feda0acea6217336c7ecc1c`。7/7，包括跨档案切换和重复选择、已提交后的读回失败、在途归档、跨归属拒绝、部分失败与取消、筛选、冷启与历史错绑隐藏。合成文件哈希和重启前后零网络请求见 `student-attachments-2BSKl3/report.json`。 |
| 构建与组件 | `npm run build` PASS，`npm run test:renderer-components` 261/261。见 `build.log`、`renderer-components.log`。 |
| 综合桌面回归 | 同一构建执行 `node scripts/electron-smoke.mjs`，30 位合成学生、207 项前端验收全部通过，覆盖错题页真实附件复制/哈希、取消、校正、重启及备份回归。见 `electron-smoke.log`。生产 Pi 的附件路径另由上述专项验证。 |
| 页面合同 | `npm run test:ui-contracts` 为 28 PASS / 1 FAIL，主线 Git blob 及 LF 字节均与旧 PromptInput 五项指纹不同。本次未触及所列源文件。见 `ui-contracts.log`。 |
| 依赖审计 | `npm audit --omit=dev` 重试返回 20 项既有生产依赖告警，其中 2 高、10 中、8 低。高严重度来自间接依赖 `@modelcontextprotocol/sdk` 和 `body-parser`。原始证据为 `npm-audit-retry.json` 和 `npm-ci.log`。锁文件及依赖保持原主线版本。 |

按以下方式人工检查。打开证据目录的 `启动质量验收.cmd`。在学生档案创建两个虚构学生，各自新增一条学习记录。为甲的记录导入 `学生附件验收样例.txt`，查看本地保存提示和附件入口，切换到乙确认没有出现甲的附件，再返回甲并重启确认保留。进入「学习记录 → 筛选记录」后再导入可验证筛选保持，文件选择窗口点取消可验证无附件新增。归档并发和读回故障由自动测试验证。
