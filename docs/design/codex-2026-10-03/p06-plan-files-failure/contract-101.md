# P06d-C 计划、文件工作区与失败恢复交付合同

日期2026-10-03；M10/M01；承接67/99–100，整体目标active。上一轮有代码、真实89项控制/设置实例、79组件与207主冒烟的进展。四根/67第1/2/5/8/9/35最新已读，保留全部现有脏改动。

## 1. 教师可见结果与真实缺口

- 原R1/R2为参照：公开计划用轻量灰行和可展开步骤；运行中的任务摘要在输入附近；真实文件tabs横贯右工作区、下方阅读与文件树；失败提示保留已完成回执、可明确整理后再发送。
- 现有OfficeConversation用原ChainOfThought，但只拆投影字符串，office-plan旧display:flex使层级错误；真实控制steps/status已在snapshot.controls，需接原数据并保留旧投影fallback。当前没有独立持续goal宿主，不新增假持久目标/计时/百分比。
- PiWorkspaceFiles已用原OSS Tabs/Pro FileTree/Markdown和typed main权限/版本校验；tabs在阅读列内部且额外toolbar叠加，窄面板阅读宽度受树挤压。复用现有原组件移动tabs到顶部横排、局部标题/边线/文字；树可真实收起，关闭/刷新与旧文件版本校验不改。
- Pi正式OfficeConversation未提供onRetry，失败只有提示。恢复动作仅将该失败轮次原任务放回输入框供检查/改写后正常发送，不自动重放文件写入；已有未发送草稿不得被覆盖。

## 2. 来源与修改清单

已用HeroUI MCP查ChainOfThought/Tabs/FileTree/ChatMessage/ChatTool；Tabs接口返回官方原源码，已安装HeroUI3.2.2原组件继续使用，原Pro32保持。Finesse实际状态/证据/停止原则沿用，用户白底轻边图优先。图未给全部计划/失败状态，不声称Codex官方组件同源。无新依赖/许可/安装体积变化。

新office PiTaskPlan（原ChainOfThought、真实steps/status）与PiConversationSurface（原OfficeConversation、Context草稿恢复桥）；OfficeConversation可选renderPlan与retryLabel保留其他消费者默认；PiEducationWorkspace接snapshot/typed回调/当前run摘要。PiWorkspaceFiles与局部CSS重排现成Tabs/tree/预览、树开关/预览失败刷新；更新对应真实UI脚本，新增计划/失败/窄分栏实例。无新表/目录授权/共享schema/IPC/native JSONL/云上传，也不改Pi循环或主进程权限。

## 3. 完成、兼容与失败边界

现有完整plan字符串投影保留兼容；原control.id/run身份确定步骤，仅当前running/waiting显示任务摘要，历史完成后不伪装仍在运行。正文计划可以展开完成事实，不把公开计划当私有思考。任务摘要不计未知时长，不设置假goal。

恢复仅失败轮次、宿主空闲时可用，原用户消息存在才能放回；有新草稿则保留并提示，恢复之后仍明确正常发送。不授予文件/记忆/Skills权限，不自动retry provider/copy。目录取消/变更/超限/不存在保留原有失败与刷新/reselect路径；远程Markdown图片脚本不执行。文件预览仍只本地，不新增Office/PDF正文。

门禁：build/renderer79/Pro32；真实DeepSeek计划→问题等待→展开/完成/重启，模型调用预算真实耗尽后的partial/错误→恢复草稿→教师修改发送，不重放已完成工具；正常文件UI16原路径+Tabs/tree收起+预览刷新+窄面板/输入全部关键控件完整可达；真实过程原17（不把最终回复分割成假过程）、必要设置返回专项；最后固定源码npm test:smoke207/gitdiffcheck。所有脚本独立data/profile，受控chooser与预算明确标注。截图/DOM/报告/source原字节hash、失败和下一项写102/四根/26/28/35/67。

完整D1–D7/P06仍按父项范围审核；P07办公/PDF/图片/真实产物工具与P08实际无VPN/Windows安装/最终八组独立继续。三元题组暂停，本地优先/脱敏/教师确认/来源谱系保持。无commit/push/远端写/系统网络或真实教师库修改。

## 4. 实例范围补充：最小宽度与恢复

5nsBgH拖到窗口最右触发原Pro可折叠行为，夹具改拖到实际360px附近。CvIS2O/zc4C3p前22项通过，但最小面板365.5px在重启后扩大563.02px；native resize也复现，不能用选择器问题掩盖。当前BrowserWindow启动1360宽，原相对比例在较小启动布局碰到min-size后变化，扩大窗口时又随比例增长。通过原Pro AppLayout公开asideResizeBehavior=preserve-pixel-size模式让阅读面板随窗口变化保留可用像素宽度，主聊天仍按relative size消费剩余空间。原布局存储/权限/源代码不变；重新验收实际native两窗口尺寸、最小面板/树开关、重启宽度及完整文件旧路径。
