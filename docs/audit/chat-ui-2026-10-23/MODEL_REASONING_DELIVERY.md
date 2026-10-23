# 模型推理输出与原厂组件接入

本片经用户明确批准实施，属于 M10。原先的准备/等待/生成日志不是模型推理，现以独立通道展示模型 API 实际返回的推理内容；执行记录另列。沿用原 HeroUI Pro ChainOfThought 的结构、样式、流式动效和亮色主题，无第三方源码改动。

## 根因与局部修复

| 根因 | 修复 |
|---|---|
| settings 与 session 均固定 thinking off | 改为 low；打开旧 native 历史后通过 SDK 原生设置对齐，记录真实级别变更 |
| 仅转发 text_delta，无模型推理通道 | SDK thinking_delta → main 脱敏桥 → typed event → 独立 modelReasoning 投影 → 原厂 Step |
| 原先以整个 running 状态驱动“思考”动效 | 仅实际推理段 streaming 时启用 isStreaming，正文与工具等待不冒充思考 |
| 执行总用时误作思考用时 | 推理从首 delta 单独计时，各段累加；标题另列整轮执行用时 |
| 需要兼容旧历史和文档正文 | 既有 SQLite assistant metadata 新增 version1 独立字段，校验状态/长度/来源；正文、复制和导出不包含推理 |
| 连续推理 delta 快于脱敏时可能一直合并到结束 | 持续发布已脱敏的有效快照，生命周期采用最新状态，避免晚到片段重启 shimmer |
| 停止先等待确认卡清理，短推理可能先结束；SDK 结束事件也曾误标完成 | 立即中断模型并固定中断片段状态，再结算已有确认卡；后到的普通结束不覆盖中断 |

## 修改入口

- main：`pi-session.ts`、`model-reasoning.ts`、`production-host.ts`。
- shared：`office-agent.ts`、`xiaozhi-agent.ts`、`xiaozhi-projection.ts`、`model-reasoning.ts`。
- renderer：`OfficeAgentTrace.tsx`。原 `OfficeAgentTurn` 正文/工具业务沿用。
- 验证：`model-reasoning-boundaries.mjs`、`model-reasoning-electron.mjs`、既有组件、轨迹、样式、Electron 回归。
- 原厂样式恢复的前后图、规则获胜证据与源文件追踪仍见 `style-audit/DELIVERY.md`；本片最终证据归档在 `model-reasoning/`。

## 实测与边界

最终真实模型实例：`apps/desktop/test-results/model-reasoning-8VaoYC/report.json`，已归档到 [real-electron.json](model-reasoning/real-electron.json)。独立 Temp 数据库与合成教学资料，未访问教师正式库。真实模型为 deepseek-flash，没有切换模型；推理文本可中英混排，原样展示供应商返回内容，不另调模型翻译或伪造后续工具回合推理。

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过（最终源码，含立即停止修复）；main与8个源文件SHA见 [checks.json](model-reasoning/checks.json) |
| `npm run test:model-reasoning` | 13通过：正文隔离、metadata校验、脱敏/失败隐藏、持续刷新、边界、分段与停止 |
| `npm run test:renderer-components` | 217组件 + 6原厂样式保护通过 |
| `npm run test:agent-trace` | 19通过 |
| `npm run test:model-reasoning-electron` | 最终独立实例17通过、0 pageerror/console error；包含真实推理流、动效、正文、折叠、复制/实际Markdown导出、原厂样式状态、SQLite及两次重启、实际附件工具连续回合、停止、受控网络失败 |
| `node scripts/electron-smoke.mjs` | 最终构建207/207通过，ok=true；为确定性兼容验证，不冒充真实供应商，见 [smoke.json](model-reasoning/smoke.json) |
| `npm audit --json` | 现有15项：critical1/high7/moderate2/low5；未新增依赖/改锁文件，本轮不强制升级 |
| `git diff --check` | 通过 |

运行位置为当前工作树 `apps/desktop`；真实测试使用 `$env:XIAOZHI_AUDIT_ENV='D:\WorkProject\EduProject\apps\desktop\.env.local'` 指向已授权的既有本地配置，只读取、不修改、不输出凭证。没有用 worktree 下不存在的 .env 代替真实配置。

最终普通问题1段模型推理；真实附件工具场景2段推理、2次工具操作。三段展示文本的SHA与原生SDK实际thinking块逐段一致。停止实例保存116字符未完成推理，并保持interrupted读回。故障用一次受控Electron net.fetch拒绝，不是供应商事故；finally恢复，最终启动实例无拦截器。

## 前后截图与CSSOM证据

之前：[阶段日志被误称思考](style-audit/final-light-1366-public-stages.png)。之后：

- [真实推理流](model-reasoning/streaming-reasoning.png)、[正文流式](model-reasoning/streaming-answer.png)、[完成自动折叠](model-reasoning/completed-collapsed.png)。
- [1366展开](model-reasoning/after-light-1366-completed-expanded.png)、[1920展开](model-reasoning/after-light-1920-completed-expanded.png)。
- [工具回合推理](model-reasoning/tool-reasoning-expanded.png)、[停止保留片段](model-reasoning/stopped-reasoning.png)、[失败不伪造推理](model-reasoning/failed-no-reasoning.png)。
- [1366 CSSOM](model-reasoning/cssom-light-1366.json)、[1920 CSSOM](model-reasoning/cssom-light-1920.json)：保留computed、获胜selector、来源文件/行候选、层级树与原厂样式对照。实际鼠标Hover/Active、键盘Focus、展开/收起均验证；按用户指定仅亮色。

## 历史诊断与剩余事项

旧实例分别揭示测试配置路径缺失、Windows剪贴板CRLF差异、过窄的Streaming采样窗口、错误要求每个工具回合均有推理、以及真实的停止/刷新缺陷。前四项修正测试或核实供应商实际输出；后两项修复应用边界。旧失败报告保留在test-results，不用改写旧报告冒充通过。最终17项来自全新独立实例，没有拼接旧实例通过数。

长历史输入/DOM性能问题、整体聊天“高级感”、既有依赖告警和教师对真实教学质量的人工验收仍待后续。当前窗口已启动到当前工作树最终构建，展示真实推理历史；使用隔离教学测试库，未切换教师正式库。

不宣称获取模型未公开内部状态，不宣称模型计算设备的纯推理耗时。长历史性能与整体聊天视觉重构继续独立处理。
