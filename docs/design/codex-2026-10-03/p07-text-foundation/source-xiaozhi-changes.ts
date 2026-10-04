// Main-owned file facts. Renderer decisions never contain paths, content or hashes.
export type XiaozhiChangeState = 'pending' | 'approved' | 'executing' | 'applied'
  | 'rejected' | 'interrupted' | 'uncertain' | 'conflict' | 'reverting' | 'reverted'
  | 'undo_uncertain' | 'undo_conflict';
export type XiaozhiChangeOperation = 'create' | 'edit';
export type XiaozhiTextChange = {
  schemaVersion: 'xiaozhi.change.v1'; id: string; runId: string; callId: string;
  path: string; operation: XiaozhiChangeOperation; state: XiaozhiChangeState; revision: number;
  beforeSha256: string | null; afterSha256: string; diff: string; patch: string;
};
export type XiaozhiChangeReview = XiaozhiTextChange & { before: string | null; after: string };
export type XiaozhiChangeDecision = { schemaVersion: 'xiaozhi.change.v1'; sessionId: string;
  changeId: string; revision: number; action: 'approve' | 'reject' | 'verify' | 'undo' };
export type XiaozhiTextProposalInput = { operation: 'create'; path: string; content: string }
  | { operation: 'edit'; path: string; edits: { oldText: string; newText: string }[] };
