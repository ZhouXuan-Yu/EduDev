# Word 卷首装饰与试题条件的归属

## 根因与修改

试卷首段包含标题和一张 25×20 的近白图。旧版将所有含图的段落整体归入共用题面，下一段完整的题量与计分说明也未被识别。真实样本的原印答案已经能关联，但此前每题仍带有题前范围疑点。

- `material-word.ts`、`word-preamble-image.ts` 和 `material-word-repository.ts` 在 v7 记录已验证的首段装饰图。仅在无警告、无编号、无替代文字、单个内联静态 PNG 和完整标题同时成立时读取像素。比较图片长度、摘要、真实尺寸与每个 BGRA 像素，保护透明图、动画和可见笔画。图像尺寸最多 64×64，字节数不超过 64 KiB。
- `word-preamble.ts`、`word-booklet.ts` 和 `word-question-source.ts` 将经过证明的标题与完整计分小节归到资料上下文。图像仍留在原始 Word 结构中。同一图片出现在题干、选项或答案时仍保留原角色。包含真实物理量、公式、未知文字或表格的条件继续由原规则处理。
- `word-upgrade-compatible.ts` 与 `db.ts` 让已有 v5/v6 可使用本地缓存升级，也保留手动整理入口。兼容事务保存旧快照和摘要。重复整理保持原正文和分块；没有可验证的缓存图像时仍保留卷首疑点，可从原件重新整理。

## 真实样本与范围

在 221 份资料的现有隔离库上，重新整理 2022 上海中考数学 Word。原图的 500 个像素均不透明，RGB 值落在 254～255。旧版发出卷首疑点，新版将该图和计分条款移出逐题题面。

| 指标 | v6 | v7 |
| --- | --- | --- |
| 原文题目 | 25 | 25 |
| 已绑定印刷答案且只有卷首疑点的选择题 | 6 | 0 |
| 已绑定答案且来源无结构疑点的上述选择题 | 0 | 6 |
| 新进入正式选题库 | 0 | 0 |

在真实资料页逐题读回 6 条原答案，生成一道题的两页本地图稿，覆盖题面和答案两个角色。原 DOCX 哈希、原始块、媒体、题序、题目本体范围、答案位置和旧快照保持。重复整理及重启回读通过。本轮未新增模型调用。

只读重放隔离库的 148 份文档、4,222 道题。148 份题序和本体范围一致，29 道题仅有的卷首疑点消失，其中 6 道已有答案。仍有 64 道已有原答案的题带共用条件疑点。只读重放只采用已经保存的图像证明，其他文档未批量升级。

## 验证

在 `apps/desktop` 运行。最终桌面主进程 SHA-256 为 `80aa5c8539a749d6d8e88679ed870c32c4557da1aed565e9addbef83043c6ad9`。

- `npm run build -- --outDir test-results/build-kb-word-preamble-ready` 通过。
- `npm run test:renderer-components`，253/253。
- `node --experimental-transform-types scripts/education/kb-word-preamble.mjs`，14/14。
- `node --experimental-transform-types scripts/education/kb-word-booklet-boundaries.mjs`，14/14。
- `node --experimental-transform-types scripts/education/kb-word-background-upgrade.mjs`，10/10。
- `node --experimental-transform-types scripts/education/kb-folder-word-upgrade.mjs`，13/13。
- `node --experimental-transform-types scripts/education/kb-word-printed-answer-electron.mjs <隔离目录> --preamble`。加 `--verify-existing` 复查最终构建和已保存的同一隔离库。
- `node scripts/electron-smoke.mjs` 验证功能分支的最终构建，207 项前端检查通过。
- 合入远端 `4b4ebe4` 后重新构建，主进程 SHA-256 为 `b916e3e8baff67615f430dc6cbc4898d428e41d3651bb1dfdee8c8e96dc5cb84`。此构建通过 253 项组件测试及真实 Word 专项，覆盖 6 道题、两页图稿、二次整理和冷启动。
- `npm audit --omit=dev --audit-level=high` 报告既有 20 项依赖问题，其中高危 5 项。本轮无依赖改动。

## 回滚与后续

原件、资源分块和旧快照均保留。若必须退回只识别 v6 的应用，可从升级前备份或兼容快照恢复该资料的当前 Word 表示后启动旧应用。

该批次仍需生成和核对解析，6 道题尚未正式归档。独立答案册分代、独立检索、三套正式卷、约 10 GB 混合导入和跨机迁移继续按原标准验收。

下一处已复核的独立答案册缺口来自 2025 上海高考数学答案 PDF。该资料的唯一历史 AI 单元在隐私检查失败，调用、派发、响应和配对记录均为零，当前关联仍被已处理门槛拦截。后续需区分未派发的失败与已派发历史，使用新角色绑定并保留旧阻断记录和现有隐私检查。
