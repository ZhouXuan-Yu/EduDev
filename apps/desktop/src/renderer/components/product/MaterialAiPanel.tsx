import {useCallback,useEffect,useState} from 'react';
import type {TeacherResource} from '../../../shared/contracts';
import {MATERIAL_AI_SCHEMA,type AiSettings,type AiBatchView,type AiAction} from '../../../shared/material-ai';
import './material-ai.css';
import {MaterialAiPagePanel} from './MaterialAiPagePanel';
import {MaterialBookPanel} from './MaterialBookPanel';
import type {MaterialBookPairView} from '../../../shared/material-book-pair';

const errors:Record<string,string>={page_restoration_disabled:'原页还原暂时停用，已存的题目和还原结果仍可查看。',ocr_unavailable:'本地OCR运行包不可用，未发送图片。请修复安装后重新选择此范围。',ocr_failed:'本地OCR未完成，未发送这一项。可对照原件处理后重新选择范围。',font_unavailable:'本机排版字体不可用，尚未发送题图。',font_missing_glyph:'题目有当前字体无法显示的字符，请补齐字体后重新整理。',disk_full:'保存题图的磁盘空间不足，批次已停止。',timeout:'本地整理超时，请拆小范围后重试。',busy:'本地处理器忙，请稍后重试。',index_busy:'另一个进程正在保存题图，请稍后重试。',ai_omitted_questions:'AI遗漏了本地识别出的题号，已阻止标为完成。请重新选择此范围建立新批次，或对照原件补齐题本。',unified_settings:'请在小智模型设置修改统一DeepSeek配置。',configuration:'请先配置小智的DeepSeek；配置变化后需建立新批次重新授权。',storage_unavailable:'Windows安全存储不可用，未保存密钥，也未发送资料。',conflict:'配置已变化，请刷新后重新操作。',source_changed:'原件或正文已变化，请重新收录后建立新批次。',source_incomplete:'所选范围存在未完成页或缺失正文，请先完成本地收录。',unit_too_large:'所选单页文字过多，请先拆分资料。',privacy_blocked:'检测到个人信息或脱敏会改变图片内容，未发送这一项。请在本地处理并移除个人信息。',unsupported:'本格式暂不能做原图对照，可使用正文整理，或转换为PDF。',budget_exhausted:'调用额度已用完，未继续发送。请检查结果后建立新批次。',authentication:'模型账户凭证无效，请检查配置后新建批次。',rate_limit:'模型服务限流，结果保留，请稍后决定是否重发。',outcome_unknown:'请求结果未知，已停止自动发送；重发可能重复计费。',invalid_response:'模型结果未通过结构校验，未作为完整题目入库。',provider_rejected:'模型拒绝了请求，请检查账户和模型。'};
const errorText=(value:unknown)=>{const message=value instanceof Error?value.message:String(value);return Object.entries(errors).find(([key])=>message.includes(key))?.[1]||'操作未完成，请刷新状态后重试。';};
const labels:Record<string,string>={running:'正在整理',paused:'已暂停（继续前请核对本批授权）',attention:'部分结果需处理',complete:'批次完成',configuration_changed:'模型配置已变化',pending:'等待',first_saved:'初稿已保存',dispatched:'等待模型响应',review:'待整理',failed:'未完成',outcome_unknown:'结果未知',no_questions:'无习题'};

