import {useEffect,useState} from 'react';
import {MATERIAL_AI_PAGE,type SourceCropPreview,type SourceCropSelection} from '../../../shared/material-ai-page';

export function MaterialSourceCropPreview({batchId,ordinal,selection,sha256}:{batchId:string;ordinal:number;selection:SourceCropSelection;sha256:string}){
 const [image,setImage]=useState<SourceCropPreview>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let current=true;setLoading(true);setImage(undefined);setError('');
  void window.omniEdu!.getMaterialAiPage({schemaVersion:MATERIAL_AI_PAGE,batchId,ordinal,cropPreview:{number:selection.number,index:selection.index}}).then(result=>{
   const crop=result.cropPreview;
   if(!crop||crop.number!==selection.number||crop.index!==selection.index||crop.sha256!==sha256)throw Error('source_changed');
   if(current)setImage(crop);
  }).catch(()=>{if(current)setError('这组原图暂不可读取，原件或识别记录可能已变化。请重试或重新核对原页。');}).finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;};
 },[batchId,ordinal,selection.number,selection.index,sha256,retry]);
 return <div data-testid="material-source-crop-preview" aria-label={`第${selection.number}题第${selection.index+1}组原图`}>
  {loading&&<p role="status" data-testid="material-source-crop-loading">正在核对并读取本机原图…</p>}
  {error&&<><p role="alert" data-testid="material-source-crop-error">{error}</p><button className="secondary-action" data-testid="material-source-crop-retry" onClick={()=>setRetry(n=>n+1)}>重试读取</button></>}
  {image&&<><p>这是AI实际核对的裁图。图形、边缘和文字请一并核对；查看不会解除待核状态。</p><img src={image.dataUrl} alt={`第${selection.number}题第${selection.index+1}组实际核对原图`} style={{maxWidth:'100%',height:'auto'}} data-testid="material-source-crop-image"/></>}
 </div>;
}
