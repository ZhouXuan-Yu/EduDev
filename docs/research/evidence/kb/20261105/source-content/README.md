# 来源内容分层与图片归档链路

从 `ab4854248fbcef960523644fa54fdc756b6dedf8` 开始。本轮实现并跑通受控图片导入、完整题文档与教师来源对照；**没有完成自然题库质量、大库性能或最终交付验收**。完整 Goal 保持 ACTIVE，KB-A01～A10 仍 OPEN。

## 教师能得到的结果

递归目录中的新标准/质量图片现在进入现有版面、题块、图文核验、归档与冷读链。质量模式按三遍预留调用次数；Word/文字仍双轮，PDF继续其原链。原图、旧 OCR、历史模型响应和教师记录不变。实际 PNG 路径已从资料页选择目录、授权、后台本地识别，到题本打开正文/出处分区与重启读取贯通；模型响应受控，不能算自然质量。

新 `source-content-roles.v1` / `xiaozhi.material-ai-page-readings.v2` 保留 marker/body/figure/publication 的原文分区，按顺序拼接必须逐字等于整组转录；宿主计算 UTF16 字符范围，并绑定原块、裁图与 OCR 摘要、页坐标。题干仅取严格认证的正文，独立配图保持图片和图义。出版出处仅允许首正文组题面前的闭合年份出处，未知徽标/自由前缀仍属正文或待核，不能任意把条件、数值或页脚改成元数据。出版差异保存两份原文并单独提示，不授予已确认出处或难度；正文、图注、数字、单位、答案及来源分歧仍严格拦截。

新图片派生使用独立 `electron-43.8.3-image-page.v1` 凭据，page/total 必须为 1。版面识别、模型输入和裁图来自同一 PNG 栅格，不伪造 PDF 收据。复用既有 PP-DocLayout 缓存、RapidOCR worker、SQLite writer、typed IPC、完整题文档、检索验证器和 DisclosureCard；没有增加依赖、表、IPC、云轮次、模型或服务。图片最多 4MiB、8192 边长/1600万原始像素，标准栅格最长边 2400；每图最多 32 块，块提示合计最多12000字符，沿已有120秒截止与取消链。提示不是来源认证；完整性仍由后续原裁图校验决定。

## 真实验证和边界

所有包内命令 cwd 为 `apps/desktop`，本轮命令均需终态后才计通过。

| 命令 | 实际结果 | 证据 |
| --- | --- | --- |
| `npm run build`（含 typecheck） | PASS | `build.log` |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | 204 PASS，基线191；覆盖正文/元数据分歧、空图、删除/篡改、读回、检索同门禁及图片/PDF引擎隔离 | `page-boundaries.log` |
| `node scripts/education/kb-image-page-boundaries.mjs` | 8 PASS；真实Electron图像解码/裁剪，OCR/块受控；覆盖取消、源变化、超大头、错误页码/版本和栅格一致 | `image-runtime.log` |
| `node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs` | 15 PASS，基线13；新增标准/质量PNG调用预留 | `folder-boundaries.log` |
| `node --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs` | 7 + 基套34 PASS；在图片适配前运行，未声称自然配答正确 | `book-document.log` |
| `npm run test:renderer-components` | 246/246 PASS | `components.log` |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs` | 3 PASS；实际递归PNG/本地OCR与版面/SQLite/题本/双尺寸/typed来源和冷启；三条受控模型响应，云0 | `journey.json`、`journey.log` |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs "$env:TEMP\omni-source-content-ui-GN1oAJ"` | 最终构建冷启2 PASS；不重跑OCR/模型，原文档、原图和回执不变 | `final-cold.json`、`final-cold.log` |
| `node scripts/electron-smoke.mjs` | 207/207 PASS；同一冻结构建 | `electron.log` |
| `npm audit --json` | 既有28：8高、12中、8低、0严重；依赖未变 | `audit.json` |

只读诊断复现命令（不写题库/回执）：

```powershell
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-source-content-retained-diagnostic.mjs "$env:TEMP\omni-natural-books-62sbkdoe" "$env:TEMP\omni-natural-books-62sbkdoe\source-reading-dfU57S" "$env:TEMP\omni-natural-books-62sbkdoe\source-content-diagnostic.json"
```

