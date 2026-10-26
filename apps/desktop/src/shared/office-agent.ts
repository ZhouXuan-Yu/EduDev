// User-visible office state. The private Codex transcript remains authoritative.
export type OfficeRunStatus = 'running' | 'waiting_input' | 'waiting_approval' | 'completed' | 'interrupted' | 'failed';
export interface OfficeProjectedItem {
  id: string;
  kind: 'message' | 'tool' | 'plan' | 'compaction' | 'memory_isolation' | 'skill_isolation';
  role?: 'user' | 'assistant';
  phase?: 'commentary' | 'final_answer';
  text?: string;
  label?: string;
  plan?:import('./xiaozhi-agent').XiaozhiControl;
  status?: string;
  durationMs?: number;
  truncated?: boolean;
  sources?: import('./xiaozhi-web').XiaozhiPublicSource[];
  webError?: import('./xiaozhi-web').XiaozhiWebError;
  webEmpty?: boolean;
  toolAttempt?: import('./xiaozhi-tool-attempt').XiaozhiToolAttempt;
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
  /** Absent in historical records means unknown, not verified. */
  verification?: import('./xiaozhi-verification').TaskVerification;
  recovery?: import('./xiaozhi-recovery').XiaozhiRecovery;
  task?:import('./xiaozhi-task').TaskView;
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
