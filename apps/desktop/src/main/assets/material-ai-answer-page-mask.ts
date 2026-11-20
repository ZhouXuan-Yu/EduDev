import {createHash} from 'node:crypto';
import {ANSWER_PAGE_HEADER_MASK, type AnswerPageHeaderMask} from '../../shared/material-ai-answer-page-mask';
import type {MaterialPageSource} from '../../shared/material-ai-page';
import {PDF_LAYOUT_ENGINE} from '../../shared/material-layout';
import {PDF_PAGE_ENGINE, validPageBox, type PageBox} from '../../shared/material-page-preview';
import type {StructurePage} from '../../shared/material-document-structure';
import {readAiStructurePage, readPublishedAiStructureJob} from './material-ai-structure-source';
import type {readAiPageSource} from './material-ai-page-source';
import {QuestionAssets} from './question-assets';

type Host = Parameters<typeof readAiStructurePage>[0];
type Original = Awaited<ReturnType<typeof readAiPageSource>>;
type Clean = (text: string) => Promise<string>;
export type PixelMask = [left: number, top: number, right: number, bottom: number];
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const key = (value: string) => value.replace(/\s/gu, '');
const overlaps = (a: PageBox, b: PageBox) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

function withoutHeaders(text: string, headers: string[]) {
  const indexes = [...text.matchAll(/\S/g)].map(match => match.index);
  const compact = key(text);
  const spans: [number, number][] = [];
  for (const header of headers) {
    const start = compact.indexOf(header);
    if (start < 0) continue;
    if (compact.indexOf(header, start + 1) >= 0) throw Error('privacy_blocked');
    const left = indexes[start], right = indexes[start + header.length - 1] + 1;
    if (left > 0 && /\S/u.test(text[left - 1]) ||
        right < text.length && /\S/u.test(text[right])) throw Error('privacy_blocked');
    spans.push([left, right]);
  }
  let end = 0, result = '';
  for (const [left, right] of spans.sort((a, b) => a[0] - b[0])) {
    if (left < end) throw Error('privacy_blocked');
    result += text.slice(end, left);
    end = right;
  }
  return result + text.slice(end);
}

/** Match only original RapidOCR lines linked to positive header regions. A
 * native transcript may place the same title at a different text offset. */
export async function planAnswerPageMask(page: StructurePage, original: Original, width: number, height: number, clean: Clean) {
  const ocr = page.lines.filter(line => !line.origin);
  if (original.ocrText !== page.rawText || ocr.map(line => line.text).join('\n') !== original.ocrText ||
      !original.textStreams.includes(original.ocrText) || !page.lines.every(line => validPageBox(line.box)) ||
      !page.regions.every(region => validPageBox(region.box))) throw Error('privacy_blocked');
  const candidates = ocr.filter(line => line.score >= .95 && line.box[3] <= .14 &&
    page.paragraphs.some(p => p.role === 'header' && p.lineIds.includes(line.id)));
  if (!candidates.length || candidates.length > 16) throw Error('privacy_blocked');

  const marked = await Promise.all(candidates.map(async line => await clean(line.text) !== line.text));
  const headers = candidates.filter((_, index) => marked[index]);
  if (!headers.length) throw Error('privacy_blocked');
  const keys = headers.map(line => key(line.text));
  if (keys.some(value => value.length < 6) || new Set(keys).size !== keys.length) throw Error('privacy_blocked');
  const masks: PixelMask[] = [];
  for (const line of headers) {
    const b = line.box;
    const labels = page.regions.filter(region => region.kind === 'header' && overlaps(region.box, b));
    if (labels.length !== 1) throw Error('privacy_blocked');
    const label = labels[0].box;
    const padding = (b[3] - b[1]) * .45;
    const rect: PixelMask = [
      Math.max(0, Math.floor((Math.min(b[0], label[0]) - padding) * width)),
      Math.max(0, Math.floor((Math.min(b[1], label[1]) - padding) * height)),
      Math.min(width, Math.ceil((Math.max(b[2], label[2]) + padding) * width)),
      Math.ceil((Math.max(b[3], label[3]) + padding) * height),
    ];
    const mask: PageBox = [rect[0] / width, rect[1] / height, rect[2] / width, rect[3] / height];
    if (!validPageBox(mask) || mask[3] > .16 ||
        page.lines.some(other => other !== line && overlaps(other.box, mask)) ||
        page.regions.some(other => other !== labels[0] && overlaps(other.box, mask))) throw Error('privacy_blocked');
    masks.push(rect);
  }
  const labels = original.resourceLabels;
  if (labels && await clean(labels) !== labels) throw Error('privacy_blocked');
  // A parser can also flag an independent local excerpt. Prove that every
  // such flag on this page is explained by the same authenticated header.
  for (const entry of original.privacyRows ?? []) {
    if (typeof entry.content_md !== 'string') throw Error('privacy_blocked');
    const excerpt = [entry.heading ?? '', entry.content_md].join('\n');
    const cleared = withoutHeaders(excerpt, keys);
    if (cleared === excerpt || await clean(excerpt) === excerpt || await clean(cleared) !== cleared) throw Error('privacy_blocked');
  }
  const text = original.textStreams.map(stream => withoutHeaders(stream, keys)).join('\n');
  // Check the actual joined request too, including patterns spanning stream boundaries.
  if (!text.trim() || text === original.text || await clean(text) !== text) throw Error('privacy_blocked');
  return {masks, text};
}

