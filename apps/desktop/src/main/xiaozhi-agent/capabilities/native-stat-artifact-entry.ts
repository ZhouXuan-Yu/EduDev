import { randomUUID } from 'node:crypto';
import { createHanaOfficeTools } from '../../office-agent/hana-tool-adapter';
import { createWorkspaceFiles, fileVersion, type WorkspaceLease } from '../workspace-files';
import { XIAOZHI_FILES_SCHEMA } from '../../../shared/xiaozhi-files';
import { validStatInput, validStatOutput, type NativeStatOutput } from './native-stat-contract';
export { validStatInput, validStatOutput };
/** This entry and its local imports form the immutable executable artifact. */
export async function executeNativeStat(kind: 'hana' | 'workspace', context: {
    sessionId: string;
    runId: string;
    callId: string;
    signal: AbortSignal;
    lease: WorkspaceLease;
    resolveWorkspace: (sessionId: string) => Promise<WorkspaceLease>;
}, input: unknown): Promise<NativeStatOutput> {
    if (!validStatInput(input)) {
        throw Error('invalid_input');
    }
    context.signal.throwIfAborted();
    let data: NativeStatOutput;
    if (kind === 'hana') {
        const tools = createHanaOfficeTools({
            workspace: context.lease.path,
            sessionId: context.sessionId,
            runId: context.runId,
            networkAllowed: false,
            fileVersion
        });
        const result = await tools.execute('office_file_stat', context.callId, input, context.signal);
        if (!result.success) {
            throw Error(result.error?.code || 'provider_unavailable');
        }
        const output = result.data;
        if (!output || output.isDirectory) {
            throw Error('invalid_input');
        }
        data = {
            path: String(output.source).split('\\').join('/'),
            size: output.size as number,
            version: output.version as string,
            ...(typeof output.mime === 'string' ? {
                mime: output.mime
            } : {})
        };
    }
    else if (kind === 'workspace') {
        const files = createWorkspaceFiles(context.resolveWorkspace);
        const result = await files.stat({
            schemaVersion: XIAOZHI_FILES_SCHEMA,
            sessionId: context.sessionId,
            requestId: 'xifile_' + randomUUID(),
            path: input.path
        }, context.signal);
        if (!result.ok) {
            throw Error(result.error);
        }
        data = {
            path: result.data.path,
            size: result.data.size,
            version: result.data.version
        };
    }
    else {
        throw Error('invalid_input');
    }
    context.signal.throwIfAborted();
    if (!validStatOutput(data)) {
        throw Error('invalid_output');
    }
    return data;
}
