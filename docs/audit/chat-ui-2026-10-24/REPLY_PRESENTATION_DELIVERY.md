# 小智过程与正文专项交付（2026-10-24）

本轮按批准方案完成局部实现。教师最终体验验收仍待试用；不据此宣布 Master 或整套 UI 重构完成。原实施前证据保存在同目录 REPLY_HARNESS_GAP_AUDIT.md、event-phase-reproduction.json 和 cold-*.png，未覆盖。

## 根因与修复

|根因|本轮修复|
|---|---|
|按最后一个数组项猜正文，工具开始后文字搬家|独立 presentation-event-adapter 解析模型明确给出的段首阶段标记，先发布 typed assistant_phase，再发真实 text_delta。未知 phase 保持过程归属，SDK stop 才确认最终正文|
|只在宿主 completed 后分别收起小块|整轮共用一个官方 ChainOfThought 披露；答案阶段前收起，终态再次封存，手动回看保留|
|全部 reasoning 先排完，再排 tools|在 SDK 原始事件到达时保留单调 traceOrder，异步脱敏后的 reasoning 仍按原顺序与公开说明、工具混排|
|每次增量直接刷新整页；应用关闭官方动画|独立 33ms 流式缓冲，生命周期/工具/审批边界立即排空；移除 animated=false，恢复官方 Markdown 默认动画|
|顶部/底部计时混杂，运行时旧 SDK 快照可冻结时钟|标题单独显示过程墙钟，交接后冻结；删除 Pi 正文下方计时，包含工具和等待，未伪称纯模型推理时间|
|官方停止图标工具类未编译|局部编译原厂 size-3/bg-current/rounded-xs/size-4，范围只到 native PromptInput；没有改 vendor、token 或全局 important|
|模型在正文末尾补了协议闭合标签|适配器跨 chunk 吸收可选尾标签与分隔空白；代码中的字面量保留。UI、复制、保存不含协议标记|

展示协议只用于公开 text 的阶段分隔；真实 reasoning 内容来自 provider 原生字段，不改写成伪造推理、不另起执行循环、不另调模型分类。当前 DeepSeek 缺少首个正文 token 前的原生 final phase，因此不能对不遵守协议的其它 provider 承诺同等早交接；兼容路径已单测。

## 模块与修改文件

- `main/xiaozhi-agent/presentation-event-adapter.ts`：段首/可选尾标记解析、流式交接、展示顺序；pi-session.ts 仅接入，production-host.ts 仅透传与已有 metadata 读写。
- `shared/chat-presentation.ts`、`chat-presentation-reducer.ts`：版本化可选呈现元数据与纯投影；现有 office-agent/model-reasoning/xiaozhi-agent/xiaozhi-projection 契约同步。不新增 IPC 通道或 SQLite 表。
- `renderer/components/office/AgentTraceStreamingDemo.tsx`：官方组合入口；Header、Timeline、useAgentTraceState 与 agent-trace-timeline 各管一项职责。
- `OfficeAgentAnswer.tsx`、`OfficeAgentTurn.tsx`：稳定正文与视图组合；`chat-stream-buffer.ts`、`chat-snapshot-reducer.ts` 从 PiEducationWorkspace 抽取订阅投影。没有继续向两个大入口堆实现。
- `OfficeReplySources.tsx`：保留实际来源，普通无来源问答不强加固定核对脚注。
- `prompt-input.utilities.css` 与原轨迹 utilities、生成器、css-native-boundary.ts：缺失工具类局部编译和隔离门禁。原 HeroUI OSS/Pro 源码与样式未修改。

全部保持亮色。教师问题、审批与结果核对卡仍位于过程折叠区外；真实权限、来源与保存回执未绕过。新字段可选，旧 metadata 不迁移；旧记录未保存的精确事件顺序不能凭空补出。

## 运行与验证

工作树：`C:\Users\ZhouXuan\.codex\worktrees\1c54\EduProject`。构建入口 `apps/desktop/out/main/index.js`，最终构建指纹见 reply-presentation/build-manifest.json；日常 D: 旧 checkout 未同步，不冒充已更新。

|命令 / 证据|结果|
|---|---|
|`npm run build`|通过，最终 renderer index-C8w3Yfdj.js；已有打包告警保留，未加依赖|
|`npm run test:renderer-components`|217/217 组件状态＋8/8 样式隔离|
|`npm run test:agent-trace`|19/19|
|`npm run test:model-reasoning`|16/16|
|`npm run test:reply-presentation`|16/16，包括跨片标记、未知 phase、异步顺序、缓冲排空、旧快照覆盖防护、真实时钟推进/冻结|
|`node scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs`|8/8 原 Pi SDK/真实宿主工具协议边界；状态夹具改到 Temp 以遵守 .codex 禁止作为私有 stateRoot 的既有规则|
|真实 DeepSeek＋正式 Electron|29 项通过，0 未捕获 console/page 错误；普通问答、多工具、教师提问、停止、受控 transport 失败、复制、教师确认保存、SQLite 与重启|
|旧数据冷启动双尺寸|同一隔离旧会话从 4 推理＋6 执行标题变为 1 标题；0 控制台错误，额外 composer activity 为 0|
|`node scripts/electron-smoke.mjs`|最终构建串行 207/207 通过（legacy-final-solo.log）；中途一次 pending/cancelled 失败另存 legacy-intermediate-failure.log，不无证据归因|
|`git diff --check`|通过|
|`npm audit --json`|20 项：critical 1 / high 9 / moderate 5 / low 5；本轮未改依赖，不自动扩大为依赖升级|

