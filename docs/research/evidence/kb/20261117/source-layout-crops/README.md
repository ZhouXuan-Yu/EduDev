# 带图题来源版式归档

## 本轮交付

已修复汉字换行、汉字与变量排版空白造成的带图来源误判。原7题新增3份完整正文+独立插图文档，新增2题AI定稿，现5题AI定稿/2题待核，6份完整裁块题文档。真实本地动作约453ms，新增模型调用0，累计715次、3202条题目记录。原3条选择题审计逐行保持，新增来源审计3条。

教师从资料库打开原版PDF，进入“题目与校正”，展开“AI深度整理”，在旧批次点击“复核来源版式（无需模型调用）”。题本中同时展示每道题的正文裁块和独立插图，继续使用原校正与正式组卷确认流程。

## 根因与处理

原第二遍/最终来源读数已通过readingBodyComplete，原图、标签及裁块边界完整。下游visualQuestionAgrees使用严格题面签名，汉字换行造成不一致，最终被标成ai_mismatch和requires_image。普通选择题选项扫描还把题干变量B、C中的标点当作选项起点。本轮以独立版本处理中文排版边界，并从实际A项起认证连续选项。

source-layout-text.v1只在新quality冻结输入或经审计的旧来源复核启用。只比较汉字边界排版空白，拉丁/希腊/数字相互间隔、符号、否定、指数、表格和图标签仍严格检查。两份来源读数、完整原图、块归属、裁图边界及教师保护共同认证后，原writer才能新增完整题文档与派生归档。旧选择题审计继续原版本，新来源审计复用同表，未新增依赖、DDL或执行器。

新增共享material-ai-source-layout.ts。比较副本只处理题干与statement/formulas/choices/subquestions，原问题、两遍模型内容、OCR、figures及tables原文保留。新quality输入固定sourceLayoutPolicy，旧输入通过显式本地动作采用经审计的版本。复用planAiPageQuestion和原审计表，只有新文档完整、疑点严格减少且没有新增疑点时发布。未经教师操作的候选每次最多20个。修改领域文件及SHA见source-manifest.json，共享契约和原MaterialAiPanel同步交付。

来源审计保存原整行及派生归档，读器重新认证原页/图片、两稿与来源稿、裁块和模型字段。归档前后计划可在三种合法邻页状态中精确重现，避免邻页后来可读时让仍待核的历史题文档失效。当前更严格的跨页守卫继续生效，历史待核状态沿保存结果读取。

## 真实结果与性能

原自动Word目录首页题号3、5、7恢复三份正文+插图文档。题号3和5新增AI定稿，题号7保留incomplete_question，题号4保留真实uncertain_ocr等疑点。现7题中5份AI定稿、2份待核，6题拥有完整裁块题文档。三对原图分别为891×199加337×180、785×243加402×128、907×195加321×229像素，最终原界面逐张加载并核对SHA。全部6题原图读回及重启通过。

实际动作453ms，新增模型调用0。修复前这3题均缺完整题文档，修复后3份完整正文/图形来源可读取。该时间是一次有界实际操作，整库吞吐与检索性能另待全流程推进。

223资料、1319分块、312AI单元、715回执、893Word历史、6恢复审计、2目录授权及223目录资源逐行摘要保持。3202条题目仅3条archive_json/document_json发生预期派生变化，其他字段及原时间戳逐字段保持。原3条答案审计逐行保持，新增来源审计3条。两目录均paused，SQLite quick_check=ok，应用关闭。数据库和原模型文本/书页/截图保存在本地测试根。

首次真实动作来自main a7560b15cbded568e74f7dcb7afc6d2db88fe6db30c782948f3afb74f1dddae4，最终冷读main 3467d279c9570638c25601304522903f6321a6a22f9f62c51fed6f17e6959728、完整构建 c451adb7b792b9dd20794b9ab0ad25160c1f67d75766f5291345b7b9a3e35df1、469文件。收尾读器差异由针对性边界与最终原界面冷读覆盖。所有源文件身份见source-manifest.json。

## 验证命令与范围

工作目录D:/WorkProject/EduProject-kb-isolation/apps/desktop。

- npm run build，通过，source-layout-build-final.log。
- npm run test:renderer-components，246/246，UI源码随后保持。
- node --experimental-transform-types scripts/education/kb-source-layout-boundaries.mjs D:/WorkProject/EduProject-kb-run/flow-1gb-20261111 D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/source-layout-before.db，10/10。包含数学/单位间隔、旧策略、原3条审计、新3条图文、教师保护、部分写回回滚、审计篡改、停用与邻页可读后的历史认证。使用回滚型数据库副本，真实模型调用0。
- node --experimental-transform-types scripts/education/kb-choice-answer-boundaries.mjs D:/WorkProject/EduProject-kb-run/flow-1gb-20261111 D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/choice-answer-before.db，20/20，收尾读器修复前候选。
- node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs，247/247，收尾读器修复前候选。
- node scripts/electron-smoke.mjs，207/207，运行期间out曾更新，按候选级综合证据记录。最终冻结版的原批次、六题原图和冷启另以source-layout-live.mjs验证。
- source-layout-freeze.mjs备份原库并复制完整构建。source-layout-live.mjs经原导航执行动作及冷读，验证5定稿/2待核、两尺寸、三对图片、原事实与0新增调用。
- npm audit报告29项既有告警，low8/moderate13/high8/critical0，本轮无依赖变更。
- git diff --check在提交前检查。

诊断中的原题全文仅在本地source-crop-diagnosis及summary文件中，日志归档只收source-layout命名的安全状态和测试信息。日志逐项SHA见log-entries.json，压缩包logs.zip。

## 下一步与回退

完整知识库Goal继续ACTIVE。下一处理同位素/上下标符号的原图与OCR识别缺口，以及已完整裁块题的邻页边界确认和待核推进；以通用来源协议修复，不逐题改写。当前目录批次均paused，应用已关闭。当前全目录自然质量、Word题答关联、联网补答、检索组卷、安装移植及约10GB继续OPEN。

既有独立跨页suite的invalid_response历史失败继续OPEN，本轮247页面协议检查按其自身范围记录。当前带图切片的通过不能证明整库自然题质量、全部答案正确性及完整检索组卷已经达标。

设置OMNI_EDU_AI_SOURCE_LAYOUT=0停止新的来源版式策略与本地动作，已经写入的审计继续通过reader认证。保留原source-layout-before.db备份。撤销某条本轮派生结果时，须在维护事务核对审计、当前archive/document摘要及未编辑状态，再从before_json恢复对应归档和文档，保留审计历史；避免用整库快照覆盖教师后续工作。旧二进制兼容性须另验。
