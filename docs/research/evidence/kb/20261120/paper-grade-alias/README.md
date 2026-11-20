# 正式组卷的同级原题

教师可在蓝图写「高中三年级」，选择题库中标为「高三」的原题。自动扫描、手选题篮和保存试卷回读共用同级匹配。相邻年级和学段标签分别限定范围，生成题仍使用原审批绑定的年级。

## 修改

- `src/shared/question-grade.ts` 提供同级别名，保留检索的整个学段展开。正式组卷限定同级，学段只匹配该学段的同义标签。
- `src/main/db.ts` 在 SQLite 候选分页前绑定原题年级范围，继续保存原标签。错题相似入口仍传原年级。
- `src/main/education/paper-selection.ts` 同步选题、题篮分区与确认后读回条件。来源、题型、难度、知识点、去重、版本和审批继续使用原规则。
- `scripts/renderer-component-state-test.mjs` 为静态回归显式提供 PostCSS 配置，保留 CSS Modules。默认配置加载曾超时，完整组件断言随后通过。

## 真实桌面验证

上一版和本轮使用同一旧资料库的独立副本。自动蓝图通过桌面控件操作，手选题篮通过现有 typed preload 实际建篮、核对分区和加入。

| 验证项 | 上一版 | 本轮 |
| --- | --- | --- |
| 「高中三年级」筛选两道标为「高三」的教师录入测试题 | 0/2，确认禁用 | 2/2、10 分，集中确认和冷启动读回 |
| 年级对照 | 「高三」2/2 | 「高二」反例 0/2 |
| 手选题篮 | 按字面年级匹配 | 两题逐个命中指定分区，原题版本入篮 |
| 旧库两道真实物理题 | 遍历 0 条高三候选 | 遍历 17 条候选，两道目标题通过范围初筛，原件身份复查仍报缺额 |
| 单次同义蓝图操作耗时 | 188 ms | 146 ms |

计时来自两个副本的单次操作。旧题逐值保持，新增付费模型调用 0。教师录入的两道测试题用于确认流程和来源边界。

真实物理题为光子能量与光的频率、静电场中的等势面。原文件 SHA、PNG 摘要、Word 定位和持久输入回执均通过只读核验。原测试库中的文件 stamp 与归档一致，复制库均不同。生产 `validateOriginalInput` 要求物理身份一致，合法复制也被阻拦。下一轮处理可验证的历史只读迁移，并回归篡改、并发替换和生产派发的约束。

## 回归与回滚

| 命令或脚本 | 结果 |
| --- | --- |
| `npm run build -- --outDir test-results/build-paper-grade` | 类型检查和冻结构建通过 |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/electron-smoke.mjs` | 同一冻结构建 207/207 |
| `kb-paper-grade-electron.mjs` | 真实旧版对照和新版验证，含冷读、入篮、历史来源门禁 |
| `paper-basket-boundaries.mjs` | 44/44，覆盖同级别名、学段、生成审批和历史确认 |
| `paper-fulfillment-boundaries.mjs` 与 `paper-whole-edit-boundaries.mjs` | 6/6 与 8/8 |
| `kb-chinese-question-recall.mjs` | 8/8，查题的学段展开回归通过 |
| `npm audit --omit=dev --audit-level=high` | 存量 23 项，8 项 high。依赖文件无改动 |

已合入 GitHub 主线协作者的 `1d4e8ad`。合并带入 Harness 验收脚本与项目记录，桌面产品源码和配置与受测构建一致。合并后的协作脚本另经语法检查。

在 `apps/desktop` 用 `OMNI_EDU_TEST_BUILD_ROOT` 选择冻结构建并执行 `node scripts/education/kb-paper-grade-electron.mjs`。复用 `test-results/kb-grade-search-after-electron.log` 指定的临时验收副本，加 `--baseline` 执行旧版对照。TypeScript 回归使用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs`。

可通过 Git revert 回退查询。已保存同义年级试卷使用支持本规则的版本回读，回退前保留数据库备份。三套真实整卷及导出、独立检索留出、约 10 GB 混合库和换机继续按 KB-A01～A10 验收。
