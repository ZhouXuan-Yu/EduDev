import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
const { recoverStructurePage, StructureQuestionAssembler, joinStructureLines } =
  await import("../../src/main/assets/material-document-structure.ts");
const { localizedPdfMarkProof, separatedMarkPixels, verifiedQuestionInPdfConflict, verifiedQuestionBeforeNativeSection } =
  await import("../../src/main/assets/material-pdf-question-conflict.ts");
const { printedBlanks, printedBlankStripe, printedParentProbes, readPrintedParent } =
  await import("../../src/main/assets/material-printed-structure.ts");
const { printedStructureQuestionType } =
  await import("../../src/main/assets/material-structure-question-type.ts");
const { choiceLabelsForReview, missingChoiceLabels, validStructureImageQuery, validStructureQuery } =
  await import("../../src/shared/material-document-structure.ts");
const { planChoiceRecheck, matchChoiceRecheck, choiceRecheckReadings } =
  await import("../../src/main/assets/material-structure-choice-recheck.ts");
const { ruledTableGrid, ruledTableLayout, evidenceForTable, readStructureTables } =
  await import("../../src/main/assets/material-structure-ruled-table.ts");
const { linkStructureTableContinuations } =
  await import("../../src/main/assets/material-structure-table-continuation.ts");
const { verifiedNumericTableRow } =
  await import("../../src/main/assets/material-structure-borderless-table.ts");
const { readableFormulaLatex, validFormulaRecognitionQuery } =
  await import("../../src/shared/material-formula-recognition.ts");
const results = [];
async function check(name, run) {
  await run();
  results.push(name);
  console.log("PASS " + name);
}
function page(rows, number = 1, total = 1, extra = [], printedRecovery, nativeRecovery) {
  const lines = rows.map((row, index) => {
    const [
        text,
        x = 0.1,
        y = 0.1 + index * 0.027,
        w = 0.8,
        kind = "text",
        score = 0.97,
      ] = row,
      box = [x, y, x + w, y + 0.018],
      quad = [
        [box[0], box[1]],
        [box[2], box[1]],
        [box[2], box[3]],
        [box[0], box[3]],
      ];
    return {
      id: "line-" + (index + 1),
      kind: "text",
      text,
      score,
      quad: quad.map(([a, b]) => [a * 1000, b * 1000]),
      normalizedQuad: quad,
      needsReview: true,
    };
  });
  const regions = lines.map((line, index) => ({
    id: "block-" + (index + 1),
    kind: rows[index][4] || "text",
    score: 0.98,
    box: [
      line.normalizedQuad[0][0],
      line.normalizedQuad[0][1],
      line.normalizedQuad[2][0],
      line.normalizedQuad[2][1],
    ],
    needsReview: true,
  }));
  return recoverStructurePage({
    resourceId: "resource_12345678-1234-1234-1234-123456789abc",
    version: "a".repeat(64),
    page: number,
    totalPages: total,
    rasterSha256: "b".repeat(64),
    sourceEngine: "controlled-ocr",
    layoutEngine: "controlled-layout",
    lines,
    regions: [...regions, ...extra],
    ...(printedRecovery && { printedRecovery }),
    ...(nativeRecovery && { nativeRecovery }),
  });
}
function questions(pages) {
  const builder = new StructureQuestionAssembler();
  return [...pages.flatMap((page) => builder.push(page)), ...builder.end()];
}

await check("Formula recognition accepts only versioned source identity and safe renderable TeX candidates", () => {
  const request = { reference: {
    schemaVersion: "xiaozhi.document-structure.v1", resourceId: "resource_" + "a".repeat(36),
    candidateId: "sq_" + "b".repeat(40), generation: "c".repeat(36), sha256: "d".repeat(64), version: "e".repeat(64),
  }, page: 2, regionId: "block-2", requestId: "f".repeat(36), action: "run" };
  assert(validFormulaRecognitionQuery(request));
  assert(!validFormulaRecognitionQuery({ ...request, regionId: "../arbitrary.png" }));
  assert(!validFormulaRecognitionQuery({ ...request, box: [.1, .2, .3, .4] }));
  assert(!validFormulaRecognitionQuery({ ...request, reference: { ...request.reference, version: "old" } }));
  for (const reading of ["y=\\sqrt{x^{2}+9}", "E_k=\\frac{1}{2}mv^2", "\\frac{-3x+2}{5x-7}", "x<y"]) {
    assert(readableFormulaLatex(reading));
  }
  for (const reading of ["-", "", "v=3.50~/mathrm", "\\frac{1}{", "$x$", "x\u0000", "\\href{https://example.com}{x}", "\\includegraphics{a.png}"]) {
    assert(!readableFormulaLatex(reading));
  }
});

function alignedTableFixture() {
  const raster = { width: 320, height: 300, pixels: Buffer.alloc(320 * 300 * 4, 255) };
  const region = { id: "aligned", kind: "table", score: .95, box: [.12, .2, .88, .69] };
  const lines = [["样品", "含量", "耗时"], ["甲", "0.40", "12"], ["乙", "0.05", "24"], ["丙", "1.25", "6"]]
    .flatMap((row, y) => row.map((text, x) => {
      const right = .25 + .28 * x;
      const left = right - (x === 2 ? .035 + .012 * text.length : .07);
      return { id: `aligned-${y}-${x}`, text, box: [left, .25 + .12 * y, right, .285 + .12 * y],
        score: .99, regionIds: [region.id] };
    }));
  const page = { page: 1, rasterSha256: "8".repeat(64), regions: [region], lines, issues: [] };
  return { page, region, lines, raster };
}

await check("Aligned tables preserve exact OCR cells and leave a low-confidence reading held", () => {
  const { page, region, lines, raster } = alignedTableFixture();
  lines[7].score = .85;
  const [table] = readStructureTables(page, () => raster);
  assert.equal(table.layout, "aligned_text");
  assert.deepEqual(table.box, region.box);
  assert.deepEqual(table.rows.map(row => row.map(cell => cell.text)), [
    ["样品", "含量", "耗时"], ["甲", "0.40", "12"], ["乙", "", "24"], ["丙", "1.25", "6"],
  ]);
  assert.deepEqual(table.rows.flat().flatMap(cell => cell.lineIds), lines.map(line => line.id));
  assert.equal(table.rows[2][1].needsReview, true);
});

await check("Borderless inference refuses prose, choice columns, competing owners, absent cells and damaged ruled grids", () => {
  const variants = [
    ({ region }) => { region.kind = "text"; },
    ({ region }) => { region.score = .8; },
    ({ page }) => { page.issues.push("ambiguous_columns"); },
    ({ lines }) => { lines[6].regionIds.unshift("stronger-owner"); },
    ({ lines }) => { lines.splice(6, 1); },
    ({ lines }) => { lines[0].text = "A．甲"; lines[3].text = "B．乙"; },
    ({ lines }) => { lines[0].box[2] += .22; },
    ({ raster }) => { for (let y = 63; y < 137; y++) raster.pixels.fill(4, (y * 320 + 105) * 4, (y * 320 + 105) * 4 + 3); },
  ];
  for (const variant of variants) {
    const fixture = alignedTableFixture();
    variant(fixture);
    assert.deepEqual(readStructureTables(fixture.page, () => fixture.raster), []);
  }
});
function continuationFixture({ marker = "续表", nextPage = 2, units = "长度(cm)", shift = 0 } = {}) {
  const previous = page([["表 2 测量记录", 0.1, 0.68, 0.3]], 1, nextPage);
  const next = page([[marker, 0.1, 0.13, 0.2]], nextPage, nextPage);
  function table(source, top, header, offset) {
    return {
      page: source.page, regionId: `table-${source.page}`, rasterSha256: source.rasterSha256,
      box: [0.1 + offset, top, 0.7 + offset, top + 0.14],
      rows: [["组别", header, "宽度(cm)"], ["第一组", "18.5", "8.5"]].map((row, y) => row.map((text, x) => ({
        box: [0.1 + x * 0.2 + offset, top + y * 0.07, 0.3 + x * 0.2 + offset, top + (y + 1) * 0.07],
        text, lineIds: [`row-${y}-${x}`], needsReview: false,
      }))),
    };
  }
  const sources = [table(previous, 0.73, "长度（cm）", 0), table(next, 0.18, units, shift)];
  return { links: () => linkStructureTableContinuations(sources, new Map([[1, previous], [nextPage, next]])),
    sources, previous, next };
}

await check("Explicit continuation labels and compatible physical headers preserve source links without mutating page tables", () => {
  for (const marker of ["续表", "（续表）", "表 ２（续）"]) {
    const { links, sources } = continuationFixture({ marker, shift: 0.008 });
    assert.deepEqual(links()[1].continuesFrom, { page: 1, regionId: sources[0].regionId });
    assert.equal(sources[1].continuesFrom, undefined);
    assert.deepEqual(links()[1].rows, sources[1].rows);
  }
});

await check("Numeric table fusion requires a unique physical gap, corroborating rows, and exact independent crop readings", () => {
  const ink = (raster, x0, x1) => {
    for (let y = 148; y < 156; y++) for (let x = x0; x < x1; x++) {
      const at = (y * raster.width + x) * 4;
      raster.pixels.fill(0, at, at + 3);
    }
  };
  const make = () => {
    const fixture = alignedTableFixture();
    const fused = { ...fixture.lines[7], text: "-20.514.25", box: [.46, .49, .78, .525] };
    fixture.lines.splice(7, 2, fused);
    ink(fixture.raster, 149, 183);
    ink(fixture.raster, 202, 246);
    return fixture;
  };
  const { page, raster } = make();
  const pending = [];
  assert.deepEqual(readStructureTables(page, () => raster, pending), []);
  assert.equal(pending.length, 1);
  const [{ split }] = pending;
  assert.deepEqual([split.row, split.leftColumn], [2, 1]);
  const read = part => ({
    receipt: { text: part, lines: 1, scores: [.98], engine: "test-engine" }, cropSha256: "a".repeat(64),
  });
  const readings = [read("-20.5"), read("14.25")];
  assert.deepEqual(verifiedNumericTableRow(split, readings)?.parts.map(part => part.text), ["-20.5", "14.25"]);
  for (const wrong of [[read("20.5"), read("14.25")], [read("-20.51"), read("4.25X")],
    readings.toReversed(), [read("-20.5")], [read("-20.50"), read("14.25")]]) assert(!verifiedNumericTableRow(split, wrong));
  readings[1].receipt.scores[0] = .89;
  assert(!verifiedNumericTableRow(split, readings));
  const noGap = make();
  ink(noGap.raster, 180, 207);
  const rejected = [];
  assert.deepEqual(readStructureTables(noGap.page, () => noGap.raster, rejected), []);
  assert.equal(rejected.length, 0);
});
await check("Missing or wrong labels, changed units, missing pages and shifted columns leave table fragments independent", () => {
  for (const test of [{ marker: "测量记录" }, { marker: "表 3（续）" }, { units: "长度(mm)" }, { nextPage: 3 }, { shift: 0.035 }]) {
    const { links, sources } = continuationFixture(test);
    assert.deepEqual(links(), sources);
  }
});

await check("Competing tables, a new question boundary, or an unverified header prevent continuation", () => {
  const duplicates = continuationFixture();
  duplicates.sources.push({ ...duplicates.sources[0], regionId: "second-possible-previous-table" });
  assert.deepEqual(duplicates.links(), duplicates.sources);
  const afterBoundary = continuationFixture();
  afterBoundary.next.paragraphs.push({
    role: "question", marker: { kind: "parent", label: "11" }, anchor: { page: 2, box: [0.1, 0.155, 0.5, 0.172] },
  });
  assert.deepEqual(afterBoundary.links(), afterBoundary.sources);
  for (const defect of [{ needsReview: true }, { rowSpan: 2 }, { lineIds: [] }]) {
    const { links, sources } = continuationFixture();
    Object.assign(sources[1].rows[0][0], defect);
    assert.deepEqual(links(), sources);
  }
});

