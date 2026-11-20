# 原生 Word 题迁移后的来源读取

备份恢复时，原件路径和物理文件标识会变化，原文件与题图的内容可能保持一致。旧逻辑在读取已归档的原生 Word 题时，继续要求文件标识与首次模型任务一致，两道真实题因此在正式组卷中报来源不可用。

## 修改和来源边界

- `material-ai-repository.ts` 的原生转写入口区分读取、发表与编辑。只有已归档题通过冻结回执读取时，可对新物理标识重新验证完整文件 SHA 和资源版本。全文定位、首次和末次结果、原图、隐私与当前事实检查照常执行。
- `material-repository.ts` 与 `db.ts` 复用基于现行文件标识的哈希缓存。读取结束前重查本次确认的标识。文件变化后重新计算摘要。原份文件、冻结 AI 输入和题库行均按原值保存。
- `native-question-repository.ts` 明确标记编辑用途。原生产任务的首次派发和继续执行、原生发表及教师改写仍要求原文件身份。迁移后的读取能力可用于组卷和历史题图查看。

## 真实桌面前后对比

同一历史试导库使用生产恢复代码 `relocateBackupDatabase` 将路径映射至两个临时副本。教师从桌面用「高中三年级」蓝图选择「光子能量与光的频率」「静电场中的等势面」两道真实原生题。

| 证据 | 旧版 | 本轮 |
| --- | --- | --- |
| 自动选题 | 0/2，来源不可用 2 | 2/2，来源不可用 0，集中确认 10 分 |
| 原题与原图 | 选题停在来源校验 | 两个题版本和两张题面 PNG 通过摘要校验，冷启动仍可读 |
| 同长度原件被修改 | 原件身份失败 | 图片读取与试卷确认拒绝，原文件恢复后通过 |
| 操作耗时 | 233 ms，短路返回缺额 | 1,453 ms，含原件、回执、图片和组卷验证 |

耗时为同环境各一次真实桌面操作，执行工作量不同。历史题行、原始 AI 输入和确认卷在冷读前后逐值核对一致，新增付费模型调用 0。备份包创建、激活、干净系统安装和不同盘符恢复仍需完整验收。

## 回归

| 命令或脚本 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/build-native-relocation` | 类型检查与冻结构建通过 |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/electron-smoke.mjs` | 同一冻结构建 207/207 |
| `kb-paper-grade-electron.mjs` | 真实历史副本回读、集中确认、原图、篡改拒绝、编辑拒绝和重启通过 |
| `kb-native-dispatch-boundaries.mjs` | 17 项原回归和 2 组迁移专项。含同次读中替换、编辑、发表与待派发回归 |
| `kb-native-ledger-boundaries.mjs` | 20/20，正式 SQLite 和持久原图回执。补齐测试夹具的事务写入接口后通过 |
| `kb-native-brain-boundaries.mjs` 与 `kb-native-office-boundaries.mjs` | 5/5 与 3/3 |
| `kb-ai-page-boundaries.mjs`，`kb-structure-book-boundaries.mjs` | 249/249，结构配答 17/17、兼容匹配 36/36 |
| `kb-backup-boundaries.mjs` | 4/4，实际 SQLite 快照、文件摘要和锁定派生索引 |
| `npm audit --omit=dev --audit-level=high` | 存量 23 项，8 项 high。依赖文件无改动 |

从 `apps/desktop` 运行脚本。使用 `OMNI_EDU_TEST_BUILD_ROOT` 指向冻结构建，执行 `node scripts/education/kb-paper-grade-electron.mjs`。脚本复用 `test-results/kb-grade-search-after-electron.log` 中的本地验收副本。对旧版用 `--stamp-baseline`，需查验同级录入回归时用 `--grade-control`。TypeScript 专项用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs`。

## 剩余范围和回滚

同一恢复库中，「欧姆定律与电功率」的 PDF 裁题从正式 `getMaterialAiPage` 入口仍返回 `source_changed`。下一轮核对页、裁图与冻结回执，只恢复可证实的历史读取。正式三套整卷的图文导出、独立检索指标、约 10 GB 混合库和完整换机仍按 KB-A01～A10 验收。

本轮无需数据迁移。用 Git revert 回退读逻辑，保留原件、回执和正式确认记录。回退后，迁移库中的旧来源仍需要支持重定位认证的应用版本回读。
