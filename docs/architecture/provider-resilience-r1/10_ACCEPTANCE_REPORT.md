# Provider 恢复 R1 验收

判定依据为工程包的 `05_ACCEPTANCE_CRITERIA.md`。基线、首次实际验证及固定证据根见 [09 状态](09_STATUS.md)。当前 7/36 项通过。待完整运行的条款保持 `NOT_RUN`，已观察的子条件另记证据。

| 条款 | 当前状态 | 已验证的子条件和剩余范围 |
| --- | --- | --- |
| AC-01 | PASS · 已实现 | 固定 22 条故障矩阵与 8 条补充混合、未知和不可信来源反例全部通过。证据见 WP-01。 |
| AC-02 | NOT_RUN | 实际 MCP 权限否决、既有审批、资源锁、取消和非法输入均验证零外部请求与零健康增量。业务 CAS、来源冲突及通过真实 Effect 的组合对照待补。 |
| AC-03 | PASS · 已实现 | 真实 HTTP、直接受控 stdio、Managed stdio 同一来源重新核验、SQLite 原信任与选中工具读回，恢复后真实读取。正式生产 Pi 在故障和冷却期仍成功调用内置文件列表。 |
| AC-04 | NOT_RUN | 已验证 HTTP Schema 漂移、Managed stdio 原绑定不兼容及信任撤销时不尝试重连。还需包、凭证、Instance、Binding、Grant 与驻留的完整变体。 |
| AC-05 | PASS · 已实现 | 真实 HTTP 探测冻结在 `tools/list`。SQLite 并发更新信任、撤销、删除、更换凭证，旧成功或失败均不能变更新版本。另观察 SQL CAS 冲突和无信任旧行冷启。见第三轮。 |
| AC-06 | PASS · 已实现 | 四个不同生产 Pi session 的实际初始化累计 1/2/3/3。正式 Windows typed IPC 证实状态拦截、另一来源可用和重新核验。结合实际服务与故障域读回，符合冻结阈值。 |
| AC-07 | PASS · 已实现 | 模拟时钟下真实 HTTP 10 路只发一次探针，失败退避、实际取消时旧响应无法确认恢复。原授权和版本重新核验。真实 429 的 Retry-After 未提前发送。 |
| AC-08 | NOT_RUN | 实际闭合 Electron 后冷启动，同一合成凭证仍受原 Retry-After 约束，零请求、零扣减。另一合成凭证可用。真实 Windows 系统挂起及完整矩阵仍待验。 |
| AC-09 | PASS · 已实现 | Windows Pi 经真实 loopback 收到短 Retry-After 的 429、无效 Retry-After 的 503、最终 200。物理请求、SQLite 发送事件和原预算一致，长 Retry-After 期间无后续尝试。 |
| AC-10 | PASS · 已实现 | 真实 Windows loopback 的模糊 POST、收到部分文本后断流、401/403 和底层重试提示各只发一次，原模型与配置入口保留。成本未知，记录为 `null`。 |
| AC-11 | NOT_RUN | 实际旧读取未归还前，同一输入不得再次触发读取。原只读 EBUSY 补发与停止回归通过。尚需串联真实业务和 R1 资源租约计数。 |
| AC-12–36 | NOT_RUN | 按冻结合同逐项运行，实际组合候选和最终 main 均尚未形成。 |

## 首轮 HTTP 故障证据

- `wp02-mcp-http-behavior-red.log` 为真实失败。服务端收到初始化请求，原已验证哈希却被清空。`wp02-mcp-http-red.log` 中早先的 `invalid_input` 是夹具输入形状错误，记录保留，未计作行为红灯。
- `wp02-mcp-http-final-inspection.log` 使用实际 HTTP、SQLite、授予的 MCP/网络/出站权限和原权限引擎。断开没有增加工具调用，正常重连只增加一次读取。配置页检查超时也保留选择。恢复后旧客户端被拒绝，Schema 变化时连接不进入执行。原始 SQLite 快照和服务计数保存在 `mcp-http-reconnect-9cCfe6/report.json`。
- `wp02-permission-transports.log` 中授权、输入、认证和撤权等 11 项既有回归通过。`wp02-windows-stdio-final.log` 中现有 Windows Electron/stdio 生命周期回归 11/11。两者各自的范围见日志，暂时断开后的 Managed MCP 转发接续仍需专项验收。全部使用合成夹具，真实付费调用为 0。
- `npm run build -- --outDir test-results/provider-r1-mcp-http` 与渲染组件门禁通过。实际隔离窗口已启动，主进程 SHA-256 为 `6a19e4efbc41eb978b2511c2c3c9a9a640bb170fd7848283a22b3e87ac325eb7`。窗口、数据根与构建核对见 `wp02-manual-window.json`。依赖锁未动，审计记录 30 条通报，其中 5 条 high。

