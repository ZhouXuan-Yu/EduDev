# Gate4 首候选源码审查

2026-11-12，审查树 `D:/WorkProject/EduProject-harness`，HEAD `052bd6885c4280b49ab36228fe9ac605799a769b`。

本轮为已释放的只读 SOURCE 审查，运行专项、应用和 build 均为 0，正式 Gate4 结论等待修复后的最终 source/out 和独立实测。原 `source-freeze-4O5IpX` 的 36 文件已逐一复算 SHA256，差异为 0，清单与原件保存在本目录。

## G4-F01 · P1 候选

已知教师私有正文的部分原样片段可能通过发布隐私检查，失败草稿和声明元数据也存在敏感字段落盘路径。结论来自代码推导，尚未运行反例。

`skills/private-context.ts` 第 12–14 行按段保存原始教师文本，单段最多 4096 字符。`skills/validation.ts` 第 54、60 行只检测目标文本是否包含完整 privateText。长段中的 32/64 字符原样片段无法满足完整包含关系。若其中没有通用 PII/secret，sanitize 保持原文，`skills/service.ts` 第 155、164–168 行将该内容写成 published 包。

此外，失败草稿占位 document 第 164 行仍使用原 name，第 181 行 Skill 元数据也保留原 name。合法 Skill name 允许纯数字，例如手机号。该 name 先触发 privacy 失败，仍可能进入占位包和记录。dependencies、permissionRequirements 的原声明字段没有经过同等隐私检查，会被版本和验证理由保留。

最小修复覆盖已知私有源的有界连续片段匹配，以及敏感 name 和声明字段的持久化边界。失败输入保留 typed 原因与安全可修正 Draft，包、SQLite、普通结果和日志均应避免敏感原文。

应有反例从真实 office_read_text 的长合成私有段落取中间 64 字，再通过 skill_create 发布。分别覆盖完整段、部分段、4096 边界后的片段，以及敏感 name/声明字段。断言未形成不合格 publication，所有持久包/元数据/结果均无该原文。

## G4-F02 · P1 候选

外部导入验证和最终落盘读取了不同快照。结论来自代码推导，尚未运行反例。

`skills/legacy.ts` 第 97 行通过 readPackage 捕获 A，第 98 行 await validate(A)，第 104 行 stageImport(directory) 再读取 B。`managed-skills.ts` 的 stageImport 第 209–213 行仅比对 B 与写后外部源 B，没有比对已经通过验证的 A。外部源在验证异步期间换成含私有内容/凭据/脚本的 B，B 能进入 published Personal 版本。

最小修复使用已经验证的 bytes 创建不可变包，或将验证 manifest 与实际落盘 bytes 严格绑定。反例在 sanitize/validation await 断点替换 owned TEMP 外部包，断言不合格 B 的 publication 和敏感字节均为 0，并保留原 active/revision。

两项已即时发送 root 与唯一 writer，root 已安排同轮定向修复。原 freeze 和代码证据保持，待修复后集中复验。

## 关键源 SHA256

| 文件，位于 apps/desktop/src/main/xiaozhi-agent | 首候选 SHA256 |
| --- | --- |
| skills/private-context.ts | `fa1007d9e967321b9745d4b708cd66d252d6ec8cd3141ccd48bcda7205638d87` |
| skills/validation.ts | `3442dee91fe0597ed273a089fb9ff3e75078fe35a06f7599431e696b2ec59dbd` |
| skills/service.ts | `3c3527f88fceafa5fd06d361264e1a51f7659c71d4e8ecac9b900d1c48d71bf2` |
| skills/legacy.ts | `1e0ca466713a277cc5213c96c4c1678fcec64afcb304bedc71a80989a9384d95` |
| managed-skills.ts | `3a723d927421716bf46c671a8d1c4789667a22083bc8f361944173d96ddc9105` |
| serialized-state-sql.ts | `f6402946698923a6e3f48ff0cb1ccfb19b5bc30e8758af662774d8f16a60390c` |

## 既定审查和后续实测范围

已阅读 PHASE_4_IMPLEMENTATION、READONLY_BASELINE、11_SKILL_SYSTEM、S-01–S-09/A-P0-04 和 T4.1–T4.4。沿当前 state/service/catalog/teams/official-authority/runtime、主 host/Pi/Task/Boundary、旧管理 adapter、typed IPC 和现有 Skill 页面核查，保持发布声明检查与实际 Run Grant 消费的区别。

当前主体使用唯一 active users.owner，歧义失败关闭。Team/admin/maintainer 与 Official reviewer 使用独立 main 持久事实。版本和独立副本经不可变文件/manifest 与事务 CAS 记录。Runtime 持久 runId/Task/owner/generation 和精确选中版本，读取时再查撤回、membership、源 hash、依赖和实际权限。

共享 SQL fallback 的定向运行仍待释放，将核对旧无 transaction 形态的队列内写入、异常 rollback、并发隔离及原调用方式的嵌套行为。此次没有据未执行测试给出通过结论，也没有将缺少 transaction 的旧真实宿主夹具称为 mock。

正式独立 Gate4 应在新 source/out 冻结后执行现有 core/真实 Electron Main+Pi/UI 与必要旧库/Skill 回归，定向补验 G4-F01/F02 反例，最后重新核最终身份。无付费或真实模型调用。
