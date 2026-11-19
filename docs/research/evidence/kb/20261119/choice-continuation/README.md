# 跨页选择题的原图续接

## 根因与修复

实际教辅 PDF 中，第 2 页末题只有题干，第 3 页开头有 A–D 选项，随后开始第 6 题。原续页解析只认小问编号，无法把第 3 页选项归入第 2 页的题。桌面运行还发现，裁图使用 `next:` 标识原页，独立复核却用 `next-` 查找。首次原图响应和两页裁图已经落盘，第二次原图复核尚未发出就报 source_changed。旧独立复核测试采用了与实际裁图不同的标识，因而没有发现该断点。

新规则要求两页归属明确。前页文字和对应版面块都须证明末题仍缺选项，后页必须有从 A 开始的连续选项，而且能定位顺序上紧接的下一父题。局部 OCR 与原生文字的汉字对应仅用于确认裁剪范围。归档时再逐项比较两份完整原图转录与原选项，保留原有数字、公式、单位和选项序列。跨页组的割裂或串页可在独立复核前拦截，同名块按原页读取。

## 修改前后

| 输入 | 修复前 | 修复后 |
| --- | --- | --- |
| 真实 PDF 第 2 页末题，第 3 页有 A–D | 无法选择续页选项区域 | 完整题干和四个选项落入同一份题文档，原裁图分别锚定第 2 和第 3 页 |
| 手写批注在选项及下一题之间 | 边界待核 | 程序拒绝自动续接 |
| 独立原图复核收到正规续页块 | 第二遍前因标识查找失败 | 按该块原页区分正文、图形和表格 |
| 续页原件被修改或未授权 | 原页门禁拒绝 | 原页门禁拒绝 |

## 验证

工作目录为 `apps/desktop`。桌面测试用了原 PDF 的独立测试副本。通过资料页选择并整理第 2–3 页，主进程用实际 PDFium、RapidOCR 和 PP-DocLayout 数据生成裁图，SQLite 保存完整文档。两张图片保留原页和坐标，续页图像哈希在重启后读回相同。6 次受控提供方响应涵盖该批选定页，包括第一遍、单独复读原图和最终整理。云端模型调用 0。验证期间记录并修正了模型测试样本的旧跨页标识格式和老响应协议。

| 命令或范围 | 结果 |
| --- | --- |
| `npm run build` | 最终构建通过 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-choice-tail-boundaries.mjs <本地已解析资料库>` | 7/7，包括真实 PDF 正例、手写批注反例、相邻题隔离、公式及单位修改拒绝、跨页同名块 |
| `node scripts/education/kb-choice-tail-electron.mjs <本地已解析资料库>` | 2/2，原界面写入与重启后核对原图 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-cross-page-boundaries.mjs` | 12/12，恢复、权限、原图和事务 |
| `node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs` | 导入的 AI 页面 248/248、答案写回 36/36、答案引用 53/53 |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/electron-smoke.mjs` | 使用上表构建产物，207/207，Electron 报告 `ok: true` |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-figures-boundaries.mjs` | 失败，首个带独立图和图注的用例仍触发正文一致性待核 |

同机热复算各 100 次，正例的边界判断 P95 由 0.045 ms 增至 0.185 ms，批注反例由 0.075 ms 增至 0.083 ms。运行时还会读取真实授权续页并生成裁图，这组数字只衡量内存中的边界判断。依赖无变更，npm audit 报 29 项，其中 8 项 high、0 项 critical。

## 回退与验收范围

设置 `OMNI_EDU_AI_CONTINUATION_CHOICES=0` 后重启，可以暂停新选择题续页发现。已写入的跨页证据按冻结版本及页块身份重新核验。本轮覆盖真实版面与受控模型回复下的文件入库和读回。实际模型答案质量、独立跨页图、不同出版来源的留出资料、约 10 GB 混合目录和安装迁移仍属于完整知识库目标。文件清单见同目录 MANIFEST.json。
