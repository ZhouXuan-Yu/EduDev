# Provider 恢复 R1 验收

判定依据为工程包的 `05_ACCEPTANCE_CRITERIA.md`。基线、首次实际验证及固定证据根见 [09 状态](09_STATUS.md)。当前模块阶段 21/36 项通过，其中 AC-19、AC-20 绑定资源调度 R1 依赖版本，Provider 组合须重跑。待完整运行的条款保持 `NOT_RUN`，已观察的子条件另记证据。

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
| AC-12 | PASS · 已实现 | Windows Electron 生产 Pi 在原 Task 内，从不可用的 Hana stat 切到已登记的 workspace stat。A 发起 0 次，B 发起 1 次，原要求版本、默认优先级和快照内容保留。实际 SQLite 有两条链接快照与一条成功执行回执。 |
| AC-13 | PASS · 已实现 | 实际 Registry/Resolver、原生只读 Adapter 与 SQLite 验证缺必要证据、自述证据、缺触发条件、撤销版本、新授权、驻留、预算、固定及两处忙碌屏障。每条实际替代为零，原任务、快照和 Effect 不变，返回真实原因和可执行的下一步。 |
| AC-14 | PASS · 已实现 | 正式 Windows Electron 启动同一 SQLite，原任务主动继续前实际模型请求为零。新 Run 使用旧 Provider 版本和 hash，保留原快照字节，追加带 `resume_revalidate` 的 lineage。真实快照、文件结果和两个 PID 可读回。 |
| AC-15 | PASS · 已实现 | Windows 生产文件经过两次明确拒绝，存入两份权威的未派发证明，重启并重新授权后各保存一次。未知写入、真实 HTTP 丢回执与真实终端未发布均受保护。已有文件和已匹配网络回执通过独立读回保持原物理次数。 |
| AC-16 | PASS · 已实现 | 等待提交时保留教师手工修改并拒绝旧文件版本。原任务暂停后修改要求 1→2，旧继续请求和迟到确认均失败，只按 V2 提交一份成果。真实网络 Grant 撤销会停止在途工作，显式续跑不重复派发。 |
| AC-17 | PASS · 已实现 | 正式 Electron 与原导出审批。真实 Word 已保存，原 PDF 导出任务在首个私有打印窗口退出后只补齐缺失 PDF。独立解析确认两种文件内容，SQLite 核对原确认、历史文件和各一次成功 Effect。连续打印失败的反例两次后停止。 |
| AC-18 | PASS · 已实现 | 正式 Electron 实测 HTTP 连接挂起与真实 Windows Job 异常退出及超时。故障期间另一会话查题、保存和独立 HTTP MCP 调用成功。真实迟到 stdout 未进入新请求。仅在原 PID、helper 与隔离目录清理后结算资源和回执。 |
| AC-19 | PASS · 已实现（依赖模块） | `ed618c1` 正式 Electron 的真实 OCR 故障及停止验证 4/4。旧进程实际退出后租约只结算一次，旧第 3 页未落库，独立教师保存成功。原任务复用前两页，只处理第 3–6 页，最终 SQLite 与「正文已收录」一致。Provider 组合阶段重跑。 |
| AC-20 | PASS · 已实现（依赖模块） | `ed618c1` 正式 Electron 的实际向量及 embedding 恢复 3/3。旧工作器在中段批次退出，原索引可查，替换进程从同一游标重做原批次。真实 embedding 30 秒超时后明确降级，旧管道结果隔离，恢复查询命中与基线相同的原文，SQLite 来源保持。Provider 组合阶段重跑。 |
| AC-21 | PASS · 已实现 | Windows Electron 原打印回执延迟交付期间，教师可停止，另一会话正常查题，同类 PDF 无法提前获得原配额。实际回执结算后清理，旧输出未写入，教师重新授权的新 PDF 通过独立解析。 |
| AC-22 | NOT_RUN | 七类实际 owner 各十轮和 PDF 阻塞关停已验证。实际 Provider 与调度 R1 同一候选的租约、旧监听器和临时项全量对账待验。 |
| AC-23 | NOT_RUN | 真实 Windows 系统休眠、重连及原绝对截止时间。 |
| AC-24 | PASS · 已实现 | 正式桌面在同一任务 lineage 中真实中断未知 DOCX 发布和原等待审批。冷启显示原成果、未知 Effect、原审批和旧快照。点击继续只执行原任务的核对，撤权后旧决定拒绝，原终端执行次数为 0。 |
| AC-25 | PASS · 已实现 | 原受权固定 recipe 编译实际 Windows helper，经原生 AppContainer 自检后激活，重复无有效改写，拒绝错误来源且保留原活动指针。 |
| AC-26 | PASS · 已实现 | 原权限对版本、撤权和用途继续生效。真实 Pi 模型工具调用不能关闭权限。未知 recipe 零派发，原 SQLite 损坏时完全保留原文件并提示恢复。 |
| AC-27 | PASS · 已实现 | 真实 Goal 遇到 503 原地等待，查询与独立保存不增加模型次数、进展和修订。原 Goal 恢复后教师确认完成。真实三轮停滞呈现准确，等待中暂停无后续物理请求。 |
| AC-28 | NOT_RUN | Goal 预算、停止及教师最终验收约束。 |
| AC-29 | NOT_RUN | 正式界面的健康、停止、回执未知和继续入口。 |
| AC-30 | NOT_RUN | 诊断导出脱敏、隔离、大小边界与 hash。 |
| AC-31 | NOT_RUN | DB R2 prepared-run 组合与旧库、损坏记录和回退矩阵。 |
| AC-32 | NOT_RUN | 组合下租约和 Agent Experience R1 的性能合同。 |
| AC-33 | NOT_RUN | 四类教学任务的无故障、可恢复和不可恢复矩阵。 |
| AC-34 | NOT_RUN | 按实际差异判定是否触发真实模型质量评测，再跑固定合同。 |
| AC-35 | NOT_RUN | 模块、真实组合候选和最终 main 的版本绑定与门禁。 |
| AC-36 | NOT_RUN | 实际 main 集成、核验与最终报告。 |

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

