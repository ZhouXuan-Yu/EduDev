import { useCallback, useEffect, useRef, useState } from 'react';
import type { KnowledgeImportJob } from '../../shared/contracts';

type KnowledgeImportPanelProps = {
  setStatus: (message: string) => void;
  onImported?: () => void;
};

const ACTIVE_STATUSES = new Set(['queued', 'scanning', 'importing']);

export function KnowledgeImportPanel({ setStatus, onImported }: KnowledgeImportPanelProps) {
  const [importing, setImporting] = useState(false);
  const [activeJob, setActiveJob] = useState<KnowledgeImportJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<KnowledgeImportJob[]>([]);
  const pollTimerRef = useRef<number | null>(null);

  const refreshJobs = useCallback(async () => {
    const jobs = await window.omniEdu?.listKnowledgeImportJobs(8) ?? [];
    setRecentJobs(jobs);
    return jobs;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollTimerRef.current = window.setInterval(async () => {
      const job = await window.omniEdu?.getKnowledgeImportJob(jobId);
      if (!job) {
        stopPolling();
        setImporting(false);
        setActiveJob(null);
        void refreshJobs();
        return;
      }
      setActiveJob(job);
      if (!ACTIVE_STATUSES.has(job.status)) {
        stopPolling();
        setImporting(false);
        void refreshJobs();
        onImported?.();
        if (job.status === 'ready') setStatus(`导入完成：${job.succeededFiles} 个新资源，${job.duplicateFiles} 个重复跳过。`);
        else if (job.status === 'partial_failed') setStatus(`导入部分完成：${job.succeededFiles} 个成功，${job.failedFiles} 个失败，可重试。`);
        else if (job.status === 'cancelled') setStatus('导入已取消；已完成的文件保留在知识库中。');
        else if (job.status === 'failed') setStatus(`导入失败：${job.lastError || '未知错误'}`);
      }
    }, 500);
  }, [onImported, refreshJobs, setStatus, stopPolling]);

  useEffect(() => {
    void refreshJobs();
    return stopPolling;
  }, [refreshJobs, stopPolling]);

  async function handleImportDirectory() {
    if (importing) return;
    setImporting(true);
    setActiveJob(null);
    try {
      const job = await window.omniEdu?.importKnowledgeDirectory();
      if (!job) {
        setStatus('已取消选择目录，未写入任何资源。');
        setImporting(false);
        return;
      }
      setActiveJob(job);
      if (ACTIVE_STATUSES.has(job.status)) startPolling(job.id);
      else {
        setImporting(false);
        void refreshJobs();
        onImported?.();
        if (job.status === 'ready') setStatus(`导入完成：${job.succeededFiles} 个新资源，${job.duplicateFiles} 个重复跳过。`);
        else setStatus(`导入结束：${job.lastError || job.status}`);
      }
    } catch (error) {
      setImporting(false);
      setStatus(error instanceof Error ? error.message : '目录导入失败。');
    }
  }

  async function handleCancel() {
    if (!activeJob) return;
    try {
      const job = await window.omniEdu?.cancelKnowledgeImportJob(activeJob.id);
      if (job) setActiveJob(job);
      setStatus('已请求取消导入；当前文件处理完成后停止。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '取消失败。');
    }
  }

  async function handleRetry(jobId: string) {
    setImporting(true);
    setActiveJob(null);
    try {
      const job = await window.omniEdu?.retryKnowledgeImportJob(jobId);
      if (!job) {
        setImporting(false);
        setStatus('重试没有返回任务结果。');
        return;
      }
      if (ACTIVE_STATUSES.has(job.status)) {
        setActiveJob(job);
        startPolling(job.id);
      } else {
        setImporting(false);
        void refreshJobs();
        onImported?.();
        if (job.status === 'ready') setStatus(`重试完成：${job.succeededFiles} 个新资源。`);
        else setStatus(`重试结束：${job.status === 'partial_failed' ? `${job.failedFiles} 个文件仍失败` : job.lastError || job.status}`);
      }
    } catch (error) {
      setImporting(false);
      setStatus(error instanceof Error ? error.message : '重试失败。');
    }
  }

  const progressPercent = activeJob && activeJob.totalFiles > 0
    ? Math.min(100, Math.round((activeJob.processedFiles / activeJob.totalFiles) * 100))
    : 0;
  const failedItems = recentJobs.flatMap((job) => job.items.filter((item) => item.status === 'failed').map((item) => ({ ...item, jobId: job.id }))).slice(0, 20);

  return (
    <section className="work-panel knowledge-import-panel" data-testid="knowledge-import-panel">
      <div className="panel-heading">
        <div>
          <h3>资料导入</h3>
          <p className="muted">选择本地文件夹批量导入；支持取消、去重与失败重试，大文件保留在受管目录。</p>
        </div>
        <button className="primary-action" onClick={handleImportDirectory} disabled={importing} data-testid="knowledge-import-directory">
          {importing ? '导入中…' : '导入文件夹'}
        </button>
      </div>
      {activeJob ? (
        <div className="import-job-status" data-testid="knowledge-import-progress">
          <div className="toolbar-row">
            <span className="status-chip" data-testid="knowledge-import-job-status">{activeJob.status}</span>
            <span data-testid="knowledge-import-job-counts">
              {activeJob.processedFiles}/{activeJob.totalFiles} 处理中（成功 {activeJob.succeededFiles} · 重复 {activeJob.duplicateFiles} · 失败 {activeJob.failedFiles}）
            </span>
            {ACTIVE_STATUSES.has(activeJob.status) ? (
              <button className="secondary-action" onClick={handleCancel} data-testid="knowledge-import-cancel">取消导入</button>
            ) : null}
          </div>
          <progress max={100} value={progressPercent} data-testid="knowledge-import-progressbar">{progressPercent}%</progress>
        </div>
      ) : null}
      {!activeJob && failedItems.length > 0 ? (
        <div className="import-job-failures" data-testid="knowledge-import-failed-list">
          <p className="muted">最近失败的文件（可重试对应任务）：</p>
          <ul>
            {failedItems.map((item) => (
              <li key={item.id} data-testid={`knowledge-import-failed-${item.id}`}>{item.fileName}：{item.errorMessage}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!activeJob && recentJobs.length > 0 ? (
        <div className="import-job-history" data-testid="knowledge-import-history">
          <p className="muted">最近导入任务：</p>
          {recentJobs.slice(0, 5).map((job) => (
            <div key={job.id} className="toolbar-row" data-testid={`knowledge-import-job-${job.id}`}>
              <span className="status-chip">{job.status}</span>
              <span>{job.succeededFiles} 成功 · {job.duplicateFiles} 重复 · {job.failedFiles} 失败</span>
              {job.failedFiles > 0 && (job.status === 'partial_failed' || job.status === 'failed' || job.status === 'cancelled') ? (
                <button className="secondary-action" onClick={() => handleRetry(job.id)} data-testid={`knowledge-import-retry-${job.id}`}>重试失败项</button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
