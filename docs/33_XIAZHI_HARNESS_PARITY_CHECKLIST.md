# 小智 Harness 逐项对照与验收清单

> 2026-10-02：本文件是旧教师任务 Harness 的历史对照台账；用户已暂停三元题组，优先办公智能体。新 Codex/办公能力矩阵、运行时选型和下一任务分别以 docs/34、docs/35 为准。下列历史通过不代表完整办公能力已经完成。

日期：2026-09-24。对照本机 `D:\WorkProject\开源\ZCode` 3.14.3 与 `D:\WorkProject\开源\openhanako` 0.449.0；实现状态只按当前小智代码和本轮实例证据填写。`已接入` 表示有代码路径，`已验收` 另需表中列出的端到端证据。两个项目是通用/编码智能体，小智仍需守住教师资料、错题、隐私和确认的业务边界。

## 事实基线

- ZCode：`apps/zcode-cli/packages/core/src/agent/turn-state.ts` 和 `turn-machine.ts` 提供显式 turn 相位；`tool/scheduler.ts` 调度工具；`permission/service.ts`、`tool/executor/approval-gate.ts` 控制执行；`agent/session-history-hydrator.ts` 与 `compact-session.ts` 管理历史恢复和压缩。
- openhanako：`core/session-coordinator.ts` 组合会话、权限和运行时；`lib/loop/loop-controller.ts` 管理预算、暂停、恢复；`lib/permission/tool-invocation-permission.ts` 审核工具实参；`lib/session-jsonl.ts`、`lib/checkpoint-store.ts` 与 `core/session-compaction-runtime.ts` 管理持久历史与压缩。这些机制不能直接等同于 LangGraph 节点 checkpoint。
- 小智：`apps/desktop/src/main/index.ts` 仍并存 direct、旧 DeepTutor sidecar 和三元题组 LangGraph；`ai-harness/triplet-graph.ts` 是首条任务图，`db.ts` 保存运行事件/确认项；`App.tsx` 是教师交互入口。已有能力不代表所有路线已经由统一图接管。
- 本轮真实 GLM 证据：忽略的 `.env.local` 中的密钥，在隔离数据根上由小智 Electron 页面完成 direct 和 structured 两条回复；模型为 `glm-4.5-air`。另由 typed preload 发起真实三元题组图：模型草稿经 schema/双 grader，教师编辑确认后写入 SQLite，重启读回修改版。这证明当前账号在标准 Chat Completions 接口可用，不证明其他 GLM 模型、OCR 或中断恢复。

## 从输入到最终交付的逐步清单

