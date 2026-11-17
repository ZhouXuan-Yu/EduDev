import assert from "node:assert/strict";
import {
  recoverNativeGaps,
  missingNativeLines,
  nativeCropSignature,
} from "../../src/main/assets/material-native-gap.ts";
import {
  recoverStructurePage,
  StructureQuestionAssembler,
} from "../../src/main/assets/material-document-structure.ts";
import { structureOcrSourceKey } from "../../src/main/assets/material-structure-identity.ts";
import {
  NATIVE_TEXT_SCHEMA,
  NATIVE_TEXT_ENGINE,
  validNativeTextRequest,
} from "../../src/shared/material-native-text.ts";
const checks = [];
async function check(name, action) {
  await action();
  checks.push(name);
  console.log("PASS " + name);
}
const version = "a".repeat(64),
  resourceId = "resource_00000000-0000-0000-0000-000000000001";
function line(id, text, y, x = 0.1, width = 0.3) {
  const quad = [
    [x, y],
    [x + width, y],
    [x + width, y + 0.02],
    [x, y + 0.02],
  ];
  return {
    id,
    kind: "text",
    needsReview: true,
    text,
    score: 0.99,
    normalizedQuad: quad,
    quad: quad.map((p) => [p[0] * 1000, p[1] * 1400]),
  };
}
const raw = [
  line("line-1", "1. 请选择正确选项。", 0.1, 0.1, 0.7),
  line("line-2", "A.甲", 0.2),
  line("line-3", "B.乙", 0.24),
  line("line-4", "D.丁", 0.32),
  line("line-5", "2.求下一题的结果。", 0.55, 0.1, 0.7),
];
const layout = {
  schemaVersion: "xiaozhi.local-pdf-layout.v1",
  ok: true,
  engine: "pdfium-5.14.0-rapidocr-3.9.2-layout.v1",
  inputSha256: version,
  page: 1,
  total: 1,
  width: 1000,
  height: 1400,
  png: "fixture",
  rasterSha256: "b".repeat(64),
  lines: raw,
};
const region = {
  id: "block-1",
  kind: "text",
  score: 0.99,
  box: [0, 0, 1, 1],
  needsReview: true,
};
const nativeLine = {
  id: "native-line-1",
  text: "C．丙",
  box: [0.1, 0.28, 0.3, 0.3],
  itemIds: ["native-item-1"],
};
const native = {
  schemaVersion: NATIVE_TEXT_SCHEMA,
  ok: true,
  engine: NATIVE_TEXT_ENGINE,
  version,
  page: 1,
  total: 1,
  readBytes: 1000,
  items: [],
  lines: [nativeLine],
};
const signal = new AbortController().signal;
const attempt = (line, text = "C. 丙", score = 0.99) => ({
  nativeLineId: line.id,
  image: {
    assetId: "asset_00000000-0000-0000-0000-000000000001",
    sha256: "c".repeat(64),
    width: 100,
    height: 40,
    box: line.box,
  },
  ocr: {
    schemaVersion: "xiaozhi.local-ocr.v1",
    ok: true,
    engine: "rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1",
    text,
    lines: 1,
    width: 100,
    height: 40,
    scores: [score],
  },
});
const input = (recovery) => ({
  resourceId,
  version,
  page: 1,
  totalPages: 1,
  rasterSha256: layout.rasterSha256,
  sourceEngine: layout.engine,
  layoutEngine: "fixture",
  lines: raw,
  regions: [region],
  ...(recovery ? { nativeRecovery: recovery } : {}),
});
function questions(page) {
  const assembler = new StructureQuestionAssembler();
  return [...assembler.push(page), ...assembler.end()];
}
await check(
  "Only native whole-line gaps are selected; existing OCR regions stay unchanged",
  async () => {
    assert.equal(missingNativeLines([nativeLine], raw, [region]).length, 1);
    assert.equal(
      missingNativeLines([{ ...nativeLine, box: [0.1, 0.2, 0.3, 0.22] }], raw, [
        region,
      ]).length,
      0,
    );
    assert.equal(
      missingNativeLines([nativeLine], raw, [{ ...region, kind: "header" }])
        .length,
      0,
    );
    assert.equal(
      missingNativeLines([nativeLine], raw, [{ ...region, kind: "image" }])
        .length,
      0,
    );
  },
);
await check(
  "Concordant crop text restores A/B/C/D while whole-page OCR bytes, IDs and coordinates remain exact",
  async () => {
    const before = structuredClone(raw),
      recovery = await recoverNativeGaps(
        layout,
        native,
        [region],
        signal,
        async (row) => attempt(row),
      );
    assert.equal(recovery.accepted.length, 1);
    const page = recoverStructurePage(input(recovery)),
      q = questions(page)[0];
    assert.deepEqual(
      q.options.map((o) => o.label),
      ["A", "B", "C", "D"],
    );
    assert.equal(q.status, "candidate");
    assert.equal(page.rawText, before.map((l) => l.text).join("\n"));
    assert.deepEqual(raw, before);
    assert.equal(
      page.lines.filter((l) => l.origin === "pdf_native_crop").length,
      1,
    );
    assert(page.needsReview);
  },
);
await check(
  "Hidden or unrecognized native text remains unresolved and holds the question",
  async () => {
    const recovery = await recoverNativeGaps(
      layout,
      native,
      [region],
      signal,
      async (row) => ({ nativeLineId: row.id, error: "empty" }),
    );
    assert.equal(recovery.accepted.length, 0);
    assert.deepEqual(recovery.unresolved, ["native-line-1"]);
    const q = questions(recoverStructurePage(input(recovery)))[0];
    assert.equal(q.status, "needs_review");
    assert(q.issues.includes("native_unconfirmed"));
  },
);
await check(
  "A conflicting crop cannot replace native text or rewrite a recognized OCR line",
  async () => {
    const recovery = await recoverNativeGaps(
      layout,
      native,
      [region],
      signal,
      async (row) => attempt(row, "C. 乙"),
    );
    assert.equal(recovery.accepted.length, 0);
    assert.equal(
      questions(recoverStructurePage(input(recovery)))[0].options.length,
      3,
    );
  },
);
await check("Low-confidence exact crop readings stay unresolved", async () => {
  const recovery = await recoverNativeGaps(
    layout,
    native,
    [region],
    signal,
    async (row) => attempt(row, "C. 丙", 0.84),
  );
  assert.equal(recovery.accepted.length, 0);
  assert.equal(recovery.unresolved.length, 1);
});
await check(
  "Comparison preserves exponents, negation, unit spacing and mathematical symbol distinctions",
  async () => {
    for (const [a, b] of [
      ["x²=3", "x2=3"],
      ["x−1", "x-1"],
      ["10^(-3)", "10^3"],
      ["m s", "ms"],
      ["a b", "ab"],
      ["不等于2", "等于2"],
    ])
      assert.notEqual(nativeCropSignature(a), nativeCropSignature(b));
    assert.equal(
      nativeCropSignature("C．六 米"),
      nativeCropSignature("C.六米"),
    );
  },
);
await check(
  "Original crop receipts and native source strings remain unchanged after comparison",
  async () => {
    const source = structuredClone(native),
      reading = attempt(nativeLine);
    const before = structuredClone(reading);
    await recoverNativeGaps(
      layout,
      native,
      [region],
      signal,
      async () => reading,
    );
    assert.deepEqual(source, native);
    assert.deepEqual(reading, before);
  },
);
await check(
  "Source version and page mismatches fail before any local OCR call",
  async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        recoverNativeGaps(
          layout,
          { ...native, version: "d".repeat(64) },
          [region],
          signal,
          async (row) => {
            calls++;
            return attempt(row);
          },
        ),
      /source_changed/,
    );
    assert.equal(calls, 0);
  },
);
await check(
  "Cancellation before and during a crop never publishes supplementary text",
  async () => {
    const stopped = new AbortController();
    stopped.abort();
    await assert.rejects(() =>
      recoverNativeGaps(layout, native, [region], stopped.signal, async (row) =>
        attempt(row),
      ),
    );
    const during = new AbortController();
    await assert.rejects(() =>
      recoverNativeGaps(
        layout,
        native,
        [region],
        during.signal,
        async (row) => {
          during.abort();
          return attempt(row);
        },
      ),
    );
  },
);
await check(
  "Per-page crop budget is bounded and unprocessed gaps remain visible",
  async () => {
    let calls = 0;
    const lines = Array.from({ length: 9 }, (_, i) => ({
      ...nativeLine,
      id: "native-line-" + (i + 1),
      box: [0.6, 0.6 + i * 0.04, 0.9, 0.62 + i * 0.04],
    }));
    const result = await recoverNativeGaps(
      layout,
      { ...native, lines },
      [region],
      signal,
      async (row) => {
        calls++;
        return attempt(row);
      },
    );
    assert.equal(calls, 8);
    assert(result.unresolved.includes("native-line-9"));
  },
);
await check(
  "Scanning without native text keeps the original OCR path and creates no extra calls",
  async () => {
    let calls = 0;
    const result = await recoverNativeGaps(
      layout,
      { ...native, items: [], lines: [] },
      [region],
      signal,
      async (row) => {
        calls++;
        return attempt(row);
      },
    );
    assert.equal(calls, 0);
    assert.equal(result.unresolved.length, 0);
    assert.equal(
      recoverStructurePage(input(result)).rawText,
      recoverStructurePage(input()).rawText,
    );
  },
);
await check(
  "Physical source identity survives supplementary lines and downstream paragraph renumbering",
  async () => {
    const base = recoverStructurePage(input()),
      baseQuestions = questions(base),
      recovery = await recoverNativeGaps(
        layout,
        native,
        [region],
        signal,
        async (row) => attempt(row),
      ),
      restored = recoverStructurePage(input(recovery)),
      restoredQuestions = questions(restored);
    for (let i = 0; i < baseQuestions.length; i++)
      assert.equal(
        structureOcrSourceKey(baseQuestions[i], [base]),
        structureOcrSourceKey(restoredQuestions[i], [restored]),
      );
    assert.notEqual(baseQuestions[1].id, restoredQuestions[1].id);
    const changed = structuredClone(restored);
    changed.lines[0].text += "改变条件";
    assert.notEqual(
      structureOcrSourceKey(baseQuestions[0], [base]),
      structureOcrSourceKey(restoredQuestions[0], [changed]),
    );
  },
);
await check(
  "Native reader requests reject unknown fields and forged source stamps",
  async () => {
    const request = {
      schemaVersion: NATIVE_TEXT_SCHEMA,
      file: "D:/owned/exam.pdf",
      version,
      stamp: "1:2:3:4:5",
      page: 1,
    };
    assert(validNativeTextRequest(request));
    assert(!validNativeTextRequest({ ...request, extra: true }));
    assert(!validNativeTextRequest({ ...request, stamp: "untrusted" }));
    assert(!validNativeTextRequest({ ...request, page: 0 }));
  },
);
await check(
  "Incomplete crop detection can use a recorded bounded vertical normalization pass",
  async () => {
    const variants = [];
    const result = await recoverNativeGaps(
      layout,
      native,
      [region],
      signal,
      async (row, variant) => {
        variants.push(variant);
        return attempt(row, variant === "original" ? "C." : "C. 丙");
      },
    );
    assert.deepEqual(variants, ["original", "vertical-2x"]);
    assert.equal(result.accepted.length, 1);
    assert.equal(result.accepted[0].attempt, 1);
    assert.equal(result.attempts[1].variant, "vertical-2x");
  },
);
await check(
  "A high-confidence contradiction never searches further variants for a preferred answer",
  async () => {
    let calls = 0;
    const result = await recoverNativeGaps(
      layout,
      native,
      [region],
      signal,
      async (row) => {
        calls++;
        return attempt(row, "C. 乙");
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.accepted.length, 0);
  },
);
console.log(JSON.stringify({ success: true, count: checks.length, checks }));
