import path from 'node:path';
import { createEditToolDefinition, createWriteToolDefinition, generateDiffString, generateUnifiedPatch,
  type ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { XiaozhiTextProposalInput } from '../../shared/xiaozhi-changes';
import { snapshotToolInvocationInput } from '../ai-harness/vendor/openhanako-tool-input-snapshot';

export const MAX_CHANGE_BYTES = 65536;
export const MAX_CHANGE_DIFF_BYTES = 524288;
export function changeText(bytes: Buffer): string {
  if (bytes.length > MAX_CHANGE_BYTES) throw new Error('too_large');
  try { new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('unsupported'); }
  const text = bytes.toString('utf8');
  if (text.includes('\0')) throw new Error('unsupported');
  return text;
}
export function textProposalInput(raw: unknown): XiaozhiTextProposalInput {
  const frozen = snapshotToolInvocationInput(raw);
  if (!frozen.ok || !frozen.value || typeof frozen.value !== 'object' || Array.isArray(frozen.value)) throw new Error('invalid_input');
  const v = frozen.value as Record<string, unknown>;
  const allowed = v.operation === 'create' ? ['operation', 'path', 'content'] : ['operation', 'path', 'edits'];
  if (!['create', 'edit'].includes(String(v.operation)) || Object.keys(v).some(key => !allowed.includes(key))
    || typeof v.path !== 'string' || !v.path || v.path.length > 500) throw new Error('invalid_input');
  if (v.operation === 'create') {
    if (typeof v.content !== 'string') throw new Error('invalid_input');
    changeText(Buffer.from(v.content));
  } else {
    if (!Array.isArray(v.edits) || !v.edits.length || v.edits.length > 16) throw new Error('invalid_input');
    for (const edit of v.edits) {
      if (!edit || typeof edit !== 'object' || Array.isArray(edit) || Object.keys(edit).some(key => !['oldText', 'newText'].includes(key))
        || typeof edit.oldText !== 'string' || !edit.oldText || typeof edit.newText !== 'string') throw new Error('invalid_input');
      changeText(Buffer.from(edit.oldText)); changeText(Buffer.from(edit.newText));
    }
  }
  return v as XiaozhiTextProposalInput;
}

/** Execute original Pi tools against memory operations. No real filesystem writes. */
export async function prepareTextEdit(root: string, input: XiaozhiTextProposalInput, before: Buffer | null,
  callId: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const file = path.resolve(root, input.path);
  let after: Buffer | undefined;
  const capture = async (absolute: string, content: string) => {
    if (absolute !== file || after) throw new Error('configuration');
    after = Buffer.from(content, 'utf8'); changeText(after);
  };
  if (input.operation === 'edit') {
    if (before === null) throw new Error('not_found');
    changeText(before);
    const tool = createEditToolDefinition(root, { operations: {
      access: async absolute => { if (absolute !== file) throw new Error('permission_denied'); },
      readFile: async absolute => { if (absolute !== file) throw new Error('permission_denied'); return Buffer.from(before); },
      writeFile: capture,
    } });
    await tool.execute(callId, { path: input.path, edits: input.edits }, signal, undefined, undefined as unknown as Parameters<ToolDefinition['execute']>[4]);
  } else {
    if (before !== null) throw new Error('conflict');
    const tool = createWriteToolDefinition(root, { operations: {
      mkdir: async dir => { if (dir !== path.dirname(file)) throw new Error('permission_denied'); },
      writeFile: capture,
    } });
    await tool.execute(callId, { path: input.path, content: input.content }, signal, undefined, undefined as unknown as Parameters<ToolDefinition['execute']>[4]);
  }
  signal?.throwIfAborted();
  if (!after) throw new Error('configuration');
  if (before?.equals(after)) throw new Error('conflict');
  const oldText = before?.toString('utf8') ?? '', newText = after.toString('utf8');
  // Derive the review from the exact captured bytes, including BOM and line endings.
  // Both algorithms are original root exports; persist a canonical relative path.
  const diff = generateDiffString(oldText, newText).diff;
  const patch = generateUnifiedPatch(input.path.replace(/\\/g, '/'), oldText, newText);
  if (Buffer.byteLength(diff) > MAX_CHANGE_DIFF_BYTES || Buffer.byteLength(patch) > MAX_CHANGE_DIFF_BYTES) throw new Error('too_large');
  return { after, diff, patch };
}
