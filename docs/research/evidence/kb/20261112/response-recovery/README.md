# 已接收AI响应的本地恢复

## 交付合同

目标M05/M10。教师在原资料AI批次界面看到确定的格式错误，能使用已保存的原响应恢复合法待核稿。恢复不调用模型，原付费身份、原件、输入图、历史协议和原始回执均保留。

基线c5bde28。上轮4个新增outcome_unknown均收到完整provider-envelope.v1。d5be6ed9第二遍将缺答案/解析检查写为uncertain。6bc817d1还漏填外层issues，但corrected.issues保存真实疑点。367d19ba首稿同时声明no_questions和非空questions，题干为空。ba16ab64首稿difficulty为空。旧v2严格解析按现状拒收这4份。

复用MaterialAiResponses、原writer、Native持久输入与图片认证、executeNativeAi的归档尾段、typed preload和原MaterialAiPanel。本轮新增本地recover_response动作及有界恢复审计表，记录原回执SHA、输入SHA、派生正文SHA和固定恢复策略。原v1/v2 parser冻结。缺角色uncertain只在明确待核且已有对应missing空角色时转换为旧协议not_applicable。漏填外层issues仅可复制同响应corrected.issues中已有的非空合法疑点。保留所有题干、答案、公式、图片和问题，不通过猜测补难度或删除冲突题列表。

确定接收的invalid_response沿原failed结果显示，未知网络结果继续保留outcome_unknown。本地恢复不增加calls，不将失败项重新排入模型队列。增量幂等迁移仅新增恢复审计，原业务记录保持。发布仍重新核对当前原件、隐私、输入摘要和角色图权限，单一writer防止重复入库。恢复失败明确保留原因，取消/重启可重试本地恢复。

完成条件为4份已存自然响应均有精确结论，两份可恢复复核得到来源绑定的待核题，另外两份显示具体格式问题。至少一次正常界面本地恢复、重复点击及冷启读图通过。原资料/旧题/旧付费回执保持，calls增量为0。定向覆盖篡改回执、过期来源、隐私变化、并发/重复、未知结果、不可恢复格式及旧协议语义。运行build、组件、受影响专项与必要smoke，记录性能和回滚，整合推送main。

当前目录221份整体质量、复杂Word/OLE、联网补答、完整召回/重排、约10GB和Windows安装迁移继续按原Goal，完整Goal保持ACTIVE。UI只补原批次的错误反馈和本地恢复操作，沿edudev-design原页面约定。

## 实际结果

当前真实库4个原任务均通过原资料页AI批次的“从已存响应恢复”处理。新增模型调用0，调用账本保持708。2份复核恢复为来源绑定的待核题，另外2份保留具体格式失败。unknown由26降至22，现有22项历史记录保持。原221份资料、1312分块、3142题及708条回执全行SHA不变，309条AI单元中仅目标4条发生预期变更，其他305条保持。当前3144题，新增恢复审计4行，Word历史仍887行。

| 原任务 | 处理结果 | 恢复证据 |
| --- | --- | --- |
| d5be6ed9 | review，新增待核题fb38d7f4 | 只将missing空答案/解析的uncertain检查转换为旧v2所需标记，原疑点保持 |
| 6bc817d1 | review，新增待核题4db5dde6 | 仅复制同一响应corrected.issues已有疑点至缺失的外层issues |
| 367d19ba | failed，response_outcome_conflict | 原响应同时声明no_questions和非空题列表，原题干为空 |
| ba16ab64 | failed，response_difficulty_missing | 原响应difficulty为空，保留原始内容 |

恢复得到的两题仍有真实图文/内容疑点，不能作为自动合格稿参与正式组卷。它们的题图已在原题本展示，SHA与持久输入和权限记录一致。首次恢复后通过typed preload重复恢复，单位事实不变。最终主线整合构建又通过正常界面重复处理冲突任务，具体错误可见，审计、单位和调用账本不变。

未来同类第二遍格式问题会在收到并保存完整响应后自动执行同一有界派生规则，再进入原归档门禁，原始响应独立保留。已经确定接收但本地发布失败的任务也保留为failed，可复用已存Word原生响应恢复。仍无完整回执的真实未知请求继续沿原显式重复计费授权流程处理。

本轮本地恢复入口覆盖Word Native题目。PDF、图片页与纯文本链路已采用确定接收后的failed语义，它们的本地复用归档入口继续待补齐。当前可查看回执并重新选择范围建立授权批次。暂停发生在收到完整最终响应之后时，任务保存为已知失败，旧retry_unknown操作不会重发这类任务。真正未知请求的显式重试行为继续保持。

## 实现和兼容

- shared/material-ai.ts扩展原AiAction和批次视图，原typed preload/IPC通道直接复用。MaterialAiPanel补充本地恢复和具体错误。
- material-ai-response-recovery.ts执行固定native-response-recovery.v1派生。原v1/v2 parser严格语义保持，所有修正仍须通过原schema、首稿SHA/题号和待核结论约束。
- material-ai-response-content.ts供实时provider和本地恢复共用有界解码。继续保留既有JSON-mode标记及missing角色标准化，完整UTF-8和JSON输出受边界约束。
- MaterialAiResponses新增审计表material_ai_response_recoveries，关联原响应ID、输入SHA、原body SHA、派生SHA、策略和修改项。增量幂等迁移，无既有业务列修改。
- executeNativeAi和本地恢复共用publishNativeAiResult，继续执行原件、来源、隐私、源图权限和单writer提交检查。关联目录单元同步更新，目录暂停状态保持。
- 无新增npm/Python依赖，无新模型账户或Agent运行时。SQLite/文件继续为真源，Pi边界保持。

