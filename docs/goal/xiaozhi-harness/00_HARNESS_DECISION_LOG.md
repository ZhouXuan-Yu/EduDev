# 00 — XiaoZhi Harness 决策记录

**状态：** 设计基线（不是实施完成声明）
**范围：** EduDev / XiaoZhi Agent Harness
**维护规则：** 已确认决策不得在实施中悄悄改变；若源码或安全验证证明不可行，必须提出变更提案，记录影响并等待产品负责人确认。

## 一、已确认决策 H-01 至 H-31

| ID | 领域 | 已确认决策 |
|---|---|---|
| H-01 | Runtime | Pi SDK 是唯一主 Agent Runtime / Agent Loop，不引入第二个 Orchestrator。 |
| H-02 | 自主性 | 小智采用高度自主设计，主动解决能力缺口，不把缺少工具直接当作最终失败。 |
| H-03 | Skill | 纯说明型 Skill 可由 AI 自动创建、验证并发布到个人技能库。 |
| H-04 | 风险 | 可执行代码、外部连接、凭据、权限扩张和高风险操作走独立安全策略/审批。 |
| H-05 | 归属 | Skill 分个人、团队、官方三层。 |
| H-06 | 默认归属 | 新创建 Skill 默认个人私有。 |
| H-07 | 分享 | 分享产生独立副本/版本，不让个人与团队原件互相覆盖。 |
| H-08 | 官方库 | 官方 Skill 必须经正式审核发布。 |
| H-09 | 版本 | Skill 版本不可变，支持升级、撤回和回滚。 |
| H-10 | 权限 | Skill 只能声明依赖，不能授予自己权限。执行权限由宿主 Permission Engine 决定。 |
| H-11 | 能力模型 | 建立统一 Capability Registry。 |
| H-12 | Runtime | 所有 Agent 推理与编排继续使用统一 Pi Runtime。 |
| H-13 | 市场 | 外部市场聚合 + EduDev 自有市场。外部负责发现，自有层负责筛选、验证、收藏、版本和治理。 |
| H-14 | 安装 | 来源、许可证、依赖和权限符合策略的可信能力可按用户模式自动安装；未知来源需审批。 |
| H-15 | 完全授权 | 在用户明确授予的广泛工作目录、命令、网络、依赖、MCP 和文件权限范围内自主执行，不重复询问已覆盖的常规操作。授权外操作仍受限。 |
| H-16 | 规划 | 混合规划：根据任务复杂度动态决定规划深度；简单任务快速执行，复杂任务预规划，执行中可重新规划。 |
| H-17 | ID | EduDev 定义核心 Capability ID；外部允许使用独立命名空间扩展。外部 Provider 可映射到已验证的核心能力。 |
| H-18 | Provider | 一个 Capability 可有多个 Provider，由 Resolver 自动选择；高级设置允许用户固定偏好。 |
| H-19 | Registry 同步 | 本地 Registry 是运行时事实来源；官方目录同步并支持离线缓存。云端目录不得覆盖本地授权和实际运行状态。 |
| H-20 | 部分实现 | 允许 Provider 部分符合 Capability Contract，但必须披露缺口；Required 缺失不得通过评分放行，Optional/Conditional 按任务判断。 |
| H-21 | Provider 切换 | 当前任务内可切换兼容 Provider；评估后再决定是否改变长期默认。一次故障不直接改变默认。 |
| H-22 | Resolver 决策 | 确定性规则负责权限、来源、兼容性等硬约束；AI 只在合格候选中参与语义适用性判断。 |
| H-23 | Pi 接入 | 混合模式：核心业务保留明确 Tool；动态外部能力使用 Dispatcher；共享 Registry 和执行边界。 |
| H-24 | 持久化 | SQLite 是任务状态事实来源；Pi Session JSONL 保存对话历史。两者通过稳定 ID 关联，不互相替代。 |
| H-25 | 长期挂起 | 应用关闭后保留未完成任务，重新打开后可继续。 |
| H-26 | 检查点 | 阶段检查点 + 每次有副作用的工具执行记录；普通流式输出仍由现有 Event Journal 处理。 |
| H-27 | 恢复 Provider | 先核验旧 Provider；不可用时由 Resolver 选择满足剩余任务要求的兼容 Provider。 |
| H-28 | 启动恢复 | 应用重开后自动恢复任务状态和诊断，在工作台展示继续入口；教师点击后才启动新的执行 Run。 |
| H-29 | 审批持久化 | 审批记录持久化；重开后继续等待处理；授权条件变化时相关审批失效。 |
| H-30 | 启动诊断 | 允许自动执行安全只读诊断，不自动产生副作用。 |
| H-31 | 拒绝授权 | 自动寻找替代方案，继续可完成步骤；不重复申请相同权限，除非任务实质变化、出现更低风险方案或教师主动要求。 |

## 二、不可变架构原则

1. Pi 是唯一 Agent Loop。Autonomy、Resolver、Recovery 都是 Harness 服务，不是第二个 Agent Runtime。
2. Capability（逻辑能力）、Provider（实现）、Skill（操作知识）、Tool（执行接口）、MCP（外部协议接入）、Extension（Runtime 扩展）、Environment（依赖/配置）必须区分。
3. 市场发现结果不是已安装能力；已安装不是已验证；已验证不是已授权；已授权也不代表每次调用免除实时撤销检查。
4. Permission Engine 是权限唯一权威。Skill、Manifest、MCP annotations 和 AI 决策均不能自行授予权限。
5. SQLite 是 Task / Run / Step / Checkpoint / Approval / Effect 的事实来源；JSONL 是 Pi 对话历史。
6. 有副作用的操作必须先持久化执行意图，执行后记录实际结果；超时不代表未执行。
7. Provider 切换必须满足任务剩余要求、权限和兼容性；不允许用不等价能力静默降级。
8. 本地优先。核心教育能力不能依赖外部 MCP 才能工作。
9. 优先复用现有 Task State、Event Journal、MCP Runtime、Skill Runtime、Execution Boundary 和 Artifact State，不造平行系统。
10. 任何实施结论必须有源码和测试证据；不能把计划、静态推断或模型自评当成验收。

## 三、变更决策流程

若发现决策与当前锁定 SDK、操作系统或安全模型冲突：

1. 标记 `DECISION_CONFLICT`，暂停相关实施。
2. 提供当前源码/类型定义/测试证据。
3. 提出最小变更方案、用户体验影响、安全影响和迁移方案。
4. 由产品负责人确认后更新本文件及关联协议。
5. 不得由实施 Agent 自行重写已确认决策。

## 四、状态标签

- `CONFIRMED`：用户已确认。
- `PROPOSED`：设计建议，尚未确认。
- `SOURCE_VERIFIED`：已由当前 HEAD 源码证实。
- `NEEDS_VALIDATION`：需要运行测试或补充调用链证据。
- `IMPLEMENTED`：已实施，不等于验收通过。
- `ACCEPTED`：独立验收通过。
