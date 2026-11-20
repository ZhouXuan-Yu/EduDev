# 独立答案册零派发失败的版本化关联

## 根因与修改

旧版把任何 AI 批次行都纳入已处理检查。2025 上海高考数学答案 PDF 已有一次隐私检查失败，批次停止在本地并保留了目录任务，但没有发生派发、收到响应或写入候选。该失败仍让教师无法建立题册关系。

- `material-book-pairs.ts` 在现有 SQLite 写事务中核对同一答案资源的全部历史。明确的隐私失败只有在整批停在待处理、调用为零、所有单元失败且无派发时间、持有者、输入角色、回执、已执行产物或仍在推进的旧目录预约时，才允许建立新角色。
- 已保存的同一题册答案角色继续按原有版本门槛恢复；其他已派发、未完成或证据不明的记录继续拒绝。
- `material-ai-repository.ts` 补充按资源读取历史批次的索引。创建和派发沿用既有的写事务角色校验。新关系不会重用旧输入、改动旧目录预算或启动 AI 处理。
- `kb-book-pairs-boundaries.mjs` 增加历史证据组合反例、旧输入派发竞争以及旧记录保留验证。补齐原关联竞态测试依赖的 Word 转页来源表。

## 真实资料

在 221 份资料的原隔离库操作。两份 PDF 的原字节与当前资源摘要一致。

| 场景 | 旧版 | 本轮 |
| --- | --- | --- |
| 上海高考数学试卷及答案 PDF。答案册历史调用、派发和响应均为零 | 资料页拒绝关联 | 资料页创建一对关联，两侧角色和源版本重启可读 |
| 浮力题册与答案 PDF。答案册已有 4 次模型调用记录 | 拒绝关联 | 仍拒绝 |

两侧 AI 历史、真实零派发失败、目录预约和响应记录读回一致，未新增模型调用或答案写回。测试未改动旧目录授权。

关联后，从资料页对两册执行本地“恢复文档结构”。试卷 4 页发布 20 个待核内容组，答案册 9 页发布 21 个待核内容组。两份均停在部分就绪，调用计数和目录 AI 授权状态保持一致。13 页各发现一个有坐标的联系方式文本框，全部位于版面页眉、规范化纵坐标的顶部 16% 内。11 页另有结构疑点。原件和页回执继续留在本机。

## 验证

在 `apps/desktop` 运行。最终主进程 SHA-256 为 `a625beb68bfa837a66956ce0b56f39df10becd5a6a8888eee7427521335f55d2`。

- `npm run build -- --outDir test-results/build-kb-book-zero-dispatch` 通过。
- `npm run test:renderer-components`，253/253。
- `node --experimental-transform-types scripts/education/kb-book-pairs-boundaries.mjs`，17/17。
- `node --experimental-transform-types scripts/education/kb-structure-book-boundaries.mjs`，17/17。
- `node --experimental-transform-types scripts/education/kb-folder-books-boundaries.mjs`，10/10。
- `node scripts/education/kb-book-zero-dispatch-electron.mjs <隔离目录>`，真实本地关联、重启和已派发反例通过。旧构建加 `--baseline`，完成后只读复查可加 `--verify-existing`。
- `node scripts/electron-smoke.mjs`，最终功能构建通过 207 项前端检查。合并远端 `427ebcb` 时保留更新、换机与工作台验收记录，核对应用源码、构建配置与锁文件都与已测功能构建的输入一致。
- `npm audit --omit=dev --audit-level=high` 报告既有 20 项依赖问题，其中高危 5 项。本轮无依赖改动。

## 回滚和未完成项

关联沿用兼容的现有表和事务。可在题册资料页解除关联。原文件及历史任务保留，之后可安全回滚代码。新增索引仅是可重建查询索引。

本轮解除关联入口阻断，并建立两册本地版面证据。答案匹配、解析核验和正式入库仍需后续证据。13 页的整页输入仍含触发隐私检查的页眉。后续需让派生文字与派生图像使用同一可验证的页眉范围，并保留原图、旧回执和实际授权。独立检索、三套正式卷、约 10 GB 混合导入和跨机迁移按既有合同继续。