## WP-04 第一轮原生只读接续

- `6464760` 使用现有两个原生 stat 实现、真实文件和实际 SQLite，切换前红灯 4/5。原实现不可用时，主进程只返回 `needs_refresh`，替代实际读取次数为 0。见 `wp04-native-snapshot-red.log`。生产范围限定在已知原生 stat 合同，原请求未进入旧 Adapter，当前任务安全点允许，原要求有效，候选满足全部所需条件且在同一驻留约束内。复用已有 `explicit_refresh` 持久值和前序快照链接，保持旧版读回兼容。
- Node 真实文件和 SQLite 最终 7/7，见 `wp04-native-snapshot-guards.log` 和 `provider-snapshot-recovery-TRnzJe`。运行 `node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs --provider-recovery`，实际 Electron 43.8.3 / Pi 专项 1/1。合成 SSE 只发原 resolve、execute 和终态应答，宿主在处理中完成替代，无模型刷新请求。报告 `wp04-native-pi-report.json` 记录替代内容、版本、hash、Task 和 Snapshot。关闭后独立以 SQLite 只读方式核对，见 `wp04-native-pi-sqlite.json`。Chrome 网络服务有一次重启，见 `wp04-native-pi-worker.log`。
- 构建通过，见 `wp04-safe-stat-build.log`。原能力合同 10/10，渲染组件 261/261，日志 `wp04-predeployment-contract.log` 与 `wp04-safe-stat-renderer.log`。真实付费模型调用为 0。AC-34 仍留待组合差异审查。

## WP-04 第二至第三轮拒绝及正式冷启

- `034d472` 的原生只读矩阵以两套实际实现、真实文件、SQLite 和控制屏障运行。所有负例已经没有实际替代，但缺少与原因对应的后续入口，9 条行为断言失败。见 `wp04-refusal-red.log`。增加结构化原因和可继续动作后通过 11/11，见 `wp04-refusal-green.log` 与 `provider-snapshot-recovery-LTbXit`。断言包括原 Task、原 Snapshot、零 Effect 和零替代执行。合同缺失、驻留和权限仍由原 Resolver 判定。
- `node scripts/xiaozhi-agent/capability-phase2-production-smoke.mjs --provider-cold` 以两个真实且先后退出的 Electron 进程通过，见 `wp04-cold-actual.log` 和 `wp04-cold-host/`。随后从独立案例运行同一命令并附加 `--desktop-build <绝对路径>`，由生产 Electron 产物的 typed Preload 发出原明确继续请求。两次进程 PID 为 38800 和 55980。正式读取继承原 capability、版本 hash 和文件元信息。另一兼容 Provider 的声明耗时与优先级更优，普通解析排序选它，原任务继续仍保留旧快照。启动至继续前模型请求为零，继续后两次合成 HTTP 请求均使用原模型。见 `wp04-cold-formal.log`、`wp04-cold-formal/report.json` 和 `wp04-cold-formal/cold-identity.json`。
- 构建 `test-results/provider-r1-refusal-lineage` 通过。原 D2 合同 10/10，渲染组件 261/261，见 `wp04-refusal-build.log`、`wp04-refusal-d2-contract-final.log` 和 `wp04-refusal-renderer-final.log`。本段新增模型可见的结构化失败结果，AC-34 后续需要固定任务真模型对照，本轮真实付费调用为 0。

## WP-04 第四轮 Effect 回归与现行审批等待

