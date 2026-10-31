import {MaterialBookAnswerWork} from './material-book-answer-work';
import {createHash,randomUUID} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {QUESTION_BOOK_ARCHIVE_SCHEMA,QUESTION_BOOK_EVIDENCE_SCHEMA,MATERIAL_BOOK_MATCH_SCHEMA,validBookMatchQuery,type BookMatchQuery,type BookMatchRow,type BookMatchView} from '../../shared/question-book-answer';
import {validQuestionArchive,archiveEligible} from '../../shared/question-archive';
import {sameMaterialBookIdentity,type MaterialBookRole} from '../../shared/material-book-pair';
import {aiTextSignature} from '../../shared/material-ai-image';
import {questionVersion} from '../education/question-context-provider';
import {bookAnswerPage,bookSectionKey} from './material-book-answer-content';
import {MaterialBookAnswerIndex} from './material-book-answer-index';
import type {readAiPageReceipt} from './material-ai-page-evidence';
type Row=Record<string,unknown>;type Value=string|number|null;type Proof=Awaited<ReturnType<typeof readAiPageReceipt>>;
type Host={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;role:(id:string)=>Promise<MaterialBookRole|null>;receipt:(batch:string,ordinal:number)=>Promise<Proof>;read:(id:string)=>Promise<QuestionBankItem|undefined>;validate:(q:QuestionBankItem)=>Promise<void>;title:(id:string)=>Promise<string>;writer:<T>(fn:(target:MaterialBookAnswerRepository)=>Promise<T>,beforeCommit?:()=>void)=>Promise<T>};
type Evidence={pair:MaterialBookRole;question:{batchId:string;ordinal:number};answer:{batchId:string;ordinal:number;start:number;firstSha:string;finalSha:string;imageSha:string};section:string;number:string};
const hash=(text:string)=>createHash('sha256').update(text).digest('hex'),roles=['answer','analysis'] as const;
const metadata=new Set(['missing_answer','missing_analysis','missing_subject','missing_grade','missing_knowledge','missing_type','missing_difficulty']);
/** Matching and fact publication reuse the existing host writer. No model requests or additional executor. */
export class MaterialBookAnswerRepository{
 readonly index:MaterialBookAnswerIndex;
 readonly work:MaterialBookAnswerWork;
 constructor(private host:Host){this.index=new MaterialBookAnswerIndex(host);this.work=new MaterialBookAnswerWork(host);}
 async migrate(){await this.host.run("CREATE TABLE IF NOT EXISTS material_book_answer_journal_v1(id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,question_id TEXT NOT NULL,batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,payload_json TEXT NOT NULL,evidence_json TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL DEFAULT '')");await this.host.run('CREATE INDEX IF NOT EXISTS material_book_answer_journal_page_v1 ON material_book_answer_journal_v1(batch_id,ordinal)');await this.index.migrate();await this.work.migrate();}
 async rebuild(){await this.host.writer(t=>t.index.rebuild());}
 async indexOne(){if(!await this.index.pending())return false;return this.host.writer(target=>target.index.applyOne());}
 async list(input:BookMatchQuery):Promise<BookMatchView>{if(!validBookMatchQuery(input))throw Error('invalid_input');const rows=await this.host.all('SELECT payload_json FROM material_book_answer_journal_v1 WHERE batch_id=? AND ordinal=? ORDER BY rowid DESC LIMIT 100',[input.batchId,input.ordinal]);const latest=new Map<string,BookMatchRow>();for(const row of rows){const value=JSON.parse(String(row.payload_json)) as BookMatchRow;if(!latest.has(value.questionId))latest.set(value.questionId,value);}for(const value of latest.values())if(value.state==='applied'){const q=await this.host.read(value.questionId);if(!q||questionVersion(q)!==value.afterVersion){value.state='conflict';value.reason='teacher_changed';}}const work=await this.work.state(input.batchId,input.ordinal);return{schemaVersion:MATERIAL_BOOK_MATCH_SCHEMA,rows:[...latest.values()].reverse(),indexPending:await this.index.pending(),automaticPending:!!work&&!work.error,automaticError:String(work?.error||'')};}
 async match(input:BookMatchQuery,signal=new AbortController().signal):Promise<BookMatchView>{
  signal.throwIfAborted();if(process.env.OMNI_EDU_BOOK_ANSWER_WRITEBACK==='0')throw Error('book_writeback_disabled');
  if(!validBookMatchQuery(input))throw Error('invalid_input');if(await this.index.pending())return this.list(input);
  const questionProof=await this.host.receipt(input.batchId,input.ordinal),source=questionProof.unit.pageSource;if(!source||questionProof.unit.bookRole?.kind==='answers')throw Error('unsupported');
  const pair=await this.host.role(source.resourceId);if(pair?.kind!=='questions'||pair.revision!==input.revision||pair.questionVersion!==source.version)throw Error('source_changed');
  const members=await this.host.all('SELECT question_id FROM material_ai_members WHERE batch_id=? AND ordinal=? ORDER BY rowid LIMIT 21',[input.batchId,input.ordinal]);if(members.length>20)throw Error('unit_too_large');
  const a=bookAnswerPage(questionProof.first,questionProof.first).entries,b=bookAnswerPage(questionProof.final,questionProof.final).entries;
  for(const member of members){
   signal.throwIfAborted();
   const q=await this.host.read(String(member.question_id));if(!q)continue;
   const matches=b.filter(e=>e.number===q.archive?.number&&e.section&&!e.issues.includes('duplicate_number')&&aiTextSignature(e.quote).includes(aiTextSignature(q.stem)));
   const entry=matches.length===1&&a.filter(e=>e.number===q.archive?.number&&e.sectionKey===matches[0].sectionKey).length===1?matches[0]:undefined;
   const found=entry?await this.index.find(pair.answerId,pair.answerVersion,entry.sectionKey,entry.number):[];
   await this.propose(input,q,questionProof,pair,entry?.section||'',found,signal);
  }
  return this.list(input);
 }
 private async propose(input:BookMatchQuery,snapshot:QuestionBankItem,questionProof:Proof,pair:MaterialBookRole,section:string,found:Row[],signal:AbortSignal){
  return this.host.writer(async target=>{
   signal.throwIfAborted();if(await target.index.pending())throw Error('busy');
   const currentPair=await target.host.role(pair.questionId);if(JSON.stringify(pair)!==JSON.stringify(currentPair))throw Error('source_changed');
   if(section){const current=await target.index.find(pair.answerId,pair.answerVersion,bookSectionKey(section),snapshot.archive?.number||'0');if(JSON.stringify(current)!==JSON.stringify(found))throw Error('source_changed');}
   const q=await target.host.read(snapshot.id);if(!q)throw Error('source_changed');
   const number=q.archive?.number||'0',key=hash(JSON.stringify([snapshot.id,questionVersion(snapshot),input,section,found.map(f=>[f.batch_id,f.ordinal,f.start])])),old=(await target.host.all('SELECT payload_json FROM material_book_answer_journal_v1 WHERE request_key=?',[key]))[0];if(old)return;
   const row:BookMatchRow={id:'bookanswer_'+randomUUID(),questionId:q.id,number,section,state:'held',reason:'',answer:'',analysis:'',beforeVersion:questionVersion(snapshot),afterVersion:''};
   const evidence:Evidence={pair,question:{batchId:input.batchId,ordinal:input.ordinal},answer:{batchId:'',ordinal:0,start:0,firstSha:'',finalSha:'',imageSha:''},section,number};
   let answerProof:Proof|undefined,answerEntry:ReturnType<typeof bookAnswerPage>['entries'][number]|undefined;
   if(questionVersion(q)!==row.beforeVersion){row.state='conflict';row.reason='source_changed';}
   else if(!section)row.reason='missing_section';else if(!found.length)row.reason='answer_not_found';else if(found.length!==1)row.reason='ambiguous_answer';
   else{
    const f=found[0];try{
     answerProof=await target.host.receipt(String(f.batch_id),Number(f.ordinal));
     if(!sameMaterialBookIdentity(answerProof.unit.bookRole,{...pair,kind:'answers'}))throw Error('source_changed');
     answerEntry=bookAnswerPage(answerProof.first,answerProof.final).entries.find(e=>e.start===Number(f.start)&&e.number===number&&e.sectionKey===String(f.section_key));if(!answerEntry)throw Error('source_changed');
     row.answer=answerEntry.answer;row.analysis=answerEntry.analysis;row.source={batchId:String(f.batch_id),ordinal:Number(f.ordinal),start:answerEntry.start,page:answerProof.unit.pageSource!.page,title:await target.host.title(pair.answerId)};
     evidence.answer={batchId:row.source.batchId,ordinal:row.source.ordinal,start:row.source.start,firstSha:answerProof.firstSha,finalSha:answerProof.finalSha,imageSha:answerProof.imageSha};
     await target.host.validate(q);
     const earlier=(await target.host.all('SELECT payload_json FROM material_book_answer_journal_v1 WHERE question_id=? AND after_json<>\'\' ORDER BY rowid DESC LIMIT 1',[q.id]))[0];
     if(earlier){const previous=JSON.parse(String(earlier.payload_json)) as BookMatchRow;if(previous.afterVersion===questionVersion(q)&&previous.source?.batchId===row.source.batchId&&previous.source.ordinal===row.source.ordinal&&previous.source.start===row.source.start)return;}
     row.reason=q.document||q.archive?.web||!q.archive?.ai||!q.archive.pageSource?'unsupported':q.archive.issues.some(i=>!metadata.has(i))||q.archive.sourceRisks.length?'question_unchecked':!answerEntry.agrees||answerEntry.issues.some(code=>code!=='missing_analysis')?'answer_unchecked':q.answer.trim()&&aiTextSignature(q.answer)!==aiTextSignature(row.answer)?'existing_answer_conflict':'';
    }catch(error){if(!(error instanceof Error)||!['source_changed','source_incomplete','privacy_blocked'].includes(error.message))throw error;row.reason='source_changed';}
   }
   let next:QuestionBankItem|undefined;
   if(!row.reason&&answerEntry&&row.source){
    const writable=roles.filter(r=>!!row[r]&&(!q[r].trim()&&q.archive?.[`${r}Origin`]==='missing'||q.archive?.[`${r}Origin`]==='ai_generated'));
    if(!writable.length)row.reason='protected_role';else{
     const archive=structuredClone(q.archive!);archive.schemaVersion=QUESTION_BOOK_ARCHIVE_SCHEMA;archive.extractor='book-answer-enriched.v1';archive.state='book_enriched';archive.book??={schemaVersion:QUESTION_BOOK_EVIDENCE_SCHEMA,roles:{}};next={...q,archive,updatedAt:new Date().toISOString()};
     for(const role of writable){if(!row[role])continue;next[role]=row[role];archive[`${role}Origin`]='book_extracted';archive.book.roles[role]={candidateId:row.id,questionSha:hash(q.stem),textSha:hash(row[role]),title:row.source.title,page:row.source.page,section,number};archive.issues=archive.issues.filter(code=>code!==`missing_${role}`);}
     if(!Object.keys(archive.book.roles).length){next=undefined;row.reason='no_change';}else if(!validQuestionArchive(archive))throw Error('invalid_input');
    }
   }
   await target.host.run('INSERT INTO material_book_answer_journal_v1(id,request_key,question_id,batch_id,ordinal,payload_json,evidence_json,before_json) VALUES(?,?,?,?,?,?,?,?)',[row.id,key,q.id,input.batchId,input.ordinal,JSON.stringify(row),JSON.stringify(evidence),JSON.stringify(q)]);
   signal.throwIfAborted();if(next){
    const fresh=await target.host.read(q.id);if(!fresh||questionVersion(fresh)!==row.beforeVersion||JSON.stringify(await target.host.role(pair.questionId))!==JSON.stringify(pair))throw Error('source_changed');
    // Reopen both source receipts inside the same writer transaction before publishing any canonical field.
    const checked=await target.host.receipt(input.batchId,input.ordinal),known=await target.host.receipt(evidence.answer.batchId,evidence.answer.ordinal);if(checked.firstSha!==questionProof.firstSha||checked.finalSha!==questionProof.finalSha||known.firstSha!==evidence.answer.firstSha||known.finalSha!==evidence.answer.finalSha||known.imageSha!==evidence.answer.imageSha)throw Error('source_changed');
    await target.host.run('UPDATE question_bank_items SET answer=?,analysis=?,archive_json=?,updated_at=? WHERE id=?',[next.answer,next.analysis,JSON.stringify(next.archive),next.updatedAt,q.id]);
    await target.host.run('UPDATE material_question_members SET needs_attention=? WHERE question_id=?',[archiveEligible(next)?0:1,q.id]);row.state='applied';row.afterVersion=questionVersion(next);
    await target.host.run('UPDATE material_book_answer_journal_v1 SET payload_json=?,after_json=? WHERE id=?',[JSON.stringify(row),JSON.stringify(next),row.id]);await target.host.validate(next);signal.throwIfAborted();
   }
  },()=>signal.throwIfAborted());
 }
 async drain(signal:AbortSignal){
  signal.throwIfAborted();if(await this.indexOne())return true;if(process.env.OMNI_EDU_BOOK_ANSWER_WRITEBACK==='0')return false;
  const job=await this.work.next();if(!job)return false;
  const input:BookMatchQuery={schemaVersion:MATERIAL_BOOK_MATCH_SCHEMA,batchId:String(job.batch_id),ordinal:Number(job.ordinal),revision:Number(job.revision)};
  try{await this.match(input,signal);signal.throwIfAborted();await this.host.writer(t=>t.work.finish(input.batchId,input.ordinal,input.revision));}
  catch(error){if(signal.aborted)throw error;const code=error instanceof Error?error.message:'';if(['busy','index_busy'].includes(code))throw error;await this.host.writer(t=>t.work.finish(input.batchId,input.ordinal,input.revision,['source_changed','source_incomplete','privacy_blocked','unsupported','unit_too_large'].includes(code)?code:'unavailable'));}
  return true;
 }
 async validate(q:QuestionBankItem){
  for(const role of roles){const proof=q.archive?.book?.roles[role];if(!proof)continue;
   const saved=(await this.host.all('SELECT * FROM material_book_answer_journal_v1 WHERE id=? AND question_id=?',[proof.candidateId,q.id]))[0];if(!saved||!saved.after_json||hash(q.stem)!==proof.questionSha||hash(q[role])!==proof.textSha)throw Error('source_changed');
   const row=JSON.parse(String(saved.payload_json)) as BookMatchRow,e=JSON.parse(String(saved.evidence_json)) as Evidence,before=JSON.parse(String(saved.before_json)) as QuestionBankItem,after=JSON.parse(String(saved.after_json)) as QuestionBankItem;
   if(row.state!=='applied'||row.beforeVersion!==questionVersion(before)||row.afterVersion!==questionVersion(after)||row[role]!==q[role]||JSON.stringify(after.archive?.book?.roles[role])!==JSON.stringify(proof))throw Error('source_changed');
   const receipt=await this.host.receipt(e.answer.batchId,e.answer.ordinal),entry=bookAnswerPage(receipt.first,receipt.final).entries.find(x=>x.start===e.answer.start);
   if(!sameMaterialBookIdentity(receipt.unit.bookRole,{...e.pair,kind:'answers'})||receipt.firstSha!==e.answer.firstSha||receipt.finalSha!==e.answer.finalSha||receipt.imageSha!==e.answer.imageSha||!entry||entry.section!==e.section||entry.number!==e.number||entry[role]!==q[role])throw Error('source_changed');
  }
 }
}
