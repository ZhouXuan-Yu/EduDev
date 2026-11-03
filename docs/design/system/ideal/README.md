> 2026-11-03：用户已最终批准当前UI，设计阶段结束。给开发AI的入口：[最终交接书](../UI_FINAL_HANDOFF.md)、[可结项Goal](../../../goal/UI_FINAL_IMPLEMENTATION_GOAL.md)、[固定验收](../UI_FINAL_ACCEPTANCE.md)。本文以下历史“待确认”只指当时状态。

> 本轮审阅请打开 `index.html#page=teaching&tab=组卷`。当前工作树为 `D:/WorkProject/EduProject-prototype`；不要继续打开协作者 `EduProject-sidebar` 中的旧副本。完整目录需一起保留，index.html 是唯一应用入口。

# 小智完整 UI 原型（组卷更新至 V3）

2026-11-01。本轮负责设计、交互 HTML、项目 Skill 与开发 Goal；正式业务源码由另一位 AI 实施。**交付版仍待用户视觉验收，不代表生产功能完成。**

## 打开与审阅

先打开 [设计交付总览](handoff.html)，再进入 [完整交互设计](index.html)。无需依赖、密钥或服务，整个目录一起保留。顶部目录包含全部16个业务入口。

1. 空白首页：简短欢迎、居中输入、轻量入口，右栏默认关闭。
2. 输入需求发送：公开说明、不同工具图标；交接时整段收起，用时在上，正文继续流式。顶部可切换运行/审批/完成/失败/停止。
3. 资料库：目录/标签/类型/状态组合筛选，文件查找与内容检索，批量整理，概要/原页/题目/笔记，校正、归档与队列。
4. 教学→组卷：完整题目选题、持久题篮、独立编辑、学生/教师预览；上传核对、命题方案、参考卷结构与版式。最新范围见 [组卷 V3](QUESTION_STUDIO.md)，旧三模式及六种导出描述不再作为当前实现。
5. 备课本→课堂设计与预演：40分钟活动、互动实验、理解检查、教师核对及交付。**新增能力提案，不表示正式软件已有完整能力。**
6. 学生工作台：先选学生，再切六个上下文视图；设置页查看日常/高级、模型/权限/备份恢复。

审阅工具条不是产品UI。全部为合成资料、学生、任务和文件；除组卷原型草稿在此浏览器保存外，其余仅在内存演示，刷新重置，不调用模型、不读数据库或用户文件、不执行写入。弹窗反馈不代表真实生成、导入、导出或恢复。

## 相比上一稿

输入框恢复为当前软件结构的表达：附件/模型/发送在框内，权限/技能/命令/思考在底部，分别有菜单。**正式实现整体复用 OfficeComposer 及弹层，不复制本原型，也不借此改变组件配置与内部设计。**

资料库从简单分类列表改为“组织→检索→核对原页与派生结果→处理失败”；组卷保持原有蓝图、三来源模式与领域约束，强化核对/版本/交付；课堂设计提案吸收 DeepTutor/OpenMAIC 的资料依据、课堂活动、理解检查和预演优势。首页与成果参考 ChatGPT Projects / Claude Artifacts 的模式，保留小智本地资料、教师确认、原页证据和文件权限。

详见 [差距、根因证据与取舍](../UI_GAP_AND_DECISIONS_V2.md)。参考项目真实运行证据在 evidence/references，与合成 HTML 截图分开。DeepTutor 完成一次真模型读PDF/工具/回答/刷新收起，资料索引失败也被保留。OpenMAIC 构建及首页已通过，课程生成与多媒体按独立报告说明，不以 Ready 日志视为全流程完成。

## 文件职责

| 文件 | 用途 |
| --- | --- |
| handoff.html/css | 总览、差距、审阅路径、Skill/Goal交接 |
| index.html / app.js | 产品原型外壳、导航、目录、直达参数 |
| tokens.css / shell.css / pages.css | 原型专用视觉和布局，禁止导入正式项目全局覆盖 |
| composer.js/css | 现有输入结构的原型表达，不是生产替换源 |
| chat.js/css | 六态、公开过程、正文、演示时序 |
| library-data.js / library.js/css | 资料组织、详情、校正、队列 |
| paper.js/css | 蓝图、核对、确认、历史、导出选择 |
| lesson.js/css | 课堂设计与预演增量提案 |
| resources.js / students.js | 教学、学生页内导航与上下文 |
| ui.js / settings.js / settings-dialogs.js | 共享原型、预览、设置、恢复流程 |
| check.mjs / evidence | 检查、截图、指纹及历史失败 |

未新增项目依赖或业务接口。HeroUI 官方网站/MCP用于选型，受限时查本地Pro源；这是原生HTML结构/状态表达，**不是官方React原样渲染证明**。原型定时器不允许用于生产事件判断。

## 验证

```powershell
node docs/design/system/ideal/check.mjs
python C:/Users/ZhouXuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/edudev-design
git diff --check
```

结果与SHA256以 [evidence/report.json](evidence/report.json) 为准；最终次数和边界见 [VALIDATION.md](VALIDATION.md)。覆盖五主页面、双尺寸、840/700窄窗、911×512近似可用CSS面积、菜单/附件/合成IME、过程折叠、显式右栏、资料/组卷/课堂、学生上下文、备份恢复、reduced-motion及交接直达。历史失败保留，页面错误和外部请求必须为0。

代表截图：[首页](evidence/chat-1366.png) · [合成过程](evidence/chat-running-tools.png) · [收起与正文](evidence/chat-completed.png) · [资料库](evidence/library-1366.png) · [逐题核对](evidence/paper-review.png) · [课堂预演](evidence/lesson-preview-1366.png) · [学生](evidence/students-1366.png) · [设置](evidence/settings-1366.png)。

## 后续开发

读取 [项目UI Skill](../../../../.agents/skills/edudev-design/SKILL.md) 与 [开发Goal](../../../goal/UI_DESIGN_IMPLEMENTATION_V2.md)，按U0～U7交付。保留输入组件、权限、Pi、数据和版本，U6独立排期。正式CSSOM、原生IME/DPI、实际模型、知识库检索、导出正确性、恢复与教师接受须在最新正式Electron另测。本轮无生产性能改善声明，不覆盖原有门禁失败。
