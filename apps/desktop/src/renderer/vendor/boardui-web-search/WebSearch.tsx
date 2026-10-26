'use client';

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode, type MouseEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown as RiArrowDownSLine } from 'lucide-react';
import { BRAND_MARKS } from './brands';
import { makeRevealRows, revealDelay, useRevealTicker } from './timeline';
import type { WebSearchBrand, WebSearchProps, WebSearchSource, WebSearchStep } from './types';
import './web-search.css';

const SOFT_EASE = [0.22, 1, 0.36, 1] as const;
const SOURCE_SPRING = { type: 'spring', stiffness: 420, damping: 36 } as const;
const UNIT_INITIAL = {
  opacity: 0,
  height: 0,
  y: 4,
  filter: 'blur(6px)',
  '--bui-reveal-fade': '22px',
};
const UNIT_ANIMATE = {
  opacity: 1,
  height: 'auto',
  y: 0,
  filter: 'blur(0px)',
  '--bui-reveal-fade': '0px',
};
const UNIT_TRANSITION = {
  height: { duration: 0.38, ease: SOFT_EASE },
  opacity: { duration: 0.42, ease: SOFT_EASE },
  filter: { duration: 0.42, ease: SOFT_EASE },
  y: { duration: 0.42, ease: SOFT_EASE },
  '--bui-reveal-fade': { duration: 0.44, ease: SOFT_EASE },
};
const MASK =
  'linear-gradient(to bottom, #000 calc(100% - var(--bui-reveal-fade, 0px)), transparent calc(100% + 1px))';
const MONOCHROME_BRANDS = new Set<WebSearchBrand>(['x', 'github', 'apple', 'notion']);

function useRevealMotion(reduce: boolean) {
  const [masked, setMasked] = useState(!reduce);
  return {
    initial: reduce ? (false as const) : UNIT_INITIAL,
    animate: UNIT_ANIMATE,
    transition: reduce ? { duration: 0 } : UNIT_TRANSITION,
    style: masked && !reduce ? { WebkitMaskImage: MASK, maskImage: MASK } : undefined,
    onAnimationComplete: () => setMasked(false),
  };
}

function Guide({ first, last, reduce }: { first: boolean; last: boolean; reduce: boolean }) {
  return (
    <span aria-hidden="true" className="bui-ws-guide">
      <svg width="12" height="15" viewBox="0 0 12 15" fill="none">
        <motion.path
          d="M0.5 0 V8 Q0.5 14 6.5 14 H11.5"
          stroke="currentColor"
          strokeWidth="1"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: reduce ? 0 : 0.14,
            ease: 'linear',
            delay: reduce || first ? 0 : 0.12,
          }}
        />
      </svg>
      {!last && (
        <motion.span
          className="bui-ws-guide-line"
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: reduce ? 0 : 0.12, ease: 'linear' }}
        />
      )}
    </span>
  );
}

function GuideBridge({ height, reduce }: { height: number; reduce: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="bui-ws-bridge"
      style={{ top: -height, height, left: 7 }}
      initial={reduce ? false : { scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: reduce ? 0 : 0.12, ease: 'linear' }}
    />
  );
}

function LogRow({
  first,
  last,
  reduce,
  nested,
  children,
}: {
  first: boolean;
  last: boolean;
  reduce: boolean;
  nested?: boolean;
  children: ReactNode;
}) {
  const reveal = useRevealMotion(reduce);
  return (
    <motion.li {...reveal} className={`bui-ws-row${nested ? ' bui-ws-row-nested' : ''}`}>
      <Guide first={first} last={last} reduce={reduce} />
      {children}
    </motion.li>
  );
}

function BrandMark({ brand, className = '' }: { brand: WebSearchBrand; className?: string }) {
  const provider = BRAND_MARKS[brand];
  if (!provider) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox={provider.viewBox}
      className={`bui-ws-brand ${className}`}
      style={MONOCHROME_BRANDS.has(brand) ? undefined : { color: provider.brand }}
    >
      <path d={provider.path} fill="currentColor" />
    </svg>
  );
}

