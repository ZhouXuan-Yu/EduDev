# Office 宿主连接与共享契约切片

日期：2026-10-02。对应 A01/A02 的独立准备；P0 H05 未放行前不接管生产 UI/IPC。上一轮 Hana Tools 实现已通过真实调用，现阶段仍不能称正式小智入口完整。

## 交付范围

1. 复用 OpenAI codex-plugin-cc 的 AppServerClientBase/SpawnedCodexAppServerClient，固定 commit db52e28f4d9ded852ab3942cea316258ae4ef346、Apache-2.0、源码 SHA/适配清单。禁止使用 global broker/global CLI/global Codex config。
2. 适配项目锁定 native exe、私有 cwd/env、正文通知、pending 请求超时/上限、bounded JSONL/stderr、断开错误与工具请求回调。只传输 RPC，不承担第二模型循环。
3. 扩展由锁定 0.154.0 生成的官方 params/result 类型；小智共享会话/运行/命令/审批/产物契约版本化、可见字段白名单。IPC 后续按这些契约接入，暂不新增通道。
4. 连接生命周期验证：实际 initialize、thread/start/read/resume、turn/start/interrupt、工具 request；request 超时后 pending 清除、迟到结果丢弃、不自动重启；重复 close、杀自有引擎、旧连接请求/工具取消。
5. 真实 DeepSeek/Hana driver 显式选择复用的新连接；同一测试保持唯一引擎所有者，旧 P0 adapter 保留兼容路径并标明移除条件。

## 数据与恢复边界

引擎历史仍唯一模型真源。此切片不迁移 SQLite、不写真实文件、不改 main/index/preload/App 的生产路由。连接的进程所有权/pending 队列与会话跨进程认领是不同范围；后者 A02/A07 需 SQLite、审批持久状态、readback 和重启验收。

审批/工具 handler 持有连接 abort signal。连接失效即取消未提交操作；旧 engine requestId 不得沿用到新连接。close 只终止自己启动且 PID 已验证的进程树，不扫描/终止其他 Codex。

## 依赖、兼容、回退

无新运行依赖；复用代码仅 Node builtin。生成官方类型的闭包增量扩展，不手写 engine 参数。旧驱动默认保留，--host-client 选择新连接；验收通过后后续生产 Host 采用同一模块。旧数据不自动重放，OS sandbox 权限仍不变。

## 完成定义

- 固定源和许可可核验，官方生成类型与运行时版本一致。
- 边界专项以及真实 DeepSeek + Hana 工具/流式/恢复/停止专项使用新连接通过。
- build、renderer-components、diff check 通过；新连接在 Electron-main 能 initialize/关闭，不能用 Node 测试冒充 Electron 主进程能力。
- 如实记录 IPC/UI/SQLite/持久审批仍缺失，不提前勾 A02/A04/A07 或完整 Codex 功能。
