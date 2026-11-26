# 小智 D2 验收与手工复查

基线 `38a2a42`，实施分支 `codex/harness-phase8-tail-evidence-20261121`。用户提供的 `D2_验收标准.md`、`D2_改造说明.md` 及 GOAL 为验收合同。机器原始报告目录 `D:/WorkProject/EduProject/acceptance/D2-20261122`。

## 6.1 Terra High 独立结论

`terra-independent/REPORT.md` 保留首轮证据。`terra-retest/REPORT.md` 对修订候选独立复跑了手动整理/拒绝/冷启恢复 4/4、自动整理 1/1、能力依赖 1/1，均退出 0，渲染错误为 0。Terra 在 SQLite 回读了能力依赖，也确认历史编号只出现在原教师输入和版本化工具回执。依完整验收合同，D2-A 与 D2-B 均记为 FAIL。D2-A 尚缺生产安全切换与真实多候选证据。D2-B 尚缺全量 P0/P1 故障、长上下文、成本和恢复矩阵。该次模拟没有观察到已发生的 P0/P1 事故。

`terra-delivery/REPORT.md` 用交付构建复跑了 `query` 接到 `limit=4000` 的场景，4/4，通过实际 Pi 工具返回带来源版本的原始事实，渲染错误为 0。实施方另用正式 DeepSeek 复跑得到 4/4，覆盖同一条合成材料路径。这个结果补齐了该场景的真实模型验证，完整合同判定沿用独立报告。

## 逐项对照