## 第二轮 Managed MCP 故障证据

- 运行 `node scripts/xiaozhi-agent/phase5-mcp-lifecycle-smoke.mjs --managed-recovery`。在 Windows 10.0.26300、Electron 43.8.3、Node 24.12.0 源码构建环境及独立 SQLite 下，`managed-red/runner.log` 显示真实 AppContainer 断线后进入 Resolver，断言实际发起 0 次握手，预期 1 次。`managed-final/runner.log` 和 `report.json` 为修复后结果，14/14 通过。固定程序、工作区源文件和 SQL 底层审计均可由报告的数据路径读回。
- 在同一 adapter 中，两个并发的原绑定请求共享一次失败的真实握手，服务恢复后共享一次成功的真实握手。实际读取返回固定内容，未再启动第二个进程，原 Artifact revision 未变化。平台不兼容和撤权后的新请求均未启动进程。逐条终态回执校验 Job 内进程为 0、Profile 已清理、应用添加的 ACL 为 0。夹具使用实装权限和 Windows Job。第三方 npm 发行包与跨 owner 的共享限制仍待实测。
- 已运行直接 HTTP 重连 1/1、权限传输 11/11 和渲染组件 261/261。证据分别为 `wp02-mcp-http-after-managed.log`、`wp02-managed-permission-transports.log`、`wp02-managed-renderer.log`。桌面产物见 `wp02-managed-build-final.log`，独立启动见 `wp02-managed-manual-window.json`。真实付费请求为 0，本切片未修改模型选择、请求重试或提示词。AC-34 留待完整差异判断。

## 第三轮 SQLite 代际屏障证据

- 在 Windows 10.0.26300、Node 24.12.0 上运行 `node --experimental-transform-types --test scripts/xiaozhi-agent/provider-mcp-sqlite-generations.test.mjs scripts/xiaozhi-agent/provider-mcp-reconnection.test.mjs`，通过 11/11。完整命令输出见 `wp02-sqlite-generation-final.log`。其中 10 个用例覆盖 AC-05，每个用例保留实际 SQLite 和 `report.json`，目录由测试日志列出。
- 控制真实 loopback POST 返回的先后次序。撤销、删除、更换凭证和修改工具选择各验证一次迟到成功与失败。持久化新版本后释放旧响应，读回整行与新版本逐项一致，服务端工具调用均为 0。已返回并通过 transport 代际检查的旧成功结果另获实际 SQLite `conflict`，保留新工具选择。旧失败库经关闭和重新打开，未授权时自动连接为 0，最终只经已有检查与明确选择入口恢复工具定义。
- 同批权限传输回归 11/11，见 `wp02-sqlite-transports.log`。仅增加测试与证据，使用 `ce0150d` 的产品代码和已启动构建。

## WP-01 第一轮故障语义

- 原始冻结夹具 SHA-256 为 `e4ef64b55ecb80aa75dce373bfa7b430153ad467041d197f5c84942ecdfc9820`。`node --experimental-transform-types --test scripts/xiaozhi-agent/provider-fault-policy.test.mjs` 通过 30/30，见 `wp01-fault-matrix-final.log`，原始 input、actual、expected 见 `provider-fault-cases-kVCZvO/report.json`。补充了模型供应商自述、资源与超时混合、取消或撤权优先级、未知 Effect 优先于业务冲突、无拒绝证据的 503。决策无外部时钟依赖。
- `5a307da` 真实 loopback 红灯见 `wp01-live-metadata-red.log`。工具未 dispatch 时，已连接的一次元数据请求丢失，原来仍为 ready。修复后 combined Node 测试 42/42，见 `wp01-fault-and-mcp-green.log`。成功恢复后，已 dispatch 的工具响应断开仍只有 1 次实际调用。Windows AppContainer 同批 14/14，见 `wp01-windows/report.json`。
- `request-recovery-smoke.mjs` 通过 11 项。实际 Electron/Pi `request-recovery-electron.mjs` 在隔离数据根用合成 HTTP/SSE 响应通过 10 项，见 `wp01-model-recovery-electron.log`。503、HTTP500 上限、认证、余额、长限流和已接收部分流行为沿用原次数与版本。停止等待可中断且之后无新增 wire attempt，冷启读回原 SQLite 事件。真实模型调用为 0，模型选择、提示和重试策略没有变更。AC-02 与 AC-09–11 仍按原合同补充门禁。
- `npm run build -- --outDir test-results/provider-r1-fault-policy` 通过，渲染组件 261/261。已核对独立窗口和实际构建指纹，见 `wp01-manual-window.json`。依赖锁未改，审计保留在 `wp01-npm-audit.json`。

