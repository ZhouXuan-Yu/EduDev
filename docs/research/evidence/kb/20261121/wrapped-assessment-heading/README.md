# 恢复折行的大题标题与题型

## 根因与修改

真实 PDF 的「一、填空题」「二、选择题」在末尾有折行的计分或作答说明。OCR 两行均已保留，布局也给出了共同的标题区域。原段落恢复只合并正文，第二行被认成独立标题。题组读取最后一个标题时拿到的是评分说明尾句，题型和大题归属随之丢失。题号没有点号的资料还会因此失去已进入试题区的上下文。

v16 只合并相邻、同栏、共享可信标题区且能闭合的印刷说明。独立标题、题号、位置不明和括号未闭合的内容分别保留。对题号恢复、段落和题型提供同一标题。原始字符、换行、坐标、版面疑点和文件版本均保留。

| 文件 | 改动 |
| --- | --- |
| `main/assets/material-document-structure.ts` | 恢复大题标题连续行及原始范围 |
| `main/assets/material-structure-numbering.ts` | 续行沿用已识别的大题范围，不清除题号恢复上下文 |
| `shared/material-document-structure.ts` | 派生结构版本提升至 v16，继续读取 v15 及更早有效世代 |
| `scripts/education/document-structure-boundaries.mjs`、`kb-batch-structure-boundaries.mjs` | 覆盖多行、独立标题、疑点、行归属和旧版本升级 |
| `scripts/education/kb-column-structure-readback.mjs`、`kb-wrapped-heading-electron.mjs` | 核对真实冻结页和实际桌面入口 |

## 真实资料和耗时

用真实上海高考数学试卷的 4 页封存数据对照 v15 和 v16。新版本仍是 20 组题，题号、题干、候选状态、原 OCR 行、坐标和原有栏序一致。两处评分说明合成完整标题，填空和选择节的正确归属由 0 增至 15 组，其中 8 组结构候选能从原印标题推导题型。独立 PDF 页源核验仍适用，不能以这 8 组推算正式可用库存。答案册第 1 页的填空标题也能合并，原有分栏疑点保留。

同样的页面和硬件交替运行 9 轮，每轮分别回放 120 次。4 页段落和试题重建中位用时从 0.921 毫秒至 1.021 毫秒，不含 OCR、文件读取及索引。原始资料及历史引擎结果无需迁移。

## 验证

- 合并后 `npm run build` 通过，组件专项 `npm run test:renderer-components` 253/253。
- 结构、结构仓库、目录升级 3 个脚本通过，分别记录 54、40、14 项检查。真实页列序与页脚旧回归保持 4 页、20 组和 8 组结构候选。
- 运行 `node --experimental-transform-types scripts/education/kb-wrapped-heading-electron.mjs <已授权的试卷PDF>`。合并构建从实际资料页面导入原始 PDF，生成 4 页结构，恢复 2 个标题和 15 组归属，验证原始图像、文件摘要和 1366×768 到 1920×1080 冷启动读回。零渲染错误与外发。实际运行后 20 组都保留待核，正式题库新增 0 条。4 页里的 PDF 文字冲突继续待核。
- 同一合并构建的 Electron 综合冒烟通过 207/207。
- `npm audit --json` 报告 27 项既有依赖告警，6 项 high，0 项 critical。

最终桌面主进程 SHA-256 为 `366f8eedc4d47b60d22c74eca4dcb25b47e4bef36fe964396a308ebba481e9ff`。真实测试的本地报告存放在 `C:/Users/ZhouXuan/AppData/Local/Temp/edudev-kb-wrapped-heading-20261121/kb-wrapped-heading-T3tpvQ/report.json`。早期两次桌面试导分别在归档与 PDF 解析阶段触发空间不足。最终在空间充足的隔离目录重试，原件哈希保持一致。


知识库功能构建在合并提交 5c92796 完成真实桌面验证和综合冒烟。随后纳入协作者 a259d84 的任务运行与原样保存变更，核对知识库后端、共享契约、渲染源码和锁文件保持一致，最终 TypeScript 检查通过。

## 兼容与剩余工作

可在已有资料的处理队列升级旧版结构。回退代码前可保留旧世代，已生成的 v16 回执应使用支持该版本的应用读取。教师确认、缺页、低置信度、来源冲突、自然配答、检索、正式组卷、约 10 GB 混合资料和换机继续按 KB-A01～A10 验收。
