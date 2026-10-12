# B · 严格问题审计

分级依据：P0正确性/可靠性/安全结构，P1质量/效率/恢复，P2维护与交互细节。**已证实=源码机制证实；风险=可推导但未复现；假设=需外部/运行证据。** 本轮无用户实例复测，不能写“已修好”。成本S=单域切片，M=多个边界，L=共享协议/迁移；不是工期承诺。

## P0

### P0-01 · 模型停下与回复落盘被当成完成

- **已证实**：`pi-session.ts:816–830`只看最后assistant error/aborted、空文本、预算等；`production-host.ts:519–546`按failure计算completed并记录“小智已完成”。失败tool items仍可落盘，其失败不自动构成failure。
- 影响：关键联网、视觉、文件生成失败后模型给解释，仍可显示本轮完成。不是说任何非关键工具失败都必须整个任务失败，而是无法区分required criterion与可放弃尝试。
- 参考：mu `features/goal.ts:307–340`事实约束优先，但仍含模型判定；ai-agent-book `ResultVerifier.evaluate`以环境结果比对，没预期应uncertain。
- **推荐**：run结束=settled；criterion必须由真实EvidenceRef+VerifierResult支持。required失败/未知 → partial/blocked；教师确认与机器验证分开。聊天文本可正常返回，不授予业务成功。
- 收益/成本：直接消除“说完成”的伪验收，M→L；H02。验收：失败tool+漂亮回复、空criteria、伪证据、过期文件都不能verified；替代工具确实满足标准则可通过。

### P0-02 · 公开事件不是可回放的可靠执行记录

- **已证实**：host.publicEvent:162–168更新内存后emit；535–543在finally集中保存工具摘要和publicItems。已有领域表/原生session持久化，不代表完整public timeline持久化。
- 前端117–145过滤旧序号，但缺检测missing sequence与getEvents(afterCursor)补拉。active Map能给活着的进程快照，死进程的内存不能恢复。
- **风险**：崩溃发生在工具完成与终态之间，公开过程可能缺失或与native/domain状态不同；具体窗口必须注入切断验收。
- 参考：OpenMAIC runner.runSession的ordered enqueue/required entry write/attempt fence、appendRunEvent；完整Postgres runner不移植。
- **推荐**：SQLite事件journal+投影revision+outbox；状态和事实引用同事务，durable后推送；文本delta合并、非权限事实。native session与ledger通过run/nativeEntryId对账。
- 收益/成本：冷恢复、窗口切换与实时一致，L；H03。验收：event gap/reorder/duplicate/main crash/DB写失败/页面重连，重放不重复执行副作用、不新增授权。

### P0-03 · 生产缺可独立配置的无进展/失控保护

- **已证实**：sessionConfiguration返回limitsEnforced:false；runtime-budget关闭总active/wait/model/tool限额。Goal.boundary文字、summary、nextStep、工具标签hash，仅完全相同才repeats递增。
- **风险**：同效果下换措辞可持续续跑；未证明已造成失控账单。局部网络/Worker超时仍存在，不能称所有工具无限等待。
- 参考：mu goal idle/stall/maxContinuations/maxMinutes；DeepTutor探索预算+最多3settlement+forced finish。其强制给回答不能等同完成。
- **推荐**：保留“不优先token节省”，另设操作安全策略：相同input/version/effect三次无新证据→blocked；读retry有上限，审批等待可暂停而非付费空转；暂停保留产物，不编造成功。threshold为下一轮实验参数，不固定抄mu。
- 收益/成本：可停止、可解释、可恢复，M；H04/H05。验收：变换文本不变证据、不断改plan、反复403/401、重试timeout、教师暂停均有确定终态。

## P1

