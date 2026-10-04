# 小智联网恢复验收

日期：2026-10-04。对应 [交付合同](WEB_CONNECTIVITY_RECOVERY_CONTRACT_2026_10_04.md)。本轮完成联网故障切片，完整智能体与 Codex 体验目标继续保持未完成。

## 已确认的原因与修复

真实用户配置只读检查发现没有 `xiaozhi.web.v1` 设置，旧默认是 `system`。系统将公开域名解析到 `198.18.x.x` 代理虚拟地址，安全连接层拒绝，搜索因而显示权限错误。不是通过换关键词或换模型能够解决的问题。

1. 没有保存联网设置时默认 `auto`。先用系统返回的公开地址；仅虚拟地址或普通 DNS 解析失败时使用应用内阿里公共解析，重新检查实际公网 IP 并连接这个 IP。真正内网、回环、链路本地、混合不安全结果、保留域名与带凭证地址仍拒绝。
2. 保留已有明确 `system` / `alidns` / 关闭联网设置以及版本 CAS，不修改系统 DNS、代理、VPN 或凭证。设置页沿原 HeroUI Dropdown 增加“自动（推荐）”。已开的浏览器组也会应用新解析选择并关闭旧连接。
3. 浏览器增加独立本地加载、错误、取消页面，复用原 HeroUI Pro EmptyState 三份源码、现有 compose 和编译 CSS；MCP 官方文档请求本次 HTTP 504，按项目规则本地复用，无新依赖。source-manifest.json 保存 SHA。不能把 Pro 源码称为 Codex 官方源码，既有许可边界保持。
4. 明确 `dns_blocked`、网络、超时、取消、非公开地址，沿 typed 工具回执进入过程卡；拒绝空 HTTP 代理错误页作为成功正文。错误页没有 Node / 业务 preload，不能成为模型 DOM、截图或来源；新导航能够恢复。
5. 截图前激活对应原生 view 并等待两个实际绘制帧；空截图不保存为成功。任务取消会真实停止加载及连接，迟到解析不得创建新连接。Pi 唯一 loop、原 Hana search/reader/snapshot/ref、学生脱敏与教师写入确认保持。

## 实际验收与终态

命令工作目录 `D:\WorkProject\EduProject\apps\desktop`。Node 脚本使用本机 bundled Node24；`npm.cmd run build` 包含 TypeScript 与 Electron/Vite。开始有用户 PID66208，未强杀、未写其 profile；初期采用 `--outDir test-results/xiaozhi-agent/web-recovery-build` 独立构建。之后真实观察无用户 Electron，才更新正常 `out`。测试均为自有隔离 profile，未发送真实教师任务、未维护真实凭证或修改真实业务库。

| 验证 | 命令 / 结果 |
|---|---|
| 构建 | `npm.cmd run build`，正常 out 最终 build exit0；截图与取消 epoch 适配后的日志为 `web-recovery-final-build-3.log` |
| renderer | `node scripts/renderer-component-state-test.mjs`，79/79 exit0 |
| DNS 恢复与拒绝边界 | `node scripts/xiaozhi-agent/pi-web-auto-dns-smoke.mjs`，12/12 exit0，最终 `pi-web-auto-dns-7Oa4b1` |
| Hana / Pi 搜索读取与设置边界 | `node scripts/xiaozhi-agent/pi-web-boundary-smoke.mjs`，13/13 exit0，最终 `pi-web-boundary-kAk8S8`；HTTP MockAgent，只证明边界 |
| 原生浏览器 | `node scripts/xiaozhi-agent/pi-browser-native-smoke.mjs`，17/17 exit0，最终 `pi-browser-native-xiPFIx`；DOM动作使用明示合成夹具，Example / 教育部用真实公网。当前系统模式失败→可见状态→同组改自动恢复，两个实际窗口尺寸，错误页不成来源 |
| 实际代理取消与迟到 DNS | `node scripts/xiaozhi-agent/pi-browser-proxy-cancel-smoke.mjs`，4/4 exit0，`pi-browser-proxy-cancel-ANUMl0`；真实自有 HTTP/TCP，进程内 DNS mock，验证停止关连接且旧 DNS 不覆盖新失败，切换解析清旧状态 |
| 正式聊天页面 | `node scripts/xiaozhi-agent/pi-web-ui-smoke.mjs`，正常 out、真实 Pi / DeepSeek 与 AnySearch / 教育部，19/19 exit0，最终 `pi-web-ui-F8sk6m` |
| 原浏览器动作与审批 UI | `node scripts/xiaozhi-agent/pi-browser-ui-smoke.mjs`，11/11 exit0，`pi-browser-ui-UIZZDo`；真实 Pi/DeepSeek，DOM夹具，不冒充第三方页面 |
| 主用户路径门禁 | `OMNI_EDU_TEST_BUILD_ROOT=.../web-recovery-build` 后 `node scripts/electron-smoke.mjs`，207/207、ok=true、exit0，`web-recovery-main-smoke.log` |
| 复用核验 | `node scripts/xiaozhi-agent/verify-web-reuse.mjs`，原 Hana 3 与 Pro 5 SHA 对比通过；新增 EmptyState 3 另有源/hash清单 |
| 收尾 | `git diff --check`，无 whitespace 错误，仓库 LF/CRLF 提示单独保留 |

