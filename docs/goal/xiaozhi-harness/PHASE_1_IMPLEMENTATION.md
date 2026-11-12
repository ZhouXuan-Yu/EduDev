# Phase 1 实施合同

基线为 d50ef330，范围为 T1.1–T1.4。新增 capabilities 领域的版本化合同、严格运行时校验、SQLite Registry、确定性 Resolver 和只读 Native 文件元信息试点。一个 `edu.workspace.file.stat` Capability 绑定现有 Hana `office_file_stat` 与现有 `createWorkspaceFiles.stat` 两个真实实现。原工具及业务逻辑保留。

Registry 复用 session-state 的 Sql、串行写入和增量 migrate，仅持久化定义引用、Provider Manifest、Binding、验证证据及 revision。Tool Schema、Skill 正文和凭据继续由原模块持有。主进程依照现有 resolveFileWorkspace 校验授权，模型和 renderer 不持有授权布尔字段。

验收覆盖严格对象校验、来源和哈希、多个 Provider、Required/Optional/Conditional、Contract/平台/健康/依赖/预算/权限/撤销硬过滤、偏好和 AI 越界拒绝、真实 SQLite 重启与并发、真实 Native 文件读取及撤权、原工具回归、build 和 renderer-components。Dispatcher、动态 Pi 刷新及新权限系统按后续 Phase 实施。

新增表采用 CREATE TABLE IF NOT EXISTS，与既有业务数据分离。回滚可撤销本轮源码并保留新表，原表和资料均不迁移。测试仅使用临时合成资料。性能记录确定性 Resolver 的实测开销，当前 Phase 尚无生产 Dispatcher 前后对照。

独立Gate1最终ACCEPTED，受审源码哈希及独立32/9/8证据已归档于evidence/phase1/final。

## 实际实现

- `apps/desktop/src/main/xiaozhi-agent/capabilities/types.ts` 定义版本化 Capability、Provider、Binding、Conformance、Requirement、Resolution。
- `validation.ts` 严格校验字段、命名空间、版本、哈希、证据及 Resolution 集合一致性，复用已有安全输入快照拒绝访问器。
- `registry.ts` 通过原 Sql、同连接 transaction、serialized writer 和 revision CAS 保存单一元数据快照，文档哈希用于读回完整性校验。新表为 `xiaozhi_capability_registry_v1`。已发布 Definition 由 Provider 注册入口执行内容不可变校验，生命周期撤销采用专用 API。合同升级和多版本并存留待显式可信迁移机制。
- `resolver.ts` 从当前 Registry 重读并硬过滤，重新计算任务相关 Conformance，在合格集合内按用户固定、priority 和稳定 ID 排序。Optional 及未触发 Conditional 缺口随结构化结果披露。AI 选择接口返回同一合格集合中的权威元数据。异步授权过程中 revision 改变会要求调用方重新解析。
- `native-stat.ts` 包装既有 Hana `office_file_stat` 与 `createWorkspaceFiles.stat`，将真实相对路径、大小、版本归一为同一 Contract。Hana 提供额外 MIME，工作区实现披露 MIME 缺口。生产装配核对当前原生代码来源哈希、现有主进程工作区授权及 active Run，执行后重验授权/Registry。
- `session-state.ts` 接入既有初始化迁移与内建注册。`production-host.ts` 增加主进程内部能力服务，授权仍通过原 `host.resolveFileWorkspace` 和当前 Run。
- 三个 `scripts/xiaozhi-agent/capability-phase1-*` 文件提供协议/真实 SQLite 专项及真实 Electron 生产接线专项。

## 独立审查第一轮修复

G1-F01 曾允许另一个 Provider 用同 ID、同版本覆盖已发布 Definition。已在事务内拒绝 Definition 内容变化，覆盖 Required、inputSchemaRef、outputSchemaRef 和版本替换反例，失败时原 revision/Definition 保持，空证据外部 Provider 仍被 Required 硬排除。

G1-F02 曾接受占用 `edu.native.*` ID 的非官方 MCP Manifest。现按 Provider type 校验命名空间，内建 Native 要求官方身份，外部 Provider 经验证 Binding 关联核心 Capability 的路径保留。独立 reviewer 已对两项 delta 复跑 9/9，通过证据位于 `%TEMP%/xiaozhi-gate1-review-b69570ddeb97466dbfd5048764e11919/fixed-probe-report.json`。

