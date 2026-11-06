# 原图转录、OCR差异与按题归档

本轮从 `210b14c` 开始。实现了通用来源转录链路和教师差异展示，**没有通过自然自动归档质量验收**。最终真实一页12题仍全部待核、完整文档0、正式配答0；不能称题库已经可交付。完整 Goal 和 KB-A01～A10 保持 OPEN。

## 已实现与范围

- 复用当前 RapidOCR、原图裁剪、SQLite writer、Pi、完整题文档和现有 DisclosureCard；没有新增依赖、模型、业务表、IPC、服务或上传范围。
- 新质量任务冻结 `crop-source-reading.v1`。严格响应 `xiaozhi.material-ai-page-readings.v1` 在原结构上增加每题每组的逐字转录、裁图 SHA、原OCR文本 SHA、疑点及模型判断；首稿尚无裁图时 readings 为空。原 OCR、模型响应、来源图和历史任务不改写。
- 第二遍使用独立的来源转录 system 提示，只接收题号/分类/选块、实际图片和OCR，不接收首稿题干、页文、投影或答案，也不生成AI解答。第三遍隐藏旧AI解答与旧 readings，复核原图并求解；它仍看到来源题面，不能称第三遍盲转录。
- 新策略的局部对照使用 `xiaozhi.material-ai-crop-review.v2`，宿主计算原始 OCR UTF8 SHA256。保存的模型转录必须绑定该摘要；原OCR后来变化时旧纠错不能继续获得来源权限。模型误报 exact 拒绝；模型 corrected 自评不授予权限，教师界面的实际差异由宿主机械计算，原声明仍留在响应里。
- 独立图注只有在冻结布局归属和本题独立配图成立时归入图义，全部文字/像素保留。混合正文图块不能降为纯图；OCR为空的已知配图也不能降成纯文字。纯删除原文、未知裁图、截断、不确定、来源变化或答案冲突继续待核。
- 单题可凭完整归属的裁图、两份字面转录和严格本题解析独立认证，另一题的页文差异不连带挡住它；整页正文检索仍保留原整页一致性要求，pageIssues 不能这样绕过。实际检索库通过宿主调用同一个完整来源认证器，缺少宿主校验或OCR变化拒绝索引事实。
- 原页面板新增可折叠的原OCR/AI逐字转录对照，沿原 typed IPC 返回。两份转录一致也不会声明教师确认或数学正确。

主要改动：shared/main 的 `material-ai-source-reading.ts`、`material-ai-page*`、`material-ai-provider.ts`、`material-ai-reasoning.ts`、`material-ai-crop-review.ts`、`retrieval/repository.ts` 与 `db.ts` 宿主、`MaterialSourceReadings.tsx` 及原页面板。无 App 树重写。

## 最终门禁

命令工作目录均为 `apps/desktop`；不能从仓库根运行包内脚本或无参数调用 npx tsc。

| 命令 | 结果与证据 |
|---|---|
| `npm run build` | 最终PASS，含typecheck；`build-final.log` |
| `npm run test:renderer-components` | 246/246；renderer最终SHA与组件检查时相同；`components.log` |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | 最终191，较基线174新增17；`page-final.log`。受控图片/模型，不是自然质量 |
| `node --experimental-transform-types scripts/education/kb-crop-body-boundaries.mjs` | 21；`body.log` |
| `node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs` | 13；`folder.log` |
| `node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs` | 17，受控向量port；`retrieval.log` |
| `node --experimental-transform-types scripts/education/kb-book-answer-boundaries.mjs` | 18；`book-answer.log` |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs` | 基套34及结构化来源7；`book-document.log` |
| `node --experimental-transform-types scripts/education/kb-source-reading-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe"` | 最终真实三遍/双尺寸22组对照/冷启有效3项PASS，renderer错误0；自然质量FAIL；正向自然Pi/source未运行。见下方 |
| `node scripts/electron-smoke.mjs` | 最终冻结构建207/207，exit0；`electron-final.log` |
| `npm audit --json` | 存量28：8高、12中、8低、0严重；无依赖/锁文件变更；`audit.json` |
| 仓库根 `git diff --check` | PASS（exit0），暂存内容亦检查；原始日志按二进制保留，JSON允许CRLF |

第一批188和后续190是过程检查，不能与最终191累加。两次前构建共享Electron运行跨越了后续源码构建，因此仅保留过程日志，不作为最终冻结构建验收。

## 实际失败与修复

