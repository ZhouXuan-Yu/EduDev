# 研究来源与取舍

查阅日期：2026-10-24。没有可凭论坛热帖证明的“唯一最优UI”；以下是按个人教师、本地资料、组卷/错题审核任务作出的设计判断。

## 私人领域，只读使用

- E:\Obsidian仓库\ZhouXuan私人领域\02-项目\顶级UI设计\DESIGN.md
- 同目录UI优化方案v2.md、templates/_场景02-渐进展开工具/DESIGN.md、templates/_场景B-SaaS工具/DESIGN.md
- templates/Notion/DESIGN.md、templates/Claude/DESIGN.md

保留：渐进展开、统一间距、稳定排版、内容优先和单一强调色。拒绝直接套用：暗色默认、营销标题、霓虹、玻璃和趋势堆砌。Notion/Claude笔记覆盖品牌营销页面的部分较多，不能直接作为桌面工具的组件规范。没有改动私人领域原文件，也没有将全文发布到仓库。

Obsidian CLI已尝试，但客户端未运行，使用明确路径只读搜索作为替代。Agent Reach技能已查阅，但命令不可用；未安装工具、未改登录态，改用当前可用网页搜索。代码图谱有旧索引，返回旧AgentTrace实现，后续具体样式检查以实际文件和DevTools为准。

## 官方组件资料

- [HeroUI Pro Chain Of Thought](https://heroui.pro/docs/react/components/chain-of-thought)：确认isStreaming仅控制trigger shimmer；层级、内容、生命周期与SDK映射属于应用组合。原厂示例与产品目标必须分别验收。
- [HeroUI Pro Theming](https://heroui.pro/docs/react/getting-started/theming)：确认Tailwind→OSS→Pro顺序，以及主题通过共享变量影响组件。因此本轮采用默认亮色对照，不再借“局部主题”擅自重绑。
- 本机会话HeroUI Pro MCP返回组件文档；本地源仅用于许可范围内的原始文件比较。当前接口可用，不要求额外PAT。

## UX研究与社区

- [NN/g：The Custodial Era of UX，2026-08-28](https://www.nngroup.com/articles/ai-ux-debt/)：生成得快会积累体验债；可运行不等于有用、清楚或一致。本轮据此撤回“测试通过即已对齐”的判断，并先冻结可见合同。
- [Reddit r/UXDesign：Traditional UI vs chat vs agents](https://www.reddit.com/r/UXDesign/comments/1wsnew8/traditional_ui_vs_chat_vs_agents/)：近期讨论提出，精确编辑/比较信息仍适合结构化界面。这里只作为设计假设来源，不是统计结论；小智仍保留资料、题目和试卷审核工作区。
- [OpenAI开发者社区：Building Mia AI，2026-10-08起](https://community.openai.com/t/building-mia-ai-making-ai-agent-execution-visible-reliable-and-safe/1404516)：讨论真实状态转换、授权和结果证据；是社区经验，不当作官方产品规范。
- [Microsoft Research：Human-AI Interaction Guidelines](https://www.microsoft.com/en-us/research/articles/guidelines-for-human-ai-interaction-eighteen-best-practices-for-human-centered-ai-design/)：稳定的人机控制、修正与后果说明原则。不是2026新趋势，适合作为教师确认边界的长期依据。

适配结论：对话用于表达意图和阅读说明；列表、文档画布、原图对照、蓝图和审核面板用于精确操作。样式由一套原厂默认基线管理，领域内容各自拥有清晰的页面合同。
