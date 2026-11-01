# U4 整卷任务准入与定向补验

状态：**原六类导出及前 29 项检查限定接受，附加 PiPaperReview 原失败保留；F 领域准入源码已冻结，F 报告 12 项通过、TSC exit 0，父任务12项独立复跑结果待补；D1rEGGdx真实补验oNlwq9已4/4、父任务报告exit 0，本例PiReview准入/确认/读回缺口关闭**。本文不将原整轮标为成功，不授权放宽守卫。

## 原始运行与已通过范围

- 原报告：[ui-goal-paper-9G2OGc/ui-goal-report.json](../../../apps/desktop/test-results/ui-goal-paper-9G2OGc/ui-goal-report.json)，使用 `85eae35`；`success:false`，父任务确认 exit 1，29/29 已记录 checks 通过，renderer/console errors 均 0。
- 学生卷、教师卷及答题卡各 DOCX/PDF，共六类真实交付。原报告 `fileReadback.success:true`（4 文件）、`answerSheetReadback.success:true`（2 文件）；包含 Word XML/PDF 文本、A4、题目完整性及学生卷答案隔离 readback，不是仅点击下载。
- 三模式配额/无已确认题组拒绝、脏稿恢复、来源失效、审批拒绝、停止、冷启动、旧卷在新确认后禁导出等先行检查已通过；题库事实及已有文件保持不变。
- 失败发生在这些检查之后的**附加聊天 PiPaperReview 入口**，runner 第 155 行等待 pending review 超时 180 秒。不能据该失败否定已有六类交付证据，也不能因前项通过而把整轮改称成功。
- 原报告 SHA-256：`60896baa6de3b4248b0a3bc5e00d9a25a9349b0582612c1f3ed6a8db2e0dff32`。保留原文件；补验另存目录。

## 只读根因证据

最后 command `xicmd_fb2e129f-52bb-4b5f-9e6c-25afdfb2e3cf` 已正常准入、Enter 仅一次、输入已清空；绑定 run `run_71709b78-51d0-4068-ae98-bf3686f7748f`，会话 `aisession_7a4a1a6c-ad0d-4614-bef7-33b9be2322b2`。

- 数据库命令终态 `finished`、agent run `succeeded`、事件 run `completed`；模型为 `deepseek-flash`。模型请求元数据记录 12 次 accepted/HTTP 200，不能以此证明业务完成，但不支持“发送未准入或 provider 网络超时”的解释。
- `education_propose_paper` 三次 receipt 均 `admitted:0`、`success:0`，公开工具错误依次为 `task_tool_scope`、`task_plan_required`、`task_tool_scope`；错误码均 `task_blocked`、`effect:none`、`delivery:not_delivered`。
- 原失败运行未创建任何 `pi_paper_candidate`；原两份已确认卷仍在。因此不存在“候选已生成但标题 selector 不匹配”的证据。
- 冻结源码 `git show 85eae35:apps/desktop/src/main/xiaozhi-agent/tasks/task-evidence.ts` 第 7 行 `taskToolKinds` 未包含 `education_propose_paper`，这是**旧通用任务合同没有覆盖整卷候选/确认领域的表现，不是简单漏加一个保存题目工具**。模型登记 `saved_questions`，但整卷快照不向题库增加新题，题库读回不能证明整卷确认；改成 `saved_office` 同样不能代表整卷，也不授予文件交付权。旧 [resources.ts](../../../apps/desktop/src/main/xiaozhi-agent/tasks/resources.ts) 的 invocation 范围校验及 [plan-runtime.ts](../../../apps/desktop/src/main/xiaozhi-agent/tasks/plan-runtime.ts) 的无匹配步骤处理产生上述拒绝。当前链接用于定位，原运行结论以 `85eae35` 冻结源码为准。
- runner 仅等待本 run、指定标题的 pending review，没有在 run 已结束时及时退出，故工具实际未派发后仍等满 180 秒。

检查只提取状态、receipt 与公开工具错误，没有保存 native reasoning/private 原文。

## F/A 修复合同与当前源码状态

只读核对当前 [paper-admission.ts](../../../apps/desktop/src/main/education/paper-admission.ts)、[paper-coordinator.ts](../../../apps/desktop/src/main/education/paper-coordinator.ts) 与 [production-host.ts](../../../apps/desktop/src/main/xiaozhi-agent/production-host.ts)，修复采用 **typed `paper_review` 领域准入**，没有将工具塞入 `saved_questions` 后制造假 checkpoint：

1. host 只为 `PAPER_TOOLS[0]` 选择该领域路径，先刷新真实教师任务，再调用 `admitProposal`；其他工具继续原有准入，之后仍须写入原 journal 的 `admitTool`，不是直接跳过宿主或 SDK 边界。
2. 只读 gate 校验 blueprint，并绑定 `sessionId/runId/commandId/generation/callId/taskId/requirementsVersion`。完整 SQL 联查未归档会话、当前 running run/command/event、学生归属/有效状态、同代 planned 且未准入的准确工具 receipt、同 run 的真实教师 user message；唯一匹配才可继续。任务版本或 source/owner 变化、取消均失败关闭。
3. 权限依据是**当前真实教师请求**，不是模型 plan 的文字。先检查完整请求中的禁止创建指令，再保守识别明确组卷要求；信息查询/仅解释/仅阅读不能创建。继续请求只能沿已绑定的原教师来源，教师 correction 的全部 criteria 合并校验，后续分号/换行中的禁止项不能被前一句正向要求掩盖。
4. gate 只返回与绑定及 blueprint 关联的稳定 `paper_review` 身份，不创建/确认卷、不产生 `saved_questions` 读回证明。原 paper transaction 仍选择真实来源、校验配额/版本、创建 pending review，并等待教师独立确认或拒绝；停止、来源失效、不足配额继续沿原守卫处理。`education_read_paper` 是实际整卷读回，不能替代教师确认，也不宣称已导出或答案正确。

