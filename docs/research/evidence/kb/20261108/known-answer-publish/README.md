# 已知答案发布隔离与自然双线，2026-11-08～09

本片修复两类实际问题：模型首稿/最终稿同错时，没有在发布事务中与已知答案比较；章节装饰差异在参考选择及后续写回阶段绕过了已有检索投影，导致整套答案无法匹配。完整知识库Goal仍ACTIVE，KB-A01～A10仍OPEN。

## 实现与实际失败

- 旧构建真实递归PDF双线先完成答案册两轮，再完成两题三遍。参考明确100℃，模型首稿和最终均90℃，关闭异步写回后，错误题仍`ai_final`，且有完整文档。`publication-before.json/log`记录真实失败；不是仅提示词或代码猜测。
- `material-ai-page-publish.ts`在同一writer内将认证、已冻结的BookFinalReferences传入发布计划；仅available且与当前题号一致的条目参与答案比较，沿用原严格签名和answer_conflict。模型答案、解析、书册原文及回执不改。解释措辞不同不判成答案冲突，非available条目不自造答案。
- `material-ai-repository.ts`原引用SHA/本批授权/配对/原件/索引/隐私门禁仍先执行；pageEvidence回传认证引用给可信读取及本地重检。`material-ai-crop-rechecks.ts`冻结引用参与proof hash，重检不能把已知冲突放行。
- 旧已发表矛盾题在可信source/Pi/paper入口拒绝；显式教师编辑使用宿主专用校验，仍核对全部原件/响应/字段/文档，仅允许修复新发现的已知答案矛盾。`MaterialQuestionArchive`和`db`只增加原编辑writer的宿主绑定，无IPC放行参数。教师真实修正保留原模型及书册证据，不冒充自动书册答案。
- 首次自然双线5次HTTP200、84275 tokens后，12条参考全部unscoped，`natural-before.json/log`仍FAIL。只读定位：主书首稿章节含“》”，来源稿不含，而答案册基础卷12条两遍一致。collector在已有layout lookup前仍用字面章节比较。现复用既有bookSectionLookupKey，仅在冻结layoutLookup=true时比较；不同章/卷类、未知装饰和关闭投影仍拒绝。无新正则修单本资料，旧unscoped记录不改写。
- 同一差异也在实际SQLite写回fixture复现held（writeback-scope-before.log）。`material-book-answer-repository.ts`复用相同查询键连接首/最终章节；新匹配沿现有开关，已保存证据的冷读沿其冻结lookupPolicy，当前环境不能改变旧证据意义。

## 真实界面、兼容与自然结果

最终构建下，异步写回关闭时，受控正确题立即ai_final，首稿/最终均90℃的错误题首次发布即ai_needs_review/answer_conflict。5组真实目录授权、答案先行、必要参考仅最终发送、typed来源/Pi/paper门禁、双尺寸/冷启通过；8次受控HTTP，真实云0。`complete-publish.json/log`。中间构建的同类结果见publication-after.json，不能替代最终构建证据。

旧错误候选教师修正3组通过：可信入口先拒绝，原答案册面板仍可查看；教师用原编辑表单补正100℃并核对，保存为teacher_edited，来源图像不变、Pi/paper可用；冷启动保留修改、旧付费/引用和修正前快照。`legacy-edit.json/log`。原先直接复制测试库至新根的失败见raw-copy-before.json/log：原件stamp含设备/inode/时间，复制不等于受支持迁移。随后在原受控测试根编辑前保存完整before-image，原失败报告/模型账本不改；没有放宽原件身份或修改真实用户题库。

原“独立首稿错误、最终跟书一致”的4组双线流程仍通过，独立冲突保留；正例成为book_enriched，original-journey.json/log为中间构建证据。首个脚本运行仍按旧协议访问新版已隐藏的OCR字段，尚未进入发布比较就失败，harness-before.json/log单独保留；更新为当前literal.v4响应后才得到实际产品失败。

新自然目录quality批次位于本机`%TEMP%/omni-natural-paired-quality-miHb1y`。使用SHA核对过的原主书第4页/答案第3页的未改动单页提取件，并从新目录实际导入、保存两份书角色、明确授权。真实5次HTTP200、84849 tokens；答案先2轮，题册三遍，最终选中并保存12条认证答案参考。原始题文/自然截图/响应/密钥只在本地，不提交Git。

