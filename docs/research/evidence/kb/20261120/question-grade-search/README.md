# 题库检索的年级别名

教师可在题本和小智题库检索中使用「高三」「高中三年级」「高3」等同级名称。按「高中」筛选会同时检索已标为高中和明确的高中年级。具体年级结果保留原来保存的标签。

## 根因和修改

真实旧库保存的高三题有「高三」标签。先前在题本的 SQLite 查询、Lance 向量预筛和 SQLite 读回之后的检查都要求字符串相等，三个入口都会排除「高中三年级」的请求。同一个知识点和题干，换简称即可命中。

- `src/shared/question-grade.ts` 定义有界标签组，覆盖全称、简称、半角数字和全角数字。只在查询时展开。具体年级只取同级，学段取明确属于它的已知标签。「六年级」这种跨学制可能有歧义的标签保留单独范围。未知标签按原字符串查找。
- `src/main/education/question-retrieval.ts` 在排序和分页之前绑定年级集合，题本、词法候选及补答搜索共用该条件。
- `src/main/retrieval/vector-store.ts` 在向量候选限制前应用同一组标签。`src/main/retrieval/repository.ts` 在候选扩张期间及完整题源复查时再次检查当前年级，避免邻级旧候选挤满首个窗口。其他条件、题源版本和隐藏规则照常校验。
- `src/main/xiaozhi-agent/pi-session.ts` 保留教师明确指定的年级。空结果可缩短题干检索词或移除非必需条件。

SQLite、Lance、BGE、typed IPC 和 Pi 工具沿用当前实现。本轮没有新依赖、索引格式变更或数据迁移。

## 同一资料库的前后对比

使用上海六份学年试卷的已导入快照。SQLite 只读核对了 7 道已有合格归档的高三物理题。在对应知识点下，「高三」「高中三年级」「高３」逐组返回相同的题 ID 和排序。该组题来自已使用的试导库，用作针对本缺陷的回归样本。

两个自然检索主题在真实桌面题本中分别检查了同级命中、相邻高二拒绝及本地混合候选。测试复制原件与事实库，保留真实语义索引。保存的题面、答案、解析、题源标题和年级逐值核对一致。新增付费模型调用 0。

| 真实题源查询 | 关键词结果旧版 → 本轮 | 混合结果旧版 → 本轮 | 操作耗时旧版 → 本轮 |
| --- | --- | --- | --- |
| 光子能量与光的频率 | 0 → 1 | 0 → 1 | 关键词 65 → 111 ms，混合 1,396 → 1,400 ms |
| 静电场中的等势面 | 0 → 1 | 0 → 1 | 关键词 69 → 72 ms，混合 310 → 61 ms |

两次本地混合搜索均命中了实际向量候选。这些是同一机器、两个独立数据副本的单次界面操作耗时，包含界面等待和模型冷启动。整库性能仍需用独立大样本测量。

## 回归范围

命令从 `apps/desktop` 执行。TypeScript 专项以 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs` 启动。

| 脚本 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/build-grade-search` | 构建与类型检查通过 |
| `npm run test:renderer-components` | 253/253。静态 SSR 测试关闭监听和热更新后通过，原断言全部保留 |
| `node scripts/electron-smoke.mjs` | 同一冻结构建综合桌面冒烟 207/207，覆盖两个视口 |
| `kb-grade-search-electron.mjs` | 两自然检索主题均通过旧版复现和修复后桌面验证 |
| `kb-chinese-question-recall.mjs` | 8/8。FTS、显式扫描、无文本筛选、学段方向、年级边界 |
| `kb-retrieval-boundaries.mjs` | 19/19。相邻年级占前 110 个结果时继续查到有效候选 |
| `kb-retrieval-number-scope.mjs` | 9/9。题号与范围仍可组合，题源变化拦截 |
| `kb-semantic-native.mjs` | 9/9。真实 ONNX 与 Lance，原始标签、多种写法、跨年级排除 |
| `kb-question-search-continuation.mjs --with-existing-boundaries` | 50/50。含 Pi 的结构筛选、候选分页、题源读回和权限边界 |
| `npm audit --omit=dev --audit-level=high` | 存量 23 项，8 项 high。依赖文件未变更 |

真实桌面专项为 `node scripts/education/kb-grade-search-electron.mjs`。设定 `EDU_GRADE_SEED` 指向已有校验用本地资料库目录，`OMNI_EDU_TEST_BUILD_ROOT` 指向冻结构建。上一版加 `--baseline` 参数以确认旧结果。

组件门禁首次和原配置复跑均在加载已有 CSS 时超时。关闭文件监听的单组件探针成功后，`scripts/renderer-component-state-test.mjs` 为静态 SSR 测试关闭文件监听和热更新，完整组件门禁随后通过。

## 边界与回滚

当前证据覆盖题本、小智检索共享条件和本地向量。正式组卷仍有独立的年级严格匹配。用同两道真实题调用生产分区规则，「高三」通过 2/2，「高中三年级」通过 0/2。下一轮从真实组卷蓝图和题篮接通该断点。KB-A05 的 200 条独立自然标注搜题、约 10 GB 批量导入、正式组卷全程和安装换机仍按原目标验收。

通过正常 Git revert 回退查询逻辑。原题、源文件、答案回执和保存的向量字段可直接继续使用。
