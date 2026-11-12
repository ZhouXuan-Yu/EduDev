# 10 — Autonomy & Permission Engine

## 1. 目标

让教师选择简单的自主模式，小智在授权范围内最大程度自主行动；所有实际权限由主进程 Permission Engine 控制。模式决定默认策略，不是模型提示词。

## 2. 用户模式

- 标准模式：已有授权能力自动使用；新增权限/高风险行为申请。
- 高自主模式：主动发现、准备、配置、恢复；缺少权限时集中申请。
- 完全授权模式（H-15）：在教师明确授予的广泛工作目录、命令、网络、依赖、MCP、文件等范围内自主执行，不重复询问范围内常规操作。

具体模式名称和当前 UI 应先审计，不得擅自替换已有权限模式。

## 3. 权限维度

filesystem roots / read-write-delete、process command allowlist、network destinations、dependency installation sources、MCP server/tool scopes、Extension install/run、external data egress、secrets references、student/teacher data scopes。各维度独立表达、可审计、可撤销。

## 4. 核心原则

- 完全授权不是无限系统权限。
- 已授权范围内常规操作不重复弹窗。
- 越出范围必须申请。
- Skill/Provider/MCP annotations 只能声明需求，不能授予权限。
- AI 不得决定自身是否有权限。
- 授权撤销优先于旧 Snapshot 和旧审批。
- 数据外发需明确目的地、数据类别和任务范围。
- 付费/资金、不可逆删除、敏感数据外发等按独立高风险策略处理。

## 5. 审批模型

Approval 绑定 taskId、runId、action、target、scope、providerId/version、requestDigest、permissionSnapshotHash、data classification、有效期、状态和审计记录。批准不等于直接执行；执行前重新校验。

审批范围建议：当前操作、当前任务、持续授权。不得将一次性批准默认升级为永久授权。

## 6. 审批失效

目标、请求摘要、权限范围扩大、Provider 来源或影响安全的版本/Schema 变化、授权撤销、审批过期、任务取消时，相关审批失效。无关设置变化不应使所有审批失效。

## 7. 拒绝处理（H-31）

记录拒绝；同一任务不重复申请同一权限；Resolver 寻找更低风险替代；继续无关步骤；确实无法完成时说明具体阻塞。任务实质变化、出现更低风险方案或教师主动要求时可重新提出。

## 8. 集中申请

尽量将一个任务所需的相关权限合并为一份易懂申请，但高风险数据外发等事项必须单独清晰呈现。说明：要做什么、为什么需要、访问什么数据/资源、持续多久、拒绝后的替代方案。

## 9. 安全执行

Permission Engine 位于主进程/可信宿主边界。Renderer 和模型不能直接授予权限。所有 Tool/Provider 调用通过统一执行门禁，记录 grantId 和实际资源。撤销应尽快取消或阻断受影响操作。

## 10. 验收

完全授权范围内不重复询问；越权被拒；撤销即时生效；拒绝后有替代路径；审批绑定资源和摘要；重启后审批仍在；权限变化使相关审批失效。