- 实际 Windows 子进程 SIGKILL 和 SQLite 文件对账 `phase6-state-foundation-smoke.mjs` 8/8，原文件字节 hash 与物理生成次数保持稳定。真实网络回执和独立 HTTP 线计数 `phase6-network-effects-smoke.mjs` 8/8。两者使用 `node --experimental-transform-types`，原工作子进程也显式启用该模式。首次子进程启动失败及故障诊断目录缺失分别见 `wp04-state-foundation-node24.log`、`wp04-network-effects-node24.log`。复跑日志为 `wp04-state-foundation-final.log`、`wp04-network-effects-final.log`，原报告位于 `xiaozhi-phase6-state-ngB6UV` 和 `xiaozhi-phase6-network-effects-Ckqxng`。
- `non-dispatch-host-smoke.mjs` 现行代码实际到达第一条文件工具的已准入状态，等待教师授权。旧夹具却等工具回到模型并让模型生成两个调用后才检查审批，30 秒后超时。保留 `wp04-authoritative-no-dispatch.log`、`xiaozhi-non-dispatch-host-qiyTZ7/REPORT.json` 和实际请求记录。另一个 Windows 终端权限用例未到达最后断言，退出码为空，源输入 945 未漂移。保留 `wp04-terminal-effects-final.log` 与 `terminal-grant-rINQgw`。现有两组生产验收缺口仍需沿当前授权入口复现。

## WP-04 第五至第七轮权限与版本屏障

- `node scripts/xiaozhi-agent/non-dispatch-host-smoke.mjs` 4/4。生产宿主用当前权限入口逐一拒绝旧请求，得到两份 `host-filesystem-not-dispatched.v1`。关闭并重新打开 SQLite，再由教师显式授权，只有当前 Task 写入两份实际文件。再次继续时两份 SHA-256 不变，新增写入准入为零。原记录见 `wp04-permission-file-current.log` 与 `xiaozhi-non-dispatch-host-KCOWGz/REPORT.json`。只读复制对账 8/8，拒绝缺失、篡改、未知执行、跨版本或跨所有者的证明。见 `wp04-file-proof-readback-final.log`。
- `node scripts/xiaozhi-agent/terminal-grant-host-smoke.mjs` 5/5。实际原生终端审批前零启动，原任务授权后启动一次，其他任务或撤销后均未启动。另一条真实命令已执行但确认前停止，保留 `unknown` 及原执行身份。重开宿主后，用相同逻辑操作试探原 Task，实际启动总数保持 2，未确认文件仍未发布。见 `wp04-terminal-current-grants.log` 与 `terminal-grant-Lg9HGC/REPORT.json`。连续 HTTP 和本地进程失败切点另由第四轮文件、网络各 8/8 对照。
- `node scripts/xiaozhi-agent/provider-task-fence-host-smoke.mjs` 2/2。对真实确认中的文件手工写入，旧提议进入 `conflict`，保留教师版本 SHA。另一个任务暂停、订正后从要求版本 1 进入 2，新 Run 等待确认时才提交迟到的旧审批，结果为 `permission_denied`。旧文件未生成，唯一提交 Effect 属于 V2。在窗体可见校验前尝试审批及把机器核验项当做人类可编辑要求的两次夹具失败保留于 `wp04-task-fence-host.log` 和 `wp04-task-fence-published.log`。最终报告见 `wp04-task-fence-requirements-final.log` 与 `provider-task-fence-QKRQQd/REPORT.json`。真 Grant 撤销和在途响应边界见网络 N07。
- AC-17 预检 `paper-c2-office-recovery-focused-test.mjs` 连接阶段因 `store.openDatabase` 不存在退出，0 项业务断言。见 `wp04-office-recovery-existing.log`。未由此判定产品恢复行为。

## WP-04 第八轮原题卷部分导出恢复

- 基线产品代码 `7c27138`、复现提交 `079f303`。用当前 typed Preload 建立、确认并导出合成试卷，真实保存 DOCX 后，在原 PDF 导出任务的私有 `printToPDF` 接口注入一次已结算的错误。基线没有进入 PDF 审批，实际打印尝试 1 次，私有窗口已关闭。见 `wp04-paper-pdf-native-red-actual.log`、`provider-paper-export-HncUY5/report.json`。
- 原 owner 在首次打印明确失败且私有资源清理结束后，复核当前授权、确认源、工作区与目标文件，再在原时限内重试一次。导出成功以实际文件、原 SQLite 产物和绑定的试卷来源读回为准。中间验证识别出通用 Effect 读回未识别原题卷工具，保留 `provider-paper-export-s5PxUd/report.json`。
- 在 `apps/desktop` 运行 `node scripts/xiaozhi-agent/provider-paper-export-recovery-electron.mjs <绝对构建目录>`，再附加 `--keep-failing` 运行反例。正式构建为 `test-results/provider-r1-pdf-owner-receipt`，主进程 SHA-256 为 `b6511c2b6e075f8dc06d7cb50141975a957f5cfd90ac5780610863af04210e5e`。两次各通过 2 项。正例见 `provider-paper-export-3Yjuc0/report.json`，两次私有窗口先后销毁，Word 的 hash 与文件身份不变，PDF 审批前无目标文件，最终 Word/PDF 各一个持久化成功 Effect，DOCX XML 与 pypdf 分别读出同一题目。反例见 `provider-paper-export-Jo4fCp/report.json`，两次打印失败后无 PDF 或成功 Effect，原 Word 保持一致。真实付费模型调用 0。
- 正式构建通过、渲染组件 261/261，见 `wp04-native-pdf-owner-build-final.log` 和 `wp04-native-pdf-renderer.log`。依赖锁保持原样，审计记录 30 项已存在风险，其中高危 5 项，见 `wp04-native-pdf-npm-audit.json`。旧 Office 扩展回归运行了 16 项后，缺少脚本硬编码的历史数据库，整组未跑完，见 `wp04-office-artifact-foundation-node24.log`。AC-21、AC-22 的取消、迟到回调和实际 lease 归还仍按原要求实测。

