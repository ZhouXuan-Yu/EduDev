# P04-B3a 指令编辑、撤回与旧会话验收

日期：2026-10-03。合同 docs/65；M10/M01。**B3a 有界功能实例通过；教育记忆 B3b、完整 P04 和整体 Codex 对齐未完成。** 最新用户过程/组件设计固定于 docs/67。

## 1. 实际交付与复用

- main-owned 待处理指令按 ID/revision 编辑文本和 steer/followUp 模式、撤回；持久 CAS 保留原 command 身份/hash。typed `xiaozhi:queue-mutate` → preload → 正式 PiControlCards，额外权限字段/跨会话/旧版本拒绝。
- 复用 Pi0.80.3 原生 steer/followUp 与 Hana 已移植 prepareNextTurnWithContext 接缝。Hana 协调层本身只是转发 steer；Pi 无公开按 ID 删除 API。新增 instruction-queue 是待处理控制领域，原生模型循环仍只有一个，未读取/修改 SDK 私有队列。
- 在下一原生回合边界只交一条适当指令。main dispatching 提交后锁定，真正 SDK message_start 才 applied。同文本不同 ID 正确对应；工具回合 followUp 留待收尾。模型流式/工具等待/自动整理期间尚未交付项可编辑。
- mutation 同步 reservation 先挡交付，再 await durable CAS，提交成功才修改实际待处理项；失败保留原项，停止释放 barrier，迟到提交不复活指令。送达或交付中不能伪装撤回；撤回/消费释放 pending 上限位置。
- instruction payload v2 加 revision、dispatching、withdrawn；旧 v1 revision0 可读/按操作升级，计划/提问仍 v1，未知版本拒绝。原有表不删除，无新增结构表 migration。
- 新增 private-workspace-identity：仅 main 创建的本会话私有目录搬迁，用严格同会话 header cwd 校验旧 fingerprint，实际工具访问当前 restricted workspace；不改写旧 JSONL/header，不允许教师已授权目录或任意其他路径使用兼容。
- 复用既有 HeroUI Pro ChatTool 及真实 MCP 文档、finesse 过程/回执原则；编辑器/按钮与 main 数据绑定。无新依赖，无 vendor hash 改动。整体视觉差距仍存在，见 docs/67。

主要领域文件：instruction-queue.ts、queue-mutations.ts、private-workspace-identity.ts、control-state.ts、control-tools.ts、pi-session.ts、production-host.ts、ipc.ts、shared/xiaozhi-agent.ts、preload/index.ts、PiControlCards.tsx/PiEducationWorkspace.tsx；均位于 apps/desktop/src 对应目录。新增 package 脚本 test:xiaozhi-pi-queue 与 test:xiaozhi-pi-queue-boundary。

## 2. 命令与证据

以下命令从 `D:\WorkProject\EduProject\apps\desktop` 执行，报告位于该目录 `test-results/xiaozhi-agent`。条目有重叠，不相加当“独立功能总数”。

| 命令 | 最终证据 | 结果及范围 |
| --- | --- | --- |
| `node scripts/xiaozhi-agent/pi-queue-ui-smoke.mjs` | pi-queue-ui-WSHNBC/report.json；pi-queue-ui-semantic.log | 真实正式 Electron/DeepSeek 15/15 |
| `node scripts/xiaozhi-agent/pi-queue-existing-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data` | pi-queue-existing-Ql8Lqx/report.json；pi-queue-existing-relocated.log | 最新 private relocation 源码，真实旧 v1/SDK 副本 3/3 |
| `node scripts/xiaozhi-agent/pi-queue-boundary-smoke.mjs` | pi-queue-boundary-R3kMQ8/report.json；pi-queue-boundary-final.log | 最新源码边界 9/9，确定性 native seam/隔离 SQLite，非真实 provider |
| `node scripts/xiaozhi-agent/pi-control-ui-smoke.mjs` | pi-control-ui-Z8QcHA/report.json；pi-queue-control-initial.log | 本轮真实既有控制 17/17；可选旧副本项由上方独立 3 项覆盖 |
| `node scripts/xiaozhi-agent/pi-auto-control-edge-smoke.mjs test-results/xiaozhi-agent/pi-compaction-ui-UVXuHm/data` | pi-auto-edge-RRxnSR/report.json；pi-queue-auto-regression.log | 本轮真实自动整理/队列/预算/退出控制 7/7 |
| `node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-compaction-ui-igh8BW/data/app.db` | pi-state-migration-PWWjT6/report.json；pi-queue-migration.log | 明确旧测试副本/新格式幂等与既有事实 10/10；不是本轮新表迁移 |
| `npm run test:renderer-components` | pi-queue-renderer.log | 79/79；后续只有 main 私有目录兼容修改，UI 没再改 |
| `npm run build` | pi-queue-build-relocation.log | 最新应用源码 typecheck/build exit0 |
| `npm run test:smoke` | pi-queue-legacy-recheck.log | 最新源码 build + 主路径 ok=true、207/207、npm exit0 |

