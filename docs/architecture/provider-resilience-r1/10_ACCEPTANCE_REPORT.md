# Provider 恢复 R1 验收

判定依据为工程包的 `05_ACCEPTANCE_CRITERIA.md`。基线、首次实际验证及固定证据根见 [09 状态](09_STATUS.md)。当前 2/36 项通过。待完整运行的条款保持 `NOT_RUN`，已观察的子条件另记证据。

| 条款 | 当前状态 | 已验证的子条件和剩余范围 |
| --- | --- | --- |
| AC-01 | PASS · 已实现 | 固定 22 条故障矩阵与 8 条补充混合、未知和不可信来源反例全部通过。证据见 WP-01。 |
| AC-02 | NOT_RUN | 实际 MCP 权限否决、既有审批、资源锁、取消和非法输入均验证零外部请求与零健康增量。业务 CAS、来源冲突及通过真实 Effect 的组合对照待补。 |
| AC-03 | NOT_RUN | 真实 loopback HTTP 和 Windows Electron Managed stdio 各已验证超时、SQLite 信任保留及同一只读能力恢复。直接 stdio 真进程的临时故障与恢复全路径及公开诊断仍须验收。 |
| AC-04 | NOT_RUN | 已验证 HTTP Schema 漂移、Managed stdio 原绑定不兼容及信任撤销时不尝试重连。还需包、凭证、Instance、Binding、Grant 与驻留的完整变体。 |
| AC-05 | PASS · 已实现 | 真实 HTTP 探测冻结在 `tools/list`。SQLite 并发更新信任、撤销、删除、更换凭证，旧成功或失败均不能变更新版本。另观察 SQL CAS 冲突和无信任旧行冷启。见第三轮。 |
| AC-06 | NOT_RUN | 已通过真实 HTTP/SQLite、不同来源隔离和正式 Windows typed IPC 的单设置窗口用例。仍需多个实际产品 session 的组合测试。 |
| AC-07 | NOT_RUN | 实际 HTTP 10 路只发一次探针，真实 429 的 Retry-After 未提前发送。失败、取消、代际的确定性检查已通过，生产跨 owner 反例待补。 |
| AC-08–36 | NOT_RUN | 按冻结合同逐项运行，实际组合候选和最终 main 均尚未形成。 |

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
