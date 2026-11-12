# 04 — Capability Resolver

## 1. 职责

Resolver 将任务的 Capability Requirement 转换为合格 Provider 选择。它不是 Agent Loop，不负责独立规划完整任务，也不直接执行 Provider。

## 2. 输入

Requirement 包含 Capability ID、Contract 版本、当前任务的 Required/Optional/Conditional 要求、数据约束（如 local-only）、输出格式、质量要求和执行预算。

## 3. 解析流程

1. 查询本地 Registry。
2. 获取 Provider 候选和 Binding。
3. 执行确定性硬约束过滤。
4. 计算针对当前任务的 Conformance。
5. 在合格候选中排序。
6. 对语义复杂的候选交由 AI 辅助判断。
7. 校验 AI 选择仍属于合格集合。
8. 返回结构化 Resolution，不直接执行。

## 4. 硬约束（H-22）

以下项目不能由评分抵消：授权不足、Provider 撤销、来源/完整性验证失败、平台不兼容、Required 缺失、当前触发的 Conditional 缺失、未满足数据驻留约束、依赖不可解决、健康状态不可接受、预算不满足。

`readOnlyHint`、市场星级和 Provider 自声明不能单独作为安全依据。

## 5. 部分实现（H-20）

- Required 全满足是入选前提。
- Optional 缺失可接受，但在 Resolution 和最终结果中披露。
- Conditional 根据任务上下文计算；触发时缺失则排除。
- 不允许把近似能力描述成完全等价。
- 若只有部分实现，Pi 必须根据任务目标决定是否能调整计划；不得静默降低教师明确要求。

## 6. 排序建议

先硬过滤，再排序。可考虑：任务适用性/输出质量、验证可信度、稳定性、本地优先、延迟、资源成本、用户偏好。权重必须通过真实任务评测校准，不应将未经验证的固定权重当作事实。

用户固定 Provider 是偏好，不得覆盖撤销、权限和兼容性硬约束。

## 7. AI 参与方式

AI 只在 `eligibleProviders` 中判断语义适用性、任务适配、可接受缺口和 Provider 组合。系统必须验证 AI 返回的 Provider ID、缺口声明、权限和 Contract。AI 不可将被排除 Provider 重新放行。

## 8. Resolution 结果

```ts
interface CapabilityResolution {
  capabilityId: string;
  status: 'resolved' | 'partial' | 'missing' | 'blocked_permission' | 'blocked_dependency' | 'no_compatible_provider';
  selectedProviders: ProviderSelection[];
  alternatives: ProviderAlternative[];
  acceptedLimitations: string[];
  excludedProviders: ExclusionReason[];
  blockedReasons: BlockReason[];
  registryRevision: number;
}
```

不得只返回 null 或空数组；必须解释缺口和下一步可能行动。

## 9. Provider 回退（H-21）

当前任务可以切换；先核验原 Provider 和副作用，再选满足剩余任务要求的兼容 Provider。一次任务内的切换不自动改变长期默认。长期偏好更新需要足够真实样本、独立评估和回滚机制。

## 10. 验收

覆盖多 Provider、Required/Optional/Conditional、权限排除、撤销、部分能力披露、AI 越权选择拒绝、用户固定偏好和任务内回退。
