# 旧UI为何失真：证据与本轮纠偏

下列初审证据来自上一轮固定构建及隔离验收库。初审阶段未修改正式入口、未发模型请求。用户批准样张后，已在同一工作树替换正式入口并运行真实provider验收；最新范围与证据见 DELIVERY.md。初审结论不再表示当前实现状态。

## 已证实：保护边界只覆盖内层，外壳仍被旧规则重写

真实DevTools开启DOM/CSS，采样computed、matched规则、候选来源、层级和获胜选择器，共11个样本。完整记录见[evidence/runtime-cssom.json](evidence/runtime-cssom.json)。原始构建CSS的URL和行号是真实CDP结果；源文件列表是同选择器匹配候选，不伪称source map提供的唯一来源。

| 元素/状态 | 实际computed | 获胜选择器 | 源码候选 |
| --- | --- | --- | --- |
| 标题栏 | background rgb(230,249,247) | .desktop-titlebar | desktop-frame.css:2 |
| 选中轨道按钮 | background rgba(38,59,57,.1) | .xiaozhi-pi-workspace .product-rail button[aria-current="page"] | product-spaces.css:5 |
| 会话侧栏 | background rgba(247,251,248,.8) | .ai-console-v3.xiaozhi-pi-workspace .pi-conversation-sidebar | pi-education-workspace.css:60 / pi-workspace-glass.css:22 |
| 聊天标题栏 | 同上，带玻璃背景 | .ai-console-v3.xiaozhi-pi-workspace .ai-chat-header | pi-education-workspace.css:53 / pi-workspace-glass.css:35 |
| 聊天标题栏按钮 | color rgb(89,109,105)，font16px | .xiaozhi-pi-workspace .ai-chat-header button | pi-education-workspace.css:5、56 |
| 标题栏按钮Hover | background rgba(38,59,57,.06) | .xiaozhi-pi-workspace :is(...):hover | pi-workspace-glass.css |
| 过程trigger | 原厂muted，font14px | .chain-of-thought__trigger | 原厂Pro CSS |
| 资料库header/选中项 | 继续使用玻璃色板 | .product-header / .product-page-link[aria-current="page"] | product-spaces.css |

这些应用外壳规则没有CSS layer，仍可压过原厂分层组件规则。native-component-boundary把旧规则限制到受保护聊天根以外，但并未保护全部导航、外壳和领域页。pi-workspace-theme还对外层与portal重绑--foreground/--muted/--accent/--surface等。于是“聊天内层对照通过”和“整个界面保持原设计”同时出现矛盾。

结论：不能继续在这个基础上追加几条覆盖规则。需要按页面归属替换旧主题/外壳入口，并让应用布局与原厂组件分别拥有样式。

## 已证实：应用组合已偏离用户指定示例

- 当前名为AgentTraceStreamingDemo的应用函数，运行时使用普通div，结束后换成单个ChainOfThought；工具又各自使用披露。它不是官方示例的原样代码。
- 官方Agent Trace Streaming是多块TraceItem、嵌套TraceSection/FileAction、420px示例布局及默认展开。最新MCP文档导出名为AgentTraceStreaming，不存在一个接上SDK即可自动完成全部行为的神奇Demo接口。
- PiWorkspaceShell和ProductSpaceShell显式传了reduceMotion，关闭默认布局动画；其它尺寸/样式配置也由应用层叠加。

结论：原厂多块时间轴与Codex正文式过程的结构不同，不能通过同名函数掩盖。用户已在并排样张中确认采用产品时序；正式唯一组合现命名AgentProcess，官方示例保留为开发审阅对照。

## 已证实：样式和运行语义是两件事

isStreaming负责trigger的shimmer，不会从Pi SDK产生公开说明、调用工具、识别最终正文或自动收起。上述能力必须由事件、投影和受控状态保证。

用户已选默认公开说明＋工具，原生reasoning仅详情。如果provider这一段只返回原生字段，默认内容会很少；UI不能把隐藏字段或固定三段日志冒充公开工作说明。缺少可信阶段事件时，旧适配器还需等SDK结束才能确认正文，无法承诺所有provider在首字之前完成交接。

前轮真实样本的本地准备约13.6–13.7秒，之后供应商首推理0.7–1.7秒。这是历史真实测量，不是本轮新测；准备内部哪一项最慢仍未定位。此等待不能归咎于原厂ChainOfThought，也不应通过假过程填充。

## 已证实：此前测试门槛没有覆盖用户的视觉接受

测试证明了某些typed事件、自动折叠、复制/导出和CSS内层一致性，却没有证明用户要求的整套构图、密度和组件组合。把29/29写成“已按要求修复”是验收口径错误。本轮明确撤回视觉对齐结论，原验收日志保留作为有限范围的历史证据。

## 已核对但不是视觉根因

PromptInputTextArea相对本地HeroUI源有已有IME Enter补丁，+2/-1行。这处补丁保护中文输入，不改变布局和颜色；本轮未删除或修改。其它已比较的ChainOfThought、ChatMessage和Pro CSS一致。完整比对在component-baseline.json。

## 本轮处理边界

本轮已经建立独立逐页合同、原厂指纹、样式所有权检查和可运行的审阅稿；未把样张接到业务IPC，也未删除正式功能。用户要求组件设计变动先获允许，因此先展示具体结果并询问唯一基线。后续替换必须沿同一工作树实施，删除旧展示层并进行真实业务验收，不再叠补丁。