真实专项使用同一构建的普通问答流式基线续跑，避免反复请求模型；原始 ordinary-stream-baseline.json 保留其后 Active 采样未通过的事实，最终 report.json 重新通过官方双尺寸状态与后续真实流程。CSSOM 采样改为并行读取状态/样式，再做来源匹配，避免先分析大量 CSS 导致 pressed 状态已结束才采样；没有用伪造 pressed 或强制 CSS 状态冒充实际按下。

最后仅修正标题时钟优先级；29 项 provider 专项没有假称在该时钟改动后全量重跑。最终构建另通过 16 项专项、旧数据冷 Electron，以及试用窗口的 cold presentation metadata readback。顶层文档和后续试用记录以真实结果为准。

## 性能与边界

- 普通问答：正文运行中 33 次不同长度，阶段标记至首个正文 DOM 帧 58.7ms，首个正文 IPC 至 DOM 帧 44.9ms；全部正文帧的整轮过程均为收起。
- 多工具结果：正文运行中 3 次不同长度，阶段标记至首个正文 DOM 帧 49.4ms，首个正文 IPC 至 DOM 帧 49.3ms；全部正文帧的整轮过程均为收起。
- 自然问答：正文运行中 18 次不同长度，阶段标记至首个正文 DOM 帧 52.0ms，首个正文 IPC 至 DOM 帧 51.9ms；全部正文帧的整轮过程均为收起。

上述是 rAF/DOM 采样，不虚报 FPS 或像素级可读首字时间。接收前本地准备仍明显偏慢：本轮普通问答约 10.9s，工具会话约 16.2s；provider 首 reasoning 另约 1.3s / 3.7s。当前证据定位在 preparing→waiting_model 区间，尚未完成子阶段优化；没有用假思考掩盖它。历史 profile 的文件校验热点不冒充本次唯一根因。

普通问答允许自然段，任务需要步骤/教案/练习时保留合理结构；不把“列表数必须为零”当作所有问题的质量标准。

## 前后截图与自查

- 同一旧会话：[修复前 1366](cold-1366.png) → [修复后 1366](reply-presentation/after-cold-1366.png)；1920 同组证据同目录。
- [真实推理流式与停止图标](reply-presentation/streaming-reasoning.png)、[正文流式时过程已收起](reply-presentation/streaming-answer.png)。
- [真实工具与推理顺序](reply-presentation/tool-records-expanded.png)、[教师问题不被折叠隐藏](reply-presentation/waiting-teacher-outside-trace.png)。
- [停止后保留未完成推理](reply-presentation/stopped-reasoning.png)、[失败不伪造推理](reply-presentation/failed-no-reasoning.png)。
- 官方 Hover/Focus/Active、完成展开/收起的两种尺寸截图与 computed style、获胜选择器、CSS 来源候选和层级记录，见 after-light-*-matrix.json。仅输出本轮验证过的亮色。

截图自查已追加修复：停止按钮空圆、协议尾标签泄漏、段首空白与导出差异、标题时钟被旧快照覆盖。过程/正文交接达到本轮技术断言；整体聊天高级感与长历史性能未据此宣称完成，教师最终视觉认可仍待试用。

## Git 与未解决事项

用户已授权每轮直接提交/推送 main，并再次明确要求删除遗留空锁。实际 git add 仍被 `D:\WorkProject\EduProject\.git\worktrees\EduProject\index.lock` 阻止；按用户指令再次执行核对后删除的命令，仍被自动审批 `blocked by policy` 拒绝。未换用其它方法绕过拒绝，未假称提交或推送成功；本地和远端 main 均仍为 b5a7fc6。源码、证据与报告均留在当前工作树。

剩余：本地准备延迟；未知 phase provider 的早交接能力；无顺序字段的旧记录精度；已有依赖告警；Git 锁解除与 main 交付；教师实际体验接受。对话整体美化另按既定范围继续，不直接改第三方设计。

最终既有回归完成：最新构建串行 207/207 通过。此前并行/不同采样时点的失败记录保留，未修改取消检查点业务来迁就测试。

最终试用窗口已启动：**小智 · 回复链路修复 · 本轮试用（1c54）**，PID 212368，工作目录为本轮1c54/apps/desktop，使用独立验收数据。trial.json确认最终main构建SHA、cold presentation metadata与正文原样读回、0 page errors；未自动发送模型请求。

最终效果：[1366×768](reply-presentation/final-natural-1366.png) / [1920×1080](reply-presentation/final-natural-1920.png)。两个尺寸均已实看：一个上方过程入口，完整自然段正文在其下，底部无重复耗时或无来源通用脚注；1366按正常滚动继续阅读，未压缩字体或改vendor设计。