| ID / 事实等级 | 当前实现 → 缺陷与影响 | 参考 → 推荐 | 收益/成本/验收 |
| --- | --- | --- | --- |
| P1-01 已证实 | `control-tools:update_plan`文本和status，无stepId/依赖/历史原因；`Goal.criteria:string[]`。模型变更计划不能与实际执行对账 | mu frame immutable/version/source；引入Goal→Task→Step、PlanRevision，model只能提议，宿主校验依赖、保留变更原因/证据 | 可追踪可恢复，L，H05；环、重复ID、goal已变更的迟到判定拒绝 |
| P1-02 已证实/风险 | SDK retry=false，classifyError正则；网络有retryable，但通用工具typed failure/effect状态缺统一。需要用户重发，可能重复已完成操作 | OpenMAIC timeout与integrity；统一错误码、bounded retry、effect unknown reconcile。并非强制重试所有失败 | M，H04；401/permission无重试、429尊重Retry-After、写入timeout只核验不重放 |
| P1-03 已证实/风险 | 本地全历史查/重建，UI全turn渲染；每轮重插事实索引。没有本轮性能数据 | DeepTutor branch watermarks、mu admission保留原文指针；native压缩继续用Pi，新增按Task选择+分页+哈希增量 | M，H06/H09；1000历史/长tool output实测p95、目标/授权/来源不丢 |
| P1-04 已证实/风险 | `model-capabilities:17–25`强制models返回context_window/max_output_tokens；image只信input_modalities；该目录是模型清单/能力和credential验证共用前置 | 能力来源分开：official metadata/document/probe，明确unknown；认证、模型存在、能力验证分别返回；不猜1M或偷偷切模型 | M，H06；省略扩展字段不误判无效key，未知视觉阻塞说明可操作。**本轮官方文档请求超时，未证实真实目录字段** |
| P1-05 已证实 | 生产未启用MCP discovery；开发MCP容易被误认为产品能力。工具定义、元数据、权限、UI标签散落pi-session/host各域 | mu registerMcp受信任catalog；使用原生Pi MCP client，统一工具元数据/Effect协议，不创建新AgentLoop | M，H07；新增测试server按hash授权，工具schema变更再次确认，敏感env不流出 |
| P1-06 已证实/风险 | Goal evidence仅label三元组，最终教师勾criteria；无法绑定网页段落、图payload、文件版本。received≠内容识别正确 | book三层Verifier；EvidenceStore索引真实来源+哈希+版本，规则验证与开放质量judge隔离 | L，H02/H08；临时观察不升长期FACT，student事实修改只按原教师门禁 |
| P1-07 已证实/风险 | 多域有独立abort/timeout，但Pi注册所有tools后没有统一wrapper，默认SDK parallel；安全调度元数据不统一 | OpenMAIC withAgentToolTimeout；读并发按资源，写操作按目录/实体锁，迟到回执fence，无法取消的外部效果unknown | M，H04；工具忽略signal也不能更新新attempt，cancel不冒充回滚 |
| P1-08 已证实 | OfficeToolProcess有真实工具状态，但无verification/attempt/恢复轨迹；RunNotice完成时隐藏，也不表示验收范围 | 当前ChatTool继续复用，Timeline/Disclosure/结果证据区；状态来自ledger，completed比例只数已验证steps | M，H09；失败tool+partial任务一致显示，刷新/窄屏/键盘可达 |

## P2

| ID | 依据 → 改进 | 成本与验收 |
| --- | --- | --- |
| P2-01 已证实 | host与pi-session组合大量领域factory/硬编码tool名称，职责粘连；按tool provider、context、lifecycle、projection adapter抽取，不把db/App再做大段堆叠 | M，H04–H06；旧接口contract golden保持，同一tools没有两个executor |
| P2-02 已证实 | OfficeToolProcess以中文label正则选图标，以attention key重挂折叠；不是可靠tool taxonomy，可能丢用户展开选择 | S，H09；type/icon元数据映射，展开状态按event/attempt ID保存 |
| P2-03 已证实 | stable docs大量重复prepend状态，存在不同本地reference可用性表述 | S；本轮统一审计索引+evidence manifest；更新状态只指针，历史不删除 |
| P2-04 待验证 | UI长文本每delta复制items/全turn渲染可能掉帧；目前没有本轮benchmark | M，H09；先测丢帧/commit/IPC峰值，再决定虚拟化与batch，目标不是盲加库 |

## 不能冒充已发现的故障

- 网络当前真实无VPN失败、识别内容错、provider capability目录schema实际变化：需同日常环境/旧会话/相同素材复测。当前风险审计不关闭用户报错。
- 原生history有防污染/压缩；没有证明所有学生数据自动上云，也没有证明整库无差别长期记忆写入。
- 旧Codex/LangGraph代码存在，但生产authority门禁已落实；不能报告“多个生产编排器同时运行”而缺调用证据。
- 参考项目测试未执行；其代码可移植性不是“成熟可直接上线”的证明。
