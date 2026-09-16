# Omni-Edu Agent 前端产品与设计架构

版本：v1.0  
日期：2026-09-16  
状态：前端唯一权威基线

## 1. 前端目标

前端是教师每天工作的桌面工具，不是营销页、传统后台或 AI 能力展厅。任何页面都应回答：现在有什么待处理、教师下一步做什么、结果来自哪里、失败如何恢复。

技术栈以当前代码为准：Electron + React 19 + TypeScript + HeroUI v3/Pro。不得再按 Vue 方案开发。

## 2. 信息架构

默认一级导航：今日、知识库、题库、智能组卷、错题训练、学生、产物、设置。小智用全局入口、命令面板或可收起侧栏提供帮助，并能把任务带到对应工作台。

已有但不属于默认主流程的讲义、复盘、搜索、记忆、研究、可视化和质量评审，应按任务归入产物、学生或设置，或保留为高级入口。不得因为后端已有就无限扩展主导航。

实现状态（2026-09-16）：主导航当前为 今日/小智/知识库/题库/错题训练/学生/设置 7 项；学习路径、录入、复盘、搜索、备课本、讲义、记忆、团队、分析归入折叠的「高级入口」组（`nav-more` 切换，进入高级视图时自动展开）。「智能组卷」「产物」随组卷模块（实施计划 W07）完成后加入主导航。所有视图的 `nav-*` testid 保持不变，E2E 契约不受影响。

## 3. 页面职责

### 今日

显示导入进度、解析/OCR 待修正、待审核试卷、导出失败、磁盘/索引异常和最近产物。每张卡必须能进入对应业务详情，不展示无行动意义的统计。

### 知识库

支持文件/目录导入、资源列表、解析状态、过滤、详情、原文定位、重试、重新解析和索引健康。30–40GB 场景必须采用虚拟列表、分页/游标和异步进度，不能加载全部资源到 React state。

### 题库

支持筛选、检索、来源标签、题目预览、答案/解析、证据定位、版本、编辑、重复提示和使用历史。AI 生成、资料原题、资料改编和教师创作使用不可混淆的标签。

### 智能组卷

采用三栏或分步编辑：左侧蓝图与约束，中间试卷结构，右侧候选/来源/校验。教师能锁题、换题、拖拽、编辑、调分、查重、预览并导出。AI 只提供候选和说明。

### 错题训练

围绕“图片 -> OCR -> 修正 -> 脱敏 -> 诊断 -> 题组 -> 确认”显示明确步骤和状态。OCR 原图与文本并排，低置信区高亮；针对性题组可编辑且显示来源。

### 学生

只呈现支持错题和训练的最小档案、证据时间线、历史题组和结果。禁止自动展示无证据的掌握百分比或永久标签。

### 产物

统一管理试卷、解析、答题纸、讲义和报告，展示格式、版本、来源、状态、路径、大小、hash、失败原因和重新导出入口。

### 设置

包含存储位置、磁盘与索引健康、OCR/embedding/模型状态、隐私预览、备份验证、诊断、归档和 AI 质量评审。

## 4. 小智交互

小智先给结论、证据和下一步，不机械展开 schema。可展示的是任务识别、读取来源、工具调用、预算、确认和终态的外部摘要，不展示或编造隐藏思维链。

对话库、消息和产物必须持久化；附件默认只传元数据，原始文件不自动上传。写入类动作生成可预览确认项，确认后才落正式业务真源。对话中的产物入口打开右侧预览；预览与对话区之间支持鼠标和键盘调整宽度。

## 5. 页面状态与错误恢复

每个业务面至少设计：idle、loading、empty、ready、partial、error、cancelled、success。刷新失败时保留最近一次有效 readback并标记陈旧，不把内容清空成假空态。长任务显示阶段、处理数量、失败数量、可取消和恢复入口。

按钮成功提示必须来自主进程返回和后续 readback；不能先在 renderer 乐观写成完成。原生文件对话框取消是正常状态，不显示为错误。

## 6. 组件与代码结构

- 页面编排放在独立 `*Workspace.tsx`；`App.tsx` 只负责壳、路由、全局选择和边界。
- 服务调用集中在 typed preload，不在组件中拼 IPC 字符串。
- 大列表使用虚拟化/游标；昂贵预览延迟加载；页面切换取消过期请求。
- 表单 schema、业务校验和脱敏规则以 main 为真源，renderer 只做即时反馈。
- `data-testid` 按业务语义稳定命名，不能依赖可变中文文案或 CSS 层级。

## 7. HeroUI Pro 使用规则

### 7.1 先查 MCP，禁止重复造轮子

设计任何页面或 UI 组件前，**必须先查 HeroUI Pro 是否已有可复用组件**。禁止先手写 `<div>` / `<button>` 再回头找组件，禁止只复制截图、禁止只做结构相似的自制占位，禁止留下“以后接真实组件”的坑。`App.tsx` 与 `renderer/components/` 中现存的手写列表、时间线、筛选栏和 KPI 卡，是最大的重复造轮子来源。

