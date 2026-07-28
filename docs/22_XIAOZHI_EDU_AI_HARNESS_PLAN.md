# 小智教育 Agent 完整进化迭代方案

> 状态：后续开发总纲
> 日期：2026-07-28
> 适用范围：`apps/desktop` AI 中控台、小智 harness、学生数据、知识库、题库/错题/三元题组闭环
> 核心用户：K-12 独立教师与小微教研团队
> 开发原则：后续小智相关开发以本文档为路线基准；实现状态必须以代码和验证结果为准，不得把规划写成已完成。

## 0. 一句话目标

小智不是普通聊天机器人，而是 Omni-Edu Agent 中的“教师工作台操作系统级 Agent”：

- 能理解老师意图；
- 能自动选择软件功能；
- 能读取最小必要上下文；
- 能真实调用本地工具；
- 能输出可验证的教育判断；
- 能生成题组、报告、沟通稿等教学产物；
- 能在任何写入前让老师确认；
- 能持续用 eval 和对抗审查防止退化。

最终体验应从：

```text
当前为普通问答模式，无法自动切换到学生数据查询模式，请手动选择左侧导航。
```

进化为：

```text
识别到老师要查询小A学习进度并生成练习。
已解析学生：小A。
已读取学生档案、最近学习记录和相关知识库资料。
已生成三元题组草稿，等待老师确认保存。
```

## 1. 第一性原则

### 1.1 智能来自工程闭环，不来自更长 prompt

小智目前最危险的方向是继续堆万能 system prompt。真正的教育 Agent 要靠：

```text
任务识别
-> 工具计划
-> 权限/隐私校验
-> 真实工具调用
-> 观察结果
-> 复盘缺口
-> 结构化输出
-> 老师确认
-> eval 回归
```

Prompt 只是其中一层，不是全部。

### 1.2 小智服务老师，不替代老师

小智的默认操作者是老师，不是学生端用户。

- 老师问知识：直接解释，不机械反问。
- 老师查学生：读证据，区分事实、推断、未知。
- 老师要题组：生成可修改草稿，不声称来自题库除非真实召回。
- 老师要写档案：先预览变更，老师确认后写入。
- 老师要家长沟通：克制、客观、保护隐私。

### 1.3 本地优先和最小上下文

学生档案、错题、附件、题库默认保存在本机。云端模型只能接收：

- 当前任务必要的上下文；
- 脱敏后的题目文本；
- 有边界的摘要；
- 不包含无关学生隐私的片段。

### 1.4 可展示的是外部执行轨迹，不是隐藏思维链

小智可以展示：

- route；
- plan；
- tool call；
- observe；
- reflect；
- guardrail；
- finalize。

小智不能展示或伪造：

- 模型内部隐式推理；
- `reasoning_content`；
- “我思考了……”但实际上没有工具调用的假过程。

### 1.5 写入前必须老师确认

小智可以自动读取和生成草稿，但不能自动：

- 保存复盘报告；
- 写入学生标签；
- 新增学生结论；
- 发布家长内容；
- 写入知识图谱关系；
- 导出并声称已交付文件。

所有写入必须：

```text
draft -> preview -> teacher confirm -> write -> readback -> trace
```

## 2. 当前已完成基线

截至 2026-07-28，当前已完成：

- `apps/desktop/src/main/ai-harness/` 初始 harness：
  - `router.ts`
  - `tool-registry.ts`
  - `agent-loop.ts`
  - `schema.ts`
  - `eval-cases.ts`
  - `evals.ts`
- 8 类一级 route：
  - `general_qa`
  - `student_diagnosis`
  - `error_analysis`
  - `practice_design`
  - `lesson_design`
  - `report_draft`
  - `knowledge_retrieval`
  - `workspace_help`
- 只读工具：
  - `resolve_student_reference`
  - `get_student_profile`
  - `search_learning_records`
  - `list_attachment_metadata`
  - `search_teacher_knowledge`
  - `query_knowledge_graph`
- Agent loop trace：
  - `route -> plan -> tool_call -> observe -> reflect -> finalize`
- DeepSeek JSON Output + 本地 `xiazhi.reply.v2` schema 校验。
- AI 回复底部已删除“上下文来源 / 上下文工具”折叠组件。
- 96 条 router/subIntent/harness eval 已建立。

