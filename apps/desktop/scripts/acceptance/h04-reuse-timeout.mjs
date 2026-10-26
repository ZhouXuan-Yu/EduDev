import fs from 'node:fs';import path from 'node:path';import {createHash}from'node:crypto';
const upstream='D:/WorkProject/小智智能体借鉴项目/OpenMAIC';
const out='src/main/xiaozhi-agent/vendor/openmaic';
const source=fs.readFileSync(path.join(upstream,'lib/agent/runtime/tool-timeout.ts'),'utf8');
const sha=v=>createHash('sha256').update(v).digest('hex');
fs.mkdirSync(out,{recursive:true});
const target=path.join(out,'tool-timeout.ts');if(fs.existsSync(target))throw Error('refuse to overwrite vendor');
let s=source.replace("import type { AgentTool, AgentToolUpdateCallback } from '@earendil-works/pi-agent-core';", "import type { ToolDefinition as AgentTool } from '@earendil-works/pi-coding-agent';\ntype AgentToolUpdateCallback = NonNullable<Parameters<AgentTool['execute']>[3]>;\nexport type ToolBoundOptions = { context?: Parameters<AgentTool['execute']>[4]; waiting?: () => boolean; onWaiting?: (fn: (waiting: boolean) => void) => () => void; onActualSettled?: () => void };");
s=s.replace("'the call did not complete. Retry the call or proceed without its result.'", "'The call did not complete. Its effect may be unknown; do not replay a write or upload.'");
s=s.replace('async function executeWithToolBound(', 'export async function executeWithToolBound(');
s=s.replace('execute: (toolCallId, args, signal, onUpdate) =>', 'execute: (toolCallId, args, signal, onUpdate, context) =>');
s=s.replace('toolCallId, args, signal, onUpdate),', 'toolCallId, args, signal, onUpdate, {context}),');
s=s.replace("  onUpdate: Parameters<ToolExecute>[3],\n):", "  onUpdate: Parameters<ToolExecute>[3],\n  options: ToolBoundOptions = {},\n):");
s=s.replace('  let settled = false;', '  let settled = false;\n  let remaining = timeoutMs, armedAt = 0;\n  let removeWaiting: (() => void) | undefined;');
s=s.replace('    if (timer !== undefined) clearTimeout(timer);', '    if (timer !== undefined) clearTimeout(timer);\n    removeWaiting?.();');
s=s.replace('      return race;', '      options.onActualSettled?.();\n      return race;');
s=s.replace('  if (timeoutMs > 0) timer = setTimeout(onTimeout, timeoutMs);', `  // Education adaptation: explicit teacher waits pause active execution time.
  const waitingChanged = (waiting: boolean) => {
    if (settled || timeoutMs <= 0) return;
    if (timer !== undefined) { clearTimeout(timer); timer = undefined; remaining -= Math.max(0, performance.now() - armedAt); }
    if (!waiting) { armedAt = performance.now(); timer = setTimeout(onTimeout, Math.max(1, remaining)); }
  };
  removeWaiting = options.onWaiting?.(waitingChanged);
  waitingChanged(options.waiting?.() === true);`);
s=s.replace('  execute(toolCallId, args, controller.signal, guardedUpdate).then(', '  // Catch synchronous throws and drain late rejection. Locks live until real settlement.\n  Promise.resolve().then(() => { controller.signal.throwIfAborted(); return execute(toolCallId, args, controller.signal, guardedUpdate, options.context!); }).then(');
s=s.replace('    (result) => finish(() => resolveRace(result)),', '    (result) => { options.onActualSettled?.(); finish(() => resolveRace(result)); },');
s=s.replace('    (error) => finish(() => rejectRace(error)),', '    (error) => { options.onActualSettled?.(); finish(() => rejectRace(error)); },');
s='// OpenMAIC MIT; source and adaptations in source-manifest.json.\n'+s;
fs.writeFileSync(target,s);fs.copyFileSync(path.join(upstream,'LICENSE'),path.join(out,'LICENSE'));
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({project:'THU-MAIC/OpenMAIC',revision:'636fab0d7edee5e7c2694117c38ece8f623573f9',license:'MIT',path:'lib/agent/runtime/tool-timeout.ts',sourceSha256:sha(source),outputSha256:sha(s),upstream:'https://github.com/THU-MAIC/OpenMAIC/blob/636fab0d7edee5e7c2694117c38ece8f623573f9/lib/agent/runtime/tool-timeout.ts',adaptations:['Pi ToolDefinition five-argument signature', 'Export bound and pass main-owned deadline/context', 'Pause active clock during existing teacher wait', 'Actual settlement callback retains locks on zombie work', 'Promise boundary catches synchronous throws and drains late rejection', 'No suggestion to automatically retry writes or uploads'],dependencies:'Only existing Pi type import and native AbortController/timers; no install, no Windows packaging runtime addition'},null,2));
console.log(JSON.stringify({sourceSha256:sha(source),outputSha256:sha(s)}));
