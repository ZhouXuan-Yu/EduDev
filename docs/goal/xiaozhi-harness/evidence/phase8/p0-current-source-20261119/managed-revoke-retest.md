# 托管 MCP 同 Task 撤销复验

独立 Sol 在 `66c3ae7efc85876c854fba8e6eef33a76048b8ec` 使用原 Pi、Production Host、SQLite、固定 filesystem MCP 与 Windows 受控子进程。开始到结束共 780 个实际编译输入哈希一致。使用普通合成文件和 loopback 模型替身，付费 0。

| 正常撤销入口 | 冷读状态 | 撤销后同 Task 结果 |
| --- | --- | --- |
| 精确 MCP Grant | Grant revoked，服务和 Artifact ready | 旧回调权限不足，Pi 重调未新增派发 |
| MCP 服务来源 | 服务 revoked，原 Grant 撤销，Artifact ready | 旧回调与 Pi 重调未新增派发 |
| 能力 Artifact | Artifact 和服务 revoked，原 Grant 有效 | 已撤销来源优先，旧回调与 Pi 重调未新增派发 |

三支都先读取一次普通文件。合法读取后、旧回调拒绝后和 Pi 重调后，实际原生管道计数均为 16/16/16，tools/call 为 2/2/2，普通读取为 1/1/1。计数包含一次独立的服务健康读取。每支在原 Task 通过本地替代继续，Run succeeded。另由独立 Node 进程关闭后只读三份 SQLite，3/3。十二条原生终端均记录清理。

撤销后的托管只读失败保留为 `not_checked`；之前 HTTP 的不同效果语义继续按各自回执。与原 HTTP 和 Extension 证据共同支持 A-P0-07 已实现。首次冷读脚本误断言每支三条终端，实际各四条，修正为至少三条并逐一校验清理。保留首轮失败。

现有 `node --experimental-transform-types scripts/xiaozhi-agent/pi-mcp-boundaries.mjs` 重新运行通过 29/29。专项先确认旧 60 毫秒输入被拒绝，再用当前有效的 1000 毫秒预算核对三个离线服务共享时限，保留此前过时配置的失败报告。

本机详细报告 `%TEMP%/p8mr-7ec57555/FINAL_REPORT.md` 的 SHA-256 为 `c886d429ad9664892027bf4101695920c63c43e059f3e76f839aabe990718df5`，独立冷读 SHA-256 为 `a8411ace09aab49c85f19a8bbebf81fc620ddc6c76ed9ec9c6f2c4027006e905`。
