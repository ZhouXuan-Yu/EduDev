# DeepTutor × Omni-Edu 集成边界

版本：v2.0  
日期：2026-09-16  
状态：DeepTutor 唯一权威参考；从属于产品与小智方案

## 1. 结论

DeepTutor 是可复用的 Agent/Capability 执行内核，不是 Omni-Edu 的第二套产品、数据层或权限系统。只复用能直接增强资料处理、深度解题、受控出题、研究、讲义和恢复能力的内核；不追求迁移其全部功能清单。

产品优先级以 `11_STRATEGIC_PRODUCT_PRD.md` 为准，小智契约以 `22_XIAOZHI_EDU_AI_HARNESS_PLAN.md` 为准。DeepTutor 不得反向扩大默认导航或产品边界。

## 2. 固定基线与许可证

当前 vendor 位于 `python/vendor/deeptutor`。上游版本必须固定 commit，保留 Apache-2.0 LICENSE、适用的 THIRD_PARTY_NOTICES 和修改说明；运行时不得依赖开发机上的 `D:\WorkProject\DeepTutor`。

vendor 文件尽量保持可追踪；Omni 适配写在 bridge、adapter、host proxy 或 capability profile。必须修改 vendor 时使用明确 patch 清单和上游差异测试。

## 3. 可复用能力

优先复用：

- AgentLoop 的多轮执行、预算和终止机制。
- Capability/Registry 抽象和流式事件协议。
- 暂停输入、checkpoint、恢复和 lineage 思想。
- 深度解题、受控出题、来源研究、讲义编排等可证明有业务收益的 capability。
- notebook/book 的逐块持久化、版本、来源 fingerprint 和漂移定位思想。

暂不复用或默认关闭：通用平台账号体系、第二套文件/数据库、开放式代码执行、无限 MCP/技能市场、未经宿主审核的外部工具、面向学生的自治辅导流程，以及与两条核心闭环无直接关系的能力。

## 4. 宿主与 sidecar 边界

Electron main 是唯一控制面，持有业务数据库、文件权限、provider 凭据、工具审核、确认、审计和最终状态。Python sidecar 只能：

- 接收版本化、bounded、已脱敏的 capability request。
- 运行允许的 AgentLoop/Capability。
- 向 HostToolProxy 发起结构化工具请求。
- 返回受限事件和结构化候选结果。

sidecar 不能直接读取 Omni SQLite、学生目录、原始附件、API Key；不能写业务表或正式文件；不能直接执行 shell、网络或用户数据修改。

## 5. 协议

请求至少包含 schemaVersion、requestId/runId、capability、route、最小 context、budget、allowedTools、privacyPolicy 和 resume/checkpoint 信息。事件至少包含 sequence、phase、public summary、tool/source/budget/termination 元数据。

sidecar sequence 仅用于诊断；宿主以 turn 级串行队列和自己的审计序列入库。事件入库前经过长度限制、字段白名单和脱敏。`THINKING` 或模型草稿不能原样显示/持久化，只转换为可验证阶段摘要。

## 6. 工具与模型代理

DeepTutor 的 native `tool_calls` 只有在上游真实解析、dispatcher 发起、HostToolProxy 审核、工具执行并写入 observation 后才算真实工具调用。fixture/auto 模式只能标记为测试。

ModelProxy 由 Electron main 持有 provider 凭据，sidecar 发送 bounded request；超时、断线、缺凭据和 provider 异常必须结算 failed/blocked，不能继续发送 succeeded。每一轮工具调用都重新经过 route、context、effect、privacy 和预算审核。

## 7. 暂停、恢复与终止

等待教师输入时写持久 checkpoint；重启后由 typed preload 回读，教师答案由 main 原子 claim。若不能恢复同一 Python Promise，创建带 `parent_run_id` 的恢复 run，并明确结算旧 run，不能伪装为进程内连续执行。

所有 loop 有最大轮数、工具次数、token、事件、wall-clock 和输出大小。预算耗尽写入 guardrail，要求收敛或失败。sidecar 断线、协议错序、无 heartbeat 和取消均有明确恢复或终止策略。

## 8. 数据与写入

DeepTutor 只能返回草稿、建议、证据和 HostTool 请求。正式题库、题组、试卷、学生结论、记忆和文档落盘走 Omni 的 confirmation/业务服务。Mastery/记忆等推断必须可审查、可禁用、可删除，不显示伪精确百分比。

讲义/Book 正文采用 Omni SQLite 结构化实体和版本，不复制上游文件存储。page/block 重生成携带 version，只重建受 source fingerprint 漂移影响的部分。

## 9. 安全

- capability 到 route 映射和 allowedTools 是硬限制。
- 可视化不执行模型生成代码；只接受安全声明式图表数据。
- research 的 dry-run、来源标题拼接或 Mermaid 字符串不等于联网研究或已核验引用。
- stderr、事件和 tool result 有界脱敏；不得泄露本地路径、学生信息、密钥或 hidden reasoning。
- Python 依赖、模型和上游更新都做供应链锁定与许可证审查。

## 10. 测试与完成定义

按能力至少验证：协议/schema、route/permission、真实上游 AgentLoop、工具审核、错误分类、预算终止、checkpoint/restart、SQLite 事件、renderer 状态和 Electron E2E。真实 provider 与性能单独 live gate。

模块只有在可运行代码、配置/打包、失败恢复、安全证据、前端用户路径、readback 和文档都满足时才算完成。handshake enabled、首个进度事件、mock、skipped live 或快速返回都不能证明生产完成。

当前各子域的窄契约保存在 `config/deeptutor/*.md`；它们只约束对应模块，不得覆盖本文件的宿主边界或产品优先级。

## 11. 变更规则

新增 capability 前必须说明它服务于哪条核心闭环、需要哪些上下文和权限、失败如何恢复、前端在哪里确认、如何 E2E。若只增加技术展示或扩大维护面，默认不接入。上游升级先做差异清单和兼容测试，禁止直接覆盖 vendor。