F 已报告源码冻结、[paper-host-admission.mjs](../../../apps/desktop/scripts/education/paper-host-admission.mjs) **12 项通过及 TSC exit 0**。源码测试含真实当前请求完整查询负例、教师后续 correction 禁止项、跨 owner/receipt、撤回/取消、待核与拒绝/来源失效、原 generic 写入守卫及不铸造题库 checkpoint；采用合成领域数据，没有模型/Electron。父任务正在安排/复跑这 12 项，结果与最终源码 SHA 待补；本 docs worker 未重复运行。**源码合同本身不等于真实验收；现已另有oNlwq9真实4项通过证据，范围见下文。**

## 附加入口定向补验（已完成，不重复运行）

已准备 [ui-goal-paper-review-followup.mjs](../../../apps/desktop/scripts/ui-goal-paper-review-followup.mjs)，父任务已在含17ac typed admission的D1rEGGdx构建串行运行，结果为oNlwq9。不重建、不重跑六类导出，不自动重试发送。

安全预检（不启动 Electron、不调用模型、不读取 `.env.local`）：

```powershell
cd D:\WorkProject\EduProject-sidebar\apps\desktop
node scripts/ui-goal-paper-review-followup.mjs --check
```

父任务已执行的显式付费运行命令（历史记录，不是新重跑要求）：

```powershell
# DEEPSEEK_API_KEY 由父进程显式继承；不要把密钥写入命令参数或报告。
$env:OMNI_EDU_TEST_EXPECTED_MAIN_SHA256='<修复后新构建的main SHA-256>'
node scripts/ui-goal-paper-review-followup.mjs --run-paid
```

- 原数据/profile/会话复用；读取原确认卷蓝图，逐字校验请求与原 `ai_agent_runs.prompt` 一致。请求 SHA-256：`eb3b73c0a3da474864f93bb2cd61ed8bb2603cf396201d1a43e2287ad1f7a4e7`。
- 显式校验新 main 哈希且拒绝原失败构建；一次 Enter 对应一个新 command/run。无 pending review 且 run 已结束时及时失败，记录公开准入元数据。
- 实际打开原 PiPaperReview modal，逐项展开全部 20 题，独立点击教师确认，再验证模型实际成功调用 `education_read_paper`。截图为 1366×768、1920×1080 视口中的公开核对 modal，不截取私有推理详情。
- 验证原题库事实、旧确认记录和文档产物不变；六个既有文件逐字节哈希不变、工作目录零新增产物；仅允许该新 run 的整卷确认记录。
- 总时限 300 秒，结果另存 `ui-goal-paper-9G2OGc/pi-review-followup-*/report.json`。实际运行oNlwq9已完成，4/4通过、父任务报告exit 0；原失败报告保持不变。

准备阶段语法检查 exit 0；父任务 `--check` exit 0，确认原请求一致、20题和六文件可复用；父任务也已复跑隐私 DTO 4 项通过。报告仅保留固定元数据，不输出私有 items/text/reasoning/payload/raw error。以上为准备证据，实际补验通过另见下节；不再将本例记为尚待真实运行，也不重跑已接受的六类导出。

## 实际补验结果与限定关闭

已读取[pi-review-followup-oNlwq9/report.json](../../../apps/desktop/test-results/ui-goal-paper-9G2OGc/pi-review-followup-oNlwq9/report.json)：`success:true`，4/4 checks通过，父任务报告exit 0，`humanAccepted:false`。同原请求SHA、同20题；一次Enter对应一个新command/run，真实PiPaperReview展示全部20题并在教师操作前保持pending，独立教师确认持久化后模型实际调用 `education_read_paper`，receipt为admitted/success各1。原题库事实、旧确认及六文件未变，无导出重放。

父任务标识构建 `D1rEGGdx`，含 `17ac` typed admission；报告build SHA-256 `9883db25f0ce47e44bdd01c1cd7ec487fd9091c7596dd7e9f14a46591d41c4e1`，main SHA-256 `f4fe3439fb11c0311ce4283f3bc07cd6534424300c8eeda3e4a46393a56eb899`，`buildUnchanged:true`。此补验明确为集成前证据，不因后续bf167或63e3acf0合入而升级整包/backend标签。最新合入142文件及工程/运行状态仅见[验证汇总](FINAL_VALIDATION.md)，不在本领域记录重复交接历史。


**本例实际PiReview准入、独立确认及模型读回缺口关闭。** `originalSuccess:false`、`originalReportUnchanged:true`，原29项报告SHA仍为 `60896baa6de3b4248b0a3bc5e00d9a25a9349b0582612c1f3ed6a8db2e0dff32`；原整轮exit 1保留。不是全量U4、全部准入负例、答案科学质量或教师接受，也不构成UI Goal/main交付完成。
