import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-knowledge-graph-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-knowledge-graph-'));
const sourceRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-knowledge-source-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-knowledge-graph-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { writeFileSync } from 'node:fs';
          import { join } from 'node:path';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

          export async function runAiKnowledgeGraphSmoke(dataRoot, sourceRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const directPath = join(sourceRoot, 'grade8-math-linear-function.md');
              const privatePath = join(sourceRoot, 'private-student-note.md');
              writeFileSync(directPath, [
                '# 八年级数学 一次函数讲义',
                '',
                '学科：数学',
                '年级：八年级',
                '知识点：一次函数',
                '题型：解答题',
                '难度：中等',
                '',
                '当一次函数 y=kx+b 中 k>0 时，图像随 x 增大而上升；k<0 时，图像随 x 增大而下降。',
                '训练时重点观察学生是否能把斜率符号和图像走向对应起来。',
              ].join('\\n'), 'utf8');
              writeFileSync(privatePath, [
                '# 学生个案私密备注',
                '',
                '小A 手机号 13812345678，邮箱 private@example.com。',
                '知识点：一次函数',
                '这段用于验证含个人信息 chunk 不能把正文预览送入模型。',
              ].join('\\n'), 'utf8');

              const imported = await store.importKnowledgeResources([directPath, privatePath]);
              assert.equal(imported.status, 'succeeded');
              assert.ok(imported.resources.every((resource) => resource.parseStatus === 'ready'), 'text resources should become ready after chunk and graph extraction');

              const overview = await store.getKnowledgeOverview();
              assert.ok(overview.counts.resources >= 2, 'overview should count imported resources');
              assert.ok(overview.counts.chunks >= 2, 'chunks should be created');
              assert.ok(overview.counts.nodes >= 4, 'resource/chunk/knowledge-point nodes should be created');
              assert.ok(overview.counts.edges >= 3, 'graph edges should be created');

              const directChunk = overview.chunks.find((chunk) => chunk.knowledgePoint === '一次函数' && !chunk.containsPersonalData);
              assert.ok(directChunk, 'direct knowledge chunk should infer knowledgePoint');
              assert.equal(directChunk.subject, '数学');
              assert.equal(directChunk.grade, '八年级');
              assert.equal(directChunk.questionType, '解答题');
              assert.equal(directChunk.evidenceStrength, 'direct');
              assert.ok(directChunk.qualityScore >= 78, 'direct chunk should have high quality score');

              const privateChunk = overview.chunks.find((chunk) => chunk.containsPersonalData);
              assert.ok(privateChunk, 'private chunk should be marked as personal data');
              assert.equal(privateChunk.evidenceStrength, 'background');

              const searchMatches = await store.searchKnowledge('一次函数 斜率', 5);
              assert.ok(searchMatches.some((chunk) => chunk.id === directChunk.id), 'multi-token search should match direct chunk');

              const router = routeAiPrompt('查一下知识库里一次函数和斜率的资料', { hasStudent: false });
              assert.equal(router.route, 'knowledge_retrieval');
              const state = createAiToolExecutionState(router);
              const searchTool = await executeAiToolCall({
                store,
                prompt: '查一下知识库里一次函数和斜率的资料',
                router,
                state,
                call: { name: 'search_teacher_knowledge', arguments: { query: '一次函数 斜率', limit: 5 } },
              });
              assert.equal(searchTool.toolRun.status, 'used');
              assert.equal(searchTool.modelResult.ok, true);
              assert.ok(searchTool.modelResult.directEvidence >= 1, 'tool result should report direct evidence count');

              const privacyTool = await executeAiToolCall({
                store,
                prompt: '查一下知识库里手机号相关资料',
                router,
                state,
                call: { name: 'search_teacher_knowledge', arguments: { query: '手机号', limit: 5 } },
              });
              const privateSnippet = privacyTool.modelResult.snippets.find((chunk) => chunk.containsPersonalData);
              assert.ok(privateSnippet, 'privacy query should find personal-data chunk metadata');
              assert.equal(privateSnippet.contentPreview, '[含个人信息，正文预览已隐藏]');

              const graphTool = await executeAiToolCall({
                store,
                prompt: '查一下知识图谱里一次函数相关节点',
                router,
                state,
                call: { name: 'query_knowledge_graph', arguments: { limit: 12 } },
              });
              assert.equal(graphTool.toolRun.status, 'used');
              assert.equal(graphTool.modelResult.graphEvidenceBoundary, 'graph_nodes_are_background_not_direct_text_evidence');
              assert.ok(graphTool.modelResult.edges.some((edge) => edge.evidenceKind === 'direct_quote'), 'graph edges should carry evidence kind');

              return {
                ok: true,
                importStatus: imported.status,
                resourceStatuses: imported.resources.map((resource) => resource.parseStatus),
                counts: overview.counts,
                directChunk: {
                  subject: directChunk.subject,
                  grade: directChunk.grade,
                  knowledgePoint: directChunk.knowledgePoint,
                  questionType: directChunk.questionType,
                  evidenceStrength: directChunk.evidenceStrength,
                  qualityScore: directChunk.qualityScore,
                },
                personalDataHidden: privateSnippet.contentPreview,
                graphBoundary: graphTool.modelResult.graphEvidenceBoundary,
              };
            } finally {
              await store.close();
            }
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

    const { runAiKnowledgeGraphSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiKnowledgeGraphSmoke(dataRoot, sourceRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(sourceRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
