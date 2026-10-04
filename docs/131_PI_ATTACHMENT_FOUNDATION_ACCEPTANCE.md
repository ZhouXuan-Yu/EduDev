# P07-D1 本地附件基础验收

日期：2026-10-04。合同：[130](130_PI_ATTACHMENTS_AND_IMAGE_DELIVERY_CONTRACT.md)。模块 M01/M10，后续图像与学生资料仍遵守 M03/M04 的本地、脱敏与教师确认规则。

**本轮完成 D1 存储与文件边界基础；完整 D1–D4 尚未完成。** 没有上线附件选择、发送、Pi 图像输入或“已查看图像”界面。本轮不改变已通过的 Office B、联网 C，也不把底层测试计为教师页面验收。总体目标继续 active，三元题组暂停。

## 1. 实际交付

- 新共享契约 `xiaozhi.attachments.v1`，每会话最多 8 个草稿附件；公开投影只包含 ID、名称、格式、大小、版本、状态、修订与消息/运行引用，不包含绝对路径、正文、原图、base64 或云端授权。
- 新 `attachment-state.ts` / `attachment-service.ts`。SQLite `xiaozhi_pi_attachments` 是唯一附件事实表，状态 draft/submitted/removed。增量、幂等 migration 接入既有 `session-state.init`；旧表、设置、会话绑定与 native JSONL 不改写。
- 原 Hana 两个身份函数 `buildSessionFileSourceKey` / `sessionFileOwnerKey` 通过 TypeScript AST 提取，原函数体保持，外层只加 import/export。源、函数体、输出 SHA 与 Apache-2.0 LICENSE 一同保留。Hana SessionFileRegistry 的 `.files.json`、缓存与删除方法未接成第二真源。
- 主进程服务在既有授权根内进行有界读取与预后 stat/hash/version/lease 校验；拒绝凭证文件、受保护目录、硬链接、链接祖先、路径穿越、伪图、SVG 和超限文本。取消或 owner/lease 变化不登记附件。原资料字节不修改。
- 草稿重复选择按本会话来源身份去重；移除使用 revision CAS。提交绑定用单条 SQL 的 materialized 数量条件保证全部匹配才更新；历史已提交引用不能通过草稿移除改写，再次明确选择产生新引用。
- 修复真实适配差异：生产 `Sql.change` 返回 0/1 变更回执，不是更新行数。原来的“等于附件数量”判断会在两条实际已更新后误报失败。现按非零回执并逐条核对 submitted/runId/messageId/revision，保留 SQL 全有或全无条件；不修改全局数据库适配器。

新代码不注册生产附件 IPC、模型工具或上传路径，不变更 start 输入、Pi loop、模型默认或原 `blockImages:true`。没有新增 npm 依赖，已有 TypeScript/esbuild/sqlite3/Pi 用于提取和原生验收；没有新服务。

## 2. 原组件与真实模型能力

Pro MCP 实际查询 chat-attachment、prompt-input、disclosure、modal。已有本地 ChatAttachment 五个文件与原源逐字节一致，不重复拷贝。当前原组件接口是 **Name/Preview/Remove**，在线文档的 Info/size 示例不能直接套给本地版本。CSS/util 闭包及既有 Finesse 0.20.0 设计基线沿 67 保持。本轮没有新增 Finesse 可调用接口，不声明 Codex 官方源码同源。Pro 现有 README 的公开再分发许可边界保持，不将其称作 MIT。

