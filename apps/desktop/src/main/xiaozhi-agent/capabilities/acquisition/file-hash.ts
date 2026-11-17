import {createReadStream} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import fs from 'node:fs/promises';

/** Stream large managed resources through bounded chunks and yield on file I/O. */
export async function hashCapabilityFile(filename: string, signal?: AbortSignal) {
  const before = await fs.lstat(filename);
  if (!before.isFile() || before.isSymbolicLink()) throw Error('source_changed');
  const hash = createHash('sha256');
  let size = 0;
  for await (const bytes of createReadStream(filename, {highWaterMark: 65536, signal})) {
    size += bytes.length;
    if (size > before.size) throw Error('source_changed');
    hash.update(bytes);
  }
  const after = await fs.lstat(filename);
  if (size !== before.size || before.dev !== after.dev || before.ino !== after.ino || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs || before.size !== after.size || after.isSymbolicLink()) throw Error('source_changed');
  return hash.digest('hex');
}

/** Hash downloaded buffers on the crypto worker pool. */
export async function hashCapabilityBytes(bytes: Buffer, algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256') {
  return Buffer.from(await webcrypto.subtle.digest(algorithm, bytes));
}
