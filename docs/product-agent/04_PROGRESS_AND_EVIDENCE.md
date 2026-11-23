# D3 阶段进度与证据

当前基线和保护边界见 [审计](00_CURRENT_STATE_AUDIT.md)，冻结映射见 [实施映射](01_IMPLEMENTATION_MAPPING.md)。原始日志和合成 SQLite 根为 `D:/WorkProject/EduProject/acceptance/D3-20261122`，验收从 `apps/desktop` 执行。

| 阶段 | 状态 | 当前进展 |
| --- | --- | --- |
| 0 | DONE | 主线核对，产品、数据和 DesignSkills 映射已记录，D3 分支独立于 D2。 |
| 1 | DONE | 对话与任务连续性 12 项工程场景已覆盖。真实模型综合质量和后续教学闭环留在集中验收。 |
| 2 | DONE | 工程验收覆盖首页、工作台、任务与成果、右侧上下文、专业编辑、版本、只读历史和恢复。各教学业务另按 Phase 4 验收。 |
| 3 | DONE | 个人版工程验收覆盖画像、偏好范围、纠正、停用、请求最小化与冷启。 |
| 4 | IN_PROGRESS | 自动组卷和讲义已通过工程验收。接下来是上海模考汇编及教案。 |
| 5 | DEFERRED | 冻结范围之外。 |

## Phase 1 初始验证

| 命令或证据 | 当前结果 |
| --- | --- |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/d3-conversation-intent-smoke.mjs` | `phase1-intent-unit.log`，25/25，知识问答、任务命令及已结构化发起的排除。 |
| `npm.cmd run test:renderer-components` | `phase1-renderer.log`，253/253。 |
| `phase1-build.log` | 首次类型检查捕获 Pi `TranscriptContext` 顶层没有 `tools` 字段。已修原 transcript 的工具声明处理，留存首次失败。 |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-conversation` | `phase1-build-final.log`，退出 0，TypeScript 与 Electron 编译通过。主入口 SHA-256 `a93cf63f8d5119d6a0b9408340c55131ae2f067a2040acc7f7ba2a81dac5feff`。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs` | `phase1-intent-ui-recheck.log` 与 `phase1-intent-OPtNjA/report.json`，真实 Electron 和本地合成 SSE，4/4，渲染错误 0。检查普通问答、明确教学目标、保持同任务、冷启后继续。首次误把检查点计入任务，修正权威键筛选后复跑，保留失败的 `phase1-intent-ui.log`。 |
| `node scripts/xiaozhi-agent/phase7-workbench-cold-ui.mjs` | `phase1-original-task-recovery.log`，同构建 5/5。真实停止与冷启动，读回旧审批、Effect 和任务，无重放。1366×768、1920×1080 的恢复筛选可用。 |
| `node scripts/electron-smoke.mjs` | `phase1-electron-regression.log`，分流构建 207/207。对应提交 `679a772`，已合并至远端 `main`，SHA 核对见 `phase1-main-delivery.json`。 |
| `npm.cmd audit --omit=dev --json` | 截点有 20 个告警，其中 2 项 high。未改依赖或锁文件。 |
| 手测候选 | `manual/launch.json`，PID 44940，Windows 验证可见、可响应、主入口哈希一致。 |

## Phase 1 手测入口

本机验收窗口使用单独的 profile、SQLite 和输出目录。重开时双击 `D:/WorkProject/EduProject/acceptance/D3-20261122/manual/启动-D3.cmd`。真实回答使用软件中已配置的模型。

1. 在「问小智」输入「什么是等值分数？」。预期得到回复，「任务」总览没有新增项目。
2. 在同一会话输入「请制作一份五年级等值分数讲义，包含例题、练习和答案，先给教学草稿」。预期建立教学任务。专业讲义的完整质量验收属于 Phase 4。
3. 在同一会话再问「为什么分母变大时单位分数变小？」。预期新增一轮答复，原任务和要求仍保留。
4. 退出并重开该验收窗口，进入原会话，输入「继续」。预期仍衔接原任务。

教师采用率和体验指标尚无本轮真实样本。后续依冻结测试矩阵逐项登记，项目历史与本轮证据分开。

## 明确修改原任务

切片覆盖同一会话中明确引用未完成工作时的修改。重新登记教师来源并推进 `requirementsVersion`，重算检查，保留原计划引用和效果回执。手动指定新任务、结构化教案/试卷入口和原审批续跑保持各自已有入口。

| 命令或证据 | 当前结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-continuation` | `phase1-amend-build.log`，TypeScript 和 Electron 编译通过。主入口 SHA-256 `f518f60b4bf06d30a83e79e0fd75a5a287a70fb3851c919b2caf245340528133`。 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/d3-conversation-intent-smoke.mjs` | `phase1-amend-unit.log`，32/32，覆盖普通问题、原任务修订、新任务及结构化入口。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs --amend` | `phase1-amend-ui.log`，真实 Electron、SQLite 和本地合成 SSE，6/6，渲染错误 0。新增验证自然语言更新原 Task 的要求版本和新任务独立性。 |
| `node scripts/xiaozhi-agent/pi-task-store-smoke.mjs` | `phase1-amend-task-store.log`，11/11，实际数据存储与事件。 |
| `node --experimental-transform-types scripts/xiaozhi-agent/pi-task-state-boundaries.mjs` | `phase1-amend-task-state-recheck.log`，28/28。先保留旧夹具缺少 Journal `sequence` 的失败，再补列复测全部通过。 |
| `node scripts/xiaozhi-agent/phase7-workbench-cold-ui.mjs` | `phase1-amend-task-recovery.log`，5/5，实际停止、冷启动和原效果读回。 |
| `node scripts/xiaozhi-agent/phase7-approval-cold-ui.mjs` | `phase1-approval-cold.log`，3/3，双分辨率审批详情、冷启动和模型零重放。 |
| `node scripts/electron-smoke.mjs` | `phase1-amend-electron-regression.log`，207/207。任务修订提交 `79fb618` 已进入远端 `main`，详细核对见 `phase1-amend-main-delivery.json`。 |
| 任务修订手测 | `manual-continuation/启动-D3-任务修订.cmd`。独立验收窗口已验证显示与响应，构建指纹见同目录 `launch.json`。 |

Phase 1 暂无全量退出结论。暂停和取消的证据见下文。

## 暂停与取消进展

任务卡沿用原任务、停止和事件链。两轮失败证据留存。`phase1-control-ui.log` 捕获动作校验接受数组，已改为严格字面值比较。`phase1-control-ui-final.log` 捕获取消后「继续」显示通用配置错误，已改为任务结束提示并阻止模型请求。

| 命令或证据 | 当前结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-task-control-rc` | `phase1-control-build-rc.log`，TypeScript 和 Electron 编译通过。主入口 SHA-256 `d09985f5f3b4e81b47894c88c298d6365ac706f9429479f4d001630cdf88bed2`。 |
| `npm.cmd run test:renderer-components` | `phase1-control-renderer-rc.log`，253/253。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs --amend --control --teacher-wait` | `phase1-control-ui-rc.log` 与 `phase1-intent-hZQwI5/report.json`，真实 Electron 与 SQLite，12/12，渲染错误 0。包含 1366×768 和 1920×1080 控件可达、旧所有者/非法动作、暂停后冷启续做、运行中和待核对取消、取消后禁止继续及实时教师澄清。 |
| `npm.cmd audit --omit=dev --json` | `phase1-control-audit.json`，告警 20，其中 2 项 high。此切片无依赖变更。 |
| 手测候选 | `manual-task-controls/启动-D3-任务控制.cmd`，隔离运行数据与窗口记录放在同目录。 |
| `node scripts/electron-smoke.mjs` | `phase1-control-rc-electron-regression.log`，207/207。任务暂停与取消已推送至 `main` 的 `70ed28d`，完整核验见 `phase1-control-main-delivery.json`。 |

后台子任务及主任务汇总仍需实施。

## 中断的教师澄清

旧版复现日志 `phase1-teacher-question-before.log` 显示恢复后生成了另一项任务。改造读取原询问 Run 的已提交任务检查点，再走原任务续跑和效果对账。实时回答、相同回答的重试、过期历史题卡和取消状态分别核对。

长会话合成联测 `phase1-teacher-question-ui-final.log` 曾把模拟澄清调用发送给自动整理请求。原日志保留。修正夹具，仅对声明 `ask_teacher` 的请求返回模拟调用。再次在同一长会话执行全部操作，SQLite 读回两次自动整理成功。

`phase1-teacher-question-cold-only.log` 复现了异常退出后，运行所有者撤销也阻止人工取消的问题。修复仅允许教师对原会话里仍未结束的任务提交原 Run 的取消检查点。该路径不恢复执行所有权，运行状态及所有者记录保持原值。旧模型、工具和审批不能经此入口重放。

| 命令或证据 | 当前结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-teacher-recovery-cancel` | `phase1-teacher-recovery-cancel-build.log`，编译通过。主入口 SHA-256 `ec8bd12b2204eab66c919d827e8d3375ea0632996b5b6757fec9788e2736aeb5`。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs --teacher-cold` | `phase1-teacher-recovery-cancel-ui.log` 与 `phase1-intent-Ez5cBg/report.json`，7/7。异常退出后回答恢复原 Task，核对持久化回答来源、重复请求、取消权限撤销以及历史问题隔离。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs --amend --control --teacher-wait --teacher-cold` | `phase1-teacher-recovery-cancel-combined.log` 与 `phase1-intent-hNajwE/report.json`，15/15，渲染错误 0。 |
| 同会话联测附加 `--same-teacher-conversation` | `phase1-teacher-recovery-long-conversation.log` 与 `phase1-intent-QHxJNs/report.json`，15/15。自动整理状态从 SQLite Journal 读回均已完成，共两次。 |
| `node --experimental-transform-types scripts/xiaozhi-agent/phase6-startup-recovery-smoke.mjs` | `phase1-teacher-recovery-cancel-startup.log`，2/2，保留原启动恢复契约。 |
| `node scripts/xiaozhi-agent/phase7-workbench-cold-ui.mjs` | `phase1-teacher-recovery-cancel-previous.log`，5/5，实际普通停止和冷启，审批、效果和任务事实读回，零重放。 |
| `node scripts/electron-smoke.mjs` | `phase1-teacher-recovery-cancel-regression.log`，207/207。对应本节列出的最新构建指纹。 |
| 手测候选 | `manual-teacher-recovery/启动-D3-澄清恢复.cmd`。窗口已验证可见、可响应，指纹见同目录 `launch.json`。 |

手测用 `manual-teacher-recovery/启动-D3-澄清恢复.cmd` 打开独立验收资料根。如试用窗口尚未配置模型，先在「设置」选择可用模型。

1. 在「问小智」问「什么是等值分数？」。预期显示回答，任务列表没有新增项。
2. 同一会话发「请制作一份五年级等值分数讲义，包含两道例题和练习答案」。预期出现独立任务。回复后发「请把刚才的讲义改为八年级，其他要求照旧」。展开任务卡，预期原任务仍在，要求版本递增。
3. 在教学任务生成时点「暂停任务」。预期任务卡显示已暂停。重开该试用版，回到原会话并展开任务卡，点「继续剩余步骤」。预期沿原任务执行。
4. 在任务卡点「取消任务」并确认，再发「继续」。预期显示该任务已结束，旧回复和已保存成果仍可查看。
5. 发「我还没有确定年级，请先问我再写分数课导入」。在澄清卡里选择年级并发送。预期原轮继续，任务列表没有因填写答案多出一项。进程意外退出的场景由专项用例在独立资料根验证。

正常退出前等待中的教学澄清可以在重开后原位续答。基线 `phase1-graceful-before.log` 复现了历史卡缺少回复入口。宿主按题卡用途和关闭原因持久化恢复资格，教师主动停止和操作确认继续按原流程结算。

| 退出续答验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-graceful-question` | TypeScript 与 Electron 构建通过，日志 `phase1-graceful-build.log`。主入口 SHA-256 `1dacc84da32438b31d49780fc9bb3527f8f48e1266bb3bdb18cc8a809e90f1ab`。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs --amend --control --teacher-wait --teacher-cold --teacher-graceful-shutdown` | `phase1-graceful-ui.log` 与 `phase1-intent-SAOOzP/report.json`，16/16，渲染错误 0。正常退出和主动停止都从真实 Electron 操作，核对原 Task、零自动重放及持久化回答。 |
| 异常退出与审批回归 | `phase1-graceful-abrupt-regression.log` 7/7，`phase1-graceful-approval-cold.log` 3/3。 |
| 组件回归 | `phase1-graceful-renderer-components.log`，253/253。 |
| Electron 综合回归 | `phase1-graceful-electron-regression.log` 207/207。已推送 `main` 的 `6a2b7ef`，远端与构建核对见 `phase1-graceful-main-delivery.json`。 |
| 手测入口 | `manual-graceful-question/启动-D3-退出续答.cmd`。让小智先问年级，等待出现题卡后正常退出。重开原会话，选择年级并发送，原任务继续。 |

真实模型上的长会话整理待验。旧历史题卡仍可查看，并在尝试提交时显示任务已取消或要求已变化的反馈。

## 多份资料子任务

同一教学计划内的独立资料步骤沿用 `TaskStep`、真实 Pi 工具和权限。宿主把结构化核验结果送回主任务，并在任务卡显示可用于汇总的结果。冷启通过原回执再次核对来源版本，变更的资料结果失效，其余保持可用。没有新增表或任务调度器。

最初构建 `phase1-subtasks-build.log` 发现 Pi 选项类型少了新增方法，已修正。`phase1-subtasks-ui.log` 实际读取两份文件，原文后的宿主引用说明干扰了 JSON 回执解析。修复后只剥离有确切结构的引用说明，原 Journal 保留完整摘要和原生回执。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-source-subtasks-rc` | TypeScript、Electron 构建通过。`phase1-subtasks-build-rc.log`，主入口 SHA-256 `5fdaf1cb11935a78dcb74667645ea628576c89fb0a198d887c19dc014c3b86fe`。 |
| 对话与子任务合并专项 | `phase1-subtasks-combined.log`，19/19，渲染错误 0，证据 `phase1-intent-7CjxfV/report.json`。 |
| 两份文本源与故障恢复 | `phase1-subtasks-provider-recovery.log`，8/8。两份来源实际已读，主模型见到正文和结构化回执。中断或模拟 503 后保留同一 Task 的检查点，续做不重发原工具。改动一份来源后仅该项旧结果失效。 |
| 两种窗口尺寸 | `phase1-subtasks-final.log`，8/8。1366×768 与 1920×1080 均进入已核验行并截图。 |
| 组件和审批 | `phase1-subtasks-renderer-components.log` 253/253，`phase1-subtasks-cold-approval.log` 3/3。 |
| Electron 综合回归 | `phase1-subtasks-electron-regression.log` 207/207，退出码 0。 |
| 手测入口 | `manual-source-subtasks/启动-D3-资料子任务.cmd`。通过「选择教学工作目录」授权包含两份 `.txt` 的测试目录，要求小智分别读取并对照整理。展开任务卡查看两个资料子任务及其核验状态。 |

