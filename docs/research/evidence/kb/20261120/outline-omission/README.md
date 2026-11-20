# 课程提纲误报漏题

## 根因

PDFium 页图与 RapidOCR 结果进入 PP-DocLayoutV3 分块及页级定稿任务。发布前，确定性抽题器把页级终稿中带「计算」「判断」「比较」等提示词的数字编号段落作题目候选。在课程指南中，这些词用于描述能力要求。AI 的题目数组为空时，候选被当成漏题，任务进入 `ai_omitted_questions`。

## 修改文件

- `material-ai-page-content.ts` 核对本地分块 OCR 和转写。要求出现课程目标类标题、至少三个不同的分级编号，且整数编号标题后紧随同编号子项。遇到习题、选项、作答空位、问句、独立编号、本地未归属结构或 OCR 待核证据时，继续用原有规则判断。
- `material-ai-page-publish.ts` 在页级发布时单独判断题目完整性与转写一致性。排除漏题的范围限于所有有效转写同时确认的无题提纲。
- `material-ai-repository.ts` 冷读时使用持久化首稿、有效校对稿和终稿。旧记录的待核状态继续由既存回执约束。
- `kb-ai-page-boundaries.mjs` 增加持久任务和反例测试。`kb-page-omission-readback.mjs` 用只读 SQLite 和生产回执读取器复核真实页。

## 修改前后

对约 1 GB 试导库十个使用 `page-fragments.v3` 的漏题页重新计算。使用生产回执读取器核验页图与转写摘要，模型调用为 0。

| 真样本 | 旧判定 | 新计算结果 |
| --- | --- | --- |
| 上海初中数学课程终结性评价指南第 1 页 | 把编号 1、3 误认为漏题 | 排除误报，新建同证据任务可按无题页完结 |
| 上海初中物理课程终结性评价指南第 1 页 | 把编号 2、3 误认为漏题 | 排除误报，因校对稿与终稿分歧而继续待核 |
| 上海初中数学课程终结性评价指南第 2 页 | 表格与编号段误报 | 尚未满足父子编号条件，继续待核 |
| U16 习题课第 2 页 | 第 5 题缺失 | 继续拦截。页级转写有题干，终稿题目数组只有第 6 题 |
| 其余 6 张物理讲义页 | 漏题待核 | 仍保留待核，含课堂讨论和 OCR 存疑等情况 |

十条历史状态保持待核。受控任务检验新建任务会将确定的提纲写为 `no_questions`，重开后仍保留整页 OCR 和转写，题库新增条目为 0。页面判定微基准以这十页每个版本计算 1,200 次。P95 约 0.698 ms 与 0.712 ms，范围仅含内存中的页面判定。

## 测试报告

- `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` 通过 253/253。覆盖无题持久任务重开、OCR 不完整、首稿有题、混合页和有文字分歧的提纲。
- `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-folder-pdf-publication-boundaries.mjs` 通过 24/24。
- `npm run test:renderer-components` 通过 253/253。
- `node --experimental-transform-types scripts/education/kb-page-omission-readback.mjs <已有试导库数据根>` 核验 10/10 份已保存回执。历史试导库未修改。
- `npm audit --omit=dev --audit-level=high --json` 报告 23 项依赖通告，其中 8 项 high。本轮无依赖变更。
- `npm run build -- --outDir test-results/build-kb-outline-final` 通过。 合并协作者 `1c85784` 后，`npm run build -- --outDir test-results/build-kb-outline-integrated` 通过。
- Electron 全量冒烟首轮在首次建窗超时，Windows 清理临时目录时提示占用。以 `97d4f2d` 为基线、包含本轮修复的最终构建，设置 `OMNI_EDU_TEST_BUILD_ROOT=test-results/build-kb-outline-final` 后执行 `node scripts/electron-smoke.mjs`，隔离复跑 207/207。

## 未完成与回滚

U16 第 5 题的题干可以定位到本地 OCR 分块 `block-1`。该分块漏掉题号，且文字与终稿中的完整题干有差异。相邻公式分散在其他分块。首稿与终稿都只有第 6 题的结构化分块引用（`block-5`、`block-6`）。下一步应以原图和行框复核题号及公式归属，再补齐候选并沿用现有裁图与归档门禁。六张讲义和一张含表格课程指南继续待核。另有 132 条未复核的旧版漏题记录，未冻结同版式回执。独立自然题质量、三套正式整卷、约 10 GB、检索指标与换机安装验证继续主线。没有 SQLite 迁移，须回滚时可使用 `git revert`。

## 验收结论

两页课程指南的编号误报已修复。真实漏题和校对分歧继续拦截。当前证据覆盖课纲误报，知识库整体仍在验收中。
