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
