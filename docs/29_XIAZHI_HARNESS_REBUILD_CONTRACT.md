# 小智 Harness 重做交付合同

> 2026-10-02：用户要求暂停三元题组开发，先完善 Codex 对齐的办公智能体。下文保留旧切片合同和历史范围；当前主执行合同及顺序以 docs/34、docs/35 为准，不继续按本合同扩建三元图。

日期：2026-09-24；状态：执行中。用户已决定以智能体为产品交互中心，重做当前分散的 AI 执行链。此合同约束每个可验收切片，不把重做等同于一次性删除旧代码。

## 目标与范围

- 模块：M10 AI 治理，依赖 M01 数据底座与 M03/M04/M05/M07 的既有能力。
- 教师可见的首条路径：错题图片进入 `needs_ocr`，教师校正并核对脱敏文本，点“发送小智分析”，得到有来源和未知项的三元题组草稿，编辑或拒绝，再由教师确认保存。
- 运行时基座：在 Electron main 内嵌 LangGraph.js，统一路由、受控工具、模型、结构校验、质量门禁、人工确认和可恢复状态；Python 只承担 OCR/解析等能力。ZCode 仅作为工具权限和界面设计参考，不 fork 整套编码智能体产品。
- 保留两条现有业务闭环、本地 SQLite 与文件真源、脱敏上云、教师确认和题目谱系。

## 当前证据与缺口

| 环节 | 当前实现 | 首切片缺口 |
| --- | --- | --- |
| 导入/校正/UI | `MistakesWorkspace` 可导入图片、标记 `needs_ocr`、教师粘贴校正与脱敏预览 | 尚无真实本地 OCR 结果，不得声称 OCR 完成 |
| AI 入口 | renderer 经 typed preload 调 `runDeepTutorConsole` | 同一任务可能走 direct、Python DeepTutor、旧 TS loop；缺少唯一执行状态机 |
| 工具与质量 | 主进程已有路由、工具审核、`xiazhi.reply.v2`、grader 与确认队列 | 将这些规则收敛到图节点，避免各入口各自复制门禁 |
| 持久化 | `ai_agent_runs/events` 与确认项在 SQLite | 图检查点、重启续跑、幂等和旧运行记录映射未统一 |
| 验收 | 现有 Electron smoke 覆盖错题导入与教师校正 | 需新图真实入口、失败/取消/重试、SQLite readback 与重启 E2E |

## 预计变更面

- 新增 `apps/desktop/src/main/ai-harness/graph/` 的状态契约、节点与运行适配器；锁定 LangGraph.js 版本，核实 MIT 许可、依赖体积与 Windows 打包结果。
- 在既有 `ai_agent_runs/events` 基础上增加版本化 checkpoint 存储；任何表迁移必须在新库和旧库副本上验证，不写入原始图片或未经脱敏的学生文本。
- `ai:deepTutorRunConsole` 保持 IPC/preload 形状作兼容 adapter；仅首切片 route 在验收后切到新图。旧入口先保留，显式功能开关可回退。
- `MistakesWorkspace` 的教师操作与错误状态保持连续；新图 trace 显示真实节点结果，不能显示模型隐含推理。确认仍走现有队列。
- 增加图契约/故障专项测试、Electron 用户路径、重启后状态与 SQLite/文件 readback；按根 `AGENTS.md` 运行 build、renderer components、模块 smoke、关键路径 smoke、`git diff --check`。

## 首切片完成定义

1. 真实教师按钮进入 LangGraph 图，路由与工具权限由 main 统一控制；模型无密钥、超时、工具拒绝、schema/grader 失败均有终态和可见反馈。
2. 只向云模型传脱敏必要文本与 bounded 来源；图输出保持 `xiazhi.reply.v2`，未经确认不写题库。
3. 运行状态和确认项可 SQLite readback；退出重启后无伪 `running`，可继续或明确重试。
4. 旧库副本与新库迁移、1366×768 和 1920×1080 的 Electron 用户路径均通过；真实 provider 与本地 OCR 若无测试条件，分别报告未验证。

## 回退与停止条件

新路径按 route 开关启用，故障时人工关闭并回到既有入口；不自动双写或重放 AI 写入。旧代码在新路径通过读回、重启与 E2E 前不删除。若发现数据迁移需要覆盖教师资料、改变脱敏边界，或目标区出现未知脏改动，停下并保留现场。

## 本轮不做

不重写全部页面、不迁移所有 DeepTutor 子能力、不替换 SQLite 真源、不声称已完成真实 OCR 或商用质量评测、不自动上传图片或整库。

## 2026-09-24 实施与验收记录

