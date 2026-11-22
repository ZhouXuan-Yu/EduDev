# 小智 D2-A 智能 Resolver

本轮从 `38a2a42` 开始，D1 独立结论为有条件通过。生产路由继续由 D1 决定。D2-A 沿真实计划与执行结果采集独立影子建议、证据和差异，供后续上线判断。

| 路径 | 职责 |
| --- | --- |
| `tasks/planning-runtime.ts` 和 `capabilities/intelligence/replan.ts` | 保留结构化请求、计划/要求版本和快照，反馈能力缺口。同一要求版本最多三个不同缺口，同一缺口只给一次反馈。模块之间的依赖保存在已有计划引用中，拒绝循环、自引用和未声明能力。 |
| `capabilities/intelligence/evidence.ts`、`selection.ts` | EWMA 平滑延迟，Wilson 下限比较小样本成功率，Pareto 保留非支配候选。有证据的明显优势、确定偏好、单候选和经复核的缓存均走确定性路径。 |
| `capabilities/intelligence/health.ts` 和 `capabilities/adapters/` | 宿主授权后的执行结果按 Adapter、实例、配对记账。质量与运行故障分开。Cockatiel 管理熔断计数，重启冷读保存的状态。 |
| `capabilities/intelligence/shadow.ts`、`decisions/deepseek-shadow.ts` | 在 D1 候选上复核当前制品、Binding、Adapter 状态与开发者策略。保存建议、排除原因、样本、时延及快照引用。只在显式 `shadow-ai` 时对有证据且存在取舍的候选使用有界排序。 |
| `capabilities/intelligence/switch.ts` | 显式切换遵循原 Task Checkpoint 和 Effect Journal。已经发生或未知的写入/外部效果阻止换路重放。沿原快照建立关系。 |

专项 Electron 回归初次采到 16 条影子决策，15 条有关联的快照，13 条可比较的选择均与 D1 相同。没有额外排序模型调用。背景记录 P50 59.31 ms，P95 94.39 ms。离线单候选复跑 500 次，P50 0.0009 ms，P95 0.0034 ms。合成库三次健康记账 P50 3.52 ms，P95 3.60 ms。测量范围为同机同次脚本所覆盖的代码。

开关和 SQLite 迁移见 [D2 架构](../../architecture/HARNESS_D2.md)。当前覆盖被动健康恢复、受宿主授权的 Managed MCP 安装探测、显式安全切换与影子建议。Managed MCP 探测分开记录，缺少业务样本时仍标记未知。通用主动探测调度、跨应用重启的重规划记账、有足量教师标注的质量排序和新 Resolver 的生产切流属于后续验收缺口。关闭影子观测使用 `OMNI_EDU_D2_RESOLVER=off`。
