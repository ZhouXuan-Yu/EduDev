# 多栏试卷阅读顺序与题目归属

本轮对应 M03。修复教师导入多栏资料后，另一栏的选项或评分表被拼到当前题目的问题。

## 根因

PDFium、RapidOCR 和版面模型已保留原文字框和坐标。五三主书原件第 4 页共有三组正文，起始横坐标约为 0.07、0.37 和 0.68。旧段落恢复只接受两栏，并在五条固定候选线中取第一条合格线。在 0.40 处分栏时，中栏与右栏被一并按页面高度读取。第 7 题的四条选项因此串入第 12 题，某个选项和右栏正文还被拼成同一个段落。

## 修改

- `material-document-structure.ts` 从连续正文的水平空白、邻栏纵向重叠和跨线文字数量选择栏间分隔。同一带内依次读完各栏，选项仅参与切线校验。原始行的文字、顺序和坐标继续保留。
- 段落恢复同时处理短文本并列、跨栏合并框和换栏首表。短框无法可靠分栏时传递待核标记。归属不明的表格保留文字和位置，受影响的相邻题待核。具有题序、得分及阅卷标识的页顶评分表单独留在原页。
- `material-document-structure.ts` 对应的共享协议引擎升级到 v6。已完成的 v2～v5 文档与凭据沿原入口读取。后台重试使用当前引擎，已完成的旧资料由教师显式重建。
- `document-structure-boundaries.mjs`、`document-structure-repository.mjs`、`document-structure-electron.mjs` 、`document-structure-gutter-readback.mjs` 和 `native-real-pdf-electron.mjs` 补充多栏、异常归属、旧版本、冻结运行目录和自然样本逐题回读。

## 修改前后

| 样本 | 旧版 | v6 |
| --- | --- | --- |
| 五三主书第 4 页 | 2 栏，切线 0.40，中栏选项串入右栏 | 3 栏，切线约 0.365、0.67。第 7 题保留 4 个选项，第 12 题仅有右栏正文、0 个选项及 1 个图，第 4 题题干排除了页顶评分表 |
| College Board SAT 练习第 27 页 | 2 栏，切线 0.50 | 2 栏，切线约 0.525。逐栏顺序与原页一致，候选仍等待题号与内容核对 |
| 上海初中数学试卷第 3 页 | 1 栏，含并排图 | 1 栏，保持单栏正文，不把并排图识别为两栏 |

用 PDFium 提取三份原 PDF 的指定页，逐像素核对摘页与原页一致。原材料、题面和截图只在本地隔离目录。SAT 样本来自 [College Board 公开练习卷](https://satsuite.collegeboard.org/media/pdf/sat-practice-test-5-digital.pdf)。

对同一冻结 OCR 及版面输入预热后交替执行 v5 和 v6 各 160 次。五三页单次纯结构恢复 P95 为 1.150 → 1.187 ms，SAT 页 0.457 → 0.578 ms，上海数学页 0.150 → 0.150 ms。计时不含 OCR、磁盘和桌面操作。

## 测试

- `npm run build -- --outDir test-results/build-structure-columns-merged` 通过类型检查和桌面构建。
- `node --experimental-transform-types scripts/education/document-structure-boundaries.mjs` 36/36，含同页三栏、短框、合并框、未明首表以及原始行覆盖。
- `node --experimental-transform-types scripts/education/document-structure-repository.mjs` 39/39，含 v2～v5 旧批次读回、显式重建、任务恢复和取消。
- `node --experimental-transform-types scripts/education/kb-structure-book-boundaries.mjs` 结构配答 8/8，旧匹配 36/36。
- `npm run test:renderer-components` 253/253。
- 将三个摘页路径写入 `EDU_STRUCTURE_FILES`，以隔离根 `EDU_STRUCTURE_TEST_ROOT` 和本轮 `OMNI_EDU_TEST_BUILD_ROOT` 运行 `node scripts/education/document-structure-electron.mjs`，5/5，含导入、186 条五三 OCR 行完整覆盖、两种窗口尺寸和冷启读回。再运行 `node scripts/education/document-structure-gutter-readback.mjs` 核对三个样本的栏位和第 4、7、12 题。
- 从上一轮自有测试库用桌面“重建结构”将五三试题升级到 v6。新批次识别三栏，旧 v5 页面摘要及答案册两遍回执保持一致。旧未确认候选仍留历史，两代第 12 题的数据库记录共存。
- `npm audit --omit=dev --audit-level=high` 检出 23 项存量问题，其中 high 8。依赖文件无改动。

## 剩余与回滚

五三页第 10 题的父题号缺失，第 9 题合并了两组选项且已待核。第 12 题的印刷填空位置还需恢复，候选未由教师确认。SAT 的分栏已复验，独立框式题号和选项样式仍需验证。第 10 题疑似漏读的标题行位于版面文字区上沿与第一条识别行之间，适合复用本地裁图 OCR 核对。第 12 题两处原页留空对应同行独立 OCR 框之间的水平间距。继续验证这些结构边界。重建后还需明确旧未核对候选的默认查找与选题状态，再沿原目标推进后台配答、检索、组卷、规模及本地迁移。

数据格式和原文件目录保持兼容。旧解析批次可按原凭据读回。若需退回旧程序版本，使用升级前备份，确保旧程序能识别当前批次的引擎版本。重建只生成派生结构，保留已确认题目及来源轨迹。
