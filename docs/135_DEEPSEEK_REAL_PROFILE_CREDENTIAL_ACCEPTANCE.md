# DeepSeek 真实配置目录凭证修复验收

## 用户错误补充后的独立复验（2026-10-04）

本轮再次运行 `node scripts/xiaozhi-agent/pi-credential-profile-smoke.mjs --check-real-user-profile`，exit0。安全报告 `apps/desktop/test-results/xiaozhi-agent/pi-credential-profile-VbwB2f/inspect/report.json`：真实profile匹配、DB只读、revision2、加密密钥可解密且匹配授权本地值、default deepseek-flash在本次官方目录、目录与短连接HTTP200、回复非空、running0。未再次保存凭证、迁移真实Store或操作教师会话；原12项页面验收仍是此前证据。本轮仅追加当前复验，不改已有公共档案，下一仍132§4 D2-C。

2026-10-04；合同134。用户补充“DeepSeek凭证不可用 / API密钥未通过验证 / 显示上次读取的官方目录”。本轮优先恢复实际调用，原附件 D2-B 范围保留。

## 1. 原结论更正与当前修复

123 的隔离 UI 和配置 helper 成功不足以证明真实用户窗口可读同一密文。此次隔离页面 SEaaPt 9 项再次成功，但真实数据库只读检查在解密阶段失败；指定真实 `%APPDATA%/OmniEduAgent` 后仍失败。原 helper 的隔离 profile 对同一密文解密成功，并实际官方目录/短连接 HTTP200，证明两者环境差异。真实 profile 的受路径守卫检查 WaY8WI 明确 `decryption_failed`。

