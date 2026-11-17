# OCR 段落与试题结构恢复专项

## 当前结论

P0 验收通过，P1 部分完成。默认导入、结构门禁、真实资料、原界面、来源读回和回归已经验证。完整知识库 Goal 保持 ACTIVE。最终测试数据和运行时身份见本目录 summary.json。

## 根因与实际调用链

审查覆盖用户指定的八个文件，并继续追踪 Python Worker、PDF 页暂存、Word 解析、资料切块、自动抽题和 SQLite 写入。

- Python `omni_edu_ocr/pdf_stream.py` 的 `read_page` 将 RapidOCR 的 `txts` 直接按换行拼接，普通解析回执保留文本与原生 PDF 框，OCR 行的框与分数在该分支被丢弃。图片 `worker.py` 的普通识别回执也缺少行框。
- `MaterialPdfRepository.accept` 对成功页立即调用 `splitMaterialText`。这个函数按 1200 字符硬切，分界可落在段落、选项、小问中间。`publish` 把这些行写入 `resource_chunks`，`bbox_json` 为空。
- `MaterialRepository.ingest` 的图片分支保存 OCR 字符串，Word 分支保存 OOXML 原生文本，随后提交资料块。默认导入没有经过 PP-DocLayout 的区域恢复。
- `extractMaterialQuestions` 把各资料块拼接成带双换行的文本，再按题号、提示词抽取平面题目。此时原始行和区域关系已丢失，跨块、跨页及嵌套编号只能保守猜测。
- `readMaterialLayout` 和 `withMaterialPageBlocks` 已有精确 OCR 行、四边形与 PP-DocLayoutV3 区域，原调用位于按页操作和 AI 整理链路。`question-quality.ts` 检查生成题质量，无法恢复上游被丢弃的几何关系。

新默认链路经过现有 `MaterialParseQueue`，先保存原解析，再复用 PDFium/RapidOCR 的完整版面接口和 PP-DocLayoutV3，恢复段落、持续组装完整题目，最后发布索引与可入库候选。正在处理、失败和取消的结构任务都会拦住旧的题号抽题回退。

## 实现与来源保护

- `material-document-structure.ts` 根据版面区域、相邻行间距、缩进、对齐、同基线片段和编号语义恢复段落。双栏按通栏分隔带及栏内顺序读取，横排选项参与语义分组。
- 流式试题组装保留题干、选项、两级小问、共用材料、答案、解析及图表/公式区域。未结束题目可以延续到下一页，重复页标题参与连续性判断。缺失起点、重复编号、低置信度内容、材料范围及图片归属疑点均进入待核。
- SQLite 新增 `material_structure_jobs`、`material_structure_pages`、`material_structure_questions`、`material_structure_chunks`。原文、OCR 行 ID、四边形、区域、页码、题目树、置信度和待核原因位于版本化快照中。
- 派生协议采用 `xiaozhi.document-structure.v1` 和 `layout-paragraph-question.v1`。题目归档使用独立的 `xiaozhi.question-archive.structure.v1`，保留配套答案归档已有的 v6 名称。每个入库条目绑定资源版本、generation、candidateId、摘要及原页裁图。
- 新 PDF/图片完成结构恢复后发布资料索引。待核题目、答案册和未归属段落的源文字保留检索入口及待核标记，题库写入只接受结构门禁通过的题目候选。Word 同时保留原生 OOXML、图片和公式，其原生段落索引采用段落边界切块。
- 旧资料通过资料详情的“段落与试题结构”进入显式重建。已有资料块、来源偏移和教师、AI、付费历史继续保留，PDF/图片增量追加缺少的恢复源块，Word 保留原生段落主索引，新的结构快照独立保存。新导入资料使用新的结构门禁。
- 页面持久化后可从检查点恢复，最终发布使用现有短 writer 事务与解析 lease。新 generation 保留历史快照，取消、过期 lease、原件变化和发布失败均有防护。
- 原题裁图写入现有 `QuestionAssets`，题本原图沿 `OriginalQuestionRepository` 读回。教师编辑同步修改题文档，并保留来源及答案归属。

## 修改文件

主实现新增以下文件。

- `apps/desktop/src/shared/material-document-structure.ts`
- `apps/desktop/src/main/assets/material-document-structure.ts`
- `apps/desktop/src/main/assets/material-structure-repository.ts`
- `apps/desktop/src/main/assets/material-structure-runtime.ts`
- `apps/desktop/src/renderer/components/product/MaterialStructurePanel.tsx`

接入修改覆盖 `material-repository.ts`、`material-pdf-repository.ts`、`material-parse-queue.ts`、`material-chunks.ts`、`material-question-archive.ts`、`material-ipc.ts`、`db.ts`、typed preload、`question-archive.ts`、资料详情和题本原图组件。Word 导出修改覆盖 `word-pdf-runtime.ts`、`word-pdf-worker.py`、`material-word-pages.ts`。完整文件及摘要写入 MANIFEST.json。