## 当前测试证据

所有命令在 `D:/WorkProject/EduProject-harness/apps/desktop` 执行，测试资料均为合成临时文件。真实模型请求累计 0。

| 命令 | 结果 | 证据 |
|---|---|---|
| `node scripts/xiaozhi-agent/capability-phase1-smoke.mjs` | PASS 32/32 | `%TEMP%/xiaozhi-harness-phase1-protocol-repair1.log`，`%TEMP%/xiaozhi-capability-phase1-sWaQ1N/report.json` |
| `node scripts/xiaozhi-agent/capability-phase1-production-smoke.mjs` | PASS 8/8 | `%TEMP%/xiaozhi-harness-phase1-production-repair1.log`，`test-results/xiaozhi-agent/capability-phase1-production-XNRFKS/report.json` 与 `worker.log` |
| `npm run test:renderer-components` | PASS 246/246 | `%TEMP%/xiaozhi-harness-phase1-components.log` |
| `node scripts/office-agent/hana-tools-smoke.mjs` | PASS 14/14 | `test-results/office-plan/hana-tools-SyCWGu/report.json` |
| `node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs` | PASS 12/12 | `%TEMP%/xiaozhi-office-boundary-qBTKt7/report.json` |
| `node scripts/xiaozhi-agent/pi-goal-task-store-smoke.mjs` | PASS 8/8 | `test-results/xiaozhi-agent/pi-goal-task-store-aO7hbr/report.json` |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS，exit 0 | `%TEMP%/xiaozhi-harness-phase1-typecheck-repair1.log` |
| `npm run test:smoke` | 第一轮修复前候选 build PASS，综合 Electron PASS 207/207 | `%TEMP%/xiaozhi-harness-phase1-build-smoke.log`，截图 `test-results/electron-e2e/` |
| `npm run build` | 第一轮修复后最终 build PASS，exit 0，含 tsc/main/preload/renderer | `%TEMP%/xiaozhi-harness-phase1-build-final.log` |
| `git diff --check` | PASS，exit 0 | Codex 本轮工具记录 |

真实生产接线 8 项覆盖原 Store 初始化、当前工作区授权、伪造 Run 拒绝、`host.start` 的 active owner 双 Provider 成功调用、锁定 Pi 经 loopback SSE 完成、停止后拒绝、归档后排除及冷启旧 Run 拒绝。页面验收按后续阶段执行。

## 性能与兼容

最近一次 100 次 Resolver 测量总计 40.0757 ms，均值 0.400757 ms。对同一合成文件交错运行 50 次原 Hana 元信息 Tool 和 50 次 Phase1 Adapter，原 Tool 均值 1.379952 ms、P95 1.8414 ms，Adapter 均值 2.732374 ms、P95 3.2019 ms。Adapter 测量包含真实 SQLite 解析及多次主进程授权/撤销重验。教师页面和真实 provider 的延迟测量按后续阶段执行。

旧数据库增量建立单一新表，原有业务表及资料保持原数据。真实 OmniEduStore 冷启、事务回滚及重启确认专项 8/8 通过。内建注册幂等，冷启保留 Registry revision、撤销 tombstone、用户固定和禁用状态。可信内建包来源哈希更新时刷新 Binding 并保留本地偏好。

## 失败记录与剩余范围

初次 TypeScript 检查发现 7 处可选值收窄错误，已修正。首次 Node source-loader 检查遇到静态 import 先于 hook 注册，测试入口已改为既有动态加载方式。两个原回归脚本首次因隔离工作树的 `test-results` 父目录缺失失败，建立测试输出目录后均重跑通过。原失败保留在 Codex 工具记录。

Phase0 F01–F04 权限、审批和恢复缺口继续按 Phase3/6 处理。第一轮修复后协议专项 32/32、生产接线 8/8 均零失败、零跳过，最终构建通过。207 项综合回归来自第一轮修复前候选构建，修复后的独立Gate1生产接线8/8、协议32/32与定向探针9/9均已通过。

## 回滚

撤销本轮 capabilities 源码、session-state/production-host 接线与专项测试即可恢复原调用链。新表可保留供重新升级读回，回滚过程保留教师资料、原表、Run/Task、原 Tool 和旧 Pi Session。发布合同的版本升级与共存应通过后续显式迁移保留旧 Definition、Binding 和 Task 引用。
