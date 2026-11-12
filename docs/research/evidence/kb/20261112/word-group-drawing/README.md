# Word 独立组合矢量图恢复

## 本轮结果与范围

当前只处理已导入的221份资料，共328203104B。987份、1052908695B是准备目录的体积，尚未全部导入。目录导入与folder AI继续暂停，完整知识库Goal保持ACTIVE。

修复了Word中独立组合矢量图被AlternateContent占位丢弃的问题。复用固定LibreOffice 26.8.2的UNO图形导出及现有隔离Chromium，按原XML路径、名称、SHA与浮动/行内方式认证图片，进入现有Word资产、题目原文与后续OCR入口。实际两份Word的9张组图已恢复，原界面两尺寸、冷启与完整题目1240×697证明图通过。

本轮实现选择只覆盖结构明确的无文字组合图。148份Word只读盘点有2243个AlternateContent，2232个涉及几何，2082个涉及文本框。严格候选80处、分布50份资料，实际验证覆盖其中两份。复杂文本框、外部标注和浮动归属继续待核。恢复像素后的浮图保留drawing_float_layout与source_warning，不能由此宣布题目自然质量通过。

## 实际失败与修正

- 初次LibreOffice直接PNG导出产生黑底，结构与SHA测试仍通过。失败候选和日志保留。改为导出原SVG，经隔离Chromium白底栅格化后，在9张真实图上验证白边和图片尺寸。
- 初次白底栅格化对不同比例视口拉伸图形。新增圆形回归首先失败，修复为等比例居中缩放，原SVG字节保持。该失败和后续8项真实Chromium检查分别保留。
- 原正文的parse_engine仍可能是word-ooxml.v1，而Word来源缓存已经升级。首次候选重建只对v2走兼容升级，导致实际两份资料更新解析标记和时间，11条正文分块被重建。正文、隐私和质量字段完全相同，原分块ID已改变。仓库外原SQLite备份与失败指纹报告保留，未修改实际数据库伪造不变结果。代码改为复用isWordParser识别旧版本，新增独立fixture从原界面检验旧标记重建、坏图修复和冷启后的全文事实及来源身份保持。
- 真实AI整理仍失败。原界面对恢复图的一题发起2次DeepSeek，首稿B，复核C，复核文本又称B和C均正确，且corrected缺少必要投影字段。当前按invalid_response保留failed，未发布新题。拒收直接原因是格式校验，尚无本轮新增的B/C语义矛盾检测。完整原始响应本地保存，后续不可强补成合格答案。
- 第一次AI观察脚本读错列名，应用关闭时尚未发出请求。修正观察脚本后恢复同一批次执行，累计仅2次真实调用，7535 tokens。两次组件测试曾遇现有Vite CSS加载超时，失败日志保留，后续246项通过的结果有独立日志。

## 数据读回

原3144题、309个AI单元和708份回执全行SHA保持。实际总题数3182，其中38条是首次正文重建后自动规则提取产生的新增待核题。原38条规则题与2个历史AI单元仍含已替换的分块ID，旧来源身份有遗留风险，新增规则题不能计为AI质量提升。AI单元310，回执与调用710，unknown22。原887份Word历史表示逐行保持，未涉及的146份Word表示逐行保持。两份涉及资料和11分块的变化单独记账，不能宣称全部资料与分块全行不变。无新增AI可用题，当前全自动归档闭环仍未通过。

精确读回与运行摘要保存在本目录JSON和压缩工程日志。原件、截图、Word/SVG/PNG、完整模型响应和数据库只保存在仓库外D:/WorkProject/EduProject-kb-run。未上传到GitHub。

## 成熟组件与交付成本

LibreOffice采用官方固定MSI，lessmsi采用MIT固定发布包免管理员解包。LibreOffice为MPL-2.0及其内含组件许可证，完整原许可保留。没有新增npm或pip依赖。运行目录独立于原件、SQLite、索引和产物。

| 项目 | 实际值 |
| --- | --- |
| LibreOffice MSI | 375934976B，SHA ff4b911403b67ee9e6249f820f9782c44bb32c94fdaa45b0da53a8e419e5307a |
| lessmsi 2.12.9 ZIP | 740956B，SHA 5b4e187e74b184ad3a63ccf06c3d17dae2b8c4b6c298a996dbd51a9f6db29d21 |
| 完整运行目录 | 19271文件，1526232897B，约1.42GiB |
| 下载总量 | 376675932B，约359MiB，另保留下载缓存 |
| 树认证SHA | 36dbb393603e2a1513546c8d10dd6efc745c6522063a4ad51097390c8802ec6f |
| 安装临时空间门槛 | 3GiB |

实际应用在本地已有认证MSI缓存、尚无lessmsi缓存时完成lessmsi网络下载、免管理员解包、完整树校验与启动。完整MSI网络下载、干净普通Windows、安装中强退重开与异机迁移尚未验收。运行路径依赖已有Windows字体准备。组件故障沿原Word重建/取消/重试显示，独立队列与本地Worker受并发、超时、输出及图片预算限制。

