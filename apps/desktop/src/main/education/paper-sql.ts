import type {QuestionBankItem} from '../../shared/contracts';
import type {PaperSelectionHost} from './paper-selection';
import type {TemplateMaterials} from './paper-template-source';

export type PaperRow = Record<string, unknown>;
export type PaperSql = PaperSelectionHost & {
  all: (sql: string, params?: (string | number | null)[]) => Promise<PaperRow[]>;
  run: (sql: string, params?: (string | number | null)[]) => Promise<unknown>;
  /** Main-only source reader bound to this SQL connection, never the outer store. */
  templateMaterials?: TemplateMaterials;
};
export function paperTemplateMaterials(sql: PaperSql): TemplateMaterials {
  if (!sql.templateMaterials) throw new Error('configuration');
  return sql.templateMaterials;
}
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
