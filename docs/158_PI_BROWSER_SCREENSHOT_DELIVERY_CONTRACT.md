# M01/M10 浏览器截图交付与自然联网验收合同

2026-10-04。前轮157为实际进展，本轮不启用子agent、不提交或推送，保持日常62244窗口和out。根测试样例说明书NET-01/NET-02为真实输入与判据；原用户失败仍须日常人工确认。

## 目标与当前缺口

教师自然请求打开公开网页、读取当前栏目并收到可查看的真实截图；官网通知明确区分网页发布日期、正文落款及实施学期。现有Hana DOM/ref/原Electron capturePage与安全网络可用，但screenshot只写随机PNG和captured=true，没有durable截图引用、typed预览和聊天入口。现有web19测试对日期断言过松，且显式工具名请求不能证明自然操作。

## 本轮纵向交付

1. 从Hana450原browser-screenshot-file.ts提取原文件命名函数，保留原源/许可/SHA；原ChatAttachment/ChatTool与OSS Modal直接接真实截图。主进程固定会话owned目录，不引入第二浏览器或模型循环。
2. shared browser capture schema1（文件身份/hash/尺寸/URL/时间）→原tool details→原Pi公开tool_end→现有持久publicItems→聊天原附件预览。新typed主frame端口仅接会话/截图身份；按真实已完成tool/run事实授权，原生文件读取与hash核验，不接任意路径/URL/bytes。截图只本地交付，不自动发送模型，不把保存等同模型已看图。
3. 截图前后核同页面revision/URL、ready、current run与取消；失败/空图/变页不发成功回执。预览含加载/错误/本地重试/关闭，冷恢复保留引用、不新建浏览器或重放网页动作。旧captured-only记录保持且不伪造缩略图。
4. 日期验收用完整自然提示词和实际官网正文/元信息；答案不得将URL年月、索引日期当通知落款。若当前正文读取确实漏网页日期，复用现有reader补必要元信息，不能硬编码通知答案或放宽断言。

## 文件与兼容

修改browser shared/host/tools、Pi公开投影/event、typed preload/ipc与原工具详情UI；新增独立capture reader/组件/源码提取及自然NET专项实例脚本。无表迁移、新依赖、原native改写、原学生资料上传、系统DNS/代理/VPN修改。新增可选字段旧历史无字段继续读取；回滚停用预览端口/新增字段，保留原PNG和历史。

## 完成证据

- A：原源码SHA、会话/身份/accessor/串会话/归档/变文件/取消/失败页与变页边界。
- C：同固定隔离构建，从真实可见输入完整NET-01、NET-02、invalid失败输入；官方DeepSeek、真实MOE浏览器/当前DOM/PNG/readback、双尺寸原组件预览、冷恢复无请求/动作重放。
- 最低build、renderer79门禁及相关主流程冒烟，git diff --check；保留首次失败/构建与脚本SHA。
- D/E日常保存凭证、人工签认/原反馈、不翻墙/安装与完整Codex同DPI仍独立未验。下一在此范围实证通过后推进其余FILE/CFG/Skills/全D/P08，不以本轮数量代替全目标。
