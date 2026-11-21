# 独立答案册恢复原印答案与解析标签

## 根因与行为

独立答案册会重印题干，再用「【答案】」「【解析】」标明两块内容。旧抽取器要求答案紧接题号或以无括号的角色名开头。真实上海数学答案册第 1 页上，条目能被切出来，答案和解析却为空。

新的独立答案册批次冻结 `answer-entry-printed-labels.v4`。两遍转录都保留原印的标签、相邻题面和原文换行。字段抽取支持常见方括号样式，保留原始公式、全文引文和偏移。残缺、重复、顺序矛盾的标签进入待核，指向解析的占位文字也会留下缺答案状态。自动写回仍核对题面、原始证据、双遍文字、完整章节、题号及教师修订。

| 文件 | 改动 |
| --- | --- |
| `shared/material-ai-page.ts` | 增加冻结的单元策略 |
| `main/assets/material-ai-repository.ts` | 新建答案册单元选择新策略 |
| `main/assets/material-ai-book-instruction.ts` | 请求保留原印标记及换行 |
| `main/assets/material-book-answer-content.ts` | 从同一题号下的原文识别显式角色，保留速查表和原有写回门槛 |
| `scripts/education/kb-book-answer-boundaries.mjs` | 检查同页重印题面、原文坐标、重复及残缺标记、旧回执与真实页回放 |
| `scripts/education/kb-ai-page-boundaries.mjs` | 同时检查冻结旧策略和默认的新策略 |
| `scripts/education/kb-book-reference-journey.mjs` | 在现有桌面目录导入、AI 配对、题本和重启流程中加入印刷标签样本 |

## 真实资料与性能

复用已入库的上海高考数学独立答案册共 9 页。对本机留存 OCR 做只读回放。新策略将答案字段候选由 0 条增加至 11 条。第 1 页第 1 条的答案能够找回 `[4,5]`，原始引文可按偏移回读。原资料存在栏序交错，整组回放保持待核，自动写回为 0。这组数字衡量字段恢复能力，未定为数学内容准确率。每种策略执行 9 轮，每轮对样本各回放 100 次。单页规则计算的中位时间从 0.095 毫秒到 0.132 毫秒。该测量只包含本地抽取。

## 验证

| 项目 | 结果 |
| --- | --- |
| `npm run build` | 整合协作主线后构建通过 |
| `npm run test:renderer-components` | 253/253 |
| 页协议、独立答案册、目录、配答与隐私回归 | 7 个脚本通过。页协议与回执专项 254 项，答案抽取专项 24 项 |
| 独立答案册桌面专项 | 最终构建 5 项通过，实际递归导入、OCR、配对、题本及冷启，覆盖 1366×768 和 1920×1080，8 次受控返回，外发和渲染错误均为 0 |
| Electron 综合冒烟 | 审查候选构建 207/207。最终构建进一步接受「答」「解」的简写并通过专项，未重跑综合冒烟 |
| `npm audit --json` | 27 项既有依赖告警，6 项 high，0 项 critical |

桌面目录中执行 `node --experimental-transform-types scripts/education/kb-book-reference-journey.mjs --printed-labels`。最终主进程 SHA-256 为 `d367dc45ead320815759c678a78a17c436ecdfd4e45fe48bd100449c454d4df4`。本地最终报告为 `E:/EduDev-kb-printed-answer-labels-20261121/omni-book-reference-ui-9lRUXM/report.json`。真实样本回放为 `OMNI_EDU_PRINTED_ANSWER_REPLAY` 指定隔离 SQLite 后运行 `kb-book-answer-boundaries.mjs`。

保留早期失败记录。旧桌面用例的受控输出已落后于题册端协议，改用覆盖现行协议的现有路径。后续运行触发归档的 64 MiB 空间保护，测试盘恢复空间后通过了目录导入及冷启。


## 兼容、回滚与继续验收

此次沿用原数据库与题库版本模型。已冻结的 v1～v3 回执继续使用自身规则，可保持已有入库证据。若需暂停为新批次选择新策略，可设 `OMNI_EDU_BOOK_ANSWER_LABELS=0` 恢复新批次默认 v3，同时保留 v4 历史的读取和核验代码。

完整自然答案册的章节匹配、跨页和双栏仍需要验证。此专项未为真实资料新增外发。真实补答与配答指标、独立检索、正式组卷、约 10 GB 混合资料及异机迁移继续按 KB-A01～A10 进行。
