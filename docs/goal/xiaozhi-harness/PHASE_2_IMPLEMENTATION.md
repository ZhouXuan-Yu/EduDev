# Phase 2 实施合同

2026-11-12，基线 `ab59604cf9937818ed387def21e737ade12264df`。Gate1 已 ACCEPTED。总控已释放 Phase2 生产写入，范围为 T2.1–T2.4，随后交独立 Gate2。当前 Goal 编号采用 Phase0–8。

## 教师可见结果与真实接缝

Pi 同一任务可通过稳定能力入口发现、解析并调用已验证的本地文件元信息 Provider。新能力在工具之间的安全点激活，当前 Task、Run、Pi Session 和既有成果延续。执行记录关联 Provider、软件版本、Contract 版本及 Registry Revision，撤销和当前工作区授权实时生效。

现有链路为 `production-host.execute → createPiXiaozhiSession → customTools → createToolExecutionBoundary → beforeDelivery → admitClassroomOrTaskTool / taskRuntime.admit → eventJournal.admitTool → Tool.execute`。Phase1 的 Registry/Resolver 和两个真实 Native 元信息实现已通过主进程试点。Phase2 将其纳入同一 Pi 调用链。

关键源码接缝为 `xiaozhi-agent/tools/execution-bound.ts`、`tools/manifest.ts`、`tasks/plan-runtime.ts`、`tasks/tool-envelope.ts`、`events/publisher.ts`、`events/journal.ts`、`pi-session.ts` 和 `production-host.ts`。`publisher.persist` 已提供同一 Journal owner 围栏和写队列，可复用来持久化 Provider Snapshot。

## Pi 1.0.2 核验

锁定 `@earendil-works/pi-coding-agent` 1.0.2。`dist/core/agent-session.d.ts:412` 的公开 `setActiveToolsByName` 只激活已注册工具，变更在下一 Agent turn 生效。`agent-session.js:1084` 对应实现通过既有工具 registry 组装 loadout。当前 Session 的 `customTools` 在创建时提供，任意新增 Definition 的热注册属于内部机制。

本阶段采用预注册、稳定 Schema 的 Bootstrap/Dispatcher，Provider 在主进程 Registry 内动态解析。同 Session 中的 Provider 激活无需修改 Tool Definition。Session 重建与续接专项继续核对同一 Task/Run 所有权和 SQLite 快照，公开 API 证据随测试归档。

## 交付切片

### T2.1 统一 Provider 合同

在 capabilities 领域新增共享主进程执行合同及严格校验，覆盖输入、结果、错误、取消、幂等、副作用、provenance。可信上下文由宿主闭包构建，关联 Task、Run、generation、callId、Snapshot、当前授权引用和预算。辅助只读调用允许空 stepId，沿原 Task admission 的 safe_read 规则执行。

Native Adapter 继续调用原 Hana `office_file_stat` 与 `createWorkspaceFiles.stat`。Provider identity、软件版本和 source hash 与实际可用实现绑定，数据规范化后执行 Contract 校验。read-only 试点使用原 Execution Boundary 的 safe_read 资源和取消策略。

### T2.2 稳定入口与执行边界

新增有限的 `capability_inspect`、`capability_resolve`、`capability_execute` 内置入口。核心业务 Tool 保持原名称、Schema 和具体实现。三个入口通过既有 customTools、Manifest、Task admission、Journal admission 和 Execution Boundary 装配。

当前 `capability_execute` 的支持范围为已验证 safe_read Native Adapter，副作用级别由主进程 Adapter 决定。任何后续写入 Adapter 的接入须有独立的效应分类和已有业务准入映射。模型输入只包含需求/业务参数，Task/Run/Grant/Snapshot 授权由宿主构造和读回。

### T2.3 Task/Run Provider Snapshot

新增版本化 Snapshot 类型和本地 SQLite 附属表，记录 snapshotId、taskId、sessionId、runId、generation、registryRevision、Provider ID/软件版本/Contract 版本/source hash、需求、创建时间和证据引用。通过现有 Sql/transaction/serialized writer 和 publisher owner 围栏保存，Task 与 Journal 继续使用原事实来源。

