# PDF 已存首稿的本地恢复

## 根因和修改

PDF 页首轮响应已收到并留存，部分历史记录因响应表示未通过当前页级解析而中断。旧恢复动作的资格查询和执行器都只接受 Word。适用于首稿的本地恢复入口缺失，原任务从未走到裁图、原图复核和定稿。

- `material-ai-repository.ts` 共用严格页响应解析、原件/页/图片证据及最新响应回执。只有未发布且对应同一冻结输入的首轮响应才能恢复。恢复摘要、首稿、暂停标识和目录子任务状态在一次写事务提交。继续操作先复核配置、额度、目录授权及原件身份。
- `material-ai.ts` 和 `MaterialAiPanel.tsx` 显示已恢复首稿和待原图复核状态。沿用现有 typed IPC，继续操作使用同一批次剩余额度。
- `kb-page-first-recovery-electron.mjs` 使用现有试导库和冻结构建，覆盖旧版缺口及新版的成功、失败、重启和原件变更。
- `kb-ai-page-boundaries.mjs` 在受控 SQLite 和模型适配器上验证原事务回滚与明确继续后只请求下一阶段。能力清单已按共享契约再生成。

## 实测变化

| 已存 PDF 响应 | 旧构建 | 修复版 |
| --- | --- | --- |
| 10 份失败首稿 | 无本地恢复入口，0 页恢复 | 3 页恢复到待核验首稿，含 11 个候选 |
| 其余 7 份首稿 | 中断 | 保留未完成，原因包括截断、空难度、缺失标记与非空内容矛盾 |
| 5 份阶段不匹配的末轮响应 | 中断 | 原状态维持，8 个末轮候选不计入题库 |
| 新增请求和正式题目 | 0 | 0 |

原始模型响应、输入、调用账本和已发布题保持不变。移至另一目录的原件可以通过全文件版本核验恢复本地首稿。云端继续保留既有物理标识门槛，迁移后要重新收录并确认模型范围。本轮真实资料未发出后续模型请求。受控同源场景验证恢复不重发首轮，继续后只发剩余的复核请求。验收衡量恢复率、阶段与事实一致性，未采集批量吞吐。

## 测试

从 `apps/desktop` 运行。最终主进程构建 SHA-256 为 `05b2cb48208076ae60b6e8caf94ce72d71caad7924c4267ca15e88a20bf37e5d`。

| 命令 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/build-kb-page-first-final` | 通过 |
| `npm run test:renderer-components` | 253/253 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-ai-page-boundaries.mjs` | 254/254 |
| 同启动参数，`scripts/education/kb-response-receipt-boundaries.mjs` | 通过 |
| `node scripts/education/kb-page-first-recovery-electron.mjs <本地试导库 data>` | 真实新版通过。旧构建加 `--baseline` 复现未恢复 |
| `node scripts/electron-smoke.mjs`，同一最终构建，TEMP 和 TMP 指向 D 盘隔离目录 | 207/207 |
| `npm audit --omit=dev --audit-level=high` | 20 项存量通告，5 项 high，0 项 critical，依赖未变 |

综合回归首次使用 C 盘临时目录，在资料归档处失败。C 盘当时约有 58 MiB，可用空间低于归档的 64 MiB 预留。随后将回归临时目录切换到 D 盘，以最终构建重跑。

首轮恢复通过本轮验收。历史纠错稿和末轮响应的离线恢复仍待建立足够证据，继续推进整目录结构重建与题库主链。回滚用普通 revert，无数据迁移。首稿、旧回执和现有题库均保留。

## 下一处批量断点

旧试导库主目录批次有 221 份不同资料，原件均存在，包含 148 份 DOCX、66 份 PDF 和 7 张 PNG。219 份已有旧正文，结构任务为 0。当前只有单资料结构重建入口，普通重试不会为已有正文的旧资料补建结构。下一轮从目录批次复用现有持久解析队列，保留源版本、去重、暂停和重启续办，覆盖“结构已登记但解析还未入队”的故障。该文件数是可调度范围，正式可用题量以实际后续产出为准。
