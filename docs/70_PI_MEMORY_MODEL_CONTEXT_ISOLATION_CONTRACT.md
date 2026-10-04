# P04-B3b2 模型记忆与原生上下文隔离交付合同

日期：2026-10-03；M10/M01。承接docs/68–69，用户Codex过程/组件基准docs/67。完整B3b2目标不缩小；本轮先交付原生分支隔离与来源授权校验基础，未贯通正式工具前modelAccess继续unavailable。

## 1. 真实证据与接口选择

- 已有B3b1本地授权metadata/教师预览通过18项；正式Pi尚无教育长期记忆工具。既有L2/L3真源和教师治理入口继续复用，不搬Hana人格记忆。
- Pi0.80.3 SessionManager公开branch(id)/getBranch/getEntries/appendCustomEntry/buildSessionContext。branch只移动leaf，下一次append形成新分支，原entry不删除或重写。branchWithSummary会携带废弃路径摘要，**不能用于撤销隔离**。
- getBranch仍包含祖先custom，即使buildSessionContext因compaction改变有效消息；因此可在首次交付记忆前记录安全分支位置，隔离旧toolResult及其后所有推导/压缩摘要。branch不可凭renderer传入路径或entryId操作。
- Hana现有memory-search按范围过滤，是工具查找机制；没有证据证明它已经解决小智教育授权撤销的历史污染。该部分用原生Pi接口适配本项目授权，不伪称整套直接复制。

## 2. 冻结算法

1. main从本会话scope版本/开关/所选ID/版本/private fingerprint及当前源状态计算私有authority摘要。任意选中源状态无法核验或changed/disabled/missing，读模型文本时拒绝，不升级旧授权。未开启返回无选择；L1独立仅本会话安全过程。
2. SDK运行开始记录main run ID及开始前safeLeaf；第一次交付L2/L3前追加私有taint marker，绑定authority与safeLeaf。之后的所有模型推导、用户续问、计划/来源文本及compaction均保守视为该授权派生上下文。
3. 每次provider请求（含手动/自动摘要）、每次工具以及摘要提交前后，校验当前authority等于冻结值；失效停止新调用，真实既有文件效果不撤回，不自动重试。
4. 下次教师主动运行前，若当前branch的taint authority不匹配：用branch(safeLeaf)，追加私有isolation marker（不含摘要/原记忆）。旧JSONL全部entry和SQLite公开历史保留。当前新prompt从干净分支继续；页面说明旧引用后的上下文已隔离，可能需要教师重述未完成事项。
5. run marker识别被隔离后缀的main run IDs；isolation marker累积受排除身份，重启后继续生效。本地protectedContext按这些run排除派生计划/来源/审批文字，避免从SQLite重新引入旧内容；原审批事实/状态仍在main，新的写入仍需新确认，效果不重放。
6. 安全位置必须是本branch祖先，不能越权跳至另一分支；不允许落在未配对工具call/result中。强制只在运行开始前取safeLeaf。未知未来版本、非法marker、缺安全entry、排除身份超上限均配置失败，不静默忽略。
7. 旧B3b1无marker不隔离历史；无实际记忆交付而仅修改选择也不丢历史。新工具/prompt指纹独立版本升级，原教育/controls fingerprint保持可校验；不改写旧header或历史骗过指纹。

这里的隔离只能阻止后续发送，无法撤回供应商已收到内容。教师重新输入内容属于新明确输入，不能声称模型永久遗忘。旧公开对话仍可查看；不能让撤销后的旧模型推导通过摘要回灌。

## 3. 文件、数据与接口

