# P06b-B3 原生窗口框架交付合同

日期：2026-10-03。M10/M01；设计真源 docs/67 R2；继 docs/85–86。完整目标继续 active。

## 1. 教师可见结果与当前缺口

当前 BrowserWindow 使用默认系统标题和默认菜单；Pi 工作区自 y=0 起，没有 R2 顶部浅青菜单/导航框架。原 Pro 壳、目录与预览已贯通，不代表 Windows 框架已完成。图查询 createWindow/trace 得到入口，但 snippet 行偏移，已核当前 index.ts:699 实际源码。

本轮顶部后退/前进、会话侧栏切换、文件/编辑/视图/帮助接真实动作；Windows 最小化/最大化/关闭由 Electron 原生 titleBarOverlay 提供。拖拽区与按钮分离，菜单原生弹出；本地导航不启动/重放模型任务。全局教育页面也保留可操作窗口框架。

## 2. 复用决定

- Finesse 0.20.0 的 product/AI console 检查反馈、驻留停止与布局；R2 截图优先于通用模板。
- HeroUI Pro MCP 已核 138 组件，没有 OS 标题栏；用已有 OSS 3.2.2 Button 作为菜单/导航触发，原 Pro AppLayout/Sidebar/FileTree 不改源。
- ZCode Apache-2.0 的 desktopWindowButtonPosition.ts：提取原 Windows overlay 高度计算及构造函数，常量 48 改为 R2 布局基线 36，接既有 Electron zoom；源/hash/许可证保存。ZCode 自有 level 使用 1.1 步进，本宿主传 Electron getZoomLevel，因此转换明确适配为原生 1.2 ** level，不能称其原转换未改。desktopApplicationMenu.ts 的 Electron role 菜单模式保留实际中文 edit roles；产品命令改接本项目，不复制其账号/更新/开发资源动作。
- Hana AppTitlebar/WindowControls 已查看：Hana 当前本地 desktop 源使用自绘窗控，不能声称就是 Codex 原生控件；本轮复用 Electron 官方 hidden + native overlay 方案，保留 Pi/Hana 唯一工具循环。
- 官方核验：https://www.electronjs.org/docs/latest/tutorial/custom-title-bar 与 /api/menu。原生菜单/窗控需要真实 Electron 实例，不能用网页截图证明。

## 3. 修改边界与数据

新增 shared/desktop-chrome.ts、main/desktop-chrome 模块及 ZCode 来源文件、typed preload 方法/事件、renderer desktop frame/navigation adapter 与作用域 CSS、专项实例脚本。index.ts 仅窗口 options/独立模块挂载；main.tsx 挂 frame/provider；App 仅导航回调适配；PiEducationWorkspace/PiWorkspaceShell 接现成操作。无表/业务 migration、无新依赖、无文件权限或 provider 配置变更。

桌面导航最多 80 项、只保留视图/会话 ID，窗口进程内；返回会话必须核当前活动列表，不恢复旧已归档权限。现有 current-session.v1 只 ID。menu IPC 固定 group/操作白名单，主窗口主 frame sender 校验，坐标有界；不允许 renderer 传 role/shell/URL/任意函数。模型正文/学生资料不进入 frame 状态。

## 4. 兼容、恢复与回滚

Windows hidden/overlay；其他平台保留原系统框架，本轮不声称跨平台验收。OMNI_EDU_NATIVE_CHROME=0 局部回滚默认系统框架；getDesktopChrome 明确 enabled，renderer 不占新高度。不变更系统 DNS/代理/VPN。原运行/审批/队列保持，离开/返回仅查看 host 真源，无新执行。

## 5. 完成门禁

- 实际 Windows Electron 1366×768 与 1920×1080 内容/外窗/scale/zoom/安全区分别记录；真实窗口截图必须含 native controls，并同时保留内容截图。
- main 菜单实际 click/accelerator 对应真实新会话/设置/侧栏/文件/编辑/缩放/帮助；后退/前进实际视图/会话，不创建额外任务。非法 sender/input 拒绝。
- 原生最大化/恢复及 OS 窗口截图，交互可达；100%/125% zoom 核 overlay 高度和右侧安全区，原 OS DPI 保留，不冒称参考 DPI 已知。
- npm run build、npm run test:renderer-components、专项窗口实例/必要文件与过程审批兼容、固定最终 out 主 smoke 207、原 Pro 来源核验、git diff --check。命令/通过/失败/skipped/限制写 docs/88 与四根文档。

## 6. 保留完整目标

本轮完成只勾 D4.3 原生窗口框架；D4 父项和 D1–D7 精准视觉仍按 docs/67 逐项关闭。之后 P06c 真实模型/设置，P07 Office/PDF/办公联网/图片回执，P08 实际无 VPN/安装与最终八组实例。未核原图 DPI、无参考展开菜单截图及 Codex 桌面源码，不能宣称官方同源或整体一比一。
