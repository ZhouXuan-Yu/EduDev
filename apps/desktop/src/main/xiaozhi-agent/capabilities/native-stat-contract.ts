import { CAPABILITY_SCHEMA, type CapabilityDefinition } from './types';
import { validFileRequest } from '../workspace-files';
import { XIAOZHI_FILES_SCHEMA } from '../../../shared/xiaozhi-files';
export const NATIVE_STAT_PROVIDER_IDS = ['edu.native.hana-file-stat', 'edu.native.workspace-file-stat'] as const;
export const NATIVE_STAT_CAPABILITY: CapabilityDefinition = {
    schema: CAPABILITY_SCHEMA,
    id: 'edu.workspace.file.stat',
    name: '本地文件元信息',
    description: '读取当前授权工作区的文件路径、大小和版本',
    domain: 'workspace',
    contractVersion: '1.0.0',
    inputSchemaRef: 'native-stat.ts#validStatInput',
    outputSchemaRef: 'native-stat.ts#validStatOutput',
    requirements: {
        required: [{
                id: 'file_metadata',
                description: '提供真实文件相对路径、大小和版本'
            }],
        optional: [{
                id: 'mime',
                description: '提供文件 MIME 类型'
            }],
        conditional: [{
                id: 'mime_required',
                description: '任务明确要求 MIME 时提供类型',
                condition: 'require_mime'
            }]
    },
    guarantees: ['main_workspace_authority', 'readonly', 'file_version'],
    limitations: [],
    errors: [
        'invalid_input', 'permission_denied', 'provider_unavailable', 'capability_revoked', 'cancelled', 'changed', 'not_found', 'invalid_output'
    ],
    constraints: {
        localPreferred: true,
        networkRequired: false,
        supportsCancellation: true,
        idempotency: 'idempotent'
    },
    platforms: ['win32', 'darwin', 'linux'],
    lifecycle: {
        status: 'active'
    }
};
export type NativeStatInput = {
    path: string;
};
export type NativeStatOutput = {
    path: string;
    size: number;
    version: string;
    mime?: string;
};
export function validStatInput(value: unknown): value is NativeStatInput {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !Object.prototype.hasOwnProperty.call(value, 'path')) {
        return false;
    }
    return validFileRequest({
        schemaVersion: XIAOZHI_FILES_SCHEMA,
        sessionId: 'aisession_00000000-0000-0000-0000-000000000000',
        requestId: 'xifile_00000000-0000-0000-0000-000000000000',
        path: (value as NativeStatInput).path
    }) && (value as NativeStatInput).path !== '.';
}
export function validStatOutput(value: unknown): value is NativeStatOutput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const output = value as NativeStatOutput;
    const knownFields = Object.keys(value).every(key => ['path', 'size', 'version', 'mime'].includes(key));
    const validPath = validStatInput({path: output.path});
    const validSize = Number.isSafeInteger(output.size) && output.size >= 0;
    const validVersion = typeof output.version === 'string' && /^[a-f0-9]{64}$/u.test(output.version);
    const validMime = output.mime === undefined
        || typeof output.mime === 'string' && output.mime.length > 0 && output.mime.length <= 128;
    return knownFields && validPath && validSize && validVersion && validMime;
}
