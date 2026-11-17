# 高质量原图整理与明确待核结果

## 实际修复

手动原图整理现在通过原 typed preload 显式提交 quality，PDF/图片使用目录整理的原质量策略。Word 将 deepseek-high.v1 固定在私有 selector 中，两遍请求复用统一 DeepSeek 高思考适配器。页数变化时预留既有三遍纠错额度。已存输入及未指定模式的既有调用保持其历史策略，书册引用沿原目录授权范围。

此前报告将 B/C 响应拒收归因为缺少投影字段。实际离线合并后的完整稿通过校验，真正失败条件是模型明确写了 uncertain，却没有填写对应疑点。已纠正该诊断并实现两种受限恢复。

- 首稿 B、修正稿 C 且解答检查明确 uncertain 的原响应，采用 recovery v2 补充 answer_conflict，保存为待核题。
- 新高思考两遍均为 B，复核明确将解析标为 uncertain。native review v3 可以表达这种明确的不确定，保留原检查和局部修正，直接进入待核。历史 v2 响应转换由 recovery v3 记录版本与派生摘要，原 v1/v2 reader 继续严格读取。

v3 发布与后续读取须同时通过原输入、最新完整回执、原首稿 SHA、派生 SHA、审计变化项及来源图片认证。没有合法审计的跨版本结果不能发布。明确 uncertain 的结果持续保持 ai_needs_review。

## 当前资料库

仍使用已导入的 221 份资料、328203104B、1312 分块。题目记录 3182→3184，同一原题新增两份带图待核稿。AI 单元 310→311，调用和回执 710→712，恢复审计 4→6，unknown 保持 22，Word 历史保持 893。

两次恢复均通过原“从已存响应恢复”按钮完成，恢复新增调用为 0。当前两种原图均可在题本打开，1366×768、1920×1080 和重启读取通过。最终冷启同时实读 native-reviewed.v2 与 native-reviewed.v3 原图，全题库行摘要保持，调用仍为 712。

原 3182 条题目、原资料、正文分块、原 710 份回执、原 4 条审计均逐行保持。第一次恢复只改变原失败单元的结果与状态，第二次恢复只改变新增高质量单元的结果与状态。各自其余单元、原输入、首稿、图片摘要均与 SQLite 备份一致。原始文件、模型正文和数据库未加入 Git。

## 构建与证据范围

| 项目 | 结果 | 构建范围 |
| --- | --- | --- |
| 新质量与恢复边界 | PASS 17/17 | 最终 v3，含真实保存响应本地复读、迁移回滚、审计篡改与原生读回 |
| 原 Native 复核 | PASS 27/27 | 最终 v3 源码，原 v1/v2 断言保留 |
| 原 Native 调度 | PASS 17/17 | 最终 v3 源码 |
| 原回执恢复 | PASS 13/13 | 最终 v3 源码 |
| 页面质量链路 | PASS 247/247 | b97688c，包含新增手动 quality 策略与原 246 项 |
| 仓库 smoke | PASS 207/207 | b97688c 构建，legacy fixture，退出 0 |
| 最终 build | PASS | f42bd8c，包含 v3 及原书册授权范围 |
| 最终 Renderer 组件 | PASS 246/246 | f42bd8c，退出 0 |
| 原 B/C 实际恢复 | PASS | b97688c 原按钮、原图与冷启，0 调用 |
| 高质量真实请求 | 原始运行 FAIL 后恢复 | b97688c，2 次真实 DeepSeek，明确解析 uncertain 导致旧 v2 拒收 |
| v3 实际恢复与双版本冷读 | PASS | f42bd8c 原按钮、两尺寸、两版本图片、重启及 SHA，0 调用 |

最终冻结源码为 `f42bd8c46278b2b9b7343a87a85d6393a33b2b65`。main SHA 为 `270f38b11e05fbd3a009b18de4f912173f4f46f411258935e2a0a88a5ece3f88`，整树 SHA 为 `f0d46d132ebf55a89044501b0b81d19d39419f2c18284f370cc0cd414001e499`。入口见 final-runtime.json。真实请求来自更早的 b97688c，原始失败保持 FAIL。最终版本完成的是相同已存响应的合法恢复和读取。

