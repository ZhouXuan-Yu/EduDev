# D3 阶段进度与证据

当前基线和保护边界见 [审计](00_CURRENT_STATE_AUDIT.md)，冻结映射见 [实施映射](01_IMPLEMENTATION_MAPPING.md)。原始日志和合成 SQLite 根为 `D:/WorkProject/EduProject/acceptance/D3-20261122`，验收从 `apps/desktop` 执行。

| 阶段 | 状态 | 当前进展 |
| --- | --- | --- |
| 0 | DONE | 主线核对，产品、数据和 DesignSkills 映射已记录，D3 分支独立于 D2。 |
| 1 | PARTIAL | 普通知识问答经单 Pi 和原 Journal 执行，不分配新 Task。资料、明确交付和续做仍进入原 Task。整体阶段的自然语言修改、子任务、暂停及恢复矩阵继续实施。 |
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
| `npm.cmd audit --omit=dev --json` | 截点有 20 个告警，其中 2 项 high。未改依赖或锁文件。 |
| 手测候选 | `manual/launch.json`，PID 44940，Windows 验证可见、可响应、主入口哈希一致。 |

## Phase 1 手测入口

本机验收窗口使用单独的 profile、SQLite 和输出目录。重开时双击 `D:/WorkProject/EduProject/acceptance/D3-20261122/manual/启动-D3.cmd`。真实回答使用软件中已配置的模型。

1. 在「问小智」输入「什么是等值分数？」。预期得到回复，「任务」总览没有新增项目。
2. 在同一会话输入「请制作一份五年级等值分数讲义，包含例题、练习和答案，先给教学草稿」。预期建立教学任务。专业讲义的完整质量验收属于 Phase 4。
3. 在同一会话再问「为什么分母变大时单位分数变小？」。预期新增一轮答复，原任务和要求仍保留。
4. 退出并重开该验收窗口，进入原会话，输入「继续」。预期仍衔接原任务。

教师采用率和体验指标尚无本轮真实样本。后续依冻结测试矩阵逐项登记，项目历史与本轮证据分开。
