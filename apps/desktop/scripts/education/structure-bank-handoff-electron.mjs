import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const [source] = read("SELECT id,title,content_hash FROM teacher_resources WHERE original_file_name='主书.pdf'");
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
const searchSchema = "xiaozhi.material-search.v1";
const matchingChunks = () => read(`SELECT id,chunk_index,heading,content_md,page_number,contains_personal_data
  FROM resource_chunks WHERE resource_id=? AND instr(content_md,?)>0 ORDER BY chunk_index,id`,[source.id,stemNeedle]);
const originalExcerpts = matchingChunks();
const currentExcerpt = originalExcerpts.find(row=>row.content_md.includes("____"));
const historicalExcerpts = originalExcerpts.filter(row=>row.id!==currentExcerpt?.id);
assert.equal(originalExcerpts.length,3);
assert(currentExcerpt);
const beforeSearch = read(`SELECT count(*) count FROM material_body_fts_v1 f JOIN resource_chunks c ON c.rowid=f.rowid
  WHERE c.resource_id=? AND instr(c.content_md,?)>0`,[source.id,stemNeedle])[0].count;
assert.equal(beforeSearch,3);
function originalCitation(chunk) {
  const [{offset}] = read(`SELECT count(*) offset FROM resource_chunks
    WHERE resource_id=? AND (chunk_index<? OR chunk_index=? AND id<?)`,
    [source.id,chunk.chunk_index,chunk.chunk_index,chunk.id]);
  const bodyVersion = createHash("sha256").update(JSON.stringify([
    chunk.id,chunk.chunk_index,chunk.content_md,Boolean(chunk.contains_personal_data),{pageNumber:chunk.page_number},
  ])).digest("hex");
  return {schemaVersion:"xiaozhi.material-source.v1",resourceId:source.id,version:source.content_hash,
    chunkId:chunk.id,offset,bodyVersion};
}
const historicalCitations = historicalExcerpts.map(originalCitation);
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
async function checkSearch(page,generation,withUi=false) {
  const end = Date.now()+20000;
  let publication;
  do {
    [publication] = read("SELECT generation,pending,error FROM material_structure_search_publications WHERE resource_id=?",[source.id]);
    if (publication?.generation===generation && !publication.pending) break;
    await delay(150);
  } while(Date.now()<end);
  assert.deepEqual({...publication},{generation,pending:0,error:""});
  const timings = {};
  for (const mode of ["keyword","hybrid"]) {
    const began = performance.now();
    const result = await page.evaluate(input=>window.omniEdu.searchMaterialText(input),
      {schemaVersion:searchSchema,query:stemNeedle,offset:0,mode});
    timings[mode] = Math.round(performance.now()-began);
    if(mode==="hybrid") timings.semanticAvailable=Boolean(result.semantic?.available);
    const direct = result.hits.filter(hit=>hit.excerpt.includes(stemNeedle) && hit.source.resourceId===source.id
      && hit.source.schemaVersion==="xiaozhi.material-source.v1");
    assert.deepEqual(direct.map(hit=>hit.source.chunkId),[currentExcerpt.id]);
    assert(result.hits.every(hit=>historicalExcerpts.every(old=>old.id!==hit.source.chunkId)));
  }
  const after = read(`SELECT count(*) count FROM material_body_fts_v1 f JOIN resource_chunks c ON c.rowid=f.rowid
    WHERE c.resource_id=? AND instr(c.content_md,?)>0`,[source.id,stemNeedle])[0].count;
  assert.equal(after,1);
  const stableIds = originalExcerpts.map(row=>row.id);
  assert.deepEqual(matchingChunks().filter(row=>stableIds.includes(row.id)),originalExcerpts);
  for (const [index,citation] of historicalCitations.entries()) {
    const view = await page.evaluate(ref=>window.omniEdu.getMaterialSource(ref),citation);
    assert.deepEqual(view.source,citation);
    assert.equal(view.body.chunks[0].id,citation.chunkId);
    assert.equal(view.body.chunks[0].contentMd,historicalExcerpts[index].content_md);
  }
  if(withUi) {
    await productEntry(page,"materials").click();
    await page.getByTestId("materials-mode-text").click();
    await page.getByTestId("materials-search-mode").selectOption("keyword");
    await page.getByTestId("materials-text-query").fill(stemNeedle);
    await page.getByTestId("materials-text-submit").click();
    const result = page.getByTestId("material-text-hit-"+currentExcerpt.id);
    await result.waitFor();
    for (const id of historicalExcerpts.map(row=>row.id))
      assert.equal(await page.getByTestId("material-text-hit-"+id).count(),0);
    await result.click();
    await page.getByTestId("materials-body-location").waitFor();
    await page.getByTestId("materials-mode-catalog").click();
  }
  return {before:beforeSearch,after,historicalReadable:historicalCitations.length,...timings};
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
  const firstSearch = await checkSearch(page,migrated,true);
  const newSources = JSON.parse(newest.archive_json).sources;
  assert(newSources.length);
  assert(newSources.every(ref=>historicalCitations.every(old=>old.chunkId!==ref.chunkId)));
  console.log("PASS Startup switches full-text, hybrid and the teacher's catalog view to the current excerpt; old citations open");
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
  const restartSearch = await checkSearch(page,rebuilt);
  assert.deepEqual(questionRows(),[...originalRows,newest]);
  assert.deepEqual(frozenPages(),pages);
  assert.deepEqual(frozenAnswers(),answers);
  console.log("PASS An identical rebuild and cold start preserve question IDs, page snapshots and answer receipts");
  console.log("PASS Rebuild and cold start keep one discoverable excerpt and both historical citations");
  console.log(JSON.stringify({ok:true,checks:5,root,olderQuestionRows:2,currentQuestionRows:1,preservedAnswerReceipts:answers.length,firstSearch,restartSearch}));
} finally {
  await app?.close();
}
