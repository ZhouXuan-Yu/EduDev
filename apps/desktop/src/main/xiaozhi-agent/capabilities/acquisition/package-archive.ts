import fs from 'node:fs/promises';
import {createReadStream, createWriteStream} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {t as readTar} from 'tar';
import {containsPath} from '../../permissions/resources';

const forbidden = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
/** Parse through the existing locked tar library, then write ordinary files ourselves. */
export async function extractCapabilityPackage(archive: string, destination: string, signal: AbortSignal) {
  await fs.mkdir(destination, {recursive: false});
  let expanded = 0, count = 0, invalid = false;
  const seen = new Set<string>();
  const pending: Promise<void>[] = [];
  const reject = () => {invalid = true;};
  const unpacked = archive + '.tar-' + randomUUID();
  try {
    let uncompressedBytes = 0;
    await pipeline(createReadStream(archive), createGunzip(), new Transform({transform(bytes: Buffer, _encoding, callback) {
      uncompressedBytes += bytes.length;
      callback(uncompressedBytes > 160 * 1048576 ? Error('archive_invalid') : null, bytes);
    }}), createWriteStream(unpacked, {flags: 'wx', mode: 0o600}), {signal});
    await readTar({file: unpacked, strict: true, maxMetaEntrySize: 16384, onReadEntry(entry) {
      signal.throwIfAborted();
      const raw = entry.path.replace(/\/$/u, '');
      const parts = raw.split('/');
      const relative = parts.slice(1).join('/');
      expanded += entry.size;
      if (++count > 10000 || expanded > 128 * 1048576 || entry.size > 32 * 1048576
          || parts[0] !== 'package' || raw.includes('\\') || relative.length > 512
          || parts.some(part => !part || part === '.' || part === '..' || /[\x00-\x1f:]/u.test(part)
            || /[ .]$/u.test(part) || forbidden.test(part)) || !['File', 'Directory'].includes(entry.type)) {
        reject(); entry.resume(); return;
      }
      if (!relative && entry.type === 'Directory') {entry.resume(); return;}
      const key = relative.toLowerCase();
      if (seen.has(key) || !relative || !containsPath(destination, path.resolve(destination, relative))) {
        reject(); entry.resume(); return;
      }
      seen.add(key);
      if (entry.type === 'Directory') {entry.resume(); return;}
      const chunks: Buffer[] = [];
      let length = 0;
      pending.push(new Promise<void>((resolve, rejectEntry) => {
        entry.on('data', (bytes: Buffer) => {
          length += bytes.length;
          if (length > entry.size || signal.aborted) {entry.destroy(Error('archive_invalid')); return;}
          chunks.push(bytes);
        });
        entry.once('error', rejectEntry);
        entry.once('end', () => {
          if (length !== entry.size) {rejectEntry(Error('archive_invalid')); return;}
          void (async () => {
            signal.throwIfAborted();
            const filename = path.resolve(destination, relative);
            await fs.mkdir(path.dirname(filename), {recursive: true});
            await fs.writeFile(filename, Buffer.concat(chunks), {flag: 'wx', mode: 0o600});
            resolve();
          })().catch(rejectEntry);
        });
      }));
    }});
    await Promise.all(pending);
    signal.throwIfAborted();
    if (invalid || !seen.has('package.json')) throw Error('archive_invalid');
    return {files: seen.size, expandedBytes: expanded};
  } catch (error) {
    await Promise.allSettled(pending);
    signal.throwIfAborted();
    throw error instanceof Error && error.message === 'archive_invalid' ? error : Error('archive_invalid');
  } finally {
    await fs.unlink(unpacked).catch(() => undefined);
  }
}
