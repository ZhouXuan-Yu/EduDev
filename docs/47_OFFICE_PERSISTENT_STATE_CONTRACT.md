# Office 持久状态与复制审批交付合同

日期 2026-10-02，M01/M10，A01/A02/A07、C05 的独立准备。H05 未放行，暂不改生产 main/preload/UI 路由。

状态修订：用户随后要求重对齐教育定制、国内 API 直连，并明确选择 Pi SDK。本合同的 Codex 宿主实现停止；尚未建立 office_* 表或修改真实库。未验收的 SQLite 抽取文件已撤回。持久幂等/审批要求保留，按 docs/48–49 在 Pi 会话路径重新冻结，不能沿此旧合同继续扩建 CLI。

## 当前缺口与本轮结果

官方连接/Hana 工具/公开事件/复用 UI 已独立验收。仍缺持久单所有者、命令防重、run/turn 映射、教师审批及重启收敛。Hana approval-gateway 是审核策略、ZCode approval-gate 是预览收窄，均不能直接充当 SQLite 提交事实；不引入它们的第二模型/审查循环。

本轮复用当前 OmniEduStore 的 sqlite3 Promise 包装、串行事务队列与 BEGIN IMMEDIATE/条件 UPDATE 方式，在独立领域模块中建立以下记录，不继续堆 db.ts：

- office_schema、office_host_owner：增量 schema、自有 PID/token，第二活着的宿主不得接管；仅确认旧 PID 已退出后恢复。
- office_sessions、office_runs：provider/model 固定快照，私有 workspace/thread/turn 映射，单会话一个非终态运行。
- office_commands：commandId、规范化 payload hash、原 run ack；相同命令重试返回同一 ack，改 payload 拒绝，重启不自动重发模型请求。
- office_approvals：来源/目标/hash/call 身份不可变，accept/decline/expire 与复制执行 unclaimed/committing/committed/failed/uncertain 分开；旧 run/宿主批准不能写。
- office_state_events：有界公开状态事件及顺序；不存原始 prompt、key、engine RPC、hidden reasoning。

复制 journal 通过已复用 Hana adapter 的 approveCopy 回调与结果包装接入；保持独占复制/来源 recheck/readback。批准仅能认领一次。复制后、SQLite 读回记录前退出的窗口必须变 uncertain，不能自动重写、自动冒称 committed；后续 UI 显示待核验。

## 兼容/恢复/回滚

只加 office_* 表和专用迁移版本，不改 app.db user_version/旧表；未知未来 schema 拒绝启动。独立连接串行事务，其他业务连接不会插入本轮事务。全新库、含旧业务表的副本、重复迁移均验证；测试仅用明确的 test-results 子目录，不读取真实教师库。

close/旧进程退出将非终态 run 收敛 interrupted，未消费审批失效；committing → uncertain。活宿主不可被第二进程标为中断。原模型 history 仍由 engine 管理；本轮不复制 transcript 或实现自动效果重放。

## 验收与未做

专项必须覆盖重复发送/不同 payload、两个宿主竞争、跨会话审批、重复决定、取消迟到批准零写、复制一次 readback、来源冲突、真实子进程退出与不确定窗口、新库/旧库副本迁移、重启保持。实际 Electron-main 运行 SQLite/文件链路；build/renderer/diff 门禁。

本轮不新增生产 IPC，不自动初始化 Windows sandbox，不修改真实数据/全局 Codex；Office 完整编辑、投影持久缓存、恢复到新模型回合、完整 UI 与打包后续按台账逐项完成。不能仅凭数据库专项勾 A02/A07/C05 全部完成。