await check("Exactly corroborated local header readings can link tables while preserving pending cells", () => {
  const { links, sources, next } = continuationFixture();
  const cell = sources[1].rows[0][1];
  Object.assign(cell, { needsReview: true, text: "" });
  const line = {
    id: cell.lineIds[0], text: "长度(cm)", score: 0.9, regionIds: [sources[1].regionId],
    box: [0.33, 0.19, 0.45, 0.215],
  };
  next.lines.push(line);
  assert.deepEqual(links()[1].continuesFrom, { page: 1, regionId: sources[0].regionId });
  assert(cell.needsReview && !cell.text);
  for (const defect of [{ text: "长度(mm)" }, { score: 0.7 }, { box: [0.25, 0.19, 0.45, 0.215] }, { regionIds: ["other"] }]) {
    const saved = { ...line };
    Object.assign(line, defect);
    assert.deepEqual(links(), sources);
    Object.assign(line, saved);
  }
  cell.suspectedOverprint = true;
  assert.deepEqual(links(), sources);
});

await check("A complete ruled grid preserves position and refuses broken, merged and colored separator lines", () => {
  const make = ({ merged = false, tint = false, broken = false } = {}) => {
    const width = 180, height = 110, pixels = Buffer.alloc(width * height * 4, 255);
    const dot = (x, y) => {
      const i = (y * width + x) * 4;
      pixels[i] = 32; pixels[i + 1] = 16; pixels[i + 2] = tint ? 220 : 12;
    };
    for (const x of [16,65,113,163]) for (let y = 17; y <= 93; y++)
      if (!((merged && x === 65 && y > 56) || (broken && x === 113 && y > 52 && y < 81))) dot(x,y);
    for (const y of [17,53,93]) for (let x = 16; x <= 163; x++) dot(x,y);
    return {width,height,pixels};
  };
  const region = [16/180,17/110,163/180,93/110];
  const grid = ruledTableGrid(make(),region);
  assert.deepEqual(grid.map(row => row.length),[3,3]);
  assert.equal(grid[0][1][0],grid[0][0][2]);
  for (const mode of [{ merged: true }, { tint: true }, { broken: true }]) assert(!ruledTableGrid(make(mode),region));
  assert(!ruledTableGrid({...make(),pixels:Buffer.alloc(1)},region));
  const lines = [
    {id:"clean",text:"12",score:.98,box:[22/180,24/110,36/180,42/110]},
    {id:"unclear",text:"I",score:.71,box:[122/180,25/110,140/180,43/110]},
    {id:"fused",text:"7 8",score:.99,box:[54/180,59/110,89/180,83/110]},
  ];
  const result = evidenceForTable(grid, lines);
  assert.equal(result[0][0].text,"12");
  assert.equal(result[0][0].needsReview,false);
  for (const cell of [result[0][1], result[0][2], ...result[1]]) {
    assert.equal(cell.text, "");
    assert.equal(cell.needsReview, true);
  }
});
await check("Only a local divider attached to an existing grid crossing can veto the grid", () => {
  const width=360,height=300,region=[24/360,20/300,335/360,268/300];
  for(const horizontal of [false,true]){
    for(const connected of [false,true]){
      const pixels=Buffer.alloc(width*height*4,255);
      const dot=(x,y)=>pixels.fill(12,(y*width+x)*4,(y*width+x)*4+3);
      for(const x of [24,176,335])for(let y=20;y<=268;y++)dot(x,y);
      for(const y of [20,136,268])for(let x=24;x<=335;x++)dot(x,y);
      if(horizontal){for(let x=connected?24:36;x<165;x++)dot(x,78);}
      else{for(let y=connected?136:148;y<257;y++)dot(242,y);}
      const grid=ruledTableGrid({width,height,pixels},region);
      if(connected)assert.equal(grid,undefined);
      else assert.deepEqual(grid.map(row=>row.length),[2,2]);
    }
  }
});
await check("Confirmed missing internal separators recover rectangular row and column spans, with malformed layouts held", () => {
  const width=260,height=200,xs=[16,90,165,242],ys=[15,65,120,181];
  const region=[xs[0]/width,ys[0]/height,xs[3]/width,ys[3]/height];
  function raster(mode){
    const pixels=Buffer.alloc(width*height*4,255);
    const dot=(x,y)=>pixels.fill(12,(y*width+x)*4,(y*width+x)*4+3);
    for(const x of xs)for(let y=ys[0];y<=ys[3];y++){
      if(x===xs[2]&&y>ys[0]&&y<ys[1])continue;
      if(x===xs[0]&&mode==='open'&&y>ys[1]&&y<ys[2])continue;
      if(x===xs[1]&&mode==='broken'&&y>ys[2]+8&&y<ys[3]-8)continue;
      dot(x,y);
    }
    for(const y of ys)for(let x=xs[0];x<=xs[3];x++){
      if(y===ys[2]&&x>xs[0]&&x<xs[1])continue;
      if(y===ys[1]&&mode==='nonrectangular'&&x>xs[1]&&x<xs[2])continue;
      dot(x,y);
    }
    return {width,height,pixels};
  }
  const layout=ruledTableLayout(raster('merged'),region);
  assert.deepEqual(layout.map(row=>row.length),[3,3,3]);
  assert.equal(layout[0][1].columnSpan,2);
  assert.equal(layout[0][2].covered,true);
  assert.equal(layout[1][0].rowSpan,2);
  assert.equal(layout[2][0].covered,true);
  assert.deepEqual(layout[0][1].box,[90/260,15/200,242/260,65/200]);
  for(const mode of ['broken','open','nonrectangular'])assert.equal(ruledTableLayout(raster(mode),region),undefined);
});
const formulaRows = [
  ["15. 已知质量、压强和时间，求物体受力。", .10, .42, .55],
  ["pwD", .63, .488, .04], ["物体所受压力可记为T=", .39, .50, .24],
  ["ZｉZz", .73, .507, .08], ["ν", .641, .512, .026],
  ["16. 求物体移动的距离。", .10, .61, .50],
];
const formulaRegion = { id: "equation-text", kind: "text", score: .68, box: [.37,.48,.85,.56], needsReview: true };
await check("An unclassified stacked formula retains review-only source pixels and all original OCR lines", () => {
  const p = page(formulaRows, 1, 1, [formulaRegion]);
  const [q, following] = questions([p]);
  assert.equal(q.status, "needs_review");
  assert(q.issues.includes("formula_text_unconfirmed"));
  assert.equal(q.formulaSources.length, 1);
  const [source] = q.formulaSources;
  assert.equal(source.page, 1);
  assert.equal(source.rasterSha256, p.rasterSha256);
  assert(source.box[0] < .63 && source.box[2] > .8 && source.box[3] < .56);
  assert.deepEqual(source.lineIds.map(id => p.lines.find(line => line.id === id).text),
    ["物体所受压力可记为T=", "pwD", "ν", "ZｉZz"]);
  assert(q.stem.includes("ZｉZz") && p.rawText.includes("ν"));
  assert.equal(following.formulaSources, undefined);
});
await check("Formula recovery requires unique aligned pieces inside the same question and does not duplicate a proven layout region", () => {
  const known = { id: "known-formula", kind: "inline_formula", score: .98, box: [.592,.485,.825,.537], needsReview: true };
  const separated = formulaRows.map(line => line[0] === "ν" ? ["ν", .77, .512, .026] : line);
  const cases = [
    page(formulaRows.filter(line => line[0] !== "ν"), 1, 1, [formulaRegion]),
    page([...formulaRows.slice(0, 4), ["16. 求剩余部分。", .1, .509, .28], formulaRows[4]], 1, 1, [formulaRegion]),
    page(separated, 1, 1, [formulaRegion]),
    page(formulaRows, 1, 1, [formulaRegion, known]),
  ];
  for (const p of cases) assert(questions([p]).every(q => !q.formulaSources?.length));
});
await check("The optional raster identity is exclusive to image reads and rejects malformed values", () => {
  const query = {resourceId:"resource_12345678-1234-1234-1234-123456789abc",version:"a".repeat(64),page:2};
  assert(validStructureImageQuery(query));
  const pinned = {...query,rasterSha256:"b".repeat(64)};
  assert(validStructureImageQuery(pinned));
  assert(!validStructureQuery(pinned));
  for (const bad of [{...pinned, path:"a.pdf"},{...pinned,rasterSha256:"wrong"},{...pinned,page:0}])
    assert(!validStructureImageQuery(bad));
});
await check("Printed option counts and observed label gaps prevent import from silently dropping choices", () => {
  const root = ["一、选择题（各题均有四个选项）", .1, .06];
  const [short, none, complete, freeResponse] = questions([page([
    root, ["7. 求长方形面积。", .1, .11], ["A. 6 B. 8", .1, .15],
    ["8. 求等差数列的公差。", .1, .23],
    ["9. 求长方体体积。", .1, .31], ["A. 3 B. 6 C. 8 D. 10", .1, .35],
    ["二、解答题", .1, .44], ["10. 证明上述结论。", .1, .5],
  ])]);
  assert.deepEqual(missingChoiceLabels(short.options, short.expectedChoiceCount), ["C", "D"]);
  assert.deepEqual(missingChoiceLabels(none.options, none.expectedChoiceCount), ["A", "B", "C", "D"]);
  for (const q of [short, none]) assert(q.issues.includes("missing_choice_options") && q.status === "needs_review");
  assert.equal(complete.status, "candidate");
  assert(!freeResponse.issues.includes("missing_choice_options"));

  const [gap, binary] = questions([page([
    ["一、选择题", .1, .06], ["4. 求正数平方根。", .1, .11], ["A. 2", .1, .15], ["C. 4", .1, .18],
    ["5. 判断命题。", .1, .23], ["A. 真 B. 假", .1, .27],
  ])]);
  assert.deepEqual(missingChoiceLabels(gap.options), ["B"]);
  assert(gap.issues.includes("missing_choice_options"));
  assert(!binary.issues.includes("missing_choice_options"));
});
await check("A bare choice marker stays in review while original picture choices remain usable", () => {
  const [q] = questions([page([
    ["一、选择题", .1, .07], ["19. 已知三个条件求结果。", .1, .13],
    ["A. 6 B. 8 C. 9 D.", .1, .19],
  ])]);
  assert.deepEqual(choiceLabelsForReview(q), ["D"]);
  assert(q.issues.includes("missing_choice_options"));
  assert.equal(q.status, "needs_review");
  assert.deepEqual(choiceLabelsForReview({ ...q, assets: [{ choiceLabel: "D" }] }), []);
});
await check("Only ambiguous horizontally aligned options with independent line boxes enter the local recheck", () => {
  const lead = [["一、选择题", .1, .07], ["7. 已知三个条件求结果。", .1, .13]];
  const proposed = page([...lead, ["(C) 2", .48, .19, .055], ["(D) 3", .66, .19, .055]]);
  const question = questions([proposed])[0];
  const plan = planChoiceRecheck(question, proposed);
  assert.deepEqual(plan.labels, ["A", "B"]);
  assert(plan.box[0] < .12 && plan.box[2] > .71 && plan.box[3] < .23);
  for (const other of [page([...lead, ["(C) 2", .48, .19, .055], ["(D) 3", .66, .23, .055]]),
    { ...proposed, issues: ["ambiguous_columns"] }]) assert(!planChoiceRecheck(questions([other])[0], other));
  assert(!planChoiceRecheck({ ...question, pageRange: [1,2] }, proposed));

  const reading = (text, scores = text.split("\n").map(() => .96)) => matchChoiceRecheck(plan, { text, scores });
  const first = reading("(A) 0\n(B) 1\n(C) 2\n(D) 3");
  const second = reading("(A) 0\n(B) I\n(C) 2\n(D) 3");
  assert.deepEqual(choiceRecheckReadings(plan, [first, second]), [
    { label: "A", status: "consistent", readings: ["0"] },
    { label: "B", status: "conflicting", readings: ["1", "I"] },
  ]);
  for (const wrong of ["(A) 0\n(C) 7\n(D) 3", "(A) 0\n(C) 2\n(C) 2\n(D) 3", "(A) 0\n(D) 3\n(C) 2"])
    assert.equal(reading(wrong).size, 0);
  assert.deepEqual(choiceRecheckReadings(plan, [first, reading("(B) I\n(C) 2\n(D) 3", [.64,.95,.95])]), [
    { label: "A", status: "single_read", readings: ["0"] },
    { label: "B", status: "single_read", readings: ["1"] },
  ]);
});
const choiceStatements = [
  ["二、选择题（本节共2题）", .1, .07],
  ["15. 已知下列陈述，判断结论。", .1, .12],
  ["①第一项符合条件。", .1, .18],
  ["②第二项符合条件。", .1, .21],
  ["③第三项符合条件。这些解释合理的个数为", .1, .24],
];
await check("A complete horizontal choice row belongs to the question rather than its circled statements", () => {
  const q = questions([page([...choiceStatements, ["(A) 0", .1, .28, .06],
    ["(B) 1", .29, .28, .06], ["(C) 2", .48, .28, .06], ["(D) 3", .66, .28, .06]])])[0];
  assert.deepEqual(q.options.map(option => option.label), [..."ABCD"]);
  assert.deepEqual(q.subquestions, []);
  assert.match(q.stem, /①.+\n②.+\n③/u);
  assert.equal(printedStructureQuestionType(q), "选择题");
});
await check("A printed choice heading survives the answer-sheet instruction and owns a complete aligned grid", () => {
  const lead = [
    ["一、单项选择题（共4小题）", .1, .07],
    ["每小题只有一个选项正确，请在答题卡上填涂对应代号。", .1, .10, .8, "paragraph_title"],
    ["3. 请判断两个关于实验条件的命题。", .1, .15],
    ["①命题甲在相同温度下成立。", .1, .18],
    ["②命题乙在相同温度下成立。下列说法中正确的是（ ）", .1, .21],
  ];
  const grid = [["A. 仅甲正确", .1, .25, .2], ["B. 仅乙正确", .52, .25, .2],
    ["C. 甲乙均正确", .1, .29, .2], ["D. 甲乙均错误", .52, .29, .2]];
  const [q] = questions([page([...lead, ...grid])]);
  assert.match(q.section, /单项选择题/u);
  assert.deepEqual(q.options.map(option => option.label), [..."ABCD"]);
  assert.deepEqual(q.subquestions, []);
  for (const rows of [grid.slice(0, 3), [...grid.slice(0, 3), ["D. 甲乙均错误", .68, .29, .2]]]) {
    const [held] = questions([page([...lead, ...rows])]);
    assert.equal(held.options.length, 0);
    assert(held.subquestions.length > 0);
  }
});
await check("A scan with ambiguous preceding glyphs shows only C and D and holds A and B for source review", () => {
  const q = questions([page([...choiceStatements, ["0(A)逸", .1, .28, .21],
    ["(C) 2", .48, .28, .06], ["(D) 3", .66, .28, .06]])])[0];
  assert.deepEqual(q.options.map(option => option.text), ["(C) 2", "(D) 3"]);
  assert.deepEqual(missingChoiceLabels(q.options), ["A", "B"]);
  assert.deepEqual(q.subquestions, []);
  assert(q.stem.includes("0(A)逸"));
  assert(q.issues.includes("missing_choice_options"));
  assert.equal(q.status, "needs_review");
  assert.equal(printedStructureQuestionType(q), undefined);
});
await check("The choice-row rule preserves genuine subquestions and excludes cross-line and cross-page evidence", () => {
  const options = [["(C) 2", .48, .28, .06], ["(D) 3", .66, .28, .06]];
  const cases = [
    [page([["三、解答题"], ...choiceStatements.slice(1), ...options])],
    [page([...choiceStatements.slice(0, -1), ["③计算各自使用的步骤。", .1, .24], ...options])],
    [page([...choiceStatements.slice(0, -1), ["③这个样本中正数的个数为", .1, .24], ...options])],
    [page([...choiceStatements, ["(C)", .48, .28, .06], ["(D) 3", .66, .28, .06]])],
    [page([...choiceStatements, ["(C) 2", .48, .28, .06], ["(D) 3", .66, .32, .06]])],
    [page(choiceStatements, 1, 2), page(options, 2, 2)],
  ];
  for (const pages of cases) {
    const q = questions(pages)[0];
    assert.equal(q.options.length, 0);
    assert(q.subquestions.length > 0);
    assert(!q.issues.includes("missing_choice_options"));
  }
});
const numberRows=[
  ["1. 已知数轴上的两个点，求它们的距离。",.10,.10],
  ["2.2.5的倒数是多少？",.10,.16,.60],
  ["3. 已知三条边，求三角形的周长。",.10,.23],
];
function nativeNumber(text,mode){
  const box=mode==="wrong-row"?[.10,.185,.68,.203]:[.10,.16,.68,.178];
  const native={
    schemaVersion:"xiaozhi.pdf-native-text.v1",engine:"unpdf-1.8.1/pdfjs-6.1.200-text.v1",
    ok:true,version:"a".repeat(64),page:1,total:1,readBytes:1024,items:[],lines:[],
  };
  const addItem=(value,region)=>{
    const id="native-item-"+(native.items.length+1);
    native.items.push({id,text:value,box:region,transform:[1,0,0,1,0,0],width:12,height:12});
    return id;
  };
  const ids=mode==="split"
    ?[addItem("2.",[.10,.16,.12,.178]),addItem("2.5的倒数是多少？",[.126,.16,.68,.178])]
    :[addItem(text,box)];
  native.lines.push({id:"native-line-1",text,box,itemIds:ids});
  if(mode==="duplicate")native.lines.push({id:"native-line-2",text,box,itemIds:ids});
  return {policy:"pdf-native-crop-concordance.v1",rasterSha256:(mode==="wrong-raster"?"c":"b").repeat(64),
    native,attempts:[],accepted:[],unresolved:[]};
}
await check("Positioned PDF whitespace restores a joined parent without stripping a decimal in its stem", () => {
  for(const [rows,printed,mode,stem] of [
    [numberRows,"2. 2.5的倒数是多少？","single","2.5的倒数是多少？"],
    [numberRows,"2. 2.5的倒数是多少？","split","2.5的倒数是多少？"],
    [numberRows.map((row,i)=>i===1?["２．２.5的倒数是多少？",...row.slice(1)]:row),
      "２． ２.5的倒数是多少？","single","２.5的倒数是多少？"],
  ]){
    const recovered=page(rows,1,1,[],undefined,nativeNumber(printed,mode));
    const groups=questions([recovered]),parent=recovered.paragraphs.find(p=>p.marker?.label==="2");
    assert.deepEqual(groups.map(q=>q.number),["1","2","3"]);
    assert.equal(groups[1].stem,stem);
    assert.equal(parent.rawText,rows[1][0]);
    assert.equal(recovered.rawText,rows.map(row=>row[0]).join("\n"));
    assert(!groups[0].paragraphIds.includes(parent.id));
  }
});
await check("Joined numbers need unique bound native evidence, the same text, and adjacent question numbers", () => {
  for(const [rows,printed,mode] of [
    [numberRows,"2.2.5的倒数是多少？","no-space"],
    [numberRows,"2. 2.6的倒数是多少？","different-text"],
    [numberRows,"2. 2.5的倒数是多少？","wrong-row"],
    [numberRows,"2. 2.5的倒数是多少？","wrong-raster"],
    [numberRows,"2. 2.5的倒数是多少？","duplicate"],
    [[...numberRows.slice(0,2),["4. 已知三条边，求三角形的周长。",.10,.23]],"2. 2.5的倒数是多少？","number-gap"],
    [[...numberRows.slice(0,2),["二、填空题",.10,.20],numberRows[2]],"2. 2.5的倒数是多少？","section"],
  ]){
    const recovered=page(rows,1,1,[],undefined,nativeNumber(printed,mode));
    assert.equal(recovered.paragraphs.some(p=>p.marker?.label==="2"),false,mode);
    assert(recovered.rawText.includes(rows[1][0]));
  }
  const genuine=page([["2.5千克的物体受力如图，求其加速度？",.1,.11]]);
  assert(questions([genuine]).some(q=>q.stem.startsWith("2.5千克")));
});
const titleRegion={id:"shared-assessment-title",kind:"paragraph_title",score:.95,box:[.08,.07,.93,.141],needsReview:true};
await check("Wrapped scoring headings retain all OCR lines and govern unpunctuated question numbers", () => {
  const input=[
    ["一、填空题（本大题共2题，", .10, .075, .78, "paragraph_title"],
    ["按要求在指定的（答题纸）", .13, .097, .45, "paragraph_title"],
    ["相应位置填写结果。)", .13, .119, .31, "paragraph_title"],
    ["1 已知x为2，求x的平方。", .10, .16],
    ["2 已知y为3，求y的平方。", .10, .20],
  ];
  const recovered=page(input,1,1,[titleRegion]);
  const [heading]=recovered.paragraphs;
  assert.equal(heading.role,"heading");
  assert.deepEqual(heading.lineIds,recovered.lines.slice(0,3).map(line=>line.id));
  assert.equal(heading.rawText,input.slice(0,3).map(row=>row[0]).join("\n"));
  assert.deepEqual(heading.anchor.box,[.1,.075,recovered.lines[0].box[2],recovered.lines[2].box[3]]);
  assert.equal(recovered.rawText,input.map(row=>row[0]).join("\n"));
  assert.deepEqual(questions([recovered]).map(q=>[q.number,q.section]),[["1",heading.text],["2",heading.text]]);
});
await check("A wrapped heading never takes an independent title, a question marker or an unclosed continuation", () => {
  const lead=["一、填空题（本大题共2题，",.1,.075,.78,"paragraph_title"];
  for(const [tail,regions] of [
    [["相应位置填写结果。)",.13,.097,.40,"paragraph_title"],[]],
    [["2 求右图三角形的面积。)",.13,.097,.40,"text"],[titleRegion]],
    [["二、选择题（共2题）",.13,.097,.40,"paragraph_title"],[titleRegion]],
    [["后续说明仍没有结束。",.13,.097,.40,"paragraph_title"],[titleRegion]],
    [["相应位置填写结果。)2. 新题。",.13,.097,.4,"paragraph_title"],[titleRegion]],
  ]) {
    const recovered=page([lead,tail],1,1,regions);
    assert.equal(recovered.paragraphs[0].lineIds.length,1,tail[0]);
    assert.equal(recovered.rawText,lead[0]+"\n"+tail[0]);
  }
});
await check("A two-line scored parent keeps its printed rubric evidence and its own subquestions", () => {
  const lead = "20（本题满分18分，第1小题满分";
  const rows = [
    [lead,.10,.075,.78,"paragraph_title"], ["6分）",.10,.099,.09,"paragraph_title"],
    ["如图所示，已知抛物线，求焦点。",.10,.15,.63], ["(1) 求焦点坐标。",.10,.18,.29],
    ["(2) 求取值范围。",.10,.21,.29], ["(3) 证明结论。",.10,.24,.29],
  ];
  for (const text of [lead, lead.replace("20", "20.")]) {
    const input = [[text,...rows[0].slice(1)],...rows.slice(1)];
    const run = page(input,1,1,[titleRegion]);
    const [q] = questions([run]);
    const printed = run.paragraphs[0];
    assert.equal(q.number,"20");
    assert.match(q.stem,/^如图所示/u);
    assert.doesNotMatch(q.stem,/本题满分/u);
    assert.deepEqual(q.subquestions.map(item=>item.label),["1","2","3"]);
    assert.equal(printed.rawText,text+"\n6分）");
    assert.deepEqual(printed.lineIds,run.lines.slice(0,2).map(line=>line.id));
    assert.equal(q.needsReview,true);
  }
});
await check("Split score recovery requires a nearby matching title tail with closing punctuation", () => {
  const lead = ["20（本题满分18分，第1小题满分",.10,.075,.78,"paragraph_title"];
  for (const [tail,regions] of [
    [["6分）",.10,.099,.09,"paragraph_title"],[]],
    [["6分未闭合",.10,.099,.09,"paragraph_title"],[titleRegion]],
    [["6分）",.10,.099,.09,"paragraph_title",.8],[titleRegion]],
    [["6分）",.10,.122,.09,"paragraph_title"],[titleRegion]],
    [["6分）",.74,.099,.09,"paragraph_title"],[titleRegion]],
  ]) {
    const run = page([lead,tail],1,1,regions);
    assert(!run.paragraphs.some(paragraph=>paragraph.marker?.label==="20"),tail);
    assert.equal(run.rawText,lead[0]+"\n"+tail[0]);
  }
});
await check("Printed type follows the question's own section across pages and refuses incompatible or ambiguous shapes", () => {
  const first = page([
    ["一、单项选择题：（本大题共2题）", .1, .08, .8, "paragraph_title"],
    ["1. 下列选项正确的是", .1, .12],
    ["A. 甲", .1, .16], ["B. 乙", .1, .20],
  ], 1, 2);
  const second = page([
    ["2. 已知条件，选出正确结论", .1, .08],
    ["A. 丙", .1, .12], ["B. 丁", .1, .16],
    ["二、填空题：（每题4分）", .1, .22, .8, "paragraph_title"],
    ["3. 已知多项式 3a-2a，合并同类项后的结果为▲", .1, .26],
  ], 2, 2);
  const [one, two, three] = questions([first, second]);
  assert.equal(three.status, "candidate", JSON.stringify({section:three.section,issues:three.issues}));
  assert.deepEqual([one, two, three].map(printedStructureQuestionType), ["单项选择题", "单项选择题", "填空题"]);
  assert.equal(printedStructureQuestionType({...two, section: "选择题"}), "选择题");
  assert.equal(printedStructureQuestionType({...two, section: "多项选择题"}), "多项选择题");
  for (const changed of [
    {...two, kind: "answer"}, {...two, status: "needs_review"},
    {...two, options: two.options.slice(0, 1)}, {...two, options: [...two.options].reverse()},
    {...two, section: "填空题"}, {...two, section: "选择题 答案"},
    {...two, section: "（一）试卷结构"}, {...three, section: "选择题"},
  ]) assert.equal(printedStructureQuestionType(changed), undefined);
});
await check("An isolated unnumbered prompt stays reviewable and a numbered figure caption cannot split the next question", () => {
  const stem = "已知一个物体以相同的速度连续经过两段水平轨道，求整个过程所用的时间是多少？（假设阻力忽略不计）";
  const withAnnotation = (text, next = .44) => page([
    [text,.1,.08,.76],
    ['x="20" N',.45,.18,.14,"display_formula"],
    ["6. 如图所示，以下哪些说法正确？",.1,next,.78],
    ["A. 甲",.12,next+.04,.35], ["B. 乙",.12,next+.08,.35],
    ["C. 丙",.12,next+.12,.35], ["第6题图",.75,next+.13,.12],
    ["D. 丁",.12,next+.16,.35],
  ], 1, 2, [{id:"figure",kind:"image",score:.98,box:[.73,next+.04,.91,next+.12],needsReview:true}]);
  const second = page([
    ["例7 物体改变方向后，计算它的速度。",.1,.08,.8],
  ], 2, 2);
  const first = withAnnotation(stem);
  const [held, six, example] = questions([first,second]);
  assert.equal(held.number,"0");
  assert.equal(held.stem,stem);
  assert.deepEqual(held.issues,["missing_question_number"]);
  assert.equal(held.status,"needs_review");
  assert.deepEqual(held.assets,[]);
  assert(first.rawText.includes('x="20"'));
  assert.equal(six.number,"6");
  assert.deepEqual(six.pageRange,[1,1]);
  assert.deepEqual(six.options.map(part=>part.label),Array.from("ABCD"));
  assert.equal(six.assets[0]?.regionId,"figure");
  assert(six.paragraphIds.includes(first.paragraphs.find(p=>p.text==="第6题图").id));
  assert.equal(six.issues.includes("shared_material_scope"),false);
  assert(!six.stem.includes("例7"));
  assert(example.stem.startsWith("例7"));
  for (const input of [withAnnotation(stem,.24),withAnnotation("根据上题所给的条件，" + stem)]) {
    const [ambiguous, following] = questions([input]);
    assert(ambiguous.issues.includes("missing_question_start"));
    assert(following.issues.includes("shared_material_scope"));
  }
  assert.equal(page([["第6题 图中有五个不同的小球，请计算它们的质量。"]]).paragraphs[0].marker.label,"6");
});
await check("Printed space-separated and separately boxed question numbers use section, alignment and option evidence", () => {
  const p=page([
    ["考生注意：",.1,.08,.8,"paragraph_title"],
    ["1. 用 2B 铅笔作答选择题。",.1,.11],
    ["一、选择题",.1,.17],
    ["1 如果 a＞b，下列正确的是",.1,.22],
    ["A. 甲",.14,.25,.2],["B. 乙",.42,.25,.2],
    ["２",.1,.30,.018],["已知 y=2x，正确结论为",.14,.301,.7],
    ["A. 丙",.14,.33,.2],["B. 丁",.42,.33,.2],
    ["三、解答题",.1,.40],
    ["3（本题满分10分，第（1）小题4分）",.1,.43,.6,"paragraph_title"],
    ["如图，在直角坐标系中解方程。",.14,.46,.65],
    ["（1）求 x。",.14,.49],
    ["（2）求 y。",.14,.52],
  ]);
  const recovered=questions([p]);
  assert.deepEqual(recovered.map(q=>q.number),["1","2","3"]);
  assert.match(recovered[0].stem,/^如果/);
  assert.match(recovered[1].stem,/^已知/);
  assert.deepEqual(recovered.slice(0,2).map(q=>q.options.map(o=>o.label)),[["A","B"],["A","B"]]);
  assert.match(recovered[2].stem,/^如图/);
  assert.deepEqual(recovered[2].subquestions.map(q=>q.label),["1","2"]);
  assert(!recovered.some(q=>q.stem.includes("铅笔")||q.stem.includes("满分")));
  assert(p.rawText.includes("２\n已知"));
  assert(p.rawText.includes("铅笔"));
  assert.equal(p.paragraphs.flatMap(paragraph=>paragraph.lineIds).length,p.lines.length);
});
await check("A running fill sequence continues across missing headings and closes before a scored heading", () => {
  const p=page([
    ["10 展品有四个，其中合格的是▲个",.1,.10,.74],
    ["11 另一个样本记录的值为▲",.1,.14,.72],
    ["12 原图所示还有一个条件",.1,.18,.72],
    ["三、解答题",.1,.22],
    ["13（本题共10分）",.1,.26,.42,"paragraph_title"],
    ["求整个系统的功率。",.14,.29,.72],
  ]);
  const result=questions([p]);
  assert.deepEqual(result.map(q=>q.number),["10","11","12","13"]);
  assert.equal(result[2].status,"needs_review");
  assert(!result[1].stem.includes("原图所示"));
  assert.equal(result[3].stem,"求整个系统的功率。");
});
await check("Quantities, decimals, chart values, and a lone unproven numeral do not become parent questions", () => {
  const p=page([
    ["二、填空题",.10,.08],
    ["3 kg 的砝码如图所示",.11,.12,.76],
    ["4 m/s 的速度变化如下",.11,.16,.74],
    ["4.5 cm 的长度",.11,.20,.75],
    ["15 没有原件边界证据的文字",.40,.25,.40],
    ["7",.60,.29,.02],["30 m",.14,.29,.2],
    ["8 已知原先内容",.11,.36,.70],
  ]);
  assert.deepEqual(p.paragraphs.filter(q=>q.marker?.kind==="parent").map(q=>q.marker.label),[]);
  assert(p.rawText.includes("4.5 cm"));
});
await check("A stacked formula beside the next question never changes the preceding complete choice question", () => {
  const p=page([
    ["一、选择题",.10,.18],
    ["1 以下正确的结论是",.10,.24,.46],
    ["A. 甲",.14,.28,.11],["B. 乙",.28,.28,.11],["C. 丙",.42,.28,.11],["D. 丁",.56,.28,.11],
    ["2 − x",.26,.306,.055],
    ["2",.10,.317,.020],["如果 f(x) =",.15,.316,.11],["现计算函数的值",.33,.316,.2],
    ["x − 3",.26,.324,.055],
    ["A. 甲",.14,.36,.11],["B. 乙",.28,.36,.11],["C. 丙",.42,.36,.11],["D. 丁",.56,.36,.11],
  ]);
  const [first,second]=questions([p]);
  assert.equal(first.number,"1");
  assert.equal(second.number,"2");
  assert(!first.stem.includes("2 − x"));
  assert(second.stem.includes("2 − x"));
  assert(second.stem.includes("x − 3"));
  assert(second.issues.includes("ambiguous_asset"));
  assert(!second.stem.includes("\\frac"));
  assert.equal(p.paragraphs.flatMap(paragraph=>paragraph.lineIds).length,p.lines.length);
});
function fixtureWithNativeMarks(p, marks) {
  const items = marks.map(([text,box],i)=>({
    id:"native-item-"+(i+1),text,box,transform:[1,0,0,1,0,0],width:12,height:12,
  }));
  p.nativeRecovery = {policy:"pdf-native-crop-concordance.v1",rasterSha256:p.rasterSha256,
    accepted:[],attempts:[],unresolved:[],native:{
      schemaVersion:"xiaozhi.pdf-native-text.v1",engine:"unpdf-1.8.1/pdfjs-6.1.200-text.v1",
      ok:true,version:p.version,page:p.page,total:p.totalPages,readBytes:1,items,lines:[],
    }};
  const text=p.lines.map(line=>line.text).join("\n");
  return {status:"needs_review",error:"text_conflict",method:"ocr",text,ocrText:text,
    nativeText:items.map(item=>item.text).join(" "),width:1000,height:1000,imageArea:.5,nativeBoxes:[]};
}
function beforeNativeSectionFixture(title = "二、填空题（每空2分）") {
  const p = page([
    ["1. 已知电阻为 5Ω，电流保持不变，计算两端电压并说明理由。", .1, .12, .78],
    [title, .1, .30, .65, "paragraph_title"],
    ["2. 已知另一电路条件，计算电流。", .1, .42, .78],
  ]);
  const [q] = questions([p]);
  const receipt = fixtureWithNativeMarks(p, p.lines.map(line => [line.text, [...line.box]]));
  const native = p.nativeRecovery.native;
  native.lines = native.items.map((item, index) => ({id: "native-line-" + (index + 1), text: item.text,
    box: [...item.box], itemIds: [item.id]}));
  receipt.nativeText = p.lines.map(line => line.text).join("\n");
  return {p, q, receipt};
}
await check("A positioned literal exam-section title can bound an independently matching native question", () => {
  for (const title of ["二、填空题", "二、填空题（每空2分）", "三、计算题（共2题，每题5分）"]) {
    const {p, q, receipt} = beforeNativeSectionFixture(title);
    assert.equal(q.status, "candidate");
    assert(p.regions.some(region => region.kind === "paragraph_title"));
    assert(verifiedQuestionBeforeNativeSection(receipt, q, p), title);
    const docTitle = structuredClone(p);
    docTitle.regions.find(region => region.kind === "paragraph_title").kind = "doc_title";
    assert(verifiedQuestionBeforeNativeSection(receipt, q, docTitle), "doc_title: " + title);
  }
});
await check("Native section recovery refuses pseudo headings, wrong positions, lost tokens and raised/lowered components", () => {
  for (const title of ["二、填空题答案", "二、填空题（答案为5）", "二、填空题（每空2分，附加条件）", "二、参考答案"]) {
    const {p, q, receipt} = beforeNativeSectionFixture(title);
    assert.equal(verifiedQuestionBeforeNativeSection(receipt, q, p), false, title);
  }
  const variations = [
    f => {f.p.paragraphs[1].anchor.box = [.1,.11,.75,.128];},
    f => {f.p.nativeRecovery.native.lines[1].box = [.4,.30,.9,.318];},
    f => {f.p.regions.find(region => region.kind === "paragraph_title").kind = "text";},
    f => {f.p.regions.find(region => region.kind === "paragraph_title").score = .79;},
    f => {f.p.nativeRecovery.native.items[0].box = [.1,.113,.88,.124];},
    f => {f.p.nativeRecovery.native.items[0].box = [.1,.125,.88,.132];},
    f => {f.p.nativeRecovery.native.items[0].box = [.1,.12,.88,.126];},
    f => {f.p.nativeRecovery.rasterSha256 = "c".repeat(64);},
    f => {f.p.nativeRecovery.native.version = "c".repeat(64);},
    f => {f.p.nativeRecovery.native.page = 2; f.p.nativeRecovery.native.total = 2;},
    f => {f.receipt.ocrText += "遗漏文字";},
    f => {f.receipt.nativeText = f.receipt.nativeText.replace("5Ω", "15Ω");},
    f => {f.q.stem = f.q.stem.replace("5Ω", "15Ω");},
    f => {f.p.nativeRecovery.unresolved.push("native-line-1");},
    f => {f.q.pageRange = [1,2];},
    f => {f.p.paragraphs[2].marker.label = "3";},
    f => {
      // The PDF item exists physically in the source band but its grouping
      // line omits it. Keep the whole-page native glyph digest in agreement.
      const native = f.p.nativeRecovery.native;
      native.items.push({...structuredClone(native.items[0]), id: "native-item-4", text: "+", box: [.45,.20,.47,.218]});
      f.receipt.nativeText += "\n+";
    },
    f => {
      const native = f.p.nativeRecovery.native;
      native.items.push({...structuredClone(native.items[0]), id: "native-item-4", text: "1. 重复题号", box: [.1,.7,.4,.718]});
      f.receipt.nativeText += "\n1. 重复题号";
    },
  ];
  for (const [index, alter] of variations.entries()) {
    const f = beforeNativeSectionFixture(); alter(f);
    assert.equal(verifiedQuestionBeforeNativeSection(f.receipt, f.q, f.p), false, "unsafe native-section variant " + index);
  }
});
await check("PDF annotations must be complete, detached and backed by exact paged OCR", () => {
  const y = [.3,.36,.42,.48];
  const p = page([
    ["6. 根据题图，选择符合两个摩擦力方向的选项。",.1,.1,.7],
    ...Array.from("ABCD",(label,i)=>[label+". 选项内容各不相同 "+i,.12,y[i],.36]),
  ],1,1,[{id:"figure",kind:"image",score:.98,box:[.76,.32,.92,.47],needsReview:true}]);
  const [q] = questions([p]);
  const receipt=fixtureWithNativeMarks(p,["α","√","√","√"].map((text,i)=>[
    text,[.49,y[i]+.001,.515,y[i]+.017],
  ]));
  const positive=localizedPdfMarkProof(receipt,q,p);
  assert.equal(positive.slices.length,6);
  assert.equal(positive.marks.length,4);
  assert.equal(localizedPdfMarkProof({...receipt,nativeText:"α √ √ √ +"},q,p),undefined);
  assert.equal(localizedPdfMarkProof({...receipt,ocrText:receipt.ocrText.replace("3","4")},q,p),undefined);
  assert.equal(localizedPdfMarkProof(receipt,{...q,pageRange:[1,2]},p),undefined);
  assert.equal(localizedPdfMarkProof(receipt,{...q,stem:q.stem.replace("3","4")},p),undefined);
  assert.equal(localizedPdfMarkProof(receipt,{...q,options:q.options.slice(0,3)},p),undefined);
  for(const i of [0,2,3]){
    const mixed=structuredClone(p);
    mixed.nativeRecovery.native.items[i].box[0]=.47;
    assert.equal(localizedPdfMarkProof(receipt,q,mixed),undefined);
  }
  const orphan=structuredClone(p);
  orphan.nativeRecovery.unresolved=["native-line-1"];
  assert.equal(localizedPdfMarkProof(receipt,q,orphan),undefined);
});
await check("Option-mark recovery works across choice counts, graphics and row layouts", () => {
  const stem="8. 根据给定条件和已知物理量，选出正确的判断。";
  for (const [count, figureCount] of [[2,0],[3,0],[5,2],[8,0]]) {
    const regions=Array.from({length:figureCount},(_,i)=>({
      id:"graphic-"+i,kind:i?"chart":"image",score:.98,
      box:[.77,.32+i*.045,.93,.36+i*.045],needsReview:true,
    }));
    const p=page([[stem,.10,.09,.48],...Array.from("ABCDEFGH".slice(0,count),(label,i)=>
      [label+". 原文选择条件各不相同 "+i,.12,.3+i*.03,.36])],1,1,regions);
    const [q]=questions([p]);
    assert.equal(q.assets.length,figureCount);
    const receipt=fixtureWithNativeMarks(p,[["✓",[.49,.301,.514,.316]]]);
    const proof=localizedPdfMarkProof(receipt,q,p);
    assert(proof, count+" options, "+figureCount+" figures");
    assert(proof.slices.length<=8);
    for(const asset of q.assets)assert(proof.slices.some(box=>JSON.stringify(box)===JSON.stringify(asset.box)));
  }

  const horizontal=page([[stem,.1,.09,.48],["A. 甲 B. 乙 C. 丙",.12,.30,.48]]);
  const [h]=questions([horizontal]);
  assert.equal(h.options.length,3);
  const hReceipt=fixtureWithNativeMarks(horizontal,[["×",[.62,.301,.646,.318]]]);
  assert.equal(localizedPdfMarkProof(hReceipt,h,horizontal).slices.length,2);

  const twoColumns=page([[stem,.1,.09,.48],["A. 第一种可能的解释",.12,.3,.36],["B. 第二种可能的解释",.12,.37,.36]]);
  const [left]=questions([twoColumns]);
  twoColumns.columns=[[0,0,.62,1],[.64,0,1,1]];
  const right={...twoColumns.lines[0],id:"right-line",text:"9. 同一原页的另一题",box:[.71,.31,.95,.328]};
  twoColumns.lines.splice(2,0,right);
  const receipt=fixtureWithNativeMarks(twoColumns,[["√",[.49,.301,.515,.317]],["物理",[.76,.32,.84,.337]]]);
  assert.equal(localizedPdfMarkProof(receipt,left,twoColumns).slices.length,3);
  right.box=[.51,.31,.60,.328];
  assert.equal(localizedPdfMarkProof(receipt,left,twoColumns),undefined);
});
await check("Each mark pigment is checked independently against every source crop", () => {
  const pixels=(...parts)=>Buffer.from(parts.flatMap(([count,bgra])=>
    Array.from({length:count},()=>bgra).flat()));
  const white=[240,240,240,255], black=[18,18,18,255], red=[20,20,220,255];
  const blue=[230,40,20,255], green=[0,160,30,255];
  const mark=color=>pixels([70,white],[30,color]);
  const content=pixels([60,white],[30,black],[10,green]);
  assert(separatedMarkPixels([mark(red)],[content]));
  assert(separatedMarkPixels([mark(blue)],[content]));
  assert(separatedMarkPixels([mark(red),mark(blue)],[content]));
  assert(!separatedMarkPixels([mark(black)],[content]));
  assert(!separatedMarkPixels([mark(green)],[content]));
  assert(!separatedMarkPixels([mark(red)],[pixels([69,white],[30,black],[1,red])]));
});
await check("Printed fill slots preserve literal OCR and require visible thin rules", () => {
  const width = 100, height = 60;
  const light = Buffer.alloc(width * height * 4, 255);
  const box = [.2, .3, .6, .55];
  const stripe = pixels => printedBlankStripe({width, height, pixels}, box);
  assert.equal(stripe(light), undefined);
  const ink = Buffer.from(light);
  ink.fill(180, (26 * width + 20) * 4, (26 * width + 60) * 4);
  assert.deepEqual(stripe(ink), [.2, 26/60, .6, 27/60]);
  for (let y = 27; y <= 31; y++) ink.fill(180, (y * width + 20) * 4, (y * width + 60) * 4);
  assert.equal(stripe(ink), undefined);
  const p = page([
    ["二、填空题", .10, .05],
    ["1. 小球的速度为", .10, .10, .24],
    ["米每秒。", .39, .10, .22],
  ], 1, 1, [], {parents:[],blanks:[{beforeId:"p1-line-2",afterId:"p1-line-3",box:[.34,.116,.39,.117]}]});
  const [q] = questions([p]);
  assert.match(q.stem, /为____米/u);
  assert(!p.rawText.includes("____"));
  assert(!p.paragraphs.some(part => part.rawText.includes("____")));
});
await check("A crop can confirm exactly one numbered parent with original readings", () => {
  const input = {text:"10.\n版式标签\n如图所示小球在水平轨道运动",scores:[.98,.99,.97]};
  assert.deepEqual(readPrintedParent(input,10),{text:"10. 如图所示小球在水平轨道运动",score:.97,readings:input.text.split("\n"),uncertain:true});
  const printed = readPrintedParent({...input,text:input.text.replace("版式标签","忽略摩擦")},10);
  const quad = [[.1,.08],[.5,.08],[.5,.097],[.1,.097]];
  const pageWithCrop = page([
    ["下列关于小球运动的说法正确的是（　）",.1,.1,.4],
    ["A. 甲",.1,.2,.2],["B. 乙",.1,.23,.2],
    ["C. 丙",.1,.26,.2],["D. 丁",.1,.29,.2],
  ],1,1,[],{blanks:[],parents:[{
    line:{id:"printed-parent-10",kind:"text",text:printed.text,score:printed.score,needsReview:true,quad,normalizedQuad:quad},
    crop:[.1,.08,.5,.097],cropSha256:"c".repeat(64),engine:"controlled-ocr",readings:printed.readings,uncertain:true,
  }]});
  assert(!pageWithCrop.rawText.includes("10."));
  const [recovered] = questions([pageWithCrop]);
  assert.equal(recovered.options.length, 4);
  assert.equal(recovered.status, "needs_review");
  assert(recovered.issues.includes("printed_crop_unconfirmed"));
  assert.equal(readPrintedParent(input,11), undefined);
  assert.equal(readPrintedParent({...input,scores:[.65,.99,.97]},10), undefined);
  assert.equal(readPrintedParent({text:input.text+"\n另一段来自其他题目的连续文字",scores:[...input.scores,.99]},10), undefined);
});
await check("An explicitly bounded last choice question can retry its own region, never a partial or shared option group", () => {
  const section="二、选择题（本大题共3题，第4～6题每题4分）";
  const options=(from)=>Array.from('ABCD',(label,index)=>[label+". 独立选项",.12,from+index*.025,.26]);
  const rows=[[section,.08,.08,.67],["4. 关于实验结果，下列说法正确的是",.08,.13,.55],
    ["5. 根据实验数据，下列判断正确的是",.08,.24,.55],...options(.30),
    ["①观察图中两条曲线的变化趋势。",.12,.48,.53],...options(.53)];
  const regions=[{id:'prior',kind:'text',score:.99,box:[.073,.23,.75,.404],needsReview:false},
    {id:'terminal',kind:'text',score:.62,box:[.081,.45,.76,.64],needsReview:true}];
  const eligible=printedParentProbes(page(rows,1,1,regions));
  assert.equal(eligible.length,1);
  assert.equal(eligible[0].number,6);
  assert.equal(eligible[0].variant,'color-light');
  assert(eligible[0].crop[1]>.40&&eligible[0].crop[3]<.48);
  assert.deepEqual(printedParentProbes(page(rows.slice(0,-1),1,1,regions)),[]);
  const undeclared=[[section.replace('第4～6题','第4～7题'),.08,.08,.67],...rows.slice(1)];
  assert.deepEqual(printedParentProbes(page(undeclared,1,1,regions)),[]);
  const shared=[{...regions[0],box:[.073,.23,.76,.64]}];
  assert.deepEqual(printedParentProbes(page(rows,1,1,shared)),[]);
  const obstruction={id:'image-1',kind:'image',score:.95,box:[.25,.452,.40,.474],needsReview:false};
  assert.deepEqual(printedParentProbes(page(rows,1,1,[...regions,obstruction])),[]);
  const p=page(rows,1,1,regions);
  assert.deepEqual(printedParentProbes({...p,issues:['ambiguous_columns']}),[]);
});
await check("Fill detection excludes midline strokes and gaps between numbers", () => {
  const region = {id:"fill-body",kind:"text",score:.99,box:[.08,.09,.65,.13],needsReview:true};
  const make = (start, end) => page([
    ["二、填空题",.10,.05],
    [start,.10,.10,.24],
    [end,.39,.10,.22],
  ],1,1,[region]);
  let requested;
  const p = make("1. 长度为", "厘米。");
  const width = 1000, height = 1000;
  const read = y => box => {
    requested = box;
    const pixels = Buffer.alloc(width * height * 4,255);
    pixels.fill(180,(y * width + 340) * 4,(y * width + 390) * 4);
    return printedBlankStripe({width,height,pixels},box);
  };
  assert.deepEqual(printedBlanks(p,read(108)), []);
  assert(requested[1] > .108);
  assert.equal(printedBlanks(p,read(117)).length, 1);
  assert.deepEqual(printedBlanks(make("1. 计算 12","5 的差。"),() => assert.fail("number-to-number gap")), []);
});
await check("A conflicted page can admit one exact bounded parent without releasing its damaged sibling", () => {
  const native = "3. 已知电阻 𝑅1 = 5Ω，电流保持不变，求电压的值。\n4. 另有电阻为 1\n2𝑅，求两端电压。";
  const [a,b] = questions([page([
    ["3. 已知电阻 R1 = 5Ω，电流保持不变，求电压的值。"],
    ["4. 另有电阻为 1R，求两端电压。"],
  ])]);
  assert(verifiedQuestionInPdfConflict(native,a,1));
  assert(!verifiedQuestionInPdfConflict(native,b,1));
  assert(!verifiedQuestionInPdfConflict(native,{...a,stem:a.stem.replace("5Ω","15Ω")},1));
  assert(!verifiedQuestionInPdfConflict(native,{...a,stem:a.stem.replace("R1","R₁")},1));
  assert(!verifiedQuestionInPdfConflict(native+"\n3. 另一个重启编号的问题。",a,1));
  assert(!verifiedQuestionInPdfConflict(native,{...a,pageRange:[1,2]},1));
  assert(!verifiedQuestionInPdfConflict(native,{...a,sharedMaterialIds:["shared"]},1));
  const choices = "\nA. 12Ω\nB. 21Ω";
  const selected = {...a,stem:a.stem+choices,options:[{label:"A",text:"A. 12Ω"},{label:"B",text:"B. 21Ω"}]};
  const nativeWithOptions = native.replace("\n4.",choices+"\n4.");
  assert(verifiedQuestionInPdfConflict(nativeWithOptions,selected,1));
  assert(!verifiedQuestionInPdfConflict(nativeWithOptions,{...selected,options:[{label:"A",text:"A. 21Ω"},selected.options[1]]},1));
  assert(!verifiedQuestionInPdfConflict(nativeWithOptions,{...selected,options:selected.options.toReversed()},1));
  for(const kind of ["inline_formula","display_formula","table"])
    assert(!verifiedQuestionInPdfConflict(nativeWithOptions,{...selected,assets:[{kind}]},1));
});
const trailingChoiceRows = (reference = "如图所示") => [
  [`7. ${reference}，玻璃管和弹簧秤相连，求示数？`, 0.12, 0.72],
  ["A. 选项甲的描述", 0.14, 0.77, 0.25],
  ["B. 选项乙的描述", 0.14, 0.81, 0.25],
  ["C. 选项丙的描述", 0.14, 0.85, 0.25],
  ["D. 选项丁的描述", 0.14, 0.89, 0.25],
];
const leadingFigure = { id: "leading-image", kind: "image", score: 0.96, box: [0.60, 0.11, 0.76, 0.21], needsReview: true };
const nextFigure = { ...leadingFigure, id: "next-image", box: [0.60, 0.39, 0.78, 0.52] };
const nextParent = ["8. 如图所示，计算另一个物体的重力。", 0.12, 0.28];

