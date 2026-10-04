# Pi 任务控制交付合同

2026-10-02，P04-A，M10/M01。用户完整目标仍见 docs/35、48；本切片交付真实计划、澄清和运行中追加，P04-B 预算/压缩/教育记忆继续待建设，不把 A 标成全部 P04。

## 现状与来源

P03 正式页面已支持正文分段、教育知识、目录授权与持久审批，docs/55 实测通过。当前运行中输入不可提交，计划仅有公共组件占位，缺模型可调用的计划/澄清工具。Pi exact 0.80.3 AgentSession 原生 steer/followUp/sendUserMessage/clearQueue；Hana session-coordinator 的 steer 委托 SDK。使用 SDK 唯一循环，不新增第二模型调度循环。

Pro MCP 已实际查阅 chain-of-thought、chat-tool 文档；复用现有本地 Pro 源码/依赖和 OfficeComposer。finesse 设计基准按 docs/40–42；本轮功能不称视觉一比一完成。项目/Hana 图未覆盖这些新函数，bounded 当前源码为补充事实。

## 本轮修改

- 增量版本化 xiaozhi_pi_controls 表，保存计划/问题/追加指令的会话/run/调用身份与有界公开内容。现有命令/消息/run/events 保留；init/recover 幂等，未知版本拒绝。
- SDK customTools 加 update_plan / ask_teacher，主进程验证参数、脱敏、持久化与回传。计划是模型声明的步骤进度，不代替文件或业务 readback。澄清支持 2–3 建议选项和自由输入，等待真实用户回答后 SDK 继续，取消零业务效果。
- 计划与问题用 typed 公共事件/快照接正式 UI。问题等待显示 waiting_input；停止解除等待，迟到回答拒绝。重启保留中断问题，可由教师主动回答发起新 run，不能自动重放旧工具/旧审批。
- 按 SDK 真实助手 message_start/message_end 投影分段，逐段保存公开正文；followUp 的新回复不能并入/覆盖前一段。对照私有历史的公开文本块验收，不将隐式推理广播给界面。
- 运行中追加通过原生 SDK steer/followUp：前者当前工具完成后送达、后者当前模型任务收尾后送达。只在当前运行且 SDK ready 时接受，持久身份/内容 hash 防重、实际 message_start 后标已送达；停止/崩溃未送达项中断且不自动重发。
- 与旧私有 SDK 快照兼容：校验原目录/model/tool/prompt fingerprint，再记录版本化控制能力升级；旧历史原样保留，升级后不能静默降级或换模型/范围。
- renderer 不直连 SDK、文件或数据库；主进程/typed preload 单一 authority。只公开任务摘要，不暴露隐式推理、凭证或私有目录。

## 门禁与完成定义

真实 DeepSeek 正式 Electron：计划更新/重启，澄清建议与自由回答、重复/跨会话/迟到拒绝、停止、等待强制退出后主动回答新 run；工具等待时 steer/followUp 排队、实际消费/无重复、停止后不重放。1366/1920 可操作、发送接受清空、SQLite/SDK readback一致。旧 schema 副本+新建库幂等。

构建、renderer-components、控制专项、P03 受影响路径、必要 test:smoke、git diff --check；精确命令与报告落 docs/57，四文档/任务台账同步。无新依赖/系统配置/真实教师数据迁移，无提交/push。失败保留报告并修复复验，不用 fixture 代替实际 provider。

下一项 P04-B：SDK budget/usage、待输入/审批等待预算、压缩与现有教育 L1/L2/L3 作用域和来源/版本/审批保留，之后 P05–P08 仍完整执行。
