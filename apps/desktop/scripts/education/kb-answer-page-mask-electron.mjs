import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {backup, DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const original = realpathSync(process.argv[2]);
assert(path.basename(original).startsWith('kb-structure-batch-'), 'Use only the retained isolated library');
const entry = path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || 'out', 'main/index.js');
const working = mkdtempSync(path.join(tmpdir(), 'omni-edu-answer-page-mask-'));
const data = path.join(working, 'data'), profile = path.join(working, 'profile');
const dbFile = path.join(data, 'app.db'), sourceDb = path.join(original, 'data/app.db');
const sha = value => createHash('sha256').update(value).digest('hex');
const all = (filename, sql, ...params) => {
  const db = new DatabaseSync(filename, {readOnly: true, timeout: 5000});
  try { return db.prepare(sql).all(...params).map(row => ({...row})); } finally { db.close(); }
};
const query = (sql, ...params) => all(dbFile, sql, ...params);
const source = new DatabaseSync(sourceDb, {readOnly: true});
mkdirSync(data);
try { await backup(source, dbFile); } finally { source.close(); }
const db = new DatabaseSync(dbFile);
let answer, pages;
try {
  for (const part of ['teacher_resources', 'question-assets/v1']) mkdirSync(path.join(data, part), {recursive: true});
  const pair = db.prepare('SELECT question_id,answer_id FROM material_book_pairs WHERE active=1').all();
  assert.equal(pair.length, 1);
  for (const id of [pair[0].question_id, pair[0].answer_id]) {
    const item = db.prepare('SELECT id,content_hash version,original_file_name name,local_path FROM teacher_resources WHERE id=?').get(id);
    const input = realpathSync(item.local_path), next = path.join(data, 'teacher_resources', path.basename(input));
    assert.equal(path.dirname(input), path.join(original, 'data', 'teacher_resources'));
    assert.equal(sha(readFileSync(input)), item.version);
    copyFileSync(input, next);
    db.prepare('UPDATE teacher_resources SET local_path=? WHERE id=?').run(next, id);
    if (id === pair[0].answer_id) answer = {...item, local: next};
  }
  pages = db.prepare(`SELECT s.page,s.body_json,s.image_json,p.result_json
    FROM material_structure_jobs j JOIN material_structure_pages s ON s.generation=j.generation
    JOIN material_pdf_jobs k ON k.resource_id=j.resource_id AND j.version=k.version
    JOIN material_pdf_pages p ON p.generation=k.generation AND p.page=s.page
    WHERE j.resource_id=? ORDER BY s.page`).all(answer.id).map(row => {
    const layout = JSON.parse(row.body_json), image = JSON.parse(row.image_json), parsed = JSON.parse(row.result_json);
    const privateNumber = /(?<!\d)1[3-9]\d{9}(?!\d)/u;
    const header = layout.lines.filter(line => privateNumber.test(line.text));
    assert.equal(header.length, 1);
    assert.equal(parsed.ocrText, layout.rawText);
    const body = parsed.ocrText.split('\n').filter(line => line !== header[0].text).join('\n');
    assert(!privateNumber.test(body) && body.includes('【答案】'));
    const suffix = path.join('question-assets/v1', image.assetId + '.png');
    const raster = path.join(data, suffix);
    copyFileSync(path.join(original, 'data', suffix), raster);
    assert.equal(sha(readFileSync(raster)), image.sha256);
    return {page: row.page, body, raster, originalSha: image.sha256, header: header[0].box};
  });
  assert.equal(pages.length, 9);
  // Use a fresh local test profile and the synthetic account below.
  db.prepare("DELETE FROM app_settings WHERE key='xiaozhi.provider.v1'").run();
} finally { db.close(); }