本轮实际验证的资料是授权目录内的合成文本，附件、更多业务子任务及真实模型的自主规划质量需要后续覆盖。

## 指定成果的局部修改

`node scripts/xiaozhi-agent/html-versions-electron.mjs --checks` 在同一最新构建通过 12/12。真实 Electron 通过操作授权和内容审阅，修改明确指定的 HTML 文件。另一个含相同原文的文件哈希保持原值，历史预览、恢复的新版本、当前和旧报告的适用性均有磁盘和冷启读回。`phase1-artifact-target.log` 保留旧夹具未通过权限卡的失败。修订的夹具通过原权限卡提交教师操作，再按项目原入口确认保存。最终日志 `phase1-artifact-target-recheck.log`，证据 `omni-edu-html-ui-768EtI/report.json`。

## 跨会话引用已保存教学成果

教师从「教学文件」打开已保存的当前版本并选择「在新对话中引用」。宿主核对保存记录和磁盘摘要，登记新对话及本地待发送附件。文件内容待教师点击发送后沿原 Pi 附件工具脱敏读取。文件缺失、变化与来源学生归档均返回可核对的失败。新附件保留来源会话、成果身份、文件版本和内容摘要。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-artifact-reference-release` | 构建和 TypeScript 通过。`artifact-reference/build-release.log`。主入口 SHA-256 `7272a11a2bdaf36262f313d6e96ef794fe32059597f3b5dd2b3bababf668aa1e`。 |
| `node scripts/xiaozhi-agent/html-versions-electron.mjs --checks --reference` | 17/17，证据 `artifact-reference/omni-edu-html-ui-MFQRIg/report.json`。覆盖旧成果、第三版 HTML 的真实点击引用、预览、发送后读到原始 4N、修改旧文件后引用副本仍保持 4N、冷启零重放、错误输入、旧 Markdown 和归档学生。渲染错误 0，新增付费调用 0。 |
| 两次原生迁移 | `artifact-reference/legacy-schema-with-row-recheck.log`。对一条旧附件记录执行两次新增列迁移，所有原列保持同值，旧记录从原附件接口读回。 |
| `npm.cmd run test:renderer-components` | `artifact-reference/renderer-components-final.log` 253/253。最后一处修复在宿主附件读取，渲染产物指纹一致。 |
| `node scripts/electron-smoke.mjs` | 最终构建 207/207。`artifact-reference-regression-release/electron-smoke.log`。 |
| `npm.cmd audit --omit=dev --json` | 保留原 20 项依赖警报，包含 2 项 high。未改依赖或锁文件。 |
| 手测入口 | `manual-artifact-reference/启动-D3-引用教学文件.cmd`。单独的数据根和窗口，`launch-verified.json` 记录实际运行包及其哈希。 |

`artifact-reference.log` 保留首次合成夹具错误解析带有宿主说明的工具回执，`artifact-reference-final.log` 保留首次真实 HTML 读取被格式校验拒绝的结果。最终把 HTML 源码交给已有文本行读取合同，原生受限预览继续呈现 HTML。旧附件表增加一个可空来源字段。回退应用时可沿用原附件记录，旧界面省略来源信息；无须删除字段或改动原件。

手测可在「教学文件」选择「浮力练习（手测样例）」，点击「在新对话中引用」。输入框上方应出现「浮力练习-验收.md · 引用教学文件」。点击文件可预览本机内容。发送「根据附件出一道同类浮力题，并给出答案」后查看本轮已发送附件和资料读取记录。历史版本入口继续单独用于比较、预览与恢复。其它 Office 格式沿现有附件路径，逐格式专项及真实模型回答质量仍待验收。

## 已发送附件作为资料子任务

首次桌面联测中，两个附件工具都有成功回执，汇总时只带上第一份核验结果。原任务计划只把纯读取认作成组读。附件读取会使用本地解析缓存，第二份结束后没有触发汇总前的核验刷新。现将已登记的资料读取和缓存型资料读取都纳入原任务步骤核验。模型先列出已提交的附件，再将实际附件 ID 作为步骤目标，调用时使用对应的当前 revision。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-attachment-subtasks-release` | TypeScript、Electron 构建通过。`attachment-subtasks/build.log`。主入口 SHA-256 `4925f7d3276afa549d92a3a5c5b5330a122a3ec85954d8428f9ae09dbdf716f4`。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs --source-subtasks --attachment-subtasks` | 12/12，渲染错误 0。`attachment-subtasks/phase1-intent-JLvqFu/report.json`。两种来源分别验证实际双工具回执、双尺寸任务卡、两份核验结果进汇总、中断后同任务续做、模拟 503 后续做及一份资料版本变化。 |
| `node --experimental-transform-types scripts/xiaozhi-agent/pi-task-plan-boundaries.mjs` | 20/20，`attachment-subtasks/plan-boundaries.log`。覆盖实际来源绑定、依赖和权限、效果去重及事务回滚。 |
| 失败证据 | `attachment-subtasks/source-and-attachment-subtasks.log`，原始合成数据 `phase1-intent-Cpr0sF/data/app.db`。两份原生回执都成功，原模型汇总的主任务只带第一份核验结果。 |
| 手测入口 | `manual-attachment-subtasks/启动-D3-附件子任务.cmd`，两份合成资料放在同目录的 `测试资料`。 |

## Phase 1 退出核对

| 原验收项 | 已实现并验收的工程场景 |
| --- | --- |
| 1、2 | 普通知识问答与明确的教学目标沿同一 Pi 走各自准入，分别核对模型工具和 SQLite Task。见最新资料子任务专项。 |
| 3 | 自然语言补充递增原 Task 要求版本，新任务保留旧任务。见 `phase1-amend-ui.log`。 |
| 4 | 实际修改指定 HTML，另一同文本文件的哈希保持。见 `artifact-reference/artifact-reference-release.log`。 |
| 5、6 | 独立资料步骤的身份、核验状态与回执进入主任务和模型汇总。授权目录文件及已提交附件均完成。见 `attachment-subtasks/source-and-attachment-subtasks-recheck.log`。 |
| 7 | 运行中以及异常或正常退出后，教师澄清接回原 Task。见本页「中断的教师澄清」和「正常退出后的教师澄清」。 |
| 8 | 暂停可续做，取消后保持终态。见 `phase1-control-ui-rc.log`。 |
| 9、10 | 本地合成 503 与关闭重启均保留原检查点，新 Run 读取当前核验结果。见最新资料子任务专项。 |
| 11 | 原审批及冷启效果记录不自动重放。独立计划边界测试也拒绝相同效果再次调用。见 `phase1-original-task-recovery.log`、`phase1-approval-cold.log` 和 `attachment-subtasks/plan-boundaries.log`。 |
| 12 | 旧成果引用到新对话，教师发送后读取选定字节，冷启保留精确来源。见 17 项跨会话引用专项。 |

Phase 1 工程退出通过。实测使用本地合成模型和真实 Electron、原 Pi、文件与 SQLite，新增付费调用 0。真实模型的自主规划与回答质量纳入后续集中验收。下一阶段从现有小智首页、任务入口和教学工作台的真实数据装配开始。

## Phase 2 动态首页

首页在新对话的原 Composer 下显示本地审批、待关注任务和最多两份近期成果。审批打开原收件箱，任务打开原会话，成果落到教学文件的确切记录。使用组卷、讲义、模考汇编或教案入口只填入草稿；已有草稿保留。冷启动的空闲和首次引导由现有会话记录与已保存状态决定。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-home-rc` | TypeScript 及 Electron 通过。`phase2-home/build-recheck.log`。主入口 SHA-256 `79f1bfb533f1bf0215f1d6cf0cbeb0b344aca5cf5ec79b1765534b655fb9a122`。 |
| `node scripts/xiaozhi-agent/d3-home-activity-electron.mjs` | 4/4，实际 Electron、typed IPC、SQLite、保存文件及真实审批记录。两种尺寸可达，成果精确跳转和返回草稿通过，零导航触发模型。`phase2-home/home-electron/verified.log` 与 `omni-edu-xiaozhi-phase7-workbench-ui-AQrzE8/evidence/home-activity-report.json`。 |
| `node scripts/workbench-ui.mjs` | 25/25，`phase2-home/workbench-ui/workbench-ENjOhG/report.json`。首开无待办时的资料进口、两尺寸、输入草稿、原资料真实导入与历史恢复。 |
| 组件回归 | `phase2-home/renderer-components.log` 253/253，`phase2-home/ui-home-state.log` 14/14。 |
| `node scripts/electron-smoke.mjs` | 同构建 207/207，`phase2-home/smoke/run.log`。 |
| 手测入口 | `manual-phase2-home/启动-D3-动态首页.cmd`，独立验收数据包含浮力练习示例。 |

失败证据保留在 `phase2-home/home-electron/run.log` 和 `recheck.log`。首轮夹具启动期间工具注册超时。第二轮等到了面板外壳，审批索引仍加载，已改成等待真实审批行。`workbench-ui/run.log` 保留原三项快捷入口断言，复测使用四项教学入口及独立学情示例。

## Phase 2 我的任务与教学工作台

左栏「我的任务」从原 Workbench 查询跨会话任务和审批。任务列表显示保存的要求摘要、核验步骤、状态与时间，可切换执行中、未完成、需处理、可恢复及已确认等状态。教学工作台默认分组展示进行中、待处理和最近完成，并保留教学文件、备课本、讲义、题本及组卷入口。点击任务进入原会话，继续和停止在原任务界面执行。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-task-workbench-final` | 已实现。TypeScript 及 Electron 通过。`phase2-task-workbench/build-final.log`。主入口 SHA-256 `1d8af1ee7b8dcb5ba94de479b3f1f12362e62f3eff6f1251f8901617e90464dd`。 |
| `node scripts/xiaozhi-agent/d3-home-activity-electron.mjs --task-workbench` | 已实现。7/7，渲染错误 0。`phase2-task-workbench/teaching-tasks-verified.log` 与 `omni-edu-xiaozhi-phase7-workbench-ui-u6O9m8/evidence/home-activity-report.json`。实际查看 SQLite 的任务、筛选、默认分组、切换教学成果、原会话恢复，覆盖两种窗口大小和原 Pi 执行中返回与停止。 |
| 停止后 SQLite 读回 | 已实现。原 Run 已进入终态，原 Task 保存为 `interrupted`。证据 `phase2-task-workbench/live-stop-readback.json`。 |
| `node scripts/workbench-ui.mjs` | 已实现。25/25，`phase2-task-workbench/navigation/workbench-FcUzNN/report.json`。原教学与学生路径、侧栏导航、纸卷约束、输入框和冷启数据通过。 |
| `npm.cmd run test:renderer-components` | 已实现。253/253，`phase2-task-workbench/components/run.log`。 |
| `node scripts/electron-smoke.mjs` | 已实现。同构建 207/207，`phase2-task-workbench/smoke/run.log`。 |
| 手测入口 | `manual-phase2-task-workbench/启动-D3-任务工作台.cmd`。可见响应窗口已实测，数据包含合成教案任务和浮力成果。 |

早期专项日志保留了两个工作台外壳的同名按钮以及导航夹具仅查询第一组导航的问题。复测按实际可见侧栏操作。导航回归保留了旧五入口的数量断言，更新为任务入口和原五个领域后通过。没有付费模型调用。依赖审计为原有 20 项警报，其中 2 项 high，本切片未改依赖或锁文件。

下一切片已读回上一轮实际产物库。两个同会话的 HTML 版本归属两个不同 Task，第三个还原版本可追溯到被还原的版本及其任务。跨会话引用稳定落在提交附件的目标 Run 对应 Task。结果记录于 `phase2/task-artifact-projection-audit.json`，用于实现跨任务的成果关系。

## Phase 2 任务与成果双向定位

「我的任务」及「教学任务」的任务卡按需显示关联成果，注明产出、引用与还原。点击直接进入文件详情里的对应版本。教学文件可从当前文件或已选历史版本查看来源任务和引用任务，回跳后只显示指定任务。关联读取复用主进程的任务、文件和附件账本，无新增数据库表或迁移。旧记录缺少可核对的来源时显示空态，旧版回退后底层记录仍可读。

验收数据在 `D:/WorkProject/EduProject/acceptance/D3-20261122`。手测用 `manual-phase2-artifact-links/启动-D3-任务成果关联.cmd`，Windows 已核对窗口可见并响应。按同目录的 `验收步骤.md` 查看任务归属、精确版本和双向跳转。该隔离窗口的主进程 SHA-256 为 `9e7c5e5528baaa57b7bec1e112aefe8e0609529938bae9aa58d9c74b90930fb9`。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-artifact-links-verified` | 通过，`phase2-artifact-links/build-verified.log`。 |
| `node scripts/xiaozhi-agent/html-versions-electron.mjs --reference --relations` | 15/15，`phase2-artifact-links/electron-lineage.log` 及 `omni-edu-html-ui-yknNej/report.json`。已实测一个任务保存两份独立 HTML，同会话任务分离、另一个会话引用、还原版本继承来源、冒用会话归属被拦截、归档隐藏关联、通过旧版回跳指定任务，以及冷启动读回。实际记录中两份浮力实验文件共享同一个 Run，渲染错误 0。 |
| `npm.cmd run test:renderer-components` | 253/253，`phase2-artifact-links/renderer-components.log`。 |
| `node scripts/electron-smoke.mjs` | 207/207，`phase2-artifact-links/electron-smoke.log`。通用冒烟使用本轮较早构建，最终构建单独通过上述专项。 |
| 现场窗口 | `manual-phase2-artifact-links/window-verification.json`，独立 SQLite 样例，窗口响应且可见。 |