## WP-05 第一轮 MCP 握手隔离

- `152380d` 在独立 SQLite 和两个实际 HTTP 服务上复现。首个已验证服务挂起至准备截止，另一个服务保持 `ready`，原运行可用 MCP 定义却为空。见 `wp05-preparation-isolation-red.log` 和 `provider-mcp-preparation-dB6rwC/report.json`。
- 同一 Run 最多并发准备四个连接，维持总准备期限和每服务的权限、信任与健康域。目录更新仍使用版本检查，按原目录顺序暴露已核验工具。关闭 Run/宿主时取消准备并等待对应传输清理。`node scripts/xiaozhi-agent/provider-mcp-preparation-isolation.mjs` 通过 3/3，见 `provider-mcp-preparation-47pieG/report.json`。覆盖另一连接实际调用、超时后旧响应与主动关闭。
- 正式构建 `test-results/provider-r1-mcp-preparation` 的主进程 SHA-256 为 `b474e3f9e0025926caa7fce8b1110bcfdc5d3cea0c9196db2ffa940c831566cc`。运行 `node scripts/xiaozhi-agent/provider-mcp-health-ipc.mjs <绝对构建目录> --preparation-isolation`，正式 Electron 通过 2/2。`mcp-health-desktop-wW6veK/report.json` 显示旧传输挂起后 157.3 毫秒另一服务回送 Schema，4.872 秒另一会话通过 Pi 搜索实际题库，4.879 秒保存另一道合成题并经 SQLite 验证，9.957 秒后原传输真正关闭。原服务故障后迟到响应未改变其目录记录。该测试控制单条连接挂起，服务允许另一条连接正常握手。
- 对同一构建正常运行 IPC 熔断回归 3/3，见 `mcp-health-desktop-IxMUnY/report.json`。Windows direct/managed MCP 工作者回归 15/15，生产宿主及 Effect 回归 6/6，渲染组件 261/261。日志包括 `wp05-preparation-stdio-regression.log`、`wp05-preparation-effect-regression.log`、`wp05-preparation-renderer.log` 和 `wp05-preparation-build.log`。锁文件无变更，审计见 `wp05-preparation-npm-audit.json`。真实付费调用 0。AC-18 的异常进程退出与独立会话同一时间线仍待补。

## WP-05 第二轮 Windows MCP 异常退出与真实旧输出

- 基线 `10f07c2`，复现提交 `d87cecf`。测试夹具只写独占 SQLite、AppContainer 投影和合成素材。使用真实 Windows helper 与已核验的测试包授权，同一正式 Electron 主进程走真实 typed Preload、Pi 调用及题库保存。最初尝试的 PowerShell 语法及临时文件观察分别保留在 `wp05-native-seed.log`、`wp05-native-stdio-initial.log`。随后改从实际 helper 帧观察 PID、退出及响应。
- 在 `apps/desktop` 运行 `node scripts/xiaozhi-agent/provider-mcp-stdio-desktop.mjs <绝对构建目录>`。基线完成两个故障隔离断言后，原子进程退出码 23，SQLite 的原权限 lease 却写为 `execution_completed`。见 `wp05-native-stdio-permission-red.log`、`provider-mcp-stdio-desktop-MJNLtV/desktop-report.json`。修复后 Windows Job 回执保留原始退出码，非零退出按失败结算，已有投影提交分支只在干净结束后可达。
- 正式构建 `test-results/provider-r1-mcp-native-exit`，主进程 SHA-256 为 `8ce5ce68ebf14695de0d59c8d0cbb49af6a3ccbaafd08b80e3631ce09c225d79`。专项 3/3，见 `wp05-native-stdio-final.log`、`provider-mcp-stdio-desktop-DwXfEw/desktop-report.json`。一次完整时间线中，原进程开始故障调用后 2.084 秒另一会话完成本地查题与保存、3.521 秒独立 HTTP 工具实际调用一次、8.584 秒原进程与 helper 退出并清除投影。第二个原进程超时后真实发出旧 stdout 并以 31 退出，原回执失败，后续新 Run 只返回新连接的回执。保留同一已验证信任。
- 同一构建的 HTTP 隔离重跑 2/2，见 `mcp-health-desktop-LzZLz7/report.json`。实际宿主与 Effect 回归 6/6，见 `mcp-effect-sim676/REPORT.json`。正式构建通过，Windows MCP 生命周期 15/15，渲染组件 261/261。见 `wp05-native-stdio-build.log`、`wp05-native-stdio-lifecycle.log`、`wp05-native-stdio-renderer.log`。已保留锁文件审计 `wp05-native-stdio-audit.json`，真实付费请求为 0。各执行器十轮资源回收仍由 AC-22 真实组合验证。

