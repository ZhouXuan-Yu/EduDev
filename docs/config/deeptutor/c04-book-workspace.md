# C04 DeepTutor Book Workspace → Omni-Edu 专题讲义/单元备课包

## 复用与边界

- 复用 DeepTutor `deeptutor/book/models.py` 的 book/chapter/page/block 状态机、`engine.py` 的单页/单块恢复语义、`compiler.py` 的逐块持久化原则和 `kb_health.py` 的来源指纹/漂移检测思想。
- 不复制 DeepTutor 的文件型 JSON storage，也不引入通用 LMS；Omni-Edu 使用本地 SQLite，现有知识资源仍是正文真源。
- `teaching_books`、`teaching_book_chapters`、`teaching_book_pages`、`teaching_book_blocks`、`teaching_book_sources` 只存结构化编排、bounded payload 和来源锚点。

## 已实现接口

- DB：`create/list/get/update/deleteTeachingBook`、chapter/page 创建、block upsert、source 注册、page/block regeneration、`getTeachingBookHealth`。
- IPC：`teachingBook:*` 全部通过 preload 暴露；renderer 不直连 SQLite。
- AI：`inspect_teaching_book` 为 local-only、read-only HostTool；只在 `lesson_design/knowledge_retrieval/report_draft` 且显式讲义请求时可用。
- 结构化输出：`omni.teaching.book.v1`，包含章节、页面、块状态、sourceRefs、stale/missing health，不返回学生数据或原始文件内容。

## 验收

- `npm run test:deeptutor-book-workspace`：26 cases，覆盖来源健康、漂移定位到 block/page、版本冲突、页/块重生成、显式 ID 缺失 fail-closed、HostTool round-trip、bounded 输出和 no-student-context。
- `npm run test:ai-harness`：102/102，routeAccuracy=1。
- 当前仅验证本地 store/HostTool/route，不宣称 DeepSeek live provider 已验证。

## 下一步

C05 继续实现 block renderer/export fallback（text/chapter/quiz/card/figure/concept graph/prompt），并把导出绑定到现有 `document_artifacts` 的显式教师确认边界；不允许由 inspection tool 直接写入或发布。
