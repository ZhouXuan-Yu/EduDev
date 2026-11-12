import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { createEnvironmentService } from './service';

export function createEnvironmentTools(sessionId: string, environment: ReturnType<typeof createEnvironmentService>): ToolDefinition[] {
  return [
    {name: 'environment_inspect', label: '检查本地环境', description: '检查平台、受管运行时、已授目录和非敏感配置。凭据缺失时使用模型与连接页安全输入。',
      parameters: {type: 'object', properties: {}, additionalProperties: false} as ToolDefinition['parameters'],
      execute: async () => ({content: [{type: 'text', text: JSON.stringify(await environment.inspect(sessionId))}], details: {success: true}})},
    {name: 'environment_repair', label: '修复本地配置', description: '按已授固定recipe修复本地环境。workspace_text生成UTF-8配置，expectedHash用environment_inspect的configuration.sha256。permission_runtime从内置源码配置本机受控helper，expectedHash用permissionRuntime.sourceHash。沿当前Grant、原Task和实际身份执行。',
      parameters: {type: 'object', additionalProperties: false, required: ['expectedHash'], properties: {
        recipe: {type: 'string', enum: ['workspace_text', 'permission_runtime']},
        expectedHash: {anyOf: [{type: 'string', pattern: '^[a-f0-9]{64}$'}, {type: 'null'}]}
      }} as ToolDefinition['parameters'],
      execute: async (_id, input) => {
        const args = input as {recipe?: 'workspace_text' | 'permission_runtime'; expectedHash: string | null};
        const result = args.recipe === 'permission_runtime'
          ? await environment.repairRuntime(sessionId, args.expectedHash || '') : await environment.repair(sessionId, args.expectedHash);
        return {content: [{type: 'text', text: JSON.stringify(result)}], details: {success: true}};
      }}
  ];
}
