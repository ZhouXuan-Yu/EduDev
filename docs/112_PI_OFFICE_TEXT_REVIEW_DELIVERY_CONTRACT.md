# P07-A2/A3 正式文本工具、教师审阅与撤销交付合同

日期：2026-10-04；M10/M01。承接109/110/111，A1为已验收基础，完整A尚未通过。用户最新方向保持：嵌入Pi/Hana，自己接中国API；教育办公任务，Codex公开分段过程及工作区参照67原R1/R2。三元题组暂停。无新依赖、CLI或第二执行循环。

## 目标与真实缺口

已有Pi原编辑/写入算法、持久before/after/CAS/原diff、授权路径、退出恢复及20项基础实例。页面尚不能发起或审阅这些修改。本轮贯通原SDK工具→主进程等待/审批→typed preload→原Pro过程卡与差异审阅→真实文件→撤销/核验。公开过程只来自真实消息和工具，不展示私有推理。

## 修改范围与约束

1. shared变化摘要不携带before、after、diff、patch；完整本地审阅仅会话归属与目录授权通过后按需读取。renderer决定只含会话/change ID、revision、动作。
2. 新主进程text-change-coordinator/API组合A1 service，复用SessionExecutionRegistry、Hana execution-once、Pi budget.wait及原确认协调方式。等待安装在事件发布之前；停止/关闭/结束使pending/approved失效。拒绝零写；批准后的再次版本校验和执行结果据实发布。模型只接收必要安全回执，不自动收到before/diff或原整库。
3. 正式office_create_text/office_edit_text仅教师已选目录可用；目前限64KiB UTF8 .md/.txt、既有父目录。native JSONL追加独立office-text.v1能力标记；不重写既有创建/控制/记忆/技能身份指纹。未知版本fail closed。
4. host每次权限读取检查会话未归档、目录授权及运行归属。教师undo/verify使用全局空闲任务锁，关闭等待已开始任务，不允许与模型/设置/换目录并行。review只读；默认不打开真实教师目录。
5. IPC只主窗口主frame；拒绝越会话、额外参数、旧revision、伪造路径/正文。新增领域文件承担协调和API，既有host仅接线。
6. renderer复用已登记的原ChatTool、CodeBlock、Tabs/Button/FileTree等；不修改原Pro源。显示待确认、已保存、拒绝、停止、冲突、不确定、核验、已撤销实际状态。打开文件使用现有工作区组件及当前目录版本校验。无静态diff或伪造文件交付。

## 兼容与恢复

新增表已A1增量迁移；不改业务表、不删除旧工具或旧入口。新能力独立版本记录，旧native快照仍按旧算法验证。SQLite/文件不是同事务，intent之后退出只能不确定→教师只读核验，不能自动重放。undo仅当前文件仍等于本次after时恢复before/删除本次新文件；手工修改冲突保留现场。A1已声明外部进程最终hash至rename的狭窄竞态边界，不夸大为OS文件CAS。

## 完成定义与实例

先类型/构建、协调/API专项、A1 20项，再从小智页面用真实DeepSeek自然任务执行：待确认审阅/拒绝零写；批准create/edit实际hash及打开；撤销回读；手工修改冲突；停止等待/重启不重放；旧revision/越会话/主frame边界；native旧指纹保持。actual1366×768与1920×1080可达，原copy/模型/压缩兼容专项、renderer/原Pro及主smoke按具体风险运行，最后git diff --check。真实provider失败单独记录，不以确定性替身冒充。

精确命令、通过/失败/skipped、原日志/截图/source hash写113及四根/26/28/35/67。完整A未通过继续A，不提前做109 B Office/PDF；A通过后依次B/C/D/E和P08。总目标保持active，本轮不提交/push、不改系统代理/VPN/DNS、不上传学生原资料。
