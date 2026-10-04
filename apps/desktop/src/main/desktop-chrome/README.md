# 小智原生窗口适配

窗口宿主使用安装的 Electron API，renderer 使用现有 HeroUI OSS 3.2.2 Button；原 Pro 壳组件不修改。Windows 使用 hidden/titleBarOverlay 原生窗控与真实 Menu。其他平台/OMNI_EDU_NATIVE_CHROME=0 保留系统框架；本轮只验 Windows。

`zcode-overlay.ts` 两个函数来自本地 ZCode `packages/desktop/src/main/desktopWindowButtonPosition.ts`，经 TypeScript AST 提取。完整 Apache-2.0 许可见 ZCODE-LICENSE；源与输出 SHA-256、菜单与 zoom 参考源登记在 source.json。源码审计运行 `node scripts/xiaozhi-agent/reuse-window-chrome.mjs --verify`，它不是运行证据。

必要适配：48px → 36px 当前 R2 布局基线。ZCode 自有 desktopZoom 的 level 为 1.1 步进，本宿主传入 Electron getZoomLevel，转换为原生 1.2 ** level，再按实际 zoom 同步 native overlay。菜单使用 ZCode 的 Electron role 模式，绑定小智实际动作，无账号、更新、日志上传、清库命令。原生 caption buttons 不在 React 中仿造。

固定 sender/mainFrame、菜单 group 与有界坐标 IPC；renderer 不能指定系统角色、任意代码、文件路径或 shell/URL。导航最多 80 项，仅窗口内 view/session ID；活动会话列表核验，归档移除历史，页面卸载后的晚到新会话结果不改当前页面。预览/导航不自动运行模型。

合同 docs/87；实例与精确限制 docs/88。没有新依赖、数据库变更或 API/文件权限。36px 与源码复用不等于 Codex 官方同源或已证明未知参考 DPI 下的一比一。

## 窗口几何（docs103→104）

`zcode-window-size.ts`由ZCode `desktopWindowSize.ts`原三个函数和target type经AST提取；constant适配原1360×900/min1100×720，类型以等价本地UI字段替换AppSettings。原函数体不改、沿用本目录Apache-2.0 LICENSE；`window-size-source.json`与`node scripts/xiaozhi-agent/reuse-window-size.mjs --verify`记录/核验source和output，静态证据不是实例通过。

`window-geometry.ts`主进程适配只保存userData/desktop-window.v1.json内version/x/y/width/height/maximized。严格schema/4KiB读取上限、显示器workArea裁剪；原resize防抖/normal-vs-maximized机制配合move/close微量同步原子写。native frame安装后重应用normal bounds，防止Windows分数DPI constructor每次抬高尺寸；不增加新授权或业务真源。坏/缺/未知/写失败只影响可选UI偏好，不妨碍运行、不打印路径/凭证。

`OMNI_EDU_WINDOW_GEOMETRY=0`仅回退原固定options，不读取/写入已有几何文件。小于1100×720的显示器保持原最低窗体约束并保证标题可达，不宣称全内容适配；多显示器算法边界与真实硬件/缩放切换的验收分开。
