# Hana 底层与小智当前实现复核

日期：2026-10-02。响应用户“对齐看下 hanaagent 底层”。本轮为源码复核及执行约束更新，没有新增运行能力；P04-B2 仍未实现。

后续更新（2026-10-03）：本文件保留审计时状态。手动compact见docs/61，自动整理与模型能力已按docs/63–64真实18/18+控制边界7/7，默认策略/手动复验19/19；默认auto开启且要求核验能力，源清单增加Hana每轮接缝共13项hash一致。Skills/联网仍待实施。下文“B2未实现/compact=false/32768注册”不代表最新状态，SDK裸enabled=false不排除宿主的原生自动策略。

## 1. 核对对象与证据

- 主快照：`D:/WorkProject/开源/openhanako`，package 声明 0.449.0，Pi 三个包均 exact 0.80.3；补充 shared 快照为 `openhanako-0.449.0`。本地源码并非可确认 commit 的完整 Git checkout，不称为上游最新版。
- 两个项目图谱状态均 ready；Hana 1344 nodes / 1337 edges，小智 2726 / 6049。但本轮关键符号及限定路径 search_code 返回空，故关键链以明确路径源码复核为据，不伪称完整图谱追踪。
- 读取 Hana `core/session-coordinator.ts`、`core/agent.ts`、`core/skill-manager.ts`、`core/session-compactor.ts`、`lib/pi-sdk/index.ts`、`session-options.ts`、`lib/tools/session-permission-wrapper.ts`、`lib/extensions/compaction-guard-ext.ts`、`lib/memory/memory-search.ts`，并对照小智正式门面、宿主与复用清单。
- SDK/生命周期 6 份和文件/联网 6 份移植清单，源 SHA256 与输出 SHA256 逐项比对 **12/12 一致**。报告：`apps/desktop/test-results/xiaozhi-agent/hana-bottom-layer-source-audit.json`。这是来源完整性检查，不是新的 API、Electron 或用户路径验收。

## 2. Hana 真正的主调用链

```text
Engine 注入模型、技能、工具和事件
  → Agent 提供身份、prompt、工具与记忆
  → SessionCoordinator 冻结会话模型、目录、技能与权限
  → buildTools 生成受控工具
  → lib/pi-sdk/createAgentSession 统一转换和安装 guard
  → Pi AgentSession 执行模型/工具循环
  → 模型 API + SessionManager 本地 JSONL
```

关键源码：`session-coordinator.ts:2088` 冻结 ResourceLoader prompt/skills，`:2124` 组装 tools，`:2154` 调 SDK；`lib/pi-sdk/index.ts:73` 门面调用 rawCreateAgentSession 并安装工具结果和 stream guard。该主链是嵌入式 SDK。门面还导出低层 runAgentLoop 供隔离 side lane，不能据此给小智再建第二主循环。

小智对应：`PiEducationWorkspace → typed xiaozhi:* preload → production-host → createPiXiaozhiSession → Pi SDK → DeepSeek / 经审核教育与文件工具`。主进程掌握凭证、授权和持久 run/审批；renderer 只消费公开状态。Hana 的协调思想适配进现有主进程，不再整仓搬进一个平行 Engine。

## 3. 逐层对齐与差距

