import type {MaterialRepository} from '../assets/material-repository';
import {materialSource, type MaterialReadingUnit} from '../assets/material-source';
import {referenceHash, type ReferenceBody} from './paper-reference-extract';

export type ReferenceMaterials = Pick<MaterialRepository, 'resource' | 'original' | 'verify' | 'readingWindow' | 'list'>;
export const REFERENCE_MAX_CHUNKS = 128;
const MAX_BYTES = 512 * 1024;
/** Fixed windows with a second complete comparison, not a first-page-as-whole-book projection. */
export async function readReferenceBody(materials: ReferenceMaterials, resourceId: string, version: string, signal: AbortSignal): Promise<ReferenceBody> {
  const before = await materials.resource(resourceId);
  if (before.contentHash !== version) throw Error('source_changed');
  if (!['ready', 'partial', 'parsed', 'chunked', 'indexed', 'graph_extracted'].includes(before.parseStatus)) throw Error('unavailable');
  const units: MaterialReadingUnit[] = [], windows: {offset: number; fingerprint: string}[] = [];
  let more = false, bytes = 0;
  for (let offset = 0; offset < REFERENCE_MAX_CHUNKS; offset += 16) {
    signal.throwIfAborted(); const page = await materials.readingWindow(resourceId, offset, 16);
    if (page.units.some(u => u.version !== version)) throw Error('source_changed');
    if (page.units.some(u => u.chunk.containsPersonalData)) throw Error('permission_denied');
    const pageBytes = page.units.reduce((n, u) => n + Buffer.byteLength(u.chunk.contentMd), 0);
    if (bytes + pageBytes > MAX_BYTES) {if (!units.length) throw Error('too_large'); more = true; break;}
    units.push(...page.units); bytes += pageBytes; windows.push({offset, fingerprint: page.fingerprint}); more = page.hasMore;
    if (!more) break;
  }
  if (!units.length) throw Error(bytes ? 'too_large' : 'unavailable');
  for (const window of windows) {
    signal.throwIfAborted(); const check = await materials.readingWindow(resourceId, window.offset, 16);
    if (check.fingerprint !== window.fingerprint) throw Error('source_changed');
  }
  const after = await materials.resource(resourceId);
  if (after.contentHash !== version || after.chunkCount !== before.chunkCount || after.parseStatus !== before.parseStatus || after.parseEngine !== before.parseEngine) throw Error('source_changed');
  return {units, totalChunks: after.chunkCount, complete: !more && after.parseStatus !== 'partial' && units.length === after.chunkCount,
    parseEngine: after.parseEngine, bodyDigest: referenceHash(units.map(materialSource))};
}
