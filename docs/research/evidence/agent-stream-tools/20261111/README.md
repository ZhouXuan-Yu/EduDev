# 小智实时过程与工具修复验收

2026-11-11。对应任务书为 `docs/goal/AGENT_STREAM_TOOLS_REPAIR.md`。代码在独立分支 `codex/agent-stream-tools-20261111` 实现，保留另一线程的 UI 工作。R1、R2、R3 专项已通过，最终集成检查进行中。

## 查明的问题与处理

| 问题 | 原因与修改 | 结果 |
| --- | --- | --- |
| 运行中一直显示处理中 | 主进程已经发出 thinking_delta/model_reasoning，OfficeAgentTurn 构造过程视图时丢弃 modelReasoning，时间线也没有推理条目 | 接回已脱敏的 provider 返回片段，与说明、工具按捕获顺序展示，已实现 |
| 过程展开后再次收起 | 正文交接与用户展开需要独立处理 | 正文首次交接折叠，用户重开后后续正文保持展开，已实现 |
| 工具参数错误难以修正 | 边界只返回 invalid_input 通用说明 | 返回 SDK 字段校验诊断并去掉完整参数回显，已实现 |
| 配置或资料条件错误显示 unknown | 部分领域错误码没有映射，返回式错误与抛出式错误的路径也有差别 | 补充来源、配置、未确认、缺依赖等分类，覆盖两种返回方式，已实现 |
| 普通任务携带庞大工具参数 | Office 多层 schema 固定加载，BM25 泛词匹配也会带入复杂交付工具 | 普通问题使用目录按需加载，文件意图预载完整交付路径，已实现 |
| 很长的工具时间难以判断原因 | 执行墙钟包含教师确认等待 | 保留 executionMs，同时单列 teacherWaitMs 与原 queueWaitMs，已实现 |
| 模型不能操作终端 | 会话关闭 SDK 内置工具，生产 customTools 未注册真实终端 | 注册 exec_command，复用已锁定 Pi SDK 执行器，已实现 |
| 终端停止显示为失败 | SDK 取消会替换工具 details | 使用主进程停止原因生成 tool_end.terminalState，已实现 |

## 同工况请求负担

原 Composer 发送同一合成浮力任务，经原 Pi 到本地 SSE。历史 report 字段 `toolSchemaBytes` 使用 `JSON.stringify(...).length`，此处单位统一为字符数。每个阶段均保存原报告。

| 指标 | 修复前 | R2 | R3 含终端 |
| --- | ---: | ---: | ---: |
| 首轮工具 schema 字符数 | 51621 | 37844 | 16534 |
| 首轮完整请求字符数 | 62377 | 48600 | 27290 |
| 首轮工具数量 | 21 | 17 | 16 |

最终 schema 减少 67.97%，完整请求减少 56.25%。终端 schema 已包含在最终结果内。真实云端首 token、教学回答质量、网络搜索与下载耗时仍待真实模型评测。本轮新增付费请求为 0。

## 逐项验收

