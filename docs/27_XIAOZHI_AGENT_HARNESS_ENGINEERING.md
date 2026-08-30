# 小智 Agent Harness（驾驭工程）

## 1. 目标

本工程不是再堆一段超长 Prompt，而是把小智的一轮执行拆成可版本化、可审计、可回归的控制面：

```text
教师输入
  -> route / subIntent
  -> capability 选择
  -> 最小上下文与工具权限
  -> DeepTutor AgentLoop
  -> HostToolProxy 审核与执行
  -> xiazhi.reply.v2 / 教育质量 / 可用性门禁
  -> SQLite trace 与前端结果
```

当前版本为 `xiazhi.agent-harness.v1`。参考 TRAE Agent 设计档案的分层方法：运行时 Prompt、静态规则、真实 Trace 分开管理；上下文只装配下一步所需信息；工具 schema、权限和失败反馈均由宿主控制。

参考资料：

- https://learn.traeai.com/agent-prompts/
- https://learn.traeai.com/agent-prompts/guides/codex-system-prompt/
- https://learn.traeai.com/agent-prompts/guides/context-engineering/
- https://learn.traeai.com/agent-prompts/guides/tool-permissions/
- https://learn.traeai.com/agent-prompts/guides/coding-agent-comparison/

用户给出的 `/agent-prompkts/` 为拼写错误；正确入口是 `/agent-prompts/`。

## 2. 六层驾驭面

1. 身份与边界：小智服务教师，不自动诊断、贴永久标签或代替教师确认。
2. 协作协议：信息足够时直接执行；只有缺少执行所需事实时才 `ask_user`。
3. 路由与能力：route 表示教师业务意图，capability 表示本轮执行策略，两者必须先匹配。
4. 上下文工程：学生档案、记录、知识库、图谱和题库按 route 最小化读取，原始附件默认不进入模型。
5. 工具与权限：`router.allowedTools` 是硬上限，progressive disclosure 只会缩小工具面；所有工具经 Electron main 的 HostToolProxy。
6. 交付与评测：最终回复必须通过 `xiazhi.reply.v2`、route check、Education Grader 和 Usability Grader，并持久化 trace。

## 3. Route 到 Capability 映射

| route / subIntent | capability | 说明 |
| --- | --- | --- |
| `general_qa`、`workspace_help`、`knowledge_retrieval` | `chat` | 轻量问答与检索 |
| `student_diagnosis`、`error_analysis` | `deep_solve` | 基于学生证据进行诊断或错因分析 |
| `practice_design` | `deep_question` | 题组、练习与变式设计 |
| `lesson_design`、`report_draft` | `deep_research` | 备课、报告与多源整理 |
| `subIntent=visualization` | `visualize` | 可视化产物 |
| `subIntent=research_workspace` | `deep_research` | 教研工作区 |

`CAPABILITY_TO_ROUTES` 与默认选择都集中在 `agent-harness-profile.ts`，HostToolProxy 和控制台必须共用该单一事实来源。

## 4. Console 执行边界

AI 中控台使用 `executionProfile=omni_console`：保留所选 capability 的身份和权限，但统一进入已接通 Omni HostToolProxy、结构化回复与质量门禁的 DeepTutor AgentLoop。直接调用 `deepTutorStartTurn` 且未声明该 profile 时，仍可走 DeepTutor 原生高级 Capability；两者不能混称。

`waiting_input` 是可恢复中间状态。`runDeepTutorConsole` 必须继续等待同一轮经 renderer 输入卡片提交答案后的结果，不能把空 content 当成成功，也不能在等待期间提前结束轮询。

## 5. 运行可靠性

- 仓库根目录从 `OMNI_EDU_REPO_ROOT`、`process.cwd()` 和 `app.getAppPath()` 向上有界探测，必须找到 `python/omni_edu_deeptutor_bridge/__main__.py` 才启动 sidecar。
- Python stderr 只保留 4,000 字符脱敏尾部，仅在 sidecar 异常退出时形成可行动诊断，不发送给模型。
- 旧 SQLite 表的索引必须在列迁移之后创建；不能在 `ALTER TABLE` 前引用新列导致应用无窗口。
- 学生引用解析后的 `CompiledAiContext` 在同一 turn 内持久保存，后续工具可复用已解析 `studentId`。
- 最终空文本、schema 失败、教育质量或可用性门禁失败均把 run 结算为 failed，不展示伪成功。

## 6. 验收门禁

- `npm run test:deeptutor-host-proxy`：route/capability、Prompt 层、工具状态交接和 HostTool round-trip。
- `npm run test:deeptutor-capability-evals`：48 条 capability 预算、隐私与权限 eval。
- `npm run test:ai-harness`：125 条 route/subIntent/工具白名单 eval。
- `npm run test:ai-structured-reply`：最终 JSON 与本地修复边界。
- `npm run test:ai-usability`、`npm run test:ai-observability`：教师可用性与 SQLite 证据。
- `npm run test:ai-live-usability`：使用隔离数据目录验证当前 `runDeepTutorConsole` 真实 provider，不再调用旧 `runDeepSeek`。
- `npm run build` 与主 Electron smoke：证明 preload/main/renderer/SQLite 的产品入口仍可运行。

真实 provider 回放必须报告 route、capability、schema、教育评分、可用性评分和 runId；“HTTP 200”或“构建通过”都不等于功能可用。
