# Word 目录自动原版页面归档

## 本轮功能

新建质量优先目录批次现在自动把 DOCX 转成原版 PDF，经原 PDF 页处理队列和 DeepSeek 执行器整理题目。教师对文件夹授权后，后台完成页面准备及逐页安排。资料卡显示本地准备状态和已关联页面快照数量，原暂停、继续、重启恢复和预算流程贯通。

目录策略固定为 word-pages.v1。旧批次增量迁移为 native.v1，标准模式继续原流程。原 Word 作为父资料，转换后标记 represented，派生 PDF 保存 origin_resource_id/origin_version，并作为同批页面资源处理。已有付费批次继续按其冻结身份读取。

派生授权须同时通过原批文件成员、当前父版本、转换引擎、完成回执、PDF 摘要和父 Word 隐私检查。原授权文件、跨页读取和已知答案参考共用范围校验。任意 PDF ID、跨目录文件、变化的父版本或转换回执均无法扩大派生授权。

派生 PDF 作为原版图文来源，自动纯文本规则抽题沿原 Word，新增快照不再生成额外规则候选。此前 11 条未经教师操作的快照规则候选通过可逆来源视图折叠，原始记录保留。教师编辑、收藏、分类、使用、来源关系失效与 AI 正式记录分别受到保护。

## 真实执行

在现有资料中选择一份尚未生成原版页的物理 DOCX，使用独立导入子目录和原文件名，原归档记录按原入口复用。原大批 221 文件继续暂停。新批 batch_c31147d2-5b0b-4c1e-a16f-97a5cc47e0e4 自动生成 7 页 PDF。原目录按钮停止本地准备、冷启及继续通过。

本地页级处理为 1 页 complete、6 页因 text_conflict 待核，首页面通过原图进入后续 AI。原图可读和本地两路文字一致是分别记录的质量结果。

本次测试授权设为 3 次，用于首个页面完整链路。实际统一 DeepSeek 完成 3 次调用并保存 7 份带来源待核稿。其中 3 份有完整裁块题文档，4 份保留整页待核图。新快照规则题数为 0。第一页面完成后本批为 budget_exhausted，随后已通过原界面暂停。其余页面继续待处理。

旧 222 资料、1318 分块、3195 条题目、311 单元、712 回执、893 Word 历史、6 条恢复审计和原目录的全部旧列/原行摘要保持。新结构列按默认兼容添加，原批策略为 native.v1。当前资料 223 份、分块 1319、题目记录 3202、AI 单元 312、调用/回执 715。SQLite quick_check 为 ok。

最终冻结 main SHA 为 bdcc27b3debb58662e224d622934579fd921e3ed6d4e9acfa9ea06fb08419fea，整树 1a3d6ba92c2504d499b836d8ef2827c8478c6196bbbdcf04c4f54f82ce4ed947，共 469 文件，代码基线 25a4eff4775c0053dbf8a3299d9f9d76e2798abf。真实付费执行来自首次候选，最终差异为父 Word 隐私继承。最终版本冷读相同批次、页源和两类保存原图，调用保持 715，真实范围 SQL 同时通过。原始资料、数据库、截图和模型响应保存在本地测试根，Git 只收录安全元数据和日志。

## 质量问题和下一动作

7 份新稿全部是 ai_needs_review，自动定稿 0。真实两轮的选择题字母逐项相同，但复核稿增加选项内容附注，例如仅有选项字母的字段与“字母加选项说明”的形式不同，当前触发 answer_conflict。第 1 题保存原图已核对，选项及题面清晰。部分题目还存在裁块、OCR 或图文不完整疑点。新链路的调度与保存已贯通，自然题目质量仍未达标。

下一优先复用这 3 份已存完整响应，按原题号、原选项和裁图证明机械等价，再冻结新的选择题答案比较/提示策略。保留真答案差异、错误选项说明、OCR、裁块与数学推导疑点。修复后用原记录验证，通过版本化审计处理可恢复结果。继续完成图文来源完整性、已知答案、联网补答、自然检索组卷、安装移植及约 10GB 范围，完整 Goal 保持 ACTIVE。

## 验证范围和失败保留

最终构建、246 组件、新增 7 项目录/授权/恢复/教师保护边界通过。原页面准备 11 项、Word 升级 13 项、目录、PDF 发布、来源关联、30 项同源折叠和 53 项题答参考检查通过。207/207 legacy smoke 为父 Word 隐私差异前的候选，最终差异由新边界及真实库来源检查覆盖。

旧跨页专项的首个案例仍出现 invalid_response 与 1/3 调用断言失败。在隔离源码 loader 中恢复 056f445 的受影响模块后，同一断言仍失败，已保留两份日志。该遗留问题继续 OPEN。旧迁移脚本首次使用普通静态加载命令失败，当前旧库的增量迁移由九张表旧列摘要和冷启读回证明。

实际 UI 脚本曾因 Windows 路径标准化、授权异步等待、图页没有正文 sources 时的断言、题本 limit=100 超出契约而失败。均保留原日志，随后按真实入口和图页回执身份继续。最终题本从裁块和整页两类原图完成读取，旧业务事实保持。第一批 7 份待核及 page_content_incomplete 继续保留。

在 apps/desktop 运行的关键命令如下。

```powershell
node --experimental-transform-types scripts/education/kb-folder-word-pages.mjs
node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types scripts/education/kb-folder-word-upgrade.mjs
node --experimental-transform-types scripts/education/kb-word-pages.mjs
node --experimental-transform-types scripts/education/kb-rule-duplicates.mjs
node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs
npm run test:smoke
npm run build
npm run test:renderer-components
node test-results/corpus-flow-1gb/folder-word-pages-freeze.mjs
node test-results/corpus-flow-1gb/folder-word-pages-live.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types test-results/corpus-flow-1gb/folder-word-pages-pause.mjs
npm audit --json
```

源码探针及完整付费回执在本地 test-results/corpus-flow-1gb 和 D:/WorkProject/EduProject-kb-run/flow-1gb-20261111。本目录 result.json 保存安全摘要，运行日志以 logs.zip 和 manifest.json 保存原字节身份。

## 实现、性能和回滚

目录准备、派生授权和事务关联见 [material-folder-word-pages.ts](../../../../../../apps/desktop/src/main/assets/material-folder-word-pages.ts) 与 [material-folder-ai.ts](../../../../../../apps/desktop/src/main/assets/material-folder-ai.ts)。快照事实来源和可逆视图见 [material-word-page-source.ts](../../../../../../apps/desktop/src/main/assets/material-word-page-source.ts)，原抽题器、跨页与题答参考复用同一范围校验。共享 FolderAiView 和原资料卡新增实际准备状态，既有 typed preload 通道继续使用。

原流程需要逐个打开 Word 才能准备原版页，新流程由目录调度完成。此次从恢复本地准备到第一页面结束约 350 秒，包含组件认证、OCR、版面切块和三次真实模型请求。缺少同条件速度与内存峰值基线，性能 P95 继续待测。每 tick 保留有界轮转和单个本地准备，并复用原 Worker/模型调度器。

新 npm/pip 依赖 0，复用上轮已安装的 LibreOffice，下载成本本轮为 0。npm audit 既有 29 项，其中 low 8、moderate 13、high 8、critical 0。

回滚先暂停受影响目录批次，再撤销功能提交或停用新的页面调度，保留新增列、转换关系、原文件、页图、付费回执和已存 reader。已付费批次不得通过切回 native 来自动重发。完整回滚演练继续待执行。
