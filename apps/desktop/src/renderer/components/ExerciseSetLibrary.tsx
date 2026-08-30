import { useCallback, useEffect, useState } from 'react';
import type { ExerciseSet, Student } from '../../shared/contracts';

type ExerciseSetLibraryProps = {
  activeStudent?: Student;
  setStatus: (message: string) => void;
};

type ExerciseSetLibraryStateProps = {
  activeStudent?: Student;
  exerciseSets: ExerciseSet[];
  loading: boolean;
  errorMessage: string;
  onRefresh: () => void;
};

const roleLabels = {
  original: '原题',
  similar: '相似题',
  variant: '变式题',
} as const;

const sourceLabels = {
  local_bank: '本地题库',
  teacher_resource: '教师资源',
  generated: '小智生成 · 待教师复核',
} as const;

export function ExerciseSetLibraryState({
  activeStudent,
  exerciseSets,
  loading,
  errorMessage,
  onRefresh,
}: ExerciseSetLibraryStateProps) {
  if (!activeStudent) {
    return <p data-testid="exercise-set-no-student">请选择学生后查看已确认题组。</p>;
  }

  if (loading) {
    return <p data-testid="exercise-set-loading">正在从本地题组库读取…</p>;
  }

  if (errorMessage) {
    return (
      <div className="warning-box exercise-set-error" data-testid="exercise-set-error">
        <p>{errorMessage}</p>
        <button className="secondary-action compact-button" type="button" onClick={onRefresh} data-testid="exercise-set-error-retry">重新读取</button>
      </div>
    );
  }

  if (!exerciseSets.length) {
    return (
      <div className="exercise-set-empty" data-testid="exercise-set-empty">
        <p>当前学生还没有已确认题组。</p>
        <span>三元题组只有经过教师确认后才会写入这里；草稿和拒绝项不会出现。</span>
        <div><button className="secondary-action compact-button" type="button" onClick={onRefresh} data-testid="exercise-set-refresh">重新读取</button></div>
      </div>
    );
  }

  return (
    <div className="exercise-set-list" data-testid="exercise-set-content">
      <div className="exercise-set-toolbar"><span>共 {exerciseSets.length} 个正式题组</span><button className="secondary-action compact-button" type="button" onClick={onRefresh} data-testid="exercise-set-refresh">刷新本地回读</button></div>
      {exerciseSets.map((exerciseSet) => (
        <article className="exercise-set-card" key={exerciseSet.id} data-testid={`exercise-set-card-${exerciseSet.id}`}>
          <div className="exercise-set-card-heading">
            <div>
              <strong>{exerciseSet.title}</strong>
              <p>{exerciseSet.subject || '未标注学科'} · {exerciseSet.knowledgePoint || '未标注知识点'} · {exerciseSet.items.length} 题</p>
            </div>
            <time dateTime={exerciseSet.createdAt}>{new Date(exerciseSet.createdAt).toLocaleString('zh-CN')}</time>
          </div>
          <details data-testid={`exercise-set-details-${exerciseSet.id}`}>
            <summary>查看题组内容与来源</summary>
            <div className="exercise-set-items">
              {exerciseSet.items.map((item, index) => (
                <section key={`${item.role}-${item.questionId ?? index}`} data-testid={`exercise-set-item-${exerciseSet.id}-${index}`}>
                  <div className="exercise-set-item-meta">
                    <span className="status-chip">{roleLabels[item.role]}</span>
                    <span className={`status-chip source-${item.sourceKind}`} data-testid={`exercise-set-source-${exerciseSet.id}-${index}`}>{sourceLabels[item.sourceKind]}</span>
                    <span className="status-chip">{item.difficulty}</span>
                  </div>
                  <h4>{item.stem}</h4>
                  <p><strong>答案：</strong>{item.answer || '未提供'}</p>
                  {item.analysis ? <p><strong>解析：</strong>{item.analysis}</p> : null}
                  {item.teacherObservation ? <p><strong>教师观察：</strong>{item.teacherObservation}</p> : null}
                </section>
              ))}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}

export function ExerciseSetLibrary({ activeStudent, setStatus }: ExerciseSetLibraryProps) {
  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(Boolean(activeStudent));
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setExerciseSets([]);
    setErrorMessage('');
    if (!activeStudent) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    window.omniEdu?.listExerciseSets(activeStudent.id)
      .then((items) => {
        if (!cancelled) setExerciseSets(items ?? []);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '读取本地题组失败。';
        setErrorMessage(message);
        setStatus(`读取已确认题组失败：${message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeStudent?.id, reloadToken, setStatus]);

  return <ExerciseSetLibraryState activeStudent={activeStudent} exerciseSets={exerciseSets} loading={loading} errorMessage={errorMessage} onRefresh={refresh} />;
}
