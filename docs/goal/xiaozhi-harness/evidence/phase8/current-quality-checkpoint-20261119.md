# 当前质量门禁证据

受测桌面源码含普通文本脱敏与 Word 组件并行校验。待实现的结构文件引用还未进入此包。桌面构建与便携包的 481 个 `out` 文件指纹一致为 `24bcc61fbb0e86c38338382d0a506bbee42beb17d84b737fc6559b473ce58ea7`。

| 项目 | 证据 |
| --- | --- |
| QG-01 TypeScript | `npm run build -- --outDir <owned-temp>/out` 的 `tsc --noEmit` 通过。正文脱敏专门类型检查同样退出 0。 |
| QG-02 Lint | 临时安装的 Oxlint 1.68.0，以默认 correctness 规则逐批检查自 `d50ef330` 以来变更且仍存在的 527 个非第三方 TS/JS 文件。0 error，170 warning，全部命令退出 0。保留完整诊断，项目运行时和依赖锁无需新增依赖。 |
| QG-03 相关单元与组件 | renderer 253/253，reasoning 19/19、continuity 9/9、预算 12/12、Word Office 12/12。真实 Host 和迁移另列。 |
| QG-04 迁移 | 原合成 SQLite 副本的 Pi 会话绑定/工作区/预算等 10/10，安装前 Skill v1 合成副本 10/10。验证幂等、旧教学和对话事实不变、未来版本拒绝。 |
| QG-08 开发及打包 | 开发构建完整通过。最新五资源 `electron-builder --win --x64 --dir --publish never` 完成，便携实测 6/6。前一完整五资源候选完成 NSIS x64，886,055,267 字节，SHA-256 `05d778c341b12a5892b1667bb9ffc58ad9da6954abcc6fec6820ccb531fc28ca`。 |
| IPC 暂存 | `pi-shutdown-ipc-boundaries.mjs` 5/5，Windows 包 Word typed preload 和冷读通过。完整 QG-05 继续复验页面及剩余场景。 |

迁移及 IPC 通过 `node --experimental-transform-types` 执行本仓库实际脚本。诊断 SHA-256 为 `de558cc85e4a6b3f175cfd19fbaa06f86b6e0058c389cd9dae2fdb00d370c602`，本机日志目录 `%TEMP%/edu-harness-lint-4fd6b255`。校验范围参考 [Oxlint 命令行手册](https://oxc.rs/docs/guide/usage/linter/cli.html)。

安装、快捷入口、卸载和最终冻结候选由 QG-09 与最后独立验收覆盖。A-P0-08 结构化标签仍 FAIL。

## Windows 安装前置检查

本机当前用户的桌面和开始菜单已有小智快捷方式，Windows Sandbox 不可用。仓库 `apps/desktop/scripts/release/test-nsis-install.ps1` 在执行 NSIS 之前会拒绝覆盖现有快捷方式。完整安装、实际快捷入口、安装后启动、卸载和数据保留须在独立 Windows 环境复验。现有应用与快捷方式的检查只读。可启动的实包和本地无签名 NSIS 证据已保存。
