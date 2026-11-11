import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import styles from '../../../ui-system/material-library/material-library.module.css';

export type MaterialLibraryMode = 'catalog' | 'text';

/** Page composition only. The workspace owns sources, drafts and service calls. */
export function MaterialLibraryLayout({
    actions, handoff, navigation, mode, modeDisabled, changeMode, queueSummary,
    controls, feedback, activity, children
}: {
    actions: ReactNode;
    handoff?: ReactNode;
    navigation: ReactNode;
    mode: MaterialLibraryMode;
    modeDisabled: boolean;
    changeMode: (mode: MaterialLibraryMode) => void;
    queueSummary: string;
    controls: ReactNode;
    feedback: ReactNode;
    activity: ReactNode;
    children: ReactNode;
}) {
    const [activityOpen, setActivityOpen] = useState(false);
    const activityId = useId();

    return <section className={'edu-materials ' + styles.workspace}
        data-edu-domain="materials" data-testid="materials-workspace" aria-label="资料库">
        {handoff}
        <header className={styles.heading}>
            <div><h1>资料库</h1><p>把教材、题目与教学资料整理成可以找到、核对和复用的知识。</p></div>
            <div className={styles.actions}>{actions}</div>
        </header>
        <div className={styles.layout}>
            <aside className={styles.navigation} aria-label="资料目录与标签">{navigation}</aside>
            <div className={styles.main}>
                <div className={styles.topline}>
                    <nav className={styles.modes} aria-label="资料库查找方式">
                        <button type="button" className={styles.mode} aria-pressed={mode === 'catalog'}
                            disabled={modeDisabled}
                            onClick={() => changeMode('catalog')} data-testid="materials-mode-catalog">资料</button>
                        <button type="button" className={styles.mode} aria-pressed={mode === 'text'}
                            disabled={modeDisabled}
                            onClick={() => changeMode('text')} data-testid="materials-mode-text">检索内容</button>
                    </nav>
                    <button type="button" className={styles.queueLink} data-testid="materials-queue-toggle"
                        aria-expanded={activityOpen} aria-controls={activityId}
                        onClick={() => setActivityOpen(value => !value)}>
                        <RefreshCw size={14} aria-hidden="true"/><span>{queueSummary}</span>
                        <ChevronDown size={14} aria-hidden="true"/>
                    </button>
                </div>
                <div className={styles.controls}>{controls}</div>
                {feedback}
                {/* Keep batch forms and their async guards mounted when folded. */}
                <div id={activityId} hidden={!activityOpen} className={styles.activity}>
                    {activity}
                </div>
                {children}
            </div>
        </div>
    </section>;
}
