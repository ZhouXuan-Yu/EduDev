# 已知答案参与最后整理

本轮起点为44767d2。期间整合了协作者main的35个提交，代码整合基线为e2230ca，随后继续整合了ab319fc的文档更新。新质量目录的题册可在最后整理时参考同批答案册。实际递归导入、角色授权、后台处理、题本、双尺寸和冷启动已通过4组检查。两题分别形成书册来源完整题目与保留独立解答冲突的待核题目。

完整Goal保持ACTIVE，KB-A01～A10保持OPEN。自然样本12题仍待核，120自然留出、200查询、三套正式蓝图、40GiB/72h、普通Windows链式安装与换机继续待验。

## 实现

- 新quality且同批关联题册时冻结book-final-reference.v1。首次独立解题和来源转录隔离答案，最后整理接收唯一章节题号、双遍一致且已认证的必要答案文字。
- 复用现有MaterialBookAnswerIndex、章节继承、原始回执、配对、预算、DeepSeek provider与SQLite writer。候选状态覆盖可用、缺失、含混、待核、无章节和授权范围外。最后两种来源疑点继续进入既有待核路径。
- 新增material_ai_book_references，保存当时配对、题面/复核摘要、章节上下文、答案页/批次/quote摘要、必要文本和final摘要。最终归档与final摘要提交共用事务。发送前、写入前、重启和教师原页读取均重新认证冻结选择。来源变化将阻断读取或发送，教师可据原来源处理。
- 原页新增“最后整理参考的答案册”折叠内容。实际使用的原文与页码可查看，候选与首稿有分歧时仍保持answer_conflict。书册来源writer继续维护book_extracted角色和原始归属。
- 目录优先处理同批已发现的配对答案资源。缺失答案资源时题册可继续，目录预算、暂停、恢复与unknown机制继续控制请求。
- 常规recover停止每轮清零retry_at。该写入会触发dirty并让索引重复处理同一单元。清零只在recoverStartup处理非零值。章节参考校验允许排除当前未发布页的发送标记，答案及已发布来源的失效继续阻断。

主要文件包括shared的material-ai-book-reference.ts、material-ai-page.ts、material-ai-source-reading.ts，main的material-ai-book-reference.ts、material-ai-repository.ts、provider、page-evidence、book-answer-index与folder-ai，以及MaterialFinalBookReferences.tsx和原页面板。新表为增量CREATE IF NOT EXISTS，收据单条上限128KiB。新策略使用既有三遍预算。依赖、模型、服务和IPC数量的增量为0。

## 验证

包内命令的工作目录为apps/desktop。

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| npm run build | PASS，含typecheck，整合main后构建 | build.log |
| node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs | 新19项通过，基套页204与配答34通过 | boundaries.log |
| node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs | 18项通过，包含优先答案、暂停恢复与缺失答案 | folder.log |
| node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs | 28项通过 | batch.log |
| npm run test:renderer-components | 246/246通过 | components.log |
| node --experimental-transform-types scripts/education/kb-book-reference-journey.mjs | 实际PDF题答目录4组通过，8条受控响应，云0，renderer错误0 | journey.json、journey.log、截图 |
| node scripts/electron-smoke.mjs | 207/207通过，同一冻结构建 | electron.log |
| npm audit --json | 既有28项，8高12中8低0严重 | audit.json |

实际题册有两页，答案册有一页。第二题通过前页章节继承匹配答案。首稿故意给第二题90℃，最终参考书册输出100℃，宿主保留answer_conflict和ai_needs_review。第一题成为book_enriched完整文档。两次最终请求包含必要knownAnswers，首次和转录请求均无候选。冷启动保留原图、原稿、上下文收据、角色和冲突。正式组卷及Pi的完整新自然主路径仍需后续验收。

该样本由Electron打印为PDF，本地解析、布局、裁图、SQLite和界面真实执行，模型响应受控。成功运行8条响应。此前保留的受控尝试共15条，包含索引等待和章节发送前阻断，本轮实际受控运行共23条，摘要见attempts.json。真实DeepSeek请求为0。原自然资料及其付费响应继续保存于原现场。

## 失败与修复记录

旧批任务测试的资源父表夹具缺少现有列表读取所需content_hash。补齐该列后28项通过，原失败保存在failure-legacy-fixture.log。

初版边界测试误把两个原页标记改成同一个主键，已限定到答案来源。原失败保存在failure-reference-test.log。

实际运行出现recover反复UPDATE触发dirty，分别在待首稿和待最终请求停留。修复移到启动恢复，并增加退避与dirty快照回归。原失败保存在failure-index-wait.log与failure-index-recovery.log。

继承章节的最终发送又因当前单元dispatch触发dirty而被拒。新校验排除当前未发布页，仍核对其余待索引事实、原上下文和最新来源。新增回归覆盖答案失效继续阻断。原失败保存在failure-section-dispatch.log。

第一次整合验收预算设8，目录按三单元预留9。通过原授权UI补至9后继续，未重发已完成请求，随后保留章节拒绝现场。复现脚本已更正初始预算9，成功验收实际仍只调用8次。budget-adjustment.json记录该操作。

两次旧构建共享Electron验证因后续修复停止，exit -1，分别有superseded日志与说明。最终共享验证已终态207/207通过，main/preload/renderer摘要前后相同，见frozen-before.json和frozen-after.json。全部验证命令已结束。

## 性能、剩余项与回滚

build-performance.json保存44767d2与本轮最终产物的体积比较。差值包含35个协作者main提交。导入吞吐、主线程峰值和40GiB检索延迟继续待测。新上下文按单元有界保存，受128KiB上限控制。

本轮将唯一已知答案参与最后整理接通。自然正文版式、自由徽标、复杂配图、物理建模和真实网上解题质量仍需实现与验收。下一步用通用来源角色处理剩余版式和图文归属，推进自然v2与独立答案检验，再走完整大库检索、组卷和交付验收。

OMNI_EDU_AI_BOOK_FINAL_REFERENCE=0停止新任务冻结参考策略。已冻结任务继续使用其保存的schema和读器。保留新表、回执、历史来源与原题。旧二进制降级待验。恢复循环修复适用于常规后台调度，回滚功能开关保留这项修复。
