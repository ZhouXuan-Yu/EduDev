# 同源重复规则题折叠

## 本轮交付

已关闭纯分块 ID 重建后重复抽题挤占题本和待核计数的缺陷。原抽题、来源关联后台队列、SQLite 成员表、题本筛选和来源页面承担此功能。没有引入第二套题库。

当前 221 份资料、328203104B、1312 分块、3182 条题目记录中，54 条同源重复记录分布在 3 份资料。默认题本返回 3127 条，原始候选视图返回全部 3182 条。另有 1 条由既有来源候选规则折叠。54 条记录均经原抽题位置键、完整来源摘要、全部题目字段、档案警告和教师操作记录逐条核对。

折叠只接受未经教师修改的 numbered-text.v1 自动规则题。同题号或相同文字在不同位置仍分别保留。教师编辑、收藏、分类或使用会立即使有关折叠失效，后台重新判定其余自动记录。新归档复用已认证的同源记录。原始题目、原 extraction_key、来源及付费身份均保留。

## 运行范围

- 工作树为 `D:\WorkProject\EduProject-kb-isolation`，分支为 `codex/kb-isolation-delivery-20261111`。
- 源码提交为 `05ffef6cf0934ea0fa0f9f95cee84524f738195f`，已整合当时的 `origin/main` 37512e4。
- 冻结入口及摘要保存在 runtime.json。main SHA 为 `d5aa56ca9c3792d9c8868717d94c1ba1daa98676e045193320ec7548d3f0d8b3`，整树 SHA 为 `033451189ec3b5b0b37571336d1e31d27846b7dd019a5fa3ce65682d046508d0`。
- 真实测试根为 `D:\WorkProject\EduProject-kb-run\flow-1gb-20261111`。prepared.json 与 run-state.json 指向本次冻结版本。应用收尾已关闭，目录导入和 folder AI 均为 paused。
- 已准备的 987 文件、1052908695B 尚未全量导入。本轮继续处理已有 221 份资料。模型账本为 710 调用，新增调用为 0。

## 验证结果

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| 同源重复边界 | PASS 30/30 | 实际 SQLite、生产抽题器、迁移、失效、并发 CAS、新归档幂等 |
| 原来源关联 | PASS 13/13 | 原断言保留，fixture 的 INSERT 改为显式列名 |
| 构建与类型检查 | PASS | 最终源码构建日志见 final-build.log.gz |
| Renderer 组件 | PASS 246/246 | 原断言、原超时，未修改 CSS 或测试配置 |
| 真实资料库 | PASS | 54 条逐项审计、默认/原始视图、来源按钮、两尺寸、冷启、业务事实 SHA |
| 教师操作旅程 | PASS 3 组 | 原目录导入、收藏、编辑答案、重启，使用合成 DOCX 与显式旧重复 fixture |
| npm 运行依赖审计 | 23 项既有告警 | low 8、moderate 7、high 8、critical 0，新增依赖 0 |

命令均在 `D:\WorkProject\EduProject-kb-isolation\apps\desktop` 执行。

```powershell
node --experimental-transform-types scripts/education/kb-rule-duplicates.mjs
node --experimental-transform-types scripts/education/kb-source-origins-boundaries.mjs
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-rule-duplicates-journey.mjs
node test-results/corpus-flow-1gb/rule-duplicates-live.mjs
node --experimental-transform-types test-results/corpus-flow-1gb/rule-duplicates-full-audit.mjs
npm audit --omit=dev --json
```

真实库逐行 SHA 对比涵盖 teacher_resources、resource_chunks、question_bank_items、material_ai_units、material_ai_response_receipts、material_word_document_versions。成员的 extraction_key/resource_id/question_id 也与迁移前副本逐行摘要一致。新增三列及其索引、触发器属于可重建派生状态。

合成旅程通过原按钮收藏被折叠项，该项立即重新出现。随后通过原编辑器修改保留项答案，重启后收藏与修改均保持。合成测试未调用模型，也未写入真实资料库。两种旅程的 rendererErrors 均为空。

## 已保留的失败

- 真实库第一次聚合检查 FAIL，脚本预期 38，实际发现 54。该次已记录后台中断恢复 32→35 和完整游标 3182。随后独立审计额外 16 条及全部 54 条，才修改数量预期。原失败报告与日志均保留。第二次通过证明已完成状态和冷启，初次中断证据仍归属第一次运行。
- 合成旅程第一次 FAIL，使用了不完整的编辑按钮 testid。已改为原页面的 `question-archive-edit-${id}`，未改产品或放宽断言。原失败报告与日志保留。
- 原来源关联 fixture 第一次 FAIL，原因是旧 INSERT 未指定列名。新增派生列后已显式指定原两列，原 13 条断言保留。
- 11 月 12 日来源恢复轮次的组件 CSS 超时仍是历史失败。本轮原样运行 246/246 通过，尚未证明当时超时的根因。

## 性能和数据规模

后台复用原有有界队列，未对全部题目新增常驻轮询。首个记录进度为游标 8，368 秒后游标 3182 且后台完成。期间包含关应用、冷启动和一次中断恢复，属于本机墙钟观察。重复查找和计数使用派生键与非空指针的部分索引。

修复前存在 54 条重复自动记录，本轮完成后它们从默认入口折叠。原始记录仍为 3182，待核状态读回为 3016。当前样本未测规模检索 P95、10GB 性能或长期资源占用。没有新增 npm/pip 依赖或组件下载体积。

## 代码与回滚

核心修改为 material-rule-duplicates.ts、material-rule-protection.ts、material-question-archive.ts、material-question-extract.ts 和 material-question-origins.ts。共享 ArchiveStatus 增加可选 foldedDuplicates，原 typed preload 通道继续使用。MaterialQuestionStatus 显示折叠数与后台状态，题本原始候选选项包含重复记录。

设置 `OMNI_EDU_RULE_DUPLICATES=0` 后重启可关闭新增折叠读取。原记录与成员身份仍可读取，派生列可保留。需撤回代码时正常 revert 本轮功能提交并保留原业务数据，恢复前备份位于测试根的 rule-duplicates-20261117-before.db。数据库、原件、模型正文和题图未加入 Git。

完整知识库 Goal 仍为 ACTIVE。下一缺陷是手动 AI 与目录 quality 策略不一致，以及已有 B/C 矛盾、uncertain/部分 corrected 的复核协议。先复用已保存响应定位并修复，再通过原用户入口。复杂文本框、已知答案配对与联网补答、整库自然质量、完整检索组卷、安装迁移和约 10GB 均继续 OPEN。
