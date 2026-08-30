import { CalendarClock, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ReviewReminder, Student } from '../../shared/contracts';

type ReviewReminderPanelProps = {
  activeStudent?: Student;
  onOpenEvidence: () => void;
  setStatus: (message: string) => void;
};

type ReviewReminderStateProps = {
  activeStudent?: Student;
  reminder: ReviewReminder | null;
  loading: boolean;
  errorMessage: string;
  onRefresh: () => void;
  onOpenEvidence: () => void;
};

function formatDueAt(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ReviewReminderState({
  activeStudent,
  reminder,
  loading,
  errorMessage,
  onRefresh,
  onOpenEvidence,
}: ReviewReminderStateProps) {
  if (!activeStudent) {
    return <div className="review-reminder-state" data-testid="review-reminder-no-student">请选择学生后计算复习提醒。</div>;
  }

  if (loading) {
    return <div className="review-reminder-state" data-testid="review-reminder-loading"><RefreshCw size={18} className="spin-icon" />正在读取本地学习记录并计算…</div>;
  }

  if (errorMessage) {
    return (
      <div className="review-reminder-state review-reminder-error" data-testid="review-reminder-error">
        <div><strong>复习提醒读取失败</strong><p>{errorMessage}</p></div>
        <button className="secondary-action compact-button" type="button" onClick={onRefresh} data-testid="review-reminder-retry">重新计算</button>
      </div>
    );
  }

  if (!reminder) {
    return (
      <div className="review-reminder-state review-reminder-error" data-testid="review-reminder-error">
        <div><strong>复习提醒读取失败</strong><p>主进程没有返回合法的提醒结果。</p></div>
        <button className="secondary-action compact-button" type="button" onClick={onRefresh} data-testid="review-reminder-retry">重新计算</button>
      </div>
    );
  }

  if (reminder.status === 'clear') {
    return (
      <div className="review-reminder-state review-reminder-clear" data-testid="review-reminder-clear">
        <CalendarClock size={20} />
        <div><strong>当前没有到期或近期复习任务</strong><p>提醒来自本地学习记录的实时计算，不会创建第二份任务队列。</p></div>
        <button className="secondary-action compact-button" type="button" onClick={onRefresh} data-testid="review-reminder-refresh">刷新</button>
      </div>
    );
  }

  return (
    <div className="review-reminder-content" data-testid={`review-reminder-${reminder.status}`}>
      <div className="review-reminder-summary">
        <div>
          <span className={`status-chip review-status-${reminder.status}`}>{reminder.status === 'due' ? `${reminder.dueCount} 个到期` : `${reminder.upcomingCount} 个即将到期`}</span>
          <span>当前学生：{activeStudent.displayName}</span>
        </div>
        <button className="secondary-action compact-button" type="button" onClick={onRefresh} data-testid="review-reminder-refresh"><RefreshCw size={14} />刷新本地计算</button>
      </div>
      <div className="review-reminder-items">
        {reminder.items.map((item) => (
          <article key={item.id} data-testid={`review-reminder-item-${item.id}`}>
            <div><strong>{item.name}</strong><span>{item.moduleName || '未分类'} · {item.type}</span></div>
            <div><span className={`status-chip review-item-${item.state}`}>{item.state === 'due' ? '现在复习' : '即将到期'}</span><time dateTime={new Date(item.dueAt * 1000).toISOString()}>{formatDueAt(item.dueAt)}</time></div>
          </article>
        ))}
      </div>
      <div className="review-reminder-boundary" data-testid="review-reminder-boundary">只显示知识点和调度时间，不包含学习记录正文、答案或附件路径；提醒不会自动写回。</div>
      <button className="secondary-action compact-button" type="button" onClick={onOpenEvidence} data-testid="review-reminder-open-evidence">查看学生学习证据</button>
    </div>
  );
}

export function ReviewReminderPanel({ activeStudent, onOpenEvidence, setStatus }: ReviewReminderPanelProps) {
  const [reminder, setReminder] = useState<ReviewReminder | null>(null);
  const [loading, setLoading] = useState(Boolean(activeStudent));
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setReminder(null);
    setErrorMessage('');
    if (!activeStudent) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    window.omniEdu?.getReviewReminder(activeStudent.id)
      .then((nextReminder) => {
        if (cancelled) return;
        if (!nextReminder) {
          setErrorMessage('主进程没有返回合法的提醒结果。');
          return;
        }
        setReminder(nextReminder);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '无法读取本地学习记录。';
        setErrorMessage(message);
        setStatus(`复习提醒读取失败：${message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeStudent?.id, reloadToken, setStatus]);

  return <ReviewReminderState activeStudent={activeStudent} reminder={reminder} loading={loading} errorMessage={errorMessage} onRefresh={refresh} onOpenEvidence={onOpenEvidence} />;
}