Registry 增量增加不可变 Provider 版本记录，兼容 Phase1 单一当前记录并回填旧 Manifest/Binding 元数据。当前指针与历史版本分离。相同软件版本的来源或 Contract 声明变化执行失败关闭，可信内建包的软件身份随实际代码 digest 区分。Capability Definition 的发布版本仍保持不可变，显式 Contract 升级与多版本共存需要保留旧 Definition/Binding/Task 引用的可信迁移机制。

### T2.4 安全刷新

刷新发生在当前任务的能力解析/执行安全点。所需能力由缺失转为已验证可用时创建新 Snapshot。无关 Provider 的 Registry 变化保持当前选择及 Snapshot。普通 Provider 升级保留当前 Run 已选软件版本和 source hash，新 Run 可选择当前版本。

每次执行重读全局/版本撤销、当前健康和实际 scope。历史 Snapshot 仅作选择事实。旧代码 artifact 可用时使用其精确 identity，旧实现不可用时返回可诊断结果，再在安全点选择满足剩余需求的兼容 Provider。活动有副作用调用的锁和原 Execution Boundary 结束前保持原选择。

## 计划修改文件与迁移

- 新增 capabilities 领域的 Provider 执行合同、Snapshot Store、Dispatcher、任务级 Runtime，按领域职责拆分。
- 扩展 `capabilities/registry.ts` 的历史版本保存和查询，调整 Native Adapter 与 Resolver 的版本核验。
- 对 `session-state.ts`、`production-host.ts`、`pi-session.ts`、`tools/manifest.ts`、`education-tool-catalog.ts` 作薄接线。Task envelope/admission 如需调整，仅覆盖新增稳定入口的实际 effect。
- 新增 Phase2 真实 SQLite/Provider/Boundary 专项及真实 Pi+loopback SSE+生产 host 专项。
- Schema/Tool Schema/Skill 正文/凭据继续由原模块持有，Registry 和 Snapshot 保存元数据及引用。

## 验收矩阵

覆盖 P-01–P-05、R-01–R-06 和 Gate2 的当前阶段接缝。

1. 两个真实 Native Provider 经 `capability_execute`、原 Execution Boundary、Task/Journal admission 成功完成，同一 Task 的 auxiliary read 可直接执行。
2. 无效输入、失效 Run/generation、伪造 Snapshot/Provider ID、来源不符、Required/Conditional 缺口、越权路径及撤销被阻止。
3. 统一结果/错误/取消/副作用/provenance 严格校验，重复 callId 幂等，失败输出安全且可追溯。
4. 与当前任务有关的新 Provider 在同 Pi Session 后续安全点可用，Task/上下文/成果保持。
5. 无关 Provider 变化保持 Snapshot，普通升级保持当前 Run 的旧 version；撤销立即覆盖旧 Snapshot，新的 Run 可选择已验证新版本。
6. 实际旧 Phase1 SQLite 副本与新数据库迁移、冷启 Snapshot readback、版本不可变、CAS/并发、失败回滚通过。
7. 锁定 Pi API 的真实本地 SSE 集成、停止、重启与旧 Run 拒绝通过，真实付费请求保持 0。
8. 运行 build、renderer-components、原能力32项、原工具14项、Task/SQLite 与相关 Pi 边界回归，记录精确命令/通过数/失败/跳过/范围。报告前后耗时、Schema 请求负担及主进程影响。

## 恢复与回滚

迁移采用新增表和幂等回填，保留 Phase1 当前 Registry 文档与原 Task/Run/Journal。失败事务保持原 revision 和旧 Snapshot。回滚 Phase2 接线可恢复 Phase1 路径，新增历史版本/Snapshot 表保留供后续兼容读取。真实教师文件与已确认成果沿原事实来源保存。

Phase0 F01–F04 的权限、审批和恢复修复仍按 Phase3/6 的边界实施。页面与最终系统验收按 Phase7/8 实施。Gate2 通过后由总控继续下一阶段。

## 实施结果与审查修复

本轮采用 `provider-contract.ts`、`provider-snapshots.ts`、`runtime.ts`、`dispatcher.ts` 拆分统一结果、持久选择、Task 生命周期和稳定工具入口。Native 只读实现拆为 `native-stat-contract.ts`、`native-stat-artifact-entry.ts`、`native-stat-executable.ts`、`native-stat-require.ts`，原 `native-stat.ts` 保持注册与执行编排。现有生产 Host、Pi Session、Boundary、工具 Manifest、工具目录和 Session Store 仅增加对应领域接线。

