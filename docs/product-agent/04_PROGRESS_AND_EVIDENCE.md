# D3 阶段进度与证据

当前基线和保护边界见 [审计](00_CURRENT_STATE_AUDIT.md)，冻结映射见 [实施映射](01_IMPLEMENTATION_MAPPING.md)。原始日志和合成 SQLite 根为 `D:/WorkProject/EduProject/acceptance/D3-20261122`，验收从 `apps/desktop` 执行。

| 阶段 | 状态 | 当前进展 |
| --- | --- | --- |
| 0 | DONE | 主线核对，产品、数据和 DesignSkills 映射已记录，D3 分支独立于 D2。 |
| 1 | PARTIAL | 已实现普通问答分流、当前任务修订、暂停、取消和教师澄清。异常关闭后，历史澄清回接原任务已通过专项。后台子任务与完整恢复矩阵仍待完成。 |
| 2 | NOT_STARTED | 以现有对话、恢复工作台与成果域为底座。 |
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
| 手测入口 | `manual-graceful-question/启动-D3-退出续答.cmd`。让小智先问年级，等待出现题卡后正常退出。重开原会话，选择年级并发送，原任务继续。 |

真实模型上的长会话整理待验。旧历史题卡仍可查看，并在尝试提交时显示任务已取消或要求已变化的反馈。

后台子任务的源码入口已定位。`tasks/plan-runtime.ts` 负责现有 Task 步骤、依赖和操作准入，`events/receipts.ts` 核对执行与原生结果，`verification/result-readback.ts` 核对正式结果。Phase 1 仍缺明确的子任务组织、主任务接收结构化结果以及未汇总时重启的实际场景。后续从受控只读教学步骤切入，并沿现有 Task 和结果回执实施。
