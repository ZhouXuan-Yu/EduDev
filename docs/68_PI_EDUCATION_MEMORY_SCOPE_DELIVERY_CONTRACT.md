# P04-B3b 教育记忆作用域纵向交付合同

日期：2026-10-03。M10/M01。承接 docs/65–67，完整 B3b 仍未完成。教师结果：本地查看已有教育记忆，按会话选择可引用的必要摘要，知道来源/版本及失效原因，最终真实模型仅引用授权且有效的内容。

## 1. 当前真实链路与缺口

- 既有 MemoryGovernanceWorkspace → preload → OmniEduStore 的 L2/L3 预览、教师采纳、版本编辑/停用/软删除是真实入口，原表仍唯一教育记忆真源。L2 有 run/event refs，L3 仅 sourceDocuments(surface)，不能冒称逐条证据。
- getAiMemoryTrace 返回有界过程字段、不含原 prompt/隐藏推理；新会话不能使用旧全库 latest run 兜底。正式 Pi 尚未注册长期记忆工具。
- 已刷新 codebase-memory 图谱（fast、无新持久artifact），此前符号命中但snippet行号对应错误函数，不能依旧行号作证。源头方法和主进程/typed preload/现有记忆页面已按当前源码核对。
- 授权变更不能仅让未来工具返回 empty：已经进入 SDK 历史或压缩摘要的旧文本仍可能影响回答。B3b2必须处理这条旧上下文路径才算完成。

## 2. 实施依赖顺序（完整目标不缩小）

### B3b1：本地预览、会话选择与持久 metadata

- typed selector限定 L2 surface 或 L3 slot；分页50、文本按原1000字符上限、refs/来源有界且原样保持实际来源强弱。
- teacher原有记忆治理入口继续编辑/确认事实；小智面板只读预览和选择，不创造第二份教育记忆，不让模型修改active记忆。
- default enabled=false/选择空。教师明确选择“允许本会话引用必要脱敏摘要”，保存最多12项的层/定位/ID/条目版本/main内容指纹，仅metadata。公开scope snapshot不含原始记忆文本、私有hash或任意DB字段。
- scope version/CAS、同会话存取、严格字段白名单。保存时校验active/当前版本；重启/刷新重新查源，changed/disabled/deleted/missing必须可见。不得自动更新授权版本。
- 改动与正式prompt/compact共享同会话config owner，active阶段配置返回busy；UI明确先停止/结束再修改。B3b2再交付运行中撤销安全协议，不假称本步已经支持。
- **本步模型读取仍未接入，页面必须标“选择已保存，模型读取尚未接入”；不把本地预览/保存当作云调用已通过。** 此步是B3b2所需授权基础，完整B3b不勾完成。

### B3b2：受控模型工具、历史隔离与实际 provider 验收

- 默认L1仅本会话已证明归属的安全过程，工具不能指定任意run；L2/L3只读本会话冻结且有效的selection，返回必要教育脱敏文本+真实来源/版本。
- 每次模型请求/工具调用/压缩前后重验选中版本/状态与授权epoch；模型不能改变范围或依靠摘要旧审批授予文件权限。
- scope变更或来源失效后，停止任何新请求；旧模型历史及compact摘要有已引用内容时必须隔离。先冻结原生新上下文/保留可查历史与教师确认的具体算法及兼容，再注册工具。禁止只修改UI或删除几段toolResult假称摘要已清除；不能承诺已发送内容可从供应商撤回。
- 原native SDK工具/prompt指纹升级独立version，保留模型/目录/已有历史；不能改写JSONL骗过fingerprint。实际教师主动续问、来源失效、撤销、重启/压缩、跨会话均验收。

## 3. 本步文件/表/契约/兼容

- 新 `xiaozhi_pi_memory_scopes`：conversation_id FK/PK、schema_version=1、version、payload_json、updated_at；仅授权metadata，不含文本/摘要/凭证。增量IF NOT EXISTS、全新与明确旧测试DB副本幂等验收；原memory表不修改。
- main领域 memory-scope-state / memory-scope / memory-selection，仅在session-state聚合；host接snapshot和config owner，typed IPC/preload，正式PiMemoryScope面板复用现有Pro ChatTool，finesse实际来源/状态原则。
- 不改SDK toolset/prompt/私有history格式，不改变默认工具能力。未知未来scope/schema拒绝并显示错误，旧session无scope等同默认空；旧JSONL与目录授权保持。
- 无新增依赖。Pro沿已有本地源码/BEM CSS复用；本轮MCP查阅chat-tool文档，不冒称MCP提供Pro源码。完整Codex视觉按docs/67后续验收。
- 回退：恢复此步前代码忽略新独立metadata表，旧教育数据/SDK历史继续可读；旧reader不可将未知schema解读为授权。不得删除真实用户库或清空原始记忆。

## 4. 完成定义与实例

- B3b1：从正式小智打开本地面板→分页/来源/脱敏预览→明确选择/开关→保存→SQLite metadata白名单readback→实际重启保持。复用既有治理页面停用/改版本/删除后刷新显示失效、旧版本不能保存，跨会话默认空；active owner与并发CAS拒绝真实有效。
- 默认不允许读取任何长期记忆；真实DeepSeek继续原主路径时，新scope文本未进入SDK历史/请求，UI不得声称已使用。构建/renderer/专项迁移/真实Electron页面/必要smoke/diff，1366×768/1920×1080可达。
- B3b2：教师自然任务→受控记忆tool→回答引用→nativecompact→重启续问，未选择/跨会话/失效/撤销/旧摘要隔离及来源弱证据正确；完成后才勾完整B3b/P04。

## 5. 下一步

本轮先实际交付B3b1，不仅写方案。完成本地授权/预览实例后，第一条B3b2冻结已引用记忆的原生历史隔离与撤销算法，随后接真实工具/DeepSeek。总目标active、P05–P08继续，三元题组暂停，暂不做token成本优化。