| 编号 | 操作与达标条件 | 当前结果 |
| --- | --- | --- |
| R1-01 | 原输入框发送，provider 响应保持打开，至少两次推理文字更新可见 | 已实现 |
| R1-02 | 推理、公开说明、原目录工具、第二段推理按捕获顺序展示 | 已实现 |
| R1-03 | 目录工具当前已暴露，真实 toolAttempt 为 succeeded | 已实现 |
| R1-04 | 可信正文开始后折叠，手动展开后追加正文保持展开 | 已实现 |
| R1-05 | 停止保留已有推理及未完成状态 | 已实现 |
| R1-06 | 1366×768 与 1920×1080 可见，冷启原历史保留同一片段 | 已实现 |
| R2-01 | 缺字段、额外字段、类型/长度错误在执行前失败，反馈指出字段 | 已实现 |
| R2-02 | 来源缺失、来源改变、配置、未确认、缺依赖可分类恢复 | 已实现 |
| R2-03 | 等待教师暂停执行期限，取消等待有效，teacherWaitMs 在墙钟范围内 | 已实现 |
| R2-04 | 普通问题减少 schema，文件任务预载保存/检查/交付工具，目录发现仍有效 | 已实现 |
| R2-05 | 同 call 去重、变参冲突、资源锁、只读有界重试、写操作取消与旧 run 围栏保持 | 已实现 |
| R3-01 | 原聊天暴露 exec_command，调用实际 PowerShell 并返回 42 | 已实现 |
| R3-02 | 实际创建 UTF-8 文件，工具读回、测试进程文件读回一致 | 已实现 |
| R3-03 | 命令仍执行时可展开卡片，查看 LIVE-TERMINAL 实时输出 | 已实现 |
| R3-04 | 非零退出保留 stderr、真实退出码与 execution_failed | 已实现 |
| R3-05 | 超长输出有 32768 字符上限、截断标记和尾部 | 已实现 |
| R3-06 | workdir 使用现有会话子目录，解析后越界在启动前拒绝 | 已实现 |
| R3-07 | 实际继承环境排除 provider 密钥及私有会话变量，输出先脱敏 | 已实现 |
| R3-08 | timeout 停止实际进程，执行注册表回到空闲 | 已实现 |
| R3-09 | 原停止按钮结束真实 Node 子进程，延迟写入未发生，部分输出保留为已停止 | 已实现 |
| R3-10 | 终端辅助执行无需伪造 Office 计划，当前任务/来源失效仍拒绝 | 已实现 |
| R3-11 | 两尺寸终端输出/状态可达，冷启原历史保留终端快照，provider 请求数为零 | 已实现 |

## 测试命令与证据

