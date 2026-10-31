# 实施映射与组件选择

按 Goal 的 U0→U1→U2→U3→U4→U5 执行；U6 是后置能力提案。先查看当前主线，下面文件是 `7c767fe` 定位基线，发生拆分时追踪实际消费者，不创建平行实现。

| 区域 | 优先核对/复用 | 设计表达 | 不能采取的捷径 |
| --- | --- | --- | --- |
| 编排 | PiEducationWorkspace / 现有事件投影和持久层 | 真实事件驱动状态 | 在 UI 新造 agent loop / 任务真源 |
| 输入 | OfficeComposer / OfficeComposerState / 现有 PromptInput 与 Dropdown | 原样复用，仅调整外层位置 | 复制 HTML composer、改菜单配置、重挂载清草稿 |
| 过程/正文 | OfficeAgentTurn / OfficeAgentTrace / OfficeAgentAnswer / OfficeMarkdown | 官方 ChainOfThought / Agent Trace Streaming 的结构和状态语义，公开说明＋真实工具 | 把演示数组/定时器接进生产、混入私有推理、把任何文字当 final |
| 导航/右栏 | 现有桌面导航/工作区Shell/文件预览适配 | Sidebar / disclosure / 现有面板 | 重建 route IDs、自动授予教学空间目录权限 |
| 资料 | 现有资料资源/原页/识别/题目/校正/任务接口 | DataGrid 或现有列表、FileTree、Tabs、EmptyState | 引入新资料真源，默认展示大段原文，删除失败记录 |
| 组卷 | PaperBlueprintWorkspace 与现有题库、确认/导出服务 | Stepper 视觉＋领域表单、原题预览 | 步骤样式代替真实版本/权限/来源校验 |
| 学生/设置 | 当前领域workspace和typed IPC | 搜索列表、Tabs、分组表单/披露 | UI绕过权限或新造学生统计 |

## HeroUI 查找顺序

1. 官方公开网站/文档识别组件；已认证 MCP 可补查官方 API。不要把 React Pro v3 在线新 API 盲套本地旧版。
2. 受限或失败时查本地 `D:/WorkProject/HeroUIPro/herouipro-v3/src`，按 kebab-case 名称搜索，核对 CSS、theme、utils 和依赖；不要求 PAT。
3. 优先复用现有 vendored wrapper 与实际版本。CSS顺序、layer和slot状态经 U0 核对；不要再引一整套重复样式。
4. 第三方组件内部外观保持官方；单一主题源或组件配置变更需具体样张与用户批准。不得从本原型通用 CSS 推导对所有按钮/变量的覆盖权限。

## 推荐代码边界

按职责拆展示、纯事件映射、领域数据适配和页面布局，避免继续把全部 JSX、流式解析、配置、计时、工具渲染加进一个巨型文件。只有多个真实消费者才抽共享组件；不为代码行数拆分。保留 TypeScript 类型，不用 any、禁用 Lint 或删除回归规避兼容性。

正式组件状态测试必须使用真实事件合同或代表性固定回放；至少一条真实 Pi 闭环。业务变更测边界，纯可逆间距调整只做适用截图检查，不写镜像实现的测试。

调研证据、生产验证、教师视觉接受分开报告。DeepTutor的阶段边界、大纲审核和失败保留是可借鉴模式；不是必须移植其代码、依赖或后台架构。