| 底层能力 | Hana 源码机制 | 小智当前代码及下一项 |
|---|---|---|
| 模型循环 | Pi AgentSession、三个 Pi 包 0.80.3 | 已使用相同 exact SDK；主链未启动 Codex CLI。SDK 名称中的 coding 不限制注册教育工具 |
| 工具注册 | Tool 对象转换为 customTools，名称 allowlist；execution-once | 已复用 session-options；小智按 run 重建缓存，并增加参数快照/hash 冲突与调用数量限制 |
| 工具结果与流式 | outcome adapter 将明确失败转为 isError；stream guard 过滤异常协议片段 | 已移植且 hash 一致；界面投影公开 text/步骤/工具，不广播私有 thinking |
| 会话与恢复 | SessionManager JSONL；会话 prompt/model/目录/skills 快照；恢复拒绝静默模型 fallback | 已有固定 prompt/model/目录/工具绑定与私有 JSONL；SQLite 保存教师事实、run、审批和公开投影 |
| 文件权限与审批 | session-permission-wrapper 冻结会话、运行权限与参数，执行前复核 | 已有目录授权/来源 hash/CAS/迟到拒绝/重启失效；Hana 内存去重不替代 SQLite 持久提交 |
| 文件工具 | ResourceIO、FileRef 与 metadata | 正式入口提供 read/stat/list/经批准 copy；复制适配加入 COPYFILE_EXCL 和最终取消检查。完整编辑及办公产物待 P07 |
| 计划与交互控制 | 协调层委托原生 steer/followUp；状态与运行分开 | 已接公开计划、澄清和追加队列；编辑撤回及完整教育 scope 待 B3 |
| 长会话压缩 | 原生 compact + 官方 extension hook；缓存前缀保留、历史修复、usage ledger、窗口预算和失败降级 | **正式门面仍 compaction.enabled=false，无 compact IPC/UI**。docs/60 是合同，不是完成证据；下一项 B2 |
| 长期记忆 | Agent FactStore、摘要/ticker、固定记忆工具；memory-search 按会话作用域过滤 | 小智不整套复制人格记忆/梦境逻辑；B3 接已有教育 L1/L2/L3、教师可修正事实与授权 scope，禁止第二教育真源 |
| Skills | SkillManager 发现、来源身份、启用/禁用、workspace 可见性及 SDK ResourceLoader | **当前 getSkills 返回空**。P05 复用可独立 metadata/selection 机制与 SDK 格式，交付教育 Skills；不能因 SDK 有此能力就称小智已有 |
| 联网 | web-reader/search/browser 按权限及服务配置分开 | reader/search 源码已移植；**正式 Pi networkAllowed=false，工具 allowlist 不含联网**。P07 先网页/检索实际国内直连，再按需浏览器；每项分别验收 |
| 设置与模型 | provider/model registry、会话冻结及明确能力 | 当前 DeepSeek 单供应商调试；模型设置/能力目录属于 P06。32768 contextWindow 是现有适配配置，非本轮核验的官方模型容量，不能用它声称已正确自动压缩 |

## 4. 压缩对齐要落实的内容

Hana `lib/extensions/compaction-guard-ext.ts` 使用 `tool_result` 与 `session_before_compact` 官方钩子。它考虑工具结果过大、摘要请求本身能否放入窗口，以及缓存保留与原生摘要的降级。`core/session-compactor.ts:1991` 明确要求压缩 extension 存在，再调用 `session.compact`，因此不能把 Hana 的完整压缩描述为裸调 SDK。

小智先按 docs/60 交付原生手动压缩，再决定是否复用缓存保留扩展的最小依赖闭包；这是一项明确的分阶段差异。必须保留：

1. 同一会话只能有一个运行或压缩 owner；停止须调用 abortCompaction，不能只 abort 普通回复。
2. 模型摘要不成为教师确认事实；计划、来源、审批状态和文件版本从本会话 SQLite 重新读入受保护上下文。摘要不能批准或重放文件效果。
3. 原始 JSONL 和业务记录保留；失败、空摘要、截断及预算耗尽不得悄悄换成成功或有损截断。
4. 压缩请求也记真实 provider usage；现有 assistant message_end 计费不能假设涵盖原生摘要 stream.result。
5. docs/60 的 keepRecentTokens=2048 / reserveTokens=4096 是首个切片候选参数，尚未验收。自动触发前必须核对模型能力/窗口元数据与实际请求大小，包含工具/system prompt/摘要请求，不直接照抄 Hana 大窗口的参数。
6. 真实 Electron 压缩→续问→重启，以及停止/失败/预算/旧 JSONL 兼容实例通过后，才扩大自动压缩范围。

## 5. 教育定制与国内直连

复用 SDK、协调/失败/权限/来源/技能机制；教师资料、知识库、学生脱敏、题目草稿和教师确认沿用本项目。Hana 的人格提示、FactStore/ticker/梦境、多渠道服务及 provider roleplay patch 不原样接入。网页和 SKILL.md 是输入资料，不能扩大工具授权。

Pi 嵌入式调用国内 API 具备实现条件；本轮源码审计没有证明机器关闭 VPN 后可用。核心不得依赖 OpenAI 登录、海外 OAuth/CDN/Cloudflare DNS；联网服务必须单独配置并实测，不能因复制 web-search 源码就标可用。

## 6. 下一步及本轮验收边界

- **下一项：P04-B2，docs/60 合同下的压缩纵向切片。** 先压缩生命周期/usage/教师事实保护，再 typed IPC/正式按钮与真实实例；之后 B3、P05 Skills、P06 视觉/模型设置、P07 办公联网、P08 无 VPN 安装整体。
- 本轮完成：当前源码对齐、12 份来源清单 hash 核验、约束和四份文档/台账更新、git diff --check。
- 本轮没有修改应用代码或安装依赖，没有重跑 API/组件/build/Electron smoke；不将之前各切片测试当作本轮新增能力验收。不提交/push、不修改系统网络、不启用子 Agent。
