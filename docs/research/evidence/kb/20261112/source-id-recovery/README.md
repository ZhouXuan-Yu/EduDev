# 已存资料来源的标识恢复

## 实际问题与修复

此前两份Word的正文重建替换了11个分块ID。原38条规则题和2个历史AI输入保留了旧引用，按原读取逻辑均遇到source_changed。本轮逐一核对，11个旧引用在当前同一位置以原ID重算完整bodyVersion均匹配，具备同内容恢复依据。

恢复沿原MaterialRepository.source、typed preload与资料正文页面完成。先核对原文件版本、位置、chunkIndex、完整正文、隐私和页码，再验证旧引用已存在于合法题目档案、阅读记录或有匹配接收回执的AI输入。当前正文复读用于检查并发变化，旧ID仍被其他位置使用时拒绝恢复。任一正文事实变化、伪造引用或缺少持久依据时，继续拒绝读取。

MaterialSourceView增加可选xiaozhi.material-source-recovery.v1，返回当前Source作为恢复依据。原引用、题目、AI输入和回执保持。正文页提示“已按原存档摘要恢复来源定位”。阅读笔记的新修订使用当前Source，原修订CAS继续校验。课标登记的新采用也使用当前Source。没有新表、第二份正文库、npm/pip依赖或模型调用。

## 实际资料结果

当前221份资料、328203104B、1312分块、3182题、310个AI单元、710份回执和710次调用。导入与folder AI均paused，应用在收尾正常关闭。

原38条旧规则题涉及的11个独立引用全部恢复。两份资料的原题本来源按钮、1366×768与1920×1080状态提示、冷启动后来源按钮读取通过，renderer错误0。2个历史AI输入的来源也属于上述11个引用，原任务保持review，本轮没有重新处理或发送模型请求。不能据此认定这些题目答案合格。

实际资料、正文分块、3182道题、310个AI单元、710份回执和893份Word历史的全行SHA在本轮前后逐项一致。恢复只影响读回与新笔记采用的来源身份。此前38条重复待核规则题继续保留，后续需要通用去重与教师保护策略。

本轮正常路径的题目标题检索返回767个候选，目标旧题位于后续分页。初始前测脚本没有处理完整分页，出现定位超时，原失败保留。修正为走原界面的实际分页后，恢复后用户路径通过。前测原构建的11次typed读取均明确source_changed，但其整体UI前测未通过，未将该报告标为PASS。

## 测试与边界

| 检查 | 结果与实际范围 |
| --- | --- |
| 新来源恢复专项 | 12项，实际SQLite和生产Repository，合成资料，覆盖已存档案/回执/阅读记录、伪造、内容/隐私/页码/顺序变化、ID复用、损坏/超限、并发、阅读修订CAS及停新开关 |
| 原来源关联 | 13项通过，原教师收藏/编辑保护、来源与回执失效、候选可见性保持 |
| 原课标登记 | 11项通过，原采用、修订、撤回、脱敏及并发门禁保持 |
| 构建与typecheck | 845a2f1构建通过 |
| 实际Electron | 38条旧题的11种来源全部通过，2份资料的来源点击及冷启通过，无新调用 |
| renderer组件 | 初始两次在同一DisclosureCard CSS模块出现Vite 60000ms加载超时，单独预加载同一真实模块也超时。预加载尝试已撤回，当前整套门禁FAIL_TIMEOUT，原断言和超时保持 |
| npm生产依赖审计 | 22项存量，低8、中6、高8、critical0，无新增依赖 |

12项专项使用Node测试环境的Electron平台占位和JSON加载桥，实际SQLite及来源/阅读实现均为生产模块。真实Electron证据单独记账。首个测试加载曾缺JSON import属性，保留失败后在测试环境补齐，未改生产解析或模型结果。课标专项通过同一测试环境预载执行，新恢复12项在该命令中再次执行，不重复累加通过数。

在apps/desktop中执行。

```powershell
node --experimental-transform-types scripts/education/kb-source-id-recovery.mjs
node --experimental-transform-types scripts/education/kb-source-origins-boundaries.mjs
node --experimental-transform-types --import ./scripts/education/kb-source-id-recovery.mjs scripts/education/material-curriculum-boundaries.mjs
npm run build
npm run test:renderer-components
npm audit --omit=dev --json
node test-results/corpus-flow-1gb/source-id-recovery-live.mjs
```

整套组件门禁尚未通过，本轮未标记完整切片或知识库验收完成。实际来源修复的专项与用户路径证据独立保留。

实际运行入口保存在仓库外D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/source-id-recovery-runtime.json，main SHA bcfc1253bf02491e34591ac26209fd6cf2725b2d343591d53799de5a600a209c，整树d2ba538e18da146595b30f9d6b80a7e73dfd06bbe2dbf51b65cac870dd25f237。代码845a2f11ab34412559156d98b932f29584a4b055。原件、完整模型响应、数据库与截图留在本机。本目录保存SHA、数量、脚本和压缩工程日志。

## 修改文件与性能

- shared/materials.ts增加可选恢复读回契约，原preload通道继续使用该契约。
- main/assets/material-source-recovery.ts按已有资源索引核对持久引用，限制JSON长度及候选数量。
- material-repository.ts核对完整旧摘要、复读当前事实，并为新阅读笔记采用当前身份。
- MaterialBodyPanel与MaterialCurriculumPanel复用原页面提示和登记逻辑。
- scripts/education/kb-source-id-recovery.mjs保存本轮回归。

此前11个来源均无法打开。当前11次实际读取包含IPC与冷启初始化，范围4.6–490.3ms，中位数8.1ms。490.3ms为这组首次读取的最大值。该样本量不足以推断长期P95或规模性能。正常当前Source沿原分支读取，新增存档查询只用于ID不符的历史引用。新增依赖和模型调用均为0。

## 回滚和继续位置

OMNI_EDU_SOURCE_ID_RECOVERY=0可关闭新的历史恢复分支，当前来源继续读取。也可正常revert本轮读回与页面变更，无数据迁移需要撤销。原档案、旧来源和付费记录不可重置。

完整Goal保持ACTIVE。下一优先处理38条重复待核规则题的通用折叠，保护教师编辑、收藏和使用记录，保留原始档案。随后贯通手动与目录quality策略，处理本地已存B/C冲突与不完整corrected响应。复杂文本框、已知答案/联网补答、自然留出质量、完整召回重排与组卷、安装迁移和约10GB仍OPEN。当前继续使用已导入的221份资料，新增导入与下载保持暂停。