保留先前失败日志。修正测试夹具中已更换的教学工作台入口、冷启动后返回对话的入口，以及合成计划缺少教师核对步骤的问题。付费调用 0。Office 关系使用原已保存版本账本，本轮新增关联路径的完整闭环以 HTML 验证，其他格式及超出原教学文件目录范围的旧成果另列覆盖。依赖审计有原 20 项警报，其中 2 项 high。下一步推进右侧上下文和编辑同步。

## Phase 2 右侧当前任务上下文

右栏按当前任务 Run 显示教师要求、核验步骤、已读来源及关联成果。已有试卷摘要、备课包目标与题目收集状态按真实记录出现，试卷入口复用原蓝图、题目、答案和确认面板。“继续”沿原任务归属。普通问答默认收起右栏，手动打开可查看本轮资料。无新增 SQLite 表或迁移。无付费调用。

验收固定在 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase2-task-context`。隔离手测入口 `manual-phase2-task-context/启动-D3-右侧任务上下文.cmd`，同目录有 `验收步骤.md` 与 `window-verification.json`。实际窗口已核对，主进程 SHA-256 `d4faff093a822b44cdb790cb14934df94078924ae05dc95a67d82366bd0d41b7`。

| 验收 | 最终构建结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-task-context-verified` | 通过，退出码 0，`build-verified.log`。 |
| `node scripts/xiaozhi-agent/d3-conversation-intent-ui.mjs --amend --context` | 10/10，退出码 0。实际发送普通问答、建任务、冷启继续、修改、同会话另建任务、切换会话。`conversation-context.log`、`phase1-intent-9DuTTH/report.json`。渲染错误 0。 |
| `node scripts/xiaozhi-agent/html-versions-electron.mjs --context --reference` | 16/16，退出码 0。实际读原文件、保存及恢复版本、在右栏核对当前任务范围、点击第 2 版、切到另一会话核对提交附件的读取和冷返回。`artifact-context-final.log`、`omni-edu-html-ui-ioCd8s/report.json`。同目录两种尺寸截图及可达性通过，渲染错误 0。 |
| `npm.cmd run test:renderer-components` | 253/253，退出码 0，`renderer-components.log`。 |
| `node scripts/electron-smoke.mjs` | 207/207，退出码 0，`electron-smoke.log`。 |

前两次专项日志保留。第一轮定位器包含隐藏原对话中的版本组件，修正为教学文件详情内查询。第二轮在 Electron 自动化读取合成模型回执时返回临时垃圾回收错误，复测原进程读回或在同一次等待中重试该瞬时错误。后续继续核验试卷和备课包专项的右栏路径，以及上海模考的专属字段。本轮 `npm audit` 有原 20 项警报，其中 2 high。

## Phase 2 试卷专业编辑回接

从原对话预览试卷并进入题篮，修改分值或解析后确认整卷。确认页提供「查看来源对话」。原试卷卡和右栏根据持久化导入与确认记录打开当前编辑版，原版与中间版可读。独立的同会话试卷不影响这条版本关系。不同编辑草稿竞争确认时，历史与已保存的版本保留。无 SQLite 迁移。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-paper-edit-sync-final` | 退出码 0，`phase2-paper-edit-sync/build.log`。主进程 SHA-256 `768f8d0c98374cda93f7f167ecb37c0c051620497f178582649b65d7fb028c8e`。 |
| `node scripts/education/paper-edit-sync-electron.mjs` | 4/4，`electron-sync-verified.log`、`paper-edit-sync-GoR9kw/report.json`。真实发送、正式确认原版、在题篮把 5 分改为 7 分、并发拦截、回接原对话、历史版、同会话无关卷、冷启右栏、两种尺寸。渲染错误 0，付费请求 0。 |
| `paper-whole-edit-boundaries.mjs` | 10/10，`source-boundaries-final.log`。SQLite 冻结源、事务故障回滚、并发和幂等，以及同一题篮再次修改保存时保留中间版。 |
| `paper-basket-boundaries.mjs`、`paper-fulfillment-boundaries.mjs` | 45/45、6/6，`basket-boundaries.log`、`fulfillment-boundaries.log`。三个源码测试使用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs`。 |
| `npm.cmd run test:renderer-components`、`node scripts/electron-smoke.mjs` | 253/253、207/207，`renderer.log`、`electron-smoke.log`。 |

证据根在 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase2-paper-edit-sync`。隔离手测 `manual-phase2-paper-edit-sync/启动-D3-试卷编辑回接.cmd`，同目录记录验收步骤和 Windows 窗口证据。保留前三次专项日志，分别修正了分值控件所在区域、冷启动页面句柄及等待试卷卡挂载的先后顺序。依赖审计有原 20 项警报，其中 2 项 high。历史试卷恢复为新版本、同会话精确导出和其他专业成果编辑仍待实施或验收。

## Phase 2 恢复试卷历史版本

在历史确认卷点「从此版建立恢复草稿」，沿现有题篮预览、核对和保存。试卷卡及右栏打开新恢复版，可以单独查看原版和中间版。恢复用原题篮收据记录版本来源并核对前置版本，旧草稿或变化的原题会阻止确认。无 SQLite 迁移。

| 验收 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-paper-restore-final` | 退出码 0。主进程 SHA-256 `6d34d2318fbcf3c025f9eb85c56bd249b37ecaded22553ccac0c5c79b8c69132`。 |
| `node scripts/education/paper-edit-sync-electron.mjs --restore` | 5/5。实际原卷 5 分、编辑卷 7 分，恢复草稿在确认前不增加正式卷，确认后生成新 5 分版。旧版可读，右栏冷启定位新版本，同时保存双尺寸截图。`electron-restore.log`、`paper-edit-sync-rluzRu/report.json`，付费请求 0。 |
| `paper-whole-edit-boundaries.mjs`、`paper-basket-boundaries.mjs` | 12/12、45/45。核对历史版本资格、同请求幂等、并发冲突，并验证变更题源会阻止建立新草稿及确认已存在的草稿。`source-boundaries-confirm-recheck.log`、`source-basket.log`。 |
| `npm.cmd run test:renderer-components` | 253/253，`renderer.log`。 |
| `node scripts/electron-smoke.mjs` | 同一构建 207/207，退出码 0，`electron-smoke.log`。 |

证据根在 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase2-paper-restore`。手测 `manual-phase2-paper-restore/启动-D3-试卷历史恢复.cmd`。当前专项使用常规题库卷，模板来源复杂卷的恢复专项继续验收。同会话的精确导出为下一片。依赖审计保留原 20 项报告，其中 2 项 high。

## Phase 2 同会话多份试卷精确导出

教师从原任务试卷卡或右栏选择试卷时，预览显示卷名、题数和分值。选定版本属于自己的编辑链，同会话另一份较晚确认的独立卷可以继续并存。保存前重新核对所选卷、题源、当前版本和目标文件夹。旧请求继续按原规则执行。无 SQLite 迁移。

| 验收 | 最终构建结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-paper-selected-export-final` | 通过，`build.log`。主进程 SHA-256 `f95ca6227657be5112ae9ee55d06e9dca8048504aba5ac92a6dc301a1a93e48e`。 |
| `node scripts/education/paper-edit-sync-electron.mjs --export-selected` | 6/6，`electron-export-final.log`、`paper-edit-sync-9qs5D2/report.json`。同会话先编辑并确认 7 分目标卷，再确认 5 分独立卷。两个窗口尺寸可操作导出。预览和存档指向同一快照，实际审批后生成两份 Word，教师卷含答案解析，重启后文件目录可读。渲染错误和付费调用均为 0。 |
| `paper-whole-edit-boundaries.mjs`、`paper-export-intent-test.mjs`、`paper-export-boundaries.mjs` | 15/15、8/8、21/21。覆盖旧请求兼容、审批前题源变化、同链后继、保存目录和 Office 文件。使用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs`，日志为 `source-boundaries-final.log`、`intent-compat.log`、`office-formats.log`。 |
| `node scripts/xiaozhi-agent/paper-c2-office-recovery-focused-test.mjs` | 15/15，`c2-recovery.log`。使用生产 SQLite、Office 文件及源事务复核，覆盖已写文件和来源变化后的恢复。 |
| `npm.cmd run test:renderer-components` | 253/253，`renderer.log`。 |
| `node scripts/electron-smoke.mjs` | 同一构建 207/207，`electron-smoke.log`。32 张截图已归档到 `electron-smoke-screenshots`。 |

全部测试产物和原始日志在 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase2-paper-selected-export`。启动入口 `manual-phase2-paper-selected-export/启动-D3-精确试卷导出.cmd`，同目录有操作步骤和实际窗口记录。第一次导出自动化等错目录，第二次比较冷读记录时依赖顺序，原日志均保留。旧 C2 综合夹具未注入现行恢复租约，在旧恢复断言处报 `permission_denied`，保留 `c2-compat.log`，专用恢复测试已通过。精确选择的 Electron 路径覆盖普通题库卷的 Word。PDF、答题卡和模板题卷精确选择的用户路径待集中覆盖。依赖审计有原 20 项警报，其中 2 项 high。

## Phase 2 教案与课堂大纲编辑回接

对话卡按原始 Run 展示同一教案或课堂大纲的当前版本。老师可从卡片或右栏打开该版本，在原编辑器修改目标、时间、活动及评价。保存形成新草稿，正式确认仍由老师执行。查看来源对话会定位原卡。右栏按当前任务显示教学目标和环节。同一会话的独立教案各有版本历史。复用原表、CAS 和来源核查，无迁移。

