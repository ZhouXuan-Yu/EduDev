// User-visible office state. The private Codex transcript remains authoritative.
export type OfficeRunStatus = 'running' | 'waiting_input' | 'waiting_approval' | 'completed' | 'interrupted' | 'failed';
export interface OfficeProjectedItem {
  id: string;
  kind: 'message' | 'tool' | 'plan' | 'compaction' | 'memory_isolation' | 'skill_isolation';
  role?: 'user' | 'assistant';
  phase?: 'commentary' | 'final_answer' | 'partial_answer';
  text?: string;
  label?: string;
  status?: string;
  durationMs?: number;
  /** Public event order only, never SDK-private transcript order. */
  traceSequence?: number;
  resultSummary?: { version: 1; text: string; count?: number; query?: string; scope: 'discovery' | 'read' | 'operation' };
  truncated?: boolean;
  sources?: import('./xiaozhi-web').XiaozhiPublicSource[];
  webError?: import('./xiaozhi-web').XiaozhiWebError;
  webEmpty?: boolean;
  imageDelivery?: import('./xiaozhi-public-images').PublicImageDelivery;
  browserCapture?: import('./xiaozhi-browser-capture').BrowserCapture;
  attachments?: import('./xiaozhi-attachments').XiaozhiAttachment[];
}
export interface OfficeProjectedTurn {
  id: string;
  status: OfficeRunStatus;
  items: OfficeProjectedItem[];
  error?: string;
  /** Main-measured actual active + waiting time; absent in older history. */
  elapsedMs?: number;
  /** Wall time from first public preparing event to the host terminal decision. */
  traceElapsedMs?: number;
  /** First main-owned preparing event; never inferred from message wording. */
  startedAt?: number;
  activity?: { stage: 'preparing' | 'waiting_model' | 'responding'; since: number };
  publicStages?: OfficePublicStage[];
  publicStagesOmitted?: number;
  /** Only text actually returned by the provider reasoning channel; independent of answer/export. */
  modelReasoning?: OfficeModelReasoning[];
}
export interface OfficeModelReasoning {
  id: string;
  source: 'provider';
  text: string;
  status: 'streaming' | 'completed' | 'interrupted' | 'failed';
  /** First reasoning delta, not request dispatch or network wait. */
  startedAt: number;
  durationMs: number;
  truncated?: boolean;
}
export interface OfficePublicStage {
  stage: 'preparing' | 'waiting_model' | 'responding';
  since: number;
  sequence?: number;
}
export interface OfficeProjection {
  schemaVersion: 'xiaozhi.office.projection.v1';
  threadId: string;
  provider: 'deepseek';
  model: string;
  epoch: number;
  sourceSequence: number;
  needsHydration: boolean;
  hasMoreHistory: boolean;
  turns: OfficeProjectedTurn[];
}
