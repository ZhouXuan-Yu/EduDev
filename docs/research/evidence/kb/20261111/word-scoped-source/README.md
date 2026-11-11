# Word资料警告范围与题前元数据

## 本轮合同

M02/M03/M05。当前148份真实DOCX的4528条原生候选全部受到文档source_warning及shared_context影响。修复通用来源表示，让清晰题目可以进入已有按题DeepSeek/OCR流程，继续保留真实图文、答案与歧义。

计划在word-ooxml.v2保存段落/表格警告及文档级未定位警告。v1继续读取并按旧题目索引重建，v2新来源冻结word-question-scoped.v2。仅保守识别的纯文本标题、分类、日期和题型标题作为资料上下文保存，条件性文字、图、公式、未知结构继续原保留/待核规则。renderer仍走现有Word按题查看、图文重整与AI整理入口，typed preload及业务真源沿用。

将修改共享Word类型/校验、解析器、WordRepository读写版本、题目来源索引与原生AI上下文，相关实际源码测试和正式Electron入口。没有新依赖和新表。解析升级通过已有“重新整理Word图文”原子入口执行，失败/取消保留旧表示。旧AI回执不改写，新旧输入依来源摘要绑定，已确认旧题继续旧记录，重建引起来源变化时保留原拒绝语义。

通过条件为原文警告继续可见，其他题的局部警告不会错误污染清晰题，缺图/缺公式/修订和真实共享条件继续阻断自动定稿，历史v1来源可冷读，源变化/伪造范围被拒绝，实际DOCX从正式重整与按题入口进入既有OCR/真实DeepSeek，并读回题面、图、答案与明确疑点。未达成的自动内容质量如实列出，完整Goal保持ACTIVE。

性能比较使用相同原件解析/索引计时与题目表示大小，按本轮变化定向回归。回滚使用正常revert，保留原DOCX和历史JSON/回执，v2读取兼容须随回滚使用对应版本。运行数据在仓库外保存。

## 实际运行追加缺陷

同一当前目录的真实Word通过原重整/按题入口完成OCR与两次真实DeepSeek，题面和答案清楚，但模型在projection.formulas加入了原题未给的推导等式。原响应不改。增加原生题的公式来源完整性校验，独立公式字段须出现在题面、图义或表格转录中，派生答案保留在answer/analysis。历史结构记录继续可读，资格校验拒绝这种未说明来源的公式，不以两遍相同判为通过。当前实例尚未正式确认该题的试卷，修复后选用另一道自然题继续真实验证。

## 本轮结果

已修复两项通用缺陷。Word局部警告过去污染全文候选，v2现在保留文档汇总并将可定位警告绑定段落/表格，未知警告仍全局阻断。AI把推导等式写进题面公式字段时，新增原生完整性检查，历史记录仍可读且失去自动组卷资格，界面显示待核原因。

原OOXML解析、Word重整/按题入口、OCR、DeepSeek两遍处理、题本、蓝图、Pi与Office审批复用现有实现。没有新依赖、表或IPC。v1读取及旧来源摘要兼容，升级通过已有Word重整入口原子执行。

### 当前自然流程

运行数据目录为 `D:/WorkProject/EduProject-kb-run/flow-1gb-20261111`，原目录归档继续暂停在221份、328203104B。单独选一份已经导入的Word，通过实际“题目与校正→重新整理Word图文”升级，并实际启动两道不同题的AI整理，共4次DeepSeek调用。

第一道库仑题原始首/最终响应一致，答案A，但公式字段混入推导。原记录/回执完整保留，新增校验和实际新界面均确认其失去组卷资格。失败原截图和原始响应没有删除，也没有重发这道题充作修复效果。

第二道单摆题由OCR与两次真实DeepSeek自动整理，年级高三、答案C、题面公式字段not_applicable、推导保留于解析。未经手工改题，自动定稿成为组卷候选。已核对本地源题图和题文/选项，正式蓝图按高三物理/单摆/选择题选中1/1题，经代理在测试中操作整卷确认与图像审批，真实Pi导出学生与教师PDF各1份。完整题库和教师教学正确性验收继续OPEN。

学生PDF 97759B，教师PDF 117719B，均1页A4。独立回读核对各1张源图的像素、教师答案/解析完整、学生卷排除解析，随后查看实际渲染页。两个文件事实、SHA、确认快照谱系一致。详细本地证据为 `word-deliveries.json`、`word-export-readback.json`、`word-native-ai-live.json`、`word-formula-ui.json`，第二题原始回执在SQLite保存。