- native-memory-epoch领域模块封装SessionManager公开API，仅私有marker与分支，没有第二模型循环或新记忆正文库。
- memory-scope增加main authority/readSelected接口，复用已有source projection/指纹/教育脱敏；不暴露authority hash到renderer。
- compaction-context接受main排除run IDs，完整记录过滤后才有界投影。后续production-host / pi-session每个原生准入/提交接缝接guard；memory-tools只读所选必要教育文本/真实来源。
- 正式工具最终typed共享错误/公开隔离回执/模型引用状态/UI同时交付。当前基础阶段不改变modelAccess、工具集或默认provider行为，不提前启用尚未验收能力。
- 无新增依赖；使用已有exact Pi0.80.3 MIT/Windows Node代码，原生API无额外二进制或新安装服务；原有安装包/无VPN门禁保持待验。
- 回退基础阶段：恢复前代码即可，正式历史与数据不受影响。正式模型读取启用后不允许旧代码静默忽略taint版本而继续发送，须失败或显式升级；删除旧入口必须等兼容验收通过。

## 4. 完成定义（不能以基础测试代替完整用户闭环）

- 原生实例：首次读取→真实JSONL toolResult→模型派生文字→native compaction→authority变更→branch隔离→关闭重开读回干净上下文，原字节前缀/旧entries仍保留，重复启动不重复隔离；多次授权/隔离、无读取不隔离、未知版本/错误安全位置拒绝。
- main来源实例：未选/跨会话不读，最多12、脱敏、真实来源强弱；同版本hash变化、停用/删除/无法核验及scope版本变化拒绝，读取脱敏过程中变化需二次核验。
- 派生protectedContext实例：排除run计划/来源/审批文字不进payload，未污染的既有事实保持，实际main审批与原文件未删除。
- **最终正式Electron/DeepSeek**：教师自然任务调用受控记忆并引用→手动/自动compact→治理入口修改/停用/撤销→运行中失效停止→主动续问与重启不再发送旧内容，跨会话及迟到工具零交付。真源readback、两视口控件、build/renderer/必要smoke/diff均通过后才勾B3b2/B3b/P04。
- 基础native/main测试只证明隔离算法，不代表provider、UI或完整B3b2交付。每轮保留失败、精确命令和下一步。

## 5. 本轮与下一步

绑定兼容补充：沿既有xiaozhi_pi_session_bindings.schema_version，正式host在prompt/compact和任何记忆交付前保存v2；新reader接受v1/v2、未来版拒绝，setBinding不得把v2降回v1。原v1 reader的明确version===1门禁拒绝v2，避免旧代码忽略新增memory/taint继续发送。无需新增列或改JSONL；旧会话按原fingerprint验证后升级绑定。旧安装器整体尚未验收，不能将本门禁称为安装回滚已通过。

正式自动实例发现模型摘要可能遗漏已读教师事实，补充：只有原生分支已有真实taint交付记录时，摘要/续轮system保护段才从main重新核验读取必要文本及别名/版本/来源强弱，保留完整事实记录而不另建正文库。未读选择不自动注入，失效或撤销不保护旧文字；受污染后缀与保护段一起隔离。异常退出出现未配对tool call时，只允许恢复带main RUN marker的已核验祖先安全边界，旧未标记/非法边界仍拒绝；公开回执区分记忆授权变更和中断工具恢复，不声称未知效果已撤销。

2026-10-03正式接入冻结补充：固定read_education_memory/read_session_process空参数工具，不让模型传session/run/条目ID。memory prompt/tool fingerprint独立版本，旧legacy/controls摘要保持原校验。主进程当前guard500ms检查只用于授权失效收敛，不是第二模型循环；每个实际准入点另重验。运行中仅明确disabled+空选择可撤销，先核scope版本、认领配置锁、停止且await终态，再CAS保存；其它配置仍busy。手动摘要改沿与既有auto相同的Pi原生prepare/compact/append路径，以便提交前后受控检查；原生摘要/预算/停止/旧JSONL实例需复验。所有失败/未完成范围逐项留证，不把模型读取开关或工具注册当作B3b2已完成。

本轮实际实施上述原生分支模块、main授权校验及protectedContext过滤，并运行原生SDK/新旧数据边界；之后下一条接正式记忆工具及native全部准入点/可见隔离回执，进行真实DeepSeek实例。总目标继续active，之后P05 Skills/P06按docs/67/P07办公联网/P08实际无VPN与安装。