function StepContent({ step, active }: { step: WebSearchStep; active: boolean }) {
  const Icon = step.icon;
  return (
    <div className="bui-ws-step">
      {step.brand ? (
        <span className="bui-ws-step-icon">
          <BrandMark brand={step.brand} />
        </span>
      ) : Icon ? (
        <Icon className="bui-ws-step-icon" aria-hidden="true" />
      ) : (
        <span className="bui-ws-step-icon" aria-hidden="true" />
      )}
      <p className="bui-ws-label">
        <span className={active ? 'bui-ws-shimmer' : undefined}>{step.label}</span>
        {step.query && <span className="bui-ws-query">{step.query}</span>}
      </p>
      {step.meta && <span className="bui-ws-meta">{step.meta}</span>}
    </div>
  );
}

function SourceMark({
  source,
  layoutId,
  z,
  reduce,
}: {
  source: WebSearchSource;
  layoutId?: string;
  z: number;
  reduce: boolean;
}) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={reduce ? { duration: 0 } : SOURCE_SPRING}
      style={{ zIndex: z }}
      className="bui-ws-source-mark"
      aria-hidden="true"
    >
      {source.icon ? (
        <span className="bui-ws-custom-mark">{source.icon}</span>
      ) : source.brand ? (
        <BrandMark brand={source.brand} />
      ) : (
        <span className="bui-ws-source-dot" />
      )}
    </motion.span>
  );
}

function SourceRow({
  source,
  onOpen,
  visible,
  expanded,
  layoutId,
  z,
  reduce,
}: {
  source: WebSearchSource;
  onOpen?: (source: WebSearchSource) => void;
  visible: boolean;
  expanded: boolean;
  layoutId?: string;
  z: number;
  reduce: boolean;
}) {
  const Element = source.href ? 'a' : 'div';
  return (
    <motion.li
      initial={false}
      animate={{ height: visible ? 'auto' : 0 }}
      transition={{ duration: reduce ? 0 : 0.28, ease: SOFT_EASE }}
      className="bui-ws-source-row"
      aria-hidden={!visible || !expanded}
      inert={!visible || !expanded}
    >
      <Element
        {...(source.href
          ? {
              href: onOpen ? '#' : source.href,
              onClick: onOpen ? (event: MouseEvent) => { event.preventDefault(); onOpen(source); } : undefined,
              target: onOpen ? undefined : '_blank',
              rel: 'noopener noreferrer',
              tabIndex: visible && expanded ? 0 : -1,
            }
          : {})}
        className="bui-ws-source-link"
        title={`${source.title} — ${source.domain}`}
      >
        {visible ? (
          <SourceMark source={source} layoutId={layoutId} z={z} reduce={reduce} />
        ) : (
          <span className="bui-ws-source-placeholder" aria-hidden="true" />
        )}
        <motion.span
          className="bui-ws-source-copy"
          initial={false}
          animate={{ opacity: visible ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.16, delay: visible && !reduce ? 0.05 : 0 }}
        >
          <span className="bui-ws-source-title">{source.title}</span>
          <span className="bui-ws-source-domain">{source.domain}</span>
        </motion.span>
      </Element>
    </motion.li>
  );
}

