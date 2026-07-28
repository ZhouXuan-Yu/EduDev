# 前端架构与 HeroUI Pro 组件复用方案

版本：v0.1  
日期：2026-07-28  
适用范围：Electron 桌面端、后续团队 Web 管理端、AI 工作台前端

## 1. 前端战略结论

Omni-Edu Agent 的前端不是营销官网，也不是传统教务后台，而是老师每天高频使用的教学工作台。

前端技术选型：

```text
Electron + Vite + React + TypeScript + HeroUI v3 + HeroUI Pro + Tailwind CSS v4
```

核心原则：

1. 使用 HeroUI/HeroUI Pro 作为主设计系统。
2. 能复用 HeroUI Pro 的组件直接复用，不重新造轮子。
3. 本地 HeroUI Pro 源码作为官方站点或 MCP 受限时的 fallback。
4. 所有业务组件必须封装在应用自己的 domain layer，避免业务代码直接散落依赖 Pro 组件细节。
5. 前端必须服务“学生档案、学习记录、附件、时间线、复盘、AI 任务”这条主工作流。

说明：

- 用户口中的 HeyUI Pro 在本项目中按 HeroUI Pro 执行。
- HeroUI 官方定位是基于 Tailwind CSS v4 和 React Aria Components 的 React 组件库。
- HeroUI Pro 提供高级组件、模板和 AI 工具组件，可直接支撑本项目的工作台形态。

## 2. 组件来源优先级

当需要组件、模板、布局或交互模式时，按以下顺序：

1. HeroUI 官方文档。
2. HeroUI Pro 官方文档。
3. 本地 HeroUI Pro 源码。
4. 项目内二次封装。
5. 自研组件。

本地 HeroUI Pro 路径：

```text
D:\WorkProject\HeroUIPro\herouipro-v3\src
D:\WorkProject\HeroUIPro\herouipro-v3\src\components
D:\WorkProject\HeroUIPro\herouipro-v3\src\css
D:\WorkProject\HeroUIPro\herouipro-v3\src\utils
```

已确认可复用组件目录：

```text
app-layout
sidebar
data-grid
timeline
drop-zone
rich-text-editor
markdown
kpi
kpi-group
trend-chip
empty-state
file-tree
sheet
resizable
command
segment
native-select
number-stepper
checkbox-button-group
radio-button-group
chain-of-thought
chat-message
chat-conversation
chat-tool
chat-source
prompt-input
```

模板：

```text
template-dashboard
template-chat
template-email
template-finances
```

## 3. 前端应用架构

推荐目录：

```text
apps/desktop/src/
  main/
  preload/
  renderer/
    app/
      providers/
      router/
      shell/
    shared/
      ui/
      icons/
      hooks/
      utils/
      types/
    features/
      students/
      records/
      attachments/
      reports/
      search/
      ai-tasks/
      settings/
    entities/
      student/
      learning-record/
      attachment/
      review-report/
    widgets/
      student-sidebar/
      student-profile/
      learning-timeline/
      report-editor/
      local-storage-status/
      adversarial-review/
    pages/
      workspace/
      student-detail/
      report-review/
      settings/
```

架构规则：

- `shared/ui` 放 HeroUI Pro 二次封装。
- `entities` 放领域数据类型和基础展示。
- `features` 放具体业务动作。
- `widgets` 放组合业务区块。
- `pages` 只组合 widgets，不写复杂业务逻辑。
- Renderer 通过 `window.omniEdu` 调 preload API，不直接访问 Node。

## 4. HeroUI Pro 组件映射

### 4.1 主工作台布局

业务需求：

- 左侧学生列表。
- 中间学生详情和时间线。
- 右侧操作面板。
- 后续支持折叠、移动端抽屉、右侧上下文。

优先复用：

- `app-layout`
- `sidebar`
- `resizable`
- `sheet`

封装建议：

```text
shared/ui/AppWorkbenchLayout.tsx
widgets/student-sidebar/StudentSidebar.tsx
widgets/local-storage-status/LocalStorageStatus.tsx
```

### 4.2 学生列表与学生档案

业务需求：

- 学生列表。
- 搜索。
- 标签。
- 状态。
- 记录数、附件容量。

优先复用：

- `sidebar`
- `list-view`
- `item-card`
- `item-card-group`
- `data-grid`
- `trend-chip`

使用策略：

- MVP 左侧列表用 `list-view/item-card`。
- 团队版学生管理页用 `data-grid`。
- 高级筛选和批量操作用 `action-bar`。

