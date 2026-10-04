# Pi 运行预算与真实用量验收

2026-10-02，P04-B1 / M10 / M01。修改前合同 docs/58，B2原生压缩、B3教育记忆作用域和队列编辑仍未完成。完整目标仍见 docs/35、48。

## 复用与实际交付

- Pi exact 0.80.3的AgentSession/agent.streamFn、助手message_end/usage、取消信号继续管唯一模型与工具循环；Hana已复用的stream-guard、execution registry、Hana RunToolScope/ResourceIO保留。运行预算是main的有界准入与账本，不另写模型循环。SDK getSessionStats只统计有效上下文，不能在后续压缩后当累计账单。
- xiaozhi_pi_budget_settings(schema_version=1)按会话保存预算与version；保存CAS/extra-field/range校验，当前owner/configuring锁拒绝运行中变更，预算固定到每run。xiaozhi_pi_usage(schema_version=1)持久化公开用量；无业务表重写、无新依赖。
- request上限在真正调用nativeStream前检查；工具上限在实际执行dispatcher前检查；累计provider token达到观察阈值后阻止下一request。活动时间使用单调时钟；澄清/复制审批暂停活动时间，独立有界教师等待；停止清理timer与signal，迟到回答/审批继续沿既有持久权限拒绝。
- 普通文件工具保持30秒执行timeout，复制审批的工具signal容纳配置waitMs，执行仍受活动预算；真实等待31秒保持pending且零写，停止后迟到批准零写。
- usage直接从SDK真实助手消息读取input/output/cacheRead/cacheWrite并逐字段对照JSONL。没有usage为未知，实际中断可为部分；没有供应商账单/价目映射，cost固定null，页面“费用：未知”。零价格注册占位不能变成免费声明。原生准入拒绝产生的aborted零usage不是一次provider请求，不降低之前完整记录的完整性。
- typed xiaozhi:budget、事件/快照接正式PiEducationWorkspace；PiBudgetCard复用已有Pro ChatTool的真实Trigger/Content slots。实际HeroUI MCP查阅chat-tool，使用现有本地复制源码/样式与finesse成本回执/真实状态原则；没有引入装饰数字或mock页面。

## 真实实例与门禁

在apps/desktop运行，合成教师资料与独立test-results数据根；原始教师库未改。各测试组有重叠，不累加为独立总数。

| 检查 | 精确命令 | 结果 |
|---|---|---|
| 真实正式DeepSeek预算/用量 | npm run test:xiaozhi-pi-budget | exit0，18/18，pi-budget-ui-IzUa2Y/report.json，pi-budget-ui-admission.log含build |
| 新旧测试副本迁移 | node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-approval-ui-8u29pJ/data/app.db | exit0，10/10，pi-state-migration-v8wg1m/report.json，含字段白名单 |
| 最新投影读取真实实例记录 | node scripts/xiaozhi-agent/pi-budget-projection-smoke.mjs test-results/xiaozhi-agent/pi-budget-ui-IzUa2Y | exit0，9个实际run逐项一致，pi-budget-ui-IzUa2Y/projection-readback.json；只读检查，不冒充新provider运行 |
| renderer | npm run test:renderer-components | exit0，79/79，pi-budget-renderer.log |
| 已有复制审批复验 | node scripts/xiaozhi-agent/pi-approval-ui-smoke.mjs | exit0，22/22，pi-approval-ui-e6RCHZ/report.json |
| 已有计划/队列复验 | node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs test-results/xiaozhi-agent/pi-approval-ui-8u29pJ/data | exit0，18/18，pi-control-ui-rVnRTm/report.json |
| 旧可观测门禁 | npm run test:ai-observability | exit0，ok=true/status=passed，pi-budget-observability.log；不代替Pi用量实例 |
| 主路径冒烟 | npm run test:smoke | exit0，ok=true，207/207，pi-budget-legacy.log，含最新源码build |
| 空白检查 | git diff --check | 文档收尾后exit0，仅LF/CRLF提示，无空白错误 |

18项证明设置实际保存/版本/范围与额外字段拒绝、真实usage与SDK逐项相等、双视口滚动可达、实际重启/会话隔离、模型/工具/token准入、运行冻结、问答暂停/续跑、等待超限与迟到拒绝、31秒复制等待与停止零写、实际活动流超时、真实终止隔离Electron PID树与指标partial恢复。崩溃读回保存的数值是最后提交的下界，没有伪造最终账单或重放run。成功用量仅合成教师提示真实DeepSeek，原VPN/系统网络配置未改。

最终各组无失败/skip，前述失败报告保留。最后字段白名单修订后迁移10/10、9个真实run的只读最新reader逐项核对和含build主路径207/207通过；未重复计为新provider实例。双视口截图已查看，正式控件可达，但字体、窗口轨道/侧栏/模型设置等整体视觉仍P06，不宣称一比一完成。

## 保留失败与修复

- 首版build：顶层pi-ai/compat类型子路径未解析；按项目已安装root导出Usage修复，不更改tsconfig或重装依赖。
- pi-budget-ui-WR7LvI/enXVzp前三项通过，双视口按钮bounds严格断言失败。实际DOM诊断按钮底缘768.083px，scrollIntoViewIfNeeded nearest的亚像素取整造成不足1px的贴边；面板补min-height/max-height，测试滚动到面板中部后仍严格验证完整bounds。不能将早先“裁切”推断当真实不可达证明，失败报告保留。
- pi-budget-ui-dwerYF前7项通过，model预算触发后completeness被错误标partial。SDK为未发出的请求生成aborted/usage零消息；根据已知准入原因排除此非provider零记录，保留实际已报告tokens，最终18/18逐项通过。

## 下一项与未完成范围

第一项P04-B2：冻结细化原生compact上下文保护与计费合同，接SDK compact/SessionManager；压缩前后保留计划、来源、审批/文件版本与明确事实，失败/停止不破坏旧分支，压缩调用usage也入账，旧JSONL升级与双视口正式按钮实例。随后B3接已有L1/L2/L3授权scope/脱敏/证据，不新建教育记忆真源，并补原生队列编辑撤回。

B1不代表完整P04或Codex对齐完成；完整Skills、模型/设置/视觉、办公联网、实际无VPN/Windows安装仍按P05–P08。token阈值只能在收到usage后阻止下一request，单次可能超过，不是硬费用上限。没有自动续跑预算耗尽任务，也不自动撤销已经完成的文件效果。回退OMNI_EDU_XIAOZHI_PI=0保留旧入口与数据；无commit/push/子Agent/系统配置变更。
