import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-research-visualization-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-research-visualization-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';
      import { buildMermaidVisualization } from './src/main/ai-harness/visualization';

      export async function runSmoke(dataRoot) {
        const sourcePath = join(dataRoot, 'assessment.md');
        writeFileSync(sourcePath, '# Formative assessment\\n\\nUse retrieval practice and feedback to support learning.');
        const store = new OmniEduStore(dataRoot); await store.init(); await store.importKnowledgeResources([sourcePath]);
        const researchPrompt = 'deep research assistant: build a literature review outline about formative assessment';
        const researchRouter = routeAiPrompt(researchPrompt, { hasStudent: false });
        assert.equal(researchRouter.route, 'knowledge_retrieval'); assert.equal(researchRouter.subIntent, 'research_workspace'); assert.equal(researchRouter.needsStudent, false);
        assert.ok(researchRouter.allowedTools.includes('generate_research_outline')); assert.ok(researchRouter.allowedTools.includes('search_teacher_knowledge')); assert.equal(researchRouter.allowedTools.includes('get_student_profile'), false);
        const researchState = createAiToolExecutionState(researchRouter);
        const research = await executeAiToolCall({ store, prompt: researchPrompt, router: researchRouter, state: researchState, call: { name: 'generate_research_outline', arguments: { query: 'formative assessment', limit: 6 } } });
        assert.equal(research.toolRun.status, 'used'); assert.equal(research.modelResult.analysis.schemaVersion, 'omni.research.outline.v1'); assert.equal(research.modelResult.analysis.writesFile, false); assert.equal(research.modelResult.analysis.requiresTeacherReview, true); assert.ok(research.modelResult.analysis.sourceRefs.length >= 1); assert.ok(research.modelResult.analysis.unknowns.length >= 1); assert.ok(JSON.stringify(research.modelResult).length <= 4_500);
        const visualizationPrompt = 'visualize the knowledge graph as a mermaid concept map';
        const visualizationRouter = routeAiPrompt(visualizationPrompt, { hasStudent: true });
        assert.equal(visualizationRouter.route, 'lesson_design'); assert.equal(visualizationRouter.subIntent, 'visualization'); assert.equal(visualizationRouter.needsStudent, false); assert.ok(visualizationRouter.allowedTools.includes('render_learning_mermaid')); assert.equal(visualizationRouter.allowedTools.includes('get_student_profile'), false);
        const visualizationState = createAiToolExecutionState(visualizationRouter);
        const empty = await executeAiToolCall({ store, prompt: visualizationPrompt, router: visualizationRouter, state: visualizationState, call: { name: 'render_learning_mermaid', arguments: { title: '<script>bad</script>' } } });
        assert.equal(empty.toolRun.status, 'used'); assert.equal(empty.modelResult.analysis.safe, true); assert.equal(empty.modelResult.analysis.writesFile, false); assert.equal(/<script|https?:\\/\\/|javascript:/i.test(empty.modelResult.analysis.mermaid), false);
        const graph = buildMermaidVisualization('x<script>http://evil</script>', [
          { id: 'a', nodeType: 'concept', name: 'Safe [node]', summary: '', sourceKind: 'local', sourceId: 'r1', confidence: 1, evidenceStrength: 'direct', createdAt: '', updatedAt: '' },
          { id: 'b', nodeType: 'concept', name: 'Next', summary: '', sourceKind: 'local', sourceId: 'r1', confidence: 1, evidenceStrength: 'direct', createdAt: '', updatedAt: '' },
        ], [{ id: 'e', sourceNodeId: 'a', targetNodeId: 'b', relationType: 'prerequisite; javascript:alert(1)', evidenceSourceId: 'r1', evidenceText: '', confidence: 1, evidenceStrength: 'direct', evidenceKind: 'metadata', createdAt: '', updatedAt: '' }], 12);
        assert.equal(graph.safe, true); assert.equal(graph.writesFile, false); assert.equal(graph.requiresTeacherReview, true); assert.equal(graph.nodeCount, 2); assert.equal(/<script|https?:\\/\\/|javascript:|[{};]/i.test(graph.mermaid), false); assert.ok(graph.mermaid.length <= 4_000);
        await store.close(); return { ok: true, cases: 18, research: true, visualization: true, noStudentContext: true, noWrite: true, bounded: true, injectionSafe: true, failClosed: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
