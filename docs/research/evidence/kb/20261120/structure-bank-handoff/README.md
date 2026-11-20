# 资料重建后的结构题交接

## 根因

旧的归档任务用物理来源指纹查重。重建产生修正题干后，旧草稿仍拥有同一物理来源指纹，新版因此被跳过。旧草稿没有退回历史的状态，继续占用默认搜索结果。已确认题和旧试卷依靠原题 ID 和旧结构凭据读回。

## 修改

- `material-structure-bank.ts` 保存结构草稿的暂存与历史状态。最后一个批次在同一写事务内公开本轮暂存题、隐藏已被替代的旧草稿，并保存任务完成状态。撤销、重试和中断期间继续显示上一批已发布题。
- `material-question-archive.ts` 与 `material-structure-repository.ts` 按同一批次或教师核对状态判断重复归档，完整凭据相同的题保留已有题本 ID。旧归档任务的令牌只迁移一次，继续使用持久化批次游标。旧结构页、题本事实、教师回执和答案册回执保留原值。
- 缺少新版来源分块会保留上一批题并报归档失败。多条相同凭据只保留一个未核草稿作为默认结果。撤回旧题的教师核对会重排当前归档，可继续交接被旧题占用的新版。
- `material-question-origins.ts`、`db.ts` 和 `material-ipc.ts` 在默认题本、关键词、语义候选和组卷候选使用相同的可见性过滤。历史草稿仍可按 ID 读回，但历史草稿校正会拒绝写入。
- `QuestionNotebookWorkspace.tsx` 和 `QuestionArchiveEditor.tsx` 在“显示原始候选”中标记历史草稿，处理资料重建与正在编辑的交错。

## 测试

| 用例 | 结果 |
| --- | --- |
| 五三物理旧真实库 | 默认题本原来只有两个不带填空的旧第 12 题，迁移后只显示一个带两个填空的新版 |
| 显式历史 | 两条旧稿可查看，编辑入口或 IPC 校正版本读取拒绝 |
| 再次重建和冷启动 | 题目 ID、原结构页和独立答案册回执逐值一致 |
| 暂存、旧批次竞争、磁盘写入失败及恢复 | SQLite 事务回滚后继续显示上一批，重试成功时原子交接，确认记录原值保留 |

- `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/structure-review-boundaries.mjs` 18/18。
- `node --experimental-transform-types scripts/education/document-structure-repository.mjs` 39/39。
- `node --experimental-transform-types scripts/education/kb-qualified-origins-boundaries.mjs` 19/19。带 10 万条无关来源记录的受控候选查询继续通过。
- `node --experimental-transform-types scripts/education/kb-structure-book-boundaries.mjs` 8/8。
- `npm run test:renderer-components` 253/253。最终冻结构建为 `npm run build -- --outDir test-results/build-structure-bank-reviewed`。
- 评审前冻结构建的桌面通用回归 `node scripts/electron-smoke.mjs` 有一次掌握度小测提交失败，隔离重跑 207/207。评审修补覆盖缺失来源、同凭据重复草稿和撤回确认，在最终构建执行专项与真实库验收。
- 设 `EDU_HANDOFF_SEED` 为本机临时旧验收库根目录，用冻结的 `OMNI_EDU_TEST_BUILD_ROOT` 执行 `node scripts/education/structure-bank-handoff-electron.mjs`。脚本复制资料与 SQLite 快照，再跑真实桌面流程，3/3。
- `npm audit --omit=dev --audit-level=high` 检出 23 项存量通告，含 8 项 high，本轮依赖文件无变更。

同一旧库迁移副本上，生产可见性函数对 200 个 ID 交替执行两种 SQL 各 300 次。去掉历史过滤的基线 P95 为 0.452 ms，加上历史过滤后为 0.484 ms。SQLite 用题目 ID 主键索引查询可见性表。该计时仅覆盖单个本地候选批次。

## 剩余与回滚

结构题自动配答还需接入持久队列，并验证答案晚到、重启和绑定版本变化。全文资料索引仍会保留可搜索的历史派生分块，且原题仍持有指向这些分块的合法引用。自然规模、全文检索质量、正式组卷和数据移植按 KB-A01～A10 继续推进。

可回退应用代码。数据库仅新增派生可见性表，并保留所有旧题与来源记录。旧程序会重新显示历史草稿，需恢复回退前题本视图时使用升级前数据备份。