已验证：

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run test:ai-harness
npm run build
node scripts/electron-smoke.mjs
```

## 3. 反向审查：当前方案仍不足的地方

### 3.1 仍不是完整 tool-calling agent

当前 loop 是确定性编排骨架：主进程先按 route 读上下文，再调用模型。模型尚不能在循环中提出工具调用。

必须补：

- LLM tool call proposal；
- tool args schema 校验；
- route allowlist；
- privacy/effect guardrail；
- tool result observe；
- 继续/终止决策。

### 3.2 trace 还没有作为事件流持久化

现在 trace 主要随 harness 返回和消息 metadata 保存，后续需要独立事件表，便于审计和回放。

必须补：

- `ai_agent_runs`
- `ai_agent_events`
- event cursor；
- run status；
- error boundary；
- 可折叠 UI。

### 3.3 只有 route eval，不足以衡量“教育质量”

96 条 eval 能证明路由、二级意图、槽位、澄清和工具白名单初步正确，但仍不能证明回答有教育价值。

必须补：

- 证据覆盖率；
- 无意义推断检测；
- 学生标签风险检测；
- 教师可执行性评分；
- 三元题组质量；
- 家长沟通敏感表达；
- 模型输出质量 grader。

### 3.4 写入确认队列尚未实现

没有确认队列时，小智只能做只读和草稿，不能安全地进入“真正帮老师完成任务”的阶段。

必须补：

- 确认项数据表；
- preview diff；
- confirm/reject；
- write executor；
- readback 验证；
- UI 确认队列。

### 3.5 三元题组闭环还没有真正打通

产品 MVP 的灵魂是：

```text
本地题库索引 -> 错题图片解析 -> 脱敏上云分析 -> 本地相似题召回 -> 三元题组输出
```

当前小智 harness 已完成本地题库相似题召回、题组确认保存，以及错题图片本地托管/脱敏/老师修正的数据层第一段；真实 OCR、脱敏文本上云分析和端到端自动题组生成仍未完成。

### 3.6 知识库和图谱仍是轻量骨架

当前知识库/图谱可以作为上下文来源，但还不足以支撑高质量教学推理。

必须补：

- 资源导入状态机；
- chunk 元数据；
- 知识点/题型/错因节点；
- 来源页码；
- 命中去重；
- 引用强度；
- 图谱节点不能冒充正文证据。

### 3.7 UI 还缺少“中控台行动感”

删除底部工具组件是正确的，但未来还需要让老师自然看到小智在行动：

- 当前步骤；
- 已调用工具；
- 阻断原因；
- 待确认项；
- 产物状态；
- 数据边界。

这些应在回复内部和确认队列中表达，而不是铺满无关卡片。

### 3.8 数据安全还要继续推进

目前已有 sandbox、preload、SQLite、本地路径校验，但小智继续进化后会涉及更多敏感面：

- API Key 本地安全存储；
- PII 脱敏；
- 附件原文读取边界；
- 导出文件路径校验；
- 审计日志；
- 高风险学生信号处理。

## 4. 目标架构

### 4.1 总体流程

```text
User Prompt
  ↓
Input Normalizer
  ↓
Intent Router
  ↓
Agent Planner
  ↓
Guardrail Engine
  ↓
Tool Registry
  ↓
Context Compiler
  ↓
Model Tool-Call Loop
  ↓
Schema Validator / Repair
  ↓
Artifact Builder
  ↓
Teacher Confirmation Queue
  ↓
UI Renderer
  ↓
Eval / Telemetry / Regression
```

### 4.2 代码模块目标

```text
apps/desktop/src/main/ai-harness/
  agent-loop.ts              # agent run orchestration
  router.ts                  # route + subIntent
  planner.ts                 # tool plan
  guardrails.ts              # privacy/effect/safety checks
  tool-registry.ts           # tool definitions and executor map
  context-compiler.ts        # bounded context assembly
  prompt-sections.ts         # stable prompt + route modules
  schema.ts                  # response schemas
  repair.ts                  # controlled JSON/schema repair
  graders.ts                 # deterministic and model-assisted graders
  eval-cases.ts              # route/tool/safety cases
  evals.ts                   # eval runner
  telemetry.ts               # run/event summaries
