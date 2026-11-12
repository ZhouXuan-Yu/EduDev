import {normalizeAiMissingRoleMarkers} from '../../shared/material-ai';

/** Shared by the live provider and local receipt recovery. No business fields are inferred. */
export function receivedAiContent(bytes: Uint8Array, format: 'provider-envelope.v1' | 'completion-content.v1'): string {
    if (bytes.byteLength > 1048576) throw Error('invalid_response');
    let raw: string;
    try {
        raw = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
        if (format === 'provider-envelope.v1') {
            const envelope = JSON.parse(raw);
            const choice = envelope?.choices?.[0];
            if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || choice.message.tool_calls)
                throw Error();
            raw = choice.message.content;
        }
        if (Buffer.byteLength(raw, 'utf8') > 128 * 1024) throw Error();
        const value = JSON.parse(raw);
        if (value && typeof value === 'object' && !Array.isArray(value) && value.type === 'json_object') {
            const {type: _, ...content} = value;
            raw = JSON.stringify(content);
        }
        return normalizeAiMissingRoleMarkers(raw);
    } catch {
        throw Error('invalid_response');
    }
}
