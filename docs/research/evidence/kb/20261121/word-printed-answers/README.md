# Word 同册连续排印选择题答案

## 根因和修改

旧版已识别参考答案区，但原生配答器只接受含题号和答案两行的表格。真实 Word 的排印答案位于同一段落，有些相邻条目之间没有空格，答案段落因此未进入单题来源。

- `word-booklet.ts` 识别显式选择题答案小节内的排印条目，按原始 UTF-16 范围提取每题的字母。检查题册小节、唯一题号和连续选项。若同一题同时有答案表格及排印答案，或重复条目出现分歧，则保留待核。带解析尾注的重复条目也会阻止误配。
- `word-question-source.ts` 把原文答案范围交给已有按题预览、生成本地证明和后续 AI 入参。题干选区、段落与媒体文件沿用已有版本。
- `material-word.ts`、`material-word-repository.ts` 和 `word-upgrade-compatible.ts` 新增 v6 及对应的 SQLite 部分索引。后台准备可直接升级媒体策略当前的 v5 文档，避免重新提取 Word 媒体。升级在既有事务中保留旧文档和摘要，校验原件及题目计划。
- `material-ai-native.ts` 延续旧版按冻结文档复核已存回执，接受已有 v5 证明和符合条件的 v6 来源。

## 真实资料前后对比

使用既有 221 份资料的隔离副本，选择 2022 年上海中考数学 Word。当前数据仍是这一轮之前的目录状态，5 份部分完成、1 份已交接、215 份等待。

| 对象 | v5 | v6 |
| --- | --- | --- |
| 原文题目数 | 25 | 25 |
| 配有同册原印答案的选择题 | 0 | 6 |
| 这 6 道题的答案位置 | 无单题范围 | 同一原文段落，分别对应单字母范围 |
| 本轮新进正式选题库 | 0 | 0 |

通过资料页“重新整理 Word 图文”运行，核对各题的字母、题号、单题原字符和选题范围，按题预览显示答案及原文件来源。应用重启后仍能读取。原 DOCX 内容哈希、解析块、媒体、旧版本文档和现存 AI 记录保留。此次未新增模型调用。带图填空答案保留原文，仍需单独归属。六道选择题的共用题前内容疑点仍在。

在同一隔离 SQLite 上，以只读方式重放 148 份已有 v5 或 v6 文档，共 4,222 道原文题。v5 和 v6 的题序、题干来源范围逐份一致。重放新增可定位的排印答案共 6 条，均仍有题前共同内容疑点。此次重放未修改该资料库。

同一份 Word 的 2 条旧原生 AI 单元分别处于失败和待核。按各自冻结的历史文档摘要重建题源，2 条均匹配原有题源摘要。旧状态与回执继续保留。

## 验证

在 `apps/desktop` 运行以下命令。最终主进程 SHA-256 为 `07283ad29c99ee54eab45bb94e9d9486fc918b368e7740a1989016c09008e32d2d`。

- `npm run build -- --outDir test-results/build-kb-word-printed-answer-ready` 通过。
- `npm run test:renderer-components`，253/253。
- `node --experimental-transform-types scripts/education/kb-word-booklet-boundaries.mjs`，14/14。
- `node --experimental-transform-types scripts/education/kb-word-background-upgrade.mjs`，9/9。
- `node --experimental-transform-types scripts/education/kb-folder-word-upgrade.mjs`，13/13。
- `node --experimental-transform-types scripts/education/kb-word-preamble.mjs`，10/10。
- `node --experimental-transform-types scripts/education/kb-word-printed-answer-electron.mjs <既有的隔离目录>`。用 `--verify-existing` 复查已保存的同一副本及最终构建。
- `node scripts/electron-smoke.mjs`，以最终构建和独立测试目录运行，207 项前端检查通过。
- `npm audit --omit=dev --audit-level=high`，依赖审计仍有 20 项，其中高危 5 项，本次无依赖改动。

## 回滚和未完成项

若回滚到仅支持 v5 的应用，已升级文档需由备份或保留的 v5 表项恢复为当前表示，再启动旧应用。原件与旧题源未删除。当前构建可同时读取 v5 和 v6。

此次将同册原印答案接入本地题源。6 条结果仍需题面核验，未自动进入正式检索或组卷。历史独立答案册还需角色分代，独立检索、三套正式卷、约 10 GB 混合导入和跨机迁移继续按原合同验收。

后续可优先修复已定位的共用题前内容疑点。此卷首段含标题和 25×20 像素的近白图，读取本地图像后测得全部 RGB 通道在 254～255 间。当前把含图首段整体归入共用内容，下一段的“本大题共 6 题、每题 4 分、满分 24 分”也未通过现有行政文字分类。两处都在第一题的共用来源范围。恢复时应分别核对图像像素与完整计分提示，保留原图、定位和真实物理常数等共用条件。
