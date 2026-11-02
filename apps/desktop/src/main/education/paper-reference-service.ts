import {MATERIALS_SCHEMA} from '../../shared/materials';
import {PAPER_BASKET_V2_SCHEMA} from '../../shared/paper-basket-v2';
import {validReferenceList, validReferenceExtract, type PaperReferenceTarget, type PaperReferenceListInput,
  type PaperReferenceExtractInput, type PaperReferenceSourcePage} from '../../shared/paper-reference';
import type {PaperBasketV2Repository} from './paper-basket-v2-repository';
import {readReferenceBody, type ReferenceMaterials} from './paper-reference-source';
import {extractReferenceStructure, referenceHash} from './paper-reference-extract';
import {extractReferenceWordLayout} from './paper-reference-word';

export type PaperReferenceHost = {materials: ReferenceMaterials; baskets: Pick<PaperBasketV2Repository, 'read'>;
  privateResourceIds(ids: string[]): Promise<string[]>};
export function createPaperReferenceService(host: PaperReferenceHost) {
  async function authorize(input: PaperReferenceTarget) {
    const basket = await host.baskets.read({schemaVersion: PAPER_BASKET_V2_SCHEMA, sessionId: input.sessionId, basketId: input.basketId});
    if (basket.state !== 'active' || basket.revision !== input.basketRevision) throw Error('conflict');
    return basket;
  }
  async function allowedResource(id: string) {
    if ((await host.privateResourceIds([id])).length) throw Error('permission_denied');
  }
  return {
    async list(input: PaperReferenceListInput): Promise<PaperReferenceSourcePage> {
      if (!validReferenceList(input)) throw Error('invalid_input');
      await authorize(input);
      const page = await host.materials.list({schemaVersion: MATERIALS_SCHEMA, query: input.query, offset: input.offset});
      const denied = new Set(await host.privateResourceIds(page.resources.map(r => r.id)));
      await authorize(input);
      return {items: page.resources.filter(r => !denied.has(r.id)).map(r => ({resourceId: r.id, version: r.contentHash,
        title: r.title, filename: r.originalFileName, parseStatus: r.parseStatus, chunkCount: r.chunkCount})),
        offset: page.offset, hasMore: page.hasMore};
    },
    async extract(input: PaperReferenceExtractInput, signal: AbortSignal) {
      if (!validReferenceExtract(input)) throw Error('invalid_input');
      await authorize(input); await allowedResource(input.resourceId); signal.throwIfAborted();
      const body = await readReferenceBody(host.materials, input.resourceId, input.version, signal);
      const candidate = extractReferenceStructure(body);
      const resource = await host.materials.resource(input.resourceId);
      candidate.source.filename = resource.originalFileName;
      if (/\.docx$/i.test(resource.originalFileName)) {
        const bytes = await host.materials.original(input.resourceId, input.version, signal);
        await extractReferenceWordLayout(bytes, candidate, signal);
      } else candidate.warnings.push('此来源没有可可靠提取的DOCX页面设置；空白版式项须由教师明确填写。');
      await host.materials.verify(input.resourceId, input.version, signal);
      const after = await readReferenceBody(host.materials, input.resourceId, input.version, signal);
      if (after.bodyDigest !== body.bodyDigest || after.complete !== body.complete || after.totalChunks !== body.totalChunks || after.parseEngine !== body.parseEngine) throw Error('source_changed');
      await allowedResource(input.resourceId); await authorize(input); signal.throwIfAborted();
      candidate.digest = referenceHash({...candidate, digest: ''});
      return candidate;
    },
  };
}
