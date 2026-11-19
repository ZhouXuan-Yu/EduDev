# 跨页正文与相邻题图归属

## 根因与修改

一份真实光学练习的第 5 页末尾，第 5 题在“平面镜 MN 竖直”处断页。第 6 页依次排了属于第 4 题的图 10、第 5 题的余下正文、图 11 和第 6 题。旧正文续页规则依靠页首接续正文和连续小问，遇到先排前题插图的情况无法确定归属。直接截取到下一题之前会把图 10 也带入第 5 题。

新版回执 `page-continuation.caption-seam.v1` 在原页和版面里分别核对连续的三个父题、上一题和本题各自唯一引用的图号、图注位置、待续题干与下一父题边界。规划结果只包含第 5 页题干和第 6 页的正文、图 11、图注。真实 PDF 共 8 页，印刷页脚声称共 7 页。真实页序由原件回执校验，印刷页脚只在与页底页码版面块对应时从题干边界排除。

整页 OCR 将图内标记误拼为 `4+P`，独立裁图 OCR 读出分开的 `4`、`P`。图注字面值、独立图内读数及两遍原图转录分别校验，完整原始 OCR 和裁图均保留。局部 OCR 的单独 `0` 只在有来源题文中的命名坐标轴、两轴标签及紧跟的递增横轴刻度等证据时允许由两遍转录还原为 `O`。其他坐标、刻度和内容必须对应原文。当前原点规则使用刻度与识别顺序，未直接定位像素上的轴交点。

独立复核还复现了两个模型输出同时添加相同错误图义时通过旧前缀校验的路径。新协议的图文投影只取已核对的独立裁图转录。原图、版面坐标和文字来源继续随题保存。

## 修改前后与性能

原协议在真实第 5 题未生成补图计划。新协议绑定一份前页正文裁图和三份续页裁图，并排除上一个题图和下一个父题。最终 100 次测量的文本预筛 P95 为 0.0143 ms，局部规划 P95 为 0.3183 ms。计时范围是本地计算，渲染、OCR 处理和模型耗时另计。本轮复用 PDFium、RapidOCR、PP-DocLayout、原有资料队列和题库结构，无新增引擎或依赖。依赖审计仍有 29 项，其中 high 8、critical 0。

## 验证

命令工作目录为 `apps/desktop`。证据范围和构建身份见 [结果摘要](summary.json)，修改路径见 [文件清单](MANIFEST.json)。

| 命令 | 结果 |
| --- | --- |
| `node scripts/education/kb-choice-tail-electron.mjs <已解析资料库> --caption-seam --layout-only` | 从原 PDF 生成两页实际版面和 OCR 回执 |
| `node scripts/education/kb-choice-tail-electron.mjs <已解析资料库> --caption-seam` | 真实 PDF 的受控桌面路径 3/3。第 5 题自动定稿，两页来源冷读，题本通过跨页短语找题并打开图 11 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-caption-seam-boundaries.mjs <版面回执目录> <桌面测试目录>` | 9/9，覆盖归属、版面矛盾、隐失条件、图号和刻度、错误原点与未证实图义 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-figures-boundaries.mjs` | 独立题图 10/10，通用跨页 12/12，AI 页 248/248 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-text-boundaries.mjs` | 印刷空格线和续页文字 10/10 |
| `npm run build` 与 `npm run test:renderer-components` | 构建和 TypeScript 通过，组件 253/253 |
| `node scripts/electron-smoke.mjs` | 同一交付构建 207/207，进程退出码 0 |

桌面专项使用 6 次受控模型响应，真实模型调用和渲染错误均为 0。测试先用旧构建揭示该用例未接续，第一份新归属回执又暴露图内 OCR 分歧，保持待核。最终构建使用独立图内裁图 OCR 检查两个原图转录，并阻止图投影附加未核对文字。

## 仍待处理及回退

本轮覆盖同列、可明确辨认两个独立编号图注的续页。相邻题照片没有图号、图题分散在双栏、多个题共享同一图、图片或复杂公式符号无法对应时，继续沿原路径隔离待核。图 10 和第 6 题的独立定稿不在本轮受控题范围。多出版来源、真实模型的自然题质量、留出检索、组卷、约 10 GB 和安装迁移继续按 KB-A01～A10 验收。

本地已积累的约 1 GB 试导库快照有 565 个 PDF 待核页，其中 558 个为 PDF 原生层与 OCR 文字冲突，分布在 63 个解析任务。对照当前 PDF Worker 的核对条件，167 页只触发文字覆盖门槛，305 页同时触发文字和符号门槛，86 页只触发符号门槛。86 页里有 10 页在保留空白后的符号计数中解除，仍需逐块对照原图确认。这个快照包含历史运行，数目用于确定下一轮优先级。下一轮从跨来源待核页取样，区分阅读顺序、OCR 缺字和实质内容冲突，优先修复批量出现的问题。

设置 `OMNI_EDU_AI_CONTINUATION_CAPTION_SEAM=0` 并重启可暂停新任务发现。已有回执沿冻结协议冷读。无需改变 SQLite 表或重新上传资料。