```

### 4.3 共享契约目标

共享契约必须覆盖：

- route plan；
- subIntent；
- context manifest；
- tool definition；
- tool event；
- agent run；
- structured reply；
- artifact；
- confirmation item；
- eval report。

## 5. Route 体系

### 5.1 一级 route

| Route | 场景 | 默认读取 |
|---|---|---|
| `general_qa` | 普通知识问答、解释概念 | 无学生数据 |
| `student_diagnosis` | 学生学习状态、薄弱点、阶段进度 | 学生引用、档案、学习记录 |
| `error_analysis` | 错题原因、失分点、订正策略 | 当前题/错题记录/学生记录 |
| `practice_design` | 三元题组、作业、巩固练习 | 学生记录、知识库、题库/相似题 |
| `lesson_design` | 备课、课堂流程、讲义 | 老师知识库、课程约束 |
| `report_draft` | 复盘、月报、家长沟通 | 学生档案、学习记录、证据 |
| `knowledge_retrieval` | 查资料、知识库引用、图谱关系 | 老师知识库、图谱 |
| `workspace_help` | 软件操作、导入、配置、备份 | 产品能力，不读学生数据 |

### 5.2 二级 subIntent

下一阶段必须引入二级意图，避免 route 粒度过粗：

- `student_progress_query`
- `student_weakness_summary`
- `student_record_search`
- `mistake_pattern_analysis`
- `single_problem_explanation`
- `exercise_triad_generation`
- `homework_plan_generation`
- `parent_communication_draft`
- `review_report_generation`
- `lesson_plan_generation`
- `resource_extraction`
- `knowledge_source_lookup`
- `software_navigation`
- `data_import_help`
- `safety_sensitive_case`

### 5.3 Router 输出

```ts
type XiaoZhiRoutePlan = {
  route: AiIntentRoute;
  subIntent: string;
  confidence: number;
  audience: 'teacher' | 'student_material' | 'parent_material';
  actionLevel: 'answer' | 'draft' | 'write';
  riskLevel: 'normal' | 'sensitive' | 'safeguarding';
  studentRef?: {
    rawText: string;
    resolvedStudentId?: string;
    matchStatus: 'none' | 'matched' | 'ambiguous' | 'missing';
  };
  subject?: string;
  timeRange?: {
    kind: 'last_days' | 'term' | 'custom' | 'unspecified';
    days?: number;
    startDate?: string;
    endDate?: string;
  };
  requiredTools: string[];
  forbiddenTools: string[];
  needsClarification: boolean;
  clarificationQuestion?: string;
};
```

## 6. Tool Registry 体系

### 6.1 工具定义

```ts
type XiaoZhiToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  effect: 'read' | 'draft' | 'write';
  privacy: 'local_only' | 'sanitized_cloud';
  requiresTeacherConfirmation: boolean;
  allowedRoutes: AiIntentRoute[];
  allowedSubIntents?: string[];
  timeoutMs: number;
  execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
};
```

### 6.2 P0/P1/P2 工具分层

P0 只读工具：

- `resolve_student_reference`
- `get_student_profile`
- `search_learning_records`
- `list_attachment_metadata`
- `search_teacher_knowledge`
- `query_knowledge_graph`
- `search_product_capabilities`

P1 草稿工具：

- `draft_exercise_triad`
- `draft_review_report`
- `draft_parent_message`
- `draft_lesson_plan`
- `draft_student_profile_update`
- `build_markdown_artifact`

P1 写入确认工具：

- `create_confirmation_item`
- `confirm_and_write_report`
- `confirm_and_save_exercise_set`
- `confirm_and_update_student_tags`

P2 MVP 闭环工具：

- `index_local_question_bank`
- `parse_mistake_image`
- `sanitize_problem_text`
- `search_similar_questions`
- `generate_exercise_triad`
- `validate_exercise_set`

### 6.3 工具状态口径

- `ready`：工具注册存在。
- `planned`：本轮计划可能调用。
- `running`：正在执行。
- `used`：执行成功并有结果。
- `blocked`：权限、缺参数、缺数据或安全策略阻断。
- `failed`：执行异常。
- `skipped`：计划阶段主动跳过。

只有执行器完成后才能标记 `used`。

## 7. Agent Loop 运行时

### 7.1 标准 loop

```text
start
-> normalize input
-> route
-> plan
-> guardrail
-> tool_call
-> observe
-> reflect
-> maybe continue tool_call
-> model final
-> schema validate
-> artifact/confirmation
-> finalize
```

### 7.2 终止条件

必须有明确终止条件：

- 已满足用户目标；
- 缺少关键输入，需要老师补充；
- 工具失败且无替代路径；
- 达到最大循环次数；
- 触发安全边界；
- schema 修复失败；
- 写入动作等待老师确认。

### 7.3 错误恢复

每类错误分开处理：

- router 低置信度：问一个关键澄清问题。
- 工具参数错误：本地修正或要求模型重提参数。
- 工具无命中：写入 unknowns，不伪造。
- 模型 JSON 失败：一次受控 repair。
- schema 失败：失败返回，不当成功答案展示。
- DeepSeek 网络失败：保留工具 trace，报告模型失败。

## 8. 结构化回复

### 8.1 Envelope

```ts
type XiaoZhiReplyEnvelope = {
  schemaVersion: 'xiazhi.reply.v2';
  route: AiIntentRoute;
  subIntent: string;
  answerMarkdown: string;
  facts: Array<{
    text: string;
    sourceId: string;
  }>;
  evidence: Array<{
    sourceId: string;
    quote?: string;
    note: string;
    strength: 'direct' | 'indirect' | 'background';
  }>;
  inferences: Array<{
    text: string;
    confidence: 'low' | 'medium' | 'high';
    basedOn: string[];
  }>;
  unknowns: string[];
  risks: string[];
  teacherConfirmations: string[];
  nextActions: Array<{
    type: 'suggestion' | 'tool_preview' | 'confirmation_required';
    label: string;
    payload?: unknown;
  }>;
  artifacts: AiConsoleArtifactRequest[];
  processSummary: string[];
};
```

### 8.2 Route 专属 schema

- `student_diagnosis`：必须有 facts/inferences/unknowns。
- `error_analysis`：必须有错因、验证问题、订正建议。
- `practice_design`：必须输出三元题组结构。
- `report_draft`：必须有受众、证据、敏感表达检查。
- `knowledge_retrieval`：必须区分本地资料命中和一般知识补充。
- `workspace_help`：必须短、直接、可执行，不读学生数据。

## 9. 教育专业约束

### 9.1 学生诊断

必须输出：

- 已观察事实；
- 可能解释；
- 不确定项；
- 最多 3 个下一步教学动作；
- 一个验证错因的办法。

禁止：

- 用“粗心”“懒”“不努力”作为最终解释；
- 一次错误形成长期标签；
- 做医学/心理诊断；
- 输出无证据的具体学生结论。

### 9.2 三元题组

三元题组必须包含：

- 原题或当前错题；
- 相似题；
- 变式题；
- 知识点；
- 难度；
- 答案；
- 关键步骤；
- 常见错误；
- 老师观察点。

若题目不是本地题库召回，必须标记为 `generated`，不能冒充题库命中。

### 9.3 家长沟通

必须：

- 尊重、客观、可证据化；
- 避免诊断式语言；
- 避免暴露无关隐私；
- 先给老师审阅。

### 9.4 学生辅导材料

只有当 route/audience 明确为学生材料时，才启用：

- 分步提示；
- 检查理解；
- 认知负荷控制；
- 近迁移练习；
- 鼓励但不空泛。

## 10. 写入确认队列

### 10.1 数据表目标

```text
ai_confirmation_items
  id
  run_id
  confirmation_type
  title
  preview_json
  source_ids_json
  risk_level
  status
  created_at
  confirmed_at
  rejected_at

ai_agent_runs
  id
  session_id
  prompt
  route
  sub_intent
  status
  model
  created_at
  completed_at

ai_agent_events
  id
  run_id
  phase
  status
  tool_name
  input_summary_json
  output_summary_json
  message
  created_at
