import "../office-agent/register-source.mjs";
import assert from "node:assert/strict";
const { recoverStructurePage, StructureQuestionAssembler, joinStructureLines } =
  await import("../../src/main/assets/material-document-structure.ts");
const results = [];
async function check(name, run) {
  await run();
  results.push(name);
  console.log("PASS " + name);
}
function page(rows, number = 1, total = 1, extra = []) {
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
  });
}
function questions(pages) {
  const builder = new StructureQuestionAssembler();
  return [...pages.flatMap((page) => builder.push(page)), ...builder.end()];
}
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
console.log(
  JSON.stringify({
    success: true,
    count: results.length,
    results,
    scope:
      "Synthetic layout/paragraph/question invariants; production integration and natural samples are separate gates",
  }),
);
