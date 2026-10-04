# P06d-B 问题、审批、队列与菜单交付合同

日期：2026-10-03；M10/M01；承接67/97–98，完整目标active。上一轮是有实际代码/实例/文档的进展，不是等待或无进展。当前正式out index-D4i0noIl，四根已复核，保留现有脏工作。

## 1. 目标与差距

沿用用户R1/R2原图和会话中早期问题卡截图：白底圆角、轻边线、灰色“问题”标题、纵向编号选项、自由填写、右下提交。早期问题卡原临时PNG当前不存在，仅可依据会话可见图描述，不伪造原像素/DPI。图中没有完整权限菜单/所有设置状态；用现成HeroUI原组件和实际能力组合，不承诺未见状态的官方同源。

| 表面 | 当前真实链路/缺口 | 本轮结果 |
| --- | --- | --- |
| 问题 | PiControlCards → answerXiaozhi → durable question → Pi工具继续；当前横排选项点击立即提交 | 纵向编号选择，只选不提交；自由回答同一字段；明确发送回答、提交失败与等待/中断。测试同步改真实两步操作 |
| 审批 | PiCopyApproval → decideXiaozhi → 原copy事务/readback | 白色轻边线卡、来源/目标可核；批准/拒绝保留原Pro ApprovalActions。pending/uncertain/failed展开，终态紧凑可展开 |
| 指令队列 | 原schema/revision/CAS/宿主delivery | 排队态保留编辑/模式/撤回；applied/withdrawn/中断真实回执轻量折叠；不把queued标送达、不撤销已执行 |
| 权限入口 | OfficeComposer按钮未收到onPermissions而始终disabled；原目录chooser/main guard与设置已可用 | 原Dropdown展示实际只读/逐次确认策略，可选目录或进入现有设置；不提供虚假的“完全访问”或新增授权 |
| 模型菜单 | 原官方DeepSeek目录/同历史CAS切换已通过94 | 沿用原Dropdown，统一圆角/排版；空闲可选/运行时锁定；实际菜单选中态/全名与控件可达 |
| 侧栏 | 原Pro sidebar/chat-list与现有搜索/文件夹/归档 | 核实际heading/行字号和选中行；仅局部scope修补实际差距，原业务入口保持 |
| 临时输入 | 98已保留文件重排时composer状态 | 问题答案与队列编辑草稿也须在同会话面板重排保持；换会话清空。设置往返草稿另作为可证缺口核验，不用文件开关结果代替 |

## 2. 复用与范围

本轮已用HeroUI MCP查ChatTool、ChainOfThought、Button、Dropdown、RadioGroup、TextArea文档；Dropdown原源可取，TextArea源端返回not found，使用已安装3.2.2原primitive，不伪称下载成功。Pro32原文件/闭包保留，ChatTool/ApprovalActions与ChainOfThought继续复用。Finesse ai-console的实际进度、失败展开与可审阅动作原则沿用；用户截图颜色/排版优先。无新依赖、许可或安装体积变化。

修改office PiControlCards/PiCopyApproval/OfficeComposer/OfficeComposerState/PiEducationWorkspace与专用控制卡CSS；必要时局部workspace/sidebar样式。维持共享类型、typed preload、main/SQLite/native JSONL真源，无新表、迁移、IPC或上传规则。选项由立即提交改为明确提交属于UI语义改动，宿主answer和既有幂等/锁不改；旧测试不得继续用单击选项当已送达。

若问题/队列草稿在文件分栏重排丢失，在98会话key provider加入按control.id划分的有限临时UI记录；记录不授予权限、不保存到SQLite/localStorage，终态/新会话按既有状态判断。原独立消费者本地fallback保留。设置往返如需跨App编排，先给出确证和合同补充，避免将工作区常驻隐藏来冒充状态安全。

## 3. 完成定义与门禁

- build、renderer79、原Pro32来源校验；最终out固定后主smoke207/gitdiffcheck。
- 正式真实DeepSeek问题/计划/队列实例：选择不提交→发送、自由答、两viewport、停止/重启；问题草稿/队列编辑在文件开关保留，提交后真实消费，旧内容不送达。
- 原queue专项：编辑/改模式/撤回、陈旧/跨会话/并发、实际streaming、dispatching锁和真实kill/restart不重放；隔离profile/data，受控延迟明确标注。
- 实际审批拒绝零写/确认一次/重启readback；pending两viewport完整按钮可达。
- 权限菜单真实可开/策略可读/选择器取消/配置跳转；模型菜单真实选中和运行锁定；侧栏搜索/当前会话/新聊天入口可用。
- 所有交互用正常用户控件，无force。截图/DOM/原字节hash写docs/100与设计证据目录；四根、26/28/35/67同步精确结果与下一项。

不以小套件勾完整D1–D7/P06或总体验。未见官方菜单状态/参考DPI、P07实际Office/PDF/图像产物、P08实际无VPN/安装/最终八组仍独立验收。教育双闭环/脱敏上云/教师确认规则保持；三元题组继续暂停。

## 4. 实例确证后的范围补充

当前应用控制18/队列16已通过。菜单OCEMDo中Popover实际存在但Menu display-contents没有可测visible box，夹具改测可见原Popover；cXb9NR退出动画期间双Popover导致strict失败，夹具按data-exiting/entering等待真实稳定状态；7Wa6KB前6通过，真实Settings/back草稿确实变空。

因此修改App的Pi ai/settings分支为同一个稳定工作区容器，只在这两个页面间保留该会话的renderer和临时输入状态（离开到教师业务页面仍卸载）。隐藏时关闭Skills Modal及所有composer Popover，工作区/Shell快捷命令返回false；持续接收真实执行回执。返回时核活动列表并hydrate原main snapshot/模型/权限、读回原展示prefs；刷新期间输入禁用，当前会话不再活动则沿既有open/fresh选择，不用草稿缓存复活权限或归档。新增visible prop仅用于UI生命周期，无新IPC/数据格式。必须重跑原统一设置26（prefs/归档/backup/active同run），菜单native/权限Settings往返，实际模型与审批路径。原源PromptInput流式Stop使用utility span但复制CSS未带size/bg utility，局部adapter补真实白色方块，并核实际可见面积；问题TextArea rows1/字重400以贴近参考图。
