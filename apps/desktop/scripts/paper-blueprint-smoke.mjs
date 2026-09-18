import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-paper-blueprint-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-paper-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'paper-blueprint-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { existsSync, readFileSync } from 'node:fs';
          import { OmniEduStore } from './src/main/db';

          export async function runPaperBlueprintSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const student = (await store.listStudents(''))[0];
            assert.ok(student, 'seed should provide a student');

            // 0. 准备题库：2 道选择题（易/中）+ 2 道解答题（中/难），覆盖两个知识点。
            const choiceEasy = await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '一次函数', questionType: '选择题', difficulty: 'easy', stem: '一次函数 y = 2x + 1 的斜率是？', answer: '2。', analysis: 'k 即斜率。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['斜率'] });
            const choiceMedium = await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '一次函数', questionType: '选择题', difficulty: 'medium', stem: '一次函数图像经过原点的条件是？', answer: 'b = 0。', analysis: '截距为零。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['图像'] });
            const choiceExtra = await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '方程', questionType: '选择题', difficulty: 'medium', stem: '方程 2x = 6 的解是？', answer: 'x = 3。', analysis: '两边同除 2。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['方程'] });
            const solveMedium = await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '一次函数', questionType: '解答题', difficulty: 'medium', stem: '求一次函数 y = 3x - 2 与 y 轴的交点。', answer: '(0, -2)。', analysis: '令 x = 0。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['交点'] });
            const solveHard = await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '一次函数', questionType: '解答题', difficulty: 'hard', stem: '已知一次函数过 (1,3) 与 (3,7)，求解析式。', answer: 'y = 2x + 1。', analysis: '待定系数法。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['解析式'] });

            // 1. 蓝图创建：总分 = 题量 × 每题分值。
            const blueprint = await store.createPaperBlueprint({
              title: '八年级一次函数单元卷',
              subject: '数学',
              grade: '八年级',
              textbookVersion: '人教版',
              scope: '一次函数',
              knowledgePoints: ['一次函数'],
              typeSpecs: [
                { questionType: '选择题', count: 2, pointsPerQuestion: 3 },
                { questionType: '解答题', count: 2, pointsPerQuestion: 5 },
              ],
              difficultyMix: { easy: 50, medium: 50, hard: 0 },
              durationMinutes: 45,
              sourcePreference: 'local_bank',
            });
            assert.equal(blueprint.totalPoints, 16, 'blueprint total must be count × points');
            assert.equal(blueprint.version, 1, 'fresh blueprint must start at version 1');
            assert.equal(blueprint.status, 'active', 'fresh blueprint must be active');

            // 2. 按蓝图召回组卷：题目快照、来源、分值、顺序。
            const paper = await store.createPaperFromBlueprint({ blueprintId: blueprint.id, studentId: student.id });
            assert.equal(paper.items.length, 4, 'paper must recall every configured slot');
            assert.equal(paper.totalPoints, 16, 'paper total must come from blueprint points');
            assert.equal(paper.items[0].orderIndex, 0, 'items must be ordered from zero');
            assert.equal(paper.items[3].orderIndex, 3, 'items must keep a continuous order');
            assert.ok(paper.items.slice(0, 2).every((item) => item.questionType === '选择题' && item.points === 3), 'choice items must keep type and points');
            assert.ok(paper.items.slice(2).every((item) => item.questionType === '解答题' && item.points === 5), 'solve items must keep type and points');
            assert.ok(paper.items.every((item) => item.sourceKind === 'local_bank'), 'source preference must filter to local bank');
            assert.ok(paper.items.every((item) => item.stem && item.answer), 'recalled items must carry stem and answer snapshots');
            const uniqueQuestionIds = new Set(paper.items.map((item) => item.questionId));
            assert.equal(uniqueQuestionIds.size, 4, 'recall must not repeat a question');

            // 3. 完整卷校验：无 error，且知识点覆盖。
            const valid = await store.validatePaper(paper.id);
            assert.equal(valid.ok, true, 'complete paper must validate');
            assert.equal(valid.issues.filter((issue) => issue.level === 'error').length, 0, 'complete paper must have no errors');
            assert.deepEqual(valid.knowledgeCoverage.missing, [], 'knowledge points must be covered');

            // 4. 题目编辑：版本锁 + 教师修改标记。
            const firstItem = paper.items[0];
            const edited = await store.updatePaperItem({ id: firstItem.id, version: firstItem.version, stem: '教师修改后的题干：一次函数 y = 2x + 1 的斜率是多少？', answer: '2（教师确认）。', points: 4 });
            assert.equal(edited.items[0].stem, '教师修改后的题干：一次函数 y = 2x + 1 的斜率是多少？', 'edited stem must persist');
            assert.equal(edited.items[0].points, 4, 'edited points must persist');
            assert.equal(edited.items[0].teacherEdited, true, 'teacher edit must be flagged');
            assert.equal(edited.items[0].version, 2, 'item version must increment');
            assert.equal(edited.totalPoints, 17, 'paper total must follow edited points');
            await assert.rejects(() => store.updatePaperItem({ id: firstItem.id, version: firstItem.version, stem: '过期写入' }), /版本冲突/, 'stale item version must be rejected');

            // 5. 锁定后不能换题；解锁后可换；重复题拒绝。
            const locked = await store.updatePaperItem({ id: firstItem.id, version: edited.items[0].version, locked: true });
            assert.equal(locked.items[0].locked, true, 'lock must persist');
            await assert.rejects(() => store.replacePaperItem(paper.id, firstItem.id, solveHard.id), /已锁定/, 'locked item must refuse replacement');
            const unlocked = await store.updatePaperItem({ id: firstItem.id, version: locked.items[0].version, locked: false });
            const replaced = await store.replacePaperItem(paper.id, firstItem.id, choiceExtra.id);
            const replacedItem = replaced.items.find((item) => item.id === firstItem.id);
            assert.equal(replacedItem.questionId, choiceExtra.id, 'replacement must come from the bank');
            assert.equal(replacedItem.stem, choiceExtra.stem, 'replacement must copy the canonical stem');
            assert.equal(replacedItem.teacherEdited, true, 'replacement counts as a teacher edit');
            const otherQuestionId = replaced.items.find((item) => item.id !== firstItem.id)?.questionId;
            assert.ok(otherQuestionId, 'sanity: paper must contain another question to test duplicates');
            await assert.rejects(() => store.replacePaperItem(paper.id, firstItem.id, String(otherQuestionId)), /已在试卷中/, 'duplicate question must be rejected');

            // 6. 题量不足：蓝图超出题库时校验必须报 type_shortage（error）。
            const shortBlueprint = await store.createPaperBlueprint({
              title: '题量不足样例',
              subject: '数学',
              typeSpecs: [{ questionType: '证明题', count: 3, pointsPerQuestion: 10 }],
              sourcePreference: 'any',
            });
            const shortPaper = await store.createPaperFromBlueprint({ blueprintId: shortBlueprint.id });
            assert.equal(shortPaper.items.length, 0, 'missing question type must recall nothing');
            const shortValidation = await store.validatePaper(shortPaper.id);
            assert.equal(shortValidation.ok, false, 'paper with missing type must fail validation');
            assert.ok(shortValidation.issues.some((issue) => issue.code === 'type_shortage' && issue.level === 'error'), 'shortage must be reported as an error');

            // 7. 归档蓝图不能再组卷。
            const archived = await store.archivePaperBlueprint(shortBlueprint.id, shortBlueprint.version);
            assert.equal(archived.status, 'archived', 'archive must persist');
            await assert.rejects(() => store.createPaperFromBlueprint({ blueprintId: shortBlueprint.id }), /已归档/, 'archived blueprint must refuse assembly');

            // 8. 非法输入。
            await assert.rejects(() => store.createPaperBlueprint({ title: '空题型蓝图', typeSpecs: [] }), /至少需要一个题型/, 'empty type specs must be rejected');
            await assert.rejects(() => store.createPaperBlueprint({ title: '  ', typeSpecs: [{ questionType: '选择题', count: 1, pointsPerQuestion: 1 }] }), /标题不能为空/, 'blank title must be rejected');
            await assert.rejects(() => store.createPaperFromBlueprint({ blueprintId: blueprint.id, studentId: 'missing_student' }), /学生不存在/, 'unknown student must be rejected');
            await assert.rejects(() => store.updatePaperBlueprint(blueprint.id, 99, { title: '冲突', typeSpecs: [{ questionType: '选择题', count: 1, pointsPerQuestion: 1 }] }), /版本冲突/, 'stale blueprint version must be rejected');

            // 9. 导出三件套：真实文件 + hash + 内容边界（答题纸不含答案）。
            const exported = await store.exportPaper(paper.id);
            for (const [key, artifact] of Object.entries(exported)) {
              assert.equal(artifact.status, 'exported', key + ' must be exported');
              assert.ok(artifact.filePath && existsSync(artifact.filePath), key + ' must write a real file');
              assert.match(artifact.contentHash, /^[a-f0-9]{64}$/, key + ' must persist a SHA-256');
            }
            const paperBody = readFileSync(dataRootPlaceholder(exported.paper.filePath), 'utf8');
            const sheetBody = readFileSync(dataRootPlaceholder(exported.answerSheet.filePath), 'utf8');
            const analysisBody = readFileSync(dataRootPlaceholder(exported.analysis.filePath), 'utf8');
            assert.ok(paperBody.includes('选择题'), 'paper body must render section by question type');
            assert.ok(paperBody.includes('教师修改后的题干') || paperBody.includes('方程 2x = 6'), 'paper body must contain the current item stems');
            assert.ok(!paperBody.includes('教师确认'), 'paper body must not leak answers');
            assert.ok(sheetBody.includes('答题纸') && sheetBody.includes('作答'), 'answer sheet must render answer blanks');
            assert.ok(!sheetBody.includes('2（教师确认）') && !sheetBody.includes('x = 3'), 'answer sheet must not contain answers');
            assert.ok(analysisBody.includes('参考答案与解析'), 'analysis must render its title');
            assert.ok(analysisBody.includes('x = 3') || analysisBody.includes('2（教师确认）'), 'analysis must contain answers');
            assert.ok(analysisBody.includes('来源：'), 'analysis must annotate item provenance');
            const artifactRows = await store.listDocumentArtifacts();
            assert.ok(artifactRows.filter((row) => row.id.startsWith(paper.id)).length === 3, 'three artifacts must be readable from SQLite');

            // 10. 重启后试卷与题目版本仍可回读。
            await store.close();
            await store.init();
            const reloaded = await store.getPaper(paper.id);
            assert.equal(reloaded?.items.length, 4, 'paper items must persist after restart');
            assert.equal(reloaded?.totalPoints, 17, 'edited points must persist after restart');
            const reloadedItem = reloaded.items.find((item) => item.id === firstItem.id);
            assert.equal(reloadedItem.questionId, choiceExtra.id, 'replacement must persist after restart');
            assert.equal(reloadedItem.teacherEdited, true, 'teacher edit flag must persist after restart');
            const blueprints = await store.listPaperBlueprints();
            assert.ok(blueprints.some((item) => item.id === blueprint.id), 'blueprint must persist after restart');
            assert.ok(!blueprints.some((item) => item.id === shortBlueprint.id), 'archived blueprint must stay out of the active list');

            // 11. 拖拽排序：事务化重排 + 集合校验。
            const beforeReorder = await store.getPaper(paper.id);
            const idsInOrder = beforeReorder.items.map((item) => item.id);
            const reversed = [...idsInOrder].reverse();
            const reordered = await store.reorderPaperItems({ paperId: paper.id, orderedItemIds: reversed });
            assert.deepEqual(reordered.items.map((item) => item.id), reversed, 'reorder must persist the requested order');
            assert.deepEqual(reordered.items.map((item) => item.orderIndex), [0, 1, 2, 3], 'reorder must rewrite a continuous order index');
            await assert.rejects(() => store.reorderPaperItems({ paperId: paper.id, orderedItemIds: idsInOrder.slice(0, 2) }), /数量不一致/, 'partial order lists must be rejected');
            await assert.rejects(() => store.reorderPaperItems({ paperId: paper.id, orderedItemIds: [idsInOrder[0], idsInOrder[0], idsInOrder[1], idsInOrder[2]] }), /重复/, 'duplicate ids must be rejected');
            await assert.rejects(() => store.reorderPaperItems({ paperId: paper.id, orderedItemIds: [...idsInOrder.slice(0, 3), 'paper_item_missing'] }), /不一致/, 'unknown ids must be rejected');

            // 12. 版本历史：导出自动存档、重复内容不重复存档、查看与恢复。
            const versionsAfterExport = await store.listPaperVersions(paper.id);
            assert.ok(versionsAfterExport.length >= 1, 'export must archive a paper version');
            assert.ok(versionsAfterExport.some((version) => version.note.includes('导出')), 'export archive must record its reason');
            const currentArchive = await store.archivePaperVersion(paper.id, '教师手动保存');
            const duplicateArchive = await store.archivePaperVersion(paper.id, '重复内容不应新增版本');
            assert.equal(duplicateArchive.versionNo, currentArchive.versionNo, 'identical content must not create another version');
            const firstItemAfterReorder = reordered.items[0];
            const changed = await store.updatePaperItem({ id: firstItemAfterReorder.id, version: firstItemAfterReorder.version, stem: '版本历史测试：教师再次修改题干。' });
            const savedVersion = await store.archivePaperVersion(paper.id, '教师修改后保存');
            assert.equal(savedVersion.versionNo, currentArchive.versionNo + 1, 'a changed paper must archive the next version number');
            const versionDetail = await store.getPaperVersion(savedVersion.id);
            assert.ok(versionDetail && versionDetail.items.length === 4, 'version detail must snapshot every item');
            assert.equal(versionDetail.items[0].stem, '版本历史测试：教师再次修改题干。', 'version detail must capture the edited stem');
            assert.equal(versionDetail.items[0].paperId, paper.id, 'snapshot items must keep their paper id');
            const olderVersion = versionsAfterExport.find((version) => version.note.includes('导出'));
            const archivedDetail = await store.getPaperVersion(olderVersion.id);
            const restoredPaper = await store.restorePaperVersion(paper.id, olderVersion.id);
            assert.deepEqual(
              restoredPaper.items.map((item) => item.stem),
              archivedDetail.items.map((item) => item.stem),
              'restore must reproduce the archived order and stems',
            );
            assert.ok(!restoredPaper.items.some((item) => item.stem === '版本历史测试：教师再次修改题干。'), 'restoring an older version must roll the edited stem back');
            assert.equal(restoredPaper.items.length, 4, 'restore must keep every item');
            const versionsAfterRestore = await store.listPaperVersions(paper.id);
            assert.ok(versionsAfterRestore.length >= savedVersion.versionNo, 'restoring must not drop the archived pre-restore version');
            const preservedDetail = await store.getPaperVersion(versionsAfterRestore.find((version) => version.versionNo === savedVersion.versionNo).id);
            assert.ok(preservedDetail.items.some((item) => item.stem === '版本历史测试：教师再次修改题干。'), 'the pre-restore edit must stay recoverable in its archived version');

            await store.close();
            return {
              ok: true,
              items: paper.items.length,
              totalPoints: paper.totalPoints,
              editedTotalPoints: reloaded.totalPoints,
              exportedArtifacts: 3,
              validationOk: valid.ok,
              shortageDetected: true,
              reorderedIds: reversed.length,
              versionCount: versionsAfterRestore.length,
              restoreRolledBack: true,
            };
          }

          function dataRootPlaceholder(filePath) {
            return filePath;
          }
        `,
        resolveDir: appRoot,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      external: ['sqlite3'],
      logLevel: 'silent',
    });

    const { runPaperBlueprintSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runPaperBlueprintSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await cleanupWithRetry(bundleRoot);
    await cleanupWithRetry(dataRoot);
  }
}

async function cleanupWithRetry(target) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) {
        console.error(`cleanup warning (${target}): ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
