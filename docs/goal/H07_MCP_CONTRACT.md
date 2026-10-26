# H07 可控 MCP 工具层交付合同

日期：2026-10-16
状态：首片实现与正式实例已完成，收尾门禁记录见 HARNESS_EXECUTION；H07 整体仍 OPEN。

## 目标

在小智唯一 Pi Agent Loop 中接入受控 MCP 客户端，支持教师显式配置本地 stdio 或远端 Streamable HTTP server，并把 server 的工具纳入同一个工具回执、权限和失败语义。MCP 是产品扩展能力，不接入 Codex CLI，不启用 Pi 的全局/项目自动发现。

## 当前缺口

- `@earendil-works/pi-mcp` 1.0.2 已锁定，但生产没有 MCP server 管理入口。
- Pi 内建工具有 H04 的执行/回执/权限边界，MCP 工具必须复用这条执行链，不能绕开 `createPiXiaozhiSession`。
- 设置页已有模型、技能、工作目录入口，没有 server 目录、信任状态、schema 变更和撤销入口。

## 本片精确改动

1. 新增 shared MCP 配置、公开状态、校验和错误码；凭证只保留主进程私有引用，不进入 renderer、日志或报告。
2. 新增 main MCP catalog/adapter：配置版本、transport、server identity、工具 schema hash、scope/effect 映射、显式信任、撤销和连接失败状态。
3. 新增 SQLite `app_settings` 命名空间 `xiaozhi.mcp.v1` 的 CAS 持久化，不新增表；旧数据无该 key 时返回空目录。
4. 适配 Pi `ToolDefinition`，只注册已启用、已认证、schema 未变化且 effect 已知的工具；未知 effect 或 schema 变化返回阻断状态，不静默执行。
5. 增加 typed preload/IPC 管理入口和设置页 MCP 面板；首片支持添加、刷新、信任/撤销和移除，调用链仍由 Pi host 负责。
6. 增加受控 HTTP/stdio MCP server 反例测试：tools/list、tools/call、错误、schema/address 变化、凭证泄漏、断线/超时、撤销和未知 effect；另用正式 Electron/DeepSeek/Pi 验证真实设置操作与持久回执。

## 不做

- 不读取 `~/.pi/agent/mcp.json`、`.pi/mcp.json` 或全局扩展。
- 不安装第三方 MCP 包，不自动执行 server 命令，不自动 OAuth，不新增远端服务。
- 不把 MCP 工具标成教育事实来源，不允许修改 SQLite/题库/学生数据；可写副作用必须继续经过教师确认和现有宿主工具。
- 不宣称 H07 或 H10 完成；真实国产公网 MCP 只读实例、重启后的生产调用和日常说明书验收留到后续切片。

## 验收与回滚

- `npx tsc --noEmit`、renderer 套件、H07 专项反例脚本、`git diff --check` 必须通过。
- 反例不得被 UI 或模型自评吞掉；每个状态有明确 `unknown/blocked/ready/failed/revoked`。
- 回滚只删除 MCP catalog/adapter、IPC 与设置面板；保留 app_settings 历史，不影响内建工具和既有 Pi 会话。
