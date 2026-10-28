# 深度审计整改证据（2026-10-28）

## 目标与边界

完整目标为指定DOCX的F01–F26逐项修复、Terra/high独立代码与操作审核、逐项主线集成和启动后继续；全清单为DEEP_AUDIT_20261028_TODOLIST.md。本文首片只交付WP0有限历史数据采集检查点和用户新增的CLAUDE.md，不能称F24或整份报告整改完成。

起点3734df3；刷新远端后本隔离分支快进d710541。D:协作者分支/脏改动、32aa的已检出main均未切换或移动。desktop/node_modules只读Junction复用D:，dependencies/devDependencies/overrides已核一致；没有通过Junction安装、修改或删包。新树build把生成vendor清单/代码中的依赖路径改成绝对D:注释，六个仅本轮自动生成文件已明确从HEAD恢复，不将环境路径差异作为业务修复提交，out仍记录真实构建指纹。

## WP0历史计量工具

新增scripts/audit/performance-history.mjs、performance-contract.mjs、performance-contract-test.mjs、performance-compare.mjs。独立SQLite测试根先经真实Electron初始化和exit0关闭后再种合成10/100/1000轮，无教师数据或provider请求；然后实际侧栏选择会话/typed snapshot/输入，双视口各5个原始样本，验证默认40轮及hasMoreHistory。

采集：暖切换+双rAF耗时、额外snapshot IPC耗时/字节、Playwright fill+帧耗时、有效React DevTools root commit计数、longtask、main eventLoop/IPC/SQLite调用次数、进程资源、Chromium Performance指标；每组另做第6诊断回放并存trace，不混入5个计时样本。没有组件React Profiler duration、原生按键到绘制、完整GPU合成、Skill和真实模型指标；不把root计数冒充组件Profiler，也不把warm open称冷启TTI。

环境条件含Windows/CPU/Electron/Node、GPU设备/driver、显示尺寸/缩放/电源方案、lock SHA、实际依赖版本、4个相关探针helper源码SHA及probe开关；比较器拒绝条件不同、JSON往返差异、缺组/重复/额外组、错误样本数/非数字、功能失败。不比较产品源码SHA相等（优化前后应不同），但记录其身份及完整out指纹。当前候选预算25%/10ms仅作诊断；p95在5样本下等于最大值，不是校准过的服务承诺。

## 精确命令与结果

命令工作目录为本工作树apps/desktop。原始日志/报告均在该树test-results；源码只跟踪非敏感汇总与脚本，不提交测试数据、trace或教师文件。

| 命令/构建 | 实际结果 | 证据 |
|---|---|---|
| `npm.cmd run build`，3734df3 | exit0，含TypeScript | audit-20261028-baseline-build.log；该产物不作d710最终证明 |
| `npm.cmd run build`，d710541 | exit0，含TypeScript | audit-20261028-main-d710-build.log |
| `npm.cmd run test:renderer-components`，d710541 | exit0，240/240；Vite已有端口占用提示，不伪装套件失败/无提示 | audit-20261028-d710-renderer.log |
| `node scripts/audit/performance-contract-test.mjs` | 最终15/15，0失败/0 skipped，含回退/缺组/重复/环境/helper/JSON往返负例；Terra独立运行同结果 | 终端记录及Terra审核 |
| `node scripts/audit/performance-history.mjs` | d710：exit0、6组×5原始样本、6 trace、已记录0 rendererErrors，2个owned进程exit0 | audit-performance-Y86FDJ/report.json；audit-20261028-d710-history-final.log |
| `node scripts/audit/performance-history.mjs --baseline=test-results/audit-performance-Y86FDJ/report.json` | Terra独立实际执行exit1，7/18候选比较失败；功能采样完成但报告ok=false，2个owned进程exit0 | audit-performance-FzXd2R/report.json；不是产品回退结论 |
| `node scripts/audit/performance-history.mjs --without-probes` | Terra独立实际执行exit0，6×5/6 trace，2个owned进程exit0；因probe条件不同不能作默认预算对照 | audit-performance-4njAOh/report.json |
| `npm.cmd audit --json` | exit1：22项（8 high/6 moderate/8 low/0 critical），原依赖风险记录，未自动升级 | audit-20261028-npm-audit.json及stderr.log |

