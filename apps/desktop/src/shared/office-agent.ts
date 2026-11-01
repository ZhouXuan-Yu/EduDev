// User-visible office state. The private Codex transcript remains authoritative.
export type OfficeRunStatus = 'running' | 'waiting_input' | 'waiting_approval' | 'completed' | 'interrupted' | 'failed';
export interface OfficeProjectedItem {
  id: string;
  kind: 'message' | 'tool' | 'plan' | 'compaction' | 'memory_isolation' | 'skill_isolation';
  role?: 'user' | 'assistant';
  phase?: 'commentary' | 'final_answer' | 'partial_answer';
  phaseSource?: 'explicit';
  text?: string;
  label?: string;
  /** Actual public tool identity, not inferred from its translated label. Optional in old history. */
  toolName?: string;
  plan?:import('./xiaozhi-agent').XiaozhiControl;
  status?: string;
  durationMs?: number;
  /** Public event order only, never SDK-private transcript order. */
  traceSequence?: number;
  traceOrder?: number;
  resultSummary?: { version: 1; text: string; count?: number; query?: string; scope: 'discovery' | 'read' | 'operation' };
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
  errorCode?:import('./xiaozhi-agent').XiaozhiAgentError;
  modelRequests?:import('./xiaozhi-model-request').XiaozhiModelRequest[];
  modelRequestsOmitted?:number;
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
  presentation?: import('./chat-presentation').ChatPresentation;
  /** Absent in historical records means unknown, not verified. */
  verification?: import('./xiaozhi-verification').TaskVerification;
  recovery?: import('./xiaozhi-recovery').XiaozhiRecovery;
  task?:import('./xiaozhi-task').TaskView;
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
  traceOrder?: number;
  traceSequence?: number;
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
