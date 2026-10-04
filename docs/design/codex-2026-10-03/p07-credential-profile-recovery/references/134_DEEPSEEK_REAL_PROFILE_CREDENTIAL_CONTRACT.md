# DeepSeek 真实用户配置目录凭证修复合同

日期：2026-10-04。用户补充“DeepSeek 凭证不可用 / API 密钥未通过验证 / 显示上次读取的官方目录”。当前故障优先；132 附件 D2-B 后续范围保留。

## 1. 当前证据与原验收更正

123 的隔离页面验收与加密配置 helper 均曾成功，但未在小智真实 `userData` 中复验密文。最新隔离 Electron 页面 SEaaPt 9 项仍通过，包括独立官方验证、保存、重启与原 Pi 实际回复；真实数据库只读检查在 `safeStorage.decryptString` 阶段失败。已经使用真实 `%APPDATA%/OmniEduAgent` 配置目录再次只读复现，不能用隔离窗口成功代替真实配置可读。

原 123 的“真实配置修复完成”结论需以本轮真实配置目录解密与重启结果修正。凭证不打印、不入 Markdown 或报告；不用旧密钥或环境密钥静默 fallback。Electron 官方 safeStorage 文档确认它是主进程的 OS 加密接口，可用不等于任意密文能解密：https://www.electronjs.org/docs/latest/api/safe-storage 。

## 2. 执行范围

1. 保留只读失败与隔离通过报告；对比原 helper 配置目录能否解密同一数据库密文，确认差异。
2. 使用与小智相同的真实 `userData` 和原 `ModelSettingsService` / `ModelSettingsState` / Windows safeStorage，仅显式更新 `xiaozhi.provider.v1`。密钥来自用户已授权的 ignored 本地调试配置，不硬编码。
3. 更新前确认没有运行中的小智进程/任务，按旧 revision CAS；官方目录与所选模型必须实时验证。其他配置行、旧会话、业务表与文件不变。不得调用整库 `Store.init`、migration、recovery 或真实教师对话。
4. 修复 helper 校验它的实际 `app.getPath('userData')` 与目标配置目录一致，禁止测试配置目录密文写到真实数据库。只读验收 helper 使用同样的路径检查，并在另一个 Electron 进程重启后解密、请求官方目录与最小无个人数据连接。
5. 增加有意义的真实 native profile 差异验收，覆盖错配置目录拒绝/目标目录保存/相同目录跨进程重启；现有隔离 UI 9 项与主 frame 约束保持。

## 3. 完成定义、限制与下一步

真实同配置目录加密保存与独立重启解密成功、密钥与用户授权本地值匹配、官方目录与短连接 HTTP200；原旧配置/其他事实保持。报告只有安全状态/模型/版本/时间，保留失败与修复命令、进程终态。需要的专项、build/renderer/主 smoke 与 diff check 记录在135。没有新依赖、凭证上传或系统 DNS/代理/VPN 修改；不把这些测试当完整 Codex 对齐。

本故障完成后唯一下一动作继续132§3 D2-B正式附件入口，再132§4 D2-C、D3/D4/E/全D1–D7/P08/未知官方参照。总体目标保持 active，三元题组暂停。
