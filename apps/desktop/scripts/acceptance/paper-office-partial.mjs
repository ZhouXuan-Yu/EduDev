/** Exact saved-byte continuation of an owned four-file failure, never a replay. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fingerprint, sha256} from './evidence.mjs';
import {readSavedExportFacts, SIX_EXPORTS} from './paper-instance-export-readback.mjs';
import {readPort} from './paper-export-intent-evidence.mjs';

export function readPartialOffice({from, output, pins}) {
  const root = fs.realpathSync(from), archive = path.join(output, 'original-archive');
  const old = JSON.parse(fs.readFileSync(path.join(root, 'pi-office-six.json')));
  const parent = JSON.parse(fs.readFileSync(path.join(root, 'report.json')));
  assert.equal(parent.success, false); assert.equal(parent.integrityVerified, true);
  assert.equal(old.success, false); assert.match(old.error, /locator\.waitFor: Timeout 30000ms exceeded/);
  assert.equal(old.deliveries.length, 4); assert.equal(old.admissions.length, 5);
  assert.equal(old.active.kind, 'answer_sheet'); assert.equal(old.active.format, 'docx');
  for (const key of ['source', 'build']) assert.equal(parent.pins[key], pins[key]);
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'current-c2-office-fixture.json')));
  for (const key of ['paperId', 'sessionId', 'basketId']) assert.equal(old[key], fixture[key]);
  const read = readPort(fixture.dbPath);
  const abandoned = read('SELECT state,relative_path,result_path FROM xiaozhi_pi_office_drafts WHERE id=? AND conversation_id=?', [old.active.draftId, fixture.sessionId]);
  assert.equal(abandoned.length, 1); assert.equal(abandoned[0].state, 'interrupted');
  assert.equal(abandoned[0].result_path, null);
  const prefix = old.active.path.slice(0, -'-answer_sheet.docx'.length);
  assert.match(prefix, /^B-[a-f0-9]{8}$/);
  assert(!fs.existsSync(path.join(root, 'workspace', old.active.path)));
  for (const [i, file] of old.deliveries.entries()) {
    const spec = SIX_EXPORTS[i];
    assert.equal(file.kind, spec.kind); assert.equal(file.format, spec.format);
    assert.equal(file.approval.via, 'original-ui-click');
    assert.equal(old.admissions[i].runId, file.runId); assert.equal(old.admissions[i].enterPresses, 1);
    for (const shot of [file.approval.pendingScreenshot, file.savedScreenshot]) {
      const actual = fs.realpathSync(shot); assert(actual.startsWith(root + path.sep));
      assert.equal(sha256(fs.readFileSync(actual)), sha256(fs.readFileSync(path.join(archive, path.relative(root, actual)))));
    }
  }
  // Production code, generation build and original UI evidence retain their
  // identity. QA loader/navigation repair is recorded separately, not attributed
  // retroactively to the old generation or its failed full report.
  for (const file of [...old.sourceHashes.filter(f => /[\\/]src[\\/]/.test(f.path)), ...old.buildHashes])
    assert.equal(sha256(fs.readFileSync(file.path)), file.sha256);
  const facts = readSavedExportFacts({dbPath: fixture.dbPath, sessionId: fixture.sessionId,
    workspace: path.join(root, 'workspace'), paper: fixture.paper, files: old.deliveries, evidenceProtocol: 'c2-v7'});
  assert.equal(facts.length, 4);
  const archivedReport = path.join(archive, 'pi-office-six.json');
  assert.equal(sha256(fs.readFileSync(archivedReport)), sha256(fs.readFileSync(path.join(root, 'pi-office-six.json'))));
  return {root, archive, fixture, prefix, deliveries: old.deliveries, admissions: old.admissions.slice(0, 4),
    abandonedAdmission: old.admissions[4], abandonedDraftId: old.active.draftId,
    originalReportSha256: sha256(fs.readFileSync(archivedReport)),
    archiveSha256: fingerprint(archive).sha256, facts};
}

export async function showExactOfficeOwner(page, sessionId, observations) {
  const state = await page.evaluate(() => ({view: document.querySelector('[data-edu-ui]')?.getAttribute('data-view'),
    owner: document.querySelector('.office-composer-container')?.getAttribute('data-session-id')}));
  if (state.view === 'ai' && state.owner === sessionId) return;
  observations.push({...state, action: 'original-session-navigation'});
  const target = page.locator(`[data-testid="workbench-session-${sessionId}"]:visible`);
  assert.equal(await target.count(), 1, 'Exact visible original session, no first()/forced navigation');
  await target.click();
  await page.locator(`.office-composer-container[data-session-id="${sessionId}"]:visible`).waitFor();
}
