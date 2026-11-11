# 20261111 教学能力与入口迁移映射

## 当前状态

IMPLEMENTED_STATIC。root 已解冻，精确10文件已实现，本表的新入口可供 root/Terra 接入，正式运行验收仍须由新构建证明。完整 SHA 清单见 static-check.json 的 files 数组。

## 入口与原测试定位

| 能力 | 当前入口或问题 | 计划去向 | 保留定位和业务 |
| --- | --- | --- | --- |
| 教学文件目录 | 第二层大宽标签后再展示目录与空详情 | 教学文件默认全宽目录，整包和课堂为紧凑辅助入口 | teaching-artifacts-workspace、artifacts-search、artifacts-refresh、artifact-{id} |
| 教学文件详情 | 固定并列详情，空对象占用主区 | 选择真实文件后显示原详情，返回目录可达 | artifacts-detail、artifacts-preview/open/locate/conversation，原 PiOfficeCurrent、PiOfficeVersions、PiDeliveryCheck、PiArtifactSources、原预览宿主 |
| 整包任务 | teaching-deliveries-tab 大宽标签 | 同 ID 保留于紧凑辅助入口 | teaching-deliveries-workspace、deliveries-refresh/more、delivery-{id}、delivery-detail、delivery-conversation、delivery-detail-refresh；原逐项交付/继续与文件预览 |
| 互动课堂 | teaching-classrooms-tab 大宽标签 | 同 ID 保留为紧凑“课堂设计与预演”入口 | ClassroomWorkspace 原组件与 data-testid；保持已访问内容挂载 |
| 备课本目录 | 窄列表与完整新建表单并列 | 默认完整目录，选本或新建后显示编辑区 | teacher-notebook-list-panel、teacher-notebook-search/refresh/show-deleted、teacher-notebook-item-{id}、empty/filter-empty/loading |
| 新建备课本 | 0 本时无操作就露完整表单 | teacher-notebook-new 打开原名称与说明表单 | teacher-notebook-editor-panel/name/description/create，新增返回目录入口；表单关闭后草稿保留 |
| 备课本编辑/删除/恢复 | 选本后原信息区 | 对象编辑视图中保持现有操作 | teacher-notebook-save/delete/restore，version 载荷、deleted 只读和 actionLock |
| 备课笔记 | 原笔记列表、添加与编辑 | 选定备课本后继续原列表和表单 | teacher-notebook-records-panel、record-form/type/title/output/query/summary/save/cancel、record-edit-{id}/delete-{id}；全部原字段和原补充披露 |
| 讲义目录 | 窄目录与创建表单并列 | 默认目录，新建按钮与搜索贴近列表 | teaching-book-library/refresh/show-archived/loading/error/success/empty、teaching-book-item-{id} |
| 讲义新建/信息 | teaching-book-new，初始也展示创建区 | teaching-book-new 显式打开创建；对象选择进入原信息编辑 | teaching-book-editor/title/target-level/language/status/description/create/save/archive；新增返回目录入口 |
| 讲义章节/页/块 | 选中对象后的组合层 | 原对象编辑页完整保留，必要配置按需展开且保持挂载 | teaching-book-structure/chapter-*/page-*/blocks/block-*，原版本检查、生成标记与取消 |
| 讲义来源/补丁/导出 | 原来源健康、整块与选区 patch、预览 | 原对象编辑页继续可达 | teaching-book-sources/health*/source-*/invalidations、patch-*/selection-*、preview-panel/preview/preview-meta/preview-refresh/export |
| 讲义归档只读 | 首屏出现“SQLite/乐观版本锁/后端”等实现术语 | 用“保存在本机/内容变化请刷新/归档后只读”等教师状态文案 | teaching-book-archived，归档原 guard、真实版本数据、无恢复接口的实际约束 |
| 题本真实题目 | 相似题和多行过滤占首屏 | 标题、搜索、简要过滤、真实题目优先，分页置列表后 | question-notebook-workspace/search/category-filter/bookmarked-only/summary/loading/error/success/list/card-* |
| 扩展题目筛选 | 默认全量年级/学科/题型/知识点/难度/来源 | 明确筛选披露，当前条件保留 | question-notebook-filters/filter-*、source-candidates、clear、retrieval-method、duplicate-scope；现有筛选仍触发原请求 |
| 相似题检索 | QuestionSemanticSearch 顶置 | “按题意找相似题”按需披露 | 原 question-semantic-* 全保留，查询输入和结果保持挂载 |
| 新建题目 | 默认页面下方完整创建区，02 编号 | 明确新建入口打开原创建区 | question-notebook-create-panel 与原 new-*、create-question、cancel-new；useQuestionEditGuard root 不换 |
| 分类管理 | 默认完整表单，03 编号 | “分类管理”披露 | category-admin/name/create-category/rename-input-*/rename-category-*/delete-category-*、deleted-categories/restore-category-* |
| 题目来源与教师核对 | 原 card 内原图/补正/答案/来源 | 真实题目列表中保留原组件 | QuestionOriginalPicture、QuestionContextEditor、QuestionArchiveEditor、QuestionAnswerEvidence，answer-fold-*、source-*、usage-*、category-* |
| 题篮回接 | paperReturn 独立提示与按钮 | 页面顶部保持明确回接提示 | question-notebook-paper-handoff/materials/return-paper，原回接 reference 与 dirty 阻断，保存成功后由教师返回原题篮 |
| 题目来源说明 | 04 装饰编号与整块说明 | 次要来源说明按需展示 | 原本地题目、收藏分类、历史与来源事实文字保留，01–04 仅装饰编号移除 |
| 课堂要求输入 | 横排导致 TextArea 181×56 截断 | 制作类型、完整宽度要求输入、提交分行布局 | classroom-requirement/create、lesson-create-mode，原 maxLength、busy/dirty、真实 startXiaozhi 载荷 |
| 完整教案 | 与互动课页共用制作入口 | 原切换与 TeachingLessonCreate 保留 | 原 requirement 和 disabled，原教案结构与来源约束 |
| 课堂列表/成果 | 0 课堂时空列表和空详情并列 | 空态单一区域；选择真实成果显示原详情 | classroom-{id}、refresh、slide-preview、page-*、quiz/check-answer/answer-feedback |
| 课堂修改/核对/导出 | 原成果工具条 | 真实课堂详情保留全部动作 | classroom-title-edit/edit/save、export-pptx/handout-docx/handout-pdf/teacher_notes-docx/teacher_notes-pdf，原取消编辑、拒绝草稿、来源对话 |
| 大纲与进度 | ClassroomOutlineEditor 真实已有大纲 | 直接复用原组件 | classroom-plan-*、lesson-structure-error，原保存新版本、确认、生成、停止、历史恢复、预演回接与 readOnly |