真实 15 项覆盖：自然教师任务提问；同文本多 ID；页面编辑文本/模式；撤回；重复/stale/越界 mutation；1366×768/1920×1080 可达；native 只收修订版一次/撤回零次；真实助手回应验收码；送达后拒绝撤回；重启 revision/模式保持；并发一赢家；停止竞争；16 pending 位置释放；真实长流式期间编辑；dispatching 锁定；该间隙实际拥有的 Electron PID kill/restart，旧文本零重放。

dispatch gap 20 秒延迟是未打包 main-only E2E seam，真实 kill/restart 是实际进程操作，两者区分。只用合成教师文本、明确隔离数据/授权文件；没有扫描或改变真实用户数据。JSONL readback 仅核必要角色/text/身份，没有将 thinking/原始请求广播给 renderer 或报告。

## 3. 保留失败及修复原因

- `pi-queue-ui-1rwAgt/report.json`：6 项后文本断言失败。模型将“教师验收码”与随机码之间加空格；native 只消费修订版一次已正确。改断言匹配随机码语义，不依赖模型标点；最终 WSHNBC 15/15。此前 uZmPy5 15/15 是加强语义断言前记录。
- `pi-queue-existing-lt8DfQ`、`pi-queue-existing-8HgLgO`：原绑定历史复制后 configuration/usage0，等待问题超时。补工具名 prompt 也失败，排除自然请求问题；真正原因是私有工作目录绝对路径 fingerprint。按合同严格识别本会话私有搬迁，保持原历史/模型/工具/prompt 与实际访问边界；最终 Ql8Lqx 3/3。任意目录、其他会话 ID、非受限当前目录的否定边界通过。
- 首次 boundary helper 在非 async 回调中 await，脚本解析失败，没有产品运行证据；修 helper 后先 8 项，追加私有搬迁边界后 9/9。
- `pi-queue-legacy-final.log`：构建成功，教学书册导出后等待 `teaching-book-success` 超时；不能因外层 PowerShell exit0 称通过。此前 pi-queue-legacy.log 主路径 207/207，仅为私有兼容修改前记录；再次跑相同主路径、显式传播 npm exit 以核验最新状态。

所有旧失败保留，不以覆盖日志或改产物身份制造兼容。精确修订先后：真实 queue15/normal17/auto7/renderer79 → 旧副本定位 → main 私有搬迁修复 → 最新 build/old3/boundary9 → 最终 smoke 收尾。

## 4. 收尾与下一项

最新源码最终冒烟 `pi-queue-legacy-recheck.log` ok=true、207/207、npm exit0；先前提示超时保留且原因尚未充分定位，不能称产品修复。仓库收尾 `git diff --check` exit0，仅已有 CRLF 转换提示；原图 hash/manifest 和新设计文档本地引用读回核验。B3b 显式教育记忆作用域尚未实现，完整 B3/P04 保持未勾选。下一条：沿既有 L1/L2/L3，本地预览/教师选择、版本化授权 metadata 和受控只读工具合同；不把 active/local_only 记忆直接上传，不复制 Hana 人格/梦境存储。

P05 Skills、P06 真实过程与同款组件、P07 办公网页/文件、P08 实际无 VPN/安装继续执行。完整目标保持 active；无 commit/push/子 Agent/系统 DNS/代理/VPN 变更。
