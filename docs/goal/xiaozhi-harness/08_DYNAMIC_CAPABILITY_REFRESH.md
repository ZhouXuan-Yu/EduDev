# 08 — Dynamic Capability Refresh

## 1. Revision 分层

- Catalog Revision：官方/外部目录定义变更。
- Registry Revision：本地 Provider、Binding、安装/撤销状态变更。
- Session Capability Snapshot：当前 Task/Run 实际选择的 Provider 和版本。

目录同步不得直接覆盖本地授权、用户偏好或实际健康状态。

## 2. Snapshot

保存 snapshotId、taskId、runId、registryRevision、selectedProviders（capabilityId/providerId/providerVersion/contractVersion）、创建时间和证据引用。Snapshot 是历史事实，不是永久授权；每次执行仍要实时检查撤销和权限。

## 3. 刷新触发

- 与当前任务无关的新 Provider：不刷新。
- 当前任务缺少的 Provider 已验证并激活：在安全点刷新。
- 普通 Provider 升级：当前任务保持旧版本，新任务可选择新版本。
- Provider 撤销/权限撤销：立即阻止受影响的新调用。
- 健康状态恶化：重新解析。
- 新阶段开始：可重新检查能力。

## 4. 安全切换点

不得在有副作用操作执行中途切换 Provider。等待当前 Effect 完成或完成 reconciliation；校验新 Provider 的 Contract、Conformance、权限和数据约束；记录新 Snapshot；保留已完成成果和旧执行证据。

## 5. Pi 集成

首选稳定 Dispatcher 在调用时解析 Registry。核心业务 Tool 继续明确注册。若当前锁定 Pi SDK 无法保证同一 Session 的动态工具行为，则在安全点重建 Session，并从 SQLite 恢复同一 Task；不得假设热更新 API 存在。

## 6. 撤销优先

Revocation 和 Permission Grant 撤销优先于旧 Snapshot。缓存、Session 或模型上下文不得绕过实时宿主校验。

## 7. 验收

测试新增无关 Provider、任务所需 Provider、新版本、撤销、权限变化、活动写操作期间刷新、Session 重建和离线 Registry Revision。