| 验收 | 最终构建结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-lesson-editor-final` | 通过，`build.log`。主进程 SHA-256 `33aedb09cfc4be009e515816628649afd0cf83e27885fa2a0660796abe288d3a`。 |
| `node scripts/education/teaching-lesson-electron.mjs --task-editor` | 7/7。原 Pi 读取指定 A 版依据并保存教案，通过原任务卡打开编辑器。覆盖未保存的离开限制、错误会话、旧版本并发拦截、分钟冲突、局部修改、历史恢复、两份教案共存、右栏范围和冷启动。真实 SQLite、双尺寸截图和读回，渲染错误和付费调用均为 0。见 `electron-lesson-editor.log` 和 `xiaozhi-teaching-lesson-ui-l7Awrd/report.json`。 |
| `teaching-lesson-boundaries.mjs`、`classroom-plan-boundaries.mjs` | 10/10、16/16，分别覆盖教案结构和来源、课堂大纲状态、版本与恢复。使用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs`，日志为 `lesson-boundaries.log`、`plan-boundaries.log`。 |
| `npm.cmd run test:renderer-components` | 253/253，`renderer.log`。 |
| `node scripts/electron-smoke.mjs` | 同构建 207/207，`electron-smoke.log` 和 `electron-e2e/`。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase2-lesson-editor`。手测入口 `manual-phase2-lesson-editor/启动-D3-教案编辑回接.cmd`，同目录有现场窗口记录和手测步骤。样例使用合成来源，可离线编辑。课堂设计的历史列表和恢复已验证，历史正文只读预览仍待补齐。独立讲义编辑、真实教案教学质量和同链自然语言精细修订按各业务合同继续覆盖。依赖审计保留原 20 项，其中 2 项 high。

`before-w4TpeH/conversation-1366x768.png` 是相同数据在 `af2426a` 构建的基线，对话和右栏都无教案卡。新构建的 `lesson-task-1366x768.png` 与 `lesson-task-1920x1080.png` 记录卡片及可操作的编辑入口。首次采集在浏览器窗口就绪前调整尺寸，保留 `before.log`，修正等待顺序后通过。

## Phase 2 课堂设计历史正文与恢复

现有历史列表可打开教案或课堂大纲正文。按选定版本展示教学目标、活动、时长及已保存的来源。教案额外展示教师提示语、评价、达成标准与逐目标原文对照。查看不写入数据，关闭返回原操作位置，未保存编辑仍在。

恢复沿原课堂设计编辑事务，由宿主校验同一版本链、当前修改基线和旧版资料。有效资料按该版恢复，撤回或变化的资料保留历史可读，保存恢复会被拒绝。恢复新稿保存旧版 ID 与摘要，并保留原有的教师确认流程。无 SQLite 表迁移。

| 验收 | 最终构建结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-lesson-history-final` | 通过，`build.log`。主进程 SHA-256 `bf2e809140a38437413bd6885ec4d40e2a190ccfd8f7bda2e6a5a4309995eab4`。 |
| `node scripts/education/teaching-lesson-electron.mjs --task-editor` | 9/9，退出码 0。通过对话进入实际教案与课堂大纲，打开历史正文及历史依据，核对旧版冲突、关闭焦点、未保存稿、两种尺寸、同会话两案和冷启恢复来源。SQLite 无意外写入，渲染错误和付费调用均为 0。 |
| `teaching-lesson-realignment-boundaries.mjs <上一轮合成教案目录>` | 7/7，覆盖撤回的旧资料仍可读、禁止保存、有效历史依据精确恢复、跨链及过期写入被拒。 |
| `classroom-plan-boundaries.mjs`、`teaching-lesson-boundaries.mjs` | 16/16、10/10。三项领域测试使用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs`。 |
| `node scripts/education/classroom-outline-components.mjs` | 18/18，`outline-components.log`。 |
| `npm.cmd run test:renderer-components` | 253/253，`renderer.log`。 |
| `node scripts/electron-smoke.mjs` | 同构建 207/207，`electron-smoke.log`，附 `electron-e2e/` 截图。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase2-lesson-history`。专项报告、版面和数据在 `xiaozhi-teaching-lesson-ui-zoyiUk/`，源复核见 `restore-boundaries.log`。离线验收入口 `manual-phase2-lesson-history/启动-D3-教案历史预览.cmd`，同目录有手测步骤及窗口证据。依赖审计保留原 20 项，其中 2 项 high。

## Phase 2 退出核对

| 执行包验收项 | 已实现并核对的工程场景 |
| --- | --- |
| 动态首页 | 原 Composer 下按真实审批、待关注任务、近期成果显示。实测双尺寸、空态、跳转和草稿保护。见「动态首页」。 |
| 真实任务、工作台优先和筛选 | 从全局任务入口和教学工作台切换真实任务、成果及筛选。停止回写原 Task 和 Run。见「我的任务与教学工作台」。 |
| 成果独立查看、一个任务多成果、不同任务引用 | 两份真实 HTML 保存于同一任务。另一个任务实际读取引用记录并持久化来源。成果详情按历史版本准确回跳所属任务。见「任务与成果双向定位」。 |
| 版本、历史只读和回滚 | HTML、试卷及课堂设计沿现有账本保留原结果。分别通过实际文件、版本 SQL 与历史界面读回，课堂设计恢复复核旧资料。见各版本专项。 |
| 右侧任务上下文与专业编辑 | 按原提交 Run 谱系核对任务、来源、试卷与教案。专业编辑保存后原对话读取当前版本。同会话另一个独立任务不串卷或串教案。 |
| 重启、失败和不重复写入 | 已在任务、HTML、试卷和课堂设计各专项冷读持久记录。历史预览、选择和恢复前核对保持只读，遇并发或已失效来源有明确结果。 |

Phase 2 工程退出通过。真实教师使用、教学质量和各教学业务新增的专用结构与精确导出仍按 Phase 4 逐项验收。Phase 3 单列教师画像、主动保存、确认与停用、适用范围及最小注入。

## Phase 3 教师记忆运行基线

`phase3-memory-audit/run-1IWNua/report.json` 使用上面同一构建和两份独立 SQLite 数据。明确说「以后讲解详细些，分步骤，先给提示再给答案」后保存一个版本。本次一句话要求没有新建长期版本。另一份本地数据的模型请求没有第一份数据的表达偏好。这一结果覆盖隔离的数据根。

首份数据新对话仅发问候时，拦截的实际模型请求仍带已保存的分步讲解偏好。当前 `production-host` 将 `teacherPreferenceContext` 附加到每轮受保护上下文，偏好表没有适用范围输入。候选通过两个独立纠正样本和一次留出试用，再等教师对试用答复给出正反馈。下一步改造现有偏好与最小注入规则，补充可管理的教师画像和范围。基线复测修正了旧夹具忽略会话侧栏收起的问题，原 `baseline.log` 保留。

## Phase 3 教学偏好按需应用

普通问候与软件操作类咨询省略已保存的教学偏好。适用的讲解按本轮内容选取默认篇幅、步骤和答案顺序，比较类请求才使用已保存的表格偏好。本轮明确指定的字段优先。一句话或只要结论的请求省略讲解默认值。文件格式偏好只在相关导出且格式未指定时进入请求。

宿主只向当轮实际模型请求加入适用指导。无工具答复也沿同一规则。旧宿主合成块从模型历史投影移除，教师原文和原 JSONL 保留。复用 SQLite 偏好版本、候选确认与撤销，无迁移。后续仍需教师画像、手动管理和更具体的适用范围。

| 验收 | 最终构建结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-memory-relevance-final` | 通过，`build-verified.log`。主进程 SHA-256 `e2815d97909d6a6fa20c5c6ec81cf7bdaaf921effc5513b7907056d504d477c8`。 |
| `node scripts/education/teacher-preference-scope-electron.mjs` | 5/5。实际 Electron、原 Pi 与 SQLite，合成 SSE。检查保存、跨对话、同会话改题、一句话覆盖、无工具请求、撤销冷启、独立数据根和可读取的旧原生日志。实际请求字段记入 `d3-memory-scope-rYCDkL/report.json`。渲染错误和付费请求为 0。 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/teacher-preference-scope-boundaries.mjs` | 7/7，`scope-boundaries.log`。覆盖格式优先级、旧摘要和保留图片内容。 |
| `node scripts/education/teacher-preference-example.mjs --implicit` | 18/18，`preference-domain.log` 和 `preference-contract-yUGG95/report.json`。向脚本提供本地验证用的实际 SQLite 副本，验证候选、留出、确认、撤销、幂等与旧版本。 |
| `npm.cmd run test:renderer-components` | 253/253，`renderer.log`。 |
| `node scripts/electron-smoke.mjs` | 同构建 207/207，`electron-smoke.log` 及 `electron-e2e/`。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase3-memory-relevance`。两份失败构建日志分别保留 Pi 请求类型推断和偏好只读属性错误，修复后重新构建。依赖审计保留原 20 项，其中 2 项 high。手测在 `manual-phase3-memory-relevance/启动-D3-教学偏好按需应用.cmd`，另有步骤及窗口证据。正式供应商应答质量留在集中验收。

## Phase 3 教师记忆与偏好范围

教师从「设置 → 教师记忆」保存学科、年级和选填教材。页面显示本机已确认的偏好、当前版本和更新时间。教师可以独立调整每项偏好的使用范围。限定项要求当轮唯一学科和年级均匹配。缺项、不匹配或本轮另有明确格式时省略对应默认值。教材文本保存在本机。未提交的更改可放弃，过期保存由主进程拒绝。

配置保存在现有 `app_settings` 的个人范围键，教师确认的表达值继续使用既有不可变版本。带自定义范围时自动学习暂停，教师仍可明确保存、纠正或撤销。旧库没有个人范围键时继续原按任务规则，无表迁移。降级后新增范围暂不生效，原偏好和会话记录可读。

| Phase 3 退出项 | 验证 |
| --- | --- |
| 教师画像、来源和确认 | 从真实设置页选择、保存、放弃或清除。原偏好来自已记录的教师对话确认，设置版本、偏好版本和请求独立核对。已实现。 |
| 长期与临时、主动确认和纠正 | 同会话与跨会话使用，临时一句话请求优先。候选、留出、确认、撤销及幂等通过，重启读回存档。已实现。 |
| 适用范围、冲突与停用 | 八年级物理应用限定篇幅，九年级或跨年级提问省略。同一项恢复启用后下次请求可用，其他项保持独立。不相关的问候不含偏好。已实现。 |
| 个人隔离和最小注入 | 两份本地个人数据根读回隔离，教材文本未进入模型请求。旧原生日志保留，适用偏好仅补到当轮模型请求。已实现。 |

个人版 Phase 3 工程退出通过。真实教师使用及真实供应商回复效果留在集中验收，完整团队空间依 D24 后置。Phase 4 从自动组卷的自然语言、蓝图、来源和质量读回开始。

| 测试或运行 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-teacher-memory-settings-verified` | 通过，`build-verified.log`。主进程 SHA-256 `c649280df4edc58470fc9faf0b90276a580e07c64b837d78f06f8eb40ed1fa49`，preload SHA-256 `899483414ab804a8a8cb4d8a32c7885a14cc9c40f0c388206e4470839631095a`。 |
| `node scripts/education/teacher-preference-scope-electron.mjs` | 最终构建 7/7，实际 Electron、Pi 请求拦截与 SQLite，1366×768 和 1920×1080 已截图。报告 `d3-memory-scope-DSeSza/report.json`。0 付费调用，0 渲染异常。 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/teacher-preference-scope-boundaries.mjs` | 9/9，`scope-boundaries.log`。 |
| `node scripts/education/teacher-preference-example.mjs --implicit` | 18/18，`preference-domain.log` 与 `preference-contract-JqBgNQ/report.json`。 |
| `npm.cmd run test:renderer-components` | 253/253，`renderer.log`。 |
| `node scripts/electron-smoke.mjs` | 首个设置页构建 `d3-teacher-memory-settings-final` 207/207，`electron-e2e/`。最终构建的范围校验和设置页间距改动由上述专项复测。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase3-teacher-memory-settings`。早期三份报告保留模型轮次断言、下拉动画重叠及返回对话同步等待的测试故障，最终按实际请求与可发送状态复跑。依赖未变，审计记录既有 20 项提示，其中 2 项 high。

已启动最终构建的独立验收窗口。人工启动与步骤在 `manual-phase3-teacher-memory-settings/启动-D3-教师记忆.cmd` 和 `验收步骤.md`，`window-verification.json` 记录实际运行路径、窗口和哈希。

## Phase 4.1 组卷蓝图与实际选题

教师在原对话里给出明确的全卷约束。原任务准入核对模型蓝图。已支持的约束包括全卷题量、总分、时长、具名科目和年级、逐类题数、原题库限定、必选知识点清单及带档位的难度比例。错误蓝图返回具体类别的拒绝回执，修正后继续同一任务。引文、示例和范围型要求保持由老师与模型澄清。

选题、快照和预览复用已经在题库使用的题型与年级匹配规则。试卷核对显示每节题数、分数、题型、难度与知识点，并显示蓝图和实际三档难度题数。难度比例按题量计算，每档允许偏差 5 个百分点。参考答案与解析继续保留原来源和教师审阅。只有蓝图一致的候选可以确认。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-paper-blueprint-verified` | 通过。主进程 SHA-256 `0c87c8ee2c80b111ae9682bdb5408722ef50c1d503eeeebe05a836d3d7c092f1`。Preload SHA-256 `899483414ab804a8a8cb4d8a32c7885a14cc9c40f0c388206e4470839631095a`。 |
| `node scripts/education/paper-edit-sync-electron.mjs --requirements --restore` | 6/6。实际 Pi 接到 8 分提议失败回执，5 分提议成为唯一候选。验证双尺寸、教师确认、分值局部编辑、版本冲突、历史恢复、原任务及冷启。报告 `paper-edit-sync-3Dls55/report.json`。 |
| `node scripts/education/paper-edit-sync-electron.mjs --export-selected` | 6/6。学生和教师版 Word 从所选的 7 分编辑版导出，文件和数据库冷读一致，答案保留在教师版。报告 `paper-edit-sync-13efuJ/report.json`。 |
| `Get-Content -Raw legacy-readback.mjs \| node --input-type=module -` | 实际旧版合成数据库的 4 条试卷快照原样保留。新版窗口显示历史题型及未限定的难度。没有重放模型。报告 `paper-legacy-VG34km/report.json`。 |
| 组卷履约、宿主准入与组件测试 | 9/9、12/12、253/253。分别验证难度与题型错配、来源配额、授权和任务绑定、首轮错误不触发业务写入，及现有渲染组件。 |
| `node scripts/electron-smoke.mjs` | 最终构建 207/207，`electron-smoke.log` 与 `electron-e2e/`。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-paper-blueprint`。前一版边界用例因新增题型题数核对改变了预期，更新断言后复跑；失败报告 `xiaozhi-paper-fulfillment-xidi8r/report.json` 保留。依赖未变，审计现有 20 项提示，其中 2 项 high。模型响应为本地合成，0 付费调用。不同学科的真实题目答案抽样及正式教师使用体验留待集中验收。

最终构建已在 `manual-phase4-paper-blueprint` 启动。启动器为 `启动-D3-自动组卷核对.cmd`，文档提供查看、修改、恢复和可选模型试用步骤。

## Phase 4.1 试卷版本的模型读回

