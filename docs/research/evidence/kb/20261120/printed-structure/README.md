# 漏读题号与印刷填空恢复

## 根因与修复

五三物理主书原件第 4 页的第 10 题开头位于版面文本块上沿。整页 RapidOCR 没有读到这一行，结构恢复沿用第 9 题的编号，吞进第 10 题正文、配图和第二组 A～D 选项。第 12 题的两条细填空线位于同一行的两个 OCR 框之间，原来的段落拼接没有字形可用。

结构恢复 v7 在同栏出现两套完整选项、前后编号只空一位、且版面文字区存在独立空带时，利用现有本地 RapidOCR 对原图局部复识。实际读到符合上下文的题号才分题。原始裁片位置、图像摘要、局部识别文字及引擎版本随页面保存。裁片仍有短文字未确定归属时，使用独立的待核状态，即使选项齐全也不会解除。AI 结构程序同样可以读到未解决状态。

已识别为填空题的段落只有在同一区域相邻文字框之间、靠近字底发现细且连续的印刷线时，才在派生题干补下划线。原始 OCR 字符、坐标和来源不变。处于字高中央的减号、两组数字间的横线和普通空白不满足规则。

## 修改前后

| 检查点 | v6 | v7 |
| --- | --- | --- |
| 五三物理第 9、10 题 | 第 9 题含 8 条选项及第 10 题配图，缺第 10 题 | 两题各 4 条选项，第 10 题拥有原配图。其裁片文字仍待核对 |
| 五三物理第 12 题 | 转写缺失两处填空 | 转写保留两处印刷填空坐标及原配图 |
| 原始 OCR | 五三页 186 条原始文字框 | 186 条原始文字框的文字、四边形和覆盖完整性不变 |
| 其他版式 | 已验证 SAT 双栏、上海数学图文单栏 | 在同一真实摘页复验栏序，SAT 题号及题目仍保留待核状态 |

同一组摘页的后台处理时长分别为 v6 43.886 秒和 v7 38.840 秒，各取一次的墙钟读数，包含并行调度和 OCR。当前读数只用于记录环境，无加速结论。

## 代码与验证入口

- `material-printed-structure.ts` 提供裁片选择、局部 OCR 判定和填空线像素检测。`material-structure-runtime.ts` 将这些判定接入默认后台任务。
- `material-document-structure.ts`（共享与主进程）记录候选出处、区分派生段落与原始行，并控制待核；`material-structure-identity.ts` 仅以真正的原 OCR 行建立物理来源指纹。
- `material-ai-structure-source.ts` 将未确认的裁片传递给 AI 结构门禁。`MaterialStructurePanel.tsx` 显示恢复数量和待核原因。
- `document-structure-boundaries.mjs` 39/39，含归属不清且选项齐全、原文无改写、减号和填空区分。`document-structure-repository.mjs` 39/39，含 v2～v6 读取、重试与重建。`ai-structure-source-boundaries.mjs` 17/17，含裁片疑点传递及 AI 不自动核验。`kb-structure-book-boundaries.mjs` 8/8。
- `npm run build -- --outDir test-results/build-printed-structure-release` 通过。`npm run test:renderer-components` 253/253。
- 三份真实 PDF 摘页由 PDFium 从原材料提取，摘页与原页逐像素核对。将其路径传给 `EDU_STRUCTURE_FILES`，设置 `EDU_STRUCTURE_REQUIRE_PRINTED=1`、隔离的 `EDU_STRUCTURE_TEST_ROOT` 与冻结的 `OMNI_EDU_TEST_BUILD_ROOT` 后运行 `node scripts/education/document-structure-electron.mjs` 与 `node scripts/education/document-structure-gutter-readback.mjs`。
- 冻结构建真实桌面流程 5/5，含后台入库、原文覆盖、题目准入、两种窗口尺寸和冷启动读回。逐题回读确认第 10 题留在待核队列且无正式题库行。早期真实回读曾发现其被通用选项校验误放行，最后修复版通过。
- 用该冻结目录运行 `node scripts/electron-smoke.mjs`，桌面回归 207/207。整合协作者独立的审批焦点提交后，`npm run build -- --outDir test-results/build-printed-structure-integrated` 再次通过。
- 用自有旧测试库副本从桌面点击“重建结构”，v6 → v7 后旧结构页和既有答案册回执逐值不变。新版候选的第 12 题有两处填空。旧题库中两代未核草稿仍保留，后续需治理默认可见范围。
- `npm audit --omit=dev --audit-level=high` 检出 23 项存量通告，含 8 项 high，本轮依赖文件无变更。

## 尚未解决与回滚

本轮覆盖缺一个父题号且前后有各自选项组的版式，以及同行文字框间的细印刷填空线。无邻近编号、整行漏读、绘图虚线、手写留空及非常浅的扫描线仍需补样。复杂公式、表格和图文混排沿用现有人工核对机制。

历史结构仍可读。重建会创建新的结构代际。独立复查从真实副本的默认候选查询读回第 12 题的两条旧草稿。当前两条都缺填空，正式选题和配答门禁都不接纳。新候选的物理来源查重仍返回 v6 的未核草稿，归档队列因此跳过新版。下一轮必须一并更正新版交接和旧草稿默认可见性，保护教师已确认题、旧试卷及历史凭据。可回退应用代码，需退回只能识别旧引擎的版本时应同时使用升级前数据备份。

本轮所列样本和专项门禁通过。题库整轮目标仍进行中，约 10 GB 自然规模、实际检索质量及正式组卷需要继续验收。
