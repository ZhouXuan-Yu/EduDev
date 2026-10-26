# HARNESS-SHUTDOWN-PENDING-01：退出诊断交付合同

2026-10-21，M10/M12，H03/H04/H10。状态 LIMITED_ACCEPTED（仅本合同三种优雅退出/冷启范围）。

## 本轮冻结范围

教师可见目标：等待文件保存确认时关闭小智，不崩溃、不自动保存；重启保留真实中断状态，不能重放模型、工具或审批。原 sZkM7V 超时收尾日志永久保留，不从日志猜根因。

先复用冻结 85e235ee 构建，逐项核源文件 hash 与实际加载路径；独立 profile/data/workspace、合成公开文字、明确内存 SSE 模型，不用真实密钥或公网模型。真实 Pi → Hana 读取 → 文件审阅 → typed preload/UI → SQLite/journal/native，等待可见待审批但绝不批准。分别执行普通 BrowserWindow.close 和 Playwright app.close，记录子进程 exit/close code、时间、stderr、生命周期资源、待审记录、Task/Goal/owner/receipt；冷启核零重放和零输出文件。正常关窗不等于框架强杀，分别归因。

若重现，保留红报告再改现生命周期边界；不引入新循环、依赖、IPC、DDL或私有数据迁移。源码改动须冻结新隔离构建，重复同一失败路径及生命周期边界、renderer、type/build、关键路径 smoke。若未重现，只记录对应配置未复现，原 case 归因仍 OPEN，不以有限绿测抹去旧 fatal。

本轮不覆盖真实 provider、NET/IMG/FILE、日常 profile、无 VPN、Office/WPS 或真人验收；不改配置、凭证、网络或真实资料，不关闭用户实例。读回真实未知效果不自动重试。先有证据再决定是否需要生产修改。

## 完成定义与恢复

两种关闭路径均从同一真实 pending 进入；正常退出码、无 native fatal、无挂起、无文件，journal/hash/状态与冷启一致且无伪 running。任一失败保留原报告和数据库，缺失/超时不算通过。诊断脚本、精确命令、源码与构建指纹和分层结论必须落盘。回滚仅撤测试入口/本轮明确生产改动，保留失败证据和已存资料；整体 Goal 仍 ACTIVE。

## 实测失败与本次修复面

85e 原构建：zfqH5F 普通关窗/冷启通过；框架关闭退出134，复现napi_throw。AyGfrb直接app.quit同样退出134，排除仅测试连接断开的解释。修改main/index.ts在现有生产者关闭后显式await store.close，复用现sqlite3回调关闭，不改数据/IPC/依赖；构建指纹增加main/index.ts与db.ts。此为待验证修复，不能提前称根因已完全证明。测试扩为window/framework/直接quit三种，同一pending与冷启零重放标准。

首修0e644d的FclsPW保留红：关闭调度的inspector回复被GC；收尾日志还暴露store.close后界面snapshot/list访问已释放db。故补main-only desktop-ipc-lifetime准入/在途drain、关闭本应用窗口后再关db，重复before-quit不能提前退出。IPC通道/参数/typed preload不变，无新依赖/DDL；独立测试在途事务、重入关闭、失败与原EventEmitter行为。观察GC只在原进程实际退出时记录，不重复派发关闭动作；失败报告不改绿。

## 最终限定结果

状态LIMITED_ACCEPTED，仅HARNESS-SHUTDOWN-PENDING-01三种优雅退出。原85e构建zfqH5F框架关闭、AyGfrb直接quit均退出134并复现napi_throw；首修FclsPW暴露store关闭后的snapshot/list读已释放db。原失败报告/数据库/日志保留。main通过desktop-ipc-lifetime停止新请求并等待已准入IPC，关闭本进程窗口、取消/结束生产者，再await SQLite close；重复before-quit等待同一清理，不提前放行。typed IPC参数/Pi唯一循环不变，无新依赖或DDL。

最终冻结b167b93bfb2e2953dd55c435e68b5ec1044b0eb1cba9f26f0b5f3b6041a0a8d1，373文件/147唯一源码，原npm隔离build全hash相同。正式Pi/Hana Electron aXRlOC10/10：正常关窗、框架关闭、直接quit均真实pending起步/不批准/退出0/冷启零重放；本轮pending退出274–643ms。独立每案46条连续hash事件、3回执/2任务准入、0教师批准动作、待审稿interrupted revision1、Task/Goal中断、native/源文件不变且无输出。保存回执保留admitted/uncertain，不伪造settled成功。

正常读取→新教师审批保存→成果确认→冷启及同源停滞回归l8hZXM7/7；IPC5、lifecycle5、tool-bound17、renderer234/234、同构建legacy207/207、type/npm build通过。legacy只证历史兼容，模型明确SSE夹具，0新增真实provider请求。待审界面及代表性浅暗/双尺寸图已看，不宣称新增UI设计验收。证据见apps/desktop/test-results/goal/harness-shutdown-20261021-ipc-drain/{commands.ps1,progress.json,collect.mjs}。worktree diff0，cached diff2仍为三个原有无关staged EOF空行；日常out/profile、凭证/网络未改，无提交/push。

下一步回H05纯教学草稿/教师补充输入的合法进展策略，先冻结来源/验证合同与实际Pi实例，不把新措辞或plan版本当进展；歧义旧task迁移仍OPEN。完整H05、原NET/IMG/FILE/真实provider、H06–H10/公网MCP/无VPN/安装、教学PPT动画-WPS/真人教师均未完成；任意挂起IPC/强杀不由本片证明。Goal ACTIVE。
