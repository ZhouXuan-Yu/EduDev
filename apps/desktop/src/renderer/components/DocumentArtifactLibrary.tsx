import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentArtifactExportResult } from '../../shared/contracts';

type DocumentArtifactLibraryProps = {
  setStatus: (message: string) => void;
};

const TYPE_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  pdf: 'PDF',
  docx: 'Word',
};

export function DocumentArtifactLibrary({ setStatus }: DocumentArtifactLibraryProps) {
  const [artifacts, setArtifacts] = useState<DocumentArtifactExportResult[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const rows = await window.omniEdu?.listDocumentArtifacts() ?? [];
      setArtifacts(rows);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取产物列表失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => artifacts.filter((artifact) => {
    if (typeFilter && artifact.type !== typeFilter) return false;
    if (statusFilter && artifact.status !== statusFilter) return false;
    return true;
  }), [artifacts, statusFilter, typeFilter]);

  async function openArtifact(artifact: DocumentArtifactExportResult) {
    setBusyId(artifact.id);
    try {
      await window.omniEdu?.showDocumentArtifact(artifact.id);
      setStatus(`已在文件管理器中定位：${artifact.fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '打开产物失败。';
      setErrorMessage(message);
      setStatus(message);
    } finally {
      setBusyId('');
    }
  }

  const exportedCount = artifacts.filter((artifact) => artifact.status === 'exported').length;
  const failedCount = artifacts.filter((artifact) => artifact.status === 'failed').length;

  return (
    <section className="work-panel document-artifact-library" data-testid="document-artifact-library">
      <div className="panel-heading">
        <div>
          <h2>产物</h2>
          <p className="muted">试卷、答题纸、解析、讲义和报告都写入本地文件并记录路径、大小与 SHA-256；预览不等于导出。</p>
        </div>
        <button className="icon-button" aria-label="刷新产物列表" onClick={() => void load()} data-testid="artifact-refresh">刷新</button>
      </div>
      <div className="toolbar-row">
        <label>类型
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} data-testid="artifact-type-filter">
            <option value="">全部</option>
            <option value="markdown">Markdown</option>
            <option value="pdf">PDF</option>
            <option value="docx">Word</option>
          </select>
        </label>
        <label>状态
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} data-testid="artifact-status-filter">
            <option value="">全部</option>
            <option value="exported">已导出</option>
            <option value="failed">失败</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <span className="status-chip" data-testid="artifact-summary">已导出 {exportedCount} · 失败 {failedCount} · 共 {artifacts.length}</span>
      </div>
      {loading ? <div className="empty-state" data-testid="artifact-loading">正在读取产物列表…</div> : null}
      {errorMessage ? <div className="warning-box" data-testid="artifact-error">{errorMessage}</div> : null}
      <div className="artifact-list" data-testid="artifact-list">
        {filtered.map((artifact) => (
          <article className="artifact-row" key={artifact.id} data-testid={`artifact-${artifact.id}`}>
            <div>
              <strong>{artifact.title}</strong>
              <span data-testid={`artifact-meta-${artifact.id}`}>
                {TYPE_LABELS[artifact.type] ?? artifact.type} · {artifact.fileName} · {Math.max(1, Math.round(artifact.fileSize / 1024))} KB
              </span>
              <code data-testid={`artifact-hash-${artifact.id}`}>{artifact.contentHash ? `${artifact.contentHash.slice(0, 16)}…` : '无 hash'}</code>
              {artifact.errorMessage ? <p className="warning-text" data-testid={`artifact-error-${artifact.id}`}>{artifact.errorMessage}</p> : null}
            </div>
            <span className="status-chip" data-testid={`artifact-status-${artifact.id}`}>{artifact.status === 'exported' ? '已导出' : artifact.status === 'failed' ? '失败' : '草稿'}</span>
            <button
              className="secondary-action compact-button"
              onClick={() => void openArtifact(artifact)}
              disabled={artifact.status !== 'exported' || busyId === artifact.id}
              data-testid={`artifact-open-${artifact.id}`}
            >
              {busyId === artifact.id ? '打开中…' : '在文件夹中查看'}
            </button>
          </article>
        ))}
        {!loading && !filtered.length ? <p className="empty-state" data-testid="artifact-empty">还没有导出产物；在组卷、讲义或 AI 对话中导出后会出现这里。</p> : null}
      </div>
    </section>
  );
}