组卷确认后，Pi 收到与本机确认快照一致的试卷 ID 和摘要。读卷可沿 ID 跟随同一份卷的编辑链，或在同时给出原确认摘要时读取指定历史版。按老师给出的完整标题也可定位。无参数优先核对当前 Run 与任务记录，只有一个可确认的会话结果时才直接读取。多份独立卷会返回选择，未确认、摘要不符与无法找到的引用都有独立提示。

读取在原试卷事务上核对会话归属、版本和题源。源题变化时仍可查看确切历史记录，回执明确标记来源变化。卷名等文本先脱敏再序列化，宿主生成的引用可无损回传。旧 SQLite 和教师编辑记录无需迁移。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-paper-read-identity-verified` | 通过。主进程 SHA-256 `1ac54a29124a307f65f798016ec10a9bab730da1ed87a5ef9d3a42dbdbbd25f2`。 |
| `node scripts/education/paper-agent-read-electron.mjs` 及 `--source-changed` | 最终构建 8/8。另一独立卷晚于编辑版时，无参数返回歧义。原 ID 获取 7 分编辑版，原摘要获取 5 分版，完整标题命中独立卷。错误摘要和未知 ID 拒绝，变更合成题源后仍读到确切快照并标记题源变化。两次冷启无重放，试卷记录逐字保留。报告 `paper-agent-read-8Ay8IN/report.json`、`paper-agent-read-aWHbmX/report.json`。 |
| `node scripts/education/paper-edit-sync-electron.mjs --requirements --restore` | 最终构建 6/6。真实确认回执的试卷 ID 和摘要与 SQLite 一致，候选纠错、编辑和历史恢复继续通过。报告 `paper-edit-sync-NZxHgk/report.json`。 |
| 组卷履约、宿主准入、渲染组件 | 11/11、12/12、253/253。覆盖任务归属优先、同一编辑链合并、待确认隔离、引用脱敏、原教师确认和旧组件。 |
| `node scripts/education/paper-fulfillment-electron.mjs` | 最终构建 5/5。通过实际题本录入，先报缺 2 题，再生成 6 题 30 分的完整组卷。三个知识点各 2 题，三档难度各 2 题，6 条题源版本无重复。用独立算式复核 6 道合成题答案，保留原解析。实际 Pi 读回和桌面预览一致，冷启保留数据库、原生日志和工具记录。报告 `xiaozhi-paper-fulfillment-ui-Y0Fxdb/report.json`。 |
| `node scripts/electron-smoke.mjs` | 首个读卷构建 207/207，`electron-smoke.log` 与 `electron-e2e/`。最终构建文字脱敏变更已通过上述同构建专项。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-paper-read-identity`。六题早期复测在旧夹具找不到已折叠的题本和组卷入口，修正定位器后复跑，两个失败报告保留。本轮无依赖更新，审计记录原有 20 项，其中 2 项 high。模型响应为本地合成，0 付费调用。独立运行窗口、重启脚本和步骤在 `manual-phase4-paper-read-identity`。

确认回执与精确版本读回、同会话双卷歧义、题源变化和冷启保持均已实现。六题结果证明所测试的知识点配额和答案算式，真实教学样本仍按集中验收处理。

当时试卷卡已具备精确版本导出，纯对话导出仍按最近确认版处理。下述交付解决了该缺口。

## Phase 4.1 对话精确导出与自动组卷工程退出

对话直接说完整卷名后，Pi 读取该确认卷的 ID 与摘要，导出工具再次核对同一份卷及当前题源，再交给原 Office 审批。无引用时沿任务选择，独立卷有歧义会返回教师选择。此前从试卷卡明确点选的宿主绑定优先。已替代的版本或来源变化均沿原检查拒绝，旧请求不会改用另一份卷。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-paper-conversation-export` | 编译及类型检查通过。主进程 SHA-256 `b2d4942fca38eb6270cedca24397166046434780ef3fed27b062eb566f0e68d1`，Preload `899483414ab804a8a8cb4d8a32c7885a14cc9c40f0c388206e4470839631095a`。 |
| `node scripts/education/paper-conversation-export-electron.mjs` | 4/4。实际输入对话、真实 Pi 读卷回执、SQLite 精确审批草稿、批准前无文件。两份 Word 均来自 7 分卷，教师版保留解析，学生版省略。无明确目标时未创建审批或文件。冷启核查实际文件与记录。报告 `paper-conversation-export-l4mi7q/report.json`。 |
| `node scripts/education/paper-edit-sync-electron.mjs --export-selected` | 6/6。原试卷卡点选、真实编辑、精确学生和教师版、历史和冷启。报告 `paper-edit-sync-zvtgQS/report.json`。 |
| `paper-export-intent-test.mjs`、`paper-export-boundaries.mjs`、`paper-export-intent-race-test.mjs` | 10/10、21/21、4/4。覆盖绑定错误、歧义与待确认、源变化、正式文件安装前复核和旧合同兼容。 |
| `npm.cmd run test:renderer-components` | 253/253。 |
| Word 16.0 与 WPS 12.0 只读打开实物 | 4/4。学生版、教师版都为 A4 且显示 7 分，解析只在教师版。打开前后文件摘要相同。见 `native-office-readback.json`。 |
| `node scripts/electron-smoke.mjs` | 前端验收 207/207，覆盖 1366×768 和 1920×1080。总结果为 `ok: true`，见 `electron-smoke.log`。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-paper-conversation-export`。使用本地合成模型响应，0 付费调用。依赖未更新，审计仍为既有 20 项，其中 2 项 high。独立验收窗口和操作文档见 `manual-phase4-paper-conversation-export`。

Phase 4.1 工程路径已贯通。按教师约束确定性选题、配比和分值核对、明确缺额、教师确认与来源、局部修改、版本读回与恢复、对话和试卷卡精确导出均已实现。真实教师使用效果及多个真实题集的学科质量仍留给集中验收。继续 Phase 4.2 可编辑教学讲义。

## Phase 4.2 可编辑讲义草稿

教师在「问小智」要求制作讲义或学案后，可从原对话进入讲义编辑器。草稿按章保存学习目标、重点难点、分步例题与不同难度的练习。实际采用的内容附本轮读取过的段落和引文。资料列表打开对应原文，教师可以改一个内容块，原稿其他块和来源保留。

原 SQLite 讲义表仍保存正文。新表关联任务、工具调用和段落版本。同一个 Run 的重复相同提交返回同一份讲义，变更参数试图再保存一份会被拒绝。判定已提交的副作用使用独立的事务回执。保存草稿等待老师核对。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-teaching-handout` | 构建和 TypeScript 检查通过。主进程 SHA-256 `102fcd55b78965f34afbf42397752da7bb1babbce9aeeac94281bafbb9435bb9`，Preload `899483414ab804a8a8cb4d8a32c7885a14cc9c40f0c388206e4470839631095a`。 |
| `node scripts/education/teaching-handout-electron.mjs` | 6/6。正式 Electron 与 Pi，从资料库正常导入本地 Markdown，在对话核对错误引文、真实保存与日志回执、精确打开、双尺寸和本地公式排版、跳到引用段、局部保存、冷启无模型重放、资料同摘要下段落变化。报告 `teaching-handout-lJsTgQ/report.json`。 |
| `npm.cmd run test:renderer-components` | 253/253。 |
| 旧讲义存储和 Markdown 预览测试 | 26/26、28/28。两条旧脚本需 Node ESM 兼容启动参数以供打包进测试的 Electron 入口使用，见 `book-workspace-node-compat.log` 与 `book-renderer-node-compat.log`。原失败日志保留。 |
| 上一版 SQLite 副本启动 | 1/1。上一轮实际 Electron 组卷数据从无讲义关联表升级，三份旧试卷确认记录逐字段相同，原对话卡可见，两张新表初始化且完整性检查通过。报告 `migration-from-paper-kECttd/report.json`。 |
| `node scripts/electron-smoke.mjs` | 最终构建 207/207，覆盖 1366×768 与 1920×1080，总结果为 `ok: true`，见 `electron-smoke-final.log`。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-editable-handout`。独立启动、教师操作步骤及已核对窗口在 `manual-phase4-editable-handout`。本切片使用合成资料与本地模型响应，0 付费请求。生产依赖审计仍有 20 项，其中 2 项 high，本轮没有修改依赖。

后续验证讲义历史恢复、对话细化修改、确认与精确的学生/教师 Office 交付。真实学科质量和教师采用率仍待集中验收。

## Phase 4.2 讲义教师确认与恢复

老师在现有讲义编辑页查看「确认与版本」。确认前显示只读草稿，实际保存绑定所见正文摘要和当前引用。局部编辑推进草稿，已确认版仍可单独预览。恢复前保留草稿与补丁，再把所选历史正文放回同一讲义；旧编辑节点失效，新草稿等待老师确认。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-handout-versions-review` | 构建和 TypeScript 检查通过。主进程 SHA-256 `b4bcbcedb693dc47e5505383d17f5dc1b647e67d66dbbfa0d0e421ed6dab22c9`，Preload `dacbfb955b343901bbc5fd68aa3d6ce140e563cc8f810e0b56f2afe1274bfae0`。 |
| `node scripts/education/teaching-book-versions-electron.mjs` | 最终构建 5/5。迁移真实旧讲义库、Esc 无写入、教师确认、重复确认复用、局部与新增章节、历史正文、过期恢复拒绝、恢复前补丁、旧节点写入拒绝、来源漂移和冷启。1366×768 核对步骤编号与公式，1920×1080 检查历史正文。报告 `teaching-book-versions-qTn9yD/report.json`。 |
| `node scripts/education/teaching-handout-electron.mjs` | 6/6。原对话生成、引用核对、编辑和冷启回归。运行构建的主进程及 Preload 与最终构建摘要一致。报告 `teaching-handout-28d4PZ/report.json`。 |
| `npm.cmd run test:renderer-components` | 253/253。 |
| `node scripts/electron-smoke.mjs` | 两次均 207/207，覆盖 1366×768 和 1920×1080。综合回归构建与最终构建使用相同主进程及 Preload。最终讲义版本预览样式另经本表专项核对。见 `electron-smoke.log`、`electron-smoke-final.log`。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-handout-versions`。早期复测保留 SQLite 夹具写锁和模态预览列表样式问题，已分别通过等待写锁和 UI 样式边界修正。独立验收窗口、启动与操作步骤在 `manual-phase4-handout-versions`。样本为合成讲义，本次确认和恢复过程无模型派发，不计付费请求。生产依赖审计维持 20 项，其中 2 项 high，本轮没有修改依赖。

对话指定讲义后提交局部修改、章节与题目精细修改和两种受众 Word 交付仍待贯通。历史快照在界面展示正文与补丁数量，补丁详情保存在快照。真实教师采用率留给集中验收。

## Phase 4.2 对话导出已确认讲义

从原对话指定已确认讲义，选择学生版、教师版或两份一并保存。文件使用同一确认版本；学生版含例题和分层练习题面，独立练习答案、解析与参考资料在教师版。教师写入学生可见内容块的授课提示随正文导出。Word 正文可以编辑，公式单独排版为图片。在拟内容的「来源」可以核对受众，正文修订从讲义编辑器进行。

现有 Office 审批负责预览、教师决策、生成、磁盘安装和文件账本。成组文件只审批一次。发布前复核讲义及引用摘要，审批时资料变动会结算为冲突。任务从实际文件回执核验，失败仍保留历史与原先的文件。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-handout-export-routing` | 最终构建与 TypeScript 检查通过。主进程 SHA-256 `6372e7584a87405f0efdf2067a9978661f2560e90875aad336ddd10d1e23be95`，Preload `dacbfb955b343901bbc5fd68aa3d6ce140e563cc8f810e0b56f2afe1274bfae0`。 |
| `node scripts/education/teaching-handout-export-electron.mjs` | 4/4。1366×768 两份一次审批，1920×1080 单份审批，候选之后资料漂移拦截，冷启文件与事实读回。文件摘要、公式和截图见 `handout-export-ouYVZS/report.json`。SQLite 两种保存核验通过，过期来源保留待核对回执，见 `task-journal-routing.json`。 |
| `node scripts/education/teaching-handout-electron.mjs --word-request` | 6/6。带 Word 字样的新编请求仍生成可编辑草稿。顺带回归精确引文、重复提交、编辑与冷启。报告 `teaching-handout-41DPb0/report.json`。 |
| `npm.cmd run test:renderer-components` | 253/253。最终审批和路由修复均在主进程。 |
| `node scripts/electron-smoke.mjs` | 审批修复构建 207/207，覆盖双尺寸，见 `electron-smoke-final.log`。最后的工具选择规则通过最终构建的两个专项验证。 |
| 本机 Office 只读打开 | Word 16.0 与 WPS 12.0 各打开最终构建产生的学生版及教师版，4/4。核对 A4、分层练习、公式数量及答案隔离，文件摘要保持一致。见 `native-office-readback-routing.json`。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-handout-export`。初次合成模型测试的旧回执解析问题、受众断言误把正文内授课提示当独立答案、确认后资料漂移导致挂起均留有原日志。最终测试使用合成模型响应，0 付费请求。生产依赖审计仍有 20 项，其中 2 项 high。无依赖变化和新数据库迁移。本小项 **已实现**。

手工验收窗口、启动 CMD 与操作说明在 `manual-phase4-handout-export`，使用独立数据。旧构建可继续读取原讲义及其历史，在磁盘打开新生成的 DOCX；回退后的旧构建可能无法识别新 Office 草稿及审批记录。下一项是通过对话细化修改同一份讲义，上海模考汇编、教案与自然模型质量仍待继续。

