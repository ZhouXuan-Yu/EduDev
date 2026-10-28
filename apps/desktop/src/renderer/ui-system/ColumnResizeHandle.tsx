import {useRef, useState} from 'react';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ColumnResizeHandle({
  side,
  width,
  min,
  max,
  label,
  onResize,
  onReset,
}: {
  side: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  label: string;
  onResize: (width: number) => void;
  onReset: () => void;
}) {
  const drag = useRef(false);
  const [dragging, setDragging] = useState(false);

  function resizeFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const raw = side === 'left' ? event.clientX - rect.left : rect.right - event.clientX;
    const centerFloor = 320;
    onResize(clamp(raw, min, Math.min(max, rect.width - centerFloor)));
  }

  function keyboard(event: React.KeyboardEvent<HTMLDivElement>) {
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
    onResize(clamp(next, min, boundary));
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
        event.preventDefault();
        drag.current = true;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => { if (drag.current) resizeFromPointer(event); }}
      onPointerUp={event => {
        if (!drag.current) return;
        drag.current = false;
        setDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = false; setDragging(false); }}
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
