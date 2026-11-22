# D3 阶段进度与证据

当前基线和保护边界见 [审计](00_CURRENT_STATE_AUDIT.md)，冻结映射见 [实施映射](01_IMPLEMENTATION_MAPPING.md)。原始日志和合成 SQLite 根为 `D:/WorkProject/EduProject/acceptance/D3-20261122`，验收从 `apps/desktop` 执行。

| 阶段 | 状态 | 当前进展 |
| --- | --- | --- |
| 0 | DONE | 主线核对，产品、数据和 DesignSkills 映射已记录，D3 分支独立于 D2。 |
| 1 | DONE | 对话与任务连续性 12 项工程场景已覆盖。真实模型综合质量和后续教学闭环留在集中验收。 |
| 2 | DONE | 工程验收覆盖首页、工作台、任务与成果、右侧上下文、专业编辑、版本、只读历史和恢复。各教学业务另按 Phase 4 验收。 |
| 3 | IN_PROGRESS | 已实现按请求选择适用偏好、本轮覆盖、旧原生日志兼容与撤销冷启。继续画像、停用和可编辑范围。 |
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
