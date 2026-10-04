# P07-D 附件、图像与真实查看回执交付合同

日期：2026-10-04。M10/M01/M03/M04；129有限C已完成，整体目标active，三元题组暂停。当前合同保留109-D全部要求，按基础→正式入口→模型/OCR→完整实例依次实现，任何基础测试不能提前勾完整D。

## 1. 教师可见结果与当前缺口

教师从常驻输入“+”选择真实文件，看到真实数量/文件名/图像缩略图，可移除和本地打开；提交后当前消息关联的附件和实际读取回执保留，换会话不串，取消/重启不伪造已查看。模型真正读过图片才显示“已查看N张图像”；本地预览不冒充模型视觉。正式文件产物继续原ledger/AnyDoc打开，不建立第二套产物事实。

当前源码：OfficeComposer的“+”只选目录，PiEducationWorkspace只传prompt，production-host start严格三字段，shared无附件，native Pi Settings强制blockImages:true。既有workspace-files可按lease/version预览本地图像和Office；原目录审批、文件边界及document工具成熟。model-capabilities只保留context/output，尚未核图像输入。已有错题analysis保存脱敏/教师校正文本；OCR状态存在不代表本机OCR引擎已可用。

Hana图谱找到AttachedFilesBar/chat-image-send-preflight/model-image-preprocess/read-image-vision，snippet只file无source；Edu新宿主0symbol，转实际文件。Hana的SessionFileRegistry把事实写native侧files.json并包含路径/缓存/删除，不直接挂来改变小智SQLite真源；复用其稳定source-key/ID和metadata原函数，私有主适配器承担SQLite/本地授权。Pro MCP138组件实际查chat-attachment/prompt-input/disclosure/modal，本地原ChatAttachment五文件已经存在，使用实际Name/Preview/Remove接口（文档Info/size和本地版本不同），保持源码/CSS/util原闭包。Finesse沿67已登记0.20.0 ai-console，无新增可调用接口，不虚报同款Codex官方源码。

## 2. 方案选择与图像能力

