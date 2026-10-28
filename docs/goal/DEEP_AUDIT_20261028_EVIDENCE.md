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
