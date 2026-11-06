# 后台资料写锁恢复

## 实现与教师结果

抽取并复用现有 xiaozhiState 的 SQLITE_BUSY/LOCKED 识别、25ms 起的指数退避与 10 秒边界，在 JavaScript 层等待 BEGIN IMMEDIATE。已拥有事务的连接可以继续使用工作线程提交，等待者只重试获得写锁。

接入资料 Word、目录 AI、全文、题归档、AI、网页回填、检索、PDF、普通正文的九处既有 writer。事务正文、模型、OCR、网页请求都没有自动重放。原外键策略分别保留。普通正文等待支持 AbortSignal，获得锁后仍由原逻辑检查停止、原件与不可变租约，失败事务回滚并关闭连接。

MaterialRepository 将原生 SQLite 锁错误分类为 busy，耗尽后沿资料页原失败/重试入口反馈。failMaterialText 保留实际 parser 前缀，TXT/MD 失败不再一律记为 Hana。原件、教师事实、队列协议、IPC、依赖和模型授权范围均保持原合同。

## 真实界面路径

正式资料导航选择新两级目录，64 份生成 Markdown 经后台解析和索引后，查找稀有词、打开来源、typed 原文读取、1366×768/1920×1080 和冷启读回通过。外部 SQLite 连接持有 800ms 写锁，实际应用遇到 85 次 SQLITE_BUSY，最终 64 份均成功，无教师重试、renderer 错误、网络请求或云调用。计数与原表一致，原文件摘要和命中在重启后不变。

测试只对第一条 BEGIN 延迟 300ms，帮助外部连接在可重复的时点获得锁，原查询和事务调用仍交给实际 sqlite3。探针计数与锁竞争属于受控故障注入，64 个小文件不能代表自然混合格式、40GiB 或长期压力。

上一轮资料38.md的原始底层异常没有保存，仍无法证明是此锁机制导致。search-statistics 原失败和手动恢复记录保留。本片证明可复现的竞争机制已修复，并未补写历史根因。

## 验证与性能

| 检查 | 结果 | 证据 |
|---|---|---|
| 原生 sqlite3 磁盘/WAL 写锁 | 6 PASS | native.log/native-lock.json |
| 现有不可变租约/优先级/取消/冷启 | 24 PASS | queue.log，内存SQL/受控ingest |
| 现有 state 写锁/事务/冷启 | 5 PASS | state.json，源码谓词行为保持 |
| 页归档与恢复基套 | 204 PASS | page.log，模型与图片受控 |
| 派生统计事务 | 6 PASS | statistics.log |
| 检索代际/事务 | 17 PASS | retrieval.log，向量端口受控 |
| 组件状态 | 246/246 PASS | components.log |
| 最终 build/typecheck | PASS | build.log |
| 实际目录与外部写锁/来源/冷启 | 4 PASS | journey.json/log |
| 最终冻结构建共享 Electron | 207/207 PASS | electron.log、frozen-after.json，session99432退出0 |
| audit | 28，8高/12中/8低/0严重 | audit.json，既有问题，退出1 |

原生池对照进程限定 UV_THREADPOOL_SIZE=2、同一测试工况先原路径再新路径。旧路径耗时 5513.72ms，两个等待者失败、事实写入 0；异步路径 420.86ms，两个事务各执行一次、事实 2。它证明受控写锁等待与工作线程释放行为，不是导入吞吐或检索 P95。取消在 60ms 发出并在 500ms 内完成断言；持续占锁约 10 秒返回 busy。非锁错误立即传播，事务正文失败不重试且回滚。原外键开/关两类策略均保持。

相对 dfacb2a，main 未压缩增加 595B，preload/renderer 不变。冻结摘要见 frozen-before.json，最终复核另存 frozen-after.json。本轮未测峰值内存或正常导入吞吐。

## 精确命令

在 apps/desktop 运行。

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/material-write-lock-boundaries.mjs
node scripts/education/kb-search-statistics-journey.mjs --contention
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-search-statistics-boundaries.mjs
node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs
node scripts/xiaozhi-agent/pi-state-write-concurrency.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types --input-type=module -e 'const {materialQueueBoundaries}=await import("./scripts/education/material-queue-boundaries.mjs");let checks=0;await materialQueueBoundaries(async(name,action)=>{await action();checks++;console.log("PASS "+name);});console.log(JSON.stringify({success:true,checks}));'
node scripts/electron-smoke.mjs
npm audit --json
```

queue-loader-failure.log 保留第一次漏 loader 导致的模块加载失败，queue-import-only.log 只导入了函数未执行断言，不能算通过。最后 queue.log 显式调用原边界函数，实际 24 项通过。

复核发现两个 writer 原先没有启用外键。共用函数已增加保持原策略的参数，旧构建的共享回归进程在确认仍活跃后有意停止，完整进程树属于本次 smoke；superseded-run.json 和 superseded-electron.log 保存原因与终态。之后重新构建、执行新增外键边界、页归档和实际目录，最终共享回归独立记录。初次原生 5 项仅在工具输出，转录为 initial-native-capture.json；最终 6 项已保留原始 stdout。

## 文件与回滚

- sqlite-write-lock.ts 保存共用锁识别/退避与本地 BEGIN 等待。db.ts 复用在九处既有 writer，原 state 使用同一谓词与延迟，事务调度逻辑保持。
- material-repository.ts 保留锁错误类型，db.ts 保留实际失败 parser 前缀。
- material-write-lock-boundaries.mjs 提供可独立运行的原生锁反例；kb-search-statistics-journey.mjs 增加显式 --contention 测试模式，默认流程继续可用。
- 没有新表、迁移、IPC、队列、依赖或运行时服务。
- 回滚可设置 OMNI_EDU_MATERIAL_ASYNC_WRITE_LOCK=0 并重启，恢复九处 writer 原 5000ms 阻塞锁等待，原事实、收据、统计和错误读器保留。开关只用于临时恢复旧行为。

## 尚未完成

完整 Goal 保持 ACTIVE，KB-A01～A10 保持 OPEN。旧自然12题仍待核。下一推进通用图文归属和自然正文质量，补齐必要的本地解析错误诊断，随后按主合同进行120题留出、200查询、三套正式蓝图、真实10→40GiB/72h、普通Windows链式安装和异机迁移。非锁解析失败、长写事务和其他未改动业务 writer 的资源竞争仍需据实际使用处理。

全部最终命令已结束。共享回归后 main/preload/renderer 的 SHA256 与专项启动前一致；完整输出、失败、停止记录分别保留。origin/main 当前已包含于基线 dfacb2a，本轮在知识库分支正常整合推送，其他工作树不移动。
