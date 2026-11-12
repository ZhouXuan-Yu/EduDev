# Phase3 完整候选只读预审

2026-11-12，审查树 `D:/WorkProject/EduProject-harness`，起始 HEAD `ad01ec013355ec39e46a5e40ed32d5f704583e5c`。

当前结果为代码预审。源仍 WIP，正式 Gate3 结论待 SOURCE+OUT_FROZEN 后独立运行验证。本轮未运行应用、专项脚本、build、模型或付费调用，仅写自有 TEMP。

## G3B-F01 · P1 候选

新权限审批沿用旧复制卡，界面所承诺的效果与实际批准的效果不一致。此项由代码推导，未运行复现。

- `apps/desktop/src/renderer/components/office/PiEducationWorkspace.tsx` 第 368–370 行把所有审批交给 `PiCopyApproval`。
- `apps/desktop/src/renderer/components/office/PiCopyApproval.tsx` 第 23–26 行固定显示“复制教学资料”和“仅执行本次复制；已有同名文件不会被覆盖”。第 28 行提供“批准这一次”。
- `apps/desktop/src/main/xiaozhi-agent/permissions/public.ts` 第 5–14 行将任意 v2 PermissionApproval 投影成同一 XiaozhiApproval，因此 exec_command、MCP、网络外发请求同样进入复制卡。
- `apps/desktop/src/main/xiaozhi-agent/production-host.ts` 第 1292–1299 行把卡片的批准动作转换为该 v2 记录的 operation 批准。终端请求可以包含 read/write/delete 与 process scope，MCP 请求可以包含网络和资料外发。

最小反例为向会话卡提供待批 exec_command 请求，脚本具有覆盖或删除效果。卡片向教师承诺仅复制且同名不覆盖，但点击批准会批准该脚本。MCP POST 外发请求也会显示相同错误承诺。

最小修复按 `approval.permission` 分支显示真实 action、资源 scope、资料分类、有效期及 main 冻结的脱敏请求摘要。旧 v1 复制继续保留原卡内容。批准动作绑定原 approvalId、revision 和明确的 operation 范围。

重验应包含 exec_command 删除/覆盖与 MCP POST 两个会话卡反例，断言错误复制文案消失，真实动作和资源可见，点击使用原记录身份，v1 复制卡回归通过。还需实际会话路径验证，组件 fixture 单独记录。

相关源码 SHA256

| 文件 | SHA256 |
| --- | --- |
| PiCopyApproval.tsx | 997309cb7926c82aa6a82ffa5548e890e716f5cfe9fc080f0b799bfcdd8215f1 |
| PiEducationWorkspace.tsx | aa271b27b5de79114dda10fc50a87c3e53e7f297edc41fdd0acca4d3f7fc42ae |
| permissions/public.ts | 4d53d162f0da349c6b92ae75dc39b2de28a90b5b883bee47233185f51aee9bef |
| production-host.ts | 384c2391bacc2b0e9134b7087b12e7ae5a753a9f52890da134a120b72f0fcbb8 |

已即时发送 root 和唯一 writer。Writer 已确认此接线并开始定向修复，修复与测试尚待复验。

## 本切片核查范围

已沿已定位源码核查权限 engine/store/service/resources、旧审批 request/bridge/coordinator、主进程 Task owner 与 Pi execution boundary、MCP HTTP 授权及实际传输、文件 IO 授权检查、受控脚本 projection/原件 CAS、固定源码 runtime recipe 与 Windows 签名信任、helper Job/token/handle list/清理路径、环境工具和 renderer 薄接线。本轮未再扩展整仓扫描。

G3A-F01 原审批期限交集和每次 assert 重新核验已见当前 engine 源码。G3A-F02 从真实 v1 workspace 表事务验证只读迁移已见当前 store 源码。两项在本轮仅核代码，原预审源码和报告继续保留，独立实际复验等待冻结。

stdio typed unsupported 与 Phase5 transport、CPU/内存配额后续接线按已确认阶段边界保留。当前 helper 的真实 Windows 隔离、撤销、父进程结束后清理和机器 runtime bootstrap 仍需正式独立运行证据。

## 源码身份与证据局限

`source-hashes.json` 保存 65 文件的起始清单及 SHA256，原件按仓库相对路径保存。`pre-review-end-hashes.json` 保存结束时比较和 4 个附加文件，包括实际 helper exe 和当前 Native artifact 字节。

结束时 65 文件中出现 4 个 WIP 变化，涉及 windows/broker.ts、windows/NativeSandbox.cs、generated/sandbox-manifest.json、PHASE_3_WINDOWS_HELPER_WIRE.md。结束时副本另存 `wip-later-source`，起始副本保留。它们属于未冻结实现推进，本次未对后续 delta 重新发出验证结论。上述 G3B-F01 的四个直接证据文件在核查时保持相同 SHA256。

本报告未将 writer 的已有 authority/Main/Pi/helper/UI/MCP 测试数作为独立执行结果。正式验收需重新捕获最终源码及 out 身份，并按 root 授权串行执行既定专项与定向反例。
