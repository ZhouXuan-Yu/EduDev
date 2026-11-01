# Canonical D 原生 PDF/OCR runtime 就绪记录

2026-11-01 05:39（Asia/Shanghai）完成用户授权的本机文件安装及验证。仅表示 runtime 文件就绪，不代表应用启动、扫描件 OCR 准确率或产品验收通过。

- 来源：`D:\WorkProject\EduProject-sidebar\apps\desktop\.local-ocr\file-v3-dist\omni-edu-ocr`（本 worker 已验证的独立 runtime）。
- 目标：`D:\WorkProject\EduProject\apps\desktop\.local-ocr\file-v3-dist\omni-edu-ocr`。
- 安装前目标缺失；仅复制 canonical D 源码 manifest 声明的 **646 文件，共 279,039,929 bytes**。全部文件复制后逐项 size/SHA256 核对通过。
- Manifest：`D:\WorkProject\EduProject\apps\desktop\src\main\xiaozhi-agent\ocr-runtime-manifest.json`；安装前、复制前及完成后 SHA256 均为 `f104de59595f82c594ebde4582efefe1c6f94b6805d09b78937f1468a33a1f30`。
- 已对每项 source/target 解析路径检查根目录包含关系，拒绝路径穿越、重复 Windows 路径及符号链接/reparse point。文件以 exclusive-create 写入，无覆盖；若安装前目标已存在，操作逻辑仅验证，不复制覆盖。
- 入口：`omni-edu-ocr.exe`，9,030,297 bytes，SHA256 `a255021f4a0a9c372ddfc00ead893cb1fd8de8a9b60bd045edcf509afffb567d`。

Canonical D HEAD 保持 `7c767fe2c61d002d2c23eab18c0235b956ec88ba`；安装前后 tracked status 和 `git diff --binary HEAD` SHA256 均相同（`874a3202434f6466b8e83b52673f02e61ad0fe39086184811017e1934a846f86`）。原有 `docs/integrations/ANATOMY.md` 与 `科普课件使用.md` 修改保留。D 盘 Git 跟踪文件及源码未改；此说明新增于 sidebar 协作工作树。

没有删除文件、安装依赖、修改共享数据或 Python 配置；未修改生产/backend/vendor，未执行 build、Electron、模型或 worker。安装命令 exit 0。此目录是当前源码开发宿主的固定原生 runtime 位置；`OMNI_EDU_PYTHON` 不能代替该目录。最终 canonical D 最新源码启动及真实 UI 验收由父串行执行。

## 2026-11-01 16:51 D盘最新源码启动补录

- main与任务分支正常推送至 `2749d3d2974165f2ca3764dd6cef31db7f223e5f`，D盘从7c767fe以 `git merge --ff-only` 快进；未移动占用main的其他工作树。上述安装时HEAD仅为历史记录。
- `npm.cmd start` 在 `D:\WorkProject\EduProject\apps\desktop` 执行，使用本目录自己的依赖重新运行完整build/TSC，exit0，再启动交互Electron。未复制sidebar的out或依赖。首次误在仓库根执行的ENOENT失败另行保留，没有启动旧产物。
- 生产源码及package/lock相对已验63e3无差异。独立D盘out共455文件，main入口SHA256为 `e2a6718b14c51c745b49f26e54a239f97a763ff601722617dce4466e6fe9d1ea`。D盘renderer为 `index-1coUF9SJ.js`，不冒称与sidebar目录构建的全体指纹相同。
- 实际main PID `52540`，命令为D盘 `node_modules\electron\dist\electron.exe` 加D盘 `out\main\index.js`。CUA选定窗口 `5247138`，AX文档URL为 `file:///D:/WorkProject/EduProject/apps/desktop/out/renderer/index.html`；执行窗口自身Raise并目视截图，已确认首页、原输入工具栏和按需关闭的右栏可见。没有发送模型请求或修改该会话。
- 另有beca工作树Electron窗口存在，保留未动。D盘三份原有未提交文档的size/SHA256在快进前后和启动后全部一致。
- 本地完整运行记录：[canonical-launch-final.json](../../../apps/desktop/test-results/ui-goal-20261101/canonical-launch-final.json)；构建日志：[canonical-start-desktop-final.log](../../../apps/desktop/test-results/ui-goal-20261101/canonical-start-desktop-final.log)。原失败日志为同目录canonical-start-final.log。

后续仅提交此交付记录的文档变更，D盘可再次快进，不改变已启动的生产源码。可见窗口及构建通过不替代教师验收、OCR准确率、完整ChatGPT parity或内容质量全部通过。

## 续接02：1b19e88日常版实际启动

- `1b19e8875d9d3fb298c5b140bdfaad57750cf7f2` 已正常推送main与任务分支，含本片aa95请求范围提示、真实重开QA及协作者窗口几何修复。D盘此前由协作者更新至d76e6e5；本片未回退，而是正常ff至1b19e88。
- 重启前CUA确认日常窗口输入为空、无进行中的停止入口；旧主进程58588已退出后才启动新主进程，未强杀。首次日志重定向至D盘不存在的test-results子目录失败，npm没有执行；改为已存在的sidebar证据目录后，实际 `npm.cmd start` 在D盘apps/desktop运行，build/TSC与启动命令exit0。此命令失败不计为功能回归，也不冒称首次命令成功。
- D盘使用自己的依赖重新构建，未复制sidebar out/node_modules。src tree为 `8382190bfa58728772960ee073aa924874e8d326`；455文件out SHA256 `cc699cd47b43a381cfabd584169dc0060c10898453ff49e306b2d8d1b8b64695`，main入口SHA256 `41410cc4eed549391887ea51f537a346431864d06d245ae600f3575aedd60d42`。renderer `index-CP10PA5h.js` 与sidebar产物名不同，不把不同根目录构建指纹混同。
- 新main PID54720，命令为D盘electron.exe加D盘out/main/index.js。CUA选择窗口1839426，文档URL为 `file:///D:/WorkProject/EduProject/apps/desktop/out/renderer/index.html`；Raise后AX及目视截图均确认首页、原输入工具栏、固定底部设置、按需关闭的右栏可见。未发送对话或修改权限。D盘3份未提交文档size/SHA256全部保持原值。
- 完整本地证据：[canonical-launch-continuation-02.json](../../../apps/desktop/test-results/ui-goal-20261101/canonical-launch-continuation-02.json)、[canonical-start-continuation-02.log](../../../apps/desktop/test-results/ui-goal-20261101/canonical-start-continuation-02.log)。本机日常启动不替代隔离fixture、教师验收或完整ChatGPT parity；M4字数/变式条件余项仍保留。

U4-A持久手选题篮在任务分支继续实施，当前日常版不冒称已包含。后续仅文档提交的ff不要求重建上述同一生产源码。