| 步骤 | ZCode 源码机制 | openhanako 源码机制 | 小智当前证据 | 缺口和下一验收动作 |
| --- | --- | --- | --- | --- |
| 01 输入入口 | agent turn 接收消息并构造 `TurnState` | `SessionCoordinator` 接收会话提交 | `App.tsx` 聊天栏、错题按钮经 typed preload 到 main；发送后清空输入已 Electron 验收 | 将全部教师任务入口映射到同一版本化运行请求；逐入口校验空输入、重复点击、附件和权限 |
| 02 会话身份 | turn/session IDs、状态相位 | session manifest、JSONL 与 branch | SQLite AI 会话/消息已持久化 | 对话与图 run、确认项建立唯一关联；验收关闭重开和跨会话隔离 |
| 03 任务分类 | runtime 按 turn 组织模型与工具 | coordinator 选择运行流程 | direct/structured 路由、`mistake_triplet` 明确 intent | 资料问答、组卷、错因、报告仍走不同运行路径；逐 route 迁至统一图并跑误路由评测 |
| 04 角色与指令 | loaded skills、runtime input presentation | session prompt snapshot、skills snapshot | `agent-harness-profile.ts` 和 `buildAiSystemPrompt` | 固定版本、来源和上下文注入顺序；重启时使用启动时快照，验证规则更改不会改变半途运行 |
| 05 模型选择 | 模型请求状态与 usage | provider 兼容层、会话模型设置 | DeepSeek/GLM 独立凭证和模型、main 网关；GLM direct/structured 真实成功 | 记录每轮实际 provider/model/接口/usage，切换中途仍固定；两家故障与 401/429/超时分别验收 |
| 06 上下文检索 | history hydration、文件状态水合 | session 文件、memory search | 本地知识/题库工具与 bounded 来源 | 每个 route 建立来源可重放快照，验证陈旧索引、无命中、不同学生隔离和上下文长度 |
| 07 隐私裁剪 | path policy、工具输出限制 | sandbox/path guard、权限描述 | 主进程脱敏；错题原图不发云端；工具观察有界 | 在模型请求边界做逐字段隐私测试，确保题图、原文件、学生身份和整库不外发 |
| 08 工具目录 | `tool/registry.ts`、model contract | tool session 与 invocation descriptor | `tool-registry.ts` 主进程白名单 | 做版本化工具清单及 route 可见性；拒绝模型幻造名称、缺参和未开放工具 |
| 09 参数冻结 | input normalization/validation | `snapshotToolInvocationInput` 检查 getter、循环、危险键与超界 | 已按 Apache-2.0 许可复用快照纯函数 | 持续保留对抗测试；验证执行时使用审核过的同一快照，不重新读取可变对象 |
| 10 权限决策 | allow/ask/deny、approval gate | read/routine/review 与会话权限 | main `reviewModelToolCall`、只读工具限制 | 将权限决策、目标、教师确认和拒绝原因持久化；旧版/新图相同策略回归 |
| 11 工具调度 | `ToolScheduler` 并发与结果收集 | Pi SDK 工具回合、LoopController | 三元图当前单个只读检索；旧 TS/sidecar 另有工具循环 | 统一超时、并发、顺序、取消和 tool result 配对，验收重复/孤儿结果及局部失败 |
| 12 模型回合 | turn machine 模型请求、流式和工具相位 | coordinator/Pi SDK 多轮继续 | direct/旧 structured 可多回合，三元图为一次模型请求 | 图扩成多轮工具闭环；限制轮数、费用、上下文和重试，避免无界循环 |
| 13 中间状态 | `TurnPhase` 对 waiting/streaming/completion 显式迁移 | loop running/paused/stopped | 三元图已使用版本化 SQLite saver 保存节点 checkpoint 和 pending writes；新/旧库、重开 saver 与节点续跑专项通过 | 将当前图的恢复入口接到 typed IPC 和教师页面；其他任务图仍需迁移 |
| 14 用户输入/审批等待 | AwaitingPermission 相位 | session permission mode 与恢复 | DeepTutor `waiting_input`、确认队列可等待；图内尚无 interrupt | 图内 interrupt 后关闭重开、教师回答、继续同一 task；拒绝/超时/取消均有可见终态 |
| 15 失败与取消 | tool/turn error state、abort | pause/失败预算、resume | 网关连接失败中文化；三元图网络失败从原 checkpoint 有界重试两次，次数耗尽或重试中退出的终态可回读；sidecar 可取消 | 真实供应商断线、图任务取消和取消后迟到响应零写仍未验收 |
| 16 断点恢复 | history hydrator 修复中断工具回合 | JSONL/manifest/loop 恢复 | 三元图已有同 run 的原子认领、typed IPC 和教师会话恢复卡片；检索和模型节点中途真实进程退出后重开均已验收，确认缺口可修复 | 继续验收真实模型中断及图内 interrupt/审批恢复；其他任务图仍未覆盖 |
| 17 输出校验 | model tool call validation | provider/tool pairing 兼容 | `xiazhi.reply.v2`、来源校验、双 grader | 覆盖 GLM/DeepSeek 真实结构化输出、JSON repair 上界、引用伪造与结果空值 |
| 18 教师确认写入 | coding agent approval gate | review permission | `ai_confirmation_items`、拒绝零写、确认 SQLite readback 已验收 | 所有新增写工具统一走队列，冲突/重复确认/重启后确认幂等验收 |
| 19 使用量与预算 | token usage state、history usage baseline | LoopController 轮数/连续失败、compaction reserve | 部分 run usage/预算展示，缺省标 unavailable | 记录真实 token/费用/时间上限，超限暂停并给教师继续/停止操作 |
| 20 历史压缩 | `compact-session.ts` 保留边界与消息 | mid-run compaction、rolling memory | 小智有记忆文档/摘要，但图无统一上下文压缩 | 压缩前后保持来源、教师确认和未完成步骤；验收长对话重启与引用一致性 |
| 21 可观察性 | turn state、工具结果和错误 | session transcript/loop store | SQLite run/event、右栏运行检查、质量回归报告；三元图 checkpoint ID 已与审计事件一一对应 | 补每节点耗时、模型调用 usage、原因码和恢复 lineage；隐藏推理和密钥不入前端 |
| 22 人工可操作界面 | ZCode 工作区显示会话/执行状态 | openhanako 桌面会话与审批 | 三栏工作区、输入栏、设置页、确认面板，双视口专项已验收 | 等待输入、暂停、重试、恢复、预算、局部失败要在同一会话内可操作 |
| 23 扩展边界 | skills、MCP、编码工具 | plugin/bridge/sandbox/多通道 | 当前只有教师业务工具，无通用终端执行 | 先建受限教师工具插件契约及签名/权限隔离；通用 shell/远程桥接不能未经教师授权进入本地资料环境 |
| 24 自动验收 | 运行时状态/工具单元测试 | loop/permission/session 测试 | build、组件、harness eval、Electron E2E、SQLite readback | 每条 route 都需成功/失败/取消/重启/真实 provider 分层证据；完整 harness 的验收以所有行通过为准 |

