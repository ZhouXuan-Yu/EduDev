import { NdjsonWorkerClient } from './ndjson-worker';

export type OcrLine = {
  text: string;
  confidence: number;
  bbox: number[][];
};

export type OcrHealthResult = {
  ok: boolean;
  modelAvailable: boolean;
  modelVersion: string;
  loadError: string;
};

export type OcrImageResult =
  | { ok: true; lines: OcrLine[]; lowConfidenceCount: number; modelVersion: string }
  | { ok: false; code: string; message: string };

export class OcrWorkerClient {
  private readonly worker: NdjsonWorkerClient;

  constructor(repoRoot: string) {
    this.worker = new NdjsonWorkerClient({
      repoRoot,
      moduleName: 'omni_edu_ocr',
      label: 'OCR worker',
      timeoutMs: 120_000,
      pythonModules: ['rapidocr'],
    });
  }

  async health(): Promise<OcrHealthResult> {
    const response = await this.worker.request({ schemaVersion: 'xiazhi.ocr.request.v1', type: 'health' });
    return {
      ok: response.ok === true,
      modelAvailable: response.modelAvailable === true,
      modelVersion: String(response.modelVersion ?? ''),
      loadError: String(response.loadError ?? ''),
    };
  }

  async runOcr(imagePath: string): Promise<OcrImageResult> {
    const response = await this.worker.request({ schemaVersion: 'xiazhi.ocr.request.v1', type: 'ocr', imagePath });
    if (response.ok !== true) {
      return { ok: false, code: String(response.code ?? 'INTERNAL_ERROR'), message: String(response.message ?? 'OCR 失败') };
    }
    const rawLines = Array.isArray(response.lines) ? response.lines : [];
    const lines: OcrLine[] = [];
    for (const raw of rawLines) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Record<string, unknown>;
      const text = String(entry.text ?? '').trim();
      if (!text) continue;
      lines.push({
        text,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : 0,
        bbox: Array.isArray(entry.bbox) ? entry.bbox.map((point) => (Array.isArray(point) ? point.map(Number) : [0, 0])) : [],
      });
    }
    return {
      ok: true,
      lines,
      lowConfidenceCount: typeof response.lowConfidenceCount === 'number' ? response.lowConfidenceCount : 0,
      modelVersion: String(response.modelVersion ?? ''),
    };
  }

  async stop() {
    await this.worker.stop();
  }
}
