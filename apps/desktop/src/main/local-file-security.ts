import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export function resolveInsideRoot(root: string, ...parts: string[]) {
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, ...parts);
  const relation = relative(resolvedRoot, target);
  if (relation.startsWith('..') || isAbsolute(relation)) {
    throw new Error('Path escapes the local data root');
  }
  return target;
}

export async function isInsideRoot(root: string, targetPath: string) {
  try {
    const [resolvedRoot, resolvedTarget] = await Promise.all([
      realpath(root),
      realpath(targetPath),
    ]);
    const relation = relative(resolvedRoot, resolvedTarget);
    return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation));
  } catch {
    return false;
  }
}

export function hashFileSha256(filePath: string) {
  return new Promise<string>((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}
