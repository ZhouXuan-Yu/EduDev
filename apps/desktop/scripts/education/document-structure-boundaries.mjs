import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
const { recoverStructurePage, StructureQuestionAssembler, joinStructureLines } =
  await import("../../src/main/assets/material-document-structure.ts");
const { verifiedQuestionInPdfConflict } =
  await import("../../src/main/assets/material-pdf-question-conflict.ts");
const { printedBlanks, printedBlankStripe, readPrintedParent } =
  await import("../../src/main/assets/material-printed-structure.ts");
const results = [];
async function check(name, run) {
  await run();
  results.push(name);
  console.log("PASS " + name);
}
function page(rows, number = 1, total = 1, extra = [], printedRecovery) {
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
  });
}
function questions(pages) {
  const builder = new StructureQuestionAssembler();
  return [...pages.flatMap((page) => builder.push(page)), ...builder.end()];
}
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