await check("An unnumbered next-page figure becomes a reviewable crop, while the following question keeps its own figure", () => {
  const [previous, next] = questions([
    page(trailingChoiceRows(), 1, 2),
    page([nextParent], 2, 2, [leadingFigure, nextFigure]),
  ]);
  assert.deepEqual(previous.pageRange, [1, 2]);
  assert.deepEqual(previous.assets.map(a => a.regionId), ["leading-image"]);
  assert.deepEqual(previous.issues, ["ambiguous_asset"]);
  assert.equal(previous.status, "needs_review");
  assert(previous.anchors.some(a => a.page === 2));
  assert(!previous.stem.includes("另一个物体"));
  assert.deepEqual(next.assets.map(a => a.regionId), ["next-image"]);
  assert.deepEqual(next.pageRange, [2, 2]);
});

await check("A matching literal caption verifies a standalone next-page diagram, but competing references keep it held", () => {
  const before = page(trailingChoiceRows("如图12所示"), 1, 2);
  const caption = ["图 12", 0.63, 0.22, 0.08, "figure_title"];
  const match = questions([before, page([caption, nextParent], 2, 2, [leadingFigure, nextFigure])])[0];
  assert.equal(match.status, "candidate");
  assert.deepEqual(match.assets.map(a => a.regionId), ["leading-image"]);
  assert(match.paragraphIds.some(id => id.startsWith("p2-")));
  const overlap = ["8. 如图12所示，计算重力。", 0.12, 0.28];
  for (const rows of [[caption, overlap], [["图 13", ...caption.slice(1)], nextParent]]) {
    const [q] = questions([before, page(rows, 2, 2, [leadingFigure, nextFigure])]);
    assert(q.issues.includes("missing_figure"));
    assert.equal(q.assets.length, 0);
  }
});

