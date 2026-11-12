# 03 — Provider Contract

## 1. 目标

让 Native、MCP、Extension、Remote 等不同实现以统一方式被 Registry 发现、被 Resolver 选择、经宿主授权后执行，并返回可审计结果。

## 2. Provider 生命周期

`discovered → evaluating → verified → installed → configured → ready → degraded / unavailable → disabled / revoked`。

`pending_approval` 和 `blocked_dependency` 是阻塞原因/状态，不得与 `ready` 混淆。连接成功不代表安全验证通过；安装成功不代表功能验证通过。

## 3. Provider 逻辑接口

```ts
interface CapabilityProvider {
  describe(): ProviderManifest;
  initialize(context: ProviderInitContext): Promise<void>;
  inspect(): Promise<ProviderInspection>;
  healthCheck(): Promise<ProviderHealthReport>;
  verify(requirement: CapabilityRequirement): Promise<CapabilityConformance>;
  execute(request: CapabilityRequest, context: ProviderExecutionContext): Promise<CapabilityExecutionResult>;
  cancel(executionId: string): Promise<CancelResult>;
  dispose(): Promise<void>;
}
```

MCP 等外部协议不必原生实现 TypeScript Interface，必须通过 Adapter 转换。

## 4. Provider Execution Context

至少包括：taskId、runId、stepId、callId、AbortSignal、Capability Snapshot、Registry Revision、权限 Grant 引用、幂等键、执行预算。不得传递明文秘密到不需要的 Provider。

## 5. 统一结果

```ts
interface CapabilityExecutionResult<T = unknown> {
  executionId: string;
  capabilityId: string;
  providerId: string;
  status: 'completed' | 'partial' | 'failed' | 'cancelled' | 'unknown';
  data?: T;
  artifacts: ArtifactReference[];
  conformance: { level: 'full' | 'partial'; missingRequirements: string[] };
  sideEffects: { status: 'none' | 'known' | 'unknown'; references: string[] };
  error?: { code: string; message: string; retryable: boolean };
  provenance: { providerVersion: string; contractVersion: string; registryRevision: number };
}
```

Provider `completed` 仅表示 Provider 执行结束，不代表教师成果已通过独立验证。

## 6. 错误协议

标准错误码至少覆盖：`invalid_input`、`permission_denied`、`missing_dependency`、`provider_unavailable`、`timeout`、`rate_limited`、`invalid_output`、`side_effect_unknown`、`capability_revoked`、`cancelled`、`budget_exceeded`。

错误必须携带 retryable、side-effect 状态和可追溯执行 ID。不能只返回自然语言字符串。

## 7. 六项执行约定

1. 输入按 Capability Contract 校验。
2. 输出由 Adapter 规范化，并保留原始来源引用。
3. 取消必须如实报告；不支持真正取消的 Provider 不得谎称已停止。
4. 写操作明确幂等语义；未知状态先核验，不盲目重试。
5. 每次执行记录 Provider ID、版本、Contract 版本和任务关联。
6. 权限声明只是需求，实际执行必须经 Permission Engine 和 Execution Boundary。

## 8. Adapter 职责

- Native Adapter：包装现有 Tool，不复制业务逻辑。
- MCP Adapter：复用现有 MCP Runtime 连接、Schema、信任和撤销逻辑。
- Extension Adapter：在受控隔离环境中加载扩展，不允许不可信代码进入 Electron 主进程。
- Remote Adapter：处理身份、网络、超时、重试和数据外发边界。

## 9. 验收

- 所有 Provider 返回统一结果结构。
- Provider 健康、Conformance、权限和来源分离。
- 取消、超时、幂等和副作用状态可测试。
- Provider 不能自行写 Registry 或授予权限。
- 旧 Tool 通过 Adapter 接入后行为回归不变。
