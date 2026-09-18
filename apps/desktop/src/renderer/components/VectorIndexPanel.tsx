import { useCallback, useEffect, useState } from 'react';
import type { VectorIndexStatusView } from '../../shared/contracts';

type VectorIndexPanelProps = {
  setStatus: (message: string) => void;
};

export function VectorIndexPanel({ setStatus }: VectorIndexPanelProps) {
  const [indexStatus, setIndexStatus] = useState<VectorIndexStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastBuild, setLastBuild] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const status = await window.omniEdu?.getVectorIndexStatus();
      setIndexStatus(status ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取向量索引状态失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function buildIndex() {
    setBuilding(true);
    setErrorMessage('');
    try {
      const result = await window.omniEdu?.buildVectorIndex();
      if (!result) throw new Error('建立索引没有返回结果。');
      if (!result.ok) {
        setErrorMessage(`${result.code}：${result.message}`);
        setStatus(`向量索引不可用：${result.message}；检索会自动降级为关键词。`);
      } else {
        setLastBuild(`本次索引 ${result.indexedTotal} 个切片，库内共 ${result.indexedCount} 条向量（${result.model}）。`);
        setStatus(`向量索引已更新：本次 ${result.indexedTotal} 个切片。`);
      }
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '建立向量索引失败。');
    } finally {
      setBuilding(false);
    }
  }

  async function resetIndex() {
    setBuilding(true);
    try {
      await window.omniEdu?.resetVectorIndex();
      setLastBuild('');
      setStatus('向量索引已标记为待重建；下次建立索引时会重新计算全部切片。');
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '重置向量索引失败。');
    } finally {
      setBuilding(false);
    }
  }

  const available = indexStatus?.available ?? false;

  return (
    <section className="work-panel vector-index-panel" data-testid="vector-index-panel">
      <div className="panel-heading">
        <div>
          <h3>本地向量索引</h3>
          <p className="muted">LanceDB + 本地中文 embedding 模型；索引是可重建派生物，不可用时会自动降级为关键词检索。</p>
        </div>
        <button className="icon-button" aria-label="刷新向量索引状态" onClick={() => void refresh()} data-testid="vector-index-refresh">刷新</button>
      </div>
      {loading ? <div className="empty-state" data-testid="vector-index-loading">正在读取索引状态…</div> : null}
      {errorMessage ? <div className="warning-box" data-testid="vector-index-error">{errorMessage}</div> : null}
      <div className="vector-index-status" data-testid="vector-index-status">
        <span className="status-chip" data-testid="vector-index-availability">{available ? '模型可用' : '模型不可用（降级关键词检索）'}</span>
        <span data-testid="vector-index-model">{indexStatus?.model || '未记录模型'}</span>
        <span data-testid="vector-index-dims">{indexStatus?.dims || 0} 维</span>
        <span data-testid="vector-index-count">已索引 {indexStatus?.indexedCount ?? 0} 条</span>
        <span data-testid="vector-index-pending">待索引 {indexStatus?.pendingChunks ?? 0} 个切片</span>
        {indexStatus?.updatedAt ? <span className="muted" data-testid="vector-index-updated">上次更新 {indexStatus.updatedAt}</span> : null}
      </div>
      {indexStatus?.modelError ? <p className="warning-text" data-testid="vector-index-model-error">{indexStatus.modelError}</p> : null}
      {lastBuild ? <div className="success-box" data-testid="vector-index-build-result">{lastBuild}</div> : null}
      <div className="toolbar-row">
        <button className="primary-action" onClick={() => void buildIndex()} disabled={building || !available} data-testid="vector-index-build">{building ? '索引中…' : '建立 / 更新索引'}</button>
        <button className="secondary-action" onClick={() => void resetIndex()} disabled={building} data-testid="vector-index-reset">标记全部待重建</button>
      </div>
    </section>
  );
}