export function MaterialAiPanel({resource}:{resource:TeacherResource}){
  const [book,setBook]=useState<MaterialBookPairView>();const bookChanged=useCallback((view:MaterialBookPairView)=>{setBook(view);if(view.role?.kind==='answers')setImages(true);},[]);
  const [settings,setSettings]=useState<AiSettings>();const model=settings?.model||'deepseek-flash';
  const [batches,setBatches]=useState<AiBatchView[]>([]),[batchOffset,setBatchOffset]=useState(0),[start,setStart]=useState(1),[count,setCount]=useState(1),[maxCalls,setMaxCalls]=useState(4),[images,setImages]=useState(false);
  const [consent,setConsent]=useState(false),[publicMaterial,setPublic]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const pdf=/\.pdf$/i.test(resource.originalFileName),image=/\.(?:jpg|jpeg|png|webp)$/i.test(resource.originalFileName),word=/\.docx$/i.test(resource.originalFileName),canImage=pdf||image||word;
  useEffect(()=>{let current=true;void window.omniEdu?.getMaterialAiSettings().then(s=>{if(current){setSettings(s);}}).catch(e=>{if(current)setError(errorText(e));});return()=>{current=false;};},[]);
  useEffect(()=>{let current=true,inFlight=false;const poll=async()=>{if(inFlight)return;inFlight=true;try{const rows=await window.omniEdu?.getMaterialAiBatches(resource.id,batchOffset);if(current&&rows)setBatches(rows);}catch(e){if(current)setError(errorText(e));}finally{inFlight=false;}};void poll();const timer=setInterval(()=>void poll(),1500);return()=>{current=false;clearInterval(timer);};},[resource.id,batchOffset]);
  useEffect(()=>{setConsent(false);setPublic(false);},[resource.id,resource.contentHash,start,count,maxCalls,images,model,settings?.revision,book?.role?.kind,book?.role?.revision]);
  async function create(){setBusy(true);setError('');setNotice('');try{await window.omniEdu!.createMaterialAiBatch({schemaVersion:MATERIAL_AI_SCHEMA,resourceId:resource.id,version:resource.contentHash,settingsRevision:settings!.revision,start,count,maxCalls,images,cloudConsent:true,publicMaterial:true});setConsent(false);setPublic(false);setBatchOffset(0);setBatches(await window.omniEdu!.getMaterialAiBatches(resource.id));setNotice('已启动本批次，结果自动进入题本。可继续使用小智或暂停。');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  async function action(id:string,action:AiAction['action']){setBusy(true);setError('');try{await window.omniEdu!.controlMaterialAiBatch({schemaVersion:MATERIAL_AI_SCHEMA,batchId:id,action,...(action==='retry_unknown'?{acceptDuplicateCharge:true as const}:{})});setBatches(await window.omniEdu!.getMaterialAiBatches(resource.id,batchOffset));}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  const valid=Number.isSafeInteger(start)&&start>=1&&Number.isSafeInteger(count)&&count>=1&&count<=100&&Number.isSafeInteger(maxCalls)&&maxCalls>=2*count&&maxCalls<=400;
  return <><MaterialBookPanel resource={resource} onChange={bookChanged}/><details className="material-ai" data-testid="material-ai-panel"><summary>AI深度整理（可选）</summary>
    {book?.role?.kind==='answers'&&<p data-testid="material-ai-answer-role">本文件是独立答案册：两遍对照原图还原答案原文，保留章节、题号和解析；本批次不生成新题。已关联题册会在后台匹配已知答案，有疑点时保留候选。</p>}
    <p>按所选范围分析题目、答案与解析，再对原文复核。完整文字题和已保留图义的 Word 题自动定稿入题本，正式组卷时集中确认；AI结果仍可编辑。缺图、跨页或两次结果不一致的题保留待整理。</p>
    <fieldset disabled={busy}><legend>统一 DeepSeek 模型</legend>
      <p>知识库图文整理使用 deepseek-flash，复用小智模型设置中的 DeepSeek API Key，本机OCR照常运行。此处不保存第二份密钥。</p>
      <p data-testid="material-ai-shared-settings">{settings?.configured?'已读取小智的 DeepSeek 配置。':'尚未配置 DeepSeek，请先到小智模型设置填写 API Key。'}</p>
      <button data-testid="material-ai-refresh-settings" className="secondary-action" onClick={()=>{setBusy(true);setError('');void window.omniEdu!.getMaterialAiSettings().then(setSettings).catch(e=>setError(errorText(e))).finally(()=>setBusy(false));}}>重新读取统一配置</button>
    </fieldset>
    <fieldset disabled={busy}><legend>本次处理范围 · {resource.originalFileName}</legend>
      <div className="material-ai-range"><label>从第几{pdf?'页':word&&images?'题':'段'}<input data-testid="material-ai-start" type="number" min={1} max={pdf?10000:10000000} value={start} onChange={e=>setStart(e.target.valueAsNumber)}/></label>
      <label>处理{pdf?'页':word&&images?'题':'段'}数<input data-testid="material-ai-count" type="number" min={1} max={100} value={count} onChange={e=>{setCount(e.target.valueAsNumber);setMaxCalls(Math.min(400,Math.max(4,e.target.valueAsNumber*2)));}}/></label>
      <label>调用次数上限<input data-testid="material-ai-budget" type="number" min={2} max={400} value={maxCalls} onChange={e=>setMaxCalls(e.target.valueAsNumber)}/></label></div>
      <p>每项通常调用两次，最多100项。次数包含已发出但结果未知的请求，费用按你的模型账户计费。Word图文对照按“按题查看”中的原文位置选择，每次只处理一题；其他正文片段可能跨题；跨页题和独立答案册仍需后续配对。</p>
      <label className="material-ai-check"><input data-testid="material-ai-images" type="checkbox" checked={images} disabled={!canImage||book?.role?.kind==='answers'} onChange={e=>setImages(e.target.checked)}/><span>同时发送必要原页/图片，与本地OCR对照（PDF、已收录图片或 Word 按题图稿）</span></label>
      <label className="material-ai-check"><input data-testid="material-ai-public" type="checkbox" checked={publicMaterial} onChange={e=>setPublic(e.target.checked)}/><span>我确认本范围为有权处理的教学资料，不含学生身份、答卷或其他个人信息。图片不会通过文字脱敏自动变安全。</span></label>
      <label className="material-ai-check"><input data-testid="material-ai-consent" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>仅授权本批次向 DeepSeek 模型发送第{start}起的{count}{pdf?'页':word&&images?'题':'段'}必要文字{images?(word?'及对应题面、答案、解析图稿':'及对应原页图片'):''}，最多{maxCalls}次调用。</span></label>
      <button data-testid="material-ai-create" className="primary-action" disabled={!valid||!settings?.configured||settings.model!==model||!consent||!publicMaterial} onClick={()=>void create()}>开始本批次AI整理</button>
    </fieldset>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    {batches.length===0?<p>没有AI整理批次，导入资料不会自动上传。</p>:batches.map(batch=><article key={batch.id} data-testid="material-ai-batch" data-batch-id={batch.id} data-status={batch.status}>
      <p><strong>{labels[batch.status]||batch.status}</strong> · {batch.model} · 第{batch.start}起{batch.count}项{batch.images?' · 图文对照':' · 正文整理'}</p>
      <p data-testid="material-ai-summary">完成{batch.complete}，待整理{batch.review}，失败{batch.failed}，结果未知{batch.unknown}，等待{batch.pending}；已入题本{batch.questions}题；调用{batch.calls}/{batch.maxCalls}次</p>
      <MaterialAiPagePanel bookRevision={book?.role?.kind==='questions'?book.revision:undefined} batchId={batch.id} units={batch.units} start={batch.start}/>
      <div className="toolbar-row">{batch.status==='running'?<button disabled={busy} onClick={()=>void action(batch.id,'pause')}>暂停此批次</button>:batch.pending>0&&batch.status!=='configuration_changed'?<button disabled={busy} onClick={()=>void action(batch.id,'resume')}>继续本批次授权范围</button>:null}
        {batch.unknown>0&&batch.calls<batch.maxCalls&&<button data-testid="material-ai-retry-unknown" disabled={busy||batch.status==='configuration_changed'} onClick={()=>void action(batch.id,'retry_unknown')}>同意可能重复计费，重发未知项</button>}</div>
      {(batch.review>0||batch.failed>0)&&<button disabled={busy} onClick={()=>{setStart(batch.start);setCount(batch.count);setImages(batch.images);setMaxCalls(Math.max(4,batch.count*2));setConsent(false);setPublic(false);setNotice('已复制处理范围，请重新核对并为新批次授权。');}}>重新选择此范围</button>}
      {batch.units.some(u=>u.error)&&<ul>{batch.units.filter(u=>u.error).slice(0,5).map(u=><li key={u.ordinal}>第{batch.start+u.ordinal-1}项：{errorText(u.error)}</li>)}</ul>}
    </article>)}
    {(batchOffset>0||batches.length===10)&&<div className="toolbar-row"><button disabled={busy||batchOffset===0} onClick={()=>setBatchOffset(Math.max(0,batchOffset-10))}>前10个批次</button><span>第{Math.floor(batchOffset/10)+1}页，进行中批次优先</span><button disabled={busy||batches.length<10} onClick={()=>setBatchOffset(batchOffset+10)}>后10个批次</button></div>}
  </details></>;
}
