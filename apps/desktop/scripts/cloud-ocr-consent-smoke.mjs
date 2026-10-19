import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-cloud-ocr-consent-'));

let assertCount = 0;
for (const key of ['match', 'doesNotMatch', 'equal', 'notEqual', 'ok', 'deepEqual', 'rejects', 'strictEqual']) {
  if (typeof assert[key] !== 'function') continue;
  const original = assert[key].bind(assert);
  assert[key] = (...args) => {
    assertCount += 1;
    return original(...args);
  };
}

const providerModel = 'deepseek-v4-flash';
const imagePath = 'C:/managed/students/student_smoke/secret-original.png';
const cases = [];

function analysisBase() {
  return {
    id: 'analysis_smoke',
    studentId: 'student_smoke',
    recordId: 'record_smoke',
    attachmentId: 'attachment_smoke',
    localPath: imagePath,
    ocrStatus: 'needs_ocr',
    extractedText: '',
    ocrConfidence: 0,
    sanitizedText: '',
    redactions: [],
    teacherCorrectedText: '',
    errorMessage: '',
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  };
}

function makeHarness(overrides = {}) {
  const calls = { provider: 0, apply: 0, markFailed: 0, localRunner: 0 };
  const applied = [];
  const base = {
    getAnalysis: async (id) => (id === 'analysis_smoke' ? analysisBase() : null),
    isManagedLocalPath: async (path) => path.startsWith('C:/managed/'),
    getFileInfo: async () => ({ exists: true, size: 2048 }),
    getApiSettings: async () => ({ apiKey: 'sk-test-smoke', model: providerModel }),
    analyzeImage: async () => {
      calls.provider += 1;
      return { ok: true, text: '一次函数 y=2x+1', model: providerModel };
    },
    applyResult: async (id, result) => {
      calls.apply += 1;
      applied.push({ id, result });
      return {
        ...analysisBase(),
        ocrStatus: 'ocr_done',
        extractedText: result.text,
        ocrConfidence: result.confidence,
        updatedAt: '2026-10-19T00:00:00.000Z',
      };
    },
    now: () => new Date('2026-10-19T00:00:00.000Z'),
    createRequestId: () => 'req_cloud_ocr_smoke',
  };
  return { calls, applied, deps: { ...base, ...overrides } };
}

function record(name, calls, extra = {}) {
  cases.push({
    name,
    providerCalls: calls.provider,
    applyCalls: calls.apply,
    markFailedCalls: calls.markFailed,
    ...extra,
  });
}

