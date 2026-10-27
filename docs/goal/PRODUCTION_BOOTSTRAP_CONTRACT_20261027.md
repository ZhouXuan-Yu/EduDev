# 2026-10-27 生产启动读取收窄合同

状态：编码前冻结，已实现并完成最终专项/日常入口/历史兼容验收；模块 M01/M10/M12，保留现有产品与数据边界。额外UI合同指纹门禁仍失败，完整Goal未完成。

## 当前代码与消费者

- 审查报告 `docs/audit/ARCHITECTURE_PERFORMANCE_REVIEW_2026-10-23.md` 的 P1 在当前 App.tsx 仍成立：bootstrap effect 无条件执行，底部生产 early return 不阻止 hooks。
- `app:bootstrap` 返回 dataRoot/students/overview；students、activeStudent、records/reports 仍服务生产学生、训练、复盘等页面，保留原 typed 调用及选择/刷新行为。
- knowledgeOverview 仍供生产 renderAnalyticsView，aiConfirmations 仍供生产学习概览与 renderIntakeView，均保留启动读取。MaterialsWorkspace 自行读取并不意味着其他产品页无消费者。deepSeekSettings/form 只供旧设置/控制台；生产 PiSettingsWorkspace 自行读取。
- App 的 folders/sessions/pendingUserInput 只供旧控制台/设置；PiEducationWorkspace 自行加载会话。MaterialsWorkspace 的显式阅读辅导仍需 listAiConversations，不能删除共享 IPC。
- 当前日常启动器先 build，失败不启动旧 out；main 有单实例与构建变化 relaunch。旧 bootstrap 数据读取本身未发现切换 runtime 或版本页面的代码，不能据此宣称已复现用户的偶发旧版页面。

## 修改范围

1. App.tsx 启动 effect 等待 runtime 判定；production 与 failed 保留共享 bootstrap、知识概览和确认队列。legacy-test 保留旧读取原有顺序、状态与 pending input 恢复。最终逐页复核修正了初次消费者归类，学习概览/录入消费者的共享读取不可移除。
2. 仅修改该启动读取分支和专项回归；不删旧入口、typed preload/IPC，不迁移表/目录，不改权限、数据真源、provider 或页面布局，不抽拆整棵 App。
3. 回归覆盖 runtime 尚未确定、生产旧依赖失败、探测失败/重试、共享失败、legacy 读取/恢复、学生事实/重启与双视口。使用独立测试 profile/data，不写教师正式数据。
4. 同步 Goal 四份状态、稳定 CURRENT、协作四文件与前端覆盖矩阵。Master 的产品边界不变。

## 完成与回滚

- build、renderer-components、专项生产启动 Electron、现有 daily-entry、test:smoke、git diff --check，记录精确命令、通过/失败/skipped。
- 无 schema、wire shape、依赖或正式数据修改；回滚限于本片 App 分支/测试/文档。
- 不宣称全量 R2 性能验收、不承诺启动耗时收益，不包含1000轮历史/provider/新EXE/自然教师验收。偶发版本页面若未复现，保留为未验证边界。

## 实现与精确证据

工作根 `D:/WorkProject/EduProject`，开始时 main / fb6f37d，工作区干净。仅 App.tsx 的 bootstrap 分支和 effect 更改业务代码；共享 init/student/record/report/知识概览/确认队列、旧入口读取顺序、IPC/preload、订阅、宿主权限及启动器保留。专项脚本 `apps/desktop/scripts/production-bootstrap-ui.mjs` 通过真实 Electron/typed preload 调用现有 handler，在测试主进程计数/注入失败，无产品测试开关。非零知识/确认响应为本专项受控夹具，真实学生/记录事实另由daily-entry从UI创建并SQLite/重启验证。

`daily-entry-smoke.mjs` 原断言仍按已退出的五图标 aria-label 检查；本轮改按现有五组稳定 testid 检查，学习记录/学生导航也限定到当前侧栏，避免同名按钮。未改导航设计。源码发现部分图谱调用未响应，停止后仅对已定位源码做定向读取；未以图谱替代当前源码。

所有下列 npm/node 命令工作目录均为 `D:/WorkProject/EduProject/apps/desktop`，精确日志位于该目录的 test-results：

