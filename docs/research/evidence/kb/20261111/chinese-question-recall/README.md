# 连续中文题库检索与候选截断

## 本轮合同

M04/M05。上一轮实际Pi五组连续或多词关键词未召回，单独“单摆”才命中同一已自动归档题。修复现有SQL关键词候选链路，覆盖题本共享谓词、小智检索和已有语义结果融合的词法候选。复用标准Intl.Segmenter的zh-CN word分词、原SQLite FTS5 trigram及原混合检索/RRF，不添加中文词典、服务、事实表或IPC。

先保留原短查询词，再对其中连续中文作有界分词扩展，紧邻的中文单字词组成的多字片段仍可作为关键词，单字符查询与原公式/百分号/下划线按原字面语义。全部SQL值绑定，原始查询及来源事实不改。先按全词组与关键词覆盖排序，再LIMIT，学科、年级、题号、来源类型等硬条件及候选来源隐藏保持原规则。题本保留其既有收藏/使用排序，匹配谓词同步获得分词能力。

修改范围为question-retrieval.ts与新增定向回归，必要时仅现有db调用的最小适配。原typed preload、renderer入口、Pi runtime及SQLite/文件真源沿用。无新依赖和数据迁移，正常revert可回滚，索引可重建，原回执和业务题不改写。

验收包括实际SQLite compact中文命中、旧相关题不会被大量新低相关题挤出、indexed/scan一致、所有硬条件在LIMIT前、字面转义与Unicode边界、有界参数、旧索引插入/更新/删除以及既有题号/原生题安全回归。build、246组件和实际新冻结Electron题本与Pi检索实读同一自动题。保留上一轮失败轨迹，与修复后同词查询对比，不以一组自然查询推断全库召回指标。性能给出同一事实快照修复前后耗时和查询计划，原扫描fallback边界继续披露。

资料范围继续为当前221份，归档暂停、原后台AI继续。完整Goal ACTIVE。新任务不重发前轮OCR/付费题批次，不重复四份已有导出。