async function run() {
  try {
    const outfile = join(bundleRoot, 'cloud-ocr-consent-smoke.mjs');
    await build({
      stdin: {
        contents: `
          export { runCloudOcr, runLocalOcr } from './src/main/mistake-ocr';
          export { normalizeMistakeImageAnalysis } from './src/shared/mistake-ocr';
        `,
        resolveDir: appRoot,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'silent',
    });
    const { runCloudOcr, runLocalOcr, normalizeMistakeImageAnalysis } = await import(pathToFileURL(outfile).href);

    {
      const harness = makeHarness();
      const outcome = await runCloudOcr(undefined, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'invalid_input');
      assert.equal(harness.calls.provider, 0);
      assert.equal(harness.calls.apply, 0);
      record('missing-input', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness();
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke' }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'consent_required');
      assert.match(outcome.message, /会上传原图到云端/);
      assert.equal(harness.calls.provider, 0);
      assert.equal(harness.calls.apply, 0);
      record('missing-consent-flag', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness();
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: false }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'consent_required');
      assert.equal(harness.calls.provider, 0);
      assert.equal(harness.calls.apply, 0);
      record('rejected-consent', harness.calls, { code: outcome.code });
    }

    {
      // 取消对话框等价于不发起调用：这里以未确认输入验证零调用语义。
      const harness = makeHarness();
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: false }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'consent_required');
      assert.equal(harness.calls.provider, 0);
      assert.equal(harness.calls.apply, 0);
      record('cancel-dialog-zero-calls', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness();
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: true }, harness.deps);
      assert.equal(outcome.ok, true);
      assert.equal(harness.calls.provider, 1);
      assert.equal(harness.calls.apply, 1);
      assert.equal(harness.calls.markFailed, 0);
      assert.equal(harness.applied[0].result.confidence, -1);
      assert.equal(harness.applied[0].result.lowConfidenceCount, 0);
      assert.equal(outcome.result.analysis.ocrConfidence, null);
      assert.equal(outcome.result.analysis.requiresReview, true);
      assert.equal(outcome.result.analysis.ocrSource, 'cloud');
      assert.deepEqual(outcome.result.audit, {
        provider: 'deepseek',
        model: providerModel,
        requestId: 'req_cloud_ocr_smoke',
        confirmedAt: '2026-10-19T00:00:00.000Z',
        imageBytes: 2048,
      });
      const serializedAudit = JSON.stringify(outcome.result.audit);
      assert.equal(serializedAudit.includes(imagePath), false);
      assert.equal(serializedAudit.includes('secret-original'), false);
      assert.equal(serializedAudit.includes('C:/managed'), false);
      assert.equal(serializedAudit.toLowerCase().includes('base64'), false);
      record('confirmed-upload', harness.calls, { code: 'ok' });
    }

    {
      const harness = makeHarness({
        analyzeImage: async () => {
          harness.calls.provider += 1;
          return { ok: false, message: 'HTTP 401 unauthorized' };
        },
      });
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: true }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'provider_failed');
      assert.match(outcome.message, /HTTP 401 unauthorized/);
      assert.equal(harness.calls.provider, 1);
      assert.equal(harness.calls.apply, 0);
      assert.equal(harness.calls.markFailed, 0);
      record('provider-failure-no-write', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness({
        analyzeImage: async () => {
          harness.calls.provider += 1;
          return { ok: true, text: '   ', model: providerModel };
        },
      });
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: true }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'provider_failed');
      assert.match(outcome.message, /空内容/);
      assert.equal(harness.calls.apply, 0);
      record('provider-empty-text-no-write', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness({ getApiSettings: async () => ({ apiKey: '   ', model: providerModel }) });
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: true }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'missing_api_key');
      assert.equal(harness.calls.provider, 0);
      assert.equal(harness.calls.apply, 0);
      record('missing-api-key', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness({
        getAnalysis: async () => ({ ...analysisBase(), localPath: 'C:/Users/Public/unmanaged-original.png' }),
      });
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: true }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'unsafe_path');
      assert.equal(harness.calls.provider, 0);
      assert.equal(harness.calls.apply, 0);
      record('unmanaged-path', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness({ getFileInfo: async () => ({ exists: false, size: 0 }) });
      const outcome = await runCloudOcr({ analysisId: 'analysis_smoke', confirmedUploadOriginal: true }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'unsafe_path');
      assert.equal(harness.calls.provider, 0);
      record('missing-file', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness();
      const outcome = await runCloudOcr({ analysisId: 'analysis_missing', confirmedUploadOriginal: true }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'not_found');
      assert.equal(harness.calls.provider, 0);
      record('missing-analysis', harness.calls, { code: outcome.code });
    }

    {
      const harness = makeHarness();
      const outcome = await runCloudOcr({
        analysisId: 'analysis_smoke',
        confirmedUploadOriginal: true,
        teacherNote: 'x'.repeat(501),
      }, harness.deps);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.code, 'invalid_input');
      assert.equal(harness.calls.provider, 0);
      record('teacher-note-too-long', harness.calls, { code: outcome.code });
    }

    {
      const calls = { provider: 0, apply: 0, markFailed: 0, localRunner: 0 };
      const localDeps = {
        getAnalysis: async () => analysisBase(),
        isManagedLocalPath: async () => true,
        getFileInfo: async () => ({ exists: true, size: 2048 }),
        runLocalOcr: async () => {
          calls.localRunner += 1;
          return { ok: false, code: 'MODEL_MISSING', message: 'RapidOCR 模型不可用' };
        },
        applyResult: async () => {
          calls.apply += 1;
          return analysisBase();
        },
        markFailed: async (id, message) => {
          calls.markFailed += 1;
          return { ...analysisBase(), ocrStatus: 'failed', errorMessage: message };
        },
        // 故意提供云端 provider；runLocalOcr 不得触碰它（无自动回退）。
        analyzeImage: async () => {
          calls.provider += 1;
          return { ok: true, text: '不应出现', model: providerModel };
        },
      };
      await assert.rejects(() => runLocalOcr('analysis_smoke', localDeps), /RapidOCR 模型不可用/);
      assert.equal(calls.localRunner, 1);
      assert.equal(calls.provider, 0);
      assert.equal(calls.apply, 0);
      assert.equal(calls.markFailed, 1);
      record('local-ocr-failure-no-cloud-fallback', calls, { code: 'local_failed' });
    }

    {
      const calls = { provider: 0, apply: 0, markFailed: 0, localRunner: 0 };
      const localDeps = {
        getAnalysis: async () => analysisBase(),
        isManagedLocalPath: async () => true,
        getFileInfo: async () => ({ exists: true, size: 2048 }),
        runLocalOcr: async () => {
          calls.localRunner += 1;
          return {
            ok: true,
            lines: [{ text: '第一行', confidence: 0.91 }, { text: '第二行', confidence: 0.73 }],
            lowConfidenceCount: 1,
            modelVersion: 'rapidocr-smoke',
          };
        },
        applyResult: async (id, result) => {
          calls.apply += 1;
          return { ...analysisBase(), ocrStatus: 'ocr_done', extractedText: result.text, ocrConfidence: result.confidence };
        },
        markFailed: async () => {
          calls.markFailed += 1;
          return analysisBase();
        },
        analyzeImage: async () => {
          calls.provider += 1;
          return { ok: true, text: '不应出现', model: providerModel };
        },
      };
      const updated = await runLocalOcr('analysis_smoke', localDeps);
      assert.equal(updated.ocrStatus, 'ocr_done');
      assert.equal(calls.apply, 1);
      assert.equal(calls.provider, 0);
      assert.equal(calls.markFailed, 0);
      record('local-ocr-success', calls, { code: 'ok', confidence: updated.ocrConfidence, ocrSource: updated.ocrSource ?? '' });
    }

    {
      const cloudRaw = { ...analysisBase(), ocrConfidence: -1 };
      const normalized = normalizeMistakeImageAnalysis(cloudRaw);
      assert.equal(normalized.ocrConfidence, null);
      assert.equal(normalized.requiresReview, true);
      assert.equal(normalized.ocrSource, 'cloud');

      const local = { ...analysisBase(), ocrConfidence: 0.92 };
      const untouched = normalizeMistakeImageAnalysis(local);
      assert.equal(untouched.ocrConfidence, 0.92);
      assert.equal(untouched.requiresReview, undefined);
      assert.equal(untouched.ocrSource, undefined);

      const zero = normalizeMistakeImageAnalysis({ ...analysisBase(), ocrConfidence: 0 });
      assert.equal(zero.ocrConfidence, 0);
      assert.equal(zero.requiresReview, undefined);
      record('normalize-sentinel', { provider: 0, apply: 0, markFailed: 0, localRunner: 0 }, { code: 'ok' });
    }

    console.log(JSON.stringify({
      suite: 'cloud-ocr-consent',
      passed: assertCount,
      total: assertCount,
      cases,
    }, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