## WP-01 普通工具边界回归

- 主进程边界 21/21，原文件工具 7/7。证据 `wp01-tool-boundaries`，包括无效输入零 dispatch、权限拒绝单次、原资源限制和取消等反例。合成工具的回归仅证明其所在执行边界。
- `ordinary-tool-recovery-electron.mjs` 首次报告 4 次原始文件读取。`wp01-ordinary-tool-read-inventory.log` 对应实际调用栈和 SQLite 显示其中两次为工具尝试，两次为工具完成后的验收读回。修正夹具，将读取阶段分开计量并验证模型只请求一次工具。下一次捕获了停止后界面已经展开时被测试再次关闭的情况，证据 `wp01-ordinary-tool-electron-corrected.log`。测试改为读取面板展开状态后按需点击，并保留原内容及 300 毫秒反馈断言。
- 正式 Electron 最终 6/6，见 `wp01-ordinary-tool-electron-final.log` 与 `xiaozhi-ordinary-recovery-ui-oEtnEY/report.json`。实际占用时成功或失败均最多两次读取。停止反馈为 38.96 毫秒，停止后仅有一次已发文件读取、一次已发合成模型请求。冷启未增加调用或改变文件与事件 hash。AC-02 全项仍待健康计量和权限/Effect 对照。

## WP-03 第一轮 MCP 运行健康

- 真实 `initialize` 断线红灯在 `8facf3c`，三次失败后再次准备和显式检查仍各发送一次，共 5 次。见 `wp03-shared-mcp-red.log`。修复后 `wp03-source-gate.log` 48/48，同一健康域三次失败后无额外连接。冷却结束后十个并发准备只有一个物理握手，Schema 重新核验成功后清零。注入真实 HTTP 429 与 `Retry-After: 120` 时，另外一个端点仍可工作，同一端点在早 1 毫秒时仍无发送。证据包括每条隔离 SQLite、服务计数和脱敏的域键。
- `provider-mcp-health-ipc.mjs` 在实际 Windows Electron 产物通过 3/3。`mcp-health-desktop-fmjQPa/report.json` 记录主进程 SHA-256、preload 结果、实际 SQLite 和重新连接的间隔 12,138 毫秒。未依赖模型账户，恢复过程中没有发送工具业务调用。Windows 受管 stdio 生命周期 14/14。渲染组件 261/261。
- `wp03-mcp-permissions-ac02.log` 12/12，原权限引擎及真实 HTTP 确认无 Grant 时写入待审批记录。无效输入、权限拒绝、资源占用、取消均无实际请求，健康快照前后一致。有效授权仍可执行原工具。
- 现有模型请求的白名单、长 Retry-After 和三次上限回归 11/11。模型域尚未接到健康协调，未发真实模型请求。真实生产宿主 Effect 回归 5/5，见 `wp03-mcp-effect-host-final.log`。首次运行在编辑期间发现源文件变化，保留 `wp03-mcp-effect-host.log`，冻结源文件后以 944 个输入无漂移复跑。独立窗口见 `wp03-manual-window.json`，回退见合并记录。

## WP-03 第二轮跨会话熔断验收

- `node scripts/xiaozhi-agent/mcp-effect-host-smoke.mjs` 通过 6/6。`mcp-effect-P3g135/REPORT.json` 保留四组不同的 Session ID、Run ID、实际合成模型请求与外部服务计数。连续四个宿主请求在真实 MCP 服务的握手计数为 1/2/3/3，没有额外业务工具请求，原信任存留。报告内同时保留生产 Effect 的五个原有回归用例。
- `wp03-mcp-production-sessions.log` 记录 944 个源输入和 0 条漂移。与正式 preload 的来源隔离、熔断拦截、恢复证据以及实际 HTTP 执行的健康清零合并判定 AC-06。实际失败探针、取消探针与冷启动仍按 AC-07/08 补齐。

## WP-02 第四轮 Windows 受控 stdio

- `node scripts/xiaozhi-agent/phase5-mcp-lifecycle-smoke.mjs --managed-recovery` 15/15。新用例在真正 Windows AppContainer 中停住直接工具准备的初始化，确认 SQLite 原 Schema 与工具选择保留、Job 释放，再用同一授权读取固定文件。原 Managed 用例保留实际读取及撤权反例。证据见 `wp02-direct-stdio/runner.log`。
- 正式 Electron 宿主 `mcp-effect-host-smoke.mjs` 6/6，`mcp-effect-TMPXp8/REPORT.json` 记录四个生产 Pi session 均在 MCP 故障期间通过实际内置工具列目录。外部 MCP 初始化累计 1/2/3/3，无额外外部任务调用。原五组 Effect 回归保持通过。`worker.log` 记录一次 Chromium 网络服务重启。

