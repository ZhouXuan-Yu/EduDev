# 普通正文跨页续接

## 根因与修改

真实上海高中物理试卷第 4 页第 25 题的最后一行停在“电压”，第 5 页从“表和电流表”继续，随后列出两问。原规则只识别以选项或小问编号开头的续页。该 PDF 的原生文字还把页码排在页首，并把图中短标签排在前页正文之后。使用原文首行或末行直接决定归属，无法识别这个题干接缝。

新协议 `page-continuation.sentence.v1` 用 PDF 选定页文字和 RapidOCR/PP-DocLayout 的正文块共同定位接缝。页码只有在相邻两个页回执及页码版面块都与实际页序相符时才能在定位中跳过。前页题干须未闭合，后页须续完该句并有连续小问，随后开始递增的下一父题。邻近且归属明确的前页题图单独保存。不明正文、独立公式和重叠的下一题仍保留待核。

`material-ai-continuation.ts` 冻结两页范围和前页正文及题图的所有权，进入复核和冷读时沿原授权重新验证。`material-ai-literal.ts` 用两份原图的字面内容恢复单一题干，并保留两边来源。`material-ai-source-reading.ts` 和 `material-ai-page-fragments.ts` 同时校验字面读取。打印下标在原图转录和题文中保留。对照时允许双遍原图归还文本提取扁平化的单字母变量下标，已有下标、数值、单位和运算符的改动继续被拦截。两份原图转录和原 OCR 分开保留。

## 修改前后与性能

基线未为第 25 题规划续页。修复后登记前页正文、电路图和后页第 26 题之前的三块续文，实际得到三个原件裁图。第 25 题图仍在第 4 页，第 26 题文字及图保持独立。重新生成版面回执后，分别运行 100 次规划，基线拒绝路径 P95 为 0.062 ms，新增规划为 0.502 ms。两次对照中的另一次新增规划 P95 为 2.535 ms。计时只衡量本地规划，图片渲染、OCR 和模型处理另计。用现有已解析的 245 个续页粗筛，仅有本例进入新规划。无新增依赖。依赖审计报告存量 29 项，其中 high 8、critical 0。

## 验证

命令工作目录为 `apps/desktop`。

| 命令或范围 | 结果 |
| --- | --- |
| `node scripts/education/kb-choice-tail-electron.mjs <已解析资料库> --sentence-seam --layout-only` | 从原 PDF 本地生成两页真实版面回执，记录 `OUTPUT` 目录 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-sentence-seam-boundaries.mjs <版面实测目录> <桌面测试目录>` | 6/6，包括真实 PDFium、RapidOCR、PP-DocLayout 和错误页码、封闭句子、漏判条件、图块所有权及下标与数值反例 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-figures-boundaries.mjs` | 跨页独立图 10/10，通用跨页 12/12，AI 页面 248/248 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-text-boundaries.mjs` | 续页文字与印刷填空线 10/10 |
| `npm run test:renderer-components` | 253/253 |
| `npm run build` | TypeScript 和桌面构建通过 |
| `node scripts/electron-smoke.mjs` | 同一交付构建通过 207/207，退出码 0 |
| `node scripts/education/kb-choice-tail-electron.mjs <已解析资料库> --sentence-seam` | 真实 PDF 桌面 3/3。第 25 题 `ai_final`，冷读校验两页原图，教师题本可用跨页短语找到题并打开前页电路图 |
| 同一桌面脚本使用 `--first-subquestion` | 旧首小问模式 2/2，原题图和来源冷读通过 |

题本测试使用 6 次受控模型响应，云端请求和渲染错误均为 0。第 5 页的第 26 题不在本次目标题的受控回复内，仍以原遗漏检查进入待核。第一次试跑录下真实裁图，随后因测试替身为三个续文块误预期三个独立裁图而停下。正式试跑按现有质量链路实际生成的同页续文裁图验证，保留首次日志。

## 仍待处理及回退

本轮证据来自带连续小问、可在同一列对齐的真实中文样本。无连续编号、不同栏顺序与更复杂的页首正文仍待各类自然页证明。多来源题文质量、检索、组卷、约 10 GB 导入和移植继续按 KB-A01～A10 验收。

将 `OMNI_EDU_AI_CONTINUATION_SENTENCE=0` 后重启可暂停新发现。已有任务继续按冻结协议核对，SQLite 表和回执结构延续既有存储。

修改路径和 Git 内容哈希见 [文件清单](MANIFEST.json)，构建和验证数据见 [结果摘要](summary.json)。
