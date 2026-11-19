# 跨页图形选项的逐项归档

## 根因

默认导入的上一页末题只扫描它已有题文的页面。页首四幅图及其字母属于版面图形和图注，普通选项解析没有把它们合成一组选项。题目因此只带走第 2 页装置图，第 3 页的真实 A–D 缺失。现有 AI 续页逻辑已经能判定末题是否缺选项，文字选项接续要求每项存在可逐字核对的选项正文，图注和图像不满足这一条件。

## 修改

- 复用原有末题识别。按下一父题位置截取候选范围，只在连续页、同栏、连续题号、上一题显式询问图形且缺选项时查找。按原图字母与对应图框的位置逐一配对，检查图的空间顺序和字母顺序。重复、颠倒、缺标签及超出边界的图组保持待核。置信度偏低或字母标点缺失但能给出唯一映射时，展示两页候选供教师核对。
- 保留原图区域、图注原文和 OCR 行来源，题库把 A–D 写入现有 `choices` 文档块，每项一张包含原印刷字母的独立裁图。上一页本题的装置图继续单独保存。题本图库及组卷原图读取使用原 IPC，可按字母标注图像。每个文件仍由原件和裁图哈希认证。
- 结构引擎 v5 支持已发布历史结构读回和 v2–v4 冻结 AI 回执。老版中断任务使用新结构代，SQLite 表、Worker 及依赖沿用现状。若需要回退，撤回本轮代码并通过兼容版本按需重建 v5 派生记录，保留原件和已核对题目。

## 修改前后和性能

真实自然试卷第 13 题从 1 页、0 个可辨选项，恢复到 2 页、4 个独立原图选项；第 2 页装置图保留，第 14 题仍使用独立来源。真实原页的字母 OCR 部分缺印刷标点并且置信度偏低，经教师对照后才保存。两页 PDF 的全文冲突仍保留在原始回执。

复用 4 份真实 PDF 共 22 页已保存版面，60 次预热后 v4、v5 配对各执行 100 次，均恢复 64 道结构候选。22 页内存装配 P50 由 1.102 增至 1.202 毫秒，P95 由 1.521 增至 1.814 毫秒。识别、裁图和入库耗时另计。依赖审计 29 项存量问题，high 8、critical 0。

## 验证

工作目录为 `apps/desktop`。构建标识、样本 SHA-256 和测试范围见 [结果](summary.json)，修改路径和 Git 内容哈希见 [修改清单](MANIFEST.json)。

| 命令 | 结果 |
| --- | --- |
| `node scripts/education/kb-pdf-printed-body-journey.mjs <1GB试导库 data> <识别快照 data>` | 8/8，四份真实 PDF 经默认目录导入，选项逐一绑定、两页核对保存，重启后题本逐项显示 A–D 原裁图并核对哈希 |
| `node --experimental-transform-types scripts/education/document-structure-boundaries.mjs` | 32/32，覆盖横排、两行图组、缺失/重复/乱序字母、前后题隔离 |
| `node scripts/education/document-structure-repository.mjs` | 39/39，含 v2、v3、v4 保留及换代 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/ai-structure-source-boundaries.mjs` | 16/16，含旧代冻结来源鉴真 |
| `npm run build -- --outDir <冻结构建>` | TypeScript 与 Electron 构建通过 |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/electron-smoke.mjs`，指向同一冻结构建 | 207/207，退出码 0 |
| `npm run test:ui-contracts` | 主线既存 HeroUI Pro 指纹差异，在 prompt-input/index.ts 停止 |

## 后续

真实样本的四个选项经过教师核对，合成样本覆盖证据齐全时进入自动规则候选。跨双栏、页首图无可读编号和部分选项被扫描截掉的情形继续待核。此次保留 v1 题目文档，已核对档案也可能因为缺完整文字投影而进不了答案补全和向量检索。已用另一份真实资料复现该断点，下一轮优先将可完整转录的已核对原题接入既有答案证据和小智搜索，保留图义未明的题的原件和待核状态。自然留出检索、真实 DeepSeek 题答、正式组卷、约 10 GB 与换机迁移继续按 KB-A01～A10 验收。