[DeepSeek 官方视觉文档](https://api-docs.deepseek.com/guides/vision/)的本轮搜索结果指出 deepseek-flash 支持图片；英文、中文页面正文抓取均超时，因此没有把搜索摘要当完整接口阅读。

另外用自行生成的 96×64 红/绿/蓝三栏 PNG，向官方 `chat/completions` 发起一次直接图像请求：实际 HTTP **200**、非空回复、颜色顺序正确。安全报告只保存 endpoint/model/hash/状态/布尔值，不保存 key、原请求或回复正文。PNG SHA：`1a05b31a2960f001c3f16ed5fa914cd64041893e8316b480a77d90335858dfca`，实际图已查看，稳定测试夹具位于 `scripts/xiaozhi-agent/fixtures/attachment-rgb.png`。

**这仅证明此时此模型的直接 HTTP 合成图能力，尚未证明 Pi 图像通道、教师附件发送、OCR 或查看回执。** 没有上传学生或教师图片，没有据此解除学生原图的本地规则。

## 3. 实际验收与精确命令

工作目录：`D:\WorkProject\EduProject\apps\desktop`。本轮使用捆绑 Node 24.19：

```powershell
$taskNode = 'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $taskNode scripts/xiaozhi-agent/reuse-hana-attachment-identity.mjs --verify
& $taskNode --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/pi-attachment-foundation-smoke.mjs
& $taskNode scripts/xiaozhi-agent/pi-attachment-native-store-smoke.mjs
& $taskNode scripts/xiaozhi-agent/pi-public-image-probe.mjs
npm run test:renderer-components
npm run test:smoke
```

| 验收 | 最终证据 | 结果与范围 |
| --- | --- | --- |
| 原源审计 | `p07d1-source-audit.json` | Hana 原函数 2、Pro 原文件 5；仅源码身份 |
| 原生文件/SQLite 边界 | `pi-attachment-foundation-oWWoLZ/report.json` | 13/13，Node SQLite、真实合成文件、显式旧测试 DB 副本 |
| 实际应用原生存储 | `pi-attachment-native-tLtLnu/report.json` | 4/4，Electron native sqlite3 与真实 OmniEduStore；重复初始化/关闭重开、双附件绑定、陈旧批次零写 |
| 真实官方合成图 | `pi-public-image-EYFAYU/report.json` | HTTP 200、正确三颜色；直接 HTTP，不是 Pi/Electron 页面 |
| renderer 原组件状态 | `p07d1-renderer-final.log` | 79/79；本轮没有 renderer 修改 |
| 最终产品构建 | `p07d1-main-smoke-final2.log` | TypeScript/main/preload/renderer 构建成功，`index-CMajNv0Z.js`；紧随其后的旧路径 smoke 曾失败，见 §4 |
| 同一产品构建重新冒烟 | `p07d1-main-smoke-diagnostic.log` | `ok=true`、207/207、进程 exit 0；不是附件 UI 的验收 |

13 项覆盖新增 migration、并发去重、真实图元数据、私有投影、跨会话拒绝、预览版本变化、移除 CAS、陈旧批次全回滚与已提交不可移除、数据库 8 项草稿上限、文件边界、取消与租约变化、getter/symbol/多余键拒绝、关闭重开及未知 schema 拒绝、旧副本迁移后 sessions/messages/settings/native bindings 行集保持。旧副本明确来自此前隔离的 `pi-web-ui-9uZomc/data/app.db`，不扫描用户正式 DB。

原生存储脚本在独立 ignored 目录构建 worker，使用实际 Electron + sqlite3 + OmniEduStore；全局 fetch 禁用，不进行模型请求。与 Node DatabaseSync 的 13 项分开计数，不能合并成“17 项页面操作”。

最终 smoke 第一次失败后，只加原脚本受环境开关控制的只读诊断，原断言未删、未放宽。使用已经完成的同一产品构建复验：

```powershell
$env:OMNI_EDU_E2E_DIAGNOSTICS = '1'
& $taskNode scripts/electron-smoke.mjs
Remove-Item Env:OMNI_EDU_E2E_DIAGNOSTICS
# 仓库根目录收尾
git -c core.safecrlf=false diff --check
```

公开证据归档：`docs/design/codex-2026-10-03/p07-attachment-foundation/artifacts.json`。使用明确文件名单、原字节/hash、独占创建；禁止包含 env、profile、SQLite、native JSONL、worker bundle、凭证或实际教师资料。B/C 既有不可变档案保持。原源 source SHA `a445b2f0cfeaef8b861dd3c5a52e6dec11693ed70cc846f609198aa22c326192`；提取输出 SHA `2c78f4dab0831fea59ab51beaadd27fbc9fda0cb8012615d3d3fed3252815399`。

## 4. 失败、修复与未确认原因

1. 初次 TS 源测试缺前置 `--import`，静态模块解析先于模块内注册；后用 CLI loader。原 Hana 函数已经 export，第一次生成重复 export 导致 SyntaxError，修为只额外导出 owner，不修改原函数体。
2. Hana 无 TS 参数类型的空数组被推成 never[]，build1 失败；在宿主加类型适配，原 vendor 不改。build2 通过。
3. `pi-attachment-foundation-cItlgD` 在硬链接测试后继续复用同一原图，其 nlink 已为 2；服务正确拒绝，夹具却期待 changed。改用独立文本验证 lease 变化，不放宽硬链接保护。失败原报告保留。
4. `pi-attachment-native-ggXZXd` 两项后报 changed，暴露真实生产 SQL 的 0/1 回执差异。按 §1 修复，最终实际原生存储 4/4 与边界 13/13 均通过；不能仅凭 Node SQLite 行数测试判断生产正确。
5. `npm run test:smoke` 的最终第二轮在旧 no-provider 教育路径断言处失败：实际页面为 `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`，预期是可操作的凭证配置错误。失败截图已查看并保留。旧隔离测试 DB 按原脚本清理，无法读取首次故障库；没有证明是附件表或 LangGraph checkpoint 的原因。

   后续只读诊断开关会在再次发生时保存 attachment 数量、foreign_key_check 表/父表、最后五轮状态和 checkpoint 数量，不写 prompts/身份/凭证。**同一产品构建复验 207/207，但诊断失败分支未触发，因此不能宣称查明或修复此外键故障。** 后续若复现先取诊断，不调整原 no-provider 断言，不恢复三元题组开发或用 mock 绿灯掩盖。

本轮未操作用户运行窗口/WPS、未改系统 DNS/代理/VPN、未 commit/push、未开子 Agent。当前环境 API 成功不作为实际无 VPN 或安装包证明。

## 5. 唯一下一步与完整目标

下一第一动作：读取四份根协作文档 → 67 §1/2/5/8/9 → 35 → 109-D / 130 / 本文，冻结 **132：D2 正式附件纵向入口合同**，然后实施验收。

132 必须支持已有对话选择冻结工作目录之外的具体文件：复用 Hana 入站文件和现有本地 import，由 native chooser 授权所选文件，进入独立只读附件根/本地暂存。先明确目录、原源 hash/version、SQLite 绑定与中断恢复；不授予同目录其他文件、不改变既有 Pi workspace 身份或云端授权。D1 当前的授权根内 reference service 还不能完成这个用户入口。

依次贯通主 owner/native chooser → typed IPC/preload → 原 Pro 附件与缩略图/本地打开/移除 → 发送命令身份和消息/run 原子关联 → 真实 Electron 操作、取消/副窗口/跨会话/旧历史与重启。学生原图保持本地；实际读图与 OCR、教师校正、查看回执属于 D3/D4，不能提前显示成功数量。

完整 D 之后才进入 E 持久目标；全 D1–D7、未知官方 Skills/设置参考、P08 真实无 VPN/Windows 安装与最终八组验收仍待完成。不能因为这一底座通过缩小用户“完整 Codex 体感、偏办公教育”的目标。
