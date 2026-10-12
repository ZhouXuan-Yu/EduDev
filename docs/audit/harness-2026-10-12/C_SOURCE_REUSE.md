# C · 开源源码对照与可复用清单

## 1. 版本、许可、可访问性

| 项目 / 已读取核心 | 固定版本与许可 | 依赖与适用限制 |
| --- | --- | --- |
| mu / Kyrn Judge | `faed8c364323c477399b1dc2ef1d2fa36ce51267`；根与judge包MIT，保留原版权；本轮只读clone | coding-agent1.0.2与小智一致；judge0.1.0 private，Node>=22.19，undici8.10.2，小智7.24.7。不是可直接npm安装的已验证发布包 |
| DeepTutor | `be1701108a22c1037bb8004322ef6145302cbf5e`；Apache-2.0，保留LICENSE/NOTICE与变更说明 | Python>=3.11,<3.14，包含较多Web/工具/媒体依赖；本地5项脏改动，包括workflows API/UI，不当成原版上游保证 |
| OpenMAIC | `636fab0d7edee5e7c2694117c38ece8f623573f9`，1.2.0-rc.1；MIT，版权THU-MAIC | Pi0.78.0，Next16.3.3与服务器存储；小智Pi1.0.2/Electron/SQLite，需验证hook签名，不能整包移植runner/Postgres |
| ai-agent-book | 无.git；agentbook0.1.0；根Apache-2.0，具体快照按文件SHA | 教学示例不是生产SLA；核心verifier纯Python标准库，但整项目extras很大，不安装所有依赖 |
| Edurag_study | 无.git；根未找到LICENSE | 当前是RAG教学图，MemorySaver默认；依赖Milvus/Torch/LangGraph。只借鉴理念，取得授权前不复制源码 |
| edu-rag | **按用户要求排除** | 没有审阅其实现，不给复用结论 |

mu只读研究副本：`apps/desktop/test-results/harness-audit-20261012/mu`。本地四个参考项目都已进入核心审阅范围，不再沿用历史“DeepTutor/OpenMAIC目录不存在”的判断。任何目录索引不等于全部文件审阅。

