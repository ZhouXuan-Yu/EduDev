# 结构重建后的正文检索

本轮修复 M04 资料检索。教师重建材料结构后，目录中的「检索内容」、小智的正文关键词与混合检索切换到新版。已经保存的引用仍可通过同一个分块 ID、资源版本、页码和原始偏移读取。

## 根因与修复

`publishMaterialStructure` 为保护引用，在 `resource_chunks` 追加恢复后的正文。全文索引和向量对象原先把所有仍存在的分块当作当前正文，导致同一题的不同结构版本进入候选池。实际复现来自既有五三主书的原页切块与两代结构结果。

- `material-structure-search.ts` 和 `db.ts` 每次完整发布时按资料、页码和精确正文识别当前分块。同页同正文复用最早的物理行。历史分块保留，只更新其检索可见性。解析未发布时继续使用上一次发布的正文。
- `material-full-text.ts` 和 `material-search-statistics.ts` 在同一写事务内更新全文索引及统计。现存旧索引条目也会在查询时经过 SQLite 可见性校验。`retrieval/repository.ts` 对语义结果执行同样的检查，已有事件日志驱动向量索引生成删除记录。
- `material-repository.ts` 和 `material-question-archive.ts` 从当前页文采集新版归档引用，并保留原始物理偏移。归档任务和迁移任务同时启动时，由先执行的写事务完成该资料的切换。历史引用仍走原有回读和校验路径。
- `material-structure-repository.ts` 和 `material-structure-search.ts` 为分代分块与资料页增加查询索引。旧库后台逐份检查已发布版本。旧快照缺少对应正文、空正文或 JSON 损坏时，保留原可见分块并记录待重建原因。原生 Word 正文沿用原分段。个人信息和 AI 还原正文继续使用原有独立准入规则。

## 修改前后

| 五三主书第 12 题 | 上一版桌面构建 | 本轮最终构建 |
| --- | --- | --- |
| 关键词与混合检索的原文精确命中 | 各 3 个 | 各 1 个，包含原有两处印刷填空 |
| 旧正文摘录 | 有两个旧版本 | 两条旧引用均按原 ID、内容和偏移回读 |
| 正文索引记录 | 3 条 | 1 条，重建、重启均保持 |
| 启动后一次桌面 IPC 查询 | 关键词 126 ms，混合 1,895 ms | 关键词 13 ms，混合 614 ms。重启后分别为 13 ms 和 1,719 ms |

计时使用上一版与新版本的独立旧库副本，混合查询均启用本地语义分支。每次只测一个实物题干，耗时受启动、索引和计算负载影响。整库性能仍以独立规模验收为准。

## 测试

| 命令或脚本 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/build-structure-search-release` | 最终冻结构建通过 |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/education/structure-bank-handoff-electron.mjs` | 最终构建 5/5。教师使用目录查题并打开新版正文、触发重建，随后验证冷启动、旧版引用、历史题本草稿、结构快照和答案回执原始数据。本轮新增模型请求 0 |
| `node scripts/material-catalog-focused-test.mjs` | 17/17。真实 SQLite、FTS 和向量范围校验 |
| `kb-search-statistics-boundaries.mjs` 与 `kb-retrieval-boundaries.mjs` | 7/7 与 18/18。覆盖旧 FTS 残留、失败发布、原生 Word、隐私计数、查询中切换以及向量删除记录 |
| `structure-review-boundaries.mjs` 与 `document-structure-repository.mjs` | 18/18 与 39/39 |
| `kb-ai-page-boundaries.mjs` 与 `kb-structure-book-boundaries.mjs` | 249/249，结构配答 17/17、兼容配答 36/36 |
| `kb-semantic-native.mjs` | 8/8。实际 BGE ONNX 与 Lance 验证 |
| `node scripts/electron-smoke.mjs` | 发布候选构建 207/207。最终归档写事务额外校验由最终冻结构建的专项及真实界面覆盖 |
| `npm audit --omit=dev --audit-level=high` | 23 项现有依赖通告，含 8 项 high。依赖文件无变更 |

脚本在 `apps/desktop` 执行。TypeScript 专项用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/<脚本>`。真实桌面专项将 `EDU_HANDOFF_SEED` 指向旧验收临时库，用 `OMNI_EDU_TEST_BUILD_ROOT` 选择冻结构建，复制文件和 SQLite 快照至独立临时目录运行。检索专项核对答案回执的存储内容，复制后的回执仍受原文件物理身份约束。

## 验收与回滚

本项缺陷通过验收。历史正文仍用于资料阅读和原引用回查。旧库首次迁移逐份完成，损坏或缺失存档可从资料详情发起结构重建。独立出版物留出集的召回率、约 10 GB 混合库、正式组卷和迁移仍待验收。

升级添加的状态列与发布记录属于派生数据。需要退回旧实现时，保留最新 SQLite 与原件备份。在隔离副本上使用升级前快照验证，或在保留后续教师改动的前提下重建旧版全文与向量索引。原件、历史引用和教师题目通过既有数据库与文件备份保护。
