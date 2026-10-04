# P06c-B 同一会话保留历史切换模型：交付合同

日期：2026-10-03。M10/M01；承接 docs/89–90 与 docs/67。状态：B1见92、B2/B3既定专项与补充合同93见94验收；完整设置/精准视觉继续。总目标继续 active。

## 1. 教师可见结果与真实缺口

空闲时在当前会话选择官方 DeepSeek 模型，保留该会话全部公开历史和同一原生 JSONL/session ID；下一轮使用所选模型。运行、审批、整理与其他配置写入期间锁定。失败保留旧选择，崩溃后恢复已实际发生的切换，不重放模型回复、工具、审批或文件效果。

当前 P06c-A 正式菜单仅允许空会话选择，有历史的会话明确锁定。Pi 0.80.3 原生 AgentSession.setModel 会更新模型并 appendModelChange；Hana 0.449.0 core/session-coordinator.ts switchSessionModel 使用此方法，并检查运行/整理状态及目标容量。现有小智指纹包含创建模型，直接换 binding 会在下一轮报 configuration。没有持久切换协议；不得先解锁菜单再补恢复。

## 2. 实现顺序和分片边界

- B1 本轮：新增 SQLite 模型账本/切换意图和单语句原子提交；实现 Pi 原生 setModel 与真实 JSONL 回执/恢复的主进程基础；复用 Hana 容量拒绝逻辑并登记源码。生产仅增量初始化空表，菜单仍锁定已有历史。通过真实 SDK/SQLite/文件崩溃阶段实例和专项冒烟后进入 B2。
- B2 下一轮：原生身份指纹使用经主进程双源核验的 origin_model；同一 host 配置锁串联官方目录、账本、SDK、typed API、正式模型菜单和恢复。每轮 SDK 对象可重新加载同一 JSONL，禁止创建新聊天替代。必须处理记忆/Skills authority 隔离后的模型标记与手动/自动整理策略，禁止复活已撤销原生上下文。
- B3：正式 Electron Flash↔Pro 保留历史来回切换、真实提供商续问、停止/退出/重启/审批不重放、容量拒绝、双视口。B1 来源或底层实例通过不能勾选 B2/B3、D5/D6 或完整 P06。

## 3. 文件、表、契约与原子性

新增 main/xiaozhi-agent/model-switch-state.ts、native-model-switch.ts，纯主进程内部契约，不接收 renderer 提供路径、origin、SDK 对象或 native 身份。session-state.ts 仅接 modelSwitch 状态和增量 migrate。

新表 xiaozhi_pi_model_state 保存 schema/revision/origin/current/native_session_id/session_file；xiaozhi_pi_model_transitions 保存固定来源/目标、expected_revision、native 身份和 prepared/committed/aborted、原生 entry ID。一个会话最多一个 prepared。不存 key、消息正文、reasoning、授权或审批。

准备意图在原生 mutation 前落盘。Pi setModel 产生 model_change，随后写私有 commit 回执，再提交 SQLite。触发器在同一 UPDATE 内 CAS 更新账本与 binding，并检查归档、身份、旧模型和 revision；任一失败全部回滚。禁止在共享 SQLite 连接上跨 await 开 BEGIN，把无关写入卷入事务。切换成功 binding schema 升为 5；B1 不对生产开放该写入接口，旧 1–4 行不改。

恢复只核验可信意图、同一 session/header/file、精确 ancestry 和原生 model_change。未发生原生切换则 abort；已发生且证明完整则补回执并提交；冲突、未知版本、异会话、私有路径逃逸和未知模型变化 fail closed。恢复不 prompt、不运行工具、不自动完成旧审批。没有 durable 意图的 model_change 不能凭字符串相同认领。

## 4. 兼容、恢复与停止条件

旧数据库增量建表，不迁移或改写原消息、snapshot、公开 run、memory/skill epoch、授权目录；测试使用明确 owned 临时目录。触发器原子提交、CAS、prepared 唯一性保证并发和旧请求拒绝。切换 pending 时不得开始新 run，B2 接入后启动恢复失败以固定用户错误投影，不能隐式换模型或重建聊天。

创建模型指纹保留，不重写 snapshot；B2 主进程核验 origin 后组装旧身份，目标模型能力用于当次真实请求。模型切换不授予工具或资料访问。记忆/Skills 隔离、权限和原生摘要的现有约束优先，不能为保留 model_change 恢复被隔离分支。

## 5. 完成定义与验收

B1：新库与旧库副本幂等初始化；实际 Node SQLite CAS/冲突/触发器 rollback/归档、实际 Pi AgentSession.setModel 与 SessionManager JSONL 身份、历史保留；各崩溃阶段重开恢复/重复恢复；错文件/异常标记/未知变化拒绝；无模型请求和工具副作用；Hana 源 extraction/hash/Apache LICENSE。精确命令、数量、失败和边界写 docs/92。

桌面最低门禁 npm run build、npm run test:renderer-components、固定 out 主 smoke、git diff --check。B1 未修改页面，不用旧 Electron 页面实例冒称模型切换用户路径验收。B2/B3 必须完整 backend→typed IPC→正式用户操作→SQLite/JSONL readback→重启和真实提供商。最终不能用 deterministic provider 替代真实提供商证明。

新 npm 依赖：无。使用已锁定 Pi/Hana 版本；Hana 复用适配说明、精确输入输出 hash 和 LICENSE 同源核验，不宣称 Codex 官方同源。