## WP-05 第三轮 OCR 实际退出与同源续页

- 沿用资源调度 R1 `ed618c1c68e3e5561fe57d7555e62073978ebc72` 的 `r1-office-fences` 正式构建。走现有资料导入、队列、PDF 文件型 OCR、预加载 IPC、SQLite 与共用的资源调度器。Provider 分支相对原 main 未修改该调用链的 OCR、PDF 文件宿主及材料队列。`wp05-ocr-runtime-preflight.json` 核对原生分发物 712 个文件，冻结六页扫描件 SHA-256 为 `cbff60e34d5ff6e57d9ee2ecaed8e5ea364e41a27e3e2f519ebeb92df2bd957c`。
- 在 `apps/desktop` 运行 `node scripts/xiaozhi-agent/provider-ocr-recovery-desktop.mjs <绝对构建目录> <冻结六页扫描件> <固定证据根>`。Electron 43.8.3 / Node 24.22.0，主进程 SHA-256 `0ff1d8e9dfd129037c616e6d1f7cd49e7f0fa2aa2ad544bd7ea37fa315dea23d`。正式结果 4/4，见 `wp05-ocr-recovery-final.log` 和 `provider-ocr-recovery-SuCzTu/report.json`。
- 首次真实进程在第 1 页持久化后非正常退出。第二轮在第 2 页持久化后点停止，测试的旧进程保持存活，实际产生第 3 页结果，交还给旧读取器的 1,393 字节未导致第三页落库。此时独立教师保存经 SQLite 读回。旧 lease `14` 收到 `cancel_requested` 后仍占进程额度，原 PID 关闭后才产生唯一 `actual_settled`。新 lease `15` 收尾时同样只结算一次。首次固定探针曾因即时整机降额误判，见 `provider-ocr-recovery-0NoWOY/report.json`。暂停式观测未完成，见 `wp05-ocr-recovery-lease.log`。最终从原调度器只读提取具体 lease 与状态序列。
- 第三轮原任务重试只收到实际 OCR 第 3–6 页。前两页摘要和原件 hash 保持，六页各保存一次。OCR 完成时原资料任务仍在运行，等后续处理实际结算后再核对原任务 `succeeded` 与可见的「正文已收录」。本轮代码仅新增验收入口，沿用原 R1 受控生命周期。Provider 与资源 R1 最终组合构建未形成，AC-19 须在组合重跑。真实付费调用 0。
- 新脚本通过 `node --check`，`git diff --check` 通过。锁文件内容未变，`wp05-ocr-recovery-npm-audit.json` 记录 30 项既有依赖通报，其中高危 5 项。

## WP-05 第四轮向量世代、游标与实际 embedding 超时

