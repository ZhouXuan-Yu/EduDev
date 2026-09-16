# 小智教育 Agent 工程基线

版本：v2.0  
日期：2026-09-16  
状态：小智唯一权威工程方案

## 1. 定位

小智是教师工作台的受控任务助手，不是独立聊天产品，也不是能绕开业务规则的超级入口。它负责识别任务、选择最小上下文、调用白名单工具、解释来源、生成候选、发起确认和交付产物；正式数据仍由业务模块与教师确认控制。

## 2. 标准执行链

```text
教师输入/工作台动作
-> route + subIntent
-> capability 选择
-> 最小上下文装配与隐私策略
-> 受控 AgentLoop
-> HostToolProxy 审核/执行
-> xiazhi.reply.v2 结构校验
-> 教育、安全和可用性门禁
-> 确认或只读结果
-> SQLite 事件/readback
```

每次运行创建 `ai_agent_runs`，公开阶段写入 `ai_agent_events`。所有 early return、配置错误、超时、工具错误、schema 失败和取消都必须结算明确终态，不能永久停留 `running`。

## 3. Route 与 Capability

route 至少覆盖：普通问答/工作台帮助、知识检索、资料处理、组卷、错题/OCR、学生诊断、题组、报告/备课和文档产物。route 到 capability 和 capability 到 route 必须有单一版本化映射，并由 eval 覆盖。

模型不能靠超长 prompt 获取所有能力。先暴露核心工具和 `load_tools`，再按 route/context allowlist 渐进披露工具族。加载工具目录不等于执行工具；只有宿主真实执行并产生 observation 才可显示 `used`。

## 4. 上下文策略

- 默认只发送当前任务所需的最小字段和短摘要。
- 学生数据、知识库正文、原始附件和本地路径按 route 单独授权，不因进入 AI 页面自动加载。
- 学生引用先尝试本地解析；事实、推断和未知必须分离。
- chunk 带 sourceId/page/chunkId/evidenceStrength；`direct`、`indirect`、`background` 不得混淆。
- 检测到个人信息时，云端工具结果隐藏正文并返回必要元数据/边界。
- prompt、tool result、event 和 stderr 都有字符/token 上限；超限明确截断或失败，不能静默吞掉关键 schema。

## 5. 工具与权限

所有模型工具调用先经过 Electron main 的 `reviewModelToolCall()` 或等价宿主审核：工具存在、route allowlist、context policy、effect、privacy、参数 schema、预算和幂等键。

工具分为：

- read：可在授权上下文内读取有界数据。
- draft：生成草稿或预览，不写正式真源。
- write：必须创建确认项，教师确认后由宿主执行。
- external：涉及网络、付费或外部资源，除业务已有明确授权外必须单独确认。

renderer、模型和 Python sidecar 都不得直接写 SQLite。写操作使用事务、幂等和 readback；拒绝、过期或已执行确认项不得重复执行。

## 6. 结构化输出与恢复

最终回复使用版本化 `xiazhi.reply.v2` 或后续兼容 schema。DeepSeek 请求优先使用 `response_format={type:'json_object'}`；允许提取单个完整 JSON 对象和在 64,000 字符内修复有限 JSON 语法，但不得补造缺失语义。

provider 输出为空、截断或 schema 失败时最多进行受控恢复；恢复固定低随机性、无新工具、无新事实。最终仍不合法则 fail closed，不能把 Markdown、猜测或半个对象当作成功。

结构校验通过后仍需：隐私/安全、证据、教师控制、年级适切、可执行性和简洁性门禁。critical 问题不得展示成成功答案。

## 7. 教育与产品规则

- 题目优先从本地题库召回；改编和生成必须标注来源。
- 组卷和针对性题组都输出候选，不自动成为正式产物。
- 错因和学生判断是带证据的建议，教师可修改，不形成不可见永久标签。
- OCR 无文本时返回 `needs_ocr`，不能伪装成分析完成。
- 原始错题图片、教师资料和学生敏感信息默认不上云。
- 小智回答按 route 控制长度；先给教师可用结论、依据、下一步和确认，不机械展示内部字段。
- 知识图谱只提供关系背景，没有 chunk/source 证据时不能作为直接事实。

## 8. Confirmation Queue

AI 发起的正式题库、题组、试卷、报告或学生结论写入，先保存不可执行草稿和确认项。确认项包含类型、预览、来源、差异、风险、幂等键、版本和过期时间。

教师确认后由 main 原子 claim、执行、readback，并把业务 ID/版本写入结果；失败可重试但不重复落库。renderer 编辑过的草稿必须把最终编辑值提交给确认契约，不能继续保存原始 payload。

## 9. 可观测与隐私

公开事件只保存可验证的 stage、tool、source、budget、termination 和有界摘要；不得保存或展示隐藏推理链。UI 只能渲染白名单投影，私有 request snapshot 和完整 prompt 不进入 DOM/搜索/React state。

回归报告从真实 SQLite 的 run/event/tool/artifact/confirmation/task 数据计算。warning/failed 不得被 UI 改写为通过；上游未提供 token/usage 时显示 unavailable。

## 10. Eval 与测试

测试分层：

1. deterministic route/schema/policy eval。
2. 工具审核、预算、错误与恢复 smoke。
3. SQLite 事件、确认、产物和重启 readback。
4. renderer 组件状态与 Electron 用户路径。
5. 真实 provider live replay。
6. 真实教师人工评分，口径见 `23_XIAOZHI_USABILITY_EVAL_RUBRIC.md`。

fake model、proxy grader、seed fixture 和 dry-run 只证明确定性工程链路。只有提供真实 key、真实请求和真实输出证据时才可写 live 通过。

route/subIntent、工具白名单、结构化回复、确认队列、文档导出或可观测规则变化时，必须运行对应专项测试和 `npm run test:ai-observability`。人工评分、replay 和 model grade 保留 runId/sessionId/promptVersion/token 等证据绑定。

## 11. 代码组织

- profile：route/capability/context/permission 的版本化真源。
- tools：按领域拆分，不在单一 dispatcher 无限加分支。
- runtime：loop、预算、取消、终态和事件。
- schemas/graders：结构、教育、安全、可用性门禁。
- confirmations：草稿、确认、幂等执行和 readback。
- observability/evals：回归数据和测试样本。

DeepTutor 仅作为可替换执行内核，边界见 `24_DEEPTUTOR_OMNI_EDU_INTEGRATION_DESIGN.md`。小智的产品契约、权限、数据和测试不得依赖特定模型供应商。

## 12. 完成定义

新增 AI 能力必须同时具备真实 route、最小上下文、工具/模型执行、结构校验、安全门禁、教师确认边界、事件终态、前端反馈、SQLite/文件 readback、重启复验和对应 E2E。注册工具或写完后端而没有前端与测试，状态只能是“后端已实现”。