| 编号 | 本轮结果及证据 |
| --- | --- |
| D2-A-001 | 结构化要求沿 Task/Plan/Requirements ID，缺口有界。`foundation-final.log` 验证上限、重复和要求变更。跨重启的缺口预算、每条软偏好的单独可信度待补。部分完成。 |
| D2-A-002 | D1 硬过滤后，D2 复核当前 Binding、制品、Adapter 和策略。Native 已测撤销、冲突、错误输入、沙箱超时，foundation 检验 AI 不能恢复淘汰候选。 |
| D2-A-003 | Foundation 验证单候选、开发者已定、占优、证据不足和模型候选验证。默认生产影子不发排序请求。真实有歧义多候选排序待采证。部分完成。 |
| D2-A-004 | 三种置信度和保守处理有固定输入断言。 |
| D2-A-005 | EWMA、Wilson、Pareto 有固定样本，质量和健康分开，标明窗口与样本，未启用 Bandit。真实标注质量覆盖待补。 |
| D2-A-006 | 冷样本不当作高质量或故障。Managed MCP 的合成安装探测与正式业务样本分开计量，第三方其他 Adapter 的同类探测待补。部分完成。 |
| D2-A-007 | 沿 D1 单能力一个主 Provider 与备选。真实 `update_task_plan` 保存能力依赖，缺失的前置能力阻塞预检。合成测试覆盖循环、未声明边和旧请求。完整多 Provider 并行业务样本待采。 |
| D2-A-008 | 沿原 Task 快照重用，再经 D1 权限条件和当前配对核对。影子缓存含 Adapter、健康、要求/计划与 D1 结果指纹。跨会话偏好不包含权限，影子结果仅用于观察。 |
| D2-A-009 | SQLite 实测区分 Adapter、Instance、Binding，熔断重读与 HALF_OPEN 恢复通过。已接入 Managed MCP 的既有授权探测，记账单范围 30 秒去重。定时探测和其他 Adapter 待补。部分完成。 |
| D2-A-010 | 持续超时、连接、进程、5xx 参与运行计数，取消、输入、权限、教师拒绝从计数排除。质量有独立档案。见 foundation。 |
| D2-A-011 | 固定 Cockatiel 4.0.0。新增健康观察无生产重试，原 Effect 决定能否重做。实际调用与合成错误分类通过。 |
| D2-A-012 | 原显式版本/Provider 切换检查 Task、Checkpoint 和副作用再记新快照。测试覆盖已完成及未知效果阻断。自动故障切换未上线。部分完成。 |
| D2-A-013 | SQLite 影子表记录需求/策略版本、候选、排除原因、样本、耗时、AI 是否参与与快照。真实运行查询见 `shadow-readback.json`。 |
| D2-A-014 | 生产选择仍由 D1 完成，默认影子不增模型请求。切回开关 `OMNI_EDU_D2_RESOLVER=off`，上线门槛见架构。 |
| D2-B-001 | `context/` 复用原 SQLite、Session JSONL 和 Pi 自动/手动入口，未增加第二个 Agent Loop。 |
| D2-B-002 | 对照 Pi 1.0.2 与 `billion-context-pi@0.1.83` 源包。ACP、流式工具和原 Session 完整兼容待证。现行 Pi 保持默认。部分完成。 |
| D2-B-003 | Pi 单压缩租约，原生条目含引擎 ID、版本和触发原因。Foundation 注入同一历史段并行整理。 |
| D2-B-004 | P0 SQLite 权威引用，P1 原区间及步骤，P2 在正式 `read_teacher_request` 内同会话有界查找，P3 沿现有投影保留原始历史。桌面以摘要未包含的教学卡片编号验证真实工具回执。 |
| D2-B-005 | 双阈值、输出预算、增长速率与防抖有单元断言。真实 Electron 自动模式在请求前追加原生摘要并继续回复。测试窗口为 655,360，按模型真实长课件校准待采集。 |
| D2-B-006 | 候选验证、事务租约和保留原始记录。Foundation 注入非法、并行、取消，再验证单一摘要。实际桌面通过命令菜单整理并逐字节核对原 JSONL 前缀。 |
| D2-B-007 | 本地上游拒绝后保留上一有效摘要和原始记录。Electron 冷启读回同一会话，原史检索恢复摘要遗漏的独立编号。备用引擎及独立新增重试未启用。部分完成。 |
| D2-B-008 | 真实 DeepSeek 4+4 对照和桌面 SSE 用量读回。请求级结果见 `deepseek-prefix-benchmark.json`。 |
| D2-ALL-001 | 影子 P50/P95、单候选耗时及 0 额外调用、健康写入开销和真实前缀对照已采集。真实多 Provider 样本、整机端到端分布与冷启动长期指标待证。部分完成。 |
| D2-ALL-002 | D1 强制授权不变，影子无执行入口，摘要使用权威引用。重点复查撤销后旧快照、未知效果与历史保持。 |
| D2-ALL-003 | Native 24/24、Managed MCP 5/5、Community Extension 6/6、Renderer 253/253。D2 桌面手动及冷启 4/4，自动 1/1。仓库 Electron 综合首轮 207/207。 |

## 构建与运行证据

