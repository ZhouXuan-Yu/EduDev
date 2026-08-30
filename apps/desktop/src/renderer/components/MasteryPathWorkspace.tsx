import { AlertTriangle, BookOpenCheck, RefreshCw, Route, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiMasteryPath, Student } from '../../shared/contracts';

type Props = {
  activeStudent?: Student;
  setStatus: (message: string) => void;
  onOpenAi: () => void;
};

type StateProps = {
  activeStudent?: Student;
  path: AiMasteryPath | null;
  loading: boolean;
  errorMessage: string;
  onRefresh: () => void;
  onOpenAi: () => void;
};

const knowledgeTypeLabels = {
  memory: '记忆',
  procedure: '步骤',
  concept: '概念',
  design: '迁移设计',
} as const;

function formatTime(value: string) {
  if (!value) return '未知时间';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export function MasteryPathState({ activeStudent, path, loading, errorMessage, onRefresh, onOpenAi }: StateProps) {
  return (
    <section className="mastery-path-workspace" data-testid="mastery-path-workspace">
      <header className="mastery-path-header">
        <div>
          <span className="eyebrow">教师确认后的本地学习路径</span>
          <h2><Route size={21} />{activeStudent ? `${activeStudent.displayName}的学习路径` : '学习路径'}</h2>
          <p>路径来自小智草稿与教师确认，只表示教学顺序，不自动推断学生掌握度。</p>
        </div>
        <div className="mastery-path-actions">
          <button className="secondary-action" data-testid="mastery-path-refresh" disabled={loading || !activeStudent} onClick={onRefresh}>
            <RefreshCw size={16} />刷新
          </button>
          <button className="primary-action" data-testid="mastery-path-open-ai" disabled={!activeStudent} onClick={onOpenAi}>
            <Sparkles size={16} />让小智继续规划
          </button>
        </div>
      </header>

      {loading ? (
        <div className="mastery-path-state" data-testid="mastery-path-loading"><RefreshCw className="spin" size={20} />正在读取本地学习路径…</div>
      ) : errorMessage ? (
        <div className="mastery-path-state error-banner" data-testid="mastery-path-error">
          <AlertTriangle size={20} />
          <div><strong>学习路径读取失败</strong><p>{errorMessage}</p></div>
          <button className="secondary-action compact-button" onClick={onRefresh}>重试</button>
        </div>
      ) : !activeStudent ? (
        <div className="mastery-path-state" data-testid="mastery-path-empty"><BookOpenCheck size={22} />请先选择学生，再查看其学习路径。</div>
      ) : !path || !path.modules.length ? (
        <div className="mastery-path-state" data-testid="mastery-path-empty">
          <BookOpenCheck size={22} />
          <div><strong>还没有教师确认的学习路径</strong><p>可以请小智生成路径草稿；教师确认前不会写入本地正式路径。</p></div>
        </div>
      ) : (
        <div data-testid="mastery-path-content">
          <div className="mastery-path-meta">
            <span>版本 v{path.version}</span>
            <span>{path.mode === 'append' ? '追加模式' : '替换模式'}</span>
            <span>{path.modules.length} 个模块</span>
            <span>更新于 {formatTime(path.updatedAt)}</span>
          </div>
          <div className="mastery-path-modules">
            {[...path.modules].sort((left, right) => left.order - right.order).map((module, moduleIndex) => (
              <article className="mastery-path-module" data-testid={`mastery-path-module-${moduleIndex}`} key={module.id}>
                <div className="mastery-module-order">{String(moduleIndex + 1).padStart(2, '0')}</div>
                <div>
                  <h3>{module.name}</h3>
                  <div className="mastery-knowledge-points">
                    {module.knowledgePoints.map((point, pointIndex) => (
                      <div data-testid={`mastery-path-point-${moduleIndex}-${pointIndex}`} key={point.id}>
                        <span>{pointIndex + 1}</span>
                        <strong>{point.name}</strong>
                        <small>{knowledgeTypeLabels[point.type]}</small>
                      </div>
                    ))}
                    {!module.knowledgePoints.length ? <p>该模块暂未包含知识点，请回到小智重新规划。</p> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <footer className="mastery-path-boundary" data-testid="mastery-path-boundary">
        <ShieldCheck size={17} />
        <span>只读取当前学生的本地 SQLite 路径；修改必须重新经过小智草稿和教师确认队列。</span>
      </footer>
    </section>
  );
}

export function MasteryPathWorkspace({ activeStudent, setStatus, onOpenAi }: Props) {
  const [path, setPath] = useState<AiMasteryPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadPath() {
    setLoading(true);
    setErrorMessage('');
    setPath(null);
    if (!activeStudent) {
      setLoading(false);
      return;
    }
    try {
      if (!window.omniEdu?.getAiMasteryPath) throw new Error('学习路径接口不可用，请重新启动应用。');
      const nextPath = await window.omniEdu.getAiMasteryPath(activeStudent.id);
      setPath(nextPath ?? null);
      setStatus(nextPath ? `已读取 ${activeStudent.displayName} 的本地学习路径。` : `${activeStudent.displayName} 还没有教师确认的学习路径。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取学习路径失败，请稍后重试。';
      setErrorMessage(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPath(); }, [activeStudent?.id]);

  return <MasteryPathState activeStudent={activeStudent} path={path} loading={loading} errorMessage={errorMessage} onRefresh={() => { void loadPath(); }} onOpenAi={onOpenAi} />;
}
