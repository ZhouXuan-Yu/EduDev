# Phase1 Codex Shell整体实施验收（2026-10-05）

Goal ACTIVE；Phase1 Master九项主工作台完成实现层A/C验收（非完整Goal/发布/人工接受）；Current Phase：Phase2 Pi Runtime Consolidation DOING。

## 1. 阶段完成定义

Master第55节Phase1明确九项，真实连接当前Pi、非静态Mock。下表接受这一阶段实现范围；不把Phase2唯一runtime、Phase3五空间、Phase4/5教育适配、Phase6飞轮和Phase7/8最终工程/人工发布要求混为本阶段。完整Goal未完成。

|Master要求|当前生产入口|当前或保留证据|判定|
|---|---|---|---|
|sidebar|`src\renderer\components\AiConversationSidebar.tsx`|test-results/xiaozhi-agent/pi-shell-ui-1IvLdM/report.json|A/C实现接受|
|chat|`src\renderer\components\office\OfficeConversation.tsx`|test-results/xiaozhi-agent/pi-shell-ui-1IvLdM/report.json|A/C实现接受|
|composer|`src\renderer\components\office\OfficeComposer.tsx`|test-results/xiaozhi-agent/pi-shell-ui-1IvLdM/report.json|A/C实现接受|
|history|`src\renderer\components\office\PiEducationWorkspace.tsx`|test-results/xiaozhi-agent/pi-shell-ui-1IvLdM/report.json；test-results/xiaozhi-agent/pi-control-ui-tc9lZN/report.json|A/C实现接受|
|status|`src\renderer\components\office\workspace-status.ts`|test-results/xiaozhi-agent/pi-shell-ui-1IvLdM/report.json；test-results/xiaozhi-agent/pi-control-ui-tc9lZN/report.json|A/C实现接受|
|tool UI|`src\renderer\components\office\OfficeToolProcess.tsx`|test-results/xiaozhi-agent/pi-control-ui-tc9lZN/report.json；browser-workspace prior finite closeout; changed theme covered by current shell|A/C实现接受|
|artifact|`src\renderer\components\office\PiOfficeArtifactCard.tsx`|office-facts prior closeout, unchanged production; original four format facts and render proof|A/C实现接受|
|settings entry|`src\renderer\components\office\PiWorkspaceShell.tsx`|test-results/xiaozhi-agent/pi-shell-ui-1IvLdM/report.json|A/C实现接受|
|glass design|`src\renderer\components\office\pi-workspace-glass.css`|test-results/xiaozhi-agent/pi-shell-ui-1IvLdM/report.json|A/C实现接受|

所有当前源码与报告SHA见owned results.json，原片段清单见audit-inventory.json。历史source有改动的证据仍按历史层保留，不能冒充本轮新执行；文件/Office两原closeout中的全部冻结source当前SHA相同，明确继承原有限A/C。

## 2. Codex扩展体验对齐

|体验|实际实现与证据|剩余范围|
|---|---|---|
|Working/公开过程摘要/Tool Activity|PiWorkspaceActivity、OfficeToolProcess、message_end投影；当前control30/终态无stale spinner，上一公开过程/网络有限closeout|完整自然任务与发布验收Phase8，不显示私有CoT|
|Plan/Progress/输入等待|PiTaskPlan/PiControlCards；当前真实update_plan/ask_teacher、驻留计划和回答后完成|完整教学工作流后续Phase4/5|
|Approval/Artifacts|PiCopyApproval/PiTextChangeCard/PiOfficeArtifactCard；继承Office28四格式事实/修改/拒绝/冲突/冷恢复|本轮未重做WPS/发布签认|
|Files|PiWorkspaceFiles/Hana只读解析/typed权限；继承原32+22和13PNG|发布/私有数据大文件性能Phase7|
|Steer/Stop/Resume|当前control30含真正SDK消费、幂等、停止、实际kill/冷恢复、自然clarification|不把旧DeepTutor续跑当已迁移，Phase2处理|
|Retry|PiConversationSurface失败重试回草稿，不自动重放写操作；上轮文件32含实际错误/重试|最终黄金失败路径Phase8|
|Compaction|当前native Pi/Hana自动整理，现有auto20/兼容20记录保留、当前组件转换边界|Phase2统一生产入口及Phase7/8完整恢复；无运行预算|
|Model/Skills/Settings|当前Shell设置来回/Skills真实入口；保留39设置、20菜单、17附件与对应历史closeout|用户日常D/发布E保持OPEN|
|Chat/Composer/History/Glass|本轮真实15/30，浅暗/双原生尺寸/代码对比/冷恢复9PNG|全Codex像素/行为与日常/跨网络不由此宣称完成|

