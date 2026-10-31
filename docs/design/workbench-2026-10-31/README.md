# 三栏教师工作台交付合同

本轮用户已提供四张参考图并明确要求实施；编排协议附件与上一份逐字相同。以参考图共同结构为布局目标，不把图中的示例学生、文件、任务进度当业务数据。L2 展示重构；涉及会话恢复、权限和生命周期的接线按 L3 保护。

## 功能保留与映射

| 区域 | 当前真实能力 / 处理方式 | 验收 |
| --- | --- | --- |
| 左栏 | 单一主导航、会话文件夹、最近对话、新建、标题搜索；原历史管理继续提供移动/重命名/归档 | 15 个旧目的页仍可达，增加教学/学生聚合页；搜索/新建/键盘/收放/冷启 |
| 中间 | PiEducationWorkspace 常驻，保持事件序号/缺口恢复、文本缓冲、幂等发送、停止、补充排队、每会话草稿、历史分页 | 真实 Electron；切页不卸载 Pi、不重复发送；审批与教师问题可达 |
| 首页 | 无会话内容时展示三项教学任务及示例提问，点击只准备草稿 | 不自动发送、不覆盖已有草稿、不制造模型结果 |
| 教学/学生 | 聚合入口复用现有教学文件/档案页面和所有领域目的页 | 真实列表和原 CRUD 保留；不创建第二份业务数据 |
| 右栏 | 现有任务与来源、真实任务计划、文件目录/标签/版本预览/取消/交付检查 | 任务/文件切换与关闭，文件 reveal 不丢失；空/失败/重试仍可用 |
| 安全 | typed preload → 原主进程文件/会话守卫 → SQLite 与本地文件 | 不改 IPC、Runtime、表、权限、上传规则及正式数据 |
| 原厂组件 | 现有 HeroUI OSS/Pro 源与 CSS 保持 | 不改 vendor、内部 slot、全局 token 或 !important |

“教学空间”在本切片指已有会话文件夹，仅组织对话；授权工作目录独立显示，不隐式绑定或扩大文件读取范围。当前搜索为标题搜索；Office 原版渲染/编辑能力按原实现，不以网页样张冒充。亮色限定。

## 顺序及边界

1. Astra High 只读功能与风险审查（已完成）；主 Agent 建立合同、隔离分支。
2. Sol High 分别实施左侧导航、首页/聚合组件；主 Agent 串行负责 shell/props/右栏接线，写集合互斥。
3. 类型/构建与组件；正式 Electron 双尺寸、窄屏、导航/搜索/新建/草稿/文件/流式和审批回归；保留失败。
4. Astra High 独立审查；修复阻断项；刷新 main、合并、正常推送，保护 D 盘三份未提交文档，再从 D 盘源码构建启动验收。

开始版本 origin/main e06cc05，任务分支 codex/workbench-ui-20261031，复用本 Agent 空闲隔离目录 D:/WorkProject/EduProject-sidebar 及其独立依赖。其他 AI 工作树不变。无需迁移；回退本轮展示提交恢复旧界面，UI 偏好可忽略，不清库、不删除文件。

## 完成定义

- 1366×768 / 1920×1080 与窄窗真实截图；单一侧栏、内容优先、右栏不挤压到控件不可达。
- 导航/历史/新建/标题搜索/聚合页/右栏/键盘焦点及 reduced-motion 按实际行为通过。
- Pi 流式过程、最终正文、停止、恢复及审批沿旧编排；不能把 mock provider 的集成测试当真实模型质量。
- 实际命令、退出码、截图、构建指纹、已知门禁与未验证边界写回本文件。未运行不得标通过，教师视觉接受留给用户。

## 本轮验证

本轮已完成三栏骨架、真实导航/历史、首页、两个聚合页和文件面板接线；15 个原业务页保留。领域页面内部表单/列表沿用现有实现，不声称四张示意图中每个业务屏幕均已重绘。教学空间复用会话文件夹，不是新的课程数据库。聚合页“新建备课/添加学生”进入原业务页，继续使用原创建表单。

### 修改职责

| 文件组（apps/desktop/src/renderer 下） | 目的 |
| --- | --- |
| ui-system/WorkbenchNavigation.tsx、WorkbenchState.tsx、workbench-preferences.ts | 单一导航、共享 UI 偏好、真实会话元数据与原操作回调；不持有第二份运行状态 |
| components/product/WorkbenchHome.tsx、WorkbenchHub.tsx；ui-system/EduNavigation.tsx、EduShell.tsx | 首页、两个聚合入口、保留全部旧路由、折叠与三栏布局 |
| components/office/PiWorkbenchBridge.tsx、PiEducationWorkspace.tsx | 接入真实会话/文件夹/历史；保留 Pi 编排与发送守卫 |
| components/office/PiWorkspaceShell.tsx、WorkbenchContextPanel.tsx、PiWorkspaceContext.tsx、PiWorkspaceFiles.tsx | 任务/文件原能力放入右栏、真实目录选择、窄窗和焦点恢复 |
| components/office/OfficeComposer.tsx、OfficeConversation.tsx、OfficeReadingPosition.ts | 应用控件与旧兼容样式隔离、首页不受对话底部锚定、首条消息后重新绑定阅读宿主、只读历史空态 |
| ui-system/workbench-navigation.css、workbench-pages.css、workbench-context.css、layout.css | 仅应用自有布局和交互态，浅色、150ms 披露及 reduced-motion |
| App.tsx、main.tsx、product-spaces.ts、page-contracts.ts | 增加两个聚合目的页和共享 Provider，原 15 页保持可达 |
| scripts/workbench-ui.mjs、workbench-live.mjs、product-navigation.mjs、daily-entry-smoke.mjs 等 | 正式 Electron 验收、真实模型隔离验收、原回归入口适配 |

