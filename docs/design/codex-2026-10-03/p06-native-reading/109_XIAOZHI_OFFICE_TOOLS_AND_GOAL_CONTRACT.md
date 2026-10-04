# P07 小智办公工具与持续目标：共同交付合同

日期：2026-10-04。M10/M01，衔接107→108。完整目标仍为Codex式真实公开过程、工具、Skills、模型/设置与工作区，教育办公定制、嵌入Pi/Hana和自有中国API；不是编程助手或三元题组。本合同冻结剩余功能，**不是实现完成证据**。

## 1. 第一性需求与真实现状

教师交代一项任务，需要小智查资料、读办公文件、拟定或修改内容，展示正在做什么、依据什么，必要时等教师决定，交付可打开的真实文件；后续能审阅修改、撤销、跨轮继续一个目标。聊天文本、漂亮计划条和“已完成”字样不能代替真实产物或持续执行状态。

当前实际源码：

- production-host默认`OMNI_EDU_XIAOZHI_PI !== '0'`，嵌入SDK默认链保持；control-tools已有每run update_plan/ask_teacher，不是跨run持久goal。
- education-tools仅接原老师知识库检索和必要脱敏；office-agent/hana-tool-adapter已有read_text/file_stat/list_files/copy_file/web_fetch/web_search六工具，文件复制有真实审批、源hash和重启不重放。没有正式文本编辑/新建产物/撤销；Office/PDF正文及图片数量分析未接齐。
- Web search复用Hana匿名AnySearch；存在接口不证明国内无VPN可达，不能勾P08。raw网页/文件内容是资料，不授予权限。
- 原Pro32/Finesse/R1/R2设计与公开text/tool投影继续；Skills/模型设置已有生产路径，不用新增假菜单充数。官方未见Skills/设置图已向用户请求补充，等待期间保持现有一致token和真实能力，不假定回复或授权。

## 2. 优先复用与取舍

| 能力 | 已核现成来源 | 复用/适配边界 |
| --- | --- | --- |
| 文本精确编辑与diff | 已安装Pi0.80.3/MIT，root exports createEditToolDefinition/createEditTool、EditOperations、EditToolDetails | 原编辑算法、规范diff/patch和custom operations；先在主进程受控内存操作捕获拟修改结果，审批前不写原文件。不能直接开放默认FS编辑或bash来绕审批 |
| 文件权限/审批/幂等 | 当前Hana FileRef/resource-io/snapshotToolInvocationInput及Pi approval-coordinator/persistent-state | 增量扩展正式契约，不旁路现有授权、排除根、link/硬链接/源版本和call ID；旧copy恢复保持 |
| 办公正文抽取 | Hana0.449.0/Apache-2.0 `lib/document-extract/{index,types,anydoc-loader}.ts` | 已读原buffer/format/50MiB上限/扫描PDF失败口径和懒加载；其@firecrawl/anydoc带原生扩展。须核当前可装版本/许可/体积/Windows包及离线运行，再决定直接源复用；不在未核前新增依赖或把云解析当本地 |
| 图片/文档内媒体 | Hana `lib/sandbox/read-office-media.ts`及现有本地OCR/媒体链 | 先核实际来源/本地缓存/模型能力与教育脱敏规则；学生原图不能因model支持图片而自动上云，图像回执须真实数量/可预览路径 |
| 审阅/变更 UI | 已接Pro ChatTool/CodeBlock/FileTree/Tabs/现成HeroUI控件；Hana desktop utils/line-diff候选 | 先官方MCP/本地原源闭包和许可，再复用真实数据。文案是“资料修改/修改前后/撤销”，不让教师处理原始SDK JSON或Git术语；不能预先伪造更改胶囊 |
| 持续目标 | 原Pi会话/队列/恢复与当前run计划已有，可对比Hana实际任务机制 | 先查现成持久任务/goal机制；未核到现成源码不声称已有goal SDK。主进程需要目标事实和run关系，计划卡不充当持久目标；模型只提议完成，宿主和验收事实确认 |

以上源码只是候选/已有复用事实，不证明P07产物或正式goal已经成立。新依赖必须单列用途、精确版本、许可证、安装体积、Windows打包与回滚，并锁定；能用现有SDK完成的不再引另一个编辑引擎。

## 3. 连续实施顺序与纵向完成定义

