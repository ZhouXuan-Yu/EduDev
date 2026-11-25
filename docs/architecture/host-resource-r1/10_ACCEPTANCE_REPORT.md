# 整机资源调度 R1 验收台账

唯一判定依据是原工程包 `05_ACCEPTANCE_CRITERIA.md`。原始证据目录为 `D:/WorkProject/EduProject/acceptance/host-resource-r1`。状态按完整条款填写，专项部分通过保留在证据栏。

| 验收项 | 状态 | 当前证据或需要补齐的验证 |
| --- | --- | --- |
| AC-01 基线、WIP、隔离 | NOT_RUN | 工作树、分支、开工规则、依赖、原生组件已核对。继续补实际集成写者交接及基线校准回执。 |
| AC-02 可信描述与单一拥有者 | NOT_RUN | 原生混载已有同一协调者三类接线轨迹。补全生产入口与 task/run/attempt/worker 跨进程关联。 |
| AC-03 多维全有或全无 | PASS · 已实现 | `wp02-red.log` 显示独立槽多放行，`kernel-regression.log` 核对完整向量、拒绝非法向量和超预算。 |
| AC-04 授予与取消竞态 | PASS · 已实现 | 同一内核门禁覆盖排队、授予前和已实际开始后的取消，旧回调重复归还保持账本。 |
| AC-05 caller 与实际结束 | NOT_RUN | 真实 Windows 子进程与受控屏障通过。逐一注入三条生产路径的退出和超时故障。 |
| AC-06 重试与代际 | PASS · 已实现 | `kernel-regression.log` 多代并存和迟到完成，`execution-bound.log` 实际运行 21 项既有权限、重试和效果边界。 |
| AC-07 驻留资源 | NOT_RUN | VectorHost 常驻和请求各有租约，补 embedding 子进程独立常驻、退出确认及低预算活性。 |
| AC-08 父子及业务锁 | NOT_RUN | 原锁冲突和实际持有回归通过，补三类完整接线下无环反例。 |
| AC-09 前台及依赖 | NOT_RUN | 前台 lane 已接搜索、输出和显式优先收录。补当前会话焦点及依赖失效验证。 |
| AC-10 有限公平 | NOT_RUN | 大任务晋升的确定性反例通过，补真实工作进度。 |
| AC-11 安全让行 | NOT_RUN | 收录原 CAS/ACK 保留，原生维护按原边界。补 OCR、索引和锁持有者的安全点交错。 |
| AC-12 采样与滞回 | PASS · 已实现 | 同一采样器覆盖就绪前启动及恢复，阈值波动和两次持续压力测试通过。Windows 原生混载采集 32 个有效样本，记录从 2→1→0 逐级恢复。 |
| AC-13 降额与排空欠额 | PASS · 已实现 | 受控缺失、NaN、负读数和陈旧读数均触发保守策略，CPU 在用量 8 对目标 4 保留欠额 4。实际租约归还之后仍限制新工作，直到五个可靠样本触发一级恢复。 |
| AC-14 有界准备 | NOT_RUN | `wp04-material-final-image.log` 证明 PNG 排队或未准入取消时全量读取为零，实际 OCR 退出前不可分配其进程槽。解析和版面分析的读取都在完整预留内，校验为固定块流式摘要。补索引上游、其他入口及全流程峰值。 |
| AC-15 资源口径及 Windows Job | NOT_RUN | 原 Job 治理未修改，补实际 Win32 报告及三类资源口径对账。 |
| AC-16 材料队列 | PASS · 已实现 | `wp04-material-ack-recovery.log` 9 项故障恢复与 26 项原队列合同通过，使用真实 SQLite 执行优先级、双消费 CAS、原 owner/lease、停止及重启。最新 Electron 的 PNG 5 项与扫描 PDF 3 项实测补证，含同源重试、实际关闭、SQLite 取消状态、原件哈希及无非法回写。 |
| AC-17 OCR 生命周期 | NOT_RUN | PNG/PDF 实际进程停止与 `close` 已复验。还需补启动失败、运行错误和页后重试的版本匹配验证。 |
| AC-18 embedding/vector | NOT_RUN | `native-vector-retry.log` 10 项通过，补 worker RPC 超时、退出交错及驻留证据。 |
| AC-19 索引批次与发布 | NOT_RUN | 桌面暂停、冷启、正式题库语义检索、原子重建和新世代冷启通过 3 项。旧脚本的 43 项断言在两版复现，日志及独立数据库保留。另有 Windows 原生 writer lock 3/3。正式压力下备份屏障与批次的组合尚未验证。 |
| AC-20 PDF 输出与回收 | NOT_RUN | 真实自然卷 Word/PDF 读回通过，最终版三次原生混载上均观察到首份打印取消后占用保留、第二份实际打印、隔离窗口与文件清理。还需补源图准备和原定正式端到端失败路径。 |
| AC-21 排队后治理 | NOT_RUN | 文件解析唤醒检查原租约/版本，补三类正式权限撤销及提交屏障读回。 |
| AC-22 业务预算 | NOT_RUN | 未新增 run 等待接口调用，补同 run 并行工具的计时、超时和预算完整证据。 |
| AC-23 中断恢复 | NOT_RUN | 自然扫描与暂停索引已有冷启证据，补三类未完成/结果未知对账。 |
| AC-24 切换、休眠与状态 | NOT_RUN | `queue-ui-with-close-retry.log` 在最后一版主进程通过 3 项实机检查，含实际排队、尚未退出的 OCR 显示「正在停止」、退出之后变为「已停止」。还需补实际前台切换和休眠/恢复。 |
| AC-25 资源轨迹 | NOT_RUN | 固定样例报告含单调时钟、生命周期、向量和采样。补业务 ID 到 worker PID 和实际取消案例。 |
| AC-26 真实混合负载 | NOT_RUN | 原生同宿主预验跑三次，每次 12 页、48 条向量来源及一份打印 PDF。正式 W-01～05、UI/SQLite、基线对照和所有工作量未完成。 |
| AC-27 六类反馈 | NOT_RUN | 六类各 100 次有效样本尚未采集。 |
| AC-28 后台进度与同机对照 | NOT_RUN | 预验可见实际推进，正式同机基线及全队列时限待测量。 |
| AC-29 实际压力的有界性 | NOT_RUN | 补 ( W-04 ) 压力、原生 RSS 及准备峰值。 |
| AC-30 故障退出与恢复 | NOT_RUN | 补三类故障后的进程、临时文件和原副作用读回。 |
| AC-31 AI 适用性与品质 | NOT_RUN | 当前 diff 属调度和生命周期，模型、参数、prompt 和检索排序保持原配置。正式输出对照仍须通过。 |
| AC-32 关键逻辑 TDD | NOT_RUN | 内核已保留真正红、绿和回归；其他变化的适用轨迹待完成。 |
| AC-33 构建与门禁 | FAIL | 实际构建、261 项渲染状态、207 项生产冒烟及原生门禁已运行。UI 指纹记录检查失败，报告中的供应商组件源码相对 main 无改动。旧库整表不变断言遇到现行能力注册表修订，Office 独立本地子用例 16 项通过。保留两个失败门禁及原始差异。 |
| AC-34 回退 | NOT_RUN | 无数据迁移，原写入机制保留，须执行收敛与回退演练。 |
| AC-35 候选及主线竞争保护 | NOT_RUN | 仍在模块验收。 |
| AC-36 最终 main | NOT_RUN | 未合并，待正式分支验收并在实际候选、最终主线复测。 |

