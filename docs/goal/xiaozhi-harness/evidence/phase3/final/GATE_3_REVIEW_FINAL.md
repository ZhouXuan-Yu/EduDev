# Gate3 独立验收

## 结论

**ACCEPTED**，限本轮已冻结 Phase3 范围。

审查树为 `D:/WorkProject/EduProject-harness`，HEAD 为 `ad01ec013355ec39e46a5e40ed32d5f704583e5c` 加本轮 Phase3 未提交候选。验收基于最终 `xiaozhi-harness-phase3-source-freeze-1SFFDC/freeze.json`。审查和运行完成后，80 个生产/测试/构建文件、466 个 out 文件及 11 个额外依赖均与受审清单相符，差异为 0。

本 reviewer 亲自串行运行七套专项，全部首次执行通过，共 108 项。另用自有只读脚本核对实际 SQLite 和教师合成文件。源码审查提出的 G3A-F01、G3A-F02、G3B-F01 均有定向源码修复及本轮独立运行证据。当前范围无未解决的 P0/P1 finding。

本 reviewer 未修改生产代码、测试源码、out 或 root 状态文档，未 build、commit 或 push。新增内容均在自有 TEMP。付费调用和真实模型调用均为 0。Pi 和 UI 的模型响应使用本地 loopback SSE。

## 最终身份

| 对象 | 身份 |
| --- | --- |
| 80 文件列表 SHA256 | `7498650577583eb747a0ae9f9fc851ab786b41a1dbb55381e44cfd30dd89d33d` |
| 466 out 列表 SHA256 | `b06680146509d4086c94d7671a4c05ebd3e42262ee80a60e9103551b7d9f2671` |
| 实际 helper SHA256 | `d0d1a92473cd017ef5e56a3d37940e21fc3c4f3b1a69cdf41ea1c3d217d9e56a` |
| 实际 helper 大小 | 47104 字节 |
| 额外依赖 | 11 文件，详见 `dependency-hashes.json` |
| 实施文档 SHA256 | `9030fd1e5c6f43648281b23815c380f7a0305f103ccfeb454ace6a7c1b10bd3c`，单独记录的非生产证据 |

最终逐文件核对见 `final-source-out-dependency-verification.json`。完整 80/466 文件名、字节数和 SHA256 在 `ui-fixture-retry-final/writer-freeze.json`。80 文件原件位于 `pin-repair-final/reviewed-source`，最后唯一 UI fixture delta 的原件位于 `ui-fixture-retry-final/reviewed-source`。11 依赖的原件在 `dependencies`。

11 依赖包括 package-lock、workspace authority/files、原 Task envelope、resource lock、tool timeout、输入快照，以及实际安装 Pi coding-agent 的 package/PowerShell/Bash 实现和 Pi MCP package。锁文件身份已保存。

## 亲自执行

以下命令的 cwd 均为 `D:/WorkProject/EduProject-harness/apps/desktop`，各套执行一次，产品及 fixture 预算保持冻结版本。

| 精确命令 | 实际结果 | 整套墙钟时间 | 本 reviewer 原始日志 |
| --- | --- | --- | --- |
| `node scripts/xiaozhi-agent/permission-phase3-store-smoke.mjs` | 13/13，exit 0 | 969 ms | `independent-store.log` |
| `node scripts/xiaozhi-agent/permission-phase3-windows-smoke.mjs` | helper 51/51、platform 11/11，exit 0 | 38700 ms | `independent-helper.log` |
| `node scripts/xiaozhi-agent/permission-phase3-operations-smoke.mjs` | 9/9，exit 0 | 26741 ms | `independent-operations.log` |
| `node scripts/xiaozhi-agent/permission-phase3-production-smoke.mjs` | 9/9，exit 0 | 190704 ms | `independent-main-pi.log` |
| `node scripts/xiaozhi-agent/permission-phase3-runtime-smoke.mjs` | 3/3，exit 0 | 2991 ms | `independent-runtime.log` |
| `node scripts/xiaozhi-agent/permission-phase3-approval-components.mjs` | 4/4，exit 0 | 8084 ms | `independent-approval-components.log` |
| `node scripts/xiaozhi-agent/permission-phase3-ui-smoke.mjs` | 8/8，exit 0 | 14083 ms | `independent-ui.log` |

Main/Pi 专项的 primary 进程 exit 0、耗时 167079.558 ms。预期 SIGKILL 进程 exit 1、耗时 20550.778 ms，随后独立恢复进程 exit 0、耗时 2147.688 ms。该预期 crash 属于测试断点。

各套报告原始位置如下，副本及 SHA256 索引保存在 `independent-evidence/index.json`。

