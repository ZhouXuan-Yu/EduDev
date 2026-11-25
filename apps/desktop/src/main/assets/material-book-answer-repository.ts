import {QUESTION_DOCUMENT_BOOK_SCHEMA,QUESTION_DOCUMENT_WEB_SCHEMA,questionDocumentSchemaForRoles,isCompleteQuestionDocument,validQuestionDocument,type QuestionDocument,type QuestionEvidence} from '../../shared/question-document';
import {QUESTION_BOOK_DOCUMENT_EVIDENCE} from '../../shared/question-book-document';
import {BOOK_SECTION_LAYOUT,bookSectionLookupKey} from '../../shared/material-book-section-layout';
import {SHANGHAI_MOCK_SECTIONS,WRAPPED_SHANGHAI_MOCK_SECTIONS,TERM_SHANGHAI_MOCK_SECTIONS,shanghaiMockSectionKey,type ShanghaiMockSectionPolicy,type ShanghaiMockSectionVersion} from '../../shared/shanghai-mock-sections';
import {MaterialBookAnswerWork,type PageBookJob} from './material-book-answer-work';
import {PRINTED_FILL_SLOTS,samePrintedFillAnswer} from '../../shared/material-answer-slots';
import {canResolveBookFillConflict} from './material-book-fill-recovery';
import {BOOK_ANSWER_CONFLICT_POLICY,migrateBookAnswerConflicts,quarantineBookAnswerConflict} from './material-book-answer-conflict';
import {createHash,randomUUID} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {QUESTION_BOOK_ARCHIVE_SCHEMA,QUESTION_BOOK_EVIDENCE_SCHEMA,MATERIAL_BOOK_MATCH_SCHEMA,STRUCTURE_BOOK_MATCH_SCHEMA,validAnyBookMatchQuery,type AnyBookMatchQuery,type BookMatchQuery,type BookMatchRow,type BookMatchView,type StructureBookMatchQuery} from '../../shared/question-book-answer';
import {validQuestionArchive,archiveEligible} from '../../shared/question-archive';
import {sameMaterialBookIdentity,sameMaterialAnswerSource,type MaterialBookRole} from '../../shared/material-book-pair';
import {aiTextSignature} from '../../shared/material-ai-image';
import {questionVersion} from '../education/question-context-provider';
import {bookAnswerPage,bookAnswerSectionReviewResolved,bookSectionAt,bookSectionKey} from './material-book-answer-content';
import {MaterialBookAnswerIndex} from './material-book-answer-index';
import {MaterialBookQuestionSection,type BookQuestionSectionEvidence,type BookAnswerSectionEvidence} from './material-book-question-section';
import type {readAiPageReceipt} from './material-ai-page-evidence';
import type {StructureBookScope} from './material-structure-book-scope';
import type {MockExamEntry} from '../../shared/mock-exam-compilation';
import {readMockExamAnswerReview} from './material-book-answer-review';
import type {StructureBookJob} from './material-structure-book-work';
import {assertStructureDraftEditable} from './material-structure-bank';
type Row=Record<string,unknown>;type Value=string|number|null;type Proof=Awaited<ReturnType<typeof readAiPageReceipt>>;
type Host={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;role:(id:string)=>Promise<MaterialBookRole|null>;receipt:(batch:string,ordinal:number)=>Promise<Proof>;read:(id:string)=>Promise<QuestionBankItem|undefined>;validate:(q:QuestionBankItem,signal:AbortSignal)=>Promise<void>;structureScope?:(q:QuestionBankItem,signal:AbortSignal,mockTitles?:ShanghaiMockSectionPolicy)=>Promise<StructureBookScope>;title:(id:string)=>Promise<string>;writer:<T>(fn:(target:MaterialBookAnswerRepository)=>Promise<T>,beforeCommit?:()=>void)=>Promise<T>};
type PageKey={batchId:string;ordinal:number};
type BookMatchJob=PageBookJob|StructureBookJob;
type QuestionProof={key:PageKey;receipt:Proof;context?:BookQuestionSectionEvidence}|{key:PageKey;structure:StructureBookScope};
const SHARED_EXAM_ANSWER='shared-exam-answer.v1' as const;
type Evidence={pair:MaterialBookRole;question:PageKey;answer:{batchId:string;ordinal:number;start:number;firstSha:string;finalSha:string;imageSha:string};section:string;number:string;lookupPolicy?:typeof BOOK_SECTION_LAYOUT;sectionProjection?:ShanghaiMockSectionVersion;questionSection?:BookQuestionSectionEvidence;structure?:StructureBookScope;answerSection?:BookAnswerSectionEvidence;slotRecoveryPolicy?:typeof PRINTED_FILL_SLOTS;answerSharing?:typeof SHARED_EXAM_ANSWER};
function checkAnswerPair(proof:Proof,pair:MaterialBookRole,section:string,share:boolean,mockTitles:ShanghaiMockSectionPolicy=true){
 const {bookRole,pageSource}=proof.unit;
 if(pageSource?.resourceId!==pair.answerId||pageSource.version!==pair.answerVersion)throw Error('source_changed');
 if(sameMaterialBookIdentity(bookRole,{...pair,kind:'answers'}))return;
 if(share&&shanghaiMockSectionKey(section,mockTitles)&&sameMaterialAnswerSource(bookRole,pair))return SHARED_EXAM_ANSWER;
 throw Error('source_changed');
}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex'),roles=['answer','analysis'] as const;
type Entries=ReturnType<typeof bookAnswerPage>['entries'];
function questionSection(q:QuestionBankItem,proof:Proof,a:Entries,b:Entries,context?:BookQuestionSectionEvidence,lookupPolicy?:typeof BOOK_SECTION_LAYOUT,mockTitles:ShanghaiMockSectionPolicy=false){
 const exact=!!q.document&&proof.final.questions.filter(p=>p.number===q.archive?.number&&p.stem===q.stem).length===1;
 const matches=b.filter(e=>e.number===q.archive?.number&&!e.issues.includes('duplicate_number')&&(exact||!q.document&&aiTextSignature(e.quote).includes(aiTextSignature(q.stem))));
 if(matches.length!==1)return{section:''};const entry=matches[0],first=a.filter(e=>e.number===entry.number&&bookSectionLookupKey(e.section,mockTitles,lookupPolicy===BOOK_SECTION_LAYOUT)===bookSectionLookupKey(entry.section,mockTitles,lookupPolicy===BOOK_SECTION_LAYOUT)&&!e.issues.includes('duplicate_number'));
 if(first.length!==1)return{section:''};
 const start=bookSectionAt(proof.first.pageText,first[0].start,mockTitles),end=bookSectionAt(proof.final.pageText,entry.start,mockTitles);
 if(entry.section)return{section:start!==''&&end!==''?entry.section:''};
 return context&&start===undefined&&end===undefined?{section:context.section,context}:{section:''};
}
function bookDocumentRole(candidateId:string,text:string,e:Evidence,proof:Proof,quote:string):QuestionEvidence{
 const source=proof.unit.pageSource;if(!source)throw Error('source_changed');
 return{origin:'book_extracted',text,anchors:[],book:{schemaVersion:QUESTION_BOOK_DOCUMENT_EVIDENCE,candidateId,source:structuredClone(source),batchId:e.answer.batchId,ordinal:e.answer.ordinal,firstSha:e.answer.firstSha,finalSha:e.answer.finalSha,imageSha:e.answer.imageSha,section:e.section,number:e.number,quoteSha:hash(quote)}};
}
const metadata=new Set(['missing_answer','missing_analysis','missing_subject','missing_grade','missing_knowledge','missing_type','missing_difficulty']);
/** Matching and fact publication reuse the existing host writer. No model requests or additional executor. */
export class MaterialBookAnswerRepository{
 readonly index:MaterialBookAnswerIndex;
 readonly work:MaterialBookAnswerWork;
 readonly sections:MaterialBookQuestionSection;
 private readonly examSections:MaterialBookQuestionSection;
 constructor(private host:Host){const enabled=()=>!!host.structureScope;this.index=new MaterialBookAnswerIndex(host,enabled);this.work=new MaterialBookAnswerWork(host,enabled);this.sections=new MaterialBookQuestionSection(host,this.index,false);this.examSections=new MaterialBookQuestionSection(host,this.index,true);}
 async migrate(){await this.host.run("CREATE TABLE IF NOT EXISTS material_book_answer_journal_v1(id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,question_id TEXT NOT NULL,batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,payload_json TEXT NOT NULL,evidence_json TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL DEFAULT '')");await this.host.run('CREATE INDEX IF NOT EXISTS material_book_answer_journal_page_v1 ON material_book_answer_journal_v1(batch_id,ordinal)');await this.host.run('CREATE INDEX IF NOT EXISTS material_book_answer_journal_question_v1 ON material_book_answer_journal_v1(batch_id,ordinal,question_id)');await this.index.migrate();await this.work.migrate();await migrateBookAnswerConflicts(this.host);}
 async rebuild(){await this.host.writer(t=>t.index.rebuild());}
 async pageView(proof:Proof,reference:{batchId:string;ordinal:number}){
  const raw={page:bookAnswerPage(proof.first,proof.final,undefined,proof.unit.bookPagePolicy,true),resolved:false};
  try{
   if(!proof.unit.pageSource||!sameMaterialBookIdentity(await this.host.role(proof.unit.pageSource.resourceId),proof.unit.bookRole))return raw;
   const {page,context}=await this.examSections.answerPage(proof);if(!context)return raw;
   await this.examSections.validateAnswer(context,proof,reference);
   return{page:{...page,sectionSource:{page:context.pages.at(-1)!.source.page,section:context.section}},resolved:proof.status==='review'&&bookAnswerSectionReviewResolved(proof.first,proof.final,page,proof.unit.bookPagePolicy,true)};
  }catch(error){if(error instanceof Error&&['source_changed','source_incomplete','privacy_blocked'].includes(error.message))return raw;throw error;}
 }
 async indexOne(){if(!await this.index.pending())return false;return this.host.writer(target=>target.index.applyOne());}
 paperReview(entry:MockExamEntry,signal:AbortSignal){return readMockExamAnswerReview(this.host,entry,signal);}
 async list(input:AnyBookMatchQuery):Promise<BookMatchView>{
  if(!validAnyBookMatchQuery(input))throw Error('invalid_input');
  const rows='questionId' in input
   ? await this.host.all("SELECT payload_json FROM material_book_answer_journal_v1 WHERE question_id=? AND batch_id LIKE 'structure:%' ORDER BY rowid DESC LIMIT 1",[input.questionId])
   : await this.host.all('SELECT j.payload_json FROM material_ai_members m JOIN material_book_answer_journal_v1 j ON j.rowid=(SELECT rowid FROM material_book_answer_journal_v1 WHERE batch_id=m.batch_id AND ordinal=m.ordinal AND question_id=m.question_id ORDER BY rowid DESC LIMIT 1) WHERE m.batch_id=? AND m.ordinal=? ORDER BY m.rowid LIMIT 20',[input.batchId,input.ordinal]);
  const latest=new Map<string,BookMatchRow>();
  for(const row of rows){const value=JSON.parse(String(row.payload_json)) as BookMatchRow;if(!latest.has(value.questionId))latest.set(value.questionId,value);}
  for(const value of latest.values())if(value.afterVersion){const q=await this.host.read(value.questionId);if(!q||questionVersion(q)!==value.afterVersion){value.state='conflict';value.reason='teacher_changed';}}
  const work='batchId' in input?await this.work.state(input.batchId,input.ordinal):this.host.structureScope?await this.work.structures.state(input.questionId):undefined;
  return{schemaVersion:MATERIAL_BOOK_MATCH_SCHEMA,rows:[...latest.values()],indexPending:await this.index.pending(),automaticPending:!!work&&!work.error,automaticError:String(work?.error||'')};
 }
 async match(input:AnyBookMatchQuery,signal=new AbortController().signal,job?:BookMatchJob):Promise<BookMatchView>{
  signal.throwIfAborted();if(process.env.OMNI_EDU_BOOK_ANSWER_WRITEBACK==='0')throw Error('book_writeback_disabled');
  if(!validAnyBookMatchQuery(input))throw Error('invalid_input');
  if(await this.index.pending()){if(job)throw Error('busy');return this.list(input);}
  if('questionId' in input){
   const q=await this.host.read(input.questionId);
   if(!q||!q.archive?.structure||!q.archive.sourceChecked||questionVersion(q)!==input.version)throw Error('source_changed');
   if(!isCompleteQuestionDocument(q.document)||!this.host.structureScope)throw Error('unsupported');
   const {resourceId,version}=q.archive.structure;
   const pair=await this.host.role(resourceId);
   if(!pair||pair.kind!=='questions'||pair.questionId!==resourceId||pair.questionVersion!==version)throw Error('book_pair_required');
   if(job&&(!('questionId' in job)||job.questionId!==q.id||job.resourceId!==resourceId||job.version!==version||job.pairRevision!==pair.revision))throw Error('source_changed');
   await assertStructureDraftEditable(this.host,q.id);
   await this.host.validate(q,signal);
   const structure=await this.host.structureScope(q,signal);
   const found=structure.section?await this.index.find(pair.answerId,pair.answerVersion,bookSectionKey(structure.section),q.archive.number):[];
   await this.propose(input,q,{key:{batchId:'structure:'+structure.reference.generation,ordinal:structure.page},structure},pair,structure.section,found,signal,job);
   return this.list(input);
  }
  if(job&&(!('batchId' in job)||job.batchId!==input.batchId||job.ordinal!==input.ordinal||job.revision!==input.revision))throw Error('source_changed');
  const questionProof=await this.host.receipt(input.batchId,input.ordinal),source=questionProof.unit.pageSource;if(!source||questionProof.unit.bookRole?.kind==='answers')throw Error('unsupported');
  const pair=await this.host.role(source.resourceId);if(pair?.kind!=='questions'||pair.revision!==input.revision||pair.questionVersion!==source.version)throw Error('source_changed');
  const members=await this.host.all('SELECT question_id FROM material_ai_members WHERE batch_id=? AND ordinal=? ORDER BY rowid LIMIT 21',[input.batchId,input.ordinal]);if(members.length>20)throw Error('unit_too_large');
  const a=bookAnswerPage(questionProof.first,questionProof.first,undefined,undefined,true).entries,b=bookAnswerPage(questionProof.final,questionProof.final,undefined,undefined,true).entries;
  const inherited=process.env.OMNI_EDU_BOOK_SECTION_INHERITANCE!=='0'&&a.some(e=>!e.section)&&b.some(e=>!e.section)?await this.examSections.resolve(questionProof,signal):undefined;
  for(const member of members){
   signal.throwIfAborted();
   const q=await this.host.read(String(member.question_id));if(!q)continue;
   const scope=questionSection(q,questionProof,a,b,inherited,process.env.OMNI_EDU_BOOK_SECTION_LAYOUT!=='0'?BOOK_SECTION_LAYOUT:undefined,true);
   const found=scope.section?await this.index.find(pair.answerId,pair.answerVersion,bookSectionKey(scope.section),q.archive?.number||'0'):[];
   await this.propose(input,q,{key:{batchId:input.batchId,ordinal:input.ordinal},receipt:questionProof,context:scope.context},pair,scope.section,found,signal,job);
  }
  return this.list(input);
 }
 private async propose(input:AnyBookMatchQuery,snapshot:QuestionBankItem,proof:QuestionProof,pair:MaterialBookRole,section:string,found:Row[],signal:AbortSignal,job?:BookMatchJob){
  const {batchId,ordinal}=proof.key;
  const structure='structure' in proof?proof.structure:undefined;
  const questionProof='receipt' in proof?proof.receipt:undefined;
  const sectionContext='context' in proof?proof.context:undefined;
  return this.host.writer(async target=>{
   signal.throwIfAborted();if(await target.index.pending())throw Error('busy');
   const structureJob=job&&'questionId' in job?job:undefined;
   if(structureJob&&!await target.work.structures.current(structureJob))return;
   if(job&&'batchId' in job&&!await target.work.current(job))return;
   if(structure)await assertStructureDraftEditable(target.host,snapshot.id);
   if(sectionContext)await target.examSections.validate(sectionContext,await target.host.receipt(batchId,ordinal),signal);
   const currentPair=await target.host.role(pair.questionId);if(JSON.stringify(pair)!==JSON.stringify(currentPair))throw Error('source_changed');
   if(section){const current=await target.index.find(pair.answerId,pair.answerVersion,bookSectionKey(section),snapshot.archive?.number||'0');if(JSON.stringify(current)!==JSON.stringify(found))throw Error('source_changed');}
   const q=await target.host.read(snapshot.id);if(!q)throw Error('source_changed');
   const lookupPolicy=process.env.OMNI_EDU_BOOK_SECTION_LAYOUT!=='0'?BOOK_SECTION_LAYOUT:undefined,slotPolicy=process.env.OMNI_EDU_BOOK_FILL_SLOTS!=='0'?PRINTED_FILL_SLOTS:undefined;
   const sectionProjection=shanghaiMockSectionKey(section)?.startsWith(TERM_SHANGHAI_MOCK_SECTIONS+'|')?TERM_SHANGHAI_MOCK_SECTIONS:WRAPPED_SHANGHAI_MOCK_SECTIONS;
   const number=q.archive?.number||'0',key=hash(JSON.stringify([BOOK_ANSWER_CONFLICT_POLICY,sectionProjection,SHARED_EXAM_ANSWER,snapshot.id,questionVersion(snapshot),input,section,found.map(f=>[f.batch_id,f.ordinal,f.start,f.proof_sha]),...(lookupPolicy?[lookupPolicy]:[]),...(slotPolicy?[slotPolicy]:[]),...(sectionContext?[sectionContext]:[]),...(structure?[pair,structure]:[]),...(structureJob?['structure-missing-roles.v1']:[]),...(snapshot.document?['structured-book-writeback.v1',process.env.OMNI_EDU_BOOK_DOCUMENT_WRITEBACK!=='0']:[])])),old=(await target.host.all('SELECT payload_json FROM material_book_answer_journal_v1 WHERE request_key=?',[key]))[0];if(old)return;
   const row:BookMatchRow={id:'bookanswer_'+randomUUID(),questionId:q.id,number,section,state:'held',reason:'',answer:'',analysis:'',beforeVersion:questionVersion(snapshot),afterVersion:''};
   const evidence:Evidence={pair,question:proof.key,answer:{batchId:'',ordinal:0,start:0,firstSha:'',finalSha:'',imageSha:''},section,number,sectionProjection,...(lookupPolicy?{lookupPolicy}:{}),...(sectionContext?{questionSection:sectionContext}:{}),...(structure?{structure}:{})};
   let answerProof:Proof|undefined,answerEntry:ReturnType<typeof bookAnswerPage>['entries'][number]|undefined,slotRecovery=false;
   if(questionVersion(q)!==row.beforeVersion){row.state='conflict';row.reason='source_changed';}
   else if(!section)row.reason='missing_section';else if(!found.length)row.reason='answer_not_found';else if(found.length!==1)row.reason='ambiguous_answer';
   else{
    const f=found[0];try{
     answerProof=await target.host.receipt(String(f.batch_id),Number(f.ordinal));
     const sharing=checkAnswerPair(answerProof,pair,section,true);
     if(sharing){
      if(!sameMaterialBookIdentity(await target.host.role(pair.answerId),answerProof.unit.bookRole))throw Error('source_changed');
      evidence.answerSharing=sharing;
     }
     const derived=await target.examSections.answerPage(answerProof,signal);
     answerEntry=derived.page.entries.find(e=>e.start===Number(f.start)&&e.number===number&&e.sectionKey===String(f.section_key));
     const sectionKey=(title:string)=>bookSectionLookupKey(title,true,lookupPolicy===BOOK_SECTION_LAYOUT);
     if(!answerEntry||sectionKey(answerEntry.section)!==sectionKey(section))throw Error('source_changed');
     if(derived.context&&bookSectionAt(answerProof.final.pageText,answerEntry.start,true)===undefined){evidence.answerSection=derived.context;await target.examSections.validateAnswer(derived.context,answerProof,{batchId:String(f.batch_id),ordinal:Number(f.ordinal)},signal);}
     row.answer=answerEntry.answer;row.analysis=answerEntry.analysis;row.source={batchId:String(f.batch_id),ordinal:Number(f.ordinal),start:answerEntry.start,page:answerProof.unit.pageSource!.page,title:await target.host.title(pair.answerId),...(evidence.answerSection?{sectionPage:evidence.answerSection.pages.at(-1)!.source.page}:{})};
     evidence.answer={batchId:row.source.batchId,ordinal:row.source.ordinal,start:row.source.start,firstSha:answerProof.firstSha,finalSha:answerProof.finalSha,imageSha:answerProof.imageSha};
     await target.host.validate(q,signal);
     const earlier=(await target.host.all('SELECT payload_json FROM material_book_answer_journal_v1 WHERE question_id=? AND after_json<>\'\' ORDER BY rowid DESC LIMIT 1',[q.id]))[0];
     if(earlier){const previous=JSON.parse(String(earlier.payload_json)) as BookMatchRow;if(previous.afterVersion===questionVersion(q)&&previous.source?.batchId===row.source.batchId&&previous.source.ordinal===row.source.ordinal&&previous.source.start===row.source.start)return;}
     slotRecovery=!!slotPolicy&&!!questionProof&&canResolveBookFillConflict(q,questionProof,answerEntry);
     if(slotRecovery)evidence.slotRecoveryPolicy=slotPolicy;
     const archive=q.archive;
     const supported=archive&&(structure?!!archive.structure&&archive.sourceChecked:!!archive.ai&&!!archive.pageSource);
     row.reason=!supported||q.document&&(!isCompleteQuestionDocument(q.document)||process.env.OMNI_EDU_BOOK_DOCUMENT_WRITEBACK==='0')?'unsupported':archive.issues.some(i=>!metadata.has(i)&&!(slotRecovery&&i==='answer_conflict'))||archive.sourceRisks.length?'question_unchecked':!answerEntry.agrees||answerEntry.issues.some(code=>code!=='missing_analysis')?'answer_unchecked':q.answer.trim()&&!(slotPolicy?samePrintedFillAnswer(q,q.answer,row.answer):aiTextSignature(q.answer)===aiTextSignature(row.answer))?'existing_answer_conflict':'';
    }catch(error){if(!(error instanceof Error)||!['source_changed','source_incomplete','privacy_blocked'].includes(error.message))throw error;row.reason='source_changed';}
   }
   if(structureJob&&!row.reason&&!q.answer.trim()&&q.analysis.trim()&&
      (!row.analysis||aiTextSignature(q.analysis)!==aiTextSignature(row.analysis)))
    row.reason='protected_analysis_mismatch';
   let next:QuestionBankItem|undefined=!structureJob&&row.reason==='existing_answer_conflict'?quarantineBookAnswerConflict(q):undefined;
   if(!row.reason&&answerEntry&&row.source){
    const writable=roles.filter(r=>!!row[r]&&(!q[r].trim()&&q.archive?.[`${r}Origin`]==='missing'||!structureJob&&q.archive?.[`${r}Origin`]==='ai_generated'));
    if(!writable.length)row.reason='protected_role';else{
     const archive=structuredClone(q.archive!);if(slotRecovery)archive.issues=archive.issues.filter(i=>i!=='answer_conflict');if(!archive.web){archive.schemaVersion=QUESTION_BOOK_ARCHIVE_SCHEMA;archive.extractor='book-answer-enriched.v1';archive.state='book_enriched';}archive.book??={schemaVersion:QUESTION_BOOK_EVIDENCE_SCHEMA,roles:{}};next={...q,archive,updatedAt:new Date().toISOString()};
     for(const role of writable){if(!row[role])continue;next[role]=row[role];archive[`${role}Origin`]='book_extracted';archive.book.roles[role]={candidateId:row.id,questionSha:hash(q.stem),textSha:hash(row[role]),title:row.source.title,page:row.source.page,section,number};archive.issues=archive.issues.filter(code=>code!==`missing_${role}`);}
     if(next.document){
      if(!isCompleteQuestionDocument(next.document)||!answerProof)throw Error('source_changed');
      next.document={...structuredClone(next.document),schemaVersion:QUESTION_DOCUMENT_BOOK_SCHEMA};
      for(const role of writable)next.document[role]=bookDocumentRole(row.id,row[role],evidence,answerProof,answerEntry.quote);next.document.schemaVersion=questionDocumentSchemaForRoles(next.document);
      if(!validQuestionDocument(next.document))throw Error('invalid_input');
     }
     if(!Object.keys(archive.book.roles).length){next=undefined;row.reason='no_change';}else if(!validQuestionArchive(archive))throw Error('invalid_input');
    }
   }
   await target.host.run('INSERT INTO material_book_answer_journal_v1(id,request_key,question_id,batch_id,ordinal,payload_json,evidence_json,before_json) VALUES(?,?,?,?,?,?,?,?)',[row.id,key,q.id,batchId,ordinal,JSON.stringify(row),JSON.stringify(evidence),JSON.stringify(q)]);
   signal.throwIfAborted();if(next){
    const fresh=await target.host.read(q.id);if(!fresh||questionVersion(fresh)!==row.beforeVersion||JSON.stringify(await target.host.role(pair.questionId))!==JSON.stringify(pair))throw Error('source_changed');
    // Reopen both source receipts inside the same writer transaction before publishing any canonical field.
    if(structure)await target.checkStructureScope(fresh,structure,signal);
    else if(questionProof){
     const checked=await target.host.receipt(batchId,ordinal);
     if(checked.firstSha!==questionProof.firstSha||checked.finalSha!==questionProof.finalSha)throw Error('source_changed');
     if(sectionContext)await target.examSections.validate(sectionContext,checked,signal);
    }
    const known=await target.host.receipt(evidence.answer.batchId,evidence.answer.ordinal);
    if(known.firstSha!==evidence.answer.firstSha||known.finalSha!==evidence.answer.finalSha||known.imageSha!==evidence.answer.imageSha)throw Error('source_changed');
    if(evidence.answerSection)await target.examSections.validateAnswer(evidence.answerSection,known,evidence.answer,signal);
    if(next.document)await target.host.run('UPDATE question_bank_items SET answer=?,analysis=?,archive_json=?,document_json=?,updated_at=? WHERE id=?',[next.answer,next.analysis,JSON.stringify(next.archive),JSON.stringify(next.document),next.updatedAt,q.id]);
    else await target.host.run('UPDATE question_bank_items SET answer=?,analysis=?,archive_json=?,updated_at=? WHERE id=?',[next.answer,next.analysis,JSON.stringify(next.archive),next.updatedAt,q.id]);
    await target.host.run('UPDATE material_question_members SET needs_attention=? WHERE question_id=?',[archiveEligible(next)?0:1,q.id]);if(!row.reason)row.state='applied';row.afterVersion=questionVersion(next);
    await target.host.run('UPDATE material_book_answer_journal_v1 SET payload_json=?,after_json=? WHERE id=?',[JSON.stringify(row),JSON.stringify(next),row.id]);await target.host.validate(next,signal);signal.throwIfAborted();
   }
  },()=>signal.throwIfAborted());
 }
 private async checkStructureScope(q:QuestionBankItem,expected:StructureBookScope,signal=new AbortController().signal,mockTitles:ShanghaiMockSectionPolicy=true){
  if(!this.host.structureScope||JSON.stringify(await this.host.structureScope(q,signal,mockTitles))!==JSON.stringify(expected))throw Error('source_changed');
 }
 async drain(signal:AbortSignal){
  signal.throwIfAborted();if(await this.indexOne())return true;if(process.env.OMNI_EDU_BOOK_ANSWER_WRITEBACK==='0')return false;
  const structures=await this.drainStructures(signal);
  const job=await this.work.next();if(!job)return structures;
  const input:BookMatchQuery={schemaVersion:MATERIAL_BOOK_MATCH_SCHEMA,batchId:job.batchId,ordinal:job.ordinal,revision:job.revision};
  let reason:string|undefined;
  try{await this.match(input,signal,job);}
  catch(error){if(signal.aborted)throw error;const code=error instanceof Error?error.message:'';if(['busy','index_busy'].includes(code))throw error;reason=['source_changed','source_incomplete','privacy_blocked','unsupported','unit_too_large'].includes(code)?code:'unavailable';}
  signal.throwIfAborted();
  await this.host.writer(t=>t.work.finish(job,reason),()=>signal.throwIfAborted());
  return true;
 }
 private async drainStructures(signal:AbortSignal) {
  if(!this.host.structureScope)return false;
  const picked=await this.work.structures.next();
  // Pay for keyset discovery only when the current batch of per-question work is empty.
  if(!picked)return await this.work.structures.discoveryPending() &&
    this.host.writer(target=>target.work.structures.discover(),()=>signal.throwIfAborted());
  const start=Date.now();
  for(let i=0,job:StructureBookJob|undefined=picked;i<8&&job;i++,job=await this.work.structures.next()){
   signal.throwIfAborted();
   let reason:string|undefined;
   try {
    if(await this.work.structures.current(job)){
     const q=await this.host.read(job.questionId);
     if(q){
      const input:StructureBookMatchQuery={schemaVersion:STRUCTURE_BOOK_MATCH_SCHEMA,questionId:q.id,version:questionVersion(q)};
      await this.match(input,signal,job);
     }
    }
   }catch(error){
    if(signal.aborted)throw error;
    const code=error instanceof Error?error.message:'';
    if(['busy','index_busy'].includes(code))throw error;
    if(!['source_changed','book_pair_required'].includes(code))
     reason=['source_incomplete','privacy_blocked','unsupported','unit_too_large'].includes(code)?code:'unavailable';
   }
   const completed=job;
   await this.host.writer(target=>target.work.structures.finish(completed,reason),()=>signal.throwIfAborted());
   if(Date.now()-start>=150)break;
  }
  return true;
 }
 async validate(q:QuestionBankItem){await this.validatedSourceDocument(q);}
 /** Authenticate independent role provenance, then recover the pre-enrichment source document for the original AI/teacher gate. */
 async validatedSourceDocument(q:QuestionBankItem):Promise<QuestionDocument|undefined>{
  const source=q.document?structuredClone(q.document):undefined;
  const checkedSections=new Set<string>();
  if(source){
   if(!validQuestionDocument(source))throw Error('source_changed');
   for(const role of roles)if((source[role].origin==='book_extracted')!==!!q.archive?.book?.roles[role])throw Error('source_changed');
  }
  for(const role of roles){const proof=q.archive?.book?.roles[role];if(!proof)continue;
   const saved=(await this.host.all('SELECT * FROM material_book_answer_journal_v1 WHERE id=? AND question_id=?',[proof.candidateId,q.id]))[0];if(!saved||!saved.after_json||hash(q.stem)!==proof.questionSha||hash(q[role])!==proof.textSha)throw Error('source_changed');
   const row=JSON.parse(String(saved.payload_json)) as BookMatchRow,e=JSON.parse(String(saved.evidence_json)) as Evidence,before=JSON.parse(String(saved.before_json)) as QuestionBankItem,after=JSON.parse(String(saved.after_json)) as QuestionBankItem;
   if(row.state!=='applied'||row.beforeVersion!==questionVersion(before)||row.afterVersion!==questionVersion(after)||row[role]!==q[role]||JSON.stringify(after.archive?.book?.roles[role])!==JSON.stringify(proof))throw Error('source_changed');
   // A title inherited on either side depends on the same pair. The section validator checks its side.
   if(e.questionSection&&!e.answerSection&&await this.index.bookPending(e.pair.answerId,e.pair.answerVersion)||
      e.answerSection&&!e.questionSection&&await this.index.bookPending(e.pair.questionId,e.pair.questionVersion))throw Error('source_incomplete');
   if(e.sectionProjection!==undefined&&e.sectionProjection!==SHANGHAI_MOCK_SECTIONS&&e.sectionProjection!==WRAPPED_SHANGHAI_MOCK_SECTIONS&&e.sectionProjection!==TERM_SHANGHAI_MOCK_SECTIONS)throw Error('source_changed');
   const mockTitles=e.sectionProjection??false;
   const sections=mockTitles===TERM_SHANGHAI_MOCK_SECTIONS?this.examSections:mockTitles?new MaterialBookQuestionSection(this.host,this.index,mockTitles):this.sections;
   const receipt=await this.host.receipt(e.answer.batchId,e.answer.ordinal);
   if(e.answerSection){const key=JSON.stringify([e.answer.batchId,e.answer.ordinal,e.answerSection]);if(!checkedSections.has(key)){await sections.validateAnswer(e.answerSection,receipt,e.answer);checkedSections.add(key);}}
   const entry=bookAnswerPage(receipt.first,receipt.final,e.answerSection?.section,receipt.unit.bookPagePolicy,mockTitles).entries.find(x=>x.start===e.answer.start);
   if(e.answerSection&&(bookSectionAt(receipt.final.pageText,entry?.start,mockTitles)!==undefined||
      !bookAnswerPage(receipt.first,receipt.first,undefined,receipt.unit.bookPagePolicy,mockTitles).entries.some(x=>!x.section&&x.number===e.number&&bookSectionAt(receipt.first.pageText,x.start,mockTitles)===undefined)))throw Error('source_changed');
   if(e.lookupPolicy!==undefined&&e.lookupPolicy!==BOOK_SECTION_LAYOUT)throw Error('source_changed');
   const sectionKey=(title:string)=>bookSectionLookupKey(title,mockTitles,e.lookupPolicy===BOOK_SECTION_LAYOUT);
   if(checkAnswerPair(receipt,e.pair,e.section,e.answerSharing===SHARED_EXAM_ANSWER,mockTitles)!==e.answerSharing||
      receipt.firstSha!==e.answer.firstSha||receipt.finalSha!==e.answer.finalSha||receipt.imageSha!==e.answer.imageSha||
      !entry||!entry.agrees||entry.issues.some(i=>i!=='missing_analysis')||sectionKey(entry.section)!==sectionKey(e.section)||entry.number!==e.number||entry[role]!==q[role])throw Error('source_changed');
   const removedConflict=before.archive?.issues.includes('answer_conflict')&&!after.archive?.issues.includes('answer_conflict');
   if(e.structure){
    const reference=before.archive?.structure;
    if(!before.archive?.sourceChecked||!reference||JSON.stringify(reference)!==JSON.stringify(q.archive?.structure)||
      reference.resourceId!==e.pair.questionId||reference.version!==e.pair.questionVersion||before.archive.number!==e.number||
      e.structure.section!==e.section||e.question.batchId!=='structure:'+reference.generation||e.question.ordinal!==e.structure.page||
      e.questionSection||removedConflict||e.slotRecoveryPolicy!==undefined)throw Error('source_changed');
    const key=JSON.stringify(e.structure);
    if(!checkedSections.has(key)){await this.checkStructureScope(before,e.structure,undefined,mockTitles);checkedSections.add(key);}
   }else{
    const question=await this.host.receipt(e.question.batchId,e.question.ordinal);
    if((removedConflict||e.slotRecoveryPolicy!==undefined)&&(e.slotRecoveryPolicy!==PRINTED_FILL_SLOTS||!canResolveBookFillConflict(before,question,entry)||after.archive?.state!=='book_enriched'||JSON.stringify(after.archive.issues)!==JSON.stringify(before.archive!.issues.filter(i=>i!=='answer_conflict'))))throw Error('source_changed');
    if(question.firstSha!==before.archive?.ai?.firstSha||question.finalSha!==before.archive?.ai?.finalSha||question.imageSha!==before.archive?.ai?.imageSha||question.unit.pageSource?.resourceId!==e.pair.questionId||question.unit.pageSource.version!==e.pair.questionVersion)throw Error('source_changed');
    if(e.questionSection){const key=JSON.stringify([e.question,e.questionSection]);if(!checkedSections.has(key)){
     const scope=questionSection(before,question,bookAnswerPage(question.first,question.first,undefined,undefined,mockTitles).entries,bookAnswerPage(question.final,question.final,undefined,undefined,mockTitles).entries,e.questionSection,e.lookupPolicy,mockTitles);
     if(!scope.context||scope.section!==e.section)throw Error('source_changed');await sections.validate(e.questionSection,question);checkedSections.add(key);
    }}
   }
   if(source){
    const old=before.document,applied=after.document;
    if(!isCompleteQuestionDocument(old)||!applied||!validQuestionDocument(applied)||![QUESTION_DOCUMENT_BOOK_SCHEMA,QUESTION_DOCUMENT_WEB_SCHEMA].includes(applied.schemaVersion as typeof QUESTION_DOCUMENT_BOOK_SCHEMA)||old[role].origin==='book_extracted'||JSON.stringify(source[role])!==JSON.stringify(bookDocumentRole(row.id,q[role],e,receipt,entry.quote))||JSON.stringify(applied[role])!==JSON.stringify(source[role])||JSON.stringify(old.source)!==JSON.stringify(applied.source)||JSON.stringify(old.blocks)!==JSON.stringify(applied.blocks)||!isCompleteQuestionDocument(applied)||JSON.stringify(old.context)!==JSON.stringify(applied.context))throw Error('source_changed');
    source[role]=structuredClone(old[role]);
   }else if(before.document||after.document)throw Error('source_changed');
  }
  if(source&&isCompleteQuestionDocument(source)){source.schemaVersion=questionDocumentSchemaForRoles(source);if(!validQuestionDocument(source))throw Error('source_changed');}
  return source;
 }
}
