import {requirementCoverage,validateRequirementBindings} from './requirements';
import type {DeliveryRequirements} from '../../../shared/xiaozhi-delivery-checks';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {WorkspaceLease} from '../workspace-files';
import {readInspectionFile} from './read-file';
import {runLocalUtility} from '../local-utility-host';
import {DELIVERY_CHECK_SCHEMA,STRUCTURE_SCHEMA,validDeliveryCheckInput,validStructureResult,CHECK_CLASSES,
 type DeliveryCheckInput,type DeliveryCheckReport,type DeliveryCheckResult,type FileCheckReport,type StructureResult} from '../../../shared/xiaozhi-delivery-checks';
import {createInspectionState} from './state';
import {evaluateFileRules,evaluateConsistency,fileCheckState} from './evaluate';
import {inspectInteractiveHtml} from './html';
import {createVisualEvidenceCache} from './visual-evidence';
import {renderPowerPoint} from './powerpoint';
import {renderPagedDocument} from './paged-document';
import type {DeliveryVisualResult} from '../../../shared/xiaozhi-delivery-checks';

const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const knownErrors=new Set(['invalid_input','permission_denied','busy','cancelled','timeout','changed','not_found','too_large','unavailable']);
const errorCode=(error:unknown):Extract<DeliveryCheckResult,{ok:false}>['error']=>{
 const e=error as Error&{code?:string};return e?.code==='ENOENT'?'not_found':knownErrors.has(e?.message)?e.message as Extract<DeliveryCheckResult,{ok:false}>['error']:'unavailable';
};
export type CandidateBytes={path:string;bytes:Buffer;version:string;candidate:NonNullable<FileCheckReport['candidate']>};
/** One inspected bundle at a time. Parsing and dynamic DOM run in owned isolated processes. */
export function createDeliveryChecks(options:{state:ReturnType<typeof createInspectionState>;dataRoot:string;
 resolve:(id:string)=>Promise<WorkspaceLease>;requirements:(id:string)=>Promise<number|null|DeliveryRequirements>;
 observe?:(report:DeliveryCheckReport)=>void;
 publishedCurrent?:(sessionId:string,path:string)=>Promise<boolean>;
 candidateStatus?:(sessionId:string,file:FileCheckReport)=>Promise<{current:boolean;published:boolean}>}){
 let tail=Promise.resolve<unknown>(undefined),slots=0,closing=false;const controllers=new Set<AbortController>();const visuals=createVisualEvidenceCache(options.dataRoot);
 async function requirementsFor(id:string){const value=await options.requirements(id);return{version:typeof value==='number'?value:value?.version??null,context:typeof value==='object'&&value?structuredClone(value):null};}
 const capture=readInspectionFile;
 async function refresh(report:DeliveryCheckReport):Promise<DeliveryCheckReport>{
  const lease=await options.resolve(report.sessionId),requirements=await requirementsFor(report.sessionId);const contextStale=lease.version!==report.workspaceVersion||requirements.version!==report.requirementsVersion||requirements.context?.digest!==report.requirements?.digest;let stale=contextStale;
  const files:FileCheckReport[]=[];
  for(const file of report.files){
   let changed=contextStale,superseded=false;
   if(options.publishedCurrent)try{superseded=!await options.publishedCurrent(report.sessionId,file.path);changed ||= superseded;}catch{changed=true;}
   try{if(file.candidate){const status=await options.candidateStatus?.(report.sessionId,file);changed ||= !status?.current;if(status?.published){const actual=await capture(lease,file.path);changed ||=actual.sha256!==file.sha256;}}
    else{const current=await capture(lease,file.path);changed ||= current.fileVersion!==file.fileVersion||current.sha256!==file.sha256;}}catch{changed=true;}
   if(changed){stale=true;files.push({...file,state:'stale',numbers:[],facts:[],checks:file.checks.map(c=>({...c,state:'unchecked',code:superseded?'office_version_replaced':'inspection_stale',message:superseded?'此成果已有更新版本；保留旧检查供参考，请检查当前文件。':'文件、工作区或要求版本已变化；旧检查不能证明当前内容。'}))});}else files.push(file);
  }
  if(stale)for(const file of files)if(file.state!=='stale'){file.checks=file.checks.map(c=>c.kind==='consistency'?{...c,state:'unchecked',code:'counterpart_changed',message:'整包其他文件或要求已变化，一致性需要重新检查。'}:c);file.state=fileCheckState(file.checks);}
  return{...report,contextCurrent:!contextStale,files,...(stale&&report.requirementCoverage?{requirementCoverage:report.requirementCoverage.map(c=>({...c,state:'unchecked' as const,evidence:c.evidence.map(e=>({...e,state:'unchecked' as const}))}))}:{}),state:stale?'stale':report.state};
 }
 async function inspect(raw:unknown,signal:AbortSignal,owner?:{runId:string;callId:string;scope?:string;current:()=>boolean},candidates?:CandidateBytes[]):Promise<DeliveryCheckResult>{
  if(!validDeliveryCheckInput(raw))return{ok:false,error:'invalid_input'};let input:DeliveryCheckInput=raw;if(closing)return{ok:false,error:'unavailable'};if(slots>=4)return{ok:false,error:'busy'};
  if(candidates&&(!owner||candidates.length!==input.files.length||candidates.some(c=>!Buffer.isBuffer(c.bytes)||!c.bytes.length||c.bytes.length>16*1048576||!input.files.some(f=>f.path===c.path))))return{ok:false,error:'invalid_input'};
  // Candidate buffers are trusted main-only snapshots, never accepted from IPC/model data.
  const supplied=candidates?.map(c=>({...c,bytes:Buffer.from(c.bytes),candidate:{...c.candidate}}));
  slots++;const sourceSignal=signal,controller=new AbortController(),abort=()=>controller.abort(sourceSignal.reason);controllers.add(controller);sourceSignal.addEventListener('abort',abort,{once:true});if(sourceSignal.aborted)abort();signal=controller.signal;
  const work=tail.catch(()=>undefined).then(async():Promise<DeliveryCheckResult>=>{
   const current=()=>{signal.throwIfAborted();if(closing||owner&&!owner.current())throw Error('cancelled');};
   const files:FileCheckReport[]=[];let report:DeliveryCheckReport|undefined;
   try{
    current();await options.state.migrate();const lease=await options.resolve(input.sessionId),requirementState=await requirementsFor(input.sessionId),requirements=requirementState.version;current();
    if(input.workspaceVersion!==undefined&&input.workspaceVersion!==lease.version||input.requirementsVersion!==undefined&&input.requirementsVersion!==requirements)throw Error('changed');
    const scope=hash([input.sessionId,owner?.scope||owner?.runId||input.requestId,requirements??''].join(':'));
    const previousCandidate=supplied?await options.state.candidate(scope):null;
    if(previousCandidate){
     const priorFiles=previousCandidate.policy.files,missing=previousCandidate.report.state==='failed'?priorFiles.filter(p=>!input.files.some(f=>f.path===p.path)):[],newPaths=input.files.filter(f=>!priorFiles.some(p=>p.path===f.path));
     // Renaming or removing an unsuccessful draft must not remove its frozen obligations.
     if(missing.length>newPaths.length)throw Error('changed');
     input={...input,files:input.files.map(f=>{const prior=priorFiles.find(p=>p.path===f.path)||missing[newPaths.findIndex(n=>n.path===f.path)];return prior?.rules?{...f,rules:prior.rules}:f;})};
    }
    validateRequirementBindings(input,requirementState.context);
    const policySha256=hash(JSON.stringify({inspector:'requirements.1',requirementDigest:requirementState.context?.digest,files:input.files.map(f=>({path:f.path,rules:f.rules||{}})),requirements}));
    report={schemaVersion:DELIVERY_CHECK_SCHEMA,id:'xicheck_'+hash(randomUUID()+input.requestId),sessionId:input.sessionId,runId:owner?.runId||null,callId:owner?.callId||null,
     workspaceVersion:lease.version,requirementsVersion:requirements,...(requirementState.context?{requirements:requirementState.context}:{}),policySha256,scope,createdAt:new Date().toISOString(),state:'partial',files,repairAttempts:{},...(supplied?{candidate:true}:{})};
    const prior=supplied?previousCandidate?.report:await options.state.latest(scope);
    if(supplied&&prior&&prior.policySha256===policySha256&&prior.workspaceVersion===lease.version&&prior.requirementsVersion===requirements&&supplied.length===prior.files.length
     &&supplied.every(c=>{const p=prior.files.find(f=>f.path===c.path);return p?.candidate?.id===c.candidate.id&&p.candidate.revision===c.candidate.revision&&p.sha256===hash(c.bytes);})
     &&(await Promise.all(prior.files.map(f=>options.candidateStatus?.(input.sessionId,f)))).every(s=>s?.current)){current();return{ok:true,report:prior};}
    // IPC-only teacher revisions of the same draft invalidate evidence but are not automatic repair rounds.
    const newCandidate=!!supplied&&!!prior&&supplied.some(c=>!prior.files.some(p=>p.candidate?.id===c.candidate.id));
    if(prior)report.repairAttempts={...prior.repairAttempts};
    const failedKinds=prior?CHECK_CLASSES.filter(kind=>prior.files.some(f=>f.checks.some(c=>c.kind===kind&&c.state==='failed'))):[];
    const exhausted=newCandidate?failedKinds.filter(kind=>(report!.repairAttempts[kind]||0)>=2):[];
    if(exhausted.length){
     report.repairExhausted=exhausted;
     for(const candidate of supplied!){const checks=CHECK_CLASSES.map(kind=>({kind,state:exhausted.includes(kind)?'failed' as const:'unchecked' as const,code:'repair_budget_exhausted',message:'此类自动修复已达2轮，本次未再执行检查或写入。原失败草稿与检查结果已保留，请说明未完成项。'}));files.push({path:candidate.path,fileVersion:candidate.version,sha256:hash(candidate.bytes),size:candidate.bytes.length,format:path.extname(candidate.path).slice(1),candidate:candidate.candidate,checks,renderedPages:[],numbers:[],state:'failed'});}
     report.state='failed';current();await options.state.put(report,input);options.observe?.(report);current();return{ok:true,report};
    }
    if(newCandidate)for(const kind of failedKinds)report.repairAttempts[kind]=(report.repairAttempts[kind]||0)+1;
    for(const file of input.files){
     current();const format=path.extname(file.path).slice(1).toLowerCase();let row:FileCheckReport={path:file.path,fileVersion:null,sha256:null,size:null,format,checks:[],renderedPages:[],numbers:[],state:'partial'};
     try{
      const candidate=supplied?.find(c=>c.path===file.path),snapshot=candidate?{bytes:candidate.bytes,fileVersion:candidate.version,sha256:hash(candidate.bytes),size:candidate.bytes.length}:await capture(lease,file.path);current();if(file.version!==undefined&&file.version!==snapshot.fileVersion)throw Error('changed');
      row={...row,...(file.rules?{rules:structuredClone(file.rules)}:{}),fileVersion:snapshot.fileVersion,sha256:snapshot.sha256,size:snapshot.size,...(candidate?{candidate:candidate.candidate}:{})};
      const request={schemaVersion:STRUCTURE_SCHEMA,requestId:`xicheckreq_${randomUUID()}`,name:path.basename(file.path),bytes:snapshot.bytes};
      const fail=(error:string):StructureResult=>({schemaVersion:STRUCTURE_SCHEMA,requestId:request.requestId,ok:false,error});
      const parsed=await runLocalUtility({entry:'inspection-worker.js',serviceName:'小智交付文件检查',request,timeout:15000,signal,valid:(v):v is StructureResult=>validStructureResult(v,request.requestId),fail});current();
      if(!parsed.ok){row.checks.push({kind:'structure',state:['busy','unavailable','timeout','too_large'].includes(parsed.error)?'unchecked':'failed',code:parsed.error,message:['busy','unavailable','timeout','too_large'].includes(parsed.error)?'解析器未能在当前资源范围内完成检查；文件保持原样。':'实际文件未通过格式或结构检查。'});}
      else{
       const metrics=parsed.data;let observations:Record<string,string[]>={},htmlUnavailable=false,officeRendered=false;
       if(metrics.format==='html'){
        try{const html=await inspectInteractiveHtml(new TextDecoder('utf-8',{fatal:true}).decode(snapshot.bytes),file.rules||{},{dataRoot:options.dataRoot,signal});current();metrics.pages=[{index:1,text:html.text,notes:html.notes}];observations=html.observations;row.checks.push(...html.findings);row.renderedPages=html.renderedPages;
         try{row.visualEvidence=await visuals.put(html.screenshots.map(s=>({bytes:s.bytes,page:1,kind:'html_viewport' as const,viewport:s.viewport})),signal);current();}catch{current();row.checks.push({kind:'visual',state:'unchecked',code:'visual_evidence_unavailable',message:'实际页面已渲染，但截图未能留存；不能把缺少视觉证据当作完整检查。'});}
        }
        catch(error){current();htmlUnavailable=true;row.checks.push({kind:'visual',state:'unchecked',code:'render_unavailable',message:'本地页面检查未完成；未把提取文字当作视觉通过。'},{kind:'interaction',state:'unchecked',code:'render_unavailable',message:'页面未完成实际加载或操作，交互尚未验证。'});}
       }
       if(metrics.format==='pptx'){
        try{const rendered=await renderPowerPoint(snapshot.bytes,metrics,{dataRoot:options.dataRoot,signal,officeEngine:file.rules?.officeEngine});current();row.renderedPages=rendered.pages;row.checks.push(...rendered.findings);officeRendered=true;
         try{row.visualEvidence=await visuals.put(rendered.captures,signal);current();}catch{current();row.checks.push({kind:'visual',state:'unchecked',code:'visual_evidence_unavailable',message:`${rendered.engine}已渲染，但截图未能留存；原文件保留，视觉检查尚不完整。`});}
        }catch(error){current();const reason=error instanceof Error?error.message:'unavailable';row.checks.push({kind:'visual',state:'unchecked',code:reason==='external_content'?'office_external_content':reason==='busy'?'office_busy':'office_render_unavailable',message:reason==='external_content'?'文件包含外链或嵌入活动对象，未自动在Office/WPS打开；结构检查保留，页面仍未检查。':reason==='busy'?'所选Office检查应用正在使用、无法创建独立WPS实例或渲染器繁忙；未接管现有窗口，页面仍未检查。':'所选Office应用渲染未完成（未安装、超时或当前不可用）；未以结构或提取文字替代真实页面。'});}
       }
       if(metrics.format==='docx'||metrics.format==='pdf'){
        try{
         const rendered=await renderPagedDocument(snapshot.bytes,metrics,{dataRoot:options.dataRoot,signal,officeEngine:file.rules?.officeEngine});current();
         row.renderedPages=rendered.pages;row.checks.push(...rendered.findings);officeRendered=true;
         if(rendered.pdfBytes){
          const pdfRequest={schemaVersion:STRUCTURE_SCHEMA,requestId:`xicheckreq_${randomUUID()}`,name:'word-render.pdf',bytes:rendered.pdfBytes};
          const actual=await runLocalUtility({entry:'inspection-worker.js',serviceName:'Word实际分页读取',request:pdfRequest,timeout:15000,signal,valid:(v):v is StructureResult=>validStructureResult(v,pdfRequest.requestId),fail:(error):StructureResult=>({schemaVersion:STRUCTURE_SCHEMA,requestId:pdfRequest.requestId,ok:false,error})});current();
          metrics.pageCount=rendered.pages.length;
          if(actual.ok&&actual.data.pageCount===rendered.pages.length){metrics.pages=actual.data.pages;metrics.textUnavailablePages=actual.data.textUnavailablePages;}
          else{metrics.pages=rendered.pages.map(index=>({index,text:'',notes:''}));metrics.textUnavailablePages=rendered.pages.slice();row.checks.push({kind:'content',state:'unchecked',code:'page_text_unavailable',message:'Word实际页面已渲染，但导出PDF的逐页文本未读取成功；未以OOXML全文代替第一页。'});}
         }
         try{row.visualEvidence=await visuals.put(rendered.captures,signal);current();}catch{current();row.checks.push({kind:'visual',state:'unchecked',code:'visual_evidence_unavailable',message:'实际页面已渲染，但截图未能留存；视觉检查尚不完整。'});}
        }catch(error){current();const reason=error instanceof Error?error.message:'unavailable';row.checks.push({kind:'visual',state:'unchecked',code:reason==='external_content'?'office_external_content':reason==='busy'?'office_busy':reason==='too_large'?'paged_render_too_large':reason==='timeout'?'paged_render_timeout':'paged_render_unavailable',message:reason==='external_content'?'文件包含外链、活动对象或外部字段，未自动在Word/WPS打开；页面仍未检查。':reason==='busy'?'所选文档检查应用正在使用、无法创建独立WPS实例或渲染器繁忙；未接管现有窗口，页面仍未检查。':reason==='timeout'?`${metrics.format==='docx'?'Word/WPS原生页面导出在15秒':'Windows PDF页面渲染在60秒'}内未完成；原文件和结构检查保留，实际页面未检查。`:'本机Word/WPS/Windows PDF页面渲染未完成（未安装、资源超限或不可用）；未以提取文字替代实际页面。'});}
       }
       const evaluated=evaluateFileRules(metrics,file.rules,observations);row.checks.push(...evaluated.checks.filter(c=>!officeRendered||c.code!=='render_not_run').map(c=>htmlUnavailable&&['content','numbers'].includes(c.kind)?{...c,state:'unchecked' as const,code:'render_unavailable',message:'页面未完成实际运行，静态源未代替当前可见结果。'}:c));row.numbers=htmlUnavailable?[]:evaluated.numbers;row.facts=htmlUnavailable?[]:evaluated.facts;if(metrics.pageCount!==undefined)row.pageCount=metrics.pageCount;
      }
      current();if(candidate){if(!(await options.candidateStatus?.(input.sessionId,row))?.current)throw Error('changed');}
      else{const after=await capture(lease,file.path);if(after.fileVersion!==snapshot.fileVersion||after.sha256!==snapshot.sha256)throw Error('changed');}
     }catch(error){current();if(errorCode(error)==='permission_denied'||errorCode(error)==='changed')throw error;
      row.checks.push({kind:'structure',state:'failed',code:errorCode(error),message:'未能读取当前目标文件，未修改或替换文件。'});
     }
     for(const kind of CHECK_CLASSES.filter(k=>k!=='consistency'))if(!row.checks.some(c=>c.kind===kind))row.checks.push({kind,state:'unchecked',code:'not_checked',message:'此项尚未取得可验证结果。'});
     files.push(row);
    }
    current();if((await options.resolve(input.sessionId)).version!==lease.version||JSON.stringify(await requirementsFor(input.sessionId))!==JSON.stringify(requirementState))throw Error('changed');
    evaluateConsistency(files);for(const file of files)file.state=fileCheckState(file.checks);
    if(prior&&!supplied){const edited=files.some(f=>prior.files.find(p=>p.path===f.path)?.sha256!==f.sha256);
     if(edited)for(const kind of CHECK_CLASSES)if(prior.files.some(f=>f.checks.some(c=>c.kind===kind&&c.state==='failed')))report.repairAttempts[kind]=(report.repairAttempts[kind]||0)+1;
    }
    report.requirementCoverage=requirementCoverage(report,input);
    report.state=files.some(f=>f.state==='failed')?'failed':files.some(f=>f.state==='partial')?'partial':report.requirements?.criteria.length?'partial':'passed';current();await options.state.put(report,input);const shown=await refresh(report);current();options.observe?.(shown);return{ok:true,report:shown};
   }catch(error){
    if(report&&(signal.aborted||closing||owner&&!owner.current())){report.state='cancelled';await options.state.cancel(report,input).catch(()=>undefined);}
    return{ok:false,error:signal.aborted?(signal.reason==='timeout'?'timeout':'cancelled'):errorCode(error)};
   }
  });tail=work;
  try{return await work;}finally{slots--;controllers.delete(controller);sourceSignal.removeEventListener('abort',abort);}
 }
 return{
  inspect,
  async get(sessionId:string,id:string){await options.state.migrate();const value=await options.state.get(sessionId,id);return value?refresh(value.report):null;},
  async list(sessionId:string){await options.state.migrate();await options.resolve(sessionId);return(await options.state.list(sessionId)).map(r=>({id:r.id,state:r.state,createdAt:r.createdAt,files:r.files.map(f=>({path:f.path,state:f.state}))}));},
  async forRun(sessionId:string,runId:string){
   await options.state.migrate();const stored=await options.state.forRun(sessionId,runId),seen=new Set<string>();
   const selected=stored.filter(r=>{const keys=r.files.map(f=>f.candidate?'candidate:'+f.candidate.id:'file:'+f.path+':'+f.sha256);if(keys.every(k=>seen.has(k)))return false;keys.forEach(k=>seen.add(k));return true;});
   const read=await Promise.allSettled(selected.map(refresh));return{reports:read.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),unavailable:read.some(r=>r.status==='rejected')};
  },
  async visual(sessionId:string,id:string,sha256:string):Promise<DeliveryVisualResult>{
   try{if(closing)return{ok:false,error:'unavailable'};await options.state.migrate();const stored=await options.state.get(sessionId,id);if(!stored)return{ok:false,error:'not_found'};
    const report=await refresh(stored.report),file=report.files.find(f=>f.visualEvidence?.some(e=>e.sha256===sha256)),evidence=file?.visualEvidence?.find(e=>e.sha256===sha256);
    if(!file?.sha256||!evidence)return{ok:false,error:'not_found'};const bytes=await visuals.read(evidence,new AbortController().signal);
    return{ok:true,evidence,dataBase64:bytes.toString('base64'),historical:report.state==='stale'||file.state==='stale',fileSha256:file.sha256};
   }catch{return{ok:false,error:'unavailable'};}
  },
  async close(){closing=true;controllers.forEach(c=>c.abort('cancelled'));await tail.catch(()=>undefined);},
 };
}