## 实施顺序与门禁

1. **G0 真实模型链**：GLM direct 和 structured 成功回复、模型/输入栏/SQLite 回读；真实三元题组生成、确认及重启读回已通过。仍需把真实图路径从教师错题按钮走一遍、覆盖 DeepSeek 成功与其他 GLM 型号。不得用无效密钥的 HTTP 401 替代成功。
2. **G1 图状态底座**：版本化 checkpoint 表与 LangGraph saver 已接入三元图；图状态收窄为脱敏有界载荷和题目 ID，旧形状数据库原地迁移及新库通过；启动时遗留 `running` 收敛为 blocked 且记事件。仍须把生产图的中断恢复入口完成，才算 G2。
3. **G2 恢复与审批**：检索/模型节点中途真实进程退出后的同 run 续跑、确认项缺失时的页面修复、重复恢复拒绝、网络异常有界重试，以及教师拒绝零写/确认只写一次的重启读回已在隔离 Electron 实例通过；仍需真实模型断线、图内 interrupt/审批和取消。
4. **G3 统一执行**：将资料问答、错因、组卷、报告逐条迁入图；每条由共享契约→main→preload→renderer→SQLite/文件→Electron E2E 完整验收，旧入口在新路径通过前保留。
5. **G4 全局预算与长对话**：真实 usage、轮数/时间预算、上下文压缩、用户暂停/继续和长会话重启。
6. **G5 发布级验收**：两家 provider、无网/鉴权/限流、旧数据、1366×768 和 1920×1080、Windows 打包安装、真实 OCR 与教师闭环；按实际通过范围报告，任何一项未证实就不宣称整体对齐。

每一行完成时补充精确命令、成功/失败/跳过数、SQLite/文件 readback、重启证据和仍未验证的边界。此清单是持续执行台账，不把计划文字当作完成证据。

## 本轮 G0 实测

- PowerShell：`$env:OMNI_EDU_LIVE_PROVIDER='glm'; node scripts/ai-live-connectivity-smoke.mjs`：从 Electron 页面发起 direct 与 structured，两次均收到真实非空回复；发送后输入框清空。仅隔离测试提示外发。
- `node scripts/ai-glm-triplet-live-smoke.mjs`：隔离测试学生、无真实题图。真实 GLM 草稿生成成功，`ai_agent_runs` 为 succeeded，事件记录 route/检索/模型/门禁/finalize，待确认项 roles 为 original/similar/variant；教师编辑题干后确认，正式题组 SQLite readback 与 Electron 重启 readback 一致。
- 失败证据：首次 GLM 草稿使用中文 role/difficulty 被 schema 拒绝，终态 failed、零确认项；随后一次请求触及 45 秒上限，终态 failed、零确认项。现已增强英文枚举指令并加入最多一次受控结构修复，图模型上限增为 90 秒。`npm run test:triplet-graph` 覆盖无密钥、坏 schema、断网、生成草稿、一次修复和伪造来源拒绝。
- 真实图片 OCR、生产图中途重启续跑、教师错题按钮上的真实 GLM 生成、其他 GLM 模型和 Windows 安装仍未验收。

## 本轮 G1 节点持久化证据

