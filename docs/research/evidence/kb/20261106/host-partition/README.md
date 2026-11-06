# 宿主分区与逐题待核

本轮功能基线为d55699e，功能提交aed12a3，整合协作者main至d3d987a的合并提交83f5ad4。新任务冻结host-crop-partition.v3，模型逐裁图只提交一次完整text、publication布尔和疑点。宿主依据原裁图kind生成marker/body/publication/figure，canonical沿原page-readings.v2与题库、来源、权限和租约门禁。table/mixed的文字全部保留正文，独立figure保留图中文字。没有新增表、IPC、依赖或服务。

只有显式声明、首正文开头、匹配括号、四位年份与考试类别结尾的引用可分出publication；额外条件保留正文。错误出版声明、缺图/表语义或空正文只让本题待核，完整同页题继续生成文档。空读数保留空原文，先前题干仅供待核展示，不获得完整文档。任意畸形结构/未知字段、错序、伪造source解答仍严格拒绝，本轮没有实现任意畸形逐题结构隔离或已收响应本地恢复。

实现见shared/material-ai-host-partition.ts、material-ai-literal.ts及原main/assets的provider、repository、crop-review、source-reading和page-fragments。旧v1/v2冻结读器继续保留；新完整文档parserVersion标明v3。

## 桌面路径与纠正

实际递归PNG导入、本地OCR/版面、三次受控HTTP已产生两题。第一题完整文档ai_final，第二题错误出版声明保持ai_needs_review、正文仍含学习提示、无document，单元review。三份原始HTTP envelope与派生canonical在SQLite分别保存。

初次桌面脚本因窗口尺寸等待失败，保留controlled-initial-failure.json/log。脚本显式退出最大化/全屏后，复用原库冷读双尺寸成功，又因错误预期教师来源读取被拒绝而失败，保留controlled-source-expectation-failure.json/log。没有重放OCR或模型来掩盖失败。

当前生产questions:context-source允许本机教师检查已认证待核内容。其成功不授予Pi工具读取或组卷资格。修正脚本后，实际typed IPC证明待核可检查；同一生产createQuestionContextProvider通过IPC读取实际题目/来源/隐私数据，完整题读取成功，待核题返回document_context_unavailable且不触发onRead；生产basketQuestionAvailability拒绝待核题。该脚本直接调用生产provider函数，尚不是自然语言Pi会话。

controlled-cold-report.json为4项PASS，1366×768与1920×1080冷读、原件/题文档/收据不变、新请求0、renderer错误0。脚本原三次HTTP为受控响应，云调用0；不能计入自然识别或数学质量通过。

## 已执行检查

命令cwd为apps/desktop。初次与后续失败均保留。

| 命令 | 结果与记录 |
| --- | --- |
| `npm run build` | PASS，含typecheck，build.log |
| `npm run test:renderer-components` | PASS 246，components.log |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | PASS 240组，原232+8组，page.log |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs --literal --partial` | 创建两题与原始收据后窗口尺寸失败，controlled-initial-failure |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs "$env:TEMP\omni-source-content-ui-gHgncj" --literal --partial` | 最终冷读4项PASS，未新增模型/OCR请求，controlled-cold |
| 旧v2库的相同来源脚本 `--literal` 冷读 | PASS 3项，无新请求，legacy-v2-cold.log |
| `npm audit --json` | 退出1，既有28项，8高12中8低0严重，audit.json |
| 最终阶段提示修订后的 `npm run build` | PASS，含typecheck，build-final.log |
| 提示修订后的页归档脚本 | PASS 240组，page-final.log |
| 提示修订后的同一两题库冷读 | PASS 4项，无模型/OCR重放，controlled-final-cold-report.json |
| 输入接口修复后的 `npm run build` | PASS，含typecheck，build-transport.log |
| 输入接口修复后的同一两题库冷读 | PASS 4项，最终构建f46b3af，无模型/OCR重放，controlled-transport-cold-report.json |
| `node scripts/electron-smoke.mjs` | 两次207/207，分别在407cd9f与cb163ba构建，electron-before-phase.log、electron-before-transport.log；最后输入接口修改后没有再次跑全套 |
| `node --experimental-transform-types scripts/education/kb-source-reading-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" --source-content --literal` | 最终新自然批4项机制检查PASS，4题可用/8待核，质量仍FAIL，natural-transport-report.json |
| `node --test scripts/acceptance/chat-live-public-probe-test.mjs scripts/acceptance/chat-reading-navigation-test.mjs` | 整合后PASS 10，merge-tests.log；7个合入脚本语法检查通过 |

新增8组检查覆盖逐字符分区与Unicode、引用/父题号边界、旧策略兼容、错误出版/表/图逐题待核、空正文、畸形闭合与伪造答案拒绝、实际executor同页部分发布/冷读、新任务开关回退v2。

## 性能与回滚

相对d55699e，初次main从4322122B增至4326908B，阶段提示修订为4328234B，最后输入接口修复后为4328900B，合计增加6778B。preload保持40997B，renderer主入口保持7920365B。最终main SHA为f46b3afef1d9dbc96512a95d267cfebe4844fdb507590f32ff150c12a4f14bc3。frozen-transport-before/after.json完全一致。此数据只说明产物大小，不证明整库吞吐、内存或准确率。

