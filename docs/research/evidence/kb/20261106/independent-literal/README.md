# 独立读图、裁图角色与自然失败定位

## 本轮修复

新任务冻结host-independent-literal.v2和xiaozhi.material-ai-literal.v2。首遍继续OCR与图像，来源阶段不再发送原OCR、块文字、首稿正文/分类、sourceFound/sourceStemMatches或localReview。最终整理保留来源稿、图片与已知答案，同时隐藏原OCR。宿主保留原始OCR、SHA和裁图权限证明，独立比较返回文字。v2 wire不接收模型自报assessment，宿主计算exact/corrected，真实疑点和OCR截断继续待核。

crop-review.v3复用已有isDiagramGroup、图注和表格版面，给出body/table/figure/mixed提示并验证。table内容保留题面，mixed/figure保持图片依赖。v1 prompt、wire和已有题文档读器保留，无新增表、IPC、依赖或服务。

主要修改shared/material-ai-literal.ts、material-ai-page.ts、material-ai-owned-crops.ts，以及main/assets/material-ai-crop-review.ts、material-ai-provider.ts、material-ai-source-reading.ts。新增6组边界，扩展原实际导入/自然验收脚本。功能提交581c53e，基线ba18d7b。

## 纠正上一轮判断

上一轮从AI读数缺少第10题首行推断裁图/选块不完整，证据不足。本轮直接查看已存702×439裁图，并核对SHA256为6be85184150cc5b474a9fc8e27daed13bab8ae37bdd8805e46a095baa999e08c，首行、图形和末项均完整。原OCR和随后AI读数同时漏首行，修复应先隔离OCR对图像读数的锚定风险。不能据此证明模型内部为何漏字，也不把OCR的错误判断传给第二遍当质量结论。

prior-selection-correction.json保留此证据，上一轮失败、诊断和历史结论继续保留。本轮没有按该题号修改生产规则或扩大矩形。

当前Flash内联图像格式及本轮23图数量符合官方视觉接口说明，auto与original当前等价，沿用现有图像请求格式。此核对只证明格式和限额，识别效果另行验收。[DeepSeek官方视觉文档](https://api-docs.deepseek.com/guides/vision/)

## 已执行检查

cwd为apps/desktop，所有本轮最终命令均已结束。

| 命令 | 结果及证据 |
| --- | --- |
| `npm run build` | PASS，含typecheck，build.log |
| `npm run test:renderer-components` | PASS 246/246，components.log |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | PASS 232组，原226+新增6组，page.log |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs --literal` | 实际受控PNG递归导入/本地OCR/三遍/题本/双尺寸/冷启/原始wire4项PASS，controlled.log/report |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs "$env:TEMP\omni-source-content-ui-yY8qg4" --literal` | 旧v1冷读3项PASS，无新请求，legacy-v1-cold.log/report |
| `node --experimental-transform-types scripts/education/kb-source-reading-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" --source-content --literal` | FAIL，退出1，第三遍invalid_response，natural.log/report |
| `node scripts/electron-smoke.mjs` | 最终同一冻结构建207/207，退出0，electron.log |
| `npm audit --json` | 退出1，既有28项，8高12中8低0严重，audit.json |
| `git diff --check` | 收尾执行 |

新增6组检查覆盖新旧冻结策略/review、表格/独立图/混合/续页图注角色、来源上下文无OCR/首稿泄漏且宿主证据不变、宿主计算OCR一致性、截断和真实疑点待核、错误角色/图片撤销拒绝、生产provider保留相同授权图像/原始响应并派生canonical。受控Electron内再次断言第二/第三遍无material、blockTexts和宿主比较结论，来源firstDraft只含题号。

受控provider完成3次HTTP，云调用0、renderer错误0。原图、出处差异、canonical来源分区和三份原始envelope冷读一致。截图仅来自自造PNG。自然资料、原始题面/解答和相应截图没有上传Git。

## 自然结果

新批aibatch_6f507626-3c71-4872-8c1f-5d915d451428共3次真实DeepSeek Flash调用、63353 tokens，全部HTTP200/finish=stop。第二/第三遍请求明确隐藏OCR，记录于natural-cloud-ledger.json。第一遍和来源稿已保存，第三遍完整原始响应也在校验前保存，三份接收字节/SHA见natural-independent-diagnostic.json。

来源第二遍恢复第10题完整题首，第8题表格按body保留且tables=provided。模型不再一律标uncertain_ocr，22份局部读数自报疑点为0。模型自评仍需独立核对，不能计为逐字或数学质量通过。

第三遍在第10/12题的mixed裁图中输出marker/body/figure，违背整份混合裁图保留body的角色约束，且两份文字也发生差异。原严格校验正确拒绝，批次outcome_unknown，error为invalid_response，final_json为空，新入题本/完整文档/自动可用稿均为0。其他图组也有文字差异，需继续核对。没有清除疑点、忽略差异或再次请求模型。

只读重建已认证裁图review后，来源canonical逐字复现成功。逐题隔离诊断中10题通过wire形状解析，2题仍拒绝。这只定位当前整页原子校验的问题，不代表10题正文/图义/数学已通过，不授权回写或恢复。历史付费回执与题目指纹不变，原自然两批失败和旧待核题保留。

## 性能、兼容与回滚

相对ba18d7b，未压缩main由4316856B增至4322122B，增加5266B。preload保持40997B，renderer主入口保持7920365B。frozen-before.json与frozen-after.json一致，最终共享Electron使用同一冻结产物。未据单页调用推断整库吞吐、准确率或费用保证，真实40GiB/72h、峰值内存、整请求SLO及Windows安装换机仍待验。

OMNI_EDU_AI_LITERAL_READING=0停止新最小协议任务，已有v1/v2继续保留派生器、crop-review读器和原始接收证据。旧二进制降级未验，本地重新解析/恢复业务入口尚未实现。

## 下一执行项

完整Goal保持ACTIVE，KB-A01～A10仍OPEN。优先由宿主按冻结裁图角色生成完整分区，减少模型重复分类，并实现逐题错误隔离，保留真实文字差异与待核状态。已保存响应的本地恢复须补齐冻结请求证明及原权限、来源、租约校验。继续120题留出、200查询、三套蓝图、真实10→40GiB/72h、普通Windows链式安装与异机迁移，PDF继续作为验收资料。

末尾无冲突整合协作者main至695d86b，仅四个验收脚本及文档/证据变化，生产源码和依赖与535923d相同；四项语法及七项纯自测通过，冻结构建摘要不变。merge-selftest.log记录纯自测；它只证明此次脚本整合边界。