均在独立工作树的 `apps/desktop` 执行，安装其自己的锁文件依赖。

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build` | PASS，TypeScript 与生产构建 | [最终构建](final-build.log.gz) |
| `npm run test:renderer-components` | 246/246 PASS | [最终组件日志](final-components.log.gz) |
| `node scripts/xiaozhi-agent/model-reasoning-boundaries.mjs` | 19 PASS | [推理边界](r1-boundaries.log.gz) |
| `node scripts/xiaozhi-agent/pi-tool-execution-boundaries.mjs` | 21 PASS | [执行边界](r3-execution.log.gz) |
| `node scripts/xiaozhi-agent/answer-quality-boundaries.mjs` | 12 PASS | [质量与目录边界](r3-quality.log.gz) |
| `node scripts/xiaozhi-agent/pi-task-plan-boundaries.mjs` | 20 PASS | [任务准入](r3-task-plan.log.gz) |
| `node scripts/xiaozhi-agent/terminal-boundaries.mjs` | 8 PASS，真实 shell/文件/子进程 | [终端报告](r3-terminal.json.gz) |
| `node scripts/xiaozhi-agent/agent-stream-tools-electron.mjs` | 7 PASS，原 Composer/Pi/journal、实时终端与冷启 | [最终聊天报告](final-electron.json.gz) |
| `node scripts/electron-smoke.mjs` | 207/207 PASS，隔离 legacy 回归，Pi=0 | [综合回归](legacy-smoke.log.gz) |

最终主进程 SHA-256 为 `b8a1864b22c849993361149e1d979b8ab57df48863178d8c912399fcd16bfb13`，最终7项聊天及246组件基于最终构建。207综合回归的构建为 `36dc3746615bf3bd1dd42153dbdbc5307bf57e6f9d54c289e4c51b4772c2fa32`，其后仅修正领域返回错误码映射和终端隐私提示。初次旧推理契约失败、PowerShell 夹具转义错误、首次 TypeScript 类型错误及终端停止状态失败均保留在本目录。R1 的目录调用断言曾只检查工具行，R2 改为当前已暴露的 office_list_files 并断言实际成功。修正前报告继续留存。

终端双尺寸截图与实时推理截图均已保存。 [1366终端](terminal-1366.png) [1920终端](terminal-1920.png) [1366推理](reasoning-1366.png) [1920推理](reasoning-1920.png)

## 与 Hana、DSH 的源码对照

| 机制 | 竞品源码 | 本轮处理与边界 |
| --- | --- | --- |
| 思考流式累积 | Hana 的 use-stream-buffer 对 thinking_delta 更新缓冲，测试覆盖 thinking_end 前刷新 | 接回现有主进程片段与时间线，流未结束时真实 DOM 可读 |
| 工具按需加载 | Hana catalog 分离目录摘要和完整 schema | 继续复用已引入的 Hana catalog，修正本项目固定加载和泛词带入 |
| 持久终端 | Hana exec_command/write_stdin 与 terminal-session-manager 使用 PTY，会话可继续输入 | 当前使用已锁 Pi SDK 前台独立 PowerShell，持久 PTY/write_stdin 后续补齐 |
| Shell 作业管理 | DSH PowerShell 工具含 timeout/workdir，支持后台作业与终端状态 | 当前有实际超时、退出码、输出、进程树取消，后台作业管理后续补齐 |
| 流式恢复 | DSH assistant stream 累积块、修订和持久游标 | 沿用本项目原 SQLite journal、捕获顺序与冷启投影，实际冷启无工具重放 |
| 执行收束 | DSH executor 有作用域、并发调度和已启动工作收束 | 沿用原执行边界、资源锁与 registry，增加实际终端子进程取消验收 |

Hana 固定为 `9a6cabf8c513db5edc6cf8179a538c9075885c6e`，Apache-2.0，本地完整源码已索引。DSH 固定为 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`，MIT，其部分克隆 checkout 遇到 TLS 失败，相关官方原始源码已直接读取。流式机制见 Hana hook 及测试。 [Hana 流式源码](https://github.com/liliMozi/openhanako/blob/9a6cabf8c513db5edc6cf8179a538c9075885c6e/desktop/src/react/hooks/use-stream-buffer.ts) [Hana 流式测试](https://github.com/liliMozi/openhanako/blob/9a6cabf8c513db5edc6cf8179a538c9075885c6e/desktop/src/react/__tests__/hooks/use-stream-buffer.test.ts)

终端结构与后台能力对照来自以下实现。 [Hana 终端工具](https://github.com/liliMozi/openhanako/blob/9a6cabf8c513db5edc6cf8179a538c9075885c6e/lib/exec-command/tool.ts) [Hana PTY 管理](https://github.com/liliMozi/openhanako/blob/9a6cabf8c513db5edc6cf8179a538c9075885c6e/lib/terminal/terminal-session-manager.ts) [DSH PowerShell](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/shell/tool-pwsh/src/index.ts)

DSH 的流与调度对照来自其原始实现。 [DSH assistant stream](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/api/session-controller/src/assistant-stream.ts) [DSH executor](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/tools/src/executor.ts)

## 实现范围与后续

终端执行器来自现有 `@earendil-works/pi-coding-agent@1.0.2`，MIT。无新增生产依赖、SQLite 表或 IPC。命令使用本机账号权限，每次 shell 独立，workdir 参数解析为当前会话目录或其子目录。正式教学文件保留原保存、读回与教师确认流程。

本轮验证的是 Windows 前台执行与流式呈现。最终 npm audit 返回既有28条依赖告警，critical为0，未新增生产依赖，原报告见 audit.json.gz。持久 PTY、write_stdin、后台作业管理、Linux Bash、真实模型自主安装依赖及自然教学质量继续列为待验证/后续能力。历史较慢科普图调用的墙钟包含确认等阶段，端到端模型/网络耗时需要独立实测。

## 修改位置与回退

R1 修改 OfficeAgentTurn、AgentTraceTimeline、agent-trace-timeline、AgentTraceHeader，接回原过程数据。R2 修改 education-tool-catalog、execution-bound、xiaozhi-tool-attempt 与工具等待展示。R3 新增 tools/terminal、xiaozhi-terminal 契约，接入 pi-session、manifest、原任务准入、journal/projection 与 AgentPublicTool。

按模块正常 `git revert` 对应功能提交可回退。R1 为 `a2a91c7`，R2 为 `a188feb`，R3 提交待记录。终端快照使用可选字段，原用户资料和产物数据结构保持兼容。

## 最终集成

待最终构建、综合 smoke、远端一致性和 D 盘日常入口确认后记录。
