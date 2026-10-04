# P07-B Office/PDF 正文与可打开产物交付合同

日期：2026-10-04。M02/M09/M10；承接109、113，页面与公开过程固定67的R1/R2及§1/2/5/8/9。总目标仍active。

## 1. 已核事实与复用决定

- 当前正式文件面板只有UTF8文本、Markdown、图片与不支持格式的metadata。85–86/113的通过不能证明Office正文。
- 图谱本轮已查EduProject/openhanako；新文档提取模块未命中，回到实际源码。Hana0.449.0 `lib/document-extract/{index,types,anydoc-loader}.ts`直接以buffer调用AnyDoc，50MiB输入上限、懒加载、扫描PDF失败；授权属于调用方。
- 本项目没有独立已接入的Python Office Worker。vendor DeepTutor document_extractor.py存在，但依赖FileTypeRouter/可选Python库；不得把源码存在写成已运行解析服务。现有db.ts只对local text直接解析，非文本有needs_parser；已有DOCX/PDF导出另核真实内容/中文/A4/打开证据。
- 选择直接移植Hana三个独立文件，Apache-2.0，逐文件原字节与移植hash/许可证记录。精确锁定`@firecrawl/anydoc@0.1.2`，MIT，npm元数据Node>=20；主包41713B，win32-x64-msvc0.1.2原生包8321924B。增加约8MiB Windows原生模块，无模型/网络解析请求。原生包需实际Electron utility进程加载、构建external和最终Windows包解包验证；不能以npm声明当打包已过。
- 官方说明用于核对本地解析/无OCR：[AnyDoc源码与说明](https://github.com/firecrawl/anydoc)。不使用托管Firecrawl Parse，不改变学生原图本地规则。

## 2. 分切片贯通，完整B完成定义不缩减

### B1 本地正文预览（先实施）

1. shared追加Office格式、版本化本地提取结果/安全失败码，旧files.v1请求兼容，不改已有teacher资产事实。
2. 实际bytes经既有workspace lease、Hana readable resolver、链接/版本/大小约束读取；在独立Electron utility进程调用原Hana提取，不在主进程解析不可信native文件。
3. Worker协议固定v1/request ID/精确键、50MiB输入、1MiB正文输出、15s deadline；取消/超时杀掉该worker，bounded stderr，单请求单进程并沿既有8槽上限。只接受DOCX/PDF/XLSX/PPTX；不执行宏/链接/脚本，不拉远程图片。不保存原文到公开过程或模型。
4. typed既有files-preview/cancel贯通，结束后再次核验lease/文件版本。renderer沿现有原Pro FileTree/OSS Tabs/Markdown预览，明确“本地提取正文”，格式/扫描PDF需OCR/损坏/取消/超时/超大有中文状态；新请求/关闭/换会话不会显示迟到结果。
5. 合成四种真实文件及扫描PDF/损坏/权限/版本/取消实例；原字节hash不改、实际断网预览可运行。1366×768/1920×1080控件可达。只验预览不能勾完整B。

### B2 正式Pi受控正文读取工具与来源

复用B1同一提取边界、实际源hash/版本；沿当前source_read与教育脱敏、execution registry/Hana once、原budget/cancel，不加循环。请求明确必要正文范围；本地原文不默认进模型。来源页/幻灯片/工作表/段落必须来自解析器真实定位，拿不到就标识未定位，不推算页码。独立native能力marker在旧fingerprints后追加，旧native副本验证保持；真实DeepSeek自然任务、工具回执、文件预览与实际内容一致。

### B3 可编辑草稿与正式导出

核现有DOCX/PDF创建与artifact事实，能复用就复用；必要表格/课件另复用许可明确库，不手写第二Office解析器。共享产物schema/来源谱系、教师确认→实际受控产物→readback→可打开/拒绝/冲突/恢复。至少DOCX/PDF/XLSX/PPTX真实输出及适当编辑方式，明确公式/表格/A4范围与不支持状态；不承诺像素还原。实际Office/WPS打开与A4校验另记，不能以ZIP/XML或构建替代。

## 3. 变更范围与兼容、回退

B1：新增shared document契约、主进程document-worker/host与vendor原文件/source manifest/许可证、electron-vite worker入口；workspace-files解析分支、files共享类型/中文错误与PiWorkspaceFiles预览。无新表、旧文件/库不迁移、不写教师文件；API key/env不改。依赖package/lock明确增量。现有unsupported格式仍metadata；坏worker/包缺失fail closed，不上传或静默换云解析。回退Office分支/worker入口即可保留旧文本/图像预览，不删除用户或旧会话。

B2/B3前分别追加精确工具/native marker/主进程状态/typed/UI合同；禁止未冻结就扩大权限或覆盖产物。任何资产导入必须沿原SQLite事实，不以preview缓存为新真源。

## 4. 验收门禁与真实限制

每切片build、renderer组件、来源hash、专项实际文件/用户路径；关键预览变更运行主smoke，git diff --check。精确命令/数量/失败/skipped写115；截图、报告、source hashes原字节归档，不存key/DB/原生私有历史。新增库license/Windows/native体积在115回读；包内加载、Office/WPS、B2/B3未验则保持TODO。原设计D1–D7、C国内联网、D附件图像、E持久goal与P08均不被本切片替代。

## 5. 压缩恢复位置

先四根→67§1/2/5/8/9→35最新→109/本文/115最新状态。先完成B1实际正文，再B2原Pi正式读取与来源、B3受控导出/实际Office-WPS-A4；完整B验收才继续C。公开说明→真实工具→下一说明→交付保持真实，同款组件需来源证明，不能称HeroUI是Codex官方桌面源码。
