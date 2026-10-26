# DSH 对照与已确认的展示合同

用户已选择“按DSH：默认收起＋实时单行预览”。本轮M10只改展示与交互，不改Pi、模型调用、共享事件或SQLite；保留HeroUI原厂设计和亮色。Git起点为干净的main/56c6858。

官方参考：deepseek-ai/deepseek-harness，固定commit `687f282e8625c6b8d11ff58211a90524be2e4317`。从DeepSeek官方主页确认仓库，经GitHub连接器读取ReasoningRow.tsx、ReasoningRow.module.css、ReasoningContent.tsx、use-disclosure.ts、presentation-policy.ts及reasoning-row.client.spec.tsx。没有运行DSH代码或安装其依赖。

源码确认：每段推理独立且默认收起；运行预览为最近已完成段落的首行，结束为首行；展开才挂完整Markdown；手动展开不因正文/工具或终态被撤销；空推理不生成块。工具与整轮工作详情是独立呈现，不嵌进推理内容。旧归档tail-scroll笔记与现行代码有差异，本轮以固定版本代码与测试为准。

当前问题：运行即展开全部草稿、执行阶段日志嵌在思考区、正文和思考视觉主次不足。修复：OfficeAgentTrace改独立推理行；新增纯预览选择器与OfficeExecutionTrace；OfficeAgentTurn移除聊天中的准备/等待/生成日志，保留真实工具与公开过程入口；总执行用时独立显示。原推理、遥测及持久化不改，旧数据无需迁移；回滚展示提交即可恢复。

只为应用自己的预览文字添加单行溢出布局，不覆盖第三方BEM、slot、字体配色、交互状态或!important。不改写/翻译推理，不启用DSH可选的外部翻译服务。

验收覆盖预览换行/CRLF/未完成行、多个独立披露、空推理、手动展开保持、正文外露、实际工具分离、运行/完成/停止/失败、真实Electron与重启、亮色1366×768及1920×1080原厂样式对照。测试与截图结果见DSH_REASONING_DELIVERY.md。
