import { createHash } from 'node:crypto';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { normalizeCreateAgentSessionOptions } from './vendor/hana/lib/pi-sdk/session-options';
import { snapshotToolInvocationInput } from '../ai-harness/vendor/openhanako-tool-input-snapshot';

/** Reuse Hana execution-once per run, with bounded identities before its cache. */
export function createHanaRunToolScope(definitions: ToolDefinition[], limitsEnforced=true): ToolDefinition[] {
  const signatures = new Map<string, string>();
  const normalized = normalizeCreateAgentSessionOptions({ tools: [], customTools: definitions }, '1.0.2');
  const normalizedDefinitions: ToolDefinition[] = normalized.customTools;
  return normalizedDefinitions.map((definition): ToolDefinition => ({
    ...definition,
    execute: async (callId, args, signal, onUpdate, context) => {
      const failed = (code: string) => ({ content: [{ type: 'text' as const, text: code }],
        details: { schemaVersion: 'xiaozhi.office.tool.v1', tool: definition.name, success: false,
          error: { code, message: code, retryable: false } }, isError: true });
      if (signal?.aborted) return failed('cancelled');
      const snapshot = snapshotToolInvocationInput(args);
      if (!callId || callId.length > 128 || !snapshot.ok) return failed('invalid_input');
      const signature = createHash('sha256').update(JSON.stringify({ tool: definition.name, args: snapshot.value })).digest('hex');
      const previous = signatures.get(callId);
      if (previous && previous !== signature) return failed('conflict');
      if (limitsEnforced && !previous && signatures.size >= 256) return failed('budget_exhausted');
      signatures.set(callId, signature);
      return definition.execute(callId, snapshot.value, signal, onUpdate, context);
    },
  }));
}
