# Phase8 流式性能采集准备交付

状态 **FROZEN_SINGLE_A_SAMPLE**，2026-11-17。最终有效A采集的4项采集断言完成，exit0；metrics合同测试3/3，exit0。真实provider、教师体验和最终产品性能继续待验收。本轮真实模型请求0。

## 冻结对象与命令

仅新增6个 `apps/desktop/scripts/xiaozhi-agent/phase8-stream-performance-*` 文件，分别为contract、metrics check、fixture、metrics、renderer probe及smoke。SHA256与原件快照见 `freeze.json` 和 `source-snapshot/`。预算5模块、生产/Phase5及其他Goal文件保持原状。

```powershell
cd D:/WorkProject/EduProject-harness/apps/desktop
node scripts/xiaozhi-agent/phase8-stream-performance-check.mjs
node scripts/xiaozhi-agent/phase8-stream-performance-smoke.mjs --desktop-root C:/Users/ZhouXuan/.codex/worktrees/harness-baseline-20261117/EduProject/apps/desktop --label A --expected-out-hash 9339199da66260513af57250be680c31b507d0f6549e4e5d4f545f13648734f2 --expected-out-count 458
```

第二条命令的当前有效结果为 `%TEMP%/xiaozhi-phase8-stream-performance-WNArgl/report.json`，本目录副本为 `baseline-report.json`。新空SQLite/profile均在该owned TEMP根，Electron与Playwright依赖均来自传入desktop root。正式B侧可沿相同脚本指定其desktop root、label和已冻结out hash/count。

A侧实际458个out在操作前后SHA均为 `9339199da66260513af57250be680c31b507d0f6549e4e5d4f545f13648734f2`，清单为 `baseline-out-before.json`。5个mjs逐项node --check与定向git diff --check均exit0。

## 实际入口与隔离

使用真实原built main/preload、Pi与可见工作台输入，启动 `--force-device-scale-factor=1`。主窗口bounds及contentBounds均为x600/y314/width1366/height768，实际renderer innerWidth1366、innerHeight768、devicePixelRatio1。截图尺寸来自本次实际instance。原assertIsolatedPiMain验证其profile/sessionData和真实main模块库存。

启动前用假key覆盖环境并去除继承凭据与代理配置。测试bootstrap仅将固定 `https://api.deepseek.com/v1/models` 和 `/v1/chat/completions` 的electron.net.fetch重定向至自有127.0.0.1服务，其他net.fetch拒绝。聊天fixture真实HTTP1次，Authorization的合成值校验通过，blocked0、隐藏重试0。模型目录亦为loopback合成响应，原模型网络/权限实现未修改。

有效Run原ID为 `run_c3c420c3-482e-4350-8ad7-80c3e21806a9`。SQLite ai_agent_runs状态blocked，event Run generation1/status interrupted/sequence123，renderer状态interrupted、assistant phase partial_answer、已观察文本6627字符。Native session绑定保留在本轮自有DB。测试正常恢复net.fetch/probe监听，await关闭instance及fixture，out字节一致。

## 单次实际测量

| 项目 | reasoning | fixture final-content |
| --- | --- | --- |
| RAF间隔样本数 | 1186 | 147 |
| RAF间隔中位数 | 6.10ms | 6.10ms |
| RAF间隔最大值 | 24.30ms | 12.20ms |
| 所观测Long Tasks | 0 | 0 |
| 首个可信input事件到下一RAF | 5.00ms | 2.60ms |
| 任务与来源侧栏点击到属性变化 | 23.30ms | 11.60ms |
| 侧栏点击到下一RAF | 24.20ms | 13.20ms |
| 可信wheel到scroll变化 | 6.50ms | 6.30ms |
| wheel到下一RAF | 11.90ms | 11.90ms |

final-content阶段真实点击停止到terminal IPC为190.20ms，到下一RAF为192.80ms。输入为真实Playwright键盘事件，raw中逐字符可信input与RAF时点全部保留。表内input是每个阶段首个input事件；完整键盘操作及Playwright等待耗时另列automationRoundtrips。

UI Enter提交到主进程模型fetch入口为1157.19ms，到loopback第一次聊天HTTP到达为1159.36ms。均来自实际观察时点。前者含本地原宿主准备，后者另含fixture转发/loopback开销。

renderer原始RAF、Longtask、阶段事件、交互事件和完整数据在baseline-report.json。每个接口阶段的命名是本fixture测量口径。reasoning来自实际model_reasoning IPC，final-content来自此固定无工具/无commentary fixture的第一个text_delta。业务真实partial/final phase另外保留，当前停止后为partial_answer。

## 时钟与范围

renderer使用performance.now量同进程间隔，Longtask按entry.startTime归属最近已观察阶段。RAF是浏览器回调/渲染机会，未测物理显示呈现。主进程/renderer/外部Node跨进程时点采用各自performance.timeOrigin+performance.now的Unix epoch锚点，原timeOrigin和Date.now差值保留。此次main校准约-0.968ms，renderer约-0.800ms；跨进程时钟初始化、调度和系统校准误差继续适用。Playwright耗时单列且包含自动化传输/actionability，不能充当纯产品处理耗时。

固定fixture为240份reasoning、320份计划final chunk、30ms间隔；本次实际reasoning240/final28后停止。生成文本与实际计数在报告。剩余final未发送。机器并行负载及缓存未作为独立变量隔离，本次只保留一个有效样本，后续A/B需使用同脚本、负载与可比环境。

侧栏展开只代表原“任务与来源”侧栏响应。旧A live-prose阶段没有agent-trace-toggle，过程/思考链展开留Phase7真实门禁。自然完成、reasoning阶段停止、其他窗口尺寸/DPI、正式provider、真实模型质量、教师评审、物理输入设备/显示呈现、最终B与跨版本统计均NOT_TESTED。未增加产品SLA或性能通过门槛。

## 原始失败与纠正

metrics测试先行，`%TEMP%/xiaozhi-phase8-stream-metrics-ljcmpM/report.json`保存预期缺模块red；实现后3/3在`xiaozhi-phase8-stream-metrics-aIirU0/report.json`。

首个真实A尝试 `xiaozhi-phase8-stream-performance-o5dxNg/report.json` 为FAIL，原失败截图与raw RAF/input数据保留。本fixture当时错误等待旧A live阶段不存在的agent-trace-toggle及未出现的assistant_phase，超时，启动还早于DPI=1补充要求。该尝试已完成全部fixture输出并正常关闭，out未变。此旧采集错误与原失败继续保存。

定向阅读旧A AgentProcess/useAgentTraceState/shared事件合同后，修正为实际text_delta口径和固定侧栏控件，并增加DPI=1及实际geometry。随后只执行上述一次有效A采集，结果如实记录。本次未替Terra给出Phase7或产品接受结论。
