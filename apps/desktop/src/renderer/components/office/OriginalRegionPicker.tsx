import {useEffect,useRef,useState} from 'react';
import {Button,Modal} from '@heroui/react';
import ReactCrop,{type PercentCrop} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {MATERIAL_PREVIEW_SCHEMA,validPageBox,materialPreviewErrorText,type MaterialPreviewResult,type PageBox} from '../../../shared/material-page-preview';
import './original-region-picker.css';
type Preview=Extract<MaterialPreviewResult,{ok:true}>;
/** Crop UI only: authoritative crop bytes and source CAS remain in the existing main host. */
export function OriginalRegionPicker({source,box,disabled,label,onApply}:{source:Preview;box:PageBox;disabled:boolean;label:string;onApply:(box:PageBox)=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[retry,setRetry]=useState(0),[preview,setPreview]=useState<Preview>(),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[crop,setCrop]=useState<PercentCrop>();
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!open)return;let live=true;const requestId=crypto.randomUUID();setPreview(undefined);setLoading(true);setNotice('');setCrop({unit:'%',x:box[0]*100,y:box[1]*100,width:(box[2]-box[0])*100,height:(box[3]-box[1])*100});
  void (window.omniEdu?.getMaterialPagePreview({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId,resourceId:source.resourceId,version:source.version,page:source.page,box:[0,0,1,1]})??Promise.reject()).then(r=>{
   if(!live)return;if(r.ok&&r.resourceId===source.resourceId&&r.version===source.version&&r.page===source.page&&r.box.every((v,i)=>v===[0,0,1,1][i]))setPreview(r);
   else setNotice(r.ok?'原页与当前资料不一致，请重新读取原题。':materialPreviewErrorText(r.error));
  }).catch(()=>{if(live)setNotice('原页读取未完成，请重试。');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;void window.omniEdu?.cancelMaterialPagePreview({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId}).catch(()=>{});};
 },[open,retry,source.resourceId,source.version,source.page]);
 const selected:PageBox|undefined=crop?[crop.x/100,crop.y/100,(crop.x+crop.width)/100,(crop.y+crop.height)/100].map(v=>Math.max(0,Math.min(1,v))) as PageBox:undefined;
 async function apply(){if(lock.current||!selected||!validPageBox(selected)||!preview||disabled)return;lock.current=true;setSaving(true);setNotice('');try{if(await onApply(selected)){if(alive.current)setOpen(false);}else if(alive.current)setNotice('范围更新未完成，请查看原题提示后重试。');}catch{if(alive.current)setNotice('范围更新未完成，请重试。');}finally{lock.current=false;if(alive.current)setSaving(false);}}
 return <><Button variant="secondary" size="sm" isDisabled={disabled} onPress={()=>setOpen(true)} data-testid="original-range-pick">框选范围</Button>
  <Modal.Backdrop isOpen={open} onOpenChange={value=>{if(!lock.current)setOpen(value);}} isDismissable={!saving} isKeyboardDismissDisabled={saving}>
   <Modal.Container size="lg" scroll="inside"><Modal.Dialog className="original-region-picker" data-testid="original-region-picker">
    <Modal.Header><Modal.Heading>{label} · 第 {source.page} 页</Modal.Heading><p>在原页拖出矩形，或聚焦选框后用方向键微调。范围更新后请重新核对完整题面。</p></Modal.Header>
    <Modal.Body>{loading?<p role="status">正在本机打开原页…</p>:preview?<div className="original-region-raster" data-testid="original-region-raster"><ReactCrop crop={crop} onChange={(_pixel,percent)=>setCrop(percent)} disabled={saving} keepSelection minWidth={8} minHeight={8} ariaLabels={{cropArea:'题目选框，可用方向键移动',nwDragHandle:'左上角',nDragHandle:'上边',neDragHandle:'右上角',eDragHandle:'右边',seDragHandle:'右下角',sDragHandle:'下边',swDragHandle:'左下角',wDragHandle:'左边'}}><img src={preview.dataUrl} width={preview.width} height={preview.height} draggable={false} alt={`原件第${source.page}页`} data-testid="original-region-page"/></ReactCrop></div>:null}
     {notice&&<p role="alert" data-testid="original-region-error">{notice}</p>}
    </Modal.Body><Modal.Footer><Button variant="secondary" isDisabled={saving} onPress={()=>setOpen(false)} data-testid="original-region-cancel">取消</Button>{!preview&&!loading&&<Button variant="secondary" onPress={()=>setRetry(n=>n+1)} data-testid="original-region-retry">重新读取</Button>}<Button isPending={saving} isDisabled={loading||!preview||!selected||!validPageBox(selected)||disabled} onPress={()=>void apply()} data-testid="original-region-apply">使用此范围</Button></Modal.Footer>
   </Modal.Dialog></Modal.Container>
  </Modal.Backdrop></>;
}