上述d710三次报告同out SHA256 `934f2e9339a3eb124be958c124db24f90621e5797a5eb6d067c4d5f5e4d21a8c`。默认初页10/40/40轮已实际断言，但这不代表F10全生产调用者或1000轮完整向上加载已验收。脚本不输出统一skipped字段；没有实际执行的场景均仍列在TODO，不计通过。

### 同构建重复失败与探针开销边界

没有产品代码优化，以下不是优化前后收益：独立重复中100轮1920 open p95约181.5→364.4ms、input约25.3→50.1ms；1000轮1920 open约214.6→377.6ms、snapshot约47.9→68.5ms、input约26.8→68.3ms；10/100轮1366的open亦超候选阈值。无探针对照100轮1920 open约242.6ms/input约49.6ms，波动交错。单次串行A/B不能量化探针开销或给稳定裕度，因此不能将25%/10ms当CI硬门禁；需受控多次交替、噪声归因与后续校准，不能放宽断言来消除失败。

## 独立审核和保留失败

审核者/root/terra_reviewer，GPT-6.1 Terra/high，用户明确指定。第一轮退回比较失败后ok未复位、矩阵完整性、可比条件/探针开销/退出等问题；相应正反例与元数据补齐后继续复核。第二轮实际JSON往返时driverVersion:undefined丢字段导致同机比较必失败，xXOKzz报告exit1保留；标准化null/可序列化条件并补JSON往返测试后最终重跑。第三轮实际同构建比较仍7/18失败，未改阈值；审核仅接受“有限历史采集检查点可落主线”，不接受稳定性能门禁/F24完成。

首版rpxsjo：历史面板默认关闭导致选择timeout（探针定位错误）；v2 Eb2fzt：隐藏窗口rAF约1Hz，暖切换5–7秒、fill约1秒，不可作为可见UI基线。根按刚实证归属PID关闭该自有实例，保留失败，随后显式visible/bringToFront/visibilityState守卫。所有中间373构建/脚本旧hash均不冒充d710最终证据。初次错误cwd创建嵌套空目录/日志路径失败在命令执行前已报错，未算产品失败。

## 用户新增产品约定

用户原文十条、六项交付及教师成功标准完整保存根CLAUDE.md（标题级别与补全加粗闭合仅格式差异），AGENTS.md/1.Agent/4.Wiki引用同一来源；D:根原无此文件，已写入相同SHA副本，其他协作者文件未改。Terra取得本轮用户原文后逐字核对通过。适用范围附段明确不产生新的提交/推送/部署授权；本轮逐项主线交付依原目标与最新AGENTS的已有明确授权。

## 回滚与继续

本片仅测试/文档，无schema、运行时协议、业务真源或生产渲染更改；回滚限本片提交的这些文件，不删除测试失败证据或教师资料。主线集成前刷新origin/main，保留他人提交；若main在其他工作树占用，只在本分支整合并正常push HEAD:main，不偷偷移动其本地指针。集成/远端SHA/合并后主线启动记录收尾追加。

后续保持F24 MEASURING，完整Profiler/流式/Skill/CPU/GPU/SQL/CI矩阵未验；继续F14等逐项修复，每项重新冻结验收和回滚。完整Goal保持active，不能以此检查点标完成。

### 主线检查点集成与启动

2026-10-28提交fc78137c32e6aae8ae7eca547bea5ee59e4047e2，刷新origin/main后正常push HEAD:main，ls-remote回读相同SHA。Terra只读收尾复审通过限定口径。主线生产源码与d710构建相同，本片只有测试/文档；`node scripts/daily-launch-visibility.mjs` exit0，report=daily-launch-visibility-j4c89s/report.json：2个实际Electron/Pi窗口，hidden对照PID34892 visible=false，interactive PID46532 visible=true，0 rendererErrors，同out指纹934f2e93。此探针按启动器配置重建spawn，未执行真实npm start/桌面快捷方式，也未更新D:协作者工作树；不能称间歇旧页面已复现或治愈。启动检查已完成，可新分支继续F14。此后的文档收尾提交不改变生产产物。

