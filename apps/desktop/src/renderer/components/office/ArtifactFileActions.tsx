import {useEffect,useRef,useState} from 'react';
import {Button,Dropdown,Label} from '@heroui/react';
import {ChevronDown,ExternalLink,FileText,Folder,FolderOpen,LocateFixed,Save} from 'lucide-react';
import {ARTIFACT_FILE_ERRORS,type ArtifactFileAction,type ArtifactFileTarget} from '../../../shared/artifact-file-actions';
import '../../ui-system/artifact-file-actions.css';

function FileLocation({parts,index=0}:{parts:string[];index?:number}){
  const isFile=index===parts.length-1;
  const Icon=isFile?FileText:Folder;
  return <ul><li><span className="artifact-file-location-row" aria-current={isFile?'true':undefined} title={parts[index]}><Icon size={14} aria-hidden="true"/><span>{parts[index]}</span></span>
    {!isFile&&<FileLocation parts={parts} index={index+1}/>}
  </li></ul>;
}

export function ArtifactFileActions({target,onLocate}:{target:ArtifactFileTarget;onLocate?:()=>Promise<boolean>}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{text:string;error?:boolean}>();
  const [location,setLocation]=useState<string[]>();
  const lifecycle=useRef(0),pending=useRef(false);
  useEffect(()=>()=>{++lifecycle.current;},[]);

  async function execute(action:ArtifactFileAction){
    if(pending.current)return;
    const stamp=lifecycle.current;
    pending.current=true;
    setBusy(true);
    setMessage(undefined);
    try{
      if(action==='location'&&onLocate){
        const found=await onLocate();
        if(stamp===lifecycle.current&&!found)setMessage({text:'文件树中暂未找到此文件，请刷新目录。',error:true});
        return;
      }
      const result=await window.omniEdu?.artifactFileAction({target,action});
      if(stamp!==lifecycle.current)return;
      if(!result?.ok){
        setMessage({text:result?ARTIFACT_FILE_ERRORS[result.error]:ARTIFACT_FILE_ERRORS.failed,error:true});
        return;
      }
      if(result.cancelled)return;
      if(result.location){
        setLocation(result.location);
        return;
      }
      if(result.name)setMessage({text:`已另存为 ${result.name}`});
    }catch{
      if(stamp===lifecycle.current)setMessage({text:ARTIFACT_FILE_ERRORS.failed,error:true});
    }finally{
      pending.current=false;
      if(stamp===lifecycle.current)setBusy(false);
    }
  }

  const items=[
    {id:'open',label:'用默认应用打开',icon:ExternalLink},
    ...(window.omniEdu?.canChooseArtifactApplication?[{id:'open-with',label:'选择打开方式…',icon:ExternalLink}]:[]),
    {id:'location',label:onLocate?'在文件树中定位':'查看文件位置',icon:LocateFixed},
    {id:'reveal',label:'在资源管理器中显示',icon:FolderOpen},
    {id:'save-as',label:'另存为…',icon:Save},
  ] as const;
  return <div className="artifact-file-actions">
    <Dropdown>
      <Button variant="ghost" size="sm" aria-label="文件操作" isDisabled={busy} data-testid="artifact-file-actions">
        <FileText size={15} aria-hidden="true"/><span>文件操作</span><ChevronDown size={13} aria-hidden="true"/>
      </Button>
      <Dropdown.Popover placement="bottom end" data-heroui-native="" data-theme="light" className="artifact-file-menu">
        <Dropdown.Menu aria-label="文件操作" onAction={key=>void execute(String(key) as ArtifactFileAction)}>
          {items.map(({id,label,icon:Icon})=><Dropdown.Item id={id} key={id} textValue={label} data-testid={`artifact-file-${id}`}>
            <Icon size={15} aria-hidden="true"/><Label>{label}</Label>
          </Dropdown.Item>)}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
    {message&&<p role={message.error?'alert':'status'} data-testid="artifact-file-action-message">{message.text}</p>}
    {location&&<details open className="artifact-file-location" data-testid="artifact-file-location">
      <summary>文件位置</summary><FileLocation parts={location}/>
    </details>}
  </div>;
}
