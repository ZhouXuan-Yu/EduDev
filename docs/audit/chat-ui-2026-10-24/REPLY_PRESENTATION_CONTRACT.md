# 本轮交付合同：M10 回复展示边界与整轮过程

教师可见结果：每轮只有一个官方 Agent Trace Streaming 折叠区；真实推理、公开说明和工具按发生顺序输出；正文开始时收起，正文持续流式输出；总过程时间只在顶部显示，手动展开可回看。仅亮色，不改第三方组件源码和设计 token。

已证实缺口：renderer 把推理全部排在工具之前，为每段创建独立 disclosure；正文依据数组末项猜测，进入工具后迁移；宿主落盘结束才关闭；Markdown 禁用了官方动画。DeepSeek completions 没有在首个正文 token 前提供稳定 final phase。

实现：独立的文本展示协议适配器要求普通文本以 `<xiaozhi_progress>` 或 `<xiaozhi_answer>` 开头（无闭合标签）；只解析段首标记，跨 chunk 保留不完整前缀。标记不进入 UI、复制或产物。实际 provider 有时追加可选闭合标签，适配器仅在段尾跨片剥离闭合标签，保留代码中的字面量；协议分隔空白与最终保存正文统一。原生 reasoning 字段不受协议影响。缺失标记时保守当作过程，收到 SDK stop 才确认正文；不依据语义、数组末项或定时器伪造 final。若模型在 answer 后继续工具，实际工具边界重新打开过程，标记为协议回退，不冒充完成。

新增独立模块：main presentation-event-adapter、shared presentation reducer、renderer stream buffer/snapshot reducer、整轮 header/state/timeline/answer；旧入口仅接线，删除重复逻辑。事件增加可选展示顺序与 phase，复用现有 typed IPC；公共项和推理 metadata 增量兼容，不迁移 SQLite、不引入依赖、不新增执行循环。历史没有顺序时使用公开 sequence/segment 做保守排序。

验收：协议跨 chunk、缺失/无效标记、cancel/失败；过程说明不跳入正文；一次折叠、正文首字前交接、真实顺序；manual reopen；缓冲边界强制刷新和切会话隔离。运行 build、renderer、trace/reasoning、相关 host regression；真实 Electron + DeepSeek 多工具/普通问答/停止/可控错误、复制/保存、SQLite 与重启 readback；两种尺寸截图与 hover/focus CSSOM、控制台检查。截图自查发现偏差继续局部修复。

不修改业务权限、隐私、审批、资料真源、供应商实现；不伪造推理或启动另一 agent loop。测试数据只在独立临时目录。回滚本轮应用层模块与接线即可，旧 metadata 仍可读取。完成后按既有授权提交并推送 main；Git 锁若仍被审批策略阻止，保留现场并如实报告。