[mu固定源码](https://github.com/qybaihe/mu/tree/faed8c364323c477399b1dc2ef1d2fa36ce51267)是主要对照；研究结论以本地该提交文件为准，README不作验收证明。

## 2. mu：值得移植的边界设计

以下路径相对mu根；具体可点击定位与哈希见EVIDENCE。每项均列出本地等价能力、接入位置与维护成本。

### MU-01 · 版本化任务Frame

- 文件 `packages/kyrn-judge/src/frame/frame.ts`；`Frame/FrameSource/AcceptanceItem/createFrame/ruleUpdate/tickItem/compactFrame`。
- 机制：用户原句约束有entryId来源；新任务/修正/子目标生成版本；迟到/未合并文本独立保留；compactFrame派生小视图，不改原文。
- 解决：目标漂移、计划与用户更正无法对账。
- 小智：Goal有revision/CAS，plan无稳定step/来源版本；不是等价能力。
- **适配移植**纯数据/不可变更新；`tickItem`接受一句evidence就done，不直接复用成功语义；改为EvidenceRef+VerifierResult。`compactFrame`切片约束不可当权限真源。
- 本地目标：`shared/xiaozhi-task.ts`、`main/xiaozhi-agent/tasks/`（均拟新增），goal-coordinator adapter。无需新运行库；M成本，冻结上游SHA+原测试适配。

### MU-02 · 有限Decision Engine与审计ledger

- 文件 `packages/kyrn-judge/src/decision.ts` 的`DecisionSpec/defineDecision/DecisionEngine`，`packages/kyrn-judge/src/ledger.ts`的`LedgerRecord/LedgerSink`。
- 机制：明确问题、选项、ABSTAIN、规则fallback、spec version、latency/cacheImpact；off/shadow/active区分，批量判定有concurrency与stateDigest。
- 解决：计划变更原因、选择策略无法校准；不会把隐藏思维变成产品文字。
- 小智：各领域规则存在，缺统一版本化decision记录。
- **适配移植** spec纯类型+状态摘要/模式；judge只接已配置DeepSeek且仅必要脱敏状态，先shadow。权限、FACT、验证结果不受judge决定。
- 本地目标：`decisions/`、SQLiteledger、ContextPlanner/plan提议hook；不安装整个mu，不带默认Jev/OpenCode服务。Jsonl/CompositeLedger最佳努力写入不满足关键状态持久化，改本机事务；M成本，上游API1.0.2兼容也需测试。

### MU-03 · 目标结束检查与停滞保护

- 文件 `packages/kyrn-judge/src/extension/features/goal.ts`；`stepsOf/registerGoal/parseGoalEntry`，check内部307–340、agent_end345起。
- 机制：openItems/unverified事实先于模型met；迟到judgement先查goal identity；idle/stall/continuation/minute cap、结构reasonCode；pause保留next。
- 小智：有持续Goal，但文字fingerprint重复检测弱，缺criterion证据映射。
- **借鉴+适配**继续/暂停与迟到结果保护；不复制整Goal插件到现GoalController。它的shell-command-after-edit也不是实际测试通过，openItems仍可由模型tick。
- 接入goal-coordinator/RunnerCoordinator的Pi turnBoundary；费用软策略与安全硬门禁分开；M成本；不能视judge结果为教师授权。

### MU-04 · 工具输出Admission

- 文件 `packages/kyrn-judge/src/extension/features/admission.ts`；`registerAdmission/chunkLines/describeCall`。
- 机制：首尾保留、中段分块、截止时间内judge，只active裁剪；原文archive+省略回执；错误结果不轻易裁剪。
- 小智：有长度截断和source，但非目标关联的输出预算。
- **设计借鉴**，先确定性摘要/指针，暂不启用第二次LLM逐块裁剪。教育表格/公式/来源不得裁掉、网页非可信；私有archive路径不外传。
- 接入ContextPlanner/ToolResultNormalizer；本地EvidenceStore持有原文，scope控制；M成本，收益需benchmark。不要直接带mu默认archive写目录和undici。

### MU-05 · MCP catalogue与信任门禁

- 文件 `packages/kyrn-judge/src/extension/features/mcp.ts`；`registerMcp:100/approvalText:61/configOf:124`。
- 机制：Pi loadMcpConfig/registerMcpServer；项目来源needsApproval，环境值转字面量，认证/错误/断开状态，配置更改后重新信任。
- 小智：生产刻意不自动发现MCP；技能目录有权限与哈希，不等于MCP服务器能力。
- **适配移植** metadata/catalog、信任与状态；使用现Pi原生MCP层，禁止global/project无界扫描。默认仅受控本机server、显式添加HTTPS服务。
- 接入`mcp/`（拟新增）、统一ToolExecutor、typed IPC/settings；M成本。网络/stdio server可产生副作用，不能只靠名称allowlist；认证凭证留主进程，许可MIT，客户端依赖锁版本后核Windows打包。

### MU-06 · 最终完成nudge

- 文件 `packages/kyrn-judge/src/extension/features/completion.ts`；`registerCompletion`。
- 机制：agent_end检查未验证编辑/open items，至多一次提示；shadow后台、active3000ms截止；goalActive不重复接管。
- 小智：没有通用Verify，Office实际产物交付已有保守文案。
- **不直接复用**“命令跑过即验证”的coding假设。只借鉴同一native loop边界检查与防重复nudge。教育验收交给H02，不新建完成LLM loop。
- 如实施，仅在现goal-coordinator的native边界适配一次检查，复用现Pi API，不新增依赖；MIT留版权，S成本。通过反例为“跑过命令但测试失败仍不可完成”，与H02共用验收，不复制其coding prompt。

## 3. 本地其他参考项目

### DT-01 · 工具批内去重与schema协议

- `DeepTutor/deeptutor/core/agentic/tool_dispatch.py:dispatch_tool_calls/_detect_duplicate_calls`：同tool+JSON标准化参数去重，ask_user批内只保留一个，其他call仍返回对应toolResult，避免provider pairing断裂；最大并发8。
- `deeptutor/core/tool_protocol.py:ToolDefinition.to_openai_schema`支持raw_parameters，避免重新编码丢schema；`runtime/registry/tool_registry.py:ToolRegistry`提供deferred lookup/aliases。
- 小智Hana已有参数快照/原schema，未见所有域统一批内去重；**只适配纯去重/schema测试与元数据设计**，不迁Pythondispatcher/ToolRegistry为第二executor。并发8不抄，写操作重复必须用效果幂等键/版本，不能把两个合法意图合并。
- 接入统一ToolExecutor、capability manifest；TS移植避免Python新运行依赖，Apache通知；S/M成本。

### DT-02 · 分支上下文水位与摘要防漂移

- `deeptutor/services/session/context_builder.py:ContextBuilder.build`348起：只取leaf祖先，summary watermark不在当前链则重建；预算内返回未压缩，原文可容纳时从原文总结，失败保留原摘要并裁近期。
- 小智Pi已有native branch/compaction/authority隔离，**禁止整套迁移**。借鉴来源水位、原文重建对照与branch测试；不建立DeepTutor summary真源。
- 接入ContextPlanner测试、native compaction adapter；不新增模型调用链；M成本。摘要永不授权，近期tool pairing不能被按消息数裁坏。

### DT-03 · Loop停机及视觉模块

- `deeptutor/agents/chat/agent_loop.py:AgentLoop._run_loop`探索预算、MAX_SETTLEMENT_ROUNDS=3、forced_finish、pause/resume；本轮实际读取259–444及符号范围。
- 小智已有Pi循环。**不引入该AgentLoop或强制finish作为成功**；把有限停机的设计转为安全策略。
- `agents/vision_solver/vision_solver_agent.py:VisionSolverAgent`已定位类/process/_call_vision_llm，**本轮未完整检查实现与上传范围**，不作直接复用推荐；小智已有公开图原生链与本地学生OCR，下一轮先实例验证该链。

### OM-01 · 可直接适配的小型工具超时包装

- `OpenMAIC/lib/agent/runtime/tool-timeout.ts:withAgentToolTimeout/executeWithToolBound`：derived signal+单赢家race+cleanup，忽略迟到progress；`build-agent.ts:buildAgent`包每个tool、afterToolCall保留isError并做allowlist。
- 小智很多tools自有30s/Worker超时，但缺统一包装。**优先适配此模块核心**，无需引入Next/Postgres。Pi0.78→1.0.2参数/onUpdate类型逐项核验；默认10分钟及media override不抄。
- 接入`tools/execution-bound.ts`（拟新增）/pi-session注册边界；保留单用户审批可暂停；写timeout效果unknown，不假定race能杀死外部副作用；MIT版权，M成本。

### OM-02 · 原生消息完整性修复

- `lib/server/agent-runtime/tool-call-integrity.ts:repairOrphanedToolCalls/withToolCallIntegrityRepair/appendInterruptedToolCallResults`：现有结果排回assistant所属call相邻位置，真正缺结果才标interrupted；只读派生provider-safe view，不篡改原entry。
- 小智native-authority-epoch已有pending-tool隔离，所以不能报告完全缺孤儿保护。**适配纯normalizer与失败样例**，先证明现机制不能覆盖的late-result顺序再启用；丢授权消息绝不可通过补fake success修复。
- 接入PiAdapter.ContextBoundary；storage error类型/lease依赖移除改本地attempt fence；MIT，S/M成本。

### OM-03 · 持久entry与attempt fencing

- `lib/server/agent-runtime/runner.ts:runSession`957起有required enqueue、critical-write abort、attempt/lease fence；1596–1626工具result成功持久化后才清pending。`entry-tree-storage.ts:AgentSessionEntryStorage`薄adapter。
- **借鉴设计，重写本机存储adapter**。小智single Electron无需Postgres租约基础设施；用SQLite owner generation/revision和现native JSONL对账。不要整段复制2000行runner及数据库/服务端身份逻辑。
- H03恢复；L成本。OpenMAIC普通event write不是critical，不代表完全可靠前端journal；目标必须明确哪些事件required。

### OM-04 · UI/课堂独立循环

- `lib/chat/agent-loop.ts:runAgentLoop`refresh store + fetch SSE + onIterationEnd；`build-agent.ts`STUB_MODEL高窗口/零cost、quota无限stub。
- **不引入**客户端循环、stub model和无限quota。UI仅消费小智IPC事件；真实provider window与usage保留。课堂导演与课件内容后续作为教育capability，不作为小智主Harness。

### BOOK-01 · 三层轨迹验收

- `ai-agent-book/chapter9/trajectory-verifier/verifier.py:ResultVerifier/ProcessVerifier/DimensionResult/QualityJudge`：环境最终状态确定性比对、policy/privacy/claim与成功工具先后核对；无期望输出uncertain；开放语言维度可quality judge。
- 小智领域schema/来源验证有同类基础，缺统一任务完成验证。**适配schema/规则测试与分层架构**，结果取宿主真实DB/文件/网页receipt，不从模型提供的final_state自证。
- `consistency_checker.py`英文字母token启发式仅辅助，不做中文教育内容事实裁判。整项目不安装；纯TS小模块+既有Python独立验收脚本可复用；Apache通知，M成本，H02/H10。

### ED-01 · 检索决策和非能力案例

- `Edurag_study/core/contracts.py:RetrievalMetrics/RetrievalDecision/RetrievalPlan`区分accept/retry/abstain、reason_codes与子查询覆盖。
- `core/graph.py:build_rag_graph`实际只有分类→检索→生成/闲聊→finalize，MemorySaver；契约描述的retry fields不等于运行图有纠正循环。
- `core/nodes/generator.py:generate_stream`未配置LLM有明确mock摘录；不能用demo通链证明真实provider。
- **只参考理念**：无LICENSE，不复制。小智已有本地FTS/教育检索，先用现服务；不引入Milvus/Torch/新的LangGraph。复杂RAG仍受Master暂不建设边界约束。

## 4. 复用优先顺序与维护约束

优先：现小智领域/安全/原生Pi → OpenMAIC小型timeout/integrity → mu纯frame/decision类型 → book验收结构；DeepTutor只取不会产生第二loop的纯逻辑/测试。不得为了复用删掉已通过的教师确认、scope、CAS、旧数据恢复。

每个适配提交必须含：上游提交/文件hash、保留LICENSE/NOTICE、修改理由、依赖清单/安装与bundle体积增量、Windows安装与离线校验、adapter合同测试。**本轮未安装新依赖，不能给未经测量的精确体积数字**；原则是纯模块优先0新运行依赖，包含PiMCP所需包时由H07实测并锁定。