1. 初版受控正例被独立图注误算进正文。修复为仅依据冻结版式和已归属配图确定角色，严格检查图注在图义中，保留全部原文。没有按书、题号或具体图注硬编码。
2. 实际检索反例发现改动原OCR后仍可沿用旧 corrected 声明。已补OCR SHA绑定及冷读复算，保留首个失败日志 `retrieval-ocr-tamper-failure.log`；最终反例拒绝。
3. 第一自然试验强制高推理：第二遍推理24095 tokens，占满32768输出预算，finish_reason=length，JSON被截断。2次HTTP200、99762 tokens，未发第三遍，也未伪造完整题。原响应只留本地，公开证据为 `natural-high-failure-*`。
4. 第二自然试验默认none：第二遍JSON完整，但旧解题提示与追加的来源提示冲突，12题仍生成AI答案，严格阶段协议拒绝。另有仅空白变化被模型报为 corrected。2次HTTP200、57099 tokens，见 `natural-mixed-prompt-failure-*`。已改独立来源system提示，并把实际OCR差异判断交还宿主。
5. 最终默认none、输出32768/300秒/1MiB，三次实际响应均stop且通过协议。真实UI可看22组对照、双尺寸无横向页面溢出、冷启保持新旧原始响应；但来源字面仍不一致，全部12题待核。没有继续重发模型刷结果。
6. 原始自然报告列了4项，其中“所有可用题通过Pi/source”在可用题0时实际执行0次。原报告保留，`natural-interpretation.json`明确有效3项，正向自然Pi/source为NOT_RUN。脚本已修正未来空集合计数，不把它算通过。
7. 本轮曾误用仓库根的 tsc/包内路径、缺失tsx加载器或Node strip-only；均为命令错误，随后使用包内 `tsc`/`--experimental-transform-types` 正确执行。只读诊断也曾猜错列名/文件路径；改为真实schema/路径。证据暂存首次检查把保留的CRLF当作空白；仅在证据目录明确原始日志二进制和JSON CRLF属性，保持原始字节与摘要。停止在运行中修改生产代码后，才冻结最终构建跑门禁。

## 自然质量结论与下一主线

保留响应的零云诊断显示：来源遍遗漏或读错星级，最终遍补出星级，所有题的两份字面转录因此不一致；部分题的出版标签在pageText/readings中存在却未进入stem；末题页脚也被解析进题干。第4和6题另有首末答案冲突，第5题图内OCR存在纯删除风险。**这些差异不能通过删除星级、前缀或页脚、模糊数字单位、清空issues或把同模型一致当真值来消除。** 自然12题/22组只是开发样本，不是120留出题。

下一优先实现来源内容的角色边界：复用现有Docling/OCR版式与完整题文档，明确题面、配图、出版元数据及页脚的来源归属与坐标；全部文字和原图保留，题面/图义完整性分别证明。装饰性元数据有疑点不能冒充题干错误，也不能靠正则删前缀自动通过；角色不能可靠确定时仍待核。再把唯一、来源已认证的书册候选接入最终整理/求解，继续保留同卷同号、多源、印刷/教师角色与真实答案冲突保护。先读保留响应定位并实现通用结构，不再重复收费处理这页；其后继续真实网源、120自然留出、200查询、三套蓝图、40GiB/72h及普通Windows安装换机。

## 性能、费用与回滚

最终main SHA `e45a2f0f82af530e5705f25d0dd817d27b6fa8ff8f1f7b4463cdc1941a5725c0`，4,098,078B，较210b14c +18,192B。renderer 7,763,187B，+2,275B，SHA `cd7ad458b015f5a9aa5c8652dae9e8fec13af7ec01caccc0fe0ea7254bc2b8ba`；preload 38,520B不变。见 `build-performance.json`，不是运行性能或40GiB资格。

同一开发页前后两批三次请求的观察值：96104→95073 tokens；请求耗时合计76.49→98.27秒，不含本地OCR/调度/UI，非随机A/B或P95，不能称速度提升。最终none首遍26.82秒，与旧26.63秒同量级；高推理首遍145.95秒未成为默认。两次失败试验也计费，本轮总7次HTTP200、251934 tokens，包含截断/无效响应；答案册没有重发。见 `cloud-performance.json` 及三套原始usage账本。

`OMNI_EDU_AI_SOURCE_READING=0` 仅停止新质量任务采用新策略，保留已经冻结的协议、读器、原图和所有收据；旧任务不会被追溯改写。高推理仍仅明确环境开关时冻结；旧二进制降级未验。未上传用户PDF、图片、OCR正文、完整模型响应、DB或密钥；只有代码和不含资料正文的验证摘要/日志进入Git。
