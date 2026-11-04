import {useEffect,useRef,useState} from 'react';
import {Button,Card} from '@heroui/react';
import {SAVED_ARTIFACT_PREVIEW_ERRORS,type SavedArtifactPreviewInput,type SavedArtifactPreviewResult} from '../../../shared/saved-artifact-preview';

/** Read only. Plain parser text cannot load remote links/images or execute HTML. */
export function SavedArtifactPreview({sessionId,artifactId,onClose}:{sessionId:string;artifactId:string;onClose:()=>void}){
  const [result,setResult]=useState<SavedArtifactPreviewResult>(),[reading,setReading]=useState(false),[generation,setGeneration]=useState(0);
  const epoch=useRef(0),pending=useRef<SavedArtifactPreviewInput|undefined>(undefined);
  function cancel(){++epoch.current;const input=pending.current;pending.current=undefined;if(input)void window.omniEdu?.cancelSavedArtifactPreview(input).catch(()=>{});}
  useEffect(()=>{
    const stamp=++epoch.current,input={sessionId,artifactId,requestId:`xifile_${crypto.randomUUID()}`};pending.current=input;
    setResult(undefined);setReading(true);
    void (async()=>{
      try{const value=await window.omniEdu?.previewSavedArtifact(input);if(stamp===epoch.current)setResult(value??{ok:false,requestId:input.requestId,error:'unavailable'});}
      catch{if(stamp===epoch.current)setResult({ok:false,requestId:input.requestId,error:'read_failed'});}
      finally{if(stamp===epoch.current){pending.current=undefined;setReading(false);}}
    })();
    return cancel;
  },[sessionId,artifactId,generation]);
  function stop(){const requestId=pending.current?.requestId??'';cancel();setReading(false);setResult({ok:false,requestId,error:'cancelled'});}
  return <Card aria-label="已保存试卷预览" data-testid="saved-artifact-preview">
    <Card.Header><Card.Title>已保存试卷</Card.Title><Card.Description>只读本地保存文件；文字预览不代表原文件分页或排版。</Card.Description></Card.Header>
    <Card.Content>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
        {reading?<Button variant="ghost" onPress={stop} data-testid="saved-artifact-cancel">停止读取</Button>:<Button variant="ghost" onPress={()=>setGeneration(v=>v+1)} data-testid="saved-artifact-refresh">重新读取</Button>}
        <Button variant="ghost" onPress={()=>{cancel();onClose();}} data-testid="saved-artifact-close">关闭预览</Button>
      </div>
      {reading&&<p role="status" data-testid="saved-artifact-loading">正在读取已保存文件…</p>}
      {result&&!result.ok&&<p role="alert" data-testid="saved-artifact-error">{SAVED_ARTIFACT_PREVIEW_ERRORS[result.error]}</p>}
      {result?.ok&&<div><p>{result.value.name}</p>
        {result.value.warnings.map((warning,index)=><p key={index} role="status">{warning}</p>)}
        <pre data-testid="saved-artifact-document" data-format={result.value.format} data-sha256={result.value.sha256} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:'inherit',lineHeight:1.7,maxHeight:'65vh',overflow:'auto'}}>{result.value.markdown}</pre>
      </div>}
    </Card.Content>
  </Card>;
}
