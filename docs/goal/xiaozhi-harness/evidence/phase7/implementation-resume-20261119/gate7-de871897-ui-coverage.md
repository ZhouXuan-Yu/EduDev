# de87189 页面逐项证据

以下以 `D:/WorkProject/EduProject-harness/apps/desktop/out` 运行的 481 文件为准。构建 SHA-256 为 `28c2c96b95192c3b4228f43310b3b63f7178adb53e093942a22d2558e5b5fda6`。两尺寸是 1366×768 和 1920×1080。页面使用隔离资料与独立 profile。具体报告路径、原件摘要与各块执行范围见 [证据索引](gate7-current-de871897-20261121.json)。

| 合同项 | 实际页面操作和核对结果 | 证据索引 | 范围 |
| --- | --- | --- | --- |
| UI-01 恢复任务数量和状态 | 工作台显示 5 条任务事实，切换筛选，重开后核对原数量和状态。 | longPath U01/U02/U09 | 两尺寸核对控件可达性，实际冷读一次。 |
| UI-02 完成任务不进入恢复列表 | 未完成筛选显示 4 条，完成筛选显示独立的已确认样本。切回后仍为原集合。 | longPath U01/U09 | 隔离五条任务。 |
| UI-03 状态和原因可读 | 工作台显示待继续、待核对与已确认，部分索引读取时显示不可读数及刷新入口。忙碌时由键盘退出，回到触发控件。 | longPath U01/U03/U04，partialEmptyStates，readFailureAndRetry，keyboard | 状态和提示实页可读，教师理解度未作独立用户抽样。 |
| UI-04 同任务仅一次继续 | 可见按钮双击只建一个 Run。已交付文件请求被阻止重复派发，冷启保留原文件和回执。新运行和另一会话各自持有结果。 | longPath U03/U04，w2SavedEffect，w3 | 防重覆盖已保存文件这一精确效果。 |
| UI-05 审批说明完整 | 实际现代审批详情核对用途、资源、数据范围和条件，长路径可以滚动读取。历史已有文件的核对按原审批记录执行。 | approvalCanary，longPath U05/U06 | 现代与历史合成样本。 |
| UI-06 审批批准、拒绝、持久 | 确认保存与拒绝后冷读原 ID。目标改变后旧审批失效，MCP 变更与撤销后清除旧信任。已发决定时按 Escape 只关闭面板，晚到结果不会覆盖另一条申请。 | longPath U05/U06/U09，a2Target，w2SavedEffect，c2SchemaAndTrust，keyboard | 审批状态、文件、MCP 取证各自保存。 |
| UI-07 保持秘密值不可见 | 正常设置、审批摘要和详情中找不到已配置的合成模型密钥，受控错误中的合成密钥值也未出现在错误反馈。 | approvalCanary，approvalSafeErrorAndLongSources | 两尺寸单个合成 Provider 密钥及一个受控错误响应。 |
| UI-08 技术细节按需展开 | 普通审批、Skill 来源和三类能力的中文风险默认可见。展开后读到原技术标识、完整版本和来源指纹。1920 的 Space 定向复验保留焦点并折回原详情。 | approvalCanary，capabilityRiskDisclosure，skill.initialErrorAndDisclosure，skill.foldDiagnostic1920 | 保留首次折叠立即断言失败。 |
| UI-09 识别能力状态 | 能力中心分类显示内置、缺条件、需核对或不可用的候选。必需缺口无法进入可用集合，可选缺口仍允许选择。 | longPath U07，c1，readFailureAndRetry | 真实页面读合成元数据及生产内置能力。 |
| UI-10 来源、版本和风险 | 能力中心读生产来源、版本和核验状态，三类能力风险可展开。Schema 变化后可查看复核结果。 | longPath U07，c1，capabilityRiskDisclosure，c2SchemaAndTrust | 当前任务效果与只读目录状态分别核对。 |
| UI-11 市场候选与已核验能力 | 未安装候选保持隔离。真实注册的本地 MCP 执行成功，失信任后清除选择，撤销后同任务从本地资料完成合法替代。 | c1，c2SchemaAndTrust，c2 | 合成回环 MCP；实际批准、撤销及冷读。 |
| UI-12 个人、团队和官方归属 | 常规成员只能提交团队副本。个人敏感样本共享被拒。合成官方审核员两尺寸从实页审批。 | skill.member1366、member1920、privacy1366、privacy1920、officialReviewer1366、officialReviewer1920 | 官方权限为隔离副本中的本地合成角色。 |
| UI-13 团队管理员审批 | 独立团队副本以准确版本进入待审，普通成员不可审核，合成管理员批准，冷启保留两个副本及状态。 | skill.teamAdmin，skill.member1366，skill.member1920 | 主要控件两尺寸，管理员写入一次。 |
| UI-14 版本历史、来源和回滚 | 两尺寸检查旧字节、运行版本锁定、回滚后下一轮变化及冷启。受控写入错误保留旧版本，刷新后仍可读。 | skill.version1366，skill.version1920，skill.initialErrorAndDisclosure，skill.foldDiagnostic1920 | 写入错误在测试 IPC 边界注入。 |

## 通用状态与窗口

- **加载、读取错误、重试**为任务、审批、能力与 Skill 各两尺寸的实际页面，共 24 项。启动模型目录 GET 被拦截，没有模型请求。收件箱的整体读取故障与单条详情或提交失败分别判定。
- **空和部分**为任务、审批、能力三个面板的两尺寸读取样本。刷新后完整空态恢复，SQLite 原事实不变。Skill 无个人项和无待审队列已实测，Skill 接口没有同样的聚合部分读状态。
- **取消**按操作含义判定。Skill 表单可以取消。隐藏或折回只读详情是关闭操作。已发送写入的最终结果从原记录核对。
- **原生拖窗与流式**在同一构建中实测。独立 Win32 操作覆盖两尺寸拖动、最大化和拖拽还原。前台两个尺寸各 7 项，包括输入、展开、滚动、停止、切换与流中增量。长路径实际 Windows 终端在两种尺寸核查工作台控件，实际终端运行、输入和冷读执行一轮。

独立 Terra 按原合同确认 Gate 7 通过。S1 官方审核、保密及故障注入的结论限于上述隔离场景。原 Skill 失败报告和同构建定向复验并存。QG-09 和正式模型对照按 Phase 8 合同执行。