- Store 为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-permission-phase3-store-Xf1e3G/report.json`。
- Windows helper/platform 为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase3-helper-final-numFhv/report.json`，同目录保留 51/11 项逐项原始日志。
- Operations 为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase3-operations-L9JFcn/report.json`。
- Main/Pi 为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/permission-phase3-production-G5tSV4/combined-report.json`，包含 primary、预期 crash 和 recovery。
- Runtime 为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/permission-phase3-runtime-Vv8FEt/report.json`。
- Built UI 为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/permission-phase3-ui-7DiOc0/report.json`。

## 决定性事实

### 权限、审批与三项修复

G3A-F01 在 `permissions/engine.ts` 按原 approved request 的有效期与重构请求有效期取交集，并在每次 assert 重验。独立 Store 项目先批准 60 秒请求，再以更长 TTL 重构并推进受控时钟，真实文件写入计数为 0，signal aborted，未生成 expired.txt。

G3A-F02 在 `permissions/store.ts` 的事务中读取真实 `xiaozhi_pi_workspaces` v1 行，再核对 session、canonical root、identity 和仅 read 的 scope。独立 Store 反例覆盖缺 v1 行、错误 session/root/identity、write 和 network 伪迁移，均拒绝。合法导入幂等，撤销 tombstone 再导入后仍保持撤销。

G3B-F01 在 `PiEducationWorkspace` 按 v2 permission 路由到独立 `PiPermissionApproval`，展示真实 action、资源动作、资料分类、TTL 和 main 冻结脱敏 summary。决定走 typed approvalId/revision/operation，旧 `decideXiaozhi` 拒绝 v2。独立 SSR 4 项及实际 built Electron UI 8 项覆盖 exec 覆盖/删除、MCP POST、旧 revision 拒绝、冻结摘要绑定、批准仅保存且无自动重放，v1 复制文案回归通过。

Store 还验证 revision CAS、相关/无关 Grant 变化、拒绝摘要去重、一次性 approval 并发消费、owner/hash 篡改、事务失败回滚、Grant 组合和活跃撤销。Profile 偏好和 renderer/model 的 authorized 或 Grant JSON 均不能产生执行权限。

### 真实文件、终端、网络与 MCP

独立 Operations 沿实际 Pi public PowerShell operations 执行合法脚本、保存真实文件、保持 exit code，验证 sibling 字节读取与直接 loopback 被 OS 拒绝、取消丢弃投影变动、原件 CAS 保留并发教师编辑。网络 broker 在实际 HTTP 前分别核 network 与 teacher-private egress，未授端点保持 0 次。公开 16384 字符与 Unicode codepoint 边界均通过，内部固定 prefix 的更大协议边界单独约束。

Windows helper/platform 实际运行当前 d0d1 helper，保留原 10000 ms 基础 fixture 预算，覆盖 PowerShell 5.1 及可用 7、复杂脚本/中文/退出状态、deadline/process/output、继承 handle、子进程、父进程结束、cleanup-owned 身份反例和 owned ACL/profile 清理。平台诊断实际核验 Microsoft catalog/embedded 信任，并覆盖环境伪造、变更/未签名字节、reparse 和缺 runtime。

Main/Pi 专项使用真实 Electron、OmniEduStore、production-host、原 Pi/Task/Journal 和本地 SSE。实际 v1 pending 冷启后可保存批准，无 waiter 时沿显式入口继续。已有 Task 的 v1 审批在同一 Task 下建立新 Run/generation。正常关闭和实际 SIGKILL 后 pending/approved 仍在，冷启未自动重放 shell 或业务文件。

MCP readOnlyHint 的恶意 fixture 实际写后报错，真实调用次数为 1，Journal 记录 maxAttempts=1 和 effect=unknown。活跃撤 server 后对应 MCP Grant tombstone 持久化，后续 IO 阻断。此项通过实际 Main/Pi 执行路径验证。

本 reviewer 另执行 `node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate3-review-b21bfeae77904e98b0d379a051ed8ab6/read-main-facts.mjs`，只读连接自身 fixture 的真实 app.db。独立读回 main-result.txt 为 `owned-main`，legacy-result.txt 与 same-task.txt 均为 `synthetic`。SQL 读回 pending/approved/executed、MCP revoked=1，以及失败 MCP 的 effect=unknown/maxAttempts=1。原始结果在 `independent-main-readback.json`。

### Environment 与 UI

Runtime 专项只模拟旧 shipped pin 元数据，实际 Microsoft 离线信任诊断、固定 Framework compiler/source recipe、helper 字节、AppContainer health、原子 active pointer 和冷启 receipt 均真实执行。错误 source recipe 保留原 active pointer。Store 的实际配置修复覆盖 expected hash CAS 和未知私有字段保留。

UI 专项启动实际 built main/preload/renderer，通过 typed IPC 验证范围和模式读回、撤销、环境诊断、冷启及修复后的审批会话卡。1366×768 与 1920×1080 模式控件可达。目录选择采用 main dialog 受控 fixture，MCP 配置沿原 typed preload。主进程 source-bundled Pi 专项与 built UI 证据分别记录。

## 读取的实施证据

以下属于读取的 writer 日志和报告。本 reviewer 本轮未重复执行这些回归。