- `@langchain/langgraph-checkpoint@1.1.5` 显式锁定为直接依赖，MIT；此前已由 LangGraph 间接安装，本次不新增原生模块或常驻服务，对 Windows 打包体积的增量主要是依赖声明。SQLite saver 位于 `apps/desktop/src/main/ai-harness/sqlite-graph-checkpointer.ts`。
- `ai_graph_checkpoints` / `ai_graph_checkpoint_writes` 为增量、幂等的 SQLite 表。checkpointer 只存脱敏有界图状态与模型输出；不把完整 `CompiledAiContext`、API Key、题图或学生原文放进节点状态。每次 `put` 后另有带 checkpoint ID 的运行事件。
- `npm run test:graph-checkpoint`：新库建表；旧形状数据库删除新增表后重新初始化，旧 run 保留；模拟第二节点失败、关闭 saver、重开后 `invoke(null)` 从上个节点继续，第一节点只执行一次；启动遗留 running 标记 blocked，同进程再次 bootstrap 不误标活跃 run。
- `node scripts/triplet-graph-electron-smoke.mjs`：教师按钮路径确认 SQLite checkpoint/pending writes 的真实行数、事件 checkpoint ID 对应、敏感测试字符串不在 checkpoint/metadata/writes 中，并继续完成拒绝/编辑确认/重启读回。
- 本轮 `npm run build`、`npm run test:renderer-components`（79/79）、`npm run test:triplet-graph`、`npm run test:graph-checkpoint`、教师按钮专项、完整 `node scripts/electron-smoke.mjs` 均通过；接入 saver 后重跑的真实 GLM 图也完成生成、教师编辑确认和 Electron 重启 readback。
- G1 阶段**仅有底层 saver 的重启恢复证据**；下节已补生产三元图恢复入口。G2 仍未完成全部故障点。真实 OCR、真实教师按钮 GLM 全流程和 Windows 安装也未完成。

## 本轮 G2 同任务恢复实例证据

- `npm run test:triplet-resume`：在隔离 SQLite 中让三元题组模型节点失败，模拟进程丢失时的 `running` 状态；重新初始化后原会话只列出原 run。错误会话认领失败，正确会话第一次认领成功，第二次失败。
- 同一脚本用原 run ID 执行 `graph.invoke(null)`；第一轮已完成的本地检索仅有一条运行事件，恢复后仍是一条，图结果成功且 run ID 未变。
- 再次重开 Electron，教师从会话侧栏打开原会话，看见恢复卡片，点击后修补图完成但确认项尚未入库的窗口；SQLite 恰有一条 pending `save_exercise_set`，卡片消失，重复 resume 被拒绝。此测试使用隔离测试模型回复，未调用真实 GLM。
- `npm run test:renderer-components` 79/79、`npm run test:triplet-graph`、`npm run test:triplet-resume`、`npm run test:triplet-process-crash`、`npm run test:smoke` 均通过，后者包含构建与完整 Electron 主路径；`git diff --check` 通过。
- `npm run test:triplet-process-crash`：在真实 Electron 进程中让测试模型节点保持 in-flight，检索 checkpoint 落盘后强制结束该进程树；重新启动页面，从原会话卡片恢复同一 run。SQLite readback 检索执行仍为一次、待确认项恰一条。老师随后在页面拒绝，正式题组零写，第三次启动仍为 rejected、题组零条。仅模型回复为确定性测试值，真实进程和 SQLite/IPC/页面路径均参与。
- `npm run test:triplet-retrieve-crash`：真实进程在检索节点发出只读工具审计事件后、节点 checkpoint 落盘前被强制结束。重启后该未提交节点安全重执行，因此检索事件恰为 2 条；原 run、确认项一条、拒绝零写和第三次启动读回均通过。
- `npm run test:triplet-confirm-crash`：模型节点退出后恢复，老师从页面确认题组；重启 SQLite 回读正式题组恰一份，第二次确认被拒绝且没有重复写入。
- `npm run test:triplet-network-retry`：测试模式注入一次 `fetch failed`，原 run 标记为可恢复网络失败，教师在原会话点击重试；检索已提交节点不重跑，原供应商/模型固定，成功后确认项恰一条。`npm run test:triplet-network-cap` 连续注入三次失败，只有两条恢复重试事件，卡片消失且零确认项；应用重启后仍无额外重试入口。
- `npm run test:graph-checkpoint` 追加验证：第二次网络恢复重试开始后应用退出，启动恢复收敛为 failed 并记 `retry_budget_exhausted`，不会借通用启动中断状态绕过次数上限。
- G2 尚未整体完成；上述网络故障为确定性注入，不代表真实 GLM 断线。图内等待审批与取消仍需补齐。