export function eraseAnswerHeaderPixels(bitmap: Buffer, width: number, masks: PixelMask[]) {
  for (const [left, top, right, bottom] of masks) {
    for (let row = top; row < bottom; row++) {
      bitmap.fill(255, (row * width + left) * 4, (row * width + right) * 4);
    }
  }
}

function privacySha(original: Original) {
  return sha(JSON.stringify([original.resourceLabels, original.privacyRows]));
}

export async function assertAnswerPageMaskSource(host: Host, source: MaterialPageSource, original: Original, mask: AnswerPageHeaderMask) {
  if (JSON.stringify(original.source) !== JSON.stringify(source) || privacySha(original) !== mask.privacySha) throw Error('source_changed');
  const [row] = await host.all(
    'SELECT sha256 FROM material_structure_pages WHERE generation=? AND page=?',
    [mask.structureGeneration, source.page],
  );
  if (row?.sha256 !== mask.structureSha) throw Error('source_changed');
}

export async function prepareAnswerPageMask(
  host: Host,
  original: Original,
  clean: Clean,
  signal: AbortSignal,
  frozen?: AnswerPageHeaderMask,
) {
  const generation = frozen?.structureGeneration ??
    (await readPublishedAiStructureJob(host, original.source))?.generation;
  if (!host.root || typeof generation !== 'string') throw Error('privacy_blocked');
  const {page, image, sha256} = await readAiStructurePage(host, original.source, generation, frozen?.structureSha);
  if (page.sourceEngine !== PDF_LAYOUT_ENGINE || page.rasterSource?.resourceId !== original.source.resourceId ||
      page.rasterSource.version !== original.source.version || image.engine !== PDF_PAGE_ENGINE ||
      page.totalPages !== original.totalPages || image.total !== original.totalPages || image.box.join(',') !== '0,0,1,1' ||
      image.width !== original.width || image.height !== original.height ||
      ![image.width, image.height].every(side => Number.isSafeInteger(side) && side > 0 && side <= 2401)) throw Error('source_changed');
  const {masks, text} = await planAnswerPageMask(page, original, image.width, image.height, clean);
  const originalImage = await new QuestionAssets(host.root).read(image, true, signal);
  const {nativeImage} = await import('electron');
  const raster = nativeImage.createFromBuffer(originalImage);
  const dimensions = raster.getSize(1);
  const bitmap = raster.toBitmap({scaleFactor: 1});
  if (dimensions.width !== image.width || dimensions.height !== image.height ||
      bitmap.length !== image.width * image.height * 4) throw Error('source_changed');
  eraseAnswerHeaderPixels(bitmap, image.width, masks);
  const png = nativeImage.createFromBitmap(bitmap, {...dimensions, scaleFactor: 1}).toPNG({scaleFactor: 1});
  if (!png.length || png.length > 4 * 1048576) throw Error('unit_too_large');
  const proof: AnswerPageHeaderMask = {
    policy: ANSWER_PAGE_HEADER_MASK,
    structureGeneration: generation,
    structureSha: sha256,
    originalImageSha: image.sha256,
    masks,
    privacySha: privacySha(original),
    textSha: sha(text),
    imageSha: sha(png),
  };
  if (proof.imageSha === proof.originalImageSha || frozen && JSON.stringify(proof) !== JSON.stringify(frozen)) {
    throw Error('source_changed');
  }
  signal.throwIfAborted();
  return {proof, text, image: {mime: 'image/png', data: png.toString('base64')}};
}