- 沿用资源调度 R1 `ed618c1c68e3e5561fe57d7555e62073978ebc72` 的 `r1-office-fences` 正式构建。主进程 SHA-256 `0ff1d8e9dfd129037c616e6d1f7cd49e7f0fa2aa2ad544bd7ea37fa315dea23d`，实际向量工作器 SHA-256 `464053d494c4006e4a9e80ecb88b94c0c6fd04eb0168d58d55e3cc51ca44be66`。`wp05-vector-runtime-preflight.json` 核对原生二进制及模型共 154 个文件。当前 Provider 分支相对原 main 未改检索生产代码。
- 在 `apps/desktop` 运行 `node scripts/xiaozhi-agent/provider-vector-recovery-desktop.mjs <绝对构建目录> <固定证据根>`。正式结果 3/3，见 `wp05-vector-native-uncached.log` 和 `provider-vector-recovery-HNX9uG/report.json`。通过现有资料库导入并索引 25 份合成资料，对两种改写确认题意检索首位命中真实几何来源。旧 active generation 保持可查，实际工作器在新的世代已有有效游标后退出，旧工作器的成功回执重放未推进原游标，替换进程对同一组八条索引事实重新生成回执。新世代只在完整追平后发布，游标终止，`applied_seq` 等于原事件序号 50，原数据摘要及索引数量保持。
- 正式原生 embedding 对查询实际生成结果，夹具在 stdout 边界暂缓交付，派发后 30.014 秒触发生产超时。返回 `embedding_unavailable`、`available=false`、`complete=false`，语义改写返回空结果，关键词仍能命中原文。旧进程尚存时交付其真实迟到数据 6,061 字节，下一查询仍未完成或启动新的 embedding。旧 PID 41064 关闭后新 PID 49524 才启动，成功命中相同 `resourceId/chunkId`。原始 native 管道和时间线见同目录 `embedding-trace.jsonl`。质量对照限固定原文、同一查询、来源与完整覆盖语义。
- 首次复跑定位到资料库展开后才出现重建按钮，见 `wp05-vector-native-initial.log`。真实世代退出已通过的中间复跑使用了原内存缓存查询，未触发原生超时，见 `provider-vector-recovery-WI7pvf/report.json`。正式测试使用在旧 utility 测过、在新 utility 未缓存的等义查询。测试入口和两处观测夹具通过 `node --check`，`git diff --check` 通过。依赖锁未改，`wp05-vector-native-npm-audit.json` 记录 30 项既有依赖通报，真实付费调用 0。嵌套模型常驻额度和多轮回收仍由 AC-22、AC-32 验证。

## WP-05 第五轮 PDF 窗口退出与旧回执

- 基线 `df24d1a`，测试提交 `143bc07`。Windows Electron 实际执行 `printToPDF`，测试在 Chromium 已生成 49,145 字节后暂停向主进程交付回执。点击停止后，旧版过早销毁窗口 2（渲染进程 9136），真实断言失败。见 `wp05-pdf-cancel-red.log` 及 `provider-paper-export-CaceVn/report.json`。
- 接入资源调度 R1 `ed618c1` 原有的 PDF 配额及宿主调度器，复用同一层实际 lease，包含图片和 HTML 准备、真实打印回执、原窗口和临时文件清理。重新打印前通过现有授权、记录修订、来源和目标校验。教师停止后拒绝旧回执写入，保留原 Effect 状态待对账。
- 正式构建主进程 SHA-256 为 `a2a589037b74bd60a0d124b9df93dc8657f301cfd194a41e639d05f876eb2606`，渲染入口为 `719270bcc6b4c9a4073d31ddd1d0bb18264cb9c6a9fe53f4b13b0d68fe4208e8`。窗口 2（渲染进程 48748）在停止确认后仍存活，500 毫秒的第二次同类准入等待超时，独立会话通过真实查题工具得到原题。回执交付后旧窗口关闭、专属临时目录消失、PDF 配额可重新取得。旧 run 持久化为中断，Effect 保持 unknown，未生成已保存回执。原试卷、Word 与教师笔记摘要一致。重新提交并获教师授权后，独立 PDF 与 DOCX 读取确认内容、答案和份数。见 `provider-paper-export-JWmNVd/report.json`，共 3/3。
- 同一构建复验暂态失败仅补齐缺失 PDF（2/2），持续失败为两次实际打印、零已保存回执（2/2）。分别见 `provider-paper-export-ZIgwaM/report.json`、`provider-paper-export-2xZ4gV/report.json`。命令为 `node scripts/xiaozhi-agent/provider-paper-export-recovery-electron.mjs <本轮实际构建>`，分别使用 `--cancel-in-flight`、默认模式及 `--keep-failing`。
- 正式构建、渲染组件 261/261、资源压力与调度合同 10/10 均通过。原日志为 `wp05-pdf-lease-build.log`、`wp05-pdf-lease-renderer.log`、`wp05-pdf-lease-resource-contract.log`。依赖锁未变，审计维持 30 项通报（高危 5 项）。实际模型付费调用为 0。各 owner 多轮回收与不退出实例留给 AC-22。

## WP-05 第六至八轮 执行器资源结算与关停

