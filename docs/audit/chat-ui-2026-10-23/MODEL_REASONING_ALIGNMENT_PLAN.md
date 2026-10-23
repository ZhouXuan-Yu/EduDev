# 模型推理输出与 ChainOfThought 对齐方案（已获准实施）

2026-10-23：用户明确回复“可以按照这个方案开始执行，解决这个UI组件的问题”。本合同属于 M10 AI 治理/教师任务可观察性，取代此前仅显示执行过程的选择。实现与最终测试另见 MODEL_REASONING_DELIVERY.md；原厂样式恢复 A 和亮色约束继续有效。

## 已确认的根因

- HeroUI Pro MCP `get_component_docs(chain-of-thought)` 本次成功。官方说明组件与 AI SDK 解耦；`isStreaming` 仅驱动标题 shimmer；`AgentTraceStreaming` 是组合示例，其文字由示例代码提供，并非自动读取模型推理。
- `apps/desktop/src/main/xiaozhi-agent/pi-session.ts:431` 默认 `defaultThinkingLevel: 'off'`；547 行创建会话再次固定 `thinkingLevel: 'off'`。
- 同文件 760–764 行仅将 SDK `text_delta` 转为正文事件，没有转发 `thinking_delta`。现有准备、等待、生成阶段是运行遥测，不是模型推理文本。
- 已安装 Pi SDK 的 `dist/types.d.ts` 声明了 `thinking_delta`。DeepSeek 官方文档说明推理模式通过独立的 `reasoning_content` 返回内容，并对工具回合的推理字段回传提出要求。当前所选模型的端到端兼容性尚未真实验证。

## 建议交付合同

1. 数据只来自模型接口实际返回的推理字段，经 SDK thinking 事件进入独立的共享事件和投影；不从正文猜测，不以模板状态或另一次模型生成冒充。
2. 组件原厂设计与亮色保持；推理文本流入 `ChainOfThought.Step`，`isStreaming` 跟随真实推理段状态；工具记录保留其真实调用和结果，与模型推理明确区分。
3. 正文仍按原 `text_delta` 流式输出。延续此前确认的整轮完成自动折叠、手动重开；区分模型推理段用时与整轮执行用时，等待网络/教师不标成思考耗时。
4. 推理未返回时如实显示“本次模型未返回推理内容”，无推理历史不补造；停止/失败保留已收到的片段并标明未完成。
5. 工具回合由原 Pi 会话保留并按供应商协议回传必要推理字段，不新增模型循环，不改 vendor。展示数据需要独立边界、脱敏、长度上限和安全 Markdown 渲染；不自动混入教师正式文档或正文导出。
6. 旧文档“隐藏思维链不作为产品数据”的表述需明确区分：本方案接入供应商 API 明确返回的文本，不声称读取模型未公开内部状态。新增持久化范围先在合同中明确，再实现和验证。
7. 验收覆盖真实 provider 的无工具和工具连续回合、流式区分、计时、折叠、停止/失败、历史重启读回与双尺寸亮色；不能用 SDK 类型或 fixture 代替实际响应证据。

## 官方依据

- https://heroui.pro/docs/react/components/chain-of-thought
- https://api-docs.deepseek.com/guides/thinking_mode/

## 已冻结的存储、兼容和回滚边界

- 新增可选 `modelReasoning` 投影和 `model_reasoning` 事件，沿既有 typed preload 事件通道，不新增 IPC、表或文件真源。
- 展示和历史只保存脱敏后的 provider 文本、来源标记、片段状态与宿主计时；保存到现有 assistant metadata 的 `{version:1,blocks:[...]}`。每轮最多32段、总65536字符。旧消息无此字段时不补造推理。
- Native Pi 继续保有其原生模型消息及工具协议回传需要的 reasoning 字段；不把 SDK 消息、签名或完整内部上下文暴露给 renderer。推理不进入正文复制和文档导出。
- 默认使用原模型的 low 推理级别，未切模型、未添加第二次模型调用。所谓思考用时是首个实际推理 delta 到推理段结束的接收用时，不是模型硬件内部纯计算时长。
- 取消优先立即中断 Pi，再结算原有确认卡；保留既有写入审阅和不确定结果保护。脱敏失败隐藏该段，长内容明确提示截断。
- 回滚为撤销本轮提交，旧库无需迁移回退；原有正文/publicItems 仍可读取，原厂组件与 vendor 不修改。没有扩大文件或云上传权限。

此前泛用阶段日志的“思考内容”验收不成立；实际模型字段接入必须依据本轮真实 SDK/SQLite/重启和用户可见证据验收。
