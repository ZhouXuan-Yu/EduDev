# 小智 D2-B 上下文基础设施

生产入口继续由 Pi 1.0.2 提供。`context/authority.ts` 为原 Pi 压缩建立租约，检查候选、原始历史区间、保护事实和上一个有效摘要，校验后把结果与恢复引用写进同一条原生 CompactionEntry。SQLite 的 Task、Checkpoint、审批和 Effect 仍提供当下事实。

| 路径 | 职责 |
| --- | --- |
| `context/authority.ts`、`task-facts.ts` | 核验同一分支、递增压缩边界和当下真实保护引用。 |
| `context/budget.ts`、`pi-session.ts` | 结合模型窗口、输出预算、增长速度和双阈值决定触发，安全阶段或已有原生溢出路径汇总。手动整理复用同一事务。 |
| `context/model-cache.ts` | 从实际请求校验稳定前缀指纹，保存 Pi SDK 用量字段与输入、输出、命中、未命中和时延。缓存计量失效时继续原回复。 |
| `production-host.ts` | 手动整理无需新建业务 Task，在原生摘要入口保留合法会话记录。MCP 工具权限只绑定有任务的运行。 |
| `request-sources.ts` | 经已有 `read_teacher_request` 按关键字检索脱敏原讨论，再按 `sourceId` 与 `sourceVersion` 分段重读。读取范围受当前会话、隐私过滤与当前运行约束。 |

压缩失败时保留原始历史和上一份有效摘要。当前扩展点仍由 Pi 控制，`billion-context-pi@0.1.83` 源码、许可证和配套版本已核对，工具批次、ACP 和冷启动兼容未通过运行核验，因此保持 Pi 单引擎。教师可在同一会话要求查找旧讨论。上游版本和关闭自动压缩方法见 [D2 架构](../../architecture/HARNESS_D2.md)。

用 8 次真实 DeepSeek 请求比较合成内容布局。动态前缀 4 次平均 1,580 输入 token、0 命中、638.66 ms。稳定前缀 4 次平均 1,577 输入 token、1,056 命中、512.36 ms。输入内容仅合成教学资料。该实验测量同一供应商的两个受控请求布局，真实桌面问答、上下文压缩质量与更长期的命中率需要各自测量。 [DeepSeek 前缀缓存机制](https://api-docs.deepseek.com/guides/kv_cache/)
