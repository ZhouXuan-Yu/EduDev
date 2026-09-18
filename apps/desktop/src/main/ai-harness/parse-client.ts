import { NdjsonWorkerClient } from './ndjson-worker';

export type ParseEngineInfo = {
  name: string;
  available: boolean;
  version: string;
};

export type ParsePage = {
  page: number;
  text: string;
};

export type ParseDocumentResult =
  | {
      ok: true;
      engine: string;
      engineVersion: string;
      text: string;
      pages: ParsePage[];
      truncated: boolean;
      title: string;
      textLayer: 'full' | 'scan' | 'partial_scan';
      ocrPages: number[];
      ocrEngine: string;
      ocrUnavailable: string;
      ocrPageLimitReached: boolean;
    }
  | { ok: false; code: string; message: string };

export class ParseWorkerClient {
  private readonly worker: NdjsonWorkerClient;

  constructor(repoRoot: string) {
    this.worker = new NdjsonWorkerClient({
      repoRoot,
      moduleName: 'omni_edu_parse',
      label: '文档解析 worker',
      timeoutMs: 600_000,
      maxFrameBytes: 8_000_000,
      pythonModules: ['pypdf', 'docx', 'pptx'],
      pythonOptionalModules: ['rapidocr', 'fitz'],
    });
  }

  async engines(): Promise<ParseEngineInfo[]> {
    const response = await this.worker.request({ schemaVersion: 'xiazhi.parse.request.v1', type: 'engines' });
    const raw = Array.isArray(response.engines) ? response.engines : [];
    return raw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry) => ({
        name: String(entry.name ?? ''),
        available: entry.available === true,
        version: String(entry.version ?? ''),
      }));
  }

  async parse(filePath: string, extension: string): Promise<ParseDocumentResult> {
    const response = await this.worker.request({
      schemaVersion: 'xiazhi.parse.request.v1',
      type: 'parse',
      filePath,
      extension,
    });
    if (response.ok !== true) {
      return { ok: false, code: String(response.code ?? 'ENGINE_FAILED'), message: String(response.message ?? '解析失败') };
    }
    const rawPages = Array.isArray(response.pages) ? response.pages : [];
    const pages: ParsePage[] = [];
    for (const raw of rawPages) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Record<string, unknown>;
      pages.push({ page: Number(entry.page ?? pages.length + 1), text: String(entry.text ?? '') });
    }
    return {
      ok: true,
      engine: String(response.engine ?? 'unknown'),
      engineVersion: String(response.engineVersion ?? ''),
      text: String(response.text ?? ''),
      pages,
      truncated: response.truncated === true,
      title: String(response.title ?? ''),
      textLayer: response.textLayer === 'scan' || response.textLayer === 'partial_scan' ? response.textLayer : 'full',
      ocrPages: Array.isArray(response.ocrPages) ? response.ocrPages.map((page) => Number(page)).filter((page) => Number.isInteger(page) && page > 0) : [],
      ocrEngine: String(response.ocrEngine ?? ''),
      ocrUnavailable: String(response.ocrUnavailable ?? ''),
      ocrPageLimitReached: response.ocrPageLimitReached === true,
    };
  }

  async stop() {
    await this.worker.stop();
  }
}