仓库中相关测试的 composer 选择器统一从样式类改用稳定的 data-testid；保留原断言。未修改第三方 vendor 源、包依赖、主进程、IPC、权限和数据模型。此结论相对于合入后的 origin/main，不把协作者同期后端修改算作本轮 UI 修改。

### 已定位并修复的根因

1. CSS 边界适配器过滤了放在 components 层的应用外观样式，导致新首页表现失真。应用自有页面样式放回 ui-system 层，适配器和 vendor 均未改动。
2. 旧 prompt-input.compat.css 的容器 620px 规则命中 office-composer，导致 840 窗口中绝对定位工具栏变为 80px 高并覆盖 textarea；CSSOM/命中测试记录了覆盖。改用 wb-composer 隔离旧选择器，高级选项进入独立应用行，不覆盖原厂内部 slot。
3. 空首页放入正文的底部锚定容器时标题被裁切。独立首页滚动容器；首页转首条正文时阅读 hook 按 mountedHost 重新绑定，保留旧宿主清理。
4. 常驻隐藏 Pi 与可见导航各存偏好会相互覆盖，改为共享偏好 Provider；业务运行状态仍只有 Pi 一份。
5. 窄屏面板首击、历史从聚合页打开、创建会话重复跳转、焦点回归等由 Astra 独立审查提出，均已局部修复。

### 验证记录与边界

最终整合构建与截图索引见 [evidence.json](./evidence.json)，截图见 snapshots。早期记录按其构建指纹保留，不能混称为最终版本全量测试。

| 实际命令（apps/desktop） | 结果 |
| --- | --- |
| npm run build | 类型检查及正式构建通过；最终合并后再次执行 |
| npm run test:workbench-ui | 正式生产 Electron、隔离 SQLite/OS profile；25 项通过，双尺寸、840/700、15 路由、真实 TXT 导入/预览、草稿、历史、焦点、交互态、冷启；0 renderer 错误 |
| npm run test:renderer-components | 240/240 通过 |
| node scripts/office-reading-browser.mjs | 11 项通过，含空首页→正文宿主切换、阅读锚点、选择和历史补页；这是受控投影，不是模型验收 |
| npm run test:daily-entry | 8 项通过，真实学生/学习记录与冷启、单实例、排除旧 URL；原报告 daily-entry-zf4DX7 绑定整合前版本 |
| node scripts/workbench-live.mjs --env-file <本机私有文件> --read-only | 真实 DeepSeek 读取工具、运行展开/完成收起与正文、停止、冷启通过；测试只传输本轮自建文件，不输出密钥 |
| npm run test:ui-contracts | exit 1；17 页及共享生命周期断言通过后，既有 PromptInput index.ts 指纹漂移失败；未改 vendor 或放松断言 |
| npm audit --json | exit 1；45 项：8 high / 29 moderate / 8 low / 0 critical；无新依赖、未自动升级 |

没有独立 ESLint 配置/脚本，不声称 Lint 已通过。相关 mjs 语法校验及过程边界 19 项/桌面过程 7 项已通过，详 evidence。两种 OS 色彩偏好下均维持浅色；不交付暗色主题。

### 未解决事项与下一阶段

- 真实模型写入用例 run_d0735a7b-1a27-4aec-b5af-166e5f405e31：读取成功，多次“创建教学文档”失败，未产生审批卡；批准/拒绝写入链路未验收，不能算本轮通过。见 [FOLLOWUPS.md](./FOLLOWUPS.md)。本轮不修改后端工具来掩盖此失败。
- 保留已有 vendor 指纹与依赖漏洞门禁失败；既有启动 IPC 门禁本轮未重复执行。
- 教师视觉认可、不同 Office 文件格式实际编辑/导出、所有领域 CRUD 的完整回归仍需后续验收；本轮没有用示例文件或进度冒充真实结果。
- Astra gpt-6-astra High 负责独立只读审查，Sol gpt-6.1-sol High 分工实施；最终静态复审没有确认新的 P1/P2。静态审查不能替代以上运行证据。
- 回退使用本轮 UI 提交的逆向提交；不 reset 协作者主线、不删业务数据。UI 偏好为版本化本地记录，可被旧版忽略；未演练完整生产回退。
