import {listTemplateVersions} from './paper-template-list';
import {PAPER_BASKET_C2_SCHEMA,type PaperBasketC2Binding} from '../../shared/paper-basket-c2';
import type {PaperTemplateSave,PaperTemplateTarget,PaperTemplateRead,PaperTemplateApply,PaperTemplateArrange,PaperTemplateReceipt} from '../../shared/paper-template';
import {validTemplateSave,validTemplateTarget,validTemplateRead,validTemplateApply,validTemplateArrange} from '../../shared/paper-template-validation';
import {authorizePaperOwner,readStoredBasket,encodeBasket,canonicalBasketJson} from './paper-basket-state';
import {PaperTemplateRepository,templateHash} from './paper-template-repository';
import {readTemplateVersion,verifyTemplateVersion} from './paper-template-read';
import {extractTemplateSource,type TemplateMaterials} from './paper-template-source';
import {patchTemplateCandidate,templateStructure,templateLayout} from './paper-template-candidate';
import {planPaperTemplateMapping} from './paper-template-mapping';
import {verifyBasketTemplates} from './paper-template-currentness';
import {syncBasketC2} from './paper-basket-c2-state';
import {newPaperInstance} from './paper-instance';
import type {PaperSql} from './paper-sql';
import {templateReadTrace} from './paper-template-trace';
export type PaperTemplateTransaction=<T>(work:(sql:PaperSql,materials?:TemplateMaterials)=>Promise<T>)=>Promise<T>;
export type PaperTemplateHost={materials:TemplateMaterials;transaction:PaperTemplateTransaction};
export function createPaperTemplateService(host:PaperTemplateHost) {
  const target=async(sql:PaperSql,input:PaperTemplateTarget)=>{
    const b=await readStoredBasket(sql,input.sessionId,input.basketId,true);if(b.state!=='active')throw Error('conflict');return b;
  };
  const check=async(sql:PaperSql,ref:Parameters<typeof readTemplateVersion>[1],studentId:string,signal:AbortSignal,materials:TemplateMaterials)=>{
    const v=await readTemplateVersion(sql,ref,studentId);await verifyTemplateVersion(sql,materials,v,signal);return v;
  };
  async function writeBasket(sql:PaperSql,b:Awaited<ReturnType<typeof target>>,input:unknown,requestId:string,signal:AbortSignal,materials:TemplateMaterials) {
    syncBasketC2(b);
    signal.throwIfAborted();const revision=b.revision+1;if(revision>1000000)throw Error('conflict');
    await sql.run('UPDATE paper_baskets SET schema_version=?,revision=?,data_json=?,updated_at=? WHERE id=? AND session_id=? AND revision=?',
      [PAPER_BASKET_C2_SCHEMA,revision,encodeBasket(b.data),new Date().toISOString(),b.id,b.sessionId,b.revision]);
    if(Number((await sql.all('SELECT changes() AS count'))[0]?.count)!==1)throw Error('conflict');
    const receipt:PaperTemplateReceipt={requestId,operation:'apply',basketId:b.id,basketRevision:revision};
    await sql.run('INSERT INTO paper_template_receipts(session_id,request_id,student_id,input_digest,result_json) VALUES (?,?,?,?,?)',
      [b.sessionId,requestId,b.studentId,templateHash(input),canonicalBasketJson(receipt)]);
    await verifyBasketTemplates(sql,b,materials,signal);
    await authorizePaperOwner(sql,b.sessionId,b.studentId);signal.throwIfAborted();return receipt;
  }
  async function prior(sql:PaperSql,b:Awaited<ReturnType<typeof target>>,input:{requestId:string}) {
    const row=(await sql.all('SELECT * FROM paper_template_receipts WHERE session_id=? AND request_id=?',[b.sessionId,input.requestId]))[0];
    if(!row)return undefined;
    if(row.student_id!==b.studentId)throw Error('permission_denied');
    if(row.input_digest!==templateHash(input))throw Error('idempotency_conflict');
    return JSON.parse(String(row.result_json)) as PaperTemplateReceipt;
  }
  return {
    async list(input:PaperTemplateTarget,signal:AbortSignal) {
      if(!validTemplateTarget(input))throw Error('invalid_input');
      return host.transaction(async(sql,materials=host.materials)=>{signal.throwIfAborted();const b=await target(sql,input);
        return listTemplateVersions(sql,materials,b.studentId,signal);});
    },
    async read(input:PaperTemplateRead,signal:AbortSignal) {
      if(!validTemplateRead(input))throw Error('invalid_input');
      const trace=templateReadTrace(input.requestId);trace('transaction-wait');
      try{return await host.transaction(async(sql,materials=host.materials)=>{
        signal.throwIfAborted();trace('transaction-acquired');
        const b=await target(sql,input);trace('version-read');
        const value=await readTemplateVersion(sql,input,b.studentId);
        await verifyTemplateVersion(sql,materials,value,signal,trace);
        signal.throwIfAborted();trace('verified');return value;
      });}finally{trace('settled');}
    },
    async save(input:PaperTemplateSave,signal:AbortSignal) {
      if(!validTemplateSave(input))throw Error('invalid_input');
      const trace=templateReadTrace(input.requestId);trace('save-transaction-wait');
      try{return await host.transaction(async(sql,materials=host.materials)=>{
        signal.throwIfAborted();trace('save-transaction-acquired');
        const b=await readStoredBasket(sql,input.sessionId,input.basketId,true);
        const committed=await prior(sql,b,input);if(committed)return committed;
        if(b.state!=='active'||b.revision!==input.basketRevision)throw Error('conflict');
        const raw=await extractTemplateSource(sql,materials,input.resourceId,input.version,signal,trace);
        if(raw.digest!==input.expectedCandidateDigest)throw Error('source_changed');
        if(input.derivedFrom)await check(sql,input.derivedFrom,b.studentId,signal,materials);
        const candidate=patchTemplateCandidate(raw,input.patches);
        const content={name:input.name.trim(),kind:input.kind,candidate,candidateDigest:raw.digest,
          ...(input.derivedFrom?{derivedFrom:input.derivedFrom}:{}),
          ...(input.kind==='structure'?{structure:templateStructure(candidate)}:{layout:templateLayout(candidate)})};
        const repo=new PaperTemplateRepository({transaction:work=>work(sql)});
        return repo.save({sessionId:input.sessionId,requestId:input.requestId,expectedHeadVersion:input.expectedHeadVersion,
          templateId:input.templateId,intent:input,content},async(replay)=>{
          trace('save-precommit-verify');const after=await extractTemplateSource(sql,materials,input.resourceId,input.version,signal,trace);
          if(after.digest!==raw.digest)throw Error('source_changed');
          const current=await target(sql,input);if(!replay&&current.revision!==input.basketRevision)throw Error('conflict');
        },()=>!signal.aborted);
      });}finally{trace('save-settled');}
    },
    async apply(input:PaperTemplateApply,signal:AbortSignal) {
      if(!validTemplateApply(input))throw Error('invalid_input');
      return host.transaction(async(sql,materials=host.materials)=>{
        const b=await readStoredBasket(sql,input.sessionId,input.basketId,true),student=b.studentId;
        const old=await prior(sql,b,input);if(old)return old;
        if(b.state!=='active')throw Error('conflict');
        const structure=input.kind==='layout'?undefined:await check(sql,input.structure,student,signal,materials);
        const layout=input.kind==='structure'?undefined:await check(sql,input.layout,student,signal,materials);
        if(structure?.kind==='layout'||layout?.kind==='structure')throw Error('invalid_input');
        if(b.revision!==input.expectedRevision)throw Error('conflict');
        const c2:PaperBasketC2Binding=b.data.c2 ?? {retainedSections:[],entryPoints:{}};
        if(!b.data.c2)for(const e of b.data.entries){const s=b.data.blueprint.sections.find(s=>s.id===e.sectionId);c2.entryPoints[e.entryId]=s?.points??null;}
        c2.unknownRetainedSections=[...new Set([...(c2.unknownRetainedSections||[]).map(r=>r.sectionId),...b.data.entries.filter(e=>!b.data.blueprint.sections.some(s=>s.id===e.sectionId)&&!c2.retainedSections.some(s=>s.section.id===e.sectionId)).map(e=>e.sectionId)])].map(sectionId=>({sectionId,entryIds:b.data.entries.filter(e=>e.sectionId===sectionId).map(e=>e.entryId),released:c2.unknownRetainedSections?.find(r=>r.sectionId===sectionId)?.released??false}));
        if(structure && input.kind!=='layout') {
          const planned=planPaperTemplateMapping(b.data.blueprint,structure.structure!,b.data.entries,input.mapping,c2.entryPoints,c2.retainedSections,c2.unknownRetainedSections);
          b.data.blueprint=planned.blueprint;c2.entryPoints=planned.entryPoints;c2.retainedSections=planned.retainedSections;c2.unknownRetainedSections=planned.unknownRetainedSections;c2.structureTemplate=input.structure;
        }
        if(layout && input.kind!=='structure'){c2.layout=layout.layout!;c2.layoutTemplate=input.layout;}
        b.data.c2=c2;
        for(const entry of b.data.entries)entry.instance??=newPaperInstance(entry);
        if(structure)await verifyTemplateVersion(sql,materials,structure,signal);
        if(layout)await verifyTemplateVersion(sql,materials,layout,signal);
        return writeBasket(sql,b,input,input.requestId,signal,materials);
      });
    },
    async arrange(input:PaperTemplateArrange,signal:AbortSignal) {
      if(!validTemplateArrange(input))throw Error('invalid_input');
      return host.transaction(async(sql,materials=host.materials)=>{
        const b=await readStoredBasket(sql,input.sessionId,input.basketId,true),c=b.data.c2;if(!c)throw Error('conflict');
        const old=await prior(sql,b,input);if(old)return old;
        if(b.state!=='active')throw Error('conflict');
        for(const ref of [c.structureTemplate,c.layoutTemplate])if(ref)await check(sql,ref,b.studentId,signal,materials);
        if(b.revision!==input.expectedRevision)throw Error('conflict');
        const op=input.operation;
        if(op.kind==='release-empty') {
          const retained=c.retainedSections.find(s=>s.section.id===op.sectionId&&!s.released);
          const unknown=c.unknownRetainedSections?.find(s=>s.sectionId===op.sectionId&&!s.released);
          if((!retained&&!unknown)||b.data.entries.some(e=>e.sectionId===op.sectionId))throw Error('nonempty_section');
          const released=retained??unknown!;released.released=true;released.entryIds=[];
        } else {
          const entry=b.data.entries.find(e=>e.entryId===op.entryId),section=b.data.blueprint.sections.find(s=>s.id===entry?.sectionId);
          if(!entry||!section)throw Error('conflict');c.entryPoints[entry.entryId]=section.points;
        }
        return writeBasket(sql,b,input,input.requestId,signal,materials);
      });
    },
  };
}