## Phase 4.2 从对话精准修改讲义

老师可以在原对话指定讲义和章节、唯一选区或练习。审阅卡并排展示修改前后，支持不修改题干的独立难度调整。更换题干须给出答案和解析，老师核对后同次存入。应用只改变约定范围，保留原来源和已有确认记录，修改后的草稿等待确认。撤销整次审阅从讲义历史里选择「修改前保留」。

沿原 Pi、同一任务和确认流程保存。增量迁移新增 `teaching_handout_edit_reviews`，正文仍在原讲义表。单事务完成版本及段落补丁，教师拒绝、停止、原文或引用变化都不写正文。重启时待审批项结算为中断。旧构建仍能读取讲义及其正文，旧界面可能不显示新增版本标签与审批记录。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-handout-edit-targeted` | 构建和 TypeScript 检查通过。主进程 SHA-256 `060b450e2a3a4c36b16528904e9d693e12e905207e656e7c272ebb0246f1ede3`，Preload `c2317212460176b53e4e4fb3d7731a39ef632b4fd5fae8ac60eb53a27ecc2681`。 |
| `node scripts/education/teaching-handout-edit-electron.mjs` | 最终构建 7/7。覆盖单块定向读取、错误选区、待审批无写入、正确章节和练习差异、重复确认、拒绝、并发冲突、来源漂移、停止、冷启及历史恢复。报告 `handout-edit-vBCtqf/report.json`。 |
| `node scripts/education/teaching-handout-export-electron.mjs` | 最终构建 4/4。学生及教师版、审批、来源漂移和文件读回回归通过。报告 `handout-export-y4UCAR/report.json`。 |
| `npm.cmd run test:renderer-components` | 253/253。最终差异列表另由 Electron 验证滚动高度、对照排版、公式及实际审批。 |
| `node scripts/electron-smoke.mjs` | 双尺寸 207/207，见 `electron-smoke.log`。综合回归所用构建与最终构建的差别是读取单个内容块的工具参数，最终构建专项覆盖该参数。 |
| 真实模型单场景 | 最终构建 1/1。DeepSeek 独立定位第 2 道练习，从巩固改为拓展。预览只有这一处差异，批准后题面、答案、解析和其他块保持原值。最终版 4 次模型请求，前一轮同场景 3 次，合计 7 次，均为合成资料。报告 `natural-routing-3pNsjR/report.json` 和 `natural-routing-lLXwOV/report.json`。 |
| 持久化 Journal 读回 | 连续记录待审批与已应用，已应用效果在恢复回执中为 `recorded`。见 `durable-edit-journal.json`。 |

验收证据存放于 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-handout-edit`。最初编译缺少可选 preload 检查，首轮历史测试读到加载中状态，两项原记录保留。差异列表已修正为 CSS 模块，最终截图说明内容与操作可达。手动验收窗口使用最终构建，独立合成数据、启动 CMD 和操作步骤在 `manual-phase4-handout-edit`。依赖审计仍有既有 20 项，其中 2 项 high，本轮未改依赖。

本小项 **已实现**。Phase 4.2 从会话生成、精细修订、审核确认、可编辑 Word、版本与历史恢复的工程路径通过。真实模型单样本不支持对整体学科质量和教师采用率下结论。下一阶段为上海各区模考汇编，后续继续教案生成与集中验收。

## Phase 4.3 上海模考年度目录

