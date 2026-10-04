# 小智 AI Harness 第一性分析与开源代码复用审计

日期：2026-09-24；依据：本机 `D:\WorkProject\开源\ZCode` 3.14.3、`D:\WorkProject\开源\openhanako` 0.449.0 的源码。本文记录当前 checkout 的实现证据，不代表上游后续版本。`langgraphjs` 是运行时依赖源码核对对象，不计入用户指定的两个对照项目。

## 从教师任务倒推运行时

教师需要的不是任意自主行动，而是：给小智一个明确的教学目标 → 在授权范围内读取本地证据 → 只把脱敏必要文本交给模型 → 返回带来源/未知项的可编辑草稿 → 老师确认后才保存 → 中断、失败、重启后能知道发生了什么。最小闭环先取“校正错题 → 三元题组”，再扩到资料检索与组卷。

每一步都必须有一个事实所有者：SQLite 保存业务数据和确认结果；Electron main 执行权限/隐私/工具/模型编排；renderer 发起教师动作并显示结果；Python 只做 OCR/解析等专用能力。模型输出与界面提示均不能自证完成。

## 两个项目的代码事实与取舍

| 关注点 | ZCode 3.14.3 | openhanako 0.449.0 | 小智取舍 |
| --- | --- | --- | --- |
| 运行时 | `apps/zcode-cli/packages/core/src/agent/turn-state.ts`、`turn-machine.ts` 定义 turn 阶段、模型请求、工具调度、权限等待和终态；运行时由 `agent-runtime.ts` 组装 | `core/session-coordinator.ts` 负责会话生命周期，底层用 Pi SDK；`lib/loop/loop-controller.ts` 对多轮任务设置轮数/失败护栏与恢复 | 继续用已接入 Electron main 的 LangGraph.js 表示教师任务图；借鉴明确状态/预算，不把完整 coding/general agent runtime 搬入产品 |
| 工具权限 | `permission/service.ts` 以能力声明和模式返回 allow/ask/deny；`tool/executor/approval-gate.ts` 预览失败时仍保持 ask | `lib/permission/tool-invocation-permission.ts` 把执行参数做不可变快照，拒绝 getter、循环对象和超界输入；权限描述与实际工具绑定 | 保留小智现有 route/context/effect 审核与教师确认，直接复用 openhanako 的参数快照函数加固主进程入口 |
| 模型协议 | `runtime/helpers/model-tool-call-validation.ts` 对无效工具名作显式失败 | `core/provider-compat/deepseek.ts` 处理 DeepSeek 思考与工具轮次；`tool-pairing.ts` 修复孤儿 tool result | 当前三元题组是单次无模型工具调用，暂无理由搬入这两块 provider 补丁；未来若开放模型多轮工具调用，再按真实故障和协议测试引入 |
| 会话恢复 | ZCode turn state 与 runtime/store 分层，权限与工具各有生命周期 | Hana 的 session JSONL/manifest、loop store 和重启恢复分层；`session-manifest/checkpoint.ts` 是迁移前备份，不是 LangGraph 节点 checkpoint | 新图仍缺持久节点 checkpoint；下一切片在本地 SQLite 增量实现，不拿 Hana 的“迁移备份”冒充运行恢复 |
| 许可与体积 | Apache-2.0；完整 CLI、桌面、Web 与服务端依赖较多 | Apache-2.0；完整 Server、Pi SDK、插件/桥接/沙盒依赖较多 | 只 vendoring 独立函数并附许可证；不 fork 两套产品，避免新进程、通用文件执行和远程桥接进入教师工作台 |

## 本轮可直接复用的代码

复制 openhanako `lib/permission/tool-invocation-permission.ts` 中 `snapshotToolInvocationInput` 及其纯函数依赖到小智主进程工具入口。此函数在读取参数前检查 prototype、accessor、symbol、循环引用、深度、项数与字符串长度，并生成冻结快照。小智当前 `parseToolArguments()` 对 object 直接返回原对象，`validateArguments()` 会读取模型/插件提供的字段；getter 等非 JSON 对象可在审核时执行。复用后无效参数应返回结构化审核拒绝，且 getter 不得执行。保留上游 Apache-2.0 许可证与来源说明。

## 后续逐步验收

1. 参数快照：原有工具成功路径不变；getter、循环对象、危险键及过大输入被拒绝，审核阶段没有副作用。
2. 任务图：错题按钮的明确 intent、脱敏、只读召回、模型输出校验、待确认保存，均以 SQLite 和真实 Electron 操作读回。
3. 恢复：新增图 checkpoint 后在新库与旧库副本验证重启/取消/重试，不允许伪 `running` 或重复保存。
4. 实例验收：用隔离教师样例走“校正错题 → 小智生成 → 编辑/拒绝/确认 → 重启后读回”；真实 provider 与 OCR 分别记录是否验证，不用 mock 结果替代。

## 实施结果

- 已将 openhanako 的纯函数快照代码放在 `apps/desktop/src/main/ai-harness/vendor/openhanako-tool-input-snapshot.ts`，许可证放在 `third_party/openhanako/LICENSE`；在工具参数解析前形成不可变快照。ZCode 的运行时和 openhanako 的整套会话层均未复制。
- `save_exercise_set` 确认动作只接受教师修改的题干和答案，按原草稿题目顺序覆盖；来源类型、题库 ID、解析和谱系字段由主进程保留。确认后同时更新确认载荷、Markdown 与正式题组，拒绝时零正式题组写入。
- 确定性 Electron 专项验收已通过教师按钮、typed IPC、LangGraph、确认、SQLite readback 与重启。另有真实 GLM 从 typed preload 进入三元题组图，完成草稿、教师编辑确认、SQLite 与重启读回；真实 OCR、真实 GLM 教师按钮全流程和图中途 checkpoint 尚无通过证据。逐步对照与剩余门禁见 `docs/33_XIAZHI_HARNESS_PARITY_CHECKLIST.md`。
