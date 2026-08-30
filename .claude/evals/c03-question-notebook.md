# C03 Question Notebook Evals

## Capability

- 现有 `question_bank_items` 是题目正文唯一 canonical 真源。
- 题目收藏可读写，且 stale version 被拒绝。
- 分类可创建、重命名、关联、软删除和恢复。
- 题组保存会为现有题目产生去重历史引用。
- `question_notebook` route 只装配最小上下文和 `search_question_notebook` 工具。

## Adversarial

- 未知题目 ID、未知分类 ID 和跨边界调用 fail-closed。
- 删除分类不会删除题目正文，恢复后关联仍可读。
- 敏感题干不会原样进入 tool result、source 或审计输入摘要。
- 查询和结果有长度/数量预算，不复制第二题库。
- HostToolProxy round-trip 只接受 practice capability 与当前 route 匹配。

## Regression

- `npm run test:ai-harness`：100/100。
- `npm run test:deeptutor-capability-evals`：48/48。
- `npm run build`、Electron smoke、observability smoke 必须通过。

## Evidence command

```text
npm run test:deeptutor-question-notebook
```

## Renderer acceptance (2026-08-11)

- 题本入口必须出现在左侧导航，并通过 `window.omniEdu` 调用 list/bookmark/category IPC；禁止 renderer 直接导入数据库模块。
- 搜索、分类、仅收藏、答案解析展开、来源/使用次数和空结果提示必须有可见 UI 分支。
- 分类删除必须调用软删除 IPC；收藏版本冲突必须保留本地页面可恢复，并提示刷新，而不是静默覆盖。

Evidence: `npm run build` passed. This is a static/compile boundary; interactive teacher usability and bulk migration remain open.