原配置修复 helper 曾在测试 profile 加密，结果写入真实数据库。**123 中“真实配置已恢复可用”的结论在本轮更正；其当时隔离 UI/同 helper 连接成功证据仍保留。** Electron safeStorage 是主进程 OS 加密接口；本轮实际 Windows/Electron43.2 profile 差异由原生实测确认，不将其泛化为所有操作系统的同样行为。[Electron 官方 safeStorage 文档](https://www.electronjs.org/docs/latest/api/safe-storage)

本轮使用正确真实 userData 的原 ModelSettings/State/Windows safeStorage 与 revision CAS 保存，仅 `xiaozhi.provider.v1` 更新为 revision2/default `deepseek-flash`。保存前 running=0、没有现存 Electron 用户进程。其他 app_settings/legacy 行逐项 hash 一致；没有整库 Store 初始化、migration、recovery、真实教师会话请求或资料上传。

CKvbq1/replace 安全报告：targetProfileMatched=true、configurationSaved=true、encrypted=true、matchesAuthorizedLocalKey=true、legacyAndOtherSettingsUnchanged=true、官方目录 HTTP200、短连接 HTTP200/非空。另一个真实配置目录进程 R2OgRe/inspect 在重启后以 OPEN_READONLY 读取 revision2，再次正确解密、实际官方目录与短连接 HTTP200。检查不写官方模型缓存或DB配置，环境 key 被清空，不回退旧凭证；Electron正常退出可能维护自己的profile状态，不承诺整个profile零写。

当前官方目录实际返回 `deepseek-flash` / `deepseek-v4-pro`，默认为前者；未来以新官方调用为准，不按旧 Claude 角色或截图猜模型。用户重新打开小智并新建对话可加载新默认；既有会话的模型绑定没有静默改写。

## 2. 实现与页面验收

新增 main-only `credential-profile-worker.ts` 与 CLI `pi-credential-profile-smoke.mjs`，复用现有服务，不新造加密/provider/网络栈。bootstrap 在 ready 前明确设置 userData，worker 在加密或打开 DB 之前验证实际/预期 profile 的 canonical 路径相等；DB 必须位于该 profile 下。默认命令只操作 owned 合成配置目录；真实检查/修复需明确参数。真实修复还拒绝存在 Electron 进程，并沿原 credential 与 revision 校验。密钥只从 ignored `.env.local` 读取，不入参数、stdout、报告、源码或 Markdown。没有新依赖。

原 `pi-credential-recovery-ui-smoke.mjs` 保持原9项，新增3项真实跨 profile 密文恢复：独立 owned native profile 对随机合成文本加密，把该密文写入隔离 UI 数据库；原窗口重启明确显示不可读/未配置、没有旧凭证 fallback；本次密钥独立验证成功仍未保存；明确保存后同原 UI profile 再重启正确读取 revision2。最后原 Pi/DeepSeek 对话完成、输入栏空、running 时验证 busy、副窗口不能验证全部保持。

最终8bx1qB实际 Electron UI **12/12**；1366×768 / 1920×1080 原生内容尺寸下验证与保存可达，两张清框后的截图实际查看。设置页原 HeroUI/Hana/Pro 与67设计保持，没有新的组件手写或修改，不能称全部 Codex 视觉已验。

## 3. 命令、终态与边界

工作目录 `D:\WorkProject\EduProject\apps\desktop`；node为本机会话bundled Node24.19。运行UI期间没有重写out，UI全部终态后主smoke重新build。

| 命令 | 结果 | 原证据 |
| --- | --- | --- |
| `node scripts/xiaozhi-agent/pi-credential-profile-smoke.mjs` | exit0，4/4 | HAsxTq：实际加密/另进程同profile解密/异profile不能解密/错维护profile写入前拒绝且probe原bytes保持 |
| `node scripts/xiaozhi-agent/pi-credential-profile-smoke.mjs --repair-real-user-profile` | exit0，success=true | CKvbq1/replace/report.json；仅用户已授权凭证配置 |
| `node scripts/xiaozhi-agent/pi-credential-profile-smoke.mjs --check-real-user-profile` | exit0，success=true | R2OgRe/inspect/report.json；真实profile独立重启/只读/官方200 |
| `node scripts/xiaozhi-agent/pi-credential-recovery-ui-smoke.mjs` | exit0，12/12 | 8bx1qB/report.json、credential-profile-ui12.log；实际官方API/Windows/Pi |
| `node --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/pi-model-settings-boundary-smoke.mjs` | exit0，19/19 | Y2Lyqd/report.json、credential-profile-boundary.log；HTTP double/SQLite/strict typed边界 |
| `npm run build` | exit0 | credential-profile-build.log；renderer index-CMajNv0Z，产品源码保持 |
| `npm run test:renderer-components` | exit0，79/79 | credential-profile-renderer.log |
| `npm run test:smoke` | exit0，ok=true，207/207 | credential-profile-main-smoke.log；原断言与安全只读诊断保持，UI终态后重新build |
| `git -c core.safecrlf=false diff --check` | exit0 | credential-profile-diff-check.log |

最初只读8a9ce0fa/明确真实profile efe48028/正式guard WaY8WI失败与原helper b49a8961成功均保留。新增native测试 yxiJux 首项成功、第一次跨进程解密失败；当时 bootstrap 在加密后立即 app.exit，改正常 app.quit 后 HAsxTq 全4通过。当前结果证明正常退出后的持久性；不称已检测所有异常断电或承诺OS密钥迁移。失败不删除、不修改断言来接受错误。

真实配置连接是无个人数据的短文本调用；正式 Pi 用户链在隔离 owned 数据根，不能称已在真实教师会话发消息。实际当前网络成功不勾关闭VPN现场/Windows安装包/完整 Codex 对齐。未改系统 DNS/代理/VPN，没有提交、push、发布、子agent或远端凭证修改。

## 4. 下一步

公共原字节证据：`docs/design/codex-2026-10-03/p07-credential-profile-recovery/artifacts.json`，仅明确选择的安全报告/清框截图/日志/文档与源码runtime hash；归档脚本拒绝已存在目标及实际密钥字节。真实DB、profile Local State、私有合成probe和运行worker/bootstrap不归档，旧122/123和B/C/D1/D2A公共档案保持原字节。全部门禁已终态后才生成此档案。

故障完成后直接继续132§3 **D2-B正式附件入口**：原host owner/native picker → strict typed/main-frame/取消期限实际槽 → preload → 原Pro附件、图片缩略图、本地预览、移除；工作目录另保留，已有对话可选择目录外单文件。再132§4 D2-C消息/run持久绑定与发送、D3学生本地OCR/明确公开图Pi视觉、D4实际查看回执、E/全D1–D7/P08/未知官方参照。整体目标 active，三元题组暂停，不能以凭证恢复或12项UI结束整个Harness目标。
