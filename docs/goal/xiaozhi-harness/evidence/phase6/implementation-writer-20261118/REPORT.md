# Phase6 implementation side final handoff

状态为 SOURCE_DONE / WAIT_INDEPENDENT_GATE6。此报告记录实施侧证据。独立验收、模块 Git 和远端整合由 root 负责。

工作树为 `D:/WorkProject/EduProject-harness`，基线为 `0f753e572cbdfa20eaaf130a0f7b23d32e8ac2b8`。实际付费 provider 调用为 0。全部模型响应来自 owned loopback SSE，业务文件与数据库来自合成测试根。

## 最终身份

`freeze.json` 包含完整逐文件 bytes 与 SHA-256。

| 范围 | 数量 | 列表 SHA-256 |
| --- | --- | --- |
| desktop 生产源码、共享契约、helper、构建与依赖输入 | 1697 | cbae410aa2999ee0b6ce8621cb6239cd9bf43dd31045c0c4053eff5780138912 |
| Phase6 专属脚本 | 25 | 2e1aadf74663585ade89b643f9e5fb5d6ffe3f3f6fbf9bf891321607009115d2 |
| 验证脚本及其仓库脚本依赖 | 1386 | 28b5789d964e49c56adbc94daa60345b01e7278790282c0f4d8b3afe5aa7b000 |
| 最终 out | 478 | 0d55a2c48707128e75ad75077177ecb8d4d4b78faf01e6e7df3581778ae556ad |

freeze 文件本身 SHA-256 为 `31b80e2afff5831b39d9ce0d4ad6e59e53dfd4c5da492ee964eb5b637d9a6c85`。独立 Phase8 准备脚本及 root 状态文件另行维护。

原 core manifest 实际核对 617 个输入，sourceHash 为 `1ec5576c70f76863b61e0f77fb5ad7369fd9dff7c64db06adbd938d866f5c00d`，逐项漂移为 0。

`pins.json` 已真实校验 helper、九个 C# 源、adapter、TrustedRuntimes、native-stat bundle 和其 22 个输入。

- helper 为 58880 字节，SHA-256 为 `f68e8cb75f0b7cb0f8d1a0eae491163aea3545044d8b491ebef5e6266be079e8`。最终 build 复用此精确二进制。
- sandbox manifest SHA-256 为 `73deea186d758f1f44781deaebe50b811ce79ff179f726e03a89d6e2ae0c3bb3`。其 adapter 身份覆盖本阶段实际前台与 PTY 接线。
- native-stat bundle SHA-256 为 `bf8b322e1af99bc7c9907f0eb6e1d75d6ab620824728fef8d3f1014d4aab5274`，manifest SHA-256 为 `819aca5629e4c55fa3e4605e1c1e824af2964e75412dded68d71a34662d8a438`。
- package-lock SHA-256 为 `7feeb79907fe3a231d9f9b1d0fd3023684c739d5c791eea5b1bddf6a1b095bc9`。

## 集中回归

以下命令均在 `D:/WorkProject/EduProject-harness/apps/desktop` 执行。`RUNS.json` 提供原始报告绝对路径、字节数、SHA-256 与结果，`logs` 保存原始 stdout/stderr。

| 实际命令 | 实际结果 | 原始日志 |
| --- | --- | --- |
| npm run build | exit 0，包含全 src tsc --noEmit | build-scroll-domain-final.log |
| npm run test:renderer-components | 246/246，exit 0 | renderer-layout-final.log |
| node scripts/electron-smoke.mjs | 207/207，exit 0 | electron-smoke.log |
| node scripts/xiaozhi-agent/phase6-terminal-ui-smoke.mjs | 最终 10/10，exit 0 | actual-ui-control-label.log |
| node scripts/xiaozhi-agent/phase6-startup-recovery-smoke.mjs | 2/2，exit 0 | phase6-startup-recovery-smoke.log |
| node scripts/xiaozhi-agent/phase6-state-foundation-smoke.mjs | 8/8，exit 0 | phase6-state-foundation-smoke.log |
| node scripts/xiaozhi-agent/phase6-planning-policy-smoke.mjs | 12/12，exit 0 | phase6-planning-policy-smoke.log |
| node scripts/xiaozhi-agent/phase6-provider-resume-smoke.mjs | 12/12，exit 0 | phase6-provider-resume-smoke.log |
| node scripts/xiaozhi-agent/phase6-recovery-inspection-smoke.mjs | 13/13，exit 0 | phase6-recovery-inspection-smoke.log |
| node scripts/xiaozhi-agent/phase6-network-effects-smoke.mjs | 8/8，exit 0，7 次 loopback HTTP | phase6-network-effects-smoke.log |
| node scripts/xiaozhi-agent/phase6-native-plan-contract-smoke.mjs | 5/5，exit 0 | phase6-native-plan-contract-smoke.log |
| node scripts/xiaozhi-agent/phase6-private-history-smoke.mjs | 5/5，exit 0 | phase6-private-history-smoke.log |
| node scripts/xiaozhi-agent/phase6-terminal-renderer-smoke.mjs | 最终 9/9，exit 0 | phase6-terminal-renderer-smoke-final.log |
| node scripts/xiaozhi-agent/phase6-task-recovery-renderer-smoke.mjs | 最终 10/10，exit 0 | phase6-task-recovery-renderer-smoke-final.log |
| node scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs | 10/10，exit 0 | capability-phase2-contract-smoke.log |
| node scripts/xiaozhi-agent/pi-task-coordinator-boundaries.mjs | 16/16，exit 0 | pi-task-coordinator-boundaries.log |
| node scripts/xiaozhi-agent/pi-event-journal-boundaries.mjs | 23/23，exit 0 | pi-event-journal-boundaries.log |
| node scripts/xiaozhi-agent/phase5-governance-smoke.mjs | 11/11，exit 0 | phase5-governance-smoke.log |

