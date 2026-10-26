# Agent Trace Streaming 交付合同

> 后续用户明确要求组件设计保持、先审计/批准A恢复、只用亮色，并继续要求补齐空过程。最新增量见 [公开阶段合同](PUBLIC_TRACE_TIMELINE_CONTRACT.md) 与 [最终交付](style-audit/DELIVERY.md)。终态trace优先用真实准备到宿主finishedAt的墙钟时间；本合同早期usage-only设想已修正。

用户已确认：真实步骤、工具结果和公开过程说明；正文逐字流式，本轮完成才自动折叠过程。完成后启动本工作树小智供用户测试，每轮提交推送main。

目标M10：每轮教师提问下方使用HeroUI Pro ChainOfThought的Agent Trace Streaming组合；运行中展开并显示真实阶段，正文独立流式呈现，完成时折叠为含耗时的一行，允许手动重开。失败/停止明确标记，待教师确认卡保持外露，不藏入自动折叠内容。公开说明只有已确认非最终的段落归入过程，当前流式段先在正文显示，工具调用后按事实归入过程；不通过关键字猜正文/思考。

数据边界：复用现publicItems、tool回执、activity与宿主usage总耗时，不接入隐藏reasoning、不额外调用模型、不造步骤/计时。耗时说明为本轮总处理时间，包含正文生成与等待教师时间，非纯推理时长；旧记录没有计时就明确未记录。计时起点可由首个真实preparing activity保留在投影，旧数据兼容；无SQLite迁移、无新授权。

变更：抽取Pi专用单轮消息组件/纯分组helper/Trace组件，复用本地现有Pro源码与样式；shared projection如需新增可选起始时间仅为展示；通用旧OfficeConversation路径保留。工具/计划/图片来源/回复复制修改保存、停止继续/阅读锚点保持。当前工作树干净a4100b9。先以真实列表/文档/CSS接口核实MCP（均已成功），不引入新包。

完成：组件与纯函数验证当前段/最终段、完成折叠、手动重开、失败/停止、无计时旧记录；正式Electron真实provider验证过程→工具→流式正文→完成折叠、问答/停止/冷重启、两尺寸浅暗、耗时与SQLite usage一致。重跑适用smoke、UX00压力对照避免新轨迹加重长历史；build、217组件、定向边界、diff check，依赖audit如实记录；提交main核远端SHA，最终窗口留运行。回滚本片文件即可，旧记录缺字段保守处理，不改模型loop/业务确认。