- 已锁定 `@langchain/langgraph@1.4.17`、`@langchain/core@1.1.48`，两者以 npm lockfile 固定；LangGraph.js 为 MIT 许可。内嵌图编入 Electron main，不新增外部服务或原生 checkpoint 依赖。
- `mistake_triplet` 明确意图沿现有 typed IPC 进入图：任务路由 → 已审核的本地相似题工具 → 脱敏有界上下文 → DeepSeek → `xiazhi.reply.v2` 与双 grader → 教师确认队列。旧路径通过 `OMNI_EDU_XIAZHI_TRIPLET_GRAPH=0` 回退。
- 已完成 build、renderer components 79/79、AI harness 125/125、新图 4 条确定性路径；专项 Electron E2E 从错题按钮走到图运行，并从 SQLite 读回失败终态与版本事件。
- 完整 Electron smoke 前两次分别在讲义页面提示等待和旧控制台凭证断言处失败。查明测试进程继承本机模型密钥会触发网络请求后，E2E 禁止加载本机 `.env.local` 并清空继承的 DeepSeek Key；隔离数据根完整重跑为 207/207，通过 1366×768 与 1920×1080。该结果是确定性/隔离环境验收，不代表真实 provider 质量。
- 根据 `docs/30_XIAZHI_HARNESS_SOURCE_REUSE_AUDIT.md` 对 ZCode 与 openhanako 完成源码审计；直接复用 openhanako 的独立工具参数快照函数及 Apache-2.0 许可，工具入口对 getter、循环、危险键和超界参数显式拒绝。
- 成功路径专项 Electron 实例验收通过：校正错题 → 脱敏 → LangGraph 结构化三题 → 教师拒绝零写入 → 再生成并编辑题干/答案 → 教师确认 → SQLite 内容和来源 readback → 重启后读回教师修改版。该测试使用隔离模型替身，不代表真实 DeepSeek 质量。
- 完整 Electron 回归本轮首次在讲义导出成功提示处超时，随后从相同构建复跑通过 207/207。记录两次结果，不将提示时序失败归咎于小智路径。
- 用户提供的测试凭证仅写入 Git 忽略的 `apps/desktop/.env.local`；真实 GLM `glm-4.5-air` direct、structured 与三元题组图均在隔离 Electron 实例成功。DeepSeek 与其他 GLM 型号仍需分别验收。没有把测试凭证写入受版本控制的文件。
- 后续用用户提供的 GLM 凭证在隔离数据根验证标准接口：direct/structured Electron 页面真实回复，以及真实三元题组图的草稿、schema/双 grader、待确认项、教师编辑确认、SQLite 与重启读回。首次草稿英文枚举不符被门禁拒绝，另一次 45 秒超时均为失败终态且零写入；已加入一次受控结构修复及 90 秒图模型上限。真实错题按钮上的 GLM 生成尚待验收。
- 已增量接入 `ai_graph_checkpoints` 与 pending writes，LangGraph 三元图使用 SQLite saver。节点状态只保留脱敏有界内容和本地题目 ID，完整学生上下文不进入 checkpoint；节点写入后记录 checkpoint ID 事件。旧形状数据库迁移与启动遗留 running 收敛通过。模型节点中真实 Electron 进程退出后，同 run 恢复已接 typed IPC 和教师会话按钮，拒绝零写及重启回读也有隔离实例证据；完整 G2 故障矩阵仍未通过。
- 待完成：真实供应商断线、图内审批/取消的恢复验收，以及真实 OCR、Windows 打包。检索和模型节点的真实进程退出均已在隔离实例复现并恢复；网络异常的两次重试上限由确定性注入验证，不替代真实供应商故障验收。全 Harness 尚未达到合同完成定义。

## G2 确认写入原子性补充合同

- 目标：教师确认三元题组时，正式题组、来源使用记录和确认项终态同一 SQLite 事务提交；应用在任意中间点退出时必须全部回滚或全部可读，重启后重复确认不得产生第二份。
- 当前缺口：`confirmAiConfirmation` 先调用 `saveExerciseSetFromDraft` 提交正式题组，再单独更新确认项状态，存在崩溃后待确认项重复写入窗口。
- 修改边界：仅调整 `db.ts` 的题组确认决策队列和事务范围；不迁移真实题库数据，不改变教师必须确认的规则。旧数据兼容，无新表或新依赖。报告与 Mastery 确认后续另作专项，不以题组测试外推。
- 验收：并发点击只提交一次；进程在正式插入与状态更新之间退出后 SQLite 零正式写入且确认仍待处理；重启再确认恰一份，既有 Electron 主路径和组件门禁通过。
- 主聊天工作区三栏重做与网络错误呈现记录在 `docs/31_XIAZHI_CHAT_WORKSPACE_REBUILD.md`；只改变教师入口和错误语义，不把视觉重做当作完整 harness 的恢复能力已完成。
