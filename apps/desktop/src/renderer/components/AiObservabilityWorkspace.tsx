import { useEffect, useMemo, useState } from 'react';
import type {
  AiAgentRun,
  AiMemoryTraceSummary,
  AiRegressionGateStatus,
  AiRegressionReport,
  AiTelemetrySnapshot,
} from '../../shared/contracts';

function formatDateTime(value: string) {
  if (!value) return '未完成';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

const statusLabels: Record<string, string> = {
  passed: '通过',
  failed: '失败',
  warning: '警告',
  running: '运行中',
  blocked: '已阻断',
  succeeded: '已完成',
  waiting_input: '等待输入',
  waiting_confirmation: '等待确认',
  cancelled: '已取消',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`observability-status observability-status-${status}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

type ObservableRun = Pick<AiAgentRun, 'id' | 'route' | 'subIntent' | 'status' | 'createdAt'>;

function toObservableRuns(runs: AiAgentRun[] | undefined): ObservableRun[] {
  return (runs ?? []).map(({ id, route, subIntent, status, createdAt }) => ({ id, route, subIntent, status, createdAt }));
}

export function AiObservabilityWorkspace() {
  const [snapshot, setSnapshot] = useState<AiTelemetrySnapshot | null>(null);
  const [reports, setReports] = useState<AiRegressionReport[]>([]);
  const [runs, setRuns] = useState<ObservableRun[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [trace, setTrace] = useState<AiMemoryTraceSummary | null>(null);
  const [title, setTitle] = useState('小智本地运行回归');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  async function loadTrace(runId: string) {
    setSelectedRunId(runId);
    setTrace(null);
    try {
      const nextTrace = await window.omniEdu?.getAiMemoryTrace(runId, 50);
      if (nextTrace) setTrace(nextTrace);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '运行轨迹读取失败。');
    }
  }

  async function refresh(options: { preserveSelection?: boolean } = {}) {
    setLoading(true);
    setErrorMessage('');
    try {
      const [nextSnapshot, nextReports, nextRuns] = await Promise.all([
        window.omniEdu?.getAiTelemetrySnapshot(),
        window.omniEdu?.listAiRegressionReports(20),
        window.omniEdu?.listAiAgentRuns(30),
      ]);
      setSnapshot(nextSnapshot ?? null);
      setReports(nextReports ?? []);
      setRuns(toObservableRuns(nextRuns));
      if (!options.preserveSelection) {
        setSelectedReportId(nextReports?.[0]?.id ?? '');
        const firstRunId = nextRuns?.[0]?.id ?? '';
        if (firstRunId) await loadTrace(firstRunId);
        else {
          setSelectedRunId('');
          setTrace(null);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '小智运行观测数据读取失败。');
    } finally {
      setLoading(false);
    }
  }

  async function createReport() {
    if (!title.trim() || creating) return;
    setCreating(true);
    setErrorMessage('');
    setNotice('');
    try {
      const report = await window.omniEdu?.createAiRegressionReport({ title: title.trim() });
      if (!report) throw new Error('回归报告未返回可读结果。');
      const [nextSnapshot, nextReports, nextRuns] = await Promise.all([
        window.omniEdu?.getAiTelemetrySnapshot(),
        window.omniEdu?.listAiRegressionReports(20),
        window.omniEdu?.listAiAgentRuns(30),
      ]);
      setSnapshot(nextSnapshot ?? report.snapshot);
      setReports(nextReports ?? [report]);
      setRuns(nextRuns ? toObservableRuns(nextRuns) : runs);
      setSelectedReportId(report.id);
      setNotice(`回归报告已保存：${report.gates.length} 个 gate，状态为${statusLabels[report.status] ?? report.status}。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '回归报告生成失败。');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="observability-workspace" data-testid="ai-observability-workspace">
      <header className="observability-header">
        <div>
          <span>SQLite 可检查证据</span>
          <h2>小智运行观测</h2>
          <p>读取真实 run、事件、工具、产物和确认记录；不展示原始 prompt 或隐藏推理。</p>
        </div>
        <button className="secondary-action" onClick={() => void refresh()} disabled={loading} data-testid="ai-observability-refresh">
          {loading ? '刷新中…' : '刷新观测数据'}
        </button>
      </header>

      {loading ? <div className="empty-state" data-testid="ai-observability-loading">正在读取本地运行证据…</div> : null}
      {errorMessage ? <div className="warning-box" role="alert" data-testid="ai-observability-error">{errorMessage}</div> : null}
      {notice ? <div className="success-box" role="status" data-testid="ai-observability-success">{notice}</div> : null}

      {!loading && snapshot ? (
        <div className="observability-kpis" data-testid="ai-observability-summary">
          <article><span>Agent runs</span><strong>{snapshot.runCount}</strong><small>{Object.keys(snapshot.statusCounts).length} 种终态</small></article>
          <article><span>事件</span><strong>{snapshot.eventCount}</strong><small>{snapshot.toolEventCount} 条工具证据</small></article>
          <article><span>延迟 P95</span><strong>{snapshot.latency.count ? `${snapshot.latency.p95Ms} ms` : '暂无'}</strong><small>{snapshot.latency.count} 个完成样本</small></article>
          <article><span>Token 已知</span><strong>{snapshot.tokenBudget.knownTaskCount}</strong><small>{snapshot.tokenBudget.totalTokens} tokens</small></article>
        </div>
      ) : null}

      <div className="observability-grid">
        <section className="observability-panel" data-testid="ai-regression-panel">
          <div className="observability-panel-head">
            <div><h3>回归报告</h3><p>报告从当前 SQLite 窗口重新计算，不手写通过结论。</p></div>
          </div>
          <div className="observability-create-row">
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} data-testid="ai-regression-title" />
            <button className="primary-action" disabled={creating || !title.trim()} onClick={() => void createReport()} data-testid="ai-regression-create">
              {creating ? '生成中…' : '生成并保存报告'}
            </button>
          </div>
          <div className="observability-report-layout">
            <div className="observability-list" data-testid="ai-regression-list">
              {reports.map((report) => (
                <button key={report.id} className={selectedReport?.id === report.id ? 'active' : ''} onClick={() => setSelectedReportId(report.id)} data-testid={`ai-regression-item-${report.id}`}>
                  <strong>{report.title}</strong><span>{formatDateTime(report.createdAt)}</span><StatusPill status={report.status} />
                </button>
              ))}
              {!loading && !reports.length ? <div className="empty-state" data-testid="ai-regression-empty">尚无回归报告。点击上方按钮从真实本地运行生成第一份。</div> : null}
            </div>
            <div className="observability-gates" data-testid="ai-regression-gates">
              {selectedReport ? (
                <>
                  <div className="observability-selected-title"><strong>{selectedReport.summary}</strong><StatusPill status={selectedReport.status} /></div>
                  {selectedReport.gates.map((gate) => (
                    <article key={gate.id} data-testid={`ai-regression-gate-${gate.id}`}>
                      <div><strong>{gate.label}</strong><StatusPill status={gate.status as AiRegressionGateStatus} /></div>
                      <p>{gate.detail}</p>
                    </article>
                  ))}
                </>
              ) : <div className="empty-state">选择或生成报告后查看 gate 证据。</div>}
            </div>
          </div>
        </section>

        <section className="observability-panel" data-testid="ai-run-inspector">
          <div className="observability-panel-head"><div><h3>最近运行</h3><p>列表只显示 route、状态和时间；轨迹使用 L1 bounded 投影。</p></div></div>
          <div className="observability-run-layout">
            <div className="observability-list" data-testid="ai-run-list">
              {runs.map((run) => (
                <button key={run.id} className={selectedRunId === run.id ? 'active' : ''} onClick={() => void loadTrace(run.id)} data-testid={`ai-run-item-${run.id}`}>
                  <strong>{run.route} / {run.subIntent}</strong><span>{formatDateTime(run.createdAt)}</span><StatusPill status={run.status} />
                </button>
              ))}
              {!loading && !runs.length ? <div className="empty-state" data-testid="ai-run-empty">尚无小智运行。先在 AI 页面执行一次任务。</div> : null}
            </div>
            <div className="observability-trace" data-testid="ai-run-trace">
              {trace?.events.map((event) => (
                <article key={`${event.sequence}-${event.label}`}>
                  <span>{String(event.sequence).padStart(2, '0')}</span>
                  <div><strong>{event.label}</strong><p>{event.phase} · {event.toolName || '无工具'} · {formatDateTime(event.createdAt)}</p></div>
                  <StatusPill status={event.status} />
                </article>
              ))}
              {trace && !trace.events.length ? <div className="empty-state" data-testid="ai-run-trace-empty">该运行没有可展示的安全事件摘要。</div> : null}
              {!trace && !loading ? <div className="empty-state">选择一次运行查看安全轨迹。</div> : null}
              {trace ? <small data-testid="ai-run-trace-boundary">bounded={String(trace.bounded)} · rawPromptIncluded={String(trace.rawPromptIncluded)} · hiddenReasoningIncluded={String(trace.hiddenReasoningIncluded)}</small> : null}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