| 路径 | 实际结果 | 本地证据 |
| --- | --- | --- |
| Windows MCP stdio | 10 次故障 owner，独立会话继续查题。Windows AppContainer 的子进程、helper、Job、投影目录均退出或清理。真实旧 stdout 在原超时后到达，后续工具仅接受新回执。旧版物理退出后仍有 1 个数据监听器，修复后 stdout 和 stderr 监听器均为 0，权限审计与发生的效果一致。 | `provider-mcp-stdio-desktop-nMsRyq/desktop-report.json`、`provider-mcp-stdio-desktop-aPNeA4/desktop-report.json` |
| MCP HTTP | 10 次本地真实连接断开，记录关闭回执和同一来源的重新握手。独立来源始终正常，原已核验的 Schema 保持一致。 | `mcp-health-desktop-DgpQMU/report.json` |
| OCR | 同一正式资源 R1 桌面执行 10 次故障 owner。检查原材文件摘要、实际 PID、nonce、页码 checkpoint、准确的 lease 和每轮恰好一次 `actual_settled`。确认取消前景独立保存、旧输出不覆盖原页。 | `provider-ocr-recovery-ABeSuf/report.json` |
| 向量和 embedding | 同一个资源 R1 桌面各 10 次。原始向量 utility 的 PID 与世代退出后，旧回执不推进游标。新 utility 用原游标恢复。原 ONNX 请求超时后发生真实迟到管道回执，旧子进程关闭前未开启新模型进程。关闭后连续 10 次恢复同一来源。21 个观测到的原生进程在测试退出后均已结束。 | `provider-vector-recovery-YrDust/report.json`、同目录 `embedding-trace.jsonl` |
| 本地文档解析 | 实际 Electron utility 使用正式构建内的 `document-worker.js` 读回 DOCX。基线原消息监听器为 1，修复后停用和恢复的各十个物理子进程均以 0 个专属监听器结算；在该旧子进程仍活着时，全部八个真实槽位保持占满，迟到合法回执不能覆盖取消。 | `provider-document-owner-SvZLHL/REPORT.json`、`provider-document-owner-rjBNMO/REPORT.json`、`wp05-ownership-document-contract.log` |
| PDF 同进程循环 | 10 个唯一浏览上下文和临时目录，记录实际窗口/PID、原 Chromium 字节、停止与结算。停止后原 PDF 类目不可重新准入，各轮窗体、监听器和临时项目均回到基线。 | `provider-pdf-lifecycle-QvWfb2/report.json` |
| PDF 长时间无法退出 | 旧版主进程在真实打印回执尚未交付时退出。修复后保留原窗口及租约，5 秒后提示，并可开新会话。继续等待时相同槽位仍不可用。由原窗口再次触发退出，经真实回执和清理后进程以 0 退出，重启读回原中断任务、原 Word 和教师确认，无 PDF 已保存记录。 | `provider-paper-export-EnivwN/report.json`、`provider-paper-export-Ac46n7/report.json` |

正式构建主进程为 `9b018a32ac40ef0898078b0f629ea7dae42a9c86c815920e9895ba8bbb13d6a6`，渲染入口为 `719270bcc6b4c9a4073d31ddd1d0bb18264cb9c6a9fe53f4b13b0d68fe4208e8`。同一源码构建时 `npm run build` 通过，渲染组件 261/261，文档生命周期合同 4/4。依赖审计锁未改，30 项既有通报含高危 5 项。模型付费请求为 0。

三次实现验证分别消耗 WP-05 第 6、7、8 轮。保留 MCP 池超时和测试上下文被压缩的原始失败。反例中的旧进程信号只对合成服务延迟交付，重跑在同一 Electron 实例以两个获授同一固定能力的会话复用原 Provider，从而单独测量 owner 回收。AC-22 暂不计入必需项完成数。

## WP-06 冷启基线

- 当前 Node 24 需通过 `node --experimental-transform-types scripts/xiaozhi-agent/phase6-startup-recovery-smoke.mjs` 运行原 TypeScript 依赖，实际 SQLite、Task 和 Journal 冷启 2/2。原 strip-only 错误、修正命令和读回分别见 `wp06-cold-current-contract.log`、`wp06-cold-current-contract-transform.log`、`xiaozhi-phase6-startup-recovery-hhJRGv/report.json`。
- `node scripts/xiaozhi-agent/phase6-recovery-host-parent.mjs` 使用真实 Electron Host 及受控终端，H01–H04 共 4/4。冷启原任务、显式继续、缺失或损坏 JSONL 的受控重建，以及 native binding 失败回滚和再次继续通过。见 `xiaozhi-phase6-recovery-host-Ps7VIq/report.json`。此基线未覆盖同时存在原待审、撤权、未知 Effect 和旧快照的前端场景。
- `file-stage-recovery-electron.mjs --build <实际构建>` 在实际 DOCX 专属临时文件写入后、原子发布前终止隔离 Electron 进程。冷启零模型请求，原 HTML 摘要和修改时间不变，前端显示待核对，点核对只清理记录的临时文件。第二次重新启动状态一致，4/4。见 `xiaozhi-stage-ui-yXh0ko/report.json`。

## WP-06 固定修复与危险请求拒绝

