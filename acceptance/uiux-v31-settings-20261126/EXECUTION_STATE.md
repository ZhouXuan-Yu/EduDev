# V3.1 当前执行入口

最新检查点：751ae4f之后继续正式跨会话/权限同步验收。CHECKPOINT_CONTEXT_FOLLOWUP.json记录13/13真实双窗检查、17个新旧通道拒绝、关闭后SQLite核对B已保存/A无改动，以及正式导航撤销重开。修复usePermissionMode未订阅设置变更、旧读回可能覆盖新版本的问题；OfficeComposer和权限业务未改。沙盒frame仅验证无preload/不能访问parent，不冒称已经发出原生IPC。

W2-C累计7/8：第6轮修复真实权限显示不同步；第7轮修正frame测试未等待frameattached的夹具竞态，失败保留。最后一轮前先集中补齐await对话框撤权、全局/会话配置迟到响应的真实证据，再实施；不得换名称重置预算。W2-E0/8继续原配置、凭证、历史、撤销和冲突。全部90AC/36LG与SET-P0/MG/FG仍未通过，不合并main。

状态：IMPLEMENTING；自动Goal仍active，完整90 AC＋36 LG及SET-P0/MG/FG未通过，不合并main。分支codex/ui-ux-r1-20261125，起点42340fd。独立设置窗、最小接口、主窗可信会话和十类原设置已接入正式Pi构建，保留原业务真源。

磁盘阻断曾导致本文件为空，已从C盘完整恢复。后续出现约100MB可用空间，继续正式源码修复：W2-C第5/8轮补上readRevision等待后重新核验主窗身份，正式新增红灯复现并修复为10/10。此前双窗实测8、接口12、组件261、Pi9、旧legacy回归207和audit0为分层证据；本轮最后同版结果以CHECKPOINT_W2_INTEGRATION.json为准。C盘RECOVERY为历史快照，不能盲目覆盖当前工作树。

下一步：按RUNTIME_INTEGRATION.md集中补齐await对话框和全局/会话配置迟到回执证据，再做配置保存/历史/撤销/冲突与数据库读回，以及记忆/权限/工具/归档/备份闭环，最后原生焦点/DPI/键盘/性能。旧Pi设置UI脚本需适配独立owner window并保留断言；desktopRevision身份应包含新增设置入口。W2-A3/8、B1/8、C7/8、D2/8、E0/8、F0/8、W10 0/3，预算不重置。

## 历史：磁盘阻断及C盘恢复记录（不代表当前仍停止）

State: BLOCKED_STORAGE; automatic Goal remains active, not complete. Branch codex/ui-ux-r1-20261125; HEAD 42340fd6f3f82285791576266b3d3788b27166db. Current changes are UNCOMMITTED and main has NOT been changed.

Actual production Pi main/settings windows and all ten original setting components are integrated. Current formal Electron product test is C:\Users\ZhouXuan\AppData\Local\Temp\edudev-v31-settings-final-20261126\product-NF4jKy\report.json, 8/8, full build unchanged. IPC contract 12, controller/scope 9+9, renderer 261, Pi boundary 9, audit 0. Legacy smoke 207/207 passed on its protected legacy entry before final settings-only notice cleanup and unused API removal; it is not full V3 acceptance.

D disk has only 4 KiB free. A D-root final test could not launch; subsequent C-root actual production test passed. Automatic approval rejected cleanup of owned Electron caches with blocked by policy, no additional reason; no cleanup ran. Attempt to update the D state document failed and left it empty. This is the reconstructed state; original committed history is retained below. Production code was not truncated.

Recovery: C:\Users\ZhouXuan\AppData\Local\Temp\edudev-v31-settings-final-20261126\RECOVERY\RECOVERY.json. Source snapshots, raw tracked patch, original failures, C-root product evidence and hashes are retained here. After freeing D disk space, first verify current branch/source/build against this manifest; restore this document, copy final C product report/screenshots to the evidence tree, preserve the failed D launch log, run checkpoint-integration.mjs, review and commit only this task. Do not reset, clean or overwrite collaborators.

Next: W2-C real A-to-B, subframe/navigation and await revocation; W2-E real configuration save/history/undo/conflict and SQLite/file readback; teacher/L2/history memory, permissions/tools/archive/backup; W2-B/F active Pi/draft/queue/focus/IME/DPI/performance. Original Pi settings UI scripts still require independent-window ownership adaptation without weakening assertions. See RUNTIME_INTEGRATION.md. Native 100/150% two displays observed; 125% not verified.

Budgets: W2-A3/8, W2-B1/8, W2-C4/8, W2-D2/8, W2-E0/8, W2-F0/8, W10 0/3. The storage failure does not reset these. All90 AC and36 LG remain not formally completed; SET-P0/MG/FG not PASS. No main merge.

## Historical foundation checkpoint

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
