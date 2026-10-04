# Office 宿主连接切片验收

日期：2026-10-02。合同 docs/45，对应 M10 / A01、A02 独立准备，不是生产主链完成。

## 源码复用与交付

复用 [OpenAI 官方 app-server 客户端](https://github.com/openai/codex-plugin-cc/blob/db52e28f4d9ded852ab3942cea316258ae4ef346/plugins/codex/scripts/lib/app-server.mjs)，固定 commit `db52e28f4d9ded852ab3942cea316258ae4ef346`，Apache-2.0。源 SHA256 `6a2449d61f480483898369d437680951a62789fc0ad5893573ce93265b904d0e`；机械抽取、适配和产物 hash 在 `apps/desktop/src/main/office-agent/vendor/official-client/source-manifest.json`，许可在 `third_party/codex-plugin-cc/LICENSE`。

抽取官方基础/自有进程客户端，适配私有 native binary/env、正文流式、bounded 输出、stdin 断开、pending 发送失败、自有 PID 关闭；无全局 broker/CLI/config 或第二模型循环。严格 facade 管理 typed request、单连接初始化、pending 上限/超时、断开清理、工具 abort、迟到拒绝和重复 close；无自动重启，不转发原始 RPC/stderr。官方 0.154.0 `generate-ts --experimental` 类型闭包扩至 121 份。

Office 共享契约初版含会话/run/命令/审批/产物/事件；命令 validator 复用 Hana frozen snapshot，不执行 getter。真实驱动通过 `--host-client` 采用新连接，旧 adapter 保留，删除条件为生产所有权/持久审批/IPC/新 UI 重启路径全部验收。无新运行依赖。

## 最终测试

工作目录 `D:\WorkProject\EduProject\apps\desktop`，报告在被忽略的 `test-results/office-plan/`。

| 命令 | 结果 | 报告 |
|---|---|---|
| `node scripts/office-agent/host-connection-smoke.mjs` | exit 0，9/9 | `host-connection-TCtV3O/report.json` |
| `node scripts/office-agent/host-connection-electron-smoke.mjs` | exit 0，9/9，Electron 43.2.0 / Node 24.18.0 | `connection-electron-2WF7LD/report.json`，内层 `host-connection-XSjEZZ/report.json` |
| `node scripts/office-agent/codex-app-server-live-smoke.mjs --restricted --hana-tools --host-client` | exit 0，14/14，真实 DeepSeek | `codex-p0-x1WwXL/report.json` |
| `npm run build` | exit 0，含 TypeScript | 本轮输出 |
| `npm run test:renderer-components` | exit 0，79/79 | 本轮输出 |
| 根目录 `git diff --check` | exit 0 | 本轮输出 |

Node/Electron 9 项相同，不累加成 18 项独立能力。使用真实 native initialize/RPC 错误/自有进程退出；超时、迟到帧、不合法帧和待工具请求明确为私有传输故障注入。包括：冻结命令及 getter/多余字段/重复附件/审批枚举拒绝；单连接/私有 env；失败清理；pending 上限和超时/迟到拒绝；无效 timeout 在发送前拒绝；隐藏推理过滤；重复 close/旧连接拒绝；终态取消工具；进程退出无重启；不合法帧无内容泄漏。

真实 DeepSeek 14 项覆盖流式、读文件后模型继续、copy 批准与 readback、公开网页/搜索、投影去重/重启补读、同线程恢复、活跃回合停止、注入 HTTP 500 后真实继续、受控 native dispatch 拒绝和密钥未进入引擎环境。复制批准是测试精确来源/目标 allowlist，尚无教师审批 UI；网络显式用 Cloudflare DoH，无系统网络变更。本轮非 extended，不补验压缩/原生审批崩溃；此前证据见 docs/38。

## 失败与修复

- 首次 Node 加载失败：strip-only 不支持 constructor 参数属性，改为显式字段，后续 Node/provider/Electron 通过。
- 首次 Electron `connection-electron-aKDxzW/report.json` exit 1：Windows 绝对路径 external 被当作 `d:` URL，入口未加载。改 `pathToFileURL` 后复验通过，保留失败证据。
- timeout 原来发送后校验，改为发送前校验；专项验证错误预算不改变 nextId/pending。

## 剩余范围

生产会话/run 所有权、SQLite 命令持久幂等、审批/产物持久化、跨进程认领、typed preload、正式小智 UI 未接通；不勾 A01/A02 完成。本轮未做数据库迁移、Office 编辑/WPS、installer/arm64 或完整浏览器交互。H05 elevated Windows sandbox 初始化授权仍待答复，未改账号/防火墙/权限，P0 未整体放行。

下一项：独立持久会话/run/命令/审批身份与恢复验收；H05 放行后再贯通生产 main → preload → 页面。旧路由和教育数据保留。
