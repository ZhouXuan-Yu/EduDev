import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { CapabilityTaskRuntime } from './runtime';
import { providerErrorCode } from './provider-contract';
export const CAPABILITY_TOOL_NAMES = ['capability_inspect', 'capability_resolve', 'capability_execute'] as const;
const requirementSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        capabilityId: {
            type: 'string',
            maxLength: 160
        },
        contractVersion: {
            type: 'string',
            maxLength: 80
        },
        required: {
            type: 'array',
            items: {
                type: 'string',
                maxLength: 128
            },
            maxItems: 128
        },
        optional: {
            type: 'array',
            items: {
                type: 'string',
                maxLength: 128
            },
            maxItems: 128
        },
        conditions: {
            type: 'array',
            items: {
                type: 'string',
                maxLength: 128
            },
            maxItems: 128
        }
    },
    required: [
        'capabilityId', 'contractVersion', 'required', 'optional', 'conditions'
    ]
};
function requirement(raw: unknown) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).sort().join(',') !== 'capabilityId,conditions,contractVersion,optional,required') {
        throw Error('invalid_input');
    }
    return {
        ...raw,
        localOnly: true,
        platform: process.platform,
        budget: {
            latencyMs: 30000,
            resourceUnits: 1
        }
    };
}
export function createCapabilityDispatcher(runtime: CapabilityTaskRuntime): ToolDefinition[] {
    const definitions: ToolDefinition[] = [
        {
            name: 'capability_inspect',
            label: '查看已验证能力',
            description: '查看本地逻辑能力合同和要求。执行能力前使用 capability_resolve 解析当前任务的合格实现。',
            parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false
            } as ToolDefinition['parameters'],
            execute: async (_callId, args, signal) => {
                if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length) {
                    throw Error('invalid_input');
                }
                const value = await runtime.inspect(signal);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(value)
                        }],
                    details: {
                        success: true
                    }
                };
            }
        },
        {
            name: 'capability_resolve',
            label: '解析可用能力',
            description: '按稳定 Capability ID 和 Contract 解析当前任务合格的 Provider，保存版本快照并披露缺口。由宿主核对当前授权和来源。',
            parameters: {
                ...requirementSchema,
                properties: {
                    ...requirementSchema.properties,
                    refresh: {
                        type: 'boolean'
                    }
                }
            } as ToolDefinition['parameters'],
            execute: async (_callId, args, signal) => {
                if (!args || typeof args !== 'object' || Array.isArray(args)) {
                    throw Error('invalid_input');
                }
                const { refresh, ...request } = args as Record<string, unknown>;
                if (refresh !== undefined && typeof refresh !== 'boolean') {
                    throw Error('invalid_input');
                }
                const view = await runtime.resolve(requirement(request), signal, refresh === true);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(view)
                        }],
                    details: {
                        success: true
                    }
                };
            }
        },
        {
            name: 'capability_execute',
            label: '执行只读能力',
            description: '执行已验证的只读文件元信息能力。requirement 使用逻辑 Capability 合同，input 为 {path:相对路径}。宿主选择版本、核验当前任务及授权，返回统一结果与来源。',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    requirement: requirementSchema,
                    input: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            path: {
                                type: 'string',
                                minLength: 1,
                                maxLength: 500
                            }
                        },
                        required: ['path']
                    }
                },
                required: ['requirement', 'input']
            } as ToolDefinition['parameters'],
            execute: async (callId, args, signal) => {
                if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).sort().join(',') !== 'input,requirement') {
                    throw Error('invalid_input');
                }
                const raw = args as {
                    requirement: unknown;
                    input: unknown;
                };
                const value = await runtime.execute(callId, requirement(raw.requirement), raw.input, signal);
                const failed = !value.success || value.result.status === 'failed' || value.result.status === 'cancelled' || value.result.status === 'unknown';
                const payload = value.success ? value.result : value;
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(payload)
                        }],
                    details: {
                        success: !failed,
                        ...(value.success ? {
                            provider: value.result
                        } : {
                            error: value.error
                        })
                    },
                    isError: failed
                };
            }
        },
    ];
    return definitions.map(definition => ({
        ...definition,
        execute: async (...args) => {
            try {
                return await definition.execute(...args);
            }
            catch (error) {
                const code = providerErrorCode(error);
                return {
                    content: [{
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code,
                                    message: code,
                                    retryable: false
                                }
                            })
                        }],
                    details: {
                        success: false,
                        error: {
                            code,
                            message: code,
                            retryable: false
                        }
                    },
                    isError: true
                };
            }
        }
    }));
}