## 实施中修复的缺陷

真实 Word 导出出现 `com.sun.star.lang.DisposedException`。PDF 已经生成，旧 Worker 在查询 UNO 页数或清理时失败，资料任务最终只显示 `parse_failed`。新私有回执采用 `xiaozhi.word-pdf-export.v2`，从已导出的文件由现有 PDFium 验证并读取真实页数。仅对 `storeToURL` 正常返回后的释放异常保留导出结果，导出过程异常、其他异常及 PDF 校验失败继续失败。

补充修复包括共用材料和图内低分文字向整题传播置信度、教师恢复为原答案值时的归属认证，以及独立归档命名。全部候选待核、没有可检索块的图片可完成解析并返回待核状态，原件失败仍保持失败。重启恢复清除过期的解析失败后缀。配套答案已有 v6 归档通过专门回归验证。收尾发现待核源文和答案册被过度排除出资料索引，现已改为保留恢复源文、标记低置信度，仅约束题库准入。页眉页脚从题目结构排除后，整页原始 OCR 仍参与个人信息检测，必要时增加带隐私标记的真实原页源块，维持原有云端授权阻断。旧块不改写。

## 前后对比与性能

| 项目 | 修复前 | 新链路 |
| --- | --- | --- |
| OCR 行关系 | 普通回执拼成字符串 | 原始行、分数、四边形、区域关系持久化 |
| 段落边界 | 行换行与字符长度承担边界 | 行距、缩进、对齐与区域共同恢复 |
| 完整试题 | 平面题号窗口，存在硬切块 | 流式题目树、跨页锚点、材料与图表归属 |
| 低置信度内容 | 规则候选进入题本后提示风险 | 结构阶段隔离，保留原页待核 |
| 长 Word 段落 | 可在 1200 字符处被切开 | 保持原生段落原子性 |

合成 500 页、1000 道题用于验证流式组装与独立来源 ID，核心结构计算耗时见 summary.json，不含 OCR 与磁盘。三份真实资料首次后台导入耗时 255.191 秒，初次形成 4 个资源、39 个索引块及 14 道题本候选，最终代码随后通过显式重建补齐待核源文索引。原始资料共 14 页，Word 派生 PDF 另计 7 页，共 21 条资源页记录，保存 1134 条 OCR 行、880 个段落，其中 142 个段落合并多行。进度消息中的 1181 行已更正为最终 SQLite 读回的 1134 行。真实耗时包含 OCR、版面模型和 Word 转换，附属组件使用本机已有、经生产校验的受管版本。最终运行时通过显式重建补齐五份受测资源的源块，从 43 增至 272，耗时 17.283 秒，17 条题库记录和原来源偏移保持。该组包含受控双栏样本，增量计数用于检查源文保留，不代表召回率提升。旧版缺少同范围的结构阶段计时，本轮没有同条件的速度提升比例。

## 自动化与真实样本

测试命令在 `apps/desktop` 执行，精确命令、退出码与结果见 summary.json。

- `npm run build`
- `npm run test:renderer-components`
- `node scripts/education/document-structure-boundaries.mjs`
- `node scripts/education/document-structure-repository.mjs`
- `python scripts/education/word-pdf-export-boundaries.py`
- 原页 247、Word 解析、PDF 发布、配套答案及来源版式回归
- `node scripts/electron-smoke.mjs`，通过 `OMNI_EDU_TEST_BUILD_ROOT` 指向冻结运行时
- `node scripts/education/document-structure-electron.mjs`，通过显式测试目录和文件列表运行

合成样本覆盖单栏、双栏、一题多行、横排选项、多级小问、跨页、图文、公式、表格、Word 段落、低质量 OCR、共享材料、来源篡改、取消、恢复与事务回滚。真实样本覆盖六页扫描 PDF、一张题目图片和七页物理 Word，Word 派生 PDF 同步完成默认解析。逐行检查 OCR 原文、段落覆盖、题目树、源图摘要和低置信度隔离，再从原资料导航与题本检查来源、两种分辨率和冷启动。最终运行时额外通过原界面停止/继续重建、退出后恢复、三类题目的原图列表以及教师补正和恢复答案。

用户资料、题目正文、PDF、Word 和自然样本截图保存在隔离测试目录。仓库证据只收录统计、代码/运行时身份和测试摘要。

### 最终门禁结果

