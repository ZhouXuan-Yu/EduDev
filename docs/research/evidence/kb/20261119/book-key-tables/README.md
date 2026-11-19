# 答案册速查表结构恢复

## 根因与改动

独立答案册已由页面任务保存两遍转录。旧版只把逐题编号行当成答案条目，题号横排一行、答案平行一行时没有条目可供查找。相邻速查标题还可能进入上一个详解的范围。故障位于原始页面转录与答案条目投影之间。

新任务保存解析策略 `answer-entry-topology.v3`。主进程在当前试卷标题范围内识别双行表，检查连续题号和列数，逐题比较两遍结果。支持空格、制表符和全角字符，原文和字符偏移保持。重复条目、两遍不同或列数不符会保留原页和待核；确认无歧义的同卷详细条目优先。写回经过现有题面、资料版本、试卷标题、冲突和权限校验。只写入证实的字段，保留既有解析和教师确认记录。

## 修改前后

| 输入 | 之前 | 本轮 |
| --- | --- | --- |
| 等长双行题号/字母列，原页有明确卷名 | 无逐题答案 | 逐列恢复原文出处，两遍一致方可匹配 |
| 真实答案册中等长速查与详解并存 | 22 条详细记录 | 22 条相同详细记录，无重复 |
| 真实答案册的另一表有 10 个题号、9 个答案 | 未明确标记短表 | 整表留待核，详细条目继续独立校验 |
| 答案来自同卷速查表，但表无解析 | 无从关联 | 写回出处可查的答案，保持原解析及各自来源 |

## 验证

以下命令在 `apps/desktop` 执行。桌面导入使用新生成并实际解析的三页 PDF，提供方响应由测试控制。

| 命令或脚本 | 结果 |
| --- | --- |
| `npm run build` | 通过 |
| `npm run test:renderer-components` | 253/253 |
| 构建后执行 `node scripts/electron-smoke.mjs` | 207/207，两个视口 |
| `node --experimental-transform-types scripts/education/kb-book-key-table-boundaries.mjs <已保存的本地答案册测试库>` | 13 项独立验例及 1 项真实 PDF 已保存响应只读复算，均通过 |
| `node --experimental-transform-types scripts/education/kb-book-reference-journey.mjs --compact-answer-key` | 5/5，双尺寸和冷启动读回、2 个引用、1 道题经原来源写回出处可查的答案、1 道冲突题待核；8 次本地受控响应，0 次云请求 |
| `node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs` | 引用专项 53、导入的答案写回 36、页面回归 247 通过 |
| `node --experimental-transform-types scripts/education/kb-book-fill-boundaries.mjs` | 13/13 |
| 预载 `scripts/office-agent/register-source.mjs` 后执行 `kb-answer-section-boundaries.mjs`、`kb-section-inheritance-boundaries.mjs`、`kb-section-status-boundaries.mjs` | 分别 16/16、13/13、12/12，覆盖旧数据和索引 |
| `OMNI_EDU_BOOK_ANSWER_TABLES=0` 后执行 `kb-ai-page-boundaries.mjs` | 247/247 |
| 同一回退开关后执行 `kb-book-reference-journey.mjs --publish-conflict` | 5/5，Pi 与组卷确认冲突题仍被隔离，冷启动不重发请求 |

自然样本同一真实答案页热复算各 100 次，页面投影 P95 从 0.350 ms 增至 0.731 ms。测量未包含 PDF 渲染、模型和数据库，不能代表整库吞吐。依赖清单未变，`npm audit --json` 报 29 项，含 8 项 high、0 项 critical。未上传资料，未增加付费调用。

## 范围、回滚与交付判断

本轮适用于有明确卷名的双行连续题号和字母答案。定位可回到答案原页与双行原文偏移，尚无逐格图像坐标。纵表、多行分组、跨页表、非字母单元格及其它未能证明的一致性留待核或继续沿原详细答案路径。自然样本是已保存的真实回执，不能证明本轮新提示词在各种真实扫描上都能准确保留列。真实跨出版来源留出、复杂图表和跨页仍须独立验证，维护原活动 Goal。恢复规则面向版式特征；后续继续按图片、Word、扫描及原生 PDF 分类检查切段、父题与小问、图表归属和原页证据，并使用不同来源的留出件评价。

设置 `OMNI_EDU_BOOK_ANSWER_TABLES=0` 并重启可让新任务回到 v2，历史回执和已经写入的来源按各自的持久化策略读回。关闭选项不要求迁移、删除原文或重跑模型。修改文件与校验值见同目录 MANIFEST.json。

本轮答案册窄范围验收通过。任意教辅资料的全年级、跨出版来源通用验收及约 10GB 交付仍在进行。
