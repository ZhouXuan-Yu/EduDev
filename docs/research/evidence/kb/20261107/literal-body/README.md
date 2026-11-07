# 无损正文与出版信息分离

基线8c99883，功能72eaa11，整合协作者main 84b6a9c的合并为1c1881a。完整Goal未完成。复用既有分区器、三遍、OCR/版面、QuestionDocument及逐题归档，不增加数据库表、IPC、依赖或服务。

## 已确认的问题与修复

对旧批aibatch_fa9c7885-1628-40e3-83e1-32cfd8848998进行只读诊断，先通过生产readPageFragments核验原件/裁图/版面/SHA，再用createCropReview、readingBodyComplete及pageFragmentsAgree检查。7题的模型publication=true遇到题前标签，旧宿主保留全部正文却标incomplete_question。其中部分题另有边界或答案冲突，不能视为仅元数据问题。prior-held-diagnostic.json不含原书题面，只记录各项判定；原PDF、裁图和题目均留在本地。

上一轮策略混淆了“标签无法分类”和“缺失题面”。新任务host-crop-body.v4使用literal.v4，模型裁图仅返回index/text/issues；宿主只分离首正文匹配的题号与严格闭合年份出处，未知标签、出处、条件全文仍进body，不新增元数据事实或缺题结论。旧v1/v2/v3任务及其判定保留，失败历史不改写。

错父题号、空正文、未知字段、伪造source角色、图片/表格缺口、两遍文字差异、OCR删字、原裁图边界及答案冲突继续执行原门禁。最终模型输入仍采用白名单、同版嵌套答案，原生成解答隐藏、印刷source保留。新完整题文档parserVersion标明v4。

主要修改shared/material-ai-host-partition.ts、material-ai-literal.ts、material-ai-page.ts，以及main/assets/material-ai-repository.ts与material-ai-page-fragments.ts。原typed preload、来源对照、题本与组卷资格入口沿用。

## 当前验证

cwd为apps/desktop，以下均记录真实命令结果，不代表完整产品接受。

| 命令 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | PASS，tsc.log |
| `npm run build` | PASS，含typecheck，build.log |
| `npm run test:renderer-components` | PASS 246，components.log |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | PASS 245组，原240+5组v4，page.log |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs --literal --partial` | 实际递归PNG导入/本地OCR/三遍/双尺寸/冷启/typed来源及生产Pi reader与paper basket检查5项PASS，controlled-report.json |
| 相同来源脚本对旧v3库 `"$env:TEMP\omni-source-content-ui-gHgncj" --literal --partial` | 旧冻结题/待核状态、原始响应及双尺寸/冷读4项PASS，legacy-v3-cold-report.json |
| `node --experimental-transform-types scripts/education/kb-source-reading-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" --source-content --literal` | 新自然批机制检查4项PASS，8题自动可用/4待核，独立质量未接受，natural-report.json |
| `npm audit --json` | 退出1，既有28项，8高12中8低0严重，audit.json；依赖未变 |
| `node scripts/electron-smoke.mjs` | 同一冻结构建207/207 PASS，electron.log；冻结前后摘要一致，所有本轮运行命令均已结束 |
| 合入5个脚本 `node --check`、基线JSON解析及metadata helper `selfTest()` | 5项语法与JSON解析通过，helper 26项PASS，零启动/模型/HTTP，merge-selftest.log |

新增5组覆盖未知前缀/条件无损保留、合法出处分离、父题号/空正文/独立图、v4拒绝旧publication与伪造source、真实不确定逐题待核，以及实际provider/executor部分归档和冷读。旧v3测试显式冻结旧策略，仍验证错误出版声明待核，不把旧预期改成v4行为。

受控HTTP3次、云调用0，完整题归档，第二题因uncertain_ocr待核；教师可检查其来源，正式Pi读取与组卷拒绝。三份原始envelope与canonical分别保存，重启无请求重放，renderer错误0。受控结果不表示自然图文或数学通过。

## 性能与回滚

main由4328900B增至4330136B，增加1236B；preload保持40997B，renderer主入口保持7920365B。冻结main SHA为1e3ab981b0b287f5a212168dde814faf7396d6b3e22f1fdbebd3d63c68b674c6。此比较仅为产物大小，不证明整库吞吐、内存、Recall或P95。

OMNI_EDU_AI_HOST_BODY=0使新任务回退v3，HOST_PARTITIONS=0回退v2，LITERAL_READING=0停新最小协议任务，均使用OMNI_EDU_AI_前缀。旧v1/v2/v3/v4读器和原始回执保留；旧二进制降级未验，不删除历史数据或教师产物。

## 自然资料及整合

新批aibatch_73727b15-cedb-4933-976d-83a6ea4e1e00三次真实DeepSeek均HTTP200/finish=stop，共60834 tokens。12题均完成归档，10份完整题面文档，8题ai_final，4题仍待核。每份自动可用题通过实际typed来源入口，来源对照/双尺寸/冷启4项PASS，renderer错误0、旧付费回执和题目指纹不变。相比上一开发批4份文档/4题可用，当前为10份/8题；不同批模型解答存在随机差异，不将全部差异单独归因于本片。

第2/5题仍因裁图边界或来源完整性不能生成完整文档。第6/10题形成完整题面文档，但首稿和最终答案冲突而保持待核；不因文档完整而放行解答。题号仅为诊断标识，不写入生产规则。新批没有删除题前标签或条件来提高通过率，旧批也未改判。

raw envelope在本机SQLite及source-content-natural-E35jLH目录保留。Git只保存脱离题面/解答的计数、状态、收据摘要与受控PNG截图，不上传原PDF、自然裁图/题目或自然截图。受控3次HTTP，真实3次云请求，没有自动重发。自然语言Pi取题和独立数学/逐字金标尚未在本批验收，qualitySuccess仍false，不等同完整产品质量通过。

整合只增加/修改5个验收脚本、一个基线JSON和文档/证据，没有生产源码或依赖变化。5项语法和JSON解析通过，原metadata recovery helper的26项selfTest通过，零启动/模型/HTTP，merge-selftest.log。涉及协作者另一工作树保留资料的完整migration回归未在本机重复，不能把纯自测当其自然验收。

共享Electron207/207通过，使用与实际自然批相同的1e3ab981构建。frozen-before/after.json完全一致，全部本轮验证命令均已结束。integration-summary.json记录整合与构建范围。KB-A01～A10继续OPEN，下一先处理通用裁图边界与独立答案册配答/冲突；继续120题留出、200查询、三套蓝图、真实10→40GiB/72h、普通Windows安装及异机迁移。PDF仍只是验收样本。
