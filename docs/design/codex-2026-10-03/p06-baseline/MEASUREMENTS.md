# Codex参考与当前工作区测量

日期2026-10-03，docs/81的D1基线。参考原图R2为2559×1529物理像素，R1为912×1104裁剪；没有应用DPR/Windows缩放/zoom元数据。人工边线坐标沿docs/67第3节，约数不得升级为已校准CSS值。

## 当前实际环境

- Playwright截图1920×1080/1366×768，renderer DPR约1.00000003、visualViewport scale1；Electron zoomFactor1。Windows primary display scaleFactor1.5。
- Electron contentBounds1346×838与Playwright仿真viewport不同，不能用Windows scaleFactor直接换算这些截图；本轮内容截图不包含原生窗口菜单/标题框。
- baseline-WUNX9U为修正实际sidebar/header/inspector选择器后的最终before；前两个baseline的missing选择器报告保留，不作为完整区域基线。

## 结构差距

| 区域 | R2原图物理坐标约数 | 候选除以1.25后的CSS坐标（未证实） | 当前1920×1080 CSS测量 | 待处理 |
| --- | --- | --- | --- | --- |
| 顶部壳 | y0–66 | 高52.8 | 内容截图不含原生标题/menu | P06b真实菜单/窗口框架 |
| 窄轨 | x0–78 | 宽62.4 | 无独立窄轨 | P06b |
| 会话侧栏 | x78–459 | 宽304.8 | 宽345.59 | P06b来源模板/密度 |
| 聊天/预览分界 | x≈1383 | x≈1106.4 | 当前检查栏x=1555.21 | 当前固定检查栏与文档panel是不同模式 |
| 标题底线 | y≈144 | y≈115.2；减去顶部壳约52.8后高62.4 | 内容区标题高56 | P06b |
| 正文起点 | x≈497 | x≈397.6 | 空态阅读列x=480.40+28 padding | 目标随面板打开/关闭变化 |
| 阅读正文 | 字号/行高需校准 | 16px/约1.7仅初值 | Segoe UI/Microsoft YaHei UI，16px/27.2px | P06a公开说明已修深灰，不能称字号完全相同 |

候选1.25来自字号、窄轨和侧栏合理CSS尺寸的比对，仅用于安排后续布局，无法由位图唯一确定。已异步询问用户参考截图Windows缩放，未收到答案时继续组件与真实交互，保持D1同DPI门禁未勾。

## 素材与后续验收

- before-1366x768/1920x1080 PNG与JSON、report.json为实际基线，原字节复制至此。
- hero-process-source.json证明现有ChatTool/Group/styles/index四文件与本地Pro源字节相同；许可依既有README，不能称Codex同源。
- after截图在正式provider实例目录，验收通过后登记。因内容/面板模式不同，本轮不提供虚假的整体pixel-diff分数或≤2px结论。后续同语义内容、同面板状态、统一CSS坐标才做区域叠图。
- D2真实分段/连续工具组/展开状态与来源、D3实际耗时/压缩细行可独立验收；D3图片回执、D4整窗/文件panel、D5控制卡/输入、D6模型设置和D7最终视觉仍需实施。

## P06a 最后实例

after-1366x768/1920x1080 PNG与JSON、live-process.png来自真实正式DeepSeek过程12/12的54wIzX；real-process-report.json与real-approval-report.json（jkD3PD，5/5）原字节复制。实际查看after-1366与live，公开过程已贯通；侧栏/标题/常驻右栏仍与R2有差距，live首段是模型实际英文说明。完整差距及下一P06b见docs/82，不用不同语义内容的before/after当整体叠图。
