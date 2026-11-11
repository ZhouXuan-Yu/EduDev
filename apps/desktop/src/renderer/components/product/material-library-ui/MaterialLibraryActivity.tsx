import { useId, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import type { MaterialQueueView, MaterialTaskView } from '../../../../shared/material-parse-task';
import { materialFailureText } from '../../../../shared/materials';
import styles from '../../../ui-system/material-library/material-library.module.css';

const taskLabels = {
    pending: '等待收录', running: '正在收录', succeeded: '正文已收录', failed: '收录未完成', cancelled: '已停止'
};

/** Local disclosure keeps batch recovery forms and diagnostics mounted. */
export function MaterialLibraryDisclosure({ title, testId, children }: {
    title: string;
    testId: string;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);
    const contentId = useId();
    return <section className={styles.disclosure} data-testid={testId}>
        <h3><button type="button" className={styles.disclosureToggle} aria-expanded={expanded}
            aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
            {title}<ChevronDown size={16} aria-hidden="true"/>
        </button></h3>
        <div id={contentId} hidden={!expanded}>{children}</div>
    </section>;
}

export function materialQueueSummary(queue?: MaterialQueueView) {
    if (!queue) return '处理队列 · 状态读取中';
    const failures = queue.tasks.filter(task => task.status === 'failed').length;
    return `处理队列 · ${queue.running} 进行中${queue.pending ? ` · ${queue.pending} 等待` : ''}`
        + (failures ? ' · 有失败项' : '') + (queue.invalid ? ' · 有记录需处理' : '');
}

export function MaterialLibraryActivity({ queue, disabled, open, batches, diagnostics }: {
    queue?: MaterialQueueView;
    disabled: boolean;
    open: (id: string) => void;
    batches: ReactNode;
    diagnostics: ReactNode;
}) {
    return <>
        <section data-testid="materials-queue" aria-label="收录与处理">
            <h2 className={styles.activityTitle}>收录与处理</h2>
            {!queue ? <p role="status">正在读取处理队列…</p>
                : !queue.tasks.length ? <p className={styles.caption}>当前没有可显示的收录任务。</p>
                    : <ul className={styles.queueTasks}>{queue.tasks.map(task => <li key={task.resourceId + task.version}>
                        <div><strong>{task.title}</strong><span>{taskLabels[task.status]}</span>
                            {task.status === 'failed' && <p>{materialFailureText('parser:' + task.error)}</p>}</div>
                        <Button variant="ghost" isDisabled={disabled} onPress={() => open(task.resourceId)}>打开资料</Button>
                    </li>)}</ul>}
        </section>
        <MaterialLibraryDisclosure title="文件夹批次与恢复" testId="materials-batches">{batches}</MaterialLibraryDisclosure>
        <MaterialLibraryDisclosure title="题库归档与检索状态" testId="materials-diagnostics">{diagnostics}</MaterialLibraryDisclosure>
    </>;
}

/** Selection risks and stop/retry controls stay outside the folded activity panel. */
export function MaterialLibraryTask({ task, disabled, prioritize, cancel, retry }: {
    task?: MaterialTaskView;
    disabled: boolean;
    prioritize: () => void;
    cancel: () => void;
    retry: () => void;
}) {
    if (!task) return null;
    return <div className={styles.currentTask} data-testid="materials-task" data-status={task.status}>
        <p role={task.status === 'failed' ? 'alert' : 'status'}>{task.title} · {taskLabels[task.status]}
            {task.status === 'failed' ? ` · ${materialFailureText('parser:' + task.error)}` : ''}</p>
        <div className={styles.actions}>
            {(task.status === 'pending' || task.status === 'running' && task.priority === 0) &&
                <Button variant="secondary" onPress={prioritize} isDisabled={disabled} data-testid="materials-prioritize">优先处理</Button>}
            {['pending', 'running'].includes(task.status) &&
                <Button variant="ghost" onPress={cancel} isDisabled={disabled} data-testid="materials-task-stop">停止这份</Button>}
            {task.status === 'failed' &&
                <Button variant="secondary" onPress={retry} isDisabled={disabled} data-testid="materials-task-retry">重试收录</Button>}
        </div>
    </div>;
}