## 3. 当前执行及失败

最终固定隔离build2，323文件/SHA 35c105f473b34db2ccdb7050b31a776294f0ba019a65f7b5fa70e56da612fdaa，正常npm run build含tsc exit0；renderer111/111，原Shell真实Pi/DeepSeek 1IvLdM 15项、原控制tc9lZN 30项、原教育主流程207均exit0，两个UI报告rendererErrors[]且绑定同build/script SHA。当前实际审阅9PNG：Shell浅暗双原生1366×768/1920×1080+dark cold5，原问答/驻留计划/补充/停止4。Shell35关键文字/代码标签/全部实际token颜色对比≥4.5，最低5.329007293127842；表格与真实渲染JSON实读核随机编号/37/8/分数课堂，冷恢复不重放。保上一轮文件32和Office28有限A/C原报告；各自所有冻结生产源码SHA当前相同，本轮未伪称重新执行。九项映射详见PHASE1_ACCEPTANCE_2026_10_05.md与owned results.json。

首次2LZ7WT：真实fence误渲inline，修兼容接缝；fZwHSm：原runner硬编码旧304/62而当前254/52，按当前布局事实修断言保滚动/可达/不裁切；u9Lu08：误要求持久化files:false，原schema只保存files:true，读端默认false，修测试保完整冷恢复。s5JOqA功能15成功但实际dark图审代码低对比，退回补原主题接缝和全部token断言；均保报告/PNG/日志。不删除首次失败，不追认为三次连续稳定。先前学生保存success提示间歇失败保持OPEN，当前main207通过未改学生源码，列Phase7稳定性欠项。

生产只加OfficeMarkdown薄适配器：沿原Pro StreamMarkdown/CodeBlock，pre恢复Streamdown2.5 data-block标记；app-owned CSS绑定原Shiki双主题到现有workspace media/semantic色。原vendor未改，无新依赖/Schema/IPC/model/权限/预算/上传变化；原OfficeConversation仅替换import/调用。inline、JSON fence、无语言fence、部分stream、HTML escaping边界5项加入原组件suite。

## 4. 阶段退出与下一项

Phase1九项实施接受；进入Phase2。Phase2 P2-01：按已核实旧IPC→Console/Graph/sidecar入站清单冻结RuntimeAuthority与兼容合同，移除正式环境回到旧编排的开关，逐条将旧聊天/续跑/停止迁移到Pi；保确定性教育Domain、旧数据和传统页面。不得直接删除agent-loop.ts或整搬DeepTutor/OpenMAIC Runtime。见docs/goal/PHASE2_RUNTIME_CONTRACT.md。

跳过测试样例书专项，唯一主线Master Goal；不无限重验已通过Shell小片，不将Phase2–8能力倒塞Phase1。日常原反馈/配置D、无VPN/安装E、完整Codex体感与像素对齐、教育黄金A–G、云视觉、WPS本轮版式、安全/Pro分发许可及三连稳定仍开放。没有改变Master、HEAD、daily out/profile/key、系统DNS/proxy/VPN，无提交/push。本轮不估算缓存命中率。