本项目通过仓库根 `.mcp.json` 接入 `heroui-pro` MCP（`@heroui-pro/react-mcp`，一次覆盖 Pro 与 OSS），token 走 `HEROUI_PRO_TOKEN` 环境变量，不得写进仓库。标准顺序：

```text
list_components      确认组件存在性、归属包与 import 路径
get_component_docs   取 anatomy / props / 示例（参数名为 components，传字符串数组）
get_css              取 BEM 样式
get_docs             取安装、主题、Styling、Composition 指南
get_theme_variables  取设计令牌
```

MCP 工具**只在会话启动时加载**，未加载、未批准或非交互会话里用直连脚本执行同一流程（共用同一 token）：

```bash
npm run heroui:mcp -- list             # 列出全部组件
npm run heroui:mcp -- docs <组件...>    # 组件文档（anatomy / props / 示例）
npm run heroui:mcp -- css <组件...>     # BEM 样式
npm run heroui:mcp -- guide theming    # 指南
```

### 7.2 落地来源与降级

组件用**本地源码**落地：`D:\WorkProject\HeroUIPro\herouipro-v3\src\components\<kebab-case>`。本项目以 vendor 源码接入（`apps/desktop/src/renderer/heroui-pro/`），**不是 npm 依赖**；禁止使用未安装的 `@heroui-pro/*` 包别名。

MCP 不可用、token 缺失或会员受限时，不停止、不写占位组件，直接按 kebab-case 从本地源码检索，并连同依赖组件、CSS、theme、utils 和 npm 依赖一起适配，确保当前项目能真实 import、build、render。

MCP 与本地源码不同步时（例如 `holo-card` 只在 MCP 有）：**“组件是否存在”以 MCP 为准，“能否 vendor”以本地源码为准**，两者不一致先停下确认。

### 7.3 依赖成本分档

65 个上游组件中 **53 个零新增依赖**（项目已有 `tailwind-variants`、`motion`、React 19），可直接复用：

- 布局导航：`app-layout`、`sidebar`、`navbar`、`resizable`、`sheet`、`command`、`segment`、`stepper`、`context-menu`
- 数据展示：`data-grid`、`list-view`、`item-card`、`item-card-group`、`action-bar`、`timeline`、`agenda`、`file-tree`、`floating-toc`、`empty-state`、`kanban`、`widget`、`hover-card`、`chart-tooltip`
- 表单：`drop-zone`、`rich-text-editor`、`checkbox-button-group`、`radio-button-group`、`native-select`、`inline-select`、`cell-select`、`cell-slider`、`cell-switch`、`cell-color-picker`
- 状态反馈：`rating`、`trend-chip`、`number-value`、`pressable-feedback`、`kpi-group`、`emoji-picker`、`emoji-reaction-button`
- 小智交互：`chain-of-thought`、`chat-message`、`chat-conversation`、`chat-list-view`、`chat-tool`、`chat-source`、`chat-attachment`、`chat-loader`、`chat-message-actions`、`prompt-input`、`prompt-suggestion`、`text-shimmer`、`code-block`

优先复用上表中与任务匹配的组件。需新增依赖的 12 个必须先显式确认，不得静默 `npm install`：`recharts`（`kpi` 及 7 个图表组件）、`marked`（`markdown`）、`@number-flow/react`（`number-stepper`）、`embla-carousel`（`carousel`）、`maplibre-gl`（`map`）。KPI 卡可先用零依赖的 `kpi-group` / `trend-chip` / `number-value`，不必为 `kpi` 单体引入 recharts。

> `marked` 当前是幽灵依赖（存在于 `node_modules` 但未声明在 `package.json`），引入 `markdown` 前必须先补声明。

## 8. 视觉与可访问性

界面以高密度、低噪声、可信工具感为主；用颜色表达状态和来源，不用大面积渐变与宣传口号。正文、题目和公式优先可读性。

- 1366×768 与 1920×1080 均可访问所有主入口和关键按钮。
- 键盘焦点可见；表单有 label；图标按钮有可访问名称；状态不只依赖颜色。
- 拖拽必须有键盘或按钮替代。
- Markdown 预览隔离全局表单样式，任务列表 checkbox 不继承普通输入尺寸。
- 大文档/表格避免破坏窗口滚动和焦点；modal/drawer 可关闭且恢复焦点。

## 9. 前端完成门禁

前端完成不是“组件能渲染”，而是：

```text
真实导航入口
-> 用户点击/输入
-> typed preload
-> 生产 main handler
-> SQLite/文件真实变化或读取
-> UI readback
-> 失败/取消/空态
-> 重启后复验
```

组件状态测试覆盖视觉状态，Electron E2E 覆盖用户路径；二者不能互相替代。所有能力状态记录在 `26_FRONTEND_E2E_COVERAGE_MATRIX.md`。后端存在但前端/E2E缺失时只能写“后端已实现”。

## 10. UI 变更检查

新增页面或导航时同步更新 ViewKey/route、navItems、render 分发、testid、组件状态测试、Electron smoke 和覆盖矩阵。若改动小智 route、工具或确认项，还要运行相应 AI/observability 测试。视觉检查至少覆盖双视口、长文本、空数据、失败、部分成功和键盘操作。