真实Pi题库检索/读题完成，最后“单摆”命中该自动题并实读原题、答案和来源。此前五组组合关键词均0命中，当前语义索引仍建立中，多词召回仍有明显不足。本次没有把原图传入Pi，读题结果明确显示AI转写和图片边界。原始轨迹保存在 `word-native-retrieval.json`，不将最后命中推广为召回达标。

### 验证与保留失败

命令从 `apps/desktop` 执行，日志保存于上述运行目录。

| 命令 | 结果 |
| --- | --- |
| `npm run build` | 含typecheck通过，word-formula-build.log，最终可读性整理后word-final-build.log另记 |
| `npm run test:renderer-components` | 246/246，word-final-renderer-components.log |
| `node --experimental-transform-types scripts/education/kb-word-question-boundaries.mjs` | 29组，word-scoped-final.log |
| 同命令前缀，`kb-word-boundaries.mjs` | 14组 |
| 同命令前缀，`kb-native-question-boundaries.mjs` | 9组 |
| 同命令前缀，`kb-native-dispatch-boundaries.mjs` | 3组 |
| 同命令前缀，`kb-native-office-boundaries.mjs` | 3组 |
| 同命令前缀，`kb-native-brain-boundaries.mjs` | 5组 |
| 同命令前缀，`kb-native-ledger-boundaries.mjs` | 20组，word-native-ledger-final.log |
| `node scripts/education/kb-word-journey.mjs` | 5项、3次启动、1366/1920、renderer错误0，适用scoped版本构建b39cd590；合成Word入口与恢复证据 |
| `python scripts/education/verify-paper-export.py <实际产物目录> <word-export-readback-expected.json> <运行目录>` | 2份通过，源图像素和文本角色检查 |
| `npm audit --json` | 28项已有漏洞，8 high/12 moderate/8 low，未引入新依赖 |

首次裸数字日期识别过宽的回归失败已修正，裸数字保留共享条件。ledger测试首次因旧fixture缺teacher_resources和archive_json失败，仅补齐fixture依赖后20组通过。局部性能脚本首次缺扩展名加载器/错误路径列失败，改用仓库既有source loader及实际local_path后完成，属于验证脚本修正。历史失败日志留在本地。

### 范围与性能

旧持久化诊断148份Word/4528候选，全部受source_warning/shared_context影响。新解析器只读诊断148份/4541候选，初版元数据规则89份候选无来源问题。严格裸数字修正使其中6份继续待核，当前可明确的上界为83份候选，尚未逐份升级或完成AI，不能作自动正确题数。旧/新提取数不同，禁止用其推断准确率。诊断原文保留本地。

三个最小的旧v1文件作同机顺序索引与全部候选物化，每份预热后3遍均值。耗时3.93→2.26ms、4.25→5.53ms、4.25→4.15ms，候选数7/23/26不变。JSON分别12835→13595B、36084→38721B、36342→38789B。新增解析耗时69.1/159.6/87.4ms，解析器修改前耗时没有独立基线。小样本存在波动，第二份慢1.28ms，不能证明大型库性能。新全量只读诊断解析合计80.37s，双索引诊断合计2.41s，记录于word-performance.json及word-v2-diagnostic.json。

当前运行冻结构建通过prepared.json的SHA验证。整库后台原AI恢复后继续，原目录归档保持暂停。已有v1 Word需要原重整入口升级，批量自动升级、MathType/EMF/WMF成熟转换、共享条件/重复题号处理、多词召回及前轮间歇导出超时继续OPEN。完整Goal ACTIVE。

### 回滚

正常revert本轮提交并保留运行根和原件/回执。已有v2文档须继续使用能读取v2的版本或从原件通过已有重整入口重建，禁止把v2 JSON直接冒充v1。源码回滚前复制隔离测试数据，已保存业务题与导出保持原文件和谱系。

## 最终运行与收尾

最终可读性整理后build/typecheck通过，`word-final-build.log`，main入口SHA256为 `8410f22cf45798bcd279cc659a933eed2f7d1b4dc7875c696694747ce9b6c305`。真实两题与两份PDF适用此前同功能冻结 `d657aec55428`，后续main源变化仅nativeMetadata展开格式与注释。当前使用最终8410冻结重新启动同一数据，恢复已导入范围的AI，原目录归档继续paused。2026-11-11T10:46:50Z状态running，原目录批次不变、renderer错误0。

收尾第一次恢复控制器未展开新版资料页的外层“处理队列”，访问不可见批次面板超时。保存原runner_error与日志，修正控制脚本先走实际materials-queue-toggle再展开批次，重启同一profile/data后原UI恢复成功，未重复提交手动批次。最终控制器PID188896、ElectronPID177924、工具会话71827，仅作历史线索，下次必须读run-state.json验证。