原Word与派生PNG沿原目录保存，任务临时SVG按原任务目录清理。完整树在每次启动前认证，实际两份Word在组件已就绪时重建耗时37146ms、38734ms，包含原件认证、1.42GiB组件认证、启动与导出。此前这类图缺失，本轮没有同一正确图形的旧路径时延。未测峰值内存、长期P95或整库性能，此项新增磁盘空间和逐份启动成本需在后续后台批处理优化中评估。

官方源码与接口参考包括[Microsoft Markup Compatibility](https://learn.microsoft.com/en-us/office/open-xml/general/introduction-to-markup-compatibility)、[LibreOffice GraphicExportFilter](https://api.libreoffice.org/docs/idl/ref/servicecom_1_1sun_1_1star_1_1drawing_1_1GraphicExportFilter.html)、[LibreOffice导出源码](https://github.com/LibreOffice/core/blob/master/svx/source/unodraw/UnoGraphicExporter.cxx)与[lessmsi 2.12.9](https://github.com/activescott/lessmsi/releases/tag/v2.12.9)。docx-preview 0.4.1源码的VML group默认分支返回null，因此未采用。

## 修改边界

- shared/material-word-drawing.ts与material-word.ts保存版本化请求、回执、图形身份和进度，v1与v2来源均可读取。
- main/assets/word-drawing-source.ts、word-parser.ts与word-drawings.ts负责严格结构选择和来源认证，复用原Word资产。
- word-office-component.ts、word-drawing-worker.py、word-drawing-runtime.ts与word-drawing-raster.ts负责受管组件、本地UNO、隔离白底等比渲染及取消回收。
- word-upgrade-compatible.ts、material-word-repository.ts、word-host.ts与db.ts复用历史升级和正文兼容入口，保留旧来源摘要。
- MaterialWordPanel与MaterialWordBlocks在原界面展示组件准备及真实缺图原因，electron.vite.config.ts复制本地Worker。

## 验证与运行入口

下列脚本在apps/desktop中运行。受控转换测试与真实LibreOffice界面检查各自记账。

```powershell
node --experimental-transform-types scripts/education/kb-word-drawings.mjs
node --experimental-transform-types scripts/education/kb-word-office-component.mjs
node scripts/education/kb-word-drawing-raster.mjs
node scripts/education/kb-word-cache-upgrade-journey.mjs
npm run build
npm run test:renderer-components
```

新增图形8项、受管组件8项、真实隔离Chromium8项通过。原Word历史8项、后台升级13项、矢量媒体10项、题目边界29项与试卷角色10项通过。207/207综合legacy回归在白底修复120b452候选通过，早于等比缩放、旧解析标记修复和最终协作者UI整合。最终整合build/typecheck、246/246组件、旧标记真实UI旅程3项与两份实际资料冷读通过，renderer错误0，冷读新增调用0，导入与folder AI均paused。

首轮整合冻结代码1e165497c852ab06d4839a7420e65591735f0c71，main SHA 1f3f94e4a5ce8e8f5121a3517f8120568c2bf353bce622288da692d8f2719ec8，整树SHA 4ac203348aad60e7b1f261aadeef4aaa50ee10810cb3426fff61f9d0353eca1c。实际入口与关闭状态写入仓库外prepared.json及run-state.json。本轮冷读脚本第一次因CRLF截取错误包含重建段，在组件验证阶段终止其自有进程树，保留失败日志后修正为纯冷读。实际正文和付费事实读回与此前差异账本一致。

随后正常合入协作者5ff6173卷面预览UI，无Word源码冲突。重新build/typecheck、246组件与原资料冷读通过，main字节与旧标记旅程一致。最终运行代码87cdf11af3800d3814d6f680aba51b5aa11f8b4b，main SHA保持1f3f94e4a5ce8e8f5121a3517f8120568c2bf353bce622288da692d8f2719ec8，整树更新为e3efd85e2491a1d2954e827752c729f05ece8e0e5b959f694b5e20d012712ea9。prepared.json与run-state.json已指向这一构建，应用关闭，导入与folder AI暂停。工程日志以.log.gz保存，完整失败候选仍保留。

## 下一轮先完成的缺陷

下一轮先核查并处置首次正文重建遗留的38条旧规则题来源和38条新增待核重复，以及2个历史AI单元的原来源读取。以原件、备份和来源版本认证恢复，保留本轮失败账本与付费身份。

随后处理手动AI入口缺少processingMode的问题。rawInputs在无folderId时沿legacy，当前未冻结目录quality使用的高思考策略。DeepSeek高质量推理仍使用同一统一API。贯通手动与目录入口的质量策略，保留历史输入和付费身份，再处理uncertain与部分corrected输出的版本化协议。仅在来源认证、字段合法和业务规则均满足时归档，答案矛盾须保留明确待核或失败。使用本轮已保存响应离线复现，新增真实调用只用于新的确定修复。

然后继续复杂文本框及浮图标注、当前221份自动归档到题库的实际结果、已知答案与联网补答、自然留出质量、完整检索重排与组卷、安装迁移和约10GB。当前不扩大导入和下载。

## 回滚

停止新Word组图转换，保留现有v1/v2读取和历史图像。可正常revert本轮调度/写入口，已生成新格式的数据不能交给缺少对应读器的旧二进制。组件目录可在所有相关任务停止后重新准备，不清理业务资料。实际旧分块变化已记录，后续旧来源影响须单独审计，不直接将备份覆盖当前已有付费回执的数据库。
