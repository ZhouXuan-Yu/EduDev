# P06b-B2：本地文件工作面板纵向合同

日期2026-10-03；M10/M01。上一轮为进展，docs/84壳验收通过。完整目标和docs/67原图保持，原生窗口/设置/最终精度尚未完成。

## 1. 教师结果与现状

教师点击文件面板，浏览本会话已选择的教学目录，筛选并打开多个文件，在标签之间切换，关闭标签，拖动聊天/文件面板分界，关闭后继续聊天；重启仍保留布局偏好。当前main已有原生chooser+xiaozhiState.workspace授权，authorizedWorkspace/approvedFile和Hana resolveReadableFileRef；正式Pi没有文件list/preview typed API或FileTree/Tabs用户路径。不能拿source标题当读取授权。

## 2. 修改清单与顺序

1. 新shared `xiaozhi-files.ts`：schemaVersion固定、严格请求白名单、sessionId/requestId/相对path、列表节点和版本、预览版本/内容kind、中文错误映射；禁止任意绝对路径、file URL或用户供根目录。新main `workspace-files.ts`复用workspace-authority与Hana readonly resolver，增量只读，不修改现有agent工具。
2. main生产host提供只读授权解析：会话存在且未归档、应用未关闭/chooser不冲突、grant重新核真实目录；未选择目录明确反馈，引导既有chooser，不授权Pi私有历史目录。公开grant只标签/不透明版本，原绝对路径留main。
3. `workspace-file-api.ts`独立IPC注册，沿原sender/mainFrame校验；list/preview/cancel请求有唯一身份，超时、取消、重复/并发上限；typed preload新增方法。没有新表/迁移，renderer无node/文件根/网络调用。
4. 复用已登记原Pro FileTree和Resizable、现有OSS Tabs；只绑定实际list/preview，目录按展开有界读取，搜索当前已加载树，实际标签关闭/切换/refresh。文本/Markdown安全渲染，PNG/JPEG/WebP/GIF只本地data，文件内容不是指令、不执行HTML/SVG/脚本；大文件/二进制/Office/PDF未支持时显示真实元信息与状态。完整办公产物/Office/PDF阅读后续沿P07补齐，不能用该状态冒充可预览。
5. `PiWorkspaceShell`文件模式与紧凑资料卡分开，原Pro Resizable拖宽/持久尺寸，面板开关和模式仅UI偏好；旧schema1兼容。不把原Sidebar关闭宽度丢失问题带入文件模式，窄视口保证聊天输入/停止可达。会话切换清空文件正文/请求，重启不自动持久正文或借旧path给新会话授权。实例发现原启动总取第一会话，新增 `xiaozhi.current-session.v1` 只存当前会话ID，恢复必须从main当前活动列表核存在，未知/归档回原fallback；不授予文件权限或保存正文。

## 3. 权限、版本与失败

- 每次操作从main读会话grant，重验root身份；请求token不能授予权限。拒绝根外路径、驱动/UNC/ADS、点段、禁用凭证目录/文件、符号链接/junction/hardlink、非普通文件。沿原Hana readonly resolver再核fd与路径身份，读取前后版本不一致返回changed，不显示混合新旧内容。
- 目录每次最多256项、深度8/路径500字符；不递归扫描整盘；只读text最大1MiB、image最大4MiB；bounded buffer读取，多余即too_large。返回显式partial，失败不假装empty；不回传绝对path/异常栈。
- 本地预览允许教师看原资料，不发送provider，也不进入Pi消息或摘要；学生原图继续本地。元数据/正文在renderer只瞬时，不写localStorage。AI写入依旧原审批。
- 运行中允许教师只读浏览，选择/改授权仍沿现有锁。关闭/切换/新请求取消迟到操作，requestId防止旧preview覆盖新tab。取消/超时只能终止读取/公开结果，不触发副作用。

## 4. 兼容、回退与门禁

无业务迁移/旧native历史改写/新依赖；禁用文件模式可回原B1壳，原agent工具保持。原Pro来源32/hash复核、Tabs使用已安装3.2.2和compiled CSS，Finesse AI-console真实状态原则继续，非Codex官方同源。

先有界文件专项main实例（真实磁盘/新旧会话/权限/变更/上限/取消/根身份），再正式Electron从教师选择目录开始→tree→多tab→正文随机事实/image→失败/refresh→双视口/拖宽/关闭/切换→重启/正文未持久。真实provider必要兼容+build/renderer79/主smoke207/git diff --check；逐项记录失败/通过/skipped/未验。Office/PDF/原生标题框/同DPI完整视觉保持未完成，B2子项验收后继续依赖顺序，不重新选引擎。

下一：B2a共享与main/API→B2b原组件正式页面→上述实例验收；之后原生框架/P06c/P07/P08。四根文档记录准确继续点；不commit/push/修改系统网络或真实教师库。