命令在 `D:\WorkProject\EduProject-kb-isolation\apps\desktop` 执行。

```powershell
node --experimental-transform-types scripts/education/kb-ai-quality-continuity.mjs D:/WorkProject/EduProject-kb-run/flow-1gb-20261111
node --experimental-transform-types scripts/education/kb-native-field-review.mjs
node --experimental-transform-types scripts/education/kb-native-dispatch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-response-recovery.mjs
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
npm run build
npm run test:renderer-components
npm run test:smoke
node test-results/corpus-flow-1gb/ai-quality-recover-live.mjs
node test-results/corpus-flow-1gb/ai-quality-native.mjs
node test-results/corpus-flow-1gb/ai-quality-v3-recover-live.mjs
node test-results/corpus-flow-1gb/ai-quality-final-cold.mjs
npm audit --omit=dev --json
```

## 性能、依赖与失败

旧非高思考样本两次请求分别约 4.33s、2.61s。新高思考请求约 68.49s、44.90s，合计 113.39s，24261 tokens 中含 17028 reasoning tokens。这是不同日期的单题观察，包含实际服务时间，不含完整本地 OCR 耗时，未测 P95。高思考增加了实际请求时间与 token 消耗，结果仍须依据明确的质量信号处理。

两份不合格响应通过本地恢复得到可追溯的待核稿，当前新增自动定稿为 0。原图的 drawing_float_layout 继续产生 source_warning 和 incomplete_question，两份稿都保持待核。单题两次答案一致尚无独立答案真值，本轮没有以此认定整库答案质量达标。

新增 npm/pip 依赖、下载组件和 IPC 为 0。npm 运行依赖审计仍有既有 23 项告警，low 8、moderate 7、high 8、critical 0。

保留了高质量原始运行的 invalid_response 失败日志与元数据。最初曾错误使用不存在的 tsconfig.node.json，随后普通类型检查发现移动策略后遗漏 task 参数，均已修正，最终构建通过。原始工具输出仍在对话记录，未将后续通过日志冒充此前失败日志。针对显式 uncertain 的第一版恢复只接受答案不同，真实答案一致的返回促使加入 v3 表达。该限制已从合同移除。

## 修改位置与回滚

共享契约修改 material-ai.ts、material-ai-native-input.ts、material-ai-native-review.ts、material-ai-response-recovery.ts 和 question-archive.ts。主进程修改 material-ai-repository.ts、material-ai-native.ts、material-ai-provider.ts、material-ai-reasoning.ts 和 material-ai-responses.ts。界面沿 MaterialAiPanel，测试复用原 Native/Page fixture，并新增 kb-ai-quality-continuity.mjs。

原 material_ai_response_recoveries 以 response_id/policy 作为复合主键，在原单写事务中复制旧行和替换表，注入 DDL 失败可完整回滚，实际旧审计逐行保持。当前没有新增业务真源或第二套任务循环。

回滚新请求可恢复手动入口的历史模式，`OMNI_EDU_AI_REASONING_HIGH=0` 停止新单元选择高思考，`OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY=0` 关闭后续自动派生。已保存的高思考单元按其固定 selector 执行，需通过原暂停按钮停止。已有 v3 题目须保留 v3 reader 和多版本审计，避免直接降到不识别它的二进制。测试根已保存 ai-quality-before.db 与 ai-quality-v3-before.db。

## 继续位置

完整 Goal 保持 ACTIVE。下一优先修复真实 Word 浮动图与其标注的来源对应，当前题面的一个段落仍有 drawing_float_layout，用原件版式和标签归属证据恢复完整性。新解析不确定结果已能正常归档待核，后续据真实疑点推进质量。

整库自然题目质量、复杂文本框、已知答案与联网补答、完整召回重排和组卷、安装移植、约 10GB 均继续 OPEN。仍用当前 221 份资料，目录导入和 folder AI 均 paused。prepared.json/run-state.json 指向最终冻结构建，应用已正常关闭。
