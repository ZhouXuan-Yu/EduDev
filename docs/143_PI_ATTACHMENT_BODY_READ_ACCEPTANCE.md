# D3-A 已发送附件正文实读验收

日期：2026-10-04，合同142，M01/M10。整体Codex体验目标保持active；完整D3/D、D4/E/视觉/安装仍未完成。

## 1. 实际交付

- 主进程新增office_list_attachments/office_read_attachment，前者分页给当前对话已提交附件的脱敏名称/ID/revision/格式，后者按ID和必要行读取文字或Office。真实teacher message/run/submitted绑定、当前run、版本/hash在读取前后校验；未发送草稿、removed、跨会话、归档/授权失效、未知/变化版本、getter/隐藏字段/符号/原型均拒绝。
- 原createAttachmentImportService.verify/preview、Hana入站与文件边界、AnyDoc本地worker直接复用；原文件删除后仍读取captured副本，不改冻结workspace或授相邻权限。模型只得最多100行/16000字符的必要脱敏正文及真实来源；Office提取行不冒充原页码。图片及扫描PDF返回needs_ocr，没有image/base64或假查看计数。
- Pi1.0.2唯一registry/SessionExecutionRegistry/Hana scope/once/取消与自动压缩保持。新增独立xiaozhi.education.attachment-read.v1原生能力身份，旧creation/Office/模型/技能/记忆不替换；不新建SQLite表/sidecar/renderer任意路径接口。元数据列表不是实读回执，读取失败不产生成功来源。
- 原Pro ChatTool/Group/Sources与ChatAttachment/Modal直接绑定真实事件和已有历史，不手造新聊天组件。预览文案由过期的“内容未提供给模型”改为“原文件保存在本机”，符合按需读取后的事实。公开说明收敛为资料标题/实际读取范围，不向教师复述ID/revision/schema等内部字段；未展示私有推理。MCP已查询chat-tool/chat-attachment/disclosure；原Pro五附件源码byte-identical。Finesse当前无可调用MCP，沿既有0.20闭包，未宣称新调用或Codex官方同源。

## 2. 最终证据

命令在D:\WorkProject\EduProject\apps\desktop执行，私有报告在ignored test-results；没有真实教师/学生资料、密钥或profile归档。

| 命令与范围 | 结果 |
| --- | --- |
| node scripts/xiaozhi-agent/pi-attachment-read-native-smoke.mjs | ycyGbc，14项，exit0；真实Electron/native sqlite3/Store，严格参数不触getter、草稿拒绝、原子已提交绑定、分页、真实指定行/已知学生电话邮箱脱敏、原源删除、旧revision/跨会话/撤授权、实读后交付前取消、stopped owner、副本篡改、原facts不变、真实图片拒绝零bytes |
| node scripts/xiaozhi-agent/pi-attachment-read-ui-smoke.mjs test-results/xiaozhi-agent/pi-browser-ui-uY2Gak/data | G5xdpl，13项，exit0；复制真正Pi0.80.3完成的owned数据/旧会话，正式“+”选五个目录外文本/DOCX/XLSX/PPTX/PDF，真实官方DeepSeek/Pi/本地AnyDoc读取并正确给文件独有随机码及37/8；公开中文分段/真实来源/无内部字段、必要正文脱敏、两native尺寸和输入清空、指定第2–3行、冷恢复原源删除后再实读、真实image/扫描失败、停止actual worker/exit/无迟到正文、无renderer错误与单一新增身份、原测试DB SHA不变 |
| node scripts/xiaozhi-agent/pi-attachment-read-compat-inspect.mjs test-results/xiaozhi-agent/pi-browser-ui-uY2Gak/data test-results/xiaozhi-agent/pi-attachment-read-ui-G5xdpl/data | exit0；两个DB OPEN_READONLY，1份原0.80.3 native完整bytes仍是最新记录exact prefix，原session_file/schema/model及header/native身份不变 |
| node scripts/xiaozhi-agent/pi-attachment-entry-source-smoke.mjs | UxsNNf，6项，exit0；原Pro五源与既有Pi1.0.2/Photon/Image-size版本许可，不代表安装包解码 |
| npm run test:renderer-components | renderer2.log，79/79，exit0 |
| npm run build -- --outDir test-results/xiaozhi-agent/pi-attachment-read-build | build4.log，exit0，index-Dc_4ACac.js；当前用户窗口可能使用out，先独立构建 |
| OMNI_EDU_TEST_BUILD_ROOT=该绝对独立目录，node scripts/electron-smoke.mjs | main-smoke3.log，207/207、ok=true、exit0；新增test-only构建根只准desktop test-results，原主smoke断言未放宽 |
| npm run build | production-build.log，exit0；确认当前无Electron后生成正式out，与已验独立构建的319个文件逐一SHA比较全部一致，避免再次扩展相同冒烟 |