- G2-F01 修复为精确 `{providerId, version, hash}` executor 映射与保留 Artifact。当前 Run 的旧实现缺失时返回结构化错误并保留旧 Snapshot，显式 `refresh:true` 在安全点记录链接到旧 Snapshot 的新选择。真实 V1/V2 MIME 不同，旧实现移除后未调用新实现。
- G2-F02 用 esbuild 生成实际执行闭包的 CJS bytes 和 22 文件 source manifest。规范化和 `fileVersion` 依赖的真实修改分别改变 digest。反例覆盖伪造 descriptor/hash 与同版本来源替换。
- G2-F03 本次统一结果使用实际执行后重新验证的 conformance。历史 full Snapshot 保留选择事实，Optional MIME 证据撤回后本次结果披露 partial，Required 证据撤回在 IO 前阻止执行。
- Snapshot 保存事务核对当前 Registry revision、真实 Provider/Binding/version/source、需求与 conformance。读取同时核对 JSON 和行索引中的 task/session/run/generation/capability/snapshotId，真实 SQLite 跨 owner 合法 JSON 与匹配 hash 错置被拒绝。
- G2-F04 独立审查实际复现 retained Artifact 从 DataRoot 同名 npm 包执行无害 marker，证据位于 `%TEMP%/xiaozhi-gate2-loader-probe-40387a75fb284314af5efe6283700c4b`。当前机器拥有 home/global 依赖，缺依赖新机情形未实测复现。修复后由应用模块自己的路径定位安装根，仅准许固定 builtin、Electron 和 `ipaddr.js`/`undici`/`jsdom`，通过绝对应用包目录与 realpath 校验加载，拒绝 Artifact 相对路径、任意包名和 app 包缺失时的祖先搜索。生产专项采用真正仓外 TEMP dataRoot，清除子进程 NODE_PATH，并放置三个同名 marker 包验证精确 V2 冷启和零 marker 执行。

## Artifact、依赖与部署边界

当前生成文件为 `native-stat-0c327b73170a428d809b7239406b2e53ef931887a88826a01ad025ad96036831.cjs`，88562 bytes，软件版本 `1.0.0+0c327b73170a`。manifest 为 3895 bytes。`electron.vite.config.ts` 将两者及已有 Apache-2.0 Hana LICENSE 10951 bytes 复制到 `out/main/capability-artifacts`，合计 103408 bytes。经 main-only loader 验证文件类型、大小、descriptor、实际 bytes hash 后，用 `vm.compileFunction` 编译所读取的同一 bytes，再注册 opaque executable witness。

安装后的精确版本另保留于 `dataRoot/capability-artifacts`，以 hash 命名 bytes 与 descriptor。Registry 历史版本、Snapshot 和保留文件共同支持原版本冷启。丢失或损坏时失败关闭，当前 execute 不隐式改用新版。新 Artifact 安装后保留旧版本的实际实现，撤销仍覆盖缓存。

源码 hash 覆盖 Provider 执行闭包的本地 22 文件。Node/Electron runtime、主进程授权/loader 与安装目录中的既有 npm 依赖属于可信应用基线。现有锁定依赖为 `ipaddr.js@2.2.0`、`undici@7.24.7`、`jsdom@29.0.2`，许可证沿用已有包与分发流程。本轮未新增 npm 依赖，安装体积增量为上述 Artifact 资源。第三方代码经受控应用 resolver 获取，DataRoot 对 npm 搜索路径无控制权。

开发源目录与 `out/main/capability-artifacts` 安装资源布局副本实际加载并执行相同 bytes/hash/version。完整安装包、asar 与最终桌面分发回归留 Phase8 验证。现有应用打包配置保持原值。

两份仅本轮迭代生成、当前 manifest 和发布历史均未引用的候选 CJS 已从 source generated 移至 `%TEMP%/xiaozhi-phase2-unpublished-artifact-candidates`，原 SHA 分别为 `646bbd2e2e69d43181c2299a3b0350ad9ed81b5dff938cc5b7a0a5ea7cbcb395` 与 `8fddc9025b580870d8b2596898cc36cd0d18028c82e7c7ad9ce9ec9c05ec627d`。正式 generated 保留当前 manifest 与单一引用文件。测试数据库、实际保留版本缓存、失败日志及旧实现缺失反例现场均继续保留。

