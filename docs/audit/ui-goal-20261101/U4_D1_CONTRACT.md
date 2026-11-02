# U4-D1 · 绑定当前确认卷的导出意图

2026-11-02。功能优先；C1正式资料往返已通过，现修复多卷会话中点击A却由工具读取latest B的源码可达P2。当前分支已无冲突整合main564041a，整合构建/组件/公式/C1实际闭环分别通过。不得把此根因审查当作实际导错文件证据。

## 老师可见结果

从当前确认卷的六类导出按钮准备请求，卷身份和学生/教师/答题卡、DOCX/PDF规格与原输入草稿一起保持。实际工具只读这份确认快照；失效、来源变化或被新确认卷替代时明确拒绝，绝不静默导出另一卷。仍由老师点击原发送和原文件审批，不新增自动执行、文件权限或审批旁路。

本片不开放历史已替代卷导出；保留既有exportCurrent安装约束。无绑定的旧普通请求仍沿原latest语义兼容。历史任意版交付、版式模板与自然图文质量留后续合同。

## 最小数据与消费者

- 可选版本化typed `paperExportIntent` 仅含paperId/digest/audience/format/template，不携带题目正文、绝对路径、目录授权或教师确认。外层sessionId沿原host校验；ID不等于权限。
- 点击捕获卷身份、导航世代；选择目录/读回等await后检查当前身份和意图，过期不导航/不成功回调。导航被dirty guard拒绝保持原页。
- typed导航seed→已有Composer草稿→发送/失败重试/会话切换/本机恢复全程保留文本与绑定的原子关系。已有非空草稿不得被覆盖或附错绑定，seed不得静默消费。取消或明确移除绑定要有清晰状态，不能变成无绑定的同文本导出。
- 最小实现明确拒绝带绑定的steer/followUp、续接和混合附件发送，保留输入及错误提示，不丢弃绑定。保留普通Composer外观/控件配置和行为；可复用现有提示，不增加美化或vendor/CSS改动。
- host严格验证、将绑定捕获到本轮Active/run并加入command hash/renderer重试比较。同command换卷/规格必须冲突；旧无绑定hash兼容。新绑定不变成会话全局last-intent，不重放模型或文件写入。
- 专用工具用review(sessionId,paperId)精确读取，再验证digest/current；匹配format/audience/template。任何异常不能fallback latest。模型说明仅辅助调用，不作为选择/授权真源。继续原Office approval→withConfirmedSource→同步安装→paper source账本和图片校验。

## 写集及保护

预计renderer：PaperExportEntry、DesktopFrame、OfficeComposerState、OfficeComposer、composer-drafts、PiEducationWorkspace；shared：paper-export、xiaozhi-agent、xiaozhi-start；host：production-host及education/paper-export。允许将新增验证/比较/导航交接抽窄helper，避免继续堆入App/host。若需改App只允许typed seed接线，不改业务树。无需新表、IPC、依赖或Office安装协议。

实现由Sol负责上述源码及focused mounted/shared/host tests；根负责合同/集成/构建/实际Electron和交付；Goodall负责独立QA runner，Astra只读验收。写集冲突先回报，不覆盖协作者代码。保护C1、Bv2/旧v1读器、原来源和历史、Pi唯一runtime、权限及全量用户数据。

WIP独立审查发现旧绑定任务可经resumeTask、continueTask或纯文本“继续”丢绑定后进入latest。为兑现既定“不支持续接则明确拒绝”合同，允许最小扩展 `tasks/coordinator.ts` / 窄helper：读取目标任务权威原消息metadata，统一拒绝这三入口，保留普通任务续接；仅校验新请求含intent或隐藏按钮不足。须补三入口host回归。此为源码可达P2，不冒称已实际导错B。

## 验收

1. 协议/真实host边界：invalid/extra/accessor输入、跨session、错误digest、archived/stale/source变化；模型改format/audience/template均拒绝，无写入。重复command原身份复用、改绑定冲突；旧无绑定请求兼容。
2. Mounted真实消费者：原有草稿、seed pending/消费、拒绝导航、目录迟到、快速切卷/会话、Back/Forward/恢复、编辑和失败重试。无串配、覆盖或静默丢绑定；不支持操作保留输入。
3. A/B竞态：点击后、发送后、工具读取后、审批后安装前新确认B；不得用B冒充A，失效无新文件/来源记录。host安装锁原守卫不得放宽。
4. 实际Electron使用独立profile和自有数据副本、原UI创建/确认目标卷，不SQL/API造题/确认。通过原Composer/Pi/原UI审批生成至少一份实际文件，Office draft、字节内容与SQLite source均精确匹配同paperId/digest；另实际两卷竞争证明不会改导B。冷启、双尺寸/无原生黑三角、console检查。若控制服务响应而非真实provider，必须单列而不能冒充自然质量。
5. build/TSC、245组件和本片focused边界及原paper/C1适用回归通过；独立Astra复核后修复。现有未验自然数学/扫描、Word/WPS、全ChatGPT/教师质量仍保持开放，不扩大本片完成定义。

无数据迁移。需要回退时先停用D1新准备入口，保留可选绑定字段读器、已有绑定草稿的阻断/取消提示及原绑定任务续接拒绝，不把持久绑定草稿降成可发送的纯文本请求。保留已保存Office文件、原来源记录、快照、历史、Bv2读器与C1，不批量删缓存或用户草稿。完整回退演练未执行。
