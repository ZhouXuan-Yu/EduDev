# Word 原版图文页面来源

## 本轮关闭的缺陷

旧几何导出明确排除了文字框、带文字组合图、位图混合和公式，真实物理 Word 中大量题图因此缺少标签与空间关系。本轮复用现有 LibreOffice 26.8.2 Writer 导出整份本地 PDF，并通过原资料收录、后台页处理、原页预览和文字识别入口继续使用。教师从资料的“题目与校正”启动生成、停止、重试和打开快照，PDF 同一分区可返回 Word 原件。

新增 material_word_page_sources 保存原 Word ID/版本、引擎、任务租约、PDF 摘要/资源和页数。转换按版本幂等，已收录而 ACK 中断时认证复用原输出，历史快照保留，原件变化及坏输出拒绝复用。成功后清理私有转换副本，未完成输出保留供恢复。关系只保存业务身份，可随整库和原件目录迁移。真实换机安装验收继续 OPEN。

真实停止检查发现终态可能早于首次轮询，数据库已 cancelled 而界面仍 idle。已修复取消异常映射，并在操作结束后重新读取持久终态。最终原按钮停止、冷启、重试再停止均通过。

## 当前结果与边界

原 221 份资料、1312 分块、3184 条题目、311 个 AI 单元、712 份付费回执、6 条恢复审计及 893 份 Word 历史的全部原行摘要保持。新增 1 份 672612B 的本地 PDF、6 个可发布页分块和 11 条自动规则题候选，现共 222 份资料、1318 分块、3195 条题目记录。这 11 条是同一资料另一表示产生的候选，不能计为新增独立题或 AI 正确率提升。

真实原版 PDF 共 7 页，6 页 complete，第 2 页因 text_conflict 保留 needs_review，整份 PDF 为 partial。第 2 页仍可查看原图并沿原入口进行本地 OCR，识别出 58 个文字区域。实际原图为 1698×2400，核对可见 U 形管、O/A/F₁/F₂/θ 标注、弹簧 O/P、电路 A/B/R 和实验装置。页边界可能拆开题目，跨页与切题仍须沿后续流程处理。单份源例通过不能推断全部复杂 Word 均无排版或字体问题。

本轮完成原版页面准备和原 PDF 流程入口。目录 AI 的 Word 静默分发、原 Word 与快照的题目身份/去重衔接，以及第 2 页文本冲突的自动质量处理是下一切片。完整自然资料质量、已知答案配对、联网补答、检索组卷、安装移植与约 10GB 仍 OPEN。目录导入与 folder AI 继续 paused，本轮新增模型调用 0，累计 712。

## 验证与失败保留

最终生产代码见 result.json 的 sourceBase，main SHA 11b22ec48ac06f1284c3fe06565ad7683cf738a450525687f6d3756a946d276a，完整构建 9918909792d709129d4e75507a7433a589bfd8408be0cf002220f9f45db8c558，469 个构建文件。最终 build、246 组件、11 个仓库/文件边界及真实原界面正常、停止、重试、两尺寸和冷启通过。原几何 Worker 的实际 LibreOffice 回归与两套各 8 项专项通过。

207/207 综合 legacy smoke 属于首次候选，之后差异为取消错误映射及界面终态刷新，最终差异通过 build、246 组件、11 定向和真实取消/正常流程验证。综合套件使用历史测试 Runtime，不能证明真实 DeepSeek 质量。

首次脚本仅等待整份 PDF ready，实际终态是 partial，已中止等待并保留 word-pages-first-partial。原页选择器把图片误当作文字面板子元素，相关失败元数据在本地保留。首次取消在任务 claim 前发生，未创建租约，前置检查停止被误要求持久行；后续明确在 running 后核对。真正发现的取消后界面缺失终态保留 word-pages-cancel-ui-failed，修复后原路径通过。几何探针的静态 import 未经 loader 注册，失败日志保留并改为动态 import。所有原校验条件继续保留，第 2 页待核状态保持。

