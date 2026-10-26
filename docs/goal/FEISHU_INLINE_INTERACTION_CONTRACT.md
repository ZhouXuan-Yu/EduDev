# 飞书 S1/F07：问题、审批与回答回到对应操作位置

2026-10-15。M10/M12；上一轮真实网络/DNS修复为进展，Goal仍ACTIVE/H04 DOING。本片覆盖F07/A18–20，保持唯一Pi、原教师确认及来源/文件版本边界。

## 现状与缺口

事件/SQLite已保存问题、文件和大部分业务核对的runId/callId。OfficeConversation保留正文与工具先后，但PiEducationWorkspace把所有卡拼接到renderApprovals回合尾，后续回复在前、问题/回答在后，无法对应调用。LearningReviewSummary/QuestionCollectionSummary漏投影已有payload.callId；不需新增事实或表。排队补充指令没有callId，属F05/A13另片，不猜位置。

## 修改前冻结范围

1. 新增renderer统一interaction条目与映射器，复用现HeroUI问题/文件/业务核对组件和原回调，不另造审批表单。每卡稳定id、runId、可选callId；只读snapshot。
2. OfficeConversation在相同turn/call之后渲染卡；有卡的调用切开相邻工具组，卡位于原工具之后、下一工具/正文之前，不能藏在折叠组内。原renderApprovals兼容入口保留供旧消费者；生产改用typed interactions。
3. 缺callId/工具记录未包含的旧卡明确放“其他交互记录”，不伪造位置、不丢失入口；跨回合callId不能串锚。原队列指令保留原状态/编辑/撤回，不宣称本片完成其定位。
4. 原题批量核对保留一组来源/导航，不拆散业务组；有多个真实callId时将聚合卡锚到该回合最后一个成员调用，明确是聚合结果，不从模型文本猜位置。
5. 仅从原已存payload补learning/collection的可选callId公共投影，typed preload自然承载；无新IPC/DDL/迁移/依赖/AgentLoop。原v1无字段记录兼容。仅更改对应summary行，不触碰并行教育逻辑。

目标文件：OfficeConversation/PiEducationWorkspace/office-process，新增OfficeInteractions/PiInteractionCards；shared learning-review/question-collection可选字段及原repository摘要；专项renderer/实际Pi测试。先保存现脏文件字节/hash，精确差量，不覆盖其他领域。遇到目标行并行变化先重读，不整文件回退。

## 完成定义

- 有意义的renderer反例：同轮两问题/两回答位置、审批夹在工具和回复之间、工具组分割、卡只出现一次、跨run/未知锚回退、旧renderApprovals兼容、批量核对不拆、原队列入口保留。
- 正式Electron、真实DeepSeek：两次ask_teacher分别回答；实际文件复制批准/拒绝，批准一次物理文件、拒绝零写；待答刷新/切会话及冷恢复、重复/跨会话提交拒绝、旧批准不自动执行。SQLite/native/文件读回与UI位置一致，至少1366浅/1920暗截图实际查看。
- domain metadata摘要读回、type、原配置隔离构建、renderer组件、原smoke与专项，git diff --check。首次失败及修复重测保留，构建不可变；共享out/其他源码并行更新不冒用旧结果。

回滚只撤本片renderer与可选摘要字段差量，卡可恢复原尾部显示，已提交事实/journal/文件/批准记录不删除、不自动重放。无真实学生图外发、系统网络/凭证修改、commit/push。未满足项如实列OPEN，整体Goal不因本片关闭。

### 批量原题定位补充（修改前核查）

批量原题的summary.callId是子候选ID，真实SDK调用编号在原payload.batch.rootCallId。新增可选OriginalBatchPosition.rootCallId，由original-multi-repository既有合法payload只读投影；不解析hash猜编号，不修改batch数据/摘要/审批规则。聚合卡按本回合最后真实root调用定位，旧无root字段仍明确回退。此项仅增加原repository摘要一处，原流程保持；纳入原题领域边界与新旧摘要测试。

### 首次实际验证与恢复策略核对

旧固定b7构建cAPgAK：真实两次ask_teacher/回答已完成后，位置断言失败（卡统一在回合尾），原报告保留。新固定2df5ce构建j2yCK0前5项真实提问/刷新/切会话/复制拒绝和批准通过，随后测试误把正常退出当可恢复崩溃，canResume断言失败。原安全策略正常退出会明确停止；不为通过测试改生产恢复规则。修正后9jyRZp 8项通过：正常关闭保留已停止问题、实际终结自有隔离Electron进程模拟崩溃后才可显式回答并开启新run，旧拒绝不复活。

旧学习领域夹具缺collections已复现；只在测试中提供不应调用的显式fail-closed依赖，误调用会抛错，未更改生产门禁。原领域98项通过并增加summary/list/view调用身份断言；这不是整套H04所有领域已通过。renderer额外mapper检查因未加载生产virtual:classroom-preview初次失败，随后复用原真实preview构建器，没有伪造组件或修改业务逻辑。图片确认追加使用原公开合成图正式脚本，独立人工先查看原PNG再冻结code/形状gold，学生原图仍未上传。


## 2026-10-15：S1/F07 原位置交互与 BoardUI 复核

M10/M12；Master/Goal ACTIVE，H04 DOING，本片限定接受。问题、回答、复制/文本/产物/教育核对沿原组件及回调，按原runId/callId回到对应工具后、下一段正文前；工具组在卡处切开，未知旧锚明确保留在“其他交互记录”。Learning/Collection只读补已有callId；原题批组补已有rootCallId并仍聚合一组。无新DDL/IPC/依赖/循环或上传授权。

固定2df5ce828d1787ccf6eb3e06944d151b505024ac3675fb285492abb5d9d298e5/368：正式Pi/DeepSeek提问、回答、复制批准/拒绝、刷新/切会话、正常退出/真实自有进程崩溃分开验证，9jyRZp 8/8。原公开合成图Dg1XGd 13/13，独立先查看PNG冻结gold，真实图hash/HTTP200/验证码及形状位置一致；冷恢复原位置YZ2lO3 3/3，包括相同回答幂等、冲突回答拒绝且无新run/native。浅1366/暗1920图已查看。

renderer11、领域98、BoardUI复核8、独立SQLite/native/文件/图/源码manifest读回5、组件217、隔离legacy教育smoke207均通过且exit0已收取；type/原vite配置隔离build exit0。BoardUI6文件原/适配hash均一致，仍由host真实状态和来源驱动。不是模型自评；未把图片送达当成所有识别正确。

首失败cAPgAK与j2yCK0保留：前者复现旧尾部定位，后者是测试误把正常退出当崩溃恢复；生产正常停止规则未放宽。旧学习夹具缺collections只补fail-closed测试依赖；SSR复用实际classroom-preview构建器。收尾production-host出现并行源码漂移，未覆盖；本片证据只对应固定构建，不归到最新main/共享out/安装包。

证据与精确命令：apps/desktop/test-results/goal/feishu-inline-20261015/{progress.json,progress.md,commands.ps1}。原日常IMG/FILE反馈、用户原图、无VPN、全业务卡真实UI/全部H04 golden、完整12路及H05–H10仍OPEN。下一步S2：先核“2”的实际来源，再冻结安全只读12路；F05/A13无callId队列保留原入口，不能猜定位。无commit/push。

A19保留原幂等定义：同一已提交回答返回成功但不再生成模型轮，改变回答拒绝。最终恢复脚本3项真实验证；不能将原草稿“拒绝所有重复”解读成破坏原幂等接口。
