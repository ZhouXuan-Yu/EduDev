# 结构草稿按原卷小节归档题型

## 根因与修改

自动归档只读取第一个正文块的 `questionType`。该字段可能为空，也可能覆盖整页或多个小节。真实 Word 的填空题小节因此继承了同一正文块中的“选择题”。

- `material-structure-question-type.ts` 复用印刷小节语法，并验证候选状态和选项结构。通用“选择题”保持通用，只有小节明确区分时才写单选或多选。
- `material-question-archive.ts` 在自动归档时优先采用印刷题型。旧草稿按现有结构归档键索引分批处理，每批最多 16 条。原件和冻结结构须通过验证，写入时检查当前发布代、题目版本、教师活动、答案册角色和文件标识。已存在的旧题型须与最初引用的正文块类型一致才可更正。
- `material-structure-numbering.ts` 提供现有小节匹配，编号规则继续依同样的匹配语法运行。
- `document-structure-boundaries.mjs`、`kb-printed-types-boundaries.mjs` 和 `kb-printed-types-electron.mjs` 分别覆盖版面、旧稿后台写入边界及真实桌面。

补齐只更新题型、对应的缺失标记及修改时间。文字、裁图、原件、答案、解析和审核记录保持。历史修复范围为当前发布世代中未被教师接管的可见结构草稿。

## 真实对比

在既有 221 份资料的隔离副本运行，批次后台状态为 5 份部分完成、1 份已交接、215 份待处理。旧构建实际复现 8 条错误，新构建自动处理同一库。

| 来源 | 旧构建 | 新构建 |
| --- | --- | --- |
| 2024 上海初中数学试卷 PDF | 4 条题型空白 | 3 条选择题、1 条填空题 |
| 2022 上海中考数学真题 Word | 填空小节 4 条错标选择题 | 4 条填空题 |

8 条均经桌面题本和现有预加载接口读回，正确题型能筛出，另一题型筛不到。题文档与冻结候选一致。2 条已核题保持一致。应用重启后改动仍可读。正式检索新增 0 题，8 条仍待核，答案与解析需要各自的证据。模型调用计数未增加。

第一次实现以全体归档行扫描，35 秒内未到达实际候选。隔离库有 3,103 条归档成员、21 条结构成员。改用结构归档键的主键索引范围后，只扫描 21 条结构成员，两批跨过这一规模。专项并发反例确认单个原件不可读时后续仍可处理，并保护教师编辑及认证期间发生变化的原件。

## 验证命令

在 `apps/desktop` 执行。桌面主进程构建 SHA-256 为 `ef5ac902bb4cdad2727e6022c85df277ce023c24b2274b616a19302bbe6c8b53`。

- `npm run build -- --outDir test-results/build-kb-printed-types-final`
- `npm run test:renderer-components`，253/253。
- `node --experimental-transform-types scripts/education/document-structure-boundaries.mjs`，48/48。
- `node --experimental-transform-types scripts/education/kb-printed-types-boundaries.mjs`，12/12。
- `node --experimental-transform-types scripts/education/kb-structure-book-boundaries.mjs` 和 `node --experimental-transform-types scripts/education/document-structure-repository.mjs`，通过。
- `node scripts/education/kb-printed-types-electron.mjs <既有隔离目录>`。旧构建加 `--baseline`。已迁移的同一隔离库使用 `--verify-existing` 验证保存在真实题本的结果和冷启读取。
- `node scripts/electron-smoke.mjs`，使用最终构建的独立测试目录运行，207 项前端检查通过。
- `npm audit --omit=dev --audit-level=high`，既有依赖报告 20 项，其中高危 5 项，本次未改依赖。

## 后续与回滚

同册 Word 的参考答案区已被定位。现有原生配答器只处理两行表格，连续排印的选择题答案未进入题源。后续扩展需保留精确字符定位、同卷与唯一题号门槛及已保存回执的兼容性。真实独立物理答案册已有题册对应候选，历史 AI 回执未冻结为答案角色，仍需独立角色版本。

回滚可恢复原归档程序，已有题型保存在兼容的 SQLite 字段，原始资料与结构仍可读取。如需撤销已验证副本中的自动更正，可从变更前备份恢复该副本。

本轮完成印刷题型的入库与存量纠正。自然题质量、独立检索、三套正式卷、约 10 GB 混合导入和跨机迁移继续按原标准验收。