仓库 `test:smoke` 的两个步骤在本轮分别实际执行。完整 207 项使用 UI 滚动修复前的 out。之后仅有 renderer 主 chunk、其引用 chunk 与 index.html 的内容地址发生变化，main 与 preload 字节完全相同。`out-before-layout-fix.json` 和 `out-delta.json` 保存前后 478 项清单及五个路径的精确差异。最终 UI 10 项和 renderer 246 项在最终 out/source 上重跑。此处保留两个输出范围。

## 原 Pi、Job 与用户路径

`LEAF_REFERENCES.json` 及 `leaf` 保全精确报告与 handoff。

- 真实 ConPTY 固定 9/9、协议 12/12。实际 Read-Host、变量、owned cwd、Unicode/ANSI、resize、Ctrl+C 后继续、exit 7、typed EOF、timeout、背压取消与 cleanup 均有原始回执。
- 原 Host 9/9 覆盖 idle 教师控制、自然消息续接原 Task/Job、旧控制者与跨 Task/session 拒绝、实际 Grant 撤销/到期、关闭与冷启历史。该报告为 cAQfE9 的原运行身份。
- 原工作流 5/5 为 mYVR7A 的原运行身份，包含 Level1 短路径、Level2 计划与 checkpoint、Level3 未齐预检仍可 safe_read、审批重启和拒绝后替代。
- 恢复 Host 四场景按原报告分轮通过，H01 为 G4Zut1，H02/H03 为 8168 重验，H04 为 9567 重验。H04 保存原 eventPersistence unavailable 与 running=false，再沿原 refreshRecords 和显式 resume 完成。未将分轮结果计作最终同字节单次 4/4。
- Job 三场景、四个 subcheck 在 7sHl0t 同一生产身份 4/4。父强停瞬间 OS 残留如实保存，冷启原 cleanup-only reaper 精确回收，投影 bytes 与目录身份保持，Effect unknown 与 projection needs_check 保留。物理 ACK 丢失与持久 ACK 后 Commit 失败各有实际链，unknown 不重送。
- 最后补证 CfKkwa 2/2 与最终 core 1ec557 身份一致。测试已移除直接调用 exported reconciler。原 Teacher review 的完整 preview 之后，main 按持久 ACK 做本地 Effect readback，再收束 Job 并完成原 Task。Teacher 阶段新增模型请求为 0，同 command 无重送，原 Scope 与 cleanup 回执保持。
- 最终实际 UI lNILQx 10/10 使用最终 built main/preload/renderer。1366×768 与 1920×1080 均实际输入 UTF8、读取 Task 恢复卡、检查停止按钮中心真实 pointer target。实际 Ctrl+C、同 Task 自然续接、typed EOF、可见 Teacher checkbox 与确认按钮、终端关闭和冷启只读历史均完成。模型总请求为 4，全部 loopback，教师本地操作和确认阶段增量为 0。四张双尺寸截图在 screenshots。

## 最后实际缺陷与收口

普通 Task 原核对组件此前仅在旧布局与 linked Goal 中消费。现在原 `taskReviewInteraction` 同时服务既有 builder 与当前页面，沿原 Task/Goal 过滤和 lastRun/origin 身份挂载。

截图复核发现新终端缺 data-edu-domain 导致既有 scoped CSS 未生效，且列表处于对话滚动区外。最后仅补两个领域根属性并把原列表移入同一 ChatConversation.Content。最终可点击断言使用 elementFromPoint，真实截图保留修复前后。原 viewport-bounds 9/9 报告保留其断言边界。

`FAILURE_INDEX.md` 保留历史真实失败与夹具错误的区别，原报告未覆盖。Task no_criteria 的旧记录保持原历史，可由教师明确同 Task 继续生成新候选再核对，旧副作用没有自动重放。

## 依赖、性能与边界

xterm 6.0.0 和 addon-fit 0.11.0 精确锁定，均为 MIT。官方包解包体积分别为 5921599 与 20727 字节，Windows 增量来自 renderer JavaScript，执行继续使用原受控 C# helper。原始许可证、metadata 与 SRI 留在 owned TEMP/xiaozhi-phase6-terminal-dependencies。

root 本轮 audit 对上述同一 lock 得到 35 项，low 8、moderate 12、high 15、critical 0，来源为 TEMP/xiaozhi-phase6-root-dependency-audit-20261118。实际可达性与既有缓存准备性能热点进入原 Phase8。当前没有可比的终端旧基线时延实验，本阶段性能证据限定为本地控制与确认零新增模型请求，以及原 source/out 字节身份。

尚未计入本报告的范围包括真实收费模型、真实教师数据、其他 OS 与本机不支持 API 的实际分支、独立 ConHost PID 采集、Phase7 视觉终验、最终打包与 Phase8 性能终验。Provider 恢复专项的 installed/authorize/execute 使用明确 metadata adapter。原 Host 专项另提供真实 Pi、core 工具与文件/PTY 业务 IO 证据。

## 回滚与接管

结构化真源继续使用原 SQLite，文件成果保留原 owned/教师目录边界。新 Effect、checkpoint 与 Job 为原 Task 的附属事实，冷启不会重放 unknown。回滚代码以本阶段基线 commit 为参照，先停止本任务运行并保留数据库和文件快照，再由 root 正常 Git 整合决定。真实数据迁移回退尚未单独执行。

生产源码、out 与本报告身份已冻结。后续独立 Gate6 接管 runtime，root 持有 Git。
