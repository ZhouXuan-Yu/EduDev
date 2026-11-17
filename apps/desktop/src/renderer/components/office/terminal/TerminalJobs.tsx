import {useEffect, useState} from 'react';
import {Button} from '@heroui/react';
import {TerminalConsole} from './TerminalConsole';
import {useTerminalJobs} from './useTerminalJobs';
import styles from './terminal.module.css';

export function TerminalJobs({sessionId}: {sessionId: string}) {
  const {jobs, loading, error, refresh} = useTerminalJobs(sessionId);
  const [open, setOpen] = useState(false), [selected, setSelected] = useState('');
  useEffect(() => {setOpen(false); setSelected('');}, [sessionId]);
  const active = jobs.find(job => job.jobId === selected) || jobs[0];
  const running = jobs.filter(job => job.terminal.state === 'running').length;
  return <section className={styles.jobs} data-edu-domain="" data-testid="terminal-jobs" aria-label="终端作业">
    <Button size="sm" variant="ghost" data-testid="terminal-jobs-toggle" aria-expanded={open} onPress={() => setOpen(value => !value)}>
      终端作业{running > 0 ? ` · ${running} 项执行中` : ''}
    </Button>
    {loading && <p role="status">正在读取终端作业…</p>}
    {error && <p role="alert">{error}</p>}
    {open && <div>
      {!loading && !jobs.length && <p role="status">暂无终端作业。</p>}
      <div className={styles.controls}>{jobs.map(job => <Button key={job.jobId} size="sm" variant={job.jobId === active?.jobId ? 'secondary' : 'ghost'}
        data-testid={`terminal-select-${job.jobId}`} aria-pressed={job.jobId === active?.jobId} onPress={() => setSelected(job.jobId)}>
        {job.terminal.command.slice(0, 60)} · {job.terminal.state === 'running' ? '执行中' : '已结束'}
      </Button>)}</div>
      {active && <TerminalConsole key={sessionId + '/' + active.jobId} sessionId={sessionId} job={active}/>}
    </div>}
    {(open || error) && <Button size="sm" variant="ghost" data-testid="terminal-jobs-refresh" onPress={() => void refresh()}>重新读取终端作业</Button>}
  </section>;
}
