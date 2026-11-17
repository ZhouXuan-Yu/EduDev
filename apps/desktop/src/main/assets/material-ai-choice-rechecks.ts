import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {PRINTED_CHOICE_ANSWER} from '../../shared/material-ai-choice-answer';
import {CHOICE_CONCORDANCE} from '../../shared/material-ai-choice';
import type {AiPagePrompt} from '../../shared/material-ai-page';
import type {BookFinalReferences} from '../../shared/material-ai-book-reference';
import {PRINTED_FILL_SLOTS} from '../../shared/material-answer-slots';
import {readAiPageReceipt} from './material-ai-page-evidence';
import {readPageCrops,type PageCrop} from './material-ai-page-crops';
import {followingPageStatus} from './material-ai-page-source';
import {planAiPageQuestion,type AiPagePublishArgs} from './material-ai-page-publish';
import {teacherOwnsRuleQuestion} from './material-rule-protection';

type Row = Record<string, unknown>;
type Value = string | number | null;
type Proof = Awaited<ReturnType<typeof readAiPageReceipt>> & {bookReferences?: BookFinalReferences; bookAnswerPolicy?: typeof PRINTED_FILL_SLOTS};
type Host = {all: (sql: string, values?: Value[]) => Promise<Row[]>; run: (sql: string, values?: Value[]) => Promise<void>; root?: () => string; proof: (batch: string, ordinal: number) => Promise<Proof>};
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const CHOICE_RECHECK_TABLE = `CREATE TABLE IF NOT EXISTS material_ai_choice_rechecks(
  question_id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,number TEXT NOT NULL,
  policy TEXT NOT NULL,proof_sha TEXT NOT NULL,before_json TEXT NOT NULL,after_archive_json TEXT NOT NULL,created_at TEXT NOT NULL)`;
const archive = "CASE WHEN json_valid(q.archive_json) THEN q.archive_json ELSE '{}' END";
const candidates = `FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id
  JOIN material_ai_units u ON u.batch_id=m.batch_id AND u.ordinal=m.ordinal
  WHERE m.batch_id=? AND u.status='review' AND q.created_at=q.updated_at
    AND json_extract(${archive},'$.state')='ai_needs_review'
    AND json_extract(${archive},'$.ai.policy')='page-crop-complete.v1'
    AND json_type(${archive},'$.sourceChecked')='false'
    AND json_array_length(${archive},'$.issues')=1 AND json_extract(${archive},'$.issues[0]')='answer_conflict'
    AND NOT EXISTS(SELECT 1 FROM material_ai_choice_rechecks a WHERE a.question_id=q.id)
    AND NOT EXISTS(SELECT 1 FROM question_notebook_bookmarks b WHERE b.question_id=q.id AND b.bookmarked=1)
    AND NOT EXISTS(SELECT 1 FROM question_notebook_category_links c WHERE c.question_id=q.id)
    AND NOT EXISTS(SELECT 1 FROM question_bank_usage usage WHERE usage.question_id=q.id)`;
const fields = {stem:'stem',answer:'answer',analysis:'analysis',subject:'subject',grade:'grade',knowledgePoint:'knowledge_point',questionType:'question_type',difficulty:'difficulty'} as const;

function comparedPrompt(prompt?: AiPagePrompt): AiPagePrompt | undefined {
  if (prompt?.policy !== 'page-fragments.v3' || prompt.choiceReviewPolicy !== CHOICE_CONCORDANCE) return;
  return {...prompt, choiceAnswerPolicy: PRINTED_CHOICE_ANSWER};
}
function proofSha(proof: Proof, number: string, crops: PageCrop[]) {
  return hash([proof.unit,proof.config,proof.firstSha,proof.finalSha,proof.imageSha,proof.review,proof.bookReferences,proof.bookAnswerPolicy,crops.find(crop => crop.number === number)]);
}
function sameFields(row: Row, model: AiPagePublishArgs['final']['questions'][number]) {
  return Object.entries(fields).every(([field, column]) => row[column] === model[field as keyof typeof fields]);
}
function plans(args: AiPagePublishArgs, number: string) {
  const model = args.final.questions.find(question => question.number === number), prompt = comparedPrompt(args.pagePrompt);
  if (!model || !prompt) return;
  const before = planAiPageQuestion(args, model), after = planAiPageQuestion({...args, pagePrompt:prompt}, model);
  if (before.archive.state !== 'ai_needs_review' || before.archive.issues.length !== 1 || before.archive.issues[0] !== 'answer_conflict' || after.archive.state !== 'ai_final' || after.archive.ai?.policy !== 'page-crop-complete.v1' || !after.document || JSON.stringify(before.document) !== JSON.stringify(after.document)) return;
  return {model,before,after,prompt};
}

