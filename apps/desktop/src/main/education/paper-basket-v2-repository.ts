import {setBasketEntryPoints} from './paper-basket-points';
import {PAPER_BASKET_C2_SCHEMA} from '../../shared/paper-basket-c2';
import {syncBasketC2,basketC2Conflicts,basketC2Digest,assertC2SnapshotReady} from './paper-basket-c2-state';
import {randomUUID} from 'node:crypto';
import {PAPER_BASKET_SCHEMA, validBasketId, validBasketRevision, type PaperBasketPage, type PaperBasketCandidate, type PaperBasketEntry} from '../../shared/paper-basket';
import {PAPER_BASKET_V2_SCHEMA, validPaperBasketV2Read, validPaperBasketV2List, validPaperBasketV2Create, validPaperBasketV2Candidate, validPaperBasketV2Mutation, validPaperBasketV2Snapshot,validPaperBasketV2Import,
  type PaperBasketV2ImportInput,type PaperBasketV2Confirmation,type PaperBasketV2ReadInput, type PaperBasketV2ListInput, type PaperBasketV2CreateInput, type PaperBasketV2CandidateInput, type PaperBasketV2MutationInput, type PaperBasketV2SnapshotInput, type PaperBasketV2View} from '../../shared/paper-basket-v2';
import {generatedPaperCount, type PaperSelection, type PaperView} from '../../shared/paper-blueprint';
import {sourcePaperInstanceContent, type PaperInstance} from '../../shared/paper-instance';
import {QUESTION_SELECTION_IDENTITY_POLICY,questionSelectionIdentity as questionContentIdentity} from '../../shared/question-selection-identity';
import {questionVersion} from './question-context-provider';
import {PaperBasketRepository, type BasketHost} from './paper-basket-repository';
import {authorizePaperOwner, basketSummary, canonicalBasketJson, checkBasketCapacity, encodeBasket, orderedBasketEntries, previousBasketOperation, readStoredBasket, recordBasketOperation, type StoredBasket} from './paper-basket-state';
import {basketEntryAvailability, basketGenerations, basketQuestionAvailability, readBasketQuestion} from './paper-basket-source';
import {newPaperInstance, instanceReviewed, instanceDeliveryBlock} from './paper-instance';
import {paperSectionMatches} from './paper-selection';
import type {PaperSql} from './paper-sql';
import type {PaperRepository} from './paper-repository';

