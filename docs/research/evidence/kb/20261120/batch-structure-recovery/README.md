# 既有目录的后台结构恢复

## 根因与修改

旧资料已经提取正文时，普通解析会保留已有记录。结构重建只有逐份资料的入口，单份入口的结构登记与解析入队也分两次提交。目录范围内的旧文件无法一次进入「OCR 文本行 → 页面区域 → 段落 → 题目结构」流程。

- `material-structure-recovery.ts` 增量登记批次和去重的同版本资料。暂停阻止新的交接，已进共享队列的任务可以结束，追加和失败重试复用原结构世代。结构登记、解析入队及文件状态在同一 SQLite 事务中提交。
- `material-structure-repository.ts`、`material-parse-queue.ts` 和 `db.ts` 复用现有结构世代、缓存、解析租约和发布路径。单批和跨目录共享同一份资源，最多有四个目录恢复条目处于已交接状态，现有 1～2 个本地解析槽继续决定实际并发。
- `material-import-batch.ts`、`material-import-batches.ts` 和 `MaterialImportPanel.tsx` 通过既有 typed IPC 提供启动、追加、暂停、继续、失败重试和待核文件定位。状态区分等待、处理中、结构完整、部分完成和失败。
- `restore-database.ts` 将移植副本中的恢复批次留在暂停状态，保留已发布结果和原资源版本，明确继续后可接着处理未完成的本地任务。
- 两个 `kb-batch-structure-*.mjs` 分别覆盖 SQLite 调度/原子回滚及实际教师路径。

## 真实前后对照

| 检查项 | 旧构建 | 新构建 |
| --- | --- | --- |
| 旧目录批量结构恢复 | 入口缺失，批次动作被拒绝 | 去重后登记 221 份，包含 148 DOCX、66 PDF、7 PNG |
| 暂停后重复启动及冷启 | 无目录级状态 | 首轮交接 4 份，暂停入盘，冷启继续复用既有世代 |
| 实际派生发布 | 试导库档案无结构任务 | 首份 5 页 PDF 发布 161 个段落及 8 个候选，7 个待核 |
| 原件与既有题 | 保留 | SHA-256 核对通过，已核对题快照及模型账本一致，DeepSeek 调用 0 |

从冷启后点击继续到首份原件发布约 96.9 秒。旧构建没有同操作耗时可比。发布后再次暂停，隔离副本保留 1 份部分完成、4 份已交接、216 份等待。可从「查看待核对文件」定位这份 PDF。此处统计结构候选，正式可用题仍需走下游校验。DOCX 和图片进入同一批范围，已启动的自然文件样本只证明了 PDF 发布。

## 测试

- `npm run build -- --outDir test-results/build-kb-folder-structure-final` 通过，主进程 SHA-256 为 `b80c5a079ab00cd514838c93a9d1ed3afa616cb741bf902c0899ed02b744b354`。
- `npm run test:renderer-components` 253/253。
- `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-batch-structure-boundaries.mjs` 7/7，覆盖重进、重复项、旧 pending 接管、版本冲突和事务回滚。
- 同一启动参数，`scripts/education/document-structure-repository.mjs` 39/39。
- 使用 `OMNI_EDU_TEST_BUILD_ROOT` 冻结构建，运行 `node scripts/education/kb-batch-structure-electron.mjs <已有本地试导库 data> <资料批次 ID>`。旧构建加 `--baseline`。新构建真实两种窗口尺寸、暂停冷启和发布通过，后续回读验证待核文件跳转。
- `node scripts/electron-smoke.mjs` 使用同一冻结构建和 D 盘隔离临时目录，207/207。
- 备份重定位受控测试通过，移植副本保留冻结世代及已发布结果，取消旧解析租约并保持暂停。
- `npm audit --omit=dev --audit-level=high` 有 20 项存量通告，5 项 high，0 项 critical。无依赖变化。

程序路径已接通，221 份尚未全部处理完成。独立自然题召回、三套正式卷、约 10 GB 后台处理和真实跨设备换机仍待整体验收。回滚可用普通 revert，保留增量表、已派生结构和既有原件，已交接任务继续使用现有解析队列控制。
