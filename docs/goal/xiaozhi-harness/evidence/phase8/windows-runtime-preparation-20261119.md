# Windows 打包资源准备

2026-11-19，工作树 `D:/WorkProject/EduProject-harness`。当前桌面构建源码为 `57d300d`，产物共 481 个，目录指纹 `0a8c18e8201b58b84c63b9acc7bb14208f65ab865b3f18e2125c7f46cde247f1`。本轮打包环境未发出模型请求。

| 组件 | 从已有锁定资源分文件复制和验签 | 体积 |
| --- | --- | --- |
| OCR | 712/712 | 279,128,229 字节 |
| 教育 Worker | 90/90 | 40,328,642 字节 |
| 本地检索 | 154/154 | 126,001,951 字节 |

`npm run release:prepare` 实际复核前三套通过，随后停在缺失重排运行时。重排资产从锁定 URL 下载。两次完整传输中断，保留日志。改用 34 个 HTTP 206 分段，逐段核对 Content-Range 和字节长度，再逐文件核对固定 SHA-256。重排模型 279,301,077 字节，SHA-256 为 `dd98f3e67837d23210a6b7550c08cced4f61845b940ac45be3565840a10f3244`。其余 6 个固定资产也通过 SHA-256 检查。

第一次实际生成的 156 文件运行时把此前中断留下的 11,079,949 字节临时文件一并收录。干净长路径重建后的 PyInstaller COLLECT 因 Windows 错误 206 退出。改用短路径重新构建，得到 155 个文件共 397,959,129 字节。固定模型与原构建输入一致，候选较原 157 文件的冻结清单有 24 个同名文件哈希差异、3 个旧文件缺失和 1 个新元数据文件，原锁尚未重写。

独立运行该干净候选的实际 `omni-edu-reranker.exe`，清空 PATH，使用合成中文题目和绑定父进程的原协议。验证模型与 tokenizer 标识、无效请求拒绝、纠正请求后相关性排序、长输入标记不完整，以及 EOF 正常退出。5/5，exit 0。局部候选在本机临时目录 `%TEMP%/rk-595b73fa`，最初下载与构建日志保存在 `%TEMP%/xiaozhi-reranker-build-9d0768c6f0f4426a96414a254899ffda`。

构建器已改为逐文件收录，三种额外文件实际未进包。路径和锁验证 12/12。采用实测候选的 155 项清单，`npm run release:prepare` 和 unpacked 的 afterPack 四套资源检查均通过。unpacked 程序的 481 个构建文件与输入相同，目录指纹 `b2b9b6f239c7ba209da37e30579e2b93789749ea764d266f30e4ae32bfc3002d`。该包早于 HTTP MCP 修复。[构建修复](windows-package-20261119/BUILD_FIX_REPORT.md)。

小智用实际 packed EXE、空 PATH、合成新资料目录和 profile 启动。教育 Worker、LanceDB、PDFium 直接探针通过。TXT/Markdown 可用，扫描 PDF、图片和 DOCX 未达标。原 SQLite 中图片 OCR 回执 complete，PDF 已有一页和一段，DOCX 已保存 OOXML 正文。独立复现定位到结构阶段。候选包缺少显式可选的版面分块组件，图片和扫描 PDF 的结构解析返回 unavailable。DOCX 原版转换尝试准备 LibreOffice，测试禁用网络返回错误并映射为 parse_failed。原失败报告的空网络数组产生于异常早于采集，定向探针捕获了被阻断的 MSI 请求。[真实导入失败](windows-package-20261119/unpacked-ui-failure.json) · [定向探针](windows-package-20261119/unpacked-import-structure-probe.json)。

已在专用工作树逐文件校验 767 项版面分块资源。在 `OMNI_EDU_BUNDLE_PAGE_BLOCKS=1` 下五套资源 preflight 均通过。后续使用这一显式配置以及独立测试 profile 的官方 Office 组件缓存验证完整结构导入，同时保留组件不可用时的证据。

当前用户桌面和开始菜单有指向日常小智的快捷方式，Windows 11 家庭版机器没有 Windows Sandbox。与真实安装和卸载相关的快捷方式、应用注册及数据保留仍需隔离环境完成。