最新UI截图read-1366/read-1920已生成，最终G5xdpl/read-1920实际查看；早期zppX2L在Modal进入动画中截图呈透明，后改等待真实opacity/动画结束，最终图稳定。不使用截图文件名代替实际native尺寸：窗口setContentSize/innerWidth/innerHeight分别核验1366×768、1920×1080，PNG随Windows缩放为2049×1152、2880×1620。不称全页同DPI像素完全一致。

## 3. 保留失败与修正

- qZLuGD已实际五格式读取，但测试猜public item.tool字段；原投影仅label/id。改用native真实toolCallId关联public row并核中文label，未改产品协议迎合测试。
- uKwJAe五项后测试猜“关闭预览”；原按钮实际是关闭/pi-attachment-preview-close。改稳定真实入口，不造假按钮。
- zppX2L十项后把cancelled SDK错误当public status；当前主宿主正式状态一直是interrupted/DB blocked，沿原合同核正确终态，不改宿主。该轮13项后的dbLRRH通过，但实际截图发现公开revision术语，补强附件公开说明和最终真实实例断言。
- zWaXli十项后Playwright主进程轮询出现Resulting promise was garbage collected；已到停止后的worker检查，不证明产品失败，也不能当通过。最新脚本在同一实际main PID仍live时最多3次重新观察同句柄，不因观察异常重启；最终G5xdpl13项全部成功和脚本exit0。
- 原生首版late-cancel fixture未证明到达交付关口；补显式heldStarted后8QYjr1通过，后增image/分页最终ycyGbc14。兼容只读检查初次猜native_session_id列失败；真实表仅session_file/schema/model，按真实列与native整bytes检查，最终exit0。

没有删除这些报告、旧DB/原文件或native记录。未新增依赖、改变模型/预算/系统网络或维护实际凭证。

## 4. 运行状态与下一步

初始原用户PID22052仍响应，测试仅owned窗口/独立构建，未taskkill它；后续检查该PID已不存在，原因未推断。正式build前确认无Electron；沿既有启动授权运行最新out/main/index.js，默认真实profile，无E2E/data root覆盖。实际PID65252/Omni-Edu Agent/非零handle9699816/Responding=True；只确认新版窗口，不当真实教师资料或无VPN验收。保留此窗口，后续不得改其out或凭证作测试。

**唯一下一动作：四根→67§1/2/5/8/9→35→130/132/139/141/142/143，冻结D3-B/C合同。** 查现有本地OCR实引擎与Hana/Pi媒体预处理/原视觉源码：学生图先本地OCR→教师校正→必要脱敏文本；公开办公图须明确用途/确认并核真实模型能力/版本/Pi通道，不能云视觉替代学生OCR。当前python非vendor仅DeepTutor桥，图谱OCR只status/页面函数，不能称本地OCR引擎已存在或可用。接D4实际查看计数/缩略图与来源版本、E持久目标、全D1–D7/未知Skills设置参照/P08无VPN及Windows安装/最终八组。整体目标active，三元题组暂停；未commit/push/派子agent。