## F14：事件先于快照的恢复竞态

分支codex/audit-20261028-f14-pure-recovery；base e7ee92e51c88b8b89de1fb2c54fe3b0f3cbbaa82。冻结合同在TODO的F14节。教师结果：首次读取前收到突发事件仍恢复完整当前会话；失败保持禁写可重试；快速切换/卸载的晚响应不污染新页面。并未证明间歇旧页面的根因就是本问题。

仅生产文件：PiEducationWorkspace.tsx及新pi-snapshot-hydrator.ts。状态updater纯化，缺快照恢复在事件回调发起；同scope单在途、事件revision栅栏、最多8次冲突重读。fresh调用要求调用后新读（覆盖无公共事件的业务写）；只join缺快照恢复。open/cleanup换独立token，保护旧A finally不释放新A；失败后status/gap/unavailable不形成重试风暴。typed IPC、receiver序列/seed、Pi循环、表/迁移、文件权限与旧入口不变。无新依赖。

### 精确验证

以下工作目录为本工作树apps/desktop；脚本/报告位于其test-results，未提交runtime数据或trace。

|命令|最终结果|证据|
|---|---|---|
|`npm.cmd run build`|exit0，含TypeScript；随后smoke再次最终构建|audit-f14-build.log；最终产物以smoke为准|
|`npm.cmd run test:renderer-components`|exit0，240/240|audit-f14-renderer.log|
|`npm.cmd run test:smoke`|exit0，含最终build/typecheck，30名隔离学生、207/207历史教育兼容项|audit-f14-smoke.log；不是当前全部Pi UI/真实provider验收|
|`node scripts/audit/snapshot-hydration-test.mjs`|exit0，11/11、0 skipped；Terra独立同结果|终端和独立审核；原生Node24直接载入纯TS helper|
|`node scripts/audit/snapshot-hydration-component.mjs --baseline`|预期exit1，旧组件同52条事件峰值106，准确失败于单在途断言|audit-f14-component-before-frozen.log；audit-hydration-component-TudpbJ/report.json|
|`node scripts/audit/snapshot-hydration-component.mjs`|exit0，最终12/12，0 pageErrors；Terra独立最终同结果|根hUxFCG/report.json、audit-f14-component-final.log；独立vmNZ6k/report.json|
|`node scripts/xiaozhi-agent/pi-event-sync-boundaries.mjs`|exit0，10/10|audit-f14-sync.log；pi-event-sync-tZCImg/report.json|
|`node scripts/xiaozhi-agent/pi-event-journal-boundaries.mjs`|exit0，19/19|audit-f14-journal.log；pi-event-journal-yQ7rNd/report.json|
|`node scripts/audit/snapshot-hydration-electron.mjs`|exit0，6/6、2实际启动/0 rendererErrors；Terra最终独立同结果|根u7ZZXb/report.json；独立m4g1iG/report.json（最终含transport断言）|
|`npm.cmd audit --json`|exit1，22项：8 high/6 moderate/8 low/0 critical；未自动升级|audit-f14-npm-audit.json|
|`git diff --check`|exit0，集成前再检查|终端|

最终out SHA256 `d457f43598c145d9f935a1928b9feb5d2c48745ce7bd04359c3be60e188ccb5d`；独立Electron相同指纹。受控catalogue/SSE完全声明为夹具，Pi真实执行并写实际SQLite/native，未直接插journal。held首快照的该run cursor为generation1/sequence6；之后同session/run/gen的7–65包括文本和终态，均在释放前逐项等于SQLite committed JSON/hash。两读恢复完整50片文本、仅一次f14-000，无重复；双尺寸、A晚响应不替换B、真实typed拒绝与教师重试、页面reload及冷进程后journal/native字节一致、无新增run/模型请求。根owned PIDs20972/35676、独立39524/37140均exit0；独立modelRequests=1、blockedExternal=[]。