## 已运行门禁和构建

- 运行 `npm run test:host-resources`，7/7。SQLite 资料队列合同 26/26，现有执行权限、重试和效果边界 21/21。原生 BGE/Lance 专项 10/10。
- 前一构建的真实生产 Electron 通用冒烟 207 项和自然扫描/成果 7 项通过。含状态接线的构建 `4dc4a395b020b97f2ffe0b522021415fb53f815b4f4a5cfefa2fa617c7d17a8f` 通过构建、组件 261 项、实际资料排队与停止 3 项。
- `final-native-mixed-1.log` 至 `final-native-mixed-3.log` 绑定同一编译 worker 和实际 Chromium 打印。每次有 12 页、48 条来源、3 个固定相关结果、1 份通过业务生成的 PDF 和一组打印取消/清理记录。它们使用独立原生入口，正式 W-03 的应用前台和 SQLite 联合步骤尚待完成。
- 依赖审计 30 条既有通报，其中 5 条 high。锁文件未变。全轮 0 次付费模型调用。

## PDF 准备上游复验构建

`npm run build -- --outDir test-results/r1-pdf-preparation` 通过。主进程 SHA-256 为 `189b6288a285c1d4a4c4a853a2b37ba037805eada2b67d4a14aee895a1bc41b7`。同版原生混合与打印取消专项 5/5，正式 Electron 的扫描导入、可读 Word/PDF 和冷启专项 7/7。实际运行窗口见 `manual-window.json`，完整日志参见 `pdf-preparation-native.log` 和 `pdf-preparation-desktop-ocr-export.log`。

