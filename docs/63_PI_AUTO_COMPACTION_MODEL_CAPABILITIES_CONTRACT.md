# P04-B2b 模型能力与自动压缩交付合同

日期：2026-10-03。M10/M01；承接 docs/61 手动验收。本文件保留实施前合同，完成证据见docs/64；自动已在范围验收后默认开启，未知能力关闭。

## 1. 已核实的起点

- 当前正式手动路径使用 Pi 0.80.3 compact；模型注册的 contextWindow=32768、maxTokens=4096 是本地配置，并非 provider 官方能力。控制、审批、command、budget 与脱敏已有正式入口和真实验收。
- 只读实查 `https://api.deepseek.com/v1/models`，2026-10-03T00:56:44Z HTTP200，配置模型 deepseek-flash：name DeepSeek-V4.1-Flash、context_window=1048576、max_output_tokens=393216、input=text/image、output=text、effort=low/high/max。报告 `apps/desktop/test-results/xiaozhi-agent/deepseek-model-capabilities-probe.json`。本项没有上传教学资料，没有修改生产配置，也不证明实际无VPN。
- 官方 schema 核对：https://api-docs.deepseek.com/api/list-models/ 。直接 open 超时，官方搜索返回 schema；结论另由真实鉴权列表支持。能力与项目默认输出长度分别保存，不因模型支持图片就自动上传学生图片。
- Hana `core/model-sync.ts:buildModelEntry` 按显式配置/已知能力组装 Pi 模型；`core/session-compaction-runtime.ts` 包装 prepareNextTurnWithContext，在 assistant usage 加本轮工具结果后检查阈值，保留先前 SDK hook、压缩后替换下一轮 context并追加私有继续通知。`computeCompactionReserveTokens` 按 max(16384,10%窗口) 留白。
- Pi 本版本 `_checkCompaction` 只在新 prompt 前和整个 run 后检查；单纯 enabled=true 不足以覆盖工具循环。Hana 实现含不适合直接移植的 cache/persona 等闭包，应复用可独立 runtime 与估计机制，按 manifest 记录源/hash/适配，压缩仍经官方原生实现，不调用 SDK 私有方法或 session.compact 中途 abort 当前运行。
- 原生自动 compaction 失败会被 SDK 吞掉并继续；教育宿主必须显式处理失败，不能让旧助手文本冒充本次成功或在已超窗口时继续。不可采用 Hana hard truncate 的静默有损降级。

## 2. 纵向交付范围

1. main 模型能力域：只从固定官方域名获取有界/超时 metadata，验证字段，缓存本地有版本/时间/来源的安全白名单；按模型ID精确匹配。网络失败保留可核对旧能力，未知能力不伪造官方窗口、不静默切模型。凭证只在 main，模型列表不能广播 key/raw headers。
2. Pi registry 区分真实 context/output能力与本地请求输出策略，冻结每run模型/策略；已有私有历史模型身份/工作目录/fingerprint不变，能力补充不重写旧 transcript。政策能力缺失与请求失败中文可见。
3. 原生自动阈值与每轮接缝：复用 Hana runtime 独立函数/包装模式，预算与summary result走已有唯一 streamFn；检查原生请求完整组成（系统提示词/工具schema/消息/新输入/输出预留/协议余量），一次工具突增与首次大输入不能等到错误后才检查。只追加native compaction，不另建主模型循环。
4. main 权威事实保护/usage继续沿用docs/61；单run内压缩与助手请求共同计数/计时。取消、预算耗尽、摘要空/截断/长度不合法、摘要请求自身超限→原历史保留且准确终态；不硬截断、不自动重放旧复制或审批。
5. 公开事件扩展原生真实 compaction reason/起止/失败，支持同run多个压缩item，不重复或覆盖原手动卡。renderer运行期间显示自动压缩过程、停止可达，成功后继续原任务；内部续跑通知不是教师新指令、不进入公开对话。
6. typed snapshot/正式页面只展示安全能力与项目策略，模型能力实际值和本地策略清楚区分；完整模型切换/设置视觉归P06，但本切片必要能力信息与失败反馈必须可操作。

文件预计涉及新main模型能力与自动压缩小域、Pi门面/host、shared事件/投影、typed preload/正式Pro卡、Hana runtime独立闭包与source manifest、scripts/包命令、docs及四协作文档。无新业务表优先；如果需要版本表，先补合同再实施，不绕过旧库迁移。

## 3. 完成定义与实例

- 真实鉴权模型列表 → 正式能力回读 → 真实长会话/多轮工具任务 → 自动压缩native entry →同run继续原任务，来源/计划/文件版本/拒绝事实不丢、usage对账、重启读回。验收同时包括自然教师请求与测试明确控制的合成内容。
- 百万窗口边界采用真实模型能力校验和本地较早压缩测试策略；测试策略只在未打包隔离E2E有效，明确它不是官方窗口。真实请求/原生摘要照常调用DeepSeek，不能以deterministic proxy冒称provider通过。不得为了测试上传真实资料或修改系统VPN。
- model list非法/无目标/超长/未来缓存版本、网络失败缓存回读、系统prompt/工具schema/首次输入组成、同run多次阈值/陈旧usage epoch、并发summary usage、正常工具队列继续、取消迟到零写、摘要失败保留前缀、原生提交前后退出不重放、跨会话隔离。
- 原有手动压缩、预算、关键控制路径实例复验；build、renderer、必要主路径smoke、git diff --check。报告精确通过/失败/skipped/故障注入/真实provider范围，双视口可达。不存在自动范围验收前不启用生产auto。

## 4. 兼容、恢复与顺序

- 原JSONL只追加；新策略/能力缓存有版本/上界和失效说明。SDK历史仍唯一模型真源、SQLite保持教育事实/确认。旧key/config私有，旧入口回退保留；无commit/push/系统配置/子Agent。
- 优先完成目标，暂不做每轮token成本优化；用量与现有运行保护继续如实执行。完整B2通过后才勾选父项，再B3已有教育作用域/队列编辑，随后Skills、设置/一比一UI、办公联网、实际无VPN/安装。

## 5. 下次从这里开始

先检查本轮metadata report与固定Pi类型/导出，沿Hana runtime独立函数确定可直接复用闭包并登记；实现main能力缓存与每run策略，再接每轮原生压缩和公开多item投影。不要从“启用compaction=true”单行改动开始，也不要重新执行已完成的手动18项来代替自动实现。
