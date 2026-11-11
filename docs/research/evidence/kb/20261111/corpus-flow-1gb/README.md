# 当前已导入资料的实际链路

## 最新执行范围

用户2026-11-11要求先将当前已导入资料跑通。目录继续归档已通过正式UI暂停，固定处理221份、328203104字节，包含148份DOCX、66份PDF、7张PNG。约1GB输入共987份、1052908695字节仍保留，约10GB资料工作后续继续。完整知识库Goal保持ACTIVE。

原始合同先要求全部约1GB输入持久状态与真实题库、检索、组卷和导出。用户随后收窄到当前已导入范围，本节采用最新指令。全部自动整理质量仍未达到完成条件。

## 教师可见结果

目录入口实际归档原件，后台解析完成等待队列。SQLite冷连接读取为160份ready、61份partial。partial保留本地OCR/正文不一致等页级疑点，文件状态沿用原系统。

从本次原件提取的两道初中物理电学题，原图已逐项查看。我通过正式题本编辑入口补充源目录明确的粗学段“初中”，纠正一题答案与两题解析，保存教师编辑来源。原始模型稿、错答、裁图和独立校验记录保留。此操作用于验证原产品校正路径。

正式题本搜索能找到上述题目。真实自然语言请求“从本地题本检索两道与电功率相关原题”由Pi调用education_search_questions返回2项，再两次education_read_question读取题面、答案来源及图义转写，最终completed。此次Pi没有接收原始题图，语义索引仍在补建，不能据此推断全库召回率。正式蓝图按物理、初中、两道选择题、每题5分选出2/2题，经测试代理集中确认，再由真实Pi/DeepSeek调用education_export_paper，经原Office图片核对与保存审批生成四份实际文件。正式教师教学使用仍须教师审核。

- 当前导入物理练习-student.docx，272527字节。
- 当前导入物理练习-teacher.docx，273123字节。
- 当前导入物理练习-student.pdf，362217字节、2页。
- 当前导入物理练习-teacher.pdf，400229字节、2页。

文件实际保存于D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/XiaozhiOutputs/89de357f8d296639/aisession_8b51cb4b-07b0-4a7a-a0a5-26a1cf675a6a。独立python-docx/pypdf/PDFium回读四份，验证A4、三张来源PNG的原字节/像素、学生卷文本答案隔离、教师参考答案与完整解析。文件SHA与document_artifacts及确认卷血缘一致。已查看学生PDF两页和教师PDF第二页，完整题图保留，原图题号也保留。学生卷第二题标题落在前页末尾，题图在下一页，仍待优化排版。Word/WPS真实排版尚未检查。

## 本轮实际缺陷修复

### 缺失角色标记导致同页拒收

真实DeepSeek响应将缺失答案写为answerOrigin=missing、answer="missing"，并明确包含incomplete_question/cross_page，严格schema因此拒绝整页。新增missing-role-marker.v1，仅对明确incomplete_question且origin与值均为missing的答案/解析，将标记转换为空值。严格schema继续验证，疑点和同页其他题保持原值，provider原始回执在转换前保存。三个历史真实响应可在本地重新通过严格页schema，共11条题目，3条末题仍带不完整疑点。其他格式错误继续拒绝。

原历史未知结果没有被自动重发或改写。读取回执的诊断仅做本地验证，正式运行使用更新后的provider适配层。生产修改位于material-ai.ts与material-ai-provider.ts。

### 质量模式默认未启用已有深度推理

自然题出现答案与解析中间计算矛盾，旧quality路径需隐藏环境变量才启用已有deepseek-high.v1。新quality单元默认将该策略冻结到input_json，经原DeepSeek适配器启用high thinking。显式0停止新单元启用，standard与legacy规则沿用原映射，旧已保存单元按原策略恢复。实际新目录单元已持久保存deepseek-high.v1并获得真实响应。推理设置的变化尚不能证明自然题答案准确率达到交付要求。

生产修改位于material-ai-inference.ts与material-ai-repository.ts。共享契约、表、IPC/preload、教师校正与正式审批继续沿用现有实现，未新增依赖和迁移。

## 精确验证范围