function Sources({ sources, reduce, onOpen, label }: { sources: readonly WebSearchSource[]; reduce: boolean; onOpen?: (source: WebSearchSource) => void; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const id = useId();
  const count = sources.length;

  useEffect(() => {
    const target = expanded ? count : 0;
    if (visibleCount === target) return;
    if (reduce || visibleCount > count) {
      setVisibleCount(target);
      return;
    }
    const timer = window.setTimeout(
      () => setVisibleCount((value) => value + (expanded ? 1 : -1)),
      100,
    );
    return () => window.clearTimeout(timer);
  }, [expanded, visibleCount, count, reduce]);

  const visible = (index: number) => visibleCount > count - 1 - index;
  const layoutId = (index: number) => (reduce || index >= 6 ? undefined : `${id}-source-${index}`);
  const stacked = sources.slice(0, 6);
  const remaining = stacked.filter((_, index) => !visible(index)).length;
  const overflow = count - stacked.length;
  const showOverflow = overflow > 0 && visibleCount === 0;

  return (
    <LogRow first={false} last reduce={reduce} nested>
      <div className="bui-ws-row-content">
        <button
          type="button"
          className="bui-ws-sources-button"
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          onClick={() => setExpanded((value) => !value)}
        >
          <span>{label}</span>
          <motion.span
            aria-hidden="true"
            className="bui-ws-source-stack"
            initial={false}
            animate={{ width: (remaining > 0 ? 14 * remaining + 6 : 0) + (showOverflow ? 30 : 0) }}
            transition={reduce ? { duration: 0 } : { ...SOURCE_SPRING, delay: 0.07 }}
          >
            <span className="bui-ws-stacked-marks">
              {stacked.map(
                (source, index) =>
                  !visible(index) && (
                    <SourceMark
                      key={`${source.domain}-${index}`}
                      source={source}
                      layoutId={layoutId(index)}
                      z={stacked.length - index}
                      reduce={reduce}
                    />
                  ),
              )}
            </span>
            {showOverflow && <span className="bui-ws-overflow">+{overflow}</span>}
          </motion.span>
          <RiArrowDownSLine
            aria-hidden="true"
            className={`bui-ws-chevron${expanded ? ' bui-ws-chevron-open' : ''}`}
          />
        </button>
        <ul id={`${id}-list`} className="bui-ws-list" aria-label={label}>
          {sources.map((source, index) => (
            <SourceRow
              key={`${source.domain}-${index}`}
              source={source}
              onOpen={onOpen}
              visible={visible(index)}
              expanded={expanded}
              layoutId={layoutId(index)}
              z={count - index}
              reduce={reduce}
            />
          ))}
        </ul>
      </div>
    </LogRow>
  );
}

const STARS = [
  { x: 50, y: 46, scale: 1 },
  { x: 18, y: 22, scale: 0.55 },
  { x: 82, y: 26, scale: 0.45 },
  { x: 78, y: 76, scale: 0.55 },
  { x: 22, y: 78, scale: 0.4 },
];

function WorkingRow({
  label,
  reduce,
  indented,
  controlled = false,
  elapsedMs,
}: {
  label: string;
  reduce: boolean;
  indented: boolean;
  controlled?: boolean;
  elapsedMs?: number;
}) {
  const reveal = useRevealMotion(reduce);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (controlled) return;
    const start = performance.now();
    const timer = window.setInterval(() => setElapsed((performance.now() - start) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [controlled]);

  return (
    <motion.div
      {...reveal}
      className={`bui-ws-working${indented ? ' bui-ws-working-indented' : ''}`}
    >
      <div className="bui-ws-working-content" role="status">
        <span className="bui-ws-stars" aria-hidden="true">
          {STARS.map((star, index) => {
            const size = 14 * star.scale;
            return (
              <svg
                key={index}
                viewBox="0 0 24 24"
                className="bui-ws-star"
                style={{
                  width: size,
                  height: size,
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                  animationDuration: '1.4s',
                  animationDelay: `${(1.4 * index * 0.7) / 5}s`,
                }}
              >
                <path
                  d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z"
                  fill="currentColor"
                />
              </svg>
            );
          })}
        </span>
        <span className="bui-ws-working-label">{label}</span>
        {(!controlled || elapsedMs !== undefined) && <span className="bui-ws-timer" aria-hidden="true">
          {(controlled ? elapsedMs! / 1000 : elapsed).toFixed(1)}s
        </span>}
      </div>
    </motion.div>
  );
}

function Heading({
  step,
  active,
  reduce,
}: {
  step: WebSearchStep;
  active: boolean;
  reduce: boolean;
}) {
  const reveal = useRevealMotion(reduce);
  return (
    <motion.div {...reveal} className="bui-ws-heading">
      <div className="bui-ws-row-content">
        <StepContent step={step} active={active} />
      </div>
    </motion.div>
  );
}

/** BoardUI Web Search, adapted from the public client build into isolated React + CSS. */
export function WebSearch({
  steps,
  run = true,
  stepInterval = 850,
  startDelay = 320,
  revealed,
  working = 'Working',
  onComplete,
  className = '',
  state,
  elapsedMs,
  onSourceOpen,
  sourcesLabel = 'Sources',
  ariaLabel = 'Web search progress',
}: WebSearchProps) {
  const reduce = useReducedMotion() ?? false;
  const rows = useMemo(() => makeRevealRows(steps), [steps]);
  const total = rows.length === 0 ? 0 : rows.length + (revealed === undefined ? 1 : 0);
  const delayFor = useCallback(
    (count: number) => revealDelay(count, rows, steps, startDelay, stepInterval),
    [rows, steps, startDelay, stepInterval],
  );
  const count = useRevealTicker({ total, run, revealed, delayFor, onComplete });
  const rowIndex = (step: number, kind: 'step' | 'sources') =>
    rows.findIndex((row) => row.step === step && row.kind === kind);
  const heading = steps[0]?.heading ? steps[0] : null;
  const nestedSteps = heading ? steps.slice(1) : steps;
  const offset = heading ? 1 : 0;
  const lastVisible =
    nestedSteps.filter((_, index) => count > rowIndex(index + offset, 'step')).length - 1;
  const isWorking = working !== false && (state !== undefined ? state === 'running' : count > 0 && count < total);

  const tree = (
    <ul className="bui-ws-list" aria-live="polite" aria-relevant="additions">
      {nestedSteps.map((step, index) => {
        const stepIndex = index + offset;
        if (count <= rowIndex(stepIndex, 'step')) return null;
        const sourceIndex = rowIndex(stepIndex, 'sources');
        return (
          <LogRow
            key={step.id ?? `${step.label}-${stepIndex}`}
            first={index === 0}
            last={index === lastVisible}
            reduce={reduce}
          >
            <div className="bui-ws-row-content" data-call-id={step.id} data-step-state={step.status}>
              <StepContent step={step} active={!reduce && (state !== undefined ? step.status === 'running' : index === lastVisible && count < total)} />
              {step.details}
              {!!step.sources?.length && sourceIndex !== -1 && count > sourceIndex && (
                <div className="bui-ws-sources-tree">
                  <GuideBridge height={5} reduce={reduce} />
                  <ul className="bui-ws-list bui-ws-tree-indent">
                    <Sources sources={step.sources} reduce={reduce} onOpen={onSourceOpen} label={sourcesLabel} />
                  </ul>
                </div>
              )}
            </div>
          </LogRow>
        );
      })}
    </ul>
  );

  return (
    <div
      className={`bui-web-search ${className}`.trim()}
      role="region"
      aria-label={ariaLabel}
      data-runtime-state={state}
    >
      {heading ? (
        <>
          {count > 0 && (
            <Heading step={heading} active={!reduce && count === 1 && total > 1} reduce={reduce} />
          )}
          {count > 1 && (
            <div className="bui-ws-tree">
              <GuideBridge height={6} reduce={reduce} />
              <div className="bui-ws-tree-indent">{tree}</div>
            </div>
          )}
        </>
      ) : (
        tree
      )}
      {isWorking && <WorkingRow label={working} reduce={reduce} indented={!heading} controlled={state !== undefined} elapsedMs={elapsedMs} />}
    </div>
  );
}