await check("Page-leading image choices, prior-owned figures and layout conflicts never become an orphan attachment", () => {
  const before = page(trailingChoiceRows(), 1, 2);
  const newPage = (figures, rows = [nextParent]) => page(rows, 2, 2, figures);
  const many = [
    leadingFigure,
    { ...leadingFigure, id: "another-image", box: [0.3, 0.11, 0.45, 0.21] },
    nextFigure,
  ];
  const gapped = newPage([leadingFigure, nextFigure], [["9. 计算重力。", 0.12, 0.28]]);
  const captionChoices = newPage([leadingFigure, nextFigure], [["A.", 0.60, 0.23, 0.04], nextParent]);
  const suspect = { ...newPage([leadingFigure, nextFigure]), issues: ["ambiguous_columns"] };
  for (const continuation of [newPage(many), newPage([leadingFigure]), gapped, captionChoices, suspect]) {
    const [q] = questions([before, continuation]);
    assert(!q.assets.length);
    assert(q.issues.includes("missing_figure"));
  }
  const alreadyOwned = page(trailingChoiceRows(), 1, 2, [
    { ...leadingFigure, id: "prior-image", box: [0.60, 0.75, 0.76, 0.82] },
  ]);
  assert.deepEqual(questions([alreadyOwned, newPage([leadingFigure, nextFigure])])[0].assets.map(a => a.regionId), ["prior-image"]);
});

