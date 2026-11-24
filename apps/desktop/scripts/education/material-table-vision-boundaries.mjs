import '../office-agent/register-source.mjs';
import assert from "node:assert/strict";
const { readTableWithDeepSeek, parseTableVisionReading, contrastReadingConflict } = await import("../../src/main/assets/material-table-vision-provider.ts");
const { tableVisionPlan, neutralizePaleOverprint, overprintFocus } = await import("../../src/shared/material-table-vision.ts");
const { paleChromaticReading, evidenceForTable } = await import("../../src/main/assets/material-structure-ruled-table.ts");

const table = {
  page: 1, regionId: "test-table", rasterSha256: "0".repeat(64), box: [0, 0, 1, 1],
  rows: Array.from({length: 8}, (_, row) => Array.from({length: 8}, (_, column) => ({
    box: [column / 8, row / 8, (column + 1) / 8, (row + 1) / 8],
    text: "", lineIds: [], needsReview: row !== 0,
  }))),
};
assert.deepEqual(tableVisionPlan(table, 6, 5), {
  target: [5 / 8, 6 / 8, 6 / 8, 7 / 8],
  context: [4 / 8, 5 / 8, 7 / 8, 7 / 8],
  header: [5 / 8, 0, 6 / 8, 1 / 8],
  rowLabel: [0, 6 / 8, 1 / 8, 7 / 8],
  relativeRow: 1, relativeColumn: 1, suspectedOverprint: false,
});
assert.throws(() => tableVisionPlan(table, 8, 5), /source_incomplete/);
assert.throws(() => tableVisionPlan(table, 0, 5), /source_incomplete/);
const merged = structuredClone(table);
merged.rows[0][0].columnSpan = 2;
merged.rows[0][1].covered = true;
assert.throws(() => tableVisionPlan(merged, 6, 5), /source_incomplete/);
assert.throws(() => tableVisionPlan({ ...table, layout: "aligned_text" }, 6, 5), /source_incomplete/);
assert.throws(() => parseTableVisionReading({state: "unreadable", text: "13", columnLabel: null, unit: null}), /invalid_response/);
assert.throws(() => parseTableVisionReading({state: "partial", text: null, columnLabel: null, unit: null}), /invalid_response/);
assert.throws(() => parseTableVisionReading({state: "read", text: "13\u202e", columnLabel: null, unit: null}), /invalid_response/);
const scan = Buffer.alloc(32 * 32 * 4, 255);
const raster = {width: 32, height: 32, pixels: scan};
const box = [0.125, 0.125, 0.875, 0.875];
const ocr = [{ id: "overprint", box, text: "Synthetic watermark", score: .9993 }];
const ink = (r, g, b) => {
  for (let y = 5; y < 25; y++) for (let x = 6; x < 20; x++) {
    const i = (y * 32 + x) * 4;
    scan.set([b, g, r], i);
  }
};
ink(9, 9, 9);
assert.equal(paleChromaticReading(raster, box), false);
assert.equal(evidenceForTable([[[0,0,1,1]]], ocr, raster)[0][0].needsReview, false);
ink(187, 174, 208);
assert.equal(paleChromaticReading(raster, box), true);
assert.deepEqual(evidenceForTable([[[0,0,1,1]]], ocr, raster)[0][0], {
  box: [0,0,1,1], text: "", lineIds: ["overprint"], suspectedOverprint: true, needsReview: true,
});
const view = Buffer.from([208, 174, 187, 255, 171, 171, 171, 255]);
neutralizePaleOverprint(view);
assert.deepEqual(Array.from(view), [255,255,255,255,48,48,48,255]);
assert.equal(contrastReadingConflict("0.10", { text: "-0.1a", confidence: .934 }), true);
assert.equal(contrastReadingConflict("-0.10", { text: "-0.1a", confidence: .934 }), false);
assert.equal(contrastReadingConflict("0.10", { text: "0.11", confidence: .997 }), true);
assert.deepEqual(overprintFocus(Buffer.alloc(32 * 24 * 4, 255), 32, 24), {x:0,y:0,width:32,height:24});
const png = marker => Buffer.from([137,80,78,71,13,10,26,10,marker]);
let sent = 0, admitted = false;
const request = {
  images: {target: png(1), context: png(2), header: png(3), rowLabel: png(4)},
  apiKey: "fixture", relativeRow: 1, relativeColumn: 2,
  signal: new AbortController().signal,
  beforeSend: async () => { admitted = true; },
};
const transport = async () => async (url, init) => {
  assert(admitted);
  assert.equal(url, "https://api.deepseek.com/chat/completions");
  assert.equal(init.redirect, "error");
  const payload = JSON.parse(init.body);
  assert.equal(payload.model, "deepseek-flash");
  assert.equal(payload.response_format.type, "json_object");
  const attached = payload.messages[1].content.filter(item => item.type === "image_url");
  assert.deepEqual(attached.map(item => Buffer.from(item.image_url.url.split(",")[1], "base64").at(-1)), [1, 2, 3, 4]);
  sent++;
  return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
    state: "read", text: "-0.10", columnLabel: "速度", unit: "m/s",
  }) } }] });
};
const result = await readTableWithDeepSeek(request, transport);
assert.equal(result.text, "-0.10");
assert.match(result.contextSha256, /^[0-9a-f]{64}$/);
assert.equal(sent, 1);
await assert.rejects(readTableWithDeepSeek({ ...request, beforeSend: async () => { throw Error("source_changed"); } }, transport), /source_changed/);
assert.equal(sent, 1);
await assert.rejects(readTableWithDeepSeek({ ...request, images: {target: Buffer.alloc(1048577), context: png(2)} }, transport), /unit_too_large/);
assert.equal(sent, 1);
await assert.rejects(readTableWithDeepSeek(request, async () => async () => Response.json({
  choices: [{ finish_reason: "length", message: {content: "{}"} }],
})), /invalid_response/);
console.log("PASS table vision planning, response validation, dispatch guard and size bounds");
