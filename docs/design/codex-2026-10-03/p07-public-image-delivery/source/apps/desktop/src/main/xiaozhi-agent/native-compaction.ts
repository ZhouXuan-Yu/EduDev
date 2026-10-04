import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compact, convertToLlm, estimateTokens, type SessionManager } from '@earendil-works/pi-coding-agent';

type Preparation = Parameters<typeof compact>[0];
type Settings = Preparation['settings'];
let loaded: Promise<{ prepareCompaction: (entries: ReturnType<SessionManager['getBranch']>, settings: Settings) => Preparation | undefined }> | undefined;
/** Version-pinned native helper: package root does not export prepareCompaction. */
export function loadNativeCompaction() {
  return loaded ||= (async () => {
    const entry = fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
    const metadata = JSON.parse(fs.readFileSync(path.join(path.dirname(entry), '../package.json'), 'utf8'));
    if (metadata.version !== '1.0.2') throw new Error('configuration');
    const native = await import(pathToFileURL(path.join(path.dirname(entry), 'core/compaction/compaction.js')).href);
    if (typeof native.prepareCompaction !== 'function') throw new Error('configuration');
    return native;
  })();
}

/** Pi 1.0.2 owns the latest tool-batch-safe cut selection. */
export async function prepareSafeNativeCompaction(entries: ReturnType<SessionManager['getBranch']>, settings: Settings) {
  return (await loadNativeCompaction()).prepareCompaction(entries, settings);
}

/** Includes prompt, all messages, thinking replay, tools, output and protocol headroom.
 * Bytes deliberately overestimate typical BPE text tokens; still an estimate, not billing.
 */
export function estimateFullRequest(context: unknown, maxOutputTokens: number) {
  const value = context as { systemPrompt?: string; messages?: Parameters<typeof convertToLlm>[0]; tools?: unknown[] };
  let imageTokens=0;
  const messages = convertToLlm(value.messages || []).map(message => ({ role: message.role, content: typeof message.content==='string'?message.content:message.content.map(part=>{
    if(part.type!=='image')return part;
    // Pi's native image estimate, never base64 transport characters as text tokens.
    imageTokens+=estimateTokens({role:'user',content:[part],timestamp:0});
    return {type:'text' as const,text:'[image]'};
  }),
    ...(message.role === 'system' ? {sections:message.sections,toolsAdded:message.toolsAdded,toolsRemoved:message.toolsRemoved} : {}),
    ...(message.role === 'toolResult' ? { toolCallId: message.toolCallId, toolName: message.toolName } : {}) }));
  // Agent tool details/usage are local audit data and are not provider-visible content.
  return Buffer.byteLength(JSON.stringify({ systemPrompt: value.systemPrompt, messages, tools: value.tools }), 'utf8') + imageTokens + maxOutputTokens + 1024;
}
