# 小智 Harness D2 实施边界

基线为 GitHub `main` 的 `38a2a42`。D1 独立审查仍为 CONDITIONAL PASS。本轮依据用户提供的 D2 改造说明、验收标准和 GOAL 任务书。

## 基线与切片

- D1 Resolver 已按合同、来源、平台、授权、依赖和符合性过滤，并保留任务 Provider Snapshot。原排序依靠声明优先级。D2-A 消费同一合格集合和原任务计划，补可信证据评分、有限缺口反馈、健康、决策记录和影子对比。生产选择继续归 D1，未过影子验收前保持回退路径。
- Pi 1.0.2 已提供原生工具批次安全切分、独立手动/自动入口、JSONL 追加和每轮重建当前权威事实。D2-B 统一这几个入口的压缩租约、候选校验和版本、可检索历史及请求缓存计量。SQLite 保留任务和副作用真源，Pi JSONL 保留原始历史。
- 开发者策略、原权限检查、任务/运行归属和副作用记录保持原宿主核验。新的健康、评分和压缩记录仅为派生事实。新增存储可增量初始化，关闭影子或压缩入口可回到原策略，历史回退继续使用原备份与任务快照机制。
- 验收应分别证明 A、B。比较离线排序、耗时、影子差异、真实生产 Tool 路径、压缩前后预算、重启和失败回退。正式数据和模型证据与本机合成证据单列。以用户指定检查表及 6.1 Terra High 独立模拟验收确认结果。

## 装配与持久化

`capabilities/intelligence/` 消费 D1 Resolver 确定性过滤后的结果，观察 Adapter、Provider Instance、Binding 的健康度，保存有来源的评分和建议。`tasks/planning-runtime.ts` 仍创建任务能力快照，发布上限内的补齐建议，并在显式切换前核对检查点和副作用。能力依赖拒绝循环和未声明引用，复用原计划的依赖引用字段持久化，旧读取器继续兼容。Managed MCP 已获宿主授权的本地合成探测写入独立统计，每个范围 30 秒只采一条，不进入业务成功率。`decisions/deepseek-shadow.ts` 复用已配置的模型路由，默认没有额外选择请求。影子组件没有 Adapter 执行句柄。

SQLite 首次观察时以 `CREATE TABLE IF NOT EXISTS` 增量生成 `xiaozhi_d2_resolver_decisions_v1` 和 `xiaozhi_d2_provider_health_v1`。观察表保留最新 512 条，健康场景最多 1,024 个，每场景保留最近 64 条且只计算一小时内数据。内容哈希用于冷读验证。旧版本忽略新增表，保留 D1 业务事实和历史快照。Pi `compaction.details.xiaozhiContext` 使用原生可选字段保存版本、保护引用、压缩区间和前一摘要 ID。同一 Session 原始 JSONL 记录保持可读。

`context/` 在已有 Session 租约下为手动、自动和模型请求前压缩提供同一事务边界。P0 从原 SQLite 读取任务、检查点、教师修订、审批及副作用的实际版本。P1 保留步骤与原历史区间引用。P2 的教师原始讨论可经已有 `read_teacher_request` 查询脱敏关键字，凭来源版本继续读取。已有 `read_session_process` 提供同会话有界的安全过程。P3 本轮保留原记录，沿原投影过滤不可交付内容。摘要只影响模型上下文，正式事实在原业务入口核对。有进行中和尚未核实的副作用时拒绝整理。

## 上游取舍

- Pi SDK 当前锁定 `@earendil-works/pi-coding-agent@1.0.2`，沿用 `session_before_compact`、原生候选生成、追加 CompactionEntry 和原投影恢复路径。
- `billion-context-pi@0.1.83` npm 源包 SHA-256 为 `2b8185233a5c882fdf07e3c3068a499371c7ac79bd630dec42b4a796f8ec30d2`。MIT，Node ≥20。源码向 Pi 注册自动压缩与上下文 hook，开发配套 Pi `0.83.0` 和 `acp-kernel@0.0.98`。与现有 Pi 1.0.2 的工具批次、ACP 和冷读兼容尚无运行证据。生产仅装配 Pi。 [上游源码与参数](https://github.com/ranxianglei/billion-context-pi/blob/master/CONFIGURATION.md)
- `cockatiel@4.0.0` 为直接依赖，MIT，Node ≥22，Windows 上使用本项目 Node 24 和 Electron 43 验证。它处理熔断状态与退避时间，D2 通过真实调用结果更新健康记录。观察结束后更新健康，执行边界继续由 D1 宿主管理。 [Cockatiel 源码](https://github.com/connor4312/cockatiel)
- DeepSeek 由服务端处理前缀缓存。应用记录实际发送的系统与工具部分的指纹、请求类别、用量和时延。单轮内容继续保存在原历史与受控动态上下文。 [DeepSeek API 前缀缓存](https://api-docs.deepseek.com/guides/kv_cache/)

## 回滚和上线条件

- `OMNI_EDU_D2_RESOLVER=off` 并重启可停用影子计算，`shadow-ai` 只用于显式启用的有界对照。可在测试环境运行 `shadow-ai`，单任务最多一次、候选最多四个、上限 1.2 秒。独立核验真实来源、撤销、权限和安全切换，采集有质量证据的多候选样本及实际尾延迟后，才能讨论按能力启用新选择。当前版本无生产 D2 切换开关。
- `OMNI_EDU_PI_AUTO_COMPACTION=0` 并重启可暂停自动触发。保留历史与上一份 Pi 有效摘要，换版本时先备份原 SQLite 与 JSONL。迁移和恢复保持原来数据目录。
