import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParseJob, ResourceChunk, TeacherResource } from '../../shared/contracts';

type KnowledgeResourcePanelProps = {
  setStatus: (message: string) => void;
  onOverviewChanged?: () => void;
  /** Bump to force a reload (for example after an import completes elsewhere). */
  refreshToken?: number;
};

const STATUS_LABELS: Record<string, string> = {
  imported: '已导入',
  queued: '排队中',
  parsed: '已解析',
  chunked: '已切片',
  indexed: '已索引',
  graph_extracted: '已抽取关系',
  ready: '可检索',
  needs_parser: '待解析',
  partial: '部分完成',
  failed: '解析失败',
};

export function KnowledgeResourcePanel({ setStatus, onOverviewChanged, refreshToken = 0 }: KnowledgeResourcePanelProps) {
  const [resources, setResources] = useState<TeacherResource[]>([]);
  const [engines, setEngines] = useState<Array<{ name: string; available: boolean; version: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [busyResourceId, setBusyResourceId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<ResourceChunk[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [batchJob, setBatchJob] = useState<ParseJob | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const batchTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const overview = await window.omniEdu?.getKnowledgeOverview();
      setResources(overview?.resources ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取知识库资源失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    window.omniEdu?.listKnowledgeParseEngines()
      .then((result) => setEngines(result ?? []))
      .catch(() => setEngines([]));
  }, [load, refreshToken]);

  async function parseResource(resource: TeacherResource) {
    if (busyResourceId) return;
    setBusyResourceId(resource.id);
    setErrorMessage('');
    try {
      const parsed = await window.omniEdu?.parseKnowledgeResource(resource.id);
      if (parsed) {
        setResources((current) => current.map((item) => (item.id === parsed.id ? parsed : item)));
        setStatus(`已解析「${parsed.title}」：引擎 ${parsed.parseEngine}，生成 ${parsed.chunkCount} 个切片。`);
        onOverviewChanged?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '解析失败。';
      setErrorMessage(message);
      setStatus(message);
      await load();
    } finally {
      setBusyResourceId('');
    }
  }

  const availableEngines = engines.filter((engine) => engine.available);

  const stopBatchPolling = useCallback(() => {
    if (batchTimerRef.current !== null) {
      window.clearInterval(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopBatchPolling, [stopBatchPolling]);

  async function startBatchParse() {
    if (batchBusy) return;
    setBatchBusy(true);
    setErrorMessage('');
    try {
      const job = await window.omniEdu?.createParseJob();
      if (!job) throw new Error('创建批量解析任务没有返回结果。');
      setBatchJob(job);
      const finished = await window.omniEdu?.runParseJob(job.id);
      if (finished) {
        setBatchJob(finished);
        setStatus(finished.status === 'ready'
          ? `批量解析完成：${finished.succeededResources} 个资源就绪。`
          : `批量解析部分完成：${finished.succeededResources} 个成功，${finished.failedResources} 个失败，可重试。`);
      }
      await load();
      onOverviewChanged?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '批量解析失败。');
    } finally {
      setBatchBusy(false);
      stopBatchPolling();
    }
  }

  async function cancelBatchParse() {
    if (!batchJob) return;
    try {
      const updated = await window.omniEdu?.cancelParseJob(batchJob.id);
      if (updated) setBatchJob(updated);
      setStatus('已请求取消批量解析；当前资源处理完成后停止。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '取消批量解析失败。');
    }
  }

  async function retryBatchParse() {
    if (batchBusy || !batchJob) return;
    setBatchBusy(true);
    try {
      const retried = await window.omniEdu?.retryParseJob(batchJob.id);
      if (retried) {
        setBatchJob(retried);
        setStatus(retried.status === 'ready' ? `重试完成：${retried.succeededResources} 个资源就绪。` : `重试结束：${retried.failedResources} 个仍失败。`);
      }
      await load();
      onOverviewChanged?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '重试批量解析失败。');
    } finally {
      setBatchBusy(false);
    }
  }

  async function runSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('请输入检索关键词。');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const hits = await window.omniEdu?.searchTeacherKnowledge(query, 8) ?? [];
      setSearchHits(hits);
      setSearched(true);
      if (!hits.length) setStatus('知识库没有命中；可先解析更多资料或调整关键词。');
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '知识库检索失败。');
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="work-panel knowledge-resource-panel" data-testid="knowledge-resource-panel">
      <div className="panel-heading">
        <div>
          <h3>资料列表与检索</h3>
          <p className="muted">本地解析：PDF/DOCX/PPTX 走本地解析器，解析后自动切片并进入检索与图谱。检索默认关键词命中，向量索引可用时自动补充语义命中。</p>
        </div>
        <button className="icon-button" aria-label="刷新资料列表" onClick={() => void load()} data-testid="knowledge-resource-refresh">刷新</button>
      </div>
      <div className="toolbar-row">
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="检索本地资料（题干、知识点、正文）" data-testid="knowledge-search-input" />
        <button className="primary-action compact-button" onClick={() => void runSearch()} disabled={searching} data-testid="knowledge-search-submit">{searching ? '检索中…' : '检索资料'}</button>
      </div>
      {searchError ? <div className="warning-box" data-testid="knowledge-search-error">{searchError}</div> : null}
      {searched ? (
        <div className="knowledge-search-results" data-testid="knowledge-search-results">
          {searchHits.map((chunk) => (
            <article key={chunk.id} data-testid={`knowledge-search-hit-${chunk.id}`}>
              <span className="status-chip">{chunk.resourceTitle}</span>
              <span className="status-chip" data-testid={`knowledge-search-evidence-${chunk.id}`}>{chunk.evidenceStrength}</span>
              <strong>{chunk.heading || '（无标题片段）'}</strong>
              <p>{chunk.contentMd.slice(0, 160)}</p>
            </article>
          ))}
          {!searchHits.length ? <p className="empty-state" data-testid="knowledge-search-empty">没有命中；请更换关键词或先解析更多资料。</p> : null}
        </div>
      ) : null}
      <p className="muted" data-testid="knowledge-parse-engines">
        可用解析引擎：{availableEngines.length ? availableEngines.map((engine) => `${engine.name}${engine.version ? `@${engine.version}` : ''}`).join('、') : '未检测到（PDF/DOCX 需要本地依赖）'}
      </p>
      <div className="toolbar-row">
        <button className="primary-action compact-button" onClick={() => void startBatchParse()} disabled={batchBusy} data-testid="knowledge-batch-parse">{batchBusy ? '批量解析中…' : '批量解析待处理资源'}</button>
        {batchJob && (batchJob.status === 'queued' || batchJob.status === 'running') ? (
          <button className="secondary-action compact-button" onClick={() => void cancelBatchParse()} data-testid="knowledge-batch-parse-cancel">取消解析</button>
        ) : null}
        {batchJob && (batchJob.status === 'partial_failed' || batchJob.status === 'failed' || batchJob.status === 'cancelled') ? (
          <button className="secondary-action compact-button" onClick={() => void retryBatchParse()} disabled={batchBusy} data-testid="knowledge-batch-parse-retry">重试失败项</button>
        ) : null}
      </div>
      {batchJob ? (
        <div className="parse-job-status" data-testid="knowledge-batch-parse-progress">
          <span className="status-chip" data-testid="knowledge-batch-parse-status">{batchJob.status}</span>
          <span data-testid="knowledge-batch-parse-counts">
            {batchJob.processedResources}/{batchJob.totalResources} 处理中（成功 {batchJob.succeededResources} · 失败 {batchJob.failedResources}）
          </span>
          {batchJob.lastError ? <span className="warning-text" data-testid="knowledge-batch-parse-error">{batchJob.lastError}</span> : null}
        </div>
      ) : null}
      {loading ? <div className="empty-state" data-testid="knowledge-resource-loading">正在读取资料列表…</div> : null}
      {errorMessage ? <div className="warning-box" data-testid="knowledge-resource-error">{errorMessage}</div> : null}
      <div className="resource-source-list" data-testid="knowledge-resource-list">
        {resources.map((resource) => (
          <article className="resource-row" key={resource.id} data-testid={`knowledge-resource-${resource.id}`}>
            <div>
              <strong>{resource.title}</strong>
              <span>{resource.originalFileName} · {Math.max(1, Math.round(resource.fileSize / 1024))} KB · {resource.chunkCount} 个切片</span>
              <p data-testid={`knowledge-resource-engine-${resource.id}`}>{resource.parseEngine || '未记录解析引擎'}</p>
              {resource.parseError ? <p className="warning-text" data-testid={`knowledge-resource-parse-error-${resource.id}`}>{resource.parseError}</p> : null}
            </div>
            <span className="status-chip" data-testid={`knowledge-resource-status-${resource.id}`}>{STATUS_LABELS[resource.parseStatus] ?? resource.parseStatus}</span>
            <div className="toolbar-row">
              {resource.parseStatus === 'needs_parser' || resource.parseStatus === 'failed' ? (
                <button className="primary-action compact-button" onClick={() => void parseResource(resource)} disabled={busyResourceId === resource.id} data-testid={`knowledge-parse-${resource.id}`}>
                  {busyResourceId === resource.id ? '解析中…' : resource.parseStatus === 'failed' ? '重新解析' : '本地解析'}
                </button>
              ) : (
                <button className="secondary-action compact-button" onClick={() => void parseResource(resource)} disabled={busyResourceId === resource.id} data-testid={`knowledge-reparse-${resource.id}`}>
                  {busyResourceId === resource.id ? '解析中…' : '重新解析'}
                </button>
              )}
              <button className="link-button" onClick={() => window.omniEdu?.showKnowledgeResource(resource.localPath)} data-testid={`knowledge-open-${resource.id}`}>打开原文件</button>
            </div>
          </article>
        ))}
        {!loading && !resources.length ? <p className="empty-state" data-testid="knowledge-resource-empty">还没有导入老师知识资源。TXT / Markdown 会立刻切片，PDF、Word、PPT 需要本地解析。</p> : null}
      </div>
    </section>
  );
}
