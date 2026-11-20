# 从现有题库推进教师主链路

本轮结束逐题对齐和旧 Word 年级回填。已有资料、题目、复核凭据和验收报告沿用。后续从已导入批次中的可用原题开始，用「后台导入、配答、检索、组卷、确认、导出」的实际结果判断进度。

## 通用缺陷与修正

| 环节 | 修复前 | 修复后 |
| --- | --- | --- |
| 递归目录 | 直接导入支持 BMP，持久批次静默跳过嵌套 BMP | 两种目录入口共用文件判断，BMP 入队，其他格式的判定延续 |
| 答案册 | 同一配对版本在处理期间重新入队时，旧任务的结束会清除或报错覆盖新任务。在领取和匹配之间遇到索引待办也可能被当作完成 | SQLite 为每次入队刷新凭据，配答写入和结束绑定领取凭据，索引忙时自动继续等待 |
| 检索 | 库中有内部题型 `fill_in_blank` 时，中文“填空题”过滤可以返回零条，正式组选却能识别 | 已知填空、简答、解答、判断和编程标签共用现有组选等价类型。关键词、向量条件和结果复查可找到对应原题，显示原标签 |

两项子任务分别负责递归发现与题型过滤。整合负责配答任务及旧 SQLite 队列迁移。配答仍通过现有原件认证、配对身份、题号和写回事务，不新增模型调用。

## 修改范围

- `material-folder-import.ts`、`material-import-batches.ts` 共用现有目录文件支持规则。
- `material-book-answer-work.ts`、`material-book-answer-repository.ts` 接续到达的本地配答任务，保留已有待处理、失败和历史写回记录。
- `shared/question-type.ts` 拓展现有题型表。旧选择题子类边界及未知自定义标签保留。
- 五份现有 `scripts/education/kb-*-boundaries.mjs` 新增或更新受影响回归，附带刷新两个核心工具构建清单。

## 回归与性能

在 `apps/desktop` 执行 `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/<文件>`。

| 文件 | 结果与范围 |
| --- | --- |
| `kb-folder-issues-boundaries.mjs` | 11/11。真实临时目录与 SQLite 验证发现和调度，归档写入由测试宿主控制 |
| `kb-book-match-boundaries.mjs` | 39/39。实际 SQLite 队列、索引、写回事务，覆盖同一配对再入队、晚到索引和旧库迁移 |
| `kb-answer-section-boundaries.mjs` | 17/17。答案册跨页卷名回归 |
| `kb-section-inheritance-boundaries.mjs` | 15/15。题册跨页卷名回归 |
| `kb-structure-book-boundaries.mjs` | 17/17。既有结构题队列回归 |
| `kb-retrieval-boundaries.mjs` | 21/21。正式 SQLite 筛选与检索库运行，向量端口受控 |
| `npm run test:renderer-components` | 253/253 |
| `npm run build -- --outDir test-results/build-kb-reuse-mainline` | 通过。主进程构建 SHA-256 为 `c01e0d9bbc857eb069c4ec6df1acb95331603b649e37dbd03a41cb45b5da92a5` |
| `OMNI_EDU_TEST_BUILD_ROOT=test-results/build-kb-reuse-mainline node scripts/electron-smoke.mjs` | 207/207。隔离桌面实跑包括现有题本、检索、归档和导出及重启回读 |
| `npm audit --omit=dev --audit-level=high` | 22 项存量通告，7 项 high，0 项 critical。依赖无变更 |

内存 SQLite 的同册 100 页重复入队工况预热 20 次，再测 100 次。无入队凭据的 P95 为 0.080 毫秒，加入凭据后为 0.218 毫秒。两者均只保留 100 条待办。该测量只覆盖 SQLite 入队，不计文件或 OCR。

## 剩余验收与回滚

本轮覆盖三个通用缺陷。BMP 专项覆盖发现与调度，实际 BMP OCR、独立自然检索留出、完整三套卷、约 10 GB 后台处理和异机迁移仍需验收。继续用已有已通过校验的题实际组卷和导出，记录符合条件的候选是否足够。

需要回滚时对本轮提交执行普通 revert。队列新增列为可选的默认空字符串，旧程序继续使用明确列名。同册新工作可能被旧进程提前标记的缺陷会随旧代码返回，原资料与已写回答案凭据可保留。
