# Provider 恢复 R1 验收

判定依据为工程包的 `05_ACCEPTANCE_CRITERIA.md`。基线、首次实际验证及固定证据根见 [09 状态](09_STATUS.md)。当前 2/36 项通过。待完整运行的条款保持 `NOT_RUN`，已观察的子条件另记证据。

| 条款 | 当前状态 | 已验证的子条件和剩余范围 |
| --- | --- | --- |
| AC-01 | PASS · 已实现 | 固定 22 条故障矩阵与 8 条补充混合、未知和不可信来源反例全部通过。证据见 WP-01。 |
| AC-02 | NOT_RUN | 已在实际 HTTP 工具边界区分调度前的元数据损失与已发工具调用。现有权限、输入、取消、业务冲突等路径需验证实际尝试、健康计数、Effect 审计。 |
| AC-03 | NOT_RUN | 真实 loopback HTTP 和 Windows Electron Managed stdio 各已验证超时、SQLite 信任保留及同一只读能力恢复。直接 stdio 真进程的临时故障与恢复全路径及公开诊断仍须验收。 |
| AC-04 | NOT_RUN | 已验证 HTTP Schema 漂移、Managed stdio 原绑定不兼容及信任撤销时不尝试重连。还需包、凭证、Instance、Binding、Grant 与驻留的完整变体。 |
| AC-05 | PASS · 已实现 | 真实 HTTP 探测冻结在 `tools/list`。SQLite 并发更新信任、撤销、删除、更换凭证，旧成功或失败均不能变更新版本。另观察 SQL CAS 冲突和无信任旧行冷启。见第三轮。 |
| AC-06–36 | NOT_RUN | 按冻结合同逐项运行，实际组合候选和最终 main 均尚未形成。 |

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
