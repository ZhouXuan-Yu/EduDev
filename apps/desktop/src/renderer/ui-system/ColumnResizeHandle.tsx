import {useEffect, useRef, useState} from 'react';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ColumnResizeHandle({
  side,
  width,
  min,
  max,
  label,
  onResize,
  onReset,
  onCommit,
}: {
  side: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  label: string;
  onResize: (width: number) => void;
  onReset: () => void;
  onCommit?: (width:number) => void;
}) {
  const drag = useRef(false);
  const frame = useRef(0), nextWidth = useRef(width), startWidth = useRef(width);
  const target = useRef<HTMLDivElement|null>(null), pointer = useRef(0);
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  function finish(cancel=false) {
    if(!drag.current)return;
    drag.current=false;setDragging(false);cancelAnimationFrame(frame.current);frame.current=0;
    const settled=cancel?startWidth.current:nextWidth.current;
    onResize(settled);onCommit?.(settled);
    if(target.current?.hasPointerCapture(pointer.current))target.current.releasePointerCapture(pointer.current);
  }
  const [dragging, setDragging] = useState(false);

  function resizeFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const raw = side === 'left' ? event.clientX - rect.left : rect.right - event.clientX;
    const centerFloor = 320;
    nextWidth.current=clamp(raw,min,Math.min(max,rect.width-centerFloor));
    if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;if(drag.current)onResize(nextWidth.current);});
  }

  function keyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if(event.key==='Escape'&&drag.current){event.preventDefault();finish(true);return;}
    const step = event.shiftKey ? 32 : 12;
    let next: number | undefined;
    if (event.key === 'ArrowLeft') next = side === 'left' ? width - step : width + step;
    else if (event.key === 'ArrowRight') next = side === 'left' ? width + step : width - step;
    else if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    if (next === undefined) return;
    event.preventDefault();
    const parent = event.currentTarget.parentElement;
    const boundary = parent ? Math.min(max, parent.getBoundingClientRect().width - 320) : max;
    const settled=clamp(next,min,boundary);onResize(settled);onCommit?.(settled);
  }

  return (
    <div
      className={`edu-resizer edu-resizer--${side}${dragging ? ' is-dragging' : ''}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      data-testid={`edu-resizer-${side}`}
      onPointerDown={event => {
        if (drag.current || !event.isPrimary || event.button!==0) return;
        event.preventDefault();
        startWidth.current=width;nextWidth.current=width;target.current=event.currentTarget;pointer.current=event.pointerId;
        event.currentTarget.focus({preventScroll:true});
        drag.current = true;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => { if (drag.current && event.pointerId===pointer.current) resizeFromPointer(event); }}
      onPointerUp={event => {if(event.pointerId===pointer.current)finish();}}
      onPointerCancel={event => {if(event.pointerId===pointer.current)finish(true);}}
      onLostPointerCapture={() => finish()}
      onDoubleClick={onReset}
      onKeyDown={keyboard}
    />
  );
}

export function readColumnWidth(key: string, fallback: number, min: number, max: number) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? clamp(value, min, max) : fallback;
  } catch {
    return fallback;
  }
}

export function writeColumnWidth(key: string, value: number) {
  try { localStorage.setItem(key, String(value)); } catch { /* local preference only */ }
}