- 最终 `npm run build` 的 `xiaozhi-harness-phase3-build-pin-final.log` 完成，最终 out 与独立实测身份一致。
- `xiaozhi-harness-phase3-regressions-final.json` 的九个精确命令及其尾部实际结果已读，MCP 29、Phase1 32、Phase2 contract 10、Phase1 production 8、Phase2 production 24、Hana 14、Office boundary 12、Task store 8、terminal cancellation 5 均通过。
- 246 renderer components 为 writer 报告的最终回归，本 reviewer 未执行该整套。
- 207 总 smoke 属于前候选 209aea helper 身份。最终 d0d1 候选以本轮定向专项为据，完整最终总回归留 Phase8。
- root 实际 npm audit 为 auditReportVersion 2，28 个既有 advisory，low 8、moderate 12、high 8、critical 0。本 reviewer已读原 JSON，未新增 npm 依赖或改 lock。漏洞可达性处理仍在 Phase8。

## 失败记录和候选沿革

原 G3A 基础预审保留在 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase3-authority-pre-review-44aa6e511156453ab3ee9dc22ce95189`。G3B 代码预审及当时源/hash 保留在 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase3-full-pre-review-239549851f0140c78d7ad1adf4bfd435`。这些原记录保持原结论和证据属性。

先前冻结 a01a8166/cdfdc058、helper e4fe9af6 已独立核过 80/466 零差异，随后 writer 的 Operations 实际得到 1/9，broker 目录 rename 导致 main opendir ENOENT 失败关闭，外部请求和原件提交均为 0。最小产品修复为 `NativeSandbox.cs` 第 1014 行 service pin 的访问位 0x000E0080 改为 0x000E0081。新候选仅该 C# 行与 manifest/exe 改变，d0d1 的独立 51+11 和 9 项均按原预算通过。旧失败报告和日志副本在 `read-writer-evidence`，原 root 为 `xiaozhi-phase3-operations-YxHeCf`。

最终 UI 首轮 7/8 在 MCP fixture setup 得到 typed busy。唯一测试 delta 对尚未写入配置的 busy 做 60 秒有界等待，其他错误立即失败。生产/out 保持不变。旧报告 root `xiaozhi-phase3-ui-bi9ha5` 与 test-results `permission-phase3-ui-g44y5A` 保留，本 reviewer 最终 UI 一次执行 8/8。

本 reviewer 的 hash 工具最初按旧 freeze 的 file/bytes 字段读取新的 path/size 格式，产生 null-path 校验错误，未修改生产文件。错误 JSON 保存在 `pin-repair-final/verification-before-tests-parser-schema-failed.json`。改为先严格检查 path 后重新执行，最终 80/466/11 全部零差异。该工具错误未作为产品 finding。

## 性能与剩余边界

本机独立 helper/platform 整套为 38.700 秒，Operations 整套为 26.741 秒。Operations 中首个脚本及提交为 4843.183 ms，取消项为 1445.625 ms，活跃 Grant 撤销项为 1724.641 ms。它们包含 fixture、SQLite 和实际 OS 工作。

Main 首次终端从接受到完成记录约 20.013 秒，same-Task resume 约 22.771 秒，active host close 约 682.943 ms。Runtime 固定源码 prepare+health 约 2376.585 ms，冷启精确身份复用约 151.086 ms。当前没有同 fixture 的生产前后性能对照，不能由这些数据推断性能提升。

后续范围明确保留。

- Phase5 首段实现 stdio 受控双向 Transport。当前 stdio 返回 typed unsupported_constraint，配置和凭据保留，HTTP MCP 已验证。
- Job CPU/内存配额在 Phase5/6 接线。本轮验证 deadline、process 和 output 限制。
- Phase6 完成通用 Effect Ledger/reconcile 与旧 PTY/stdin/background 贯通。MCP 写后失败当前保留 unknown，本阶段没有整系统 Effect 完备结论。
- Phase7 验证真实系统目录对话框、完整页面/布局和教师使用路径。本轮系统对话框为受控 fixture。
- Phase8 验证完整 asar/安装与跨机布局、实际 OS patch 生命周期、最终完整总回归及既有 advisory 可达性。真实模型和真实教师质量未运行，后续在明确授权及相应阶段单独验收。

原目录 MIC/DACL 保持、owned 合成 canary、loopback 和当前 Windows 主机证据均已通过。ACCEPTED 不延伸至上述后续范围。

## 回滚与停止点

沿已冻结实施合同，关闭本轮入口并恢复已接受 Phase2 接线，保留权限表、审批及审计、Task/Journal 和 artifact。受控 helper 不可用时保持 typed unavailable/unsupported，禁止回退到普通用户 shell 执行受限 Grant。教师文件与旧历史保留。

本阶段独立运行已结束，后续交由 root 归档、提交和正常整合。整合后的受影响源码/manifest 与运行身份应由 root 再核验。
