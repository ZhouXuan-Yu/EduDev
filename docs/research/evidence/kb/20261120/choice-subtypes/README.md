# 原题题型检索与正式选题

## 根因与修改

试导库已有完整来源的 6 道物理题保存为“单项选择题”。旧版正式选题只把蓝图“选择题”与题库“选择题”或 `choice` 视作同一题型。SQLite 和语义索引还要按字面筛选，导致明明有原题，按通用条件也可能漏查或报缺额。

- `src/shared/question-type.ts` 定义已知的选择题标签。通用选择题允许单选、多选和不定项。指定子类时只匹配该子类的明确标签。
- `src/main/education/paper-selection.ts` 让原题篮和自动选题使用这套范围，继续核验原件、年级、知识点、难度、答案角色和去重。
- `src/main/education/question-retrieval.ts`、`src/main/retrieval/vector-store.ts` 和 `src/main/retrieval/repository.ts` 在关键词筛选、向量筛选及回查 SQLite 当前事实时使用同一规则。保留已存题型，无需重新嵌入或改写事实。

## 修改前后

| 场景 | 旧结果 | 本轮 |
| --- | --- | --- |
| 此快照中，物理、高中、AI 定稿、“选择题”元数据筛选 | 3 条 | 9 条 |
| 同一范围用“单选题”检索 | 0 条 | 6 条 |
| 同一范围用“多选题”检索 | 0 条 | 0 条 |
| 六部分、每部分限定已有原题的知识点与难度、题型为“选择题” | 字面题型不符，这 6 道不能进入分区 | 实际电子应用选入 6/6，全部通过题源读取，教师确认后重启可读 |

前 3 行是同一真实试导库的只读 SQLite 条件对照，包含一条在此前审计中未过正式静态门槛的普通选择题。第 4 行使用相同题库的隔离副本，通过正式导航、自动组卷和确认。6 道原题出自同一份历史试卷，保留实际导入时的题型及首稿、末稿和图片回执。测试中的教师确认由脚本代理执行。

## 验证

命令从 `apps/desktop` 执行。定向脚本以 `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/<脚本>` 启动。实页脚本要求显式指定已经授权的本机试导库 data 目录。

| 测试 | 结果 |
| --- | --- |
| `kb-chinese-question-recall.mjs` | 9/9，旧实现可复现通用条件漏查三个子类。覆盖有无 FTS、主题和题型精确筛选、字面输入 |
| `kb-semantic-native.mjs` | 10/10，真实本机固定 BGE 与 Lance；期间出现一次 Lance 版本提示文件访问警告，过滤及回读断言通过 |
| `kb-retrieval-boundaries.mjs` | 19/19 |
| `paper-basket-boundaries.mjs` | 45/45 |
| `kb-choice-subtypes-electron.mjs` | 自然题 6/6。通用及单选检索命中，多选排除，实际 30 分练习卷确认后冷启读回，历史回执和请求总数不变，新增请求 0，渲染错误 0 |
| `npm run build -- --outDir test-results/build-kb-choice-subtypes` | 通过。实页构建 SHA-256 为 `6388318824e41cefcc1acc10c74bf8e7a787db67019915e2a7dfcec3e462afaa` |
| `npm run test:renderer-components` | 253/253 |
| `npm audit --omit=dev --audit-level=high` | 23 项存量通告，其中 high 8 项、critical 0 项，依赖未变 |

真实试导库上各预热 20 次、测量 100 次。普通选择题元数据查询 P95 由 0.084 毫秒变为 0.093 毫秒。Electron 此次组卷至预览约 1.411 秒。查询对照只含 SQLite 元数据筛选，整卷为单次测量。

## 剩余与回滚

本轮使既有 6 道题从通用分区漏选恢复到实际可选，题库行数和审题状态未增加。没有把生成题重新标为单选或多选。独立自然准确率、真实跨来源混合检索、三套正式卷导出、约 10 GB 持续后台与换机仍按原合同继续。

已存 120 道 AI 题中，22 条 Word 归档只因题面完整性待核。对照新版来源后有 7 条归档记录的源结构已无解析疑点，涉及 6 份资料，旧版多包含卷首说明。仍需相同原页范围、题干、图表、两次回执及答案的独立证据，其中两条新增识别了独立原文答案。另一批 14 条归档仅保存“高中”，冻结原件上下文却明示具体年级，需在原件绑定下恢复分类，保留存在的其它疑点。

无需数据库迁移。可用普通 Git revert 回退筛选规则；已确认卷保留原题事实和课目记录。