正式 19 项从输入框发送真实请求开始：**未进入设置的默认自动搜索 → 读取教育部 2022 课程通知 → 分段说明/工具/最终答复 → 来源与读取时间 → 1366×768 / 1920×1080 → 点击来源 → 拒绝伪造来源/旁路窗口 → CAS → 运行中锁设置 → 停止 → 冷重启保持来源且不重放 → 实际浏览器打开教育部正文 → 无效地址的可见错误与回执 → 不存在公开通知失败 → 主动关闭联网 → 无 renderer 异常**。发送后输入框仍清空。

本轮真实公网成功发生在当前网络，**没有验证关闭 VPN 后的网络**，不因此宣称 P08 无 VPN / 打包或全站访问完成。原匿名 AnySearch 的可用性和额度仍依赖第三方，不保证任何网站永远可访问。

## 保留的失败与改法

- `pi-web-ui-UFNZ2R` 第一次 6 项通过后定位来源失败：模型插入额外任务工具组，脚本错误地只展开第一个组。改为展开包含实际来源 callId 的组；保留失败报告和截图，后续 IIiMxF / F8sk6m 正式 19 项终态通过，没有修改产品来迎合定位。
- `pi-browser-native-Q6K5jo` 在同时运行两个原生实例时截图抛出 `UnknownVizError`，10 项后 exit1。补齐真实 view 激活及绘制等待，不吞错误或保存空图；`l4HUFs` 最终截图与全部 17 项 exit0。原错误报告保留。
- 不使用“联网未授权”概括已启用但遇到代理虚拟解析的失败；不删除 SSRF 校验、把虚拟 IP 当公网或改用户全局网络。

## 查看证据与继续位置

- [正式公网浏览器](../apps/desktop/test-results/xiaozhi-agent/pi-web-ui-F8sk6m/real-moe-browser.png)
- [正式浏览器失败页](../apps/desktop/test-results/xiaozhi-agent/pi-web-ui-F8sk6m/visible-browser-failure.png)
- [虚拟解析失败页，实际 1366 窗口](../apps/desktop/test-results/xiaozhi-agent/pi-browser-native-xiPFIx/visible-dns-failure-1366.png)

重新启动后的日常使用默认自动。若之前手动保存了“系统默认”，打开小智模型设置的联网页选择“自动（推荐）”并保存，再发任务；历史失败记录不会伪装成成功。日常启动见 [启动.md](../启动.md)。

下一步恢复 `docs/146_PI_ATTACHMENT_LOCAL_OCR_DELIVERY_CONTRACT.md` 的本地 OCR / 教师校正完整切片，以现有代码和真实内容验收重新核状态；随后 D3-C 明确公开图用途与真实 Pi 视觉、D4 实际查看回执、E / 全 D1–D7 / P08 无 VPN 与安装最终实例。三元题组保持暂停，无子 agent / 提交 / push。本轮不对未验收的 OCR 状态做完成承诺。
