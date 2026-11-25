import { nativeImage } from 'electron';
import type { PdfLayout } from '../../shared/material-layout';
import { LOCAL_BOOK_RECHECK_SCHEMA } from '../../shared/material-local-book-answers';
import { validPdfFilePage } from '../../shared/material-pdf-file';
import { requireCurrentAnswerBook, readLocalBookChoiceRows, localBookReceiptSha, localRecheckSummary, WINDOWS_CHOICE_OCR,
  type LocalBookPageSource, type LocalBookRecheckEvidence, type LocalBookRecheckRow, type LocalBookHost } from './material-local-book-answers';
import { WINDOWS_CHOICE_OCR_BATCH, recognizeWindowsChoiceCrops } from './material-windows-choice-ocr';
import { independentChoiceLetters, independentNumberedChoice, locateLocalChoiceRow } from './material-local-book-choice-layout';
import type { PageBox } from '../../shared/material-page-preview';

async function readReceipt(host: LocalBookHost, input: LocalBookPageSource, signal: AbortSignal) {
  await requireCurrentAnswerBook(host, input, signal);
  const [row] = await host.all(`SELECT j.generation,j.total,p.result_json FROM material_pdf_jobs j
    JOIN material_pdf_pages p ON p.generation=j.generation
    WHERE j.resource_id=? AND j.version=? AND p.page=? AND p.status='complete'`,
  [input.resourceId,input.version,input.page]);
  if (typeof row?.generation !== 'string' || typeof row.result_json !== 'string') throw Error('source_incomplete');
  let receipt: unknown;
  try { receipt = JSON.parse(row.result_json); } catch { throw Error('source_changed'); }
  if (!validPdfFilePage(receipt) || receipt.status !== 'complete') throw Error('source_incomplete');
  return { generation: row.generation, total: Number(row.total), receipt, rawSha: localBookReceiptSha(row.result_json) };
}

export async function runLocalBookRecheck(host: LocalBookHost & {
  layout: (query: LocalBookPageSource, signal: AbortSignal) => Promise<PdfLayout>;
  save: (proof: LocalBookRecheckEvidence, signal: AbortSignal) => Promise<void>;
}, source: LocalBookPageSource, signal: AbortSignal) {
  await host.verify(source.resourceId,source.version,signal);
  const initial = await readReceipt(host,source,signal);
  const rows: LocalBookRecheckRow[] = await readLocalBookChoiceRows(host.all,source,initial.generation,initial.receipt.text);
  if (!rows.length) throw Error('source_incomplete');
  if (rows.length > WINDOWS_CHOICE_OCR_BATCH) throw Error('unit_too_large');
  const layout = await host.layout(source,signal);
  if (layout.inputSha256 !== source.version || layout.page !== source.page || layout.total !== initial.total ||
      layout.width !== initial.receipt.width || layout.height !== initial.receipt.height) throw Error('source_changed');
  const image = nativeImage.createFromBuffer(Buffer.from(layout.png,'base64'));
  const prepare = (box: PageBox) => {
    const {width,height} = layout;
    const x = Math.floor(box[0] * width), y = Math.floor(box[1] * height);
    const cut = image.crop({ x,y,width:Math.ceil(box[2]*width)-x,height:Math.ceil(box[3]*height)-y });
    const size = cut.getSize();
    const prepared = cut.resize({ width: Math.min(2000,size.width*2),quality:'best' });
    if (prepared.isEmpty()) return;
    return {box,bytes:prepared.toPNG({scaleFactor:1}),sha256:localBookReceiptSha(cut.toPNG({scaleFactor:1}))};
  };
  const crops = rows.flatMap((row,index) => {
    const answerBox = locateLocalChoiceRow(layout,row.sample,row.numbered ? 'numbered-answer' : undefined);
    if (!answerBox) return [];
    const answer = prepare(answerBox);
    if (!answer) return [];
    const witness = {...answer,index,kind:'answer' as const};
    if (!row.numbered) return [witness];
    const markerBox = locateLocalChoiceRow(layout,row.numbered.marker,'numbered-marker');
    if (!markerBox || markerBox[3] > answerBox[1] || Math.abs(markerBox[0]-answerBox[0]) > .24) return [];
    const marker = prepare(markerBox);
    return marker ? [witness,{...marker,index,kind:'marker' as const}] : [];
  });
  for (let start=0;start<crops.length;start+=WINDOWS_CHOICE_OCR_BATCH) {
    const batch = crops.slice(start,start+WINDOWS_CHOICE_OCR_BATCH);
    const readings = await recognizeWindowsChoiceCrops(batch.map(crop=>crop.bytes),signal);
    for (const [index,crop] of batch.entries()) {
      const row = rows[crop.index], lines = readings[index];
      const kind = crop.kind === 'marker' ? 'number' : 'letter';
      row[crop.kind === 'marker' ? 'markerCrop' : 'crop'] = {
        box:crop.box,sha256:crop.sha256,inputSha:localBookReceiptSha(crop.bytes),lines,
        observed:row.numbered ? independentNumberedChoice(lines,kind) : independentChoiceLetters(lines),
      };
    }
  }
  const proof: LocalBookRecheckEvidence = {...source,schemaVersion:LOCAL_BOOK_RECHECK_SCHEMA,
    engine:WINDOWS_CHOICE_OCR,generation:initial.generation,rawSha:initial.rawSha,
    rasterSha:layout.rasterSha256,rows};
  await host.save(proof,signal);
  return localRecheckSummary(rows);
}

export async function saveLocalBookRecheck(host: LocalBookHost & {
  run: (sql:string, values:(string|number)[]) => Promise<void>;
}, proof: LocalBookRecheckEvidence, signal: AbortSignal) {
  const current = await readReceipt(host,proof,signal);
  if (current.generation !== proof.generation || current.rawSha !== proof.rawSha) throw Error('source_changed');
  await host.verify(proof.resourceId,proof.version,signal);
  const body = JSON.stringify(proof);
  signal.throwIfAborted();
  await host.run(`INSERT INTO material_local_book_rechecks_v1 VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(resource_id,version,generation,page) DO UPDATE SET raw_sha=excluded.raw_sha,
      body_json=excluded.body_json,body_sha=excluded.body_sha`,
  [proof.resourceId,proof.version,proof.generation,proof.page,proof.rawSha,body,localBookReceiptSha(body)]);
}
