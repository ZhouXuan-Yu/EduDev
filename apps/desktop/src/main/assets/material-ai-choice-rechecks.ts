import {SOURCE_LAYOUT_TEXT} from '../../shared/material-ai-source-layout';
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
    AND json_type(${archive},'$.sourceChecked')='false'
    AND NOT EXISTS(SELECT 1 FROM material_ai_choice_rechecks a WHERE a.question_id=q.id)
    AND NOT EXISTS(SELECT 1 FROM question_notebook_bookmarks b WHERE b.question_id=q.id AND b.bookmarked=1)
    AND NOT EXISTS(SELECT 1 FROM question_notebook_category_links c WHERE c.question_id=q.id)
    AND NOT EXISTS(SELECT 1 FROM question_bank_usage usage WHERE usage.question_id=q.id)`;
type Mode = 'choice' | 'layout';
const policyFor = (mode: Mode) => mode === 'layout' ? SOURCE_LAYOUT_TEXT : PRINTED_CHOICE_ANSWER;
const candidateQuery = (mode: Mode) => candidates + (mode === 'choice'
  ? ` AND json_extract(${archive},'$.ai.policy')='page-crop-complete.v1' AND json_array_length(${archive},'$.issues')=1 AND json_extract(${archive},'$.issues[0]')='answer_conflict'`
  : ` AND json_extract(${archive},'$.ai.policy')='page-image-complete.v1' AND q.document_json=''
      AND json_extract(CASE WHEN json_valid(u.input_json) THEN u.input_json ELSE '{}' END,'$.pagePrompt.sourceContentPolicy')='source-content-roles.v1'
      AND json_extract(CASE WHEN json_valid(u.input_json) THEN u.input_json ELSE '{}' END,'$.pagePrompt.sourceReadingPolicy')='crop-source-reading.v1'
      AND json_extract(CASE WHEN json_valid(u.input_json) THEN u.input_json ELSE '{}' END,'$.pagePrompt.sourceLayoutPolicy') IS NULL
      AND EXISTS(SELECT 1 FROM json_each(${archive},'$.issues') WHERE value='ai_mismatch')
      AND NOT EXISTS(SELECT 1 FROM json_each(${archive},'$.issues') WHERE value='uncertain_ocr')`);
const documentJson = (document: ReturnType<typeof planAiPageQuestion>['document']) => document ? JSON.stringify(document) : '';
const fields = {stem:'stem',answer:'answer',analysis:'analysis',subject:'subject',grade:'grade',knowledgePoint:'knowledge_point',questionType:'question_type',difficulty:'difficulty'} as const;

function comparedPrompt(prompt?: AiPagePrompt, mode: Mode = 'choice'): AiPagePrompt | undefined {
  if (prompt?.policy !== 'page-fragments.v3' || prompt.choiceReviewPolicy !== CHOICE_CONCORDANCE) return;
  if (mode === 'layout' && (!prompt.sourceReadingPolicy || !prompt.sourceContentPolicy)) return;
  return {...prompt, choiceAnswerPolicy: PRINTED_CHOICE_ANSWER,...(mode==='layout'?{sourceLayoutPolicy:SOURCE_LAYOUT_TEXT}:{})};
}
function proofSha(proof: Proof, number: string, crops: PageCrop[]) {
  return hash([proof.unit,proof.config,proof.firstSha,proof.finalSha,proof.imageSha,proof.review,proof.bookReferences,proof.bookAnswerPolicy,crops.find(crop => crop.number === number)]);
}
function sameFields(row: Row, model: AiPagePublishArgs['final']['questions'][number]) {
  return Object.entries(fields).every(([field, column]) => row[column] === model[field as keyof typeof fields]);
}
function plans(args: AiPagePublishArgs, number: string, mode: Mode = 'choice') {
  const model = args.final.questions.find(question => question.number === number), prompt = comparedPrompt(args.pagePrompt,mode);
  if (!model || !prompt) return;
  const before = planAiPageQuestion(args, model), after = planAiPageQuestion({...args, pagePrompt:prompt}, model);
  if (before.archive.state !== 'ai_needs_review' || after.archive.ai?.policy !== 'page-crop-complete.v1' || !after.document) return;
  if (mode === 'choice' && (before.archive.issues.length !== 1 || before.archive.issues[0] !== 'answer_conflict' || after.archive.state !== 'ai_final' || documentJson(before.document) !== documentJson(after.document))) return;
  if (mode === 'layout' && (before.document || before.archive.issues.includes('uncertain_ocr') || after.archive.issues.length >= before.archive.issues.length || after.archive.issues.some(issue => !before.archive.issues.includes(issue) || ['ai_mismatch','requires_image'].includes(issue)))) return;
  return {model,before,after,prompt};
}

/** Bounded local classification over immutable responses; no provider or second executor. */
export class MaterialChoiceRechecks {
  constructor(private host: Host) {}
  async view(batchId: string) {
    const count = async (mode: Mode) => Number((await this.host.all(`SELECT COUNT(*) n ${candidateQuery(mode)}`, [batchId]))[0]?.n || 0);
    const applied = async (mode: Mode) => Number((await this.host.all('SELECT COUNT(*) n FROM material_ai_choice_rechecks WHERE batch_id=? AND policy=?', [batchId,policyFor(mode)]))[0]?.n || 0);
    return {candidates:process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS==='0'?0:await count('choice'),applied:await applied('choice'),layoutCandidates:process.env.OMNI_EDU_AI_SOURCE_LAYOUT==='0'||process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS==='0'?0:await count('layout'),layoutApplied:await applied('layout')};
  }
  private async args(batchId: string, ordinal: number, proof: Proof, crops: PageCrop[]): Promise<AiPagePublishArgs> {
    const row = (await this.host.all('SELECT first_json,final_json FROM material_ai_units WHERE batch_id=? AND ordinal=?', [batchId,ordinal]))[0];
    if (!row || typeof row.first_json !== 'string' || typeof row.final_json !== 'string') throw Error('source_changed');
    const source = proof.unit.pageSource!;
    const following = await followingPageStatus(this.host,source,proof.unit.pagePrompt&&'totalPages' in proof.unit.pagePrompt?proof.unit.pagePrompt.totalPages:source.page);
    return {batchId,ordinal,source,sources:proof.unit.sources,originalQuestions:[],firstRaw:row.first_json,finalRaw:row.final_json,first:proof.first,final:proof.final,review:proof.review,imageSha:proof.imageSha,title:'',model:proof.config.model,pagePrompt:proof.unit.pagePrompt,crops,following,bookReferences:proof.bookReferences,bookAnswerPolicy:proof.bookAnswerPolicy};
  }
  /** Called within the application's writer transaction, capped at twenty source candidates. */
  async apply(batchId: string, mode: Mode = 'choice') {
    if (process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS === '0' || mode==='layout'&&process.env.OMNI_EDU_AI_SOURCE_LAYOUT==='0') throw Error('unsupported');
    const rows = await this.host.all(`SELECT q.*,m.ordinal recheck_ordinal,m.number recheck_number ${candidateQuery(mode)} ORDER BY m.ordinal,m.number LIMIT 20`, [batchId]);
    const contexts = new Map<number,{proof:Proof;crops:PageCrop[];args:AiPagePublishArgs}>();
    let applied = 0;
    for (const row of rows) {
      const ordinal = Number(row.recheck_ordinal), number = String(row.recheck_number);
      let context = contexts.get(ordinal);
      if (!context) {
        const proof = await this.host.proof(batchId,ordinal);
        if (!proof.unit.pageSource || proof.unit.pagePrompt?.policy !== 'page-fragments.v3' || (mode==='choice'?proof.unit.pagePrompt.choiceAnswerPolicy:proof.unit.pagePrompt.sourceLayoutPolicy)) continue;
        const raw = (await this.host.all('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=?', [batchId,ordinal]))[0];
        const crops = await readPageCrops(this.host,batchId,ordinal,proof.unit.pageSource,proof.first,String(raw.first_json),proof.imageSha,new AbortController().signal,undefined,proof.unit.pagePrompt);
        context = {proof,crops,args:await this.args(batchId,ordinal,proof,crops)};
        contexts.set(ordinal,context);
      }
      const plan = plans(context.args,number,mode);
      if (!plan || row.archive_json !== JSON.stringify(plan.before.archive) || row.document_json !== documentJson(plan.before.document) || !sameFields(row,plan.model) || await teacherOwnsRuleQuestion(this.host,String(row.id))) continue;
      const {recheck_ordinal:_,recheck_number:__,...before} = row;
      await this.host.run(`INSERT INTO material_ai_choice_rechecks(question_id,batch_id,ordinal,number,policy,proof_sha,before_json,after_archive_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
      [String(row.id),batchId,ordinal,number,policyFor(mode),proofSha(context.proof,number,context.crops),JSON.stringify(before),JSON.stringify(plan.after.archive),new Date().toISOString()]);
      // Retain exact model fields and timestamps. The layout policy derives a missing source document.
      await this.host.run('UPDATE question_bank_items SET archive_json=?,document_json=? WHERE id=? AND archive_json=? AND document_json=?', [JSON.stringify(plan.after.archive),documentJson(plan.after.document),String(row.id),String(row.archive_json),String(row.document_json)]);
      const current = (await this.host.all('SELECT archive_json,document_json FROM question_bank_items WHERE id=?', [String(row.id)]))[0];
      if (current?.archive_json !== JSON.stringify(plan.after.archive) || current.document_json !== documentJson(plan.after.document)) throw Error('conflict');
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
    const mode: Mode = row.policy === SOURCE_LAYOUT_TEXT ? 'layout' : 'choice';
    if (!receipt || !number || row.batch_id !== receipt.batchId || Number(row.ordinal) !== receipt.ordinal || row.number !== number || row.policy !== policyFor(mode) || row.proof_sha !== proofSha(proof,number,crops) || proof.unit.pagePrompt?.policy !== 'page-fragments.v3' || (mode==='choice'?proof.unit.pagePrompt.choiceAnswerPolicy:proof.unit.pagePrompt.sourceLayoutPolicy)) throw Error('source_changed');
    const args = {...await this.args(receipt.batchId,receipt.ordinal,proof,crops),following};
    let before: Row;
    try {before=JSON.parse(String(row.before_json));} catch {throw Error('source_changed');}
    if (before.id !== question.id || before.created_at !== before.updated_at) throw Error('source_changed');
    // A later page may become readable after this question's conservative review
    // was archived. Reproduce the exact saved before/after plans without silently
    // advancing its state. Current boundary guards remain in validateSource.
    const boundaries: AiPagePublishArgs['following'][] = mode === 'layout' ? ['separate','continued','unknown'] : [following];
    const plan = boundaries.map(boundary => plans({...args,following:boundary},number,mode)).find(candidate => candidate
      && before.archive_json === JSON.stringify(candidate.before.archive)
      && before.document_json === documentJson(candidate.before.document)
      && sameFields(before,candidate.model)
      && row.after_archive_json === JSON.stringify(candidate.after.archive));
    if (!plan) throw Error('source_changed');
    return plan.prompt;
  }
}