- `node --experimental-transform-types scripts/xiaozhi-agent/permission-phase3-runtime-smoke.mjs` 原生实测 5/5。合成旧元数据触发内置源码配方，实际编译固定 helper、以 Windows AppContainer 运行健康命令并核实摘要，之后才发布活动指针。再次准备 `changed=false` 且数据库仅有一次实际构建意图。错源拒绝且原活动指针字节一致。见 `wp06-fixed-native-runtime-report.json`，原报告 SHA-256 为 `cfc00f84f83d2e98fcbcb97ded1ec8511542fcbef16c1762b35812c56654c9d1`。
- `node --experimental-transform-types scripts/xiaozhi-agent/permission-phase3-store-smoke.mjs` 15/15。真实演练目录与 SQLite 验证写入失败无成果、配置修复后重复不写、hash 变化拒绝、未知字段保留、撤权后实际写入数为 0，以及分别受控的所属网络与出站授权。见 `xiaozhi-permission-phase3-store-fm6TSd/report.json`。
- 在主进程 `9b018a32ac40ef0898078b0f629ea7dae42a9c86c815920e9895ba8bbb13d6a6` 的正式桌面，预加载拒绝未知下载、数据库自动修复和关闭权限。缺凭据时显示原安全入口。使用隔离合成模型响应，实际 Pi 对 `environment_repair(recipe=disable_permissions)` 返回失败回执，无 Effect 写入，原资料和配置字节不变。另一个真实桌面用损坏 SQLite 冷启以退出码 1 停止，原始 DB SHA-256 `5d1fc514904bc265b8fb840f2b21d200b3405bbb023db96af04b0117b7d44017` 不变，弹窗指向备份和诊断。见 `provider-environment-refusal-LLBMS8/report.json`，3/3。
- 运行证据统一在指定验收根中。固定修复沿用权限引擎、已有 recipe 和原数据路径。本切片只增加真实验收入口，无生产行为变更和实际付费调用。

## WP-06 同一任务的冷启审批与未知结果

- `file-stage-recovery-electron.mjs --build <实际构建> --continue --pending-approval` 通过 6/6。正式 Electron 首先在合成 DOCX 原子提交前终止。原 HTML 成果、两条未知 Effect 和其绑定的旧 Provider Snapshot 保留。冷启等待教师操作，核对 DOCX 唯一临时文件，未接触无关文件。
- 教师从实际任务卡点击继续，Pi 在同一 Task 新世代产生真实等待审批，不执行终端。再次精确终止验收 Electron 主进程后，独立进程冷读零模型请求，实际恢复卡显示原审批仍待处理。又一次显式继续发出一条合成模型请求，Task ID、要求版本、原快照 hash、未知 Effect 与原 HTML 完全一致。随后用真实撤权入口撤销相关 Grant，原 approval 失效，提交旧版本审批被拒，终端派发审计数仍为 0。见 `xiaozhi-stage-ui-KqOoHK/report.json`。
- 保留三条中间失败证据。原核对卡需先展开，`xiaozhi-stage-ui-DHkcoK/report.json`；Office 审批阻塞同一顺序工具批次，改为同一任务跨世代生成待审，`xiaozhi-stage-ui-b7mv9a/report.json`；Windows 包装进程 PID 与真实 Electron 主进程可能不同，`xiaozhi-stage-ui-B7T1gp/report.json`。最终先核对实际主进程 PID、构建和隔离 profile，再终止目标进程。无生产改动和付费模型调用。

## WP-07 Goal 健康等待与停止原因

- 基线 `provider-goal-recovery-ORPtEL/report.json`。实际 Goal 在三轮未新增证据后正确保存了停止状态，最终显示错误的 `skill_source_changed`。SQLite 的原事件序列先持久化 Goal 停滞与中断，再产生错误的权限复核提示。宿主结束当前 Task 后，Pi 返回时额外读取旧技能授权导致诊断错误。
- 最小修复沿 Pi 原终止决定收尾，终止后的旧 owner 跳过最终权限复核，活跃模型与工具的交付继续走原检查。正式主进程 `f4d2be02d2eb773bb18d7ad45ef9e5d93aa394d2095f341ad380211dc2430431` 实测 `provider-goal-recovery-Mmmiae/report.json`，3/3。原 Goal 的 503 至第二次尝试期间，重复读取四次和另存合成题库记录均未增加请求、核验证据或 Goal 修订，约定等待 2.5 秒。恢复沿同一 Goal 和原 Run，读到合成文件真实标记，再由教师确认完成。SQLite 对账共 4 次模型调用和 2 个工具，`activeMs=7012`、`waitingMs=0`。停滞 3 次准确报告 `goal_stalled`。暂停场景只接收了 1 次实际请求。
- 同一源码的 Goal 状态合同 16/16、技能隔离合同 14/14、渲染组件 261/261 和正式构建通过。原始证据见 `wp07-goal-boundary-baseline.log`、`wp07-goal-owner-skills.log`、`wp07-goal-owner-renderer.log`、`wp07-goal-owner-build.log`。另复跑最新构建的模型恢复与注入生产 powerMonitor 恢复事件 11/11，见 `model-wire-health-qQxxCd/report.json`。真实 S0 仍由 AC-23 单独验收。
