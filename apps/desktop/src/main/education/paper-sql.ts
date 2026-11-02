import type {QuestionBankItem} from '../../shared/contracts';
import type {PaperSelectionHost} from './paper-selection';

export type PaperRow = Record<string, unknown>;
export type PaperSql = PaperSelectionHost & {
  all: (sql: string, params?: (string | number | null)[]) => Promise<PaperRow[]>;
  run: (sql: string, params?: (string | number | null)[]) => Promise<unknown>;
};
export type ApprovedPaperGroup = {
  id: string;
  sessionId: string;
  subject: string;
  grade: string;
  title: string;
  generationKind: 'ai_original' | 'variation';
  effectDigest: string;
  questions: QuestionBankItem[];
};
export type PaperStoreHost = PaperSql & {
  approvedGenerations?: (sessionId: string, sql: PaperSql) => Promise<ApprovedPaperGroup[]>;
  transaction: <T>(work: (sql: PaperSql) => Promise<T>) => Promise<T>;
  readTransaction?: <T>(work: (sql: PaperSql) => Promise<T>) => Promise<T>;
};
