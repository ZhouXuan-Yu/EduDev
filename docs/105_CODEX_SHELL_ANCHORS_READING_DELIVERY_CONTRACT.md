# P06d-E 壳锚点与长阅读交付合同

日期2026-10-04，M10/M01。上一103→104为progress：原生窗口恢复与完整差距表真实交付。没有活跃测试句柄；本轮以现checkout/参考/源码/新实例为准。总目标active，三元题组暂停。

## 1. 教师可见结果与当前缺口

- 原R2 2559×1529：轨约x0–78、sidebar78–459、主白区x459；sidebar RGB246/253/252。当前native2558×1529白区x549、rail62/sidebar304 CSS，sidebar245/251/251；差距见104，不忽略明显结构差。
- 新读原像素x1000竖向：R2白header y66–142，当前y54–145；当前titlebar平色230/246/246，参考230/249/247。继续保留真实36px native caption/menu，内容壳上沿增加8px留白、标题62→52；轨仍原坐标，避免把留白误加到原生窗控高度。
- 在当前native scale1.5/相近图像尺寸的校准参数：rail52/sidebar254、main x306；native白区约459，top约66/header bottom约144。它们是**本宿主条件校准**，不是确认参考DPR或全页≤2CSSpx。两native content窗口仍须可操作。
- 公开长历史在模型继续输出时向上阅读不抢底；明确回底按原按钮跟随。文件面板开关、设置往返保留同会话阅读锚点与未发多行草稿；不串其他会话，不重放模型/工具。先真实实例查缺口，有缺口只做原组件adapter。

## 2. 原源与纵向修改清单

已有graph索引检索OfficeConversation/PiWorkspaceShell/ChatConversationRoot并读取真实symbol；官方HeroUI MCP app-layout/chat-conversation/sidebar文档查验（Pro源不由MCP暴露），沿已本地复用且SHA可核的Pro32。Finesse pinned AI-console/public stream/stop/receipt原则保持，用户R1/R2优先，不重选模板。

- 修改office-scoped pi-education-workspace.css：rail/sidebar/sidebar色、标题尺寸；desktop-frame.css只校原图框色与AI壳顶部留白，不改native overlay源码/36px窗控/main行为或全站按钮。
- 若实际阅读实例证明reparent/remount丢位置，可新增office阅读bookmark adapter与session-keyed临时Context字段，接原ChatConversation的ref/onScroll/原ScrollButton；不修改原Pro源码、不自己造聊天/滚动组件。仅UI有限缓存，换会话清空，不持久化正文或权限。
- 焦点/多行/IME从原PromptInput真实API验证；若发现adapter缺口再登记修复。浏览器composition协议实例与Windows真人IME分开，不冒充真实系统输入法。
- 新专项script从真实UI发送合成教研文本/真DeepSeek返回、读main/native事实、实际wheel/按钮/typed文件/设置动作，截图与native caption/bounds/DPR/font/锚点。无新业务表/共享schema/IPC/依赖/数据目录格式/云上传规则。

## 3. 完成门禁与失败恢复

1. 实际参考比例窗口和1366×768/1920×1080：DOM rail/sidebar/main/header锚点、sidebar/titlebar颜色，native捕获读回；R2相关结构显著差距关闭，未知字形/官方未见状态仍标记。
2. 真provider长合成教研历史；流式期间wheel上读→新增公开文本/结束不抢滚动→原回底；真实文件开关/窄布局与设置返回，未发多行草稿/输入可达/焦点有效，session隔离。主进程和native消息不因UI缓存改变。
3. build、renderer79、Pro32/原chrome静态；新增专项、实际文件、真实过程/问题/审批/停止和必要菜单专项；主smoke207、git diff --check。固定源码后实例，不在活跃实例期间改out。
4. 106记录精确通过/失败/skipped、source适配与真实边界；原图/图像不编辑；四根+26/28/35/67同步，下一位置明确。

旧入口/现授权/Pi唯一循环保持。回滚限本轮adapter样式/读取bookmark，不删除教师文件/数据库。无新迁移、API Key或私有摘要入renderer/cache；不提交推送、改系统网络或派子agent。

## 4. 完整范围仍保留

### 第一实例发现（adapter修改前）

9vjJfD前5通过：两native窗口锚点/底色、真provider长历史、实际wheel在真实新增delta与终态后不抢滚动、原回底按钮。实际打开授权文件后原阅读段落位置丢失，Pro布局重挂载时初始滚底。按§2补session-keyed ephemeral段落锚点adapter（身份/块索引/相对位置/atBottom），用原ref/onScroll通知原组件，不改Pro源/协议/authority；设置隐藏返回的resize也纳入实例，不因存draft通过就称阅读通过。

D1–D7整体验和精度均按67/103继续，不能从本轮锚点/阅读通过推断全页同源/全部功能一致。持续goal、真实变更审阅撤销、Office/PDF正文与导出、国内联网、附件/图像/产物回执为P07正式工具/harness；P08实际VPN关闭/国内API/安装/新旧数据/最终八组。新实例发现其他缺口须记录且修复，不用静态长文本/伪工具状态替代真实过程。
