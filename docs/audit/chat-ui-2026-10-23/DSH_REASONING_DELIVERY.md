# 按 DSH 修正推理阅读交互

用户拒绝上轮“全文推理＋嵌套阶段日志”的阅读体验，并明确选择“按DSH：默认收起＋实时单行预览”。本轮只调整应用展示层；Pi真实推理、脱敏、工具协议、持久化与正文导出均保持。

## 参考与根因

已核对官方 [ReasoningRow](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/ui-chat/src/client/chat/ReasoningRow.tsx)、[独立披露状态](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/ui-chat/src/client/chat/use-disclosure.ts) 和 [配套交互测试](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/ui-chat/tests/reasoning-row.client.spec.tsx)。固定版本687f282e，来源从DeepSeek官方主页确认，文件路径、Git blob SHA与URL归档于dsh-reasoning/sources.json。

上轮证明数据来源正确，但未证明默认阅读体验合适：运行时自动展开完整草稿，单一折叠区又容纳准备/等待/生成三类日志。DSH则把每段推理做成默认收起的独立行，工具与正文另行呈现。完整原文只在用户展开时出现，不能用清洗/改写原文伪造“更像思考”的内容。

## 本轮变化

| 位置 | 最终行为 |
|---|---|
| OfficeAgentTrace.tsx | 每个实际推理块独立控制；默认收起；按真实段状态启用原厂shimmer；手动展开跨正文与完成保持；停止/失败标明状态，不强制展开 |
| reasoning-preview.ts | 运行时取最近已完成段落的首行，完成后取首行；只去掉预览中的粗体标记；未完成行不制造预览，原文不变 |
| OfficeExecutionTrace.tsx | 独立呈现实际工具、公开过程与上下文整理；没有实际内容就不生成入口 |
| OfficeAgentTurn.tsx | 准备/等待/生成遥测不再铺进聊天；正文独立；无内容时保留真实等待反馈；总执行用时独立于思考行 |
| native-component-boundary.css | 仅约束应用预览文字的单行溢出，不覆盖HeroUI内部选择器、字体配色或交互状态 |

不修改vendor，不复制DSH CSS或引入其依赖，不切换模型、修改共享契约或SQLite。没有翻译服务、额外产品模型调用或新增外部数据传输。

## 验证

当前工作树apps/desktop下运行：`npm run build`、`npm run test:model-reasoning`（17）、`npm run test:agent-trace`（19）、`npm run test:renderer-components`（217＋样式6）均通过。

真实Electron实例 `dsh-reasoning-vCVd2I`：21项通过，pageerror/console error为0。包含真实推理默认收起、正文流式与手动展开保持、无泛用阶段/空执行区、实际工具独立展开、长预览单行不撑宽、复制/Markdown导出正文隔离、SQLite和重启、停止与失败，以及亮色1366×768/1920×1080的Hover/Focus/Active和官方CSS对照。没有把模型未返回的工具回合推理补造出来。报告与源码/构建身份见dsh-reasoning/real-electron.json和checks.json。

真实调用配置只从已授权的 `D:\WorkProject\EduProject\apps\desktop\.env.local` 读取，命令设置 `XIAOZHI_AUDIT_ENV`；测试库为独立Temp教学数据。受控失败仅在独立测试实例临时拒绝一次net.fetch，finally恢复，不是供应商事故。

最终同构建 `node scripts/electron-smoke.mjs` 207/207、ok=true，详见 [smoke.json](dsh-reasoning/smoke.json)。`npm audit --json` 仍为原有15项（critical1/high7/moderate2/low5），无新增依赖或锁文件变化；`git diff --check`通过。当前工作树最终窗口已启动到原型普通教学问答，默认收起、0全文DOM、0阶段日志、0空执行区、亮色且无故障拦截器，详见 [startup.json](dsh-reasoning/startup.json)。

## 前后对照

- 之前：[全文和泛用日志同区](model-reasoning/after-light-1366-completed-expanded.png)。
- 之后：[1366默认收起](dsh-reasoning/after-light-1366-completed-collapsed.png)、[1920默认收起](dsh-reasoning/after-light-1920-completed-collapsed.png)。
- [点击展开全文](dsh-reasoning/after-light-1366-completed-expanded.png)、[工具独立入口](dsh-reasoning/tool-records-independent.png)、[停止仍收起](dsh-reasoning/stopped-collapsed.png)。

原厂样式与CSSOM、来源候选、层级和交互获胜规则见dsh-reasoning/cssom-light-1366.json及cssom-light-1920.json。本轮按用户要求仅亮色。

## 剩余边界

DSH参考的是交互，不是替换小智架构。模型原文可能包含英文或草稿，展开后仍如实显示；不会未经选择发送到翻译平台。整套聊天高级感、长历史性能、回复动作间距及既有15项依赖告警继续保留为后续事项。自动化通过不替代教师对默认阅读体验的实际试用。
