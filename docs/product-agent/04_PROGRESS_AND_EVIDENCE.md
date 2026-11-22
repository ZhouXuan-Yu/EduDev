# D3 阶段进度与证据

当前基线和保护边界见 [审计](00_CURRENT_STATE_AUDIT.md)，冻结映射见 [实施映射](01_IMPLEMENTATION_MAPPING.md)。原始日志和合成 SQLite 根为 `D:/WorkProject/EduProject/acceptance/D3-20261122`，验收从 `apps/desktop` 执行。

| 阶段 | 状态 | 当前进展 |
| --- | --- | --- |
| 0 | DONE | 主线核对，产品、数据和 DesignSkills 映射已记录，D3 分支独立于 D2。 |
| 1 | DONE | 对话与任务连续性 12 项工程场景已覆盖。真实模型综合质量和后续教学闭环留在集中验收。 |
| 2 | PARTIAL | 对话首页已显示真实待办、任务和最近成果。独立任务与成果中心、关联和编辑继续实施。 |
| 3 | NOT_STARTED | 以现有选择的本地记忆、教师偏好为底座。 |
| 4 | NOT_STARTED | 按组卷、讲义、模考汇编、教案顺序。 |
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