### 4.3 学习记录时间线

业务需求：

- 按时间倒序展示课堂、作业、错题、沟通、阶段总结。
- 展示标签、附件、摘要。
- 支持筛选。

优先复用：

- `timeline`
- `segment`
- `native-select`
- `checkbox-button-group`

封装建议：

```text
widgets/learning-timeline/LearningTimeline.tsx
features/records/RecordFilterBar.tsx
entities/learning-record/LearningRecordCard.tsx
```

### 4.4 附件导入与资料管理

业务需求：

- 拖拽上传。
- 文件列表。
- 本地路径状态。
- 打开所在目录。
- 大文件复制进度。

优先复用：

- `drop-zone`
- `file-tree`
- `data-grid`
- `empty-state`

封装建议：

```text
features/attachments/AttachmentDropZone.tsx
widgets/student-file-tree/StudentFileTree.tsx
```

注意：

- 前端只发起导入请求。
- 文件复制由 Electron main 完成。
- UI 必须展示复制状态、失败原因和重试入口。

### 4.5 阶段复盘编辑器

业务需求：

- Markdown 报告。
- 教师可编辑。
- 家长版摘要。
- 证据引用。
- 质量检查。

优先复用：

- `rich-text-editor`
- `markdown`
- `code-block`
- `floating-toc`
- `sheet`
- `hover-card`

封装建议：

```text
widgets/report-editor/ReportEditor.tsx
widgets/report-quality-check/ReportQualityCheck.tsx
entities/review-report/ReportEvidenceRefs.tsx
```

策略：

- MVP 可以先用 textarea + markdown preview。
- V0.4 开始接 `rich-text-editor` 或 `markdown` 组件。
- 报告编辑器必须保留源记录引用，不允许纯文本孤岛。

### 4.6 AI 任务与透明工作流

业务需求：

- OCR 进度。
- AI 复盘生成进度。
- 错因分析结果。
- 相似题召回解释。
- 失败重试。

优先复用：

- `chain-of-thought`
- `chat-tool`
- `chat-source`
- `chat-message`
- `chat-conversation`
- `prompt-input`
- `text-shimmer`

使用边界：

- 不把产品做成通用聊天应用。
- AI 组件用于展示任务过程、证据和结果。
- 默认入口仍是业务表单和工作台按钮。

### 4.7 经营看板

业务需求：

- 在读学生数。
- 待续费学生。
- 复盘报告数。
- 老师跟进率。
- 高频薄弱点。

优先复用：

- `kpi`
- `kpi-group`
- `area-chart`
- `bar-chart`
- `line-chart`
- `pie-chart`
- `chart-tooltip`
- `data-grid`

策略：

- V0.5 前只做简单 KPI。
- V1.0 小团队版做团队看板。
- 看板读取聚合数据，不直接扫学习记录大表。

### 4.8 命令面板与全局搜索

业务需求：

- 快速找学生。
- 快速添加记录。
- 快速生成复盘。
- 快速跳转设置。

优先复用：

- `command`
- `prompt-input`

快捷键建议：

```text
Ctrl+K 打开命令面板
Ctrl+N 新建学生
Ctrl+Shift+N 添加学习记录
Ctrl+R 生成复盘
```

## 5. 设计系统

### 5.1 视觉方向

产品应是：

- 安静。
- 专业。
- 信息密度适中。
- 适合长期工作。
- 可信赖。

产品不应是：

- 营销感。
- 大面积炫光渐变。
- 过度卡片化。
- 学生端游戏化。
- 机构官网风。

### 5.2 色彩

建议：

- 主色：深绿色或蓝绿色，表达可信和教育服务。
- 辅助色：蓝色用于信息，琥珀色用于风险，红色用于破坏操作。
- 背景：浅灰白工作台。
- 不使用大面积紫蓝渐变。

Token 示例：

```css
--color-primary: #1d5c52;
--color-info: #2457a6;
--color-warning: #9a5b08;
--color-danger: #b34035;
--color-surface: #fbfcfc;
--color-muted: #66747c;
```

正式接入 HeroUI 后应迁移到 HeroUI/Tailwind token。

### 5.3 字体与密度

要求：

- 工作台标题不超过 28px。
- 卡片内标题 15-18px。
- 表单标签 13-14px。
- 表格和列表行高稳定。
- 按钮最小高度 36-40px。
- 移动端触控目标不小于 44px。

### 5.4 布局

桌面端：

```text
左侧 260-300px 学生导航
中间 minmax(620px, 1fr) 主内容
右侧 320-380px 上下文面板
```

