import {useEffect,useRef,useState} from 'react';
import {Button,Checkbox,TextArea} from '@heroui/react';
import {ScanText,Square} from 'lucide-react';
import type {TeacherResource} from '../../../shared/contracts';
import {materialPreviewErrorText,type MaterialPreviewResult} from '../../../shared/material-page-preview';
import {MATERIAL_LAYOUT_SCHEMA,type LayoutError,type MaterialLayoutResult,type PdfLayout} from '../../../shared/material-layout';
type Preview=Extract<MaterialPreviewResult,{ok:true}>;
function layoutError(error:LayoutError){const specific:Partial<Record<LayoutError,string>>={cache_invalid:'上次识别结果不完整，请重新识别。',cancelled:'已停止文字识别。',timeout:'文字识别超时，请重试。',parse_failed:'文字识别未完成，请对照原图后重试。',configuration:'本地文字识别组件不完整，请修复后重试。',unavailable:'本地文字识别暂不可用，请重试。'};return specific[error]??materialPreviewErrorText(error as Exclude<LayoutError,'cache_invalid'>);}
export function MaterialLayoutLines({layout,selected,toggle}:{layout:PdfLayout;selected:string[];toggle:(id:string)=>void}){
 return <div className="material-layout-lines" aria-label="原页文字区域" data-testid="materials-layout-lines">{layout.lines.map(line=><Checkbox key={line.id} isSelected={selected.includes(line.id)} onChange={()=>toggle(line.id)} data-testid={`materials-layout-${line.id}`}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><span>{line.text}</span></Checkbox.Content></Checkbox>)}</div>;
}
export function MaterialLayoutPreview({resource,preview,zoom,busy}:{resource:TeacherResource;preview:Preview;zoom:boolean;busy:boolean}){
 const [result,setResult]=useState<MaterialLayoutResult>(),[loading,setLoading]=useState(false),[stopping,setStopping]=useState(false),[selected,setSelected]=useState<string[]>([]),[draft,setDraft]=useState(''),[edited,setEdited]=useState(false);
 const request=useRef<string|undefined>(undefined),cancelled=useRef<string|undefined>(undefined),pending=useRef(false);
 useEffect(()=>()=>{const id=request.current;request.current=undefined;if(id)void window.omniEdu?.cancelMaterialPageLayout({schemaVersion:MATERIAL_LAYOUT_SCHEMA,requestId:id}).catch(()=>{});},[]);
 const stop=()=>{const id=request.current;if(id){cancelled.current=id;setResult({schemaVersion:MATERIAL_LAYOUT_SCHEMA,ok:false,error:'cancelled'});setLoading(false);setStopping(pending.current);void window.omniEdu?.cancelMaterialPageLayout({schemaVersion:MATERIAL_LAYOUT_SCHEMA,requestId:id}).catch(()=>{});}};
 const recognize=(refresh:boolean)=>{
  if(pending.current)return;const id=crypto.randomUUID();request.current=id;pending.current=true;setLoading(true);setResult(undefined);setSelected([]);setDraft('');setEdited(false);
  void (window.omniEdu?.getMaterialPageLayout({schemaVersion:MATERIAL_LAYOUT_SCHEMA,requestId:id,resourceId:resource.id,version:resource.contentHash,page:preview.page,refresh})??Promise.reject()).then(value=>{if(request.current===id&&cancelled.current!==id)setResult(value.ok&&(value.layout.rasterSha256!==preview.sha256||value.layout.width!==preview.width||value.layout.height!==preview.height)?{schemaVersion:MATERIAL_LAYOUT_SCHEMA,ok:false,error:'parse_failed'}:value);}).catch(()=>{if(request.current===id&&cancelled.current!==id)setResult({schemaVersion:MATERIAL_LAYOUT_SCHEMA,ok:false,error:'unavailable'});}).finally(()=>{if(request.current===id){pending.current=false;setLoading(false);setStopping(false);}});
 };
 const layout=result?.ok?result.layout:undefined;
 const extract=(ids:string[])=>layout?.lines.filter(line=>ids.includes(line.id)).map(line=>line.text).join('\n')||'';
 const toggle=(id:string)=>{const ids=selected.includes(id)?selected.filter(n=>n!==id):[...selected,id];setSelected(ids);if(!edited)setDraft(extract(ids));};
 return <>
  <div className="material-original-paper" data-testid="materials-original-paper" tabIndex={0} aria-label="原页图像，可滚动查看">
   <div className={`material-layout-raster${zoom?' is-enlarged':''}`}>
    <img className={zoom?'is-enlarged':undefined} src={preview.dataUrl} alt={`${resource.title}，原件第 ${preview.page} 页`} width={preview.width} height={preview.height} data-testid="materials-original-image"/>
    {layout&&<svg className="material-layout-overlay" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label="可选文字框" data-testid="materials-layout-overlay">{layout.lines.map(line=><polygon key={line.id} points={line.quad.map(point=>point.join(',')).join(' ')} className={selected.includes(line.id)?'is-selected':undefined} role="button" aria-label={`选择文字：${line.text}`} aria-pressed={selected.includes(line.id)} tabIndex={0} onClick={()=>toggle(line.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle(line.id);}}}/>)}</svg>}
   </div>
  </div>
  <section className="material-layout" data-testid="materials-layout" aria-label="原页文字核对">
   <div className="material-layout-toolbar">
    {loading?<Button variant="secondary" onPressStart={stop} data-testid="materials-layout-stop"><Square size={14}/>停止识别</Button>:<Button variant="secondary" onPress={()=>recognize(!!result)} isDisabled={busy||stopping} data-testid="materials-layout-start"><ScanText size={16}/>{result?'重新识别文字区域':'识别文字区域'}</Button>}
    <p className="teacher-library-caption">在原页选择文字并核对；文字框不代表完整题目。</p>
   </div>
   {loading?<p role="status" data-testid="materials-layout-loading">正在本机识别文字区域…</p>:result&&!result.ok?<p role="alert" data-testid="materials-layout-error">{layoutError(result.error)}</p>:layout?<>
    <p role="status" data-testid="materials-layout-status" data-cached={result?.ok?result.cached:undefined}>{layout.lines.length?`${result?.ok&&result.cached?'已读取上次识别结果':'已识别'} · ${layout.lines.length} 个文字区域`:'本页未识别到文字。可继续对照原图，或重新识别。'}</p>
    {!!layout.lines.length&&<><MaterialLayoutLines layout={layout} selected={selected} toggle={toggle}/>
     <div className="material-layout-toolbar"><p>已选 {selected.length} 个区域</p><Button variant="tertiary" onPress={()=>{setSelected([]);setDraft('');setEdited(false);}} data-testid="materials-layout-clear">清除选择和暂存文字</Button><Button variant="tertiary" onPress={()=>{setDraft(extract(selected));setEdited(false);}} isDisabled={!selected.length} data-testid="materials-layout-extract">按所选区域重新提取</Button></div>
     <TextArea aria-label="临时校对文字" value={draft} maxLength={128000} onChange={event=>{setDraft(event.target.value);setEdited(true);}} rows={6} fullWidth data-testid="materials-layout-draft"/>
     <p role="note" className="teacher-library-caption">临时校对文字尚未保存到题库。公式、图形、选项和漏字请以原件为准。{edited?'修改后的文字会保留；重新提取会替换当前暂存文字。':''}</p>
    </>}
   </>:null}
  </section>
 </>;
}
