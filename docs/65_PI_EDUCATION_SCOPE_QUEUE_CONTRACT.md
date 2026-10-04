# P04-B3 教育记忆作用域与指令编辑撤回合同

日期：2026-10-03。M10/M01，承接docs/64。**仅冻结下一切片，不是已完成证据。** 用户目标仍为定制教育/办公智能体、Pi/Hana基座、国内API和Codex完整功能/交互/视觉；三元题组暂停。不考虑每轮token成本优化。

## 1. 核实的当前能力和缺口

- 正式Pi唯一循环已具备知识检索、授权文件read/stat/list/确认copy、计划/澄清/原生追加队列、运行预算、手动/自动上下文整理及恢复。SDK历史与main同会话保护事实已贯通；教育长期记忆尚未注册到正式Pi工具。
- 既有 `OmniEduStore.getAiMemoryTrace` 仅返回L1阶段/状态/工具和input/output键，明确不返回原prompt/隐式推理。`inspect_memory_trace` 旧执行分支的默认“全库最新run”不能直接套用于某个Pi会话，应先按main已有会话/run归属限定。
- L2既有 `getAiMemoryDocument(surface)`、条目版本/status/origin/refs；L3 `getAiMemoryL3Document(slot)` 按全局槽位保存，sourceDocuments只记录surface，没有完整逐条来源关系。它们不是自动授予任何新会话的授权，也不能伪称L3具备逐条证据。
- 旧工具 `inspect_memory_trace/summary/synthesis` 声明 `privacy: local_only`。不直接将原执行结果装入云模型，不改变旧工具/旧入口语义；必要文本/摘要沿已有教师明确选择、最小化、教育脱敏规则提供单独受控adapter。保存active记忆不等于可自动上传。
- 当前instruction持久state queued/applied/interrupted，主进程command/hash防重；Pi支持公开 `steer/followUp/clearQueue/getSteeringMessages/getFollowUpMessages`。0.80.3无公开按ID删除接口；不能仅改SQLite/UI或访问私有SDK队列冒充撤回。实际message_start消费才applied，编辑/撤回必须与消费竞争保持一致。
- MCP优先检索小智/Hana作用域/队列符号均未形成图谱节点，部分raw matches可用；核读确切 `db.ts`、旧tool-registry、Pi公开d.ts/js、正式host/control-state与PiControlCards，不假称完整图谱覆盖。

## 2. 教师可见结果与纵向范围

### B3a：指令编辑/撤回

1. 正式指令卡显示待处理/已送达/已撤回/因停止中断；仅真正未被SDK消费的项可编辑/撤回，已送达不能伪装回收。
2. typed mutation契约包含会话、control身份、期望版本及明确action；文本/模式有界、教育脱敏、字段白名单，main核对会话/run/owner/state。
3. 使用Pi公开队列API，保持另一模式队列、顺序、同文本不同身份的正确对应；冻结原command身份/初始hash，mutation版本独立，重复操作与并发/CAS语义明确。禁止第二调度循环。
4. 先核查SDK消费接缝的公开能力再实现；任何await导致的消费竞态必须有真正运行层同步方案，不能依赖按钮禁用。若只能在等待教师问题/确认时安全操作，必须清楚反馈且该限制未解决前不勾完整B3。
5. 停止、自动整理、回答澄清、复制确认、run收尾与编辑竞争不得把旧指令再次送入模型；不得为撤回一条而丢弃其他队列。已执行效果不通过撤回命令回滚。

### B3b：复用既有教育L1/L2/L3，显式scope与来源

1. 原始事实继续在既有SQLite memory/run/event表，JSONL为唯一模型会话历史；不复制Hana人格/梦境/FactStore，不另建教育真源。
2. 默认仅本会话可证明归属的安全过程摘要；禁止全库最近run兜底。教师可在本地面板预览并选择本会话允许引用的明确L2/L3条目，显示内容、状态、版本与实际来源强弱；无证据不显示“已验证”。
3. scope只保存授权元数据/选择版本，不复刻事实内容为第二长期记忆；复用既有主进程脱敏。模型只能查询main冻结的范围；模型参数不能指定任意run/表/学生/别的会话。关闭/撤销、被删停用/版本变化后不得静默继续引用旧文本。
4. 只向云提供必要脱敏文本和摘要；本地预览不自动上传。学生原图/整库/原prompt/私有推理不在payload；L3仅surface来源必须明确说明，不从其文本推导新的权限或教师确认。
5. 本切片提供受控只读/可审核候选，持久记忆保存/修改仍走既有教师编辑确认路径。模型不能写active记忆或用旧审批/摘要授予文件权限。
6. 教师知道本轮使用了哪些记忆来源，正式typed snapshot/Pro组件显示真实范围、没有授权的empty、失效/错误/重试；压缩前后重新验证来源版本，重启回读不自动扩大范围。