## 已执行验证

所有命令在 `D:/WorkProject/EduProject-harness/apps/desktop` 执行。`%TEMP%` 指当前 Windows 用户 TEMP，以下报告保留原始结果。

| 命令 | 结果 | 日志或报告 |
| --- | --- | --- |
| `npm run build` | PASS | `%TEMP%/xiaozhi-harness-phase2-build-final.log`、`xiaozhi-harness-phase2-build-freeze.log`，G2-F04 修复后另执行 `xiaozhi-harness-phase2-build-loader-final.log` |
| `npm run test:renderer-components` | 246/246 PASS | `%TEMP%/xiaozhi-harness-phase2-components-final.log` |
| `node scripts/xiaozhi-agent/capability-phase1-smoke.mjs` | 修复后 32/32 PASS | `%TEMP%/xiaozhi-harness-phase2-phase1-loader-final.log`，`%TEMP%/xiaozhi-capability-phase1-Ml2Mc3/report.json` |
| `node scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs` | 修复后 10/10 PASS | `%TEMP%/xiaozhi-harness-phase2-contract-loader-final.log`，`%TEMP%/xiaozhi-capability-phase2-contract-g4Timf/report.json` |
| `node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs` | G2-F04 前 23/23 PASS | `%TEMP%/xiaozhi-harness-phase2-production-final.log`，`test-results/xiaozhi-agent/capability-phase2-production-ssibl6/report.json` |
| `node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs` | G2-F04 最终 24/24 PASS，exit 0 且 success=true | `%TEMP%/xiaozhi-harness-phase2-production-loader-final.log`，`test-results/xiaozhi-agent/capability-phase2-production-u0XeWR/report.json` |
| `node scripts/office-agent/hana-tools-smoke.mjs` | 14/14 PASS | `%TEMP%/xiaozhi-harness-phase2-hana-final.log`，`test-results/office-plan/hana-tools-cL3lJb/report.json` |
| `node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs` | 12/12 PASS | `%TEMP%/xiaozhi-harness-phase2-office-boundary-final.log`，`%TEMP%/xiaozhi-office-boundary-0Fi7Kp/report.json` |
| `node scripts/xiaozhi-agent/pi-goal-task-store-smoke.mjs` | 8/8 PASS | `%TEMP%/xiaozhi-harness-phase2-task-store-final.log`，`test-results/xiaozhi-agent/pi-goal-task-store-hAMtp8/report.json` |
| `node scripts/xiaozhi-agent/capability-phase1-production-smoke.mjs` | 8/8 PASS | `%TEMP%/xiaozhi-harness-phase2-host-regression-initial.log`，`test-results/xiaozhi-agent/capability-phase1-production-MvPqsU/report.json` |

真实 Pi 生产专项使用锁定 Pi 1.0.2、原 Host.start/continueTask 和本地 SSE，包含同 Session 新 Provider、同 Run 保留旧实际实现、显式刷新、新 Run 新实现、冷启、撤销、实际 IO 取消、旧 Run 围栏与原 Journal receipt。真实付费模型请求为 0。完整 smoke 207 按总控安排在 Phase8 集中运行。

真实旧 Phase1 数据库来自 `test-results/xiaozhi-agent/pi-goal-task-store-aO7hbr/data/app.db`，在独立副本中迁移。原 revision 2、两 Provider 1.0.0、四组业务/Task 查询及九条 Task facts 保持一致，旧版本回填与撤销 tombstone 保持，新增 Snapshot 空表正确创建。另有新库、事务回滚、并发无关 Registry revision 与篡改检测覆盖。

## 性能与失败记录

G2-F04 前完整 production 通过报告 `ssibl6` 的 dependency-only 变体首次 Artifact 载入为 2.6636 ms，此时应用依赖已经由 Host 初始化。安装布局副本真实 Native 30 次调用均值 5.80469 ms，P95 6.9978 ms。带三秒人为延迟的真实 IO 取消测试中 stop receipt 为 88.3489 ms，底层实际 settle 为 3011.3843 ms，迟到成功未越过 Run 围栏。

