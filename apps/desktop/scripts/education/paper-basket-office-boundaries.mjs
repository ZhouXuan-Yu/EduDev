import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {basketFixture} from './paper-basket-fixture.mjs';
import {PAPER_BASKET_SCHEMA} from '../../src/shared/paper-basket.ts';
import {compilePaperOffice, assertPaperOffice} from '../../src/main/education/paper-export.ts';
import {createOfficeArtifactState} from '../../src/main/xiaozhi-agent/office-artifact-state.ts';
import {createOfficeArtifactService} from '../../src/main/xiaozhi-agent/office-artifact-service.ts';

/** The actual Office installer delegates its final source lease to the real basket-bound paper repository. */
export async function basketOfficeBoundaries(check, output) {
  const fixture = await basketFixture(path.join(output, 'actual-office'));
  const {db, sid, baskets, papers, question} = fixture;
  const workspace = path.join(fixture.root, 'workspace');
  const dataRoot = path.join(fixture.root, 'data');
  fs.mkdirSync(workspace);
  fs.mkdirSync(dataRoot);
  db.exec(`CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT,message_id TEXT,title TEXT,
    artifact_type TEXT,file_name TEXT,mime_type TEXT,description TEXT,content_md TEXT,file_path TEXT,
    file_size INTEGER,content_hash TEXT,status TEXT,error_message TEXT,created_at TEXT,updated_at TEXT);`);
  const sql = {
    run: async (query, params = []) => db.prepare(query).run(...params),
    all: async (query, params = []) => db.prepare(query).all(...params),
    change: async (query, params = []) => Number(db.prepare(query).run(...params).changes),
  };
  const state = createOfficeArtifactState(sql);
  await state.migrate();
  const schema = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId: sid};
  const blueprint = {title: '真实手选安装合同', subject: '数学', grade: '初二', durationMinutes: 40,
    totalPoints: 10, mode: 'source_only', sections: [{id: 'a', label: '解答', questionType: '解答题', count: 1, points: 10}]};
  const item = question('实际DOCX安装');
  let basket = await baskets.create({...schema, requestId: randomUUID(), blueprint});
  const ref = () => ({...schema, basketId: basket.id});
  const mutation = operation => ({...ref(), expectedRevision: basket.revision, requestId: randomUUID(), operation});
  const candidate = await baskets.candidate({...ref(), questionId: item.id});
  basket = await baskets.mutate(mutation({type: 'add', questionId: item.id, sectionId: 'a', expectedSourceVersion: candidate.contentVersion}));
  let beforeCommit;
  let installs = 0;
  const service = createOfficeArtifactService({
    state, dataRoot, workspace: async () => workspace, isCurrent: () => true,
    validatePaperDraft: async (owner, draft) => {
      const paper = await papers.review(owner, draft.paperSource.paperId);
      assertPaperOffice(paper, draft);
    },
    commitPaperDraft: async (owner, draft, install) => {
      await beforeCommit?.();
      await papers.withConfirmedSource(owner, draft.paperSource.paperId, draft.paperSource.digest, paper => {
        assertPaperOffice(paper, draft);
        installs++;
        install();
      });
    },
  });
  async function approvedDraft(name) {
    const pending = await baskets.createSnapshot({...ref(), expectedRevision: basket.revision, requestId: randomUUID()});
    const paper = await papers.decide({schemaVersion: 'xiaozhi.paper-blueprint.v1', sessionId: sid,
      id: pending.id, revision: 1, action: 'confirm'}, () => true);
    const row = await service.propose(sid, 'controlled-office-run', randomUUID(), {
      path: name, format: 'docx', draft: compilePaperOffice(paper, 'student'), sources: [],
    });
    await service.decide({schemaVersion: 'xiaozhi.office-artifact.v1', sessionId: sid, draftId: row.id,
      revision: row.revision, action: 'approve'});
    return row;
  }
  try {
    let savedFile;
    let savedBytes;
    await check('Actual Office approval generates and installs real basket-bound DOCX with artifact lineage under same-connection source lease', async () => {
      const row = await approvedDraft('手选学生卷.docx');
      const result = await service.apply(sid, row.id);
      assert.equal(result.state, 'saved');
      savedFile = path.join(workspace, '手选学生卷.docx');
      savedBytes = fs.readFileSync(savedFile);
      assert.equal(savedBytes.subarray(0, 2).toString(), 'PK');
      assert.equal(installs, 1);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM document_artifacts').get().n, 1);
      const persisted = await state.get(row.id);
      assert.equal(persisted.draft.paperSource.paperId, (await papers.latest(sid)).id);
    });
    await check('Actual Office install refuses a basket mutation after its last preview check; no second file/fact and old delivered bytes remain intact', async () => {
      const row = await approvedDraft('必须阻断.docx');
      beforeCommit = async () => {
        basket = await baskets.mutate(mutation({type: 'updateBlueprint', blueprint: {...basket.blueprint, title: '安装前已改版'}}));
      };
      await assert.rejects(service.apply(sid, row.id), /conflict/);
      assert.equal(installs, 1);
      assert(!fs.existsSync(path.join(workspace, '必须阻断.docx')));
      assert.equal(db.prepare('SELECT COUNT(*) n FROM document_artifacts').get().n, 1);
      assert(fs.readFileSync(savedFile).equals(savedBytes));
    });
  } finally {
    fixture.close();
  }
}