function graphOptionPage({ labels = ["A.", "B.", "C.", "D."], grid = false, extra = [], tail = nextParent } = {}) {
  const rows = [], images = [];
  for (const [index, label] of labels.entries()) {
    const x = 0.13 + (grid ? index % 2 : index) * 0.17;
    const y = grid ? 0.05 + Math.floor(index / 2) * 0.11 : 0.08;
    images.push({ ...leadingFigure, id: "option-image-" + index, box: [x, y, x + 0.12, y + 0.052] });
    if (label) rows.push([label, x + 0.04, y + 0.057, 0.035, "figure_title"]);
  }
  return page([...rows, tail], 2, 2, [...images, ...extra]);
}
const graphStem = page([["7. 哪个图像表示物体运动的过程？（）", 0.12, 0.84]], 1, 2,
  [{ ...leadingFigure, id: "apparatus", box: [0.86, 0.82, 0.96, 0.89] }]);

await check("Four labeled graphics attach separately in horizontal and grid reading order, leaving the next question alone", () => {
  for (const grid of [false, true]) {
    const [question, next] = questions([graphStem, graphOptionPage({grid, extra: [nextFigure]})]);
    assert.equal(question.status, "candidate");
    assert.deepEqual(question.pageRange, [1, 2]);
    assert.deepEqual(question.options.map(o => o.label), [..."ABCD"]);
    assert.deepEqual(question.assets.map(a => [a.regionId, a.choiceLabel]), [
      ["apparatus", undefined], ...[..."ABCD"].map((label, i) => ["option-image-" + i, label]),
    ]);
    assert.deepEqual(next.pageRange, [2, 2]);
    assert.deepEqual(next.sharedMaterialIds, []);
    assert.deepEqual(next.assets.map(a => a.regionId), ["next-image"]);
    assert(!question.stem.includes("另一个物体"));
  }
});

