# Pi 任务控制验收

2026-10-02，P04-A/M10/M01，合同 docs/56。完整目标见 docs/35、48；预算/压缩/教育记忆继续 P04-B。

## 现成方案与实际复用

| 来源 | 本项目选择 | 原因与边界 |
|---|---|---|
| Pi exact 0.80.3 AgentSession | 原生 steer/followUp/clearQueue/SessionManager | 与现有唯一模型循环和私有历史一致；不另写模型调度循环 |
| Hana 0.449.0 session-coordinator | 参考其委托 SDK steer、会话 scope/恢复原则，沿用已复制的运行闭包 | 不复制人格、多渠道或默认编码工具；教育身份与审核属于小智 |
| 现有教育宿主/SQLite | 增量控制记录 + main 工具回调 | renderer 只经 typed preload，复用既有脱敏、消息、run 和审批事实 |
| HeroUI Pro MCP / 本地实现 | ChainOfThought、ChatTool、OfficeComposer | MCP 实际查阅两组件文档；Pro 不提供源码，复用已有本地实现/compose/styles/BEM CSS |
| finesse 固定参考 | 计划/实时过程/队列回执同屏、固定输入停止、真实状态 | 采用 docs/40 固定 commit，停止仍以宿主确认为准，不采用示例提前宣称 stopped |

ChainOfThought 的 tsx/styles/index 与本地 Pro 原源 hash 一致，清单见 renderer/heroui-pro/README.md。它显示模型声明的公开任务步骤，不能代表已提交文件或原始隐式推理。本轮没有新增依赖；MIT Pi、Apache Hana、既有 Pro 再分发许可门禁保持。

## 实际改变

- 新增 xiaozhi_pi_controls（schema_version=1），保存有界 plan/question/instruction，属于宿主运行事实。typed xiaozhi:answer/queue 和事件/快照接正式页面；不通过 IPC 接受 SDK 身份、工具权限或目录。
- update_plan 校验最多8步、至多1步执行中，内容脱敏；公开计划步骤及其真实更新持久化。成功模型回合不会替教师虚构文件交付。
- ask_teacher 给2–3选项与自由回答；持久问题绑定会话/run/call，活跃 callback 等真实回答后 SDK 继续。等待期间暂停该轮活动时间计时；完整 usage/轮次/费用预算仍待 B。
- 已答重复相同内容不再发起任务，跨会话/额外字段/变化内容拒绝。停止释放等待、未执行问题不再接受迟到回答；恢复出的中断问题有明确 canResume 标记，教师主动回答后用固定命令身份启动新 run，旧审批/效果不自动重放。
- 运行中“补充本轮”为原生 steer，当前工具返回后、下次模型调用前送达；“接着处理”为原生 followUp，当前任务收尾后处理。持久请求 hash/身份防重，SDK message_start 实际消费后记 applied，停止/崩溃未送达项 interrupted。按同 run 有界16项，不声称已实现单条撤回/队列编辑。
- 私有原快照首先验证原模型/目录/prompt/tool fingerprint，再追加 xiaozhi.education.controls.v1 控制升级记录。旧 JSONL 不重写；升级后禁止静默降级、换范围。模型与工具循环仍由 Pi SDK 管。
- 计划、澄清卡、队列回执在正式消息工作区；问题等待正文/工具/右卡统一“等待补充”，发送追加清空输入，停止固定可达。未展示私有 SDK history、原始推理或凭证。
- SDK真实助手message_start/message_end生成公开段落边界，每段正文/工具前后说明独立保留。收尾只更新最后助手段，followUp不会覆盖前一段；逐段与SDK历史text块对照，不读取thinking块作为界面内容。

## 实例与门禁

以下在 apps/desktop 执行；报告位于忽略的 test-results/xiaozhi-agent，合成教师提示与明确隔离数据副本。

