# Phase8 合成流式测量合同

## 2026-11-20 本地准备分段取证

在指定编译输出的 Electron 主进程启动前订阅本地诊断通道，用同一 Run ID 将生命周期操作与首个模型请求关联。通道只产生操作名、运行编号、结果和时间戳。独立合成夹具限定记录条数，保存原始区间和截断计数。日常界面和数据库保持原合同。

报告从页面提交、执行入口、Pi prompt 入口到主进程首个模型请求分别计算耗时。执行入口前的差值包括受理与调度，不能归给某一个操作。每段内的操作计时包括嵌套等待，按包含关系核对，不能直接累加。记录丢失、缺少边界或顺序不成立时保留原始观测并明确证据不足。既有的超时、主动停止和迟到清理语义不变。

诊断版测量使用 `--require-lifecycle true`。旧构建无诊断通道时标记分段不可用，并保留外层请求时点和原流式检查。独立夹具有现成的 `answerQuality.preparationMs` 时，按同一 Run 复核主进程准备区间。

这次定位使用独立 SQLite 和合成 SSE，不触发真实模型额度。只报告当次后台样本的实际耗时，正式性能和真实模型验收仍按专项计划进行。

2026-11-17，DRAFT。仅新增 phase8-stream-performance-* 与owned TEMP。测量脚本使用可配置desktop root自己的Electron/Playwright/out，在新空SQLite/profile操作原UI。A为d50ef330旧树，458份out列表SHA256为9339199da66260513af57250be680c31b507d0f6549e4e5d4f545f13648734f2。

单次Run经真实输入发送，Electron main的net.fetch在固定DeepSeek HTTPS模型端点重定向到loopback合成SSE。假key覆盖环境，其他net.fetch端点拒绝。provider metadata与聊天响应均来自自有fixture，代理重试0，真实模型0。原reasoning/正文按固定chunk和间隔生成，首次reasoning/final期间分别操作真实键盘、过程展开及滚动，final期间点击停止。停止reasoning、自然完成、其他尺寸与真实provider保持NOT_TESTED。

观测修正沿旧A实际源码。reasoning以实际model_reasoning IPC开始，final-content以固定fixture首个text_delta开始，业务最终phase单独记录。展开统一测原“任务与来源”侧栏，记录aria-pressed变化及下一RAF；旧A live-prose没有聚合trace展开控件，该项保持未测。启动加force-device-scale-factor=1，同时记录真实window/content bounds、innerWidth/innerHeight与DPR。首个缺该DPI约束及错误等待trace/phase的失败尝试保留。

浏览器performance.now记录RAF间隔、Long Tasks、可信input/click/wheel/scroll事件、属性变化/状态event及下一RAF机会。Longtask按其startTime归属已观察的IPC阶段。事件→下一RAF表示渲染机会，显示器物理呈现未测。Playwright调用耗时单列，包含自动化传输。UI提交→main固定模型fetch入口/loopback首次HTTP到达以各进程performance.timeOrigin+performance.now的Unix epoch计算，记录Date.now校准及采样边界，跨进程时钟误差保留。

先写metrics合同测试，保留缺模块red，再实现。真实Electron基线仅执行一轮，保留原失败、raw RAF/longtask/interaction数据、请求时点、SQLite/本地文件readback、out前后hash及截图。报告success仅表示采集断言完成，性能无SLA/PASS门槛，单次数据供后续同脚本A/B复核。完成后恢复测试hook/observer并正常关闭自有instance，Gate5释放优先。