移动端：

- 左侧导航变为顶部或抽屉。
- 右侧上下文下移。
- 时间线全宽。
- 不允许横向滚动。

## 6. 页面级信息架构

### 6.1 工作台首页

目标：

- 老师打开应用后直接进入可操作状态。

模块：

- 学生搜索。
- 学生列表。
- 选中学生画像。
- 学习记录时间线。
- 添加记录面板。
- 阶段复盘面板。
- 本地存储状态。

### 6.2 学生详情

模块：

- 基础档案。
- 当前问题。
- 学习目标。
- 家长关注点。
- 标签。
- 时间线。
- 附件。
- 历史报告。

### 6.3 报告编辑

模块：

- 报告条件。
- 源记录证据。
- Markdown/Rich Text 编辑器。
- 家长版摘要。
- 质量检查。
- 保存版本。

### 6.4 团队管理

后续模块：

- 老师列表。
- 学生分配。
- 模板管理。
- 标签库。
- 审核队列。
- 团队看板。

## 7. 组件封装规范

禁止页面直接大量使用第三方组件。必须建立应用级封装：

```text
shared/ui/Button.tsx
shared/ui/Select.tsx
shared/ui/Dialog.tsx
shared/ui/DataGrid.tsx
shared/ui/Timeline.tsx
shared/ui/DropZone.tsx
shared/ui/RichTextEditor.tsx
```

好处：

- 后续 HeroUI Pro 升级可控。
- 主题统一。
- 埋点统一。
- 无障碍属性统一。
- 业务页面更稳定。

## 8. 状态管理

### 8.1 MVP

推荐：

- React state。
- TanStack Query 可在接 API 后引入。
- Zod 做表单和 IPC 入参校验。

### 8.2 团队版

推荐：

- TanStack Query 管理服务端状态。
- Zustand 管理本地 UI 状态。
- React Hook Form + Zod 管理表单。

状态边界：

- 服务器数据不放 Zustand。
- 表单草稿可以放本地 state。
- 同步状态单独模块管理。

## 9. 路由规划

桌面端路由：

```text
/
/students/:studentId
/students/:studentId/reports/:reportId
/reports/new
/settings
/team
/analytics
```

MVP 可先无路由，用工作台单页实现。V0.3 后引入路由。

## 10. 前端性能要求

MVP：

- 首屏渲染 P95 < 2 秒。
- 学生列表 1000 条搜索 P95 < 500ms。
- 时间线 1000 条记录滚动不卡顿。

商业版：

- DataGrid 虚拟滚动。
- 附件缩略图懒加载。
- 报告编辑器分块保存。
- 看板图表读取聚合接口。

## 11. 可访问性

要求：

- 所有按钮有可读 label。
- 表单 label 必须关联输入。
- 弹窗、抽屉、菜单支持键盘。
- 颜色不能作为唯一状态表达。
- 错误提示必须文本化。

HeroUI/HeroUI Pro 基于 React Aria 的可访问性能力应优先复用。

## 12. 测试策略

### 12.1 组件测试

覆盖：

- 学生卡片。
- 记录表单。
- 时间线。
- 附件导入。
- 报告编辑器。

### 12.2 Playwright Electron E2E

必须覆盖：

- 应用启动。
- preload IPC 可用。
- 新建学生。
- 添加记录。
- 导入附件。
- 生成复盘。
- 重启后数据仍存在。

### 12.3 视觉验收

每个关键页面至少检查：

- 1440x900。
- 1280x800。
- 390x920。

检查项：

- 无横向溢出。
- 文字不重叠。
- 按钮文字不被截断。
- 关键操作第一屏可见。

## 13. 前端开发红线

- 不做营销首页作为主界面。
- 不直接复制 Pro 组件后改到不可升级。
- 不在 renderer 直接访问文件系统。
- 不让 AI 结果不可编辑。
- 不把复杂业务逻辑写在 page 文件。
- 不引入多套 UI 组件库。
- 不把所有状态塞进全局 store。
- 不让表格和时间线在大数据量下全量渲染。

## 14. 参考来源

- HeroUI 官方文档：https://www.heroui.com/docs/react/getting-started
- HeroUI 组件列表：https://www.heroui.com/docs/react/components
- HeroUI Pro：https://heroui.pro/
- HeroUI Pro 组件列表：https://heroui.pro/docs/react/components
- 本地 HeroUI Pro 源码：`D:\WorkProject\HeroUIPro\herouipro-v3\src`