| 命令 | 实际结果 | 证据 |
|---|---|---|
| `npm.cmd run build` | 首次 exit1，D: node_modules 缺已锁定的 yauzl/@types/yauzl；补齐同版本后 exit0；最终共享消费者修正构建由下述 test:smoke 中相同 build 命令执行通过，含 tsc --noEmit | production-bootstrap-build.log / production-bootstrap-build-final.log / production-bootstrap-smoke-final.log |
| `npm.cmd run test:renderer-components` | 最终源码 exit0，240/240，0失败/0 skipped | production-bootstrap-renderer-final.log |
| `node scripts/production-bootstrap-ui.mjs` | 最终构建 exit0，9/9，0 rendererErrors，0 skipped；会话列表严格1次断言 | production-bootstrap-qS354X/report.json、production-bootstrap-ui-shared-final.log |
| `npm.cmd run test:daily-entry` | 最终构建 exit0，8/8，2启动、6截图、0 rendererErrors、0 skipped；1366×768/1920×1080及两种系统色彩偏好，学生/记录SQLite冷启读回 | daily-entry-MsgZeD/report.json、production-bootstrap-daily-shared-final.log |
| `npm.cmd run test:smoke` | 最终共享消费者修正构建及完整历史兼容回归exit0；ok=true，30名隔离学生，207/207，0失败；脚本不输出skipped字段 | production-bootstrap-smoke-final.log（含最终build、完整JSON汇总和截图路径） |
| `npm.cmd run test:ui-contracts` | exit1，17项先通过，CSS登记指纹失败，中止后续项 | production-bootstrap-ui-contracts.log |
| `git diff --check`（仓库根）；另对两个新文件运行 `git diff --no-index --check -- /dev/null <path>` | exit0，无空白错误；只有既有autocrlf换行提示 | 本轮终端记录；新文件分别为production-bootstrap-ui.mjs及本合同 |

两套最终 Electron 报告均指向同一 out 指纹 `7afdb7986f1596e7ced370ce7312c662d5f63394e77614a011142ae609a76b90`；main SHA256 `637d1ea68ec3b6741bf276513d10a386c55b29e0dc97401c467bd2ff533a2278`（main未改，不能用此hash单独代表renderer更改）。生产首次采样：1次共享 app:bootstrap、knowledge:getOverview和aiConfirmations:list各1次、1次Pi-owned aiConversations:list；settings:getDeepSeek和ai:deepTutorListPendingInputs均0。探测未决时只有runtime探测，无bootstrap。显式legacy采样保留全部旧读取与待输入恢复。新增从生产导航进学习概览，实际显示7资源/11切片/13节点/17边和1待确认动作；不把这些受控数值冒充真实教师业务事实。未向真实provider发任务。

最终完整smoke退出后重新计算out指纹，仍为上述7afdb798，说明9项专项、8项日常入口和207项兼容回归针对相同最终产物。207项是显式legacy-test历史兼容路径，不冒充全部当前Pi页面或真实provider验收。本轮无提交/push，也未发布安装包。

UI合同失败已核 `heroui-oss.min.css` 的 HEAD与磁盘SHA均为 `4d7cc0ccc2b0ac66df4d38a60ffdfbdcce14f30a449cc4cf7f63299e90e27059`，登记值为 `b614566361d0c79a595efa54d8b92bbc3903b32cb514768d6219c9d5627e5e4d`。该文件/登记文件均非本轮改动，未更新基线掩盖失败。

保留首次反例：修改前 out 专项在探测未决时已调用 app:bootstrap/knowledge:getOverview（production-bootstrap-JLkgvn/report.json）。专项初版在导航清空提示后仍等待旧提示超时（yNVW1I），修为实际状态/精确注入时机；初版legacy fixture使用嵌套临时目录不满足既有authority而正确留在Pi（ikLG1N），改用两个既有规则允许的独立omni-edu临时根。daily首次旧aria-label断言失败记录在daily-entry-T5dQva。无产品绕过或放宽权限。

消费者复核纠正：中间实现曾把knowledgeOverview和aiConfirmations误归为纯旧状态；逐页核对PRODUCT_PAGES→renderAnalyticsView/renderIntakeView后恢复两项共享读取，再补非零消费者回归。e7ywUP/SZ8PCw的8项报告及f623f9af构建只代表该中间状态，不能作为最终交付。相应中间综合smoke在完成前停止了本测试进程树（production-bootstrap-smoke.log），不是通过或失败结论；最终重新build并执行完整smoke。

环境修复：常规 `npm.cmd install --ignore-scripts --no-audit --no-fund --package-lock=false` 无进展后停止该进程；从本机 beca 工作树已安装目录补齐缺失 yauzl3.4.0 / @types/yauzl3.4.0 / pend1.2.0，未改package.json/lock，也未新增依赖版本。

## 未验证边界

本片只验收生产启动读取隔离与既有学生/会话路径；用户偶发“不同版本页面”未复现，也未证明与旧bootstrap因果相关。已验证的是当前 out 的file renderer、污染旧URL/flag不选旧runtime、同构建单实例及冷启；未运行真实日常profile、旧已开窗口遇新构建的relaunch、新EXE/安装快捷方式、真实provider、1000轮历史和性能P50/P95。UI合同指纹失败仍待独立处理。完整Master保持ACTIVE。
