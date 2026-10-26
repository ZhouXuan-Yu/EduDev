import {useEffect,useRef,useState} from 'react';
import {Button,Pagination} from '@heroui/react';
import {FileImage,RefreshCw,Square,X} from 'lucide-react';
import {MATERIAL_PREVIEW_SCHEMA,materialPreviewErrorText,type MaterialPreviewResult} from '../../../shared/material-page-preview';
import type {TeacherResource} from '../../../shared/contracts';
import {MaterialLayoutPreview} from './MaterialLayoutPreview';

export function MaterialOriginalPreview({resource,initialPage=1,busy}:{resource:TeacherResource;initialPage?:number;busy:boolean}){
 const [open,setOpen]=useState(false),[page,setPage]=useState(initialPage),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false),[result,setResult]=useState<MaterialPreviewResult>(),[zoom,setZoom]=useState(false);
 const request=useRef<string|undefined>(undefined),cancelled=useRef<string|undefined>(undefined),pending=useRef(false);
 const [stopping,setStopping]=useState(false);
 const [pageDraft,setPageDraft]=useState(String(initialPage)),[pageError,setPageError]=useState('');const total=useRef<number|undefined>(undefined);
 useEffect(()=>{setPage(initialPage);},[initialPage,open]);
 useEffect(()=>{setPageDraft(String(page));setPageError('');},[page]);
 const jump=()=>{if(loading||stopping||busy)return;const number=Number(pageDraft);if(!/^\d+$/.test(pageDraft)||!Number.isSafeInteger(number)||number<1||number>(total.current||10000)){setPageError(`请输入1至${total.current||10000}之间的页码。`);return;}setPageError('');setPage(number);};
 const cancel=()=>{const id=request.current;if(id){cancelled.current=id;setResult({schemaVersion:MATERIAL_PREVIEW_SCHEMA,ok:false,error:'cancelled'});setLoading(false);setStopping(pending.current);void window.omniEdu?.cancelMaterialPagePreview({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:id}).catch(()=>{});}};
 useEffect(()=>{
  setResult(undefined);setZoom(false);if(!open){setLoading(false);return;}
  let current=true;const id=crypto.randomUUID();request.current=id;pending.current=true;setLoading(true);setStopping(false);
  void window.omniEdu?.getMaterialPagePreview({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:id,resourceId:resource.id,version:resource.contentHash,page,box:[0,0,1,1]}).then(value=>{if(current&&cancelled.current!==id){if(value.ok)total.current=value.total;setResult(value);}}).catch(()=>{if(current&&cancelled.current!==id)setResult({schemaVersion:MATERIAL_PREVIEW_SCHEMA,ok:false,error:'unavailable'});}).finally(()=>{if(current){pending.current=false;setLoading(false);setStopping(false);}});
  return()=>{current=false;void window.omniEdu?.cancelMaterialPagePreview({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:id}).catch(()=>{});if(request.current===id)request.current=undefined;};
 },[open,page,revision,resource.id,resource.contentHash]);
 const shown=result?.ok&&result.page!==page?undefined:result;
 if(!/\.pdf$/i.test(resource.originalFileName))return null;
 if(!open)return <Button variant="secondary" onPress={()=>setOpen(true)} isDisabled={busy} data-testid="materials-original-open"><FileImage size={16}/>查看原页</Button>;
 return <section className="material-original" aria-label="原件页面" data-testid="materials-original">
  <header className="material-original-controls"><div><h3>原件第 {page} 页{shown?.ok?` / 共 ${shown.total} 页`:''}</h3><p className="teacher-library-caption">本机预览，公式、图形与选项请以原件为准。</p></div><div className="material-original-actions">
   <label className="material-original-page-jump">页码<input type="number" min={1} max={total.current||10000} value={pageDraft} onChange={event=>{setPageDraft(event.target.value);setPageError('');}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();jump();}}} disabled={loading||stopping||busy} data-testid="materials-original-page-input"/></label><Button variant="secondary" onPress={jump} isDisabled={loading||stopping||busy} data-testid="materials-original-page-jump">跳转</Button>
   {loading?<Button key="stop" variant="secondary" onPressStart={cancel} data-testid="materials-original-stop"><Square size={14}/>停止</Button>:<Button key="refresh" variant="secondary" onPress={()=>setRevision(n=>n+1)} isDisabled={busy||stopping} data-testid="materials-original-refresh"><RefreshCw size={14}/>重新读取</Button>}
   <Button variant="secondary" onPress={()=>setOpen(false)} aria-label="收起原件页面" data-testid="materials-original-close"><X size={16}/></Button>
  </div></header>
  {pageError&&<p role="alert" data-testid="materials-original-page-error">{pageError}</p>}
  {loading?<p role="status" data-testid="materials-original-loading">正在打开原页…</p>:shown&&!shown.ok?<p role="alert" data-testid="materials-original-error">{materialPreviewErrorText(shown.error)}</p>:shown?.ok?<>
   <div className="material-original-zoom"><Button variant="tertiary" onPress={()=>setZoom(v=>!v)} data-testid="materials-original-zoom">{zoom?'适合宽度':'放大查看'}</Button></div>
   <MaterialLayoutPreview key={`${resource.id}:${resource.contentHash}:${shown.page}:${shown.sha256}`} resource={resource} preview={shown} zoom={zoom} busy={busy}/>
  </>:null}
  <Pagination aria-label="原件翻页" className="teacher-library-pagination"><Pagination.Content><Pagination.Item><Pagination.Previous isDisabled={loading||stopping||busy||page<=1} onPress={()=>setPage(n=>n-1)} data-testid="materials-original-previous">上一页</Pagination.Previous></Pagination.Item><Pagination.Item><Pagination.Next isDisabled={loading||stopping||busy||!shown?.ok||page>=shown.total} onPress={()=>setPage(n=>n+1)} data-testid="materials-original-next">下一页</Pagination.Next></Pagination.Item></Pagination.Content></Pagination>
 </section>;
}
