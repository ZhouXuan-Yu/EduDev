import {useEffect,useRef,useState} from 'react';
import type {TeacherResource} from '../../../shared/contracts';
import {WORD_PAGES_SCHEMA,type WordPagesView} from '../../../shared/material-word-pages';

const messages:Record<string,string>={source_changed:'原件或页面快照已变化，请重新核对这份资料。',unsupported:'当前只支持 DOCX 原版页面。',too_large:'文档或输出过大，请拆分后处理。',cancelled:'已停止生成，可稍后继续。',busy:'本机正在处理其他文档，请稍后重试。',disk_full:'保存页面的磁盘空间不足，请释放空间后重试。',unavailable:'本地转换组件暂不可用，请检查网络或组件后重试。',timeout:'文档转换超时，请重试或拆分文档。',parse_failed:'原版页面生成未完成，请检查文档后重试。',interrupted:'上次生成已中断，可继续处理。'};
const message=(error:unknown)=>{const text=error instanceof Error?error.message:String(error);return Object.entries(messages).find(([key])=>text.includes(key))?.[1]||'暂时无法读取原版页面状态，请重试。';};

/** Original navigation and PDF workflows remain responsible for viewing, OCR and cloud grants. */
export function MaterialWordPagesPanel({resource,disabled,onOpen}:{resource:TeacherResource;disabled:boolean;onOpen?:(id:string)=>void}){
 const [view,setView]=useState<WordPagesView>(),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),original=/\.docx$/i.test(resource.originalFileName),supported=original||/\.pdf$/i.test(resource.originalFileName);
 const query={schemaVersion:WORD_PAGES_SCHEMA,resourceId:resource.id,version:resource.contentHash};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  let active=true;
  if(!supported){setLoading(false);return;}
  void window.omniEdu?.getMaterialWordPages(query).then(next=>{if(active){setView(next);setError('');}}).catch(error=>{if(active)setError(message(error));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[resource.id,resource.contentHash,supported]);
 useEffect(()=>{
  if(!working&&view?.status!=='running')return;
  let active=true,inFlight=false;
  const poll=async()=>{if(inFlight)return;inFlight=true;try{const next=await window.omniEdu?.getMaterialWordPages(query);if(active)setView(next);}catch(error){if(active)setError(message(error));}finally{inFlight=false;}};
  const timer=setInterval(()=>void poll(),700);void poll();
  return()=>{active=false;clearInterval(timer);};
 },[resource.id,resource.contentHash,working,view?.status]);
 async function prepare(){
  setWorking(true);setError('');
  try{const next=await window.omniEdu!.prepareMaterialWordPages(query);if(alive.current)setView(next);}
  catch(error){if(alive.current)setError(message(error));}
  finally{
   // A stop can settle before the first progress poll. Read its durable terminal state.
   if(alive.current){
    try{const next=await window.omniEdu!.getMaterialWordPages(query);if(alive.current)setView(next);}catch{/* Preserve the action's error feedback. */}
    if(alive.current)setWorking(false);
   }
  }
 }
 async function cancel(){try{await window.omniEdu!.cancelMaterialWordPages(query);}catch(error){if(alive.current)setError(message(error));}}
 if(!supported||!original&&!view)return null;
 if(view?.role==='pages')return <section data-testid="word-pages-origin" aria-label="Word页面来源">
  <p className="teacher-library-caption">Word 版式快照 · {view.original.name}</p>
  {onOpen&&<button type="button" disabled={disabled||!view.originalAvailable} data-testid="word-pages-original-open" onClick={()=>onOpen(view.original.id)}>查看 Word 原件</button>}
 </section>;
 const running=working||view?.status==='running';
 const component=view?.component;
 return <section data-testid="word-pages-panel" aria-label="Word原版页面">
  <p className="teacher-library-caption">生成保留原排版的本地 PDF，继续按页识别和整理题目。生成页面无需调用模型。</p>
  <div className="material-ai-actions">
   <button type="button" data-testid="word-pages-prepare" disabled={disabled||loading||running} onClick={()=>void prepare()}>{view?.pdf?'核验页面快照':view&&view.status!=='idle'?'重试生成原版页面':'生成原版页面'}</button>
   {running&&<button type="button" data-testid="word-pages-cancel" onClick={()=>void cancel()}>停止生成</button>}
   {view?.pdf&&onOpen&&<button type="button" data-testid="word-pages-open" disabled={disabled||running} onClick={()=>onOpen(view.pdf!.id)}>查看原版页面</button>}
  </div>
  {loading?<p role="status">正在读取页面状态…</p>:running?<p role="status" data-testid="word-pages-status">{component&&component.phase!=='ready'?`正在准备本地组件，已下载 ${Math.round(component.downloadedBytes/1048576)} MiB`:'正在后台生成原版页面…'}</p>:view?.pdf?<p role="status" data-testid="word-pages-status">原版页面已生成{view.pages?`，共 ${view.pages} 页`:''}，可查看页面及本地识别进度。</p>:view&&view.status!=='idle'?<p role="status" data-testid="word-pages-status">{message(view.error||view.status)}</p>:null}
  {error&&<p role="alert" data-testid="word-pages-error">{error}</p>}
 </section>;
}
