# C03：Question Notebook 题目收藏、分类与历史引用

## 第一性边界

Question Notebook 是题库之上的“教师索引层”，不是第二套题目存储。题干、答案、解析、来源和题目 ID 始终来自 Omni-Edu `question_bank_items`；收藏、分类、版本和历史引用单独存储为 overlay。

## DeepTutor 复用与适配

- 复用 `python/vendor/deeptutor/api/routers/question_notebook.py` 的 bookmarked、categories、entry-category linking、usage/reference 语义。
- 复用 DeepTutor Question Notebook 的分页、按收藏/分类筛选和历史引用计数边界。
- 不复制 DeepTutor `notebook_entries` 题目正文，也不引入其独立 SQLite；Omni-Edu SQLite 是唯一题库真源。

## 数据与接口

- `question_notebook_bookmarks`：题目收藏状态、乐观 `version`。
- `question_notebook_categories`：分类名称、软删除、恢复和版本冲突。
- `question_notebook_category_links`：题目与分类多对多关系。
- `question_bank_usage`：题目被题组、学习记录或教师手动引用的历史索引，唯一约束避免重复引用。
- main/preload IPC 提供收藏、分类 CRUD、分类关联、历史引用读写和分页检索。

## 小智工具合同

工具：`search_question_notebook`

- 只有明确提到收藏、题目笔记本、错题本、书签或题目分类时才由 router 加入 `question_notebook` context。
- 不读取学生档案、学习记录或教师知识库；只返回题库 overlay 和 bounded 题目字段。
- 题目正文、标签、分类和查询先经 `sanitizeProblemText`，原始敏感字段不进入模型结果或审计摘要。
- 工具只读；收藏/分类修改必须通过教师操作和版本校验，不允许模型直接写入。

## 验收

```text
npm run test:deeptutor-question-notebook
```

专项 smoke 22/22：canonical 题库唯一真源、收藏、分类、分类软删除/恢复、历史引用、重复去重、版本冲突、敏感题干脱敏、bounded 输出、错误题目阻断、HostTool round-trip 和 no-duplicate-corpus 均通过。
