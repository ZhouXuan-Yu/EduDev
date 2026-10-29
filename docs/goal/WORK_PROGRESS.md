# EduDev 当前任务进度

## 2026-10-29 知识库本轮落地结果

原图文字题完整转录回执已实现并实机通过，真实同页3条ai_final/1图题review；纠错第3题完成语义检索、单题组卷和四文件冷启。核心题库schema常驻+SQLite存在性探测已修，真实自然提问直接search/read（3请求/0目录）。WeKnora完整Windows Lite对照已完成，原始文件/百万规模缺口不满足默认资格；保留现生产检索。完整Goal继续，下一把第4图题接已有原生v3链，同时推进持续摄入与规模质量；不重复候选下载。精确测试与剩余门禁见KB_IMPLEMENTATION_EVIDENCE。

## 2026-10-29 最新用户优先级：通用执行→理科→全科

已完成成熟产品官方能力对照与当前源码差距核查，入口../product/XIAOZHI_AGENT_CAPABILITY_ROADMAP.md。E01默认可用文件工具、E02真实思考设置、E03多轮承接为建议首批，随后受管工具准备/执行/核验/恢复/版本成果；所有候选未实施，不提高完成数。原工具不可用投诉继续OPEN；下一冻结E01–E03合同，尊重单次必要测试、最终集中试用，不扩评测支线或自动追加用尽20次额度。

## 2026-10-29 流式响应与窗口拖动

完成流式Markdown重复配置/模糊动画与标题栏全宽no-drag修复。build、240组件、11边界、50段真实Electron合成流通过；真实长历史复杂内容卡顿未全量复现。更新日常窗口后补原生拖动结果，详HANA_ANSWER_QUALITY。

## 2026-10-29 回答优化续接

当前e147继续codex/hana-answer-quality。用户要求先全部对齐前案功能、每片测试一次、最后集中验收。本轮补原生会话历史复用、活动消息渲染隔离、附件/工作文件引用定位；未开启盲评工具支线或新增API请求。功能清单与最终检查/Git交付状态见HANA_ANSWER_QUALITY.md最新节。并行beca的知识库KR队列维持原进度。

## 并行回答优化（e147，不替换知识库KR队列）

用户授权在 codex/hana-answer-quality 实现以Hana为核心的回答优化。AQ00–AQ07已接入，AQ08本地验证与真实模型质量分层记录；清单、逐项对比、测试命令与未验边界见 [HANA_ANSWER_QUALITY.md](HANA_ANSWER_QUALITY.md)。真实教师盲评尚未通过，不能据工程测试声称“1+1=3已实现”；KR02与0文件导出旧事实保持。


更新时间：2026-10-29。当前实现分支：`codex/knowledge-base-reuse-implementation`（beca）；已整合`origin/main 92d16aa`，保留并行产品路线。前轮纠偏研究分支`codex/kb-reuse-recovery`保留。

当前主线：**知识库交付纠偏与成熟方案复用，几十GB存储与高效检索是选型硬条件**。不再按通用性能审计顺序优先扩建知识库底层。原26项审计继续保留，其2/26不是知识库完成度。

| 步骤 | 实际状态 | 下一步/证据 |
|---|---|---|
| KR00 需求与真实成果复盘 | 已完成只读审查 | 9文件约10.3MB、18OCR页；最新图文页3条ai_final/1图题review；当前真实四文件已通过，完整资料/图题闭环未通过 |
| KR01 成熟产品官方源/API/许可 | 已完成源码核验 | AnythingLLM已发布v1.19.0 API、WeKnora Lite、Docling、kotaemon固定SHA；AnythingLLM/Docling已隔离实跑，但未证明质量胜者 |
| KR02 同资料与规模资格对照 | **候选有限对照完成；最终资格未过** | AnythingLLM兼容后端9文件/40向量，误排/丢页码；Docling含medium OCR仍漏条件。WeKnora未改源完整Lite Windows构建/健康/9OCR文本查询通过，原6图需VLM/3PDF需DocReader；百万原生热P95 3755ms，现Lance探针326ms，非同整产品或真实40GB比较 |
| KR03 薄接成熟通用层/导出归因 | **文字OCR纠错和核心题库调用已修；后端未切换** | 现成熟LanceDB/解析层保留；新图文回执使真实页3题ai_final，原OCR不覆盖。核心题库schema常驻及EXISTS修假空，实际自然问题直接search/read并冷启。第4图题与PDF原生v3仍未通 |
| KR04 真实试卷文件闭环 | **两题与纠错单题四文件通过，扩展未完成** | 当前Pi→界面测试审批→学生/教师DOCX/PDF四文件→完整内容/A4/答案隔离→重启哈希/谱系通过；自动审批非真实教师正确性核验，图题/跨页/整库仍未通过 |
| KR05 自然质量/实际40GB/安装 | 未验证 | 最终自然标注集、真实10GB→40GB、P95/内存/空间/停与恢复；算法规模探针不冒充真实导入 |

