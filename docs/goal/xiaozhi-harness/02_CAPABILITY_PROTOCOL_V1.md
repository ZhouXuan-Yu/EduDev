# 02 — Capability Protocol v1.0

## 1. 目标

定义跨 Native Tool、Skill、MCP、Extension 和 Remote Provider 的稳定逻辑能力协议。Capability 定义“做什么”；Provider 定义“由谁实现”；Binding 定义“哪个实现提供这项能力”。

## 2. ID 规则（H-17）

- EduDev 核心 ID 使用 `edu.<domain>.<resource>.<action>`，例如 `edu.knowledge.document.read`、`edu.question.extract`、`edu.presentation.create`。
- 外部扩展使用 `mcp.<publisher>.<domain>.<action>` 或 `extension.<publisher>.<domain>.<action>`。
- 外部 Provider 如满足 EduDev 核心 Contract，可经验证映射到核心 ID，不得冒充官方发布者。
- 已发布 ID 不得随意更名；迁移需 Alias、兼容期和明确映射。

## 3. 三个分离对象

### Capability Definition

描述逻辑能力：ID、名称、领域、Contract 版本、输入/输出 Schema、Required/Optional/Conditional 要求、保证、限制、错误码、取消/幂等语义、平台兼容性、验证要求、生命周期。

### Provider Manifest

描述实现：Provider ID、类型、版本、发布者、来源、包哈希、运行方式、依赖、权限需求、暴露的工具、健康状态和验证证据。

### Capability Binding

描述 Provider 与 Capability 的映射：Contract 版本、Conformance 报告、适配器版本、启用状态、优先级、是否用户固定、验证时间。

## 4. Conformance（H-20）

要求分为：
- `required`：当前任务必须满足；任一缺失即不合格。
- `optional`：可缺失，必须在结果中披露。
- `conditional`：由当前任务条件决定；条件触发时必须满足。

Conformance 等级：
- `full`：所有当前适用要求满足。
- `partial`：Required 满足，但有 Optional 缺口，或未触发的 Conditional 缺口。
- `incompatible`：Required 或当前已触发的 Conditional 缺失。

每项支持声明需注明证据类型：Provider 自声明、Adapter 检测、自动测试、人工审核。自声明不得单独视为验证通过。

## 5. 建议 TypeScript 合同

```ts
interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  domain: string;
  contractVersion: string;
  inputSchemaRef: string;
  outputSchemaRef: string;
  requirements: {
    required: Requirement[];
    optional: Requirement[];
    conditional: ConditionalRequirement[];
  };
  guarantees: string[];
  limitations: string[];
  errors: CapabilityErrorDefinition[];
  constraints: {
    localPreferred: boolean;
    networkRequired: boolean;
    supportsCancellation: boolean;
    idempotency: 'idempotent' | 'keyed' | 'not_idempotent' | 'unknown';
  };
  lifecycle: { status: 'active' | 'deprecated' | 'revoked' };
}

interface CapabilityConformance {
  capabilityId: string;
  contractVersion: string;
  required: RequirementResult[];
  optional: RequirementResult[];
  conditional: RequirementResult[];
  limitations: string[];
  level: 'full' | 'partial' | 'incompatible';
  evidenceRefs: string[];
  verifiedAt?: string;
}
```

以上为逻辑合同草案，实施时须使用当前项目 Schema 校验库和类型规范，不得直接把 `object` 当作未验证输入。

## 6. 版本规则

- Capability Contract 版本与 Provider 软件版本独立。
- Provider 声明支持的 Contract 版本范围。
- 破坏性输入/输出变化提升 Major；向后兼容新增可选字段提升 Minor；修复不改变行为契约提升 Patch。
- 每个发布 Manifest 有内容哈希和来源签名/校验信息。
- Registry Revision、Catalog Revision、Session Snapshot Revision 分离。

## 7. 安全规则

- Manifest 中权限是需求声明，不是授权。
- Skill 不可写入或修改 Permission Grant。
- 外部命名空间不能声明自己为 EduDev Official。
- 撤销信息优先于旧缓存和旧 Snapshot。
- 不可信 Manifest 先解析为候选数据，不直接执行其中脚本。

## 8. 验收

- 核心 ID 稳定且有命名空间规则。
- 同一 Capability 可以关联多个 Provider。
- Required 缺失时 Resolver 必须排除。
- Optional 缺失时明确披露。
- Conditional 按任务条件判断。
- 外部 Provider 不得冒充官方。
- Manifest 通过 Schema 验证，版本和哈希可追溯。
