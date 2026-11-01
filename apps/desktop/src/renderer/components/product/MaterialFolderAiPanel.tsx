import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import {MATERIAL_FOLDER_AI_SCHEMA as schema,type FolderAiView} from '../../../shared/material-folder-ai';
import type {AiSettings} from '../../../shared/material-ai';
import {DisclosureCard} from '../ui/DisclosureCard';
const labels:Record<string,string>={running:'后台AI整理中',paused:'AI已暂停',budget_exhausted:'额度已预留完，等待追加授权',configuration_changed:'DeepSeek配置已变化',attention:'本批处理结束，有内容待核对',complete:'本批AI处理结束'};
const errors:Record<string,string>={configuration_changed:'DeepSeek配置不可用或已变化，请先检查统一模型设置；已有授权绑定旧配置时需新建文件夹批次。',budget_exhausted:'额度不能低于本批已预留次数，请增加后重新授权。',consent_required:'本批范围新增了资料，请重新勾选授权后继续。',scope_changed:'本批新增资料尚未获得继续授权。',privacy_blocked:'包含个人信息，未发送。',source_changed:'原件或正文已变化，未继续发送。',unsupported:'暂不支持本格式原图复核，请在资料页处理或转成PDF。',outcome_unknown:'请求结果未知，未自动重发；请打开资料核对批次。',local_parse_failed:'本地解析未完成，请先重试收录。',local_page_failed:'有本地识别失败页，请打开资料重试。',blank_page_requires_check:'本地判为空白的页仍待图像核对。',no_structured_content:'尚无可直接逐题处理的正文，请打开资料核对。',needs_review:'模型结果存在疑点，保留待核对。'};
const message=(error:unknown)=>error==='teacher_paused'?'此资料的AI批次已由老师手动暂停；请打开资料决定是否继续。':Object.entries(errors).find(([code])=>String(error).includes(code))?.[1]||'处理未完成，请刷新后重试。';
/** One durable grant for this folder batch; individual pages still pass the original source/privacy gates. */
export function MaterialFolderAiPanel({batchId,open}:{batchId:string;open:(id:string)=>void}){
 const [view,setView]=useState<FolderAiView>(),[settings,setSettings]=useState<AiSettings>(),[form,setForm]=useState(false),[budget,setBudget]=useState(200),[consent,setConsent]=useState(false),[publicMaterial,setPublic]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true,reading=false;const poll=async()=>{if(reading)return;reading=true;try{const next=await window.omniEdu?.getMaterialFolderAi({schemaVersion:schema,batchId});if(active)setView(next);}catch{if(active)setError('后台AI状态暂不可用。');}finally{reading=false;}};void poll();const timer=setInterval(poll,1600);return()=>{active=false;clearInterval(timer);};},[batchId]);
 const authorize=async()=>{if(!settings||busy)return;setBusy(true);setError('');try{const next=await window.omniEdu?.authorizeMaterialFolderAi({schemaVersion:schema,batchId,settingsRevision:settings.revision,maxCalls:budget,cloudConsent:true,publicMaterial:true});setView(next);setForm(false);setConsent(false);setPublic(false);}catch(e){setError(message(e));}finally{setBusy(false);}};
 const action=async(action:'pause'|'resume')=>{setBusy(true);setError('');try{setView(await window.omniEdu?.controlMaterialFolderAi({schemaVersion:schema,batchId,action}));}catch(e){setError(message(e));}finally{setBusy(false);}};
 return <DisclosureCard className="material-folder-ai" data-testid={'folder-ai-'+batchId} title={'后台 AI 整理'+(view?` · ${labels[view.status]||'等待处理'}`:' · 尚未授权')}>
  <p>本地收录完成后，明确无题的封面直接跳过，其余资料逐页或逐题交给DeepSeek对照原图整理。原始OCR与AI稿分别保存，疑点保留待处理；归档和正文可查不代表题目已经核对。</p>
  {view&&<><p role="status" data-testid="folder-ai-counts">涉及 {view.resources} 份资料 · 单元 {view.complete} 已完成 / {view.units} 已安排 · {view.waiting} 等待或处理中 · {view.review+view.failed} 待处理；AI自动稿 {view.readyQuestions} 题，待核对 {view.reviewQuestions} 题。调用 {view.calls} / {view.maxCalls}（已预留 {view.reserved}）。</p>
   {view.skippedCover>0&&<p role="status" data-testid="folder-ai-skipped-cover">其中 {view.skippedCover} 页为非题目封面，已直接跳过，未调用AI。原始资料保留。</p>}
   <div className="teacher-library-toolbar">{['running','budget_exhausted'].includes(view.status)?<Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>void action('pause')} data-testid="folder-ai-pause">暂停AI</Button>:view.status==='paused'?<Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>void action('resume')} data-testid="folder-ai-resume">继续本批授权范围</Button>:null}</div>
   {view.error&&<p role="alert">{message(view.error)}</p>}{view.issues.map(issue=><p key={issue.resourceId+':'+issue.unit}>{issue.title} · 单元 {issue.unit}：{message(issue.error)} <Button size="sm" variant="ghost" onPress={()=>open(issue.resourceId)}>打开资料处理</Button></p>)}
  </>}
  <Button size="sm" variant="secondary" isDisabled={busy} onPress={()=>{setForm(!form);setConsent(false);setPublic(false);void window.omniEdu?.getMaterialAiSettings().then(setSettings).catch(e=>setError(message(e)));}} data-testid="folder-ai-open-authorization">{view?'调整本批AI授权':'开启本批AI整理'}</Button>
  {form&&<div data-testid="folder-ai-authorization"><p>授权范围为这个文件夹批次已归档和随后归档的资料，仅发送必要页或题图及OCR文字。使用小智统一DeepSeek账户，按实际调用计费；每单元预留两次，额度不足暂停新单元，结果未知不会自动重发。</p>
   <label>本批调用上限 <input type="number" min={2} max={1000000} value={budget} onChange={e=>setBudget(Number(e.target.value))} data-testid="folder-ai-budget"/></label>
   <label><input type="checkbox" checked={publicMaterial} onChange={e=>setPublic(e.target.checked)} data-testid="folder-ai-public"/>确认本批资料可用于云端处理，不含需保护的个人信息</label>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} data-testid="folder-ai-consent"/>授权本批必要页或题图、OCR文字发送至DeepSeek</label>
   {!settings?.configured||!settings.secureStorage?<p role="status">请先完成小智统一DeepSeek设置与Windows安全存储准备；当前未发送。</p>:null}
   <Button size="sm" isDisabled={busy||!settings?.configured||!settings.secureStorage||!consent||!publicMaterial||!Number.isSafeInteger(budget)||budget<2||budget>1000000} onPress={()=>void authorize()} data-testid="folder-ai-authorize">授权并后台整理</Button>
  </div>}{error&&<p role="alert">{error}</p>}
 </DisclosureCard>;
}
