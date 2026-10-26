import type { ComponentType, ReactNode, SVGProps } from 'react';
import type { BRAND_MARKS } from './brands';

export type WebSearchBrand = keyof typeof BRAND_MARKS;

export interface WebSearchSource {
  title: string;
  domain: string;
  brand?: WebSearchBrand;
  icon?: ReactNode;
  href?: string;
}

export interface WebSearchStep {
  /** Stable host call identity, independent of order or display text. */
  id?: string;
  status?: 'running' | 'completed' | 'failed' | 'waiting' | 'stopped' | 'unknown';
  details?: ReactNode;
  label: string;
  query?: string;
  brand?: WebSearchBrand;
  icon?: ComponentType<Pick<SVGProps<SVGSVGElement>, 'className' | 'aria-hidden'>>;
  meta?: string;
  /** The first heading is rendered above the connected tree. */
  heading?: boolean;
  /** Milliseconds to keep this step active before the next reveal. */
  dwell?: number;
  sources?: readonly WebSearchSource[];
}

export interface WebSearchProps {
  /** Production state comes from the host, never from animation completion. */
  state?: 'running' | 'completed' | 'failed' | 'waiting' | 'stopped' | 'unknown';
  elapsedMs?: number;
  onSourceOpen?: (source: WebSearchSource) => void;
  sourcesLabel?: string;
  ariaLabel?: string;
  steps: readonly WebSearchStep[];
  /** Pause or resume automatic reveal. Defaults to true. */
  run?: boolean;
  stepInterval?: number;
  startDelay?: number;
  /** Controlled visible row count. A sources group counts as an extra row. */
  revealed?: number;
  working?: string | false;
  onComplete?: () => void;
  className?: string;
}