const state = () => sha(JSON.stringify([
  query('SELECT id,calls,status FROM material_ai_batches ORDER BY id'),
  query('SELECT * FROM material_folder_ai ORDER BY batch_id'),
]));
const before = state();
const originalAnswerHash = sha(readFileSync(answer.local));
const initialUnits = query('SELECT id,calls FROM material_ai_batches ORDER BY id');
const existing = new Set(initialUnits.map(unit => unit.id));
const hold = query('SELECT * FROM material_book_pairs');
const errors = [];
let app, batchId, wire;
async function launch(cold = false) {
  const env = {...process.env};
  for (const name of Object.keys(env)) {
    if (/KEY|TOKEN|SECRET|CREDENTIAL/i.test(name) || name.startsWith('OMNI_EDU_') ||
        ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
  }
  Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve('../..'),
    OMNI_EDU_SKIP_DOTENV: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_VISIBLE: '0', DEEPSEEK_API_KEY: 'answer-mask-local-stub'});
  app = await electron.launch({args: [entry, '--user-data-dir=' + profile,
    '--host-resolver-rules=MAP * ~NOTFOUND'], cwd: working, env, timeout: 90000});
  await app.evaluate(({net}, options) => {
    const digest = process.getBuiltinModule('node:crypto').createHash;
    globalThis.answerMaskWire = {calls: [], violations: []};
    const reject = note => {
      globalThis.answerMaskWire.violations.push(note);
      return new Response('blocked by local test', {status: 400});
    };
    net.fetch = globalThis.fetch = async (url, init) => {
      if (/^https:\/\/api\.deepseek\.com\/(?:v1\/)?models$/u.test(String(url))) {
        return Response.json({object: 'list', data: [{id: 'deepseek-flash', input_modalities: ['text','image']}]});
      }
      if (options.cold || String(url) !== 'https://api.deepseek.com/chat/completions') return reject('unexpected request');
      const content = JSON.parse(init.body).messages[1].content;
      const payload = JSON.parse(content[0].text);
      const calls = globalThis.answerMaskWire.calls;
      const sample = options.pages[Math.floor(calls.length / 2)];
      const copy = content?.[1]?.image_url?.url;
      if (!sample || content.length !== 2 || !(typeof copy === 'string' && copy.startsWith('data:image/png;base64,')) ||
          !payload.material.replace(/\n\n+/gu, '\n').includes(sample.body.replace(/\n\n+/gu, '\n')) ||
          /(?<!\d)1[3-9]\d{9}(?!\d)/u.test(content[0].text) ||
          !payload.answerContext || !!payload.firstDraft !== (calls.length % 2 === 1)) {
        return reject('unexpected material or first/final contract');
      }
      const picture = Buffer.from(copy.split(',')[1], 'base64');
      const imageSha = digest('sha256').update(picture).digest('hex');
      if (imageSha === sample.originalSha) return reject('original image went to transport');
      calls.push({page: sample.page, imageSha, textSha: digest('sha256').update(payload.material).digest('hex')});
      const response = {schemaVersion:'xiaozhi.material-ai-book-page-response.v2',outcome:'needs_review',
        pageText:sample.body,questions:[],pageIssues:['uncertain_ocr'],answerIssues:[]};
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(response)}}]});
    };
  }, {pages: pages.map(({page, body, originalSha}) => ({page, body, originalSha})), cold});
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(45000);
  await productEntry(page, 'materials').click();
  await page.getByTestId('materials-search').fill(answer.name);
  await page.getByTestId('material-' + answer.id).getByRole('button').click();
  await page.getByRole('button', {name: '题目与校正', exact: true}).click();
  const panel = page.getByTestId('material-ai-panel');
  await openMaterialDisclosure(panel);
  return panel;
}
async function until(callback) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const result = await callback();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw Error('Timed out waiting for recorded local test state');
}