### P07-A：真实文本产物、编辑审阅及撤销（下一第一个实施项）

1. 查原Pi EditOperations/写入能力和Hana变更/原审批链，冻结A具体增量契约及migration；shared版本类型→main受控proposal/审批/文件版本→typed preload→原确认/变更审阅/文件预览→真实UI起点。
2. 支持授权工作目录中的UTF-8教学文本/Markdown拟修改及新产物；保存源hash/拟结果hash、实际diff/patch和来源。批准前零写，拒绝/停止/撤权/源改动/目标冲突零提交。原始资料、已确认业务题目和正式产物不被编辑工具自动覆盖。
3. 批准后主进程提交真实结果，文件readback吻合再显示成功/修改计数。before/after有限本地恢复记录与现有文件mutation顺序，结果不确定不重放；撤销必须核当前after版本且教师明确动作，不覆写后续手工修改。
4. 页面复用原组件：同一轮公开说明→实际拟修改/等待→批准或拒绝→真实变更/来源→可打开文件；停止与输入始终可达，历史回执/重启一致，loading/empty/partial/error/retry明确。
5. 实例：自然任务整理/修改合成教研资料；审查diff、拒绝零写、批准一次、重复请求/跨会话拒绝、取消/重启/源版本变更、实际撤销和撤销冲突，1366/1920；底层专项/renderer/build/main冒烟及readback。只测试隔离数据目录，真实教师资料不作测试。

### P07-B：Office/PDF正文与可打开导出

本地解析DOCX/PDF/XLSX/PPTX必要正文，扫描PDF明确需OCR；无网络解析依赖。Worker协议版本/超时/取消/限体量/错误/来源页或段落，旧parser兼容，现有资产事实优先。调用工具结果必要脱敏，教师可在文件面板预览/修改，产物Office/WPS可打开；正式输出和已有导出/资源谱系接齐，另核A4/公式/表格业务范围。不承诺像素级还原。

### P07-C：国内联网与真实引用

比较Hana原搜索/网页读取及国内可达源，不为用户额外开付费服务或写新凭证。搜索结果/来源URL/时间/失败真实，网页内容不执行指令；超时/取消/限流/空结果/访问限制和引用有前端反馈。不自动开系统代理或改DNS，不把代理环境可达当无VPN证明。

### P07-D：附件、图像与产物回执

原native chooser/文件授权接真实附件列表；数量/thumbnail/查看行为由实际工具/产物事实驱动，换会话不串。学生图片与身份保持本地OCR/教师校正与脱敏；可公开办公图像使用能力已核模型或现成工具，未支持如实说明。图片/文件产物能打开，历史/取消/重启的数量和版本一致。

### P07-E：持久目标与主动继续

目标objective/状态/当前步骤/证据/run关系是本地正式事实，使用原Pi prompt/followUp/steer/abort通道。每轮是公开说明+真实工具+结果；不能靠UI计时器自动制造“继续”或把每轮未完成误报最终成功。明确停止/暂停/结束优先，不在重启后未经规则自动重放写工具/审批；待答与批准仍按教师决策。源版本/权限/Skills/模型切换和压缩不能复活撤销内容，目标完成按交付事实审计。具体自动继续机制必须在E合同先查复用来源并冻结，不在renderer发循环。

## 4. 共同安全、兼容与收尾

- 主进程唯一事实/权限来源；本地SQLite与文件保持真源。结构化输出/工具边界严格校验，必要脱敏后才发中国API；不自动上传原资料/学生图/整库。
- 每个新增shared/IPC/schema/migration/私有文件目录必须在对应切片合同列出，旧DB副本/全新DB幂等验证和回滚保持。原copy/教育记忆/Skills/模型配置迁移不能被破坏。
- 用实际用户动作→正式typed main→Pi工具→SQLite/文件/重启验收。构建/manifest/源码存在不等于用户闭环；错误必须保留已完成事实，明确重试不自动重放。
- 每个切片先contract后implementation，必要冒烟与真实实例后写验收/四根+26/28/35/67及下一个具体动作。A未通过继续修，不以源码复制数量算完成。
- P08仍包括实际关闭VPN的国内API/联网场景、Windows安装/包内原生依赖、旧数据、最终八组及D1–D7完整视觉/Skills设置缺失参考。整体目标不缩成通过的文本编辑切片，不提交推送/上传真实资料/修改系统网络或派子agent。
