# 最小来源转录与宿主派生

## 实现结果

新任务冻结literalReadingPolicy=host-derived-literal.v1，来源和最后整理阶段接收xiaozhi.material-ai-literal.v1。模型只输出一次逐裁图parts，宿主拼接原文、body题干、statement和覆盖字段，并从原裁图请求绑定SHA/OCR SHA、分类和fragments。原始HTTP envelope在派生前留存，派生canonical仍走原page-readings.v2 parser、来源归属、两遍字面、OCR删字、隐私、租约和教师确认门禁。旧任务和原始回执不改写。

主要修改shared/material-ai-literal.ts、material-ai-page.ts，以及main/assets/material-ai-provider.ts、material-ai-repository.ts。复用原typed资料批次、题本与来源对照界面，无新增表、IPC、依赖或服务。印刷source答案解析只允许本题已拥有裁图中的文字，不能引用页眉或邻题，答案册保持独立book-reference身份。

完整Goal保持ACTIVE，KB-A01～A10仍OPEN。协议已实现，整套自然题库质量仍FAIL。

## 验收命令

cwd为apps/desktop。

| 命令 | 结果与证据 |
| --- | --- |
| `npm run build` | 整合后PASS，build.log，含typecheck |
| `npm run test:renderer-components` | 整合后246/246，components.log |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | 整合后226组，基线220+新增6组，page.log |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs --literal` | 受控实际PNG/本地OCR/三遍/题本/双尺寸/冷启3项，controlled.log |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs "$env:TEMP\omni-source-content-ui-yY8qg4" --literal` | 整合最终冻结构建只读冷读3项，integrated-cold.log，无新请求 |
| `node --experimental-transform-types scripts/education/kb-source-reading-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" --source-content --literal` | 自然运行集成3项PASS，质量FAIL，natural.log/report |
| `node --experimental-transform-types scripts/material-paste-boundaries.mjs` | 协作者整合8项，merged-paste.log |
| `node --experimental-transform-types scripts/paper-paste-panel-test.mjs` | 协作者组件6项，merged-panel.log |
| `node scripts/electron-smoke.mjs` | 最终冻结207/207通过，退出0，frozen-after.json与electron.log |
| `npm audit --json` | 退出1，既有28项，8高12中8低0严重，audit.json |
| `git diff --check` | 收尾执行 |

新增边界验证冻结版本、新旧prompt兼容、宿主派生、同序裁图、未知/冗余字段、超限、错误角色、源解答伪造与邻题冒认、真实疑点继续待核、provider先留存后派生、冻结新任务拒绝旧wire。已有220组继续覆盖取消、旧租约、重启、图像身份、来源/隐私/付费预算和写入一致性。

## 自然结果与真实缺口

同一已授权且未修改的开发页首次完成3次HTTP200与finish=stop，共81075 tokens。来源及最终最小wire分别为18398B和21463B，宿主派生为45920B和48985B。当前原始响应及资料保存在用户本机，Git中只保存无题面正文的报告、使用量与摘要。

12题仍全部ai_needs_review，完整文档0、自动可用稿0。模型在两遍均将全部22份局部读数标uncertain_ocr，页级及逐题也保留疑点。只读诊断另外发现OCR字符纯删减风险、一道表格被模型标为figure而宿主归属为body。对照原图已见题首文字缺失，例如题10局部来源从中途开始。全部12题的来源/最终stem和图义一致，仍不能证明选块或原题完整。没有删除疑点、改写原题或放宽门禁，没有自动重发。

natural-literal-diagnostic.json只包含布尔判断、角色、长度等诊断。它是当前读数拒绝原因的证据，OCR纯删除检测本身不证明每个被删字符都是真实印刷文字。旧自然12题及上一轮两个失败付费批保持原状。

自然真实运行使用dfe81cf3bf9fae2066269df315323717ce7181b66a76549c631cf591f2974ebc构建。之后收紧本题印刷答案归属，再整合协作者粘贴资料入口。对当前已保存原图、裁图、首稿和原始wire执行只读复验，最终派生器逐字重建两份canonical，SHA一致，OCR/云调用0，原回执不变，见natural-literal-final-adapter.json。该复读没有改变自然质量或提供本地重解析业务入口。

## 受控用户路径与证据边界

实际递归PNG导入、正式本地OCR/版面、三遍HTTP、题本、typed题源与双尺寸/冷启通过。刻意保留两份出处年份差异，body与出版原文分别归档。三份原始provider envelope分别为旧首稿schema和两份新literal wire，canonical保持page-readings.v2。整合最终冻结构建再次只读冷开原fixture，核对原件、原回执、题文档及三份原始响应摘要，新增请求0。

controlled-report.json保留初次运行，controlled-final-cold-report.json保留整合前冷读，integrated-cold-report.json保留最终构建冷读。controlled-*截图均来自自造PNG，真实题面及其截图没有上传。

最初共享回归在收紧source归属前已启动，运行中构建发生变化。mixed-build-electron.log虽207/207，仍不计作最终冻结验收。后续整合后重新构建，冻结frozen-before.json，再启动最终共享回归。最终终态及产物摘要记录在frozen-after.json，原混合构建结果继续保留。

## 性能与兼容

相对1e3fd7c，最终未压缩main由4302587B增至4316856B，增加14269B。preload由40801B增至40997B，增加196B。renderer主入口由7910590B增至7920365B，增加9775B。包含协作者粘贴资料入口，不能单独归因本协议。该开发页来源与最后整理的wire正文比派生canonical分别少约60%和56%，未据此推断整库吞吐、费用或准确率。

保留原1MiB HTTP和128KiB canonical预算。派生字段可重建，原始收到响应不可重建并随SQLite备份。真实40GiB、72h、峰值内存、整请求SLO和Windows链式安装/异机迁移本轮未验。OMNI_EDU_AI_LITERAL_READING=0停止新任务采用最小wire，已有冻结任务保留派生器、canonical读器及原始回执，旧二进制降级未验。

## 下一执行项

优先修复首遍选块漏题首/末条件及正文、表格、独立图归属，复用冻结版面、原OCR和现有裁图器。随后让疑点定位到具体文字/分区，保留真实不确定，不能凭两次相同抄录清除。继续120题自然留出、200查询、三套蓝图、真实10→40GiB/72h及普通Windows安装换机。PDF继续作为验收资料。

最终共享回归已结束，207/207通过，三份构建摘要与启动前冻结值一致。本轮全部最终验证命令已终态。
