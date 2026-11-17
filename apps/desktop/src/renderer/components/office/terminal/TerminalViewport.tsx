import {useEffect, useRef, useState} from 'react';
import type {Terminal} from '@xterm/xterm';
import {TERMINAL_OUTPUT_LIMIT} from '../../../../shared/xiaozhi-terminal';
import type {TerminalFrame} from './terminalState';
import '@xterm/xterm/css/xterm.css';
import styles from './terminal.module.css';

type Props = {frames: TerminalFrame[]; snapshot: string; inputEnabled: boolean; resizeEnabled: boolean;
  onInput: (chars: string) => void; onResize: (cols: number, rows: number) => void};
export function TerminalViewport(props: Props) {
  const host = useRef<HTMLDivElement>(null), terminal = useRef<Terminal | undefined>(undefined);
  const current = useRef(props); current.current = props;
  const queue = useRef<TerminalFrame[]>([]), queuedThrough = useRef(0), writing = useRef(false);
  const [failed, setFailed] = useState(false);
  function flush() {
    const view = terminal.current;
    if (!view || writing.current || !queue.current.length) return;
    const frame = queue.current.shift()!; writing.current = true;
    if (frame.reset) view.reset();
    view.write(frame.text, () => {writing.current = false; flush();});
  }
  function receive() {
    const incoming = current.current.frames.filter(frame => frame.deliveryId > queuedThrough.current);
    if (!incoming.length) {flush(); return;}
    const last = incoming[incoming.length - 1];
    const gap = incoming[0].deliveryId > queuedThrough.current + 1;
    queue.current.push(...incoming); queuedThrough.current = last.deliveryId;
    if (gap || queue.current.length > 64 || queue.current.reduce((sum, frame) => sum + frame.text.length, 0) > TERMINAL_OUTPUT_LIMIT) {
      queue.current = [{deliveryId: last.deliveryId, reset: true, text: current.current.snapshot}];
    }
    flush();
  }
  useEffect(() => {
    let disposed = false, observer: ResizeObserver | undefined, frame: number | undefined;
    let input: {dispose(): void} | undefined;
    void Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]).then(([{Terminal}, {FitAddon}]) => {
      if (disposed || !host.current) return;
      const view = new Terminal({fontSize: 14, convertEol: true, scrollback: 1000, screenReaderMode: true,
        disableStdin: !current.current.inputEnabled, theme: {background: '#ffffff', foreground: '#222222', cursor: '#2563eb'}});
      const fit = new FitAddon(); view.loadAddon(fit); view.open(host.current); terminal.current = view;
      input = view.onData(chars => {if (current.current.inputEnabled) current.current.onInput(chars);});
      observer = new ResizeObserver(() => {
        if (!host.current?.offsetWidth) return;
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (disposed) return; fit.fit(); current.current.onResize(view.cols, view.rows);
        });
      });
      observer.observe(host.current); receive();
    }).catch(() => {if (!disposed) setFailed(true);});
    return () => {disposed = true; observer?.disconnect(); if (frame !== undefined) cancelAnimationFrame(frame);
      input?.dispose(); terminal.current?.dispose(); terminal.current = undefined; queue.current = [];};
  }, []);
  useEffect(() => {receive();}, [props.frames, props.snapshot]);
  useEffect(() => {if (terminal.current) terminal.current.options.disableStdin = !props.inputEnabled;}, [props.inputEnabled]);
  useEffect(() => {const view = terminal.current; if (view && props.resizeEnabled) current.current.onResize(view.cols, view.rows);}, [props.resizeEnabled]);
  return <div>
    <div ref={host} className={styles.viewport} data-testid="terminal-viewport" aria-label="交互终端"/>
    {failed && <><p role="alert">终端渲染器加载失败，可用下方输入框继续操作。</p><pre className={styles.output}>{props.snapshot}</pre></>}
  </div>;
}
