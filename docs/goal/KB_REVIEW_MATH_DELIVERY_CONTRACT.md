# KB002-C3 审核公式可读性切片（2026-10-12）

## Recherche / Reuse

实际保存链路 `question-review-repository.ts` 已将 A–D 选项完整拼接进题干，PaperReviewPanel 和导出沿该题干读取。上一片待办中的“选项遗漏风险”未成立，不增加 options 真源、DDL 或导出 v5。

实际缺口是组卷预览和通用答案/解析区直接输出 TeX。复用既有 KaTeX 0.16.47 与 `shared/office-math.ts` 的严格 MathML 编译；HeroUI 官方 markdown 文档已核对，本片固定题目文本无需启用额外 Markdown/流式处理器。Office 原有公式段复用同一个显示组件。

## Contract / Implement

- 教师结果：试卷题干、投影条件、答案和解析直接显示公式；无法排版时保留完整原文并提示，不丢题目内容。
- 只修改 renderer 组件与既有实例脚本；无新依赖、IPC、数据库、模型调用或主进程授权变化。
- 生成题审核卡增加随编辑更新的可折叠公式预览，沿原文本编辑和质量检查/确认，不改变确认门槛。
- 不改题目编辑文本、不回写旧题、不变更来源、数学核验、审批和文件合同。
- 共享显示组件仅消费文本，HTML 来自既有转义与 trust=false 编译；保持换行、长公式局部滚动。
- 回滚：本片 before 副本在 `apps/desktop/test-results/goal/kb-review-math-20261012/before`，只撤本片 diff，保护已有 dirty 改动。

## Acceptance

构建/typecheck + 复用上一片已保存复杂数学题的一次正式 Electron 页面实例，验证题干/答案/解析 MathML、浅1366×768/暗1920×1080与保存事实未改。仅关键实例，按用户最新要求不重复全量组件/领域回归。未排版错误保留原文、HTML 转义与资源指令拒绝做本地小样例。

本片不代表自然扫描图文三模式、全学科正确性、五变式和30–40GB增量已经完成。后续依序：自然复杂三模式与源图+公式同卷 → 错题五变式 → 后台增量/任务优先。
