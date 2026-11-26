# V3.1 设置优先执行入口

状态：IMPLEMENTING；不是SET-P0_ACCEPTED或DONE。工作树和分支见PHASE0.md；起点main=d16b0af。

- Phase0：真实代码/运行基线及34树审计已记录，92份工程文本冻结；90 AC＋36 LG保持独立状态。
- 协作：按用户澄清在隔离分支实施，其他业务逻辑不重写。新合同禁止提前main合并。
- 自动Goal已真实创建且active；目标为本包V3.1，不替换Master或其他AI任务。完整90/36的正式状态不从模块通过自动提升。
- W2-A轮次2/8：controller-red.log为首次有效红灯（actual0/expected1）；后续controller-crash-red.log证明崩溃未清理的实际失败，最小修复后controller-green-2.log为9/9。controller-electron-2.log指向controller-electron-EOcbKR/report.json，真实Electron加载生产controller、使用独立HTML夹具，8/8；这不是完整设置业务或已接入主窗入口的AC通过。
- W2-C轮次2/8：新增scope-authority.ts，将主窗可信选择与设置调用作用域分开，切换即撤销旧epoch；scope-version-red.log证明旧schema版本被错误接受，修复后scope-green-2.log为9/9。尚未接通宿主，不能称实际权限/配置API已经保护完毕。
- 下一步唯一重点：按PHASE0.json的真实设置依赖精简最小preload/IPC。静态传递import包含终端等非设置能力，不能照单暴露。以明确allowlist＋原schema/宿主guard接回十类设置，主窗可信会话/epoch同步后再切换入口。
- 尚未实施：主窗所有设置入口汇聚、最小preload、会话epoch同步、配置/记忆/备份桥接、10页实际迁移、全部V3页面与126项正式验收。
- MG-01/FG-01/FG-02：NOT_RUN；本轮不合并main。

当前配置/权限/记忆/备份、App.tsx、main/index.ts、原preload和原PiSettingsWorkspace未改。只有新增独立模块和测试；旧主线验收窗口仍代表main版本。build-w2a.log exit0（含tsc），renderer-w2a.log exit0（261/261）；没有把未接入模块的构建通过称作新设置窗已交付。

当前尚未遇到需中止全部工作的外部阻断，Goal保持active。原生125%/双屏等仍是后续实机验收依赖，不因已知缺口提前把尚能实施的IPC/页面工作停掉。

不得重复运行phase0脚本覆盖矩阵进度；脚本已保护已有矩阵。预算跨会话累计，保留每次失败及新证据。