教师从「问小智」按年份和可选学科、年级发起目录。小智读取资料库已有文件名与可用正文首段，列出区、年份、年级、学科、轮次、解析状态和答案册。相同文件摘要归并。同一分类下内容不同的卷由教师选定。区名词表按上海市政府公布的 16 个区校对。 [上海市人民政府区政府网站](https://www.shanghai.gov.cn/nw42858/)

教师可修正字段、排除重版、区分待核与允许本地使用，并确认目录。确认复核所选题卷和实际答案册文件摘要，保持已保存版本及原件。已有答案册配对表示原件关联。实际题目、答案正确性和页面完整性继续按原件核对。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-catalog-review` | 编译与 TypeScript 检查通过。主进程 SHA-256 `aab7819a26415eec1aa19628c40e09cb89d2503dc1f75df7b56d2f77ed0e8746`。 |
| `node scripts/education/mock-exam-catalog-electron.mjs` | 同一构建 4/4。资料库导入 6 份合成 PDF 及 1 份 Markdown，实际 Pi 调用生成草稿。题卷与答案册定位、重复与冲突字段、老师确认、跨会话访问拒绝、原件变化、SQLite 版本和原调用回执、冷启无重放通过。见 `mock-exam-catalog-ZGOamD/report.json` 及两种尺寸截图。 |
| `npm.cmd run test:renderer-components` | 253/253。目录卡布局和操作另见 Electron 专项双尺寸。 |
| `node migration-check.cjs` | 1/1。使用上一版 Electron 测试库的 SQLite 备份运行同一构建，保留两份原讲义，追加两张表，完整性检查为 `ok`。见 `migration-C2zYGz/report.json`。 |
| `node scripts/electron-smoke.mjs` | 最初构建综合回归 207/207，覆盖 1366×768 和 1920×1080，`electron-smoke.log` 的 `ok` 为 `true`。之后调整了目录的解析完成状态标签与卡片样式，最终构建由本表同一专项复测。 |

证据根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-catalog`。验收窗口、启动 CMD 及步骤在 `manual-phase4-mock-exam-catalog`。首轮 PDF 正文解析返回 `configuration`，首轮保留。复测用成功解析的 Markdown 测正文冲突，PDF 用于原件、未解析状态及配对检查。原件定位以实际 IPC 校验，到达操作系统调用时捕获所选路径。模型使用本地合成响应，付费请求 0 次。原有生产依赖审计 20 项，其中 2 项 high，无依赖变更。

年度目录、独立版本和教师确认 **已实现**。回退到旧构建仍能读原资料、题本和讲义，新增目录使用新构建读取。成果工作台、对话修订、历史恢复、实际导出，以及真实 PDF 缺页、扫描和分栏专项继续在 Phase 4.3 执行。

## Phase 4.3 模考成果工作台与目录版本

教师可以从「教学工作台 → 教学文件 → 模考汇编」查找按实际目录版本显示的成果。从目录打开来源任务及原对话，从任务回到同一目录。当前任务右栏可查看试卷、答案册、地区、年份和解析状态。工作台使用既有只读查询，按目录 ID 和原 Run 关联，现有文件目录及版本链继续使用文件自己的身份。

历史按原来保存的条目只读审阅。恢复把所选历史分类及收录选择保存为新待核对版本，保留恢复前版本以及当时的确认。当前禁止使用的条目不会重新收录。原件或答案册变化拒绝写入，当前或所选历史摘要不匹配也拒绝写入。没有新增表和数据迁移，回退构建时旧对象和快照仍保留。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-workbench-final` | 编译与 TypeScript 检查通过。主进程 SHA-256 `390ba9305b510ba25722f707968164926830c974a212d438532e5b5647038fc4`。 |
| `node scripts/education/mock-exam-catalog-electron.mjs --pdf-text` | 最终构建 7/7，见 `mock-exam-catalog-EdR9Up/report.json`。七份合成 PDF 从资料库实际导入并解析。验证 PDF 正文和文件名冲突、工作台检索、双向任务关联、来源对话与右栏、历史只读、未保存保护、过期恢复、旧许可限制、原件已变拒绝恢复、冷启动。含 1366×768 和 1920×1080 截图。 |
| `npm.cmd run test:renderer-components` | 253/253，见 `renderer-final.log`。 |
| `node scripts/xiaozhi-agent/phase7-workbench-read-smoke.mjs` | 16/16。真实 SQLite 只读、任务、审批、能力查询及现有合同回归，见 `workbench-read.log`。 |
| `node scripts/electron-smoke.mjs` | 本切片首个构建综合回归 207/207，双尺寸通过，见 `electron-smoke.log`。最终构建仅再改了导航提示清除及答案册名称展示，最终专项复验覆盖两处。 |
| `node scripts/xiaozhi-agent/html-versions-electron.mjs --relations` | FAIL。当前构建与前一模块构建都在第一次 HTML 审批停于 `executing`，两次都未到达关联查询。见 `html-relations.log` 和 `html-relations-baseline.log`。保留为现有 HTML 专项未通过。 |

上轮 `configuration` 由隔离开发工作树中 `omni-edu-ocr.exe` 和 `_internal/base_library.zip` 摘要不匹配引起。原件已在验收根备份。替换件按仓库锁定清单复核，712 个文件校验一致，见 `ocr-recovery.json`。应用源代码的校验逻辑未改。首次工作台测试的冷启定位器仍引用旧窗口，失败记录保留，最终用新窗口定位完成。使用本地合成模型，0 付费请求。生产依赖审计仍为既有 20 项，其中 2 项 high，无依赖变更。

本小项 **已实现**。验收证据集中于 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-workbench`，验收窗口、CMD 及步骤在 `manual-phase4-mock-exam-workbench`。对话局部修订、实际导出以及真实 PDF 的缺页、扫描、分栏、公式和图表仍待完成。

## Phase 4.3 从对话精确修订目录

老师在原对话可以要求修正某份卷的分类或收录状态。小智先读明确目录与原件身份，再提交受限的字段差异。原轮成功结束后老师核对，应用时生成同一目录的新待核对版本。源文件、答案册配对、解析信息、使用许可和无关条目保持各自原来的记录。同名目录交给老师选择。

`mock_exam_edit_reviews` 为增量表。提案与会话、任务、Run、generation、原工具调用和摘要绑定。教师决定与目录新版本同事务保存。拒绝、停止、来源变化和旧版本提案不产生新目录版本。成功轮次的待核建议在重启后仍可处理。回退到旧构建，已保存的目录新版本仍可查看。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-edit-routing` | 构建及 TypeScript 检查通过。主进程 SHA-256 `bfe42162e302ede72aef4f9111ec437a27cce5e44f4d3c1c326a9e3420008ab5`。 |
| `node scripts/education/mock-exam-edit-electron.mjs` | 最终构建 6/6。基于上一版已验证的真实 SQLite 和七份合成 PDF，修改从真实桌面对话发起，保留原任务，1366×768 可核对差异，1920×1080 冷启应用。核对其他条目、旧版本、重复应用、拒绝、提权拦截、原件和版本冲突、停止、同名目录歧义。见 `mock-exam-edit-Rm2ytY/report.json`。 |
| `node scripts/education/mock-exam-catalog-electron.mjs --pdf-text` | 最终构建 7/7。实际 PDF 解析、确认、工作台、任务跳转、右栏和历史恢复回归，见 `mock-exam-catalog-MMjoRS/report.json`。 |
| `npm.cmd run test:renderer-components` | 253/253，见 `renderer.log`。路由定向修正在主进程，最终构建的组件产物与组件测试时使用的修订样式相同。 |
| `node scripts/electron-smoke.mjs` | 207/207，`electron-smoke.log` 的 `ok` 为 `true`。综合回归使用路由定向修正前的构建，最终修订与目录两个专项使用修正后的同一构建。 |

验收根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-edit`。手动验收窗口、CMD 和步骤在 `manual-phase4-mock-exam-edit`，已保留待核对建议。首轮克隆测试打开了另一条会话。复测发现「只改」命中创建而非修订，已修正。Pi 对越权字段的原生文本错误加入测试断言。失败报告保留。使用本地合成模型响应，0 付费请求。生产依赖审计为既有 20 项，其中 2 项 high，无依赖变更。

对话精确修订 **已实现**。继续 Phase 4.3 的实际文件导出，以及真实扫描、缺页、分栏、公式与图表质量验收。

## Phase 4.3 Word 和 PDF 模考目录

「教学工作台 → 教学文件 → 模考汇编」对确认版显示 Word 和 PDF 导出入口。工作台传入明确的会话、目录编号、修订、摘要与格式。原对话也接受导出请求，使用同版 Word 和 PDF 时可一次审阅。宿主从当前记录编译分区目录、原件出处、许可及答案册配对状态，待核对的同名目录不能生成文件。预览可查看来源，目录内容在来源页修改并重新确认。

沿用 Office 审批、正式文件台账和整包一致性核对。审批及安装前核对源版本和实存文件，拒绝、来源漂移或目标冲突时不覆盖。没有 SQLite 迁移。旧构建仍可通过文件系统打开导出的目录。目录包含索引和来源证据，试卷与答案册原件另经许可打包。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-export` | TypeScript 与 Electron 构建通过。主进程 SHA-256 `36e82562b654682c2c93fa1522161243f16b32407e51dc70adfa12e332db1ed9`。 |
| `node scripts/education/mock-exam-export-electron.mjs` | 4/4。实际 Electron 操作覆盖待核目录无按钮、同名错误目标拒绝、指定版本和格式、预览与审批、Word/PDF 文件及账本摘要、答案册实存字节变化、拒绝和冷启。见 `mock-exam-export-i0MFGI/report.json` 及两种窗口尺寸的截图。第一次测试使用了未展开对话卡的导航入口，改为从教学文件打开。首次失败报告保留。 |
| `npm.cmd run test:renderer-components` | 253/253，见 `renderer.log`。 |
| `node scripts/electron-smoke.mjs` | 同一最终构建的桌面综合回归 207/207，见 `electron-smoke.log`。 |
| `node scripts/education/teaching-handout-export-electron.mjs` | 现有讲义单份及整包 Office 回归 4/4，见 `handout-export-Kxqf8W/report.json`。第一次选的是待确认讲义，替换为从已确认演示快照取得的样本。 |
| Word、WPS、PDF 实文件读回 | Word 16.0、WPS 12.0 只读打开同一 DOCX，确认 A4 和关键文本。PDF 按 A4 读取页面和中文内容。见 `native-office-readback.json` 和导出报告。 |

专项验收根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-export`，手动启动、步骤与实际窗口身份保存在同一验收根的 `manual-phase4-mock-exam-export`。专项运行使用本地合成模型响应，0 付费请求。生产依赖未变，审计现有 20 条报告，其中 2 条 high。

Word/PDF 目录导出 **已实现**。两种格式只保存一份时，已保存文件保留。剩余格式可从当前确认版单独发起，原包接续仍待补齐。下一项为保留原始字节、逐份核对用途许可的原件包，随后检查真实缺页、扫描、分栏、公式与图表。

## Phase 4.3 模考原件包

已确认目录的「预览原件包」逐条显示试卷和答案册入包结果。试卷许可与独立答案册许可各自核对。两边使用原件字节，分别存入 ZIP 的「试卷」和「答案册」目录。随原件保留的卷内答案、未收录、许可待核、禁止、缺答案和答案配对过期由清单明示。仅保存到本机的教学文件。问小智要求打包时，可先核对明确目录与许可，教师在目录卡或教学工作台确认保存。

答案册许可绑定资料编号、文件摘要和配对修订。旧目录默认待核，当前版本的同源许可用于历史恢复。新增 `mock_exam_archives` 记录暂存身份、相对名称与产物摘要，已保存记录投影到教学文件。按当前确认快照去重，保存阶段独占目标并在提交前复核源文件和授权。若正式文件已安装而记录未结算，确认同版时核对原文件后补记，无需重新生成。上一版可继续读取原有普通文档，ZIP 可通过本地文件系统读取。

| 测试 | 结果 |
| --- | --- |
| `npm.cmd run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-archive` | TypeScript 和 Electron 构建通过。主进程 SHA-256 `057d6b98557d710f25f233760296a9ae18b41b1b6d4cffee4f488517063398ea`。 |
| `node scripts/education/mock-exam-archive-electron.mjs` | 5/5。已确认目录和答案册独立许可、无授权或旧快照拒绝、取消预览、源字节变化、实际 ZIP 和清单打开、两种窗口尺寸、自然对话能力路由、当前相同版本幂等、冷启补记。实际桌面与 SQLite 报告 `mock-exam-archive-Gobk3H/report.json`。首次专项的文件标题定位器命中详情标题和摘要标题，改为层级明确的标题。 |
| Windows `Expand-Archive` | 实际 ZIP 解压出的清单、说明、试卷和答案册 4/4 摘要与专项一致。见 `windows-archive-readback.json`。 |
| `node scripts/education/mock-exam-export-electron.mjs` | 原 Word/PDF 导出回归 4/4，见 `mock-exam-export-TaX6Rh/report.json`。 |
| 备份恢复读回 | 从真实设置页导出备份并准备新数据根。用同一构建单独打开恢复副本，源目录关联保留，ZIP 从新根定位，原件包哈希一致。见 `portable-archive-readback.json`。 |
| `node scripts/electron-smoke.mjs` | 同一最终构建 207/207，见 `electron-smoke.log`。 |
| 上一构建回退读回 | 带原件包行的隔离数据库使用上一构建打开真实教学文件页，原 PDF 和 Word 记录均可读。见 `previous-build-readback.json`。 |
| `npm.cmd run test:renderer-components` | 253/253，见 `renderer.log`。 |

专项验收根为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-archive`。已启动隔离验收窗口，`manual-phase4-mock-exam-archive` 保存 CMD、步骤和窗口构建核对。对话验收使用本地模拟服务，0 付费请求。直接在目录打包无需模型。生产依赖未变，审计保留原有 20 条报告，其中 2 条 high。

原件 ZIP **已实现**。单包最大 64 MB，超出可按学科、年级或考试轮次分批。正式真实样本的扫描、缺页、分栏、公式和图表质量仍在 Phase 4.3。

## Phase 4.3 模考文件组续做

老师可从「教学文件 → 整包任务」选择部分保存的模考 Word／PDF。宿主沿已有任务及要求版本核对确认目录、来源和已保存文件。原 Word 保留，缺失 PDF 可提交不同文件名并单独确认。来源或既有文件变化时，工作台保留当前详情并显示原因。继续使用既有任务、整包和 Office 文件账本，无数据库迁移。返回之前的构建可继续读取原目录及已生成文件，续做入口随代码版本回退。

| 测试 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-resume-ship` | 通过，含 TypeScript 检查。主进程 SHA-256 为 `4f49adb3593d1396406433ed59da39a7d94b841fe205f03a847f631ad2dfd706`。 |
| `npm run test:renderer-components` | 253/253。 |
| `node scripts/electron-smoke.mjs` | 最终构建 207/207，见 `ship-smoke/electron-smoke.log`。 |
| `node scripts/xiaozhi-agent/pi-task-store-smoke.mjs` | 最终构建 11/11。 |
| `node scripts/education/mock-exam-delivery-resume-electron.mjs` | 最终构建 4/4。实际磁盘目标占用产生部分保存，重启后拒绝变化的来源，拒绝改名已保存 Word 后同轮只补 PDF，冷启动读回两份文件与父子文件组。核对原 Word 摘要与修改时间，原占用文件字节保持一致。两种尺寸截图随报告。付费请求 0。 |
| `npm audit --omit=dev --json` | 原有依赖告警 20 项（2 项 high）。此切片没有依赖变动。 |

证据位于 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-resume`。最终专项日志为 `resume-ship-retest.log`，报告为 `mock-exam-resume-2eaC3s/report.json`。同目录 `durable-readback.log` 核对计划版本仍为 1，整包保存条件有实际读回凭证，教师最终审查仍待确认。保留历史失败记录，覆盖错误提示刷新丢失、模型未收到明确续做绑定、拒绝改名后意图错误保留、测试指向构建尚未生成的目录及一次 Playwright 调试连接异常。验收窗口使用独立资料库，启动、构建核对和步骤保存在 `manual-phase4-mock-exam-resume`。

模考 Word／PDF 原任务续做 **已实现**。真实资料验收已准备一份四页杨浦区扫描卷与保留原件的三页缺页对照，本地 OCR 分别处理了四页和三页。继续核对资料库和汇编的缺页、分栏、公式与图表结果。真实模型按自然语言处理该续做路径和老师正式体验仍待验。

## Phase 4.3 模考原件页码核对

真实资料库导入的四页扫描和同源三页对照均可读回原件摘要。本地 OCR 将实存页分别处理为 4/4 和 3/3。新版汇编另外核对印刷页码，前者页数一致，后者提示疑缺第 2 页。题目结构分别留下 18 和 15 处待核，缺答案和许可待核单列。目录确认后生成的 Word 和 PDF 均读回同一缺页提醒。来源页回执变化会使带旧提示的目录拒绝确认。旧目录和旧生成文件可以继续读取，无数据库迁移。

| 测试 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-page-evidence` | 通过，含 TypeScript 检查。主进程 SHA-256 为 `5738e17779ba4dff9ecfe214479d63d10feaa03ef8d9f84fc645c60700250de7`。 |
| `node scripts/education/mock-exam-page-evidence.mjs` | 7/7，覆盖原卷、缺页、矛盾、重号、正文分数、解析未就绪和超窗口。 |
| `npm run test:renderer-components` | 253/253。 |
| `node scripts/electron-smoke.mjs` | 最终构建 207/207，见 `ship-smoke/electron-smoke.log`。 |
| `node scripts/education/mock-exam-delivery-resume-electron.mjs` | 旧目录兼容性 4/4，在同一任务补齐 PDF，旧 Word 保留。 |
| 固定验收目录 `run-page-evidence-export.mjs` | 真实 PDF 导入产物冷启后从小智生成目录，通过 UI 核对两种页码结果，确认收录后套用一次整包确认。真实 DOCX XML 与 PDF 文本包含缺页提醒，按 SQLite 逐一核对生成文件的 SHA-256。合成模型响应，付费请求 0。 |
| `source-evidence-compatibility.log` | 同一源回执变化后拒绝新目录的旧提示，旧目录无页码字段仍可读回。 |
| `run-page-readback-ui.mjs` | 冷启动后按目录编号从教学工作台打开已确认版，1366×768 和 1920×1080 都显示疑缺第 2 页。证据为 `page-readback-ui.log` 与 `workbench-cold-*.png`。 |
| `npm audit --omit=dev --json` | 原有依赖告警 20 项（2 项 high），无依赖变更。 |

证据位于 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-quality`。正式专项报告为 `verified-wzIH9I/result.json`，同目录保存双尺寸截图、真实输出与 SQLite。手动窗口和步骤位于 `manual-phase4-mock-exam-quality`。保留首次导入后的会话同步等待、调试脚本重复点击提示等失败日志，已用冷启动复测实际入口。

模考原件页码核对 **已实现**。印刷页码缺乏互证或互相矛盾时提示待核。真实样本仍观察到题号范围识别合并、几何图标记混入正文。原件页回执保留了封面 2024 学年度及日期，当前目录使用的首个索引片段从题干开始，因而未呈现与文件名 2025 届的区别。证据为 `metadata-source-gap.log`，继续复核复杂版式、公式、阅读顺序和元数据。

## Phase 4.3 模考封面与年度分类

模考目录从当前原件的 PDF 第一页解析回执读取标题，跳过题干，独立保存学年度、考试月份和文件名届别。真实杨浦卷显示 2024 学年度、2024 年 12 月和 2025 届。两个年度查询都可找到该卷，未确定分类年份时不能确认。教师按所整理的年度确认后，实际 Word／PDF 和重启后的目录都保留三条依据。没有原件标题回执时沿用已有正文索引候选。旧目录不迁移，无需重写既有来源或生成文件。

| 测试 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-cover` | 通过，含 TypeScript 检查。主进程 SHA-256 为 `2d2d83117b08da2d110c8927e519278f4c33952845b8c0271b2386e63e303ac6`。 |
| `node scripts/education/mock-exam-cover-metadata.mjs` | 8/8。封面日期、文件名届别、题干干扰、学年度区间、文件名通用、封面缺失与现有类别冲突。 |
| `node scripts/education/mock-exam-catalog-electron.mjs --pdf-text` | 7/7。确认、配答、重复、来源变化及冷启动保持，修正测试对带许可标签的答案册文字的精确断言。运行日志 `native-catalog/retest.log`。 |
| `npm run test:renderer-components` | 253/253。 |
| `node scripts/electron-smoke.mjs` | 最终构建 207/207，见 `ship-smoke/electron-smoke.log`。 |
| `run-cover-export.mjs`、`run-cover-readback-ui.mjs` | 真实扫描及同源缺页件。年份留空拒绝确认，填写 2025 后保存。Word XML 与 PDF 文本均保留封面依据和缺页警示；生成物与 SQLite 摘要一致；双尺寸冷启动从工作台读回。模型响应使用本地夹具，付费请求 0。 |
| `cover-revalidation.log` | 在隔离库复核当前证据，修改封面回执后拒绝确认旧快照，旧目录继续可用，测试通用文件名及 2024 年候选。 |
| `npm audit --omit=dev --json` | 现有依赖告警 20 项（2 项 high），无依赖变更。 |
| `npm run test:ui-contracts` | 现有页面合同测试失败。测试的页面清单遗漏已注册的「我的任务」，继续核对时还发现教学工作台和我的任务的约束条目数量不满足测试阈值。此前主线的测试、页面合同与页面映射在本次改动中均无差异。原日志和诊断保留。 |

证据位于 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-cover`，验收结果为 `verified-5CmHaM/result.json`，双尺寸冷启动截图在同目录。保留首次脚本定位提示失败记录，实际提示存在并经复测。手测窗口和步骤在 `manual-phase4-mock-exam-cover`。

模考封面与年度分类 **已实现**。复杂题的独立质量继续。真实原卷基线保留 18 处待核，其中第 15 题未匹配四选项，第 20 题首行跨行印刷分值，结构记录仍含无题号候选。与原图逐题核对后再进入正式质量结论。

## Phase 4.3 扫描卷的跨行分值说明

资料库用现有「重建结构」入口生成 v18。真实四页杨浦卷从 20 个可辨大题号和 2 条无题号记录，更新为 21 个连续大题号，无无题号记录。第 20、21 题各保留 3 个小问、原页坐标及跨行分值说明，题干与分值说明分开。两题仍在待核对，整卷共 17 处待核。原 PDF、原结构世代和教师已确认内容逐项读回保持一致。

| 测试 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-rubrics` | 通过，含 TypeScript，主进程 SHA-256 为 `bf49181cce90691b013285a3611494504706257d60067d06e596ac4374261d89`。 |
| `node scripts/education/document-structure-boundaries.mjs` | 58/58，涵盖匹配标题区、跨栏、截断、低置信、旧分栏及图形边界。 |
| `node --experimental-transform-types scripts/education/document-structure-repository.mjs` | 40/40，含旧世代可读、原件与教师记录保护、取消、并发和恢复。 |
| `npm run test:renderer-components` | 253/253。 |
| `node scripts/electron-smoke.mjs` | 最终构建 207/207，见 `ship-smoke/electron-smoke.log`。 |
| 旧采集页重放 | `replay-retest.log`，原 OCR 行逐条不变，两个跨行说明都保留三小问。首次重放留证第 21 题分值区域和离散干扰字导致断题。 |
| `node scripts/education/mock-exam-rubrics-electron.mjs` | 3/3。用原界面重建、SQL 双世代读回、点开第 4 页原图，再冷启动双尺寸读取题 21。重建处理共 2165 ms，复用隔离库内的解析和 OCR 凭证。真实模型 0 请求。 |
| `npm audit --omit=dev --json` | 原有依赖告警 20 项，其中 2 项 high，本次无依赖变更。 |

证据位于 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-rubrics`。真实 Electron 报告为 `yangpu-rubrics-DyI7jA/report.json`，同目录保存双尺寸截图，逐代题号和待核数见 `durable-generations.log`。手动入口和步骤在 `manual-phase4-mock-exam-rubrics`。

## Phase 4.3 扫描卷整题选项归属

真实四页杨浦卷第 15 题的 ①②③ 是同一道选择题里的陈述。v18 将 C、D 归为第 ③ 条的小问选项。v19 从同页同栏的选择题分区、连续圈号、指向这组陈述的整题提问及横排选项恢复正确归属。已识别的 `(C) 2` 和 `(D) 3` 出现在核题表单，可直接对照第 2 页原图。选项 A 的 OCR 顺序异常，B 的局部读数有 `I`／`1` 冲突，两个选项仍待老师核对。第 14、16 题内容与 v18 逐字段相同。原卷 21 个题号完整，17 题仍待核对。

| 检查 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/d3-mock-exam-options-verified` | TypeScript 与 Electron 构建通过，主进程 SHA-256 为 `81141e03d886e12611113cab53b901dcf86a421bd064e2e053c424e32fb0c106`。 |
| `node scripts/education/document-structure-boundaries.mjs` | 61/61，覆盖完整横排、部分读取、仅标签、普通小问、跨行和跨页。 |
| `node --experimental-transform-types scripts/education/document-structure-repository.mjs` | 40/40，保留旧世代、重建与发布失败边界。 |
| `npm run test:renderer-components` | 253/253。 |
| `node scripts/education/mock-exam-rubrics-electron.mjs` | 5/5。实际资料库操作、两种窗口尺寸、原页图、相邻题、取消、退出重开及原文件和 SQLite 双世代读回。模型请求 0。 |
| `node scripts/electron-smoke.mjs` | 同一最终构建桌面综合回归 207/207。报告、截图和运行时临时根均在固定验收目录的 `ship-smoke-final`。 |
| `npm run test:ui-contracts` | 现有「我的任务」页面与合同清单不一致，首项终止，相关文件与基线相同。 |
| `npm audit --omit=dev --json` | 20 项既有依赖告警，其中 2 项高风险。本次依赖及锁文件无变化。 |

证据在 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-mock-exam-options`。`yangpu-rubrics-Z9qtiJ/report.json` 记录实际构建身份、样本摘要、五项结果和重启状态，附审核表单截图。第一次验收复制遇到旧验收窗口持有的语义索引锁，测试随后使用 SQLite 在线备份和新缓存复跑，原窗口保持运行。手动复验使用 `manual-phase4-mock-exam-options` 内的独立数据，已启动最终构建并核对窗口响应。

整题选项归属与人工复核入口 **已实现**。回退可使用上一构建及原 v18 世代，原 PDF 和教师确认项无需迁移。第 15 题的「人体总的淋雨量」公式仍有分数上下部件被 OCR 拆成通用正文，当前来源记录只有表格资产。公式、表格、分栏和答案质量继续专项验证，整项 Phase 4.3 保持进行中。

扫描卷跨行分值说明 **已实现**。第 21 题仍有文字和公式转写误差。第 15 题的两个前置选项受扫描水印影响，版面回执仅明确识别 C、D。局部整行可补读 A，手工定位的 B 单格在两个亮通道实验中读到标签和值。按 C、D 坐标自动推算 B 的单格读到标签，但选项值仍与原图有分歧。证据为 `q15-options-evidence.png`、`q15-crop-ocr.json`、`q15-crop-colour-ocr.json` 和 `q15-crop-geometry-ocr.json`，当前题目仍待核。

## Phase 4.3 扫描公式的原图核对

v20 的题目装配自动记录同题同栏、上下部件互证的堆叠公式，定位绑定原页摘要及原始 OCR 行。现有核题表单可查看原图局部，公式文字由教师补正。公式局部与原页逐像素一致，关闭弹窗返回核题表单，过期的原图摘要被拒绝。杨浦卷第 15、21 题作为回归样本，生产规则适用于同类题。上一轮弹窗点击被资料草稿导航守卫拦截，修订仅放行本资料的预览控件，保留草稿离开保护。

## Phase 4.3 批量扫描结构质量流程

**共用流程和整份资料核对入口已实现。** 从资料库同时导入两份不同来源或版式的扫描，后台自动解析 5 页、26 道题，分流待核 19 道。真实杨浦卷的两处公式可按类型在第 2、4 页之间跳转；独立合成扫描的第 7、8 题分别标出 C、D 和 B 缺失，第 9 题保留 A–D，两道解答题没有缺选项标记。文件 SHA-256、整卷分类、逐题证据和重启后的结构世代一致，教师核对记录 0，模型请求 0。新导入用时 89.55 秒，包含本地识别与多任务并行测试期间的运行开销。 [调研、复用与扩展](06_SCAN_QUALITY_WORKFLOW.md)

| 检查 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/d3-scan-workflow` | TypeScript 和 Electron 构建通过。主进程 SHA-256 `f9f25764c3b7e12f52c3a5221a32b056def57adbc305284414d7c84614ae4f9e`。 |
| `node scripts/education/document-structure-boundaries.mjs` | 65/65，包含多栏、原图绑定、公式部件、完整和缺损选项，以及原有 500 页流式样本。 |
| `node --experimental-transform-types scripts/education/document-structure-repository.mjs` | 42/42，包含各类疑点去重、世代隔离和教师补全的公式与选项验证。 |
| `npm run test:renderer-components` | 253/253。 |
| `node scripts/education/scan-quality-workflow-electron.mjs` | 新导入 4/4。对象来自同一次资料库文件选择，使用实际本机解析进程。 |
| `node scripts/education/mock-exam-rubrics-electron.mjs` | 重建 7/7，保留旧世代、相邻题和老师已确认数据，验证双尺寸、原图像素、按钮和键盘关闭及冷重启。 |
| `node scripts/electron-smoke.mjs` | 同一最终构建综合回归 207/207，见 `ship-smoke/electron-smoke.log`。 |
| 整卷疑点汇总压力探针 | SQLite 内存库 10,000 条题目记录、2,500 页，六次分类与定位查询约 26.6–27.8 毫秒。证据 `overview-load-probe.json`，这里只测查询。 |
| `npm run test:ui-contracts` | 已存在的 `my_tasks` 页面清单差异仍在，第一项终止。 |
| `npm audit --omit=dev --json` | 现有 20 项依赖告警，其中 2 项高风险。本轮依赖与锁文件未变。 |

证据根 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-scan-workflow`。新导入报告在 `mixed-workflow-QrRL3G/report.json`，重建报告在 `yangpu-rubrics-z9b8cc/report.json`。手动窗口使用 `manual-phase4-scan-workflow` 下的独立资料库，启动进程和构建摘要见同目录 `launch-window.json`。如需回退，使用上一构建及旧结构世代；既有数据库与原 PDF 无迁移。专业公式转写、难版式与表格的独立识别器、大批量质量基准和答案核验继续推进。

## Phase 4.3 局部选项回查

**同题横排选项的本机回查已实现。** 结构 v21 从同题同栏的两个独立选项定位原页，只在已有选项文字能在裁片中再次读出时呈现新增候选。每页最多一行，每行两遍且有 16 秒 OCR 预算。首轮识别、来源页、原裁片摘要与回查结果分别留存。已有 OCR 缺损、候选、无法定位和阅卷确认继续沿原数据与任务治理。

真实杨浦四页卷第 15 题的 A 得到一次 `0` 候选，B 未读清，第 14、16 题与旧世代逐字段一致。页图、两道公式证据、来源题号和教师确认项读回相同。对照件的第 7 题本身缺 C、D，局部回查仍未读清两项，纵排缺项和完整题不触发这个横排方法。用时记录与真实导入日志分别保存，真实重建一次为 19.21 秒，包含双遍局部 OCR 和并行回归运行开销。

| 检查 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/d3-choice-recheck` | 通过，主进程 SHA-256 `b726c048acf7295891551347975f3843ef925269a3a343e22e5f013eec89249c`。 |
| `node scripts/education/document-structure-boundaries.mjs` | 67/67，含空标签、图选项、跨行、错读内容、两次冲突与低置信回执。 |
| `node --experimental-transform-types scripts/education/document-structure-repository.mjs` | 43/43，含同页额度和故障恢复后复用已结算读数。 |
| `npm run test:renderer-components` | 253/253。 |
| `node scripts/education/mock-exam-rubrics-electron.mjs` | 重建 8/8，实际本机识别候选、表单、原页、冷启和旧世代。 |
| `node scripts/education/scan-quality-workflow-electron.mjs` | 实际双卷导入 4/4，5 页 26 题，19 题待核，模型请求 0。独立对照的横排缺损没有出现多报候选。 |
| `node scripts/electron-smoke.mjs` | 同一构建桌面综合回归 207/207，见 `ship-smoke/electron-smoke.log`。 |
| 附加检查 | `test:ui-contracts` 的既有 `my_tasks` 差异仍在；生产依赖审计仍有 20 项告警，其中 2 项高风险。依赖与锁文件未改。 |

证据根 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-choice-recheck`。`yangpu-rubrics-hI1UYM/report.json` 包含原页和实裁像素的摘要复算、界面与冷启读回；`mixed-workflow-qSPhDo/report.json` 记录两种版式从空白资料库实际导入。第一次双卷测试把横排确实缺印的对照误设为不调用，本机实际回查两项均未读清；保留该轮失败日志，再以验收合同核对该负例。手工窗口使用 `manual-phase4-choice-recheck` 下的隔离资料库。无需 SQLite 迁移，可回退到旧程序和原 v20 世代。专业公式转写、复杂表格和大批量实际吞吐继续验证。

## Phase 4.3 表格恢复与视觉回查

结构 v22 首次从原页恢复有边框的矩形网格。结构 v23 加入浅色叠印识别。合成负对照中，OCR 曾以 0.9993 分把水印当成单元格原文。新增规则判断读数是不是主要来自浅色有色笔画，保留原始行并把疑点交回同一流程。模型看原彩色图也会混入叠印文字，去浅色而未聚焦的对照图还会漏掉负号。聚焦有效笔画后的图与原页参考一起送出，实测模型与本地 OCR 均读到 -0.10。杨浦卷实测 2 行 8 列，8 格有明确本地读数、8 格待核。另一份独立合成卷的 2 行 3 列清晰表格读到 6 格。合并格、断线和不可靠定位继续保留原图。旧扫描世代和已确认题目可读回。

八例合成材料各比较三次真实模型调用，共 24 次。只发局部完整正确 3/8，仅整页 7/8，局部加上下文 7/8。后两组各有 18/19 字段正确，分别错在答案归属与表头单位拆分。局部加上下文组输入 5,839 tokens，整页组 6,540 tokens。完全遮挡和学生红笔两例均留空。

从资料库的题目表格发起的新入口已实现。独立 Electron 合成卷验证本地导入、取消前无请求、拒绝错误回执、真实模型返回不可读、重启后读回。回执独立保存在原世代和单元格位置下，题目和教师确认记录未变。此前一次配置探测被测试拦截器误判，失败报告保留，修正测试装配后通过。该轮只以合成资料测试云端，真实试卷回归保持本机。

验证目录为 `D:/WorkProject/EduProject/acceptance/D3-20261122/phase4-vision-context-pilot`。查看 `live-v1/summary.json`、`desktop-vision-lwnLJB/report.json`、`desktop-local.log` 和桌面综合回归日志。可回退旧程序读取既有世代并留下独立候选表。
最终桌面专项 6/6。带叠印的单元格读到 `-0.10`、正确归到第三天。遮挡对照留空。较早同构建回执曾留冲突，未替换原件或写入题库。报告 `desktop-vision-038yRL/report.json`。本轮渲染组件 253/253，结构边界 68/68，仓储 43/43，本地真实卷重建 9/9，双卷导入 4/4。聚焦版本收尾前的 v23 综合桌面回归 207/207，审计仍有既有告警。产品使用范围仍为明确网格，公式、无框或合并格、答案册接入须各自验证。

## Phase 4.4 教案六个栏目闭环

已实现教学内容、重点、难点、板书、作业和课后反思。Pi 生成新教案时须提供全部栏目，课后反思先写观察和追问计划。编辑仍形成同一教案的新版本。已开始补充的草稿缺字段时可存草稿，确认前提示具体缺项。旧版本可继续读回，教师可显式补齐。教学内容与重难点、板书与课后安排各有一组，沿原版本导出 Word 与 A4 PDF。

构建和类型检查、合同 11/11、组件 253/253、真实 Electron 编辑与重启 6/6、导出合同 4/4、真实文件导出和冷启 3/3 通过。Word 与 PDF 的新增章节由独立解析验证。受控 Pi 请求用于工程核对。普通对话入口、自然模型生成质量和真实教师试用继续验收。证据位于 D:/WorkProject/EduProject/acceptance/D3-20261123/phase4-lesson-details。