```

### 10.2 确认类型

- 保存复盘报告；
- 保存三元题组；
- 更新学生标签；
- 新增学习记录；
- 生成家长沟通稿；
- 导出 PDF / Word；
- 写入知识图谱关系。

### 10.3 验收标准

- 用户说“直接保存”，数据库业务表不应立刻变化。
- UI 出现待确认项。
- 老师确认后才写入。
- 写入后 readback 验证。
- trace 中记录确认和写入结果。

## 11. 知识库与题库能力

### 11.1 知识库状态机

资源导入后应经历：

```text
imported
-> queued
-> parsed
-> chunked
-> indexed
-> graph_extracted
-> ready
```

失败状态：

- `needs_parser`
- `failed`
- `partial`

### 11.2 Chunk 元数据

每个 chunk 应逐步补齐：

- resourceId；
- pageNumber；
- heading；
- subject；
- grade；
- knowledgePoint；
- questionType；
- difficulty；
- sourceTrust；
- containsPersonalData。

### 11.3 题库索引

题库题目需要结构化：

- 题干；
- 选项；
- 答案；
- 解析；
- 学科；
- 年级；
- 知识点；
- 难度；
- 题型；
- 来源；
- 是否老师确认。

### 11.4 相似题召回

初期不要做复杂 Graph RAG，先用可验证的本地检索：

- 关键词；
- 知识点；
- 题型；
- 难度；
- 标签；
- FTS；
- 后续再加 embedding。

## 12. Eval 与对抗审查

### 12.1 Eval 分层

1. Router eval：route/subIntent/tool 白名单。
2. Tool trajectory eval：工具调用顺序是否正确。
3. Schema eval：结构化回复是否合法。
4. Safety eval：隐私、写入、高风险。
5. Education eval：教学质量和可执行性。
6. UI smoke：Electron 真实窗口验证。

### 12.2 规模路线

- 当前：96 条 route + subIntent + slots + clarification + tool boundary eval。
- 下一阶段：Education Grader bad-case eval。
- P1：150 条含 schema/safety 的综合 eval。
- P2：加入真实教师样本和人工评分。

### 12.3 必测失败模式

- 普通问答误读学生数据。
- 学生请求要求老师手动切模块，而不是自动解析。
- 未命中学生却编造学生结论。
- `ready` 冒充 `used`。
- 知识库注入覆盖系统指令。
- 没有 sourceId 却给具体诊断。
- 三元题组只是换数字。
- 生成题冒充本地题库题。
- 写入前未确认。
- PDF / Word 产物不存在却声称已生成。
- 高风险信号仍走普通练习。
- JSON 合法但业务 schema 不合格。

### 12.4 Release 门槛

小智相关改动至少满足：

- `npm run test:ai-harness` 通过。
- `npm run build` 通过。
- 涉及 Electron IPC/SQLite/文件能力时，必须跑 Electron smoke。
- `workspace_help/general_qa` 误读学生数据率为 0。
- 未确认写入率为 0。
- schema 失败不能当成功答案展示。
- 新增 route/tool 必须新增或更新 eval。

## 13. UI 迭代

### 13.1 回复内部结构

小智回复应包含：

- 默认展开的思考过程摘要；
- 主答案；
- 证据/未知/确认项；
- 文内产物链接；
- 老师确认入口。

不再使用：

- 回复底部“上下文来源”折叠块；
- 回复底部“上下文工具”折叠块；
- 固定铺满的工具卡片。

### 13.2 事件流展示

未来可把 trace 展示成紧凑 timeline：

```text
识别任务：practice_design
解析学生：小A
读取记录：8 条
检索知识库：3 段
生成题组：草稿
等待确认：保存三元题组
```

### 13.3 确认队列

确认队列应提供：

- 待确认列表；
- 来源证据；
- 变更预览；
- 风险提示；
- 确认/拒绝；
- 写入后状态。

## 14. 数据安全和隐私

必须长期保持：

- renderer 不直接访问 Node API；
- 所有文件路径由主进程校验；
- 附件原文默认不上传；
- 学生数据按最小上下文进入模型；
- API Key 不硬编码；
- 写入动作有审计；
- 高风险学生信号进入安全分支；
- 不输出身份证、手机号等敏感字段，除非老师明确在本地安全场景中查看，并且不进入云端模型。

## 15. 分阶段开发计划

### Phase 1：Agent Runtime v1

目标：把当前 loop 骨架升级成正式运行时。

任务：

- 定义 `AiAgentRun`、`AiAgentEvent`、`AiAgentTraceStep` 完整合约。
- 增加 run/event 持久化表。
- 增加 loop 最大步数和终止条件。
- 增加错误恢复和失败状态。
- 前端只渲染主进程 trace。

验收：

- 真实请求能持久化 run/events。
- 失败请求仍保留工具事件。
- 48/48 eval 通过。
- build 通过。

### Phase 2：Tool Calling v1

目标：模型可提出工具调用，主进程审核后执行。

任务：

- 定义模型工具 schema。
- 接入 DeepSeek/OpenAI 风格 tool call 消息循环。
- 工具参数本地校验。
- route allowlist。
- effect/privacy guardrail。
- tool result bounded output。

验收：

- “查小A学习进度”自动调用学生工具。
- “解释形成性评价”不调用学生工具。
- 工具失败进入 unknowns。
- 不出现 ready 冒充 used。

### Phase 3：Confirmation Queue v1

目标：支持 AI 发起写入前预览确认。

任务：

- [x] 新增确认队列表。
- [x] 新增确认 IPC/preload 合约。
- [x] AI 回复产生 confirmation item。
- [x] UI 显示待确认项。
- [x] 确认后执行写入并 readback。

验收：

- [x] “直接保存报告”只生成确认项。
- [x] 老师确认后报告才进入数据库。
- [x] 拒绝后不写入。

当前边界：

- v1 只开放 `create_review_report`，不开放学生标签、学习记录、题组和知识图谱写入。
- 老师在复盘页面手动生成报告仍保留原显式写入路径；确认队列约束的是 AI 发起写入。
- 真实 DeepSeek live `report_draft` 触发仍需在 API Key 配置后单独验收。

### Phase 4：SubIntent Router + 96 Eval

目标：从 8 route 升级为 route + subIntent。

任务：

- [x] 扩展 router 输出。
- [x] 增加二级意图。
- [x] 扩展 eval 到 96 条。
- [x] 覆盖多学生歧义、时间范围、学科、知识点、写入意图。

验收：

- [x] 96/96 router eval 通过。
- [x] 低置信度只问一个关键问题。
- [x] 明确学生引用不要求切模块。

### Phase 5：Structured Reply v2

目标：从 `xiazhi.reply.v1` 升级到更严格的 `xiazhi.reply.v2`。

任务：

- [x] 增加 facts/evidence/inferences/risks。
- [x] 增加 route-specific schema。
- [x] 增加一次受控 repair。
- [x] 前端按 envelope 渲染。

验收：

- [x] 学生诊断必须有事实/推断/未知。
- [x] 三元题组必须符合 schema。
- [x] schema 失败不展示成功答案。

### Phase 6：Education Grader v1

目标：识别“看似完整但没意义”的回答。

任务：

- [x] 规则 grader：证据、隐私、写入、题组结构。
- [ ] 模型 grader：教师可用性、非模板化、年级适切。
- [x] bad-case 数据集。
- [x] eval report 输出。

验收：

- [x] “建议上传资料”类无意义回复被打低分。
- [x] “小A没有资料所以无法判断”必须说明实际查了哪些数据。
- [x] 标签化语言被拦截。

当前边界：

- v1 是确定性规则 grader；模型 grader 与教师人工评分未接入。
- 当前门禁：`npm run test:ai-education-grader`。

### Phase 7：三元题组闭环 v1

目标：完成 MVP 题组核心能力。

任务：

- [x] 题库题目结构化表。
- [x] 本地题库导入能力第一段：`createQuestionBankItem` / 内置演示题库 / IPC 入口。
- 错题/题目文本解析。
- [x] 相似题召回：`search_similar_questions` 只读工具。
- [x] 三元题组生成：结构化 `exercise_set` artifact + 本地题源上下文。
- [x] 老师确认保存：`save_exercise_set` 确认项，确认后写入 `exercise_sets` 并 readback。

验收：

- [x] 可从本地题库召回相似题。
- [x] 生成题与题库命中明确区分。
- [x] 三元题组可保存和预览。

当前边界：

- 当前完成的是三元题组闭环第一段，不包含真实 OCR、脱敏文本上云分析、embedding 召回和完整题库导入 UI。
- 当前门禁：`npm run test:ai-exercise-set`。

### Phase 8：错题图片与脱敏链路

目标：接入错题图片解析和脱敏上云分析。

任务：

- [x] 图片导入。
- [x] OCR/解析任务状态。
- [x] 脱敏文本生成。
- 模型分析。
- [x] 老师修正入口。

验收：

- [x] 原始图片不自动上传。
- [x] 老师可修正 OCR。
- [x] 脱敏文本可查看。

当前边界：

- Phase 8 当前完成的是数据/API 第一段：本地图片托管、`needs_ocr/sanitized/teacher_corrected/failed` 状态、规则脱敏和老师修正。
- 尚未接入真实 OCR 引擎、真实 DeepSeek live 错因分析和“一键生成三元题组”的完整闭环。
- 当前门禁：`npm run test:ai-mistake-image`。

### Phase 9：知识库/图谱增强

目标：知识库成为教学证据层。

任务：

- [x] 导入状态机。
- [x] chunk 元数据。
- [x] 图谱节点类型扩展。
- [x] 检索结果 sourceId 强化。
- [x] 引用强度区分。

验收：

- [x] 知识库没命中不会伪造引用。
- [x] 图谱节点不冒充正文证据。
- [x] 备课/出题能使用知识库。

当前边界：

- Phase 9 当前完成的是规则版证据层第一段：文本资源 ready 状态、chunk metadata/quality/privacy/evidenceStrength、图谱 evidenceKind/evidenceStrength 和工具输出边界。
- 尚未接入复杂文档解析器、embedding 检索、Graph RAG、图谱人工编辑和 AI 写入图谱确认队列。
- 当前门禁：`npm run test:ai-knowledge-graph`。

### Phase 10：文档生成与导出

目标：Markdown -> PDF / DOCX 文件真实落地。

任务：

- [x] artifact builder。
- [x] 文件保存路径。
- [x] 导出状态。
- [x] 打开文件。
- [x] 预览和实际文件一致性检查。

验收：

- [x] 文件真实存在。
- [x] 导出失败不显示成功。
- [x] 产物可通过 artifact id 在主进程读库后打开文件位置。

当前边界：

- Phase 10 当前完成的是真实文档文件闭环 v1：`document_artifacts`、Markdown/PDF/DOCX 写出、sha256/readback、主进程 IPC 和右侧面板真实导出按钮。
- 历史消息 metadata 尚未自动合并导出后的 `document_artifacts` 状态；后续需要在打开历史会话时按 artifact id 合并 readback，或导出成功后回写 assistant message metadata。
- PDF/DOCX 当前是最小有效文件生成器，不等于完整排版系统；中文字体、分页、表格、图片、公式和模板样式仍需后续增强。
- 当前门禁：`npm run test:ai-document-export`。

### Phase 11：Observability + Regression

目标：每轮小智行为可审计、可回放、可比较。

任务：

- [x] run/event telemetry。
- [x] eval report 存档。
- [x] prompt/schema/model 版本记录。
- [x] P50/P95 延迟。
- [x] token 和上下文预算。

验收：

- [x] 每次回答可查工具轨迹。
- [x] 每次发布前能跑回归报告。

当前边界：

- Phase 11 v1 当前完成的是 SQLite/API/smoke 层：统一 telemetry snapshot、回归报告存档、gate 聚合、延迟/token/context 预算和报告 readback。
- 尚未完成专门 Observability UI、Markdown/HTML 报告导出、OpenTelemetry dashboard 或失败样本自动回放。
- 真实 DeepSeek live usage、prompt/model 细粒度版本和生产环境延迟分布仍需在 API Key 与真实使用数据下继续校验。
- 当前门禁：`npm run test:ai-observability`。

### Phase 12：教师可用性打磨

目标：从“能工作”到“老师愿意每天用”。

任务：

- 减少模板化废话。
- 根据任务控制回复长度。
- 产物入口自然化。
- 确认队列减少打扰。
- 老师常用工作流快捷入口。

验收：

- 教师人工评分平均 >= 4/5。
- 返工量下降。
- 常见任务 1-2 轮内完成。

## 16. 后续开发顺序

严格按以下顺序推进：

```text
1. Agent Runtime v1
2. Tool Calling v1
3. Confirmation Queue v1
4. SubIntent Router + 96 Eval
5. Structured Reply v2
6. Education Grader v1
7. 三元题组闭环 v1
8. 错题图片与脱敏链路
9. 知识库/图谱增强
10. 文档生成与导出
11. Observability + Regression
12. 教师可用性打磨
```

不要先做大而全 UI，也不要先继续堆 system prompt。小智下一步最该做的是：

```text
Phase 12 教师可用性打磨
```

## 17. 每轮开发的固定检查清单

每次改小智相关能力，必须检查：

- 是否仍服务 K-12 独立教师和小微教研团队；
- 是否破坏本地优先和最小上下文；
- 是否把规划能力说成已完成；
- 是否新增 route/tool 后同步 eval；
- 是否有未确认写入；
- 是否会误读学生数据；
- 是否会编造知识库/图谱命中；
- 是否保留 sourceId；
- 是否能 build；
- 是否需要 Electron smoke；
- 是否更新四份根文档。

## 18. 立刻可执行的下一块任务

下一轮建议直接实现：

```text
Phase 12 教师可用性打磨 v1
```

预计改动文件：

- `apps/desktop/src/main/ai-harness/*`
- `apps/desktop/src/main/deepseek.ts`
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/scripts/*usability*.mjs`
- `docs/22_XIAOZHI_EDU_AI_HARNESS_PLAN.md`

## 19. 当前实施状态

### 2026-07-28：Phase 1 Agent Runtime v1 已完成

- 已定义 `AiAgentRun`、`AiAgentEvent`、`AiAgentTraceStep` 完整运行时契约。
- 已新增 `ai_agent_runs` / `ai_agent_events` 持久化表与查询方法。
- `ai:runDeepSeek` 已接入 run 生命周期，失败路径也会写终态。
- `runAiAgentLoop` 已把 route、plan、tool_call、observe、reflect、finalize 写入可审计事件流。
- 本地门禁：`npm run test:ai-agent-runtime`。

### 2026-07-28：Phase 2 Tool Calling v1 基础设施已完成

- 已定义模型工具 schema、模型工具调用和工具审核契约。
- 已实现 `getModelToolDefinitions(router)`，只向模型暴露当前 route 允许的工具。
- 已实现 `reviewModelToolCall()`，覆盖工具存在性、route allowlist、contextPolicy、effect/privacy 和参数 schema。
- 已实现 `executeAiToolCall()`，审核失败 blocked，审核通过才执行真实只读工具。
- 已实现 bounded tool result，长输出会标记 `truncated=true`。
- `compileAiContext()` 已复用同一套工具审核/执行器。
- `runDeepSeekChat()` 已接入 OpenAI/DeepSeek 风格 `tool_calls` 一轮审核、执行、observe、回传模型流程。
- 本地门禁：`npm run test:ai-tool-calling`。

尚未完成：

- 真实 DeepSeek live tool-call 尚未单独验收。
- 写入工具尚未开放；AI 写入当前只允许通过 `Confirmation Queue v1` 创建复盘报告草稿。

### 2026-07-28：Phase 3 Confirmation Queue v1 已完成

- 已定义 `AiConfirmationItem`、`AiConfirmationCreateInput`、`AiConfirmationDecisionResult`。
- 已新增 `ai_confirmation_items` 持久化表和 status/session/run 索引。
- 已实现确认队列创建、列表、拒绝、确认执行。
- 已实现 `create_review_report` 白名单动作：确认后写入 `review_reports`、写本地报告 md 文件，并 readback `ReviewReport`。
- `ai:runDeepSeek` 已在结构化 `report_draft` artifact 且存在学生 ID 时生成确认项，确认前不写业务表。
- AI 页面已显示“待老师确认”卡片，支持确认保存和拒绝。
- 本地门禁：`npm run test:ai-confirmation`。

尚未完成：

- 除复盘报告草稿外的 AI 写入动作仍未开放。
- 真实 DeepSeek live `report_draft -> confirmation item` 仍需单独验收。
- UI 还没有确认前的富文本差异编辑器。

### 2026-07-28：Phase 4 SubIntent Router + 96 Eval 已完成

- 已新增 `AiSubIntent` 与 `AiRouterSlots` 契约。
- `routeAiPrompt()` 已升级为 route + subIntent + slots + clarification。
- slots 当前覆盖学生引用、多学生歧义、时间范围、学科、知识点和写入意图。
- `ai_agent_runs.sub_intent`、Agent loop trace 和 DeepSeek prompt 已接入真实 subIntent/slots。
- `eval-cases.ts` 已扩展为 96 条，覆盖 route、subIntent、slots、澄清策略和工具边界。
- 本地门禁：`npm run test:ai-harness`，当前 96/96。

尚未完成：

- 多学生任务只触发一个关键澄清问题，尚未实现多学生并行读取和对比执行。
- router 仍是确定性规则；如后续引入模型分类器，96 eval 仍必须作为硬门禁。

### 2026-07-28：Phase 5 Structured Reply v2 已完成

- `AiStructuredReply` 已升级为 `xiazhi.reply.v2`，新增 `subIntent`、`facts`、`risks` 和 `routeCheck`。
- `schema.ts` 已实现本地 v2 校验和 route-specific 规则。
- 学生诊断必须有 facts 或 unknowns；学生推断必须有 facts 支撑。
- 三元题组必须包含原题、相似题、变式题结构，或提供 `exercise_set` artifact。
- 写入型报告草稿必须在 `teacherConfirmations` 中说明需要老师确认后保存。
- `runDeepSeekChat()` 已增加一次受控 JSON repair，repair 不允许再次请求工具。
- DeepSeek system/user prompt 和前端结构校验提示已切到 `xiazhi.reply.v2`。
- 本地门禁：`npm run test:ai-structured-reply`。

尚未完成：

- 真实 DeepSeek live v2 输出和 repair 仍需单独验收。
- v2 只校验三元题组结构；真实题库召回、题目来源和保存闭环仍属于后续 Phase 7。

### 2026-07-28：Phase 6 Education Grader v1 规则版已完成

- 已新增 `education-grader.ts`，在 `xiazhi.reply.v2` schema 通过后继续评分。
- 已覆盖空泛上传 fallback、学生证据缺口、标签化语言、高风险缺少处置、敏感号码泄露、无事实支撑推断和写入缺确认。
- `runDeepSeekChat()` 已把 `educationGrade` 写入 harness；grader 未通过时 fail-closed。
- 本地门禁：`npm run test:ai-education-grader`。

尚未完成：

- 模型 grader、教师人工评分和年级适切开放评分未接入。

### 2026-07-28：Phase 7 三元题组闭环 v1 第一段已完成

- 已新增 `question_bank_items` 与 `exercise_sets` SQLite 表。
- 已新增 `QuestionBankItem`、`SimilarQuestionMatch`、`ExerciseSet`、`ExerciseSetItem` 等共享契约。
- `practice_design` 路由已加入 `question_bank` 上下文。
- 已新增 `search_similar_questions` 只读工具，从本地题库召回相似题并保留 `sourceKind`。
- DeepSeek prompt 已加入本地题库相似题候选区块和题源边界。
- Confirmation Queue 已扩展 `save_exercise_set`，老师确认前不写入 `exercise_sets`，确认后 readback 真实题组。
- preload / IPC 已暴露 `createQuestionBankItem`、`searchQuestionBank`、`listExerciseSets`。
- 本地门禁：`npm run test:ai-exercise-set`。

尚未完成：

- 真实 OCR、脱敏文本上云分析、完整题库导入 UI、embedding 召回和题组编辑器仍未接入。
- 真实 DeepSeek live `exercise_set -> confirmation item` 仍需在 API Key 配置后单独验收。

### 2026-07-28：Phase 8 错题图片与脱敏链路 v1 第一段已完成

- 已新增 `MistakeImageAnalysis`、`MistakeImageAnalysisInput`、`MistakeImageCorrectionInput`、`SanitizedProblemText`、`MistakeImageRedaction` 等共享契约。
- 已新增 `mistake_image_analyses` SQLite 表，记录学生、学习记录、附件、本地图片路径、OCR 状态、原始解析文本、脱敏文本、脱敏记录、老师修正文和错误信息。
- 已实现 `sanitizeProblemText()`，规则版 v1 覆盖手机号、邮箱、身份证号样式文本和学生姓名/显示名。
- 已实现 `createMistakeImageAnalysis()`：无解析文本进入 `needs_ocr`，有解析文本进入 `sanitized`。
- 已实现 `updateMistakeImageCorrection()`：老师修正后重新脱敏并进入 `teacher_corrected`。
- 主进程 / preload 已暴露错题图片创建分析、老师修正、列表查询和文本脱敏 IPC。
- 本地门禁：`npm run test:ai-mistake-image`。

尚未完成：

- 真实 OCR 引擎未接入；当前只保留 OCR/解析状态和老师修正入口。
- 脱敏文本上云进行错因分析、再触发相似题召回和三元题组草稿的完整自动链路未接入。
- 错题图片分析 UI 未完成；当前主要是数据层、IPC/preload 和 smoke 验收。
- 脱敏规则仍是 v1，学校、地址、复杂人名、社交账号等 PII 仍需扩展。

### 2026-07-28：Phase 9 知识库/图谱增强 v1 第一段已完成

- 已扩展 `TeacherResourceParseStatus`、`ResourceChunk`、`KnowledgeNode`、`KnowledgeEdge` 共享契约。
- `resource_chunks` 已新增学科、年级、知识点、题型、难度、sourceTrust、containsPersonalData、qualityScore、evidenceStrength。
- `knowledge_nodes` 已新增 evidenceStrength；`knowledge_edges` 已新增 evidenceStrength 和 evidenceKind。
- 资源导入时会推断轻量教学元数据、质量分、个人信息标记，并为 chunk/知识点/题型建立图谱节点与可审计边。
- `searchKnowledge()` 已支持多 token 检索，并按个人信息边界和质量分排序。
- `search_teacher_knowledge` 工具会返回证据强度和质量信息；含个人信息 chunk 隐藏正文预览。
- `query_knowledge_graph` 工具会返回节点/边，并显式声明图谱节点是背景关系，不是正文直接证据。
- 本地门禁：`npm run test:ai-knowledge-graph`。

尚未完成：

- PDF/DOCX/PPT/图片等复杂资源解析器未接入。
- embedding 检索、Graph RAG、图谱人工编辑和 AI 写入图谱确认队列未接入。
- 元数据抽取仍是规则版，覆盖面有限，后续需要教师修正入口。

### 2026-07-28：Phase 10 真实文档生成与导出 v1 已完成

- 已新增 `DocumentArtifactType`、`DocumentArtifactStatus`、`DocumentArtifactExportInput`、`DocumentArtifactExportResult` 共享契约。
- 已新增 `document_artifacts` SQLite 表和 session/message 索引，记录真实文件路径、文件大小、sha256、状态与错误信息。
- 已实现 `exportDocumentArtifact()`：Markdown/PDF/DOCX 三类产物由主进程真实写出，写出后计算 hash 并 readback；失败路径记录 `failed`，不显示成功。
- 已新增 `documents:exportArtifact`、`documents:listArtifacts`、`documents:getArtifact`、`documents:showArtifact` IPC/preload API。
- AI 产物面板导出按钮已从占位提示改为真实导出；导出成功后显示文件路径和 sha256 前缀，可通过 artifact id 在文件夹中显示。
- 已新增 `apps/desktop/scripts/ai-document-export-smoke.mjs` 与 `npm run test:ai-document-export`。
- 本轮门禁：`npm run test:ai-document-export`、`npm run test:ai-harness`、`npm run test:ai-tool-calling`、`npm run test:ai-structured-reply`、`npm run test:ai-knowledge-graph`、`npm run build`、`npm run test:smoke`、`git diff --check`。

尚未完成：

- PDF/DOCX 仍是最小有效文件生成器；中文字体、分页、复杂样式、表格、图片、公式和模板能力未完成。
- 历史消息 metadata 尚未自动合并导出状态；下一步应在历史会话打开时按 artifact id 合并 `document_artifacts` readback，或导出成功后回写 assistant message metadata。
- 真实 DeepSeek live 生成文档 artifact 仍需在 API Key 配置后单独验收。

### 2026-07-28：Phase 11 Observability + Regression v1 已完成

- 已新增 `AiTelemetrySnapshot`、`AiTelemetryLatency`、`AiRegressionGate`、`AiRegressionReport`、`AiRegressionReportInput` 共享契约。
- 已新增 `ai_regression_reports` SQLite 表，用于保存 snapshot、gates 和完整 report JSON。
- 已实现 `buildAiTelemetrySnapshot()`，从 run/event/tool/artifact/confirmation/task usage 聚合运行状态、route/model 分布、事件阶段、工具调用、产物状态、确认队列、P50/P95/avg 延迟、token 和上下文预算。
- 已实现 `createAiRegressionReport()`，生成 `agent_runs_terminal`、`event_trace_present`、`tool_trace_present`、`artifact_export_status`、`confirmation_queue_state`、`latency_budget_available` 和 `router_eval_baseline` gates。
- 已新增 `aiObservability:getSnapshot`、`aiObservability:createRegressionReport`、`aiObservability:listRegressionReports`、`aiObservability:getRegressionReport` IPC/preload API。
- 已新增 `apps/desktop/scripts/ai-observability-smoke.mjs` 与 `npm run test:ai-observability`。
- 本轮门禁：`npm run test:ai-observability`、`npm run test:ai-harness`、`npm run test:ai-agent-runtime`、`npm run test:ai-document-export`、`npm run build`。

尚未完成：

- 还没有 Observability UI 仪表盘、回归报告 Markdown/HTML 导出和失败样本自动回放。
- token budget 只统计已写入 usage 的任务；真实 DeepSeek live usage 仍需单独验收。
- 历史会话 UI 尚未按 runId 展开完整 `ai_agent_events` / `ai_tool_runs` 轨迹。

## 20. 长期不可变底线

- 不做学校级平台。
- 不做学生端、家长端、完整 LMS。
- 不自动上传原始附件。
- 不自动形成永久学生标签。
- 不在老师确认前写入。
- 不展示隐藏思维链。
- 不把工具 ready 当 used。
- 不把生成题冒充本地题库题。
- 不把知识图谱节点冒充正文证据。
- 不让 UI 模板伪装成真实 agent 执行过程。
