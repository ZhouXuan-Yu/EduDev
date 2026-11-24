# 02 现状基线与代码入口

编制时核查日期：2026-11-24（北京时间）。这些是只读证据，不是本轮运行测试结果。

## Git 与截图身份

| 项目 | 核实结果 |
| --- | --- |
| 仓库 | https://github.com/ZhouXuan-Yu/EduDev |
| 截图分支 | ui-audit/20261124-1848 |
| 截图提交 | db9056a6633b1fad14f652840810ae889c65c1ca |
| 本包核查时 main | 10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947 |
| main 提交时间 / 标题 | 2026-11-24 19:50:58 +08；统一小智对话待处理面板与复用约束 |
| 两分支关系 | diverged；main 相对截图分支 ahead 2、behind 1 |
| 共同祖先 | 60f7f4f004aa39cf760eaa351952f96d437509b2 |

比较依据：[固定提交 compare](https://github.com/ZhouXuan-Yu/EduDev/compare/db9056a6633b1fad14f652840810ae889c65c1ca...10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947)。执行时必须重新读 HEAD，不把本包所列 SHA 视为永不变化的最新版本。

## 13 张历史证据

目录：[docs/ui-audit/20261124-1848](https://github.com/ZhouXuan-Yu/EduDev/tree/db9056a6633b1fad14f652840810ae889c65c1ca/docs/ui-audit/20261124-1848)。

| 文件（均位于 images/） | 页面 / 状态 |
| --- | --- |
| P01-ai-current.png | 问小智，已有最近任务 |
| P02-tasks-current.png | 我的任务，未完成任务 |
| P03-library-current.png | 资料库，已有列表 |
| P03-library-detail.png | 资料库，概要详情 |
| P04-teaching-current.png | 教学工作台，教学任务 |
| P05-files.png | 教学文件，空态 |
| P06-prep.png | 备课本，空态 |
| P07-handout.png | 讲义，空态 |
| P08-questions.png | 题本，空态 |
| P09-paper.png | 组卷，题库空态 |
| P10-students.png | 学生工作台，空态 |
| P11-student-form.png | 学生档案，未保存空表单 |
| P12-settings.png | 模型与连接，密钥为空 |

13 张图只有 12 个页面，其中 6 个仅空态。图像为 1362×901 像素，不是已测量 CSS viewport；原 JPEG 转 PNG，未改善画质。manifest 的 sourceSha 为 null；运行页来自 test-results/xiaozhi-agent/d3-mock-exam-scope/renderer/index.html，不能从文件夹名断定它等于某个生产源码提交。

未覆盖：其余学生页面、设置分类、PPT / 教案入口、题卷编辑预览、弹窗、内部滚动及目标分辨率。聊天中用户补充的设置截图属于补充视觉证据，同样不能替代新构建验收。

## 当前问题证据与待核实根因

| 已观察现象 | 教师影响 | 执行时必须核实 |
| --- | --- | --- |
| 设置多层标题、长解释和窄分组挤在一起 | 难找当前项、重点和保存动作 | 当前 CSS 级联、字体继承、布局层级是否仍复现；不可未经检查断言“CSS 未加载” |
| 悬停与当前分类可呈现相同灰底 | 不知道当前在哪 | 唯一 aria-current 与实际状态分别核实，不能仅凭截图断言“双选中” |
| 任务标题长、重复，状态解释多而动作弱 | 难判断该做什么 | 对真实任务状态和可执行动作建立映射，不伪造继续执行 |
| 技术名词、诊断字段进入日常设置 | 老师不懂用途 | 真实接口和配置负责方提供范围 / 保存 / 生效语义后再简化文案 |
| 黑色粗三角和默认控件质感不统一 | 页面呈现割裂 | 原生 marker、现有 HeroUI wrapper、导入和样式污染分别检查 |
| 用户感到不流畅 | 可能是导航、状态、响应或渲染问题 | 分别测路径、输入 / 滚动、首次反馈和异步等待；不能统称性能优化 |

## 依赖核实

固定提交 package.json / package-lock.json 所示：HeroUI React / Styles 3.2.2，lucide-react 0.468.0，React 19.2.8，react-aria-components 1.19.0，tailwind-variants 3.3.0。包声明可能有版本范围，锁文件才是该快照解析结果；执行时重新核查实际安装，不擅自升级到在线文档版本。

[package.json](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/apps/desktop/package.json) / [lockfile](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/apps/desktop/package-lock.json)。

## 定位入口

- 根 AGENTS.md、apps/desktop/src/renderer/AGENTS.md、.agents/skills/edudev-design/SKILL.md 及 references/decisions.md、visual-system.md、interaction-contracts.md。
- docs/design/system/UI_FINAL_HANDOFF.md、UI_FINAL_ACCEPTANCE.md，docs/goal/UI_FINAL_IMPLEMENTATION_GOAL.md（其中固定轮次本轮已替代）。
- apps/desktop/src/renderer/ui-system/page-contracts.ts 是当前页面合同真源，实际有 18 项；旧文案“15 页”过时。
- apps/desktop/src/renderer/App.tsx、components/AiConversationSidebar.tsx：外壳 / 导航组合入口，不往 App.tsx 堆积业务。
- components/office/PiSettingsWorkspace.tsx、SettingsNavigation.tsx、PiTeacherMemorySettings.tsx、pi-settings-workspace.css：设置展示与样式。
- components/office/PiTaskReview.tsx：任务呈现入口。
- components/TeacherNotebookWorkspace.tsx、TeachingBookWorkspace.tsx、QuestionNotebookWorkspace.tsx、PaperBlueprintWorkspace.tsx：教学页面定位线索，实际调用关系由 Phase 0 验证。
- components/office/OfficeComposer.tsx、OfficeComposerState.tsx、ComposerCommands.tsx、PiComposerQueue.tsx、PiComposerPendingPanel.tsx、PiInteractionCards.tsx、PiControlCards.tsx、PiWorkspaceShell.tsx、PiEducationWorkspace.tsx：输入与等待 / 消息队列重点保护和回归。
- ui-system/composer-pending.module.css、composer-follow-up.css：新增行为关联样式，禁止全局样式误伤。

上述 components/ 与 ui-system/ 相对于 apps/desktop/src/renderer。路径变动时按符号定位，不创建第二份同名实现来绕过真实入口。

## Phase 0 的现场产出

记录 actual repo root、当前 / 远端 SHA、脏改动与归属、独立工作树、构建命令、启动路径、Electron PID / 窗口、renderer 指纹、依赖锁摘要、实际 CSS viewport / DPR / OS 与应用缩放。补齐 18 页可见路径，验证截图中的问题是否仍存在，并登记接口缺口。

不能确认源码—构建—窗口关系时，先修复验收身份问题，再开始视觉结论。