| 门禁 | 结果 |
| --- | --- |
| 构建与 TypeScript | PASS |
| renderer 组件 | 246/246 |
| 段落/题目结构 | 23/23 |
| 持久化/lease/归属与既有队列 | 37/37 |
| Word 导出异常边界 | 7/7 |
| 既有 AI 原页 | 247/247 |
| 既有 Word 解析 | 14/14 |
| 既有 PDF 发布 | 4/4 |
| 配套答案 | 18/18 |
| 配套答案文档与归属 | 7/7，另执行原匹配回归 |
| 既有来源版式 | 10/10 |
| Electron 原功能 | 207/207 |
| 真实导入与冷启 | 5 个检查通过 |
| 最终运行时重建/来源/教师编辑 | 5 个检查通过 |
| 双栏 OCR、待核源文及页眉隐私 | 7 个检查通过 |

上述自动化门禁退出码为 0，报告内没有 failed 或 skipped。首次自然导入冻结树与最终验证树分别记录，最终树含 473 个文件，摘要为 `b2aec589e82690f1684e00ef60c72958001c6d38c1c8143a4e1bab34c30aa493`。

### 双栏实际 OCR 链路

自制中文双栏 PDF 通过 Chromium 打印、原导入入口、PDFium、RapidOCR、PP-DocLayoutV3 和结构恢复。四道题按左栏 1、2，再右栏 3、4 排序。实际 OCR 识别了 15 个选项，结构保留同样的 15 个，全部原始行都有段落归属。第一题的 C 选项被 OCR 漏识，题目按不连续选项隔离待核，其余三题保持四选项。待核第一题的原文继续进入资料索引，其题库写入被隔离。另增加含测试邮箱页眉的实际 PDF 导入，检查 OCR 原页与个人信息权限标记。实际 PP-DocLayout 将邮箱所在段识别为 header，资料块中仍读回 1 条隐私源块。首轮强制要求 OCR 未识别的第十六个选项使测试失败，这份失败报告已保留。随后按原文守恒与缺项隔离标准检查同一已保存结果，结构检查通过。该样本没有取得完整文字识别的验收结论。

## 已保留的失败证据

A 次运行的快照位置超出桌面模块解析根，测试启动失败。快照改放在 `desktop/test-results`。B 次运行首次下载 LibreOffice 未收到数据，随后通过已校验受管组件继续。C 次运行保留真实 Word 释放异常。D、E 次运行完成真实导入，最终命名与教师归属修正通过后另以最终冻结版本验证。各次本地报告保留在 `D:/WorkProject/EduProject-kb-run/ocr-structure-*`，早期结果仅用于定位故障。新增隐私样本的首份测试页眉放在打印区域外，OCR 没有该行，断言失败。保留该失败与 PDF，随后修正测试排版生成 v2 样本，实际识别 header 与隐私标记通过，生产识别规则未作专用调整。

## P1 与尚未解决事项

- PDF 原生文字和 OCR 精确行框的补缺融合尚未实现。受控双栏样本的一个选项被 OCR 漏识并隔离，原始页面仍可核对。
- 复杂公式的数学语义、表格单元格结构以及图形关系需要进一步恢复。当前保存原始 OCR、原生 Word 结构、区域与裁图，低置信度继续待核。
- 双栏、跨页与图文关联已纳入本轮测试。双栏完整真实 OCR 链路使用自制试卷，更多出版社自然双栏、三栏、任意嵌套分栏及严重遮挡仍需扩充样本。
- 现有 DeepSeek 页源整理入口继续可用。本轮新增结构层只采用原始 OCR 行与坐标，尚未形成独立的、仅允许行 ID 重组的 AI 结构认证。当前文字证据无法独立认证低识别公式和图形语义，新增补字与条件修复继续进入人工核对。本轮新增模型调用为 0。
- 结构查看页提供查看、重建、停止和继续，已入库候选沿现有题本补正。结构待核候选的就地修改与回灌入库尚未覆盖，原页和原始内容已保留供人工核对。
- 普通结构候选保留 `sourceChecked=false`。本轮没有证明全库数学答案正确，也没有完成完整知识库 Goal 的检索、组卷、联网补答、安装移植与约 10GB 自然资料验收。
- 最终 npm 审计报告 35 项问题，其中 high 15、critical 0，早前审计为 29 项，本轮依赖锁没有新增修改。当前 Python 工具环境缺少 pip_audit，Python 依赖审计记为 NOT_RUN。本轮未新增 Python 依赖。
- 首次联网下载附属组件的成功交付本轮仍未验收，最终测试复用了已校验的本机受管组件。

## 回滚与集成

本轮先在知识库隔离分支提交，再整合远端 `origin/main` 的 Harness 开发。增量表与快照支持重建，回滚应先备份本轮测试或用户数据根，保留新归档 reader 和图片资产，再停用新导入/重建入口。直接使用旧二进制读取已写入新结构归档的数据库尚未验证。回滚过程必须保留原始资料、教师题目和历史付费回执。

P0 验收结论为 PASS，覆盖本轮明确样本与边界。P1 为 PARTIAL，继续完善原生文字补缺、复杂图表/公式和独立 AI 结构校验。最终提交与推送结果由本轮 Git 收尾记录确认。