## 状态和实现前复核点

| 消费者 | 已读的保护逻辑 | 实现时必须保持 |
| --- | --- | --- |
| TeachingArtifactsWorkspace | epoch 防旧目录请求覆盖，真实 family/current 版本过滤，locate busy/error/notice | 只选真实文件，原权限宿主与来源/版本控件保持对象身份 |
| TeachingDeliveryWorkspace | listEpoch/detailEpoch、listLock，读取/继续回原 session | 切换和刷新时旧详情不能覆盖新对象 |
| TeacherNotebookWorkspace | listEpoch/recordEpoch、selectedRef、actionLock、catalogueFailed、保存后再读列表 | 列表呈现分离于表单草稿；只读/删除/恢复和已保存但列表失败文案保留 |
| TeachingBookWorkspace | 原 version 载荷、archived disabled、保存/patch 后回读、导出 Promise.race | 组合层调整继续使用原 handler，不把隐藏或返回解读成保存/取消 |
| QuestionNotebookWorkspace | requestRef、requireReadback；读取中保留原 item 编辑；paperReturn 启用 QuestionEditBoundary | 创建披露触发放入原 ref section 内，保存/取消始终可达；原题面教师确认 guard 和结果未知反馈继续有效 |
| ClassroomWorkspace | dirty 切换/刷新阻断，桌面命令优先级35，外部 pointer/key 捕获，validClassroom、version | 跨课堂辅助入口的导航继续经过原拦截，保持草稿挂载，禁用语义原样 |
| ClassroomOutlineEditor | epoch/selection、防生成中覆盖 dirty、大纲命令优先级36、readOnly、canGenerateClassroomPlan | 原确认和生成属于独立动作，原 history 回读和恢复到草稿继续有效 |

