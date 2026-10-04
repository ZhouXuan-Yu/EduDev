# P07-D2-A 本地单文件入站基础验收

日期：2026-10-04。合同：[132](132_PI_ATTACHMENT_ENTRY_DELIVERY_CONTRACT.md)，完整附件需求沿 109-D / 130；已有 D1 证据见 131。模块 M01/M10。

**D2-A 完成；D2-B/C 正式入口和发送尚未接线，完整 D 未完成。** 本轮没有 renderer、preload、IPC、production-host.start 或 Pi 输入变更，不将20项底层验收冒充附件页面/模型视觉/OCR/实际查看。本轮的产品改变是私有入站状态增量迁移和恢复；本地复制/预览适配尚待挂正式宿主入口。

## 1. 实际实现

新增 `attachment-import-state.ts` / `attachment-import-service.ts`，生产 `session-state.init/recover` 组合一张增量 `xiaozhi_pi_attachment_imports` 表。SQLite 保存选中文件原路径/version/hash、会话来源身份、managed 相对路径和 staging/ready/interrupted 状态。原文件、本地结构化事实和 native JSONL 保持原真源，不引入 Hana `.files.json` 旁路事实。

明确选择的单文件进入 `dataRoot/xiaozhi-pi/attachments/<sessionId>/<UUID>/<安全名称>`，不替换原 Pi 工作目录。源路径只主进程；所有源祖先链接、硬链接、凭证/受保护目录、应用私有数据根、类型和大小校验后有界读取，exclusive copy、fsync、只读属性、再次 hash/version 核验后 ready，最后登记 D1 草稿附件。源文件不修改；复用副本前仍校验副本，不能回退原路径掩盖篡改。

原源版本相同复用已核 ready 副本，草稿去重；原源变化建立新副本与新版本，旧消息的本地副本不因原源删除或修改失效。移除只改 D1 草稿状态，已提交引用保持；明示重新选择可复用副本并新建草稿引用。主服务有8个实际入站工作槽，D1数据库8草稿上限保持，第9个不同文件在新复制意图前拒绝。

重启仅将 staging 标 interrupted，不复制、解析、模型调用、上传或删除文件；ready保留。复制成功但尚未登记的文件只能下次教师明确选择后校验登记。取消到实际 SQLite 登记后返回前，CAS移除本次新草稿；如果命中以前已选的草稿，保留原ID/revision。中断资料隔离保存，不自动清扫或重放。

本地预览按 D1 ID/session/revision 与复制件hash/version核验，复用原 workspace-files/AnyDoc 接口；新的返回对象省去暂存相对路径，图像/text只用于本地预览，未进入公开历史或模型消息。**本轮实际测了文本和PNG，未新增Office解析或图片解码/缩略图证明**；完整入口需在下一段实际核Office与现成原生图片解码。

## 2. 原源、依赖与适配范围

Hana0.449.0 `lib/session-files/bridge-inbound-files.ts` 原 `MIME_EXTENSIONS`、`safeFilename`、`removeUnsafeFilenameChars`、`extensionFor` 四段 AST 文本提取，保留原体；只添加 `node:path` import/导出，Apache-2.0沿同目录原LICENSE。新文件 `vendor/hana/lib/session-files/inbound-filenames.ts` 和 `inbound-filenames.source.json`。

- source SHA：`3601f3f3da0a3223c9b2d3850f01133eaad0ee972c3dd0631a338426ad75628a`
- output SHA：`3bfe8721b7a48a3d2730a71ead61fe37b37bcbb4230b3d3c9ec7f4e789c048ff`

Hana原来源ID函数继续用于入站身份，实际格式为 `xiaozhi-inbound:<sha256>`，不删原namespace。原bridge接受bytes/base64、同步sidecar登记和非exclusive writer，未将这些逻辑接给renderer；单文件权限、SQLite状态和有界安全复制是宿主适配，不声称整个Hana bridge原封复用。

D1 `attachment-service` 只增加主进程 `readBytes`，复用原pre/post-stat/hash边界；原capture/select/preview行为由13/4项复验。Pro MCP本轮实际list138 + chat-attachment/prompt-input/modal docs；现有原ChatAttachment5文件与CSS/util沿131，不修改原组件。本地实际Name/Preview/Remove接口和Finesse0.20.0设计基准沿67，尚未接新组件数据。不声明Codex官方源码同源。无新npm依赖、服务、模型循环或用户权限规则。

## 3. 当前真实证据

工作目录：`D:\WorkProject\EduProject\apps\desktop`。捆绑Node24.19，实际Electron主进程中的Node24.18/native sqlite3；测试不启动用户应用窗口、全局fetch禁用。

```powershell
$taskNode = 'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $taskNode scripts/xiaozhi-agent/reuse-hana-inbound-filenames.mjs --verify
& $taskNode scripts/xiaozhi-agent/pi-attachment-import-native-smoke.mjs
& $taskNode --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/pi-attachment-foundation-smoke.mjs
& $taskNode scripts/xiaozhi-agent/pi-attachment-native-store-smoke.mjs
npm run test:renderer-components
$env:OMNI_EDU_E2E_DIAGNOSTICS = '1'
npm run test:smoke
# 根目录
git -c core.safecrlf=false diff --check
```