共享Electron207/207在cb163ba构建通过；最后输入白名单改动后，按影响运行页归档240、build/typecheck、实际受控冷读4项及真实自然三遍/双尺寸/冷启4项，没有再次跑全套207。组件246的renderer产物仍相同，不将旧main的207声称为新main的全套结果。合入7个脚本与文档/证据，没有生产源码或依赖变化；integration-summary.json保存范围。

OMNI_EDU_AI_HOST_PARTITIONS=0让新最小协议任务回退v2；OMNI_EDU_AI_LITERAL_READING=0停止新最小协议任务，已冻结v1/v2/v3继续可读。旧二进制降级未验，不删除原资料、教师题目或付费记录。

## 首个自然批与阶段提示修订

自然批aibatch_cf9c21f4-9718-4b09-9e0a-5b85e0120bb3三次真实DeepSeek均HTTP200/finish=stop，共61730 tokens。12题已归档，4份完整题面文档，12题仍待核，可用稿0。实际来源对照/双尺寸/冷启3项通过，renderer错误0，历史付费/题目指纹不变。机制路径成功与质量FAIL分别记录于natural-first-report.json。

来源遍与最终遍22份裁图文字相同，原OCR删字检测未触发，但多题仍有出版声明、图表及原页解析一致性门禁未通过。两遍相同不能证明逐字正确。尤其两遍均将12题答案解析全部标missing，最终没有履行求解任务。不能因为响应格式正确就认为产品可用。

v3提示将“原图印刷角色缺失”与“最终无法求解”分别表达。来源遍明确不求解，最终遍明确来源稿空答案不阻止求解，能求解的角色生成ai_generated并给出依据，条件不足仍missing并保留疑点。旧v1/v2提示继续保留，宿主不把missing改为生成答案，不用首稿填空。此修订只针对已确认的最终角色行为；尚不能断言此前模型未求解的内部原因。首批失败、原始HTTP和付费记录没有修改。

## 第二批失败与来源稿接口修复

阶段提示修订后的新批同样完成三次HTTP200/finish=stop，但第三遍严格拒绝invalid_response，未产生final_json或新题。原始响应先留存，natural-phase-failure-report/shape/cloud-ledger/log保存机制失败。最终模型已生成答案和解析，却在每题使用answer/analysis字符串及answerOrigin/analysisOrigin，违反v3的嵌套角色要求。没有将该批改为成功，也未回放或回写失败响应。

检查宿主请求发现，最终firstDraft仍是旧canonical表示，含扁平答案角色和旧schemaVersion。新的输出协议与输入示例不一致。仅v3最终请求改为白名单来源稿，保留number/stem/projection、分类、图片依赖/疑点、fragments与嵌套answer/analysis，不再传旧schemaVersion/outcome或扁平origin字段。原sourceReviewDraft仍先隐藏生成内容，source原文继续保留。v2最终稿保持原对象，不改历史reader。

240组检查增加了对应断言，覆盖生成答案隐藏、印刷source原文保留、旧v2上下文兼容与生产provider最终请求不带旧字段，见page-transport-final.log。此修复不授予未知字段容错或重新解析旧回执的业务权限。

## 最终自然结果与剩余工作

最终新批aibatch_fa9c7885-1628-40e3-83e1-32cfd8848998三次真实DeepSeek均HTTP200/finish=stop，共61011 tokens。第三遍12题均按嵌套角色生成答案和解析并成功解析、逐题保存。4题ai_final并有完整题面文档，8题待核；每份自动可用题通过实际typed来源读取。原图对照、双尺寸、冷启、历史付费/题目指纹检查4项通过，renderer错误0。自然语言Pi取题尚未在这批实测，数学/逐字独立评估未通过，不能称质量合格。

第1/4/5/6/8/9/10题存在incomplete_question，第2题还因来源一致性待核；第4/6/10题首稿与最后答案冲突，配图题的实际完整性仍须逐字检查。题号仅为本次诊断标识，不进入生产规则。下一步定位出版声明导致的误拦与真实正文/图义差异，保留全部文字及物理条件，按通用契约修复，不放宽答案冲突或按样本改规则。

三次自然新批合计9次真实请求、185609 tokens；受控HTTP仍为最初3次，后续冷读没有重放。旧两批失败仍FAIL，所有raw在本机SQLite/测试目录保留，未上传自然题面/答案、原PDF或截图。natural-transport-cloud-ledger.json中的sourceOnlyDraft是旧的“无pageText”启发式，新白名单最终阶段也可能true；真实阶段以phase、explicitAnswerStage及systemSha256为准。脚本已改为按明确phase记录，并另记draftOmitsPageText，未修改已付费日志。

完整Goal仍未完成，KB-A01～A10保持OPEN。任意畸形逐题结构隔离、已收响应本地恢复、120题留出、200查询、三套蓝图、真实10→40GiB/72h与普通Windows安装换机继续执行。PDF仍只是验收样本。