首次真实恢复的候选代码62375f4，后续8b94338补齐已知接收后本地发布失败的语义。已合入协作者2792cbf来源入口UI。最终运行代码/生成清单01c674f，main SHA 23eb7ef12cd1f7865625990a09026ad8333439c5a00892e743d1c2f986901c91，整树SHA bb78469bad6cc6ba309ed5f51648d9ffb47ee001520f267de0b5eef53fc78579。其后专项预期更新只修改测试。

## 验证证据

| 检查 | 实际范围 |
| --- | --- |
| 新恢复专项 | 13组通过，SQLite/受控provider和原生输入fixture，包含历史/自动恢复、并发/重复、回执篡改、隐私、真未知及本地发布失败 |
| 原批次边界 | 31组通过，确认已接收后暂停保存为failed，完整回执和计费保持 |
| 页/图片及回执边界 | 246组通过，包含真实执行器、SQLite及受控provider，保留未知网络重试、原图及来源门禁 |
| 原Native dispatch / ledger | 17 / 20组通过 |
| 原v1/v2字段复核协议 | 27组通过，历史严格拒收保持 |
| npm run test:smoke | 207/207，exit0，来自62375f4候选，早于已知本地失败补充和协作者最新UI整合 |
| 最终整合build/typecheck及组件 | 通过，246/246组件 |
| 原4题和新恢复2题冷读 | 最终构建通过，源图SHA一致，两尺寸角色控件可达 |
| 历史已确认试卷与两份PDF | 只读回归保持，原确认由自动化测试代理操作原界面 |
| 最终正常界面恢复重试 | 具体错误可见，单位/审计不变，新增调用0 |
| npm生产依赖审计 | 22项存量，低8/中6/高8，无新增依赖 |

批次、页和回执的旧测试曾把完整接收后的暂停或格式拒收断言为outcome_unknown。本轮保留原失败日志并改为断言failed、原始回执和零自动重发，同时保留真正未知请求的原断言。首次运行部分脚本缺少模块加载或TypeScript参数，已使用下面的显式命令运行，单独加载导出测试模块未计为执行通过。

工作目录D:/WorkProject/EduProject-kb-isolation/apps/desktop。

```powershell
node --experimental-transform-types scripts/education/kb-response-recovery.mjs
node --experimental-transform-types scripts/education/kb-native-dispatch-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-ai-batch-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-native-ledger-boundaries.mjs
node scripts/education/kb-native-field-review.mjs
npm run test:smoke
npm run build
npm run test:renderer-components
npm audit --omit=dev --json
```

原界面动作及只读恢复核对使用test-results/corpus-flow-1gb中的response-recovery-live.mjs、response-recovery-cold-original.mjs、response-recovery-cold.mjs、response-recovery-final-action.mjs和response-recovery-facts.mjs。本目录保存压缩工程日志及数量/SHA元数据，完整模型响应、数据库备份、原图和截图保留在仓库外测试根。

## 性能与回滚

原流程对已收格式问题停在unknown，需另行决定重发。本轮同4份回执本地处理均无需模型调用，实际每项211–415ms，包含正常UI动作、归档及一次主机重复校验。该测量来自首次62375f4恢复过程。离线单次4份校验约0.05–1.08ms/份。未测长期P95、峰值内存或约10GB规模。

原数据库已在迁移前通过SQLite backup保存到仓库外response-recovery-before.db。恢复审计和原回执保留。自动派生可通过OMNI_EDU_AI_AUTO_RESPONSE_RECOVERY=0关闭，原回执采集开关独立保持。若需代码回滚，正常revert本轮入口与调度变更，保留历史v1/v2 reader及已生成的合法派生结果。新增表保持，原资料、旧题、回执和计费不得重置。

## 下一项实际缺陷

本轮额外只读盘点了148份Word的2458处source_warning，全部来自局部块，文档全局未定位警告为0。已可读取范围内AlternateContent涉及1811处、文本框1751处、field_or_symbol899处，计数重叠。另有48处来源超过当前读取预算，其局部分类未完整核定。汇总见response-recovery-next-source-gaps.json。

下一优先修复AlternateContent/文本框导致的大批图文来源不完整或归属待核。先核对原件、当前分支选择、布局和图文对应，复用已有OOXML/OCR及成熟本地渲染/转换组件，冻结版本化来源升级和历史读取合同。应恢复真实内容或取得可验证版式依据，单独删除警告不能满足验收。当前221份需有新的受影响题沿正常后台自动处理到可用稿，原图/公式/答案和来源可追溯，再继续其余知识库闭环。复杂Word/OLE、缺答案联网补答、完整召回/重排、安装迁移和约10GB仍OPEN，完整Goal ACTIVE。