| 验收 | 最终路径（`apps/desktop/test-results/xiaozhi-agent` 下） | 实际结果 |
| --- | --- | --- |
| 原Hana四段核源 | `p07d2a-source-audit.json` | success；源码证据 |
| 入站/恢复原生专项 | `pi-attachment-import-native-WDTtST/report.json` | 20/20，实际Electron + native sqlite3/OmniEduStore/本地FS |
| D1文件边界复验 | `pi-attachment-foundation-AWwkO3/report.json` | 13/13，Node SQLite与真实合成文件/旧隔离DB副本 |
| D1实际应用存储复验 | `pi-attachment-native-6t3Fug/report.json` | 4/4，实际native Store |
| 原组件状态门禁 | `p07d2a-renderer.log` | 79/79，无本轮renderer修改 |
| 最终构建与原主冒烟 | `p07d2a-main-smoke.log` | 产品build成功，`ok=true`207/207，进程exit0，renderer仍`index-CMajNv0Z.js` |

20项包括：新migration幂等；并发5次选择单副本/单草稿且原bytes不变；目录外导入保持先前workspace与绑定行；真实PNG/text本地预览；原源删除后submitted副本保留；源修改的新版本与旧文本不变；移除/重选；跨会话拒绝；8项上限；凭证、links/hardlink、private app、无效路径/伪图/过大文本拒绝且零意图；各阶段取消；SQL登记后迟到取消与重复选择取消分别保留正确草稿；复制件篡改拒绝；真实关闭重开；未知schema/损坏source-key拒绝；明确旧隔离native DB副本重复迁移原sessions/messages/settings/attachments/bindings行集保持；三个实际强制终止/两次重启恢复。

“旧绑定保持”专项直接创建了隔离的workspace和合成binding行，证明宿主适配不改它们，**不是实际Pi native JSONL续问或真实已有教师对话证明**，后者仍属D2正式入口验收。run_fixture/message_fixture亦为本地状态边界，不冒充发送结果。旧副本为D1已关闭的 `pi-attachment-native-tLtLnu/data/app.db`；迁移前先只读取原行集hash，之后才运行实际Store.init及重复migration，不扫描用户正式DB。

三个退出测试只终止子进程自身PID，在intent/file/ready各写明确阶段标记后调用OS SIGKILL。Windows实际均exitCode1/signal null，非73；恢复保持应有复制件（intent无，file/ready有）、staging→interrupted或ready保留、零新草稿；再关闭重开行集/副本hash不变，全程禁网络。没有删除原文件或用mock transport冒充退出。

## 4. 失败与修正

- `pi-attachment-import-native-0ikops`：初次用ELECTRON_RUN_AS_NODE执行包含真实本地预览的bundle，`electron`没有utilityProcess导出，测试启动失败，无报告。改成实际Electron main/app.whenReady的无窗口owned bootstrap，原native sqlite3与预览服务不mock。此处与D1纯存储worker的运行环境不同。
- `pi-attachment-import-native-eMT0EB`：1项后invalid_input，宿主错误把原Hana namespace:hash当纯hex。保留原身份函数与namespace，修宿主schema校验，未改原源函数或放宽身份比对。
- `pi-attachment-import-native-nazLgS`：16项后file阶段`process.exit(73)`触发原生SQLite teardown的napi_fatal_error，实际exit134，不是预期73。保留失败报告与日志；**未认定这是产品正常关闭故障，也未声称改好了SQLite原生清理**。为准确验证不经清理的崩溃，将切点改成OS直接强制终止本测试子进程，阶段标记/非正常终态/原存储恢复均仍验证，不去放宽为“任何重启算成功”。
- `GWKqhm`18项先通过三真实强制退出；之后增加SQL登记完成后取消和重复选择取消两条具体边界，最终WDTtST20项。D1及主门禁随后对最终代码复验，不只取早期绿灯。

131旧no-provider外键失败本轮未复现；受开关控制的只读诊断和原断言保留，不因本轮207通过宣称查明旧因果。构建与UI实例串行；本轮没有实际附件UI实例。

公开安全证据：`docs/design/codex-2026-10-03/p07-attachment-inbound/artifacts.json`，明确文件名单、原bytes/hash、独占创建；不含env、profile、DB/WAL、nativeJSONL、worker/bootstrap、原源路径数据或实际教师资料。B/C/D1不可变档案保持；未commit/push、开子Agent、改OS网络或操作用户窗口/WPS。

## 5. 下一唯一动作

四根→67§1/2/5/8/9→35→109-D/130/131/132/本文，直接实施 **132§3 D2-B 正式入口**，不重新无限验证入站基础：把 importer 挂原production-host owner/choosing锁和main-frame native picker → strict typed choose/list/remove/preview/cancel与期限/实际槽 → preload → 原PromptInput.Attachments、ChatAttachment/ChatAttachmentGroup和本地预览。工作目录选择独立保留，既有对话可选目录外文件。

先核真实 nativeImage/原图片预处理的本地解码、尺寸与缩略图；错误或不可解码不能显示成功图。上游选择和取消到SQL登记的owner生命周期接原host，先完成真实页面从“+”操作/两尺寸/跨会话/副窗口/关闭重启。之后132§4 D2-C命令身份/消息-run持久绑定与实际DeepSeek发送、再D3读取/学生本地OCR及教师校正/公开图Pi视觉/D4实际查看回执。完整D后E持久goal、全D1–D7/未知官方Skills设置参照/P08实际无VPN/Windows安装/最终八组继续，总目标active、三元暂停。
