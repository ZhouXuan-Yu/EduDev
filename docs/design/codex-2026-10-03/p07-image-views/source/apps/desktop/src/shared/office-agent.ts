// User-visible office state. The private Codex transcript remains authoritative.
export type OfficeRunStatus = 'running' | 'waiting_input' | 'waiting_approval' | 'completed' | 'interrupted' | 'failed';
export interface OfficeProjectedItem {
  id: string;
  kind: 'message' | 'tool' | 'plan' | 'compaction' | 'memory_isolation' | 'skill_isolation';
  role?: 'user' | 'assistant';
  phase?: 'commentary' | 'final_answer';
  text?: string;
  label?: string;
  status?: string;
  durationMs?: number;
  truncated?: boolean;
  sources?: import('./xiaozhi-web').XiaozhiPublicSource[];
  webError?: import('./xiaozhi-web').XiaozhiWebError;
  webEmpty?: boolean;
  imageDelivery?: import('./xiaozhi-public-images').PublicImageDelivery;
  attachments?: import('./xiaozhi-attachments').XiaozhiAttachment[];
}
export interface OfficeProjectedTurn {
  id: string;
  status: OfficeRunStatus;
  items: OfficeProjectedItem[];
  error?: string;
  /** Main-measured actual active + waiting time; absent in older history. */
  elapsedMs?: number;
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
