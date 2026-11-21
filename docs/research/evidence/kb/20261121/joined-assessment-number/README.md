# 恢复与正文数字连写的印刷题号

## 根因与修改

真实 PDF 的 OCR 把印刷的「9. 4…」连写为「9.4…」。原切题规则为保护小数，会拒绝句点后紧跟数字的题首，因此整行续到上一道题。PDF 原生文字的同位置保留了数字之间的空格，且附近的已识别题号和独立排版区域能验证归属。

v17 仅在可信版面中检查缺一个题号的范围。原生 PDF 字符须能认证为同一文件、版次和页图，行位置及正文前缀需吻合。原生字符项中的印刷空格或明确的同排字符间隔可作为证据。原生读数冲突、候选重复、跨栏或跨大题时保留待核。只剥离一次已确认题号，原文、行框和正文小数保持。

| 文件 | 改动 |
| --- | --- |
| `main/assets/material-structure-numbering.ts` | 以原生文字、字面前缀、同行框、独立正文区及邻题校对连写 |
| `main/assets/material-document-structure.ts` | 段落生成前采用通过核验的题号，统一剥离入口 |
| `shared/material-document-structure.ts` | 版本升至 v17，旧结构继续可读 |
| `scripts/education/document-structure-boundaries.mjs`、`kb-batch-structure-boundaries.mjs` | 覆盖全半角数字、拆分的原生文字块、小数、重复、错位、来源版本及批量升级 |
| `scripts/education/kb-column-structure-readback.mjs`、`kb-wrapped-heading-electron.mjs` | 对照真实资料封存结果和桌面实际导入 |

独立审查复现了题号被两处规则剥离、正文以相同数字开头的小数丢失的问题。最终保留一个剥离入口，回归确认原印「2. 2.5…」会留下「2.5…」，独立正文以小数开头也保持原样。

## 真实资料前后对比

同一上海高考数学试卷 4 页的封存原始 OCR 和 PDF 原生文字分别按 v16、v17 运行。已拆出的题由 20 组增至 21 组。第 9 题独立，题干起始的正文数字保留。第 8 题只移走属于第 9 题的内容，其余 19 组题干、各页原文、原行框、栏位和页级疑点逐项一致。

相同输入交替运行 9 轮，每轮各回放 100 次。4 页段落和试题恢复的中位用时从 1.127 毫秒到 1.605 毫秒，范围仅为本地结构计算。

## 测试记录

| 检查 | 结果 |
| --- | --- |
| `npm run build -- --outDir <测试构建目录>` | 合并协作主线后，TypeScript 及 Electron 构建通过 |
| `npm run test:renderer-components` | 253／253 通过 |
| `document-structure-boundaries.mjs`、结构仓库/解析队列回归、`kb-batch-structure-boundaries.mjs` | 56＋40＋14 项通过 |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-column-structure-readback.mjs <原有样本运行目录>` | 4 页、21 组、9 个布局候选及 4 个页脚核对通过 |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-wrapped-heading-electron.mjs <试卷> --joined-number [--readback <本轮运行目录>]` | Electron 文件夹入口导入，SQLite 保存 4 页、21 组且全部待核对。先导入后复用同一运行目录，在 1366×768 和 1920×1080 核对第 9 题的正文、原图、冷启动后世代及原始 PDF 摘要。0 个外部请求，0 个渲染错误 |
| 全量 Electron smoke | 本轮剩余盘空间触发新导入保护，留待后续运行 |
| `npm audit --json` | 既有清单 27 项，其中 6 项高危、0 项严重，依赖锁文件无改动 |

Electron 构建 SHA-256 为 `68441fabab61f50f144faa30faaa08271762cb7e535fae0009ea4863d124258b`。首次导入完成后，测试因界面使用单页范围 `1–1` 而匹配失败。修正选择器后，冷启动读取了同一批次，确认第 9 题界面显示「暂缓入库」并保留 `pdf_text_conflict`。从零重复导入时磁盘余量低于产品预留阈值，保留原始日志。

## 兼容与剩余工作

新导入及手动或批量重建使用 v17。SQLite 表和原始文件未迁移，旧结构世代仍可查阅。回退时先保留历史结构，已生成的 v17 回执应由支持该版本的程序读取。缺原生文字的扫描、证据冲突、跨题号范围和其他真实版式维持原核对规则。独立答案册、自然题可用覆盖、检索、三套正式卷、约 10 GB 导入与换机仍按 KB-A01～A10 验收。