在D:/WorkProject/EduProject-kb-isolation/apps/desktop执行。

```powershell
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
npm run build
npm run test:renderer-components
npm audit --json
```

分别29组、246组、构建含typecheck、246组件通过。前两项为受控provider/SQLite协议验证，实际自然provider与产品操作由本报告另行记录。npm audit返回非零，现有28项、8项high，完整结果在运行目录npm-audit.json。本轮没有新增依赖。未重复运行共享Electron全量smoke。

实际目录导入控制器为scripts/education/kb-corpus-flow.mjs，使用独立data/profile及冻结runtime。当前构建入口SHA256为cf7abb94be4d15e3d210e9f1179bb4c1e15348c6a90a3e10193dfd6dcd802b3b。新旧运行与升级前状态各自保留。导出操作脚本在apps/desktop/test-results/corpus-flow-1gb/deliver-current.mjs，实际API及数据库记录位于运行根目录。

```powershell
node scripts/education/kb-corpus-flow.mjs run D:\WorkProject\EduProject-kb-run\flow-1gb-20261111
```

已有控制器运行时先检查run-state.json中的PID与现场进程，保持单实例。control.json可请求inspect、screenshot、pause、resume、close，pause/resume只控制AI，目录归档的人工暂停继续保留。运行目录包含加密账户和用户资料，仅本机保留，Git仅存脚本和必要统计。

## 实际失败和未完成项

- 自动AI定稿题当前仍为0，另有两道教师编辑可用题。自动内容质量仍未通过，全部221份AI处理仍在后台推进。准确状态见result.json时间戳及运行目录实时run-state.json。
- 148份Word的复杂公式/图片以及共享上下文/source_warning会使原生题进入source_incomplete。需要从通用解析和图文证据恢复处理。
- 真实年级分类缺失、答案冲突、跨页及图文来源不完整仍存在，不能将“字段齐全”作为数学正确。
- 教师Word第一次和第二次导出在审批后遇到内部15秒lifecycle_timeout，前端归为event_persistence。通过原“重新读取记录”恢复，第三次成功，保留两个interrupted产物记录。该间歇超时尚未修复，不能以成功重试宣布关闭。
- 自写控制器曾错误读取不存在的knowledge_resources，已修正为teacher_resources。导出脚本曾假设输出目录、误用自定义复选框原生check、未等待上一轮结束、以及在隐藏路由读取卡片导致超时。这些是执行脚本问题，历史失败在运行目录保存，和产品超时分别记录。
- 需要继续处理答案册角色关联、全部自然资料的稳定自动归档、扩大独立小智检索实读样本、全范围检索指标、三个正式蓝图、长期后台恢复、普通Windows安装和移植。先完成当前导入范围，再扩展输入。

## 性能与恢复

缺失标记处理对原128KiB有界响应增加一次JSON解析及逐题遍历，本轮没有P95前后测量。quality新单元复用已有推理策略，输出token预算8192增至32768、请求期限120秒增至300秒，耗时与token费用可能增加，真实质量需继续验证。当前未测整批前后吞吐、峰值内存与磁盘上界。

可通过正常revert恢复本轮四份生产文件。高推理停止新启用可设OMNI_EDU_AI_REASONING_HIGH=0，历史已冻结输入继续按原策略恢复。表和文件格式兼容原实现，全部原资料、旧模型回执、历史失败和四份导出保留。完整Goal及KB-A01～A10继续OPEN。

## 主线整合

本轮实现提交0bf76fd。刷新origin/main后合入协作者77c7fdc的69份UI、路径和检查修改，合并ee400ec，无冲突。整合后的build/typecheck与246组件再次通过，工作树检查通过。实际provider、题库搜索/校正、四份导出和自然检索是在此前冻结cf7abb94be4d运行版本完成，合入协作者UI后的Electron路径尚未重跑。

当前控制器PID39964、工具会话23469，恢复前须核对run-state.json和现场进程。当前已有后台AI在处理221份范围，目录归档继续暂停，原冻结runtime不被新的out覆盖。后续按真实源质量、Word图文、缺少学段和内部超时继续修复，不重发同页充作成果。远端最终提交以本轮Git校验结果为准。
