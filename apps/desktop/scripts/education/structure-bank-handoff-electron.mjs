import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { _electron as electron } from "playwright";
import { productEntry } from "../product-navigation.mjs";
import { openMaterialDisclosure } from "./material-disclosure-ui.mjs";

const seed = path.resolve(process.env.EDU_HANDOFF_SEED || ".");
const temporary = path.resolve(os.tmpdir());
const relative = path.relative(temporary, seed);
assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Use an isolated temporary test library");
const seedData = path.join(seed, "data");
const root = fs.mkdtempSync(path.join(temporary, "edudev-structure-handoff-"));
const data = path.join(root, "data");
fs.cpSync(seedData, data, {recursive:true, filter:file=>!/^app\.db(?:-(?:wal|shm))?$/.test(path.basename(file))});
const file = path.join(data, "app.db");
const backup = new DatabaseSync(path.join(seedData, "app.db"), {readOnly:true});
try { backup.exec("VACUUM INTO '"+file.replaceAll("'","''")+"'"); } finally {backup.close();}
const writer = new DatabaseSync(file);
try {
  for (const row of writer.prepare("SELECT id,local_path FROM teacher_resources").all()) {
    const source = path.relative(seedData,row.local_path);
    assert(source && !source.startsWith("..") && !path.isAbsolute(source));
    writer.prepare("UPDATE teacher_resources SET local_path=? WHERE id=?").run(path.join(data,source),row.id);
  }
} finally { writer.close(); }
const read = (sql, args = []) => {
  const db = new DatabaseSync(file, {readOnly:true});
  try { return db.prepare(sql).all(...args); } finally {db.close();}
};
const [source] = read("SELECT id,title FROM teacher_resources WHERE original_file_name='主书.pdf'");
const questionRows = () => read(`SELECT * FROM question_bank_items WHERE json_valid(archive_json)
  AND json_extract(archive_json,'$.structure.resourceId')=? AND json_extract(archive_json,'$.number')='12'
  ORDER BY rowid`,[source.id]);
const originalRows = questionRows();
assert.equal(originalRows.length,2);
assert(originalRows.every(row=>!row.stem.includes("____")));
const job = () => read(`SELECT s.generation,s.engine,a.status,a.parse_token FROM material_structure_jobs s
  JOIN material_question_jobs a ON a.resource_id=s.resource_id WHERE s.resource_id=?`,[source.id])[0];
const first = job();
assert.equal(first.parse_token,first.engine+":"+first.generation);
const frozenPages = () => read("SELECT * FROM material_structure_pages WHERE generation=? ORDER BY page",[first.generation]);
const frozenAnswers = () => read("SELECT batch_id,first_json,final_json FROM material_ai_units WHERE json_extract(input_json,'$.bookRole.kind')='answers'");
const pages = frozenPages(), answers = frozenAnswers();
assert(pages.length && answers.some(row=>row.final_json));
const stemNeedle = "用橡胶塞塞紧筒口";
const build = path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || "out");
let app;
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT:data, OMNI_EDU_REPO_ROOT:path.resolve("../.."),
    OMNI_EDU_E2E_DIALOG_MODE:"1", OMNI_EDU_E2E_VISIBLE:"0"};
  for (const key of ["ELECTRON_RUN_AS_NODE","NODE_OPTIONS","ELECTRON_RENDERER_URL","DEEPSEEK_API_KEY"]) delete env[key];
  app = await electron.launch({args:[path.join(build,"main/index.js"),"--user-data-dir="+path.join(root,"profile")],env,timeout:90000});
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  return page;
}
async function waitForArchive(previous) {
  const end = Date.now()+120000;
  do {
    const current = job();
    if (current.generation!==previous && current.parse_token===current.engine+":"+current.generation+":archive.v2") {
      assert.notEqual(current.status,"failed");
      if (current.status==="complete") return current.generation;
    }
    await delay(200);
  } while (Date.now()<end);
  assert.fail("archive handoff did not finish: "+JSON.stringify(job()));
}
async function openNotebook(page, current, history) {
  await productEntry(page,"teaching").click();
  await page.getByRole("button",{name:"题本",exact:true}).click();
  await page.getByTestId("question-notebook-search").fill(stemNeedle);
  const card = id=>page.getByTestId("question-notebook-card-"+id);
  await card(current.id).waitFor();
  for(const old of history) assert.equal(await card(old.id).count(),0);
  const result = await page.evaluate(query=>window.omniEdu.listQuestionNotebook({query}),stemNeedle);
  assert.deepEqual(result.items.map(item=>item.id),[current.id]);
  assert.equal(result.items[0].stem.match(/____/gu)?.length,2);
  return card;
}
function latestQuestion(generation) {
  const matching = questionRows().filter(row=>JSON.parse(row.archive_json).structure.generation===generation);
  assert.equal(matching.length,1);
  assert.equal(matching[0].stem.match(/____/gu)?.length,2);
  return matching[0];
}
try {
  let page = await launch();
  const migrated = await waitForArchive(null);
  assert.equal(migrated,first.generation);
  const newest = latestQuestion(migrated);
  const card = await openNotebook(page,newest,originalRows);
  await page.getByTestId("question-notebook-filter-toggle").click();
  await page.getByTestId("question-notebook-source-candidates").check();
  for (const old of originalRows) {
    await card(old.id).getByTestId("question-notebook-historical-structure").waitFor();
    assert.equal(await card(old.id).getByTestId("question-archive-edit-"+old.id).count(),0);
    await assert.rejects(page.evaluate(id=>window.omniEdu.getArchivedQuestionVersion(id),old.id), /structure_draft_superseded/);
  }
  console.log("PASS Startup repairs an old archive and real notebook search defaults to its new two-blank question");
  console.log("PASS Historical drafts are available explicitly and rejected by the editor");
  await productEntry(page,"materials").click();
  await page.getByTestId("materials-search").fill(source.title);
  await page.getByTestId("materials-refresh").click();
  await page.getByTestId("material-"+source.id).getByRole("button").click();
  await page.getByRole("button",{name:"题目与校正",exact:true}).click();
  const panel = page.getByTestId("material-structure-panel");
  await openMaterialDisclosure(panel);
  await panel.getByTestId("structure-rebuild").click();
  const rebuilt = await waitForArchive(migrated);
  const archived = JSON.parse(newest.archive_json).structure;
  const [rebuiltCandidate] = read("SELECT sha256 FROM material_structure_questions WHERE generation=? AND id=?",[rebuilt,archived.candidateId]);
  assert.equal(rebuiltCandidate?.sha256,archived.sha256,"repeat rebuild must reproduce the same source and transcription");
  await app.close();
  app = undefined;
  page = await launch();
  await openNotebook(page,newest,originalRows);
  assert.deepEqual(questionRows(),[...originalRows,newest]);
  assert.deepEqual(frozenPages(),pages);
  assert.deepEqual(frozenAnswers(),answers);
  console.log("PASS An identical rebuild and cold start preserve question IDs, page snapshots and answer receipts");
  console.log(JSON.stringify({ok:true,checks:3,root,olderQuestionRows:2,currentQuestionRows:1,preservedAnswerReceipts:answers.length}));
} finally {
  await app?.close();
}
