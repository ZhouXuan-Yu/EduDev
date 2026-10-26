# H09 125%/150% DPI 主工作区交付合同

状态：`LIMITED_ACCEPTED`

日期：2026-10-22

## 教师结果

辅导老师在 Windows 125% 和 150% 缩放下打开小智，主聊天工作区、三条教师快捷入口、附件、资料权限、技能、模型和发送控件仍完整可用；1366×768 与 1920×1080 内容区域不得出现横向溢出、遮挡或不可达控件，浅色和暗色均保持可读。

## 当前能力与缺口

- 已接受 `--force-device-scale-factor=1` 的 1366/1920/390 布局证据。
- 已有原生窗口缩放、主题和部分保存 bounds 测试，但没有同一构建下 125%/150% DPI 的主聊天工作区矩阵。
- 不能把浏览器 CSS deviceScaleFactor fixture、只改Page zoom或只核 `devicePixelRatio` 当作 Windows 布局通过。

## 改动与验收

1. 新增 isolated Electron 测试，始终传`--force-device-scale-factor=1.25/1.5`和owned profile。
2. 每个 DPI 下设置真实内容区1366×768和1920×1080，核实际`innerWidth/innerHeight`与`devicePixelRatio`。
3. 浅暗主题分别检查快速入口、Composer、附件、权限、技能、模型、发送控制可达；无横向溢出。
4. 截图物理尺寸必须约等于CSS viewport×DPR，并保存四组图；人工查看最终实现。DPI和窗口尺寸必须来自真实Electron；浅暗允许在真实构建上使用Chromium媒体仿真，系统主题菜单切换另列未验。
5. 空会话只写草稿或快捷入口时不产生消息、run、模型或文件效果。
6. 失败先保留；修复后同构建重复。退出后0 Electron孤儿。

## 边界

本片只验证主聊天工作区布局与控件可达。真实读屏、全部动态审批状态、投影、安装包和无VPN仍独立OPEN。不新增业务功能、IPC、数据表或Agent Loop。

## 验收结果

构建`c7e088ca418a65a361d254482553a9c5b0c4fc0b5316f20e1380721fd972374b`/373。

- `pi-dpi-interface-ui-OACw5j`与`HEqdwU`同构建连续通过，各2项、8个视图。
- 真实Electron `devicePixelRatio=1.25/1.5`；1366×768/1920×1080在±2 CSS像素内，截图物理尺寸约等于CSS×DPR。
- 浅暗八图均无横向溢出；快捷入口、输入、附件、权限、技能、模型和发送控件在视口内；空会话消息0。
- 截图已逐张查看；DPI由真实启动参数决定，浅暗使用实际build上的Chromium媒体仿真，不称系统主题菜单切换已验。
- `WDyclk`是探针漏返回`quick`字段、`gzBVYy`是诊断断言读取字段错误；`BGoOWc/sFiyCB/1ghZOH`为`nativeTheme`赋值/重载仍不能刷新媒体查询的环境限制。均保留，不作为产品布局失败。

`npm.cmd run test:xiaozhi-dpi-interface`为复验入口。H09真人读屏、全部动态状态、系统主题切换和长任务性能仍OPEN。
