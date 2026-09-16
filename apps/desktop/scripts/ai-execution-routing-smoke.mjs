import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const appRoot = new URL('..', import.meta.url).pathname.replace(/^\//, '').replace(/\//g, '/');
const tempRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-routing-'));
const previousMode = process.env.OMNI_EDU_AI_EXECUTION_MODE;
const previousDisabled = process.env.OMNI_EDU_DISABLE_DIRECT_AI;

try {
  delete process.env.OMNI_EDU_AI_EXECUTION_MODE;
  delete process.env.OMNI_EDU_DISABLE_DIRECT_AI;
  const outfile = join(tempRoot, 'router.mjs');
  await build({
    entryPoints: [join(appRoot, 'src/main/ai-harness/router.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });
  const { routeAiPrompt, decideExecutionMode } = await import(pathToFileURL(outfile).href);
  const consoleSource = readFileSync(join(appRoot, 'src/main/index.ts'), 'utf8');
  assert.match(consoleSource, /executionMode: 'direct'/);
  assert.match(consoleSource, /schemaApplicable: false/);
  assert.match(consoleSource, /graderApplicable: false/);
  assert.match(consoleSource, /schemaApplicable: true/);
  assert.match(consoleSource, /graderApplicable: true/);
  const cases = [
    { prompt: '你好', mode: 'direct', context: [], tools: [] },
    { prompt: '谢谢', mode: 'direct', context: [], tools: [] },
    { prompt: '什么是勾股定理？', mode: 'direct', context: [], tools: [] },
    { prompt: '你能做什么？', mode: 'direct', context: [], tools: [] },
    { prompt: '小A最近哪里薄弱？', mode: 'structured', context: ['student_lookup', 'student_profile', 'learning_records', 'attachment_metadata', 'teacher_knowledge'], tools: ['ask_user', 'resolve_student_reference', 'get_student_profile', 'search_learning_records', 'analyze_learning_progress', 'mastery_status', 'get_review_queue', 'mastery_quiz', 'mastery_grade', 'mastery_assess', 'mastery_build', 'list_attachment_metadata', 'search_teacher_knowledge'] },
    { prompt: '结合最近学习记录出三道题', mode: 'structured', context: ['student_lookup', 'student_profile', 'learning_records', 'teacher_knowledge', 'knowledge_graph', 'question_bank'], tools: ['ask_user', 'resolve_student_reference', 'get_student_profile', 'search_learning_records', 'mastery_status', 'get_review_queue', 'mastery_quiz', 'mastery_grade', 'mastery_assess', 'mastery_build', 'search_teacher_knowledge', 'query_knowledge_graph', 'search_similar_questions'] },
    { prompt: '把结果导出Word', mode: 'structured', context: ['student_lookup', 'student_profile', 'learning_records', 'attachment_metadata', 'teacher_knowledge'], tools: ['ask_user', 'resolve_student_reference', 'get_student_profile', 'search_learning_records', 'analyze_learning_progress', 'mastery_status', 'get_review_queue', 'mastery_quiz', 'mastery_grade', 'mastery_assess', 'mastery_build', 'list_attachment_metadata', 'search_teacher_knowledge', 'generate_research_outline'] },
    { prompt: '保存为复盘记录', mode: 'structured', context: ['student_lookup', 'student_profile', 'learning_records', 'attachment_metadata', 'teacher_knowledge'], tools: ['ask_user', 'resolve_student_reference', 'get_student_profile', 'search_learning_records', 'analyze_learning_progress', 'mastery_status', 'get_review_queue', 'mastery_quiz', 'mastery_grade', 'mastery_assess', 'mastery_build', 'list_attachment_metadata', 'search_teacher_knowledge', 'generate_research_outline'] },
    { prompt: '根据这个附件分析', mode: 'structured', context: ['student_lookup', 'student_profile', 'attachment_metadata', 'attached_sources'], tools: ['ask_user', 'resolve_student_reference', 'get_student_profile', 'list_attachment_metadata', 'explore_attached_sources', 'analyze_geometry_figure'] },
  ];
  for (const testCase of cases) {
    const router = routeAiPrompt(testCase.prompt, { hasStudent: false });
    const execution = decideExecutionMode(testCase.prompt, { router });
    assert.equal(execution.mode, testCase.mode, `${testCase.prompt}: execution mode`);
    assert.deepEqual(router.contextPolicy.include, testCase.context, `${testCase.prompt}: context`);
    assert.deepEqual(testCase.mode === 'direct' ? [] : router.allowedTools, testCase.tools, `${testCase.prompt}: tools`);
  }
  const boundaryCases = [
    { prompt: '为什么这个孩子总考不好？', mode: 'structured', route: 'student_diagnosis' },
    { prompt: '为什么他最近学不会？', mode: 'structured', route: 'student_diagnosis' },
    { prompt: '小数是什么？', mode: 'direct', route: 'general_qa' },
    { prompt: '什么是小数', mode: 'direct', route: 'general_qa' },
  ];
  for (const testCase of boundaryCases) {
    const router = routeAiPrompt(testCase.prompt, { hasStudent: false });
    const execution = decideExecutionMode(testCase.prompt, { router });
    assert.equal(router.route, testCase.route, `${testCase.prompt}: boundary route`);
    assert.equal(execution.mode, testCase.mode, `${testCase.prompt}: boundary execution mode`);
  }
  const total = cases.length + boundaryCases.length;
  console.log(JSON.stringify({ suite: 'ai-execution-routing', total, passed: total, failed: 0 }));
} finally {
  if (previousMode === undefined) delete process.env.OMNI_EDU_AI_EXECUTION_MODE;
  else process.env.OMNI_EDU_AI_EXECUTION_MODE = previousMode;
  if (previousDisabled === undefined) delete process.env.OMNI_EDU_DISABLE_DIRECT_AI;
  else process.env.OMNI_EDU_DISABLE_DIRECT_AI = previousDisabled;
  rmSync(tempRoot, { recursive: true, force: true });
}
