# 05 — Pi Runtime 与 Autonomy Layer 集成

## 1. 不可变原则

Pi SDK 是唯一 Agent Loop。Autonomy Layer、Resolver、Recovery、Marketplace 均为被 Pi 调用的宿主服务，不得启动第二个长期 Planner/Recovery Agent Loop。

## 2. 混合 Tool 接入（H-23）

- 核心教育业务继续使用明确 Tool Definition，保持工具语义清晰、Schema 可见、回归稳定。
- 动态外部能力通过有限 Bootstrap Tools / Dispatcher 入口。
- 两类入口共享 Registry、Permission Engine、Execution Boundary、Effect Ledger 和结果验证。
- 不把所有业务压缩成一个万能工具。

## 3. Bootstrap Tools 建议

`capability_inspect`、`capability_search`、`capability_resolve`、`capability_prepare`、`capability_verify`、`capability_activate`、`capability_execute`、`capability_health`、`task_checkpoint`、`task_resume`。这些是逻辑接口，实施前需按当前工具命名规范去重。

Bootstrap Tools 必须内置、稳定、可用；不能依赖一个可卸载 Skill 或外部 MCP 才能发现/安装其他能力。

## 4. 固定 Dispatcher 与动态 Provider

Pi 持有稳定 Dispatcher Definition。Dispatcher 每次调用时从本地 Registry 解析当前 Provider，再经过权限和执行边界调用。Provider 安装不意味着自动把任意新工具直接暴露给模型。

核心业务 Tool 仍可直接注册。Dispatcher 仅用于动态/外部能力和能力管理场景。

## 5. Session 初始化

创建 Pi Session 时：
- 读取 Task / Run / Capability Snapshot。
- 组装核心 Tool。
- 组装 Bootstrap Dispatcher。
- 载入符合当前权限和范围的 Skill 指令。
- 绑定稳定 taskId、runId、generation。
- 不将完整权限秘密写入模型上下文。

## 6. 动态能力获取

Pi 调用能力发现/准备流程；宿主验证来源、许可证、依赖、权限和隔离；安装成功后 Registry Revision 增加；当前任务在安全切换点重新解析。若 Dispatcher 能在同一 Session 内安全调用新 Provider，则保持 Session；否则在安全边界重建 Session，通过 SQLite 恢复同一 Task。

## 7. Pi SDK 版本核验

当前项目曾使用 `@earendil-works/pi-agent-core`、`pi-ai`、`pi-coding-agent` 1.0.2。执行时必须重新读取 package.json、lockfile、node_modules 类型和实现，确认活动 Session 是否支持动态更新工具定义/active tools。不得假设其他 Pi 版本 API。

## 8. Session JSONL 与 Task State

Pi JSONL 保存对话/工具消息历史；SQLite 保存任务事实、执行、授权、Artifact、检查点。Session 可重建，Task 不依赖 Session 存活。

## 9. 验收

- 没有第二个 Agent Loop。
- 核心 Tool 行为不回归。
- 新 Provider 可通过 Dispatcher 在任务安全点使用。
- Provider 撤销后新调用被阻止。
- Session 重建后原 Task、上下文摘要和成果保持一致。