StrictMode12项另覆盖：两次读取中继续突发、无公共事件的业务写后fresh刷新、setSnapshot后commit前事件、snapshot/settings分别延迟拒绝、失败后重复gap/unavailable、A→B→A、旧visibility finally对新refresh锁、连续8次冲突后的显式恢复、卸载重挂、Stop。发布到commit前反例通过测试专用load插件在setSnapshot后插入同步callback，生产源码无hook；该层API/events受控，不冒充真实Pi。实际Electron使用未插桩的生产renderer和typed preload，持有/拒绝只在main原handler实读后影响其传输。

### 性能前后与范围

同development React StrictMode、52条已接受事件、首快照held的受控工作负载，旧组件读取并发峰值106，新组件1；新组件跨两次受控延迟后3个顺序snapshot成功收敛（两波事件），真实Pi单波为2次读取/峰值1。本片没有稳定延迟/CPU/内存/流式TTFT的前后收益证明，不能把此并发数换算成整体提速百分比。每scope只持有一个请求和常数状态，不缓存/复制事件，不引入每帧/轮询任务；持续冲突8次后显式失败，保留老师重试。F24仍MEASURING。

### 独立审核与失败保留

Terra/high初审退回两项：fresh刷新加入旧事实、旧A finally清新A锁；分别加revision和token及真实组件反例。复审要求gap/unavailable失败后同样守卫、真实Electron事件时间屏障和有界自有进程清理；均补齐。最终独立实际6/12/11通过后接受此片，非完整26项完成。

失败未删：组件首版3enBYS缺virtual classroom插件而未加载，已复用现buildClassroomPreview并使用本树cacheDir；gmogHr/最终TudpbJ旧代码106峰值为有效反例；y9agKZ失败后终态多发一次读，已补守卫。fresh语义新增后旧helper“仅取Promise身份”的测试误发fresh而挂起，Node报未settle await，已明确join=false并另测fresh重读。两旧receiver脚本首次缺自有父目录ENOENT（其中Node关闭还报UV_HANDLE_CLOSING），创建本树目录后原断言10/19通过。

Electron失败：UowF8Q过早挂接IPC；SBOJNX/1PgEGw测试catalogue缺字段或Pi数据放全局.codex触发configuration；QiTMpM主进程CDP求值Promise被回收，后续读取状态仍可用，不据此断言产品失败；4dULRR受控131k容量不足真实上下文而context_limit，改为明确1M夹具而未改产品限制；k74mqx等待ai_agent_runs.completed的测试契约错误，实际succeeded/journal.completed，已修正；这些均保留失败报告及0通过边界。请求到达改读本次专用marker，后续真实事件/数据库屏障仍必须通过。正式Pi禁止全局.pi/.codex内stateRoot，runtime放私有OS temp并在报告记录路径，不关闭安全校验。无真实Key/教师资料或付费网络调用。

### 回滚、未验与集成待记录

可通过回滚本片提交恢复旧renderer读取实现；无数据库迁移/用户数据操作，不需删库或改协议。未验证真实provider/真人教师、完整Stop/审批业务E2E全部组合、任意持续事件率/长期压力、40GB、稳定P95或安装包。Stop和禁写的本片边界有真实组件反例，实际Electron限上述6项。26项目标保持active；F14须在下节记录正常主线push、远端SHA和该源码主线启动后才标VERIFIED。

### F14最终主线交付

提交34aae9f72543393e187aa12488c751c687b3fe4f；fetch origin/main后无新增上游冲突，正常push HEAD:main，ls-remote回读相同SHA。Terra最终独立6/12/11接受。随后在该主线SHA重跑`node scripts/audit/snapshot-hydration-electron.mjs`：exit0/6项、2实际启动/0 rendererErrors、相同d457f435完整out；报告audit-hydration-electron-oHsOhj/report.json、日志audit-f14-main-startup.log。F14按冻结范围标VERIFIED，F24及其他项继续OPEN/MEASURING；下一项F15从该集成主线的新分支验证既有序列恢复及实际丢第10通知/尾通知。此后仅文档状态收尾提交不改变产物。32aa本地main及D:协作树未移动；远端main更新不等于D:日常源码或快捷方式已换到该分支。
