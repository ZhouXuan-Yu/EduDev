import {useEffect, useState} from 'react';
import {Button, Input, Label, TextField} from '@heroui/react';
import type {XiaozhiTerminalOutput} from '../../../../shared/xiaozhi-terminal';
import type {TerminalJobView} from '../../../../shared/xiaozhi-terminal-jobs';
import {TerminalViewport} from './TerminalViewport';
import {useTerminalSession} from './useTerminalSession';
import {terminalMessage} from './terminalState';
import styles from './terminal.module.css';

const labels = {running: '执行中', completed: '已结束', failed: '执行失败', cancelled: '已停止', timed_out: '执行超时'};
export function TerminalConsole({sessionId, initial, job: initialJob}: {sessionId: string; initial?: XiaozhiTerminalOutput; job?: TerminalJobView}) {
  const jobId = initialJob?.jobId || initial?.jobId;
  const live = useTerminalSession(sessionId, jobId, initialJob);
  const [input, setInput] = useState('');
  useEffect(() => setInput(''), [sessionId, jobId]);
  const job = live.job, terminal = job?.terminal || initial;
  const controls = job?.controls;
  function send() {if (input && live.enqueue(input + '\r')) setInput('');}
  return <div ref={live.section} className={styles.console} data-edu-domain="" data-testid="agent-terminal-output" data-terminal-id={jobId || ''} aria-live="off">
    {live.loading && <p role="status">正在读取终端状态…</p>}
    {terminal && <>
      <div>{terminal.shell} · {terminal.cwd}</div>
      <pre className={styles.command}><code>{terminal.command}</code></pre>
      {job?.tty ? <TerminalViewport key={sessionId + '/' + job.jobId} frames={live.frames} snapshot={live.output}
        inputEnabled={Boolean(controls?.write && !live.uncertain)} resizeEnabled={Boolean(controls?.resize)} onInput={chars => {live.enqueue(chars);}}
        onResize={(cols, rows) => {if (controls?.resize) live.resize(cols, rows);}}/>
        : <pre className={styles.output} data-testid="terminal-plain-output">{job ? live.output || (terminal.state === 'running' ? '等待终端输出' : '命令没有输出') : terminal.output || '命令没有输出'}</pre>}
      <div data-testid="agent-terminal-status">{labels[terminal.state]}{terminal.exitCode !== undefined && ` · 退出码 ${terminal.exitCode}`}
        {terminal.truncated && ' · 输出已截断'}</div>
    </>}
    {job && <>
      <div className={styles.controls}>
        <TextField value={input} onChange={setInput} isDisabled={!controls?.write || Boolean(live.uncertain)}>
          <Label>终端输入</Label><Input data-testid="terminal-input" autoComplete="off"
            onKeyDown={event => {if (event.key === 'Enter' && !event.nativeEvent.isComposing) {event.preventDefault(); send();}}}/>
        </TextField>
        <Button size="sm" variant="secondary" data-testid="terminal-send" isDisabled={!controls?.write || Boolean(live.uncertain) || !input} onPress={send}>发送输入</Button>
        <Button size="sm" variant="ghost" data-testid="terminal-interrupt" isDisabled={!controls?.write || Boolean(live.uncertain)} onPress={() => {live.enqueue('\u0003');}}>Ctrl+C</Button>
        <Button size="sm" variant="ghost" data-testid="terminal-eof" isDisabled={!controls?.eof || Boolean(live.uncertain)} onPress={() => {live.eof();}}>发送 EOF</Button>
        <Button size="sm" variant="ghost" data-testid="terminal-input-close" isDisabled={!controls?.closeInput || live.controlPending} onPress={() => void live.act('closeInput')}>关闭输入通道</Button>
        <Button size="sm" variant="secondary" data-testid="terminal-take-control" isDisabled={!controls?.takeControl || live.controlPending} onPress={() => void live.act('takeControl')}>接管终端</Button>
        <Button size="sm" variant="secondary" data-testid="terminal-close" isDisabled={!controls?.close || live.closing} onPress={() => void live.act('close')}>结束终端</Button>
      </div>
      {controls?.closeInput && <p>关闭输入通道可能结束终端。</p>}
      {live.writing && <p role="status">正在发送输入，等待接收确认…</p>}
      {live.uncertain && <p role="alert" data-testid="terminal-unknown-input">{terminalMessage('unknown_ack')} {live.uncertain.sequence !== undefined && `输入序号 ${live.uncertain.sequence}`}</p>}
      {job.notice && <p role="status">{terminalMessage(job.notice)}</p>}
      {job.cleanup === 'needs_check' && <p role="status">终端清理仍需核对。</p>}
      {live.resetNotice && <p role="status">输出窗口已重新同步。</p>}
      {live.inputNotice && <p role="status">{live.inputNotice}</p>}
    </>}
    {live.error && !(live.uncertain && live.error === terminalMessage('unknown_ack')) && <p role="alert" data-testid="terminal-error">{live.error}</p>}
    {jobId && <Button size="sm" variant="ghost" data-testid="terminal-refresh" onPress={() => void live.refresh()}>重新读取终端</Button>}
  </div>;
}