/** Bounded local classification over immutable responses; no provider or second executor. */
export class MaterialChoiceRechecks {
  constructor(private host: Host) {}
  async view(batchId: string) {
    const candidate = (await this.host.all(`SELECT COUNT(*) n ${candidates}`, [batchId]))[0];
    const applied = (await this.host.all('SELECT COUNT(*) n FROM material_ai_choice_rechecks WHERE batch_id=?', [batchId]))[0];
    return {candidates:process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS==='0'?0:Number(candidate?.n||0),applied:Number(applied?.n||0)};
  }
  private async args(batchId: string, ordinal: number, proof: Proof, crops: PageCrop[]): Promise<AiPagePublishArgs> {
    const row = (await this.host.all('SELECT first_json,final_json FROM material_ai_units WHERE batch_id=? AND ordinal=?', [batchId,ordinal]))[0];
    if (!row || typeof row.first_json !== 'string' || typeof row.final_json !== 'string') throw Error('source_changed');
    const source = proof.unit.pageSource!;
    const following = await followingPageStatus(this.host,source,proof.unit.pagePrompt&&'totalPages' in proof.unit.pagePrompt?proof.unit.pagePrompt.totalPages:source.page);
    return {batchId,ordinal,source,sources:proof.unit.sources,originalQuestions:[],firstRaw:row.first_json,finalRaw:row.final_json,first:proof.first,final:proof.final,review:proof.review,imageSha:proof.imageSha,title:'',model:proof.config.model,pagePrompt:proof.unit.pagePrompt,crops,following,bookReferences:proof.bookReferences,bookAnswerPolicy:proof.bookAnswerPolicy};
  }
  /** Called within the application's writer transaction, capped at twenty source candidates. */
  async apply(batchId: string) {
    if (process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS === '0') throw Error('unsupported');
    const rows = await this.host.all(`SELECT q.*,m.ordinal recheck_ordinal,m.number recheck_number ${candidates} ORDER BY m.ordinal,m.number LIMIT 20`, [batchId]);
    const contexts = new Map<number,{proof:Proof;crops:PageCrop[];args:AiPagePublishArgs}>();
    let applied = 0;
    for (const row of rows) {
      const ordinal = Number(row.recheck_ordinal), number = String(row.recheck_number);
      let context = contexts.get(ordinal);
      if (!context) {
        const proof = await this.host.proof(batchId,ordinal);
        if (!proof.unit.pageSource || proof.unit.pagePrompt?.policy !== 'page-fragments.v3' || proof.unit.pagePrompt.choiceAnswerPolicy) continue;
        const raw = (await this.host.all('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=?', [batchId,ordinal]))[0];
        const crops = await readPageCrops(this.host,batchId,ordinal,proof.unit.pageSource,proof.first,String(raw.first_json),proof.imageSha,new AbortController().signal,undefined,proof.unit.pagePrompt);
        context = {proof,crops,args:await this.args(batchId,ordinal,proof,crops)};
        contexts.set(ordinal,context);
      }
      const plan = plans(context.args,number);
      if (!plan || row.archive_json !== JSON.stringify(plan.before.archive) || row.document_json !== JSON.stringify(plan.before.document) || !sameFields(row,plan.model) || await teacherOwnsRuleQuestion(this.host,String(row.id))) continue;
      const {recheck_ordinal:_,recheck_number:__,...before} = row;
      await this.host.run(`INSERT INTO material_ai_choice_rechecks(question_id,batch_id,ordinal,number,policy,proof_sha,before_json,after_archive_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
      [String(row.id),batchId,ordinal,number,PRINTED_CHOICE_ANSWER,proofSha(context.proof,number,context.crops),JSON.stringify(before),JSON.stringify(plan.after.archive),new Date().toISOString()]);
      // Deliberately retain the exact model fields, document bytes and their original timestamps.
      await this.host.run('UPDATE question_bank_items SET archive_json=? WHERE id=? AND archive_json=? AND document_json=?', [JSON.stringify(plan.after.archive),String(row.id),String(row.archive_json),String(row.document_json)]);
      const current = (await this.host.all('SELECT archive_json FROM question_bank_items WHERE id=?', [String(row.id)]))[0];
      if (current?.archive_json !== JSON.stringify(plan.after.archive)) throw Error('conflict');
      applied++;
    }
    for (const [ordinal,context] of contexts) {
      const current = await this.host.proof(batchId,ordinal);
      const crops = await readPageCrops(this.host,batchId,ordinal,current.unit.pageSource!,current.first,context.args.firstRaw,current.imageSha,new AbortController().signal,undefined,current.unit.pagePrompt);
      for (const number of context.proof.final.questions.map(question => question.number)) {
        if (proofSha(current,number,crops) !== proofSha(context.proof,number,context.crops)) throw Error('source_changed');
      }
    }
    return applied;
  }
  /** Audit absence preserves the old policy. An audited classification is independently rederived. */
  async promptFor(question: QuestionBankItem, proof: Proof, crops: PageCrop[], following: AiPagePublishArgs['following']) {
    const row = (await this.host.all('SELECT * FROM material_ai_choice_rechecks WHERE question_id=?', [question.id]))[0];
    if (!row) return proof.unit.pagePrompt;
    const receipt = question.archive?.ai, number = question.archive?.number;
    if (!receipt || !number || row.batch_id !== receipt.batchId || Number(row.ordinal) !== receipt.ordinal || row.number !== number || row.policy !== PRINTED_CHOICE_ANSWER || row.proof_sha !== proofSha(proof,number,crops) || proof.unit.pagePrompt?.policy !== 'page-fragments.v3' || proof.unit.pagePrompt.choiceAnswerPolicy) throw Error('source_changed');
    const args = {...await this.args(receipt.batchId,receipt.ordinal,proof,crops),following};
    const plan = plans(args,number);
    let before: Row;
    try {before=JSON.parse(String(row.before_json));} catch {throw Error('source_changed');}
    if (!plan || before.id !== question.id || before.created_at !== before.updated_at || before.archive_json !== JSON.stringify(plan.before.archive) || before.document_json !== JSON.stringify(plan.before.document) || !sameFields(before,plan.model) || row.after_archive_json !== JSON.stringify(plan.after.archive)) throw Error('source_changed');
    return plan.prompt;
  }
}
