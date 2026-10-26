# Windows 安装包发布合同（2026-10-23）

## 目标

生成可由普通 Windows 用户安装、启动和卸载的小智桌面安装包。安装后不要求预装 Python；OCR、教育 Worker、Pi 主循环、SQLite 数据和教师审批边界保持现有实现。

## 依赖和许可

- `electron-builder@26.15.3`：MIT，作为开发依赖锁定。
- Python 3.13.17 Windows embeddable amd64：来自 python.org，ZIP 大小 11,441,267 bytes，SHA-256 `9e35319bffedab8b36ad44d8f377cb4f1733bcec257a0b6d04d94f01486ddb38`。
- 现有 OCR 运行时 `.local-ocr/resume-v2-dist/omni-edu-ocr`：646 files / 279,026,886 bytes，包含固定 manifest 校验。
- Electron 43.2.0 已在项目依赖中。

## 打包结构

- `resources/python-embed/python.exe`：教育 Worker 自包含解释器。
- `resources/ocr-runtime/`：现有本地 OCR 可执行运行时。
- `out/main/*.py` 和固定 wheels/worker vendor：放入 `app.asar.unpacked`，确保子进程可从磁盘读取。
- 生产仍只使用 Pi 主循环；打包不新增模型、Agent Loop、IPC 或数据真源。

## NSIS 行为

- x64，非 one-click，可选择安装目录。
- 创建桌面和开始菜单快捷方式。
- 默认按当前用户安装，不要求管理员。
- 卸载保留 `%APPDATA%/OmniEduAgent` 用户数据，除非后续提供明确的数据删除流程。
- 输出 `小智-Setup-0.1.0.exe` 及 `latest.yml`/blockmap（若 builder 生成）。

## 完成定义

1. `npm run build`、打包准备和 `electron-builder --win nsis --x64` 成功。
2. 解包目录中的 Python 能运行固定 reading/math Worker；OCR 能启动并返回非空固定结果。
3. NSIS 实际安装到 owned test-results 目录或测试安装目录，安装后程序可启动到小智主界面。
4. 安装版使用 `resources/python-embed`，不是系统 Anaconda；日常用户数据目录不写入测试夹具。
5. 卸载后程序文件被移除，用户数据默认保留；安装/卸载进程和测试 profile 可清理。
6. 安装包、大小、SHA-256、Windows 版本、截图和失败日志写入进度 JSON。
7. 安装包通过不替代真实教师、VPN-off、课程质量或投影验收。

## 回滚

- 删除本轮 release 产物和安装测试目录即可回滚。
- 不删除用户数据和既有 out 构建。
- 若 packaged Worker 失败，保留安装包和失败报告，修复后重新打包，不以开发目录结果冒充安装版。

## 执行结果（2026-10-23）

状态：`SOFTWARE_ACCEPTED_WITH_LIMITS`。产品构建 `4885c66d8ac165ada850e6b0f4d2d39e6adc67d0786fca9c23b1418d00d951d8` / 373 文件。

- `npm run build`、`release:prepare` 和 NSIS x64 打包完成；产物 `apps/desktop/release/小智-Setup-0.1.0.exe` 为 323,870,934 bytes，SHA-256 `69A743344293C0260FB95F8209DC0DD896E842CFA77F770B5D719250D9974768`。
- `win-unpacked` 中 `小智.exe`、`app.asar`、bundled Python、OCR 和 `.asar.unpacked` Worker 均存在；5 个关键 `out` 文件与 `app.asar` 内字节哈希一致。
- 从安装目录直接运行 bundled Python 的 reading Worker 得到 `ok=true / found=true`，math Worker 得到 `state=matched / conditionsVerified=false / sympy-1.14.0`；bundled OCR 识别固定合成图得到 3 行预期文字。
- NSIS 静默安装到 owned `test-results` 目录 exit code 0，安装结果 1000 文件 / 1,340,856,671 bytes。实际安装版由 Playwright 启动并断言 `app.isPackaged=true`、安装路径、隔离 `userData/sessionData`、owned data root 和 0 demo students。
- 安装版只显示“根据资料备课、讲清一道错题、做一份课堂课件”三个入口；点击备课入口只填入草稿、聚焦原 Composer，不发送消息或创建 turn。1366×768 浅色和 1920×1080 暗色截图已实际查看，横向溢出为 0，renderer error 为 0。
- 卸载后程序目录、`小智.exe` 和卸载器均移除；安装目录外的 owned profile 保留 50 文件、data 保留 7 文件，相关安装版进程为 0。NSIS bootstrap 将删除交给子进程，因此没有稳定保留最终子进程退出码，但直接 readback 完成。
- 首次打包在解包后长时间无进展并保留为失败；开启诊断重跑后确认应用树已完成，失败点是 NSIS 工具下载被服务器中止。预取并校验官方 NSIS archive 后，使用 `--prepackaged release/win-unpacked` 成功生成安装器。

证据：`apps/desktop/test-results/goal/windows-installer-20261023/progress.json`、`commands.ps1`；安装版 UI 报告 `apps/desktop/test-results/xiaozhi-agent/pi-windows-installer-ui-ahxYVO/report.json`。

开放边界：安装器和可执行文件未签名，Windows SmartScreen/签名发布策略未验；安装版 UI 使用 owned data/profile，未读取日常保存凭证；VPN-off、真人教师、真实学生图、课程质量、WPS 播放和物理投影不因安装成功而关闭。
