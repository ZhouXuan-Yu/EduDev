# 小智教师可用性评测 Rubric v1

## 定位

本文件定义小智教师可用性评测的人工评分口径。当前代码中已经有 `apps/desktop/src/main/ai-harness/usability-eval-cases.ts` 的 25 条代表性 proxy 样本，用于本地回归；这些样本不能替代真实老师人工评分。

## 评分维度

每条真实老师任务按 1-5 分评分：

| 分数 | 口径 |
| --- | --- |
| 5 | 老师可以直接使用，回复短、准、有依据，下一步可执行；如涉及写入，确认入口清楚。 |
| 4 | 基本可用，只需少量措辞或顺序调整；没有明显错误或打扰。 |
| 3 | 有部分帮助，但需要老师明显返工；可能过长、下一步泛化或证据边界不够清楚。 |
| 2 | 多数内容不可直接用；存在模板化、绕路、答非所问或需要老师重新组织。 |
| 1 | 失败回复；例如要求老师手动切模块、编造证据、无确认写入、标签化学生或泄露隐私。 |

## 必须记录字段

真实人工样本至少记录：

- `sampleId`
- `prompt`
- `route`
- `subIntent`
- `teacherScore`
- `needsRewrite`
- `roundsToUseful`
- `mainIssueCode`
- `teacherNote`
- `reviewedAt`

## 当前自动门禁

当前确定性门禁包括：

- `npm run test:ai-usability`：25 条代表性 proxy 样本全通过。
- `npm run test:ai-human-review`：seeded 人工评分样本写入 `ai_usability_reviews`，并验证列表、summary、snapshot 和 `teacher_review_score_gate` readback。
- `npm run test:ai-replay`：seeded before/after 人工评分样本写入 `ai_usability_replay_experiments`，并验证 delta、summary、snapshot 和 `usability_replay_improvement_gate` readback。
- `npm run test:ai-model-grader`：seeded 模型裁判样本写入 `ai_model_grades`，并验证模型 grader proxy、年级适切评分、summary、snapshot 和 `model_grader_quality_gate` readback。
- `npm run test:ai-human-review-ui`：真实 Electron 设置页保存人工评分、CSV/TSV 导入、失败样本回放、选择 before、保存 after，并从 SQLite summary / replay summary readback。
- `npm run test:ai-observability`：回归报告包含 `usability_quality_gate`、`teacher_review_score_gate`、`usability_replay_improvement_gate`、`model_grader_quality_gate` 和 `usability_eval_baseline`。
- `npm run test:ai-live-usability`：配置 `DEEPSEEK_API_KEY` 后跑真实 DeepSeek 可用性回放；无 key 时明确 skipped。

## 当前存储与 API

- 人工评分表：`ai_usability_reviews`。
- before/after 回放实验表：`ai_usability_replay_experiments`。
- 模型裁判样本表：`ai_model_grades`。
- 写入 API：`OmniEduStore.createAiUsabilityReview()` / preload `createAiUsabilityReview()`。
- 读取 API：`listAiUsabilityReviews()`、`getAiUsabilityReviewSummary()`。
- replay API：`createAiUsabilityReplayExperiment()`、`listAiUsabilityReplayExperiments()`、`getAiUsabilityReplaySummary()`。
- model grader API：`createAiModelGrade()`、`listAiModelGrades()`、`getAiModelGradeSummary()`。
- UI 入口：设置页“小智质量评审”面板，支持单条录入、CSV/TSV 导入、失败样本回放到 AI 输入框、把失败样本设为 before 后保存 after 评分形成回放实验，并展示模型 grader 裁判样本汇总。
- telemetry 字段：`AiTelemetrySnapshot.humanUsability`、`AiTelemetrySnapshot.usabilityReplay`、`AiTelemetrySnapshot.modelGrader`。
- 回归 gate：`teacher_review_score_gate`、`usability_replay_improvement_gate`、`model_grader_quality_gate`。

## 当前边界

- proxy 样本用于防回退，不代表真实老师评分。
- seeded human-review smoke 用于验证工程链路，不代表外部老师真实评分。
- v1.4 before/after replay experiment 已能绑定两条人工评分 review 并计算分数/轮次/issue 改善，但当前 smoke 仍是 seeded 样本，不代表外部老师真实评分。
- v1.5 model grader 已接入本地 deterministic proxy、`ai_model_grades`、年级适切评分维度和 regression gate；它是 LLM-as-judge 的工程落点，不等于已经执行真实外部模型裁判。
- 已接入真实 DeepSeek live 样本回放脚本，但本地无 `DEEPSEEK_API_KEY` 时只会 skipped。
- 尚未接入真实外部老师样本集、live DeepSeek 输出自动绑定二次评分、趋势图和真实 LLM-as-judge 裁判。
- 只有真实老师样本平均分 >= 4/5、返工量下降、常见任务 1-2 轮内完成后，才可把 Phase 12 的最终人工验收标记为完成。
