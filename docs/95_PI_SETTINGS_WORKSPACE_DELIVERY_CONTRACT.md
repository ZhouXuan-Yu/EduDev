# P06c-C 统一设置工作区交付合同

日期：2026-10-03。模块 M10/M01，复用 M11 已有本地备份。前序 docs/93→94；设计真源 docs/67 的 R1/R2 原图、组件映射和 D1–D7，完整目标仍 active。

## 1. 教师可见结果与交付清单

- [x] 原生“设置”与小智设置按钮进入同一工作区：模型与连接、技能、工作目录与权限、界面偏好、归档、备份六个真实分类。
- [x] 搜索设置只索引可操作能力；中文/英文/多词搜索、清空、无结果与键盘操作可用，点击结果进入对应分类及控件位置。
- [x] 原模型加密表单/官方目录/CAS/全局锁保持；原 Skills 预览、导入、启停、编辑、归档在统一页复用同一组件与 typed API。
- [x] 当前对话经 main 活动列表确认后才读取目录/记忆；无对话显示空态。目录仅展示真实名称，使用原选择器与绑定锁，不由 UI 偏好授权文件。
- [x] 复用本会话记忆组件，明确授予必要脱敏摘要，关闭清空仍由原宿主撤权；全局忙碌不能通过设置绕过。
- [x] 展示偏好保存原 schema1 三个布尔，返回小智与重启读回；未知/损坏版本安全回退，存储失败明确反馈。
- [x] 归档分类列出真实归档会话/文件夹；只读打开已保存公开历史，不启动模型、不恢复运行、不重放文件/审批。本轮不新增恢复能力。
- [x] 本地备份使用原 export/verify 服务、原格式/原生选择器；实际导出、校验、取消、失败有反馈，主窗口校验及宿主全局互斥覆盖选择和执行；退出等已开始的文件作业完成。
- [x] 双窗口 1366×768、1920×1080 无横溢出、搜索/导航/返回与动作可达；运行中设置→返回保持同一 run。

## 2. 真实能力与缺口

正式 Pi 设置只有 PiModelSettings；Skills 位于独立 Modal；目录/记忆在会话详情；三个展示偏好在 PiWorkspaceShell localStorage；旧设置已有归档只读列表和 DataBackupPanel。backend/typed preload 已具模型、技能、目录、记忆、归档列表和备份服务；缺统一导航、能力索引、内嵌布局、归档可读内容与设置页的偏好入口。备份旧 IPC 未验证 sender/全局忙碌，需要补这条授权路径，不新增第二执行循环。

## 3. 复用来源与修改范围

- Hana0.449.0 Apache-2.0：原 SettingsRow/SettingsSection 完整文件，依赖已复制 SettingsPrimitives/CSS；搜索 normalize/translate/score/search 函数与类型 AST 提取，排除 Hana 人格/插件等未实现数据集；导航/search-result 相关 CSS 规则原样提取，应用 token/容器适配单列记录。
- HeroUI MCP 已核 sidebar/search-field/switch/tabs 文档；用已安装原 OSS SearchField/Switch/Button 与已有原 Pro ListView，沿用原 Pro 工作区壳。非 Codex 官方源码同源，不称所有组件同款已证。
- 新独立 renderer PiSettingsWorkspace、偏好/能力索引帮助模块、作用域 CSS、Hana 来源生成/验证脚本与 manifest；PiModelSettings/PiSkillSettings 增加内嵌模式，默认旧模式保留；DataBackupPanel 添加现代展示模式、互斥/生命周期守卫，旧契约和测试 ID 保留。
- 主宿主复用原配置锁提供本地设置作业封装，backup IPC 主 frame-only；typed preload 使用原备份结果，不新增表/目录格式/通道。必要权限改动落独立宿主边界，不堆入 App/main/index。
- App 仅替换正式 Pi 设置入口，旧 Pi-disabled 设置仍在；四根/docs28/35/67/26 同步真实结果，96 写精确验收和下一位置。
- 无新依赖、native 模块或服务；增加源码属于已有 Apache-2.0 闭包，manifest 记版本/原 hash/输出 hash/适配，不把静态来源检查当运行验收。

## 4. 兼容、安全与恢复

不改变 SQLite/JSONL/native 模型 ledger、教师资料、授权 epoch、Key 加密、默认模型或创建绑定指纹。renderer 偏好仅展示布尔，查询/文档/Key/目录正文不进入搜索索引或偏好。当前会话 ID 必须核活动列表，已归档/未知不会成为权限编辑目标。归档展示沿用公开 projection；不展示 metadata/私有推理。异步结果按存活状态/请求代次核验，选择器占锁，关闭后拒绝新作业和晚到启动。备份只有本地复制/只读校验，没有自动恢复/上传。

回滚：保留原模型组件默认模式、Skills Modal、旧设置和原 backup 服务；统一设置入口可回退 PiModelSettings；原 schema1 偏好向后兼容。失败不能删除旧数据或放宽原模型/记忆/Skills/目录校验。

## 5. 验收与完成定义

1. 冻结本文后再编码，先来源/typed 边界再正式页面。
2. build、renderer-components、来源 hash；设置搜索/偏好损坏与存储失败、宿主本地作业/选择器/退出/忙碌专项实例。
3. owned 新数据与独立 profile 的实际 Electron：六类导航/搜索、真实模型目录、内嵌 Skills 预览/启停读回、目录与记忆撤权、实际归档内容、备份导出/原文件回读/verify/取消/失败、实际 run 设置往返、双视口与重启偏好。使用授权 DeepSeek，仅合成文本；受控 chooser/provider 边界与真实 provider 结果分开。
4. 最终 out 固定后主 smoke；git diff --check。报告精确命令/通过数/失败/skipped/未验范围，保存显式截图和报告原字节 hash，不保存 Key/DB/native 私有历史。

完整 C 验收前不勾父项。C 完成后下一精准 D1–D7，而后 P07 办公文件/联网图片产物与 P08 实际无 VPN/安装/最终八组；不重新选择引擎，不转回三元题组，不提交/push/改系统网络或真实教师数据。
