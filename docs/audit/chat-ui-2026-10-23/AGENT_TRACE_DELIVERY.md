# 小智 Agent Trace Streaming 交付记录

> 初版历史草稿，用户未接受其视觉效果及空过程展示。当前交付以 [样式审计与真实阶段补齐](style-audit/DELIVERY.md) 为准：固定亮色、原厂样式保护、阶段持久化及完整处理墙钟。下方usage-only计时和暗色检查仅描述早期实例，不是最终产品约定。

用户确认：展示真实步骤、工具结果与公开说明；正文逐字流式，本轮完成后自动折叠。范围和兼容策略见 [合同](AGENT_TRACE_CONTRACT.md)。

## 实现

- 正式Pi对话每轮使用现有HeroUI Pro `ChainOfThought`组合。运行中展开、触发器流式光效，步骤按真实工具/计划/公开说明组成；正文独立位于过程下方，保持流式。
- 主进程现有assistant_end确认最终段，工具边界确认之前的说明。当前段在正文流式显示，后续若实际进入工具调用才归入公开过程，不按模型词句猜测“思考结束”。不展示隐藏reasoning，不新增模型调用或agent loop。
- completed事件才自动折叠，手动重新展开后不会被输入或定时器强行收起。failed/interrupted展开并标记未完成/已停止；waiting_input/approval显示等待教师，实际问答/审批卡保持外露。
- 起始时间复用真实preparing事件，只在投影增加可选startedAt。终态用已有usage的activeMs+waitingMs，刷新/重启仍相同；旧记录无用量显示“耗时未记录”。标题/展开说明明确这是本轮处理时间，包含正文生成与等待确认，不是模型纯推理时长。
- 新增OfficeAgentTurn/OfficeAgentTrace及纯分组helper；通用历史OfficeConversation默认路径保持，Pi入口显式启用。历史终态不启用计时器，过程内容收起时不渲染；稳定回调与单轮memo减少草稿更新牵动历史正文。保留图片交付、来源、复制/修改/保存、停止继续和阅读锚点。

## MCP核验与复用

当前HeroUI Pro MCP的list_components、get_component_docs(chain-of-thought)、get_css(chain-of-thought)均成功返回，无认证/会员阻断。`Agent Trace Streaming`是组合示例，示例导出名与截图Demo包装名不代表新的独立组件。自动折叠、计时由应用真实事件驱动；官方示例的固定秒数/文件名没有作为实际数据复制。[官方文档](https://heroui.pro/docs/react/components/chain-of-thought)。复用仓库已有Pro组件与样式，无新增依赖。

## 真实运行证据

正式Electron + 真实DeepSeek实例 `apps/desktop/test-results/chat-experience-f59b3x/report.json`：**28项通过，renderer error0**。涵盖过程展开时下方正文实际增长、终态自动折叠、手动展开跨草稿编辑保持、两尺寸浅暗/公式、选区修改与复制、预览/取消零写入/确认保存、重试不重复写入/外部文件保护、教学文件来源回跳、流式停止/继续草稿与冷重启、附件真实读取/工具详情重开、教师问题不被手动折叠隐藏、真实无匹配工具摘要。首轮宿主用量18,405ms，标题18秒，非硬编码。

此实例后的最终小调整只涉及上下文整理进行中状态/提示、流式触发器排版；后续构建/对应边界/兼容检查与正式窗口冷读单独核验，不把前一实例冒充全部最新字节的provider重跑。

原始失败保留：YmPoHW实例14项后固定坐标拖选未选中文本；gmMOgo实例4项后宿主快照先于可见正文更新。测试改为等待实际可见流式正文、原生三击选段；没有移除选区核对或用SQL伪造回复。一次边界断言使用了组件内部state名称而非真实DOM运行类，按实际Pro输出修正。首次构建发现Pro Button不支持title，说明移到内部文字span，未绕过类型检查。

## 门禁与边界

精确命令、日志SHA、正式构建SHA、压力对照、窗口启动和剩余事项统一记录在 `agent-trace/checks.json`。本片无SQLite/文件格式迁移、无新IPC权限、无provider推理设置变更。旧回合缺计时不推算，来源目录不充当正文依据。

不宣称模型数学正确性、完整教育四旅程、原生系统缩放/安装/Office版式或长期教师试用通过。既有npm audit仍15项（critical1/high7/moderate2/low5），无依赖变化，本片未执行audit fix。每轮提交直接推送main；正式测试窗口启动在本工作树、独立测试库，不混用日常D盘源码或数据库。