| 检查 | 精确命令 | 结果 |
|---|---|---|
| 构建 | npm run test:xiaozhi-pi-controls 的 build | exit 0，pi-control-segments-gate.log |
| 正式控制/真实 DeepSeek + 旧 SDK 副本 | npm run test:xiaozhi-pi-controls -- test-results/xiaozhi-agent/pi-approval-ui-8u29pJ/data | exit 0，18/18，pi-control-ui-5bucLj/report.json；pi-control-segments-gate.log |
| P03 受影响正式审批路径 | npm run test:xiaozhi-pi-approvals | exit 0，22/22，pi-approval-ui-y7J9sD/report.json |
| 新旧表/恢复/未来版本 | node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-approval-ui-8u29pJ/data/app.db | exit 0，7/7，pi-state-migration-30fOyj/report.json |
| renderer 状态 | npm run test:renderer-components | exit 0，79/79，pi-control-renderer-segments.log |
| build + 旧教育主路径 | npm run test:smoke | 分段修复后 pi-control-legacy-segments.log exit 0、ok=true、207/207 |
| 空白检查 | git diff --check | 文档收尾后 exit 0；仅 LF/CRLF 提示，无空白错误 |

控制验收包含真实计划/提问、双视口、跨会话/额外字段拒绝、可见 steer/followUp、同命令防重/模式冲突、实际 SDK 消费及每条恰一个 user entry、回答后继续、重复/并发相同回答无新 run、20并发追加只有16项接收、实际重启、停止/迟到拒绝、真实结束隔离 Electron PID 树、保留问题/不重放队列、教师自由回答主动开启新 run、自然教师提示不含工具名、旧 SDK 副本升级前缀/身份保留。原生对话之外的测试没有伪造 provider 历史。最终专项无失败/skip，各组存在重叠，不累加成独立用例数。

1366×768 和1920×1080截图已查看，提问动作/输入/停止可达。基础字体、按钮、窄轨道、侧栏与右卡仍非 Codex 一比一；初次模型阶段说明出现英文，最终实例为中文，不能将一次中文输出说成所有模型回合都保证中文。P06 仍需状态和视觉整体验收。

## 保留的失败

- 初版 build：SessionEntry data 未缩窄、Pro Step children 缺少；改类型判定/真实 slots 后通过。
- 首次控制 gate 的脚本 async 默认参数包含 await，Node 语法拒绝、没有实际执行验收；修正后真实13/13，最终加强旧 SDK 副本与每条队列消费后14/14。
- P03 复验 pi-approval-ui-1tzsdr：前18项通过，随后真实 DeepSeek transport 失败，SQLite run.failed/error_message 及助手记录一致，尚未进入审批；报告保留。重新完整实测 y7J9sD 22/22；没有修改 OS 网络或将失败隐藏为通过。
- 提问等待最初工具行显示执行中，现用 callId 投影 waiting_input，正文/右卡同步。崩溃问题与主动停止问题必须分别标记，否则迟到回答可能错误开启新运行。
- 收尾并发检查修正两处边界：重复回答 CAS 失败后重新读已提交答案并一致回执；队列上限在 live owner 中先预留再异步持久化，20并发请求实际只接收16项，不能只靠 SQL count 后写入。
- 收尾分段检查修正仅靠tool事件断段的缺口：连续助手回复可能合并，terminal的最后回复替换会覆盖前文。新增真实SDK消息边界，18项最终专项逐段对照全部非空assistant text块相等；不以关键词出现代替完整性证明。

## 下一步第一项

P04-B 先冻结预算/压缩/教育记忆合同：复用 SDK 原生 compact/usage/SessionManager 和 Hana 协调机制，接已有 L1/L2/L3 的授权作用域，不创建第二记忆真源；显示真实使用量/未知费用，等待输入/审批预算明确，压缩保留来源、计划、确认和文件版本。补齐队列撤回/编辑、预算耗尽与重启控制边界后再验收完整 P04。

随后 P05 教育 Skills、P06 一比一界面/模型设置、P07 完整办公联网、P08 实际无 VPN/旧数据/安装和总实例。完整目标保持，未将本切片等同全部 Harness。回退 OMNI_EDU_XIAOZHI_PI=0，旧数据保留；无 commit/push/系统配置变更或子 Agent。
