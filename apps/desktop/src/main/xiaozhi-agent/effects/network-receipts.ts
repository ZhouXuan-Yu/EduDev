import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {protocolHash} from '../capabilities/validation';
import type {EffectRecord} from './types';

export function networkOutcomeMatches(record: EffectRecord, digest: string) {
  if (!record.outcome || record.outcome.digest === digest) return true;
  return record.state === 'unknown' && record.proofs.length === 0
    && record.outcome.digest === protocolHash(['missing_result', record.id])
    && record.outcome.references.length === 1
    && record.outcome.references[0] === 'journal:' + record.owner.runId + ':' + record.callId;
}

type Receipt = {schemaVersion: 1; effectId: string; requestDigest: string; status: number; body: string};
export function createNetworkReceiptFiles(directory: string) {
  if (!path.isAbsolute(directory)) throw Error('invalid_input');
  const root = path.resolve(directory);
  async function checked(effectId: string) {
    if (!/^xieffect_[a-f0-9]{64}$/u.test(effectId)) throw Error('invalid_input');
    let cursor = root;
    for (;;) {
      try {if ((await fs.lstat(cursor)).isSymbolicLink()) throw Error('source_changed');}
      catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    return path.join(root, effectId + '.json');
  }
  async function read(effectId: string, requestDigest: string) {
    const file = await checked(effectId);
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const before = await handle.stat();
      // JSON escapes may expand a bounded response body by up to six times.
      if (!before.isFile() || before.nlink !== 1 || before.size > 7 * 1048576) throw Error('source_changed');
      const receipt = JSON.parse(await handle.readFile('utf8')) as Receipt;
      const after = await handle.stat(), current = await fs.lstat(await checked(effectId));
      if (before.ino !== current.ino || before.dev !== current.dev || current.isSymbolicLink() || current.nlink !== 1
          || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.size !== current.size || before.mtimeMs !== current.mtimeMs
          || receipt.schemaVersion !== 1 || receipt.effectId !== effectId || receipt.requestDigest !== requestDigest
          || !Number.isSafeInteger(receipt.status) || receipt.status < 100 || receipt.status > 599
          || typeof receipt.body !== 'string' || Buffer.byteLength(receipt.body) > 1048576) throw Error('source_changed');
      return receipt;
    } finally {await handle.close();}
  }
  return {
    read,
    async write(effectId: string, requestDigest: string, response: {status: number; body: string}) {
      const file = await checked(effectId);
      await fs.mkdir(root, {recursive: true});
      await checked(effectId);
      const receipt: Receipt = {schemaVersion: 1, effectId, requestDigest, ...response};
      if (Buffer.byteLength(response.body) > 1048576) throw Error('too_large');
      const temporary = path.join(root, '.' + effectId + '-' + randomUUID() + '.tmp');
      const bytes = JSON.stringify(receipt);
      await fs.writeFile(temporary, bytes, {flag: 'wx', mode: 0o600});
      try {
        try {await fs.link(temporary, file);}
        catch (error) {if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;}
      } finally {await fs.unlink(temporary);}
      const actual = await read(effectId, requestDigest);
      if (protocolHash(actual) !== protocolHash(receipt)) throw Error('source_changed');
      return actual;
    },
  };
}