await check("Uncertain graph captions are shown for review and wrong or missing labels never publish", () => {
  const [question] = questions([graphStem, graphOptionPage({labels:["（A","（B","(C","(D"]})]);
  assert.equal(question.status, "needs_review");
  assert(question.issues.includes("ambiguous_asset"));
  assert.deepEqual(question.options.map(o => o.label), [..."ABCD"]);
  assert.equal(question.options[0].text,"（A");
  for (const labels of [["A.","C.","B.","D."], ["A.","B.","B.","D."], ["A.","B.","","D."]]) {
    const [held] = questions([graphStem, graphOptionPage({labels})]);
    assert.equal(held.status, "needs_review");
    assert(held.issues.includes("missing_figure"));
    assert(!held.assets.some(a => a.choiceLabel));
  }
});
await check(
  "Consecutive Chinese lines form a paragraph while a real vertical gap starts another",
  () => {
    const p = page([
      ["连续正文第一行内容", 0.1, 0.1],
      ["连续正文第二行内容", 0.1, 0.127],
      ["连续正文第三行内容。", 0.1, 0.154],
      ["下一段正文。", 0.14, 0.23],
    ]);
    assert.equal(p.paragraphs.length, 2);
    assert.equal(p.paragraphs[0].lineIds.length, 3);
    assert.equal(
      p.paragraphs[0].text,
      "连续正文第一行内容连续正文第二行内容连续正文第三行内容。",
    );
    assert.equal(p.lines.length, 4);
  },
);
await check(
  "One multiline question retains its stem and all horizontal options",
  () => {
    const p = page([
        ["1. 已知物体的运动条件，", 0.1, 0.1],
        ["计算物体运动的加速度。", 0.1, 0.127],
        ["A. 甲 B. 乙 C. 丙 D. 丁", 0.1, 0.17],
      ]),
      q = questions([p]);
    assert.equal(q.length, 1);
    assert(q[0].stem.includes("运动条件，计算"));
    assert.deepEqual(
      q[0].options.map((option) => option.label),
      ["A", "B", "C", "D"],
    );
    assert.equal(q[0].status, "candidate");
  },
);
await check(
  "Two columns read down the left column before the right column",
  () => {
    const p = page([
      ["1. 已知左栏物理条件，", 0.07, 0.1, 0.37],
      ["计算左栏加速度。", 0.07, 0.127, 0.37],
      ["A. 甲 B. 乙", 0.07, 0.16, 0.37],
      ["2. 已知右栏物理条件，", 0.56, 0.1, 0.37],
      ["计算右栏加速度。", 0.56, 0.127, 0.37],
      ["A. 丙 B. 丁", 0.56, 0.16, 0.37],
    ]);
    assert.equal(p.columns.length, 2);
    const q = questions([p]);
    assert.deepEqual(
      q.map((q) => q.number),
      ["1", "2"],
    );
    assert(!q[0].stem.includes("右栏"));
    assert(!q[1].stem.includes("左栏"));
  },
);
await check("Three text columns retain every line without lending middle options or a leading table to another question", () => {
  const p = page([
    ["三栏练习测试卷", .08, .05, .87, "doc_title"],
    ["1. 已知左栏条件，", .07, .14, .27],
    ["求左栏的压强。", .08, .167, .24],
    ["A. 甲 B. 乙 C. 丙 D. 丁", .08, .78, .27],
    ["题号 得分 阅卷人", .38, .10, .21, "table"],
    ["2. 已知中栏条件，", .375, .14, .28],
    ["求中栏的速度。", .385, .167, .27],
    ["A. 中栏甲", .388, .214, .26],
    ["B. 中栏乙", .388, .25, .15],
    ["C. 中栏丙", .388, .29, .27],
    ["D. 中栏丁", .388, .33, .22],
    ["3. 已知右栏条件，", .68, .14, .28],
    ["计算右栏物体的质量。", .70, .167, .24],
    ["右栏还有附加条件。", .70, .29, .23],
  ]);
  assert.equal(p.columns.length, 3);
  assert.deepEqual(p.issues, []);
  const q = questions([p]);
  assert.deepEqual(q.map(item => item.number), ["1", "2", "3"]);
  assert.deepEqual(q.map(item => item.options.length), [4, 4, 0]);
  assert(!q[0].stem.includes("得分"));
  assert(!q[2].stem.includes("中栏"));
  const ownership = p.paragraphs.flatMap(part => part.lineIds);
  assert.equal(new Set(ownership).size, p.lines.length);
  assert.equal(ownership.length, p.lines.length);
});
await check("A fused OCR line across the gutter stays reviewable with its original coordinates", () => {
  const p = page([
    ["1. 已知左栏条件，", .07, .1, .36],
    ["求左栏的压强。", .08, .127, .35],
    ["混合了两个栏位的行", .36, .15, .28],
    ["2. 已知右栏条件，", .56, .1, .37],
    ["求右栏的质量。", .57, .127, .36],
  ]);
  assert.equal(p.columns.length, 2);
  assert(p.issues.includes("ambiguous_columns"));
  assert(questions([p]).every(q => q.status === "needs_review"));
  assert(p.paragraphs.some(part => part.rawText.includes("混合了两个栏位的行")));
});
await check("Parallel short stems and options remain pending if a gutter cannot be established", () => {
  const p = page([
    ["1. 求值？", .08, .10, .08],
    ["2. 求值？", .58, .10, .08],
    ["A. 1", .08, .127, .07],
    ["A. 2", .58, .127, .07],
    ["B. 3", .08, .154, .07],
    ["B. 4", .58, .154, .07],
  ]);
  assert(p.issues.includes("ambiguous_columns"));
  assert(questions([p]).every(q => q.status === "needs_review"));
});
await check("A blocked gutter is uncertain only with independent lanes, including staggered distinct regions", () => {
  const rows = [
    ["1. 已知这些条件，计算结果。", .12, .07, .62],
    ["左侧的一段条件", .16, .12, .24], ["右侧的一段条件", .54, .12, .24],
    ["这条正文跨过候选栏缝。", .12, .16, .62],
    ["左侧仍有一段条件", .16, .20, .24], ["右侧仍有一段条件", .54, .20, .24],
    ["另一条正文跨过候选栏缝。", .12, .26, .62],
  ];
  const recover = (base, regions) => recoverStructurePage({...base, regions,
    lines: base.lines.map(line => ({id: line.sourceId, text: line.text, score: line.score, normalizedQuad: line.quad})),
  });
  const replace = (base, ...blocks) => recover(base, [
    ...base.regions.filter(region => !["block-2", "block-3", "block-5", "block-6"].includes(region.id)),
    ...blocks.map((box, index) => ({id: `block-${20 + index}`, box, kind: "text", score: .99, needsReview: true})),
  ]);
  const base = page(rows);
  assert.equal(base.columns.length, 1);
  assert(base.issues.includes("ambiguous_columns"));
  const fragmented = replace(base, [.16, .12, .78, .218]);
  assert.deepEqual(fragmented.columns, base.columns);
  assert.deepEqual(fragmented.issues, []);
  assert.deepEqual(fragmented.lines.map(line => [line.text, line.quad]), base.lines.map(line => [line.text, line.quad]));
  assert.equal(questions([fragmented])[0].status, "candidate");

  const offset = page(rows.map((row, i) => i === 2 || i === 5 ? [row[0], row[1], row[2] + .021, row[3]] : row));
  assert(offset.issues.includes("ambiguous_columns"), "Staggered independent line boxes still support two lanes");
  const staggered = replace(offset, [.16, .12, .40, .218], [.54, .14, .78, .24]);
  assert.equal(staggered.columns.length, 1);
  assert(staggered.issues.includes("ambiguous_columns"));
  assert(questions([staggered]).every(question => question.status === "needs_review"));
});
await check("An unresolved leading table keeps its text and marks both neighboring questions for review", () => {
  const p = page([
    ["1. 根据实验数据，选择结论。", .07, .26, .37],
    ["比较各个数据后选择。", .07, .287, .37],
    ["A. 恒定 B. 增大 C. 减小 D. 无关", .07, .75, .37],
    ["次数 质量 时间", .56, .10, .35, "table"],
    ["2. 根据右栏条件，求结果。", .56, .26, .37],
    ["计算右栏量值。", .56, .287, .37],
  ]);
  assert.equal(p.columns.length, 2);
  const q = questions([p]);
  assert.equal(q.length, 2);
  assert(q[0].stem.includes("次数 质量 时间"));
  assert(q.every(item => item.status === "needs_review" && item.issues.includes("ambiguous_columns")));
});
await check("Subquestions keep their own option groups", () => {
  const q = questions([
    page([
      ["1. 已知材料，回答下列问题。", 0.1, 0.1],
      ["（1）求第一问的结果。", 0.12, 0.15],
      ["A. 甲 B. 乙", 0.12, 0.19],
      ["（2）计算第二问的结果。", 0.12, 0.24],
      ["A. 丙 B. 丁", 0.12, 0.28],
    ]),
  ])[0];
  assert.equal(q.options.length, 0);
  assert.deepEqual(
    q.subquestions.map((part) => part.label),
    ["1", "2"],
  );
  assert.deepEqual(
    q.subquestions.map((part) => part.options.map((option) => option.label)),
    [
      ["A", "B"],
      ["A", "B"],
    ],
  );
});
await check(
  "A question continues across pages until the next parent boundary",
  () => {
    const first = page(
        [
          ["1. 已知以下条件，回答问题。", 0.1, 0.1],
          ["（1）计算第一部分。", 0.12, 0.15],
        ],
        1,
        2,
      ),
      second = page(
        [
          ["（2）计算第二部分。", 0.12, 0.1],
          ["2. 求下一道题的结果。", 0.1, 0.22],
        ],
        2,
        2,
      ),
      q = questions([first, second]);
    assert.equal(q.length, 2);
    assert.deepEqual(q[0].pageRange, [1, 2]);
    assert.deepEqual(
      q[0].subquestions.map((part) => part.label),
      ["1", "2"],
    );
    assert(q[0].anchors.some((anchor) => anchor.page === 2));
  },
);
await check(
  "Headers, footers and instructions remain in source paragraphs and stay outside questions",
  () => {
    const p = page([
      ["物理试卷", 0.1, 0.02, 0.8, "header"],
      ["考生注意：", 0.1, 0.08],
      ["1. 本卷满分100分，考试时间90分钟。", 0.1, 0.12],
      ["一、选择题", 0.1, 0.2, 0.8, "paragraph_title"],
      ["1. 已知条件，求结果。", 0.1, 0.27],
      ["第1页", 0.4, 0.94, 0.2, "footer"],
    ]);
    const q = questions([p]);
    assert.equal(q.length, 1);
    assert(!q[0].stem.includes("满分"));
    assert(!q[0].stem.includes("第1页"));
    assert.equal(p.paragraphs.flatMap((p) => p.lineIds).length, p.lines.length);
  },
);
await check(
  "A side diagram stays attached without turning its labels into a new question",
  () => {
    const p = page(
      [
        ["1. 如图，求物体所受合力。", 0.1, 0.1, 0.42],
        ["A. 甲 B. 乙", 0.1, 0.14, 0.42],
        ["F₁", 0.7, 0.16, 0.05, "image"],
        ["2. 求下一题。", 0.1, 0.4],
      ],
      1,
      1,
      [
        {
          id: "diagram",
          kind: "image",
          score: 0.99,
          box: [0.6, 0.11, 0.88, 0.32],
          needsReview: true,
        },
      ],
    );
    const q = questions([p]);
    assert.equal(q.length, 2);
    assert(q[0].assets.some((asset) => asset.regionId === "diagram"));
    assert(!q[0].issues.includes("missing_figure"));
    assert(!q[0].stem.includes("F₁"));
  },
);
await check(
  "Mathematical symbols and unit token gaps survive paragraph recovery",
  () => {
    assert.equal(
      joinStructureLines(["F = m a", "v = 2 m s⁻¹"]),
      "F = m a v = 2 m s⁻¹",
    );
    const p = page([
      ["1. 已知 x² 与 α，求结果。", 0.1, 0.1],
      ["F = m a", 0.1, 0.15, 0.5, "display_formula"],
    ]);
    const q = questions([p])[0];
    assert(q.stem.includes("x²"));
    assert(q.stem.includes("α"));
    assert(q.assets.some((asset) => asset.kind === "display_formula"));
    assert(p.rawText.includes("F = m a"));
  },
);
await check(
  "Shared material has explicit links to its bounded question range",
  () => {
    const q = questions([
      page([
        ["阅读材料，回答1～2题。", 0.1, 0.1],
        ["物体在光滑水平面运动。", 0.1, 0.127],
        ["1. 求速度。", 0.1, 0.19],
        ["2. 求加速度。", 0.1, 0.25],
        ["3. 求另一物体速度。", 0.1, 0.31],
      ]),
    ]);
    assert.equal(q.length, 3);
    assert(q[0].sharedMaterialIds.length);
    assert.deepEqual(q[0].sharedMaterialIds, q[1].sharedMaterialIds);
    assert.equal(q[2].sharedMaterialIds.length, 0);
    assert(q[0].stem.includes("光滑水平面"));
  },
);
await check(
  "Low-confidence scans are held and raw line coverage is exact",
  () => {
    const p = page([
        ["1. 已知模糊条件，求结果。", 0.1, 0.1, 0.8, "text", 0.5],
        ["残缺行", 0.1, 0.127, 0.5, "text", 0.6],
      ]),
      q = questions([p])[0];
    assert.equal(q.status, "needs_review");
    assert(q.issues.includes("low_ocr_score"));
    const ids = p.paragraphs.flatMap((p) => p.lineIds);
    assert.equal(new Set(ids).size, p.lines.length);
    for (const line of p.lines)
      assert(
        p.paragraphs.some(
          (p) => p.lineIds.includes(line.id) && p.rawText.includes(line.text),
        ),
      );
  },
);
await check('Fragmented punctuation on the same baseline joins its original stem',()=>{
 const p=page([['1. 已知条件，求结果（',.1,.1,.4],['）',.58,.1,.025],['A. 甲 B. 乙 C. 丙 D. 丁',.1,.15,.8]]);
 const q=questions([p])[0];assert(q.stem.startsWith('已知条件，求结果（）'));assert.equal(p.paragraphs[0].lineIds.length,2);
});
await check('A diagram label between two text rows does not break a continuous stem',()=>{
 const p=page([['1. 已知运动条件，物体逐',.1,.1,.6],['F',.78,.105,.04,'image'],['渐加速，计算其位移。',.1,.127,.6],['A. 甲 B. 乙',.1,.17,.6]],1,1,[{id:'diagram',kind:'image',score:.99,box:[.76,.09,.9,.2],needsReview:true}]);
 const q=questions([p])[0];assert(q.stem.includes('物体逐渐加速'));assert(q.assets.some(a=>a.rawText.includes('F')));
});
await check('A punctuation-marked horizontal option retains its original label and raw content',()=>{
 const q=questions([page([['1. 选择正确结果。',.1,.1],['A. 甲 B. 乙 C. 丙',.1,.15],['、（D）丁',.1,.19]])])[0];
 assert.deepEqual(q.options.map(o=>o.label),['A','B','C','D']);assert(q.stem.includes('、（D）丁'));
});
await check('Nested numbered and circled subquestions retain a two-level tree',()=>{
 const q=questions([page([['1. 已知材料，回答下列问题。',.1,.1],['（1）计算第一部分。',.12,.15],['① 求第一个量。',.14,.19],['② 求第二个量。',.14,.23],['（2）计算第二部分。',.12,.27]])])[0];
 assert.deepEqual(q.subquestions.map(p=>p.label),['1','2']);assert.deepEqual(q.subquestions[0].children.map(p=>p.label),['①','②']);assert.equal(q.subquestions[1].children,undefined);
});
await check('A repeated section title on a new page preserves the unfinished question',()=>{
 const a=page([['一、计算题',.1,.05,.8,'paragraph_title'],['1. 已知条件，回答问题。',.1,.1],['（1）求第一个量。',.12,.15]],1,2);
 const b=page([['一、计算题',.1,.05,.8,'paragraph_title'],['（2）求第二个量。',.12,.1],['2. 已知条件，求下一题。',.1,.2]],2,2);
 const q=questions([a,b]);assert.deepEqual(q[0].pageRange,[1,2]);assert.equal(q[0].subquestions.length,2);
});
await check('Unnumbered question fragments are quarantined with their original anchors',()=>{
 const q=questions([page([['已知物理条件，计算结果。',.1,.1],['A. 甲 B. 乙',.1,.15]])])[0];assert.equal(q.status,'needs_review');assert(q.issues.includes('missing_question_start'));assert.equal(q.paragraphIds.length,2);
});
await check('Shared materials and their diagrams keep cross-page provenance',()=>{
 const a=page([['阅读材料，完成1～2题。',.1,.1],['已知物体在斜面运动。',.1,.15]],1,2,[{id:'material-figure',kind:'image',score:.99,box:[.7,.12,.9,.22],needsReview:true}]);
 const b=page([['1. 求加速度。',.1,.1],['2. 求位移。',.1,.2]],2,2);const q=questions([a,b]);
 assert(q.every(q=>q.sharedMaterialIds.length===2));assert(q.every(q=>q.pageRange[0]===1));assert(q.every(q=>q.assets.some(a=>a.regionId==='material-figure')));
});
await check('An unbounded lead-in stays with at most one review candidate; later references still need evidence',()=>{
 const a=page([['导语：本章介绍液体静力学。',.1,.08,.8],['1. 已知水深为2m，求液体压强。',.1,.22],['2. 已知质量为3kg，求作用力。',.1,.39]],1,2);
 const b=page([['3. 已知密度和体积，求质量。',.1,.08],['4. 已知条件，计算结果。',.1,.25],['（1）根据上述材料，求速度。',.12,.31],['5. 根据材料一求质量。',.1,.40],['6. 已知试验条件，分析结果。',.1,.49],['根据上述材料，求容器质量。',.1,.56]],2,2);
 const [first,second,third,...dependent]=questions([a,b]);
 assert(first.sharedMaterialIds.length&&first.issues.includes('shared_material_scope'));
 assert(second.sharedMaterialIds.length===0&&!second.stem.includes('导语')&&second.status==='candidate');
 assert(third.sharedMaterialIds.length===0&&third.status==='candidate');
 assert.deepEqual(third.pageRange,[2,2]);
 assert(dependent.length===3&&dependent.every(q=>q.issues.includes('shared_material_scope')&&q.status==='needs_review'));
 assert(dependent[0].subquestions[0].text.includes('根据上述材料'));
 assert(dependent[2].stem.includes('求容器质量'));
 assert(a.paragraphs.some(p=>p.rawText.includes('本章介绍')));
});
await check('A printed page count is removed from stems only with bottom geometry, number region, and matching page',()=>{
 const a=page([['1. 已知数据，求结果。',.1,.1],['第 1 页共 2 页',.42,.94,.16,'number']],1,2);
 const b=page([['2. 已知条件，求结果。',.1,.1]],2,2);
 assert(a.paragraphs.some(p=>p.role==='footer'&&p.rawText==='第 1 页共 2 页'));
 assert(!questions([a,b])[0].stem.includes('第 1 页共'));
 assert.equal(page([['1/2',.42,.94,.16,'number']],1,2).paragraphs[0].role,'footer');
 for(const [text,y,kind] of [['第 2 页共 2 页',.94,'number'],['第 1 页共 7 页',.94,'number'],['第 1 页共 2 页',.5,'number'],['第 1 页共 2 页',.94,'text'],['3/7',.4,'number'],['2/2',.94,'number']])
  assert.equal(page([[text,.42,y,.16,kind]],1,2).paragraphs[0].role,'body');
});
await check('Named folios use adjoining physical regions and retain the exact OCR line without polluting the question',()=>{
 const name='学期练习（B卷） 第 ４ 页 共 ４ 页';
 const label={id:'block-70',kind:'footer',score:.83,box:[.393,.921,.467,.937],needsReview:true};
 const number={id:'block-71',kind:'number',score:.84,box:[.474,.921,.609,.937],needsReview:true};
 function fixture(text=name,regions=[label,number],y=.92){
  const seed=page([['21. 已知条件，求答案。',.1,.60],['(1) 计算第一问。',.11,.64],[text,.392,y,.216]],4,4);
  return recoverStructurePage({...seed,regions:[...seed.regions.slice(0,2),...regions],
   lines:seed.lines.map(line=>({id:line.sourceId,text:line.text,score:line.score,normalizedQuad:line.quad}))});
 }
 const fixed=fixture(), footer=fixed.paragraphs.at(-1), corrected=questions([fixed])[0];
 assert.equal(footer.role,'footer');
 assert.equal(footer.rawText,name);
 assert.equal(fixed.lines.at(-1).text,name);
 assert.deepEqual(footer.anchor,{page:4,box:fixed.lines.at(-1).box});
 assert(!corrected.stem.includes(name)&&!corrected.subquestions[0].text.includes(name));
 assert(!corrected.paragraphIds.includes(footer.id));

 const negatives=[fixture(name,[number]),fixture(name,[{...label,score:.79},number]),
  fixture(name,[label,{...number,box:[.474,.951,.609,.969]}]),
  fixture(name,[label,{...number,box:[.506,.921,.609,.937]}]),
  fixture(name,[label,{...number,box:[.40,.921,.59,.937]}]),
  fixture(name,[label,number,{id:'block-72',kind:'text',score:.99,box:[.37,.9,.64,.95]}]),
  fixture(name.replace('４ 页 共','３ 页 共')),fixture(name.replace('共 ４','共 ５')),
  fixture('如需查看资料，请参阅第4页共4页'),fixture(name,[label,number],.85)];
 assert(negatives.every(p=>p.paragraphs.at(-1).role!=='footer'));
 assert.equal(page([['第3页共4页',.39,.92,.21,'footer']],4,4).paragraphs.at(-1).role,'footer');
});
await check('A declared material range excludes questions both before and after it',()=>{
 const rows=[['阅读材料，完成3～4题。',.1,.08],['背景材料内容。',.1,.13],['2. 已知条件，求结果。',.1,.23],['3. 根据材料一求结果。',.1,.32],['4. 根据材料计算差值。',.1,.40],['5. 已知功率，求耗电量。',.1,.49]];
 const [before,first,last,after]=questions([page(rows)]);
 assert(!before.sharedMaterialIds.length&&!before.stem.includes('背景材料'));
 assert(first.sharedMaterialIds.length&&last.sharedMaterialIds.length);
 assert(!after.sharedMaterialIds.length&&!after.stem.includes('背景材料'));
});
await check('Formula and table regions are associated without inventing symbols or cells',()=>{
 const q=questions([page([['1. 根据下表，计算结果。',.1,.1],['v = 2 m/s',.1,.15,.4,'display_formula'],['t/s  1  2  3',.1,.2,.6,'table']])])[0];
 assert(q.assets.some(a=>a.kind==='table'));assert(q.assets.some(a=>a.kind==='display_formula'));assert(q.stem.includes('v = 2 m/s'));assert(q.stem.includes('t/s  1  2  3'));
});
await check('Conflicting overlapping layout regions stay in review',()=>{
 const p=page([['1. 计算结果。',.1,.1]],1,1,[{id:'conflict',kind:'image',score:.99,box:[.1,.1,.9,.118],needsReview:true}]);
 assert(p.paragraphs[0].issues.includes('ambiguous_region'));assert.equal(questions([p])[0].status,'needs_review');
});
await check('Word paragraph indexing keeps a long native paragraph intact',async()=>{
 const {splitMaterialParagraphs}=await import('../../src/main/assets/material-chunks.ts');const a='原始Word段落'.repeat(300),b='下一段完整内容。';const chunks=splitMaterialParagraphs(a+'\n\n'+b);assert.equal(chunks[0].content,a);assert.equal(chunks[1].content,b);
});
await check('Five hundred streamed pages keep question boundaries and independent source IDs',()=>{
 const start=performance.now(),builder=new StructureQuestionAssembler(),ids=new Set();let count=0;
 for(let number=1;number<=500;number++){
  const p=page([[String(number*2-1)+'. 已知条件，计算第一题。',.1,.1],['A. 甲 B. 乙 C. 丙 D. 丁',.1,.15],[String(number*2)+'. 已知条件，计算第二题。',.1,.21],['（1）求第一小问。',.12,.26]],number,500);
  const emitted=builder.push(p);assert.equal(emitted.length,number===1?1:2);
  for(const q of emitted){assert(!ids.has(q.id));ids.add(q.id);assert.equal(q.pageRange[0],q.pageRange[1]);count++;}
 }
 for(const q of builder.end()){assert(!ids.has(q.id));ids.add(q.id);count++;}
 assert.equal(count,1000);console.log(JSON.stringify({syntheticPages:500,questions:count,structureMs:Math.round(performance.now()-start)}));
});
await check('Uncertain shared conditions quarantine every dependent question',()=>{
 const p=page([['阅读材料，完成1～2题。',.1,.1,.8,'text',.6],['1. 求第一题结果。',.1,.2],['2. 求第二题结果。',.1,.3]]),q=questions([p]);assert.equal(q.length,2);assert(q.every(q=>q.status==='needs_review'&&q.confidence===.6&&q.issues.includes('low_ocr_score')));
});
await check('Low-confidence diagram labels reduce the confidence of the whole question',()=>{
 const p=page([['1. 如图，计算力。',.1,.1,.5],['F',.75,.13,.1,'image',.5]],1,1,[{id:'figure',kind:'image',score:.98,box:[.7,.12,.9,.2],needsReview:true}]),q=questions([p])[0];assert.equal(q.confidence,.5);assert.equal(q.status,'needs_review');
});
console.log(
  JSON.stringify({
    success: true,
    count: results.length,
    results,
    scope:
      "Synthetic layout/paragraph/question invariants; production integration and natural samples are separate gates",
  }),
);