这一付费批完成后，旧脚本的窗口尺寸检查超时，保存报告natural-harness-failure.json；没有重发模型。最终生产修复通过已保存响应的实际教师“匹配本页题目的已知答案”按钮做本地重匹配：当前6题book_enriched、6题待核，11份完整文档、12题归档；旧missing_section历史日志仍保留。natural-rematch.json/log记录整合机制通过，但qualitySuccess=false、developmentPageSuccess=false，退出1明确保留整体质量失败。

重匹配验收脚本还暴露两次观察问题：冷读误走source-resume的旧batchId断言、只看到首条applied就过早关闭应用。saved-rematch-harness-before及early-observation证据分别保留；修复为显式仅本地保存继续、保留每次报告，并等待按钮结束/整页12行状态后再冷启。没有以观察超时重新派发模型，也没有通过删除历史记录凑数量。

## 精确命令与最终构建范围

命令从`apps/desktop`运行。局部套件有导入重叠，不把重复运行次数累加为功能数量。

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build`（含tsc） | 最终源码构建成功；跨夜原shell句柄未取回，保留完整build输出及当前产物摘要 | complete-build.log |
| `node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs` | 页245/配答36（原34+2）/最终引用51（原34+17），exit0 | complete-boundaries.log |
| `npm run test:renderer-components` | 246，exit0，renderer与最终构建字节一致 | components.log |
| `node --experimental-transform-types scripts/education/kb-book-reference-journey.mjs --publish-conflict` | 最终构建5组，exit0，8次受控HTTP/云0 | complete-publish.json/log |
| `node --experimental-transform-types scripts/education/kb-known-answer-legacy-journey.mjs "$env:TEMP\omni-book-reference-ui-vZz5Gu"` | 原路径教师补正3组，exit0；中间构建，后续仅章节投影新增 | legacy-edit.json/log |
| `node --experimental-transform-types scripts/education/kb-natural-book-pair-journey.mjs "$env:TEMP\omni-natural-paired-quality-miHb1y" "$env:TEMP\omni-natural-books-62sbkdoe" --cold-read --rematch-saved` | 最终构建5组机制/写回/双尺寸/冷启，新增云0；整页质量FAIL退出1 | natural-rematch.json/log |
| `node --experimental-transform-types scripts/education/kb-natural-book-source-journey.mjs "$env:TEMP\omni-natural-paired-quality-miHb1y"` | 最终构建3组，exit0，12题教师来源、Pi/paper6可用6拒绝、双尺寸/再次冷启；实际云0，2次无body模型目录GET被本地拒绝 | natural-source.json/log |
| `node scripts/electron-smoke.mjs` | 最终7358b0构建207/207，exit0，所有最终验证命令已结束；之前cde7c7构建207/207保留为中间证据 | complete-electron.log，intermediate-electron.log |
| `npm audit --json` | exit1，既有28项：8high/12moderate/8low、0critical；无新依赖 | complete-audit.json |
| `git diff --check` | 最终收尾记录 | 无输出为通过 |

## 性能、回滚及下一步

基线b7d84aa main为4,335,041B，最终4,337,174B（+2133B），renderer主包7,929,490B与preload40,997B不变。没有额外模型轮次或整库扫描；只在当前页至多20条冻结参考及现有B-tree范围查询内工作。没有大库P95、长任务吞吐或峰值内存前后实测，不能把包大小当性能验收。两轮自然批共10次、169124 tokens；11-09所有恢复均本地、没有新增模型调用。

不提供“忽略已知冲突”开关。需止损时停止新quality授权/任务，保留原件、SQLite与回执，教师可修正；回退生产源文件会重新暴露旧漏洞，不应把有矛盾的自动候选用于组卷。章节查询仍有既有OMNI_EDU_BOOK_SECTION_LAYOUT=0，仅影响新选择，旧保存证据沿冻结策略校验。无新增表/迁移/IPC/依赖，未验整个旧二进制降级。

完整目标仍未达成：当前6题待核、其中1题图文完整性、其余独立/已知答案冲突；完整自然文字和数学未独立核验。还需通用图文/答案等价与冲突整理、120题留出、200查询、三套正式蓝图、真实10→40GiB/72h、普通Windows安装和异机迁移。PDF只是开发验收样本，不按题号修题或清空疑点。
