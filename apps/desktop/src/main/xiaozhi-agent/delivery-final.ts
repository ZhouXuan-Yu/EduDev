import type {PrivateTextChange} from './text-change-state';
import type {PrivateOfficeArtifact} from './office-artifact-state';
import type {DeliveryRow} from './delivery-state';
import type {DeliveryCheckReport,CheckClass} from '../../shared/xiaozhi-delivery-checks';
import {TOOL_EXECUTION_MESSAGES,type XiaozhiToolAttempt} from '../../shared/xiaozhi-tool-attempt';

type TextFact=Pick<PrivateTextChange,'id'|'sessionId'|'runId'|'callId'|'path'|'state'|'afterSha256'>;
type OfficeFact=Pick<PrivateOfficeArtifact,'id'|'sessionId'|'runId'|'callId'|'path'|'state'|'outputHash'>;
type Entry={id:string;path:string;callId:string;saved:boolean;state:string;hash:string|null;carried?:boolean;write:boolean};
export type DeliveryFinal={text:string;incomplete:boolean};
export type DeliveryFailure=Pick<XiaozhiToolAttempt,'callId'|'code'|'effect'>;
export type DeliveryFinalPorts={
 changes:()=>Promise<TextFact[]>;office:()=>Promise<OfficeFact[]>;bundles:()=>Promise<DeliveryRow[]>;
 text:(id:string)=>Promise<TextFact|null>;artifact:(id:string)=>Promise<OfficeFact|null>;
 inspections:()=>Promise<{reports:DeliveryCheckReport[];unavailable:boolean}>;
};
const literal=(s:string)=>s.replace(/[\\`*_{}[\]()<>#+.!|~-]/g,'\\$&');
const kinds:Record<CheckClass,string>={structure:'结构',content:'内容',visual:'视觉',interaction:'交互',numbers:'数值',consistency:'跨文件一致性'};
const textState:Record<TextFact['state'],string>={pending:'尚未确认，未保存',approved:'已确认，尚未保存',executing:'保存结果待核验',applied:'已保存',rejected:'已拒绝，未保存',interrupted:'已停止，未保存',uncertain:'保存结果待核验',conflict:'内容或来源已变化，未保存',reverting:'撤销结果待核验',reverted:'已撤销本次修改',undo_uncertain:'撤销结果待核验',undo_conflict:'撤销冲突，保留文件待核验'};
const officeState:Record<OfficeFact['state'],string>={pending:'尚未确认，未保存',approved:'已确认，尚未保存',generating:'生成未完成，未保存',prepared:'草稿已准备，未保存',committing:'保存结果待核验',saved:'已保存',rejected:'已拒绝，未保存',interrupted:'已停止，未保存',uncertain:'保存结果待核验',conflict:'内容或来源已变化，未保存',failed:'生成或保存失败，未保存'};
const textEntry=(r:TextFact):Entry=>({id:r.id,path:r.path,callId:r.callId,saved:r.state==='applied',state:textState[r.state],hash:r.afterSha256,write:true});
const officeEntry=(r:OfficeFact):Entry=>({id:r.id,path:r.path,callId:r.callId,saved:r.state==='saved',state:officeState[r.state],hash:r.outputHash,write:true});

/** Derived public presentation only. Original ledgers own effects; no model text can certify files. */
export async function deliveryFinal(options:{sessionId:string;runId:string;callOrder:string[];observed:boolean;failedFileCalls?:DeliveryFailure[];failure?:'stopped'|'failed';ports:DeliveryFinalPorts}):Promise<DeliveryFinal|undefined>{
 if(!options.observed&&!options.callOrder.length&&!options.failedFileCalls?.length)return undefined;
 const p=options.ports,loaded=await Promise.allSettled([p.changes(),p.office(),p.bundles(),p.inspections()] as const);
 const changes=loaded[0].status==='fulfilled'?loaded[0].value:[],office=loaded[1].status==='fulfilled'?loaded[1].value:[],bundles=loaded[2].status==='fulfilled'?loaded[2].value:[];
 const inspection=loaded[3].status==='fulfilled'?loaded[3].value:{reports:[],unavailable:true};
 let unavailable=loaded.some(r=>r.status==='rejected')||inspection.unavailable;
 const reports=inspection.reports.filter(r=>r.sessionId===options.sessionId&&r.runId===options.runId),entries=new Map<string,Entry>();
 for(const row of changes)if(row.sessionId===options.sessionId&&row.runId===options.runId)entries.set(row.id,textEntry(row));
 for(const row of office)if(row.sessionId===options.sessionId&&row.runId===options.runId)entries.set(row.id,officeEntry(row));
 for(const bundle of bundles.filter(r=>r.sessionId===options.sessionId&&r.runId===options.runId))for(const ref of bundle.files){
  let entry=ref.draftId?entries.get(ref.draftId):undefined;
  if(!entry&&ref.draftId)try{
   const child=ref.kind==='text'?await p.text(ref.draftId):await p.artifact(ref.draftId);
   if(child&&child.sessionId===options.sessionId&&child.path===ref.path&&child.runId===ref.runId)entry=ref.kind==='text'?textEntry(child as TextFact):officeEntry(child as OfficeFact);
  }catch{unavailable=true;}
  if(!entry)entry={id:ref.draftId||bundle.id+':'+ref.fileId,path:ref.path,callId:bundle.callId,saved:false,state:ref.error?'准备失败，未保存':'未取得保存记录',hash:null,write:true};
  entries.set(entry.id,{...entry,callId:bundle.callId,carried:ref.carried});
 }
 if(!entries.size&&!reports.length&&!options.observed&&!options.failedFileCalls?.length)return undefined;
 const order=new Map(options.callOrder.map((id,i)=>[id,i])),groups=new Map<string,Entry[]>();
 for(const entry of [...entries.values()].sort((a,b)=>(order.get(a.callId)??-1)-(order.get(b.callId)??-1))){const key=entry.path.toLowerCase(),rows=groups.get(key)||[];rows.push(entry);groups.set(key,rows);}
 for(const report of reports)for(const file of report.files)if(!groups.has(file.path.toLowerCase()))groups.set(file.path.toLowerCase(),[{id:'',path:file.path,callId:report.callId||'',saved:false,state:'本轮仅检查，无保存操作',hash:file.sha256,write:false}]);
 let incomplete=unavailable,requirementsUnchecked=false,unmapped=false;const lines:string[]=[];
 for(const history of groups.values()){
  const file=history.at(-1)!,key=file.path.toLowerCase();
  // Reports are newest first. A checked draft is evidence only for that identity/hash; published reads may match the saved hash.
  const matching=reports.flatMap(report=>report.files.map(f=>({report,file:f}))).filter(x=>x.file.path.toLowerCase()===key&&(!file.hash||x.file.sha256===file.hash)&&(!file.id||!x.file.candidate||x.file.candidate.id===file.id));
  const checked=matching[0];
  lines.push('- '+literal(file.path)+'：'+file.state+(file.carried?'（沿用此前已保存成果，本轮未重复写入）':'')+'。');
  if(file.write&&!file.saved){incomplete=true;const prior=history.slice(0,-1).reverse().find(r=>r.saved);if(prior)lines.push('  此前已保存的版本仍保留，本次修改未保存。');}
  if(!checked){incomplete=true;lines.push('  检查：未取得当前版本的检查结果。');continue;}
  const r=checked.report,f=checked.file;
  if(r.state==='cancelled'){incomplete=true;lines.push('  检查已停止，不能据此报告通过。');continue;}
  if(f.state==='stale'||r.contextCurrent===false){incomplete=true;lines.push('  检查已过期：文件或要求已变化，请重新检查当前版本。');continue;}
  lines.push('  '+(file.write&&!file.saved?'草稿检查（未正式保存）':'文件检查')+'：'+(f.state==='failed'?'发现问题':f.state==='passed'?'已声明检查通过':'仍有未检查项')+'。');
  const passed=Object.entries(kinds).filter(([kind])=>{const checks=f.checks.filter(c=>c.kind===kind&&c.state!=='not_applicable');return checks.length&&checks.every(c=>c.state==='passed');}).map(([,label])=>label);
  if(passed.length)lines.push('  已通过的声明项：'+passed.join('、')+'。');
  const failures=f.checks.filter(c=>c.state==='failed');
  for(const c of failures.slice(0,3))lines.push('  发现问题：'+literal(c.message)+'。');
  if(failures.length>3)lines.push('  另有'+(failures.length-3)+'项问题，详见原文件检查记录。');
  const unchecked=[...new Set(f.checks.filter(c=>c.state==='unchecked').map(c=>kinds[c.kind]))];
  if(unchecked.length)lines.push('  未检查/未完成：'+unchecked.join('、')+'。');
  const criteria=r.requirementCoverage||[];
  if(r.requirements?.criteria.length){requirementsUnchecked=true;unmapped ||=criteria.some(c=>c.state==='unmapped');incomplete=true;}
  if(f.state!=='passed'||failures.length||unchecked.length)incomplete=true;
 }
 const recordedCalls=new Set([...entries.values()].map(e=>e.callId));
 const failedCalls=new Map((options.failedFileCalls||[]).filter(a=>!recordedCalls.has(a.callId)).map(a=>[a.callId,a]));
 for(const a of failedCalls.values()){
  incomplete=true;
  lines.push('- 文件操作未完成：'+TOOL_EXECUTION_MESSAGES[a.code||'unknown']);
  lines.push(a.effect==='none'?'  本次操作未执行，未生成可确认保存的成果。':'  本次操作未取得保存回执，文件是否已写入仍待核验；请先查看现有文件，避免重复生成或覆盖。');
 }
 if(!lines.length){incomplete=true;lines.push('本轮文件记录未能完整读回；已保存成果保留，请查看原文件面板，不能据此报告全部完成。');}
 if(requirementsUnchecked)lines.push('尚待核对：是否完整满足你的教学要求'+(unmapped?'，其中有要求尚未关联具体检查':'')+'。');
 if(unavailable)lines.push('部分记录暂时无法核验，不能判断全部要求已满足。');
 const title=options.failure==='stopped'?'本轮已停止，已保存成果保留。':options.failure==='failed'?'本轮未全部完成。':'本轮文件结果：';
 return{text:[title,...(incomplete?[entries.size?'仍有未完成或未核验项，保存成功不代表检查全部通过。':'仍有未完成或未核验项，不能报告全部完成。']:[]),'',...lines,'',entries.size?'可在上方文件卡打开已有成果，在本地文件面板重新检查或继续修改。':'请根据上方实际失败原因继续处理；没有保存回执的操作不能视为文件已交付。'].join('\n'),incomplete};
}
