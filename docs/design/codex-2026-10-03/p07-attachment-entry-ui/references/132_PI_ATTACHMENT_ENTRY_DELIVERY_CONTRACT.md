# P07-D2 正式附件入口交付合同

日期：2026-10-04。沿 109-D / 130 / 131；模块 M01/M10。整体目标继续 active，三元题组暂停。本合同包含完整附件入口，分三段交付；完成其中一段不能提前勾 D2 或完整 D。

## 1. 用户结果与当前证据

教师在已有对话的输入栏“+”选择文件，包含已经冻结工作目录之外的具体文件；看到实际文件名、数量和缩略图，可本地预览、移除，发送后在对应用户消息保留。换会话、失败、取消和应用重启不串附件、不丢已提交版本、不自动重放读取或上传。工作目录选择保留独立入口。

当前 D1 已有 SQLite 本地附件事实、授权根内 reference service、13 项原生文件边界和4项实际 native sqlite3 存储验收；尚无附件 native chooser/typed/preload/renderer/发送关联。现“+”调用 selectWorkspace，已有 native 绑定会拒绝换目录，不能作为文件附件入口。start 仅三字段；消息/command/run 分次保存，附件准入必须明确恢复而不是只向 prompt 拼文件名。

本轮图谱 ready 5110/10805；Hana bridge-inbound-files 只有 file 节点、snippet source unavailable，按精确路径读取原源。原 materializeBridgeInboundFiles 复制所选文件到独立缓存并登记；它接受 bytes/base64、依赖 `.files.json` 同步登记、原 writeFile 非 exclusive，不能直接承担小智 SQLite/主frame/单文件授权和恢复。复用原 safeFilename/removeUnsafeFilenameChars/extensionFor 及 MIME_EXTENSIONS 原体，保留 Apache-2.0 与来源 SHA；安全读写、SQLite 登记是项目宿主适配，不能把整个 Hana bridge 宣称已原封接入。

Pro MCP 实际 list138 + chat-attachment/prompt-input/modal docs；沿现有原组件与 CSS/util，按本地 Name/Preview/Remove API，原始组件字节不改。Finesse 沿 67 已登记闭包，当前没有新增 callable 接口。没有 Codex 官方 UI 源码同源或全页像素完成声明。

## 2. D2-A：本地单文件入站与恢复

- native picker 私有具体路径是一次文件选择授权；renderer 不能传任意 absolute path、bytes 或 base64 给导入。源文件的所有祖先、硬链接、凭证/受保护目录、应用私有数据根与类型/大小仍校验。允许驱动器根下明确选定的普通文件，但不授权目录遍历或相邻文件。
- 稳定根 `dataRoot/xiaozhi-pi/attachments/<sessionId>`，每个选中文件独立 UUID 子目录、原 Hana 安全名称；只本地有界复制，exclusive create，不修改原文件。独立附件根不替换 Pi 已冻结 workspace。原源绝对路径/version/hash/本地副本相对路径只在私有 SQLite 登记。
- 新增一张私有增量 `xiaozhi_pi_attachment_imports`，schema1，staging/ready/interrupted。登记意图→有界捕获原源→exclusive 副本→核副本hash/version→ready→D1附件登记；同一原源版本可复用 ready 副本，D1本会话草稿去重；源变化产生新版本，已提交本地副本不依赖原源继续存在。
- 启动把 staging 标 interrupted，不自动复制、解析、调用模型、上传或删除副本。ready 保留；ready 后尚未登记的复制件只能下一次教师明确选择时再次校验登记。失败文件/中断文件只保留隔离记录，不自行清理真实资料。未知schema/版本/来源不静默兼容。
- SQLite实际登记后、返回前取消，仅将本次新草稿 CAS 标 removed；重复选择已有草稿时保留旧引用/revision，不能为了撤销本次迟到选择误删前次已确认附件。重启仍不自动执行文件或模型动作。
- 复用 D1 capture 的原有有界 pre/post-stat/hash 校验，仅增加主进程内部 readBytes；公开metadata与模型投影不增加字节。只读预览复用原 workspace-files/AnyDoc，先按 SQLite ID/session/revision + 复制件hash/version验证；公开预览不显示暂存UUID路径或原绝对路径。