try {
  let panel = await launch();
  await panel.getByTestId('material-ai-answer-privacy').waitFor();
  assert.equal(state(), before, 'Opening the material cannot consume its prior authorization');
  await panel.getByTestId('material-ai-count').fill(String(pages.length));
  const submit = panel.getByTestId('material-ai-create');
  assert(await submit.isDisabled());
  await panel.getByTestId('material-ai-public').check();
  assert(await submit.isDisabled());
  await panel.getByTestId('material-ai-consent').check();
  await submit.click();
  const batches = await until(async () => {
    const b = query('SELECT id,calls,status FROM material_ai_batches WHERE resource_id=? ORDER BY created_at DESC LIMIT 1', answer.id)[0];
    if (!b || existing.has(b.id)) {
      if (await panel.getByRole('alert').count()) throw Error('The desktop refused the answer-page batch');
      return;
    }
    batchId = b.id;
    return b.status !== 'running' ? query('SELECT * FROM material_ai_units WHERE batch_id=? ORDER BY ordinal', batchId) : undefined;
  });
  wire = await app.evaluate(() => globalThis.answerMaskWire);
  assert.deepEqual(wire.violations, []);
  assert.deepEqual(batches.map(row => [row.status,row.error]), pages.map(() => ['review','page_content_incomplete']));
  assert.equal(wire.calls.length, pages.length * 2);
  const photos = await panel.page().evaluate(async id => {
    const results = [];
    for (let ordinal = 1; ordinal <= 9; ordinal++) {
      const view = await window.omniEdu.getMaterialAiPage({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:id,ordinal,includeImage:true});
      results.push({masked:view.headerMasked, dataUrl:view.inputImage?.dataUrl, status:view.status,
        originalOcrKept:/(?<!\d)1[3-9]\d{9}(?!\d)/u.test(view.ocrText)});
    }
    return results;
  }, batchId);
  const rasters = batches.map((row, i) => {
    const {answerPageMask: proof} = JSON.parse(row.input_json);
    const photo = photos[i];
    assert(photo.masked && photo.originalOcrKept && photo.status === 'needs_review');
    assert.equal(proof.originalImageSha, pages[i].originalSha);
    assert.equal(sha(Buffer.from(photo.dataUrl.split(',')[1], 'base64')), proof.imageSha);
    for (const call of wire.calls.slice(i * 2, i * 2 + 2)) {
      assert.deepEqual(call, {page: pages[i].page, imageSha: proof.imageSha, textSha: proof.textSha});
    }
    return {original: pages[i].raster, derived: photo.dataUrl.split(',')[1], masks: proof.masks, header: pages[i].header};
  });
  const pixelPass = await app.evaluate(({nativeImage}, samples) => {
    const read = process.getBuiltinModule('node:fs').readFileSync;
    return samples.every(({original, derived, masks, header}) => {
      const shape = nativeImage.createFromBuffer(read(original));
      const masked = nativeImage.createFromBuffer(Buffer.from(derived, 'base64'));
      const {width, height} = shape.getSize(1), resize = masked.getSize(1);
      if (width !== resize.width || height !== resize.height || masks.length !== 1) return false;
      const [left, top, right, bottom] = masks[0];
      if (left > width * header[0] || top > height * header[1] || right < width * header[2] || bottom < height * header[3]) return false;
      const a = shape.toBitmap({scaleFactor:1}), b = masked.toBitmap({scaleFactor:1});
      let changed = false;
      for (let y = 0; y < height; y++) {
        const row = y * width * 4;
        if (y < top || y >= bottom) {
          if (!a.subarray(row, row + width * 4).equals(b.subarray(row, row + width * 4))) return false;
          continue;
        }
        if (!a.subarray(row,row+left*4).equals(b.subarray(row,row+left*4)) ||
            !a.subarray(row+right*4,row+width*4).equals(b.subarray(row+right*4,row+width*4))) return false;
        for (let i = row + left * 4; i < row + right * 4; i++) {
          if (b[i] !== 255) return false;
          if (a[i] !== b[i]) changed = true;
        }
      }
      return changed;
    });
  }, rasters);
  assert(pixelPass, 'Every visible pixel outside the approved rectangles must remain identical');
  assert.equal(query('SELECT COUNT(*) count FROM material_ai_response_receipts WHERE batch_id=?', batchId)[0].count, 18);
  assert.equal(query('SELECT COUNT(*) count FROM material_ai_members WHERE batch_id=?', batchId)[0].count, 0);
  assert.deepEqual(query('SELECT id,calls FROM material_ai_batches WHERE id<>? ORDER BY id', batchId), initialUnits);
  assert.deepEqual(query('SELECT * FROM material_book_pairs'), hold);
  assert.equal(sha(readFileSync(answer.local)), originalAnswerHash);
  await app.close(); app = undefined;
  const cold = await launch(true);
  const view = cold.locator('[data-testid="material-ai-page-panel"]').first();
  await view.getByTestId('material-ai-page-open').click();
  await view.getByTestId('material-ai-page-header-masked').waitFor();
  await view.getByTestId('material-ai-page-image-open').click();
  await view.getByTestId('material-ai-page-image').waitFor();
  assert.deepEqual(await app.evaluate(() => globalThis.answerMaskWire), {calls: [], violations: []});
  assert.deepEqual(errors, []);

  // A privacy flag later added outside the certified header must disable
  // transport even though the corresponding original OCR/raster is unchanged.
  const snapshot = state();
  const touched = new DatabaseSync(dbFile);
  try {
    const changed = touched.prepare(`UPDATE resource_chunks SET content_md=content_md||?
      WHERE resource_id=? AND page_number=1 AND contains_personal_data=1`).run('\nFixture 13900000000', answer.id);
    assert.equal(changed.changes, 1);
  } finally { touched.close(); }
  const denied = cold.getByTestId('material-ai-create');
  assert(await denied.isDisabled());
  await cold.getByTestId('material-ai-public').check();
  await cold.getByTestId('material-ai-consent').check();
  await denied.click();
  await cold.getByRole('alert').filter({hasText:'未发送这一项'}).waitFor();
  assert.equal(state(), snapshot);
  assert.deepEqual(await app.evaluate(() => globalThis.answerMaskWire), {calls: [], violations: []});
  console.log(JSON.stringify({ok:true, unexplainedPrivacyBlocked:true, buildSha:sha(readFileSync(entry)), working, pages:pages.length,
    controlledRequests:wire.calls.length, externalRequests:0, pixelPreservation:pixelPass, reopened:true, rendererErrors:errors.length}));
} catch (error) {
  const units = batchId ? query('SELECT ordinal,status,error,dispatched_at FROM material_ai_units WHERE batch_id=?', batchId) : [];
  const diagnostics = app ? await app.evaluate(() => globalThis.answerMaskWire).catch(() => undefined) : wire;
  console.error(JSON.stringify({ok:false, working, units, wireCalls:diagnostics?.calls?.length, violations:diagnostics?.violations, rendererErrors:errors.length}));
  throw error;
} finally {
  await app?.close();
}