用户最新澄清已固化为[本体与受管组件分开交付](KB_MANAGED_COMPONENTS_CONTRACT.md)：安装或首次启用自动下载、配置、托管配套组件/模型，老师免搭环境。解除全内嵌EXE假设；自动安装尚未实现。本轮新增一张有界图文输入证据表及图文回执policy，无新IPC/索引格式/依赖；未切生产后端。候选查询与原生容量为有限对照，完整知识库未完成。

- [当前纠偏合同、成熟方案差距与下一步](../research/KNOWLEDGE_BASE_RECOVERY_20261028.md)
- [同资料/离线解析/原生容量运行证据](../research/KB_REUSE_RUNTIME_EVIDENCE_20261028.json)
- [WeKnora完整原生运行与规模/原件失败](../research/KB_WEKNORA_RUNTIME_EVIDENCE_20261029.json)
- [原图文字纠错、自然查题和实际四文件](../research/KB_IMAGE_TEXT_IMPLEMENTATION_20261029.json)
- [公开源码/许可证/API核验证据](../research/KB_REUSE_SOURCE_EVIDENCE_20261028.json)
- [真实知识库实施证据与失败](KB_IMPLEMENTATION_EVIDENCE.md)
- [26项性能审计清单（独立台账）](DEEP_AUDIT_20261028_TODOLIST.md)

<details>
<summary>已完成的主线/最新UI统一记录（历史，原“下一F01”已被上方当前优先级覆盖）</summary>


更新时间：2026-10-28。每完成一个检查点更新此文件；完成只计有验证证据的项目。

当前优先级：统一所有分支与启动源码，再恢复性能审计。新版UI基线为 `fdc8e9c`；全部代码已整合并正常推送为 `1489db0`，D盘实际运行源码与该代码版本一致。后续收尾文档提交不改变运行时代码。

| 编号 | 工作 | 状态 | 结果或下一步 |
|---|---|---|---|
| I01 | 所有本地/远端分支与五个工作树盘点 | 已完成 | 初查10分支均已包含；新增集成分支后共11分支，最终检查全部包含于main，五工作树保持干净 |
| I02 | 未提交源码、文档、截图和资料保全 | 已完成 | 本地bundle校验通过，50文件/14149447字节逐个SHA回读一致；私有素材不上传 |
| I03 | 在最新main整合F01与新版UI | 已完成 | 398e5e7检查点与615a6d2三方合并；保留新UI，自动审批复用同步/scope门禁 |
| I04 | 构建/回归/独立审核 | 已执行，有未通过项 | build/type、240、36、Pi恢复6/gap6、独立三栏8/菜单8、legacy207通过；UI来源指纹、audit和扩展流控未完整通过，保留待办 |
| I05 | 正常推送main、同步日常D盘目录和干净工作树 | 已完成 | 1489db0正常push并ls-remote回读一致；D与本地main同步，收尾文档再次正常同步 |
| I06 | 从D盘最新源码启动并验证实际窗口 | 已完成 | D:desktop npm start exit0，PID32232/Main实际D:out；4个关键源码SHA一致；原生新版菜单已操作 |
| I07 | 按DOCX重新冻结后续优化计划 | 已完成规划 | 26项状态及顺序/验收/失败/下一步在TODOLIST；每检查点更新本文件 |

审计进度：**已验收2/26**（F14、F15）；F01、F24进行中，其余待处理。集成版已完成本阶段回归与日常UI核对；F01与F24没有正式性能验收，不能以合并数代替优化完成。

完整清单：[DEEP_AUDIT_20261028_TODOLIST.md](DEEP_AUDIT_20261028_TODOLIST.md)。精确命令、失败与边界：[DEEP_AUDIT_20261028_EVIDENCE.md](DEEP_AUDIT_20261028_EVIDENCE.md)。报告来源：[只读转录](../audit/DEEP_AUDIT_SOURCE_2026-10-28.md)。

本地恢复包：`D:\WorkProject\EduProject-local-archive\20261028-main-unification`（bundle、patch、原文件与manifest；不进Git）。

下一检查点：先定位R03扩展流控探针/Stop后立即发送边界，再在新版UI上完成F01同hash性能对照；R01来源指纹需独立来源审阅，随后按清单逐项推进。

已知未通过：UI来源指纹门禁（新版prompt-input与旧baseline不一致）、npm audit22风险。F01/F24性能未验收；不以当前功能测试宣称性能优化完成。

日常启动证据：D盘out SHA256 `ed47fcb104f1fa74f1bde8954767a5df40ab2e42feb6f5d7977cd39be9cd6816`；4个源码与集成树逐字哈希一致。D窗口直接renderer URL未读取，加载路径由进程启动参数及已清除dev URL的启动器/刚生成HTML核对；原生UI四模式已打开并关闭。

</details>