最后生产 main SHA 为 `27ac94d0f55d0f7c5c5a387b0f15f9bc7f5c13f45cd62335455591ace9e92ee4`。完整PNG验收与最终构建的main相同；最后只更正授权界面图片三遍说明，最终构建另走双尺寸冷读。共享Electron已终态207/207通过，main/preload/renderer摘要前后不变（`frozen-build.json`），期间未重建；全部验证命令已结束。1366×768/1920×1080截图保存为 `warm-*` 和 `final-cold-*`。受控请求仅3条；冷读新增0；这一轮真实DeepSeek请求0，没有发送原PDF或答案册。

## 批判审查发现与修复

1. 最初验收脚本缺TS loader初始化顺序和资料页导航，已修复；`failure-loader.log`、`failure-navigation.log` 保留，不能算产品通过。
2. 实际图片只冻结扁平 page-restoration.v3，根本没有进入原PDF切题链，导致受控请求在发送前被拒；现抽取共用 pagePreparation，图片复用同一策略与后续归档。原失败 `failure-image-policy.log`。
3. 目录调度给质量图片预留2次，但新链需要3次，创建前误报预算耗尽；已同步调度与界面说明，并加标准/质量反例。原失败 `failure-image-budget.log`。
4. 版面PNG与模型图片重新编码，摘要不一致；保留严格来源门禁，改为新任务只用相同栅格。原失败 `failure-image-raster.log`。不修改旧任务图片语义。
5. 旧自然12题扁平稿仍不能自动归档。只读诊断原v1响应，5题可机械分离闭合出处且正文/图义一致，7题有不支持的自由前缀。诊断不是新AI回执，不回写或放行；旧自然仍12待核、完整文档0、正式配答0。`retained-diagnostic.json` 的原单元/裁图/复核/题目状态SHA前后为 `34fb9a91abcac8bf4bdca063d3c62a6fd0028c2a4d5c67c75470deabfc633b24`。第6题另有独立解答分歧，不能因分层修复自动通过。新v2自然验收 NOT_RUN。

## 代码与复用依据

主要文件为 shared 的 `question-source-content.ts`、`material-ai-source-content.ts`、`material-ai-source-reading.ts`、`material-ai-page.ts`、`question-document.ts` 与 `material-page-preview.ts`；main 的 `material-image-page.ts`、`material-page-blocks.ts`、`material-ai-repository.ts`、provider/page-content/page-crops/page-publish/source-reading、AI IPC与目录调度；前端沿现有 `MaterialSourceReadings.tsx` / `MaterialFolderAiPanel.tsx`。无App树、Pi运行时或业务真源重写。

内容/来源分层采用 [DoclingDocument 的文档、图片、标签与 provenance 思路](https://docling-project.github.io/docling/reference/docling_document/)，本轮没有新集成或下载 Docling；运行时继续复用仓库已锁定的 RapidOCR、PP-DocLayout 和 Electron。不是重新制作 OCR/向量库/Agent Loop。

## 性能、限制和下一步

相对上轮构建，main +16408B、renderer +3838B、preload不变（`build-performance.json`）。这是未压缩构建体积，不能当吞吐/内存/检索P95。图片新增逐块本地OCR，最多32次且受120秒总截止约束；复杂多块图片可能超时/待核，吞吐与缓存优化仍需在混合留出集测量；主进程有有界图像解码/缩放，其UI阻塞与峰值内存尚未量化。自然v2正确率、自由徽标与正文归属、已知答案参与最终整理/求解及真实网上解题仍未验收。正文一致、AI三遍或计算结果都不等于物理建模正确。

下一沿唯一执行索引推进：在一般来源角色上处理尚不支持的版式前缀与题图，接入已认证唯一答案候选；保留真实冲突，避免求解重写已核来源。之后120自然留出、200查询、三套正式蓝图、40GiB/72h、普通Windows链式安装与换机。不得通过逐页修改验收书、重复收费刷过、删标签或放宽单位/否定词来关闭验收项。

## 回滚与兼容

`OMNI_EDU_AI_SOURCE_CONTENT_ROLES=0` 只停止新任务冻结分区；`OMNI_EDU_AI_IMAGE_PAGE_BLOCKS=0` 只停止新图片走版面链并恢复其新任务双轮预留。保留已存schema、图片引擎、冻结输入、读器和回执；旧任务不升级。旧二进制降级未验。原图、业务题库和付费响应无需删除，重建仅涉及派生缓存。提交与远端一致性由本轮Git收尾另行报告，不把本文件当推送证据。
