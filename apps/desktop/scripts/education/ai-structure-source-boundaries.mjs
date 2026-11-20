import {
  printedChoiceLiteralInstruction,
  PRINTED_CHOICE_LITERAL_ANSWER,
} from "../../src/shared/material-ai-choice-answer.ts";
import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { recoverNativeGaps } from "../../src/main/assets/material-native-gap.ts";
import { recoverStructurePage } from "../../src/main/assets/material-document-structure.ts";
import {
  withAiStructureSource,
  validateAiStructureSource,
} from "../../src/main/assets/material-ai-structure-source.ts";
import {
  validAiStructureContext,
  missingAiStructureQuestions,
} from "../../src/shared/material-ai-structure.ts";
import { pageBlockTexts } from "../../src/shared/material-ai-page-fragments.ts";
import {
  validAiPagePrompt,
  pageTranscriptionAgrees,
  pageTranscriptionStatus,
} from "../../src/shared/material-ai-page.ts";
import { independentLiteralContext } from "../../src/shared/material-ai-literal.ts";
import { aiPageQuestionIssues } from "../../src/main/assets/material-ai-page-publish.ts";
import { completeMaterialAi } from "../../src/main/assets/material-ai-provider.ts";
import { QuestionAssets } from "../../src/main/assets/question-assets.ts";

