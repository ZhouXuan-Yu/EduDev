# U6 给 B/父的唯一 host 接缝

最终状态：A 已审查并接受 F 生产冻结；父复跑准入集成 11 项通过。F 后续仅修 QA 保存路径假设，未再写 host 或任何生产源码。原真实 `run-lMlOPD` exit 1/5 项通过保持原判；相同 1042579 build 的独立冷启动/receipt/hash/ZIP 补验 `readback-followup-0KpxmA` exit 0/3 项通过，详情见 `U6_HANDOFF.md` 最新验收状态。生产及 QA 全部冻结，本次仅更新两份 U6 文档。B 继续独占 host 的其他修复与最终冻结。

生产 host 后续仅 B 编辑；F 不再写入 `production-host.ts`。本协调到达前 F 已写入以下 import 和调用，B 请在当前工作树读取并整合，不覆盖其他改动。

```ts
import {admitClassroomOrTaskTool} from '../education/classroom-plan-admission';
```

`beforeDelivery` 中仅替换原来的 `await taskRuntime?.admit(delivery.callId, delivery.tool, delivery.input)`：

```ts
await admitClassroomOrTaskTool({
  sessionId: id,
  runId: run.runId,
  intent: run.classroomPlan,
  plans: store.xiaozhiState.classroomPlans,
  current: () => !closing && !run.stopped && active.get(id) === run,
  signal,
  task: taskRuntime,
}, delivery.callId, delivery.tool, delivery.input);
```

其后的 `run.publisher.persist(...eventJournal.admitTool...)`、前后 barrier/取消/身份检查和其他生命周期代码全部保留。非 U6 工具仍调用原 task.admit；U6 仅宿主 typed intent 选择独立版本账本，保留 task.refresh 原始教师要求校验，并检查 mode、会话、运行、确认、来源与版本。manifest 仍是 local_write，不降级权限、不改通用 task kinds、不增加模型或批准通道。

根因证据：真实运行六次大纲工具的公开 attempt.code 均 task_blocked；`tools/manifest.ts:7` 声明写入，`tasks/task-evidence.ts:7` 无该类资源映射，`tasks/plan-runtime.ts:108-109` 无匹配步骤则 task_plan_required。具体该六次 taskReason 未从公开账本提取，不混称实测。

F 新增生产文件为 `apps/desktop/src/main/education/classroom-plan-admission.ts`，其他 F 修改仅 education/classroom-plan-state.ts、classroom-plan-tools.ts 与自有验收/测试/文档。真实 task runtime + 执行边界的宿主集成测试已完成，父复跑 11 项通过；source ready 已交接且持续冻结。
