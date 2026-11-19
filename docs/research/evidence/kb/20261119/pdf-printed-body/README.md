# 混合 PDF 正文核对与题库准入

## 根因

PDF Worker 把原生层和整页 OCR 都作为线性文本核对。OCR 会在正文行间插入图中的元件标签。历史样本里，图内的 `R2` 之后恰好是第 5 题，整页去空白会把两个数字拼在一起，原本一致的题文被判为冲突。试导库的 558 个历史冲突页中，只按保留空白重算数字会得到 10 个候选，其中包含真实缺分母和表格缺字。保留变量、数字、运算符和次序，并只允许在图内剔除短标签后，严格文本预筛得到 1 个候选。

另一份真实电路练习第 2 页的 D 选项漏掉分母。页解析已经标成待核，但独立版面重识别后的第 4 题仍被切成普通题入库，选项变为 `D. 1R`。这是解析到题库写入之间的质量门禁缺口。

## 修改

- Worker 复用本次 RapidOCR 的坐标，经 PDFium 切回原页坐标。只有位于独立矩形图片内、与原生正文矩形无重叠的单独短标签才可从正文比对中排除。用保留数字边界的逐 token 比较检查正文。相同数学字母的排印字体和全角 ASCII 可等价比较，上下标、运算符、单位和选项次序保留。通过时使用原生正文，整页 OCR、原始文字、几何回执和剪裁来源仍保存。
- 新建候选和自动题库写入都重新核对同版本 PDF。若确有页源冲突，只有在同页的两个连续父题之间，题干、选项的字面内容及结构化选项字段都与原生层精确一致时，才允许这道独立题继续入库。其余候选保留原文和原页，教师看到待核提示。独立复核发现旧候选会绕过原来的空结果判断，现有 PDF 任务在换代缺回执、失败、OCR 空白或重试中一律等待证据。
- 使用原锁定 Python 3.12.14、PDFium 5.14.0、RapidOCR 3.9.2 打包 Worker，更新文件与源码哈希。没有引入新模型或安装依赖。

## 修改前后与性能

真实电路资料的第 2 页从待核恢复为可发布正文。8 个图内短标签保留在原 OCR 和图片角色中，题干与选项使用经核对的正文。另一份资料同一页的第 3 题核对通过，第 4 题的缺分母选项留在待核。原图和原始 OCR 仍可访问。

在已有该页 OCR 回执的情况下，对正例重复 100 次测量。旧页校验 P95 为 0.2981 毫秒，新增几何校验 P95 为 1.0413 毫秒。每个候选沿用同一次 OCR。渲染、OCR 和题库写入耗时另计。Windows Worker 共 712 个文件、279130853 字节，增加 2624 字节。依赖审计存量 29 项，其中 high 8、critical 0。

## 验证

| 验证 | 结果 |
| --- | --- |
| 锁定运行时源读出 4 个自然页 | 1 页恢复。缺分母、含错误图内汉字、表格缺字三页继续待核 |
| `python python/omni_edu_ocr/test_pdf_body_reconciliation.py -v` | 2 组，通过数字边界、符号和独立图形范围反例 |
| `node --experimental-transform-types scripts/education/document-structure-boundaries.mjs` | 结构恢复 24/24 |
| `node --experimental-transform-types scripts/education/document-structure-repository.mjs` | 持久化与队列 38/38 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/ai-structure-source-boundaries.mjs` | 结构来源复用 15/15 |
| `node --experimental-transform-types scripts/education/kb-pdf-worker-probe.mjs <61 页合成 PDF>` | 5 个选定页面结果及原件锁、释放确认通过 |
| `node --experimental-transform-types scripts/education/kb-pdf-publication-boundaries.mjs` | PDF 写入事务 4/4 |
| `node scripts/education/kb-pdf-printed-body-journey.mjs <历史试导库 data 目录>` | 最终真实 PDF 桌面 4/4。两份原件从资料文件夹进入，验证题库隔离、重启读回、关键词检索和原图回看 |
| `npm run build -- --outDir <test-results 内的冻结构建>` | 合并协作者主线后的 TypeScript 和 Electron 构建通过 |
| `npm run test:renderer-components` | 组件 253/253 |
| `node scripts/electron-smoke.mjs`，指向同一冻结构建 | Electron 综合回归 207/207，退出码 0 |

首次桌面试跑完成 PDF 回执核对后提前重启，结构发布尚在后台，正文搜索页签也未切换。保留首份失败结果。第二次完整跑到正式正文和题库，在旧的题目门禁里复现了缺分母题漏入，随后修复了切题与写入两处。

构建身份、结果和范围见 [结果摘要](summary.json)，修改路径和 Git 内容哈希见 [文件清单](MANIFEST.json)。桌面专项走本地识别和检索，未调用云模型。

## 剩余范围与回退

本轮放行依赖独立图中的短标签和可逐项匹配的正文。存在页源冲突时，跨页、共用材料、子题树、多栏顺序不确定、公式或表格无法完整对应、图文互相遮挡等情形保留待核。原始资料检索仍可显示带待核标签的来源片段，供老师打开原页。历史已入库的结构和正式题目未批量改写。现有大库历史页须走受控重建逐项核对。下一轮优先将原生层与 OCR 的真实分歧按几何区域定位，扩大有独立证据的单题恢复覆盖。检索留出、真实模型、正式组卷、约 10 GB 和安装迁移仍按 KB-A01～A10。

回退时使用上一版本应用及其匹配的 OCR Worker 文件锁。现有 SQLite 表和历史回执继续读取，教师确认和已存原件维持原来源。