精确执行命令在 apps/desktop 下运行。

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-word-pages.mjs
node --experimental-transform-types scripts/education/kb-word-drawings.mjs
node --experimental-transform-types scripts/education/kb-word-office-component.mjs
npm run test:smoke
node test-results/corpus-flow-1gb/word-pages-freeze.mjs
node test-results/corpus-flow-1gb/word-pages-cancel-live.mjs
node test-results/corpus-flow-1gb/word-pages-live.mjs
node --experimental-transform-types test-results/corpus-flow-1gb/word-pages-geometry-real.mjs
npm audit --json
```

真实 UI 脚本、完整运行记录、截图、原件和备份在 D:/WorkProject/EduProject-kb-run/flow-1gb-20261111 及本地 test-results/corpus-flow-1gb，原始资料、模型正文、数据库和截图未加入 Git。安全元数据与日志见本目录 result.json、manifest.json。

## 性能、依赖与回退

旧路径无法输出带文字框的完整组合题图。新路径此次 7 页首次准备 125186ms，包含对已有 Office 的 19271 个文件、约 1.42GiB 的完整认证和实际转换。未做同条件耗时基线，P95 与内存峰值未测，不能据此宣称提速。输出额外 672612B，成功的私有转换目录已清理。全树认证逐份执行的成本需在后续静默队列中测量。

新增 npm/pip 依赖 0。复用受管 LibreOffice 的 MPL-2.0 和随包许可，以及既有 MIT lessmsi。已有组件约 359MiB 下载、1.42GiB 安装、3GiB 准备空间，本轮没有重新下载。打包新增两份公共/导出 Worker 文件，安装链和新机依赖准备仍待最终 M12。npm audit 当前既有 29 项，low 8、moderate 13、high 8、critical 0。

回退可撤销本轮页面入口与新任务分发，保留关系表、历史原件和普通 PDF 资源。停止运行后使用本轮 SQLite 备份核对即可恢复旧测试状态，原用户资料与正式题目不可删除。完整回退演练未执行。

## 实现文件

- 版本化共享输入与页面视图见 [material-word-pages.ts](../../../../../../apps/desktop/src/shared/material-word-pages.ts)，SQLite 任务、历史和幂等恢复见 [主进程仓库](../../../../../../apps/desktop/src/main/assets/material-word-pages.ts)。
- 本地转换及进程管理见 [word-pdf-runtime.ts](../../../../../../apps/desktop/src/main/assets/word-pdf-runtime.ts)、[word-pdf-worker.py](../../../../../../apps/desktop/src/main/assets/word-pdf-worker.py) 和 [word_office_worker.py](../../../../../../apps/desktop/src/main/assets/word_office_worker.py)。旧几何 Worker 复用公共生命周期。
- 宿主连接见 [material-word-ipc.ts](../../../../../../apps/desktop/src/main/assets/material-word-ipc.ts)、[db.ts](../../../../../../apps/desktop/src/main/db.ts) 与 [typed preload](../../../../../../apps/desktop/src/preload/index.ts)。原页面导航及状态见 [MaterialWordPagesPanel.tsx](../../../../../../apps/desktop/src/renderer/components/product/MaterialWordPagesPanel.tsx)、MaterialBodyPanel 与 MaterialsWorkspace。
- 可重复的 SQLite/文件边界检查见 [kb-word-pages.mjs](../../../../../../apps/desktop/scripts/education/kb-word-pages.mjs)。

## 成熟实现依据

Writer 的图形对象同时关联文字、锚点及环绕关系，本轮以成熟 Writer 整页导出保留这些排版信息，几何导出继续服务已有受限场景。[LibreOffice Text Shape](https://api.libreoffice.org/docs/idl/ref/servicecom_1_1sun_1_1star_1_1text_1_1Shape.html)、[GraphicExportFilter](https://api.libreoffice.org/docs/idl/ref/servicecom_1_1sun_1_1star_1_1drawing_1_1GraphicExportFilter.html)、[OOXML Anchor](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.wordprocessing.anchor?view=openxml-3.0.1)。
