# 首个小问位于下一页的跨页题

## 根因与修改

真实浮力练习 PDF 的第 1 页末题有完整条件，以“求：”收尾。第 2 页才列出第（1）至第（4）问和题图，然后开始下一道题。原页首判断和版面规划只接受由第（2）问及后续编号开头的续页。此外，常规整理输入同时保留 PDF 原生文本和 OCR，两份文字拼接后会重复出现父题号与小问编号。

新冻结协议 `page-continuation.first-subquestion.v1` 只用已验证页回执选定的文本与原 OCR 版面块判断归属。前页最后一道题的正文须在两个读数中一致，并以明确的求解提示收尾而尚未出现小问。后页的有序小问从（1）开始，须有连续小问和紧接的下一父题。裁图涵盖本题的原图，避开下一题和其他版面块。整理与归档继续使用已有双遍字面复核，续页归属须在发布及冷读时重新从两页回执验证。

实现涉及 `material-ai-page-source.ts` 的页首信号、`material-ai-continuation.ts` 的冻结规划和授权验证、原后台整理入口及原题归档。旧协议沿原解析，新增一条对应的新任务提示。SQLite 表、原 PDF 和原 OCR 回执延续现有格式。

实跑还发现，小裁图重跑 OCR 会重复变量 `V` 并在另一行插入 `4`，整页 OCR 和原件可证实这两个局部识别错误。新协议只有在同一完整版面块的文字与两次独立原图转录的字面签名一致时，才允许纠正局部 OCR。比较只归一化括号及部分排版空格和换行。原 OCR 与两遍转录分别保存。题图中的 `F`、`A` 归入原图证据。

## 修改前后与性能

基线无法规划该题续页。修复后选定第 2 页四个小问及图所在的五个块，下一父题及其图仍在裁图之外。原资料中保留的留白、数据与单位继续经过标准原图校验。

同机对实际解析结果计算 100 次，规划 P95 为基线 0.099 ms、修复后 0.180 ms。时间包含限定范围内的版面块检查，裁图、模型和整批导入另计。无新增依赖。依赖审计报告存量 29 项，其中 high 8、critical 0。

## 验证

以下命令工作目录为 `apps/desktop`。

| 命令或范围 | 结果 |
| --- | --- |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-first-subquestion-boundaries.mjs <已解析资料库> <桌面测试输出>` | 6/6，涵盖真实原件、PDFium/RapidOCR/PP-DocLayout 数据、两遍裁图回执和反例。改单位、漏图标签、转录分歧、前页已有小问、续页错序及裁图重叠均拒绝 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-figures-boundaries.mjs` | 独立题图 10/10，通用跨页 12/12，AI 页面 248/248 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-choice-tail-boundaries.mjs <已解析资料库>` | 跨页选项 7/7 |
| `npm run test:renderer-components` | 253/253 |
| `npm run build` | 通过 TypeScript、主进程、preload 和 renderer 构建 |
| `node scripts/electron-smoke.mjs` | 使用本轮交付构建，207/207，退出码 0 |
| `node scripts/education/kb-choice-tail-electron.mjs <已解析资料库> --first-subquestion` | 真实 PDF 桌面专项 2/2。第 4 题 `ai_final`，四个小问和续页题图完整落库。关闭新发现后冷启动仍可读回各裁图 SHA-256。6 次受控模型响应，云请求和渲染错误均为 0 |
| 同一桌面脚本使用默认跨页选项模式 | 真实跨页选择题 2/2，重启后仍可完整读回 |

第一次运行找到正确的裁图后，测试替身错误地读取了独立盲审输入省略的块 ID。修正替身后，真实裁图 OCR 冲突和比较前的排版空格折叠分别通过保留回执复现并修复。并行建立两个测试副本时有一次只读连接锁冲突，脚本随后加了有限等待。失败的本地测试输出保留。

桌面脚本只为目标题提供结构化回复。第 2 页其他题目没有被纳入目标题，仍按原遗漏题检查进入待核。

## 仍待处理及回退

同一批自然资料中的上海高中物理卷还有一题把“电压表”断在两页，并伴随页码和串入的图中文字。本轮覆盖前页开放式设问与后页连续小问的可证明边界。普通断句、跨出版来源的质量、留出检索和约 10 GB 规模继续按 KB-A01～A10 验收。

将 `OMNI_EDU_AI_CONTINUATION_FIRST=0` 后重启可暂停新任务的首小问发现。已保存任务继续按冻结协议读回，无需重建原件和旧题库。

修改路径及 Git 内容哈希见 [文件清单](MANIFEST.json)，构建及验证数据见 [结果摘要](summary.json)。
