import {useEffect,useRef,useState} from 'react';
import {Button,Card} from '@heroui/react';
import {FileText} from 'lucide-react';
import type {TeachingFileCatalogEntry} from '../../../shared/contracts';
import {ListView} from '../../heroui-pro/components/list-view';
import {SavedArtifactPreview} from './SavedArtifactPreview';
import {PiOfficeCurrent} from './PiOfficeVersions';

/** A catalogue projection, never a filesystem grant. Stale sessions cannot publish. */
export function useConversationSavedFiles(sessionId:string,revision:string){
  const [generation,reload]=useState(0),[data,setData]=useState<{sessionId:string;rows:TeachingFileCatalogEntry[];loading:boolean;error:string}>({sessionId,rows:[],loading:true,error:''});
  const epoch=useRef(0);
  useEffect(()=>{
    const stamp=++epoch.current;setData(previous=>({sessionId,rows:previous.sessionId===sessionId?previous.rows:[],loading:true,error:''}));
    void (async()=>{try{
      const rows=await window.omniEdu?.listDocumentArtifacts();if(!rows)throw Error('unavailable');
      if(stamp===epoch.current)setData({sessionId,rows:rows.filter(row=>row.sessionId===sessionId&&row.status==='exported'&&(!row.officeVersion||row.officeVersion.currentArtifactId===row.id)),loading:false,error:''});
    }catch{if(stamp===epoch.current)setData(previous=>({sessionId,rows:previous.sessionId===sessionId?previous.rows:[],loading:false,error:'暂时无法读取本对话的成果记录。'}));}})();
    return()=>{++epoch.current;};
  },[sessionId,revision,generation]);
  return {...(data.sessionId===sessionId?data:{sessionId,rows:[],loading:true,error:''}),refresh:()=>reload(v=>v+1)};
}

export function ConversationSavedFiles({rows,loading,error,onRetry,onSelect}:{rows:TeachingFileCatalogEntry[];loading:boolean;error:string;onRetry:()=>void;onSelect:(id:string)=>void}){
  return <section style={{minWidth:0,flexShrink:0}}><Card data-heroui-native="" data-theme="light" data-testid="conversation-saved-files" aria-label="本对话保存的成果">
    <Card.Header><Card.Title>本对话成果</Card.Title><Card.Description>点击查看已保存文件；工作目录在下方。</Card.Description></Card.Header>
    <Card.Content>
      {loading?<p role="status">正在读取成果记录…</p>:error?<div role="alert"><p>{error}</p><Button variant="ghost" size="sm" onPress={onRetry}>重试读取</Button></div>:
        <ListView aria-label="本对话成果列表" variant="secondary" selectionMode="none" items={rows} onAction={key=>onSelect(String(key))}
          renderEmptyState={()=><p>最近保存记录中还没有本对话的成果。</p>}>
          {row=><ListView.Item id={row.id} textValue={row.fileName} data-testid="conversation-saved-file" data-artifact-id={row.id}>
            <ListView.ItemContent><FileText size={16} aria-hidden="true"/><div style={{display:'flex',flexDirection:'column',minWidth:0}}><ListView.Title>{row.fileName}</ListView.Title><ListView.Description>{row.type.toUpperCase()} · 已保存</ListView.Description></div></ListView.ItemContent>
          </ListView.Item>}
        </ListView>}
    </Card.Content>
  </Card></section>;
}

/** Keep each output kind on the same authorized reader used by Teaching Files. */
export function ConversationSavedPreview({artifact,onClose,onOpenPath}:{artifact:TeachingFileCatalogEntry;onClose:()=>void;onOpenPath:(path:string)=>void}){
  if(artifact.savedArtifactKind==='paper'&&!artifact.officeVersion&&!artifact.htmlVersion&&['docx','pdf'].includes(artifact.type))
    return <SavedArtifactPreview key={artifact.sessionId+':'+artifact.id} sessionId={artifact.sessionId} artifactId={artifact.id} onClose={onClose}/>;
  return <Card data-heroui-native="" data-theme="light" aria-label="已保存成果预览">
    <Card.Header><Card.Title>{artifact.fileName}</Card.Title><Card.Description>核对当前版本后打开原本地文件。</Card.Description></Card.Header>
    <Card.Content>{artifact.officeVersion?<PiOfficeCurrent sessionId={artifact.sessionId} artifactId={artifact.id} fallbackPath={artifact.fileName} onOpen={onOpenPath} label="预览当前文件"/>:
      <Button variant="secondary" onPress={()=>onOpenPath(artifact.fileName)}>预览文件</Button>}</Card.Content>
    <Card.Footer><Button variant="ghost" onPress={onClose}>返回文件列表</Button></Card.Footer>
  </Card>;
}
