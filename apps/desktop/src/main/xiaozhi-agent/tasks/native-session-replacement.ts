import fs from 'node:fs/promises';
import path from 'node:path';
import type {SessionManager} from '@earendil-works/pi-coding-agent';

/** Pi normally waits for a conversation message before creating its file. Explicit
 * recovery must durably create the real manager's metadata before committing its binding. */
export async function persistNativeSessionReplacement(manager: SessionManager, root: string) {
  const file = manager.getSessionFile(), base = path.resolve(root);
  if (!file || !path.isAbsolute(file) || !file.endsWith('.jsonl')) throw Error('configuration');
  const relative = path.relative(base, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('permission_denied');
  let cursor = path.dirname(file);
  for (;;) {
    const stat = await fs.lstat(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('permission_denied');
    if (cursor === base) break;
    const parent = path.dirname(cursor);
    if (parent === cursor) throw Error('permission_denied');
    cursor = parent;
  }
  const entries = manager.getEntries();
  if (entries.some(entry => entry.type === 'message')) throw Error('configuration');
  const bytes = [manager.getHeader(), ...entries].map(entry => JSON.stringify(entry)).join('\n') + '\n';
  if (Buffer.byteLength(bytes) > 32 * 1048576) throw Error('configuration');
  const handle = await fs.open(file, 'wx', 0o600);
  try {await handle.writeFile(bytes, 'utf8'); await handle.sync();}
  finally {await handle.close();}
  // The public reload method marks the real manager's file as persisted. No
  // synthetic user/assistant message or private SDK field is needed.
  manager.setSessionFile(file);
  if (manager.getSessionId() !== manager.getHeader()?.id) throw Error('configuration');
}
