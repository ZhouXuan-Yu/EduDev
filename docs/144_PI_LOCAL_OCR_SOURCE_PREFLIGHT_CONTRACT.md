# D3-B/C 本地 OCR 与媒体接入：源码和实际引擎预验合同

日期：2026-10-04。整体目标保持 active；用户当前要求的浏览器、无累计预算、最新 Pi 自动压缩及 DeepSeek 缓存已按140→141完成，D3-A正文实读按142→143完成。本合同首先核验后续图片能力的真实前提，不以可创建引擎、图片预览或直接HTTP试验冒称完整D3。

## 1. 已确认的当前状态

- 官方最新 release 本轮仍为 Pi1.0.2、Hana0.450.0；生产依赖和140/141方案一致。原Hana浏览器快照/等待/cache-prefix的verify再次通过。
- 当前Pi生产模型注册仍 `input:['text']`，settings仍 `blockImages:true`。图片上传入口和192px本地缩略图已存在，但没有模型原视觉链路；保持拒绝，不提前解除学生图片限制。
- Windows PowerShell5.1只读实际探测可创建Windows.Media.Ocr中文引擎，语言 `zh-Hans-CN`，引擎MaxImageDimension10000。此结果不是实际识别或跨Windows环境保证。
- Hana当前媒体源码包含read-image-vision/model-image-preprocess/chat-image-send-preflight。其native-image/auxiliary-vision路由、session资源版本和Pi resizeImage可作为复用基础；学生图片仍必须本地OCR→教师校正→必要脱敏，不能沿通用辅助视觉自动上云。
- 当前65252用户进程本轮复查已不在，未关闭/强杀，原因不推断。测试只在明确ignored test-results生成合成图片、源码和子进程，不维护真实profile或重写out。

## 2. 本阶段明确交付范围

M03/M10前提核验：复用上游现成Windows OCR模块，合成中英文教育文字图片实际识别，确认源代码、许可、版本、资源与Windows影响。只增加专用可重跑预验脚本和记录，不新增生产表、IPC、renderer或云视觉权限。

- 首选直接原PsOcr1.1.0，GitHub tag1.1固定commit `0e25eb553d57077193d186eb447815330d7c8c99`，而非二次Python包装windows-ocr。二次包装源码有重复实现、疑似连接粘贴语法及PS7兼容差异，不能为了“新”跳过源码核验。
- 使用固定Windows PowerShell5.1绝对可执行文件；读取固定本地源码模块，不Install-Module、不配置系统语言包、不依赖PATH或用户PowerShellprofile。引擎已安装才可用，缺少中文引擎明确报不可用。
- 原上游root.psm1/manifest/LICENSE完整保留并记录SHA、commit、字节数；合成测试图片用本地System.Drawing生成。实际调用Convert-PsoImageToText，报告匹配结论和行数，不输出识别正文或任何凭证。
- 子进程仅必要Windows环境，stdin严格任务数据，不插值生成文件路径命令；限本次测试60秒、输出1MiB、真实退出、取消与异常清理。单次保护不等于累计运行预算。
- 真实无网络OCR子进程；获取上游源码是研究下载，不是OCR请求。不扫描其他图片目录或上传合成/学生图片，不用mock识别值。

## 3. 后续生产纵向切片（本阶段未完成）

1. 原附件ID/revision/当前session/message/run→capture.verify→固定OCRworker→原始OCR和布局仅本地。沿原utility实际子进程池/取消/前后版本hash，转换或缩放使用Pi原resizeImage；禁止renderer任意路径或模型指定脚本。
2. 新增versioned本地OCR校正事实，保存attachment/version/hash/引擎版本/原文/教师修正/CAS决定；使用增量SQLite与既有审批恢复模式，校正弹窗原Pro组件。待确认原文不进入公开工具事件、ask_teacher问题或native模型历史。
3. 明确教师确认后必要修正文再次脱敏，当前授权/来源版本再次校验；拒绝、修改、停止、冷恢复和撤权均不得迟到交付。沿原Pi同一loop/registry/once，新增独立能力身份不更改原会话绑定。
4. 明确公开办公图片用途及教师确认后，复用Hana媒体预处理/实际Pi原image content；provider模型能力与SDK传输分别验。已确认的公开图不能让同会话学生原图一起上云，也不能默认另选国外视觉provider。
5. 本地OCR、正文实读、provider实际成功接收图像分别出真实来源/状态；“已查看图片”计数只能来自成功provider交付的唯一附件版本，不从缩略图、工具开始或失败返回推断。

## 4. 验收与下一步

先实际合成中文/英文/数字短码图片离线识别并核源码SHA/许可证；脚本exit和报告同时确认。失败保留并定位，缺语言包不静默改系统。此阶段不改产品代码，无需重复已通过79组件/207主smoke；生产纵向切片必须独立build、renderer、正式Electron真实教师校正/拒绝/取消/冷恢复与实际DeepSeek实例。

下一唯一位置：本预验报告→冻结生产D3-B共享契约/表/IPC/UI合同→先学生本地OCR校正脱敏完整用户链，再D3-C公开图实际Pi视觉/D4回执，随后E/全D1–D7/P08。不提交/push/子agent。四根和26/28/35/67按真实完成情况更新。

## 上游依据

- https://github.com/TobiasPSP/PsOcr/tree/0e25eb553d57077193d186eb447815330d7c8c99
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine
- https://github.com/RapidAI/RapidOCR （Apache2/中英文/ONNX候选，未下载模型或安装，不能声称引擎可用）
- https://github.com/liliMozi/openhanako/releases/tag/v0.450.0
- https://github.com/earendil-works/pi/releases/tag/v1.0.2
