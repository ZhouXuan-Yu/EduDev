# C02：按需 Notebook Analysis / Summarize

## 目标

将 DeepTutor 的 Notebook Analysis/Summarize 能力接入小智真实 HostTool 注册表：只有用户明确提到“笔记、备课本、历史草稿、notebook”时才启用 `teacher_notebook` context；普通问答不读取备课本正文。

## 复用与适配

- 复用 `python/vendor/deeptutor/services/notebook/service.py` 的 Notebook/NotebookRecord 语义和目录优先思路。
- 复用 DeepTutor notebook agent 的“先选择记录、再读取有限细节、最后形成摘要草稿”边界。
- 不复制 DeepTutor JSON 存储；所有数据仍由 Omni-Edu SQLite `teacher_notebooks` / `teacher_notebook_records` 提供。
- 通过 `apps/desktop/src/main/ai-harness/notebook-analysis.ts` 输出 `omni.notebook.analysis.v1`，目录最多 200 条，细节最多 5 条，单条正文最多 1800 字符。

## 工具合同

工具名：`analyze_notebook_context`

- `mode=context`：返回按查询排序的目录、最多 5 条脱敏细节、覆盖范围和未读取数量。
- `mode=record_summary`：只对当前可见备课本中的指定记录生成摘要草稿；草稿标记 `requiresTeacherReview=true`，不自动保存。
- `notebookId` / `recordId` 指定后做本地范围校验；不存在、已删除或跨备课本访问均阻断。
- 查询、备课本名、标题、摘要、用户问题和输出均通过 `sanitizeProblemText` 脱敏；原始笔记文件和本地路径不进入模型结果。
- 工具为 `draft + local_only`，无业务写入；写回必须另走教师确认队列。

## 验收

```text
npm run test:deeptutor-notebook-analysis
```

专项 smoke 14/14：路由按需启用、脱敏、长度预算、record summary、跨备课本阻断、缺失记录阻断、HostTool round-trip 与 no-write 均通过。真实模型摘要质量、教师人工复核一致性和 UI 摘要编辑器仍未完成。
