# Pi5 read-only timing note

2026-11-17，既有证据只读分解，新增测试/runtime/build/源码修改/模型调用0。原报告为 phase5-production-ZNtzfV/report.json，worker.log/native-tool-bodies.json同目录。runner原日志为 %TEMP%/xiaozhi-phase5-gate5-independent-20261117/production.log。SQLite以readOnly打开 %TEMP%/xiaozhi-phase5-production-grcqce/data/app.db。TIMING_EXTRACT.json保存本轮4个Run与此前nYlhZl4个Run的时间、Tool区间和原权限审计摘要。

## 可证分解

| check | report总耗时ms | DB Run区间ms | preparationMs | 首个Tool距Run创建ms | 原Journal工具起止跨度ms |
| --- | --- | --- | --- | --- | --- |
| 实际获取/执行/私有拒绝 | 120328.353 | 119749 | 23456.741 | 29174 | search4377，prepare38625，resolve6611，execute21815，skill5010 |
| 后续Run私有拒绝 | 29710.544 | 29288 | 14765.402 | 20738 | skill4957 |
| cold后私有拒绝 | 31145.996 | 29895 | 16702.648 | 22394 | skill4279 |
| 清理readback | 3.764 | 无新Run | — | — | — |
| fullAccess缓存复用 | 33269.768 | 32702 | 3273.353 | 8656 | prepare13722，resolve769，execute8000 |

第一Run五个Tool跨度合计76438ms，工具间隙合计9594ms，最后Tool结束到Run completed4543ms。首Tool前29174ms包含preparation23456.741ms，剩余5717.259ms尚无内部阶段计时。第二/第三Run各只有一次skill_create，分别在首Tool前消耗20738/22394ms，工具跨度4957/4279ms。Report check还包含host.start前后、断言/readback，cold check包含close/store.init/makeHost。

原时延事件的sdkEnded→terminalCommitted分别为1178.200、938.087、529.620、250.128ms。第一Run末个Job terminal审计在14:58:53.544Z，Run completed在14:58:53.912Z；第二Run末Job terminal14:59:23.450Z，Run completed14:59:23.779Z。Job result.durationMs是helper自身测量的运行/清理区间，和Tool区间有重叠，不能相加为独立阶段。

缓存GET0、审批0、模型14请求均loopback已经原report/runner确认。当前证据中有cached prepare的两次独立原生health/function probe，第一Run对应helper duration1262/2202ms，fullAccess对应1079/1327ms，完整prepare跨度分别38625/13722ms。差额覆盖准备/授权/目录校验/启动周边及持久化等路径，各自占比待profiling。单次Job跨Tool和后续会话寿命，helper duration还包含闲置等待。

## 比较范围与待验证热点

nYlhZl同名五check为47683.970/5935.497/6658.816/0.571/21395.109ms，同样复用grcqce、GET0、审批0、模型14请求。其DB preparation分别6650.732/3769.432/4457.895/4356.800ms，skill_create跨度640/599/598ms。本轮前3个Run的preparation、无原生执行的skill_create跨度，以及多个工具间Journal间隙都更长，足以把调查点扩到共享准备/持久化队列和机器调度。

两次沿同owned root串行继续，已累积原Task/Journal/权限审计/原生Session历史，源码候选、机器负载和缓存状态也各自不同。现有单样本记录保留观察差异，性能因果和正式退化结论尚待固定Phase8实验。SQL queue wait、SQL执行、文件流hash/复制、Pi/Registry准备、helper创建与系统调度目前缺少互斥的计时。

## 下一次最小profiling建议

Phase8只跑同固定cached Pi5一轮，在owned TEMP instrumentation wrapper中给原delegate加单调时钟标记，保存输出到独立文件。固定同包/完整文件数、DB体积与row counts、同Run步骤、同窗口/机器负载记录，模型仍loopback。

最小标记为start入口→workspace/privacy/skills/MCP tools→Pi ready→net.fetch；serializeStateWrites enqueue/start/end分开记录排队与执行；public hash/tree/Node验证记录bytes/files与耗时；两个probe记录prepare/launch/started/initialize/list/function/close；publisher drain/commit/outbox与terminal seal分别计时。输出按runId/callId/executionId关联，SQL只留操作类别与耗时，避免正文与秘密。并行采集main事件循环延迟和main/helper CPU累计，先用总区间闭合再判断热点。保持原验证、安全门禁与原断言，profiling完成后才决定定点实现。