## 3. 预计修改与兼容

- shared/xiaozhi-agent、preload typed契约、main领域scope/queue adapter、host/control-state/education-tools、Pi resource/tool快照、正式PiControlCards/范围卡、专项脚本；不继续堆业务到App/db/index大文件。
- 若需要授权/指令revision持久元数据，增量幂等迁移；原始教育表不删不改。旧schema/JSONL副本与全新库分别验收，未知未来版本拒绝。先明确新格式与旧reader回退策略再写表。
- 工具集/prompt改变需单独版本化会话快照升级，旧已绑定provider/目录/history保持，不因新增scope错误破坏指纹或重放旧效果。
- 主进程校验实际来源/范围，renderer字段不能授予新资源/任意工具；联网/Skills/图片仍按后续专项，不能趁此切片开放。
- 新依赖优先不新增；需要时记录用途/许可/体积/Windows打包。Hana独立模块可复用时直接复用并登记hash，原本不适合的教育语义须明确适配。

## 4. 完成定义与对抗实例

- 真实Electron/DeepSeek：自然教师备课任务→必要澄清→追加两种模式→编辑一项/撤回一项→SDK实际只消费修改后项一次；公开段落、SQLite/JSONL对账，重启保持。同文本多ID、模式变更、并发版本、消费瞬间、回答/停止/自动整理竞争均覆盖。
- 真实teacher UI既有记忆→本地预览/选择→绑定本会话→真实模型工具检索→回复引用→原生compact→续问→重启；跨会话/run/学生拒绝、没授权empty、active/disabled/deleted/version冲突、脱敏/原prompt与thinking未上传、L3弱来源可见。
- main批准事实/来源版本在压缩前后保持；拒绝/撤回/停止后旧写审批与指令零重放。实际拥有的Electron进程退出，原教师测试副本保持，真实正式用户路径不能被直接SQL调用/静态demo替代。
- scoped纯边界/新旧迁移/本轮模块实例；build、renderer、关键路径smoke、diff。每份报告区分真实provider/故障注入/模拟边界，精确命令/通过/失败/skipped/未验范围，1366×768/1920×1080操作可达。

## 5. 顺序与下一步第一条

### B3a实施算法冻结（本轮源码核查后）

- 沿Hana已复用prepareNextTurnWithContext接缝，main持久待处理指令只在原生即将消费的回合边界交给Pi：steer按顺序每次一条；无工具调用/无待steer时才交一条followUp。Pi原生循环依然决定实际模型继续，不创建第二模型循环。当前0.80.3每个回合先执行该接缝，后拉取steer、任务将结束时拉取followUp，已核固定包源码。
- main可变待处理集在公开运行adapter中保留ID/文本/模式，编辑在任何模型流式/工具等待/自动整理期间都可操作，交付过程dispatching后拒绝修改；未交付项不会先进入SDK隐藏队列。交付事件和实际message_start(applied)分别持久/展示，不能把锁定称已送达。
- mutation先同步预留adapter中的待处理项，异步sanitize/CAS期间回合交付等待reservation settle；持久成功才同步替换/移除，失败释放原项。所有await前后复核owner/stop，消费胜出的编辑明确拒绝。相同文本通过唯一offered ID映射，另一模式队列和顺序保留。
- 指令payload schema_version=2加入revision/withdrawn状态及dispatching；旧v1指令以revision0只读/按操作升级，计划/提问仍v1，未知未来版本拒绝。原表不删除，无结构性迁移；旧reader不支持新版状态时拒绝而非静默误读。原始command hash不变，mutation重复按期望revision与新结果回读。
- 真实旧库/JSONL副本验收发现无教师目录授权的private workspace使用绝对路径指纹，副本迁移后配置失败。增加main专有会话private身份：仅实际workspace等于本会话stateRoot/workspace、旧SDK header路径末尾严格为xiaozhi-pi/同会话ID/workspace且没有教师目录grant时，允许用旧header cwd校验原模型/工具/prompt指纹；实际工具仍使用当前受限目录，不访问旧路径。不改写原header或旧快照，只追加私有迁移记录。显式教师目录授权不允许此兼容，任意/其他会话/改变模型工具指纹仍拒绝。需真实副本续问与negative边界验收。

先核Pi原生消费时序/公开hook与Hana是否已有可独立队列编辑模块，冻结B3a mutation版本/同步算法，完成正式UI编辑撤回和真实实例；再B3b依据原有L2 refs/L3弱来源设计scope metadata，正式记忆面板→工具→压缩/恢复验收。完整B3通过后才勾P04，随后P05 Skills、P06模型设置/一比一UI、P07办公联网产物、P08实际无VPN与安装；总目标保持active。