- 延续Pi0.80.3/Hana0.449.0单循环、原registry/once/预算/stop，没有Codex CLI或独立视觉循环。文件按ID按需读取，必要脱敏正文才入模型，原文件不整份上传。
- [DeepSeek当前官方视觉文档](https://api-docs.deepseek.com/guides/vision/)搜索结果说明deepseek-flash可接图像，不能沿历史印象判所有DeepSeek文本限定。页面正文工具两次超时保留；本轮用无身份合成PNG+官方chat/completions做实际校验，状态/模型/hash/正确颜色布尔留证，密钥/原请求不公开。目录和SDK配置仍须分别核，直接HTTP成功不等于Pi通道成功。
- 学生图片/姓名/原教学资料默认本地；图像选择不授权上云。学生图接真实本地OCR及教师校正后的必要脱敏文本，现成引擎不可用明确失败，不用云视觉绕过。公开办公合成图只有教师明确选择公开办公用途及最终确认、经版本/能力/安全校验后才允许Pi原生图像，失败不得静默上传或切模型/供应商。
- 云视觉预处理优先直接Hana model-image-preprocess/Pi原工具及现成压缩；不手造读图模型。先核本地原依赖/许可/Windows体积，有新依赖先记录精确锁与用途。public投影仅附件事实和safe receipt，不含base64、原绝对路径、student raw/OCR私文或私有推理。

## 3. 分步实现与修改清单

### D1 本地附件事实基础（本轮先实现）

新增shared `xiaozhi.attachments.v1`与main attachment-state/service；一个增量SQLite表记录session/ID/relative path/workspace lease/captured version/hash/size/mime/状态/revision/message-run关联（仅私有事实）。schema1严格回读、CAS、每会话明确数量上限、去重ID包括owner和内容版本；移除只影响draft，submitted历史不删。按现有授权根/符号链接/硬链接/凭证文件保护，经原Hana metadata/稳定ID、bounded open/pre/poststat/哈希登记，不修改教师原文件。不新建文件sidecar真源/上传/业务asset，不在基础阶段给模型工具或改变start输入。

直接复制/提取Hana原两个身份函数，AST来源体与SHA/Apache-2.0记录；原Pro五文件byte-identical核验。增量migrate在既有SQLite副本/全新测试DB重复运行，保存已有run/messages/settings/native；未知schema不能silent fallback。恢复不重读原图/不复活removed/不伪造run或已查看。基础通过后才接production session-state init，保持旧入口。

### D2 正式附件纵向入口

native chooser由主宿主同一owner保护，实际文件选择与当前会话授权root一致，renderer不能传任意absolute path/base64；主frame typed choose/remove/preview/snapshot与取消/期限/并发上限。原“选择工作目录”保留独立权限入口，“+”添加文件。原ChatAttachment/Group放PromptInput.Attachments及已提交用户消息；点击走原files panel/版本预览，notfound/changed/error可见。发送附件ID/hash进入命令身份而无附件旧hash保持，绑定user message/run事实要原串行队列原子或显式恢复；重复send一次，失败draft保持，运行中补充须明确同一附件租约或暂不可变且可达停止，不能冒充已支持。

必须支持已有对话选择工作目录之外的具体文件，不能以“目录已冻结”为由把附件缩成只能挑目录内文件。native picker的具体文件授权可进入独立本地暂存/只读附件根，仍只限所选文件，不授其同目录其他文件权限，也不改Pi既有workspace身份或模型上传权限。132接线合同先冻结暂存目录/原源hash和版本/SQLite绑定/中断恢复，复用Hana入站文件与现有本地import；D1仅授权根内reference service未解决这个正式入口缺口。

### D3 真实读取、图像与本地OCR

原文件/Office工具按明确附件ID解析session授权/版本并按需实读；输入工具getter/strict schema、取消/late event/once/budget及压缩身份保持。图像能力独立native增量，不改旧教育/Office创建身份；学生图原本地OCR/教师校正/脱敏再模型，公开图教师确认后Pi native image/原预处理，实际供应商与SDK两层验证。raw图/姓名正文不公有投影、私有摘要不进正文；失败如实显示，不用metadata或本地预览冒充视觉成功。

### D4 完整真实实例与图片回执

原Pro Disclosure/ChatAttachment组成“已查看N张图像”展开缩略图及点击真实本地打开，数量来自实际成功的run附件读取facts而非文本猜测，失败/取消不计；同图重复调用原once去重，但不同真实版本保留。message/run/历史/产物/重启/跨会话一致。真实DeepSeek公开办公合成图片颜色/文字及教育Office输入→实际工具→后续公开说明/真实交付；学生合成图本地OCR/校正/脱敏，两native1366×768/1920×1080及官方R1/R2图像区域对照。全部接口副窗口/伪造ID/撤回/版本变化/旧DB/真kill恢复与停止验收。

## 4. 完成定义、迁移与停止边界

D完整完成需要D1–D4从当前导航真实操作/工具→SQLite/文件→重启，image模型实际读成功/本地学生图校正链，loading/empty/success/cancel/error/partial/retry齐全；必要专项/原源审计/renderer79/build/main207/diffcheck，加实际实例和两尺寸。只isolated合成目录，不扫描或上传真实教师文件，不动用户窗口/WPS/代理/DNS/VPN/第三方凭证，不commit/push/子agent。

新增表增量/幂等，原nativeJSONL和文档文件不删；若原数据冲突或需不可逆改规则停止报告。D1基础不注册生产时回滚只弃用新adapter，保留表与用户原资料；D2/D3正式能力独立开关/旧入口保留直到验收，停止不重放写或图像上传。每步验收写真实命令/失败与未验，四根+26/28/35/67同步唯一下一。之后E持久目标、全D1–D7/未知官方Skills设置/P08实际无VPN/Windows安装与最终八组仍active，不能因附件基础通过改小最终目标。