现有 teaching editors live 脚本通过 teacher-notebook-new、teaching-book-new 开始创建，原字段与保存 ID 应继续直达。若低频配置新增披露，root/Terra 按本表显式打开对应入口后运行原断言。测试入口调整不能删除业务断言或把隐藏控件当成功验证。

## 验收移交

本轮已完成源码和静态检查，正式构建、GUI、性能及业务结果由 root/Terra 回填。失败 PNG 与原始发现保持原路径。此前 root 构建冻结期间生产写入为零，收到明确解冻语句后开始实施。

## 已实现的新入口及 QA 调整

| 目标操作 | 必须先操作的新父入口 | 保留的原定位 |
| --- | --- | --- |
| 显示原始候选和扩展筛选 | question-notebook-filter-toggle，实际 Button，可直接 click | question-notebook-source-candidates、question-notebook-filter-* |
| 创建、改名、删除分类 | question-notebook-category-toggle 内名称为“分类管理”的确切 button | question-notebook-category-name、question-notebook-create-category、rename/delete 原 ID |
| 恢复分类 | 先展开 question-notebook-category-toggle，再展开原 question-notebook-deleted-categories | question-notebook-restore-category-{id} |
| 相似题检索 | question-notebook-semantic-toggle 内名称为“按题意找相似题”的 button | 原 question-semantic-* |
| 创建题目 | question-notebook-new 顶部主要行动，或 question-notebook-create-toggle 原创建区内按钮 | question-notebook-create-panel、new-*、create-question、cancel-new |
| 返回备课本目录 | teacher-notebook-back | 原全部 CRUD/笔记 ID |
| 返回讲义目录 | teaching-book-back | 原全部章节、页、块、来源、patch、导出 ID |
| 返回教学文件 | teaching-files-tab 为 Button，位于紧凑“教学内容”导航 | teaching-deliveries-tab、teaching-classrooms-tab 原 ID 仍为唯一可见入口 |
| 关闭文件详情 | artifacts-back | 原文件预览、版本、来源与定位 ID |

ui-final-paper-number-live.mjs 在勾选 question-notebook-source-candidates 前，显式打开 question-notebook-filter-toggle。在填写 question-notebook-category-name 前，显式打开 question-notebook-category-toggle 内确切“分类管理”触发按钮。其后教师补正、来源核对、原题号、分类关联与题篮断言全部继续运行。本 writer 未修改 QA 脚本。

建议 QA 使用以下唯一定位。披露根的 data-testid 位于 Disclosure.Root，触发操作定位其内部的确切按钮。

```js
await page.getByTestId('question-notebook-filter-toggle').click();
await page.getByTestId('question-notebook-source-candidates').check();
await page.getByTestId('question-notebook-category-toggle')
  .getByRole('button', {name: '分类管理', exact: true}).click();
await page.getByTestId('question-notebook-category-name').fill(chapterName);
await page.getByTestId('question-notebook-create-category').click();
```

备课本和讲义保留原读取时自动选首项的行为，通过独立 editorOpen 状态控制首屏。原 teacher-notebook-new、teaching-book-new 一次打开原表单，返回目录保持本地草稿和编辑区挂载。题本创建区 ref 和原 guard 继续绑定同一个 section，有新题草稿或保存中时创建字段保持可见且收起按钮禁用。

课堂要求 TextArea 使用已安装官方声明支持的 fullWidth 和原生 rows={4}，外层 grid 独占一行。当前互动课堂与已访问整包页保持挂载，原课堂和大纲 dirty 事件拦截继续决定可否离开。ClassroomOutlineEditor 源码保持原样。
