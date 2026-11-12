# Gate 1 独立审查最终报告

## 结论 ACCEPTED

日期为2026-11-12。范围为EXECUTION_BOOK Phase1 T1.1–T1.4及PHASE_1_IMPLEMENTATION.md，实施树为D:/WorkProject/EduProject-harness，分支codex/xiaozhi-harness-20261112，基线HEAD为4e8873065f6c4b0e30cd8b403668c5a08f63ad40，加最终未提交Phase1源码。精确受审文件SHA256见同目录reviewed-source-hashes.json。

第一轮REJECTED及原探针永久保留在GATE_1_REVIEW_ROUND_1.md、independent-probes.mjs和probe-report.json。G1-F01与G1-F02修复后均经独立复验关闭。本结论接受本阶段最小能力协议、Registry、Resolver和Native只读试点。

## 独立实际执行

以下三条均由本审查Agent亲自运行，资料为临时合成文件，真实模型请求为0。

| 命令与工作目录 | 结果 | 证据 |
|---|---|---|
| apps/desktop下 node scripts/xiaozhi-agent/capability-phase1-smoke.mjs | PASS 32/32，exit0 | C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-capability-phase1-HFYhFx/report.json |
| node 本目录fixed-delta-probes.mjs | PASS 9/9，exit0 | 本目录fixed-probe-report.json |
| apps/desktop下 node scripts/xiaozhi-agent/capability-phase1-production-smoke.mjs | PASS 8/8，exit0 | D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/capability-phase1-production-URAfm1/report.json与worker.log |

此前独立真实SQLite探针3项通过，包括两个独立连接的CAS恰一成功、返回Snapshot修改不改持久状态、错误hash读取拒绝。独立协议suite修复前30/30历史报告也保留。

生产接线专项使用实际Electron主进程、实际OmniEduStore及实际createXiaozhiProductionHost。测试worker从当前源码单独esbuild打包，运行在隔离profile/data/workspace。Pi模型传输被约束到本地loopback SSE，断言modelCalls为1，真实远端模型调用为0。测试没有重建或改动应用out。

## 关键验收核对

| 条目 | 状态与依据 |
|---|---|
| C-01命名空间、严格schema、版本 | PASS。对象精确字段、访问器拒绝、官方Provider允许清单、Provider类型namespace硬绑定。mcp/extension不能占edu.native，合法外部Provider仍能绑定核心Capability。 |
| C-02两个真实Provider | PASS。一个edu.workspace.file.stat绑定原createHanaOfficeTools.office_file_stat和原createWorkspaceFiles.stat。Node中二者读取同一真实临时文件并返回相同size/path/version，Hana额外MIME，workspace披露缺口。实际Electron的host.start活跃Run也成功执行这两个原Provider。 |
| C-03 Required | PASS。缺证据与self_declared证据均不能满足Required。修复后新Provider不能通过改写同版本Definition移除Required，真实SQLite验证失败事务不改变revision/Definition。 |
| C-04、C-05、R-06 | PASS。Optional和未触发Conditional缺口显式披露，require_mime触发时排除workspace Provider并选择真实Hana。 |
| C-06版本兼容 | PASS。Contract不匹配注册/解析拒绝，既有Definition的Required/inputSchemaRef/outputSchemaRef/contractVersion隐式替换拒绝。 |
| C-07来源及完整性 | PASS。manifest/binding哈希匹配、持久快照hash读回、Native源码声明/来源/publisher/toolRefs再校验均存在且有反例。source verification与权限分离。 |
| C-08撤销 | PASS。Provider和Capability撤销tombstone优先于旧缓存与重注册，SQLite冷启保留revision和撤销。异步授权期间revision变化使旧解析失败，Native执行后再次核验Registry和授权。 |
| R-01、R-02、R-03 | PASS。授权、平台、健康、依赖、本地驻留、预算、Required、Conditional等为评分前硬过滤。用户pin不能覆盖，AI选择接口拒绝集合外ID。 |
| Registry与兼容 | PASS。复用原Sql与serializeStateWrites、同连接transaction和revision CAS，新增独立表，已有业务表未被重写。并发、冷启、幂等、禁用/pin保持、源码hash更新均有证据。仅保存定义引用/Manifest/Binding/证据，没有复制Tool Schema、Skill正文或凭据。 |
| 主进程权限与Run | PASS。生产装配沿原resolveFileWorkspace及当前active Run。真实host.start正向两Provider调用通过，伪Run、停止后的旧Run、归档会话及冷启旧Run均拒绝。输入authorized字段不能成为授权。 |
| P-01既有Tool行为 | PASS。原Hana源码和workspace-files源码没有本阶段业务重写，Adapter直接包装原实现。Node专项原Tool结果断言通过，Hana14项与Office边界12项已有真实报告通过。 |

本阶段没有新增Agent Loop、Task真源或Permission真源。生产主进程内部能力服务尚未暴露成模型Tool或renderer IPC，Phase2 Dispatcher须继续复用原Tool execution boundary和Task/Journal admission。

## 修复关闭

- G1-F01原位置为registry.ts第71–78行。现事务内以protocolHash比较既有Definition，任何内容变化返回capability_definition_immutable，专用revokeCapability仍可撤销。独立9项探针确认Required、两个schema refs和版本替换拒绝且原数据保持。
- G1-F02原位置为validation.ts第35–39行。现providerNamespace将native、mcp、extension等类型绑定各自前缀，native还须官方身份。独立探针确认外部占用内建ID失败，合法mcp Binding映射核心能力仍可注册，空证据仍被Required过滤。

## 已查看的其他证据

实施Agent最终npm run build已exit0，日志C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-phase1-build-final.log包含tsc、main/preload/renderer构建完成。本审查读取日志，未独立重建out。

已读取renderer-components日志的passed=246、total=246。已读取原Hana工具14/14、Pi/Office文档边界12/12、OmniEduStore冷启/事务8/8报告，success均为true。这些为实施Agent执行证据，本审查未重复运行这些suite。

root确认前一候选完整legacy Electron回归207/207通过，其构建在两项定向协议修复之前。该历史完整回归范围保持原身份，本报告不将其标成最终修复后全量重跑。

git diff --check本审查执行exit0，有既有vendor文件LF/CRLF提示。构建过程会刷新vendor生成物，最终Git整合及无关改动保留由root负责。本Agent未修改生产源码、未commit、未push。

## 性能与保留边界

独立32项运行中，100次Resolver均值0.449259ms。对同一合成文件交错50次，原Hana均值1.466764ms、P95 1.7767ms，Adapter均值2.698114ms、P95 3.2573ms。新增层均值开销约1.23135ms，包含真实SQLite和授权/撤销重验。原命名Tool入口保留，本阶段没有教师页面或真实模型时延对照。

Registry当前以稳定Capability ID保存一份已发布Definition。register拒绝隐式版本替换是Phase1的安全保护。合同升级与多版本并存尚未实现，后续显式可信迁移须在稳定ID下保留旧version Definition、Binding及Task引用，新Binding选用新version，破坏变更提升Major。本结论没有将稳定ID定义为永远无法演进。

R-04任务内回退、R-05长期默认策略、Phase2动态Dispatcher/Pi刷新/Snapshot、后续权限统一/审批/Effect恢复按其阶段验收。Phase0 F01终端scope、F02 MCP hints、F03审批重启、F04 Effect metadata继续OPEN。整系统P0、真实教师页面、打包安装、Office视觉和真实模型质量未由Gate1验收。

回滚保留本地资料、旧业务表、Run/Task和原工具。可撤回本阶段接线及capabilities模块，新增Registry表可保留供再次升级读取，不需要删除教师数据。
