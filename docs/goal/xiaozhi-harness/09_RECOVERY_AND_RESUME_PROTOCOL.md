# 09 — Recovery & Resume Protocol

## 1. 决策基线

- H-25：应用关闭后保留未完成任务，重新打开可继续。
- H-27：先核验旧 Provider，不可用时 Resolver 选择兼容 Provider。
- H-28：启动时自动恢复任务状态和诊断，在工作台展示继续入口；教师点击后才启动新 Run。
- H-29：审批持久化；重开后继续等待；授权条件变化时失效。
- H-30：启动时允许安全只读诊断，不自动产生副作用。
- H-31：教师拒绝后寻找替代方案、继续可完成步骤，不重复申请相同权限。

## 2. 启动恢复

初始化 SQLite → 恢复 Task/Run/Checkpoint → 将旧 active Run 标记为 interrupted → 检查 Effect Ledger → 执行白名单只读诊断 → 检查 Provider/权限/审批/Artifact → 生成 Task Presentation State → 工作台展示恢复入口。

启动诊断允许：检查本地文件存在、哈希、Artifact、已安装依赖版本、Provider 本地注册状态、授权记录。不得自动安装、写文件、连接未知服务、外发数据或启动原任务执行。

## 3. 教师点击继续

沿用 Task ID；创建新 Run ID 和 Generation；加载最近可靠 Checkpoint；reconcile 未完成 Effect；重新核验授权和审批；核验旧 Provider；必要时 Resolver 选兼容 Provider；创建新 Pi Session；提供结构化恢复上下文；只执行未完成步骤。

## 4. 恢复上下文

包括原始教师目标、计划和 revision、已完成/未完成步骤、已验证事实、Artifact 引用、Effect 状态、Capability Snapshot、Provider 版本、待审批事项、权限状态、剩余预算。JSONL 对话历史可作为辅助，不替代 SQLite 事实。

## 5. Provider 恢复（H-27）

优先核验原 Provider 的版本、来源、健康、撤销、权限和 Contract。不可用时，仅选择满足剩余任务要求的 Provider。Required 缺口不可静默降级；Optional 缺口必须披露；Conditional 根据任务重新判断。任务中途 Provider 切换需保存新 Snapshot 和原因。

## 6. 审批恢复（H-29）

审批记录在 SQLite 持久化。应用关闭/Session 重建不使其自动失效。重新打开后显示待审批卡片。批准后重新校验请求摘要、目标、Provider、权限范围、有效期、撤销状态和 Task；再创建新的执行 Admission。授权条件变化时相关审批失效。

## 7. Generation Fencing

每次恢复创建新 Run/Generation。旧 Run 的延迟回调不能更新 Task、写 Artifact 或提交 Effect。所有写入都核验当前 Owner、Generation 和 Revision。

## 8. Recovery Budget

限制恢复尝试次数、Provider 重复尝试、总耗时、模型调用、安装/配置尝试和副作用预算。超出预算保存状态并说明阻塞，禁止无限循环。

## 9. 任务状态与教师展示状态分离

内部状态由主进程映射为简单 UI 状态：可继续、等待授权、正在核对、能力暂不可用、部分完成、已完成、需要处理。前端不直接展示内部 Run/Generation/Effect 状态。

## 10. 验收

覆盖应用重启、待审批、权限变化、Provider 失效、Effect 未知、旧 Run 延迟回调、多个任务并行和多次重启；不得丢失成果或重复副作用。