G2-F04 修复后的原 Phase1 专项交错测量同一合成文件，直接 Native 50 次均值 1.391404 ms、P95 2.3348 ms，适配调用 50 次均值 3.43256 ms、P95 5.7713 ms。SQLite Resolver 100 次均值 0.732285 ms。不同执行轮次与机器并行负载影响这些耗时，报告未据此推断模型响应速度或 UI 性能。

三个稳定 Bootstrap Tool 的 model function Schema 合计 UTF-8 JSON 2098 bytes，其中 inspect 272、resolve 770、execute 1052 bytes。使用 `register-source.mjs` 读取实际 `createCapabilityDispatcher` 定义测得，原始输出为 `%TEMP%/xiaozhi-harness-phase2-bootstrap-schema-size.json`，统计仅涉及 Schema 字节，未运行 tokenizer。Provider 安装和刷新继续复用这三份 Schema。

保留的失败包括初轮 Phase1 错误码排序回归、production `tqzIE6` 的 receipt 表名错误、`zDwAdM` 将无写计划只读 Task 用错误 resume-card 入口续接，以及 `wDTxNd` 对新增官方 Provider 更新未传真实 opaque executable witness 导致 `source_untrusted`。fixture 分别修正实际查询、既有 Composer continueTask 入口和已验证 Artifact witness，生产来源校验保持严格。相关原始日志位于 `%TEMP%/xiaozhi-harness-phase2-phase1-regression-initial.log`、`%TEMP%/xiaozhi-harness-phase2-production-initial.log`、`%TEMP%/xiaozhi-harness-phase2-production-round2.log`、`%TEMP%/xiaozhi-harness-phase2-production-round3.log` 与各测试目录 worker.log。退出码 0 但报告 success=false 的早期轮次均计 FAIL，runner 现同时核对退出码、report.success 与每项检查。

G2-F04 首轮修复专项 `h4DsjS` 已通过 23 项检查，包括仓外精确 V2 冷启与零 marker，随后在最后 Task 续接步骤撞到整套 runner 150 秒预算。该轮报告为 FAIL，进程 exit 为 null，原始日志保留 `%TEMP%/xiaozhi-harness-phase2-production-loader-fix.log` 与目录 worker.log。同期有本树 TypeScript/build 与另一工作树 tsc 并行。最终重跑调整的仅为专项 runner 外层预算 240 秒，产品 Run/Tool 预算保持既定值，等待本树 build 完成后串行运行，并在每项记录 elapsed 与分段耗时。

最终 `u0XeWR` 通过 24/24，进程 exit 0、报告 success=true。实际仓外 dataRoot 为 `%TEMP%/xiaozhi-phase2-user-data-R0S0rS/data`，三个 marker 包均零次执行。检查总耗时 154993.44 ms，最后 Composer 同 Task 续接用时 18216.61 ms，逐项分段时间见 report.checks。dependency-only Artifact 首次载入 2.2353 ms，安装布局副本 Native 30 次均值 7.48263 ms、P95 8.6477 ms，stop receipt 88.0605 ms，人为三秒底层 IO settle 3015.6104 ms。实测总套件耗时超过旧 150 秒预算，增加外层 fixture 预算未被解释为业务响应加速。

G2-F04 最终 build exit 0，renderer 构建部分为 57.48 s。`SOURCE+OUT_FROZEN` 之后保持生产/测试源码和 out 不变，完整 29 个本轮生产/测试/构建文件及 out/main 哈希位于 `%TEMP%/xiaozhi-harness-phase2-source-out-freeze-loader-final.json`。`git diff --check` exit 0，日志 `%TEMP%/xiaozhi-harness-phase2-diff-check-final.log`。独立 Gate2 由总控安排，实施报告不代替独立验收结论。

回滚恢复 Phase1 的生产/Session/工具接线并重新构建。新增两表为附属事实，保留供后续兼容与审计读取。禁止为了回滚覆盖教师文件或删除历史版本、Task 与 Snapshot。当前 Definition 新 contractVersion 的可信升级/多版本共存尚需专门迁移机制，已发布同版本语义持续不可变。Phase0 F01–F04 仍待后续 Phase3/6 修复。