## 压力采样复验构建

- 原始红灯保存在 `wp03-pressure-red.log`，覆盖采样异常逸出及应用就绪前遗漏恢复监听。 `npm run test:host-resources` 通过 10/10，实际状态和容量序列见 `wp03-pressure-sequences.log`。
- 原窗口、阈值和恢复步长保留。规则记录 `wp03-pressure-policy-r1.2.json` 的 SHA-256 为 `efdc9e5608d7e6bcfa397f2142a7a9ae76a079b57eacca7ad9aead8fdfd60fc68`。实机原始数据见 `r1-native-mixed-c2MglK/report.json`，状态转移摘要见 `wp03-pressure-native-measurements.json`。
- `npm run build -- --outDir test-results/r1-pressure` 通过，主进程 SHA-256 为 `6cc252076b67972c5d5cdad122e70af10a33d39cf87f97766b1634aad6b1615e`。同版组件 261/261，原生混载 5/5，资料库实际排队和停止 3/3，隔离窗口已启动。正式 W-04 和 AC-29 保持待验。

## 材料准备与原任务恢复复验

- `wp04-material-buffer-red.log` 对旧主进程实测。进程槽被占满时读入 110,262 字节。`wp04-material-buffer-stack.log` 另外追踪当时尚未准入的版面分析读取。最新版本同一 PNG 的等待读取次数为零，每次导入解析读取一次，后续版面分析使用独立完整准入，流式校验记录未产生额外的全量读取。
- `npm run build -- --outDir test-results/r1-material-prep` 及 `tsc --noEmit` 通过。主进程 SHA-256 为 `a74df7f1932c834fc7e67ce8db3dbc286da724f231e56c7a9da78db12d4667ca`。Electron 实际图片 5/5、扫描 PDF 3/3、原生混载 5/5、资源确定性回归 10/10、组件 261/261。原始日志和独立数据库保存在固定证据目录，详见 `wp04-material-final-image.log`、`wp04-material-final-pdf-queue.log` 和 `wp04-material-final-native.log`。
- `node --experimental-transform-types scripts/education/material-queue-ack-recovery.mjs` 通过 9 项实际 SQLite 故障恢复和 26 项队列合同。主动注入 `SQLITE_BUSY` 后同一结果只提交一次。首次读取 SHA、再次读回的同源 OCR 记录与副作用检查都在独立测试数据上完成。
- 对同一隔离构建执行 `node scripts/electron-smoke.mjs`，1366×768 与 1920×1080 的 207/207 条前端断言通过，日志 `wp04-material-final-smoke.log`。原有 UI 指纹和能力迁移门禁仍列为失败。`npm audit --package-lock-only --json` 记录 30 条既有通报，其中 5 条 high。
- 手动验收窗口从同一构建启动，实际进程、主进程哈希和独立数据根见 `wp04-material-manual-window.json`。
