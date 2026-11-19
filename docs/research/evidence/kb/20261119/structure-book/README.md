# 已核对结构题匹配独立答案册

本轮对应 M02、M03 和 M05。教师在题本核对原图、保存完整题面后，可从“查看答案与解析”匹配知识库中已关联的答案册。题目和答案各自保留原件、版本及页码。

## 根因与修改

以前的匹配器从 AI 原页成员表取题。默认结构导入题即使完成原件核对与转写，也无法使用这一入口。现在用冻结的结构稿、父题编号和原试卷标题定位现有索引。最多回看 32 个前页，支持标题在前页。未识别的新章节标题会截断继承，双栏顺序不明、同标题下在范围内重复的题号、同号错章、错册凭据及原件版本变化会阻止写入。

真实答案册第 3 页被切出 48 个检索块，旧入口因题目页的 16 块上限退出。答案册现在直接使用整页原件回执及同页 OCR 文本。失败前后使用同一份 PDF 摘页，原页文本、图像、许可、两遍结果及隐私门禁仍接受各自校验。答案索引和 SQLite 日志继续复用。

| 涉及文件 | 实际变化 |
| --- | --- |
| `material-structure-book-scope.ts`、`material-structure-repository.ts` | 从冻结结构页恢复原题范围。保存并复核题册版本、题号、标题页及页面摘要 |
| `material-book-answer-repository.ts`、`material-ai-repository.ts` | 复用配对索引、答页凭据与事务写回。密集答案页直接读取整页 OCR |
| `question-book-answer.ts`、`question-archive.ts`、`material-ai-ipc.ts`、`preload/index.ts`、`db.ts` | 对已有 IPC 增加结构题请求，严格检查题本版本及来源，兼容既有 AI 题目与答案日志 |
| `QuestionStructureBookMatch.tsx`、`QuestionNotebookWorkspace.tsx`、`MaterialBookMatches.tsx` | 题本内提供匹配、结果回读和打开独立答案原页 |
| `kb-structure-book-boundaries.mjs`、`kb-structure-book-journey.mjs`、`kb-ai-page-boundaries.mjs` | SQLite 边界、真实桌面路径、密集答案页和隐私回归 |

## 验证

- 两份本地排印 PDF 完成题本核对、完整转写、配答、原页查看和重启回读。试题位于第 2 页，标题取自第 1 页，答案原页是独立 PDF 的第 1 页。在 1366×768 和 1920×1080 检查了操作可达性。写回后转写和原图相同，SQLite 完整性检查通过。写回构建单次点击到显示结果约 300 ms，后续构建已有结果重匹配约 418 ms。旧版本缺少这一入口，因此没有同路径基线耗时。两个周期均无新增模型请求。
- 用 PDFium 提取用户提供的《五年中考三年模拟》题册第 4 页和答案册第 3 页，逐像素核对摘页与原页一致。修复前，48 块答案页在发起请求前报 `unit_too_large`。修复后，应用读取整页 OCR 和原页，通过受控传输回放两次历史答页响应，目录索引 22 条，整页仍按既有质量规则保留待核状态。真实云端请求为 0。原资料、OCR 原文、题目截图和历史回复均只保留在本地隔离测试目录。
- 真实主书第 4 页得到 12 个候选，其中 11 个待核。唯一暂列为规则候选的第 12 题混入了左栏相邻选择题的选项。该题没有教师核对和配答写回。同页可继续用于验证双栏隔离修复。

| 命令或范围 | 结果 |
| --- | --- |
| `node --experimental-transform-types scripts/education/kb-structure-book-boundaries.mjs` | 结构题 8/8，旧匹配 36/36 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-boundaries.mjs` | 独立书页文档 7/7 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/question-web-document-boundaries.mjs` | 网页文档 14/14 |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | 249/249，含密集答案页和页级隐私门禁 |
| `npm run build` | TypeScript 和 Electron 构建通过 |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/electron-smoke.mjs` | 本轮结构匹配初版构建退出 0。后续密集答案页修复由 AI 原页回归及本轮专项覆盖 |
| `node --experimental-transform-types scripts/education/kb-structure-book-journey.mjs <受控资料运行根>` | 专项 2/2，含重启后的 typed IPC 来源核对 |
| `npm run test:ui-contracts` | 存量 PromptInput 原厂指纹差异导致退出 1。题本页面合同检查已通过 |
| `npm audit --omit=dev --audit-level=high` | 存量 23 项，其中 high 8。依赖文件无改动 |

初次尝试用旧的文件夹测试脚本准备资料时，题册 AI 模拟响应与当前协议不符。该次失败报告原样保留。答案册两遍回执已保存，专项从独立运行目录读取这些回执并测试结构题路径。第一次专项因脚本操作了展开前的筛选框超时。修正脚本后，通过可见入口完成验收。后续使用先前已成功完成整套文件夹流程的独立排印样本，补测最终构建重匹配与冷读。

## 剩余与停用

优先修复真实双栏试题串栏，并用不同出版社的自然样本验证。当前题册侧重号检测覆盖题目所在页和前方回看范围，整卷后续页中的同标题重号与不同版本同名试卷需独立验证。结构题还需接入后台配答，处理答案晚到和重启恢复。真实模型质量、检索留出、约 10 GB、正式组卷和安装迁移仍按目标总体验收。

可设 `OMNI_EDU_BOOK_ANSWER_WRITEBACK=0` 停止新的答案册写回，同时继续读取历史凭据。停用前后的原件和索引格式相同。需要降级旧二进制时，应先使用升级前的 SQLite 备份，旧版本无法解析已写入的新结构题配答凭据。