参考标准为 [ECMA-402 Intl.Segmenter](https://tc39.es/ecma402/#segmenter-objects) 及 [SQLite FTS5 trigram](https://www.sqlite.org/fts5.html#the_trigram_tokenizer)。没有新许可证、安装体积或Windows外部组件。

## 已实现与真实效果

前轮主线推进并修复两项自然缺陷，属于progress。本轮关闭实际连续中文漏召回，同时修复多关键词候选被更新时间挤占。变更为生产question-retrieval.ts一份、定向新回归和既有索引回归fixture一处。没有新依赖或数据迁移。

同一3078条题目事实的只读SQLite快照，保持物理/高三/limit8和隐藏被覆盖来源候选。三个查询“单摆周期与振幅”“单摆周期”“单摆振幅”由0命中变为同一自动原生题。原空格查询和“单摆”仍命中同一题。没有改题、重发OCR或重新组卷。

最终冻结Electron main入口SHA256 `25f39bbcd957cbca300e65ef23e22f4bd8276acd98479667f824e2f8b6fd6583`，沿用当前真实profile/data与221份已导入资料。正式题本输入完整查询命中，物理/高三过滤下“按题意查找”也命中，实际入口约204ms，显示语义暂不可用并明确结果为关键词、内容整理未完成。此次只证明词法fallback修复。

真实Pi使用同一完整查询词和过滤条件，第一次education_search_questions即1命中，随后education_read_question实读原题号7、答案C和来源。共3次真实DeepSeek请求，整轮约14.5s。工具执行时间检索422ms、实读157ms，来源questionId与版本和前轮相同。原图仍留本地，返回依据为AI转写。原失败轨迹仍在word-native-retrieval.json，修复后在chinese-native-retrieval.json/summary.json，没有结果替换或模型mock。

### 定向验证

命令均从 `D:/WorkProject/EduProject-kb-isolation/apps/desktop` 执行，输出位于 `D:/WorkProject/EduProject-kb-run/flow-1gb-20261111`。

| 命令 | 结果 |
| --- | --- |
| `node --experimental-transform-types scripts/education/kb-chinese-question-recall.mjs` | 修改前首项FAIL且保留日志；修改后7组PASS，chinese-recall-before/after.log |
| `node --experimental-transform-types scripts/education/kb-retrieval-number-scope.mjs` | 9组PASS，chinese-number-scope.log |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-question-search-continuation.mjs --with-existing-boundaries` | 50组PASS，原索引写入/回滚、别名/游标、Pi上下文及文档边界，chinese-existing-boundaries-final.log |
| `node --experimental-transform-types scripts/education/kb-source-origins-boundaries.mjs` | 13组PASS，来源覆盖/教师保护/筛选及坏记录隔离 |
| `npm run build` | typecheck及构建PASS，chinese-build.log |
| `npm run test:renderer-components` | 246/246 PASS，chinese-renderer-components.log |
| `npm audit --json` | 已有28项，8high/12moderate/8low，未新增依赖；chinese-npm-audit.json |
| `git diff --check` | PASS |

首次continuation直接运行缺静态import前的扩展名loader，改用仓库现成--import预加载后执行。启用既有边界时，旧“新增检索锚点→替换检索锚点”的零命中断言因有效部分词匹配而失败。将替换fixture改为完全不同知识点，全部原写入、更新、回滚、删除断言保留，随后50组通过。初次失败日志保留，没有删除零命中断言或索引一致性验证。

自然UI脚本 `test-results/corpus-flow-1gb/chinese-ui.mjs`、`chinese-semantic-ui.mjs`、`chinese-retrieval.mjs` 与本地结果JSON/截图保留，截图含原题仅存仓库外。此次未重复旧整卷导出及共享207项Electron全量。renderer未修改，新的实际操作在1366宽度执行，1920未重跑。

### 同快照性能与限制

`node --experimental-transform-types test-results/corpus-flow-1gb/chinese-perf.mjs`对同一只读事务先预热2遍、再10遍均值，基线固定6aa0f66。精确结果在chinese-actual-sql-comparison.json，计划在chinese-query-plans.json。

| 查询 | 修复前ms | 修复后ms | 修复前/后命中 |
| --- | --- | --- | --- |
| 单摆周期与振幅 | 0.96 | 2.52 | 0/1 |
| 单摆周期 | 1.19 | 2.68 | 0/1 |
| 单摆振幅 | 1.15 | 1.92 | 0/1 |
| 单摆 周期 振幅 | 1.76 | 1.64 | 1/1 |
| 单摆 | 0.94 | 1.65 | 1/1 |

增加分词和相关度排序带来约0.7–1.6ms局部开销。SQL计划继续使用学科索引/原FTS LIKE通道与现有来源门禁，排序仍需临时B树。两字词按既有短词LIKE fallback扫描，宽查询仍可能扩大候选。本次不证明10GB性能、高召回指标、同义词/数学等价、多书质量或整库完成，语义索引恢复与短词索引优化继续OPEN。ICU为当前Electron内置组件，无新增下载体积或许可证。

### 运行恢复与后续

已在无dispatched AI单元时通过原控制器关闭，复制唯一冻结构建后重启同一批次。实际UI/真实Pi完成后恢复原folder AI，目录归档保持paused。2026-11-11T11:02:01Z状态running，调用299次、renderer错误0。控制器PID186080/工具会话57515，Electron178428，仅供定位，继续前须核对run-state.json与进程。完整Goal ACTIVE。

下一优先旧v1 Word的自动后台升级与图文公式成熟转换、当前待核原因的实质修复，然后继续完整质量/检索基准与安装迁移。回滚用正常revert本轮提交，查询语义返回原版本，原题/文件/回执和索引事实无需迁移。

## 收尾发现

实际typed preload getRetrievalStatus回读为available=false、phase=building、indexed=0、pending=8893、error=index_unavailable，模型版本bge-small-zh-v1.5.q8.cls-l2.window512-stride64.v1。状态保存chinese-retrieval-status.json。词法修复可独立生效，语义索引属于下一项优先实质阻断，须查明受管组件/索引启动并恢复现有队列，随后再处理旧Word后台升级。不得把这个状态写成“向量库已正常检索”。
