# P06d Codex 聊天区精确对照交付合同

日期：2026-10-03。模块 M10/M01；承接 docs/67、95–96。完整目标仍在进行。本轮先交付 D2/D5 的阅读边线与真实过程行切片，不能据此宣布 D1–D7 完成。

## 1. 基准与当前证据

冻结参考：docs/design/codex-2026-10-03/process-reference.png（912×1104）与 workspace-reference.png（2559×1529），原 SHA256 见 docs/67。已重新查看原图。参考 DPI/字体文件/窗口状态未知；约 1.25 缩放只能作为推断，不作为同 DPI 像素误差证明。

当前正式 out：build-final3/index-CQ0eiDPc。空态实际 Electron 基线 `apps/desktop/test-results/xiaozhi-agent/pi-workspace-baseline-3iPyqG`，1366×768、1920×1080，独立 SQLite/profile。第一次 ptPPST 在历史读取结束前截图，不作为稳定基线；脚本已等待真实 conversation 与可用输入。

| 组件 | 参考观测 | 当前实现与缺口 | 本轮教师可见结果 |
| --- | --- | --- | --- |
| 阅读正文 | 白底、无助手气泡；深灰文本；段落和操作行交替 | Pro ChatMessage/StreamMarkdown 已接真实分段；16px/1.7，turn gap20 | 保留真实顺序与正文，统一阅读宽度/边线；段落与操作行留白24px |
| 工具过程 | 小线性图标、灰色摘要；展开证据 | Pro ChatTool/Group 已接真实调用；完成图标默认勾号，与动作图标不同 | 使用实际动作类别图标；耗时与详细结果保留；失败/等待仍展开 |
| 输入区 | 大圆角白底；正文与输入文字边线接近；底部权限/模型/发送 | 外层 padding28 叠加 Shell padding18，文字相对阅读区额外右移；toolbar wrap | 去掉叠加横向 padding，输入文字与阅读正文差≤8CSSpx；模型/技能长名省略，完整可访问名称保留 |
| 小窗口 | 关键控件可达 | 1366 主聊天宽694；侧栏304、rail62、来源区306 | 1366/1920 默认工作区 toolbar 单行；窄于440px安全换行，不挤掉发送按钮 |
| 时长 | 低对比标题及其下细分隔线 | 当前用 border-top | 调整为标题下细线；值仍来自真实已结束 run |

## 2. 真实链路与修改范围

真源为原 Pi native entries / SQLite projection → typed preload snapshot/event → OfficeConversation/ToolProcess/Composer → 用户实际发送/展开/停止/重启。保留全部 id、事件顺序、使用量和等待状态；不做隐藏推理展示、假思考文案、计时器拆分最终答案。

复用 Finesse ai-console 的实际工作进度/可展开证据原则，及已复制 HeroUI Pro ChatConversation、ChatMessage、ChatTool、PromptInput 原实现。仅改业务适配层 OfficeToolProcess.tsx、OfficeComposer.tsx 和 office-conversation.css/pi-education-workspace.css；不改原 Pro 32 份来源。图标取已安装 lucide，类别只由真实投影 label 判定，未知类型使用中性工具图标。不是 Codex 官方同源组件。

测量脚本补 toolbar/control rectangles、正文/textarea 边线；真实 public-process 脚本独立 profile，增加双 viewport 默认布局与长技能标题实际交互测量。新增或修改测试不得接触正式教师资料。

无表/目录协议/IPC/preload格式迁移，无新依赖。既有页面、失败重试、队列、模型 CAS、教师确认、Skills 权限、原生菜单、文件面板保持原宿主链路。仅展示 CSS/图标适配可回滚，原组件和旧入口保留。

## 3. 验收与未完成边界

- build、renderer-components79、原 Pro 来源 verify；真实 DeepSeek public-process（多段工具、真实耗时、展开来源、缺失文件、压缩、待答停止、重启）。关键失败提示保持可见，发送后 textarea 清空。
- 默认1366×768/1920×1080：正文与输入边线≤8CSSpx，所有 toolbar 控件位于 shell 内且单行；窄阅读区允许安全换行。用实际 DOM + PNG + DPR/zoom/window metrics，不能只比 CSS 字符串。
- 实际审批专项与关键 main smoke；固定最终 out 后运行，git diff --check。
- 本轮完成后 docs/98 记录精确命令、成功/失败/未验边界与截图 hash；四根文档、26/28/35/67同步下一项。

本轮不声称完整视觉验收：文档面板/任务与队列/提问卡/权限弹层等剩余逐组件对照仍需继续；原截图中图像缩略图需要 P07 实际图像能力；实际无 VPN/安装与最终办公闭环仍未验收。

## 4. 实例发现后的限定修正

首次真实实例 UXACPr：前10检查通过，1920边线差10.33px失败（1366为6.67px）。实际阅读区含滚动条可用宽度，外部 composer 不含；依据 DOM 将 composer 最大宽度调整为928而非912，仍保留小窗横向16px。截图还发现旧 styles.css 的三类选择器把 ChatMessage.Content 覆盖为14px/1.75，全局 p 变为 muted；仅提高 office 局部选择器优先级，使真实 Markdown p/li/td/th 继承16px/1.7/深灰，新增实际内部节点指标。工具 trigger label 明确继承14px，最小行高24px。原 Pro 源码不改。

第二实例 mHhCLU 的真实内部 p 仍继承原 Markdown 主题色，须把 office Markdown 根的 color 明确设为 office-ink，不覆盖链接/代码主题。布局实例 EndJHo 前6通过，打开/关闭文件面板后技能消失：原 AppLayout 在 resizable 切换时重建 children。增加一个 office 输入状态 Context，放在 PiWorkspaceShell 外侧并以 sessionId 为 key，保留同会话草稿、技能、队列模式、错误和发送/停止互斥 ref；会话切换仍清空。仅 renderer 临时状态，不存入 SQLite/localStorage，不改原 Pro 或权限。扩大本轮文件范围到 PiEducationWorkspace 和新增 OfficeComposerState.tsx；专项必须验证未发送草稿/技能/队列模式在文件开关和重排后保持，以及换会话清空。