## WP-03 第三至第五轮模型与取消探针

- `6d2a9c1` 真实 Windows 基线证实三次失败后，下一轮仍发送一次。保留 `wp03-model-wire-red.log`。接线后先通过 4 项窄回归。混合 429/503/200 的完整场景发现，SDK 正常结束的同时取消包装读取，会误占用健康结算。诊断证据在 `model-wire-health-sbW7A0/report.json`。修复后等待底层取消或 EOF，并同时要求 SDK 原生终态确认，才结算成功。
- `provider-model-health-electron.mjs` 正式 Electron / Pi 和真实本机 HTTP/SSE 8/8，见 `wp03-model-wire-final-fixed.log` 和 `model-wire-health-hlEZum/report.json`。`wp03-model-wire-sqlite.json` 从实际 `app.db` 核对 11 个运行，发送事件计数、服务实际次数及原预算逐项相等。原桌面请求回归 10/10，渲染组件 261/261，最终构建及独立窗口证据分别见 `wp03-model-wire-build-final.log` 和 `wp03-model-manual-window.json`。使用合成模型响应，真实付费调用为 0，AC-34 留待组合判断。
- `22650c0` 的红灯显示停止后准备仍在等待远端探针。传递原 Run 取消信号后，实际取消先于迟到的 HTTP 响应，健康域保留 Open、失败数维持 4。等待满足后只用原 Schema 核验，旧代际响应不影响恢复。证据见 `wp03-mcp-cancel-red.log`、`wp03-model-source-all.log` 与 `mcp-sqlite-generation-cRMHZF/report.json`，最终 Node 合并门禁 53/53。

## WP-03 第六至第七轮冷启动与读取退出

- 冷启动基线 `88c2dca` 在同一隔离 SQLite 中读回记录，重启后一轮向仍限流的服务发送 1 次请求。见 `wp03-cold-red.log` 与 `model-wire-health-1Ycxwz/report.json`。修复后复用设置表保存有界的冷却账本，真实 Electron 退出并重启后仍是零请求、零扣减。更换合成凭证可实际发送 1 次。生产 `powerMonitor` 回调通过事件注入触发，已检查没有主动执行或缩短冷却。正式回归 11/11 见 `wp03-cold-final.log` 和 `model-wire-health-S6Qd9E/report.json`。系统挂起与恢复保留待验。
- `wp03-cold-source-final.log` 记录 Node 56/56，覆盖真实 SQLite 关闭与重开、时钟回拨、健康代际和空闲缓存回收。账本只保存随机 salt、不可直接识别的域键和期限。无表结构变更，原设置、任务和事件继续使用现有表。
- `feb632b` 复现第一次工具调用超时但底层仍在读取时，第二次已开始。见 `wp03-physical-read-red.log`。修复后只有实际结束才解除同会话、同工具、同输入的占用。主进程边界 22/22 和已有 Hana 文件工具 7/7 分别见 `wp03-physical-read-green.log` 和 `wp03-ordinary-tool-regression.log`。最终正式 Electron 文件回归 6/6，报告为 `xiaozhi-ordinary-recovery-ui-s5orMb/report.json`。还未串联原生 worker 租约与跨业务预算。
- 最终构建见 `wp03-cold-build-final.log`，渲染组件 261/261 见 `wp03-cold-renderer.log`。真实付费调用为 0。依赖锁未动，审计见 `wp03-cold-npm-audit.json`。
- 原桌面请求回归串行运行通过 10/10，停止反馈 186.63 毫秒，见 `wp03-final-request-recovery-serial.log` 与 `xiaozhi-request-recovery-ui-ZBDmxf/report.json`。第一次与文件桌面回归及渲染组件同时执行时为 362.87 毫秒，未达 300 毫秒门槛，原样保留在 `wp03-final-request-recovery.log` 和 `xiaozhi-request-recovery-ui-b6gfTi/report.json`。混合负载下本轮未确认能稳定满足该门槛。

## WP-04 恢复基线

- `phase6-provider-resume-smoke.mjs` 10/12，证据 `wp04-resolver-starting-baseline.log` 与 `xiaozhi-phase6-provider-resume-pyQazG/report.json`。R01 在调用前失败，R08 无执行记录。现有夹具 Adapter 缺少 `schemas`，其中 R08 将 stat Provider 绑定在合成的写入能力。先用符合生产合同的两个原生 stat Provider 复核实际路径，再判断是否需要调整产品。原失败报告保留。