const checks = [],
  signal = new AbortController().signal;
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function check(name, action) {
  await action();
  checks.push(name);
  console.log("PASS " + name);
}
const root = await fs.mkdtemp(
  path.resolve("test-results/ai-structure-source-"),
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const rasterSha256 = hash(png),
  version = hash("controlled PDF"),
  resourceId = "resource_" + randomUUID();
const assetId = `asset_${rasterSha256.slice(0, 8)}-${rasterSha256.slice(8, 12)}-${rasterSha256.slice(12, 16)}-${rasterSha256.slice(16, 20)}-${rasterSha256.slice(20, 32)}`;
const image = {
  schemaVersion: "xiaozhi.material-page-preview.v1",
  ok: true,
  requestId: randomUUID(),
  resourceId,
  version,
  engine: "pdfium-5.14.0-file-page.v1",
  assetId,
  page: 1,
  total: 1,
  box: [0, 0, 1, 1],
  width: 1,
  height: 1,
  sha256: rasterSha256,
};
function line(id, text, y) {
  const quad = [
    [0.1, y],
    [0.8, y],
    [0.8, y + 0.02],
    [0.1, y + 0.02],
  ];
  return {
    id,
    kind: "text",
    needsReview: true,
    text,
    score: 0.99,
    normalizedQuad: quad,
    quad,
  };
}
const lines = [
  line("line-1", "1. 请选择正确选项。", 0.1),
  line("line-2", "A.甲", 0.2),
  line("line-3", "B.乙", 0.24),
  line("line-4", "D.丁", 0.32),
];
const region = {
  id: "block-1",
  kind: "text",
  score: 0.99,
  box: [0, 0, 1, 1],
  needsReview: true,
};
const blocks = {
  schemaVersion: "xiaozhi.local-page-blocks.v1",
  ok: true,
  engine: "rapid-layout-1.2.1-pp-doclayoutv3-250dbad1.v1",
  rasterSha256,
  width: 1,
  height: 1,
  blocks: [region],
};
const layout = {
  schemaVersion: "xiaozhi.local-pdf-layout.v1",
  ok: true,
  engine: "pdfium-5.14.0-rapidocr-3.9.2-layout.v1",
  inputSha256: version,
  page: 1,
  total: 1,
  width: 1,
  height: 1,
  png: "",
  rasterSha256,
  lines,
};
const nativeLine = {
  id: "native-line-1",
  text: "C.丙",
  box: [0.1, 0.28, 0.8, 0.3],
  itemIds: ["native-item-1"],
};
const native = {
  schemaVersion: "xiaozhi.pdf-native-text.v1",
  ok: true,
  engine: "unpdf-1.8.1/pdfjs-6.1.200-text.v1",
  version,
  page: 1,
  total: 1,
  readBytes: 1000,
  items: [
    {
      id: "native-item-1",
      text: "C.丙",
      box: nativeLine.box,
      transform: [1, 0, 0, 1, 0.1, 0.3],
      width: 0.7,
      height: 0.02,
    },
  ],
  lines: [nativeLine],
};
async function fixture(unresolved = false, printed = false) {
  const db = new DatabaseSync(":memory:"),
    generation = randomUUID();
  db.exec(
    "CREATE TABLE material_structure_jobs(resource_id TEXT,version TEXT,engine TEXT,generation TEXT,status TEXT); CREATE TABLE material_structure_pages(generation TEXT,page INTEGER,body_json TEXT,image_json TEXT,sha256 TEXT)",
  );
  const recovery = await recoverNativeGaps(
    layout,
    native,
    [region],
    signal,
    async (row) => ({
      nativeLineId: row.id,
      sourceAssetId: assetId,
      image: {
        assetId,
        sha256: rasterSha256,
        width: 1,
        height: 1,
        box: row.box,
      },
      ocr: {
        schemaVersion: "xiaozhi.local-ocr.v1",
        ok: true,
        engine: "rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1",
        text: unresolved ? "C.丁" : "C.丙",
        lines: 1,
        width: 1,
        height: 1,
        scores: [0.99],
      },
    }),
  );
  const page = recoverStructurePage({
    resourceId,
    version,
    page: 1,
    totalPages: 1,
    rasterSha256,
    sourceEngine: layout.engine,
    layoutEngine: blocks.engine,
    lines,
    regions: [region],
    nativeRecovery: recovery,
    ...(printed && {printedRecovery:{blanks:[],parents:[{
      line:line("printed-parent-2","2. 计算小球速度。",.4),
      crop:[.1,.4,.8,.42],
      cropSha256:hash("controlled printed crop"),
      readings:["2.","除非忽略","计算小球速度。"],
      engine:"controlled-ocr",
      uncertain:true,
    }]}}),
  });
  db.prepare("INSERT INTO material_structure_jobs VALUES(?,?,?,?,?)").run(
    resourceId,
    version,
    page.engine,
    generation,
    "partial",
  );
  db.prepare("INSERT INTO material_structure_pages VALUES(?,?,?,?,?)").run(
    generation,
    1,
    JSON.stringify(page),
    JSON.stringify(image),
    hash(JSON.stringify(page)),
  );
  const host = {
    root: () => root,
    all: async (sql, args = []) => db.prepare(sql).all(...args),
  };
  const source = {
    schemaVersion: "xiaozhi.material-page-source.v1",
    resourceId,
    version,
    page: 1,
    generation: randomUUID(),
    receiptSha: hash("original parser receipt"),
  };
  const original = {
    blocks,
    lines,
    blockTexts: pageBlockTexts(blocks, layout),
  };
  return {
    db,
    host,
    source,
    original,
    page,
    generation,
    close: () => db.close(),
  };
}
const prompt = (source) => ({
  policy: "page-fragments.v3",
  ocrStatus: "complete",
  totalPages: 1,
  resourceTitle: "fixture.pdf",
  blocks: source.blocks,
  blockTexts: source.blockTexts,
  ...(source.structureContext
    ? { structureContext: source.structureContext }
    : {}),
});
try {
  await new QuestionAssets(() => root).put(image, png, true, signal);
  await check(
    "Actual stored source and crop receipts add only the confirmed missing C line to new block hints",
    async () => {
      const f = await fixture();
      try {
        const before = JSON.stringify(f.original),
          result = await withAiStructureSource(
            f.host,
            f.source,
            f.original,
            signal,
          );
        assert(!f.original.blockTexts[0].text.includes("C.丙"));
        assert(result.blockTexts[0].text.includes("C.丙"));
        assert(
          result.blockTexts[0].text.indexOf("C.丙") <
            result.blockTexts[0].text.indexOf("D.丁"),
        );
        assert.equal(JSON.stringify(f.original), before);
        assert.equal(result.structureContext.supplemental.length, 1);
        assert.deepEqual(result.structureContext.paragraphs, f.page.paragraphs);
        assert(validAiStructureContext(result.structureContext));
        await validateAiStructureSource(
          f.host,
          f.source,
          result.structureContext,
          rasterSha256,
          signal,
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Old stores without structure tables or a v1 job keep their original input path",
    async () => {
      const f = await fixture();
      try {
        f.db
          .prepare(
            "UPDATE material_structure_jobs SET engine='layout-paragraph-question.v1'",
          )
          .run();
        assert.equal(
          await withAiStructureSource(f.host, f.source, f.original, signal),
          f.original,
        );
        f.db.exec("DROP TABLE material_structure_jobs");
        assert.equal(
          await withAiStructureSource(f.host, f.source, f.original, signal),
          f.original,
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Persisted v2, v3 and v4 AI structure receipts remain authentic under the current reader",
    async () => {
      const f = await fixture();
      try {
        for (const engine of ["layout-paragraph-question.v2", "layout-paragraph-question.v3", "layout-paragraph-question.v4"]) {
          const body = JSON.stringify({...f.page,engine:engine});
          f.db.prepare("UPDATE material_structure_pages SET body_json=?,sha256=?").run(body,hash(body));
          f.db.prepare("UPDATE material_structure_jobs SET engine=?").run(engine);
          const legacy = await withAiStructureSource(f.host,f.source,f.original,signal);
          assert.equal(legacy.structureContext.engine,engine);
          f.db.prepare("UPDATE material_structure_jobs SET engine=?").run(f.page.engine);
          await validateAiStructureSource(f.host,f.source,legacy.structureContext,rasterSha256,signal);
          await assert.rejects(()=>withAiStructureSource(f.host,f.source,f.original,signal),/source_changed/);
        }
      } finally {
        f.close();
      }
    },
  );
  await check(
    "An unfinished structure generation cannot silently become a model source",
    async () => {
      const f = await fixture();
      try {
        f.db.exec("UPDATE material_structure_jobs SET status='running'");
        await assert.rejects(
          () => withAiStructureSource(f.host, f.source, f.original, signal),
          /source_incomplete/,
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Source versions, raster identities and original OCR line changes are rejected",
    async () => {
      const f = await fixture();
      try {
        await assert.rejects(
          () =>
            withAiStructureSource(
              f.host,
              { ...f.source, version: hash("different") },
              f.original,
              signal,
            ),
          /source_incomplete/,
        );
        for (const changed of [
          {
            ...f.original,
            blocks: { ...blocks, rasterSha256: hash("different raster") },
          },
          {
            ...f.original,
            lines: lines.map((row, i) =>
              i ? row : { ...row, text: "changed condition" },
            ),
          },
        ])
          await assert.rejects(
            () => withAiStructureSource(f.host, f.source, changed, signal),
            /source_changed/,
          );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Snapshot and frozen-context tampering fail authentication",
    async () => {
      const f = await fixture();
      try {
        const result = await withAiStructureSource(
            f.host,
            f.source,
            f.original,
            signal,
          ),
          changed = structuredClone(result.structureContext);
        changed.paragraphs[0].text += "invented";
        await assert.rejects(
          () =>
            validateAiStructureSource(
              f.host,
              f.source,
              changed,
              rasterSha256,
              signal,
            ),
          /source_changed/,
        );
        f.db.exec(
          "UPDATE material_structure_pages SET body_json=replace(body_json,'请选择','请随便选')",
        );
        await assert.rejects(
          () =>
            validateAiStructureSource(
              f.host,
              f.source,
              result.structureContext,
              rasterSha256,
              signal,
            ),
          /source_changed/,
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Frozen OCR block hints must match the same authenticated paragraph order",
    async () => {
      const f = await fixture();
      try {
        const result = await withAiStructureSource(
          f.host,
          f.source,
          f.original,
          signal,
        );
        await validateAiStructureSource(
          f.host,
          f.source,
          result.structureContext,
          rasterSha256,
          signal,
          result,
        );
        const changed = structuredClone(result);
        changed.blockTexts[0].text = changed.blockTexts[0].text.replace(
          "C.丙",
          "C.丁",
        );
        await assert.rejects(
          () =>
            validateAiStructureSource(
              f.host,
              f.source,
              result.structureContext,
              rasterSha256,
              signal,
              changed,
            ),
          /source_changed/,
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Damaged PNG source bytes cannot authenticate a frozen structure",
    async () => {
      const f = await fixture();
      try {
        const result = await withAiStructureSource(
          f.host,
          f.source,
          f.original,
          signal,
        );
        const file = path.join(root, "question-assets", "v1", assetId + ".png");
        try {
          await fs.writeFile(
            file,
            Buffer.concat([png, Buffer.from("changed")]),
          );
          await assert.rejects(() =>
            validateAiStructureSource(
              f.host,
              f.source,
              result.structureContext,
              rasterSha256,
              signal,
            ),
          );
        } finally {
          await fs.writeFile(file, png);
        }
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Frozen historical structure sources remain authentic after a new generation starts",
    async () => {
      const f = await fixture();
      try {
        const result = await withAiStructureSource(
          f.host,
          f.source,
          f.original,
          signal,
        );
        f.db
          .prepare(
            "UPDATE material_structure_jobs SET generation=?,status='running'",
          )
          .run(randomUUID());
        await validateAiStructureSource(
          f.host,
          f.source,
          result.structureContext,
          rasterSha256,
          signal,
        );
      } finally {
        f.close();
      }
    },
  );
  for (const printed of [false, true]) await check(
    (printed ? "Unresolved printed crops" : "Unresolved native gaps") + " are retained and force transcription and question review",
    async () => {
      const f = await fixture(!printed, printed);
      try {
        const result = await withAiStructureSource(
            f.host,
            f.source,
            f.original,
            signal,
          ),
          p = prompt(result);
        assert.equal(result.structureContext.supplemental.length, printed ? 1 : 0);
        assert.equal(result.structureContext.unresolved.length, 1);
        if (printed) {
          assert.deepEqual(result.structureContext.unresolved, ["printed-parent-2"]);
          assert(!result.structureContext.supplemental.some(line => line.lineId.includes("printed-parent-2")));
          await validateAiStructureSource(f.host,f.source,result.structureContext,rasterSha256,signal,result);
        }
        const response = {
          schemaVersion: "xiaozhi.material-ai-page-fragments.v1",
          outcome: "no_questions",
          questions: [],
          pageText: "原页内容",
          pageIssues: [],
          fragments: [],
        };
        assert.equal(pageTranscriptionAgrees(response, response, p), false);
        assert.equal(
          pageTranscriptionStatus(response, response, p),
          "needs_review",
        );
        const q = {
          number: "1",
          stem: "测试题",
          answer: "甲",
          analysis: "步骤",
          subject: "物理",
          grade: "初三",
          knowledgePoint: "运动",
          questionType: "选择题",
          difficulty: "easy",
          answerOrigin: "ai_generated",
          analysisOrigin: "ai_generated",
          requiresImage: false,
          issues: [],
          projection: Object.fromEntries(
            [
              "statement",
              "choices",
              "subquestions",
              "tables",
              "formulas",
              "figures",
            ].map((role) => [
              role,
              {
                state: role === "statement" ? "provided" : "not_applicable",
                text: role === "statement" ? "测试题" : "",
              },
            ]),
          ),
        };
        assert(
          aiPageQuestionIssues(
            { ...response, questions: [q] },
            { ...response, questions: [q] },
            f.source,
            rasterSha256,
            q,
            p,
          ).includes("uncertain_ocr"),
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "A final model draft cannot silently omit the corroborated C option or attach it only to another question",
    async () => {
      const f = await fixture();
      try {
        const p = prompt(
          await withAiStructureSource(f.host, f.source, f.original, signal),
        );
        const complete = {
          pageText: "第1题 请选择正确选项。 A.甲 B.乙 C．丙 D.丁",
          questions: [
            { number: "1", stem: "请选择正确选项。 A.甲 B.乙 C．丙 D.丁" },
          ],
        };
        assert.deepEqual(
          missingAiStructureQuestions(p.structureContext, complete),
          [],
        );
        const lost = {
          pageText: complete.pageText,
          questions: [
            { number: "1", stem: "请选择正确选项。 A.甲 B.乙 D.丁" },
            { number: "2", stem: "C.丙" },
          ],
        };
        assert.deepEqual(
          missingAiStructureQuestions(p.structureContext, lost),
          ["1"],
        );
        assert.deepEqual(
          missingAiStructureQuestions(p.structureContext, {
            pageText: "C.丁",
            questions: lost.questions,
          }),
          ["1"],
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Strict prompt validation binds the structure raster and rejects oversized or unknown context",
    async () => {
      const f = await fixture();
      try {
        const p = prompt(
          await withAiStructureSource(f.host, f.source, f.original, signal),
        );
        assert(validAiPagePrompt(p));
        for (const mutate of [
          (v) => (v.extra = true),
          (v) => (v.reference.rasterSha256 = hash("other")),
          (v) => (v.supplemental[0].score = 0.84),
          (v) => (v.paragraphs[0].text = "甲".repeat(15000)),
          (v) => v.paragraphs.push(v.paragraphs[0]),
        ]) {
          const changed = structuredClone(p);
          mutate(changed.structureContext);
          assert.equal(validAiPagePrompt(changed), false);
        }
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Independent source transcription excludes all restored paragraph and supplementary OCR hints",
    async () => {
      const f = await fixture();
      try {
        const p = prompt(
          await withAiStructureSource(f.host, f.source, f.original, signal),
        );
        const result = independentLiteralContext(
          {
            phase: "source",
            pageContext: p,
            material: "secret hints",
            firstDraft: { questions: [], fragments: [] },
            cropReview: { questions: [] },
          },
          true,
        );
        assert(!Object.hasOwn(result.pageContext, "structureContext"));
        assert(!Object.hasOwn(result.pageContext, "blockTexts"));
        assert(!JSON.stringify(result).includes("C.丙"));
      } finally {
        f.close();
      }
    },
  );
  await check(
    "Production provider sends the frozen paragraph context with faithful-source instructions",
    async () => {
      const f = await fixture(),
        originalFetch = globalThis.fetch,
        requests = [];
      try {
        const p = prompt(
          await withAiStructureSource(f.host, f.source, f.original, signal),
        );
        globalThis.fetch = async (_, options) => {
          requests.push(JSON.parse(options.body));
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content: JSON.stringify({
                      schemaVersion: "xiaozhi.material-ai-page-fragments.v1",
                      outcome: "no_questions",
                      pageText: "非题内容",
                      pageIssues: [],
                      questions: [],
                      fragments: [],
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          );
        };
        await completeMaterialAi(
          {
            model: "deepseek-flash",
            apiKey: "test-only",
            text: "原始文字",
            page: true,
            pagePrompt: p,
            imageCoverage: true,
            image: { data: png.toString("base64"), mime: "image/png" },
          },
          signal,
        );
        assert(requests[0].messages[0].content.includes("本地段落与补充识别"));
        assert.deepEqual(
          JSON.parse(requests[0].messages[1].content[0].text).pageContext
            .structureContext,
          p.structureContext,
        );
      } finally {
        globalThis.fetch = originalFetch;
        f.close();
      }
    },
  );
  await check(
    "Versioned literal choice formatting targets nested generated answers and keeps old/source-only prompts unchanged",
    () => {
      const legacy = { policy: "page-fragments.v3" };
      assert.equal(printedChoiceLiteralInstruction(legacy, false), "");
      const enabled = {
        ...legacy,
        literalChoiceAnswerPolicy: PRINTED_CHOICE_LITERAL_ANSWER,
      };
      assert.equal(printedChoiceLiteralInstruction(enabled, true), "");
      const instruction = printedChoiceLiteralInstruction(enabled, false);
      assert(instruction.includes("answer.text仅填写"));
      assert(instruction.includes("写入analysis.text"));
      assert(instruction.includes(PRINTED_CHOICE_LITERAL_ANSWER));
    },
  );
  await check("Cancellation publishes no supplementary input", async () => {
    const f = await fixture(),
      controller = new AbortController();
    try {
      controller.abort();
      await assert.rejects(
        () =>
          withAiStructureSource(
            f.host,
            f.source,
            f.original,
            controller.signal,
          ),
        /abort|cancel/i,
      );
    } finally {
      f.close();
    }
  });
  if (process.argv[2])
    await check(
      "The actual two-column PDF authenticates its real PNG assets and restores the omitted option in AI hints",
      async () => {
        const dataRoot = path.resolve(process.argv[2]),
          db = new DatabaseSync(path.join(dataRoot, "data", "app.db"), {
            readOnly: true,
          });
        try {
          const row = db
            .prepare(
              "SELECT j.generation,p.body_json,r.id,r.content_hash FROM material_structure_jobs j JOIN material_structure_pages p ON p.generation=j.generation JOIN teacher_resources r ON r.id=j.resource_id WHERE r.original_file_name='native-recovery-two-column.pdf' AND p.page=1",
            )
            .get();
          assert(row);
          const page = JSON.parse(row.body_json),
            raw = page.lines
              .filter((line) => !line.origin)
              .map((line) => ({
                id: line.sourceId,
                kind: "text",
                needsReview: true,
                text: line.text,
                score: line.score,
                normalizedQuad: line.quad,
                quad: line.quad,
              }));
          const image = JSON.parse(
            db
              .prepare(
                "SELECT image_json FROM material_structure_pages WHERE generation=? AND page=1",
              )
              .get(row.generation).image_json,
          );
          const b = {
            ...blocks,
            rasterSha256: page.rasterSha256,
            width: image.width,
            height: image.height,
            blocks: page.regions,
          };
          const host = {
              root: () => path.join(dataRoot, "data"),
              all: async (sql, args = []) => db.prepare(sql).all(...args),
            },
            source = {
              schemaVersion: "xiaozhi.material-page-source.v1",
              resourceId: row.id,
              version: row.content_hash,
              page: 1,
              generation: randomUUID(),
              receiptSha: hash("probe"),
            };
          const original = {
              blocks: b,
              blockTexts: pageBlockTexts(b, { ...b, lines: raw }),
              lines: raw,
            },
            result = await withAiStructureSource(
              host,
              source,
              original,
              signal,
            );
          assert.equal(result.structureContext.supplemental.length, 1);
          const unitRow = db
            .prepare(
              "SELECT input_json FROM material_ai_units ORDER BY rowid DESC LIMIT 1",
            )
            .get();
          if (unitRow) {
            const paid = JSON.parse(unitRow.input_json),
              before = unitRow.input_json;
            assert(
              validAiPagePrompt({
                ...paid.pagePrompt,
                literalChoiceAnswerPolicy: PRINTED_CHOICE_LITERAL_ANSWER,
              }),
            );
            assert.equal(
              db
                .prepare(
                  "SELECT input_json FROM material_ai_units ORDER BY rowid DESC LIMIT 1",
                )
                .get().input_json,
              before,
            );
          }
          assert(
            !original.blockTexts.some((block) => block.text.includes("六米")),
          );
          assert(
            result.blockTexts.some((block) => block.text.includes("六米")),
          );
          await validateAiStructureSource(
            host,
            source,
            result.structureContext,
            page.rasterSha256,
            signal,
          );
          console.log(
            JSON.stringify({
              actualContextBytes: Buffer.byteLength(
                JSON.stringify(result.structureContext),
              ),
              paragraphs: result.structureContext.paragraphs.length,
              supplemental: result.structureContext.supplemental.length,
            }),
          );
        } finally {
          db.close();
        }
      },
    );
  console.log(JSON.stringify({ success: true, count: checks.length, checks }));
} finally {
  const relative = path.relative(path.resolve("test-results"), root);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  assert(!(await fs.lstat(root)).isSymbolicLink());
  assert.equal((await fs.realpath(root)).toLowerCase(), root.toLowerCase());
  await fs.rm(root, { recursive: true });
}