## 3. D2-B：真实入口、原组件与 typed IPC

宿主同一owner/choosing锁覆盖picker到落库；真实主frame choose/list/remove/preview/cancel，严格输入 descriptors/schema/session/requestId/revision，取消/期限和8个实际工作槽，结束前不释放后台读取槽。关闭/归档/会话变化后的迟到选择不登记。native对话框未关闭时即使IPC取消也不再接收迟到文件。

常驻“+”添加文件；原权限菜单单独 selectWorkspace，不能因附件改掉目录选择。原 PromptInput.Attachments + ChatAttachment/Group 接真实草稿；原Modal/文件预览接图片/文本/Office正文，图片需现成原生解码/尺寸界限和真实本地缩略图。选择、移除、失败、部分成功、取消、重试与重启可见，8项上限来自SQLite而非只锁UI。

运行中普通文字补充保持现有 Pi队列。文件补充若尚未接好独立命令/租约，就明确保持待发送附件且不可混入文字队列，停止按钮始终可达；不得显示附件已送达。D2阶段不将本地预览标为“已查看图像”，真实模型工具回执属于D3/D4。

## 4. D2-C：发送、历史与完整实例

start增加可选严格附件selection数组；无附件命令保持原JSON/hash/native身份。带附件命令hash包含ID/revision及私有已捕获版本摘要，副会话/removed/stale/篡改拒绝；重复command只接受同内容，一次提交。发送前宿主真实校验，不只在renderer锁定。

教师消息、run和D1 submitted绑定必须在原串行host范围按SQLite事务或明确持久准入/恢复协调；模型execute只在消息和全部附件已绑定后开始。崩溃中间状态可明确显示 interrupted，草稿或已提交引用不能伪造；重启不重放已接收命令/上传。公开用户消息附件来自ledger，不信renderer文本。历史预览依赖复制件的captured version，不把后来原源变动改成旧消息附件。

模型按需读取、公开办公图显式确认后 Pi原生视觉、学生本地OCR/教师校正脱敏是D3；“已查看N图”真实计数与展开是D4。D2完成只表示本地附件入口/发送/历史完整，不声称模型已能处理所有文件。

## 5. 门禁、回滚与后续

D2-A先专项真实SQLite/文件与实际Electron存储验收：目录外原源、祖先link/hardlink/凭证拒绝、原bytes不变、副本hash、并发去重、源变更新版本、8项上限、停止/实际退出、旧副本二次迁移和关闭重开。未接page时明确记为底层。

D2-B/C须真实Electron从“+”操作（native chooser可用仅主进程非打包测试 seam 指向 owned 合成路径，页面与导入生产链实际运行）、真实DeepSeek发送/空composer/附件历史、两native1366/1920/副窗口/跨会话/旧绑定不改/源删除后历史/取消/真kill恢复和重复command。图片缩略图实际查看；重启本地事实与页面一致。

最终 `npm run build`、`npm run test:renderer-components`、专项和关键入口 `npm run test:smoke`、根 `git diff --check`。若旧no-provider外键错误再现，原131诊断先取证，不放宽原断言、不以此扩建暂停题组。不以Node SQLite或HTTP图探测冒充页面/Pi/OCR。

只增量迁移，D1及旧文件/产物入口保留。新代码可以禁用附件入口回退，不删除SQLite记录或原文件。无新依赖；如原生图组件实际需要新增依赖，先补精确版本/许可/体积/Windows影响。仅 owned 合成测试，不上传真实教师/学生资料，不改系统代理/DNS/VPN，不触用户窗口/WPS，不提交/push/子Agent。

每段交付根据真实结果写验收MD和四根/26/28/35/67的唯一下一动作。完整D2以后接D3/D4，然后E持久目标、全D1–D7/P08实际无VPN/Windows安装/未知Skills设置参照和最终八组，保持用户原目标。
