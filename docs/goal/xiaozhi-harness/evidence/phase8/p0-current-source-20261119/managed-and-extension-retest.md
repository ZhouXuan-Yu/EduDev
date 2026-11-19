# 托管 MCP 与 Extension 独立复核

独立 Sol 在 `23f656797f049359bc52014367c9b9a66fcfb455` 上核对生产 Host 与 11 套防御专项。当前域内 643 个主机和共享文件逐份哈希无变化。主线同步后，Harness 该范围仅更新生成的核心工具清单，另有知识库共享代码变更。测试使用合成文件和 loopback 响应，付费请求 0。

| 专项 | 通过 |
| --- | ---: |
| Extension 原生、包、协议 | 21/21、18/18、16/16 |
| 实际 stdio、MCP 生命周期、HTTP 传输 | 5/5、11/11、11/11 |
| PowerShell 权限、Skill 私有来源、获取生命周期 | 9/9、8/8、14/14 |
| 实际 Host 托管 MCP 和 Extension | 5/5、6/6 |

合计 124/124。关闭后分别冷读托管 MCP 4 个 Run、13 个回执，Extension 3 个 Run、12 个回执。Run 均为 succeeded，回执均为 settled，已准入回执带原合同。固定 filesystem 工具经过同 Task 确认、准备和真实调用。Extension 的两种 hook、挂起关闭与冷启动状态已各自检查。所有原有拒绝尝试保存在回执中。

两个准备失败属于临时测试依赖根校验。用原 package.json 和同工作树锁定依赖恢复原测试信任根后复验成功。旧 `pi-mcp-boundaries.mjs` 独立记录 26 项通过，1 项以过时的 60 毫秒参数失败，2 项未运行。当前合同限定 1000–60000 毫秒；保留整套失败。

A-P0-02、A-P0-03、A-P0-05、A-P0-06 在当前支持范围达到标准，已实现。A-P0-07 还缺托管 MCP 同 Task 撤销后零新增派发。A-P0-08 还缺生产学生 SQLite 脱敏与实际 HTTP 端点零外发的组合验证。最终打包和独立终验继续执行。

本机复盘可读取 `%TEMP%/p8df-5f6dd39f/FINAL_REPORT.md`（SHA-256 `c76287d631220edcffb2d595f05a82f3df7d6b7408f1d184db55b5b4af1f7aeb`）和冷读 `%TEMP%/p8host-19d34290/COLD_READBACK.json`。