export class PaperBasketV2Repository {
  private readonly host: BasketHost;
  private readonly papers: Pick<PaperRepository,'createBasketSnapshotInTransaction'|'reviewInTransaction'|'decideInTransaction'>;
  constructor(host: BasketHost, papers: Pick<PaperRepository,'createBasketSnapshotInTransaction'|'reviewInTransaction'|'decideInTransaction'>) {this.host=host;this.papers=papers;}
  private readTx<T>(work: (sql: PaperSql) => Promise<T>): Promise<T> { return (this.host.readTransaction || this.host.transaction).call(this.host, work) as Promise<T>; }
  private tx<T>(current: () => boolean, work: (sql: PaperSql) => Promise<T>) {
    return this.host.transaction(async sql => { this.lease(current); const result = await work(sql); this.lease(current); return result; });
  }
  private lease(current: () => boolean) { if (!current()) throw Error('cancelled'); }
  private async view(sql: PaperSql, basket: StoredBasket): Promise<PaperBasketV2View> {
    let templateSourceCurrent=true;
    if(basket.data.c2)try{if(!this.host.verifyTemplates)throw Error('unavailable');await this.host.verifyTemplates(sql,basket);}catch{templateSourceCurrent=false;}
    const generations = await basketGenerations(this.host, sql, basket.sessionId, basket.data.blueprint);
    const identities = new Set<string>();
    const entries: PaperBasketV2View['entries'] = [];
    for (const entry of orderedBasketEntries(basket.data)) {
      let availability = await basketEntryAvailability(sql,entry,basket.data.blueprint,generations);
      const identity = questionContentIdentity(entry.question);
      if (identity.status !== 'available') availability = {available:false,reason:'unsupported'};
      else if (identities.has(identity.key)) availability = {available:false,reason:'duplicate'};
      else identities.add(identity.key);
      const instance = entry.instance || newPaperInstance(entry);
      const reviewCurrent = instanceReviewed(instance);
      const block = instanceDeliveryBlock(entry.question,instance);
      entries.push({...entry,instance,reviewCurrent,availability,...(block ? {deliveryBlock:block} : !reviewCurrent ? {deliveryBlock:'needs_review' as const} : {})});
    }
    const gaps = basket.data.blueprint.sections.flatMap(section => {
      const selected = entries.filter(e => e.sectionId === section.id);
      const quota = generatedPaperCount(basket.data.blueprint,section);
      return (['original','generated'] as const).map(sourceKind => {
        const required = sourceKind === 'generated' ? quota : section.count-quota;
        const count = selected.filter(e => (e.question.sourceKind === 'generated') === (sourceKind === 'generated')).length;
        return {sectionId:section.id,sourceKind,required,selected:count,missing:Math.max(0,required-count),excess:Math.max(0,count-required)};
      });
    }).filter(g => g.missing || g.excess);
    const confirmed=(await sql.all("SELECT paper_id FROM paper_basket_operations WHERE session_id=? AND basket_id=? AND operation_kind='domain:confirm-paper' ORDER BY created_at DESC,rowid DESC LIMIT 1",[basket.sessionId,basket.id]))[0];
    return {...basketSummary(basket), schemaVersion:PAPER_BASKET_V2_SCHEMA, persistedSchemaVersion:basket.schemaVersion,...(confirmed?.paper_id?{confirmedPaperId:String(confirmed.paper_id)}:{}),
      blueprint:basket.data.blueprint,entries,gaps,complete:basket.state==='active' && !gaps.length && templateSourceCurrent
        && !basket.data.c2?.retainedSections.some(s=>!s.released) && !basket.data.c2?.unknownRetainedSections?.some(s=>!s.released) && !basketC2Conflicts(basket.data).length
        && entries.every(e => e.availability.available && e.reviewCurrent && !e.deliveryBlock),
      ...(basket.data.c2?{c2:structuredClone(basket.data.c2),c2Digest:basketC2Digest(basket.data),templateSourceCurrent}:{}),
      ...(basket.data.uiState ? {uiState:basket.data.uiState} : {})};
  }
  async read(input: PaperBasketV2ReadInput) {
    if (!validPaperBasketV2Read(input)) throw Error('invalid_input');
    return this.readTx(async sql => this.view(sql, await readStoredBasket(sql,input.sessionId,input.basketId,true)));
  }
  async list(input: PaperBasketV2ListInput): Promise<PaperBasketPage> {
    if (!validPaperBasketV2List(input)) throw Error('invalid_input');
    return this.readTx(async sql => {
      await authorizePaperOwner(sql,input.sessionId);
      const offset=input.offset||0,limit=input.limit||20;
      const rows=await sql.all(`SELECT id,student_id,schema_version,revision,state,created_at,updated_at,
        json_extract(data_json,'$.blueprint.title') AS title,json_array_length(data_json,'$.entries') AS count
        FROM paper_baskets WHERE session_id=? ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`,[input.sessionId,limit,offset]);
      const items: PaperBasketPage['items']=[];
      for(const row of rows) {
        if(!validBasketId(row.id)||!validBasketRevision(Number(row.revision))||typeof row.student_id!=='string'
          ||!['active','archived'].includes(String(row.state))||![PAPER_BASKET_SCHEMA,PAPER_BASKET_V2_SCHEMA,PAPER_BASKET_C2_SCHEMA].includes(row.schema_version as typeof PAPER_BASKET_SCHEMA)
          ||typeof row.title!=='string'||row.title.length>160||!Number.isSafeInteger(row.count)||Number(row.count)<0||Number(row.count)>100)throw Error('unavailable');
        await authorizePaperOwner(sql,input.sessionId,row.student_id);
        items.push({id:row.id,sessionId:input.sessionId,revision:Number(row.revision),state:row.state as 'active'|'archived',title:row.title,count:Number(row.count),createdAt:String(row.created_at),updatedAt:String(row.updated_at)});
      }
      const total=Number((await sql.all('SELECT COUNT(*) AS count FROM paper_baskets WHERE session_id=?',[input.sessionId]))[0]?.count||0);
      return {items,total,offset,limit};
    });
  }
  async candidate(input: PaperBasketV2CandidateInput): Promise<PaperBasketCandidate> {
    if (!validPaperBasketV2Candidate(input)) throw Error('invalid_input');
    return this.readTx(async sql => {
      const b=await readStoredBasket(sql,input.sessionId,input.basketId,true);
      if (b.state!=='active') throw Error('conflict');
      const question=await readBasketQuestion(sql,input.questionId),generations=await basketGenerations(this.host,sql,input.sessionId,b.data.blueprint);
      let eligibility=await basketQuestionAvailability(sql,question,generations);
      const matchingSectionIds=b.data.blueprint.sections.filter(s => (b.data.blueprint.mode!=='ai_original'||question.sourceKind==='generated') && paperSectionMatches(question,b.data.blueprint,s)).map(s=>s.id);
      if (eligibility.available && !matchingSectionIds.length) eligibility={available:false,reason:'section_mismatch'};
      // Replacement candidates may be the same source ID at a newer version. The
      // mutation checks duplicates excluding its own stable entry.
      return {question,contentVersion:questionVersion(question),eligibility,matchingSectionIds,...(generations.has(question.id)?{generation:generations.get(question.id)}:{})};
    });
  }
  async create(input: PaperBasketV2CreateInput,current:()=>boolean=()=>true) {
    if (!validPaperBasketV2Create(input)) throw Error('invalid_input');
    return this.tx(current,async sql => {
      const studentId=await authorizePaperOwner(sql,input.sessionId);
      const prior=await previousBasketOperation(sql,input.sessionId,input.requestId,'create',input,studentId);
      if(prior) return this.view(sql,await readStoredBasket(sql,input.sessionId,prior.basketId,true));
      await checkBasketCapacity(sql,input.sessionId);
      const id='xibasket_'+randomUUID(),at=new Date().toISOString();
      await sql.run(`INSERT INTO paper_baskets(id,session_id,student_id,schema_version,revision,state,data_json,created_at,updated_at) VALUES(?,?,?,?,1,'active',?,?,?)`,[id,input.sessionId,studentId,PAPER_BASKET_V2_SCHEMA,encodeBasket({blueprint:input.blueprint,entries:[]}),at,at]);
      await recordBasketOperation(sql,input.sessionId,input.requestId,'create',input,studentId,{basketId:id,revision:1});
      await this.host.afterWrite?.(); await authorizePaperOwner(sql,input.sessionId,studentId);
      return this.view(sql,await readStoredBasket(sql,input.sessionId,id,true));
    });
  }
  private async event(sql:PaperSql,b:StoredBasket,entry:PaperBasketEntry & {instance?:PaperInstance},operation:string,before?:PaperInstance) {
    const i=entry.instance!;
    const data=JSON.stringify({before:before||null,after:i});
    const size=(await sql.all('SELECT COUNT(*) AS count,COALESCE(SUM(length(CAST(data_json AS BLOB))),0) AS bytes FROM paper_instance_events WHERE session_id=? AND basket_id=?',[b.sessionId,b.id]))[0];
    if(Number(size?.count)>=10000 || Number(size?.bytes)+Buffer.byteLength(data)>32*1024*1024) throw Error('unavailable');
    await sql.run(`INSERT INTO paper_instance_events(session_id,student_id,basket_id,entry_id,event_id,instance_revision,operation_kind,before_digest,after_digest,data_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [b.sessionId,b.studentId,b.id,entry.entryId,i.review?.eventId||'xievent_'+randomUUID(),i.instanceRevision,operation,before?.contentDigest||null,i.contentDigest,data,new Date().toISOString()]);
  }
  async mutate(input:PaperBasketV2MutationInput,current:()=>boolean=()=>true) {
    if(!validPaperBasketV2Mutation(input)) throw Error('invalid_input');
    return this.tx(current,async sql => {
      const b=await readStoredBasket(sql,input.sessionId,input.basketId,true),op=input.operation;
      const kind=op.type==='updateUiState'?'ui_state':'mutate';
      const prior=await previousBasketOperation(sql,input.sessionId,input.requestId,kind,input,b.studentId);
      if(prior){const view=await this.view(sql,b);return b.data.c2?{...view,operationReceipt:{requestId:input.requestId,basketId:prior.basketId,basketRevision:prior.revision}}:view;}
      if(b.state!=='active'||b.revision!==input.expectedRevision) throw Error('conflict');
      if(b.data.c2){if(!this.host.verifyTemplates)throw Error('unavailable');await this.host.verifyTemplates(sql,b);}
      const before=canonicalBasketJson({data:b.data,state:b.state,schema:b.schemaVersion});
      if(op.type==='editEntry'||op.type==='replaceEntry'||op.type==='restoreEntrySource'||op.type==='reviewEntry') {
        if(!('entryId' in op && 'expectedInstanceRevision' in op)) throw Error('invalid_input');
        const entry=b.data.entries.find(e=>e.entryId===op.entryId);
        if(!entry) throw Error('conflict');
        const old=entry.instance||newPaperInstance(entry);
        if(old.instanceRevision!==op.expectedInstanceRevision) throw Error('conflict');
        let next=old;
        if(op.type==='editEntry') {
          if(canonicalBasketJson(op.content)!==canonicalBasketJson(old.content)) next=newPaperInstance(entry,old.instanceRevision+1,structuredClone(op.content));
        } else if(op.type==='restoreEntrySource') {
          if(canonicalBasketJson(old.content)!==canonicalBasketJson(sourcePaperInstanceContent())) next=newPaperInstance(entry,old.instanceRevision+1);
        } else if(op.type==='replaceEntry') {
          const q=await readBasketQuestion(sql,op.questionId);
          if(questionVersion(q)!==op.expectedSourceVersion) throw Error('source_changed');
          const identity=questionContentIdentity(q);
          if(identity.status!=='available') throw Error('source_changed');
          if(b.data.entries.some(e=>e.entryId!==entry.entryId && (e.questionId===q.id || questionContentIdentity(e.question).status==='available' && (questionContentIdentity(e.question) as {key?:string}).key===identity.key))) throw Error('conflict');
          const gens=await basketGenerations(this.host,sql,b.sessionId,b.data.blueprint);
          const candidate={...entry,question:q,questionId:q.id,contentVersion:questionVersion(q),generation:gens.get(q.id)};
          const available=await basketEntryAvailability(sql,candidate,b.data.blueprint,gens);
          if(!available.available) throw Error(available.reason==='section_mismatch'?'invalid_input':'source_changed');
          const section=b.data.blueprint.sections.find(s=>s.id===entry.sectionId)!;
          const quota=generatedPaperCount(b.data.blueprint,section),generated=q.sourceKind==='generated';
          if(b.data.entries.filter(e=>e.entryId!==entry.entryId && e.sectionId===entry.sectionId && (e.question.sourceKind==='generated')===generated).length >= (generated?quota:section.count-quota)) throw Error('shortage');
          if(entry.questionId!==q.id||entry.contentVersion!==candidate.contentVersion||canonicalBasketJson(old.content)!==canonicalBasketJson(sourcePaperInstanceContent())) {
            Object.assign(entry,candidate); if(!candidate.generation) delete entry.generation;
            next=newPaperInstance(entry,old.instanceRevision+1);
          }
        } else if(op.type==='reviewEntry') {
          if(op.expectedContentDigest!==old.contentDigest) throw Error('conflict');
          if(op.action==='confirm') {
            if(instanceDeliveryBlock(entry.question,old)==='options_required') throw Error('conflict');
            const available=await basketEntryAvailability(sql,entry,b.data.blueprint,await basketGenerations(this.host,sql,b.sessionId,b.data.blueprint));
            if(!available.available) throw Error('source_changed');
          }
          next={...old,review:{eventId:'xireview_'+randomUUID(),action:op.action,instanceRevision:old.instanceRevision,contentDigest:old.contentDigest,sourceBinding:structuredClone(old.sourceBinding),reviewedAt:new Date().toISOString()}};
        }
        if(next.instanceRevision>1000000) throw Error('conflict');
        const upgraded=b.schemaVersion===PAPER_BASKET_SCHEMA;
        if(upgraded) { b.schemaVersion=PAPER_BASKET_V2_SCHEMA; for(const e of b.data.entries) e.instance=e.instance||newPaperInstance(e); }
        entry.instance=next;
        if(upgraded||canonicalBasketJson(old)!==canonicalBasketJson(next)) await this.event(sql,b,entry,op.type,old);
      } else if(op.type==='setEntryPoints'){
        setBasketEntryPoints(b,op.entryId,op.points);
        if(b.data.c2)b.data.c2.entryPoints[op.entryId]=op.points;
      } else {
        if(b.data.c2 && op.type==='updateBlueprint'){
          if(op.blueprint.mode!==b.data.blueprint.mode)throw Error('conflict');
          const ids=new Set(op.blueprint.sections.map(s=>s.id));
          for(const section of b.data.blueprint.sections)if(!ids.has(section.id)&&!b.data.c2.retainedSections.some(s=>s.section.id===section.id))
            b.data.c2.retainedSections.push({section:structuredClone(section),entryIds:b.data.entries.filter(e=>e.sectionId===section.id).map(e=>e.entryId),released:false});
          b.data.c2.retainedSections=b.data.c2.retainedSections.filter(s=>!ids.has(s.section.id));
        }
        await new PaperBasketRepository(this.host).applyInTransaction(sql,b,op);
        if(b.schemaVersion!==PAPER_BASKET_SCHEMA) for(const e of b.data.entries) e.instance=e.instance||newPaperInstance(e);
      }
      syncBasketC2(b);
      if(b.data.c2)await this.host.verifyTemplates!(sql,b);
      const changed=op.type==='updateUiState'?false:before!==canonicalBasketJson({data:b.data,state:b.state,schema:b.schemaVersion});
      const revision=b.revision+(changed?1:0);
      if(revision>1000000) throw Error('conflict');
      await sql.run('UPDATE paper_baskets SET schema_version=?,revision=?,state=?,data_json=?,updated_at=? WHERE id=? AND session_id=? AND revision=?',[b.schemaVersion,revision,b.state,encodeBasket(b.data),new Date().toISOString(),b.id,b.sessionId,b.revision]);
      await recordBasketOperation(sql,b.sessionId,input.requestId,kind,input,b.studentId,{basketId:b.id,revision});
      await this.host.afterWrite?.(); await authorizePaperOwner(sql,b.sessionId,b.studentId); this.lease(current);
      const view=await this.view(sql,await readStoredBasket(sql,b.sessionId,b.id,true));
      return b.data.c2?{...view,operationReceipt:{requestId:input.requestId,basketId:b.id,basketRevision:revision}}:view;
    });
  }
  async createSnapshot(input:PaperBasketV2SnapshotInput,current:()=>boolean=()=>true):Promise<PaperView> {
    if(!validPaperBasketV2Snapshot(input)) throw Error('invalid_input');
    return this.tx(current,async sql=>{
      const b=await readStoredBasket(sql,input.sessionId,input.basketId,true);
      const prior=await previousBasketOperation(sql,input.sessionId,input.requestId,'snapshot',input,b.studentId);
      if(prior?.paperId) return this.papers.reviewInTransaction(sql,input.sessionId,prior.paperId);
      if(b.state!=='active'||b.revision!==input.expectedRevision) throw Error('conflict');
      const view=await this.view(sql,b);
      if(view.entries.some(e=>!e.availability.available)) throw Error('source_changed');
      if(view.entries.some(e=>!e.reviewCurrent||e.deliveryBlock)) throw Error('conflict');
      if(!view.complete||!view.entries.length) throw Error('shortage');
      const paper=await this.snapshotInTransaction(sql,b,view,input,current);
      await recordBasketOperation(sql,b.sessionId,input.requestId,'snapshot',input,b.studentId,{basketId:b.id,revision:b.revision,paperId:paper.id});
      await this.host.afterWrite?.();await authorizePaperOwner(sql,b.sessionId,b.studentId);this.lease(current);
      const result=await this.papers.reviewInTransaction(sql,b.sessionId,paper.id);
      if(!result.sourceCurrent) throw Error('source_changed');
      return result;
    });
  }

  private async snapshotInTransaction(sql:PaperSql,b:StoredBasket,view:PaperBasketV2View,input:PaperBasketV2SnapshotInput,current:()=>boolean){
      assertC2SnapshotReady(b);
      const items:PaperSelection['items']=view.entries.map((e,index)=>({entryId:e.entryId,sectionId:e.sectionId,number:index+1,points:b.data.blueprint.sections.find(s=>s.id===e.sectionId)!.points,
        question:structuredClone(e.question),source:{schemaVersion:'xiaozhi.education.question-context.v1',questionId:e.questionId,version:e.contentVersion},instance:structuredClone(e.instance),...(e.generation?{generation:e.generation}:{})}));
      const selection:PaperSelection={duplicatePolicy:QUESTION_SELECTION_IDENTITY_POLICY,items,shortages:[],scanned:items.length,scanComplete:false,method:'manual',excluded:{unsupported:0,missing_answer:0,source_unavailable:0},duplicateRecords:0};
      const binding={basketId:b.id,basketRevision:b.revision,entryIds:items.map(i=>i.entryId!)};
      const paper=await this.papers.createBasketSnapshotInTransaction(sql,input,b.data.blueprint,selection,binding,b.studentId,current);
      return paper;
  }

  async importPaper(input:PaperBasketV2ImportInput,current:()=>boolean=()=>true):Promise<PaperBasketV2View>{
    if(!validPaperBasketV2Import(input))throw Error('invalid_input');
    return this.tx(current,async sql=>{
      const studentId=await authorizePaperOwner(sql,input.sessionId);
      const prior=await previousBasketOperation(sql,input.sessionId,input.requestId,'import',input,studentId);
      if(prior)return this.view(sql,await readStoredBasket(sql,input.sessionId,prior.basketId,true));
      const paper=await this.papers.reviewInTransaction(sql,input.sessionId,input.paperId);
      if(paper.revision!==input.paperRevision||paper.state==='rejected')throw Error('conflict');
      if(!paper.sourceCurrent)throw Error('source_changed');
      await checkBasketCapacity(sql,input.sessionId);
      const id='xibasket_'+randomUUID(),at=new Date().toISOString();
      const positions=new Map<string,number>();
      const entries=paper.selection.items.map(item=>{
        const position=positions.get(item.sectionId)||0;positions.set(item.sectionId,position+1);
        const entry={entryId:'xibasketentry_'+randomUUID(),questionId:item.question.id,contentVersion:item.source.version,sectionId:item.sectionId,position,question:structuredClone(item.question),...(item.generation?{generation:structuredClone(item.generation)}:{})};
        return {...entry,instance:newPaperInstance(entry,1,item.instance?structuredClone(item.instance.content):sourcePaperInstanceContent())};
      });
      const importedC2=paper.c2?structuredClone(paper.c2):undefined;
      if(importedC2){importedC2.entryPoints=Object.fromEntries(entries.map((e,i)=>[e.entryId,paper.selection.items[i].points]));for(const r of importedC2.retainedSections)r.entryIds=[];for(const r of importedC2.unknownRetainedSections||[])r.entryIds=[];}
      await sql.run("INSERT INTO paper_baskets(id,session_id,student_id,schema_version,revision,state,data_json,created_at,updated_at) VALUES(?,?,?,?,1,'active',?,?,?)",[id,input.sessionId,studentId,importedC2?PAPER_BASKET_C2_SCHEMA:PAPER_BASKET_V2_SCHEMA,encodeBasket({blueprint:structuredClone(paper.blueprint),entries,...(importedC2?{c2:importedC2}:{}),uiState:{stage:'organize',filters:{},offset:0,scrollTop:0}}),at,at]);
      await recordBasketOperation(sql,input.sessionId,input.requestId,'import',input,studentId,{basketId:id,revision:1,paperId:paper.id});
      await this.host.afterWrite?.();await authorizePaperOwner(sql,input.sessionId,studentId);
      const imported=await readStoredBasket(sql,input.sessionId,id,true);if(imported.data.c2){if(!this.host.verifyTemplates)throw Error('unavailable');await this.host.verifyTemplates(sql,imported);}
      return this.view(sql,imported);
    });
  }
  async confirm(input:PaperBasketV2SnapshotInput,current:()=>boolean=()=>true):Promise<PaperBasketV2Confirmation>{
    if(!validPaperBasketV2Snapshot(input))throw Error('invalid_input');
    return this.tx(current,async sql=>{
      const b=await readStoredBasket(sql,input.sessionId,input.basketId,true);
      if(b.data.c2){if(!this.host.verifyTemplates)throw Error('unavailable');await this.host.verifyTemplates(sql,b);assertC2SnapshotReady(b);}
      const prior=await previousBasketOperation(sql,input.sessionId,input.requestId,'confirm',input,b.studentId);
      const imports=await sql.all("SELECT paper_id FROM paper_basket_operations WHERE session_id=? AND basket_id=? AND operation_kind='domain:import-paper'",[b.sessionId,b.id]);
      if(prior?.paperId)return {basket:await this.view(sql,b),paper:await this.papers.reviewInTransaction(sql,b.sessionId,prior.paperId),replacedPaperIds:imports.map(r=>String(r.paper_id))};
      if(b.state!=='active'||b.revision!==input.expectedRevision)throw Error('conflict');
      const initial=await this.view(sql,b);
      if(initial.entries.some(e=>!e.availability.available))throw Error('source_changed');
      if(!initial.entries.length||initial.gaps.length)throw Error('shortage');
      if(initial.entries.some(e=>e.deliveryBlock&&e.deliveryBlock!=='needs_review'))throw Error('conflict');
      let changed=b.schemaVersion===PAPER_BASKET_SCHEMA;if(changed)b.schemaVersion=PAPER_BASKET_V2_SCHEMA;
      for(const entry of b.data.entries){
        this.lease(current);const old=entry.instance||newPaperInstance(entry);
        if(!instanceReviewed(old)){
          entry.instance={...old,review:{eventId:'xireview_'+randomUUID(),action:'confirm',instanceRevision:old.instanceRevision,contentDigest:old.contentDigest,sourceBinding:structuredClone(old.sourceBinding),reviewedAt:new Date().toISOString()}};
          await this.event(sql,b,entry,'reviewEntry',old);changed=true;
        }else entry.instance=old;
      }
      const revision=b.revision+(changed?1:0);if(revision>1000000)throw Error('conflict');
      await sql.run('UPDATE paper_baskets SET schema_version=?,revision=?,data_json=?,updated_at=? WHERE id=? AND session_id=? AND revision=?',[b.schemaVersion,revision,encodeBasket(b.data),new Date().toISOString(),b.id,b.sessionId,b.revision]);b.revision=revision;
      const view=await this.view(sql,b);if(!view.complete)throw Error('conflict');
      const pending=await this.snapshotInTransaction(sql,b,view,{...input,expectedRevision:revision},current);
      const paper=await this.papers.decideInTransaction(sql,{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:b.sessionId,id:pending.id,revision:pending.revision,action:'confirm'},current);
      const replacedPaperIds:string[]=[];
      for(const row of imports){const source=await this.papers.reviewInTransaction(sql,b.sessionId,String(row.paper_id));if(source.state==='pending'){await this.papers.decideInTransaction(sql,{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:b.sessionId,id:source.id,revision:source.revision,action:'reject'},current);replacedPaperIds.push(source.id);}}
      await recordBasketOperation(sql,b.sessionId,input.requestId,'confirm',input,b.studentId,{basketId:b.id,revision,paperId:paper.id});
      await this.host.afterWrite?.();await authorizePaperOwner(sql,b.sessionId,b.studentId);this.lease(current);
      if(b.data.c2){if(!this.host.verifyTemplates)throw Error('unavailable');await this.host.verifyTemplates(sql,b);}
      return {basket:await this.view(sql,b),paper,replacedPaperIds};
    });
  }
}