| 证据 | 结果 |
| --- | --- |
| `build-final-reviewed.log` | Node 24.12.0，Electron 43.8.3，TypeScript 与编译通过。`main/index.js` SHA-256 `623cd6c35773bae1f89f1cdcfd16f46a330d52f3f8fbb2a0cdeda92b410ad785`。 |
| `build-delivery.log` | 交付候选的 TypeScript 与编译通过。`main/index.js` SHA-256 `aa7ddb76ce955ba2011573006190c2fd50a10110ddda5270f50e22cbd8fb7ff4`。 |
| `foundation-reviewed.log`、`native-regression-final.json` | 9/9、24/24。原 Phase 1 合成数据库副本迁移与真实 Native 执行通过。30 条 warm Native 样本 P95 4.54 ms。 |
| `managed-mcp-reviewed-report.json`、`community-extension-report.json` | 真实宿主与进程边界 5/5、6/6。`managed-canary-readback.json` 从合成 SQLite 回读 3 个健康范围、6 条真实安装探测记录。 |
| `context-electron-ZgC2aN/report.json`、`context-recovery-repair.log` | 手动摘要、上游拒绝、冷启续聊 4/4，真实 Electron 与本地合成 SSE。初次手动事务约 443 ms，补验记录恢复了未被写入摘要的编号。 |
| `context-electron-ojMPBk/report.json` | 请求前自动整理 1/1，真实 Electron 与本地合成 SSE。该自动事务约 845 ms。 |
| `request-recovery.log`、`plan-repair.log` | 原文范围与隐私测试 6/6。真实桌面能力依赖工具 1/1。 |
| `electron-final-reviewed.log`、`renderer-reviewed.log` | 修订候选 Electron 综合回归 207/207，Renderer 组件 253/253。 |
| `context-electron-deepseek-live.log` | DeepSeek 真实首轮 10 次请求。整理、失败保留和来源回执均实测，经两次错误查询后用尽本轮预算，最终答复失败。交付候选兼容 `query` 传 `limit=4000`，按匹配结果最多返回 20 条。 |
| `context-electron-deepseek-delivery.log` | 交付构建真实 DeepSeek 复测 4/4，正式 API 请求 10 次。单独注入一次本地摘要拒绝，原始记录和上一摘要保留。冷启动后通过版本化工具回执找回编号并完成回复。 |
| `deepseek-prefix-benchmark.json` | 请求直接到官方 API，4+4 次合成布局对照。输入 token 命中从 0 增至平均 1,056。 |
| `npm-audit.log` | 本轮 `npm audit --omit=dev` 退出码 1，报告 20 项已有生产依赖告警，包括 2 项 high。未新增该计数。 |

合成响应返回固定 320 输入 token，桌面前后用量里的本地估计与该值口径不同。这里只引用整理耗时、实际历史保持和同一任务续聊结果。真实长材料的压缩前后计费 token 和冷启动端到端对照未采集。

## 复跑入口

以下命令在 `apps/desktop` 执行。Workbench 独立项目所用 Electron 与存储在指定合成目录。

```powershell
$env:OMNI_EDU_ACCEPTANCE_ROOT = 'D:/WorkProject/EduProject/acceptance/D2-20261122'
npm.cmd run build -- --outDir test-results/xiaozhi-agent/d2-candidate-delivery
$env:OMNI_EDU_TEST_BUILD_ROOT = (Resolve-Path 'test-results/xiaozhi-agent/d2-candidate-delivery').Path
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/d2-foundation-smoke.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/request-sources-smoke.mjs
node scripts/xiaozhi-agent/d2-context-electron-smoke.mjs
node scripts/xiaozhi-agent/d2-context-electron-smoke.mjs --auto
node scripts/xiaozhi-agent/d2-context-electron-smoke.mjs --plan
$env:OMNI_EDU_PHASE1_FIXTURE = 'D:/WorkProject/EduProject/acceptance/D1-20261122/phase1-historical-result/data/app.db'
node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs
npm.cmd run test:renderer-components
node scripts/electron-smoke.mjs
```

真实 DeepSeek 前缀实验 8 次，桌面初测和复测各 10 次。原始报告均保存在验收目录。默认模拟复查不需要生产 API Key。本机合成真模型链路使用 `node scripts/xiaozhi-agent/d2-context-electron-smoke.mjs --live`，每轮最多 10 次，只转发 `api.deepseek.com/v1/chat/completions`。

## 教师手工操作

1. 打开本轮启动的小智验收窗口。进入「设置 → 能力中心」，搜索 `edu.workspace.file.stat`，查看可用的提供方、版本和状态。重开入口为验收目录下 `manual/启动-D2.cmd`。
2. 在「问小智」发三条较长的合成备课资料，在首条资料末尾放一个可搜索的名字和编号，如「橙色卡片 A17」。输入前确认已选择可用模型。
3. 选择输入框的「命令 → 整理上下文」。等待完成，再问「从本会话以前的资料里查找橙色卡片的编号」，无需重输编号。历史仍可向上查看，小智应回读旧资料并给出编号，或明确报告缺项。
4. 关闭验收窗口后用同一测试数据目录重开，打开同一会话。检查可继续输入、此前原文仍可读、整理结果仍可见。若上游中断，原文和上一版可用摘要仍可读。
